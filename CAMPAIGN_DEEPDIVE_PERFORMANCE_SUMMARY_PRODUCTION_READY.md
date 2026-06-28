# Campaign DeepDive Performance Summary Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

Track the outstanding work required to make the Campaign DeepDive `Performance Summary` section production ready.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped data sources are attached.
- `Performance Summary` aggregates only the metrics currently available from those connected sources.
- If only GA4 is connected, Performance Summary uses only GA4-capable metrics.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- As main Connected Platforms such as GA4, LinkedIn, Meta, Google Ads, Google Sheets, Custom Integration, and future integrations are connected, their available metrics must be automatically included in the campaign-level aggregate without double-counting.
- Automatic inclusion means every main Connected Platform must provide its campaign-scoped source identity, capabilities, included metrics, excluded metric reasons, freshness, current totals, and snapshot inputs through the shared Performance Summary aggregate contract. The aggregate contract accepts generic main-platform source breakdowns so future sources such as Google Ads, TikTok, Instagram, and other standalone platforms can be aggregated without tab-specific rewiring.
- Campaign DeepDive subsections should fetch and aggregate main metrics from all main sources shown in the campaign `Connected Platforms` section. They should not require users to create duplicate revenue/spend inputs inside Campaign DeepDive for child systems already configured within a parent platform.
- The section should provide a marketing-executive-ready campaign-wide view, not a platform-specific drilldown.

## Required Architecture

Preserve the documented split in `ARCHITECTURE_USER_JOURNEY.md`:

- `Connected Platforms` = source-level campaign inputs.
- `View Detailed Analytics` = platform-specific drilldown.
- `Campaign DeepDive` = campaign-wide cross-platform analysis.
- `Performance Summary` = aggregated campaign-level executive summary based on connected-source data.

Do not turn Performance Summary into another platform-specific page.
Do not duplicate aggregation logic across tabs.
Do not invent unavailable metrics for sources that do not provide them.

## Current Root Cause

`client/src/pages/campaign-performance.tsx` currently performs page-local aggregation from separate source queries.

That implementation was not driven by the same connected-source registry required by the campaign `Connected Platforms` section. As a result:

- source inclusion is hard-coded instead of capability-driven
- some totals include Meta and GA4 while labels still mention only LinkedIn or Custom Integration
- the Data Sources block only lists LinkedIn Ads and Custom Integration
- Before Commit 5, Insights compared mostly LinkedIn vs Custom Integration instead of all connected eligible sources
- snapshot/history comparisons can drift because frontend aggregation, scheduler aggregation, legacy snapshot routes, Executive Summary, and `outcome-totals` are separate aggregation paths

The issue is an aggregation contract problem, not a single-card display bug.

## Existing Relevant Paths

- `client/src/pages/campaign-performance.tsx`
  - Current Performance Summary page and tab UI.
  - Performs local aggregation and tab-specific calculations.

- `client/src/pages/campaign-detail.tsx`
  - Campaign Overview and Connected Platforms section.
  - Already consumes `/api/campaigns/:id/outcome-totals` for KPI/Benchmark source-aware values.

- `client/src/pages/platform-comparison.tsx`
  - Uses `/api/campaigns/:id/outcome-totals` as a more unified source for cross-platform comparison.

- `server/routes-oauth.ts`
  - Contains `/api/campaigns/:id/outcome-totals`.
  - Contains `/api/campaigns/:id/executive-summary`.
  - Contains legacy/manual snapshot routes.

- `server/scheduler.ts`
  - Contains `aggregateCampaignMetrics` and `recordCampaignMetrics`.
  - Scheduler snapshots must align with the same aggregate used by Performance Summary.

- `server/storage.ts`
  - Storage-layer access for campaign sources, GA4, LinkedIn, Meta, Google Ads, revenue, spend, Custom Integration, and snapshots.

## Production-Ready Target Contract

Performance Summary should consume one campaign-level aggregate contract.

The contract should include:

- campaign ID and date range
- connected sources included in the aggregate
- connected sources excluded from a metric, with reason
- source freshness metadata
- normalized source capabilities
- aggregate current totals
- per-source breakdown
- KPI health
- Benchmark health
- historical comparison values derived from the same aggregate model
- insight inputs derived from the same aggregate model

Preferred approach:

- Reuse or extend `/api/campaigns/:id/outcome-totals` if it can safely support the full Performance Summary contract.
- If that would overload `outcome-totals`, add a narrow `/api/campaigns/:id/performance-summary` endpoint in `server/routes-oauth.ts` that composes existing storage/service helpers.
- Keep persistence reads in `server/storage.ts`.
- Keep scheduler alignment in `server/scheduler.ts`.

## Source Capability Rules

### GA4

Available:

- users
- sessions
- pageviews or screen page views
- conversions
- engagement rate or bounce-rate-derived engagement where already supported
- GA4 revenue where available and campaign-scoped

Not available:

- ad clicks
- ad impressions
- ad spend
- leads unless explicitly mapped as GA4 conversions

### LinkedIn

Available when connected and imported:

- impressions
- clicks
- engagements where imported
- spend
- conversions
- leads
- attributed revenue only when a LinkedIn revenue context/source is configured

Not available:

- web sessions
- users
- pageviews

### Meta

Available when connected and synced:

- impressions
- reach where available
- clicks
- spend
- conversions
- attributed revenue only when Meta revenue context/source is configured

Not available:

- web sessions
- users
- pageviews

### Google Ads

Deferred until the Google Ads platform is refined.

Expected available metrics when connected and synced:

- impressions
- clicks
- spend
- conversions

Google Ads does not block the current GA4-focused Performance Summary work. When Google Ads is refined, its definition of done must include automatic participation in the Performance Summary aggregate contract, scheduler snapshots, source capabilities, and regression coverage. Do not claim full all-platform Performance Summary readiness until that path is traced and implemented.

### Google Sheets Spend Sources

Available:

- campaign-scoped spend totals
- currency where available
- source provenance

Not available by default:

- impressions
- clicks
- conversions
- sessions
- users

Only include other metrics if the source mapping explicitly supports them and the data path is traced.

### Google Sheets Revenue Sources

Available:

- campaign-scoped revenue totals
- revenue classification where available
- source provenance

Not available by default:

- impressions
- clicks
- spend
- sessions
- users

### Custom Integration

Available:

- only the metrics present in the uploaded/webhook data and persisted for the campaign

Important:

- Custom Integration may contain both ad-like and web-like metrics.
- Do not double-count Custom Integration web metrics when GA4 is the primary web analytics source unless the source is explicitly non-overlapping.

## Aggregation Rules

- Aggregate only sources connected to the current campaign.
- Aggregate only metrics that are available from each connected source.
- Preserve unavailable as unavailable, not zero.
- Use zero only when a connected source supports the metric and the actual value is zero.
- Paid media metrics such as impressions, clicks, spend, and paid conversions can be additive across non-overlapping paid platforms.
- GA4 should be treated as the primary web analytics source when connected.
- Custom Integration web metrics should be fallback web analytics only when GA4 is not connected, unless explicitly configured as non-overlapping.
- Spend should prefer canonical campaign spend sources when configured; otherwise fall back to platform-reported spend.
- Revenue should preserve onsite/offsite classification and avoid double-counting GA4 revenue with external revenue sources.
- ROAS, ROI, CPA, CPC, CTR, and CVR should be derived only when their numerator and denominator are available and valid.
- Do not use Pipeline Proxy data for Performance Summary totals.

## Tab Requirements

### Overview

Current behavior:

- `Campaign Health` summarizes campaign-level KPIs and Benchmarks that are above target or on track.
- `Top Priority Action` flags the least-performing campaign-level KPI first; if no KPI is below target, it falls back to the least-performing Benchmark.
- `Top Priority Action` metric values must be formatted for display, for example `$450,000.00` and `80,000`.
- `Total Impressions`, `Total Sessions`, `Total Conversions`, and `Total Spend` are populated from the campaign's connected sources in `Connected Platforms`.
- Each card only uses metrics that the connected source actually provides. GA4 can provide sessions and conversions, but not impressions.
- If a connected source does not provide a metric, the card must clearly show that the metric is unavailable instead of inventing a value.

Required regression coverage:

- GA4-only campaign renders GA4 metrics only.
- LinkedIn plus Meta campaign aggregates paid media totals and labels both sources.
- Campaign with canonical spend source uses canonical spend rather than double-counting platform spend.

### Campaign Health

Outstanding fixes:

- Keep KPI and Benchmark health from campaign-level KPI/Benchmark records.
- Replace hard-coded Data Sources block with connected source list from the aggregate contract.
- Data Sources must list only main Connected Platforms from the implemented aggregate source registry. Today that includes Google Analytics, LinkedIn, Meta, and Custom Integration when connected. Future standalone platforms such as Google Ads or Google Sheets should be added only after their campaign-scoped aggregate paths are traced and implemented. GA4 revenue/spend child imports such as Salesforce, HubSpot, Shopify, CSV, and Google Sheets financial imports can feed financial totals through their parent platform/campaign financial path but must not appear as separate main platforms in this block.
- Show source freshness and unavailable-metric reasons where relevant.
- Ensure KPI/Benchmark current values remain sourced from their existing campaign-level source-aware paths and do not regress.

Required regression coverage:

- Data Sources lists GA4, LinkedIn, Meta, and Custom Integration when they are connected as main Connected Platforms in the current aggregate contract.
- Data Sources does not list GA4 financial child imports such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets revenue/spend imports as separate main platforms.
- GA4-only campaign does not show LinkedIn or Custom Integration as data sources.
- KPI/Benchmark status still renders when no platform ad metrics are available.

### What's Changed

Outstanding fixes:

- Ensure current values and historical snapshots use the same aggregation helper/contract.
- Align scheduler snapshots with Performance Summary aggregation.
- Trace legacy/manual snapshot route reachability before changing or removing it.
- Prevent comparisons between incompatible aggregate versions where source inclusion changed.

Reviewed current behavior:

- Delta cards are populated by `client/src/pages/campaign-performance.tsx` from `/api/campaigns/:id/snapshots/comparison?type=...`.
- The selected range maps to comparison types: `24h -> yesterday`, `7d -> last_week`, and `30d -> last_month`.
- Current delta-card values prefer live `outcomeTotals.performanceSummary.totals` and fall back to local page totals only when no aggregate metric is available.
- Previous delta-card values prefer `previous.metrics.performanceSummary.totals`; if the historical snapshot does not have the same `performance_summary_aggregate_v1` version as the current aggregate, the UI shows no historical comparison instead of comparing incompatible data.
- Snapshot creation through scheduler/platform-sync/manual snapshot routes uses `aggregateCampaignMetrics`, which embeds `metrics.performanceSummary` in new snapshots.
- Trend charts are still populated from `/api/campaigns/:id/snapshots?period=...` using legacy snapshot columns only: impressions, clicks, conversions, and spend. They do not yet render sessions, users, revenue, or aggregate source capability metadata.
- Current logic is safe for avoiding incompatible delta-card comparisons, but the tab is not fully aggregate-model complete until trend charts and snapshot read routes are aligned with the same aggregate display model and access-guard expectations.

Production-ready task bundle:

- Update the `What's Changed` delta cards to compare current aggregate values only against a real previous compatible aggregate snapshot.
- Remove the fallback that compares against the latest current snapshot when no previous snapshot exists; show a clear not-enough-history state instead.
- Show only metrics that are available from the connected-source aggregate contract.
- Add source-aware context to delta cards, such as `Source: Google Analytics` or `Source: Campaign spend sources`.
- Keep spend direction neutral or contextual unless ROI/ROAS proves higher spend is negative.
- Update `Metric Trends` to read from `snapshot.metrics.performanceSummary.totals` instead of legacy snapshot columns.
- Filter trend snapshots to compatible `performance_summary_aggregate_v1` snapshots only.
- Render trend charts only for available connected-source metrics; for GA4-only campaigns this should prioritize sessions, users, conversions, revenue, and spend when available, not impressions/clicks when unavailable.
- Add clear empty states for no compatible historical aggregate snapshots.
- Add regression coverage proving legacy snapshots are ignored, incompatible snapshot versions are not compared, and GA4-only charts do not show unavailable paid-media metrics.

Required regression coverage:

- Scheduler refresh snapshot for GA4-only campaign contains GA4-derived fields only.
- Scheduler refresh snapshot for multi-source campaign matches the Performance Summary current aggregate.
- Legacy snapshot route, if retained, uses the same aggregate helper and remains campaign-access guarded.

### Insights

Outstanding fixes:

- Generate insights from the unified aggregate and per-source breakdown.
- Replace LinkedIn-vs-Custom-Integration-specific comparisons with dynamic comparison across all eligible paid platforms.
- Exclude analytics-only sources such as GA4 from paid-media efficiency comparisons unless the metric is valid for that source.
- Include GA4 in web/outcome insights when connected.
- Include revenue/spend source insights only where source provenance is available.

Required regression coverage:

- GA4-only campaign produces web/outcome insights and no paid-platform budget recommendation.
- LinkedIn plus Meta campaign compares both paid platforms.
- Campaign with spend but no revenue avoids ROAS/ROI claims.
- Campaign with revenue but no spend avoids paid efficiency claims.

## Backend Tasks

- Trace all current source connection checks used by Connected Platforms.
- Decide whether `outcome-totals` is the canonical aggregate contract or whether a new `performance-summary` endpoint is required.
- Add one source-aware aggregate helper that can be reused by Performance Summary and scheduler snapshots.
- Ensure the aggregate helper resolves campaign ownership/access before returning campaign data.
- Include source capabilities and included/excluded reasons in the response.
- Include source freshness metadata.
- Include canonical spend and revenue source provenance.
- Completed for current registered main platforms: replace direct aggregate source construction with a source-adapter registry for GA4, LinkedIn, Meta, and Custom Integration.
- Completed: The aggregate contract now accepts generic `platformSources` for future main Connected Platforms such as Google Ads, TikTok, Instagram, and other standalone platforms after their campaign-scoped resolvers provide source identity, capabilities, metric totals, freshness, and included/excluded metric reasons.
- Add each future platform resolver, including Google Ads when refinement begins, after tracing connection, storage, refresh, and campaign scoping paths end to end.

## Scheduler And Snapshot Tasks

- Align `server/scheduler.ts` aggregation with the same helper used by Performance Summary.
- Verify all source refresh paths that call `recordCampaignMetrics`.
- Trace legacy `POST /api/campaigns/:id/snapshots` before modifying.
- Ensure snapshots do not use stale hard-coded LinkedIn/CI-only totals.
- Store enough source metadata in snapshots to explain what sources were included at snapshot time.

## Frontend Tasks

- Replace local aggregation variables in `client/src/pages/campaign-performance.tsx` with the unified aggregate response.
- Keep tab layout and existing design pattern.
- Do not redesign the page while fixing the data contract.
- Update Overview first, then Campaign Health, then What's Changed, then Insights.
- Remove hard-coded source labels from metric cards.
- Remove hard-coded LinkedIn/CI-only source status.
- Remove LinkedIn/CI-only insight comparisons.
- Preserve demo mode behavior or update demo mode to match the same aggregate shape.

## Testing Plan

Targeted tests to add or update:

- Performance Summary aggregate endpoint or helper test for GA4-only campaign.
- Performance Summary aggregate endpoint or helper test for LinkedIn plus Meta campaign.
- Performance Summary aggregate endpoint or helper test for canonical spend source precedence.
- Performance Summary aggregate endpoint or helper test for revenue source classification and no double-counting.
- Scheduler snapshot regression proving snapshots match the aggregate helper.
- UI regression proving source labels come from source breakdowns, not hard-coded strings.
- UI regression proving Insights do not generate paid-media recommendations without paid-media inputs.

Validation commands after implementation:

- `npm run check`
- targeted Performance Summary regression tests
- targeted scheduler snapshot regression tests
- `npm run build`

## Bundled Implementation Plan

Use this sequence to keep commits small enough to validate safely while avoiding inefficient one-fix-at-a-time churn.

Do not start a later commit until the current commit has targeted regression coverage and its documented validation has passed.

### Commit 1: Aggregate Contract

Status: Completed and pushed in commits `1d0f63af` and `1b5b604a`. Latest `platformSources` aggregate-contract follow-up completed locally, not yet pushed.

Goal:

- Establish one connected-source-aware aggregate contract for Performance Summary.

Scope:

- Completed: Reused `/api/campaigns/:id/outcome-totals` as the safest existing contract path instead of adding a parallel endpoint.
- Completed: Added `server/utils/performance-summary-aggregate.ts`.
- Completed: Added additive `performanceSummary` response data to `outcome-totals` without removing or renaming existing fields.
- Completed: Included connected source status, capabilities, included metrics, excluded metrics, unavailable reasons, and freshness where available.
- Completed follow-up: Main Connected Platform source construction now goes through a registered adapter list in `server/utils/performance-summary-aggregate.ts` for GA4, LinkedIn, Meta, and Custom Integration. This preserves the current response shape while making the aggregate contract the single place where implemented main platforms register their source identity, capabilities, included metrics, excluded metric reasons, freshness, and current totals.
- Completed follow-up: Added generic `platformSources` support so future standalone Connected Platforms such as Google Ads, TikTok, Instagram, and other sources can contribute aggregate metrics through the same contract without changing Performance Summary tabs.
- Completed: Preserved unavailable values as unavailable instead of converting them to available zero values.
- Completed: Included canonical spend-source precedence and revenue-derived ROAS/ROI/CPC/CPA/CTR/CVR availability rules.
- Completed: Added GA4-only, LinkedIn-plus-Meta, and canonical spend/revenue regression tests in `server/performance-summary-aggregate.test.ts`.
- Completed follow-up: Added regression coverage proving current main Connected Platform aggregate sources are defined through the adapter registry.
- Completed follow-up: Added regression coverage proving future generic main Connected Platform sources aggregate impressions, clicks, conversions, and spend through the shared contract.
- Completed follow-up: Performance Summary now uses the same URL-style `outcome-totals` query key prefix used by source-update invalidations, so source mutations can refetch the open Performance Summary page instead of requiring a manual page refresh.
- Completed follow-up: Performance Summary now refetches the aggregate and compatible snapshot queries every 30 seconds while the page is visible, and on window focus, so source updates from user actions or server-side refresh jobs are pulled into the open section without requiring a manual refresh.
- Completed: Did not refactor or rewire the Performance Summary tab UI.
- Completed follow-up: When live GA4 in `outcome-totals` returns `TOKEN_EXPIRED` or another live-fetch error, persisted GA4 daily rows now backfill users, sessions, conversions, and revenue instead of only revenue.
- Completed follow-up: Added `server/outcome-totals-ga4-fallback-regression.test.ts`.

Validation:

- Passed: `npm test -- server/performance-summary-aggregate.test.ts`
- Passed: `npm test -- server/outcome-totals-ga4-fallback-regression.test.ts server/performance-summary-aggregate.test.ts`
- Passed after `platformSources` follow-up: `npm test -- server/performance-summary-aggregate.test.ts` with 6 tests.
- Passed after query-key sync follow-up: `npm test -- server/campaign-performance-overview-regression.test.ts`
- Passed after live-sync follow-up: `npm test -- server/campaign-performance-overview-regression.test.ts`
- Passed: `npm run check`
- Passed after `platformSources` follow-up: `npm run check`
- Passed after `platformSources` follow-up: `git diff --check`

Validation note:

- A connected GA4 source can still report `TOKEN_EXPIRED` when the saved OAuth token is invalid. That OAuth/reauthorization UX is separate from Performance Summary aggregation correctness and should be fixed in a later GA4 connection task.

Why this is first:

- Every tab needs the same aggregate contract. UI fixes before this would preserve the current drift.

### Commit 2: Overview Tab

Status: Completed and pushed through commit `b8fbba72`.

Goal:

- Make the Overview tab reflect the aggregate contract.

Scope:

- Wire Overview cards to the aggregate contract.
- Generate card labels from included source breakdowns.
- Fix GA4-only behavior so no LinkedIn, Meta, Custom Integration, or spend labels appear unless those inputs exist.
- Completed: `Campaign Health` summarizes campaign-level KPIs and Benchmarks that are above target or on track.
- Completed: `Top Priority Action` flags the least-performing below-target campaign-level KPI first, with Benchmark fallback only when no KPI is below target.
- Completed: `Top Priority Action` formats metric values for display, including currency and count values.
- Completed: `Total Impressions`, `Total Sessions`, `Total Conversions`, and `Total Spend` use aggregate values from connected sources in `Connected Platforms`.
- Completed: Added an `outcome-totals` query to `client/src/pages/campaign-performance.tsx`.
- Completed: Wired only the Overview metric cards to `outcomeTotals.performanceSummary`.
- Completed: Overview source labels now come from `performanceSummary.sources` and metric `sources`.
- Completed: Overview unavailable metrics render as unavailable instead of connected-source zero.
- Completed: Changed the second Overview card from mixed `Total Engagements` to aggregate-contract-backed `Total Sessions`.
- Completed: Added `server/campaign-performance-overview-regression.test.ts`.
- Completed follow-up: Confirmed Campaign Health and Top Priority use campaign-level KPI/Benchmark records, not platform-level routes.
- Completed follow-up: Kept Total Impressions unavailable for GA4-only campaigns because GA4 engagement rate is not interchangeable with impressions.
- Completed follow-up: `outcome-totals` now uses system-generated GA4 test data for mock/test GA4 properties and passes spend-to-date into `performanceSummary` while preserving the existing top-level `spend` response shape.
- Completed follow-up: Overview now requests the 90-day `outcome-totals` window to match the GA4 detail Summary window.
- Completed follow-up: Unavailable Overview metrics now show connected non-financial source labels, so GA4-only Total Impressions can show `Sources: Google Analytics` while the value remains unavailable.
- Completed follow-up: Unavailable Overview metrics now also show the aggregate unavailable reason, so GA4-only Total Impressions explains that GA4 engagement rate is not an impressions metric.
- Completed follow-up: Shortened GA4-only Total Impressions card copy to `Sources: Google Analytics - Impressions not available` while preserving the aggregate unavailable reason in the API.
- Completed follow-up: For mock/test GA4 properties, `outcome-totals` now adds stored GA4 daily rows to the simulated GA4 baseline so Performance Summary matches the GA4 detail Summary totals for sessions, conversions, users, and revenue.
- Completed follow-up: Overview `Total Impressions` now uses executive-facing unavailable copy, `Unavailable from connected sources`, while preserving detailed aggregate diagnostics in the API.
- Completed follow-up: `Top Priority Action` no longer treats an empty target set as success. If no connected-source metrics exist, it asks the user to connect a source; if connected-source metrics exist but no campaign KPIs or Benchmarks are configured, it asks the user to add KPI or Benchmark targets before generating a priority action.

Validation:

- Passed: `npm test -- server/campaign-performance-overview-regression.test.ts server/performance-summary-aggregate.test.ts server/outcome-totals-ga4-fallback-regression.test.ts`
- Passed: `npm test -- server/outcome-totals-ga4-fallback-regression.test.ts server/performance-summary-aggregate.test.ts server/campaign-performance-overview-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`

Why this is second:

- Overview has the clearest visible mismatch and proves the aggregate before deeper tabs are changed.

### Commit 3: Campaign Health Tab

Status: Completed and pushed through commit `4f132b20`.

Goal:

- Make Campaign Health source status use the aggregate contract without changing KPI/Benchmark behavior.

Scope:

- Replace hard-coded Data Sources with aggregate source status.
- Preserve KPI and Benchmark behavior.
- Show all connected/included sources and relevant unavailable-metric reasons.
- Add regression coverage for GA4-only and multi-source Data Sources display.
- Completed partial fix: Campaign Health score now counts campaign KPIs that are Above Target or On Track using the campaign KPI ±5% status band.
- Completed follow-up: Campaign Health KPI rows now use aggregate current values when available, use the same KPI `Above Target` / `On Track` / `Below Target` ±5% status bands, and format currency, count, and ratio values without raw unit suffixes.
- Completed partial fix: Campaign Health score now counts campaign Benchmarks that are On Track using the campaign Benchmark 90% progress threshold.
- Completed follow-up: Campaign Health Benchmark rows now use aggregate current values when available, use `On Track` / `Needs Attention` / `Below Target` benchmark progress bands, and format currency, count, and ratio values without raw unit suffixes.
- Completed follow-up: Campaign Health Benchmark section title now uses `Benchmarks`, and percent-valued metrics such as ROI use thousands separators.
- Completed partial fix: Campaign Health copy now says metrics are `on track` instead of `above target`, matching the KPI and Benchmark summary cards.
- Completed follow-up: Campaign Health KPI/Benchmark summary rows now label `>50%` as `Majority On Track`, exactly `50%` as `Half On Track`, and `<50%` as `Needs Attention`, with matching green, orange, and red side-line colors.
- Completed partial fix: Top Priority Action now selects the lowest lagging campaign-level KPI first using KPI status bands, with Benchmark fallback only when no KPI is below target.
- Completed partial fix: Top Priority Action now formats count KPI values as comma-separated whole numbers without a `count` suffix.
- Completed: Campaign Health `Data Sources` now reads connected source status from `performanceSummary.sources` instead of the old LinkedIn/Custom Integration hard-coded list.
- Completed follow-up: Campaign Health `Data Sources` filters out `financial` child inputs from `performanceSummary.sources` so GA4 revenue/spend imports can feed totals without appearing as separate main Connected Platforms.
- Completed follow-up: Campaign Health `Data Sources` filters out disconnected source rows. If no main Connected Platform sources are connected, it shows `No connected data sources` instead of listing `Not Connected` rows.
- Completed: KPI and Benchmark scoring behavior was preserved while wiring source status to the aggregate contract.
- Completed partial fix: Added a regression guard in `server/campaign-performance-overview-regression.test.ts`.

Validation:

- Passed: `npm test -- server/campaign-performance-overview-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`

Why this is separate:

- KPI and Benchmark current-value paths are analytics-sensitive and should not be mixed with Overview display changes.

### Commit 4: Scheduler And What's Changed

Status: Completed and pushed through commit `b165ed52`.

Goal:

- Make historical comparison use the same aggregate model as current Performance Summary values.

Scope:

- Make scheduler snapshots use the same aggregate helper.
- Verify all source refresh paths that call `recordCampaignMetrics`.
- Trace legacy `POST /api/campaigns/:id/snapshots` before editing or removing it.
- Align current-vs-history comparison with the same source model.
- Prevent comparisons between incompatible aggregate versions where source inclusion changed.
- Add scheduler snapshot regression coverage.
- Completed: `server/scheduler.ts` now builds snapshot totals from `buildPerformanceSummaryAggregate` and stores the aggregate contract under `metrics.performanceSummary`.
- Completed: Source-refresh callers of `recordCampaignMetrics` were traced in `server/routes-oauth.ts`; because those callers all enter `recordCampaignMetrics`, they now use the aggregate-backed snapshot path.
- Completed: Scheduler snapshot creation now treats GA4-only aggregate values such as sessions, users, revenue, and conversions as valid snapshot data instead of requiring impressions, clicks, or spend.
- Completed: The retained manual `POST /api/campaigns/:id/snapshots` route now reuses `aggregateCampaignMetrics` instead of maintaining a separate LinkedIn/Custom Integration-only aggregation path.
- Completed: No current frontend caller for the retained manual snapshot creation route was found; because the route mutates campaign snapshot data, it now uses the existing campaign access guard before creating a snapshot.
- Completed: `What's Changed` now compares current values only against historical snapshots with the same `performance_summary_aggregate_v1` version and reads historical values from `metrics.performanceSummary.totals`.
- Completed: `What's Changed` no longer compares aggregate current values against legacy snapshot columns when the historical snapshot lacks compatible aggregate metadata.
- Completed: The old `Engagements` comparison was replaced with `Sessions` because the aggregate contract does not define an `engagements` total.
- Completed: Added `server/performance-summary-scheduler-regression.test.ts`.

Validation:

- Passed: `npm test -- server/performance-summary-scheduler-regression.test.ts server/campaign-performance-overview-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`
- Passed user validation: Performance Summary Overview and Campaign Health still show correct values after Render deploy.

Why this is separate:

- Scheduler and history paths are higher-risk than current-value UI rendering and need isolated validation.

### Commit 5: Insights Tab

Status: Completed and pushed through commit `bf40da0a`.

Goal:

- Make Insights dynamic across all eligible connected sources.

Scope:

- Generate insights dynamically from source capabilities and source breakdowns.
- Remove LinkedIn-vs-Custom-Integration-only comparison logic.
- Compare all eligible paid platforms.
- Add GA4 web/outcome insights when GA4 is connected.
- Suppress ROAS, ROI, CPA, CPC, CTR, and CVR claims when required inputs are unavailable.
- Add regression coverage for GA4-only, paid multi-source, spend-without-revenue, and revenue-without-spend cases.
- Completed: Insights now read `performanceSummary.sources`, `includedMetrics`, source categories, and aggregate metric availability instead of hard-coded LinkedIn-vs-Custom Integration comparisons.
- Completed: Paid efficiency insights now compare all eligible paid/custom sources with valid spend and conversion inputs.
- Completed: GA4 and other web analytics sources now produce web/outcome insights from available sessions, users, conversions, and source labels.
- Completed: CTR, CVR, CPA, ROAS, and ROI insights are emitted only when the aggregate contract marks the required inputs available.
- Completed: Budget allocation insights use paid/custom source spend breakdowns and do not generate paid-media allocation claims for GA4-only campaigns.
- Completed: Added `server/performance-summary-insights-regression.test.ts`.

Validation:

- Passed: `npm test -- server/performance-summary-insights-regression.test.ts server/campaign-performance-overview-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`

Why this is fifth:

- Insights contain the most conditional business logic and should be changed only after the aggregate, Overview, Health, and history paths are stable.

### Commit 5.1: Refine Performance Summary Insights Prioritization

Status: Completed and pushed through commit `2577a828`.

Goal:

- Make the already source-correct Insights tab sharper without turning it into the Executive Summary narrative engine.

Scope:

- Keep Insights driven by `performanceSummary.sources`, `includedMetrics`, source categories, and aggregate metric availability.
- Add a small priority/category model so higher-risk or higher-opportunity insights render before context-only insights.
- Deduplicate by insight category so the tab does not show multiple cards saying the same thing.
- Cap visible insight cards to a small executive-friendly set.
- Improve copy so each insight states the source/data used, why it matters, and the bounded action.
- Keep the tab rule-based and concise; do not add broad narrative synthesis that belongs in Executive Summary.
- Add regression coverage proving Insights are prioritized, deduplicated, capped, and still avoid paid-media claims when inputs are unavailable.
- Completed: Insights now carry priority and category metadata internally while preserving the existing rendered card shape.
- Completed: Insights are deduplicated by category, sorted by priority, and capped to five cards.
- Completed: Copy now includes clearer bounded actions for paid engagement, conversion efficiency, revenue efficiency, budget allocation, and web outcomes.
- Completed: Regression coverage now guards priority/category metadata, dedupe, sorting, capping, and bounded action copy.

Validation:

- Passed: `npm test -- server/performance-summary-insights-regression.test.ts server/campaign-performance-overview-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`

Why this is separate:

- Commit 5 fixed source correctness. Commit 5.1 improves presentation quality while preserving the same aggregate data contract.

### Commit 5.2: Overview Refresh Stability

Status: Completed and pushed through commit `4a091083`; follow-up completed and pushed through commit `e5442622`.

Goal:

- Prevent the Performance Summary Overview tab from flashing legacy fallback metric content before the aggregate contract loads on page refresh.

Scope:

- Keep Overview metric cards driven by `performanceSummary.totals`.
- Preserve existing legacy fallback behavior only after the aggregate request has finished without returning `performanceSummary`.
- Render no Overview body content while the aggregate request is still loading.
- Do not change KPI, Benchmark, Insights, scheduler, or aggregate API logic.
- Completed: Overview metric cards and Overview body content no longer render legacy fallback values/source labels while the aggregate request is still pending.
- Completed: Existing fallback behavior remains available only after the aggregate request finishes without returning `performanceSummary`.
- Completed: Added regression coverage to prevent reintroducing page-refresh fallback flashes.
- Follow-up root cause: the metric-card placeholder fix did not cover the whole Overview tab. Campaign Health and Top Priority Action still computed from KPI/Benchmark fallback values while `performanceSummary` was pending, so a full page refresh could still briefly show wrong Overview content.
- Completed follow-up: the entire Overview tab body is now gated off while `performanceSummary` is pending, then renders the existing Overview content only after the aggregate is ready or the request has completed without an aggregate.
- Completed second follow-up: removed the visible `Preparing Overview` / `Preparing aggregate metrics` placeholder because it was still intermediate content during refresh.

Validation:

- Passed: `npm test -- server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`

Follow-up validation:

- Passed: `npm test -- server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts server/performance-summary-scheduler-regression.test.ts`
- Passed: `npm run check`
- Passed: `npm run build`
- Passed user validation: Performance Summary Overview no longer flashes `Preparing Overview` or other intermediate content on refresh.

### Commit 5.3: What's Changed Production Readiness

Status: Completed and pushed through commit `40ea4629`.

Goal:

- Make both `What's Changed` sections executive-useful, aggregate-source accurate, and reliable against historical snapshot drift.

Scope:

- Refine `What's Changed` delta cards so current values compare only against real previous compatible aggregate snapshots.
- Replace unclear no-history behavior with a not-enough-history state.
- Limit displayed deltas to metrics available from connected sources in the aggregate contract.
- Add concise source context to each delta card.
- Avoid treating higher spend as automatically negative unless paired with ROI/ROAS context.
- Refactor `Metric Trends` to use `snapshot.metrics.performanceSummary.totals`.
- Filter trend chart snapshots by compatible aggregate version.
- Render only connected-source available trend metrics.
- Preserve existing tab layout and visual design.
- Do not change scheduler snapshot creation logic unless a read-side incompatibility requires the smallest safe adjustment.
- Completed: `What's Changed` delta cards now use only real previous compatible aggregate snapshots and no longer fall back to `comparisonData.current`.
- Completed: Delta cards now skip unavailable aggregate metrics, include source labels, include users and revenue when available, and keep spend movement contextual instead of automatically negative.
- Completed: `Metric Trends` now reads from `snapshot.metrics.performanceSummary.totals`, filters snapshots by the current aggregate version, renders only connected-source available metrics, and shows a compatible-history empty state when fewer than two valid points exist.
- Completed: Snapshot comparison and trend read routes are now campaign-access guarded.

Required regression coverage:

- Delta cards do not compare against `comparisonData.current` when no previous snapshot exists.
- Delta cards ignore historical snapshots without matching `performance_summary_aggregate_v1`.
- Metric Trends ignore legacy snapshot columns when aggregate totals are present.
- Metric Trends filter incompatible snapshots and show an empty state when fewer than two compatible points exist.
- GA4-only Metric Trends do not render unavailable impressions/clicks charts.
- Snapshot comparison and trend read routes remain campaign-access guarded.

Validation:

- Passed: `npm test -- server/performance-summary-scheduler-regression.test.ts server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts`
- Passed: `npm run check`.
- Passed: `npm run build`.

Live GA4 end-to-end validation setup for later:

- Purpose: validate the full production data path with a real GA4 property: injected GA4 events -> GA4 reporting -> Market Forensics GA4 refresh -> persisted `ga4_daily_metrics` -> campaign metric snapshot -> Performance Summary `What's Changed` and `Metric Trends`.
- This validates live GA4 API connectivity, token refresh behavior, GA4 metric ingestion, daily metric persistence, snapshot creation, aggregate snapshot compatibility, source-aware cards, source-aware trend charts, and the UI's historical comparison behavior.
- This also validates that Performance Summary current values stay synchronized as underlying GA4 source data changes because the page refetches the aggregate while visible and on window focus.
- This does not validate paid-media impressions/clicks for GA4-only campaigns, because GA4 is not a paid-media impression/click source.
- Create a dedicated GA4 test property and Web stream, then create a Measurement Protocol API secret for that stream.
- Connect the dedicated GA4 test property to a test Market Forensics campaign through the normal `Connected Platforms -> Google Analytics` flow.
- Each day for at least 7 days, send synthetic GA4 Measurement Protocol events to the GA4 stream with distinct `client_id`, `session_id`, `page_view`, and `purchase` events.
- Mark or configure the relevant GA4 event as a conversion/key event if the test needs `conversions` to move.
- Wait for GA4 processing, then trigger the app GA4 refresh for the campaign with `POST /api/campaigns/:id/ga4/refresh` while authenticated.
- After refresh succeeds, create a campaign snapshot with `POST /api/campaigns/:id/snapshots` while authenticated.
- Repeat daily. After two compatible snapshots, `Metric Trends` should render. After seven or more days of compatible snapshots, `Last 7 Days` should have a real previous aggregate snapshot. After thirty or more days, `Last 30 Days` should have a real previous aggregate snapshot.
- It will test: GA4 data changes over time; the app refresh pulls updated GA4 data; Performance Summary current values update; new compatible snapshots are created; `What's Changed` compares current values against the previous compatible snapshot; and `Metric Trends` charts multiple compatible snapshots over time.
- Minimum data needed: at least two compatible snapshots to validate `Metric Trends`; at least two comparable time periods to validate `What's Changed`; seven or more days of snapshots to validate `Last 7 Days`; and thirty or more days of snapshots to validate `Last 30 Days`.
- Validate `Previous` values by opening `/api/campaigns/:id/snapshots/comparison?type=yesterday`, `/api/campaigns/:id/snapshots/comparison?type=last_week`, or `/api/campaigns/:id/snapshots/comparison?type=last_month` and confirming `previous.metrics.performanceSummary.totals.<metric>.value` matches the UI.
- Validate `Metric Trends` by opening `/api/campaigns/:id/snapshots?period=daily`, `/api/campaigns/:id/snapshots?period=weekly`, or `/api/campaigns/:id/snapshots?period=monthly` and confirming visible chart points come only from snapshots whose `metrics.performanceSummary.version` is `performance_summary_aggregate_v1`.
- Expected GA4-only UI behavior: sessions, users, conversions, revenue, and campaign spend can appear when available; impressions and clicks should not appear unless a connected paid-media source provides them.

### Commit 6: Docs And Final Validation

Status: Not started.

Goal:

- Finalize documentation and prove the full Performance Summary section is production ready.

Scope:

- Update `ARCHITECTURE_USER_JOURNEY.md` if the final contract needs clarification.
- Update GA4 and financial-source docs if their Performance Summary behavior is changed.
- Update this tracker with completed evidence for each commit.
- Run targeted Performance Summary tests.
- Run targeted scheduler tests.
- Run `npm run check`.
- Run `npm run build`.

Why this is last:

- Documentation should match the implemented behavior, and final validation should cover all previously changed paths together.

## Comprehensive Source Readiness Review

Last reviewed after the main-source adapter registry follow-up.

Root cause:

- The original Performance Summary implementation mixed tab-local calculations with source-specific queries. That made some UI values correct only for the sources each tab happened to know about.
- The current source of truth is now `/api/campaigns/:id/outcome-totals`, which returns `performanceSummary`.
- `performanceSummary` is built by `server/utils/performance-summary-aggregate.ts`.
- Current main Connected Platform aggregate sources are registered through the adapter list for GA4, LinkedIn, Meta, and Custom Integration.
- GA4 child revenue/spend inputs such as Salesforce, HubSpot, Shopify, CSV, and Google Sheets imports can feed campaign financial totals through the parent platform or campaign financial-source path. They are not main Connected Platforms, users do not connect them from the campaign `Connected Platforms` section, and they must not appear as main source rows.

Tab-by-tab source status:

- Overview: uses `performanceSummary.totals` for impressions, sessions, conversions, and spend. Source labels come from `performanceSummary.sources`. Unavailable impressions use executive-facing copy while detailed unavailable reasons remain in the aggregate contract. `Top Priority Action` requires connected-source metrics and at least one campaign KPI or Benchmark target before it can say all metrics are on track. This is aligned for current registered sources.
- Campaign Health: uses campaign-level KPIs and Benchmarks, and resolves current metric values from `performanceSummary.totals` when the KPI/Benchmark metric exists in the aggregate. It preserves KPI/Benchmark behavior for targets, thresholds, health score, and top-priority action. Data Sources filters out financial child inputs and lists only main Connected Platform sources from `performanceSummary.sources`.
- What's Changed: compares current `performanceSummary.totals` against historical snapshots only when the snapshot contains a compatible `metrics.performanceSummary.version`. Metric Trends also filters to compatible aggregate snapshots and aggregate-available metrics only.
- Insights: builds recommendations from `performanceSummary.totals` and `performanceSummary.sources`, including source capabilities and source breakdowns. It avoids paid-media recommendations for analytics-only sources such as GA4.

Automatic aggregation status:

- Implemented for current registered main sources: GA4, LinkedIn, Meta, and Custom Integration.
- Implemented child-source behavior: GA4/platform child revenue and spend inputs can feed financial totals only through the parent platform/campaign financial path, without appearing as main Connected Platforms and without requiring duplicate Campaign DeepDive inputs.
- Future main Connected Platforms are supported by the generic `platformSources` contract. Each platform still needs its own campaign-scoped resolver, but once that resolver supplies a valid source breakdown, Performance Summary tabs consume the new source automatically through the existing aggregate contract.
- Google Ads, TikTok, Instagram, and other future standalone platforms do not require tab rewiring. Their remaining work is platform-specific connection, storage, refresh, campaign scoping, and resolver implementation.

Production-readiness conclusion:

- Production-ready for the current registered main Connected Platform aggregate path covering GA4, LinkedIn, Meta, and Custom Integration, with campaign financial totals able to include parent-platform child revenue/spend inputs when those inputs are configured inside the relevant platform flow.
- Production-ready at the Performance Summary aggregate layer for future standalone platforms that supply valid `platformSources`.
- Platform-specific production readiness for Google Ads, TikTok, Instagram, and other future sources still depends on each platform's own connection, storage, refresh, campaign scoping, and resolver validation.
- Live GA4 7-day and 30-day time-based validation remains a later production validation task using the documented live GA4 test-property setup.

## Production Readiness Definition

Performance Summary is production ready only when:

- each tab uses the same connected-source-aware aggregate contract
- every main Connected Platform that is implemented/refined participates automatically in the aggregate contract
- every future main Connected Platform provides source identity, capabilities, metric totals, source labels, freshness, scheduler snapshot inputs, and tests through the generic `platformSources` contract
- platform child sources such as GA4 Salesforce/HubSpot/Shopify/CSV/Google Sheets revenue or spend imports feed their parent platform/campaign financial totals without appearing as separate main Connected Platforms
- GA4-only campaigns show only GA4-available metrics
- multi-source campaigns aggregate all connected eligible source metrics
- unavailable metrics are not silently treated as zero
- source labels match included source breakdowns
- insights are generated only from valid metric/source combinations
- scheduler snapshots match the same aggregate model as the UI
- regression coverage proves GA4-only, paid multi-source, financial-source, and scheduler paths
- documentation matches the implemented behavior

## Current Status

Production-ready for the current registered Performance Summary aggregate path and for future main Connected Platforms at the aggregate-contract layer via `platformSources`.

Platform-specific readiness for Google Ads, TikTok, Instagram, and other future standalone platforms remains part of each platform's own connection, storage, refresh, campaign scoping, and resolver implementation.

Proven:

- Documentation intends Campaign DeepDive to be campaign-wide and cross-platform.
- Overview, Campaign Health, Scheduler/What's Changed snapshot data, and Insights have been wired to the aggregate contract. Fallback calculations remain only as defensive behavior when the aggregate response is unavailable; the normal loaded path uses `performanceSummary`.
- Campaign DeepDive Custom Report PDF exports for Performance Summary now preserve the selected tab section structure. Overview, Campaign Health, What's Changed, and Insights exports use `performanceSummary` current values plus campaign KPI/Benchmark rows instead of the older generic metric-list export.
- `outcome-totals` is a stronger existing candidate contract for source-aware campaign totals.
- Platform Comparison already uses `outcome-totals` as its primary cross-platform source.
- GA4 child revenue/spend inputs such as Salesforce, HubSpot, Shopify, CSV, and Google Sheets imports are documented as child inputs inside the parent platform flow, not main Connected Platforms.
- Current main Connected Platform aggregate sources are now registered through the aggregate adapter list for GA4, LinkedIn, Meta, and Custom Integration instead of being added directly inside tab-specific UI logic.
- Future main Connected Platforms can be aggregated without Performance Summary tab rewiring by supplying validated `platformSources`.

Partially reviewed:

- GA4, LinkedIn, Meta, Custom Integration, revenue source, spend source paths.
- Scheduler aggregation.

Unverified:

- Google Ads, TikTok, Instagram, and other future platform-specific connection/storage/refresh/resolver paths. The Performance Summary aggregate contract is ready to consume them through `platformSources`, but each platform path still needs its own implementation and validation.
- All legacy snapshot route callers.
- Complete frontend test coverage for every Performance Summary tab.
- Live GA4 7-day and 30-day time-based validation. This will be validated later with the documented live GA4 test-property setup after enough compatible snapshots exist.
