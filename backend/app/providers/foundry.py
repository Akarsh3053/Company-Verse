"""Foundry IQ knowledge provider — production-ready scaffold.

This class establishes the full shape of a Microsoft **Foundry IQ**-backed
provider so that Milestone 5 is a matter of *filling in* the SDK calls rather
than reshaping the architecture. It is intentionally importable and
constructible without credentials so that provider switching and health checks
work today; data-retrieval methods raise :class:`NotImplementedError` until the
real integration lands.

Intended Milestone 5 integration
--------------------------------
* Authenticate against an Azure AI Foundry project using
  ``FOUNDRY_ENDPOINT`` / ``FOUNDRY_API_KEY`` (or ``DefaultAzureCredential``).
* Bind to a Foundry IQ knowledge index (``FOUNDRY_INDEX``) that has been
  populated with the enterprise corpus.
* Implement :meth:`search` via Foundry IQ grounded retrieval and map the
  structured org graph (Work IQ) onto the typed domain models.
"""

from __future__ import annotations

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
from app.providers.base import KnowledgeProvider

_MILESTONE_5 = "Foundry IQ integration is delivered in Milestone 5."


class FoundryConfigurationError(RuntimeError):
    """Raised when the Foundry provider is used without required configuration."""


class FoundryIQKnowledgeProvider(KnowledgeProvider):
    """Scaffold for a Foundry IQ-backed knowledge provider."""

    name = "foundry"

    def __init__(
        self,
        *,
        endpoint: str | None = None,
        api_key: str | None = None,
        project: str | None = None,
        index: str | None = None,
    ) -> None:
        self._endpoint = endpoint
        self._api_key = api_key
        self._project = project
        self._index = index
        # Lazily-initialised SDK client (populated in Milestone 5).
        self._client: object | None = None

    @property
    def is_configured(self) -> bool:
        """True when all required Foundry connection settings are present."""
        return all((self._endpoint, self._api_key, self._project, self._index))

    def _ensure_client(self) -> object:
        """Validate configuration and (eventually) build the Foundry client."""
        if not self.is_configured:
            raise FoundryConfigurationError(
                "Foundry IQ provider is not configured. Set FOUNDRY_ENDPOINT, "
                "FOUNDRY_API_KEY, FOUNDRY_PROJECT and FOUNDRY_INDEX."
            )
        if self._client is None:
            # Milestone 5: initialise the Azure AI Foundry / Foundry IQ client,
            # e.g. azure.ai.projects.AIProjectClient bound to self._index.
            raise NotImplementedError(_MILESTONE_5)
        return self._client

    async def get_company_profile(self) -> CompanyProfile:
        raise NotImplementedError(_MILESTONE_5)

    async def get_employees(self) -> list[Employee]:
        raise NotImplementedError(_MILESTONE_5)

    async def get_teams(self) -> list[Team]:
        raise NotImplementedError(_MILESTONE_5)

    async def get_departments(self) -> list[Department]:
        raise NotImplementedError(_MILESTONE_5)

    async def get_systems(self) -> list[SystemAsset]:
        raise NotImplementedError(_MILESTONE_5)

    async def get_projects(self) -> list[Project]:
        raise NotImplementedError(_MILESTONE_5)

    async def get_documents(self) -> list[Document]:
        raise NotImplementedError(_MILESTONE_5)

    async def search(self, query: str, *, top_k: int = 5) -> list[DocumentMatch]:
        # Milestone 5: call Foundry IQ grounded retrieval against self._index
        # and map hits onto DocumentMatch.
        raise NotImplementedError(_MILESTONE_5)

    async def health_check(self) -> ProviderHealth:
        """Report scaffold status without raising, so the app can still boot."""
        if self.is_configured:
            return ProviderHealth(
                provider=self.name,
                status="degraded",
                detail="Configured, but SDK integration is pending (Milestone 5).",
            )
        return ProviderHealth(
            provider=self.name,
            status="unavailable",
            detail="Foundry IQ credentials not provided; scaffold only.",
        )
