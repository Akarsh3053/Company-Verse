// ─────────────────────────────────────────────────────────────────────────────
// Game state store (Zustand). The frontend is the source of truth for PLAY state
// (quest progress, completion, stats) — the backend never tracks in-game state.
//
// Responsibilities (frontend.md §8.5/§8.6):
//  • Build id→entity lookup maps once on boot.
//  • Track quest status (respecting server status + prerequisites).
//  • Track objective completion by type (talk/explore/read/challenge/decision).
//  • Apply rewards on quest completion (XP, stats→100, knowledge points, badges,
//    unlocks) and flip dependent quests locked→available.
//  • Persist progress to localStorage keyed by metadata.user_key (resume on refresh).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from "zustand";
import type {
  Challenge,
  DialogueTree,
  GameBundle,
  Landmark,
  NPC,
  Quest,
  QuestStatus,
  Region,
} from "@/types/bundle";

const PROGRESS_VERSION = 1;
const progressKey = (userKey: string) => `companyverse:progress:${userKey}`;

/** XP required to advance FROM the given level to the next. */
export function xpToNext(level: number): number {
  return 100 + Math.max(0, level - 1) * 75;
}

export interface Toast {
  id: number;
  kind: "quest" | "level" | "badge" | "stat" | "info";
  title: string;
  detail?: string;
}

interface PersistedProgress {
  version: number;
  userKey: string;
  level: number;
  xpIntoLevel: number;
  totalXp: number;
  stats: Record<string, number>;
  knowledgePoints: number;
  badges: string[];
  questStatus: Record<string, QuestStatus>;
  objectives: Record<string, boolean>;
  completedChallenges: string[];
}

interface Lookups {
  npcById: Map<string, NPC>;
  regionById: Map<string, Region>;
  landmarkById: Map<string, Landmark>;
  questById: Map<string, Quest>;
  challengeById: Map<string, Challenge>;
  dialogueByNpcId: Map<string, DialogueTree>;
  /** quest id → quest that this quest unlocks via reward/prereq graph. */
  giverNpcToQuests: Map<string, Quest[]>;
}

interface GameState {
  bundle: GameBundle | null;
  lookups: Lookups | null;

  // Player progression (client-owned; seeded from bundle.player).
  level: number;
  xpIntoLevel: number;
  totalXp: number;
  stats: Record<string, number>;
  knowledgePoints: number;
  badges: string[];

  // Quest + objective + challenge tracking.
  questStatus: Record<string, QuestStatus>;
  objectives: Record<string, boolean>;
  completedChallenges: Record<string, boolean>;

  toasts: Toast[];

  // ── actions ──────────────────────────────────────────────────────────────
  initFromBundle: (bundle: GameBundle) => void;
  acceptQuest: (questId: string) => void;
  recordTalk: (npcId: string) => void;
  recordExploreRegion: (regionId: string) => void;
  recordExploreLandmark: (landmarkId: string) => void;
  recordReadLandmark: (landmarkId: string) => void;
  completeChallenge: (challengeId: string) => void;
  dismissToast: (id: number) => void;
  reset: () => void;

  // ── selectors (computed helpers) ───────────────────────────────────────────
  isAllComplete: () => boolean;
  giverIndicator: (npcId: string) => "available" | "active" | "complete" | null;
}

let toastSeq = 1;

function buildLookups(bundle: GameBundle): Lookups {
  const npcById = new Map(bundle.npcs.map((n) => [n.id, n]));
  const regionById = new Map(bundle.world.regions.map((r) => [r.id, r]));
  const landmarkById = new Map<string, Landmark>();
  for (const region of bundle.world.regions) {
    for (const lm of region.landmarks) landmarkById.set(lm.id, lm);
  }
  const questById = new Map(bundle.quests.map((q) => [q.id, q]));
  const challengeById = new Map(bundle.challenges.map((c) => [c.id, c]));
  const dialogueByNpcId = new Map(bundle.dialogues.map((d) => [d.npc_id, d]));

  const giverNpcToQuests = new Map<string, Quest[]>();
  for (const quest of bundle.quests) {
    if (!quest.giver_npc_id) continue;
    const list = giverNpcToQuests.get(quest.giver_npc_id) ?? [];
    list.push(quest);
    giverNpcToQuests.set(quest.giver_npc_id, list);
  }

  return {
    npcById,
    regionById,
    landmarkById,
    questById,
    challengeById,
    dialogueByNpcId,
    giverNpcToQuests,
  };
}

/** Initial quest status: honour server status, but gate by prerequisites. */
function initialQuestStatus(bundle: GameBundle): Record<string, QuestStatus> {
  const status: Record<string, QuestStatus> = {};
  for (const quest of bundle.quests) {
    const hasPrereqs = quest.prerequisites.length > 0;
    if (quest.status === "complete") {
      status[quest.id] = "complete";
    } else if (!hasPrereqs) {
      // First quests (no prereqs) start available unless server locked them.
      status[quest.id] = quest.status === "locked" ? "available" : quest.status;
    } else {
      status[quest.id] = "locked";
    }
  }
  return status;
}

function loadPersisted(userKey: string): PersistedProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(progressKey(userKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedProgress;
    if (parsed.version !== PROGRESS_VERSION || parsed.userKey !== userKey) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const useGameStore = create<GameState>((set, get) => {
  /** Snapshot current progress and persist it (best-effort). */
  function persist() {
    const s = get();
    if (!s.bundle) return;
    if (typeof window === "undefined") return;
    const data: PersistedProgress = {
      version: PROGRESS_VERSION,
      userKey: s.bundle.metadata.user_key,
      level: s.level,
      xpIntoLevel: s.xpIntoLevel,
      totalXp: s.totalXp,
      stats: s.stats,
      knowledgePoints: s.knowledgePoints,
      badges: s.badges,
      questStatus: s.questStatus,
      objectives: s.objectives,
      completedChallenges: Object.keys(s.completedChallenges).filter(
        (k) => s.completedChallenges[k],
      ),
    };
    // Defer the write so it never blocks the game loop or React render mid-update.
    window.setTimeout(() => {
      try {
        window.localStorage.setItem(progressKey(data.userKey), JSON.stringify(data));
      } catch {
        /* storage full / unavailable — non-fatal */
      }
    }, 0);
  }

  function pushToast(toast: Omit<Toast, "id">) {
    set((s) => ({ toasts: [...s.toasts, { ...toast, id: toastSeq++ }] }));
  }

  /** Add XP, rolling level-ups. Emits toasts for each level gained. */
  function awardXp(amount: number) {
    if (amount <= 0) return;
    let { level, xpIntoLevel, totalXp } = get();
    totalXp += amount;
    xpIntoLevel += amount;
    let leveled = false;
    while (xpIntoLevel >= xpToNext(level)) {
      xpIntoLevel -= xpToNext(level);
      level += 1;
      leveled = true;
    }
    set({ level, xpIntoLevel, totalXp });
    if (leveled) {
      pushToast({ kind: "level", title: `Level up! You reached level ${level}.` });
    }
  }

  /**
   * Mark an objective complete (idempotent). If this completes its quest's
   * objectives, finalise the quest (rewards + unlocks).
   */
  function fulfilObjective(questId: string, objectiveId: string) {
    const { objectives, lookups } = get();
    if (objectives[objectiveId]) return; // already done
    set((s) => ({ objectives: { ...s.objectives, [objectiveId]: true } }));

    const quest = lookups?.questById.get(questId);
    if (!quest) {
      persist();
      return;
    }
    const allDone = quest.objectives.every((o) => get().objectives[o.id]);
    if (allDone && get().questStatus[questId] === "active") {
      finishQuest(quest);
    } else {
      persist();
    }
  }

  /** Apply a completed quest's rewards and unlock dependent quests. */
  function finishQuest(quest: Quest) {
    // Status → complete.
    set((s) => ({
      questStatus: { ...s.questStatus, [quest.id]: "complete" },
    }));

    // XP + knowledge points.
    awardXp(quest.reward.xp);
    if (quest.reward.knowledge_points) {
      set((s) => ({
        knowledgePoints: s.knowledgePoints + quest.reward.knowledge_points,
      }));
    }

    // Stat gains (clamped 0–100).
    if (Object.keys(quest.reward.stat_gains).length > 0) {
      set((s) => {
        const stats = { ...s.stats };
        for (const [k, v] of Object.entries(quest.reward.stat_gains)) {
          stats[k] = Math.max(0, Math.min(100, (stats[k] ?? 0) + v));
        }
        return { stats };
      });
    }

    // Badge.
    if (quest.reward.badge) {
      set((s) =>
        s.badges.includes(quest.reward.badge as string)
          ? {}
          : { badges: [...s.badges, quest.reward.badge as string] },
      );
      pushToast({ kind: "badge", title: `Badge earned: ${quest.reward.badge}` });
    }

    // Unlocks: explicit reward.unlocks[] + any quest whose prerequisites are now met.
    set((s) => {
      const next = { ...s.questStatus };
      const unlock = (id: string) => {
        if (next[id] === "locked") next[id] = "available";
      };
      for (const id of quest.reward.unlocks) unlock(id);
      // Re-evaluate prerequisite gating for every locked quest.
      for (const q of s.bundle?.quests ?? []) {
        if (next[q.id] !== "locked") continue;
        const ready = q.prerequisites.every((p) => next[p] === "complete");
        if (ready) next[q.id] = "available";
      }
      return { questStatus: next };
    });

    pushToast({
      kind: "quest",
      title: `Quest complete: ${quest.title}`,
      detail: `+${quest.reward.xp} XP${
        quest.reward.badge ? ` · ${quest.reward.badge}` : ""
      }`,
    });

    persist();
  }

  return {
    bundle: null,
    lookups: null,
    level: 1,
    xpIntoLevel: 0,
    totalXp: 0,
    stats: {},
    knowledgePoints: 0,
    badges: [],
    questStatus: {},
    objectives: {},
    completedChallenges: {},
    toasts: [],

    initFromBundle: (bundle) => {
      const lookups = buildLookups(bundle);
      const persisted = loadPersisted(bundle.metadata.user_key);

      if (persisted) {
        set({
          bundle,
          lookups,
          level: persisted.level,
          xpIntoLevel: persisted.xpIntoLevel,
          totalXp: persisted.totalXp,
          stats: { ...persisted.stats },
          knowledgePoints: persisted.knowledgePoints,
          badges: [...persisted.badges],
          questStatus: { ...persisted.questStatus },
          objectives: { ...persisted.objectives },
          completedChallenges: Object.fromEntries(
            persisted.completedChallenges.map((id) => [id, true]),
          ),
          toasts: [],
        });
        return;
      }

      // Fresh game: seed from the bundle's player + initial quest gating.
      set({
        bundle,
        lookups,
        level: bundle.player.level || 1,
        xpIntoLevel: 0,
        totalXp: bundle.player.xp || 0,
        stats: { ...bundle.player.stats },
        knowledgePoints: 0,
        badges: [],
        questStatus: initialQuestStatus(bundle),
        objectives: {},
        completedChallenges: {},
        toasts: [],
      });
    },

    acceptQuest: (questId) => {
      const { questStatus } = get();
      if (questStatus[questId] !== "available") return;
      set((s) => ({ questStatus: { ...s.questStatus, [questId]: "active" } }));
      const quest = get().lookups?.questById.get(questId);
      if (quest) {
        pushToast({ kind: "info", title: `Quest started: ${quest.title}` });
      }
      persist();
    },

    recordTalk: (npcId) => {
      const { bundle, questStatus, objectives } = get();
      if (!bundle) return;
      for (const quest of bundle.quests) {
        if (questStatus[quest.id] !== "active") continue;
        for (const obj of quest.objectives) {
          if (
            obj.type === "talk" &&
            obj.target_npc_id === npcId &&
            !objectives[obj.id]
          ) {
            fulfilObjective(quest.id, obj.id);
          }
        }
      }
    },

    recordExploreRegion: (regionId) => {
      const { bundle, questStatus, objectives } = get();
      if (!bundle) return;
      for (const quest of bundle.quests) {
        if (questStatus[quest.id] !== "active") continue;
        for (const obj of quest.objectives) {
          const matches =
            (obj.type === "explore" || obj.type === "read") &&
            obj.target_region_id === regionId &&
            !obj.target_landmark_id;
          if (matches && !objectives[obj.id]) {
            fulfilObjective(quest.id, obj.id);
          }
        }
      }
    },

    recordExploreLandmark: (landmarkId) => {
      const { bundle, questStatus, objectives } = get();
      if (!bundle) return;
      for (const quest of bundle.quests) {
        if (questStatus[quest.id] !== "active") continue;
        for (const obj of quest.objectives) {
          if (
            obj.type === "explore" &&
            obj.target_landmark_id === landmarkId &&
            !objectives[obj.id]
          ) {
            fulfilObjective(quest.id, obj.id);
          }
        }
      }
    },

    recordReadLandmark: (landmarkId) => {
      const { bundle, questStatus, objectives } = get();
      if (!bundle) return;
      for (const quest of bundle.quests) {
        if (questStatus[quest.id] !== "active") continue;
        for (const obj of quest.objectives) {
          if (
            obj.type === "read" &&
            obj.target_landmark_id === landmarkId &&
            !objectives[obj.id]
          ) {
            fulfilObjective(quest.id, obj.id);
          }
        }
      }
    },

    completeChallenge: (challengeId) => {
      const { completedChallenges, lookups } = get();
      const challenge = lookups?.challengeById.get(challengeId);
      const firstTime = !completedChallenges[challengeId];

      if (firstTime) {
        set((s) => ({
          completedChallenges: { ...s.completedChallenges, [challengeId]: true },
        }));
        if (challenge) awardXp(challenge.reward_xp);
      }

      // Complete any active-quest objective bound to this challenge.
      const { bundle, questStatus, objectives } = get();
      if (bundle) {
        for (const quest of bundle.quests) {
          if (questStatus[quest.id] !== "active") continue;
          for (const obj of quest.objectives) {
            if (
              (obj.type === "challenge" || obj.type === "decision") &&
              obj.challenge_id === challengeId &&
              !objectives[obj.id]
            ) {
              fulfilObjective(quest.id, obj.id);
            }
          }
        }
      }
      persist();
    },

    dismissToast: (id) =>
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    reset: () =>
      set({
        bundle: null,
        lookups: null,
        level: 1,
        xpIntoLevel: 0,
        totalXp: 0,
        stats: {},
        knowledgePoints: 0,
        badges: [],
        questStatus: {},
        objectives: {},
        completedChallenges: {},
        toasts: [],
      }),

    isAllComplete: () => {
      const { bundle, questStatus } = get();
      if (!bundle || bundle.quests.length === 0) return false;
      return bundle.quests.every((q) => questStatus[q.id] === "complete");
    },

    giverIndicator: (npcId) => {
      const { lookups, questStatus } = get();
      const quests = lookups?.giverNpcToQuests.get(npcId);
      if (!quests || quests.length === 0) return null;
      // Priority: available offer > active > all complete.
      if (quests.some((q) => questStatus[q.id] === "available")) return "available";
      if (quests.some((q) => questStatus[q.id] === "active")) return "active";
      if (quests.every((q) => questStatus[q.id] === "complete")) return "complete";
      return null;
    },
  };
});
