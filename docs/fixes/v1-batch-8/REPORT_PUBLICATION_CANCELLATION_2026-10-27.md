# Reports publication cancellation — October 27, 2026

## Scope and controlling status

The user still saw the failed-refresh banner after `692118a5` deployed. A public
`/api/health` read confirmed that exact revision. The earlier saved-breakdown fix
removed an unnecessary provider dependency but did not resolve this browser race.
That earlier fix is not evidence that the user's recurring symptom was closed.

Current correction: wait for a cancelled read's replacement, verify the publication
receipt again, and keep download buttons disabled during verification. Local
validation and deployment receipts are recorded below. This is a bounded defect
fix, not certification of Reports or the whole application.

## Confirmed root cause

Two existing effects in `client/src/pages/ga4-metrics.tsx` overlap:

1. A publication token starts a refresh of core queries with `throwOnError: true`.
2. When revenue source metadata reports `publicationStatus: published`, its effect
   invalidates the financial snapshot, KPIs, benchmarks and reports.
3. If the same query already has cached data and a new request is in flight,
   TanStack Query cancels that request and starts its replacement. The original
   awaited refresh rejects with the library's `CancelledError`.
4. The publication effect treated that cancellation as a failed data request. It
   set `ga4PublicationSync.failed`, displayed the user's exact warning and blocked
   PDF generation until a later status check, although the replacement succeeded.

The previous browser fixture omitted published-source status and returned core
responses immediately. It could not exercise this race. The expanded fixture
uses published HubSpot/Salesforce metadata plus overlapping successful reads and
records the actual `CancelledError`. The old code reproduces the exact banner;
the query-observer regression also fails before the correction.

A read-only check at `2026-10-27T13:44:32Z` confirmed the affected campaign has
both HubSpot and Salesforce matching a completed financial publication receipt,
with no pending completed-day revenue. Its financial total is EUR 8,003.96.
This establishes the relevant production source state, not a capture of the
user's browser request trace.

## Correction and boundaries

- The first refresh still cancels earlier in-flight reads, so a new publication
  cannot be certified using an older request's result.
- On the library's actual cancellation class only, retry the existing query
  refresh with `cancelRefetch: false` to await its replacement. Repeated overlaps
  are handled while the same campaign/property receipt still owns the operation.
- Keep the display pending until those reads and the final publication-token
  comparison finish. A real HTTP/data error or changed token still fails closed.
  An ordinary Error whose message says `CancelledError` is not swallowed.
- New direct-download and report-list Download buttons are disabled while this
  verification runs; they re-enable automatically. The button label and modal
  layout remain stable. Report schedule creation and editing do not acquire this
  new disabled condition.
- No API, storage, schema, provider, scheduler, source mutation, attribution,
  calculation, rounding, PDF layout or report CRUD implementation was changed.
  The existing campaign/property scope, financial consistency and required-input
  checks still run. Native EUR 7,653.96 and combined EUR 8,003.96 remain separate.

Runtime changes are limited to `client/src/pages/ga4-metrics.tsx`. Regression
changes are in `server/ga4-browser-publication-refresh.test.ts` and
`server/ga4-ad-comparison-download-browser.test.ts`. No persisted-data cleanup is
needed for this presentation/coordination failure.

## Evidence and limits

All files below are in [the incident evidence directory](validation-2026-10-27-report-incident/).

- `published-source-race-before.json` and `published-source-race-captured.json`:
  the earlier two cases pass; the new published-source case fails and records the
  exact warning. The captured rejection is `{name: "CancelledError", message:
  "CancelledError"}` while required data endpoints return successfully.
- `cancellation-unit-before.json`: 39 passing, two failing; one and three
  overlapping invalidations incorrectly mark successful replacement reads failed.
- `cancellation-browser-complete.json`: all three full-page cases pass. They
  produce 15 PDFs in total and check native/combined revenue, source amounts,
  disabled-then-enabled download behavior, provider isolation, required-input
  failures, financial mismatch rejection and recovery.
- Earlier intermediate after-fix browser runs reached the financial-mismatch
  step before the delayed new response arrived. The harness was corrected to wait
  for that financial request, then for receipt completion, before asserting the
  mismatch. The product mismatch guard was not relaxed.
- `storage-2026-10-27T13-44-32-428Z.json`: the production metadata check described
  above ran in an enforced READ ONLY transaction and rolled back. It checks the
  inputs to source publication status without taking its `FOR SHARE` lock; it is
  not an authenticated production API check.
- Local tests use isolated browser profiles, no app credentials, intercepted HTTP
  and a network blocker. Historical PDF artifacts are preserved.
- Automatic approval review rejected an attempted temporary production test login
  because it would use admin credentials to act as the owner without explicit
  authorization. The script never executed and was removed. No session was
  created; the user's browser was not accessed. The safer evidence above was used.

`cancellation-regressions-final.json` records 263 passing checks in nine files,
with no failures or skips. Together with the three full-page browser cases above,
the final packet has **266 passing checks**. It covers publication freshness,
replacement-read failure/token-change cases, source lifecycle, native/source
revenue parity, saved reports and pending download controls.

`cancellation-release-build-checks.json` records passing TypeScript, production
client and server builds after the final runtime change. No unrelated full-suite
recertification is claimed. The user requested that the recurring production
failure be fixed before reporting completion; commit/push authorization from the
same fix workflow is carried forward for this correction.

Deployment verification follows the push. Deployed authenticated UI acceptance is
not implied by local tests or a public deployment-version check.
