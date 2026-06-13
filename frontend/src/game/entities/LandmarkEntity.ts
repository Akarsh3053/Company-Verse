// ─────────────────────────────────────────────────────────────────────────────
// Landmark entity — a placed point-of-interest sprite (built from a real system
// or project). Carries an optional status pip from metadata.status and a
// proximity label. Walking onto it opens an info card (handled by the scene).
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { Landmark, Region } from "@/types/bundle";
import { landmarkSprite } from "../assetMap";

function statusPipKey(status: string | undefined): string | null {
  if (!status) return null;
  const s = status.toLowerCase();
  if (/(down|outage|critical|red|offline|fail)/.test(s)) return "pip_red";
  if (/(degraded|warn|amber|partial|maintenance)/.test(s)) return "pip_amber";
  if (/(operational|healthy|ok|green|online|stable|active)/.test(s)) return "pip_green";
  return null;
}

export class LandmarkEntity {
  readonly landmark: Landmark;
  readonly region: Region | null;
  readonly sprite: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    landmark: Landmark,
    region: Region | null,
    x: number,
    y: number,
  ) {
    this.landmark = landmark;
    this.region = region;

    // Phase 4D: Ground platform — a biome-coloured ellipse underneath the
    // landmark sprite so buildings look grounded, not floating on the terrain.
    const platformColor = region ? parseInt(region.color.replace("#", ""), 16) : 0x6b7060;
    const platformGraphics = scene.add.graphics().setDepth(y - 2);
    platformGraphics.fillStyle(platformColor, 0.45);
    platformGraphics.fillEllipse(x, y + 4, 80, 28);
    platformGraphics.fillStyle(0x000000, 0.18);
    platformGraphics.fillEllipse(x, y + 8, 70, 16); // shadow

    this.sprite = scene.add
      .image(x, y, landmarkSprite(landmark.landmark_type))
      .setOrigin(0.5, 0.9)
      .setDepth(y);

    // Status pip (top-right of the sprite) if metadata declares one.
    const pip = statusPipKey(landmark.metadata?.status);
    if (pip) {
      scene.add
        .image(x + 18, y - this.sprite.height * 0.8, pip)
        .setDepth(y + 1);
    }

    // Proximity label.
    const text = scene.add
      .text(0, 0, landmark.name, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#fde68a",
        align: "center",
      })
      .setOrigin(0.5, 1);
    const bg = scene.add
      .rectangle(0, 2, text.width + 12, text.height + 6, 0x0b1020, 0.82)
      .setStrokeStyle(2, 0xa8801a, 1)
      .setOrigin(0.5, 1);
    this.label = scene.add
      .container(x, y - this.sprite.height * 0.78, [bg, text])
      .setDepth(100000)
      .setVisible(false);
  }

  setNearby(nearby: boolean): void {
    this.label.setVisible(nearby);
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }
}
