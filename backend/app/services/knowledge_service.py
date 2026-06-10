"""Unified enterprise knowledge access.

:class:`KnowledgeService` is the single entry point that generators and routes
depend on. It wraps whichever :class:`~app.providers.base.KnowledgeProvider` is
active, assembles a cached :class:`KnowledgeSnapshot`, and exposes retrieval.

Keeping this layer between the providers and the generators means the world
generator never needs to know whether knowledge came from the synthetic dataset
or Foundry IQ.
"""

from __future__ import annotations

import asyncio

from app.models.knowledge import (
    DocumentMatch,
    KnowledgeSnapshot,
    ProviderHealth,
)
from app.providers.base import KnowledgeProvider


class KnowledgeService:
    """Provider-agnostic facade over enterprise knowledge."""

    def __init__(self, provider: KnowledgeProvider) -> None:
        self._provider = provider
        self._snapshot: KnowledgeSnapshot | None = None
        self._lock = asyncio.Lock()

    @property
    def provider_name(self) -> str:
        return self._provider.name

    async def get_snapshot(self, *, refresh: bool = False) -> KnowledgeSnapshot:
        """Return the (cached) enterprise knowledge snapshot.

        All provider reads are issued concurrently with :func:`asyncio.gather`.
        Pass ``refresh=True`` to rebuild the cache (used by world generation so
        a freshly edited dataset is always reflected).
        """
        if self._snapshot is not None and not refresh:
            return self._snapshot

        async with self._lock:
            if self._snapshot is not None and not refresh:
                return self._snapshot

            (
                company,
                employees,
                teams,
                departments,
                systems,
                projects,
                documents,
            ) = await asyncio.gather(
                self._provider.get_company_profile(),
                self._provider.get_employees(),
                self._provider.get_teams(),
                self._provider.get_departments(),
                self._provider.get_systems(),
                self._provider.get_projects(),
                self._provider.get_documents(),
            )

            self._snapshot = KnowledgeSnapshot(
                company=company,
                employees=employees,
                teams=teams,
                departments=departments,
                systems=systems,
                projects=projects,
                documents=documents,
            )
            return self._snapshot

    async def search(self, query: str, *, top_k: int = 5) -> list[DocumentMatch]:
        """Retrieve documents relevant to ``query`` (used by later milestones)."""
        return await self._provider.search(query, top_k=top_k)

    async def health(self) -> ProviderHealth:
        """Return the active provider's health."""
        return await self._provider.health_check()
