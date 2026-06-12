// ─────────────────────────────────────────────────────────────────────────────
// Procedural texture factory.
//
// CompanyVerse ships NO binary art. Following the "finite, combinatorial asset
// library" philosophy (frontend.md §12), every tile/landmark/character texture
// is generated once at runtime in BootScene via Phaser Graphics →
// generateTexture(), keyed exactly as assetMap.ts declares. The bundle DATA then
// decides how these fixed textures are combined to render a unique world.
//
// Style: top-down, 32px tiles, cohesive retro palette, deterministic per key.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import {
  ALL_LANDMARK_TYPES,
  ALL_NPC_SPRITE_TYPES,
  BIOME_PALETTE,
  TILE_SIZE,
  biomeTileset,
  landmarkSprite,
  npcAccent,
  npcSprite,
} from "./assetMap";

const CHAR_W = 28;
const CHAR_H = 36;
export const LANDMARK_W = 56;
export const LANDMARK_H = 64;

/** Small seeded PRNG so each texture's "noise" is stable across reloads. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashKey(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Run a draw routine into an off-screen Graphics and bake it to a texture. */
function bake(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function shade(color: number, factor: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 0xff) * factor)));
  const gg = Math.min(255, Math.max(0, Math.round(((color >> 8) & 0xff) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 0xff) * factor)));
  return (r << 16) | (gg << 8) | b;
}

// ── Tiles ────────────────────────────────────────────────────────────────────

function makeGroundTile(scene: Phaser.Scene, key: string, base: number, alt: number) {
  bake(scene, key, TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(base, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Subtle checker for a tiled feel.
    g.fillStyle(shade(base, 0.94), 1);
    for (let y = 0; y < TILE_SIZE; y += 8) {
      for (let x = 0; x < TILE_SIZE; x += 8) {
        if (((x + y) / 8) % 2 === 0) g.fillRect(x, y, 8, 8);
      }
    }
    // Deterministic speckles in the alt colour.
    const rand = mulberry32(hashKey(key));
    g.fillStyle(alt, 0.7);
    for (let i = 0; i < 10; i++) {
      const x = Math.floor(rand() * (TILE_SIZE - 3));
      const y = Math.floor(rand() * (TILE_SIZE - 3));
      g.fillRect(x, y, 2, 2);
    }
  });
}

function makeWaterTile(scene: Phaser.Scene) {
  bake(scene, "tile_water", TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0x2b6fb3, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0x3f8fd6, 1);
    g.fillRect(0, 6, TILE_SIZE, 4);
    g.fillRect(0, 20, TILE_SIZE, 4);
    g.fillStyle(0x8fd0ff, 0.5);
    g.fillRect(4, 7, 8, 2);
    g.fillRect(18, 21, 8, 2);
  });
}

function makePathTile(scene: Phaser.Scene) {
  bake(scene, "tile_path", TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0xb9986a, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0xa9885a, 1);
    const rand = mulberry32(hashKey("tile_path"));
    for (let i = 0; i < 14; i++) {
      const x = Math.floor(rand() * (TILE_SIZE - 4));
      const y = Math.floor(rand() * (TILE_SIZE - 4));
      g.fillRect(x, y, 3, 3);
    }
  });
}

function makeBridgeTile(scene: Phaser.Scene) {
  bake(scene, "tile_bridge", TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0x8b5a2b, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0x6b421f, 1);
    for (let x = 0; x < TILE_SIZE; x += 8) g.fillRect(x, 0, 2, TILE_SIZE);
    g.fillStyle(0xa9743b, 1);
    g.fillRect(0, 2, TILE_SIZE, 2);
    g.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 2);
  });
}

function makeNexusTile(scene: Phaser.Scene) {
  bake(scene, "tile_nexus", TILE_SIZE, TILE_SIZE, (g) => {
    g.fillStyle(0xe8e2cf, 1);
    g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    g.fillStyle(0xcfc6a8, 1);
    g.lineStyle(2, 0xb7ac85, 1);
    g.strokeRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    g.fillStyle(0xd8cfb0, 1);
    g.fillRect(13, 13, 6, 6);
  });
}

// ── Landmarks ──────────────────────────────────────────────────────────────

type LandmarkDrawer = (g: Phaser.GameObjects.Graphics) => void;

const STONE = 0x9aa3b2;
const STONE_DARK = 0x6b7280;
const ROOF = 0x8b3a3a;
const GLOW = 0x7dd3fc;
const cx = LANDMARK_W / 2;

const landmarkDrawers: Record<string, LandmarkDrawer> = {
  lm_spire: (g) => {
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 8, 18, 16, 46);
    g.fillStyle(STONE, 1);
    g.fillRect(cx - 6, 18, 8, 46);
    g.fillStyle(GLOW, 1);
    g.fillTriangle(cx - 12, 20, cx + 12, 20, cx, 2); // glowing tip
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(cx, 12, 3);
  },
  lm_bastion: (g) => {
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 22, 28, 44, 36);
    g.fillStyle(STONE, 1);
    for (let x = cx - 22; x < cx + 22; x += 8) g.fillRect(x, 22, 6, 8); // battlements
    g.fillStyle(0x3b3b4f, 1);
    g.fillRect(cx - 7, 44, 14, 20); // gate
    g.fillStyle(0x60a5fa, 1);
    g.fillTriangle(cx, 30, cx - 7, 44, cx + 7, 44); // shield emblem
  },
  lm_observatory: (g) => {
    g.fillStyle(STONE, 1);
    g.fillRect(cx - 18, 40, 36, 24);
    g.fillStyle(0xcbd5e1, 1);
    g.fillCircle(cx, 38, 18); // dome
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 20, 56, 40, 8);
    g.lineStyle(3, 0x475569, 1);
    g.lineBetween(cx, 30, cx + 16, 14); // telescope
  },
  lm_plaza: (g) => {
    g.fillStyle(0xe5e7eb, 1);
    g.fillRect(cx - 22, 18, 44, 10); // pediment
    g.fillStyle(STONE, 1);
    for (let x = cx - 20; x <= cx + 16; x += 9) g.fillRect(x, 28, 5, 30); // columns
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 24, 58, 48, 6);
  },
  lm_keep: (g) => {
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 18, 24, 36, 40);
    g.fillStyle(STONE, 1);
    g.fillRect(cx - 22, 14, 10, 50);
    g.fillRect(cx + 12, 14, 10, 50);
    g.fillStyle(ROOF, 1);
    g.fillTriangle(cx - 24, 16, cx - 12, 16, cx - 18, 4);
    g.fillTriangle(cx + 10, 16, cx + 22, 16, cx + 16, 4);
    g.fillStyle(0x3b3b4f, 1);
    g.fillRect(cx - 6, 46, 12, 18); // gate
  },
  lm_tower: (g) => {
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 12, 18, 24, 46);
    g.fillStyle(STONE, 1);
    g.fillRect(cx - 9, 18, 10, 46);
    g.fillStyle(ROOF, 1);
    g.fillTriangle(cx - 16, 20, cx + 16, 20, cx, 2);
    g.fillStyle(0x1f2937, 1);
    g.fillRect(cx - 4, 34, 8, 10); // window
  },
  lm_gateway: (g) => {
    g.fillStyle(STONE_DARK, 1);
    g.fillRect(cx - 22, 16, 12, 48);
    g.fillRect(cx + 10, 16, 12, 48);
    g.fillStyle(STONE, 1);
    g.fillRect(cx - 24, 12, 48, 10); // arch lintel
    g.fillStyle(GLOW, 0.85);
    g.fillRect(cx - 10, 26, 20, 38); // portal glow
  },
  lm_worksite: (g) => {
    g.fillStyle(0x6b7280, 1);
    g.fillRect(cx - 18, 44, 36, 20); // foundation
    g.lineStyle(3, 0xf59e0b, 1); // scaffolding
    g.strokeRect(cx - 16, 22, 32, 40);
    g.lineBetween(cx - 16, 22, cx + 16, 62);
    g.lineBetween(cx + 16, 22, cx - 16, 62);
    g.fillStyle(0xfbbf24, 1);
    g.fillRect(cx - 20, 18, 40, 5); // crane beam
  },
};

function makeLandmark(scene: Phaser.Scene, type: string) {
  const key = landmarkSprite(type);
  bake(scene, key, LANDMARK_W, LANDMARK_H, (g) => {
    // Soft ground shadow shared by all landmarks.
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(cx, LANDMARK_H - 6, 40, 12);
    (landmarkDrawers[key] ?? landmarkDrawers.lm_tower)(g);
  });
}

// ── Status pip (operational/degraded/down) ───────────────────────────────────

function makeStatusPips(scene: Phaser.Scene) {
  const pips: Record<string, number> = {
    pip_green: 0x22c55e,
    pip_amber: 0xf59e0b,
    pip_red: 0xef4444,
  };
  for (const [key, color] of Object.entries(pips)) {
    bake(scene, key, 12, 12, (g) => {
      g.fillStyle(0x0b1020, 1);
      g.fillCircle(6, 6, 6);
      g.fillStyle(color, 1);
      g.fillCircle(6, 6, 4);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(4, 4, 1.4);
    });
  }
}

// ── Characters ───────────────────────────────────────────────────────────────
// Two textures per character: front (face shown) + back (facing away). Left/right
// are produced by horizontally flipping these at runtime — a convincing
// 4-direction look from a finite, recombined set.

function drawCharacterBody(
  g: Phaser.GameObjects.Graphics,
  accent: number,
  back: boolean,
) {
  const bx = CHAR_W / 2;
  // Shadow
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(bx, CHAR_H - 4, 20, 6);
  // Legs
  g.fillStyle(0x3b3b4f, 1);
  g.fillRect(bx - 7, CHAR_H - 12, 5, 10);
  g.fillRect(bx + 2, CHAR_H - 12, 5, 10);
  // Body / tunic in the role accent
  g.fillStyle(accent, 1);
  g.fillRect(bx - 9, 16, 18, 14);
  g.fillStyle(shade(accent, 0.8), 1);
  g.fillRect(bx - 9, 24, 18, 6); // belt shade
  // Arms
  g.fillStyle(shade(accent, 0.9), 1);
  g.fillRect(bx - 11, 17, 4, 11);
  g.fillRect(bx + 7, 17, 4, 11);
  // Head
  const skin = 0xf1c27d;
  g.fillStyle(skin, 1);
  g.fillRect(bx - 6, 4, 12, 12);
  // Hair
  g.fillStyle(0x4b3621, 1);
  g.fillRect(bx - 7, 2, 14, 5);
  if (back) {
    // Back of head: hair covers more, no face.
    g.fillStyle(0x4b3621, 1);
    g.fillRect(bx - 7, 2, 14, 11);
  } else {
    // Face: eyes.
    g.fillStyle(0x1f2937, 1);
    g.fillRect(bx - 4, 9, 2, 2);
    g.fillRect(bx + 2, 9, 2, 2);
  }
}

function makeCharacter(scene: Phaser.Scene, key: string, accent: number) {
  bake(scene, key, CHAR_W, CHAR_H, (g) => drawCharacterBody(g, accent, false));
  const backKey = `${key}_back`;
  bake(scene, backKey, CHAR_W, CHAR_H, (g) => drawCharacterBody(g, accent, true));
}

// ── Misc: interaction marker, generic particle ──────────────────────────────

function makeMisc(scene: Phaser.Scene) {
  bake(scene, "fx_spark", 8, 8, (g) => {
    g.fillStyle(0xfde68a, 1);
    g.fillRect(3, 0, 2, 8);
    g.fillRect(0, 3, 8, 2);
  });
  bake(scene, "fx_dot", 6, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(3, 3, 3);
  });
  // Challenge pickup — a glowing amber scroll/star (40×40).
  // Two frames: one slightly brighter for a pulse animation.
  const W = 40;
  const CX = W / 2;
  const drawPickup = (g: Phaser.GameObjects.Graphics, bright: boolean) => {
    const glow = bright ? 0.28 : 0.14;
    // Outer glow halo.
    g.fillStyle(0xf59e0b, glow);
    g.fillCircle(CX, CX, 19);
    // Inner halo.
    g.fillStyle(0xfbbf24, bright ? 0.45 : 0.3);
    g.fillCircle(CX, CX, 14);
    // Core circle.
    g.fillStyle(bright ? 0xfde68a : 0xfbbf24, 1);
    g.fillCircle(CX, CX, 8);
    // 6-pointed star lines.
    g.lineStyle(bright ? 3 : 2, bright ? 0xffffff : 0xfde68a, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.lineBetween(
        CX + Math.cos(a) * 5, CX + Math.sin(a) * 5,
        CX + Math.cos(a) * 13, CX + Math.sin(a) * 13,
      );
    }
    // Centre dot.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(CX, CX, 3);
  };
  bake(scene, "pickup_challenge_a", W, W, (g) => drawPickup(g, false));
  bake(scene, "pickup_challenge_b", W, W, (g) => drawPickup(g, true));
}

// ── Public entry point ───────────────────────────────────────────────────────

/** Generate every texture the game needs. Idempotent; safe to call once in Boot. */
export function generateAllTextures(scene: Phaser.Scene): void {
  // Biome ground tiles.
  for (const [biome, palette] of Object.entries(BIOME_PALETTE)) {
    makeGroundTile(scene, biomeTileset(biome), palette.ground, palette.groundAlt);
  }
  makeWaterTile(scene);
  makePathTile(scene);
  makeBridgeTile(scene);
  makeNexusTile(scene);

  // Landmarks.
  for (const type of ALL_LANDMARK_TYPES) makeLandmark(scene, type);
  makeStatusPips(scene);

  // Characters: player + every NPC role.
  makeCharacter(scene, "char_player", 0x60a5fa);
  for (const spriteType of ALL_NPC_SPRITE_TYPES) {
    makeCharacter(scene, npcSprite(spriteType), npcAccent(spriteType));
  }

  makeMisc(scene);
}
