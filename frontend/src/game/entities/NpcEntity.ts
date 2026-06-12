// ─────────────────────────────────────────────────────────────────────────────
// NPC entity — a character sprite placed in its region, with a proximity
// nameplate and a quest indicator (❗ available · ❓ active · ✔ complete) driven
// by gameplay state. Non-blocking: interaction is by proximity (see scene).
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { NPC } from "@/types/bundle";
import { npcSprite } from "../assetMap";

const INDICATOR_GLYPH: Record<string, string> = {
  available: "❗",
  active: "❓",
  complete: "✔",
};

export class NpcEntity {
  readonly npc: NPC;
  readonly sprite: Phaser.GameObjects.Image;
  private nameplate: Phaser.GameObjects.Container;
  private indicator: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, npc: NPC, x: number, y: number) {
    this.npc = npc;

    this.sprite = scene.add
      .image(x, y, npcSprite(npc.sprite_type))
      .setOrigin(0.5, 0.85)
      .setDepth(y);

    // Quest indicator above the head (hidden until set).
    this.indicator = scene.add
      .text(x, y - 46, "", { fontFamily: "monospace", fontSize: "18px" })
      .setOrigin(0.5, 1)
      .setDepth(y + 1)
      .setVisible(false);

    // Nameplate (name + title), shown only when the player is near.
    const label = `${npc.name}\n${npc.title}`;
    const text = scene.add
      .text(0, 0, label, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#e5e7eb",
        align: "center",
        lineSpacing: 2,
      })
      .setOrigin(0.5, 1);
    const bg = scene.add
      .rectangle(0, 2, text.width + 14, text.height + 8, 0x0b1020, 0.82)
      .setStrokeStyle(2, 0x3b4a78, 1)
      .setOrigin(0.5, 1);
    this.nameplate = scene.add
      .container(x, y - 30, [bg, text])
      .setDepth(100000)
      .setVisible(false);
  }

  setNearby(nearby: boolean): void {
    this.nameplate.setVisible(nearby);
  }

  setIndicator(state: "available" | "active" | "complete" | null): void {
    if (!state) {
      this.indicator.setVisible(false);
      return;
    }
    this.indicator.setText(INDICATOR_GLYPH[state] ?? "");
    this.indicator.setVisible(true);
  }

  /** Gentle idle float for the indicator so it draws the eye. */
  pulse(time: number): void {
    if (this.indicator.visible) {
      this.indicator.y = this.sprite.y - 46 + Math.sin(time * 0.004) * 3;
    }
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }
}
