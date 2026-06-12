// ─────────────────────────────────────────────────────────────────────────────
// ChallengePickup — a glowing ambient object placed in a quest's region whenever
// a challenge is available. The player walks up to it and presses E to open the
// ChallengeModal. When the challenge is completed, the pickup is destroyed.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";

export class ChallengePickup {
  readonly challengeId: string;
  readonly questId: string;
  private sprite: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween;
  private pulseTween: Phaser.Tweens.Tween;

  constructor(
    scene: Phaser.Scene,
    challengeId: string,
    questId: string,
    x: number,
    y: number,
    title: string,
  ) {
    this.challengeId = challengeId;
    this.questId = questId;

    // Sprite: use frame A; we tween between A and B manually via setTexture.
    this.sprite = scene.add
      .image(x, y, "pickup_challenge_a")
      .setOrigin(0.5, 0.5)
      .setDepth(y + 500) // always above ground, below NPCs
      .setScale(1.0);

    // Gentle float bob.
    this.tween = scene.tweens.add({
      targets: this.sprite,
      y: y - 8,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Pulse: alternate textures for a glow beat.
    let bright = false;
    this.pulseTween = scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500,
      yoyo: true,
      repeat: -1,
      onYoyo: () => {
        bright = !bright;
        this.sprite.setTexture(bright ? "pickup_challenge_b" : "pickup_challenge_a");
      },
    });

    // Tiny label: challenge short title (truncated).
    const short = title.length > 24 ? title.slice(0, 22) + "…" : title;
    this.label = scene.add
      .text(x, y - 28, `📜 ${short}`, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#fde68a",
        stroke: "#0b1020",
        strokeThickness: 3,
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(y + 501)
      .setVisible(false);
  }

  get x(): number { return this.sprite.x; }
  get y(): number { return this.sprite.y; }

  /** Show/hide the title label (driven by proximity detection). */
  setNearby(nearby: boolean): void {
    this.label.setVisible(nearby);
  }

  /** Remove all Phaser objects cleanly. */
  destroy(): void {
    this.tween.stop();
    this.pulseTween.stop();
    this.sprite.destroy();
    this.label.destroy();
  }
}
