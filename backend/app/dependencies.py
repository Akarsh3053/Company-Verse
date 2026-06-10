"""FastAPI dependency-injection wiring.

Each provider/service/repository is a process singleton (via ``lru_cache``) so
that in-memory caches (the knowledge snapshot) are shared across requests. The
factories are plain functions, which means tests can override them with
``app.dependency_overrides``.

Provider selection happens in exactly one place — :func:`build_provider` — so
flipping ``PROVIDER=foundry`` requires no other code changes.
"""

from __future__ import annotations

from functools import lru_cache

from app.config import Settings, get_settings
from app.generators.world_generator import WorldGenerator
from app.providers.base import KnowledgeProvider
from app.providers.foundry import FoundryIQKnowledgeProvider
from app.providers.local import LocalKnowledgeProvider
from app.services.knowledge_service import KnowledgeService
from app.services.world_persistence import WorldRepository


def build_provider(settings: Settings) -> KnowledgeProvider:
    """Construct the knowledge provider selected by configuration."""
    if settings.provider == "foundry":
        return FoundryIQKnowledgeProvider(
            endpoint=settings.foundry_endpoint,
            api_key=settings.foundry_api_key,
            project=settings.foundry_project,
            index=settings.foundry_index,
        )
    return LocalKnowledgeProvider(settings.data_dir)


@lru_cache
def get_knowledge_provider() -> KnowledgeProvider:
    return build_provider(get_settings())


@lru_cache
def get_knowledge_service() -> KnowledgeService:
    return KnowledgeService(get_knowledge_provider())


@lru_cache
def get_world_repository() -> WorldRepository:
    return WorldRepository(get_settings().generated_dir)


def get_world_generator() -> WorldGenerator:
    settings = get_settings()
    return WorldGenerator(
        get_knowledge_service(),
        world_name=settings.world_name,
        seed=settings.world_seed,
    )
