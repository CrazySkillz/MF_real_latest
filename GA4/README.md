# GA4 README

## Purpose

This folder is the canonical GA4 documentation set for this codebase.

Use it for all GA4-related development, reviews, testing, and bug fixes.

This is the GA4-specific companion to `ARCHITECTURE_USER_JOURNEY.md`.

Campaign-level KPI/Benchmark production-readiness tracking lives in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`. GA4 is the first connected platform being validated against that campaign-level standard.

## How To Use This Folder

Use these files in this order:

1. `GA4/README.md`
2. `GA4/REFRESH_AND_PROCESSING.md`
3. `GA4_DEVELOPMENT_WORKFLOW.md` for GA4 stabilization, fix sequencing, regression checks, and testing workflow
4. the specific tab doc you are changing
5. `GA4/OVERVIEW.md` when the work touches Overview behavior, card/table meaning, or GA4 scope
6. `GA4/FINANCIAL_SOURCES.md` if the work touches revenue, spend, `Latest Day Revenue`, `Latest Day Spend`, `Profit`, `ROAS`, `ROI`, `CPA`, source modal provenance, or imported values

## Canonical GA4 Journey

`Campaign Management -> click on campaign -> campaign-level Overview -> Connected Platforms -> Google Analytics -> View Detailed Analytics`

Important meaning:

- the campaign `Overview` page is still the campaign hub
- `Connected Platforms` is the campaign-scoped launcher and connection-status section
- the GA4 page is the platform-specific analytics layer for that campaign
- the GA4 page is not the campaign-wide rollup page
- the GA4 property and GA4 campaign values are selected during setup; the GA4 analytics page displays the saved scope and does not provide a post-setup campaign picker
- revenue and spend sources configured inside GA4, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports, are GA4/campaign financial child inputs; users do not connect them from the campaign `Connected Platforms` section, and they feed financial totals only through the GA4/campaign financial path
- Campaign DeepDive `Performance Summary` must consume GA4 and every other implemented main Connected Platform through the shared connected-source aggregate contract, not by special-casing GA4-only UI logic
- Campaign DeepDive must not require duplicate setup for GA4 child revenue/spend systems; those child inputs should affect only the relevant financial totals and should not appear as separate main Connected Platforms
- Campaign DeepDive `Platform Comparison` may show GA4 single-source aggregate financial totals in the Overview table when GA4 is the only main Connected Platform, but GA4 remains a web analytics source and should not be treated as a paid-media source for Cost Analysis or budget recommendations
- Campaign DeepDive `Trend Analysis` production-readiness work is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`; its Overview, Efficiency Metrics, Conversion Funnel, Platform Breakdown, and Insights tabs consume the source-aware trend aggregate so GA4-only campaigns show only GA4-capable trend metrics and executive recommendations.
- Campaign DeepDive `Executive Summary` production-readiness work is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`; GA4-only campaigns should show GA4-capable web analytics and outcome metrics, while paid-media metrics such as impressions, clicks, CTR, CPC, CPM, and paid-media recommendations remain unavailable unless a main paid-media platform supplies the required inputs.

## Doc Map

- `GA4/OVERVIEW.md`
  Covers the GA4 Overview tab, tables, card-population rules, and GA4 campaign scope.
- `GA4/KPIS.md`
  Covers KPI creation, display, current-value sourcing, gating, alerts, and KPI refresh behavior.
- `GA4/BENCHMARKS.md`
  Covers benchmark creation, custom benchmark values, status/progress, gating, alerts, and benchmark refresh behavior.
- `GA4/AD_COMPARISON.md`
  Covers the current comparison tab, its present campaign-row comparison implementation, and refresh behavior.
- `GA4/INSIGHTS.md`
  Covers executive financials, trends, findings, action guidance, and budget/pacing notes.
- `GA4/REPORTS.md`
  Covers report creation, custom reports, scheduling, downloads, report-library behavior, and current-state caveats.
- `GA4/REFRESH_AND_PROCESSING.md`
  Covers schedulers, cross-tab dependency order, recomputation rules, and current-state notes for background freshness.
- `GA4_DEVELOPMENT_WORKFLOW.md`
  Covers the recommended GA4 bug-fix, regression-testing, and manual-testing workflow for stabilizing the platform safely.
- `GA4/FINANCIAL_SOURCES.md`
  Covers `Total Revenue`, `Total Spend`, the `+` source flows, source modal provenance, edit/delete behavior, and computation rules.

## Overview Vs Financial Sources

- `GA4/OVERVIEW.md` explains what the Overview tab contains and how its cards/tables should be understood
- `GA4/FINANCIAL_SOURCES.md` explains the underlying revenue/spend source system that feeds Overview and other GA4 tabs

Why this file is separate:

- refresh and processing is shared platform infrastructure, not one tab's behavior
- it affects `Overview`, `KPIs`, `Benchmarks`, `Ad Comparison`, `Insights`, and `Reports`
- keeping it separate avoids duplicating the same refresh rules across multiple tab docs

## Cross-Tab Dependency Rule

The required GA4 platform pattern is:

1. refresh `Overview` inputs first
2. recompute `KPIs`
3. refresh the KPI `Executive snapshot`
4. recompute `Benchmarks`
5. refresh the Benchmark `Executive snapshot`
6. refresh `Ad Comparison`
7. refresh `Insights`
8. let `Reports` render from refreshed tab state when generated or sent

## Template Readiness Status

GA4 is ready to use as the implementation template for the next integration work.

This means future integrations should copy the validated GA4 patterns for:

- campaign and platform scoping
- source add/edit/delete/refresh identity
- scheduler fail-closed behavior
- KPI/Benchmark recompute ordering
- alert/notification visibility behavior
- report create/update/delete/snapshot/test-send/scheduled-send safety
- shared PDF generation and transactional report email delivery

Do not copy old legacy shortcuts or create parallel paths. If a new integration needs different provider-specific behavior, keep that behavior inside the existing platform-specific layer while preserving the same campaign-scoped architecture.

For future main Connected Platforms, the integration is not complete until it also participates in the Campaign DeepDive aggregate contract through the generic source contract: source identity, capabilities, included/excluded metric reasons, freshness, current totals, scheduler snapshot inputs, and regression coverage. Future standalone platforms such as Google Ads, TikTok, Instagram, and other sources should plug into the same aggregate contract instead of adding Performance Summary tab-specific logic.

Performance Summary GA4 validation should use the live/mock GA4 test-property setup documented in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`. That setup validates GA4 data changes over time, app refresh, updated Performance Summary current values, compatible snapshot creation, `What's Changed`, and `Metric Trends`. It requires at least two compatible snapshots for trends, two comparable periods for `What's Changed`, seven or more days for `Last 7 Days`, and thirty or more days for `Last 30 Days`.

Budget & Financial Analysis GA4 financial behavior is tracked in `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` and `GA4/FINANCIAL_SOURCES.md`. GA4 child revenue/spend inputs can feed aggregate financial totals, but Budget Allocation and Financial Performance Insights should treat spend-capable main Connected Platforms as the source set for allocation and paid-media optimization guidance. Budget & Financial current values refetch through the same aggregate contract while visible and on window focus, and trend comparisons must use compatible aggregate snapshots rather than legacy top-level snapshot totals.

Platform Comparison GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`. GA4 should appear as the main Google Analytics source, not as separate child revenue/spend inputs. The Overview table can display aggregate Spend, ROAS, and ROI for a GA4-only campaign when the shared aggregate has those totals, while Cost Analysis and paid-media Insights remain unavailable until a main paid-media platform with source-level spend is connected.

Trend Analysis GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`. The Trend Analysis aggregate returns connected main sources, daily rows, source capabilities, included metrics, unavailable reasons, and aggregate daily totals. The Overview, Efficiency Metrics, Conversion Funnel, Platform Breakdown, and Insights tabs now use that aggregate, so GA4-only campaigns should show GA4-capable trends such as sessions, users, conversions, revenue, CVR, and engagement rate where available, while paid-media metrics remain unavailable unless a main paid-media platform supplies the required inputs.

Executive Summary GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`. Its current endpoint now includes the shared `performanceSummary` aggregate and should use aggregate availability to decide which Executive Overview metrics are shown. GA4-only Executive Summary validation should confirm Google Analytics appears as the main source, active GA4-context financial child sources can appear as `category: "financial"` provenance in `performanceSummary.sources`, and stale paid-media sources such as Meta/Facebook do not appear unless the main paid-media platform is connected. The Marketing Funnel Performance chart should make the GA4-only path explicit as users -> sessions -> conversions -> revenue, so executives can see whether the bottleneck is traffic reaching the site, sessions/engagement, conversion, or financial return.

For a newly connected mock-live GA4 campaign, Executive Summary can validate current connected-source metrics immediately, but 7-day snapshot trajectory should show `Not enough history` until compatible `performanceSummary` snapshots exist for both the latest point and the point roughly seven days earlier. This trajectory is independent of the removed Executive Summary date dropdown. This newly connected mock-live path is the best validation path for the no-history state because existing mock campaigns may already have seeded or legacy snapshot history. Risk Level is different from trajectory: it should populate immediately from current available connected-source inputs. Seven days is the default trajectory window because 1-2 day comparisons are too noisy for executive direction, while 30 days is slower than needed for an Executive Summary signal. Outstanding validation: connect a new mock-live GA4 campaign, confirm current GA4 metrics and Risk Level populate immediately, confirm `7-Day Snapshot Trajectory` initially shows `Not enough history`, and later confirm trajectory appears only after compatible `performanceSummary` snapshot history exists.

Executive Summary should not show Campaign Grade or Health Score in the UI. Those values may still exist in the backend response for API compatibility, but they are product-defined heuristics rather than direct GA4 or connected-source metrics. The narrative Executive Summary paragraph should also avoid hidden grade/score wording and should state factual available ROI/ROAS from the same `performanceSummary` aggregate used by the visible Executive Overview metrics, plus Risk Level and 7-day snapshot trajectory state. GA4 validation should focus on connected-source metrics, Marketing Funnel Performance, Risk Level, and 7-day snapshot trajectory state. The separate Campaign Story paragraph and duplicate Platform Performance card should not appear in Executive Summary; platform-level side-by-side detail belongs in Platform Comparison.

Executive Summary KPI Progress should be fed by campaign-level KPI records whose current value can be mapped to available GA4/connected-source aggregate metrics. Campaign-level KPI create, update, and delete actions should refresh the campaign Executive Summary query so KPI Progress reflects the latest KPI list and targets. Targets come from campaign-level KPI records, but current values, progress percentages, and statuses should render from live GA4/connected-source aggregate values for metrics such as users, sessions, conversions, revenue, ROI, ROAS, CTR, or CVR. Executive Summary must not silently fall back to saved KPI progress/current values when a KPI cannot be mapped to an available aggregate metric.

Executive Summary Benchmark Comparison should follow the same source-of-truth rule. Campaign-level Benchmark records define the rows and benchmark targets, while `Yours` current values should come from live GA4/connected-source aggregate metrics when mapped and available. Executive Summary must not silently fall back to saved Benchmark `currentValue` snapshots for unmapped or unavailable current values.

The Trend Analysis `Insights` tab should provide executive recommendations from the other aggregate-backed Trend Analysis tabs. It should not use Google Trends keyword widgets as campaign performance recommendations, and it should not show the page-level history dropdown because it summarizes the other Trend Analysis views.

Trend Analysis scheduler snapshots now store `metrics.trendAnalysis` using the same `trend_analysis_aggregate_v1` contract. Manual snapshots, platform-sync snapshots, and automatic scheduler snapshots should therefore carry compatible Trend Analysis history while legacy snapshots without `metrics.trendAnalysis` remain incompatible and should not be used for aggregate trend comparisons.

For current `yesop` mock GA4 campaigns, validate Trend Analysis against the same date window used by the GA4 platform view. If the mock campaign was created or viewed with a 90-day scope, choose `Last 90 Days` in Trend Analysis. Mock validation proves source-aware wiring and date-window behavior; final numeric accuracy still requires the planned mock-live GA4 account with controlled daily data.

Current Render validation for Trend Analysis proves UI and aggregate-contract wiring only. Full historical trend accuracy requires the planned mock-live GA4 account, because Trend Analysis needs multiple saved daily records from different days to prove Day 2 versus Day 1 comparison and later 7-day/30-day windows. New snapshots after the scheduler alignment should include `metrics.trendAnalysis.version = "trend_analysis_aggregate_v1"`; older snapshots without that block are legacy history and should not be used as proof of Trend Analysis historical accuracy.

For the Trend Analysis Conversion Funnel tab, current mock-placeholder validation should confirm that GA4 appears only as a web analytics source and paid-media funnel metrics remain unavailable unless a main paid-media platform supplies impressions or clicks. Full-period funnel trend validation should be done later with the planned mock-live GA4 account after enough controlled daily rows exist.

For the Trend Analysis Platform Breakdown tab, current mock-placeholder validation should confirm that Google Analytics appears as the main connected source and child revenue/spend inputs do not appear as separate platforms. Full historical breakdown validation should be done later with the planned mock-live GA4 account after enough controlled daily rows exist.

## Reference Rule

For future development:

- reference `GA4/README.md` in high-level docs
- reference the tab-specific file when work is scoped to one tab
- reference `GA4/FINANCIAL_SOURCES.md` for any spend/revenue work, even if the visible bug is elsewhere
