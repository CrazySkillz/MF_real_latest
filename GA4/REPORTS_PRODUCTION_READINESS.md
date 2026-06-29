# GA4 Reports Production Readiness


## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Reports` tab and the Campaign DeepDive report surfaces that GA4 Reports depends on.

Use this file when asked whether GA4 Reports is robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, or a custom integration.

`GA4/REPORTS.md` defines what the Reports tab is supposed to do.

This file defines whether that implementation is production-ready, what has been proven, what remains not locally verifiable, and how to replicate the Reports pattern for future platforms.

## Durable Future Answer

GA4 Reports is production-ready for the current code implementation as of the 2026-06-27 Reports readiness fix series, with only two deferred validations: `Campaign DeepDive Scheduled Report Visibility` and `Deployed Scheduled Email`:

- `7d98a867` Correct GA4 Scheduled Overview Revenue Label
- `b4839e40` Fix Scheduled Report Delivery Semantics
- `2782dc80` Make Campaign DeepDive Scheduled Report Visibility Backend-Authoritative
- `64eb35c3` Make Scheduler Discovery Explicit And Regression-Covered
- `33426ae0` Resolve GA4 Unscheduled Report Library Product Contract
- `d83b0245` Disable Unchanged GA4 Report Updates

No known GA4 Reports blocker remains from the 2026-06-27 audit queue. For future reference, the Reports section should be treated as production-ready unless relevant code, product requirements, source requirements, production data, or validation evidence changes. The only named exceptions are `Campaign DeepDive Scheduled Report Visibility` and `Deployed Scheduled Email`.

What this means:

- GA4 report CRUD routes are campaign/platform guarded.
- GA4 ad hoc reports are explicitly download-only and do not create Standard Reports library rows.
- GA4 scheduled/test-send/server PDF output uses the correct `REVENUE` Campaign Breakdown label.
- Scheduled report snapshots and `lastSentAt` are no longer created from Mailgun API acceptance alone when delivery confirmation is available.
- Scheduler discovery is explicit through scheduled platform report storage and covers GA4, Campaign DeepDive, and supported source-backed report rows.
- Campaign DeepDive scheduled reports are visible and manageable from backend report rows, not only browser `localStorage` cards.
- GA4 saved report edit mode keeps `Update Report` disabled until a report field changes.

This answer should stay the same in future chats unless one of these changes:

- relevant Reports code changes
- `GA4/REPORTS.md` changes the product contract
- validation evidence in this file changes
- deployed evidence contradicts this document
- source requirements change
- a new platform/source is being assessed instead of the current GA4 implementation

External caveats. Only the first two are deferred Reports validation items; the rest are normal runtime/environment caveats that do not change the Reports production-ready status:

- deferred validation: `Campaign DeepDive Scheduled Report Visibility`, which will be validated when the Campaign DeepDive section is refined
- deferred validation: `Deployed Scheduled Email`, which will be validated after the Mailgun service is properly configured
- live GA4 API processing latency
- real deployed scheduler execution timing
- real provider delivery events and inbox receipt for scheduled report emails
- production database index state and existing production report-row damage
- visual PDF fidelity across every deployed browser/PDF reader

If the question is about deployed Campaign DeepDive scheduled-report UI validation, deployed scheduled-email receipt, production database condition, or live GA4 provider behavior, those require the specific deferred runtime evidence above. If the question is about the current local code contract and the audited GA4 Reports implementation, GA4 Reports should be answered as production-ready.

## How To Use This File In A New Chat

Read in this order:

1. `Durable Future Answer`
2. `Current Scope`
3. `Completed Fix Queue`
4. `Section Production-Readiness Map`
5. `Validation Evidence`
6. `Future Platform Template`

Do not re-answer from `GA4/REPORTS.md` alone. `GA4/REPORTS.md` is the product and behavior specification. This file is the readiness decision.

When applying this to another platform source, do not copy GA4 implementation details blindly. Copy the section contracts and gates, then prove the new platform satisfies each gate with its own source model, scoping model, report-output model, scheduler model, and email-delivery model.

## Current Scope

This audit applies to the current GA4 Reports implementation for:

- GA4 platform Reports tab in `client/src/pages/ga4-metrics.tsx`
- platform report API routes under `/api/platforms/google_analytics/reports`
- shared platform report storage through `linkedin_reports`
- GA4 ad hoc client-side report downloads
- GA4 scheduled/test-send server-side PDF generation
- report snapshots and direct snapshot PDF downloads
- report scheduler behavior for GA4 platform reports
- Campaign DeepDive Custom Report scheduling and scheduled PDF output when launched from a GA4 campaign context

This audit does not automatically certify:

- Meta Reports
- Google Ads Reports
- LinkedIn Reports
- custom-upload Reports
- future copied platform Reports
- provider-side delivery of scheduled emails
- live GA4 API behavior outside what code and local tests can prove
- production database state for existing report rows

## Root Cause Of Prior Confusion

Earlier Reports reviews used "production-ready" too broadly for what had actually been proven.

The main mismatch was scope:

- some earlier work proved that GA4 scheduled PDFs were no longer header-only
- some earlier work proved campaign-scoped report routes and direct snapshot routes were guarded
- some earlier work proved Campaign DeepDive scheduled PDFs render selected section body content
- those narrower proofs did not equal whole Reports production readiness

Whole Reports production readiness also includes:

- report create/update/delete lifecycle
- scheduler selection and idempotency
- scheduled email delivery semantics
- snapshot truthfulness
- visible report-library control
- deployed scheduled-send evidence
- product-contract alignment between `REPORTS.md` and the actual UI

This file fixes that documentation problem by keeping one whole-section source of truth.

## Non-Negotiable Accuracy Rules

GA4 Reports must preserve:

- client scoping
- campaign scoping
- GA4 property scoping
- selected GA4 campaign/source scoping
- revenue and spend source provenance
- KPI and Benchmark behavior
- report update/delete ownership boundaries
- scheduler fail-closed behavior for missing campaigns
- snapshot/report campaign-platform consistency
- plain transactional report email behavior with generated PDF attachment
- distinction between provider/API acceptance and confirmed delivery

Do not change calculations, attribution, source ownership, scheduler behavior, email behavior, or report behavior unless a traced root cause proves a bug in that exact path.

## Data Path Summary

GA4 platform report library path:

`GA4 Reports tab -> /api/platforms/google_analytics/reports -> storage.getPlatformReports("google_analytics", campaignId) -> linkedin_reports`

GA4 ad hoc download path:

`GA4 live page state -> client-side PDF renderer -> immediate browser download`

GA4 scheduled/test-send path:

`saved platform report config -> report scheduler/test-send helper -> GA4 server PDF builder -> email service -> report_send_events/report_snapshots bookkeeping`

Campaign DeepDive Custom Report path:

`/reports?campaignId=<campaignId> -> /outcome-totals + campaign context + KPI/Benchmark context -> local generated-report rows + backend scheduled report rows -> scheduled delivery`

Important meaning:

- Reports are output views of current campaign data, not an independent analytics source.
- Saved report configs store composition and scheduling, not frozen metric values.
- Scheduled snapshots should represent successfully sent report artifacts.
- If provider delivery is not confirmed, the system must not tell users that delivery was confirmed.

## Section Production-Readiness Map

### 1. GA4 Platform Report Library And CRUD

Status: Production-ready locally for campaign-scoped saved GA4 report records.

User-facing role:

- list saved GA4 platform report records for the active campaign
- create scheduled reports
- edit saved report configuration/schedule
- delete saved report records
- download a saved report from latest page state

Inputs:

- `campaignId`
- report name
- report type
- saved JSON configuration
- schedule fields and recipients when scheduling is enabled

Current logic:

- frontend fetches `/api/platforms/google_analytics/reports?campaignId=...`
- create sends `campaignId`
- backend create/list require `campaignId`
- update/delete use `ensurePlatformReportAccess`
- update/delete reject platform mismatches
- GA4 edit mode stores the initial report form signature and disables `Update Report` while the current signature is unchanged
- delete returns success only when a row is actually deleted
- scheduler discovery uses `storage.getScheduledPlatformReports([...SCHEDULED_REPORT_PLATFORM_TYPES])` instead of relying on the legacy `getLinkedInReports()` broad-table behavior

Proven locally:

- campaign ownership guard exists before report list/create/update/delete
- report platform mismatch returns not found
- report campaign/platform ownership cannot be changed through the platform patch route
- saved GA4 platform report edit mode keeps `Update Report` disabled until a report field changes
- delete success is based on the actual storage delete result
- scheduled report discovery is explicit and regression-covered for `google_analytics`, `campaign_deepdive`, and supported source-backed platforms
- scheduler deduplicates report rows by report ID before due checks

Not locally verifiable:

- production database contents
- whether existing production scheduled rows have damaged or missing campaign/platform fields

Future-platform template rule:

- every future platform report route must require campaign access before list/create/update/delete
- update routes must not allow campaign/platform reassignment
- delete routes must return failure if no row was removed
- scheduler discovery should use an explicit scheduled-platform-report path instead of a legacy platform-specific method name

### 2. GA4 Ad Hoc Downloads

Status: Production-ready locally for the chosen download-only GA4 platform product contract.

User-facing role:

- generate and download an executive PDF immediately from current GA4 page state

Inputs:

- current GA4 tab/page state
- selected standard report type or custom sections
- report name

Current logic:

- unscheduled GA4 create flow downloads immediately with `Generate & Download Report`
- unscheduled GA4 platform reports do not save a backend report-library row or Standard Reports card
- saved backend report configurations can also be downloaded again from latest page state

Proven locally:

- code trace confirms unscheduled GA4 reports call `downloadGA4Report(...)` and close the modal without calling the create-report mutation
- `GA4/REPORTS.md` now explicitly documents GA4 platform ad hoc reports as download-only
- ad hoc downloads use refreshed frontend page state once the GA4 tab inputs are current
- client-side Overview Campaign Breakdown label uses `REVENUE`
- client-side Landing Pages and Conversion Events omit revenue
- custom report generation checks that at least one custom section is selected

Not locally verifiable:

- visual PDF fidelity in every browser/PDF renderer without a manual visual pass

Future-platform template rule:

- decide explicitly whether ad hoc reports are download-only or persisted saved reports
- do not document saved Standard Reports behavior unless the UI and backend actually save those reports
- ad hoc report output must preserve the same executive-facing metric meaning as the live tab

### 3. GA4 Scheduled And Test-Send PDF Generation

Status: Production-ready locally for the current GA4 scheduled/test-send/direct-snapshot PDF code scope.

User-facing role:

- generate server-side GA4 report PDFs for scheduled emails, test sends, and direct snapshot PDFs

Inputs:

- saved report config
- report type
- campaign ID
- campaign GA4 connection/property
- campaign GA4 filter
- revenue/spend sources
- KPI/Benchmark rows where relevant

Current logic:

- server-side GA4 PDF builder exists for `Overview`, `KPIs`, `Benchmarks`, `Ad Comparison`, `Insights`, and `Custom`
- generic PDF fallback is refused for GA4
- builder selects the campaign's GA4 connection
- builder applies campaign GA4 filter
- persisted daily rows are read by `campaignId + propertyId`
- revenue/spend/KPI/Benchmark rows are read by campaign
- Overview Campaign Breakdown uses `REVENUE` because the value can include GA4 revenue plus imported campaign-matched revenue

Proven locally:

- GA4 scheduled/test-send PDF path is campaign/property scoped
- missing optional GA4 sections fall back to empty persisted-safe output instead of crashing the whole PDF
- scheduled/test-send emails refuse to send without a valid PDF attachment
- direct snapshot PDF downloads reuse the same shared report PDF builder
- targeted regression proves the server GA4 Overview Campaign Breakdown header no longer uses `GA4 REVENUE`

Partially reviewed:

- Ad Comparison scheduled/server output follows the current production-ready GA4 Ad Comparison contract: campaign-row comparison, not true ad/creative-level reporting. Its only Ad Comparison-specific deferred evidence is deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured, tracked in `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`.
- scheduled Insights output uses the supported server sessions trend rather than a persisted live dropdown choice

Not locally verifiable:

- live GA4 API behavior and token/provider behavior
- manual visual PDF parity in the deployed environment

Future-platform template rule:

- every platform must have a platform-specific scheduled PDF builder before scheduled delivery is considered ready
- generic fallback PDFs are not acceptable for production platform reports
- every executive-facing label must match the actual source set included in the value

### 4. Scheduler, Snapshots, And Email Delivery

Status: Production-ready locally for scheduler discovery, idempotency, snapshot truthfulness, and provider-acceptance semantics in the current code scope.

User-facing role:

- run due scheduled reports
- send report emails
- create immutable snapshots for sent artifacts
- prevent duplicate sends for the same scheduled slot

Inputs:

- saved report record
- schedule frequency/day/time/time zone
- recipients
- campaign existence
- report PDF attachment
- email provider result

Current logic:

- scheduler fetches active scheduled rows through `getScheduledPlatformReports([...SCHEDULED_REPORT_PLATFORM_TYPES])`
- scheduler deduplicates report rows by report ID before due checks
- `report_send_events` is the idempotency/audit layer for `reportId + scheduledKey`
- startup DDL creates a unique index for `report_id + scheduled_key`
- missing campaign disables only the orphaned schedule and marks the send event skipped
- no-recipient schedules are disabled and skipped
- scheduled snapshots are inserted only after `sent === true`
- `lastSentAt` updates only after `sent === true`
- Mailgun API acceptance is followed by delivery-status confirmation before scheduled reports are treated as sent
- pending or failed Mailgun delivery updates send-event/audit state without creating a misleading sent snapshot
- test-send checks Mailgun delivery status when Mailgun API events are available

Proven locally:

- missing campaigns fail closed before GA4 KPI/Benchmark recompute, PDF generation, email send, snapshot insertion, or `lastSentAt`
- no-recipient schedules are disabled and skipped
- direct snapshot JSON/PDF routes verify both report access and snapshot/report campaign-platform consistency
- report emails are plain transactional emails with generated PDF attachment
- Mailgun accepted-but-pending scheduled report delivery does not create a snapshot
- delivered Mailgun scheduled report delivery can create the sent snapshot and update send bookkeeping
- failed/pending delivery uses report send-event state instead of misleading sent snapshot state
- scheduler discovery is explicit and includes GA4, Campaign DeepDive, and supported source-backed reports
- report-focused regression tests pass locally

Partially reviewed:

- startup DDL creates the send-event unique index, but the Drizzle schema does not show the same index, so production DB proof depends on deployed startup/bootstrap having run

Not locally verifiable:

- deployed scheduler execution timing
- deployed scheduled-email validation after the Mailgun service is properly configured
- Mailgun event availability in the deployed account
- real recipient inbox receipt
- production DB index state

Future-platform template rule:

- scheduled snapshots must represent successfully sent artifacts
- provider/API acceptance must be recorded as accepted/pending, not confirmed delivery
- when provider delivery events are available, scheduled diagnostics must distinguish accepted, delivered, failed, and pending delivery
- report email body should stay plain transactional text with generated PDF attachment unless a delivery-safe redesign is explicitly requested

### 5. Campaign DeepDive Custom Reports

Status: Production-ready locally as an aggregate report renderer and backend-authoritative scheduled report management surface for the current code scope.

User-facing role:

- open Reports builder from Campaign DeepDive
- build custom reports from connected-source aggregate values
- download latest-value Custom Report PDFs
- create scheduled Campaign DeepDive Custom Report records
- pause/resume/delete scheduled Custom Reports

Inputs:

- `/reports?campaignId=<campaignId>`
- `/api/campaigns/:campaignId/outcome-totals`
- campaign context
- Executive Summary context when selected
- KPI and Benchmark rows when selected
- Trend Analysis aggregate only when selected
- selected report type, selected tabs, selected metrics
- schedule fields and recipients for scheduled reports

Current logic:

- campaign-scoped Reports pages do not seed global/demo reports
- Campaign DeepDive Custom Report uses `/outcome-totals.performanceSummary`
- selectable metrics are limited to available connected-source aggregate metrics
- paid-media metrics remain hidden until a paid-media source supplies them
- scheduled create/update/delete writes backend platform report records through `/api/platforms/campaign_deepdive/reports`
- backend scheduled Campaign DeepDive report rows are fetched for campaign-scoped Reports pages
- backend scheduled rows are mapped into the existing visible Scheduled Reports card shape
- local generated/downloaded rows remain separate
- pause/resume/delete can operate on backend IDs from fetched rows
- scheduled Campaign DeepDive PDF builder renders selected section body content from latest server-side context

Proven locally:

- scheduled backend records persist schedule time zone, time, recipients, report type, selected tabs, and selected metrics
- scheduled PDF builder has a `campaign_deepdive` path
- regression coverage proves scheduled Campaign DeepDive PDFs render selected tab body content instead of only metadata
- campaign-scoped UI does not seed global/demo reports
- backend scheduled Campaign DeepDive reports render without localStorage records
- pause/resume/delete remain pointed at campaign/platform guarded backend report routes

Not locally verifiable:

- deployed scheduled email receipt
- deployed Campaign DeepDive scheduled-report UI validation; this will be validated when the Campaign DeepDive section is refined
- whether existing production scheduled Campaign DeepDive records were previously orphaned from localStorage cards and need cleanup

Future-platform template rule:

- scheduled report management must be backend-authoritative
- localStorage can cache UI state, but it must not be the only way to see, pause, resume, or delete a backend scheduled report
- future platform Campaign DeepDive reports must consume the shared connected-source aggregate contract instead of platform-specific UI-only logic

### 6. Legacy And Shared Infrastructure

Status: Production-ready locally for the current GA4 Reports paths; broader legacy route reachability remains partially reviewed.

Current logic:

- platform reports currently reuse `linkedin_reports`
- scheduled report discovery now uses the explicit `getScheduledPlatformReports` storage method
- platform report routes use shared platform routes
- direct snapshot routes use shared snapshot infrastructure
- legacy LinkedIn/Meta/Google Ads report routes exist

Proven locally:

- current GA4 platform report routes are guarded
- current direct snapshot routes are guarded
- scheduler deduplicates rows before due processing
- scheduler discovery no longer depends on the misleading `getLinkedInReports()` name as the implicit all-platform scheduled report discovery path

Partially reviewed:

- the shared storage table is still named `linkedin_reports`, which is legacy naming but not a current behavior blocker
- manual snapshot POST preflights source-backed non-GA4 platforms but does not preflight GA4 PDF output before inserting; no current GA4 frontend caller was found for this manual snapshot route
- legacy report routes were not exhaustively reachability-audited in this GA4 Reports pass

Not locally verifiable:

- which legacy routes are still used by deployed clients, scripts, or old UI paths

Future-platform template rule:

- do not remove legacy routes unless caller reachability, scheduler dependency, storage dependency, schema support, and production-data dependency have all been checked and documented
- retained legacy routes that expose or mutate campaign data must stay campaign-access guarded and regression-covered

## Completed Fix Queue

The 2026-06-27 Reports blocker queue has been completed locally. These fixes should not be reopened unless relevant code, docs, or validation evidence changes.

### Commit 1: Correct GA4 Scheduled Overview Revenue Label

Commit: `7d98a867 Fix GA4 scheduled report revenue label`

Resolved root cause:

- `server/ga4-scheduled-report-pdf.ts` labeled Overview Campaign Breakdown as `GA4 REVENUE`
- the value can include GA4 campaign revenue plus imported campaign-matched revenue
- the correct executive-facing label is `REVENUE`

Validation:

- targeted regression in `server/report-email-regression.test.ts`
- `npm test -- server/report-email-regression.test.ts`
- `git diff --check`

### Commit 2: Fix Scheduled Report Delivery Semantics

Commit: `b4839e40 Fix scheduled report delivery confirmation`

Resolved root cause:

- scheduled report send treated provider/API acceptance from `emailService.sendEmail()` as final sent state
- Mailgun API acceptance is not proof of delivery
- snapshots and `lastSentAt` could represent accepted-but-not-delivered email

Validation:

- targeted scheduled Mailgun delivery regression in `server/report-email-regression.test.ts`
- `npm test -- server/report-email-regression.test.ts`
- `npm run check`
- `git diff --check -- server/report-scheduler.ts server/report-email-regression.test.ts`

### Commit 3: Make Campaign DeepDive Scheduled Report Visibility Backend-Authoritative

Commit: `2782dc80 Make Campaign DeepDive scheduled reports backend visible`

Resolved root cause:

- Campaign DeepDive scheduled reports were saved to backend records but visible management cards were dependent on browser `localStorage`
- if localStorage was missing, backend scheduled reports could continue sending while invisible or unmanageable

Validation:

- targeted backend-visibility regression in `server/custom-report-regression.test.ts`
- `npm test -- server/custom-report-regression.test.ts`
- `npm run check`
- `git diff --check -- client/src/pages/reports.tsx server/custom-report-regression.test.ts`

### Commit 4: Make Scheduler Discovery Explicit And Regression-Covered

Commit: `64eb35c3 Make scheduled report discovery explicit`

Resolved root cause:

- scheduler discovery depended on `getLinkedInReports()` returning the whole shared table
- explicit `getPlatformReports(platformType)` calls without campaign ID were not sufficient for campaign-scoped scheduled rows

Validation:

- targeted explicit scheduler-discovery regression in `server/report-email-regression.test.ts`
- `npm test -- server/report-email-regression.test.ts`
- `npm run check`
- `git diff --check -- server/report-scheduler.ts server/storage.ts server/report-email-regression.test.ts`

### Commit 5: Resolve GA4 Unscheduled Report Library Product Contract

Commit: `33426ae0 Document GA4 ad hoc reports as download-only`

Resolved root cause:

- GA4 code downloaded unscheduled reports immediately and did not save backend library rows
- `GA4/REPORTS.md` had conflicting wording that implied unscheduled reports were saved under Standard Reports

Validation:

- code trace confirmed scheduled saves use backend mutation and unscheduled flow downloads immediately
- `GA4/REPORTS.md` now documents GA4 ad hoc reports as download-only
- deployed UI validation confirmed GA4 unscheduled report generation downloads immediately without creating a saved report card
- `git diff --cached --check`

### Additional Fix: Disable Unchanged GA4 Report Updates

Commit: `d83b0245 Disable unchanged GA4 report updates`

Resolved root cause:

- GA4 report edit mode prefilled saved report values but did not retain an initial form signature
- the modal button only checked required fields and pending mutation state, so `Update Report` was enabled before any actual change

Validation:

- `git diff --check -- client/src/pages/ga4-metrics.tsx`
- `npm run check`
- deployed UI validation confirmed GA4 scheduled report create/edit/delete works and `Update Report` is disabled until a report field changes

## Product-Contract Decision Queue

No unresolved GA4 Reports product-contract decision remains from the 2026-06-27 blocker queue.

### Decision 1: GA4 Unscheduled Report Library Behavior

Decision: resolved as download-only for GA4 platform ad hoc reports.

Current contract:

- unscheduled GA4 platform reports use `Generate & Download Report`
- unscheduled GA4 platform reports do not create backend report-library rows or Standard Reports cards
- saved backend report configurations can still be downloaded again from latest page state
- scheduled GA4 reports create saved backend report rows and are managed through the GA4 report list

## Completed / Proven Local Strengths

The following items are locally proven and should not be reopened unless relevant code changes:

1. GA4 platform report list/create/update/delete routes are campaign-access guarded.
2. GA4 platform report update/delete reject platform mismatches.
3. GA4 platform report update cannot change campaign or platform ownership through patch payloads.
4. Report delete status reflects actual row deletion.
5. Direct snapshot JSON/PDF routes verify report access plus snapshot/report campaign-platform consistency, and direct GA4 snapshot PDF regeneration runs suppress-alert GA4 KPI/Benchmark preflight before the shared PDF builder reads KPI rows; deployed validation passed after commit `4d3a3838`.
6. GA4 scheduled/test-send PDFs use a GA4-specific server builder and refuse generic fallback.
7. GA4 scheduled/test-send Overview Campaign Breakdown uses `REVENUE`, not `GA4 REVENUE`.
8. Scheduled report emails require a generated PDF attachment.
9. Scheduled Mailgun snapshots and `lastSentAt` are not created from API acceptance alone when delivery confirmation is available.
10. Scheduler skips missing-campaign reports before recompute/PDF/send/snapshot/lastSentAt and disables only that report schedule.
11. Scheduler explicitly discovers scheduled platform reports through `getScheduledPlatformReports` and includes GA4, Campaign DeepDive, and supported source-backed platforms.
12. Scheduler deduplicates fetched report rows by report ID before due checks.
13. `report_send_events` has runtime startup DDL for a unique `report_id + scheduled_key` index.
14. Campaign DeepDive scheduled PDF body rendering is covered for selected tabs and latest server-side aggregate context.
15. Campaign-scoped Campaign DeepDive Reports pages do not seed global/demo reports.
16. Campaign DeepDive scheduled report management is backend-authoritative for active/paused backend scheduled rows.
17. GA4 platform ad hoc reports are explicitly download-only and are not documented as saved Standard Reports rows.
18. GA4 saved report edit mode disables `Update Report` until a report field changes.

## Deployed UI Validation Evidence

Reported validated after the Render deployment of the 2026-06-27 Reports fix series and the June 29, 2026 direct GA4 snapshot PDF follow-up:

1. GA4 Unscheduled Report: `Generate & Download Report` downloads immediately and does not create a saved report card.
2. GA4 Scheduled Overview Revenue Label: scheduled/saved Overview report output uses `Revenue` for Campaign Breakdown.
3. GA4 Scheduled Report Creation/Edit/Delete: scheduled report cards can be created, edited, and deleted; edit mode keeps `Update Report` disabled until a report field changes.
4. Direct GA4 Snapshot PDF: after commit `4d3a3838` deployed, direct snapshot PDF download validation passed with latest KPI values or fail-closed behavior rather than stale output.

Deferred deployed validation:

5. Campaign DeepDive Scheduled Report Visibility will be validated when the Campaign DeepDive section is refined.
6. Deployed Scheduled Email will be validated after the Mailgun service is properly configured.

## Partially Reviewed / Keep Watching

These areas are not current local blockers, but future work should not assume they are fully certified beyond the stated evidence:

- manual snapshot POST has no current GA4 frontend caller, but source-backed snapshot creation and direct GA4 snapshot PDF regeneration now fail closed before output/insertion when GA4 preflight or source-backed PDF generation is unavailable
- GA4 Ad Comparison report output is production-ready for the current GA4 code scope except for the Mailgun-dependent deployed scheduled/server PDF revenue-provenance evidence tracked in `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`; it still reflects campaign-row comparison, not true ad/creative-level reporting
- scheduled Insights PDF uses the supported server sessions trend rather than persisting the live selected trend metric/mode
- the Drizzle schema does not express the report-send unique index even though startup DDL creates it
- legacy report routes were not exhaustively reachability-audited in this GA4 Reports pass
- existing production Campaign DeepDive scheduled rows may need a separate cleanup audit if they were orphaned from old localStorage-only visibility before Commit 3

## Not Locally Verifiable

The following cannot be proven from local code alone:

- real deployed scheduled email receipt
- deployed scheduled-email validation after the Mailgun service is properly configured
- deployed Campaign DeepDive scheduled-report UI validation after the Campaign DeepDive section is refined
- Mailgun provider event availability in the deployed account
- real inbox delivery
- deployed scheduler timing
- production database index state
- production report row damage or orphaned scheduled records
- live GA4 API processing latency
- token refresh behavior against real accounts
- visual PDF fidelity across every deployed browser/PDF reader

## Validation Evidence

Locally run on 2026-06-27 during the Reports production-readiness fix series:

- `npm test -- server/report-email-regression.test.ts server/custom-report-regression.test.ts`
- `npm run check`
- `git diff --check` for each touched code/test/doc file group
- `git diff --cached --check` for the docs-only GA4 ad hoc report contract commit
- `git diff --check -- client/src/pages/ga4-metrics.tsx` for the unchanged-update fix

Result:

- targeted Reports regression tests passed: 48 tests across `server/report-email-regression.test.ts` and `server/custom-report-regression.test.ts`
- TypeScript passed via `npm run check`
- whitespace/diff checks passed for committed fix scopes
- GA4 report edit-mode TypeScript checks passed after the unchanged-update fix

These checks prove:

- GA4 scheduled Overview Campaign Breakdown uses the correct `REVENUE` label in the server PDF path
- scheduled report Mailgun acceptance is not treated as confirmed delivery before snapshot/`lastSentAt` bookkeeping
- backend scheduled Campaign DeepDive report rows are visible without localStorage records
- scheduler discovery is explicit and regression-covered for GA4, Campaign DeepDive, and supported source-backed report rows
- GA4 ad hoc report behavior is intentionally documented as download-only
- GA4 saved report edit mode disables `Update Report` until a report field changes
- existing report email and Campaign DeepDive custom report regression guards still pass

These checks do not prove:

- real deployed scheduled email receipt
- deployed scheduled-email validation after the Mailgun service is properly configured
- deployed Campaign DeepDive scheduled-report UI validation after the Campaign DeepDive section is refined
- Mailgun provider event availability in the deployed account
- real recipient inbox receipt
- deployed scheduler timing
- production database index state
- production report-row cleanup needs
- live GA4 API processing latency

Deployed UI validation now proves GA4 Unscheduled Report, GA4 Scheduled Overview Revenue Label, and GA4 Scheduled Report Creation/Edit/Delete for the deployed code state. Campaign DeepDive Scheduled Report Visibility remains deferred to Campaign DeepDive refinement, and Deployed Scheduled Email remains deferred until Mailgun is properly configured.

## Future Platform Template

Use this section as the template for refining Meta, Google Ads, LinkedIn, or other platform Reports sections.

A future platform is not production-ready until every gate below is answered with platform-specific evidence.

### Platform Identity Gate

The future platform must define:

- platform name
- source/account/property/customer ID
- selected campaign/ad set/ad group/source scope
- client ownership boundary
- campaign ownership boundary
- API route ownership guard
- storage/read/write boundary

Required answer format:

`This platform's Reports data is scoped by [client], [campaign], [platform source/account/property], and [selected source campaign/ad group/etc]. It does not include unrelated platform data.`

### Report Library Gate

The future platform must define:

- saved report table/storage model
- create route
- list route
- update route
- delete route
- campaign/platform ownership checks
- whether unscheduled ad hoc downloads are saved or download-only
- how scheduled records remain visible and manageable across sessions

Required answer format:

`Report records are stored in [storage]. List/create/update/delete are guarded by [ownership function]. Scheduled report management is backend-authoritative and does not depend only on browser local state.`

### Report Output Parity Gate

The future platform must define:

- live UI renderer
- ad hoc download renderer
- scheduled/test-send PDF renderer
- direct snapshot PDF renderer
- any intentional differences between live and report output
- tests for executive-facing labels and metric meanings

Required answer format:

`Report output preserves the live UI's executive-facing meaning for totals, financials, source provenance, KPI/Benchmark rows, trend/freshness labels, and custom selected sections.`

### Financial Provenance Gate

The future platform must define:

- spend source
- revenue source
- whether revenue is native, imported, or additive
- whether Pipeline Proxy or estimates are excluded
- how profit, ROAS, ROI, CPA, or related values are derived
- visible source provenance copy

Required answer format:

`Spend comes from [source]. Revenue comes from [source set]. Derived metrics use those same values. The report labels those values by their actual source set and does not imply unavailable sources are connected.`

### Scheduler Gate

The future platform must define:

- scheduler discovery path
- due-time/time-zone semantics
- recipient validation
- campaign/source existence checks before send
- platform source-scope checks before send
- idempotency key and unique constraint
- retry behavior
- disabled-orphan behavior

Required answer format:

`Scheduled reports are discovered through [path], deduped by report ID, idempotent by [key], interpreted in [timezone rule], and fail closed before recompute/PDF/send/snapshot when ownership or source scope cannot be verified.`

### Email Delivery Gate

The future platform must define:

- email provider path
- attachment requirement
- provider acceptance state
- confirmed delivery state if provider events exist
- failed/pending state handling
- user-facing wording for test-send and scheduled-send status

Required answer format:

`Provider acceptance is recorded separately from confirmed delivery. Sent/downloadable snapshots are created only after the configured delivery-success rule is satisfied.`

### Snapshot Gate

The future platform must define:

- when snapshots are created
- what snapshot JSON represents
- direct snapshot read guard
- direct snapshot PDF guard
- snapshot/report campaign-platform consistency check

Required answer format:

`Snapshots represent successfully sent artifacts. Direct snapshot JSON/PDF routes verify report access and snapshot/report campaign-platform consistency before returning output.`

### Campaign DeepDive Aggregate Gate

If the platform contributes to Campaign DeepDive reports, it must define:

- source identity in the aggregate contract
- included metrics
- unavailable metrics and reasons
- financial source participation
- freshness metadata
- trend aggregate participation
- report-rendered selected section behavior

Required answer format:

`Campaign DeepDive reports consume this platform through the shared aggregate contract, not platform-specific UI-only logic. Selected report sections render current aggregate-backed values and unavailable metrics stay hidden or explained.`

### Validation Gate

The future platform must provide:

- focused unit/regression tests
- UI path validation
- report output validation
- ownership/access validation
- scheduler validation
- snapshot validation
- email provider validation where applicable
- clear separation of proven, partially reviewed, and not locally verifiable items

Required answer format:

`Proven: [...]. Partially reviewed: [...]. Not locally verifiable: [...]. Current blockers: [...].`

## Future Platform Readiness Checklist

Before calling another platform's Reports section production-ready, confirm:

- source identity and scoping are proven
- report CRUD is campaign/platform guarded
- update/delete cannot cross campaign/platform boundaries
- report delete success reflects actual row deletion
- ad hoc download persistence behavior is explicitly decided
- scheduled records are backend-visible and manageable across sessions
- scheduled PDF builder is platform-specific and not generic fallback
- financial labels match the actual source set included
- KPI/Benchmark behavior is preserved where included
- scheduler discovery is explicit and regression-covered
- scheduler is idempotent by `reportId + scheduledKey` or equivalent
- missing campaign/source scope fails closed before recompute/PDF/send/snapshot
- provider acceptance is not called confirmed delivery
- snapshots represent successfully sent artifacts
- direct snapshot JSON/PDF routes verify report access and snapshot/report campaign-platform consistency
- live UI and report output preserve the same executive-facing meaning
- deployed-only behavior is separated from locally proven behavior

## Stable Response For Future Chats

If no relevant code, docs, data-source requirements, or validation evidence changed, answer:

`GA4 Reports is production-ready for the current code implementation. The canonical reference is GA4/REPORTS_PRODUCTION_READINESS.md. The 2026-06-27 blocker queue was fixed by commits 7d98a867, b4839e40, 2782dc80, 64eb35c3, 33426ae0, and d83b0245. The only deferred Reports validations are Campaign DeepDive Scheduled Report Visibility, which will be validated when the Campaign DeepDive section is refined, and Deployed Scheduled Email, which will be validated after the Mailgun service is properly configured.`

If the user asks whether Reports is production-ready, answer yes with exactly those two deferred validations. If the user asks specifically about deployed scheduled-email receipt, production database state, live GA4 provider behavior, or deployed PDF-reader fidelity, answer that those require deployed/runtime evidence and are not locally provable from this repository alone.
