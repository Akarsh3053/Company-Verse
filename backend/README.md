# CompanyVerse Backend — Milestone 1

Transform enterprise knowledge into a playable world. **Milestone 1** builds the
foundation: load the synthetic company dataset, generate a deterministic
`world.json`, and serve it over a FastAPI API.

> Scope: world generation only. No NPCs, no quests, no runtime chat — those are
> Milestones 2–4. The Foundry IQ provider is scaffolded (Milestone 5) but not
> wired to a live tenant.

---

## What Milestone 1 delivers

| Deliverable | Implementation |
|-------------|----------------|
| FastAPI application | [app/main.py](app/main.py) |
| Provider abstraction | [app/providers/base.py](app/providers/base.py) |
| Local provider | [app/providers/local.py](app/providers/local.py) |
| Foundry IQ scaffold | [app/providers/foundry.py](app/providers/foundry.py) |
| Knowledge service | [app/services/knowledge_service.py](app/services/knowledge_service.py) |
| World generator | [app/generators/world_generator.py](app/generators/world_generator.py) |
| World schemas | [app/models/world.py](app/models/world.py) |
| World persistence | [app/services/world_persistence.py](app/services/world_persistence.py) |
| World endpoints | [app/api/routes/world.py](app/api/routes/world.py) |
| Output | `generated/world.json` |

---

## File tree

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app + lifespan (auto-generates world)
│   ├── config.py                   # Settings (env / .env), provider selection
│   ├── dependencies.py             # DI wiring (singletons via lru_cache)
│   ├── api/
│   │   └── routes/
│   │       ├── __init__.py         # aggregated APIRouter
│   │       ├── health.py           # GET /health
│   │       └── world.py            # GET /world, POST /generate/world
│   ├── models/
│   │   ├── knowledge.py            # Employee, Team, SystemAsset, Project, ...
│   │   └── world.py                # World, Region, Landmark, Connection, ...
│   ├── providers/
│   │   ├── base.py                 # KnowledgeProvider (ABC)
│   │   ├── local.py                # LocalKnowledgeProvider (synthetic dataset)
│   │   └── foundry.py              # FoundryIQKnowledgeProvider (scaffold)
│   ├── services/
│   │   ├── knowledge_service.py    # KnowledgeService (unified access + cache)
│   │   └── world_persistence.py    # WorldRepository (load/save world.json)
│   ├── generators/
│   │   ├── world_generator.py      # WorldGenerator (deterministic build)
│   │   ├── theming.py              # team→region & system→landmark themes
│   │   └── layout.py               # deterministic 2D positioning
│   └── utils/
│       ├── data_loader.py          # CSV/markdown → domain models
│       └── text.py                 # slugify, helpers
├── scripts/
│   └── generate_world.py           # CLI: regenerate world.json without the server
├── generated/
│   └── world.json                  # generated artifact
├── requirements.txt
├── run.py                          # python run.py  ->  uvicorn
├── .env.example
└── README.md
```

---

## Architecture

```
            Synthetic dataset (org_data/)            Foundry IQ (Milestone 5)
                      │                                       │
                      ▼                                       ▼
        ┌──────────────────────────┐            ┌──────────────────────────┐
        │  LocalKnowledgeProvider  │            │ FoundryIQKnowledgeProvider│
        └────────────┬─────────────┘            └────────────┬─────────────┘
                     └───────────────┬───────────────────────┘
                                     ▼
                       ┌──────────────────────────┐
                       │     KnowledgeService     │  unified, cached access
                       │   (KnowledgeSnapshot)    │
                       └────────────┬─────────────┘
                                    ▼
                       ┌──────────────────────────┐
                       │      WorldGenerator      │  deterministic, pure
                       └────────────┬─────────────┘
                                    ▼
                       ┌──────────────────────────┐
                       │  WorldRepository → JSON  │  generated/world.json
                       └────────────┬─────────────┘
                                    ▼
                       FastAPI:  GET /world · POST /generate/world
```

**Design principles**

- **Provider boundary.** Every provider returns the same typed models
  (`app/models/knowledge.py`). Generators and routes never touch raw CSV/markdown,
  so switching to Foundry IQ later is a configuration change, not a code change.
- **One switch.** `PROVIDER=local|foundry` is the only thing that selects a
  source — resolved in a single place, [`build_provider`](app/dependencies.py).
- **Async + DI.** Endpoints are async; file IO runs in worker threads
  (`asyncio.to_thread`); provider reads fan out with `asyncio.gather`.
  Dependencies are singletons via `lru_cache` and overridable in tests.
- **Deterministic generation.** Collections are sorted by stable keys, positions
  are derived from indices (never randomness), and a `content_hash` fingerprints
  the world content. Re-running on the same dataset yields an identical
  `content_hash` and identical regions/landmarks/connections. The only varying
  field is `metadata.generated_at` (excluded from the hash).

**Generation mapping**

| Source (dataset) | World element | Notes |
|------------------|---------------|-------|
| Team             | **Region**    | Themed (Backend Citadel, DevOps Mountains, Observatory Valley, …), placed on a ring |
| System           | **Landmark**  | In its owner team's region; archetype from name/criticality (Spire, Bastion, Gateway Arch, …) |
| Project          | **Landmark**  | In its lead engineer's region (a "Worksite") |
| Same department  | **Connection** (`road`) | Sibling teams linked |
| Shared project   | **Connection** (`bridge`) | Every pair of involved teams linked |
| Document owner   | `region.knowledge_doc_ids` | Docs attached to the owner's team (used by later milestones) |

---

## Setup

Requires **Python 3.10+** (validated on 3.14).

```powershell
# from backend/
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows PowerShell
# source .venv/bin/activate           # macOS/Linux
pip install -r requirements.txt
cp .env.example .env                   # optional; defaults work out of the box
```

The dataset is read from `../org_data` by default (configurable via `DATA_DIR`).

## Run

```powershell
# Option A — run the API (auto-generates world.json on first startup)
python run.py
# or: uvicorn app.main:app --reload

# Option B — just (re)generate the artifact, no server
python -m scripts.generate_world
```

Server: <http://127.0.0.1:8000> · Interactive docs: <http://127.0.0.1:8000/docs>

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service + active provider status |
| `POST` | `/generate/world` | Generate from enterprise knowledge and persist |
| `GET`  | `/world` | Return the generated world |

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post http://127.0.0.1:8000/generate/world
Invoke-RestMethod http://127.0.0.1:8000/world
```

---

## Example responses

### `GET /health`

```json
{
  "status": "ok",
  "app": "CompanyVerse Backend",
  "version": "1.0.0",
  "environment": "development",
  "provider": {
    "provider": "local",
    "status": "ok",
    "detail": "Loaded 50 employees, 8 teams, 5 systems from .../org_data"
  },
  "world_generated": true
}
```

### `POST /generate/world` → `201 Created` (metadata excerpt)

```json
{
  "metadata": {
    "world_id": "world-nexova-technologies",
    "name": "CompanyVerse",
    "company_name": "Nexova Technologies",
    "industry": "B2B SaaS — Workflow Automation",
    "provider": "local",
    "generator_version": "1.0.0",
    "seed": 1337,
    "region_count": 8,
    "landmark_count": 8,
    "connection_count": 13,
    "employee_count": 50,
    "content_hash": "4a73e20f1de58b368ffc28861ca5feba31703166eabcfc5246150f3d93b5e519"
  }
}
```

### `GET /world` (one region + one landmark + one connection)

```json
{
  "spawn": { "x": 1200, "y": 900 },
  "regions": [
    {
      "id": "platform-engineering",
      "name": "Backend Citadel",
      "biome": "citadel",
      "theme": "the fortified core where the platform's foundational services are forged and defended",
      "department": "Engineering",
      "source_team": "Platform Engineering",
      "color": "#2563EB",
      "icon": "🏰",
      "lead": "Sarah Chen",
      "member_count": 8,
      "position": { "x": 1200, "y": 1540 },
      "knowledge_doc_ids": ["code-review-guidelines", "onboarding-runbook", "security-review-policy"],
      "landmarks": [
        {
          "id": "system-1",
          "name": "Flow API Spire",
          "landmark_type": "spire",
          "source_type": "system",
          "source_id": "1",
          "criticality": "Critical",
          "description": "Core workflow automation backend API and orchestration engine ...",
          "position": { "x": 1200, "y": 1360 },
          "tags": ["Python", "FastAPI", "PostgreSQL", "Redis"],
          "metadata": {
            "icon": "🗼",
            "status": "Production",
            "uptime_sla_pct": "99.9",
            "repository": "github.com/nexova/flow-api",
            "owner_team": "Platform Engineering"
          }
        }
      ]
    }
  ],
  "connections": [
    {
      "id": "frontend-engineering__platform-engineering",
      "source": "frontend-engineering",
      "target": "platform-engineering",
      "type": "bridge",
      "reason": "Project: Enterprise SSO Integration; Shared department: Engineering"
    }
  ]
}
```

**Generated world summary (Nexova Technologies)** — 8 regions, 8 landmarks, 13 connections:

| Region | Team | Members | Landmarks |
|--------|------|--------:|----------:|
| Backend Citadel | Platform Engineering | 8 | 5 |
| Observatory Valley | Data & Analytics | 8 | 2 |
| Interface Bazaar | Frontend Engineering | 6 | 1 |
| DevOps Mountains | DevOps & Infrastructure | 5 | 0 |
| Roadmap Highlands | Product Management | 4 | 0 |
| Aesthetic Glades | Design & UX | 4 | 0 |
| Revenue Harbor | Sales & Revenue | 7 | 0 |
| Success Sanctuary | Customer Success | 8 | 0 |

---

## Configuration

All settings come from environment variables / `.env` (see [.env.example](.env.example)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROVIDER` | `local` | `local` or `foundry`. **Switching requires no code changes.** |
| `DATA_DIR` | `../org_data` | Synthetic dataset location |
| `GENERATED_DIR` | `generated` | Where `world.json` is written |
| `WORLD_SEED` | `1337` | Recorded in metadata for reproducibility |
| `AUTO_GENERATE_ON_STARTUP` | `true` | Generate `world.json` on boot if missing |
| `FOUNDRY_ENDPOINT` / `FOUNDRY_API_KEY` / `FOUNDRY_PROJECT` / `FOUNDRY_INDEX` | — | Milestone 5 |

### Foundry IQ (Milestone 5)

`FoundryIQKnowledgeProvider` is production-ready in *structure*: it constructs
without credentials, reports health without raising, and raises
`NotImplementedError` from data methods until the SDK integration lands. Setting
`PROVIDER=foundry` switches the wiring with no other code change; the app still
boots (startup auto-generation is skipped gracefully and `/health` reports the
scaffold status).
