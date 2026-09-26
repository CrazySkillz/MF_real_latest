# GA4 Insights

## Purpose

This file is the short functional overview for the GA4 `Insights` tab.

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md` for the tab-level production-readiness record and `GA4/INSIGHTS_FINDINGS_CERTIFICATION_2026-09-18.md` for the separate, exact-revision findings and tracker-card certificate.

<!-- ga4-insights-current-status -->
<!-- ga4-insights-certification-status: UNVERIFIED -->

Current controlling answer:

GA4 Insights is **UNVERIFIED for the current implementation** pending exact-revision deployed recertification. The current behavior was introduced through `4372efadc96523c9df2abe2dd7915f9e1a0443a7` and is unchanged in the later application runtime `ca1fc5a873ab69fb747937768c31fcd53e16fd64`. Historical Insights certificates remain valid only for their recorded revisions and behavior; they do not certify the current scheduler-only, zero-filled implementation. Reports-owned behavior remains covered separately.

<!-- /ga4-insights-current-status -->

The findings-only certificate below records the separate deployed `6673a976f98d853b9eb37ddc99a2afc195f302d9` historical boundary.

## Document Ownership

The Insights documentation has separate scopes:

- `GA4/INSIGHTS.md`
  Functional overview of the current GA4 Insights tab.
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
  Canonical source of truth for production readiness, root-cause history, validation evidence, and the reusable template for later Meta, LinkedIn, Instagram, Google Ads, and other platform releases. Google Ads is outside the current Insights certification boundary because no authorized live test account is available.
- `GA4/INSIGHTS_FINDINGS_CERTIFICATION_2026-09-18.md`
  Subsection-only evidence for the on-screen findings and Total/High/Medium cards on deployed revision `6673a976f98d853b9eb37ddc99a2afc195f302d9`.

The subsection certificate does not recertify the other Insights sections or Reports.

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

The current Trends-only implementation and exact-runtime evidence are in
`GA4/INSIGHTS_TRENDS_CERTIFICATION_2026-09-17.md`. Earlier whole-Insights
readiness records describe their own revision-specific Trends behavior.

Shows completed daily-history views:

- `Daily`
- `7d`
- `30d`
- `Monthly`

Current meaning:

- Trends uses persisted GA4 daily facts for the selected campaign/property/scope and shows only reporting dates on or after the campaign creation calendar date in the campaign reporting timezone; this display filter does not delete pre-creation stored rows or change other sections
- Insights requests an isolated 60-calendar-day stored-history window so two exact 30-day windows can be evaluated without changing Overview or KPI windows; legacy storage may be sparse, so the visible campaign calendar is materialized separately through `Chart through`
- all normal browser daily-history requests are read-only; Insights Trends renders scheduler-produced stored facts and does not run a live GA4 coverage request when the page loads
- today's intraday data is excluded until it becomes a completed reporting day
- `Latest imported day` is the latest persisted row eligible for Trends after the creation-date filter; `Chart through` is the scheduler-derived completed-history boundary used to materialize the visible calendar series
- `7d` and `30d` show rolling totals for non-rate metrics and weighted averages for rates
- from campaign creation through `Chart through`, a date without a stored activity row is displayed and evaluated as zero; dates before campaign creation remain hidden
- the daily scheduler also persists explicit zero rows for completed no-activity dates after it verifies the provider response; an incomplete or failed provider response preserves the last-good stored window instead of writing false zeros
- explicit zero engaged sessions remain zero; only a genuinely absent legacy value is derived from that row's sessions and engagement rate
- the metric selector uses a native select; Users is available only in Daily because daily distinct-user counts cannot be summed across days

History gates:

- `Daily`: at least 1 eligible completed campaign date; the chart considers up to 30 calendar days through `Chart through`, excludes pre-creation dates, fills later no-activity dates with zero, and shows a delta against the prior calendar day when present; the table shows 14 recent rows initially and up to 30 with `Show all`
- `7d`: the chart shows every complete historical 7-calendar-day rolling window in the campaign calendar; zero/no-activity dates count as complete, and the latest comparison requires two adjacent 7-day windows
- `30d`: the chart shows every complete historical 30-calendar-day rolling window in the campaign calendar; zero/no-activity dates count as complete, and the latest comparison requires two adjacent 30-day windows
- `Monthly`: one calendar month can be shown and is marked partial when incomplete; only two adjacent complete calendar months are compared

### Data Summary

Shows GA4 Sessions and Conversions for the selected campaign/property's imported history.

Current meaning:

- on-screen traffic values use the saved historical-import start through the scheduler-backed history boundary; completed no-activity days count as zero, while a failed request with no response remains unavailable and is never inferred as zero
- this app version does not show Top Channel, a source/medium channel table, or channel-availability warnings in Data Summary or its browser-generated PDF; those values are excluded from Data Summary certification
- the existing GA4 acquisition response remains available to other Insights features under their own evidence and certification boundaries
- connected-source financial values remain in Executive Financials and are not duplicated in Data Summary

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
- daily trend findings use the same scheduler-synchronized, campaign-creation-bounded, zero-filled calendar rows as Trends; adjacent 7-day windows take precedence over a 3-day fallback
- zero/no-activity dates can complete a comparison window; insufficient campaign age, rather than sparse activity rows, controls the early-history gate
- stale freshness metadata on an otherwise successful scheduler-backed response does not create a setup finding or withhold current target/trend evaluation; an actual daily-history request failure with no response still withholds affected trend conclusions
- channel details in KPI/Benchmark recommendations require a reconciled breakdown and can remain when daily history is stale or mismatched; missing or wrong-property snapshots withhold streak/history context, not verified current target evaluations
- invalid KPI or Benchmark targets are shown as configuration issues before performance conclusions
- standard KPI and Benchmark targets are absolute goals evaluated against their authoritative current values: GA4 traffic and native financial metrics use the initial-import-through-latest-completed-day cumulative window, while imported Revenue and Spend use all available mapped records
- below-target KPI findings use factual `Below Saved Target` wording and the priority saved on that KPI; attainment percentage does not invent severity
- every verified, period-compatible KPI below its saved target is shown; arbitrary attainment bands do not hide a miss
- legacy timeframe or period metadata must not replace the authoritative cumulative current-value window; unsupported custom metrics remain unscorable rather than being forced into a standard window
- cards include data-basis and confidence labels
- unverified KPI and Benchmark evaluations are consolidated into one data-readiness finding instead of presenting one shared source failure as many business issues
- a KPI/Benchmark analytics-history request failure is reported as unavailable and withholds only streak/history context; the absence of a snapshot does not create a scheduler-timing finding
- generic total-ROAS strength findings are withheld because ROAS alone does not prove profitability or a channel-level scaling opportunity
- the page header remains stable while loading and freshness details stay in the relevant finding cards
- tracker counts and finding cards remain withheld during the initial multi-query load, then render once from settled inputs; background refetches retain the last stable query data
- normal Insights page loads read the overlapping 30-day and 60-day stored daily windows without replacing them; only the daily scheduler writes GA4 daily history
- recommendations are phrased as checks, not proven causal conclusions

## Certification Boundary

This document and the Insights certification cover only the live GA4 Insights tab. Reports, PDFs, report snapshots, scheduled reports, and email delivery belong to the Reports audit and are not Insights criteria, evidence, limitations, or deferred Insights work.

## Refresh Pattern

Insights is downstream of the GA4 refresh pipeline.

Inputs include:

- refreshed GA4 daily facts
- refreshed GA4 imported-window financial values
- refreshed spend and revenue inputs
- refreshed KPI context
- refreshed Benchmark context

Financial KPI/Benchmark snapshots consumed by Insights use the same initial-import-to-latest-completed-day native-revenue and source-currency rules as the live financial cards. For real GA4 properties, an incomplete or failed provider response is unavailable; retained daily rows or a configured-lookback breakdown are not substituted for a complete provider result when imported revenue must be combined. Last-good values may remain stored, but no new financial history point is recorded for an unavailable input.

Important meaning:

- the daily scheduler is the sole writer of GA4 daily history; startup refresh and campaign `Run now`/manual GA4 daily refresh routes are disabled
- page load, focus/reconnect, and polling may reread persisted rows, but they do not call GA4 or change history/timestamps
- the scheduler stores every completed date in its authorized window, using explicit zero rows only for verified no-activity dates and preserving last-good storage if provider completeness cannot be proven
- GA4 can process Measurement Protocol events after the script or traffic event occurred, so values may increase later even when the seed script was not rerun
- Trends requires completed daily facts; same-day Overview changes do not automatically create a completed Trends row
- financial KPI/Benchmark native-revenue windows always use the saved GA4 import boundary; campaign metadata dates and app creation time are not financial reporting boundaries
- the dedicated Google Ads scheduler refreshes provider daily facts, materializes the exact saved GA4 spend source through the latest completed campaign day, and then recomputes dependent KPI/Benchmark values; the general external-value scheduler does not duplicate that GA4 Google Ads write

## Production-Readiness Reference

For any future question such as:

- is Insights production-ready?
- is this section accurate?
- can this be used as a template for Meta, LinkedIn, Instagram, or another later platform release?
- what must another platform implement before copying this pattern?

Use `GA4/INSIGHTS_PRODUCTION_READINESS.md`.
