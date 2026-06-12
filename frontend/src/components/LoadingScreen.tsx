"use client";

import { useEffect, useState } from "react";

// Cosmetic, stepped narrative reflecting the backend pipeline. The backend
// returns one response (60–90s); we advance steps on a timer and HOLD on the
// last step until the bundle lands (frontend.md §7.3).
const STEPS = [
  "Surveying the company's regions…",
  "Recruiting your guides from real teams…",
  "Charting your personalized quest line…",
  "Designing knowledge challenges…",
  "Grounding everything in enterprise knowledge…",
  "Waking your character…",
];

const TIPS = [
  "Tip: Press E (or tap) near an NPC to talk and pick up quests.",
  "Lore: Every region is a real team. Every landmark is a real system.",
  "Tip: Toggle the Quest Log with Q to see your objectives.",
  "Lore: Quests are generated from real onboarding docs and runbooks.",
  "Tip: Ask NPCs anything — their answers are grounded in company knowledge.",
  "Tip: Complete challenges to grow your stats and unlock new quests.",
];

interface LoadingScreenProps {
  /** Company name from the persona's org, if known (cosmetic only). */
  companyName?: string;
}

export default function LoadingScreen({ companyName }: LoadingScreenProps) {
  const [step, setStep] = useState(0);
  const [tip, setTip] = useState(0);

  useEffect(() => {
    // Advance steps roughly every 12s, but never past the final "Waking…" step.
    const id = window.setInterval(() => {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }, 12_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTip((t) => (t + 1) % TIPS.length);
    }, 5_000);
    return () => window.clearInterval(id);
  }, []);

  const pct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6">
      <div className="animate-floaty mb-6 text-5xl">🛠️</div>
      <h1 className="cv-heading mb-2 text-center text-lg text-accent">
        Building your world{companyName ? `: ${companyName}` : ""}
      </h1>
      <p className="cv-body mb-8 text-center text-lg text-slate-400">
        This takes about a minute — the AI is generating everything from scratch.
      </p>

      <div className="cv-panel w-full max-w-lg p-6">
        <ul className="mb-5 flex flex-col gap-2">
          {STEPS.map((label, i) => (
            <li
              key={label}
              className={`cv-body flex items-center gap-3 text-lg ${
                i < step
                  ? "text-success"
                  : i === step
                    ? "text-accent"
                    : "text-slate-600"
              }`}
            >
              <span className="w-5 text-center">
                {i < step ? "✓" : i === step ? "▸" : "·"}
              </span>
              <span>{label}</span>
              {i === step && <span className="animate-blink">…</span>}
            </li>
          ))}
        </ul>

        <div className="mb-2 h-4 w-full border-2 border-frame bg-ink">
          <div
            className="h-full bg-accent transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="cv-body text-right text-base text-slate-400">{pct}%</p>
      </div>

      <p
        key={tip}
        className="cv-body animate-popIn mt-8 max-w-md text-center text-lg text-slate-300"
      >
        {TIPS[tip]}
      </p>
    </main>
  );
}
