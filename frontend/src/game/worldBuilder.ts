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
import { BIOME_PROPS, WILDERNESS_TREES } from "./assets/manifest";
import { NpcEntity } from "./entities/NpcEntity";
import { LandmarkEntity } from "./entities/LandmarkEntity";
import { computeWorldBounds, REGION_PIXEL_RADIUS, type WorldBounds } from "./worldGeometry";

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
  const homeRegionId = bundle.player.home_region_id;
  const bounds = computeWorldBounds(world);

  // ── Base ground: a warm earthy overworld that makes the whole map feel like ──
  // countryside between towns, not a dark void. Regions and the nexus sit on top.
  // Layer 1: solid warm earth base colour.
  scene.add
    .rectangle(
      bounds.minX + bounds.width / 2,
      bounds.minY + bounds.height / 2,
      bounds.width,
      bounds.height,
      0x3d3520,          // warm dark-earth brown
    )
    .setDepth(DEPTH_BASE - 1);
  // Layer 2: dirt tile overlay for texture, visible alpha.
  scene.add
    .tileSprite(bounds.minX, bounds.minY, bounds.width, bounds.height, biomeTileset("citadel"))
    .setOrigin(0, 0)
    .setDepth(DEPTH_BASE)
    .setAlpha(0.55)      // enough to read the texture
    .setTint(0x6b5a2a); // warm earthy tint

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
    paintRegion(scene, region, region.id === homeRegionId);
  }

  // ── Nexus (company HQ plaza) at the world spawn. ───────────────────────────
  drawNexus(scene, world.spawn.x, world.spawn.y, world.metadata.company_name);
  // ── Wilderness: dense tree border ringing the whole world. ────────────────
  plantWilderness(scene, bounds, world.metadata.world_id);
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

function paintRegion(scene: Phaser.Scene, region: Region, isHome = false): void {
  const tint = hexToNumber(region.color);
  // Home region is 30% larger than normal regions, making it visually dominant.
  const radiusMult = isHome ? 1.3 : 1.0;
  const R = REGION_RADIUS * radiusMult;
  const size = R * 2;
  const x = region.position.x;
  const y = region.position.y;

  // Rounded plot border (slightly larger, darker) for a "tile plot" frame.
  const border = scene.add.graphics().setDepth(DEPTH_REGION - 1);
  border.fillStyle(Phaser.Display.Color.IntegerToColor(tint).darken(40).color, 1);
  border.fillRoundedRect(x - R - 6, y - R - 6, size + 12, size + 12, 26);

  // Home region: add a gold outer glow ring to distinguish it at a glance.
  if (isHome) {
    const glow = scene.add.graphics().setDepth(DEPTH_REGION - 2);
    glow.lineStyle(8, 0xfacc15, 0.55);
    glow.strokeRoundedRect(x - R - 16, y - R - 16, size + 32, size + 32, 32);
    glow.lineStyle(4, 0xfde68a, 0.3);
    glow.strokeRoundedRect(x - R - 24, y - R - 24, size + 48, size + 48, 36);
  }

  // Shared rounded-rect mask for the ground + colour overlay.
  const maskShape = scene.make.graphics({}, false);
  maskShape.fillStyle(0xffffff);
  maskShape.fillRoundedRect(x - R, y - R, size, size, 22);
  const mask = maskShape.createGeometryMask();

  // Biome ground at its NATURAL colour (real terrain tiles or procedural).
  const ground = scene.add
    .tileSprite(x, y, size, size, biomeTileset(region.biome))
    .setDepth(DEPTH_REGION);
  ground.setMask(mask);

  // Colour wash: home region brighter (0.28 alpha) so it reads as special.
  const overlayAlpha = isHome ? 0.28 : 0.16;
  const overlay = scene.add
    .rectangle(x, y, size, size, tint, overlayAlpha)
    .setDepth(DEPTH_REGION + 1);
  overlay.setMask(mask);

  // Phase 4B: Soft circular edge — a radial gradient circle blends the biome
  // into the surrounding wilderness instead of a hard rectangular cutoff.
  // Painted as concentric circles at DEPTH_REGION, outside the mask radius.
  paintRegionEdgeGlow(scene, x, y, R, tint);

  // Phase 4A: Dense ground-cover interior — 80 tiny props in the inner zone
  // (5–38% radius) so the region interior doesn’t look like an empty field.
  placeGroundCover(scene, region, x, y, R);

  // Outer ring props (existing: 24 items at 42–98% radius).
  placeRegionProps(scene, region, x, y, R);

  // Region label (icon + name) near the top of the plot.
  // Home region label is larger and gold to immediately catch the eye.
  const labelColor = isHome ? "#facc15" : "#ffffff";
  const labelSize = isHome ? "18px" : "15px";
  const label = scene.add
    .text(x, y - R + 14, `${region.icon} ${region.name}${isHome ? " ★" : ""}`, {
      fontFamily: "monospace",
      fontSize: labelSize,
      color: labelColor,
      align: "center",
      stroke: "#0b1020",
      strokeThickness: isHome ? 5 : 4,
    })
    .setOrigin(0.5, 0.5)
    .setDepth(DEPTH_REGION_LABEL);
  label.setShadow(0, 2, "#000000", 3, true, true);
}

/** Scatter biome-appropriate prop sprites — outer ring only (existing 24 items). */
function placeRegionProps(
  scene: Phaser.Scene,
  region: Region,
  x: number,
  y: number,
  R = REGION_RADIUS,
): void {
  const specs = BIOME_PROPS[region.biome] ?? BIOME_PROPS.frontier ?? [];
  if (!specs.length) return;
  const rand = mulberry(region.id);
  // 24 props: inner ring (60-80% radius) and outer fringe (85-98% radius).
  const INNER = 16;
  const OUTER = 8;
  for (let i = 0; i < INNER + OUTER; i++) {
    const outer = i >= INNER;
    const minR = outer ? 0.85 : 0.42;
    const maxR = outer ? 0.98 : 0.78;
    const angle = rand() * Math.PI * 2;
    const dist = R * (minR + rand() * (maxR - minR));
    const px = x + Math.cos(angle) * dist;
    const py = y + Math.sin(angle) * dist;

    const spec = specs[Math.floor(rand() * specs.length)];
    if (spec && scene.textures.exists(spec.key)) {
      const img = scene.add.image(px, py, spec.key).setOrigin(0.5, 0.96).setDepth(py);
      const src = scene.textures.get(spec.key).getSourceImage() as { height: number };
      // Outer fringe props slightly smaller for depth perspective.
      const sizeAdj = outer ? 0.85 : 1.0;
      const scale = (spec.height / (src.height || spec.height)) * sizeAdj;
      img.setScale(scale);
    } else {
      const g = scene.add.graphics().setDepth(DEPTH_REGION + 2);
      g.fillStyle(biomePalette(region.biome).prop, 0.85);
      g.fillCircle(px, py, 3 + rand() * 3);
    }
  }
}

/**
 * Phase 4A: Dense ground-cover pass — 80 tiny props (grass tufts, small flowers,
 * pebbles) scattered across the interior of the region (5–38% radius).
 * Uses props that are visually small so they don’t compete with NPCs.
 */
function placeGroundCover(
  scene: Phaser.Scene,
  region: Region,
  cx: number,
  cy: number,
  R: number,
): void {
  // Ground-cover specs per biome: very small items only.
  const COVER_SPECS: Record<string, Array<{ key: string; h: number }>> = {
    valley:    [{ key: "prop_grass", h: 14 }, { key: "prop_flower_white", h: 14 }, { key: "prop_flower_yellow", h: 14 }],
    highlands: [{ key: "prop_grass", h: 14 }, { key: "prop_flower_yellow", h: 14 }],
    glades:    [{ key: "prop_flower_purple", h: 14 }, { key: "prop_flower_white", h: 14 }, { key: "prop_mushroom", h: 16 }],
    sanctuary: [{ key: "prop_flower_white", h: 14 }, { key: "prop_flower_yellow", h: 14 }, { key: "prop_flower_purple", h: 14 }],
    harbor:    [{ key: "prop_grass", h: 12 }],
    citadel:   [{ key: "prop_rock_gray", h: 12 }, { key: "prop_steprock", h: 12 }],
    mountains: [{ key: "prop_rock_gray", h: 16 }, { key: "prop_steprock", h: 14 }],
    bazaar:    [{ key: "prop_rock_brown", h: 12 }],
    frontier:  [{ key: "prop_mushroom_evil", h: 14 }],
  };
  const specs = COVER_SPECS[region.biome] ?? COVER_SPECS.valley;
  const rand = mulberry(region.id + ":cover");
  for (let i = 0; i < 80; i++) {
    const angle = rand() * Math.PI * 2;
    const dist = R * (0.05 + rand() * 0.33); // 5–38% of radius (inner zone)
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const spec = specs[Math.floor(rand() * specs.length)];
    if (!scene.textures.exists(spec.key)) continue;
    const img = scene.add.image(px, py, spec.key).setOrigin(0.5, 0.96).setDepth(py - 0.5);
    const src = scene.textures.get(spec.key).getSourceImage() as { height: number };
    img.setScale((spec.h / (src.height || spec.h)) * (0.6 + rand() * 0.4));
    img.setAlpha(0.55 + rand() * 0.35); // slightly transparent so terrain reads through
  }
}

/**
 * Phase 4B: Soft circular glow around the region edge — concentric circles
 * fading from the biome colour outward into transparency so biomes blend into
 * the wilderness instead of hard-cutting.
 */
function paintRegionEdgeGlow(
  scene: Phaser.Scene,
  cx: number,
  cy: number,
  R: number,
  tint: number,
): void {
  const g = scene.add.graphics().setDepth(DEPTH_REGION - 1);
  // 5 concentric circles, each slightly outside the region, decreasing alpha.
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    const radius = R + i * 12;
    const alpha = 0.22 - i * 0.04; // 0.18 -> 0.02
    if (alpha <= 0) break;
    g.lineStyle(14, tint, alpha);
    g.strokeCircle(cx, cy, radius);
  }
}

function drawConnection(
  scene: Phaser.Scene,
  a: Region,
  b: Region,
  type: "road" | "bridge",
): void {
  const g = scene.add.graphics().setDepth(DEPTH_CONNECTION);
  const border = type === "bridge" ? 0x3d2008 : 0x4a3010;
  const fill = type === "bridge" ? 0x7a5520 : 0xa07840;
  const edge = type === "bridge" ? 0x5a3510 : 0x705828;

  // Road shadow.
  g.lineStyle(14, 0x1a1008, 0.35);
  g.lineBetween(a.position.x, a.position.y + 3, b.position.x, b.position.y + 3);
  // Road border.
  g.lineStyle(12, border, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);
  // Road fill.
  g.lineStyle(7, fill, 1);
  g.lineBetween(a.position.x, a.position.y, b.position.x, b.position.y);

  // Dashes along the road centre for a Pokémon-style dirt path texture.
  const dist = Phaser.Math.Distance.Between(a.position.x, a.position.y, b.position.x, b.position.y);
  const steps = Math.max(2, Math.floor(dist / 28));
  g.lineStyle(1.5, edge, 0.55);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const mx = Phaser.Math.Linear(a.position.x, b.position.x, t);
    const my = Phaser.Math.Linear(a.position.y, b.position.y, t);
    const ang = Phaser.Math.Angle.Between(a.position.x, a.position.y, b.position.x, b.position.y);
    const perp = ang + Math.PI / 2;
    // Perpendicular dash mark every 28px.
    if (i % 2 === 0) {
      g.lineBetween(
        mx + Math.cos(perp) * 2.5, my + Math.sin(perp) * 2.5,
        mx - Math.cos(perp) * 2.5, my - Math.sin(perp) * 2.5,
      );
    }
  }
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

// ── Depth for wilderness props (below region patches but above connection lines) ──
const DEPTH_WILDERNESS = -92000;

/**
 * Plant 80 trees/bushes around the outer boundary of the world — rings the map
 * with a dense forest border so it feels bounded like a Pokémon route.
 * Seeded from world_id for stability across re-renders.
 */
function plantWilderness(
  scene: Phaser.Scene,
  bounds: WorldBounds,
  seed: string,
): void {
  const rand = mulberry(seed + ":wilderness");
  const cx = bounds.minX + bounds.width / 2;
  const cy = bounds.minY + bounds.height / 2;
  const hw = bounds.width / 2;
  const hh = bounds.height / 2;
  // Inner safe radius: don't plant inside the region ring.
  const SAFE_R = 480;

  const placed: Array<{ x: number; y: number }> = [];

  for (let attempt = 0; attempt < 800 && placed.length < 90; attempt++) {
    // Random position anywhere in the world bounds.
    const px = bounds.minX + rand() * bounds.width;
    const py = bounds.minY + rand() * bounds.height;

    // Skip if inside the central safe zone (regions + nexus).
    const dCenter = Math.hypot(px - cx, py - cy);
    if (dCenter < SAFE_R) continue;

    // Skip if within the padding strip that's purely off-screen.
    const fromEdgeX = Math.min(px - bounds.minX, bounds.maxX - px);
    const fromEdgeY = Math.min(py - bounds.minY, bounds.maxY - py);
    if (fromEdgeX > 120 && fromEdgeY > 120) continue; // only near the outer edge

    // Avoid clustering: keep at least 50px from any already-placed tree.
    const tooClose = placed.some((p) => Math.hypot(p.x - px, p.y - py) < 50);
    if (tooClose) continue;

    placed.push({ x: px, y: py });
    const spec = WILDERNESS_TREES[Math.floor(rand() * WILDERNESS_TREES.length)];
    if (!scene.textures.exists(spec.key)) continue;
    const img = scene.add.image(px, py, spec.key).setOrigin(0.5, 0.96).setDepth(DEPTH_WILDERNESS);
    const src = scene.textures.get(spec.key).getSourceImage() as { height: number };
    const baseScale = spec.height / (src.height || spec.height);
    // Slight random scale variation for natural look.
    img.setScale(baseScale * (0.85 + rand() * 0.3));
  }

  // Also ring the outer edge with a second denser pass of small bushes/rocks.
  for (let attempt = 0; attempt < 600 && placed.length < 160; attempt++) {
    const edge = Math.floor(rand() * 4);
    let px: number, py: number;
    const margin = 30 + rand() * 60;
    if (edge === 0) { px = bounds.minX + margin; py = bounds.minY + rand() * bounds.height; }
    else if (edge === 1) { px = bounds.maxX - margin; py = bounds.minY + rand() * bounds.height; }
    else if (edge === 2) { px = bounds.minX + rand() * bounds.width; py = bounds.minY + margin; }
    else { px = bounds.minX + rand() * bounds.width; py = bounds.maxY - margin; }

    const tooClose = placed.some((p) => Math.hypot(p.x - px, p.y - py) < 40);
    if (tooClose) continue;

    placed.push({ x: px, y: py });
    // Alternate between tall and medium trees for depth layering.
    const key = rand() < 0.6 ? "prop_tree_autumn" : rand() < 0.5 ? "prop_tree_olive" : "prop_bush_tall";
    if (!scene.textures.exists(key)) continue;
    const img = scene.add.image(px, py, key).setOrigin(0.5, 0.96).setDepth(DEPTH_WILDERNESS + 1);
    const src = scene.textures.get(key).getSourceImage() as { height: number };
    img.setScale((72 / (src.height || 72)) * (0.8 + rand() * 0.35));
  }

  // Suppress unused-variable lint for the geometry helpers.
  void hw; void hh;
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
