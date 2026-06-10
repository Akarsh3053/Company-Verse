"""NPC archetypes: map employees onto organizational guide/expert archetypes.

Teams become *regions* (Milestone 1); selected employees become *NPCs*. The
mappings here are **deterministic lookups** — an employee's title resolves to a
fixed NPC category (Guild Master, Guardian, Sage, Oracle, Sentinel, Artificer,
Architect, Ranger, Guide) and a themed persona/lore/sprite. No LLM is involved,
so the same dataset always yields the same NPCs (the Milestone 2 requirement).

Resolution order for a title:
    1. Specialization keywords (security, SRE/reliability, platform, …) — these
       produce the flavourful "named" NPCs (Security Sentinel, Incident Oracle…).
    2. Seniority keywords (VP/Director/Manager → leadership; Principal/Staff →
       Sage; Senior → Guardian; …).
    3. A safe default (Guide).
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class NPCArchetype:
    """A deterministic NPC archetype derived from an employee's role."""

    #: One of the fixed NPC categories (see :data:`app.models.npc.NPCCategory`).
    role: str
    #: Title fragment used to build the NPC's display title, e.g. "Guardian".
    title_noun: str
    #: Frontend sprite key (predefined art; AI never generates sprites).
    sprite_type: str
    #: Short, in-character persona summary template.
    persona: str
    #: World-flavoured backstory template. ``{region}`` is filled at build time.
    lore_template: str
    #: Seed expertise tags merged with data-derived expertise.
    base_expertise: tuple[str, ...] = field(default_factory=tuple)
    #: Relative ranking; higher wins when one employee matches several rules.
    priority: int = 0
    #: Optional fixed display name for signature NPCs (e.g. "Security Sentinel").
    #: When set, the generator uses it verbatim instead of a region-based name.
    signature_name: str | None = None


# --------------------------------------------------------------------------- #
# Specialization archetypes (keyword-matched against the employee title).
# These create the signature NPCs from the product brief.
# --------------------------------------------------------------------------- #
_SECURITY = NPCArchetype(
    role="Sentinel",
    title_noun="Sentinel",
    sprite_type="sentinel",
    persona="Guardian of security practices and compliance.",
    lore_template=(
        "Protects the gates of {region} and advises travelers on safe "
        "engineering practices, access control, and the rituals of secure review."
    ),
    base_expertise=("Security", "Access Control", "Compliance"),
    priority=90,
    signature_name="Security Sentinel",
)

_RELIABILITY = NPCArchetype(
    role="Oracle",
    title_noun="Oracle",
    sprite_type="oracle",
    persona="Seer of incidents, reliability, and the health of the realm.",
    lore_template=(
        "Keeps vigil over {region}, reading the omens of alerts and outages so "
        "that travelers may learn the ways of incident response and recovery."
    ),
    base_expertise=("Incident Response", "Reliability", "On-Call"),
    priority=88,
    signature_name="Incident Oracle",
)

_RELEASE = NPCArchetype(
    role="Guardian",
    title_noun="Release Guardian",
    sprite_type="guardian",
    persona="Keeper of the release ritual and deployment safety.",
    lore_template=(
        "Stands watch at the deployment gates of {region}, guiding travelers "
        "through the ritual of release, approvals, and safe rollouts."
    ),
    base_expertise=("Deployments", "Release Management", "Change Control"),
    priority=86,
    signature_name="Release Guardian",
)

_PLATFORM = NPCArchetype(
    role="Artificer",
    title_noun="Artificer",
    sprite_type="artificer",
    persona="Master craftsman of platforms, services, and core infrastructure.",
    lore_template=(
        "Forges the foundational machinery of {region}, shaping the platforms "
        "and services upon which the rest of the realm is built."
    ),
    base_expertise=("Platform Engineering", "Distributed Systems"),
    priority=70,
)

_INFRA = NPCArchetype(
    role="Ranger",
    title_noun="Ranger",
    sprite_type="ranger",
    persona="Pathfinder of pipelines, clusters, and the infrastructure wilds.",
    lore_template=(
        "Roams the high country of {region}, maintaining the pipelines and "
        "clusters and guiding travelers safely across the infrastructure ranges."
    ),
    base_expertise=("Infrastructure", "CI/CD", "Kubernetes"),
    priority=68,
)

_DATA = NPCArchetype(
    role="Oracle",
    title_noun="Data Oracle",
    sprite_type="oracle",
    persona="Diviner of data, metrics, and hidden insight.",
    lore_template=(
        "Peers into the data streams of {region}, divining insight from metrics "
        "and analytics for travelers who seek to understand the realm."
    ),
    base_expertise=("Data", "Analytics", "Insights"),
    priority=60,
)

_DESIGN = NPCArchetype(
    role="Artificer",
    title_noun="Experience Artificer",
    sprite_type="artificer",
    persona="Shaper of interfaces, flows, and delightful experiences.",
    lore_template=(
        "Crafts the look and feel of {region}, shaping interfaces and journeys "
        "so that every traveler's path is clear and delightful."
    ),
    base_expertise=("Design", "UX", "Prototyping"),
    priority=55,
)

# --------------------------------------------------------------------------- #
# Seniority archetypes (matched after specializations).
# --------------------------------------------------------------------------- #
_GUILD_MASTER = NPCArchetype(
    role="Guild Master",
    title_noun="Guild Master",
    sprite_type="guild_master",
    persona="Leader of the guild and steward of its people and mission.",
    lore_template=(
        "Presides over {region}, leading its guild, setting its course, and "
        "welcoming newcomers into the ways of the realm."
    ),
    base_expertise=("Leadership", "Strategy"),
    priority=50,
)

_ARCHITECT = NPCArchetype(
    role="Architect",
    title_noun="Architect",
    sprite_type="architect",
    persona="Designer of grand systems and far-reaching technical strategy.",
    lore_template=(
        "Draws the blueprints of {region}, designing the grand systems and "
        "architectures that shape how the realm fits together."
    ),
    base_expertise=("Architecture", "System Design"),
    priority=46,
)

_SAGE = NPCArchetype(
    role="Sage",
    title_noun="Sage",
    sprite_type="sage",
    persona="Keeper of deep technical wisdom and hard-won experience.",
    lore_template=(
        "A wise elder of {region}, the Sage holds deep knowledge of its craft "
        "and counsels travelers who seek mastery."
    ),
    base_expertise=("Engineering", "Mentorship"),
    priority=44,
)

_GUARDIAN = NPCArchetype(
    role="Guardian",
    title_noun="Guardian",
    sprite_type="guardian",
    persona="Seasoned protector who safeguards the craft and mentors others.",
    lore_template=(
        "A seasoned defender of {region}, the Guardian protects its craft and "
        "guides travelers through its day-to-day trials."
    ),
    base_expertise=("Engineering",),
    priority=40,
)

_GUIDE = NPCArchetype(
    role="Guide",
    title_noun="Guide",
    sprite_type="guide",
    persona="Friendly guide who helps newcomers find their way.",
    lore_template=(
        "A welcoming face in {region}, the Guide helps travelers get their "
        "bearings and points them toward those who can help."
    ),
    base_expertise=(),
    priority=10,
)

#: Default archetype when nothing else matches.
DEFAULT_ARCHETYPE = _GUIDE

# (keyword, archetype) — scanned in order; first containing match wins within a
# tier. Specializations are listed before seniority on purpose.
_SPECIALIZATION_RULES: tuple[tuple[str, NPCArchetype], ...] = (
    ("security", _SECURITY),
    ("sre", _RELIABILITY),
    ("site reliability", _RELIABILITY),
    ("reliability", _RELIABILITY),
    ("release", _RELEASE),
    ("devops", _INFRA),
    ("infrastructure", _INFRA),
    ("platform", _PLATFORM),
    ("data ", _DATA),
    ("analytics", _DATA),
    ("data scientist", _DATA),
    ("data engineer", _DATA),
    ("data analyst", _DATA),
    ("design", _DESIGN),
    ("ux", _DESIGN),
)

_SENIORITY_RULES: tuple[tuple[str, NPCArchetype], ...] = (
    ("vp", _GUILD_MASTER),
    ("vice president", _GUILD_MASTER),
    ("chief", _GUILD_MASTER),
    ("head of", _GUILD_MASTER),
    ("director", _GUILD_MASTER),
    ("manager", _GUILD_MASTER),
    ("lead", _GUILD_MASTER),
    ("principal", _SAGE),
    ("staff", _SAGE),
    ("architect", _ARCHITECT),
    ("senior", _GUARDIAN),
)


def resolve_archetype(title: str) -> NPCArchetype:
    """Resolve an employee ``title`` to a deterministic :class:`NPCArchetype`.

    Specialization keywords take precedence over seniority so that, e.g., a
    "Senior Security Engineer" becomes a Sentinel rather than a generic Guardian.
    Ties are impossible because the first matching rule in each ordered tuple
    wins and specializations are checked first.
    """
    lowered = f" {title.lower().strip()} "

    for keyword, archetype in _SPECIALIZATION_RULES:
        if keyword in lowered:
            return archetype

    for keyword, archetype in _SENIORITY_RULES:
        if keyword in lowered:
            return archetype

    return DEFAULT_ARCHETYPE


# --------------------------------------------------------------------------- #
# Knowledge-domain archetypes (matched against owned document ids).
#
# Job titles in a real org are often generic ("Director of DevOps") even when a
# person is *the* owner of a critical knowledge domain. The synthetic dataset
# encodes that ownership explicitly via each document's `Owner`/`Author` field,
# so we promote the brief's signature NPCs (Security Sentinel, Incident Oracle,
# Release Guardian) deterministically from **document ownership** rather than
# titles. This keeps generation reproducible while grounding NPCs in the real
# organizational knowledge they steward.
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class KnowledgeDomainRule:
    """A deterministic rule that elevates a doc owner to a signature archetype."""

    archetype: NPCArchetype
    #: Document id fragments that signal this domain (matched as substrings).
    doc_id_keywords: tuple[str, ...]
    #: Minimum number of distinct matching documents required to qualify.
    min_docs: int = 1


# Ordered by precedence (security first, then reliability/incidents, then
# release/deployment). The first rule an owner satisfies wins.
_KNOWLEDGE_DOMAIN_RULES: tuple[KnowledgeDomainRule, ...] = (
    KnowledgeDomainRule(
        archetype=_SECURITY,
        doc_id_keywords=("security", "access-control", "auth"),
        min_docs=1,
    ),
    KnowledgeDomainRule(
        archetype=_RELIABILITY,
        doc_id_keywords=(
            "incident",
            "disaster-recovery",
            "on-call",
            "monitoring",
            "alerting",
        ),
        min_docs=2,
    ),
    KnowledgeDomainRule(
        archetype=_RELEASE,
        doc_id_keywords=(
            "deployment",
            "release",
            "change-management",
            "kubernetes",
        ),
        min_docs=2,
    ),
)


def resolve_knowledge_domain(owned_doc_ids: list[str]) -> NPCArchetype | None:
    """Return a signature archetype if owned docs satisfy a domain rule.

    When an owner qualifies for several domains, the **dominant** domain wins
    (the rule with the most matching documents); ties break by rule precedence
    (the order of :data:`_KNOWLEDGE_DOMAIN_RULES`). Returns ``None`` when no
    domain qualifies, in which case the caller falls back to the title-based
    :func:`resolve_archetype`. Deterministic for a given set of doc ids.
    """
    lowered_ids = [doc_id.lower() for doc_id in owned_doc_ids]

    best: NPCArchetype | None = None
    best_count = 0
    for rule in _KNOWLEDGE_DOMAIN_RULES:
        matches = {
            doc_id
            for doc_id in lowered_ids
            if any(keyword in doc_id for keyword in rule.doc_id_keywords)
        }
        count = len(matches)
        if count < rule.min_docs:
            continue
        # Strictly greater count wins; equal counts keep the earlier (higher
        # precedence) rule already chosen, preserving determinism.
        if count > best_count:
            best = rule.archetype
            best_count = count
    return best
