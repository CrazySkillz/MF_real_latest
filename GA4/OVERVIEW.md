# GA4 Overview

## Purpose

This file defines the GA4 `Overview` tab and the GA4-specific scope rules that feed the rest of the GA4 experience.

Production-readiness status lives in `GA4/OVERVIEW_PRODUCTION_READINESS.md`. Current status: GA4 Overview is production-ready for the current GA4 code scope. Use that readiness file for the stable future answer and for the reusable Meta/Google Ads/LinkedIn/future-platform template.

## Overview Structure

The platform-level GA4 `Overview` tab contains:

- Summary cards
  - `Sessions`
  - `Users`
  - `Conversions`
  - `Engagement Rate`
  - `Conv. Rate`
- Revenue & Financial section
  - `Revenue`
    - `Total Revenue`
    - `Pipeline Proxy` when configured
  - `Spend`
    - `Total Spend`
  - `Performance`
    - `Profit`
    - `ROAS`
    - `ROI`
    - `CPA`
- Tables
  - `Campaign Breakdown`
  - `Landing Pages`
  - `Conversion Events`

## How Cards Are Populated

The GA4 `Overview` cards are computed outputs from query-backed data paths.

They are not hard-coded values and they are not manually maintained UI state.

Important clarification:

- campaign creation does not permanently populate these cards with one-time imported values
- during campaign setup, the system stores the GA4 property and campaign selection/filter for this app campaign
- after that, the Overview tab fetches current GA4 data for that saved scope and computes the cards from those query results
- for live GA4 properties, current tagged traffic may appear in `pageLocation` URLs before GA4 campaign attribution dimensions populate; the Overview query path may therefore use `pageLocation` `utm_campaign` as a fallback only when the primary campaign-dimension scoped result is empty
- for Measurement Protocol or freshly tagged traffic, GA4 can expose selected-campaign traffic through `pageLocation` `utm_campaign` while exposing conversions and native revenue through `campaignName`; the Overview import path may supplement only missing `Conversions` and GA4-native `Revenue` from a compatible `campaignName` conversion/revenue query without changing the traffic totals
- new live GA4 events appear in Overview only after GA4 has processed them and the page query refetches; page load/window focus can refetch immediately, and the to-date/breakdown queries also refetch periodically while the page is open

## Source-Of-Truth Hierarchy

The GA4 Overview should be understood through this hierarchy:

1. campaign creation stores GA4 scope and campaign configuration
2. GA4 queries fetch current base metrics for that saved scope
3. revenue and spend sources contribute normalized campaign records where applicable
4. Overview cards are recomputed outputs from those fetched and normalized inputs

Important meaning:

- setup stores scope, not frozen metric values
- queries and normalized records are the real inputs
- the cards are the presentation layer for those recomputed results
- GA4 Data API values can change after already-sent events are processed by Google; the app should display the latest refetched values rather than treating the first observed value as final
- Overview current/to-date values may update before `Insights -> Trends`, because Trends waits for persisted completed-day daily rows while Overview can use current to-date and breakdown query results

## Fetched Vs Derived Values

The clearest way to understand the Overview cards is:

- some cards are base fetched values from GA4-backed queries
- some cards are derived from those fetched values
- some financial cards combine GA4-fetched values with imported campaign revenue/spend records

### Base Fetched GA4-Backed Values

These are the primary fetched values that come from the campaign's saved GA4 scope:

- `Sessions`
- `Users`
- `Conversions`
- `Engagement Rate`
- GA4-native revenue when available

These values are fetched from the current GA4 query paths, not stored as fixed values at campaign-creation time.

Important clarification:

- `Conversions` on the GA4 Overview is the GA4 conversion total for this campaign's saved GA4 scope
- it is not sourced from imported CRM/ecommerce/manual conversion systems on this page
- derived metrics like `CPA` depend on this GA4-scoped conversion total unless the implementation is explicitly redesigned

### Derived Overview Values

These cards are derived from fetched or recomputed inputs:

- `Conv. Rate = Conversions / Sessions`
- `Profit = Revenue - Spend`
- `ROAS = Revenue / Spend`
- `ROI = (Revenue - Spend) / Spend`
- `CPA = Spend / Conversions`

Previous-day revenue and spend cards are intentionally not rendered in this app version.
Daily records and endpoints may still exist for source validation, refresh, and possible future versions, but the GA4 Overview UI exposes only to-date financial totals plus derived performance metrics.

### Summary Cards

- `Sessions`
  Populated from GA4 campaign-scoped totals using the merged GA4 daily and GA4 to-date path.
- `Users`
  Populated from GA4 campaign-scoped totals with preference for the deduplicated GA4 to-date user count.
- `Conversions`
  Populated from GA4 campaign-scoped totals using the merged GA4 daily and GA4 to-date path.
- `Engagement Rate`
  Populated from GA4 daily facts when available, with GA4 metrics fallback.
- `Conv. Rate`
  Computed from campaign-scoped `Conversions / Sessions`.

Important meaning:

- these are GA4-native campaign metrics
- they are scoped to the GA4 property and GA4 campaign filter selected for this app campaign
- they are not populated from imported revenue or spend sources
- Summary cards should keep a coherent selected-campaign GA4 source instead of taking per-metric maximum values across daily, to-date, and breakdown endpoints
- when persisted selected-campaign daily facts exist, the Summary cards use those daily facts for `Sessions`, `Users`, `Conversions`, GA4-native `Revenue`, and derived `Conv. Rate`; if daily facts are unavailable, the cards fall back to selected-campaign to-date totals, then selected-campaign breakdown totals
- selected-campaign daily facts may combine `pageLocation` UTM traffic with `campaignName` conversion/revenue supplementation only for missing conversion/revenue fields; sessions, users, pageviews, and engagement remain from the traffic query
- when live `pageLocation` UTM fallback is needed, visible card totals may also use populated GA4 breakdown totals so the top cards do not remain zero while scoped live table rows already exist
- on initial page load or browser refresh, Summary card values should not briefly render stale fallback totals while the selected GA4 property's campaign breakdown query is still loading; show a stable skeleton for the card values until the breakdown-backed totals are ready

Important `Users` rule:

- the top `Users` card follows the same coherent selected-campaign GA4 source as the other Summary cards
- when persisted daily facts are the selected source, `Users` is the sum of GA4 daily `totalUsers` rows for the selected campaign scope, not a cross-day deduplicated user count
- when to-date totals are the selected source, `Users` is the GA4 to-date user count for the selected campaign scope
- the top `Users` card may show a short clarification tooltip:
  `GA4 users for the selected campaign scope.`

### Financial Cards

Financial-card detail lives in `GA4/FINANCIAL_SOURCES.md`.

Visible layout:

- `Revenue` contains `Total Revenue` and `Pipeline Proxy`
- `Spend` contains `Total Spend`
- `Performance` contains `ROAS`, `ROI`, and `CPA` cards; `Profit` appears when both revenue and spend are available
- unavailable performance values render as `—` instead of hiding the card
- `Revenue` and `Spend` render side by side on desktop-width Overview screens and stack on narrower screens

High-level rule:

- `Total Revenue` is additive:
  `Total Revenue = selected scoped GA4-native financial revenue + imported campaign revenue`
- GA4-native financial revenue is selected from the scoped GA4 to-date, daily, and breakdown totals by the most complete native revenue total; revenue and CPA conversions must come from that same selected GA4 source object
- `Pipeline Proxy`, when configured from HubSpot or Salesforce, is a separate early-signal card and is not included in `Total Revenue`
- spend cards come only from explicit spend sources attached to the campaign
- GA4 itself does not provide spend for this page's spend cards
- profit and efficiency metrics are derived outputs, not manually stored totals

Pipeline Proxy rule:

- Pipeline Proxy appears in the Revenue & Financial area; before a HubSpot or Salesforce `Total Revenue + Pipeline (Proxy)` source is configured, the card shows `Not configured`
- the render condition is the active CRM revenue source configuration, not only the separate pipeline proxy endpoint response
- when the endpoint returns a fresh value, the card should use that value; if the endpoint path is stale or unavailable, the card may still render from the active source's saved Pipeline Proxy config
- if both Salesforce and HubSpot have active Pipeline Proxy configuration for the same GA4 campaign, the card should aggregate their exact proxy totals into one card total
- the card should show a compact `Sources` action; provider-specific provenance belongs in a read-only Pipeline Proxy sources modal rather than inline card microcopy
- the `Sources` count should include only providers with positive Pipeline Proxy contribution; zero-value configured CRM providers should not show as contributing sources
- the card is display-only; users manage the underlying CRM revenue source from `Total Revenue`, not from the `Pipeline Proxy` card
- each provider entry in the read-only sources modal should render:
  - provider name
  - provider proxy amount
  - selected/contributing campaign value or values, one per line with `Stage: <stage label> | <campaign value>` formatting
  - that provider's selected pipeline stage label
- if the CRM connection is currently disconnected but the saved source is still active, the card and review/edit flows may fall back to saved proxy metadata and saved proxy amount until live preview data is available again
- the card should not show explanatory stage microcopy such as `Contract Sent open-stage signal`
- it is not confirmed revenue
- it must not feed `Profit`, `ROAS`, `ROI`, `CPA`, KPIs, Benchmarks, Ad Comparison, Insights, or Reports unless a future product change explicitly redefines that metric
- deleting or deactivating the associated HubSpot/Salesforce revenue source must remove the Pipeline Proxy card from Overview

Insights alignment rule:

- `Insights -> Data Summary -> Revenue` should use the same all-source `financialRevenue` model as Overview and Executive Financials
- imported revenue updates should therefore appear consistently in Overview, Insights Executive Financials, and Insights Data Summary

CRM Pipeline Proxy example:

- if the CRM wizard selected campaign values `yesop_brand_search` and `yesop_prospecting`, the Pipeline Proxy card is scoped to those same selected values
- if the selected stage is `Proposal/Price Quote`, the card amount is the open CRM pipeline amount for those selected campaign values in that stage
- Total Revenue remains confirmed/won revenue only and must not include the Pipeline Proxy amount

Reference note:

- use `GA4/OVERVIEW.md` for tab-level meaning and visible card behavior
- use `GA4/FINANCIAL_SOURCES.md` for revenue/spend source workflows, provenance, and recomputation rules

## GA4 Scope Rule

The GA4 page is scoped to:

- the selected GA4 property
- the GA4 campaign selection/filter configured for this app campaign
- the campaign's date scope

Important meaning:

- it is campaign-scoped within the selected GA4 property
- it is not a client-wide rollup across unrelated campaigns
- the GA4 analytics page does not currently let users add or remove GA4 campaign values after setup; changing GA4 scope after setup would require a deliberate rescope workflow that refreshes Overview inputs and recomputes downstream KPI, Benchmark, Insight, alert, and report state
- `Total Revenue` and `Total Spend` show compact totals in the cards; their `Sources` action opens the source-provenance modal where users can review, edit, or delete contributing sources
- the source-provenance modal is presentation-only and must not change financial calculations, source persistence, or recomputation behavior
- the revenue and spend source-provenance modals should scroll vertically when many entries are present

### GA4 Scope Selection Lifecycle

Current production behavior:

- users select the GA4 property and GA4 campaign values during campaign creation or GA4 connection setup
- the saved `ga4CampaignFilter` defines the GA4 scope for the campaign
- the GA4 analytics page shows the saved client, campaign, GA4 property ID, and selected campaign values for provenance
- the GA4 analytics provenance card does not show `Last updated`; refresh freshness belongs in logs, scheduler state, or explicit status surfaces rather than this compact header card
- the GA4 analytics page does not expose a post-setup campaign picker
- the setup picker should discover selectable UTM campaign values after property selection from GA4 campaign dimensions, manual UTM dimensions, and finally `pageLocation` URLs containing `utm_campaign`
- placeholder values such as `(direct)`, `(not set)`, or empty values are not sufficient proof that no UTM campaigns exist when manual UTM dimensions or `pageLocation` contain real campaign values

Reason:

- changing selected GA4 campaigns after setup changes the core analytics scope
- that scope feeds Overview, KPIs, Benchmarks, Ad Comparison, Insights, Reports, alerts, and scheduled refresh
- until a dedicated rescope workflow exists, post-setup edits are intentionally avoided to prevent partially refreshed downstream metrics

## Overview Tables

### Campaign Breakdown

`Campaign Breakdown` is campaign-filtered and represents performance grouped by UTM campaign inside the selected GA4 campaign scope.

Columns:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Important clarification:

- the visible column label is `Revenue`, not `GA4 Revenue`, because the value can include exact campaign-matched imported revenue
- `Campaign Breakdown` revenue starts with GA4 revenue attributed to each GA4 campaign row
- exact campaign-matched imported revenue may be added only when a source saves real campaign-value mappings that match a GA4 campaign row
- it is not a proportional allocation of imported external revenue
- campaign financial cards and campaign-breakdown revenue should not be treated as interchangeable numbers
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear in more than one campaign row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

### Landing Pages

`Landing Pages` should be understood as a selected-date-range view for the GA4 property and GA4 campaign selection configured for this app campaign.

Columns:

- `Landing page`
- `Source/Medium`
- `Sessions`
- `Users`
- `Conversions`
- `Conv. rate`

Important meaning:

- it can reflect multiple GA4 campaign values if those values were intentionally selected for this one app campaign
- it is not a rollup across unrelated campaigns in the property
- it uses the same selected GA4 Overview date range as the nearby Summary, Campaign Breakdown, and current performance sections, not the app campaign's start/created date
- revenue is intentionally not shown in `Landing Pages`; page-level rows remain traffic and conversion context only
- when GA4 returns primary landing-page traffic rows with missing conversion values, conversions may be supplemented from same-scope `pageLocation` UTM rows only by exact `Landing page + Source/Medium` match
- campaign-level conversions and campaign-matched imported revenue are not allocated into landing-page rows unless a future source provides real landing-page-level identifiers that can be matched safely
- if GA4 cannot provide an exact row-level conversion match, `Conversions` and `Conv. rate` can correctly remain zero for that row
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear on more than one landing-page row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

### Conversion Events

`Conversion Events` follows the same scope and selected-date-range rule as `Landing Pages`.

Columns:

- `Event`
- `Conversions`
- `Event count`
- `Users`

Important meaning:

- revenue is intentionally not shown in `Conversion Events`; event rows remain conversion-volume context only
- it uses the same selected GA4 Overview date range as the nearby Summary, Campaign Breakdown, and current performance sections, not the app campaign's start/created date
- campaign-matched imported revenue is not allocated into event rows unless a future source provides real event-level identifiers that can be matched safely
- `Users` in this table is a row-level GA4 breakdown value, not a deduplicated page-level total
- the same person can appear in more than one conversion-event row, so row `Users` values are directional and are not expected to sum or reconcile exactly to the top `Users` card

## Overview Tables Current-State Observation

The current `Campaign Breakdown`, `Landing Pages`, and `Conversion Events` tables are not intended to be test-only surfaces.

Current code-path meaning:

- in test mode, these tables can render from simulated GA4 responses
- in production mode, they are intended to render from real GA4-backed query paths for the selected GA4 property and the campaign's saved GA4 campaign scope
- production table population uses the real GA4 query path, not a mock-refresh design
- numeric GA4 property IDs must not be classified as the Yesop simulator; Overview values for live or mock-live numeric properties should come from the GA4 live import/query path plus persisted selected-campaign daily facts, not a deterministic simulation baseline
- `Landing Pages` and `Conversion Events` now use the selected GA4 Overview date range; explicit API `startDate` remains a compatibility override for callers that intentionally request it
- when attribution dimensions are empty for fresh live traffic, table queries may fall back to `pageLocation` `utm_campaign`; landing page source and medium can then be derived from the same tagged URL

Important meaning:

- these tables should populate and update accurately in production if GA4 connection, property selection, campaign scoping, and GA4 tagging are correct
- if a table looks wrong in production, the likely problem is scoping, tagging, or upstream GA4 data quality, not that the UI is inherently test-only

## Overview Tables Deployed Validation Checklist

GA4 Overview production-readiness is certified in `GA4/OVERVIEW_PRODUCTION_READINESS.md` for the current GA4 code scope. Use this checklist for deployed/provider validation against real GA4 properties and real source data; these checks are validation gates, not known local code blockers.

Connection and scope:

- confirm the campaign has a valid GA4 access-token connection
- confirm the correct GA4 property is selected
- confirm the campaign's saved GA4 campaign filter/scope is correct

Summary cards:

- confirm `Sessions`, `Users`, `Conversions`, `Conv. Rate`, and GA4-native `Total Revenue` match the selected GA4 property and saved campaign values across the processed date range used by the Overview import
- confirm Measurement Protocol or freshly tagged traffic that appears under `pageLocation` `utm_campaign` can still show matching selected-campaign conversions/native revenue when GA4 exposes purchase attribution under `campaignName`
- confirm the cards keep one coherent selected-campaign source and do not combine per-metric maximum values from incompatible daily, to-date, and breakdown windows

Campaign Breakdown:

- confirm rows populate from the selected GA4 property and campaign scope
- confirm `Sessions`, `Users`, `Conversions`, and `Revenue` are coherent with GA4 for that scope
- confirm exact campaign-matched imported revenue is added only when source campaign values safely match GA4 campaign rows

Landing Pages:

- confirm rows populate for the same GA4 property, selected Overview date range, and campaign scope
- confirm `Source/Medium`, `Sessions`, `Users`, `Conversions`, and `Conv. rate` look coherent for that scope
- confirm campaign-only imported revenue is not allocated into landing-page rows
- confirm page rows are not unexpectedly mixing unrelated campaigns due to bad GA4 campaign tagging/filtering

Conversion Events:

- confirm rows populate for the same GA4 property, selected Overview date range, and campaign scope
- confirm `Conversions`, `Event count`, and `Users` are coherent with GA4 event tracking for that scope
- confirm campaign-only imported revenue is not allocated into conversion-event rows
- confirm conversion-event naming and totals reflect real GA4 configuration rather than stale or misconfigured events

Freshness and updates:

- confirm table queries refetch successfully after normal page refetch/reload
- confirm production freshness expectations are based on real GA4 fetches, refetches, and scheduled refresh

Data quality:

- confirm UTM campaign naming is clean enough for `Campaign Breakdown` grouping
- confirm landing-page tracking is correct in GA4
- confirm conversion events are configured and firing correctly in GA4

## Current-State Note

The current implementation uses mixed but intentional data paths:

- persisted GA4 daily facts
- GA4 to-date totals
- strict daily spend and revenue rows for financial logic

Future work should preserve this model unless the user explicitly asks for a change to the underlying computation approach.
