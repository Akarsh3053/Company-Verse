"use client";

import { useGameStore } from "@/state/gameStore";
import type { GameBundle } from "@/types/bundle";

interface CompletionScreenProps {
  bundle: GameBundle;
  onClose: () => void;
  onExit: () => void;
}

/** Shown when every quest is complete: a summary of the player's growth. */
export default function CompletionScreen({
  bundle,
  onClose,
  onExit,
}: CompletionScreenProps) {
  const level = useGameStore((s) => s.level);
  const stats = useGameStore((s) => s.stats);
  const badges = useGameStore((s) => s.badges);
  const knowledgePoints = useGameStore((s) => s.knowledgePoints);

  return (
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="cv-panel cv-scroll max-h-[90vh] w-full max-w-xl overflow-y-auto p-8 text-center">
        <div className="animate-floaty mb-3 text-5xl">🎉</div>
        <h1 className="cv-heading mb-2 text-xl text-accent">Onboarding Complete!</h1>
        <p className="cv-body mb-6 text-xl text-slate-200">
          {bundle.player.display_name}, you&apos;ve explored{" "}
          {bundle.world.metadata.company_name} and mastered every quest.
        </p>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <Stat label="Level" value={String(level)} />
          <Stat label="Knowledge" value={String(knowledgePoints)} />
          <Stat label="Badges" value={String(badges.length)} />
        </div>

        {badges.length > 0 && (
          <div className="mb-6">
            <h2 className="cv-heading mb-2 text-[0.6rem] text-slate-400">
              Badges earned
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
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

        {Object.keys(stats).length > 0 && (
          <div className="mb-6">
            <h2 className="cv-heading mb-2 text-[0.6rem] text-slate-400">
              Knowledge stats
            </h2>
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

        <div className="flex flex-col gap-3">
          <button className="cv-btn cv-btn-primary" onClick={onClose}>
            Keep exploring
          </button>
          <button className="cv-btn" onClick={onExit}>
            Return to title
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="cv-panel-raised p-3">
      <p className="cv-heading text-xl text-accent">{value}</p>
      <p className="cv-body text-base uppercase text-slate-400">{label}</p>
    </div>
  );
}
