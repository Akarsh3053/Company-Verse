# CompanyVerse — Frontend

A top-down 2D onboarding game built with **Next.js 14 + Phaser 3**. A new joiner enters a short profile; the backend generates a complete, personalised world grounded in real enterprise knowledge; this client renders and plays it — no game content is hardcoded.

> Microsoft Agents League · Track 1 (Creative Apps).
> Backend: Azure AI Foundry (generation) + Foundry IQ (knowledge retrieval).

---

## What it looks like

```
┌─ Title ──────────────────────────────────────────────────────┐
│  New Game → Profile form → 60-90 s AI generation loader      │
│  Continue → pick a saved game key → instant resume           │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌─ Intro cutscene ─────────────────────────────────────────────┐
│  AI-authored narrative_intro, typewriter reveal              │
└──────────────────────────────────────────────────────────────┘
                          ↓
┌─ Overworld (Phaser) ─────────────────────────────────────────┐
│  Top-down tile world • WASD movement • arcade physics        │
│                                                              │
│  HUD bar ── Lv/XP/stats/QUESTS/HERO buttons (56 px)         │
│  Quest Tracker ── always-visible "→ where to go next"        │
│  Quest Log ── 300 px side panel (Q key), world stays visible │
│                                                              │
│  Walk near NPC → press E → dialogue tree (branching)         │
│  Accept quest → track objectives → enter regions/landmarks   │
│  Take challenges (quiz/decision/scenario/ordering)           │
│  Complete quest → XP + stat gains + unlocks next quest       │
│  Ask NPC anything → grounded real-time chat (/game/chat)     │
└──────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + React 18 |
| Language | TypeScript strict |
| UI | Tailwind CSS (retro pixel theme, Press Start 2P / VT323 fonts) |
| Game engine | Phaser 3, arcade physics, top-down |
| State | Zustand (`gameStore` for play progress, `sessionStore` for current bundle) |
| Validation | Zod — bundle validated at the API boundary before Phaser boots |
| HTTP | native `fetch` with a 120 s timeout for bundle generation |

**Package manager:** npm.

---

## Prerequisites

- **Node.js 18.18+**
- The **CompanyVerse backend** running at `http://127.0.0.1:8000`

```powershell
# From repo root — start the backend first
cd backend
.\.venv\Scripts\python.exe run.py      # http://127.0.0.1:8000 · Swagger at /docs
```

---

## Quick start

```powershell
cd frontend
npm install
npm run dev                            # http://localhost:3000
```

Open <http://localhost:3000> and click **New Game**. The demo persona **Alex Johnson · Junior Software Engineer** exercises all biomes, NPC roles, quest types, and challenge types.

> CORS is preconfigured for `http://localhost:3000` and `http://127.0.0.1:3000` on the backend. Always run the frontend on **port 3000**.

> **Important:** never run `npm run build` while `npm run dev` is running — they share the `.next` directory and will corrupt each other. Stop dev first.

---

## Environment

`.env.local` is committed with a safe default:

```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

Change it to point at a deployed backend when needed.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server with HMR on port 3000 |
| `npm run build` | Production build (stop dev first) |
| `npm run start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` strict check |
| `npm run lint` | ESLint |
| `pwsh scripts/convert_chars.ps1` | Regenerate `public/assets/characters_png/` from source GIFs |

---

## Game flow

```
POST /game/bundle   ← UserPersona (name, email, role, bio, goals…)
                    → GameBundle JSON  (60-90 s AI pipeline)

GET  /game/bundle/{user_key}   ← resume — reads persisted bundle, instant
GET  /game/bundles             ← list saved bundle keys for Continue screen
POST /game/chat                ← free-form NPC chat, grounded in org knowledge
```

### Data flow

```
Profile form  →  POST /game/bundle
                 └─ Zod validates GameBundle at boundary
                 └─ sessionStore.setBundle(bundle)
                 └─ navigate /play?key=<user_key>&intro=1

/play page    →  if sessionStore has bundle: use it immediately (no HTTP)
                 else GET /game/bundle/<user_key>
                 └─ initFromBundle → Zustand gameStore
                    (quest status, objectives, XP, stats seeded from bundle)
                 └─ progress auto-saved to localStorage keyed by user_key
                    (persists across refresh and browser restarts)
```

---

## Architecture

### Phaser ↔ React split

Phaser owns the `<canvas>` (mounted client-only via `next/dynamic({ ssr:false })`).
React owns all HUD and overlay UI. They communicate exclusively through:

- A **typed event bus** (`src/game/eventBus.ts`) — e.g. `dialogue:open`, `challenge:open`, `overlay:changed`, `camera:focusRegion`
- The **Zustand `gameStore`** — Phaser reads quest status to drive NPC quest indicators; React reads it to render the HUD

Neither side ever reaches into the other's internals.

### World rendering

The backend emits pixel-coordinate positions for the world spawn (~1200, 900), 8 ring regions (~640 px radius), and landmarks. The world builder:

1. Draws a **460 px stone nexus** (HQ plaza) at the spawn — large enough to cover all diagonal gaps between regions
2. Draws **thin paths** between region centres (depth below regions, so they only show in the gaps)
3. Paints **region patches** (rounded, biome-tinted ground tiles) on top of paths
4. Places **landmark sprites** and **NPC sprites** inside each region
5. A **hard boundary** prevents the player from leaving the union of region circles + nexus (velocity override, not a soft push)

### Play state

The frontend owns all play-state. The backend is never asked about progress.

- Quest gating (prerequisites), objective tracking (talk/explore/challenge/read), XP, stat gains, badge grants, quest unlocks — all in `gameStore`
- `localStorage` keyed by `metadata.user_key` — survives refresh

---

## Project layout

```
frontend/
├─ public/assets/
│  ├─ tiles/tilepack/          Cam Tatz terrain + props (CC0, trimmed to 25 files)
│  ├─ charcters/last-guardian  Philipp Lenssen RPG sprites (CC-BY 3.0, trimmed)
│  ├─ characters_png/          Pre-processed transparent PNGs (runtime sprites)
│  └─ CREDITS.md
├─ scripts/
│  └─ convert_chars.ps1        GIF → transparent PNG converter (Windows PowerShell)
└─ src/
   ├─ app/
   │  ├─ page.tsx              Title / Start screen
   │  ├─ new/page.tsx          Profile form + loading screen
   │  └─ play/page.tsx         Game host — bundles Phaser + all overlays
   ├─ components/
   │  ├─ ProfileForm.tsx        New-joiner form
   │  ├─ LoadingScreen.tsx      Stepped progress narrative (60-90 s loader)
   │  ├─ IntroCutscene.tsx      Typewriter narrative intro
   │  ├─ Hud.tsx               Compact top bar (56 px, Pokémon-style)
   │  ├─ QuestTracker.tsx      Always-visible "where to go next" panel (bottom-right)
   │  ├─ QuestLog.tsx          300 px side panel quest list (Q key)
   │  ├─ DialogueBox.tsx       Branching NPC dialogue (E to open)
   │  ├─ ChallengeModal.tsx    4 challenge types (quiz/decision/scenario/ordering)
   │  ├─ ChatPanel.tsx         Free-form grounded NPC chat
   │  ├─ CharacterSheet.tsx    Hero stats, backstory, badges
   │  ├─ LandmarkCard.tsx      Landmark info card (E near landmark)
   │  ├─ CompletionScreen.tsx  All-quests-complete summary
   │  ├─ Toaster.tsx           Quest/level/badge toast notifications
   │  ├─ InteractionPrompt.tsx "Press E / tap" proximity hint
   │  └─ MobileControls.tsx    On-screen d-pad + action button
   ├─ game/
   │  ├─ PhaserGame.tsx        Client-only Phaser mount (ssr:false)
   │  ├─ createGame.ts         Phaser.Game config (maxParallelDownloads:256, no StrictMode)
   │  ├─ eventBus.ts           Typed Phaser↔React event emitter (no Phaser dependency)
   │  ├─ virtualInput.ts       Mobile d-pad → Phaser input bridge
   │  ├─ assetMap.ts           Enum → texture key (single source of truth)
   │  ├─ textures.ts           Procedural texture factory (fallback for missing art)
   │  ├─ worldBuilder.ts       GameBundle → Phaser scene objects
   │  ├─ worldGeometry.ts      Pixel-coordinate helpers + world bounds
   │  ├─ assets/
   │  │  ├─ manifest.ts        Real asset paths + biome/role/prop mappings
   │  │  ├─ realAssets.ts      BootScene preload + walk animation builder
   │  │  └─ landmarkComposer.ts RenderTexture landmark factory (real materials + vector accents)
   │  ├─ scenes/
   │  │  ├─ BootScene.ts       Load real assets → build anims → procedural fallback → start Overworld
   │  │  └─ OverworldScene.ts  Movement, camera, proximity, interaction, hard boundary
   │  └─ entities/
   │     ├─ Player.ts          WASD + virtual d-pad, real 4-dir walk anims + procedural fallback
   │     ├─ NpcEntity.ts       NPC sprite + nameplate + quest indicator (❗❓✔)
   │     └─ LandmarkEntity.ts  Landmark sprite + proximity label + status pip
   ├─ state/
   │  ├─ gameStore.ts          Play state: quests, objectives, XP, stats, badges, localStorage
   │  └─ sessionStore.ts       In-memory current bundle (cleared on hard refresh)
   ├─ lib/api.ts               Backend client (bundle, chat, list) + error helpers
   ├─ types/bundle.ts          GameBundle TypeScript interfaces (mirrors backend Pydantic models)
   └─ schema/bundle.ts         Zod schema — tolerant of extra fields, strict on required ones
```

---

## Assets

All art is a **finite, combinatorial library**: a small fixed set of real textures recombined per bundle. Every backend enum value (biome, landmark type, NPC role) maps to an asset key in `src/game/assetMap.ts` + `src/game/assets/manifest.ts`. Unknown values fall back to a procedural texture — the game never crashes on unexpected data.

| Pack | Used for | License |
|---|---|---|
| Cam Tatz "Top Down Asset Pack 1" | Biome terrain fills, props (trees/rocks/bushes/flowers), nexus plaza, landmark walls/doors | CC0 |
| Philipp Lenssen "700+ RPG Sprites" | Player + 9 NPC role walk cycles (GIFs converted to transparent PNGs) | CC-BY 3.0 |
| `src/game/textures.ts` (procedural) | Fallback for any missing texture key | — |

See [`public/assets/CREDITS.md`](public/assets/CREDITS.md) for full attribution details.

To regenerate the character PNGs from the source GIFs (Windows only):

```powershell
pwsh scripts/convert_chars.ps1
```

---

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | WASD or arrow keys | On-screen d-pad |
| Interact / talk to NPC | `E` | Action button (bottom-right) |
| Open Quest Log | `Q` | QUESTS button in HUD |
| Open Hero sheet | `C` | HERO button in HUD |
| Close any overlay | `Esc` | ✕ button / tap outside |

---

## Known behaviour notes

- **Generation takes 60–90 s** when using the live Azure AI Foundry model (`LLM_PROVIDER=foundry`). The loader is designed for this wait. With `LLM_PROVIDER=local` (offline mode) generation is instant.
- **Background tab**: Phaser pauses its loop when the browser tab is hidden. The BootScene loads all assets in one parallel batch (`maxParallelDownloads: 256`) so it completes even in a background tab. The Overworld scene waits for the loop to resume (i.e. bring the tab to the front).
- **React StrictMode is disabled** (`reactStrictMode: false` in `next.config.mjs`). Phaser creates an imperative canvas game instance; StrictMode's dev-only double-mount races the async teardown and can freeze the boot loader.
- **Progress persists** to `localStorage` keyed by `metadata.user_key`. Clearing site data resets progress without affecting the saved bundle on the backend.


