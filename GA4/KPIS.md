# GA4 KPIs

## Purpose

This file defines the GA4 `KPIs` tab, KPI creation flow, current-value logic, gating, alerts, and refresh behavior.

## KPI Tab Structure

The GA4 `KPIs` tab contains:

- `Create KPI`
- an executive snapshot tracker panel
- a KPI grid with current vs target
- edit and delete actions
- alert indicators when alerts are enabled

Executive snapshot cards:

- `Total KPIs`
  Number of total KPIs.
- `Above Target`
  More than `+5%` above target.
- `On Track`
  Within `±5%` of target.
- `Below Target`
  More than `-5%` below target.
- `Avg. Progress`
  Average progress across scorable KPIs, bounded to `0%` to `100%` per KPI so over-target KPIs do not inflate the executive summary above full completion.

Current KPI color meaning:

- `Above Target` = green
- `On Track` = blue
- `Below Target` = red

Important meaning:

- KPI card progress bars and the KPI executive snapshot should use the same status-color scheme
- visual status should not drift from the underlying KPI band classification

## KPI Creation Journey

1. user clicks `Create KPI`
2. user chooses a metric/template or custom KPI
3. the app prefills the latest current value from live GA4-backed calculations
4. the user sets a target
5. the KPI is saved to this campaign and platform scope

Important meaning:

- KPI targets are campaign goals
- they are not benchmark reference values
- they are not percentages of the current value unless the user explicitly enters a percentage-based target metric
- the target should represent what "good" looks like for this campaign

## KPI Grid Behavior

Each KPI shows:

- current value
- target value
- progress bar
- status
- edit action
- delete action

The KPI grid is the detailed record of KPI state.

The executive snapshot tracker is a summary derived from the KPI grid, not a separate source of truth.

## KPI Value Sources

KPI current values are driven by the same live data model as the GA4 page:

- GA4 metrics
- imported revenue where relevant
- imported spend where relevant
- derived campaign financial calculations where relevant

Important meaning:

- KPIs track the latest GA4-backed campaign state
- KPI current values should stay consistent with the Overview and financial-source logic

Current-value hierarchy:

- traffic and engagement KPIs should come from GA4-scoped campaign metrics
- revenue-dependent KPIs should use recomputed campaign revenue values
- spend-dependent KPIs should use recomputed campaign spend values
- efficiency KPIs like `ROAS`, `ROI`, and `CPA` should be derived from the current recomputed financial state
- if dependencies are missing, the KPI should be blocked instead of showing a misleading value

## Revenue / Spend-Dependent KPI Gating

Some KPI types are intentionally blocked until prerequisites exist.

Examples:

- revenue
- ROAS
- ROI
- profit
- CPA

Important meaning:

- missing spend/revenue should not silently show misleading zeroes
- blocked KPIs are excluded from executive scoring
- blocked KPIs should also be excluded from `Avg. Progress`
- blocked KPIs should not be classified into `Above Target`, `On Track`, or `Below Target`

## Executive Snapshot Band Logic

The executive snapshot tracker uses these classification bands:

- `Above Target`
  More than `+5%` above target.
- `On Track`
  Within `±5%` of target.
- `Below Target`
  More than `-5%` below target.

Important meaning:

- these bands drive the campaign-level KPI summary state
- they should be derived from the same KPI progress logic as the KPI grid
- tracker status should never drift from KPI card status for the same KPI

## KPI Alerts And Notifications

Users can enable alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency: `immediate`, `daily`, `weekly`
- optional comma-separated email recipients

Expected behavior:

- KPIs with alerts enabled show a warning indicator on the KPI card
- breached KPIs show a red pulsing circle indicator on the KPI card
- breached KPI alerts should appear in the bell icon and notifications center
- email delivery is optional

## KPI Background Refresh Pattern

After GA4 Overview-driving values refresh, the required KPI order is:

1. recompute KPI current values
2. refresh KPI progress and performance state
3. update stored KPI progress/history where applicable
4. run KPI alert checks against refreshed values

The executive snapshot tracker should also recompute whenever related inputs change.

This includes:

- when a new KPI is created
- when an existing KPI is edited
- when a KPI is deleted
- when KPI current values change after GA4, revenue, or spend updates
- when revenue sources are added, edited, deleted, or refreshed
- when spend sources are added, edited, deleted, or refreshed
- when target values change
- when a KPI moves between `Above Target`, `On Track`, and `Below Track`

Important meaning:

- the executive snapshot cards are derived KPI-state summaries
- they should not lag behind the KPI grid
- any change that affects KPI current value, target value, progress, or status should trigger recomputation of the tracker counts and `Avg. Progress`
- KPI alerts should evaluate after KPI recomputation, not before
- GA4 KPI alerts must use the same current-value source as the live GA4 KPI cards
- duplicate active GA4 KPIs for the same `campaign + metric` must not emit competing active alerts; the latest row should win
- the bell / Notifications center should refetch current notification state when opened so resolved alerts do not linger from client cache

## Current-State Note

The current codebase is broadly aligned with that model, but the implementation is split:

- live page rendering uses current GA4-backed values
- stored KPI values and history are maintained by background GA4 jobs
- some immediate post-refresh behavior still routes through a generic KPI refresh helper
