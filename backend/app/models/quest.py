"""Quest schemas — the personalized onboarding journey.

A :class:`Quest` is one step of a new joiner's adventure, generated from a real
organizational process/document and bound to a world region + an NPC giver. The
quest line as a whole is ordered (and gated by ``prerequisites``) so the game
unfolds like an early-Pokémon route: talk to an NPC, explore a landmark, pass a
challenge, level up, unlock the next quest.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

QuestDifficulty = Literal["intro", "easy", "medium", "hard"]
QuestStatus = Literal["locked", "available", "active", "complete"]
ObjectiveType = Literal["talk", "explore", "challenge", "read", "decision"]


class Reward(BaseModel):
    """What completing a quest grants the player."""

    xp: int = 100
    knowledge_points: int = 0
    badge: str | None = None
    #: Stat bumps applied to the PC, e.g. ``{"deployment": 10}``.
    stat_gains: dict[str, int] = Field(default_factory=dict)
    #: Quest ids unlocked on completion (frontend flips them to 'available').
    unlocks: list[str] = Field(default_factory=list)


class QuestObjective(BaseModel):
    """A single step within a quest."""

    id: str
    description: str
    type: ObjectiveType
    target_npc_id: str | None = None
    target_region_id: str | None = None
    target_landmark_id: str | None = None
    challenge_id: str | None = None
    knowledge_doc_ids: list[str] = Field(default_factory=list)
    completed: bool = False


class Quest(BaseModel):
    """A personalized, knowledge-grounded onboarding quest."""

    id: str
    title: str
    summary: str
    #: AI-authored flavour text / framing for the quest.
    narrative: str = ""
    region_id: str
    giver_npc_id: str | None = None
    order: int = 0
    difficulty: QuestDifficulty = "easy"
    objectives: list[QuestObjective] = Field(default_factory=list)
    challenge_ids: list[str] = Field(default_factory=list)
    reward: Reward = Field(default_factory=Reward)
    knowledge_doc_ids: list[str] = Field(default_factory=list)
    #: Human-readable provenance, e.g. "Deployment SOP (deployment-sop)".
    source: str = ""
    status: QuestStatus = "locked"
    prerequisites: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
