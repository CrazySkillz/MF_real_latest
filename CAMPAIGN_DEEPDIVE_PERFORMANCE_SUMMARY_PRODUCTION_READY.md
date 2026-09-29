# Campaign DeepDive Performance Summary Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

Record the implemented Campaign DeepDive `Performance Summary` contract, its validation boundary, and the historical work that led to the current implementation.

## Ordered Daily Publication Alignment (reviewed 2026-09-29)

For active real GA4 campaigns, the generic interval/startup aggregate snapshot path defers to the GA4 daily pipeline. After mapped financial sources, GA4 Overview facts, and KPI/Benchmark recompute complete, that pipeline writes the compatible `platform_sync` aggregate snapshot retained for compatible aggregate consumers and generic non-GA4 history. The visible GA4 Recent Movement cards use the exact-date traffic and financial reads described below. Current cards continue to read/refetch their authoritative inputs. Campaign-scoped publication continues when unrelated campaigns fail; only the affected campaign is withheld from later stages. Exact-date report readiness is persisted after the Executive Summary snapshot and campaign alerts complete and can be restored after a server restart. The deployed runtime contains this ordering, but the bounded Campaign3 UI/API evidence below is not a full scheduler-lifecycle recertification.

## Current Implementation And Evidence Status (2026-09-29)

**Deployed runtime `1e066496567f6a81535473373d63da9910be153f` — BOUNDED CAMPAIGN3 PASS FOR THE `2026-09-28` CUTOFF AND ALL THREE RECENT MOVEMENT OPTIONS; FULL DEPLOYED RECERTIFICATION PENDING.** The application behavior is unchanged from `bde5e22c`; `1e066496` changed documentation only.

The latest preserved clean certificate is `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md` for exact deployed runtime `ee6e11ebf8cb0a13dd182dde54af790a3757ef2f`, its two recorded campaigns, property, USD currency, Europe/Amsterdam timezone, source inventory, and `2026-09-18` data-through boundary. That historical certificate remains valid only for its exact scope. It does not certify the current runtime.

Post-certificate implementation changes now include:

- Key Outcomes Revenue and Spend use the campaign currency instead of a hard-coded dollar symbol.
- The section accepts current GA4 traffic, Revenue, Spend, and the shared aggregate only when they identify the same latest completed `dataThroughDate` and campaign reporting timezone. A mismatch makes the affected current values unavailable instead of mixing dates.
- The Key Outcomes header shows `Data through <date> (<timezone>), the latest completed day` when the aligned boundary is available; otherwise it shows `Completed-day data cutoff unavailable`.
- Recent Movement defaults to the previous completed day and supports the previous completed day, seven completed days earlier, and the prior-month cutoff anchored to the aligned current date.
- Recent Movement keeps the last settled cards visible while the new comparison requests load and commits the new selection only after the Revenue, Spend, and snapshot requests have settled against the requested dates. This prevents a transient `Comparison unavailable` state during a normal selection change.
- Recent Movement uses campaign-currency formatting, directional arrows, and a dedicated `Not connected` Spend state.
- Recommended Actions formats Revenue and CPA current/target values in the campaign currency. The same currency is passed to the scheduled Performance Summary PDF renderer.
- Top Priority Action formats Revenue and CPA current/target values with the campaign currency formatter instead of appending a saved ISO unit as text.
- The live Performance Summary header no longer exposes the `Demo Data` control or demo banner. The retained internal demo branches are fixed off and the visible page stays on the live-data path.

Current exact-runtime evidence:

- `/api/health` returned exact deployed commit `1e066496567f6a81535473373d63da9910be153f` during the latest authenticated, read-only Campaign3 reconciliation.
- Campaign3 used EUR, `Europe/Amsterdam`, GA4 property `542352127`, and the aligned `2026-09-28` completed-day cutoff. Instagram and TikTok were not configured as Campaign3 Connected Platforms and contributed no values to this evidence.
- Key Outcomes reconciled to 2,256 Users, 2,256 Sessions, 145 Conversions, EUR 78,969.69 Total Revenue, and EUR 2,357.89 Total Spend. Revenue reconciled as EUR 37,518.74 GA4 native + EUR 30,340.00 Google Sheets + EUR 10,000.00 HubSpot + EUR 785.95 Shopify + EUR 250.00 CSV + EUR 75.00 Salesforce. Spend reconciled as EUR 1,103.00 Google Sheets + EUR 1,250.00 CSV + EUR 4.89 Google Ads.
- Campaign Health reconciled to 57% with 4 of 7 configured metrics on track: 3 of 5 KPIs and 1 of 2 Benchmarks. CPA was the Top Priority at EUR 16.26 against EUR 9.00. Recommended Actions were CPA, ROAS at 33.49x against 50x, and Conversions at 145 against 160.
- All three Recent Movement options were selected and reconciled in the deployed UI. Previous completed day (`2026-09-27`): Sessions 2,256 from 2,256 and Conversions 145 from 145 were unchanged; Total Revenue increased by EUR 41,450.95 from EUR 37,518.74 to EUR 78,969.69. Seven completed days earlier (`2026-09-21`): Sessions increased by 127 from 2,129 to 2,256 (+6.0%), Conversions increased by 8 from 137 to 145 (+5.8%), and Total Revenue increased by EUR 43,435.86 from EUR 35,533.83 to EUR 78,969.69 (+122.2%). Previous month cutoff (`2026-08-28`): Sessions increased from 0 to 2,256, Conversions from 0 to 145, and Total Revenue from EUR 0.00 to EUR 78,969.69; percentage change was correctly omitted for each zero baseline.
- Spend showed EUR 2,357.89 with `Comparison unavailable — verified Spend baseline unavailable` for all three options because the active Google Ads spend source is not a date-mapped historical import. The UI did not expose an unverified previous Spend value.
- Every exact-date GA4 Revenue, imported Revenue, Spend, and snapshot-comparison request used the resolved option date and returned HTTP 200. The selection control waited for its requested inputs, then displayed the matching option and values.
- The rendered page showed `Data through 28 Sept 2026 (Europe/Amsterdam), the latest completed day`, did not show `Demo Data` or `Compare with yesterday`, produced no JavaScript page errors, attempted no application mutations, and left the relevant persistence fingerprint unchanged. Three expected 404 resource messages came from unconfigured Custom Integration and Meta endpoints; they did not affect Recent Movement.
- The focused aggregate, Overview, financial-source-date, and GA4 readiness packet passed 47 of 47 tests. The documentation-alignment verification then passed 52 of 52 focused tests, including the production-readiness ledger, and `npm run check` passed. The earlier completed-day alignment packet remains historical evidence for its 88 tests.

This is a bounded current-runtime reconciliation, not a replacement whole-section certificate. It proves the configured Campaign3 current cards and live switching among the previous-completed-day, seven-completed-days-earlier, and previous-month-cutoff comparisons. Failure and stale states, other campaigns and source mixes, lifecycle mutations, tenant isolation, and current scheduled-PDF parity remain outside this exact-runtime evidence. The earlier deployed `1f86a46e` Campaign3 reconciliation remains historical evidence.

## Current Controlling Implementation Contract (Observed At `bde5e22c`, Revalidated Unchanged At `1e066496`)

This section supersedes older implementation descriptions in the chronological commit history below. It describes current code behavior, not a new production-readiness certificate.

- `client/src/pages/campaign-performance.tsx` consumes `/api/campaigns/:id/outcome-totals.performanceSummary` for the campaign-level aggregate and uses focused read-only GA4 requests where an exact GA4 current or historical boundary is required.
- The GA4 setup lookback establishes a fixed initial-import boundary. Sessions, Users, Conversions, pageviews, Engagement Rate, and Key Events per Session current values accumulate from that boundary through the latest completed reporting day; the original lookback is not reused as a rolling current-value window.
- GA4 KPI and Benchmark persisted `currentValue` fields are recomputed from those cumulative traffic inputs. Native Revenue and matching financial Conversions use the saved initial-import boundary; imported Revenue and Spend include mapped materialized records dated on or before the campaign-timezone latest completed reporting day. ROAS, ROI, and CPA derive from those same inputs.
- The visible current-value contract requires `outcome-totals.performanceSummary.currentValueWindow.dataThroughDate` to equal the GA4 daily response's financial end date and its `reportingTimeZone` to equal the GA4 response timezone. Traffic, Revenue, financial Conversions, and Spend fail closed when this shared boundary is absent or mismatched.
- The page renders the aligned completed-day date and reporting timezone above Key Outcomes. It never labels an intraday or unaligned current state as complete.
- For a live GA4 campaign, Key Outcomes renders Users, Sessions, and Conversions from the aligned GA4 daily Summary totals; Total Revenue from exact-cutoff native GA4 Revenue plus exact-cutoff imported Revenue; and Total Spend only when the shared aggregate Spend equals the exact-cutoff `spend-to-date` result. Revenue and Spend use the campaign currency. It does not derive a separate rolling Performance Summary total.
- Campaign Health scores the complete configured GA4 KPI/Benchmark inventory only when every row is scorable from a verified current value and valid target. If any configured row is excluded, the section shows `Verification Needed` and does not calculate a partial health percentage.
- Top Priority Action evaluates below-target KPIs first, orders them by configured KPI priority and then target-gap severity, and falls back to the worst eligible Benchmark only when no eligible KPI is below target. Revenue and CPA current/target values use the campaign currency. It fails closed for unavailable lists, unscorable inputs, incomplete coverage, invalid targets, and missing source metrics.
- Recommended Actions evaluates the refreshed KPI and Benchmark current values with the shared metric-aware direction, sufficiency, and threshold policies. It returns at most three target-backed cards, deduplicates repeated action categories, and identifies target gaps only. Revenue and CPA values and targets use the campaign currency in both the live section and scheduled Performance Summary PDF. The UI states that the underlying causes must be investigated before changing spend.
- Recent Movement renders `Sessions`, `Conversions`, `Spend`, and `Total Revenue`. The one-day and seven-day selections use the exact prior completed reporting dates relative to the aligned current cutoff. One month uses the same calendar day in the previous month, clamped to that month's last valid day.
- Comparison labels name the completed-day relationship and resolved date; the generic `Compare with yesterday` label is no longer part of the current UI.
- Sessions and Conversions derive the cumulative value at the exact prior date by subtracting covered intervening daily facts from the current cumulative Summary total. Spend and imported Revenue comparisons require every active source to have supported dated materialization, the current source IDs to equal the active dated-source set, and historical source IDs to be a subset of that same active set. This permits a currently active dated source to have no eligible row at the earlier cutoff, while rejecting removed, unrelated, undated, duplicate, or currency-incompatible history. Current Spend must also match the shared aggregate. Native Revenue requires the same GA4 property and currency at both cutoffs. The prior revenue metric must match the current metric, except that an absent prior metric is accepted when prior revenue is exactly zero. Missing, incompatible, ambiguous, stale, or failed inputs produce the final `Comparison unavailable` state; the current total is never presented as verified history. An active undated connector snapshot such as the current GA4-scoped Google Ads spend source therefore leaves current Spend available but withholds its historical movement comparison.
- The dropdown separates the requested comparison from the committed display period. During a selection change, the previous settled cards remain visible and the control is disabled until all exact-date requests have settled and match the requested boundary; the cards then update together without rendering mixed-period placeholder data.
- The removed `Available comparisons use data from ...` microcopy must remain absent.
- The disabled legacy Metric Trends render path is not a visible Performance Summary feature; users are directed to the separate Trend Analysis section.
- The page does not expose a `Demo Data` control or demo banner; visible production use remains on the live-data path.

Documentation/certification boundary: this update documents application behavior observed at deployed runtime `1e066496` and records a bounded Campaign3 pass; it does not issue a replacement whole-section certificate. The latest preserved clean certificate remains limited to exact runtime `ee6e11eb` and the scope in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md`. This documentation update changes no production code, tests, validators, protected GA4 machine certification records, Trend Analysis boundary, or Budget & Financial Analysis boundary.

The intended product behavior is:

- `Connected Platforms` shows which campaign-scoped data sources are attached.
- `Performance Summary` aggregates only the metrics currently available from those connected sources.
- If only GA4 is connected, Performance Summary uses only GA4-capable metrics.
- Revenue and spend sources connected inside a platform, such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets imports inside GA4, are platform child inputs. Users do not connect these as separate main `Connected Platforms`; they can only feed financial totals through the parent platform/campaign financial path.
- Current registered main Connected Platform code paths cover GA4, LinkedIn, Meta, Custom Integration, Google Ads, Instagram, TikTok, and Google Sheets when their source-specific connection and availability gates pass. Registration describes conditional implementation support; it does not mean a source is configured for a campaign. Instagram and TikTok were not configured for Campaign3 in the current evidence.
- Automatic inclusion means every main Connected Platform must provide its campaign-scoped source identity, capabilities, included metrics, excluded metric reasons, freshness, current totals, and snapshot inputs through the shared Performance Summary aggregate contract. Google Ads, Instagram, TikTok, and Google Sheets use the generic `platformSources` path; future standalone sources can use the same contract without Performance Summary section rewiring.
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

## Historical Root Cause (Resolved)

The original `client/src/pages/campaign-performance.tsx` implementation performed page-local aggregation from separate source queries. The current implementation uses the shared aggregate plus the focused exact-boundary GA4 inputs described in the controlling contract above.

That implementation was not driven by the same connected-source registry required by the campaign `Connected Platforms` section. As a result:

- source inclusion is hard-coded instead of capability-driven
- some totals include Meta and GA4 while labels still mention only LinkedIn or Custom Integration
- the Data Sources block only lists LinkedIn Ads and Custom Integration
- Before Commit 5, Insights compared mostly LinkedIn vs Custom Integration instead of all connected eligible sources
- snapshot/history comparisons can drift because frontend aggregation, scheduler aggregation, legacy snapshot routes, Executive Summary, and `outcome-totals` are separate aggregation paths

The issue is an aggregation contract problem, not a single-card display bug.

## Existing Relevant Paths

- `client/src/pages/campaign-performance.tsx`
  - Current single-page Performance Summary UI and its visible sections.
  - Consumes the shared aggregate and focused GA4 current/exact-date inputs for the visible consumer logic.

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

## Historical Production-Ready Target Contract — Implemented

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

Implemented aggregate registration behavior:

- impressions
- clicks
- conversions
- attributed revenue only when a Google Ads-scoped imported revenue source is present

A full, non-spend-only Google Ads connection is eligible as a main paid-media source. For the aligned current-value window, persisted rows must cover every selected Google Ads campaign at the exact cutoff before impressions, clicks, and conversions are available. Exact current Spend continues through the canonical campaign spend contract rather than an unchecked platform fallback. A GA4-scoped Google Ads spend-only connection is a financial child input and does not appear as a separate main Connected Platform source. Registration is not source-specific certification; use `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` for that boundary.

### Instagram

Instagram was not configured for Campaign3 and supplied no Performance Summary values in the current evidence. If an eligible, non-spend-only Instagram connection is configured, the implemented resolver participates through `platformSources` with impressions, clicks, conversions, and source metadata when exact persisted rows cover every selected Instagram campaign at the cutoff. The resolver filters rows to the Instagram publisher platform. Exact current Spend does not use an unchecked platform fallback. Instagram source readiness remains bounded by `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

### TikTok

TikTok was not configured for Campaign3 and supplied no Performance Summary values in the current evidence. If an eligible, non-spend-only TikTok connection is configured, the implemented resolver participates through `platformSources` with impressions, clicks, conversions, and Spend when exact persisted-row coverage and campaign-currency checks pass. TikTok attributed Revenue requires a TikTok-scoped imported revenue source and is not inferred from conversion value. Source readiness remains bounded by `TIKTOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`.

### Google Sheets Main Platform

A campaign configured with Google Sheets as a main platform participates through `platformSources`. Cached mapped impressions, clicks, conversions, leads, sessions, and users are available only on paths that permit refreshed cached rows. In the aligned current-value window, confirmed Revenue and Spend require active `google_sheets`-scoped financial sources in the campaign currency; ROAS and ROI require both confirmed values and positive Spend. This main-platform path is distinct from GA4-scoped Google Sheets financial child imports.

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

## Historical Pre-Certification Plan — Superseded

The planning and commit history below is retained to explain how the certified
implementation was reached. Any `Outstanding`, `required`, `later`, or
`unverified` wording inside this historical plan is superseded by `Current
Certification Status` unless the item is repeated in the active certification
exclusions above.

## Tab Requirements

### Overview

Current behavior:

- `Campaign Health` summarizes the complete configured GA4 KPI/Benchmark inventory and withholds a partial score when any configured metric is unverified or unscorable.
- `Top Priority Action` ranks eligible below-target KPIs by configured priority and then gap severity; if no eligible KPI is below target, it falls back to the worst eligible Benchmark.
- `Top Priority Action` metric values must be formatted for display, for example `$450,000.00` and `80,000`.
- `Total Users`, `Total Sessions`, `Total Conversions`, `Total Spend`, and `Total Revenue` are populated from the authoritative cumulative traffic and connected-source financial inputs.
- Each card only uses metrics that the connected source actually provides. GA4 can provide sessions and conversions, but not impressions.
- If a connected source does not provide a metric, the card must clearly show that the metric is unavailable instead of inventing a value.

Required regression coverage:

- GA4-only campaign renders GA4 metrics only.
- LinkedIn plus Meta campaign aggregates paid media totals and labels both sources.
- Campaign with canonical spend source uses canonical spend rather than double-counting platform spend.

### Campaign Health

Historical work items — resolved or superseded:

- Keep KPI and Benchmark health from campaign-level KPI/Benchmark records.
- Replace hard-coded Data Sources block with connected source list from the aggregate contract.
- At this historical stage, the implemented aggregate registry contained Google Analytics, LinkedIn, Meta, and Custom Integration. The current registry is documented in `Comprehensive Source Readiness Review`. GA4 revenue/spend child imports such as Salesforce, HubSpot, Shopify, CSV, and Google Sheets financial imports can feed financial totals through their parent platform/campaign financial path but must not appear as separate main platforms.
- Show source freshness and unavailable-metric reasons where relevant.
- Ensure KPI/Benchmark current values remain sourced from their existing campaign-level source-aware paths and do not regress.

Required regression coverage:

- Historical regression coverage listed GA4, LinkedIn, Meta, and Custom Integration as the main Connected Platforms implemented at that stage.
- Data Sources does not list GA4 financial child imports such as Salesforce, HubSpot, Shopify, CSV, or Google Sheets revenue/spend imports as separate main platforms.
- GA4-only campaign does not show LinkedIn or Custom Integration as data sources.
- KPI/Benchmark status still renders when no platform ad metrics are available.

### What's Changed

Historical work items — resolved or superseded:

- Ensure current values and historical snapshots use the same aggregation helper/contract.
- Align scheduler snapshots with Performance Summary aggregation.
- Trace legacy/manual snapshot route reachability before changing or removing it.
- Prevent comparisons between incompatible aggregate versions where source inclusion changed.

Historical snapshot behavior, superseded for the four visible Recent Movement cards:

- Delta cards are populated by `client/src/pages/campaign-performance.tsx` from `/api/campaigns/:id/snapshots/comparison?type=...`.
- The selected range maps to comparison types: `24h -> yesterday`, `7d -> last_week`, and `30d -> last_month`.
- Generic non-GA4 comparison support still requires compatible `performance_summary_aggregate_v2` snapshots.
- The visible GA4 Recent Movement cards follow the exact-date paths in the current controlling contract: cumulative GA4 daily derivation for Sessions/Conversions, compatible dated active-source totals for Spend, and exact-date same-source native/imported totals for Total Revenue.
- Snapshot creation through scheduler/platform-sync/manual snapshot routes uses `aggregateCampaignMetrics`, which embeds `metrics.performanceSummary` in new snapshots.
- The legacy Metric Trends code path is disabled and is not rendered; visible trend analysis belongs to the separate Campaign DeepDive Trend Analysis section.

Historical production-ready task bundle — resolved or superseded:

- Update the `What's Changed` delta cards to compare current aggregate values only against a real previous compatible aggregate snapshot.
- Remove the fallback that compares against the latest current snapshot when no previous snapshot exists; show a clear not-enough-history state instead.
- Show only metrics that are available from the connected-source aggregate contract.
- Add source-aware context to delta cards, such as `Source: Google Analytics` or `Source: Campaign spend sources`.
- Keep spend direction neutral or contextual unless ROI/ROAS proves higher spend is negative.
- Update `Metric Trends` to read from `snapshot.metrics.performanceSummary.totals` instead of legacy snapshot columns.
- Filter trend snapshots to compatible `performance_summary_aggregate_v2` snapshots only.
- Render trend charts only for available connected-source metrics; for GA4-only campaigns this should prioritize sessions, users, conversions, revenue, and spend when available, not impressions/clicks when unavailable.
- Add clear empty states for no compatible historical aggregate snapshots.
- Add regression coverage proving legacy snapshots are ignored, incompatible snapshot versions are not compared, and GA4-only charts do not show unavailable paid-media metrics.

Required regression coverage:

- Scheduler refresh snapshot for GA4-only campaign contains GA4-derived fields only.
- Scheduler refresh snapshot for multi-source campaign matches the Performance Summary current aggregate.
- Legacy snapshot route, if retained, uses the same aggregate helper and remains campaign-access guarded.

### Insights

Historical work items — resolved or superseded:

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
- Completed in the first adapter stage: replaced direct aggregate source construction with a source-adapter registry for GA4, LinkedIn, Meta, and Custom Integration.
- Completed in that stage: the aggregate contract accepted generic `platformSources` for then-future main Connected Platforms after their campaign-scoped resolvers provided source identity, capabilities, metric totals, freshness, and included/excluded metric reasons.
- Superseded by the current route registrations for Google Ads, Instagram, TikTok, and Google Sheets recorded in `Comprehensive Source Readiness Review`.

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

Historical status: completed and pushed in commits `1d0f63af` and `1b5b604a`; the later generic `platformSources` follow-up was subsequently pushed in `930614e9`.

Goal:

- Establish one connected-source-aware aggregate contract for Performance Summary.

Scope:

- Completed: Reused `/api/campaigns/:id/outcome-totals` as the safest existing contract path instead of adding a parallel endpoint.
- Completed: Added `server/utils/performance-summary-aggregate.ts`.
- Completed: Added additive `performanceSummary` response data to `outcome-totals` without removing or renaming existing fields.
- Completed: Included connected source status, capabilities, included metrics, excluded metrics, unavailable reasons, and freshness where available.
- Completed follow-up: Main Connected Platform source construction now goes through a registered adapter list in `server/utils/performance-summary-aggregate.ts` for GA4, LinkedIn, Meta, and Custom Integration. This preserves the current response shape while making the aggregate contract the single place where implemented main platforms register their source identity, capabilities, included metrics, excluded metric reasons, freshness, and current totals.
- Completed follow-up: Added generic `platformSources` support so then-future standalone Connected Platforms could contribute aggregate metrics through the same contract without changing Performance Summary sections. Current registered resolvers are listed above.
- Completed: Preserved unavailable values as unavailable instead of converting them to available zero values.
- Completed: Included canonical spend-source precedence and revenue-derived ROAS/ROI/CPC/CPA/CTR/CVR availability rules.
- Completed: Added GA4-only, LinkedIn-plus-Meta, and canonical spend/revenue regression tests in `server/performance-summary-aggregate.test.ts`.
- Completed follow-up: Added regression coverage proving the main Connected Platform aggregate sources implemented at that stage were defined through the adapter registry.
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
- Historical follow-up, superseded: Overview once requested a 90-day `outcome-totals` view. Current GA4 traffic current values come from scheduler-backed cumulative Summary totals spanning the fixed initial-import boundary through the latest completed day; the `dateRange=90days` compatibility parameter must not be interpreted as the Performance Summary traffic window.
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
- Completed: `What's Changed` now compares current values only against historical snapshots with the same `performance_summary_aggregate_v2` version and reads historical values from `metrics.performanceSummary.totals`.
- Completed: `What's Changed` no longer compares aggregate current values against legacy snapshot columns when the historical snapshot lacks compatible aggregate metadata.
- Completed: The old `Engagements` comparison was replaced with `Sessions` because the aggregate contract does not define an `engagements` total.
- Current superseding behavior: the visible Recent Movement cards use the exact-date per-metric paths in the controlling contract. Compatible aggregate snapshots remain the generic non-GA4 fallback, not the GA4 Sessions/Conversions or Total Revenue source.
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
- Delta cards ignore historical snapshots without matching `performance_summary_aggregate_v2`.
- Metric Trends ignore legacy snapshot columns when aggregate totals are present.
- Metric Trends filter incompatible snapshots and show an empty state when fewer than two compatible points exist.
- GA4-only Metric Trends do not render unavailable impressions/clicks charts.
- Snapshot comparison and trend read routes remain campaign-access guarded.

Validation:

- Passed: `npm test -- server/performance-summary-scheduler-regression.test.ts server/campaign-performance-overview-regression.test.ts server/performance-summary-insights-regression.test.ts`
- Passed: `npm run check`.
- Passed: `npm run build`.

Historical generic-snapshot validation plan — superseded for visible GA4 Recent Movement:

The plan below predates the certified exact-date GA4 comparison paths. It is
retained only as a possible future validation recipe for generic non-GA4
aggregate snapshot history and the disabled legacy Metric Trends path. It is
not an outstanding Performance Summary certification gate.

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
- Validate `Metric Trends` by opening `/api/campaigns/:id/snapshots?period=daily`, `/api/campaigns/:id/snapshots?period=weekly`, or `/api/campaigns/:id/snapshots?period=monthly` and confirming visible chart points come only from snapshots whose `metrics.performanceSummary.version` is `performance_summary_aggregate_v2`.
- Expected GA4-only UI behavior: sessions, users, conversions, revenue, and campaign spend can appear when available; impressions and clicks should not appear unless a connected paid-media source provides them.

### Commit 6: Docs And Final Validation

Historical status: completed for exact certified runtime `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`; evidence-only commit `e175ac5c1764d06c199b375be45ace718b2fc785` was deployed and user-confirmed without changing production runtime code. This historical statement does not certify current deployed runtime `1e066496`.

Goal:

- Finalize documentation and prove the full Performance Summary section is production ready.

Scope:

- Updated `ARCHITECTURE_USER_JOURNEY.md`, the campaign KPI/Benchmark contract, the relevant GA4 functional docs, and this tracker to describe the cumulative current-value and exact-date comparison contracts.
- The historical readiness decision combined the focused regression, TypeScript, production-build, protected GA4 revalidation, deployed exact-value, and UI evidence recorded for that exact runtime; it was not inferred from documentation changes alone.
- Production code, protected GA4 tests, validators, and machine certification records remain unchanged by this documentation reconciliation.

Why this is last:

- Documentation should match the implemented behavior, and final validation should cover all previously changed paths together.

## Comprehensive Source Readiness Review

Last reviewed against deployed runtime `1e066496` on 2026-09-29.

Root cause:

- The original Performance Summary implementation mixed tab-local calculations with source-specific queries. That made some UI values correct only for the sources each tab happened to know about.
- The current source of truth is now `/api/campaigns/:id/outcome-totals`, which returns `performanceSummary`.
- `performanceSummary` is built by `server/utils/performance-summary-aggregate.ts`.
- Native aggregate adapters cover GA4, LinkedIn, Meta, and Custom Integration. The current route also registers eligible Google Ads, Instagram, TikTok, and Google Sheets main-platform source objects through the generic `platformSources` contract. These are conditional code paths; Instagram and TikTok were not configured for Campaign3 and are outside the deployed Campaign3 value reconciliation.
- GA4 child revenue/spend inputs such as Salesforce, HubSpot, Shopify, CSV, and Google Sheets imports can feed campaign financial totals through the parent platform or campaign financial-source path. They are not main Connected Platforms, users do not connect them from the campaign `Connected Platforms` section, and they must not appear as main source rows.
- A GA4-scoped Google Ads spend-only connection is likewise a financial child input; it does not become the separate main Google Ads Connected Platform source.

Tab-by-tab source status:

- Key Outcomes: for a live GA4 campaign, Users, Sessions, and Conversions use aligned GA4 Summary totals; Revenue uses exact-cutoff native plus imported Revenue; Spend must reconcile the exact-cutoff `spend-to-date` response with `performanceSummary.totals.spend`. The page withholds affected values when the shared cutoff or timezone is incompatible.
- Campaign Health and Top Priority Action: use the full configured campaign KPI/Benchmark inventory, resolve supported current values from the aligned live inputs, and fail closed when any configured metric cannot be scored. Financial child sources contribute to aggregate values without becoming main source rows.
- Recent Movement: renders Sessions, Conversions, Spend, and Total Revenue for the previous completed day, seven completed days earlier, or the previous-month cutoff. Sessions and Conversions use the exact GA4 daily boundary. Spend and imported Revenue require supported dated active sources and compatible source identity; native Revenue requires compatible GA4 property, metric, and currency. The last settled cards stay visible while a new comparison loads. The legacy Metric Trends render path remains disabled.
- Recommended Actions: reuses the verified scoring inputs and target policies, emits at most three deduplicated target-gap actions, uses campaign currency for Revenue and CPA, and avoids causal claims.

Automatic aggregation status:

- Implemented aggregate registration paths: native adapters for GA4, LinkedIn, Meta, and Custom Integration; generic `platformSources` registration for eligible Google Ads, Instagram, TikTok, and Google Sheets main connections.
- Implemented child-source behavior: GA4/platform child revenue and spend inputs can feed financial totals only through the parent platform/campaign financial path, without appearing as main Connected Platforms and without requiring duplicate Campaign DeepDive inputs.
- Future main Connected Platforms are supported by the generic `platformSources` contract. Each platform still needs its own campaign-scoped resolver; once that resolver supplies a valid source breakdown, the visible Performance Summary sections consume it through the existing aggregate contract.

Implementation conclusion:

- Implemented in the aggregate route for the registered main Connected Platform paths listed above, with campaign financial totals able to include parent-platform child revenue/spend inputs when configured inside the relevant platform flow. Regression and production-readiness evidence remains source-specific and must not be inferred merely from registration.
- The aggregate layer can accept future standalone platforms that supply valid `platformSources`, but that capability is not source-specific production-readiness proof.
- Platform-specific production readiness for Google Ads, TikTok, Instagram, Google Sheets, and future sources still depends on each platform's own connection, storage, refresh, campaign scoping, resolver, and negative-case validation.
- Historical production-readiness evidence remains bounded to the exact runtimes and scopes in their certificate records. Deployed runtime `1e066496` has the bounded Campaign3 evidence recorded above and remains `RECERTIFICATION_PENDING` for the whole Performance Summary section.

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

**Deployed runtime `1e066496`: `BOUNDED CAMPAIGN3 PASS / RECERTIFICATION_PENDING`. The configured Campaign3 `2026-09-28` current view and all three Recent Movement options are reconciled; the whole section is not recertified.**

The latest preserved clean certificate remains `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md` for exact deployed runtime `ee6e11ebf8cb0a13dd182dde54af790a3757ef2f` and its recorded boundary. Earlier exact-runtime evidence, including `12789c1e`, remains historical only.

Implemented and locally regression-covered in the current revision:

- the consolidated visible Performance Summary sections use the cumulative current-value and exact-date Recent Movement contracts in `Current Controlling Implementation Contract`
- Key Outcomes, Campaign Health, Top Priority Action, Recommended Actions, and the four Recent Movement cards are covered by the focused current regression packet; exact deployed `1e066496` has bounded Campaign3 UI/API evidence for the current view and all three Recent Movement selections
- Campaign Health fails closed rather than scoring only a verified subset; Top Priority uses configured KPI priority before gap severity; Recommended Actions use verified target gaps and do not claim causality
- current exact-date logic for Sessions, Conversions, Spend, and Total Revenue is regression-covered and deployed Campaign3 UI/API reconciled for the previous completed day, seven completed days earlier, and the previous-month cutoff
- GA4 child revenue/spend inputs remain financial provenance under the parent campaign/platform path and do not become separate main Connected Platforms

Supporting aggregate behavior proven locally, but not a broader deployed source-mix certification:

- the adapter/generic-source aggregate contract and scheduler snapshot alignment for the registered source shapes covered by the focused aggregate and scheduler regressions
- fail-closed unavailable/zero handling, source capability checks, and financial ratio input guards covered by those regressions

Not certified by this boundary:

- any source mix other than the recorded deployed GA4-only configuration unless that exact mix has its own source-specific readiness evidence
- Instagram and TikTok values, because neither source was configured for Campaign3 in the current deployed evidence
- future or differently configured Google Ads, TikTok, Instagram, LinkedIn, Meta, Custom Integration, Google Sheets, or other main-platform resolver/provider behavior
- the retained manual/legacy snapshot route as a visible UI feature; no current frontend caller was found and the route remains campaign-access guarded
- the disabled legacy Metric Trends render path
- Trend Analysis, Budget & Financial Analysis, Platform Comparison, Executive Summary, Custom Report generation/delivery, and their independent certification boundaries
- provider behavior, source configuration, or runtime dependencies changed after the exact certified boundary without a new Performance Summary revalidation

## 2026-07-30 Current Commit 10 Status — Closed For Bounded Packet

Root cause: scheduler snapshots used 90-day GA4 financial values while Overview/current-value consumers used the ordered connected-source financial contract, and ROAS/ROI incorrectly required positive revenue. Commit `ec265895` deployed the shared full financial selector reuse, GA4-scoped persisted financial values, valid zero/negative revenue handling, and `performance_summary_aggregate_v2`; dynamic version comparison prevents v1 history from mixing with corrected values. On existing campaign `GA4 single` / `ga4_mock`, Performance Summary Total Spend matched GA4 Overview Total Spend. The historical packet did not include a Total Revenue card; the current UI now renders Total Revenue in Key Outcomes and Recent Movement under the controlling contract above. The bounded Commit 10 packet is closed; scheduler-snapshot, historical, live multi-source, and zero/negative production-fixture proof remain external.
