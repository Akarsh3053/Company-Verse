"""Offline, deterministic content generator (the default ``local`` engine).

This is **not** hardcoded output: every piece of language is composed from the
specific persona + the knowledge retrieved for them, so two different joiners
(or two different datasets) produce different games. It is *deterministic* —
given the same persona and knowledge it yields identical content — which makes
demos reproducible and lets the bundle carry a meaningful ``content_hash``.

When real credentials arrive, :class:`~app.ai.azure_openai.AzureOpenAIContentGenerator`
replaces this with a live model using the very same interface; this engine then
becomes the safety-net fallback.

Design notes for grounding:
* Challenge *correct* answers are drawn from a document's real ``##`` sections;
  distractors are pulled from *sibling* documents. So a challenge is both
  dataset-driven and verifiably correct without an LLM.
* All "choices" are made by stable ordering/index — never randomness.
"""

from __future__ import annotations

from app.ai.contracts import (
    ChallengeDraft,
    ChallengeOptionDraft,
    DialogueDraft,
    GenerationContext,
    ObjectiveDraft,
    QuestDraft,
    QuestSeed,
)
from app.ai.llm import GameContentGenerator
from app.models.knowledge import ProviderHealth
from app.models.quest import Quest
from app.utils.text import first_sentences, truncate

# Thematic quest-title flavour, matched against a document's id/category.
_TITLE_RULES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("deployment", "release"), "The Ritual of Release"),
    (("incident", "outage"), "The Great Outage"),
    (("disaster", "recovery", "continuity"), "Trial of Restoration"),
    (("security", "access", "auth"), "The Guardian's Audit"),
    (("on-call", "on_call", "monitoring", "alerting"), "The Vigil of Alerts"),
    (("onboarding",), "First Steps"),
    (("code-review", "code_review", "review"), "The Rite of Review"),
    (("change",), "The Council of Change"),
    (("api", "schema", "database"), "The Architect's Blueprint"),
    (("roadmap", "benchmark"), "Charting the Roadmap"),
    (("sla", "policy", "vendor", "retention"), "The Pact of Policy"),
    (("kubernetes", "migration"), "The Migration Pilgrimage"),
)


def _quest_title(doc_id: str, doc_title: str, category: str) -> str:
    haystack = f"{doc_id} {category}".lower()
    for keywords, title in _TITLE_RULES:
        if any(keyword in haystack for keyword in keywords):
            return title
    # Fall back to a title built from the document itself (still data-driven).
    base = doc_title.replace(" SOP", "").replace(" Policy", "").strip()
    return f"The {base} Trial"


class LocalContentGenerator(GameContentGenerator):
    """Deterministic, persona + knowledge aware content generator."""

    name = "local"

    # ------------------------------------------------------------------ #
    # Narration
    # ------------------------------------------------------------------ #
    async def narrative_intro(self, ctx: GenerationContext) -> str:
        company = ctx.company.name
        region = ctx.home_region
        return (
            f"Welcome, {ctx.persona.name}. You have just joined {company} as its "
            f"newest {ctx.persona.role}. Your journey begins in {region.name} — "
            f"{region.theme}. {company}'s living knowledge is scattered across "
            f"{len(ctx.regions)} regions, each guarded by those who keep its craft. "
            f"Speak with them, take on their trials, and you will master how "
            f"{company} truly works — not by reading manuals, but by living them. "
            f"Your adventure starts now."
        )

    async def player_backstory(self, ctx: GenerationContext) -> str:
        persona = ctx.persona
        team = persona.team or ctx.home_region.source_team
        about = (
            truncate(persona.bio, 180)
            if persona.bio
            else f"a {ctx.experience_level} explorer eager to learn the realm's ways"
        )
        goals = ""
        if persona.goals:
            goals = f" Their quest: {', '.join(persona.goals[:3])}."
        return (
            f"{persona.name} arrives at {ctx.company.name} to join the {team} guild "
            f"as a {persona.role} — {about}.{goals} Armed with curiosity and a fresh "
            f"badge, they set out to uncover how the realm runs."
        )

    # ------------------------------------------------------------------ #
    # Quests
    # ------------------------------------------------------------------ #
    async def quest(self, ctx: GenerationContext, seed: QuestSeed) -> QuestDraft:
        title = _quest_title(seed.doc_id, seed.doc_title, seed.doc_category)
        giver = seed.giver_npc_name or "a regional guide"
        topic = first_sentences(seed.doc_summary, 1, 200) or seed.doc_title
        narrative = (
            f"Deep in {seed.region_name}, the knowledge of \"{seed.doc_title}\" must "
            f"be learned. {giver} will set you on the path. {topic} Prove you "
            f"understand it, and {ctx.company.name} grows a little less mysterious."
        )
        summary = (
            f"Learn {seed.doc_title} from {giver} in {seed.region_name}, then prove "
            f"your understanding."
        )
        # Objectives follow a stable talk -> study -> challenge arc.
        objectives = [
            ObjectiveDraft(
                description=f"Seek out {giver} in {seed.region_name}.",
                type="talk",
            ),
            ObjectiveDraft(
                description=f"Study the lore of {seed.doc_title}.",
                type="read",
            ),
            ObjectiveDraft(
                description=f"Complete the trial of {title} to prove your mastery.",
                type="challenge",
            ),
        ]
        tags = sorted({seed.doc_category, *seed.section_titles[:2]})
        return QuestDraft(
            title=title,
            summary=truncate(summary, 200),
            narrative=truncate(narrative, 400),
            objectives=objectives,
            tags=[tag for tag in tags if tag],
        )

    # ------------------------------------------------------------------ #
    # Challenges
    # ------------------------------------------------------------------ #
    async def challenge(
        self, ctx: GenerationContext, seed: QuestSeed, quest: QuestDraft
    ) -> ChallengeDraft:
        own_sections = seed.section_titles
        # Gather candidate distractors: sections that belong to *other* documents.
        own_lower = {title.lower() for title in own_sections}
        foreign: list[str] = []
        for doc in ctx.grounding_docs:
            if doc.id == seed.doc_id:
                continue
            for title in doc.section_titles:
                if title.lower() not in own_lower and title not in foreign:
                    foreign.append(title)

        if own_sections and len(foreign) >= 2:
            return self._section_quiz(seed, own_sections, foreign)
        return self._decision_challenge(seed)

    def _section_quiz(
        self, seed: QuestSeed, own_sections: list[str], foreign: list[str]
    ) -> ChallengeDraft:
        """A 'which of these belongs to <doc>?' quiz — answers come from the data."""
        correct = own_sections[0]
        # Deterministic distractor pick: first three distinct foreign sections.
        distractors = foreign[:3]
        options = [
            ChallengeOptionDraft(
                text=correct,
                is_correct=True,
                feedback=f"Correct — \"{correct}\" is part of {seed.doc_title}.",
            )
        ]
        for title in distractors:
            options.append(
                ChallengeOptionDraft(
                    text=title,
                    is_correct=False,
                    feedback=(
                        f"Not quite — \"{title}\" belongs to a different process, "
                        f"not {seed.doc_title}."
                    ),
                )
            )
        return ChallengeDraft(
            type="quiz",
            title=f"Sections of {seed.doc_title}",
            prompt=(
                f"Which of the following is genuinely part of {seed.doc_title}?"
            ),
            scenario=(
                f"As {seed.region_name}'s guardian tests you, recall what the "
                f"{seed.doc_title} actually covers."
            ),
            options=options,
            explanation=(
                f"{seed.doc_title} covers: "
                f"{', '.join(own_sections[:5])}. Knowing its real sections helps "
                f"you find the right runbook fast."
            ),
            difficulty=seed.difficulty,
        )

    def _decision_challenge(self, seed: QuestSeed) -> ChallengeDraft:
        """Fallback: a 'safest first step' decision, always grounded in the doc."""
        options = [
            ChallengeOptionDraft(
                text=f"Consult the {seed.doc_title} and follow its documented procedure.",
                is_correct=True,
                feedback="Correct — the documented process is the source of truth.",
            ),
            ChallengeOptionDraft(
                text="Skip the process and act from memory to save time.",
                is_correct=False,
                feedback="Risky — shortcuts around documented process cause incidents.",
            ),
            ChallengeOptionDraft(
                text="Ask in chat and guess based on whoever answers first.",
                is_correct=False,
                feedback="Unreliable — hearsay is not an auditable procedure.",
            ),
            ChallengeOptionDraft(
                text="Wait indefinitely and escalate to leadership for every step.",
                is_correct=False,
                feedback="Inefficient — the runbook exists so you can act safely.",
            ),
        ]
        return ChallengeDraft(
            type="decision",
            title=f"Facing {seed.doc_title}",
            prompt=(
                f"You're responsible for a task governed by {seed.doc_title}. "
                f"What is the safest first step?"
            ),
            scenario=first_sentences(seed.doc_summary, 2, 280) or None,
            options=options,
            explanation=(
                f"When a process is documented — like {seed.doc_title} — following "
                f"it is what keeps {seed.region_name} (and production) safe."
            ),
            difficulty=seed.difficulty,
        )

    # ------------------------------------------------------------------ #
    # Dialogue
    # ------------------------------------------------------------------ #
    async def npc_dialogue(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        given_quests: list[Quest],
    ) -> DialogueDraft:
        greeting = (
            f"Ah, {ctx.persona.name}. Welcome to our corner of {ctx.company.name}. "
            f"I am {npc_name}. {npc_persona}"
        )
        info_lines = [
            f"Every traveler here learns by doing, not by reading dusty manuals.",
            f"Stay curious, {ctx.persona.name.split()[0]} — the realm rewards it.",
        ]
        quest_offer = quest_active = quest_complete = None
        if given_quests:
            titles = ", ".join(q.title for q in given_quests[:3])
            primary = given_quests[0]
            quest_offer = (
                f"I have a task for you: \"{primary.title}\". {primary.summary} "
                f"Will you take it on?"
            )
            quest_active = (
                f"Keep at \"{primary.title}\". The answer lies in what we actually "
                f"do here — not in guesswork."
            )
            quest_complete = (
                f"Well done, {ctx.persona.name.split()[0]}! You've proven yourself "
                f"on \"{primary.title}\". The realm is clearer to you now."
            )
            info_lines.append(f"My trials for you: {titles}.")
        # Grounded knowledge tidbits drawn from the quests' source documents.
        tidbits: list[str] = []
        for q in given_quests[:2]:
            for doc_id in q.knowledge_doc_ids[:1]:
                doc = ctx.docs_by_id.get(doc_id)
                if doc and doc.summary:
                    tidbits.append(f"On {doc.title}: {first_sentences(doc.summary, 1, 160)}")
        return DialogueDraft(
            greeting=truncate(greeting, 300),
            info_lines=info_lines,
            quest_offer=quest_offer,
            quest_active=quest_active,
            quest_complete=quest_complete,
            knowledge_tidbits=tidbits,
        )

    # ------------------------------------------------------------------ #
    # Runtime chat
    # ------------------------------------------------------------------ #
    async def chat_reply(
        self,
        ctx: GenerationContext,
        npc_id: str,
        npc_name: str,
        npc_persona: str,
        grounding: list[str],
        history: list[dict[str, str]],
        message: str,
    ) -> str:
        terms = {t for t in message.lower().split() if len(t) > 3}
        best_text = ""
        best_score = 0
        for item in grounding:
            score = sum(1 for term in terms if term in item.lower())
            if score > best_score:
                best_text, best_score = item, score
        first = ctx.persona.name.split()[0]
        if best_text and best_score > 0:
            return (
                f"{npc_name}: Per our records — {first_sentences(best_text, 2, 260)} "
                f"Study it well, {first}."
            )
        return (
            f"{npc_name}: That knowledge lies beyond my watch, {first}. Seek the "
            f"guardian whose domain it is — every corner of {ctx.company.name} has "
            f"its keeper."
        )

    async def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status="ok",
            detail="Offline deterministic content engine (no credentials required).",
        )
