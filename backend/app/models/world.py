"""World schemas — the contract serialized to ``generated/world.json``.

The frontend (Phaser) renders directly from these structures, so field names
and shapes here are part of the public contract.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Position(BaseModel):
    """A 2D pixel coordinate on the world canvas."""

    x: int
    y: int


class Landmark(BaseModel):
    """A point of interest inside a region (generated from a system/project)."""

    id: str
    name: str
    landmark_type: str
    source_type: Literal["system", "project"]
    source_id: str
    description: str
    position: Position
    criticality: str | None = None
    tags: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)


class Region(BaseModel):
    """A themed region of the world (generated from a team)."""

    id: str
    name: str
    biome: str
    theme: str
    department: str
    source_team: str
    description: str
    position: Position
    color: str
    icon: str
    lead: str | None = None
    member_count: int = 0
    landmarks: list[Landmark] = Field(default_factory=list)
    knowledge_doc_ids: list[str] = Field(default_factory=list)


class Connection(BaseModel):
    """A traversable link between two regions."""

    id: str
    source: str
    target: str
    type: Literal["road", "bridge"]
    reason: str


class WorldMetadata(BaseModel):
    """Provenance + summary statistics for a generated world."""

    world_id: str
    name: str
    company_name: str
    industry: str | None = None
    description: str
    provider: str
    generator_version: str
    seed: int
    generated_at: str
    region_count: int
    landmark_count: int
    connection_count: int
    employee_count: int
    # Deterministic fingerprint of the world *content* (excludes generated_at).
    # Re-generating from the same dataset yields an identical content_hash.
    content_hash: str


class World(BaseModel):
    """The complete playable world."""

    metadata: WorldMetadata
    spawn: Position
    regions: list[Region] = Field(default_factory=list)
    connections: list[Connection] = Field(default_factory=list)
