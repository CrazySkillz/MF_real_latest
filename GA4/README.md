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

Budget & Financial Analysis GA4 financial behavior is tracked in `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` and `GA4/FINANCIAL_SOURCES.md`. GA4 child revenue/spend inputs can feed aggregate financial totals, but Budget Allocation and Financial Performance Insights should treat spend-capable main Connected Platforms as the source set for allocation and paid-media optimization guidance.

## Reference Rule

For future development:

- reference `GA4/README.md` in high-level docs
- reference the tab-specific file when work is scoped to one tab
- reference `GA4/FINANCIAL_SOURCES.md` for any spend/revenue work, even if the visible bug is elsewhere
