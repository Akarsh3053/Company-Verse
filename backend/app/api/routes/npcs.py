"""NPC generation + retrieval endpoints (Milestone 2).

* ``POST /generate/npcs`` — (re)generate NPCs from enterprise knowledge + the
  generated world, then persist to ``generated/npcs.json``.
* ``GET /npcs`` — list generated NPC summaries (optionally filtered by region).
* ``GET /npcs/{npc_id}`` — return a single full NPC.

NPCs require a generated world (NPCs are bound to valid regions). When the world
is missing, generation fails gracefully with ``503``.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.dependencies import get_npc_generator, get_npc_repository
from app.generators.npc_generator import NPCGenerator
from app.models.npc import NPC, NPCCollection, NPCSummary
from app.services.npc_persistence import NPCRepository

router = APIRouter(tags=["npcs"])


@router.post(
    "/generate/npcs",
    response_model=NPCCollection,
    status_code=status.HTTP_201_CREATED,
    summary="Generate NPCs from enterprise knowledge and the world",
)
async def generate_npcs(
    generator: NPCGenerator = Depends(get_npc_generator),
    repository: NPCRepository = Depends(get_npc_repository),
) -> NPCCollection:
    """Build NPCs from the active provider + world, and persist them."""
    try:
        return await repository.regenerate(generator)
    except NotImplementedError as exc:
        # The Foundry provider is a Milestone 5 scaffold.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc)
        ) from exc
    except FileNotFoundError as exc:
        # World not generated yet, or the dataset is missing.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc


@router.get(
    "/npcs",
    response_model=list[NPCSummary],
    summary="List generated NPCs",
)
async def list_npcs(
    region_id: str | None = Query(
        default=None, description="Filter NPCs by region id (e.g. 'security-keep')."
    ),
    repository: NPCRepository = Depends(get_npc_repository),
) -> list[NPCSummary]:
    """Return NPC summaries, optionally filtered by ``region_id``."""
    collection = await repository.load()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NPCs have not been generated yet. POST /generate/npcs first.",
        )
    npcs = collection.npcs
    if region_id is not None:
        npcs = [npc for npc in npcs if npc.region_id == region_id]
    return [
        NPCSummary(
            id=npc.id,
            name=npc.name,
            title=npc.title,
            role=npc.role,
            region_id=npc.region_id,
            sprite_type=npc.sprite_type,
        )
        for npc in npcs
    ]


@router.get(
    "/npcs/{npc_id}",
    response_model=NPC,
    summary="Get a single NPC by id",
)
async def get_npc(
    npc_id: str,
    repository: NPCRepository = Depends(get_npc_repository),
) -> NPC:
    """Return the full NPC with ``id == npc_id``, or 404 if not found."""
    collection = await repository.load()
    if collection is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="NPCs have not been generated yet. POST /generate/npcs first.",
        )
    for npc in collection.npcs:
        if npc.id == npc_id:
            return npc
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"NPC '{npc_id}' not found.",
    )
