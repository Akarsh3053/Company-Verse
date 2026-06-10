# Q1 2026 Performance Benchmarking Report

**Document ID:** DATA-RPT-013  
**Version:** 1.0  
**Author:** Ethan Brooks (Senior Data Engineer), Anastasia Volkov (Senior Data Scientist)  
**Reviewed By:** Victor Huang (Director of Data & Analytics), Marcus Williams (Principal Engineer)  
**Date:** 2026-04-08  
**Status:** Final — Shared with Engineering Leadership  

---

## Executive Summary

This report presents performance benchmark results for all five Nexova production systems measured during Q1 2026 (January 1 – March 31). Overall platform performance improved vs. Q4 2025 across key metrics, driven by the completion of the ClickHouse migration for the Insights Engine and Kubernetes right-sizing work in February.

**Key highlights:**
- Flow API P99 latency improved by 22% QoQ (492ms → 384ms)
- Insights Engine query P50 improved by 64% following ClickHouse migration
- Auth Service maintained 99.97% uptime (above 99.95% SLA)
- Connect Gateway throughput increased 18% with no latency regression
- Web App Core Web Vitals: LCP improved from 2.4s to 1.8s

---

## 1. System Benchmarks

### 1.1 Nexova Flow API

| Metric | Q4 2025 | Q1 2026 | Change | Target |
|--------|---------|---------|--------|--------|
| P50 Latency (API) | 87ms | 72ms | -17% | <100ms ✅ |
| P95 Latency (API) | 215ms | 188ms | -13% | <300ms ✅ |
| P99 Latency (API) | 492ms | 384ms | -22% | <500ms ✅ |
| Error Rate (5xx) | 0.08% | 0.06% | -25% | <0.1% ✅ |
| Throughput (req/s, peak) | 1,840 | 2,210 | +20% | — |
| Uptime | 99.92% | 99.94% | +0.02pp | 99.9% ✅ |
| Avg Pod CPU | 38% | 31% | -18% | <70% ✅ |
| Avg Pod Memory | 62% | 58% | -6% | <80% ✅ |

**Notable:** P99 improvement driven by optimization of workflow execution database queries (added composite index on `executions(org_id, status, created_at)`). Ticket: FLOW-1823.

### 1.2 Auth & Identity Service

| Metric | Q4 2025 | Q1 2026 | Change | Target |
|--------|---------|---------|--------|--------|
| Login P50 Latency | 43ms | 41ms | -5% | <100ms ✅ |
| Login P99 Latency | 198ms | 182ms | -8% | <500ms ✅ |
| Token Validation P50 | 8ms | 7ms | -13% | <20ms ✅ |
| Error Rate | 0.02% | 0.01% | -50% | <0.05% ✅ |
| Uptime | 99.97% | 99.97% | 0% | 99.95% ✅ |
| Failed Login Rate | 2.3% | 2.1% | -9% | — |
| MFA Adoption Rate | 34% | 41% | +7pp | — |

### 1.3 Nexova Insights Engine

| Metric | Q4 2025 | Q1 2026 | Change | Target |
|--------|---------|---------|--------|--------|
| Dashboard Load P50 | 3,200ms | 890ms | -72% | <1,000ms ✅ |
| Dashboard Load P95 | 8,400ms | 2,100ms | -75% | <3,000ms ✅ |
| Query P50 (ad-hoc) | 4,100ms | 1,470ms | -64% | <2,000ms ✅ |
| Data Freshness (lag) | 45s | 28s | -38% | <60s ✅ |
| Kafka Consumer Lag (avg) | 12,400 | 3,200 | -74% | <5,000 ✅ |
| Uptime | 99.48% | 99.61% | +0.13pp | 99.5% ✅ |

**Notable:** Dramatic improvements entirely attributable to ClickHouse migration completed 2026-01-28 (PROJ-005). PostgreSQL for analytics was causing full-table scans on multi-billion-row datasets. ClickHouse columnar storage reduced analytical query times by 70–80%.

### 1.4 Nexova Connect Gateway

| Metric | Q4 2025 | Q1 2026 | Change | Target |
|--------|---------|---------|--------|--------|
| P50 Latency (gateway) | 52ms | 49ms | -6% | <100ms ✅ |
| P99 Latency (gateway) | 320ms | 298ms | -7% | <500ms ✅ |
| Throughput (req/s, peak) | 3,100 | 3,660 | +18% | — |
| Connector Error Rate | 1.2% | 0.9% | -25% | <2% ✅ |
| Webhook Delivery Rate | 98.3% | 98.8% | +0.5pp | >98% ✅ |
| Uptime | 99.71% | 99.78% | +0.07pp | 99.7% ✅ |

### 1.5 Nexova Web Application

| Metric | Q4 2025 | Q1 2026 | Change | Target |
|--------|---------|---------|--------|--------|
| LCP (Largest Contentful Paint) | 2.4s | 1.8s | -25% | <2.5s ✅ |
| FID (First Input Delay) | 68ms | 42ms | -38% | <100ms ✅ |
| CLS (Cumulative Layout Shift) | 0.08 | 0.04 | -50% | <0.1 ✅ |
| JS Bundle Size (main) | 842KB | 714KB | -15% | <800KB ✅ |
| Time to Interactive (P50) | 3.1s | 2.4s | -23% | <3.0s ✅ |
| 404 Error Rate | 0.4% | 0.2% | -50% | <0.5% ✅ |

**Notable:** LCP improvement from lazy loading redesign (FRONT-443) and edge caching of static assets via CloudFront + S3.

---

## 2. Infrastructure Efficiency

| Metric | Q4 2025 | Q1 2026 | Change |
|--------|---------|---------|--------|
| EC2 Spot utilization | 54% | 62% | +8pp |
| Total compute cost (AWS) | $41,200/mo | $36,800/mo | -11% |
| Average node CPU utilization | 41% | 52% | +11pp |
| Pod restarts (production) | 47 | 23 | -51% |
| HPA scale-up events | 183 | 201 | +10% |
| Karpenter node provisioning avg | 2m 14s | 1m 48s | -20% |

---

## 3. Reliability Summary

| System | Q1 Uptime | SLA Target | Status |
|--------|-----------|-----------|--------|
| Auth Service | 99.97% | 99.95% | ✅ Met |
| Flow API | 99.94% | 99.9% | ✅ Met |
| Web App | 99.94% | 99.9% | ✅ Met |
| Connect Gateway | 99.78% | 99.7% | ✅ Met |
| Insights Engine | 99.61% | 99.5% | ✅ Met |

**Incidents in Q1:** 4 total (1 SEV-2, 3 SEV-3). No SEV-1. Average resolution time: 52 minutes.

---

## 4. Recommendations for Q2 2026

| Priority | Recommendation | Owner | Expected Impact |
|----------|---------------|-------|----------------|
| P1 | Investigate Flow API P99 spikes on Mondays 09–10 ET (likely cache warm-up) | Marcus Williams | P99 → <250ms |
| P1 | Increase Connect Gateway webhook retry timeout (currently 30s, causing false failures on slow customer endpoints) | Raj Sharma | Delivery rate → >99.5% |
| P2 | Implement query result caching layer for Insights (Redis) for common dashboard queries | Benjamin Chase | Dashboard P50 → <500ms |
| P2 | Reduce Web App JS bundle via dynamic imports for workflow builder (est. -120KB) | Carlos Mendez | LCP → <1.5s |
| P3 | Profile Auth Service bcrypt cost factor (12) — consider argon2id migration | Priya Patel | Login P99 → <120ms |
