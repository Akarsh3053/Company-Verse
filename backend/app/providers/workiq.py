"""Work IQ org-graph connector — production-ready scaffold.

Foundry IQ (``app.providers.foundry``) supplies *document* knowledge; **Work IQ**
supplies *organizational* knowledge — reporting lines, team ownership, and who is
the expert on what. For the demo this is derived from the synthetic dataset by
:class:`LocalOrgGraphConnector`; in production a :class:`WorkIQOrgGraphConnector`
would federate the same shape from Microsoft Work IQ.

Per the project brief the connector intentionally **stays in the codebase but
disconnected**: switching ``ORG_GRAPH=workiq`` (and supplying credentials) is the
only change required to go live — exactly like the ``PROVIDER`` / ``LLM_PROVIDER``
seams. Today the generators don't depend on it; it exists so that wiring real
Work IQ later is a configuration change, not a re-architecture.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from pydantic import BaseModel, Field

from app.models.knowledge import KnowledgeSnapshot, ProviderHealth


class OrgRelationship(BaseModel):
    """A directed organizational edge (e.g. ``reports_to``, ``owns``, ``expert_in``)."""

    source: str
    target: str
    type: str
    detail: str | None = None


class OrgGraph(BaseModel):
    """A normalized organizational graph (the Work IQ contract)."""

    relationships: list[OrgRelationship] = Field(default_factory=list)
    #: full name (lower) -> expertise tags
    expertise: dict[str, list[str]] = Field(default_factory=dict)


class OrgGraphConnector(ABC):
    """Unified, async interface for retrieving the organizational graph."""

    name: str = "base"

    @abstractmethod
    async def get_org_graph(self) -> OrgGraph:
        """Return the organizational graph."""

    @abstractmethod
    async def health_check(self) -> ProviderHealth:
        """Report availability without raising."""


class LocalOrgGraphConnector(OrgGraphConnector):
    """Derive the org graph from the synthetic knowledge snapshot (reporting tree)."""

    name = "local"

    def __init__(self, snapshot_provider) -> None:
        # ``snapshot_provider`` is an awaitable-returning callable (KnowledgeService.get_snapshot).
        self._snapshot_provider = snapshot_provider

    async def get_org_graph(self) -> OrgGraph:
        snapshot: KnowledgeSnapshot = await self._snapshot_provider()
        by_id = {e.id: e for e in snapshot.employees}
        relationships: list[OrgRelationship] = []
        for employee in snapshot.employees:
            manager = by_id.get(employee.manager_id)
            if manager is not None:
                relationships.append(
                    OrgRelationship(
                        source=employee.full_name,
                        target=manager.full_name,
                        type="reports_to",
                    )
                )
        return OrgGraph(relationships=relationships)

    async def health_check(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status="ok",
            detail="Org graph derived from the synthetic dataset's reporting tree.",
        )


class WorkIQOrgGraphConnector(OrgGraphConnector):
    """Scaffold for a Microsoft Work IQ-backed org graph (not yet wired to a tenant)."""

    name = "workiq"

    def __init__(
        self, *, endpoint: str | None = None, api_key: str | None = None
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key

    @property
    def is_configured(self) -> bool:
        return bool(self._endpoint and self._api_key)

    async def get_org_graph(self) -> OrgGraph:
        # Future: call Work IQ (e.g. Microsoft Graph /copilot) and map reporting
        # lines, ownership, and expertise onto OrgGraph.
        raise NotImplementedError(
            "Work IQ integration is a scaffold; connect a tenant to enable it."
        )

    async def health_check(self) -> ProviderHealth:
        status = "degraded" if self.is_configured else "unavailable"
        detail = (
            "Configured, but Work IQ SDK integration is pending."
            if self.is_configured
            else "Work IQ credentials not provided; scaffold only."
        )
        return ProviderHealth(provider=self.name, status=status, detail=detail)
