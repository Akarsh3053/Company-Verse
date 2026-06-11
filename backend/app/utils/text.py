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


_HEADING_RE = re.compile(r"^#{2,4}\s+(.+?)\s*$")
_NUMBERED_RE = re.compile(r"^#{2,4}\s+\d+(?:\.\d+)*\.?\s+(.+?)\s*$")


def markdown_section_titles(text: str, *, limit: int = 12) -> list[str]:
    """Extract ``##``/``###`` section titles from a markdown document.

    Numeric prefixes (``## 3. Pre-Deployment Checklist``) are stripped so the
    titles read like real, teachable steps/sections. Order is preserved and the
    list is de-duplicated. Used to derive *dataset-driven* challenge content
    (correct answers come from a doc's real sections; distractors from siblings).
    """
    titles: list[str] = []
    seen: set[str] = set()
    for line in text.splitlines():
        stripped = line.strip()
        numbered = _NUMBERED_RE.match(stripped)
        match = numbered or _HEADING_RE.match(stripped)
        if not match:
            continue
        title = match.group(1).strip().rstrip(":")
        # Skip generic boilerplate sections that don't teach anything.
        if title.lower() in {"purpose", "scope", "overview", "contacts", "references"}:
            continue
        key = title.lower()
        if key in seen or not title:
            continue
        seen.add(key)
        titles.append(title)
        if len(titles) >= limit:
            break
    return titles


def first_sentences(text: str, count: int = 2, limit: int = 320) -> str:
    """Return the first ``count`` sentences of (whitespace-collapsed) ``text``."""
    collapsed = " ".join(text.split())
    if not collapsed:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", collapsed)
    snippet = " ".join(parts[:count]).strip()
    return truncate(snippet, limit)
