// ─────────────────────────────────────────────────────────────────────────────
// Phaser ↔ React event bus (frontend.md §3).
//
// Phaser owns the <canvas>; React owns the HUD/overlays. They communicate ONLY
// through this thin emitter — never by reaching into each other's internals.
// Events are strongly typed so both sides agree on payload shapes.
//
// NOTE: this module is imported by React (server-evaluated during Next.js
// prerender), so it must NOT import Phaser — Phaser touches `window` at load
// time. We use a tiny self-contained emitter instead.
// ─────────────────────────────────────────────────────────────────────────────

import type { Landmark, NPC, Region } from "@/types/bundle";

export type GameEvents = {
  // Phaser → React (open overlays / report world events)
  "dialogue:open": { npcId: string };
  "challenge:open": { challengeId: string };
  "landmark:open": { landmark: Landmark; region: Region | null };
  "interaction:prompt": { label: string | null };
  "npc:near": { npc: NPC | null };
  "region:entered": { regionId: string };
  "world:ready": Record<string, never>;

  // React → Phaser (drive the world from UI actions)
  "dialogue:closed": Record<string, never>;
  "challenge:closed": Record<string, never>;
  "overlay:changed": { open: boolean };
  "camera:focusRegion": { regionId: string };
};

type Handler<T> = (payload: T) => void;

class TypedEventBus {
  private handlers = new Map<keyof GameEvents, Set<Handler<unknown>>>();

  on<K extends keyof GameEvents>(
    event: K,
    handler: Handler<GameEvents[K]>,
  ): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<unknown>);
    // Return an unsubscribe fn for convenient React useEffect cleanup.
    return () => this.off(event, handler);
  }

  once<K extends keyof GameEvents>(
    event: K,
    handler: Handler<GameEvents[K]>,
  ): void {
    const wrapper: Handler<GameEvents[K]> = (payload) => {
      this.off(event, wrapper);
      handler(payload);
    };
    this.on(event, wrapper);
  }

  off<K extends keyof GameEvents>(
    event: K,
    handler: Handler<GameEvents[K]>,
  ): void {
    this.handlers.get(event)?.delete(handler as Handler<unknown>);
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    // Copy to tolerate handlers that unsubscribe during dispatch.
    for (const handler of [...set]) {
      (handler as Handler<GameEvents[K]>)(payload);
    }
  }

  removeAll(): void {
    this.handlers.clear();
  }
}

/** Singleton bus shared by the single Phaser instance and the React tree. */
export const eventBus = new TypedEventBus();
