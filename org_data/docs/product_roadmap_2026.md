# Product Roadmap 2026

**Document ID:** PROD-STRAT-020  
**Version:** 3.0  
**Owner:** Jennifer Walsh (VP of Product)  
**Co-Authors:** Michael Okafor, Sophia Larsen  
**Last Updated:** 2026-05-28  
**Status:** Approved — Shared with Board  
**Confidentiality:** Internal + Board Only  

---

## Executive Summary

FY 2026 is Nexova's "Enterprise Depth" year. With 340 customers and $18.4M ARR, we have proven product-market fit. The 2026 roadmap focuses on: (1) removing the top 5 enterprise blockers that cost us deals, (2) deepening the analytics product to drive NRR, and (3) beginning the architectural work that enables our next phase of scale.

**2026 Themes:**
1. 🔐 **Enterprise Trust** — SSO, compliance controls, audit trails
2. 📊 **Analytics 2.0** — Real-time insights, AI-powered recommendations
3. 🔌 **Connector Ecosystem** — 50 new connectors, private connector SDK
4. ⚡ **Platform Performance** — Microservices migration, sub-second everything
5. 🤖 **AI Features** — Workflow suggestions, anomaly detection (H2)

---

## 2026 OKRs

| Objective | Key Results |
|-----------|------------|
| Grow to $28M ARR | Close 80 new logos; grow NRR to 125% |
| Become the enterprise workflow standard | Win 15 deals >$100K ACV; achieve ISO 27001 |
| Build the best analytics in the category | Analytics product used by 80% of customers; dashboard load <1s |
| Ship at startup speed | Lead time <20 min; deployment frequency >25/week |

---

## Q1 2026 (January–March) — ✅ COMPLETE

| Initiative | Priority | Status | Teams | Outcome |
|-----------|---------|--------|-------|---------|
| ClickHouse migration (Insights) | P0 | ✅ Done | Data, DevOps | Dashboard load: -72% |
| Enterprise SSO Phase 1 (Okta, Azure AD) | P0 | ✅ Done | Platform, Frontend | 8 deals unblocked |
| Workflow versioning & rollback | P1 | ✅ Done | Platform, Product | Most-requested feature |
| Performance right-sizing (K8s) | P1 | ✅ Done | DevOps | Infra cost -11% |
| SOC 2 Type II renewal | P0 | ✅ Done | DevOps, Legal | Renewed March 2026 |
| Advanced audit trail export (CSV/PDF) | P1 | ✅ Done | Platform, Frontend | Financial services unlock |

---

## Q2 2026 (April–June) — 🔄 IN PROGRESS

| Initiative | Priority | Status | Owner | Target Date |
|-----------|---------|--------|-------|------------|
| Enterprise SSO Phase 2 (Ping, generic SAML) | P0 | 🔄 68% | Sophia Larsen | Jun 30 |
| Real-time Analytics Dashboard v2 (foundation) | P1 | 🔄 8% | Michael Okafor | Jun 30 (kickoff) |
| Connector SDK v1 (private connectors) | P1 | 🔄 45% | Sophia Larsen | Jun 25 |
| Microservices migration (Flow API): Services 1–2 | P0 | 🔄 42% | Michael Okafor | Jun 30 |
| Mobile app MVP (iOS/Android) | P2 | ⏳ Planning | Michael Okafor | Jul 31 |
| Nexova AI: workflow suggestions beta | P2 | 🔄 20% | Michael Okafor | Jul 15 |

### Q2 Key Milestones
- **May 15:** Connector SDK v1 developer preview to 10 design partners
- **Jun 15:** Enterprise SSO Phase 2 GA
- **Jun 30:** Microservices milestone: Execution Service deployed independently

---

## Q3 2026 (July–September) — 📋 PLANNED

| Initiative | Priority | Description | Teams |
|-----------|---------|-------------|-------|
| Real-time Analytics Dashboard v2 | P0 | Sub-second queries, customizable widgets, 20 chart types | Data, Frontend, Design |
| AI Anomaly Detection (Insights) | P1 | ML-powered workflow performance anomaly detection | Data, Platform |
| Platform v3: Services 3–5 | P0 | Complete microservices migration for 5 of 6 services | Platform, DevOps |
| Native Salesforce deep integration | P1 | Bi-directional sync, Salesforce objects as workflow triggers | Platform, Connect |
| HIPAA compliance package | P1 | BAA, audit controls, PHI handling for healthcare customers | Platform, Legal |
| Mobile app v1.0 GA | P2 | Workflow monitoring, approvals, basic execution | Frontend (mobile) |

### Q3 Key Milestones
- **Jul 1:** Real-time Analytics Dashboard v2 development start
- **Aug 1:** HIPAA package available (unlocks 8 pipeline healthcare deals)
- **Sep 30:** Platform v3 at 80% complete (5 of 6 services migrated)

---

## Q4 2026 (October–December) — 🔭 HORIZON

| Initiative | Priority | Description |
|-----------|---------|-------------|
| Nexova AI: full workflow automation suggestions | P1 | GPT-4o powered workflow builder, natural language → automation |
| Analytics Dashboard v2 GA | P0 | Full release + customer migration |
| Platform v3 complete | P0 | Final service migrated, legacy monolith decommissioned |
| ISO 27001 certification | P1 | Target certification by Dec 31 |
| EU data residency (EU-West-1) | P1 | Dedicated EU region for GDPR-strict customers |
| Enterprise usage analytics | P2 | Per-user, per-workflow usage insights for customer admins |
| Pricing & packaging v3 | P1 | Usage-based element + new Enterprise tier |

---

## 2027 Preview (Not Committed)

| Theme | Ideas Under Consideration |
|-------|--------------------------|
| **Platform** | Multi-cloud support (GCP, Azure), on-premises/hybrid option |
| **AI** | Autonomous workflow optimization, predictive scaling |
| **Ecosystem** | Marketplace for certified partner connectors |
| **Vertical** | Industry-specific workflow templates (financial services, healthcare) |
| **Enterprise** | Dedicated tenant infrastructure for $1M+ ACV accounts |

---

## What We're NOT Building in 2026

To maintain focus, the following are explicitly out of scope for 2026:
- Consumer/SMB product tier (focus is enterprise)
- Native RPA (robotic process automation) screen scraping
- Building our own identity provider (Okta partnership instead)
- Self-hosted / on-premises version (H1 only; evaluating for H2 2027)

---

## Roadmap Inputs & Process

**Sources:**
- Win/loss analysis (Brandon Scott, Sales): 40% of lost deals cite SSO/compliance → driving Q1–Q2 P0s
- Customer advisory board (8 enterprise customers, quarterly calls)
- Zendesk ticket analysis: top 10 feature requests mapped to initiatives
- NPS survey analysis: Q4 2025 NPS = 42; detractors cite slow analytics and lack of customization

**Process:**
- Roadmap reviewed monthly by Jennifer Walsh + engineering leads
- Quarterly board presentation
- Customer-facing roadmap (approved items only) published at `nexova.io/roadmap`

---

## Team Capacity Summary (H1 2026)

| Team | Headcount | H1 Initiatives |
|------|-----------|----------------|
| Platform Engineering | 8 | SSO Ph2, Microservices, Flow API improvements |
| Frontend Engineering | 6 | SSO frontend, Analytics v2 UI, Connector SDK UI |
| DevOps & Infrastructure | 5 | K8s optimization, EU region prep, SOC 2 |
| Product Management | 4 | All initiatives (PM coverage) |
| Design & UX | 4 | Analytics v2, Mobile MVP, Connector SDK DX |
| Data & Analytics | 8 | Analytics v2 engine, AI features, ClickHouse ops |
