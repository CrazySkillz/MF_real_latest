# GA4 Overview

## Purpose

This file defines the GA4 `Overview` tab and the GA4-specific scope rules that feed the rest of the GA4 experience.

## Overview Structure

The platform-level GA4 `Overview` tab contains:

- Summary cards
  - `Sessions`
  - `Users`
  - `Conversions`
  - `Engagement Rate`
  - `Conv. Rate`
- Financial cards
  - `Total Revenue`
  - `Latest Day Revenue`
  - `Total Spend`
  - `Latest Day Spend`
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

`Latest Day Revenue` and `Latest Day Spend` are also computed from daily values rather than being fixed setup-time values.

Intended behavior:

- `Latest Day Revenue` should show the previous day's total revenue for the campaign across all applicable revenue sources
- `Latest Day Spend` should show the previous day's total spend for the campaign across all applicable spend sources

Current-state note:

- `Latest Day Revenue` is currently built from the GA4-selected report day plus imported revenue for that same day, rather than simply using the previous day's total across all relevant revenue sources
- `Latest Day Spend` is intended to represent the previous day's total spend for the campaign across all applicable spend sources, but the current implementation uses a narrower `today else yesterday` check
- treat these differences as current-state implementation issues to fix later, not as the desired long-term template

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

### Financial Cards

Financial-card detail lives in `GA4/FINANCIAL_SOURCES.md`.

High-level rule:

- `Total Revenue` is additive:
  `Total Revenue = GA4-native revenue + imported campaign revenue`
- spend cards come only from explicit spend sources attached to the campaign
- GA4 itself does not provide spend for this page's spend cards
- profit and efficiency metrics are derived outputs, not manually stored totals

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

- `Campaign Breakdown` revenue is GA4 revenue attributed to each GA4 campaign row
- it is not a proportional allocation of imported external revenue
- campaign financial cards and campaign-breakdown revenue should not be treated as interchangeable numbers

### Landing Pages

`Landing Pages` should be understood as a cumulative view for the GA4 property and GA4 campaign selection configured for this app campaign.

Columns:

- `Landing page`
- `Source/Medium`
- `Sessions`
- `Users`
- `Conversions`
- `Conv. rate`
- `Revenue`

Important meaning:

- it can reflect multiple GA4 campaign values if those values were intentionally selected for this one app campaign
- it is not a rollup across unrelated campaigns in the property

### Conversion Events

`Conversion Events` follows the same scope rule as `Landing Pages`.

Columns:

- `Event`
- `Conversions`
- `Event count`
- `Users`
- `Revenue`

## Overview Tables Current-State Observation

The current `Campaign Breakdown`, `Landing Pages`, and `Conversion Events` tables are not intended to be test-only surfaces.

Current code-path meaning:

- in test mode, these tables can render from simulated GA4 responses
- in production mode, they are intended to render from real GA4-backed query paths for the selected GA4 property and the campaign's saved GA4 campaign scope
- `Run Refresh` is a test/mock validation tool, but the production table-population model is still the real GA4 query path, not a mock-only design

Important meaning:

- these tables should populate and update accurately in production if GA4 connection, property selection, campaign scoping, and GA4 tagging are correct
- if a table looks wrong in production, the likely problem is scoping, tagging, or upstream GA4 data quality, not that the UI is inherently test-only

## Overview Tables Production-Readiness Checklist

Use this checklist after the full GA4 manual-user-journey pass is complete.

Connection and scope:

- confirm the campaign has a valid GA4 access-token connection
- confirm the correct GA4 property is selected
- confirm the campaign's saved GA4 campaign filter/scope is correct

Campaign Breakdown:

- confirm rows populate from the selected GA4 property and campaign scope
- confirm `Sessions`, `Users`, `Conversions`, and `Revenue` are coherent with GA4 for that scope
- confirm the table is not interpreted as imported-revenue allocation; revenue here should remain GA4-attributed row revenue

Landing Pages:

- confirm rows populate for the same GA4 property and campaign scope
- confirm `Source/Medium`, `Sessions`, `Users`, `Conversions`, and `Revenue` look coherent for that scope
- confirm page rows are not unexpectedly mixing unrelated campaigns due to bad GA4 campaign tagging/filtering

Conversion Events:

- confirm rows populate for the same GA4 property and campaign scope
- confirm `Conversions`, `Event count`, `Users`, and `Revenue` are coherent with GA4 event tracking for that scope
- confirm conversion-event naming and totals reflect real GA4 configuration rather than stale or misconfigured events

Freshness and updates:

- confirm table queries refetch successfully after normal page refetch/reload
- confirm test-mode `Run Refresh` updates these tables during validation
- confirm production freshness expectations are based on real GA4 fetches and refetches, not the mock-refresh tool

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
