// ─────────────────────────────────────────────────────────────────────────────
// BootScene — loads real art, builds character animations, then bakes any
// missing textures procedurally as a fallback, and starts the overworld.
//
// Load order matters: real images are queued in preload(); in create() we build
// walk anims from them, THEN call generateAllTextures() which skips any key that
// already exists — so real art wins and procedural fills the gaps.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import { generateAllTextures } from "../textures";
import { queueRealAssets, registerCharacterAnimations } from "../assets/realAssets";
import { composeLandmarks } from "../assets/landmarkComposer";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // A minimal loading bar so the (brief) asset load isn't a black screen.
    const { width, height } = this.scale;
    this.add
      .rectangle(width / 2, height / 2, 240, 16, 0x1e2742)
      .setStrokeStyle(2, 0x3b4a78);
    const bar = this.add
      .rectangle(width / 2 - 116, height / 2, 4, 10, 0xfacc15)
      .setOrigin(0, 0.5);
    this.add
      .text(width / 2, height / 2 - 26, "Loading assets…", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#e5e7eb",
      })
      .setOrigin(0.5);

    this.load.on("progress", (p: number) => {
      bar.width = 4 + 228 * p;
    });

    queueRealAssets(this);
  }

  create(): void {
    registerCharacterAnimations(this);
    // Compose landmark textures from real materials (before the procedural
    // fallback, so generateAllTextures only fills any type that failed here).
    composeLandmarks(this);
    // Procedural fallback for any texture key not already loaded.
    generateAllTextures(this);
    this.scene.start("Overworld");
  }
}
