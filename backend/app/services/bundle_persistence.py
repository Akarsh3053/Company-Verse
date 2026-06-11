"""Persistence for generated game bundles (one per user).

Bundles are written to ``<generated_dir>/bundles/<user_key>.json`` using the
same disciplined IO as the world/NPC repositories: disk access runs in a worker
thread and JSON is written with a stable key order and ``ensure_ascii=False`` so
artifacts are human-readable and diff-friendly.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.models.bundle import GameBundle


class BundleRepository:
    """Read/write per-user game bundles under ``<generated_dir>/bundles/``."""

    def __init__(self, generated_dir: Path | str) -> None:
        self._dir = Path(generated_dir) / "bundles"

    def path_for(self, user_key: str) -> Path:
        return self._dir / f"{user_key}.json"

    def exists(self, user_key: str) -> bool:
        return self.path_for(user_key).exists()

    async def save(self, bundle: GameBundle) -> Path:
        await asyncio.to_thread(self._save_sync, bundle)
        return self.path_for(bundle.metadata.user_key)

    def _save_sync(self, bundle: GameBundle) -> None:
        self._dir.mkdir(parents=True, exist_ok=True)
        payload = bundle.model_dump(mode="json")
        text = json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True)
        self.path_for(bundle.metadata.user_key).write_text(text + "\n", encoding="utf-8")

    async def load(self, user_key: str) -> GameBundle | None:
        path = self.path_for(user_key)
        if not path.exists():
            return None
        return await asyncio.to_thread(self._load_sync, path)

    @staticmethod
    def _load_sync(path: Path) -> GameBundle:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return GameBundle.model_validate(raw)

    async def list_keys(self) -> list[str]:
        if not self._dir.exists():
            return []
        return sorted(path.stem for path in self._dir.glob("*.json"))
