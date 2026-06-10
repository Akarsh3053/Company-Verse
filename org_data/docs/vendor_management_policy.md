# Vendor Management Policy

**Document ID:** POL-OPS-014  
**Version:** 1.4  
**Owner:** Jennifer Walsh (VP of Product, interim COO functions)  
**Legal Review:** Completed 2025-09-12  
**Approved By:** Christine Alvarez (CEO)  
**Last Reviewed:** 2026-01-20  
**Status:** Approved  

---

## 1. Purpose

This policy establishes requirements for evaluating, onboarding, managing, and offboarding third-party vendors and service providers at Nexova Technologies. It ensures that vendor relationships are managed consistently, securely, and in compliance with applicable regulations.

---

## 2. Scope

Applies to all third-party vendors that:
- Process, store, or transmit Nexova or customer data
- Provide software, infrastructure, or services used in production
- Have access to Nexova systems, networks, or facilities
- Provide professional services involving access to confidential information

---

## 3. Vendor Classification

| Tier | Definition | Examples | Review Frequency |
|------|------------|---------|-----------------|
| **Tier 1 — Critical** | Processes customer PII or PHI; production infrastructure; revenue-critical | AWS, Stripe, Okta, Salesforce | Annual + on material change |
| **Tier 2 — Important** | Business operations; non-production access to customer data | Datadog, PagerDuty, GitHub, Zendesk | Annual |
| **Tier 3 — Standard** | SaaS tools with no customer data access | Notion, Zoom, Slack, Google Workspace | Every 2 years |
| **Tier 4 — Low Risk** | One-off purchases; no system access | Office supplies, one-time contractors | None |

---

## 4. Vendor Onboarding Process

### Step 1: Business Justification
- Requesting team documents: business need, alternatives considered, estimated cost, data involved
- Submit via Vendor Request form (Notion → Operations → Vendor Requests)

### Step 2: Security Review (Tier 1 and 2)
- Security assessment questionnaire sent to vendor
- Review SOC 2 Type II report (required for Tier 1), or SOC 2 Type I / ISO 27001 (Tier 2)
- Penetration test results reviewed if available
- Data Processing Agreement (DPA) reviewed and executed
- Sub-processor list reviewed

### Step 3: Legal Review
- Master Services Agreement (MSA) / Terms of Service reviewed
- Data Processing Agreement (DPA) executed for any vendor processing EU/UK personal data
- SLA reviewed and noted
- Liability caps and indemnification reviewed
- Legal counsel engaged for contracts >$50K/year or unusual terms

### Step 4: Financial Approval

| Contract Value | Approval Required |
|---------------|------------------|
| < $5K/year | Team Lead |
| $5K – $25K/year | Department VP |
| $25K – $100K/year | CEO |
| > $100K/year | CEO + Board notification |

### Step 5: Onboarding
- Vendor added to Vendor Register (maintained by Jennifer Walsh)
- Access provisioned with least-privilege principle
- Vendor added to renewal calendar (90-day advance reminder)

---

## 5. Current Vendor Register (Tier 1 & 2)

| Vendor | Category | Tier | Annual Cost | Contract Renewal | Owner |
|--------|----------|------|-------------|-----------------|-------|
| Amazon Web Services | Cloud Infrastructure | 1 | ~$441K | Rolling | Robert Kim |
| Stripe | Payment Processing | 1 | ~$36K | Rolling | Jennifer Walsh |
| Okta | Identity Provider | 1 | $28K | 2027-03-01 | Robert Kim |
| Salesforce | CRM | 1 | $62K | 2027-01-15 | Brandon Scott |
| Datadog | Observability | 2 | $84K | 2026-11-01 | Robert Kim |
| GitHub | Source Control + CI | 2 | $18K | 2026-12-01 | Sarah Chen |
| PagerDuty | Incident Management | 2 | $22K | 2027-02-01 | Robert Kim |
| Zendesk | Customer Support | 2 | $34K | 2026-09-01 | Diana Osei |
| Snyk | Security Scanning | 2 | $24K | 2026-10-01 | Robert Kim |
| LaunchDarkly | Feature Flags | 2 | $19K | 2026-11-15 | Marcus Williams |
| Twilio | SMS/Voice OTP | 2 | $8K | Rolling | Priya Patel |
| NCC Group | Penetration Testing | 2 | $35K | Annual | Sarah Chen |

---

## 6. Ongoing Vendor Management

### Annual Review (Tier 1 & 2)
- Re-review SOC 2 / security posture
- Verify DPA is current and covers all data processing
- Assess if vendor still meets business needs
- Review pricing and benchmark against market

### Incident Notification
Tier 1 and 2 vendors must notify Nexova within:
- 24 hours for suspected data breaches involving Nexova data
- 72 hours for confirmed breaches
- Nexova point of contact: security@nexova.io

### Sub-processor Management
- Nexova publishes its sub-processor list at `nexova.io/legal/sub-processors`
- Customers (GDPR) receive 30-day advance notice of new sub-processors
- 30-day objection window for EU/UK customers per DPA

---

## 7. Vendor Offboarding

When a vendor relationship ends:

1. Access revoked immediately upon contract termination
2. Data deletion request submitted (per DPA) within 30 days
3. Deletion certificate obtained and filed
4. Vendor removed from Vendor Register
5. API keys and credentials rotated
6. Any vendor-managed data exports completed and archived

---

## 8. Third-Party Risk Events

If a Tier 1 or 2 vendor reports a security incident affecting Nexova:
1. Notify Security (robert.kim@nexova.io) immediately
2. Assess potential customer data exposure
3. Follow Incident Response Playbook (OPS-SEC-002)
4. Legal notified if customer data potentially involved
5. Customer notification per Data Retention Policy (POL-DATA-006 §8)

---

## 9. Policy Exceptions

Exceptions (e.g., proceeding without a SOC 2 report) require written approval from VP Engineering + CEO. Exceptions are time-limited (max 12 months) and tracked in the Vendor Register.
