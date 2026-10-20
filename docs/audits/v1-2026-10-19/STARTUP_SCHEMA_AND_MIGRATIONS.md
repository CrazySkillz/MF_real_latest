# Startup schema and migration execution

Revision: `777aae6f6353e998d60b635d3e66b413093117c2`. [Three real PostgreSQL scenarios](startup-migrations-postgres.json), [runner](startup-migrations-postgres.cjs). PostgreSQL18 on audit-only loopback55442, notifications_test database, random disposable schemas, application DATABASE_URL cleared. Schemas removed in finally blocks and PostgreSQL stopped. No deployed migration, customer data, provider, email, HTTP listener or real worker was run.

## Initialization contract

The installed drizzle-kit0.30.4 API generated62 tables and70 SQL statements from the exact current shared/schema.ts, using an empty prior schema. [Generator](schema-generation.cjs), [schema/index metadata and statements](schema-generation.json), [SQL artifact](generated-schema.sql). This is an audit artifact, **not an approved deployment migration**. No dependency was installed. Generated statements are unqualified and the fixture explicitly rejects public-qualified statements before execution in its isolated search_path.

`package.json` offers manual `db:push`; Render build/start does not invoke it or a versioned migration runner. `server/index.ts:257–262` starts HTTP and schedules the migration callback five seconds later. Its first statement alters campaigns; it does not bootstrap that base table. The callback has one large sequential DDL/DML group and separate later groups, with catches that continue. Seed and13 scheduler entry points run afterward. Fixtures execute the exact callback and actual SQL, stubbing only seed and worker functions to record invocation safely.

## V1-009: migration failure does not prevent startup work

In an empty schema, the first ALTER campaigns fails42P01. The callback still creates ga4_refresh_work and dedicated GA4 Ads Spend tables, invokes seed, and invokes all13 scheduler starts. HTTP readiness precedes the callback in the actual index. This confirms the previously code-reviewed fail-open behavior; a successful health response cannot certify required schema readiness. A fresh deployment needs an explicit, tested base-schema provisioning path and an upgrade manifest, not an assumption that startup creates the whole application schema.

## V1-080: declared schema and upsert constraints disagree

With all62 generated tables installed, two complete current startup migration passes finish without SQL errors. Four exact current storage methods then fail42P10, meaning their ON CONFLICT targets have no corresponding unique/exclusion constraint:

| Method / required identity | Current caller and actual impact |
|---|---|
| storage1563 upsertGA4DailyMetrics: campaign/property/date | Only tracked non-test route caller found is demo seeding10531, which swallows its failure. **Normal native refresh uses transactional replaceGA4DailyMetricsWindow, not this upsert.** The schema also lacks the declared uniqueness invariant, but this test does not prove ordinary scoped publication fails from that missing constraint. |
| storage1781 upsertLinkedInDailyMetrics: campaign/date | linkedin-daily-metrics113, scheduler177 and active import route31561 use it. Fresh schema cannot complete those writes. |
| storage5188 upsertGoogleAdsDailyMetrics: campaign/google campaign/date | google-ads-scheduler116 uses it. Fresh schema cannot complete those writes. |
| storage5403 upsertMetaDailyMetrics: campaign/Meta campaign/date | meta-scheduler153/275 and retained routes use it. Fresh schema cannot complete those writes. |

The current shared schema declares no matching unique index/constraint for these four tables. GA4/LinkedIn inline CREATE TABLE includes uniqueness only when it creates a missing table; CREATE TABLE IF NOT EXISTS does not add that constraint to a table already created from the shared schema. Current startup has no corrective constraint for the four tested targets. Instagram/TikTok explicitly create unique indexes in later statements; their catalog entries are included as contrasting schema evidence, not additional full upsert tests.

Later [read-only catalog evidence](PTOMO_READ_ONLY_EVIDENCE.md) from the repository-configured remote database finds valid unique business-key indexes for all four targets, plus the selected GA4 work/Overview/daily snapshot identities. That database reports PostgreSQL17.9; its binding to the deployment remains unverified. The proven release gap is fresh-schema reproducibility and declared/upgraded-schema consistency, not an assertion that the observed historical database lacks those indexes or every live import presently fails. Before any repair, inventory duplicates and parent/source identity read-only, preserve unrelated rows, and make fresh/upgrade/concurrent boot plus all included active upserts part of the accepted migration gate. Deferred provider functionality follows the user's scope amendment.

## V1-081: retained financial backfill is unsafe to replay

`migrations/0006_add_daily_spend_revenue_granularity.sql` backfills synthetic LinkedIn Spend and GA4 Revenue records using fixed synthetic source IDs, hard-coded USD and ON CONFLICT DO NOTHING. Current source/record tables have no uniqueness over those synthetic business identities. The fixture supplies an EUR campaign, one daily revenue100 and one daily spend20, then executes the exact file twice: two revenue rows total200 and two Spend rows total40, all USD. No matching source definitions are created. Replaying the file is therefore neither financially correct for this configuration nor idempotent.

This file is **not invoked by current build/start or server code** in the tracked caller search. Current active-source filters may exclude its orphan rows; the fixture does not prove doubled current UI totals. It remains a retained migration/restore hazard and must not be included blindly in an upgrade or recovery recipe. The exact-ID cleanup0009 is historical and narrowly guarded; it is not a general repair for new duplicates. Any actual damaged-data cleanup requires a separate read-only inventory and agreed exact boundary.

Other migration-sensitive behavior: startup354 hard-deletes notification records matching the Shopify refresh-failure metadata regex (mirrors0016);790 normalizes nullable Sheets flags;956 resets legacy global integration connected flags. Decimal widening, unique-index installation and lifecycle trigger creation can acquire locks or fail on historical data. The supplement below adds bounded concurrent startup and all-script execution; historical production snapshot upgrade, realistic lock-contention/load, production restore and rollback remain separate gates.

## Complete retained SQL catalog and simultaneous startup supplement

[Catalog runner](migration-catalog-postgres.cjs), [results](migration-catalog-postgres.json), 2026-10-20. All **27 retained SQL files** were executed twice in recorded lexicographic order after installing the generated schema and completing the actual startup migration callback. This is a diagnostic order, not an approved production upgrade recipe. Real SQL ran in disposable random schemas on `127.0.0.1:55443/notifications_test`, PostgreSQL18, role `v1_audit`; application DATABASE_URL was empty. No seed, provider or actual scheduler ran.

**52 of54 file executions succeeded.** Both failures are `migrations/0003_add_kpi_periods_and_notifications_metadata.sql:47`: it creates a default GIN index on `notifications.metadata`. Current `shared/schema.ts:252` declares `text`; `ADD COLUMN IF NOT EXISTS ... JSONB` does not change an existing text column. PostgreSQL rejects the index with `42704`, `data type text has no default operator class for access method "gin"`. This is a confirmed schema/migration contradiction under **V1-080**, separate from the four upsert constraints. No current build/start caller invokes this file automatically; no present production outage is inferred. Reconcile this retained script before using it in provisioning, upgrade or restore.

The remaining files cover additive scope/config/precision fields; connection/fact tables; snapshot/work identities; lifecycle trigger/audit history; exact historical orphan cleanup0009; global Shopify refresh-failure notification cleanup0016; and legacy financial backfill0006. The catalog binds every script to a SHA-256 and records each execution. Success on empty fixture tables does not prove populated-data safety or backfill idempotence. The populated0006 reproduction remains a blocker.

A separate schema ran **two exact startup callbacks concurrently**, synchronized at their first SQL statement. Both completed without SQL errors in this bounded run; each invoked its own seed stub and13 scheduler-start stubs. This narrows the earlier unexecuted concurrency gap. It does not prove historical upgrades, realistic load/locks, actual seed safety, distributed worker ownership or startup readiness. Fail-open startup and fabrication findings remain.

The runner removed both schemas and verified zero remaining `v1_migration_*` namespaces. Initial attempts to reuse the earlier fixture cluster supplied incorrect role names and failed before schema creation; the new explicit-role cluster was used instead. These environment failures are not application findings.
