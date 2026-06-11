"""Persona resolution + knowledge grounding.

Given a :class:`~app.models.persona.UserPersona`, the :class:`PersonaResolver`:

1. infers the joiner's experience tier and **home region** (role → team → region);
2. runs grounded retrieval (``KnowledgeService.search`` — the Foundry IQ seam)
   to pick the documents most relevant to *this* role, blended with the home
   region's and onboarding docs;
3. turns those documents into ordered :class:`~app.ai.contracts.QuestSeed`\\ s,
   each bound to a region + an NPC giver;
4. assembles the :class:`~app.ai.contracts.GenerationContext` the content
   generator needs.

Everything structural is decided here and is deterministic for a given persona +
dataset; the content generator only fills in language. This is what keeps the
world coherent no matter which LLM (or the offline engine) is active.
"""

from __future__ import annotations

from app.ai.contracts import GenerationContext, GroundingDoc, QuestSeed
from app.models.knowledge import Document, KnowledgeSnapshot
from app.models.npc import NPC, NPCCollection
from app.models.persona import UserPersona
from app.models.quest import QuestDifficulty
from app.models.world import Region, World
from app.services.knowledge_service import KnowledgeService
from app.utils.text import markdown_section_titles

# role keyword -> team name (must match a world region's ``source_team``).
# Specific roles are listed before generic engineering so "frontend"/"devops"
# win over a bare "engineer".
_ROLE_TEAM_RULES: tuple[tuple[str, str], ...] = (
    ("frontend", "Frontend Engineering"),
    ("front-end", "Frontend Engineering"),
    ("ui engineer", "Frontend Engineering"),
    ("devops", "DevOps & Infrastructure"),
    ("sre", "DevOps & Infrastructure"),
    ("site reliability", "DevOps & Infrastructure"),
    ("infrastructure", "DevOps & Infrastructure"),
    ("platform", "Platform Engineering"),
    ("security", "Platform Engineering"),
    ("data scientist", "Data & Analytics"),
    ("data engineer", "Data & Analytics"),
    ("data analyst", "Data & Analytics"),
    ("analytics", "Data & Analytics"),
    ("data ", "Data & Analytics"),
    ("ux", "Design & UX"),
    ("designer", "Design & UX"),
    ("design", "Design & UX"),
    ("product manager", "Product Management"),
    ("product management", "Product Management"),
    ("pm", "Product Management"),
    ("account executive", "Sales & Revenue"),
    ("sales", "Sales & Revenue"),
    ("revenue", "Sales & Revenue"),
    ("sdr", "Sales & Revenue"),
    ("customer success", "Customer Success"),
    ("support", "Customer Success"),
    ("csm", "Customer Success"),
    # Generic engineering fallbacks (checked last).
    ("backend", "Platform Engineering"),
    ("software", "Platform Engineering"),
    ("developer", "Platform Engineering"),
    ("engineer", "Platform Engineering"),
)

_EXPERIENCE_RULES: tuple[tuple[str, str], ...] = (
    ("intern", "intern"),
    ("vp", "executive"),
    ("vice president", "executive"),
    ("chief", "executive"),
    ("head of", "executive"),
    ("director", "executive"),
    ("principal", "lead"),
    ("staff", "lead"),
    ("manager", "lead"),
    ("lead", "lead"),
    ("senior", "senior"),
    ("associate", "junior"),
    ("junior", "junior"),
    ("graduate", "junior"),
    ("entry", "junior"),
    (" i ", "junior"),
    (" ii", "mid"),
)

_DIFFICULTY_BY_ORDER: tuple[QuestDifficulty, ...] = (
    "intro",
    "easy",
    "easy",
    "medium",
    "medium",
    "hard",
)


class ResolvedPlan:
    """The deterministic plan produced for a persona (input to the AI layer)."""

    def __init__(
        self,
        *,
        context: GenerationContext,
        seeds: list[QuestSeed],
        cast_npcs: list[NPC],
    ) -> None:
        self.context = context
        self.seeds = seeds
        self.cast_npcs = cast_npcs

    @property
    def grounding_doc_ids(self) -> list[str]:
        return [seed.doc_id for seed in self.seeds]


class PersonaResolver:
    """Resolve a persona into a grounded, deterministic generation plan."""

    def __init__(self, knowledge: KnowledgeService, *, max_quests: int = 5) -> None:
        self._knowledge = knowledge
        self._max_quests = max_quests

    async def resolve(
        self, persona: UserPersona, world: World, npcs: NPCCollection
    ) -> ResolvedPlan:
        snapshot = await self._knowledge.get_snapshot()
        experience = self._infer_experience(persona)
        home_region = self._resolve_home_region(persona, world)

        documents_by_id = {doc.id: doc for doc in snapshot.documents}
        selected_docs = await self._select_documents(
            persona, home_region, documents_by_id
        )

        npcs_by_region = self._group_npcs_by_region(npcs.npcs)
        employees_team = {e.full_name.lower(): e.team for e in snapshot.employees}
        region_by_team = {r.source_team: r for r in world.regions}

        seeds: list[QuestSeed] = []
        cast_ids: set[str] = set()
        for order, document in enumerate(selected_docs):
            region = self._doc_region(
                document, employees_team, region_by_team, home_region
            )
            giver = self._pick_giver(document, npcs_by_region.get(region.id, []))
            if giver is not None:
                cast_ids.add(giver.id)
            seeds.append(
                QuestSeed(
                    order=order,
                    doc_id=document.id,
                    doc_title=document.title,
                    doc_category=document.category,
                    doc_summary=document.summary,
                    section_titles=markdown_section_titles(document.content),
                    region_id=region.id,
                    region_name=region.name,
                    giver_npc_id=giver.id if giver else None,
                    giver_npc_name=giver.name if giver else None,
                    difficulty=_DIFFICULTY_BY_ORDER[
                        min(order, len(_DIFFICULTY_BY_ORDER) - 1)
                    ],
                )
            )

        # Cast = quest givers + everyone in the home region (the player's hub).
        for npc in npcs_by_region.get(home_region.id, []):
            cast_ids.add(npc.id)
        cast_npcs = sorted(
            (npc for npc in npcs.npcs if npc.id in cast_ids), key=lambda n: n.id
        )

        grounding_docs = [
            GroundingDoc(
                id=document.id,
                title=document.title,
                category=document.category,
                summary=document.summary,
                owner=document.owner,
                section_titles=markdown_section_titles(document.content),
            )
            for document in selected_docs
        ]

        context = GenerationContext(
            persona=persona,
            experience_level=experience,
            company=snapshot.company,
            home_region=home_region,
            regions=world.regions,
            npcs=cast_npcs,
            grounding_docs=grounding_docs,
            systems=snapshot.systems,
            projects=snapshot.projects,
        )
        return ResolvedPlan(context=context, seeds=seeds, cast_npcs=cast_npcs)

    # ------------------------------------------------------------------ #
    # Experience + region inference
    # ------------------------------------------------------------------ #
    @staticmethod
    def _infer_experience(persona: UserPersona) -> str:
        if persona.experience_level:
            return persona.experience_level
        lowered = f" {persona.role.lower().strip()} "
        for keyword, level in _EXPERIENCE_RULES:
            if keyword in lowered:
                return level
        return "mid"

    def _resolve_home_region(self, persona: UserPersona, world: World) -> Region:
        regions_by_team = {r.source_team: r for r in world.regions}
        regions_by_dept: dict[str, list[Region]] = {}
        for region in world.regions:
            regions_by_dept.setdefault(region.department, []).append(region)

        # 1) Explicit team hint.
        if persona.team and persona.team in regions_by_team:
            return regions_by_team[persona.team]
        # 2) Explicit department hint.
        if persona.department:
            matches = regions_by_dept.get(persona.department)
            if matches:
                return sorted(matches, key=lambda r: r.name)[0]
        # 3) Infer team from the role.
        team = self._team_from_role(persona.role)
        if team and team in regions_by_team:
            return regions_by_team[team]
        # 4) Deterministic fallback: first region by name.
        return sorted(world.regions, key=lambda r: r.name)[0]

    @staticmethod
    def _team_from_role(role: str) -> str | None:
        lowered = f" {role.lower().strip()} "
        for keyword, team in _ROLE_TEAM_RULES:
            if keyword in lowered:
                return team
        return None

    # ------------------------------------------------------------------ #
    # Document selection (grounding)
    # ------------------------------------------------------------------ #
    async def _select_documents(
        self,
        persona: UserPersona,
        home_region: Region,
        documents_by_id: dict[str, Document],
    ) -> list[Document]:
        """Pick the grounding documents for this persona, in quest order."""
        ordered_ids: list[str] = []

        def add(doc_id: str) -> None:
            if doc_id in documents_by_id and doc_id not in ordered_ids:
                ordered_ids.append(doc_id)

        # 1) Always start onboarding with the onboarding runbook if present.
        for doc_id in sorted(documents_by_id):
            if "onboarding" in doc_id:
                add(doc_id)
                break

        # 2) Role-relevant docs via grounded retrieval (Foundry IQ seam).
        query = " ".join(
            part
            for part in [
                persona.role,
                persona.department or "",
                home_region.source_team,
                " ".join(persona.goals),
                persona.bio or "",
            ]
            if part
        )
        matches = await self._knowledge.search(query, top_k=self._max_quests + 3)
        for match in matches:
            add(match.document_id)

        # 3) Backfill with the home region's attached docs.
        for doc_id in home_region.knowledge_doc_ids:
            add(doc_id)

        # 4) Final backfill: any remaining docs (stable order) so we always have
        #    enough quests even for a tiny dataset.
        for doc_id in sorted(documents_by_id):
            add(doc_id)

        selected = [documents_by_id[doc_id] for doc_id in ordered_ids[: self._max_quests]]
        return selected

    # ------------------------------------------------------------------ #
    # Region + giver binding
    # ------------------------------------------------------------------ #
    @staticmethod
    def _group_npcs_by_region(npcs: list[NPC]) -> dict[str, list[NPC]]:
        grouped: dict[str, list[NPC]] = {}
        for npc in sorted(npcs, key=lambda n: n.id):
            grouped.setdefault(npc.region_id, []).append(npc)
        return grouped

    @staticmethod
    def _doc_region(
        document: Document,
        employees_team: dict[str, str],
        region_by_team: dict[str, Region],
        home_region: Region,
    ) -> Region:
        """Bind a document to the region of its owner's team, else the home region."""
        owner = document.owner or ""
        for chunk in owner.replace("+", ",").split(","):
            name = chunk.split("(")[0].strip().lower()
            team = employees_team.get(name)
            if team and team in region_by_team:
                return region_by_team[team]
        return home_region

    @staticmethod
    def _pick_giver(document: Document, region_npcs: list[NPC]) -> NPC | None:
        """Prefer an NPC who actually owns this document; else the first in region."""
        if not region_npcs:
            return None
        for npc in region_npcs:
            if document.id in npc.knowledge_scope:
                return npc
        return region_npcs[0]
