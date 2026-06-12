"use client";

// ─────────────────────────────────────────────────────────────────────────────
// PhaserGame — client-only React wrapper around the single Phaser.Game instance.
// Mounted via next/dynamic({ ssr:false }) so Phaser never runs on the server.
// React owns the HUD overlays (rendered by the parent); this component owns only
// the <canvas> host and the game lifecycle.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import type * as Phaser from "phaser";
import type { GameBundle } from "@/types/bundle";
import { createGame } from "./createGame";

interface PhaserGameProps {
  bundle: GameBundle;
}

export default function PhaserGame({ bundle }: PhaserGameProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Defer creation by a tick so React 18 StrictMode's dev-only
    // mount→unmount→mount cycle settles into a SINGLE game instance. Without
    // this, the first mount creates game A, the immediate cleanup destroys it
    // asynchronously, and the second mount creates game B while A is still
    // tearing down — the two race and can leave an orphaned, half-loaded canvas.
    const timer = window.setTimeout(() => {
      if (cancelled || !hostRef.current || gameRef.current) return;
      gameRef.current = createGame(hostRef.current, bundle);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // Bundle is fixed for the lifetime of this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 h-full w-full"
      // Phaser injects the <canvas> here; touch-action none for mobile controls.
      style={{ touchAction: "none" }}
    />
  );
}
