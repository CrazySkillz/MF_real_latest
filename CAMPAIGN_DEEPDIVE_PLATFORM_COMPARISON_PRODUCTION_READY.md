# Campaign DeepDive Platform Comparison Production Readiness

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Platform Comparison` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped main data sources are attached.
- `Platform Comparison` compares only the metrics currently available from those connected main sources.
- If only GA4 is connected, Platform Comparison uses only GA4-capable metrics.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, TikTok, Instagram, and future integrations are connected, their available metrics must be automatically included in the comparison without double-counting.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready cross-source comparison, not another platform-specific drilldown.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Platform Comparison` = campaign-level comparison of available connected-source metrics.

Do not turn Platform Comparison into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable metrics for sources that do not provide them.
Do not display platform child revenue/spend inputs as separate main platforms.
Do not guess when Platform Comparison values differ from the connected platform source-of-truth page. Trace the exact source field, merge rule, date window, and rendered value before editing.

## Current Root Cause

`client/src/pages/platform-comparison.tsx` partially uses `/api/campaigns/:id/outcome-totals`, but still builds comparison rows through page-local, hardcoded platform logic.

Current issues:

- source inclusion is hard-coded for LinkedIn, Meta, Custom Integration, and separate GA4 logic
- the page does not primarily use `outcomeTotals.performanceSummary.sources`
- Google Ads and future generic main sources can be missed even when they are present in the shared aggregate
- GA4-only campaigns can be mixed with paid-media comparison assumptions
- child revenue sources such as HubSpot, Shopify, and Salesforce can appear as separate revenue platforms even though they are configured inside a parent platform flow
- fallback logic can estimate revenue from conversions and average order value, which can drift from source-of-truth platform/campaign financial totals
- empty-state and explanatory copy still references only LinkedIn and Meta in some places
- the GA4 row can drift from the GA4 platform Overview if it uses raw native GA4 source-row values instead of the composed GA4 platform source-of-truth values shown in `View Detailed Analytics`

The issue is an aggregation contract problem, not a single-card display bug.

## Existing Relevant Paths

- `client/src/pages/platform-comparison.tsx`
  - Current Platform Comparison page and tab UI.
  - Fetches `/api/campaigns/:id/outcome-totals?dateRange=90days`.
  - Still performs tab-local source construction and fallback calculations.

- `client/src/pages/campaign-performance.tsx`
  - Performance Summary page.
  - Uses `/api/campaigns/:id/outcome-totals` and `performanceSummary` as the source-aware aggregate model.

- `client/src/pages/financial-analysis.tsx`
  - Budget & Financial Analysis page.
  - Uses the same aggregate contract for financial metrics and source-aware rows.

- `server/routes-oauth.ts`
  - Contains `/api/campaigns/:id/outcome-totals`.
  - Builds `performanceSummary` through the shared aggregate helper.

- `server/utils/performance-summary-aggregate.ts`
  - Current connected-source aggregate helper.
  - Contains source identity, capabilities, included metrics, excluded metric reasons, financial totals, and derived metrics.

- `server/scheduler.ts`
  - Scheduler snapshots must align with the same aggregate model used by Campaign DeepDive sections.

## Production-Ready Target Contract

Platform Comparison should consume one campaign-level aggregate contract.

The safest fix is to reuse the already-built Performance Summary aggregate contract, then wire each Platform Comparison tab to that same source-aware model.

The contract should provide:

- campaign ID and date range
- connected main sources included in the aggregate
- source capabilities
- included metrics
- excluded metrics with reasons
- source freshness metadata
- per-source current metrics
- aggregate totals when a tab needs campaign-level totals
- per-source financial inputs only as provenance, not as main platform rows
- historical comparison values derived from the same aggregate model if historical UI is later shown

Preferred approach:

- Reuse `/api/campaigns/:id/outcome-totals` and `outcomeTotals.performanceSummary`.
- Build normalized Platform Comparison rows from `performanceSummary.sources`.
- Exclude `category: "financial"` sources from main platform cards/tables.
- Use source `capabilities`, `includedMetrics`, and `metrics` to decide what each tab can show.
- Keep unavailable metrics blank or explicitly unavailable instead of treating missing values as zero performance.
- Remove or gate legacy fallback calculations that can estimate values not present in the aggregate.
- Keep persistence reads in `server/storage.ts`.
- Keep API composition in `server/routes-oauth.ts`.
- Keep tab rendering in `client/src/pages/platform-comparison.tsx`.

## Source Capability Rules

### GA4

Available when connected and campaign-scoped:

- users
- sessions
- conversions
- revenue as the GA4 platform total shown in `View Detailed Analytics`, including child revenue inputs configured inside GA4, while those child inputs remain hidden as separate main platforms

Not available:

- ad impressions
- ad clicks
- ad spend
- CPC
- CPM
- CTR
- ROAS/ROI at platform-row level unless spend is explicitly available from the aggregate financial path

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

Do not assume Custom Integration has spend, clicks, revenue, users, or sessions unless the aggregate says those metrics are included.

### Platform Child Revenue/Spend Inputs

Examples:

- HubSpot inside GA4
- Salesforce inside GA4
- Shopify inside GA4
- CSV revenue/spend imports inside GA4
- Google Sheets revenue/spend imports inside GA4

Rules:

- may feed campaign financial totals through the parent platform/campaign financial path
- must not appear as separate main platforms in Platform Comparison
- may be referenced only as provenance if a future UI section explicitly displays financial inputs

## Tab Implementation Plan

### Commit 1: Aggregate Contract

- Fetch `/api/campaigns/:id/outcome-totals?dateRange=90days` with the same URL-style query key pattern used by other DeepDive sections.
- Read `outcomeTotals.performanceSummary`.
- Add a small page-local normalizer that converts `performanceSummary.sources` into Platform Comparison rows.
- Exclude financial child sources from main platform rows.
- Add regression coverage proving GA4-only uses one GA4 source row and no child revenue sources appear as platforms.

### Commit 2: Overview Tab

- Wire Overview cards and the summary table to normalized aggregate source rows.
- Show only available metrics per source.
- Use GA4 sessions/users/conversions/revenue where available.
- Do not show GA4 impressions/clicks/spend as zero-performance paid-media metrics.
- Update empty-state copy to reference connected sources generally, not only LinkedIn/Meta.

### Commit 3: Performance Metrics Tab

- Wire detailed metrics and efficiency comparison to normalized aggregate source rows.
- Use capability-aware display logic for CTR, CPC, conversion rate, ROI, and ROAS.
- Do not rank sources on metrics they do not provide.
- Add copy explaining unavailable metrics where needed.

### Commit 4: Cost Analysis Tab

- Include only spend-capable sources for cost analysis, CPA, CPC, budget allocation, ROI, and ROAS cards.
- Show a clear unavailable state when only GA4/web analytics is connected.
- Do not treat child spend imports as separate platforms.
- Keep campaign financial totals in Budget & Financial Analysis; Platform Comparison should compare source rows.

### Commit 5: Insights Tab

- Generate insights only from sources with enough comparable metrics.
- GA4-only should not produce paid-media budget reallocation recommendations.
- Paid-media recommendations should require at least two spend-capable comparable sources.
- Use source labels and unavailable reasons from the aggregate where useful.
- Remove estimated-revenue recommendations that are not backed by aggregate revenue.

### Commit 6: Scheduler/History Alignment

- If Platform Comparison adds historical comparisons later, use compatible `metrics.performanceSummary` snapshots only.
- Current values should refetch while visible and on window focus, matching Performance Summary and Budget & Financial Analysis.
- Add regression coverage for query keys, refresh behavior, and aggregate-only snapshot compatibility if historical UI is used.

### Commit 7: Documentation And Final Validation

- Update this tracker and related architecture docs.
- Run targeted Platform Comparison regression tests.
- Run `npm run check`.
- Run `npm run build` if final production-readiness validation is requested.
- Validate on Render with at least one GA4-only campaign and one multi-platform campaign when available.

## Production-Ready Acceptance Criteria

- Every visible platform row represents a main Connected Platform source from the aggregate contract.
- Child revenue/spend inputs do not appear as separate main platforms.
- GA4-only campaigns show only GA4-capable metrics.
- Paid-media comparison and recommendations require paid-media capable sources.
- Missing metrics are unavailable, not silently zeroed.
- Google Ads appears automatically when connected and present in `performanceSummary.sources`.
- Future main platforms appear without tab-specific UI rewiring once they feed the shared aggregate contract.
- Current values stay synchronized with source updates through aggregate refetch.
- Regression coverage protects GA4-only, paid-media, financial child-source exclusion, and future generic source behavior.

## Current Status

Not production-ready yet for the full requested source-of-truth rule. Commit 1 and Commit 2 are complete.

Proven:

- Platform Comparison is a Campaign DeepDive page.
- It already fetches `/api/campaigns/:id/outcome-totals`.
- The shared `performanceSummary` aggregate contract now supports main Connected Platform source rows, including GA4, LinkedIn, Meta, Google Ads, Custom Integration, and generic future source rows when registered.
- Commit 1: Platform Comparison now uses a URL-style `outcome-totals` query key, reads `outcomeTotals.performanceSummary`, builds primary platform rows from `performanceSummary.sources`, and excludes `category: "financial"` child revenue/spend sources from main platform rows.
- Commit 1: When the aggregate is present, legacy revenue source rows are not shown as separate revenue platforms.
- Commit 1 validation: targeted regression coverage added in `server/platform-comparison-regression.test.ts`.
- Commit 1 Render validation passed: `/api/campaigns/:id/outcome-totals?dateRange=30days` returned `performanceSummary.sources` with GA4, and Platform Comparison used the connected-source aggregate list as the source-of-truth path.
- Commit 2: Overview cards and the summary table now include GA4 web analytics fields from the aggregate source row (`users`, `sessions`, `conversions`, and `revenue`) and hide paid-media fields (`spend`, `ROAS`, `ROI`) for analytics-only sources instead of presenting them as zero-performance metrics.
- Commit 2: Overview empty-state copy now references Connected Platforms generally instead of naming only LinkedIn, Meta, or child revenue systems.
- Commit 2 follow-up: Platform Comparison now requests the shared aggregate with `dateRange=90days`, matching Performance Summary, Budget & Financial Analysis, and the GA4 platform overview source-of-truth window for current campaign values.
- Commit 2 follow-up: Platform Comparison GA4 revenue now uses the parent GA4 platform total from `outcomeTotals.revenue.totalRevenue`, so child revenue inputs configured inside GA4 are included in the GA4 row without being shown as separate platforms. Yesop/mock GA4 source rows now use the same date-overlay daily-row merge pattern as the GA4 platform Overview before summing sessions, users, conversions, and revenue.

Outstanding:

- Continue wiring Performance Metrics, Cost Analysis, and Insights to capability-aware source rows beyond the initial aggregate source-row boundary.
- Remove or gate remaining hardcoded platform blocks and legacy fallback estimates that are still retained only as no-aggregate fallback behavior.
- Expand targeted regression coverage for each tab.
- Validate with GA4-only and multi-platform connected-source scenarios.
