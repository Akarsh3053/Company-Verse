# Database Schema & Migration Guidelines

**Document ID:** ENG-DATA-018  
**Version:** 1.5  
**Author:** Marcus Williams (Principal Software Engineer), Ethan Brooks (Senior Data Engineer)  
**Reviewed By:** Sarah Chen, Priya Patel  
**Last Updated:** 2026-01-30  
**Status:** Approved — Active Standard  

---

## 1. Purpose

These guidelines establish standards for database schema design and the migration process at Nexova. Poorly executed schema changes are one of the most common sources of production incidents. These guidelines exist to prevent that.

---

## 2. Technology Stack

| Service | Database | ORM / Query Builder | Migration Tool |
|---------|----------|-------------------|---------------|
| Flow API | PostgreSQL 15 | SQLAlchemy (async) | Alembic |
| Auth Service | PostgreSQL 15 | Prisma | Prisma Migrate |
| Connect Gateway | PostgreSQL 15 | pgx (Go) | golang-migrate |
| Insights Engine | ClickHouse 24.x | clickhouse-driver | Custom migration runner |

---

## 3. Schema Design Principles

### 3.1 Naming Conventions

| Object | Convention | Example |
|--------|------------|---------|
| Tables | `snake_case`, plural | `workflow_executions` |
| Columns | `snake_case` | `created_at`, `org_id` |
| Primary keys | `id` (UUID v7) | `id uuid DEFAULT gen_random_uuid()` |
| Foreign keys | `<table_singular>_id` | `workflow_id` |
| Indexes | `idx_<table>_<columns>` | `idx_executions_org_status` |
| Unique constraints | `uq_<table>_<columns>` | `uq_users_email` |
| Check constraints | `chk_<table>_<description>` | `chk_executions_status_valid` |

### 3.2 Standard Columns (Required on All Tables)

```sql
id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
-- For soft-deletes (required on tables where data must be recoverable):
deleted_at  TIMESTAMPTZ
```

### 3.3 UUID Strategy
- Use UUID v7 (time-ordered) for all primary keys. Provides time-ordering without exposing sequence information.
- Never use sequential integer IDs for customer-facing resources (IDOR risk)
- UUIDs stored as native `uuid` type (not `varchar`)

### 3.4 Data Types

| Data | Recommended Type | Avoid |
|------|-----------------|-------|
| Timestamps | `TIMESTAMPTZ` (with timezone) | `TIMESTAMP` (no TZ) |
| Money | `NUMERIC(19,4)` | `FLOAT` (precision loss) |
| Status fields | `VARCHAR(50)` with CHECK constraint | Integers (opaque) |
| JSON | `JSONB` (indexable) | `JSON` or `TEXT` |
| Short text | `VARCHAR(n)` with explicit limit | Unbounded `TEXT` for bounded fields |
| Booleans | `BOOLEAN` | `INTEGER` or `CHAR(1)` |
| Enums | PostgreSQL `ENUM` type or `VARCHAR` + CHECK | — |

### 3.5 Indexing Guidelines

```sql
-- Always index foreign keys
CREATE INDEX idx_executions_workflow_id ON workflow_executions(workflow_id);

-- Index columns used in WHERE clauses with high selectivity
CREATE INDEX idx_executions_org_status ON workflow_executions(org_id, status);

-- Partial indexes for filtered queries (dramatically reduces index size)
CREATE INDEX idx_executions_pending ON workflow_executions(created_at)
WHERE status = 'pending';

-- Covering indexes for frequent queries (include needed columns)
CREATE INDEX idx_executions_org_created ON workflow_executions(org_id, created_at DESC)
INCLUDE (id, status, workflow_id);
```

**Avoid:** Indexing every column, over-indexing writes-heavy tables (each index slows inserts).

---

## 4. Migration Standards

### 4.1 Migration File Requirements

Every migration file must include:
1. **Description comment** at the top: what it does and why
2. **Up migration:** the change to apply
3. **Down migration:** how to reverse it (required, not optional)
4. **Estimated time** for tables >1M rows

```python
# Alembic example
"""Add composite index on workflow_executions for org+status queries

Motivation: Query analysis shows full-table scans on org_id+status
filtering for workflows with large execution counts. This index
reduces P99 query time from ~800ms to <50ms.

Estimated time on prod: ~45 seconds (table has 18M rows, non-blocking)
"""

def upgrade():
    op.create_index(
        'idx_workflow_executions_org_status',
        'workflow_executions',
        ['org_id', 'status'],
        postgresql_concurrently=True  # Non-blocking
    )

def downgrade():
    op.drop_index('idx_workflow_executions_org_status')
```

### 4.2 Backward-Compatible Migrations (Expand/Contract Pattern)

All migrations must be **backward-compatible** (deployable while the old service version is still running). Use the expand/contract pattern:

**Phase 1 — Expand (new column/table):**
```sql
-- Safe: add nullable column; old code ignores it
ALTER TABLE users ADD COLUMN display_name VARCHAR(255);
```

**Phase 2 — Migrate data:**
```sql
UPDATE users SET display_name = first_name || ' ' || last_name
WHERE display_name IS NULL;
```

**Phase 3 — Constrain (after new code deployed):**
```sql
-- Now safe: new code always sets display_name
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;
```

**Phase 4 — Contract (remove old column — separate deployment):**
```sql
-- Only after old code fully retired
ALTER TABLE users DROP COLUMN old_name_field;
```

### 4.3 Never Do These

```sql
-- ❌ Rename a column in use
ALTER TABLE users RENAME COLUMN email TO email_address;

-- ❌ Drop a column without the expand/contract pattern
ALTER TABLE workflows DROP COLUMN config;

-- ❌ Change a column type non-additively
ALTER TABLE executions ALTER COLUMN status TYPE INTEGER USING status::integer;

-- ❌ Add NOT NULL without a default on a populated table
ALTER TABLE workflows ADD COLUMN team_id UUID NOT NULL;

-- ❌ Run a migration without CONCURRENTLY on large table indexes
CREATE INDEX idx_big ON big_table(col); -- will lock the table!
```

---

## 5. Large Table Migration Procedure (>1M rows)

For tables with >1M rows, follow this procedure:

1. **Estimate runtime** using `pg_size_pretty(pg_total_relation_size('table_name'))` and test on a production-snapshot in staging
2. **Always use `CONCURRENTLY`** for index creation/deletion
3. **Batch data updates** — never update millions of rows in a single transaction:
   ```python
   # Update in batches of 10,000
   BATCH_SIZE = 10_000
   while True:
       rows_updated = db.execute("""
           UPDATE workflow_executions
           SET display_status = status::text
           WHERE display_status IS NULL
           LIMIT :batch_size
       """, {"batch_size": BATCH_SIZE}).rowcount
       if rows_updated < BATCH_SIZE:
           break
       time.sleep(0.1)  # brief pause to reduce write pressure
   ```
4. **Schedule during low-traffic window** (02:00–04:00 ET Tuesday)
5. **Monitor** RDS CPU and lock waits during migration

---

## 6. Review & Deployment

All schema migrations require:
- PR with migration file + application code change (same PR)
- Review by ≥1 senior engineer familiar with the data model
- Run against staging for ≥24 hours before production
- Director of DevOps notified before production migration (for monitoring)
- Migration listed in the weekly change log

---

## 7. Monitoring Schema Changes

After every migration:
```sql
-- Verify migration applied
SELECT version_num, description FROM alembic_version;

-- Check table size post-migration
SELECT pg_size_pretty(pg_total_relation_size('workflow_executions'));

-- Verify index was created
SELECT indexname, indexdef FROM pg_indexes
WHERE tablename = 'workflow_executions';
```

Monitor in Datadog for 30 minutes post-migration:
- RDS `DatabaseConnections`
- RDS `ReadLatency` / `WriteLatency`
- Application error rate
