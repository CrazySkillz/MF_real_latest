# GA4 KPI/Benchmark Alerts And Notifications Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

Track the work required to make GA4 KPI and Benchmark alerts and notifications production-ready.

This file is the authoritative tracker for GA4 KPI/Benchmark alert and notification readiness. Older KPI notification planning files remain historical reference only and must not be used as production-readiness proof by themselves:

- `KPI_NOTIFICATIONS_IMPLEMENTATION_PLAN.md`
- `KPI_NOTIFICATIONS_TESTING_GUIDE.md`
- `KPI_ALERTS_AND_PERIOD_TRACKING_PROPOSAL.md`

## Authoritative Readiness Statement

- As of June 27, 2026, GA4 KPIs and GA4 Benchmarks are production-ready for the current GA4 code scope. The durable whole-tab sources of truth are `GA4/KPIS_PRODUCTION_READINESS.md` and `GA4/BENCHMARKS_PRODUCTION_READINESS.md`.
- GA4 KPI/Benchmark alerts and notifications were not production-ready at Commit 1; that statement is historical and does not describe the current GA4 KPI/Benchmark section status.
- After Commits 2 through 8 in this file were implemented, their required validation passed, and final evidence was recorded here, the GA4 KPI alerts, GA4 KPI notifications, GA4 Benchmark alerts, and GA4 Benchmark notifications sections became locally code-ready by this document's criteria.
- As of Commit 8, the locally verifiable GA4 KPI/Benchmark alert and notification implementation is production-ready by this document's code-readiness criteria.
- The current implementation template also includes the post-Commit-8 alignment fixes documented below: alert frequency UI scope/layout, GA4 alert email full-width address row and conditional frequency visibility, create-button required-field gates, all-row GA4 KPI reconciliation, query-only action URL handling, bell-to-Notifications routing, edit/delete notification refresh, simplified Notification cards, authoritative action URL enrichment, persistent smooth KPI/Benchmark target highlighting, simplified Notifications filters, card actions limited to explicit KPI/Benchmark navigation, card-level alert detail values, removal of Notifications read-state UI, and client/campaign delete notification refresh.
- Provider-side alert email delivery remains an external/deployed evidence caveat: local scheduler and send-attempt wiring are code-ready, but no response should claim real email delivery unless provider delivery events or actual inbox receipt are recorded for the target environment.
- This file is the implementation and validation template for applying the same alert/notification lifecycle to other connected-platform sources, including Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, and Custom Integration.
- Other connected-platform sources are not production-ready from GA4 evidence alone. Each source must copy the proven GA4 lifecycle and pass the same lifecycle matrix with source-specific evidence before its KPI/Benchmark alert and notification behavior can be marked production-ready.

## New Source Template Reading Order

For a new chat or a new source such as Meta, Google Ads, LinkedIn, Instagram, TikTok, Google Sheets, or Custom Integration, use this file in this order:

1. Read `Production-Ready Acceptance Criteria` to understand the required GA4 behavior contract.
2. Read `Lifecycle Matrix` to map each KPI and Benchmark lifecycle path onto the target source.
3. Read `Post-Commit-8 Implementation Alignment` to copy the current UI, action URL, notification refresh, and required-field gate contracts that were added after the original alert commits.
4. Read `Alert Email Scheduler Production-Readiness Plan` before changing or validating executive email delivery behavior.
5. Read `Cross-Platform Template Rules` as the implementation checklist for the target source.
6. Read `Target UX Manual Validation Checklist` only after tracing the target source's actual UI/API path; do not invent a manual validation path for legacy or unreachable routes.

For each target source, create source-specific proof for: current-value resolution, in-app alert lifecycle, email scheduler lifecycle, create/edit/delete refresh behavior, campaign/client ownership, action URLs, notification visibility, form required-field gates, and regression coverage. GA4 proof is the template, not proof that another source is production-ready.

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
- the top-bar bell shows a red dot only, with no number, while at least one active KPI/Benchmark breach notification is visible
- the Notifications page Filters section does not expose `Read state`
- Notification cards do not expose per-card read/unread envelope controls or `Dismiss` controls
- Notification cards display `Current value`, `Threshold value`, and `Created date` for KPI/Benchmark alerts using the active notification response
- the Notifications page does not expose read-state UI: no unread subtitle, no `Mark All as Read`, no unread blue card highlight, and no read-state filtering
- the Notifications page `View KPI` / `View Benchmark` action preserves the metadata action URL and opens the correct KPI/Benchmark tab/card
- if the user is already on the same GA4 page, query-only action URL changes still switch to the correct tab/item by listening to the URL search string
- the target KPI/Benchmark card remains visibly highlighted while the action URL contains `highlight`, and destination scrolling is smooth rather than instant/jumpy
- successful GA4 and campaign-level KPI/Benchmark create, update, and delete mutations refresh `/api/notifications`
- successful client and campaign delete actions refresh `/api/notifications` so active Notifications do not keep stale KPI/Benchmark alerts for deleted campaigns
- `Create KPI` remains disabled until `KPI Name` and `Target Value` are both non-empty
- `Create Benchmark` remains disabled until `Benchmark Name` and `Benchmark Value` are both non-empty
- alert UI shows only `Send email notifications` by default when email notifications are off
- when email notifications are selected, `Email addresses *` appears as a full-width row with the label next to the input, and `Alert Frequency` appears underneath it
- `Email addresses *` and `Alert Frequency` are hidden unless `Send email notifications` is selected
- alert frequency helper text says it controls how often reminder emails are sent while the KPI or Benchmark is still breaching
- scheduler/source-refresh reconciliation does not rely on opening the bell, loading Notifications, or manually refreshing the page
- alert email reminders are checked by a scheduler cadence that can honor the saved frequency windows: immediate means at most once per hour while still breaching, daily means at most once per day, and weekly means at most once per week
- alert email send attempts are atomically deduplicated per KPI/Benchmark and frequency window so overlapping scheduler runs or multiple server instances cannot send duplicate executive emails for the same due window
- alert email audit state distinguishes at least `pending`, `sending`, `accepted`, `delivered`, `failed`, `skipped`, and `retry_scheduled`; provider/API acceptance must not be labeled as inbox delivery
- provider delivery confirmation is required before the product or validation notes say an executive alert email was delivered; when delivery events are unavailable, the status must remain `accepted` or `pending_delivery`
- failed alert email sends retry with bounded backoff while the KPI/Benchmark is still breaching, without bypassing dedupe or sending after the breach resolves
- immediate create/update email paths are durable and observable; route success must not hide a failed or skipped email attempt
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

Status: complete for the locally committed implementation through `bbf12340`.

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

### Commit `75c38529`: Alert Email Control Layout (Superseded)

Historical runtime behavior:

- the earlier implementation placed `Send email notifications` and `Alert Frequency` side by side
- the earlier implementation disabled `Alert Frequency` unless `Send email notifications` was selected
- email recipient fields appeared only when email notifications were selected

Superseded by:

- commit `60aa0d41` for the current full-width email address row layout
- commit `82f0695a` for the current conditional `Alert Frequency` visibility

Template requirement:

- use the newer `60aa0d41` and `82f0695a` contract below for current GA4 and future platform alert forms
- if email notifications are off, users can still receive in-app bell and Notifications alerts, but reminder email fields and cadence controls are inactive and hidden

### Commit `60aa0d41`: Alert Email Address Row Layout

Runtime behavior:

- `Send email notifications` remains the only visible email control before email notifications are selected
- once selected, `Email addresses *` renders as a full-width row with the label next to the input
- `Alert Frequency` renders underneath the email address row instead of beside it
- no alert math, notification visibility, API payload, email scheduler, or report email behavior changed

Template requirement:

- future platform alert forms should use the same full-width email address row and place `Alert Frequency` below it
- email layout changes must not change in-app alert lifecycle, current-value resolution, or email send eligibility

### Commit `82f0695a`: Conditional Alert Email Frequency Visibility

Runtime behavior:

- when `Send email notifications` is not selected, `Email addresses *` and `Alert Frequency` are hidden
- selecting `Send email notifications` reveals the full-width email address row and then `Alert Frequency`
- in-app bell and Notifications alerts remain available when email notifications are off
- no alert math, notification visibility, API payload, email scheduler, or report email behavior changed

Template requirement:

- future platform alert forms should hide both `Email addresses *` and `Alert Frequency` until email notifications are selected
- `Alert Frequency` remains email-reminder-only and must not imply repeated in-app notification rows

### Commit `bbf12340`: Create Form Required-Field Gates

Runtime behavior:

- `Create KPI` is disabled until `KPI Name` and `Target Value` are both non-empty
- `Create Benchmark` is disabled until `Benchmark Name` and `Benchmark Value` are both non-empty
- edit-submit behavior still uses the existing unchanged-form guard for `Update KPI` and `Update Benchmark`
- submit-handler validation remains a fallback, not the primary UX for missing create-required fields
- no KPI/Benchmark math, alert evaluation, notification visibility, API payload, email scheduler, or report email behavior changed

Template requirement:

- future platform KPI create forms should disable `Create KPI` until the source's KPI name and target value fields are non-empty
- future platform Benchmark create forms should disable `Create Benchmark` until the source's Benchmark name and Benchmark value fields are non-empty
- keep edit-mode unchanged-form guards separate from create-mode required-field guards
- keep server/API validation as fallback protection, not the only user-facing required-field gate

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
- the visible card highlight remains while `highlight` is present in the action URL and does not mutate alert state
- the destination card is scrolled into view with smooth scrolling

Template requirement:

- future platform analytics pages that use alert action URLs must react to query-only URL changes, not only path changes
- action URL highlighting should be visual navigation feedback only; it must not mark alerts read, dismiss alerts, resolve breaches, or mutate KPI/Benchmark state
- action URL target scrolling should be smooth and should not rely on a timer that removes the highlight before the user has reviewed the target card

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
| Create form required fields | `Create KPI` disabled until `KPI Name` and `Target Value` are non-empty | `Create Benchmark` disabled until `Benchmark Name` and `Benchmark Value` are non-empty | UI/source tests |
| Alert frequency UI | default shows only `Send email notifications`; when selected, `Email addresses *` is a full-width label/input row and `Alert Frequency` appears underneath | default shows only `Send email notifications`; when selected, `Email addresses *` is a full-width label/input row and `Alert Frequency` appears underneath | UI/source tests |
| Bell alert click / triage entry | top-bar bell opens `/notifications`; active alert cards do not use read-state styling; selected row routes use canonical `selected` with legacy `highlight` compatibility | top-bar bell opens `/notifications`; active alert cards do not use read-state styling; selected row routes use canonical `selected` with legacy `highlight` compatibility | UX source tests and legacy compatibility tests |
| Notifications row primary action | `View KPI` preserves metadata action URL and opens the correct KPI tab/card highlight | `View Benchmark` preserves metadata action URL and opens the correct Benchmark tab/card highlight | UI/source tests |
| Query-only platform action URL | existing GA4 page reacts to `tab`/`highlight` search changes and keeps the target card highlighted while `highlight` is present | existing GA4 page reacts to `tab`/`highlight` search changes and keeps the target card highlighted while `highlight` is present | UI/source tests |

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
- Commit `75c38529` aligned the earlier GA4 KPI/Benchmark alert form layout, superseded by the current `60aa0d41` and `82f0695a` email-control visibility contract
- Commit `60aa0d41` makes GA4 KPI/Benchmark email address controls use a full-width label/input row and places `Alert Frequency` underneath the email address row
- Commit `82f0695a` hides both `Email addresses *` and `Alert Frequency` until `Send email notifications` is selected
- Commit `bbf12340` makes GA4 create-submit required-field gating regression-covered: `Create KPI` is gated by `KPI Name` plus `Target Value`, and `Create Benchmark` is gated by `Benchmark Name` plus `Benchmark Value`
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

## Alert Email Scheduler Production-Readiness Plan

Status: locally implemented through EMAIL-7; provider delivery confirmation remains environment-specific external evidence.

Scope:

- KPI and Benchmark alert emails for GA4 and campaign-level alert rows
- reminder emails controlled by `Alert Frequency`
- immediate email attempts after successful breached create/update
- email audit, idempotency, retry, and deployed delivery evidence

Out of scope for this plan:

- in-app alert evaluation math
- Notification page visibility rules
- bell red-dot behavior
- KPI/Benchmark current-value calculations
- action URL routing and card highlighting
- report email scheduling

### 2026-06-25 Email Scheduler Root Cause Analysis

At the 2026-06-25 audit, the alert email scheduler was not production-ready for executive-critical delivery because the implementation proved email attempt wiring, not end-to-end reliable delivery. Later EMAIL-7 evidence made the scheduler locally code-ready; provider delivery events or inbox receipt remain external evidence before claiming a real email was delivered.

Confirmed causes:

- `EmailService.sendEmail()` returns `true` when Mailgun HTTP API or SMTP accepts the message, but alert emails do not confirm provider delivery or inbox receipt before treating the send as successful.
- report test-send has Mailgun delivery polling through `waitForMailgunDelivery`, but alert emails do not use an equivalent provider delivery confirmation path.
- `alertMonitoringService` maps `Immediate` to a one-hour throttle, `Daily` to 24 hours, and `Weekly` to 7 days, but the background email reminder check is currently called by the daily KPI scheduler path; this cannot reliably honor an hourly immediate-reminder cadence.
- GA4 daily refresh and external auto-refresh paths run in-app KPI/Benchmark alert reconciliation, but they do not run the alert email reminder check after source-driven current values change.
- immediate email hooks after create/update are fire-and-forget imports; the route can return after saving the KPI/Benchmark before the email attempt succeeds, fails, or writes a durable audit result.
- dedupe depends on `lastAlertSent`, which is updated after a send attempt succeeds; overlapping scheduler runs or multiple server instances can pass the throttle check before either one updates the row.
- `email_alert_events` records audit rows, but it does not currently provide an atomic send claim, frequency-window dedupe key, delivery status lifecycle, retry schedule, or dead-letter state for alert emails.
- there is no bounded retry/backoff plan for provider failures, delivery failures, or transient network errors.
- deployed provider delivery, provider delivery events, and actual inbox receipt remain unverified for alert emails.

### Email Scheduler Implementation Rules

Every commit in this plan must preserve:

- existing alert threshold math
- current-value resolution parity between in-app and email checks
- one active in-app notification per unresolved GA4/campaign KPI or Benchmark breach
- Notification visibility rules
- KPI/Benchmark create, update, delete, and recompute behavior
- existing ownership and campaign-scope checks
- existing report email scheduler behavior unless a shared delivery helper is extracted without changing report semantics

Do not report a delivered email unless provider delivery events or inbox receipt prove delivery. Provider/API acceptance may be reported only as `accepted`.

### Commit EMAIL-0: Authoritative Alert Email Scheduler Plan

Status: documentation-only plan.

Fix scope:

- record this RCA and implementation strategy
- explicitly state that alert email scheduler delivery is not production-ready for executive-critical alerts yet
- define commit boundaries, acceptance criteria, and validation evidence

Validation:

- documentation-only diff review
- `git diff --check -- GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

### Commit EMAIL-1: Delivery Audit State And Dedupe Contract

Status: complete in commit `a508b4fc`.

Fix scope:

- extend the existing alert email audit path instead of adding a parallel email system
- add the smallest schema/migration support needed for alert email lifecycle state, such as:
  - deterministic `dedupeKey`
  - `deliveryStatus`
  - `providerResponseId`
  - `attemptCount`
  - `lastAttemptAt`
  - `nextAttemptAt`
  - `deliveredAt`
  - `failedAt`
- add a unique constraint or unique index on the alert email dedupe key
- define delivery states at minimum as `pending`, `sending`, `accepted`, `pending_delivery`, `delivered`, `failed`, `retry_scheduled`, and `skipped`
- keep existing `email_alert_events.success` backward compatible for current consumers, but do not use it as proof of delivery

Required tests:

- schema/migration guard proves the dedupe key and delivery status fields exist
- helper tests prove delivery status values are normalized
- helper tests prove existing audit inserts remain backward compatible

Validation:

- focused alert email tests
- migration/schema regression test
- `npm run check`

### Commit EMAIL-2: Atomic Send Claim And Frequency-Window Idempotency

Status: complete in commit `0ee82ec7`.

Fix scope:

- add a small internal helper that atomically claims an alert email send window before calling the provider
- compute deterministic dedupe keys from item type, item id, alert frequency, and due window
- use the database unique key to skip duplicate attempts from overlapping scheduler runs or multiple server instances
- keep `lastAlertSent` as a compatibility mirror after an accepted or delivered send, not as the primary dedupe mechanism
- keep skipped duplicate attempts observable as `skipped` audit rows or structured logs without sending email

Required tests:

- duplicate KPI send claims for the same frequency window produce one sendable claim and one skipped duplicate
- duplicate Benchmark send claims for the same frequency window produce one sendable claim and one skipped duplicate
- a new due window can be claimed after the previous window expires
- `lastAlertSent` no longer acts as the only duplicate-send guard

Validation:

- focused unit tests for the claim helper
- alert email regression tests
- `npm run check`

### Commit EMAIL-3: Cadence-Aligned Alert Email Reminder Scheduler

Status: complete in commit `11450ddf`.

Fix scope:

- add or extend a scheduler so alert email reminder checks run often enough to honor all saved frequencies
- default to a small interval such as 15 minutes, while dedupe still enforces:
  - immediate: at most once per hour while still breaching
  - daily: at most once per day while still breaching
  - weekly: at most once per week while still breaching
- start the scheduler from the existing server startup scheduler block
- add an in-process overlap guard so one long run does not overlap the next run in the same process
- keep production `/api/alerts/check` disabled unless a separate protected/admin trigger is explicitly implemented later
- run the email reminder check after source-refresh paths that update current values, or make the dedicated reminder scheduler frequent enough that source refresh does not need to send synchronously

Required tests:

- server startup imports and starts the alert email scheduler
- scheduler interval is configurable and has a safe default
- scheduler uses an overlap guard
- immediate frequency is not limited to the daily KPI scheduler cadence
- GA4/source refresh paths do not become responsible for synchronous email delivery unless explicitly designed

Validation:

- focused scheduler source tests
- alert email regression tests
- `npm run check`

### Commit EMAIL-4: Durable Immediate Email Attempts After Create And Update

Status: complete in commit `986048b7`.

Fix scope:

- replace fire-and-forget immediate email hooks with a durable, observable path
- after a KPI/Benchmark save/update succeeds and the row is still breaching, create or claim the alert email attempt before the route returns
- do not fail the KPI/Benchmark save solely because email delivery fails, but persist the email attempt state so failure is visible and retryable
- preserve existing API response shape unless a response extension is explicitly proven backward compatible
- keep immediate send eligibility tied to email notifications, recipients, alert threshold, resolved current value, campaign existence, and breach state

Required tests:

- GA4 KPI create/update records an immediate email attempt when email alerts are enabled and breached
- GA4 Benchmark create/update records an immediate email attempt when email alerts are enabled and breached
- invalid values, missing campaign, no recipients, disabled email notifications, or non-breach create no sendable attempt
- route source no longer uses fire-and-forget `.then(...)` for the critical immediate alert email path

Validation:

- route/source regression tests
- alert email regression tests
- `npm run check`

### Commit EMAIL-5: Provider Delivery Confirmation Semantics

Status: complete in commit `23a5e799`.

Fix scope:

- reuse or extract the existing Mailgun delivery polling logic used by report test-send without changing report scheduler behavior
- for Mailgun HTTP API alert emails, update delivery status from accepted to delivered, failed, or pending_delivery based on provider events
- for SMTP or providers without delivery events, record `accepted` only and do not claim delivery
- add a production-readiness rule that executive-critical alert email delivery requires a provider path with delivery events or deployed inbox evidence
- store provider response IDs in first-class audit state so delivery events can be correlated

Required tests:

- Mailgun API acceptance records `accepted` or `pending_delivery`, not `delivered`
- confirmed Mailgun delivery updates status to `delivered`
- Mailgun failure updates status to `failed`
- SMTP success remains `accepted`, not `delivered`
- alert email user-facing/status copy does not say delivered without delivery evidence

Validation:

- focused provider-status tests with mocked provider responses
- alert email regression tests
- `npm run check`

### Commit EMAIL-6: Retry, Backoff, And Resolved-Breach Suppression

Status: complete in commit `a65c0b90`.

Fix scope:

- add bounded retry/backoff for provider send failures and confirmed delivery failures
- retry only while the linked KPI/Benchmark still exists, belongs to the same campaign, email notifications remain enabled, recipients still exist, and the resolved current value still breaches the threshold
- do not retry after a KPI/Benchmark breach clears, alerts are disabled, threshold is removed, item is deleted, campaign is deleted, or client is deleted
- cap retry attempts and mark the audit row as failed/dead-lettered when retries are exhausted
- keep retry attempts within the same dedupe window so retries do not become duplicate executive emails

Required tests:

- failed send schedules retry with `nextAttemptAt`
- retry skips when the KPI no longer breaches
- retry skips when the Benchmark no longer breaches
- retry skips when email notifications are disabled or recipients are removed
- exhausted retries produce a final failed status without sending duplicates

Validation:

- focused retry tests
- notification visibility regression tests for resolved/deleted rows
- `npm run check`

### Commit EMAIL-7: Deployed Evidence And Documentation Closure

Status: complete for local evidence and documentation closure on 2026-06-25; deployed provider/inbox evidence remains pending and is not locally verifiable.

Fix scope:

- run final focused local regression suite
- run TypeScript and production build checks
- update this document with exact evidence by category
- record deployed validation evidence for at least one GA4 KPI alert and one GA4 Benchmark alert
- record provider acceptance separately from confirmed delivery and inbox receipt
- document any provider that remains acceptance-only as not delivery-confirmed

Root cause fixed:

- After EMAIL-1 through EMAIL-6, alert email code paths had local regression coverage for audit state, idempotency, scheduler cadence, durable immediate attempts, provider delivery semantics, and retry suppression, but the readiness tracker still left EMAIL-7 as planned.
- Without a final evidence closure section, local code readiness could be confused with deployed email delivery readiness.
- Provider/API acceptance is locally testable; confirmed delivery and inbox receipt are not proven by local code and must remain separate deployed evidence.

Smallest safe fix:

- change no runtime alert, KPI, Benchmark, notification, API, scheduler, or report email behavior
- rerun the focused EMAIL-1 through EMAIL-6 regression suite plus the required alert evaluation/current-value/visibility checks
- rerun TypeScript and production build checks
- record local evidence and deployed-evidence gaps in this tracker without claiming provider or inbox delivery

Files changed:

- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`

Regression test note:

- no new regression test file was added in EMAIL-7 because there is no runtime behavior change
- the focused regression tests added or updated by EMAIL-1 through EMAIL-6 were rerun as the EMAIL-7 evidence gate

Required local validation:

- `npm test -- server/alert-email-regression.test.ts server/alert-evaluation.test.ts server/campaign-alert-current-value-regression.test.ts server/notification-visibility-regression.test.ts`
- new alert email scheduler/idempotency/delivery/retry focused tests added by EMAIL-1 through EMAIL-6
- `npm run check`
- `npm run build`
- `git diff --check`

Local validation completed on 2026-06-25:

- `npm test -- server/alert-email-regression.test.ts server/alert-evaluation.test.ts server/campaign-alert-current-value-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-retry-regression.test.ts` passed: 10 files, 74 tests
- `npm run check` passed
- `npm run build` passed after rerunning with sandbox escalation for the Vite/esbuild child process; the initial unprivileged build failed before build execution with `spawn EPERM`
- `git diff --check -- GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` passed for the EMAIL-7 documentation file
- `git diff --check` passed for the current worktree, with line-ending normalization warnings only

Required deployed validation:

- create or update a breached GA4 KPI with email notifications enabled and a safe recipient
- confirm one immediate email attempt is recorded
- confirm provider acceptance is recorded
- confirm delivery status is recorded as delivered only when provider events or inbox receipt prove delivery
- confirm no duplicate email is sent when the scheduler runs twice in the same frequency window
- confirm a still-breached immediate-frequency alert can send again only after the hourly window is due
- confirm a cleared breach suppresses future retry/reminder sends
- repeat the same evidence path for a GA4 Benchmark

Deployed validation evidence:

- not locally verifiable in this workspace
- no provider delivery event evidence was recorded by this local run
- no inbox receipt evidence was recorded by this local run
- do not claim real alert email delivery until provider delivery events or inbox receipt are recorded in the target environment

Production-ready conclusion after EMAIL-7:

- alert email attempt wiring is locally code-ready by the focused tests above
- alert email scheduling is locally code-ready by the cadence, idempotency, and retry tests above
- alert email delivery is not delivery-confirmed by this local run
- alert email delivery is production-ready only for the provider and environment where provider delivery events or inbox receipt have been recorded

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
- show only `Send email notifications` before email notifications are selected
- when email notifications are selected, render `Email addresses *` as a full-width label/input row and place `Alert Frequency` underneath it
- hide both `Email addresses *` and `Alert Frequency` unless email notifications are selected
- keep `Create KPI` disabled until `KPI Name` and `Target Value` are non-empty
- keep `Create Benchmark` disabled until `Benchmark Name` and `Benchmark Value` are non-empty
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
- historical alert read state, dismiss state, analytical resolution, and KPI/Benchmark editing are separate concepts, but the current Notifications page should not expose read-state controls for active KPI/Benchmark triage
- the full Notifications page has filters and pagination, but not a persistent selected-alert detail surface that keeps alert context visible

Recommended product model:

- Bell = quick alert entry point and active KPI/Benchmark breach signal
- Notifications page = alert triage center
- KPI/Benchmark page = metric action context

Recommended user journey:

`Bell -> Notifications full-width active-alert list -> View KPI/Benchmark`

The bell should open the Notifications center directly. The Notifications page should show active KPI/Benchmark alert cards with the KPI/Benchmark action on each alert row, without read-state styling or a persistent side panel. The KPI/Benchmark page should remain where the user reviews or edits the underlying metric target, threshold, or benchmark.

### Target UX Contract

The improved flow should behave as follows:

- `/notifications?selected=:notificationId` is the canonical triage selection route for the planned UX
- `/notifications?highlight=:notificationId` remains a legacy compatibility route during the transition and must not be removed until UX compatibility is regression-covered
- KPI/Benchmark metadata action URLs keep using `highlight` for platform card highlighting, for example `/campaigns/:id/ga4-metrics?tab=kpis&highlight=:kpiId`
- clicking the top-bar bell opens `/notifications` directly instead of opening a dropdown
- the top-bar bell indicator is a red dot without numbers, derived from active KPI/Benchmark breach notifications rather than unread count
- the red dot remains while any KPI/Benchmark remains in breach
- active alert rows do not use read-state styling, unread subtitles, or `Mark All as Read`
- clicking a Notifications row selects and highlights it through `/notifications?selected=:notificationId` for legacy selected-link compatibility
- the Notifications page shows a full-width alert list without a persistent selected-detail side panel
- each alert row keeps the primary `View KPI` or `View Benchmark` action
- the Notifications page does not expose secondary read/unread or card-level dismiss controls
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
- keep unread count and popover refresh behavior for UX-5 only; later post-UX-9 dot-only/read-state-removal fixes supersede this UI behavior
- make the dropdown copy/action clear that the user is opening alert details
- avoid duplicating full triage controls inside the bell dropdown
- keep the dismiss icon behavior separate from row click behavior

Required tests:

- performance-alert bell row routes to `/notifications?selected=:notificationId`
- dismiss icon does not trigger row navigation
- unread count still derives from `/api/notifications` for UX-5 only; later post-UX-9 dot-only/read-state-removal fixes supersede this UI behavior

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

- keep the existing unread count query and badge in the top navigation for this commit only; later dot-only and read-state-removal commits supersede this behavior
- remove only the top-bar bell dropdown surface and its dropdown-only mutations
- make the bell button navigate directly to `/notifications`
- keep unread highlighting on the Notifications page list for this commit only; later commit `d0953295` removes read-state styling from active alert cards
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
- keep the same unread notification query and badge for this commit only; later dot-only and read-state-removal commits supersede this behavior
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

Status: implemented and pushed in commit `d014b80b`.

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

### Post-UX-9 Dot-Only Active Breach Bell Indicator

Status: implemented and pushed in commit `fdfca113`.

Root cause:

- the top-bar bell indicator was tied to unread notification count, so a KPI/Benchmark alert could lose the badge after being marked read even when the KPI/Benchmark remained in breach
- the badge rendered a number, which made the bell look like an unread-message counter instead of an active breach signal
- the first dot-only render positioned the dot against the full bell button instead of the bell icon, making it appear too high and too large
- the active Notifications-page bell icon still used the prior green state, but the simplified process now keeps the bell in its original color while disabling it on the current page
- the header already receives the active visible notifications from `/api/notifications`, so the UI can derive a boolean active KPI/Benchmark breach indicator without changing alert evaluation or notification visibility rules

Smallest safe fix:

- keep the existing top-bar bell route to `/notifications`
- derive `hasActiveKpiBenchmarkBreach` from visible `performance-alert` notifications whose metadata identifies a KPI or Benchmark
- render a smaller red dot with no number at the bottom corner of the bell icon when `hasActiveKpiBenchmarkBreach` is true
- keep the Notifications-page bell disabled but in its original icon color
- keep the dot independent from read/unread state so it remains while any KPI/Benchmark breach remains active
- keep the Notifications page unread row highlighting and read/unread controls unchanged

Not changed:

- alert evaluation math
- notification visibility rules
- KPI/Benchmark calculations
- email delivery behavior
- API ownership/scoping rules
- KPI/Benchmark metadata action URLs
- Notifications page row actions and dismiss behavior

Validation completed:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 27 tests
- `npm test -- server/notification-visibility-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 38 tests
- `npm run check` passed
- `npm run build` passed after rerun outside the sandbox; the first sandboxed attempt failed at Vite config loading with `spawn EPERM`

Not locally verifiable:

- real browser confirmation that the bell shows a smaller red dot at the bell icon's bottom corner with no number while a KPI/Benchmark remains breached, including after the alert is marked read
- real browser confirmation that the disabled Notifications-page bell keeps its original icon color

### Post-UX-9 Notification Card And Target Navigation Fixes

Status: implemented and pushed in commits `f94f648b`, `8dbf8303`, `a41fd2d9`, and `e3e7771a`.

Root cause:

- Notification cards rendered `notification.createdAt` as text such as `Today at 2:52 AM`; that timestamp meant notification-row creation time, but the card did not label it, so it looked like business/alert timing context.
- The full Notification card wrapper still had button semantics, keyboard handlers, hover shadow, and pointer styling, so the entire KPI/Benchmark alert card behaved like a clickable target even though the row already had explicit actions.
- The `/api/notifications` route enriched active performance-alert titles/details from linked KPI/Benchmark rows, but did not rebuild `metadata.actionUrl` from the current linked row; stale stored metadata could therefore send `View KPI` / `View Benchmark` to the wrong surface.
- Campaign-level KPI action URL fallback sent non-GA4 KPI alerts to LinkedIn analytics, where campaign KPIs are not rendered.
- Campaign-level action URLs did not include the target KPI/Benchmark id, campaign KPI/Benchmark cards did not consume `highlight`, and GA4 card highlighting was cleared after a timer while using instant scroll.

Smallest safe fix:

- remove only the visible timestamp block from Notification cards while preserving date filtering and `createdAt` data usage
- remove only card-level click/keyboard/button affordance from Notification cards while preserving `View KPI` / `View Benchmark`, mark read/unread, and dismiss actions
- rebuild response metadata `actionUrl` in `/api/notifications` from the current linked KPI/Benchmark row, while preserving existing ownership, active-breach visibility, and fail-closed hiding for missing/deleted/non-breached rows
- route campaign-level KPI/Benchmark alerts to `/campaigns/:id?tab=kpis|benchmarks&highlight=:itemId#kpis|#benchmarks`
- preserve URL hash in the Notifications page action handler
- add URL-driven highlight and smooth scroll for campaign KPI/Benchmark cards
- keep GA4 KPI/Benchmark target highlights visible while `highlight` remains in the URL and scroll smoothly to the target card

Files changed:

- `client/src/pages/notifications.tsx`
- `client/src/pages/campaign-detail.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `server/routes-oauth.ts`
- `server/notification-visibility-regression.test.ts`
- `server/ga4-ui-regression.test.ts`

Validation evidence:

- commit `f94f648b`: `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- commit `8dbf8303`: `npm test -- server/notification-visibility-regression.test.ts` passed; `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- commit `a41fd2d9`: `npm test -- server/notification-visibility-regression.test.ts` passed; `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- commit `e3e7771a`: `npm test -- server/notification-visibility-regression.test.ts server/ga4-ui-regression.test.ts` passed; `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- each commit staged only the related runtime/test files and preserved unrelated dirty files

Proven locally:

- Notification cards no longer render the ambiguous created-at timestamp
- full Notification cards are not row-level clickable controls
- `View KPI` / `View Benchmark` remains the explicit navigation action
- active performance-alert response metadata is rebuilt from the current linked KPI/Benchmark row, so still-breached edits are reflected in the Notifications page response
- deleted or missing linked KPI/Benchmark rows remain hidden from active Notifications through the existing fail-closed visibility path
- campaign-level KPI/Benchmark alert links include the tab and target item id
- GA4 and campaign-level target cards use the `highlight` query to apply visible card highlighting
- target scrolling uses smooth behavior

Not locally verifiable:

- browser-rendered confirmation that every supported viewport feels smooth during the click-through transition
- deployed/manual confirmation that the specific production rows in a user's environment have current metadata after API enrichment

### Post-UX-9 Notifications Filter And Card Action Simplification

Status: implemented and pushed in commit `70bf59ea`.

Root cause:

- The Notifications Filters section still exposed `Read state` even though the simplified active-alert UX no longer needs users to filter KPI/Benchmark breaches by notification read/unread state.
- Notification cards still rendered the envelope read/unread toggle and `X Dismiss` controls next to `View KPI` / `View Benchmark`, adding card actions that no longer match the simplified alert triage flow.
- Those controls were visible UI affordances on the Notifications page; the underlying alert lifecycle, notification visibility API, and KPI/Benchmark breach evaluation did not require runtime changes.

Smallest safe fix:

- remove only the visible `Read state` filter control from the Notifications Filters section
- keep the internal default read filter at `all` so active alert visibility remains unchanged
- remove only the per-card envelope read/unread button and `X Dismiss` button from Notification cards
- keep `View KPI` / `View Benchmark` as the explicit card action
- preserve the existing notification API mutations, alert lifecycle, visibility rules, KPI/Benchmark calculations, email behavior, and ownership/scoping rules

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 28 tests
- `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- `git diff --check -- client/src/pages/notifications.tsx server/notification-visibility-regression.test.ts` passed
- commit `70bf59ea` staged only the related Notifications runtime/test files and preserved unrelated dirty files

Proven locally:

- the visible `Read state` filter is absent from the Notifications Filters section
- the filter grid is now the three remaining filters: Priority, Client, and Date
- Notification cards no longer render the envelope read/unread control
- Notification cards no longer render the `X Dismiss` control
- `View KPI` / `View Benchmark` remains the explicit KPI/Benchmark navigation action

Partially reviewed:

- the visible Notifications page UI path and focused regression guard were reviewed
- the underlying read/dismiss mutations were left in place to avoid side effects because this commit removed only card-level UI controls

Not locally verifiable:

- browser-rendered confirmation that the Filters section and card action spacing look correct across every supported viewport

### Post-UX-9 Notification Detail Values And Header Cleanup

Status: implemented and pushed in commit `d5c44d2e`.

Root cause:

- The `/api/notifications` active-alert response already enriches KPI/Benchmark alert metadata with `currentValue`, `thresholdValue`, and `alertCondition`, and every notification row already includes `createdAt`.
- The Notifications card UI rendered only title, client, campaign, and priority, so users could not see the active alert's current value, threshold value, or notification created date without opening the KPI/Benchmark page.
- The Notifications header rendered `All notifications are read` whenever `unreadCount` was zero, creating low-value page copy after the Notifications UX was simplified around active KPI/Benchmark breaches.

Smallest safe fix:

- render `Current value`, `Threshold value`, and `Created date` on KPI/Benchmark Notification cards using the existing notification metadata and `notification.createdAt`
- keep missing values explicit with a fallback dash instead of inventing data
- preserve `View KPI` / `View Benchmark` as the only card navigation action
- remove only the zero-unread header fallback text while keeping the unread-count subtitle when `unreadCount > 0`
- preserve the existing notification API, alert lifecycle, visibility rules, KPI/Benchmark calculations, email behavior, and ownership/scoping rules

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 30 tests
- `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- `npm run check` passed
- `git diff --check -- client/src/pages/notifications.tsx server/notification-visibility-regression.test.ts` passed
- commit `d5c44d2e` staged only the related Notifications runtime/test files and preserved unrelated dirty files

Proven locally:

- KPI/Benchmark Notification cards render `Current value`, `Threshold value`, and `Created date`
- values are read from existing active notification metadata and notification row creation time
- the zero-unread `All notifications are read` header message is absent
- the unread-count subtitle still renders when unread notifications exist

Partially reviewed:

- the visible Notifications page card/header UI path and focused regression guard were reviewed
- no backend route, storage method, alert math, or notification visibility rule changed in this commit

Not locally verifiable:

- browser-rendered confirmation that the added details fit cleanly on every supported viewport

### Post-UX-9 Client And Campaign Delete Notification Refresh

Status: implemented and pushed in commit `d3c070c7`.

Root cause:

- The backend destructive path already soft-hides campaign-scoped notifications during campaign deletion by updating notification metadata with `dismissedAt` and `dismissalReason: campaign_deleted`.
- Client deletion already reuses the same campaign cascade for each owned campaign before deleting the client.
- The remaining gap was frontend cache freshness: campaign delete invalidated `/api/campaigns` but did not refresh `/api/notifications`, and client delete invalidated `/api/notifications` without the explicit exact refetch pattern used by the alert mutation paths.
- That allowed an already-mounted Notifications query or top-bar bell query to keep stale KPI/Benchmark alert rows until another refresh.

Smallest safe fix:

- after successful client deletion, await invalidation of `/api/clients`, `/api/campaigns`, and `/api/notifications`, then exact-refetch `/api/notifications`
- after successful campaign deletion, await invalidation of `/api/campaigns` and `/api/notifications`, then exact-refetch `/api/notifications`
- keep the existing storage cascade and soft-hide behavior unchanged
- preserve alert evaluation math, notification visibility rules, KPI/Benchmark calculations, email behavior, and API ownership/scoping rules

Files changed:

- `client/src/pages/home.tsx`
- `client/src/pages/campaigns.tsx`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 31 tests
- `npm run check` passed
- `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- `git diff --check -- client/src/pages/home.tsx client/src/pages/campaigns.tsx server/notification-visibility-regression.test.ts` passed
- commit `d3c070c7` staged only the related runtime/test files and preserved unrelated dirty files

Proven locally:

- campaign deletion still uses the existing storage cascade that soft-hides campaign notifications
- client deletion still uses that same campaign cascade for owned client campaigns
- client delete success now exact-refetches `/api/notifications`
- campaign delete success now exact-refetches `/api/notifications`

Partially reviewed:

- the local proof is source-level and regression-test based for the destructive cascade and frontend query refresh paths
- no database was mutated locally for live client/campaign deletion during this documentation update

Not locally verifiable:

- browser confirmation that an already-open Notifications page and top-bar bell update immediately after deleting a client or campaign from another page

### Post-UX-9 Notifications Read-State UI Removal

Status: implemented and pushed in commit `d0953295`.

Root cause:

- The Notifications page still carried legacy inbox/read-state UI even though KPI/Benchmark alert triage now treats active breaches as the important state.
- The page still rendered an unread subtitle such as `1 unread notifications`, a `Mark All as Read` button, unread card styling through a blue left border/subtle blue background, read-state filtering logic, and a mark-read mutation when `View KPI` / `View Benchmark` was clicked.
- Those read-state affordances made active alerts look like message rows and conflicted with the current bell contract, where the red dot represents active KPI/Benchmark breaches rather than unread count.

Smallest safe fix:

- remove the unread subtitle from the Notifications page header
- remove the `Mark All as Read` page control
- remove unread-card blue left border/background styling
- remove local read-state filtering from the Notifications page
- remove the mark-read mutation from `View KPI` / `View Benchmark`
- keep the underlying notification read field/API intact to avoid changing storage contracts or unrelated callers
- preserve active alert visibility, KPI/Benchmark navigation, bell red breach dot behavior, alert lifecycle, KPI/Benchmark calculations, email behavior, and ownership/scoping rules

Files changed:

- `client/src/pages/notifications.tsx`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts` passed: 1 file / 31 tests
- `npm run check` passed
- `npm run build` passed after the expected sandbox escalation for Vite/esbuild
- `git diff --check -- client/src/pages/notifications.tsx server/notification-visibility-regression.test.ts` passed
- commit `d0953295` staged only the related runtime/test files and preserved unrelated dirty files

Proven locally:

- the Notifications page does not render an unread subtitle
- the Notifications page does not render `Mark All as Read`
- active alert cards no longer use read-state blue border/background styling
- the Notifications page no longer filters by read state
- `View KPI` / `View Benchmark` no longer mutates notification read state before navigation

Partially reviewed:

- this was a frontend read-state UI removal with focused source-level regression coverage
- backend read/update routes and storage fields were intentionally left unchanged to avoid side effects for any non-page callers

Not locally verifiable:

- browser confirmation that all supported viewport sizes display the simplified card/header layout as intended

## Target UX Manual Validation Checklist

This checklist validates the implemented triage journey after UX-2 through UX-9 and the direct bell/full-width list/card-target/filter/action/detail/header/delete-refresh/read-state adjustments. The top-bar bell now opens `/notifications` from other pages, shows a small red dot with no number at the bottom corner of the bell icon while any KPI/Benchmark breach is active, keeps its original color and is disabled on the Notifications page, alert cards span the Notifications content width, Notification cards show current value, threshold value, and created date, cards do not show an ambiguous timestamp line, card backgrounds are not clickable, Filters do not expose `Read state`, cards do not expose envelope or `Dismiss` controls, the Notifications page does not expose unread/read-state header text or actions, active alert cards do not use unread blue styling, selected alert rows use `/notifications?selected=:notificationId`, legacy `/notifications?highlight=:notificationId` remains transition-compatible for old links, `View KPI` / `View Benchmark` opens the correct highlighted target card with smooth scrolling, and client/campaign deletion refreshes active Notifications so stale deleted-campaign alerts disappear.

Use a disposable GA4 campaign with known values.

1. Create a GA4 KPI with alerts enabled and a breached threshold.
2. Confirm the bell shows a small red dot with no number at the bottom corner of the bell icon and the Notifications page active view shows one KPI alert.
3. Click the top-bar bell icon and confirm it opens the Notifications page directly without opening a dropdown.
4. Confirm the bell icon keeps its original color and cannot be clicked while you are on the Notifications page.
5. Confirm there is no right-side `Select an alert` panel.
6. Confirm the `Active alerts` heading/current-view count is not shown above the cards.
7. Confirm the header does not show unread/read-state text such as `All notifications are read` or `1 unread notifications`.
8. Confirm alert cards span the Notifications content width.
9. Confirm the Filters section shows Priority, Client, and Date, with no `Read state` filter.
10. Confirm alert cards show `Current value`, `Threshold value`, and `Created date`.
11. Confirm alert cards do not show an ambiguous timestamp line such as `Today at 2:52 AM`.
12. Click the blank/background area of a KPI/Benchmark alert card and confirm it does not navigate or select the card.
13. Confirm the alert card does not show an envelope read/unread icon.
14. Confirm the alert card does not show an `X Dismiss` button.
15. Confirm newly created active alert cards do not show a blue vertical unread line or blue unread background.
16. Confirm the page does not show a `Mark All as Read` action.
17. Click `View KPI` on the row and confirm it preserves the metadata action URL, opens the correct KPI surface, scrolls smoothly, and keeps the exact KPI card highlighted.
18. Update the KPI name, target, threshold, or current value while it remains breached.
19. Confirm the Notifications page reflects the edited KPI alert details after the notification query refreshes.
20. Update the KPI so it no longer breaches.
21. Confirm the alert disappears from active bell and Notifications views.
22. Re-breach the same KPI.
23. Confirm exactly one active alert returns, the bell red dot returns with no number, and the alert is visible in the Notifications list.
24. Delete the KPI and confirm the related active alert disappears from bell and Notifications without affecting unrelated alerts.
25. Repeat the same view, edit/update, clear, re-breach, and delete flow for a GA4 Benchmark using `View Benchmark`.
26. Repeat `View KPI` / `View Benchmark` for campaign-level KPI/Benchmark alerts and confirm the campaign `Campaign KPIs` / `Campaign Benchmarks` tab opens with the exact card highlighted and smooth scrolling.
27. Create or use a disposable campaign with active KPI/Benchmark alerts, then delete that campaign from the Campaigns page.
28. Return to Notifications and confirm alerts for the deleted campaign are gone while unrelated alerts remain.
29. Create or use a disposable client whose campaigns have active KPI/Benchmark alerts, then delete that client from Home.
30. Return to Notifications and confirm alerts for that client's deleted campaigns are gone while unrelated alerts remain.
31. Confirm `Create KPI` is disabled until both `KPI Name` and `Target Value` contain non-empty values.
32. Confirm `Create Benchmark` is disabled until both `Benchmark Name` and `Benchmark Value` contain non-empty values.
33. Confirm the alert form layout: when `Send email notifications` is not selected, `Email addresses *` and `Alert Frequency` are hidden; when selected, `Email addresses *` spans the form width with the label next to the input and `Alert Frequency` appears underneath.
34. Run or trigger the valid reconciliation path.
35. Confirm exactly one new active alert appears.
36. Enable email alerts with a safe recipient in a deployed environment.
37. Follow the `Alert Email Scheduler Production-Readiness Plan` deployed validation steps before claiming executive-critical email delivery is production-ready.

Pass criteria:

- visible in-app state matches the underlying GA4 KPI/Benchmark breach state
- no stale resolved alerts remain visible
- no duplicate active alerts appear for the same GA4 KPI/Benchmark
- top-bar bell indicator is a small red dot at the bottom corner of the bell icon without a number while any KPI/Benchmark breach is active
- top-bar bell clicks open the Notifications page directly without an intermediate dropdown
- top-bar bell keeps its original icon color and is disabled when already on the Notifications page
- the Notifications page does not render the right-side `Select an alert` panel
- the Notifications page does not render the `Active alerts` heading/current-view count above alert cards
- the Notifications page does not render unread/read-state header text such as `All notifications are read` or `1 unread notifications`
- the Notifications page does not render `Mark All as Read`
- alert cards span the Notifications content width
- the Notifications Filters section does not render a `Read state` filter
- KPI/Benchmark alert cards display `Current value`, `Threshold value`, and `Created date`
- alert cards do not show the ambiguous created-at timestamp
- alert card backgrounds are not clickable; users navigate through the explicit `View KPI` / `View Benchmark` action only
- alert cards do not use blue unread-state border/background styling
- alert cards do not render envelope read/unread controls
- alert cards do not render `X Dismiss` controls
- alert row selection remains transition-compatible through canonical `selected` routing
- legacy `highlight` notification URLs remain transition-compatible until their removal is explicitly planned and regression-covered
- Notifications row `View KPI` / `View Benchmark` actions open the correct campaign, tab, and item
- query-only GA4 action URL changes update the visible tab/card highlight and keep the target highlighted while `highlight` remains present
- campaign-level KPI/Benchmark action URLs open the campaign tab and exact highlighted card
- target-card scrolling is smooth rather than instant/jumpy
- edited KPI/Benchmark alert details are reflected in active Notifications after refresh
- deleted KPI/Benchmark active alerts disappear from active Notifications without hard-deleting unrelated alert history
- deleting a campaign removes that campaign's KPI/Benchmark active alerts from Notifications after the notification query refreshes
- deleting a client removes that client's campaign-scoped KPI/Benchmark active alerts from Notifications after the notification query refreshes
- client/campaign delete refresh does not remove unrelated alerts
- `Create KPI` remains disabled until `KPI Name` and `Target Value` are entered
- `Create Benchmark` remains disabled until `Benchmark Name` and `Benchmark Value` are entered
- Alert Frequency remains email-reminder-only and is hidden unless email notifications are selected
- Email addresses and Alert Frequency appear only after `Send email notifications` is selected
- email status is reported only according to the evidence available, and provider acceptance is not described as delivered email
