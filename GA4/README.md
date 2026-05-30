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

Executive Summary Risk Assessment should show a fixed executive-facing `Risk inputs` list: KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, and Paid Platform Concentration Risk. For GA4-only campaigns, Paid Platform Concentration Risk should remain visible as `Not Applicable` because no main paid-media platform is connected. Visible ROI/ROAS risk-input values and KPI/Benchmark risk counts should use the same page-level `performanceSummary` aggregate as the Executive Summary metric cards, KPI Progress, and Benchmark Comparison. Budget pacing remains in Budget & Financial Analysis until Executive Summary has a shared pacing input.

Executive Summary Risk Assessment should refresh both its Executive Summary endpoint data and its page-level outcome totals aggregate when the page mounts or the browser regains focus. This keeps the six risk inputs aligned after GA4/current-source metrics, KPI targets, Benchmark targets, freshness state, compatible snapshots, or paid-source connections change.

Executive Summary should not block the full subsection on the secondary outcome-totals request. It should render from `/executive-summary` once available, then use `/outcome-totals` to align page-level aggregate values when that response arrives or refetches.

Executive Summary should preserve the active tab through the URL hash. Refreshing while viewing Strategic Recommendations should reload Strategic Recommendations, not reset to Executive Overview.

Executive Summary Strategic Recommendations now use source-capability gating. For GA4-only campaigns, the tab may show web/outcome guidance from available GA4 users, sessions, conversions, revenue, or CVR, but it must not show paid-media budget reallocation, paid platform diversification, scaling, ROAS/ROI, CPA, CPC, CTR, or CPM claims unless a main paid-media platform supplies the required inputs. GA4-only web/outcome guidance should state live revenue, conversion, and CVR outcomes plainly, compare mapped KPI/Benchmark targets for CVR, revenue, and conversions when available, and give a next action without making paid-media claims.

In GA4-only Strategic Recommendations, Website Outcomes `Expected Impact` should render as bullet points for readability. `Timeframe` should communicate the review/action window, and `Investment Required` should clarify that the recommendation is analysis-only unless a paid-media source is connected.

Strategic Recommendations are executive-ready in the implemented GA4-only scope when they show factual web/outcome guidance from available GA4/current-source values, target context when mapped KPI/Benchmark records exist, a clear next action, assumptions, and no paid-media claims. Recommendation inputs update through the Executive Summary refetch path: the endpoint recomputes source eligibility and target context, and the UI renders Website Outcomes values from page-level `performanceSummary.totals` after mount, window-focus, or active-tab interval refetch.

When GA4 is combined with paid-media integrations such as Google Ads, Executive Summary must use the same aggregate source composition as `/outcome-totals`. Paid-media sources should enter Executive Summary through normalized `platformSources` and must be covered in `/executive-summary`, `/outcome-totals`, scheduler snapshots, source freshness, KPI/Benchmark mapping, risk inputs, and Strategic Recommendation eligibility before that source mix is treated as production-ready. Paid-media `attributedRevenue` counts as an aggregate revenue input for Executive Summary eligibility when the source has a validated attribution path. Google Ads-specific OAuth/test-mode behavior, attribution, source UI, and metric correctness still need their own Connected Platforms refinement before Google Ads itself is considered production-ready; that is separate source work, not an Executive Summary implementation blocker.

Campaign DeepDive `Custom Report` production-readiness is tracked in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`. From Campaign DeepDive, Custom Report opens the Reports builder with campaign context, reads `/api/campaigns/:campaignId/outcome-totals`, and uses `performanceSummary.sources` plus `performanceSummary.totals` as the source of truth. For GA4-only campaigns, the metric picker and saved report output should expose only GA4-capable web analytics and outcome metrics such as users, sessions, conversions, revenue, and CVR when available. Paid-media metrics such as impressions, clicks, spend, CTR, CPC, CPM, CPA, paid-media ROAS, and paid-media ROI remain hidden until a connected main paid-media source supplies those inputs. Custom Report KPI and Benchmark sections use campaign records for rows and targets, while current values come from available aggregate metrics. All Reports cards are summary-only and should not show connected-source values, KPI/Benchmark row details, generated status pills, or `Includes` configuration details inline. The card edit icon should reopen the report dialog with saved values prefilled, show `Update Report`, and keep update disabled until a value changes. The top-level `Create Report` action should always open a blank create form instead of reusing values from the last edited report; unscheduled create mode should show `Download Report` and save the report under `Standard Reports`, while scheduled create mode should use `Schedule Automated Report`, show `Schedule Report`, save the report under `Scheduled Reports`, and create a backend scheduled report record through `/api/platforms/campaign_deepdive/reports` so `server/report-scheduler.ts` can send the email. When opened from Campaign DeepDive Custom Report, the report type dropdown should show Campaign DeepDive subsection report types and allow users to select which tabs from the selected subsection to include; selected tabs are saved as report composition in `selectedSections`. Downloaded Campaign DeepDive subsection PDFs should render body content for each selected tab from `performanceSummary.totals` and `performanceSummary.sources`, not only the selected tab names. Scheduled Campaign DeepDive PDFs should also render selected section body content from a shared latest-value server context that includes campaign context, `performanceSummary`, Executive Summary context where selected, KPI rows, Benchmark rows, and Trend Analysis aggregate only when selected. The final scheduled-email acceptance checklist lives in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md` under `Deployed Scheduled Email Evidence Checklist`; it remains pending until a real scheduled send confirms receipt, selected section body content, and values matching the current app at send time. The standalone `/reports` route is not represented as a sidebar Reports item.

Executive Summary status is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Executive Summary Status Map`. Completed aggregate future-proofing work is tracked under `Completed Executive Summary future-proofing checklist`. Google Ads platform-specific refinement is tracked separately from Executive Summary aggregate-readiness.

The Executive Summary future-platform acceptance gate is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Future Connected Platform acceptance gate`. This is a standing rule for future or refined main sources, not an open Executive Summary implementation task. A new or refined platform is not production-ready as an Executive Summary source until it passes the shared aggregate, `/outcome-totals`, `/executive-summary`, scheduler snapshot, KPI/Benchmark, Risk input, Strategic Recommendation, regression, and deployed-validation checks.

The Executive Summary deployed-validation checklist is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Deployed validation checklist and evidence log`. It is an acceptance evidence log for deployed source mixes, not a separate implementation task. Scenario evidence should remain incomplete until GA4-only, GA4 plus refined Google Ads, and GA4 plus multiple-paid-source campaign variants are validated in a deployed or production-like environment.

Executive Summary and `/outcome-totals` should enter the shared aggregate contract through the same route-level aggregate wrapper so future refined main platform sources use one source-composition path before being passed to `buildPerformanceSummaryAggregate`.

Scheduler snapshots that feed Executive Summary `7-Day Snapshot Trajectory` must include the same normalized main source set in `metrics.performanceSummary`. For the current future-proofing slice, Google Ads rows are passed into scheduler snapshot `performanceSummary` as a normalized `platformSources` source; future platforms need the same scheduler wiring before they are production-ready in Executive Summary.

GA4-only Strategic Recommendations regression coverage should guard four cases: web/outcome guidance with targets, web/outcome guidance without targets, paid-media guidance remaining blocked, and insufficient GA4/web inputs producing no recommendation instead of zero-filled claims.

Executive Summary KPI Progress should be fed by campaign-level KPI records whose current value can be mapped to available GA4/connected-source aggregate metrics. Campaign-level KPI create, update, and delete actions should refresh the campaign Executive Summary query so KPI Progress reflects the latest KPI list and targets. Targets come from campaign-level KPI records, but current values, progress percentages, and statuses should render from live GA4/connected-source aggregate values for metrics such as users, sessions, conversions, revenue, ROI, ROAS, CTR, or CVR. Executive Summary must not silently fall back to saved KPI progress/current values when a KPI cannot be mapped to an available aggregate metric.

Executive Summary Benchmark Comparison should follow the same source-of-truth rule. Campaign-level Benchmark records define the rows and benchmark targets, and campaign-level Benchmark create, update, and delete actions should refresh the campaign Executive Summary query. `Yours` current values should come from live GA4/connected-source aggregate metrics when mapped and available. Executive Summary must not silently fall back to saved Benchmark `currentValue` snapshots for unmapped or unavailable current values.

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
