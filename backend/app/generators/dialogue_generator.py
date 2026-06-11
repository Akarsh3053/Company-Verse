"""DialogueGenerator — finalize NPC dialogue drafts into branching trees.

For every NPC in the persona's cast, the content generator supplies a
:class:`~app.ai.contracts.DialogueDraft` (persona/quest-aware lines); this module
assembles those lines into a deterministic, navigable
:class:`~app.models.dialogue.DialogueTree` with stable node ids and validated
choice links. Quest-giving NPCs get offer/active/complete nodes wired to the
quest they hand out so the frontend can drive conversation by quest state.
"""

from __future__ import annotations

import asyncio

from app.ai.contracts import DialogueDraft, GenerationContext
from app.ai.llm import GameContentGenerator
from app.models.dialogue import DialogueChoice, DialogueNode, DialogueTree
from app.models.npc import NPC
from app.models.quest import Quest


class DialogueGenerator:
    """Build one :class:`DialogueTree` per cast NPC."""

    def __init__(self, content: GameContentGenerator) -> None:
        self._content = content

    async def generate(
        self, ctx: GenerationContext, cast: list[NPC], quests: list[Quest]
    ) -> list[DialogueTree]:
        quests_by_giver: dict[str, list[Quest]] = {}
        for quest in quests:
            if quest.giver_npc_id:
                quests_by_giver.setdefault(quest.giver_npc_id, []).append(quest)

        drafts = await asyncio.gather(
            *(
                self._content.npc_dialogue(
                    ctx,
                    npc.id,
                    npc.name,
                    npc.persona,
                    quests_by_giver.get(npc.id, []),
                )
                for npc in cast
            )
        )
        return [
            self._build_tree(npc, draft, quests_by_giver.get(npc.id, []))
            for npc, draft in zip(cast, drafts)
        ]

    def _build_tree(
        self, npc: NPC, draft: DialogueDraft, given_quests: list[Quest]
    ) -> DialogueTree:
        speaker = npc.name
        greeting_id = f"{npc.id}-greeting"
        info_id = f"{npc.id}-info"
        farewell_id = f"{npc.id}-farewell"
        offer_id = f"{npc.id}-quest-offer"
        active_id = f"{npc.id}-quest-active"
        complete_id = f"{npc.id}-quest-complete"

        primary = given_quests[0] if given_quests else None

        nodes: list[DialogueNode] = []

        # Greeting (root).
        greeting_choices = [
            DialogueChoice(
                id=f"{greeting_id}-c1", text="Tell me about this place.", next_node_id=info_id
            )
        ]
        if primary is not None:
            greeting_choices.append(
                DialogueChoice(
                    id=f"{greeting_id}-c2",
                    text="Do you have a task for me?",
                    next_node_id=offer_id,
                )
            )
        greeting_choices.append(
            DialogueChoice(
                id=f"{greeting_id}-c3", text="I'll be on my way.", next_node_id=farewell_id
            )
        )
        nodes.append(
            DialogueNode(
                id=greeting_id,
                type="greeting",
                speaker=speaker,
                text=draft.greeting.strip(),
                choices=greeting_choices,
            )
        )

        # Info node (lore + grounded tidbits).
        info_text = " ".join(line.strip() for line in draft.info_lines if line.strip())
        if draft.knowledge_tidbits:
            info_text = (
                info_text + " " + " ".join(t.strip() for t in draft.knowledge_tidbits)
            ).strip()
        if not info_text:
            info_text = f"There's much to learn in these parts. Stay sharp."
        nodes.append(
            DialogueNode(
                id=info_id,
                type="info",
                speaker=speaker,
                text=info_text,
                choices=[
                    DialogueChoice(
                        id=f"{info_id}-c1", text="Thanks for the wisdom.", next_node_id=greeting_id
                    )
                ],
            )
        )

        # Quest nodes (only when this NPC gives a quest).
        if primary is not None:
            offer_text = (
                draft.quest_offer
                or f"I have a task for you: \"{primary.title}\". {primary.summary}"
            )
            nodes.append(
                DialogueNode(
                    id=offer_id,
                    type="quest_offer",
                    speaker=speaker,
                    text=offer_text.strip(),
                    quest_id=primary.id,
                    choices=[
                        DialogueChoice(
                            id=f"{offer_id}-c1",
                            text="I accept.",
                            triggers_quest_id=primary.id,
                            next_node_id=active_id,
                        ),
                        DialogueChoice(
                            id=f"{offer_id}-c2",
                            text="Maybe later.",
                            next_node_id=greeting_id,
                        ),
                    ],
                )
            )
            nodes.append(
                DialogueNode(
                    id=active_id,
                    type="quest_active",
                    speaker=speaker,
                    text=(draft.quest_active or f"Press on with \"{primary.title}\".").strip(),
                    quest_id=primary.id,
                    choices=[
                        DialogueChoice(
                            id=f"{active_id}-c1", text="On it.", ends_dialogue=True
                        )
                    ],
                )
            )
            nodes.append(
                DialogueNode(
                    id=complete_id,
                    type="quest_complete",
                    speaker=speaker,
                    text=(
                        draft.quest_complete
                        or f"Well done completing \"{primary.title}\"!"
                    ).strip(),
                    quest_id=primary.id,
                    choices=[
                        DialogueChoice(
                            id=f"{complete_id}-c1", text="Thank you.", next_node_id=greeting_id
                        )
                    ],
                )
            )

        # Farewell (terminal: no choices).
        nodes.append(
            DialogueNode(
                id=farewell_id,
                type="farewell",
                speaker=speaker,
                text="Safe travels, traveler.",
                choices=[],
            )
        )

        return DialogueTree(npc_id=npc.id, root_node_id=greeting_id, nodes=nodes)
