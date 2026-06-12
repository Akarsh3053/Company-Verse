# CompanyVerse — Frontend

The playable game client for **CompanyVerse**: a Next.js + Phaser 3 app that
turns one backend `GameBundle` into a top-down, tile-based onboarding adventure.
A new joiner enters a short profile, the backend generates a personalized world
(regions, NPCs, quests, challenges) grounded in enterprise knowledge, and this
client renders and plays it — **no game content is hardcoded**.

> Microsoft Agents League · Track 1 (Creative Apps). The backend uses Foundry IQ
> (knowledge retrieval) + Azure AI Foundry (generation); this is the visible,
> playable deliverable.

---

## Tech stack

| Layer        | Choice                                  |
| ------------ | --------------------------------------- |
| Framework    | Next.js 14 (App Router) + React 18      |
| Language     | TypeScript (strict)                     |
| UI styling   | Tailwind CSS (retro pixel theme)        |
| Game engine  | Phaser 3 (arcade physics, top-down)     |
| Shared state | Zustand                                 |
| Validation   | Zod (bundle validated at the boundary)  |
| Data fetch   | native `fetch` (long-timeout client)    |

**Package manager:** npm.

---

## Prerequisites

- **Node.js 18.18+** (built/tested on Node 24).
- The **CompanyVerse backend** running locally — see [`../backend/README.md`](../backend/README.md).

---

## Quick start

Start the **backend** first (from the repo root):

```powershell
cd backend
.\.venv\Scripts\python.exe run.py     # → http://127.0.0.1:8000  (Swagger at /docs)
```

Then the **frontend** (in a second terminal):

```powershell
cd frontend
npm install
npm run dev                            # → http://localhost:3000
```

Open <http://localhost:3000>, click **New Game**, fill in the profile, and wait
for generation (≈60–90s) — the loader keeps you company. The demo persona
**Alex Johnson · Junior Software Engineer** exercises multiple regions, NPCs,
quests, and challenges.

> CORS is preconfigured on the backend for `http://localhost:3000` and
> `http://127.0.0.1:3000`. Run the frontend on port **3000**.

---

## Environment

Copy `.env.example` to `.env.local` (already present by default):

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

| Variable                   | Default                  | Description                |
| -------------------------- | ------------------------ | -------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://127.0.0.1:8000`  | Base URL of the backend.   |

---

## Scripts

| Command            | Description                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the dev server (HMR) on port 3000.      |
| `npm run build`    | Production build.                             |
| `npm run start`    | Serve the production build.                   |
| `npm run lint`     | Run ESLint.                                   |
| `npm run typecheck`| `tsc --noEmit` strict type check.             |

---

## How it works

```
Title → Profile → (≤120s loader) → Intro cutscene → Phaser overworld
                     POST /game/bundle               render + play the bundle
```

1. **Profile** (`/new`) collects a `UserPersona` and POSTs it to
   `POST /game/bundle`. The bundle is validated with Zod at the boundary
   (`src/schema/bundle.ts`) before anything boots.
2. **Loading** shows a stepped, engaging narrative for the 60–90s AI pipeline.
3. **Play** (`/play?key=…`) boots one Phaser game from the bundle. On refresh it
   resumes by re-fetching `GET /game/bundle/{user_key}`.

### Architecture

- **Phaser owns the `<canvas>`** (one instance, mounted client-only via
  `next/dynamic({ ssr:false })`). **React owns all HUD/overlays.** They talk only
  through a typed event bus (`src/game/eventBus.ts`) and the Zustand store —
  never by reaching into each other's internals.
- **Backend = source of truth for content. Frontend = source of truth for play
  state** (quest progress, completion, stats), persisted to `localStorage` keyed
  by `user_key`.
- **Resilient rendering:** unknown biomes/landmark/NPC/challenge enum values fall
  back to defaults; unresolved cross-references are skipped, never fatal.

### Project layout

```
src/
├─ app/                      # Routes: / (title), /new (profile+loader), /play (game)
├─ components/               # React HUD/overlays (form, dialogue, quest log, modals…)
├─ game/
│  ├─ PhaserGame.tsx         # client-only Phaser bootstrap (ssr:false)
│  ├─ createGame.ts          # Phaser.Game config
│  ├─ scenes/                # BootScene (textures) + OverworldScene
│  ├─ entities/              # Player, NpcEntity, LandmarkEntity
│  ├─ worldBuilder.ts        # bundle → tilemaps/sprites/connections
│  ├─ textures.ts            # procedural pixel-art texture factory
│  ├─ assetMap.ts            # enum → asset key (single source of truth)
│  └─ eventBus.ts            # typed Phaser↔React events
├─ state/                    # Zustand stores (gameStore, sessionStore)
├─ lib/api.ts                # backend client (+ long bundle timeout)
├─ types/bundle.ts           # GameBundle contract (mirrors backend models)
└─ schema/bundle.ts          # Zod validation
```

---

## Assets / licenses

CompanyVerse ships **no binary art** — every tile, landmark, and character
texture is **generated procedurally at runtime** (`src/game/textures.ts`), keyed
by the enums in `src/game/assetMap.ts`. This is the "finite, combinatorial asset
library": a fixed set of generated textures recombined per bundle. To swap in a
real CC0 pack later (Kenney.nl, LPC, …), load images under the same asset keys —
see [`public/assets/CREDITS.md`](public/assets/CREDITS.md). Fonts: *Press Start
2P* and *VT323* (SIL OFL) via Google Fonts.

---

## Controls

| Action            | Keyboard           | Touch              |
| ----------------- | ------------------ | ------------------ |
| Move              | WASD / arrow keys  | On-screen d-pad    |
| Interact / talk   | `E`                | Action button      |
| Quest log         | `Q`                | HUD "Quests" button|
| Hero / stats      | `C`                | HUD "Hero" button  |
| Close overlay     | `Esc`              | ✕ / tap-outside    |
