# Campaign DeepDive Trend Analysis Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Trend Analysis` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped main data sources are attached.
- `Trend Analysis` uses only metrics currently available from those connected main sources.
- If only GA4 is connected, Trend Analysis uses only GA4-capable trend metrics.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, TikTok, Instagram, and future integrations are connected, their available time-series metrics must be automatically included in Trend Analysis without double-counting.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready view of how campaign metrics change over time, not another platform-specific drilldown.

## Current Certified Boundary — 2026-08-26

Status: **PRODUCTION_READY for the exact deployed GA4-only Campaign DeepDive Trend boundary at `cd35bba1c4ff4bb0b045c3bc6c176f2847cd80eb`.**

This certification is limited to:

- the audited `ga4_mock` GA4-only campaign and its saved property/filter/source configuration
- the authoritative cumulative GA4 window `2026-07-02` through `2026-08-25`
- campaign reporting timezone `Europe/Amsterdam`
- the single visible Trend Analysis Executive View
- all `7/14/30/90-day` selector options
- browser Trend report generation and the scheduled/server Trend PDF content builder
- persisted GA4 daily rows, financial source records, exact-date comparison behavior, snapshots, and downstream report consumers traced in the audit

It does not certify:

- future or different GA4 properties, campaign filters, currencies, or source configurations without their own parity evidence
- multi-source Trend behavior for a source that has not passed its own source-specific readiness gate
- provider or inbox delivery of a future scheduled Custom Report email; that transport gate remains in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
- protected GA4 Overview, KPI, Benchmark, Ad Comparison, Insights, Reports, or machine certification records; none were changed by this Trend work

### Current Visible Implementation

Trend Analysis renders one comprehensive view. The retired tab navigation is not visible. The mounted view contains:

- exact current decision cards
- `Campaign Performance Trend`
- `Efficiency Trends`
- `Website Engagement & Conversion Summary`
- `Paid Acquisition Funnel` only when a paid-media main source supplies the required inputs
- `Source Contribution` only when more than one main source is available
- anomaly context when enough compatible daily history exists
- `Executive Recommendations`

Legacy tab panels remain unmounted in `client/src/pages/trend-analysis.tsx` for contract-safe cleanup. They do not supply visible values or report composition. The current Reports UI exposes only `trend-analysis:overview`, labelled `Executive View`.

### GA4 Dependency And One-Way Data-Flow Contract

Trend Analysis does not copy displayed values or calculations from GA4 UI tabs. It follows the Campaign DeepDive dependency rule in `ARCHITECTURE_USER_JOURNEY.md` by consuming the same authoritative persisted source records and shared campaign aggregate used by those tabs.

| GA4 area | Relationship to Trend Analysis |
| --- | --- |
| Overview | Trend Analysis uses the same campaign/property-scoped GA4 records and compatible campaign financial aggregate. The Overview UI is a parallel consumer, not an input. |
| KPIs | Valid campaign-scoped GA4 Revenue and ROAS targets may appear as optional chart reference lines. KPI current values never replace authoritative Trend base metrics. |
| Benchmarks | Not an input to Trend Analysis. |
| Ad Comparison | Not an input to Trend Analysis. Both may use the same underlying GA4 records within their own documented contracts. |
| Insights | Not an input to Trend Analysis. Trend recommendations are derived independently from the current Trend view's available signals. |
| Reports | A downstream output consumer of Trend Analysis. Reports never supply Trend calculations or current values. |

This one-way pattern applies to every Campaign DeepDive subsection: persisted connected-source records feed documented calculations and the shared campaign aggregate, which feed Campaign DeepDive consumers. Derived platform tabs and report outputs must not become upstream sources for Campaign DeepDive base metrics.

### Current Value And Formula Contract

For the certified GA4-only consumer:

- `Sessions`, `Users`, `Conversions`, and `Engaged Sessions` come from the campaign/property-scoped persisted GA4 daily response and its `overviewTotals`.
- These traffic totals accumulate from the fixed initial-import date through the latest completed reporting day; they are not rolling `7/14/30/90-day` totals.
- `CVR = Conversions / Sessions * 100`.
- `Engagement Rate = Engaged Sessions / Sessions * 100`.
- `Revenue`, `Spend`, `ROAS`, `ROI`, and `CPA` come from `/outcome-totals.performanceSummary` only when the metric is available, has source provenance, and passes the cumulative-window compatibility checks.
- `ROAS = Revenue / Spend`.
- `ROI = (Revenue - Spend) / Spend * 100`.
- `CPA = Spend / the financial conversion input published by the shared performance summary`; it is not silently relabelled as GA4 traffic conversions when those denominators differ.
- Currency comes from the campaign currency and exact financial comparisons require the same currency.

### Selector And Comparison Contract

The `Trend & comparison window` selector accepts `7`, `14`, `30`, and `90` days.

- It controls the Campaign Performance and Efficiency chart calendar window.
- It sets the exact historical comparison date to `dataThroughDate - selected days`.
- It does not change the cumulative current traffic totals or campaign-to-date financial totals.
- Count comparisons show the exact absolute difference and percentage difference.
- Rate comparisons show percentage-point change.
- Cumulative comparisons use neutral presentation because cumulative totals naturally increase.
- A comparison appears only when the exact historical value is reconstructable from compatible persisted rows or an exact compatible financial snapshot.
- Missing, partial, mismatched-property, mismatched-window, mismatched-timezone, mismatched-currency, duplicate-date, provider-warning, or unavailable exact historical data fails closed.
- The current cumulative value is never reused as a historical fallback.

### Daily Charts And Missing Data

- Charts use actual persisted daily rows inside the exact selected calendar dates.
- Missing dates remain gaps; lines do not connect across missing dates.
- Chart animation is disabled so a stale/placeholder chart does not transform after load.
- All selector options remain selectable. If the campaign does not yet cover the full requested calendar window, the page explains the available boundary. If the window exists but has no daily activity rows, it shows the exact empty date range and latest recorded date.
- Efficiency charts render only when their required daily inputs exist. Current financial cards can remain available while daily return/cost trend charts are withheld.

### Current GA4-Only Website Summary

- `Sessions`, `Engaged Sessions`, and `Conversions` are exact cumulative counts.
- `Engagement rate` and `Conversions per 100 sessions` use the same cumulative numerator/denominator set.
- The section is a cumulative website engagement/conversion summary, not a claim that Sessions, Engaged Sessions, and Conversions are sequentially attributed funnel stages.

### Executive Recommendation Contract

- Recommendations are contextual guidance derived from the available current, exact-comparison, efficiency, and conversion signals.
- The selected-window comparison card changes with the selector.
- Campaign-to-date ROAS and conversion-volume guidance stays labelled as campaign-to-date/cumulative context.
- Recommendations do not claim causality, automatic improvement, or permission to change spend without business targets and source context.

### Report, Snapshot, And Scheduler Contract

- Browser and scheduled report composition exposes one Trend section: `trend-analysis:overview` / `Executive View`.
- Any legacy saved `trend-analysis:*` selections normalize to that one section and duplicates are removed.
- Browser and scheduled Trend PDFs use exact calendar dates rather than splitting sparse rows by record count.
- The report summary uses a current 90-day calendar window, clamped to the saved GA4 initial-import date and latest completed reporting day.
- Scheduler snapshots retain `metrics.trendAnalysis.version = trend_analysis_aggregate_v1`; incompatible legacy snapshots remain ineligible for comparison.
- Trend queries refetch while the page is visible and on window focus, so the next successful daily scheduler refresh propagates through the existing stored-data path without a separate Trend write path.

### Validation Evidence

- deployed health returned exact SHA `cd35bba1c4ff4bb0b045c3bc6c176f2847cd80eb`
- authenticated read-only parity passed for every visible section and all four selector options
- actual persisted-record parity at validation returned Revenue `72766.69`, Spend `2699.75`, Sessions `1183`, Users `1184`, Conversions `152`, and Engaged Sessions `809`; derived ROAS, ROI, CPA, CVR, and Engagement Rate matched the formulas above
- the natural `22:00 UTC` scheduler refreshed the target campaign successfully; 17 failures were read-only classified as mock/test campaigns outside this boundary
- the active production inventory contained no saved Trend report or Trend snapshot artifact requiring cleanup
- the exact browser/scheduled PDF builder was exercised read-only against production records and returned the authoritative Sessions `1183`, Users `1184`, and Conversions `152` inside the certified cumulative boundary
- deployed Reports bundle inspection confirmed one selectable `Executive View` and legacy selection normalization
- focused tests passed: `server/custom-report-regression.test.ts`, `server/trend-analysis-overview-regression.test.ts`, `server/trend-analysis-window-regression.test.ts`, and `server/trend-analysis-aggregate.test.ts` — `56/56`
- `npm run check` and `npm run build` passed
- no production data was mutated by the certification packet

Stable future answer: Trend Analysis is production-ready only for this exact deployed GA4-only boundary. New main sources or a changed relevant implementation require source-specific parity and a renewed affected-boundary review.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Trend Analysis` = campaign-level time-series analysis based on connected-source data.

Do not turn Trend Analysis into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable metrics for sources that do not provide them.
Do not display platform child revenue/spend inputs as separate main platforms.
Do not compare incompatible historical snapshots or daily rows.

## Historical Root Cause — Resolved

Before the source-aware aggregate and cumulative-consumer corrections, `client/src/pages/trend-analysis.tsx` performed page-local aggregation from separate hardcoded daily endpoints.

Historical implementation issues fixed by the commits recorded below:

- It fetches GA4, LinkedIn, Meta, Google Ads, and financial daily endpoints directly instead of using a shared connected-source trend aggregate.
- It fetches `connectedPlatforms` but does not use it as the source-of-truth filter.
- It hardcodes platform prefixes such as `ga4_*`, `li_*`, `meta_*`, and `gads_*`.
- It can fetch disconnected platform endpoints and silently treat missing responses as empty data.
- It builds `platformTotals` only for LinkedIn, Meta, and Google Ads, so GA4 is not represented as a main source in the platform breakdown.
- It mixes paid-media metrics and GA4 web analytics metrics in one local merge instead of capability-gating each metric by source.
- It calls `/api/campaigns/:id/daily-financials` with `days`, while the server route expects `start` and `end`, so financial time-series data can fail before reaching the UI.
- It does not use the shared aggregate/source-capability contract already used by Performance Summary, Budget & Financial Analysis, and Platform Comparison.

The issue is an aggregation contract problem, not a single-chart display bug.

## Existing Relevant Paths

- `client/src/pages/trend-analysis.tsx`
  - Current Trend Analysis page and tab UI.
  - Performs local source fetches, daily merging, derived metrics, platform totals, and chart rendering.

- `client/src/pages/campaign-detail.tsx`
  - Campaign DeepDive launcher.
  - Links to the Trend Analysis subsection.

- `client/src/pages/campaign-performance.tsx`
  - Performance Summary page.
  - Uses `/api/campaigns/:id/outcome-totals` and `performanceSummary` as the source-aware aggregate model.

- `client/src/pages/financial-analysis.tsx`
  - Budget & Financial Analysis page.
  - Uses the shared aggregate contract for current financial and source-aware values.

- `client/src/pages/platform-comparison.tsx`
  - Platform Comparison page.
  - Uses the shared aggregate contract for main connected-source comparison.

- `server/routes-oauth.ts`
  - Contains current daily source endpoints for GA4, LinkedIn, Meta, Google Ads, daily financials, Google Trends, and snapshots.
  - Contains `/api/campaigns/:id/outcome-totals`.

- `server/utils/performance-summary-aggregate.ts`
  - Current connected-source aggregate helper for current values.
  - Should be reused or extended only where it fits the existing architecture.

- `server/scheduler.ts`
  - Scheduler snapshots must align with the same aggregate model used by Campaign DeepDive sections.

## Production-Ready Target Contract — Achieved

Trend Analysis consumes one campaign-level source-aware trend contract, with the certified GA4-only cumulative consumer layered on the same campaign-scoped inputs.

The implementation reuses the Performance Summary aggregate contract pattern and composes a trend-specific daily aggregate model that follows the same source identity and capability rules.

The contract should provide:

- campaign ID and date range
- connected main sources included in the trend aggregate
- source capabilities
- included metrics
- excluded metrics with reasons
- source freshness metadata
- daily metric rows by source
- aggregate daily totals
- derived daily metrics only when required inputs exist
- unavailable reasons for metrics that cannot be calculated
- historical compatibility metadata for trend comparisons

Implemented architecture:

- Keep API composition in `server/routes-oauth.ts`.
- Keep persistence reads in `server/storage.ts`.
- Reuse the existing connected-source aggregate helper concepts for source identity, capabilities, included metrics, excluded reasons, and child input handling.
- Add only the smallest trend-specific helper if daily series cannot safely fit inside the current value aggregate.
- Keep tab rendering in `client/src/pages/trend-analysis.tsx`.
- Remove hardcoded disconnected-platform assumptions from the frontend once the source-aware trend aggregate exists.

## Source Capability Rules

### GA4

Available when connected and campaign-scoped:

- users
- sessions
- conversions
- engagement rate where already supported
- conversion rate where already supported
- revenue as the GA4 platform total shown in `View Detailed Analytics`, including valid child revenue inputs configured inside GA4

Not available:

- ad impressions
- ad clicks
- ad spend
- CPC
- CPM
- CTR
- paid-media CPA from GA4 alone unless spend is available from the campaign financial path

GA4 should appear as a web analytics source, not as a paid-media source.

### Paid Media Sources

Examples:

- LinkedIn Ads
- Meta Ads
- Google Ads
- future TikTok/Instagram ad sources

Available when provided by that source:

- impressions
- clicks
- spend
- conversions
- attributed revenue
- CTR
- CPC
- CPM
- CPA
- ROAS/ROI when both spend and revenue are available

Not available:

- sessions/users unless explicitly provided as web analytics metrics

Google Ads revenue-specific rule:

- Google Ads `revenue` and `attributedRevenue` in Trend Analysis must come only from active Google Ads-scoped imported revenue records.
- Native Google Ads `conversionValue` and GA4-matched revenue may remain available as separate diagnostic fields, but they must not feed Trend Analysis `revenue`, `attributedRevenue`, ROAS, or ROI.

### Custom Integration

Available only for metrics included in the source's aggregate capabilities.

Do not assume Custom Integration has spend, clicks, revenue, users, sessions, or daily rows unless the aggregate says those metrics are included.

### Platform Child Revenue/Spend Inputs

Examples:

- HubSpot inside GA4
- Salesforce inside GA4
- Shopify inside GA4
- CSV revenue/spend imports inside GA4
- Google Sheets revenue/spend imports inside GA4
- LinkedIn or Meta spend imported inside GA4

Rules:

- may feed campaign financial totals through the parent platform/campaign financial path
- must not appear as separate main platforms in Trend Analysis
- may be referenced only as provenance if a future UI section explicitly displays financial inputs
- do not make LinkedIn Ads, Meta Ads, or another ad platform eligible for source-level Trend Analysis unless that ad platform is connected as its own main Connected Platform

## Historical Multi-Tab Implementation Plan — Superseded

Commits 1 through 7 below record how the aggregate-backed sections were originally introduced. The current product mounts those capabilities together in the single Executive View documented above; the old tab navigation and report composition are retired.

### Commit 1: Trend Aggregate Contract

- Add or compose a source-aware daily trend aggregate.
- Include only main Connected Platforms from the campaign source registry/aggregate contract.
- Preserve child revenue/spend inputs as parent-platform financial contributors, not separate platforms.
- Return daily rows, source capabilities, included metrics, unavailable reasons, and aggregate daily totals.
- Add regression coverage proving GA4-only returns GA4 daily metrics only and no disconnected paid-media rows.

Status: completed.

Root cause fixed:

- Trend Analysis had no server-side source-aware trend contract; the page was forced to merge hardcoded platform daily endpoints locally.
- Commit 1 adds a read-only `/api/campaigns/:id/trend-analysis` aggregate endpoint plus `server/utils/trend-analysis-aggregate.ts`.
- The contract returns `trend_analysis_aggregate_v1`, connected main sources, source capabilities, included/excluded metrics, source daily rows, aggregate daily totals, and unavailable metric source metadata.
- GA4, LinkedIn, Meta, Google Ads, and Custom Integration are represented as main sources only when connected.
- Financial child inputs can contribute canonical daily spend/revenue totals without appearing as separate main platform rows.

Files changed:

- `server/utils/trend-analysis-aggregate.ts`
- `server/routes-oauth.ts`
- `server/trend-analysis-aggregate.test.ts`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts`
- `npm run check`
- Render/API validation passed by user after deployment.

Evidence:

- Regression coverage proves GA4-only returns only the GA4 main source, disconnected paid-media rows are excluded, canonical financial spend can feed totals without creating child platform rows, and connected paid-media daily rows aggregate by source capability.

### Commit 2: Overview

- Wire the Overview tab to the source-aware trend aggregate.
- Show only metrics available from connected sources.
- For GA4-only campaigns, show GA4 trend metrics such as sessions, users, conversions, conversion rate, engagement rate, and revenue where available.
- Keep ad spend, impressions, clicks, CTR, CPC, CPM, and paid CPA unavailable unless a connected source provides the required inputs.
- Prevent transient empty or demo content from flashing before the aggregate loads.

Status: completed.

Root cause fixed:

- The Overview tab still rendered from the legacy `crossPlatformData` object, which is built by hardcoded frontend merges of GA4, LinkedIn, Meta, Google Ads, and daily financial endpoints.
- Commit 2 adds a source-aware Trend Analysis query to the page and wires only the Overview tab to `trend_analysis_aggregate_v1`.
- The Overview tab now builds summary cards, metric toggles, chart series, and anomaly inputs from the connected-source trend aggregate.
- GA4-only campaigns show GA4-capable metrics such as sessions, users, conversions, revenue, CVR, and engagement rate when available.
- Paid-media metrics such as impressions, clicks, CTR, CPA, ROAS, and spend only appear when the aggregate reports the required connected-source inputs.
- The Overview tab no longer shows the old disconnected-platform empty state while the aggregate is loading.

Files changed:

- `client/src/pages/trend-analysis.tsx`
- `server/trend-analysis-overview-regression.test.ts`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm run check`

Evidence:

- Regression coverage proves the Overview tab fetches `/api/campaigns/:id/trend-analysis`, uses `overviewTrendData.availableSeries`, renders GA4-capable series such as sessions/users/revenue, and no longer references `crossPlatformData` in the Overview tab.

Manual Render validation guidance:

- If the GA4 mock campaign was created or viewed with a 90-day scope, use `Last 90 Days` when comparing Trend Analysis Overview values against the GA4 platform Summary values.
- Use `Last 30 Days` only when validating the 30-day Trend Analysis window.
- `Last 30 Days` requests 60 days from the aggregate endpoint so the UI has a current 30-day window plus a previous 30-day comparison window when enough rows exist.
- `Last 7 Days` is acceptable for a quick smoke test, but it provides less history and is more sensitive to missing daily rows.
- `Last 90 Days` requests 180 days from the aggregate endpoint, but the current GA4 mock simulator returns the current 90-day mock range. That is valid for current 90-day totals, but it may not show previous-period comparison percentages until enough compatible history exists.
- With GA4 mock-placeholder data, validate source-aware logic only: the request succeeds, the source list contains GA4 only, GA4-capable metrics appear, paid-media-only metrics remain hidden unless available, and the selected dropdown changes the `dateRange`/`days` request.
- Historical Commit 2 boundary: mock-placeholder values were not final numeric proof. This gate is closed for the exact GA4-only boundary by the 2026-08-26 persisted-record parity above.
- Commit 2 follow-up fix: Trend Analysis now uses the same deterministic GA4 mock simulation path for `yesop` mock properties as the GA4 platform daily route, then overlays persisted daily rows. This prevents the Overview tab from showing unrelated persisted-only mock rows when the source GA4 page is using simulated mock data.
- Commit 2 follow-up fix: GA4 engagement rate is normalized before display, so decimal rates such as `0.6` display as `60%`, not `0.6%`.
- Commit 2 follow-up fix: Overview no longer treats partial historical rows as a complete comparison window. Current values can render from the available daily rows, but comparison percentages appear only after a complete previous window exists for the selected period. If the current selected window is partial, the UI shows how many daily rows are available and explains that full-period comparisons require more history.
- Commit 2 verification fix: the `yesop` mock GA4 path now requests enough simulated daily rows for the selected Overview comparison window where the simulator supports it. `Last 7 Days` and `Last 14 Days` use a 30-day simulated baseline, `Last 30 Days` uses the 60-day simulated baseline, and `Last 90 Days` uses the 90-day baseline because no 180-day simulator range exists yet.

### Commit 3: Efficiency Metrics

- Wire efficiency charts and summary cards to source capabilities.
- Calculate ROAS, ROI, CPA, CPC, CPM, CTR, CVR, and engagement rate only when required numerator and denominator inputs exist.
- Explain unavailable metrics clearly rather than showing zero or misleading comparisons.
- Keep GA4 analytics efficiency separate from paid-media cost efficiency.

Status: completed.

Root cause fixed:

- The Efficiency Metrics tab still rendered from the legacy `crossPlatformData` frontend merge, which hardcoded GA4, LinkedIn, Meta, Google Ads, and financial daily endpoints.
- That legacy merge calculated unavailable derived metrics as zero, so GA4-only campaigns could show fake ROAS, CPA, CPC, CPM, or CTR trend values instead of capability-gated values.
- Commit 3 adds an aggregate-backed `efficiencyTrendData` model and wires only the Efficiency Metrics tab to the `trend_analysis_aggregate_v1` daily totals.
- ROAS, ROI, CPA, CPC, CPM, CTR, CVR, and engagement rate now render only when the aggregate has the required inputs.
- Unavailable efficiency metric groups explain which inputs are missing instead of showing zero-valued charts.
- Efficiency current values can render from available daily rows, but comparison percentages require a complete previous window and the UI now discloses when the selected current window is partial.

Files changed:

- `client/src/pages/trend-analysis.tsx`
- `server/trend-analysis-overview-regression.test.ts`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm run check`

Evidence:

- Regression coverage proves the Efficiency Metrics tab uses `efficiencyTrendData`, consumes derived aggregate metrics such as ROAS, ROI, CPA, and normalized engagement rate, explains unavailable inputs, and no longer references `crossPlatformData`.
- Historical Commit 3 boundary: full-period efficiency evidence was still pending. This gate is closed for the exact GA4-only boundary by the current exact-calendar parity evidence.

### Commit 4: Conversion Funnel

- Split the funnel into capability-aware sections:
  - web analytics funnel for GA4 sessions, users, conversions, conversion rate, and engagement metrics
  - paid-media funnel for impressions, clicks, spend, conversions, CTR, CPC, CPM, CPA, and ROAS where connected paid-media sources provide them
- For GA4-only campaigns, do not display paid-media funnel stages as if GA4 provided impressions or clicks.
- Add regression coverage for GA4-only and paid-media-connected cases.

Status: completed.

Root cause fixed:

- The Conversion Funnel tab still rendered from the legacy frontend `crossPlatformData` merge.
- That legacy path mixed paid-media funnel stages with GA4 web analytics and could show unavailable paid-media metrics as zero for GA4-only campaigns.
- Commit 4 adds an aggregate-backed `conversionFunnelData` model and wires only the Conversion Funnel tab to `trend_analysis_aggregate_v1`.
- GA4-capable web funnel metrics now render in a separate Web Analytics Funnel section.
- Paid-media funnel metrics render only when a connected main source provides impressions or clicks.
- Imported child spend/revenue inside GA4 does not make GA4 eligible for paid-media funnel stages.
- Historical Commit 4 boundary: partial current windows were disclosed while full-period evidence was pending. The current GA4-only boundary now has exact-calendar missing-data and cumulative-summary parity.

Files changed:

- `client/src/pages/trend-analysis.tsx`
- `server/trend-analysis-overview-regression.test.ts`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm run check`

Evidence:

- Regression coverage proves the Conversion Funnel tab uses `conversionFunnelData`, separates Web Analytics Funnel from Paid-Media Funnel, requires impressions or clicks for paid-media funnel availability, explains unavailable paid-media funnel metrics for GA4-only campaigns, and no longer references `crossPlatformData`.

Manual validation guidance:

- Current Render validation can prove wiring and source-capability behavior: with only GA4 connected, the Conversion Funnel tab should show Web Analytics Funnel metrics from GA4 and should not show paid-media funnel metrics as available.
- Historical Commit 4 boundary: full-period historical validation was pending and is superseded for the exact GA4-only boundary by the current certification evidence.
- For mock-placeholder GA4 data, treat the visible values as a source-aware smoke test, not final proof of live GA4 time-series accuracy.

### Commit 5: Platform Breakdown

- Build platform breakdown rows from the source-aware aggregate, not hardcoded LinkedIn/Meta/Google Ads totals.
- Include GA4 as a main source when it is connected.
- Exclude platform child financial inputs as separate main rows.
- Show source-specific unavailable reasons for metrics a platform does not provide.

Status: completed.

Root cause fixed:

- The Platform Breakdown tab still rendered from the legacy frontend `crossPlatformData.platformTotals` merge.
- That legacy path hardcoded LinkedIn, Meta, and Google Ads, so GA4 was not represented as a main connected source and future main sources would require tab-specific rewiring.
- Commit 5 adds an aggregate-backed `platformBreakdownData` model and wires only the Platform Breakdown tab to `trend_analysis_aggregate_v1`.
- Platform rows now come from `trendAggregate.sources`, which represents main Connected Platforms only.
- GA4 appears as Google Analytics when connected, with its available web analytics and revenue metrics.
- Platform child revenue/spend inputs remain excluded as separate main platform rows.
- Source-specific unavailable metric reasons are surfaced in the table, and spend/efficiency charts explain missing source-level spend instead of rendering misleading empty paid-media comparisons.

Files changed:

- `client/src/pages/trend-analysis.tsx`
- `server/trend-analysis-overview-regression.test.ts`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm run check`

Evidence:

- Regression coverage proves the Platform Breakdown tab uses `platformBreakdownData`, reads `trendAggregate.sources`, no longer references `crossPlatformData`, removes hardcoded LinkedIn/Meta/Google Ads trend bars, and explains missing source-level spend/efficiency inputs.

Manual validation guidance:

- Current Render validation can prove wiring and source-capability behavior: with only GA4 connected, Platform Breakdown should list Google Analytics as the main source and should not list GA4 child revenue/spend inputs as separate platforms.
- Current validation should also confirm GA4-only unavailable metrics remain unavailable rather than zero-filled paid-media comparisons.
- Historical Commit 5 boundary: multi-source Platform Breakdown evidence remained pending. The retired panel is not mounted in the current one-view GA4-only product; future multi-source Source Contribution still requires source-specific validation.
- For mock-placeholder GA4 data, treat visible Platform Breakdown values as a source-aware smoke test, not final proof of live GA4 time-series accuracy.

### Commit 6: Insights

- Rename the final tab to `Insights`.
- Replace external keyword trend widgets with executive recommendations based on the aggregate-backed Trend sections.
- Use the same Campaign DeepDive pattern as Performance Summary, Budget & Financial Analysis, and Platform Comparison: connected-source data in earlier tabs feeds a final recommendation/insights tab.
- Recommendations must be based only on available connected-source trend data and should explain unavailable history or missing source inputs instead of inventing metrics.

Status: completed.

Root cause fixed:

- The final Trend Analysis tab was still `Market Trends`, which rendered optional Google Trends keyword widgets instead of campaign performance recommendations.
- That did not match the current Campaign DeepDive subsection pattern, where the final tab provides executive-ready insights based on data already shown in the subsection.
- Commit 6 originally renamed the tab to `Insights` and added `trendInsights`. The current consumer mounts those recommendations directly in the comprehensive Executive View.
- Insights now identify connected-source coverage, historical comparison readiness, performance trend movement, efficiency input availability, web funnel opportunities, and single-source limitations.
- The tab does not create new metrics and does not use external Google Trends widgets for campaign performance recommendations.
- At Commit 6 the dropdown was hidden on the separate Insights tab. The tab is now retired; the current page-level selector remains visible because it controls the mounted charts and exact comparison date.

Files changed:

- `client/src/pages/trend-analysis.tsx`
- `server/trend-analysis-overview-regression.test.ts`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `GA4/README.md`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm run check`
- `git diff --check`

Evidence:

- Regression coverage proves the tab trigger is `Insights`, the content uses `trendInsights`, and recommendations are derived from the aggregate-backed Trend Analysis view models.
- Historical regression coverage proved the separate Insights tab did not show the page-level history dropdown; current regression coverage instead fixes the page to one mounted Executive View with one page-level selector.

### Commit 7: Scheduler, Snapshots, And Final Validation

- Ensure source refresh and scheduler paths create or refresh compatible trend history from the same source-aware aggregate model.
- Align Trend Analysis historical comparisons with compatible aggregate snapshots or daily aggregate rows.
- Do not compare new aggregate trend data against incompatible legacy snapshots.
- Add targeted regression tests, then run final targeted tests, `npm run check`, and `npm run build`.

Status: completed.

Root cause fixed:

- Scheduler/manual metric snapshots already stored `metrics.performanceSummary`, but did not store a compatible `metrics.trendAnalysis` aggregate.
- Trend Analysis current UI reads source-aware daily aggregate rows directly, so current values were source-correct, but scheduler/source-refresh snapshots were not tagged with `trend_analysis_aggregate_v1`.
- Commit 7 adds `metrics.trendAnalysis` to the existing `aggregateCampaignMetrics` snapshot payload using `buildTrendAnalysisAggregate`.
- Manual snapshots, platform-sync snapshots, and automatic scheduler snapshots all use `aggregateCampaignMetrics`, so the fix stays on the existing snapshot path and does not add a parallel scheduler.
- The snapshot payload now includes Trend Analysis source identity, capabilities, daily totals, unavailable reasons, and financial daily rows where available.

Files changed:

- `server/scheduler.ts`
- `server/trend-analysis-overview-regression.test.ts`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `GA4/README.md`

Validation:

- `npm test -- server/trend-analysis-aggregate.test.ts server/trend-analysis-overview-regression.test.ts`
- `npm test -- server/performance-summary-scheduler-regression.test.ts`
- `npm run check`
- `npm run build`
- `git diff --check`

Evidence:

- Regression coverage proves scheduler snapshots import and build the Trend Analysis aggregate, include `financialDailyRows`, read GA4/LinkedIn/Meta/Google Ads daily rows, and store `trendAnalysis` inside the snapshot metrics payload.
- Google Ads revenue-semantics regression coverage in `server/google-ads-production-regression.test.ts` proves the route-level Trend Analysis Google Ads source does not derive `revenue` or `attributedRevenue` from native conversion value or GA4-matched revenue.

## Validation Strategy

Use the same validation principle as Performance Summary, Budget & Financial Analysis, and Platform Comparison:

- Validate the API contract first.
- Validate visible UI values second.
- Validate source refresh/scheduler behavior third.

GA4-only validation should prove:

- Trend Analysis lists Google Analytics as the only main connected source.
- GA4 sessions, users, conversions, conversion rate, engagement rate, and revenue trends appear where available.
- Paid-media metrics such as impressions, clicks, CTR, CPC, CPM, and paid-media CPA remain unavailable unless a paid-media source is connected.
- GA4 child revenue/spend inputs do not appear as separate main platforms.

Multi-source validation should prove:

- Each connected main platform appears once.
- Metrics aggregate only when the connected sources provide compatible metrics.
- Missing metrics remain unavailable, not zero.
- Derived metrics are calculated only from available and valid inputs.

Historical validation should prove:

- trend charts update after source refresh creates new compatible daily rows or snapshots
- old incompatible history is not compared against the new aggregate contract
- 7-day and 30-day trends require enough compatible historical data to exist

## Historical Live GA4 / Mock-Live Test Plan — Superseded

This was the pre-certification evidence plan. The exact deployed GA4-only parity recorded at the top of this document supersedes its open GA4 historical-validation statements. Its multi-source caveat remains applicable to future source mixes.

Use this later to validate the end-to-end trend lifecycle with real time-series behavior:

- connect a controlled GA4 property to a campaign
- inject or generate known daily GA4 test events for at least 7 days
- include sessions, users, conversions, engagement, and revenue where possible
- refresh GA4 after each day of mock activity
- confirm platform-level GA4 values update first
- confirm Trend Analysis current and historical values update from the connected-source aggregate
- confirm `Last 7 Days` appears only after enough compatible history exists
- extend to 30 days before validating `Last 30 Days`

This test validates:

- source refresh
- daily metric persistence
- aggregate trend construction
- UI trend rendering
- historical comparison compatibility
- GA4-only source-capability gating

It does not validate future multi-platform behavior until at least two real main Connected Platforms are connected and refreshed.

Important validation boundary:

- Current Render validation proves the Trend Analysis UI and aggregate contract are wired correctly for the selected connected sources.
- Current mock-placeholder GA4 data can prove that GA4 appears as the main source and paid-media-only metrics stay unavailable when no paid-media platform is connected.
- It does not fully prove historical trend accuracy over time, because that requires multiple saved records from different days.
- The later mock-live GA4 account should feed controlled daily data over multiple days so validation can prove Day 2 compares correctly against Day 1, then 7-day and 30-day windows update correctly after enough compatible daily history exists.
- New snapshots created after Commit 7 should include `metrics.trendAnalysis.version = "trend_analysis_aggregate_v1"`; old snapshots without that block are legacy history and should not be used as proof of Trend Analysis historical accuracy.

## Production-Readiness Definition

Trend Analysis is production ready only when:

- every visible section in the single Executive View consumes the source-aware trend aggregate or a proven compatible cumulative/snapshot model
- GA4-only campaigns show only GA4-capable metrics
- paid-media metrics require connected paid-media source inputs
- child revenue/spend inputs feed parent financial totals but do not appear as main platforms
- future main Connected Platforms can participate through the same source identity/capability/daily-metric contract without tab-specific rewiring
- source refresh and scheduler paths keep current and historical trend values in sync
- regression coverage proves GA4-only, paid-media-connected, unavailable-metric, and scheduler/history cases
- final targeted tests, `npm run check`, and `npm run build` pass

## Current Status

The controlling current status is the `2026-08-26` exact deployed GA4-only certification near the top of this document. The historical Commit 1–10 records below remain implementation history and must not override that bounded current decision.

Future or refined main-source mixes remain unverified until each source passes its source-specific Trend scope, capability, date-window, currency, refresh, report, snapshot, and missing-data parity checks.

## 2026-07-30 Historical Commit 10 Status — Superseded By The Current Boundary

Root cause: the scheduled Trend financial SQL joined active sources without a GA4 `platform_context` predicate, so foreign-context financial rows could enter a GA4 snapshot on a multi-platform campaign. Commit `ec265895` deployed GA4 context predicates while preserving the existing 90-day Trend window and `trend_analysis_aggregate_v1` response contract; the enclosing Performance Summary snapshot is `performance_summary_aggregate_v2`. Commit 10 is closed for its bounded implementation/browser packet, but the recorded browser validation did not inspect historical Trend or a live multi-source campaign. Those exact Trend gates remain unproven.
