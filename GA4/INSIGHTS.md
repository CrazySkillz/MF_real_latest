# GA4 Insights

## Purpose

This file defines the GA4 `Insights` tab.

This tab is the "so what / what should I do next" layer for the GA4 campaign.

## Current Tab Structure

The current tab contains:

- `Executive financials`
- `Trends`
- `Data Summary`
- an executive summary tracker panel
- `What to investigate next`

Important meaning:

- this tab combines summary, diagnostics, trend context, and action guidance
- it is not just a charting or anomaly surface

## Executive Financials

The `Executive financials` section summarizes:

- `Spend`
- `Revenue`
- `Profit`
- `ROAS`
- `ROI`

It also shows source provenance.

Important meaning:

- it is built from the same financial model as the Overview cards
- it is the executive-facing campaign finance summary
- provenance belongs in the shared `Sources used` footer for the section, not as repeated microcopy under each individual `Spend`, `Revenue`, `Profit`, `ROAS`, or `ROI` card
- the Revenue provenance line should list the full active revenue-source set used in the totals, including the GA4-native revenue row when GA4 native revenue exists

## Data Integrity And Configuration Checks

The current Insights engine already checks for:

- missing GA4 totals
- missing revenue
- missing spend
- spend without revenue
- revenue without spend
- blocked KPIs
- blocked benchmarks

These checks are actionable and should remain part of the tab.

## Performance / Anomaly Signals

The current Insights engine includes:

- KPI performance context
- benchmark performance context
- week-over-week anomaly checks
- short-window anomaly checks
- positive momentum signals
- channel and campaign observations

## Executive-Friendly Summary

The current tracker panel shows:

- `Total insights`
- `High priority`
- `Needs attention`

Current meaning:

- `Total insights`
  Count of all generated insight items currently shown by the findings engine.
- `High priority`
  Count of insight items currently classified as high severity.
- `Needs attention`
  Count of insight items currently classified as medium severity.

Important meaning:

- positive and informational items may exist in the findings list without contributing to `High priority` or `Needs attention`
- the summary cards are derived from the current findings list, not a separate source of truth

## Trends

The current `Trends` section supports:

- `Daily`
- `7d`
- `30d`
- `Monthly`

Users can switch the viewed metric and see:

- a chart
- a comparison table

Important meaning:

- trends depend on enough daily history being available
- some trend modes need more history than others
- `Users` is currently only available in `Daily` mode in the present implementation

## Trends Current-State Observation

The current `Trends` implementation is not just a test-mode chart.

Current code-path meaning:

- in test mode, the tab can render from simulated GA4 daily data
- in production mode, the tab is intended to render from persisted GA4 daily facts for the selected GA4 property and the campaign's selected GA4 campaign scope
- if persisted daily rows are missing, the current backend attempts an on-demand backfill from the real GA4 Data API and then persists those rows
- the chart and comparison tables are then built from those persisted daily rows

Important meaning:

- this should populate accurately in production if the GA4 connection is valid and daily facts are being ingested/persisted correctly
- this is not a mock-only design
- the main production risk is operational freshness and history availability, not that the Trends UI is hardwired to simulated data

## GA4 Insights Trends Production-Readiness Checklist

Use this checklist after the full GA4 manual-user-journey pass is complete.

Data availability:

- confirm the campaign has a valid GA4 access-token connection
- confirm the correct GA4 property is selected
- confirm the campaign's GA4 campaign filter/scope is correct
- confirm persisted GA4 daily rows exist for the campaign/property

History sufficiency:

- confirm `Daily` has at least `2` days of history
- confirm `7d` has at least `14` days of history
- confirm `30d` has at least `60` days of history
- confirm `Monthly` has at least `2` calendar months if month-over-month comparison is expected

Metric integrity:

- confirm daily rows contain expected values for `sessions`, `users`, `pageviews`, `conversions`, `revenue`, and `engagementRate`
- confirm `Users` is only exposed in `Daily` mode
- confirm `7d`, `30d`, and `Monthly` values are coherent with the daily rows they summarize

Refresh/freshness:

- confirm the GA4 daily scheduler is running in the deployed environment
- confirm an empty daily-facts table can be backfilled on demand from the real GA4 Data API
- confirm normal refetch paths do not leave Trends stale relative to refreshed GA4 daily rows

Error handling:

- confirm expired or invalid GA4 tokens surface a reconnect/reauthorization path
- confirm missing-history states show clear UI guidance rather than misleading zeroes

Cross-tab consistency:

- confirm Insights `Trends` uses the same persisted GA4 daily facts as other daily-value GA4 surfaces
- confirm Insights trend totals remain coherent with Overview and KPI/Benchmark context after refresh

## What To Investigate Next

Each current finding includes:

- severity or priority
- title
- supporting description or evidence
- suggested next step when available

Important meaning:

- the findings list is a merged output from one insights engine
- it combines integrity/config checks, KPI context, benchmark context, anomaly signals, and financial/performance context
- not every item is a negative alert; the list can also contain positive or informational items

## Current Limits Of Recommendations

The current `What to investigate next` section is rule-based and logically grounded, but it should be treated as executive directional guidance rather than a fully causal diagnostic engine.

Current meaning:

- findings are generated from explicit rules, thresholds, KPI/Benchmark state, GA4 daily history, and simple channel heuristics
- recommendations are intended to suggest recommended checks and sensible starting points for investigation
- recommendations do not prove root cause

Important current limits:

- revenue-related recommendations are only partially aligned with the app's full financial model when imported revenue is important
- GA4 channel/revenue observations are based on GA4-attributed campaign/channel data, not a full attributed allocation of all imported external revenue
- if a campaign relies heavily on imported revenue, executive financial totals may still be correct while some revenue-change guidance remains more GA4-specific than full-funnel
- informational revenue averages are directionally useful, but less rigorous when imported revenue is snapshot-style rather than true daily history

Practical interpretation:

- trust the section as a consistent rule-driven summary layer
- use it to prioritize what to inspect next
- do not treat it as definitive causal attribution

## Data Summary

The current `Data Summary` section is a supporting context block.

Its purpose is to give a quick at-a-glance performance summary using currently available campaign data before the user reads the deeper findings list.

Important meaning:

- `Executive financials` focuses on financial health
- `Data Summary` gives compact operational context
- `What to investigate next` is the action-oriented interpretation layer

## Budget / Pacing Prompt Pattern

The intended pattern includes a campaign-budget nudge when:

- campaign budget is not set
- enough spend and history exist to support pacing-style warnings

Purpose:

- prompt the user to add a budget
- unlock pacing-style executive warnings and alerts

## Current-State Note

- campaign budget already exists as campaign configuration upstream of Insights
- the campaign setup flow describes budget as enabling spend tracking and pacing alerts in Insights
- the current GA4 Insights tab does not clearly surface a dedicated GA4-specific budget-entry or pacing-unlock prompt yet

## Insights Refresh Pattern

Insights is downstream of the GA4 data-refresh pipeline.

Its inputs include:

- refreshed GA4 daily facts
- refreshed GA4 to-date values
- refreshed spend and revenue inputs
- refreshed KPI context
- refreshed benchmark context

Important meaning:

- if Overview-driving values become fresher, Insights should become fresher on refetch or rerender
