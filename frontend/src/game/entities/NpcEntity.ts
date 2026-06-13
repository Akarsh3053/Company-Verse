// ─────────────────────────────────────────────────────────────────────────────
// NPC entity — a character sprite placed in its region, with a proximity
// nameplate and a quest indicator (❗ available · ❓ active · ✔ complete) driven
// by gameplay state. Non-blocking: interaction is by proximity (see scene).
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { NPC } from "@/types/bundle";
import { npcSprite } from "../assetMap";
import { resolveCharPrefix } from "../assets/realAssets";
import { charFrameKey, walkAnimKey } from "../assets/manifest";

const INDICATOR_GLYPH: Record<string, string> = {
  available: "❗",
  active: "❓",
  complete: "✔",
};

export class NpcEntity {
  readonly npc: NPC;
  // Use Sprite (not Image) so walk animations can play.
  readonly sprite: Phaser.GameObjects.Sprite;
  private nameplate: Phaser.GameObjects.Container;
  private indicator: Phaser.GameObjects.Text;
  private bobOffset = 0;
  private readonly baseY: number;

  constructor(scene: Phaser.Scene, npc: NPC, x: number, y: number) {
    this.npc = npc;
    this.baseY = y;

    // Prefer real character art; else procedural texture key.
    const prefix = resolveCharPrefix(scene, npc.sprite_type);
    const textureKey = prefix
      ? charFrameKey(prefix, "fr", 1)
      : npcSprite(npc.sprite_type);

    this.sprite = scene.add
      .sprite(x, y, textureKey)
      .setOrigin(0.5, 0.85)
      .setDepth(y);
    if (prefix) this.sprite.setScale(1.6);

    // Play a slow idle walk animation (front-facing, 2 frames, 2fps) so the
    // NPC looks alive without actually moving around.
    if (prefix && scene.anims.exists(walkAnimKey(prefix, "fr"))) {
      this.sprite.play({ key: walkAnimKey(prefix, "fr"), frameRate: 2, repeat: -1 });
    }

    // Quest indicator above the head (hidden until set).
    this.indicator = scene.add
      .text(x, y - 58, "", { fontFamily: "monospace", fontSize: "26px" })
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

  /** Gentle idle bob + indicator float so the NPC feels alive. */
  pulse(time: number): void {
    // Subtle body bob (±2px) using a slow sine — each NPC offset by their id.
    const hash = Array.from(this.npc.id).reduce((a, c) => a + c.charCodeAt(0), 0);
    this.bobOffset = Math.sin(time * 0.0025 + hash) * 2;
    this.sprite.y = this.baseY + this.bobOffset;

    if (this.indicator.visible) {
      this.indicator.y = this.sprite.y - 58 + Math.sin(time * 0.004) * 3;
    }
  }

  get x(): number {
    return this.sprite.x;
  }

  get y(): number {
    return this.sprite.y;
  }
}
