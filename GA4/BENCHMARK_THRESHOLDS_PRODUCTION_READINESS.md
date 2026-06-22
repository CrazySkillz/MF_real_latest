# GA4 Benchmark Thresholds Production Readiness

## Purpose

This file tracks the plan to refine GA4 Benchmark performance thresholds so benchmark scoring is reliable enough for executive use.

This is a planning file only. It does not change current behavior.

## Current Root Cause

GA4 Benchmark scoring currently uses one generic attainment model for all benchmark types:

- `On Track`: current performance is `90%` or more of the benchmark
- `Needs Attention`: current performance is `70%` to under `90%` of the benchmark
- `Behind`: current performance is below `70%` of the benchmark

The primary GA4 implementation path is:

- `client/src/pages/ga4-metrics.tsx`
  - `computeBenchmarkProgress`
  - `benchmarkTracker`
  - Benchmark summary cards
  - Benchmark card progress and status
  - GA4 report benchmark rows
- `GA4/BENCHMARKS.md`
  - documents the same `90% / 70%` status model

Related benchmark status paths also exist outside the live GA4 card path:

- `server/routes-oauth.ts`
  - campaign/platform benchmark evaluation paths
  - Campaign DeepDive Executive Summary benchmark comparison
- `server/ga4-kpi-benchmark-jobs.ts`
  - background benchmark variance and rating
- `client/src/pages/executive-summary.tsx`
  - Executive Summary Benchmark Comparison
- `client/src/pages/reports.tsx`
  - Campaign DeepDive Custom Report benchmark risk/output
- `server/report-scheduler.ts`
  - scheduled Campaign DeepDive benchmark risk output
- `server/ga4-cross-tab-consistency.test.ts`
  - tests currently encode the `90% / 70%` model

The current model is internally coherent on the GA4 Benchmark tab because the tracker and benchmark cards both use `computeBenchmarkProgress`.

The weakness is that the same generic `90% / 70%` thresholds are applied to counts, rates, revenue, ratios, and lower-is-better cost benchmarks.

## Why The Current Model Is Not Production-Perfect

The current model is logical as a broad benchmark-attainment signal, but not robust enough as the only executive benchmark health model.

Examples:

- `Conversions` benchmark `10`, current `9` is `On Track`, which is reasonable; but `Conversions` benchmark `1`, current `0` is `Behind`, which is also reasonable. The current model only reaches this result accidentally through percentages, not through explicit low-volume count policy.
- `Users` benchmark `1000`, current `890` is `Needs Attention`, while `Conversions` benchmark `10`, current `9` is `On Track`; both are close misses but the generic model gives different interpretation based only on relative percentage.
- `Conversion Rate` benchmark `5%`, current `4.8%` is `On Track`, but the status may be misleading when sessions are unavailable or too low.
- `Revenue` benchmark `100000`, current `95000` is `On Track`, which can be acceptable, but the tolerance is not explicit and not shared with other surfaces.
- `CPA` direction is handled in GA4 only by checking whether the metric is `cpa`; future lower-is-better benchmark metrics such as `CPC`, `CPM`, `CPL`, or custom cost benchmarks can be misclassified.
- Executive Summary and report paths contain their own benchmark status logic, so benchmark status can drift as fixes are made to only one surface.
- The background benchmark job computes variance and rating separately from live card status, so daily history/rating semantics are not guaranteed to match live benchmark status.

## Production-Ready Target Behavior

Benchmark scoring should use metric-aware tolerance while preserving the current user journey:

- Benchmark cards still show `On Track`, `Needs Attention`, and `Behind`.
- The executive tracker still summarizes those same statuses.
- Blocked benchmarks remain excluded from scoring.
- Invalid or zero benchmark values remain unscored.
- `Avg. Progress` remains bounded to `0%` to `100%` per benchmark.
- Benchmark grid status, tracker counts, report output, and Executive Summary output must agree for the same benchmark.
- Lower-is-better benchmark metrics must keep correct direction.
- Data-insufficient benchmarks must not be classified as healthy or weak performance.
- No API response shape should change unless explicitly required by the implementation step.

The intended model is:

- keep the existing three benchmark labels
- use shared benchmark math for status, progress, fill percentage, and direction
- derive status from effective performance versus benchmark:
  - positive effective delta means better than benchmark
  - near-zero effective delta means near the benchmark
  - negative effective delta means below the benchmark
- make the `On Track` tolerance metric-aware
- keep a separate `Behind` threshold for material misses
- classify misses between `On Track` tolerance and `Behind` threshold as `Needs Attention`

## Proposed Benchmark Threshold Policy

### 1. Count Benchmarks

Examples:

- `Conversions`
- `Users`
- `Sessions`
- `Pageviews`
- custom benchmarks with unit `count`

Use count-aware `On Track` tolerance so small normal misses are not over-penalized, while tiny targets still require meaningful results.

Draft policy:

- benchmark below `5`: exact benchmark required for `On Track`
- benchmark `5` to `19`: allow `1` count below benchmark for `On Track`
- benchmark `20+`: allow the greater of `5%` of benchmark or `1` count for `On Track`
- `Behind` should remain a material miss, with a default floor around `70%` of benchmark unless the low-volume count policy makes the miss clearly severe

Examples:

- benchmark `10`, current `9` should be `On Track`
- benchmark `1`, current `0` should be `Behind`
- benchmark `100`, current `96` should be `On Track`
- benchmark `100`, current `80` should be `Needs Attention`
- benchmark `100`, current `60` should be `Behind`

### 2. Rate Benchmarks

Examples:

- `Conversion Rate`
- `Engagement Rate`
- custom benchmarks with unit `%`

Use both relative tolerance and absolute percentage-point tolerance for `On Track`, but require denominator sufficiency where the denominator is known.

Draft policy:

- `On Track` if within `5%` relative to benchmark
- also `On Track` if within `0.25` percentage points for normal rate benchmarks
- `Needs Attention` for moderate misses below the `On Track` tolerance
- `Behind` for material misses, with a default floor around `70%` of benchmark
- block or mark insufficient when the known denominator is unavailable

Examples:

- benchmark `5.0%`, current `4.8%` should be `On Track` when sessions are available
- benchmark `5.0%`, current `3.8%` should be `Needs Attention`
- benchmark `5.0%`, current `2.5%` should be `Behind`
- benchmark `Conversion Rate` with `0` sessions should be `Insufficient data`, not `Behind`

### 3. Revenue And Currency Benchmarks

Examples:

- `Revenue`
- custom benchmarks with campaign currency unit

Use relative tolerance for `On Track`.

Draft policy:

- default `On Track` tolerance remains around `5%`
- moderate misses become `Needs Attention`
- material misses below roughly `70%` of benchmark become `Behind`
- do not silently ignore large absolute misses

Examples:

- benchmark `100000`, current `95000` should be `On Track`
- benchmark `100000`, current `80000` should be `Needs Attention`
- benchmark `100000`, current `60000` should be `Behind`

### 4. Ratio And Efficiency Benchmarks

Examples:

- `ROAS`
- `ROI`

Use relative tolerance while preserving the metric's unit meaning.

Draft policy:

- `ROAS` is a ratio, not a percent
- `ROI` is a percent
- default `On Track` tolerance remains around `5%`
- moderate misses become `Needs Attention`
- material misses become `Behind`

### 5. Lower-Is-Better Cost Benchmarks

Examples:

- `CPA`
- `CPC`
- `CPM`
- `CPL`
- custom cost benchmarks configured as lower-is-better

Use the same benchmark policy, but invert direction.

Draft policy:

- current below benchmark by more than tolerance remains `On Track`
- current within tolerance remains `On Track`
- current above benchmark by a moderate amount becomes `Needs Attention`
- current above benchmark by a material amount becomes `Behind`

Examples:

- `CPA` benchmark `100`, current `95` should be `On Track`
- `CPA` benchmark `100`, current `105` should be `On Track`
- `CPA` benchmark `100`, current `125` should be `Needs Attention`
- `CPA` benchmark `100`, current `150` should be `Behind`

### 6. Data Sufficiency

Some benchmark classifications should be blocked or marked unscored when the data is too thin to support a reliable executive signal.

Examples:

- conversion rate with no sessions
- engagement rate with no sessions
- CPA with no conversions
- ROAS or ROI with no spend

Draft behavior:

- keep missing dependencies as `blocked`
- add benchmark-specific `insufficient_data` only where the denominator is known and unavailable
- exclude blocked and insufficient-data benchmarks from `On Track`, `Needs Attention`, `Behind`, and `Avg. Progress`
- show the reason on the Benchmark card instead of showing a misleading status

## Implementation Strategy

### Commit 1 - Add Shared Benchmark Policy Types And Tests

Goal:

- add shared benchmark threshold functions without wiring them into UI behavior yet

Files:

- `shared/kpi-math.ts` or a narrowly scoped shared benchmark math file if the final implementation needs separation
- focused unit tests for benchmark math

Expected changes:

- add a `BenchmarkThresholdPolicy` or equivalent internal type
- add a helper that resolves benchmark tolerance from metric name, unit, benchmark value, current value, and direction
- add a helper that classifies `on_track`, `needs_attention`, and `behind`
- reuse existing lower-is-better helpers where possible
- preserve existing KPI behavior

Tests:

- generic `90% / 70%` compatibility where explicitly requested
- count benchmark `10`, current `9`
- count benchmark `1`, current `0`
- rate benchmark `5`, current `4.8`
- revenue benchmark `100000`, current `95000`
- ROAS benchmark near miss
- ROI benchmark material miss
- CPA benchmark `100`, current `105`
- CPA benchmark `100`, current `150`

Validation:

- focused benchmark math tests
- `npm run check`

Status:

- Completed in commit `e07f53bc` (`Add shared benchmark threshold policy`).
- Validation passed locally with `npm test -- server/benchmark-math.test.ts server/kpi-math.test.ts server/metric-math.test.ts server/ga4-cross-tab-consistency.test.ts` (`141` tests passed).
- `npm run check` passed.
- Commit 1 intentionally did not wire GA4 UI, reports, Executive Summary, or scheduler paths to the shared benchmark policy.

### Commit 2 - Wire GA4 Benchmark Tab To Shared Policy

Goal:

- replace the GA4 tab's fixed `90% / 70%` benchmark status behavior with shared metric-aware benchmark scoring

Files:

- `client/src/pages/ga4-metrics.tsx`
- GA4 benchmark regression tests

Expected changes:

- `computeBenchmarkProgress` calls the shared benchmark resolver/classifier
- benchmark cards and tracker continue to use the same returned status
- card labels are updated so they no longer imply one generic threshold for every benchmark type
- keep `Avg. Progress` bounded
- keep blocked benchmark behavior unchanged

Validation:

- focused GA4 benchmark tests
- UI/static regression guard for tracker labels and counts
- `npm run check`

### Commit 3 - Add Benchmark Data Sufficiency Gating

Goal:

- prevent thin benchmark data from being classified as healthy or weak performance when the denominator is unavailable

Files:

- `client/src/pages/ga4-metrics.tsx`
- shared benchmark math helpers
- GA4 benchmark tests

Expected changes:

- conversion rate and engagement rate consider sessions
- CPA considers conversions and spend
- ROAS/ROI consider spend and revenue dependency state
- insufficient-data benchmarks are excluded from tracker scoring and average progress

Validation:

- tests for insufficient sessions, conversions, and spend
- verify blocked and insufficient-data benchmarks do not inflate or reduce summary counts
- `npm run check`

### Commit 4 - Align Reports, Executive Summary, And Background Paths

Goal:

- ensure every GA4/campaign benchmark surface uses the same classification result

Files to trace before editing:

- `client/src/pages/ga4-metrics.tsx`
- GA4 report generation paths
- `server/routes-oauth.ts`
- `server/ga4-kpi-benchmark-jobs.ts`
- `client/src/pages/executive-summary.tsx`
- `client/src/pages/reports.tsx`
- `server/report-scheduler.ts`

Expected changes:

- reports should not calculate Benchmark status differently from the GA4 Benchmark grid
- Executive Summary Benchmark Comparison should use the same shared helper when it displays benchmark state
- scheduled report benchmark-risk output should not conflict with live status
- background benchmark ratings should either use the shared status or document exactly how rating differs from live status
- no duplicate benchmark threshold constants should remain in GA4 downstream surfaces

Validation:

- focused GA4 report tests
- Executive Summary Benchmark Comparison tests
- scheduler/static report tests where reachable
- `npm run check`

### Commit 5 - Documentation And Manual Validation

Goal:

- make the new Benchmark threshold model understandable and testable

Files:

- `GA4/BENCHMARKS.md`
- this readiness file
- `GA4/README.md` only if it is clean or the change is explicitly coordinated with existing dirty work

Expected changes:

- replace generic `90% / 70%` wording with metric-aware threshold wording
- document count, rate, revenue, ratio, and lower-is-better behavior
- document insufficient-data behavior
- add validation examples marketing teams can understand

Validation:

- documentation review against code
- manual validation with at least:
  - count benchmark
  - rate benchmark
  - revenue benchmark
  - ROAS/ROI benchmark
  - CPA benchmark
  - custom benchmark

## Acceptance Criteria

The benchmark threshold implementation is not production-ready until all of these are true:

- Benchmark grid status and executive snapshot counts always match.
- Count benchmarks do not over-penalize one-unit misses on normal benchmark values.
- Tiny benchmark values are not falsely treated as healthy when the campaign produced no meaningful result.
- Rate benchmarks handle both relative gaps and percentage-point gaps.
- Lower-is-better benchmarks classify direction correctly for `CPA`, `CPC`, `CPM`, `CPL`, and relevant custom cost benchmarks.
- Blocked and insufficient-data benchmarks are excluded from scoring.
- `Avg. Progress` remains bounded to `0%` to `100%`.
- Reports, Executive Summary, scheduler output, and background benchmark history do not use a conflicting threshold model.
- Tests cover each benchmark type and edge case listed above.

## Proven, Partially Reviewed, And Unverified

Proven from local code:

- GA4 Benchmark cards and tracker currently use a fixed `90% / 70%` status model.
- The GA4 card and tracker use the same `computeBenchmarkProgress` helper.
- GA4 benchmark lower-is-better direction currently checks only `CPA`.
- Blocked benchmarks are excluded from tracker scoring.
- `Avg. Progress` uses bounded progress percentage.
- Campaign/executive/report/server paths also contain benchmark status or risk logic based on `90% / 70%` or `70%` benchmark thresholds.

Partially reviewed:

- Scheduled Campaign DeepDive report output includes benchmark risk wording, but live scheduled email/PDF behavior has not been validated for this benchmark threshold change.
- Other platform pages also contain similar benchmark thresholds; they are intentionally out of scope for the first GA4-specific plan unless a later implementation step explicitly broadens scope.

Not locally verified:

- Live executive behavior with real mixed benchmark sets.
- Downloaded report PDF output with live benchmark rows.
- Scheduled email output with live benchmark rows.
- Whether users expect custom per-benchmark tolerance controls.
- Whether industry-specific benchmark thresholds should vary by campaign category or metric source.
