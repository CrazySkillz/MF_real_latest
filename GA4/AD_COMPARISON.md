# GA4 Ad Comparison

## Purpose

This file is the short functional overview for the GA4 `Ad Comparison` tab.

Use `GA4/AD_COMPARISON_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, known blockers, and future-platform template guidance.

Current durable answer:

`GA4 Ad Comparison is production-ready for the current GA4 code scope, with one deferred validation: deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured.`

Future-reference rule: this functional document follows the readiness certification in `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`. Treat the tab as production-ready except for that one Mailgun-dependent deployed scheduled/server PDF validation unless the readiness file is changed by a later audit, the deferred validation fails, deployed evidence contradicts it, product requirements change, or a new platform implementation is being assessed.

## Document Ownership

The Ad Comparison documentation is intentionally split into two files:

- `GA4/AD_COMPARISON.md`
  Functional overview of the current GA4 Ad Comparison tab.
- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
  Canonical source of truth for production readiness, root-cause history, validation evidence, known blockers, smallest safe fix queue, and the reusable template for Meta, Google Ads, LinkedIn, and other future platform sources.

This file describes what the tab is. It is not the production-readiness certification.

Production-readiness status:

- current GA4 Ad Comparison code is production-ready for the current GA4 scope
- all identified Ad Comparison code fixes are implemented and locally validated
- the only deferred validation is deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured

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

- top leader-card row
- metric dropdown in the header
- metric-based ranking for leader cards, chart, and selected-metric summary
- comparison chart
- summary cards
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
- normalized GA4 totals from the GA4 page parent
- active revenue source rows for the same campaign and GA4 platform context
- saved source mapping metadata for exact campaign-value revenue matching

It must not use:

- unrelated GA4 property data
- unrelated campaign rows from the same owner
- unscoped revenue or spend sources
- guessed external attribution
- proportional revenue allocation
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
- calculate conversion rate as `conversions / sessions * 100`
- include exact campaign-matched imported revenue in `revenue`
- never infer or proportionally allocate unmatched external revenue
- keep unmatched external revenue visible as `Unallocated External Revenue`
- if imported revenue creates a campaign row that GA4 did not return directly, include that row with zero GA4 sessions/users/conversions unless refreshed GA4 data later supplies those metrics

## Exact Revenue Matching

External revenue may be added to campaign rows only when source data saves real campaign-identifying values that match a normalized campaign row exactly.

Allowed:

- exact normalized campaign-value match
- explicit saved mapping from source campaign value to selected platform campaign value

Not allowed:

- proportional allocation by sessions
- proportional allocation by conversions
- matching by display label only when a stable campaign identity is available
- matching to unrelated campaigns in the same account/property
- matching external revenue into more than one ambiguous row

If a revenue amount cannot be matched safely, it remains visible as `Unallocated External Revenue`.

## Leader Cards

The leader cards consume normalized comparison rows after exact imported revenue has been merged.

Shared selector:

- `selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)` in `shared/ga4-ad-comparison-cards.ts`

### Best Performing

Meaning:

- highest-ranked normalized comparison row for the current selected dropdown metric

Rules:

- changes when the dropdown metric changes
- can be a zero-session mapped-revenue row when selected metric is `Revenue`
- must show the selected metric value and exact card conversion rate to two decimals
- must not add suffixes such as `(matched external included)` to the campaign label

### Most Efficient

Meaning:

- campaign row with the highest conversion rate among rows with sessions

Rules:

- does not change when the selected metric changes
- excludes zero-session rows
- uses adjusted row revenue in the detail line
- shows exact card conversion rate to two decimals so close-rate decisions are explainable

### Needs Attention

Meaning:

- campaign row with the lowest conversion rate among meaningful-volume rows

Meaningful-volume rule:

- rows must have sessions
- prefer rows at or above `max(25 sessions, 10% of the largest campaign row's sessions)`
- if no row meets that floor, fall back to all rows with sessions

Display rule:

- show exact card conversion rate to two decimals and sessions from the adjusted normalized row
- never use pre-merge or stale row values

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

- `Revenue` renders as `Total Revenue (All Sources)` and uses the full GA4 plus imported-source financial total.
- `Conversion Rate` renders as `Overall Conversion Rate`.
- `Overall Conversion Rate` is calculated as total conversions divided by total sessions across comparison rows.
- Do not average campaign-row conversion rates for the summary card unless the product explicitly changes the metric definition.
- `Users` keeps a tooltip because GA4 user counts are non-additive across campaign rows.

## All Campaigns Table

The `All Campaigns` table includes:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Rules:

- keep a stable campaign-row order from the normalized GA4 breakdown; do not re-sort this table when the metric dropdown changes
- when no revenue-provenance description is shown, the table should sit directly under the `All Campaigns` title without a blank descriptor gap
- use adjusted normalized rows
- revenue means GA4 campaign-row revenue plus exact campaign-matched imported revenue
- users remain directional because GA4 user counts are not perfectly additive across rows
- show `Unallocated External Revenue` only for meaningful imported-source revenue that cannot be matched safely
- compute unallocated external revenue from imported-source revenue minus exact matched external revenue
- suppress a one-cent matched-source residual as rounding reconciliation
- show `Total Revenue (All Sources)` as the final summary row

## Revenue Breakdown

The `Revenue Breakdown` table shows source provenance, not row attribution.

Columns:

- `Source`
- `Amount`

Rules:

- `GA4 Revenue` shows the source-level GA4-native financial total passed from the GA4 parent page.
- `GA4 Revenue` must not be recomputed from the sum of rounded comparison rows.
- active imported sources show their source amount.
- source rows can include indented per-campaign subsections from saved exact `campaignValueRevenueTotals`.
- subsection rows must use stored exact source values only.
- do not invent or proportionally allocate subsection values.
- do not duplicate a standalone `Unallocated External Revenue` row when that same amount is already represented in source subsections.
- a one-cent difference between rounded campaign rows and source-level totals is not a separate source row.
- `Total Revenue` renders as the final row and must reconcile to source-level GA4 revenue plus imported-source revenue.

## Reports

Required parity paths:

- live tab: `client/src/pages/ga4-ad-comparison.tsx`
- browser-generated report PDF: `client/src/pages/ga4-metrics.tsx`
- scheduled/server report PDF: `server/ga4-scheduled-report-pdf.ts`

Rules:

- report output must use the same normalized row meaning as the live tab
- report All Campaigns tables must keep stable campaign-row order and must not be controlled by the live metric dropdown
- report leader cards must use the shared selector
- scheduled/server PDF currently uses `sessions` as the explicit default selected metric because scheduled report config does not persist the user's live dropdown selection
- scheduled/server PDF revenue-provenance parity is implemented and locally validated; deployed artifact evidence is deferred until Mailgun is properly configured
- if report config later persists an Ad Comparison selected metric, scheduled/server PDF must pass that saved value into the same selector

## Refresh Pattern

The current tab has no dedicated Ad Comparison background job.

It refreshes from the same refreshed inputs that power the GA4 page:

1. Overview refresh updates GA4 daily and to-date values.
2. GA4 campaign breakdown data is refetched.
3. Revenue source rows are refetched.
4. Normalized comparison rows are rebuilt.
5. The live tab and report outputs render from those rows.

Do not add a separate Ad Comparison scheduler unless the product design explicitly changes.

## Production-Readiness Reference

The current readiness state, blockers, smallest safe fix queue, validation evidence, and future-platform template are maintained in:

- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`