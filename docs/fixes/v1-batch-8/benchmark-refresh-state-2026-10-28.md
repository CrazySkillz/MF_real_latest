# Benchmark refresh message correction — October 28, 2026

## Confirmed cause

The GA4 page classified both an ordinary browser publication check and the scheduler's `running` status as `stale`. The shared KPI/Benchmark consumer then described every stale input as a source that had **failed** to refresh. A successful background update therefore displayed the same failure badge, yellow summary and warning panel as an actual failed read. This was reproduced in the real rendered page with successful synthetic HTTP responses; no provider failure was required.

The exact display path is the scoped GA4 daily/status queries → `trafficKpiInputState` / `kpiTrafficInputState` → `resolveGA4KpiConsumerState` → Benchmark card and tracker. Conversion values come from the persisted, campaign/property-scoped daily facts; the warning did not establish that these values were lost or incorrect.

## Bounded correction

- `client/src/pages/ga4-metrics.tsx` separates a normal in-progress check as `updating`, preserving actual connection, daily-query and publication failures. Current metric values remain visible with a small Updating badge; the large failure panels are omitted for that state.
- `shared/ga4-kpi-consumer-state.ts` keeps updating values ineligible for scoring. Genuine unavailable/stale inputs retain precedence, and custom values retain their existing dependency rules. Overdue/unverified data no longer falsely asserts that a request failed.
- The shared KPI path receives the same distinction. Financial inputs remain the saved Overview values, with currency/date/error checks intact. Pending rows remain excluded from trackers and performance findings. An all-unscored Benchmark tracker shows an em dash for average progress rather than a misleading 0.0%.
- Existing report generation checks, calculations, API contracts, storage writes, scheduled jobs and alert delivery are unchanged. Browser PDF consumers retain their existing `eligible` gate; updating rows cannot become scored PDF performance rows.

## Validation

- `benchmark-refresh-reproduced-oct28.json`: before the fix, the rendered Benchmark showed the exact “A required source failed to refresh” sentence while the scheduler status was running and all source reads succeeded.
- `benchmark-refresh-fixed-oct28.json`: 235 tests passed across the rendered publication journey, shared KPI consumer states, Benchmark regression guards, saved financial inputs, publication sequencing and report generation gates. The browser test verifies retained values, no failure panel during running or delayed successful reads, scoring recovery, a real failed daily request, and failure recovery.
- `benchmark-refresh-financial-oct28.json`: 41 saved-financial tests passed, including two additional KPI/Benchmark cases proving updating values retain their exact financial amounts without scoring and actual failed reads take precedence. There are 237 distinct passing cases across the two final packets.
- Build results are recorded in `benchmark-refresh-oct28-build-checks.json`.

All test/build receipts are in `validation-2026-10-27-report-incident/`. Automated tests use isolated synthetic inputs, remove application credentials and block external network access.

## Production observations and limits

A separate PostgreSQL transaction enforced `REPEATABLE READ READ ONLY` for the exact Promo campaign, verified campaign/client ownership consistency and its selected property, and made no application writes. At 19:08 UTC, its 54 daily rows covered September 4–October 27 with 329 conversions; its saved Total Conversions Benchmark also held 329 against 500. The 08:00, 14:00 and 20:00 local scheduled work all completed without a recorded error. The latest completed at 19:06:57 UTC (20:06:57 Europe/Amsterdam). The sanitized receipt is `benchmark-refresh-production-observation-oct28.json` in the validation directory. A separate public scheduler-health read observed the normal running state during this natural cycle.

This proves a misleading normal-refresh message and the bounded local correction, not every possible reason for stale data. No personal browser, live account session, provider mutation or production cleanup was used. Deployment and live UI confirmation of the correction remain outstanding. Whole-tab readiness remains unverified; source add/edit/delete, general provider failures and delivery lifecycles are not recertified here.
