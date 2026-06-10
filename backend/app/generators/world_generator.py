"""WorldGenerator — turn enterprise knowledge into a playable world.

Pipeline (Milestone 1):

    KnowledgeService -> KnowledgeSnapshot -> WorldGenerator -> World -> world.json

Mapping:
    * Team    -> Region        (themed, positioned on a ring)
    * System  -> Landmark      (in its owner team's region)
    * Project -> Landmark      (in its lead engineer's region) + cross-team bridges
    * Reporting/department + shared projects -> Connections

The build is **pure and deterministic**: every collection is sorted by a stable
key, positions are derived from indices, and the only non-deterministic field is
``metadata.generated_at`` (excluded from ``metadata.content_hash``). Re-running
on the same dataset yields an identical ``content_hash`` and identical regions,
landmarks, and connections.
"""

from __future__ import annotations

import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone

from app.generators import layout, theming
from app.models.knowledge import (
    Employee,
    KnowledgeSnapshot,
    Project,
    SystemAsset,
    Team,
)
from app.models.world import (
    Connection,
    Landmark,
    Position,
    Region,
    World,
    WorldMetadata,
)
from app.services.knowledge_service import KnowledgeService
from app.utils.text import slugify, strip_company_prefix


class WorldGenerator:
    """Deterministically build a :class:`World` from a knowledge snapshot."""

    VERSION = "1.0.0"

    def __init__(
        self,
        knowledge: KnowledgeService,
        *,
        world_name: str = "CompanyVerse",
        seed: int = 1337,
    ) -> None:
        self._knowledge = knowledge
        self._world_name = world_name
        self._seed = seed

    async def generate(self) -> World:
        """Fetch a fresh snapshot and build the world."""
        snapshot = await self._knowledge.get_snapshot(refresh=True)
        return self.build(snapshot, provider=self._knowledge.provider_name)

    # ------------------------------------------------------------------ #
    # Pure build (synchronous, deterministic, easily testable)
    # ------------------------------------------------------------------ #
    def build(self, snapshot: KnowledgeSnapshot, *, provider: str) -> World:
        company_token = (
            snapshot.company.name.split()[0] if snapshot.company.name else None
        )
        employees_by_id = {e.id: e for e in snapshot.employees}
        employees_by_name: dict[str, Employee] = {}
        for employee in snapshot.employees:
            employees_by_name.setdefault(employee.full_name.lower(), employee)

        systems_by_team = self._group_systems(snapshot.systems)
        projects_by_team = self._group_projects(snapshot.projects, employees_by_name)
        docs_by_team = self._group_docs(snapshot, employees_by_name)

        teams = sorted(snapshot.teams, key=lambda t: (t.department, t.name))
        positions = layout.region_positions(len(teams))

        regions: list[Region] = []
        region_id_by_team: dict[str, str] = {}
        for index, (team, position) in enumerate(zip(teams, positions)):
            theme = theming.resolve_region_theme(team.name, team.department, index)
            region_id_by_team[team.name] = team.id
            landmarks = self._build_landmarks(
                position,
                systems_by_team.get(team.name, []),
                projects_by_team.get(team.name, []),
                company_token,
            )
            lead = employees_by_id.get(team.lead_employee_id or -1)
            lead_name = lead.full_name if lead else team.lead_name
            regions.append(
                Region(
                    id=team.id,
                    name=theme.region_name,
                    biome=theme.biome,
                    theme=theme.descriptor,
                    department=team.department,
                    source_team=team.name,
                    description=self._region_description(
                        theme, team, lead_name, len(landmarks)
                    ),
                    position=position,
                    color=theme.color,
                    icon=theme.icon,
                    lead=lead_name,
                    member_count=team.headcount,
                    landmarks=landmarks,
                    knowledge_doc_ids=docs_by_team.get(team.name, []),
                )
            )

        regions.sort(key=lambda r: (r.department, r.name))
        connections = self._build_connections(snapshot, region_id_by_team)
        spawn = layout.spawn_position()
        metadata = self._build_metadata(
            snapshot, provider, regions, connections, spawn
        )
        return World(
            metadata=metadata,
            spawn=spawn,
            regions=regions,
            connections=connections,
        )

    # ------------------------------------------------------------------ #
    # Grouping helpers
    # ------------------------------------------------------------------ #
    @staticmethod
    def _group_systems(systems: list[SystemAsset]) -> dict[str, list[SystemAsset]]:
        grouped: dict[str, list[SystemAsset]] = defaultdict(list)
        for system in systems:
            grouped[system.owner_team].append(system)
        return grouped

    @staticmethod
    def _group_projects(
        projects: list[Project], employees_by_name: dict[str, Employee]
    ) -> dict[str, list[Project]]:
        """Assign each project to a 'home' region (its lead engineer's team)."""
        grouped: dict[str, list[Project]] = defaultdict(list)
        for project in projects:
            home: str | None = None
            if project.lead_engineer:
                lead = employees_by_name.get(project.lead_engineer.lower())
                if lead:
                    home = lead.team
            if home is None and project.teams_involved:
                home = sorted(project.teams_involved)[0]
            if home is not None:
                grouped[home].append(project)
        return grouped

    def _group_docs(
        self, snapshot: KnowledgeSnapshot, employees_by_name: dict[str, Employee]
    ) -> dict[str, list[str]]:
        """Attach documents to the team of their (first) named owner."""
        grouped: dict[str, set[str]] = defaultdict(set)
        for document in snapshot.documents:
            if not document.owner:
                continue
            owner_name = self._clean_owner(document.owner)
            owner = employees_by_name.get(owner_name.lower())
            if owner:
                grouped[owner.team].add(document.id)
        return {team: sorted(ids) for team, ids in grouped.items()}

    @staticmethod
    def _clean_owner(owner: str) -> str:
        first = owner.split("+")[0]
        return first.split("(")[0].strip()

    # ------------------------------------------------------------------ #
    # Landmarks
    # ------------------------------------------------------------------ #
    def _build_landmarks(
        self,
        region_center: Position,
        systems: list[SystemAsset],
        projects: list[Project],
        company_token: str | None,
    ) -> list[Landmark]:
        specs: list[dict] = []

        for system in sorted(systems, key=lambda s: s.id):
            archetype = theming.resolve_system_archetype(system)
            base = strip_company_prefix(system.name, company_token)
            specs.append(
                {
                    "id": f"system-{system.id}",
                    "name": _compose_name(base, archetype.noun),
                    "landmark_type": archetype.landmark_type,
                    "source_type": "system",
                    "source_id": str(system.id),
                    "description": system.description,
                    "criticality": system.criticality,
                    "tags": system.tech_stack[:4],
                    "metadata": {
                        "icon": archetype.icon,
                        "status": system.status or "",
                        "uptime_sla_pct": _str(system.uptime_sla_pct),
                        "monthly_active_users": _str(system.monthly_active_users),
                        "repository": system.repository or "",
                        "owner_team": system.owner_team,
                    },
                }
            )

        for project in sorted(projects, key=lambda p: p.id):
            archetype = theming.PROJECT_ARCHETYPE
            specs.append(
                {
                    "id": f"project-{project.id}",
                    "name": f"{project.name} {archetype.noun}",
                    "landmark_type": archetype.landmark_type,
                    "source_type": "project",
                    "source_id": str(project.id),
                    "description": project.description,
                    "criticality": project.priority,
                    "tags": project.teams_involved[:4],
                    "metadata": {
                        "icon": archetype.icon,
                        "status": project.status or "",
                        "priority": project.priority or "",
                        "completion_pct": _str(project.completion_pct),
                        "jira_board": project.jira_board or "",
                    },
                }
            )

        positions = layout.landmark_positions(region_center, len(specs))
        return [
            Landmark(position=position, **spec)
            for spec, position in zip(specs, positions)
        ]

    # ------------------------------------------------------------------ #
    # Connections
    # ------------------------------------------------------------------ #
    def _build_connections(
        self, snapshot: KnowledgeSnapshot, region_id_by_team: dict[str, str]
    ) -> list[Connection]:
        pairs: dict[tuple[str, str], dict] = {}

        # Roads: teams within the same department, linked in a sorted chain.
        dept_teams: dict[str, list[str]] = defaultdict(list)
        for team in sorted(snapshot.teams, key=lambda t: (t.department, t.name)):
            if team.name in region_id_by_team:
                dept_teams[team.department].append(team.name)
        for department, names in dept_teams.items():
            for left, right in zip(names, names[1:]):
                self._add_pair(
                    pairs,
                    region_id_by_team[left],
                    region_id_by_team[right],
                    "road",
                    f"Shared department: {department}",
                )

        # Bridges: every pair of teams that share a project.
        for project in sorted(snapshot.projects, key=lambda p: p.id):
            involved = sorted(
                {t for t in project.teams_involved if t in region_id_by_team}
            )
            for i in range(len(involved)):
                for j in range(i + 1, len(involved)):
                    self._add_pair(
                        pairs,
                        region_id_by_team[involved[i]],
                        region_id_by_team[involved[j]],
                        "bridge",
                        f"Project: {project.name}",
                    )

        connections = [
            Connection(
                id=f"{info['a']}__{info['b']}",
                source=info["a"],
                target=info["b"],
                type=info["type"],
                reason="; ".join(sorted(info["reasons"])),
            )
            for info in pairs.values()
        ]
        connections.sort(key=lambda c: (c.type, c.source, c.target))
        return connections

    @staticmethod
    def _add_pair(
        pairs: dict[tuple[str, str], dict],
        region_a: str,
        region_b: str,
        connection_type: str,
        reason: str,
    ) -> None:
        if region_a == region_b:
            return
        a, b = sorted((region_a, region_b))
        key = (a, b)
        info = pairs.get(key)
        if info is None:
            pairs[key] = {"a": a, "b": b, "type": connection_type, "reasons": {reason}}
            return
        info["reasons"].add(reason)
        # A shared project (bridge) takes visual precedence over a road.
        if connection_type == "bridge":
            info["type"] = "bridge"

    # ------------------------------------------------------------------ #
    # Descriptions + metadata
    # ------------------------------------------------------------------ #
    @staticmethod
    def _region_description(
        theme: theming.RegionTheme,
        team: Team,
        lead_name: str | None,
        landmark_count: int,
    ) -> str:
        steward = lead_name or "an unnamed steward"
        return (
            f"{theme.region_name} is {theme.descriptor}. Home to the {team.name} "
            f"guild ({team.headcount} members) led by {steward}. "
            f"{landmark_count} landmark(s) rise across its lands."
        )

    def _build_metadata(
        self,
        snapshot: KnowledgeSnapshot,
        provider: str,
        regions: list[Region],
        connections: list[Connection],
        spawn: Position,
    ) -> WorldMetadata:
        landmark_count = sum(len(region.landmarks) for region in regions)
        content_hash = self._content_hash(
            snapshot.company.name, regions, connections, spawn
        )
        return WorldMetadata(
            world_id=f"world-{slugify(snapshot.company.name)}",
            name=self._world_name,
            company_name=snapshot.company.name,
            industry=snapshot.company.industry,
            description=(
                f"A living world generated from {snapshot.company.name}'s "
                f"organizational knowledge: {len(regions)} regions, "
                f"{landmark_count} landmarks, {len(connections)} connections."
            ),
            provider=provider,
            generator_version=self.VERSION,
            seed=self._seed,
            generated_at=datetime.now(timezone.utc).isoformat(),
            region_count=len(regions),
            landmark_count=landmark_count,
            connection_count=len(connections),
            employee_count=len(snapshot.employees),
            content_hash=content_hash,
        )

    def _content_hash(
        self,
        company_name: str,
        regions: list[Region],
        connections: list[Connection],
        spawn: Position,
    ) -> str:
        payload = {
            "company": company_name,
            "seed": self._seed,
            "version": self.VERSION,
            "spawn": spawn.model_dump(),
            "regions": [region.model_dump() for region in regions],
            "connections": [connection.model_dump() for connection in connections],
        }
        blob = json.dumps(
            payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        )
        return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def _str(value: object) -> str:
    """Render an optional scalar as a string for landmark metadata."""
    return "" if value is None else str(value)


def _compose_name(base: str, noun: str) -> str:
    """Join a base name with an archetype noun, avoiding a duplicated word.

    e.g. ``"Connect Gateway" + "Gateway Arch" -> "Connect Gateway Arch"``.
    """
    base_words = base.split()
    noun_words = noun.split()
    if base_words and noun_words and base_words[-1].lower() == noun_words[0].lower():
        noun_words = noun_words[1:]
    suffix = " ".join(noun_words)
    return f"{base} {suffix}".strip() if suffix else base
