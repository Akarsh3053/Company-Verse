# Change Management Process

**Document ID:** OPS-ENG-011  
**Version:** 1.6  
**Owner:** Robert Kim (Director of DevOps)  
**Approved By:** Sarah Chen (VP Engineering)  
**Last Reviewed:** 2026-03-10  
**Status:** Approved  

---

## 1. Purpose

This document defines the change management process for all changes to Nexova's production systems. It ensures that changes are reviewed, approved, and executed safely, minimizing risk to system stability and customer experience.

---

## 2. Change Categories

| Category | Definition | Examples | Approval Required |
|----------|------------|---------|-------------------|
| **Standard** | Pre-approved, low-risk, routine change | Dependency patch, config flag toggle, documentation | None (self-service) |
| **Normal** | Planned change requiring review | Feature deployment, new integration, DB migration | Team lead + 1 peer |
| **Emergency** | Urgent fix to restore service (hotfix) | P0/P1 hotfix, security patch | VP Engineering (async OK) |
| **Major** | High-risk or wide-blast-radius change | Architecture change, external API change, data migration | Change Advisory Board (CAB) |

---

## 3. Standard Changes (Pre-Approved)

The following change types are pre-approved and do not require a change request:
- Routine dependency version bumps (patch versions, no breaking changes)
- Feature flag toggles in LaunchDarkly (for flags in production ≥14 days)
- Documentation updates
- Non-production environment changes
- Monitoring threshold adjustments
- Scaling adjustments within pre-approved bounds (±30% of baseline)

**Process:** Deploy per standard SOP (SOP-ENG-001). No separate approval needed.

---

## 4. Normal Change Process

### 4.1 Initiation
- Engineer creates a Jira ticket in the CHG (Change) project
- Template fields: description, systems affected, risk assessment, rollback plan, deployment window, dependencies

### 4.2 Risk Assessment

Engineers self-assess risk using the following matrix:

| Factor | Low (1) | Medium (2) | High (3) |
|--------|---------|------------|---------|
| Blast radius | Single service | 2–3 services | All services |
| Reversibility | Easy (feature flag) | Moderate (rollback deploy) | Hard (data migration) |
| Customer impact | None | Some users | All users |
| Testing coverage | Full automated coverage | Partial coverage | Manual only |
| Time sensitivity | Can wait | Week | Urgent |

**Score 5–7:** Low risk (team lead approval)  
**Score 8–11:** Medium risk (team lead + director approval)  
**Score 12–15:** High risk → escalate to Major change process

### 4.3 Approval
- Low risk: Direct team lead approval in Jira
- Medium risk: Team lead + relevant Director (Engineering, DevOps, or Data)
- All approvers must review and comment in Jira before deployment proceeds

### 4.4 Scheduling
- Changes scheduled in the Deployment Calendar (shared Google Calendar: `nexova-production-changes@nexova.io`)
- Minimum 24h notice before production deployment
- No more than 3 Normal changes per deployment window

---

## 5. Emergency Change Process

For P0/P1 incidents requiring an immediate production fix:

1. **Scope:** Limited to the minimum change necessary to restore service
2. **Approval:** Verbal/Slack approval from VP Engineering (or Director of DevOps if VP unavailable)
3. **Review:** Post-deployment — retrospective code review within 24 hours
4. **Documentation:** Emergency CHG ticket created within 2 hours of deployment
5. **Testing:** Abbreviated (unit tests must pass; integration tests run async post-deploy)

---

## 6. Major Change Process (CAB)

Changes scored High risk or impacting external APIs/customer data require Change Advisory Board review.

### CAB Composition
- VP Engineering (Sarah Chen) — Chair
- Director of DevOps (Robert Kim)
- Lead PM for affected product (Michael Okafor or Sophia Larsen)
- Director of CS (Diana Osei) — for customer-facing changes
- Legal (ad hoc) — for compliance-relevant changes

### CAB Meeting Schedule
- Standing weekly meeting: Wednesdays 14:00 ET
- Emergency CAB: convened ad hoc via Slack #change-advisory

### CAB Process
1. Change owner submits Major CHG ticket ≥5 business days before planned deploy
2. CHG ticket reviewed asynchronously by all CAB members
3. CAB meeting: discussion, Q&A, decision
4. Decision: Approve / Approve with conditions / Reject / Defer
5. If approved: deploy per schedule; real-time update to CAB Slack channel
6. Post-change review at next CAB meeting

---

## 7. Change Freeze Periods

No Normal or Major changes during:
- **Quarter-end freeze:** Last 3 business days of each quarter
- **Customer go-live windows:** ≥48h window around major enterprise go-lives (CS team maintains calendar)
- **Holiday freeze:** Dec 20 – Jan 3

Emergency changes may proceed during freezes with CEO + VP Engineering approval.

---

## 8. Change Log

All production changes are logged in:
- Jira CHG project (source of truth)
- Datadog Events (automatic from ArgoCD)
- Slack #deployments (automatic notification from CI/CD)

Audit report generated monthly by DevOps for SOC 2 evidence collection.

---

## 9. Metrics & Review

Change management effectiveness is reviewed quarterly:
- Change success rate (no rollbacks needed): target ≥97%
- Emergency change rate (% of total): target <5%
- Mean time to approve Normal changes: target <24 hours
- Failed changes (requiring rollback): post-mortem required for all
