"""World generation + retrieval endpoints (Milestone 1).

* ``POST /generate/world`` — (re)generate the world from enterprise knowledge
  and persist it to ``generated/world.json``.
* ``GET /world`` — return the persisted world.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_world_generator, get_world_repository
from app.generators.world_generator import WorldGenerator
from app.models.world import World
from app.services.world_persistence import WorldRepository

router = APIRouter(tags=["world"])


@router.post(
    "/generate/world",
    response_model=World,
    status_code=status.HTTP_201_CREATED,
    summary="Generate the world from enterprise knowledge",
)
async def generate_world(
    generator: WorldGenerator = Depends(get_world_generator),
    repository: WorldRepository = Depends(get_world_repository),
) -> World:
    """Build the world from the active knowledge provider and persist it."""
    try:
        world = await generator.generate()
    except NotImplementedError as exc:
        # The Foundry provider is a Milestone 5 scaffold.
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc)
        ) from exc
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc

    await repository.save(world)
    return world


@router.get(
    "/world",
    response_model=World,
    summary="Get the generated world",
)
async def get_world(
    repository: WorldRepository = Depends(get_world_repository),
) -> World:
    """Return the persisted world, or 404 if it has not been generated yet."""
    world = await repository.load()
    if world is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="World has not been generated yet. POST /generate/world first.",
        )
    return world
