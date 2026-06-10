"""CompanyVerse backend application entry point.

Run with::

    uvicorn app.main:app --reload      # from the backend/ directory
    # or
    python run.py

On startup the world is auto-generated (if missing) so ``GET /world`` works
immediately after boot. Auto-generation failures are logged and never block
startup, which keeps the Foundry scaffold (and a missing dataset) non-fatal.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import api_router
from app.config import get_settings
from app.dependencies import get_world_generator, get_world_repository

logger = logging.getLogger("companyverse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.generated_dir.mkdir(parents=True, exist_ok=True)

    if settings.auto_generate_on_startup:
        repository = get_world_repository()
        if not repository.exists():
            try:
                world = await get_world_generator().generate()
                await repository.save(world)
                logger.info(
                    "Auto-generated world: %s regions, %s landmarks (provider=%s)",
                    world.metadata.region_count,
                    world.metadata.landmark_count,
                    world.metadata.provider,
                )
            except Exception as exc:  # noqa: BLE001 - non-fatal at startup
                logger.warning("World auto-generation skipped: %s", exc)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "CompanyVerse — transform enterprise knowledge into a playable "
            "world. Milestone 1: world generation from the synthetic company "
            "dataset."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.get("/", tags=["system"], summary="API index")
    async def root() -> dict:
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "provider": settings.provider,
            "docs": "/docs",
            "endpoints": [
                "GET /health",
                "POST /generate/world",
                "GET /world",
            ],
        }

    return app


app = create_app()
