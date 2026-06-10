# Disaster Recovery Plan

**Document ID:** OPS-INFRA-010  
**Version:** 2.2  
**Owner:** Robert Kim (Director of DevOps)  
**Reviewed By:** Sarah Chen, Marcus Williams, Raj Sharma  
**Last Tested:** 2026-04-15 (annual DR drill)  
**Next Test:** 2027-04-01  
**Status:** Approved  

---

## 1. Purpose

This Disaster Recovery (DR) Plan defines Nexova's procedures for recovering production systems following a major disruption — including cloud provider outages, data center failures, data corruption, and ransomware attacks.

---

## 2. Recovery Objectives

| System | RTO | RPO | Tier |
|--------|-----|-----|------|
| Auth & Identity Service | 30 min | 5 min | Tier 1 |
| Nexova Flow API | 1 hour | 15 min | Tier 1 |
| Nexova Web Application | 1 hour | 30 min | Tier 1 |
| Nexova Connect Gateway | 2 hours | 15 min | Tier 2 |
| Nexova Insights Engine | 4 hours | 1 hour | Tier 2 |

**Definitions:**
- **RTO (Recovery Time Objective):** Maximum acceptable time to restore service after disaster declared
- **RPO (Recovery Point Objective):** Maximum acceptable data loss (measured in time)

---

## 3. Disaster Scenarios

| Scenario | Probability | Severity | Primary Response |
|----------|------------|---------|-----------------|
| AWS us-east-1 partial AZ failure | High | Medium | Automatic (multi-AZ failover) |
| AWS us-east-1 full regional failure | Low | Critical | Manual failover to us-west-2 |
| Database corruption (accidental) | Low | High | Point-in-time restore from RDS |
| Ransomware / malicious deletion | Very Low | Critical | Clean restore from immutable backups |
| Kubernetes control plane failure | Low | High | EKS recovery via Terraform |
| GitHub outage | Medium | Low | Mirror in AWS CodeCommit |
| CDN failure (CloudFront) | Low | Medium | Failover to direct ALB access |

---

## 4. Infrastructure Resilience (Current State)

### 4.1 Multi-AZ Architecture
All production workloads run across 3 Availability Zones in `us-east-1`:
- Kubernetes worker nodes: distributed across 3 AZs via Karpenter topology constraints
- PostgreSQL RDS: Multi-AZ synchronous replication (automated failover in ~60s)
- Redis ElastiCache: Multi-AZ with automatic failover
- Application Load Balancer: Multi-AZ by default

### 4.2 Backup Strategy

| Data Store | Backup Type | Frequency | Retention | Location |
|-----------|-------------|-----------|-----------|----------|
| PostgreSQL (all DBs) | Automated snapshots | Continuous (PITR) | 35 days | AWS RDS (same region) |
| PostgreSQL (all DBs) | Cross-region copy | Daily | 30 days | S3 us-west-2 |
| ClickHouse (Insights) | S3 backups via clickhouse-backup | Every 6 hours | 30 days | S3 us-west-2 |
| Redis (sessions) | Persistence disabled (recoverable) | N/A | N/A | N/A |
| S3 (customer files) | Cross-region replication | Real-time | Indefinite | S3 us-west-2 |
| Kubernetes configs | Git (ArgoCD) | Every commit | Permanent | GitHub + CodeCommit |
| Secrets | AWS Secrets Manager | Continuous | Versioned | us-east-1 + us-west-2 |

### 4.3 DR Region: us-west-2 (Oregon)
A "warm standby" environment is maintained in us-west-2:
- EKS cluster: provisioned but idle (scale-to-zero worker nodes)
- RDS read replica: continuously synced from us-east-1 primary
- S3 data: real-time cross-region replication
- DNS: Route 53 health checks + weighted failover configured
- **Estimated activation time:** 45–90 minutes (manual process)

---

## 5. Failover Runbook — Regional Failure

### Prerequisites
- Incident declared as SEV-1 by IC
- VP Engineering (Sarah Chen) authorizes DR activation
- DevOps on-call + Director of DevOps present

### Step 1: Assess (0–15 min)
```bash
# Check us-east-1 health
aws ec2 describe-availability-zones --region us-east-1
curl -s https://health.aws.amazon.com/health/status | jq '..'

# Check what's actually broken
kubectl get nodes -n production
kubectl get pods -n production | grep -v Running
```

### Step 2: Notify (Concurrent with Step 1)
- Declare DR activation in #incidents
- Post to status.nexova.io: "We are activating failover procedures"
- Notify CS team to hold all customer communications until service restored
- Notify CEO and all VPs

### Step 3: Activate us-west-2 (15–60 min)
```bash
# 1. Promote RDS read replica to primary in us-west-2
aws rds promote-read-replica \
  --db-instance-identifier nexova-prod-replica-west \
  --region us-west-2

# 2. Scale up EKS worker nodes in us-west-2
# (Karpenter NodePool already configured, just update desired replicas)
kubectl config use-context nexova-dr-us-west-2
kubectl scale deployment --all --replicas=2 -n production

# 3. Update External Secrets to point to us-west-2 Secrets Manager
# (already synced, no action needed)

# 4. Update ArgoCD to sync from us-west-2 cluster
argocd cluster set nexova-dr-us-west-2 --name dr-active
argocd app sync --all

# 5. Verify all pods running
kubectl get pods -n production --watch
```

### Step 4: Update DNS (60 min mark)
```bash
# Route 53 — switch weighted records
aws route53 change-resource-record-sets \
  --hosted-zone-id Z... \
  --change-batch file://dr-failover-dns.json
```

DNS propagation: ~5 minutes (TTL set to 60s for all production records)

### Step 5: Verify & Monitor
- Run smoke tests against us-west-2 endpoints
- Monitor Datadog for 30 minutes
- Confirm customer traffic routing correctly

### Step 6: Communicate Resolution
- Update status page with restored status
- Email all customers via CS team
- IC declares incident resolved

---

## 6. Data Restore Runbook — Corruption / Accidental Deletion

```bash
# PostgreSQL point-in-time restore
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier nexova-prod-primary \
  --target-db-instance-identifier nexova-prod-restored \
  --restore-time "2026-06-08T10:00:00Z" \
  --region us-east-1

# Verify restore
psql -h nexova-prod-restored.xxxxx.rds.amazonaws.com -U nexova -d nexova_prod
SELECT COUNT(*) FROM workflows; -- validate data

# Promote restored instance (after validation)
# Route application config to new instance via Secrets Manager update
```

---

## 7. Annual DR Drill Requirements

The DR plan must be tested annually:
- Full failover drill to us-west-2 (scheduled maintenance window)
- RTO/RPO targets verified against actual recovery times
- All findings logged and addressed within 30 days
- DR plan updated to reflect any changes in architecture

Last drill: 2026-04-15. Actual RTO achieved: 67 minutes (target: 60 min). Action item: optimize RDS promotion step (ticket: INFRA-441).

---

## 8. Contacts

| Role | Name | Contact |
|------|------|---------|
| DR Owner | Robert Kim | robert.kim@nexova.io / PagerDuty |
| Backup Owner | Raj Sharma | raj.sharma@nexova.io / PagerDuty |
| VP Engineering | Sarah Chen | sarah.chen@nexova.io |
| AWS Support | — | AWS Support Console (P1 case) |
