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
    if (!hostRef.current || gameRef.current) return;
    const game = createGame(hostRef.current, bundle);
    gameRef.current = game;

    return () => {
      gameRef.current = null;
      game.destroy(true);
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
