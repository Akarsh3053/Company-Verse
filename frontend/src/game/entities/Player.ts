// ─────────────────────────────────────────────────────────────────────────────
// Player entity — top-down arcade sprite with WASD/arrow + virtual d-pad
// movement. Front/back textures plus horizontal flip give a 4-direction look
// from two generated textures (see textures.ts). A subtle bob sells walking.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import { PLAYER_SPRITE } from "../assetMap";
import { virtualInput } from "../virtualInput";

const SPEED = 190;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;
  private facing: "front" | "back" = "front";
  private bobTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, tint?: number | null) {
    super(scene, x, y, PLAYER_SPRITE);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(y);
    this.setOrigin(0.5, 0.85);
    if (tint) this.setTint(tint);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(18, 12);
    body.setOffset(5, 22);
    body.setCollideWorldBounds(true);

    const kb = scene.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /** Whether the player is currently moving (used to gate the walk bob). */
  update(_time: number, delta: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    let vx = 0;
    let vy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) vx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) vx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) vy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) vy += 1;

    // Blend in virtual d-pad (mobile).
    vx += virtualInput.x;
    vy += virtualInput.y;
    vx = Phaser.Math.Clamp(vx, -1, 1);
    vy = Phaser.Math.Clamp(vy, -1, 1);

    const len = Math.hypot(vx, vy);
    if (len > 0) {
      vx /= len;
      vy /= len;
      body.setVelocity(vx * SPEED, vy * SPEED);

      // Facing: vertical dominates texture (front/back), horizontal flips.
      if (Math.abs(vy) >= Math.abs(vx)) {
        this.setFacing(vy < 0 ? "back" : "front");
      }
      if (vx !== 0) this.setFlipX(vx < 0);

      // Walk bob.
      this.bobTime += delta;
      this.y += Math.sin(this.bobTime * 0.03) * 0.25;
    } else {
      body.setVelocity(0, 0);
      this.bobTime = 0;
    }

    this.setDepth(this.y);
  }

  private setFacing(facing: "front" | "back") {
    if (this.facing === facing) return;
    this.facing = facing;
    this.setTexture(facing === "back" ? `${PLAYER_SPRITE}_back` : PLAYER_SPRITE);
  }
}
