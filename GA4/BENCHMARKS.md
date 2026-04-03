# GA4 Benchmarks

## Purpose

This file defines the GA4 `Benchmarks` tab, benchmark creation flow, industry autofill, progress rules, gating, alerts, and refresh behavior.

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
4. the user enters the benchmark value they consider good
5. optionally, the user selects an industry for benchmark autofill
6. the benchmark is saved to this campaign and platform scope

## Industry Benchmark Autofill

Industry selection is an autofill aid.

Important meaning:

- industry autofill helps seed a benchmark value
- the benchmark still belongs to this campaign after save

## Benchmark Grid Behavior

Each benchmark shows:

- current value
- benchmark value
- progress
- status
- edit action
- delete action

## Benchmark Progress And Status

Current status model:

- `On Track`
  Meeting or exceeding the benchmark
- `Needs Attention`
  Between roughly 70% and 90% of the benchmark
- `Behind`
  Below roughly 70% of the benchmark

## Revenue / Spend-Dependent Benchmark Gating

Some benchmark types are disabled until revenue or spend is connected.

Examples:

- ROAS
- ROI
- profit
- CPA

Blocked benchmarks should not be treated as underperformance.

## Benchmark Alerts And Notifications

Users can enable benchmark alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency
- optional email list

Expected behavior:

- benchmark breaches should appear in notifications
- benchmark alerts can optionally be emailed

## Benchmark Background Refresh Pattern

After GA4 Overview-driving values refresh, the required order is:

1. recompute benchmark current values
2. refresh benchmark progress and performance state
3. update stored benchmark history where applicable
4. run benchmark alert checks against refreshed values

## Current-State Note

The current implementation is broadly aligned, with these caveats:

- live page display uses current GA4-backed values
- stored benchmark `currentValue` and history are refreshed by GA4 background jobs
- benchmark recomputation after refresh is present
- immediate benchmark alert checks are not mirrored as completely as KPI alert checks in the same auto-refresh path
