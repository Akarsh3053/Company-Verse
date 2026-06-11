"""Game-bundle + runtime-chat endpoints (the persona-driven core).

* ``POST /game/bundle`` — the headline endpoint. Body is a
  :class:`~app.models.persona.UserPersona`; response is a fully-rendered
  :class:`~app.models.bundle.GameBundle` (personalized world, player, NPCs +
  dialogue, quests, challenges). The bundle is persisted per user.
* ``GET /game/bundle/{user_key}`` — fetch a previously generated bundle.
* ``GET /game/bundles`` — list generated bundle keys.
* ``POST /game/chat`` — free-form, knowledge-grounded chat with a bundle's NPC.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.dependencies import (
    get_bundle_engine,
    get_bundle_repository,
    get_conversation_service,
)
from app.models.bundle import GameBundle
from app.models.persona import UserPersona
from app.services.bundle_engine import BundleEngine
from app.services.bundle_persistence import BundleRepository
from app.services.conversation_service import ConversationError, ConversationService

router = APIRouter(tags=["game"])


@router.post(
    "/game/bundle",
    response_model=GameBundle,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a personalized onboarding game bundle for a new joiner",
)
async def generate_bundle(
    persona: UserPersona,
    engine: BundleEngine = Depends(get_bundle_engine),
) -> GameBundle:
    """Generate (and persist) the full playable bundle for ``persona``.

    This is the single call a frontend makes to start a new joiner's game.
    """
    try:
        return await engine.build(persona)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except NotImplementedError as exc:  # e.g. PROVIDER=foundry scaffold
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED, detail=str(exc)
        ) from exc


@router.get(
    "/game/bundles",
    response_model=list[str],
    summary="List generated game-bundle keys",
)
async def list_bundles(
    repository: BundleRepository = Depends(get_bundle_repository),
) -> list[str]:
    return await repository.list_keys()


@router.get(
    "/game/bundle/{user_key}",
    response_model=GameBundle,
    summary="Get a previously generated game bundle",
)
async def get_bundle(
    user_key: str,
    repository: BundleRepository = Depends(get_bundle_repository),
) -> GameBundle:
    bundle = await repository.load(user_key)
    if bundle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No bundle for '{user_key}'. POST /game/bundle to create one.",
        )
    return bundle


class ChatMessage(BaseModel):
    """One prior turn of conversation (for multi-turn context)."""

    role: str = Field(description="'player' or 'npc'.")
    content: str


class ChatRequest(BaseModel):
    """A free-form message from the player to one of their bundle's NPCs."""

    user_key: str
    npc_id: str
    message: str = Field(min_length=1)
    history: list[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    npc_id: str
    npc_name: str
    reply: str


@router.post(
    "/game/chat",
    response_model=ChatResponse,
    summary="Chat with a bundle's NPC, grounded in enterprise knowledge",
)
async def chat(
    request: ChatRequest,
    service: ConversationService = Depends(get_conversation_service),
) -> ChatResponse:
    try:
        result = await service.reply(
            user_key=request.user_key,
            npc_id=request.npc_id,
            message=request.message,
            history=[turn.model_dump() for turn in request.history],
        )
    except ConversationError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)
        ) from exc
    return ChatResponse(**result)
