# GA4 KPIs Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

2026-08-28 revalidation: the authoritative machine record certifies deployed runtime boundary `19f055372abe8aee789dd4205eba5decef5f39a5`. The only runtime delta from `4be16c54` is a Campaign DeepDive Budget PDF ROAS presentation correction inside the shared report scheduler. Exact production health, authenticated read-only KPI validation, supporting Benchmark parity, the protected current-version boundary, TypeScript, and the production build passed. Older narrative SHA references below are revision-specific history where they differ.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `KPIs` tab.

Use this file when asked whether GA4 KPIs are robust, accurate, logical, production-ready, or suitable as a template for another platform source such as Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration.

`GA4/KPIS.md` defines what the KPI tab is supposed to do.

This file defines whether the current implementation is production-ready, what has been proven, what is only partially reviewed, what is not locally verifiable, and the current fix queue required before any future production-ready claim.

## Current Status

<!-- ga4-kpi-certification-status: PRODUCTION_READY -->

### August 28, 2026 exact-SHA revalidation decision (controlling)

**Result: PRODUCTION_READY for certified KPI runtime boundary `19f055372abe8aee789dd4205eba5decef5f39a5`.** Production health returned that exact SHA. Authenticated read-only validation matched all eight configured KPI cards, Tracker, Notifications, KPI-derived Insights findings, and browser-PDF rows with no application mutations and unchanged semantic persistence. Revenue was `$72,766.69`, Spend `$2,699.75`, financial conversions were `251`, and ROAS was `26.95`. Stale traffic-dependent inputs failed closed. The complete current-version boundary has zero blocking failures after certification-record refresh; 35 declared future-platform failures remain visible and nonblocking. TypeScript and production build passed. Reports and scheduler evidence remain separately bounded.

## Historical Status And Evidence (non-authoritative)

The following August 15 record is retained as revision-specific history:

- legitimate newer shared work: ownerless-campaign fail-closed KPI/Benchmark jobs and alert suppression, exact-owner notification visibility, read-only validation routing, and successful-campaign isolation in the GA4 daily scheduler
- unaffected KPI behavior: later Overview certification/copy changes and unrelated certification documentation do not change KPI values, formulas, CRUD, source precedence, alerts, or report payloads
- corrected KPI regressions: commit `950307b6e1863fb2580a885679655044dec0ca23` prevents Insights Trends freshness from contaminating KPI card/PDF state; commit `1a93d8d88debba4baefd666aa063c59b10b00e95` makes visible KPI Notifications use the same stale stored-traffic guard as KPI cards
- explicitly unaffected protected behavior: the Notification fix keeps Benchmark notification resolution on its existing path and does not change Overview, Ad Comparison, Insights calculations, Reports runtime, or unrelated behavior

Release-candidate evidence:

- `npm run test:current-version` executed 1,539 tests: 1,494 passed, 45 explicitly deferred future-platform failures remained visible and nonblocking, and zero blocking current-version failures remained
- the focused Notification/adjacent KPI packet passed 5 files / 51 tests; the real-path parity file passed 34/34; `npm run check` and the certification-integrity checker passed
- the exact-SHA authenticated read-only validator returned `candidate_evidence_passed` with exactly 12 campaign-scoped GA4 KPIs
- all 12 KPI cards were exact, including visible value, target, reporting window, state, and alert pulse; the Tracker was exact at 12 total, 4 scored, 4 above, 0 near, 0 below, and 100 average
- Notifications were exact with no visible rows for stale traffic-dependent KPI alerts; historical notification/audit rows remained persisted rather than being deleted
- all 12 KPI-derived Insights findings were exact, and every selected browser-PDF KPI row matched name, window, current value, target, and state
- no unsafe GET or application mutation was attempted, and the before/after database comparison recorded `persistenceSemanticStateUnchanged: true`
- the natural timer fired on deployed SHA `85f5233ebfc298afc35f4c24e0930c1a66fbd07c` at `2026-08-14T20:35:00.001Z`; the target recompute updated all 12 KPIs with zero KPI skips and zero KPI failures. The process-wide run failed because of 17 excluded obsolete campaigns, so it is not described as globally successful. Later commits `950307b6` and `1a93d8d8` did not change the scheduler or KPI recompute pipeline; an exact-`1a93d8d8` natural timer run is not claimed.

The final gate is closed. A controlled recompute-backed manual KPI snapshot and PDF matched all 12 persisted KPI rows exactly on `892ff339`; failed email attempts created no false snapshot or `lastSentAt`, and the successful controlled Overview report created one truthful sent event/snapshot with provider-confirmed delivery and user-confirmed inbox/PDF receipt. Natural KPI scheduler evidence carries from `85f5233e` because `server/ga4-daily-scheduler.ts` and `server/ga4-kpi-benchmark-jobs.ts` are byte-identical through `892ff339`; no exact-`892ff339` natural timer firing, future provider availability, or global all-campaign scheduler health is claimed.

### Current Commit 14B final-validation attempt - August 5, 2026 (historical)

**Result: UNVERIFIED for exact deployed SHA `249fc18787409fb5d3700a7f64e091822a99c2d3`.** Commit 14A is complete: its runtime boundary is `d5715867adf7e31279f52e1ebd806c3f4d3597fe`, and `249fc187` adds evidence only. Commit 14B was handled as one combined task and no runtime defect was found, but the external report/delivery evidence could not pass under the exact authorization and provider state below. No additional gate or implementation queue is created.

Root cause and authoritative contract:

- GA4's identically scoped dimensionless aggregate returns 378 engaged sessions while exact date-dimension rows return 377 for property hash `a3d79a4ad228`, campaign-filter hash `7cbbe7e2b10f`, timezone `Europe/Amsterdam`, and completed window `2026-07-06..2026-08-04`
- the persisted KPI contract is the weighted result of the exact completed-day rows; the unmatched aggregate session cannot be assigned to a date without invention, so it remains diagnostic only
- the corrected validation endpoint now exposes both numerators and uses the date-dimension numerator; alert/notification enrichment preserves the same value, and `GET /ga4-daily?readOnly=1` cannot refresh, backfill, refresh tokens, or persist

Authorized production action and scope:

- public `/api/health` returned production SHA `249fc18787409fb5d3700a7f64e091822a99c2d3`
- exactly one authenticated `POST /api/campaigns/:id/ga4/refresh` was issued for campaign hash `fc734ddaf728`; normal token handling and persistence were authorized, and no second recompute was issued
- the boundary was one owner hash `1900b95d7361`, one active primary connection hash `1c452570e8c9`, property hash `a3d79a4ad228`, the saved campaign filter, and the campaign timezone
- the operation produced one target GA4 daily update at database timestamp `2026-08-05T12:30:20.759Z` and eight target KPI updates from `2026-08-05T12:38:19.437Z` through `2026-08-05T12:38:21.794Z`; the same bounded interval contained no KPI or GA4 daily writes for another campaign

Passed exact-SHA evidence:

- refresh-disabled provider comparison: date-dimension 552 sessions / 377 engaged sessions = `68.30%`; dimensionless aggregate 378 engaged sessions = `68.48%`, delta 1; token refresh/persistence was disabled for the comparison request
- persisted 30-day totals: 552 sessions / 377 engaged sessions; KPI current value `68.30`; latest progress `68.30`
- API/browser consumers: KPI API `68.30`, progress API `68.30`, live KPI card exact, Tracker rendered as fresh, and the Engagement Rate Insights line did not expose `68.48`
- in-app alert/notification: exactly one unresolved visible notification was returned for the KPI and its enriched current value was `68.30`; the first validation assertion incorrectly treated historical `kpi_alerts` email-send snapshots as current UI values, and the corrected live-consumer check passed without a runtime change
- mutation-proof browser state: two daily requests were rewritten to `readOnly=1`, six token/provider-capable GETs were blocked, and mutation attempts were `[]`
- final local evidence on August 5 remains clean: `npm run test:current-version` executed 1,373 tests with 1,344 passing, exactly 29 visible deferred failures, and zero blocking current-version failures; certification regression passed 9/9; the standalone checker, TypeScript, and production build passed; the build transformed 3,466 client modules
- the superseding KPI-create contract separates durable creation from downstream processing without dropping propagation: after campaign access and schema validation, the GA4 route persists the KPI, schedules the established complete campaign recompute/propagation task, and immediately returns. The post-response task retains KPI/Benchmark recompute, progress and campaign-derived updates, alert reconciliation, and applicable notification delivery in their existing order; manual/source/scheduler paths remain recovery paths. The browser closes on the durable response without waiting for cache refresh. Final local evidence: focused propagation packet 8 files / 117 tests passed; current-version suite 1,376 total / 1,347 passed / exactly 29 visible deferred failures / zero blocking failures; TypeScript, production build, and certification checker passed. Deployment timing and post-response completion remain unproven, so this does not restore certification.

Precise Commit 14B blockers:

1. **Provider-confirmed delivery is currently impossible:** read-only audit found the exact campaign's current KPI alert events rejected by Mailgun HTTP `429`. The provider response states that domain `mimosaas.app` exceeded its 100-message daily limit and cannot send again before `2026-08-05T19:58:54Z`. The current events have no provider response ID or delivered timestamp, so neither alert nor report delivery can be claimed.
2. **The authorized server report paths conflict with the explicit no-recompute boundary:** production tracing confirms manual snapshot, direct snapshot PDF, test-send, and scheduled-send all call `preflightGA4ReportKPIConsumers`, which runs the persisted GA4 KPI/Benchmark recompute before output. Because the task expressly prohibited another recompute, none of those mutation-capable report paths was called.
3. **Exact-SHA browser KPI PDF remains unexecuted:** no browser report action or persistence occurred. The already-proven card, Tracker, Insights, notification, and mutation-proof browser state remain valid Commit 14A evidence, but they do not prove the downloaded PDF artifact.

Production inventory before any Commit 14B action identified exactly report hash `e322c0dbf3a6` on campaign hash `fc734ddaf728`, owner hash `1900b95d7361`, one existing recipient, configuration hash `635669498371`, nine snapshots, and 40 send events. No report, snapshot, send-event, KPI, token, connection, source, recipient, schedule, or configuration mutation was performed. Certification can change to `PRODUCTION_READY` only after the browser artifact and the normal recompute-backed report paths complete on one exact deployed boundary and provider-confirmed delivery exists. No clean certification or production-readiness claim is made.

## Earlier Historical Status And Evidence (non-authoritative)

### Current Commit 13 local validation - August 4, 2026 (historical)

**Result: not production-ready. Clean certification is withdrawn.** This section supersedes every older production-ready or durable-future-chat answer below; those sections are historical evidence only.

The current UI, API, storage, refresh/scheduler, alert/email, notification, browser-report, and scheduled/server-report paths do not yet maintain one fully authoritative value contract:

- Current Commit 4 locally aligns persisted Users, Sessions, Pageviews, Conversions, Conversion Rate, and Engagement Rate inputs plus notification enrichment to the same 30 completed reporting days in the campaign reporting timezone; Engagement Rate is session-weighted
- Current Commit 5 locally applies the documented financial source order to persisted recompute, campaign current-value refresh, and notification enrichment; successful zero is authoritative, malformed or failed required reads are unavailable, and affected stored KPI/Benchmark values are not overwritten
- metric identity, traffic/rate windows, the bounded financial producer/failure contract, backend alert/notification eligibility, browser-consumer state handling, exact recompute/report proof, and persistence/destructive safety are locally corrected by Current Commits 3-9; deployed migration and external-validation contracts remain unresolved

Locally proven, but not sufficient for certification:

- platform KPI CRUD routes enforce actor, campaign, KPI-owner, and exact-platform scope; selected GA4 property/campaign filter and GA4 financial source context are passed on traced paths
- create/edit preserve campaign/platform identity, UI invalidations exist, and custom KPI rows are preserved
- shared metric-aware threshold/unit/direction math and tracker exclusion of blocked/insufficient rows have focused coverage
- duplicate latest-row handling, campaign-scoped notification action URLs, and email audit/idempotency/retry/provider-acceptance semantics have focused coverage
- Current Commit 3 normalizes the supported standard and legacy-alias inventory through live values, dependency gating, persisted recompute, alert deduplication, notification enrichment, Insights recommendations, and report value consumers
- Current Commit 4 resolves the persisted reporting window per campaign, clamps recompute dates to completed reporting dates, uses the exact 30-date daily-row query for traffic/count/rate values, and weights Engagement Rate from engaged sessions divided by sessions
- Current Commit 6 routes in-app KPI/Benchmark reconciliation, immediate/scheduled/retry email eligibility, duplicate refresh, bell/Notifications filtering, and notification enrichment through one source-resolved, fail-closed alert decision
- Current Commit 7 routes KPI cards, breach pulse, tracker scoring, KPI-derived Insights, and browser PDF rows through one browser state resolver that distinguishes loading, failed, unavailable, stale/last-good, blocked, insufficient-data, and verified states
- Current Commit 8 returns exact KPI updated/skipped/failed IDs, blocks freshness-dependent source-lifecycle alert sweeps on any skipped/failed row, and requires every selected report KPI ID to appear in the exact updated set; its validation closure corrected the one stale assertion introduced by Commit 8
- Current Commit 9 aligns KPI progress history with live KPI `numeric(18,2)` capacity and makes exact notification hiding plus progress, alert, period, and parent deletion one campaign-scoped transaction that rolls back on failure
- TypeScript and the production build passed on the Current Commit 13 clean boundary on August 4, 2026

Current blockers after Current Commit 13 local validation on base `b017d290e820ae6df9a8598d1037eadb82347bb4` (production remains on the separately recorded deployed boundary):

- both automatic `b91d0968` monitors failed closed at approximately `2026-08-03T13:01Z` because deployment changed to `82369cf5`; neither result is evidence for a later revision
- later GA4 Insights, Reports, live UI, analytics, reporting-timezone, route, and shared-consumer changes touched the KPI dependency boundary, so the earlier clean 491-test result cannot be carried forward
- because those changes include provider/window, browser-state, and report-output dependencies, the historical target inventory, provider, state-matrix, and browser/report external gates also require current-boundary revalidation
- Current Commits 12-13 exact-clean staged-patch validation confirms Benchmark and Insights/report structural guards match the traced production contracts. Commit 13 is assertion-only: live Insights labels its isolated total `Exact completed-day window`, while browser and server reports label report-payload totals `Current GA4 total`; Executive Financials source-aware wording already matches across all three paths
- Current Commit 13's complete clean-boundary execution passes 1,325/1,366 tests. The required current-version gate has zero blocking failures and reports the exact 41 retained deferred failures separately
- current-version product scope explicitly excludes TikTok, Meta, LinkedIn, and Instagram; their 21 recorded failures remain retained, visible, deferred future-version evidence and are not represented as passing
- Google Ads has no configured test account, so its 19 recorded failures and live production-standard validation are deferred; Google Ads is not certified by this GA4 KPI review
- the remaining outside-scope failure is the separate GA4 Ad Comparison certification gate, which is not a KPI-tab consumer and must be closed by that feature's own readiness work
- `npm run test` remains the comprehensive unclassified command and is not represented as clean. Commit 11 supplies the blocking `npm run test:current-version` gate and the visible non-blocking `npm run test:deferred` evidence command; after Commit 13 the current-version gate is green with zero blocking failures
- the current production process started its GA4 daily scheduler at `2026-08-04T04:17:09.854Z`, after the 03:00 slot. It has zero runs and schedules the next natural execution for `2026-08-05T03:00:00Z`
- deployed `1166b9f2` GA4 KPI alert attempts exist, but Mailgun rejects them with HTTP `429`; its latest response says the 100-email daily limit resets after `2026-08-04T19:34:00Z`. No exact-final-SHA delivered KPI alert with provider response ID and delivered timestamp exists

Current Commits 11-13 are implemented and locally validated. The current-version required suite is green and deferred tests remain separately visible. Closure now requires only Current Commit 14: all listed GA4 external gates must pass on the exact final dependency boundary. Status remains `UNVERIFIED`.

#### Chronological smallest-safe fix queue

0. **Documentation revocation and dependency inventory — completed by this audit.** Keep certification withdrawn; identify every producer/consumer and preserve earlier evidence as history only.
1. **Certification integrity gate — implemented and locally validated in Current Commit 1; certification remains withdrawn.** The machine-readable record, fail-closed checker, focused tests, and existing CI step are present. A future ready claim requires a full certified SHA, SHA-256 for every dependency, matching current-status markers, completed required tests, and completed external gates. This implementation does not close Current Commits 2-10.
2. **Real-path cross-consumer parity guard — implemented and locally validated in Current Commit 2; certification remains withdrawn.** One authoritative nine-metric fixture now runs through the shared live-card/browser-PDF resolver, persisted GA4 job, KPI API, alert truth, notification enrichment API, Insights/scheduled PDF, and the shared preflight/PDF builder reached by direct snapshot, test-send, manual, and scheduled reports. Existing caller-reachability checks remain structural and do not replace the dynamic value guard.
3. **Metric identity contract — implemented and locally validated in Current Commit 3; certification remains withdrawn.** One shared inventory now normalizes standard stored keys, display labels, Pageviews, and the supported legacy `total*` aliases across live values, dependency gating, recompute, alert deduplication, notification enrichment, Insights, and report consumers.
4. **Authoritative window/date contract — implemented and locally validated in Current Commit 4; certification remains withdrawn.** Persisted traffic/count/rate inputs, notification enrichment, and the read-only Benchmark comparison resolver use 30 completed reporting days in the campaign reporting timezone; Engagement Rate is session-weighted. Deployment and external parity remain open.
5. **Financial source/failure contract - implemented and locally validated in Current Commit 5; certification remains withdrawn.** Persisted recompute, campaign current-value refresh, and notification enrichment now use fixed provider-to-persisted-to-configured-breakdown precedence, keep valid zero authoritative, reject malformed values, and preserve affected last-good KPI/Benchmark values when required native/revenue/spend reads are unavailable.
6. **Alert/notification contract - implemented and locally validated in Current Commit 6; certification remains withdrawn.** In-app KPI/Benchmark reconciliation, immediate/scheduled/retry alert-email eligibility, duplicate refresh, bell/Notifications visibility, and notification enrichment now share the same source-resolved blocked/insufficient/unavailable decision. Preserved last-good values are ineligible while their required source input is unavailable.
7. **UI and browser-consumer states — implemented and locally validated in Current Commit 7; certification remains withdrawn.** Empty is now distinct from loading, failed, and retained-empty/stale states; each KPI resolves one fail-closed browser state and reporting-window label before card breach display, tracker scoring, KPI-derived Insights, or browser PDF status.
8. **Recompute/report proof - implemented and locally validated, including validation closure, in Current Commit 8; certification remains withdrawn.** The shared job returns exact KPI updated/skipped/failed IDs. Source-lifecycle alert sweeps and the shared preflight used by manual snapshot creation, direct snapshot PDF download, test-send, and scheduled reports fail closed unless every required KPI row is in the exact updated set. The one Commit-8-introduced full-suite failure was a stale auto-refresh assertion and is corrected without runtime changes.
9. **Persistence/destructive safety — implemented and locally validated in Current Commit 9; certification remains withdrawn.** KPI progress value and rolling averages now match live KPI `numeric(18,2)` capacity. Exact campaign-and-KPI notification hides, progress rows, alert rows, period rows, and the KPI parent delete run in one transaction; any failure rolls back the operation for safe retry.
10. **Full validation and re-certification — invalidated again by later dependency changes; certification remains withdrawn.** Exact deployed `1166b9f27b81a06bd5c8b43072f77379e46453f4` passes TypeScript and build, but its applicable KPI packet has three failures, current-SHA alert delivery is provider-rate-limited, and its process started after the natural 03:00 scheduler slot. The chronological queue above is controlling.

11. **Current-version test boundary -- implemented and locally validated; required suite is green after Commit 13.** The exact 41-test identity manifest and classifier execute every test, fail closed on any non-deferred failure or missing/renamed deferred identity, and keep the three deferred groups runnable and visible. CI blocks on `test:current-version` and records `test:deferred` with `continue-on-error`; no test or runtime behavior was changed.
12. **KPI Benchmark regression alignment -- implemented and locally validated.** Root-cause tracing confirmed the production tracker still applies shared eligibility, insufficient-data exclusion, and metric-aware scoring. All three uses of the removed slice terminator in the same regression file now end at `const insightsRollupRows`; two had failed explicitly and the third could otherwise overrun to end-of-file. The focused file and affected shared packet pass with test-only changes.
13. **KPI Insights/report parity -- implemented and locally validated.** Production tracing proved that the live isolated Data Summary and report-payload totals intentionally use path-specific freshness wording while Executive Financials source-aware explanatory copy already matches. Only the stale universal assertion changed; the focused, affected, and current-version packets pass with zero runtime changes.
14. **Final GA4 KPI external validation and certification -- pending.** Deploy the final implementation SHA once, rerun the read-only inventory and refresh-disabled provider checks, rerun mutation-blocked browser/report validation, capture provider-confirmed KPI-alert delivery and natural scheduler completion, then update exact-SHA evidence. Mark `PRODUCTION_READY` only if every included test and external gate passes.

### Current Commit 13 - KPI Insights/report parity

Status: implemented and locally validated on the exact clean staged-patch boundary based on `b017d290e820ae6df9a8598d1037eadb82347bb4`. Certification remains `UNVERIFIED`.

Root cause and production-path trace:

- the parity regression inherited a universal `Current GA4 total` assertion from `949b36ea`, before `e34514c2` intentionally gave the live Data Summary its exact completed-day-window label
- the live Insights Data Summary uses isolated daily totals and therefore labels Sessions `Exact completed-day window`; browser PDF and scheduled/server PDF consume report payload totals and correctly label Sessions `Current GA4 total`
- live, browser-PDF, and scheduled/server-report Executive Financials already use the same source-aware explanatory contract through `executiveFinancialsDescription` / `buildExecutiveFinancialsDescription`; no value or copy defect was found there
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`, `GA4/REPORTS.md`, and the neighboring real-path accuracy regression confirm that this path-specific wording is intentional rather than a cross-consumer value mismatch

Smallest safe change:

- remove `Current GA4 total` from the universal copy list, require `Exact completed-day window` only in the live slice, and require `Current GA4 total` only in browser and scheduled report slices
- no runtime source, KPI value, formula, scope, eligibility, API, schema, persistence, alert, notification, scheduler, report behavior, configuration, or production data changed

Exact-clean staged-patch validation:

- focused Insights copy packet: 3 files / 6 tests passed
- affected KPI UI, Insights, browser-PDF, server-report, alert, notification, and parity packet: 12 files / 237 tests passed
- `npm run test:current-version`: 1,366 total; 1,325 passed; 41 failed; zero blocking current-version failures and exactly 41 visible manifest-bound deferred failures
- `npm run test:deferred`: 41/41 retained identities executed and 41 failed (21 future-platform, 19 Google Ads, 1 GA4 Ad Comparison); the nonzero result is retained evidence, not a success or current-version release blocker
- certification regression/checker, TypeScript, and production build results are recorded in the machine-readable evidence

What remains:

- Current Commit 14 must complete the listed exact-final-SHA external gates; production readiness remains unproven

### Current Commit 12 - KPI Benchmark regression alignment

Status: implemented and locally validated on the exact clean staged-patch boundary based on `b4178415a1155dd2a411a0aa79d8fcd498394c0d`. Certification remains `UNVERIFIED`.

Root cause and production-path trace:

- `e34514c2` replaced the former rolling-window block and removed its `// --- Rolling window rollups` marker when Insights rollups moved to the shared production builder
- the three tracker slices in `server/ga4-benchmark-regression.test.ts` still searched for that removed marker; two failed at the explicit end-boundary assertion, while the third sliced to end-of-file and could pass too broadly
- the current `benchmarkTracker` calls `getBenchmarkConsumerState` first, counts blocked, insufficient, stale, loading, unavailable, and failed states, skips every ineligible row, and only then calls `computeBenchmarkProgress`
- `getBenchmarkConsumerState` still combines the live source states, missing dependencies, and `resolveBenchmarkDataSufficiency` reason through the shared `resolveGA4KpiConsumerState` contract; threshold scoring still uses `computeBenchmarkThresholdResult`

Smallest safe change:

- only the three obsolete test slice ends now use the stable first declaration after the tracker, `const insightsRollupRows`
- no runtime source, formula, value, tracker, card, Insight, report, API, schema, persistence, alert, notification, scheduler, configuration, or production-data behavior changed

Exact-clean staged-patch validation:

- focused Benchmark regression: 1 file / 15 tests passed
- affected alert/notification/Benchmark packet: 14 files / 123 tests passed
- `npm run test:current-version`: 1,366 total; 1,324 passed; 42 failed; exactly one blocking current-version failure remains in `ga4-insights-report-parity-regression.test.ts` for Current Commit 13, and exactly 41 deferred failures remain visible
- `npm run test:deferred`: 41/41 retained identities executed and 41 failed (21 future-platform, 19 Google Ads, 1 GA4 Ad Comparison); the nonzero result is retained evidence, not a success or current-version release blocker
- certification regression/checker, TypeScript, and production build results are recorded in the machine-readable evidence

What remains:

- Current Commit 13 must resolve the one Insights live/browser-PDF/server-report parity failure and make `npm run test:current-version` green
- Current Commit 14 must complete the listed exact-final-SHA external gates; production readiness remains unproven

### Current Commit 11 - Current-version test boundary

Status: implemented and locally validated. The current-version suite correctly remains failed on the three Commit 12-13 KPI regressions; certification remains `UNVERIFIED`.

Root cause:

- CI ran only unconditional `npm run test`, so 41 known outside-scope failures and 3 current GA4 KPI failures were indistinguishable at the release-gate level
- the 41-test product-scope decision existed only in prose; there was no exact file-and-test identity manifest, no renamed/missing-identity failure, and no separately runnable deferred evidence command
- suppressing whole files would have hidden current tests in mixed files such as `source-safety-regression.test.ts`, so file-level exclusion was unsafe

Smallest safe implementation:

- `scripts/ga4-kpi-current-version-test-boundary.json` records exactly 41 retained identities: 21 future-platform tests, 19 Google Ads tests, and 1 separate GA4 Ad Comparison certification test
- `scripts/ga4-kpi-current-version-test-boundary.ts` still executes the complete suite for the blocking current-version command, classifies only exact manifest identities as non-blocking, and fails if any current test fails or any deferred identity is missing or renamed
- named deferred commands run only the exact retained identities and return their real pass/fail status; CI uses `continue-on-error` for this evidence rather than changing the test result
- the focused regression proves the 21/19/1 inventory, exact-identity classification, missing-identity failure, passing-deferred reporting, package scripts, and CI wiring
- no runtime source, formula, API, schema, production data, or existing test body changed; no test was deleted, disabled, skipped, or described as passing

Exact-clean staged-patch validation on base `79322c4bd9484b282e94d1ba8a434e0a2c85efb1`:

- focused boundary plus certification packet: 2 files / 14 tests passed
- standalone certification checker passed with status intentionally `UNVERIFIED`
- `npm run test:current-version` executed all 1,366 tests: 1,322 passed and 44 failed. Exactly 3 failures are blocking current GA4 KPI tests; exactly 41 are visible deferred identities. The command exited nonzero as required
- `npm run test:deferred` executed 41/41 retained identities and reported 41 failures: future platforms 21, Google Ads 19, GA4 Ad Comparison 1. The command exited nonzero; no deferred suite is represented as passing
- TypeScript passed
- production build passed: Vite transformed 3,466 modules and the server bundle completed

What remains:

- Current Commit 12 must align the two stale Benchmark assertions
- Current Commit 13 must resolve the one Insights live/report parity failure
- the current-version required suite is not green until all three pass
- Current Commit 14 external evidence and production readiness remain unproven

Current Commit 1 is a release gate, not optional process cleanup. Functional Commits 3-9 must not be used to restore readiness if Commits 1-2 are absent or failing.

### Current Commit 1 - Certification integrity gate

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- the earlier certification was narrative Markdown with no machine-readable status, certified revision, dependency snapshot, or CI check
- later producer and consumer changes could therefore leave a reusable production-ready sentence in place without any automated failure
- the existing CI workflow ran tests, but nothing connected their result or dependency changes to the readiness claim

Smallest safe implementation:

- `GA4/certifications/ga4-kpis.json` records the current `UNVERIFIED` status, reviewed SHA, configuration/source boundary, explicit producer/consumer/test/doc dependency inventory, required tests, external gates, and invalidation reason
- `server/ga4-kpi-certification-gate.ts` fails closed when the record is missing or malformed, its reviewed/certified SHA is not a real ancestor Git commit, the pinned configuration/dependency/status/test/external contract changes, status documents disagree, an unverified document claims GA4 KPI readiness, or a future ready record lacks matching dependency hashes or complete evidence
- `server/ga4-kpi-certification-gate.test.ts` covers missing records, unknown Git SHAs, reduced contract inventories, stale claims, changed dependency hashes, incomplete evidence, the allowed ready case, and this repository's current fail-closed record
- `npm run check:ga4-kpi-certification` is wired into automatic push, pull-request, and manual GitHub Actions runs before the full test suite; checkout uses full history so exact certified/reviewed commit ancestry can be validated
- machine status markers in `GA4/README.md`, `GA4/KPIS.md`, and this controlling section must agree with the record

Side-effect boundary:

- no KPI calculation, API, storage, scheduler, alert, notification, report, schema, or production-data behavior changed
- dependency hashes remain `null` while status is `UNVERIFIED`; they become mandatory only for a future evidence-complete `PRODUCTION_READY` record
- Commit 1 did not close the real-path or functional work; Current Commit 2 is now recorded below and Current Commits 3-10 remain open

Validation on August 1, 2026:

- `npm run check:ga4-kpi-certification` passed
- `npm test -- server/ga4-kpi-certification-gate.test.ts` passed: 1 file / 9 tests
- `npm run check` passed
- neighboring focused run passed 62/65 tests: the new guard, KPI UI, and report-consumer files passed; the same three previously recorded exact-source guards failed (one GA4 spend call-shape assertion and two notification attention-indicator source assertions). They were not changed because they are outside Current Commit 1.

What this proves:

- a clean checkout cannot carry a GA4 KPI ready claim through the three current-status documents unless the record is ready, its SHA resolves to the exact reviewed ancestor commit, the canonical contract is unchanged, and its evidence/dependency gates pass
- a future changed dependency hash makes a ready record fail
- the current repository status is consistently `UNVERIFIED`

What this does not prove:

- KPI numerical parity, scheduler correctness, alert/notification breach truth, report freshness, target production data, provider behavior, or deployed behavior
- GA4 KPI production readiness

### Current Commit 2 - Real-path cross-consumer parity guard

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- earlier KPI consistency tests copied formulas or asserted source text, so they could pass while independent live, persisted, notification, Insights, and report implementations drifted
- the live KPI cards and browser PDF used an unexported nested resolver, preventing the server regression runner from feeding the same fixture through that actual value path
- direct snapshot, test-send, manual, and scheduled reports have different entry points but converge on `preflightGA4ReportKPIConsumers` and `buildPdfAttachmentForReport`; caller reachability alone did not prove the values produced by that shared core

Smallest safe implementation:

- `shared/ga4-kpi-live-value.ts` contains the unchanged value resolver now called by both live KPI cards and the browser PDF; no formula, source, metric name, fallback, or output formatting changed
- `server/ga4-kpi-real-path-parity-regression.test.ts` feeds one authoritative fixture for Revenue, Total Conversions, Conversion Rate, Engagement Rate, Total Users, Total Sessions, ROAS, ROI, and CPA through the actual shared client resolver, persisted GA4 daily job, KPI API, alert truth, notification enrichment API, Insights/scheduled GA4 PDF, report preflight, and PDF builder
- the dynamic report test covers the value-producing shared preflight/builder; `server/ga4-kpi-report-consumer-regression.test.ts` separately retains structural reachability guards for scheduled send, test-send, manual snapshot, and direct snapshot PDF callers
- the certification record pins the new shared resolver and parity test as dependencies and records the exact test command/evidence

Side-effect boundary:

- no KPI formula, source precedence, date window, persistence behavior, alert behavior, notification behavior, report behavior, API contract, schema, scheduler, or production data changed
- Current Commits 4-10 remain open; this guard is evidence and regression protection, not a runtime correction or re-certification

Validation on August 1, 2026:

- `npm test -- server/ga4-kpi-real-path-parity-regression.test.ts` passed: 1 file / 5 tests
- focused downstream packet passed: 6 files / 33 tests
- `npm run check:ga4-kpi-certification` passed
- `npm run check` passed

What this proves:

- the authoritative fixture produces the same nine standard KPI values at the actual shared live/browser resolver, persisted job/API, alert/notification, Insights/scheduled PDF, and shared report preflight/builder boundaries exercised by the test
- the client card/browser renderer now has a directly executable parity seam without duplicating its formulas in the test
- the included report entry points remain wired to the dynamically exercised shared preflight/builder according to the existing structural caller guards

What this does not prove:

- corrected 30-completed-day weighting/timezone behavior, valid-zero/unavailable/failure behavior, or exact updated/skipped/failed KPI IDs; these remain Current Commits 4-8
- target production data, an actual browser render/download, a real test-send or scheduled email, timer execution, provider/token behavior, deployment, or external UI parity
- GA4 KPI production readiness

### Current Commit 3 - Metric identity contract

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- standard KPI rows are stored with machine keys such as `conversionRate`, `engagementRate`, `users`, and `sessions`, but the live-card/browser-PDF resolver compared display labels
- recompute, dependency gates, notification enrichment, alert deduplication, and Insights each maintained separate partial normalizers; `Revenue` and legacy `Total Revenue` could therefore be treated as different alert identities
- the Current Commit 2 fixture used display labels as its stored `metric` values, so it did not exercise the actual template-key boundary and could pass while real stored rows fell back to stale persisted values

Smallest safe implementation:

- `shared/ga4-kpi-metric-identity.ts` is the single identity inventory: Revenue/Total Revenue, Conversions/Total Conversions, Sessions/Total Sessions, Users/Total Users, Pageviews, Conversion Rate, Engagement Rate, ROAS, ROI, and CPA; matching is case- and separator-insensitive
- the live/browser resolver, UI dependency and rate gates, persisted recompute, read-only validation API, notification enrichment, alert duplicate key, and Insights recommendation classification consume that identity
- persisted report values inherit the normalized recompute identity; browser reports inherit the shared live resolver; no report/API response shape changed
- custom and unsupported metrics remain unguessed and retain their existing stored-value fallback/preservation behavior
- the real-path parity fixture now contains the actual stored template keys, all supported legacy aliases, and Pageviews, and executes them through the live/browser, persisted/API, notification, Insights/scheduled-PDF, and shared report-preflight/PDF paths

Side-effect boundary:

- formulas, source precedence, windows/timezones, valid-zero/unavailable behavior, scheduler result shape, schema, and production data were not changed
- At the Current Commit 3 boundary, Current Commits 4-10 remained open. Current Commits 4 and 5 are now implemented below; Current Commits 6-10 remain open.

Validation on August 1, 2026:

- focused identity/parity/duplicate packet passed: 3 files / 11 tests
- wider KPI/alert/Insights/report packet passed 89/91 tests; the two failures are the pre-existing Notifications top-bar source-text guards for the already-broadened Shopify/KPI attention indicator, not metric identity behavior
- `npm run check` passed
- certification checker passed and its focused regression passed: 1 file / 9 tests

What this proves:

- every supported standard identity and legacy alias maps to one canonical identity on the locally exercised live, recompute, alert/notification, Insights, and report paths
- actual template keys no longer fall through the live resolver to a stale stored value merely because they are not display labels
- Revenue/Total Revenue and the supported `total*` aliases share recompute, dependency, and duplicate-alert identity

What this does not prove:

- window/timezone correctness, financial source precedence, valid-zero/unavailable/stale/failure behavior, exact recompute result IDs, persistence/destructive safety, target production data, deployed UI behavior, provider behavior, timer execution, or email delivery
- GA4 KPI production readiness

### Current Commit 4 - Authoritative window/date contract

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- `runGA4DailyKPIAndBenchmarkJobs` resolved one UTC-yesterday date before loading campaigns, so implicit scheduler, CRUD, source-lifecycle, and report-preflight callers inherited UTC rather than each campaign's reporting timezone
- the persisted job built traffic/count/rate values from campaign-start totals and used the latest daily row's Engagement Rate, while the live Overview-backed path uses 30 completed reporting dates
- notification enrichment independently repeated campaign-start aggregation and averaged daily Engagement Rate percentages without session weighting, so it could override a corrected persisted value with a different alert value

Smallest safe implementation:

- each campaign resolves an exact 30-date window ending on its latest completed reporting date; an explicit past recompute date remains the window end, while an incomplete/current/future date is clamped to the latest completed reporting date
- persisted Users, Sessions, Pageviews, Conversions, Conversion Rate, and Engagement Rate use daily rows from that exact window; Engagement Rate is `sum(engagedSessions) / sum(sessions)`, deriving missing engaged sessions from each row's sessions and normalized rate in the same transform used by the Overview daily route
- notification enrichment and the read-only Benchmark comparison current-value resolver use the same campaign-timezone window; notification financial inputs remain separate and retain their existing longer-window behavior for Current Commit 5
- Revenue, ROAS, ROI, and CPA source precedence/failure behavior, API response shapes, schema, destructive paths, and production data are unchanged

Files changed:

- `shared/ga4-traffic-window.ts`
- `server/ga4-kpi-benchmark-jobs.ts`
- `server/routes-oauth.ts`
- `server/ga4-kpi-reporting-window-regression.test.ts`
- `server/notification-visibility-regression.test.ts`
- canonical KPI status/evidence and certification-boundary files

Validation on August 1, 2026:

- `npm test -- server/ga4-kpi-reporting-window-regression.test.ts`: 1 file / 3 tests passed, including Los Angeles versus Amsterdam completed-day boundaries, explicit-date clamping, weighted Engagement Rate, exact persisted metric values, progress date, and unchanged lifetime CPA conversions
- relevant scheduler/consumer regression packet: 10 files / 67 tests passed
- the Commit 4 notification-enrichment guard passed inside `server/notification-visibility-regression.test.ts`; the full file passed 33/35 and retained two unrelated, previously documented top-bar attention-indicator source-text failures
- `npm run check` passed
- `npm test -- server/ga4-kpi-certification-gate.test.ts` passed: 1 file / 9 tests; `npm run check:ga4-kpi-certification` passed with current status internally consistent

What this proves:

- the locally exercised persisted real job no longer uses campaign-start/UTC-yesterday inputs for standard traffic/count/rate KPIs
- two campaigns at the same instant can resolve different latest completed reporting dates according to their reporting timezones
- the shared aggregation is exercised with a weighted fixture, and the persisted-job and notification-enrichment paths are regression-wired to that same transform instead of unweighted/latest-row Engagement Rate
- lifetime financial conversions remain separate in the focused CPA regression, preventing this commit from silently changing the documented financial window

What this does not prove:

- At the Current Commit 4 boundary, Current Commits 5-10 remained open. Current Commit 5 is now implemented below; Current Commits 6-10 remain open.
- target production data, deployed UI/report/notification parity, a timer-fired run, live provider/token refresh, email delivery, or production behavior
- GA4 KPI production readiness

### Current Commit 5 - Financial source/failure contract

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- the persisted GA4 KPI/Benchmark job and notification enrichment each had a local "higher revenue wins" transform, so a later configured-lookback breakdown could replace an earlier complete campaign-to-date provider or persisted candidate
- falsy fallback expressions treated an authoritative provider zero as absent when a nonzero fallback existed
- required imported-revenue and spend read failures were caught as zero before recompute, making source failure indistinguishable from a successful zero and allowing affected last-good values to be overwritten
- the campaign current-value resolver treated an empty successful daily query as a complete zero-valued native candidate, so a fully unavailable native source could be presented as zero

Smallest safe implementation:

- the existing shared ordered selector now accepts only finite numeric or nonblank numeric-string revenue and conversion pairs; zero and negative values remain complete candidates, while blanks, booleans, arrays, missing fields, and non-finite values are rejected
- persisted platform recompute, campaign current-value refresh, and notification enrichment select in fixed order: campaign-to-date provider totals, persisted campaign-to-date daily totals when rows exist, then the connection's configured-lookback breakdown only when no earlier complete candidate exists
- persisted recompute reads campaign-scoped imported revenue and spend independently and keeps a failure/malformed state as unavailable; dependency-aware gating skips only the affected financial KPI/Benchmark rows, so Revenue can still update when spend fails and CPA can still update when imported revenue fails
- native candidate failure skips all affected financial KPI/Benchmark current-value and progress writes; the campaign current-value refresh likewise returns no replacement value, preserving each stored last-good value
- Notifications recompute from the same ordered financial inputs and suppress an affected stale alert row when a required native/revenue/spend input cannot be verified

Side-effect boundary:

- no KPI/Benchmark formula, metric identity, traffic/rate window, API response shape, schema, destructive path, alert-email policy, report preflight result, or production data changed
- this commit does not add the identical alert/email insufficiency contract from Current Commit 6, the UI stale/unavailable states from Current Commit 7, or exact recompute/report proof from Current Commit 8
- no production write, cleanup, migration, or provider validation was run

Files changed:

- `shared/ga4-financial-source.ts`
- `server/ga4-kpi-benchmark-jobs.ts`
- `server/utils/campaign-current-values.ts`
- `server/routes-oauth.ts`
- focused financial-source, real-path, campaign-current-value, notification, and adjacent source regression guards
- canonical KPI status/evidence and certification-boundary files

Validation on August 1, 2026:

- validation-closure root cause: the HubSpot live-value guard still searched the page wrapper for formulas that Current Commit 2 moved into `shared/ga4-kpi-live-value.ts`, while its server guard used an obsolete `sourceValue` return signature and pre-Commit-5 catch-to-zero/input-shape assertions; the Notifications guards still expected the old KPI-only indicator instead of the existing combined KPI/Benchmark-or-Shopify attention state
- focused financial contract packet passed: 5 files / 27 tests
- directly affected and neighboring scheduler/source/notification packet passed 9 files / 114 tests after validation closure; two HubSpot assertions now inspect the shared live resolver and current Commit 5 recompute/failure contract, while two Notifications assertions now verify the existing combined KPI/Benchmark-or-Shopify attention state
- validation closure changed only `server/hubspot-revenue-ga4-overview-regression.test.ts`, `server/notification-visibility-regression.test.ts`, and canonical certification evidence; no runtime code or behavior changed
- `npm test -- server/ga4-kpi-certification-gate.test.ts` passed: 1 file / 9 tests; `npm run check:ga4-kpi-certification` passed
- `npm run check` passed

What this proves:

- the locally exercised persisted job, campaign current-value refresh, and notification resolver no longer choose the numerically highest revenue candidate
- provider zero remains authoritative over higher persisted and breakdown totals; a complete persisted candidate prevents the configured-breakdown call
- malformed or failed native, imported-revenue, and spend inputs do not become zero on the corrected producer paths, and affected last-good KPI/Benchmark values are not overwritten
- dependency isolation is exercised: imported-revenue failure blocks Revenue/ROAS/ROI but not CPA, while spend failure blocks ROAS/ROI/CPA but not Revenue

What this does not prove:

- at the Current Commit 5 boundary, alert parity remained open; Current Commit 6 now closes the bounded backend alert/notification contract below, while UI/browser state and report freshness remain Current Commits 7-8
- exact updated/skipped/failed KPI IDs, report freshness proof, persistence/destructive safety, or cleanup need; those remain Current Commits 8-10
- target production data, deployed behavior, timer execution, live provider/token refresh, external notification/report parity, or email delivery
- GA4 KPI production readiness

### Current Commit 6 - Alert/notification contract

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- alert truth was split across the KPI scheduler, KPI notification helper, Benchmark reconciliation, immediate/scheduled/retry email service, and Notifications API
- only the Notifications API recomputed GA4 source inputs and failed closed when a required source was unavailable; the other paths compared the persisted currentValue directly
- Current Commit 5 intentionally preserved the last-good stored value on required-source failure, but without a shared eligibility marker that stale value could still create, refresh, retry, email, or keep visible a breach
- card/tracker sufficiency rules for zero sessions, conversions, or spend were not applied by those backend alert consumers

Smallest safe implementation:

- server/utils/ga4-alert-current-value.ts owns the existing GA4 notification source resolution and applies the same selected campaign/property/filter, 30-completed-day traffic window, financial source precedence, valid-zero handling, and dependency reads before any backend alert decision
- server/utils/alert-decision.ts is the single internal eligibility and threshold predicate; unavailable/blocked and exact insufficient-session/conversion/spend states fail closed, while authoritative zero remains eligible for metrics that do not require a denominator
- campaign current-value alert resolution now carries the same internal decision metadata when a selected dependency is blocked/unavailable or insufficient
- KPI and Benchmark in-app reconciliation, duplicate refresh, immediate email, scheduled email, retry eligibility, Notifications enrichment/visibility, and therefore bell visibility all use the shared resolver/predicate
- decision metadata is transient server-only state; persisted KPI/Benchmark values and public API response shapes are unchanged

Side-effect boundary:

- no KPI formula, source precedence, reporting window, ownership/campaign/property/platform/source scope, schema, report behavior, destructive path, or production data changed
- no Commit 7-10 UI, exact-result/report, persistence, cleanup, deployment, or external-validation work was implemented
- no production write, provider call, email send, or target-data check was run during validation

Files changed:

- shared alert decision and GA4 source-resolution utilities
- existing campaign resolver and KPI/Benchmark in-app, email, and Notifications consumers
- focused alert/source/notification tests plus stale exact-source assertions affected by the resolver relocation
- canonical KPI readiness evidence and machine-readable certification boundary

Validation on August 1, 2026:

- focused Commit 6 source/decision guard passed: 1 file / 4 tests
- alert/notification/email real-path packet passed: 14 files / 111 tests
- exact Commit 5 financial packet passed: 5 files / 27 tests
- exact Commit 5 validation-closure packet passed: 9 files / 114 tests
- certification regression/checker and TypeScript passed

What this proves:

- locally exercised successful zero source inputs can still breach where mathematically valid, while Conversion Rate/Engagement Rate without sessions, CPA without conversions or spend, and ROAS/ROI without spend are alert-ineligible
- locally exercised required-source failure preserves the stored last-good value but marks it ineligible before in-app creation/refresh, immediate/scheduled/retry email, and Notifications/bell visibility
- all traced backend KPI and Benchmark alert consumers call the same source resolver and decision predicate, with latest-row duplicate suppression retained

What this does not prove:

- deployed behavior, a timer-fired scheduler run, live GA4/token-refresh behavior, provider acceptance or inbox delivery, or target production data
- at the Current Commit 6 boundary, Commit 7 UI/card/Insights/browser-PDF unavailable and stale presentation was still open; Current Commit 7 is now implemented below, while Commits 8-10 remain open
- GA4 KPI production readiness

### Current Commit 7 - UI and browser-consumer states

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- the KPI list query defaulted missing data to `[]` and discarded its error state, so a failed read rendered the same empty state as a successful zero-row response
- KPI cards, breach pulse, tracker scoring, KPI-derived Insights, and browser PDF rows independently consumed numeric values without a shared browser eligibility state
- React Query can retain last-good response data after a refresh failure; those retained values could therefore look freshly verified even though Current Commits 5-6 correctly fail closed in backend producers and alert consumers
- the KPI UI and browser PDF did not state that traffic/rate KPIs use 30 completed reporting days in the campaign reporting timezone while financial KPIs use campaign-to-date inputs

Smallest safe implementation:

- `shared/ga4-kpi-consumer-state.ts` resolves the standard/legacy metric dependency set to exactly one `loading`, `failed`, `unavailable`, `stale`, `blocked`, `insufficient_data`, or `verified` browser state and supplies the applicable reporting-window label
- the existing KPI query now retains data presence separately from query failure; an initial failure is not empty, and a failed refresh of a retained empty list is not presented as a verified empty state
- actual GA4 daily, connection, campaign-to-date revenue, imported-revenue, spend, and source-definition query results determine required input readiness without changing their fetches, response contracts, formulas, precedence, or scope
- only `verified` KPI rows can enter tracker bands/average, display a breached-threshold pulse, or generate positive/negative KPI performance Insights; blocked, insufficient, unavailable, loading, failed, and stale rows remain fail-closed
- stale rows may retain the last-good numeric value, but the card and browser PDF label it `Last-good — not verified`; unavailable/failed/loading/blocked rows do not present a numeric value as current
- the browser PDF states the traffic/rate and financial windows, records excluded-state counts, and prints non-verified rows as state evidence rather than target-performance results

Side-effect boundary:

- no KPI formula, source precedence, reporting window, ownership/campaign/property/platform/source scope, API response, schema, persistence, scheduler, backend alert/notification/email, server-report, destructive, or production-data behavior changed
- no production write, provider request, email send, cleanup, or target-data read was performed
- Current Commits 8-10 were not implemented

Files changed:

- shared browser state/window resolver and the existing GA4 KPI page consumers
- focused UI/browser state regression plus stale source-text assertions that no longer matched the shared identity/state path
- canonical KPI status/evidence and machine-readable certification boundary

Validation on August 1, 2026:

- focused UI/browser state test passed: 1 file / 5 tests
- KPI UI, tracker, Insights, browser PDF, alert/notification packet passed: 10 files / 225 tests
- exact Commit 5 financial packet passed: 5 files / 27 tests
- exact Commit 5 validation-closure packet passed: 9 files / 114 tests
- exact Commit 6 alert/notification packet passed: 14 files / 111 tests
- certification regression passed: 1 file / 9 tests; the standalone certification checker passed
- TypeScript passed

What this proves:

- the locally exercised state matrix distinguishes successful empty, initial loading, list failure, retained-list staleness, required-source loading/unavailable/stale, missing-dependency blocking, insufficient denominator data, and verified values
- standard and legacy traffic/rate aliases receive the 30-completed-day campaign-timezone label; Revenue/ROAS/ROI/CPA receive the campaign-to-date financial label; custom rows remain explicitly outside the standard GA4 window
- every traced browser KPI performance consumer calls the same state resolver, and only its `verified` result can score, pulse, or create KPI performance guidance

What this does not prove:

- deployed rendering or browser interaction, live GA4/token refresh, a timer-fired scheduler run, actual provider/email delivery, or target production data
- Commit 8 exact recompute/report freshness proof, Commit 9 persistence/destructive safety, Commit 10 external validation/re-certification, or server-generated report freshness
- GA4 KPI production readiness

### Current Commit 8 - Recompute/report proof

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- the shared daily KPI/Benchmark job converted KPI-list reads to an empty list, treated KPI current-value updates as best effort, and did not return exact KPI update, skip, or failure IDs
- report preflight checked only whether a campaign was processed, so a selected row could retain its last-good value while direct snapshot download, test-send, manual-send, or scheduled-report generation continued
- source-lifecycle callers could continue freshness-dependent alert reconciliation after an incomplete recompute

Smallest safe implementation:

- the shared job returns exact `kpiIdsUpdated`, `kpiIdsSkipped`, and `kpiIdsFailed` plus campaign and alert-reconciliation results; a KPI is updated only after its current-value write and applicable daily-progress operation succeed
- unsupported metrics and unavailable dependencies are exact skips; read/write failures are exact failures where the row inventory is available, and campaign-level read failures remain explicit campaign failures
- on-demand/source, automatic-refresh, and daily-refresh lifecycle paths suppress later alert sweeps when any campaign/KPI is skipped or failed
- the shared report preflight resolves the exact selected KPI IDs, rejects missing selected rows, and requires every required ID in the recompute updated set; direct snapshot download, test-send, manual-send, and scheduled-report paths already converge on this preflight
- preserved last-good values therefore cannot satisfy local report freshness proof when their source input is unavailable or their write fails

Side-effect boundary:

- no KPI formula, window, financial precedence, ownership/campaign/property/platform/source scope, public API shape, schema, destructive behavior, or production data changed
- KPI-progress capacity and transactional cleanup remain Current Commit 9; external validation and re-certification remain Current Commit 10

Files changed:

- `server/ga4-kpi-benchmark-jobs.ts`, `server/report-scheduler.ts`, `server/routes-oauth.ts`, `server/auto-refresh-scheduler.ts`, and `server/ga4-daily-scheduler.ts`
- focused real-path, report-consumer, source-lifecycle, and scheduler regression guards
- canonical KPI status/evidence and certification contract files

Validation on August 2, 2026:

- focused exact-result/source-lifecycle packet passed: 3 files / 29 tests; the focused auto-refresh guard passed: 1 file / 13 tests
- direct snapshot/test-send/manual-send/scheduled-report and scheduler packet passed: 5 files / 41 tests
- KPI core packet passed: 10 files / 60 tests
- exact Current Commit 5 financial and validation-closure packets passed: 29/29 and 114/114
- exact Current Commit 6 and Current Commit 7 packets passed: 113/113 and 227/227
- certification regression/checker, TypeScript, and the production build passed
- after Commit 7 deployed, the user downloaded the KPI browser PDF and confirmed that it opened and looked correct; this proves only that deployed happy path, not the non-verified state matrix

What this proves:

- locally exercised successful, unavailable/skipped, and write-failed recomputes return exact row IDs and prevent a selected last-good row from passing the shared report preflight
- all four traced server-report entry points remain wired through that shared fail-closed preflight
- traced source-lifecycle alert sweeps stop when exact KPI freshness is not proven

What this does not prove:

- deployed Commit 8 behavior, a timer-fired scheduler run, live GA4/token refresh, provider acceptance or inbox delivery, direct/test/manual/scheduled report execution in production, or target production data
- Commit 9 persistence/destructive safety or Commit 10 external validation/re-certification
- GA4 KPI production readiness

#### Current Commit 8 validation closure - August 2, 2026

Root cause and boundary:

- the pushed full CI workflow ran `npm run test`, while the implementation commit had run the required focused KPI packets but omitted that exact repository-wide command
- Commit 8 changed the automatic-refresh alert condition from any upstream update to an upstream update with no skipped/failed KPI recompute; `server/ga4-auto-refresh-regression.test.ts` still asserted the old condition
- an isolated full-suite run at exact parent `6ed81dd45f6994dec779b67c109ddf8185746d69` failed 46/1,288 tests across 18 files
- after correcting the stale Commit 8 assertion, the current full suite passes 1,258/1,290 tests and fails 32 tests across 15 files; every remaining failed test is also in the parent baseline

Smallest safe closure:

- one test assertion now requires `anyCampaignUpdated && !anyCampaignRecomputeFailed`
- no runtime, formula, source, window, API, schema, persistence, report, alert, notification, destructive, or production-data behavior changed
- unrelated Google Ads, Instagram, TikTok, Meta, source-safety, and pre-existing GA4 failures were not changed

Closure evidence:

- Commit 8 exact-result/source-lifecycle/auto-refresh packet passed: 4 files / 42 tests
- Commit 8 report/scheduler packet passed: 5 files / 41 tests
- Commit 5 financial and validation-closure packets passed: 29/29 and 114/114
- Commit 6 and Commit 7 packets passed: 113/113 and 227/227
- certification regression/checker, TypeScript, and production build passed
- full repository CI remains red from the exact 32-test parent-baseline subset; neither CI nor GA4 KPI production readiness is claimed clean

### Current Commit 9 - Persistence/destructive safety

Status: implemented and locally validated. Certification remains withdrawn.

Root cause:

- live KPI values were already widened to `numeric(18,2)`, but `kpi_progress.value`, `rolling_average_7d`, and `rolling_average_30d` remained `numeric(10,2)`, so an enterprise-scale recompute could update the live row and then fail while writing progress
- `DatabaseStorage.deleteKPI` deleted progress and alert children through separate database calls, omitted `kpi_periods`, and did not use a transaction
- shared platform and campaign KPI routes deleted the parent first, then attempted notification hiding as best effort and swallowed failures; after parent deletion, the same access-guarded request could not retry the visibility cleanup

Smallest safe implementation:

- schema and idempotent startup migration declarations widen only the three KPI-progress absolute-value columns to `numeric(18,2)`; scale and field meaning remain unchanged
- after the existing actor/campaign/KPI/platform checks, both shared KPI delete routes prepare notification updates only where notification campaign ID and metadata KPI ID exactly match the selected KPI
- `DatabaseStorage.deleteKPI` validates notification campaign scope, hides the exact notification IDs, deletes `kpi_progress`, `kpi_alerts`, `kpi_periods`, and the KPI parent inside one transaction, and throws on any failed required notification update so every mutation rolls back and the route remains retryable
- the deferred Meta-specific KPI route was not refined; Google Ads, Instagram, Meta, and TikTok functionality was not changed

Side-effect boundary:

- no formula, reporting window, financial precedence, recompute/report behavior, public API response, schema scale, production data, or unrelated source behavior changed
- no production migration or cleanup was executed; deployed migration application and target-data inspection remain Current Commit 10 gates
- the existing shared spend-source failure was investigated and is unrelated: it asserts superseded `deleteSpendSource`/`deleteSpendRecordsBySource` calls while that route uses `deleteSpendSourceWithRecords`; it does not call the KPI transaction and was not changed

Files changed:

- `shared/schema.ts`, `server/index.ts`, `server/storage.ts`, and the two shared KPI delete paths in `server/routes-oauth.ts`
- `server/ga4-kpi-persistence-destructive-safety.test.ts` plus the directly stale KPI-delete assertion in `server/notification-visibility-regression.test.ts`
- canonical KPI status/evidence and certification contract files

Validation on August 2, 2026:

- Current Commit 9 persistence/destructive packet passed: 4 files / 59 tests
- Current Commit 5 financial and validation-closure packets passed: 29/29 and 114/114
- Current Commit 6, Current Commit 7, and combined Current Commit 8 packets passed: 113/113, 227/227, and 76/76
- certification regression passed 9/9 and the standalone checker passed; TypeScript and production build passed
- full repository suite remained red: 143/158 files and 1,265/1,297 tests passed; the 32 failures across 15 files are the documented deferred-source and pre-existing GA4/shared failures, not passing Commit 9 evidence

What this proves:

- local schema and migration declarations preserve two-decimal semantics while raising KPI progress capacity to the same `18,2` bound as live KPI values
- dynamic storage tests prove successful all-child deletion, notification/child rollback on injected failure, safe retry state, and campaign mismatch rejection; route guards prove notification selection remains exact campaign-and-KPI scoped
- the existing shared campaign cascade already deletes KPI progress, alert, and period rows inside its campaign transaction and remains covered by the Commit 9 packet

What this does not prove:

- deployed database migration completion, current production column types/data bounds, production delete execution, or production notification retry behavior
- live GA4/token behavior, timer-fired scheduler execution, provider/email delivery, deployed non-verified UI states, or production report paths
- Current Commit 10 external validation/re-certification or GA4 KPI production readiness

### Current Commit 10 - Full validation and re-certification

Status: final closure rerun completed on August 3, 2026; certification remains withdrawn (`UNVERIFIED`). Gates 1, 2, 4, and the report-delivery portion of Gate 5 pass. Gate 3 lacks a completed natural run for the exact deployed revision, Gate 5 lacks a SHA-bound delivered KPI alert, and Gate 6 has two reproducible in-scope GA4 HubSpot structural parity failures.

Fresh root-cause classification:

- the deployed Commit 9 revision was confirmation of deployment only; it did not close any behavioral external gate
- the three GA4 failures in the prior full suite were stale source-shape assertions: reporting-timezone import ordering, inline versus shared engaged-session derivation, and the superseded campaign-lifetime Benchmark input window. The runtime paths already matched the documented freshness helper, shared weighted traffic helper, and 30-completed-day window, so only those assertions changed
- no runtime GA4 KPI defect was found by the focused packets or read-only database checks

Exact local and read-only evidence on August 2, 2026:

- deployed schema: `kpi_progress.value`, `rolling_average_7d`, and `rolling_average_30d` are each `numeric(18,2)`; 679 rows were present, with maximum absolute values `384252.24`, `331863.10`, and `329829.74`
- target inventory: dry-run mode, 0 candidates, 17 classified skips, 0 applied. The exact split is 7 access-token financial KPIs, 3 propertyless financial KPIs, and 7 immutable duplicate-email audit rows. Commit 10A closes inventory completeness: three access-token rows use deterministic `yesop` values that exactly match, three propertyless rows resolve unavailable under the fail-closed contract, and four live-property rows have complete stored/provider-boundary inventories. Gate 4 later closed their applicable provider success/failure classification without refreshing or persisting tokens. No `--apply` command or destructive production action was run
- deployed child integrity: 23 GA4 KPI parents and 0 orphan KPI progress, alert, or period rows; Commit 10B additionally found 4 legacy KPI parents whose campaign no longer exists, all without progress/alert/period children
- metric/value contract: all ten canonical identities (Revenue, Conversions, Sessions, Users, Pageviews, Conversion Rate, Engagement Rate, ROAS, ROI, CPA), supported `total*` aliases, formulas, dependency gates, 30-completed-day traffic/rate window, campaign-to-date financial window, fixed source precedence, authoritative zero, and unavailable/last-good handling are covered by the current shared resolvers and focused real-path packets
- lifecycle/consumer contract: actor/campaign/platform/property/source scope; add/edit/delete; refresh, recompute, scheduler wiring; thresholds; alerts/email eligibility; bell/Notifications; Insights; browser PDF; manual snapshot creation; direct snapshot PDF download; test-send; scheduled reports; and persistence rollback remain code-traced and regression-covered within the configuration boundary. There is no separate GA4 `manual-send` endpoint; historical uses of that phrase in this file mean manual snapshot creation
- current packet on exact clean deployed `1166b9f27b81a06bd5c8b43072f77379e46453f4`: 44/46 files and 488/491 tests passed. Two failures are stale Benchmark structural slice boundaries; one Insights/report copy-parity boundary is unproven
- certification regression 9/9, standalone checker, TypeScript, and production build passed
- full repository suite on exact `1166b9f2`: 339/371 files and 1,316/1,360 tests passed. The 3 GA4 KPI failures are included in this certification. The 41 outside-scope failures are exactly 21 unavailable future-version platform tests (Instagram 14, Meta 4, TikTok 2, LinkedIn 1), 19 Google Ads tests without a configured production-standard test account, and 1 separate GA4 Ad Comparison certification test.

External evidence classification:

- proven: revision `be926476fabb79650eb35fad3354506d7796026e` was confirmed deployed; the prior inventory, schema, state-matrix, provider, and cleanup evidence remains recorded at its exact revisions. Against `be926476`, the guarded KPI report flow passed preflight, manual snapshot, direct PDF, confirmed test delivery, and a natural scheduled send with delivered Mailgun audit and sent snapshot. Independent read-only inventory proved exact restoration to configuration hash `fcc0a0e68ad6`
- unproven certification gates: later dependency changes require current-boundary revalidation of target inventory, provider behavior, deployed state matrix, and browser/report parity. The prior monitors rejected a SHA change and produced no transferable alert or scheduler evidence. Exact current `1166b9f2` started after the 03:00 daily slot, so its next natural run is `2026-08-05T03:00:00Z`; current-SHA alert attempts are rejected by Mailgun HTTP `429`, with reset stated as `2026-08-04T19:34:00Z`.

Chronological smallest-safe validation-closure queue (current evidence status):

1. **Target-data Gate 1 — historical pass; current-boundary revalidation pending.** Commit 10A proved exhaustive inventory at its exact revision, but later analytics, reporting-timezone, and route changes touched this gate's dependency boundary. Rerun the same read-only inventory against the final SHA; do not infer a current pass from the historical result.
2. **Deployed state-matrix Gate 2 — historical pass; current-boundary revalidation pending.** The mutation-proof matrix passed on `80a659b819f64868ff766490348e0e5cb93bef76`, but later live GA4 UI and Insights changes touched the state-consumer boundary. Rerun the same mutation-blocked browser matrix against the final deployed SHA.
3. **Timer scheduler Gate 3 — pending for exact current-SHA completion evidence.** Exact deployed `1166b9f27b81a06bd5c8b43072f77379e46453f4` started at `2026-08-04T04:17:09.854Z`, after the daily slot, has zero runs, and schedules the next natural execution for `2026-08-05T03:00:00Z`. Completion requires `lastRunFinishedAt` and exact recompute evidence for the final deployed SHA.
4. **Provider Gate 4 — historical pass; current-boundary revalidation pending.** Later analytics and reporting-timezone changes touched the provider/window boundary. Rerun the refresh-disabled, non-persisting success and failure checks for the final SHA; no token refresh or persistence is permitted.
5. **Report/delivery Gate 5 — historical report pass; exact-final-SHA external report parity and KPI-alert delivery pending.** Commit 13 closes the local Insights/report copy regression without runtime changes, but later live UI, Insights, Reports, scheduled-PDF, route, and reporting-timezone changes still require external revalidation after the final SHA deploys. Deployed `1166b9f2` KPI alert attempts are rejected by Mailgun HTTP `429`; no exact-final-SHA delivered audit with provider response ID and delivered timestamp exists.
6. **Final regression Gate 6 -- current-version boundary implemented and locally green.** Commit 13 exact-clean validation executed all 1,366 tests, passed 1,325, classified exactly 41 manifest-bound deferred failures, and left zero blocking current-version failures. The focused and affected Commit 13 packets, TypeScript, production build, and certification checks pass. Exact-final-SHA external revalidation remains Commit 14 work.

**Final certification closure rule:** the included GA4 KPI scope may be changed to `PRODUCTION_READY` only when the current-version required suite is explicit and passes, the remaining GA4 KPI failure is closed and the complete applicable packet passes, deferred tests remain visible and are not represented as passed, Gates 1, 2, 4, and report parity are revalidated on the final dependency boundary, Gate 5 records provider-confirmed KPI-alert delivery for the exact final deployment, and Gate 3 records a completed natural timer run for that same SHA with updated/skipped/failed KPI hashes. Missing evidence, a SHA change, or a new in-scope defect keeps status `UNVERIFIED`.

#### August 4, 2026 invalidated closure evidence

- Both SHA-bound `b91d0968` monitors recorded `sha_mismatch` after deployment changed to `82369cf5`; neither captured alert delivery or scheduler completion.
- Historical production health evidence confirmed exact deployed SHA `1166b9f27b81a06bd5c8b43072f77379e46453f4`. Its process started the GA4 daily scheduler at `2026-08-04T04:17:09.854Z`, had zero runs, and reported `nextRunAt=2026-08-05T03:00:00.000Z`.
- Read-only current-SHA audit inspection found GA4 KPI alert attempts but no delivery. Mailgun returned HTTP `429` with reset after `2026-08-04T19:34:00Z`; provider acceptance, response ID, and delivered timestamp are absent.
- Commit 11 exact-clean staged-patch validation on base `79322c4b`: the current-version command executed 1,366 tests, with 1,322 passed, exactly 3 blocking KPI failures, and exactly 41 visible deferred failures. The focused boundary/certification packet passed 15/15, the checker passed, TypeScript passed, and the production build passed.
- Commit 12 exact-clean staged-patch validation on base `b4178415`: the focused Benchmark file passed 15/15, the affected packet passed 14 files / 123 tests, and the current-version command executed 1,366 tests with 1,324 passed, exactly 1 blocking Commit 13 failure, and exactly 41 visible deferred failures. The deferred command independently executed 41/41 and reported all 41 failed; TypeScript, production build, certification regression, and checker passed. Runtime behavior did not change.
- Final status remains **UNVERIFIED**. No production-ready claim is made.

#### August 3, 2026 final closure evidence

- Production health returned exact deployed SHA `b91d096831bc04504ca7a3cae4191d28c8fa89ee` for the focused assertion-only closure commit.
- The automatic Gate 5 retry failed before mutation because its hard-coded SHA guard correctly rejected the newer deployment. A guarded rerun against `be926476` then passed confirmed test delivery and natural scheduled report delivery. The scheduled event has a sent snapshot and a Mailgun delivered audit; exact report restoration was independently confirmed.
- The completion-safe 03:00 monitor is bound to `b91d096831bc04504ca7a3cae4191d28c8fa89ee`; current health has zero runs and next execution `2026-08-04T03:00:00Z`, so exact timer completion remains unproven until then.
- The natural alert cycle created four new exact GA4 KPI retry audits. Each failed before provider acceptance with Mailgun HTTP `429`: the domain's daily request limit of 100 was exceeded and the provider says retry after `2026-08-03T19:18:14Z`. A read-only exact-SHA monitor is waiting for a delivered audit with provider response ID and delivered timestamp.
- Final validation: the focused parity file passed 26/26; the complete applicable KPI packet passed 46/46 files and 491/491 tests; certification regression 9/9, checker, TypeScript, and production build passed. Full suite passed 337/359 files and 1,292/1,320 tests; all 28 failures are deferred sources.
- Final status remains **UNVERIFIED**. No production-ready claim is made.

#### Gate 1 target-data inventory closure evidence — August 2, 2026

The public production `/api/health` response returned `nodeEnv=production` and exact revision `797cc0411fb5cfa5b77f1269432cec1a613bac55`. All database work used `BEGIN TRANSACTION READ ONLY`/`ROLLBACK` or the existing dry-run inventory. No provider endpoint, token refresh, source mutation, recompute, cleanup, email, report send, or destructive route was called.

The previous 17-item wording was overbroad. Exact dry-run classification is: 7 `financial_live_ga4_totals_not_local`, 3 `financial_no_primary_property`, and 7 `duplicate_email_audit_retained`. The last seven are immutable historical delivery evidence for superseded KPI IDs and are not unresolved financial KPI rows.

Every current financial KPI row was checked individually. Hashed identifiers preserve an auditable one-to-one boundary without publishing production IDs:

| KPI hash | Metric | Campaign/property/source boundary | Applicable windows | Available inputs and result |
| --- | --- | --- | --- | --- |
| `2f27f064cd32` | CPA | owner present; primary live property; UTC; no campaign filter; no configured financial sources | traffic `2026-07-03..2026-08-01`; financial sources `1900-01-01..2026-08-02` | no persisted native rows, revenue, or spend; encrypted-only credentials recorded expired `2026-01-10`; direct refresh-disabled provider call returned `401` with no refresh/persistence attempt; stored `6.01` is correctly classified unavailable/last-good, not current |
| `409889f93cb8` | ROAS | owner present; primary simulated `yesop`; UTC; campaign filter; CSV/Sheets/HubSpot revenue and Sheets spend | same captured windows | deterministic baseline + 2 simulated daily rows + `$58,800` imported revenue + `$498.75` spend resolves `608.06`, exactly matching stored current value; verified |
| `a842bb0ae61a` | Revenue | same simulated campaign/property/source boundary | same captured windows | deterministic baseline + persisted native + imported revenue resolves `$303,270.42`, exactly matching stored current value; verified |
| `dd14fc00c0b8` | ROAS | owner present; no active connection/property; UTC; no campaign filter or financial sources | same captured windows | no provider or persisted inputs; stored zero is not authoritative and the shared fail-closed resolver state is unavailable; exact inventory classification passed without inventing a property or value |
| `3d0f126ef97f` | CPA | same disconnected campaign boundary | same captured windows | no provider or persisted inputs; stored zero is not authoritative and the shared fail-closed resolver state is unavailable; exact inventory classification passed without inventing a property or value |
| `befd1e90d209` | Revenue | owner present; primary live property; UTC; campaign filter; HubSpot revenue and manual spend source | same captured windows | no persisted native rows; `$12,000` imported revenue; spend source has no records; encrypted-only credentials recorded expired `2026-01-19`; direct refresh-disabled provider call returned `401` with no refresh/persistence attempt; stored `$2,000` is correctly classified unavailable/last-good, not current |
| `7ed1d5c4d10f` | Revenue | owner present; primary live property; Europe/Amsterdam; campaign filter; CSV/HubSpot/Shopify revenue and CSV/Sheets spend | same captured windows | refresh-disabled provider success plus imported revenue resolved `$51,405.93`, exactly matching stored current value; no token refresh/persistence was attempted; verified for the captured window |
| `ff24c717b842` | Revenue | same live campaign/property/source boundary; its only calculation metadata is alert-email schedule | same captured windows | same refresh-disabled provider/source inputs resolved `$51,405.93`, exactly matching stored current value; verified for the captured window |
| `85cf158ed54d` | Revenue | owner present; active primary connection has an empty Property ID; UTC; campaign filter; HubSpot revenue and ad-platform spend | same captured windows | no native rows; `$10,000` imported revenue and `$13,858.31` spend exist, but the required native boundary is absent; the shared resolver state is unavailable and stored `$10,000` is not certified as freshly resolved |
| `6b20ec6d5b3e` | Revenue | owner present; primary simulated `yesop`; UTC; campaign filter; no financial child sources | same captured windows | deterministic baseline resolves `$150,220.15`, exactly matching stored current value; verified |

All 10 rows are standard recognized metrics with `applyTo=all`; there is no specific-campaign override or hidden source-ID calculation mapping. Commit 10A corrects the queue's root classification error: target-data inventory completeness and live-provider behavior are separate external gates. Gate 1 passes because every target row and absence is exhaustively classified. Gate 4 now separately passes with two live-provider successes and two exact refresh-disabled authentication-failure classifications. The three propertyless rows remain proven unavailable-state rows and require no user configuration. At that checkpoint, status remained `UNVERIFIED` for Gates 3 and 5; the August 3 closure evidence above supersedes the blocker list.

Focused validation passed 2 files / 14 tests (`ga4-kpi-damaged-data-cleanup-regression` 5/5 and certification gate 9/9), and the standalone certification checker passed with the record intentionally `UNVERIFIED`.

#### Gate 2 deployed state-matrix evidence — August 2, 2026

The public production `/api/health` response returned `nodeEnv=production` and exact revision `bc0d0f73d2980ba16df71ae382546aa3d2974c09`. Production inspection used `BEGIN TRANSACTION READ ONLY` followed by `ROLLBACK`. No GA4 daily GET, provider call, token-capable helper, refresh, scheduler, recompute, report send, alert action, or production write was invoked.

Exact production boundary:

- 23 GA4 KPI parent rows exist. Nineteen join to an existing actor-owned campaign. Those rows were checked for campaign, primary property or proven absence, saved campaign filter, source mix, reporting timezone, applicable 30-completed-day or campaign-to-date window, persisted inputs/value, threshold, and notification linkage.
- available state evidence includes propertyless/unavailable rows, expired-provider or persisted last-good candidates, verified deterministic simulated-property rows, UTC and Europe/Amsterdam reporting zones, filtered and unfiltered campaigns, and mixed native/imported revenue/spend inputs
- production does not contain an authoritative valid-zero row: the only stored zero rows lack the required property and therefore resolve unavailable. It also has no campaign-valid fixture that safely proves blocked, insufficient-data, or natural failure without mutation or a provider/token-capable request
- the normal GA4 daily GET was not used because its current path may backfill daily rows or refresh/persist tokens; calling it would violate this gate's non-mutating boundary
- linked-notification inventory found 36 notifications for the unavailable Summer splash Revenue row, all resolved and none unread. Seven unresolved notification rows remain across five campaign-valid KPI identities; this is inventory evidence only, not a deployed browser-visibility capture
- four legacy KPI parents reference deleted campaign hash `8460eb013897`: Total Users (`50880`), Engagement Rate (`54`), Total Conversions (`2592`), and Conversion Rate (`3.95`), all last updated March 19, 2026. All four have zero progress, alert, and period children. Only Conversion Rate has notification history (35 rows), all resolved with zero current visible candidates. The deployed campaign-list API requires access to an existing campaign before selecting exact campaign/platform rows, and the current campaign-delete transaction deletes KPI children and parents; therefore no current exposure or forward-delete defect was proven. The legacy persisted parent rows nevertheless remain an unresolved data-integrity boundary and are not counted as campaign-valid state evidence

Consumer-contract evidence is local/source-traced, not a deployed visual claim: the shared state resolver permits breach/scoring/guidance only for `verified`; KPI card breach pulse and tracker scoring use that eligibility; KPI-derived Insights emit integrity guidance instead of performance conclusions for unverified states; bell/Notifications enrichment uses the same alert decision and dismissed/resolved visibility rules; browser PDF prints state/window labels and excludes unverified rows from verified scoring. The focused browser-consumer packet passed 10 files / 227 tests, and a broader state/inventory/certification subset passed 10 files / 125 tests.

Gate 2 status at the time of Commit 10B was **pending**. The consolidated closure evidence immediately below supersedes that bounded result and records Gate 2 as passed. At that checkpoint, overall KPI status remained **UNVERIFIED** because Gates 3 and 5 were incomplete; the August 3 closure evidence above is the current blocker list.

#### Consolidated Gate 2 closure and Gates 3-6 evidence — August 2, 2026

Revision `65e2b83398094cb7f9f2424b9ac98febee92f66c` was first confirmed deployed. The bounded fixes and evidence guards were committed as `80a659b819f64868ff766490348e0e5cb93bef76`, pushed, and then confirmed by `/api/health` as the exact production revision.

Chronological production evidence and actions:

1. Dry-run orphan detection returned exactly four `google_analytics` parents with non-null campaign IDs absent from `campaigns`; valid campaigns, null-campaign rows, and other platforms were excluded. The identity-set SHA-256 was `d962da42417125d3514274f2f2b957789bd71ed6796e8c73540adf19fce67f58`.
2. The one explicitly authorized guarded transaction required the exact count and digest, rechecked parent/campaign/child scope inside the transaction, deleted exactly four parent rows, and retained resolved notification audit. Post-run dry-run returned orphan count zero. Current campaign deletion already uses the transactional cascade, so this was historical damaged-data cleanup, not evidence of a current forward-delete defect.
3. The deployed browser matrix used a temporary authenticated Clerk session that was revoked after each run. All application API GETs were fulfilled by client-side fixtures; every non-GET application request was blocked with 405 and the captured mutation-request list was empty. Valid zero remained authoritative and produced the expected current breach. Unavailable, stale/last-good, blocked, and insufficient-data showed zero Above/On Track/Below counts, no breach pulse, no bell attention, no KPI performance conclusion, and Avg. Progress `—`. Failed KPI-list state showed no card or tracker. Every state produced a browser download with `%PDF` header; artifact sizes were 6,117-17,115 bytes.
4. The first deployed matrix exposed one narrow defect: zero eligible rows displayed Avg. Progress `0.0%`. Commit `80a659b8` changes only the KPI screen and browser PDF to display `—` when `scored=0`; focused coverage and deployed reruns passed.
5. Refresh-disabled provider validation was added without changing the default route. With `disableTokenRefresh=1`, authentication failure returns fail-closed status without calling token refresh or token persistence. Live and simulated-failure calls for hashes `7ed1d5c4d10f` and `ff24c717b842` passed as described in queue item 4. The two other documented live-provider rows remain pending solely because no active owner session exists.
6. Natural scheduler health is exact: deployed timer scheduled, startup disabled, zero runs, next natural execution `2026-08-03T03:00:00Z`. The implementation now emits exact recompute ID arrays to the natural-run log. No scheduler, recompute, refresh, or token refresh was manually triggered.
7. Report inventory proved the fixture mismatch in queue item 5. Provider acceptance was not treated as delivery, historical delivery rows were not rebound to this SHA, and no recipient/configuration change or irrelevant send was performed.

Historical Gate 6 checkpoint on `80a659b8`: the focused new packet passed 6 files / 30 tests; the documented combined GA4 KPI/alert/report/browser/provider/scheduler/destructive packet passed 26 files / 316 tests; certification regression passed 9/9; the standalone checker, TypeScript, and production build passed. The full repository suite passed 146/158 files and 1,270/1,299 tests. Its 29 failures across 12 files were 28 deferred Google Ads, Instagram, Meta, or TikTok assertions plus one unrelated shared spend-delete assertion; no focused GA4 KPI packet failed at that revision. The August 3 current-SHA result above supersedes this checkpoint.

Final certification status: **UNVERIFIED**. Gate 2 and the GA4-local portion of Gate 6 pass. Gate 3 awaits the scheduled time, Gate 4 lacks authenticated access to two campaign owners, and Gate 5 has no existing selected-KPI report with configured recipients/schedule. These are the complete remaining blockers; no additional gate is created.

## Earlier Historical Status And Evidence (non-authoritative)

Everything below this heading predates the August 1, 2026 controlling re-certification. It may be used as historical evidence for a specifically unchanged path, but it cannot supply the current status or bypass Current Commits 0-10 above.

Current-code override on July 31, 2026: Commit 18 changes the shared campaign KPI current-value failure contract. Failed financial reads, disconnected/missing GA4, and missing selected source IDs now return unavailable so existing refresh loops preserve last-known values instead of writing misleading zero. The bounded local implementation is proven by focused tests, TypeScript, and a production build, but it is not yet committed, deployed, or externally validated. The affected current-value/recompute/alert path is therefore **unproven**, and the historical certification below must not be repeated as a current whole-path claim until Commit 18 deployed validation passes. Timer-fired scheduler execution remains outside this Commit 18 proof.

As of June 29, 2026, GA4 KPIs are **production-ready for the current GA4 code scope**.

Current Commits 0-7 have been implemented, locally validated, committed, pushed, deployed, and user-validated through the GA4 KPI UI flow listed below. The later GA4 Revenue notification visibility bug was fixed in commits `0f1be173` and `3ed67320` and user-validated on the deployed app on June 29, 2026. The follow-up direct GA4 snapshot PDF fix was committed as `4d3a3838`, pushed, deployed, and user-validated on June 29, 2026; direct GA4 snapshot PDF downloads now run a suppress-alert GA4 KPI/Benchmark preflight before regenerating PDFs with latest KPI values. The deployed GA4 daily scheduler was also user-validated on June 29, 2026 with `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false` and a controlled near-future scheduled UTC run. Immediate GA4 KPI alert email delivery was user-validated after commits `fef2534c`, `6063fca8`, and `39ca378d`. Final scheduled-report/provider validation was user-confirmed on June 29, 2026: Render logs showed `[Report Scheduler]` and `Email accepted by Mailgun HTTP API`, the scheduled report email arrived, and the received report output matched the current GA4 KPI values.

Certification result:

- completed local fixes: persisted financial source windows, source lifecycle recompute, custom/unsupported KPI row preservation, duplicate-alert latest-row handling, scheduled/test/manual report consumer fail-closed guards, damaged-data inventory/cleanup boundaries, and GA4 financial notification source parity
- deployed UI validation completed by user: GA4 KPIs tab open/render, existing KPI values, create/edit/delete KPI, GA4 revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available
- target database damaged-data dry-run completed on June 29, 2026: 0 candidates, 9 skipped rows, 0 applied, no `--apply` needed from this output
- deployed/user-validated on June 29, 2026: direct GA4 snapshot PDF download after commit `4d3a3838` uses the suppress-alert GA4 KPI/Benchmark preflight before the shared PDF builder reads current KPI rows, and the deployed validation passed
- deployed/user-validated on June 29, 2026: GA4 daily scheduler execution timing passed on Render using `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`, `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, and a controlled near-future `GA4_DAILY_REFRESH_HOUR` / `GA4_DAILY_REFRESH_MINUTE`; the scheduled run showed `trigger=scheduled` rather than startup-only execution
- deployed/user-validated on June 29, 2026: immediate GA4 KPI alert email delivery succeeded through Mailgun/provider configuration after the region-aware delivery fixes
- deployed/user-validated on June 29, 2026: scheduled GA4 report execution ran in Render, Mailgun HTTP API accepted the send, the email arrived, and the report output matched current GA4 KPI values
- not locally verifiable / external caveat: future live GA4 provider outages, token-refresh edge cases, GA4 processing latency, Mailgun/provider outages, recipient spam filtering, and future unvalidated source mixes or code changes

The historical June answer was:

`GA4 KPIs are production-ready for the current GA4 code scope. Current Commits 0-7, the follow-up GA4 notification financial-source visibility fix, the direct GA4 snapshot PDF preflight fix, the target-database damaged-data dry-run, deployed GA4 daily scheduler timing validation, immediate GA4 KPI alert email validation, and scheduled GA4 report/provider validation are complete. The target-database damaged-data inventory dry-run completed with 0 candidates and 9 skipped rows, so no apply command should be run from this output. This certification applies only to the current GA4 code scope and validated deployed paths; future provider outages, live GA4 latency/token-refresh edge cases, new source mixes, or code changes require a new readiness pass.`

This status should change only after:

- a new bug is found in a GA4 KPI value, lifecycle, scheduler, alert, notification, or report-consumer path
- the GA4 KPI source model, provider configuration, scheduler behavior, report generation path, alert/email behavior, or downstream consumers change
- a future source/platform attempts to reuse this evidence without its own source-specific proof

Historical certification rule:

- completing the local fix queue makes GA4 KPIs eligible for production-readiness certification; it does not by itself make them production-ready
- the historical final answer was allowed to remain `production-ready for the current GA4 code scope` only while the complete current value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, and test coverage remained covered by current code and validation evidence
Historical future-chat answer (superseded by the August 12 controlling status):

- At that time, GA4 KPIs remained `UNVERIFIED` until Current Commits 1-10 passed.
- This historical instruction must not override the controlling status at the top of this document.
- The audit shape remains reusable as a template; neither the historical certification nor future GA4 fixes prove another source ready.

## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Current Certification Gaps And Completed Local Fixes`
4. `Chronological smallest-safe fix queue` in the controlling status
5. `Validation Evidence And Gaps`
6. `Future Platform Template`

Historical instruction, superseded: the former `1a93d8d8` release-candidate answer must not be reused. The controlling current answer is **PRODUCTION_READY** for certified runtime boundary `19f055372abe8aee789dd4205eba5decef5f39a5`.

Do not reopen GA4 Overview, Benchmarks, Ad Comparison, Insights, or Reports unless a KPI value path directly depends on them. Scheduled/server GA4 reports are a direct downstream KPI consumer because they read persisted GA4 KPI rows.

## Future Source Reading Order

Use this order when adapting the GA4 KPI model to Meta, Google Ads, LinkedIn, Google Sheets, or another source:

1. Read `GA4/KPIS.md` for the functional tab contract: visible workflow, metric options, current-value behavior, gating, alerts, delete behavior, and refresh expectations.
2. Read this file for the current whole-tab readiness status: current blockers, partially proven paths, validation gaps, historical fixes, caveats, and future-platform gates.
3. Read `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` for the metric-aware threshold/scoring policy template.
4. Read `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` for the alert, notification, email-audit, action URL, bell, and Notifications lifecycle template.
5. Create or update a source-specific readiness file for the target platform. Do not treat GA4 evidence as proof that Meta, Google Ads, LinkedIn, Google Sheets, or another source is production-ready.

Stable file roles:

- `GA4/KPIS.md` = what the GA4 KPI tab does
- `GA4/KPIS_PRODUCTION_READINESS.md` = whether GA4 KPIs are production-ready and how to prove a future source
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` = threshold/scoring policy template and historical slice record
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` = alert, notification, email-audit, action URL, bell, and Notifications lifecycle template

For a future source, prove source identity, account/property/customer scoping, selected campaign/ad set/ad group scope, current-value UI path, persisted recompute path, threshold policy, alert and notification path, scheduler/reprocess path, ownership checks, delete behavior, report consumers, and existing-data cleanup boundary before calling that source's KPIs production-ready.

## Current Scope

This audit applies to the current GA4 `KPIs` tab for:

- platform-scoped GA4 KPI create, edit, delete, and list display
- KPI current-value calculation for GA4 platform KPIs
- KPI tracker summary counts and average progress
- KPI blocked and insufficient-data handling
- KPI alert and notification visibility
- KPI alert email eligibility and local audit behavior
- GA4 refresh, daily scheduler, and on-demand recompute paths that update KPI current values and KPI progress history
- GA4 campaign, property, source, and campaign-access scoping that can affect KPI values

This audit does not automatically certify:

- Meta KPIs
- Google Ads KPIs
- LinkedIn KPIs
- Google Sheets KPIs
- custom-upload KPIs
- campaign-level KPI pages except where they consume GA4 values
- provider-side email delivery
- live GA4 API behavior outside what local code and tests can prove

## Root Cause Of Prior Confusion

Earlier KPI readiness notes certified narrower slices:

- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` covers metric-aware threshold math and visible KPI scoring behavior.
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` covers much of the in-app and email alert implementation.
- `GA4/KPIS.md` defines the product contract and expected tab behavior.

Those files did not fully certify the whole KPI production lifecycle.

The later audit traced the scheduler-persisted current-value path and found a separate defect: GA4 KPI ROAS is displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persisted ROAS as a percent. Platform GA4 alert checks read persisted values, so the defect affected alerts, notification visibility, email eligibility, KPI progress history, and downstream consumers that rely on persisted KPI rows.

That defect and the related property-scope, CPA sufficiency, ROAS copy, shared Benchmark access, and existing-data cleanup blockers have now been fixed through the completed queue below.

This file exists so future reviews do not confuse threshold readiness with whole-tab production readiness.

## Non-Negotiable Accuracy Rules

GA4 KPIs must preserve:

- campaign ownership and campaign access checks
- GA4 property scoping
- selected GA4 campaign/source scoping
- imported revenue additivity
- spend-source provenance
- ROAS as an `x` ratio, not a percent
- ROI as a percent
- CPA as currency
- metric-aware KPI status classification
- blocked and insufficient-data exclusion from tracker counts and average progress
- one active in-app notification row per active GA4 KPI breach
- email provider acceptance vs confirmed delivery semantics
- stable API response shapes

Do not change KPI calculations, alert semantics, source ownership, scheduler behavior, or response shapes unless the exact code path has been traced.

## Data Path Summary

Visible UI current-value path:

`GA4 property/source selection -> GA4 daily/to-date API responses -> frontend financial/current-value model -> KPI cards and tracker`

Persisted production path:

`GA4 daily refresh or on-demand refresh -> server/ga4-kpi-benchmark-jobs.ts -> storage.updateKPI(currentValue) -> KPI progress history -> checkPerformanceAlerts() -> in-app notification and email alert decisions`

Important meaning:

- visible cards and persisted alert state are separate paths
- both paths must use the same unit semantics
- a correct visible KPI card does not prove scheduler, notification, or email correctness
- a green threshold test does not prove current-value provenance correctness

## Current Commit 7 Certification Pass

Root cause of the prior certification failure:

- Earlier readiness updates treated completed fixes as equivalent to certification.
- The Current Commit 7 pass reran the root `PRODUCTION_READINESS.md` standard and found that local tests proved the narrow fixed code paths, but did not yet prove deployed UI behavior, target database state, provider delivery, the then-unvalidated GA4 daily scheduler execution, or the then-unfixed direct historical snapshot PDF freshness semantics. Deployed UI validation, target database dry-run evidence, direct GA4 snapshot PDF deployed validation after commit `4d3a3838`, deployed GA4 daily scheduler timing evidence, immediate GA4 KPI alert email delivery, and scheduled GA4 report/provider evidence have since been added.
- Therefore the correct status is production-ready for the current GA4 code scope, with future provider outages, live GA4 token/latency edge cases, future source mixes, and future code changes remaining outside this certification.

### Complete GA4 KPI Value Inventory

| Value / surface | Source path | Formula / semantics | Scope and window | Downstream consumers | Current evidence status |
| --- | --- | --- | --- | --- | --- |
| KPI grid row count and tracker `Total KPIs` | GA4 KPI list query -> platform KPI rows | Count of GA4 KPI rows in current campaign/platform scope | Campaign + `google_analytics`; current saved rows | KPI tab UI, executive snapshot | Route access and frontend invalidation traced; user-confirmed deployed UI validation passed |
| `Above Target`, `On Track`, `Below Target`, `Avg. Progress` | KPI rows -> shared KPI math/status policy | Metric-aware progress, tolerance, blocked/insufficient exclusions; compact tracker copy must say `each KPI's tolerance` and must not expose derived absolute-count amounts such as `41 users` | Campaign + visible KPI rows | KPI tracker, executive interpretation | Shared math tests passed; user-confirmed deployed UI validation passed |
| Standard GA4 KPI current values: Users, Sessions, Pageviews, Conversions | GA4 daily/to-date metrics -> visible UI and persisted recompute job | Count totals, rounded as counts | Selected campaign, primary/selected GA4 property, GA4 campaign filter, completed GA4 reporting date | KPI cards, progress history, alerts, notifications, reports | Proven for current code scope by GA4 KPI regression tests plus deployed UI/scheduler/report validation; future live provider outages/token-refresh are external caveats |
| Revenue | GA4 native revenue + active GA4-context imported revenue | `ga4Revenue + importedRevenue` | Native GA4 window stays completed reporting date; imported revenue window is `1900-01-01` through current UTC date | KPI card, tracker, progress, alerts, scheduled/server reports | Proven locally for persisted source-window and notification financial-source regressions; user-confirmed deployed UI validation passed |
| ROAS | Revenue / active spend | Ratio `x`, not percent | Same campaign/source windows as Revenue and Spend | KPI card, progress, alerts, notification/email, reports | Proven for current code scope by ratio semantics tests, financial source-window coverage, target damaged-data dry-run, deployed source mutation validation, and deployed report/email validation; future live provider outages are external caveats |
| ROI | `(Revenue - Spend) / Spend * 100` | Percent | Same campaign/source windows as Revenue and Spend | KPI card, progress, alerts, notification/email, reports | Proven for current code scope by financial source-window coverage, target damaged-data dry-run, deployed source mutation validation, and deployed report/email validation; future live provider outages are external caveats |
| CPA | Spend / conversions | Currency cost per conversion; insufficient when spend or conversions are missing | Spend through current UTC date, conversions through GA4 completed reporting date | KPI card, tracker, progress, alerts, reports | Proven for current code scope by sufficiency tests, financial-window coverage, deployed source mutation validation, and deployed report validation; future live provider outages are external caveats |
| Conversion Rate | Conversions / sessions | Percent with zero-session guard | GA4 completed reporting date/to-date scope | KPI card, tracker, alerts, reports | Proven for current code scope by shared/GA4 regression coverage and deployed UI/report validation; future live provider outages/token-refresh are external caveats |
| Engagement Rate | GA4 engagement rate normalized to percent | Percent | GA4 completed reporting date/to-date scope | KPI card, tracker, alerts, reports | Proven for current code scope by formula coverage and deployed UI/report validation; future live provider outages/token-refresh are external caveats |
| Custom or unsupported KPI rows | Saved `kpis.currentValue` | Manual/unsupported value is preserved; no guessed recompute | Campaign + `google_analytics`; no automatic current-value formula | KPI card, alerts if enabled, reports | Proven locally for forward recompute preservation; prior zero-overwrite damage not repairable without original value |
| KPI progress history | Recompute job -> `kpi_progress` rows | Daily point, rolling averages, trend direction | Auto GA4 daily rows with `auto:ga4_daily:YYYY-MM-DD` notes | Trends, alerts, downstream summaries | Proven for current code scope by standard recompute/progress coverage, custom skip coverage, target damaged-data dry-run, and deployed scheduler validation; future historical imports are external caveats |
| Active KPI notifications | Alert check -> notification row metadata keyed by KPI ID | One active GA4 in-app alert per unresolved breach; enabled alerts are not visible in the bell or Notifications unless currently breached; GA4 financial alerts use the same Revenue/ROAS/ROI/CPA source model as the KPI cards; older duplicate KPI alerts resolved/suppressed | Campaign, KPI ID, latest duplicate row per campaign+metric/name | Bell, Notifications center, action URL | Proven locally for duplicate forward path, cleanup boundary, breach-only visibility, and GA4 financial-source parity; exact stale Revenue alert was user-confirmed fixed on deployed UI |
| KPI alert emails and audit rows | Alert monitoring -> email send claim/audit | Provider acceptance is separated from confirmed delivery; duplicate GA4 KPI IDs suppressed before claim/send | Campaign, KPI ID, frequency window, recipients | Email provider, audit retry path | Proven for current code scope by local audit/retry/idempotency tests plus user-confirmed immediate GA4 KPI alert email receipt; future provider outages/spam filtering are external caveats |
| Scheduled/test/manual/direct GA4 report KPI tables | GA4 report scheduler/PDF builder -> persisted platform KPI rows | Persisted KPI `currentValue` and `targetValue`; fail closed on preflight/PDF/KPI-read failures for covered creation/send/download paths | Campaign + report config; preflight recompute before send/test/manual snapshot creation and before direct snapshot PDF regeneration | PDF attachments, report sends, manual snapshots, direct snapshot PDF downloads | Proven for current code scope by source regression tests, direct snapshot PDF deployed validation after commit `4d3a3838`, and user-confirmed scheduled report/provider validation on June 29, 2026 |
| Damaged-data inventory | `server/ga4-kpi-damaged-data-cleanup.ts` | Dry-run inventory; bounded apply only for proven financial drift and duplicate notifications | Target database from `.env`, optional campaign filter | Data cleanup decision, certification evidence | Target dry-run completed June 29, 2026: 0 candidates, 9 skipped rows, 0 applied; no `--apply` required from this output |

### End-To-End Trace Matrix

| Path | Source -> storage -> API/UI -> downstream trace | Evidence status |
| --- | --- | --- |
| KPI create | UI create -> platform KPI route with campaign access -> storage create -> GA4 recompute for GA4 rows -> alert check -> frontend query invalidation | Route/source guards covered; user-confirmed deployed UI validation passed |
| KPI edit | UI update -> `ensureKpiAccess` + platform check -> storage update -> GA4 recompute when GA4 campaign row -> alert check -> query invalidation | Route behavior traced; user-confirmed deployed UI validation passed |
| KPI delete | UI delete -> `ensureKpiAccess` + platform check -> storage delete/cascade -> notification visibility refresh | Access/delete mechanics traced; user-confirmed deployed UI validation passed |
| Daily/on-demand recompute | GA4 daily/on-demand refresh -> `runGA4DailyKPIAndBenchmarkJobs` -> `storage.updateKPI` -> progress history -> alert checks | Proven for current code scope by fixed financial windows, custom preservation tests, and deployed GA4 daily scheduler timing with `trigger=scheduled`; future live provider outages/token-refresh are external caveats |
| Source add/edit/delete recompute | GA4 revenue/spend route -> source mutation/recalc -> GA4 KPI/Benchmark recompute -> alert check -> response/frontend refresh | Proven locally by route-order regression guards; user-confirmed deployed source mutation validation passed for KPI values and alert refresh |
| Alerts/notifications | Persisted `kpis.currentValue` -> `checkPerformanceAlerts`/immediate email path -> latest-row guard -> notification/email audit | Proven for current code scope by duplicate latest-row, breach-only visibility, financial-source parity tests, and user-confirmed immediate email/provider validation |
| Scheduled/test/manual/direct snapshot reports | Report preflight -> GA4 recompute result check -> PDF builder -> KPI rows from storage -> send/snapshot creation or direct PDF download | Proven for current code scope by covered send/test/manual/direct PDF tests, direct snapshot PDF deployed validation after commit `4d3a3838`, and user-confirmed scheduled report/provider validation |
| Existing damaged data | Read-only inventory -> candidate/skip classification -> explicit `--apply` only for proven boundaries | Proven locally for script behavior; target database dry-run completed with 0 candidates and 9 skipped rows; no apply run needed from this output |

### Downstream Propagation Matrix

| Downstream consumer | KPI value used | Propagation rule | Status |
| --- | --- | --- | --- |
| KPI tab cards/grid | Visible/current KPI values and saved KPI rows | Render campaign-scoped GA4 KPIs and current-vs-target state | User-confirmed deployed UI validation passed |
| KPI tracker summary | KPI card status/progress | Aggregate counts and average progress after insufficiency/blocking policy | Shared tests passed; user-confirmed deployed UI validation passed |
| KPI progress/history | Persisted recompute value | Auto point only for computable GA4 KPI metrics | Proven locally for custom skip and financial window fixed paths |
| In-app notification bell/center | Persisted KPI breach state | `/api/notifications` returns KPI performance-alert rows only while the linked KPI exists, remains campaign-scoped, is currently breached, and for GA4 financial KPIs uses the same selected financial-source model as the live KPI cards; latest GA4 duplicate row wins and older duplicate notifications resolve/suppress | Proven locally by duplicate-alert and notification-visibility regression tests plus cleanup boundary test; user-confirmed deployed stale Revenue alert fix passed |
| Immediate/scheduled KPI emails | Persisted KPI breach state | Latest GA4 duplicate row must be sendable before claim/send; provider acceptance is recorded separately from confirmed receipt | Proven for current code scope by local email tests and user-confirmed immediate GA4 KPI alert email receipt; future provider outages/spam filtering are external caveats |
| Scheduled/test/manual GA4 report PDFs | Persisted `platformKPIs` rows | Preflight recompute must process target campaign; PDF unavailable fails closed for covered creation/send paths | Proven for current code scope by local report-consumer tests and user-confirmed scheduled report/provider validation |
| Direct GA4 snapshot PDF download | Suppress-alert GA4 preflight recomputes current persisted KPI rows before the shared PDF builder reads them | Return 422 and do not generate the PDF if the target campaign is not processed; no alert/send side effects from direct download | Source-regression covered and user-confirmed deployed validation passed after commit `4d3a3838` |
| GA4 Insights and other related consumers | KPI/Benchmark context where used | Not reopened in this KPI-only queue except direct report dependencies | Not locally verifiable in this queue |
| Existing-data cleanup | Persisted KPI rows, notifications, email audit rows | Dry-run inventory first; mutate only exact proven candidate boundaries | Locally covered script behavior; target database dry-run completed with 0 candidates, 9 skipped rows, and 0 applied |

### Source Lifecycle Matrix

| Lifecycle path | Current local status |
| --- | --- |
| KPI add/create | API route and recompute side effects traced; user-confirmed deployed UI validation passed |
| KPI edit/update | API route and recompute side effects traced; user-confirmed deployed UI validation passed |
| KPI delete | Access guard and notification visibility behavior traced; user-confirmed deployed UI validation passed |
| Revenue source add/edit/delete | Proven locally for GA4 recompute ordering via route guard tests; user-confirmed deployed source mutation validation passed for KPI value and alert refresh |
| Spend source add/edit/delete | Proven locally for GA4 recompute ordering via route guard tests; user-confirmed deployed source mutation validation passed for KPI value and alert refresh |
| Scheduler refresh | GA4 daily scheduler timing user-validated on Render with `trigger=scheduled`; scheduled GA4 report execution/provider path user-validated on Render |
| Manual/on-demand refresh | Proven for current code scope through shared recompute coverage and deployed UI/report validation; future live provider response failures are external caveats |
| Alerts/notifications | Proven locally for latest-row duplicate guard, breach-only visibility, and GA4 financial notification source parity; user-confirmed deployed bell/Notifications validation and immediate email/provider validation passed |
| Reports | Proven locally for scheduled/test/manual report creation/send guards and direct GA4 snapshot PDF preflight regeneration; direct snapshot PDF deployed validation passed after commit `4d3a3838`; scheduled report/provider validation passed on Render |
| Existing damaged data | Locally covered inventory/cleanup script behavior; target dry-run completed with 0 candidates, 9 skipped rows, and 0 applied |

### Negative-Case Matrix

| Negative case | Expected behavior | Evidence status |
| --- | --- | --- |
| Current-day imported revenue/spend changes after yesterday | Persisted financial KPI values include current UTC source totals | Proven locally by financial-window regression |
| Zero or missing spend for CPA/ROAS/ROI | Avoid misleading financial ratios where sufficiency rules require inputs | Proven for current code scope by math/regression coverage and deployed source mutation validation |
| Unsupported/custom GA4 KPI metric | Do not overwrite current value to guessed `0`; do not create auto progress point | Proven locally by custom preservation regression |
| Duplicate active GA4 KPI rows for same campaign+metric/name | Only latest row can create/preserve active alert/email eligibility | Proven locally by duplicate-alert regression |
| Older duplicate active notification exists | Inventory/apply can mark notification resolved/superseded without hard delete | Proven locally by damaged-data cleanup regression |
| Existing custom row currently `0` | Inventory only; leave unchanged because original manual value is unproven | Proven locally by cleanup boundary regression |
| Access-token GA4 campaign in cleanup | Skip financial cleanup because live provider totals may be involved | Proven locally by cleanup boundary regression |
| Report preflight recompute fails or skips campaign | Scheduled/test/manual report path fails closed before artifact/send/snapshot | Proven locally by report-consumer regression |
| KPI rows cannot be loaded for a KPI-section PDF | KPI-section PDF generation fails closed | Proven locally by report-consumer regression |
| Direct GA4 snapshot PDF download | Suppress-alert preflight must process the report campaign before PDF generation | Locally fixed and covered by report-consumer regression |
| Non-breached GA4 financial alert has stale active notification row | `/api/notifications` must hide the row after recomputing Revenue/ROAS/ROI/CPA from the same financial source model as the KPI card | Proven locally by notification visibility regression; exact Revenue case user-confirmed fixed on deployed UI |

### Test Coverage Matrix

| Coverage area | Test evidence |
| --- | --- |
| Persisted financial source windows | `server/ga4-kpi-financial-window-regression.test.ts` |
| GA4 source lifecycle recompute ordering | `server/ga4-source-lifecycle-recompute-regression.test.ts` |
| Custom/unsupported KPI preservation | `server/ga4-kpi-custom-preservation-regression.test.ts` |
| Duplicate latest-row alert behavior | `server/ga4-kpi-duplicate-alert-regression.test.ts` |
| Scheduled/server/direct snapshot report KPI consumers | `server/ga4-kpi-report-consumer-regression.test.ts` |
| Existing damaged-data inventory/cleanup boundaries | `server/ga4-kpi-damaged-data-cleanup-regression.test.ts` |
| Existing GA4 KPI/financial/math regressions | `server/ga4-kpi-benchmark-summary-regression.test.ts`, `server/ga4-kpi-benchmark-roas-regression.test.ts`, `server/ga4-kpi-regression.test.ts`, `server/ga4-financial-rules.test.ts` |
| Type/contract safety | `npm run check` |

### Documentation Alignment Check

| Document | Alignment status |
| --- | --- |
| `GA4/KPIS.md` | Updated in Current Commit 7 to retract the stale June 27 production-ready claim and updated again to document GA4 financial notification parity |
| `GA4/README.md` | Updated to stop advertising GA4 KPIs as production-ready and record that the damaged-data dry-run completed with no apply candidates |
| `GA4/FINANCIAL_SOURCES.md` | Updated to document that alert/notification financial values must use the same selected GA4 financial-source model as `Total Revenue` |
| `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` | Updated with the deployed GA4 Revenue notification financial-source parity fix and user validation evidence |
| `GA4-MANUAL-TEST-PLAN.md` | Updated to include GA4 financial notification current-value parity and stale non-breached alert disappearance checks |
| `GA4/KPIS_PRODUCTION_READINESS.md` | Updated in Current Commit 7 with final certification result, matrices, evidence, and remaining gates |
| `GA4/REFRESH_AND_PROCESSING.md` | Updated to document GA4 financial notification visibility as part of post-refresh breach-only behavior |
| `PRODUCTION_READINESS.md` | Already contains the reusable anti-overclaim/certification requirement; not touched in Current Commit 7 |

## Current Production-Readiness Map

### 1. KPI Tab UI And Creation Flow

Status: Deployed UI validated by user on June 29, 2026. The visible GA4 KPI create/edit/delete UI flow is locally traced, current route/recompute side effects have targeted coverage, and user-confirmed deployed validation covered existing KPI values, create/edit/delete, revenue/spend source mutation, alerts/notifications, and report send/manual snapshot where available.

Proven locally:

- GA4 KPI create/update/delete calls the platform KPI routes with `platformType=google_analytics`.
- create and update success paths invalidate the GA4 KPI query and refresh notification queries.
- the create modal requires KPI name and target before save.
- visible ROAS values use the GA4 financial ratio model.
- template tiles expose ROAS as a ratio-style KPI.

Resolved issue:

- the default ROAS description no longer says `as a %` in helper text when a description is generated from defaults.

Historical validation:

- deployed UI validation passed for the narrower June 27 fix queue.
- browser validation covered only the GA4 `KPIs` tab paths affected by historical Commits 1-6.

### 2. KPI Current-Value Calculation

Status: Production-ready for the current GA4 code scope. Standard formulas, persisted financial source windows, custom/unsupported preservation, duplicate-alert behavior, scheduled/manual/direct snapshot report consumer guards, notification financial-source parity, damaged-data inventory boundaries, deployed UI validation, target damaged-data dry-run, direct snapshot PDF deployed validation, deployed GA4 daily scheduler timing, immediate alert email delivery, and scheduled report/provider validation are complete for the current evidence set.

Resolved blocker:

- Before Commit 1, `server/ga4-kpi-benchmark-jobs.ts` used `computeRoasPercent` for GA4 KPI ROAS.
- GA4 docs and the visible GA4 page use ROAS as `Revenue / Spend` ratio.
- Before Commit 1, persisted KPI `currentValue` for ROAS could be 100 times the intended ratio.

Former impact:

- KPI card display could look correct because the UI recomputed live values.
- persisted KPI rows could be wrong.
- KPI progress history could be wrong.
- KPI alert comparisons could be wrong.
- notification visibility could be wrong.
- immediate and scheduled KPI alert email eligibility could be wrong.

Additional resolved issue:

- Before Commit 2, KPI CPA data sufficiency required conversions but did not require spend.
- Benchmark CPA already requires both conversions and spend.
- Before Commit 2, KPI CPA could be scored as sufficient with conversions present and zero spend, which could produce a misleading `0` CPA.

### 3. KPI Tracker And Threshold Status

Status: Proven for the current GA4 code scope. Shared threshold and sufficiency math is locally covered, and downstream persisted KPI consumers are covered by the current end-to-end matrices and deployed validation evidence.

Proven locally:

- shared KPI math supports metric-aware thresholds.
- lower-is-better KPI direction is handled for cost-style KPIs.
- blocked and insufficient KPIs are intended to be excluded from tracker counts and average progress.
- focused KPI math tests currently pass.

Resolved validation:

- tracker correctness was validated after the persisted ROAS fix and ROAS cleanup.
- CPA zero-spend insufficiency was fixed and covered by focused KPI math tests.

### 4. KPI Alerts And Notifications

Status: Production-ready for the current GA4 code scope. In-app alert URL, visibility mechanics, duplicate latest-row guard, local email audit/retry paths, deployed bell/Notifications behavior, immediate alert email receipt, and provider send acceptance are covered by the current evidence set.

Proven locally:

- GA4 KPI alert action URLs deep-link to `/campaigns/:campaignId/ga4-metrics?tab=kpis&highlight=:kpiId`.
- GA4 KPI alert creation maintains a single active in-app alert row while a breach remains active.
- enabled GA4 KPI alerts do not appear in the bell icon or main Notifications page unless the alert condition is currently breached.
- notification listing rechecks whether the KPI row still exists, belongs to the notification campaign, and remains breached.
- delete paths soft-hide related KPI notifications.
- immediate and scheduled email alert paths distinguish send attempts with audit rows.
- local alert email scheduler, audit, retry, and idempotency tests pass in the targeted suite.

Historical resolved blocker:

- platform GA4 KPI alert checks use persisted `currentValue`; persisted ROAS now uses the same ratio semantics as the visible GA4 KPI cards.

Current certification evidence:

- target persisted `currentValue` cleanup candidates were inventoried by the Current Commit 6 damaged-data script on June 29, 2026; the dry-run found 0 candidates and 9 skipped rows, so no apply run is indicated from that output.
- deployed email provider configuration was validated by successful immediate alert email receipt and scheduled report email receipt.
- Render logs showed the scheduled report runner and Mailgun HTTP API acceptance, and the user confirmed the scheduled report email arrived with current KPI values.

### 5. Refresh, Scheduler, And Recompute

Status: Production-ready for the current GA4 code scope. Daily, on-demand, auto-refresh, KPI create/update recompute, persisted financial source-window recompute, source mutation route recompute, custom/unsupported preservation, duplicate-alert handling, report guards, notification financial-source parity, damaged-data inventory, deployed GA4 daily scheduler timing, and scheduled GA4 report execution are covered by the current evidence set.

Proven locally:

- GA4 daily refresh calls the GA4 KPI/Benchmark recompute job.
- on-demand GA4 refresh calls the GA4 KPI/Benchmark recompute job.
- auto-refresh paths call recompute when upstream sources change.
- KPI create and update call recompute before checking alerts for GA4 platform KPIs.

Historical resolved blockers:

- all recompute paths now persist ROAS as a ratio for GA4 KPI and Benchmark rows.
- after Set as Primary, the frontend selected property is aligned with the new primary property.
- `setPrimaryGA4Connection` requires the target connection to belong to the campaign before primary-state mutation.

### 6. Ownership And Scoping

Status: Production-ready for the current GA4 KPI code scope. Platform KPI CRUD ownership/scoping is locally traced; GA4 source lifecycle route ordering, scheduled/test/manual report consumers, deployed source mutation validation, and deployed provider/report evidence are covered for the KPI value paths in scope. Source modal/list UI outside direct KPI value propagation is not certified by this KPI-only file.

Proven locally:

- current GA4 platform KPI list requires campaign access before returning rows.
- current GA4 platform KPI create requires campaign access.
- current GA4 platform KPI update/delete use `ensureKpiAccess` and verify platform type.
- storage methods fetch platform KPIs by exact platform and campaign when campaignId is supplied.

Resolved scoping issue outside the KPI CRUD route itself:

- GA4 primary-property storage update is now campaign-scoped by target connection.
- server recompute and visible selected property are aligned after the Set as Primary action.

### 7. Existing Damaged Data

Status: Production-ready for the current GA4 code scope. The prior ROAS cleanup was applied for a narrower historical bug boundary. Current Commit 6 added a new read-only inventory and bounded cleanup script for the current blockers, and the target database dry-run completed with 0 candidates, 9 skipped rows, and 0 applied; no cleanup apply is indicated from that output.

Confirmed damage boundary:

- existing GA4 platform KPI rows with ROAS current values may have persisted percent values.
- existing auto-created KPI progress rows for GA4 ROAS may also contain percent values.

Implemented and applied cleanup boundary:

- `server/ga4-roas-persisted-cleanup.ts` is dry-run by default and was run with `--apply` only after the dry-run inventory matched the documented boundary.
- current GA4 platform ROAS KPI rows are selected only when `platformType = google_analytics` and `metric` or `name` is exactly `ROAS`; they are recomputed from the campaign's current primary GA4 property, latest persisted GA4 daily date, active GA4-context imported revenue, and active spend records.
- historical KPI progress rows are eligible only when `notes` exactly matches `auto:ga4_daily:YYYY-MM-DD` and the campaign has exactly one active GA4 property, because the old progress rows did not persist `propertyId`.
- eligible KPI progress rows are recomputed from persisted source inputs for that exact auto date, including rolling averages and trend direction.
- rows without a strict auto note, without persisted source inputs, or with ambiguous historical property scope are left unchanged and reported as skipped.

Completed cleanup principle:

- fix the forward path first.
- do not blindly divide all historical ROAS rows by 100.
- corrected only rows whose GA4 source boundary was proven, such as GA4 platform ROAS KPI rows and auto GA4 daily progress rows where the source data could be recomputed exactly.
- skipped rows were left untouched where exact source inputs could not be proven.

Current Commit 6 cleanup boundary:

- `server/ga4-kpi-damaged-data-cleanup.ts` defaults to dry-run and prints candidate count, skipped count, sample row IDs, source windows, and reason codes.
- `financial_source_window_drift` candidates are eligible for apply only when the current GA4 KPI row matches the old financial source-window formula exactly and differs from the new formula, with campaign, primary property, latest persisted GA4 date, source windows, and KPI identity proven.
- access-token GA4 campaigns are skipped for financial cleanup with `financial_live_ga4_totals_not_local` because the forward job may use live GA4 totals and the cleanup script must not fetch or mutate live-provider state.
- `custom_zero_overwrite` rows are inventoried only; rows are left unchanged with `custom_zero_previous_value_unproven` because the previous custom user-entered value is not recoverable from current persisted state.
- `duplicate_notification_state` candidates are active performance-alert notifications tied to superseded GA4 KPI duplicate rows; apply mode marks those notifications read/resolved with `resolvedReason = superseded` without deleting KPI or notification history.
- Email audit rows are inventoried but retained with `duplicate_email_audit_retained`; retry/send paths now suppress superseded GA4 KPI IDs, but historical audit evidence is not rewritten.
- Apply mode requires `--apply`; no local database apply has been run in this commit.

## Current Certification Gaps And Completed Local Fixes

The current local fix queue is implemented. The remaining items below are certification gaps, deployed/provider validation gates, or product-decision gaps, not newly identified broad refactor requests.

### CERT-EVIDENCE-1: Post-fix UI validation passed for the current queue

Evidence:

- Local source tests cover route/order/formula guards.
- User-confirmed deployed validation on June 29, 2026 covered existing KPI values, create/edit/delete KPI, GA4 revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available.
- The exact reported stale non-breached GA4 Revenue alert disappeared from Notifications/bell without creating a new alert.

### CERT-EVIDENCE-2: Target damaged-data inventory dry-run completed

Evidence:

- command: `npx tsx --env-file=.env server/ga4-kpi-damaged-data-cleanup.ts`
- mode: `dry-run`
- candidate count: `0`
- skipped count: `9`
- applied count: `0`
- sample row IDs: `none`
- source windows: `none`
- reason codes: `financial_live_ga4_totals_not_local`, `financial_no_primary_property`
- skipped rows were intentionally not mutated because live GA4 token totals are not locally safe to fetch/mutate or no active primary GA4 property proves the source boundary
- no `--apply` run is indicated from this output

### CERT-GAP-3: Direct GA4 snapshot PDF latest-value regeneration fixed and deployed-validated

Root cause:

- Current Commit 5 fail-closes scheduled send, test-send, manual snapshot creation, and KPI-section PDF row loading.
- The direct `/api/report-snapshots/:snapshotId/pdf` read/download path reused the shared server PDF builder, which reads current persisted KPI rows, but it did not run GA4 KPI/Benchmark recompute preflight first.
- That meant a regenerated direct snapshot PDF could read stale persisted KPI values if the latest GA4 KPI recompute had not already run.

Local fix:

- The direct snapshot PDF route now calls `preflightGA4ReportKPIConsumers(okReport, undefined, { suppressAlerts: true })` before `buildPdfAttachmentForReport`.
- Passing no historical date lets the GA4 preflight use the current completed GA4 reporting date rather than an old snapshot window.
- If the target GA4 campaign is skipped or recompute fails, the route returns 422 and does not generate the PDF.
- Alert/send side effects remain suppressed for this direct download path; the intentional side effect is refreshing persisted KPI/Benchmark values before the PDF builder reads them.

Deployed validation evidence:

- Commit `4d3a3838` was pushed, Render deployed it, and the user confirmed direct GA4 snapshot PDF validation passed on June 29, 2026.
- This historical evidence closed the direct snapshot PDF freshness gate for that deployed app; scheduled GA4 report execution and provider/email delivery were validated later and are recorded under `CERT-EVIDENCE-4`.

### CERT-EVIDENCE-4: Deployed scheduler/report/provider validation completed

Root cause of the prior gap:

- Local tests could not prove live GA4 provider responses, scheduled GA4 report execution, provider delivery events, or inbox receipt. These required deployed/runtime evidence rather than another local code change.

Validated paths:

- deployed GA4 daily scheduler timing: user-validated on Render with a controlled scheduled run and `trigger=scheduled`
- scheduled GA4 report execution: user confirmed Render logs included `[Report Scheduler]`
- provider/API acceptance: user confirmed Render logs included `Email accepted by Mailgun HTTP API`
- actual inbox receipt and content: user confirmed the scheduled report email arrived and the report output matched current GA4 KPI values
- immediate GA4 KPI alert email delivery: user confirmed receipt after commits `fef2534c`, `6063fca8`, and `39ca378d`

External caveats after certification:

- future live GA4 API/token-refresh outages
- future GA4 processing latency
- future Mailgun/provider outages or recipient spam filtering
- future provider/source-mix/code changes that have not gone through a new readiness pass

### Completed Local Fixes In The Current Queue

| Commit | Local result | Validation evidence |
| --- | --- | --- |
| Current Commit 0 | Retracted stale readiness claim and created the current fix queue | Documentation-only review |
| Current Commit 1 | Persisted financial source windows now align with visible GA4 KPI source-backed financial window | `server/ga4-kpi-financial-window-regression.test.ts` |
| Current Commit 2 | GA4 revenue/spend source mutation paths now trigger GA4 KPI recompute before alert checks where immediate correctness is promised | `server/ga4-source-lifecycle-recompute-regression.test.ts` |
| Current Commit 3 | Custom/unsupported GA4 KPI rows are preserved during recompute and do not receive guessed-zero progress points | `server/ga4-kpi-custom-preservation-regression.test.ts` |
| Current Commit 4 | Duplicate GA4 KPI alert/email eligibility uses latest row per campaign+metric/name | `server/ga4-kpi-duplicate-alert-regression.test.ts` |
| Current Commit 5 | Scheduled/test/manual GA4 report KPI consumers fail closed on recompute/PDF/KPI-load failures | `server/ga4-kpi-report-consumer-regression.test.ts` |
| Current Commit 6 | Existing damaged-data inventory and bounded cleanup script separates proven candidates from unproven skipped rows | `server/ga4-kpi-damaged-data-cleanup-regression.test.ts` |
| Current Commit 7 | Final documentation certification pass updates status, matrices, evidence, and stale functional-doc readiness claim | Documentation diff plus targeted regression suite and `npm run check` |
| Post-fix clarification | GA4 KPI tolerance UI copy hides derived absolute-count details and GA4 KPI alert visibility is breach-only in bell/Notifications | `server/ga4-kpi-benchmark-summary-regression.test.ts`, `server/kpi-math.test.ts`, `server/notification-visibility-regression.test.ts` |
| Post-Commit 7 deployed notification fix | GA4 Revenue/ROAS/ROI/CPA notification visibility now uses the same selected GA4 financial-source model as KPI cards and fails closed when the source cannot be verified | Commits `0f1be173` and `3ed67320`; `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts`; `npm run check`; `npm run build`; user-confirmed deployed UI validation |

## Post-Commit 7 Deployed Notification Financial-Source Fix

Root cause:

- The GA4 KPI card computed Revenue from the selected GA4 financial model: the most complete selected-campaign GA4 native revenue candidate plus active imported revenue.
- `/api/notifications` could still decide visibility from a narrower financial value path, so an existing Revenue alert could remain visible with `Current value: 9,224.77` even while the KPI card showed `$18,771.34` and no longer breached the `below 12,000` threshold.
- Earlier fixes addressed cache refresh, persisted-row enrichment, mock/to-date parity, and Revenue metric aliases, but the final missed boundary was financial-source candidate selection for notification visibility.

Smallest safe fix:

- Keep `/api/notifications`, ownership checks, duplicate suppression, alert threshold math, email behavior, scheduler behavior, storage contracts, and KPI calculations unchanged.
- For GA4 financial KPI alerts (`Revenue`, `Total Revenue`, `ROAS`, `ROI`, and `CPA`), resolve notification current values from the same selected financial-source model used by KPI cards.
- Hide the notification row when the recomputed current value no longer breaches the threshold.
- Fail closed for GA4 notification visibility when the source path cannot be verified, instead of showing a stale active alert.

Files changed:

- `server/routes-oauth.ts`
- `server/notification-visibility-regression.test.ts`

Validation evidence:

- `npm test -- server/notification-visibility-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/campaign-alert-current-value-regression.test.ts server/alert-evaluation.test.ts` passed: 4 files / 44 tests.
- `npm run check` passed.
- `npm run build` passed when Vite/esbuild was allowed to spawn normally.
- Deployed UI validation on June 29, 2026 was user-confirmed: the stale non-breached GA4 Revenue alert disappeared from Notifications/bell without creating a new alert.

Certification evidence:

- This fix completes the deployed UI alert/notification validation gate for the reported GA4 Revenue case.
- Scheduled GA4 report execution evidence and provider/inbox delivery evidence were validated later and are recorded in `CERT-EVIDENCE-4`.

## Historical Resolved Blockers

The historical blockers below were resolved by the June 27, 2026 Commits 1-6, deployed, UI-validated, and followed by the applied ROAS persisted cleanup. They remain useful background, but they do not certify the current GA4 KPI tab.

### KPI-1: GA4 persisted ROAS used percent instead of ratio

Root cause:

- `server/ga4-kpi-benchmark-jobs.ts` computed ROAS with `computeRoasPercent`.

Expected:

- GA4 KPI ROAS current value must be `Revenue / Spend`, rounded for display and storage as a ratio.

Former impact:

- persisted current value
- KPI progress history
- alert decisions
- notification visibility
- immediate email eligibility
- scheduled email eligibility

Resolved by:

- Commit 1 fixed the forward persisted ROAS calculation.
- Commit 6 applied the bounded cleanup to existing safely identifiable GA4 ROAS rows.

### KPI-2: KPI CPA sufficiency omitted spend

Root cause:

- `resolveKpiDataSufficiency` checked CPA conversions but did not check CPA spend.

Expected:

- CPA KPIs need both conversions and spend before scoring.

Former impact:

- zero-spend CPA KPIs could be scored instead of marked insufficient.

Resolved by:

- Commit 2 fixed KPI CPA spend sufficiency.

### KPI-3: GA4 primary-property storage update was not campaign-scoped by target connection

Root cause:

- `setPrimaryGA4Connection(campaignId, connectionId)` cleared primary connections by campaign but updated the target connection by ID only.

Expected:

- the target connection must belong to the campaign before any primary-state mutation.

Former impact:

- server recompute could use the wrong primary property.
- one campaign could accidentally or maliciously affect another campaign connection if a stale or foreign connection ID was supplied.

Resolved by:

- Commit 3 scoped Set as Primary by both campaign and connection.

### KPI-4: GA4 page could keep old selected property after Set as Primary

Root cause:

- the page only fell back to primary when the current selected property no longer existed.
- setting another existing property as primary did not update `selectedGA4PropertyId`.

Expected:

- after successful Set as Primary, the visible selected property and server primary property should align.

Former impact:

- visible KPI values and persisted recompute/alert values could temporarily reference different properties.

Resolved by:

- Commit 4 aligned selected property state after Set as Primary.

### KPI-5: ROAS default copy said percent

Root cause:

- KPI default description text said `Revenue generated per dollar of spend (as a %)`.

Expected:

- ROAS copy must describe an `x` ratio.

Former impact:

- user-created KPI descriptions could persist misleading unit semantics.

Resolved by:

- Commit 5 fixed GA4 ROAS default copy.

### KPI-6: Existing persisted ROAS data needed bounded cleanup

Root cause:

- old recompute runs may have written percent ROAS values.

Expected:

- forward path fixed first, then exact-source cleanup or explicit legacy-data caveat.

Former impact:

- before cleanup, old rows could continue to mislead history/trends until cleaned or marked.

Resolved by:

- Commit 6 added the bounded cleanup script and the script was applied after matching dry-run evidence.

## Historical June 2026 Completed Fix Queue

This queue is historical and completed for the earlier defect set. The only current queue is Current Commits 0-10 in the controlling August 1 section. Do not implement these historical items again or use their completion as current certification evidence.

### Current Commit 0 - Documentation clarification only

Files:

- `GA4/KPIS_PRODUCTION_READINESS.md`

Required behavior:

- retract the June 27 production-ready claim
- state the pre-fix status as `not production-ready`
- document current blockers, downstream consumers, validation gaps, and the exact fix queue
- do not change runtime behavior

Validation:

- `git diff -- GA4/KPIS_PRODUCTION_READINESS.md`
- confirm no runtime files changed in this commit

### Current Commit 1 - Align persisted GA4 KPI financial source windows

Implementation status:

- forward-path fix implemented and validated for persisted GA4 KPI financial source windows
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- focused GA4 KPI recompute regression test

Required behavior:

- keep GA4 native daily/to-date logic on the intended completed GA4 reporting date
- make imported GA4-context revenue and active spend source totals match the visible KPI tab's source-backed financial window
- preserve ROAS as ratio, ROI as percent, and CPA as spend divided by conversions
- do not broaden source scope beyond the selected campaign and active GA4-context sources

Validation:

- current-day spend record changes persisted ROAS, ROI, and CPA
- current-day GA4-context revenue record changes persisted Revenue, ROAS, and ROI
- zero-spend and zero-revenue dependency behavior remains blocked or insufficient as documented
- scheduled alert checks read the corrected persisted values

### Current Commit 2 - Make GA4 source lifecycle recompute complete

Implementation status:

- forward-path route fix implemented and validated for GA4 source add/edit/delete recompute ordering
- validation passed: `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts`
- validation passed: `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts server/ga4-kpi-financial-window-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts`
- validation passed: `npm run check`
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

Files expected:

- `server/routes-oauth.ts`
- focused source lifecycle regression test

Required behavior:

- after GA4 revenue source add/edit/delete paths that affect KPI inputs, run GA4 KPI/Benchmark recompute before alert checks when the route promises immediate correctness
- after GA4 spend source add/edit/delete paths that affect KPI inputs, run GA4 KPI/Benchmark recompute before alert checks or document the route as async-only with no immediate correctness promise
- preserve existing LinkedIn, Meta, Google Ads, Google Sheets, and Custom Integration source behavior unless the exact shared helper requires a narrow branch

Validation:

- route/source tests prove the recompute order: source mutation -> source total recalc -> GA4 KPI recompute -> alert check -> response
- delete/deactivate paths cannot update unrelated campaigns or unrelated platform rows
- notification queries still refresh from the frontend after KPI-affecting source changes

### Current Commit 3 - Preserve custom and unsupported GA4 KPI rows during recompute

Implementation status:

- forward-path recompute preservation implemented and validated for custom/unsupported GA4 KPI rows
- validation passed: `npm test -- server/ga4-kpi-custom-preservation-regression.test.ts`
- this fix alone did not certify GA4 KPIs as production-ready; Current Commit 7 records the final certification result

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- focused custom KPI regression test
- documentation update if custom KPI alert semantics are clarified

Required behavior:

- standard GA4 KPI templates continue to recompute
- unsupported/custom GA4 KPI rows are not overwritten to `0`
- unsupported/custom rows do not receive misleading auto progress points from guessed zero values
- stored custom current values remain available for visible cards, alerts, and reports only under explicitly documented semantics

Validation:

- custom GA4 KPI current value survives daily scheduler recompute
- custom GA4 KPI current value survives KPI create/update-triggered recompute
- report preflight recompute does not zero a custom KPI row

### Current Commit 4 - Enforce duplicate GA4 KPI latest-row-wins alert behavior

Files changed:

- `server/kpi-scheduler.ts`
- `server/services/alert-monitoring.ts`
- `server/utils/ga4-kpi-alert-dedupe.ts`
- `server/ga4-kpi-duplicate-alert-regression.test.ts`
- `GA4/KPIS_PRODUCTION_READINESS.md`

Required behavior:

- for active GA4 KPI rows with the same campaign and metric/name key, only the latest row is eligible to create or preserve an active performance alert
- older duplicate rows cannot create competing active alerts
- existing older duplicate alerts are resolved or suppressed without hard-deleting KPI or notification history

Implementation status:

- Implemented in Current Commit 4 as a forward-path fix.
- In-app alert checks resolve older duplicate GA4 KPI rows as `superseded` before `createKPIAlert` can run.
- Immediate email, retry, and scheduled email paths suppress older duplicate GA4 KPI rows before alert-send claims or sends.
- Notification creation/list dedupe remains scoped to `kpiId`; older duplicates are prevented upstream instead of changing notification response shape.

Validation:

- `npm test -- server/ga4-kpi-duplicate-alert-regression.test.ts` passed locally.
- The regression covers two active same-campaign same-metric GA4 KPI rows, latest-row eligibility, same-campaign fallback after the latest row is absent, campaign isolation, scheduler suppression ordering, email suppression ordering, and unchanged notification dedupe anchors.

### Current Commit 5 - Cover scheduled/server report KPI consumers

Files expected:

- `server/ga4-scheduled-report-pdf.ts` if behavior needs adjustment
- `server/report-scheduler.ts` if preflight recompute needs adjustment
- focused scheduled report regression test

Required behavior:

- scheduled/server GA4 reports use corrected persisted KPI values after recompute
- report preflight recompute does not write misleading values for unsupported/custom rows
- failed recompute does not create a report artifact that implies unverified KPI values are fresh
- manual GA4 report snapshots are not inserted unless GA4 preflight recompute and PDF generation succeed
- GA4 KPI-section PDF generation fails closed when persisted KPI rows cannot be read

Validation:

- scheduled GA4 KPI report includes corrected persisted ROAS, ROI, CPA, and Revenue after current-day source inputs
- custom KPI rows are preserved or explicitly marked according to documented semantics
- report snapshot/audit state is consistent with send success/failure behavior already required by report safety rules
- source regression coverage must prove scheduled send, test-send, manual snapshot, and KPI-section PDF builder fail-closed guards before this commit can be treated as locally covered

### Current Commit 6 - Existing damaged-data inventory and bounded cleanup plan

Files expected:

- `server/ga4-kpi-damaged-data-cleanup.ts`
- `server/ga4-kpi-damaged-data-cleanup-regression.test.ts`
- this readiness file

Required behavior:

- run a read-only inventory before any mutation
- identify rows affected by financial source-window drift, custom zero overwrite, and duplicate alert state separately
- mutate only rows whose exact source data, date window, campaign, property, and KPI identity are proven
- leave unprovable rows unchanged with explicit skip reasons

Validation:

- dry-run output includes candidate count, skipped count, sample row IDs, source windows, and reason codes
- apply mode requires explicit flag
- post-apply dry-run reports no remaining candidates for the proven boundary

Implementation status:

- Added `server/ga4-kpi-damaged-data-cleanup.ts` as the current damaged-data inventory and bounded cleanup script.
- Dry-run is the default mode. `--apply` is required before any mutation.
- Proven apply boundaries are limited to `financial_source_window_drift` KPI current rows that match the old formula exactly and `duplicate_notification_state` active in-app notifications tied to superseded GA4 KPI duplicate rows.
- Unproven custom zero rows, access-token live GA4 financial rows, malformed/ambiguous financial rows, and duplicate email audit rows are left unchanged with explicit skip reason codes.
- Local validation covers the cleanup boundaries and output contract; no deployed database inventory or apply has been run.

### Current Commit 7 - Final certification documentation update

Files expected:

- `GA4/KPIS_PRODUCTION_READINESS.md`
- any narrow GA4 docs whose behavior changed, such as `GA4/KPIS.md` or `GA4/REFRESH_AND_PROCESSING.md`

Required behavior:

- update this file only after Commits 1-6 are implemented and validated
- treat Commits 1-6 as making GA4 KPIs eligible for certification, not automatically production-ready
- rerun the full root `PRODUCTION_READINESS.md` checklist against the implemented code before changing status
- include the complete value inventory and downstream propagation matrix from current evidence
- include the source lifecycle matrix, negative-case matrix, scheduled/server report consumer check, alert/notification propagation check, and test coverage matrix from current evidence
- separate proven paths, external caveats, and any future deployed/provider validation that is outside the current evidence set
- do not restore a production-ready claim unless every required path in `PRODUCTION_READINESS.md` is covered or explicitly classified

Validation:

- all targeted regression tests from Commits 1-6 pass
- `npm run check` passes
- production-readiness answer cites current evidence and does not rely on the June 27 historical claim

Implementation status:

- Current Commit 7 updates this file with the final certification result from current evidence.
- Current Commit 7 updates `GA4/KPIS.md` to remove the stale June 27 production-ready statement.
- The certification result is production-ready for the current GA4 code scope because the local fix queue, deployed UI validation, target damaged-data dry-run, direct snapshot PDF preflight validation, GA4 daily scheduler timing validation, immediate alert email delivery, and scheduled GA4 report/provider validation are complete for the current evidence set.
- The complete value inventory, end-to-end trace matrix, downstream propagation matrix, source lifecycle matrix, negative-case matrix, test coverage matrix, and documentation alignment check are recorded in `Current Commit 7 Certification Pass`.

## Historical Completed Fix Queue

The historical queue below is complete for the narrower June 27 ROAS/CPA/property-scope bug set. It is not the current fix queue and must not be used as evidence that GA4 KPIs are production-ready.

### Commit 1 - Fix GA4 ROAS persisted current values

Files:

- `server/ga4-kpi-benchmark-jobs.ts`
- `server/ga4-cross-tab-consistency.test.ts`
- a focused GA4 KPI/Benchmark recompute or alert regression test

Required behavior:

- GA4 KPI and Benchmark ROAS current values persist as `Revenue / Spend`.
- ROI remains percent.
- CPA remains `Spend / Conversions`.
- shared `computeRoasPercent` can remain unchanged for callers that explicitly need percent semantics.

Validation:

- direct unit/regression test for `computeKpiValue("ROAS", { revenue: 1000, spend: 100 }) === 10`
- alert regression proving a below-threshold ROAS KPI with current `2.5` and threshold `3.0` breaches
- targeted KPI/Benchmark test suite

### Commit 2 - Fix KPI CPA data sufficiency

Files:

- `shared/kpi-math.ts`
- `server/kpi-math.test.ts`

Required behavior:

- CPA KPI with conversions present but spend below minimum is `insufficient_spend`.
- CPA KPI with conversions and spend present remains scorable.
- Benchmark CPA behavior remains unchanged.

Validation:

- focused KPI math tests
- GA4 KPI card/tracker validation for CPA with zero spend

### Commit 3 - Scope GA4 Set as Primary by campaign

Files:

- `server/storage.ts`
- route/storage regression test

Required behavior:

- target connection must be found with both `campaignId` and `connectionId` before clearing primary flags.
- update statement must require both `id` and `campaignId`.
- if the target connection does not belong to the campaign, return false and do not clear current campaign primary state.

Validation:

- regression test for foreign connection ID
- manual route validation where setting a valid property still succeeds

### Commit 4 - Keep selected property aligned after Set as Primary

Files:

- `client/src/pages/ga4-metrics.tsx`
- focused UI/source-state regression if available

Required behavior:

- successful Set as Primary updates `selectedGA4PropertyId` to the selected connection's property ID.
- GA4 daily, to-date, diagnostics, and breakdown queries refetch for that property.

Validation:

- browser validation with two GA4 properties connected to one campaign
- confirm KPI visible values and primary-property label reference the same property after the action

### Commit 5 - Fix KPI ROAS copy

Files:

- `client/src/pages/ga4-metrics.tsx`
- optional text regression

Required behavior:

- default ROAS descriptions say ratio or `x`, not percent.

Validation:

- create KPI modal text check
- saved blank-description ROAS KPI does not persist percent wording

### Commit 6 - Existing GA4 ROAS data cleanup plan

Files:

- `server/ga4-roas-persisted-cleanup.ts`
- `server/ga4-kpi-benchmark-roas-regression.test.ts`
- documentation update in this file

Required behavior:

- recompute current ROAS values for exact GA4 platform KPI rows after Commit 1, using persisted GA4 daily facts, active GA4-context imported revenue, and active spend records.
- correct auto GA4 daily ROAS KPI progress rows only where the row has a strict `auto:ga4_daily:YYYY-MM-DD` note and the campaign has exactly one active GA4 property.
- recompute corrected KPI progress row rolling averages and trend direction from the repaired persisted series.
- leave unprovable legacy rows unchanged with a documented skip reason.
- default to dry-run inventory; mutate only when run with `--apply`.

Validation:

- `npm test -- server/ga4-kpi-benchmark-roas-regression.test.ts`
- `npm run check`
- dry-run inventory command against the target database: `tsx server/ga4-roas-persisted-cleanup.ts`
- apply command only after inventory review: `tsx server/ga4-roas-persisted-cleanup.ts --apply`
- before/after row counts, sample affected rows, and skipped-row reasons from the script output

### Historical Commit 7 - June 27 readiness documentation flip (superseded)

Files:

- `GA4/KPIS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`

Completed behavior:

- historically updated the durable answer after Commits 1-6 were completed, deployed, UI-validated, and the ROAS persisted cleanup was applied.
- included exact validation commands, cleanup row counts, skipped-row reasons, and remaining external/deployed caveats for that narrower historical bug set. This is superseded by the June 28 current status and fix queue above.

## Validation Evidence And Gaps

Current local and deployed validation status after Current Commits 1-7 plus the follow-up GA4 notification financial-source fix:

- Current Commit 1 forward-path code and focused tests have been implemented for persisted GA4 KPI financial source windows.
- Current Commit 2 source lifecycle route-order coverage has been implemented for GA4 revenue/spend mutation paths that affect KPI inputs.
- Current Commit 3 custom/unsupported KPI preservation has been implemented for the shared GA4 recompute job.
- Current Commit 4 duplicate active GA4 KPI latest-row alert/email eligibility has been implemented for scheduler, immediate email, retry, and scheduled email paths.
- Current Commit 5 scheduled/test/manual GA4 report KPI consumer fail-closed guards have been implemented.
- Current Commit 6 existing damaged-data inventory and bounded cleanup script has been implemented.
- Current Commit 7 documentation now reflects the current certification result and no longer relies on the June 27 historical claim.
- Follow-up commits `0f1be173` and `3ed67320` fixed the GA4 Revenue notification visibility path so non-breached financial alerts are hidden when the KPI card no longer breaches.
- User-confirmed deployed UI validation passed on June 29, 2026 for opening the GA4 KPIs tab, existing KPI values, create/edit/delete KPI, revenue/spend source mutation with KPI value and alert refresh, Notifications/bell state, and GA4 KPI report send/manual snapshot where available.
- Target database damaged-data dry-run passed on June 29, 2026 with 0 candidates, 9 skipped rows, 0 applied, no sample row IDs, no source windows, and reason codes `financial_live_ga4_totals_not_local` and `financial_no_primary_property`; no `--apply` run is indicated from this output.

Current local automated validation run during Current Commit 7:

- `npm test -- server/ga4-kpi-financial-window-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/ga4-kpi-custom-preservation-regression.test.ts server/ga4-kpi-duplicate-alert-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-kpi-damaged-data-cleanup-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-regression.test.ts server/ga4-financial-rules.test.ts`
- Result: 10 test files passed, 50 tests passed.
- `npm run check`
- Result: TypeScript check passed.

Current covered paths after Commits 1-7 and the notification financial-source fix:

- current-day imported revenue/spend records in persisted GA4 KPI recompute are covered by `server/ga4-kpi-financial-window-regression.test.ts`.
- GA4 source lifecycle route recompute ordering and platform-context propagation are covered by `server/ga4-source-lifecycle-recompute-regression.test.ts`.
- custom/unsupported GA4 KPI row recompute preservation is covered by `server/ga4-kpi-custom-preservation-regression.test.ts`.
- duplicate GA4 KPI latest-row-wins alert eligibility is covered by `server/ga4-kpi-duplicate-alert-regression.test.ts`.
- scheduled/test/manual GA4 report KPI consumer fail-closed guards are covered by `server/ga4-kpi-report-consumer-regression.test.ts`.
- damaged-data inventory, explicit `--apply`, proven candidate boundaries, and skip reason behavior are covered by `server/ga4-kpi-damaged-data-cleanup-regression.test.ts`.
- `/api/notifications` financial KPI visibility for Revenue/ROAS/ROI/CPA is covered by `server/notification-visibility-regression.test.ts` and user-confirmed deployed validation for the stale non-breached Revenue alert case.

External caveats after certification:

- future live GA4 provider outages, token-refresh edge cases, and GA4 processing latency remain outside local proof.
- future Mailgun/provider outages, recipient spam filtering, and provider event-webhook telemetry beyond the user-confirmed receipt remain outside local proof.
- GA4 Insights or other related non-report consumers that may read KPI context were not reopened in this KPI-only fix queue and must not be treated as proven.

Historical validation run during the June 27, 2026 audit:

`npm test -- server/kpi-math.test.ts server/benchmark-math.test.ts server/revenue-additivity.test.ts server/ga4-cross-tab-consistency.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-retry-regression.test.ts server/alert-email-idempotency-regression.test.ts`

Result:

- 13 test files passed.
- 238 tests passed.

Historical limitation from the initial audit:

- this green suite did not prove production readiness at that time because `server/ga4-cross-tab-consistency.test.ts` encoded old percent ROAS expectations before the later fix.
- the historical June 27 status relied on later fix validation, deployment, UI validation, and applied cleanup evidence, but the June 28 audit found additional unproven paths that have since been fixed, validated, and documented in the current certification evidence.

Commit 1-6 deployment and UI validation on June 27, 2026:

- Historical Commits 1-6 were implemented, committed, pushed, and deployed for the narrower June 27 bug set.
- Historical UI validation passed after deployment for the narrower GA4 KPI and Benchmark readiness fix queue.
- This is not evidence for the June 28 Current Commits 1-7 queue.

Out-of-scope note:

- broader report infrastructure remains outside this KPI-only certification except where reports directly consume GA4 KPI values.
- scheduled/test/manual/direct GA4 report KPI consumers are locally covered; scheduled GA4 report execution and provider evidence were user-validated on Render for the current GA4 KPI code scope.

## Not Locally Verifiable

The following remain external caveats after current certification:

- future live GA4 API token refresh failures or provider outages
- future live GA4 processing latency
- future Mailgun/provider outages, provider event telemetry gaps, or recipient spam filtering
- future source mixes, platform extensions, or code changes that have not gone through a new readiness pass

These external, manual, or deployed-runtime caveats do not block the certification at runtime boundary `19f055372abe8aee789dd4205eba5decef5f39a5`; authenticated KPI UI and browser-PDF parity passed within the bounded environment documented above. The Campaign DeepDive-only Budget PDF presentation change does not broaden historical timer, provider-acceptance, or inbox-receipt evidence.

## Future Platform Template

Before copying GA4 KPIs to Meta, Google Ads, LinkedIn, Google Sheets, or a custom integration, prove each item below for the new platform:

- source connection and account/property/campaign scoping are explicit
- current-value UI path and persisted recompute path use the same metric units
- ROAS, ROI, CPA, rates, counts, and currency values have documented unit semantics
- lower-is-better metrics are identified in shared math, not UI-only logic
- missing dependencies block scoring instead of writing misleading zero values
- scheduler/reprocess path updates persisted current values before alert checks
- alerts read the same values that cards/report outputs explain
- notification action URLs open the correct campaign, platform tab, and highlighted item
- create/update/delete routes prove campaign ownership before mutation
- delete routes soft-hide related notifications without hard-deleting unrelated history
- existing damaged data has a bounded cleanup plan
- local tests cover the platform's own source model rather than copying GA4 fixtures blindly

Do not certify another platform source as KPI production-ready just because GA4 KPIs are eventually certified. Each platform needs its own source, scope, recompute, alert, notification, and cleanup proof.
