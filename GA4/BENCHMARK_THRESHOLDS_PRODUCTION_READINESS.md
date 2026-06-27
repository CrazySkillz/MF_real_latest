# GA4 Benchmark Thresholds Historical Readiness Record

> HISTORICAL THRESHOLD-SLICE RECORD ONLY.
> Do not use this file to answer whether the GA4 `Benchmarks` tab is production-ready.
> Use `GA4/BENCHMARKS_PRODUCTION_READINESS.md` for the durable whole-tab production-readiness answer.
> Current durable whole-tab answer: GA4 Benchmarks are production-ready for the current GA4 code scope.

## Purpose

This file preserves the completed GA4 Benchmark threshold/scoring policy evidence for future reference and future-platform replication.

It is not the canonical whole-tab readiness source. `GA4/BENCHMARKS.md` defines what the tab does, and `GA4/BENCHMARKS_PRODUCTION_READINESS.md` defines whether the whole GA4 Benchmark tab is production-ready.

## Root Cause Of Documentation Confusion

The confusion came from having three Benchmark files with overlapping readiness language:

- `GA4/BENCHMARKS.md` is the functional contract for what the tab does.
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md` is the canonical whole-tab production-readiness source of truth.
- this file is only the historical threshold/scoring slice record.

This file must not override, narrow, or reopen the durable whole-tab production-ready answer in `GA4/BENCHMARKS_PRODUCTION_READINESS.md`.

## How To Reuse This Threshold Slice For A New Source

Use this file only after reading `GA4/BENCHMARKS.md` and `GA4/BENCHMARKS_PRODUCTION_READINESS.md`.

For Meta, Google Ads, LinkedIn, Google Sheets, or another future source:

- copy the metric-aware threshold policy categories only when the target source has the same metric meaning and unit semantics
- prove lower-is-better behavior, low-volume handling, invalid-target handling, and insufficient-data handling in the target platform's own readiness file
- prove the target platform's current-value UI path, persisted recompute path, scheduler path, alerts, ownership checks, delete behavior, shared evaluated-route access, report consumers, and existing-data cleanup separately

Do not use this file as proof that any future platform's Benchmarks are production-ready.

## Original Root Cause

GA4 Benchmark scoring originally used one generic attainment model for all benchmark types:

- `On Track`: current performance is `90%` or more of the benchmark
- `Needs Attention`: current performance is `70%` to under `90%` of the benchmark
- `Behind`: current performance is below `70%` of the benchmark

The primary GA4 implementation path was:

- `client/src/pages/ga4-metrics.tsx`
  - `computeBenchmarkProgress`
  - `benchmarkTracker`
  - Benchmark summary cards
  - Benchmark card progress and status
  - GA4 report benchmark rows
- `GA4/BENCHMARKS.md`
  - documented the same `90% / 70%` status model before Commit 5

Related benchmark status paths also existed outside the live GA4 card path:

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
  - tests encoded the old `90% / 70%` model before the shared benchmark policy tests were added

The old model was internally coherent on the GA4 Benchmark tab because the tracker and benchmark cards both used `computeBenchmarkProgress`.

The weakness was that the same generic `90% / 70%` thresholds were applied to counts, rates, revenue, ratios, and lower-is-better cost benchmarks.

## Why The Original Generic Model Was Not Production-Perfect

The original generic model was logical as a broad benchmark-attainment signal, but not robust enough as the only executive benchmark health model.

Examples:

- `Conversions` benchmark `10`, current `9` is `On Track`, which is reasonable; but `Conversions` benchmark `1`, current `0` is `Behind`, which is also reasonable. The original model only reached this result accidentally through percentages, not through explicit low-volume count policy.
- `Users` benchmark `1000`, current `890` is `Needs Attention`, while `Conversions` benchmark `10`, current `9` is `On Track`; both are close misses but the generic model gave different interpretation based only on relative percentage.
- `Conversion Rate` benchmark `5%`, current `4.8%` could be `On Track`, but the status could be misleading when sessions were unavailable or too low.
- `Revenue` benchmark `100000`, current `95000` could be `On Track`, which can be acceptable, but the tolerance was not explicit and not shared with other surfaces.
- `CPA` direction was handled in GA4 only by checking whether the metric was `cpa`; future lower-is-better benchmark metrics such as `CPC`, `CPM`, `CPL`, or custom cost benchmarks could be misclassified.
- Executive Summary and report paths contained their own benchmark status logic, so benchmark status could drift as fixes were made to only one surface.
- The background benchmark job computed variance and rating separately from live card status, so daily history/rating semantics needed to be documented as distinct from live benchmark status.

## Threshold-Slice Target Behavior

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

## Benchmark Threshold Policy Record

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

Status:

- Completed in commit `e955b245` (`Wire GA4 benchmarks to shared threshold policy`).
- Validation passed locally with `npm test -- server/benchmark-math.test.ts server/ga4-benchmark-regression.test.ts server/ga4-cross-tab-consistency.test.ts` (`124` tests passed).
- Validation also passed with `npm test -- server/kpi-math.test.ts server/metric-math.test.ts` (`23` tests passed).
- `npm run check` passed.
- Commit 2 intentionally did not align Executive Summary, scheduled reports, server routes, or background benchmark history; those remain Commit 4 scope.

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

Status:

- Completed in commit `4131e624` (`Add GA4 benchmark sufficiency gating`).
- Automated validation passed locally with `npm test -- server/benchmark-math.test.ts server/ga4-benchmark-regression.test.ts server/ga4-cross-tab-consistency.test.ts` (`128` tests passed).
- Automated validation also passed with `npm test -- server/kpi-math.test.ts server/metric-math.test.ts` (`23` tests passed).
- `npm run check` passed.
- Manual validation available with current data was checked and passed: existing scorable Benchmarks still show normal progress/status, tracker counts match visible scored cards, and existing blocked spend/revenue-source behavior remains unchanged.
- Live UI edge validation for zero-session and zero-denominator revenue-related benchmark cases is not currently possible from available campaign data. These edge-case UI checks should be performed later with disposable local/staging data or a campaign/date range that safely has zero sessions, zero spend, or zero conversions.

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

Status:

- Completed in commit `c93911dd` (`Align benchmark status downstream`).
- Automated validation passed locally with `npm test -- server/benchmark-math.test.ts server/ga4-benchmark-regression.test.ts server/custom-report-regression.test.ts server/executive-summary-regression.test.ts server/ga4-cross-tab-consistency.test.ts` (`167` tests passed).
- `npm run check` passed.
- Campaign-level Benchmark manual validation is deferred until the campaign-level section is refined. Do not treat campaign-level Benchmark UI/manual testing as completed by this GA4 downstream alignment commit.

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

Status:

- Documentation updated to replace fixed `90% / 70%` GA4 Benchmark wording with the implemented metric-aware threshold model.
- Documentation review checked against `shared/kpi-math.ts`, `client/src/pages/ga4-metrics.tsx`, downstream report/Executive Summary alignment from commit `c93911dd`, and the focused benchmark regression tests.
- Marketing-readable validation examples were added for count, rate, revenue, ROAS, ROI, CPA, and custom lower-is-better benchmarks.
- Whole-tab deployed UI validation is recorded in `GA4/BENCHMARKS_PRODUCTION_READINESS.md`; exhaustive manual examples for every benchmark type remain useful future-platform evidence, not a GA4 Benchmark production blocker.
- Campaign-level Benchmark manual validation is deferred until the campaign-level section is refined.
- `GA4/README.md` now points future readers to `GA4/BENCHMARKS_PRODUCTION_READINESS.md` for the durable production-ready answer.

## Threshold-Slice Acceptance Criteria

The GA4 Benchmark threshold/scoring slice is complete for the current GA4 code scope. The completed implementation satisfies these criteria:

- Benchmark grid status and executive snapshot counts always match.
- Count benchmarks do not over-penalize one-unit misses on normal benchmark values.
- Tiny benchmark values are not falsely treated as healthy when the campaign produced no meaningful result.
- Rate benchmarks handle both relative gaps and percentage-point gaps.
- Lower-is-better benchmarks classify direction correctly for `CPA`, `CPC`, `CPM`, `CPL`, and relevant custom cost benchmarks.
- Blocked and insufficient-data benchmarks are excluded from scoring.
- `Avg. Progress` remains bounded to `0%` to `100%`.
- Reports, Executive Summary, scheduler output, and background benchmark history do not use a conflicting threshold model.
- Tests cover each benchmark type and edge case listed above.

## Threshold-Slice Evidence And Notes

Proven from local code:

- Shared Benchmark policy and types are implemented in `shared/kpi-math.ts`.
- GA4 Benchmark cards and tracker use `computeBenchmarkProgress`, which delegates status to `computeBenchmarkThresholdResult`.
- The shared helper uses metric-aware tolerance for count, rate, revenue, ratio, generic, and lower-is-better cost benchmarks.
- Lower-is-better direction covers `CPA`, `CPC`, `CPM`, `CPL`, spend, and relevant custom cost names.
- Blocked and insufficient-data benchmarks are excluded from tracker scoring and `Avg. Progress`.
- `Avg. Progress` uses bounded progress percentage.
- GA4 report output, Executive Summary Benchmark Comparison, campaign benchmark evaluation, and scheduled Campaign DeepDive benchmark-risk output use the shared benchmark status helper after commit `c93911dd`.
- GA4 background benchmark `performanceRating` is documented as a historical variance bucket, not the live `On Track` / `Needs Attention` / `Behind` status.
- `GA4/BENCHMARKS.md` now documents the metric-aware model and marketing-readable validation examples.

Historical partial-review notes:

- Scheduled Campaign DeepDive report output includes benchmark risk wording, but live scheduled email/PDF behavior has not been validated for this benchmark threshold change.
- Live GA4 UI behavior with each benchmark type has not yet been manually validated end to end.
- Campaign-level Benchmark manual validation is deferred until the campaign-level section is refined.
- Other platform pages also contain similar benchmark thresholds; they are intentionally out of scope for the first GA4-specific plan unless a later implementation step explicitly broadens scope.

External or future-platform validation notes:

- Live executive behavior with real mixed benchmark sets.
- Downloaded report PDF output with live benchmark rows.
- Scheduled email output with live benchmark rows.
- Manual GA4 examples for every benchmark type listed in Commit 5.
- Campaign-level Benchmark UI/manual behavior.
- Whether users expect custom per-benchmark tolerance controls.
- Whether industry-specific benchmark thresholds should vary by campaign category or metric source.
