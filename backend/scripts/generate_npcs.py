"""CLI: regenerate ``generated/npcs.json`` from the dataset + world (no server).

Requires a generated ``world.json`` (NPCs bind to valid regions). Run the world
generator first if needed::

    python -m scripts.generate_world
    python -m scripts.generate_npcs
"""

from __future__ import annotations

import asyncio

from app.dependencies import get_npc_generator, get_npc_repository


async def _run() -> None:
    generator = get_npc_generator()
    repository = get_npc_repository()

    try:
        collection = await repository.regenerate(generator)
    except FileNotFoundError as exc:
        print(f"Cannot generate NPCs: {exc}")
        print("Hint: run `python -m scripts.generate_world` first.")
        return

    meta = collection.metadata
    print(f"Provider      : {meta.provider}")
    print(f"Company       : {meta.company_name}")
    print(f"NPCs          : {meta.npc_count} across {meta.region_count} regions")
    print(f"Roles         : {meta.roles}")
    print(f"World hash    : {meta.world_content_hash}")
    print(f"Content hash  : {meta.content_hash}")
    print(f"Written to    : {repository.path}")


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
