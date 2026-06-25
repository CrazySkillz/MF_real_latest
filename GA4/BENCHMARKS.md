# GA4 Benchmarks

## Purpose

This file defines the GA4 `Benchmarks` tab, benchmark creation flow, progress rules, gating, alerts, and refresh behavior.

## Benchmark Tab Structure

The GA4 `Benchmarks` tab contains:

- `Add Benchmark` / `Create Benchmark`
- an executive snapshot tracker panel
- a benchmark list with current vs benchmark value
- edit and delete actions
- alert indicators when alerts are enabled

Executive snapshot cards:

- `Total Benchmarks`
- `On Track`
- `Needs Attention`
- `Behind`
- `Avg. Progress`

## Benchmark Creation Journey

1. user clicks `Create Benchmark`
2. user chooses a benchmark metric or custom benchmark
3. the app prefills the latest current value from live GA4-backed calculations
4. if `Create Custom Benchmark` is selected, the user chooses name and unit, then enters current and benchmark values
5. the benchmark is saved to this campaign and platform scope

Important meaning:

- a benchmark is a reference value the campaign is compared against
- it is not the same as a KPI target or campaign goal
- benchmarks answer "how do we compare?" rather than "what are we trying to hit?"
- the benchmark template tile grid is the metric selector; selecting `Create Custom Benchmark` should highlight that tile with the same selected styling used by predefined benchmark tiles
- the `Create Custom Benchmark` tile should show the helper text `Choose name + unit, then set values`
- the `Unit` field is a constrained dropdown, not free text. Supported visible choices are `Select unit`, `Percentage (%)`, campaign currency, `Count`, and `Ratio (x)`, with the current campaign currency used for currency-style benchmarks.
- for a custom benchmark before the user selects a real unit, `Current Value` and `Benchmark Value` should be formatted as generic numbers. Whole numbers such as `700` should remain `700`, while currency-style two-decimal formatting should apply only after a currency unit is selected.
- `Create Benchmark` should remain disabled until `Benchmark Name` and `Benchmark Value` are both non-empty; submit-handler validation is only the fallback, not the primary UX.

## Benchmark Target Source

GA4 Benchmarks now use custom benchmark values only.

Important meaning:

- the user enters the benchmark value explicitly
- the benchmark still belongs to this campaign after save
- GA4 does not present industry-autofill benchmark suggestions in the create/edit flow

## Benchmark Grid Behavior

Each benchmark shows:

- current value
- benchmark value
- progress
- status
- edit action
- delete action

The GA4 benchmark card no longer shows a separate `Source` tile when the benchmark is custom, because custom entry is now the default GA4 benchmark path.

The benchmark grid is the detailed record of benchmark state.

The executive snapshot tracker is a summary derived from the benchmark grid, not a separate source of truth.

When editing an existing benchmark:

- the edit modal should show the same live current value the benchmark card is using
- it should not prefill from a stale stored snapshot if the current GA4 or financial inputs have changed
- count-unit current and benchmark values should display as whole numbers without `.00` suffixes
- currency-unit current and benchmark values should display with thousands separators while preserving cents, for example `450,000.00`
- `Update Benchmark` should remain disabled immediately after opening edit mode and should become enabled only after at least one form value differs from the loaded edit values

## Benchmark Progress And Status

Current status model:

- status is computed by the shared metric-aware Benchmark threshold policy, not one fixed percentage rule for every metric
- progress is the benchmark attainment ratio, bounded from `0%` to `100%` for display and averaging
- higher-is-better benchmarks use `current value / benchmark value`
- lower-is-better benchmarks such as `CPA`, `CPC`, `CPM`, `CPL`, spend, and relevant custom cost benchmarks use `benchmark value / current value`
- `On Track`
  at or better than benchmark, or within the metric-aware on-track tolerance
- `Needs Attention`
  worse than the on-track tolerance but not a material miss
- `Behind`
  a material miss, with a default floor around `70%` attainment; zero performance is `Behind` when the benchmark value is positive
- invalid or zero benchmark values are not scored

Executive snapshot meaning:

- `Total Benchmarks`
  Number of total benchmarks.
- `On Track`
  Number of scorable benchmarks at or within metric-aware tolerance of the benchmark.
- `Needs Attention`
  Number of scorable benchmarks with a moderate miss.
- `Behind`
  Number of scorable benchmarks with a material miss.
- `Avg. Progress`
  Average bounded progress across scorable benchmarks only.

Metric-specific examples:

- count benchmark: `Conversions` benchmark `10`, current `9` is `On Track`; benchmark `1`, current `0` is `Behind`
- rate benchmark: `Conversion Rate` benchmark `5%`, current `4.8%` is `On Track` when sessions are available
- revenue benchmark: `Revenue` benchmark `100,000`, current `95,000` is `On Track`
- ratio benchmark: `ROAS` benchmark `2.0x`, current `1.9x` is `On Track`
- ROI benchmark: `ROI` benchmark `100%`, current `60%` is `Behind`
- lower-is-better benchmark: `CPA` benchmark `100`, current `105` is `On Track`; current `150` is `Behind`
- custom cost benchmark: custom names or metrics that clearly indicate cost, spend, `CPC`, `CPM`, `CPA`, or `CPL` should use lower-is-better direction

## Benchmark Value Sources

Benchmark current values are driven by the same live data model as the GA4 page:

- GA4-scoped campaign metrics
- recomputed campaign revenue values where relevant
- recomputed campaign spend values where relevant
- derived financial calculations where relevant

Current-value hierarchy:

- traffic and engagement benchmarks should come from GA4-scoped campaign metrics
- revenue-dependent benchmarks should use recomputed campaign revenue values
- spend-dependent benchmarks should use recomputed campaign spend values
- efficiency benchmarks like `ROAS`, `ROI`, and `CPA` should be derived from the current recomputed financial state
- if dependencies are missing, the benchmark should be blocked instead of showing a misleading value

Campaign-level benchmark source previews:

- campaign-level Benchmark current values must be populated from connected-platform values, not from a separate generic fallback when a connected-platform value exists
- campaign-level Benchmark current values MUST be fed by the connected platform metrics shown for the campaign; this is the standard rule for campaign Benchmarks and must not be replaced with a separate selectable-source calculation UI
- campaign-level KPI/Benchmark production-readiness tracking lives in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`
- for GA4-only campaigns, campaign-level `ROAS`, `ROI`, and `CPA` benchmark inputs must match the GA4 financial card inputs: `Total Revenue` = GA4 native revenue plus imported revenue, `Total Spend` = spend breakdown/spend-to-date, and `Total Conversions` = GA4 connected conversions
- `ROAS` uses the `ratio` unit and is displayed as an `x` ratio (`Revenue ÷ Spend`), while `ROI` remains a percent (`(Revenue - Spend) ÷ Spend × 100`) and `CPA` remains currency (`Spend ÷ Conversions`)
- campaign efficiency benchmarks must use aggregate campaign inputs: `ROAS` and `ROI` use `Total Revenue` plus `Total Spend`; `CPA` uses `Total Spend` plus `Total Conversions`

## Revenue / Spend-Dependent Benchmark Gating

Some benchmark types are disabled until revenue or spend is connected.

Examples:

- ROAS
- ROI
- profit
- CPA

Blocked benchmarks should not be treated as underperformance.

Important meaning:

- blocked benchmarks should be excluded from tracker counts
- blocked benchmarks should be excluded from `Avg. Progress`
- blocked benchmarks should not be classified into `On Track`, `Needs Attention`, or `Behind`
- data-insufficient benchmarks should also be excluded from tracker counts and `Avg. Progress`
- rate benchmarks need sessions before scoring
- `CPA` benchmarks need conversions and spend before scoring
- `ROAS` and `ROI` benchmarks need spend before scoring
- insufficient benchmarks should show an explanatory reason instead of being treated as healthy or weak performance

## Benchmark Alerts And Notifications

Users can enable benchmark alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency
- optional email list

Default form behavior:

- new GA4 Benchmark forms should preselect `Immediate` for `Alert Frequency`
- editing an existing Benchmark should preserve the saved frequency value
- when `Send email notifications` is not selected, the form should hide `Email addresses *` and `Alert Frequency`
- when `Send email notifications` is selected, `Email addresses *` should render as a full-width row with the label next to the input, and `Alert Frequency` should render underneath it

Alert frequency meaning:

- `Immediate`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the benchmark is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per hour.
- `Daily`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the benchmark is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per day.
- `Weekly`
  Bell + Notifications keep one active in-app alert record while the breach remains unresolved. If the benchmark is already breached on create/update, the first email sends immediately. Later reminder emails can repeat at most once per week.

Expected behavior:

- benchmarks with alerts enabled show a warning indicator on the benchmark card
- breached benchmarks show a red pulsing circle indicator on the benchmark card
- breached benchmark alerts should appear in the bell icon and notifications center
- bell and Notifications `View Benchmark` navigation should always open the correct campaign, the `Benchmarks` tab, and the exact benchmark card
- if the user is already on the same GA4 campaign page, the URL change must still switch to the correct benchmark tab/item instead of staying on the previously open tab
- email delivery is optional
- `Email addresses *` and `Alert Frequency` should appear only after `Send email notifications` is selected
- the selected `Alert Frequency` controls reminder emails, not duplicate in-app notification rows
- when email alerts are enabled and the benchmark is already breached on create/update, the first email should send immediately
- if a breached GA4 benchmark has no active in-app notification row, the next GA4 KPI/Benchmark recompute or daily scheduler cycle should restore exactly one active bell / Notifications alert row
- opening the bell, opening Notifications, or simply loading the GA4 page should not be relied on as the reconciliation trigger for restoring a missing GA4 in-app alert row
- if the benchmark unit is `count`, alert text should omit the literal word `count` in bell, Notifications, and email output
- alert text should use the same human-readable number style as benchmark cards rather than raw parenthesized decimals
- alert emails should include both client and campaign context when the campaign is known
- alert email action text should use the display label `Benchmark`, not lowercase `benchmark`
- example alert text:
  `Client: Test_client`
  `Campaign: myGA4`
  `Current value: 72,660`
  `Alert threshold value: 75,000`

## Benchmark Background Refresh Pattern

After GA4 Overview-driving values refresh, the required order is:

1. recompute benchmark current values
2. refresh benchmark progress and performance state
3. update stored benchmark history where applicable
4. run benchmark alert checks against refreshed values

The executive snapshot tracker should also recompute whenever related inputs change.

This includes:

- when a new benchmark is created
- when an existing benchmark is edited
- when a benchmark is deleted
- when benchmark current values change after GA4, revenue, or spend updates
- when revenue sources are added, edited, deleted, or refreshed
- when spend sources are added, edited, deleted, or refreshed
- when a benchmark moves between `On Track`, `Needs Attention`, and `Behind`

Important meaning:

- the executive snapshot cards are derived benchmark-state summaries
- they should not lag behind the benchmark grid
- any change that affects current value, benchmark value, progress, or status should trigger recomputation of tracker counts and `Avg. Progress`
- benchmark alerts should evaluate after benchmark recomputation, not before
- if the exact report-date GA4 daily row is missing, GA4 benchmark recomputation should fall back to the latest available GA4 daily row for that campaign/property rather than skipping alert reconciliation entirely

## Current-State Note

The current implementation is broadly aligned, with these caveats:

- live page display uses current GA4-backed values
- stored benchmark `currentValue` and history are refreshed by GA4 background jobs
- benchmark recomputation after refresh is present
