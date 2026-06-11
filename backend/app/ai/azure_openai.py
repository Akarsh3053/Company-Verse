"""Azure OpenAI / Foundry IQ content generator (the real-model path).

Selected via ``LLM_PROVIDER=azure_openai`` (or ``foundry``). It builds prompts
(:mod:`app.ai.prompts`), calls a chat model in JSON mode, and validates every
response into the same draft types the offline engine returns. On *any* failure
(missing SDK, bad credentials, malformed JSON, timeout) it transparently falls
back to :class:`~app.ai.local_llm.LocalContentGenerator`, so enabling a real
model can never make the product fail to generate a bundle.

The ``openai`` package is imported lazily, so the dependency is only needed when
this provider is actually used.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.ai import prompts
from app.ai.contracts import (
    ChallengeDraft,
    DialogueDraft,
    GenerationContext,
    QuestDraft,
    QuestSeed,
)
from app.ai.llm import GameContentGenerator
from app.ai.local_llm import LocalContentGenerator
from app.models.knowledge import ProviderHealth
from app.models.quest import Quest

logger = logging.getLogger("companyverse")


class AzureOpenAIContentGenerator(GameContentGenerator):
    """A real chat-model generator with a deterministic offline fallback."""

    def __init__(
        self,
        *,
        name: str = "azure_openai",
        endpoint: str | None = None,
        api_key: str | None = None,
        deployment: str | None = None,
        api_version: str = "2024-10-21",
        use_aad: bool = False,
        fallback: LocalContentGenerator | None = None,
    ) -> None:
        self.name = name
        self._endpoint = endpoint
        self._api_key = api_key
        self._deployment = deployment
        self._api_version = api_version
        self._use_aad = use_aad
        self._fallback = fallback or LocalContentGenerator()
        self._client: Any | None = None
        self._is_v1 = False

    @property
    def is_configured(self) -> bool:
        if not (self._endpoint and self._deployment):
            return False
        return bool(self._api_key or self._use_aad)

    def _ensure_client(self) -> Any:
        """Lazily construct the async chat client.

        Two endpoint shapes are supported transparently:

        * **v1 / OpenAI-compatible** — endpoint contains ``/openai/v1`` (the GA
          "v1" Azure surface). Uses :class:`openai.AsyncOpenAI` with ``base_url``.
        * **classic Azure** — ``https://<resource>.openai.azure.com``. Uses
          :class:`openai.AsyncAzureOpenAI` with an ``api_version``.

        Auth is an API key or Microsoft Entra (AAD) via ``DefaultAzureCredential``.
        """
        if self._client is not None:
            return self._client
        if not self.is_configured:
            raise RuntimeError(
                "LLM provider not configured. Set AZURE_OPENAI_ENDPOINT, "
                "AZURE_OPENAI_DEPLOYMENT and either an API key (AZURE_OPENAI_API_KEY "
                "/ FOUNDRY_API_KEY) or AZURE_OPENAI_USE_AAD=true."
            )
        try:
            from openai import AsyncAzureOpenAI, AsyncOpenAI
        except ImportError as exc:  # pragma: no cover - depends on optional dep
            raise RuntimeError(
                "The 'openai' package is required for LLM_PROVIDER="
                f"{self.name}. Install it: pip install openai."
            ) from exc

        endpoint = (self._endpoint or "").rstrip("/")
        is_v1 = "/openai/v1" in endpoint

        if is_v1:
            # v1 surface is OpenAI-compatible; use the base AsyncOpenAI client.
            api_key = self._api_key
            if not api_key and self._use_aad:
                api_key = self._aad_token()
            self._client = AsyncOpenAI(base_url=endpoint, api_key=api_key)
            self._is_v1 = True
            return self._client

        self._is_v1 = False
        if self._api_key:
            self._client = AsyncAzureOpenAI(
                azure_endpoint=endpoint,
                api_key=self._api_key,
                api_version=self._api_version,
            )
        else:
            from azure.identity import get_bearer_token_provider

            self._client = AsyncAzureOpenAI(
                azure_endpoint=endpoint,
                azure_ad_token_provider=get_bearer_token_provider(
                    self._aad_credential(),
                    "https://cognitiveservices.azure.com/.default",
                ),
                api_version=self._api_version,
            )
        return self._client

    @staticmethod
    def _aad_credential() -> Any:
        try:
            from azure.identity import DefaultAzureCredential
        except ImportError as exc:  # pragma: no cover - optional dep
            raise RuntimeError(
                "AZURE_OPENAI_USE_AAD=true requires 'azure-identity': "
                "pip install azure-identity."
            ) from exc
        return DefaultAzureCredential()

    def _aad_token(self) -> str:
        token = self._aad_credential().get_token(
            "https://cognitiveservices.azure.com/.default"
        )
        return token.token

    async def _complete_json(self, system: str, user: str) -> dict[str, Any]:
        client = self._ensure_client()
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]
        # Note: ``temperature`` is intentionally not sent. Reasoning models
        # (e.g. the GPT-5 family) only accept the default value and reject any
        # override with HTTP 400, so we always let the model use its default.
        response = await client.chat.completions.create(
            model=self._deployment,
            messages=messages,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        return json.loads(content)

    # ------------------------------------------------------------------ #
    # Generation methods (each falls back to the offline engine on error)
    # ------------------------------------------------------------------ #
    async def narrative_intro(self, ctx: GenerationContext) -> str:
        try:
            system, user = prompts.narrative_intro(ctx)
            data = await self._complete_json(system, user)
            text = str(data.get("text", "")).strip()
            if not text:
                raise ValueError("empty narrative_intro")
            return text
        except Exception as exc:  # noqa: BLE001 - fall back, never fail
            self._warn("narrative_intro", exc)
            return await self._fallback.narrative_intro(ctx)

    async def player_backstory(self, ctx: GenerationContext) -> str:
        try:
            system, user = prompts.player_backstory(ctx)
            data = await self._complete_json(system, user)
            text = str(data.get("text", "")).strip()
            if not text:
                raise ValueError("empty player_backstory")
            return text
        except Exception as exc:  # noqa: BLE001
            self._warn("player_backstory", exc)
            return await self._fallback.player_backstory(ctx)

    async def quest(self, ctx: GenerationContext, seed: QuestSeed) -> QuestDraft:
        try:
            system, user = prompts.quest(ctx, seed)
            data = await self._complete_json(system, user)
            draft = QuestDraft.model_validate(data)
            if not draft.title or not draft.objectives:
                raise ValueError("incomplete quest draft")
            return draft
        except Exception as exc:  # noqa: BLE001
            self._warn("quest", exc)
            return await self._fallback.quest(ctx, seed)

    async def challenge(
        self, ctx: GenerationContext, seed: QuestSeed, quest: QuestDraft
    ) -> ChallengeDraft:
        try:
            system, user = prompts.challenge(ctx, seed)
            data = await self._complete_json(system, user)
            draft = ChallengeDraft.model_validate(data)
            if not any(option.is_correct for option in draft.options):
                raise ValueError("challenge has no correct option")
            return draft
        except Exception as exc:  # noqa: BLE001
            self._warn("challenge", exc)
            return await self._fallback.challenge(ctx, seed, quest)

    async def npc_dialogue(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        given_quests: list[Quest],
    ) -> DialogueDraft:
        try:
            system, user = prompts.npc_dialogue(ctx, npc_name, npc_persona, given_quests)
            data = await self._complete_json(system, user)
            draft = DialogueDraft.model_validate(data)
            if not draft.greeting:
                raise ValueError("empty dialogue greeting")
            return draft
        except Exception as exc:  # noqa: BLE001
            self._warn("npc_dialogue", exc)
            return await self._fallback.npc_dialogue(
                ctx, npc_id, npc_name, npc_persona, given_quests
            )

    async def chat_reply(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        grounding: list[str],
        history: list[dict[str, str]],
        message: str,
    ) -> str:
        try:
            system, user = prompts.chat_reply(
                ctx, npc_name, npc_persona, grounding, history, message
            )
            data = await self._complete_json(system, user)
            text = str(data.get("text", "")).strip()
            if not text:
                raise ValueError("empty chat reply")
            return text
        except Exception as exc:  # noqa: BLE001
            self._warn("chat_reply", exc)
            return await self._fallback.chat_reply(
                ctx, npc_id, npc_name, npc_persona, grounding, history, message
            )

    async def health(self) -> ProviderHealth:
        if not self.is_configured:
            return ProviderHealth(
                provider=self.name,
                status="unavailable",
                detail=(
                    "LLM credentials not set (need endpoint + deployment + key or "
                    "AAD); falling back to offline engine."
                ),
            )
        try:
            from openai import AsyncAzureOpenAI  # noqa: F401
        except ImportError:
            return ProviderHealth(
                provider=self.name,
                status="degraded",
                detail="Configured, but 'openai' package not installed.",
            )
        auth = "api_key" if self._api_key else "aad"
        return ProviderHealth(
            provider=self.name,
            status="ok",
            detail=f"Configured (deployment={self._deployment}, auth={auth}).",
        )

    def _warn(self, step: str, exc: Exception) -> None:
        logger.warning("LLM %s failed (%s); using offline fallback.", step, exc)
