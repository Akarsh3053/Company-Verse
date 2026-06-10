"""Load the synthetic company dataset into normalized domain models.

This module is the *only* place that understands the on-disk shape of the
synthetic dataset (CSV + markdown). Everything downstream consumes the typed
models in :mod:`app.models.knowledge`, which is what lets a future Foundry IQ
provider be a drop-in replacement.

All loaders return collections sorted by a stable key so that world generation
is deterministic.
"""

from __future__ import annotations

import csv
import re
from collections import defaultdict
from pathlib import Path

from app.models.knowledge import (
    CompanyProfile,
    Department,
    Document,
    Employee,
    KnowledgeSnapshot,
    Project,
    SystemAsset,
    Team,
)
from app.utils.text import slugify, truncate


# --------------------------------------------------------------------------- #
# Low-level readers
# --------------------------------------------------------------------------- #
def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8-sig")


def _int(value: str | None) -> int | None:
    if value is None:
        return None
    digits = re.sub(r"[^0-9-]", "", value)
    return int(digits) if digits not in ("", "-") else None


def _float(value: str | None) -> float | None:
    if value is None or value.strip() == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _split(value: str | None, sep: str) -> list[str]:
    if not value:
        return []
    return [part.strip() for part in value.split(sep) if part.strip()]


# --------------------------------------------------------------------------- #
# Employees / teams / departments
# --------------------------------------------------------------------------- #
def load_employees(data_dir: Path) -> list[Employee]:
    employees = [
        Employee(
            id=int(row["id"]),
            first_name=row["first_name"].strip(),
            last_name=row["last_name"].strip(),
            email=row["email"].strip(),
            title=row["title"].strip(),
            department=row["department"].strip(),
            team=row["team"].strip(),
            manager_id=_int(row.get("manager_id")) or 0,
            start_date=(row.get("start_date") or "").strip() or None,
            location=(row.get("location") or "").strip() or None,
            employment_type=(row.get("employment_type") or "").strip() or None,
            status=(row.get("status") or "").strip() or None,
        )
        for row in _read_csv(data_dir / "employees.csv")
    ]
    employees.sort(key=lambda e: e.id)
    return employees


def build_teams(employees: list[Employee]) -> list[Team]:
    """Derive teams from employees and infer each team's lead.

    The lead is the team member whose manager sits *outside* the team (i.e. the
    team's head node in the reporting tree). Ties break on lowest employee id to
    stay deterministic.
    """
    groups: dict[tuple[str, str], list[Employee]] = defaultdict(list)
    for employee in employees:
        groups[(employee.department, employee.team)].append(employee)

    teams: list[Team] = []
    for (department, team_name), members in groups.items():
        member_ids = sorted(member.id for member in members)
        member_id_set = set(member_ids)
        heads = [m for m in members if m.manager_id not in member_id_set]
        candidates = heads or members
        lead = sorted(candidates, key=lambda m: m.id)[0]
        teams.append(
            Team(
                id=slugify(team_name),
                name=team_name,
                department=department,
                lead_employee_id=lead.id,
                lead_name=lead.full_name,
                member_ids=member_ids,
            )
        )

    teams.sort(key=lambda t: (t.department, t.name))
    return teams


def build_departments(employees: list[Employee]) -> list[Department]:
    counts: dict[str, int] = defaultdict(int)
    dept_teams: dict[str, set[str]] = defaultdict(set)
    for employee in employees:
        counts[employee.department] += 1
        dept_teams[employee.department].add(employee.team)

    departments = [
        Department(
            id=slugify(name),
            name=name,
            team_names=sorted(dept_teams[name]),
            headcount=counts[name],
        )
        for name in sorted(counts)
    ]
    return departments


# --------------------------------------------------------------------------- #
# Systems / projects
# --------------------------------------------------------------------------- #
def load_systems(data_dir: Path) -> list[SystemAsset]:
    systems = [
        SystemAsset(
            id=int(row["id"]),
            name=row["name"].strip(),
            description=row["description"].strip(),
            tech_stack=_split(row.get("tech_stack"), "/"),
            owner_team=row["owner_team"].strip(),
            status=(row.get("status") or "").strip() or None,
            last_deployed=(row.get("last_deployed") or "").strip() or None,
            uptime_sla_pct=_float(row.get("uptime_sla_pct")),
            criticality=(row.get("criticality") or "").strip() or None,
            repository=(row.get("repository") or "").strip() or None,
            monthly_active_users=_int(row.get("monthly_active_users")),
            cloud_provider=(row.get("cloud_provider") or "").strip() or None,
            region=(row.get("region") or "").strip() or None,
        )
        for row in _read_csv(data_dir / "systems.csv")
    ]
    systems.sort(key=lambda s: s.id)
    return systems


def load_projects(data_dir: Path) -> list[Project]:
    projects = [
        Project(
            id=int(row["id"]),
            name=row["name"].strip(),
            description=row["description"].strip(),
            status=(row.get("status") or "").strip() or None,
            priority=(row.get("priority") or "").strip() or None,
            start_date=(row.get("start_date") or "").strip() or None,
            target_end_date=(row.get("target_end_date") or "").strip() or None,
            budget_usd=_int(row.get("budget_usd")),
            lead_pm=(row.get("lead_pm") or "").strip() or None,
            lead_engineer=(row.get("lead_engineer") or "").strip() or None,
            teams_involved=_split(row.get("teams_involved"), ","),
            completion_pct=_int(row.get("completion_pct")),
            milestones_total=_int(row.get("milestones_total")),
            milestones_completed=_int(row.get("milestones_completed")),
            jira_board=(row.get("jira_board") or "").strip() or None,
        )
        for row in _read_csv(data_dir / "projects.csv")
    ]
    projects.sort(key=lambda p: p.id)
    return projects


# --------------------------------------------------------------------------- #
# Documents
# --------------------------------------------------------------------------- #
_DOC_CATEGORIES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("incident", "disaster", "on_call", "monitoring", "alerting"), "operations"),
    (("security", "access", "auth"), "security"),
    (("deployment", "release", "change", "kubernetes"), "engineering"),
    (("policy", "retention", "vendor", "sla"), "policy"),
    (("onboarding", "review", "guidelines"), "process"),
    (("roadmap", "benchmark", "schema", "api"), "reference"),
)


def _categorize(stem: str) -> str:
    lowered = stem.lower()
    for keywords, category in _DOC_CATEGORIES:
        if any(keyword in lowered for keyword in keywords):
            return category
    return "general"


def _first_heading(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return None


def _extract_field(text: str, field: str) -> str | None:
    match = re.search(rf"\*\*{re.escape(field)}:\*\*\s*(.+)", text)
    return match.group(1).strip() if match else None


def _first_paragraph(lines: list[str]) -> str:
    paragraph: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if paragraph:
                break
            continue
        if stripped.startswith(("#", "**", "|", "---", ">", "-", "*")):
            continue
        paragraph.append(stripped)
    return " ".join(paragraph)


def load_documents(data_dir: Path) -> list[Document]:
    docs_dir = data_dir / "docs"
    if not docs_dir.exists():
        return []

    documents: list[Document] = []
    for path in sorted(docs_dir.glob("*.md")):
        text = _read_text(path)
        title = _first_heading(text) or path.stem.replace("_", " ").title()
        documents.append(
            Document(
                id=slugify(path.stem),
                title=title,
                category=_categorize(path.stem),
                owner=_extract_field(text, "Owner"),
                path=str(path.relative_to(data_dir)).replace("\\", "/"),
                summary=truncate(_first_paragraph(text.splitlines())),
                content=text,
            )
        )
    documents.sort(key=lambda d: d.id)
    return documents


# --------------------------------------------------------------------------- #
# Company profile
# --------------------------------------------------------------------------- #
def _parse_kv_table(text: str) -> dict[str, str]:
    """Parse the leading ``| **Field** | Detail |`` table from company.md."""
    attributes: dict[str, str] = {}
    for line in text.splitlines():
        if line.count("|") >= 2 and "**" in line:
            cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
            if len(cells) >= 2:
                key = cells[0].replace("**", "").strip()
                value = cells[1].strip()
                if key and value and key.lower() != "field":
                    attributes.setdefault(key, value)
    return attributes


def _company_overview(text: str) -> str:
    lines = text.splitlines()
    capture = False
    paragraph: list[str] = []
    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith("## company overview"):
            capture = True
            continue
        if capture:
            if not stripped:
                if paragraph:
                    break
                continue
            if stripped.startswith(("#", "|")):
                break
            paragraph.append(stripped)
    return truncate(" ".join(paragraph), 400)


def _derive_industry(text: str, attributes: dict[str, str]) -> str | None:
    if "Industry" in attributes:
        return attributes["Industry"]
    lowered = text.lower()
    if "b2b saas" in lowered:
        return "B2B SaaS — Workflow Automation"
    if "saas" in lowered:
        return "SaaS"
    return None


def load_company(data_dir: Path, employee_count: int | None = None) -> CompanyProfile:
    text = _read_text(data_dir / "company.md")
    attributes = _parse_kv_table(text)

    heading = _first_heading(text) or "Unknown Company"
    name = re.sub(r"\s+Inc\.?$", "", heading).strip()

    def attribute(*keys: str) -> str | None:
        for key in keys:
            for attr_key, attr_value in attributes.items():
                if attr_key.lower() == key.lower():
                    return attr_value
        return None

    parsed_count = _int(attribute("Employees"))
    return CompanyProfile(
        name=name,
        industry=_derive_industry(text, attributes),
        description=_company_overview(text),
        founded=attribute("Founded"),
        headquarters=attribute("Headquarters"),
        stage=attribute("Stage"),
        employee_count=parsed_count or employee_count,
        ceo=attribute("CEO"),
        attributes=attributes,
    )


# --------------------------------------------------------------------------- #
# Aggregate snapshot
# --------------------------------------------------------------------------- #
def load_snapshot(data_dir: Path) -> KnowledgeSnapshot:
    """Load the full enterprise knowledge snapshot from ``data_dir``."""
    employees = load_employees(data_dir)
    return KnowledgeSnapshot(
        company=load_company(data_dir, employee_count=len(employees)),
        employees=employees,
        teams=build_teams(employees),
        departments=build_departments(employees),
        systems=load_systems(data_dir),
        projects=load_projects(data_dir),
        documents=load_documents(data_dir),
    )
