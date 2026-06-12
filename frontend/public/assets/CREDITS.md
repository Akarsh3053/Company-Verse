# Asset Credits & Licenses

CompanyVerse renders from a **finite, combinatorial asset library** (frontend.md
§12): a fixed set of real art packs, recombined per bundle so every generated
world renders from the same assets. Mapping from backend enum values → asset
keys lives in `src/game/assetMap.ts` and `src/game/assets/manifest.ts`.

Anything a pack doesn't cover is generated procedurally at runtime
(`src/game/textures.ts`) as an automatic fallback, so the game always renders.

## Packs in use

### Terrain, props, nexus & landmarks — Cam Tatz "Top Down Asset Pack 1"
- Author: **Cam Tatz** (@CamTatz · ctatz.com)
- License: **CC0 1.0 (Public Domain)** — no attribution required (credited here gratefully)
- Path: `tiles/tilepack/`
- Used for: biome ground fills (grass/dirt/sand/snow/slime), trees, rocks,
  bushes, flowers, mushrooms, cactus, the HQ nexus plaza floor, and landmark
  building materials (brick/plaster walls + door composited into landmark sprites).
- The pack has been trimmed to only the files the game references.

### Characters — "700+ RPG Sprites" (The Last Guardian set)
- Author: **Philipp Lenssen** (outer-court.com)
- License: **CC-BY 3.0** — attribution required. "All images drawn by Philipp
  Lenssen in late 1990s. Credit by name appreciated."
- Source: https://opengameart.org/content/700-sprites
- Paths: `characters_png/` (runtime sprites) + `charcters/last-guardian-sprites/`
  (original GIF source, trimmed to the 10 used character prefixes).
- Used for: the player avatar + all 9 NPC role sprites (4-direction walk cycles).
- The runtime PNGs are the source GIFs with their opaque white background removed
  (edge flood-fill); regenerate with `scripts/convert_chars.ps1`.

## Fonts

- **Press Start 2P** — Google Fonts (SIL Open Font License 1.1).
- **VT323** — Google Fonts (SIL Open Font License 1.1).

Loaded via Google Fonts CSS in `src/app/globals.css`.

## How the mapping works

`src/game/assets/manifest.ts` declares:
- `BIOME_TERRAIN_FILE` — biome → Cainos fill tile.
- `BIOME_PROPS` — biome → which props to scatter.
- `CHAR_ROLE_PREFIX` — backend `sprite_type` → Last Guardian character prefix.

Real images load in `BootScene.preload()` under the same texture keys the
procedural factory uses; `generateAllTextures()` then fills only the gaps. To
swap a pack, change the file paths in the manifest — no other code changes.
