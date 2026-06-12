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
import { BIOME_PROPS } from "./assets/manifest";
import { NpcEntity } from "./entities/NpcEntity";
import { LandmarkEntity } from "./entities/LandmarkEntity";
import { computeWorldBounds, type WorldBounds } from "./worldGeometry";

// Depth ordering (higher = in front). Connections MUST be below region patches
// so paths only appear between regions, not over them.
const DEPTH_BASE = -100000;
const DEPTH_CONNECTION = -95000; // below regions — paths show only between region patches
const DEPTH_REGION = -90000;    // region patches cover the connection ends
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

  // ── Base ground: neutral overworld dirt—makes the whole world walkable (“country- ──
  // side between towns”, not a void). Regions and the nexus paint on top.
  scene.add
    .tileSprite(bounds.minX, bounds.minY, bounds.width, bounds.height, biomeTileset("citadel"))
    .setOrigin(0, 0)
    .setDepth(DEPTH_BASE)
    .setAlpha(0.22);
  scene.add
    .rectangle(
      bounds.minX + bounds.width / 2,
      bounds.minY + bounds.height / 2,
      bounds.width,
      bounds.height,
      0x141c0e,
    )
    .setDepth(DEPTH_BASE - 1);

  // ── Connections first so region patches cover them at their ends. ──────────
  const regionById = new Map(world.regions.map((r) => [r.id, r]));
  for (const conn of world.connections) {
    const a = regionById.get(conn.source);
    const b = regionById.get(conn.target);
    if (!a || !b) continue; // unresolved reference → skip gracefully
    drawConnection(scene, a, b, conn.type);
  }

  // ── Region patches (drawn AFTER connections, covering path ends). ──────────
  for (const region of world.regions) {
    paintRegion(scene, region);
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

  // Shared rounded-rect mask for the ground + colour overlay.
  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff);
  maskShape.fillRoundedRect(x - REGION_RADIUS, y - REGION_RADIUS, size, size, 22);
  const mask = maskShape.createGeometryMask();

  // Biome ground at its NATURAL colour (real terrain tiles or procedural).
  const ground = scene.add
    .tileSprite(x, y, size, size, biomeTileset(region.biome))
    .setDepth(DEPTH_REGION);
  ground.setMask(mask);

  // Subtle region-colour wash for identity (keeps terrain readable, unlike a
  // full multiply tint which muddies real art).
  const overlay = scene.add
    .rectangle(x, y, size, size, tint, 0.16)
    .setDepth(DEPTH_REGION + 1);
  overlay.setMask(mask);

  // Decorative props scattered in an outer ring (avoid the central NPC ring).
  placeRegionProps(scene, region, x, y);

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

/** Scatter biome-appropriate prop sprites (real art, scaled), or dots if missing. */
function placeRegionProps(
  scene: Phaser.Scene,
  region: Region,
  x: number,
  y: number,
): void {
  const specs = BIOME_PROPS[region.biome] ?? BIOME_PROPS.frontier ?? [];
  const rand = mulberry(region.id);
  const count = 8;
  for (let i = 0; i < count; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = REGION_RADIUS * (0.6 + rand() * 0.34);
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;

    const spec = specs.length ? specs[Math.floor(rand() * specs.length)] : null;
    if (spec && scene.textures.exists(spec.key)) {
      const img = scene.add.image(px, py, spec.key).setOrigin(0.5, 0.96).setDepth(py);
      const src = scene.textures.get(spec.key).getSourceImage() as { height: number };
      const scale = spec.height / (src.height || spec.height);
      img.setScale(scale);
    } else {
      // Procedural fallback: a small palette-coloured dot.
      const g = scene.add.graphics().setDepth(DEPTH_REGION + 2);
      g.fillStyle(biomePalette(region.biome).prop, 0.85);
      g.fillCircle(px, py, 3 + rand() * 3);
    }
  }
}

function drawConnection(
  scene: Phaser.Scene,
  a: Region,
  b: Region,
  type: "road" | "bridge",
): void {
  const g = scene.add.graphics().setDepth(DEPTH_CONNECTION);
  // Thin, clean paths. Region patches (depth DEPTH_REGION) sit on top, so the
  // path is only visible in the open land between region circles.
  const border = type === "bridge" ? 0x3d2008 : 0x4a3010;
  const fill = type === "bridge" ? 0x7a5520 : 0xa07840;
  g.lineStyle(10, border, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
  g.lineStyle(6, fill, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
}

function drawNexus(scene: Phaser.Scene, x: number, y: number, company: string): void {
  // 460px radius covers all diagonal gaps between the 8 ring regions.
  const HUB_R = 460;
  const g = scene.add.graphics().setDepth(DEPTH_NEXUS);

  // Outer glow.
  g.fillStyle(0xd4a826, 0.06);
  g.fillCircle(x, y, HUB_R + 32);

  // Stone plaza.
  g.fillStyle(0x7a7060, 1);
  g.fillCircle(x, y, HUB_R);

  // Cobblestone grid.
  g.lineStyle(1, 0x5a5048, 0.5);
  const GRID = 40;
  for (let gx = x - HUB_R; gx <= x + HUB_R; gx += GRID) {
    const dy = Math.sqrt(Math.max(0, HUB_R * HUB_R - (gx - x) * (gx - x)));
    g.lineBetween(gx, y - dy, gx, y + dy);
  }
  for (let gy = y - HUB_R; gy <= y + HUB_R; gy += GRID) {
    const dx = Math.sqrt(Math.max(0, HUB_R * HUB_R - (gy - y) * (gy - y)));
    g.lineBetween(x - dx, gy, x + dx, gy);
  }

  // Gold border.
  g.lineStyle(5, 0xd4a826, 0.85);
  g.strokeCircle(x, y, HUB_R);

  // Company name.
  scene.add
    .text(x, y - 14, company, {
      fontFamily: "monospace",
      fontSize: "17px",
      color: "#facc15",
      align: "center",
      stroke: "#0b1020",
      strokeThickness: 5,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(DEPTH_NEXUS + 1);
  scene.add
    .text(x, y + 10, "HQ \u2605", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#fde68a",
      align: "center",
      stroke: "#0b1020",
      strokeThickness: 4,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(DEPTH_NEXUS + 1);
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
