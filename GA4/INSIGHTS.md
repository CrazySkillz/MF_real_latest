# GA4 Insights

## Purpose

This file is the short functional overview for the GA4 `Insights` tab.

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, and future-platform template guidance.

Current controlling answer:

`GA4 Insights is PRODUCTION_READY for the live-tab boundary certified at 65d1a5055e00e667e75046972c4e3da337874225. All local, exact-SHA deployment, authenticated owner/API/UI, non-owner isolation, cleanup, deterministic scheduler, and dependency-hash gates pass.`

## Document Ownership

The Insights documentation is intentionally split into two files:

- `GA4/INSIGHTS.md`
  Functional overview of the current GA4 Insights tab.
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
  Canonical source of truth for production readiness, root-cause history, validation evidence, and the reusable template for Meta, Google Ads, LinkedIn, and other future platform sources.

There is no separate `What to investigate next` production-readiness tracker anymore. That subsection is covered inside `GA4/INSIGHTS_PRODUCTION_READINESS.md` with the rest of the tab.

## Current Tab Structure

The current tab contains:

- `Executive financials`
- `Trends`
- `Data Summary`
- executive summary tracker cards
- `What to investigate next`

Important meaning:

- this tab is the GA4 campaign's executive interpretation layer
- it combines financial health, daily-history trends, operational summary, and prioritized investigation guidance
- it is not only a charting surface and not only an anomaly detector

## Scope Contract

GA4 Insights must remain scoped to:

- the selected campaign
- the selected client
- the connected GA4 property
- the saved GA4 campaign/source selection for that campaign
- the campaign reporting timezone when deciding completed daily history

Insights must not silently broaden to unrelated GA4 properties, campaigns, clients, or unselected source data.

## Section Summary

### Executive Financials

Shows:

- `Spend`
- `Revenue`
- `Profit`
- `ROAS`
- `ROI`

Current meaning:

- spend comes from active spend-source totals
- revenue is GA4 native revenue plus imported revenue sources when present
- source provenance is shown in the shared `Sources used` footer
- the copy is conditional on actual connected spend and revenue sources
- this section does not show Trends date-range or freshness metadata

### Trends

Shows completed daily-history views:

- `Daily`
- `7d`
- `30d`
- `Monthly`

Current meaning:

- Trends uses persisted GA4 daily facts for the selected campaign/property/scope
- Insights fetches 60 completed days through an isolated query so two exact 30-day windows can be evaluated without changing Overview or KPI windows
- today's intraday data is excluded until it becomes a completed reporting day
- `Completed-day cutoff`, `Latest imported day`, `Reporting timezone`, `Last refreshed`, and `Expected refresh` explain freshness
- `7d` and `30d` show rolling totals for non-rate metrics and weighted averages for rates
- missing GA4 rows are not synthesized as zero-value days and do not widen a comparison window

History gates:

- `Daily`: at least 2 completed daily rows; a delta is shown only when the actual prior calendar day exists
- `7d`: two complete adjacent 7-calendar-day windows
- `30d`: two complete adjacent 30-calendar-day windows
- `Monthly`: at least 2 calendar months; partial or incomplete months are labeled and are not compared with full months

### Data Summary

Shows compact operational context from currently available campaign values.

Current meaning:

- financial values use the same revenue and spend model as Executive Financials
- traffic values use the exact current 30-calendar-day completed-day window and remain visible for verified zero
- mixed-source financial values are shown as totals, not exact daily averages
- channel rows show the raw property/filter-scoped GA4 breakdown values and their own shares; values are never proportionally allocated to another total

### Tracker Cards

Shows:

- `Total insights`
- `High priority`
- `Needs attention`

Current meaning:

- tracker cards are derived from generated findings
- hidden findings must be disclosed when the visible list is capped

### What To Investigate Next

Shows grouped, rule-based executive guidance.

Current meaning:

- findings are grouped by investigation type
- invalid KPI or Benchmark targets are shown as configuration issues before performance conclusions
- cards include data-basis and confidence labels
- intro copy is history-aware
- recommendations are phrased as checks, not proven causal conclusions

## Certification Boundary

This document and the Insights certification cover only the live GA4 Insights tab. Reports, PDFs, report snapshots, scheduled reports, and email delivery belong to the Reports audit and are not Insights criteria, evidence, limitations, or deferred Insights work.

## Refresh Pattern

Insights is downstream of the GA4 refresh pipeline.

Inputs include:

- refreshed GA4 daily facts
- refreshed GA4 to-date values
- refreshed spend and revenue inputs
- refreshed KPI context
- refreshed Benchmark context

Important meaning:

- if Overview-driving values become fresher, Insights should become fresher on refetch or rerender
- GA4 can process Measurement Protocol events after the script or traffic event occurred, so values may increase later even when the seed script was not rerun
- Trends requires completed daily facts; same-day Overview changes do not automatically create a completed Trends row

## Production-Readiness Reference

For any future question such as:

- is Insights production-ready?
- is this section accurate?
- can this be used as a template for Meta or Google Ads?
- what must another platform implement before copying this pattern?

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md`.
