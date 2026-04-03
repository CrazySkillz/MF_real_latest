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

- revenue cards combine GA4-native revenue and imported campaign revenue where applicable
- spend cards come from explicit spend sources attached to the campaign
- profit and efficiency metrics are derived outputs, not manually stored totals

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

## Current-State Note

The current implementation uses mixed but intentional data paths:

- persisted GA4 daily facts
- GA4 to-date totals
- strict daily spend and revenue rows for financial logic

Future work should preserve this model unless the user explicitly asks for a change to the underlying computation approach.
