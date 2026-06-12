// ─────────────────────────────────────────────────────────────────────────────
// Phaser game factory. One game instance owns the <canvas>; the bundle is handed
// to scenes via the registry. Pixel-art rendering, arcade physics, RESIZE scale
// so the canvas always fills its parent.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { GameBundle } from "@/types/bundle";
import { BootScene } from "./scenes/BootScene";
import { OverworldScene } from "./scenes/OverworldScene";

export function createGame(parent: HTMLElement, bundle: GameBundle): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#0b1020",
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 600,
    },
    physics: {
      default: "arcade",
      arcade: { debug: false },
    },
    scene: [BootScene, OverworldScene],
  });

  // Scenes read this synchronously in create() (runs on a later tick).
  game.registry.set("bundle", bundle);
  return game;
}
