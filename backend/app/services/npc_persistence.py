"""Persistence for generated NPC artifacts.

Writes/reads ``generated/npcs.json`` using the same disciplined IO as
:class:`~app.services.world_persistence.WorldRepository`: disk access is
dispatched to a worker thread so async request handlers never block the event
loop, and JSON is written with a stable key order (``sort_keys=True``) and
``ensure_ascii=False`` so the artifact is human-readable and diff-friendly.

The repository exposes the Milestone 2 persistence contract: ``load()``,
``save()`` and ``regenerate()`` (build fresh via the injected generator, then
persist).
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING

from app.models.npc import NPCCollection

if TYPE_CHECKING:  # avoid a runtime import cycle (generator imports nothing here)
    from app.generators.npc_generator import NPCGenerator


class NPCRepository:
    """Read/write the generated NPCs to ``<generated_dir>/npcs.json``."""

    def __init__(self, generated_dir: Path | str) -> None:
        self._dir = Path(generated_dir)
        self._file = self._dir / "npcs.json"

    @property
    def path(self) -> Path:
        return self._file

    def exists(self) -> bool:
        return self._file.exists()

    async def save(self, collection: NPCCollection) -> Path:
        await asyncio.to_thread(self._save_sync, collection)
        return self._file

    def _save_sync(self, collection: NPCCollection) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        payload = collection.model_dump(mode="json")
        text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True)
        self._file.write_text(text + "\n", encoding="utf-8")

    async def load(self) -> NPCCollection | None:
        if not self._file.exists():
            return None
        return await asyncio.to_thread(self._load_sync)

    def _load_sync(self) -> NPCCollection:
        raw = json.loads(self._file.read_text(encoding="utf-8"))
        return NPCCollection.model_validate(raw)

    async def regenerate(self, generator: "NPCGenerator") -> NPCCollection:
        """Generate a fresh NPC collection and persist it.

        Raises:
            FileNotFoundError: propagated from the generator when the world has
                not been generated yet (NPCs require valid regions).
        """
        collection = await generator.generate()
        await self.save(collection)
        return collection
