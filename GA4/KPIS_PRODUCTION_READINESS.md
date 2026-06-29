# GA4 KPIs Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `KPIs` tab.

Use this file when asked whether GA4 KPIs are robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration.

`GA4/KPIS.md` defines what the KPI tab is supposed to do.

This file defines whether the current implementation is production-ready, what has been proven, what is only partially reviewed, what is not locally verifiable, and the current fix queue required before any future production-ready claim.

## Current Status

As of June 29, 2026, GA4 KPIs are **not production-ready** for the current GA4 code scope.

Current Commits 0-7 have been implemented, locally validated, committed, pushed, deployed, and user-validated through the GA4 KPI UI flow listed below. The later GA4 Revenue notification visibility bug was fixed in commits `0f1be173` and `3ed67320` and user-validated on the deployed app on June 29, 2026. The follow-up direct GA4 snapshot PDF fix now runs a suppress-alert GA4 KPI/Benchmark preflight before regenerating direct snapshot PDFs in local code. These fixes make GA4 KPIs eligible for the next certification step, but they do not certify production readiness because deployed scheduler and provider-delivery evidence remains partially reviewed or not locally verifiable, and this direct snapshot PDF follow-up still needs commit/deploy validation if the deployed app is the certification target.

Certification result:

- completed local fixes: persisted financial source windows, source lifecycle recompute, custom/unsupported KPI row preservation, duplicate-alert latest-row handling, scheduled/test/manual report consumer fail-closed guards, damaged-data inventory/cleanup boundaries, and GA4 financial notification source parity
- deployed UI validation completed by user: GA4 KPIs tab open/render, existing KPI values, create/edit/delete KPI, GA4 revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available
- target database damaged-data dry-run completed on June 29, 2026: 0 candidates, 9 skipped rows, 0 applied, no `--apply` needed from this output
- locally fixed in this working tree: direct GA4 snapshot PDF download runs suppress-alert GA4 KPI/Benchmark preflight before the shared PDF builder reads current KPI rows
- not locally verifiable: live GA4 provider behavior, deployed scheduler timing, provider-side email delivery events, and actual inbox receipt

The current answer is:

`GA4 KPIs are not production-ready for the current GA4 code scope. Current Commits 0-7 and the follow-up GA4 notification financial-source visibility fix are implemented, committed, pushed, locally validated, deployed, and user-validated for the listed UI flows. The target-database damaged-data inventory dry-run completed with 0 candidates and 9 skipped rows, so no apply command should be run from this output. The direct GA4 snapshot PDF route is locally fixed to refresh current KPI values before PDF generation, but the section must not be called production-ready until this follow-up is committed/deployed when validating the deployed app and deployed/provider scheduler/email caveats are proven or explicitly excluded by product decision.`

This status should change only after:

- direct GA4 snapshot PDF follow-up is committed, deployed, and validated if certification is for the deployed app
- deployed scheduler and provider/email behavior are validated or kept as explicit external caveats
- this document is updated from current evidence, not from prior readiness claims

Necessary certification rule:

- completing the local fix queue makes GA4 KPIs eligible for production-readiness certification; it does not by itself make them production-ready
- the final answer must remain `not production-ready` unless the final certification pass proves the complete current value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, and test coverage from current code and validation evidence

## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Current Certification Gaps And Completed Local Fixes`
4. `Current Fix Queue`
5. `Validation Evidence And Gaps`
6. `Future Platform Template`

Answer that GA4 KPIs are not production-ready for the current GA4 code scope. Current local fixes, user-confirmed deployed UI validation, target damaged-data dry-run, and the local direct GA4 snapshot PDF preflight fix are complete, but final certification remains blocked by the explicit deployed scheduler and provider evidence gates in this file, plus deploy validation of this follow-up when certifying the deployed app.

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

## Current Commit 7 Certification Pass

Root cause of the remaining certification failure:

- Earlier readiness updates treated completed fixes as equivalent to certification.
- The Current Commit 7 pass reran the root `PRODUCTION_READINESS.md` standard and found that local tests proved the narrow fixed code paths, but did not yet prove deployed UI behavior, target database state, provider delivery, deployed scheduler execution, or the then-unfixed direct historical snapshot PDF freshness semantics. Deployed UI validation and target database dry-run evidence have since been added. The direct GA4 snapshot PDF freshness path now has a local suppress-alert preflight fix; provider delivery and deployed scheduler execution remain caveats, and this direct PDF follow-up still needs deployment validation when certifying the deployed app.
- Therefore the correct status is not production-ready, with completed local fixes and explicit remaining validation/certification gates.

### Complete GA4 KPI Value Inventory

| Value / surface | Source path | Formula / semantics | Scope and window | Downstream consumers | Current evidence status |
| --- | --- | --- | --- | --- | --- |
| KPI grid row count and tracker `Total KPIs` | GA4 KPI list query -> platform KPI rows | Count of GA4 KPI rows in current campaign/platform scope | Campaign + `google_analytics`; current saved rows | KPI tab UI, executive snapshot | Route access and frontend invalidation traced; user-confirmed deployed UI validation passed |
| `Above Target`, `On Track`, `Below Target`, `Avg. Progress` | KPI rows -> shared KPI math/status policy | Metric-aware progress, tolerance, blocked/insufficient exclusions; compact tracker copy must say `each KPI's tolerance` and must not expose derived absolute-count amounts such as `41 users` | Campaign + visible KPI rows | KPI tracker, executive interpretation | Shared math tests passed; user-confirmed deployed UI validation passed |
| Standard GA4 KPI current values: Users, Sessions, Pageviews, Conversions | GA4 daily/to-date metrics -> visible UI and persisted recompute job | Count totals, rounded as counts | Selected campaign, primary/selected GA4 property, GA4 campaign filter, completed GA4 reporting date | KPI cards, progress history, alerts, notifications, reports | Partially reviewed; persisted recompute path covered by GA4 KPI regression tests, live provider behavior not locally verifiable |
| Revenue | GA4 native revenue + active GA4-context imported revenue | `ga4Revenue + importedRevenue` | Native GA4 window stays completed reporting date; imported revenue window is `1900-01-01` through current UTC date | KPI card, tracker, progress, alerts, scheduled/server reports | Proven locally for persisted source-window and notification financial-source regressions; user-confirmed deployed UI validation passed |
| ROAS | Revenue / active spend | Ratio `x`, not percent | Same campaign/source windows as Revenue and Spend | KPI card, progress, alerts, notification/email, reports | Proven locally for ratio semantics and financial source-window forward path; deployed data state not proven |
| ROI | `(Revenue - Spend) / Spend * 100` | Percent | Same campaign/source windows as Revenue and Spend | KPI card, progress, alerts, notification/email, reports | Proven locally for financial source-window forward path; deployed data state not proven |
| CPA | Spend / conversions | Currency cost per conversion; insufficient when spend or conversions are missing | Spend through current UTC date, conversions through GA4 completed reporting date | KPI card, tracker, progress, alerts, reports | Partially reviewed; historical sufficiency tests and current financial-window test cover key paths |
| Conversion Rate | Conversions / sessions | Percent with zero-session guard | GA4 completed reporting date/to-date scope | KPI card, tracker, alerts, reports | Partially reviewed; covered by shared/GA4 regression suite, not provider-validated |
| Engagement Rate | GA4 engagement rate normalized to percent | Percent | GA4 completed reporting date/to-date scope | KPI card, tracker, alerts, reports | Partially reviewed; covered by formula path, not provider-validated |
| Custom or unsupported KPI rows | Saved `kpis.currentValue` | Manual/unsupported value is preserved; no guessed recompute | Campaign + `google_analytics`; no automatic current-value formula | KPI card, alerts if enabled, reports | Proven locally for forward recompute preservation; prior zero-overwrite damage not repairable without original value |
| KPI progress history | Recompute job -> `kpi_progress` rows | Daily point, rolling averages, trend direction | Auto GA4 daily rows with `auto:ga4_daily:YYYY-MM-DD` notes | Trends, alerts, downstream summaries | Partially reviewed; standard forward paths covered, deployed historical data not inventoried locally |
| Active KPI notifications | Alert check -> notification row metadata keyed by KPI ID | One active GA4 in-app alert per unresolved breach; enabled alerts are not visible in the bell or Notifications unless currently breached; GA4 financial alerts use the same Revenue/ROAS/ROI/CPA source model as the KPI cards; older duplicate KPI alerts resolved/suppressed | Campaign, KPI ID, latest duplicate row per campaign+metric/name | Bell, Notifications center, action URL | Proven locally for duplicate forward path, cleanup boundary, breach-only visibility, and GA4 financial-source parity; exact stale Revenue alert was user-confirmed fixed on deployed UI |
| KPI alert emails and audit rows | Alert monitoring -> email send claim/audit | Provider acceptance is not confirmed delivery; duplicate GA4 KPI IDs suppressed before claim/send | Campaign, KPI ID, frequency window, recipients | Email provider, audit retry path | Partially reviewed; local audit/retry/idempotency covered, provider delivery not locally verifiable |
| Scheduled/test/manual/direct GA4 report KPI tables | GA4 report scheduler/PDF builder -> persisted platform KPI rows | Persisted KPI `currentValue` and `targetValue`; fail closed on preflight/PDF/KPI-read failures for covered creation/send/download paths | Campaign + report config; preflight recompute before send/test/manual snapshot creation and before direct snapshot PDF regeneration | PDF attachments, report sends, manual snapshots, direct snapshot PDF downloads | Proven locally for scheduled/test/manual/direct guards by source regression tests; deployed scheduler/provider behavior remains external |
| Damaged-data inventory | `server/ga4-kpi-damaged-data-cleanup.ts` | Dry-run inventory; bounded apply only for proven financial drift and duplicate notifications | Target database from `.env`, optional campaign filter | Data cleanup decision, certification evidence | Target dry-run completed June 29, 2026: 0 candidates, 9 skipped rows, 0 applied; no `--apply` required from this output |

### End-To-End Trace Matrix

| Path | Source -> storage -> API/UI -> downstream trace | Evidence status |
| --- | --- | --- |
| KPI create | UI create -> platform KPI route with campaign access -> storage create -> GA4 recompute for GA4 rows -> alert check -> frontend query invalidation | Route/source guards covered; user-confirmed deployed UI validation passed |
| KPI edit | UI update -> `ensureKpiAccess` + platform check -> storage update -> GA4 recompute when GA4 campaign row -> alert check -> query invalidation | Route behavior traced; user-confirmed deployed UI validation passed |
| KPI delete | UI delete -> `ensureKpiAccess` + platform check -> storage delete/cascade -> notification visibility refresh | Access/delete mechanics traced; user-confirmed deployed UI validation passed |
| Daily/on-demand recompute | GA4 daily/on-demand refresh -> `runGA4DailyKPIAndBenchmarkJobs` -> `storage.updateKPI` -> progress history -> alert checks | Proven locally for fixed financial windows and custom preservation; live provider/deployed scheduler not locally verifiable |
| Source add/edit/delete recompute | GA4 revenue/spend route -> source mutation/recalc -> GA4 KPI/Benchmark recompute -> alert check -> response/frontend refresh | Proven locally by route-order regression guards; user-confirmed deployed source mutation validation passed for KPI values and alert refresh |
| Alerts/notifications | Persisted `kpis.currentValue` -> `checkPerformanceAlerts`/immediate email path -> latest-row guard -> notification/email audit | Proven locally for duplicate latest-row behavior; provider delivery external |
| Scheduled/test/manual/direct snapshot reports | Report preflight -> GA4 recompute result check -> PDF builder -> KPI rows from storage -> send/snapshot creation or direct PDF download | Proven locally for covered send/test/manual/direct PDF paths; deployed scheduler/provider behavior remains external |
| Existing damaged data | Read-only inventory -> candidate/skip classification -> explicit `--apply` only for proven boundaries | Proven locally for script behavior; target database dry-run completed with 0 candidates and 9 skipped rows; no apply run needed from this output |

### Downstream Propagation Matrix

| Downstream consumer | KPI value used | Propagation rule | Status |
| --- | --- | --- | --- |
| KPI tab cards/grid | Visible/current KPI values and saved KPI rows | Render campaign-scoped GA4 KPIs and current-vs-target state | User-confirmed deployed UI validation passed |
| KPI tracker summary | KPI card status/progress | Aggregate counts and average progress after insufficiency/blocking policy | Shared tests passed; user-confirmed deployed UI validation passed |
| KPI progress/history | Persisted recompute value | Auto point only for computable GA4 KPI metrics | Proven locally for custom skip and financial window fixed paths |
| In-app notification bell/center | Persisted KPI breach state | `/api/notifications` returns KPI performance-alert rows only while the linked KPI exists, remains campaign-scoped, is currently breached, and for GA4 financial KPIs uses the same selected financial-source model as the live KPI cards; latest GA4 duplicate row wins and older duplicate notifications resolve/suppress | Proven locally by duplicate-alert and notification-visibility regression tests plus cleanup boundary test; user-confirmed deployed stale Revenue alert fix passed |
| Immediate/scheduled KPI emails | Persisted KPI breach state | Latest GA4 duplicate row must be sendable before claim/send; provider acceptance is not delivery | Partially reviewed; local email paths covered, provider delivery external |
| Scheduled/test/manual GA4 report PDFs | Persisted `platformKPIs` rows | Preflight recompute must process target campaign; PDF unavailable fails closed for covered creation/send paths | Proven locally for covered paths |
| Direct GA4 snapshot PDF download | Suppress-alert GA4 preflight recomputes current persisted KPI rows before the shared PDF builder reads them | Return 422 and do not generate the PDF if the target campaign is not processed; no alert/send side effects from direct download | Locally fixed and source-regression covered; deploy validation required for deployed certification |
| GA4 Insights and other related consumers | KPI/Benchmark context where used | Not reopened in this KPI-only queue except direct report dependencies | Not locally verifiable in this queue |
| Existing-data cleanup | Persisted KPI rows, notifications, email audit rows | Dry-run inventory first; mutate only exact proven candidate boundaries | Locally covered script behavior; deployed data not inspected |

### Source Lifecycle Matrix

| Lifecycle path | Current local status |
| --- | --- |
| KPI add/create | API route and recompute side effects traced; user-confirmed deployed UI validation passed |
| KPI edit/update | API route and recompute side effects traced; user-confirmed deployed UI validation passed |
| KPI delete | Access guard and notification visibility behavior traced; user-confirmed deployed UI validation passed |
| Revenue source add/edit/delete | Proven locally for GA4 recompute ordering via route guard tests; user-confirmed deployed source mutation validation passed for KPI value and alert refresh |
| Spend source add/edit/delete | Proven locally for GA4 recompute ordering via route guard tests; user-confirmed deployed source mutation validation passed for KPI value and alert refresh |
| Scheduler refresh | Proven locally for recompute call paths and formulas; deployed scheduler timing not locally verifiable |
| Manual/on-demand refresh | Partially reviewed through shared recompute coverage; live provider response not locally verifiable |
| Alerts/notifications | Proven locally for latest-row duplicate guard, breach-only visibility, and GA4 financial notification source parity; user-confirmed deployed bell/Notifications validation passed; provider delivery external |
| Reports | Proven locally for scheduled/test/manual report creation/send guards and direct GA4 snapshot PDF preflight regeneration; deployed scheduler/provider behavior remains external |
| Existing damaged data | Locally covered inventory/cleanup script behavior; target dry-run completed with 0 candidates, 9 skipped rows, and 0 applied |

### Negative-Case Matrix

| Negative case | Expected behavior | Evidence status |
| --- | --- | --- |
| Current-day imported revenue/spend changes after yesterday | Persisted financial KPI values include current UTC source totals | Proven locally by financial-window regression |
| Zero or missing spend for CPA/ROAS/ROI | Avoid misleading financial ratios where sufficiency rules require inputs | Partially reviewed through math/regression coverage |
| Unsupported/custom GA4 KPI metric | Do not overwrite current value to guessed `0`; do not create auto progress point | Proven locally by custom preservation regression |
| Duplicate active GA4 KPI rows for same campaign+metric/name | Only latest row can create/preserve active alert/email eligibility | Proven locally by duplicate-alert regression |
| Older duplicate active notification exists | Inventory/apply can mark notification resolved/superseded without hard delete | Proven locally by damaged-data cleanup regression |
| Existing custom row currently `0` | Inventory only; leave unchanged because original manual value is unproven | Proven locally by cleanup boundary regression |
| Access-token GA4 campaign in cleanup | Skip financial cleanup because live provider totals may be involved | Proven locally by cleanup boundary regression |
| Report preflight recompute fails or skips campaign | Scheduled/test/manual report path fails closed before artifact/send/snapshot | Proven locally by report-consumer regression |
| KPI rows cannot be loaded for a KPI-section PDF | KPI-section PDF generation fails closed | Proven locally by report-consumer regression |
| Direct GA4 snapshot PDF download | Suppress-alert preflight must process the report campaign before PDF generation | Locally fixed and covered by report-consumer regression |
| Non-breached GA4 financial alert has stale active notification row | `/api/notifications` must hide the row after recomputing Revenue/ROAS/ROI/CPA from the same financial source model as the KPI card | Proven locally by notification visibility regression; exact Revenue case user-confirmed fixed on deployed UI |

### Test Coverage Matrix

| Coverage area | Test evidence |
| --- | --- |
| Persisted financial source windows | `server/ga4-kpi-financial-window-regression.test.ts` |
| GA4 source lifecycle recompute ordering | `server/ga4-source-lifecycle-recompute-regression.test.ts` |
| Custom/unsupported KPI preservation | `server/ga4-kpi-custom-preservation-regression.test.ts` |
| Duplicate latest-row alert behavior | `server/ga4-kpi-duplicate-alert-regression.test.ts` |
| Scheduled/server/direct snapshot report KPI consumers | `server/ga4-kpi-report-consumer-regression.test.ts` |
| Existing damaged-data inventory/cleanup boundaries | `server/ga4-kpi-damaged-data-cleanup-regression.test.ts` |
| Existing GA4 KPI/financial/math regressions | `server/ga4-kpi-benchmark-summary-regression.test.ts`, `server/ga4-kpi-benchmark-roas-regression.test.ts`, `server/ga4-kpi-regression.test.ts`, `server/ga4-financial-rules.test.ts` |
| Type/contract safety | `npm run check` |

### Documentation Alignment Check

| Document | Alignment status |
| --- | --- |
| `GA4/KPIS.md` | Updated in Current Commit 7 to retract the stale June 27 production-ready claim and updated again to document GA4 financial notification parity |
| `GA4/README.md` | Updated to stop advertising GA4 KPIs as production-ready and record that the damaged-data dry-run completed with no apply candidates |
| `GA4/FINANCIAL_SOURCES.md` | Updated to document that alert/notification financial values must use the same selected GA4 financial-source model as `Total Revenue` |
| `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` | Updated with the deployed GA4 Revenue notification financial-source parity fix and user validation evidence |
| `GA4-MANUAL-TEST-PLAN.md` | Updated to include GA4 financial notification current-value parity and stale non-breached alert disappearance checks |
| `GA4/KPIS_PRODUCTION_READINESS.md` | Updated in Current Commit 7 with final certification result, matrices, evidence, and remaining gates |
| `GA4/REFRESH_AND_PROCESSING.md` | Updated to document GA4 financial notification visibility as part of post-refresh breach-only behavior |
| `PRODUCTION_READINESS.md` | Already contains the reusable anti-overclaim/certification requirement; not touched in Current Commit 7 |

## Current Production-Readiness Map

### 1. KPI Tab UI And Creation Flow

Status: Deployed UI validated by user on June 29, 2026. The visible GA4 KPI create/edit/delete UI flow is locally traced, current route/recompute side effects have targeted coverage, and user-confirmed deployed validation covered existing KPI values, create/edit/delete, revenue/spend source mutation, alerts/notifications, and report send/manual snapshot where available.

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

Status: Partially reviewed. Standard formulas, persisted financial source windows, custom/unsupported preservation, duplicate-alert behavior, scheduled/manual/direct snapshot report consumer guards, notification financial-source parity, and damaged-data inventory boundaries now have local fixes and targeted tests; user-confirmed deployed UI validation has passed and target damaged-data dry-run found no apply candidates, but production-ready certification remains blocked by deployed scheduler and provider/deployed validation gates, plus deploy validation of the direct snapshot PDF follow-up when certifying the deployed app.

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

Status: Partially reviewed. In-app alert URL, visibility mechanics, duplicate latest-row guard, and local email audit/retry paths have targeted coverage. Provider delivery evidence and deployed existing alert/audit state remain external or data-validation gates.

Proven locally:

- GA4 KPI alert action URLs deep-link to `/campaigns/:campaignId/ga4-metrics?tab=kpis&highlight=:kpiId`.
- GA4 KPI alert creation maintains a single active in-app alert row while a breach remains active.
- enabled GA4 KPI alerts do not appear in the bell icon or main Notifications page unless the alert condition is currently breached.
- notification listing rechecks whether the KPI row still exists, belongs to the notification campaign, and remains breached.
- delete paths soft-hide related KPI notifications.
- immediate and scheduled email alert paths distinguish send attempts with audit rows.
- local alert email scheduler, audit, retry, and idempotency tests pass in the targeted suite.

Historical resolved blocker:

- platform GA4 KPI alert checks use persisted `currentValue`; persisted ROAS now uses the same ratio semantics as the visible GA4 KPI cards.

Current certification gaps:

- target persisted `currentValue` cleanup candidates were inventoried by the Current Commit 6 damaged-data script on June 29, 2026; the dry-run found 0 candidates and 9 skipped rows, so no apply run is indicated from that output.

Not locally verifiable:

- deployed email provider configuration
- provider delivery events
- inbox receipt
- deployed scheduler runtime

### 5. Refresh, Scheduler, And Recompute

Status: Partially reviewed. Daily, on-demand, auto-refresh, KPI create/update recompute, persisted financial source-window recompute, source mutation route recompute, custom/unsupported preservation, duplicate-alert handling, report guards, notification financial-source parity, and damaged-data inventory now have local forward fixes or guard coverage. Deployed UI validation passed by user, but deployed scheduler timing remains a certification caveat.

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

Status: Partially reviewed. Platform KPI CRUD ownership/scoping is locally traced; GA4 source lifecycle route ordering and scheduled/test/manual report consumers now have targeted coverage, but source modal/list UI display and deployed/provider paths remain unproven.

Proven locally:

- current GA4 platform KPI list requires campaign access before returning rows.
- current GA4 platform KPI create requires campaign access.
- current GA4 platform KPI update/delete use `ensureKpiAccess` and verify platform type.
- storage methods fetch platform KPIs by exact platform and campaign when campaignId is supplied.

Resolved scoping issue outside the KPI CRUD route itself:

- GA4 primary-property storage update is now campaign-scoped by target connection.
- server recompute and visible selected property are aligned after the Set as Primary action.

### 7. Existing Damaged Data

Status: Partially reviewed. The prior ROAS cleanup was applied for a narrower historical bug boundary. Current Commit 6 adds a new read-only inventory and bounded cleanup script for the current blockers, but deployed data has not been inventoried or mutated locally.

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

Current Commit 6 cleanup boundary:

- `server/ga4-kpi-damaged-data-cleanup.ts` defaults to dry-run and prints candidate count, skipped count, sample row IDs, source windows, and reason codes.
- `financial_source_window_drift` candidates are eligible for apply only when the current GA4 KPI row matches the old financial source-window formula exactly and differs from the new formula, with campaign, primary property, latest persisted GA4 date, source windows, and KPI identity proven.
- access-token GA4 campaigns are skipped for financial cleanup with `financial_live_ga4_totals_not_local` because the forward job may use live GA4 totals and the cleanup script must not fetch or mutate live-provider state.
- `custom_zero_overwrite` rows are inventoried only; rows are left unchanged with `custom_zero_previous_value_unproven` because the previous custom user-entered value is not recoverable from current persisted state.
- `duplicate_notification_state` candidates are active performance-alert notifications tied to superseded GA4 KPI duplicate rows; apply mode marks those notifications read/resolved with `resolvedReason = superseded` without deleting KPI or notification history.
- Email audit rows are inventoried but retained with `duplicate_email_audit_retained`; retry/send paths now suppress superseded GA4 KPI IDs, but historical audit evidence is not rewritten.
- Apply mode requires `--apply`; no local database apply has been run in this commit.

## Current Certification Gaps And Completed Local Fixes

The current local fix queue is implemented. The remaining items below are certification gaps, deployed/provider validation gates, or product-decision gaps, not newly identified broad refactor requests.

### CERT-EVIDENCE-1: Post-fix UI validation passed for the current queue

Evidence:

- Local source tests cover route/order/formula guards.
- User-confirmed deployed validation on June 29, 2026 covered existing KPI values, create/edit/delete KPI, GA4 revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available.
- The exact reported stale non-breached GA4 Revenue alert disappeared from Notifications/bell without creating a new alert.

### CERT-EVIDENCE-2: Target damaged-data inventory dry-run completed

Evidence:

- command: `npx tsx --env-file=.env server/ga4-kpi-damaged-data-cleanup.ts`
- mode: `dry-run`
- candidate count: `0`
- skipped count: `9`
- applied count: `0`
- sample row IDs: `none`
- source windows: `none`
- reason codes: `financial_live_ga4_totals_not_local`, `financial_no_primary_property`
- skipped rows were intentionally not mutated because live GA4 token totals are not locally safe to fetch/mutate or no active primary GA4 property proves the source boundary
- no `--apply` run is indicated from this output

### CERT-GAP-3: Direct GA4 snapshot PDF latest-value regeneration locally fixed

Root cause:

- Current Commit 5 fail-closes scheduled send, test-send, manual snapshot creation, and KPI-section PDF row loading.
- The direct `/api/report-snapshots/:snapshotId/pdf` read/download path reused the shared server PDF builder, which reads current persisted KPI rows, but it did not run GA4 KPI/Benchmark recompute preflight first.
- That meant a regenerated direct snapshot PDF could read stale persisted KPI values if the latest GA4 KPI recompute had not already run.

Local fix:

- The direct snapshot PDF route now calls `preflightGA4ReportKPIConsumers(okReport, undefined, { suppressAlerts: true })` before `buildPdfAttachmentForReport`.
- Passing no historical date lets the GA4 preflight use the current completed GA4 reporting date rather than an old snapshot window.
- If the target GA4 campaign is skipped or recompute fails, the route returns 422 and does not generate the PDF.
- Alert/send side effects remain suppressed for this direct download path; the intentional side effect is refreshing persisted KPI/Benchmark values before the PDF builder reads them.

Remaining evidence before deployed certification:

- commit, push, Render deploy, and validate direct GA4 snapshot PDF download on the deployed app if this route is part of the deployed production-readiness claim.

### CERT-GAP-4: Deployed/provider behavior is not locally verifiable

Root cause:

- Local tests cannot prove live GA4 provider responses, deployed scheduler timing, provider delivery events, or inbox receipt.

Affected paths:

- live GA4 API/token-refresh behavior
- deployed daily/auto-refresh scheduler execution
- email provider acceptance vs confirmed delivery
- actual inbox receipt

Required evidence before certification:

- deployed scheduler run evidence or controlled job execution logs
- provider/API acceptance evidence separated from confirmed delivery evidence
- provider delivery events or real inbox validation where delivery is claimed

### Completed Local Fixes In The Current Queue

| Commit | Local result | Validation evidence |
| --- | --- | --- |
| Current Commit 0 | Retracted stale readiness claim and created the current fix queue | Documentation-only review |
| Current Commit 1 | Persisted financial source windows now align with visible GA4 KPI source-backed financial window | `server/ga4-kpi-financial-window-regression.test.ts` |
| Current Commit 2 | GA4 revenue/spend source mutation paths now trigger GA4 KPI recompute before alert checks where immediate correctness is promised | `server/ga4-source-lifecycle-recompute-regression.test.ts` |
| Current Commit 3 | Custom/unsupported GA4 KPI rows are preserved during recompute and do not receive guessed-zero progress points | `server/ga4-kpi-custom-preservation-regression.test.ts` |
| Current Commit 4 | Duplicate GA4 KPI alert/email eligibility uses latest row per campaign+metric/name | `server/ga4-kpi-duplicate-alert-regression.test.ts` |
| Current Commit 5 | Scheduled/test/manual GA4 report KPI consumers fail closed on recompute/PDF/KPI-load failures | `server/ga4-kpi-report-consumer-regression.test.ts` |
| Current Commit 6 | Existing damaged-data inventory and bounded cleanup script separates proven candidates from unproven skipped rows | `server/ga4-kpi-damaged-data-cleanup-regression.test.ts` |
| Current Commit 7 | Final documentation certification pass updates status, matrices, evidence, and stale functional-doc readiness claim | Documentation diff plus targeted regression suite and `npm run check` |
| Post-fix clarification | GA4 KPI tolerance UI copy hides derived absolute-count details and GA4 KPI alert visibility is breach-only in bell/Notifications | `server/ga4-kpi-benchmark-summary-regression.test.ts`, `server/kpi-math.test.ts`, `server/notification-visibility-regression.test.ts` |
| Post-Commit 7 deployed notification fix | GA4 Revenue/ROAS/ROI/CPA notification visibility now uses the same selected GA4 financial-source model as KPI cards and fails closed when the source cannot be verified | Commits `0f1be173` and `3ed67320`; `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts`; `npm run check`; `npm run build`; user-confirmed deployed UI validation |

## Post-Commit 7 Deployed Notification Financial-Source Fix

Root cause:

- The GA4 KPI card computed Revenue from the selected GA4 financial model: the most complete selected-campaign GA4 native revenue candidate plus active imported revenue.
- `/api/notifications` could still decide visibility from a narrower financial value path, so an existing Revenue alert could remain visible with `Current value: 9,224.77` even while the KPI card showed `$18,771.34` and no longer breached the `below 12,000` threshold.
- Earlier fixes addressed cache refresh, persisted-row enrichment, mock/to-date parity, and Revenue metric aliases, but the final missed boundary was financial-source candidate selection for notification visibility.

Smallest safe fix:

- Keep `/api/notifications`, ownership checks, duplicate suppression, alert threshold math, email behavior, scheduler behavior, storage contracts, and KPI calculations unchanged.
- For GA4 financial KPI alerts (`Revenue`, `Total Revenue`, `ROAS`, `ROI`, and `CPA`), resolve notification current values from the same selected financial-source model used by KPI cards.
- Hide the notification row when the recomputed current value no longer breaches the threshold.
- Fail closed for GA4 notification visibility when the source path cannot be verified, instead of showing a stale active alert.

Files changed:

- `server/routes-oauth.ts`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 44 tests.
- `npm run check` passed.
- `npm run build` passed when Vite/esbuild was allowed to spawn normally.
- Deployed UI validation on June 29, 2026 was user-confirmed: the stale non-breached GA4 Revenue alert disappeared from Notifications/bell without creating a new alert.

Remaining certification gate:

- This fix completes the deployed UI alert/notification validation gate for the reported GA4 Revenue case.
- It does not replace deployed scheduler evidence, provider/inbox delivery evidence, or deploy validation of later local follow-ups.

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

Implementation status:

- forward-path fix implemented and validated for persisted GA4 KPI financial source windows
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

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

Implementation status:

- forward-path route fix implemented and validated for GA4 source add/edit/delete recompute ordering
- validation passed: `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts`
- validation passed: `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts server/ga4-kpi-financial-window-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts`
- validation passed: `npm run check`
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

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

Implementation status:

- forward-path recompute preservation implemented and validated for custom/unsupported GA4 KPI rows
- validation passed: `npm test -- server/ga4-kpi-custom-preservation-regression.test.ts`
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

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

Files changed:

- `server/kpi-scheduler.ts`
- `server/services/alert-monitoring.ts`
- `server/utils/ga4-kpi-alert-dedupe.ts`
- `server/ga4-kpi-duplicate-alert-regression.test.ts`
- `GA4/KPIS_PRODUCTION_READINESS.md`

Required behavior:

- for active GA4 KPI rows with the same campaign and metric/name key, only the latest row is eligible to create or preserve an active performance alert
- older duplicate rows cannot create competing active alerts
- existing older duplicate alerts are resolved or suppressed without hard-deleting KPI or notification history

Implementation status:

- Implemented in Current Commit 4 as a forward-path fix.
- In-app alert checks resolve older duplicate GA4 KPI rows as `superseded` before `createKPIAlert` can run.
- Immediate email, retry, and scheduled email paths suppress older duplicate GA4 KPI rows before alert-send claims or sends.
- Notification creation/list dedupe remains scoped to `kpiId`; older duplicates are prevented upstream instead of changing notification response shape.

Validation:

- `npm test -- server/ga4-kpi-duplicate-alert-regression.test.ts` passed locally.
- The regression covers two active same-campaign same-metric GA4 KPI rows, latest-row eligibility, same-campaign fallback after the latest row is absent, campaign isolation, scheduler suppression ordering, email suppression ordering, and unchanged notification dedupe anchors.

### Current Commit 5 - Cover scheduled/server report KPI consumers

Files expected:

- `server/ga4-scheduled-report-pdf.ts` if behavior needs adjustment
- `server/report-scheduler.ts` if preflight recompute needs adjustment
- focused scheduled report regression test

Required behavior:

- scheduled/server GA4 reports use corrected persisted KPI values after recompute
- report preflight recompute does not write misleading values for unsupported/custom rows
- failed recompute does not create a report artifact that implies unverified KPI values are fresh
- manual GA4 report snapshots are not inserted unless GA4 preflight recompute and PDF generation succeed
- GA4 KPI-section PDF generation fails closed when persisted KPI rows cannot be read

Validation:

- scheduled GA4 KPI report includes corrected persisted ROAS, ROI, CPA, and Revenue after current-day source inputs
- custom KPI rows are preserved or explicitly marked according to documented semantics
- report snapshot/audit state is consistent with send success/failure behavior already required by report safety rules
- source regression coverage must prove scheduled send, test-send, manual snapshot, and KPI-section PDF builder fail-closed guards before this commit can be treated as locally covered

### Current Commit 6 - Existing damaged-data inventory and bounded cleanup plan

Files expected:

- `server/ga4-kpi-damaged-data-cleanup.ts`
- `server/ga4-kpi-damaged-data-cleanup-regression.test.ts`
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

Implementation status:

- Added `server/ga4-kpi-damaged-data-cleanup.ts` as the current damaged-data inventory and bounded cleanup script.
- Dry-run is the default mode. `--apply` is required before any mutation.
- Proven apply boundaries are limited to `financial_source_window_drift` KPI current rows that match the old formula exactly and `duplicate_notification_state` active in-app notifications tied to superseded GA4 KPI duplicate rows.
- Unproven custom zero rows, access-token live GA4 financial rows, malformed/ambiguous financial rows, and duplicate email audit rows are left unchanged with explicit skip reason codes.
- Local validation covers the cleanup boundaries and output contract; no deployed database inventory or apply has been run.

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

Implementation status:

- Current Commit 7 updates this file with the final certification result from current evidence.
- Current Commit 7 updates `GA4/KPIS.md` to remove the stale June 27 production-ready statement.
- The certification result is not production-ready, not because the local fix queue, deployed UI validation, target damaged-data dry-run, or local direct snapshot PDF preflight fix is incomplete, but because deployed scheduler/provider behavior remains unproven or not locally verifiable and later local follow-ups still require deployment validation for deployed certification.
- The complete value inventory, end-to-end trace matrix, downstream propagation matrix, source lifecycle matrix, negative-case matrix, test coverage matrix, and documentation alignment check are recorded in `Current Commit 7 Certification Pass`.

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

Current local and deployed validation status after Current Commits 1-7 plus the follow-up GA4 notification financial-source fix:

- Current Commit 1 forward-path code and focused tests have been implemented for persisted GA4 KPI financial source windows.
- Current Commit 2 source lifecycle route-order coverage has been implemented for GA4 revenue/spend mutation paths that affect KPI inputs.
- Current Commit 3 custom/unsupported KPI preservation has been implemented for the shared GA4 recompute job.
- Current Commit 4 duplicate active GA4 KPI latest-row alert/email eligibility has been implemented for scheduler, immediate email, retry, and scheduled email paths.
- Current Commit 5 scheduled/test/manual GA4 report KPI consumer fail-closed guards have been implemented.
- Current Commit 6 existing damaged-data inventory and bounded cleanup script has been implemented.
- Current Commit 7 documentation now reflects the current certification result and no longer relies on the June 27 historical claim.
- Follow-up commits `0f1be173` and `3ed67320` fixed the GA4 Revenue notification visibility path so non-breached financial alerts are hidden when the KPI card no longer breaches.
- User-confirmed deployed UI validation passed on June 29, 2026 for opening the GA4 KPIs tab, existing KPI values, create/edit/delete KPI, revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available.
- Target database damaged-data dry-run passed on June 29, 2026 with 0 candidates, 9 skipped rows, 0 applied, no sample row IDs, no source windows, and reason codes `financial_live_ga4_totals_not_local` and `financial_no_primary_property`; no `--apply` run is indicated from this output.

Current local automated validation run during Current Commit 7:

- `npm test -- server/ga4-kpi-financial-window-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/ga4-kpi-custom-preservation-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-kpi-damaged-data-cleanup-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-financial-rules.test.ts`
- Result: 10 test files passed, 50 tests passed.
- `npm run check`
- Result: TypeScript check passed.

Current covered paths after Commits 1-7 and the notification financial-source fix:

- current-day imported revenue/spend records in persisted GA4 KPI recompute are covered by `server/ga4-kpi-financial-window-regression.test.ts`.
- GA4 source lifecycle route recompute ordering and platform-context propagation are covered by `server/ga4-source-lifecycle-recompute-regression.test.ts`.
- custom/unsupported GA4 KPI row recompute preservation is covered by `server/ga4-kpi-custom-preservation-regression.test.ts`.
- duplicate GA4 KPI latest-row-wins alert eligibility is covered by `server/ga4-kpi-duplicate-alert-regression.test.ts`.
- scheduled/test/manual GA4 report KPI consumer fail-closed guards are covered by `server/ga4-kpi-report-consumer-regression.test.ts`.
- damaged-data inventory, explicit `--apply`, proven candidate boundaries, and skip reason behavior are covered by `server/ga4-kpi-damaged-data-cleanup-regression.test.ts`.
- `/api/notifications` financial KPI visibility for Revenue/ROAS/ROI/CPA is covered by `server/notification-visibility-regression.test.ts` and user-confirmed deployed validation for the stale non-breached Revenue alert case.

Current uncovered or not-finalized paths before certification:

- deployed validation of direct GA4 snapshot PDF preflight regeneration after this local follow-up is pushed.
- live GA4 provider behavior, deployed scheduler execution, provider email delivery events, and actual inbox receipt.
- GA4 Insights or other related non-report consumers that may read KPI context were not reopened in this KPI-only fix queue and must not be treated as proven.

Historical validation run during the June 27, 2026 audit:

`npm test -- server/kpi-math.test.ts server/benchmark-math.test.ts server/revenue-additivity.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-retry-regression.test.ts server/alert-email-idempotency-regression.test.ts`

Result:

- 13 test files passed.
- 238 tests passed.

Historical limitation from the initial audit:

- this green suite did not prove production readiness at that time because `server/ga4-cross-tab-consistency.test.ts` encoded old percent ROAS expectations before the later fix.
- the historical June 27 status relied on later fix validation, deployment, UI validation, and applied cleanup evidence, but the June 28 audit found additional unproven paths that now block certification.

Commit 1-6 deployment and UI validation on June 27, 2026:

- Historical Commits 1-6 were implemented, committed, pushed, and deployed for the narrower June 27 bug set.
- Historical UI validation passed after deployment for the narrower GA4 KPI and Benchmark readiness fix queue.
- This is not evidence for the June 28 Current Commits 1-7 queue.

Out-of-scope note:

- broader report infrastructure remains outside this KPI-only certification except where reports directly consume GA4 KPI values.
- scheduled/test/manual/direct GA4 report KPI consumers are locally covered; deployed scheduler/provider evidence remains outside local proof.

## Not Locally Verifiable

The following require provider or explicit product-decision evidence:

- deployed validation of direct GA4 snapshot PDF preflight regeneration after this local follow-up is pushed
- live GA4 API token refresh behavior
- live GA4 processing latency
- deployed scheduler execution timing
- provider-side email delivery events
- actual inbox receipt

These external, manual, or deployed-runtime caveats do not override the local fixes, but they prevent a production-ready certification until they are validated or explicitly excluded by product decision.

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
