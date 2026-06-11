"""ConversationService — runtime, grounded NPC chat (optional milestone).

Pre-generated dialogue trees live in the bundle, but this service powers
free-form player → NPC chat. It re-resolves the bundle's persona to rebuild the
grounded :class:`~app.ai.contracts.GenerationContext`, then asks the active
content generator for an in-character, knowledge-grounded reply. With the offline
engine the reply is a grounded canned response; with a real model it is a live,
grounded completion — same call site, no code change.
"""

from __future__ import annotations

from app.ai.llm import GameContentGenerator
from app.models.npc import NPC
from app.services.bundle_persistence import BundleRepository
from app.services.knowledge_service import KnowledgeService
from app.services.npc_persistence import NPCRepository
from app.services.persona_resolver import PersonaResolver
from app.services.world_persistence import WorldRepository


class ConversationError(RuntimeError):
    """Raised when a chat request cannot be served (missing bundle/NPC)."""


class ConversationService:
    """Answer free-form player messages to a bundle's NPCs, grounded in knowledge."""

    def __init__(
        self,
        *,
        knowledge: KnowledgeService,
        content: GameContentGenerator,
        world_repository: WorldRepository,
        npc_repository: NPCRepository,
        bundle_repository: BundleRepository,
        max_quests: int = 5,
    ) -> None:
        self._knowledge = knowledge
        self._content = content
        self._world_repository = world_repository
        self._npc_repository = npc_repository
        self._bundles = bundle_repository
        self._resolver = PersonaResolver(knowledge, max_quests=max_quests)

    async def reply(
        self,
        *,
        user_key: str,
        npc_id: str,
        message: str,
        history: list[dict[str, str]] | None = None,
    ) -> dict[str, str]:
        bundle = await self._bundles.load(user_key)
        if bundle is None:
            raise ConversationError(
                f"No game bundle for '{user_key}'. Generate one via POST /game/bundle."
            )
        world = await self._world_repository.load()
        npcs = await self._npc_repository.load()
        if world is None or npcs is None:
            raise ConversationError("World/NPCs missing; regenerate the bundle.")

        npc = self._find_npc(npc_id, bundle.npcs) or self._find_npc(npc_id, npcs.npcs)
        if npc is None:
            raise ConversationError(f"NPC '{npc_id}' not found.")

        plan = await self._resolver.resolve(bundle.persona, world, npcs)
        ctx = plan.context

        # Ground the reply on a fresh search over the WHOLE knowledge base (the
        # Foundry IQ retrieval seam), blended with the persona's quest docs — so
        # an NPC can answer about topics beyond this player's questline.
        grounding: list[str] = []
        seen: set[str] = set()
        try:
            matches = await self._knowledge.search(message, top_k=4)
        except Exception:  # noqa: BLE001 - search is best-effort grounding
            matches = []
        for match in matches:
            if match.snippet and match.title not in seen:
                grounding.append(f"{match.title}: {match.snippet}")
                seen.add(match.title)
        for doc in ctx.grounding_docs:
            if doc.summary and doc.title not in seen:
                grounding.append(f"{doc.title}: {doc.summary}")
                seen.add(doc.title)

        text = await self._content.chat_reply(
            ctx,
            npc.id,
            npc.name,
            npc.persona,
            grounding,
            history or [],
            message,
        )
        return {"npc_id": npc.id, "npc_name": npc.name, "reply": text}

    @staticmethod
    def _find_npc(npc_id: str, npcs: list[NPC]) -> NPC | None:
        for npc in npcs:
            if npc.id == npc_id:
                return npc
        return None
