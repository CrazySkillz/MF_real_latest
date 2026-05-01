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
- because GA4 campaign scope feeds the entire chain, post-setup campaign-scope edits are not currently exposed in the GA4 analytics page

## GA4 Scope Changes

Current production behavior:

- GA4 property and campaign-value scope is saved during campaign creation or GA4 connection setup
- the GA4 analytics page reads and displays that saved scope
- users cannot add or remove GA4 campaign values from the GA4 analytics page after setup

Reason:

- changing GA4 campaign values after setup is a rescope operation, not a simple UI edit
- a safe future rescope workflow would need to save the new scope, refresh Overview inputs, recompute KPIs and Benchmarks, refresh downstream Insights and report outputs, and make alert/report implications explicit
- until that workflow is intentionally implemented, the safest production behavior is setup-time selection only

## Scheduler 1: GA4 Daily Refresh Pipeline

This scheduler now runs the GA4 daily refresh pipeline:

1. finds campaigns with a GA4 connection
2. resolves the campaign's GA4 campaign filter
3. fetches GA4 time-series data
4. upserts rows into `ga4_daily_metrics`
5. recomputes GA4 KPI and Benchmark values from the refreshed daily facts
6. runs KPI and Benchmark alert checks after recompute

Important meaning:

- it keeps persisted GA4 daily facts current
- it is campaign-scoped and property-scoped
- this is only one part of `Overview` freshness; `Overview` also depends on refreshed external revenue and spend source state where applicable
- it does not replace the external value auto-refresh scheduler or the report delivery scheduler

## On-Demand GA4 Refresh

The GA4 on-demand refresh endpoint follows the same downstream dependency rule for the refreshed campaign:

1. refresh the latest complete GA4 daily row
2. recompute GA4 KPI and Benchmark values for that campaign
3. run KPI and Benchmark alert checks through the existing GA4 recompute path

Important meaning:

- on-demand GA4 refresh should not leave KPIs, Benchmarks, or Insights relying on stale daily GA4 facts
- external revenue/spend source refresh remains handled by the external value auto-refresh scheduler

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

CRM auto-reprocess rule:

- saved HubSpot and Salesforce mappings should be reprocessed by the daily auto-refresh scheduler without requiring a user to manually reopen and save the wizard
- the scheduler may use an internal same-process authorization path for its own loopback requests
- public HubSpot and Salesforce save-mapping endpoints must still require normal user authentication and campaign access
- refreshed CRM revenue should update materialized revenue records and recomputed campaign financial state
- refreshed Pipeline Proxy values remain separate early-signal values and must not be added into confirmed Total Revenue
- Overview Pipeline Proxy visibility should be anchored to the active saved CRM revenue source config; refreshed endpoint data may update the amount/provenance, but a stale endpoint response must not hide an otherwise configured active Pipeline Proxy card
- if both HubSpot and Salesforce have active Pipeline Proxy configuration, the Overview card should aggregate both providers' exact proxy totals while keeping provider-specific provenance in the read-only Pipeline Proxy sources modal

CRM token continuity rule:

- HubSpot and Salesforce reconnect flows should request offline/refresh capability so scheduled refresh and on-demand proxy/status endpoints do not drop out after short-lived access-token expiry
- if a CRM connection is temporarily disconnected but the saved source is still active, display surfaces may fall back to persisted org/stage/proxy metadata for clarity, but those fallbacks must not be treated as fresh live data
- if a saved Salesforce revenue source exists but live auth is down, source-selection surfaces should communicate `Reconnect required` rather than `Not connected`
- Salesforce status recovery should attempt refresh-token recovery when a refresh token exists, even if the stored access token is missing, before reporting `connected: false`
- Salesforce reconnect must not be treated as durable unless the callback receives a returned `refresh_token` or an existing stored refresh token is still available to preserve
- if reconnect diagnostics show Salesforce granted only `scope: 'api'`, the remaining fix is the Salesforce Connected App scopes/policies, not downstream revenue logic or later token loss in the app

## After Overview Refresh: KPI Recompute And Alert Checks

Required order:

1. recompute GA4 KPI values
2. refresh KPI progress and performance state
3. refresh the KPI `Executive snapshot` cards from the recomputed KPI grid/state
4. update stored KPI history where applicable
5. run KPI alert checks

Important meaning:

- KPI alerts must run only after both the KPI grid state and the KPI `Executive snapshot` state are coherent with the latest recomputed values
- for GA4 mock/test flows, the stored KPI value used by alerts must be refreshed from the same total-construction model as the live KPI cards
- if the exact report-date daily row is missing for a GA4 campaign, the GA4 KPI recompute path should fall back to the latest available persisted GA4 daily row instead of skipping that campaign's alert reconciliation
- if duplicate GA4 KPI rows exist for the same `campaign + metric`, only the newest row should remain eligible to emit the active alert

## After Overview Refresh: Benchmark Recompute And Alert Checks

Required order:

1. recompute GA4 benchmark values
2. refresh benchmark progress and performance state
3. refresh the Benchmark `Executive snapshot` cards from the recomputed benchmark grid/state
4. update stored benchmark history where applicable
5. run benchmark alert checks

Important meaning:

- Benchmark alerts must run only after both the benchmark grid state and the Benchmark `Executive snapshot` state are coherent with the latest recomputed values
- if the exact report-date daily row is missing for a GA4 campaign, the GA4 benchmark recompute path should fall back to the latest available persisted GA4 daily row instead of skipping that campaign's alert reconciliation

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
- scheduled/server-generated GA4 reports run a best-effort campaign KPI/Benchmark recompute before PDF generation

Important meaning:

- `Reports` is a downstream output layer
- reports should render from refreshed GA4 tab inputs
- reports must not become a competing source of truth for campaign metrics
- report delivery continues even if the best-effort pre-send recompute logs a warning

## Current-State Notes

The current codebase is broadly aligned with the required dependency order, but it is split rather than fully consolidated.

What is true today:

- Overview freshness is updated through the GA4 daily refresh pipeline plus external-value auto-refresh processing
- the GA4 daily refresh pipeline refreshes GA4 daily facts, then recomputes GA4 KPI/Benchmark state, then runs KPI/Benchmark alert checks
- the generic KPI scheduler can skip its duplicate GA4 KPI/Benchmark recompute when `GA4_DAILY_PIPELINE_OWNS_RECOMPUTE=true`
- the on-demand GA4 refresh endpoint recomputes GA4 KPI/Benchmark state after updating the latest daily GA4 row
- external source auto-refresh calls the GA4 KPI/Benchmark recompute helper directly after a campaign's upstream source values change
- when a GA4 KPI/Benchmark recompute runs for a campaign, breached GA4 KPIs and Benchmarks should restore exactly one active in-app alert row if the row is missing
- Ad Comparison refreshes indirectly from refreshed inputs
- Insights refreshes indirectly from refreshed inputs
- report outputs are generated from already-refreshed tab inputs, with scheduled GA4 reports also performing a best-effort KPI/Benchmark recompute before PDF generation
- scheduled/server-generated GA4 reports now have dedicated server-side rendering for `Overview`, `Ad Comparison`, `Insights`, and `Custom`, using saved report config plus existing refreshed GA4 inputs

What is not yet fully consolidated:

- external revenue/spend source refresh is still handled by the external value auto-refresh scheduler
- some immediate post-refresh behavior still relies on a generic KPI refresh helper
- scheduled email delivery still depends on shared scheduler/runtime email infrastructure rather than a GA4-only delivery path
- opening the bell, opening Notifications, or simply loading the GA4 page is not itself a backfill trigger for missing GA4 in-app alert rows; reconciliation happens when the existing GA4 recompute / scheduler paths run

## Snapshot Inputs That Do Not Auto-Refresh

Not all sources auto-refresh.

Current examples:

- `Manual`
- `Upload CSV`

These behave more like snapshot inputs unless the user updates them again.

Important meaning:

- new direct `Manual` source creation is no longer available from the production revenue/spend pickers
- existing stored `Manual` sources do not participate in scheduled daily source refresh on their own
- `Upload CSV` sources do not participate in scheduled daily source refresh on their own
- existing stored snapshot sources are still included in recomputed totals until the user edits, replaces, or deletes them
