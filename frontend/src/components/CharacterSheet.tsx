"use client";

import { useGameStore, xpToNext } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

interface CharacterSheetProps {
  bundle: GameBundle;
  onClose: () => void;
}

/** Hero sheet: identity, backstory, level/XP, knowledge stats, badges. */
export default function CharacterSheet({ bundle, onClose }: CharacterSheetProps) {
  const level = useGameStore((s) => s.level);
  const xpIntoLevel = useGameStore((s) => s.xpIntoLevel);
  const stats = useGameStore((s) => s.stats);
  const badges = useGameStore((s) => s.badges);
  const knowledgePoints = useGameStore((s) => s.knowledgePoints);

  const need = xpToNext(level);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cv-panel cv-scroll max-h-[88vh] w-full max-w-lg overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="cv-heading text-base text-accent">Hero</h2>
          <button
            className="cv-body text-lg text-slate-300 hover:text-white"
            onClick={onClose}
          >
            ✕ Close (C)
          </button>
        </div>

        <div className="mb-4 flex items-center gap-4">
          <div
            className="flex h-16 w-16 items-center justify-center border-4 border-frame text-3xl"
            style={{ background: bundle.player.avatar_color ?? "#1e2742" }}
          >
            🧑‍🚀
          </div>
          <div>
            <p className="cv-body text-2xl text-slate-100">
              {bundle.player.display_name}
            </p>
            <p className="cv-body text-lg text-slate-400">
              {bundle.player.title} · {bundle.player.role}
            </p>
            <p className="cv-body text-base text-accent">
              Level {level} · {xpIntoLevel}/{need} XP · 📘 {knowledgePoints}
            </p>
          </div>
        </div>

        {bundle.player.backstory && (
          <div className="cv-panel-raised mb-4 p-3">
            <h3 className="cv-heading mb-2 text-[0.6rem] text-slate-400">
              Backstory
            </h3>
            <p className="cv-body text-lg text-slate-200">
              {bundle.player.backstory}
            </p>
          </div>
        )}

        {Object.keys(stats).length > 0 && (
          <div className="mb-4">
            <h3 className="cv-heading mb-2 text-[0.6rem] text-slate-400">
              Knowledge stats
            </h3>
            <div className="flex flex-col gap-2">
              {Object.entries(stats).map(([name, value]) => (
                <div key={name}>
                  <div className="mb-0.5 flex justify-between">
                    <span className="cv-body text-base uppercase text-slate-300">
                      {name}
                    </span>
                    <span className="cv-body text-base text-slate-300">
                      {value}/100
                    </span>
                  </div>
                  <div className="h-3 w-full border-2 border-frame bg-ink">
                    <div
                      className="h-full bg-success"
                      style={{ width: `${Math.min(100, value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {badges.length > 0 && (
          <div>
            <h3 className="cv-heading mb-2 text-[0.6rem] text-slate-400">Badges</h3>
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span
                  key={b}
                  className="cv-body border-2 border-accent px-2 py-1 text-base text-accent"
                >
                  🎖️ {b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
