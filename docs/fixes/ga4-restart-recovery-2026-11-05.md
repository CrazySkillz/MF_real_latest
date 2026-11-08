# GA4 restart recovery — November 5, 2026

**Release update:** deployed live as `706a7bac` at 16:02 Amsterdam on November 5.
The production restart restored the three monitored campaigns' completion markers,
ran no bootstrap, and preserved all 27 compared data sets. The original local
investigation below is historical; its deployment-pending wording is superseded
by the [live release evidence](ga4-live-release-2026-11-05.md).

## Result and scope

The isolated local test app now restarts without attempting an obsolete refresh
or reporting `GA4_REFRESH_WORK_OWNERSHIP_LOST` for the observed campaign.
This is a bounded startup-discovery correction. Production has not been changed,
and this is not a whole-app, all-scheduler or analytics-readiness certificate.

## Confirmed root cause

At the failing 01:15 Amsterdam restart on November 5, the latest scheduled slot
was November 4 at 20:00. Its reporting date was November 3. The test campaign
already had a newer, successful November 4 publication, completed at 01:07:35
on November 5 following the EUR 100 CSV Spend import.

Startup discovery checked only the earlier slot's November 3 completion marker.
Finding none, it requested a bootstrap with the previous 20:00 due time. In
`ensureGA4RefreshWork`, the newer non-invalidated `revenue_change` work dated
01:07 correctly superseded that older due time. Storage returned no work;
the pipeline raised `GA4_REFRESH_WORK_OWNERSHIP_LOST` before fetching GA4 or
changing numerical data. The stale discovery decision was the broken boundary;
the newer-work exclusion was a necessary safety guard.

The exact local state is recorded in `.local-test/restart-recovery-before.json`:
one completed current revenue-change work item, an earlier invalidated pending
item, two invalidated completed items, and the November 4 aligned marker.

## Traced path and localized correction

`startGA4DailyScheduler -> backfillMissingGA4OverviewSnapshots ->
getGA4AlignedRefreshState -> getExecutiveSummaryDailyComparisonData ->
runGA4DailyRefreshPipelineForTrigger -> ensureGA4RefreshWork`.

- `server/ga4-daily-scheduler.ts`: retain the primary saved daily date during
  discovery. When the due slot has no timely completion marker, check the same
  campaign's newer saved daily date, bounded by its latest completed reporting
  date. Its aligned completion must still fall between the due slot and now.
- Existing structural snapshot, currency, reporting-window and required-input
  checks remain independent; a newer marker does not clear a repair already
  required by those checks.
- Storage claim/version checks, formulas, records, regular timers, request
  contracts, source refreshes and report-send behavior were not changed.
- `server/ga4-daily-scheduler-regression.test.ts`: ten targeted cases cover
  absent/stale older markers, missing/malformed/future/too-old/wrong-date newer
  markers, unmatched daily data, missing financial inputs, and the next 08:00 slot.
- `GA4/REFRESH_AND_PROCESSING.md` links this bounded evidence.

## Validation

- Before the correction: 2 new cases failed and 52 cases passed in the scheduler
  regression file, reproducing the unnecessary bootstrap for absent/stale
  older-day completion markers.
- After the correction: **314 passed, zero failed/skipped**, across scheduler
  regression, ordered source/failure pipeline, refresh-attempt and refresh-status
  suites. Existing cases cover real missed slots, DST, multiple campaigns,
  source failures, publication ordering, concurrency and ownership boundaries
  using controlled database/provider boundaries.
- `tsc --noEmit` and scoped `git diff --check` passed.
- Actual isolated test-app restart at **07:55:24 Amsterdam**: no bootstrap run,
  no startup failure, and the existing November 4 completion marker was restored
  from persistence. The next timer remained **08:00 Amsterdam**, with the
  configured hours **08:00, 14:00, 20:00**. Served scheduler source matches the fix.
- Before/after SHA-256 comparisons were identical across all nine inspected
  campaign data sets: campaign, GA4 daily rows, Overview, metric snapshots,
  Spend sources/records, Revenue sources/records and refresh work. Sessions 869,
  daily-summed Users 869, Conversions 86 and native Revenue EUR 25,882.50 remained.
  No persisted cleanup or numerical rewrite was required.

Receipts: `.local-test/restart-recovery-red.json`, `restart-recovery-green.json`,
`restart-recovery-health-after.json`, and `restart-recovery-values-before.json` /
`restart-recovery-values-after.json`.

## Remaining boundaries

No production deploy/restart, forced provider refresh, live failure injection,
full PDF validation or email delivery was performed. The next natural timer run
has not yet been observed on this correction. Other startup failures and
historical damaged-data scenarios are not certified by this specific repair.
The separate five historical live campaign failures remain as documented in
[the live investigation](ga4-live-refresh-investigation-2026-11-05.md).
