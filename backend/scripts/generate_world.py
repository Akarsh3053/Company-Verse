"""CLI: regenerate ``generated/world.json`` from the dataset (no server needed).

Usage (from the backend/ directory)::

    python -m scripts.generate_world
"""

from __future__ import annotations

import asyncio

from app.config import get_settings
from app.dependencies import get_world_generator, get_world_repository


async def _run() -> None:
    settings = get_settings()
    generator = get_world_generator()
    repository = get_world_repository()

    world = await generator.generate()
    path = await repository.save(world)

    meta = world.metadata
    print(f"Provider      : {meta.provider}")
    print(f"Company       : {meta.company_name} ({meta.industry})")
    print(
        f"Regions       : {meta.region_count} | "
        f"Landmarks: {meta.landmark_count} | "
        f"Connections: {meta.connection_count}"
    )
    print(f"Employees     : {meta.employee_count}")
    print(f"Content hash  : {meta.content_hash}")
    print(f"Written to    : {path}")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
