"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { listBundles, describeError } from "@/lib/api";

export default function TitlePage() {
  const router = useRouter();
  const [showContinue, setShowContinue] = useState(false);
  const [keys, setKeys] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openContinue = useCallback(async () => {
    setShowContinue(true);
    setLoading(true);
    setError(null);
    try {
      const result = await listBundles();
      setKeys(result);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <main className="cv-starfield flex min-h-screen flex-col items-center justify-center p-6">
      <div className="animate-floaty mb-2 text-6xl">🌐</div>
      <h1 className="cv-heading mb-3 text-center text-2xl text-accent sm:text-4xl">
        CompanyVerse
      </h1>
      <p className="cv-body mb-10 max-w-md text-center text-xl text-slate-300">
        Turn enterprise knowledge into a personalized, playable onboarding
        adventure. Explore regions, meet guides, complete quests, and learn how
        the company really works.
      </p>

      {!showContinue ? (
        <div className="flex w-full max-w-xs flex-col gap-4">
          <button
            className="cv-btn cv-btn-primary"
            onClick={() => router.push("/new")}
          >
            ▶ New Game
          </button>
          <button className="cv-btn" onClick={openContinue}>
            Continue
          </button>
        </div>
      ) : (
        <div className="cv-panel w-full max-w-md p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="cv-heading text-sm text-accent">Continue</h2>
            <button
              className="cv-body text-lg text-slate-400 hover:text-white"
              onClick={() => setShowContinue(false)}
            >
              ✕ Back
            </button>
          </div>

          {loading && (
            <p className="cv-body text-lg text-slate-300">Loading saved games…</p>
          )}
          {error && (
            <div className="cv-body text-lg text-danger">
              {error}
              <button className="cv-btn mt-3 w-full" onClick={openContinue}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && keys && keys.length === 0 && (
            <p className="cv-body text-lg text-slate-300">
              No saved games yet. Start a New Game to begin your adventure.
            </p>
          )}
          {!loading && !error && keys && keys.length > 0 && (
            <ul className="cv-scroll flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
              {keys.map((key) => (
                <li key={key}>
                  <button
                    className="cv-btn w-full justify-start text-left"
                    onClick={() => router.push(`/play?key=${encodeURIComponent(key)}`)}
                  >
                    {key}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer className="cv-body absolute bottom-4 text-center text-base text-slate-500">
        Microsoft Agents League · Track 1 · Powered by Foundry IQ + Azure AI
        Foundry
      </footer>
    </main>
  );
}
