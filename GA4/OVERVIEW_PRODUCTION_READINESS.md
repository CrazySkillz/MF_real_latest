# GA4 Overview Production Readiness

## Purpose

This is the concise canonical index for the current GA4 Overview readiness decision and active gates.

- [Evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md): detailed inventories, traces, blockers, validation packets, and active-gate specifications
- [History ledger](./OVERVIEW_PRODUCTION_READINESS_HISTORY.md): chronological Current Commit 0-19 and UI-validation record
- [Overview behavior](./OVERVIEW.md): implemented product contract
- [Refresh contract](./REFRESH_AND_PROCESSING.md): completed-day, OAuth, and scheduler behavior

No evidence or requirement was deleted during this split.

## Anti-Overclaim Rule

Only evidence from the same deployed commit, production-data state, and documented scope can support certification. Every status must remain **proven**, **unproven**, or **requires external validation**.

## Current Decision

**GA4 Overview is not yet production-ready and is not yet clean-certified.**

Proven:

- corrective commit e857c15d is deployed
- existing GA4 single / ga4_mock uses the saved 30-day completed-day window
- its UI and exact /ga4-daily response agreed at 866 Sessions, 867 daily-summed Users, 110 Conversions, 68.4% Engagement Rate, and 12.7% Conversion Rate
- refreshIsStale was false
- Campaign Breakdown no longer replaces Summary
- Commit 17 deployed without changing the existing Total Revenue, Total Spend, or source lists

This proves the bounded existing 30-day packet only.

## Intended Release Scope

The initial production target is:

- exactly 30 completed GA4 reporting days
- exact selected property and saved campaign-value scope
- scheduler-backed persisted daily Summary values
- independent Campaign Breakdown detail
- separately labeled campaign-to-date financial values

Future 60/90-day options are outside this release and require later implementation and validation.

## Active Gates

| Gate | Status | Required outcome |
| --- | --- | --- |
| Current Commit 19 | **Implemented locally; deployment validation pending** | Local UI/API enforcement, no-mutation rejection, legacy non-30 fail-closed guards, 49 focused/adjacent tests, TypeScript, and production build pass. Deployment and production validation remain unproven. |
| OAuth durability | **Requires external validation** | On 2026-08-07 or later, confirm the existing unreconnected GA4 connection and metrics still work; do not infer automatic renewal unless observed. |
| Final non-scheduler pack | **Unproven** | Reconcile included values, valid-zero/unavailable behavior, retained sources, guarded APIs, and downstream consumers for the intended 30-day scope. |

The exact implementation, no-mutation, validation, and completion requirements are preserved in the [evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md#active-gate-specifications-moved-from-the-main-index).

## Explicit Scheduler Exclusions

The planned certification excludes and does not claim:

- timer-fired scheduler execution
- startup-triggered refresh
- scheduled email delivery
- scheduled PDF/snapshot generation
- post-scheduler-cycle inventory

The scheduler-backed values rendered by Overview remain inside the 30-day value-parity scope.

## Production-Data Boundary

- no cleanup, reconnect, migration, deletion, or rewrite is authorized by this documentation
- Commit 17 provider-cycle rollback evidence remains open
- the eight retained inventory sources are not silently certified or cleaned

## Certification Rule

The documented 30-day non-scheduler scope may be clean-certified only when, at the same deployed commit and data state:

1. Commit 19 is deployed and validated.
2. OAuth durability passes on 2026-08-07 or later.
3. The final non-scheduler pack has no unresolved included value, source, lifecycle, failure, or downstream path.
4. All canonical documents record the same decision.

Only then may the status say:

**GA4 Overview is clean-certified and production-ready for the documented 30-completed-day non-scheduler scope. The named scheduler checks, future 60/90-day options, future configurations, and future provider behavior are excluded.**

Until then, the required answer is **not production-ready**.

## Source-Family Authority

HubSpot Revenue remains **clean-certified and production-ready for its validated documented GA4 Overview scope** under GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md. That bounded source-family decision does not certify the complete Overview.

Historical-ledger note: preserved historical packets remain bounded evidence and do not override this current decision or a later canonical source-family decision.
