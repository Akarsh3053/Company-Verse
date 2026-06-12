// ─────────────────────────────────────────────────────────────────────────────
// World geometry helpers (frontend.md §8.1). Positions are pixels. World bounds
// are computed from the min/max of all region + landmark positions (plus
// padding) so ANY region count fits — never assume fixed bounds.
// ─────────────────────────────────────────────────────────────────────────────

import type { World } from "@/types/bundle";
import { REGION_TILE_RADIUS, TILE_SIZE } from "./assetMap";

export interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

const REGION_RADIUS_PX = REGION_TILE_RADIUS * TILE_SIZE;
const PADDING = TILE_SIZE * 6;

/** Compute world bounds from region + landmark positions and the spawn point. */
export function computeWorldBounds(world: World): WorldBounds {
  let minX = world.spawn.x;
  let minY = world.spawn.y;
  let maxX = world.spawn.x;
  let maxY = world.spawn.y;

  const consider = (x: number, y: number, margin: number) => {
    minX = Math.min(minX, x - margin);
    minY = Math.min(minY, y - margin);
    maxX = Math.max(maxX, x + margin);
    maxY = Math.max(maxY, y + margin);
  };

  for (const region of world.regions) {
    consider(region.position.x, region.position.y, REGION_RADIUS_PX);
    for (const lm of region.landmarks) {
      consider(lm.position.x, lm.position.y, TILE_SIZE * 2);
    }
  }

  minX -= PADDING;
  minY -= PADDING;
  maxX += PADDING;
  maxY += PADDING;

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export const REGION_PIXEL_RADIUS = REGION_RADIUS_PX;

/** Snap a pixel coordinate to the nearest tile centre (for tile painting). */
export function snapToTile(value: number): number {
  return Math.round(value / TILE_SIZE) * TILE_SIZE;
}
