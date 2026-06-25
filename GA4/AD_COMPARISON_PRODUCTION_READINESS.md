# GA4 Ad Comparison Production Readiness

## Purpose

This file is the production-readiness contract for the GA4 `Ad Comparison` tab.

Use it for:

- GA4 Ad Comparison bug fixes
- GA4 Ad Comparison production-readiness reviews
- GA4 Ad Comparison report-output reviews
- template work for equivalent tabs in Meta, Google Ads, LinkedIn, TikTok, Instagram, and future platforms

This file replaces the older descriptive Ad Comparison contract. The old name was too weak because this tab affects executive-facing comparison signals and report output.

## Fast Answer For A New Session

The current GA4 Ad Comparison implementation is a campaign-row comparison view, not true ad-level or creative-level analytics.

The top leader cards are acceptable only when they are understood as GA4 campaign-row signals:

- `Best Performing`: highest row for the currently selected dropdown metric
- `Most Efficient`: highest conversion rate among rows with sessions
- `Needs Attention`: lowest conversion rate among meaningful-volume rows

The live tab, ad-hoc GA4 report PDF, and scheduled/server GA4 report PDF must all use the same leader-card selector:

- `shared/ga4-ad-comparison-cards.ts`

If a future review finds a separate copied implementation for these leader cards, treat that as a production-readiness defect.

## Required Code Anchors

Current GA4 implementation files:

- Live tab component: `client/src/pages/ga4-ad-comparison.tsx`
- GA4 page parent and ad-hoc PDF generation: `client/src/pages/ga4-metrics.tsx`
- Shared leader-card selector: `shared/ga4-ad-comparison-cards.ts`
- Scheduled/server PDF generation: `server/ga4-scheduled-report-pdf.ts`
- Functional leader-card tests: `server/ga4-ad-comparison-card-logic.test.ts`
- UI/report parity guard: `server/ga4-ui-regression.test.ts`
- Cross-tab aggregation tests: `server/ga4-cross-tab-consistency.test.ts`

Supporting GA4 docs:

- `GA4/README.md`
- `GA4/OVERVIEW.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4/REFRESH_AND_PROCESSING.md`
- `GA4/REPORTS.md`

## Current User-Facing Meaning

The tab label is `Ad Comparison`, but the current GA4 implementation compares campaign rows.

This is intentionally documented because executives could otherwise interpret the cards as ad, ad set, creative, or keyword decisions.

Safe language:

- Compare performance across GA4 campaigns
- Campaign-row comparison
- Campaigns compared
- GA4 acquisition breakdown

Unsafe language unless the implementation changes:

- Best ad
- Best creative
- Creative winner
- Ad-level winner
- Paid-media optimization decision based only on GA4 campaign rows

## Current GA4 Tab Structure

The current tab contains:

- top leader-card row
- metric dropdown in the header, right-aligned above the third leader-card column on desktop
- metric-based ranking
- comparison chart
- summary cards
- `All Campaigns` table
- `Revenue Breakdown` table

The supported dropdown metrics are:

- `Sessions`
- `Users`
- `Conversions`
- `Revenue`
- `Conversion Rate`

## Summary Metric Cards

The first summary card follows the selected dropdown metric.

Rules:

- `Revenue` renders as `Total Revenue (All Sources)` and uses the full GA4 plus imported-source financial total.
- `Conversion Rate` renders as `Overall Conversion Rate`, not `Total Conversion Rate` and not `Avg Conversion Rate`.
- The `Overall Conversion Rate` value is calculated as total conversions divided by total sessions across the comparison rows.
- Do not average campaign-row conversion rates for the summary card unless the product explicitly changes the metric definition.
- `Users` keeps a tooltip because GA4 user counts are non-additive across campaign rows; tooltip copy should use plain readable ASCII text.

## Production Status

### Proven Locally

The following are locally proven by code trace and targeted regression tests:

- The live tab leader cards use `shared/ga4-ad-comparison-cards.ts`.
- The ad-hoc GA4 report PDF path in `client/src/pages/ga4-metrics.tsx` uses the same selector.
- The scheduled/server GA4 report PDF path in `server/ga4-scheduled-report-pdf.ts` uses the same selector.
- `Best Performing` follows the selected metric in the live tab and ad-hoc PDF path.
- Scheduled/server PDF output currently uses `sessions` as the explicit default selected metric because no saved Ad Comparison dropdown metric is persisted in report config.
- `Most Efficient` ignores zero-session rows and uses conversion rate.
- `Needs Attention` uses lowest conversion rate among meaningful-volume rows.
- `Needs Attention` ignores tiny low-signal rows when meaningful-volume rows exist.
- Exact campaign-matched imported revenue can be included in adjusted comparison rows.
- Mapped external-revenue rows with zero GA4 sessions can win `Best Performing` when the selected metric is `Revenue`, but they cannot win efficiency cards because efficiency requires sessions.
- The metric dropdown is visually placed in the tab header before the leader-card row because it controls both the leader cards and chart/table ranking.
- `Overall Conversion Rate` is the summary label for the weighted conversion-rate calculation, which is total conversions divided by total sessions.
- The live tab receives imported-source revenue directly from the parent GA4 metrics page; unallocated external revenue is not inferred from `Total Revenue - campaign-row GA4 revenue`.
- One-cent residuals after exact matched external revenue are suppressed as rounding reconciliation, not shown as `Unallocated External Revenue`.
- The live `Revenue Breakdown` table shows `GA4 Revenue` from the source-level GA4 financial total, not the sum of rounded comparison rows.
- Ad Comparison tooltip and helper copy is guarded against mojibake from non-ASCII dash or bullet characters.

### Partially Reviewed

The following are partially reviewed from local code, but not proven end-to-end in a live deployed environment:

- live GA4 Data API refresh into `ga4Breakdown`
- live source refresh into `revenueDisplaySources`
- deployed scheduled report generation timing
- email attachment receipt and exact visual output
- browser rendering for every viewport and every row-count edge case

### Not Claimed

Do not claim the whole Ad Comparison section is fully production-ready unless these are also validated:

- selected GA4 campaign/property scope is correct in live data
- current `ga4Breakdown` rows match the saved GA4 campaign scope
- external revenue sources are active, campaign-scoped, and platform-context scoped
- source edits/deletes/refreshes recompute comparison rows correctly
- live report downloads match the visible tab
- scheduled report PDFs match the latest refreshed values at send time
- full repo regression state is acceptable, or unrelated failures are documented and accepted

## Data Source Contract

The GA4 Ad Comparison tab is built from these inputs:

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
- display-only source labels as attribution keys

## Normalized Comparison Row Contract

All visible comparison outputs must be built from normalized comparison rows.

A normalized comparison row has:

- `name`
- `sessions`
- `users`
- `conversions`
- `revenue`
- `conversionRate`
- `revenuePerSession`

The row rules are:

- aggregate GA4 breakdown rows by campaign name
- apply the saved campaign/property scope before rendering
- scale row metrics only according to existing GA4 parent-page behavior
- calculate conversion rate as `conversions / sessions * 100`
- include exact campaign-matched imported revenue in `revenue`
- never infer or proportionally allocate unmatched external revenue
- keep unmatched external revenue visible as `Unallocated External Revenue`
- if imported revenue creates a campaign row that GA4 did not return directly, include that row with zero GA4 sessions/users/conversions unless refreshed GA4 data later supplies those metrics

## Exact Revenue Matching Rule

External revenue may be added to campaign rows only when the source saves real campaign-identifying values that match a normalized campaign row exactly.

Allowed:

- exact normalized campaign-value match
- explicit saved mapping from source campaign value to selected platform campaign value

Not allowed:

- proportional allocation by sessions
- proportional allocation by conversions
- matching by display label only when a stable campaign identity is available
- matching to unrelated campaigns in the same account/property
- matching external revenue into more than one ambiguous row

If a revenue amount cannot be matched safely, it must remain visible as `Unallocated External Revenue`.

## Leader Card Contract

The leader cards must always consume normalized comparison rows after exact imported revenue has been merged.

The shared selector is:

- `selectGA4AdComparisonLeaderCards(comparisonRows, selectedMetric)` in `shared/ga4-ad-comparison-cards.ts`

### Best Performing

Meaning:

- highest-ranked normalized comparison row for the current selected dropdown metric

Rules:

- changes when the dropdown metric changes
- can be a zero-session mapped-revenue row when selected metric is `Revenue`
- must show the selected metric value and conversion rate
- must not add suffixes such as `(matched external included)` to the campaign label

### Most Efficient

Meaning:

- campaign row with the highest conversion rate among rows with sessions

Rules:

- does not change when the selected metric changes
- excludes zero-session rows
- uses adjusted row revenue in the detail line
- must not use stale GA4-native-only revenue after imported revenue is merged

### Needs Attention

Meaning:

- campaign row with the lowest conversion rate among meaningful-volume rows

Meaningful-volume rule:

- rows must have sessions
- prefer rows at or above `max(25 sessions, 10% of the largest campaign row's sessions)`
- if no row meets that floor, fall back to all rows with sessions

Duplication rule:

- avoid duplicating `Best Performing` only when another row is tied for the same lowest conversion rate
- do not select a materially stronger conversion-rate row just to avoid duplication
- do not select `Most Efficient` as `Needs Attention` just because the lowest conversion-rate row is also `Best Performing`

Display rule:

- show conversion rate and sessions from the adjusted normalized row
- never use pre-merge or stale row values

## Report Parity Contract

The live tab and all report outputs must use the same normalized rows and the same leader-card selector.

Required parity paths:

- live tab: `client/src/pages/ga4-ad-comparison.tsx`
- ad-hoc report PDF: `client/src/pages/ga4-metrics.tsx`
- scheduled/server report PDF: `server/ga4-scheduled-report-pdf.ts`

Required selector:

- `shared/ga4-ad-comparison-cards.ts`

Report-specific rule:

- the scheduled/server PDF currently uses `sessions` as the explicit default selected metric because scheduled report config does not persist the user's live dropdown selection
- if report config later persists an Ad Comparison selected metric, scheduled/server PDF must pass that saved value into the same selector

Production defect examples:

- live tab uses one selector but PDF uses copied logic
- scheduled report chooses `Needs Attention` by lowest sessions
- ad-hoc PDF avoids a `Best Performing` duplicate by selecting a stronger row
- any report uses stale GA4-only row revenue after exact imported revenue is merged

## All Campaigns Table Contract

The `All Campaigns` table includes:

- `Campaign`
- `Sessions`
- `Users`
- `Conversions`
- `Conv Rate`
- `Revenue`

Rules:

- sort by the selected metric
- use adjusted normalized rows
- revenue means GA4 campaign-row revenue plus exact campaign-matched imported revenue
- users remain directional because GA4 user counts are not perfectly additive across rows
- keep the Users tooltip because the same person can appear in more than one row
- show `Unallocated External Revenue` only for meaningful imported-source revenue that cannot be matched safely
- compute unallocated external revenue from imported-source revenue minus exact matched external revenue, not from `Total Revenue - GA4 campaign-row revenue`
- suppress a one-cent matched-source residual as rounding reconciliation instead of showing it as business-significant unallocated revenue
- show `Total Revenue (All Sources)` as the final summary row
- summary rows should use blank cells in non-Revenue columns instead of placeholder dashes

## Revenue Breakdown Contract

The `Revenue Breakdown` table shows source provenance, not row attribution.

Columns:

- `Source`
- `Amount`

Rules:

- `GA4 Revenue` shows the source-level GA4-native financial total passed from the GA4 parent page.
- `GA4 Revenue` must not be recomputed from the sum of rounded comparison rows.
- active imported sources show their source amount
- source rows can include indented per-campaign subsections from saved exact `campaignValueRevenueTotals`
- subsection rows must use stored exact source values only
- do not invent or proportionally allocate subsection values
- do not duplicate a standalone `Unallocated External Revenue` row when that same amount is already represented in source subsections
- a one-cent difference between rounded campaign rows and source-level totals is not a separate source row
- `Total Revenue` renders as the final row and must reconcile to source-level GA4 revenue plus imported-source revenue

## Refresh Contract

The current tab has no dedicated Ad Comparison background job.

It refreshes from the same refreshed inputs that power the GA4 page:

1. Overview refresh updates GA4 daily and to-date values.
2. GA4 campaign breakdown data is refetched.
3. Revenue source rows are refetched.
4. Normalized comparison rows are rebuilt.
5. The live tab and report outputs render from those rows.

Do not add a separate Ad Comparison scheduler unless the product design explicitly changes.

## Production Safety Rule

If the comparison row source, scope, or revenue matching cannot be proven, prefer hiding or gating the affected comparison signal over showing a misleading executive card.

Remove or gate leader cards when:

- campaign/property scope is unknown
- comparison rows include unrelated campaigns
- imported revenue is ambiguously matched
- row metrics are known to be stale but displayed as current
- live tab and report output cannot be kept in parity
- the platform does not expose enough entity-level data for a meaningful comparison

For GA4 today, do not remove the cards for card-selection accuracy. The selector is centralized and regression-covered. Continue to label the section as campaign-row comparison rather than true ad-level analytics.

## Regression Tests Required

Required tests for this section:

- `server/ga4-ad-comparison-card-logic.test.ts`
- `server/ga4-ui-regression.test.ts`
- relevant report tests if report config or scheduled output changes

Minimum behavior coverage:

- `Best Performing` follows selected metric
- `Most Efficient` uses highest conversion rate among rows with sessions
- `Needs Attention` uses lowest conversion rate among meaningful-volume rows
- `Needs Attention` ignores tiny low-signal rows when meaningful-volume rows exist
- `Needs Attention` does not choose the most efficient row just to avoid duplication
- zero-session mapped-revenue rows can be best for `Revenue` but not efficiency cards
- live tab, ad-hoc PDF, and scheduled PDF use one shared selector
- metric selector remains in the header before leader cards
- unallocated external revenue is based on imported-source residuals only
- `Revenue Breakdown` uses source-level GA4 revenue, not rounded row-sum revenue
- summary conversion-rate label is `Overall Conversion Rate`
- Ad Comparison user/tooling copy does not contain mojibake characters

Recommended commands:

```bash
npm test -- server/ga4-ad-comparison-card-logic.test.ts server/ga4-ui-regression.test.ts
npm run check
```

Run full tests when feasible:

```bash
npm test
```

If full tests fail in unrelated areas, document the failing files and do not claim global production readiness.

## Root Cause Lessons From Recent Fix

The repeated review miss came from checking only that leader cards referenced `comparisonRows`.

That was insufficient because:

- card selection edge cases were not executed by tests
- live UI and report output had copied logic
- scheduled PDF used `Needs Attention` as lowest sessions instead of lowest conversion rate
- avoiding a duplicate `Best Performing` row was interpreted too broadly
- selector placement below the cards made the dropdown look chart-only even though it controls leader cards and chart/table ranking
- deriving external revenue from total revenue minus rounded GA4 campaign rows created penny-level false unallocated revenue
- using rounded comparison-row sums in `Revenue Breakdown` made source-level totals appear inconsistent by one cent
- non-ASCII dash and bullet characters became mojibake in Ad Comparison UI copy

The durable fix is:

- one shared selector
- behavioral tests for edge cases
- UI/report parity guard
- explicit documentation that these are campaign-row cards

## Template For Other Platforms

Use this sequence when refining Meta, Google Ads, LinkedIn, TikTok, Instagram, or another platform's Ad Comparison tab.

### 1. Define The Compared Entity

State exactly what the tab compares:

- campaign rows
- ad group rows
- ad rows
- creative rows
- keyword rows
- unavailable for this source

Do not use `Ad Comparison` wording to imply a lower-level entity than the source actually provides.

### 2. Prove Platform Scope

Before calculating rows, prove:

- campaign access is checked
- platform connection belongs to the campaign
- selected platform campaigns/accounts/properties are respected
- child revenue/spend sources are platform-context scoped
- unrelated rows in the same account/property are excluded

### 3. Build Normalized Rows

Every platform should define a normalized comparison row with stable fields.

Recommended common fields:

- `id` when available
- `name`
- `sessions`, `clicks`, or the platform's primary traffic metric
- `users` only when meaningful for the platform
- `impressions` when available
- `conversions`
- `spend` when available
- `revenue` when safely attributable
- `conversionRate`
- `costPerConversion` when spend exists
- `roas` when spend and revenue exist

If a metric is unavailable, mark it unavailable rather than filling zero.

### 4. Define Leader Cards From Available Metrics

Leader cards must be metric-safe for the source.

GA4 pattern:

- `Best Performing`: selected metric leader
- `Most Efficient`: highest conversion rate among session rows
- `Needs Attention`: lowest conversion rate among meaningful-volume rows

Paid-media pattern may differ, but must be explicit. For example:

- `Best Performing`: selected metric leader
- `Most Efficient`: lowest CPA among rows with spend and conversions, or highest ROAS when revenue is attributable
- `Needs Attention`: worst CPA, lowest ROAS, or low conversion rate among meaningful-volume rows

Do not copy GA4 session-based logic blindly into paid-media sources if clicks, spend, or impressions are the real source metrics.

### 5. Define Meaningful Volume

Every platform must define a low-signal filter before showing `Needs Attention`.

Examples:

- GA4: sessions at or above `max(25, 10% of largest row sessions)`
- paid media: clicks, spend, or impressions at or above a documented floor
- ecommerce: orders or sessions at or above a documented floor

If no row meets the floor, fall back to the prior all-eligible-row behavior and document it.

### 6. Centralize Shared Card Logic

Do not duplicate leader-card logic across:

- live tab
- ad-hoc report/download
- scheduled/server report
- snapshot JSON
- tests

Use one shared selector per platform or one generic selector with platform-specific configuration.

### 7. Keep Report Output In Parity

For each platform, verify:

- live tab and report output use the same normalized rows
- leader cards use the same selector
- table rows use the same row values
- report default metric is explicit when live UI state is not saved
- scheduled reports do not use stale or separately recomputed card logic

### 8. Add Regression Coverage

At minimum, add tests for:

- selected metric controls only the intended card
- efficiency card excludes ineligible rows
- attention card ignores low-signal rows
- exact revenue/spend attribution is included only when safe
- unmatched revenue/spend stays visible but unallocated
- report output uses the same selector as the live tab
- source scoping excludes unrelated campaigns/accounts

### 9. Document Production Status

Each platform doc must separate:

- proven locally
- partially reviewed
- not locally verifiable
- known limitations
- validation commands

Do not claim production readiness from a narrow code trace.

## New-Session Review Checklist

When a new chat session is asked to review Ad Comparison, do this in order:

1. Read `AGENTS.md`.
2. Read `ARCHITECTURE_USER_JOURNEY.md`.
3. Read `GA4/README.md`.
4. Read `GA4_DEVELOPMENT_WORKFLOW.md`.
5. Read this file.
6. Trace `client/src/pages/ga4-metrics.tsx` to `client/src/pages/ga4-ad-comparison.tsx`.
7. Trace normalized row creation and exact imported revenue matching.
8. Confirm live leader cards call `shared/ga4-ad-comparison-cards.ts`.
9. Confirm ad-hoc report output calls the same selector.
10. Confirm scheduled/server PDF output calls the same selector.
11. Confirm `All Campaigns` unallocated external revenue is based on imported-source residuals only.
12. Confirm `Revenue Breakdown` uses source-level GA4 revenue and imported source rows.
13. Confirm the conversion-rate summary label is `Overall Conversion Rate` and the calculation remains total conversions divided by total sessions.
14. Run focused tests.
15. State what is proven, partially reviewed, and not locally verifiable.

Do not answer `this section is correct` unless all items in the requested scope have been traced.
