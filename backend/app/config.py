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

    # --- Data + output locations ---
    # Default to the synthetic dataset checked into the repository root.
    data_dir: Path = Field(default=REPO_DIR / "org_data")
    generated_dir: Path = Field(default=BACKEND_DIR / "generated")

    # --- World generation ---
    world_name: str = "CompanyVerse"
    world_seed: int = 1337
    auto_generate_on_startup: bool = True

    # --- CORS (frontend dev server) ---
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"]
    )

    # --- Foundry IQ (Milestone 5 — unused by Milestone 1) ---
    foundry_endpoint: str | None = None
    foundry_api_key: str | None = None
    foundry_project: str | None = None
    foundry_index: str | None = None

    @field_validator("data_dir", "generated_dir", mode="after")
    @classmethod
    def _resolve_paths(cls, value: Path) -> Path:
        """Resolve relative paths against the backend directory."""
        return value if value.is_absolute() else (BACKEND_DIR / value).resolve()

    @property
    def world_file(self) -> Path:
        """Absolute path to the generated ``world.json`` artifact."""
        return self.generated_dir / "world.json"


@lru_cache
def get_settings() -> Settings:
    """Return a cached :class:`Settings` instance (process singleton)."""
    return Settings()
