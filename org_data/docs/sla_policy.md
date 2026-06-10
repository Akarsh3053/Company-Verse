# Service Level Agreement (SLA) Policy

**Document ID:** POL-CS-009  
**Version:** 3.1  
**Owner:** Diana Osei (Director of Customer Success)  
**Legal Review:** Completed 2026-01-08  
**Approved By:** Christine Alvarez (CEO)  
**Last Reviewed:** 2026-01-15  
**Effective Date:** 2026-02-01  
**Status:** Approved — Active  

---

## 1. Purpose

This policy defines the service level commitments Nexova Technologies makes to its customers across all pricing tiers. It establishes uptime targets, support response times, and remediation credits.

---

## 2. Scope

These SLA commitments apply to all production Nexova systems:
- Nexova Flow (workflow execution and management)
- Nexova Insights (analytics and reporting)
- Nexova Connect (integrations)
- Nexova Web Application

---

## 3. Customer Tiers

| Tier | ACV Range | Accounts | SLA Level |
|------|-----------|----------|-----------|
| **Starter** | < $15K | ~140 | Standard |
| **Growth** | $15K – $75K | ~150 | Enhanced |
| **Enterprise** | $75K – $200K | ~42 | Premium |
| **Strategic** | > $200K | ~8 | Dedicated |

---

## 4. Uptime SLA Commitments

### 4.1 Monthly Uptime Targets

| Tier | Monthly Uptime | Max Monthly Downtime |
|------|---------------|---------------------|
| Standard | 99.5% | 3h 39m |
| Enhanced | 99.9% | 43m 48s |
| Premium | 99.95% | 21m 54s |
| Dedicated | 99.99% | 4m 22s |

### 4.2 Uptime Calculation

```
Monthly Uptime % = ((Total Minutes - Downtime Minutes) / Total Minutes) × 100
```

**Excluded from downtime calculation:**
- Scheduled maintenance (≥72h advance notice)
- Incidents caused by customer actions or third-party dependencies outside Nexova's control
- Force majeure events
- Beta features (clearly labeled)

**Maintenance windows:** Tuesdays 02:00–04:00 ET (typically <30 min)

---

## 5. Support Response Time SLA

| Priority | Definition | Standard | Enhanced | Premium | Dedicated |
|----------|------------|---------|---------|---------|-----------|
| **P1 (Critical)** | Platform unavailable, data loss risk | 1 hour | 30 min | 15 min | 10 min |
| **P2 (High)** | Major feature broken, significant impact | 4 hours | 2 hours | 1 hour | 30 min |
| **P3 (Medium)** | Degraded performance, workaround exists | 24 hours | 8 hours | 4 hours | 2 hours |
| **P4 (Low)** | General inquiry, cosmetic issue | 3 bus days | 2 bus days | 1 bus day | 4 hours |

**Support hours:** 
- Standard/Enhanced: Monday–Friday, 09:00–18:00 ET
- Premium: Monday–Friday, 08:00–20:00 ET + on-call for P1
- Dedicated: 24/7/365 for P1/P2

---

## 6. SLA Credits

If Nexova fails to meet the uptime SLA in any calendar month, the customer is eligible for service credits:

### 6.1 Credit Schedule

| Actual Monthly Uptime | Credit (% of Monthly Fee) |
|-----------------------|--------------------------|
| 99.0% – < SLA Target | 10% |
| 95.0% – 99.0% | 25% |
| < 95.0% | 50% |

### 6.2 Credit Limits
- Maximum credit per month: 50% of that month's fees
- Credits applied to next billing cycle
- Credits are the sole and exclusive remedy for SLA failures
- Credits are not redeemable for cash

### 6.3 Credit Request Process
1. Customer submits credit request to: sla-credits@nexova.io
2. Request must be submitted within **30 days** of the incident
3. Nexova verifies against internal monitoring data
4. Credit applied within 2 billing cycles of approval
5. Disputes escalated to Diana Osei (Director of CS)

---

## 7. Incident Communication

During active P1/P2 incidents:

| Tier | Communication Method | Frequency |
|------|---------------------|-----------|
| All | Status page (status.nexova.io) | Every 15 min during P1, 30 min during P2 |
| Enhanced+ | Email notification | On declaration and resolution |
| Premium+ | Direct Slack/Teams channel | Real-time updates |
| Dedicated | Dedicated Slack + direct phone | Real-time + dedicated incident phone |

Post-incident: Root Cause Analysis (RCA) report provided to Enhanced+ within:
- P1: 48 hours
- P2: 5 business days

---

## 8. Dedicated Tier — Additional Commitments

Strategic customers (Dedicated tier) also receive:
- **Named CSM:** Dedicated Senior Customer Success Manager
- **Executive sponsor:** Regular executive business reviews (quarterly)
- **Technical account manager:** Monthly architecture reviews
- **Private Slack channel:** Direct engineering escalation path
- **Advance notice of breaking changes:** 18 months (vs. standard 6)
- **Custom SLA addendum:** Available upon request

---

## 9. Monitoring & Reporting

- **Status page:** `https://status.nexova.io` — real-time uptime display
- **Monthly uptime reports:** Emailed to all Enhanced+ customers on the 5th of each month
- **Annual SLA review:** CS team reviews SLA performance with each customer in QBR

Internal monitoring: Datadog synthetic tests (every 60 seconds, 5 global regions), with PagerDuty alerting if any region fails 3 consecutive checks.

---

## 10. Definitions

| Term | Definition |
|------|------------|
| **Downtime** | Service unavailable or error rate > 5% for ≥5 consecutive minutes |
| **Response Time** | Time from ticket creation to first meaningful response from Nexova support |
| **Resolution Time** | Time from ticket creation to verified resolution (not a target SLA, best effort) |
| **Scheduled Maintenance** | Planned downtime with ≥72h advance notice posted to status page |
