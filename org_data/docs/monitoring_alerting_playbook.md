# Monitoring & Alerting Playbook

**Document ID:** OPS-OBS-019  
**Version:** 2.0  
**Owner:** Raj Sharma (Senior DevOps Engineer)  
**Reviewed By:** Robert Kim, Olivia Turner, Marcus Williams  
**Last Updated:** 2026-04-10  
**Status:** Approved — Active  

---

## 1. Overview

This playbook defines Nexova's monitoring strategy, alerting philosophy, key dashboards, and runbooks for common alerts. Our observability stack is built on Datadog (metrics, logs, traces, synthetics) and PagerDuty (incident management).

---

## 2. Observability Stack

| Tool | Purpose | Data Retention |
|------|---------|---------------|
| Datadog APM | Distributed tracing, service maps | 15 days |
| Datadog Metrics | Infrastructure & application metrics | 15 months |
| Datadog Logs | Centralized log aggregation | 90 days (searchable), 1 year (archive) |
| Datadog Synthetics | External uptime checks (5 regions) | 1 year |
| Datadog RUM | Real user monitoring (Web App) | 30 days |
| PagerDuty | Alert routing, on-call management | 1 year |
| Sentry | Error tracking (frontend + backend) | 90 days |
| OpenTelemetry | Instrumentation standard | — (agent) |

---

## 3. Alerting Philosophy

### Alert Design Principles
1. **Every alert must be actionable.** If you can't do something about it, it's a metric, not an alert.
2. **Alert on symptoms, not causes.** Alert on user impact (error rate, latency) not internal metrics (CPU).
3. **Tune aggressively.** Noisy alerts cause alert fatigue. Review and suppress/tune any alert that fires >3×/week without action.
4. **Separate urgency from severity.** Not every high-severity issue is urgent at 3am.

### Alert Severity Matrix

| Severity | PagerDuty Config | When to Use |
|----------|-----------------|-------------|
| **Critical** | Immediate phone call, all hours | Customer-impacting, needs action now |
| **Warning** | Business hours only, no call | Trending toward threshold, investigate soon |
| **Info** | Slack only, no page | FYI, no action needed |

---

## 4. Key Production Alerts

### 4.1 Flow API Alerts

| Alert Name | Condition | Severity | Runbook |
|------------|-----------|---------|---------|
| High Error Rate | 5xx rate > 0.5% for 5 min | Critical | §6.1 |
| Elevated Latency | P99 > 800ms for 10 min | Warning | §6.2 |
| Critical Latency | P99 > 2000ms for 5 min | Critical | §6.2 |
| DB Pool Exhausted | Connection pool > 90% for 5 min | Critical | §6.3 |
| Celery Queue Depth | Queue > 5,000 for 10 min | Warning | §6.4 |
| Pod Crash Loop | CrashLoopBackOff detected | Critical | §6.5 |
| Low Replica Count | Available replicas < 2 | Critical | §6.5 |

### 4.2 Auth Service Alerts

| Alert Name | Condition | Severity | Runbook |
|------------|-----------|---------|---------|
| Auth Failures Spike | Auth failure rate > 10% for 5 min | Critical | §6.6 |
| Login Latency High | Login P99 > 1000ms for 10 min | Warning | §6.7 |
| Redis Session Store Down | Redis connection errors > 10/min | Critical | §6.8 |
| JWT Signing Failure | Any JWT signing errors | Critical | §6.9 |
| Brute Force Detected | IP with > 100 login failures/min | Warning | §6.10 |

### 4.3 Insights Engine Alerts

| Alert Name | Condition | Severity | Runbook |
|------------|-----------|---------|---------|
| Kafka Lag Critical | Consumer lag > 100,000 | Critical | §6.11 |
| Kafka Lag Warning | Consumer lag > 10,000 for 15 min | Warning | §6.11 |
| ClickHouse Write Errors | Write error rate > 1% | Critical | §6.12 |
| Data Freshness Breach | Data lag > 5 min | Warning | §6.13 |

### 4.4 Infrastructure Alerts

| Alert Name | Condition | Severity | Runbook |
|------------|-----------|---------|---------|
| Node Not Ready | Kubernetes node NotReady > 2 min | Critical | §6.14 |
| High Node CPU | Node CPU > 90% for 10 min | Warning | §6.14 |
| PVC Nearly Full | PVC usage > 85% | Warning | §6.15 |
| RDS CPU High | RDS CPU > 80% for 5 min | Warning | §6.16 |
| RDS Connections High | DB connections > 85% of max | Critical | §6.16 |
| Certificate Expiry | TLS cert expires in < 14 days | Warning | §6.17 |

### 4.5 Synthetic Uptime Checks

| Check | Frequency | Locations | Alert Threshold |
|-------|-----------|-----------|----------------|
| Flow API health endpoint | 60s | 5 global regions | 3 consecutive failures |
| Auth login flow | 5 min | 3 regions | 2 consecutive failures |
| Web App load | 5 min | 5 regions | 2 consecutive failures |
| Connect Gateway | 60s | 3 regions | 3 consecutive failures |

---

## 5. Key Dashboards

| Dashboard | URL Shortname | Primary Users |
|-----------|--------------|--------------|
| Production Overview | `prod-overview` | All engineers, on-call |
| Flow API Service | `flow-api` | Platform Engineering |
| Auth Service | `auth-service` | Platform Engineering |
| Insights Engine | `insights` | Data & Analytics |
| Connect Gateway | `connect-gw` | Platform Engineering |
| Kubernetes Cluster | `k8s-cluster` | DevOps |
| RDS Performance | `rds-perf` | DevOps, senior engineers |
| Deployment Health | `deploy-health` | DevOps, on-call |
| Business Metrics | `business-kpis` | Leadership, CS, PM |

Access all dashboards: `https://nexova.datadoghq.com/dashboard/<shortname>`

---

## 6. Alert Runbooks

### 6.1 High Error Rate — Flow API
1. Check for recent deployment: `argocd app history nexova-flow-api`
2. Inspect error logs: `service:flow-api status:error` in Datadog Logs
3. Check if errors are isolated to specific workflow type or endpoint
4. If after deploy → initiate rollback (SOP-ENG-001 §7)
5. If not deploy-related → check DB and downstream dependencies

### 6.2 High Latency — Flow API
1. Check APM trace waterfall for the slow span
2. Most common causes: slow DB query, Redis latency, external connector timeout
3. Check DB slow query log (RDS Performance Insights)
4. Check Redis latency: `LATENCY LATEST` command
5. If connector-related: check Connect Gateway latency

### 6.3 DB Connection Pool Exhaustion
1. `kubectl top pods -n production | grep flow-api`
2. Count current connections: `SELECT count(*) FROM pg_stat_activity`
3. Kill idle connections > 10 min: `SELECT pg_terminate_backend(pid) WHERE state = 'idle' AND query_start < NOW() - INTERVAL '10 minutes'`
4. If persistent: scale up replicas or reduce connection pool size per pod

### 6.11 Kafka Consumer Lag
1. `kafka-consumer-groups.sh --describe --group insights-consumer`
2. Check consumer pod logs: `kubectl logs -l app=insights-consumer -n production`
3. If lag growing: scale consumers `kubectl scale deployment insights-consumer --replicas=8`
4. If lag stable (not growing): likely a temporary burst, monitor

---

## 7. Alert Tuning Process

Monthly alert review (run by Raj Sharma):
1. Export alert history from PagerDuty (last 30 days)
2. Identify alerts that fired >10× without action → candidates for tuning or suppression
3. Identify alerts that never fired → verify they are correctly configured
4. Present findings in weekly DevOps sync
5. Update alert thresholds in Terraform (`nexova-infra/datadog/monitors/`)

**Alert noise target:** <5 non-actionable pages per week across all services.

---

## 8. SLO (Service Level Objectives) Monitoring

Datadog SLO tracking configured for all customer SLA commitments:

| SLO | Target | Current (30d) |
|-----|--------|--------------|
| Flow API availability | 99.9% | 99.94% ✅ |
| Auth Service availability | 99.95% | 99.97% ✅ |
| Web App availability | 99.9% | 99.94% ✅ |
| Connect Gateway availability | 99.7% | 99.78% ✅ |
| Insights availability | 99.5% | 99.61% ✅ |

Error budget burn rate alerts configured: page if error budget burns >5× expected rate.
