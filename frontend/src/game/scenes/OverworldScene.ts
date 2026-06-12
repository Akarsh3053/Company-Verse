// ─────────────────────────────────────────────────────────────────────────────
// OverworldScene — the heart of the game. Builds the world from the bundle,
// spawns the player, drives camera + collisions, detects proximity to NPCs and
// landmarks, emits interaction events to the React HUD, and tracks region-entry
// objectives. All gameplay state mutations go through the Zustand store.
// ─────────────────────────────────────────────────────────────────────────────

import * as Phaser from "phaser";
import type { GameBundle } from "@/types/bundle";
import { useGameStore } from "@/state/gameStore";
import { eventBus } from "../eventBus";
import { virtualAction } from "../virtualInput";
import { Player } from "../entities/Player";
import { NpcEntity } from "../entities/NpcEntity";
import { LandmarkEntity } from "../entities/LandmarkEntity";
import { buildWorld, type BuiltWorld } from "../worldBuilder";

const INTERACT_RADIUS = 64;

export class OverworldScene extends Phaser.Scene {
  private bundle!: GameBundle;
  private world!: BuiltWorld;
  private player!: Player;
  private interactKey!: Phaser.Input.Keyboard.Key;
  private nearestNpc: NpcEntity | null = null;
  private nearestLandmark: LandmarkEntity | null = null;
  private currentRegionId: string | null = null;
  private inputLocked = false;
  private unsubscribers: Array<() => void> = [];

  constructor() {
    super("Overworld");
  }

  create(): void {
    this.bundle = this.registry.get("bundle") as GameBundle;
    if (!this.bundle) {
      // Without a bundle there is nothing to render; bail quietly.
      return;
    }

    this.cameras.main.setBackgroundColor("#0b1020");
    this.world = buildWorld(this, this.bundle);

    // World + camera bounds derived from data (never assume fixed size).
    const b = this.world.bounds;
    this.physics.world.setBounds(b.minX, b.minY, b.width, b.height);
    this.cameras.main.setBounds(b.minX, b.minY, b.width, b.height);

    // Player at their spawn, tinted by avatar_color.
    const spawn = this.bundle.player.spawn;
    const tint = parseTint(this.bundle.player.avatar_color);
    this.player = new Player(this, spawn.x, spawn.y, tint);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.4);

    this.interactKey = this.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );

    this.refreshIndicators();
    this.subscribeToStore();
    this.bindEvents();

    // Seed the starting region (so a spawn-region objective can complete).
    const startRegion = this.world.regionAt(spawn.x, spawn.y);
    if (startRegion) {
      this.currentRegionId = startRegion.id;
      useGameStore.getState().recordExploreRegion(startRegion.id);
    }

    eventBus.emit("world:ready", {});
  }

  private bindEvents(): void {
    const offOverlay = eventBus.on("overlay:changed", ({ open }) => {
      this.inputLocked = open;
      if (open) {
        (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
    });
    const offFocus = eventBus.on("camera:focusRegion", ({ regionId }) => {
      const region = this.bundle.world.regions.find((r) => r.id === regionId);
      if (region) {
        this.cameras.main.pan(region.position.x, region.position.y, 500, "Sine.easeInOut");
      }
    });
    this.unsubscribers.push(offOverlay, offFocus);

    // Clean up listeners + store subscription when the scene shuts down.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
  }

  private subscribeToStore(): void {
    const unsub = useGameStore.subscribe(() => this.refreshIndicators());
    this.unsubscribers.push(unsub);
  }

  private cleanup(): void {
    this.unsubscribers.forEach((fn) => fn());
    this.unsubscribers = [];
  }

  private refreshIndicators(): void {
    if (!this.world) return;
    const indicatorOf = useGameStore.getState().giverIndicator;
    for (const npc of this.world.npcs) {
      npc.setIndicator(indicatorOf(npc.npc.id));
    }
  }

  update(time: number, delta: number): void {
    if (!this.player) return;

    if (this.inputLocked) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    } else {
      this.player.update(time, delta);
      this.detectRegion();
    }

    this.detectProximity(time);
    this.handleInteraction();
  }

  private detectRegion(): void {
    const region = this.world.regionAt(this.player.x, this.player.y);
    const id = region?.id ?? null;
    if (id && id !== this.currentRegionId) {
      this.currentRegionId = id;
      eventBus.emit("region:entered", { regionId: id });
      useGameStore.getState().recordExploreRegion(id);
    }
  }

  private detectProximity(time: number): void {
    let npc: NpcEntity | null = null;
    let npcDist = INTERACT_RADIUS;
    for (const candidate of this.world.npcs) {
      candidate.pulse(time);
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        candidate.x,
        candidate.y,
      );
      if (d < npcDist) {
        npcDist = d;
        npc = candidate;
      }
    }

    let landmark: LandmarkEntity | null = null;
    let lmDist = INTERACT_RADIUS;
    for (const candidate of this.world.landmarks) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        candidate.x,
        candidate.y,
      );
      if (d < lmDist) {
        lmDist = d;
        landmark = candidate;
      }
    }

    // Highlight only the single nearest interactable.
    const npcWins = npc && (!landmark || npcDist <= lmDist);
    const targetNpc = npcWins ? npc : null;
    const targetLandmark = !npcWins ? landmark : null;

    if (targetNpc !== this.nearestNpc) {
      this.nearestNpc?.setNearby(false);
      targetNpc?.setNearby(true);
      this.nearestNpc = targetNpc;
    }
    if (targetLandmark !== this.nearestLandmark) {
      this.nearestLandmark?.setNearby(false);
      targetLandmark?.setNearby(true);
      this.nearestLandmark = targetLandmark;
    }

    const label = targetNpc
      ? `Talk to ${targetNpc.npc.name}`
      : targetLandmark
        ? `Inspect ${targetLandmark.landmark.name}`
        : null;
    eventBus.emit("interaction:prompt", { label: this.inputLocked ? null : label });
  }

  private handleInteraction(): void {
    if (this.inputLocked) return;
    const pressed =
      Phaser.Input.Keyboard.JustDown(this.interactKey) || virtualAction.consume();
    if (!pressed) return;

    if (this.nearestNpc) {
      const npcId = this.nearestNpc.npc.id;
      // Reaching an NPC and opening dialogue satisfies a 'talk' objective.
      useGameStore.getState().recordTalk(npcId);
      eventBus.emit("dialogue:open", { npcId });
    } else if (this.nearestLandmark) {
      eventBus.emit("landmark:open", {
        landmark: this.nearestLandmark.landmark,
        region: this.nearestLandmark.region,
      });
    }
  }
}

function parseTint(color: string | null | undefined): number | null {
  if (!color) return null;
  const parsed = Number.parseInt(color.replace("#", ""), 16);
  return Number.isNaN(parsed) ? null : parsed;
}
