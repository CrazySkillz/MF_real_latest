# Campaign timezone refresh schedule — November 5, 2026

Status: deployed to the separate hosted test app as
`5ed8e816adfed6e7174c9687a0c9e18df01bb34d` on November 5. The hosted restart
preserved all 65 compared tables. Natural 14:00 Amsterdam completion is pending.
Not deployed to the live app. This is a bounded scheduler correction,
not a whole-platform production-readiness certificate.

## Current release queue

| Correction | Test status | Live status |
| --- | --- | --- |
| Overview ROAS display rounding (`258.825` displays as `258.83x`) | Hosted; focused checks passed | Not deployed |
| Restart discovery incorrectly attempted an older, superseded publication | Hosted; restart and regression checks passed | Not deployed |
| GA4 refreshes at 08:00 / 14:00 / 20:00 in each campaign's selected timezone | Hosted; natural scheduled completion pending | Not deployed |

The hosted release passed 606 checks across 11 files, TypeScript and both builds.
The current cross-task checklist is [Client testing and releases](../CLIENT_TESTING_AND_RELEASES.md).

The earlier restart investigation is documented in
[ga4-restart-recovery-2026-11-05.md](ga4-restart-recovery-2026-11-05.md).
Existing live legacy-credential failures remain a separate boundary documented
in [ga4-live-refresh-investigation-2026-11-05.md](ga4-live-refresh-investigation-2026-11-05.md).
No production data, credentials, schedules or campaign statuses were changed.

## Root cause and traced path

The create/edit form saves `campaign.reportingTimeZone` through the existing
campaign POST/PATCH routes and storage contract. That timezone already controls
completed-day reporting windows. The GA4 timer, recovery due-slot selection,
daily API freshness and alert freshness instead used the operations timezone
from `GA4_DAILY_REFRESH_TIME_ZONE`. A campaign in another timezone therefore
refreshed at the operations clock's hours, rather than its own local hours.

Trace:

`Campaigns Reporting Timezone -> campaign POST/PATCH -> campaigns.reporting_time_zone -> GA4 scheduler selection -> financial sources -> GA4 daily/Overview transaction -> KPI/Benchmark recompute -> financial/aggregate/Executive snapshots -> scoped alerts -> aligned completion marker -> daily API/status polling and report readiness`.

The campaign field, create/edit routes, ownership/version checks and persistence
schema are unchanged. Existing source mappings, property/campaign filters,
source IDs, provider request shapes, date windows and metric formulas are
unchanged. Only scheduling selection and its dependent freshness/readiness
decisions changed.

## Implementation boundaries

- `server/ga4-daily-scheduler.ts`: select the earliest active campaign-local slot;
  re-read campaign configuration at most one minute later while idle; dispatch
  only campaigns due since the last checked boundary. Retain a busy slot and
  retry schedule/target discovery failures after a minute. Stop/restart identity
  guards prevent an old asynchronous discovery from rearming a timer.
- The existing two-worker campaign pipeline and durable claims remain. Targeted
  startup recovery and scheduled claims derive due instants from the target
  campaign's timezone. Initial imports and explicit source changes keep their
  existing separate behavior. A long delay processes the latest applicable slot;
  it does not replay every missed intraday slot.
- Default hours are now `[8, 14, 20]`; explicit existing hour/minute overrides
  remain compatible. Missing/invalid persisted zones retain the existing UTC
  normalization rule. The process health `config.reportingTimeZone` remains the
  legacy fallback setting; `nextRunAt` is the earliest campaign-local due instant
  and the log identifies that instant's timezone. With no active campaigns it
  reports the fallback timer boundary, but publishes no campaign data.
- `server/auto-refresh-scheduler.ts`: an optional internal campaign-ID allowlist
  keeps financial refresh inside the same due-campaign set, including an empty
  set. Other callers retain their original scope and cadence.
- Timer batches use the existing scoped KPI/Benchmark alert checks. They omit
  the redundant global sweeps, which would otherwise touch unrelated timezones
  on every additional timezone batch. Non-timer behavior remains unchanged.
- Report readiness waits for campaigns actually in the current run. A campaign
  outside that run can still use its exact-date persisted completion marker.
  Discovery and reads spanning a new run continue to fail closed.
- `server/routes-oauth.ts`: the existing daily response fields, displayed
  schedule, overdue deadline and browser `nextCheckAt` use the authorized
  campaign's reporting timezone. Response field names and shapes are unchanged.
- `server/utils/ga4-alert-current-value.ts`: stored-traffic freshness receives
  the saved campaign timezone. Financial and traffic formulas are unchanged.

Schedule times are intended start times. Provider latency, queued worker slots,
outages and retries can delay completion. `Last successful update` remains an
actual successful import timestamp; it is not rewritten to a scheduled time.

## Local validation

Ten selected test files: **601 passed, zero failed or skipped**. The first
combined run exposed one outdated test fixture that evaluated a 10:00 local
import at the newly defaulted 14:00 deadline. The engagement-value test now
explicitly runs before that deadline; separate freshness cases verify stale
values at the deadline. The complete affected HTTP-route file then passed.

Files exercised:

- `ga4-daily-scheduler-regression.test.ts`
- `ga4-refresh-pipeline-source-failure.test.ts`
- `ga4-refresh-status-regression.test.ts`
- `ga4-browser-publication-refresh.test.ts`
- `ga4-refresh-attempt-regression.test.ts`
- `ga4-kpi-real-path-parity-regression.test.ts`
- `ga4-auto-refresh-regression.test.ts`
- `notification-visibility-regression.test.ts`
- `ga4-overview-roas-rounding.test.ts`
- `ga4-overview-reporting-note.test.ts`

Behavioral coverage includes Amsterdam/London/New York independent dispatch;
Kathmandu/Kolkata/Adelaide fractional offsets; northern/southern DST and date-line
next-run calculations; create/activate/edit/pause/delete discovery; busy-slot
deferral; failed discovery retry; stop during an asynchronous read; native
claim due instants; source-failure isolation; two-worker concurrency; report
readiness while another timezone runs; exact HTTP response metadata and saved
Summary totals; browser polling; stale alert gating; and the earlier restart
and ROAS regression cases. Provider/storage edges are controlled in these tests;
they are not evidence of natural multi-zone production execution.

Commands: `node node_modules/vitest/vitest.mjs run <the files above>`,
`node node_modules/typescript/bin/tsc --noEmit`, and a bundled server build using
the existing esbuild dependency. TypeScript and server build passed.

Ignored evidence receipts in `.local-test/`: `timezone-validation.json`,
`timezone-route-tests.json`, `timezone-final-test-summary.json`,
`timezone-typecheck.log`, `timezone-build.log`, and `timezone-source-parity.json`.

## Isolated app check

The existing test app was restarted with the updated source. Hashes match all
four changed runtime files. The dedicated loopback PostgreSQL database was
identity-checked and read inside read-only transactions before and after.
All nine campaign-scoped data sets have identical before/after hashes:
campaign, GA4 daily facts, Overview snapshot, metric snapshots, Revenue and
Spend source/record tables, and refresh work.

At this check the fixture contained 31 daily rows, 959 Sessions, 959 daily-summed
Users, 93 Conversions and EUR 28,501.50 native Revenue. These figures were
already present before loading this fix, following the earlier 08:00 refresh;
the timezone update/restart did not change them. This check proves preservation,
not a new independent provider reconciliation.

After restart: no bootstrap refresh, no scheduler error, and next run
`2026-11-05T13:00:00Z` = **14:00 Europe/Amsterdam**. Evidence:
`timezone-local-before.json`, `timezone-local-after.json` and the local read-only
verification script `check-timezone-local.cjs` (all ignored).

## Remaining release checks

- Deploy the reviewed code through the agreed release workflow, then verify the
  exact deployed revision and campaign-local API schedule.
- Observe a natural scheduled completion on that deployed revision. Actual
  cross-zone production timing, provider outages, DST execution and multi-process
  contention have not been exercised by this local change.
- The existing test campaign remains in Amsterdam. Other zones were exercised
  deterministically; no client configuration was changed to manufacture a test.
- No production cleanup, backfill, database migration, email send, financial
  source reconfiguration or broader analytics certification was performed.
