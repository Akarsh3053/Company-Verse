"use client";

import { useEffect, useRef, useState } from "react";
import { chat, describeError } from "@/lib/api";
import { useGameStore } from "@/state/gameStore";
import type { ChatMessage, GameBundle } from "@/types/bundle";

interface ChatPanelProps {
  bundle: GameBundle;
  npcId: string;
  onClose: () => void;
}

/** Free-form, grounded chat with an NPC (POST /game/chat, multi-turn history). */
export default function ChatPanel({ bundle, npcId, onClose }: ChatPanelProps) {
  const lookups = useGameStore((s) => s.lookups);
  const npc = lookups?.npcById.get(npcId) ?? null;

  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [history, busy]);

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setError(null);
    const playerTurn: ChatMessage = { role: "player", content: message };
    const nextHistory = [...history, playerTurn];
    setHistory(nextHistory);
    setDraft("");
    setBusy(true);
    try {
      const response = await chat({
        user_key: bundle.metadata.user_key,
        npc_id: npcId,
        message,
        history,
      });
      setHistory([...nextHistory, { role: "npc", content: response.reply }]);
    } catch (err) {
      setError(describeError(err));
      // Roll back the optimistic player turn so they can retry the message.
      setHistory(history);
      setDraft(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col cv-panel">
      <div className="flex items-center justify-between border-b-4 border-frame px-4 py-3">
        <div className="leading-tight">
          <h2 className="cv-body text-xl text-accent">{npc?.name ?? "NPC"}</h2>
          <p className="cv-body text-sm text-slate-400">
            {npc?.title ?? ""} · grounded chat
          </p>
        </div>
        <button
          className="cv-body text-lg text-slate-300 hover:text-white"
          onClick={onClose}
        >
          ✕ Close
        </button>
      </div>

      <div ref={scrollRef} className="cv-scroll flex-1 overflow-y-auto p-4">
        {history.length === 0 && (
          <p className="cv-body text-lg text-slate-400">
            Ask {npc?.name ?? "this guide"} anything about{" "}
            {npc?.expertise?.[0] ?? "the company"} — answers are grounded in real
            enterprise knowledge.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {history.map((msg, i) => (
            <div
              key={i}
              className={`max-w-[85%] ${
                msg.role === "player" ? "self-end" : "self-start"
              }`}
            >
              <div
                className={`cv-panel-raised p-2 ${
                  msg.role === "player" ? "border-accent" : ""
                }`}
              >
                <p className="cv-body text-lg text-slate-100">{msg.content}</p>
              </div>
            </div>
          ))}
          {busy && (
            <div className="self-start">
              <div className="cv-panel-raised p-2">
                <span className="cv-body text-lg text-slate-400">
                  {npc?.name ?? "NPC"} is thinking
                  <span className="animate-blink">…</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="cv-body px-4 pb-1 text-base text-danger">{error}</p>
      )}

      <div className="flex gap-2 border-t-2 border-frame p-3">
        <input
          className="cv-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a question…"
          disabled={busy}
        />
        <button
          className="cv-btn cv-btn-primary px-3 text-[0.6rem]"
          onClick={send}
          disabled={busy || !draft.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
