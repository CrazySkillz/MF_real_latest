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

## What Changed, What To Do Next

Each current finding includes:

- severity or priority
- title
- supporting description or evidence
- suggested next step when available

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
