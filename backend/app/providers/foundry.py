"""Foundry IQ knowledge provider — live implementation.

Uses the **Azure AI Search Knowledge Base** (Foundry IQ) for semantic retrieval
(:meth:`search`) while delegating structured-data methods (employees, teams,
systems, …) to a :class:`~app.providers.local.LocalKnowledgeProvider` that reads
the synthetic ``org_data/`` dataset.  This **hybrid design** is intentional:

* Foundry IQ excels at unstructured document retrieval (SOPs, runbooks,
  architecture guides) — that's what it's used for here.
* Structured relational data (CSV-format org data) is fastest and most correct
  when read directly; putting it through a search index adds latency with no
  semantic benefit.

The two auth paths mirror the LLM provider:

* **API key** — ``SEARCH_API_KEY`` (the Azure AI Search *query key*, found in
  the Azure portal under the search service → Keys).  Falls back to the existing
  ``FOUNDRY_API_KEY`` if ``SEARCH_API_KEY`` is not explicitly set.
* **Keyless / AAD** — ``AZURE_OPENAI_USE_AAD=true``; uses
  ``DefaultAzureCredential`` (``az login`` / managed identity).

Required env vars when ``PROVIDER=foundry``::

    SEARCH_ENDPOINT=https://<your-search-service>.search.windows.net
    FOUNDRY_INDEX=<knowledge-base-name>         # e.g. knowledgebase312
    SEARCH_API_KEY=<query-key>                  # from Azure portal → Search → Keys

The underlying SDK is ``azure-search-documents==12.1.0b1``.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

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

logger = logging.getLogger("companyverse")

# Field names the Foundry portal's ingestion pipeline commonly uses for
# chunk content and document title.  We check them in order and use the first
# that is non-empty.
_CONTENT_FIELDS = ("snippet", "chunk", "content", "page_chunk", "text", "body")
_TITLE_FIELDS = ("metadata_storage_name", "metadata_storage_path", "title", "document_title", "name", "filename")


class FoundryConfigurationError(RuntimeError):
    """Raised when the Foundry provider is used without required credentials."""


class FoundryIQKnowledgeProvider(KnowledgeProvider):
    """Hybrid Foundry IQ + local knowledge provider.

    * :meth:`search` → Foundry IQ knowledge-base semantic retrieval.
    * All structured-data methods → ``LocalKnowledgeProvider`` (org CSV data).
    """

    name = "foundry"

    def __init__(
        self,
        *,
        search_endpoint: str | None = None,
        search_api_key: str | None = None,
        knowledge_base_name: str | None = None,
        use_aad: bool = False,
        local_fallback: "KnowledgeProvider | None" = None,
    ) -> None:
        self._search_endpoint = (search_endpoint or "").rstrip("/")
        self._search_api_key = search_api_key
        self._knowledge_base_name = knowledge_base_name
        self._use_aad = use_aad
        # Structural data always comes from the local provider.
        if local_fallback is None:
            from app.providers.local import LocalKnowledgeProvider
            from app.config import get_settings
            local_fallback = LocalKnowledgeProvider(get_settings().data_dir)
        self._local = local_fallback
        self._client: Any | None = None

    # ------------------------------------------------------------------ #
    # Configuration
    # ------------------------------------------------------------------ #

    @property
    def is_configured(self) -> bool:
        """True when the minimum connection settings are present.

        Auth is either an API key *or* DefaultAzureCredential (keyless).
        When neither ``search_api_key`` nor ``use_aad`` is set explicitly we still
        consider the provider configured if endpoint + kb name are present and
        attempt DefaultAzureCredential — this supports RBAC-only search services
        (which show "No key available" in the Foundry connections list).
        """
        return bool(self._search_endpoint and self._knowledge_base_name)

    def _ensure_client(self) -> Any:
        """Lazily build the async Azure AI Search Knowledge Base client."""
        if self._client is not None:
            return self._client
        if not self.is_configured:
            raise FoundryConfigurationError(
                "Foundry IQ provider is not configured. Set SEARCH_ENDPOINT, "
                "FOUNDRY_INDEX, and either SEARCH_API_KEY or "
                "AZURE_OPENAI_USE_AAD=true."
            )
        # On Windows/Python 3.14, aiohttp doesn't trust system root CAs.
        # Azure Core reads REQUESTS_CA_BUNDLE when building SSL contexts, so
        # setting it here (before any session is created) picks up certifi's bundle.
        try:
            import certifi, os
            os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
        except ImportError:
            pass
        try:
            from azure.search.documents.knowledgebases.aio import (
                KnowledgeBaseRetrievalClient,
            )
        except ImportError as exc:
            raise RuntimeError(
                "azure-search-documents>=12.1.0b1 is required for "
                "PROVIDER=foundry. Run: pip install 'azure-search-documents==12.1.0b1'"
            ) from exc

        if self._search_api_key and not self._use_aad:
            # Explicit API key (search service configured for "Both" or "API keys").
            from azure.core.credentials import AzureKeyCredential
            cred = AzureKeyCredential(self._search_api_key)
        else:
            # RBAC-only service (or AZURE_OPENAI_USE_AAD=true).
            # Requires `az login` (or managed identity / env creds).
            from azure.identity.aio import DefaultAzureCredential
            cred = DefaultAzureCredential()

        self._client = KnowledgeBaseRetrievalClient(
            endpoint=self._search_endpoint,
            credential=cred,
            knowledge_base_name=self._knowledge_base_name,
        )
        return self._client

    @staticmethod
    def _ca_bundle() -> str | bool:
        """Return certifi's CA bundle path if available, else True (default verify).

        On Windows Python 3.14 the system root CAs aren't trusted by aiohttp;
        certifi provides a well-maintained trusted bundle that covers *.windows.net.
        """
        try:
            import certifi
            return certifi.where()
        except ImportError:
            return True  # fall back to aiohttp default

    # ------------------------------------------------------------------ #
    # Foundry IQ: semantic search
    # ------------------------------------------------------------------ #

    async def search(self, query: str, *, top_k: int = 5) -> list[DocumentMatch]:
        """Query the Foundry IQ knowledge base; fall back to local on any error."""
        try:
            return await self._foundry_search(query, top_k=top_k)
        except Exception as exc:  # noqa: BLE001
            logger.warning(
                "Foundry IQ search failed (%s); falling back to local keyword search.",
                exc,
            )
            return await self._local.search(query, top_k=top_k)

    async def _foundry_search(
        self, query: str, *, top_k: int
    ) -> list[DocumentMatch]:
        from azure.search.documents.knowledgebases.models import (
            KnowledgeBaseMessage,
            KnowledgeBaseMessageTextContent,
            KnowledgeBaseRetrievalRequest,
            KnowledgeRetrievalLowReasoningEffort,
        )

        client = self._ensure_client()
        request = KnowledgeBaseRetrievalRequest(
            messages=[
                KnowledgeBaseMessage(
                    role="user",
                    content=[KnowledgeBaseMessageTextContent(text=query)],
                )
            ],
            retrieval_reasoning_effort=KnowledgeRetrievalLowReasoningEffort(),
        )
        response = await client.retrieve(retrieval_request=request)
        return self._map_references(response, top_k)

    @staticmethod
    def _map_references(response: Any, top_k: int) -> list[DocumentMatch]:
        """Map SDK ``KnowledgeBaseReference`` objects onto :class:`DocumentMatch`."""
        matches: list[DocumentMatch] = []

        # response.response holds a synthesized-answer string when the KB is in
        # ANSWER_SYNTHESIS mode; response.references holds the raw document chunks.
        references = getattr(response, "references", None) or []
        for ref in references[:top_k]:
            source_data: dict[str, Any] = ref.source_data or {}

            # Extract content from whichever field the portal ingestion used.
            snippet = ""
            for field in _CONTENT_FIELDS:
                val = source_data.get(field)
                if val and isinstance(val, str) and val.strip():
                    snippet = val.strip()
                    break

            # Extract title.
            title = ""
            for field in _TITLE_FIELDS:
                val = source_data.get(field)
                if val and isinstance(val, str) and val.strip():
                    title = val.strip()
                    break
            if not title:
                title = str(ref.id or "document")

            matches.append(
                DocumentMatch(
                    document_id=str(ref.id or ""),
                    title=title,
                    snippet=snippet or "(no content)",
                    score=float(ref.reranker_score or 0.0),
                )
            )

        # If the KB returned a synthesized answer and no references, surface it.
        if not matches:
            answer = getattr(response, "response", None)
            if answer and isinstance(answer, str) and answer.strip():
                matches.append(
                    DocumentMatch(
                        document_id="foundry-iq-synthesis",
                        title="Foundry IQ synthesized answer",
                        snippet=answer.strip(),
                        score=1.0,
                    )
                )
        return matches

    # ------------------------------------------------------------------ #
    # Structured data — delegate to local provider
    # ------------------------------------------------------------------ #

    async def get_company_profile(self) -> CompanyProfile:
        return await self._local.get_company_profile()

    async def get_employees(self) -> list[Employee]:
        return await self._local.get_employees()

    async def get_teams(self) -> list[Team]:
        return await self._local.get_teams()

    async def get_departments(self) -> list[Department]:
        return await self._local.get_departments()

    async def get_systems(self) -> list[SystemAsset]:
        return await self._local.get_systems()

    async def get_projects(self) -> list[Project]:
        return await self._local.get_projects()

    async def get_documents(self) -> list[Document]:
        return await self._local.get_documents()

    # ------------------------------------------------------------------ #
    # Health check
    # ------------------------------------------------------------------ #

    async def health_check(self) -> ProviderHealth:
        """Verify live connectivity to the knowledge base."""
        if not self.is_configured:
            return ProviderHealth(
                provider=self.name,
                status="unavailable",
                detail=(
                    "Foundry IQ not configured. Set SEARCH_ENDPOINT, FOUNDRY_INDEX, "
                    "and SEARCH_API_KEY (or AZURE_OPENAI_USE_AAD=true)."
                ),
            )
        try:
            results = await self._foundry_search("health check", top_k=1)
            local_health = await self._local.health_check()
            detail = (
                f"Live — knowledge base '{self._knowledge_base_name}' reachable "
                f"({len(results)} result(s)). "
                f"Local fallback: {local_health.detail}"
            )
            return ProviderHealth(provider=self.name, status="ok", detail=detail)
        except Exception as exc:  # noqa: BLE001
            return ProviderHealth(
                provider=self.name,
                status="degraded",
                detail=f"Foundry IQ search error: {exc}. Local fallback active.",
            )

    async def close(self) -> None:
        """Close the underlying async client (call on app shutdown)."""
        if self._client is not None:
            try:
                await self._client.close()
            except Exception:  # noqa: BLE001
                pass
            self._client = None
