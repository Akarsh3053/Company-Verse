"""Aggregated API router."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import health, npcs, world

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(world.router)
api_router.include_router(npcs.router)
