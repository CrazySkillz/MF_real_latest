# GA4 Ad Comparison

## Purpose

This file is the short functional overview for the GA4 `Ad Comparison` tab.

Use `GA4/AD_COMPARISON_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, known blockers, and future-platform template guidance.

Current status:

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
- metric-based ranking for leader cards, chart, and selected-metric summary
- comparison chart limited to the top 10 rows for the selected metric
- selected-metric total and `Campaigns Compared` summary cards
- `All Campaigns` table
- `Revenue Breakdown` table

Supported dropdown metrics:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

## Data Inputs

The tab is built from:

- GA4 campaign-breakdown aggregate rows
- selected GA4 campaign/property scope from campaign setup
- active, exact materialized revenue source rows for the same campaign and GA4
  platform context, shown as separate source-to-date provenance

It must not use:

- unrelated GA4 property data
- unrelated campaign rows from the same owner
- unscoped revenue or spend sources
- guessed external attribution
- proportional revenue allocation
- source-to-date imported revenue in the native campaign ranking
- source definitions or saved configuration totals as a value fallback
- display-only source labels as attribution keys when stable campaign identity is available

## Normalized Comparison Rows

All visible comparison outputs are built from normalized comparison rows.

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
- apply saved campaign/property scope before rendering
- start at the selected connection's saved initial historical import boundary
- end at the latest completed reporting day in the campaign timezone
- calculate conversion rate as `conversions / sessions * 100`
- use only native GA4 row revenue in `revenue`
- never create a comparison row from imported-source configuration
- never infer, merge, or proportionally allocate source-to-date revenue into the
  native rows

## Revenue Window Boundary

GA4 comparison rows and rankings use one common provider window from the saved
initial historical import boundary through the latest completed reporting day
in the campaign timezone. Imported revenue currently has source-to-date
materialization, not a proven identical boundary. It is therefore shown only in Revenue
Breakdown with `source-to-date; excluded from ranking` provenance.

Imported revenue may enter campaign rankings only after a future implementation
proves exact campaign identity, active materialization, currency, timezone, and
the identical comparison window across all live tab surfaces.

## Leader Cards

The leader cards consume GA4-native normalized comparison rows.

Shared selector:

- `selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)` in `shared/ga4-ad-comparison-cards.ts`

### Best Performing

Meaning:

- highest-ranked normalized comparison row for the current selected dropdown metric

Rules:

- changes when the dropdown metric changes
- cannot be created by imported-only revenue
- must show the selected metric value and exact card conversion rate to two decimals
- must not add suffixes such as `(matched external included)` to the campaign label

### Most Efficient

Meaning:

- campaign row with the highest conversion rate among rows with sessions

Rules:

- does not change when the selected metric changes
- excludes zero-session rows
- uses native GA4 row revenue in the detail line
- shows exact card conversion rate to two decimals so close-rate decisions are explainable

### Needs Attention

Meaning:

- campaign row with the lowest conversion rate among meaningful-volume rows

Meaningful-volume rule:

- rows must have sessions
- prefer rows at or above `max(25 sessions, 10% of the largest campaign row's sessions)`
- if no row meets that floor, fall back to all rows with sessions
- when the lowest-rate row is also `Best Performing` and another eligible row
  has the same lowest exact rate, use the other tied row for `Needs Attention`

Display rule:

- show exact card conversion rate to two decimals and sessions from the native normalized row
- never use stale, previous-property, or unverified row values

### Validation Rule

Card selection uses exact numeric values, not rounded display strings. Validate close decisions with row-level inputs:

- `conversionRate = conversions / sessions * 100`
- `Best Performing` equals the highest row for the selected metric
- `Most Efficient` equals the highest exact conversion rate among rows with sessions
- `Needs Attention` equals the lowest exact conversion rate among meaningful-volume rows
- if one-decimal labels appear tied, the card detail should show two-decimal CR so the decision is explainable

Example:

- `34 / 273 = 12.45%`
- `25 / 200 = 12.50%`
- with selected metric `Sessions`, the first row can be both `Best Performing` and `Needs Attention`, while the second row can be `Most Efficient`

## Summary Cards

The first summary card follows the selected dropdown metric.

Rules:

- `Revenue` renders as `GA4 Revenue (Imported to Date)` and sums the
  normalized native comparison rows.
- `Conversion Rate` renders as `Overall Conversion Rate`.
- `Overall Conversion Rate` is calculated as total conversions divided by total sessions across comparison rows.
- Do not average campaign-row conversion rates for the summary card unless the product explicitly changes the metric definition.
- `Users` keeps a tooltip because GA4 user counts are non-additive across campaign rows.
- `Campaigns Compared` is the count of normalized comparison rows.

## All Campaigns Table

The `All Campaigns` table includes:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Rules:

- keep the normalized GA4 breakdown's stable sessions-descending order; do not re-sort this table when the metric dropdown changes
- when no revenue-provenance description is shown, the table should sit directly under the `All Campaigns` title without a blank descriptor gap
- use GA4-native normalized rows
- revenue means GA4 campaign-row revenue for the common import-to-latest-completed-day window
- users remain directional because GA4 user counts are not perfectly additive across rows
- do not add imported, unallocated, or all-source financial rows

## Revenue Breakdown

The `Revenue Breakdown` table shows source provenance, not row attribution.

Columns:

- `Source`
- `Amount`

Rules:

- `GA4 Revenue (imported to date)` is the sum of the same native comparison
  rows used by ranking, chart, summary, and All Campaigns.
- active imported sources show exact materialized source-to-date amounts and
  are explicitly excluded from ranking.
- source rows can include indented per-campaign subsections from saved exact `campaignValueRevenueTotals`.
- subsection rows must use stored exact source values only.
- do not invent or proportionally allocate subsection values.
- preserve valid source zero values.
- never fall back to stale source-definition/configuration totals when
  materialized values are unavailable.
- do not render a combined `Total Revenue`; its inputs do not share a proven
  window.

## State Contract

- `loading`: no verified current-property rows are rendered.
- `ready`: provider/source reads completed; valid zero and empty results remain
  distinct from failure.
- `stale`: last-good values may remain visible only with an explicit warning.
- `unavailable`: no plausible zero or ranking is rendered.
- previous-property placeholder rows are not rendered.

## Reports Ownership Boundary

PDF generation, downloads, saved reports, snapshots, scheduling, and delivery
belong to the Reports section. They are not part of the Ad Comparison tab
certification boundary.

The live tab path certified here is `client/src/pages/ga4-ad-comparison.tsx`,
with its data preparation in `client/src/pages/ga4-metrics.tsx`. Any Reports
output that presents Ad Comparison data must be validated under
`GA4/REPORTS_PRODUCTION_READINESS.md` and cannot expand or invalidate the
tab-only claim unless it changes a shared live-tab dependency.

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
