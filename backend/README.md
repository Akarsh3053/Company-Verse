# CompanyVerse Backend

Transform enterprise knowledge into a **personalized, playable onboarding game**.

A frontend sends one new joiner's persona to `POST /game/bundle`; the backend returns a complete, frontend-renderable `GameBundle` — a personalized world, player character, NPCs with dialogue, a tailored questline, and knowledge challenges. All language (narration, quests, dialogue, challenges) is **AI-generated and grounded in the company's knowledge**. Structure (world graph, NPC roster, ids, bindings, rewards) is deterministic so a bundle is always coherent and renderable regardless of which AI path produced the prose.

> **Hackathon:** Agents League — Track 1 (Creative Apps).  
> **Microsoft IQ:** Foundry IQ (knowledge retrieval + AI generation) · Work IQ (org graph scaffold).

---

## Microsoft IQ integration

| Capability | Implementation | Status |
|---|---|---|
| **Generative AI** — quests, challenges, dialogue, narration, backstory, grounded chat | `AzureOpenAIContentGenerator` → `gpt-5-mini` deployed in **Azure AI Foundry** (`LLM_PROVIDER=foundry`) | ✅ Live |
| **Foundry IQ retrieval** — semantic search over the enterprise knowledge base | `FoundryIQKnowledgeProvider` → `KnowledgeBaseRetrievalClient` against `knowledgebase312` on `onlyakarsh-8641-srch` (`PROVIDER=foundry`) | ✅ Wired (set `PROVIDER=foundry` + `SEARCH_API_KEY`) |
| **Work IQ org graph** — reporting lines, ownership, expertise | `WorkIQOrgGraphConnector` scaffold · `LocalOrgGraphConnector` active for demo | ⚠️ Scaffold (by design — synthetic data for demo) |

---

## The three swap seams

Source selection happens in exactly one place (`app/dependencies.py`). Flipping a backend is a config change — never a code change:

| Env var | Controls | Options | Demo default |
|---|---|---|---|
| `PROVIDER` | Knowledge source | `local` · `foundry` | `local` |
| `LLM_PROVIDER` | Generative AI | `local` · `foundry` · `azure_openai` | `foundry` |
| `ORG_GRAPH` | Work IQ graph | `local` · `workiq` | `local` |

**Current demo config:** `PROVIDER=local` (org_data CSVs) + `LLM_PROVIDER=foundry` (real `gpt-5-mini`). Flip to `PROVIDER=foundry` to activate Foundry IQ semantic retrieval.

---

## Architecture

```
                       POST /game/bundle  ← UserPersona
                                │
                                ▼
                 ┌──────────────────────────┐
                 │       BundleEngine        │  async pipeline
                 └─────────────┬────────────┘
         ┌───────────────────  │  ──────────────────────┐
         ▼                     ▼                          ▼
   Ensure World +        PersonaResolver            GameContentGenerator
   NPC roster         (home region, quest seeds,    (narration · backstory ·
   (deterministic)     grounded knowledge docs)      quests · challenges ·
         │             [PROVIDER seam]                dialogue)  [LLM_PROVIDER seam]
         └─────────────────────┴─────────────────────────┘
                                │
                 ┌──────────────▼────────────┐
                 │  assemble GameBundle       │
                 │  fingerprint + persist     │  generated/bundles/<user>.json
                 └──────────────┬────────────┘
                                ▼
                    Full GameBundle response


  Knowledge providers (PROVIDER)           Content generators (LLM_PROVIDER)
  ┌────────────────────────────┐           ┌──────────────────────────────────┐
  │ LocalKnowledgeProvider     │ ← default │ LocalContentGenerator            │ ← default
  │   CSV + keyword search     │           │   deterministic offline engine    │
  ├────────────────────────────┤           ├──────────────────────────────────┤
  │ FoundryIQKnowledgeProvider │           │ AzureOpenAIContentGenerator       │
  │   KB semantic retrieval    │           │   Azure AI Foundry / AOAI model   │
  │   + local structured data  │           │   falls back to local on any error│
  └────────────────────────────┘           └──────────────────────────────────┘
```

**Design principles**

- **Provider boundary.** Every provider returns the same typed models; every generator returns the same draft types. Nothing downstream touches raw data or a specific SDK.
- **Deterministic skeleton, generated language.** Ids, bindings, positions, rewards, and `content_hash` are deterministic. Only prose is model-authored.
- **Never-fail generation.** Each LLM call independently catches any error and falls back to the offline engine (`LLM <step> failed; using offline fallback`). A bundle always completes.
- **Async + DI.** Endpoints are async; independent LLM calls fan out with `asyncio.gather`; file I/O runs in worker threads. Dependencies are `lru_cache` singletons, overridable via `app.dependency_overrides`.

---

## File tree

```
backend/
├── app/
│   ├── main.py                      # FastAPI app + lifespan (auto-generates world + NPCs)
│   ├── config.py                    # Settings (env/.env) — the three swap seams
│   ├── dependencies.py              # DI wiring: build_provider / build_llm_client / build_org_graph
│   ├── api/routes/
│   │   ├── health.py                # GET /health
│   │   ├── world.py                 # GET /world, POST /generate/world
│   │   ├── npcs.py                  # GET /npcs, GET /npcs/{id}, POST /generate/npcs
│   │   └── game.py                  # POST /game/bundle  GET /game/bundle/{key}
│   │                                #  GET /game/bundles  POST /game/chat
│   ├── ai/
│   │   ├── llm.py                   # GameContentGenerator ABC (the LLM seam)
│   │   ├── contracts.py             # GenerationContext + draft types
│   │   ├── prompts.py               # Grounded system/user prompt builders
│   │   ├── local_llm.py             # LocalContentGenerator (offline, deterministic)
│   │   └── azure_openai.py          # AzureOpenAIContentGenerator (Foundry / AOAI)
│   ├── providers/
│   │   ├── base.py                  # KnowledgeProvider ABC
│   │   ├── local.py                 # LocalKnowledgeProvider (CSV + keyword search)
│   │   ├── foundry.py               # FoundryIQKnowledgeProvider (KB retrieval + local struct)
│   │   └── workiq.py                # OrgGraphConnector + Local/WorkIQ implementations
│   ├── generators/                  # world, npc, quest, challenge, dialogue + theming/layout
│   ├── services/
│   │   ├── knowledge_service.py     # Unified cached access + search
│   │   ├── persona_resolver.py      # Persona → grounded plan (home region, quest seeds)
│   │   ├── bundle_engine.py         # Persona → GameBundle pipeline
│   │   ├── bundle_persistence.py    # Per-user bundle JSON storage
│   │   ├── conversation_service.py  # Runtime grounded NPC chat
│   │   └── {world,npc}_persistence.py
│   ├── models/                      # persona, world, npc, quest, challenge, bundle, knowledge
│   └── utils/                       # data_loader, text helpers
├── scripts/
│   ├── generate_world.py            # CLI: regenerate world.json
│   ├── generate_npcs.py             # CLI: regenerate npcs.json
│   ├── check_llm.py                 # Diagnostic: verify live model connection
│   └── check_foundry_iq.py          # Diagnostic: verify Foundry IQ KB connection
├── generated/
│   ├── world.json · npcs.json       # Deterministic artifacts
│   └── bundles/<user_key>.json      # Per-user game bundles (gitignored)
├── requirements.txt
├── run.py                           # python run.py → uvicorn
├── .env                             # Local config + secrets (gitignored)
├── .env.example                     # Template — safe to commit
└── README.md
```

---

## Setup

Requires **Python 3.10+**.

```powershell
# from backend/
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
# source .venv/bin/activate           # macOS/Linux
pip install -r requirements.txt
cp .env.example .env                  # then edit .env with your values
```

The default config (`PROVIDER=local`, `LLM_PROVIDER=local`) runs **fully offline** — no credentials needed.

---

## Run

```powershell
python run.py
# or: uvicorn app.main:app --reload

# Regenerate deterministic artifacts without the server
python -m scripts.generate_world
python -m scripts.generate_npcs

# Diagnostics
python -m scripts.check_llm          # verify live model connection
python -m scripts.check_foundry_iq   # verify Foundry IQ KB connection
```

Server: <http://127.0.0.1:8000> · Docs: <http://127.0.0.1:8000/docs>

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service + provider/LLM status |
| `POST` | `/game/bundle` | **Main endpoint.** `UserPersona` → full `GameBundle` (persisted) |
| `GET`  | `/game/bundle/{user_key}` | Fetch a previously generated bundle |
| `GET`  | `/game/bundles` | List all generated bundle keys |
| `POST` | `/game/chat` | Free-form grounded NPC chat |
| `POST` | `/generate/world` | (Re)generate world and persist |
| `GET`  | `/world` | Return the generated world |
| `POST` | `/generate/npcs` | (Re)generate NPCs and persist |
| `GET`  | `/npcs` · `/npcs/{id}` | List NPCs / get one |

### The one call a frontend needs

```powershell
$body = @{
  name  = "Alex Johnson"
  email = "alex.johnson@nexova.io"
  role  = "Junior Software Engineer"
  bio   = "Fresh CS grad excited to learn how a real platform team ships software."
  goals = @("Understand deployments", "Learn the on-call basics")
} | ConvertTo-Json

Invoke-RestMethod -Method Post http://127.0.0.1:8000/game/bundle `
  -ContentType "application/json" -Body $body
```

The `GameBundle` response contains everything the Phaser/Next frontend needs:

| Field | Contents |
|---|---|
| `metadata` | ids, counts, `provider`, `llm_provider`, `home_region_id`, `grounding_doc_ids`, `content_hash` |
| `narrative_intro` | Opening cutscene narration (AI-authored) |
| `player` | `PlayerCharacter` — spawn, stats, backstory (AI), avatar colour |
| `world` | Personalized world with spawn moved to the player's home region |
| `npcs` + `dialogues` | NPC cast + persona/quest-aware dialogue trees |
| `quests` | Tailored onboarding questline (default 5) |
| `challenges` | One grounded knowledge challenge per quest |

---

## Configuration reference

Copy `.env.example` to `.env` and set what you need. Everything has a safe default.

### Core switches

| Variable | Default | Description |
|---|---|---|
| `PROVIDER` | `local` | Knowledge source: `local` or `foundry` |
| `LLM_PROVIDER` | `local` | Generative AI: `local`, `foundry`, or `azure_openai` |
| `ORG_GRAPH` | `local` | Org graph: `local` or `workiq` |
| `DATA_DIR` | `../org_data` | Synthetic dataset directory |
| `GENERATED_DIR` | `generated` | Artifacts + bundle output directory |
| `AUTO_GENERATE_ON_STARTUP` | `true` | Generate world/NPCs on boot if missing |
| `MAX_QUESTS_PER_BUNDLE` | `5` | Quests per new joiner questline |

### Generative AI (`LLM_PROVIDER=foundry` / `azure_openai`)

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Model endpoint. `/openai/v1` suffix → v1 (OpenAI-compatible) surface; without it → classic Azure surface. |
| `AZURE_OPENAI_DEPLOYMENT` | Exact deployment name (e.g. `gpt-5-mini`). |
| `AZURE_OPENAI_API_VERSION` | API version string (classic surface only). |
| `AZURE_OPENAI_API_KEY` | API key. Falls back to `FOUNDRY_API_KEY`. |
| `AZURE_OPENAI_USE_AAD` | `true` for keyless Entra ID auth via `DefaultAzureCredential`. |

> **`temperature` is never sent.** GPT-5 reasoning models only accept the default value; sending any other value returns HTTP 400. The client always lets the model use its default.

### Foundry IQ knowledge base (`PROVIDER=foundry`)

| Variable | Description |
|---|---|
| `SEARCH_ENDPOINT` | `https://<your-search-service>.search.windows.net` |
| `FOUNDRY_INDEX` | Knowledge base name (e.g. `knowledgebase312`) |
| `SEARCH_API_KEY` | Azure AI Search query key (Azure portal → Search service → Keys). Falls back to `FOUNDRY_API_KEY`. Leave empty for RBAC-only services + `AZURE_OPENAI_USE_AAD=true`. |
| `FOUNDRY_API_KEY` | Foundry / OpenAI resource key. Also used as fallback for `SEARCH_API_KEY`. |
| `PROJECT_ENDPOINT` | Azure AI Foundry project endpoint (reserved for future agent integration). |

**Hybrid design:** `search()` uses the Foundry IQ KB for semantic retrieval; all structured-data methods (`get_employees`, `get_teams`, etc.) read `org_data/` CSVs via `LocalKnowledgeProvider`. Falls back to local keyword search on any error.

**SSL note (Windows):** If you see `SSLCertVerificationError` with `PROVIDER=foundry`, uncomment the `SSL_CERT_FILE` line in `.env` — the provider automatically sets `REQUESTS_CA_BUNDLE` to `certifi`'s bundle on startup.

---

## How grounding works

1. **PersonaResolver** maps a `UserPersona` to a grounded plan — home region, quest seeds, and relevant knowledge documents (the `PROVIDER` seam; local keyword search or Foundry IQ semantic retrieval).
2. **`app/ai/prompts.py`** embeds those documents + the persona into system/user prompts.
3. The active `GameContentGenerator` returns JSON drafts; deterministic generators validate them and own all ids, bindings, and rewards.
4. **`ConversationService`** additionally searches the entire knowledge base per free-form chat message and blends results with the persona's quest docs — so an NPC can answer beyond the player's questline.

---

## Diagnostics

```powershell
# Verify live model
$env:PYTHONIOENCODING='utf-8'
.\.venv\Scripts\python.exe -m scripts.check_llm

# Verify Foundry IQ knowledge base (set PROVIDER=foundry + SEARCH_API_KEY first)
.\.venv\Scripts\python.exe -m scripts.check_foundry_iq
```

---

## Hackathon checklist

- ✅ Full end-to-end bundle generation from a persona (verified, ~80s with `gpt-5-mini`)
- ✅ Real **Azure AI Foundry** model (`gpt-5-mini`) authors all content, grounded in synthetic data
- ✅ **Foundry IQ** knowledge base wired (`KnowledgeBaseRetrievalClient` · `LowReasoningEffort`)
- ✅ Synthetic dataset only (`org_data/`) — no confidential data, no hardcoded quests
- ✅ All three swap seams implemented — one config line to go to production data
- ✅ Work IQ org graph scaffold in codebase, synthetic data for demo
- ⏭️ Next: Phaser/Next.js frontend
