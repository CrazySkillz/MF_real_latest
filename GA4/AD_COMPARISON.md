# GA4 Ad Comparison

## Purpose

This file is the short functional overview for the GA4 `Ad Comparison` tab.

Use `GA4/AD_COMPARISON_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, known blockers, and future-platform template guidance.

Current status:

`CLEAN-CERTIFIED` only for the Campaign2 metric dropdown, Top Campaigns chart,
three leader cards, two summary cards, and their corresponding PDF values at
deployed runtime `3013ec6b52a93eaca01cd14c538dd0a20f350fac`. The exact
scope and evidence are in `GA4/AD_COMPARISON_CHART_CERTIFICATION_2026-09-16.md`.
The full Ad Comparison tab and its machine record remain `UNVERIFIED`; the
older boundary below is historical.

Revenue Breakdown is separately `CLEAN-CERTIFIED` for the exact Campaign2,
source, UI, and PDF value boundary in
`GA4/AD_COMPARISON_REVENUE_BREAKDOWN_CERTIFICATION_2026-09-16.md`.
The local candidate removes `All Campaigns` from the live tab and new report
choices. Existing custom reports that explicitly saved it retain their PDF
output. The combined tab still needs validation at one deployed runtime.

Historical whole-tab status (superseded by the narrow current status above):

`PRODUCTION_READY` for certified runtime boundary
`12789c1ebb92dd6a905a9f2f0f877f0bc6a90627` and the recorded dependency and
configuration boundary. Current revalidation proved that later changes in the
four drifted dependencies do not alter the isolated Ad Comparison query, fixed
import-to-date window, property/filter scope, aggregation, ranking, or revenue
provenance. The focused and shared regressions, source-safety subset,
TypeScript, production build, exact-SHA provider/source inventory, and live UI
parity all pass. The prior certifications are historical only. The root cause,
fix, and current evidence are recorded in
`GA4/AD_COMPARISON_PRODUCTION_READINESS.md`. Reports-owned PDFs, downloads,
saved reports, snapshots, scheduling, and delivery remain outside this tab-only
boundary. Evidence-only commit `e175ac5c` was deployed and confirmed without
changing production runtime code.

## Document Ownership

The Ad Comparison documentation is intentionally split into two files:

- `GA4/AD_COMPARISON.md`
  Functional overview of the current GA4 Ad Comparison tab.
- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
  Canonical source of truth for production readiness, root-cause history, validation evidence, known blockers, smallest safe fix queue, and the reusable template for Meta, Google Ads, LinkedIn, and other future platform sources.

This file describes what the tab is. It is not the production-readiness certification.

Production-readiness status is revision-specific. Do not reuse a historical
positive statement after any dependency changes.

## Current User-Facing Meaning

The tab label is `Ad Comparison`, but the current GA4 implementation compares campaign rows.

Important meaning:

- it is a GA4 campaign-row comparison layer
- it is not true ad-level, ad-group-level, creative-level, or keyword-level reporting
- executive-facing copy should not imply that GA4 can identify a winning ad or creative from this tab alone

Safe language:

- compare performance across GA4 campaigns
- campaign-row comparison
- campaigns compared
- GA4 acquisition breakdown

Unsafe language unless the implementation changes:

- best ad
- best creative
- creative winner
- ad-level winner
- paid-media optimization decision based only on GA4 campaign rows

## Scope Contract

GA4 Ad Comparison must remain scoped to:

- the selected campaign
- the selected client
- the connected GA4 property
- the saved GA4 campaign/source selection for that campaign
- active revenue sources for the same campaign and GA4 platform context

Ad Comparison must not silently broaden to:

- unrelated GA4 properties
- unrelated clients
- unrelated campaigns
- unselected GA4 campaign/source values
- unscoped revenue or spend sources

## Current Tab Structure

The current tab contains:

- top leader-card row when at least two comparison rows exist
- metric dropdown in the header
- Most Key Events, conversion-rate leader and attention cards,
  plus metric-based chart and selected-metric summary
- comparison chart limited to the top 10 rows for the selected metric
- selected-metric total and `Campaigns Compared` summary cards
- `Revenue Breakdown` table

Supported dropdown metrics:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

## Data Inputs

The tab is built from:

- GA4 Overview Campaign Breakdown rows for the chart, leader cards, and two summary cards
- separate native GA4 Ad Comparison rows for Revenue Breakdown
- selected GA4 campaign/property scope from campaign setup
- active, materialized revenue source rows for the same campaign and GA4
  platform context; only revenue uniquely matched by the normalized allocation key is added to the
  Overview-based chart/cards/summary, while source provenance remains separate

It must not use:

- unrelated GA4 property data
- unrelated campaign rows from the same owner
- unscoped revenue or spend sources
- guessed external attribution
- proportional revenue allocation
- source-to-date imported revenue in native comparison rows
- source definitions or saved configuration totals as a value fallback
- display-only source labels as attribution keys when stable campaign identity is available

## Normalized Comparison Rows

The chart, leader cards, and two summary cards use GA4 Overview Campaign Breakdown rows.
The page first aggregates rows by their original campaign names; the chart/card/summary
path then combines case variants under a lowercased name. The other Ad Comparison
outputs use separate native comparison rows.

A normalized comparison row has:

- `name`
- `sessions`
- `users`
- `conversions`
- `revenue`
- `conversionRate`
- `revenuePerSession`

Row rules:

- aggregate GA4 breakdown rows by campaign name
- query the saved property and full saved campaign names with exact provider matching;
  the page also checks returned names with its existing normalized allocation key,
  which is a secondary filter rather than the provider's exact-match rule
- start at the selected connection's saved initial historical import boundary
- end at the latest completed reporting day in the campaign timezone
- take conversion rate from GA4's native `sessionKeyEventRate` and convert its fraction to a percentage
- use only native GA4 row revenue in the separate native comparison rows
- never create a comparison row from imported-source configuration
- never infer, merge, or proportionally allocate source-to-date revenue into the
  native rows

## Revenue Window Boundary

Native comparison rows use one provider window from the saved
initial historical import boundary through the latest completed reporting day
in the campaign timezone. The chart, leader cards, and summary cards match the GA4 Overview
Campaign Breakdown table: traffic uses its saved import window, and Revenue adds
uniquely mapped imported revenue to its native campaign-start revenue. Imported
revenue remains separate from native comparison values.

Imported revenue cannot determine Most Key Events, which ranks by observed
GA4 key events. The Highest Conversion Rate card displays Overview row revenue.

## Leader Cards

The leader cards consume the same campaign rows as the chart. The selected
metric controls the chart, not the leader-card rankings.

Shared selector:

- `selectGA4AdComparisonLeaderCards(chartSummaryRows, selectedMetric)` in `shared/ga4-ad-comparison-cards.ts`

### Most Key Events

Meaning:

- campaign row with the most observed GA4 key events

Rules:

- does not change when the dropdown metric changes
- has no winner when all rows have zero key events
- cannot be created by imported-only revenue
- must show the key event count and exact card conversion rate to two decimals
- must not add suffixes such as `(matched external included)` to the campaign label

### Highest Conversion Rate

Meaning:

- campaign row with the highest conversion rate among rows with sessions and a
  positive conversion rate; this is not a spend-efficiency claim

Rules:

- does not change when the selected metric changes
- excludes zero-session and zero-rate rows; has no winner when all rates are zero
- uses the Overview Campaign Breakdown revenue in the detail line
- shows exact card conversion rate to two decimals so close-rate decisions are explainable

### Needs Attention

Meaning:

- campaign row with the lowest conversion rate among meaningful-volume rows

Meaningful-volume rule:

- rows must have sessions
- prefer rows at or above `max(25 sessions, 10% of the largest campaign row's sessions)`
- if no row meets that floor, fall back to all rows with sessions
- when the lowest-rate row is also `Most Key Events` and another eligible row
  has the same lowest exact rate, use the other tied row for `Needs Attention`

Display rule:

- show exact card conversion rate to two decimals and sessions from the Overview campaign row
- never use stale, previous-property, or unverified row values

### Validation Rule

Card selection uses exact numeric values, not rounded display strings. Validate close decisions with row-level inputs:

- `conversionRate = GA4 sessionKeyEventRate * 100`; key events count and sessions alone cannot establish how many sessions contained a key event
- `Most Key Events` equals the row with the most GA4 key events, or has no winner
  when every row has zero conversions
- `Highest Conversion Rate` equals the highest positive exact conversion rate
  among rows with sessions
- `Needs Attention` equals the lowest exact conversion rate among meaningful-volume rows
- if one-decimal labels appear tied, the card detail should show two-decimal CR so the decision is explainable

Example:

- GA4 session key event rates of `0.1245` and `0.1250` display as `12.45%` and `12.50%`
- with selected metric `Sessions`, the first row can be both `Most Key Events` and `Needs Attention`, while the second row can have the highest conversion rate

## Summary Cards

The first summary card follows the selected dropdown metric.

Rules:

- `Revenue` renders as `Campaign Breakdown Revenue` and sums the exact values
  displayed in GA4 Overview Campaign Breakdown.
- `Conversion Rate` renders as `Overall Conversion Rate`.
- `Overall Conversion Rate` is the session-weighted GA4 session key event rate across all compared rows.
- Do not use key event count divided by sessions or an unweighted average of campaign-row rates.
- `Users` sums GA4 `totalUsers` row values and keeps a tooltip because those
  counts are non-additive across campaign rows.
- Every selected-metric total uses all compared rows, even though the chart shows at most 10.
- `Campaigns Compared` counts distinct case-folded Overview campaign names, not just the visible bars.

## Revenue Breakdown

The `Revenue Breakdown` table shows source provenance, not row attribution.

Columns:

- `Source`
- `Amount`

Rules:

- `GA4 Revenue (imported to date)` sums the native comparison rows from the
  selected GA4 property and saved campaign values, using the saved initial-import
  boundary through the latest completed reporting day. It is not the Overview
  native Revenue & Financials amount when that section uses a different window.
- active imported sources use the same campaign-scoped source definitions and
  materialized revenue records as Overview Revenue & Financials. The
  `revenue-breakdown` API reads records from `1900-01-01` through the current
  UTC date. These source-to-date amounts remain separate from native All
  Campaigns rows; uniquely mapped amounts can appear in the Overview-based
  chart and leader cards.
- source rows can include indented per-campaign subsections from saved exact `campaignValueRevenueTotals`.
- subsection rows must use stored exact source values only.
- do not invent or proportionally allocate subsection values.
- preserve valid source zero values.
- never fall back to stale source-definition/configuration totals when
  materialized values are unavailable.
- do not render a combined `Total Revenue`; its inputs do not share a proven
  window.
- when both native comparison and chart rows are empty, the page renders its
  no-campaign-data state instead of the Revenue Breakdown table.
- if source definitions load but a source has no materialized amount, its row
  displays `Unavailable`; a failed refresh with cached data displays a last-good
  warning. A verified materialized zero stays zero.

## State Contract

- `loading`: no verified current-property rows are rendered.
- `ready`: provider/source reads completed; valid zero and empty results remain
  distinct from failure.
- `stale`: last-good values may remain visible only with an explicit warning.
- `unavailable`: no plausible zero or ranking is rendered.
- previous-property placeholder rows are not rendered.

## Reports Ownership Boundary

PDF generation, downloads, saved reports, snapshots, scheduling, and delivery
belong to the Reports section. The separate Revenue Breakdown certificate
validates its browser PDF values and the scheduled PDF source-window fix for
the recorded campaign; it does not certify report saving, scheduling, or delivery.

The live tab path certified here is `client/src/pages/ga4-ad-comparison.tsx`,
with its data preparation in `client/src/pages/ga4-metrics.tsx`. Broader Reports
output and delivery remain governed by `GA4/REPORTS_PRODUCTION_READINESS.md`;
the Revenue Breakdown certificate covers only its named PDF value paths.

## Refresh Pattern

The current tab has no dedicated Ad Comparison background job.

It refreshes from the same refreshed inputs that power the GA4 page:

1. GA4 campaign breakdown data is refetched from the provider.
2. Revenue source definitions and exact materialized breakdown rows are
   refetched.
3. Normalized comparison rows are rebuilt.
4. The live tab renders from those rows.

Do not add a separate Ad Comparison scheduler unless the product design explicitly changes.

## Production-Readiness Reference

The current readiness state, blockers, smallest safe fix queue, validation evidence, and future-platform template are maintained in:

- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
