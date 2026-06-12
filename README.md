# CompanyVerse

> **Microsoft Agents League · Hackathon Track 1 — Creative Apps**

Turn a company's real knowledge into a **personalised, playable onboarding game**. A new joiner enters their name, email, role and a few goals; CompanyVerse generates an entire top-down 2D world from the organisation's documents — teams become explorable regions, experts become NPC guides, systems become landmarks, and processes become quests. Everything is AI-generated and grounded in real enterprise knowledge. Nothing is hardcoded.

---

## What it looks like

```
New joiner fills in profile
        │
        ▼  POST /game/bundle  (~60-90 s with gpt-5-mini)
┌───────────────────────────────────────────────────────────┐
│  Backend  ·  FastAPI + Python                             │
│                                                           │
│  PersonaResolver  →  knowledge docs + home region         │
│  WorldGenerator   →  regions / landmarks / connections    │
│  NPCGenerator     →  character cast bound to real staff   │
│  QuestGenerator   →  questline from real SOPs / docs      │
│  ChallengeGen     →  quiz / scenario / ordering tests     │
│  AzureOpenAI      →  AI prose (narration, dialogue, etc.) │
│                                                           │
│  → persists  generated/bundles/<user_key>.json            │
└───────────────────────────────────────────────────────────┘
        │  GameBundle JSON
        ▼
┌───────────────────────────────────────────────────────────┐
│  Frontend  ·  Next.js 14 + Phaser 3                       │
│                                                           │
│  Intro cutscene  (AI-authored narrative, typewriter)      │
│  Overworld  ·  top-down tile map  ·  WASD movement        │
│    Walk to NPC → dialogue tree → accept quest             │
│    Explore regions & landmarks → complete objectives      │
│    Solve challenges → earn XP / stats / badges            │
│    Ask NPC anything → grounded real-time chat             │
│  Quest Tracker  ·  always tells you where to go next      │
│  Progress persisted to localStorage per user              │
└───────────────────────────────────────────────────────────┘
```

---

## Repository layout

```
CompanyVerse/
├── backend/          FastAPI + Python — AI pipeline + knowledge layer
├── frontend/         Next.js 14 + Phaser 3 — the playable game
├── org_data/         Synthetic company dataset (Nexova Technologies)
│   ├── company.md · employees.csv · org_chart.md
│   ├── projects.csv · systems.csv
│   └── docs/         20 enterprise docs (SOPs, ADRs, runbooks, policies…)
└── README.md         ← you are here
```

---

## Quick start (both servers, two terminals)

### Terminal 1 — Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
# source .venv/bin/activate           # macOS / Linux
pip install -r requirements.txt
cp .env.example .env                  # edit .env — see Configuration below
python run.py                         # http://127.0.0.1:8000  ·  Swagger /docs
```

### Terminal 2 — Frontend

```powershell
cd frontend
npm install
npm run dev                           # http://localhost:3000
```

Open **http://localhost:3000**, click **New Game**, fill in a profile and wait ~60-90 s for generation (or use **Continue** to resume a saved game instantly). The demo persona **Alex Johnson · Junior Software Engineer** exercises all 9 biomes, all NPC roles, all quest types, and all 4 challenge types.

> **CORS** is preconfigured on the backend for `http://localhost:3000` and `http://127.0.0.1:3000`. Always run the frontend on port **3000**.

---

## Microsoft IQ integration

| Capability | Component | Status |
|---|---|---|
| **Generative AI** — all game content authored by the model | `AzureOpenAIContentGenerator` → `gpt-5-mini` on Azure AI Foundry (`LLM_PROVIDER=foundry`) | ✅ Live |
| **Foundry IQ** — semantic retrieval over the enterprise knowledge base | `FoundryIQKnowledgeProvider` → `KnowledgeBaseRetrievalClient` (`PROVIDER=foundry`) | ✅ Wired |
| **Work IQ** — org graph, reporting lines, expertise | `WorkIQOrgGraphConnector` scaffold; synthetic data active for demo | ⚠️ Scaffold |

### The three swap seams

Switching providers is a single env-var change — no code changes ever:

| Variable | Default | Options | Meaning |
|---|---|---|---|
| `PROVIDER` | `local` | `local` · `foundry` | Knowledge source (CSV search vs. Foundry IQ semantic KB) |
| `LLM_PROVIDER` | `foundry` | `local` · `foundry` · `azure_openai` | AI generation (offline vs. real model) |
| `ORG_GRAPH` | `local` | `local` · `workiq` | Org graph (synthetic CSV vs. Work IQ) |

**Demo config:** `PROVIDER=local` + `LLM_PROVIDER=foundry` — real GPT-5 mini authors all content, knowledge grounded in CSV files. Flip `PROVIDER=foundry` to activate live semantic search.

---

## How it works end-to-end

```
1. Profile form  →  POST /game/bundle
                        │
          ┌─────────────▼──────────────┐
          │  PersonaResolver            │  maps role → home region + quest seeds
          │  [PROVIDER seam]            │  (local keyword search or Foundry IQ)
          └─────────────┬──────────────┘
                        │  grounded docs
          ┌─────────────▼──────────────┐
          │  BundleEngine pipeline      │
          │   WorldGenerator   (deterministic skeleton — IDs, positions, graph)
          │   NPCGenerator     (deterministic — bound to real employees)
          │   AI content gen   (async gather — narrative, dialogue, quests,
          │   [LLM_PROVIDER]    challenges — all grounded in knowledge docs)
          └─────────────┬──────────────┘
                        │  GameBundle JSON  (~80 s with gpt-5-mini)
                        │  persisted → backend/generated/bundles/<key>.json
                        ▼
2. Frontend receives bundle
   │
   ├─ Zod validates at boundary before anything renders
   ├─ Zustand gameStore seeded (quest status, objectives, XP, stats)
   └─ Phaser BootScene:
        load real art assets (109 files in one parallel batch)
        compose landmark textures (RenderTexture, real materials + vector accents)
        build character walk animations (Last Guardian sprites)
        procedural fallback for any missing texture key
        → start OverworldScene

3. OverworldScene
   │
   ├─ Builds world from bundle data (regions, nexus plaza, paths, NPCs, landmarks)
   ├─ Hard boundary — player cannot leave the union of region circles + 460 px nexus
   ├─ Proximity detection → press E → dialogue trees / landmark cards
   ├─ Quest progress tracked client-side (talk / explore / challenge / read objectives)
   ├─ XP + stat gains + badge grants + quest unlocks on completion
   └─ Progress auto-saved to localStorage keyed by user_key

4. POST /game/chat  (any time, any NPC)
   Backend searches entire knowledge base + persona quest docs
   → grounded free-form reply from the model
```

---

## Backend configuration

Copy `backend/.env.example` to `backend/.env`.

### Core

| Variable | Default | Description |
|---|---|---|
| `PROVIDER` | `local` | Knowledge source: `local` or `foundry` |
| `LLM_PROVIDER` | `local` | Generative AI: `local`, `foundry`, or `azure_openai` |
| `ORG_GRAPH` | `local` | Org graph: `local` or `workiq` |
| `AUTO_GENERATE_ON_STARTUP` | `true` | Generate world + NPCs on boot if missing |
| `MAX_QUESTS_PER_BUNDLE` | `5` | Quests per questline |

### Azure AI Foundry / OpenAI (`LLM_PROVIDER=foundry`)

| Variable | Description |
|---|---|
| `AZURE_OPENAI_ENDPOINT` | Model endpoint (add `/openai/v1` suffix for v1/OpenAI-compatible surface) |
| `AZURE_OPENAI_DEPLOYMENT` | Deployment name, e.g. `gpt-5-mini` |
| `AZURE_OPENAI_API_KEY` | API key (falls back to `FOUNDRY_API_KEY`) |
| `AZURE_OPENAI_USE_AAD` | `true` for keyless Entra ID auth |

> `temperature` is never sent — GPT-5 reasoning models reject any explicit value.

### Foundry IQ knowledge base (`PROVIDER=foundry`)

| Variable | Description |
|---|---|
| `SEARCH_ENDPOINT` | `https://<your-search-service>.search.windows.net` |
| `FOUNDRY_INDEX` | Knowledge base index name |
| `SEARCH_API_KEY` | Azure AI Search query key |
| `FOUNDRY_API_KEY` | Foundry resource key (fallback for both API and search keys) |

**Windows SSL note:** if you see `SSLCertVerificationError`, uncomment the `SSL_CERT_FILE` line in `.env`.

---

## Backend API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Service + provider/LLM status |
| `POST` | `/game/bundle` | **Main endpoint.** `UserPersona` → full `GameBundle` (60-90 s, persisted) |
| `GET` | `/game/bundle/{user_key}` | Resume a saved bundle (instant) |
| `GET` | `/game/bundles` | List all saved bundle keys |
| `POST` | `/game/chat` | Free-form grounded NPC chat |
| `GET` | `/world` | The generated world |
| `GET` | `/npcs` · `/npcs/{id}` | NPC list / single NPC |
| `POST` | `/generate/world` | Regenerate and persist world |
| `POST` | `/generate/npcs` | Regenerate and persist NPCs |

Swagger UI: **http://127.0.0.1:8000/docs**

---

## Frontend configuration

`frontend/.env.local` (committed with safe default):

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

### Frontend scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server (HMR) on port 3000 — **stop before running build** |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run typecheck` | `tsc --noEmit` strict check |
| `pwsh scripts/convert_chars.ps1` | Regenerate character PNGs from source GIFs (Windows) |

### Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD / arrow keys | On-screen d-pad |
| Interact / talk | `E` | Action button |
| Quest Log | `Q` | QUESTS button |
| Hero / stats | `C` | HERO button |
| Close overlay | `Esc` | ✕ / tap outside |

---

## Diagnostics

```powershell
# from backend/

# Verify live Azure AI Foundry model
$env:PYTHONIOENCODING='utf-8'
.\.venv\Scripts\python.exe -m scripts.check_llm

# Verify Foundry IQ knowledge base (set PROVIDER=foundry + SEARCH_API_KEY first)
.\.venv\Scripts\python.exe -m scripts.check_foundry_iq
```

---

## Synthetic dataset

The demo uses **Nexova Technologies** — a fictional B2B SaaS company — so no confidential data is ever needed. The dataset lives in `org_data/` and includes:

- 50 employees, 8 teams, 5 production systems, 4 active projects
- 20 enterprise documents: deployment SOP, incident runbook, onboarding runbook, code review guidelines, security review policy, access control matrix, product roadmap 2026, and more

All world content (region names, quest narratives, dialogue, challenges) is generated fresh from this dataset for every new persona. The three swap seams mean the same codebase runs against real corporate data without any changes.

---

## Assets & licences

| Pack | Used for | Licence |
|---|---|---|
| Cam Tatz "Top Down Asset Pack 1" | Biome terrain, props, nexus plaza, landmark materials | CC0 |
| Philipp Lenssen "700+ RPG Sprites" | Player + 9 NPC role walk cycles | CC-BY 3.0 |
| Procedural fallback (`src/game/textures.ts`) | Any missing texture key | — |

Full attribution: [`frontend/public/assets/CREDITS.md`](frontend/public/assets/CREDITS.md).  
Fonts: *Press Start 2P* and *VT323* (SIL OFL) via Google Fonts.

---

## Sub-project READMEs

- [`backend/README.md`](backend/README.md) — backend architecture, provider seams, full config reference, grounding design
- [`frontend/README.md`](frontend/README.md) — frontend architecture, Phaser/React split, project layout, asset pipeline, known behaviour notes
