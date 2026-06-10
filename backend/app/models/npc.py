"""NPC schemas — the contract serialized to ``generated/npcs.json``.

NPCs are the organizational guides and experts that populate the world. Each NPC
is derived deterministically from a real employee and bound to a valid region
(``region_id``) produced by the :class:`~app.models.world.World`.

The shape here is deliberately *forward-compatible* with Milestone 4 (Runtime
Conversations): ``persona``, ``expertise``, ``knowledge_scope`` and
``source_employee`` exist now and are populated by deterministic templates, so
the grounding/retrieval layer can later consume them without a schema change.
The frontend renders NPCs directly from these structures, so field names and
shapes are part of the public contract.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

#: The fixed set of NPC categories (Milestone 2). Employee roles map onto these
#: deterministically in :mod:`app.generators.npc_archetypes`.
NPCCategory = Literal[
    "Guild Master",
    "Guide",
    "Guardian",
    "Sage",
    "Oracle",
    "Sentinel",
    "Artificer",
    "Architect",
    "Ranger",
]


class NPC(BaseModel):
    """A single organizational NPC generated from an employee."""

    id: str
    name: str
    title: str
    role: NPCCategory
    region_id: str
    source_employee: str
    sprite_type: str
    persona: str
    expertise: list[str] = Field(default_factory=list)
    knowledge_scope: list[str] = Field(default_factory=list)
    lore: str = ""
    metadata: dict[str, str] = Field(default_factory=dict)


class NPCSummary(BaseModel):
    """A lightweight NPC projection for list endpoints / world overlays."""

    id: str
    name: str
    title: str
    role: NPCCategory
    region_id: str
    sprite_type: str


class NPCCollectionMetadata(BaseModel):
    """Provenance + summary statistics for a generated NPC collection."""

    name: str
    company_name: str
    provider: str
    generator_version: str
    seed: int
    generated_at: str
    world_id: str
    world_content_hash: str
    npc_count: int
    region_count: int
    # Per-category counts (e.g. ``{"Guild Master": 8, "Guardian": 5}``), sorted.
    roles: dict[str, int] = Field(default_factory=dict)
    # Deterministic fingerprint of the NPC *content* (excludes generated_at).
    # Re-generating from the same world + dataset yields an identical hash.
    content_hash: str


class NPCCollection(BaseModel):
    """The complete set of generated NPCs plus provenance metadata."""

    metadata: NPCCollectionMetadata
    npcs: list[NPC] = Field(default_factory=list)
