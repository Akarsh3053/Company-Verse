// ─────────────────────────────────────────────────────────────────────────────
// Real-asset loader + registrar.
//
// queueRealAssets()  — called in BootScene.preload(): queues real art under the
//                      same texture keys the procedural factory uses (terrain,
//                      nexus, props) plus character walk frames.
// registerCharacterAnimations() — called in create(): builds 4-direction walk
//                      animations from the loaded character frames.
//
// Anything that fails to load simply isn't registered, and the procedural
// factory (textures.ts) fills the gap — so the game always renders.
// ─────────────────────────────────────────────────────────────────────────────

import type * as Phaser from "phaser";
import { biomeTileset } from "../assetMap";
import {
  BIOME_TERRAIN_FILE,
  CHAR_ROLE_PREFIX,
  DEFAULT_CHAR_PREFIX,
  LANDMARK_PART_FILES,
  LG_DIRS,
  NEXUS_TILE_FILE,
  PROP_FILES,
  WILDERNESS_TREES,
  charFrameFile,
  charFrameKey,
  usedCharPrefixes,
  walkAnimKey,
  type LgDir,
} from "./manifest";

/** Queue all real images. Safe to call once in BootScene.preload(). */
export function queueRealAssets(scene: Phaser.Scene): void {
  // Terrain fills under the biome tileset keys (overrides procedural).
  for (const [biome, file] of Object.entries(BIOME_TERRAIN_FILE)) {
    scene.load.image(biomeTileset(biome), file);
  }

  // Nexus plaza floor (overrides procedural tile_nexus).
  scene.load.image("tile_nexus", NEXUS_TILE_FILE);

  // Landmark building parts (composited into landmark textures in create()).
  for (const [key, file] of Object.entries(LANDMARK_PART_FILES)) {
    scene.load.image(key, file);
  }

  // Props.
  for (const [key, file] of Object.entries(PROP_FILES)) {
    scene.load.image(key, file);
  }

  // Character walk frames (8 per used prefix).
  for (const prefix of usedCharPrefixes()) {
    for (const dir of LG_DIRS) {
      scene.load.image(charFrameKey(prefix, dir, 1), charFrameFile(prefix, dir, 1));
      scene.load.image(charFrameKey(prefix, dir, 2), charFrameFile(prefix, dir, 2));
    }
  }

  // If any file 404s, log it but never abort the boot.
  scene.load.on("loaderror", (file: Phaser.Loader.File) => {
    // eslint-disable-next-line no-console
    console.warn(`[assets] failed to load ${file.key} (${file.url}) — using fallback`);
  });
}

/** True if a character prefix's frames actually loaded (else use fallback). */
export function hasRealCharacter(scene: Phaser.Scene, prefix: string): boolean {
  return scene.textures.exists(charFrameKey(prefix, "fr", 1));
}

/**
 * Build 4-direction, 2-frame walk animations for every loaded character prefix.
 * Animation keys: walk_<prefix>_<dir> (dir ∈ fr/bk/lf/rt). Idempotent.
 */
export function registerCharacterAnimations(scene: Phaser.Scene): void {
  const prefixes = usedCharPrefixes();
  for (const prefix of prefixes) {
    if (!hasRealCharacter(scene, prefix)) continue;
    for (const dir of LG_DIRS) {
      const key = walkAnimKey(prefix, dir);
      if (scene.anims.exists(key)) continue;
      const frame1 = charFrameKey(prefix, dir, 1);
      const frame2 = charFrameKey(prefix, dir, 2);
      if (!scene.textures.exists(frame1) || !scene.textures.exists(frame2)) continue;
      scene.anims.create({
        key,
        frames: [{ key: frame1 }, { key: frame2 }],
        frameRate: 6,
        repeat: -1,
      });
    }
  }
}

/** Resolve a backend sprite_type to a loaded LG prefix (or the default). */
export function resolveCharPrefix(scene: Phaser.Scene, spriteType: string): string | null {
  const mapped = CHAR_ROLE_PREFIX[spriteType] ?? DEFAULT_CHAR_PREFIX;
  if (hasRealCharacter(scene, mapped)) return mapped;
  if (hasRealCharacter(scene, DEFAULT_CHAR_PREFIX)) return DEFAULT_CHAR_PREFIX;
  return null; // no real art — caller falls back to procedural
}

/** Logical movement direction → LG frame direction + whether to flip X. */
export function dirToLg(
  vx: number,
  vy: number,
): { dir: LgDir; flipX: boolean } {
  if (Math.abs(vy) >= Math.abs(vx)) {
    return { dir: vy < 0 ? "bk" : "fr", flipX: false };
  }
  // LG has distinct left/right frames; use them directly (no flip needed).
  return { dir: vx < 0 ? "lf" : "rt", flipX: false };
}
