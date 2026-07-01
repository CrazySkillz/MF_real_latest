# GA4 Benchmarks Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply `AGENTS.md` and `PRODUCTION_READINESS.md`. Do not repeat any production-ready or status claim from this file unless the current request's complete Benchmark value inventory, post-fetch transforms, fallback branches, negative cases, lifecycle paths, downstream propagation matrix, and test evidence are covered by current documented evidence.

A previous production-ready statement is not evidence. A passing test suite is not enough unless it covers the traced Benchmark paths. KPI readiness evidence is not Benchmark readiness evidence unless the test or trace explicitly covers the Benchmark path being claimed. If any Benchmark path is incomplete, classify it as partially reviewed, not locally verifiable, or deferred, and update the Current Commit queue instead of calling that path production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Benchmarks` tab.

Use this file when asked whether GA4 Benchmarks are robust, accurate, logical, production-ready, or reusable as a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source.

`GA4/BENCHMARKS.md` defines the intended Benchmark tab behavior. This file defines the current certification status, proven paths, unproven paths, external caveats, and the exact Current Commit queue required before any future claim can be repeated.

## Current Status

As of July 1, 2026, after a strict current-code re-trace and focused Benchmark validation run, GA4 Benchmarks are **locally code-certified for the current GA4 Benchmarks tab path only**.

Full, unqualified GA4 Benchmark production readiness is **not clean-certified yet**. The remaining production-readiness blockers are now tracked as Current Commits in this file. Do not answer simply `GA4 Benchmarks are production-ready` without the local-code-scope qualifier until the Current Commit queue is completed and the evidence is recorded.

Status split:

- local current-code GA4 Benchmark tab certification: passed for the traced UI/API/storage/scheduler/alert/notification/report paths covered by this document and the focused Benchmark tests
- full unqualified production readiness: not certified yet because broader provider accuracy, deployed scheduler execution, deployed token-refresh failure simulation, and mock industry target-source status remain unproven
- future platform readiness: unproven; GA4 Benchmark evidence is only a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source

Certification result:

- completed historical local fixes: persisted GA4 Benchmark ROAS ratio semantics, GA4 primary-property campaign scoping, selected-property UI alignment after `Set as Primary`, ROAS copy correction, shared evaluated Benchmark route access hardening, and bounded persisted ROAS cleanup
- completed target cleanup evidence: pre-apply dry-run found 46 repair candidates and 56 skipped campaign-level reasons; apply updated 46 persisted ROAS rows; post-apply dry-run found 0 remaining repair candidates
- completed local Benchmark evidence: the June 29, 2026 focused Benchmark validation run passed 17 test files and 136 tests covering Benchmark math, current values, route isolation, alert lifecycle, notifications, email audit/idempotency/retry semantics, report consumers, auto-refresh, source lifecycle recompute, and scheduler current-value reconciliation
- current strict revalidation evidence: the June 30, 2026 focused Benchmark validation run passed 18 test files and 139 tests, including the Commit 3 provider-validation token-refresh guard, after re-tracing the current UI/API/storage/scheduler/alert/notification/report paths
- current documentation update: Current Commit 0 rewrites this file into the strict KPI-style certification structure without changing runtime behavior
- current validation-support update: Current Commit 2 adds a GA4 Benchmark provider validation endpoint and regression coverage; deployed validation found a live provider auth blocker and an apparent stored-current mismatch that required stricter window tracing
- current deployed Commit 2 evidence: Render validation on June 30, 2026 for campaign 8aa735ee-c02f-41e2-bb1f-7c3f43bb9458, property 542352127, and requested provider window 2026-06-19 through 2026-06-29 returned provider.status = live_provider_error with 401 UNAUTHENTICATED; the same response showed stored Benchmark Revenue 12376.38 versus requested-window candidate 21922.96
- current Commit 3 deployed validation: Commit 3 deployed validation passed with `provider.status = live_provider_success` and non-null provider totals for the same campaign/property/filter/requested window; revoked-token failure simulation remains unproven
- current Commit 4 deployed validation: validation-window alignment is implemented, pushed, deployed, and revalidated; `sourceWindows.currentValue` is `2026-06-24` through `2026-06-29`, `currentValueProvider.totals` is non-null, stored Benchmark Revenue `12376.38` equals `schedulerCandidateCurrentValue` `12376.38`, and `storedVsSchedulerDelta = 0`; the `storedVsUiDelta = 0.01` is a one-cent provider-versus-persisted rounding difference, not proven Benchmark damage
- current Commit 4 Follow-Up local fix: scheduler/report-preflight guards now track updated Benchmark row IDs, fail closed for Benchmark-section reports whose selected rows were not recomputed, and prevent duplicate Benchmark history rows for the same Benchmark/date even when an older report date is reprocessed after newer history exists
- current Commit 4 Follow-Up deployed report-preflight validation: Render validation on June 30, 2026 for Benchmark `989de4b3-e1e9-4891-8094-a010bcd59c43` and GA4 Benchmark report `eae94163-5608-4590-8dcd-7d927ba6b421` returned manual snapshot `200`, created snapshot `a5713490-f9b1-4548-9660-cbde32e372d5`, changed Benchmark `updatedAt` from `2026-06-30T12:16:31.780Z` to `2026-06-30T18:11:34.767Z`, kept `currentValue = 12376.38`, and kept Benchmark history count `5 -> 5`
- current Commit 4 Follow-Up scheduler-log search: Render log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines, so deployed daily scheduler timer proof remains unproven
- current Commit 4 Follow-Up deployed observability evidence: `/health/scheduler` on July 1, 2026 at `2026-07-01T08:46:39.004Z` showed the report scheduler running with cron `* * * * *`, `totalChecks = 748`, `lastCheckTime = 2026-07-01T08:46:00.007Z`, `lastScheduledReportsFound = 14`, `lastDueReportsFound = 12`, and no scheduler error; the same response showed GA4 daily scheduler `started = true`, `timerScheduled = true`, `runOnStartup = false`, `nextRunAt = 2026-07-01T12:15:00.000Z`, `nextDataThroughDate = 2026-06-30`, and `totalRuns = 0`, proving the daily timer was scheduled but not yet proving the daily pipeline executed
- current Commit 5 deployed validation: read-only Benchmark alert email delivery validation support is implemented, pushed, deployed, and user-confirmed as passed, including inbox receipt; exact endpoint JSON, provider response ID, delivered timestamp, recipient, and subject were not pasted into this chat, so this file records user-confirmed external validation rather than locally inspected raw evidence
- current Commit 6 validation: GA4 Benchmark edit/delete icon buttons now have stable accessible labels/titles; `server/ga4-benchmark-regression.test.ts` locally pins the route, tab, scoped API calls, lifecycle notification invalidation, blocked/insufficient states, unit rendering, and browser-PDF Benchmark path; `npm test -- server/ga4-benchmark-regression.test.ts` passed 10 tests on July 1, 2026; deployed Render UI validation was user-confirmed passed on July 1, 2026 for the GA4 Benchmarks tab at campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`
- outstanding production-readiness queue: deployed GA4 daily scheduler execution after the scheduled `2026-07-01T12:15:00.000Z` run plus Current Commit 7 below must be completed before full unqualified production readiness can be claimed; broader live-provider and token-failure caveats remain scoped to Commits 2 and 3 as documented
- not fully proven: live GA4 provider accuracy beyond the controlled validation endpoint, revoked-token failure handling, GA4 processing latency, deployed GA4 daily scheduler pipeline execution after the scheduled run, and mock industry target-source suitability

The current safe answer is:

`GA4 Benchmarks are locally code-certified for the current GA4 Benchmarks tab path. Full unqualified production readiness is not clean-certified yet because the Current Commit queue still contains provider/deployed/browser/industry-source proof work.`

This status should change only after:

- a Current Commit below is implemented and validated
- a new bug is found in a GA4 Benchmark value, lifecycle, scheduler, alert, notification, cleanup, or report-consumer path
- the GA4 Benchmark source model, provider configuration, scheduler behavior, alert/email behavior, report generation path, or downstream consumers change
- a future source/platform attempts to reuse GA4 evidence without its own source-specific proof

Certification rule:

- completed fixes make GA4 Benchmarks eligible for local code-scope certification; they are not full production certification by themselves
- the local-code answer can remain `locally code-certified for the current GA4 Benchmarks tab path` only while the complete value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, cleanup boundary, and test coverage remain covered by current evidence
- the full production-readiness answer must remain `not clean-certified yet` until all blocking Current Commits are completed or explicitly proven non-applicable with evidence

## Durable Future-Chat Answer

In a new chat session or on a later date, absent later GA4 Benchmark code changes, provider/config changes, failed validation, contradictory deployed evidence, newly reported bugs, or changed requirements, answer with this split:

`GA4 Benchmarks are locally code-certified for the current GA4 Benchmarks tab path. Full unqualified production readiness is not clean-certified yet until the Current Commit queue in GA4/BENCHMARKS_PRODUCTION_READINESS.md is completed and recorded.`

Do not reopen closed local-code GA4 Benchmark blockers solely because time has passed. Reopen only when a changed implementation, new value path, failed validation, or new bug affects the certified local Benchmark scope.

Do not claim full production readiness, deployed scheduler safety, deployed token-refresh failure safety, broad live provider accuracy, future browser/UI changes, or future-platform readiness until the relevant Current Commit evidence exists. Benchmark alert email provider/inbox validation is user-confirmed complete for the controlled Commit 5 send only, and Benchmark browser/deployed UI validation is user-confirmed complete for the controlled Current Commit 6 pass only; future sends and future UI changes require their own evidence before those claims are repeated.

This certification method is reusable as the Benchmark refinement and validation template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source. It is never proof that those sources are production-ready.
## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Complete GA4 Benchmark Value Inventory`
4. `End-To-End Trace Matrix`
5. `Downstream Propagation Matrix`
6. `Source/Lifecycle Matrix`
7. `Negative-Case Matrix`
8. `Test Coverage Matrix`
9. `Current Commit Queue`
10. `Not Locally Verifiable / External Caveats`
11. `Future Platform Template`

Answer that GA4 Benchmarks are locally code-certified for the current GA4 Benchmarks tab path, while full unqualified production readiness remains blocked by the Current Commit queue. Do not cite GA4 KPI readiness, Overview readiness, Ad Comparison readiness, Insights readiness, or Reports readiness as Benchmark proof. Reopen those sections only when a Benchmark path directly depends on them, and then trace only that narrow dependency.

## Future Source Reading Order

Use this order when adapting the GA4 Benchmark model to Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. target platform entry doc
5. target platform development workflow doc, if one exists
6. target platform Benchmark functional doc
7. target platform Benchmark production-readiness doc, if one exists
8. `GA4/BENCHMARKS.md` as the functional Benchmark template only
9. this file as the audit structure/template only
10. `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` only as a historical threshold/scoring appendix
11. `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` only as the alert/notification lifecycle template
12. target platform financial/source/refresh/report docs where the target Benchmark path touches revenue, spend, schedulers, alerts, notifications, or reports

Stable file roles:

- `GA4/BENCHMARKS.md` = what the GA4 Benchmark tab does
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md` = whether GA4 Benchmarks are production-ready and how to prove a future source
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` = historical threshold/scoring slice only
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` = alert, notification, email-audit, action URL, bell, and Notifications lifecycle template only

For a future source, prove source identity, account/property/customer scoping, selected campaign/ad set/ad group/sheet scope, current-value UI path, persisted recompute path, threshold policy, alert and notification path, scheduler/reprocess path, ownership checks, delete behavior, report consumers, provider/deployed evidence where required, and existing-data cleanup boundary before calling that source's Benchmarks production-ready.

## Current Scope

This local current-code certification applies to the current GA4 `Benchmarks` tab for:

- platform-scoped GA4 Benchmark list display
- visible GA4 Benchmark create, edit, and delete paths
- Benchmark current-value calculation for GA4 platform Benchmarks
- Benchmark tracker summary counts and average progress
- blocked and insufficient-data handling
- Benchmark alert and notification visibility
- Benchmark alert email eligibility and local audit behavior
- GA4 refresh, daily scheduler, source-refresh, and report preflight recompute paths that update Benchmark current values and Benchmark history
- GA4 campaign, property, source, and campaign-access scoping that can affect Benchmark values
- GA4 browser PDF and scheduled/server PDF Benchmark consumers
- narrow GA4 Insights consumers that directly read GA4 Benchmark status/history
- bounded existing persisted ROAS cleanup previously applied and verified

This local current-code certification does not certify:

- Meta Benchmarks
- Google Ads Benchmarks
- LinkedIn Benchmarks
- Google Sheets Benchmarks
- Custom Integration Benchmarks
- campaign-level Benchmark pages except for narrow shared helpers explicitly traced here
- provider-confirmed Benchmark alert email delivery
- actual Benchmark alert email inbox receipt
- live GA4 provider behavior outside what local code, tests, and documented deployed evidence can prove
- mock industry benchmark values as production industry-standard evidence

## Root Cause Of Prior Confusion / Prior Overclaim Risk

Earlier Benchmark readiness wording mixed several narrower slices:

- `GA4/BENCHMARKS.md` defined the intended product contract.
- threshold/scoring docs proved metric-aware Benchmark math.
- alert/notification docs proved much of the alert lifecycle.
- earlier readiness notes treated completed fixes as close to certification.

Those files and slices did not by themselves certify the whole Benchmark production lifecycle.

The later full Benchmark audit traced the persisted scheduler path and found a separate defect: GA4 Benchmark ROAS was displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persisted ROAS as a percent-like value. Platform GA4 alert checks, notification visibility, email eligibility, Benchmark history, and scheduled/server report consumers can read persisted Benchmark rows, so the defect was not limited to visible cards.

That defect and related property-scope, selected-property alignment, ROAS copy, shared evaluated-route access, and existing-data cleanup blockers have been fixed and validated. This file now separates:

- what is proven for the current GA4 Benchmark tab
- what was previously a non-current or deferred route alias
- what is external/provider evidence
- what is a future-platform template but never future-platform proof

## Non-Negotiable Accuracy Rules

GA4 Benchmarks must preserve:

- campaign ownership and campaign access checks
- GA4 property scoping
- selected GA4 campaign/source scoping
- imported revenue additivity
- spend-source provenance
- `ROAS = Revenue / Spend` as an `x` ratio, not a percent
- `ROI = (Revenue - Spend) / Spend * 100` as a percent
- `CPA = Spend / Conversions` as currency
- Pipeline Proxy exclusion from confirmed revenue, ROAS, ROI, CPA, Benchmarks, reports, and alerts
- metric-aware Benchmark status classification
- lower-is-better behavior for cost/spend-style Benchmarks
- blocked and insufficient-data exclusion from tracker counts and average progress
- one active in-app notification row per active GA4 Benchmark breach
- notification dismiss/clear as visibility only, not analytical resolution
- provider/API acceptance separated from confirmed email delivery
- stable API response shapes
- fail-closed behavior for missing campaign, missing ownership, invalid current value, invalid threshold, and stale/deleted Benchmark rows

Do not change Benchmark calculations, alert semantics, source ownership, scheduler behavior, report behavior, cleanup boundaries, or response shapes unless the exact path has been traced and the smallest safe Current Commit is identified.

## Complete GA4 Benchmark Value Inventory

| Value / surface | Source path | Formula / semantics | Scope and window | Downstream consumers | Current evidence status |
| --- | --- | --- | --- | --- | --- |
| Benchmark grid row count and tracker `Total Benchmarks` | GA4 Benchmark list query -> platform Benchmark rows | Count of GA4 Benchmark rows in current campaign/platform scope | Campaign + `google_analytics`; current saved rows | Benchmark tab UI, executive snapshot tracker | Route access, storage scope, and frontend query key traced; June 29 Benchmark tests passed |
| `On Track`, `Needs Attention`, `Behind`, `Avg. Progress` | Benchmark rows -> shared Benchmark math/status policy | Metric-aware progress, tolerance, lower-is-better direction, blocked/insufficient exclusions | Campaign + visible Benchmark rows | Tracker, Benchmark cards, browser PDF, Insights summaries | Shared math and GA4 Benchmark regression tests passed |
| Users, Sessions, Pageviews, Conversions | GA4 selected daily/to-date/breakdown values -> visible UI and persisted recompute job | Count totals, rounded as counts | Selected campaign, selected/primary GA4 property, GA4 campaign filter, completed GA4 reporting date where persisted | Benchmark cards, tracker, history, alerts, notifications, reports | Proven for current code scope by GA4 Benchmark regressions; live provider outages/token-refresh are external caveats |
| Revenue | selected scoped GA4 native financial revenue + active GA4-context imported revenue | `ga4Revenue + importedRevenue`; Pipeline Proxy excluded | GA4 native source stays selected GA4 financial source; imported source-backed window is active source records through current UTC day | Benchmark cards, ROAS, ROI, tracker, alerts, notifications, reports | Proven locally through Benchmark/financial/regression evidence; provider data accuracy external |
| Spend | active explicit GA4-context spend sources | Source-backed spend only; GA4 API does not supply spend by default | Campaign + active spend source records through current UTC day | ROAS, ROI, CPA, tracker, alerts, notifications, reports | Proven locally through source lifecycle recompute tests and financial source contract |
| ROAS | Revenue / active spend | Ratio displayed as `x`; persisted as ratio | Same campaign/source windows as Revenue and Spend | Benchmark card, history, alerts, notifications, reports | Historical blocker fixed; cleanup applied; ratio semantics regression passed |
| ROI | `(Revenue - Spend) / Spend * 100` | Percent | Same campaign/source windows as Revenue and Spend | Benchmark card, history, alerts, notifications, reports | Proven locally by shared financial and Benchmark coverage |
| CPA | Spend / conversions | Currency; lower is better; insufficient when spend or conversions are missing | Spend through current UTC source window; conversions from selected GA4 scope | Benchmark card, tracker, alerts, reports | Proven locally by Benchmark sufficiency and math coverage |
| Conversion Rate | Conversions / sessions * 100 | Percent with zero-session guard | GA4 selected campaign/property scope | Benchmark card, tracker, alerts, reports, Insights | Proven locally by Benchmark sufficiency and regression coverage |
| Engagement Rate | normalized GA4 engagement rate | Percent; requires sessions | GA4 selected campaign/property scope | Benchmark card, tracker, alerts, reports | Proven locally by visible/current-value and sufficiency coverage |
| Custom Benchmark rows | User-entered `currentValue`, `benchmarkValue`, `unit`, name/description | No guessed GA4 recompute; manual/custom current value is preserved unless user edits it | Campaign + `google_analytics`; saved row scope | Benchmark card, alerts if enabled, reports | Proven for visible create/edit path; no automatic source provenance |
| Benchmark target | user-entered `benchmarkValue` and selected unit | Required Benchmark target; industry lookup is not a certified target source | Campaign + platform row | Benchmark cards, tracker, alerts, reports | Proven for user-entered targets; mock industry lookup not certified |
| Descriptive metadata | `description`, `benchmarkType`, `source`, `industry`, `geoLocation`, `period`, `confidenceLevel`, `applyTo`, `specificCampaignId` | Persisted/display metadata only | Benchmark row scope | Cards, modal, reports where displayed | Proven as metadata; no current industry-autofill certification |
| Stored variance | `variance` | Historical/stored variance from route/history jobs; not live status authority | Benchmark row/history scope | History analytics, legacy fields | Proven as historical/stored field only |
| Data availability state | blocked, insufficient, invalid target | Missing dependency and sufficiency helpers; invalid benchmark guard | Current visible values and persisted recompute path | Cards, tracker, Insights, browser PDF | Proven locally |
| Alert settings | `alertsEnabled`, `alertThreshold`, `alertCondition`, `emailNotifications`, `emailRecipients`, `alertFrequency`, `lastAlertSent` | Saved Benchmark row and alert form | Campaign + Benchmark row | In-app alerts, email attempt/audit, notifications | Proven locally; provider delivery external |
| In-app notification values | title/details, action URL, current value, threshold value, condition, created date, `benchmarkId` metadata | `benchmark-notifications.ts` and `/api/notifications` enrichment | Active breached Benchmark row; campaign-scoped | Bell, Notifications page, action routing | Proven locally for active breached rows |
| Benchmark history analytics | `benchmark_history.currentValue`, `benchmarkValue`, `variance`, `performanceRating`, `recordedAt`, `notes`, analytics trend fields | `runGA4DailyKPIAndBenchmarkJobs`, `storage.recordBenchmarkHistory`, `storage.getBenchmarkAnalytics` | Auto GA4 daily history rows, where scheduler/reprocess wrote history | Insights, history views, reports where consumed | Proven locally; data exists only after scheduler/reprocess writes history |
| Browser GA4 PDF values | selected Benchmark rows, current/target/status/progress | Client-side PDF uses the same visible Benchmark helpers | Current browser state and selected custom report config | Browser downloads | Proven locally by source trace/regression coverage |
| Scheduled/server GA4 PDF values | persisted platform Benchmark rows after GA4 preflight recompute | Server report reads `getPlatformBenchmarks("google_analytics", campaignId)` | Campaign + saved report config; preflight date where supplied | Scheduled/test/manual report output and direct snapshot PDF dependency | Proven locally; deployed/provider delivery external |
| Mock industry benchmark values | `/api/industry-benchmarks/:industry/:metric` mock fallback | Demo-only lookup; not a production source of truth | Not exposed as current GA4 target autofill certification | None certified for current GA4 tab | Not certified; non-blocking because current GA4 Benchmark path uses user-entered targets |

Computable GA4 Benchmark metrics:

| Metric key | Current-value source | Unit semantics | Gating / sufficiency | Creation status |
| --- | --- | --- | --- | --- |
| `roas` | selected GA4 native revenue + active imported GA4 revenue, divided by active spend | Ratio `x` | Requires spend and revenue; insufficient if spend is below minimum | Visible template |
| `roi` | `(financialRevenue - financialSpend) / financialSpend * 100` | Percent | Requires spend and revenue; insufficient if spend is below minimum | Visible template |
| `cpa` | `financialSpend / financialConversions` | Currency; lower is better | Requires spend and conversions | Visible template |
| `revenue` | selected GA4 native financial revenue plus active imported GA4 revenue | Campaign currency | Requires revenue | Visible template |
| `conversions` | selected GA4 campaign/property conversions | Count | Count-aware tolerance; no revenue/spend dependency | Visible template |
| `conversionRate` | conversions / sessions * 100 | Percent | Requires sessions | Visible template |
| `engagementRate` | normalized GA4 engagement rate | Percent | Requires sessions | Visible template |
| `users` | selected GA4 users | Count | Count-aware tolerance | Visible template |
| `sessions` | selected GA4 sessions | Count | Count-aware tolerance | Visible template |
| `pageviews` | GA4 daily pageviews or fallback metrics pageviews | Count | Count-aware tolerance | Supported persisted metric; not a current create-template tile |
| custom / blank metric | user-entered current and benchmark values | User-selected unit | No automatic GA4 recompute | Visible custom template |

## End-To-End Trace Matrix

| Path | Source -> storage -> API/UI -> downstream trace | Evidence status |
| --- | --- | --- |
| List display | `client/src/pages/ga4-metrics.tsx` fetches `/api/platforms/google_analytics/benchmarks?campaignId=...`; route requires `ensureCampaignAccess`; storage reads exact platform + campaign rows | Proven |
| Create | Current GA4 tab posts `/api/benchmarks` with `campaignId` and `platformType: "google_analytics"`; route requires campaign access, validates schema, creates row, awaits in-app Benchmark alert reconciliation, awaits immediate Benchmark email check, and returns created row | Proven for current UI path |
| Edit | Current GA4 tab puts `/api/benchmarks/:id`; route uses `ensureBenchmarkAccess`, preserves existing `campaignId` and `platformType`, updates row, awaits in-app alert reconciliation and immediate email check | Proven |
| Delete | Current GA4 tab deletes `/api/platforms/google_analytics/benchmarks/:benchmarkId`; route uses `ensureBenchmarkAccess`, verifies route platform matches row platform, deletes Benchmark/history, and soft-hides related notifications | Proven |
| Ownership and scoping | `ensureBenchmarkAccess` requires actor, existing Benchmark, nonempty campaignId, and campaign access; list route requires campaign access before storage read | Proven |
| Live current-value display | Known GA4 metrics use selected GA4 values and financial source totals; custom rows use saved `currentValue`; edit modal prefills from the same live current-value resolver | Proven |
| Financial current values | Revenue = selected GA4 native financial revenue plus active imported GA4 revenue; spend = active explicit spend sources; ROAS ratio, ROI percent, CPA currency | Proven locally; live provider accuracy external |
| Blocked/dependency behavior | ROAS/ROI/CPA require spend; ROAS/ROI/revenue require revenue; blocked rows show unavailable current value and are excluded from scoring | Proven |
| Insufficient data behavior | Conversion/engagement rates need sessions; CPA needs conversions; financial ratios need spend; insufficient rows are excluded from scoring and shown as insufficient | Proven |
| Scheduler refresh | GA4 daily scheduler runs daily facts, then `runGA4DailyKPIAndBenchmarkJobs`, then Benchmark alert checks; source refresh paths run recompute before alert checks where immediate correctness is promised | Proven locally; deployed runtime external |
| Persisted Benchmark values | `runGA4DailyKPIAndBenchmarkJobs` reads selected GA4 connection/property, selected GA4 totals, imported GA4 revenue, spend, updates `currentValue`, and records once-per-date history | Proven locally |
| Alerts and notifications | Benchmark alert service evaluates active Benchmarks, keeps one active alert for breached GA4/campaign rows, resolves stale/non-breaches, and uses GA4 Benchmark deep links | Proven locally |
| Notification visibility freshness | `/api/notifications` enriches active performance alerts from linked Benchmark rows, recomputes GA4 current value for computable rows, hides orphan/cross-campaign/non-breaching rows, and uses no-store freshness | Proven locally |
| Alert emails | Create/update routes await immediate email attempts; scheduler/reminder/retry/idempotency paths are locally covered; provider acceptance is not delivery | Proven locally except provider/inbox delivery |
| Browser PDF | GA4 client-side PDF Benchmark section uses the same blocked/sufficiency/progress/current-value helpers as cards | Proven |
| Scheduled/server PDF | GA4 reports preflight runs GA4 KPI/Benchmark recompute; GA4-specific PDF builder reads `getPlatformBenchmarks("google_analytics", campaignId)` and outputs Benchmark rows | Proven locally |
| Direct GA4 snapshot PDF dependency | Direct snapshot PDF routes run suppress-alert GA4 KPI/Benchmark preflight before shared PDF generation | Proven locally as a Benchmark dependency; deployed direct-PDF evidence in KPI doc is not reused here as Benchmark proof |
| Insights downstream | GA4 Insights reads Benchmark rows, blocked/invalid/insufficient state, live progress, and Benchmark analytics history only when Insights is active | Proven only as a narrow direct Benchmark consumer |
| Non-current platform create alias | `POST /api/platforms/:platformType/benchmarks` is guarded and now awaits both in-app Benchmark alert reconciliation and immediate Benchmark email checks; current GA4 tab does not call it | Hardened locally by Current Commit 1 |
| Industry benchmark lookup | `/api/industry-benchmarks/:industry/:metric` can return mock fallback values | Not current certified target source; non-blocking while GA4 create/edit does not use industry autofill as production target evidence |

## Downstream Propagation Matrix

| Downstream consumer | Benchmark values consumed | Propagation rule | Status |
| --- | --- | --- | --- |
| GA4 Benchmarks cards | name, metric label, description, alerts icon, live/stored current, benchmark target, progress, delta, status, blocked/insufficient messages | Render campaign-scoped GA4 platform Benchmarks from current list query and live current-value helpers | Proven |
| Benchmark tracker | total, onTrack, needsAttention, behind, blocked, insufficient, avgPct | Aggregate only scorable rows; blocked/insufficient rows excluded | Proven |
| Create/edit modal | metric template, custom values, target, unit, description, alert/email settings, edit-current live prefill | Save user-entered target/current values through current GA4 UI path | Proven |
| Delete flow | Benchmark id/name, history rows, linked notifications | Delete selected Benchmark/history and soft-hide related notifications only | Proven |
| In-app alert service | current value, threshold, condition, campaign/platform metadata | Keep one active row only while breached; fail closed on missing/invalid data | Proven locally |
| Notifications bell/page | source-backed current value, threshold, condition, action URL, created date, platform label | Visible only while linked Benchmark exists, belongs to campaign, and still breaches | Proven locally |
| Alert email service | Benchmark row, resolved current value, recipients/frequency, audit/dedupe/retry state | Attempt/send semantics are durable; delivery requires provider/inbox evidence | Locally proven; delivery external |
| Benchmark history analytics | persisted current/target/variance/rating/notes | Created by scheduler/reprocess when data exists | Proven locally |
| Browser GA4 PDF downloads | visible current value, benchmark target, status/progress, blocked/insufficient messages, selected Benchmark IDs | Use browser state/current helpers | Proven |
| Scheduled/server GA4 PDF reports | persisted platform Benchmark rows after GA4 preflight recompute | Fail closed when GA4 KPI/Benchmark preflight skips/fails for covered paths | Proven locally |
| GA4 Insights tab | Benchmark blocked/invalid/insufficient state and history analytics | Narrow direct Benchmark consumer only | Proven locally for direct Benchmark dependency |
| GA4 Overview | No direct consumption of Benchmark rows | Upstream GA4/financial values feed Benchmarks; Overview readiness is not Benchmark proof | Out of scope except upstream dependency |
| GA4 KPIs | No direct consumption of platform Benchmark rows | Shared upstream values and math helpers only | Out of scope; do not use KPI evidence as Benchmark proof |
| GA4 Ad Comparison | No direct consumption of platform Benchmark rows | Shares upstream GA4/financial inputs only | Out of scope |
| Campaign DeepDive / Executive Summary | Uses campaign-level Benchmark rows, not GA4 platform Benchmark tab rows | Out of GA4 tab certification except shared threshold helper behavior | Out of scope |
| Source modals | No Benchmark-specific source modal | Financial source modals are upstream provenance for revenue/spend-derived Benchmarks | Upstream dependency, not Benchmark output |
| Exports/external webhooks | No separate Benchmark export/webhook path identified in this audit | Reports are the covered output path | No current separate consumer |

## Source/Lifecycle Matrix

| Lifecycle path | Current Benchmark status | Evidence / caveat |
| --- | --- | --- |
| Benchmark add/create | Current GA4 UI path uses `/api/benchmarks`, campaign access, schema validation, alert reconciliation, immediate email attempt, query invalidation, and notification refresh | Proven for current UI path |
| Benchmark edit/update | Current GA4 UI path uses `/api/benchmarks/:id`, `ensureBenchmarkAccess`, immutable campaign/platform scope, alert reconciliation, immediate email attempt, query invalidation, and notification refresh | Proven |
| Benchmark delete | Current GA4 UI path uses GA4 platform delete route, verifies platform/campaign access, deletes history, soft-hides related notifications, and refreshes notifications | Proven |
| Non-current platform create alias | Guarded by campaign access and now awaits in-app alert reconciliation before responding | Proven locally by Current Commit 1 regression; still not the current GA4 UI create path |
| GA4 native metric refresh | GA4 daily/on-demand refresh writes selected campaign/property facts and then recomputes Benchmarks | Proven locally; live provider/runtime external |
| Revenue source add/edit/delete | Active revenue source changes recompute GA4 KPI/Benchmark values before alert checks where immediate correctness is promised | Proven locally by source lifecycle recompute coverage; individual source UI modals are upstream and not Benchmark-certified here |
| Spend source add/edit/delete | Active spend source changes recompute GA4 KPI/Benchmark values before alert checks where immediate correctness is promised | Proven locally by source lifecycle recompute coverage; individual source UI modals are upstream and not Benchmark-certified here |
| Source modal/list display | No Benchmark-specific source modal; revenue/spend provenance comes from GA4 financial source docs and Overview financial paths | Upstream dependency; not a Benchmark output |
| Totals/recompute path | `runGA4DailyKPIAndBenchmarkJobs` recomputes persisted Benchmark current values and history after GA4/source refresh | Proven locally |
| Alert lifecycle | Create/update/recompute evaluates breaches; disabled/non-breached/deleted rows resolve or hide; dismissed still-breached rows can be recreated by valid reconciliation | Proven locally |
| Notification visibility lifecycle | `/api/notifications` fail-closes missing/orphan/cross-campaign/non-breaching rows and uses active source-backed current values | Proven locally |
| Email lifecycle | Immediate/reminder email attempts use audit/dedupe/retry semantics and do not equate provider acceptance with delivery | Locally code-ready; provider/inbox delivery external |
| Report lifecycle | Browser and server reports consume current or preflight-recomputed Benchmark rows; covered paths fail closed on preflight failure | Proven locally |
| Scheduler lifecycle | GA4 daily and source-refresh paths update persisted Benchmark values before alert checks | Proven locally; deployed timing after this doc update external |
| Existing damaged data | Prior ROAS percent-style persisted rows were bounded, dry-run inventoried, applied only for proven rows, and post-apply dry-run found 0 remaining candidates | Cleanup complete for known boundary; skipped rows intentionally left unchanged when exact source boundary was unproven |

## Negative-Case Matrix

| Negative case | Expected behavior | Evidence status |
| --- | --- | --- |
| Missing campaign id on current create/list path | Fail closed or return no rows; do not expose unrelated Benchmarks | Proven |
| User lacks campaign access | Route stops before storage read/mutation | Proven by route trace/tests |
| Platform route asked for campaign-level Benchmark rows | Return not found / do not leak campaign-level rows into platform routes | Proven by route isolation tests |
| Update attempts to change campaign or platform scope | Preserve existing campaign/platform and delete mutable payload fields | Proven |
| Delete attempts wrong platform route | Return not found; do not delete row | Proven |
| Missing revenue for revenue/ROAS/ROI Benchmark | Block or mark unavailable; do not score as poor or healthy | Proven |
| Missing or zero spend for ROAS/ROI/CPA | Mark blocked/insufficient; do not divide into misleading values | Proven |
| Missing conversions for CPA | Mark insufficient; do not score as valid CPA | Proven |
| Missing sessions for conversion/engagement rate | Mark insufficient; do not score | Proven |
| Invalid or zero Benchmark target | Exclude from scoring; show invalid/unavailable state | Proven |
| Lower-is-better cost Benchmark | Invert direction correctly for CPA/CPC/CPM/CPL/spend-style custom rows | Proven by shared math tests |
| Custom/unsupported Benchmark | Preserve saved current value; no guessed GA4 recompute | Proven for current custom path |
| Persisted ROAS old percent-style values | Correct only rows with proven GA4 source boundary; leave unproven rows untouched with skip reason | Completed cleanup evidence |
| Stale active notification after Benchmark no longer breaches | `/api/notifications` hides the row after source-backed re-evaluation | Proven locally |
| Deleted Benchmark with active alert | Soft-hide related notifications without deleting unrelated history | Proven |
| Dismissed still-breached Benchmark | Dismissal is visibility only; valid reconciliation may recreate one scoped active alert | Proven locally |
| Missing linked Benchmark from notification | Fail closed and hide active notification row | Proven locally |
| Benchmark alert email provider accepts send | Record acceptance/audit state; do not call it delivered without provider event or inbox receipt | Proven locally; delivery external |
| Non-current platform create alias creates breached Benchmark | Alias must complete scoped in-app alert reconciliation before response | Proven locally by Current Commit 1 regression |
| Mock industry lookup returns a value | Do not treat as production industry-standard Benchmark proof | Documented non-certified path |
| Live GA4 processing delay | Later refetch may change source values; do not treat delay as local calculation bug without provider evidence | External caveat |

## Test Coverage Matrix

Local test evidence is Benchmark-specific where the path affects Benchmarks. KPI-only evidence is not reused as Benchmark proof.

Focused validation recorded June 29, 2026 and rerun June 30, 2026 during strict clean-certification revalidation:

`npm test -- server/benchmark-math.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/benchmark-route-isolation-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-retry-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts`

Current rerun result after Current Commit 3 local implementation: 18 test files passed, 139 tests passed. `npm run check` also passed.

Current Commit 5 focused validation on June 30, 2026: `npm test -- server/benchmark-alert-email-delivery-validation-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-retry-regression.test.ts` passed: 6 test files, 30 tests. `npm run check` also passed.

| Coverage area | Test / validation source | What it proves for Benchmarks | Remaining gap |
| --- | --- | --- | --- |
| Metric-aware Benchmark math | `server/benchmark-math.test.ts` | progress/status direction, lower-is-better cost metrics, zero/invalid target handling, blocked/insufficient exclusions | Does not prove GA4 provider data accuracy |
| GA4 Benchmark visible/current-value behavior | `server/ga4-benchmark-regression.test.ts` and GA4 tab route/UI trace | GA4 platform Benchmark current values, list/create/edit/delete behavior, blocked/insufficient states, accessible edit/delete controls, and browser-PDF source path are locally pinned | Deployed browser visual check remains external |
| ROAS ratio semantics | `server/ga4-kpi-benchmark-roas-regression.test.ts` | ROAS uses ratio `x` semantics for GA4 KPI/Benchmark shared financial path | Does not prove future source ROAS paths |
| Benchmark summary/tracker | `server/ga4-kpi-benchmark-summary-regression.test.ts` | tracker counts and averages exclude blocked/insufficient rows | Does not prove future UI redesigns |
| Alert lifecycle | `server/benchmark-alert-lifecycle-regression.test.ts` | one active alert, stale resolution, deletion/disable behavior, dismissed still-breached recreation | Provider email delivery remains external |
| Route isolation/access | `server/benchmark-route-isolation-regression.test.ts` | campaign/platform route isolation, guarded access, and platform create alias alert reconciliation ordering | Alias timing covered locally; provider/deployed evidence remains separate |
| Commit 2/3/4 provider validation support | `server/ga4-benchmark-provider-validation-regression.test.ts` plus deployed endpoint evidence | campaign-scoped validation route reads requested provider, scheduler/current-value provider, persisted daily, financial, and Benchmark inputs; compares stored Benchmark current values to scheduler/current-value-window candidates; does not mutate Benchmark rows, history, sources, alerts, notifications, or reports; token metadata may refresh only after provider auth failure | Controlled deployed validation now passes for provider auth and validation-window alignment; revoked-token failure simulation, broad provider availability, scheduler runtime, and UI remain external |
| Notification visibility | `server/notification-visibility-regression.test.ts` | stale/orphan/cross-campaign/non-breaching notifications fail closed; GA4 deep links and no-store freshness | Browser notification UI not rerun after this doc-only update |
| Immediate email route behavior | `server/alert-email-regression.test.ts`, `server/alert-email-immediate-route-regression.test.ts` | immediate Benchmark email attempts, audit semantics, no false delivery claims in local code | Future sends still need per-send provider/inbox evidence before delivery is claimed |
| Benchmark alert email delivery validation endpoint | `server/benchmark-alert-email-delivery-validation-regression.test.ts` plus user-confirmed deployed validation | read-only Benchmark-scoped audit evidence endpoint is access-guarded, filters exact Benchmark alert email rows, exposes provider response/delivery status, and does not send or mutate email records; controlled deployed provider/inbox validation passed by user confirmation | Exact raw endpoint JSON and inbox metadata were not pasted into this chat |
| Email idempotency/retry/scheduler | `server/alert-email-idempotency-regression.test.ts`, `server/alert-email-scheduler-regression.test.ts`, `server/alert-email-delivery-regression.test.ts`, `server/alert-email-retry-regression.test.ts` | dedupe, retry, scheduler email audit behavior, provider acceptance handling | Future provider event/inbox confirmation remains per-send evidence, not a blanket guarantee |
| Report consumers | `server/ga4-kpi-report-consumer-regression.test.ts` plus report route trace | GA4 scheduled/test/manual snapshot/direct PDF paths run GA4 preflight before report output; Benchmark-section reports require selected Benchmark rows to be recomputed before PDF/snapshot/email continues | Deployed report execution remains external |
| Scheduler/runtime observability | `server/ga4-scheduler-observability-regression.test.ts`, `server/ga4-daily-scheduler-regression.test.ts` | `/health/scheduler` exposes GA4 daily scheduler status; report scheduler metrics update on each check; report send-event evidence endpoint is guarded and read-only | Deployed health/send-event evidence pending |
| Auto-refresh and scheduler recompute | `server/ga4-auto-refresh-regression.test.ts`, `server/campaign-scheduler-current-value-regression.test.ts`, `server/ga4-kpi-financial-window-regression.test.ts` | GA4 refresh/scheduler paths run Benchmark recompute before alert/report consumers where covered; scheduler updates Benchmark current values and does not insert duplicate same-date Benchmark history when older report dates are reprocessed | Deployed scheduler runtime external |
| Source lifecycle recompute | `server/ga4-source-lifecycle-recompute-regression.test.ts` | revenue/spend source changes recompute GA4 Benchmark current values before covered alert checks | Live source-provider correctness external |
| Existing damaged-data cleanup | dry-run/apply/post-apply cleanup evidence recorded in this file | known persisted ROAS percent-style rows corrected only inside proven boundary; 0 remaining candidates after apply | Skipped rows remain intentionally unmodified because exact boundary was unproven |
| Deployed/UI validation | Current Commit 6 local guard plus user-confirmed deployed Render browser pass on July 1, 2026 | local browser-facing source path is pinned; deployed GA4 Benchmarks tab loaded and visible edit/delete controls were user-confirmed after commit `69ea9505` | Raw screenshots/network traces are not locally visible; future UI changes require a fresh pass |

Coverage rule:

- If a future answer needs provider delivery, deployed scheduler, or live GA4 API proof, the local test run is not enough.
- If a future code change affects any matrix row above, rerun or extend tests for the changed row before repeating the production-ready answer.

## Documentation Alignment Check

| Source doc | Alignment result | Status |
| --- | --- | --- |
| `AGENTS.md` | This file separates proven, partially reviewed, external, and deferred paths; does not use past claims as evidence | Aligned |
| `ARCHITECTURE_USER_JOURNEY.md` | GA4 Benchmarks remain inside the campaign-level platform analytics journey: client -> campaign -> connect GA4/source data -> analyze -> act | Aligned |
| `PRODUCTION_READINESS.md` | Includes value inventory, lifecycle matrix, downstream matrix, negative cases, test evidence, cleanup boundary, current commits, and external caveats | Aligned |
| `GA4/README.md` | Treats GA4 docs as canonical and does not redesign platform/user journey | Aligned |
| `GA4_DEVELOPMENT_WORKFLOW.md` | Preserves source checklist discipline for revenue, spend, scheduler, provenance, and downstream propagation | Aligned |
| `GA4/BENCHMARKS.md` | Certification follows the documented Benchmark tab contract and current metric semantics | Aligned after ROAS ratio/copy fixes |
| `GA4/KPIS_PRODUCTION_READINESS.md` | Uses KPI readiness only as structure/process template; not as Benchmark proof | Aligned |
| `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` | Uses threshold/scoring history only where Benchmark math/status path is directly shared and tested | Aligned |
| `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` | Uses alert/notification lifecycle rules for Benchmark-specific alert paths; does not reuse KPI provider delivery as Benchmark delivery proof | Aligned |
| `GA4/FINANCIAL_SOURCES.md` | Revenue/spend inputs, Pipeline Proxy exclusion, UTC source windows, active source behavior, and additive imported revenue are treated as upstream dependencies | Aligned |
| `GA4/REFRESH_AND_PROCESSING.md` | Scheduler/reprocess paths are treated as required Benchmark current-value propagation paths | Aligned |

Known doc caveat:

- This file locally code-certifies the current GA4 Benchmarks tab path only and keeps full unqualified production readiness blocked until the Current Commit queue is completed. Future platform docs may copy the structure, but must replace every GA4-specific source, scope, lifecycle, downstream, and test row with target-platform evidence.

## Current Commit Queue

Current Commit status as of this document update:

- Current Commit 0 is implemented by this file rewrite and is required for clean future certification answers.
- Current Commit 1 is implemented: the non-current create alias now awaits in-app Benchmark alert reconciliation before responding.
- Remaining Current Commit evidence for Commits 2, 3, 4 Follow-Up, and 7 is blocking for full unqualified GA4 Benchmark production readiness because it provides the still-missing broad provider, token-failure, deployed scheduler, and target-source evidence.
- Until the remaining Current Commit evidence is complete, do not claim full unqualified GA4 Benchmark production readiness. Claim only local current-code certification plus the specifically recorded controlled deployed validations.

### Current Commit 0 - Rewrite GA4 Benchmarks Readiness Into Strict Certification Document

Root cause:

Prior Benchmark readiness documentation mixed completed fixes, partial audit notes, historical threshold evidence, alert/notification evidence, and certification language. That made it possible for a future chat to repeat a production-ready answer without first checking the complete Benchmark value inventory, downstream propagation, lifecycle paths, negative cases, cleanup boundary, and external caveats.

Files expected:

- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`

Required behavior:

- The document must be the canonical GA4 Benchmark readiness source.
- It must use the same certification discipline as `GA4/KPIS_PRODUCTION_READINESS.md`.
- It must include all required sections: anti-overclaim rule, purpose, current status, durable future-chat answer, use instructions, reading order, current scope, prior confusion/root cause, non-negotiable rules, complete value inventory, end-to-end trace matrix, downstream matrix, lifecycle matrix, negative-case matrix, test matrix, documentation alignment, Current Commits, external caveats, and future-platform template.
- It must not use KPI readiness as Benchmark proof.
- It must not imply provider/deployed evidence that has not been validated.

Validation:

- Read required source docs in the requested order.
- Inspect the updated document headings and content for the required structure.
- Run markdown/diff hygiene validation (`git diff --check -- GA4/BENCHMARKS_PRODUCTION_READINESS.md`).
- Do not run runtime tests solely for this documentation rewrite unless the document update changes runtime code; it does not.

Implementation status:

Implemented. Runtime behavior unchanged.

### Current Commit 1 - Harden Or Classify The Non-Current Platform Benchmark Create Alias

Root cause:

The current GA4 Benchmarks tab creates rows through `POST /api/benchmarks`, which awaits in-app Benchmark alert reconciliation and immediate Benchmark email checks. Before Current Commit 1, the non-current alias `POST /api/platforms/:platformType/benchmarks` was campaign-access guarded and awaited immediate Benchmark email checks, but started in-app Benchmark alert reconciliation fire-and-forget. That could return before an immediately breached Benchmark's in-app alert state was reconciled if the alias became a current UI/API caller.

Files expected:

- `server/routes-oauth.ts`
- `server/benchmark-route-isolation-regression.test.ts` or a narrowly named new Benchmark alias regression test, if a new test is clearer
- this file, to record whether the alias is hardened or formally classified as guarded legacy

Required behavior:

- If the alias is retained as a current or externally supported create route, it must await the same in-app Benchmark alert reconciliation semantics as `/api/benchmarks` before responding.
- It must preserve existing campaign access checks, platform/campaign scoping, response shape, email attempt behavior, and error handling.
- It must not broaden the alias to campaign-level Benchmarks or unrelated platforms.
- If the alias is confirmed unreachable and intentionally legacy, document that reachability and keep it guarded; do not remove it without a separate route-deprecation audit.

Validation:

- Add or extend a regression proving that creating a breached GA4 Benchmark through the alias completes scoped in-app alert reconciliation before the response, or proving the alias is non-current guarded legacy.
- Re-run route isolation and alert lifecycle tests affected by the change.
- Verify current GA4 UI still uses `/api/benchmarks` and remains unchanged.

Implementation status:

Implemented. The alias is retained and now awaits the same in-app Benchmark alert reconciliation semantics before responding, while preserving existing campaign access checks, platform/campaign scoping, response shape, and immediate email attempt behavior.

### Current Commit 2 - Prove Live GA4 Provider Accuracy And Processing Freshness For Benchmark Inputs

Root cause:

Local tests and code traces prove formulas and source routing, but they do not prove that live GA4 provider responses for a real connected property match the values used by the GA4 Benchmarks tab, persisted recompute job, notifications, and reports. GA4 processing latency can also make a value temporarily unavailable or delayed without being a local calculation bug.

The narrower local root cause for this Current Commit was a proof-surface gap: existing GA4 diagnostics reported acquisition totals and warnings, but did not return a Benchmark-specific inventory that shows live provider totals, persisted daily fallback inputs, financial source inputs, stored Benchmark current values, scheduler-candidate current values, and UI-candidate current values together for the same campaign/property/date window.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record exact campaign/property/date-range evidence after validation
- optional validation note or runbook file if the project keeps deployed validation artifacts separately

Required behavior:

- For a controlled GA4 campaign/property/date range, verify live provider values for users, sessions, pageviews, conversions, engagement rate, GA4 native revenue, imported GA4 revenue, spend, ROAS, ROI, CPA, conversion rate, and any selected Benchmark row using those inputs.
- Expose a validation-support path that is campaign-access guarded and reports live provider totals, persisted daily inputs, active imported revenue/spend inputs, stored Benchmark current values, scheduler-candidate current values, and UI-candidate current values without mutating Benchmark rows, history, alerts, notifications, reports, or source records. Token metadata may refresh only as part of Current Commit 3 auth-failure handling.
- Confirm the same source window and campaign/property filter used by the UI is visible beside the scheduler/recompute source window for persisted Benchmark current values; where UI and scheduler windows intentionally differ, record that distinction instead of hiding it.
- Document GA4 processing-latency expectations: what is considered normal delay, what must fail closed, and what must not be called a local defect without provider evidence.
- If provider values differ from local outputs, lower the affected Benchmark path to unproven and add a narrower runtime fix commit before certification.

Validation:

- Local regression: `npm test -- server/ga4-benchmark-provider-validation-regression.test.ts`.
- Live provider evidence capture path: `GET /api/campaigns/<campaignId>/ga4-benchmark-provider-validation?propertyId=<propertyId>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>` in an authenticated tenant session with a real GA4 property.
- Capture live GA4 provider request/response evidence for the exact campaign, property, filter, and date range used.
- Compare provider totals to visible Benchmark card current values and persisted Benchmark current values after recompute.
- Validate blocked/insufficient behavior for a missing or delayed provider value.
- Re-run the focused Benchmark test suite after any code change caused by this validation.

Implementation status:

Partially revalidated with deployed evidence. Deployed Commit 2 validation failed with `provider.status = live_provider_error` and `401 UNAUTHENTICATED` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, campaign filter `yesop_email_nurture` + `yesop_retargeting` + `yesop_paid_social`, and requested provider window `2026-06-19` through `2026-06-29`.

Commit 3 deployed validation passed with `provider.status = live_provider_success`, non-null provider totals, and unchanged campaign/property/filter/requested window. This clears the live provider auth blocker for the controlled validation path, but it does not by itself prove revoked-token failure handling, deployed scheduler execution, report-preflight runtime behavior, browser UI behavior, or full production readiness.

The apparent `12376.38` versus `21922.96` mismatch was not safe to classify as stale stored Benchmark data. Current Commit 4 RCA found that the validation endpoint compared a stored current value produced by the scheduler/current-value window against a manually requested provider window. The deployed Current Commit 4 revalidation now proves the stored value `12376.38` matches `schedulerCandidateCurrentValue` `12376.38` for `sourceWindows.currentValue = 2026-06-24` through `2026-06-29`. No Benchmark-row mutation or cleanup is justified by this finding. Full unqualified GA4 Benchmark production readiness remains blocked by the remaining Current Commit queue.

### Current Commit 3 - Prove Deployed OAuth Token Refresh And Tenant Failure Handling

Root cause:

Local code traces showed token refresh branches in other GA4 paths, but deployed Commit 2 validation proved the GA4 Benchmark provider validation path itself failed with `401 UNAUTHENTICATED` instead of refreshing the campaign/property-scoped OAuth token and retrying. That made the validation tool unable to prove live GA4 provider accuracy for the selected Benchmark input window.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record exact deployed validation evidence
- optional deployed validation runbook/artifact if the project keeps one

Required behavior:

- A deployed GA4 Benchmark provider validation path with an expired access token and valid refresh token must refresh, persist updated token metadata, and retry using the same campaign/property/filter/date window.
- A revoked, missing, or invalid refresh token must fail closed with `provider.status = live_provider_refresh_failed` and must not substitute unrelated property/account/campaign data.
- The validation path must not mutate Benchmark rows, Benchmark history, sources, alerts, notifications, reports, or source records.
- The visible tab, scheduler/recompute, notification freshness, and report preflight paths must either use valid refreshed data or expose/hide unavailable values without misleading Benchmark results.

Validation:

- Run the deployed validation endpoint again for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `startDate=2026-06-19`, and `endDate=2026-06-29` after this fix is deployed.
- Confirm the response returns `provider.status = live_provider_success_after_refresh` or `live_provider_success`, includes non-null `provider.totals`, and keeps the same campaign/property/filter/window.
- Confirm refreshed token persistence and unchanged campaign/property scope.
- Run or observe GA4 Benchmark list/current-value, scheduler/recompute, notification freshness, and report preflight behavior after refresh.
- Capture failure behavior for invalid refresh credentials or document why it cannot be safely simulated.

Implementation status:

Implemented and deployed for the controlled provider-access blocker. Deployed revalidation returned `provider.status = live_provider_success` and non-null provider totals for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, requested provider window `2026-06-19` through `2026-06-29`, and the expected campaign filter. The endpoint still returns `live_provider_success_after_refresh` on a successful refresh retry and `live_provider_refresh_failed` if refresh/retry fails. Revoked-token failure simulation remains unproven, so this is not full unqualified token-failure production readiness.

### Current Commit 4 - Align Validation Candidates To The Scheduler Current-Value Window

Root cause:

The deployed validation endpoint correctly exposed live provider totals, persisted daily totals, financial inputs, and stored Benchmark values side by side. However, it used the manually requested provider window as the source for `schedulerCandidateCurrentValue` and `uiCandidateCurrentValue`. That overcompared stored Benchmark current values against a window the actual scheduler does not use. `runGA4DailyKPIAndBenchmarkJobs` computes persisted GA4 Benchmark current values from the campaign start/creation date through the selected complete end date, plus the GA4 financial source window. Therefore the apparent `12376.38` versus `21922.96` mismatch was a validation-window defect, not proven damaged Benchmark data.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record the RCA and deployed revalidation evidence

Required behavior:

- The validation endpoint must keep the requested provider window visible for provider freshness evidence.
- It must also expose a separate `sourceWindows.currentValue` window matching the scheduler/current-value window.
- `schedulerCandidateCurrentValue` and `uiCandidateCurrentValue` must be computed from the current-value window, not from an arbitrary requested provider window.
- The endpoint must not mutate Benchmark rows, Benchmark history, sources, alerts, notifications, reports, or source records.
- Token metadata may still refresh only after provider auth failure, as established in Current Commit 3.

Validation:

- Rerun the deployed validation endpoint for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `startDate=2026-06-19`, and `endDate=2026-06-29` after this fix is deployed.
- Confirm `sourceWindows.provider` remains `2026-06-19` through `2026-06-29`.
- Confirm `sourceWindows.currentValue` starts at the campaign start/creation date and ends at `2026-06-29`.
- Confirm `currentValueProvider.totals` is non-null, `inputSets.schedulerInputSource` is `live_provider_current_value_window` or an explicit current-value persisted fallback, and stored deltas are evaluated against that current-value window.
- If a delta remains after the window correction, only then classify it as a stored Benchmark current-value freshness/recompute bug and add the next smallest fix.
- Deployed scheduler execution and report-preflight runtime behavior still need separate evidence after this validation-window fix.

Implementation status:

Implemented, pushed, deployed, and revalidated for validation-window alignment. Deployed evidence for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, requested provider window `2026-06-19` through `2026-06-29`, and current-value window `2026-06-24` through `2026-06-29` returned `currentValueProvider.totals` as non-null. Stored Benchmark Revenue `12376.38` matched `schedulerCandidateCurrentValue` `12376.38` with `storedVsSchedulerDelta = 0`. `uiCandidateCurrentValue` was `12376.39`, a one-cent persisted-daily rounding difference from provider totals, not proven Benchmark damage. This endpoint still does not recompute or update Benchmark rows.

### Current Commit 4 Follow-Up - Prove Deployed Scheduler And Report-Preflight Benchmark Recompute

Root cause:

The validation-window fix proved the controlled endpoint compared stored Benchmark current values against the correct scheduler/current-value window, but the scheduler/report proof was still too broad in two places:

- `runGA4DailyKPIAndBenchmarkJobs` returned only `benchmarksRecorded`, which counts newly inserted history rows, not Benchmark rows whose `currentValue` was actually refreshed. Report preflight could therefore prove only that the campaign was processed, not that Benchmark-section rows selected for report output were recomputed.
- Benchmark history de-duplication checked only the latest history row. If an older report date was reprocessed after newer history existed, the job could insert another history row for the same Benchmark/date.

The deployed follow-up RCA found an additional proof-surface gap, not a Benchmark calculation defect:

- GA4 daily scheduler runtime state was observable only through stdout logs. Render log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines, which did not prove the scheduler failed but also did not prove the timer ran.
- `/health/scheduler` exposed report scheduler metrics only; it did not expose GA4 daily scheduler timer state, next run, last trigger, or run counts.
- Report scheduler health fields `totalChecks` and `lastCheckTime` existed but were not updated inside `checkScheduledReports`, so the health endpoint could not prove the scheduled-send checker was actually running.
- `report_send_events` held scheduled-send runtime evidence, but there was no report-access-guarded read-only endpoint to inspect it for a specific scheduled GA4 Benchmark report without direct database access.

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- `server/report-scheduler.ts`
- `server/ga4-daily-scheduler.ts`
- `server/index.ts`
- `server/routes-oauth.ts`
- `server/ga4-kpi-financial-window-regression.test.ts`
- `server/ga4-kpi-report-consumer-regression.test.ts`
- `server/ga4-daily-scheduler-regression.test.ts`
- `server/ga4-scheduler-observability-regression.test.ts`
- this file, to record exact scheduler/report-preflight evidence
- optional scheduler/deployment validation artifact if the project keeps one

Required behavior:

- The deployed GA4 daily scheduler must run `runGA4DailyKPIAndBenchmarkJobs` for eligible campaigns and update only the intended campaign/property-scoped GA4 Benchmark rows.
- `runGA4DailyKPIAndBenchmarkJobs` must expose which Benchmark row IDs were updated so report preflight can verify Benchmark-section rows instead of accepting only `campaignsProcessed > 0`.
- Scheduler and report preflight must fail closed when the campaign, property, source context, or selected Benchmark recompute cannot be verified.
- Scheduled/server report outputs must use successfully recomputed Benchmark rows or skip/fail without creating misleading sent/downloadable output.
- Duplicate processing must not produce duplicate Benchmark history rows for the same Benchmark/date, including reprocessing an older date after newer history exists.
- `/health/scheduler` must expose read-only GA4 daily scheduler status, including timer scheduled state, configured schedule, next run, last run trigger/status, and run counts.
- Report scheduler health metrics must update on each scheduled check so deployed runtime observation does not depend only on log search.
- Report send-event evidence must be readable through a report-access-guarded, read-only endpoint that does not send, retry, recompute, snapshot, or mutate report rows.

Validation:

- Local focused validation: `npm test -- server/ga4-kpi-financial-window-regression.test.ts server/ga4-kpi-custom-preservation-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts server/ga4-benchmark-provider-validation-regression.test.ts` passed on June 30, 2026: 8 files, 35 tests. `npm run check` also passed.
- The scheduler regression proves Benchmark `currentValue` updates are counted in `benchmarksUpdated`/`benchmarkIdsUpdated` and same-date history is not reinserted when the target date is not the latest history row.
- The report-preflight regression proves GA4 Benchmark-section reports inspect selected Benchmark rows, require `benchmarkIdsUpdated`, and fail closed with `GA4 Benchmark recompute skipped selected Benchmark rows` before scheduled/test/manual/direct report output continues.
- Deployed manual snapshot/report-preflight validation passed on June 30, 2026: `snapshotStatus = 200`, report type `benchmarks`, `passedPreflight = true`, `recomputedBenchmark = true`, `noDuplicateHistory = true`, Benchmark `updatedAt` changed from `2026-06-30T12:16:31.780Z` to `2026-06-30T18:11:34.767Z`, and history count stayed `5 -> 5`.
- Deployed scheduler-log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines. This is not proof the scheduler failed, but it is also not proof the daily scheduler timer ran.
- Local observability validation on June 30, 2026: `npm test -- server/ga4-scheduler-observability-regression.test.ts server/ga4-daily-scheduler-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts server/alert-email-scheduler-regression.test.ts` passed: 5 files, 23 tests. `npm run check` also passed.
- Deployed `/health/scheduler` evidence captured July 1, 2026 at `2026-07-01T08:46:39.004Z`: report scheduler `schedulerStartedAt = 2026-06-30T20:18:16.607Z`, `cronSchedule = * * * * *`, `totalChecks = 748`, `lastCheckTime = 2026-07-01T08:46:00.007Z`, `lastCheckFinishedAt = 2026-07-01T08:46:06.019Z`, `lastScheduledReportsFound = 14`, `lastDueReportsFound = 12`, `lastError = null`; GA4 daily scheduler `started = true`, `timerScheduled = true`, `runOnStartup = false`, `nextRunAt = 2026-07-01T12:15:00.000Z`, `nextDataThroughDate = 2026-06-30`, `lastRunStatus = idle`, and `totalRuns = 0`.
- Deployed report send-event evidence captured for GA4 Benchmark report `eae94163-5608-4590-8dcd-7d927ba6b421`: `scheduledSendObserved = true`, `sentEventObserved = false`, `latestStatus = pending_delivery`, event `4db453e7-81e6-468a-9250-fe4bf0cd42a5`, `scheduledKey = 2026-07-01T09:00@Europe/Amsterdam`, `createdAt = 2026-07-01T07:02:05.251Z`, `recipientCount = 1`, `snapshotId = null`, `sentAt = null`, and error text `Mailgun accepted the email, but delivery was not confirmed yet`.
- Deployed follow-up still required: after `2026-07-01T12:15:00.000Z` UTC / `2026-07-01 14:15 Europe/Amsterdam`, recapture `/health/scheduler` and verify GA4 daily scheduler `totalRuns > 0`, `lastRunTrigger = scheduled`, and `lastRunStatus = success` or record the exact failed/skipped state. The current health evidence proves the timer is scheduled, not that the daily GA4 pipeline has executed.

Implementation status:

Implemented and locally validated for the scheduler/report-preflight code path and the observability support path. Deployed manual snapshot/report-preflight validation already passed for the controlled GA4 Benchmark report. The new observability support exposes GA4 daily scheduler state through `/health/scheduler`, makes report scheduler health metrics update on each check, and adds a guarded read-only report send-event endpoint. Deployed partial evidence on July 1, 2026 proved the report scheduler checker was running, a controlled GA4 Benchmark report send event was created, and the GA4 daily scheduler timer was scheduled. It did not yet prove the GA4 daily pipeline executed because `nextRunAt = 2026-07-01T12:15:00.000Z` was still in the future and `totalRuns = 0` at capture time.

### Current Commit 5 - Prove Benchmark Alert Email Provider Delivery And Inbox Receipt

Root cause:

Local code and tests prove Benchmark alert email attempt, audit, idempotency, retry, and provider-acceptance semantics. They do not prove provider-confirmed delivery or actual inbox receipt for a GA4 Benchmark alert email. Provider/API acceptance is not delivery.

The narrower local root cause for this Current Commit was an evidence-surface gap: the app records Benchmark alert email audit rows in `email_alert_events`, but there was no Benchmark-scoped, campaign-access-guarded read-only endpoint to inspect the latest Benchmark alert email audit state in production without sending or mutating email records. That made it too easy to infer delivery from provider acceptance or from unrelated UI behavior.

Files expected:

- `server/routes-oauth.ts`
- `server/benchmark-alert-email-delivery-validation-regression.test.ts`
- optional email validation artifact if the project keeps one
- this file, to record exact provider/inbox evidence

Required behavior:

- A controlled breached GA4 Benchmark with email notifications enabled must produce the expected immediate or scheduled email attempt.
- Provider acceptance must be recorded as accepted/pending, not delivered, unless a provider delivery event confirms delivery.
- The validation endpoint must be read-only, Benchmark-access guarded, filter `email_alert_events` to `kind = alert`, `entityType = benchmark`, and the exact Benchmark ID, and must not send, retry, update, insert, or delete email/Benchmark/notification/report rows.
- A confirmed provider delivery event or controlled inbox receipt must be recorded before anyone claims Benchmark alert email delivery.
- Failed, bounced, delayed, or unconfirmed sends must remain visible as unconfirmed/failed and must not be described as delivered.

Validation:

- Local regression: `npm test -- server/benchmark-alert-email-delivery-validation-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-retry-regression.test.ts`.
- Deployed evidence capture path after deploy: `GET /api/benchmarks/<benchmarkId>/alert-email-delivery-validation` in an authenticated tenant session.
- Trigger a controlled GA4 Benchmark breach with known recipients before reading the endpoint, or use a previously triggered Benchmark alert email if the audit row is unambiguous.
- Verify the response has `certificationStatus = validation_output_only`, the exact `benchmarkId`, latest `deliveryStatus`, `providerResponseId`, recipient count, and `providerDeliveryProven` value.
- Provider delivery is proven only when the exact Benchmark audit row has `deliveryStatus = delivered` and non-null `deliveredAt`; `accepted` or `pending_delivery` remains not delivered.
- Capture actual inbox receipt separately, or explicitly state inbox receipt remains unproven.
- Re-run focused alert-email tests after any runtime code change.

Implementation status:

Complete for the controlled Current Commit 5 validation. The local code exposes a read-only Benchmark-scoped alert email delivery validation endpoint and regression coverage proving it is access-guarded, audit-only, filtered to the exact Benchmark alert email rows, and does not mutate or send email. The deployed validation and inbox receipt were user-confirmed as passed on June 30, 2026. Exact endpoint JSON, provider response ID, delivered timestamp, recipient, subject, and received time were not pasted into this chat, so future audits should treat those raw details as externally confirmed but not locally visible in this transcript. This closes Current Commit 5 for the controlled GA4 Benchmark alert email proof, but it is not a blanket guarantee that every future Benchmark alert email is delivered; each future delivery claim still requires provider/inbox evidence.

### Current Commit 6 - Browser And Deployed UI Validation For The GA4 Benchmarks Tab

Root cause:

The blocker was an evidence and browser-operability gap, not a proven Benchmark calculation defect. Local code trace covered the helper/value logic, but there was no current authenticated deployed browser pass for the GA4 Benchmarks tab. RCA also found the GA4 Benchmark edit/delete icon buttons lacked stable accessible labels/titles, unlike the GA4 KPI icon buttons, so browser validation and assistive technology had to identify them by position/icon instead of a control name. The traced path did not show a need to change calculations, source scoping, alert logic, notification logic, scheduler behavior, email behavior, or API response contracts.

Files expected:

- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-benchmark-regression.test.ts`
- this file, to record exact local and deployed/browser evidence
- no manual-test artifact unless deployed/manual browser evidence is recorded there

Required behavior:

- The GA4 Benchmarks tab must render without blocking errors for a campaign with connected GA4.
- List, create, edit, delete, blocked state, insufficient state, current-value display, tracker counts, alert settings, notification deep link, and browser PDF Benchmark output must behave as documented.
- ROAS must display as an `x` ratio, ROI as percent, CPA as currency, and financial/revenue/spend dependency gates must match the documented source state.
- The Benchmark edit/delete icon buttons must have stable accessible names so browser validation can target the intended controls without relying on visual position.
- The UI must not show misleading connected/production-ready states when sources are missing, delayed, or unavailable.

Validation:

- Local validation run on July 1, 2026: `npm test -- server/ga4-benchmark-regression.test.ts` passed 1 test file and 10 tests.
- The new local guard pins the current GA4 route, `benchmarks` tab, campaign-scoped Benchmark read route, create/update/delete mutations, notification invalidation after lifecycle changes, blocked/insufficient UI states, ROAS/ROI/CPA unit rendering, accessible edit/delete controls, and browser-PDF Benchmark source path.
- Deployed Render browser validation was user-confirmed passed on July 1, 2026 for `https://marketforensics.onrender.com/campaigns/8aa735ee-c02f-41e2-bb1f-7c3f43bb9458/ga4-metrics?tab=benchmarks` after commit `69ea9505` deployed. The confirmed pass covers the GA4 Benchmarks tab loading, existing Benchmark visibility/value sanity, edit control opening the modal, and delete control opening the confirmation dialog without deleting production data.
- The deployed delete validation intentionally stopped at opening the confirmation dialog and cancelling/avoiding deletion; this is sufficient for browser-control validation without mutating production Benchmark data.
- Raw browser screenshots, console output, network traces, and PDF artifact were not pasted into this chat; future audits should treat the deployed browser result as user-confirmed evidence for this controlled pass, not locally inspected raw evidence.

Implementation status:

Complete for the controlled Current Commit 6 validation. Local browser-path hardening is implemented: the existing GA4 Benchmark edit/delete icon buttons now expose `title` and `aria-label` attributes, and focused regression coverage pins the current browser-facing Benchmark path without changing calculations, API contracts, scheduler behavior, alerts, notifications, emails, or source scoping. The deployed Render GA4 Benchmarks tab pass was user-confirmed on July 1, 2026 after commit `69ea9505`. This closes Current Commit 6 for the current controlled GA4 Benchmarks browser path. It is not a blanket guarantee for future UI changes, future campaigns, or untested browser/PDF artifacts; those require their own validation evidence.

### Current Commit 7 - Decide And Certify The GA4 Industry Benchmark Target Source

Root cause:

The GA4 Benchmark create flow can fetch industry Benchmark values, and server industry lookup can fall back to mock values. Mock or demo industry values are not production-grade industry-standard evidence. If industry Benchmark targets are part of the certified GA4 Benchmarks product surface, the target source must be certified or clearly labeled as non-production/helper behavior.

Files expected:

- `server/data/industry-benchmarks.ts`
- `server/data/industry-benchmarks.mock.ts`, if retained
- `server/routes-oauth.ts`
- `client/src/pages/ga4-metrics.tsx`
- focused route/UI regression test if behavior changes
- this file, to record the source decision and validation evidence

Required behavior:

Choose one proven path:

- Production-source path: replace or validate the industry target source as certified production reference data, document provenance/version/date, and ensure GA4 create/edit UI does not silently use mock values as production targets.
- Non-production-helper path: explicitly label industry values as templates/helpers, prevent them from being used as certified production benchmark evidence, and ensure readiness wording does not treat them as proof.

Validation:

- Trace industry Benchmark value fetch from UI to route to data source and saved Benchmark row.
- Verify whether mock fallback can be reached in production configuration.
- Add or update a regression proving the chosen behavior.
- Manually validate the create modal wording if UI copy changes.

Implementation status:

Not implemented. Blocking for full unqualified GA4 Benchmarks production readiness if industry Benchmark targets are included in the certified product surface. Not required for local current-code certification of user-entered targets and source-backed current values.

## Historical Completed Fix Evidence

The following historical fix queue is closed for the current GA4 Benchmarks tab code scope. These fixes are evidence inputs only; they do not replace the matrices above.

| Historical item | Outcome | Certification relevance |
| --- | --- | --- |
| Commit 1 - Persist GA4 Benchmark ROAS As Ratio | Implemented, committed, pushed, deployed, and validated | Closed the persisted scheduler/report/alert ROAS percent-vs-ratio blocker |
| Commit 2 - Scope GA4 Metrics To Selected Primary Property | Implemented, committed, pushed, deployed, and validated | Closed cross-property/campaign source-scope risk for GA4 current values |
| Commit 3 - Refresh UI Values After `Set as Primary` | Implemented, committed, pushed, deployed, and validated | Closed selected-property UI alignment risk after source change |
| Commit 4 - Correct GA4 ROAS Copy | Implemented, committed, pushed, deployed, and validated | Closed user-facing unit/copy mismatch |
| Commit 5 - Enforce Shared Evaluated Route Access | Implemented, committed, pushed, deployed, and validated | Closed shared evaluated KPI/Benchmark access risk |
| Commit 6 - Inventory And Repair Existing GA4 Persisted ROAS Rows | Implemented, committed, pushed, deployed, and validated | Closed known damaged-data boundary: 46 rows updated, 0 remaining repair candidates after apply |

Existing damaged-data conclusion:

- Known persisted GA4 Benchmark ROAS percent-style damage has been bounded and repaired for rows with exact source proof.
- Rows skipped during cleanup were not silently changed because they had no active GA4 primary property or no persisted GA4 daily rows proving the correction boundary.
- No additional cleanup Current Commit is required for the known ROAS defect based on the recorded post-apply dry-run result.
- If a new persisted Benchmark defect is found, lower the affected path to unproven and add a new bounded inventory/cleanup Current Commit before recertifying.

## Not Locally Verifiable / External Caveats

The items below are unproven until their Current Commit evidence exists. They are not optional caveats for full unqualified production readiness; they are blockers for that broader claim. They remain non-blocking only for the narrower local current-code certification.

| Unproven item | Current Commit | Blocks local current-code certification? | Blocks full unqualified production readiness? |
| --- | --- | --- | --- |
| Live GA4 API accuracy and availability | Current Commit 2 | No | Yes |
| GA4 processing latency / delayed attribution behavior | Current Commit 2 | No | Yes |
| Deployed OAuth token refresh and tenant-specific provider failures | Current Commit 3 | No | Yes |
| Deployed GA4 daily scheduler pipeline execution after scheduled run | Current Commit 4 Follow-Up | No | Yes |
| Mock/industry Benchmark target source suitability | Current Commit 7 | No for user-entered targets | Yes if industry targets are part of the certified product surface |
| Future source mixes or new financial source types | New future Current Commit when introduced | Yes for changed/new path | Yes for changed/new path |
| Future platform Benchmark readiness | Target-platform readiness queue | Not applicable to GA4 | Always unproven for the target platform until separately certified |

Provider/email wording rule:

- It is acceptable to say local code attempts and audits Benchmark alert emails correctly for covered paths.
- It is acceptable to say Current Commit 5 passed for the controlled deployed Benchmark alert email send based on user-confirmed endpoint/inbox validation.
- It is not acceptable to say any future Benchmark alert email was delivered unless provider delivery events or actual inbox receipt prove that specific send.

Production-readiness wording rule:

- It is acceptable to say GA4 Benchmarks are locally code-certified for the current GA4 Benchmarks tab path.
- It is not acceptable to say GA4 Benchmarks are fully production-ready without qualification until the remaining Current Commit blockers are completed or proven non-applicable with evidence.

## Future Platform Template

GA4 Benchmark docs are a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source, but never proof that the target platform is production-ready.

For each future platform Benchmark certification, create or update that platform's Benchmark production-readiness file with this structure:

1. Mandatory anti-overclaim rule
2. Purpose
3. Current Status
4. Durable future-chat answer
5. How to use the file in a new chat
6. Future source reading order
7. Current scope
8. Root cause of prior confusion / prior overclaim risk
9. Non-negotiable accuracy rules
10. Complete platform Benchmark value inventory
11. End-to-end trace matrix
12. Downstream propagation matrix
13. Source/lifecycle matrix
14. Negative-case matrix
15. Test coverage matrix
16. Documentation alignment check
17. Exact smallest safe fix queue organized as Current Commits
18. Current Commit details: commit title, root cause, files expected, required behavior, validation, implementation status
19. Not locally verifiable / external caveats
20. Future platform reuse/template statement

Minimum proof required for a future platform:

- selected account/property/customer/sheet/ad/campaign source scope is proven
- every visible Benchmark metric has a source, formula, window, unit, fallback, blocked state, and downstream consumer
- add/edit/delete/source-refresh/scheduler/report/email/notification paths are traced end to end
- current-value helpers and persisted recompute jobs agree on metric units
- existing damaged-data risk is inventoried and either proven absent or handled by a bounded cleanup plan
- route ownership and platform/campaign isolation are regression-covered
- negative cases fail closed and do not write misleading current values
- tests cover the platform's own source values, not only shared helper behavior
- provider/deployed/inbox evidence is either supplied or explicitly listed as external and non-certified

Do not copy the GA4 `production-ready` answer into a target platform answer. Copy only the audit shape, then replace every evidence row with target-platform proof.
