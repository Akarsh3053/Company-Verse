"use client";

import { useCallback, useMemo, useState } from "react";
import Typewriter from "./Typewriter";
import { useGameStore } from "@/state/gameStore";
import { eventBus } from "@/game/eventBus";
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

  const node = nodeMap.get(nodeId) ?? null;

  const goTo = useCallback((next: string | null | undefined) => {
    if (!next) {
      onClose();
      return;
    }
    setSkip(false);
    setTextDone(false);
    setNodeId(next);
  }, [onClose]);

  const choose = useCallback(
    (choice: DialogueChoice) => {
      if (choice.triggers_quest_id) {
        acceptQuest(choice.triggers_quest_id);
      }
      if (choice.ends_dialogue) {
        onClose();
        return;
      }
      goTo(choice.next_node_id);
    },
    [acceptQuest, goTo, onClose],
  );

  const speaker = node?.speaker || npc?.name || "NPC";
  const text =
    node?.text ||
    (npc ? `${npc.name} nods at you, but has nothing more to say right now.` : "…");
  const choices = node?.choices ?? [];

  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 sm:p-6">
      <div className="cv-panel w-full max-w-3xl p-4">
        {/* Speaker nameplate */}
        <div className="mb-2 flex items-center justify-between">
          <div className="cv-panel-raised inline-flex items-center gap-2 px-3 py-1">
            <span className="text-lg">🧙</span>
            <div className="leading-tight">
              <p className="cv-body text-lg text-accent">{speaker}</p>
              {npc && (
                <p className="cv-body text-sm text-slate-400">{npc.title}</p>
              )}
            </div>
          </div>
          <button
            className="cv-body text-lg text-slate-400 hover:text-white"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Text */}
        <p
          className="cv-body min-h-[5rem] text-xl leading-relaxed text-slate-100"
          onClick={() => !textDone && setSkip(true)}
        >
          <Typewriter
            text={text}
            speed={60}
            skip={skip}
            onDone={() => setTextDone(true)}
          />
        </p>

        {/* Choices (revealed once text finishes) */}
        <div className="mt-4 flex flex-col gap-2">
          {textDone &&
            choices.map((choice) => (
              <button
                key={choice.id}
                className="cv-btn w-full justify-start text-left text-[0.62rem]"
                onClick={() => choose(choice)}
              >
                {choice.triggers_quest_id ? "❗ " : "▸ "}
                {choice.text}
              </button>
            ))}

          {textDone && choices.length === 0 && (
            <button className="cv-btn w-full text-[0.62rem]" onClick={onClose}>
              ▸ Farewell
            </button>
          )}
        </div>

        {/* Free grounded chat */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-frame pt-3">
          <p className="cv-body text-base text-slate-500">
            Powered by grounded enterprise knowledge
          </p>
          <button
            className="cv-btn px-3 py-2 text-[0.6rem]"
            onClick={() => onOpenChat(npcId)}
          >
            💬 Ask anything
          </button>
        </div>
      </div>
    </div>
  );
}
