"""Enterprise knowledge domain models.

These models form the *normalized* representation of enterprise knowledge that
every :class:`~app.providers.base.KnowledgeProvider` returns, regardless of the
underlying source (local synthetic dataset today, Foundry IQ later). Generators
and services depend only on these models — never on raw CSV/markdown — which is
what keeps the provider boundary clean.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Employee(BaseModel):
    """A single member of the organization."""

    id: int
    first_name: str
    last_name: str
    email: str
    title: str
    department: str
    team: str
    manager_id: int = 0
    start_date: str | None = None
    location: str | None = None
    employment_type: str | None = None
    status: str | None = None

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class Team(BaseModel):
    """A team derived from the org chart (department + team grouping)."""

    id: str
    name: str
    department: str
    lead_employee_id: int | None = None
    lead_name: str | None = None
    member_ids: list[int] = Field(default_factory=list)

    @property
    def headcount(self) -> int:
        return len(self.member_ids)


class Department(BaseModel):
    """A department grouping one or more teams."""

    id: str
    name: str
    team_names: list[str] = Field(default_factory=list)
    headcount: int = 0


class SystemAsset(BaseModel):
    """A production system / service owned by a team."""

    id: int
    name: str
    description: str
    tech_stack: list[str] = Field(default_factory=list)
    owner_team: str
    status: str | None = None
    last_deployed: str | None = None
    uptime_sla_pct: float | None = None
    criticality: str | None = None
    repository: str | None = None
    monthly_active_users: int | None = None
    cloud_provider: str | None = None
    region: str | None = None


class Project(BaseModel):
    """A cross-functional initiative spanning one or more teams."""

    id: int
    name: str
    description: str
    status: str | None = None
    priority: str | None = None
    start_date: str | None = None
    target_end_date: str | None = None
    budget_usd: int | None = None
    lead_pm: str | None = None
    lead_engineer: str | None = None
    teams_involved: list[str] = Field(default_factory=list)
    completion_pct: int | None = None
    milestones_total: int | None = None
    milestones_completed: int | None = None
    jira_board: str | None = None


class Document(BaseModel):
    """A knowledge document (SOP, runbook, policy, ADR, ...)."""

    id: str
    title: str
    category: str
    owner: str | None = None
    path: str
    summary: str = ""
    content: str = ""


class CompanyProfile(BaseModel):
    """High-level company facts used for world metadata."""

    name: str
    industry: str | None = None
    description: str | None = None
    founded: str | None = None
    headquarters: str | None = None
    stage: str | None = None
    employee_count: int | None = None
    ceo: str | None = None
    attributes: dict[str, str] = Field(default_factory=dict)


class KnowledgeSnapshot(BaseModel):
    """A complete, point-in-time view of enterprise knowledge."""

    company: CompanyProfile
    employees: list[Employee] = Field(default_factory=list)
    teams: list[Team] = Field(default_factory=list)
    departments: list[Department] = Field(default_factory=list)
    systems: list[SystemAsset] = Field(default_factory=list)
    projects: list[Project] = Field(default_factory=list)
    documents: list[Document] = Field(default_factory=list)


class DocumentMatch(BaseModel):
    """A scored retrieval hit returned by a provider's ``search``."""

    document_id: str
    title: str
    score: float
    snippet: str


class ProviderHealth(BaseModel):
    """Health/availability of a knowledge provider."""

    provider: str
    status: Literal["ok", "degraded", "unavailable"]
    detail: str | None = None
