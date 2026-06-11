"""Diagnostic: verify Foundry IQ knowledge base connectivity.

Run from the backend/ directory::

    $env:PYTHONIOENCODING = 'utf-8'
    .venv\\Scripts\\python.exe -m scripts.check_foundry_iq

Exit 0 = live search working.
Exit 1 = not configured or error (details printed).
"""
from __future__ import annotations

import asyncio
import sys

from app.config import get_settings
from app.dependencies import build_provider


async def main() -> int:
    s = get_settings()
    print(f"PROVIDER          : {s.provider}")
    print(f"SEARCH_ENDPOINT   : {s.search_endpoint or '(not set)'}")
    print(f"FOUNDRY_INDEX     : {s.foundry_index or '(not set)'}")
    key_source = (
        "SEARCH_API_KEY (explicit)"
        if s.search_api_key
        else ("DefaultAzureCredential / Entra ID" if s.azure_openai_use_aad else "DefaultAzureCredential (RBAC fallback)")
    )
    print(f"Auth              : {key_source}")
    print()

    provider = build_provider(s)
    health = await provider.health_check()
    print(f"Health status : {health.status}")
    print(f"Detail        : {health.detail}")

    if health.status == "unavailable":
        print(
            "\n⚠  Not configured. Add to .env:\n"
            "   PROVIDER=foundry\n"
            "   SEARCH_ENDPOINT=https://<your-search>.search.windows.net\n"
            "   FOUNDRY_INDEX=<knowledge-base-name>\n"
            "   SEARCH_API_KEY=<query-key from Azure portal>\n"
        )
        return 1

    if health.status == "ok":
        print("\n✅  FOUNDRY IQ OK — live knowledge base search is active.")
        # Run a grounded query against the org_data content
        print("\nRunning a grounded search: 'deployment process'")
        results = await provider.search("deployment process", top_k=3)
        if results:
            for i, r in enumerate(results, 1):
                print(f"  [{i}] {r.title} (score={r.score:.3f})")
                print(f"      {r.snippet[:120]}…")
        else:
            print("  (no results — check that the knowledge base is populated)")
        rc = 0
    else:
        # degraded
        print("\n⚠  Foundry IQ degraded — local fallback active.")
        rc = 1

    # Close the underlying async client to avoid unclosed-session warnings.
    if hasattr(provider, "_client") and provider._client is not None:
        try:
            await provider._client.close()
        except Exception:
            pass
    return rc


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
