# Campaign DeepDive Custom Report Production-Ready Tracker

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

Track the work required to make the Campaign DeepDive `Custom Report` subsection production-ready.

This tracker exists so Custom Report follows the same connected-source aggregate pattern as:

- Performance Summary
- Budget & Financial Analysis
- Platform Comparison
- Trend Analysis
- Executive Summary

## Current Status

**DEPLOYMENT VALIDATION REQUIRED** for the changed Performance Summary PDF composition. The rest of the previously certified GA4-first Custom Report lifecycle remains unchanged by this local correction.

The production certificate is limited to Campaign DeepDive -> Custom Report with GA4 configured as the main analytics platform. Google Ads, Meta, Instagram, and TikTok were not enabled/configured and are not certified by this evidence. Performance Summary, Budget & Financial Analysis, Platform Comparison, Trend Analysis, Executive Summary, and the certified GA4 platform section remain fixed upstream contracts; this certification proves Custom Report consumes and propagates those contracts without re-certifying their internal calculations.

Campaign DeepDive preserves campaign context with `/reports?campaignId=<campaignId>`. In campaign context the Reports page displays the active campaign's backend scheduled report cards directly. One-off reports download without creating a report-library row. Saved scheduled reports support create, edit, reschedule, pause/disable, resume, delete, latest-value download, immutable snapshots, scheduled PDF delivery, and send-event bookkeeping.

The prior deployed evidence remains historical proof for the lifecycle and artifact paths tested at commit `41ec6015b4aae0090e834294a5355c06fbccaa34`. Deployed commit `350709360229c1bbd1efd534b0119fbf8f398053` proved the consolidated body shape but the attached `perf_summary_2026-08-28.pdf` disproved value parity, so it does not certify the changed Performance Summary PDF path.

## Current Authoritative Implementation And Certification - 2026-08-28

### Implemented path

- Entry: Campaign DeepDive opens `/reports?campaignId=<campaignId>`.
- Library read: `GET /api/platforms/campaign_deepdive/reports?campaignId=<campaignId>` returns only campaign-scoped `campaign_deepdive` rows after campaign-access verification.
- Aggregate input: browser and scheduled Custom Reports use the certified `/api/campaigns/:campaignId/outcome-totals?dateRange=90days` `performance_summary_aggregate_v3` contract.
- One-off download: `POST /api/campaigns/:campaignId/custom-report-pdf` returns a server-rendered PDF without creating a report or snapshot row.
- Saved-report download: `POST /api/platforms/campaign_deepdive/reports/:reportId/snapshots` creates one immutable snapshot, then `GET /api/report-snapshots/:snapshotId/pdf` returns the exact stored PDF artifact.
- Snapshot safety: Campaign DeepDive snapshots store `report_pdf_base64_v1`. Direct JSON/PDF reads verify report access and campaign/platform consistency; PDF reads additionally verify report-type consistency. Pre-deployment metadata-only snapshots have no recoverable PDF artifact and fail closed instead of being regenerated from current data.
- Scheduler: `server/report-scheduler.ts` deduplicates report rows by report ID, reserves one `report_send_events` row per `reportId + scheduledKey`, verifies campaign existence, builds the PDF from the current certified aggregate, and sends the same PDF buffer as the attachment. On the certified production Mailgun API path, it creates a snapshot only after delivery confirmation.
- Failure behavior: missing campaigns disable only the affected schedule; missing recipients and invalid artifacts do not create sent/downloadable snapshots or advance `lastSentAt`. On the configured Mailgun API path, provider failures and unconfirmed delivery also fail closed.
- Delivery terminology: provider acceptance is not called delivery. `sent` and snapshot creation require confirmed delivery for the configured Mailgun API path.

### Deployed production evidence

- Deployment health returned exact commit `41ec6015b4aae0090e834294a5355c06fbccaa34`; scheduler health was healthy before and after validation.
- Authenticated target campaign, client owner, report campaign, platform, snapshot, and aggregate scopes matched. A same-owner second campaign remained separated, and another owner's report/aggregate requests returned `404`.
- GET-only validation changed no campaign/report/source persistence and revoked its temporary Clerk session.
- Lifecycle validation proved create, edit, schedule, reschedule, disable, deployed UI visibility, and delete. The disposable report was removed and left zero snapshot/send-event child rows.
- Browser download snapshot `737c890c-f5c6-4646-bb4d-f6422dc7e78c` contains the exact downloaded PDF bytes (`6798` bytes; SHA-256 `95a0880832bf97a20d635cf972a76bfc38b4eee85f11946d1cb5187d23706a53`).
- Scheduled send key `2026-08-28T00:00@Europe/Amsterdam` created exactly one send event and linked snapshot `bab08ce3-c647-4bb1-b13b-7e6d1ffc1979`.
- The scheduled PDF exactly matched its immutable snapshot artifact (`6798` bytes; SHA-256 `e9806f76c8b93545d93d772a672d4d7b373cc51b8f108ed17a5a3d8121825527`). Browser and scheduled PDFs contained the same selected Campaign Health body headings and current Users, Sessions, Conversions, and Revenue values.
- The scheduled provider audit recorded `mailgun-api`, a provider response ID, `delivery_status=delivered`, and `delivered_at`. The only recipient was `tech.qina@outlook.com`; the user subsequently confirmed inbox receipt.
- The original `Perf` report schedule was restored exactly after the one authorized send. One snapshot, one send event, and one provider audit event were retained, and `lastSentAt` advanced as expected.
- The exact aggregate used during certification was `performance_summary_aggregate_v3` with window `2026-07-02` through `2026-08-27`, data-through date `2026-08-27`, and reporting time zone `Europe/Amsterdam`.
- Exact available values were Users `1,184`, Sessions `1,179`, Conversions `152`, Revenue `51,072.99`, Spend `2,699.75`, ROAS `18.92`, ROI `1,791.77%`, CPA `17.76`, and CVR `12.89%`. Impressions, Clicks, Leads, CPC, CPM, and CTR were unavailable and were not rendered as invented zeroes.

### Certification classification

- **Previously proven and unaffected:** entry, campaign/client/owner/platform scoping, report list isolation, create/edit/delete, schedule/reschedule/disable, immutable artifact storage, scheduler deduplication, provider delivery, inbox receipt, and send bookkeeping.
- **Incorrect at the attached deployed runtime:** the first artifact rendered retired tab bodies; after the body correction, `perf_summary_2026-08-28.pdf` still reported Sessions `1,179` and Revenue `$51,072.99` from `/outcome-totals.performanceSummary` instead of the Performance Summary UI's persisted/current-financial values.
- **Proven locally:** the shared renderer selects the same GA4-first inputs and single-page structure as Performance Summary, Budget & Financial Analysis, Trend Analysis, and Executive Summary; legacy keys normalize without duplicate bodies and unavailable UI-aligned inputs fail closed.
- **Partially verified:** all four changed PDF bodies require fresh deployed download comparison; exact-date financial history remains fail-closed when equivalent inputs are unavailable.
- **Unverified/out of scope:** future or disabled Google Ads, Meta, Instagram, TikTok, and other source mixes; internal behavior of the protected upstream Campaign DeepDive/GA4 contracts.

## Required Product Rule

Connected Platforms is the source of truth.

Custom Report must use metrics from the campaign's connected main sources only. If only Google Analytics is connected, Custom Report should expose and render only GA4-supported web analytics and outcome metrics. Paid-media metrics must remain unavailable unless a main paid-media Connected Platform supplies them.

## Original Root Cause

1. The Campaign DeepDive `Custom Report` launcher originally linked to `/reports` without campaign context.
2. Earlier report builders were platform-specific:
   - GA4 reports use GA4-specific report inputs.
   - LinkedIn reports use LinkedIn-specific hardcoded metric lists.
   - Some standalone report UI uses local/mock report storage.
3. Custom Report metric selection was not driven by the shared connected-source aggregate contract.
4. Selected report metrics could include metrics unavailable from the campaign's connected sources.
5. Some report output paths could fall back to `0`, `N/A`, or platform defaults instead of excluding unavailable metrics or explaining why they were unavailable.

## Source-Of-Truth Contract

Custom Report consumes the same shared aggregate used by the other Campaign DeepDive subsections:

- `/api/campaigns/:campaignId/outcome-totals`
- `performanceSummary.sources`
- `performanceSummary.totals`
- source `includedMetrics`
- source `excludedMetrics`
- source category, identity, label, and freshness metadata

Custom Report must not infer metrics from disconnected platforms.

## Metric Availability Rules

For GA4-only campaigns, Custom Report may use:

- users
- sessions
- conversions
- revenue, where available
- CVR when conversions and sessions are available

For paid-media metrics, Custom Report requires a connected main paid-media source:

- impressions
- clicks
- spend
- CTR
- CPC
- CPM
- CPA
- ROAS, when spend and revenue are available
- ROI, when spend and revenue are available

Financial child sources can contribute to aggregate financial totals, but they must not appear as separate main Connected Platforms.

## Implementation Plan

### Commit 1: Campaign-Scoped Entry Point

Goal:

- Make the Campaign DeepDive `Custom Report` launcher preserve campaign context.

Tasks:

- Trace the current `/reports` caller from Campaign DeepDive.
- Replace the global-only launcher behavior with a campaign-scoped Custom Report entry path or campaign-scoped builder mode.
- Ensure the builder has the active `campaignId`.
- Preserve existing standalone `/reports` route behavior outside Campaign DeepDive unless the current caller proves it must change.

Validation:

- From a campaign, opening Custom Report retains the campaign ID.
- Global Reports remains reachable and unchanged unless explicitly touched.

Status:

- [x] Completed locally: Campaign DeepDive now opens `/reports?campaignId=<campaignId>`.
- [x] Completed locally: Reports initializes and persists `campaignId` when launched from Campaign DeepDive.
- [x] Completed locally: campaign-scoped Reports pages show `Back to main Campaign Overview` above the `Reports` heading and link back to `/campaigns/<campaignId>`.
- [x] Completed: campaign-scoped Reports pages display only the active campaign's backend scheduled report cards and hide the standalone Standard Reports/Scheduled Reports/All Reports tab and filter shell.
- [x] Completed locally: campaign-scoped Reports pages do not seed global/demo reports when launched from Campaign DeepDive.
- [x] Completed locally: global `/reports` route remains unchanged.
- [x] User validation passed on 2026-05-28: Campaign DeepDive Custom Report opens with `campaignId` in the URL.

### Commit 2: Shared Aggregate Input

Goal:

- Make Custom Report read the same connected-source aggregate as the other Campaign DeepDive subsections.

Tasks:

- Fetch `/api/campaigns/:campaignId/outcome-totals` for campaign-scoped Custom Report.
- Use `performanceSummary.sources` and `performanceSummary.totals` to determine available current metrics.
- Keep response shapes stable.

Validation:

- GA4-only campaign response contains `ga4` as the main source.
- Disconnected paid-media sources do not appear as available report sources.
- Financial child sources do not appear as separate main platform rows.

Status:

- [x] Completed locally: campaign-scoped Reports fetches `/api/campaigns/:campaignId/outcome-totals?dateRange=90days`.
- [x] Completed locally: available Custom Report sources are derived from `performanceSummary.sources`.
- [x] Completed locally: available Custom Report metrics are derived from `performanceSummary.totals`.
- [x] Completed locally: financial child sources are excluded from the visible main source list.
- [x] User validation passed on 2026-05-28: Create Report dialog shows campaign connected-source data.

### Commit 3: Metric Picker Availability Gating

Goal:

- Only show selectable metrics that are available from connected sources.

Tasks:

- Build available metric groups from aggregate metric availability.
- Hide or disable paid-media metrics when no paid-media source provides them.
- Show unavailable reasons where useful.
- Ensure GA4-only Custom Report does not offer impressions, clicks, spend, CTR, CPC, CPM, CPA, paid-media ROAS, or paid-media recommendations unless a capable source exists.

Validation:

- GA4-only Custom Report picker shows GA4/web outcome metrics only.
- Paid-media metrics appear after a capable main paid-media source is connected and included in the aggregate.

Status:

- [x] Completed locally: campaign-scoped Custom Report shows a metric picker only for metrics marked available by `performanceSummary.totals`.
- [x] Completed locally: unavailable paid-media metrics are hidden from the picker.
- [x] Completed locally: paid-media metric keys are hidden unless a connected main paid-media source supplies paid-media metrics.
- [x] Completed locally: selected Custom Report metric keys are stored on the saved report config for aggregate-backed output work.

### Commit 4: Report Output Uses Aggregate Values

Goal:

- Generated Custom Report output should render from live connected-source aggregate values.

Tasks:

- Replace report-only or platform-hardcoded metric lookups with aggregate-backed values for campaign-wide Custom Report output.
- Do not render unavailable metrics as `0`.
- If a saved report config includes a now-unavailable metric, omit it or mark it unavailable with the aggregate reason.

Validation:

- GA4-only generated Custom Report output contains only GA4-supported metrics.
- Paid-media-only metrics do not appear for GA4-only campaigns.
- Saved custom report config cannot force disconnected-source metrics into output.

Status:

- [x] Completed: campaign-scoped Custom Report PDFs render selected metric values from `performanceSummary.totals`; campaign report cards remain summary-only.
- [x] Completed locally: unavailable saved metrics are marked unavailable with aggregate reasons instead of rendering as `0`.
- [x] Completed: only the active campaign's backend scheduled report cards are visible; detail values are rendered in generated PDFs, not inline on summary cards.
- [x] Deployed validation passed on 2026-08-28: the active campaign's saved reports and generated output were isolated from same-owner and other-owner campaigns.

### Commit 5: KPI, Benchmark, And Section Mapping

Goal:

- Make Custom Report sections align with campaign-level analytics.

Tasks:

- For the GA4-first version, KPI and Benchmark report sections use campaign-scoped GA4 platform records for rows, current values, and targets; campaign-level aggregation remains inactive until additional Connected Platforms are enabled.
- Current KPI/Benchmark values should come directly from the campaign-scoped GA4 platform records returned by the certified GA4 endpoints.
- The report consumer must not substitute Campaign KPI/Benchmark records or aggregate-derived current values for those GA4 record values.
- Custom sections should remain section-composition based.

Validation:

- KPI/Benchmark rows update after GA4 KPI/Benchmark changes and refetch.
- Current values and targets match the campaign-scoped GA4 KPI/Benchmark records.

Status:

- [x] Completed: saved report composition preserves selected metrics and selected GA4 KPI/Benchmark sections.
- [x] Completed: GA4 KPI rows are fetched from `/api/platforms/google_analytics/kpis?campaignId=:campaignId`.
- [x] Completed: GA4 Benchmark rows are fetched from `/api/platforms/google_analytics/benchmarks?campaignId=:campaignId`.
- [x] Completed: KPI/Benchmark report rows consume the fixed upstream GA4 records' saved `currentValue`, `targetValue`, and `benchmarkValue` fields directly.
- [x] Completed locally: All Reports cards remain summary cards and do not render connected-source detail previews inline.
- [x] Completed locally: All Reports cards expose an edit icon that opens the report dialog with saved values prefilled.
- [x] Completed locally: All Reports cards use `Download latest report` and do not expose Scheduled Reports-only Pause/Resume actions.
- [x] Completed locally: All Reports filter bar no longer includes the redundant `Campaign` dropdown.
- [x] Completed locally: edit mode uses `Update Report`, suppresses first-field autofocus, and disables update until a form value changes.
- [x] Completed locally: Create/edit report descriptions are limited to 160 characters, report cards show the description when available, and report cards no longer show the `Format: PDF` metadata row.
- [x] Completed locally: the top-level `Create Report` button opens a fresh blank create form and does not reuse previously edited report values, report type, selected tabs, or selected metrics.
- [x] Completed locally: unscheduled create mode shows `Download Report` and downloads a PDF containing the selected report sections; scheduled create mode shows `Schedule Report`.
- [x] Completed locally: downloaded Campaign DeepDive subsection PDFs include a body for each selected tab using the existing `/outcome-totals` connected-source aggregate, not just a list of selected tab names.
- [x] Completed locally: schedule mode label is `Schedule Automated Report`.
- [x] Completed locally: scheduled create mode uses the same filled primary button style as `Download Report` for `Schedule Report`.
- [x] Completed locally: new scheduled reports default to `Daily`, while edit mode preserves the saved schedule frequency.
- [x] Completed locally: Monthly schedules expose logical day-of-month options, and Quarterly schedules expose start/end-of-quarter options instead of silently saving hidden defaults.
- [x] Completed locally: Schedule form now creates backend scheduled report records for Campaign DeepDive Custom Reports, including recipients, schedule time, browser time zone, and saved report composition.
- [x] Completed: standalone `/reports` retains its report-library tabs; campaign-scoped `/reports?campaignId=...` hides that tab/filter shell and displays the active campaign's backend scheduled report cards directly.
- [x] Completed: one-off campaign reports download immediately and create no report-library row; scheduled reports appear as backend cards with `Download latest report`.
- [x] Completed: `Download latest report` creates an immutable server snapshot from current certified inputs and downloads that exact stored artifact; the browser no longer builds a separate Campaign DeepDive PDF.
- [x] Completed locally: campaign-scoped Custom Report creation exposes Campaign DeepDive subsection report types and automatically stores each type's single-page composition; the create screen has no `Tabs to include` picker, while the standalone `/reports` route keeps its broader report type options when reached directly.
- [x] Completed locally: generated report cards no longer show the `Generated` status pill.
- [x] Completed locally: report delete icons open the shared website-style confirmation dialog before deleting the stored report.
- [x] Completed locally: Scheduled Reports no longer renders hard-coded demo scheduled cards with nonfunctional delete buttons; the tab shows stored scheduled report records that use the shared confirmed delete path.
- [x] Completed locally: Scheduled Reports shows a `No scheduled reports yet` empty state when no scheduled report records exist.
- [x] Completed locally: Scheduled Reports cards no longer show the `Scheduled` status pill or settings icon, and their `Edit` action opens the report dialog with saved values prefilled.
- [x] Completed locally: Scheduled Reports card `Data Included` lists the selected report tabs from `selectedSections` instead of legacy KPI/Benchmark flags.
- [x] Completed locally: Scheduled Reports card `Pause` disables the backend schedule with backend status `paused`, marks the local card as paused, keeps the report visible in Scheduled Reports, and changes the card action to `Resume` so users can re-enable the saved backend schedule. Scheduled cards do not show a separate Status field; the action label shows whether the schedule can be paused or resumed. Scheduled cards also expose `Download latest report` backed by the same latest-value PDF regeneration path.
- [x] Completed locally: Pause/Resume is intentionally limited to Scheduled Reports because it temporarily stops or restarts recurring email delivery without forcing users to delete and recreate the saved report setup.
- [x] Completed locally: `Campaign connected-source data` lists connected source names as bullets and no longer displays internal selectable metric keys.
- [x] Completed locally: Executive Summary PDF exports one current UI-aligned body: 7-Day Snapshot Trajectory, Risk Level, Executive Summary, Marketing Funnel Performance, KPI Exceptions, Benchmark Exceptions, and Recommended Actions. Retired selections and the removed full Risk Assessment body do not render.
- [x] Completed locally on 2026-08-28: Performance Summary PDF exports normalize all legacy `performance-summary:*` selections to one consolidated body with `Key Outcomes`, `Campaign Health`, `Top Priority Action`, `Recent Movement`, and `Recommended Actions`. The renderer no longer prints retired bodies or raw KPI/Benchmark dumps, and the GA4-first body now uses the same persisted Summary traffic and campaign-to-date financial reader as the UI instead of differing aggregate values.
- [x] Completed locally: Budget & Financial Analysis PDF exports one current UI-aligned body: Financial Position, Budget & Pacing, conditional Paid Media Efficiency, Allocation & Sources, and Executive Action. Legacy Financial tab keys normalize to this one body.
- [x] Completed locally: Platform Comparison PDF exports include the same major web-tab section set: Overview exports Platform Performance Summary Cards, Channel Performance Overview, Revenue Tracking Platforms, and Total Revenue; Performance Metrics exports Detailed Performance Metrics, Efficiency Comparison, and Volume Comparison; Financial Comparison exports Cost per Conversion, Budget Allocation, ROI/ROAS, or the no-paid-media state; Insights exports Platform Performance Insights, source availability, paid-media comparison availability, comparison insight headings, and Strategic Recommendations where those inputs exist.
- [x] User validation passed on 2026-05-28: All Reports cards show summary-only layout without connected-source detail previews.

Current campaign-scoped Report Type menu:

- `Performance Summary`: `Performance Summary`
- `Budget & Financial Analysis`: `Overview`, `ROI & ROAS`, `Cost Analysis`, `Budget Allocation`, `Insights`
- `Trend Analysis`: `Executive View`
- `Executive Summary`: `Executive Summary`

`Platform Comparison` is hidden for new campaign-scoped report creation. It remains available only while editing a legacy saved `platform-comparison` report so the stored configuration remains recoverable.

### Commit 6: Regression Coverage

Goal:

- Guard the connected-source Custom Report pattern.

Required tests:

- GA4-only Custom Report excludes paid-media metrics.
- Paid-media metrics appear only when a connected main paid source provides them.
- Financial child sources do not appear as main platforms.
- Saved custom report config cannot force unavailable metrics into output.
- Campaign-scoped Custom Report uses the active campaign ID.
- Global Reports behavior is not accidentally changed.

Status:

- [x] Completed locally: regression guard covers GA4-only paid-media exclusion.
- [x] Completed locally: regression guard covers future paid-media source gating.
- [x] Completed locally: regression guard covers financial child-source exclusion from main source rows.
- [x] Completed locally: regression guard covers unavailable saved metrics rendering as unavailable.
- [x] Completed locally: regression guard covers campaign-scoped Custom Report routing and saved campaign ID.
- [x] Completed locally: regression guard covers global `/reports` route preservation.
- [x] Completed locally: regression guard confirms All Reports cards do not render inline connected-source detail previews or the old `Includes: KPIs, Benchmarks` line.
- [x] Completed locally: regression guard confirms report cards support edit mode through the report dialog and suppress edit-mode autofocus.
- [x] User validation passed on 2026-05-28: All Reports cards show the summary-only card layout without `Includes: KPIs, Benchmarks`.

### Commit 7: Documentation And Final Validation

Goal:

- Mark Custom Report production-ready only after implementation and validation evidence is complete.

Tasks:

- Update `ARCHITECTURE_USER_JOURNEY.md`.
- Update `GA4/README.md`.
- Update this tracker with completed fixes, validation, and remaining source-specific boundaries.

Status:

- [x] Completed locally: `ARCHITECTURE_USER_JOURNEY.md` documents the campaign-scoped Custom Report aggregate-consumer pattern.
- [x] Completed locally: `GA4/README.md` documents the GA4-only Custom Report behavior and paid-media boundary.
- [x] Completed locally: `GA4/REPORTS.md` documents saved custom report configuration and summary-only All Reports cards.
- [x] Completed locally: this tracker records implementation status, validation evidence, and separate future-source boundaries.

Validation:

- Targeted regression tests pass.
- `npm run check` passes.
- `npm run build` passes.
- User validates GA4-only Custom Report behavior from Campaign DeepDive.

## Production-Ready Definition

Custom Report is production-ready when:

- it opens in campaign context from Campaign DeepDive
- campaign-scoped Reports pages expose a `Back to main Campaign Overview` link to `/campaigns/<campaignId>`
- campaign-scoped Reports hides the standalone tab/filter shell and shows only backend scheduled reports whose saved `campaignId` matches the active Campaign DeepDive campaign
- campaign-scoped Reports pages do not inject global/demo reports
- it uses the shared connected-source aggregate contract
- metric selection is based on available connected-source metrics
- report output renders only available metrics
- unavailable metrics are omitted or clearly explained
- in the GA4-first version, KPI/Benchmark sections use campaign-scoped GA4 platform records for current values and targets
- saved report configuration cannot reintroduce disconnected-source metrics
- campaign-scoped scheduled report cards remain summary-only and do not expose connected-source values, KPI/Benchmark rows, generated status pills, or `Includes` configuration details inline
- campaign-scoped scheduled cards expose edit, `Download latest report`, Pause/Resume, and confirmed delete actions
- standalone All Reports behavior remains separate and keeps its Search, Report Type, and Date Range filters
- report cards show saved descriptions when available and do not show redundant `Format: PDF` metadata
- report-card edit actions open the report dialog with saved values prefilled, show `Update Report`, and keep update disabled until a change is made
- Create/edit report descriptions are capped at 160 characters
- report delete icons open a confirmation dialog before removing the stored report record
- campaign-scoped report cards render stored backend rows, not hard-coded demo cards, so lifecycle actions operate on exact report IDs
- the page shows a clear empty state when there are no scheduled report records
- card `Data Included` shows selected tab labels from the saved `selectedSections` composition
- Pause disables the backend schedule and persists status `paused`; Resume re-enables the preserved schedule without recreating report content
- `Download latest report` creates one immutable server PDF artifact from current certified inputs and downloads those exact bytes
- The top-level `Create Report` action opens an empty create form, clears report type, selected tabs, custom metric selections, and edit mode
- unscheduled create mode shows `Download Report`, downloads the selected report sections through `/api/campaigns/:campaignId/custom-report-pdf`, and creates no report-library or snapshot row
- direct snapshot JSON/PDF routes verify report access plus campaign/platform consistency; PDF reads additionally verify report-type consistency, and historical snapshots without immutable artifacts fail closed
- Downloaded PDFs render the selected single-page body from that subsection's fixed upstream inputs
- Downloaded Executive Summary PDFs use cumulative persisted GA4 traffic, campaign-to-date financial values, GA4 platform KPI/Benchmark rows, and compatible seven-day trajectory inputs
- legacy Executive Summary selection keys normalize to the one current `executive-summary:overview` composition so retired selections cannot duplicate output
- Downloaded Performance Summary PDFs normalize legacy section keys to one consolidated body and render `Key Outcomes`, `Campaign Health`, `Top Priority Action`, the default seven-day `Recent Movement`, and `Recommended Actions`; in the GA4-first path, current traffic and financial outcomes use the existing Performance Summary UI-aligned reader, target decisions use campaign-scoped GA4 KPI/Benchmark records, and unavailable inputs or incompatible historical comparisons fail closed
- Downloaded Budget & Financial Analysis PDFs expose one current page using `/outcome-totals.performanceSummary` for connected-source financial totals/source availability, persisted financial source rows for allocation detail, and the campaign row for budget/start/end pacing inputs
- Downloaded Platform Comparison PDFs include the same major sections shown in the selected Platform Comparison web tabs, using `/outcome-totals.performanceSummary.sources` for connected-source rows and source capability gating for paid-media-only comparison sections
- Downloaded Trend Analysis PDFs expose one canonical `Executive View`: cumulative persisted GA4 traffic and current aggregate financial headline values, the source-aware `/trend-analysis` rows for the default 30-day chart window, and an exact comparison date 30 days before data-through
- Trend comparisons use only compatible persisted exact-date history; missing history remains unavailable instead of substituting another window
- legacy saved `trend-analysis:*` selections normalize to one `trend-analysis:overview` section so old report configurations remain compatible without rendering duplicate retired-tab content
- Scheduled create mode uses `Schedule Automated Report`, defaults to `Daily`, and shows `Schedule Report` in the same filled primary button style as `Download Report`
- Monthly schedule mode must show day-of-month choices: 1st day, 15th day, or last day of month
- Quarterly schedule mode must show timing choices: start of quarter or end of quarter
- Schedule form must create a backend scheduled report record with `scheduleTimeZone`, `scheduleTime`, recipients, saved report type, and selected tabs so `server/report-scheduler.ts` can send the report like platform-level scheduled reports
- scheduled processing deduplicates by report ID and `reportId + scheduledKey`; missing campaigns, recipients, or artifacts fail closed; and the certified Mailgun path creates snapshots plus `lastSentAt` bookkeeping only after confirmed delivery
- New campaign-scoped Custom Report creation exposes `Performance Summary`, `Budget & Financial Analysis`, `Trend Analysis`, and `Executive Summary`; `Platform Comparison` is retained only for editing a legacy saved report of that type
- New campaign-scoped reports hide `Tabs to include`; selecting a report type automatically saves its full mapped single-page composition in `selectedSections`
- Existing saved compositions are not migrated, and their composition picker remains available during edit for backward compatibility
- regression coverage guards GA4-only and future paid-media source scenarios
- documentation matches the implemented behavior

## Outstanding Tasks

- [x] Commit 1: Campaign-scoped entry point
- [x] Commit 2: Shared aggregate input
- [x] Commit 3: Metric picker availability gating
- [x] Commit 4: Report output uses aggregate values
- [x] Commit 5: KPI, Benchmark, and section mapping
- [x] Commit 6: Regression coverage
- [x] Commit 7: Documentation and final validation for the implemented aggregate-consumer scope

Open production-readiness tasks before Custom Report can be called fully production-ready:

- [x] Add dedicated Trend Analysis PDF parity so the canonical Executive View exports real source-aware trend content instead of generic fallback output.
- [x] Make scheduled Campaign DeepDive PDFs include selected section body content from latest campaign data, not only report metadata and selected section names.
- [x] Add regression coverage proving every Campaign DeepDive report type has a dedicated renderer, including Trend Analysis.
- [x] Add regression coverage proving scheduled Campaign DeepDive PDFs include selected section body content, not just selected section names.
- [ ] Deploy the consolidated Performance Summary PDF correction and verify one fresh UI download against the deployed Performance Summary page.

Commit 5 final implementation status:

- [x] Scheduled Campaign DeepDive PDF body rendering is covered for every current Campaign DeepDive report type and tab.
- [x] Scheduled Campaign DeepDive PDF regression coverage verifies the scheduler uses latest campaign aggregate inputs and selected-section body renderers.
- [x] Browser downloads are production-ready locally for the implemented GA4/current aggregate-consumer scope.
- [x] Scheduled PDFs now build one server-side `CampaignDeepDiveReportContext` from latest campaign context, `performanceSummary`, Executive Summary context where selected, KPI rows, Benchmark rows, and Trend Analysis aggregate where selected.
- [x] Deployed scheduled email evidence passed on 2026-08-28 with provider delivery-event proof and user-confirmed inbox receipt.

Scheduling delivery status:

- [x] Campaign DeepDive Custom Report scheduled creates/updates/deletes now write through `/api/platforms/campaign_deepdive/reports`, persist `scheduleTimeZone`, `scheduleTime`, recipients, and saved report composition, and are picked up by `server/report-scheduler.ts`.
- [x] The scheduler has a `campaign_deepdive` PDF attachment path so scheduled Custom Report emails do not use the old browser-only path.
- [x] Scheduled Campaign DeepDive PDF attachments now render selected section body content from the scheduler's latest campaign aggregate, KPI rows, Benchmark rows, campaign context, and trend snapshot inputs instead of only listing selected tab names.
- [x] Scheduled Campaign DeepDive PDF attachments now use a shared latest-value composition helper. Selected tabs control whether Executive Summary context, KPI rows, Benchmark rows, and Trend Analysis aggregate data are loaded; non-Trend scheduled reports do not request Trend Analysis aggregate construction.
- [x] Scheduled Campaign DeepDive PDF parity regression coverage now separately proves latest aggregate context loading, selected Trend Analysis aggregate loading, selected Executive Summary context loading, every current report type/tab body renderer, and no metadata-only fallback inside the Campaign DeepDive scheduled PDF builder.
- [x] Deployed email-delivery evidence was recorded on 2026-08-28. Mailgun reported `delivered`, the audit row recorded the provider response/delivery time, and the user confirmed inbox receipt.

## Deployed Scheduled Email Evidence Checklist

Completed for the GA4-first source mix on 2026-08-28:

- [x] Used the existing campaign-scoped `Perf` report and preserved its report content.
- [x] Temporarily scheduled exactly one due run in `Europe/Amsterdam`, addressed only to `tech.qina@outlook.com`.
- [x] Confirmed one deduplicated `report_send_events` row for the scheduled key.
- [x] Confirmed Mailgun provider acceptance and a `delivered` provider event with response ID and delivery timestamp.
- [x] Confirmed inbox receipt with the authorized recipient.
- [x] Confirmed the scheduled snapshot was created only after success and linked from the send event.
- [x] Confirmed the scheduled PDF bytes exactly matched the immutable snapshot artifact.
- [x] Confirmed browser and scheduled PDFs contained actual Campaign Health body content and matching aggregate values, not only selected section names.
- [x] Confirmed the certified GA4-first source mix and exact reporting window at send time.
- [x] Restored the original report schedule and verified accurate `lastSentAt`, snapshot, send-event, and provider-audit bookkeeping.

This evidence certifies only the GA4-first source mix tested. Any future/refined main Connected Platform still requires its own source-specific readiness evidence before its values are trusted in Custom Report.

## Separate Source Work

Google Ads and other future integrations must still prove their own Connected Platforms source-level correctness before their metrics are trusted in Custom Report.

This tracker future-proofs Custom Report as an aggregate consumer. It does not make an unfinished source integration production-ready by itself.

## Validation Evidence

- Commit 1 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 1 user validation passed on 2026-05-28.
- Commit 2 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 2 user validation passed on 2026-05-28.
- Commit 3 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 3 user validation passed on 2026-05-28.
- Commit 4 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 4 user validation passed on 2026-05-28.
- Native browser create-confirmation popup removed; user validation passed on 2026-05-28.
- Commit 5 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 5 user validation passed on 2026-05-28.
- Commit 6 regression coverage completed in `server/custom-report-regression.test.ts`.
- Commit 6 user validation passed on 2026-05-28.
- All Reports summary-only cleanup validated on 2026-05-28: connected-source detail previews and `Includes: KPIs, Benchmarks` are not rendered on report cards.
- All Reports edit workflow added on 2026-05-28: edit icon opens prefilled dialog, `Update Report` is disabled until changes are made, generated status pill is hidden, and edit-mode report-name autofocus is suppressed.
- All Reports action cleanup added on 2026-05-29: All Reports cards use `Download latest report` and keep Pause/Resume out of the library card action set.
- Campaign return-link cleanup added on 2026-05-29: campaign-scoped Reports pages show `Back to main Campaign Overview` above the page heading and route back to `/campaigns/<campaignId>`.
- Local validation passed on 2026-05-29 for All Reports action cleanup: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- All Reports Campaign filter removal added on 2026-05-29: Search, Status, Report Type, and Date Range remain; the Campaign dropdown no longer renders.
- All Reports Status filter removal added on 2026-05-30: Search, Report Type, and Date Range remain; lifecycle state is handled by the Standard Reports and Scheduled Reports tabs.
- Historical campaign report isolation fix added on 2026-05-31 and pushed in commit `a059883e`: the then-visible campaign-scoped report tabs were restricted to the active campaign and stopped seeding global/demo reports. The current campaign-scoped UI supersedes that layout by hiding the standalone tab/filter shell and rendering only active-campaign backend scheduled cards.
- Create Report reset fix added on 2026-05-28: top-level create opens a fresh empty form after prior edits.
- Create Report action split added on 2026-05-28: unscheduled create mode downloads the selected sections, while scheduled create mode saves with `Schedule Automated Report` and `Schedule Report`.
- Download Report content fix added on 2026-05-28 and pushed in commit `ec6f9234`: Campaign DeepDive subsection exports now print selected tab bodies from the connected-source aggregate instead of only listing selected tab names.
- Report Type composition updated on 2026-05-28 and pushed in commit `f8dfeee0`: Campaign DeepDive Custom Report creation exposes Campaign DeepDive subsection report types and saves selected subsection tabs; the standalone `/reports` route keeps broader report-type choices when reached directly.
- Commit 7 documentation updated on 2026-05-28.
- Report delete confirmation and connected-source source-list cleanup added on 2026-05-29.
- Executive Summary `Executive Overview` PDF section parity fix added on 2026-05-29.
- Executive Summary `Strategic Recommendations` PDF section parity fix added on 2026-05-29.
- Performance Summary PDF section parity was originally recorded on 2026-05-29. It was superseded on 2026-08-28 when one artifact exposed retired bodies and the later `perf_summary_2026-08-28.pdf` exposed a second root cause: the consolidated renderer read differing outcome-aggregate values instead of the fixed Performance Summary page inputs. The local correction now uses the UI-aligned reader and awaits deployed download validation.
- Budget & Financial Analysis PDF parity was updated on 2026-08-28 for the current one-page UI; legacy five-tab selections now normalize to one body using the same aggregate, pacing, allocation, and action inputs as the page.
- Platform Comparison PDF section parity fix added on 2026-05-29: selected Platform Comparison tabs now export the matching web-tab section structure instead of the generic DeepDive metric-list fallback.
- Trend Analysis PDF parity was updated on 2026-08-28: legacy selections normalize to one body, headline traffic is cumulative, current financials use the page aggregate, the chart window is 30 days, and comparisons require exact compatible history.
- Commit `cd35bba1` deployed the Trend report-consumer correction. Focused Trend/Custom Report regression tests passed `56/56`, TypeScript and production build passed, read-only production-data PDF parity returned Sessions `1,183`, Users `1,184`, and Conversions `152`, and the deployed Reports bundle exposed only `Executive View` as the selectable Trend section.
- Scheduled Campaign DeepDive PDF body-content fix added on 2026-05-30: scheduled email attachments now include selected tab body sections from latest server-side campaign aggregate inputs, KPI rows, Benchmark rows, campaign context, and trend snapshot inputs instead of only report metadata and selected tab names.
- Local validation passed on 2026-05-30 for scheduled Campaign DeepDive PDF body content: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Commit 5 scheduled PDF final regression coverage added on 2026-05-30: regression tests now compare current Campaign DeepDive report type/tab composition against the scheduled PDF renderer so new tabs cannot silently fall back to metadata-only scheduled attachments.
- Local validation passed on 2026-05-30 for Commit 5 scheduled PDF regression coverage and final docs: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Commit 2 shared latest-value scheduled PDF composition added on 2026-05-30: scheduled Campaign DeepDive PDFs now build a shared server-side report context from latest campaign aggregate inputs, campaign context, selected Executive Summary context, KPI rows, Benchmark rows, and selected Trend Analysis aggregate data.
- Local validation passed on 2026-05-30 for Commit 2 shared scheduled PDF composition: `npm test -- server/custom-report-regression.test.ts`, `npm test -- server/performance-summary-scheduler-regression.test.ts`, `npm test -- server/executive-summary-regression.test.ts server/executive-summary-helpers-regression.test.ts server/trend-analysis-overview-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Commit 3 scheduled PDF parity regression added on 2026-05-30: targeted regression tests now assert latest aggregate context loading, selected Trend Analysis data loading, selected Executive Summary context loading, all current Campaign DeepDive report type/tab body rendering, and no metadata-only scheduled PDF fallback.
- Commit 4 final docs and evidence checklist added on 2026-05-30: production-readiness status now separates completed local implementation/regression coverage from the deployed scheduled-email evidence checklist.
- Deployed evidence clarification added on 2026-05-30: the scheduled-email evidence checklist may be completed after LinkedIn or another main source is added, but that validates the selected source mix and does not replace source-specific production-readiness validation for the new integration.
- Campaign DeepDive Custom Report scheduled-email backend wiring added on 2026-05-29: scheduled create/update/delete writes through `/api/platforms/campaign_deepdive/reports`, stores time zone and recipients, and the scheduler has a `campaign_deepdive` PDF attachment path.
- Monthly and Quarterly schedule option cleanup added on 2026-05-29: Monthly exposes day-of-month choices and Quarterly exposes start/end-of-quarter choices.
- Scheduled Reports card action fix added on 2026-05-29: `Pause` now disables the backend schedule, writes backend status `paused`, keeps paused cards visible without a separate Status field, and exposes `Resume` on paused cards to re-enable the saved backend schedule. `Download latest report` regenerates from latest values.
- Local validation passed on 2026-05-29 for reversible Scheduled Reports Pause/Resume behavior: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Local validation passed on 2026-05-29 for Platform Comparison PDF section parity and Scheduled Reports pause state: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Local validation passed on 2026-05-29 for Monthly and Quarterly schedule options: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Local validation passed on 2026-05-29 for scheduled-email backend wiring: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
- Local validation passed on 2026-05-28: `npm test -- server/custom-report-regression.test.ts`.
- Local validation passed on 2026-05-28: `npm run check`.
- Local validation passed on 2026-05-28: `npm run build`.
- Local consolidated Performance Summary PDF validation passed on 2026-08-28: the focused Custom Report, PDF-window, scheduled Executive Summary, Performance Summary decision, Performance Summary PDF, and report-email packets passed; TypeScript and the production build passed; `git diff --check` passed. The full repository run finished `1604/1651` tests passing. Three protected GA4 certification gates correctly failed closed because their dependency hashes changed; the remaining failures were in unrelated Google Ads/Instagram/TikTok and stale-regression paths outside this diff. No certification record was rewritten or treated as passing.
- Local UI-value parity correction on 2026-08-28: read-only persisted production records resolved Users `1,184`, Sessions `1,183`, Conversions `152`, Revenue `$72,766.69`, and Spend `$2,699.75` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`. The focused fixture deliberately retained the incorrect aggregate values `1,179` and `$51,072.99` and proved the PDF selected the UI-aligned values instead; a separate negative case proves unavailable UI Revenue cannot fall back to the differing aggregate. Focused/adjacent tests passed `113/113`, TypeScript passed, and the production build passed. Fresh deployed PDF comparison remains open.
- Local four-section PDF parity validation on 2026-08-28: the shared direct/snapshot/scheduled renderer now follows the current Performance Summary, Budget & Financial Analysis, Trend Analysis, and Executive Summary input contracts and single-page bodies. The focused and adjacent packet passed `100/100`; the final four-section behavior packet passed `14/14`; TypeScript and the production build passed. Fresh deployed downloads remain required before certification is restored for the changed bodies.

## Historical 2026-07-30 Commit 10 Status

Commit `ec265895` was an earlier bounded implementation stage. Its `performance_summary_aggregate_v2` and attachment-evidence-pending statements are historical and are superseded by the authoritative 2026-08-28 certification above. Current production browser and scheduler paths consume `performance_summary_aggregate_v3` through the certified Campaign DeepDive aggregate reader, persist immutable PDF artifacts, and have passed deployed attachment, provider-delivery, and inbox validation.
