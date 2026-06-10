"""Theming: map organizational units onto evocative game-world archetypes.

Teams become *regions* and systems/projects become *landmarks*. The mappings are
deterministic lookups (with a deterministic fallback for unknown teams) so the
same dataset always yields the same themed world.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models.knowledge import SystemAsset


@dataclass(frozen=True)
class RegionTheme:
    """Visual + narrative theme applied to a team-region."""

    region_name: str
    biome: str
    color: str
    icon: str
    descriptor: str


@dataclass(frozen=True)
class LandmarkArchetype:
    """Visual archetype applied to a system/project landmark."""

    noun: str
    landmark_type: str
    icon: str


# Team name -> region theme. Names nod to the product's MVP regions
# (Backend Citadel, DevOps Mountains, Observability/Observatory Valley).
TEAM_THEMES: dict[str, RegionTheme] = {
    "Platform Engineering": RegionTheme(
        region_name="Backend Citadel",
        biome="citadel",
        color="#2563EB",
        icon="\U0001F3F0",  # castle
        descriptor="the fortified core where the platform's foundational services are forged and defended",
    ),
    "Frontend Engineering": RegionTheme(
        region_name="Interface Bazaar",
        biome="bazaar",
        color="#DB2777",
        icon="\U0001F3A8",  # artist palette
        descriptor="a vibrant marketplace where components, pixels, and customer experiences are crafted",
    ),
    "DevOps & Infrastructure": RegionTheme(
        region_name="DevOps Mountains",
        biome="mountains",
        color="#6B7280",
        icon="\u26F0\uFE0F",  # mountain
        descriptor="the high ranges where pipelines, clusters, and infrastructure are kept aloft",
    ),
    "Product Management": RegionTheme(
        region_name="Roadmap Highlands",
        biome="highlands",
        color="#16A34A",
        icon="\U0001F5FA\uFE0F",  # map
        descriptor="the strategic highlands where priorities are charted and roadmaps surveyed",
    ),
    "Design & UX": RegionTheme(
        region_name="Aesthetic Glades",
        biome="glades",
        color="#9333EA",
        icon="\U0001F338",  # cherry blossom
        descriptor="tranquil glades where flows, prototypes, and delightful experiences take shape",
    ),
    "Sales & Revenue": RegionTheme(
        region_name="Revenue Harbor",
        biome="harbor",
        color="#F59E0B",
        icon="\u2693",  # anchor
        descriptor="a bustling harbor where deals dock and revenue flows into the realm",
    ),
    "Customer Success": RegionTheme(
        region_name="Success Sanctuary",
        biome="sanctuary",
        color="#0D9488",
        icon="\U0001F6E1\uFE0F",  # shield
        descriptor="a welcoming sanctuary where customers are guided, guarded, and helped to thrive",
    ),
    "Data & Analytics": RegionTheme(
        region_name="Observatory Valley",
        biome="valley",
        color="#0EA5E9",
        icon="\U0001F52D",  # telescope
        descriptor="a valley of observatories where data is gathered and insight is divined",
    ),
}

# Deterministic palette for any team not present in TEAM_THEMES.
_FALLBACK_PALETTE: tuple[str, ...] = (
    "#64748B",
    "#0891B2",
    "#7C3AED",
    "#DC2626",
    "#059669",
    "#D97706",
    "#2563EB",
    "#DB2777",
)


def resolve_region_theme(team_name: str, department: str, index: int) -> RegionTheme:
    """Return the theme for a team, generating a stable fallback if unknown."""
    theme = TEAM_THEMES.get(team_name)
    if theme is not None:
        return theme
    color = _FALLBACK_PALETTE[index % len(_FALLBACK_PALETTE)]
    return RegionTheme(
        region_name=f"{team_name} Reach",
        biome="frontier",
        color=color,
        icon="\U0001F310",  # globe
        descriptor=f"a frontier territory shaped by the {team_name} guild of {department}",
    )


def resolve_system_archetype(system: SystemAsset) -> LandmarkArchetype:
    """Pick a landmark archetype for a system from its name/criticality."""
    name = system.name.lower()
    criticality = (system.criticality or "").lower()

    if "gateway" in name:
        return LandmarkArchetype("Gateway Arch", "gateway", "\U0001F309")  # bridge at night
    if "auth" in name or "identity" in name:
        return LandmarkArchetype("Bastion", "bastion", "\U0001F6E1\uFE0F")  # shield
    if "insights" in name or "analytics" in name or "data" in name:
        return LandmarkArchetype("Observatory", "observatory", "\U0001F52D")  # telescope
    if "web" in name or "app" in name or "portal" in name:
        return LandmarkArchetype("Grand Plaza", "plaza", "\U0001F3DB\uFE0F")  # classical building
    if "api" in name:
        return LandmarkArchetype("Spire", "spire", "\U0001F5FC")  # tower
    if criticality == "critical":
        return LandmarkArchetype("Keep", "keep", "\U0001F3EF")  # japanese castle
    return LandmarkArchetype("Tower", "tower", "\U0001F5FC")  # tower


#: Archetype used for every project landmark.
PROJECT_ARCHETYPE = LandmarkArchetype("Worksite", "worksite", "\U0001F6A7")  # construction
