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
    /*
     * Pokémon-style side panel:
     * - Fixed width 300px (never full-screen)
     * - Only as tall as needed, capped at 70 vh and anchored to the top of the
     *   game area (below the 56 px HUD). The world remains visible to the left.
     * - Heavy pixel border, no backdrop dim.
     */
    <div
      style={{
        top: "56px",
        right: "8px",
        width: "300px",
        maxHeight: "calc(100vh - 72px)",
        background: "rgba(11,16,32,0.97)",
        border: "4px solid #facc15",
        boxShadow: "0 0 0 2px #0b1020, 4px 4px 0 0 rgba(0,0,0,0.6)",
      }}
      className="pointer-events-auto fixed z-40 flex flex-col"
    >
      {/* Header */}
      <div
        style={{ borderBottom: "3px solid #3b4a78", background: "#141a2e" }}
        className="flex items-center justify-between px-3 py-2"
      >
        <h2 className="cv-heading text-[0.65rem] text-accent">Quest Log</h2>
        <button
          className="cv-body text-base text-slate-400 hover:text-white"
          onClick={onClose}
        >
          ✕ (Q)
        </button>
      </div>

      <div className="cv-scroll flex-1 overflow-y-auto p-3">
        {STATUS_ORDER.map((status) => {
          const quests = grouped[status];
          if (quests.length === 0) return null;
          return (
            <section key={status} className="mb-4">
              <h3 className="cv-heading mb-1.5 text-[0.55rem] text-slate-500">
                {STATUS_LABEL[status]} · {quests.length}
              </h3>
              <div className="flex flex-col gap-2">
                {quests.map((quest) => {
                  const giver = quest.giver_npc_id
                    ? lookups?.npcById.get(quest.giver_npc_id)
                    : null;
                  const region = lookups?.regionById.get(quest.region_id);
                  const isLocked = status === "locked";
                  const isActive = status === "active";
                  return (
                    <article
                      key={quest.id}
                      style={{
                        background: isActive ? "rgba(250,204,21,0.08)" : "#1e2742",
                        border: `2px solid ${isActive ? "#facc15" : "#3b4a78"}`,
                        opacity: isLocked ? 0.55 : 1,
                      }}
                      className="p-2"
                    >
                      {/* Title row */}
                      <div className="mb-0.5 flex items-start justify-between gap-1">
                        <p className="cv-body flex-1 text-base leading-snug text-slate-100">
                          {isLocked ? "🔒 " : isActive ? "▸ " : ""}
                          {quest.title}
                        </p>
                        <span
                          className={`cv-body shrink-0 text-[11px] uppercase ${
                            DIFFICULTY_COLOR[quest.difficulty] ?? "text-slate-400"
                          }`}
                        >
                          {quest.difficulty}
                        </span>
                      </div>

                      {/* Location + giver */}
                      {(region || giver) && (
                        <p className="cv-body mb-1 text-[11px] text-slate-500">
                          {region?.icon} {region?.name}
                          {giver ? ` · ${giver.name}` : ""}
                        </p>
                      )}

                      {/* Objectives — active quest only, incomplete only, max 3 */}
                      {isActive && quest.objectives.length > 0 && (
                        <ul className="mb-1 flex flex-col gap-0.5">
                          {quest.objectives
                            .filter((obj) => !objectives[obj.id])
                            .slice(0, 3)
                            .map((obj) => {
                              const canTake =
                                (obj.type === "challenge" || obj.type === "decision") &&
                                !!obj.challenge_id;
                              return (
                                <ObjectiveRow
                                  key={obj.id}
                                  description={obj.description}
                                  done={false}
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

                      {/* Reward + locate */}
                      <div className="flex items-center justify-between">
                        <p className="cv-body text-[11px] text-accent">
                          🏆 {quest.reward.xp} XP
                          {quest.reward.badge ? ` · ${quest.reward.badge}` : ""}
                        </p>
                        {!isLocked && (
                          <button
                            className="cv-body text-[11px] text-sky-400 hover:text-white"
                            onClick={() => locate(quest)}
                          >
                            📍 Go
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
