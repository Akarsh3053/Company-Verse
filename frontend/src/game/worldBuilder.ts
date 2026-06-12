// ─────────────────────────────────────────────────────────────────────────────
// World builder — turns a GameBundle's world data into Phaser tilemaps, sprites,
// and colliders (frontend.md §8). Everything is data-driven: region patches are
// tinted biome ground, connections are roads/bridges between region centres,
// landmarks and NPCs are placed at their pixel positions. Unknown enum values
// fall back to defaults (never crash).
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { GameBundle, Region } from "@/types/bundle";
import {
  REGION_TILE_RADIUS,
  TILE_SIZE,
  biomePalette,
  biomeTileset,
} from "./assetMap";
import { NpcEntity } from "./entities/NpcEntity";
import { LandmarkEntity } from "./entities/LandmarkEntity";
import { computeWorldBounds, type WorldBounds } from "./worldGeometry";

// Fixed background depths (entities use depth = y for correct overlap).
const DEPTH_BASE = -100000;
const DEPTH_REGION = -90000;
const DEPTH_CONNECTION = -80000;
const DEPTH_NEXUS = -70000;
const DEPTH_REGION_LABEL = 50000;

const REGION_RADIUS = REGION_TILE_RADIUS * TILE_SIZE;

function hexToNumber(hex: string, fallback = 0x4a90d9): number {
  const cleaned = hex.replace("#", "");
  const parsed = Number.parseInt(cleaned, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export interface BuiltWorld {
  bounds: WorldBounds;
  npcs: NpcEntity[];
  landmarks: LandmarkEntity[];
  regionAt: (x: number, y: number) => Region | null;
}

export function buildWorld(scene: Phaser.Scene, bundle: GameBundle): BuiltWorld {
  const { world } = bundle;
  const bounds = computeWorldBounds(world);

  // ── Base ground: a frontier sea the regions sit on. ───────────────────────
  scene.add
    .tileSprite(bounds.minX, bounds.minY, bounds.width, bounds.height, "tiles_frontier")
    .setOrigin(0, 0)
    .setDepth(DEPTH_BASE)
    .setTint(0x3a4a3a);

  // ── Region patches (rounded plots of biome ground, tinted by color). ───────
  const regionById = new Map(world.regions.map((r) => [r.id, r]));
  for (const region of world.regions) {
    paintRegion(scene, region);
  }

  // ── Connections (roads/bridges between region centres). ────────────────────
  for (const conn of world.connections) {
    const a = regionById.get(conn.source);
    const b = regionById.get(conn.target);
    if (!a || !b) continue; // unresolved reference → skip gracefully
    drawConnection(scene, a, b, conn.type);
  }

  // ── Nexus (company HQ plaza) at the world spawn. ───────────────────────────
  drawNexus(scene, world.spawn.x, world.spawn.y, world.metadata.company_name);

  // ── Landmarks. ─────────────────────────────────────────────────────────────
  const landmarks: LandmarkEntity[] = [];
  for (const region of world.regions) {
    for (const lm of region.landmarks) {
      landmarks.push(
        new LandmarkEntity(scene, lm, region, lm.position.x, lm.position.y),
      );
    }
  }

  // ── NPCs (placed in their region; spread to avoid overlap). ────────────────
  const npcs: NpcEntity[] = [];
  const perRegionIndex = new Map<string, number>();
  const perRegionCount = new Map<string, number>();
  for (const npc of bundle.npcs) {
    perRegionCount.set(npc.region_id, (perRegionCount.get(npc.region_id) ?? 0) + 1);
  }
  for (const npc of bundle.npcs) {
    const region = regionById.get(npc.region_id);
    if (!region) continue; // unresolved region → skip gracefully
    const idx = perRegionIndex.get(npc.region_id) ?? 0;
    perRegionIndex.set(npc.region_id, idx + 1);
    const count = perRegionCount.get(npc.region_id) ?? 1;
    const { x, y } = npcSlot(region, idx, count);
    npcs.push(new NpcEntity(scene, npc, x, y));
  }

  const regionAt = (x: number, y: number): Region | null => {
    let best: Region | null = null;
    let bestDist = REGION_RADIUS;
    for (const region of world.regions) {
      const d = Phaser.Math.Distance.Between(x, y, region.position.x, region.position.y);
      if (d < bestDist) {
        bestDist = d;
        best = region;
      }
    }
    return best;
  };

  return { bounds, npcs, landmarks, regionAt };
}

function paintRegion(scene: Phaser.Scene, region: Region): void {
  const tint = hexToNumber(region.color);
  const size = REGION_RADIUS * 2;
  const x = region.position.x;
  const y = region.position.y;

  // Rounded plot border (slightly larger, darker) for a "tile plot" frame.
  const border = scene.add.graphics().setDepth(DEPTH_REGION - 1);
  border.fillStyle(Phaser.Display.Color.IntegerToColor(tint).darken(40).color, 1);
  border.fillRoundedRect(x - REGION_RADIUS - 6, y - REGION_RADIUS - 6, size + 12, size + 12, 26);

  // Biome ground, masked to a rounded rect, tinted toward region.color.
  const ground = scene.add
    .tileSprite(x, y, size, size, biomeTileset(region.biome))
    .setDepth(DEPTH_REGION)
    .setTint(tint);
  ground.setAlpha(0.96);

  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff);
  maskShape.fillRoundedRect(x - REGION_RADIUS, y - REGION_RADIUS, size, size, 22);
  ground.setMask(maskShape.createGeometryMask());

  // Decorative props (palette colour) scattered within the plot.
  const palette = biomePalette(region.biome);
  const rand = mulberry(region.id);
  const props = scene.add.graphics().setDepth(DEPTH_REGION + 1);
  for (let i = 0; i < 10; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = rand() * (REGION_RADIUS - 40);
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;
    props.fillStyle(palette.prop, 0.85);
    props.fillCircle(px, py, 3 + rand() * 3);
  }

  // Region label (icon + name) near the top of the plot.
  const label = scene.add
    .text(x, y - REGION_RADIUS + 14, `${region.icon} ${region.name}`, {
      fontFamily: "monospace",
      fontSize: "15px",
      color: "#ffffff",
      align: "center",
      stroke: "#0b1020",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(DEPTH_REGION_LABEL);
  label.setShadow(0, 2, "#000000", 3, true, true);
}

function drawConnection(
  scene: Phaser.Scene,
  a: Region,
  b: Region,
  type: "road" | "bridge",
): void {
  const g = scene.add.graphics().setDepth(DEPTH_CONNECTION);
  const color = type === "bridge" ? 0x8b5a2b : 0xb9986a;
  const edge = type === "bridge" ? 0x6b421f : 0x8a6a3c;
  // Outline then fill for a path with borders.
  g.lineStyle(26, edge, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
  g.lineStyle(18, color, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
  if (type === "bridge") {
    // Plank ticks across the bridge.
    g.lineStyle(2, edge, 1);
    const steps = Math.max(2, Math.floor(Phaser.Math.Distance.Between(a.position.x, a.position.y, b.position.x, b.position.y) / 16));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const mx = Phaser.Math.Linear(a.position.x, b.position.x, t);
      const my = Phaser.Math.Linear(a.position.y, b.position.y, t);
      const ang = Phaser.Math.Angle.Between(a.position.x, a.position.y, b.position.x, b.position.y) + Math.PI / 2;
      g.lineBetween(mx - Math.cos(ang) * 9, my - Math.sin(ang) * 9, mx + Math.cos(ang) * 9, my + Math.sin(ang) * 9);
    }
  }
}

function drawNexus(scene: Phaser.Scene, x: number, y: number, company: string): void {
  const size = TILE_SIZE * 5;
  scene.add
    .tileSprite(x, y, size, size, "tile_nexus")
    .setDepth(DEPTH_NEXUS);
  scene.add
    .text(x, y - size / 2 - 6, `★ ${company} HQ`, {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#facc15",
      align: "center",
      stroke: "#0b1020",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 1)
    .setDepth(DEPTH_REGION_LABEL);
}

/** Place an NPC on a ring inside its region, spread evenly to avoid overlap. */
function npcSlot(
  region: Region,
  index: number,
  count: number,
): { x: number; y: number } {
  if (count <= 1) {
    return { x: region.position.x, y: region.position.y + 40 };
  }
  const ringRadius = REGION_RADIUS * 0.5;
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: region.position.x + Math.cos(angle) * ringRadius,
    y: region.position.y + Math.sin(angle) * ringRadius,
  };
}

/** Tiny deterministic PRNG seeded from a region id (stable decoration layout). */
function mulberry(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
