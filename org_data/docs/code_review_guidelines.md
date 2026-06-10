# Code Review Guidelines

**Document ID:** ENG-PROC-012  
**Version:** 2.0  
**Owner:** Marcus Williams (Principal Software Engineer)  
**Reviewed By:** Sarah Chen, David Park  
**Last Updated:** 2026-01-22  
**Status:** Approved — Active Standard  

---

## 1. Purpose

Code review is one of our most effective tools for maintaining code quality, sharing knowledge, and catching bugs before production. These guidelines define expectations for both authors and reviewers at Nexova.

---

## 2. Guiding Principles

1. **Reviews are about the code, not the person.** All feedback is directed at the change, never at the individual.
2. **Be kind and specific.** Explain *why* a change is suggested, not just *what* to change.
3. **Default to approval.** If a PR is good enough to ship, approve it. Perfect is the enemy of good.
4. **Share the burden.** Reviews are a team responsibility, not just a gatekeeping function.
5. **Learn in public.** Reviews are a primary knowledge transfer mechanism for the team.

---

## 3. PR Size & Scope

| PR Type | Target Size | Maximum |
|---------|-------------|---------|
| Feature | ≤400 lines changed | 600 lines |
| Bug fix | ≤200 lines | 400 lines |
| Refactor | ≤300 lines | 500 lines |
| Dependency update | Any | Any |

Large PRs must be broken into smaller, logically independent units. If a PR must be large, include a detailed description with context to make review tractable.

---

## 4. PR Author Responsibilities

### Before Opening a PR

- [ ] Run the full test suite locally and ensure it passes
- [ ] Run linter and formatter (`make lint`, `make format`)
- [ ] Review your own diff before requesting review (self-review catches ~30% of issues)
- [ ] Write a clear PR description (template in §7)
- [ ] Link to the Jira ticket
- [ ] Assign reviewers (≥2 for production code, ≥1 for staging/infra)

### PR Description Must Include
- **What:** What does this change do?
- **Why:** Why is this change needed? Link to Jira ticket or RFC
- **How:** Key technical decisions made and why
- **Testing:** How was this tested? What automated tests were added?
- **Screenshots:** For UI changes, before/after screenshots

### During Review
- Respond to all comments (resolve, or explain why not)
- Don't force-push during active review (use new commits, squash before merge)
- If a comment thread is getting long, jump on a call and summarize the outcome in the PR

---

## 5. Reviewer Responsibilities

### Response Time Expectations

| Urgency | Response SLA |
|---------|-------------|
| P0/P1 hotfix | 30 minutes |
| Normal PR (labeled `urgent`) | 4 hours (same business day) |
| Normal PR | 1 business day |
| Large/complex PR | 2 business days |

If you cannot review within the SLA, re-assign to another reviewer immediately.

### What to Review

**Always check:**
- Correctness: Does the code do what it claims to do?
- Edge cases: Are error conditions and null cases handled?
- Security: See Security Checklist in POL-SEC-005
- Test coverage: Are meaningful tests added/updated?
- API contracts: Are external interfaces backward-compatible?

**Look for opportunities to:**
- Suggest simpler approaches (but don't mandate unless it's clearly better)
- Share relevant patterns used elsewhere in the codebase
- Identify future maintenance burden

**Not required to:**
- Catch every nit — 2 nits max per PR, use "nit:" prefix
- Approve only perfect code — approve if it's good enough to ship
- Re-review minor changes after addressing feedback unless requested

### Comment Conventions

| Prefix | Meaning |
|--------|---------|
| `nit:` | Minor style suggestion, non-blocking |
| `question:` | Seeking understanding, non-blocking |
| `suggestion:` | Better approach possible, non-blocking |
| `blocker:` | Must be addressed before merge |
| `praise:` | Nice work! (use more often) |

---

## 6. Merge Requirements

| Requirement | Platform Check |
|-------------|---------------|
| ≥2 approvals (≥1 must be senior engineer for Tier 1 services) | GitHub Branch Protection |
| All CI checks passing (lint, tests, security scan) | GitHub Required Status Checks |
| No unresolved blocker comments | Manual |
| Security checklist complete (for Tier 2+ changes) | PR template |
| No merge conflicts | GitHub |

**Merge strategy:** Squash and merge (default). Exception: large multi-commit PRs where commit history has value — merge commit allowed with team lead approval.

---

## 7. PR Description Template

```markdown
## Summary
<!-- What does this PR do? 1–3 sentences -->

## Motivation
<!-- Why is this change needed? Link to Jira: NXV-XXXX -->

## Changes
<!-- Bullet list of the key changes made -->
- 
- 

## Testing
<!-- How was this tested? -->
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed (describe below)

### Manual Testing Steps
<!-- If applicable -->
1. 
2. 

## Screenshots (if applicable)
<!-- Before / After for UI changes -->

## Security Checklist
<!-- For Tier 2+ changes — see POL-SEC-005 -->
- [ ] N/A (Tier 3 or 4 change)
- [ ] Security checklist completed (attached or inline)

## Rollback Plan
<!-- How do we undo this if it causes issues? -->
Feature flag: `feature_flag_name` / Deploy previous artifact / N/A

## Related
<!-- Links to Jira, RFCs, ADRs, related PRs -->
- Jira: 
- ADR/RFC: 
```

---

## 8. Special Cases

### Database Migrations
- Migrations must be backward-compatible (additive only, no drops without two-phase migration)
- Run migration against staging for ≥24 hours before production
- Review with a second engineer who understands the data model
- Include estimated migration time for large tables (>1M rows)

### Infrastructure Changes (Terraform)
- Always include `terraform plan` output in PR description
- Destructive resources (resources being deleted/replaced) must be called out explicitly
- DevOps lead required as one of the ≥2 approvers

### Dependency Updates
- Link to the dependency's changelog
- For major version bumps: read the migration guide and note any breaking changes
- Security patches: expedited review (1 business day max)

---

## 9. Metrics

The team reviews code review health monthly:
- Average PR open-to-merge time: target <48h
- PR size distribution: >80% of PRs under 400 lines
- Review response time: target >95% within SLA
- Stale PRs (>5 business days open): flagged in weekly engineering sync
