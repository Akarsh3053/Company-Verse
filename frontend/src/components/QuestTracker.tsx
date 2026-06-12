"use client";

// ─────────────────────────────────────────────────────────────────────────────
// QuestTracker — collapsible pull-up drawer (bottom-right).
// • Collapsed: a small tab with a blinking indicator when there's new info.
// • Expanded: quest name + current objective + nav target.
// • Auto-opens when the tracked quest changes (new quest unlocked/accepted).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
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
  const completedChallenges = useGameStore((s) => s.completedChallenges);
  const lookups = useGameStore((s) => s.lookups);

  const [open, setOpen] = useState(true);
  // Track whether the content changed while drawer was closed (drives blink).
  const [needsAttention, setNeedsAttention] = useState(false);
  // Track the id of the quest currently being tracked to detect changes.
  const lastTrackedId = useRef<string | null>(null);

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
    // nextObj: first incomplete objective, skipping challenge-type objectives
    // whose challenge is already done (completedChallenges tracks those).
    const nextObj = current.objectives.find((o) => {
      if (objectives[o.id]) return false; // objective flag set
      if (
        (o.type === "challenge" || o.type === "decision") &&
        o.challenge_id &&
        completedChallenges[o.challenge_id]
      )
        return false; // challenge done even if objective flag not yet set
      return true;
    });

    let nav: string | null = null;
    if (status === "available") {
      // If the quest has *uncompleted* challenges, point to the in-world glyph.
      // If all challenges are already done, fall through to the NPC giver hint.
      const uncompletedChallenges = (current.challenge_ids ?? []).filter(
        (id) => !completedChallenges[id]
      );
      if (uncompletedChallenges.length > 0) {
        const region = lookups?.regionById.get(current.region_id);
        nav = `Find the \u2605 challenge glyph${region ? ` in ${region.name}` : ""}`;
      } else if (current.giver_npc_id) {
        const npc = lookups?.npcById.get(current.giver_npc_id);
        const region = lookups?.regionById.get(current.region_id);
        if (npc) nav = `Talk to ${npc.name}${region ? ` in ${region.name}` : ""}`;
      }
      if (!nav) {
        const region = lookups?.regionById.get(current.region_id);
        if (region) nav = `Head to ${region.name}`;
      }
    } else if (nextObj) {
      if (nextObj.target_npc_id) {
        const npc = lookups?.npcById.get(nextObj.target_npc_id);
        if (npc) {
          const region = lookups?.regionById.get(npc.region_id);
          nav = `Find ${npc.name}${region ? ` · ${region.name}` : ""}`;
        }
      }
      if (!nav && nextObj.target_landmark_id) {
        const region = lookups?.regionById.get(current.region_id);
        nav = `Explore landmark${region ? ` in ${region.name}` : ""}`;
      }
      if (!nav && nextObj.target_region_id) {
        const region = lookups?.regionById.get(nextObj.target_region_id);
        if (region) nav = `Enter ${region.name}`;
      }
      if (!nav && (nextObj.type === "challenge" || nextObj.type === "decision")) {
        // Only show glyph hint if the challenge itself is still uncompleted.
        const cid = nextObj.challenge_id;
        if (!cid || !completedChallenges[cid]) {
          const region = lookups?.regionById.get(current.region_id);
          nav = `Find the ★ challenge glyph${region ? ` in ${region.name}` : ""}`;
        }
      }
      if (!nav) {
        const region = lookups?.regionById.get(current.region_id);
        if (region) nav = `Head to ${region.name}`;
      }
    }

    return { quest: current, status, nextObj, nav, allDone: false };
  }, [bundle.quests, questStatus, objectives, completedChallenges, lookups]);

  // Auto-open + set attention whenever the tracked quest changes.
  useEffect(() => {
    const id = tracked.quest?.id ?? null;
    if (id !== lastTrackedId.current) {
      lastTrackedId.current = id;
      if (id !== null) {
        setOpen(true);       // auto-open on new quest
        setNeedsAttention(false);
      }
    }
  }, [tracked.quest?.id]);

  // While closed, any objective change should light up the attention blink.
  useEffect(() => {
    if (!open && tracked.quest) setNeedsAttention(true);
  }, [objectives, open, tracked.quest]);

  // Q key toggles the tracker.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) return;
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) setNeedsAttention(false);
          return !v;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggle = () => {
    setOpen((v) => {
      if (!v) setNeedsAttention(false); // clear blink when opening
      return !v;
    });
  };

  if (!tracked.quest && !tracked.allDone) return null;

  // ── Tab (always visible) ────────────────────────────────────────────────
  const Tab = (
    <button
      onClick={toggle}
      className="pointer-events-auto flex items-center gap-2 px-3 py-1.5"
      style={{
        background: "rgba(11,16,32,0.95)",
        border: "2px solid #3b4a78",
        borderBottom: open ? "none" : "2px solid #3b4a78",
        borderRadius: open ? "6px 6px 0 0" : "6px",
        cursor: "pointer",
      }}
      title={open ? "Collapse quest tracker" : "Expand quest tracker"}
    >
      {/* Attention blink dot */}
      {needsAttention && !open && (
        <span className="animate-blink inline-block h-2 w-2 rounded-full bg-accent" />
      )}
      <span className="cv-heading text-[0.55rem] text-slate-400 uppercase tracking-widest">
        {tracked.allDone ? "✓ Complete" : tracked.quest?.title.slice(0, 22) + (((tracked.quest?.title.length ?? 0) > 22) ? "…" : "")}
      </span>
      {/* Quest status pip */}
      {!tracked.allDone && (
        <span
          className={`cv-body text-[11px] uppercase ${DIFF_COLOR[tracked.quest!.difficulty] ?? "text-slate-400"}`}
        >
          {tracked.quest!.status === "active" ? "▸" : "!"}
        </span>
      )}
      <span className="cv-body text-sm text-slate-500">{open ? "▼ (Q)" : "▲ (Q)"}</span>
    </button>
  );

  // ── All done state ──────────────────────────────────────────────────────
  if (tracked.allDone) {
    return (
      <div className="pointer-events-none fixed bottom-0 right-4 z-30 flex flex-col items-end">
        {Tab}
        {open && (
          <div
            className="pointer-events-auto w-72 p-3 text-center"
            style={{
              background: "rgba(11,16,32,0.95)",
              border: "2px solid #3b4a78",
              borderRadius: "6px 0 6px 6px",
            }}
          >
            <p className="cv-heading text-[0.55rem] text-success">★ All quests complete!</p>
          </div>
        )}
      </div>
    );
  }

  const { quest, status, nextObj, nav } = tracked;

  // ── Normal tracker ──────────────────────────────────────────────────────
  return (
    <div className="pointer-events-none fixed bottom-0 right-4 z-30 flex flex-col items-end">
      {Tab}
      {open && (
        <div
          className="pointer-events-auto w-72 p-3"
          style={{
            background: "rgba(11,16,32,0.95)",
            border: "2px solid #facc15",
            borderTop: "2px solid #3b4a78",
            borderRadius: "6px 0 6px 6px",
          }}
        >
          {/* Status label */}
          <div className="mb-1 flex items-center justify-between gap-1">
            <span className="cv-heading text-[0.5rem] uppercase tracking-wider text-slate-400">
              {status === "active" ? "Active Quest" : "Quest Available ❗"}
            </span>
            <span className={`cv-body text-[11px] uppercase ${DIFF_COLOR[quest!.difficulty] ?? "text-slate-400"}`}>
              {quest!.difficulty}
            </span>
          </div>

          {/* Quest title */}
          <p className="cv-body mb-1 text-lg leading-tight text-slate-100">{quest!.title}</p>

          {/* Current objective */}
          {nextObj && (
            <p className="cv-body mb-2 text-sm leading-snug text-slate-400">
              {nextObj.description}
            </p>
          )}

          {/* Nav target */}
          {nav && (
            <div className="flex items-center gap-1.5 border-t border-frame pt-2">
              <span className="text-base text-accent">→</span>
              <p className="cv-body text-base font-semibold text-accent">{nav}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
