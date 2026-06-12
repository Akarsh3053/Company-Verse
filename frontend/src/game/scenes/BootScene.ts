// ─────────────────────────────────────────────────────────────────────────────
// BootScene — generates every procedural texture, then starts the overworld.
// No external asset loading; all art is baked at runtime (textures.ts).
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import { generateAllTextures } from "../textures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    generateAllTextures(this);
    this.scene.start("Overworld");
  }
}
