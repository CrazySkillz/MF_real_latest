# GA4 Reporting Timezone Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file tracks the production-readiness work needed to make GA4 daily history, Insights Trends, freshness labels, and scheduled refresh timing reliable for marketing executives who expect data availability at specific local business times.

This is a timing-contract task, not a metric-calculation rewrite.

## Root Cause

Before the reporting-timezone hardening work, the implementation did not have one explicit reporting timezone contract.

Original findings from code:

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

Follow-up UI root causes now addressed:

- the first implementation persisted `reportingTimeZone`, but the visible create/edit campaign UI did not consistently expose the setting in the same details flow users already used for campaign configuration
- the edit campaign modal temporarily used an older layout, so the timezone control looked inconsistent with create mode
- the timezone select display rendered raw IANA IDs such as `America/New_York`; the saved value was correct, but the visible label was not executive-friendly
- the edit modal already had a submit button and update payload, but the modal body could be clipped on shorter viewports, making `Save Changes` hard to reach

## Production-Ready Goal

GA4 executive surfaces should answer these questions without interpretation:

- which timezone defines a completed reporting day
- which date the current Trends data is complete through
- when the daily facts were last refreshed
- whether the expected refresh has completed
- whether the visible values are current, pending, or stale

Example target copy:

`Completed-day cutoff Jun 20, 2026 (Europe/Amsterdam). Last refreshed Jun 21, 2026 07:19 Europe/Amsterdam.`

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

- show `Completed-day cutoff` in Insights Trends
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

Status: Validation passed for commit `8d4a99bc`.

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
- deployed/user validation confirmed after commit `8d4a99bc`

Validation:

- HubSpot/Salesforce/Shopify/Sheets refresh still uses stable source IDs
- scheduler logs show reporting timezone and next run
- no duplicate revenue/spend records on repeated runs
- focused CRM/ecommerce/Sheets scheduler tests
- `npm run check`

### Commit 6: Add Freshness And Staleness UX

Status: Validation passed for commit `82f8784d`.

Scope:

- show expected refresh time and last completed refresh time where executives rely on daily history
- show stale-data warning when expected refresh passed but daily facts have not updated
- keep warning factual and non-alarming
- apply first to GA4 Insights Trends, then expand to Reports/KPI/Benchmark freshness only after path tracing

Implementation note:

- `/api/campaigns/:id/ga4-daily` now returns `expectedRefreshAt`, `refreshScheduleTimeZone`, `lastCompletedRefreshAt`, and `refreshIsStale`
- expected refresh is computed from `dataThroughDate` plus the configured GA4 daily scheduler time and timezone
- `refreshIsStale` is true only after the expected refresh time has passed and the latest completed daily refresh timestamp is missing or older than that expected refresh
- GA4 Insights Trends shows `Expected refresh` beside the existing completed-day-cutoff/timezone/last-refreshed metadata
- GA4 Insights Trends shows a factual warning when `refreshIsStale` is true; metric values and history gating are unchanged

Local validation:

- `npm test -- --run server/ga4-daily-scheduler-regression.test.ts server/ga4-reporting-day-cutoff-regression.test.ts server/ga4-ui-regression.test.ts`
- `npm run check`
- deployed/user validation confirmed the fresh-state path after commit `82f8784d`: Trends showed `Expected refresh`, `Last refreshed` was later than expected refresh, and no stale warning appeared
- stale-warning path remains unforced in deployed validation because the observed refresh was current, not late

Validation:

- fresh state shows completed-day cutoff and last-refreshed copy
- stale state shows a warning without changing metrics
- no warning appears before the expected refresh window
- UI regression tests
- `npm run check`

### Commit 7: Reports And Export Consistency

Status: Validation passed for commit `b7a629d0` for generated/ad hoc report output. Scheduled-report validation is deferred until the Reports scheduler refinement work.

Scope:

- include reporting timezone, completed-day cutoff date, and last-refreshed timestamp in GA4 Insights report output
- ensure scheduled reports use the same reporting timezone metadata
- keep report metric values sourced from the existing refreshed inputs

Implementation note:

- ad hoc GA4 Insights PDF output now includes `Completed-day cutoff`, `Reporting timezone`, and `Last refreshed` metadata from the same Trends response values used by the live Insights UI
- scheduled/test-send GA4 Insights PDFs now derive `Completed-day cutoff` and `Reporting timezone` from the campaign reporting timezone helper and `Last refreshed` from the latest persisted GA4 daily-row `updatedAt`
- report metric rows, financial totals, trend rollups, and source inputs are unchanged

Local validation:

- `npm test -- --run server/ga4-ui-regression.test.ts server/ga4-daily-scheduler-regression.test.ts server/ga4-reporting-day-cutoff-regression.test.ts`
- `npm test -- --run server/report-email-regression.test.ts`
- `npm run check`
- `git diff --check`

Deployed/user validation:

- generated/downloaded GA4 Insights report output was validated for the freshness metadata path
- scheduled GA4 report output was not validated because the Reports scheduler still needs refinement before scheduled delivery can be treated as a reliable validation path

Validation:

- generated PDF includes the same completed-day cutoff metadata as the UI
- scheduled report output does not imply current-day completeness when Trends excludes intraday data; deployed validation pending Reports scheduler refinement
- focused report regression tests
- `npm run check`

### Commit 8: Documentation And Operational Runbook

Status: Implemented locally; local validation passed; pending commit.

Scope:

- update `GA4/INSIGHTS.md`
- update `GA4/REFRESH_AND_PROCESSING.md`
- update manual validation notes for Render logs and local timezone checks
- document how to test startup refresh separately from scheduled refresh

Implementation note:

- `GA4/INSIGHTS.md` now documents Trends freshness labels, UTC fallback, expected refresh, and stale-warning behavior
- `GA4/REFRESH_AND_PROCESSING.md` now documents GA4 daily and external value scheduler environment variables, Render/log timezone interpretation, and separate startup-versus-scheduled validation paths
- no metric formulas, scheduler code, response shapes, or source-refresh behavior changed

Local validation:

- `git diff --check`

Validation:

- docs explain UTC fallback, configured reporting timezone, expected refresh, and stale warning behavior
- `git diff --check`

### Trends Latest Imported Day And Live Property Boundary Follow-Up

Status: Implemented, committed, pushed, and user validated for commit `4074d282`.

Scope:

- separate `Completed-day cutoff` from the latest actual persisted row by showing `Latest imported day` in Insights Trends
- keep `Completed-day cutoff` as the completed reporting-day cutoff, not proof that GA4 returned a row for that date
- do not synthesize a zero-value row when GA4 has no row for a completed day in the selected property/campaign scope
- remove numeric GA4 property IDs from the Yesop simulator boundary so property `498536418` and other numeric properties use live import/query paths

Validation:

- local tests passed: `server/ga4-live-property-boundary-regression.test.ts`, `server/ga4-reporting-day-cutoff-regression.test.ts`, `server/ga4-ui-regression.test.ts`, and `server/outcome-totals-ga4-fallback-regression.test.ts`
- `npm run check` passed
- user validation passed in the deployed UI after commit `4074d282`

### Campaign Timezone Configuration UI Follow-Up

Status: Implemented, committed, pushed, and locally validated through commits `9c9a1710`, `027186b5`, `7bcce98b`, and `26833d95`.

Scope:

- expose campaign reporting timezone in `Edit Campaign`
- align the edit modal with the create campaign details layout
- expose campaign reporting timezone in the first `Create New Campaign` details step
- make timezone labels readable by removing underscores in the visible dropdown text
- keep saved values as exact IANA timezone strings such as `America/New_York`
- keep the edit modal body scrollable so the existing `Save Changes` submit path is reachable

Implementation note:

- `campaign.reportingTimeZone` remains the only source of truth
- create mode defaults from the browser IANA timezone when available and falls back to `UTC`
- edit mode defaults from the saved campaign value and falls back to `UTC`
- save propagation uses the existing campaign create/update request paths
- no GA4 metric formulas, KPI/Benchmark calculations, scheduler ownership, report generation logic, or source/campaign/property scoping changed

Local validation:

- `npm test -- --run server/ga4-reporting-timezone-regression.test.ts server/ga4-reporting-day-cutoff-regression.test.ts`
- `npm run check`
- `git diff --check -- client/src/pages/campaigns.tsx server/ga4-reporting-timezone-regression.test.ts`

Validation:

- create campaign UI shows `Reporting Timezone`
- edit campaign UI shows `Reporting Timezone`
- edit campaign UI keeps `Save Changes` reachable
- dropdown labels display readable values such as `America/New York`
- network payloads and stored campaign values keep valid IANA strings such as `America/New_York`

## Monitoring Checklist

Use this checklist during implementation and deployment validation:

- [ ] Trends shows completed-day cutoff date
- [ ] Trends shows reporting timezone
- [ ] Trends shows last refreshed timestamp
- [ ] missing-history copy names the timezone basis
- [ ] Render logs show next scheduled refresh time and timezone
- [ ] GA4 daily rows update after the expected refresh
- [ ] external revenue/spend sources update after their expected refresh
- [ ] stale warning appears only when refresh is late
- [x] generated reports include the same freshness metadata
- [ ] scheduled reports include the same freshness metadata after Reports scheduler refinement

## Open Decisions

- client-level defaults may be added later; campaign-level `reportingTimeZone` is the current source of truth
- GA4 daily refresh now uses a deployment-level configured reporting timezone; per-campaign scheduler fan-out remains out of scope
- external revenue/spend refresh now uses a deployment-level operations timezone; per-campaign refresh fan-out remains out of scope
- whether existing campaigns should be backfilled to `UTC` only or inferred from owner/browser/client context

## Current Status

Current production behavior uses the campaign reporting timezone for Trends cutoff, Trends freshness labels, and report timezone metadata. Campaign create and edit both expose and persist this setting. GA4 daily refresh and external revenue/spend refresh use deployment-level configured scheduler timezones and local scheduled times.

This is the current implemented contract. Per-campaign scheduler fan-out, client-level defaults, and final scheduled-report deployed evidence remain separate future validation items.
