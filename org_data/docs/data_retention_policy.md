# Data Retention and Deletion Policy

**Document ID:** POL-DATA-006  
**Version:** 2.0  
**Owner:** Victor Huang (Director of Data & Analytics)  
**Legal Review:** Completed 2026-01-10  
**Approved By:** Christine Alvarez (CEO)  
**Last Reviewed:** 2026-01-15  
**Next Review:** 2027-01-15  
**Status:** Approved  

---

## 1. Purpose

This policy defines how Nexova Technologies retains, archives, and deletes customer data, operational data, and internal business data. It ensures compliance with GDPR, CCPA, HIPAA (where applicable), and contractual obligations.

---

## 2. Scope

This policy applies to:
- All customer data processed by Nexova products
- Employee personal data
- Internal business and financial records
- System logs and telemetry
- Backup and archive data

---

## 3. Data Classification

| Class | Definition | Examples |
|-------|------------|---------|
| **Class 1 — Critical** | Personally Identifiable Information (PII), Protected Health Information (PHI), Payment data | Names, emails, SSN, health records, credit card data |
| **Class 2 — Confidential** | Business-sensitive data, internal strategy, contracts | Customer contracts, financial projections, source code |
| **Class 3 — Internal** | Operational data not for public disclosure | System logs, internal communications, incident reports |
| **Class 4 — Public** | Information cleared for external use | Marketing materials, public documentation, blog posts |

---

## 4. Retention Schedules

### 4.1 Customer Data

| Data Type | Class | Active Retention | Post-Contract Retention | Deletion Method |
|-----------|-------|-----------------|------------------------|-----------------|
| Customer account profiles | 1 | Duration of contract | 30 days | Secure wipe |
| Workflow definitions | 2 | Duration of contract | 30 days | Secure wipe |
| Workflow execution logs | 3 | Duration of contract + 1 year | 30 days after contract end | Secure wipe |
| Audit trail logs | 3 | Duration of contract + 7 years | Per contractual obligation | Secure archive then wipe |
| Analytics/dashboard data | 3 | Duration of contract | 30 days | Secure wipe |
| Integration credentials | 1 | Duration of active integration | Immediate on disconnect | Secure wipe |
| File attachments in workflows | 2 | Duration of contract | 30 days | Secure wipe |

### 4.2 Operational / System Data

| Data Type | Class | Retention Period | Notes |
|-----------|-------|-----------------|-------|
| Application logs | 3 | 90 days (searchable) | Archived to S3 for 1 year, then deleted |
| Security audit logs | 3 | 7 years | Immutable S3 storage with Object Lock |
| Auth event logs | 1 | 7 years | Immutable, required for SOC 2 |
| Error/crash reports | 3 | 90 days | Sentry retention policy |
| Infrastructure logs | 3 | 30 days | Datadog rolling retention |
| Backup snapshots | 2 | 30 daily, 12 monthly, 7 yearly | AWS S3 Glacier for archives |
| CI/CD build logs | 4 | 90 days | GitHub Actions retention |

### 4.3 Employee Data

| Data Type | Class | Retention Period |
|-----------|-------|-----------------|
| Employment records | 1 | Duration of employment + 7 years |
| Payroll records | 1 | 7 years (legal requirement) |
| Performance reviews | 2 | Duration of employment + 3 years |
| Access logs (employee) | 3 | 1 year |
| Email / Slack | 3 | 3 years |

### 4.4 Business Records

| Record Type | Retention |
|-------------|-----------|
| Contracts | 10 years post-expiry |
| Financial statements | 7 years |
| Board minutes | Permanent |
| Tax records | 7 years |
| Legal correspondence | 10 years |

---

## 5. Customer Data Deletion

### 5.1 Right to Erasure (GDPR Art. 17 / CCPA)

When a customer requests data deletion:

1. Customer submits request via: privacy@nexova.io or the in-product Privacy Center
2. Request logged in the Privacy Request Tracker (Jira: PRIVACY project)
3. Identity verification completed within 5 business days
4. Deletion initiated within **30 days** of verified request
5. Deletion confirmation sent to customer within **45 days**

### 5.2 Contract Termination Deletion

1. CS team notifies Data team upon contract termination
2. Data team initiates deletion workflow within 30 days
3. Customer notified of deletion with certificate within 60 days
4. Exception: Audit trail logs subject to legal hold are retained per applicable law

### 5.3 Deletion Process (Technical)

```
1. Mark account as "pending_deletion" in database
2. Disable all API keys and sessions (immediate)
3. Remove from all active queues/processing pipelines
4. Database: hard delete all PII fields (not soft delete)
5. Object storage (S3): delete all customer objects
6. Backups: customer data excluded from next backup cycle;
   historical backups containing customer data aged out per backup schedule
7. Analytics: purge from ClickHouse data warehouse
8. Log: write deletion audit record (retained per §4.2)
```

---

## 6. Data Minimization

- Collect only data necessary for the stated purpose (GDPR Art. 5(1)(c))
- New data fields require Data Team + Legal review before collection
- Annual data inventory review to identify and purge unnecessary data collection
- Telemetry and analytics collected with explicit customer consent

---

## 7. Cross-Border Data Transfers

| Customer Region | Data Residency | Transfer Mechanism |
|----------------|---------------|-------------------|
| United States | AWS us-east-1 | N/A |
| European Union | AWS eu-west-1 (Ireland) | Standard Contractual Clauses (SCCs) |
| United Kingdom | AWS eu-west-2 (London) | UK GDPR Addendum |
| Canada | AWS ca-central-1 | PIPEDA compliant |

EU customer data never leaves AWS eu-west-1 region without explicit customer consent.

---

## 8. Breach Notification

In the event of a data breach involving personal data:
- Internal escalation: immediate per Incident Response Playbook (OPS-SEC-002)
- GDPR supervisory authority: notify within **72 hours** (if EU data involved)
- Affected individuals: notify **without undue delay** if high risk
- CCPA notification: within **45 days** for California residents

---

## 9. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Director of Data & Analytics | Policy ownership, annual review |
| DevOps Team | Implementing deletion automation, backup management |
| Legal / Compliance | Regulatory guidance, exception approval |
| Customer Success | Communicating deletion timelines to customers |
| All Employees | Reporting potential data handling violations |

---

## 10. Non-Compliance

Violations of this policy may result in:
- Regulatory fines (GDPR: up to 4% of global annual turnover)
- Contractual penalties
- Disciplinary action up to and including termination

Questions or concerns: privacy@nexova.io
