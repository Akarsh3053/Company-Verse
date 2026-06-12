"use client";

import { useEffect } from "react";
import { useGameStore, type Toast } from "@/state/gameStore";

const ICON: Record<Toast["kind"], string> = {
  quest: "🏆",
  level: "⬆️",
  badge: "🎖️",
  stat: "📈",
  info: "✨",
};

const ACCENT: Record<Toast["kind"], string> = {
  quest: "border-accent",
  level: "border-success",
  badge: "border-accent",
  stat: "border-frame",
  info: "border-frame",
};

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useGameStore((s) => s.dismissToast);

  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), 4200);
    return () => window.clearTimeout(id);
  }, [toast.id, dismiss]);

  return (
    <div
      className={`cv-panel-raised animate-popIn pointer-events-auto flex items-start gap-3 border-l-8 p-3 ${ACCENT[toast.kind]}`}
    >
      <span className="text-xl leading-none">{ICON[toast.kind]}</span>
      <div>
        <p className="cv-heading text-[0.6rem] text-accent">{toast.title}</p>
        {toast.detail && (
          <p className="cv-body text-base text-slate-300">{toast.detail}</p>
        )}
      </div>
    </div>
  );
}

/** Stacked, auto-dismissing notifications (quest complete, level up, badges). */
export default function Toaster() {
  const toasts = useGameStore((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed right-3 top-20 z-40 flex w-72 flex-col gap-2">
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}
