# GA4 Benchmarks Production Readiness

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Benchmarks` tab.

Use this file when asked whether GA4 Benchmarks are robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration.

`GA4/BENCHMARKS.md` defines what the Benchmark tab is supposed to do.

This file defines whether the current implementation is production-ready, what has been proven, what is only partially reviewed, what is not locally verifiable, and the completed fix queue behind the durable answer.

## Durable Future Answer

As of June 27, 2026, GA4 Benchmarks are production-ready for the current GA4 code scope.

Commits 1-6 in this file have been implemented, committed, pushed, deployed, and UI validation passed. The GA4 ROAS persisted cleanup script was applied after a matching dry-run:

- pre-apply dry-run: 46 repair candidates and 56 skipped campaign-level reasons
- apply: 46 persisted ROAS rows updated
- post-apply dry-run: 0 remaining repair candidates
- skipped rows were left untouched because they lacked an active GA4 primary property or lacked persisted GA4 daily rows for the current primary property

The durable answer is:

`GA4 Benchmarks are production-ready for the current GA4 code scope. Remaining caveats are external or deployed-runtime evidence caveats listed in GA4/BENCHMARKS_PRODUCTION_READINESS.md, not local GA4 Benchmark implementation blockers.`

This answer should change only if later code changes, failed validation, contradictory deployed evidence, or changed requirements reopen a Benchmark path.

This answer should not change merely because:

- `GA4/BENCHMARKS.md` describes the intended product behavior
- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md` validates metric-aware threshold math
- the visible Benchmark cards look correct in the browser
- one local test suite is green
- another platform source copies the GA4 Benchmark pattern without its own source/scope/recompute proof

## How To Use This File In A New Chat

Read in this order:

1. `Durable Future Answer`
2. `Current Scope`
3. `Resolved Blockers`
4. `Completed Fix Queue`
5. `Validation Evidence`
6. `Future Platform Template`

Answer that GA4 Benchmarks are production-ready for the current GA4 code scope, subject only to the explicit external/deployed caveats in this file.

Do not reopen GA4 Ad Comparison or GA4 Reports when answering Benchmark readiness unless a Benchmark code path directly references those sections.

## Future Source Reading Order

Use this order when adapting the GA4 Benchmark model to Meta, Google Ads, LinkedIn, Google Sheets, or another source:

1. Read `GA4/BENCHMARKS.md` for the functional tab contract: visible workflow, metric options, current-value behavior, gating, alerts, delete behavior, and refresh expectations.
2. Read this file for the whole-tab readiness method: lifecycle paths proven, completed blockers, validation evidence, caveats, and future-platform gates.
3. Read `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md` only as the historical threshold/scoring appendix.
4. Create or update a source-specific readiness file for the target platform. Do not treat GA4 evidence as proof that Meta, Google Ads, LinkedIn, Google Sheets, or another source is production-ready.

Stable file roles:

- `GA4/BENCHMARKS.md` = what the GA4 Benchmark tab does
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md` = whether GA4 Benchmarks are production-ready and how to prove a future source
- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md` = historical threshold/scoring slice only

For a future source, prove source identity, account/property/customer scoping, selected campaign/ad set/ad group scope, current-value UI path, persisted recompute path, threshold policy, alert and notification path, scheduler/reprocess path, ownership checks, delete behavior, shared evaluated-route access, report consumers, and existing-data cleanup boundary before calling that source's Benchmarks production-ready.

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

The later audit traced the scheduler-persisted current-value path and found a separate defect: GA4 Benchmark ROAS is displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persisted ROAS as a percent. Platform GA4 alert checks read persisted values, so the defect affected alerts, notification visibility, email eligibility, Benchmark history, and downstream consumers that rely on persisted Benchmark rows.

That defect and the related property-scope, ROAS copy, shared evaluated-route access, and existing-data cleanup blockers have now been fixed through the completed queue below.

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

Status: Production-ready for the current GA4 code scope.

Proven locally:

- GA4 Benchmark list display calls the platform Benchmark route with `platformType=google_analytics`.
- create and update success paths invalidate the GA4 Benchmark query and refresh notification queries.
- delete success path invalidates the GA4 Benchmark query and refreshes notifications.
- the create modal requires Benchmark name and Benchmark value before save.
- visible ROAS values use the GA4 financial ratio model.
- template tiles expose ROAS as a ratio-style Benchmark.
- Benchmark CPA data sufficiency already requires both conversions and spend.

Resolved issue:

- the default ROAS description no longer says `as a %` in helper text when a description is generated from defaults.

Validation completed:

- deployed UI validation passed for the completed fix queue.
- browser validation covered the GA4 `Benchmarks` tab paths affected by Commits 1-6.

### 2. Benchmark Current-Value Calculation

Status: Production-ready for the current GA4 code scope.

Resolved blocker:

- Before Commit 1, `server/ga4-kpi-benchmark-jobs.ts` used `computeRoasPercent` for GA4 Benchmark ROAS.
- GA4 docs and the visible GA4 page use ROAS as `Revenue / Spend` ratio.
- Before Commit 1, persisted Benchmark `currentValue` for ROAS could be 100 times the intended ratio.

Former impact:

- Benchmark card display could look correct because the UI recomputed live values.
- persisted Benchmark rows could be wrong.
- Benchmark history could be wrong.
- Benchmark alert comparisons could be wrong.
- notification visibility could be wrong.
- immediate and scheduled Benchmark alert email eligibility could be wrong.

### 3. Benchmark Tracker And Threshold Status

Status: Production-ready for the current GA4 code scope.

Proven locally:

- shared Benchmark math supports metric-aware thresholds.
- lower-is-better Benchmark direction is handled for cost-style Benchmarks.
- blocked and insufficient Benchmarks are intended to be excluded from tracker counts and average progress.
- CPA Benchmarks require both conversions and spend before scoring.
- focused Benchmark math tests currently pass.

Resolved validation:

- tracker correctness was validated after the persisted ROAS fix and ROAS cleanup.

### 4. Benchmark Alerts And Notifications

Status: Production-ready for local and in-app behavior in the current GA4 code scope. Provider delivery evidence remains an external caveat.

Proven locally:

- GA4 Benchmark alert action URLs deep-link to `/campaigns/:campaignId/ga4-metrics?tab=benchmarks&highlight=:benchmarkId`.
- GA4 Benchmark alert creation maintains a single active in-app alert row while a breach remains active.
- notification listing rechecks whether the Benchmark row still exists, belongs to the notification campaign, and remains breached.
- delete paths soft-hide related Benchmark notifications.
- immediate and scheduled email alert paths distinguish send attempts with audit rows.
- local alert email scheduler, audit, retry, and idempotency tests pass in the targeted suite.

Resolved blocker:

- platform GA4 Benchmark alert checks use persisted `currentValue`; persisted ROAS now uses the same ratio semantics as the visible GA4 Benchmark cards.

Not locally verifiable:

- deployed email provider configuration
- provider delivery events
- inbox receipt
- deployed scheduler runtime

### 5. Refresh, Scheduler, And Recompute

Status: Production-ready for the current GA4 code scope. Deployed scheduler timing remains an external runtime caveat.

Proven locally:

- GA4 daily refresh calls the GA4 KPI/Benchmark recompute job.
- on-demand GA4 refresh calls the GA4 KPI/Benchmark recompute job.
- auto-refresh paths call recompute when upstream sources change.
- Benchmark create and update paths run alert checks after mutation.

Resolved blockers:

- all recompute paths now persist ROAS as a ratio for GA4 KPI and Benchmark rows.
- after Set as Primary, the frontend selected property is aligned with the new primary property.
- `setPrimaryGA4Connection` requires the target connection to belong to the campaign before primary-state mutation.

### 6. Ownership And Scoping

Status: Production-ready for the current GA4 Benchmark code scope.

Proven locally:

- current GA4 platform Benchmark list requires campaign access before returning rows.
- current GA4 Benchmark create through `/api/benchmarks` requires campaign access.
- current GA4 Benchmark update/delete paths use `ensureBenchmarkAccess`.
- storage methods fetch platform Benchmarks by exact platform and campaign when campaignId is supplied.
- delete paths soft-hide related notifications.

Resolved shared route:

- the later shared `/api/campaigns/:id/benchmarks/evaluated` route validates campaign access before storage reads.
- the current GA4 Benchmark page does not call that route.
- this route was hardened before calling shared Benchmark production readiness complete, because it is a Benchmark route that can expose campaign Benchmark data.

Resolved scoping issue outside the Benchmark CRUD route itself:

- GA4 primary-property storage update is now campaign-scoped by target connection.
- server recompute and visible selected property are aligned after the Set as Primary action.

### 7. Existing Damaged Data

Status: Cleanup applied and verified against the target database.

Confirmed damage boundary:

- existing GA4 platform Benchmark rows with ROAS current values may have persisted percent values.
- existing auto-created Benchmark history rows for GA4 ROAS may also contain percent values.

Implemented and applied cleanup boundary:

- `server/ga4-roas-persisted-cleanup.ts` is dry-run by default and was run with `--apply` only after the dry-run inventory matched the documented boundary.
- current GA4 platform ROAS Benchmark rows are selected only when `platformType = google_analytics` and `metric` or `name` is exactly `ROAS`; they are recomputed from the campaign's current primary GA4 property, latest persisted GA4 daily date, active GA4-context imported revenue, and active spend records.
- historical Benchmark history rows are eligible only when `notes` exactly matches `auto:ga4_daily:YYYY-MM-DD` and the campaign has exactly one active GA4 property, because the old history rows did not persist `propertyId`.
- eligible Benchmark history rows are recomputed from persisted source inputs for that exact auto date, including `variance` and `performanceRating`.
- rows without a strict auto note, without persisted source inputs, or with ambiguous historical property scope are left unchanged and reported as skipped.

Completed cleanup principle:

- fix the forward path first.
- do not blindly divide all historical ROAS rows by 100.
- corrected only rows whose GA4 source boundary was proven, such as GA4 platform ROAS Benchmark rows and auto GA4 daily Benchmark history rows where the source data could be recomputed exactly.
- skipped rows were left untouched where exact source inputs could not be proven.

## Resolved Blockers

All blockers below were resolved by Commits 1-6, deployed, UI-validated, and followed by the applied ROAS persisted cleanup.

### BENCH-1: GA4 persisted ROAS used percent instead of ratio

Root cause:

- `server/ga4-kpi-benchmark-jobs.ts` computed ROAS with `computeRoasPercent`.

Expected:

- GA4 Benchmark ROAS current value must be `Revenue / Spend`, rounded for display and storage as a ratio.

Former impact:

- persisted current value
- Benchmark history
- alert decisions
- notification visibility
- immediate email eligibility
- scheduled email eligibility

Resolved by:

- Commit 1 fixed the forward persisted ROAS calculation.
- Commit 6 applied the bounded cleanup to existing safely identifiable GA4 ROAS rows.

### BENCH-2: GA4 primary-property storage update was not campaign-scoped by target connection

Root cause:

- `setPrimaryGA4Connection(campaignId, connectionId)` cleared primary connections by campaign but updated the target connection by ID only.

Expected:

- the target connection must belong to the campaign before any primary-state mutation.

Former impact:

- server recompute could use the wrong primary property.
- one campaign could accidentally or maliciously affect another campaign connection if a stale or foreign connection ID was supplied.

Resolved by:

- Commit 2 scoped Set as Primary by both campaign and connection.

### BENCH-3: GA4 page could keep old selected property after Set as Primary

Root cause:

- the page only fell back to primary when the current selected property no longer existed.
- setting another existing property as primary did not update `selectedGA4PropertyId`.

Expected:

- after successful Set as Primary, the visible selected property and server primary property should align.

Former impact:

- visible Benchmark values and persisted recompute/alert values could temporarily reference different properties.

Resolved by:

- Commit 3 aligned selected property state after Set as Primary.

### BENCH-4: ROAS default copy said percent

Root cause:

- Benchmark default description text said `Revenue generated per dollar of spend (as a %)`.

Expected:

- ROAS copy must describe an `x` ratio.

Former impact:

- user-created Benchmark descriptions could persist misleading unit semantics.

Resolved by:

- Commit 4 fixed GA4 ROAS default copy.

### BENCH-5: Shared evaluated Benchmark route needed access hardening

Root cause:

- the later shared `/api/campaigns/:id/benchmarks/evaluated` route read campaign Benchmark rows before an obvious route-level campaign-access guard.

Expected:

- all Benchmark routes that expose campaign Benchmark data must prove campaign access before storage reads.

Former impact:

- it was not proven as a GA4 page caller issue, but it blocked shared Benchmark route readiness.

Resolved by:

- Commit 5 hardened shared evaluated Benchmark access.

### BENCH-6: Existing persisted ROAS data needed bounded cleanup

Root cause:

- old recompute runs may have written percent ROAS values.

Expected:

- forward path fixed first, then exact-source cleanup or explicit legacy-data caveat.

Former impact:

- before cleanup, old rows could continue to mislead history/trends until cleaned or marked.

Resolved by:

- Commit 6 added the bounded cleanup script and the script was applied after matching dry-run evidence.

## Completed Fix Queue

All items in this queue are complete. Commits 1-6 were implemented, committed, pushed, deployed, and UI validation passed. Commit 7 is this documentation flip.

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
- `GA4/KPIS_PRODUCTION_READINESS.md`

Completed behavior:

- updated `Durable Future Answer` after Commits 1-6 were completed, deployed, UI-validated, and the ROAS persisted cleanup was applied.
- included exact validation commands, cleanup row counts, skipped-row reasons, and remaining external/deployed caveats.

## Validation Evidence

Local validation run during the June 27, 2026 audit:

`npm test -- server/kpi-math.test.ts server/benchmark-math.test.ts server/revenue-additivity.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-retry-regression.test.ts server/alert-email-idempotency-regression.test.ts`

Result:

- 13 test files passed
- 238 tests passed

Historical limitation from the initial audit:

- this green suite did not prove production readiness at that time because `server/ga4-cross-tab-consistency.test.ts` encoded old percent ROAS expectations before Commit 1.
- production-ready status now relies on the later fix validation, deployment, UI validation, and applied cleanup evidence below.

Commit 1-6 deployment and UI validation on June 27, 2026:

- Commits 1-6 were implemented, committed, pushed, and deployed.
- UI validation passed after deployment for the GA4 KPI and Benchmark readiness fix queue.

Commit 6 implementation validation on June 27, 2026:

- `npm test -- server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts`
- Result: 3 test files passed, 27 tests passed.
- `npm run check`
- Result: TypeScript check passed.
- `npx tsx --env-file=.env server/ga4-roas-persisted-cleanup.ts`
- Result: pre-apply dry-run reported 46 repair candidates and 56 skipped campaign-level reasons.
- Dry-run sample: one GA4 ROAS KPI current row would change from `60926.4` to `127.35`; auto GA4 daily KPI progress rows for the same campaign would change from percent-style values such as `60926.4` to ratio values such as `127.35`.
- `npx tsx --env-file=.env server/ga4-roas-persisted-cleanup.ts --apply`
- Result: apply updated 46 persisted ROAS rows and left the 56 skipped campaign-level reasons untouched.
- `npx tsx --env-file=.env server/ga4-roas-persisted-cleanup.ts`
- Result: post-apply dry-run reported 0 remaining repair candidates and 56 skipped campaign-level reasons.
- Skipped rows were left untouched because they lacked an active GA4 primary property or lacked persisted GA4 daily rows for the current primary property.

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

These are external or deployed-runtime caveats. They are not local GA4 Benchmark implementation blockers after the completed fix queue and applied cleanup.

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
