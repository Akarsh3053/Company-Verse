"use client";

import { useEffect, useState } from "react";
import { eventBus } from "@/game/eventBus";

/** Bottom-centre prompt ("Press E / tap to …") driven by the Phaser scene. */
export default function InteractionPrompt() {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    return eventBus.on("interaction:prompt", ({ label }) => setLabel(label));
  }, []);

  if (!label) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2 sm:bottom-10">
      <div className="cv-panel-raised animate-popIn flex items-center gap-2 px-4 py-2">
        <kbd className="cv-heading bg-ink px-2 py-1 text-[0.6rem] text-accent">
          E
        </kbd>
        <span className="cv-body text-lg text-slate-100">{label}</span>
      </div>
    </div>
  );
}
