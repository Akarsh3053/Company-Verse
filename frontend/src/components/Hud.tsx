"use client";

import { useGameStore, xpToNext } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

interface HudProps {
  bundle: GameBundle;
  onToggleQuests: () => void;
  onToggleCharacter: () => void;
  questLogOpen: boolean;
}

function StatChip({ name, value }: { name: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="flex min-w-[5.5rem] flex-col gap-0.5">
      <div className="flex justify-between">
        <span className="cv-body text-sm uppercase text-slate-400">{name}</span>
        <span className="cv-body text-sm text-slate-200">{pct}</span>
      </div>
      <div className="h-2 w-full border border-frame bg-ink">
        <div className="h-full bg-success" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Persistent top bar: identity, level, XP, knowledge points, stats, toggles. */
export default function Hud({
  bundle,
  onToggleQuests,
  onToggleCharacter,
  questLogOpen,
}: HudProps) {
  const level = useGameStore((s) => s.level);
  const xpIntoLevel = useGameStore((s) => s.xpIntoLevel);
  const knowledgePoints = useGameStore((s) => s.knowledgePoints);
  const stats = useGameStore((s) => s.stats);
  const badges = useGameStore((s) => s.badges);
  const questStatus = useGameStore((s) => s.questStatus);

  const need = xpToNext(level);
  const xpPct = Math.round((xpIntoLevel / need) * 100);
  const totalQuests = bundle.quests.length;
  const doneQuests = bundle.quests.filter(
    (q) => questStatus[q.id] === "complete",
  ).length;

  const statEntries = Object.entries(stats);

  return (
    <div className="pointer-events-auto fixed inset-x-0 top-0 z-30 p-2">
      <div className="cv-panel-raised flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
        {/* Identity + level */}
        <div className="flex items-center gap-2">
          <span className="cv-heading bg-ink px-2 py-1 text-[0.6rem] text-accent">
            Lv {level}
          </span>
          <div className="leading-tight">
            <p className="cv-body text-lg text-slate-100">
              {bundle.player.display_name}
            </p>
            <p className="cv-body text-sm text-slate-400">
              {bundle.player.title}
            </p>
          </div>
        </div>

        {/* XP bar */}
        <div className="min-w-[8rem] flex-1">
          <div className="mb-0.5 flex justify-between">
            <span className="cv-body text-sm uppercase text-slate-400">XP</span>
            <span className="cv-body text-sm text-slate-300">
              {xpIntoLevel}/{need}
            </span>
          </div>
          <div className="h-3 w-full border-2 border-frame bg-ink">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>

        {/* Knowledge points + badges */}
        <div className="flex items-center gap-3">
          <span className="cv-body text-lg text-sky-300" title="Knowledge points">
            📘 {knowledgePoints}
          </span>
          <span className="cv-body text-lg text-accent" title="Badges">
            🎖️ {badges.length}
          </span>
        </div>

        {/* Stats (compact, wrapping) */}
        <div className="hidden flex-wrap items-center gap-3 md:flex">
          {statEntries.slice(0, 5).map(([name, value]) => (
            <StatChip key={name} name={name} value={value} />
          ))}
        </div>

        {/* Controls */}
        <div className="ml-auto flex items-center gap-2">
          <button
            className={`cv-btn px-3 py-2 text-[0.6rem] ${questLogOpen ? "cv-btn-primary" : ""}`}
            onClick={onToggleQuests}
            title="Quest Log (Q)"
          >
            Quests {doneQuests}/{totalQuests}
          </button>
          <button
            className="cv-btn px-3 py-2 text-[0.6rem]"
            onClick={onToggleCharacter}
            title="Character (C)"
          >
            Hero
          </button>
        </div>
      </div>
    </div>
  );
}
