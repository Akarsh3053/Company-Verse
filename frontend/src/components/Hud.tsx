"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore, xpToNext } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

interface HudProps {
  bundle: GameBundle;
  onToggleCharacter: () => void;
}

const STATUS_ICON: Record<string, string> = {
  active: "▸",
  available: "!",
  locked: "🔒",
  complete: "✓",
};

const STATUS_ORDER = ["active", "available", "locked", "complete"];

/**
 * Pokémon-style HUD — single compact bar at the top.
 * The QUESTS button expands an inline dropdown showing all quests grouped
 * by status (active › available › locked › complete-greyed).
 * Q key is handled by QuestTracker (bottom-right drawer) — not here.
 */
export default function Hud({ bundle, onToggleCharacter }: HudProps) {
  const level = useGameStore((s) => s.level);
  const xpIntoLevel = useGameStore((s) => s.xpIntoLevel);
  const knowledgePoints = useGameStore((s) => s.knowledgePoints);
  const badges = useGameStore((s) => s.badges);
  const questStatus = useGameStore((s) => s.questStatus);
  const stats = useGameStore((s) => s.stats);

  const [questOpen, setQuestOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // J key toggles the quest dropdown.
  // (Q is reserved for the bottom-right QuestTracker drawer.)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) return;
      if (e.key === "j" || e.key === "J") {
        e.preventDefault();
        setQuestOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const need = xpToNext(level);
  const xpPct = Math.round((xpIntoLevel / need) * 100);
  const totalQuests = bundle.quests.length;
  const doneQuests = bundle.quests.filter((q) => questStatus[q.id] === "complete").length;

  const topStats = Object.entries(stats).slice(0, 4);

  // Sort quests into groups.
  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    quests: [...bundle.quests]
      .sort((a, b) => a.order - b.order)
      .filter((q) => (questStatus[q.id] ?? "locked") === s),
  })).filter((g) => g.quests.length > 0);

  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-30">
      {/* ── Main bar ───────────────────────────────────────────────────────── */}
      <div
        style={{ background: "rgba(11,16,32,0.92)", borderBottom: "3px solid #3b4a78" }}
        className="flex items-center gap-3 px-3 py-1.5"
      >
        {/* Level + name */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            style={{ background: "#1e2742", border: "2px solid #facc15" }}
            className="cv-heading px-2 py-0.5 text-[0.58rem] text-accent"
          >
            Lv {level}
          </span>
          <span className="cv-body hidden text-lg leading-none text-slate-100 sm:inline">
            {bundle.player.display_name}
          </span>
        </div>

        {/* XP bar */}
        <div className="flex min-w-[90px] flex-1 flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="cv-body text-[11px] uppercase text-slate-500">XP</span>
            <span className="cv-body text-[11px] text-slate-400">{xpIntoLevel}/{need}</span>
          </div>
          <div className="h-2 w-full border border-frame bg-ink">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${xpPct}%` }} />
          </div>
        </div>

        {/* Knowledge + badges */}
        <div className="flex shrink-0 items-center gap-2 text-[13px]">
          <span className="cv-body text-sky-300" title="Knowledge">📘{knowledgePoints}</span>
          <span className="cv-body text-accent" title="Badges">🎖️{badges.length}</span>
        </div>

        {/* Stat pips */}
        {topStats.length > 0 && (
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            {topStats.map(([name, val]) => (
              <div key={name} className="flex items-center gap-1">
                <span className="cv-body text-[11px] uppercase text-slate-500">{name.slice(0, 3)}</span>
                <div className="h-1.5 w-12 border border-frame bg-ink">
                  <div className="h-full bg-success" style={{ width: `${Math.min(100, val)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* Quest history button */}
          <div className="relative">
            <button
              style={{
                background: questOpen ? "#1e3a1e" : "#1e2742",
                border: `2px solid ${questOpen ? "#22c55e" : "#3b4a78"}`,
                color: questOpen ? "#22c55e" : "#e5e7eb",
              }}
              className="cv-heading px-2.5 py-1 text-[0.55rem]"
              onClick={() => setQuestOpen((v) => !v)}
              title="Quest History (J)"
            >
              QUESTS {doneQuests}/{totalQuests} {questOpen ? "▲" : "▼"} <span style={{opacity:0.55}}>(J)</span>
            </button>
          </div>

          <button
            style={{ background: "#1e2742", border: "2px solid #3b4a78", color: "#e5e7eb" }}
            className="cv-heading px-2.5 py-1 text-[0.55rem]"
            onClick={onToggleCharacter}
            title="Hero sheet (C)"
          >
            HERO <span style={{ opacity: 0.55 }}>(C)</span>
          </button>
        </div>
      </div>

      {/* ── Quest dropdown ─────────────────────────────────────────────────── */}
      {questOpen && (
        <div
          ref={dropRef}
          style={{
            background: "rgba(11,16,32,0.97)",
            border: "2px solid #3b4a78",
            borderTop: "none",
            maxHeight: "calc(100vh - 70px)",
          }}
          className="cv-scroll absolute right-0 top-full w-80 overflow-y-auto"
          // Close on click-outside handled via the button toggle.
        >
          <div className="p-3">
            <p className="cv-heading mb-3 text-[0.58rem] text-slate-400 uppercase tracking-widest">
              Quest History
            </p>
            {grouped.map(({ status, quests }) => (
              <div key={status} className="mb-3">
                {/* Group header */}
                <p className="cv-heading mb-1 text-[0.5rem] uppercase tracking-widest"
                  style={{ color: status === "active" ? "#facc15" : status === "available" ? "#38bdf8" : status === "complete" ? "#22c55e" : "#4b5563" }}>
                  {status === "active" ? "▸ In Progress" : status === "available" ? "! Available" : status === "locked" ? "🔒 Upcoming" : "✓ Completed"}
                </p>

                {quests.map((quest) => {
                  const isComplete = status === "complete";
                  const isLocked = status === "locked";
                  return (
                    <div
                      key={quest.id}
                      style={{
                        background: status === "active" ? "rgba(250,204,21,0.07)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${status === "active" ? "#3b4a78" : "#1e2742"}`,
                        opacity: isLocked ? 0.5 : 1,
                      }}
                      className="mb-1 px-2 py-1.5"
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="cv-body mt-0.5 shrink-0 text-[11px]"
                          style={{ color: status === "active" ? "#facc15" : status === "available" ? "#38bdf8" : status === "complete" ? "#22c55e" : "#4b5563" }}>
                          {STATUS_ICON[status] ?? "·"}
                        </span>
                        <p className={`cv-body text-sm leading-snug ${isComplete ? "text-slate-500 line-through" : isLocked ? "text-slate-500" : "text-slate-100"}`}>
                          {quest.title}
                        </p>
                      </div>
                      {!isLocked && !isComplete && (
                        <p className="cv-body mt-0.5 pl-4 text-[11px] text-slate-500">
                          {quest.summary.slice(0, 60)}{quest.summary.length > 60 ? "…" : ""}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
