"use client";

// ─────────────────────────────────────────────────────────────────────────────
// QuestTracker — persistent "what to do next" panel (bottom-right).
// Always shows the active quest (or next available quest) + the first
// incomplete objective + a clear navigation target so the player is never lost.
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

const DIFF_COLOR: Record<string, string> = {
  intro: "text-sky-400",
  easy: "text-success",
  medium: "text-accent",
  hard: "text-danger",
};

interface QuestTrackerProps {
  bundle: GameBundle;
}

export default function QuestTracker({ bundle }: QuestTrackerProps) {
  const questStatus = useGameStore((s) => s.questStatus);
  const objectives = useGameStore((s) => s.objectives);
  const lookups = useGameStore((s) => s.lookups);

  const tracked = useMemo(() => {
    const sorted = [...bundle.quests].sort((a, b) => a.order - b.order);

    const active = sorted.find((q) => questStatus[q.id] === "active");
    const available = sorted.find((q) => questStatus[q.id] === "available");
    const current = active ?? available;

    if (!current) {
      const allDone =
        bundle.quests.length > 0 &&
        bundle.quests.every((q) => questStatus[q.id] === "complete");
      return { quest: null, allDone };
    }

    const status = questStatus[current.id];
    const nextObj = current.objectives.find((o) => !objectives[o.id]);

    // Build an actionable navigation string.
    let nav: string | null = null;

    if (status === "available") {
      // Tell the player to find the quest giver.
      if (current.giver_npc_id) {
        const npc = lookups?.npcById.get(current.giver_npc_id);
        const region = lookups?.regionById.get(current.region_id);
        if (npc)
          nav = `Talk to ${npc.name}${region ? ` in ${region.name}` : ""}`;
      }
      if (!nav) {
        const region = lookups?.regionById.get(current.region_id);
        if (region) nav = `Head to ${region.name}`;
      }
    } else if (nextObj) {
      // Point toward the specific objective target.
      if (nextObj.target_npc_id) {
        const npc = lookups?.npcById.get(nextObj.target_npc_id);
        if (npc) {
          const region = lookups?.regionById.get(npc.region_id);
          nav = `Find ${npc.name}${region ? ` · ${region.name}` : ""}`;
        }
      }
      if (!nav && nextObj.target_landmark_id) {
        const region = lookups?.regionById.get(current.region_id);
        nav = `Explore the landmark${region ? ` in ${region.name}` : ""}`;
      }
      if (!nav && nextObj.target_region_id) {
        const region = lookups?.regionById.get(nextObj.target_region_id);
        if (region) nav = `Enter ${region.name}`;
      }
      if (
        !nav &&
        (nextObj.type === "challenge" || nextObj.type === "decision")
      ) {
        nav = `Press Q → Quest Log → Take Challenge`;
      }
      if (!nav) {
        const region = lookups?.regionById.get(current.region_id);
        if (region) nav = `Head to ${region.name}`;
      }
    }

    return { quest: current, status, nextObj, nav, allDone: false };
  }, [bundle.quests, questStatus, objectives, lookups]);

  if (!tracked.quest && !tracked.allDone) return null;

  if (tracked.allDone) {
    return (
      <div className="pointer-events-none fixed bottom-4 right-4 z-30">
        <div className="cv-panel p-3 text-center">
          <p className="cv-heading text-[0.55rem] text-success">
            ★ All quests complete!
          </p>
        </div>
      </div>
    );
  }

  const { quest, status, nextObj, nav } = tracked;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-30 w-72">
      <div className="cv-panel-raised border-l-4 border-accent p-3">
        {/* Header row */}
        <div className="mb-1 flex items-center justify-between gap-1">
          <span className="cv-heading text-[0.5rem] uppercase tracking-wider text-slate-400">
            {status === "active" ? "Active Quest" : "Quest Available ❗"}
          </span>
          <span
            className={`cv-heading text-[0.5rem] uppercase ${
              DIFF_COLOR[quest!.difficulty] ?? "text-slate-400"
            }`}
          >
            {quest!.difficulty}
          </span>
        </div>

        {/* Quest title */}
        <p className="cv-body mb-1 text-lg leading-tight text-slate-100">
          {quest!.title}
        </p>

        {/* Current objective */}
        {nextObj && (
          <p className="cv-body mb-2 text-sm leading-snug text-slate-400">
            {nextObj.description}
          </p>
        )}

        {/* Navigation target — the key "where to go" line */}
        {nav && (
          <div className="flex items-center gap-1.5 border-t border-frame pt-2">
            <span className="text-base text-accent">→</span>
            <p className="cv-body text-base font-semibold text-accent">{nav}</p>
          </div>
        )}
      </div>
    </div>
  );
}
