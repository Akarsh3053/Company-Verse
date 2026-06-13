"""Prompt builders for the real-model content generator.

Each builder returns a ``(system, user)`` message pair plus a compact JSON schema
hint. Prompts embed the persona and the *grounded* knowledge (document summaries
and real section titles) so the model writes content that teaches actual
organizational process — the Foundry IQ grounding contract, expressed as text.

Only :class:`~app.ai.azure_openai.AzureOpenAIContentGenerator` uses these; the
offline engine composes content directly.
"""

from __future__ import annotations

import json

from app.ai.contracts import GenerationContext, QuestSeed
from app.models.quest import Quest

_STYLE = (
    "You are the narrative engine for CompanyVerse, a top-down 2D onboarding RPG "
    "(early-Pokémon style) that teaches new employees how their company works. "
    "Write vivid, concise, game-flavoured prose. NEVER invent company facts: use "
    "only the grounded knowledge provided. Always reply with STRICT, valid JSON "
    "matching the requested schema and nothing else."
)


def _persona_block(ctx: GenerationContext) -> str:
    p = ctx.persona
    lines = [
        f"Company: {ctx.company.name} ({ctx.company.industry or 'unknown industry'})",
        f"New joiner: {p.name}",
        f"Role: {p.role}",
        f"Experience level: {ctx.experience_level}",
        f"Home region: {ctx.home_region.name} — {ctx.home_region.theme}",
    ]
    if p.bio:
        lines.append(f"About them: {p.bio}")
    if p.goals:
        lines.append(f"Their goals: {', '.join(p.goals)}")
    return "\n".join(lines)


def narrative_intro(ctx: GenerationContext) -> tuple[str, str]:
    user = (
        f"{_persona_block(ctx)}\n\n"
        f"There are {len(ctx.regions)} regions in this world. Write a 4-6 sentence "
        "opening cutscene narration welcoming this specific new joiner by name and "
        "role, set in their home region. Return JSON: {\"text\": string}."
    )
    return _STYLE, user


def player_backstory(ctx: GenerationContext) -> tuple[str, str]:
    user = (
        f"{_persona_block(ctx)}\n\n"
        "Write a 2-3 sentence in-world backstory for this player character. "
        "Return JSON: {\"text\": string}."
    )
    return _STYLE, user


def quest(ctx: GenerationContext, seed: QuestSeed) -> tuple[str, str]:
    user = (
        f"{_persona_block(ctx)}\n\n"
        f"Quest grounding document: {seed.doc_title} (category: {seed.doc_category}).\n"
        f"Summary: {seed.doc_summary}\n"
        f"Real sections: {', '.join(seed.section_titles) or 'n/a'}\n"
        f"Quest giver: {seed.giver_npc_name or 'a regional guide'} in {seed.region_name}.\n\n"
        "Design one onboarding quest grounded ONLY in this document. "
        "The quest MUST have EXACTLY these 4 objectives in this order:\n"
        "  1. type=\"talk\"    — Introduce the mission: meet the NPC giver and hear the briefing.\n"
        "  2. type=\"read\"    — Study the relevant material: read the key sections of the document in the region.\n"
        "  3. type=\"challenge\" — Prove understanding: complete the knowledge challenge.\n"
        "  4. type=\"talk\"    — Report back: return to the NPC giver and confirm completion.\n"
        "Each description must be specific to the document content, grounded and vivid.\n"
        "Return JSON: "
        '{"title": string, "summary": string, "narrative": string, '
        '"objectives": ['
        '{"description": string, "type": "talk"}, '
        '{"description": string, "type": "read"}, '
        '{"description": string, "type": "challenge"}, '
        '{"description": string, "type": "talk"}'
        '], "tags": [string]}.'
    )
    return _STYLE, user


def challenge(ctx: GenerationContext, seed: QuestSeed) -> tuple[str, str]:
    # For medium/hard quests, prefer scenario/decision challenges for richer play.
    difficulty = seed.difficulty
    if difficulty in ("medium", "hard"):
        type_hint = '"decision" or "scenario"'
        scenario_note = (
            'For "decision" type, write a realistic workplace scenario the joiner '
            'would actually face. Each option should be a plausible choice with '
            'meaningful different feedback explaining real consequences. '
        )
    else:
        type_hint = '"quiz" or "scenario"'
        scenario_note = ""

    user = (
        f"{_persona_block(ctx)}\n\n"
        f"Grounding document: {seed.doc_title}.\n"
        f"Summary: {seed.doc_summary}\n"
        f"Real sections: {', '.join(seed.section_titles) or 'n/a'}\n\n"
        f"Write ONE multiple-choice challenge of type {type_hint} that tests "
        "understanding of this document. "
        f"{scenario_note}"
        "Exactly one option must be correct; every option needs short "
        "feedback explaining why it is right or wrong based on the document. "
        "Return JSON: "
        '{"type": "quiz"|"decision"|"scenario", "title": string, "prompt": string, '
        '"scenario": string|null, "options": [{"text": string, "is_correct": bool, '
        '"feedback": string}], "explanation": string}. Provide exactly 4 options.'
    )
    return _STYLE, user


def npc_dialogue(
    ctx: GenerationContext,
    npc_name: str,
    npc_persona: str,
    given_quests: list[Quest],
) -> tuple[str, str]:
    quest_lines = "\n".join(f"- {q.title}: {q.summary}" for q in given_quests[:3]) or "none"
    user = (
        f"{_persona_block(ctx)}\n\n"
        f"NPC: {npc_name}. Persona: {npc_persona}.\n"
        f"Quests this NPC gives:\n{quest_lines}\n\n"
        "Write this NPC's branching dialogue, addressing the joiner by name and "
        "staying in character. "
        "The quest_complete line is ESPECIALLY important: it must feel like a "
        "genuine reward moment — the NPC acknowledges what the player learned, "
        "gives a specific piece of practical wisdom from the document, "
        "and sets up the next step of the player's journey with energy. 2-3 sentences. "
        "Return JSON: {\"greeting\": string, \"info_lines\": "
        '[string], "quest_offer": string|null, "quest_active": string|null, '
        '"quest_complete": string|null, "knowledge_tidbits": [string]}.'
    )
    return _STYLE, user


def chat_reply(
    ctx: GenerationContext,
    npc_name: str,
    npc_persona: str,
    grounding: list[str],
    history: list[dict[str, str]],
    message: str,
) -> tuple[str, str]:
    grounding_block = "\n".join(f"- {g}" for g in grounding) or "none"
    convo = json.dumps(history[-6:], ensure_ascii=False)
    user = (
        f"{_persona_block(ctx)}\n\n"
        f"You are {npc_name}. Persona: {npc_persona}.\n"
        f"Grounded knowledge you may use (do not go beyond it):\n{grounding_block}\n\n"
        f"Recent conversation: {convo}\n"
        f"The player says: \"{message}\"\n\n"
        "Reply in-character in 2-4 sentences, grounded in the knowledge above. "
        "Return JSON: {\"text\": string}."
    )
    return _STYLE, user
