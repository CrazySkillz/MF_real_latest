# Reports publication cancellation — October 27, 2026

## Scope and controlling status

**Latest user clarification, after `020e0e9f`:** the recurring text is
"Updating displayed figures. Some sections may still show the previous update."
on Overview and Reports. It eventually disappears, with intermittent download
errors also reported. This is the pending message, not the named failed-request
warning. The public route serves the current assets; prior hosted CI passed
6,551 checks. Neither fact establishes deployed acceptance. The localized UI
correction and its evidence are recorded below; authenticated live acceptance
remains open.

**Reopened October 27, after `49202eaf`:** the user reports the warning remains
for several minutes after loading Reports. The earlier cancellation fix is not
proof that this recurrence is resolved. Current read-only storage/handler checks
succeed, and a separate normal-publication-handoff defect is reproduced below.
The persistent authenticated production failure remains unverified until the
updated deployed page is checked. Do not certify this path from the local fix.

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

## Follow-up: publication handoff and persistent-warning investigation

The completion callback also treated a successful status response containing a
new or temporarily absent publication token as a failed request. The browser
fixture now opens Reports directly and records DOM warning transitions. With
all HTTP requests successful, the old code renders the exact failure warning
when the second status read reports a newer token. The regression in
`recurrence-handoff-warning-before.json` fails; `recurrence-handoff-after.json`
passes after the localized correction. This proves a false-warning path; it does
not establish that this is the only cause of the user's several-minute warning.

The callback now releases the previous receipt before checking the status again.
A newer receipt starts its own scoped reads; a temporarily absent receipt remains
pending. Downloads remain blocked until that receipt and its reads are verified.
Actual request failures still set the failed state and retry on the existing
30-second status interval. The warning names the failed query section using only
known query-key labels, never raw response errors, identifiers or credentials.

Runtime changes are confined to `client/src/pages/ga4-metrics.tsx`. The two tests
changed are `server/ga4-browser-publication-refresh.test.ts` and
`server/ga4-ad-comparison-download-browser.test.ts`. No calculation, rounding,
PDF layout, API, database, provider, scheduler or source-write code changes.

Read-only investigation receipts in the same validation directory:

- `storage-2026-10-27T16-05-35-652Z.json`: current campaign EUR scope, selected
  property campaigns, import start September 23, latest completed day October 26,
  saved native revenue 7,653.96 and a completed publication marker.
- `storage-2026-10-27T16-11-42-966Z.json`: all 15 stored-data/status handler
  invocations return HTTP 200 against the exact campaign's database snapshot;
  KPI and Benchmark lists are empty, and one saved report exists. These are
  local handler executions, not authenticated hosted HTTP requests. The diagnostic
  omits one FOR SHARE lock because PostgreSQL READ ONLY prohibits it; locking,
  pool contention and hosted middleware are therefore not certified by this read.
- All diagnostic transactions use verified database identity, verified owner/client
  boundaries for route execution, TLS verification and enforced READ ONLY, then
  roll back. Provider access is blocked. No production state was changed.

The existing diagnostic script gained explicit read-only modes, not application
runtime behavior. Earlier intermediate diagnostic failures were missing isolated
helper bindings or the intentionally prohibited lock, not observed production errors.

Final local validation: `recurrence-final.json` records **192/192 passing tests
in eight files**, including six real-page browser cases and 30 generated PDFs.
It covers direct Reports loading, overlapping published-source reads, successful
token handoff, a three-minute missing receipt, a three-minute genuine failure,
automatic recovery, status/read failures, financial mismatch rejection and
campaign/property isolation. `recurrence-final-build-checks.json` records passing
TypeScript, production client and server builds. `git diff --check` passes.

The public deployment read during investigation still reported `49202eaf`.
Publication of this correction and authenticated live acceptance are recorded
separately; the user's several-minute symptom is not declared resolved here.

## Follow-up: quiet refresh transitions and consistent download controls

The clarified symptom has two confirmed UI causes. `ga4PublicationDisplayPending`
includes ordinary background fetches. Rendering a paragraph for every pending
read inserts and removes a row above all tab contents. Separately, both download
buttons checked only pending state, whereas `downloadGA4Report` rejects both
pending and failed verification. After a failed check, the button became enabled
and offered an action guaranteed to fail immediately.

The path traced is the page's scoped TanStack queries and publication receipt,
the shared tab status paragraph, the new-report submit condition and saved-card
Download control, and the actual PDF preflight. The API/storage reads, receipt
verification, field-level report checks and PDF generation are unchanged.
Routine pending reads now keep the page layout stable; genuine failed-check
warnings remain visible. Both download entry points wait for successful checks,
expose a busy attribute while checking, and re-enable automatically on recovery.
Schedule creation and editing remain available because they do not generate a PDF.

Only `client/src/pages/ga4-metrics.tsx` changes at runtime. Regression changes are
in `server/ga4-ad-comparison-download-browser.test.ts`,
`server/ga4-browser-publication-refresh.test.ts`, and
`server/ga4-publication-browser.test.ts`.

Evidence in the incident validation directory:

- `quiet-refresh-before.json`: a held ordinary financial read reproduces the
  unwanted paragraph in the real rendered page, with all fixture requests valid.
- `quiet-controls-before.json`: the failed-verification case proves the enabled
  button disagrees with the unchanged download guard.
- `quiet-refresh-after.json`: the same held read preserves the Overview card's
  vertical position and EUR 8,003.96; new and saved download controls stay disabled
  while pending/failed, recover automatically, and generate six correct PDFs.
- `quiet-refresh-regressions.json`: 190 checks pass, including a rendered-page
  publication/date rollover test, failed-read recovery, hidden polling, currency
  isolation, source/financial parity, report precision and subsection guards.

All browser work uses fresh isolated profiles and intercepted fixture requests,
with no access to the user's browser or production credentials. No production
records are changed. There is no damaged-data cleanup for this presentation-only
change. These results prove the UI defects and correction; they do not establish
why any individual hosted request previously failed or how long it took. Genuine
request failures continue to be surfaced and retried by the existing coordinator.

Final local packet: **197 passing checks, zero failures**, across nine test files.
The complementary `quiet-refresh-after.json` and
`quiet-refresh-browser-neighbors.json` runs cover all seven report browser cases
(36 PDFs); the separate publication browser test also passes. Filtering avoids
running the same browser case twice and does not omit any of these scenarios.
`quiet-refresh-build-checks.json` records passing TypeScript, production client
and server builds. `git diff --check` passes. Deployment verification follows
the commit/push; it does not substitute for authenticated live UI acceptance.

## October 27 demo preparation: unrelated report dependencies

The user supplied a successful October 27 Ad Comparison PDF. Its revenue
breakdown reconciles to EUR 8,003.96 and sessions reconcile to 604, matching the
previous supplied artifact. A successful artifact does not close the reported
intermittent download failure. The user postpones custom-domain and Clerk
production changes until after the demo; no identity or deployment setting is
changed by this correction.

The confirmed client defect is an overly broad publication gate. The Reports
page mounts Landing Pages, Conversion Events and the saved-report list alongside
Ad Comparison's financial inputs. `isGA4PublicationQuery` included all of these
reads in the awaited invalidation. A slow read held the entire publication
pending, and a failed read set its shared failure flag. That flag disabled both
download controls and made `downloadGA4Report` reject a valid Ad Comparison PDF.
The three new real-QueryClient regressions fail on the unchanged runtime for
exactly this reason (`report-dependencies-before.json`: 50 pass, 3 fail).

The localized correction stays in `client/src/pages/ga4-metrics.tsx`. It uses the
existing independent Insights-refresh pattern for these three additional reads.
They still refresh on a new publication; failed reads retry on subsequent status
checks without making the financial publication fail. Campaign/property filters,
financial receipt verification and financial/currency/date/provenance guards
remain in place. Overview and Custom reports that include Landing Pages or
Conversion Events now explicitly wait for those exact inputs, including cached
data whose latest refresh failed. The same check applies to the PDF handler and
new/saved download controls. Schedule creation/editing still does not require an
immediate PDF download.

The traced boundary is the three existing query definitions and their scoped
cache keys, publication invalidation/receipt, UI download controls, report
preflight and PDF generation. No API, storage, schema, provider refresh,
financial calculation, scheduler or persisted record changes; there is no data
cleanup in this fix. Source lifecycle acceptance and production identity setup
are not recertified by these tests.

Validation receipts use `report-dependencies-*` in the existing incident
validation directory. The completed packet covers **259 passing checks** across
ten files and **57 browser-generated PDFs**, with no unresolved failures.
`report-dependencies-summary.json` records source and receipt hashes. The initial
browser run passed all eight existing cases; its three added cases stopped on
ambiguous test selectors and a fixture `error`/`message` mismatch. Only those
three cases needed rerunning after test corrections, and all three now pass.
They exercise slow/failed independent reads, successful Ad Comparison downloads,
Overview detail gating through new and saved controls, and automatic recovery.
Existing cases retain financial mismatch rejection, real core-failure gating,
publication handoff, cancellation, and quiet transitions. Final TypeScript,
client production build, server build and whitespace checks pass. All browser
checks use fresh isolated profiles and intercepted synthetic requests, with no
personal browser or production credential access. The exact failed request in
the user's earlier live session remains unknown; this is a reproduced defect
and bounded correction, not proof that every possible hosted failure is gone.
The user has requested commit and push of this tested correction. Deployment
verification and the authenticated live check remain outstanding.
