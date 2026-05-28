# Campaign DeepDive Custom Report Production-Ready Tracker

## Purpose

Track the work required to make the Campaign DeepDive `Custom Report` subsection production-ready.

This tracker exists so Custom Report follows the same connected-source aggregate pattern as:

- Performance Summary
- Budget & Financial Analysis
- Platform Comparison
- Trend Analysis
- Executive Summary

## Current Status

Not production-ready as a Campaign DeepDive connected-source aggregate consumer.

Custom Report currently behaves as a campaign-level reporting launcher, but the implementation path still points users to the global `/reports` page and several report-generation paths are platform-specific. That means Custom Report does not yet reliably use only metrics that are available from the campaign's main Connected Platforms.

## Required Product Rule

Connected Platforms is the source of truth.

Custom Report must use metrics from the campaign's connected main sources only. If only Google Analytics is connected, Custom Report should expose and render only GA4-supported web analytics and outcome metrics. Paid-media metrics must remain unavailable unless a main paid-media Connected Platform supplies them.

## Root Cause

1. The Campaign DeepDive `Custom Report` launcher currently links to `/reports`, which is a global reports page, not a campaign-scoped connected-source report builder.
2. Existing report builders are platform-specific:
   - GA4 reports use GA4-specific report inputs.
   - LinkedIn reports use LinkedIn-specific hardcoded metric lists.
   - Some global report UI uses local/mock report storage.
3. Custom Report metric selection is not currently driven by the shared connected-source aggregate contract.
4. Selected report metrics can include metrics unavailable from the campaign's connected sources.
5. Some report output paths can fall back to `0`, `N/A`, or platform defaults instead of excluding unavailable metrics or explaining why they are unavailable.

## Source-Of-Truth Contract

Custom Report should consume the same shared aggregate used by the other Campaign DeepDive subsections:

- `/api/campaigns/:campaignId/outcome-totals`
- `performanceSummary.sources`
- `performanceSummary.totals`
- source `includedMetrics`
- source `excludedMetrics`
- source category, identity, label, and freshness metadata

Custom Report must not infer metrics from disconnected platforms.

## Metric Availability Rules

For GA4-only campaigns, Custom Report may use:

- users
- sessions
- pageviews, where available
- conversions
- revenue, where available
- CVR when conversions and sessions are available

For paid-media metrics, Custom Report requires a connected main paid-media source:

- impressions
- clicks
- spend
- CTR
- CPC
- CPM
- CPA
- ROAS, when spend and revenue are available
- ROI, when spend and revenue are available

Financial child sources can contribute to aggregate financial totals, but they must not appear as separate main Connected Platforms.

## Implementation Plan

### Commit 1: Campaign-Scoped Entry Point

Goal:

- Make the Campaign DeepDive `Custom Report` launcher preserve campaign context.

Tasks:

- Trace the current `/reports` caller from Campaign DeepDive.
- Replace the global-only launcher behavior with a campaign-scoped Custom Report entry path or campaign-scoped builder mode.
- Ensure the builder has the active `campaignId`.
- Preserve existing global Reports behavior outside Campaign DeepDive unless the current caller proves it must change.

Validation:

- From a campaign, opening Custom Report retains the campaign ID.
- Global Reports remains reachable and unchanged unless explicitly touched.

Status:

- [x] Completed locally: Campaign DeepDive now opens `/reports?campaignId=<campaignId>`.
- [x] Completed locally: Reports initializes and persists `campaignId` when launched from Campaign DeepDive.
- [x] Completed locally: global `/reports` route remains unchanged.
- [x] User validation passed on 2026-05-28: Campaign DeepDive Custom Report opens with `campaignId` in the URL.

### Commit 2: Shared Aggregate Input

Goal:

- Make Custom Report read the same connected-source aggregate as the other Campaign DeepDive subsections.

Tasks:

- Fetch `/api/campaigns/:campaignId/outcome-totals` for campaign-scoped Custom Report.
- Use `performanceSummary.sources` and `performanceSummary.totals` to determine available current metrics.
- Keep response shapes stable.

Validation:

- GA4-only campaign response contains `ga4` as the main source.
- Disconnected paid-media sources do not appear as available report sources.
- Financial child sources do not appear as separate main platform rows.

Status:

- [x] Completed locally: campaign-scoped Reports fetches `/api/campaigns/:campaignId/outcome-totals?dateRange=90days`.
- [x] Completed locally: available Custom Report sources are derived from `performanceSummary.sources`.
- [x] Completed locally: available Custom Report metrics are derived from `performanceSummary.totals`.
- [x] Completed locally: financial child sources are excluded from the visible main source list.

### Commit 3: Metric Picker Availability Gating

Goal:

- Only show selectable metrics that are available from connected sources.

Tasks:

- Build available metric groups from aggregate metric availability.
- Hide or disable paid-media metrics when no paid-media source provides them.
- Show unavailable reasons where useful.
- Ensure GA4-only Custom Report does not offer impressions, clicks, spend, CTR, CPC, CPM, CPA, paid-media ROAS, or paid-media recommendations unless a capable source exists.

Validation:

- GA4-only Custom Report picker shows GA4/web outcome metrics only.
- Paid-media metrics appear after a capable main paid-media source is connected and included in the aggregate.

### Commit 4: Report Output Uses Aggregate Values

Goal:

- Generated Custom Report output should render from live connected-source aggregate values.

Tasks:

- Replace report-only or platform-hardcoded metric lookups with aggregate-backed values for campaign-wide Custom Report output.
- Do not render unavailable metrics as `0`.
- If a saved report config includes a now-unavailable metric, omit it or mark it unavailable with the aggregate reason.

Validation:

- GA4-only generated Custom Report output contains only GA4-supported metrics.
- Paid-media-only metrics do not appear for GA4-only campaigns.
- Saved custom report config cannot force disconnected-source metrics into output.

### Commit 5: KPI, Benchmark, And Section Mapping

Goal:

- Make Custom Report sections align with campaign-level analytics.

Tasks:

- KPI and Benchmark report sections should use campaign records for rows/targets.
- Current KPI/Benchmark values should come from aggregate-backed available metrics where mapped.
- Unmapped or unavailable current values should not silently fall back to stale saved values.
- Custom sections should remain section-composition based.

Validation:

- KPI/Benchmark rows update after campaign KPI/Benchmark changes and refetch.
- Current values match the connected-source aggregate where available.

### Commit 6: Regression Coverage

Goal:

- Guard the connected-source Custom Report pattern.

Required tests:

- GA4-only Custom Report excludes paid-media metrics.
- Paid-media metrics appear only when a connected main paid source provides them.
- Financial child sources do not appear as main platforms.
- Saved custom report config cannot force unavailable metrics into output.
- Campaign-scoped Custom Report uses the active campaign ID.
- Global Reports behavior is not accidentally changed.

### Commit 7: Documentation And Final Validation

Goal:

- Mark Custom Report production-ready only after implementation and validation evidence is complete.

Tasks:

- Update `ARCHITECTURE_USER_JOURNEY.md`.
- Update `GA4/README.md`.
- Update this tracker with completed fixes, validation, and remaining source-specific boundaries.

Validation:

- Targeted regression tests pass.
- `npm run check` passes.
- `npm run build` passes.
- User validates GA4-only Custom Report behavior from Campaign DeepDive.

## Production-Ready Definition

Custom Report is production-ready when:

- it opens in campaign context from Campaign DeepDive
- it uses the shared connected-source aggregate contract
- metric selection is based on available connected-source metrics
- report output renders only available metrics
- unavailable metrics are omitted or clearly explained
- KPI/Benchmark sections use live aggregate-backed current values
- saved report configuration cannot reintroduce disconnected-source metrics
- regression coverage guards GA4-only and future paid-media source scenarios
- documentation matches the implemented behavior

## Outstanding Tasks

- [x] Commit 1: Campaign-scoped entry point
- [x] Commit 2: Shared aggregate input
- [ ] Commit 3: Metric picker availability gating
- [ ] Commit 4: Report output uses aggregate values
- [ ] Commit 5: KPI, Benchmark, and section mapping
- [ ] Commit 6: Regression coverage
- [ ] Commit 7: Documentation and final validation

## Separate Source Work

Google Ads and other future integrations must still prove their own Connected Platforms source-level correctness before their metrics are trusted in Custom Report.

This tracker future-proofs Custom Report as an aggregate consumer. It does not make an unfinished source integration production-ready by itself.

## Validation Evidence

- Commit 1 local regression guard added in `server/custom-report-regression.test.ts`.
- Commit 1 user validation passed on 2026-05-28.
- Commit 2 local regression guard added in `server/custom-report-regression.test.ts`.
