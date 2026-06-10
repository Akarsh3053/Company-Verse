# Access Control Matrix (RBAC)

**Document ID:** SEC-IAM-015  
**Version:** 2.3  
**Owner:** Robert Kim (Director of DevOps)  
**Reviewed By:** Sarah Chen, Priya Patel  
**Last Updated:** 2026-05-01  
**Status:** Approved — Active  

---

## 1. Overview

This document defines the Role-Based Access Control (RBAC) matrix for Nexova Technologies' internal systems and production infrastructure. It governs which roles have access to which systems and at what permission level.

**Principle of Least Privilege:** All access grants must be the minimum required to perform the job function. Access beyond baseline requires documented business justification and manager approval.

---

## 2. Access Levels

| Level | Symbol | Description |
|-------|--------|-------------|
| No Access | — | No access to system |
| Read | R | Can view, cannot modify |
| Read/Write | RW | Can view and modify |
| Admin | A | Full control including user management and config |
| Emergency | E | Break-glass access (audited, time-limited) |

---

## 3. Internal Systems Access Matrix

### 3.1 Production Infrastructure

| Role | AWS Console | Kubernetes (prod) | RDS (prod) | Secrets Manager | ArgoCD |
|------|------------|-------------------|-----------|----------------|--------|
| Software Engineer I/II | — | R (read namespaces only) | — | — | R |
| Senior Software Engineer | — | R | R (read replica) | — | R |
| Principal Engineer | — | RW | R | R | RW |
| Engineering Manager | — | R | R | — | R |
| Director of DevOps | A | A | A | A | A |
| Senior DevOps Engineer | RW | RW | RW | RW | RW |
| DevOps Engineer I/II | RW | RW | R | R | RW |
| VP of Engineering | R | R | R | R | R |
| All Others | — | — | — | — | — |

### 3.2 Development Tools

| Role | GitHub (code) | GitHub (admin) | Jira | Datadog | PagerDuty |
|------|--------------|----------------|------|---------|-----------|
| All Engineers | RW | — | RW | R | R |
| Principal Engineer | RW | R | RW | RW | RW |
| Engineering Manager | RW | R | A (team) | RW | A (team) |
| Director of DevOps | RW | A | RW | A | A |
| VP of Engineering | R | A | RW | A | A |
| PM / Design | R | — | RW | R | — |
| Customer Success | — | — | R | — | — |
| Sales | — | — | — | — | — |

### 3.3 Business Applications

| Role | Salesforce | Zendesk | Notion | Google Workspace | Workramp |
|------|-----------|---------|--------|-----------------|---------|
| All Employees | — | — | R | RW (own) | R |
| CS Team | R | RW | RW | RW | R |
| CS Director | RW | A | A (CS) | RW | R |
| Sales Team | RW | R | RW (Sales) | RW | R |
| VP Sales | A | R | A (Sales) | RW | R |
| PM Team | R | R | RW | RW | R |
| HR (People Ops) | R | — | A (HR) | A | A |

### 3.4 Financial Systems

| Role | Stripe Dashboard | QuickBooks | Carta (equity) |
|------|-----------------|-----------|----------------|
| CEO | A | A | A |
| CFO (contractor) | A | A | A |
| VP Sales | R (revenue) | — | — |
| Finance (contractor) | R | RW | R |
| All Others | — | — | — |

---

## 4. Customer Data Access

Production customer data access is strictly controlled:

| Role | Customer Data (Prod DB) | Customer Data (Staging) | Audit Logs |
|------|------------------------|------------------------|------------|
| Software Engineer I/II | — | RW (anonymized) | — |
| Senior Software Engineer | — | RW (anonymized) | R |
| Principal Engineer | E (break-glass) | RW | R |
| Director of DevOps | E (break-glass) | A | A |
| Senior DevOps Engineer | — | RW | R |
| CS Manager | R (via app) | — | R (their customers) |
| CS Director | R (via app) | — | A |
| Support (L2) | R (limited, via app) | — | R (their customers) |

**Break-glass access:** Requires manager approval in Jira + automated Slack alert to #security-access-log. Session recorded. Access automatically expires after 4 hours.

---

## 5. Access Provisioning Process

### New Access Request
1. Employee submits request in Jira: `ITHELP` project, issue type "Access Request"
2. Manager approves via Jira comment
3. IT (Fatima Al-Rashid or Wei Zhang) provisions within 1 business day
4. Access logged in Access Register (maintained by DevOps)

### Access Review
- Quarterly access review for Tier 1 systems (AWS, RDS, Secrets Manager)
- Annual access review for all other systems
- Automated review reminders sent via Jira to all managers
- Any access not re-approved within 30 days of review trigger is auto-revoked

### Offboarding (Employee Termination)
**All access revoked within 2 hours of HR notification:**
1. Okta account disabled (disables SSO to all apps)
2. GitHub org access removed
3. PagerDuty removed from on-call rotation
4. API keys and personal access tokens revoked
5. Active sessions invalidated
6. Laptop remote-wiped if not returned within 5 days

---

## 6. Privileged Access Management (PAM)

- All AWS console access requires MFA (TOTP or hardware key)
- Production database access requires VPN + MFA
- All privileged actions in AWS are logged to CloudTrail (S3 immutable, 7-year retention)
- `kubectl exec` into production pods requires break-glass workflow
- No shared credentials — all access is individual and traceable
- Service accounts use AWS IAM Roles with short-lived credentials (no long-lived keys)

---

## 7. Exceptions

Access exceptions (access above the matrix above) require:
1. Written justification from employee
2. Manager approval
3. VP Engineering or Director of DevOps approval (for production systems)
4. Time-limited (max 90 days, must be renewed)
5. Logged in the Exceptions Register

Current active exceptions: 2 (see Jira ITHELP-488, ITHELP-501)
