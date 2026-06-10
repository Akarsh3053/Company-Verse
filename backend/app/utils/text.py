"""Small, dependency-free text helpers."""

from __future__ import annotations

import re

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Return a lowercase, hyphenated slug suitable for stable IDs."""
    return _SLUG_RE.sub("-", value.lower().strip()).strip("-")


def strip_company_prefix(name: str, token: str | None) -> str:
    """Strip a leading company token (e.g. ``"Nexova "``) from a name."""
    if token and name.startswith(f"{token} "):
        return name[len(token) + 1 :]
    return name


def truncate(text: str, limit: int = 280) -> str:
    """Collapse whitespace and truncate ``text`` to ``limit`` characters."""
    collapsed = " ".join(text.split())
    if len(collapsed) <= limit:
        return collapsed
    return collapsed[: limit - 1].rstrip() + "\u2026"
