"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Typewriter from "./Typewriter";
import { useGameStore } from "@/state/gameStore";
import type { DialogueChoice, DialogueNode, GameBundle } from "@/types/bundle";

interface DialogueBoxProps {
  bundle: GameBundle;
  npcId: string;
  onClose: () => void;
  onOpenChat: (npcId: string) => void;
}

/** Choose the most relevant starting node given the giver's quest status. */
function pickStartNode(
  nodes: DialogueNode[],
  rootId: string,
  indicator: "available" | "active" | "complete" | null,
): string {
  const byType = (type: string) => nodes.find((n) => n.type === type)?.id;
  if (indicator === "complete") return byType("quest_complete") ?? rootId;
  if (indicator === "active") return byType("quest_active") ?? rootId;
  return rootId;
}

export default function DialogueBox({
  bundle,
  npcId,
  onClose,
  onOpenChat,
}: DialogueBoxProps) {
  const lookups = useGameStore((s) => s.lookups);
  const acceptQuest = useGameStore((s) => s.acceptQuest);
  const recordTalk = useGameStore((s) => s.recordTalk);
  const giverIndicator = useGameStore((s) => s.giverIndicator);

  const npc = lookups?.npcById.get(npcId) ?? null;
  const tree = lookups?.dialogueByNpcId.get(npcId) ?? null;

  const nodeMap = useMemo(() => {
    const map = new Map<string, DialogueNode>();
    tree?.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [tree]);

  const [nodeId, setNodeId] = useState<string>(() =>
    tree ? pickStartNode(tree.nodes, tree.root_node_id, giverIndicator(npcId)) : "",
  );
  const [skip, setSkip] = useState(false);
  const [textDone, setTextDone] = useState(false);
  // Keyboard-highlighted choice index (-1 = none).
  const [highlighted, setHighlighted] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const node = nodeMap.get(nodeId) ?? null;
  const choices = node?.choices ?? [];

  // Reset highlight when choices change.
  useEffect(() => { setHighlighted(0); }, [nodeId]);

  // Focus the box so keyboard events land here.
  useEffect(() => { boxRef.current?.focus(); }, [nodeId]);

  const goTo = useCallback((next: string | null | undefined) => {
    if (!next) { onClose(); return; }
    setSkip(false);
    setTextDone(false);
    setNodeId(next);
  }, [onClose]);

  const choose = useCallback(
    (choice: DialogueChoice) => {
      if (choice.triggers_quest_id) {
        acceptQuest(choice.triggers_quest_id);
        // Auto-complete any "talk" objective on this NPC now that the quest is active.
        recordTalk(npcId);
      }
      if (choice.ends_dialogue) { onClose(); return; }
      goTo(choice.next_node_id);
    },
    [acceptQuest, recordTalk, npcId, goTo, onClose],
  );

  const chooseByIndex = useCallback(
    (idx: number) => {
      if (!textDone) return;
      const effectiveChoices = choices.length > 0 ? choices : null;
      if (!effectiveChoices) { onClose(); return; }
      if (idx >= 0 && idx < effectiveChoices.length) choose(effectiveChoices[idx]);
    },
    [textDone, choices, choose, onClose],
  );

  // Keyboard handler: Space/click skips typewriter; arrows navigate choices; Enter selects.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if player is typing in a text field elsewhere.
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!textDone) {
          setSkip(true);
          return;
        }
        if (e.key === "Enter") {
          // Select highlighted choice or close if no choices.
          if (choices.length === 0) { onClose(); return; }
          chooseByIndex(highlighted);
        }
      }
      if (e.key === "ArrowDown" || e.key === "s") {
        e.preventDefault();
        if (textDone) setHighlighted((h) => (h + 1) % Math.max(1, choices.length || 1));
      }
      if (e.key === "ArrowUp" || e.key === "w") {
        e.preventDefault();
        if (textDone) setHighlighted((h) => (h - 1 + Math.max(1, choices.length || 1)) % Math.max(1, choices.length || 1));
      }
      if (e.key === "Escape") { onClose(); }
      // Number keys 1-9 for quick pick.
      const num = parseInt(e.key);
      if (!isNaN(num) && num >= 1 && num <= 9 && textDone) {
        chooseByIndex(num - 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textDone, choices, highlighted, chooseByIndex, onClose]);

  const speaker = node?.speaker || npc?.name || "NPC";
  const text =
    node?.text ||
    (npc ? `${npc.name} nods at you, but has nothing more to say right now.` : "…");

  return (
    <div
      ref={boxRef}
      tabIndex={-1}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 outline-none sm:p-6"
    >
      <div className="cv-panel w-full max-w-3xl p-4">
        {/* Speaker nameplate */}
        <div className="mb-2 flex items-center justify-between">
          <div className="cv-panel-raised inline-flex items-center gap-2 px-3 py-1">
            <span className="text-lg">🧙</span>
            <div className="leading-tight">
              <p className="cv-body text-lg text-accent">{speaker}</p>
              {npc && <p className="cv-body text-sm text-slate-400">{npc.title}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="cv-body text-[11px] text-slate-500">
              {textDone ? "↑↓ navigate · Enter select" : "Space to skip"}
            </span>
            <button className="cv-body text-lg text-slate-400 hover:text-white" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Dialogue text — click or Space to skip typewriter */}
        <p
          className="cv-body min-h-[5rem] cursor-pointer text-xl leading-relaxed text-slate-100"
          onClick={() => !textDone ? setSkip(true) : undefined}
        >
          <Typewriter text={text} speed={60} skip={skip} onDone={() => setTextDone(true)} />
        </p>

        {/* Choices */}
        <div className="mt-4 flex flex-col gap-2">
          {textDone &&
            choices.map((choice, i) => (
              <button
                key={choice.id}
                className="cv-btn w-full justify-start text-left text-[0.62rem]"
                style={
                  i === highlighted
                    ? { background: "#2a355c", borderColor: "#facc15", color: "#facc15" }
                    : undefined
                }
                onClick={() => choose(choice)}
              >
                <span className="mr-2 opacity-50">{i + 1}.</span>
                {choice.triggers_quest_id ? "❗ " : "▸ "}
                {choice.text}
              </button>
            ))}

          {textDone && choices.length === 0 && (
            <button className="cv-btn w-full text-[0.62rem]" onClick={onClose}>
              ▸ Farewell  <span className="ml-2 opacity-40">[Enter]</span>
            </button>
          )}
        </div>

        {/* Grounded chat */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-frame pt-3">
          <p className="cv-body text-base text-slate-500">
            Powered by grounded enterprise knowledge
          </p>
          <button className="cv-btn px-3 py-2 text-[0.6rem]" onClick={() => onOpenChat(npcId)}>
            💬 Ask anything
          </button>
        </div>
      </div>
    </div>
  );
}
