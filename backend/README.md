# CompanyVerse Backend — Milestones 1 & 2

Transform enterprise knowledge into a playable world. **Milestone 1** builds the
foundation: load the synthetic company dataset, generate a deterministic
`world.json`, and serve it over a FastAPI API. **Milestone 2** turns the
organization's people and expertise into NPCs — deterministic, world-bound
organizational guides — and serves them as `npcs.json`.

> Scope: world + NPC generation. No quests, no runtime chat — those are
> Milestones 3–4. The Foundry IQ provider is scaffolded (Milestone 5) but not
> wired to a live tenant. No LLMs are used: generation is fully deterministic.

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

## What Milestone 2 delivers

| Deliverable | Implementation |
|-------------|----------------|
| NPC schemas | [app/models/npc.py](app/models/npc.py) |
| NPC archetypes (deterministic mappings) | [app/generators/npc_archetypes.py](app/generators/npc_archetypes.py) |
| NPC generator | [app/generators/npc_generator.py](app/generators/npc_generator.py) |
| NPC persistence | [app/services/npc_persistence.py](app/services/npc_persistence.py) |
| NPC endpoints | [app/api/routes/npcs.py](app/api/routes/npcs.py) |
| Output | `generated/npcs.json` |

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
│   │       ├── world.py            # GET /world, POST /generate/world
│   │       └── npcs.py             # GET /npcs, GET /npcs/{id}, POST /generate/npcs
│   ├── models/
│   │   ├── knowledge.py            # Employee, Team, SystemAsset, Project, ...
│   │   ├── world.py                # World, Region, Landmark, Connection, ...
│   │   └── npc.py                  # NPC, NPCCollection, NPCSummary, ...
│   ├── providers/
│   │   ├── base.py                 # KnowledgeProvider (ABC)
│   │   ├── local.py                # LocalKnowledgeProvider (synthetic dataset)
│   │   └── foundry.py              # FoundryIQKnowledgeProvider (scaffold)
│   ├── services/
│   │   ├── knowledge_service.py    # KnowledgeService (unified access + cache)
│   │   ├── world_persistence.py    # WorldRepository (load/save world.json)
│   │   └── npc_persistence.py      # NPCRepository (load/save/regenerate npcs.json)
│   ├── generators/
│   │   ├── world_generator.py      # WorldGenerator (deterministic build)
│   │   ├── npc_generator.py        # NPCGenerator (deterministic build)
│   │   ├── npc_archetypes.py       # employee→NPC archetype/persona/lore mappings
│   │   ├── theming.py              # team→region & system→landmark themes
│   │   └── layout.py               # deterministic 2D positioning
│   └── utils/
│       ├── data_loader.py          # CSV/markdown → domain models
│       └── text.py                 # slugify, helpers
├── scripts/
│   ├── generate_world.py           # CLI: regenerate world.json without the server
│   └── generate_npcs.py            # CLI: regenerate npcs.json without the server
├── generated/
│   ├── world.json                  # generated artifact (Milestone 1)
│   └── npcs.json                   # generated artifact (Milestone 2)
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

## NPC generation (Milestone 2)

```
        KnowledgeService ─┐
                          ├─►  NPCGenerator  ─►  NPCCollection  ─►  npcs.json
        world.json ───────┘     (deterministic)

   FastAPI:  GET /npcs · GET /npcs/{npc_id} · POST /generate/npcs
```

NPCs are organizational guides and experts generated **from real employees** and
bound to **valid world regions**. Generation reads `world.json` to learn each
region's id (never hardcoded) and fails gracefully (`503`) if the world has not
been generated yet.

**Archetype mapping** — each employee resolves to exactly one NPC category:

| Source signal | NPC category | Example |
|---------------|--------------|---------|
| VP / Director / Manager / Lead | **Guild Master** | Engineering Manager → Guild Master |
| Principal / Staff | **Sage** | Principal Software Engineer → Sage |
| Architect | **Architect** | Solutions Architect → Architect |
| Senior (generic) | **Guardian** | Senior Frontend Engineer → Guardian |
| Platform | **Artificer** | Platform Engineer → Artificer |
| DevOps / Infrastructure | **Ranger** | Senior DevOps Engineer → Ranger |
| Design / UX | **Artificer** | Design Lead → Experience Artificer |
| Data / Analytics | **Oracle** | Data Scientist → Data Oracle |
| (everyone else) | **Guide** | Associate → Guide |

**Signature NPCs from knowledge ownership.** Real-world titles are often generic
("Director of DevOps") even when a person *owns* a critical knowledge domain. The
dataset encodes ownership in each document's `Owner`/`Author` field, so the
brief's signature NPCs are promoted **deterministically from document
ownership** (most-owned domain wins) rather than titles:

| Owned knowledge domain | NPC | Persona |
|------------------------|-----|---------|
| Security review / access control | **Security Sentinel** | Guardian of security practices and compliance |
| Incident response / reliability / on-call | **Incident Oracle** | Seer of incidents, reliability, and the health of the realm |
| Release / deployment / change management | **Release Guardian** | Keeper of the release ritual and deployment safety |

For Nexova this surfaces a **Security Sentinel** (Sarah Chen, owner of the
security review policy) and an **Incident Oracle** (Robert Kim, owner of the
deployment SOP, incident response, disaster recovery, and on-call handbook).

**Design principles (in addition to Milestone 1's)**

- **Deterministic & grounded.** Title/keyword and document-ownership lookups
  only — no LLM. The same dataset + world always yields the same NPCs and an
  identical `metadata.content_hash`.
- **World-bound.** Every NPC's `region_id` is a real `world.json` region id;
  references are validated and unknown teams are skipped (and logged).
- **Forward-compatible.** `persona`, `expertise`, `knowledge_scope` and
  `source_employee` are populated now so Milestone 4 (runtime conversations) can
  ground NPC dialogue without a schema change.
- **Curated cast.** Up to 3 distinct-role NPCs per region (the highest-value
  archetypes), keeping the world readable.

**Generation mapping**

| Source (dataset) | NPC element | Notes |
|------------------|-------------|-------|
| Employee | **NPC** | One NPC per selected employee; `id = npc-<employee-name>` |
| Title / keywords | `role`, `sprite_type`, `persona`, `lore` | Deterministic archetype templates |
| Document ownership | `role` (signature), `knowledge_scope`, `expertise` | Owner of a domain → signature NPC; owned doc ids → grounding scope |
| World region (`source_team` → `id`) | `region_id` | Read from `world.json`; validated |

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
# Option A — run the API (auto-generates world.json + npcs.json on first startup)
python run.py
# or: uvicorn app.main:app --reload

# Option B — just (re)generate the artifacts, no server
python -m scripts.generate_world      # writes generated/world.json
python -m scripts.generate_npcs       # writes generated/npcs.json (needs world.json)
```

Server: <http://127.0.0.1:8000> · Interactive docs: <http://127.0.0.1:8000/docs>

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Service + active provider status |
| `POST` | `/generate/world` | Generate the world from enterprise knowledge and persist |
| `GET`  | `/world` | Return the generated world |
| `POST` | `/generate/npcs` | Generate NPCs from knowledge + world and persist |
| `GET`  | `/npcs` | List generated NPCs (optional `?region_id=`) |
| `GET`  | `/npcs/{npc_id}` | Return a single full NPC |

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
Invoke-RestMethod -Method Post http://127.0.0.1:8000/generate/world
Invoke-RestMethod http://127.0.0.1:8000/world
Invoke-RestMethod -Method Post http://127.0.0.1:8000/generate/npcs
Invoke-RestMethod http://127.0.0.1:8000/npcs
Invoke-RestMethod "http://127.0.0.1:8000/npcs?region_id=platform-engineering"
Invoke-RestMethod http://127.0.0.1:8000/npcs/npc-robert-kim
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
  "world_generated": true,
  "npcs_generated": true
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

### NPC example responses

#### `GET /npcs` (summaries)

```json
[
  {
    "id": "npc-sarah-chen",
    "name": "Security Sentinel",
    "title": "Sentinel of Backend Citadel",
    "role": "Sentinel",
    "region_id": "platform-engineering",
    "sprite_type": "sentinel"
  },
  {
    "id": "npc-robert-kim",
    "name": "Incident Oracle",
    "title": "Oracle of DevOps Mountains",
    "role": "Oracle",
    "region_id": "devops-infrastructure",
    "sprite_type": "oracle"
  }
]
```

#### `GET /npcs/npc-robert-kim` (full NPC)

```json
{
  "id": "npc-robert-kim",
  "name": "Incident Oracle",
  "title": "Oracle of DevOps Mountains",
  "role": "Oracle",
  "region_id": "devops-infrastructure",
  "source_employee": "Robert Kim",
  "sprite_type": "oracle",
  "persona": "Seer of incidents, reliability, and the health of the realm.",
  "expertise": ["Engineering", "Incident Response", "On-Call", "Operations", "Reliability", "Security"],
  "knowledge_scope": [
    "access-control-matrix", "change-management-process", "deployment-sop",
    "disaster-recovery-plan", "engineering-on-call-handbook", "incident-response"
  ],
  "lore": "Keeps vigil over DevOps Mountains, reading the omens of alerts and outages so that travelers may learn the ways of incident response and recovery.",
  "metadata": {
    "department": "Engineering",
    "employee_id": "15",
    "employee_title": "Director of DevOps",
    "owned_doc_count": "6",
    "region_name": "DevOps Mountains",
    "team": "DevOps & Infrastructure"
  }
}
```

#### `POST /generate/npcs` → `201 Created` (metadata excerpt)

```json
{
  "metadata": {
    "name": "CompanyVerse",
    "company_name": "Nexova Technologies",
    "provider": "local",
    "generator_version": "1.0.0",
    "world_id": "world-nexova-technologies",
    "world_content_hash": "4a73e20f1de58b368ffc28861ca5feba31703166eabcfc5246150f3d93b5e519",
    "npc_count": 16,
    "region_count": 8,
    "roles": {
      "Artificer": 1, "Guardian": 3, "Guide": 3, "Guild Master": 4,
      "Oracle": 2, "Ranger": 1, "Sage": 1, "Sentinel": 1
    },
    "content_hash": "5b74d4d11a962d4497a09e48fe4472f1ffc5f4be8ef04fa5b0861a5d3b839727"
  }
}
```

**Generated NPC cast (Nexova Technologies)** — 16 NPCs across 8 regions:

| NPC | Source employee | Role | Region |
|-----|-----------------|------|--------|
| Security Sentinel | Sarah Chen | Sentinel | Backend Citadel |
| Backend Citadel Sage | Marcus Williams | Sage | Backend Citadel |
| Backend Citadel Guardian | Priya Patel | Guardian | Backend Citadel |
| Incident Oracle | Robert Kim | Oracle | DevOps Mountains |
| Observatory Valley Data Oracle | Victor Huang | Oracle | Observatory Valley |
| Aesthetic Glades Experience Artificer | Isabella Costa | Artificer | Aesthetic Glades |
| … (Guild Masters / Guardians / Guides for every region) | | | |

---

## Configuration

All settings come from environment variables / `.env` (see [.env.example](.env.example)):

| Variable | Default | Purpose |
|----------|---------|---------|
| `PROVIDER` | `local` | `local` or `foundry`. **Switching requires no code changes.** |
| `DATA_DIR` | `../org_data` | Synthetic dataset location |
| `GENERATED_DIR` | `generated` | Where `world.json` + `npcs.json` are written |
| `WORLD_SEED` | `1337` | Recorded in metadata for reproducibility |
| `AUTO_GENERATE_ON_STARTUP` | `true` | Generate `world.json` then `npcs.json` on boot if missing |
| `FOUNDRY_ENDPOINT` / `FOUNDRY_API_KEY` / `FOUNDRY_PROJECT` / `FOUNDRY_INDEX` | — | Milestone 5 |

### Foundry IQ (Milestone 5)

`FoundryIQKnowledgeProvider` is production-ready in *structure*: it constructs
without credentials, reports health without raising, and raises
`NotImplementedError` from data methods until the SDK integration lands. Setting
`PROVIDER=foundry` switches the wiring with no other code change; the app still
boots (startup auto-generation is skipped gracefully and `/health` reports the
scaffold status).
