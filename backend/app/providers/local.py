"""Local knowledge provider backed by the synthetic company dataset.

Reads the CSV + markdown dataset once (lazily, off the event loop) and serves
typed models from an in-memory snapshot. This is the default provider for the
hackathon demo and for all local development.
"""

from __future__ import annotations

import asyncio
import re
from pathlib import Path

from app.models.knowledge import (
    CompanyProfile,
    Department,
    Document,
    DocumentMatch,
    Employee,
    KnowledgeSnapshot,
    Project,
    ProviderHealth,
    SystemAsset,
    Team,
)
from app.providers.base import KnowledgeProvider
from app.utils import data_loader


class LocalKnowledgeProvider(KnowledgeProvider):
    """Serve enterprise knowledge from the on-disk synthetic dataset."""

    name = "local"

    def __init__(self, data_dir: Path | str):
        self._data_dir = Path(data_dir)
        self._snapshot: KnowledgeSnapshot | None = None
        self._lock = asyncio.Lock()

    async def _load(self) -> KnowledgeSnapshot:
        """Load (and memoize) the snapshot. File IO runs in a worker thread."""
        if self._snapshot is not None:
            return self._snapshot
        async with self._lock:
            if self._snapshot is None:
                if not self._data_dir.exists():
                    raise FileNotFoundError(
                        f"Synthetic dataset not found at '{self._data_dir}'. "
                        "Set DATA_DIR to the org_data folder."
                    )
                self._snapshot = await asyncio.to_thread(
                    data_loader.load_snapshot, self._data_dir
                )
        return self._snapshot

    async def get_company_profile(self) -> CompanyProfile:
        return (await self._load()).company

    async def get_employees(self) -> list[Employee]:
        return list((await self._load()).employees)

    async def get_teams(self) -> list[Team]:
        return list((await self._load()).teams)

    async def get_departments(self) -> list[Department]:
        return list((await self._load()).departments)

    async def get_systems(self) -> list[SystemAsset]:
        return list((await self._load()).systems)

    async def get_projects(self) -> list[Project]:
        return list((await self._load()).projects)

    async def get_documents(self) -> list[Document]:
        return list((await self._load()).documents)

    async def search(self, query: str, *, top_k: int = 5) -> list[DocumentMatch]:
        documents = (await self._load()).documents
        return _keyword_search(documents, query, top_k)

    async def health_check(self) -> ProviderHealth:
        try:
            snapshot = await self._load()
            healthy = bool(snapshot.employees)
            return ProviderHealth(
                provider=self.name,
                status="ok" if healthy else "degraded",
                detail=(
                    f"Loaded {len(snapshot.employees)} employees, "
                    f"{len(snapshot.teams)} teams, {len(snapshot.systems)} systems "
                    f"from {self._data_dir}"
                ),
            )
        except Exception as exc:  # noqa: BLE001 - report, never raise
            return ProviderHealth(
                provider=self.name, status="unavailable", detail=str(exc)
            )


_TOKEN_RE = re.compile(r"\w+")


def _keyword_search(
    documents: list[Document], query: str, top_k: int
) -> list[DocumentMatch]:
    """A small, deterministic keyword scorer (placeholder for semantic search)."""
    terms = [term for term in _TOKEN_RE.findall(query.lower()) if len(term) > 2]
    if not terms:
        return []

    matches: list[DocumentMatch] = []
    for document in documents:
        haystack = f"{document.title} {document.summary} {document.content}".lower()
        score = sum(haystack.count(term) for term in terms)
        if score <= 0:
            continue
        matches.append(
            DocumentMatch(
                document_id=document.id,
                title=document.title,
                score=float(score),
                snippet=_snippet(document, terms),
            )
        )

    matches.sort(key=lambda match: (-match.score, match.document_id))
    return matches[:top_k]


def _snippet(document: Document, terms: list[str], window: int = 160) -> str:
    content = document.content
    lowered = content.lower()
    index = min(
        (pos for term in terms if (pos := lowered.find(term)) != -1),
        default=-1,
    )
    if index == -1:
        return document.summary
    start = max(0, index - window // 2)
    end = min(len(content), index + window // 2)
    fragment = " ".join(content[start:end].split())
    return f"\u2026{fragment}\u2026"
