"""Persistence for generated world artifacts.

Writes/reads ``generated/world.json``. Disk IO is dispatched to a worker thread
so the async request handlers never block the event loop. JSON is written with a
stable key order and ``ensure_ascii=False`` so the artifact is human-readable and
diff-friendly.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.models.world import World


class WorldRepository:
    """Read/write the generated world to ``<generated_dir>/world.json``."""

    def __init__(self, generated_dir: Path | str) -> None:
        self._dir = Path(generated_dir)
        self._file = self._dir / "world.json"

    @property
    def path(self) -> Path:
        return self._file

    def exists(self) -> bool:
        return self._file.exists()

    async def save(self, world: World) -> Path:
        await asyncio.to_thread(self._save_sync, world)
        return self._file

    def _save_sync(self, world: World) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        payload = world.model_dump(mode="json")
        text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True)
        self._file.write_text(text + "\n", encoding="utf-8")

    async def load(self) -> World | None:
        if not self._file.exists():
            return None
        return await asyncio.to_thread(self._load_sync)

    def _load_sync(self) -> World:
        raw = json.loads(self._file.read_text(encoding="utf-8"))
        return World.model_validate(raw)
