// ─────────────────────────────────────────────────────────────────────────────
// Landmark composer — builds each landmark texture from a REAL Cainos wall/door
// material (brick or plaster) plus vector roof/topper accents, baked via a
// RenderTexture and saved under the lm_<type> keys the procedural factory uses.
//
// Runs in BootScene.create() BEFORE generateAllTextures(), so the procedural
// landmark generator (which skips existing keys) only fills in any type that
// fails here. Each landmark is built in isolation: one failure never blocks the
// others, and an empty key just falls back to procedural art.
// ─────────────────────────────────────────────────────────────────────────────

import type * as Phaser from "phaser";
import { ALL_LANDMARK_TYPES, landmarkSprite } from "../assetMap";

const W = 96;
const H = 120;
const CX = W / 2;
const BASE_Y = H - 8;

// Accent palette (vector roofs / toppers over the real wall material).
const ROOF_RED = 0x8b3a3a;
const STONE_DARK = 0x5b6472;
const GLOW = 0x7dd3fc;
const WHITE = 0xeef2f7;
const GOLD = 0xfacc15;

interface LandmarkSpec {
  wall: "cainos_wall_stone" | "cainos_wall_white";
  bodyW: number;
  bodyH: number;
  door: boolean;
  /** Draw roof + topper accents; bodyTopY is the top edge of the wall body. */
  accents: (g: Phaser.GameObjects.Graphics, bodyTopY: number) => void;
}

function crenellations(g: Phaser.GameObjects.Graphics, bodyW: number, topY: number) {
  g.fillStyle(STONE_DARK, 1);
  const left = CX - bodyW / 2;
  const step = 14;
  for (let x = left; x < left + bodyW - 6; x += step) {
    g.fillRect(x, topY - 8, 8, 10);
  }
}

const SPECS: Record<string, LandmarkSpec> = {
  keep: {
    wall: "cainos_wall_stone",
    bodyW: 72,
    bodyH: 60,
    door: true,
    accents: (g, top) => {
      crenellations(g, 72, top);
      // Banner.
      g.fillStyle(ROOF_RED, 1);
      g.fillRect(CX - 3, top - 6, 6, 18);
    },
  },
  bastion: {
    wall: "cainos_wall_stone",
    bodyW: 80,
    bodyH: 50,
    door: true,
    accents: (g, top) => {
      crenellations(g, 80, top);
      // Shield emblem.
      g.fillStyle(0x3b82f6, 1);
      g.fillTriangle(CX, top + 10, CX - 10, top + 16, CX, top + 30);
      g.fillTriangle(CX, top + 10, CX + 10, top + 16, CX, top + 30);
    },
  },
  tower: {
    wall: "cainos_wall_stone",
    bodyW: 40,
    bodyH: 72,
    door: true,
    accents: (g, top) => {
      g.fillStyle(ROOF_RED, 1);
      g.fillTriangle(CX - 26, top + 2, CX + 26, top + 2, CX, top - 26); // conical roof
      g.fillStyle(0x1f2937, 1);
      g.fillRect(CX - 5, top + 16, 10, 12); // window
    },
  },
  spire: {
    wall: "cainos_wall_stone",
    bodyW: 30,
    bodyH: 84,
    door: false,
    accents: (g, top) => {
      g.fillStyle(GLOW, 1);
      g.fillTriangle(CX - 18, top + 4, CX + 18, top + 4, CX, top - 34); // tall spire
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(CX, top - 24, 4); // glow tip
    },
  },
  gateway: {
    wall: "cainos_wall_stone",
    bodyW: 76,
    bodyH: 64,
    door: false,
    accents: (g, top) => {
      // Arch gap (portal) in the centre, glowing.
      g.fillStyle(0x141a2e, 1);
      g.fillRoundedRect(CX - 14, top + 18, 28, 46, { tl: 14, tr: 14, bl: 0, br: 0 });
      g.fillStyle(GLOW, 0.7);
      g.fillRoundedRect(CX - 10, top + 24, 20, 40, { tl: 10, tr: 10, bl: 0, br: 0 });
    },
  },
  plaza: {
    wall: "cainos_wall_white",
    bodyW: 78,
    bodyH: 44,
    door: false,
    accents: (g, top) => {
      // Pediment.
      g.fillStyle(WHITE, 1);
      g.fillTriangle(CX - 44, top + 2, CX + 44, top + 2, CX, top - 18);
      // Columns.
      g.fillStyle(0xd6dce5, 1);
      for (let x = CX - 32; x <= CX + 26; x += 14) g.fillRect(x, top + 6, 6, 34);
    },
  },
  observatory: {
    wall: "cainos_wall_white",
    bodyW: 60,
    bodyH: 44,
    door: true,
    accents: (g, top) => {
      g.fillStyle(0xcbd5e1, 1);
      g.fillCircle(CX, top + 4, 24); // dome
      g.fillStyle(STONE_DARK, 1);
      g.fillRect(CX - 26, top + 2, 52, 6); // dome base
      g.lineStyle(3, 0x475569, 1);
      g.lineBetween(CX, top - 6, CX + 18, top - 22); // telescope
    },
  },
  worksite: {
    wall: "cainos_wall_white",
    bodyW: 64,
    bodyH: 46,
    door: true,
    accents: (g, top) => {
      g.lineStyle(3, GOLD, 1); // scaffolding
      g.strokeRect(CX - 30, top - 2, 60, 46);
      g.lineBetween(CX - 30, top - 2, CX + 30, top + 44);
      g.lineBetween(CX + 30, top - 2, CX - 30, top + 44);
      g.fillStyle(0xfbbf24, 1);
      g.fillRect(CX - 34, top - 8, 68, 5); // crane beam
    },
  },
};

/** Build all landmark textures from real materials. Idempotent + fault-isolated. */
export function composeLandmarks(scene: Phaser.Scene): void {
  for (const type of ALL_LANDMARK_TYPES) {
    const key = landmarkSprite(type);
    if (scene.textures.exists(key)) continue;
    const spec = SPECS[type];
    if (!spec) continue;
    // Require the wall material; otherwise leave to procedural fallback.
    if (!scene.textures.exists(spec.wall)) continue;
    try {
      composeOne(scene, key, spec);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[assets] landmark compose failed for ${key}; using fallback`, err);
    }
  }
}

function composeOne(scene: Phaser.Scene, key: string, spec: LandmarkSpec): void {
  const bodyTopY = BASE_Y - spec.bodyH;
  const rt = scene.make.renderTexture({ width: W, height: H }, false);

  // Ground shadow.
  const shadow = scene.make.graphics({ x: 0, y: 0 }, false);
  shadow.fillStyle(0x000000, 0.18);
  shadow.fillEllipse(CX, BASE_Y, spec.bodyW * 0.95, 12);
  rt.draw(shadow);
  shadow.destroy();

  // Wall body (real Cainos material, stretched to the body rect).
  const wall = scene.make.image({ x: 0, y: 0, key: spec.wall, add: false });
  wall.setOrigin(0, 0).setDisplaySize(spec.bodyW, spec.bodyH);
  rt.draw(wall, CX - spec.bodyW / 2, bodyTopY);
  wall.destroy();

  // Body outline + roof/topper accents.
  const accents = scene.make.graphics({ x: 0, y: 0 }, false);
  accents.lineStyle(2, 0x0b1020, 0.5);
  accents.strokeRect(CX - spec.bodyW / 2, bodyTopY, spec.bodyW, spec.bodyH);
  spec.accents(accents, bodyTopY);
  rt.draw(accents);
  accents.destroy();

  // Door (real Cainos door at the base centre).
  if (spec.door && scene.textures.exists("cainos_door")) {
    const door = scene.make.image({ x: 0, y: 0, key: "cainos_door", add: false });
    door.setOrigin(0, 0).setDisplaySize(20, 26);
    rt.draw(door, CX - 10, BASE_Y - 26);
    door.destroy();
  }

  rt.saveTexture(key);
}
