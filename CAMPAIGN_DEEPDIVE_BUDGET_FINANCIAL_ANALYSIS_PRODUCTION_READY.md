# Campaign DeepDive Budget & Financial Analysis Production Readiness

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Budget & Financial Analysis` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped main data sources are attached.
- `Budget & Financial Analysis` aggregates only financial and cost metrics currently available from those connected sources.
- If only GA4 is connected, Budget & Financial Analysis uses only GA4-capable metrics plus valid campaign financial totals from the GA4/campaign financial path.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, TikTok, Instagram, and future integrations are connected, their available metrics must be automatically included in the campaign-level financial aggregate without double-counting.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready campaign-wide financial view, not a platform-specific drilldown.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Budget & Financial Analysis` = aggregated campaign-level financial analysis based on connected-source data.

Do not turn Budget & Financial Analysis into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable financial or cost metrics for sources that do not provide the required inputs.

## Current Root Cause

`client/src/pages/financial-analysis.tsx` currently performs page-local aggregation from separate source queries.

That implementation is not driven by the same connected-source aggregate contract used by the production-ready Performance Summary path. As a result:

- source inclusion is hard-coded in the frontend
- the page manually combines LinkedIn, Meta, Custom Integration, Google Sheets, and GA4 fallback fields
- GA4 is used mostly as an AOV fallback instead of as a first-class connected-source aggregate input
- Google Sheets can be treated like a platform-style input even when it is a GA4/campaign financial child input
- future main Connected Platforms would require tab-specific rewiring
- unavailable metrics can be treated as zero instead of explicitly unavailable
- scheduler/history alignment is not guaranteed to match the same aggregate model

The issue is an aggregation contract problem, not a single-card display bug.

## Existing Relevant Paths

- `client/src/pages/financial-analysis.tsx`
  - Current Budget & Financial Analysis page and tab UI.
  - Performs local aggregation and tab-specific calculations.

- `client/src/pages/campaign-performance.tsx`
  - Performance Summary page.
  - Uses `/api/campaigns/:id/outcome-totals` and `performanceSummary` as the source-aware aggregate model.

- `server/routes-oauth.ts`
  - Contains `/api/campaigns/:id/outcome-totals`.
  - Builds `performanceSummary` through the shared aggregate helper.

- `server/utils/performance-summary-aggregate.ts`
  - Current connected-source aggregate helper.
  - Contains source identity, capabilities, included metrics, excluded metric reasons, financial totals, and derived metrics.

- `server/scheduler.ts`
  - Scheduler snapshots must align with the same aggregate model used by the UI.

- `GA4/FINANCIAL_SOURCES.md`
  - Canonical GA4 financial source rules for revenue, spend, provenance, recomputation, and child source behavior.

## Production-Ready Target Contract

Budget & Financial Analysis should consume one campaign-level aggregate contract.

The safest fix is to reuse the already-built Performance Summary aggregate contract, then wire each Budget & Financial tab to that same source-aware model.

The contract should provide:

- campaign ID and date range
- connected main sources included in the aggregate
- source capabilities
- included metrics
- excluded metrics with reasons
- source freshness metadata
- aggregate current financial totals
- aggregate current cost-efficiency metrics
- per-source breakdown for spend-capable and revenue-capable sources
- historical comparison values derived from the same aggregate model when historical UI is shown

Preferred approach:

- Reuse `/api/campaigns/:id/outcome-totals` and `outcomeTotals.performanceSummary` wherever the required financial metrics already exist.
- Use `/api/campaigns/:id/outcome-totals.financialInputs` for detailed revenue/spend input provenance. `performanceSummary.sources` is a connected-source aggregate breakdown and must not be treated as the complete GA4 financial source-modal provenance list.
- Extend the aggregate helper only if a Budget & Financial tab needs a financial field that is not yet represented.
- Keep persistence reads in `server/storage.ts`.
- Keep API composition in `server/routes-oauth.ts`.
- Keep scheduler alignment in `server/scheduler.ts`.
- Keep tab rendering in `client/src/pages/financial-analysis.tsx`.

## Source Capability Rules

### GA4

Available when connected and campaign-scoped:

- revenue when GA4 native revenue exists
- conversions
- sessions
- users

Not available:

- ad spend
- ad impressions
- ad clicks
- CPC, CPM, CTR, CPA from GA4 alone unless required paid/cost inputs are available from another connected source

### Platform Child Revenue/Spend Inputs

Examples:

- Salesforce inside GA4
- HubSpot inside GA4
- Shopify inside GA4
- CSV revenue/spend imports inside GA4
- Google Sheets revenue/spend imports inside GA4

Rules:

- can feed campaign revenue or spend totals through the parent platform/campaign financial path
- must not appear as separate main Connected Platforms
- must not require duplicate Budget & Financial setup
- must preserve source provenance and avoid double-counting
- detailed Budget & Financial input rows must use the same native GA4 revenue, revenue breakdown, and spend breakdown paths as the GA4 financial source modals
- `performanceSummary.sources` may show high-level connected source and child-revenue aggregate contributors, but it is not sufficient for detailed financial input provenance because it does not represent native GA4 revenue and spend breakdown rows

### Paid Media Sources

Examples:

- LinkedIn
- Meta
- Google Ads
- TikTok
- Instagram
- future paid sources

Available when connected, campaign-scoped, and refreshed:

- spend
- impressions where provided
- clicks where provided
- conversions where provided
- attributed revenue only where the source has a validated revenue path

These sources should contribute to financial and cost-efficiency metrics only for the metrics they actually provide.

### Custom Integration

Available metrics depend on the mapped custom source fields.

Rules:

- include only mapped metrics that are present and campaign-scoped
- do not assume Custom Integration is a paid-media source unless it provides spend/click/impression fields
- use unavailable reasons when required financial inputs are missing

## Tab-by-Tab Target Behavior

### Overview

Should use aggregate current values for:

- total spend
- total revenue
- budget utilization
- remaining budget
- ROAS
- ROI
- CPA
- CPC
- conversion rate only when required inputs are available

GA4-only behavior:

- show GA4 revenue/conversions where available
- show campaign financial spend only if a valid campaign spend source exists
- do not show paid-media-only metrics as zero if no paid-media source provides required inputs

### ROI & ROAS

Should use aggregate revenue and spend.

Per-source breakdown should list only connected sources that actually provide spend and/or revenue inputs.

Child revenue/spend inputs may contribute to totals but should be labeled as financial contributors, not main Connected Platforms.

### Cost Analysis

Should use aggregate spend, clicks, impressions, and conversions.

Metrics such as CPC, CPA, CPM, CTR, and CVR should render only when their required inputs are available.

Unavailable metrics should explain the missing source capability instead of rendering misleading zero values.

### Budget Allocation

Should use spend-capable connected sources.

If only GA4 is connected and no valid spend source exists, the tab should show that no spend-capable connected source is available for allocation.

If campaign spend sources exist through the parent financial path, they can feed total spend and budget utilization, but should not be treated as standalone main platforms.

Imported spend labels inside GA4, such as Google Sheets or LinkedIn spend imports, are not connected ad platforms. They can feed total spend, ROI, ROAS, and Budget Utilization through the GA4/campaign financial path, but Budget Allocation should only show allocation sources after a spend-capable ad platform such as LinkedIn Ads, Meta Ads, or Google Ads is connected in `Connected Platforms`.

### Insights

Should generate recommendations from aggregate financial metrics and source capabilities.

It should avoid paid-media budget reallocation advice for GA4-only campaigns unless spend-capable paid sources are connected.

It should prioritize:

- budget overrun or underutilization
- ROAS/ROI risk
- high CPA
- poor cost efficiency
- source-specific spend concentration only when multiple spend-capable sources exist

## Implementation Plan

### Commit 1: Aggregate Contract

- Add `outcomeTotals` fetch to `client/src/pages/financial-analysis.tsx`.
- Read `outcomeTotals.performanceSummary`.
- Keep current UI layout unchanged.
- Add defensive helpers for aggregate metric availability, value, sources, and unavailable reasons.
- Do not remove existing source queries until the first tab is safely migrated.

Status: completed.

Latest follow-up commit: `7878a2df Validate budget pacing date inputs`.

Evidence:

- `client/src/pages/financial-analysis.tsx` now fetches `/api/campaigns/:id/outcome-totals?dateRange=90days`.
- The page now reads `outcomeTotals.performanceSummary`.
- Defensive helpers now exist for aggregate metric availability, values, source IDs, and unavailable reasons.
- Existing tab calculations remain unchanged for this commit; tab migration starts with Commit 2.
- Regression coverage added in `server/campaign-financial-analysis-regression.test.ts`.
- Render validation passed after deploy: direct `outcome-totals?dateRange=90days` response included `performanceSummary` with aggregate data.

### Commit 2: Overview Tab

- Wire Overview tab cards and health calculations to aggregate financial metrics.
- Preserve campaign budget, start date, and end date behavior.
- Show unavailable states when required aggregate inputs are missing.
- Add regression coverage for GA4-only and spend-source scenarios.

Status: completed.

Evidence:

- Overview tab now reads spend, revenue, conversions, CPC, CPA, CVR, ROI, and ROAS through `performanceSummary.totals`.
- Overview loading now waits for the aggregate response to avoid briefly rendering local hardcoded financial values before aggregate data arrives.
- Budget utilization, pacing, ROI, ROAS, total spend, conversions, CPC, CPA, and conversion-rate displays use Overview-specific aggregate metric wrappers.
- Missing required aggregate inputs render `Unavailable` plus the aggregate unavailable reason instead of silently showing zero.
- Follow-up fix: `/api/campaigns/:id/outcome-totals` revenue now aligns with the GA4 financial card rule by adding imported revenue-to-date records from the GA4/campaign financial path to GA4 revenue before deriving ROAS and ROI.
- Follow-up fix: aggregate `cvr` now uses paid-media `conversions / clicks` when clicks exist, and falls back to GA4/web `conversions / sessions` when the connected web source provides sessions.
- Render validation passed after deploy: `performanceSummary.totals.cvr.value` populated from GA4 conversions and sessions for the current GA4-backed test campaign.
- Other Budget & Financial tabs still use the previous calculations and are intentionally deferred to later commits.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.

### Commit 3: ROI & ROAS Tab

- Wire total ROI/ROAS to aggregate revenue and spend.
- Replace hardcoded platform breakdowns with source breakdowns from the aggregate.
- Preserve child-source distinction for GA4 financial inputs.
- Add regression coverage for revenue/spend availability and no double-counting.

Status: completed.

Evidence:

- ROI & ROAS headline values now read `spend`, `revenue`, `roi`, and `roas` through `performanceSummary.totals`.
- The tab waits for the same aggregate response already used by Overview, so it does not render local hardcoded totals before aggregate values arrive.
- Source ROAS/ROI breakdowns render from `performanceSummary.sources` for main connected sources instead of hardcoded LinkedIn/Custom/Meta blocks when the aggregate contract is available.
- GA4 financial child revenue inputs remain separate from main Connected Platform source rows; they are shown only as financial revenue inputs and feed totals through the aggregate revenue path.
- Totals are not recomputed from the visible source rows in the tab, preventing child-source display from double-counting aggregate revenue.
- Follow-up fix: when there is exactly one main connected source, the source ROAS/ROI rows use aggregate revenue and spend so a GA4-only campaign includes GA4 child financial inputs and canonical spend instead of showing GA4-native revenue with `$0` spend.
- Follow-up fix: the financial input provenance list now comes from `/outcome-totals.financialInputs`, which is built from the same GA4 native revenue, revenue breakdown, and spend breakdown paths used by the GA4 financial source modals.
- Follow-up UI fix: financial input provenance is displayed under separate `Revenue` and `Spend` subsections.
- Follow-up UI fix: financial input rows display source labels only; source-type metadata remains in the payload but is not duplicated beside each row label.
- Render validation passed after deploy: Financial Inputs rows displayed the expected source labels without duplicated source-type copy.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.

### Commit 4: Cost Analysis Tab

- Wire CPC, CPA, CPM, CTR, and CVR to aggregate metrics.
- Show unavailable states when clicks, impressions, conversions, or spend are missing.
- Add regression coverage proving GA4-only campaigns do not render paid-media cost metrics as zero.

Status: completed.

Evidence:

- Cost Analysis now renders CPC, CPA, CPM, CTR, and CVR from aggregate metric wrappers.
- CPM was added to the aggregate contract as `spend / impressions * 1000` and is available only when spend and impressions are available.
- Missing cost-efficiency inputs render `Unavailable` plus aggregate unavailable reasons instead of zero-valued paid-media metrics.
- Cost Analysis includes a `Sources` section that lists the connected main sources contributing available cost-analysis inputs, such as Google Analytics for GA4-backed conversion/session metrics.
- The visible `Demo Data` control was removed from the Budget & Financial Analysis page so the production page does not invite switching away from real campaign data.
- Render validation passed after deploy: Cost Analysis displayed the expected source provenance and the visible `Demo Data` page control/banner were no longer present.
- GA4-only campaigns no longer show CPC, CPM, or CTR as zero when no connected paid-media source provides clicks or impressions.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts` and `server/performance-summary-aggregate.test.ts`.

### Commit 5: Budget Allocation Tab

- Build allocation from spend-capable connected sources only.
- Avoid allocation recommendations when only one or zero spend-capable sources exist.
- Add regression coverage for one-source, multi-source, and child-source cases.

Status: completed.

Evidence:

- Budget Allocation now derives allocation rows from `performanceSummary.sources` main connected sources that explicitly include `spend`.
- Platform child spend inputs can still feed aggregate total spend and budget utilization, but they are not treated as standalone allocation sources.
- The tab now includes explanatory copy that imported spend labels inside GA4, such as Google Sheets or LinkedIn spend imports, are not connected ad platforms and only feed financial totals until a spend-capable ad platform is connected in `Connected Platforms`.
- GA4-only campaigns with no spend-capable main source show that no spend-capable connected source is available for budget allocation.
- Campaigns with one spend-capable source show the source but do not show reallocation guidance.
- Reallocation guidance appears only when more than one spend-capable connected source is available.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.

### Commit 6: Insights Tab

- Refactor insights to use aggregate source capabilities and aggregate financial metrics.
- Prevent paid-media optimization recommendations for analytics-only sources.
- Add regression coverage for GA4-only, multi-paid-source, and missing-input cases.

Status: completed.

Evidence:

- Insights now builds source-performance insight rows from the same spend-capable aggregate sources used by Budget Allocation.
- ROAS, ROI, CPA, CTR, CVR, CPC, CPM, spend, and budget utilization insight copy now use aggregate metric wrappers and unavailable states instead of local zero-fallback calculations.
- GA4-only campaigns with no spend-capable connected ad platform show an explicit message that paid-media optimization insights require a connected ad platform.
- Budget reallocation recommendations remain blocked unless more than one spend-capable connected source exists.
- Follow-up fix: Insights no longer recommends generic scaling from high ROAS alone. When budget utilization is low, Budget Management and Key Opportunities both describe the campaign as budget-underutilized instead of calling usage "within range" while also recommending increased spend.
- Follow-up UI fix: Financial Performance Insights cards now use the same success/warning/info color treatment as the Performance Summary Insights tab.
- Follow-up logic fix: the top Performance Summary insight uses warning styling when ROAS is below break-even or ROI is negative, instead of showing success merely because ROAS/ROI values are available.
- Follow-up logic fix: source-level performance and Budget Capacity insights no longer imply scaling when source ROAS is not strong or when budget utilization is already over 100%.
- Follow-up copy fix: source-level insight labels now say Source Performance or Strongest Source so a merely available or best-relative source is not presented as objectively high-performing.
- Follow-up logic fix: Overview Campaign Health budget and pacing sub-scores now require a configured campaign budget and available spend; missing budget no longer grants full budget/pacing health points.
- Follow-up logic fix: Overview Campaign Health ROI and ROAS sub-scores now show unavailable when aggregate ROI/ROAS are unavailable instead of labeling missing data as critical.
- Follow-up logic fix: Overview Campaign Health overall header now shows unavailable/no score when every health input is unavailable instead of labeling missing data as Needs Attention.
- Follow-up logic fix: Overview Campaign Health overall score now normalizes across available health inputs and displays the input count, so partial missing data is not treated as failed performance.
- Follow-up logic fix: Overview pacing now requires a campaign end date; without an end date, Target Daily Spend and Pacing Status are unavailable instead of being derived from current burn rate and incorrectly shown as On Track.
- Follow-up copy fix: Budget Pacing & Burn Rate now explicitly tells users to set a campaign end date to enable Target Daily Spend and Pacing Status.
- Follow-up logic fix: Budget Pacing & Burn Rate now also requires a valid campaign start date for Daily Burn Rate and a valid start/end date range for Target Daily Spend and Pacing Status, instead of silently using today as a fallback start date.
- Validation passed for the pacing/date-input follow-up: `npm run check`, `npm test -- server/campaign-financial-analysis-regression.test.ts`, and targeted `git diff --check`.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.
- Render validation passed after the Commit 7 refresh/history deploy: Overview and Budget & Financial Analysis values remained correct after deployment.
- Follow-up UX fix: Budget Pacing & Burn Rate now provides inline campaign metadata inputs when budget, start date, or end date are missing or invalid. The inputs update only the existing campaign `budget`, `startDate`, and `endDate` fields, then the card recalculates Daily Burn Rate, Target Daily Spend, and Pacing Status from saved metadata plus aggregate spend.
- Follow-up copy fix: the old card-level missing-start-date warning was removed. Row-level helper text now states the exact inputs required for Daily Burn Rate, Target Daily Spend, and Pacing Status.
- Follow-up accuracy fix: Budget Pacing & Burn Rate now uses inclusive campaign days. Active campaigns calculate elapsed days through the current date; completed campaigns stop elapsed days at the campaign end date, so Daily Burn Rate is not diluted by days after completion.
- Follow-up UX fix: users can edit or delete Budget Pacing metadata inputs from the card. Deleting clears the same campaign `budget`, `startDate`, and `endDate` fields and dependent pacing values return to unavailable.

### Commit 7: Scheduler, History, Docs, Final Validation

- Align any historical Budget & Financial comparison logic with compatible aggregate snapshots.
- Ensure the page refetches aggregate values while visible and on window focus, matching the Performance Summary synchronization behavior.
- Update `ARCHITECTURE_USER_JOURNEY.md`, `GA4/README.md`, `GA4/FINANCIAL_SOURCES.md`, and this tracker.
- Run targeted tests, `npm run check`, and `npm run build`.

Status: completed.

Evidence:

- Budget & Financial Analysis now uses `/api/campaigns/:id/snapshots/comparison?type=...` for historical comparison instead of the unsupported `/snapshots?date=...` query.
- Trend indicators use snapshot `metrics.performanceSummary` only when the snapshot aggregate `version` matches the current `performanceSummary.version`; incompatible legacy snapshots are ignored.
- Current aggregate and comparison snapshot queries refetch every 30 seconds while visible and on window focus.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.
- Final validation passed: `npm run check`, `npm test -- server/campaign-financial-analysis-regression.test.ts server/performance-summary-scheduler-regression.test.ts`, targeted `git diff --check`, and `npm run build`.

## Validation Requirements

Before marking this subsection production ready:

- GA4-only campaign shows only GA4-supported financial inputs and valid campaign financial totals.
- GA4-only campaign does not show paid-media CPC, CPM, CTR, or allocation values as zero when no paid source exists.
- Child revenue/spend inputs feed totals through the parent financial path but do not appear as main Connected Platforms.
- Multi-source campaign aggregates all connected eligible source metrics.
- Future `platformSources` are included without tab-specific rewiring.
- Source labels match the aggregate source breakdown.
- Unavailable metrics show clear unavailable states.
- Scheduler snapshots use the same aggregate version for historical comparisons.
- Open UI refreshes current aggregate values after source updates.
- Regression coverage proves each migrated tab.

## Current Status

Production ready for the currently implemented Budget & Financial Analysis scope through Commit 7, with live/source-refresh validation still expected as integrations are exercised in deployed environments.

Proven:

- Documentation requires Campaign DeepDive subsections to aggregate main Connected Platform metrics at the campaign level.
- Performance Summary already has a source-aware aggregate contract through `/api/campaigns/:id/outcome-totals`.
- Budget & Financial Analysis completed tabs now use the shared aggregate contract for current financial totals, source capability checks, unavailable states, financial input provenance, budget allocation, and financial insights.
- Budget Pacing & Burn Rate now fails closed when required campaign dates are missing or invalid: Daily Burn Rate requires a valid campaign start date, and Target Daily Spend/Pacing Status require a valid start/end date range.
- Budget Pacing & Burn Rate allows users to fill, edit, or delete campaign budget/start/end metadata inline through the existing campaign update route, without entering calculated values directly.
- Financial Performance Insights are logical within the current aggregate contract: summary tones are value-based, source insights are sourced from spend-capable connected sources, scaling language is gated by budget/source conditions, and GA4-only campaigns do not receive paid-media optimization recommendations without a connected spend-capable ad platform.
- Scheduler-created snapshots include `metrics.performanceSummary`, and Budget & Financial trend indicators compare only compatible aggregate snapshots.
- The Budget & Financial page refetches current aggregate values while visible and on window focus so source updates are pulled into the UI through the same aggregate contract.

Outstanding:

- Complete deployed live/source-refresh validation after Render deploy.
- Keep documentation updated if future source integrations add new aggregate capabilities.
