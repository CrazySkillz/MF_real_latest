# GA4 KPI/Benchmark Alerts And Notifications Production Readiness

## Purpose

Track the work required to make GA4 KPI and Benchmark alerts and notifications production-ready.

This file is the authoritative tracker for GA4 KPI/Benchmark alert and notification readiness. Older KPI notification planning files remain historical reference only and must not be used as production-readiness proof by themselves:

- `KPI_NOTIFICATIONS_IMPLEMENTATION_PLAN.md`
- `KPI_NOTIFICATIONS_TESTING_GUIDE.md`
- `KPI_ALERTS_AND_PERIOD_TRACKING_PROPOSAL.md`

## Authoritative Readiness Statement

- GA4 KPI/Benchmark alerts and notifications are not production-ready at Commit 1.
- After Commits 2 through 8 in this file are implemented, their required validation passes, and final evidence is recorded here, the GA4 KPI alerts, GA4 KPI notifications, GA4 Benchmark alerts, and GA4 Benchmark notifications sections can be marked production-ready.
- This file is the implementation and validation template for applying the same alert/notification lifecycle to other connected-platform sources, including Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration.
- Other connected-platform sources are not production-ready from GA4 evidence alone. Each source must copy the proven GA4 lifecycle and pass the same lifecycle matrix with source-specific evidence before its KPI/Benchmark alert and notification behavior can be marked production-ready.

## Root Cause Analysis

Current alert readiness is not proven end to end because alert truth is split across multiple paths:

- in-app KPI alert creation resolves stale alerts, but Benchmark alert creation does not yet have equivalent resolve-on-clear behavior
- in-app checks can use connected-platform current-value resolution while email checks still read persisted `currentValue`
- notification visibility currently re-checks raw stored rows instead of the exact resolved value path used by alert creation
- some create/update routes await alert reconciliation, while others return before async alert checks finish
- GA4 KPI/Benchmark frontend mutations refresh their KPI/Benchmark lists but do not consistently refresh `/api/notifications`
- bell navigation can rewrite non-GA4 action URLs and must not damage valid GA4 deep-links
- older production-readiness docs overclaimed completion from targeted checks instead of proving every lifecycle path

The smallest safe production-readiness strategy is to make one GA4 alert lifecycle deterministic, regression-covered, and documented, then use that as the required implementation template for other sources.

## Production-Ready Acceptance Criteria

GA4 KPI and Benchmark alerts and notifications are production-ready only when all of these are true:

- creating a breached alert-enabled GA4 KPI creates exactly one visible in-app alert
- updating a GA4 KPI into breach creates exactly one visible in-app alert
- clearing a GA4 KPI breach resolves/hides the active alert without deleting history
- disabling GA4 KPI alerts or clearing the threshold resolves/hides the active alert
- deleting a GA4 KPI hides related alert notifications without hard-deleting unrelated history
- creating a breached alert-enabled GA4 Benchmark creates exactly one visible in-app alert
- updating a GA4 Benchmark into breach creates exactly one visible in-app alert
- clearing a GA4 Benchmark breach resolves/hides the active alert without deleting history
- disabling GA4 Benchmark alerts or clearing the threshold resolves/hides the active alert
- deleting a GA4 Benchmark hides related alert notifications without hard-deleting unrelated history
- dismissing or clearing a notification remains a visibility action, not analytical resolution
- if a dismissed KPI or Benchmark still breaches, the next valid reconciliation can recreate one scoped active alert
- missing campaign, missing current value, invalid current value, missing threshold, or invalid threshold fails closed
- in-app and email alert checks use the same resolved current value and threshold math
- alert frequency controls reminder email throttle behavior, not duplicate in-app notification rows
- GA4 KPI alert links open `/campaigns/:id/ga4-metrics?tab=kpis&highlight=:kpiId`
- GA4 Benchmark alert links open `/campaigns/:id/ga4-metrics?tab=benchmarks&highlight=:benchmarkId`
- successful GA4 KPI/Benchmark create, update, and delete mutations refresh `/api/notifications`
- scheduler/source-refresh reconciliation does not rely on opening the bell, loading Notifications, or manually refreshing the page
- local focused tests, `npm run check`, and `npm run build` pass
- deployed email provider delivery remains separately documented as provider/inbox evidence, not inferred from local code

## Implementation Strategy

Each commit must be completed, validated, and documented before moving to the next one.

### Commit 1: Authoritative Readiness Document

Status: complete for the documentation-only scope.

Fix scope:

- create this document
- record RCA, acceptance criteria, commit strategy, validation matrix, and cross-platform template rules
- clearly state that older KPI notification docs are historical reference only

Validation:

- documentation-only review of this file
- confirm no unrelated dirty files are touched or staged

### Commit 2: Shared Alert Evaluation Contract

Status: complete.

Fix scope:

- add a small internal server helper for alert number parsing and threshold evaluation
- reuse existing campaign current-value resolution for campaign/current-value-backed alerts
- do not treat missing current values as `0`
- preserve public API response shapes

Required tests:

- formatted alert numbers parse correctly
- invalid current values fail closed
- below, above, and equals conditions evaluate consistently
- GA4 KPI and Benchmark checks use the same current-value source as visible cards

Validation completed:

- `npm test -- server/alert-evaluation.test.ts server/campaign-alert-current-value-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-regression.test.ts`
- `npm run check`
- User-requested validation rerun passed on 2026-06-22: 4 focused test files / 13 tests passed, and `tsc` passed.

### Commit 3: Deterministic In-App Alert Lifecycle

Status: complete.

Fix scope:

- add Benchmark alert resolution behavior equivalent to KPI alert resolution
- ensure GA4 KPI and Benchmark alert reconciliation handles create, update, clear breach, disable alerts, clear threshold, delete, missing campaign, dismissed alert recreation, and duplicate suppression
- preserve one active unresolved in-app notification per breached GA4 KPI or Benchmark
- preserve existing non-GA4 behavior unless covered by a specific new helper test

Required tests:

- Benchmark non-breach resolves active alert
- Benchmark disabled alerts resolves active alert
- Benchmark missing threshold resolves active alert
- dismissed still-breached Benchmark can recreate one active alert
- duplicate active GA4 KPI/Benchmark alerts collapse to one visible row

Root cause fixed:

- KPI alert reconciliation only queried rows with `alertsEnabled = true`, so disabled GA4/campaign KPI alerts could not be observed and soft-resolved by the scheduler.
- KPI alert creation returned on missing campaign context even for still-breached GA4/campaign KPI rows, which could leave an existing active alert unresolved.
- Benchmark in-app alert reconciliation only queried active rows with `alertsEnabled = true`, so disabled Benchmark alerts could not be observed and resolved.
- Benchmark reconciliation skipped non-breaches, missing thresholds, invalid values, and missing campaign context instead of resolving existing active GA4/campaign-style in-app alerts.
- Benchmark duplicate prevention avoided creating a new duplicate, but it did not collapse existing duplicate unresolved Benchmark alert rows.

Validation completed:

- `npm test -- server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/notification-visibility-regression.test.ts server/alert-evaluation.test.ts server/ga4-kpi-regression.test.ts`
- `npm run check`
- Validation confirmed passed on 2026-06-23 before Commit 4 work began.

### Commit 4: Email Alert Parity

Status: complete.

Fix scope:

- update immediate and scheduled KPI email checks to use the same resolved current-value/evaluation path as in-app checks
- update immediate and scheduled Benchmark email checks to use the same resolved current-value/evaluation path as in-app checks
- preserve email frequency throttling
- fail closed when campaign context or recipients are missing
- do not claim provider delivery from local code or API acceptance

Required tests:

- email checks do not send on invalid values
- email checks use resolved current values for campaign-backed rows
- immediate email checks are attempted after breached create/update when email alerts are enabled
- throttling still prevents repeated reminder emails

Root cause fixed:

- immediate KPI email checks read persisted `kpi.currentValue` directly instead of resolving campaign/current-value-backed rows through `resolveCampaignCurrentValueForAlert`
- immediate Benchmark email checks read persisted `benchmark.currentValue` directly instead of resolving campaign/current-value-backed rows through `resolveCampaignCurrentValueForAlert`
- scheduled KPI and Benchmark email checks used the same persisted-row-only path, so email threshold decisions could drift from in-app GA4/campaign current-value resolution

Validation completed:

- `npm test -- server/alert-email-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts server/notification-visibility-regression.test.ts`
- `npm run check`

Manual validation requirement:

- manual validation is not required for Commit 4 acceptance because the changed behavior is backend email alert current-value selection and threshold evaluation, which is covered by the focused regression tests above
- deployed provider delivery, provider delivery events, and actual inbox receipt remain not locally verifiable and belong to the final deployed evidence pass, not Commit 4 local acceptance

### Commit 5: GA4 Route And UI Synchronization

Status: complete.

Fix scope:

- ensure GA4 KPI create/update routes await in-app alert reconciliation before returning
- ensure GA4 Benchmark create/update routes await in-app alert reconciliation before returning
- ensure GA4 KPI/Benchmark create, update, and delete frontend mutations invalidate and refetch `/api/notifications`
- keep existing form behavior, query keys, and response contracts stable

Required tests:

- route regression guards prove awaited reconciliation is present
- GA4 frontend mutation guards prove `/api/notifications` is refreshed after create/update/delete
- existing GA4 KPI/Benchmark tests still pass

Root cause fixed:

- GA4 platform KPI create/update routes ran GA4 recompute before returning, but then started `checkPerformanceAlerts()` with fire-and-forget `.catch(...)`, so the response could reach the frontend before in-app alert rows were created, resolved, or hidden
- GA4 Benchmark create/update UI uses the generic `/api/benchmarks` routes, which already awaited `checkBenchmarkPerformanceAlerts()`; Commit 5 adds a regression guard so that ordering is preserved
- GA4 KPI and Benchmark create/update/delete frontend mutations invalidated only their KPI/Benchmark list queries, so the bell and Notifications cache could remain stale until another notification query refetch happened

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/alert-email-regression.test.ts`
- `npm run check`

Manual validation requirement:

- manual validation is not required for Commit 5 acceptance because the changed behavior is backend route ordering plus React Query notification-cache refetch wiring, covered by the focused regression tests above
- browser click-through validation remains useful for final readiness evidence, but it is not required to accept the local Commit 5 fix

### Commit 6: Deep-Link Template Safety

Status: complete.

Fix scope:

- harden GA4 KPI and Benchmark action URL generation
- make bell navigation preserve valid metadata action URLs instead of rewriting GA4 links incorrectly
- document exact route mapping for connected-platform rollout

Required GA4 routes:

- KPI: `/campaigns/:id/ga4-metrics?tab=kpis&highlight=:kpiId`
- Benchmark: `/campaigns/:id/ga4-metrics?tab=benchmarks&highlight=:benchmarkId`

Template route mapping for later source rollout:

- LinkedIn: `/campaigns/:id/linkedin-analytics`
- Meta: `/campaigns/:id/meta-analytics`
- Google Ads: `/campaigns/:id/google-ads-analytics`
- Instagram: `/campaigns/:id/instagram-analytics`
- TikTok: `/campaigns/:id/tiktok-analytics`
- Google Sheets: `/campaigns/:id/google-sheets-data`
- Custom Integration: `/campaigns/:id/custom-integration-analytics`

Required tests:

- GA4 KPI bell click preserves the GA4 path
- GA4 Benchmark bell click preserves the GA4 path
- Notifications page view action preserves the metadata action URL

Root cause fixed:

- GA4 KPI action URL generation still had a non-campaign `/ga4-metrics` fallback when campaign identity was missing, even though production alert links must be campaign-scoped or fail closed
- the notification bell click handler rebuilt every KPI/Benchmark metadata link into either `ga4-metrics` or `linkedin-analytics`; this preserved current GA4 links only by path sniffing and would rewrite valid campaign-scoped metadata links for other connected-platform templates
- the Notifications page view action already preserved the metadata action URL path and now has regression coverage proving that behavior

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts`
- `npm run check`

Manual validation requirement:

- manual validation is not required for Commit 6 acceptance because the changed behavior is deterministic URL generation/navigation preservation covered by source-level regression guards
- final browser click-through validation remains useful for production-readiness evidence, but it is not required to accept the local Commit 6 fix

### Commit 7: Numeric Capacity Hardening

Status: complete.

Fix scope:

- inspect KPI and Benchmark decimal precision for alert thresholds and absolute revenue/spend-sized values
- widen only proven absolute-value fields that can store enterprise-scale current values, benchmark values, or alert thresholds
- do not rename fields
- do not change API response shapes
- leave percentage/variance fields unchanged unless proven to store absolute values

Required tests:

- schema regression guard proves Benchmark absolute alert/value fields can hold revenue-sized values
- KPI precision remains unchanged or intentionally matched
- migration is additive/widening only

Root cause fixed:

- KPI live target/current/alert threshold fields were already widened to `numeric(18,2)`, but KPI alert audit rows still stored `current_value`, `target_value`, and `threshold_value` as `numeric(10,2)` even though email alert sends write the live KPI values into that audit table
- Benchmark live `benchmark_value`, `current_value`, and `alert_threshold` were still `numeric(10,2)`, which caps enterprise revenue/spend-sized values at `99,999,999.99`
- Benchmark history `current_value` and `benchmark_value` were also `numeric(10,2)`, so history writes could fail for the same enterprise-scale absolute values
- Benchmark `variance` and `benchmark_history.variance` remain unchanged because they are percentage fields, not absolute revenue/spend/current/threshold values

Validation completed:

- `npm test -- server/alert-numeric-capacity-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-regression.test.ts`
- `npm run check`

### Commit 8: Final Validation And Documentation Closure

Fix scope:

- run final focused regression suite
- run `npm run check`
- run `npm run build`
- update this document with final status by evidence category

Required final commands:

```bash
npm test -- server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/notification-visibility-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-email-regression.test.ts
npm run check
npm run build
```

Final documentation must separate:

- proven locally
- partially reviewed
- not locally verifiable
- deployed/manual validation required

## Lifecycle Matrix

| Lifecycle path | GA4 KPI expected behavior | GA4 Benchmark expected behavior | Required evidence |
| --- | --- | --- | --- |
| Create breached item | one active in-app alert; immediate email attempt if enabled | one active in-app alert; immediate email attempt if enabled | route and service tests |
| Create non-breached item | no active alert | no active alert | service tests |
| Update into breach | one active in-app alert | one active in-app alert | route and service tests |
| Update out of breach | active alert resolved/hidden | active alert resolved/hidden | service tests |
| Disable alerts | active alert resolved/hidden | active alert resolved/hidden | service tests |
| Clear threshold | active alert resolved/hidden | active alert resolved/hidden | service tests |
| Delete item | related notifications hidden, unrelated history preserved | related notifications hidden, unrelated history preserved | route tests |
| Dismiss notification | current row hidden only | current row hidden only | visibility tests |
| Reconcile still-breached dismissed item | one new active alert may be created | one new active alert may be created | lifecycle tests |
| Scheduler/source refresh | alerts evaluate after current values refresh | alerts evaluate after current values refresh | scheduler tests |
| Email reminder | same resolved value as in-app; throttled by frequency | same resolved value as in-app; throttled by frequency | email tests |
| Bell deep-link | opens GA4 KPI tab and highlighted KPI | opens GA4 Benchmark tab and highlighted Benchmark | UI/source tests |
| Notifications page deep-link | opens GA4 KPI tab and highlighted KPI | opens GA4 Benchmark tab and highlighted Benchmark | UI/source tests |

## Validation Status

Current status:

Proven locally:

- this authoritative readiness document exists and records the GA4 KPI/Benchmark alert and notification lifecycle gate
- Commit 1 is documentation-only and does not change runtime behavior
- the required documentation set for this Commit 1 review was read before finalizing this file
- Commit 2 added a shared internal alert evaluation helper, moved KPI in-app alert checks, Benchmark in-app alert checks, and email alert condition checks onto the shared parser/evaluator, and removed the Benchmark missing-current-value fallback to `0`
- Commit 2 focused tests prove formatted alert numbers parse, invalid current values and thresholds fail closed, `below`/`above`/`equals` condition math is shared, and GA4 campaign KPI/Benchmark alert checks still resolve connected-platform current values before threshold evaluation
- Commit 2 user-requested validation rerun passed on 2026-06-22 with 4 focused alert test files / 13 tests and `npm run check`
- Commit 3 added KPI and Benchmark soft-resolution for GA4/campaign-style in-app alerts, including non-breach, disabled alerts, missing/invalid thresholds, missing/invalid current values, missing campaign context, dismissed still-breached recreation, and duplicate active Benchmark alert collapse
- Commit 3 validation was confirmed passed on 2026-06-23 before Commit 4 work began
- Commit 4 moved immediate and scheduled KPI/Benchmark email alert checks onto the same campaign current-value resolver used by in-app alert checks, preserved email throttling before send attempts, kept invalid values fail-closed, and kept immediate email hooks on the current GA4 KPI/Benchmark create/update routes
- Commit 4 does not require manual validation for local acceptance; actual provider delivery and inbox receipt remain final deployed-evidence items
- Commit 5 makes GA4 KPI create/update routes await in-app alert reconciliation before responding, proves GA4 Benchmark create/update routes preserve awaited reconciliation, and refreshes `/api/notifications` after GA4 KPI/Benchmark create, update, and delete mutations
- Commit 5 does not require manual validation for local acceptance; final browser click-through evidence remains part of the final readiness pass
- Commit 6 makes GA4 KPI action URLs fail closed to `/notifications` when campaign/item identity is missing, preserves campaign-scoped metadata action URLs in bell navigation, and regression-covers Notifications page action URL preservation
- Commit 6 does not require manual validation for local acceptance; final browser click-through evidence remains part of the final readiness pass
- Commit 7 widens KPI alert audit absolute numeric fields plus Benchmark live/history absolute value and alert-threshold fields to `numeric(18,2)`, leaves percentage variance fields unchanged, and adds a widening-only migration plus regression guard

Partially reviewed:

- existing code traces identified remaining gaps in notification raw-row visibility checks, final build validation, and deployed/manual evidence
- the lifecycle matrix above defines the paths that must be proven by Commit 8 before GA4 readiness can be claimed

Not locally verifiable yet:

- deployed email delivery
- provider delivery events
- live GA4 freshness timing
- production data edge cases

Not production-ready yet:

- GA4 KPI/Benchmark alerts and notifications must complete Commit 8 and the required validation pass before this document can mark them production-ready
- Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration must each pass this same lifecycle with source-specific evidence before their KPI/Benchmark alert and notification behavior can be marked production-ready

## Cross-Platform Template Rules

After GA4 passes this matrix, other connected-platform KPI/Benchmark alert implementations must copy the same rules:

- use the same alert evaluation helper
- use the same current-value source as visible KPI/Benchmark cards
- fail closed on missing campaign, invalid current value, invalid threshold, or missing ownership
- keep one active unresolved in-app alert per breached item unless a platform-specific tested rule requires a different window
- treat dismiss/clear as notification visibility only
- resolve/hide alerts when breach clears, alerts are disabled, threshold is removed, or the item is deleted
- attempt immediate email only after save/update succeeds and only when email alerts are enabled
- preserve frequency throttling for reminder emails
- generate platform-correct campaign-scoped deep-links
- refresh `/api/notifications` after alert-impacting create, update, and delete mutations
- add focused regression tests before marking the copied source production-ready

## Manual Validation Checklist

Use a disposable GA4 campaign with known values.

1. Create a GA4 KPI with alerts enabled and a breached threshold.
2. Confirm the bell count updates and the Notifications page shows one KPI alert.
3. Click the bell alert and confirm it opens the GA4 KPI tab with the KPI highlighted.
4. Update the KPI so it no longer breaches.
5. Confirm the alert disappears from active notification views.
6. Re-breach the same KPI.
7. Confirm exactly one active alert returns.
8. Repeat the same flow for a GA4 Benchmark.
9. Dismiss a still-breached KPI/Benchmark alert.
10. Run or trigger the valid reconciliation path.
11. Confirm exactly one new active alert appears.
12. Enable email alerts with a safe recipient in a deployed environment.
13. Confirm provider acceptance separately from inbox/provider delivery.

Pass criteria:

- visible in-app state matches the underlying GA4 KPI/Benchmark breach state
- no stale resolved alerts remain visible
- no duplicate active alerts appear for the same GA4 KPI/Benchmark
- deep-links open the correct campaign, tab, and item
- email status is reported only according to the evidence available
