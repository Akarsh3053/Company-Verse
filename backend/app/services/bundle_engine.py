"""BundleEngine — orchestrate persona → playable GameBundle.

This is the heart of the persona-driven backend. It is a small async pipeline
(intentionally LangGraph-swappable: each step is an awaitable that consumes the
prior step's output) that:

    persona
      → ensure world + NPC roster exist (deterministic structure)
      → resolve persona to a grounded plan (home region, quest seeds)   [Foundry IQ grounding]
      → generate narration + backstory + quests + challenges + dialogue  [LLM seam]
      → assemble + fingerprint a GameBundle
      → persist per-user

Structure (world graph, NPC roster, ids, bindings) is deterministic; only the
*language* comes from the content generator, so a bundle is always coherent and
frontend-renderable regardless of which model produced the prose.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
from datetime import datetime, timezone

from app.ai.llm import GameContentGenerator
from app.generators.dialogue_generator import DialogueGenerator
from app.generators.npc_generator import NPCGenerator
from app.generators.quest_generator import QuestGenerator
from app.generators.world_generator import WorldGenerator
from app.models.bundle import GameBundle, GameBundleMetadata
from app.models.persona import PlayerCharacter, UserPersona
from app.models.world import World
from app.services.bundle_persistence import BundleRepository
from app.services.knowledge_service import KnowledgeService
from app.services.npc_persistence import NPCRepository
from app.services.persona_resolver import PersonaResolver, ResolvedPlan
from app.services.world_persistence import WorldRepository

#: Baseline knowledge stats every new player starts with.
_BASE_STATS: dict[str, int] = {
    "engineering": 5,
    "reliability": 5,
    "security": 5,
    "process": 5,
    "knowledge": 5,
}


class BundleEngine:
    """Build (and persist) a personalized :class:`GameBundle` for a persona."""

    VERSION = "1.0.0"

    def __init__(
        self,
        *,
        knowledge: KnowledgeService,
        content: GameContentGenerator,
        world_generator: WorldGenerator,
        world_repository: WorldRepository,
        npc_generator: NPCGenerator,
        npc_repository: NPCRepository,
        bundle_repository: BundleRepository,
        max_quests: int = 5,
    ) -> None:
        self._knowledge = knowledge
        self._content = content
        self._world_generator = world_generator
        self._world_repository = world_repository
        self._npc_generator = npc_generator
        self._npc_repository = npc_repository
        self._bundles = bundle_repository
        self._resolver = PersonaResolver(knowledge, max_quests=max_quests)
        self._quests = QuestGenerator(content)
        self._dialogue = DialogueGenerator(content)

    async def build(self, persona: UserPersona) -> GameBundle:
        world = await self._ensure_world()
        npcs = await self._ensure_npcs()

        plan = await self._resolver.resolve(persona, world, npcs)
        ctx = plan.context

        # Narration, backstory, and the quest line are independent — run together.
        narrative_intro, backstory, (quests, challenges) = await asyncio.gather(
            self._content.narrative_intro(ctx),
            self._content.player_backstory(ctx),
            self._quests.generate(ctx, plan.seeds),
        )
        # Dialogue depends on the finalized quests (offer/active/complete wiring).
        dialogues = await self._dialogue.generate(ctx, plan.cast_npcs, quests)

        personalized_world = self._personalize_world(world, ctx.home_region.id)
        player = self._build_player(persona, plan, backstory)
        metadata = self._build_metadata(
            persona=persona,
            plan=plan,
            world=personalized_world,
            quests=quests,
            challenges=challenges,
            narrative_intro=narrative_intro,
            player=player,
        )
        bundle = GameBundle(
            metadata=metadata,
            persona=persona,
            narrative_intro=narrative_intro,
            player=player,
            world=personalized_world,
            npcs=plan.cast_npcs,
            dialogues=dialogues,
            quests=quests,
            challenges=challenges,
        )
        await self._bundles.save(bundle)
        return bundle

    # ------------------------------------------------------------------ #
    # Prerequisites: deterministic world + NPC roster
    # ------------------------------------------------------------------ #
    async def _ensure_world(self) -> World:
        world = await self._world_repository.load()
        if world is None:
            world = await self._world_generator.generate()
            await self._world_repository.save(world)
        return world

    async def _ensure_npcs(self):
        npcs = await self._npc_repository.load()
        if npcs is None:
            npcs = await self._npc_generator.generate()
            await self._npc_repository.save(npcs)
        return npcs

    # ------------------------------------------------------------------ #
    # Assembly helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _personalize_world(world: World, home_region_id: str) -> World:
        """Return a copy of the world with spawn moved to the player's home region."""
        personalized = world.model_copy(deep=True)
        for region in personalized.regions:
            if region.id == home_region_id:
                personalized.spawn = region.position.model_copy()
                break
        return personalized

    @staticmethod
    def _build_player(
        persona: UserPersona, plan: ResolvedPlan, backstory: str
    ) -> PlayerCharacter:
        home = plan.context.home_region
        return PlayerCharacter(
            id=f"pc-{persona.user_key}",
            display_name=persona.name,
            role=persona.role,
            title=f"{persona.role} · Newcomer of {home.name}",
            sprite_type="player",
            home_region_id=home.id,
            spawn=home.position.model_copy(),
            level=1,
            xp=0,
            stats=dict(_BASE_STATS),
            backstory=backstory,
            avatar_color=home.color,
        )

    def _build_metadata(
        self,
        *,
        persona: UserPersona,
        plan: ResolvedPlan,
        world: World,
        quests,
        challenges,
        narrative_intro: str,
        player: PlayerCharacter,
    ) -> GameBundleMetadata:
        content_hash = self._content_hash(
            persona, world, quests, challenges, narrative_intro, player
        )
        return GameBundleMetadata(
            bundle_id=f"bundle-{persona.user_key}",
            user_key=persona.user_key,
            persona_name=persona.name,
            persona_role=persona.role,
            home_region_id=plan.context.home_region.id,
            provider=self._knowledge.provider_name,
            llm_provider=self._content.name,
            generator_version=self.VERSION,
            generated_at=datetime.now(timezone.utc).isoformat(),
            quest_count=len(quests),
            npc_count=len(plan.cast_npcs),
            challenge_count=len(challenges),
            region_count=len(world.regions),
            grounding_doc_ids=plan.grounding_doc_ids,
            content_hash=content_hash,
        )

    def _content_hash(
        self, persona, world, quests, challenges, narrative_intro, player
    ) -> str:
        payload = {
            "persona": persona.model_dump(),
            "version": self.VERSION,
            "world_content_hash": world.metadata.content_hash,
            "narrative_intro": narrative_intro,
            "player_backstory": player.backstory,
            "quests": [quest.model_dump() for quest in quests],
            "challenges": [challenge.model_dump() for challenge in challenges],
        }
        blob = json.dumps(
            payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        )
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()
