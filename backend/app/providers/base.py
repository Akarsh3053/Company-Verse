"""The knowledge provider abstraction.

A :class:`KnowledgeProvider` is the seam between CompanyVerse and a source of
enterprise knowledge. Today the only concrete source is the synthetic dataset
(:class:`~app.providers.local.LocalKnowledgeProvider`); Milestone 5 adds a
Foundry IQ-backed implementation. Because every provider returns the same typed
models, swapping providers requires no changes anywhere downstream.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.knowledge import (
    CompanyProfile,
    Department,
    Document,
    DocumentMatch,
    Employee,
    Project,
    ProviderHealth,
    SystemAsset,
    Team,
)


class KnowledgeProvider(ABC):
    """Unified, async interface for retrieving enterprise knowledge."""

    #: Stable, human-readable provider identifier (e.g. ``"local"``).
    name: str = "base"

    @abstractmethod
    async def get_company_profile(self) -> CompanyProfile:
        """Return high-level company facts."""

    @abstractmethod
    async def get_employees(self) -> list[Employee]:
        """Return all employees."""

    @abstractmethod
    async def get_teams(self) -> list[Team]:
        """Return all teams."""

    @abstractmethod
    async def get_departments(self) -> list[Department]:
        """Return all departments."""

    @abstractmethod
    async def get_systems(self) -> list[SystemAsset]:
        """Return all systems / services."""

    @abstractmethod
    async def get_projects(self) -> list[Project]:
        """Return all projects."""

    @abstractmethod
    async def get_documents(self) -> list[Document]:
        """Return all knowledge documents."""

    @abstractmethod
    async def search(self, query: str, *, top_k: int = 5) -> list[DocumentMatch]:
        """Retrieve the documents most relevant to ``query``.

        Used by later milestones (quest/NPC grounding). Implemented locally with
        a lightweight keyword scorer; Foundry IQ will back this with semantic
        retrieval.
        """

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        """Report provider availability without raising."""
