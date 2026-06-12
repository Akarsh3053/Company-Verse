"use client";

import { useGameStore, xpToNext } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

interface HudProps {
  bundle: GameBundle;
  onToggleQuests: () => void;
  onToggleCharacter: () => void;
  questLogOpen: boolean;
}

/**
 * Pokémon-style HUD — single compact bar at the top.
 * Left: name + level pill. Centre: XP bar. Right: quick stats row + menu buttons.
 * Intentionally minimal so the world canvas stays the hero.
 */
export default function Hud({
  bundle,
  onToggleQuests,
  onToggleCharacter,
  questLogOpen,
}: HudProps) {
  const level = useGameStore((s) => s.level);
  const xpIntoLevel = useGameStore((s) => s.xpIntoLevel);
  const knowledgePoints = useGameStore((s) => s.knowledgePoints);
  const badges = useGameStore((s) => s.badges);
  const questStatus = useGameStore((s) => s.questStatus);
  const stats = useGameStore((s) => s.stats);

  const need = xpToNext(level);
  const xpPct = Math.round((xpIntoLevel / need) * 100);
  const totalQuests = bundle.quests.length;
  const doneQuests = bundle.quests.filter((q) => questStatus[q.id] === "complete").length;

  // Top-3 stats as tiny coloured pips — avoids wrapping on narrow screens.
  const topStats = Object.entries(stats).slice(0, 4);

  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-30">
      {/* Single bar, max 56 px tall */}
      <div
        style={{ background: "rgba(11,16,32,0.92)", borderBottom: "3px solid #3b4a78" }}
        className="flex items-center gap-3 px-3 py-1.5"
      >
        {/* ── Level badge + name ───────────────────────────────────────────── */}
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

        {/* ── XP bar ───────────────────────────────────────────────────────── */}
        <div className="flex min-w-[90px] flex-1 flex-col gap-0.5">
          <div className="flex justify-between">
            <span className="cv-body text-[11px] uppercase text-slate-500">XP</span>
            <span className="cv-body text-[11px] text-slate-400">
              {xpIntoLevel}/{need}
            </span>
          </div>
          <div className="h-2 w-full border border-frame bg-ink">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {/* ── Knowledge + badges ───────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-2 text-[13px]">
          <span className="cv-body text-sky-300" title="Knowledge">📘{knowledgePoints}</span>
          <span className="cv-body text-accent" title="Badges">🎖️{badges.length}</span>
        </div>

        {/* ── Stat pips (hidden below md) ──────────────────────────────────── */}
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

        {/* ── Menu buttons ─────────────────────────────────────────────────── */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button
            style={{
              background: questLogOpen ? "#b8860b" : "#1e2742",
              border: `2px solid ${questLogOpen ? "#facc15" : "#3b4a78"}`,
              color: questLogOpen ? "#0b1020" : "#e5e7eb",
            }}
            className="cv-heading px-2.5 py-1 text-[0.55rem]"
            onClick={onToggleQuests}
            title="Quest Log (Q)"
          >
            QUESTS {doneQuests}/{totalQuests}
          </button>
          <button
            style={{ background: "#1e2742", border: "2px solid #3b4a78", color: "#e5e7eb" }}
            className="cv-heading px-2.5 py-1 text-[0.55rem]"
            onClick={onToggleCharacter}
            title="Hero (C)"
          >
            HERO
          </button>
        </div>
      </div>
    </div>
  );
}
