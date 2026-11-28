# GA4 Ad Comparison

## Purpose

This file is the short functional overview for the GA4 `Ad Comparison` tab.

Use `GA4/AD_COMPARISON_PRODUCTION_READINESS.md` for the durable production-readiness answer, validation evidence, known blockers, and future-platform template guidance.

Current status:

The current implementation and machine record are `UNVERIFIED`. The Revenue
Breakdown `TOTAL` row added in `5d6d9f79` has focused local regression,
TypeScript, build, and fail-closed certification-gate evidence, but that exact
revision has not yet been validated after deployment.

The retained live tab was historically `CLEAN-CERTIFIED / PRODUCTION_READY`
only for the Campaign2/property/saved-filter/USD boundary at deployed runtime
`70b73a229ebb9e1021c3d18d63119d05bdee7e26`. That evidence predates the
`TOTAL` row. `All Campaigns` remains absent from the live tab and new standard
reports; explicitly saved legacy custom reports retain it. The exact current
status, historical evidence, and exclusions are in
`GA4/AD_COMPARISON_PRODUCTION_READINESS.md`. Reports saving, scheduling, and
delivery are not certified here.

Older historical whole-tab status:

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
- Highest Revenue, Highest Conversion Rate, Lowest Revenue and Lowest Conversion Rate cards,
  plus the metric-based chart
- comparison chart limited to the top 10 rows for the selected metric
- no selected-metric total or `Campaigns Compared` summary cards in the live tab
- `Revenue Breakdown` table

Supported dropdown metrics:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

## Data Inputs

The tab is built from:

- the synchronized, daily-scheduler-published GA4 Overview Campaign Breakdown
  snapshot for the chart, leader cards, and two summary cards
- separate native GA4 Ad Comparison aggregates for Revenue Breakdown, read from
  the same synchronized snapshot without adding imported revenue
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
- all-mapped-record imported revenue in native comparison rows
- source definitions or saved configuration totals as a value fallback
- display-only source labels as attribution keys when stable campaign identity is available

## Normalized Comparison Rows

The chart, leader cards, and two summary cards use the synchronized GA4 Overview
Campaign Breakdown snapshot published atomically by the daily scheduler.
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
- the daily scheduler queries the saved property and full saved campaign names with
  exact provider matching, reconciles the result, and publishes the snapshot; the
  page rereads that stored snapshot and also checks returned names with its existing normalized allocation key,
  which is a secondary filter rather than the provider's exact-match rule
- start at the selected connection's saved initial historical import boundary
- end at the latest completed reporting day in the campaign timezone
- calculate conversion rate as `conversions / sessions * 100`, matching Overview; retain the native `sessionKeyEventRate` only as provider data, not this displayed metric
- use only native GA4 row revenue in the separate native comparison rows
- never create a comparison row from imported-source configuration
- never infer, merge, or proportionally allocate all-mapped-record imported revenue into the
  native rows

## Revenue Window Boundary

Native comparison rows use one provider window from the saved
initial historical import boundary through the latest completed reporting day
in the campaign timezone. The chart, leader cards, and summary cards match the GA4 Overview
Campaign Breakdown table: traffic uses its saved import window, and Revenue adds
uniquely mapped imported revenue to its native campaign-start revenue. Imported
revenue remains separate from native comparison values.

Revenue rankings use the chart's existing Overview campaign revenue, including exact campaign-mapped imported revenue. Conversion-rate rankings use the supplied saved rate without recalculation.

## Leader Cards

The leader cards consume the same campaign rows as the chart. The selected
metric controls the chart, not the leader-card rankings.

Shared selector:

- `selectGA4AdComparisonLeaderCards(chartSummaryRows, selectedMetric)` in `shared/ga4-ad-comparison-cards.ts`

### Four explicit rankings

- Order: Highest Revenue, Highest Conversion Rate, Lowest Revenue, Lowest Conversion Rate.
- Use the same saved campaign rows and imported dates as the chart. The dropdown changes only the chart metric.
- Revenue uses the existing campaign revenue, including recorded zero or negative values. Missing/nonfinite revenue makes both revenue rankings unavailable.
- Conversion rate uses the existing supplied rate, with no event-count division or recalculation. Include recorded 0% rates and all campaigns with sessions; the former 25-session attention threshold does not apply.
- Require at least two comparable rows for each metric. Zero-session rows cannot enter rate comparisons; unknown rates on eligible rows make both rate rankings unavailable.
- Show all exact ties in the UI campaign label; PDFs identify the first campaign and the count of other tied campaigns. Never choose an arbitrary sole winner from tied zero values.
- Preserve source scope, calculations, chart, dropdown, totals and query behavior. These are metric rankings, not claims about profitability or statistical significance.
- The same four rankings appear in browser and scheduled PDFs. Existing saved report subsection keys remain compatible; report schedules are unchanged.

### Validation Rule

Card selection uses exact numeric values, not rounded display strings. Validate close decisions with row-level inputs:

- `conversionRate = conversions / sessions * 100`, matching Overview for the same campaigns and dates; compute the overall rate from total conversions and total sessions, not an average of campaign percentages. The overall rate is unavailable with no sessions. Repeated/fractional conversions are preserved and the rate may exceed 100%.
- `Most Key Events` equals the row with the most GA4 key events, or has no winner
  when every row has zero conversions
- `Highest Conversion Rate` equals the highest positive exact conversion rate
  among rows with sessions
- `Needs Attention` equals the lowest exact conversion rate among meaningful-volume rows
- if one-decimal labels appear tied, the card detail should show two-decimal CR so the decision is explainable

Example:

- GA4 session key event rates of `0.1245` and `0.1250` display as `12.45%` and `12.50%`
- with selected metric `Sessions`, the first row can be both `Most Key Events` and `Needs Attention`, while the second row can have the highest conversion rate

## Report Summary Cards

The live tab omits the selected-metric total and `Campaigns Compared` cards, and the provisional-data notice. Other tabs retain their existing notices. Browser and scheduled reports are unchanged; their first summary card follows the selected report metric.

Rules:

- `Revenue` renders as `Campaign Breakdown Revenue` and sums the exact values
  displayed in GA4 Overview Campaign Breakdown.
- `Conversion Rate` renders as `Overall Conversion Rate`.
- `Overall Conversion Rate` is the session-weighted GA4 session key event rate across all compared rows.
- Do not use key event count divided by sessions or an unweighted average of campaign-row rates.
- Each campaign's `Users` comes from a native GA4 `totalUsers` query for that campaign and the displayed dates. `Total Users` comes from one query covering the complete selected scope; campaign counts can overlap and must not be added.
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
- Compute that source total from raw selected campaign amounts and round once;
  keep existing individually rounded campaign display/ranking inputs separate.
  Do not redistribute a rounding cent between campaigns.
- active imported sources use the same campaign-scoped materialized revenue
  records as Overview Revenue & Financials. The `revenue-breakdown` API reads
  records from `1900-01-01` through the latest completed reporting day in the
  campaign timezone.
- the live table renders only confirmed nonzero source-level amounts. A source
  with a confirmed zero contribution through the cutoff is omitted. It does not
  render undated `campaignValueRevenueTotals` from saved source configuration,
  because those values cannot prove the completed-day cutoff.
- uniquely mapped, completed-day-eligible amounts can still appear in the
  Overview-based chart and leader cards through their separate exact mapping path.
- never fall back to stale source-definition/configuration totals when
  materialized values are unavailable.
- `TOTAL` sums the native GA4 row and every confirmed imported source amount
  through the latest completed reporting day. Confirmed zero sources contribute
  zero even though their individual rows are omitted. This provenance total
  does not allocate imported revenue to GA4 campaign rows.
- `TOTAL` displays `Unavailable` while imported provenance is loading or
  unavailable, or when any active imported source lacks a confirmed amount.
  In the `stale` state it sums the visible last-good amounts and remains subject
  to the table's explicit stale warning.
- when both native comparison and chart rows are empty, the page renders its
  no-campaign-data state instead of the Revenue Breakdown table.
- if source definitions load but a source has no materialized amount, its row
  displays `Unavailable`; a failed refresh with cached data displays a last-good
  warning. A verified materialized zero is omitted from the table.

## State Contract

- `loading`: no verified current-property rows are rendered.
- `ready`: provider/source reads completed; verified zero and empty results stay
  distinct from failure even though zero imported-source rows are omitted.
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

1. The GA4 daily scheduler fetches and reconciles Campaign Breakdown, then
   atomically publishes it with the synchronized Overview snapshot.
2. Browser refetches reread that stored snapshot; they do not contact GA4 or
   rewrite the snapshot.
3. Revenue source definitions and exact materialized breakdown rows are
   refetched.
4. The separate native GA4 Ad Comparison request reads that same synchronized
   snapshot for Revenue Breakdown's import-to-date window; it does not make a
   provider request or renew tokens during page/report verification.
5. Normalized comparison rows are rebuilt and the live tab renders from them.

Do not add a separate Ad Comparison scheduler unless the product design explicitly changes.

## Production-Readiness Reference

### Optional units-sold cards

The live Campaign Comparison tab shows **Highest Units Sold** and **Fewest Units Sold** below the four revenue/rate cards only when every compared campaign has a verified `itemsPurchased` quantity for the same property and imported dates. Quantities use GA4 `sessionCampaignName` attribution; they are not conversion counts, order counts, or quantities inferred from revenue. Explicit zero quantities and ties are preserved. Missing, partial, malformed, sampled, thresholded, restricted, or truncated data hides both cards.

Normal saved-history imports may make one optional, five-second-bounded quantity request using exact selected campaign filters. Failure omits quantity metadata without blocking existing metric publication. Existing snapshots are not backfilled by page loads or deployments. The saved packet travels with Campaign Breakdown's existing atomic publication and read-only API; no new scheduler or schedule is introduced. Existing cards, charts, financial calculations and Reports remain unchanged. Provider availability for an individual property is only proven when a normal import successfully saves this optional packet.

The current readiness state, blockers, smallest safe fix queue, validation evidence, and future-platform template are maintained in:

- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
