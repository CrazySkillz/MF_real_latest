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
- Other Budget & Financial tabs still use the previous calculations and are intentionally deferred to later commits.
- Regression coverage updated in `server/campaign-financial-analysis-regression.test.ts`.

### Commit 3: ROI & ROAS Tab

- Wire total ROI/ROAS to aggregate revenue and spend.
- Replace hardcoded platform breakdowns with source breakdowns from the aggregate.
- Preserve child-source distinction for GA4 financial inputs.
- Add regression coverage for revenue/spend availability and no double-counting.

### Commit 4: Cost Analysis Tab

- Wire CPC, CPA, CPM, CTR, and CVR to aggregate metrics.
- Show unavailable states when clicks, impressions, conversions, or spend are missing.
- Add regression coverage proving GA4-only campaigns do not render paid-media cost metrics as zero.

### Commit 5: Budget Allocation Tab

- Build allocation from spend-capable connected sources only.
- Avoid allocation recommendations when only one or zero spend-capable sources exist.
- Add regression coverage for one-source, multi-source, and child-source cases.

### Commit 6: Insights Tab

- Refactor insights to use aggregate source capabilities and aggregate financial metrics.
- Prevent paid-media optimization recommendations for analytics-only sources.
- Add regression coverage for GA4-only, multi-paid-source, and missing-input cases.

### Commit 7: Scheduler, History, Docs, Final Validation

- Align any historical Budget & Financial comparison logic with compatible aggregate snapshots.
- Ensure the page refetches aggregate values while visible and on window focus, matching the Performance Summary synchronization behavior.
- Update `ARCHITECTURE_USER_JOURNEY.md`, `GA4/README.md`, `GA4/FINANCIAL_SOURCES.md`, and this tracker.
- Run targeted tests, `npm run check`, and `npm run build`.

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

Not production ready.

Proven:

- Documentation requires Campaign DeepDive subsections to aggregate main Connected Platform metrics at the campaign level.
- Performance Summary already has a source-aware aggregate contract through `/api/campaigns/:id/outcome-totals`.
- Budget & Financial Analysis currently uses page-local source-specific aggregation.

Outstanding:

- Wire Budget & Financial Analysis to the shared aggregate contract.
- Remove tab-local hardcoded source aggregation from normal loaded paths.
- Add unavailable metric handling.
- Add source-capability-driven tab rendering.
- Add scheduler/history alignment where applicable.
- Add regression coverage.
- Update documentation as each fix is completed.
