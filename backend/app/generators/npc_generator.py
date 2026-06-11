"""NPCGenerator — turn employees + the generated world into organizational NPCs.

Pipeline (Milestone 2):

    KnowledgeService ─┐
                      ├─► NPCGenerator ─► NPCCollection ─► npcs.json
    world.json ───────┘

Rules (all deterministic — no LLMs):
    * Each NPC is generated from a single employee.
    * An employee's title maps to a fixed NPC category via
      :func:`app.generators.npc_archetypes.resolve_archetype`
      (Engineering Manager → Guild Master, Senior Engineer → Guardian,
       Staff/Principal → Sage, SRE → Oracle, Security → Sentinel,
       Platform → Artificer, …).
    * Each NPC is bound to a **valid region** from the generated world. The
      region mapping is read from ``world.json`` (``region.source_team`` →
      ``region.id``); region names are never hardcoded here.
    * persona / lore / sprite_type / expertise come from deterministic templates.

The build is **pure and deterministic**: employees are processed in a stable
order, one NPC is selected per team-role slot, and the only non-deterministic
field is ``metadata.generated_at`` (excluded from ``metadata.content_hash``).
Re-running on the same world + dataset yields an identical ``content_hash``.

If the world has not been generated yet, :meth:`generate` raises
``FileNotFoundError`` so callers can fail gracefully (the API maps this to 503).
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from datetime import datetime, timezone

from app.generators import npc_archetypes
from app.generators.npc_archetypes import NPCArchetype
from app.models.knowledge import Document, Employee, KnowledgeSnapshot
from app.models.npc import NPC, NPCCollection, NPCCollectionMetadata
from app.models.world import World
from app.services.knowledge_service import KnowledgeService
from app.services.world_persistence import WorldRepository
from app.utils.text import slugify

logger = logging.getLogger("companyverse")


class NPCGenerator:
    """Deterministically build an :class:`NPCCollection` from knowledge + world."""

    VERSION = "1.0.0"

    #: Cap on NPCs generated per region, keeping the cast curated and the world
    #: readable. The team lead (highest-priority archetype) is always included.
    MAX_NPCS_PER_REGION = 3

    def __init__(
        self,
        knowledge: KnowledgeService,
        world_repository: WorldRepository,
        *,
        world_name: str = "CompanyVerse",
        seed: int = 1337,
    ) -> None:
        self._knowledge = knowledge
        self._world_repository = world_repository
        self._world_name = world_name
        self._seed = seed

    async def generate(self) -> NPCCollection:
        """Load the world + a fresh snapshot, then build the NPC collection.

        Raises:
            FileNotFoundError: if ``world.json`` does not exist yet. NPCs must be
                assigned to valid regions, so the world is a hard prerequisite.
        """
        world = await self._world_repository.load()
        if world is None:
            raise FileNotFoundError(
                "World has not been generated yet. Generate the world "
                "(POST /generate/world) before generating NPCs."
            )
        snapshot = await self._knowledge.get_snapshot()
        return self.build(snapshot, world, provider=self._knowledge.provider_name)

    # ------------------------------------------------------------------ #
    # Pure build (synchronous, deterministic, easily testable)
    # ------------------------------------------------------------------ #
    def build(
        self, snapshot: KnowledgeSnapshot, world: World, *, provider: str
    ) -> NPCCollection:
        """Build NPCs from a snapshot + world. Pure and deterministic."""
        # team name -> region id (the world owns region identity; never hardcode).
        region_id_by_team = {
            region.source_team: region.id for region in world.regions
        }
        region_name_by_id = {region.id: region.name for region in world.regions}

        docs_by_owner = self._documents_by_owner(snapshot.documents)
        company_token = (
            snapshot.company.name.split()[0] if snapshot.company.name else None
        )

        # Group employees by team, but only for teams that map to a real region.
        employees_by_team: dict[str, list[Employee]] = defaultdict(list)
        skipped = 0
        for employee in snapshot.employees:
            if employee.team in region_id_by_team:
                employees_by_team[employee.team].append(employee)
            else:
                skipped += 1
        if skipped:
            logger.info(
                "NPC generation skipped %s employee(s) whose team has no region.",
                skipped,
            )

        npcs: list[NPC] = []
        for team in sorted(employees_by_team):
            region_id = region_id_by_team[team]
            region_name = region_name_by_id[region_id]
            selected = self._select_for_region(
                employees_by_team[team], docs_by_owner
            )
            for employee, archetype in selected:
                npcs.append(
                    self._build_npc(
                        employee,
                        archetype,
                        region_id,
                        region_name,
                        docs_by_owner.get(employee.full_name.lower(), []),
                        company_token,
                    )
                )

        # Stable global order: region, then role priority is already encoded by
        # selection; finalize on (region_id, name) for a deterministic artifact.
        npcs.sort(key=lambda npc: (npc.region_id, npc.id))
        metadata = self._build_metadata(snapshot, world, provider, npcs)
        return NPCCollection(metadata=metadata, npcs=npcs)

    # ------------------------------------------------------------------ #
    # Archetype resolution
    # ------------------------------------------------------------------ #
    @staticmethod
    def _resolve_employee_archetype(
        employee: Employee, owned_docs: list[Document]
    ) -> NPCArchetype:
        """Resolve an employee's archetype, preferring knowledge-domain ownership.

        A person who *owns* a strong knowledge domain (security, incidents/
        reliability, release/deployment) becomes the signature NPC for that
        domain even when their job title is generic. Otherwise we fall back to
        the deterministic title-based mapping. Fully reproducible: both inputs
        (owned doc ids, title) come straight from the dataset.
        """
        domain = npc_archetypes.resolve_knowledge_domain(
            [doc.id for doc in owned_docs]
        )
        if domain is not None:
            return domain
        return npc_archetypes.resolve_archetype(employee.title)

    # ------------------------------------------------------------------ #
    # Selection
    # ------------------------------------------------------------------ #
    def _select_for_region(
        self,
        members: list[Employee],
        docs_by_owner: dict[str, list[Document]],
    ) -> list[tuple[Employee, NPCArchetype]]:
        """Pick up to ``MAX_NPCS_PER_REGION`` distinct NPCs for one region.

        Each member is resolved to an archetype (knowledge-domain ownership wins
        over title); we then keep the highest-value archetypes (by priority)
        while avoiding duplicate roles in the same region. Deterministic
        tie-break: lower employee id wins.
        """
        resolved = [
            (
                member,
                self._resolve_employee_archetype(
                    member, docs_by_owner.get(member.full_name.lower(), [])
                ),
            )
            for member in members
        ]
        # Higher archetype priority first; stable, deterministic tie-break on id.
        resolved.sort(key=lambda pair: (-pair[1].priority, pair[0].id))

        selected: list[tuple[Employee, NPCArchetype]] = []
        used_roles: set[str] = set()
        for member, archetype in resolved:
            if archetype.role in used_roles:
                continue
            selected.append((member, archetype))
            used_roles.add(archetype.role)
            if len(selected) >= self.MAX_NPCS_PER_REGION:
                break
        return selected

    # ------------------------------------------------------------------ #
    # NPC construction
    # ------------------------------------------------------------------ #
    def _build_npc(
        self,
        employee: Employee,
        archetype: NPCArchetype,
        region_id: str,
        region_name: str,
        owned_docs: list[Document],
        company_token: str | None,
    ) -> NPC:
        name = self._npc_name(archetype, region_name, company_token)
        expertise = self._expertise(archetype, employee, owned_docs)
        knowledge_scope = self._knowledge_scope(owned_docs)
        lore = archetype.lore_template.format(region=region_name)
        return NPC(
            id=f"npc-{slugify(employee.full_name)}",
            name=name,
            title=f"{archetype.title_noun} of {region_name}",
            role=archetype.role,  # type: ignore[arg-type]  # validated by Literal
            region_id=region_id,
            source_employee=employee.full_name,
            sprite_type=archetype.sprite_type,
            persona=archetype.persona,
            expertise=expertise,
            knowledge_scope=knowledge_scope,
            lore=lore,
            metadata={
                "employee_id": str(employee.id),
                "employee_title": employee.title,
                "department": employee.department,
                "team": employee.team,
                "region_name": region_name,
                "owned_doc_count": str(len(owned_docs)),
            },
        )

    @staticmethod
    def _npc_name(
        archetype: NPCArchetype, region_name: str, company_token: str | None
    ) -> str:
        """Compose a deterministic NPC name.

        Signature archetypes (Security Sentinel, Incident Oracle, Release
        Guardian) carry a fixed ``signature_name`` and use it verbatim. Everyone
        else is named after their region (e.g. "Backend Citadel Sage").
        """
        if archetype.signature_name:
            return archetype.signature_name
        region = region_name
        if company_token and region.startswith(f"{company_token} "):
            region = region[len(company_token) + 1 :]
        return f"{region} {archetype.title_noun}".strip()

    @staticmethod
    def _expertise(
        archetype: NPCArchetype, employee: Employee, owned_docs: list[Document]
    ) -> list[str]:
        """Merge template expertise with data-derived expertise (deterministic)."""
        items: list[str] = list(archetype.base_expertise)
        items.append(employee.department)
        # Document categories the employee owns are strong expertise signals.
        items.extend(sorted({doc.category.title() for doc in owned_docs}))
        # De-duplicate while preserving first-seen order; then sort for stability.
        deduped = list(dict.fromkeys(item.strip() for item in items if item.strip()))
        return sorted(deduped)

    @staticmethod
    def _knowledge_scope(owned_docs: list[Document]) -> list[str]:
        """Document ids this NPC is grounded in (used by Milestone 4)."""
        return sorted({doc.id for doc in owned_docs})

    # ------------------------------------------------------------------ #
    # Document ownership
    # ------------------------------------------------------------------ #
    @classmethod
    def _documents_by_owner(
        cls, documents: list[Document]
    ) -> dict[str, list[Document]]:
        """Index documents by each named owner/author (lowercased full name).

        An ``owner`` string may name several people (``"A + B"``,
        ``"A, B"``) with parenthetical titles; every named person is credited so
        their NPC inherits the relevant ``knowledge_scope``.
        """
        grouped: dict[str, list[Document]] = defaultdict(list)
        for document in documents:
            for owner_name in cls._owner_names(document.owner):
                grouped[owner_name.lower()].append(document)
        return {name: sorted(docs, key=lambda d: d.id) for name, docs in grouped.items()}

    @staticmethod
    def _owner_names(owner: str | None) -> list[str]:
        """Extract clean person names from a document ``owner`` field."""
        if not owner:
            return []
        names: list[str] = []
        for chunk in owner.replace("+", ",").split(","):
            # Drop any parenthetical role, e.g. "Robert Kim (Director of DevOps)".
            name = chunk.split("(")[0].strip()
            if name:
                names.append(name)
        return names

    # ------------------------------------------------------------------ #
    # Metadata + content hash
    # ------------------------------------------------------------------ #
    def _build_metadata(
        self,
        snapshot: KnowledgeSnapshot,
        world: World,
        provider: str,
        npcs: list[NPC],
    ) -> NPCCollectionMetadata:
        role_counts: dict[str, int] = defaultdict(int)
        for npc in npcs:
            role_counts[npc.role] += 1
        region_ids = {npc.region_id for npc in npcs}
        return NPCCollectionMetadata(
            name=self._world_name,
            company_name=snapshot.company.name,
            provider=provider,
            generator_version=self.VERSION,
            seed=self._seed,
            generated_at=datetime.now(timezone.utc).isoformat(),
            world_id=world.metadata.world_id,
            world_content_hash=world.metadata.content_hash,
            npc_count=len(npcs),
            region_count=len(region_ids),
            roles=dict(sorted(role_counts.items())),
            content_hash=self._content_hash(snapshot.company.name, world, npcs),
        )

    def _content_hash(
        self, company_name: str, world: World, npcs: list[NPC]
    ) -> str:
        payload = {
            "company": company_name,
            "seed": self._seed,
            "version": self.VERSION,
            "world_content_hash": world.metadata.content_hash,
            "npcs": [npc.model_dump() for npc in npcs],
        }
        blob = json.dumps(
            payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        )
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()
