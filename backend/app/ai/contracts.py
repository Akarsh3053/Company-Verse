"""Shared contracts for the AI content layer.

These types are the boundary between the *generation engine* (which owns world
structure, ids, and validation) and the *content generator* (which owns
language). A :class:`GenerationContext` is assembled once per bundle request and
passed to every content call; the content generator returns lightweight
**drafts** (prose only) that the deterministic generators finalize into the
public :mod:`app.models` shapes.

Keeping AI output confined to drafts means a flaky/garbage model response can be
repaired or rejected without ever corrupting the world graph or breaking the
frontend contract.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from app.models.challenge import ChallengeDifficulty, ChallengeType
from app.models.knowledge import CompanyProfile, Project, SystemAsset
from app.models.npc import NPC
from app.models.persona import UserPersona
from app.models.quest import ObjectiveType, QuestDifficulty
from app.models.world import Region


class GroundingDoc(BaseModel):
    """A knowledge document trimmed to what the content layer needs.

    ``section_titles`` are the document's real ``##`` sections (deployment
    windows, rollback procedure, …) and are used both as grounding for prose and
    as the source of *correct* answers in dataset-driven challenges.
    """

    id: str
    title: str
    category: str
    summary: str
    owner: str | None = None
    section_titles: list[str] = Field(default_factory=list)


class QuestSeed(BaseModel):
    """A deterministic plan for one quest. The engine picks these; AI writes prose.

    The seed fixes everything *structural* (which document grounds the quest,
    which region/NPC it binds to, its order and difficulty) so the world stays
    coherent regardless of what the model returns.
    """

    order: int
    doc_id: str
    doc_title: str
    doc_category: str
    doc_summary: str
    section_titles: list[str] = Field(default_factory=list)
    region_id: str
    region_name: str
    giver_npc_id: str | None = None
    giver_npc_name: str | None = None
    difficulty: QuestDifficulty = "easy"


class GenerationContext(BaseModel):
    """Everything a content generator needs for one bundle request."""

    persona: UserPersona
    experience_level: str
    company: CompanyProfile
    home_region: Region
    regions: list[Region] = Field(default_factory=list)
    npcs: list[NPC] = Field(default_factory=list)
    grounding_docs: list[GroundingDoc] = Field(default_factory=list)
    systems: list[SystemAsset] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)

    @property
    def docs_by_id(self) -> dict[str, GroundingDoc]:
        return {doc.id: doc for doc in self.grounding_docs}


# --------------------------------------------------------------------------- #
# Draft types (prose only — no ids, positions, rewards, or bindings)
# --------------------------------------------------------------------------- #
class ObjectiveDraft(BaseModel):
    description: str
    type: ObjectiveType = "talk"


class QuestDraft(BaseModel):
    title: str
    summary: str
    narrative: str
    objectives: list[ObjectiveDraft] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ChallengeOptionDraft(BaseModel):
    text: str
    is_correct: bool = False
    feedback: str = ""


class ChallengeDraft(BaseModel):
    type: ChallengeType = "decision"
    title: str
    prompt: str
    scenario: str | None = None
    options: list[ChallengeOptionDraft] = Field(default_factory=list)
    explanation: str = ""
    difficulty: ChallengeDifficulty = "easy"


class DialogueDraft(BaseModel):
    """Persona/quest-aware lines for one NPC; finalized into a DialogueTree."""

    greeting: str
    info_lines: list[str] = Field(default_factory=list)
    quest_offer: str | None = None
    quest_active: str | None = None
    quest_complete: str | None = None
    knowledge_tidbits: list[str] = Field(default_factory=list)
