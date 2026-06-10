# New Employee Onboarding Runbook

**Document ID:** HR-ENG-008  
**Version:** 2.5  
**Owner:** Sarah Chen (VP Engineering) + Diana Osei (Director of Customer Success)  
**People Ops Lead:** Jennifer Walsh (interim)  
**Last Updated:** 2026-03-01  
**Status:** Active  

---

## Overview

This runbook covers the onboarding process for all new Nexova employees, with expanded detail for engineering hires. The goal is a productive, welcoming first week with clear milestones.

---

## Pre-Start (IT & Manager Checklist — 5 Business Days Before Start Date)

### IT / DevOps (Fatima Al-Rashid or Wei Zhang)
- [ ] Create Google Workspace account (`firstname.lastname@nexova.io`)
- [ ] Provision Okta account and assign base app set
- [ ] Order and ship MacBook Pro (M3 Pro, 36GB RAM for engineers; M2 Air for others)
- [ ] Create GitHub account in `nexova` org, assign to relevant team
- [ ] Create Jira account and assign to team project(s)
- [ ] Create Notion account and grant department workspace access
- [ ] Create Slack account and add to default channels: #general, #announcements, #random, #team-<team>
- [ ] Create Datadog account (engineers/DevOps only)
- [ ] Create 1Password account and add to company vault
- [ ] Create Zoom account
- [ ] Ship swag package: Nexova hoodie, notebook, stickers

### Manager
- [ ] Add to team calendar and recurring ceremonies (standup, planning, retro)
- [ ] Assign onboarding buddy (peer engineer, same or adjacent team)
- [ ] Schedule 1:1s for weeks 1–4
- [ ] Prepare 30/60/90 day goals document
- [ ] Send welcome message in #team-<team> Slack channel
- [ ] Book intro coffee chats with: direct team, cross-functional partners, relevant leads

---

## Day 1 — Welcome & Setup

### Morning (10:00 AM — manager-led)
1. Office/video welcome — meet the team
2. IT setup: login to Google, Okta SSO, Slack
3. Review company handbook (Notion: People Ops > Handbook)
4. Benefits enrollment (due within 30 days)
5. Lunch with the team (expensable up to $30 pp)

### Afternoon
1. **Security training** (required, must complete by end of Day 3):
   - Nexova Security Awareness module in Workramp (45 min)
   - Review Security Review Policy (POL-SEC-005)
   - Sign: Acceptable Use Policy, NDA (if not signed during offer)
2. Dev environment setup (engineers): follow `README.md` in `nexova/engineering-setup` repo
3. Tour the Notion workspace: team pages, runbooks, ADRs, RFCs

---

## Day 2–3 — Context & Codebase

### For Engineers

**Environment verification:**
```bash
# Clone the team's primary repo(s)
git clone git@github.com:nexova/<service>.git

# Start full local stack (Docker Compose)
cd <service>
cp .env.example .env.local
docker compose up -d

# Verify all services healthy
docker compose ps
# Expected: all services "Up"

# Run tests
make test
```

**Codebase tour (scheduled with onboarding buddy):**
1. Architecture overview: system diagram walkthrough
2. Repo structure: service code, tests, infra, CI config
3. Local dev workflow: `make dev`, hot reload, debugging setup
4. First issue: manager assigns a "starter" Jira ticket (labeled `good-first-issue`)

### For All Employees
- Product demo with PM (Jennifer Walsh or Michael Okafor): 60 min
- Customer call shadow with CS (Thomas Nguyen or Diana Osei): 60 min
- Review OKRs for current quarter (Notion: Strategy)

---

## Week 1 Goals

| Goal | Who | Verify |
|------|-----|--------|
| All systems access working | IT + New Hire | Access checklist signed |
| Security training complete | New Hire | Workramp completion |
| 30/60/90 day plan reviewed and agreed | Manager + New Hire | Notion doc |
| Attended all team ceremonies | New Hire | Calendar |
| First Jira ticket in progress (engineers) | New Hire | Jira |
| Intro coffee chats scheduled | New Hire | Calendar |

---

## 30/60/90 Day Milestones

### Engineers

| Timeframe | Goal |
|-----------|------|
| **30 days** | Shipped ≥1 code change to staging; understands team's systems and deployment process |
| **60 days** | Independently picking up and completing tickets; has completed first production deploy; given first substantive PR review |
| **90 days** | Fully contributing team member; has participated in on-call rotation (if senior); has proposed at least one improvement |

### Customer Success

| Timeframe | Goal |
|-----------|------|
| **30 days** | Shadowed ≥5 customer calls; familiar with all Nexova products |
| **60 days** | Independently handling ≥5 customer accounts; completed Nexova Flow certification |
| **90 days** | Managing full book of business; leading own customer calls |

---

## Required Training (All Employees — Due Within 30 Days)

| Training | Platform | Duration | Required By |
|----------|----------|----------|-------------|
| Security Awareness | Workramp | 45 min | Day 3 |
| Privacy & GDPR Basics | Workramp | 30 min | Week 1 |
| Nexova Product Certification L1 | Internal LMS | 2 hours | Week 2 |
| Harassment Prevention | Workramp | 1 hour | Week 3 |
| SOC 2 Awareness | Workramp | 30 min | Week 4 |

---

## Key Resources

| Resource | URL |
|----------|-----|
| Engineering Setup | `github.com/nexova/engineering-setup` |
| Runbooks | `nexova.notion.so/runbooks` |
| Architecture Docs | `nexova.notion.so/architecture` |
| Company Handbook | `nexova.notion.so/handbook` |
| Benefits Portal | `benefits.nexova.io` |
| IT Help Desk | `#it-help` Slack channel |
| Onboarding Issues | `JIRA/ONBOARD` project |

---

## Onboarding Buddy Program

Each new hire is paired with an **onboarding buddy** for their first 60 days:
- Buddy is a peer (not manager) from the same or adjacent team
- Expected commitment: 2 hours/week for first month, 1 hour/week for second month
- Buddy introduces new hire to informal culture, answers "silly" questions
- Buddy receives a $100 gift card upon successful completion
- Buddy assignments: contact Jennifer Walsh (VP Product, interim People Ops)
