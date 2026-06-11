"""Application configuration.

Settings are loaded from environment variables / a local ``.env`` file.

Switching the active knowledge provider is intentionally a single setting
(``PROVIDER``) so that Milestone 5 (Foundry IQ) can be enabled without any
code changes, per the implementation plan.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py -> app/ -> backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime configuration for the CompanyVerse backend."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- Application ---
    app_name: str = "CompanyVerse Backend"
    app_version: str = "1.0.0"
    environment: Literal["development", "staging", "production"] = "development"
    debug: bool = True

    # --- Knowledge provider selection ---
    # Set PROVIDER=foundry to switch to Foundry IQ (Milestone 5). No other
    # code change is required to flip providers.
    provider: Literal["local", "foundry"] = "local"

    # --- Generative AI provider selection ---
    # local        -> offline deterministic content engine (default; no creds)
    # azure_openai -> Azure OpenAI chat model
    # foundry      -> Azure AI Foundry chat model (Azure OpenAI compatible)
    # Switching this requires no code changes (resolved in build_llm_client).
    llm_provider: Literal["local", "azure_openai", "foundry"] = "local"

    # --- Organizational graph (Work IQ seam) ---
    # local  -> derive reporting/expertise from the synthetic dataset (default)
    # workiq -> Microsoft Work IQ (scaffold; connect a tenant to enable)
    org_graph: Literal["local", "workiq"] = "local"

    # --- Data + output locations ---
    # Default to the synthetic dataset checked into the repository root.
    data_dir: Path = Field(default=REPO_DIR / "org_data")
    generated_dir: Path = Field(default=BACKEND_DIR / "generated")

    # --- World generation ---
    world_name: str = "CompanyVerse"
    world_seed: int = 1337
    auto_generate_on_startup: bool = True

    # --- Game bundle generation ---
    #: Number of quests in a new joiner's onboarding questline.
    max_quests_per_bundle: int = 5

    # --- CORS (frontend dev server) ---
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # --- Foundry IQ (knowledge provider) ---
    # Legacy fields kept for backward compat; the live implementation uses
    # search_endpoint + foundry_index + search_api_key (see below).
    foundry_endpoint: str | None = None
    foundry_api_key: str | None = None
    foundry_project: str | None = None
    #: Azure AI Foundry *project* endpoint (PROJECT_ENDPOINT).
    project_endpoint: str | None = None

    # --- Foundry IQ: Azure AI Search connection ---
    # SEARCH_ENDPOINT: the *.search.windows.net endpoint of the Azure AI Search
    # service connected to the Foundry project.
    search_endpoint: str | None = None
    # SEARCH_API_KEY: the Azure AI Search *query key* (Azure portal →
    # Search service → Keys → Query keys).  Falls back to FOUNDRY_API_KEY.
    search_api_key: str | None = None
    # FOUNDRY_INDEX: the knowledge base name (e.g. "knowledgebase312").
    foundry_index: str | None = None

    @property
    def effective_search_api_key(self) -> str | None:
        """Search query key; falls back to FOUNDRY_API_KEY."""
        return self.search_api_key or self.foundry_api_key

    # --- Azure OpenAI / Foundry (generative AI — used when LLM_PROVIDER != local) ---
    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-10-21"
    # When true (and no api key), authenticate with Microsoft Entra via
    # DefaultAzureCredential (e.g. `az login` / managed identity) — the keyless
    # path Foundry/iq-series recommends.
    azure_openai_use_aad: bool = False

    @property
    def effective_llm_api_key(self) -> str | None:
        """Key for the generative model.

        Falls back to ``FOUNDRY_API_KEY`` when ``AZURE_OPENAI_API_KEY`` is unset,
        since a Foundry/Azure OpenAI resource typically shares one key.
        """
        return self.azure_openai_api_key or self.foundry_api_key

    @field_validator("data_dir", "generated_dir", mode="after")
    @classmethod
    def _resolve_paths(cls, value: Path) -> Path:
        """Resolve relative paths against the backend directory."""
        return value if value.is_absolute() else (BACKEND_DIR / value).resolve()

    @property
    def world_file(self) -> Path:
        """Absolute path to the generated ``world.json`` artifact."""
        return self.generated_dir / "world.json"

    @property
    def npcs_file(self) -> Path:
        """Absolute path to the generated ``npcs.json`` artifact."""
        return self.generated_dir / "npcs.json"

    @property
    def bundles_dir(self) -> Path:
        """Directory holding per-user generated game bundles."""
        return self.generated_dir / "bundles"


@lru_cache
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance (process singleton)."""
    return Settings()
