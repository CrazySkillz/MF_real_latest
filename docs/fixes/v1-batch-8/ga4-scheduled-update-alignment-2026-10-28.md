# GA4 scheduled updates and recurring Benchmark verification

## Requested behavior

Automatic GA4 updates follow the configured scheduled runs: currently 08:00, 14:00 and 20:00 Europe/Amsterdam. Idle pages must not reload metric/source queries every 15 or 30 seconds. Explicit source saves/removals still process their changes, and unfinished publications or failed reads must be able to finish/recover.

This supersedes the earlier minute-based Sheets and five-minute CRM polling targets in the canonical Overview/financial-source contract. Historical provider certificates describe their tested version, not the new cadence.

## Confirmed causes

The previous Benchmark display correction did not fix the recurring trigger. On deployed `07ff822c`, read-only observation of Promo recorded:

- 20:28, 20:32 and 20:37 UTC: the same successful publication timestamp but changing database publication versions. Each version change caused the browser to recheck its dependent views.
- 20:42:32 UTC: publication unavailable and status `delayed`.
- 20:42:33–20:44:16 UTC: an extra `revenue_change` work item was queued, leased and completed successfully. The status returned to `current` at 20:44:34 UTC, matching the user's disappearing warning.

The standalone Sheets/CRM loops still ran between scheduled GA4 cycles despite `GA4_DAILY_PIPELINE_OWNS_REFRESH=true`. Input writes changed publication versions, including when native GA4 data had not changed. The page also had independent status, financial, source and Pipeline timers. Separately, status-only reads recognized only an in-process native fetch attempt; a durable financial publication running without a native fetch could therefore be described as delayed.

Receipt: `validation-2026-10-27-report-incident/ga4-schedule-live-recurrence-oct28.json`. Application requests were GET-only, database reads were owner-checked/read-only, and the temporary diagnostic session was revoked. The saved native facts and Benchmark still contained 329 conversions. This incident did not establish damaged stored metric values, and no production data cleanup was performed.

## Exact correction and boundaries

| Path | Correction |
| --- | --- |
| `server/storage.ts` publication version read | Preserve the existing version and busy exception; attach whether all unfinished current work has a live running lease, and whether unfinished work is retryable. Campaign scoping and stale-write rejection are unchanged. |
| `server/routes-oauth.ts` authorized `ga4-daily?statusOnly=1` | Recognize a durable running publication. Return an additive `nextCheckAt` computed by the existing GA4 scheduler/timezone function. Idle checks wait for the next scheduled slot; unfinished/overdue work is checked once per minute. This route does not run a provider refresh. |
| `client/src/pages/ga4-metrics.tsx` | Remove independent periodic metric/source/Pipeline timers. Check status at `nextCheckAt`, then refresh scoped views once per completed publication. Include geographic and CRM Pipeline queries in the existing coordinator, without making their failures block unrelated financial/report types. |
| Browser recovery and explicit actions | Follow unfinished saved revenue publication and failed reads once per minute. Stop that follow-up when resolved. Existing source save/removal callbacks request a status check immediately, including last-source removal. Keep cached content, hidden-tab pause, focus/reconnect status checks, and report verification gates. |
| `server/auto-refresh-scheduler.ts` | Under default GA4 pipeline ownership, skip separate GA4 Sheets/CRM intervals. The existing ordered scheduled pipeline still invokes the underlying saved-mapping reprocessors. Preserve non-GA4 Sheets Spend intervals and explicit legacy mode with pipeline ownership disabled. |
| `server/google-ads-scheduler.ts` | The standalone timer excludes dedicated and legacy GA4 Spend-only connections under default GA4 pipeline ownership. Preserve separate Google Ads Connected Platform refresh, direct user-triggered refresh and the ordered GA4 financial stage. |

No provider selection, campaign mapping, attribution, aggregation, currency conversion, schema, scheduled report delivery, or source record replacement logic was changed. Publication version fencing was retained rather than weakening it to suppress refreshes. A genuinely failed or unverified read remains ineligible for scoring.

The default flag is the deployed architecture. Explicitly setting `GA4_DAILY_PIPELINE_OWNS_REFRESH=false` restores legacy interval behavior; this is not the requested deployment configuration. Token renewal and notification/report delivery schedules are separate from GA4 metric refresh and are unchanged.

## Validation

The final packets passed 857 distinct tests. TypeScript and production client/server builds passed. Commands, per-file results and raw-receipt hashes are recorded in `validation-2026-10-27-report-incident/ga4-schedule-validation-oct28.json`.

Coverage includes:

- Actual PostgreSQL pending/running/expired/reclaimed/completed/invalidated work, independent campaign reads, and existing stale-write guards. A pre-existing repeated-edit fixture now changes/restores the GA4 campaign filter because name-only edits intentionally preserve valid work.
- Authorized status route, wrong campaign/property, database failure, queued versus leased work, partial publication, retryable saved work, midnight and both Amsterdam DST transitions.
- Actual query observers and rendered page: no idle requests for 15 simulated minutes, scheduled detection, retained cards during publication, Benchmark scoring recovery, failed reads, hidden tabs, source-save callbacks and campaign/currency isolation.
- All seven affected browser save/removal success callbacks, with failed removals verified not to trigger a success publication check. These tests mock the existing APIs; they do not certify every provider mutation lifecycle.
- GA4 interval exclusion, retained legacy behavior, scheduled financial source processing and separate Google Ads platform refresh.
- Existing report/PDF generation, publication failure/recovery and saved financial display regressions.
- TypeScript and production client/server builds.

## Limits

This is a bounded schedule/verification correction, not a whole-tab or whole-app readiness certification. Provider add/edit/delete implementations, historical persisted-data integrity across all campaigns, email receipt and authentication production setup are not recertified here. No live source was edited or removed during validation. Natural operation of a future 08:00/14:00/20:00 slot requires post-deployment observation; local clock-controlled tests verify timing and publication behavior without forcing production refreshes.

Deployment and read-only live confirmation are recorded separately after push. An already-open page needs one reload to load the new client code.
