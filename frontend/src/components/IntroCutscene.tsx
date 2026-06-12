"use client";

import { useState } from "react";
import Typewriter from "./Typewriter";
import type { GameBundle } from "@/types/bundle";

interface IntroCutsceneProps {
  bundle: GameBundle;
  onBegin: () => void;
}

/** Opening cutscene: renders the AI-authored narrative_intro as a typewriter. */
export default function IntroCutscene({ bundle, onBegin }: IntroCutsceneProps) {
  const [done, setDone] = useState(false);
  const [skip, setSkip] = useState(false);

  const intro =
    bundle.narrative_intro?.trim() ||
    `Welcome, ${bundle.player.display_name}. Your onboarding adventure begins now.`;

  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6">
      <div className="cv-panel w-full max-w-2xl p-8">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl">📜</span>
          <h1 className="cv-heading text-base text-accent">
            {bundle.world.metadata.company_name}
          </h1>
        </div>

        <p
          className="cv-body min-h-[8rem] text-xl leading-relaxed text-slate-100"
          onClick={() => !done && setSkip(true)}
        >
          <Typewriter
            text={intro}
            speed={50}
            skip={skip}
            onDone={() => setDone(true)}
          />
        </p>

        <div className="mt-8 flex items-center justify-between">
          <p className="cv-body text-base text-slate-500">
            {done ? "" : "Click to skip"}
          </p>
          <button
            className="cv-btn cv-btn-primary"
            onClick={done ? onBegin : () => setSkip(true)}
          >
            {done ? "Begin ▶" : "Skip »"}
          </button>
        </div>
      </div>

      <div className="cv-body mt-6 text-center text-lg text-slate-400">
        Playing as{" "}
        <span className="text-accent">{bundle.player.display_name}</span> ·{" "}
        {bundle.player.title}
      </div>
    </main>
  );
}
