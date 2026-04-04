# GA4 Refresh And Processing

## Purpose

This file defines the daily auto-refresh and auto-process model for GA4.

## Daily Auto-Refresh And Auto-Process

This platform has a required no-click freshness pattern for GA4 campaigns.

User expectation:

- users should not need to reopen setup flows each day just to keep GA4 analytics current
- the system should refresh eligible GA4 and source-backed financial data in the background
- the next page load or query refetch should show updated values derived from the latest stored facts and source records

## Cross-Tab Refresh Dependency Order

The required GA4 platform pattern is:

1. refresh the GA4 `Overview` inputs first
2. recompute dependent KPI values and KPI performance state
3. refresh the KPI `Executive snapshot` cards from the recomputed KPI state
4. recompute dependent Benchmark values and Benchmark performance state
5. refresh the Benchmark `Executive snapshot` cards from the recomputed Benchmark state
6. refresh `Ad Comparison` from refreshed breakdown and revenue inputs
7. refresh `Insights` from refreshed Overview, KPI, and Benchmark context
8. ensure `Reports` render from those refreshed inputs when generated or sent

Important meaning:

- `Overview` is the upstream data layer
- `KPIs`, `Benchmarks`, `Ad Comparison`, and `Insights` are downstream analytics layers
- `Reports` is the output layer

## Scheduler 1: GA4 Daily Metrics Refresh

This scheduler:

1. finds campaigns with a GA4 connection
2. resolves the campaign's GA4 campaign filter
3. fetches GA4 time-series data
4. upserts rows into `ga4_daily_metrics`

Important meaning:

- it keeps persisted GA4 daily facts current
- it is campaign-scoped and property-scoped
- this is only one part of `Overview` freshness; `Overview` also depends on refreshed external revenue and spend source state where applicable

## Scheduler 2: External Value Auto-Refresh And Auto-Process

This scheduler reprocesses eligible source-backed revenue and spend values.

Current eligible sources include:

- HubSpot revenue
- Salesforce revenue
- Shopify revenue
- Google Sheets revenue
- Google Sheets spend
- LinkedIn Ads spend
- Meta spend through `ad_platforms`
- Google Ads spend through `ad_platforms`

## After Overview Refresh: KPI Recompute And Alert Checks

Required order:

1. recompute GA4 KPI values
2. refresh KPI progress and performance state
3. refresh the KPI `Executive snapshot` cards from the recomputed KPI grid/state
4. update stored KPI history where applicable
5. run KPI alert checks

Important meaning:

- KPI alerts must run only after both the KPI grid state and the KPI `Executive snapshot` state are coherent with the latest recomputed values

## After Overview Refresh: Benchmark Recompute And Alert Checks

Required order:

1. recompute GA4 benchmark values
2. refresh benchmark progress and performance state
3. refresh the Benchmark `Executive snapshot` cards from the recomputed benchmark grid/state
4. update stored benchmark history where applicable
5. run benchmark alert checks

Important meaning:

- Benchmark alerts must run only after both the benchmark grid state and the Benchmark `Executive snapshot` state are coherent with the latest recomputed values

## Ad Comparison Refresh

The current `Ad Comparison` tab has no dedicated background job.

It refreshes because:

- GA4 breakdown inputs refresh
- revenue-source inputs refresh
- the derived comparison view rerenders from those refreshed inputs

## Insights Refresh

The current `Insights` tab is downstream of:

- refreshed GA4 daily facts
- refreshed GA4 to-date totals
- refreshed spend and revenue values
- refreshed KPI context
- refreshed benchmark context

## Reports Refresh

Reports do not have a separate report-metrics recompute job.

Instead:

- ad hoc GA4 reports use live refreshed page state at generation time
- scheduled/server-generated reports use saved config plus shared report-generation infrastructure

Important meaning:

- `Reports` is a downstream output layer
- reports should render from refreshed GA4 tab inputs
- reports must not become a competing source of truth for campaign metrics

## Current-State Notes

The current codebase is broadly aligned with the required dependency order, but it is split rather than fully consolidated.

What is true today:

- Overview freshness is updated through the GA4 daily scheduler plus external-value auto-refresh processing
- GA4 KPI and Benchmark recomputation is triggered by GA4-specific jobs
- Ad Comparison refreshes indirectly from refreshed inputs
- Insights refreshes indirectly from refreshed inputs
- report outputs are generated from already-refreshed tab inputs rather than from a report-only metrics pipeline

What is not yet fully consolidated:

- there is not one single GA4-only orchestrator that updates every tab in one explicit pipeline
- some immediate post-refresh behavior still relies on a generic KPI refresh helper
- immediate benchmark alert checks are not mirrored as completely as KPI alert checks in the same auto-refresh path
- scheduled/server-generated report rendering is not yet as GA4-complete as the live client-side ad hoc report renderer

## Snapshot Inputs That Do Not Auto-Refresh

Not all sources auto-refresh.

Current examples:

- `Manual`
- `Upload CSV`

These behave more like snapshot inputs unless the user updates them again.

Important meaning:

- they do not participate in scheduled daily source refresh on their own
- they are still included in recomputed totals until the user edits, replaces, or deletes them
