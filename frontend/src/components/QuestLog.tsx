"use client";

import { useMemo } from "react";
import { useGameStore } from "@/state/gameStore";
import { eventBus } from "@/game/eventBus";
import type { GameBundle, Quest, QuestStatus } from "@/types/bundle";

interface QuestLogProps {
  bundle: GameBundle;
  onClose: () => void;
}

const DIFFICULTY_COLOR: Record<string, string> = {
  intro: "text-sky-300",
  easy: "text-success",
  medium: "text-accent",
  hard: "text-danger",
};

const STATUS_ORDER: QuestStatus[] = ["active", "available", "locked", "complete"];
const STATUS_LABEL: Record<QuestStatus, string> = {
  active: "In progress",
  available: "Available",
  locked: "Locked",
  complete: "Completed",
};

function ObjectiveRow({
  description,
  done,
  onChallenge,
}: {
  description: string;
  done: boolean;
  onChallenge?: () => void;
}) {
  return (
    <li className="cv-body flex items-start gap-2 text-base">
      <span className={done ? "text-success" : "text-slate-500"}>
        {done ? "☑" : "☐"}
      </span>
      <span className={done ? "text-slate-400 line-through" : "text-slate-200"}>
        {description}
      </span>
      {!done && onChallenge && (
        <button
          className="cv-body ml-auto whitespace-nowrap text-sm text-accent hover:text-white"
          onClick={onChallenge}
        >
          ▶ Take
        </button>
      )}
    </li>
  );
}

export default function QuestLog({ bundle, onClose }: QuestLogProps) {
  const questStatus = useGameStore((s) => s.questStatus);
  const objectives = useGameStore((s) => s.objectives);
  const lookups = useGameStore((s) => s.lookups);

  const grouped = useMemo(() => {
    const sorted = [...bundle.quests].sort((a, b) => a.order - b.order);
    const map: Record<QuestStatus, Quest[]> = {
      active: [],
      available: [],
      locked: [],
      complete: [],
    };
    for (const quest of sorted) {
      const status = questStatus[quest.id] ?? quest.status;
      map[status].push(quest);
    }
    return map;
  }, [bundle.quests, questStatus]);

  const locate = (quest: Quest) => {
    eventBus.emit("camera:focusRegion", { regionId: quest.region_id });
    onClose();
  };

  return (
    <div className="pointer-events-auto fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col cv-panel">
      <div className="flex items-center justify-between border-b-4 border-frame px-4 py-3">
        <h2 className="cv-heading text-sm text-accent">Quest Log</h2>
        <button
          className="cv-body text-lg text-slate-300 hover:text-white"
          onClick={onClose}
        >
          ✕ Close (Q)
        </button>
      </div>

      <div className="cv-scroll flex-1 overflow-y-auto p-4">
        {STATUS_ORDER.map((status) => {
          const quests = grouped[status];
          if (quests.length === 0) return null;
          return (
            <section key={status} className="mb-5">
              <h3 className="cv-heading mb-2 text-[0.6rem] text-slate-400">
                {STATUS_LABEL[status]} · {quests.length}
              </h3>
              <div className="flex flex-col gap-3">
                {quests.map((quest) => {
                  const giver = quest.giver_npc_id
                    ? lookups?.npcById.get(quest.giver_npc_id)
                    : null;
                  const region = lookups?.regionById.get(quest.region_id);
                  const isLocked = status === "locked";
                  return (
                    <article
                      key={quest.id}
                      className={`cv-panel-raised p-3 ${
                        isLocked ? "opacity-50" : ""
                      } ${status === "active" ? "border-accent" : ""}`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <h4 className="cv-body text-lg text-slate-100">
                          {isLocked ? "🔒 " : ""}
                          {quest.title}
                        </h4>
                        <span
                          className={`cv-body text-sm uppercase ${
                            DIFFICULTY_COLOR[quest.difficulty] ?? "text-slate-400"
                          }`}
                        >
                          {quest.difficulty}
                        </span>
                      </div>

                      <p className="cv-body mb-2 text-base text-slate-300">
                        {quest.summary}
                      </p>

                      <p className="cv-body mb-2 text-sm text-slate-500">
                        {region ? `📍 ${region.name}` : ""}
                        {giver ? ` · 🧙 ${giver.name}` : ""}
                      </p>

                      {!isLocked && quest.objectives.length > 0 && (
                        <ul className="mb-2 flex flex-col gap-1">
                          {quest.objectives.map((obj) => {
                            const canTake =
                              status === "active" &&
                              (obj.type === "challenge" || obj.type === "decision") &&
                              !!obj.challenge_id &&
                              !objectives[obj.id];
                            return (
                              <ObjectiveRow
                                key={obj.id}
                                description={obj.description}
                                done={!!objectives[obj.id]}
                                onChallenge={
                                  canTake
                                    ? () => {
                                        eventBus.emit("challenge:open", {
                                          challengeId: obj.challenge_id as string,
                                        });
                                        onClose();
                                      }
                                    : undefined
                                }
                              />
                            );
                          })}
                        </ul>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="cv-body text-sm text-accent">
                          🏆 {quest.reward.xp} XP
                          {quest.reward.badge ? ` · ${quest.reward.badge}` : ""}
                        </p>
                        {!isLocked && (
                          <button
                            className="cv-body text-sm text-sky-300 hover:text-white"
                            onClick={() => locate(quest)}
                          >
                            📍 Locate
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
