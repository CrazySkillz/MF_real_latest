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

- a top summary-card row
- a metric dropdown directly below the summary cards
- metric-based ranking
- top-performer callout pattern
- comparison chart
- ranked list
- `All Campaigns` table
- `Revenue Breakdown` table

The top summary cards are:

- `Best Performing`
- `Most Efficient`
- `Needs Attention`

## Top Summary Card Logic

In the current implementation, these cards mean:

- `Best Performing`
  The highest-ranked campaign row for the currently selected dropdown metric.
- `Most Efficient`
  The campaign row with the highest conversion rate among rows with sessions.
- `Needs Attention`
  The campaign row with the lowest conversion rate among rows with sessions, while avoiding duplication with `Best Performing` when possible.

Important meaning:

- `Best Performing` changes when the selected metric changes
- `Most Efficient` and `Needs Attention` are currently driven by conversion-rate logic, not by the selected dropdown metric
- these cards summarize campaign rows, not true ad or creative entities
- the `Best Performing` card should not add extra explanatory suffixes like `(matched external included)` in its label line

## Current Metrics

The current selector supports:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

Important meaning:

- the selected metric controls ranking, chart ordering, and the `Best Performing` card
- it does not currently redefine the logic for `Most Efficient` or `Needs Attention`
- when `Revenue` is selected, the chart may also include `Unallocated External Revenue` as a separate non-campaign bar when that remainder exists

## All Campaigns Section

The `All Campaigns` table includes:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Important meaning:

- `Revenue` here is GA4 revenue attributed to the GA4 campaign row plus any external revenue that can be matched safely by exact campaign-value match
- external revenue that cannot be matched safely must remain visible as `Unallocated External Revenue`
- when present, `Unallocated External Revenue` should render in the summary block immediately above `Total Revenue (All Sources)`, after the ranked campaign rows
- that summary block should remain visible in `All Campaigns` even when the selected metric is not `Revenue`
- `Total Revenue (All Sources)` should remain the final summary row in the table
- the summary rows should use clean blank cells in non-Revenue columns instead of placeholder dashes

## Revenue Breakdown Section

The `Revenue Breakdown` section shows:

- `Source`
- `Amount`

Important meaning:

- this is total-source revenue provenance
- source names should render in normal foreground text, not muted placeholder styling
- source rows may include indented per-campaign subsections when the source has saved exact `campaignValueRevenueTotals`
- those subsection rows must use only the stored exact source values; they must not invent or proportionally allocate revenue
- the standalone `Unallocated External Revenue` row should not be duplicated here when that amount is already represented in the source subsection
- `Total Revenue` should render as the last row in the table

## Revenue Metric Note

Intended UX expectation:

- when `Revenue` is selected in the dropdown, users will reasonably expect revenue to reflect all applicable campaign revenue sources, not just GA4-attributed revenue

Current limitation:

- only sources with real campaign-identifying mappings can contribute external revenue into campaign rows
- matching is exact normalized campaign-value matching only; no proportional or inferred attribution is allowed
- imported external revenue that does not match a GA4 campaign row exactly, or matches ambiguously, must remain visible as `Unallocated External Revenue`

Future implementation note:

- do not simply relabel current GA4-only row revenue as if it were total all-source revenue
- if this is changed later, it should only be done after defining a safe attribution model for representing non-GA4 revenue in the comparison layer

## Ad Comparison Refresh Pattern

The current tab does not have a dedicated ad-comparison background job.

It refreshes from the same refreshed inputs that power the GA4 page:

1. Overview-related refresh updates GA4 daily and GA4 to-date values
2. GA4 campaign breakdown data is refetched
3. comparison aggregates are rebuilt
4. revenue-source rows are refetched
5. the tab rerenders from those refreshed inputs

## Source-Of-Truth Inputs

The current tab is built from:

- GA4 campaign-breakdown aggregate rows
- selected-metric sorting over those rows
- GA4 revenue totals
- imported revenue display/source rows

Important meaning:

- this tab does not currently have a separate ad-performance storage model
- it depends on GA4 campaign-breakdown data and revenue-source inputs
- external row allocation is derived from saved source mapping metadata, not from a separate attribution model

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
