# GA4 Benchmarks Production Readiness

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Benchmarks` tab.

Use this file when asked whether GA4 Benchmarks are robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration.

`GA4/BENCHMARKS.md` defines what the Benchmark tab is supposed to do.

This file defines whether the current implementation is production-ready, what has been proven, what is only partially reviewed, what is not locally verifiable, and the exact fix queue required before the durable answer can change.

## Durable Future Answer

As of June 27, 2026, GA4 Benchmarks are not production-ready yet.

The blocker is not the visible Benchmark threshold policy. The visible threshold policy has substantial local coverage. The blocker is the end-to-end production lifecycle:

- persisted GA4 Benchmark current values
- scheduler and refresh recompute
- alert and notification decisions
- property-scope safety
- existing damaged persisted data after a forward-path bug

The durable answer should remain:

`GA4 Benchmarks are not production-ready yet. The exact blocker queue is in GA4/BENCHMARKS_PRODUCTION_READINESS.md.`

That answer can change to production-ready only after every blocker in `Required Fix Queue` is implemented, locally validated, and this file is updated with completed validation evidence.

This answer should not change merely because:

- `GA4/BENCHMARKS.md` describes the intended product behavior
- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md` validates metric-aware threshold math
- the visible Benchmark cards look correct in the browser
- one local test suite is green

## How To Use This File In A New Chat

Read in this order:

1. `Durable Future Answer`
2. `Current Scope`
3. `Confirmed Blockers`
4. `Required Fix Queue`
5. `Validation Evidence`
6. `Future Platform Template`

Do not answer that GA4 Benchmarks are production-ready unless this file explicitly says the blocker queue is complete.

Do not reopen GA4 Ad Comparison or GA4 Reports when answering Benchmark readiness unless a Benchmark code path directly references those sections.

## Current Scope

This audit applies to the current GA4 `Benchmarks` tab for:

- platform-scoped GA4 Benchmark create, edit, delete, and list display
- Benchmark current-value calculation for GA4 platform Benchmarks
- Benchmark tracker summary counts and average progress
- Benchmark blocked and insufficient-data handling
- Benchmark alert and notification visibility
- Benchmark alert email eligibility and local audit behavior
- GA4 refresh, daily scheduler, and on-demand recompute paths that update Benchmark current values and Benchmark history
- GA4 campaign, property, source, and campaign-access scoping that can affect Benchmark values

This audit does not automatically certify:

- Meta Benchmarks
- Google Ads Benchmarks
- LinkedIn Benchmarks
- Google Sheets Benchmarks
- custom-upload Benchmarks
- campaign-level Benchmark pages except where they consume GA4 values
- provider-side email delivery
- live GA4 API behavior outside what local code and tests can prove

## Root Cause Of Prior Confusion

Earlier Benchmark readiness notes certified narrower slices:

- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md` covers metric-aware threshold math and visible Benchmark scoring behavior.
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` covers much of the in-app and email alert implementation.
- `GA4/BENCHMARKS.md` defines the product contract and expected tab behavior.

Those files did not fully certify the whole Benchmark production lifecycle.

The later audit traced the scheduler-persisted current-value path and found a separate defect: GA4 Benchmark ROAS is displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persists ROAS as a percent. Platform GA4 alert checks read persisted values, so the defect affects alerts, notification visibility, email eligibility, Benchmark history, and downstream consumers that rely on persisted Benchmark rows.

This file exists so future reviews do not confuse threshold readiness with whole-tab production readiness.

## Non-Negotiable Accuracy Rules

GA4 Benchmarks must preserve:

- campaign ownership and campaign access checks
- GA4 property scoping
- selected GA4 campaign/source scoping
- imported revenue additivity
- spend-source provenance
- ROAS as an `x` ratio, not a percent
- ROI as a percent
- CPA as currency
- metric-aware Benchmark status classification
- blocked and insufficient-data exclusion from tracker counts and average progress
- one active in-app notification row per active GA4 Benchmark breach
- email provider acceptance vs confirmed delivery semantics
- stable API response shapes

Do not change Benchmark calculations, alert semantics, source ownership, scheduler behavior, or response shapes unless the exact code path has been traced.

## Data Path Summary

Visible UI current-value path:

`GA4 property/source selection -> GA4 daily/to-date API responses -> frontend financial/current-value model -> Benchmark cards and tracker`

Persisted production path:

`GA4 daily refresh or on-demand refresh -> server/ga4-kpi-benchmark-jobs.ts -> storage.updateBenchmark(currentValue) -> Benchmark history -> checkBenchmarkPerformanceAlerts() -> in-app notification and email alert decisions`

Important meaning:

- visible cards and persisted alert state are separate paths
- both paths must use the same unit semantics
- a correct visible Benchmark card does not prove scheduler, notification, or email correctness
- a green threshold test does not prove current-value provenance correctness

## Production-Readiness Map

### 1. Benchmark Tab UI And Creation Flow

Status: Partially reviewed, not production-ready until current-value blockers are fixed.

Proven locally:

- GA4 Benchmark list display calls the platform Benchmark route with `platformType=google_analytics`.
- create and update success paths invalidate the GA4 Benchmark query and refresh notification queries.
- delete success path invalidates the GA4 Benchmark query and refreshes notifications.
- the create modal requires Benchmark name and Benchmark value before save.
- visible ROAS values use the GA4 financial ratio model.
- template tiles expose ROAS as a ratio-style Benchmark.
- Benchmark CPA data sufficiency already requires both conversions and spend.

Known issue:

- the default ROAS description still says `as a %` in helper text when a description is generated from defaults.

Remaining validation after fixes:

- browser validation for create, edit, delete, alert toggle, email toggle, and deep-link highlight on the GA4 `Benchmarks` tab.

### 2. Benchmark Current-Value Calculation

Status: Not production-ready.

Confirmed blocker:

- `server/ga4-kpi-benchmark-jobs.ts` uses `computeRoasPercent` for GA4 Benchmark ROAS.
- GA4 docs and the visible GA4 page use ROAS as `Revenue / Spend` ratio.
- Persisted Benchmark `currentValue` for ROAS is therefore 100 times the intended ratio.

Impact:

- Benchmark card display can look correct because the UI recomputes live values.
- persisted Benchmark rows can be wrong.
- Benchmark history can be wrong.
- Benchmark alert comparisons can be wrong.
- notification visibility can be wrong.
- immediate and scheduled Benchmark alert email eligibility can be wrong.

### 3. Benchmark Tracker And Threshold Status

Status: Partially production-ready, blocked by current-value defects.

Proven locally:

- shared Benchmark math supports metric-aware thresholds.
- lower-is-better Benchmark direction is handled for cost-style Benchmarks.
- blocked and insufficient Benchmarks are intended to be excluded from tracker counts and average progress.
- CPA Benchmarks require both conversions and spend before scoring.
- focused Benchmark math tests currently pass.

Not fully proven:

- tracker correctness after the persisted ROAS fix, especially where Benchmark rows have stale stored current values or history.

### 4. Benchmark Alerts And Notifications

Status: Implementation mostly traced, but not production-ready until persisted current values are correct.

Proven locally:

- GA4 Benchmark alert action URLs deep-link to `/campaigns/:campaignId/ga4-metrics?tab=benchmarks&highlight=:benchmarkId`.
- GA4 Benchmark alert creation maintains a single active in-app alert row while a breach remains active.
- notification listing rechecks whether the Benchmark row still exists, belongs to the notification campaign, and remains breached.
- delete paths soft-hide related Benchmark notifications.
- immediate and scheduled email alert paths distinguish send attempts with audit rows.
- local alert email scheduler, audit, retry, and idempotency tests pass in the targeted suite.

Current blocker:

- platform GA4 Benchmark alert checks use persisted `currentValue`; ROAS persisted as percent can suppress true below-threshold alerts or create false above-threshold alerts.

Not locally verifiable:

- deployed email provider configuration
- provider delivery events
- inbox receipt
- deployed scheduler runtime

### 5. Refresh, Scheduler, And Recompute

Status: Not production-ready until ROAS and property-scope fixes are complete.

Proven locally:

- GA4 daily refresh calls the GA4 KPI/Benchmark recompute job.
- on-demand GA4 refresh calls the GA4 KPI/Benchmark recompute job.
- auto-refresh paths call recompute when upstream sources change.
- Benchmark create and update paths run alert checks after mutation.

Current blockers:

- all recompute paths propagate the ROAS percent-vs-ratio persisted value bug.
- changing the primary GA4 property can leave the frontend selected property on the old property while server recompute uses the new primary property.
- `setPrimaryGA4Connection` updates the selected connection by ID without requiring that the connection belongs to the campaign whose primary connection is being changed.

### 6. Ownership And Scoping

Status: Partially reviewed.

Proven locally:

- current GA4 platform Benchmark list requires campaign access before returning rows.
- current GA4 Benchmark create through `/api/benchmarks` requires campaign access.
- current GA4 Benchmark update/delete paths use `ensureBenchmarkAccess`.
- storage methods fetch platform Benchmarks by exact platform and campaign when campaignId is supplied.
- delete paths soft-hide related notifications.

Partially reviewed shared route:

- the later shared `/api/campaigns/:id/benchmarks/evaluated` route reads campaign Benchmarks before an obvious campaign-access guard in that route.
- the current GA4 Benchmark page does not call that route.
- this should still be hardened before calling shared Benchmark production readiness complete, because it is a Benchmark route that can expose campaign Benchmark data.

Confirmed scoping issue outside the Benchmark CRUD route itself:

- GA4 primary-property storage update is not campaign-scoped by target connection.
- This can corrupt which property server recompute uses for Benchmark values.

### 7. Existing Damaged Data

Status: Bounded cleanup path implemented locally; production row inventory and application are not locally verifiable until the maintenance script is run against the target database.

Confirmed damage boundary:

- existing GA4 platform Benchmark rows with ROAS current values may have persisted percent values.
- existing auto-created Benchmark history rows for GA4 ROAS may also contain percent values.

Implemented cleanup boundary:

- `server/ga4-roas-persisted-cleanup.ts` is dry-run by default and must be run with `--apply` only after reviewing the inventory.
- current GA4 platform ROAS Benchmark rows are selected only when `platformType = google_analytics` and `metric` or `name` is exactly `ROAS`; they are recomputed from the campaign's current primary GA4 property, latest persisted GA4 daily date, active GA4-context imported revenue, and active spend records.
- historical Benchmark history rows are eligible only when `notes` exactly matches `auto:ga4_daily:YYYY-MM-DD` and the campaign has exactly one active GA4 property, because the old history rows did not persist `propertyId`.
- eligible Benchmark history rows are recomputed from persisted source inputs for that exact auto date, including `variance` and `performanceRating`.
- rows without a strict auto note, without persisted source inputs, or with ambiguous historical property scope are left unchanged and reported as skipped.

Required cleanup principle:

- fix the forward path first.
- do not blindly divide all historical ROAS rows by 100.
- correct only rows whose GA4 source boundary is proven, such as GA4 platform ROAS Benchmark rows and auto GA4 daily Benchmark history rows where the source data can be recomputed exactly.
- if exact historical source inputs cannot be proven for a row, document it as legacy suspect data instead of inventing allocation.

## Confirmed Blockers

### BENCH-1: GA4 persisted ROAS uses percent instead of ratio

Root cause:

- `server/ga4-kpi-benchmark-jobs.ts` computes ROAS with `computeRoasPercent`.

Expected:

- GA4 Benchmark ROAS current value must be `Revenue / Spend`, rounded for display and storage as a ratio.

Impact:

- persisted current value
- Benchmark history
- alert decisions
- notification visibility
- immediate email eligibility
- scheduled email eligibility

### BENCH-2: GA4 primary-property storage update is not campaign-scoped by target connection

Root cause:

- `setPrimaryGA4Connection(campaignId, connectionId)` clears primary connections by campaign but updates the target connection by ID only.

Expected:

- the target connection must belong to the campaign before any primary-state mutation.

Impact:

- server recompute can use the wrong primary property.
- one campaign can accidentally or maliciously affect another campaign connection if a stale or foreign connection ID is supplied.

### BENCH-3: GA4 page can keep old selected property after Set as Primary

Root cause:

- the page only falls back to primary when the current selected property no longer exists.
- setting another existing property as primary does not update `selectedGA4PropertyId`.

Expected:

- after successful Set as Primary, the visible selected property and server primary property should align.

Impact:

- visible Benchmark values and persisted recompute/alert values can temporarily reference different properties.

### BENCH-4: ROAS default copy still says percent

Root cause:

- Benchmark default description text still says `Revenue generated per dollar of spend (as a %)`.

Expected:

- ROAS copy must describe an `x` ratio.

Impact:

- user-created Benchmark descriptions can persist misleading unit semantics.

### BENCH-5: Shared evaluated Benchmark route needs access hardening

Root cause:

- the later shared `/api/campaigns/:id/benchmarks/evaluated` route reads campaign Benchmark rows before an obvious route-level campaign-access guard.

Expected:

- all Benchmark routes that expose campaign Benchmark data must prove campaign access before storage reads.

Impact:

- not currently proven as a GA4 page caller issue, but it blocks shared Benchmark route readiness.

### BENCH-6: Existing persisted ROAS data needs bounded cleanup

Root cause:

- old recompute runs may already have written percent ROAS values.

Expected:

- forward path fixed first, then exact-source cleanup or explicit legacy-data caveat.

Impact:

- even after code is fixed, old rows may continue to mislead history/trends until cleaned or marked.

## Required Fix Queue

### Commit 1 - Fix GA4 ROAS persisted current values

Files:

- `server/ga4-kpi-benchmark-jobs.ts`
- `server/ga4-cross-tab-consistency.test.ts`
- a focused GA4 KPI/Benchmark recompute or alert regression test

Required behavior:

- GA4 KPI and Benchmark ROAS current values persist as `Revenue / Spend`.
- ROI remains percent.
- CPA remains `Spend / Conversions`.
- shared `computeRoasPercent` can remain unchanged for callers that explicitly need percent semantics.

Validation:

- direct unit/regression test for `computeKpiValue("ROAS", { revenue: 1000, spend: 100 }) === 10`
- alert regression proving a below-threshold ROAS Benchmark with current `2.5` and threshold `3.0` breaches
- targeted KPI/Benchmark test suite

### Commit 2 - Scope GA4 Set as Primary by campaign

Files:

- `server/storage.ts`
- route/storage regression test

Required behavior:

- target connection must be found with both `campaignId` and `connectionId` before clearing primary flags.
- update statement must require both `id` and `campaignId`.
- if the target connection does not belong to the campaign, return false and do not clear current campaign primary state.

Validation:

- regression test for foreign connection ID
- manual route validation where setting a valid property still succeeds

### Commit 3 - Keep selected property aligned after Set as Primary

Files:

- `client/src/pages/ga4-metrics.tsx`
- focused UI/source-state regression if available

Required behavior:

- successful Set as Primary updates `selectedGA4PropertyId` to the selected connection's property ID.
- GA4 daily, to-date, diagnostics, and breakdown queries refetch for that property.

Validation:

- browser validation with two GA4 properties connected to one campaign
- confirm Benchmark visible values and primary-property label reference the same property after the action

### Commit 4 - Fix Benchmark ROAS copy

Files:

- `client/src/pages/ga4-metrics.tsx`
- optional text regression

Required behavior:

- default ROAS descriptions say ratio or `x`, not percent.

Validation:

- create Benchmark modal text check
- saved blank-description ROAS Benchmark does not persist percent wording

### Commit 5 - Harden shared evaluated Benchmark access

Files:

- `server/routes-oauth.ts`
- route isolation regression test

Required behavior:

- the later `/api/campaigns/:id/benchmarks/evaluated` route must validate campaign access before any `storage.getCampaignBenchmarks(campaignId)` call.
- response shape remains unchanged for authorized callers.

Validation:

- unauthorized actor cannot read another campaign's evaluated Benchmarks.
- authorized caller receives the same response shape as before.

### Commit 6 - Existing GA4 ROAS data cleanup plan

Files:

- `server/ga4-roas-persisted-cleanup.ts`
- `server/ga4-kpi-benchmark-roas-regression.test.ts`
- documentation update in this file

Required behavior:

- recompute current ROAS values for exact GA4 platform Benchmark rows after Commit 1, using persisted GA4 daily facts, active GA4-context imported revenue, and active spend records.
- correct auto GA4 daily ROAS Benchmark history rows only where the row has a strict `auto:ga4_daily:YYYY-MM-DD` note and the campaign has exactly one active GA4 property.
- recompute corrected Benchmark history row `variance` and `performanceRating` from the repaired current value and the row's stored `benchmarkValue`.
- leave unprovable legacy rows unchanged with a documented skip reason.
- default to dry-run inventory; mutate only when run with `--apply`.

Validation:

- `npm test -- server/ga4-kpi-benchmark-roas-regression.test.ts`
- `npm run check`
- dry-run inventory command against the target database: `tsx server/ga4-roas-persisted-cleanup.ts`
- apply command only after inventory review: `tsx server/ga4-roas-persisted-cleanup.ts --apply`
- before/after row counts, sample affected rows, and skipped-row reasons from the script output

### Commit 7 - Readiness documentation flip

Files:

- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- possibly `GA4/README.md`

Required behavior:

- update `Durable Future Answer` only after Commits 1-6 are complete and validated.
- include exact validation commands and manual/deployed evidence still outstanding.

## Validation Evidence

Local validation run during the June 27, 2026 audit:

`npm test -- server/kpi-math.test.ts server/benchmark-math.test.ts server/revenue-additivity.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-retry-regression.test.ts server/alert-email-idempotency-regression.test.ts`

Result:

- 13 test files passed
- 238 tests passed

Important limitation:

- this green suite does not prove production readiness because `server/ga4-cross-tab-consistency.test.ts` currently encodes old percent ROAS expectations.

Commit 6 implementation validation on June 27, 2026:

- `npm test -- server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts`
- Result: 3 test files passed, 27 tests passed.
- `npm run check`
- Result: TypeScript check passed.
- `npx tsx --env-file=.env server/ga4-roas-persisted-cleanup.ts`
- Result: dry-run only, no `--apply`; 46 candidate repairs reported and 56 skipped campaign-level reasons reported.
- Dry-run sample: one GA4 ROAS KPI current row would change from `60926.4` to `127.35`; auto GA4 daily KPI progress rows for the same campaign would change from percent-style values such as `60926.4` to ratio values such as `127.35`.
- No data was mutated during this validation.
Out-of-scope note:

- a broader run including `server/alert-email-delivery-regression.test.ts` produced one report-scheduler string-guard failure.
- Reports are explicitly out of this Benchmark audit scope unless a Benchmark path directly depends on that failure.

## Not Locally Verifiable

The following require deployed or provider evidence:

- live GA4 API token refresh behavior
- live GA4 processing latency
- deployed scheduler execution timing
- provider-side email delivery events
- actual inbox receipt
- reviewed production `--apply` run, before/after row counts, and rollback/no-op evidence for existing damaged ROAS rows

These are not reasons to ignore local blockers. They are separate caveats after local blockers are fixed.

## Future Platform Template

Before copying GA4 Benchmarks to Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration, prove each item below for the new platform:

- source connection and account/property/campaign scoping are explicit
- current-value UI path and persisted recompute path use the same metric units
- ROAS, ROI, CPA, rates, counts, and currency values have documented unit semantics
- lower-is-better metrics are identified in shared math, not UI-only logic
- missing dependencies block scoring instead of writing misleading zero values
- scheduler/reprocess path updates persisted current values before alert checks
- alerts read the same values that cards/report outputs explain
- notification action URLs open the correct campaign, platform tab, and highlighted item
- create/update/delete routes prove campaign ownership before mutation
- delete routes soft-hide related notifications without hard-deleting unrelated history
- shared evaluated Benchmark routes prove campaign access before storage reads
- existing damaged data has a bounded cleanup plan
- local tests cover the platform's own source model rather than copying GA4 fixtures blindly

Do not certify another platform source as Benchmark production-ready just because GA4 Benchmarks are eventually certified. Each platform needs its own source, scope, recompute, alert, notification, and cleanup proof.
