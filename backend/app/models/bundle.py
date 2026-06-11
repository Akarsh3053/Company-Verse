"""GameBundle — the single payload the frontend needs to render & play.

``POST /game/bundle`` with a :class:`~app.models.persona.UserPersona` returns one
:class:`GameBundle`: the personalized world map, the player character, the NPC
cast with branching dialogue, the ordered quest line, and the challenges inside
those quests. The Phaser/Next frontend renders entirely from this structure —
field names and shapes here are part of the public contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.challenge import Challenge
from app.models.dialogue import DialogueTree
from app.models.npc import NPC
from app.models.persona import PlayerCharacter, UserPersona
from app.models.quest import Quest
from app.models.world import World


class GameBundleMetadata(BaseModel):
    """Provenance + summary statistics for a generated game bundle."""

    bundle_id: str
    user_key: str
    persona_name: str
    persona_role: str
    home_region_id: str
    #: Active knowledge provider (``local`` / ``foundry``).
    provider: str
    #: Active generative AI provider (``local`` / ``azure_openai`` / ``foundry``).
    llm_provider: str
    generator_version: str
    generated_at: str
    quest_count: int
    npc_count: int
    challenge_count: int
    region_count: int
    #: Document ids that grounded this bundle's generation (Foundry IQ seam).
    grounding_doc_ids: list[str] = Field(default_factory=list)
    #: Deterministic fingerprint of bundle content (excludes ``generated_at``).
    #: Meaningful for the offline ``local`` LLM; informational for real models.
    content_hash: str = ""


class GameBundle(BaseModel):
    """Everything required to render and play one new joiner's onboarding game."""

    metadata: GameBundleMetadata
    #: The persona this bundle was generated for (echoed back; powers runtime chat).
    persona: UserPersona
    #: Opening cutscene narration ("You've just joined …").
    narrative_intro: str = ""
    player: PlayerCharacter
    world: World
    npcs: list[NPC] = Field(default_factory=list)
    dialogues: list[DialogueTree] = Field(default_factory=list)
    quests: list[Quest] = Field(default_factory=list)
    challenges: list[Challenge] = Field(default_factory=list)
