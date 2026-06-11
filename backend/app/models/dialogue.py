"""Dialogue schemas — branching NPC conversations.

Each NPC in a :class:`~app.models.bundle.GameBundle` carries a
:class:`DialogueTree`: a small branching conversation the frontend walks as the
player talks to them. Trees are persona-aware (the greeting addresses the new
joiner by name/role) and quest-aware (choices can offer/advance quests). Lines
are grounded in the NPC's owned knowledge so the dialogue teaches real process.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

DialogueNodeType = Literal["greeting", "info", "quest_offer", "quest_active", "quest_complete", "farewell"]


class DialogueChoice(BaseModel):
    """A player-selectable reply that advances or branches the conversation."""

    id: str
    text: str
    next_node_id: str | None = None
    #: When set, selecting this choice offers/starts the given quest.
    triggers_quest_id: str | None = None
    ends_dialogue: bool = False


class DialogueNode(BaseModel):
    """A single line spoken by the NPC, plus the player's possible replies."""

    id: str
    type: DialogueNodeType = "info"
    speaker: str
    text: str
    choices: list[DialogueChoice] = Field(default_factory=list)
    #: Optional quest this line relates to (drives frontend state).
    quest_id: str | None = None


class DialogueTree(BaseModel):
    """A complete branching conversation for one NPC."""

    npc_id: str
    root_node_id: str
    nodes: list[DialogueNode] = Field(default_factory=list)
