// ─────────────────────────────────────────────────────────────────────────────
// Player entity — top-down arcade sprite with WASD/arrow + virtual d-pad
// movement.
//
// Rendering: if real character art loaded (Last Guardian), uses 4-direction,
// 2-frame walk animations. Otherwise falls back to the procedural front/back
// textures (+ horizontal flip) so the game always renders.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import { PLAYER_SPRITE } from "../assetMap";
import { virtualInput } from "../virtualInput";
import { dirToLg, resolveCharPrefix } from "../assets/realAssets";
import { charFrameKey, walkAnimKey, type LgDir } from "../assets/manifest";

const SPEED = 190;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd: Record<"up" | "down" | "left" | "right", Phaser.Input.Keyboard.Key>;

  // Real-art path.
  private prefix: string | null;
  private lgDir: LgDir = "fr";

  // Procedural fallback path.
  private facing: "front" | "back" = "front";
  private bobTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, tint?: number | null) {
    const prefix = resolveCharPrefix(scene, "player");
    const initialTexture = prefix ? charFrameKey(prefix, "fr", 1) : PLAYER_SPRITE;
    super(scene, x, y, initialTexture);
    this.prefix = prefix;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setDepth(y);
    this.setOrigin(0.5, 0.85);
    // Tinting only makes sense for the neutral procedural sprite; real art is
    // already fully coloured.
    if (tint && !prefix) this.setTint(tint);
    if (prefix) this.setScale(1.2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(14, 10);
    body.setOffset(prefix ? 9 : 5, prefix ? 20 : 22);
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
    const moving = len > 0;
    if (moving) {
      vx /= len;
      vy /= len;
      body.setVelocity(vx * SPEED, vy * SPEED);
    } else {
      body.setVelocity(0, 0);
    }

    if (this.prefix) {
      this.animateReal(vx, vy, moving);
    } else {
      this.animateProcedural(vx, vy, moving, delta);
    }

    this.setDepth(this.y);
  }

  private animateReal(vx: number, vy: number, moving: boolean): void {
    if (moving) {
      const { dir } = dirToLg(vx, vy);
      this.lgDir = dir;
      const anim = walkAnimKey(this.prefix as string, dir);
      if (this.anims.currentAnim?.key !== anim || !this.anims.isPlaying) {
        this.play(anim, true);
      }
    } else {
      this.anims.stop();
      this.setTexture(charFrameKey(this.prefix as string, this.lgDir, 1));
    }
  }

  private animateProcedural(
    vx: number,
    vy: number,
    moving: boolean,
    delta: number,
  ): void {
    if (moving) {
      if (Math.abs(vy) >= Math.abs(vx)) {
        this.setFacing(vy < 0 ? "back" : "front");
      }
      if (vx !== 0) this.setFlipX(vx < 0);
      this.bobTime += delta;
      this.y += Math.sin(this.bobTime * 0.03) * 0.25;
    } else {
      this.bobTime = 0;
    }
  }

  private setFacing(facing: "front" | "back") {
    if (this.facing === facing) return;
    this.facing = facing;
    this.setTexture(facing === "back" ? `${PLAYER_SPRITE}_back` : PLAYER_SPRITE);
  }
}
