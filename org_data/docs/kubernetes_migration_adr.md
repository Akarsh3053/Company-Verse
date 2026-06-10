# ADR-012: Migration to Kubernetes (EKS) for All Production Workloads

**Document ID:** ADR-INFRA-012  
**Status:** Accepted  
**Date:** 2024-11-07  
**Deciders:** Sarah Chen, Robert Kim, Marcus Williams, Raj Sharma  
**Consulted:** Olivia Turner, David Park, Victor Huang  
**Informed:** All Engineering  

---

## Context and Problem Statement

Nexova's production infrastructure has historically run on EC2 instances managed with Ansible and manually scaled Auto Scaling Groups. As the platform has grown to 340 customers and 28,400 MAU, we are experiencing:

1. **Slow deployments:** EC2-based deploys take 12–25 minutes, limiting our ability to deploy multiple times per day
2. **Resource inefficiency:** Average EC2 utilization is 23%, causing significant over-provisioning costs
3. **Inconsistent environments:** "Works on my machine" bugs traced to environment differences between dev, staging, and production
4. **Limited scalability:** Horizontal scaling requires manual intervention or complex ASG configuration
5. **Operational overhead:** Each service requires hand-maintained AMIs, launch templates, and systemd configurations
6. **Onboarding friction:** New engineers spend 2–3 days configuring local environments

We evaluated alternatives to address these issues.

---

## Decision Drivers

- Deployment frequency target: ≥5 deploys/day per service
- Engineer onboarding: ≤1 day to productive local environment
- Infrastructure cost: Reduce compute spend by ≥20%
- Operational toil: Reduce on-call paging related to infra by ≥40%
- Consistency: Identical behavior across dev/staging/production
- Vendor flexibility: Avoid deep lock-in to a single cloud provider

---

## Considered Options

| Option | Summary |
|--------|---------|
| **A: AWS EKS (Kubernetes)** | Managed Kubernetes on AWS, Helm charts, ArgoCD GitOps |
| **B: AWS ECS (Fargate)** | Managed containers, AWS-native, simpler but less portable |
| **C: Nomad + Consul** | HashiCorp orchestration, lighter weight, less mature ecosystem |
| **D: Maintain EC2 + improve Ansible** | Incremental improvements to existing setup |

---

## Decision Outcome

**Chosen: Option A — AWS EKS with ArgoCD GitOps**

### Justification

EKS was selected because:

1. **Industry standard:** Kubernetes is the de-facto container orchestration standard. Hiring, documentation, and tooling ecosystem are unmatched
2. **GitOps with ArgoCD:** Enables declarative, auditable infrastructure — every change is a Git commit. Directly addresses audit requirements (SOC 2, ISO 27001)
3. **Cost optimization:** Karpenter node autoprovisioning + Spot instance support reduces estimated EC2 cost by 30–35%
4. **Multi-cloud readiness:** EKS configuration is portable to GKE or AKS with minimal changes
5. **Team capability:** Robert Kim and Raj Sharma have 4+ years of Kubernetes experience. Remaining DevOps engineers completed CKA training in Q3 2024

### Why Not ECS?
ECS is simpler but creates deep AWS coupling. Kubernetes experience is more transferable, and the team already had the skills. ECS Fargate also lacks the scheduling flexibility (Spot, GPU workloads for future ML) we need.

### Why Not Nomad?
HashiCorp's BSL license change in 2023 and smaller ecosystem were disqualifying. Nomad is excellent but Nexova's future ML/GPU workload requirements align better with Kubernetes.

---

## Implementation Plan

### Phase 1: Foundation (Q4 2024) ✅ COMPLETE
- [x] EKS cluster provisioned with Terraform (3 AZs, managed node groups)
- [x] Karpenter installed for intelligent node autoscaling
- [x] Networking: AWS VPC CNI, Calico network policies
- [x] ArgoCD installed, connected to `nexova-infra` GitHub repo
- [x] Cert-manager (Let's Encrypt + internal CA)
- [x] External Secrets Operator (AWS Secrets Manager sync)
- [x] Datadog agent DaemonSet deployed

### Phase 2: Service Migration (Q1 2025) ✅ COMPLETE
- [x] Nexova Web App migrated (zero-downtime, blue/green)
- [x] Auth & Identity Service migrated
- [x] Nexova Connect Gateway migrated
- [x] Flow API migrated (rolling update)
- [x] Insights Engine migrated

### Phase 3: Optimization (Q2–Q3 2025) ✅ COMPLETE
- [x] Horizontal Pod Autoscaler (HPA) configured for all services
- [x] Vertical Pod Autoscaler (VPA) in recommendation mode
- [x] Pod Disruption Budgets configured
- [x] Spot instance optimization (60% Spot / 40% On-Demand)
- [x] Resource requests/limits right-sized based on 90 days of data

### Phase 4: Advanced (Q4 2025 – Ongoing)
- [ ] Service mesh evaluation (Istio vs. Linkerd) — target Q3 2026
- [ ] Multi-cluster setup for EU data residency (PROJ-004, not yet started)
- [ ] GPU node pool for ML workloads (Data team, Q4 2026)

---

## Positive Consequences

- ✅ Deployment time reduced from avg 18 min to avg 2.5 min
- ✅ Deploy frequency increased to 8.3 deploys/day (across all services)
- ✅ EC2 compute cost reduced by 31% (Spot + right-sizing)
- ✅ On-call infra incidents reduced by 47% (Q2 2025 vs Q2 2024)
- ✅ Engineer onboarding: `docker-compose up` gives full local stack in ~8 min
- ✅ Zero unplanned downtime during migration period

## Negative Consequences / Risks

- ⚠️ Kubernetes complexity: steeper learning curve for engineers new to containers. Mitigated by internal workshops and runbooks
- ⚠️ EKS upgrade cycle: must upgrade clusters within 12 months of each release. Automated with Terraform + tested in staging first
- ⚠️ Spot interruptions: Karpenter handles gracefully but requires stateless service design. Flow API session affinity was refactored (removed sticky sessions)

---

## Links

- Infrastructure repository: `github.com/nexova/nexova-infra`
- Kubernetes runbooks: `nexova.notion.so/runbooks/kubernetes`
- Cost analysis spreadsheet: `docs.google.com/spreadsheets/...` (internal)
- Related ADR: ADR-011 (Adopt ArgoCD for GitOps), ADR-013 (Karpenter over Cluster Autoscaler)
