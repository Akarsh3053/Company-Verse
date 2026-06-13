"use client";

import { useMemo, useState } from "react";
import { useGameStore } from "@/state/gameStore";
import type { Challenge, ChallengeOption, GameBundle } from "@/types/bundle";

interface ChallengeModalProps {
  bundle: GameBundle;
  challengeId: string;
  onClose: () => void;
}

/** Deterministic-ish shuffle so option order is stable within one mount. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  intro: "text-sky-300",
  easy: "text-success",
  medium: "text-accent",
  hard: "text-danger",
};

export default function ChallengeModal({
  bundle,
  challengeId,
  onClose,
}: ChallengeModalProps) {
  const completeChallenge = useGameStore((s) => s.completeChallenge);
  const alreadyDone = useGameStore((s) => !!s.completedChallenges[challengeId]);

  const challenge = useMemo<Challenge | null>(
    () => bundle.challenges.find((c) => c.id === challengeId) ?? null,
    [bundle.challenges, challengeId],
  );

  const isOrdering = challenge?.type === "ordering";

  // Single-select state.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  // Shuffled options (stable for this mount).
  const shuffled = useMemo(
    () => (challenge ? shuffle(challenge.options) : []),
    [challenge],
  );

  // Ordering state: current arrangement of option ids.
  const [order, setOrder] = useState<ChallengeOption[]>(shuffled);
  const [orderChecked, setOrderChecked] = useState(false);

  if (!challenge) {
    return (
      <Backdrop onClose={onClose}>
        <div className="cv-panel w-full max-w-lg p-6 text-center">
          <p className="cv-body text-lg text-slate-300">
            This challenge could not be found.
          </p>
          <button className="cv-btn mt-4" onClick={onClose}>
            Close
          </button>
        </div>
      </Backdrop>
    );
  }

  const selected = shuffled.find((o) => o.id === selectedId) ?? null;
  const isCorrect = committed && selected?.is_correct;

  const submitSingle = () => {
    if (!selected) return;
    setCommitted(true);
    if (selected.is_correct) completeChallenge(challenge.id);
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const orderCorrect =
    orderChecked &&
    order.every((opt, i) => (opt.order_index ?? i + 1) === i + 1);

  const submitOrder = () => {
    setOrderChecked(true);
    const correct = order.every((opt, i) => (opt.order_index ?? i + 1) === i + 1);
    if (correct) completeChallenge(challenge.id);
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="cv-panel cv-scroll max-h-[88vh] w-full max-w-2xl overflow-y-auto p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="cv-heading text-[0.6rem] text-slate-400">
            {challenge.type.toUpperCase()} CHALLENGE
          </span>
          <span
            className={`cv-body text-base uppercase ${DIFFICULTY_COLOR[challenge.difficulty] ?? "text-slate-400"}`}
          >
            {challenge.difficulty} · {challenge.reward_xp} XP
          </span>
        </div>

        <h2 className="cv-body mb-3 text-2xl text-accent">{challenge.title}</h2>

        {challenge.scenario && (
          <div className="cv-panel-raised mb-3 p-3">
            <p className="cv-body text-lg italic text-slate-300">
              {challenge.scenario}
            </p>
          </div>
        )}

        <p className="cv-body mb-4 text-xl text-slate-100">{challenge.prompt}</p>

        {alreadyDone && (
          <p className="cv-body mb-3 text-base text-success">
            ✓ You&apos;ve already mastered this challenge — replay for practice.
          </p>
        )}

        {/* ── Ordering challenge ─────────────────────────────────────────── */}
        {isOrdering ? (
          <div className="flex flex-col gap-2">
            <p className="cv-body text-base text-slate-400">
              Arrange the steps into the correct order:
            </p>
            {order.map((opt, i) => {
              const correctSpot =
                orderChecked && (opt.order_index ?? i + 1) === i + 1;
              const wrongSpot = orderChecked && !correctSpot;
              return (
                <div
                  key={opt.id}
                  className={`cv-panel-raised flex items-center gap-3 p-2 ${
                    correctSpot
                      ? "border-success"
                      : wrongSpot
                        ? "border-danger"
                        : ""
                  }`}
                >
                  <span className="cv-heading w-6 text-center text-[0.6rem] text-accent">
                    {i + 1}
                  </span>
                  <span className="cv-body flex-1 text-lg text-slate-100">
                    {opt.text}
                  </span>
                  {!orderChecked && (
                    <div className="flex flex-col">
                      <button
                        className="cv-body px-1 text-slate-300 hover:text-white"
                        onClick={() => move(i, -1)}
                        aria-label="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="cv-body px-1 text-slate-300 hover:text-white"
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {!orderChecked ? (
              <button className="cv-btn cv-btn-primary mt-2" onClick={submitOrder}>
                Submit order
              </button>
            ) : orderCorrect ? (
              <Outcome correct explanation={challenge.explanation} onClose={onClose} />
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <p className="cv-body text-lg text-danger">
                  Not quite — review the order and try again.
                </p>
                <button
                  className="cv-btn"
                  onClick={() => setOrderChecked(false)}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── Single-select (quiz / decision / scenario) ─────────────────── */
          <div className="flex flex-col gap-2">
            {shuffled.map((opt, idx) => {
              const isPicked = selectedId === opt.id;
              const reveal = committed;

              // Border + background computed explicitly — cv-panel-raised border must
              // be overridden via style= (Tailwind classes lose to the CSS rule).
              let borderColor = "#3b4a78";
              let bgColor = "transparent";
              let dimmed = false;
              if (!reveal && isPicked) {
                borderColor = "#facc15"; // gold = selected
                bgColor = "rgba(250,204,21,0.08)";
              } else if (reveal) {
                if (opt.is_correct) { borderColor = "#22c55e"; bgColor = "rgba(34,197,94,0.08)"; }
                else if (isPicked) { borderColor = "#ef4444"; bgColor = "rgba(239,68,68,0.08)"; }
                else { dimmed = true; } // wrong unchosen options — dim them
              }

              return (
                <div key={opt.id}>
                  <button
                    className="cv-panel-raised w-full p-3 text-left transition-colors"
                    style={{ borderColor, background: bgColor, opacity: dimmed ? 0.45 : 1 }}
                    disabled={committed}
                    onClick={() => setSelectedId(opt.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Selection indicator */}
                      <span
                        className="cv-heading mt-0.5 shrink-0 text-[0.55rem]"
                        style={{ color: borderColor }}
                      >
                        {!reveal && isPicked ? "●" : reveal && opt.is_correct ? "✓" : reveal && isPicked ? "✗" : `${idx + 1}.`}
                      </span>
                      <span className="cv-body text-lg text-slate-100">
                        {opt.text}
                      </span>
                    </div>
                  </button>
                  {reveal && isPicked && opt.feedback && (
                    <p
                      className={`cv-body mt-1 px-1 text-base ${
                        opt.is_correct ? "text-success" : "text-danger"
                      }`}
                    >
                      {opt.feedback}
                    </p>
                  )}
                </div>
              );
            })}

            {!committed ? (
              <button
                className="cv-btn cv-btn-primary mt-2"
                disabled={!selectedId}
                onClick={submitSingle}
              >
                Submit answer
              </button>
            ) : isCorrect ? (
              <Outcome correct explanation={challenge.explanation} onClose={onClose} />
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <button
                  className="cv-btn"
                  onClick={() => {
                    setCommitted(false);
                    setSelectedId(null);
                  }}
                >
                  Try again
                </button>
                <button
                  className="cv-body text-base text-slate-400 hover:text-white"
                  onClick={onClose}
                >
                  Close and come back later
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function Outcome({
  correct,
  explanation,
  onClose,
}: {
  correct: boolean;
  explanation: string;
  onClose: () => void;
}) {
  return (
    <div className="cv-panel-raised mt-3 border-success p-3">
      <p className="cv-heading mb-2 text-[0.6rem] text-success">
        {correct ? "✓ Correct!" : "Result"}
      </p>
      {explanation && (
        <p className="cv-body mb-3 text-lg text-slate-200">{explanation}</p>
      )}
      <button className="cv-btn cv-btn-primary w-full" onClick={onClose}>
        Continue ▶
      </button>
    </div>
  );
}

function Backdrop({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
