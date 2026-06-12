"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import LoadingScreen from "@/components/LoadingScreen";
import { createBundle, describeError } from "@/lib/api";
import { useSessionStore } from "@/state/sessionStore";
import type { UserPersona } from "@/types/bundle";

type Phase = "form" | "loading" | "error";

export default function NewGamePage() {
  const router = useRouter();
  const setBundle = useSessionStore((s) => s.setBundle);
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const lastPersona = useRef<UserPersona | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(
    async (persona: UserPersona) => {
      lastPersona.current = persona;
      setPhase("loading");
      setError(null);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const bundle = await createBundle(persona, controller.signal);
        setBundle(bundle);
        router.push(
          `/play?key=${encodeURIComponent(bundle.metadata.user_key)}&intro=1`,
        );
      } catch (err) {
        setError(describeError(err));
        setPhase("error");
      }
    },
    [router, setBundle],
  );

  const retry = useCallback(() => {
    if (lastPersona.current) start(lastPersona.current);
  }, [start]);

  if (phase === "loading") {
    return <LoadingScreen />;
  }

  if (phase === "error") {
    return (
      <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6">
        <div className="cv-panel w-full max-w-md p-6 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h1 className="cv-heading mb-3 text-base text-danger">
            Generation failed
          </h1>
          <p className="cv-body mb-6 text-lg text-slate-300">{error}</p>
          <div className="flex flex-col gap-3">
            <button className="cv-btn cv-btn-primary" onClick={retry}>
              Retry
            </button>
            <button className="cv-btn" onClick={() => setPhase("form")}>
              Edit profile
            </button>
            <button
              className="cv-body text-base text-slate-400 hover:text-white"
              onClick={() => router.push("/")}
            >
              ← Back to title
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6">
      <button
        className="cv-body absolute left-4 top-4 text-lg text-slate-400 hover:text-white"
        onClick={() => router.push("/")}
      >
        ← Title
      </button>
      <ProfileForm onSubmit={start} />
    </main>
  );
}
