# Authentication & Authorization Architecture

**Document ID:** ARCH-SEC-003  
**Version:** 2.1  
**Author:** Priya Patel (Senior Software Engineer), Robert Kim (Director of DevOps)  
**Reviewed By:** Sarah Chen (VP Engineering), Marcus Williams (Principal Engineer)  
**Last Updated:** 2026-03-18  
**Status:** Approved — Active Design  

---

## 1. Overview

This document describes the authentication and authorization architecture for the Nexova platform. The Auth & Identity Service is the single source of truth for all identity, session, and permission management across all Nexova products.

### Design Principles
1. **Zero-trust:** Every service-to-service call is authenticated
2. **Least privilege:** Users and services receive only required permissions
3. **Defense in depth:** Multiple layers of security controls
4. **Auditability:** Every auth event is logged and immutable
5. **Standards-based:** OAuth 2.0, OIDC, SAML 2.0, JWT

---

## 2. Authentication Flows

### 2.1 Customer (End-User) Authentication

#### Email/Password (Native)
```
User → Web App → Auth Service → PostgreSQL (bcrypt hash check)
                              → Redis (session creation, 8h TTL)
                              → JWT issued (access: 15min, refresh: 7d)
```

#### OAuth 2.0 / Social Login (Google, Microsoft)
```
User → Web App → Auth Service → External IdP (OAuth authorize)
                              → Callback with code
                              → Token exchange
                              → User creation/lookup
                              → JWT issued
```

#### Enterprise SSO (SAML 2.0 / OIDC)
```
User → Web App → Auth Service (SP-initiated flow)
                → Customer IdP (Okta / Azure AD / Ping)
                → SAML assertion / ID token returned
                → Auth Service validates signature
                → User provisioned / updated (SCIM sync)
                → JWT issued
```
*See Project: Enterprise SSO Integration (PROJ-002) for implementation status*

### 2.2 Token Types

| Token | Format | Expiry | Storage | Refresh |
|-------|--------|--------|---------|---------|
| Access Token | JWT (RS256) | 15 min | Memory (browser) | Yes, via refresh token |
| Refresh Token | Opaque (UUID) | 7 days | HttpOnly cookie | Rotated on use |
| API Key | HMAC-SHA256 | Non-expiring | DB (hashed) | Manual rotation |
| Service Token | JWT (RS256) | 5 min | Memory | Auto via JWKS |

### 2.3 Service-to-Service Authentication
All internal services use mutual TLS (mTLS) with short-lived JWTs signed by the internal CA.

```
Flow API → Auth Service: POST /internal/token (service credentials)
         ← JWT (5 min TTL, scope: service.internal)
Flow API → Connect Gateway: Bearer <service-jwt> + mTLS
```

---

## 3. Authorization Model

### 3.1 Role-Based Access Control (RBAC)

```
Organization
  └── Workspace
        ├── Members (role assignments)
        └── Resources (workflows, dashboards, connectors)
```

**Built-in Roles:**

| Role | Description | Typical Assignee |
|------|-------------|-----------------|
| `org:owner` | Full organization control, billing | IT Admin |
| `org:admin` | User management, settings | IT Admin |
| `workspace:admin` | Full workspace control | Team Lead |
| `workspace:editor` | Create/edit/publish workflows | Power User |
| `workspace:viewer` | Read-only access | Business Stakeholder |
| `api:read` | API key with read-only scope | Integrations |
| `api:write` | API key with write scope | Integrations |

### 3.2 Permission Evaluation

```python
# Simplified permission check pseudocode
def can(user, action, resource):
    # 1. Check explicit deny (always wins)
    if has_explicit_deny(user, action, resource):
        return False
    # 2. Check org-level permission
    if has_org_permission(user, action):
        return True
    # 3. Check workspace-level permission
    if has_workspace_permission(user, action, resource.workspace):
        return True
    # 4. Check resource-level override
    if has_resource_permission(user, action, resource):
        return True
    return False
```

### 3.3 Attribute-Based Access Control (ABAC) Extensions

For enterprise customers, ABAC policies layer on top of RBAC:
- Time-based access (e.g., 9–5 business hours only)
- IP allowlist restrictions
- MFA enforcement for sensitive operations

---

## 4. Security Controls

### 4.1 Token Security
- JWT signed with RSA-256 (4096-bit key), rotated every 90 days
- JWKS endpoint published at `/.well-known/jwks.json`
- Token revocation via Redis blacklist (checked on every request for critical operations)
- Refresh tokens are single-use and rotated on each use

### 4.2 Password Security
- Bcrypt with cost factor 12
- Minimum: 12 characters, complexity requirements enforced
- Breached password check via HaveIBeenPwned API (k-anonymity)
- Account lockout: 10 failed attempts → 15-min lockout → exponential backoff

### 4.3 MFA (Multi-Factor Authentication)
- TOTP (RFC 6238) via authenticator apps
- WebAuthn / FIDO2 hardware keys (enterprise)
- SMS OTP (legacy, being deprecated Q3 2026)
- Backup codes: 10 single-use codes, encrypted at rest

### 4.4 Session Management
- Session stored in Redis with TTL
- Session invalidated on: password change, explicit logout, suspicious activity detection
- Concurrent session limit: 5 per user (configurable per org)

---

## 5. Infrastructure

### 5.1 Auth Service Deployment
- **Kubernetes:** 3 replicas minimum, HPA (scale to 10 at peak)
- **Namespace:** `production-auth` (isolated network policy)
- **Secrets:** AWS Secrets Manager (rotated automatically)
- **Database:** PostgreSQL RDS Multi-AZ (auth data), Redis ElastiCache (sessions/blacklist)

### 5.2 Network Security
- Auth Service is the **only** service that can issue JWTs
- Internal services communicate via private VPC subnets only
- Auth endpoints exposed publicly via AWS ALB with WAF rules:
  - Rate limiting: 100 req/min per IP for auth endpoints
  - Bot detection via AWS WAF managed rules
  - Geo-blocking configurable per customer

---

## 6. Audit Logging

Every auth event is logged to an immutable audit trail:

```json
{
  "event_id": "evt_01HX...",
  "timestamp": "2026-06-08T14:23:11.422Z",
  "event_type": "user.login.success",
  "user_id": "usr_...",
  "org_id": "org_...",
  "ip_address": "203.0.113.42",
  "user_agent": "Mozilla/5.0...",
  "auth_method": "saml",
  "session_id": "sess_...",
  "metadata": {}
}
```

Logs are streamed to S3 (immutable, 7-year retention) and Datadog (90-day searchable).

---

## 7. Future Roadmap

| Feature | Priority | Target Quarter |
|---------|----------|---------------|
| Full SAML 2.0 SP/IdP support | P0 | Q3 2026 (PROJ-002) |
| Risk-based adaptive authentication | P1 | Q4 2026 |
| Passkey (FIDO2) for all customers | P1 | Q1 2027 |
| Deprecate SMS OTP | P2 | Q3 2026 |
| Privacy-preserving audit logs (ZKP) | P3 | 2027 |
