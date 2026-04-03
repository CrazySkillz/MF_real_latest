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
- `Above Target`
- `On Track`
- `Below Track`
- `Avg. Progress`

## KPI Creation Journey

1. user clicks `Create KPI`
2. user chooses a metric/template or custom KPI
3. the app prefills the latest current value from live GA4-backed calculations
4. the user sets a target
5. the KPI is saved to this campaign and platform scope

## KPI Grid Behavior

Each KPI shows:

- current value
- target value
- progress bar
- status
- edit action
- delete action

## KPI Value Sources

KPI current values are driven by the same live data model as the GA4 page:

- GA4 metrics
- imported revenue where relevant
- imported spend where relevant
- derived campaign financial calculations where relevant

Important meaning:

- KPIs track the latest GA4-backed campaign state
- KPI current values should stay consistent with the Overview and financial-source logic

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

## KPI Alerts And Notifications

Users can enable alerts with:

- threshold value
- condition: `below`, `above`, or `equals`
- frequency: `immediate`, `daily`, `weekly`
- optional comma-separated email recipients

Expected behavior:

- breached KPIs can show a visible warning indicator on the KPI card
- alerts should appear in the bell icon and notifications center
- email delivery is optional

## KPI Background Refresh Pattern

After GA4 Overview-driving values refresh, the required KPI order is:

1. recompute KPI current values
2. refresh KPI progress and performance state
3. update stored KPI progress/history where applicable
4. run KPI alert checks against refreshed values

## Current-State Note

The current codebase is broadly aligned with that model, but the implementation is split:

- live page rendering uses current GA4-backed values
- stored KPI values and history are maintained by background GA4 jobs
- some immediate post-refresh behavior still routes through a generic KPI refresh helper
- KPI notification navigation still has legacy LinkedIn-style URL behavior in shared notification code
