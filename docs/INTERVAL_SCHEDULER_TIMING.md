# Restart-stable interval timing

## Scope and cause

The interval registrations previously used process startup as their time origin.
A deployment reset the entire four-hour or 24-hour wait. Fast polling intervals
also changed their position within the minute/hour. This was a timing defect,
not a change to source calculations or saved GA4 data.

The existing scheduler entry points now use `server/utils/anchored-interval.ts`.
`SCHEDULER_INTERVAL_ANCHOR_AT` is a fixed ISO UTC timestamp in each service's
deployment configuration. Retain it across releases; never generate it at build
or startup. Without a configured anchor, Unix epoch is the stable default.
Each interval uses the next strictly future multiple of its existing duration
from that anchor. The release retains the November 19 current live/test phases,
not the earlier process-start phases. UTC elapsed durations remain constant
across daylight saving changes; their displayed local time can change with DST.

## Registration inventory

| Entry point | Existing duration | Callback / boundary preserved |
| --- | --- | --- |
| LinkedIn / Meta / Google Ads / Instagram / TikTok | Each configured hours, default 4 | Existing source-specific refresh function and campaign/source scope |
| General snapshots | Hourly, daily or weekly; default daily | Existing aggregate/snapshot function; real GA4 ownership exclusion |
| Executive Summary snapshots | 24 hours | Existing non-GA4 snapshot function |
| Alert email reminders | Configured milliseconds; default 15 minutes | Existing enabled flag, throttling, dedupe and email eligibility |
| Google Sheets financial polling | Configured minutes; default 1 | Existing spend-then-revenue order and GA4 ownership guards |
| Legacy CRM polling | Configured minutes; default 5, only when GA4 does not own refresh | Existing Salesforce-then-HubSpot order and ownership guards |

The GA4 calendar scheduler, report cron, monitor cron, Google Sheets token
schedule and legacy midnight KPI timer are unchanged. GA4 source refresh,
publication and report-readiness decisions remain in their existing functions.
No migrations, source configuration edits, provider requests or manual refresh
are part of validation.

## Lifecycle and validation boundaries

Recurring timers register once per job name in a process, cancel on the existing
stop paths, keep their phase after restarts and clock delays, and skip local
overlap while their prior callback is pending. A delayed tick runs once, not a
backlog replay. Failed callbacks retain the next normal slot. Snapshot startup
captures at 30/60 seconds are retained; stopping the Executive Summary scheduler
also cancels its pending startup capture.

Executable tests cover actual scheduler entry points with provider/storage work
intercepted, including restart timing, supported frequencies, invalid config,
clock jumps, local overlap, failure recovery, disabled reminders, stop/restart,
and financial ownership gating. Existing publication, GA4 scheduling and source
failure tests check adjacent behavior. Deployed verification must check both
configured anchors, next-run log timestamps, unchanged other settings, saved
Promo values and unchanged GA4 run receipts.

This change does not add a distributed queue, cross-instance exactly-once
execution or downtime catch-up for these interval jobs. Existing source and
email deduplication remains authoritative during overlapping instances. It does
not certify provider success or all source lifecycle paths. Natural future job
completion must be verified from its own run evidence.
