# CompanyVerse Backend

Transform enterprise knowledge into a **personalized, playable onboarding game**.
A frontend sends one new joiner's persona to `POST /game/bundle`; the backend
returns a complete, frontend-renderable `GameBundle` — a personalized world, a
player character, NPCs with dialogue, a tailored questline, and knowledge
challenges — all **AI-generated and grounded in the company's knowledge**.

The structure of every bundle (world graph, NPC roster, ids, bindings, rewards)
is deterministic and always coherent; only the *language* (narration, quests,
dialogue, challenges) comes from the AI layer. This means a real model can never
make the product fail to produce a renderable game.

> **Hackathon context.** Agents League — Track 1 (Creative Apps). Chosen
> Microsoft IQ: **Foundry IQ** (knowledge retrieval + grounding); secondary:
> **Work IQ** (org graph). See [Microsoft IQ integration status](#microsoft-iq-integration-status)
> for an honest, current breakdown of what is live vs. scaffolded.

---

## Microsoft IQ integration status

| Capability | Component | Status |
|---|---|---|
| **Generative AI** — writes quests, challenges, dialogue, narration, backstory, grounded chat | [`AzureOpenAIContentGenerator`](app/ai/azure_openai.py) → a model deployed in **Azure AI Foundry** | ✅ **Live.** Verified end-to-end with `gpt-5-mini` (`LLM_PROVIDER=foundry`). Grounded in the synthetic corpus; offline engine is the per-call fallback. |
| **Foundry IQ** — semantic knowledge retrieval / grounding index | [`FoundryIQKnowledgeProvider`](app/providers/foundry.py) | ✅ **Live** (needs `SEARCH_API_KEY`). Hybrid design: `search()` uses `KnowledgeBaseRetrievalClient` against `knowledgebase312` on `onlyakarsh-8641-srch`; structured data methods delegate to `LocalKnowledgeProvider`. Falls back to local keyword search on any error. |
| **Work IQ** — organizational graph (reporting lines, ownership, expertise) | [`WorkIQOrgGraphConnector`](app/providers/workiq.py) | ⚠️ **Scaffold (by design).** Per the brief, the connector stays in the code but disconnected; `LocalOrgGraphConnector` derives the graph from synthetic data for the demo. |

**What this means for judging.** Content generation genuinely runs on an Azure AI
Foundry model and is grounded in real (synthetic) enterprise documents. The one
open gap against "use Foundry IQ meaningfully" is the dedicated **Foundry IQ
retrieval index** — its provider is architecturally seamed but not yet wired to a
live knowledge source. Flipping it on is a `PROVIDER=foundry` config change plus
filling in `FoundryIQKnowledgeProvider` (no downstream changes).

---

## The three swap seams

Source selection happens in exactly one place per seam ([`app/dependencies.py`](app/dependencies.py)),
so flipping any backend is a configuration change — never a code change:

| Env var | Seam | Options | Default |
|---|---|---|---|
| `PROVIDER` | Knowledge source | `local` (synthetic) · `foundry` (Foundry IQ) | `local` |
| `LLM_PROVIDER` | Generative AI | `local` (offline engine) · `azure_openai` · `foundry` | `local` |
| `ORG_GRAPH` | Work IQ org graph | `local` (synthetic) · `workiq` | `local` |

The default configuration (`local` everywhere) runs fully offline with **no
credentials**, producing deterministic content — ideal for tests and CI. The
demo configuration sets `LLM_PROVIDER=foundry` to author content with a real
model while still grounding on the synthetic dataset.

---

## Architecture

```
                       POST /game/bundle  (UserPersona)
                                 │
                                 ▼
                  ┌────────────────────────────┐
                  │        BundleEngine         │  async, LangGraph-swappable pipeline
                  └──────────────┬─────────────┘
        ┌────────────────────────┼───────────────────────────┐
        ▼                        ▼                             ▼
  ensure World +           PersonaResolver               GameContentGenerator
  NPC roster          (home region, quest seeds,         (narration · backstory ·
  (deterministic)      grounded knowledge docs)           quests · challenges ·
        │              [knowledge retrieval seam]          dialogue)  [LLM seam]
        │                        │                             │
        └────────────────────────┴──────────────┬─────────────┘
                                                 ▼
                              ┌────────────────────────────┐
                              │  assemble + fingerprint     │
                              │  GameBundle → persist        │  generated/bundles/<user>.json
                              └──────────────┬─────────────┘
                                             ▼
                          response: personalized, renderable GameBundle


   Knowledge providers (PROVIDER)              Content generators (LLM_PROVIDER)
   ┌──────────────────────────┐                ┌──────────────────────────────┐
   │ LocalKnowledgeProvider   │ default        │ LocalContentGenerator        │ default
   │ FoundryIQ… (scaffold)    │                │ AzureOpenAIContentGenerator  │ → Foundry/AOAI
   └────────────┬─────────────┘                └───────────────┬──────────────┘
                ▼ KnowledgeService (cached snapshot + search)   │ falls back to local on any error
```

**Design principles**

- **Provider boundary.** Every knowledge provider returns the same typed models
  ([`app/models/knowledge.py`](app/models/knowledge.py)); every content generator
  returns the same *drafts* ([`app/ai/contracts.py`](app/ai/contracts.py)).
  Generators and routes never touch raw data or a specific SDK.
- **Deterministic skeleton, generated language.** Ids, bindings, rewards,
  positions, and a `content_hash` are deterministic. Only prose is model-authored.
- **Never-fail generation.** The real model path catches *any* error (missing
  SDK, bad creds, malformed JSON, timeout) per call and falls back to the offline
  engine, logging `LLM <step> failed (...); using offline fallback.` A bundle
  always completes.
- **Async + DI.** Endpoints are async; independent LLM calls fan out with
  `asyncio.gather`; file IO runs in worker threads. Dependencies are `lru_cache`
  singletons, overridable in tests via `app.dependency_overrides`.

---

## File tree

```
backend/
├── app/
│   ├── main.py                     # FastAPI app + lifespan (auto-generates world + NPCs)
│   ├── config.py                   # Settings (env/.env), the three swap seams
│   ├── dependencies.py             # DI wiring; build_provider / build_llm_client / build_org_graph
│   ├── api/routes/
│   │   ├── health.py               # GET /health
│   │   ├── world.py                # GET /world, POST /generate/world
│   │   ├── npcs.py                 # GET /npcs, GET /npcs/{id}, POST /generate/npcs
│   │   └── game.py                 # POST /game/bundle, GET /game/bundle/{key}, GET /game/bundles, POST /game/chat
│   ├── ai/                         # ── The AI layer ──
│   │   ├── llm.py                  # GameContentGenerator (ABC, the AI seam)
│   │   ├── contracts.py            # GenerationContext + draft types
│   │   ├── prompts.py              # system/user prompt builders (grounded)
│   │   ├── local_llm.py            # LocalContentGenerator (offline, deterministic)
│   │   └── azure_openai.py         # AzureOpenAIContentGenerator (real Foundry/AOAI model)
│   ├── providers/
│   │   ├── base.py                 # KnowledgeProvider (ABC)
│   │   ├── local.py                # LocalKnowledgeProvider (synthetic + keyword search)
│   │   ├── foundry.py              # FoundryIQKnowledgeProvider (scaffold)
│   │   └── workiq.py               # OrgGraphConnector + Local/WorkIQ implementations
│   ├── generators/                 # world, npc, quest, dialogue generators + theming/layout
│   ├── services/
│   │   ├── knowledge_service.py    # unified cached access + search
│   │   ├── persona_resolver.py     # persona → grounded plan (home region, quest seeds)
│   │   ├── bundle_engine.py        # persona → GameBundle pipeline
│   │   ├── bundle_persistence.py   # per-user bundle storage
│   │   ├── conversation_service.py # runtime grounded NPC chat
│   │   └── {world,npc}_persistence.py
│   ├── models/                     # persona, world, npc, quest, challenge, dialogue, bundle, knowledge
│   └── utils/                      # data_loader, text helpers
├── scripts/
│   ├── generate_world.py           # CLI: regenerate world.json
│   ├── generate_npcs.py            # CLI: regenerate npcs.json
│   └── check_llm.py                # diagnostic: verify the live model connection
├── generated/
│   ├── world.json · npcs.json      # deterministic artifacts (committed-ignored)
│   └── bundles/<user_key>.json     # per-user game bundles
├── requirements.txt
├── run.py                          # python run.py -> uvicorn
├── .env                            # local config + credentials (gitignored)
└── README.md
```

---

## Setup

Requires **Python 3.10+**.

```powershell
# from backend/
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
# source .venv/bin/activate           # macOS/Linux
pip install -r requirements.txt
```

- The synthetic dataset is read from `../org_data` by default (`DATA_DIR`).
- The default config runs **fully offline** — no `.env` or credentials needed.
- To use the real Foundry/Azure OpenAI model, set the AI variables in `.env`
  (see [Configuration](#configuration)). `openai` (and `azure-identity` for the
  keyless AAD path) are required only then.

---

## Run

```powershell
# Run the API (auto-generates world.json + npcs.json on first startup)
python run.py
# or: uvicorn app.main:app --reload

# (Optional) regenerate deterministic artifacts without the server
python -m scripts.generate_world
python -m scripts.generate_npcs

# Verify the live model connection (when LLM_PROVIDER != local)
python -m scripts.check_llm
```

Server: <http://127.0.0.1:8000> · Interactive docs: <http://127.0.0.1:8000/docs>

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service + active provider/LLM status |
| `POST` | `/game/bundle` | **Headline.** Body: `UserPersona` → full personalized `GameBundle` (persisted) |
| `GET`  | `/game/bundle/{user_key}` | Fetch a previously generated bundle |
| `GET`  | `/game/bundles` | List generated bundle keys |
| `POST` | `/game/chat` | Free-form, knowledge-grounded chat with a bundle's NPC |
| `POST` | `/generate/world` | (Re)generate the deterministic world and persist |
| `GET`  | `/world` | Return the generated world |
| `POST` | `/generate/npcs` | (Re)generate NPCs from knowledge + world |
| `GET`  | `/npcs` · `/npcs/{npc_id}` | List NPCs (optional `?region_id=`) / get one |

### The one call a frontend needs

```powershell
$persona = @{
  name  = "Alex Johnson"
  email = "alex.johnson@nexova.io"
  role  = "Junior Software Engineer"
  bio   = "Fresh CS grad excited to learn how a real platform team ships software."
  goals = @("Understand deployments", "Learn the on-call basics")
} | ConvertTo-Json

Invoke-RestMethod -Method Post http://127.0.0.1:8000/game/bundle `
  -ContentType "application/json" -Body $persona
```

The response (`GameBundle`) contains everything the Phaser/Next frontend renders:

| Field | Purpose |
|---|---|
| `metadata` | ids, counts, `provider`, `llm_provider`, `home_region_id`, `grounding_doc_ids`, `content_hash` |
| `narrative_intro` | opening cutscene narration (AI) |
| `player` | `PlayerCharacter` — spawn, stats, AI backstory, avatar color |
| `world` | personalized world (spawn moved to the player's home region) |
| `npcs` + `dialogues` | the player's NPC cast and their persona/quest-aware dialogue |
| `quests` | the tailored onboarding questline (default 5; `MAX_QUESTS_PER_BUNDLE`) |
| `challenges` | one knowledge-grounded challenge per quest |

---

## Configuration

All settings come from environment variables / `.env` (gitignored). Defaults run
fully offline.

### Core

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROVIDER` | `local` | Knowledge source: `local` or `foundry`. **Switching requires no code changes.** |
| `LLM_PROVIDER` | `local` | Generative AI: `local`, `azure_openai`, or `foundry`. |
| `ORG_GRAPH` | `local` | Work IQ org graph: `local` or `workiq`. |
| `DATA_DIR` | `../org_data` | Synthetic dataset location |
| `GENERATED_DIR` | `generated` | Where artifacts + per-user bundles are written |
| `WORLD_SEED` | `1337` | Recorded in metadata for reproducibility |
| `AUTO_GENERATE_ON_STARTUP` | `true` | Generate `world.json`/`npcs.json` on boot if missing |
| `MAX_QUESTS_PER_BUNDLE` | `5` | Quests in a new joiner's questline |

### Generative AI — Azure AI Foundry / Azure OpenAI (`LLM_PROVIDER=foundry`/`azure_openai`)

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Model endpoint. Both the GA **v1** surface (`…/openai/v1`) and the **classic** Azure surface (`https://<resource>.openai.azure.com`) are auto-detected. |
| `AZURE_OPENAI_DEPLOYMENT` | Exact deployment name (e.g. `gpt-5-mini`). |
| `AZURE_OPENAI_API_VERSION` | API version (classic surface). |
| `AZURE_OPENAI_API_KEY` / `FOUNDRY_API_KEY` | API key. `FOUNDRY_API_KEY` is used as a fallback (`effective_llm_api_key`). |
| `AZURE_OPENAI_USE_AAD` | `true` for keyless Microsoft Entra auth via `DefaultAzureCredential` (needs `azure-identity`). |

> **Note on `temperature`.** The client intentionally never sends `temperature`.
> Reasoning models (the GPT-5 family) accept only the default and reject any
> override with HTTP 400, so we always let the model use its default.

### Foundry IQ knowledge provider — live (`PROVIDER=foundry`)

| Variable | Purpose |
|----------|---------|
| `SEARCH_ENDPOINT` | `https://<your-search-service>.search.windows.net` — the Azure AI Search service connected to the Foundry project. |
| `FOUNDRY_INDEX` | Knowledge base name (e.g. `knowledgebase312`). |
| `SEARCH_API_KEY` | Azure AI Search **query key** — Azure portal → Search service → **Keys** → Query keys. Falls back to `FOUNDRY_API_KEY`. |
| `PROJECT_ENDPOINT` | Azure AI Foundry project endpoint (reserved for future agent integration). |
| `FOUNDRY_API_KEY` | Foundry/OpenAI service key; also used as `SEARCH_API_KEY` fallback. |

> **Hybrid design.** `search()` calls the Foundry IQ knowledge base for semantic retrieval; all structured-data methods (`get_employees`, `get_teams`, etc.) are served by `LocalKnowledgeProvider` reading `org_data/` CSV files. Falls back to local keyword search on any search error so bundles always complete.
>
> **Diagnostic.** Run `.venv\Scripts\python.exe -m scripts.check_foundry_iq` to verify live connectivity.

---

## Generative AI: how grounding works

1. `PersonaResolver` turns a `UserPersona` into a grounded plan — home region,
   quest seeds, and the relevant knowledge documents (the **retrieval seam**;
   today `LocalKnowledgeProvider` keyword search, tomorrow Foundry IQ).
2. [`app/ai/prompts.py`](app/ai/prompts.py) builds system/user prompts that embed
   those grounded documents and the persona.
3. The active `GameContentGenerator` returns JSON drafts; deterministic generators
   validate them and own all ids/bindings/rewards.
4. For free-form chat, `ConversationService` additionally searches the **whole**
   knowledge base per message and blends it with the persona's quest docs, so an
   NPC can answer beyond the player's own questline.

Grounding is real: in verification, a generated challenge correctly referenced
the synthetic on-call experts and the onboarding runbook's 5-business-day
pre-start checklist.

---

## Hackathon checklist (backend)

- ✅ Product generates a full, renderable bundle end-to-end from a persona.
- ✅ Real **Azure AI Foundry** model authors all content, grounded in synthetic data.
- ✅ Synthetic dataset only (`org_data/`); no confidential data; no hardcoded quests.
- ✅ Provider/LLM/org-graph seams in place — one config flip to go to prod.
- ✅ **Foundry IQ knowledge base** wired (`KnowledgeBaseRetrievalClient` → `knowledgebase312`; `PROVIDER=foundry`). Needs `SEARCH_API_KEY`.
- ⏭️ Next: Phaser/Next frontend that calls `POST /game/bundle` and renders the world.
