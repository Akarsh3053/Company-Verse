"""Deterministic 2D layout for regions and landmarks.

Positions are computed purely from sorted indices and counts — never from
randomness or timestamps — so the world is byte-for-byte reproducible. Regions
are placed on a ring around the world centre; landmarks are placed on a smaller
ring around their region.
"""

from __future__ import annotations

import math

from app.models.world import Position

#: Centre of the world canvas (also the spawn point / company nexus).
CENTER: tuple[int, int] = (1200, 900)

#: Radius of the ring on which regions are placed.
REGION_RADIUS: int = 640

#: Base radius for landmark rings within a region.
_LANDMARK_BASE_RADIUS: int = 110
_LANDMARK_RADIUS_STEP: int = 14


def _ring(center: tuple[int, int], radius: int, count: int) -> list[Position]:
    """Evenly space ``count`` points on a circle, starting at the top (-90deg)."""
    if count <= 0:
        return []
    if count == 1:
        return [Position(x=center[0], y=center[1] - radius)]
    positions: list[Position] = []
    for i in range(count):
        angle = -math.pi / 2 + (2 * math.pi * i / count)
        x = round(center[0] + radius * math.cos(angle))
        y = round(center[1] + radius * math.sin(angle))
        positions.append(Position(x=x, y=y))
    return positions


def region_positions(count: int) -> list[Position]:
    """Positions for ``count`` regions around the world centre."""
    if count == 1:
        return [Position(x=CENTER[0], y=CENTER[1])]
    return _ring(CENTER, REGION_RADIUS, count)


def landmark_positions(region_center: Position, count: int) -> list[Position]:
    """Positions for ``count`` landmarks around a region centre."""
    radius = _LANDMARK_BASE_RADIUS + _LANDMARK_RADIUS_STEP * count
    return _ring((region_center.x, region_center.y), radius, count)


def spawn_position() -> Position:
    """The player's spawn point — the centre of the world."""
    return Position(x=CENTER[0], y=CENTER[1])
