# GA4 Ad Comparison

## Purpose

This file defines the current GA4 `Ad Comparison` tab and its current implementation pattern.

## Intended Meaning

The intended pattern is a compare-what-is-working view for ad or creative performance.

## Current Implementation Pattern

The current implementation is a campaign-comparison view rendered inside the `Ad Comparison` tab.

Important meaning:

- treat the current implementation as campaign comparison inside the ad-comparison slot
- do not document or build against it as if it were already true ad-level or creative-level analytics

## Current Tab Structure

The current tab contains:

- metric-based ranking
- top-performer callout pattern
- comparison chart
- ranked list
- `All Campaigns` table
- `Revenue Breakdown` table

## Current Metrics

The current selector supports:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

## All Campaigns Section

The `All Campaigns` table includes:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Important meaning:

- `Revenue` here is GA4 revenue attributed to the GA4 campaign row
- imported revenue is not allocated per campaign in this table

## Revenue Breakdown Section

The `Revenue Breakdown` section shows:

- `Source`
- `Amount`

Important meaning:

- this is total-source revenue provenance
- it is not a per-campaign allocation table

## Ad Comparison Refresh Pattern

The current tab does not have a dedicated ad-comparison background job.

It refreshes from the same refreshed inputs that power the GA4 page:

1. Overview-related refresh updates GA4 daily and GA4 to-date values
2. GA4 campaign breakdown data is refetched
3. comparison aggregates are rebuilt
4. revenue-source rows are refetched
5. the tab rerenders from those refreshed inputs

## Current-State Note

This is partially aligned with the intended user journey.

Aligned:

- comparison pattern
- chart and ranked list
- top-item focus for readability
- `All Campaigns` and `Revenue Breakdown`

Not yet aligned:

- it is not truly ad-level or creative-level
- it currently ranks GA4 campaign rows instead
