"""Challenge schemas — the interactive tests inside quests.

A :class:`Challenge` is a small, grounded decision/quiz/scenario generated from a
specific piece of organizational knowledge (a deployment SOP, an incident
runbook, a security policy, …). Completing one teaches a real process. The
frontend renders the prompt + options and scores the player's choice.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

ChallengeType = Literal["quiz", "decision", "scenario", "ordering"]
ChallengeDifficulty = Literal["intro", "easy", "medium", "hard"]


class ChallengeOption(BaseModel):
    """A single selectable answer/choice for a challenge."""

    id: str
    text: str
    is_correct: bool = False
    #: Shown after the player picks this option (teaches *why*).
    feedback: str = ""
    #: For ``ordering`` challenges: the correct 1-based position of this step.
    order_index: int | None = None


class Challenge(BaseModel):
    """An interactive, knowledge-grounded test within a quest."""

    id: str
    quest_id: str
    type: ChallengeType
    title: str
    prompt: str
    #: Optional narrative setup / context for the prompt.
    scenario: str | None = None
    options: list[ChallengeOption] = Field(default_factory=list)
    #: The overall teaching point, shown on completion.
    explanation: str = ""
    difficulty: ChallengeDifficulty = "easy"
    reward_xp: int = 25
    #: Document ids this challenge is grounded in (provenance for the frontend).
    knowledge_doc_ids: list[str] = Field(default_factory=list)

    @property
    def correct_option_ids(self) -> list[str]:
        return [option.id for option in self.options if option.is_correct]
