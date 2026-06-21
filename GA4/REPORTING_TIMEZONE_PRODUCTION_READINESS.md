# GA4 Reporting Timezone Production Readiness

## Purpose

This file tracks the production-readiness work needed to make GA4 daily history, Insights Trends, freshness labels, and scheduled refresh timing reliable for marketing executives who expect data availability at specific local business times.

This is a timing-contract task, not a metric-calculation rewrite.

## Root Cause

The current implementation does not have one explicit reporting timezone contract.

Proven from code:

- GA4 daily facts are stored as `YYYY-MM-DD` UTC-oriented date strings in `ga4_daily_metrics`.
- before Commit 3, `/api/campaigns/:id/ga4-daily` computed the visible Trends window through yesterday UTC.
- before Commit 4, the GA4 daily scheduler ran on startup and then every `GA4_DAILY_REFRESH_INTERVAL_HOURS`.
- the external revenue/spend scheduler uses server-local `AUTO_REFRESH_DAILY_HOUR` and `AUTO_REFRESH_DAILY_MINUTE`.
- the GA4 UI detects browser timezone for report scheduling helpers, but Insights Trends does not use that as a reporting cutoff.

Impact:

- data can be technically correct but unclear to an executive user
- "complete day" can mean UTC day while the user expects a local business day
- scheduler logs can be hard to reconcile with the UI
- stale or not-yet-refreshed history is not clearly distinguished from complete history

## Production-Ready Goal

GA4 executive surfaces should answer these questions without interpretation:

- which timezone defines a completed reporting day
- which date the current Trends data is complete through
- when the daily facts were last refreshed
- whether the expected refresh has completed
- whether the visible values are current, pending, or stale

Example target copy:

`Data through Jun 20, 2026 (Europe/Amsterdam). Last refreshed Jun 21, 2026 07:19 Europe/Amsterdam.`

## Non-Goals

- do not change metric formulas as part of timezone labeling
- do not rewrite GA4 daily storage
- do not broaden GA4 campaign scope
- do not change imported revenue/spend aggregation unless a separate revenue/spend bug is proven
- do not make scheduler behavior depend on browser timezone alone

## Commit Plan

### Commit 1: Clarify Current UTC Behavior

Status: Validation passed for commit `d49fa064`.

Scope:

- show `Data through` in Insights Trends
- show timezone used for the current cutoff, initially `UTC`
- show `Last refreshed` from the existing `/ga4-daily.lastUpdated`
- update empty-history copy from `complete days` to `complete UTC days`
- keep calculations and API response shapes unchanged

Local validation:

- `npm test -- --run server/ga4-ui-regression.test.ts`
- `npm run check`
- `git diff --check`
- deployed/user validation confirmed after commit `d49fa064`

Validation:

- Trends values remain unchanged
- Daily mode with two rows still renders chart and table
- missing-history message names `complete UTC days`
- `npm run check`
- focused GA4 UI regression guard for the new labels

### Commit 2: Add Reporting Timezone Contract

Status: Validation passed for commit `fab69b16`.

Scope:

- add a campaign-level or client-level `reportingTimeZone` field
- default new campaigns from browser timezone when available
- use `UTC` as the server-safe fallback
- expose the selected reporting timezone in campaign/GA4 responses without breaking existing response shapes
- document ownership: campaign setting first, client default later if needed

Implementation note:

- ownership starts at campaign level through `campaigns.reporting_time_zone`
- existing campaigns and invalid/missing inputs fall back to `UTC`
- new campaign creation sends the browser IANA timezone when available
- `/api/campaigns` and `/api/campaigns/:id` expose `reportingTimeZone`
- `/api/campaigns/:id/ga4-daily` exposes `reportingTimeZone`, but the Trends cutoff remains UTC until Commit 3 centralizes the reporting-day cutoff helper

Local validation:

- `npm test -- --run server/ga4-reporting-timezone-regression.test.ts server/ga4-ui-regression.test.ts`
- `npm run check`
- `git diff --check`
- deployed/user validation confirmed after commit `fab69b16`

Validation:

- existing campaigns without a timezone continue to work with `UTC`
- new campaign creation persists a valid IANA timezone
- invalid timezone input fails closed or falls back explicitly
- schema/migration checks
- `npm run check`

### Commit 3: Centralize Reporting-Day Cutoff Helper

Status: Validation passed for commit `34cc4fc2`.

Scope:

- add a shared server helper for latest complete reporting day by IANA timezone
- use it in `/api/campaigns/:id/ga4-daily` to report the cutoff metadata
- initially keep the stored GA4 daily row dates unchanged
- return explicit metadata such as `dataThroughDate`, `reportingTimeZone`, and `lastUpdated`

Implementation note:

- `/api/campaigns/:id/ga4-daily` now computes `startDate`, `endDate`, and `dataThroughDate` from the campaign `reportingTimeZone`
- stored `ga4_daily_metrics.date` values remain unchanged `YYYY-MM-DD` daily fact keys
- the Trends UI filters daily rows through `dataThroughDate` and displays `Last refreshed` in the response reporting timezone

Local validation:

- `npm test -- --run server/ga4-reporting-day-cutoff-regression.test.ts server/ga4-reporting-timezone-regression.test.ts server/ga4-ui-regression.test.ts`
- `npm run check`
- deployed/user validation confirmed after commit `34cc4fc2`

Validation:

- UTC campaign returns the same date window as current behavior
- `Europe/Amsterdam` boundary tests pass around local midnight and DST
- response additions do not break existing consumers
- focused route regression tests
- `npm run check`

### Commit 4: Align GA4 Daily Refresh Scheduling

Status: Validation passed for commit `e740b5f0`.

Scope:

- decide whether GA4 daily refresh remains interval-based or moves to a timezone-aware scheduled daily run
- if scheduled, use the configured reporting timezone to calculate the expected refresh window
- keep startup refresh as best-effort if it remains useful for testing
- expose enough log context to correlate refresh runs with the reporting timezone

Implementation note:

- GA4 daily refresh now schedules one daily run at `GA4_DAILY_REFRESH_HOUR:GA4_DAILY_REFRESH_MINUTE` in `GA4_DAILY_REFRESH_TIME_ZONE`
- defaults are `03:00` and `UTC`
- `GA4_DAILY_REFRESH_RUN_ON_STARTUP` controls the best-effort startup run and defaults to `true` to preserve current test behavior
- scheduler logs include the next run UTC time, local reporting-time label, timezone, and expected `dataThroughDate`
- an in-process overlap guard skips a second GA4 daily pipeline if one is already running

Local validation:

- `npm test -- --run server/ga4-daily-scheduler-regression.test.ts server/ga4-reporting-day-cutoff-regression.test.ts`
- `npm run check`
- deployed scheduler setup validation confirmed after commit `e740b5f0`; scheduled execution evidence remains pending the next configured run

Validation:

- scheduler logs include expected reporting timezone and next run
- startup run behavior remains controlled and explicit
- no overlapping GA4 daily refresh runs
- focused scheduler tests
- `npm run check`

### Commit 5: Align External Revenue/Spend Refresh Timing

Status: Implemented locally; pending deployed validation

Scope:

- move external value auto-refresh away from ambiguous server-local timing
- compute next run from the same reporting timezone contract or a documented deployment-level default
- preserve stable source IDs and existing provider refresh boundaries
- keep `AUTO_REFRESH_RUN_ON_STARTUP` as a test-only override

Implementation note:

- external value auto-refresh now schedules one daily run at `AUTO_REFRESH_DAILY_HOUR:AUTO_REFRESH_DAILY_MINUTE` in `AUTO_REFRESH_TIME_ZONE`
- if `AUTO_REFRESH_TIME_ZONE` is unset, it falls back to `GA4_DAILY_REFRESH_TIME_ZONE`, then `UTC`
- `AUTO_REFRESH_RUN_ON_STARTUP` remains optional and defaults to `false`
- scheduler logs include the next run UTC time, local reporting-time label, timezone, and expected complete day
- provider reprocess payloads and stable `sourceId` behavior are unchanged

Local validation:

- `npm test -- --run server/ga4-auto-refresh-regression.test.ts server/ga4-daily-scheduler-regression.test.ts`
- `npm run check`

Validation:

- HubSpot/Salesforce/Shopify/Sheets refresh still uses stable source IDs
- scheduler logs show reporting timezone and next run
- no duplicate revenue/spend records on repeated runs
- focused CRM/ecommerce/Sheets scheduler tests
- `npm run check`

### Commit 6: Add Freshness And Staleness UX

Status: Not started

Scope:

- show expected refresh time and last completed refresh time where executives rely on daily history
- show stale-data warning when expected refresh passed but daily facts have not updated
- keep warning factual and non-alarming
- apply first to GA4 Insights Trends, then expand to Reports/KPI/Benchmark freshness only after path tracing

Validation:

- fresh state shows data-through and last-refreshed copy
- stale state shows a warning without changing metrics
- no warning appears before the expected refresh window
- UI regression tests
- `npm run check`

### Commit 7: Reports And Export Consistency

Status: Not started

Scope:

- include reporting timezone, data-through date, and last-refreshed timestamp in GA4 Insights report output
- ensure scheduled reports use the same reporting timezone metadata
- keep report metric values sourced from the existing refreshed inputs

Validation:

- generated PDF includes the same data-through metadata as the UI
- scheduled report output does not imply current-day completeness when Trends excludes intraday data
- focused report regression tests
- `npm run check`

### Commit 8: Documentation And Operational Runbook

Status: Not started

Scope:

- update `GA4/INSIGHTS.md`
- update `GA4/REFRESH_AND_PROCESSING.md`
- update manual validation notes for Render logs and local timezone checks
- document how to test startup refresh separately from scheduled refresh

Validation:

- docs explain UTC fallback, configured reporting timezone, expected refresh, and stale warning behavior
- `git diff --check`

## Monitoring Checklist

Use this checklist during implementation and deployment validation:

- [ ] Trends shows data-through date
- [ ] Trends shows reporting timezone
- [ ] Trends shows last refreshed timestamp
- [ ] missing-history copy names the timezone basis
- [ ] Render logs show next scheduled refresh time and timezone
- [ ] GA4 daily rows update after the expected refresh
- [ ] external revenue/spend sources update after their expected refresh
- [ ] stale warning appears only when refresh is late
- [ ] generated reports include the same freshness metadata

## Open Decisions

- client-level defaults may be added later; campaign-level `reportingTimeZone` is the current source of truth
- GA4 daily refresh now uses a deployment-level configured reporting timezone; per-campaign scheduler fan-out remains out of scope
- external revenue/spend refresh now uses a deployment-level operations timezone; per-campaign refresh fan-out remains out of scope
- whether existing campaigns should be backfilled to `UTC` only or inferred from owner/browser/client context

## Current Status

Current production behavior uses the campaign reporting timezone for Trends cutoff; GA4 daily refresh and external revenue/spend refresh use deployment-level configured reporting timezones and local scheduled times.

This is acceptable for testing only when users understand the timing model. It is not yet the final executive-ready local reporting-time behavior.
