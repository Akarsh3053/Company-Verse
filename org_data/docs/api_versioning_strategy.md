# API Versioning Strategy

**Document ID:** ARCH-ENG-007  
**Version:** 1.3  
**Author:** Marcus Williams (Principal Software Engineer)  
**Reviewed By:** Sarah Chen, Jennifer Walsh, Michael Okafor  
**Last Updated:** 2025-11-20  
**Status:** Approved — Active Standard  

---

## 1. Overview

This document defines Nexova's API versioning strategy for all public-facing APIs. As we expand our enterprise customer base, API stability is a critical trust factor. This strategy balances the need for platform evolution with our commitment to backward compatibility.

---

## 2. API Versioning Approach

Nexova uses **URL path versioning** for all REST APIs:

```
https://api.nexova.io/v{major}/resources
```

Examples:
```
https://api.nexova.io/v1/workflows
https://api.nexova.io/v2/workflows
https://api.nexova.io/v1/executions/{id}
```

### Why URL Path Versioning?
- Immediately visible in URLs and logs
- Easy to test and debug
- Simple routing in API Gateway (Kong)
- Consistent with the majority of enterprise API consumers' expectations
- Header-based versioning considered and rejected: opaque, harder to cache

---

## 3. Versioning Rules

### 3.1 What Requires a New Major Version (Breaking Changes)

A **breaking change** requires incrementing the major version:
- Removing an endpoint
- Removing or renaming a required request field
- Removing or renaming a response field that consumers depend on
- Changing the type of a field (e.g., string → integer)
- Changing authentication requirements
- Changing the meaning of an existing field
- Changing HTTP method for an existing operation
- Removing enum values from an existing field

### 3.2 What Does NOT Require a New Version (Backward-Compatible Changes)

- Adding a new optional request field
- Adding new response fields (consumers must ignore unknown fields)
- Adding new endpoints
- Adding new enum values (consumers must handle unknown values gracefully)
- Performance improvements
- Bug fixes that restore documented behavior
- Adding new error codes (consumers must handle unexpected 4xx/5xx)

---

## 4. Version Lifecycle

```
[Development] → [Beta] → [Stable (GA)] → [Deprecated] → [Sunset]
```

| Phase | Description | SLA |
|-------|-------------|-----|
| **Beta** | Available for testing, may change without notice | No stability guarantee |
| **Stable (GA)** | Fully supported, breaking changes prohibited | Full support |
| **Deprecated** | Replaced by newer version, still functional | 12-month minimum support window |
| **Sunset** | Removed from service | End of life |

### Minimum Support Windows

| Customer Tier | Deprecation Notice | Sunset Window |
|--------------|-------------------|--------------|
| Standard | 6 months | 12 months from deprecation |
| Enterprise | 12 months | 18 months from deprecation |
| Strategic (>$500K ACV) | 18 months | 24 months from deprecation |

---

## 5. Current API Version Status

| API | Current Version | Previous Versions | Status |
|-----|----------------|-------------------|--------|
| Workflows API | v2 | v1 | v1 deprecated 2025-06-01, sunset 2026-06-01 |
| Executions API | v2 | v1 | v1 deprecated 2025-06-01, sunset 2026-06-01 |
| Connectors API | v1 | — | Stable |
| Webhooks API | v1 | — | Stable |
| Analytics API | v1 | — | Beta |
| Admin API | v1 | — | Stable (internal use only) |

---

## 6. Versioning in Practice

### 6.1 Changelog Requirements

Every API release must include:
- CHANGELOG.md entry in the API repository
- In-product changelog notification for affected customer workspaces
- Email notification to all customers with active API keys (for deprecation notices)
- Developer portal documentation update (docs.nexova.io)

### 6.2 Response Headers

All API responses include version metadata:

```
X-API-Version: 2
X-API-Deprecation: false
X-API-Sunset-Date: (only if deprecated)
```

### 6.3 Migration Guides

For every major version bump, the Documentation team publishes:
- Side-by-side diff of breaking changes
- Migration guide with code examples
- Automated migration tool (where feasible)
- 90-day migration support offer from Customer Success

---

## 7. Internal (Service-to-Service) APIs

Internal APIs between microservices follow different rules:
- gRPC with Protobuf — versioning via package namespacing (`nexova.flow.v1`)
- Breaking changes allowed with coordinated deployment
- Consumer-driven contract tests (Pact) required for all internal APIs
- No external versioning commitments

---

## 8. GraphQL (Future)

The team is evaluating GraphQL for the Analytics API (v2, roadmap item). GraphQL versioning strategy TBD, but the preferred approach is schema evolution (additive only) rather than versioned endpoints. ADR to be written before implementation.

---

## 9. API Governance Process

New APIs and breaking changes must go through:

1. **RFC:** Author writes an API RFC (template in Notion) with proposed changes
2. **Review:** Minimum 2 senior engineers + 1 PM review
3. **Customer preview:** Beta release for 30+ days before GA
4. **Documentation:** Docs published to docs.nexova.io before GA
5. **Sign-off:** VP Engineering + VP Product sign off on major version bumps

---

## 10. Related Documents

- ARCH-ENG-008: API Design Guidelines
- SOP-ENG-001: Deployment SOP
- POL-SEC-005: Security Review Policy
- Developer portal: `docs.nexova.io/api`
