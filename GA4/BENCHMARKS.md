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
4. if `Custom` is selected, the user enters the benchmark value
5. the user enters a custom benchmark value
6. the benchmark is saved to this campaign and platform scope

Important meaning:

- a benchmark is a reference value the campaign is compared against
- it is not the same as a KPI target or campaign goal
- benchmarks answer "how do we compare?" rather than "what are we trying to hit?"

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

## Benchmark Progress And Status

Current status model:

- `On Track`
  `90%` or more of the benchmark
- `Needs Attention`
  `70%` to under `90%` of the benchmark
- `Behind`
  Below `70%` of the benchmark

Executive snapshot meaning:

- `Total Benchmarks`
  Number of total benchmarks.
- `On Track`
  `90%` or more of the benchmark.
- `Needs Attention`
  `70%` to under `90%` of the benchmark.
- `Behind`
  Below `70%` of the benchmark.
- `Avg. Progress`
  Average benchmark progress across scorable benchmarks.

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

## Benchmark Alerts And Notifications

Users can enable benchmark alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency
- optional email list

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
- the selected `Alert Frequency` controls reminder emails, not duplicate in-app notification rows
- when email alerts are enabled and the benchmark is already breached on create/update, the first email should send immediately
- if the benchmark unit is `count`, alert text should omit the literal word `count` in bell, Notifications, and email output
- alert text should use the same human-readable number style as benchmark cards rather than raw parenthesized decimals
- example alert text:
  `Campaign: myGA4`
  `Current value 72,660 is below the alert threshold 75,000`

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

## Current-State Note

The current implementation is broadly aligned, with these caveats:

- live page display uses current GA4-backed values
- stored benchmark `currentValue` and history are refreshed by GA4 background jobs
- benchmark recomputation after refresh is present
