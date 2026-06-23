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
- Commit 7 does not require manual validation for local acceptance; deployed database migration application remains an operational deployment step
- Commit 8 makes notification visibility use the same campaign current-value resolver as alert creation before deciding whether linked KPI/Benchmark alerts remain visible
- Commit 8 final focused regression suite passed: 8 test files / 49 tests
- `npm run check` passed
- `npm run build` passed after rerunning with elevated permission required for Vite/esbuild process spawning

Partially reviewed:

- browser-rendered click-through of the bell and Notifications page remains manual/deployed evidence; local proof is source-level regression coverage plus successful production build
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
- generate platform-correct campaign-scoped deep-links
- refresh `/api/notifications` after alert-impacting create, update, and delete mutations
- add focused regression tests before marking the copied source production-ready

## Notifications Triage UX Improvement Strategy

Status: planned; not implemented by the completed GA4 alert readiness commits.

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

`Bell -> Notifications alert detail -> Open KPI/Benchmark or edit alert settings`

The bell should help the user find the alert quickly. The Notifications page should explain the alert and offer the next action. The KPI/Benchmark page should remain where the user edits the underlying metric target, threshold, or benchmark.

### Target UX Contract

The improved flow should behave as follows:

- clicking a bell performance alert opens `/notifications?selected=:notificationId`
- the Notifications page shows a two-pane triage layout on desktop: alert list on the left, selected alert detail on the right
- on mobile, the selected alert detail can replace the list with a clear back-to-list control
- the selected alert detail shows client, campaign, source/platform, KPI/Benchmark name, current value, threshold value, condition, alert status, created time, and last refreshed time when available
- the primary action is `Open KPI` or `Open Benchmark`
- secondary actions are `Edit alert settings`, `Dismiss alert`, and read/unread toggle where appropriate
- dismissed alerts are clearly described as hidden from the active inbox, not analytically resolved
- resolved alerts do not appear in the default active-alert view, but can be available in a history/status view if retained by the API
- deleting a KPI/Benchmark removes the related active alert from bell and Notifications without deleting unrelated alert history
- editing a still-breached KPI/Benchmark refreshes the selected alert detail without creating duplicates
- editing a KPI/Benchmark so it no longer breaches removes it from the active alert list

### Commit UX-1: Authoritative UX Contract

Status: planned.

Scope:

- document the alert triage product contract in this file
- update the lifecycle matrix rows that currently describe bell and Notifications deep-links so they distinguish triage navigation from KPI/Benchmark action navigation
- update the manual validation checklist to validate the triage journey rather than direct bell-to-card navigation

Validation:

- documentation review only
- confirm no runtime files are changed

### Commit UX-2: Notifications Page Selected Alert State

Status: planned.

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

### Commit UX-3: Two-Pane Alert Triage Layout

Status: planned.

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

### Commit UX-4: Alert Detail Content And Actions

Status: planned.

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

Manual validation:

- select a KPI alert and click `Open KPI`
- select a Benchmark alert and click `Open Benchmark`
- dismiss a still-breached alert and confirm it leaves active view only

### Commit UX-5: Bell Dropdown As Quick Entry

Status: planned.

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

Manual validation:

- click bell alert and confirm the Notifications detail opens selected
- dismiss from bell and confirm the row is hidden without navigating

### Commit UX-6: Edit/Delete Reflection And Detail Refresh

Status: planned.

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

Manual validation:

- edit an alert-enabled KPI threshold/name/current state and confirm bell plus selected detail update
- delete a KPI/Benchmark with an active alert and confirm it disappears from active views

### Commit UX-7: Alert Status Model And History View

Status: planned.

Scope:

- separate active, read, dismissed, and resolved concepts in UI copy
- add an `Active` default view and optional `History` view if current API data supports it safely
- do not expose hidden/dismissed rows unless the API can prove user ownership and status meaning
- avoid hard-deleting user-visible alert history

Required tests:

- active view excludes dismissed/resolved alerts
- history view, if implemented, labels dismissed/resolved rows accurately
- read/unread state does not change analytical alert status

Manual validation:

- mark alert read/unread and confirm status copy remains accurate
- dismiss alert and confirm it moves out of active view

### Commit UX-8: Cross-Platform Triage Template

Status: planned.

Scope:

- make the triage UI consume platform-neutral metadata where possible
- define the minimum metadata required for future sources: item id, item type, platform/source, campaign id, action URL, current value, threshold value, condition, and display labels
- preserve GA4 behavior while allowing Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration to plug into the same triage contract
- do not mark a future source ready until its own links, ownership checks, alert reconciliation, and detail content are regression-covered

Required tests:

- unknown platform alerts fail closed to safe detail copy
- GA4 action links still work
- platform label rendering does not hard-code GA4 only

### Commit UX-9: Final UX Validation And Documentation Closure

Status: planned.

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
3. Click the bell row.
4. Confirm Notifications opens with that alert selected in the detail panel.
5. Confirm the detail panel shows client, campaign, KPI name, current value, threshold, and condition.
6. Click `Open KPI`.
7. Confirm the GA4 KPI card opens.
8. Edit the KPI so it still breaches.
9. Confirm the selected detail refreshes and no duplicate active alert appears.
10. Edit the KPI so it no longer breaches.
11. Confirm the alert leaves active bell and Notifications views.
12. Repeat for a GA4 Benchmark.
13. Dismiss a still-breached alert and confirm the UI explains that dismissal hides the notification but does not resolve the KPI/Benchmark breach.

Final documentation must separate:

- proven locally
- partially reviewed
- not locally verifiable
- deployed/manual validation evidence

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
