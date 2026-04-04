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
- `What changed, what to do next`

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

## What Changed, What To Do Next

Each current finding includes:

- severity or priority
- title
- supporting description or evidence
- suggested next step when available

Important meaning:

- the findings list is a merged output from one insights engine
- it combines integrity/config checks, KPI context, benchmark context, anomaly signals, and financial/performance context
- not every item is a negative alert; the list can also contain positive or informational items

## Data Summary

The current `Data Summary` section is a supporting context block.

Its purpose is to give a quick at-a-glance performance summary using currently available campaign data before the user reads the deeper findings list.

Important meaning:

- `Executive financials` focuses on financial health
- `Data Summary` gives compact operational context
- `What changed, what to do next` is the action-oriented interpretation layer

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
