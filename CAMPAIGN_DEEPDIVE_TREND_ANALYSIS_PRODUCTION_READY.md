# Campaign DeepDive Trend Analysis Production Readiness

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

## Current Root Cause

`client/src/pages/trend-analysis.tsx` currently performs page-local aggregation from separate hardcoded daily endpoints.

Current implementation issues:

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

## Production-Ready Target Contract

Trend Analysis should consume one campaign-level source-aware trend contract.

The safest fix is to reuse the already-built Performance Summary aggregate contract pattern, then add or compose a trend-specific daily aggregate model that follows the same source identity and capability rules.

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

Preferred approach:

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

## Tab Implementation Plan

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

### Commit 2: Executive Overview

- Wire the Executive Overview tab to the source-aware trend aggregate.
- Show only metrics available from connected sources.
- For GA4-only campaigns, show GA4 trend metrics such as sessions, users, conversions, conversion rate, engagement rate, and revenue where available.
- Keep ad spend, impressions, clicks, CTR, CPC, CPM, and paid CPA unavailable unless a connected source provides the required inputs.
- Prevent transient empty or demo content from flashing before the aggregate loads.

Status: completed.

Root cause fixed:

- The Executive Overview tab still rendered from the legacy `crossPlatformData` object, which is built by hardcoded frontend merges of GA4, LinkedIn, Meta, Google Ads, and daily financial endpoints.
- Commit 2 adds a source-aware Trend Analysis query to the page and wires only the Executive Overview tab to `trend_analysis_aggregate_v1`.
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

- If the GA4 mock campaign was created or viewed with a 90-day scope, use `Last 90 Days` when comparing Trend Analysis Executive Overview values against the GA4 platform Summary values.
- Use `Last 30 Days` only when validating the 30-day Trend Analysis window.
- `Last 30 Days` requests 60 days from the aggregate endpoint so the UI has a current 30-day window plus a previous 30-day comparison window when enough rows exist.
- `Last 7 Days` is acceptable for a quick smoke test, but it provides less history and is more sensitive to missing daily rows.
- `Last 90 Days` requests 180 days from the aggregate endpoint, but the current GA4 mock simulator returns the current 90-day mock range. That is valid for current 90-day totals, but it may not show previous-period comparison percentages until enough compatible history exists.
- With GA4 mock-placeholder data, validate source-aware logic only: the request succeeds, the source list contains GA4 only, GA4-capable metrics appear, paid-media-only metrics remain hidden unless available, and the selected dropdown changes the `dateRange`/`days` request.
- Do not use the mock-placeholder values as proof of final live GA4 numeric accuracy. Final numeric/time-series validation should be done later with the planned mock-live GA4 account that receives controlled daily data.
- Commit 2 follow-up fix: Trend Analysis now uses the same deterministic GA4 mock simulation path for `yesop` mock properties as the GA4 platform daily route, then overlays persisted daily rows. This prevents the Executive Overview from showing unrelated persisted-only mock rows when the source GA4 page is using simulated mock data.
- Commit 2 follow-up fix: GA4 engagement rate is normalized before display, so decimal rates such as `0.6` display as `60%`, not `0.6%`.
- Commit 2 follow-up fix: Executive Overview no longer treats partial historical rows as a complete comparison window. Current values can render from the available daily rows, but comparison percentages appear only after a complete previous window exists for the selected period. If the current selected window is partial, the UI shows how many daily rows are available and explains that full-period comparisons require more history.
- Commit 2 verification fix: the `yesop` mock GA4 path now requests enough simulated daily rows for the selected Executive Overview comparison window where the simulator supports it. `Last 7 Days` and `Last 14 Days` use a 30-day simulated baseline, `Last 30 Days` uses the 60-day simulated baseline, and `Last 90 Days` uses the 90-day baseline because no 180-day simulator range exists yet.

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
- Final full-period efficiency trend validation should be done later with the planned mock-live GA4 account once enough controlled daily history exists for the selected window.

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
- Partial current windows are disclosed; full-period funnel trend validation should be completed later with the planned mock-live GA4 account after enough daily history exists.

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
- Full-period historical validation should be completed later with the planned mock-live GA4 account, because funnel trend quality depends on controlled daily rows existing across the selected date window.
- For mock-placeholder GA4 data, treat the visible values as a source-aware smoke test, not final proof of live GA4 time-series accuracy.

### Commit 5: Platform Breakdown

- Build platform breakdown rows from the source-aware aggregate, not hardcoded LinkedIn/Meta/Google Ads totals.
- Include GA4 as a main source when it is connected.
- Exclude platform child financial inputs as separate main rows.
- Show source-specific unavailable reasons for metrics a platform does not provide.

Status: pending.

Evidence: not started.

### Commit 6: Market Trends

- Preserve Market Trends as external keyword trend analysis, not connected-source performance data.
- Clarify UI copy so users understand Google Trends data is external market-interest context.
- Keep it separate from Connected Platform metric aggregation.

Status: pending.

Evidence: not started.

### Commit 7: Scheduler, Snapshots, And Final Validation

- Ensure source refresh and scheduler paths create or refresh compatible trend history from the same source-aware aggregate model.
- Align Trend Analysis historical comparisons with compatible aggregate snapshots or daily aggregate rows.
- Do not compare new aggregate trend data against incompatible legacy snapshots.
- Add targeted regression tests, then run final targeted tests, `npm run check`, and `npm run build`.

Status: pending.

Evidence: not started.

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

## Live GA4 / Mock-Live Test Plan

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

## Production-Readiness Definition

Trend Analysis is production ready only when:

- every tab consumes the source-aware trend aggregate or a proven compatible aggregate/snapshot model
- GA4-only campaigns show only GA4-capable metrics
- paid-media metrics require connected paid-media source inputs
- child revenue/spend inputs feed parent financial totals but do not appear as main platforms
- future main Connected Platforms can participate through the same source identity/capability/daily-metric contract without tab-specific rewiring
- source refresh and scheduler paths keep current and historical trend values in sync
- regression coverage proves GA4-only, paid-media-connected, unavailable-metric, and scheduler/history cases
- final targeted tests, `npm run check`, and `npm run build` pass

## Current Status

Commits 1 through 4 are completed and validated locally.

Trend Analysis now has an aggregate contract plus aggregate-backed Executive Overview, Efficiency Metrics, and Conversion Funnel tabs. Remaining production-readiness work starts at Commit 5: Platform Breakdown.
