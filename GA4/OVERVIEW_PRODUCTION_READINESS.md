# GA4 Overview Production Readiness

## Purpose

This is the concise canonical index for the current GA4 Overview readiness decision and active gates.

- [Evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md): detailed inventories, traces, blockers, validation packets, and active-gate specifications
- [History ledger](./OVERVIEW_PRODUCTION_READINESS_HISTORY.md): chronological Current Commit 0-19 and UI-validation record
- [Overview behavior](./OVERVIEW.md): implemented product contract
- [Refresh contract](./REFRESH_AND_PROCESSING.md): completed-day, OAuth, and scheduler behavior

## Anti-Overclaim Rule

Only evidence from the same deployed commit, production-data state, and documented scope can support certification. Every status must remain **proven**, **unproven**, or **requires external validation**.

## Current Decision — Stable Cross-Session Answer

**UNVERIFIED at the current revision. A deployed Summary regression showed that the 30-day setup value was incorrectly treated as a rolling display window. The prior claim that every other supported Overview requirement had passed is withdrawn. Current Commit 20 must restore initial-30-day import plus completed-day accumulation, prove UI/API/report parity, and then rerun the scheduler gate. OAuth durability remains due on or after 2026-08-07.**

## Intended Release Scope

The initial production target is:

- an initial import of the 30 completed GA4 reporting days preceding property setup
- subsequent completed reporting days appended by the existing daily pipeline without dropping the oldest imported day
- exact selected property and saved campaign-value scope
- scheduler-backed persisted daily Summary values
- independent Campaign Breakdown detail
- separately labeled campaign-to-date financial values

Future 60/90-day options are outside this release and require later implementation and validation.

## Active Gates

| Gate | Status | Required outcome |
| --- | --- | --- |
| Current Commit 20 | **Open — certification invalidated** | Restore the schema-defined historical-import meaning of `lookbackDays`. Overview Summary totals must retain the initial imported period and append later completed-day facts; a zero-activity new day must not reduce totals. Preserve the rolling daily response used by KPI/Trend consumers, exact property/campaign scope, fail-closed behavior, and production data. Add regression-first numerical coverage and prove UI/API/Overview-report parity. |
| Current Commit 19 | **Bounded implementation closed** | Runtime `ba2e4329` deployed; the existing `GA4 single` / `ga4_mock` page showed `Last 30 completed days` and loaded normally. Unsupported-write rejection is automated/code-path proven at this source, not production-injected. |
| Current-release GA4 scheduled run | **Requires external validation** | After a normal timer-fired run, confirm scheduler health records `lastRunTrigger=scheduled`, `lastRunStatus=success`, and an incremented run count; then confirm the existing scoped 30-day Overview remains valid with no false zero, duplicate, or damaged-row growth. |
| OAuth durability | **Requires external validation** | On 2026-08-07 or later, confirm the existing unreconnected GA4 connection and metrics still work; do not infer automatic renewal unless observed. |
| Deterministic/read-only pack | **Passed** | The local packet passed 19 files / 190 tests, production health passed, and the four visible retained Spend sources totaling $2,698.75 were explicitly approved to remain. Their presence is not damage. The post-publish Google Sheets reconnect and observed automatic mapped-value update remove the stale reconnect blocker. No cleanup was performed. |

The exact implementation, no-mutation, validation, and completion requirements are preserved in the [evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md#active-gate-specifications-moved-from-the-main-index).

## Scheduler Boundary

The current-release timer-fired GA4 daily scheduler run is an included certification gate. Google Sheets automatic propagation already has one deployed no-click observation.

The Overview certification does not claim:

- startup-triggered refresh
- scheduled email delivery
- scheduled PDF/snapshot generation
- exhaustive Google Sheets polling cadence, failure-injection, and future-provider behavior; one deployed no-click automatic update was observed, but it is not generalized beyond that event

The scheduler-backed Summary begins with the initial 30-day import and accumulates later completed days. The scheduler's rolling repair/lookback query is an operational fetch boundary, not the Summary display boundary.

## Production-Data Boundary

- no cleanup, reconnect, migration, deletion, or rewrite is authorized by this documentation
- Commit 17 rollback behavior is regression-covered; unsafe production provider-failure injection is not required or claimed
- the eight retained inventory sources are not silently certified or cleaned

## Certification Rule

The documented initial-30-day-import scope may be clean-certified only when, at the same deployed commit and data state:

1. Current Commit 20 is deployed and its Summary API/UI/Overview-report parity is validated.
2. One current-release timer-fired GA4 daily scheduler run proves that a zero-activity day does not drop the oldest imported day or change unchanged totals.
3. OAuth durability passes on 2026-08-07 or later.
4. The deterministic/read-only pack has no unresolved included value, source, lifecycle, failure, or downstream path.
5. All canonical documents record the same decision.

Only then may the status say:

**GA4 Overview is clean-certified and production-ready for the documented 30-completed-day scope. Current-release GA4 daily scheduled execution and Google Sheets automatic propagation are included. Future 60/90-day options, startup-triggered refresh, scheduled report delivery, future configurations, and future provider behavior are excluded.**

Until then, the exact answer is: **GA4 Overview is unverified because the rolling-window Summary regression is open. Current Commit 20, a current-release scheduled run, and the 2026-08-07 OAuth durability check must pass before clean certification.**

## Source Authority

HubSpot Revenue remains **clean-certified and production-ready** for its validated scope under `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`. Historical-ledger note: bounded source-family evidence does not override this current whole-Overview decision.
