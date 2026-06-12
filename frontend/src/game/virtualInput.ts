// ─────────────────────────────────────────────────────────────────────────────
// Virtual input — shared movement vector for touch/mobile controls (frontend.md
// §7.5). The React on-screen d-pad writes here; the Phaser Player reads it each
// frame and blends it with keyboard input. A plain mutable singleton avoids
// per-frame event spam.
// ─────────────────────────────────────────────────────────────────────────────

export const virtualInput = {
  x: 0, // -1 (left) .. 1 (right)
  y: 0, // -1 (up) .. 1 (down)
  /** Set by the React d-pad; reset to 0 on release. */
  set(x: number, y: number) {
    this.x = x;
    this.y = y;
  },
  reset() {
    this.x = 0;
    this.y = 0;
  },
};

/** Latch for a one-shot interaction request from the mobile action button. */
export const virtualAction = {
  pending: false,
  trigger() {
    this.pending = true;
  },
  consume(): boolean {
    if (this.pending) {
      this.pending = false;
      return true;
    }
    return false;
  },
};
