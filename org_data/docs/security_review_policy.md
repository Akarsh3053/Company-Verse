# Security Review Policy

**Document ID:** POL-SEC-005  
**Version:** 1.8  
**Owner:** Sarah Chen (VP of Engineering)  
**Approved By:** Christine Alvarez (CEO)  
**Last Reviewed:** 2026-02-14  
**Next Review:** 2026-08-14  
**Status:** Approved  

---

## 1. Purpose

This policy establishes the requirements for security reviews at Nexova Technologies. It ensures that all significant changes to systems, code, and infrastructure are evaluated for security risk before deployment to production.

---

## 2. Scope

This policy applies to:
- All production code changes
- New third-party vendor integrations
- Infrastructure changes (Kubernetes, network, IAM)
- New data processing capabilities
- External-facing API changes
- Authentication and authorization changes
- Changes to data storage or retention

---

## 3. Security Review Tiers

Changes are classified into tiers based on security risk:

| Tier | Risk Level | Trigger | Required Review |
|------|-----------|---------|----------------|
| **Tier 1** | Critical | Auth changes, crypto, data access control, PII handling | Dedicated security review + VP Eng sign-off |
| **Tier 2** | High | New API endpoints, new dependencies, new integrations | Senior engineer security checklist + peer review |
| **Tier 3** | Medium | Internal tooling, config changes, minor features | Self-assessment checklist in PR |
| **Tier 4** | Low | Documentation, tests, non-functional UI changes | Standard PR review |

---

## 4. Security Review Process

### 4.1 Tier 1 (Critical) Process

1. **Request initiation:** Author opens a Security Review Request in Jira (project: SECRV) with the template provided in §7
2. **Assignment:** VP Engineering assigns a reviewer within 1 business day
3. **Review window:** 3–5 business days
4. **Artifacts required:**
   - Threat model (STRIDE methodology)
   - Data flow diagram
   - List of all data touched (PII, PHI, payment data)
   - Rollback plan
5. **Approval:** Must receive written approval before merging
6. **Post-deploy:** Security reviewer monitors for 24h post-deployment

### 4.2 Tier 2 (High) Process

1. Complete the Security Checklist (§6) in the PR description
2. Request review from a senior engineer (≥E3 level)
3. Address all checklist items before merging
4. No separate approval gate required if checklist is complete

### 4.3 Tier 3 (Medium) Process

1. Complete the abbreviated self-assessment in the PR template
2. Standard peer review applies

---

## 5. Mandatory Security Requirements

Regardless of tier, the following requirements apply to **all** production code:

### 5.1 Input Validation
- All user-supplied input must be validated at the service boundary
- Use parameterized queries exclusively (no string concatenation in SQL)
- Validate content type, length, and character set for all inputs
- Reject unexpected fields (strict schema validation)

### 5.2 Authentication & Authorization
- All endpoints require authentication unless explicitly documented as public
- Authorization checked at the resource level, not just the route level
- No client-side authorization decisions
- Admin endpoints require MFA + IP allowlist

### 5.3 Secrets Management
- Zero hardcoded secrets, credentials, or API keys in source code
- All secrets sourced from AWS Secrets Manager via External Secrets Operator
- Secret scanning runs on every commit (pre-commit hook + CI check via Gitleaks)
- If a secret is accidentally committed: rotate immediately, treat as compromised

### 5.4 Dependency Management
- Snyk SCA scan required on every PR (configured in CI)
- Critical or High CVEs block merging unless a documented exception is approved
- Dependencies reviewed quarterly by each team's senior engineer
- No packages with < 100 weekly downloads or abandoned (>18 months no update) without VP approval

### 5.5 Logging & Audit Trails
- No logging of passwords, tokens, PII, or payment card data
- Security-relevant events (login, permission change, data export) must generate audit log entries
- Logs must include: timestamp, actor, action, resource, outcome, IP

---

## 6. Security Review Checklist

For Tier 2 PRs, complete in PR description:

```markdown
## Security Review Checklist

### Authentication & Authorization
- [ ] All new endpoints require appropriate authentication
- [ ] Authorization is enforced at the resource level
- [ ] No privilege escalation vectors introduced

### Input Validation
- [ ] All user inputs are validated and sanitized
- [ ] SQL queries use parameterized statements
- [ ] File uploads are validated (type, size, content)

### Data Handling
- [ ] PII is handled per the Data Retention Policy (POL-DATA-006)
- [ ] No PII/secrets in logs
- [ ] Sensitive data encrypted at rest and in transit

### Dependencies
- [ ] New dependencies scanned with Snyk
- [ ] No Critical/High CVEs in new dependencies
- [ ] Dependency is maintained and actively supported

### Secrets
- [ ] No hardcoded secrets or credentials
- [ ] Secrets sourced from AWS Secrets Manager

### Error Handling
- [ ] Error messages do not expose internal implementation details
- [ ] Stack traces not returned to clients in production

### Rate Limiting
- [ ] Public/unauthenticated endpoints have rate limiting applied
```

---

## 7. Annual Penetration Testing

- External penetration test conducted annually by approved vendor (current: NCC Group)
- Scope includes: web application, API, and internal network (zero-trust posture)
- Findings classified and tracked in Jira (project: PENTEST)
- Critical findings remediated within 15 days; High within 30 days; Medium within 90 days
- Results shared with SOC 2 auditors

---

## 8. Policy Violations

- First violation (unintentional): Engineering manager coaching
- Repeated violations: Formal performance process
- Intentional circumvention of security controls: Grounds for immediate termination and potential legal action
- Security issues may be reported confidentially to sarah.chen@nexova.io or via anonymous reporting tool

---

## 9. Exceptions

Exceptions to this policy must be:
1. Documented with business justification
2. Approved by VP Engineering in writing
3. Time-bound (maximum 90 days)
4. Logged in the Security Exceptions Register (maintained by DevOps)

---

## 10. Related Documents

- POL-DATA-006: Data Retention and Deletion Policy
- ARCH-SEC-003: Auth & Identity Architecture
- SOP-ENG-001: Deployment SOP
- OPS-SEC-002: Incident Response Playbook
- ADR-015: Dependency Management Strategy
