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
import { ChallengePickup } from "../entities/ChallengePickup";
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
  private nearestPickup: ChallengePickup | null = null;
  private challengePickups: ChallengePickup[] = [];
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

    // Player spawns inside their home region (entrance facing the nexus),
    // not at the world centre nexus — makes the home region feel like YOUR town.
    const homeRegion = this.bundle.world.regions.find(
      (r) => r.id === this.bundle.player.home_region_id,
    );
    const worldSpawn = this.bundle.player.spawn;
    let spawnX = worldSpawn.x;
    let spawnY = worldSpawn.y;
    if (homeRegion) {
      // Place the player at the home region centre offset toward the nexus by
      // ~40% of the region radius, so they appear near the entrance path.
      const nx = worldSpawn.x; // nexus / world spawn
      const ny = worldSpawn.y;
      const rx = homeRegion.position.x;
      const ry = homeRegion.position.y;
      const angle = Math.atan2(ny - ry, nx - rx); // angle toward nexus
      const RADIUS = REGION_SAFE_RADIUS * 0.4;
      spawnX = Math.round(rx + Math.cos(angle) * RADIUS);
      spawnY = Math.round(ry + Math.sin(angle) * RADIUS);
    }
    const tint = parseTint(this.bundle.player.avatar_color);
    this.player = new Player(this, spawnX, spawnY, tint);
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
    this.refreshPickups();
    this.subscribeToStore();
    this.bindEvents();

    // Seed the starting region (so a spawn-region objective can complete).
    const startRegion = this.world.regionAt(spawnX, spawnY);
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

  private pendingRefresh = false;

  private subscribeToStore(): void {
    const unsub = useGameStore.subscribe(() => {
      // Coalesce: many set() calls fire in one synchronous action (e.g. completeChallenge
      // triggers completedChallenges → xp → level → stats → questStatus → unlocks).
      // Schedule a single refresh in a microtask so it runs AFTER the whole batch settles.
      if (this.pendingRefresh) return;
      this.pendingRefresh = true;
      Promise.resolve().then(() => {
        this.pendingRefresh = false;
        if (this.world) {
          this.refreshIndicators();
          this.refreshPickups();
        }
      });
    });
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

  /**
   * Sync in-world challenge pickups with the current game state.
   * Pickups appear for every challenge whose parent quest is "available" or
   * "active" and which hasn't been completed yet; they are destroyed on completion.
   * Showing them for "available" quests lets the player discover them on the map
   * before formally accepting — more Pokémon-like.
   */
  private refreshPickups(): void {
    if (!this.bundle) return;                    // no isActive() guard — safe to call from create()
    const { questStatus, completedChallenges } = useGameStore.getState();

    // Build the set of challenge IDs that should currently have a pickup.
    const wanted = new Set<string>();
    for (const quest of this.bundle.quests) {
      const s = questStatus[quest.id];
      if (s !== "active" && s !== "available") continue;
      for (const challengeId of quest.challenge_ids) {
        if (!completedChallenges[challengeId]) {
          wanted.add(challengeId);
        }
      }
    }

    // Destroy pickups that are no longer needed.
    this.challengePickups = this.challengePickups.filter((p) => {
      if (!wanted.has(p.challengeId)) {
        if (this.nearestPickup === p) this.nearestPickup = null;
        p.destroy();
        return false;
      }
      return true;
    });

    // Create pickups for newly-needed challenges.
    const existing = new Set(this.challengePickups.map((p) => p.challengeId));
    const regionById = new Map(this.bundle.world.regions.map((r) => [r.id, r]));
    const challengeById = new Map(this.bundle.challenges.map((c) => [c.id, c]));
    const questById = new Map(this.bundle.quests.map((q) => [q.id, q]));

    for (const challengeId of wanted) {
      if (existing.has(challengeId)) continue;
      const challenge = challengeById.get(challengeId);
      if (!challenge) continue;
      const quest = questById.get(challenge.quest_id);
      if (!quest) continue;
      const region = regionById.get(quest.region_id);
      if (!region) continue;

      // Spread multiple pickups in a small ring around the region centre.
      const sameQuest = [...wanted].filter((cid) => {
        const c = challengeById.get(cid);
        return c && c.quest_id === challenge.quest_id;
      });
      const idx = sameQuest.indexOf(challengeId);
      const total = sameQuest.length;
      const r = total > 1 ? 90 : 0;
      const angle = total > 1 ? (idx / total) * Math.PI * 2 : 0;
      const px = region.position.x + Math.cos(angle) * r;
      const py = region.position.y + Math.sin(angle) * r + 60; // offset below centre

      const pickup = new ChallengePickup(
        this,
        challengeId,
        challenge.quest_id,
        px,
        py,
        challenge.title,
      );
      this.challengePickups.push(pickup);
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
        this.player.x, this.player.y, candidate.x, candidate.y,
      );
      if (d < npcDist) { npcDist = d; npc = candidate; }
    }

    let landmark: LandmarkEntity | null = null;
    let lmDist = INTERACT_RADIUS;
    for (const candidate of this.world.landmarks) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, candidate.x, candidate.y,
      );
      if (d < lmDist) { lmDist = d; landmark = candidate; }
    }

    let pickup: ChallengePickup | null = null;
    let pickupDist = INTERACT_RADIUS;
    for (const candidate of this.challengePickups) {
      const d = Phaser.Math.Distance.Between(
        this.player.x, this.player.y, candidate.x, candidate.y,
      );
      if (d < pickupDist) { pickupDist = d; pickup = candidate; }
    }

    // Pickup wins over landmark if closer; NPC wins over everything if closest.
    const bestDist = Math.min(npcDist, lmDist, pickupDist);
    const targetNpc = npcDist === bestDist && npc ? npc : null;
    const targetPickup = !targetNpc && pickupDist === bestDist && pickup ? pickup : null;
    const targetLandmark = !targetNpc && !targetPickup && lmDist === bestDist && landmark ? landmark : null;

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
    if (targetPickup !== this.nearestPickup) {
      this.nearestPickup?.setNearby(false);
      targetPickup?.setNearby(true);
      this.nearestPickup = targetPickup;
    }

    const label = targetNpc
      ? `Talk to ${targetNpc.npc.name}`
      : targetPickup
        ? `Take Challenge`
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
      useGameStore.getState().recordTalk(npcId);
      eventBus.emit("dialogue:open", { npcId });
    } else if (this.nearestPickup) {
      const { questStatus, acceptQuest } = useGameStore.getState();
      // Auto-accept the quest if it's still in 'available' state so the player
      // doesn't have to find the NPC giver before taking the in-world challenge.
      if (questStatus[this.nearestPickup.questId] === "available") {
        acceptQuest(this.nearestPickup.questId);
      }
      eventBus.emit("challenge:open", { challengeId: this.nearestPickup.challengeId });
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
