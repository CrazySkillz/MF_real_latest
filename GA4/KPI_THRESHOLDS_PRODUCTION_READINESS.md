# GA4 KPI Thresholds Historical Readiness Record

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.
> HISTORICAL THRESHOLD-SLICE RECORD ONLY.
> Do not use this file to answer whether the GA4 `KPIs` tab is production-ready.
> Use `GA4/KPIS_PRODUCTION_READINESS.md` for the durable whole-tab production-readiness answer.
> Current durable whole-tab answer: GA4 KPIs are production-ready for the current GA4 code scope.

## Purpose

This file preserves the completed GA4 KPI threshold/scoring policy evidence for future reference and future-platform replication.

It is not the canonical whole-tab readiness source. `GA4/KPIS.md` defines what the tab does, and `GA4/KPIS_PRODUCTION_READINESS.md` defines whether the whole GA4 KPI tab is production-ready.

## Root Cause Of Documentation Confusion

The confusion came from having three KPI files with overlapping readiness language:

- `GA4/KPIS.md` is the functional contract for what the tab does.
- `GA4/KPIS_PRODUCTION_READINESS.md` is the canonical whole-tab production-readiness source of truth.
- this file is only the historical threshold/scoring slice record.

This file must not override, narrow, or reopen the durable whole-tab production-ready answer in `GA4/KPIS_PRODUCTION_READINESS.md`.

## How To Reuse This Threshold Slice For A New Source

Use this file only after reading `GA4/KPIS.md` and `GA4/KPIS_PRODUCTION_READINESS.md`.

For Meta, Google Ads, LinkedIn, Google Sheets, or another future source:

- copy the metric-aware threshold policy categories only when the target source has the same metric meaning and unit semantics
- prove lower-is-better behavior, low-volume handling, invalid-target handling, and insufficient-data handling in the target platform's own readiness file
- prove the target platform's current-value UI path, persisted recompute path, scheduler path, alerts, ownership checks, delete behavior, report consumers, and existing-data cleanup separately

Do not use this file as proof that any future platform's KPIs are production-ready.

## Original Root Cause

The GA4 KPI tracker originally used one fixed tolerance for all KPI types:

- `Above Target`: more than `+5%` better than target
- `On Track`: within `+/-5%` of target
- `Below Target`: more than `-5%` worse than target

The implementation path is:

- `client/src/pages/ga4-metrics.tsx`
  - `NEAR_TARGET_BAND_PCT = 5`
  - `computeKpiProgress`
  - `kpiTracker`
  - KPI summary cards
- `shared/kpi-math.ts`
  - `computeEffectiveDeltaPct`
  - `classifyKpiBand`
  - `computeAttainmentPct`
  - `isLowerIsBetterKpi`

The helper already handled lower-is-better KPIs such as `CPA` by flipping the direction before banding.

The weakness was that the same `+/-5%` tolerance was applied to counts, revenue, rates, ratios, and costs.

## Why The Original Fixed-Band Model Was Not Production-Perfect

The original model was simple and coherent, but not robust enough as the only executive KPI health signal.

Examples:

- `Conversions` target `10`, current `9` is classified as `Below Target` because it is `10%` below, even though it is only one conversion short.
- `Users` target `1000`, current `951` is `On Track`, while `Conversions` target `10`, current `9` is `Below Target`; both are close misses, but the low-volume count is punished more harshly.
- `Conversion Rate` target `5%`, current `4.8%` is `On Track` because it is `4%` below target, but the underlying session/conversion volume may be too small to trust.
- `Revenue` target `100000`, current `95000` is exactly `5%` below and stays `On Track`; this may be acceptable, but the rule should be explicit and metric-aware.
- `CPA` direction is handled, but the tolerance is still generic and may be too strict or too loose depending on spend and conversion volume.

## Threshold-Slice Target Behavior

KPI scoring should use metric-aware tolerance while preserving the existing user journey:

- KPI cards still show `Above Target`, `On Track`, and `Below Target`.
- Blocked KPIs remain excluded from scoring.
- Invalid or zero targets remain unscored.
- `Avg. Progress` remains bounded to `0%` to `100%` per KPI.
- KPI grid status and executive tracker counts must always agree.
- Lower-is-better KPIs must keep correct direction.
- No API response shape should change unless explicitly required later.

The intended model is:

- use shared math in `shared/kpi-math.ts`
- keep one source of truth for KPI banding
- make tolerance policy depend on metric type, unit, and data sufficiency
- avoid hard-coded UI-only rules that can drift from reports or Executive Summary

## Threshold Policy Record

### 1. Count KPIs

Examples:

- `Conversions`
- `Users`
- `Sessions`
- custom KPIs with unit `count`

Use a combined absolute and relative tolerance.

Proposed rule:

- very small targets should be stricter, because missing all or most of a tiny target is meaningful
- normal count targets should allow a small absolute miss
- larger targets should use percentage tolerance

Draft policy:

- target below `5`: exact target required for `On Track`
- target `5` to `19`: allow `1` count below target
- target `20+`: allow the greater of `5%` of target or `1` count

Concrete large-count example:

- `Total Users` target `820`, current `779` is `On Track` because it is exactly within the `5%` count tolerance
- `Total Users` target `820`, current `769` is `Below Target` because the `6.2%` miss is outside the `5%` count tolerance

Above-target logic should mirror the same tolerance in the positive direction.

### 2. Rate KPIs

Examples:

- `Conversion Rate`
- `Engagement Rate`
- custom KPIs with unit `%`

Use both relative tolerance and absolute percentage-point tolerance.

Draft policy:

- on track if within `5%` relative to target
- also on track if within `0.25` percentage points for normal rate targets
- require minimum denominator checks where the denominator is known

Examples:

- target `5.0%`, current `4.8%` should be `On Track`
- target `1.0%`, current `0.8%` should not automatically pass only because the absolute gap is small; relative difference still matters

### 3. Revenue KPIs

Examples:

- `Revenue`
- custom KPIs with currency unit

Use relative tolerance, with optional minimum currency tolerance only for small targets.

Draft policy:

- default tolerance remains `5%`
- for small revenue targets, allow a small absolute tolerance based on campaign currency only if explicitly defined
- do not silently ignore large absolute misses

### 4. Ratio And Efficiency KPIs

Examples:

- `ROAS`
- `ROI`

Use relative tolerance unless a metric-specific standard is defined.

Draft policy:

- default tolerance remains `5%`
- keep exact direction: higher is better for `ROAS` and `ROI`
- do not compare ratio values as percentages unless the metric unit requires it

### 5. Lower-Is-Better Cost KPIs

Examples:

- `CPA`
- `CPC`
- `CPM`
- `CPL`
- spend-style custom KPIs when configured as lower-is-better

Use the same metric-aware policy, but direction is inverted.

Draft policy:

- current below target by more than tolerance = `Above Target`
- current within tolerance = `On Track`
- current above target by more than tolerance = `Below Target`

### 6. Data Sufficiency

Some KPI classifications should be blocked or marked unscored when the data is too thin to support a reliable executive signal.

Examples:

- conversion rate with very low sessions
- CPA with very low conversions
- ROAS with very low spend or zero spend

Draft behavior:

- keep missing dependencies as `blocked`
- add a separate `insufficient_data` reason only where a metric denominator is known and too small
- exclude insufficient-data KPIs from `Above Target`, `On Track`, `Below Target`, and `Avg. Progress`
- show the reason on the KPI card instead of showing a misleading status

## Implementation Strategy

### Commit 1 - Add Threshold Policy Types And Tests

Goal:

- add shared threshold policy functions without wiring them into UI behavior yet

Files:

- `shared/kpi-math.ts`
- focused unit tests for KPI math

Expected changes:

- add a `KpiThresholdPolicy` or similar internal type
- add a helper that resolves tolerance from metric name, unit, target, current, and direction
- preserve current `classifyKpiBand` behavior for callers that still pass a fixed tolerance
- add tests for:
  - generic `+/-5%`
  - count target `10`, current `9`
  - count target `1`, current `0`
  - rate target `5`, current `4.8`
  - revenue target `100000`, current `95000`
  - CPA target `100`, current `105`
  - CPA target `100`, current `95`

Validation:

- focused KPI math tests
- `npm run check`

Commit 1 status as of June 22, 2026:

- Implemented in `shared/kpi-math.ts` and `server/kpi-math.test.ts`.
- Automated validation passed with focused KPI math tests and `npm run check`.
- UI, manual GA4 page, report, Executive Summary, and scheduler validation were not required for Commit 1 because the helper was not wired into runtime callers yet.
- Commit 1 was later tightened so ROI/ROAS-style efficiency metrics resolve before percent-rate unit handling and campaign currency codes resolve as currency policy.

### Commit 2 - Wire GA4 KPI Tracker To Shared Policy

Goal:

- replace the GA4 tab's fixed `NEAR_TARGET_BAND_PCT = 5` behavior with shared metric-aware banding

Files:

- `client/src/pages/ga4-metrics.tsx`
- shared KPI math tests if needed
- GA4 KPI regression tests

Expected changes:

- `computeKpiProgress` calls the new shared resolver
- KPI grid and executive tracker continue to use the same returned band
- summary card labels are updated so they no longer claim every KPI uses fixed `+/-5%`
- keep `Avg. Progress` bounded

Validation:

- focused GA4 KPI tests
- UI regression guard for summary labels and counts
- `npm run check`

### Commit 3 - Add Data Sufficiency Gating

Goal:

- prevent thin data from being classified as strong or weak performance when the denominator is too low

Files:

- `client/src/pages/ga4-metrics.tsx`
- `shared/kpi-math.ts`
- GA4 KPI tests

Expected changes:

- add denominator-aware checks for KPIs where inputs are available
- conversion rate should consider sessions
- CPA should consider conversions and spend
- ROAS/ROI should consider spend and revenue dependency state
- insufficient-data KPIs are excluded from executive scoring

Validation:

- tests for insufficient sessions/conversions/spend
- verify blocked and insufficient-data KPIs do not inflate or reduce summary counts
- `npm run check`

Commit 3 status as of June 22, 2026:

- Implemented in `shared/kpi-math.ts`, `client/src/pages/ga4-metrics.tsx`, `server/kpi-math.test.ts`, and `server/ga4-kpi-benchmark-summary-regression.test.ts`.
- Automated validation passed with `npm test -- server/kpi-math.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/ga4-cross-tab-consistency.test.ts` and `npm run check`.
- Proven locally: insufficient sessions, conversions, and spend are excluded from GA4 KPI tracker scoring and card progress.
- External or future-platform validation notes: browser/manual edge validation on a live GA4 campaign with zero sessions, zero conversions, or zero spend.
- Validation note: manual/live UI validation is optional for Commit 3 because the implemented gating only blocks exact unavailable denominators; broader statistical sufficiency thresholds are not defined or implemented yet.

### Commit 4 - Align Reports And Executive Surfaces

Goal:

- ensure every KPI surface uses the same classification result

Files to trace before editing:

- `client/src/pages/ga4-metrics.tsx`
- GA4 report generation paths
- Campaign DeepDive KPI/Executive Summary paths
- scheduled report renderers

Expected changes:

- reports should not calculate KPI status differently from the GA4 KPI grid
- Executive Summary KPI progress should use the same shared helper when it displays KPI target state
- no duplicate threshold constants should remain in downstream surfaces

Validation:

- focused GA4 report tests
- Executive Summary KPI progress tests
- `npm run check`

Commit 4 status as of June 22, 2026:

- Implemented in `client/src/pages/executive-summary.tsx`, `client/src/pages/reports.tsx`, `server/executive-summary-regression.test.ts`, `server/custom-report-regression.test.ts`, and `server/ga4-kpi-benchmark-summary-regression.test.ts`.
- Automated validation passed with `npm test -- server/kpi-math.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/executive-summary-regression.test.ts server/custom-report-regression.test.ts`, `npm test -- server/ga4-cross-tab-consistency.test.ts`, and `npm run check`.
- Proven locally: Executive Summary KPI Progress and campaign-scoped Custom Report KPI status no longer use fixed `5%` or `95-105%` status checks.
- Historical partial-review notes: scheduled Campaign DeepDive report rendering was traced and did not emit `Above Target` / `On Track` / `Below Target` KPI status bands in the current path, so no scheduler code was changed.
- Manual validation note: Executive Summary KPI Progress not validated on this campaign because the section is hidden when no mapped campaign-level KPI rows are available.
- External or future-platform validation notes: browser UI rendering, downloaded PDF inspection, and scheduled email output with live campaign data.

### Commit 5 - Documentation And Manual Validation

Goal:

- make the new KPI threshold model understandable and testable

Files:

- `GA4/KPIS.md`
- `GA4/README.md` if adding this file to the doc map is still appropriate at implementation time
- manual validation notes

Expected changes:

- replace fixed `+/-5%` wording with metric-aware threshold wording
- document count, rate, revenue, ratio, and lower-is-better behavior
- document insufficient-data behavior
- add validation examples marketing teams can understand

Validation:

- documentation review against code
- manual validation with at least:
  - count KPI
  - rate KPI
  - revenue KPI
  - ROAS/ROI KPI
  - CPA KPI
  - custom KPI

Commit 5 status as of June 22, 2026:

- Implemented in `GA4/KPIS.md`, `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`, and `server/ga4-kpi-benchmark-summary-regression.test.ts`.
- `GA4/README.md` was not edited in this commit because it already had unrelated dirty worktree changes.
- Automated validation passed with `npm test -- server/kpi-math.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/executive-summary-regression.test.ts server/custom-report-regression.test.ts` and `npm run check`.
- Proven locally: the GA4 KPI doc no longer describes active KPI status as fixed `+/-5%`; it documents metric-aware count, rate, revenue/currency, ratio, lower-is-better, blocked, and insufficient-data behavior with validation examples.
- External or future-platform validation notes: manual browser validation for count, rate, revenue, ROAS/ROI, CPA, and custom KPI examples.

## Threshold-Slice Acceptance Criteria

The GA4 KPI threshold/scoring slice is complete for the current GA4 code scope. The completed implementation satisfies these criteria:

- KPI grid status and executive snapshot counts always match.
- Count KPIs do not over-penalize one-unit misses on normal targets.
- Tiny targets are not falsely treated as healthy when the campaign produced no meaningful result.
- Rate KPIs handle both relative gaps and percentage-point gaps.
- Lower-is-better KPIs classify direction correctly.
- Blocked and insufficient-data KPIs are excluded from scoring.
- `Avg. Progress` remains bounded to `0%` to `100%`.
- Reports and Executive Summary do not use a conflicting threshold model.
- Tests cover each KPI type and edge case listed above.

## Threshold-Slice Evidence And Notes

Proven from local code:

- GA4 KPI summary, GA4 report KPI rows, Executive Summary KPI Progress, and campaign-scoped Custom Report KPI status use shared metric-aware KPI banding.
- Shared KPI math handles count, rate, revenue/currency, ratio, generic, and lower-is-better cost policies.
- Blocked and insufficient-data KPIs are excluded from KPI summary scoring.
- `Avg. Progress` uses bounded fill percentage.

Historical partial-review notes:

- Scheduled Campaign DeepDive report rendering was traced for conflicting KPI status-band output, but no live scheduled PDF/email send was run.
- Broader campaign-level KPI tabs outside the GA4 and traced Campaign DeepDive surfaces were not refactored as part of this GA4 threshold sequence.

External or future-platform validation notes:

- Live executive behavior with real mixed KPI sets.
- Downloaded report PDF inspection with live KPI rows.
- Scheduled email output with live KPI rows.
- Whether users expect custom per-KPI tolerance controls.
- Whether industry-specific KPI thresholds should vary by campaign category.
