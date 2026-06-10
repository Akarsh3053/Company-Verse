"""System + health endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.config import Settings, get_settings
from app.dependencies import get_knowledge_service, get_world_repository
from app.services.knowledge_service import KnowledgeService
from app.services.world_persistence import WorldRepository

router = APIRouter(tags=["system"])


@router.get("/health", summary="Service health and active provider status")
async def health(
    settings: Settings = Depends(get_settings),
    service: KnowledgeService = Depends(get_knowledge_service),
    repository: WorldRepository = Depends(get_world_repository),
) -> dict:
    provider_health = await service.health()
    return {
        "status": "ok",
        "app": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "provider": provider_health.model_dump(),
        "world_generated": repository.exists(),
    }
