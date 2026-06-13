"""QuestGenerator — finalize AI quest/challenge drafts into validated models.

The content generator (offline or real model) supplies *prose* drafts; this
module owns everything *structural*: stable ids, objective→target bindings,
rewards, a linear prerequisite chain, and challenge option validation. AI calls
for all seeds run concurrently. Output is fully validated against
:mod:`app.models.quest` / :mod:`app.models.challenge`, so a frontend can rely on
it regardless of what the model returned.
"""

from __future__ import annotations

import asyncio

from app.ai.contracts import (
    ChallengeDraft,
    GenerationContext,
    QuestDraft,
    QuestSeed,
)
from app.ai.llm import GameContentGenerator
from app.models.challenge import Challenge, ChallengeOption
from app.models.quest import Quest, QuestObjective, Reward

# Category -> the PC stat a quest in that domain grows.
_STAT_BY_CATEGORY: dict[str, str] = {
    "operations": "reliability",
    "security": "security",
    "engineering": "engineering",
    "policy": "governance",
    "process": "process",
    "reference": "knowledge",
    "general": "knowledge",
}


class QuestGenerator:
    """Turn quest seeds + a content generator into final quests + challenges."""

    def __init__(self, content: GameContentGenerator) -> None:
        self._content = content

    async def generate(
        self, ctx: GenerationContext, seeds: list[QuestSeed]
    ) -> tuple[list[Quest], list[Challenge]]:
        if not seeds:
            return [], []

        # Draft all quests concurrently, then all challenges concurrently.
        quest_drafts = await asyncio.gather(
            *(self._content.quest(ctx, seed) for seed in seeds)
        )
        challenge_drafts = await asyncio.gather(
            *(
                self._content.challenge(ctx, seed, draft)
                for seed, draft in zip(seeds, quest_drafts)
            )
        )

        quests: list[Quest] = []
        challenges: list[Challenge] = []
        quest_ids = [self._quest_id(seed) for seed in seeds]
        used_titles: set[str] = set()

        for index, (seed, quest_draft, challenge_draft) in enumerate(
            zip(seeds, quest_drafts, challenge_drafts)
        ):
            # Keep quest titles unique across the line (two docs can share a theme).
            quest_draft.title = self._unique_title(
                quest_draft.title.strip() or seed.doc_title, seed, used_titles
            )
            quest_id = quest_ids[index]
            challenge_id = f"challenge-{quest_id}"
            challenge = self._finalize_challenge(
                challenge_id, quest_id, seed, challenge_draft
            )
            challenges.append(challenge)

            next_id = quest_ids[index + 1] if index + 1 < len(quest_ids) else None
            prev_id = quest_ids[index - 1] if index > 0 else None
            quests.append(
                self._finalize_quest(
                    quest_id=quest_id,
                    seed=seed,
                    draft=quest_draft,
                    challenge_id=challenge_id,
                    prev_id=prev_id,
                    next_id=next_id,
                    ctx=ctx,
                )
            )
        return quests, challenges

    # ------------------------------------------------------------------ #
    # Quest finalization
    # ------------------------------------------------------------------ #
    @staticmethod
    def _quest_id(seed: QuestSeed) -> str:
        return f"quest-{seed.order + 1:02d}-{seed.doc_id}"

    @staticmethod
    def _unique_title(title: str, seed: QuestSeed, used: set[str]) -> str:
        """Ensure each quest title is unique; collisions fall back to the doc name."""
        candidate = title
        if candidate.lower() in used:
            # Distinct, still-grounded fallback derived from the source document.
            base = seed.doc_title.replace(" SOP", "").replace(" Policy", "").strip()
            candidate = f"The {base} Trial"
        # Last resort: append the quest order so it is always unique.
        if candidate.lower() in used:
            candidate = f"{candidate} ({seed.order + 1})"
        used.add(candidate.lower())
        return candidate

    def _finalize_quest(
        self,
        *,
        quest_id: str,
        seed: QuestSeed,
        draft: QuestDraft,
        challenge_id: str,
        prev_id: str | None,
        next_id: str | None,
        ctx: GenerationContext,
    ) -> Quest:
        objectives = self._build_objectives(quest_id, seed, draft, challenge_id, ctx)
        reward = self._build_reward(seed, next_id)
        return Quest(
            id=quest_id,
            title=draft.title.strip() or seed.doc_title,
            summary=draft.summary.strip(),
            narrative=draft.narrative.strip(),
            region_id=seed.region_id,
            giver_npc_id=seed.giver_npc_id,
            order=seed.order,
            difficulty=seed.difficulty,
            objectives=objectives,
            challenge_ids=[challenge_id],
            reward=reward,
            knowledge_doc_ids=[seed.doc_id],
            source=f"{seed.doc_title} ({seed.doc_id})",
            status="available" if seed.order == 0 else "locked",
            prerequisites=[prev_id] if prev_id else [],
            tags=sorted({tag for tag in draft.tags if tag}) or [seed.doc_category],
        )

    def _build_objectives(
        self,
        quest_id: str,
        seed: QuestSeed,
        draft: QuestDraft,
        challenge_id: str,
        ctx: GenerationContext,
    ) -> list[QuestObjective]:
        objectives: list[QuestObjective] = []
        has_challenge = False
        last_talk_index: int | None = None   # track so we can post-process it

        for i, obj in enumerate(draft.objectives):
            objective = QuestObjective(
                id=f"{quest_id}-obj-{i + 1}",
                description=obj.description.strip(),
                type=obj.type,
            )
            if obj.type == "talk":
                objective.target_npc_id = seed.giver_npc_id
                objective.target_region_id = seed.region_id
                last_talk_index = len(objectives)
            elif obj.type in ("read", "explore"):
                objective.target_region_id = seed.region_id
                objective.knowledge_doc_ids = [seed.doc_id]
            elif obj.type in ("challenge", "decision"):
                objective.challenge_id = challenge_id
                has_challenge = True
            objectives.append(objective)

        # Guarantee a challenge objective exists so the quest is always winnable.
        if not has_challenge:
            objectives.append(
                QuestObjective(
                    id=f"{quest_id}-obj-{len(objectives) + 1}",
                    description=f"Complete the trial of {draft.title.strip() or seed.doc_title}.",
                    type="challenge",
                    challenge_id=challenge_id,
                )
            )

        # Phase 3B: Intel-gathering for medium/hard quests.
        # Insert explore objectives for up to 2 landmarks in the quest region
        # BEFORE the challenge. This forces the player to physically visit key
        # systems/projects in the region before they can take the knowledge test,
        # making the quest feel like genuine exploration rather than just a quiz.
        if seed.difficulty in ("medium", "hard"):
            region = next(
                (r for r in ctx.regions if r.id == seed.region_id), None
            )
            if region and region.landmarks:
                # Pick the most relevant-sounding landmarks (up to 2).
                intel_landmarks = sorted(
                    region.landmarks,
                    key=lambda lm: lm.criticality or "",
                )[:2]
                # Insert them BEFORE the challenge objective.
                challenge_idx = next(
                    (i for i, o in enumerate(objectives) if o.type in ("challenge", "decision")),
                    len(objectives),
                )
                for j, lm in enumerate(intel_landmarks):
                    intel_obj = QuestObjective(
                        id=f"{quest_id}-intel-{j + 1}",
                        description=(
                            f"Inspect the {lm.name} in {region.name} "
                            f"to understand its role before taking the challenge."
                        ),
                        type="explore",
                        target_landmark_id=lm.id,
                        target_region_id=seed.region_id,
                    )
                    objectives.insert(challenge_idx + j, intel_obj)

        # Phase 3A: report-back loop.
        # After the challenge, always add a final "talk" objective that returns
        # the player to the quest giver.  This creates the narrative closure loop:
        # meet NPC → learn → prove knowledge → report back → NPC rewards you.
        # Only add it if the last non-trivial objective was a challenge/decision
        # (i.e. we didn't already end on a talk).
        last = objectives[-1] if objectives else None
        if last and last.type not in ("talk",):
            objectives.append(
                QuestObjective(
                    id=f"{quest_id}-obj-{len(objectives) + 1}",
                    description=(
                        f"Return to {seed.giver_npc_name or 'your guide'} "
                        f"in {seed.region_name} and share what you learned."
                    ),
                    type="talk",
                    target_npc_id=seed.giver_npc_id,
                    target_region_id=seed.region_id,
                )
            )

        return objectives

    @staticmethod
    def _build_reward(seed: QuestSeed, next_id: str | None) -> Reward:
        stat = _STAT_BY_CATEGORY.get(seed.doc_category, "knowledge")
        difficulty_bonus = {"intro": 0, "easy": 25, "medium": 75, "hard": 150}
        xp = 100 + difficulty_bonus.get(seed.difficulty, 25)
        return Reward(
            xp=xp,
            knowledge_points=10 + seed.order * 5,
            badge=None,
            stat_gains={stat: 10},
            unlocks=[next_id] if next_id else [],
        )

    # ------------------------------------------------------------------ #
    # Challenge finalization
    # ------------------------------------------------------------------ #
    @staticmethod
    def _finalize_challenge(
        challenge_id: str,
        quest_id: str,
        seed: QuestSeed,
        draft: ChallengeDraft,
    ) -> Challenge:
        options: list[ChallengeOption] = []
        for i, option in enumerate(draft.options):
            options.append(
                ChallengeOption(
                    id=f"{challenge_id}-opt-{i + 1}",
                    text=option.text.strip(),
                    is_correct=option.is_correct,
                    feedback=option.feedback.strip(),
                    order_index=getattr(option, "order_index", None),
                )
            )
        # Safety net: a challenge must have exactly-or-at-least one correct option.
        if options and not any(option.is_correct for option in options):
            options[0].is_correct = True

        difficulty_xp = {"intro": 15, "easy": 25, "medium": 40, "hard": 60}
        return Challenge(
            id=challenge_id,
            quest_id=quest_id,
            type=draft.type,
            title=draft.title.strip() or f"Trial of {seed.doc_title}",
            prompt=draft.prompt.strip(),
            scenario=(draft.scenario or None),
            options=options,
            explanation=draft.explanation.strip(),
            difficulty=seed.difficulty,
            reward_xp=difficulty_xp.get(seed.difficulty, 25),
            knowledge_doc_ids=[seed.doc_id],
        )
