# Incident Response Playbook

**Document ID:** OPS-SEC-002  
**Version:** 2.4  
**Owner:** Robert Kim (Director of DevOps) + Sarah Chen (VP Engineering)  
**Last Reviewed:** 2026-04-28  
**Next Review:** 2026-10-28  
**Status:** Approved  

---

## 1. Purpose

This playbook defines how Nexova Technologies detects, responds to, communicates about, and learns from production incidents. It applies to all systems and all severities.

---

## 2. Incident Severity Definitions

| Severity | Name | Definition | Response SLA | Resolution Target |
|----------|------|------------|-------------|-------------------|
| **SEV-1 (P0)** | Critical | Full platform outage; all customers impacted; data loss risk | 5 min acknowledge | 1 hour |
| **SEV-2 (P1)** | Major | Significant feature unavailable; ≥20% customers impacted | 15 min acknowledge | 4 hours |
| **SEV-3 (P2)** | Minor | Degraded performance; <20% customers impacted; workaround exists | 30 min acknowledge | 24 hours |
| **SEV-4 (P3)** | Low | Cosmetic/non-functional issue; no customer impact | Next business day | 1 week |

---

## 3. Incident Roles

| Role | Responsibility | Assigned To |
|------|---------------|-------------|
| **Incident Commander (IC)** | Coordinates response, owns communication | On-call DevOps engineer |
| **Technical Lead** | Diagnoses root cause, drives fix | On-call service owner |
| **Communications Lead** | Customer & internal communications | Senior CSM or CS Director |
| **Executive Sponsor** | Stakeholder for SEV-1 only | VP Engineering or CEO |
| **Scribe** | Documents timeline in real-time | Available team member |

---

## 4. Detection & Alerting

### Automated Alert Sources
- **Datadog Monitors:** Error rate, latency P99, availability checks
- **PagerDuty:** Routes alerts to on-call engineers per escalation policy
- **Synthetics:** Nexova's own Datadog synthetic tests run every 60 seconds from 5 regions
- **Customer Reports:** Zendesk tickets with tag `potential-incident` trigger Slack notification in #incidents

### Alert Routing
```
Datadog Alert → PagerDuty → On-call Engineer (mobile push + call)
                           ↓ (no ack within 5 min)
                         Secondary On-call
                           ↓ (no ack within 10 min)
                         Director of DevOps
```

---

## 5. Incident Response Workflow

### Phase 1: Triage (0–15 min)

1. **Acknowledge** PagerDuty alert
2. **Assess severity** using §2 definitions
3. **Create incident** in PagerDuty (auto-creates #incident-<id> Slack channel)
4. **Declare incident** — post in #incidents: `🚨 SEV-X INCIDENT DECLARED: <brief description>`
5. **Assign IC and Technical Lead**
6. **Join incident Slack channel** and video bridge (Zoom link pinned in channel)

### Phase 2: Diagnosis (0–30 min)

Run through the diagnostic checklist:

```
□ Check Datadog service map for anomalies
□ Check recent deployments (ArgoCD deploy history)
□ Check Kubernetes pod health: kubectl get pods -n production
□ Check database query performance (RDS Performance Insights)
□ Check external dependency status pages (AWS, Stripe, Salesforce, etc.)
□ Review error logs in Datadog Log Explorer
□ Check Kafka consumer lag (Nexova Insights)
□ Check Redis memory/eviction rate
```

### Phase 3: Mitigation (ongoing)

**Priority order:**
1. Stop customer impact (even if root cause unknown) — rollback, feature flag off, circuit breaker
2. Preserve evidence (capture logs, heap dumps before restarting)
3. Fix root cause

### Phase 4: Resolution

1. Confirm metrics have returned to baseline for ≥10 consecutive minutes
2. All customer-facing errors resolved
3. Technical Lead declares incident resolved
4. IC posts resolution message in #incidents and updates status page

### Phase 5: Post-Incident Review (PIR)

| Severity | PIR Required | Deadline |
|----------|-------------|----------|
| SEV-1    | Yes (blameless) | 48 hours after resolution |
| SEV-2    | Yes | 5 business days |
| SEV-3    | Optional (IC discretion) | 2 weeks |

**PIR Template:** See §8

---

## 6. Communication Templates

### Internal Slack — Incident Declaration
```
🚨 SEV-[X] INCIDENT DECLARED
Time: [HH:MM ET]
System(s): [affected systems]
Impact: [customer impact description]
IC: @[name]
Tech Lead: @[name]
Bridge: [Zoom URL]
Status Page: https://status.nexova.io
```

### Status Page — Initial
```
Title: Investigating [brief description]
Status: Investigating
Body: We are aware of an issue affecting [product area] and are actively investigating. Updates will be posted every 15 minutes.
```

### Customer Email — SEV-1 (within 30 min)
```
Subject: Service Disruption — Nexova Platform

We are currently experiencing a service disruption affecting [feature]. Our engineering team is actively working to restore service. We will send updates every 30 minutes until resolution.

We sincerely apologize for the inconvenience.
— Nexova Operations Team
```

---

## 7. Escalation Matrix

| Condition | Action |
|-----------|--------|
| SEV-1 unresolved > 30 min | Page VP Engineering (Sarah Chen) |
| SEV-1 unresolved > 60 min | Page CEO (Christine Alvarez) |
| Data breach suspected | Immediately page CISO (currently Sarah Chen), notify legal |
| Customer data at risk | Director of CS (Diana Osei) + legal within 15 min |
| AWS infrastructure failure | Open P1 support case with AWS |

---

## 8. Post-Incident Review (PIR) Template

```markdown
## Post-Incident Review — INC-[ID]

**Date:** YYYY-MM-DD
**Severity:** SEV-X
**Duration:** HH:MM
**Affected Systems:** 
**Customers Impacted:** [count or %]
**IC:** 
**Authors:** 

### Summary
[2–3 sentence description of what happened]

### Timeline (UTC)
| Time | Event |
|------|-------|
| HH:MM | Alert fired |
| HH:MM | IC acknowledged |
| ... | ... |
| HH:MM | Incident resolved |

### Root Cause
[Detailed technical explanation]

### Contributing Factors
- 
- 

### What Went Well
- 
- 

### What Went Wrong / Areas for Improvement
- 
- 

### Action Items
| Action | Owner | Due Date | Jira Ticket |
|--------|-------|----------|-------------|
| | | | |
```

---

## 9. On-Call Schedule & Tools

- **Schedule:** PagerDuty — weekly rotation, primary + secondary
- **Runbooks:** `https://nexova.notion.so/runbooks`
- **Dashboards:** `https://nexova.datadoghq.com`
- **Status Page:** `https://status.nexova.io` (Statuspage.io)
- **Incident Log:** PagerDuty incident history

---

## 10. Training & Drills

- New engineers complete incident response training within 30 days of joining
- Quarterly chaos engineering exercises (GameDays) run by DevOps team
- Annual tabletop exercise for SEV-1 scenarios
- All engineers participate in on-call rotation after 6-month tenure
