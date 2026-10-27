# Scheduler health reporting correction - October 27, 2026

The constant healthy label is corrected locally. **84/84 targeted tests pass**, TypeScript and the server build pass. The user authorized committing and pushing this packet on October 27; hosted CI and deployment verification remain pending. Base revision is `997f1c39ba2904ff0805ddb154715a75b4267578`. V1-010's broader operational acceptance remains OPEN; this is not whole-app production sign-off.

## Confirmed cause and traced boundary

`server/index.ts` registers `GET /health/scheduler` and always returned `status: 'healthy'` unless a status getter threw. The endpoint could therefore return healthy alongside auto-refresh and GA4 daily `lastRunStatus: 'failed'`. The [deployed observation](validation-2026-10-27-deployed/post-deletion-scheduler-2026-10-27T08-04-07-667Z.json) records exactly that contradiction. Old failures after user deletion are historical evidence, not proof that deleted campaigns ran again.

Traced path: public GET -> `getSchedulerMetrics`, `getAutoRefreshSchedulerStatus`, `getGA4DailySchedulerStatus`, `getFinancialDailySnapshotObservationStatus` -> in-memory diagnostics -> JSON response. Reviewed producer transitions include idle, running, skipped, failed and successful refreshes; report poll/delivery errors and successes; and snapshot readiness/write outcomes. Repository callers found are diagnostic scripts, not a current UI action. `render.yaml` uses the separate `/health` endpoint for process liveness.

The only runtime change is in the existing handler in `server/index.ts`: capture each existing getter once and derive `healthy`/`unhealthy` from recorded report errors, refresh failed states/retained errors, or confirmed snapshot write failures. Diagnostic fields and payloads are unchanged. An available diagnostic response remains HTTP 200; inability to read state retains the existing HTTP 500 path. No job is run, rescheduled, reset, retried or cancelled by this GET. There are no storage, provider, source, calculation, report-generation or frontend changes.

## Status semantics and limitations

| Existing evidence | Monitoring result / limitation |
|---|---|
| Auto-refresh or GA4 daily status is failed, even without error text | Unhealthy. |
| Refresh has retained error text during running/skipped state | Unhealthy; reading health does not clear it. |
| Successful refresh has cleared its error but retains an older error timestamp | That timestamp alone does not keep the result unhealthy. |
| Report scheduler retains an error or error timestamp | Unhealthy. A later success may belong to another report and cannot prove recovery of the failed report. |
| Snapshot observation records a failed write | Unhealthy. Missing readiness while work is pending is not invented into a write failure. |
| No failure is currently exposed by these producers | Healthy means no recorded failure in this observation, not proof of completed work, fresh data, or whole-service readiness. |

The endpoint remains an in-memory diagnostic. Report error fields are retained by the existing producer until process restart; this fix does not add acknowledgement or clear them after an unrelated success. Auto-refresh already clears its error at the start of a new run, while GA4 daily clears it on success. This change does not invent missing per-campaign history, prove that stopped/missing timers are safe, or turn these producer fields into a complete recovery/liveness watchdog. Durable work state and natural refresh evidence remain separate acceptance requirements. Error timestamps and detailed state remain available to distinguish historical failure from a current outage.

## Validation and files

`server/v1-batch8-scheduler-health.test.ts` executes the actual extracted handler in isolation, without starting the application. Before the fix, **10 failure-reporting cases failed and 13 control cases passed** ([reproduction](validation-2026-10-27-health/before-summary.json)). The initial sandbox run could not spawn esbuild; [startup log](validation-2026-10-27-health/before-sandbox-startup.log) is retained separately and is not a product failure.

After the localized runtime change, one neighboring source-text assertion still required the old inline getter syntax. Its assertion was updated to the captured getter syntax; no output expectation was relaxed. The same update was made to the GA4 observability assertion. Both existing test files remain included in the final run:

- `server/ga4-scheduler-observability-regression.test.ts`
- `server/financial-daily-snapshot-observation.test.ts`

Final [results](validation-2026-10-27-health/final-summary.json) and [command log](validation-2026-10-27-health/final.log): **84/84 tests in six files, zero failures/skips or reported run errors**. Coverage includes all 23 new handler cases, exact response payload preservation, one getter call each, no state mutation, HTTP error behavior, independent Render liveness, neighboring snapshot observation/readiness, scheduler startup and the prior interval/publication exclusion.

[TypeScript and server build](validation-2026-10-27-ci-scheduler/health-build-checks.json) both exit zero. No client build is claimed because client code is unchanged. The isolated runner strips application/provider credentials, sets an empty database URL and blocks external Node HTTP. No production read/write, provider call, email or personal-browser access was performed for this correction. `git diff --check` passes.

The full hosted 6,497-test pass belongs to the deployed base revision; it is not a full-suite result for these new bytes. A future commit requires hosted CI and a read-only deployed `GET /health/scheduler` check. No UI action is needed to validate this monitoring-only change. No destructive-path retest or new report generation is required by this diff.

## Release disposition

The bounded constant-label defect is locally corrected. V1-010 remains OPEN for deployed monitoring and complete scheduler/recovery acceptance. V1-012 remains CLOSED for its previously verified exact revision, with new-candidate CI still pending. V1-013/014/016/018/019/020 remain OPEN under the [complete release-gate inventory](GA4_FIRST_REGRESSION_CHECKPOINT.md#complete-batch-8-release-disposition); no finding count changes. The natural emailed Ad Comparison artifact, postponed live Google Ads and other documented external acceptance are not supplied by these tests. The prior read-only orphan-record disposition remains unchanged. **Batch 8 IN PROGRESS; V1 NO-GO.**
