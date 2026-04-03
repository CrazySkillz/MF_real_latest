# GA4 README

## Purpose

This folder is the canonical GA4 documentation set for this codebase.

Use it for all GA4-related development, reviews, testing, and bug fixes.

This is the GA4-specific companion to `ARCHITECTURE_USER_JOURNEY.md`.

## How To Use This Folder

Read these files in this order:

1. `GA4/README.md`
2. `GA4/OVERVIEW.md`
3. `GA4/REFRESH_AND_PROCESSING.md`
4. the specific tab doc you are changing
5. `GA4/FINANCIAL_SOURCES.md` if the work touches revenue, spend, ROAS, ROI, CPA, or imported values

## Canonical GA4 Journey

`Campaign Management -> campaign Overview -> Connected Platforms -> Google Analytics -> View Detailed Analytics`

Important meaning:

- the campaign `Overview` page is still the campaign hub
- `Connected Platforms` is the campaign-scoped launcher and connection-status section
- the GA4 page is the platform-specific analytics layer for that campaign
- the GA4 page is not the campaign-wide rollup page

## Doc Map

- `GA4/OVERVIEW.md`
  Covers the GA4 Overview tab, tables, card-population rules, and GA4 campaign scope.
- `GA4/FINANCIAL_SOURCES.md`
  Covers `Total Revenue`, `Total Spend`, the `+` source flows, provenance, edit/delete behavior, and computation rules.
- `GA4/KPIS.md`
  Covers KPI creation, display, current-value sourcing, gating, alerts, and KPI refresh behavior.
- `GA4/BENCHMARKS.md`
  Covers benchmark creation, industry autofill, status/progress, gating, alerts, and benchmark refresh behavior.
- `GA4/AD_COMPARISON.md`
  Covers the current comparison tab, its present campaign-comparison implementation, and refresh behavior.
- `GA4/INSIGHTS.md`
  Covers executive financials, trends, findings, action guidance, and budget/pacing notes.
- `GA4/REPORTS.md`
  Covers report creation, custom reports, scheduling, downloads, report-library behavior, and current-state caveats.
- `GA4/REFRESH_AND_PROCESSING.md`
  Covers schedulers, cross-tab dependency order, recomputation rules, and current-state notes for background freshness.

## Cross-Tab Dependency Rule

The required GA4 platform pattern is:

1. refresh `Overview` inputs first
2. recompute `KPIs`
3. recompute `Benchmarks`
4. refresh `Ad Comparison`
5. refresh `Insights`
6. let `Reports` package the refreshed tab state when generated or sent

## Reference Rule

For future development:

- reference `GA4/README.md` in high-level docs
- reference the tab-specific file when work is scoped to one tab
- reference `GA4/FINANCIAL_SOURCES.md` for any spend/revenue work, even if the visible bug is elsewhere
