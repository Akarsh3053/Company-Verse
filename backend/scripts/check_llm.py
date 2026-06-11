"""CLI: check the configured generative-AI provider end to end.

Run from the backend/ directory::

    python -m scripts.check_llm

Reports the active LLM provider, performs a real chat-completion round-trip when
a model is configured, and confirms the offline fallback. Use this after
deploying a model in Azure AI Foundry to verify ``LLM_PROVIDER=foundry`` works.
"""

from __future__ import annotations

import asyncio

from app.ai.azure_openai import AzureOpenAIContentGenerator
from app.config import get_settings
from app.dependencies import get_content_generator


async def _run() -> None:
    settings = get_settings()
    generator = get_content_generator()

    print(f"LLM_PROVIDER : {settings.llm_provider}")
    health = await generator.health()
    print(f"Health       : {health.status} — {health.detail}")

    if not isinstance(generator, AzureOpenAIContentGenerator):
        print(
            "\nUsing the offline deterministic engine. Set LLM_PROVIDER=foundry "
            "(or azure_openai) with a deployed model to enable real AI."
        )
        return

    print(f"Endpoint     : {settings.azure_openai_endpoint}")
    print(f"Deployment   : {settings.azure_openai_deployment}")
    print("\nAttempting a live chat-completion round-trip…")
    try:
        data = await generator._complete_json(  # noqa: SLF001 - diagnostic use
            "Reply with strict JSON.", 'Return JSON {"ok": true}.'
        )
        print("LIVE MODEL OK:", data)
        print("\nReal AI generation is active. Generate a bundle to see it in action.")
    except Exception as exc:  # noqa: BLE001
        text = str(exc).replace("\n", " ")
        print(f"LIVE MODEL FAILED: {type(exc).__name__}: {text[:300]}")
        if "500" in text:
            print(
                "\nHint: a 500 from this endpoint usually means NO chat model is "
                "deployed. In Azure AI Foundry → Models → Deployments, deploy a "
                "base model (e.g. gpt-4o-mini) and set AZURE_OPENAI_DEPLOYMENT to "
                "its exact deployment name."
            )
        print(
            "\nThe app still works: bundle generation falls back to the offline "
            "engine per call, so nothing breaks while you finish setup."
        )


def main() -> None:
    asyncio.run(_run())


if __name__ == "__main__":
    main()
