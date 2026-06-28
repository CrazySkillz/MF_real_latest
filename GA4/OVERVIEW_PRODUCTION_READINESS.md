# GA4 Overview Production Readiness

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Overview` tab.

Use `GA4/OVERVIEW.md` to understand what the tab is, what the cards and tables mean, and how the user-facing GA4 Overview should behave.

Use this file to answer whether GA4 Overview is production-ready, what has been proven, what remains unproven, what fixes are required, and how the Overview pattern should be replicated for Meta, Google Ads, LinkedIn, or another platform source.

This file supersedes scattered Overview status notes in broader GA4 trackers when the question is specifically about GA4 Overview readiness.

## Durable Future Answer

GA4 Overview is production-ready for the current GA4 code scope.

The previously confirmed local blocker was fixed and validated in Commit 1:

- GA4 Overview Summary cards intentionally keep a coherent selected-campaign source hierarchy: persisted daily rows, then GA4 to-date totals, then breakdown fallback.
- GA4 Overview financial cards now use one selected scoped GA4 financial source for native revenue and conversions, choosing the most complete native revenue total across to-date, daily, and breakdown totals.
- `ga4RevenueForFinancials` no longer reads directly from the Summary-card `breakdownTotals.revenue` value.
- `financialConversions` no longer reads directly from the Summary-card `breakdownTotals.conversions` value.

Use this durable answer:

`GA4 Overview is production-ready for the current GA4 code scope, with normal external caveats for live GA4 API processing, deployed scheduler execution, deployed provider/source refreshes, and production data inventory.`

That answer should stay the same in future chats unless one of these changes:

- relevant Overview, financial-source, scheduler, report, KPI, Benchmark, or shared aggregate code changes
- validation fails
- source requirements change
- deployed evidence contradicts this document
- a new platform/source is being assessed instead of the existing GA4 implementation
- production data inventory proves damaged source records outside the already documented cleanup boundary

Normal external caveats remain:

- live GA4 API processing latency cannot be proven from local code
- deployed scheduler execution must be verified in the deployed environment
- deployed source refreshes must be verified with provider-backed data
- deployed report/email delivery evidence belongs to Reports readiness, not Overview readiness, unless the Overview values inside a report are wrong

## How To Use This File In A New Chat

Read in this order:

1. `Durable Future Answer`
2. `Current Fix Queue`
3. `Current Scope`
4. `Section Production-Readiness Map`
5. `Validation Evidence`
6. `Future Platform Template`
7. `Stable Response For Future Chats`

Do not reopen GA4 KPIs, GA4 Benchmarks, GA4 Ad Comparison, or GA4 Reports unless an Overview code path directly depends on a narrow value from those sections.

When applying this to another platform source, do not copy GA4 implementation details blindly. Copy the gates and contracts, then prove the new platform satisfies each gate with its own source model, account/property/customer scoping, date-window model, financial-source model, refresh model, and report-output path. For future-platform work, use `Future Platform Template` and `Future Platform Readiness Checklist` as the reusable acceptance checklist.

## Current Scope

This readiness file applies to the current GA4 Overview tab for:

- live UI rendering in `client/src/pages/ga4-metrics.tsx`
- GA4 campaign/property/source scoping
- Summary cards
- Total Revenue, Pipeline Proxy, Total Spend, Profit, ROAS, ROI, and CPA
- Campaign Breakdown
- Landing Pages
- Conversion Events
- source-provenance modals launched from Total Revenue, Pipeline Proxy, and Total Spend
- Overview values consumed by KPIs, Benchmarks, Ad Comparison, Insights, and browser-generated report output
- GA4 daily refresh behavior only where it feeds Overview values
- source-backed revenue/spend refresh behavior only where it feeds Overview values

This readiness file does not automatically certify:

- Meta Overview
- Google Ads Overview
- LinkedIn Overview
- custom-upload Overview
- whole GA4 Reports readiness
- whole GA4 Insights readiness
- whole GA4 Ad Comparison readiness
- whole GA4 KPI or Benchmark readiness
- provider-side delivery of scheduled emails
- live GA4 API behavior outside what local code and local tests can prove
- production database health outside the specific data boundaries that have been inventoried

## Root Cause Of Prior Confusion

Earlier Overview readiness statements were too broad for the evidence available at the time.

The main mismatch was scope:

- prior work proved important Overview-adjacent fixes, including GA4 campaign discovery, live `pageLocation` UTM fallback, removal of synthetic imported GA4 revenue writes, and Campaign DeepDive aggregate parity
- prior tracker language said GA4 Overview financial cards used GA4 to-date native totals
- the later frontend trace proved `ga4RevenueForFinancials` and `financialConversions` were still reading from `breakdownTotals`, the Summary-card source object
- Commit 1 fixed that boundary by keeping Summary cards on their coherent source hierarchy while moving financial revenue and CPA conversions to one selected scoped financial source
- Summary cards and financial cards have different intended window rules, so this file now records both contracts separately
This file fixes the documentation problem by keeping one Overview-specific source of truth:

- `OVERVIEW.md` describes intended tab behavior
- `OVERVIEW_PRODUCTION_READINESS.md` states whether the current implementation satisfies that behavior
- confirmed blockers are listed as commits
- validation gaps are separated from code defects

## Non-Negotiable Accuracy Rules

GA4 Overview must preserve:

- client scoping
- campaign scoping
- selected GA4 property scoping
- selected GA4 campaign/source scoping
- date-window semantics
- GA4 native metric meaning
- financial source provenance
- active-source-only revenue and spend totals
- Pipeline Proxy separation from confirmed revenue
- downstream KPI, Benchmark, Ad Comparison, Insights, and report meaning
- scheduler behavior and fail-closed ownership checks

Do not change calculations, attribution, source ownership, scheduler behavior, alert behavior, notification behavior, report behavior, or response shapes unless a traced root cause proves a bug in that exact path.

Do not use wider refactors for future Overview fixes. The completed financial-source fix was intentionally limited to a narrow frontend source-selection correction plus regression coverage.

## Data Path Summary

Primary live UI path:

`GA4 source connection -> saved campaign GA4 scope -> Overview API queries -> frontend Overview model -> visible cards and tables`

Native GA4 daily path:

`GA4 Data API time-series fetch -> ga4_daily_metrics rows -> /ga4-daily -> Summary cards and trend-adjacent context`

Native GA4 to-date path:

`GA4 Data API to-date totals -> /ga4-to-date -> candidate financial GA4 revenue/conversions source`

Financial source path:

`source setup/import/refresh -> revenue_records or spend_records joined to active source definitions -> /revenue-to-date, /revenue-breakdown, /spend-to-date, /spend-breakdown -> financial cards and source modals`

Report/output path:

`same Overview value model -> browser-generated GA4 report sections and downstream consumers`

Important meaning:

- Summary cards and financial cards may use different GA4 source windows by design.
- Summary cards need a coherent visible selected-campaign source and must avoid per-metric maximums.
- Financial cards need one selected scoped native GA4 financial source because imported revenue-to-date and spend-to-date are source-backed values, but native GA4 Revenue must not understate larger visible selected-campaign GA4 rows.
- Pipeline Proxy is an early-signal value and must not enter confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, or Reports unless the product contract changes explicitly.

## Current Fix Queue

Use these commit labels for completed Overview fixes and remaining validation gates. Each future validation gate should be completed, validated, and reported before moving to the next one.

### Commit 1: Align Overview financial GA4 source with scoped totals

Status: completed and validated.

Fix scope:

Correct only the frontend financial-source selection in `client/src/pages/ga4-metrics.tsx`.

Confirmed root cause:

- `overviewTotalsSource` selects the Summary-card source from daily rows, then GA4 to-date totals, then breakdown totals.
- `breakdownTotals` is built from `overviewTotalsSource`.
- `ga4RevenueForFinancials` previously read `Number(breakdownTotals.revenue || 0)`.
- `financialConversions` previously read `Number(breakdownTotals.conversions || 0)`.
- This coupled financial calculations to the Summary-card source hierarchy.
- When persisted daily rows existed for the default lookback window, financial cards could use that daily-window native revenue/conversion value instead of the intended selected financial source.
- A follow-up mismatch was then proven where Total Revenue showed `$6,718.74` while visible Campaign Breakdown GA4-native rows summed to `$16,265.32`, because `/ga4-to-date` was treated as unconditional financial source even when the visible selected-campaign daily/breakdown source had recovered a larger scoped native GA4 total.

Implementation completed:

1. Summary-card logic stayed unchanged.
2. Added a separate `ga4FinancialTotalsSource` near the existing financial calculations.
3. `ga4FinancialTotalsSource` selects one source object across `ga4ToDateOverviewTotals`, `dailySummedTotals`, and `ga4BreakdownTotals` by the largest scoped native GA4 revenue total.
4. `ga4FinancialTotalsSource` keeps revenue and conversions on that same selected source object instead of using per-metric maxima.
5. `ga4RevenueForFinancials` now reads from `ga4FinancialTotalsSource.revenue`.
6. `financialConversions` now reads from `ga4FinancialTotalsSource.conversions`.
7. Imported revenue, spend, Pipeline Proxy, Campaign Breakdown, Landing Pages, Conversion Events, KPI/Benchmark wiring, report wiring, API routes, scheduler behavior, alerts, and notifications were not changed.

Files changed:

- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-ui-regression.test.ts`
- `server/revenue-additivity.test.ts`

Regression coverage completed:

- Summary cards still use the coherent selected-campaign hierarchy of daily rows, then to-date totals, then breakdown totals.
- `ga4RevenueForFinancials` no longer reads directly from `breakdownTotals.revenue`.
- `financialConversions` no longer reads directly from `breakdownTotals.conversions`.
- financial GA4 revenue uses the most complete scoped native GA4 source across `/ga4-to-date`, daily totals, and breakdown totals.
- CPA uses the same financial conversion source as the selected financial revenue source.
- stale test expectations that forced an unconditional to-date-first rule were updated to prevent GA4 Revenue from understating larger visible native GA4 totals.

Validation completed:

- `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts`
  - result: passed, 2 files, 42 tests
- `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-filter.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
  - result: passed, 9 files, 178 tests
- `npm run check`
  - result: passed

Pass criteria:

- Total Revenue is `selected scoped GA4 native financial revenue + imported revenue-to-date`.
- CPA is `spend-to-date / conversions from the same selected GA4 financial source`.
- Summary cards keep their existing coherent source behavior.
- Pipeline Proxy remains excluded.
- no response shape changes.
- no source lifecycle behavior changes.

Production-like numeric parity:

- not rerun in this local Commit 1 pass.
- prior production-like Campaign DeepDive parity remains documented in broader GA4 readiness history.
- future deployed parity checks are validation gates, not known local code blockers.

### Commit 2: Document and validate the fixed Overview status

Status: completed in this documentation update.

Fix scope:

Update only this file after Commit 1 passed validation.

Implementation completed:

1. Moved Commit 1 from required to completed.
2. Recorded files changed.
3. Recorded exact tests run.
4. Recorded that production-like numeric parity was not rerun in this local pass.
5. Changed `Durable Future Answer` to the post-fix production-ready answer.
6. Kept external caveats separate from code readiness.

Files changed:

- `GA4/OVERVIEW_PRODUCTION_READINESS.md`

Pass criteria:

- future chats can answer Overview readiness by reading this file without reopening unrelated GA4 sections.
- the answer separates proven local readiness from deployed/provider validation.
### Commit 3: Real source-family lifecycle validation

Status: validation gate, not a confirmed code bug.

Fix scope:

Validate each real source family only when deployed/provider credentials and test data are available.

Revenue source families:

- Shopify
- HubSpot
- Salesforce
- Google Sheets
- CSV
- legacy Manual revenue, if present

Spend source families:

- LinkedIn Ads
- Meta Ads
- Google Ads
- Google Sheets
- CSV
- legacy Manual spend, if present

Validation strategy for each source family:

1. Add or import the source with known test data.
2. Confirm it appears in `Total Revenue -> Sources` or `Total Spend -> Sources`.
3. Confirm the total card equals active source rows plus native GA4 revenue where applicable.
4. Confirm downstream values update: Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Insights, and reports generated after the change.
5. Edit the source.
6. Confirm the old amount is replaced, not duplicated.
7. Confirm the source count stays correct.
8. Delete the source.
9. Confirm only that source contribution is removed.
10. Confirm unrelated source rows and totals remain unchanged.
11. For refreshable sources, run or wait for scheduler refresh.
12. Confirm refresh updates the same source ID instead of creating a duplicate.

Pass criteria:

- add, edit, delete, source modal display, totals, and downstream recompute work for the source family
- source modal provenance reconciles to the relevant total card
- edit and scheduler paths preserve stable source identity
- delete affects only the verified source ID
- refreshable sources update in place and do not append duplicates

### Commit 4: Production data inventory for source damage

Status: validation gate, not a confirmed code bug.

Fix scope:

Perform read-only production or staging inventory before writing any cleanup.

Validation strategy:

1. Query for `revenue_records` rows whose `revenue_source_id` has no matching active `revenue_sources.id`.
2. Query for `spend_records` rows whose `spend_source_id` has no matching active `spend_sources.id`.
3. Group results by campaign, source type, platform context, and source ID.
4. Check for duplicate active source definitions with identical campaign/source/platform/mapping signatures.
5. For suspicious rows, inspect exact IDs and source metadata before deciding whether they are valid legacy data or damaged data.
6. Do not delete or rewrite anything during inventory.

Pass criteria:

- either no orphan or duplicate source records are found, or exact affected IDs are documented
- any cleanup plan has a proven source/campaign/record boundary before a migration is written
- CRM, ecommerce, CSV, Google Sheets, Manual, and ad-platform rows are not touched unless individually proven damaged

### Commit 5: Landing Pages exact-key conversion supplement

Status: completed and locally validated.

Fix scope:

Correct only the GA4 Landing Pages service response in `server/analytics.ts` for the case where primary landing-page rows have traffic but no conversion/revenue values while the same selected campaign scope has compatible `pageLocation` UTM rows with row-level conversion values.

Confirmed root cause:

- `/api/campaigns/:id/ga4-landing-pages` calls `getLandingPagesReport`.
- The service queried `landingPagePlusQueryString + sessionSource + sessionMedium` first.
- The existing `pageLocation` UTM fallback ran only when the primary result was empty.
- For fresh or Measurement Protocol-style GA4 data, the primary result can contain landing-page traffic rows while conversions are exposed only through same-scope `pageLocation` UTM rows.
- The service returned the traffic rows as-is, so visible `Conversions` and `Conv. rate` could show zero even when a row-level `pageLocation` match existed.

Implementation completed:

1. Primary landing-page traffic rows remain the base table.
2. If those rows already contain conversion/revenue values, behavior is unchanged.
3. If primary rows contain traffic but no conversion/revenue values, the service queries the existing same-scope `pageLocation` UTM fallback.
4. Fallback conversion/revenue values are merged only when `Landing page + Source + Medium` match exactly.
5. Unmatched fallback rows are not added to the table and campaign-level conversions are not allocated into page rows.
6. Frontend table rendering, imported revenue behavior, Summary cards, Campaign Breakdown, Conversion Events, KPI/Benchmark wiring, reports, scheduler behavior, alerts, and notifications were not changed.

Validation completed:

- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
  - result: passed, 2 files, 41 tests
- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts`
  - result: passed, 5 files, 77 tests
- `npm run check`
  - result: passed

Pass criteria:

- Landing Pages can recover exact row-level conversions when GA4 exposes them through same-scope `pageLocation` UTM rows.
- Landing Pages still leaves row conversions at zero when no exact row-level match exists.
- no campaign-level conversion allocation is introduced.
- no response shape changes.
- no source lifecycle, scheduler, alert, notification, KPI, Benchmark, Ad Comparison, Insights, or Reports behavior changes.

## Section Production-Readiness Map

### 1. Campaign, Client, Property, And Source Scope

Status: production-ready locally for current code scope.

User-facing role:

- ensure Overview represents one app campaign's selected GA4 source scope, not a client-wide or property-wide rollup

Inputs:

- authenticated user
- selected client/campaign
- campaign's saved GA4 property ID
- campaign's saved GA4 campaign filter
- selected Overview date range where applicable

Current logic:

- Overview routes verify campaign access before returning campaign data.
- GA4 API calls use the selected GA4 property.
- GA4 campaign filters are applied to campaign dimensions first.
- `pageLocation` `utm_campaign` fallback is used only when primary scoped results are empty.
- setup stores GA4 scope; Overview renders from current query-backed values for that scope.

Proven locally:

- `/ga4-daily`, `/ga4-to-date`, `/ga4-breakdown`, `/ga4-landing-pages`, and `/ga4-conversion-events` are campaign-access guarded
- live GA4 fallback remains selected-campaign scoped
- numeric live GA4 properties are not treated as deterministic Yesop simulation paths
- current regression coverage guards the selected Overview date range for Landing Pages and Conversion Events

Partially reviewed:

- post-setup GA4 campaign rescope is intentionally not a current UI workflow

Not locally verifiable:

- real OAuth token health
- live GA4 property permissions
- live GA4 Data API consistency for a deployed account

Future-platform template rule:

- every platform Overview must prove the exact account/property/customer/source scope before rendering metrics
- fallback discovery may broaden dimensions only inside the same selected platform source and campaign scope
- no platform Overview may silently roll up unrelated account or property data

### 2. Summary Cards

Status: production-ready locally for current code scope.

User-facing role:

- show selected-campaign GA4-native traffic, user, conversion, engagement, and conversion-rate values

Inputs:

- `/ga4-daily`
- `/ga4-to-date`
- `/ga4-breakdown`
- selected GA4 property
- saved GA4 campaign filter

Current logic:

- Summary cards use one coherent selected-campaign source.
- Persisted selected-campaign daily facts are preferred when present.
- If daily facts are unavailable, Summary cards fall back to selected-campaign to-date totals.
- If to-date totals are unavailable, Summary cards fall back to selected-campaign breakdown totals.
- The cards avoid taking per-metric maximum values across incompatible sources.
- A stable skeleton is shown while breakdown-backed fallback totals are still loading.

Proven locally:

- regression coverage guards coherent Summary source selection
- regression coverage guards the live `pageLocation` fallback path
- regression coverage guards that Landing Pages and Conversion Events use selected Overview date range

Partially reviewed:

- exact real-property numeric parity depends on live GA4 processing and tagging quality

Not locally verifiable:

- GA4 delayed processing behavior after Measurement Protocol or newly tagged traffic
- whether a user's real GA4 conversion events are configured as expected

Future-platform template rule:

- each platform must define its own Summary-card source hierarchy
- do not combine incompatible date windows by taking maximum values
- if a fallback is needed for fresh attribution gaps, it must remain inside the selected platform account/source/campaign scope

### 3. Financial Cards

Status: production-ready locally for current GA4 code scope.

User-facing role:

- show confirmed financial performance for the selected GA4 campaign

Inputs:

- selected scoped GA4 native financial revenue
- imported revenue-to-date from active revenue sources
- spend-to-date from active spend sources
- conversions from the same selected GA4 financial source for CPA

Current logic:

- `Total Revenue = selected scoped GA4 native financial revenue + imported campaign revenue-to-date`
- `Total Spend = active campaign spend-source total`
- `Profit = Total Revenue - Total Spend`
- `ROAS = Total Revenue / Total Spend`
- `ROI = (Total Revenue - Total Spend) / Total Spend`
- `CPA = Total Spend / conversions from the same selected GA4 financial source`
- Pipeline Proxy is excluded

Fixed defect:

- `ga4RevenueForFinancials` now reads from `ga4FinancialTotalsSource.revenue`, not directly from `breakdownTotals.revenue`.
- `financialConversions` now reads from `ga4FinancialTotalsSource.conversions`, not directly from `breakdownTotals.conversions`.
- `ga4FinancialTotalsSource` selects one source object across `ga4ToDateOverviewTotals`, `dailySummedTotals`, and `ga4BreakdownTotals` by largest scoped native GA4 revenue.
- `breakdownTotals` remains the Summary-card source object and is no longer the direct financial source of truth.

Proven locally:

- imported revenue is additive with GA4 native revenue
- Pipeline Proxy is excluded from confirmed revenue calculations
- spend comes from active spend sources
- source-backed totals use active source joins in storage
- financial GA4 native revenue and CPA conversions use the same selected scoped financial source
- Summary-card source behavior remains unchanged

Partially reviewed:

- individual provider add/edit/delete/refresh lifecycles are not fully certified source family by source family

Not locally verifiable:

- real provider refresh values
- deployed scheduler refresh timing
- production duplicate or orphan source record inventory beyond previously documented GA4 synthetic rows

Future-platform template rule:

- financial totals must name their source set
- every platform must define whether native platform revenue exists, whether spend is native or imported, and which conversions are valid for CPA
- financial cards must not reuse Summary-card values unless the Summary and financial windows are proven identical
### 4. Pipeline Proxy

Status: production-ready locally for current code scope.

User-facing role:

- show CRM open-pipeline early-signal value separately from confirmed revenue

Inputs:

- active HubSpot or Salesforce revenue source configuration
- saved provider campaign-value mapping
- selected pipeline stage
- live or saved proxy amount metadata

Current logic:

- Pipeline Proxy appears from active CRM source configuration, not only from endpoint success.
- Salesforce and HubSpot proxy values can aggregate when both are configured for the same GA4 campaign.
- only positive provider contributions count as contributing sources.
- the card is display-only.
- source management remains under Total Revenue.
- deleting or deactivating the associated CRM source removes the Pipeline Proxy card.
- Pipeline Proxy does not feed confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, or Reports.

Proven locally:

- the card is derived separately from `financialRevenue`
- source modal behavior is read-only for Pipeline Proxy provenance

Partially reviewed:

- provider-specific live refresh depends on CRM APIs and saved source metadata

Not locally verifiable:

- live HubSpot or Salesforce API values without deployed/provider credentials

Future-platform template rule:

- early-signal pipeline or lead values must be visually and computationally separate from confirmed revenue
- no platform may include pipeline proxy values in confirmed financial metrics without an explicit product redesign

### 5. Campaign Breakdown

Status: production-ready locally for current code scope.

User-facing role:

- show selected GA4 campaign-scope performance grouped by UTM campaign

Inputs:

- `/ga4-breakdown`
- selected GA4 property
- saved GA4 campaign filter
- exact campaign-matched imported revenue mappings where present

Current logic:

- rows are scoped to the selected GA4 campaign values.
- the visible revenue column label is `Revenue`, not `GA4 Revenue`, because exact campaign-matched imported revenue may be included.
- imported revenue is added only when source campaign mappings match GA4 campaign rows exactly.
- imported revenue is not proportionally allocated.
- users in row-level breakdowns are directional and are not expected to sum exactly to the top Users card.

Proven locally:

- exact campaign-matched imported revenue behavior is regression-covered
- selected campaign filters are parsed and applied
- report label work confirms `Revenue` is the correct executive-facing label when the value can include imported revenue

Partially reviewed:

- visual parity of all report renderers is covered by Reports readiness, not this file

Not locally verifiable:

- live GA4 row availability for every real property/tagging pattern

Future-platform template rule:

- a platform breakdown may include external revenue only when exact row-level matching keys exist
- never allocate campaign-level imported revenue into row-level breakdowns by proportion unless the product explicitly defines and labels allocation

### 6. Landing Pages

Status: production-ready locally for current code scope.

User-facing role:

- show landing-page traffic and conversion context for the selected GA4 campaign scope

Inputs:

- `/ga4-landing-pages`
- selected GA4 property
- saved GA4 campaign filter
- selected Overview date range

Current logic:

- rows use the selected Overview date range.
- revenue is intentionally not shown.
- imported campaign revenue is not allocated into landing-page rows.
- source/medium can be derived from tagged `pageLocation` fallback rows when attribution dimensions are empty.
- when primary landing-page rows have traffic but no conversion/revenue values, same-scope `pageLocation` UTM rows may supplement conversions only by exact `Landing page + Source + Medium` match.
- unmatched fallback rows are not added and campaign-level conversions are not allocated into landing-page rows.
- row-level Users values are directional and are not expected to reconcile exactly to the top Users card.

Proven locally:

- regression coverage guards selected date-range query usage
- regression coverage guards absence of revenue columns
- regression coverage guards exact-key `pageLocation` conversion supplementation without campaign-level allocation
- GA4 service code keeps fallback scoped to selected campaign values

Partially reviewed:

- live row quality depends on tagging and GA4 processing

Not locally verifiable:

- exact live landing-page values without real GA4 property validation

Future-platform template rule:

- landing-page or destination-page tables must not receive campaign-level imported revenue unless exact page-level matching identifiers exist

### 7. Conversion Events

Status: production-ready locally for current code scope.

User-facing role:

- show event-level conversion volume context for the selected GA4 campaign scope

Inputs:

- `/ga4-conversion-events`
- selected GA4 property
- saved GA4 campaign filter
- selected Overview date range

Current logic:

- rows use the selected Overview date range.
- revenue is intentionally not shown.
- imported campaign revenue is not allocated into event rows.
- row-level Users values are directional and are not expected to reconcile exactly to the top Users card.

Proven locally:

- regression coverage guards selected date-range query usage
- regression coverage guards absence of revenue columns
- GA4 service code keeps fallback scoped to selected campaign values

Partially reviewed:

- live row quality depends on event naming and GA4 key-event configuration

Not locally verifiable:

- exact live event values without real GA4 property validation

Future-platform template rule:

- event/action tables must define whether values are event counts, conversions, users, revenue, or attribution outputs
- do not attach financial values to event rows without exact event-level financial identifiers

### 8. Source Modals And Source Lifecycle

Status: production-ready locally for current Overview source-modal code scope; provider/source-family lifecycle checks remain external validation gates.

User-facing role:

- show financial provenance and allow users to manage active revenue/spend sources

Inputs:

- `/revenue-sources`
- `/revenue-breakdown`
- `/spend-sources`
- `/spend-breakdown`
- source edit/delete handlers

Current logic:

- Total Revenue and Total Spend cards open source-provenance modals.
- source modals are scrollable.
- source delete handlers invalidate and refetch relevant totals and breakdowns.
- backend delete routes verify campaign access and source ownership before mutation.
- storage totals join records to active source definitions.

Proven locally:

- source modals have vertical scrolling behavior
- source delete routes verify campaign/source ownership
- active-source joins protect totals from inactive/orphan source definitions
- no synthetic GA4 native revenue records should be written into imported revenue records by `/ga4-daily`

Provider/deployed validation gates:

- full add/edit/delete/display/totals/scheduler lifecycle should still be validated for every source family with real provider data
- source modal fallback behavior when breakdown rows are absent is locally understood; source-family certification remains a provider validation gate

Not locally verifiable:

- provider refresh behavior without credentials
- production duplicate/orphan source inventory

Future-platform template rule:

- every source family copied to a new platform needs lifecycle validation: add, edit, delete, refresh, display, totals, downstream recompute, and cleanup boundary

### 9. Refresh And Scheduler Paths

Status: production-ready locally for current Overview refresh code scope; deployed scheduler/provider checks remain external validation gates.

User-facing role:

- keep Overview values fresh without silently broadening scope or writing misleading values

Inputs:

- GA4 daily scheduler
- external source auto-refresh scheduler
- `/ga4-daily` on-demand backfill
- frontend query refetch intervals

Current logic:

- `/ga4-daily` can read persisted rows and backfill native GA4 daily facts when needed.
- daily refresh uses saved GA4 campaign filters.
- external source refresh can trigger downstream KPI/Benchmark and alert checks after source updates.
- Overview page queries refetch while the page is open.

Proven locally:

- scheduler code uses saved GA4 campaign filter parsing
- `/ga4-daily` no longer writes synthetic imported revenue records in current regression coverage
- focused regression tests cover daily fallback and no synthetic revenue write

Provider/deployed validation gates:

- scheduler behavior is traced at code level, but deployed-run evidence remains environment validation
- source-family refresh identity should still be certified for each real provider

Not locally verifiable:

- deployed scheduler execution
- provider API availability
- real GA4 delayed processing

Future-platform template rule:

- schedulers must fail closed when campaign/source ownership cannot be verified
- refreshes must update stable source IDs and must not append duplicate source definitions or records

### 10. Downstream Consumers

Status: production-ready locally for current Overview-originated values, with deployed report/email caveats owned by Reports readiness.

User-facing role:

- keep values consistent when Overview financial and GA4 metrics feed other GA4 sections

Consumers:

- KPIs
- Benchmarks
- Ad Comparison
- Insights
- browser-generated report output
- scheduled/server GA4 report PDF output where it renders GA4 Overview-originated Total Revenue

Current logic:

- many downstream UI paths consume `financialRevenue`, `financialConversions`, or `ga4RevenueForFinancials`.
- revenue-availability gates for KPIs, Benchmarks, and Insights use `ga4HasRevenueMetric`, which is derived from the same selected GA4 financial source used by Total Revenue.
- browser-generated and scheduled/server GA4 report output use the selected scoped GA4 financial source for Total Revenue and CPA conversions.
- Commit 1 corrected those Overview-originated values without reopening independent KPI, Benchmark, Ad Comparison, Insights, or Reports readiness beyond this value-propagation path.

Proven locally:

- KPIs read `financialRevenue` for Revenue, ROAS, and ROI live values and creation prefill; the availability gate now follows `ga4HasRevenueMetric`.
- Benchmarks read `financialRevenue` for revenue/financial current values; the availability gate now follows `ga4HasRevenueMetric`.
- Ad Comparison receives `totalRevenue={financialRevenue}` and `ga4RevenueTotal={ga4RevenueForFinancials}`; its browser and scheduled report output use those same totals for all-source revenue and source provenance.
- Insights executive cards, data summary, and financial integrity checks read `financialRevenue`; the availability gate now follows `ga4HasRevenueMetric`.
- Browser-generated and scheduled/server GA4 Reports read the selected scoped GA4 financial source for Total Revenue and CPA conversions.
- Campaign DeepDive aggregate/report parity remains a separate aggregate route concern and was not broadened by this Overview propagation fix.
- Reports readiness separately covers scheduled/server report output labels and delivery caveats
- KPI and Benchmark readiness is separate and should not be reopened unless the corrected Overview financial value changes their input contract

Partially reviewed:

- deployed/manual visual parity can be checked separately when needed

Not locally verifiable:

- deployed scheduled PDF/email values without deployed report validation

Future-platform template rule:

- downstream consumers must read the same authoritative platform Overview values or explicitly document a different window/source
- no platform may let live UI and report output diverge in executive-facing financial meaning

## Completed Overview-Related Hardening History

The following Overview-related work is already complete and should not be reopened unless relevant code changes or validation fails:

1. Removed synthetic imported GA4 revenue writes from `/api/campaigns/:id/ga4-daily` while preserving native `ga4_daily_metrics` facts.
2. Cleaned up the proven orphan `revenue_records` rows with `revenue_source_id = 'ga4_daily_metrics'`.
3. Fixed real-property GA4 campaign picker discovery through manual UTM campaign dimensions and `pageLocation` `utm_campaign`.
4. Fixed live real-property Overview zero-metric paths by using selected-campaign `pageLocation` fallback only when primary scoped results are empty.
5. Kept Summary cards on a coherent selected-campaign source instead of per-metric maximum values.
6. Kept Landing Pages and Conversion Events on the selected Overview date range.
7. Kept imported revenue out of Landing Pages and Conversion Events.
8. Corrected Campaign Breakdown revenue labeling where exact campaign-matched imported revenue can be included.
9. Kept Pipeline Proxy separate from confirmed revenue and performance calculations.
10. Added exact-key Landing Pages conversion supplementation from same-scope `pageLocation` UTM rows without allocating campaign-level conversions into page rows.

## Validation Evidence

Latest local validation run for the completed Landing Pages exact-key conversion supplement:

- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
- result: passed, 2 files, 41 tests
- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts`
- result: passed, 5 files, 77 tests
- command: `npm run check`
- result: passed

What the validation proves:

- Landing Pages uses exact `Landing page + Source + Medium` matching when supplementing missing conversions from same-scope `pageLocation` UTM rows
- Landing Pages does not add unmatched fallback rows or allocate campaign-level conversions into page rows
- existing Overview UI regression guards still pass

Latest local validation run for the completed Overview financial-source fix:

- command: `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts`
- result: passed, 2 files, 42 tests
- command: `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-filter.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
- result: passed, 9 files, 178 tests
- command: `npm run check`
- result: passed

What the validation proves:

- the confirmed financial source defect is fixed at the local code/regression level
- Summary cards still use the coherent selected-campaign source hierarchy
- financial GA4 revenue and CPA conversions now use the same selected scoped financial source
- additive native GA4 revenue plus imported revenue behavior remains covered
- current TypeScript compiles
- campaign/property scoping guards and existing source-safety guards remain intact
- no synthetic GA4 imported revenue write is expected from `/ga4-daily`

What the validation does not prove:

- real GA4 provider values match a deployed property
- deployed scheduler execution works
- every provider source-family lifecycle is production-ready
- production data has no duplicate or orphan source records outside previously inventoried rows
- deployed report/email delivery evidence, which remains Reports readiness scope unless the Overview values inside a report are wrong

## Future Platform Template

### Platform Identity Gate

Before a new platform Overview can be called production-ready, document:

- client boundary
- campaign boundary
- platform account/property/customer boundary
- selected platform campaign/ad group/source boundary
- whether post-setup rescope exists
- which API routes enforce the boundary
- which storage calls enforce the boundary
- which scheduler jobs enforce the boundary

Required answer:

`This platform's Overview data is scoped by [client], [campaign], [platform source/account/property/customer], and [selected source campaign/ad group/etc]. It does not include unrelated platform data.`

### Summary Metric Gate

Before copying GA4 Summary-card behavior, document:

- source endpoint for each Summary metric
- date window for each metric
- fallback order
- whether fallbacks stay inside selected platform scope
- whether values are native, imported, or derived
- whether users/people metrics are deduplicated or row-summed

Required answer:

`Summary cards use [source hierarchy] for [window]. They do not combine incompatible source windows by maxing values across endpoints.`

### Financial Gate

Before copying GA4 Financial-card behavior, document:

- native platform revenue source, if any
- imported revenue sources
- spend sources
- conversion source for CPA
- date window for every financial input
- whether early-signal/pipeline values exist
- whether early-signal values are excluded from confirmed financials
- source modal provenance and source lifecycle behavior

Required answer:

`Spend comes from [source]. Revenue comes from [source set]. Profit, ROAS, ROI, and CPA derive from those same values. The UI names those sources and does not imply unavailable sources are connected.`

### Table Gate

Before copying GA4 table behavior, document:

- row grain
- row scope
- date range
- whether revenue appears
- whether imported financial values can be exactly matched to row keys
- whether row totals are expected to reconcile to top cards

Required answer:

`Rows represent [grain] inside [scope] for [window]. Imported revenue is [excluded / included only by exact row-level match]. Row totals [are / are not] expected to reconcile to top cards because [reason].`

### Refresh Gate

Before copying GA4 refresh behavior, document:

- on-demand fetch path
- persisted daily/history path
- scheduler path
- external source refresh path
- stable source ID behavior
- duplicate prevention
- failure behavior when campaign/source ownership cannot be verified

Required answer:

`Refresh updates the same scoped source/history records and fails closed when ownership cannot be proven. It does not create duplicate active sources or broaden scope.`

### Downstream Consumer Gate

Before copying GA4 downstream behavior, document:

- which Overview values feed KPIs
- which Overview values feed Benchmarks
- which Overview values feed Ad Comparison
- which Overview values feed Insights
- which Overview values feed Reports
- whether each consumer uses the same source/window or intentionally different source/window

Required answer:

`Downstream consumers read [authoritative value set]. Any intentional difference in window/source is documented and labeled.`

### Validation Gate

Before calling a new platform Overview production-ready, confirm:

- focused unit/static regression coverage passes
- TypeScript check passes
- local code trace proves ownership and source scoping
- at least one production-like or deployed validation proves real provider values when provider access is required
- source-family lifecycle is validated where financial sources exist
- existing-data inventory is complete if prior bugs may have persisted damaged data

## Future Platform Readiness Checklist

A future platform Overview is not production-ready until every item below is answered with platform-specific evidence:

- platform identity and scoping are proven
- Summary-card source hierarchy is documented and regression-covered
- financial source set is documented and regression-covered
- early-signal values are separated from confirmed financials
- source modals reconcile to card totals
- source add/edit/delete/refresh lifecycle is validated per source family
- scheduler and refresh paths fail closed on missing ownership
- row-level tables do not allocate financial values without exact row keys
- downstream consumers preserve the same executive-facing meaning
- report output uses the same labeled values as live UI
- validation commands and results are recorded
- deployed/provider caveats are separated from local code readiness

## Stable Response For Future Chats

Answer:

`GA4 Overview is production-ready for the current GA4 code scope. The canonical reference is GA4/OVERVIEW_PRODUCTION_READINESS.md. Remaining caveats are deployed/provider validation gates: live GA4 API processing, deployed scheduler execution, provider source refreshes, and production data inventory where applicable.`

This answer should stay the same unless one of these occurs:

- relevant Overview, financial-source, scheduler, report, KPI, Benchmark, or shared aggregate code changes
- validation fails
- source requirements change
- deployed evidence contradicts this document
- a new platform/source is being assessed instead of the existing GA4 implementation
- production data inventory proves damaged source records outside the already documented cleanup boundary

Do not answer future Overview readiness questions by reopening unrelated GA4 KPIs, Benchmarks, Ad Comparison, Reports, or Insights unless the Overview code path directly depends on a narrow value from those sections.