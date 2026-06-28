# GA4 KPIs Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `KPIs` tab.

Use this file when asked whether GA4 KPIs are robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration.

`GA4/KPIS.md` defines what the KPI tab is supposed to do.

This file defines whether the current implementation is production-ready, what has been proven, what is only partially reviewed, what is not locally verifiable, and the current fix queue required before any future production-ready claim.

## Current Status

As of June 28, 2026, GA4 KPIs are **not production-ready** for the current GA4 code scope.

The June 27, 2026 production-ready statement is retracted for the current code scope. That statement proved a narrower fix queue around ROAS ratio semantics, CPA sufficiency, primary-property scoping, ROAS copy, and bounded ROAS cleanup. It did not prove the complete GA4 KPI value inventory, downstream propagation matrix, source lifecycle matrix, fallback branches, negative cases, and report/alert consumers required by `PRODUCTION_READINESS.md`.

Current local blockers:

- persisted GA4 KPI financial values can use a different revenue/spend source window than the visible KPI tab
- GA4 revenue/spend source add/edit/delete lifecycle paths do not all prove immediate GA4 KPI recompute before alert checks
- custom or unknown GA4 KPI rows can be overwritten to `0` by the GA4 recompute job
- duplicate active GA4 KPI rows for the same campaign and metric do not prove the documented latest-row-wins alert behavior
- scheduled/server GA4 reports read persisted KPI rows and must be included as direct downstream consumers

The current answer is:

`GA4 KPIs are not production-ready for the current GA4 code scope. The section has proven visible formula and threshold slices, but persisted recompute, source lifecycle, custom KPI, duplicate-alert, and scheduled-report paths remain blocked or partially reviewed. Do not call GA4 KPIs production-ready until the current fix queue and evidence gates in this file are complete.`

This status should change only after:

- each current blocker has a minimal code fix
- each fix has regression coverage for the exact value path and negative case
- any existing damaged data has a read-only inventory and a bounded cleanup or explicit legacy-data caveat
- the full `PRODUCTION_READINESS.md` checklist is rerun against the implemented code, not the planned fix queue
- this document is updated from current evidence, not from prior readiness claims

Necessary certification rule:

- completing the current fix queue makes GA4 KPIs eligible for production-readiness certification; it does not by itself make them production-ready
- the final answer must remain `not production-ready` unless the final certification pass proves the complete current value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, and test coverage from current code

## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Current Blockers`
4. `Current Fix Queue`
5. `Validation Evidence And Gaps`
6. `Future Platform Template`

Answer that GA4 KPIs are not production-ready for the current GA4 code scope until the current blocker queue is implemented and validated.

Do not reopen GA4 Overview, Benchmarks, Ad Comparison, Insights, or Reports unless a KPI value path directly depends on them. Scheduled/server GA4 reports are a direct downstream KPI consumer because they read persisted GA4 KPI rows.

## Future Source Reading Order

Use this order when adapting the GA4 KPI model to Meta, Google Ads, LinkedIn, Google Sheets, or another source:

1. Read `GA4/KPIS.md` for the functional tab contract: visible workflow, metric options, current-value behavior, gating, alerts, delete behavior, and refresh expectations.
2. Read this file for the current whole-tab readiness status: current blockers, partially proven paths, validation gaps, historical fixes, caveats, and future-platform gates.
3. Read `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` only as the historical threshold/scoring appendix.
4. Create or update a source-specific readiness file for the target platform. Do not treat GA4 evidence as proof that Meta, Google Ads, LinkedIn, Google Sheets, or another source is production-ready.

Stable file roles:

- `GA4/KPIS.md` = what the GA4 KPI tab does
- `GA4/KPIS_PRODUCTION_READINESS.md` = whether GA4 KPIs are production-ready and how to prove a future source
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` = historical threshold/scoring slice only

For a future source, prove source identity, account/property/customer scoping, selected campaign/ad set/ad group scope, current-value UI path, persisted recompute path, threshold policy, alert and notification path, scheduler/reprocess path, ownership checks, delete behavior, report consumers, and existing-data cleanup boundary before calling that source's KPIs production-ready.

## Current Scope

This audit applies to the current GA4 `KPIs` tab for:

- platform-scoped GA4 KPI create, edit, delete, and list display
- KPI current-value calculation for GA4 platform KPIs
- KPI tracker summary counts and average progress
- KPI blocked and insufficient-data handling
- KPI alert and notification visibility
- KPI alert email eligibility and local audit behavior
- GA4 refresh, daily scheduler, and on-demand recompute paths that update KPI current values and KPI progress history
- GA4 campaign, property, source, and campaign-access scoping that can affect KPI values

This audit does not automatically certify:

- Meta KPIs
- Google Ads KPIs
- LinkedIn KPIs
- Google Sheets KPIs
- custom-upload KPIs
- campaign-level KPI pages except where they consume GA4 values
- provider-side email delivery
- live GA4 API behavior outside what local code and tests can prove

## Root Cause Of Prior Confusion

Earlier KPI readiness notes certified narrower slices:

- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` covers metric-aware threshold math and visible KPI scoring behavior.
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` covers much of the in-app and email alert implementation.
- `GA4/KPIS.md` defines the product contract and expected tab behavior.

Those files did not fully certify the whole KPI production lifecycle.

The later audit traced the scheduler-persisted current-value path and found a separate defect: GA4 KPI ROAS is displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persisted ROAS as a percent. Platform GA4 alert checks read persisted values, so the defect affected alerts, notification visibility, email eligibility, KPI progress history, and downstream consumers that rely on persisted KPI rows.

That defect and the related property-scope, CPA sufficiency, ROAS copy, shared Benchmark access, and existing-data cleanup blockers have now been fixed through the completed queue below.

This file exists so future reviews do not confuse threshold readiness with whole-tab production readiness.

## Non-Negotiable Accuracy Rules

GA4 KPIs must preserve:

- campaign ownership and campaign access checks
- GA4 property scoping
- selected GA4 campaign/source scoping
- imported revenue additivity
- spend-source provenance
- ROAS as an `x` ratio, not a percent
- ROI as a percent
- CPA as currency
- metric-aware KPI status classification
- blocked and insufficient-data exclusion from tracker counts and average progress
- one active in-app notification row per active GA4 KPI breach
- email provider acceptance vs confirmed delivery semantics
- stable API response shapes

Do not change KPI calculations, alert semantics, source ownership, scheduler behavior, or response shapes unless the exact code path has been traced.

## Data Path Summary

Visible UI current-value path:

`GA4 property/source selection -> GA4 daily/to-date API responses -> frontend financial/current-value model -> KPI cards and tracker`

Persisted production path:

`GA4 daily refresh or on-demand refresh -> server/ga4-kpi-benchmark-jobs.ts -> storage.updateKPI(currentValue) -> KPI progress history -> checkPerformanceAlerts() -> in-app notification and email alert decisions`

Important meaning:

- visible cards and persisted alert state are separate paths
- both paths must use the same unit semantics
- a correct visible KPI card does not prove scheduler, notification, or email correctness
- a green threshold test does not prove current-value provenance correctness

## Current Production-Readiness Map

### 1. KPI Tab UI And Creation Flow

Status: Partially reviewed. The visible GA4 KPI create/edit/delete UI flow is locally traced, but create/update side effects still depend on blocked persisted recompute paths.

Proven locally:

- GA4 KPI create/update/delete calls the platform KPI routes with `platformType=google_analytics`.
- create and update success paths invalidate the GA4 KPI query and refresh notification queries.
- the create modal requires KPI name and target before save.
- visible ROAS values use the GA4 financial ratio model.
- template tiles expose ROAS as a ratio-style KPI.

Resolved issue:

- the default ROAS description no longer says `as a %` in helper text when a description is generated from defaults.

Historical validation:

- deployed UI validation passed for the narrower June 27 fix queue.
- browser validation covered only the GA4 `KPIs` tab paths affected by historical Commits 1-6.

### 2. KPI Current-Value Calculation

Status: Not production-ready. Standard visible formulas are partially proven, but persisted financial source windows and custom KPI recompute are blocked.

Resolved blocker:

- Before Commit 1, `server/ga4-kpi-benchmark-jobs.ts` used `computeRoasPercent` for GA4 KPI ROAS.
- GA4 docs and the visible GA4 page use ROAS as `Revenue / Spend` ratio.
- Before Commit 1, persisted KPI `currentValue` for ROAS could be 100 times the intended ratio.

Former impact:

- KPI card display could look correct because the UI recomputed live values.
- persisted KPI rows could be wrong.
- KPI progress history could be wrong.
- KPI alert comparisons could be wrong.
- notification visibility could be wrong.
- immediate and scheduled KPI alert email eligibility could be wrong.

Additional resolved issue:

- Before Commit 2, KPI CPA data sufficiency required conversions but did not require spend.
- Benchmark CPA already requires both conversions and spend.
- Before Commit 2, KPI CPA could be scored as sufficient with conversions present and zero spend, which could produce a misleading `0` CPA.

### 3. KPI Tracker And Threshold Status

Status: Partially reviewed. Shared threshold and sufficiency math is locally covered, but the tracker cannot certify downstream persisted KPI consumers.

Proven locally:

- shared KPI math supports metric-aware thresholds.
- lower-is-better KPI direction is handled for cost-style KPIs.
- blocked and insufficient KPIs are intended to be excluded from tracker counts and average progress.
- focused KPI math tests currently pass.

Resolved validation:

- tracker correctness was validated after the persisted ROAS fix and ROAS cleanup.
- CPA zero-spend insufficiency was fixed and covered by focused KPI math tests.

### 4. KPI Alerts And Notifications

Status: Not production-ready for current local code. In-app alert URL and visibility mechanics are partially proven, but alert decisions consume persisted `currentValue` and duplicate campaign+metric handling is blocked. Provider delivery evidence remains an external caveat.

Proven locally:

- GA4 KPI alert action URLs deep-link to `/campaigns/:campaignId/ga4-metrics?tab=kpis&highlight=:kpiId`.
- GA4 KPI alert creation maintains a single active in-app alert row while a breach remains active.
- notification listing rechecks whether the KPI row still exists, belongs to the notification campaign, and remains breached.
- delete paths soft-hide related KPI notifications.
- immediate and scheduled email alert paths distinguish send attempts with audit rows.
- local alert email scheduler, audit, retry, and idempotency tests pass in the targeted suite.

Historical resolved blocker:

- platform GA4 KPI alert checks use persisted `currentValue`; persisted ROAS now uses the same ratio semantics as the visible GA4 KPI cards.

Current blocker:

- persisted `currentValue` can still be stale or wrong when source windows, custom KPI rows, or duplicate campaign+metric rows are not handled correctly.

Not locally verifiable:

- deployed email provider configuration
- provider delivery events
- inbox receipt
- deployed scheduler runtime

### 5. Refresh, Scheduler, And Recompute

Status: Not production-ready. Daily, on-demand, auto-refresh, and KPI create/update recompute calls exist, but source lifecycle recompute coverage and persisted financial source windows are blocked. Deployed scheduler timing remains an external runtime caveat.

Proven locally:

- GA4 daily refresh calls the GA4 KPI/Benchmark recompute job.
- on-demand GA4 refresh calls the GA4 KPI/Benchmark recompute job.
- auto-refresh paths call recompute when upstream sources change.
- KPI create and update call recompute before checking alerts for GA4 platform KPIs.

Historical resolved blockers:

- all recompute paths now persist ROAS as a ratio for GA4 KPI and Benchmark rows.
- after Set as Primary, the frontend selected property is aligned with the new primary property.
- `setPrimaryGA4Connection` requires the target connection to belong to the campaign before primary-state mutation.

### 6. Ownership And Scoping

Status: Partially reviewed. Platform KPI CRUD ownership/scoping is locally traced; source lifecycle paths and downstream persisted consumers remain outside that proof.

Proven locally:

- current GA4 platform KPI list requires campaign access before returning rows.
- current GA4 platform KPI create requires campaign access.
- current GA4 platform KPI update/delete use `ensureKpiAccess` and verify platform type.
- storage methods fetch platform KPIs by exact platform and campaign when campaignId is supplied.

Resolved scoping issue outside the KPI CRUD route itself:

- GA4 primary-property storage update is now campaign-scoped by target connection.
- server recompute and visible selected property are aligned after the Set as Primary action.

### 7. Existing Damaged Data

Status: Partially reviewed. The prior ROAS cleanup was applied for a narrower historical bug boundary; a new read-only inventory is required for the current blockers before any cleanup is proposed.

Confirmed damage boundary:

- existing GA4 platform KPI rows with ROAS current values may have persisted percent values.
- existing auto-created KPI progress rows for GA4 ROAS may also contain percent values.

Implemented and applied cleanup boundary:

- `server/ga4-roas-persisted-cleanup.ts` is dry-run by default and was run with `--apply` only after the dry-run inventory matched the documented boundary.
- current GA4 platform ROAS KPI rows are selected only when `platformType = google_analytics` and `metric` or `name` is exactly `ROAS`; they are recomputed from the campaign's current primary GA4 property, latest persisted GA4 daily date, active GA4-context imported revenue, and active spend records.
- historical KPI progress rows are eligible only when `notes` exactly matches `auto:ga4_daily:YYYY-MM-DD` and the campaign has exactly one active GA4 property, because the old progress rows did not persist `propertyId`.
- eligible KPI progress rows are recomputed from persisted source inputs for that exact auto date, including rolling averages and trend direction.
- rows without a strict auto note, without persisted source inputs, or with ambiguous historical property scope are left unchanged and reported as skipped.

Completed cleanup principle:

- fix the forward path first.
- do not blindly divide all historical ROAS rows by 100.
- corrected only rows whose GA4 source boundary was proven, such as GA4 platform ROAS KPI rows and auto GA4 daily progress rows where the source data could be recomputed exactly.
- skipped rows were left untouched where exact source inputs could not be proven.

## Current Blockers

These blockers are current local implementation blockers. They supersede the older production-ready status and must be fixed before the GA4 KPIs tab can be certified again.

### KPI-BLOCKER-1: Persisted financial source window can diverge from visible KPI values

Root cause:

- the visible GA4 KPI tab reads imported revenue and spend through today's active source records
- `server/ga4-kpi-benchmark-jobs.ts` sums imported revenue and spend only through the GA4 job report date, which usually defaults to yesterday

Affected paths:

- persisted `kpis.currentValue` for Revenue, ROAS, ROI, and CPA
- KPI progress history and rolling averages
- in-app alert decisions and notification visibility
- immediate and scheduled KPI alert email eligibility
- scheduled/server GA4 report KPI rows

Required evidence before closure:

- regression test where a current-day spend record changes persisted ROAS, ROI, and CPA
- regression test where a current-day GA4-context revenue record changes persisted Revenue, ROAS, and ROI
- proof that GA4 native completed-day windows remain unchanged while imported financial source windows match the visible KPI tab contract

### KPI-BLOCKER-2: GA4 source lifecycle recompute is incomplete

Root cause:

- the shared `recomputeCampaignDerivedValues` helper refreshes LinkedIn KPI rows and alert checks, not GA4 KPI rows
- several GA4 revenue source paths call that helper before returning
- several GA4 spend source paths recalculate campaign spend but do not prove immediate GA4 KPI recompute and alert reconciliation

Affected paths:

- revenue source add/edit/delete
- spend source add/edit/delete
- alert checks immediately after source changes
- frontend refetches after source mutations

Required evidence before closure:

- source lifecycle matrix covering add, edit, delete, refresh, scheduler, source modal/list display, totals recompute, persisted KPI recompute, alerts, notifications, and reports
- route-level or integration-style regression tests proving GA4 KPI recompute happens before alert checks where the route promises immediate correctness

### KPI-BLOCKER-3: Custom or unknown GA4 KPI rows can be overwritten to zero

Root cause:

- `computeKpiValue` returns `0` for an unknown metric or custom KPI name
- the GA4 KPI recompute job writes that value back to `kpis.currentValue` and can create progress history from the guessed zero

Affected paths:

- GA4 custom KPI tile rows
- legacy GA4 KPI rows with names or metrics outside the standard template set
- alerts, notifications, emails, history, and scheduled reports for those rows

Required evidence before closure:

- recompute skips unsupported/custom rows instead of writing `0`
- tests prove custom current values are preserved across scheduler, create/update recompute, and report preflight recompute
- alert behavior for custom rows is explicitly documented as stored-value based or unsupported

### KPI-BLOCKER-4: Duplicate GA4 KPI latest-row-wins alert behavior is unproven

Root cause:

- current in-app alert dedupe is keyed by `kpiId`
- `GA4/KPIS.md` requires duplicate active GA4 KPIs for the same campaign and metric to use the latest row and avoid competing alerts

Affected paths:

- alert creation and resolution
- notification listing and visible alert dedupe
- immediate and scheduled email eligibility

Required evidence before closure:

- regression test with two active GA4 KPI rows for the same campaign and metric
- proof only the latest row can create or keep the active breach alert
- proof older duplicate alerts are resolved or suppressed without deleting KPI history

### KPI-BLOCKER-5: Scheduled/server report consumers were under-scoped

Root cause:

- browser-generated GA4 reports use live frontend KPI values
- scheduled/server GA4 reports read persisted `platformKPIs` rows and therefore depend on persisted recompute correctness
- the previous readiness document treated Reports as out of scope unless reopened, but this is a direct downstream KPI value path

Affected paths:

- scheduled GA4 PDF KPI tables
- report scheduler pre-send recompute
- report snapshot/audit values that represent KPI current values

Required evidence before closure:

- tests or trace proving scheduled/server reports use corrected persisted KPI values after recompute
- negative-case coverage where recompute fails or skips unsupported/custom KPI rows without producing misleading report values

## Historical Resolved Blockers

The historical blockers below were resolved by the June 27, 2026 Commits 1-6, deployed, UI-validated, and followed by the applied ROAS persisted cleanup. They remain useful background, but they do not certify the current GA4 KPI tab.

### KPI-1: GA4 persisted ROAS used percent instead of ratio

Root cause:

- `server/ga4-kpi-benchmark-jobs.ts` computed ROAS with `computeRoasPercent`.

Expected:

- GA4 KPI ROAS current value must be `Revenue / Spend`, rounded for display and storage as a ratio.

Former impact:

- persisted current value
- KPI progress history
- alert decisions
- notification visibility
- immediate email eligibility
- scheduled email eligibility

Resolved by:

- Commit 1 fixed the forward persisted ROAS calculation.
- Commit 6 applied the bounded cleanup to existing safely identifiable GA4 ROAS rows.

### KPI-2: KPI CPA sufficiency omitted spend

Root cause:

- `resolveKpiDataSufficiency` checked CPA conversions but did not check CPA spend.

Expected:

- CPA KPIs need both conversions and spend before scoring.

Former impact:

- zero-spend CPA KPIs could be scored instead of marked insufficient.

Resolved by:

- Commit 2 fixed KPI CPA spend sufficiency.

### KPI-3: GA4 primary-property storage update was not campaign-scoped by target connection

Root cause:

- `setPrimaryGA4Connection(campaignId, connectionId)` cleared primary connections by campaign but updated the target connection by ID only.

Expected:

- the target connection must belong to the campaign before any primary-state mutation.

Former impact:

- server recompute could use the wrong primary property.
- one campaign could accidentally or maliciously affect another campaign connection if a stale or foreign connection ID was supplied.

Resolved by:

- Commit 3 scoped Set as Primary by both campaign and connection.

### KPI-4: GA4 page could keep old selected property after Set as Primary

Root cause:

- the page only fell back to primary when the current selected property no longer existed.
- setting another existing property as primary did not update `selectedGA4PropertyId`.

Expected:

- after successful Set as Primary, the visible selected property and server primary property should align.

Former impact:

- visible KPI values and persisted recompute/alert values could temporarily reference different properties.

Resolved by:

- Commit 4 aligned selected property state after Set as Primary.

### KPI-5: ROAS default copy said percent

Root cause:

- KPI default description text said `Revenue generated per dollar of spend (as a %)`.

Expected:

- ROAS copy must describe an `x` ratio.

Former impact:

- user-created KPI descriptions could persist misleading unit semantics.

Resolved by:

- Commit 5 fixed GA4 ROAS default copy.

### KPI-6: Existing persisted ROAS data needed bounded cleanup

Root cause:

- old recompute runs may have written percent ROAS values.

Expected:

- forward path fixed first, then exact-source cleanup or explicit legacy-data caveat.

Former impact:

- before cleanup, old rows could continue to mislead history/trends until cleaned or marked.

Resolved by:

- Commit 6 added the bounded cleanup script and the script was applied after matching dry-run evidence.

## Current Fix Queue

Do not implement these changes as one broad refactor. Each commit should be minimal, independently testable, and should preserve the existing GA4 KPI architecture: frontend page flow, platform KPI routes in `server/routes-oauth.ts`, persistence in `server/storage.ts`, shared contracts in `shared/schema.ts`, and scheduler/service behavior in the existing GA4 job files.

### Current Commit 0 - Documentation clarification only

Files:

- `GA4/KPIS_PRODUCTION_READINESS.md`

Required behavior:

- retract the June 27 production-ready claim
- state current status as `not production-ready`
- document current blockers, downstream consumers, validation gaps, and the exact fix queue
- do not change runtime behavior

Validation:

- `git diff -- GA4/KPIS_PRODUCTION_READINESS.md`
- confirm no runtime files changed in this commit

### Current Commit 1 - Align persisted GA4 KPI financial source windows

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- focused GA4 KPI recompute regression test

Required behavior:

- keep GA4 native daily/to-date logic on the intended completed GA4 reporting date
- make imported GA4-context revenue and active spend source totals match the visible KPI tab's source-backed financial window
- preserve ROAS as ratio, ROI as percent, and CPA as spend divided by conversions
- do not broaden source scope beyond the selected campaign and active GA4-context sources

Validation:

- current-day spend record changes persisted ROAS, ROI, and CPA
- current-day GA4-context revenue record changes persisted Revenue, ROAS, and ROI
- zero-spend and zero-revenue dependency behavior remains blocked or insufficient as documented
- scheduled alert checks read the corrected persisted values

### Current Commit 2 - Make GA4 source lifecycle recompute complete

Files expected:

- `server/routes-oauth.ts`
- focused source lifecycle regression test

Required behavior:

- after GA4 revenue source add/edit/delete paths that affect KPI inputs, run GA4 KPI/Benchmark recompute before alert checks when the route promises immediate correctness
- after GA4 spend source add/edit/delete paths that affect KPI inputs, run GA4 KPI/Benchmark recompute before alert checks or document the route as async-only with no immediate correctness promise
- preserve existing LinkedIn, Meta, Google Ads, Google Sheets, and Custom Integration source behavior unless the exact shared helper requires a narrow branch

Validation:

- route/source tests prove the recompute order: source mutation -> source total recalc -> GA4 KPI recompute -> alert check -> response
- delete/deactivate paths cannot update unrelated campaigns or unrelated platform rows
- notification queries still refresh from the frontend after KPI-affecting source changes

### Current Commit 3 - Preserve custom and unsupported GA4 KPI rows during recompute

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- focused custom KPI regression test
- documentation update if custom KPI alert semantics are clarified

Required behavior:

- standard GA4 KPI templates continue to recompute
- unsupported/custom GA4 KPI rows are not overwritten to `0`
- unsupported/custom rows do not receive misleading auto progress points from guessed zero values
- stored custom current values remain available for visible cards, alerts, and reports only under explicitly documented semantics

Validation:

- custom GA4 KPI current value survives daily scheduler recompute
- custom GA4 KPI current value survives KPI create/update-triggered recompute
- report preflight recompute does not zero a custom KPI row

### Current Commit 4 - Enforce duplicate GA4 KPI latest-row-wins alert behavior

Files expected:

- `server/kpi-scheduler.ts`
- `server/kpi-notifications.ts` if notification resolution needs a narrow change
- focused duplicate KPI alert regression test

Required behavior:

- for active GA4 KPI rows with the same campaign and metric/name key, only the latest row is eligible to create or preserve an active performance alert
- older duplicate rows cannot create competing active alerts
- existing older duplicate alerts are resolved or suppressed without hard-deleting KPI or notification history

Validation:

- two active same-campaign same-metric GA4 KPI rows produce at most one active alert for the latest row
- deleting the latest row does not expose unrelated campaign alerts
- notification list dedupe remains campaign and KPI scoped

### Current Commit 5 - Cover scheduled/server report KPI consumers

Files expected:

- `server/ga4-scheduled-report-pdf.ts` if behavior needs adjustment
- `server/report-scheduler.ts` if preflight recompute needs adjustment
- focused scheduled report regression test

Required behavior:

- scheduled/server GA4 reports use corrected persisted KPI values after recompute
- report preflight recompute does not write misleading values for unsupported/custom rows
- failed recompute does not create a report artifact that implies unverified KPI values are fresh

Validation:

- scheduled GA4 KPI report includes corrected persisted ROAS, ROI, CPA, and Revenue after current-day source inputs
- custom KPI rows are preserved or explicitly marked according to documented semantics
- report snapshot/audit state is consistent with send success/failure behavior already required by report safety rules

### Current Commit 6 - Existing damaged-data inventory and bounded cleanup plan

Files expected:

- a dry-run cleanup/inventory script only if exact damaged boundaries can be proven
- focused cleanup boundary regression test
- this readiness file

Required behavior:

- run a read-only inventory before any mutation
- identify rows affected by financial source-window drift, custom zero overwrite, and duplicate alert state separately
- mutate only rows whose exact source data, date window, campaign, property, and KPI identity are proven
- leave unprovable rows unchanged with explicit skip reasons

Validation:

- dry-run output includes candidate count, skipped count, sample row IDs, source windows, and reason codes
- apply mode requires explicit flag
- post-apply dry-run reports no remaining candidates for the proven boundary

### Current Commit 7 - Final certification documentation update

Files expected:

- `GA4/KPIS_PRODUCTION_READINESS.md`
- any narrow GA4 docs whose behavior changed, such as `GA4/KPIS.md` or `GA4/REFRESH_AND_PROCESSING.md`

Required behavior:

- update this file only after Commits 1-6 are implemented and validated
- treat Commits 1-6 as making GA4 KPIs eligible for certification, not automatically production-ready
- rerun the full root `PRODUCTION_READINESS.md` checklist against the implemented code before changing status
- include the complete value inventory and downstream propagation matrix from current evidence
- include the source lifecycle matrix, negative-case matrix, scheduled/server report consumer check, alert/notification propagation check, and test coverage matrix from current evidence
- separate proven, partially reviewed, not locally verifiable, and deferred deployed/provider validation
- do not restore a production-ready claim unless every required path in `PRODUCTION_READINESS.md` is covered or explicitly classified

Validation:

- all targeted regression tests from Commits 1-6 pass
- `npm run check` passes
- production-readiness answer cites current evidence and does not rely on the June 27 historical claim

## Historical Completed Fix Queue

The historical queue below is complete for the narrower June 27 ROAS/CPA/property-scope bug set. It is not the current fix queue and must not be used as evidence that GA4 KPIs are production-ready.

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
- alert regression proving a below-threshold ROAS KPI with current `2.5` and threshold `3.0` breaches
- targeted KPI/Benchmark test suite

### Commit 2 - Fix KPI CPA data sufficiency

Files:

- `shared/kpi-math.ts`
- `server/kpi-math.test.ts`

Required behavior:

- CPA KPI with conversions present but spend below minimum is `insufficient_spend`.
- CPA KPI with conversions and spend present remains scorable.
- Benchmark CPA behavior remains unchanged.

Validation:

- focused KPI math tests
- GA4 KPI card/tracker validation for CPA with zero spend

### Commit 3 - Scope GA4 Set as Primary by campaign

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

### Commit 4 - Keep selected property aligned after Set as Primary

Files:

- `client/src/pages/ga4-metrics.tsx`
- focused UI/source-state regression if available

Required behavior:

- successful Set as Primary updates `selectedGA4PropertyId` to the selected connection's property ID.
- GA4 daily, to-date, diagnostics, and breakdown queries refetch for that property.

Validation:

- browser validation with two GA4 properties connected to one campaign
- confirm KPI visible values and primary-property label reference the same property after the action

### Commit 5 - Fix KPI ROAS copy

Files:

- `client/src/pages/ga4-metrics.tsx`
- optional text regression

Required behavior:

- default ROAS descriptions say ratio or `x`, not percent.

Validation:

- create KPI modal text check
- saved blank-description ROAS KPI does not persist percent wording

### Commit 6 - Existing GA4 ROAS data cleanup plan

Files:

- `server/ga4-roas-persisted-cleanup.ts`
- `server/ga4-kpi-benchmark-roas-regression.test.ts`
- documentation update in this file

Required behavior:

- recompute current ROAS values for exact GA4 platform KPI rows after Commit 1, using persisted GA4 daily facts, active GA4-context imported revenue, and active spend records.
- correct auto GA4 daily ROAS KPI progress rows only where the row has a strict `auto:ga4_daily:YYYY-MM-DD` note and the campaign has exactly one active GA4 property.
- recompute corrected KPI progress row rolling averages and trend direction from the repaired persisted series.
- leave unprovable legacy rows unchanged with a documented skip reason.
- default to dry-run inventory; mutate only when run with `--apply`.

Validation:

- `npm test -- server/ga4-kpi-benchmark-roas-regression.test.ts`
- `npm run check`
- dry-run inventory command against the target database: `tsx server/ga4-roas-persisted-cleanup.ts`
- apply command only after inventory review: `tsx server/ga4-roas-persisted-cleanup.ts --apply`
- before/after row counts, sample affected rows, and skipped-row reasons from the script output

### Historical Commit 7 - June 27 readiness documentation flip (superseded)

Files:

- `GA4/KPIS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`

Completed behavior:

- historically updated the durable answer after Commits 1-6 were completed, deployed, UI-validated, and the ROAS persisted cleanup was applied.
- included exact validation commands, cleanup row counts, skipped-row reasons, and remaining external/deployed caveats for that narrower historical bug set. This is superseded by the June 28 current status and fix queue above.

## Validation Evidence And Gaps

Current validation status:

- no runtime code fixes from the current fix queue have been implemented yet
- no targeted tests for the current blockers have been run yet
- the historical June 27 tests remain useful regression coverage for ROAS ratio, CPA sufficiency, alert URL/visibility, and email gating, but they do not prove current GA4 KPI production readiness

Current uncovered paths that must be covered before certification:

- current-day imported revenue/spend records in persisted GA4 KPI recompute
- GA4 revenue/spend source add/edit/delete lifecycle recompute order
- custom/unknown GA4 KPI recompute preservation
- duplicate GA4 KPI campaign+metric latest-row-wins alert handling
- scheduled/server GA4 report consumption of persisted KPI values
- existing damaged-data boundaries for the current blockers

Historical validation run during the June 27, 2026 audit:

`npm test -- server/kpi-math.test.ts server/benchmark-math.test.ts server/revenue-additivity.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-retry-regression.test.ts server/alert-email-idempotency-regression.test.ts`

Result:

- 13 test files passed
- 238 tests passed

Historical limitation from the initial audit:

- this green suite did not prove production readiness at that time because `server/ga4-cross-tab-consistency.test.ts` encoded old percent ROAS expectations before Commit 1.
- the historical June 27 status relied on later fix validation, deployment, UI validation, and applied cleanup evidence, but the June 28 audit found additional unproven paths that now block certification.

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
- Reports are not broadly in GA4 KPI scope, but scheduled/server GA4 report KPI rows are direct downstream consumers and must be covered by the current fix queue.

## Not Locally Verifiable

The following require deployed or provider evidence:

- live GA4 API token refresh behavior
- live GA4 processing latency
- deployed scheduler execution timing
- provider-side email delivery events
- actual inbox receipt

These are external or deployed-runtime caveats. They do not override the current local implementation blockers listed above.

## Future Platform Template

Before copying GA4 KPIs to Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration, prove each item below for the new platform:

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
- existing damaged data has a bounded cleanup plan
- local tests cover the platform's own source model rather than copying GA4 fixtures blindly

Do not certify another platform source as KPI production-ready just because GA4 KPIs are eventually certified. Each platform needs its own source, scope, recompute, alert, notification, and cleanup proof.
