# Release Management Process

**Document ID:** ENG-PROC-016  
**Version:** 2.1  
**Owner:** Olivia Turner (Senior DevOps Engineer)  
**Reviewed By:** Robert Kim, Sarah Chen, Marcus Williams  
**Last Updated:** 2026-02-18  
**Status:** Approved — Active  

---

## 1. Overview

Nexova follows a continuous delivery model with trunk-based development. All services can be independently deployed. This document describes the release cadence, versioning, and governance model.

---

## 2. Release Philosophy

- **Deploy frequently, deploy safely.** Small, incremental releases are safer and faster to roll back.
- **Trunk-based development.** All engineers commit to `main` via short-lived feature branches (max 2 days).
- **Feature flags for incomplete features.** Features not ready for users are merged behind flags.
- **Independent deployability.** Each service is deployed independently; no lockstep releases.

---

## 3. Release Cadence

| Service | Target Cadence | Actual Q1 2026 |
|---------|---------------|----------------|
| Nexova Web App | Daily | 9.2 deploys/week |
| Nexova Flow API | Daily | 6.8 deploys/week |
| Auth Service | 2–3×/week | 2.1 deploys/week |
| Connect Gateway | 2–3×/week | 2.4 deploys/week |
| Insights Engine | Weekly | 1.1 deploys/week |

---

## 4. Release Types

### 4.1 Continuous Deployment (CD) — Standard
- Feature, fix, or refactor merged to `main`
- CI pipeline runs automatically
- Auto-deploys to staging on merge
- Auto-deploys to production if: CI passes + smoke tests pass + no manual hold
- **Most common release type** (~85% of all deployments)

### 4.2 Planned Release (Feature Release)
For larger features coordinated across multiple PRs or services:
- PM creates a Release ticket in Jira
- Feature flag used to contain feature until all PRs merged
- Release coordinator (usually lead PM or senior engineer) orchestrates flag enablement
- Gradual rollout: 5% → 20% → 50% → 100% (with monitoring at each stage)
- Customer announcement coordinated with CS and Marketing

### 4.3 Hotfix Release
- See SOP-ENG-001 §9 (Hotfix Process)
- Bypasses standard release cadence
- Post-deploy review required within 24 hours

### 4.4 Infrastructure Release
- Terraform changes follow the Change Management Process (OPS-ENG-011)
- ArgoCD manages all Kubernetes resource changes via GitOps

---

## 5. Versioning

### API Versioning
See ARCH-ENG-007 (API Versioning Strategy) for full details.

### Service Versioning
Services use [Semantic Versioning](https://semver.org/):
```
MAJOR.MINOR.PATCH

Examples:
2.14.3 → 2.14.4  (bug fix)
2.14.4 → 2.15.0  (new feature, backward compatible)
2.15.0 → 3.0.0   (breaking change)
```

Docker images are tagged with:
- `latest` — latest production build
- `MAJOR.MINOR.PATCH` — immutable version tag
- `git-SHA` — immutable, used for tracing deployments

### Frontend Versioning
Web App versioned in `package.json`. Browser cache-busting via content-addressed asset filenames (Webpack/Next.js default behavior).

---

## 6. Release Notes

### External (Customer-Facing)
- Published on `nexova.io/changelog` for all user-facing changes
- Major features announced via in-app notification + email newsletter
- Breaking API changes: dedicated email to all affected API customers ≥30 days in advance

### Internal
- All production deployments auto-notified in #deployments Slack
- Weekly engineering all-hands includes "shipped this week" summary (lead PM)
- Monthly product changelog to CS team for customer education

---

## 7. Release Approval Gates

| Deployment Type | Gate 1 | Gate 2 | Gate 3 |
|----------------|--------|--------|--------|
| CD (auto) | CI passes | Staging smoke tests pass | — (auto) |
| Planned release | CD gates + | PM sign-off on flag state | Gradual rollout monitoring |
| Hotfix | CI passes | VP Eng verbal/Slack approval | Post-deploy 15-min monitoring |
| Infrastructure | CI passes | Change Advisory (OPS-ENG-011) | DevOps monitoring 30 min |
| DB migration | CI passes | DBA / senior eng review | Staged rollout (staging 24h first) |

---

## 8. Release Tracking

| Tool | Purpose |
|------|---------|
| GitHub Actions | CI/CD pipeline execution |
| ArgoCD | GitOps deployment tracking (source of truth) |
| Datadog Events | Deployment markers on all dashboards |
| Jira | Feature and release ticket tracking |
| Slack #deployments | Real-time notification of every deployment |
| `nexova.io/changelog` | Customer-facing release history |

---

## 9. Rollback Policy

- All services support rollback to the previous 5 releases
- ArgoCD: `argocd app rollback <service> <revision>`
- Rollback decision authority: on-call engineer (any severity) or IC (incident)
- Target rollback time: <5 minutes for all services
- DB migrations: rollbacks planned before every migration; tested in staging

---

## 10. Release Metrics (Q1 2026)

| Metric | Value | Target |
|--------|-------|--------|
| Deployment frequency (all services) | 22.6/week | >20/week ✅ |
| Lead time (commit → production) | 23 min avg | <60 min ✅ |
| Change failure rate | 2.1% | <5% ✅ |
| MTTR (mean time to restore) | 34 min | <60 min ✅ |
| Rollbacks in Q1 | 3 | — |
