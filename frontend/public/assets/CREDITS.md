# Asset Credits & Licenses

CompanyVerse ships **no third-party binary art**. Every tile, landmark, and
character texture is **generated procedurally at runtime** in the Phaser
`BootScene` (see `src/game/textures.ts`) using `Phaser.GameObjects.Graphics` →
`generateTexture()`.

This follows the spec's "finite, combinatorial asset library" philosophy
(frontend.md §12): a small, fixed set of generated textures — keyed by biome,
landmark type, and NPC role in `src/game/assetMap.ts` — is recombined per
bundle so every generated world renders from the same art.

## Fonts

- **Press Start 2P** — Google Fonts (SIL Open Font License 1.1).
- **VT323** — Google Fonts (SIL Open Font License 1.1).

Loaded via Google Fonts CSS in `src/app/globals.css`.

## Swapping in hand-drawn art later

To replace the procedural textures with a real CC0 pack (e.g. Kenney.nl Tiny
Town / Tiny Dungeon, or LPC tilesets from OpenGameArt):

1. Drop the images under `public/assets/{tiles,landmarks,characters,ui}/`.
2. Load them in `BootScene.preload()` under the **same keys** declared in
   `src/game/assetMap.ts` (e.g. `tiles_citadel`, `lm_spire`, `char_guide`).
3. Remove (or keep as fallback) the matching generator in `textures.ts`.

Because the asset keys are the single source of truth, no other code changes
are required. Record the new pack's attribution/license here.
