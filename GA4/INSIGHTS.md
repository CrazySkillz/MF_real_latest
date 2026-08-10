# GA4 Insights

## Purpose

This file is the short functional overview for the GA4 `Insights` tab.

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, and future-platform template guidance.

Current controlling answer:

`GA4 Insights is PRODUCTION_READY for exact deployed runtime 3e6b46c6c65721df21b437109ea698f615f8a353 and the dependency/configuration boundary recorded on 2026-08-10 (Europe/Amsterdam). GA4/certifications/ga4-insights.json is the controlling machine record; any listed dependency or configuration change invalidates this revision-specific certification.`

## Document Ownership

The Insights documentation is intentionally split into two files:

- `GA4/INSIGHTS.md`
  Functional overview of the current GA4 Insights tab.
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
  Canonical source of truth for production readiness, root-cause history, validation evidence, and the reusable template for later Meta, LinkedIn, Instagram, Google Ads, and other platform releases. Google Ads is outside the current Insights certification boundary because no authorized live test account is available.

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

Current-release source boundary:

- Insights has no add-source chooser; the `Total Revenue` and `Total Spend` `+` controls belong to Overview and are not changed or certified by the Insights audit
- Google Ads is outside the current Insights certification because no authorized live test account is available; its separate Overview availability is unchanged by this boundary
- LinkedIn, Meta/Facebook, and Instagram connectors and analytics are not enabled as Insights inputs for this release
- explicit LinkedIn, Meta, or Instagram platform-context records must not contribute to GA4 Insights financial totals
- Insights may consume only financial totals already produced by documented campaign-owned source paths; it must not mutate Overview source selection, source lifecycle, calculations, availability gates, or rendering
- for native GA4 revenue, the shared Overview/Insights to-date request supplies the campaign currency to the Data API and verifies the returned response `currencyCode` and `timeZone`; both tabs therefore use the same native monetary value

## Section Summary

### Executive Financials

Shows:

- `Spend`
- `Revenue`
- `Profit`
- `ROAS`
- `ROI`

Current meaning:

- spend comes from active campaign-owned GA4-context spend-source totals
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
- Insights requests an isolated 60-calendar-day window through the latest completed reporting day so two exact 30-day windows can be evaluated without changing Overview or KPI windows; GA4 may return sparse rows, so returned row count is not treated as consecutive-day coverage
- today's intraday data is excluded until it becomes a completed reporting day
- `Completed-day cutoff`, `Latest imported day`, and `Last refreshed` explain freshness
- `7d` and `30d` show rolling totals for non-rate metrics and weighted averages for rates
- missing GA4 rows are not synthesized as zero-value days and do not widen a comparison window
- explicit zero engaged sessions remain zero; only a genuinely absent legacy value is derived from that row's sessions and engagement rate

History gates:

- `Daily`: at least 2 imported daily rows; the chart considers up to 30 calendar days through the latest imported day, begins at the first imported date in that window, renders later missing dates as gaps rather than connecting non-consecutive observations, preserves valid zero, and shows a delta only when the actual prior calendar day exists
- `7d`: the chart shows every complete historical 7-calendar-day rolling window in the visible history; the latest comparison requires two complete adjacent 7-calendar-day windows
- `30d`: the chart shows every complete historical 30-calendar-day rolling window in the visible history; the latest comparison requires two complete adjacent 30-calendar-day windows
- `Monthly`: at least 2 calendar months; partial or incomplete months are labeled and are not compared with full months

### Data Summary

Shows compact recent GA4 traffic and channel context for the imported reporting dates.

Current meaning:

- traffic values use the exact current 30-calendar-day completed-day window and remain visible for verified zero
- when the standard acquisition response is partial, Insights uses session-campaign-scoped landing-page rows for traffic and standard GA4 acquisition rows for conversions/revenue, merged only by exact date/source/medium and filtered to the imported dates used by Data Summary; the result is shown only when every displayed metric total reconciles
- channel rows render only when their dates, Sessions, and Conversions exactly match the daily-summary window; otherwise they are withheld rather than allocated or estimated
- channel share copy names the raw breakdown-session denominator, and a lowest-conversion-rate channel is identified only when one channel is uniquely lower at the displayed one-decimal precision
- campaign-to-date financial values remain in Executive Financials and are not duplicated in Data Summary

### Tracker Cards

Shows:

- `Total findings`
- `High-severity findings`
- `Medium-severity findings`

Current meaning:

- tracker cards are derived from generated findings
- hidden findings must be disclosed when the visible list is capped
- verified KPI and Benchmark conclusions are counted separately; shared unverified-source effects are consolidated
- total findings also include positive and informational items
- grouped badges state how many findings are shown in the capped summary

### What To Investigate Next

Shows grouped, rule-based executive guidance.

Current meaning:

- findings are grouped by investigation type
- invalid KPI or Benchmark targets are shown as configuration issues before performance conclusions
- KPI target findings require an explicit 30-day tracking period for 30-day traffic values; campaign-to-date financial values require a campaign-to-date target
- below-target KPI findings use factual `Below Saved Target` wording and the priority saved on that KPI; attainment percentage does not invent severity
- every verified, period-compatible KPI below its saved target is shown; arbitrary attainment bands do not hide a miss
- Benchmark findings require an explicitly matching reporting period; incompatible targets are withheld and summarized as one configuration finding
- the period-mismatch finding identifies each affected saved target and value
- cards include data-basis and confidence labels
- unverified KPI and Benchmark evaluations are consolidated into one data-readiness finding instead of presenting one shared source failure as many business issues
- missing snapshot history is reported as unavailable and does not assume that a future scheduler run will succeed
- generic total-ROAS strength findings are withheld because ROAS alone does not prove profitability or a channel-level scaling opportunity
- the page header remains stable while loading and freshness details stay in the relevant finding cards
- tracker counts and finding cards remain withheld during the initial multi-query load, then render once from settled inputs; background refetches retain the last stable query data
- normal Insights page loads read the overlapping 30-day and 60-day stored daily windows without replacing them; scheduled or explicit refresh pipelines remain responsible for persistence
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

Financial KPI/Benchmark snapshots consumed by Insights use the same campaign-to-date native-revenue and source-currency rules as the live financial cards. For real GA4 properties, an incomplete or failed live to-date response is unavailable; retained daily rows or a configured-lookback breakdown are not substituted for that different window. Last-good values may remain stored, but no new financial history point is recorded for an unavailable input.

Important meaning:

- if Overview-driving values become fresher, Insights should become fresher on refetch or rerender
- GA4 can process Measurement Protocol events after the script or traffic event occurred, so values may increase later even when the seed script was not rerun
- Trends requires completed daily facts; same-day Overview changes do not automatically create a completed Trends row
- the dedicated Google Ads scheduler refreshes provider daily facts, materializes the exact saved GA4 spend source through the latest completed campaign day, and then recomputes dependent KPI/Benchmark values; the general external-value scheduler does not duplicate that GA4 Google Ads write

## Production-Readiness Reference

For any future question such as:

- is Insights production-ready?
- is this section accurate?
- can this be used as a template for Meta, LinkedIn, Instagram, or another later platform release?
- what must another platform implement before copying this pattern?

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md`.
