# Engineering On-Call Handbook

**Document ID:** ENG-OPS-017  
**Version:** 1.9  
**Owner:** Robert Kim (Director of DevOps)  
**Last Updated:** 2026-04-01  
**Status:** Active  

---

## 1. Purpose

This handbook is your guide to the Nexova engineering on-call rotation. It covers responsibilities, expectations, escalation paths, tooling, and survival tips for a smooth on-call experience.

---

## 2. On-Call Structure

### Rotation Schedule
- **Primary on-call:** 1-week rotation (Mon 09:00 ET → Mon 09:00 ET)
- **Secondary on-call:** 1-week rotation, offset by 3 days from primary
- **Schedule maintained in:** PagerDuty
- **Rotation pool (eligible engineers):** All engineers at E3 (Senior) level and above after 6 months at Nexova

Current rotation participants (19 engineers):
- Platform Engineering: Marcus Williams, Priya Patel, James O'Brien
- Frontend Engineering: David Park, Emma Schulz, Carlos Mendez
- DevOps: Robert Kim, Olivia Turner, Raj Sharma
- Data Engineering: Victor Huang, Ethan Brooks, Anastasia Volkov

*E1/E2 engineers shadow on-call for 1 cycle before being added to primary rotation*

### Compensation
- On-call stipend: $300/week while primary on-call
- Incident response during off-hours: 1 hour off per hour worked (flexible, taken within 2 weeks)
- Holiday on-call: 2× stipend

---

## 3. On-Call Responsibilities

### During Business Hours (09:00–18:00 ET)
- Acknowledge PagerDuty alerts within **5 minutes**
- Triage and classify all incidents (see OPS-SEC-002)
- Coordinate response with relevant team members
- Keep #incidents Slack channel updated

### During Off-Hours (18:00–09:00 ET + Weekends)
- Acknowledge PagerDuty alerts within **5 minutes** (P1/P2)
- P3/P4 alerts: acknowledge within 30 minutes; can defer resolution to business hours
- Always escalate to secondary if you need help
- Wake up the right people; don't suffer alone

### What You're Responsible For
- All five production services
- Deployment pipelines (if broken blocking a hotfix)
- External dependency outages (assess impact, not fix)
- Anything that fires a PagerDuty alert

### What You're NOT Responsible For
- Fixing every bug (triage and mitigate; schedule a proper fix)
- AWS infrastructure failures (escalate to Director of DevOps)
- Root cause analysis during the incident (stabilize first)

---

## 4. Alert Response Runbooks

### High Error Rate — Flow API
```bash
# 1. Check recent deployments
argocd app history nexova-flow-api

# 2. Check error logs
# Datadog: service:flow-api status:error @env:production

# 3. Check database connections
kubectl exec -it <flow-api-pod> -n production -- \
  python -c "from app.db import engine; print(engine.pool.status())"

# 4. Check Celery queue depth
kubectl exec -it <celery-worker-pod> -n production -- \
  celery -A app inspect active

# 5. If spike after deploy → rollback
argocd app rollback nexova-flow-api <prev-revision>
```

### High Latency — Auth Service
```bash
# 1. Check Redis latency
kubectl exec -it <auth-pod> -n production -- \
  redis-cli -h $REDIS_HOST LATENCY LATEST

# 2. Check DB query times (RDS Performance Insights)
# AWS Console → RDS → nexova-auth-prod → Performance Insights

# 3. Check pod resource usage
kubectl top pods -n production-auth

# 4. Common fix: Redis connection pool exhausted
kubectl rollout restart deployment/auth-service -n production-auth
```

### Kafka Consumer Lag — Insights Engine
```bash
# 1. Check lag
kubectl exec -it <kafka-pod> -n production -- \
  kafka-consumer-groups.sh --bootstrap-server $KAFKA_BOOTSTRAP \
  --describe --group insights-consumer

# 2. Check consumer pod health
kubectl get pods -n production | grep insights

# 3. Scale up consumers if lag > 50k
kubectl scale deployment nexova-insights-consumer \
  --replicas=6 -n production

# 4. If lag still growing → check ClickHouse write performance
# Datadog: service:insights-engine clickhouse.insert.latency
```

### Node Not Ready (Kubernetes)
```bash
# 1. Check node status
kubectl describe node <node-name>

# 2. Check what's on the node
kubectl get pods --all-namespaces --field-selector spec.nodeName=<node-name>

# 3. If Karpenter provisioning issue
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter --tail=50

# 4. Cordon and drain if needed
kubectl cordon <node-name>
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# 5. Karpenter will provision a replacement node automatically
```

---

## 5. Escalation Guide

| Situation | Escalate To | How |
|-----------|------------|-----|
| Can't diagnose within 20 min | Secondary on-call | PagerDuty escalation |
| SEV-1 (platform down) | Director of DevOps | PagerDuty + Slack DM |
| SEV-1 unresolved > 30 min | VP Engineering | PagerDuty + phone |
| AWS infrastructure failure | Director of DevOps | Phone (it's that serious) |
| Suspected data breach | VP Engineering + CEO | Phone immediately |
| You're sick/unavailable | PagerDuty: reassign shift | PagerDuty → Schedules |

---

## 6. Tools & Access Checklist

Before your first on-call week, verify:
- [ ] PagerDuty mobile app installed and notifications enabled
- [ ] Datadog access and able to view production dashboards
- [ ] kubectl configured for production cluster (`kubectl config get-contexts`)
- [ ] ArgoCD access for production (`argocd login`)
- [ ] VPN configured and tested
- [ ] AWS Console access
- [ ] Joined #on-call and #incidents Slack channels
- [ ] Status page access: `manage.statuspage.io`

---

## 7. Key Links

| Resource | URL |
|----------|-----|
| PagerDuty | `nexova.pagerduty.com` |
| Datadog Prod Dashboard | `nexova.datadoghq.com/dashboard/production-overview` |
| ArgoCD | `argocd.nexova.internal` |
| Status Page | `manage.statuspage.io` |
| Runbooks | `nexova.notion.so/runbooks` |
| AWS Console | `console.aws.amazon.com` |
| Incident Response Playbook | OPS-SEC-002 |

---

## 8. After Your On-Call Week

- Log any toil/repetitive tasks in #engineering-toil Slack channel
- Submit on-call retrospective form (Notion: Engineering → On-Call Retros)
- Expense any meals bought during overnight incidents (up to $30, tag "on-call")
- Book recovery time off if you had significant overnight pages
