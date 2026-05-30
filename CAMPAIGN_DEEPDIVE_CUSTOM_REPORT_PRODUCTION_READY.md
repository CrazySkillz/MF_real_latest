# Campaign DeepDive Custom Report Production-Ready Tracker

## Purpose

Track the work required to make the Campaign DeepDive `Custom Report` subsection production-ready.

This tracker exists so Custom Report follows the same connected-source aggregate pattern as:

- Performance Summary
- Budget & Financial Analysis
- Platform Comparison
- Trend Analysis
- Executive Summary

## Current Status

Production-ready as a Campaign DeepDive connected-source aggregate consumer for the implemented source contract.

Custom Report is still opened through the Reports builder, but Campaign DeepDive now preserves campaign context with `/reports?campaignId=<campaignId>`. Campaign-scoped Custom Reports read the shared connected-source aggregate, expose only available metrics, render saved report outputs from live aggregate-backed values, and keep All Reports cards as summary-only cards with edit, download, and confirmed delete actions.

## Required Product Rule

Connected Platforms is the source of truth.

Custom Report must use metrics from the campaign's connected main sources only. If only Google Analytics is connected, Custom Report should expose and render only GA4-supported web analytics and outcome metrics. Paid-media metrics must remain unavailable unless a main paid-media Connected Platform supplies them.

## Original Root Cause

1. The Campaign DeepDive `Custom Report` launcher originally linked to `/reports`, which is a standalone reports route, not a campaign-scoped connected-source report builder by default.
2. Existing report builders are platform-specific:
   - GA4 reports use GA4-specific report inputs.
   - LinkedIn reports use LinkedIn-specific hardcoded metric lists.
   - Some standalone report UI uses local/mock report storage.
3. Custom Report metric selection is not currently driven by the shared connected-source aggregate contract.
4. Selected report metrics can include metrics unavailable from the campaign's connected sources.
5. Some report output paths can fall back to `0`, `N/A`, or platform defaults instead of excluding unavailable metrics or explaining why they are unavailable.

## Source-Of-Truth Contract

Custom Report should consume the same shared aggregate used by the other Campaign DeepDive subsections:

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
- pageviews, where available
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

- [x] Completed locally: saved campaign-scoped Custom Reports render selected metric values from `performanceSummary.totals`.
- [x] Completed locally: unavailable saved metrics are marked unavailable with aggregate reasons instead of rendering as `0`.
- [x] Completed locally: report cards only render aggregate-backed Custom Report values for the active campaign context.
- [x] User validation passed on 2026-05-28: saved Custom Report card shows connected-source report values.

### Commit 5: KPI, Benchmark, And Section Mapping

Goal:

- Make Custom Report sections align with campaign-level analytics.

Tasks:

- KPI and Benchmark report sections should use campaign records for rows/targets.
- Current KPI/Benchmark values should come from aggregate-backed available metrics where mapped.
- Unmapped or unavailable current values should not silently fall back to stale saved values.
- Custom sections should remain section-composition based.

Validation:

- KPI/Benchmark rows update after campaign KPI/Benchmark changes and refetch.
- Current values match the connected-source aggregate where available.

Status:

- [x] Completed locally: Custom Report can save section composition for selected metrics, campaign KPI rows, and campaign Benchmark rows.
- [x] Completed locally: campaign KPI rows are fetched from `/api/campaigns/:campaignId/kpis`.
- [x] Completed locally: campaign Benchmark rows are fetched from `/api/campaigns/:campaignId/benchmarks`.
- [x] Completed locally: KPI/Benchmark current values render from `performanceSummary.totals` when mapped and available.
- [x] Completed locally: unmapped or unavailable KPI/Benchmark current values render as `Unavailable` instead of using saved `currentValue`.
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
- [x] Completed locally: the old `Templates` tab is now `Standard Reports`; generated/downloaded reports appear there and scheduled reports appear under `Scheduled Reports`.
- [x] Completed locally: report tabs are ordered `Standard Reports`, `Scheduled Reports`, `All Reports`; Standard Reports is the default tab and its download action is labeled `Download latest report`.
- [x] Completed locally: `Download latest report` refetches the report card's campaign connected-source aggregate, Executive Summary context, campaign budget context, KPIs, and Benchmarks before building the PDF, so saved report cards regenerate from current selected report inputs instead of stale page cache.
- [x] Completed locally: campaign-scoped Custom Report creation exposes Campaign DeepDive subsection report types and lets users choose which tabs from the selected subsection to include; the standalone `/reports` route keeps its broader report type options when reached directly.
- [x] Completed locally: generated report cards no longer show the `Generated` status pill.
- [x] Completed locally: report delete icons open the shared website-style confirmation dialog before deleting the stored report.
- [x] Completed locally: Scheduled Reports no longer renders hard-coded demo scheduled cards with nonfunctional delete buttons; the tab shows stored scheduled report records that use the shared confirmed delete path.
- [x] Completed locally: Scheduled Reports shows a `No scheduled reports yet` empty state when no scheduled report records exist.
- [x] Completed locally: Scheduled Reports cards no longer show the `Scheduled` status pill or settings icon, and their `Edit` action opens the report dialog with saved values prefilled.
- [x] Completed locally: Scheduled Reports card `Data Included` lists the selected report tabs from `selectedSections` instead of legacy KPI/Benchmark flags.
- [x] Completed locally: Scheduled Reports card `Pause` disables the backend schedule with backend status `paused`, marks the local card as paused, keeps the report visible in Scheduled Reports, and changes the card action to `Resume` so users can re-enable the saved backend schedule. Scheduled cards do not show a separate Status field; the action label shows whether the schedule can be paused or resumed. Scheduled cards also expose `Download latest report` backed by the same latest-value PDF regeneration path.
- [x] Completed locally: Pause/Resume is intentionally limited to Scheduled Reports because it temporarily stops or restarts recurring email delivery without forcing users to delete and recreate the saved report setup.
- [x] Completed locally: `Campaign connected-source data` lists connected source names as bullets and no longer displays internal selectable metric keys.
- [x] Completed locally: Executive Summary `Executive Overview` PDF exports include the same major section set as the web tab: 7-Day Snapshot Trajectory, Risk Level, Executive Summary, Marketing Funnel Performance, KPI Progress, Benchmark Comparison, and Risk Assessment.
- [x] Completed locally: Executive Summary `Strategic Recommendations` PDF exports include the same major section set as the web tab: data accuracy notice, data freshness alert, enterprise disclaimer, recommendation content, expected impact, timeframe, investment required, projected scenarios, key assumptions, and recommendation disclaimer where those inputs are present.
- [x] Completed locally: Performance Summary PDF exports include the same major section set as the web tabs: Overview exports Campaign Health, Top Priority Action, and Aggregated Metrics Snapshot; Campaign Health exports Overall Health Summary, KPI/Benchmark summaries, KPI rows, Benchmark rows, and Data Sources; What's Changed exports What's Changed and Metric Trends; Insights exports Data-Driven Insights & Recommendations, Top Priority Action, and Performance Analysis.
- [x] Completed locally: Budget & Financial Analysis PDF exports include the same nested web-tab section/card/row set: Overview exports Conversion Value warning when applicable, Campaign Health Score score/rating/input rows, Key Financial Metrics, Budget Utilization, Budget Pacing & Burn Rate rows, and Cost Efficiency Metrics; ROI & ROAS exports ROAS/ROI cards, source performance, and financial input rows; Cost Analysis exports cost metrics, efficiency indicators, and sources; Budget Allocation exports performance tiers, source budget analysis rows, and allocation guidance; Insights exports performance summary, cost efficiency, budget management, source performance, key opportunities, budget optimization, and cost optimization rows.
- [x] Completed locally: Platform Comparison PDF exports include the same major web-tab section set: Overview exports Platform Performance Summary Cards, Channel Performance Overview, Revenue Tracking Platforms, and Total Revenue; Performance Metrics exports Detailed Performance Metrics, Efficiency Comparison, and Volume Comparison; Financial Comparison exports Cost per Conversion, Budget Allocation, ROI/ROAS, or the no-paid-media state; Insights exports Platform Performance Insights, source availability, paid-media comparison availability, comparison insight headings, and Strategic Recommendations where those inputs exist.
- [x] User validation passed on 2026-05-28: All Reports cards show summary-only layout without connected-source detail previews.

Current campaign-scoped Report Type menu:

- `Performance Summary`: `Overview`, `Campaign Health`, `What's Changed`, `Insights`
- `Budget & Financial Analysis`: `Overview`, `ROI & ROAS`, `Cost Analysis`, `Budget Allocation`, `Insights`
- `Platform Comparison`: `Overview`, `Performance Metrics`, `Financial Comparison`, `Insights`
- `Trend Analysis`: `Overview`, `Efficiency Metrics`, `Conversion Funnel`, `Platform Breakdown`, `Insights`
- `Executive Summary`: `Executive Overview`, `Strategic Recommendations`

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
- it uses the shared connected-source aggregate contract
- metric selection is based on available connected-source metrics
- report output renders only available metrics
- unavailable metrics are omitted or clearly explained
- KPI/Benchmark sections use live aggregate-backed current values
- saved report configuration cannot reintroduce disconnected-source metrics
- All Reports cards remain summary-only and do not expose connected-source values, KPI/Benchmark rows, generated status pills, or `Includes` configuration details inline
- All Reports cards must show only the edit icon, `Download latest report`, and the delete icon; Pause/Resume belongs only in Scheduled Reports
- All Reports filters should include Search, Report Type, and Date Range; redundant Campaign and Status dropdowns should not render
- Report cards show saved descriptions when available and do not show redundant `Format: PDF` metadata
- All Reports card edit icons open the report dialog with saved values prefilled, show `Update Report`, and keep update disabled until a change is made
- Create/edit report descriptions are capped at 160 characters
- report delete icons open a confirmation dialog before removing the stored report record
- Scheduled Reports must render stored scheduled report records, not hard-coded demo cards, so delete operates on a real report ID
- Scheduled Reports must show a clear empty state when there are no scheduled report records
- Scheduled Reports cards must keep edit wired to `openEditReport(report)` and should not show redundant `Scheduled` status pills or settings icons
- Scheduled Reports card `Data Included` must show selected tab labels from the saved `selectedSections` report composition
- Scheduled Reports card `Pause` must disable the backend schedule where a backend report ID exists, mark the local card as paused, keep the report visible in Scheduled Reports, avoid a separate visible Status field, and provide `Resume` for paused cards so the saved schedule can be re-enabled
- Pause/Resume is required only for recurring scheduled delivery; it should not appear in All Reports because All Reports is a library view, not the schedule-control surface
- Scheduled Reports card `Download latest report` must regenerate from latest connected-source values for the saved report type, selected tabs, and selected metrics
- The top-level `Create Report` action opens an empty create form, clears report type, selected tabs, custom metric selections, and edit mode
- Unscheduled create mode shows `Download Report` and downloads the selected report sections as a PDF
- Downloaded PDFs render the selected tab bodies from `performanceSummary.totals` and `performanceSummary.sources` where those aggregate inputs are available
- Downloaded Executive Summary `Executive Overview` PDFs include the same major executive sections shown in the web tab, using `/executive-summary` for trajectory/risk/KPI/Benchmark context and `/outcome-totals.performanceSummary` for current connected-source metric values
- Downloaded Executive Summary `Strategic Recommendations` PDFs include the same major recommendation sections shown in the web tab, using `/executive-summary.recommendations`, metadata, freshness warnings, assumptions, scenarios, and recommendation disclaimers
- Downloaded Performance Summary PDFs include the same major sections shown in the selected Performance Summary web tabs, using `/outcome-totals.performanceSummary` for current connected-source values and campaign KPI/Benchmark records for health rows
- Downloaded Budget & Financial Analysis PDFs include the same nested sections, cards, and row labels shown in the selected Budget & Financial web tabs, using `/outcome-totals.performanceSummary` for connected-source financial totals/source availability and the campaign row for budget/start/end pacing inputs
- Downloaded Platform Comparison PDFs include the same major sections shown in the selected Platform Comparison web tabs, using `/outcome-totals.performanceSummary.sources` for connected-source rows and source capability gating for paid-media-only comparison sections
- Downloaded Trend Analysis PDFs include the same major sections shown in the selected Trend Analysis web tabs, using `/trend-analysis` source-aware daily aggregates for trend windows, efficiency, funnel, platform breakdown, and insights
- `Download latest report` must refetch `/outcome-totals`, `/executive-summary`, `/trend-analysis` when Trend Analysis tabs are selected, campaign context, KPIs, and Benchmarks for the report card's campaign before PDF generation, then use those refetched values immediately
- Scheduled create mode uses `Schedule Automated Report`, defaults to `Daily`, and shows `Schedule Report` in the same filled primary button style as `Download Report`
- Monthly schedule mode must show day-of-month choices: 1st day, 15th day, or last day of month
- Quarterly schedule mode must show timing choices: start of quarter or end of quarter
- Schedule form must create a backend scheduled report record with `scheduleTimeZone`, `scheduleTime`, recipients, saved report type, and selected tabs so `server/report-scheduler.ts` can send the report like platform-level scheduled reports
- Campaign-scoped Custom Report creation exposes Campaign DeepDive subsection report types in this order: `Performance Summary`, `Budget & Financial Analysis`, `Platform Comparison`, `Trend Analysis`, and `Executive Summary`
- Selecting a Campaign DeepDive subsection exposes that subsection's current tab list as report composition checkboxes and saves those tab keys in `selectedSections`
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

- [x] Add dedicated Trend Analysis PDF parity so selected Trend Analysis tabs export real section content instead of relying on generic fallback output.
- [x] Make scheduled Campaign DeepDive PDFs include selected section body content from latest campaign data, not only report metadata and selected section names.
- [x] Add regression coverage proving every Campaign DeepDive report type has a dedicated renderer, including Trend Analysis.
- [x] Add regression coverage proving scheduled Campaign DeepDive PDFs include selected section body content, not just selected section names.

Scheduling delivery status:

- [x] Campaign DeepDive Custom Report scheduled creates/updates/deletes now write through `/api/platforms/campaign_deepdive/reports`, persist `scheduleTimeZone`, `scheduleTime`, recipients, and saved report composition, and are picked up by `server/report-scheduler.ts`.
- [x] The scheduler has a `campaign_deepdive` PDF attachment path so scheduled Custom Report emails do not use the old browser-only path.
- [x] Scheduled Campaign DeepDive PDF attachments now render selected section body content from the scheduler's latest campaign aggregate, KPI rows, Benchmark rows, campaign context, and trend snapshot inputs instead of only listing selected tab names.
- [ ] Deployed email-delivery evidence must still be recorded after a real scheduled send, because provider acceptance and inbox receipt depend on runtime email infrastructure.

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
- Create Report reset fix added on 2026-05-28: top-level create opens a fresh empty form after prior edits.
- Create Report action split added on 2026-05-28: unscheduled create mode downloads the selected sections, while scheduled create mode saves with `Schedule Automated Report` and `Schedule Report`.
- Download Report content fix added on 2026-05-28 and pushed in commit `ec6f9234`: Campaign DeepDive subsection exports now print selected tab bodies from the connected-source aggregate instead of only listing selected tab names.
- Report Type composition updated on 2026-05-28 and pushed in commit `f8dfeee0`: Campaign DeepDive Custom Report creation exposes Campaign DeepDive subsection report types and saves selected subsection tabs; the standalone `/reports` route keeps broader report-type choices when reached directly.
- Commit 7 documentation updated on 2026-05-28.
- Report delete confirmation and connected-source source-list cleanup added on 2026-05-29.
- Executive Summary `Executive Overview` PDF section parity fix added on 2026-05-29.
- Executive Summary `Strategic Recommendations` PDF section parity fix added on 2026-05-29.
- Performance Summary PDF section parity fix added on 2026-05-29.
- Budget & Financial Analysis PDF section parity fix added on 2026-05-29 and expanded to include nested card/row parity for Campaign Health Score, Budget Pacing & Burn Rate, source performance, allocation, and insight sections.
- Platform Comparison PDF section parity fix added on 2026-05-29: selected Platform Comparison tabs now export the matching web-tab section structure instead of the generic DeepDive metric-list fallback.
- Trend Analysis PDF section parity fix added on 2026-05-30: selected Trend Analysis tabs now export dedicated Overview, Efficiency Metrics, Conversion Funnel, Platform Breakdown, and Insights section content from the source-aware trend aggregate instead of generic fallback output.
- Scheduled Campaign DeepDive PDF body-content fix added on 2026-05-30: scheduled email attachments now include selected tab body sections from latest server-side campaign aggregate inputs, KPI rows, Benchmark rows, campaign context, and trend snapshot inputs instead of only report metadata and selected tab names.
- Local validation passed on 2026-05-30 for scheduled Campaign DeepDive PDF body content: `npm test -- server/custom-report-regression.test.ts`, `npm run check`, `git diff --check`, and `npm run build`.
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
