"use client";

import { useEffect } from "react";

interface ControlsScreenProps {
  onDismiss: () => void;
}

const CONTROLS = [
  { keys: ["W", "A", "S", "D", "↑↓←→"], action: "Move character" },
  { keys: ["E"], action: "Interact / Talk to NPC / Take challenge" },
  { keys: ["Space"], action: "Skip typewriter / Advance dialogue" },
  { keys: ["↑ ↓"], action: "Navigate dialogue choices" },
  { keys: ["Enter"], action: "Select highlighted choice" },
  { keys: ["1–9"], action: "Quick-pick a dialogue choice" },
  { keys: ["Esc"], action: "Close current overlay" },
];

const HUD_KEYS = [
  { keys: ["Q"], action: "Toggle quest tracker (bottom-right)" },
  { keys: ["J"], action: "Toggle quest history (HUD top bar)" },
  { keys: ["C"], action: "Open hero / character sheet" },
];

export default function ControlsScreen({ onDismiss }: ControlsScreenProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        onDismiss();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDismiss]);

  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-4">
      <div className="cv-panel w-full max-w-xl p-6">
        {/* Title */}
        <h1 className="cv-heading mb-1 text-center text-base text-accent">
          Controls
        </h1>
        <p className="cv-body mb-5 text-center text-base text-slate-400">
          Learn these and you&apos;re ready to explore.
        </p>

        {/* Movement + interaction */}
        <div className="mb-4">
          <h2 className="cv-heading mb-2 text-[0.55rem] uppercase tracking-widest text-slate-500">
            World
          </h2>
          <div className="flex flex-col gap-1.5">
            {CONTROLS.map(({ keys, action }) => (
              <div key={action} className="flex items-center gap-3">
                <div className="flex shrink-0 flex-wrap gap-1">
                  {keys.map((k) => (
                    <kbd
                      key={k}
                      className="cv-heading inline-block rounded border border-frame bg-ink px-1.5 py-0.5 text-[0.55rem] text-accent"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="cv-body text-base text-slate-200">{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* HUD shortcuts */}
        <div className="mb-6">
          <h2 className="cv-heading mb-2 text-[0.55rem] uppercase tracking-widest text-slate-500">
            HUD
          </h2>
          <div className="flex flex-col gap-1.5">
            {HUD_KEYS.map(({ keys, action }) => (
              <div key={action} className="flex items-center gap-3">
                <div className="flex shrink-0 flex-wrap gap-1">
                  {keys.map((k) => (
                    <kbd
                      key={k}
                      className="cv-heading inline-block rounded border border-frame bg-ink px-1.5 py-0.5 text-[0.55rem] text-accent"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
                <span className="cv-body text-base text-slate-200">{action}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dismiss */}
        <button
          className="cv-btn cv-btn-primary w-full"
          onClick={onDismiss}
          autoFocus
        >
          Start Exploring ▶ <span className="ml-2 opacity-50">[Enter]</span>
        </button>
      </div>
    </main>
  );
}
