# GA4 Reports Production Readiness


## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

2026-08-29 revalidation: the authoritative machine record certifies deployed runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e`. Review from the prior `19f05537` boundary proved the only shared scheduler delta is isolated to the Campaign DeepDive Trend PDF branch, which is excluded from GA4 Reports certification. Exact deployed health, protected regressions, the complete non-Playwright current-version boundary, TypeScript, and build passed. Authenticated KPI/Benchmark browser-PDF, provider-delivery, inbox, and scheduled-send evidence remains revision-bounded; no new provider-event or inbox-content claim is made. Older narrative SHA references below are revision-specific history where they differ.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Reports` tab and its GA4 report delivery surfaces. Campaign DeepDive is explicitly outside this certification.

Use this file when asked whether GA4 Reports is robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, or a custom integration.

`GA4/REPORTS.md` defines what the Reports tab is supposed to do.

This file defines whether that implementation is production-ready, what has been proven, what remains not locally verifiable, and how to replicate the Reports pattern for future platforms.

<!-- ga4-reports-current-status -->
<!-- ga4-reports-certification-status: PRODUCTION_READY -->
## Current Controlling Answer

August 29, 2026 final decision: GA4 Reports is **PRODUCTION_READY** for certified GA4 Reports runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e`. Campaign DeepDive remains outside the GA4 Reports certification boundary.

The current Reports consumers resolve one authoritative cumulative initial-import boundary and fail closed when that boundary cannot be proven. The complete current-version boundary exposed one stale legacy Shopify test fixture; adding its exact 30-day/import-start boundary restored all seven focused report-consumer tests without changing runtime code.

Final evidence includes the complete current-version suite, TypeScript, production build, exact `94f1096f` health, deterministic cumulative/fail-closed GA4 report tests, and exact diff review proving the later scheduler change is confined to the excluded Campaign DeepDive Trend branch. Authenticated guarded outcome totals and browser KPI/Benchmark PDF parity remain revision-bounded to `19f05537`. Earlier provider delivery, inbox receipt, truthful snapshot, and schedule-restoration evidence remains revision-bounded historical support.

The production database audit found no active orphan report, tenant mismatch, or invalid active schedule. Historical orphan/mismatched artifacts remain preserved rather than rewritten and are fail-closed by current access/type guards. The unavailable-materialized-revenue negative branch remains proven by deterministic regression coverage rather than production-data mutation.

The final combined GA4 certification is complete for the recorded boundary. Future provider availability, future recipient behavior, Campaign DeepDive, non-GA4 reports, and unbounded historical-data cleanup remain excluded.

<!-- /ga4-reports-current-status -->

### Historical Reports Status And Evidence

Current-code override on July 31, 2026: Commit 18 changes the shared Campaign DeepDive Performance Summary aggregate so failed GA4/imported-revenue reads remain connected but their metrics are unavailable, preventing partial or false-zero revenue/ROAS from reaching browser report consumers. The bounded local implementation and Custom Report/Executive Summary regression paths are proven locally, but the code is not yet committed, deployed, or externally validated. The affected Campaign DeepDive/browser-report aggregate path is therefore **unproven**; the historical Reports certification below does not certify this changed path. Scheduled email/PDF/snapshot behavior was not changed and remains outside Commit 18.

GA4 Reports was historically certified for the 2026-06-27 Reports readiness fix series, with one then-named deferred validation: `Campaign DeepDive Scheduled Report Visibility`. Deployed GA4 Overview Report email delivery had user-confirmed evidence from the 2026-07-03 Overview report packet:

- `7d98a867` Correct GA4 Scheduled Overview Revenue Label
- `b4839e40` Fix Scheduled Report Delivery Semantics
- `2782dc80` Make Campaign DeepDive Scheduled Report Visibility Backend-Authoritative
- `64eb35c3` Make Scheduler Discovery Explicit And Regression-Covered
- `33426ae0` Resolve GA4 Unscheduled Report Library Product Contract
- `d83b0245` Disable Unchanged GA4 Report Updates

The 2026-06-27 audit queue is historical and complete for its defect set. It does not close Reports Current Commits 7-9.

What this means:

- GA4 report CRUD routes are campaign/platform guarded.
- GA4 ad hoc reports are explicitly download-only and do not create Standard Reports library rows.
- GA4 scheduled/test-send/server PDF output uses the correct `REVENUE` Campaign Breakdown label.
- Scheduled report snapshots and `lastSentAt` are no longer created from Mailgun API acceptance alone when delivery confirmation is available.
- Scheduler discovery is explicit through scheduled platform report storage and covers GA4, Campaign DeepDive, and supported source-backed report rows.
- Campaign DeepDive scheduled reports are visible and manageable from backend report rows, not only browser `localStorage` cards.
- GA4 saved report edit mode keeps `Update Report` disabled until a report field changes.

The following were the historical carry-forward conditions for that packet. They are preserved only as history and do not control the current answer:

- relevant Reports code changes
- `GA4/REPORTS.md` changes the product contract
- validation evidence in this file changes
- deployed evidence contradicts this document
- source requirements change
- a new platform/source is being assessed instead of the current GA4 implementation

Historical external caveats recorded for that packet:

- deferred validation: `Campaign DeepDive Scheduled Report Visibility`, which will be validated when the Campaign DeepDive section is refined
- recorded validation: deployed GA4 Overview Report email delivery was user-confirmed on 2026-07-03 for the recorded Overview report packet; future scheduled/test deliveries and report variants require their own runtime evidence if separately questioned
- live GA4 API processing latency
- real deployed scheduler execution timing
- real provider delivery events and inbox receipt for future scheduled report emails outside recorded packets
- production database index state and existing production report-row damage
- visual PDF fidelity across every deployed browser/PDF reader

This historical instruction is superseded by the `Current Controlling Answer` and must not be reused as a current status.

## How To Use This File In A New Chat

Read in this order:

1. `Current Controlling Answer`
2. `Current Scope`
3. `Current dependent queue`, then `Historical Completed Fix Queue`
4. `Section Production-Readiness Map`
5. `Validation Evidence`
6. `Future Platform Template`

Do not re-answer from `GA4/REPORTS.md` alone. `GA4/REPORTS.md` is the product and behavior specification. This file is the readiness decision.

When applying this to another platform source, do not copy GA4 implementation details blindly. Copy the section contracts and gates, then prove the new platform satisfies each gate with its own source model, scoping model, report-output model, scheduler model, and email-delivery model.

## Current Scope

Included:

- GA4 platform Reports tab in `client/src/pages/ga4-metrics.tsx`
- platform report API routes under `/api/platforms/google_analytics/reports`
- GA4 report storage rows in `linkedin_reports`
- GA4 ad hoc client-side Overview, KPI, Benchmark, Ad Comparison, Insights, and Custom PDF downloads
- GA4 scheduled/test-send server-side PDF generation
- GA4 report snapshots and direct snapshot JSON/PDF downloads
- scheduler selection, idempotency, delivery, and bookkeeping for `google_analytics` reports

Excluded:

- Campaign DeepDive Custom Reports, report lists, scheduling, aggregate inputs, and PDFs
- Meta, Google Ads, LinkedIn, custom-upload, and future copied platform Reports
- guarantees about future provider availability or future recipient inbox behavior
- production-data cleanup outside a separately authorized exact damaged-row boundary

Campaign DeepDive references in historical sections below are retained only as history or future-platform context. They do not gate, support, or expand the current GA4 Reports certification.
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

## Current Local Value And State Inventory

This inventory is complete for the current Reports surfaces, but completion of the inventory does not mean every row is proven.

| Surface/value family | Source and transformation | Empty/error/failure meaning | Current evidence status |
| --- | --- | --- | --- |
| GA4 saved-report cards: name, description, type, schedule, last sent, created date, actions | Campaign/platform-scoped rows from linkedin_reports through the shared platform report API | A successful empty list renders the empty state; a failed request renders Reports unavailable | Proven by code/regression coverage, deployed UI, authenticated inventory, and the restored three-report baseline |
| Campaign DeepDive scheduled-report list and ad hoc download path | Backend `campaign_deepdive` scheduled rows render directly; unscheduled creation generates an in-memory PDF without a browser or backend library row | Failed backend list stays distinct from a legitimate empty result; an ad hoc download does not create a card | Excluded from the GA4 Reports certification boundary |
| Report composition | Saved report type, selected sections, selected KPI IDs, selected Benchmark IDs, and Campaign DeepDive selected metrics | Empty Custom KPI/Benchmark selection stays empty and cannot expand to every row | Proven through the actual scheduled GA4 PDF path and focused negative regression |
| Schedule metadata | Frequency, recurrence day, local time, IANA timezone, recipients, paused/active state | Unsupported frequency/timezone/time/day/quarter values fail before persistence | Proven by create/update guards, direct validator cases, deployed CRUD, and natural scheduler execution |
| Browser GA4 Overview PDF values | Current page-consumed Overview totals, financial values, tables, and source rows | A required selected input failure blocks generation instead of printing plausible zeros | Proven on the exact deployed SHA by user-confirmed UI/PDF parity plus fail-closed guards |
| Browser GA4 KPI, Benchmark, Ad Comparison, Insights, and Custom PDF values | Current page-consumed rows and selected-section renderers | Unselected sections are omitted; selected unavailable inputs fail or stay explicitly unavailable according to the section contract | Proven on the exact deployed SHA across all five standard types and one selected Custom composition |
| Server GA4 scheduled, test-send, manual-snapshot, and direct-snapshot PDFs | Campaign/property/filter-scoped server payload, exact report preflight, shared GA4 PDF builder | Selected KPI/Benchmark read/recompute failure blocks output; generic GA4 fallback is refused | Proven through actual KPI/Benchmark production paths, direct-snapshot parity, emailed Ad parity, and scheduler execution |
| Campaign DeepDive browser and scheduled PDFs | Campaign context, performanceSummary, optional Executive Summary, KPI rows, Benchmark rows, and Trend Analysis aggregate | Only selected sections are loaded/rendered; unavailable metrics are not invented | Excluded from the GA4 Reports certification boundary |
| Test-send result | Email provider audit plus Mailgun delivery events when available | Non-Mailgun acceptance is reported as accepted/unconfirmed; Mailgun is called delivered only after a delivered event | Proven by regression guards, provider-confirmed delivery, inbox receipt, and attachment parity |
| Scheduled send event, snapshot, and last-sent values | report_send_events keyed by report and scheduled slot; report_snapshots and lastSentAt only after send success | Missing campaign, missing recipients, preflight/PDF failure, pending delivery, and failed delivery do not create a sent snapshot | Proven by code/regression, production integrity audit, and the exact-SHA natural 2026-08-11 send |
| Direct snapshot JSON/PDF | Snapshot row plus owning report access and campaign/platform consistency | Cross-report, cross-campaign, or cross-platform mismatch returns not found | Proven by route/regression guards, owner/non-owner negatives, and direct artifact parity |

## Current Lifecycle And Failure Matrix

| Lifecycle path | Scope/fail-closed rule | Current status |
| --- | --- | --- |
| List | Campaign access precedes campaign/platform-scoped storage read; HTTP failure is not an empty library | Proven locally |
| Create | Campaign access, report type, schedule semantics, and recipients are validated before insert | Proven by route/tests and exact-SHA temporary-report creation |
| Edit/update | Existing report access and platform match are required; campaign/platform ownership fields cannot be reassigned; full schedule semantics are revalidated | Proven by route/tests and exact-SHA temporary-report edit |
| Delete | Existing report access and platform match are required; success reflects an actual deleted row | Proven by route/tests, exact-SHA temporary-report deletion, and restored baseline |
| Ad hoc browser download | Uses current page state and does not create a backend saved row | Proven by code/regression and deployed visual/browser packet |
| Pause/resume | Changes only the owned backend report schedule/status; report remains visible | Proven as the guarded update path; Campaign DeepDive controls are excluded |
| Manual snapshot | Access and platform match precede preflight/PDF proof and insert | Proven by route guards and direct snapshot execution/parity |
| Test send | Valid campaign, recipients, exact report preflight, and PDF are required before provider submission | Proven by exact-SHA provider delivery, inbox receipt, and attachment parity |
| Scheduled send | Explicit discovery, report-ID dedupe, due-time calculation, idempotency event, campaign check, preflight, PDF, provider result, snapshot, and lastSentAt ordering | Proven by regression/integrity evidence and the exact-SHA natural 2026-08-11 run |
| Missing campaign or recipients | Disable only the affected schedule and record skipped state; no recompute/PDF/send/snapshot/lastSentAt | Proven locally |
| KPI/Benchmark missing, skipped, or failed row | Exact selected IDs are returned and every report consumer fails closed | Proven through actual production paths |
| Provider pending/failed | Record pending/failed audit state without a sent snapshot or delivered claim | Proven by guards plus production failed/pending bookkeeping audit |
| Direct snapshot read/PDF | Owning report access plus campaign/platform consistency required | Proven locally |
| Existing damaged/orphaned data | No mutation or cleanup without a read-only production boundary | Proven for the in-scope GA4 production inventory by a read-only rolled-back audit; no cleanup was performed |
| Legacy report routes | Retained guarded paths are not removed without full reachability and production-data evidence | Outside the current GA4 Reports caller boundary; retained routes were not removed |

## Current Downstream Propagation Matrix

| Authoritative producer | Reports consumers | Proven relationship | Remaining boundary |
| --- | --- | --- | --- |
| GA4 Overview traffic and financial inputs | Browser Overview/Custom PDF; server scheduled/test/manual/direct Overview/Custom PDF | Required-input failures are fail-closed and the server financial selector preserves valid zero/negative precedence | Complete exact-SHA browser/server numeric and visual parity |
| GA4 KPI rows and daily recompute | Browser KPI/Custom PDF; scheduled/test/manual/direct KPI/Custom/Insights PDF | Actual production fixture, exact selected IDs, skipped/failed IDs, and no empty-selection expansion are regression-covered | Certified-boundary exact-SHA artifact packet |
| GA4 Benchmark rows and recompute | Browser Benchmark/Custom PDF; scheduled/test/manual/direct Benchmark/Custom/Insights PDF | Actual path blocks missing/failed selected rows and carries fresh conclusions | Certified-boundary exact-SHA artifact packet |
| GA4 Ad Comparison rows and provenance | Browser and server Ad Comparison/Custom PDFs | Local source/provenance and required-input guards pass | Ad Comparison's certified-boundary parity gate |
| Live GA4 Insights inputs | Browser and server Insights/Custom PDFs | Live wording/provenance is guarded separately from report wording; actual scheduled KPI/Benchmark conclusions are covered | Reports-owned exact-SHA numeric/visual artifact validation; live Insights behavior remains outside Reports |
| Campaign DeepDive performanceSummary and optional contexts | Browser latest download and server scheduled Custom Report | Selected-section renderer coverage and conditional context loading pass | Exact connected-source-mix deployed visibility and numeric packet |
| Schedule configuration | Scheduler due calculation, send-event key, recipient list | Strict create/update validation prevents unsupported future schedule rows | Existing legacy production rows and natural deployed execution |
| Provider/audit result | User-facing test-send result, report_send_events, snapshots, lastSentAt | Acceptance remains distinct from delivery; sent artifacts require the configured success rule | Current provider event and inbox receipt |
| Snapshot/report ownership | Snapshot list, JSON download, PDF regeneration | Report access plus campaign/platform consistency is required | External cross-tenant negative packet |

## Protected Overview And Insights Boundary

- No live Overview or live Insights renderer, query, formula, storage path, or scheduler behavior is changed by the Reports documentation and machine-gate work.
- Reports-owned parity tests may mention Insights, but they do not change the certified live Insights runtime.
- server/routes-oauth.ts is a shared certification dependency. The localized Reports schedule-route changes do not alter Overview/Insights behavior, but dependency-hash rules still require the affected certification gates to be rerun before any prior certification is carried forward to a new revision.

## Historical Section Evidence Map

The statuses below preserve historical report mechanics. Current readiness is governed only by the exact-SHA `Current Controlling Answer` and machine record above.

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

- Ad Comparison scheduled/server output follows the current GA4 campaign-row
  contract; exact deployed browser/direct/email parity and natural scheduled-send
  evidence passed for the Reports boundary.
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
- future deployed scheduled/test email deliveries outside recorded packets
- Mailgun event availability in the deployed account
- real recipient inbox receipt for future sends outside recorded packets
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
- backend scheduled rows are mapped directly into the campaign-scoped Reports card list without report-library tabs
- campaign-scoped unscheduled generation downloads immediately without creating a browser or backend report-library row; standalone `/reports` browser-library behavior remains separate
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

- future deployed scheduled email receipt outside recorded packets
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

## Historical Completed Fix Queue

The 2026-06-27 Reports blocker queue is historical and complete for that defect set. The active queue is Reports Current Commits 7-9 in the controlling override.

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
6. Deployed GA4 Overview Report email delivery was user-confirmed on 2026-07-03 for the recorded Overview report packet; future scheduled/test deliveries and report variants still require their own runtime evidence if separately questioned.

## Partially Reviewed / Keep Watching

These areas are not current local blockers, but future work should not assume they are fully certified beyond the stated evidence:

- manual snapshot POST has no current GA4 frontend caller, but source-backed snapshot creation and direct GA4 snapshot PDF regeneration now fail closed before output/insertion when GA4 preflight or source-backed PDF generation is unavailable
- GA4 Ad Comparison passed exact deployed browser/direct/email parity for this
  Reports certification; its separate tab-specific document controls any broader
  Ad Comparison claim outside generated Reports artifacts
- scheduled Insights PDF uses the supported server sessions trend rather than persisting the live selected trend metric/mode
- the Drizzle schema does not express the report-send unique index even though startup DDL creates it
- legacy routes without a current GA4 Reports caller are outside this certification boundary
- existing production Campaign DeepDive scheduled rows may need a separate cleanup audit if they were orphaned from old localStorage-only visibility before Commit 3

## Not Locally Verifiable

The following cannot be proven from local code alone:

- future real deployed scheduled email receipt outside recorded packets
- future deployed scheduled/test email deliveries outside recorded packets
- deployed Campaign DeepDive scheduled-report UI validation after the Campaign DeepDive section is refined
- real inbox delivery for future sends outside recorded packets
- live GA4 API processing latency
- token refresh behavior against real accounts
- visual PDF fidelity across every deployed browser/PDF reader

## Validation Evidence

Current exact-SHA validation completed August 12, 2026:

- focused Reports packet: 5 files and 71 tests passed
- protected Overview and Insights packet: 44 files and 496 tests passed
- Reports certification gate and all 6 gate regression tests passed with the final `PRODUCTION_READY` record
- TypeScript passed through npm run check
- production build passed; Vite transformed 3,466 modules and the server bundle completed
- no live Overview or Insights runtime file was modified by this audit/machine-gate step
- exact-SHA CRUD passed and a read-only rolled-back audit confirmed restoration to the original three active reports
- the prior natural `2026-08-11T09:00@Europe/Amsterdam` run remains retained evidence for the unchanged scheduled-selection/snapshot path; the exact-SHA controlled test-send separately proved provider-confirmed delivery and truthful persistence without creating a scheduled event or snapshot
- Overview and Insights exact-SHA carry-forward checks and user visual confirmation passed without runtime or persistence changes

These checks prove the current in-scope matrices. Future provider availability, future inbox behavior, future revisions/configurations, and excluded Campaign DeepDive behavior are not claimed.

Historical evidence follows and remains bounded to its recorded revision and packet.

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

- future real deployed scheduled email receipt outside recorded packets
- future deployed scheduled/test email deliveries outside recorded packets
- deployed Campaign DeepDive scheduled-report UI validation after the Campaign DeepDive section is refined
- Mailgun provider event availability in the deployed account
- real recipient inbox receipt for future sends outside recorded packets
- deployed scheduler timing
- production database index state
- production report-row cleanup needs
- live GA4 API processing latency

Deployed UI validation now proves GA4 Unscheduled Report, GA4 Scheduled Overview Revenue Label, and GA4 Scheduled Report Creation/Edit/Delete for the deployed code state. Campaign DeepDive Scheduled Report Visibility remains deferred to Campaign DeepDive refinement. Deployed GA4 Overview Report email delivery is user-confirmed for the recorded 2026-07-03 Overview packet; future scheduled/test deliveries and report variants remain runtime-evidence-bound.

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

Answer that GA4 Reports is **PRODUCTION_READY** for certified runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e`. Historical send evidence remains bounded operational evidence; Campaign DeepDive and future provider/recipient behavior remain excluded from the GA4 Reports certification.

## 2026-07-30 Current Commit 10 Boundary — Bounded Packet Closed

The GA4 Reports certification above is unchanged for its recorded packets. Commit `ec265895` deployed the shared Campaign DeepDive scheduled/manual aggregate correction for ordered campaign-to-date GA4 financial values, GA4-context persisted sources, valid-zero/negative ROAS/ROI, and `performance_summary_aggregate_v2`. The user-confirmed browser packet covered Performance Summary Total Spend and Budget & Financial Analysis Total Revenue against GA4 Overview on `GA4 single` / `ga4_mock`; it did not inspect a scheduled report. Commit 10 is closed for the bounded code/browser packet, while current attachment values and delivery remain externally unproven.
