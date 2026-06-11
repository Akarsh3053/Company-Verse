"""The content-generator abstraction (the AI seam).

A :class:`GameContentGenerator` turns a :class:`~app.ai.contracts.GenerationContext`
(persona + grounded knowledge) into the *language* of the game. There are two
implementations:

* :class:`~app.ai.local_llm.LocalContentGenerator` — offline, deterministic,
  persona + knowledge aware. The default; needs no credentials.
* :class:`~app.ai.azure_openai.AzureOpenAIContentGenerator` — a real Azure
  OpenAI / Foundry IQ model. Selected via ``LLM_PROVIDER`` with no other code
  change; falls back to the local engine on any failure.

Every method returns **drafts** (see :mod:`app.ai.contracts`); the deterministic
generators own ids, bindings, rewards, and validation.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.ai.contracts import (
    ChallengeDraft,
    DialogueDraft,
    GenerationContext,
    QuestDraft,
    QuestSeed,
)
from app.models.knowledge import ProviderHealth
from app.models.quest import Quest


class GenerationError(RuntimeError):
    """Raised when a content generator cannot produce valid output."""


class GameContentGenerator(ABC):
    """Async interface for generating the language layer of a game bundle."""

    #: Stable identifier (``"local"`` / ``"azure_openai"`` / ``"foundry"``).
    name: str = "base"

    @abstractmethod
    async def narrative_intro(self, ctx: GenerationContext) -> str:
        """Opening cutscene narration that welcomes the new joiner."""

    @abstractmethod
    async def player_backstory(self, ctx: GenerationContext) -> str:
        """A short in-world backstory for the player character."""

    @abstractmethod
    async def quest(self, ctx: GenerationContext, seed: QuestSeed) -> QuestDraft:
        """Write the prose for one quest, grounded in ``seed``'s document."""

    @abstractmethod
    async def challenge(
        self, ctx: GenerationContext, seed: QuestSeed, quest: QuestDraft
    ) -> ChallengeDraft:
        """Write one knowledge-grounded challenge for a quest."""

    @abstractmethod
    async def npc_dialogue(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        given_quests: list[Quest],
    ) -> DialogueDraft:
        """Write a persona/quest-aware dialogue draft for one NPC."""

    @abstractmethod
    async def chat_reply(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        grounding: list[str],
        history: list[dict[str, str]],
        message: str,
    ) -> str:
        """Answer a free-form player message in-character, grounded in knowledge."""

    @abstractmethod
    async def health(self) -> ProviderHealth:
        """Report generator availability without raising."""
