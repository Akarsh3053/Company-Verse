# Deployment Standard Operating Procedure (SOP)

**Document ID:** SOP-ENG-001  
**Version:** 3.2  
**Owner:** Robert Kim (Director of DevOps)  
**Last Reviewed:** 2026-05-12  
**Next Review:** 2026-11-12  
**Status:** Approved  

---

## 1. Purpose

This SOP defines the standard procedures for deploying code changes to Nexova production and staging environments. It ensures consistent, safe, and auditable deployments across all five production systems.

---

## 2. Scope

Applies to all production deployments for:
- Nexova Flow API
- Auth & Identity Service
- Nexova Connect Gateway
- Nexova Insights Engine
- Nexova Web Application

---

## 3. Pre-Deployment Checklist

Before initiating any production deployment, the deployer **must** verify all items:

| # | Check | Verifier |
|---|-------|----------|
| 1 | All CI pipeline stages passing (lint, unit, integration) | GitHub Actions |
| 2 | PR reviewed and approved by ≥2 engineers (≥1 senior) | GitHub |
| 3 | Feature flags configured if applicable | LaunchDarkly |
| 4 | Rollback plan documented in the Jira ticket | Lead Engineer |
| 5 | Database migrations are backward-compatible | DBA / Lead Engineer |
| 6 | Dependent service compatibility confirmed | Lead Engineer |
| 7 | Deployment window is within approved hours (see §5) | DevOps |
| 8 | On-call engineer notified and standing by | PagerDuty |
| 9 | Stakeholders notified of expected impact (if any) | PM |
| 10 | Staging deployment successful within last 24h | DevOps |

---

## 4. Deployment Pipeline

```
Developer Push → GitHub PR → CI Pipeline → Staging Deploy → Smoke Tests → Production Deploy → Post-Deploy Monitoring
```

### 4.1 CI Pipeline Stages
1. **Lint & Format:** Ruff (Python), ESLint + Prettier (TypeScript), golangci-lint (Go)
2. **Unit Tests:** pytest / Jest / Go test — minimum 80% coverage gate
3. **Integration Tests:** Docker Compose test environment
4. **Security Scan:** Snyk SCA + SAST scan, Trivy container scan
5. **Build:** Docker image build, tag with git SHA
6. **Push:** ECR image push
7. **Staging Deploy:** ArgoCD sync to `staging` namespace
8. **Smoke Tests:** Automated Playwright test suite against staging
9. **Manual Approval Gate:** Senior engineer or DevOps approval required

### 4.2 Production Deployment (ArgoCD)
```bash
# Trigger production sync via ArgoCD CLI
argocd app sync nexova-<service-name> \
  --revision <git-sha> \
  --prune \
  --timeout 300

# Verify rollout
kubectl rollout status deployment/<service-name> -n production
```

### 4.3 Deployment Strategy
| System | Strategy | Max Surge | Max Unavailable |
|--------|----------|-----------|-----------------|
| Flow API | Rolling Update | 25% | 0 |
| Auth Service | Blue/Green | N/A | 0 |
| Connect Gateway | Canary (10% → 50% → 100%) | N/A | 0 |
| Insights Engine | Rolling Update | 20% | 0 |
| Web App | Blue/Green (CloudFront) | N/A | 0 |

---

## 5. Deployment Windows

| Environment | Allowed Window         | Exceptions |
|-------------|------------------------|------------|
| Staging     | Anytime                | None       |
| Production  | Mon–Thu, 10:00–16:00 ET | P0 hotfixes only |
| Production  | Fri 10:00–13:00 ET     | With VP Eng approval |
| Production  | Weekends               | P0 incidents only |

**Change Freeze Periods:**
- End of quarter (last 3 business days)
- Major customer go-live windows (communicated by CS 2 weeks prior)
- US federal holidays

---

## 6. Monitoring Post-Deployment

Monitor the following for **30 minutes** after every production deployment:

- **Error Rate:** Datadog `service.error_rate` — alert if > 0.5%
- **P99 Latency:** Alert if > 500ms (API), > 2000ms (Insights)
- **CPU/Memory:** Alert if > 80% of requested limits
- **DB Connection Pool:** Alert if > 85% utilization
- **Queue Depth:** RabbitMQ/Kafka consumer lag — alert if > 1000 messages

Dashboard: `https://nexova.datadoghq.com/dashboard/prod-deployment-health`

---

## 7. Rollback Procedure

If any post-deployment metric breaches threshold:

### Automatic Rollback (Canary)
Canary deployments automatically roll back if error rate exceeds 1% during canary phase.

### Manual Rollback
```bash
# ArgoCD rollback to previous revision
argocd app rollback nexova-<service-name> <previous-revision>

# Verify
kubectl rollout status deployment/<service-name> -n production

# For DB migrations (if applicable) — run rollback migration
kubectl exec -it <migration-pod> -n production -- python manage.py migrate_rollback
```

**Rollback must be completed within 15 minutes of incident declaration.**

---

## 8. Post-Deployment Steps

1. Update Jira ticket to "Deployed to Production" with deployment timestamp
2. Close any deployment-related change requests in the change log
3. Notify stakeholders via #deployments Slack channel
4. If feature was customer-facing, notify Customer Success team

---

## 9. Hotfix Process

For P0/P1 production incidents requiring an emergency fix:

1. Create hotfix branch from `main`: `hotfix/<ticket-id>-<description>`
2. Minimum 1 senior engineer review (async acceptable)
3. Abbreviated CI: unit tests + integration tests (security scan deferred, must run within 24h)
4. VP Engineering or Director of DevOps must approve production deploy
5. Abbreviated monitoring window: 15 minutes
6. Full post-incident review within 48 hours

---

## 10. Contacts

| Role | Name | Contact |
|------|------|---------|
| DevOps On-Call | Rotation | PagerDuty escalation policy |
| Director of DevOps | Robert Kim | robert.kim@nexova.io |
| VP of Engineering | Sarah Chen | sarah.chen@nexova.io |
| Release Manager | Olivia Turner | olivia.turner@nexova.io |
