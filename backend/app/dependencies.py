"""FastAPI dependency-injection wiring.

Each provider/service/repository is a process singleton (via ``lru_cache``) so
that in-memory caches (the knowledge snapshot) are shared across requests. The
factories are plain functions, which means tests can override them with
``app.dependency_overrides``.

Source selection happens in exactly one place per seam so flipping a backend
requires no other code changes:

* ``PROVIDER``     → :func:`build_provider`     (knowledge: local / foundry)
* ``LLM_PROVIDER`` → :func:`build_llm_client`   (AI: local / azure_openai / foundry)
* ``ORG_GRAPH``    → :func:`build_org_graph`    (Work IQ: local / workiq)
"""

from __future__ import annotations

from functools import lru_cache

from app.ai.azure_openai import AzureOpenAIContentGenerator
from app.ai.llm import GameContentGenerator
from app.ai.local_llm import LocalContentGenerator
from app.config import Settings, get_settings
from app.generators.npc_generator import NPCGenerator
from app.generators.world_generator import WorldGenerator
from app.providers.base import KnowledgeProvider
from app.providers.foundry import FoundryIQKnowledgeProvider
from app.providers.local import LocalKnowledgeProvider
from app.providers.workiq import (
    LocalOrgGraphConnector,
    OrgGraphConnector,
    WorkIQOrgGraphConnector,
)
from app.services.bundle_engine import BundleEngine
from app.services.bundle_persistence import BundleRepository
from app.services.conversation_service import ConversationService
from app.services.knowledge_service import KnowledgeService
from app.services.npc_persistence import NPCRepository
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


def build_llm_client(settings: Settings) -> GameContentGenerator:
    """Construct the generative content generator selected by configuration.

    The single seam for AI: ``LLM_PROVIDER=local`` (offline, default) vs.
    ``azure_openai`` / ``foundry`` (a real chat model). Real models always carry
    the offline engine as a transparent fallback, so enabling them can never make
    bundle generation fail.
    """
    if settings.llm_provider in ("azure_openai", "foundry"):
        return AzureOpenAIContentGenerator(
            name=settings.llm_provider,
            endpoint=settings.azure_openai_endpoint,
            api_key=settings.effective_llm_api_key,
            deployment=settings.azure_openai_deployment,
            api_version=settings.azure_openai_api_version,
            use_aad=settings.azure_openai_use_aad,
            fallback=LocalContentGenerator(),
        )
    return LocalContentGenerator()


@lru_cache
def get_knowledge_provider() -> KnowledgeProvider:
    return build_provider(get_settings())


@lru_cache
def get_knowledge_service() -> KnowledgeService:
    return KnowledgeService(get_knowledge_provider())


@lru_cache
def get_content_generator() -> GameContentGenerator:
    return build_llm_client(get_settings())


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


@lru_cache
def get_npc_repository() -> NPCRepository:
    return NPCRepository(get_settings().generated_dir)


def get_npc_generator() -> NPCGenerator:
    settings = get_settings()
    return NPCGenerator(
        get_knowledge_service(),
        get_world_repository(),
        world_name=settings.world_name,
        seed=settings.world_seed,
    )


@lru_cache
def get_bundle_repository() -> BundleRepository:
    return BundleRepository(get_settings().generated_dir)


def get_bundle_engine() -> BundleEngine:
    settings = get_settings()
    return BundleEngine(
        knowledge=get_knowledge_service(),
        content=get_content_generator(),
        world_generator=get_world_generator(),
        world_repository=get_world_repository(),
        npc_generator=get_npc_generator(),
        npc_repository=get_npc_repository(),
        bundle_repository=get_bundle_repository(),
        max_quests=settings.max_quests_per_bundle,
    )


def get_conversation_service() -> ConversationService:
    settings = get_settings()
    return ConversationService(
        knowledge=get_knowledge_service(),
        content=get_content_generator(),
        world_repository=get_world_repository(),
        npc_repository=get_npc_repository(),
        bundle_repository=get_bundle_repository(),
        max_quests=settings.max_quests_per_bundle,
    )


def build_org_graph(settings: Settings) -> OrgGraphConnector:
    """Construct the org-graph connector (Work IQ seam; not yet used by generators)."""
    if settings.org_graph == "workiq":
        return WorkIQOrgGraphConnector(
            endpoint=settings.foundry_endpoint,
            api_key=settings.foundry_api_key,
        )
    return LocalOrgGraphConnector(get_knowledge_service().get_snapshot)


@lru_cache
def get_org_graph_connector() -> OrgGraphConnector:
    return build_org_graph(get_settings())
