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
- As of Commit 8, the locally verifiable GA4 KPI/Benchmark alert and notification implementation is production-ready by this document's code-readiness criteria.
- The current implementation template also includes the post-Commit-8 alignment fixes documented below: alert frequency UI scope/layout, all-row GA4 KPI reconciliation, query-only action URL handling, bell-to-Notifications routing, and edit/delete notification refresh.
- This file is the implementation and validation template for applying the same alert/notification lifecycle to other connected-platform sources, including Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration.
- Other connected-platform sources are not production-ready from GA4 evidence alone. Each source must copy the proven GA4 lifecycle and pass the same lifecycle matrix with source-specific evidence before its KPI/Benchmark alert and notification behavior can be marked production-ready.

## Root Cause Analysis

Initial alert readiness was not proven end to end because alert truth was split across multiple paths:

- in-app KPI alert creation resolved stale alerts, but Benchmark alert creation did not have equivalent resolve-on-clear behavior
- in-app checks could use connected-platform current-value resolution while email checks still read persisted `currentValue`
- notification visibility re-checked raw stored rows instead of the exact resolved value path used by alert creation
- some create/update routes awaited alert reconciliation, while others returned before async alert checks finished
- GA4 KPI/Benchmark frontend mutations refreshed their KPI/Benchmark lists but did not consistently refresh `/api/notifications`
- bell navigation could rewrite non-GA4 action URLs and needed to preserve valid GA4 deep-links
- older production-readiness docs overclaimed completion from targeted checks instead of proving every lifecycle path
- the completed bell-to-Notifications implementation and the planned triage UX used different query names (`highlight` versus `selected`) without one authoritative contract distinguishing triage selection from KPI/Benchmark card highlighting

Commits 2 through 8 made the GA4 alert lifecycle deterministic, regression-covered, and documented. This GA4 lifecycle is now the required implementation template for other sources.

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
- GA4 KPI alert metadata action URLs open `/campaigns/:id/ga4-metrics?tab=kpis&highlight=:kpiId`
- GA4 Benchmark alert metadata action URLs open `/campaigns/:id/ga4-metrics?tab=benchmarks&highlight=:benchmarkId`
- completed triage bell behavior opens `/notifications` directly; selected row routes still use `/notifications?selected=:notificationId`, legacy `/notifications?highlight=:notificationId` remains transition-compatible, and KPI/Benchmark action URLs continue to use platform-card `highlight`
- the Notifications page `View KPI` / `View Benchmark` action preserves the metadata action URL and opens the correct GA4 tab/card
- if the user is already on the same GA4 page, query-only action URL changes still switch to the correct tab/item by listening to the URL search string
- successful GA4 and campaign-level KPI/Benchmark create, update, and delete mutations refresh `/api/notifications`
- alert UI places `Send email notifications` on the left and `Alert Frequency` on the right
- `Alert Frequency` is disabled unless `Send email notifications` is selected
- alert frequency helper text says it controls how often reminder emails are sent while the KPI or Benchmark is still breaching
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

Manual validation requirement:

- manual validation is not required for Commit 7 acceptance because the changed behavior is schema/migration numeric capacity and is covered by the schema/migration regression guard plus `npm run check`
- migration application in a deployed database remains an operational deployment step, not a manual product-flow validation requirement for local acceptance

### Commit 8: Final Validation And Documentation Closure

Status: complete.

Fix scope:

- run final focused regression suite
- run `npm run check`
- run `npm run build`
- update this document with final status by evidence category

Required final commands:

```bash
npm test -- server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/notification-visibility-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-email-regression.test.ts server/alert-numeric-capacity-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/alert-evaluation.test.ts
npm run check
npm run build
```

Final documentation must separate:

- proven locally
- partially reviewed
- not locally verifiable
- deployed/manual validation required

Root cause fixed:

- final trace found `/api/notifications` still checked raw persisted KPI/Benchmark `currentValue` values when deciding whether a performance alert should remain visible
- this could keep a stale alert visible when the stored row still breached but the resolved campaign/current-value-backed value no longer breached
- the notification visibility predicate now resolves linked KPI/Benchmark rows through `resolveCampaignCurrentValueForAlert` before applying alert threshold math, while preserving existing campaign ownership checks and duplicate suppression

Validation completed:

- `npm test -- server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/notification-visibility-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-email-regression.test.ts server/alert-numeric-capacity-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/alert-evaluation.test.ts`
- `npm run check`
- `npm run build`

Validation note:

- the first `npm run build` attempt failed with `spawn EPERM` while Vite tried to start esbuild under sandbox permissions; the same command passed when rerun with the required elevated permission

## Post-Commit-8 Implementation Alignment

Status: complete for the locally committed implementation through `c9f582f9`.

These follow-up commits are part of the current GA4 alert/notification implementation and must be treated as part of the template before applying the lifecycle to Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, Custom Integration, or any other connected-platform source.

### Commit `4f313218`: Alert Frequency Reminder Scope

Runtime behavior:

- `Alert Frequency` controls email reminder cadence only
- bell and Notifications keep one active in-app alert record while the breach remains unresolved
- duplicate in-app rows are not created for `Immediate`, `Daily`, or `Weekly`
- KPI helper text says: `This setting controls how often reminder emails are sent while the KPI is still breaching`
- Benchmark helper text says: `This setting controls how often reminder emails are sent while the Benchmark is still breaching`

Template requirement:

- future platform KPI/Benchmark alert forms must not imply that `Alert Frequency` creates repeated bell or Notifications rows
- helper text must distinguish in-app alert lifecycle from reminder email cadence

### Commit `75c38529`: Alert Email Control Layout

Runtime behavior:

- `Send email notifications` is rendered on the left
- `Alert Frequency` is rendered on the right
- `Alert Frequency` is disabled unless `Send email notifications` is selected
- email recipient fields appear only when email notifications are selected

Template requirement:

- future platform alert forms should use the same layout and disabled-state model unless there is a documented platform-specific reason not to
- if email notifications are off, users can still receive in-app bell and Notifications alerts, but reminder email frequency is inactive

### Commit `4bbffd53`: GA4 KPI Alert Reconciliation Completeness

Runtime behavior:

- GA4 KPI alert reconciliation considers all KPI rows instead of only a deduplicated/latest-by-metric subset
- disabled stale GA4/campaign-style KPI alerts can be observed and resolved
- older still-valid GA4 KPI alert rows are not incorrectly superseded merely because another KPI has the same campaign/metric key
- scheduler reconciliation uses the same KPI row lifecycle boundary as manual create/update/delete paths

Template requirement:

- future platform KPI reconciliation must not collapse distinct KPI rows by display metric or campaign/metric key unless that dedupe rule is explicitly product-defined and regression-covered
- stale alert cleanup must include disabled-alert, missing-threshold, invalid-value, missing-campaign, and non-breach paths

### Commit `99415fe6` And Commit `12bcf04b`: GA4 Deep-Link Rendering And Query Sync

Runtime behavior:

- GA4 KPI and Benchmark cards visually highlight when opened from alert action URLs
- the GA4 page listens to URL search changes through Wouter `useSearch`
- if the user is already on `/campaigns/:id/ga4-metrics`, changing only `?tab=...&highlight=...` still updates active tab and highlighted item state
- the visible card highlight is temporary and does not mutate alert state

Template requirement:

- future platform analytics pages that use alert action URLs must react to query-only URL changes, not only path changes
- action URL highlighting should be visual navigation feedback only; it must not mark alerts read, dismiss alerts, resolve breaches, or mutate KPI/Benchmark state

### Commit `4562711e`: Bell To Notifications Center Flow

Runtime behavior:

- clicking a performance alert in the bell marks it read and opens `/notifications?highlight=:notificationId`
- the Notifications page resets filters to show the specific alert, moves to the correct page, scrolls to it, and highlights it
- the Notifications page `View KPI` / `View Benchmark` action remains the action that opens the platform KPI/Benchmark card via metadata action URL
- dismissing from the bell remains a separate visibility action and does not navigate

Template requirement:

- bell rows should be treated as quick entry points into alert context, not as the only action surface
- the full Notifications page must preserve the platform action URL and provide the jump into the KPI/Benchmark card
- current triage UX uses canonical `selected` for bell-to-Notifications selection, while legacy `highlight` notification links remain transition-compatible

### Commit `1bac44e4`: Edit/Delete Reflection In Bell And Notifications

Runtime behavior:

- existing active KPI alert rows are updated in place when the KPI is edited and remains breaching
- existing active Benchmark alert rows are updated in place when the Benchmark is edited and remains breaching
- campaign-level Benchmark create/update routes await alert reconciliation before responding
- GA4 and campaign-level KPI/Benchmark create, update, and delete mutations refresh `/api/notifications`
- deleting a KPI/Benchmark hides the related active alert rows without hard-deleting unrelated notification history

Template requirement:

- alert reconciliation must update the preserved active alert row's title, message, priority, campaign context, and metadata action URL when the linked item remains breached after edit
- UI mutation handlers must invalidate and refetch `/api/notifications` after alert-impacting create, update, or delete actions
- delete remains a visibility/history-preserving soft-hide path for linked notifications

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
| Reconcile still-breached edited item | preserved active alert row updates in place | preserved active alert row updates in place | lifecycle and visibility tests |
| Scheduler/source refresh | alerts evaluate after current values refresh | alerts evaluate after current values refresh | scheduler tests |
| Email reminder | same resolved value as in-app; throttled by frequency | same resolved value as in-app; throttled by frequency | email tests |
| Alert frequency UI | `Send email notifications` left; `Alert Frequency` right; frequency disabled until email is selected | `Send email notifications` left; `Alert Frequency` right; frequency disabled until email is selected | UI/source tests |
| Bell alert click / triage entry | top-bar bell opens `/notifications`; unread rows are highlighted in the Notifications list; selected row routes use canonical `selected` with legacy `highlight` compatibility | top-bar bell opens `/notifications`; unread rows are highlighted in the Notifications list; selected row routes use canonical `selected` with legacy `highlight` compatibility | UX source tests and legacy compatibility tests |
| Notifications row primary action | `View KPI` preserves metadata action URL and opens GA4 KPI tab/card highlight | `View Benchmark` preserves metadata action URL and opens GA4 Benchmark tab/card highlight | UI/source tests |
| Query-only platform action URL | existing GA4 page reacts to `tab`/`highlight` search changes | existing GA4 page reacts to `tab`/`highlight` search changes | UI/source tests |

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
- Commit 7 does not require manual validation for local acceptance; deployed database migration application remains an operational deployment step
- Commit 8 makes notification visibility use the same campaign current-value resolver as alert creation before deciding whether linked KPI/Benchmark alerts remain visible
- Commit 8 final focused regression suite passed: 8 test files / 49 tests
- Commit `4f313218` clarifies that `Alert Frequency` controls reminder emails while the KPI or Benchmark remains breaching, not repeated in-app notification rows
- Commit `75c38529` aligns GA4 KPI/Benchmark alert form layout so `Send email notifications` is on the left, `Alert Frequency` is on the right, and frequency is disabled until email notifications are selected
- Commit `4bbffd53` makes GA4 KPI alert reconciliation consider all KPI rows so valid active alerts are not incorrectly superseded by campaign/metric dedupe and disabled stale alerts can be cleared
- Commit `99415fe6` adds visible GA4 KPI/Benchmark card highlighting for alert action URLs
- Commit `12bcf04b` makes the GA4 page react to query-only `tab`/`highlight` changes through URL search state
- Commit `4562711e` changes bell performance-alert clicks to open the specific alert in the Notifications center at `/notifications?highlight=:notificationId`
- Commit `1bac44e4` refreshes active alert rows after KPI/Benchmark edits, awaits campaign Benchmark alert reconciliation, and refetches `/api/notifications` after GA4 and campaign-level KPI/Benchmark create/update/delete mutations
- `npm run check` passed
- `npm run build` passed after rerunning with elevated permission required for Vite/esbuild process spawning

Partially reviewed:

- browser-rendered click-through of the bell, Notifications page highlight, and `View KPI` / `View Benchmark` action remains manual/deployed evidence; local proof is source-level regression coverage plus successful production build
- scheduler/source-refresh behavior is covered by focused regression traces and existing job wiring, not by a live scheduled run in this local pass

Not locally verifiable:

- deployed email delivery
- provider delivery events
- live GA4 freshness timing
- production data edge cases
- deployed database migration application

Production-ready conclusion:

- GA4 KPI/Benchmark alerts and notifications can be marked production-ready for the locally verifiable implementation scope after Commit 8
- provider/inbox email delivery must still be evidenced separately before anyone claims a real email was delivered
- deployed database migration application must still be verified in the target environment
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
- render `Send email notifications` on the left and `Alert Frequency` on the right
- disable `Alert Frequency` unless email notifications are selected
- describe alert frequency as reminder email cadence while the KPI/Benchmark remains breaching
- reconcile every relevant active KPI/Benchmark row instead of deduplicating by display metric unless the dedupe rule is explicitly product-defined and tested
- update an existing active alert row in place when the linked item is edited and still breached
- generate platform-correct campaign-scoped deep-links
- make platform pages react to query-only action URL changes when action URLs use query params for tab/item selection
- make bell performance-alert clicks open Notifications triage context through canonical `/notifications?selected=:notificationId`, while legacy `/notifications?highlight=:notificationId` remains transition-compatible
- preserve the metadata action URL from the Notifications page `View KPI` / `View Benchmark` action
- refresh `/api/notifications` after alert-impacting create, update, and delete mutations
- add focused regression tests before marking the copied source production-ready

## Notifications Triage UX Improvement Strategy

Status: UX-9 final validation/documentation closure is complete.

### UX Root Cause Analysis

The current alert user journey is functionally safer than the earlier direct deep-link-only flow, but it is still not the best product experience.

Current friction:

- the bell, Notifications page, and KPI/Benchmark cards each behave like separate destinations instead of one guided alert workflow
- clicking a bell alert can feel like an intermediate stop because the user lands on a highlighted notification row before taking the actual KPI/Benchmark action
- the Notifications page is mostly an inbox/list, not a triage center that explains what breached, why it matters, and what the next action is
- alert read state, dismiss state, analytical resolution, and KPI/Benchmark editing are separate concepts, but the UI does not make those differences obvious enough
- the full Notifications page has filters and pagination, but not a persistent selected-alert detail surface that keeps alert context visible

Recommended product model:

- Bell = quick alert entry point and unread/active alert signal
- Notifications page = alert triage center
- KPI/Benchmark page = metric action context

Recommended user journey:

`Bell -> Notifications full-width list with unread highlights -> View KPI/Benchmark`

The bell should open the Notifications center directly. The Notifications page should highlight unread alerts and expose the KPI/Benchmark action on each alert row without a persistent side panel. The KPI/Benchmark page should remain where the user reviews or edits the underlying metric target, threshold, or benchmark.

### Target UX Contract

The improved flow should behave as follows:

- `/notifications?selected=:notificationId` is the canonical triage selection route for the planned UX
- `/notifications?highlight=:notificationId` remains a legacy compatibility route during the transition and must not be removed until UX compatibility is regression-covered
- KPI/Benchmark metadata action URLs keep using `highlight` for platform card highlighting, for example `/campaigns/:id/ga4-metrics?tab=kpis&highlight=:kpiId`
- clicking the top-bar bell opens `/notifications` directly instead of opening a dropdown
- unread alert rows are highlighted in the Notifications list
- clicking a Notifications row selects and highlights it through `/notifications?selected=:notificationId` for legacy selected-link compatibility
- the Notifications page shows a full-width alert list without a persistent selected-detail side panel
- each alert row keeps the primary `View KPI` or `View Benchmark` action
- secondary row actions are `Dismiss alert` and read/unread toggle where appropriate
- dismissed alerts are clearly described as hidden from the active inbox, not analytically resolved
- resolved alerts do not appear in the default active-alert view, but can be available in a history/status view if retained by the API
- deleting a KPI/Benchmark removes the related active alert from bell and Notifications without deleting unrelated alert history
- editing a still-breached KPI/Benchmark refreshes the selected alert detail without creating duplicates
- editing a KPI/Benchmark so it no longer breaches removes it from the active alert list

### Commit UX-1: Authoritative UX Contract

Status: complete for the documentation-only scope.

Scope:

- document the alert triage product contract in this file
- update the lifecycle matrix rows that currently describe bell and Notifications deep-links so they distinguish triage navigation from KPI/Benchmark action navigation
- update the manual validation checklist to validate the triage journey rather than direct bell-to-card navigation

Validation:

- documentation review only
- confirm no runtime files are changed

Root cause documented:

- the readiness tracker mixed current implementation navigation with the planned triage route, so future commits could confuse Notifications triage selection with platform KPI/Benchmark card highlighting

Validation completed:

- documentation-only review of this file
- local runtime trace confirmed current code still uses `/notifications?highlight=:notificationId` for bell-to-Notifications navigation and does not yet implement `/notifications?selected=:notificationId`
- no runtime files were changed for UX-1

### Commit UX-2: Notifications Page Selected Alert State

Status: complete.

Scope:

- make `/notifications?selected=:notificationId` the canonical selected-alert route
- keep backwards compatibility with `/notifications?highlight=:notificationId` during transition
- derive selected alert state from the URL
- when a selected alert is hidden, resolved, or missing, show a clear empty/detail state instead of silently doing nothing
- keep existing notification query and ownership filtering unchanged

Required tests:

- selected notification id is read from query string
- legacy `highlight` query still focuses the same row during transition
- missing selected notification renders a safe empty state
- filters do not prevent the selected active alert from being visible

Root cause fixed:

- the Notifications page read only `/notifications?highlight=:notificationId`, so canonical `/notifications?selected=:notificationId` links were ignored
- the existing highlight compatibility path reset filters and paginated to a matching alert, but it had no explicit unavailable-selected-alert state when the selected notification was hidden, resolved, dismissed, deleted, or not returned by the active notification query

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Manual validation requirement:

- manual browser validation is useful for final UX evidence, but it is not required for local UX-2 acceptance because the changed behavior is URL-state parsing, selected-row focus compatibility, filter reset preservation, and unavailable-selected-alert copy covered by the focused regression guard

### Commit UX-3: Two-Pane Alert Triage Layout

Status: complete.

Scope:

- convert the Notifications page from list-only to list plus selected-detail layout
- preserve current filters/search but make `Active alerts` the default user-facing mode
- keep cards compact in the list; move detailed breach context into the detail panel
- add stable row selection styling without relying only on scroll/highlight
- keep pagination behavior predictable, or replace pagination with a scrollable list only if the existing page pattern supports it cleanly

Required tests:

- selected alert row has selected styling
- selected alert detail renders the same notification id
- list filters/search do not mutate notification data
- empty active-alert state remains clear

Manual validation:

- open Notifications directly
- select several alerts
- confirm detail panel updates without losing list context

Root cause fixed:

- after UX-2 the page could resolve a selected notification from the URL, but the UI was still a single list where alert context, row focus, and actions competed inside each row
- selecting an already-visible row could also trigger the selected-route filter-reset path, so in-list selection risked losing the user's current filter/search context instead of updating detail state in place
- follow-up UX-3 validation found the page still jumped when clicking between visible alerts because the URL-backed selection scroll effect called `scrollIntoView` for direct row clicks as well as external/deep-link selection

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`
- follow-up validation reran `npm test -- server/notification-visibility-regression.test.ts` and `npm run check` after suppressing scroll only for direct row selection
- user-reported manual validation passed on 2026-06-23: opening Notifications directly, selecting several alerts, and confirming the detail panel updated without losing list context

Partially reviewed:

- local source/test validation proves the two-pane layout structure, selected-row styling, selected detail identity, local filtering behavior, and active-alert empty state

Not independently verified by the agent:

- browser-rendered UX-3 evidence was provided by user manual validation and was not independently rerun in this local session

### Commit UX-4: Alert Detail Content And Actions

Status: complete for the local code/test scope.

Scope:

- add a reusable alert detail renderer for KPI and Benchmark performance alerts
- show client, campaign, platform/source, item name, current value, threshold value, condition, created time, and status
- make `Open KPI` / `Open Benchmark` the primary action using the stored `metadata.actionUrl`
- add `Edit alert settings` where the destination can be proven from the existing item route
- keep `Dismiss alert` as a visibility action and label it accordingly
- do not change alert evaluation math or notification API response shape unless a missing field is proven necessary

Required tests:

- KPI alert detail shows KPI-specific action label
- Benchmark alert detail shows Benchmark-specific action label
- primary action preserves `metadata.actionUrl`
- dismiss action does not imply analytical resolution

Root cause fixed:

- UX-3 added a selected-alert detail panel, but that panel still rendered mostly generic notification title/message fields and did not provide a shared KPI/Benchmark detail/action model.
- The `/api/notifications` route already fetched linked KPI/Benchmark rows for ownership, active-breach visibility, and title enrichment, but it did not expose the linked row's platform label, item name, current value, threshold, or alert condition to the selected-detail UI.
- The selected-detail UI had no primary `Open KPI` / `Open Benchmark`, no proven alert-settings destination, and no dismiss copy that explicitly separated notification visibility from analytical resolution.

Files changed:

- `client/src/pages/notifications.tsx`
- `server/routes-oauth.ts`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Proven locally:

- the notification route keeps the same top-level response shape while response-enriching existing `metadata` from already-fetched linked KPI/Benchmark rows
- KPI and Benchmark selected-alert details use the shared renderer and show item type, item name, platform/source, current value, threshold value, condition, status, and created time
- selected-detail primary action uses the stored `metadata.actionUrl`
- `Edit alert settings` uses the same proven item route rather than inventing a new destination
- `Dismiss alert` copy states that dismissal hides the notification from active views and does not resolve the underlying KPI/Benchmark breach
- non-performance notification details keep the previous generic detail rendering and do not get KPI/Benchmark action labels

Partially reviewed:

- response-only metadata enrichment is backward-compatible for existing consumers that already parse `metadata.actionUrl`, `kpiId`, or `benchmarkId`; no alert evaluation math, KPI/Benchmark calculations, email behavior, ownership checks, or notification visibility predicates were changed

Not locally verified:

- responsive/browser-rendered visual fit of the enriched right-side detail panel

Manual validation:

- select a KPI alert and click `Open KPI`
- select a Benchmark alert and click `Open Benchmark`
- dismiss a still-breached alert and confirm it leaves active view only

Manual validation completed:

- user-reported manual validation passed on 2026-06-23 for `Open KPI`, `Open Benchmark`, and `Dismiss alert` from the selected detail panel

### Commit UX-5: Bell Dropdown As Quick Entry

Status: complete for the local code/test scope.

Scope:

- make bell rows route to `/notifications?selected=:notificationId`
- keep unread count and popover refresh behavior
- make the dropdown copy/action clear that the user is opening alert details
- avoid duplicating full triage controls inside the bell dropdown
- keep the dismiss icon behavior separate from row click behavior

Required tests:

- performance-alert bell row routes to `/notifications?selected=:notificationId`
- dismiss icon does not trigger row navigation
- unread count still derives from `/api/notifications`

Root cause fixed:

- the bell performance-alert click handler still routed to `/notifications?highlight=:notificationId`, even though the Notifications page selected-detail contract now treats `/notifications?selected=:notificationId` as canonical
- the bell row already marked alerts read and closed the popover before navigating, and the dismiss icon already stopped propagation, so no lifecycle or visibility mutation changes were required

Files changed:

- `client/src/components/layout/navigation.tsx`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Proven locally:

- performance-alert bell row clicks route to `/notifications?selected=:notificationId`
- bell popover still derives unread count from `/api/notifications`
- bell popover still invalidates/refetches `/api/notifications` when opened
- bell dismiss icon keeps `preventDefault()` and `stopPropagation()` before dismissing the notification, so it does not trigger row navigation
- the bell row uses a compact `Open details` cue without duplicating selected-detail triage controls inside the popover

Partially reviewed:

- the change is limited to bell performance-alert routing/copy and source guards; it does not change notification visibility, alert evaluation, KPI/Benchmark math, email behavior, or API ownership/scoping rules

Manual validation:

- click bell alert and confirm the Notifications detail opens selected
- dismiss from bell and confirm the row is hidden without navigating

Manual validation completed:

- user-reported manual validation passed on 2026-06-23 for bell alert selected-detail navigation and bell dismiss without navigation

### Commit UX-6: Edit/Delete Reflection And Detail Refresh

Status: complete for the local code/test scope.

Scope:

- ensure KPI/Benchmark create, update, delete, dismiss, and alert reconciliation paths refresh `/api/notifications`
- ensure selected alert detail updates when the linked KPI/Benchmark is edited and still breaching
- ensure selected alert detail exits to a clear resolved/deleted state when the linked KPI/Benchmark is no longer visible
- preserve one active alert per breached item

Required tests:

- editing a still-breached KPI refreshes the existing active alert detail
- editing a still-breached Benchmark refreshes the existing active alert detail
- deleting a KPI hides the selected alert from active Notifications
- deleting a Benchmark hides the selected alert from active Notifications
- bell count and Notifications page query are invalidated/refetched after each mutation

Root cause fixed:

- prior commits had already made GA4 and campaign-level KPI/Benchmark create, update, and delete mutations invalidate/refetch `/api/notifications`, and alert reconciliation already updates existing active KPI/Benchmark notification rows in place when an item is edited and still breached
- linked KPI/Benchmark delete routes already soft-hide related active notifications, but the selected-detail panel could fall back to generic `Select an alert` copy when the selected alert disappeared while other alerts remained visible
- bell notification mutations updated the cache optimistically or invalidated `/api/notifications`, but did not explicitly refetch the notification query on mutation success like the Notifications page and KPI/Benchmark mutation paths do

Files changed:

- `client/src/components/layout/navigation.tsx`
- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Proven locally:

- bell read, mark-all-read, clear-all, and dismiss mutation success handlers now invalidate and refetch `/api/notifications`
- selected Notifications detail now renders a dedicated `Selected alert is no longer active` detail state when the selected row disappears while the two-pane layout remains visible
- existing GA4 KPI/Benchmark and campaign-level KPI/Benchmark mutations still invalidate/refetch `/api/notifications`
- existing KPI/Benchmark alert reconciliation still updates preserved active notification rows in place after still-breached edits
- existing linked KPI/Benchmark delete routes soft-hide related active notifications through the current visibility path

Partially reviewed:

- this commit only changes query refresh and selected-detail fallback UI; it does not change alert evaluation math, notification visibility predicates, KPI/Benchmark calculations, email behavior, or API ownership/scoping rules

Manual validation:

- edit an alert-enabled KPI threshold/name/current state and confirm bell plus selected detail update
- delete a KPI/Benchmark with an active alert and confirm it disappears from active views

Manual validation completed:

- user-reported manual validation passed on 2026-06-23 for still-breached edit refresh and active-alert removal after KPI/Benchmark delete

### Commit UX-7: Alert Status Model And History View

Status: complete for the local code/test scope.

Scope:

- separate active, read, dismissed, and resolved concepts in UI copy
- add an `Active` default view and optional `History` view if current API data supports it safely
- do not expose hidden/dismissed rows unless the API can prove user ownership and status meaning
- avoid hard-deleting user-visible alert history

Required tests:

- active view excludes dismissed/resolved alerts
- history view, if implemented, labels dismissed/resolved rows accurately
- read/unread state does not change analytical alert status

Root cause fixed:

- the Notifications UI used `Status` for read/unread filtering and combined selected-detail alert status with read state as `Active, read` or `Active, unread`
- that copy blurred two different concepts: active analytical alert visibility versus whether the user has read the notification row
- the current `/api/notifications` route is intentionally active-only and filters dismissed/resolved rows through campaign ownership checks; exposing hidden/dismissed history would require a separate audited API/status contract and was not safe as part of this small UX commit

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Proven locally:

- the active notifications route excludes dismissed/resolved rows before the UI receives them
- the selected KPI/Benchmark detail now renders `Alert status: Active` separately from `Read state: Read/Unread`
- the page filter label is `Read state`, not generic `Status`
- read/unread state no longer changes the analytical alert-status copy
- no History view was added because the current active-notification API does not safely expose dismissed/resolved history rows

Partially reviewed:

- this commit is UI copy/status separation plus regression coverage only; it does not change notification visibility rules, alert lifecycle mutations, KPI/Benchmark calculations, email behavior, API ownership/scoping rules, or expose hidden history rows

Manual validation:

- mark alert read/unread and confirm status copy remains accurate
- dismiss alert and confirm it moves out of active view

Manual validation completed:

- user-reported manual validation passed on 2026-06-23 for read/unread status separation and dismissal moving the alert out of the active view

### Commit UX-8: Cross-Platform Triage Template

Status: complete for the local code/test scope.

Scope:

- make the triage UI consume platform-neutral metadata where possible
- define the minimum metadata required for future sources: item id, item type, platform/source, campaign id, action URL, current value, threshold value, condition, and display labels
- preserve GA4 behavior while allowing Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration to plug into the same triage contract
- do not mark a future source ready until its own links, ownership checks, alert reconciliation, and detail content are regression-covered

Required tests:

- unknown platform alerts fail closed to safe detail copy
- GA4 action links still work
- platform label rendering does not hard-code GA4 only

Root cause fixed:

- the selected alert detail renderer consumed some platform-neutral metadata, but it still inferred unsupported `itemType` values as KPI and could show raw platform keys such as `google_analytics` when server-side metadata enrichment was absent
- this made future-source alert rows too easy to mislabel in the triage panel before that source's links, ownership checks, alert reconciliation, and detail content were proven

Minimum metadata template for future sources:

- `itemType`: `kpi` or `benchmark`
- `kpiId` or `benchmarkId`
- `itemName`
- `platformType`
- `platformLabel`
- `campaignId`
- `actionUrl`
- `currentValue`
- `thresholdValue`
- `alertCondition`

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts`
- `npm run check`

Proven locally:

- selected alert detail recognizes only KPI and Benchmark metadata for the rich triage renderer
- unsupported or unknown item metadata falls back to generic notification detail instead of showing KPI/Benchmark actions
- platform labels are normalized from `platformLabel` or `platformType`, including GA4, Google Ads, Google Sheets, Meta, Custom Integration, and generic future platform keys
- GA4 action URLs remain preserved through existing `metadata.actionUrl` handling
- no notification visibility, alert lifecycle, KPI/Benchmark calculation, email behavior, or API ownership/scoping rule was changed

Partially reviewed:

- the UI can display platform-neutral metadata for future sources, but each future source still needs source-specific link generation, ownership checks, alert reconciliation, and regression coverage before it is production-ready

Manual validation completed:

- user-reported manual validation passed on 2026-06-23 for normal alert detail display, `Open KPI` / `Open Benchmark` action behavior, and platform label display

### Commit UX-9: Final UX Validation And Documentation Closure

Status: complete.

Required validation:

```bash
npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts
npm test -- server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-ui-regression.test.ts
npm run check
npm run build
```

Manual validation:

1. Create a breached GA4 KPI alert.
2. Confirm the bell count increments.
3. Click the top-bar bell icon.
4. Confirm Notifications opens directly without an intermediate dropdown.
5. Click the alert row.
6. Confirm Notifications opens with that alert selected in the detail panel.
7. Confirm the detail panel shows client, campaign, KPI name, current value, threshold, and condition.
8. Click `Open KPI`.
9. Confirm the GA4 KPI card opens.
10. Edit the KPI so it still breaches.
11. Confirm the selected detail refreshes and no duplicate active alert appears.
12. Edit the KPI so it no longer breaches.
13. Confirm the alert leaves active bell and Notifications views.
14. Repeat for a GA4 Benchmark.
15. Dismiss a still-breached alert and confirm the UI explains that dismissal hides the notification but does not resolve the KPI/Benchmark breach.

Final documentation must separate:

- proven locally
- partially reviewed
- not locally verifiable
- deployed/manual validation evidence

Root cause closed:

- UX-2 through UX-8 implemented the Notifications triage route, two-pane detail layout, bell quick-entry path, selected-detail actions, refresh behavior, status copy, and platform-neutral metadata handling, but this tracker still needed final validation evidence and explicit separation of local proof versus browser/deployed evidence.

Files changed:

- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 38 tests
- `npm test -- server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-ui-regression.test.ts` passed: 3 files / 40 tests
- `npm run check` passed
- `npm run build` passed after rerun outside the sandbox; the first sandboxed attempt failed at Vite config loading with `spawn EPERM`

Proven locally:

- performance-alert visibility still hides dismissed/resolved rows and fail-closes orphaned, cross-campaign, non-breaching, and malformed rows
- selected notification routing supports canonical `selected` and legacy `highlight` compatibility
- Notifications row selection routes to `/notifications?selected=:notificationId`
- selected-detail `Open KPI` / `Open Benchmark` actions preserve stored `metadata.actionUrl`
- notification dismiss remains a visibility action and does not claim KPI/Benchmark breach resolution
- read/unread state is separate from active alert status
- KPI/Benchmark create, update, delete, and reconciliation paths remain regression-covered for notification query refresh, active-row update, deletion hiding, duplicate suppression, and current-value alert evaluation
- GA4 KPI/Benchmark UI regressions and TypeScript/build validation pass

Partially reviewed:

- cross-platform triage metadata is template-ready at the UI contract level, but future sources still need source-specific action URL generation, ownership checks, alert reconciliation, and regression evidence before their alert/notification behavior can be marked production-ready
- history/dismissed-row display remains intentionally unimplemented because the current active notification API safely excludes dismissed/resolved rows and does not expose an audited history contract

Not locally verifiable:

- exhaustive deployed browser rendering across all supported desktop/mobile viewports
- deployed provider/inbox email delivery
- production database migration/application state from earlier alert-readiness work
- real non-GA4 future-source alert lifecycle correctness beyond the platform-neutral UI metadata fallback

Deployed/manual validation evidence:

- user-reported manual validation passed for UX-3 through UX-8 on 2026-06-23
- user-reported UX-9 manual smoke validation passed on 2026-06-23 for Notifications triage navigation, selected alert detail display, `Open KPI` / `Open Benchmark`, and dismiss-as-visibility behavior
- broader deployed evidence remains recommended for still-breached edit refresh, non-breaching edit removal, delete removal, full viewport coverage, and reminder-email provider/inbox evidence where email is enabled

### Post-UX-9 Direct Bell Navigation Adjustment

Status: implemented and pushed in commit `20cec5d8`.

Root cause:

- the top-bar notification bell was still implemented as a popover trigger, so its primary click opened an intermediate dropdown before the user could reach the Notifications page
- that dropdown duplicated notification row navigation, read, clear, and dismiss controls even though the full Notifications page is now the authoritative triage surface

Smallest safe fix:

- keep the existing unread count query and badge in the top navigation
- remove only the top-bar bell dropdown surface and its dropdown-only mutations
- make the bell button navigate directly to `/notifications`
- keep unread highlighting on the Notifications page list, where unread rows already use the left blue border and subtle blue background
- preserve selected-row routing with `/notifications?selected=:notificationId` and legacy `/notifications?highlight=:notificationId` compatibility

Files changed:

- `client/src/components/layout/navigation.tsx`
- `server/notification-visibility-regression.test.ts`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 27 tests
- `npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 38 tests
- `npm run check` passed
- `npm run build` passed after rerun outside the sandbox; the first sandboxed attempt failed at Vite config loading with `spawn EPERM`

Not locally verifiable:

- real browser click/rendering of the top-bar bell opening `/notifications` directly
- deployed unread-row visual highlighting across supported viewport sizes

Not changed:

- alert evaluation math
- notification visibility rules
- KPI/Benchmark calculations
- email delivery behavior
- API ownership/scoping rules
- selected Notifications detail behavior
- KPI/Benchmark metadata action URLs

### Post-UX-9 Notifications Page Bell Active State Adjustment

Status: implemented and pushed in commit `9cb490d5`.

Root cause:

- after the direct bell navigation fix, the top-bar bell still rendered as an active button on the Notifications page, so clicking it could re-navigate to the page the user was already on
- the navigation component did not derive an active Notifications route state from `useLocation`, so it had no way to distinguish normal navigation from the current-page state

Smallest safe fix:

- derive `isNotificationsPage` from the current route in `client/src/components/layout/navigation.tsx`
- keep the same unread notification query and badge
- disable the bell button when the current route is `/notifications` or a Notifications query route
- render the bell icon green in that active state
- keep direct `/notifications` navigation unchanged on every other route

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 27 tests
- `npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 38 tests
- `npm run check` passed
- `npm run build` passed after rerun outside the sandbox; the first sandboxed attempt failed at Vite config loading with `spawn EPERM`

Not locally verifiable:

- real browser confirmation that the active Notifications bell appears green and cannot be clicked

### Post-UX-9 Full-Width Notifications List Adjustment

Status: implemented locally.

Root cause:

- the Notifications page still rendered the UX-3 two-column desktop grid, including an empty right-side `Select an alert` panel when no row was selected
- the page also rendered a local `Active alerts` heading and current-view count immediately above the alert cards, duplicating context already provided by the page header and filters
- because the side panel occupied the second grid column, alert cards could not use the full available content width

Smallest safe fix:

- remove only the selected-detail side panel and the empty `Select an alert` panel from `client/src/pages/notifications.tsx`
- remove the local `Active alerts` heading/current-view count above the list
- render the alert list as a single full-width section
- keep filters, pagination, unread row highlighting, row selection/legacy selected-link compatibility, row `View KPI` / `View Benchmark`, read/unread toggle, and dismiss actions intact
- keep the stale selected-link warning as a normal top-of-page alert instead of a side panel

Not changed:

- alert evaluation math
- notification visibility rules
- KPI/Benchmark calculations
- email delivery behavior
- API ownership/scoping rules
- KPI/Benchmark metadata action URLs

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 27 tests
- `npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 38 tests
- `npm run check` passed
- `npm run build` passed after rerun outside the sandbox; the first sandboxed attempt failed at Vite config loading with `spawn EPERM`

Not locally verifiable:

- real browser confirmation that the selected-detail panel and `Active alerts` heading/count are removed and alert cards span the Notifications content width

## Target UX Manual Validation Checklist

This checklist validates the implemented triage journey after UX-2 through UX-9 and the direct bell/full-width list adjustments. The top-bar bell now opens `/notifications` from other pages, appears green and disabled on the Notifications page, alert cards span the Notifications content width, selected alert rows use `/notifications?selected=:notificationId`, and legacy `/notifications?highlight=:notificationId` remains transition-compatible for old links.

Use a disposable GA4 campaign with known values.

1. Create a GA4 KPI with alerts enabled and a breached threshold.
2. Confirm the bell count updates and the Notifications page active view shows one KPI alert.
3. Click the top-bar bell icon and confirm it opens the Notifications page directly without opening a dropdown.
4. Confirm the bell icon is green and cannot be clicked while you are on the Notifications page.
5. Confirm there is no right-side `Select an alert` panel.
6. Confirm the `Active alerts` heading/current-view count is not shown above the cards.
7. Confirm alert cards span the Notifications content width.
8. Confirm unread alert rows are highlighted in the Notifications list.
9. Click `View KPI` on the row and confirm it preserves the metadata action URL and opens the GA4 KPI tab with the KPI card highlighted.
10. Update the KPI so it no longer breaches.
11. Confirm the alert disappears from active bell and Notifications views.
12. Re-breach the same KPI.
13. Confirm exactly one active alert returns and can be selected from the Notifications list.
14. Repeat the same flow for a GA4 Benchmark, using `View Benchmark` from the alert row.
15. Confirm the alert form layout: `Send email notifications` appears on the left, `Alert Frequency` appears on the right, and `Alert Frequency` is disabled until email notifications are selected.
16. Dismiss a still-breached KPI/Benchmark alert and confirm the UI explains that dismissal hides the notification from active views but does not analytically resolve the KPI/Benchmark breach.
17. Run or trigger the valid reconciliation path.
18. Confirm exactly one new active alert appears.
19. Enable email alerts with a safe recipient in a deployed environment.
20. Confirm provider acceptance separately from inbox/provider delivery.

Pass criteria:

- visible in-app state matches the underlying GA4 KPI/Benchmark breach state
- no stale resolved alerts remain visible
- no duplicate active alerts appear for the same GA4 KPI/Benchmark
- top-bar bell clicks open the Notifications page directly without an intermediate dropdown
- top-bar bell is green and disabled when already on the Notifications page
- the Notifications page does not render the right-side `Select an alert` panel
- the Notifications page does not render the `Active alerts` heading/current-view count above alert cards
- alert cards span the Notifications content width
- unread alert rows are visually highlighted in the Notifications list
- alert row selection remains transition-compatible through canonical `selected` routing
- legacy `highlight` notification URLs remain transition-compatible until their removal is explicitly planned and regression-covered
- Notifications row `View KPI` / `View Benchmark` actions open the correct campaign, tab, and item
- query-only GA4 action URL changes update the visible tab/card highlight
- Alert Frequency remains email-reminder-only and disabled unless email notifications are selected
- email status is reported only according to the evidence available
