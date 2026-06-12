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

// 96 pixels past the region patch radius keeps the player inside the visual patch.
const INTERACT_RADIUS = 96;
// Safe zone radii — player is blocked from leaving.
const REGION_SAFE_RADIUS = 310; // just past the 288px region visual radius
const NEXUS_SAFE_RADIUS = 460;  // covers all 8 diagonal gaps between regions

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

    this.cameras.main.setBackgroundColor("#141c11");
    this.world = buildWorld(this, this.bundle);
    this.buildSafeZones();

    // World + camera bounds derived from data (never assume fixed size).
    const b = this.world.bounds;
    this.physics.world.setBounds(b.minX, b.minY, b.width, b.height);
    this.cameras.main.setBounds(b.minX, b.minY, b.width, b.height);

    // Player at their spawn, tinted by avatar_color.
    const spawn = this.bundle.player.spawn;
    const tint = parseTint(this.bundle.player.avatar_color);
    this.player = new Player(this, spawn.x, spawn.y, tint);
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    this.cameras.main.setZoom(1.0);

    // Inset the camera viewport below the HUD bar so the player
    // character never renders behind the top React overlay.
    // Compact HUD is ~52px tall; 56px gives a small breathing margin.
    const HUD_H = 56;
    const { width, height } = this.scale;
    this.cameras.main.setViewport(0, HUD_H, width, height - HUD_H);

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

  private spawnPos!: { x: number; y: number };
  private worldRegions!: Array<{ x: number; y: number; r: number }>;

  /** Pre-compute the set of "safe" circles (regions + nexus) once. */
  private buildSafeZones(): void {
    const regions = this.bundle.world.regions.map((r) => ({
      x: r.position.x,
      y: r.position.y,
      r: REGION_SAFE_RADIUS,
    }));
    // Nexus circle = area around the world spawn.
    const sp = this.bundle.world.spawn;
    regions.push({ x: sp.x, y: sp.y, r: NEXUS_SAFE_RADIUS });
    this.worldRegions = regions;
    this.spawnPos = { x: sp.x, y: sp.y };
  }

  update(time: number, delta: number): void {
    if (!this.player) return;

    if (this.inputLocked) {
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    } else {
      this.player.update(time, delta);
      this.detectRegion();
      this.softBoundary();
    }

    this.detectProximity(time);
    this.handleInteraction();
  }

  /**
   * Hard boundary — the player CANNOT leave the union of region circles and the
   * nexus hub. When outside every safe zone, we fully override their velocity
   * to point toward the nearest safe centre at walk speed. This is physically
   * impossible to overpower, unlike a soft push that can be fought with WASD.
   */
  private softBoundary(): void {
    const px = this.player.x;
    const py = this.player.y;
    let nearest = this.spawnPos;
    let nearestDist = Phaser.Math.Distance.Between(px, py, this.spawnPos.x, this.spawnPos.y);

    let inSafeZone = nearestDist <= NEXUS_SAFE_RADIUS;
    for (const zone of this.worldRegions) {
      const d = Phaser.Math.Distance.Between(px, py, zone.x, zone.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = zone;
      }
      if (d <= zone.r) inSafeZone = true;
    }

    if (!inSafeZone) {
      // Fully override velocity — no blending, no fighting it with WASD.
      const angle = Phaser.Math.Angle.Between(px, py, nearest.x, nearest.y);
      const SPEED = 200;
      (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * SPEED,
        Math.sin(angle) * SPEED,
      );
    }
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
