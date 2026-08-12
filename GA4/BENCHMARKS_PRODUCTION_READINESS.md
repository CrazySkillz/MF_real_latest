# GA4 Benchmarks Production Readiness

## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply `AGENTS.md` and `PRODUCTION_READINESS.md`. Do not repeat any production-ready or status claim from this file unless the current request's complete Benchmark value inventory, post-fetch transforms, fallback branches, negative cases, lifecycle paths, downstream propagation matrix, and test evidence are covered by current documented evidence.

A previous production-ready statement is not evidence. A passing test suite is not enough unless it covers the traced Benchmark paths. KPI readiness evidence is not Benchmark readiness evidence unless the test or trace explicitly covers the Benchmark path being claimed. If any Benchmark path is incomplete, classify it as partially reviewed, not locally verifiable, or deferred, and update the Current Commit queue instead of calling that path production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Benchmarks` tab.

Use this file when asked whether GA4 Benchmarks are robust, accurate, logical, production-ready, or reusable as a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source.

`GA4/BENCHMARKS.md` defines the intended Benchmark tab behavior. This file defines the current certification status, proven paths, unproven paths, external caveats, and the exact Current Commit queue required before any future claim can be repeated.

## Current Status

August 12, 2026 local candidate status: `UNVERIFIED` at `c7e708e27d73416a96cf9a79d0f875f60b725d6b`. The candidate changes the recorded Benchmark dependency boundary. Prior Beta Ready and deployed evidence below remains preserved for its exact earlier revision, but it does not certify this candidate; exact-SHA deployment and production validation remain pending.

August 3, 2026 controlling assessment: GA4 Benchmarks are **Beta Ready** for a closed beta at deployed implementation commit `b42c51e9ebcc12d74851cc640c86038513a57828`, reviewed from base commit `466dc2494b16b38a116b49a786039da251520520`. Production certification remains `UNVERIFIED` only until Benchmark Current Commit 14 captures one successful natural timer-fired GA4 daily run on the unchanged reviewed boundary.

<!-- ga4-benchmark-production-certification-status: UNVERIFIED -->
<!-- ga4-benchmark-beta-readiness-status: BETA_READY -->

This assessment is revision-specific. The Benchmark certification boundary covers Benchmark cards, Tracker, in-app alerts/notifications, Benchmark alert attempt/audit safety, CRUD, refresh/recompute, deterministic and natural GA4 daily execution, persistence, destructive rollback, authentication, campaign/property/owner/timezone/window scope, and multi-tenant isolation. Read-only propagation evidence into Insights and Reports is supporting cross-consumer evidence only; full Insights/Reports behavior, report generation, scheduling, delivery, attachments, and inbox receipt belong to their separate section audits and do not gate Benchmark certification. Any Benchmark dependency-boundary change invalidates the assessment.

Current dependency queue:

1. **Benchmark Current Commit 8 — documentation invalidation:** complete.
2. **Benchmark Current Commit 9 — certification integrity and real-path parity:** complete in `5b5df12f5e5a40202ff8ba17e697ed88979de62f` and `14bb0d2892ca06e42ae019f7244280b6ff70bcb7`.
3. **Benchmark Current Commit 10 — shared value-contract and lifecycle repair:** complete locally in `14bb0d2892ca06e42ae019f7244280b6ff70bcb7`.
4. **Benchmark Current Commit 11 — lock the exact production certification revision:** complete. Runtime SHA `5366d0babc9550ecd408e55bc385e7024854f424`; deployed evidence SHA `fbc10e04f69f1d2709d3e2629f8c4818a7062c90`; intervening changes are validation/documentation/test-only.
5. **Benchmark Current Commit 12 — run the final clean-revision local gate:** complete at clean validation SHA `473c4e151b43aac33cb1d35a5c4b0fa85a85c36b`.
6. **Benchmark Current Commit 13 — prove exact deployed Benchmark value and bounded downstream propagation parity:** complete at deployed runtime SHA `9ed32290b32773af543b7a927ef5e197c4e3b761`.
7. **Benchmark Current Commit 14 — capture a successful natural daily scheduler run:** waiting for the next unchanged-revision natural run.
8. **Former Benchmark Current Commit 15 — scheduled report delivery:** removed from the Benchmark certification gate. Its completed runtime/provider/snapshot evidence is retained below as bounded Reports/shared-infrastructure history for the later Reports audit.

### August 2-3, 2026 Closed-Beta Validation Evidence

- Critical findings: 0.
- Benchmark-scope findings: Critical `0`; no Critical or Major finding remains.
- The broader validation also found and fixed Reports/shared-infrastructure defects. Those findings and their evidence remain recorded, but they do not certify Reports and do not gate the Benchmark section.
- Applicable/affected regressions: the final Current Commit 15 inventory passed `54` files and `615` tests.
- Focused destructive/route/notification packet: `4` files and `55` tests passed.
- TypeScript: `npm run check` passed.
- Production build: `npm run build` passed; the restricted sandbox first blocked esbuild process spawning with `EPERM`, and the authorized identical command then passed.
- Deterministic scheduler evidence: real-path daily job, daily scheduler, auto-refresh, source-lifecycle recompute, scheduler observability, report-preflight, scheduled Insights, and scheduled Benchmark report tests passed without waiting for a natural timer.
- Read-only deployed smoke: `GET /health` returned `200 ok`; `GET /health/scheduler` returned `200`, with the GA4 daily scheduler started, timer scheduled, idle, and next run `2026-08-03T03:00:00.000Z`. The same response reported a separate Mailgun daily-limit failure in report email delivery; that external failure is not counted as Benchmark-path evidence.
- Earlier unrelated/deferred failure: the shared `source-safety-regression.test.ts` spend-source deletion assertion failed because it expected the superseded split-delete implementation. Current Commit 12 corrected that guard to assert the existing campaign/source/platform-scoped transactional helper; no runtime behavior changed.
- Scheduler guard/fix packet: `npm test -- --run server/ga4-daily-scheduler-regression.test.ts server/ga4-scheduler-observability-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts server/ga4-kpi-real-path-parity-regression.test.ts` passed `4` files and `31` tests. Expected skipped/unavailable rows are observable and nonfatal; actual failures and a targeted zero-processed campaign remain fatal; Benchmark updated/skipped/failed evidence is exposed.
- Provider-window guard/fix packet: `npm test -- --run server/ga4-benchmark-provider-validation-regression.test.ts server/ga4-financial-source-parity.test.ts server/ga4-kpi-financial-window-regression.test.ts server/ga4-kpi-real-path-parity-regression.test.ts` passed `4` files and `32` tests. `npm run check` and `npm run build` passed after the runtime fixes.
- Natural scheduler evidence on the predecessor revision was captured at `2026-08-03T03:00:00.001Z`: the timer fired naturally and exposed the false-fatal skip aggregation. The smallest fix was guarded in `8a0da039`, implemented in `eb442cd1`, and deployed. A corrected-revision natural timer result was intentionally not awaited.
- Exact deployed revision evidence: production `GET /api/health` returned `5366d0babc9550ecd408e55bc385e7024854f424`. `npx tsx --env-file=.env scripts/ga4-benchmark-beta-clearance-readonly.ts` passed with `success = true`, `2` campaign inventories, `4` active Benchmarks, zero failures, and zero attempted application mutations. The configured campaign had exact live-provider/persisted/scheduler/UI parity for Conversions (`95`) and Revenue (`51405.93`), authenticated list parity, campaign/property/filter/owner/timezone evidence, and deployed card/Tracker render parity. The campaign with no active property correctly rendered the connect state and was classified not applicable for live consumer parity.
- The same read-only pack proved every Benchmark email-audit endpoint was access-guarded and readable, but found no fresh delivered event. External Benchmark email delivery is therefore excluded from this initial beta and is not claimed.
- Current Commit 12 clean-revision gate: on exact clean SHA `473c4e151b43aac33cb1d35a5c4b0fa85a85c36b`, the generated applicable inventory passed `52` files and `499` tests; `server/ga4-ui-regression.test.ts` passed `36` tests; and the applicable spend-source destructive-safety test passed (`1` passed, `86` skipped by the filter). The full affected shared `source-safety-regression.test.ts` run was also executed: `80` passed and exactly `7` Instagram-only guards failed. Those seven failures do not exercise GA4 Benchmarks or a documented Benchmark consumer, are not counted as passing evidence, and were not changed. `npm run check` and `npm run build` passed. The clean descendant comparison found no production runtime source or deployment/build configuration change since reviewed implementation SHA `5366d0babc9550ecd408e55bc385e7024854f424`.
- Current Commit 13 completed deployed parity at exact runtime SHA `9ed32290b32773af543b7a927ef5e197c4e3b761`. The final authenticated read-only rerun returned `success = true` for `2` campaigns, `4` active Benchmarks, zero failures, and zero application mutation attempts. Conversions `95` and Revenue `51405.93` remained exact across live provider, persisted rows, scheduler/UI candidates, cards, Tracker, Insights, browser PDF, and alerts/notifications.
- The controlled manual Benchmark and Insights snapshots each persisted both preflighted rows with exact current value, target, and threshold state. Their parsed PDFs passed exactly: Benchmark PDF `7968` bytes; Insights PDF `31303` bytes. The original report configuration hash `fd95883d1e7f` was restored exactly after both runs.
- The controlled scheduled Benchmark and Insights sends both reached `pending_delivery` after Mailgun API acceptance. Delivery was not confirmed, `sentAt` and `snapshotId` remained null, and no false sent/downloadable snapshot was created. The original report schedule (`09:00 Europe/Amsterdam`, one original recipient) and configuration hash were restored. This proves correct fail-closed scheduled-consumer behavior but does not prove delivery.
- The post-fix applicable inventory passed `54` files and `624` tests, including the `15`-test certification guard; `npm run check` and `npm run build` passed. The initial npm/PowerShell array invocation executed no tests and is not counted; the direct Vitest invocation is the recorded passing evidence.
- The final focused certification-guard rerun initially failed only because its expected implementation SHA still named the pre-fix revision. The one-line fixture was corrected to `9ed32290b32773af543b7a927ef5e197c4e3b761`; the rerun passed all `15` tests. A final read-only health check at `2026-08-03T08:15:12Z` confirmed the same deployed SHA. Scheduler health remained `200`, started, timer-scheduled, and idle with zero corrected-revision runs and next run `2026-08-04T03:00:00.000Z`.
- Separate Reports/shared-infrastructure inspection found that the stored Mailgun confirmation response was `domain not found` and audit metadata had lost the successful send region. Runtime commit `b42c51e9ebcc12d74851cc640c86038513a57828` fixes that shared report path. This is retained evidence for the later Reports audit, not a Benchmark certification requirement.
- Production `GET /api/health` confirmed exact deployed SHA `b42c51e9ebcc12d74851cc640c86038513a57828`. Two authorized controlled report events then reached `sent`. The Benchmark and Insights snapshots each contain `2` immutable Benchmark rows; both have non-null sent state. Two distinct Mailgun audits are `delivered` with delivered timestamps and exact region `eu`. The report configuration was restored to `benchmarks`, `09:00`, `Europe/Amsterdam`, and one original recipient.
- The controlled validator's final delivery-count assertion initially false-failed because it compared application UTC with a database `timestamp without time zone` cutoff. It now identifies fresh audits by provider-response-ID baseline. The read-only inspector also required an explicit UUID/text snapshot join cast. Both validation-only defects are fixed and guarded; neither affected application delivery or snapshots.
- The broader post-fix packet passed `54` files and `615` tests, including `source-safety-regression.test.ts` `87/87`; `npm run check` and `npm run build` passed. Report inbox receipt is not claimed and is not part of the Benchmark certification boundary.
- Final read-only health at `2026-08-03T09:33:27Z` returned exact SHA `b42c51e9ebcc12d74851cc640c86038513a57828`. Report scheduler metrics recorded `totalSent = 2`, `totalFailed = 0`, and `successRate = 100.00%`. The separate GA4 daily scheduler remained healthy but idle with `totalScheduledRuns = 0` and next run `2026-08-04T03:00:00.000Z`, so Current Commit 14 remains outstanding without contradiction.

The only remaining Benchmark production evidence is one successful natural timer-fired GA4 daily run on the unchanged reviewed revision. If Current Commit 14 passes and the final revision/dependency comparison is clean, GA4 Benchmarks can be marked clean-certified and production-ready under this exact Benchmark boundary. Machine-readable production status stays `UNVERIFIED` until that evidence is recorded.

### Active Production-Certification Commit Queue

This is the complete finite queue for strict GA4 Benchmarks production certification. Do not add gates unless new evidence exposes a defect, dependency-boundary change, or undocumented Benchmark consumer. Validation-only commits should change only the canonical evidence, machine-readable certification, focused guards, and validation tooling required by that commit. Any discovered Critical or Major defect must receive a failing guard before the smallest safe runtime fix, and the affected commit remains open until the fix is deployed and revalidated.

#### Benchmark Current Commit 11 — Lock The Exact Production Certification Revision

Root cause:

The authenticated production clearance was captured against runtime revision `5366d0babc9550ecd408e55bc385e7024854f424`, while deployed evidence revision `fbc10e04f69f1d2709d3e2629f8c4818a7062c90` adds validation tooling, documentation, and the certification assertion. Strict certification cannot silently carry evidence across revisions, even when the diff is non-runtime.

Expected files:

- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/certifications/ga4-benchmarks.json`
- an existing validation artifact only if needed to record the boundary comparison

Required evidence:

- Select and record one exact production certification SHA.
- Compare that SHA with `5366d0babc9550ecd408e55bc385e7024854f424` across the complete Benchmark dependency boundary and relevant deployment configuration.
- Prove that every intervening change is documentation/test/validation-only, or invalidate and re-run the affected runtime evidence.
- Confirm production `GET /api/health` reports the selected SHA.
- Record the exact diff command, files, deployment/configuration comparison, and result without including secrets or tenant identifiers.

Completion rule:

Complete only when the reviewed implementation SHA, deployed SHA, dependency boundary, and machine-readable record agree and no unreviewed runtime or configuration change remains.

Implementation status:

Complete on August 3, 2026 for the code/deployment boundary required before Current Commit 12:

- `GET https://marketforensics.onrender.com/api/health` returned `200`, `nodeEnv = production`, and exact deployed evidence SHA `fbc10e04f69f1d2709d3e2629f8c4818a7062c90` at `2026-08-03T04:14:21.146Z`.
- `git diff --name-status 5366d0babc9550ecd408e55bc385e7024854f424..fbc10e04f69f1d2709d3e2629f8c4818a7062c90` returned only `GA4/BENCHMARKS_PRODUCTION_READINESS.md`, `GA4/certifications/ga4-benchmarks.json`, `scripts/ga4-benchmark-beta-clearance-readonly.ts`, and `server/ga4-benchmark-regression.test.ts`.
- The production-source exclusion diff across `client`, `shared`, and `server` after excluding test files returned no files. No application runtime source changed after `5366d0babc9550ecd408e55bc385e7024854f424`.
- The repository deployment/configuration diff for `render.yaml`, `package.json`, `package-lock.json`, Vite, TypeScript, Drizzle, Vitest, Playwright, and workflow configuration returned no files.
- On exact deployed evidence SHA `fbc10e04f69f1d2709d3e2629f8c4818a7062c90`, `GET /health/scheduler` returned `200`, scheduler started/timer scheduled, GA4 reporting timezone `UTC`, time `03:00`, `runOnStartup = false`, and next run `2026-08-04T03:00:00.000Z`.
- `npm test -- --run server/ga4-benchmark-regression.test.ts` passed `1` file and `13` tests after the restricted sandbox's pre-test `spawn EPERM` was bypassed by running the identical authorized command.
- The locked implementation runtime SHA is `5366d0babc9550ecd408e55bc385e7024854f424`; `fbc10e04f69f1d2709d3e2629f8c4818a7062c90` is the exact deployed descendant used to prove the evidence-only boundary. External GA4 property/source state is deliberately revalidated in Current Commit 13, and email-provider configuration/delivery in Current Commit 15; Commit 11 does not overclaim either.
- The documentation/machine-record commit that records this result is evidence-only. Current Commit 15 must perform the final descendant boundary comparison before changing production status from `UNVERIFIED`.

#### Benchmark Current Commit 12 — Run The Final Clean-Revision Local Gate

Root cause:

The applicable regressions, TypeScript check, and production build passed during the beta audit, but strict production certification requires one final run from an isolated clean checkout of the exact Commit 11 revision. The shared working tree contains unrelated user changes and cannot be treated as clean-revision evidence.

Expected files:

- no runtime file unless the clean gate exposes a proven Benchmark defect
- focused regression guard and smallest safe fix only if a defect is found
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/certifications/ga4-benchmarks.json`

Required evidence:

- Run every applicable GA4 Benchmark and documented-consumer regression from the exact certification revision, including lifecycle, destructive safety, auth/tenant isolation, calculations, thresholds, alerts/notifications, Insights, browser/server Reports, refresh/recompute, and scheduler paths.
- Run `npm run check`.
- Run `npm run build`.
- Run the Benchmark certification-integrity regression.
- Record exact commands, file/test counts, and results. Clearly separate unrelated failures; no applicable Benchmark failure may be deferred.

Completion rule:

Complete only when all applicable tests, TypeScript, build, and certification-integrity checks pass on the exact clean revision with zero Critical or Major findings remaining.

Implementation status:

Complete on August 3, 2026 at exact clean validation SHA `473c4e151b43aac33cb1d35a5c4b0fa85a85c36b`:

- The initial clean gate at Commit 11 evidence SHA `7f50593cf17149593d2256babae732feadd5df97` exposed two Minor validation defects and no runtime defect. `server/ga4-ui-regression.test.ts` assumed LF line endings and false-failed on the clean Windows CRLF checkout; its guard now accepts LF or CRLF. `server/source-safety-regression.test.ts` expected two superseded non-atomic delete calls; the real route already used `deleteSpendSourceWithRecords(campaignId, sourceId, deletingSourcePlatformContext)`, and the storage helper already performed campaign/source/platform-scoped deletes in one transaction. The corrected guard now proves that transactional boundary and rejects the old split calls.
- Focused guard commit `473c4e151b43aac33cb1d35a5c4b0fa85a85c36b` changes only those two regression files. No production runtime source, response contract, calculation, persistence behavior, or configuration changed.
- The complete applicable inventory was generated from this readiness document, the threshold/alert/Insights/Reports readiness documents, the machine record, and directly affected shared tests. `& .\node_modules\.bin\vitest.cmd run --pool forks $tests` passed `52` files and `499` tests, including the `13`-test Benchmark certification-integrity regression.
- `& .\node_modules\.bin\vitest.cmd run --pool forks server/ga4-ui-regression.test.ts` passed `1` file and `36` tests. The filtered applicable shared guard passed `1` test with `86` intentionally skipped by `--testNamePattern="individual spend source delete proves campaign ownership before deleting source records"`.
- The entire affected shared file was not hidden: `& .\node_modules\.bin\vitest.cmd run --pool forks server/source-safety-regression.test.ts` produced `80` passes and `7` failures, all named Instagram connection/selection/refresh route guards. They are unrelated to GA4 Benchmarks and its documented consumers, are not counted as passing, and remain outside this finite certification scope.
- `npm run check` passed. `npm run build` passed, producing both the Vite client and esbuild server production bundles.
- `git diff --name-status 5366d0babc9550ecd408e55bc385e7024854f424..473c4e151b43aac33cb1d35a5c4b0fa85a85c36b` contains only canonical Benchmark evidence/tooling and regression files. The production-source exclusion across `client`, `shared`, and `server` returned `NONE`; the repository deployment/build configuration comparison returned `NONE`; and the validation worktree had no tracked changes.
- Findings for Current Commit 12: Critical `0`; Major `0`; Minor `2`, both fixed as validation guards. No applicable failure was deferred. Production certification deliberately remains `UNVERIFIED` because Current Commits 13-15 still require production-only evidence.

#### Benchmark Current Commit 13 — Prove Exact Deployed Benchmark-Consumer Parity

Root cause:

Before Current Commit 13, the exact deployed beta pack proved authenticated inventory plus live-provider, persisted, scheduler-candidate, card, and Tracker parity, but exact deployed Insights, browser PDF, report-artifact, and alert/notification evidence was incomplete.

Expected files:

- `scripts/ga4-benchmark-beta-clearance-readonly.ts` or the smallest existing validation artifact
- `scripts/ga4-benchmark-commit13-authorized-validation.ts`
- `scripts/ga4-benchmark-commit13-delivery-readonly.ts`
- `server/report-scheduler.ts` and `server/routes-oauth.ts` only for the proven immutable-snapshot defect
- focused regression only if validation tooling or a runtime path changes
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/certifications/ga4-benchmarks.json`

Required evidence:

- Authenticate against the exact Commit 11 deployed revision and verify complete campaign/property/owner/filter/timezone/window inventory.
- Compare the same Benchmark IDs, metric identities, current values, targets, availability states, and threshold decisions across persisted rows, cards, Tracker, Insights, browser PDF, scheduled Benchmark/Insights report artifacts, alerts, and notifications.
- Prove valid-zero, unavailable, stale/last-good, blocked, insufficient-data, and failure states do not create false conclusions or false breaches.
- Keep production application data read-only. If no suitable existing report artifact or alert/notification record exists, stop that subpath and request authorization for one controlled production event rather than manufacturing evidence or silently mutating production.
- Record zero application-data mutation attempts, all mismatches, and the exact root cause of any mismatch.

Completion rule:

Complete only when every documented deployed Benchmark consumer is either proven exactly consistent or correctly fail-closed for its state, with no unexplained mismatch and no unauthorized production mutation.

Implementation status:

Complete on August 3, 2026 for deployed consumer parity and correct fail-closed delivery behavior at exact deployed runtime SHA `9ed32290b32773af543b7a927ef5e197c4e3b761`:

- `GET /api/health` returned `200`, `nodeEnv = production`, and exact SHA `9ed32290b32773af543b7a927ef5e197c4e3b761`. `GET /health/scheduler` returned `200`; the GA4 daily scheduler was started, timer-scheduled, idle, and configured for `03:00 UTC`. Natural-run evidence remains Current Commit 14.
- The final read-only validator used a database `READ ONLY` transaction, authenticated owner-scoped GET requests, browser GET navigation, and local browser PDF downloads. It recorded `success = true`, `2` campaigns, `4` active Benchmarks, zero failures, and zero attempted application mutations.
- Inventory, campaign/property/owner/filter/timezone/window scope, live provider, persisted rows, scheduler/UI candidates, cards, Tracker, Insights conclusions, browser PDF, and alert/notification decisions all passed exactly. The no-property campaign remained fail-closed with no scored consumer or false notification.
- The controlled artifact trace exposed one Major defect before sending: scheduled/manual snapshot JSON stored only metadata, so immutable Benchmark value parity was impossible to prove. Commit `9ed32290b32773af543b7a927ef5e197c4e3b761` now persists the selected, freshly preflighted Benchmark IDs, names, metrics, units, current values, targets, threshold states, and update timestamps in both scheduled and manual snapshot payloads. The actual preflight and PDF paths are regression-covered.
- Authorized manual production validation created one Benchmark and one Insights snapshot. Each contained exactly `2` immutable Benchmark rows: Conversions current `95`, target `299`, `behind`; Revenue current `51405.93`, target `20000`, `on_track`. Parsed PDFs were valid and exact (`7968` and `31303` bytes). Snapshot IDs, report ID, campaign ID, owner ID, property ID, and recipient were recorded only as hashes.
- Authorized scheduled production validation exercised one Benchmark event and one Insights event against one approved recipient. Both reached `pending_delivery` after Mailgun acceptance; neither had `sentAt` or `snapshotId`, so the app correctly created no false sent snapshot. The read-only Mailgun check returned `not_checked`, leaving provider delivery and inbox receipt unproven.
- After every controlled path, the original report type, configuration, schedule, timezone, and recipients were restored. The pre/post configuration hashes both equal `fd95883d1e7f`; the final read-only inventory confirmed `benchmarks`, `09:00`, `Europe/Amsterdam`, and one original recipient.
- `& .\node_modules\.bin\vitest.cmd run --pool forks $tests` passed `54` files and `624` tests. `npm run check` and `npm run build` passed. The restricted parallel launch and the npm PowerShell-array invocation did not execute the intended test packet and are not counted as passing evidence. A final restricted-token focused rerun was also blocked before test loading by Windows `spawn EPERM`; the authorized identical command passed all `15` tests.
- Findings at Current Commit 13 completion: Critical `0`; Major `2` found there—immutable snapshot values missing (fixed there) and production delivery confirmation unavailable (subsequently fixed in the former Current Commit 15 Reports/shared-infrastructure packet); Minor `3`, all fixed: early terminal-state capture, over-broad authorized report selection, and the stale implementation-SHA assertion. Current Commit 13 was complete because exact artifacts passed and both scheduled consumer states were proven correctly fail-closed. Under the corrected section boundary, production certification remains `UNVERIFIED` only for Current Commit 14.

#### Benchmark Current Commit 14 — Capture A Successful Natural Daily Scheduler Run

Root cause:

The predecessor revision's natural timer fired and exposed the false-fatal skipped-row defect. The corrected scheduler path is deterministic-regression covered, but the current corrected deployed revision has not yet recorded a successful natural timer-fired run.

Expected files:

- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/certifications/ga4-benchmarks.json`
- no scheduler runtime file unless natural execution exposes a proven defect

Required evidence:

- Observe `/health/scheduler` after the configured timer fires naturally without using the manual trigger as a substitute.
- Confirm `lastRunTrigger = scheduled`, `lastRunStatus = success`, the expected unchanged deployed SHA, and a completed run window/date.
- Capture campaign, KPI, and Benchmark processed/updated/skipped/failed counts and hashed row evidence.
- Confirm expected unavailable/skipped records remain observable but nonfatal, actual failures remain fatal, global alert evaluation is not suppressed by expected skips, and no cross-tenant/campaign processing is exposed.
- If a deployment or relevant configuration change occurs before the run, return to Current Commit 11 and re-evaluate affected evidence.

Completion rule:

Complete only after one successful natural timer-fired run on the locked corrected revision with reviewed recompute and alert evidence.

#### Former Benchmark Current Commit 15 — Reports/Shared-Infrastructure Evidence, Not A Benchmark Gate

Root cause:

This queue item was created by expanding downstream Benchmark parity into full scheduled-report delivery certification. That boundary was too broad: report generation, scheduling, delivery, attachments, and inbox receipt belong to the separate Reports audit. The completed evidence below is retained because it matches the implemented shared report code, but it is not required to certify the Benchmark section.

Expected files:

- email-related runtime/UI files and focused tests only if the chosen path disables or fixes the feature
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/certifications/ga4-benchmarks.json`
- the existing read-only email validation artifact

Historical Reports/shared-infrastructure behavior and evidence:

- The delivery-enabled report path was selected under explicit authorization and known controlled recipients.
- Scheduled Benchmark/Insights Reports reached provider-confirmed `sent` and created immutable snapshots containing the preflighted Benchmark rows.
- Provider acceptance or `pending_delivery` was not treated as delivery.
- Inbox receipt was not established and is left for the later Reports audit; it is not a Benchmark gate.
- Re-run affected email, alert, notification, auth, tenant-isolation, scheduler, TypeScript, and build checks after any code change.
- Re-run any Commit 11-14 evidence invalidated by the selected email implementation.
- Only after Current Commit 14 passes, set the canonical and machine-readable Benchmark status to the project's verified production value, populate the exact certified SHA, record zero remaining Benchmark Critical/Major findings, commit, push, deploy, and verify the final evidence-only boundary.

Completion rule:

Removed from the Benchmark completion rule. Reports delivery and inbox evidence must be assessed later under Reports readiness.

Implementation status:

Bounded Reports/shared-infrastructure evidence is complete on August 3, 2026 at exact deployed SHA `b42c51e9ebcc12d74851cc640c86038513a57828`. The smallest fix preserves the accepted Mailgun region through report delivery confirmation. Two distinct controlled `eu` audits are provider-confirmed `delivered`; the corresponding Benchmark and Insights report events are `sent` and each owns one immutable two-row snapshot. Original report configuration is restored. This does not certify Reports and creates no Benchmark inbox requirement.

Stop immediately after Current Commit 14 passes, the final Benchmark revision comparison is clean, and no Benchmark Critical or Major finding remains. Minor non-core issues may be recorded without extending this queue.

### Historical July 2026 Status And Evidence

Current-code override on July 31, 2026: Commit 18 changes the shared campaign Benchmark current-value failure contract. Failed financial reads, disconnected/missing GA4, and missing selected source IDs now return unavailable so existing refresh loops preserve last-known values instead of writing misleading zero. The bounded local implementation is proven by focused tests, TypeScript, and a production build, but it is not yet committed, deployed, or externally validated. The affected current-value/recompute/alert path is therefore **unproven**, and the historical certification below must not be repeated as a current whole-path claim until Commit 18 deployed validation passes. Timer-fired scheduler execution remains outside this Commit 18 proof.

As of July 1, 2026, after a strict current-code re-trace, focused Benchmark validation, and controlled deployed provider/UI/email/scheduler/token-failure evidence, GA4 Benchmarks are **clean-certified for the current GA4 Benchmarks section under the documented scope in this file**.

No Current Commit blockers remain open for the current GA4 Benchmarks certification scope. Do not extend this claim to future code changes, future GA4 properties/windows, future alert emails, a real unsimulated Google token revocation event, daily timer-fired evidence, or future platforms without fresh evidence.

Status split:

- current GA4 Benchmark section certification: passed for the traced UI/API/storage/scheduler/alert/notification/report paths covered by this document, the focused Benchmark tests, and the controlled deployed validations recorded here
- historical July Current Commit blockers: none for that recorded packet; current Benchmark Current Commits 8-11 are open
- future platform readiness: unproven; GA4 Benchmark evidence is only a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source

Future-reference boundary rule:

- GA4 Benchmarks have passed validation for production-ready clean certification for the current GA4 Benchmarks section under the documented scope in this file.
- The future-boundary items are not current blockers and must not be reopened as blockers unless the future scope is actually being claimed or changed.
- Do not claim daily timer-fired execution, future GA4 provider windows/outages/delayed attribution, future Benchmark alert email deliveries, a real unsimulated Google revoked-token event, future source mixes, or future platform readiness without fresh evidence for that exact claim.

Certification result:

- completed historical local fixes: persisted GA4 Benchmark ROAS ratio semantics, GA4 primary-property campaign scoping, selected-property UI alignment after `Set as Primary`, ROAS copy correction, shared evaluated Benchmark route access hardening, and bounded persisted ROAS cleanup
- completed target cleanup evidence: pre-apply dry-run found 46 repair candidates and 56 skipped campaign-level reasons; apply updated 46 persisted ROAS rows; post-apply dry-run found 0 remaining repair candidates
- completed local Benchmark evidence: the June 29, 2026 focused Benchmark validation run passed 17 test files and 136 tests covering Benchmark math, current values, route isolation, alert lifecycle, notifications, email audit/idempotency/retry semantics, report consumers, auto-refresh, source lifecycle recompute, and scheduler current-value reconciliation
- current strict revalidation evidence: the June 30, 2026 focused Benchmark validation run passed 18 test files and 139 tests, including the Commit 3 provider-validation token-refresh guard, after re-tracing the current UI/API/storage/scheduler/alert/notification/report paths
- current documentation update: Current Commit 0 rewrites this file into the strict KPI-style certification structure without changing runtime behavior
- current validation-support update: Current Commit 2 adds a GA4 Benchmark provider validation endpoint and regression coverage; deployed validation found a live provider auth blocker and an apparent stored-current mismatch that required stricter window tracing
- current deployed Commit 2 evidence: Render validation on June 30, 2026 for campaign 8aa735ee-c02f-41e2-bb1f-7c3f43bb9458, property 542352127, and requested provider window 2026-06-19 through 2026-06-29 first returned provider.status = live_provider_error with 401 UNAUTHENTICATED; after Commit 3 and Commit 4 fixes, final Current Commit 2 validation on July 1, 2026 for requested provider window 2026-06-19 through 2026-06-30 and current-value window 2026-06-24 through 2026-06-30 returned `provider.status = live_provider_success`, `currentValueProvider.status = live_provider_success`, non-null provider totals, and exact stored-vs-scheduler deltas of `0` for both controlled Benchmark rows
- current Commit 3 deployed validation: Commit 3 deployed validation passed with `provider.status = live_provider_success` and non-null provider totals for the same campaign/property/filter/requested window; the validation-only `simulateRefreshFailure=1` branch also passed on July 1, 2026 with `success = true`, `simulation.refreshFailure = true`, `provider.status = live_provider_refresh_failed`, `provider.totals = null`, and an explicit no-token-metadata-changed error
- current Commit 4 deployed validation: validation-window alignment is implemented, pushed, deployed, and revalidated; `sourceWindows.currentValue` is `2026-06-24` through `2026-06-29`, `currentValueProvider.totals` is non-null, stored Benchmark Revenue `12376.38` equals `schedulerCandidateCurrentValue` `12376.38`, and `storedVsSchedulerDelta = 0`; the `storedVsUiDelta = 0.01` is a one-cent provider-versus-persisted rounding difference, not proven Benchmark damage
- current Commit 4 Follow-Up local fix: scheduler/report-preflight guards now track updated Benchmark row IDs, fail closed for Benchmark-section reports whose selected rows were not recomputed, and prevent duplicate Benchmark history rows for the same Benchmark/date even when an older report date is reprocessed after newer history exists
- current Commit 4 Follow-Up deployed report-preflight validation: Render validation on June 30, 2026 for Benchmark `989de4b3-e1e9-4891-8094-a010bcd59c43` and GA4 Benchmark report `eae94163-5608-4590-8dcd-7d927ba6b421` returned manual snapshot `200`, created snapshot `a5713490-f9b1-4548-9660-cbde32e372d5`, changed Benchmark `updatedAt` from `2026-06-30T12:16:31.780Z` to `2026-06-30T18:11:34.767Z`, kept `currentValue = 12376.38`, and kept Benchmark history count `5 -> 5`
- current Commit 4 Follow-Up scheduler-log search: Render log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines, so deployed daily scheduler timer proof remains unproven
- current Commit 4 Follow-Up deployed observability evidence: `/health/scheduler` on July 1, 2026 at `2026-07-01T08:46:39.004Z` showed the report scheduler running with cron `* * * * *`, `totalChecks = 748`, `lastCheckTime = 2026-07-01T08:46:00.007Z`, `lastScheduledReportsFound = 14`, `lastDueReportsFound = 12`, and no scheduler error; the same response showed GA4 daily scheduler `started = true`, `timerScheduled = true`, `runOnStartup = false`, `nextRunAt = 2026-07-01T12:15:00.000Z`, `nextDataThroughDate = 2026-06-30`, and `totalRuns = 0`, proving the daily timer was scheduled but not yet proving the daily pipeline executed
- current Commit 4 Follow-Up manual validation support: RCA found there was no safe deployed API to run the same GA4 daily refresh plus KPI/Benchmark recompute path without waiting for the timer; the campaign-access-guarded `POST /api/campaigns/:id/ga4-daily-scheduler/run-now` trigger is implemented, pushed, deployed, and user-validated on July 1, 2026 with `success = true`, `beforeManualRuns = 1`, `afterManualRuns = 2`, `lastRunTrigger = manual`, `lastRunStatus = success`, and `lastError = null`
- current Commit 5 deployed validation: read-only Benchmark alert email delivery validation support is implemented, pushed, deployed, and user-confirmed as passed, including inbox receipt; exact endpoint JSON, provider response ID, delivered timestamp, recipient, and subject were not pasted into this chat, so this file records user-confirmed external validation rather than locally inspected raw evidence
- current Commit 6 validation: GA4 Benchmark edit/delete icon buttons now have stable accessible labels/titles; `server/ga4-benchmark-regression.test.ts` locally pins the route, tab, scoped API calls, lifecycle notification invalidation, blocked/insufficient states, unit rendering, and browser-PDF Benchmark path; `npm test -- server/ga4-benchmark-regression.test.ts` passed 10 tests on July 1, 2026; deployed Render UI validation was user-confirmed passed on July 1, 2026 for the GA4 Benchmarks tab at campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`
- current Commit 7 decision: GA4 industry Benchmark values are classified as non-production helper/reference data, not certified target evidence; the industry routes now return `targetSourceCertified: false`, the GA4 modal refuses to auto-fill Benchmark targets unless a future response explicitly returns `targetSourceCertified: true`, and GA4 Benchmark copy now refers to custom targets instead of industry-standard targets; `npm test -- server/ga4-benchmark-regression.test.ts` passed 11 tests on July 1, 2026
- historical July production-readiness queue: complete for that packet; current Benchmark Current Commits 8-11 remain open
- not proven and not claimed: daily timer firing by itself, future GA4 provider availability outside the recorded windows, future GA4 processing delays, future alert email delivery, a real unsimulated Google token revocation event, future source mixes, and future platform Benchmark readiness

The historical July safe answer was:

`GA4 Benchmarks are clean-certified for the current GA4 Benchmarks section under the documented scope, with controlled deployed UI/email/provider/manual-scheduler/token-failure validation recorded. Do not extend this to future code, future GA4 properties/windows, future sends, real unsimulated token revocation, daily timer-fired evidence, or future platforms without fresh evidence.`

This status should change only after:

- a Current Commit below is implemented and validated
- a new bug is found in a GA4 Benchmark value, lifecycle, scheduler, alert, notification, cleanup, or report-consumer path
- the GA4 Benchmark source model, provider configuration, scheduler behavior, alert/email behavior, report generation path, or downstream consumers change
- a future source/platform attempts to reuse GA4 evidence without its own source-specific proof

Certification rule:

- completed fixes and controlled deployed evidence make GA4 Benchmarks clean-certified for the documented current GA4 Benchmarks scope
- the clean-certified answer can remain valid only while the complete value inventory, downstream propagation matrix, lifecycle matrix, negative cases, report consumers, alert/notification paths, cleanup boundary, and test/deployed evidence remain covered by current evidence
- if any later bug, code change, provider change, source change, or new value path appears, lower the affected path to unproven and add a new Current Commit before repeating the clean-certified answer for that changed path

## Current Future-Chat Answer

Answer that GA4 Benchmarks are closed-beta ready only for the recorded revision and dependency boundary, with external Benchmark email delivery excluded. Production certification remains `UNVERIFIED` until Benchmark Current Commits 11-15 are complete. Cite older packets only as historical bounded evidence.

Do not reopen closed current-scope GA4 Benchmark blockers solely because time has passed. Reopen only when a changed implementation, new value path, failed validation, or new bug affects the certified Benchmark scope.

Do not claim daily timer-fired evidence, future Benchmark alert email delivery, future browser/UI changes, broad future GA4 provider availability, real unsimulated Google token revocation behavior, or future-platform readiness without fresh evidence. Benchmark alert email provider/inbox validation is user-confirmed complete for the controlled Commit 5 send only, and Benchmark browser/deployed UI validation is user-confirmed complete for the controlled Current Commit 6 pass only; future sends and future UI changes require their own evidence before those claims are repeated.

This certification method is reusable as the Benchmark refinement and validation template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source. It is never proof that those sources are production-ready.

## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Complete GA4 Benchmark Value Inventory`
4. `End-To-End Trace Matrix`
5. `Downstream Propagation Matrix`
6. `Source/Lifecycle Matrix`
7. `Negative-Case Matrix`
8. `Test Coverage Matrix`
9. `Current Commit Queue`
10. `Not Locally Verifiable / External Caveats`
11. `Future Platform Template`

Answer that GA4 Benchmarks are closed-beta ready only for the exact reviewed revision and remain production-certification `UNVERIFIED`. Read the controlling status and active Current Commits 11-15 before the historical matrices. KPI fixes are dependencies, not Benchmark proof.

## Future Source Reading Order

Use this order when adapting the GA4 Benchmark model to Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. target platform entry doc
5. target platform development workflow doc, if one exists
6. target platform Benchmark functional doc
7. target platform Benchmark production-readiness doc, if one exists
8. `GA4/BENCHMARKS.md` as the functional Benchmark template only
9. this file as the audit structure/template only
10. `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` only as a historical threshold/scoring appendix
11. `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` only as the alert/notification lifecycle template
12. target platform financial/source/refresh/report docs where the target Benchmark path touches revenue, spend, schedulers, alerts, notifications, or reports

Stable file roles:

- `GA4/BENCHMARKS.md` = what the GA4 Benchmark tab does
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md` = whether GA4 Benchmarks are production-ready and how to prove a future source
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` = historical threshold/scoring slice only
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` = alert, notification, email-audit, action URL, bell, and Notifications lifecycle template only

For a future source, prove source identity, account/property/customer scoping, selected campaign/ad set/ad group/sheet scope, current-value UI path, persisted recompute path, threshold policy, alert and notification path, scheduler/reprocess path, ownership checks, delete behavior, report consumers, provider/deployed evidence where required, and existing-data cleanup boundary before calling that source's Benchmarks production-ready.

## Current Scope

This clean certification applies to the current GA4 `Benchmarks` tab for:

- platform-scoped GA4 Benchmark list display
- visible GA4 Benchmark create, edit, and delete paths
- Benchmark current-value calculation for GA4 platform Benchmarks
- Benchmark tracker summary counts and average progress
- blocked and insufficient-data handling
- Benchmark alert and notification visibility
- Benchmark alert email eligibility and local audit behavior
- GA4 refresh, daily scheduler, source-refresh, and report preflight recompute paths that update Benchmark current values and Benchmark history
- GA4 campaign, property, source, and campaign-access scoping that can affect Benchmark values
- GA4 browser PDF and scheduled/server PDF Benchmark consumers
- narrow GA4 Insights consumers that directly read GA4 Benchmark status/history
- bounded existing persisted ROAS cleanup previously applied and verified

This clean certification does not certify:

- Meta Benchmarks
- Google Ads Benchmarks
- LinkedIn Benchmarks
- Google Sheets Benchmarks
- Custom Integration Benchmarks
- campaign-level Benchmark pages except for narrow shared helpers explicitly traced here
- provider-confirmed Benchmark alert email delivery
- actual Benchmark alert email inbox receipt
- live GA4 provider behavior outside what local code, tests, and documented deployed evidence can prove
- mock industry benchmark values as production industry-standard evidence

## Root Cause Of Prior Confusion / Prior Overclaim Risk

Earlier Benchmark readiness wording mixed several narrower slices:

- `GA4/BENCHMARKS.md` defined the intended product contract.
- threshold/scoring docs proved metric-aware Benchmark math.
- alert/notification docs proved much of the alert lifecycle.
- earlier readiness notes treated completed fixes as close to certification.

Those files and slices did not by themselves certify the whole Benchmark production lifecycle.

The later full Benchmark audit traced the persisted scheduler path and found a separate defect: GA4 Benchmark ROAS was displayed as an `x` ratio in the UI and docs, but the GA4 recompute job persisted ROAS as a percent-like value. Platform GA4 alert checks, notification visibility, email eligibility, Benchmark history, and scheduled/server report consumers can read persisted Benchmark rows, so the defect was not limited to visible cards.

That defect and related property-scope, selected-property alignment, ROAS copy, shared evaluated-route access, and existing-data cleanup blockers have been fixed and validated. This file now separates:

- what is proven for the current GA4 Benchmark tab
- what was previously a non-current or deferred route alias
- what is external/provider evidence
- what is a future-platform template but never future-platform proof

## Non-Negotiable Accuracy Rules

GA4 Benchmarks must preserve:

- campaign ownership and campaign access checks
- GA4 property scoping
- selected GA4 campaign/source scoping
- imported revenue additivity
- spend-source provenance
- `ROAS = Revenue / Spend` as an `x` ratio, not a percent
- `ROI = (Revenue - Spend) / Spend * 100` as a percent
- `CPA = Spend / Conversions` as currency
- Pipeline Proxy exclusion from confirmed revenue, ROAS, ROI, CPA, Benchmarks, reports, and alerts
- metric-aware Benchmark status classification
- lower-is-better behavior for cost/spend-style Benchmarks
- blocked and insufficient-data exclusion from tracker counts and average progress
- one active in-app notification row per active GA4 Benchmark breach
- notification dismiss/clear as visibility only, not analytical resolution
- provider/API acceptance separated from confirmed email delivery
- stable API response shapes
- fail-closed behavior for missing campaign, missing ownership, invalid current value, invalid threshold, and stale/deleted Benchmark rows

Do not change Benchmark calculations, alert semantics, source ownership, scheduler behavior, report behavior, cleanup boundaries, or response shapes unless the exact path has been traced and the smallest safe Current Commit is identified.

## Complete GA4 Benchmark Value Inventory

| Value / surface | Source path | Formula / semantics | Scope and window | Downstream consumers | Current evidence status |
| --- | --- | --- | --- | --- | --- |
| Benchmark grid row count and tracker `Total Benchmarks` | GA4 Benchmark list query -> platform Benchmark rows | Count of GA4 Benchmark rows in current campaign/platform scope | Campaign + `google_analytics`; current saved rows | Benchmark tab UI, executive snapshot tracker | Route access, storage scope, and frontend query key traced; June 29 Benchmark tests passed |
| `On Track`, `Needs Attention`, `Behind`, `Avg. Progress` | Benchmark rows -> shared Benchmark math/status policy | Metric-aware progress, tolerance, lower-is-better direction, blocked/insufficient exclusions | Campaign + visible Benchmark rows | Tracker, Benchmark cards, browser PDF, Insights summaries | Shared math and GA4 Benchmark regression tests passed |
| Users, Sessions, Pageviews, Conversions | GA4 selected daily/to-date/breakdown values -> visible UI and persisted recompute job | Count totals, rounded as counts | Selected campaign, selected/primary GA4 property, GA4 campaign filter, completed GA4 reporting date where persisted | Benchmark cards, tracker, history, alerts, notifications, reports | Proven for current code scope by GA4 Benchmark regressions; live provider outages/token-refresh are external caveats |
| Revenue | selected scoped GA4 native financial revenue + active GA4-context imported revenue | `ga4Revenue + importedRevenue`; Pipeline Proxy excluded | GA4 native source stays selected GA4 financial source; imported source-backed window is active source records through current UTC day | Benchmark cards, ROAS, ROI, tracker, alerts, notifications, reports | Proven locally through Benchmark/financial/regression evidence; controlled deployed provider validation passed for the recorded window; future provider windows require fresh evidence |
| Spend | active explicit GA4-context spend sources | Source-backed spend only; GA4 API does not supply spend by default | Campaign + active spend source records through current UTC day | ROAS, ROI, CPA, tracker, alerts, notifications, reports | Proven locally through source lifecycle recompute tests and financial source contract |
| ROAS | Revenue / active spend | Ratio displayed as `x`; persisted as ratio | Same campaign/source windows as Revenue and Spend | Benchmark card, history, alerts, notifications, reports | Historical blocker fixed; cleanup applied; ratio semantics regression passed |
| ROI | `(Revenue - Spend) / Spend * 100` | Percent | Same campaign/source windows as Revenue and Spend | Benchmark card, history, alerts, notifications, reports | Proven locally by shared financial and Benchmark coverage |
| CPA | Spend / conversions | Currency; lower is better; insufficient when spend or conversions are missing | Spend through current UTC source window; conversions from selected GA4 scope | Benchmark card, tracker, alerts, reports | Proven locally by Benchmark sufficiency and math coverage |
| Conversion Rate | Conversions / sessions * 100 | Percent with zero-session guard | GA4 selected campaign/property scope | Benchmark card, tracker, alerts, reports, Insights | Proven locally by Benchmark sufficiency and regression coverage |
| Engagement Rate | normalized GA4 engagement rate | Percent; requires sessions | GA4 selected campaign/property scope | Benchmark card, tracker, alerts, reports | Proven locally by visible/current-value and sufficiency coverage |
| Custom Benchmark rows | User-entered `currentValue`, `benchmarkValue`, `unit`, name/description | No guessed GA4 recompute; manual/custom current value is preserved unless user edits it | Campaign + `google_analytics`; saved row scope | Benchmark card, alerts if enabled, reports | Proven for visible create/edit path; no automatic source provenance |
| Benchmark target | user-entered `benchmarkValue` and selected unit | Required Benchmark target; industry lookup is helper-only and not auto-filled unless a future response explicitly marks `targetSourceCertified: true` | Campaign + platform row | Benchmark cards, tracker, alerts, reports | Proven for user-entered targets; industry helper lookup explicitly uncertified |
| Descriptive metadata | `description`, `benchmarkType`, `source`, `industry`, `geoLocation`, `period`, `confidenceLevel`, `applyTo`, `specificCampaignId` | Persisted/display metadata only | Benchmark row scope | Cards, modal, reports where displayed | Proven as metadata; no current industry-autofill certification |
| Stored variance | `variance` | Historical/stored variance from route/history jobs; not live status authority | Benchmark row/history scope | History analytics, legacy fields | Proven as historical/stored field only |
| Data availability state | blocked, insufficient, invalid target | Missing dependency and sufficiency helpers; invalid benchmark guard | Current visible values and persisted recompute path | Cards, tracker, Insights, browser PDF | Proven locally |
| Alert settings | `alertsEnabled`, `alertThreshold`, `alertCondition`, `emailNotifications`, `emailRecipients`, `alertFrequency`, `lastAlertSent` | Saved Benchmark row and alert form | Campaign + Benchmark row | In-app alerts, email attempt/audit, notifications | Proven locally; provider delivery external |
| In-app notification values | title/details, action URL, current value, threshold value, condition, created date, `benchmarkId` metadata | `benchmark-notifications.ts` and `/api/notifications` enrichment | Active breached Benchmark row; campaign-scoped | Bell, Notifications page, action routing | Proven locally for active breached rows |
| Benchmark history analytics | `benchmark_history.currentValue`, `benchmarkValue`, `variance`, `performanceRating`, `recordedAt`, `notes`, analytics trend fields | `runGA4DailyKPIAndBenchmarkJobs`, `storage.recordBenchmarkHistory`, `storage.getBenchmarkAnalytics` | Auto GA4 daily history rows, where scheduler/reprocess wrote history | Insights, history views, reports where consumed | Proven locally; data exists only after scheduler/reprocess writes history |
| Browser GA4 PDF values | selected Benchmark rows, current/target/status/progress | Client-side PDF uses the same visible Benchmark helpers | Current browser state and selected custom report config | Browser downloads | Proven locally by source trace/regression coverage |
| Scheduled/server GA4 PDF values | persisted platform Benchmark rows after GA4 preflight recompute | Server report reads `getPlatformBenchmarks("google_analytics", campaignId)` | Campaign + saved report config; preflight date where supplied | Scheduled/test/manual report output and direct snapshot PDF dependency | Proven locally; controlled deployed preflight passed; future provider/email delivery remains per-event evidence |
| Industry benchmark helper values | `/api/industry-benchmarks/:industry/:metric` mock/static helper responses | Returns additive `certificationStatus` and `targetSourceCertified: false`; not a production source of truth | GA4 modal refuses auto-fill unless a future response explicitly marks `targetSourceCertified: true` | None certified for current GA4 tab | Helper-only classification proven locally by Commit 7 regression |

Computable GA4 Benchmark metrics:

| Metric key | Current-value source | Unit semantics | Gating / sufficiency | Creation status |
| --- | --- | --- | --- | --- |
| `roas` | selected GA4 native revenue + active imported GA4 revenue, divided by active spend | Ratio `x` | Requires spend and revenue; insufficient if spend is below minimum | Visible template |
| `roi` | `(financialRevenue - financialSpend) / financialSpend * 100` | Percent | Requires spend and revenue; insufficient if spend is below minimum | Visible template |
| `cpa` | `financialSpend / financialConversions` | Currency; lower is better | Requires spend and conversions | Visible template |
| `revenue` | selected GA4 native financial revenue plus active imported GA4 revenue | Campaign currency | Requires revenue | Visible template |
| `conversions` | selected GA4 campaign/property conversions | Count | Count-aware tolerance; no revenue/spend dependency | Visible template |
| `conversionRate` | conversions / sessions * 100 | Percent | Requires sessions | Visible template |
| `engagementRate` | normalized GA4 engagement rate | Percent | Requires sessions | Visible template |
| `users` | selected GA4 users | Count | Count-aware tolerance | Visible template |
| `sessions` | selected GA4 sessions | Count | Count-aware tolerance | Visible template |
| `pageviews` | GA4 daily pageviews or fallback metrics pageviews | Count | Count-aware tolerance | Supported persisted metric; not a current create-template tile |
| custom / blank metric | user-entered current and benchmark values | User-selected unit | No automatic GA4 recompute | Visible custom template |

## End-To-End Trace Matrix

| Path | Source -> storage -> API/UI -> downstream trace | Evidence status |
| --- | --- | --- |
| List display | `client/src/pages/ga4-metrics.tsx` fetches `/api/platforms/google_analytics/benchmarks?campaignId=...`; route requires `ensureCampaignAccess`; storage reads exact platform + campaign rows | Proven |
| Create | Current GA4 tab posts `/api/benchmarks` with `campaignId` and `platformType: "google_analytics"`; route requires campaign access, validates schema, creates row, awaits in-app Benchmark alert reconciliation, awaits immediate Benchmark email check, and returns created row | Proven for current UI path |
| Edit | Current GA4 tab puts `/api/benchmarks/:id`; route uses `ensureBenchmarkAccess`, preserves existing `campaignId` and `platformType`, updates row, awaits in-app alert reconciliation and immediate email check | Proven |
| Delete | Current GA4 tab deletes `/api/platforms/google_analytics/benchmarks/:benchmarkId`; route uses `ensureBenchmarkAccess`, verifies route platform matches row platform, deletes Benchmark/history, and soft-hides related notifications | Proven |
| Ownership and scoping | `ensureBenchmarkAccess` requires actor, existing Benchmark, nonempty campaignId, and campaign access; list route requires campaign access before storage read | Proven |
| Live current-value display | Known GA4 metrics use selected GA4 values and financial source totals; custom rows use saved `currentValue`; edit modal prefills from the same live current-value resolver | Proven |
| Financial current values | Revenue = selected GA4 native financial revenue plus active imported GA4 revenue; spend = active explicit spend sources; ROAS ratio, ROI percent, CPA currency | Proven locally; live provider accuracy external |
| Blocked/dependency behavior | ROAS/ROI/CPA require spend; ROAS/ROI/revenue require revenue; blocked rows show unavailable current value and are excluded from scoring | Proven |
| Insufficient data behavior | Conversion/engagement rates need sessions; CPA needs conversions; financial ratios need spend; insufficient rows are excluded from scoring and shown as insufficient | Proven |
| Scheduler refresh | GA4 daily scheduler runs daily facts, then `runGA4DailyKPIAndBenchmarkJobs`, then Benchmark alert checks; source refresh paths run recompute before alert checks where immediate correctness is promised | Proven locally; controlled deployed manual trigger passed; daily timer-fired execution not proven |
| Persisted Benchmark values | `runGA4DailyKPIAndBenchmarkJobs` reads selected GA4 connection/property, selected GA4 totals, imported GA4 revenue, spend, updates `currentValue`, and records once-per-date history | Proven locally |
| Alerts and notifications | Benchmark alert service evaluates active Benchmarks, keeps one active alert for breached GA4/campaign rows, resolves stale/non-breaches, and uses GA4 Benchmark deep links | Proven locally |
| Notification visibility freshness | `/api/notifications` enriches active performance alerts from linked Benchmark rows, recomputes GA4 current value for computable rows, hides orphan/cross-campaign/non-breaching rows, and uses no-store freshness | Proven locally |
| Alert emails | Create/update routes await immediate email attempts; scheduler/reminder/retry/idempotency paths are locally covered; provider acceptance is not delivery | Proven locally except provider/inbox delivery |
| Browser PDF | GA4 client-side PDF Benchmark section uses the same blocked/sufficiency/progress/current-value helpers as cards | Proven |
| Scheduled/server PDF | GA4 reports preflight runs GA4 KPI/Benchmark recompute; GA4-specific PDF builder reads `getPlatformBenchmarks("google_analytics", campaignId)` and outputs Benchmark rows | Proven locally |
| Direct GA4 snapshot PDF dependency | Direct snapshot PDF routes run suppress-alert GA4 KPI/Benchmark preflight before shared PDF generation | Proven locally as a Benchmark dependency; deployed direct-PDF evidence in KPI doc is not reused here as Benchmark proof |
| Insights downstream | GA4 Insights reads Benchmark rows, blocked/invalid/insufficient state, live progress, and Benchmark analytics history only when Insights is active | Proven only as a narrow direct Benchmark consumer |
| Non-current platform create alias | `POST /api/platforms/:platformType/benchmarks` is guarded and now awaits both in-app Benchmark alert reconciliation and immediate Benchmark email checks; current GA4 tab does not call it | Hardened locally by Current Commit 1 |
| Industry benchmark lookup | `/api/industry-benchmarks/:industry/:metric` can return mock/static helper values marked `targetSourceCertified: false` | Not a certified target source; GA4 create/edit does not auto-fill helper values as production targets |

## Downstream Propagation Matrix

| Downstream consumer | Benchmark values consumed | Propagation rule | Status |
| --- | --- | --- | --- |
| GA4 Benchmarks cards | name, metric label, description, alerts icon, live/stored current, benchmark target, progress, delta, status, blocked/insufficient messages | Render campaign-scoped GA4 platform Benchmarks from current list query and live current-value helpers | Proven |
| Benchmark tracker | total, onTrack, needsAttention, behind, blocked, insufficient, avgPct | Aggregate only scorable rows; blocked/insufficient rows excluded | Proven |
| Create/edit modal | metric template, custom values, target, unit, description, alert/email settings, edit-current live prefill | Save user-entered target/current values through current GA4 UI path | Proven |
| Delete flow | Benchmark id/name, history rows, linked notifications | Delete selected Benchmark/history and soft-hide related notifications only | Proven |
| In-app alert service | current value, threshold, condition, campaign/platform metadata | Keep one active row only while breached; fail closed on missing/invalid data | Proven locally |
| Notifications bell/page | source-backed current value, threshold, condition, action URL, created date, platform label | Visible only while linked Benchmark exists, belongs to campaign, and still breaches | Proven locally |
| Alert email service | Benchmark row, resolved current value, recipients/frequency, audit/dedupe/retry state | Attempt/send semantics are durable; delivery requires provider/inbox evidence | Locally proven; delivery external |
| Benchmark history analytics | persisted current/target/variance/rating/notes | Created by scheduler/reprocess when data exists | Proven locally |
| Browser GA4 PDF downloads | visible current value, benchmark target, status/progress, blocked/insufficient messages, selected Benchmark IDs | Use browser state/current helpers | Proven |
| Scheduled/server GA4 PDF reports | persisted platform Benchmark rows after GA4 preflight recompute | Fail closed when GA4 KPI/Benchmark preflight skips/fails for covered paths | Proven locally |
| GA4 Insights tab | Benchmark blocked/invalid/insufficient state and history analytics | Narrow direct Benchmark consumer only | Proven locally for direct Benchmark dependency |
| GA4 Overview | No direct consumption of Benchmark rows | Upstream GA4/financial values feed Benchmarks; Overview readiness is not Benchmark proof | Out of scope except upstream dependency |
| GA4 KPIs | No direct consumption of platform Benchmark rows | Shared upstream values and math helpers only | Out of scope; do not use KPI evidence as Benchmark proof |
| GA4 Ad Comparison | No direct consumption of platform Benchmark rows | Shares upstream GA4/financial inputs only | Out of scope |
| Campaign DeepDive / Executive Summary | Uses campaign-level Benchmark rows, not GA4 platform Benchmark tab rows | Out of GA4 tab certification except shared threshold helper behavior | Out of scope |
| Source modals | No Benchmark-specific source modal | Financial source modals are upstream provenance for revenue/spend-derived Benchmarks | Upstream dependency, not Benchmark output |
| Exports/external webhooks | No separate Benchmark export/webhook path identified in this audit | Reports are the covered output path | No current separate consumer |

## Source/Lifecycle Matrix

| Lifecycle path | Current Benchmark status | Evidence / caveat |
| --- | --- | --- |
| Benchmark add/create | Current GA4 UI path uses `/api/benchmarks`, campaign access, schema validation, alert reconciliation, immediate email attempt, query invalidation, and notification refresh | Proven for current UI path |
| Benchmark edit/update | Current GA4 UI path uses `/api/benchmarks/:id`, `ensureBenchmarkAccess`, immutable campaign/platform scope, alert reconciliation, immediate email attempt, query invalidation, and notification refresh | Proven |
| Benchmark delete | Current GA4 UI path uses GA4 platform delete route, verifies platform/campaign access, deletes history, soft-hides related notifications, and refreshes notifications | Proven |
| Non-current platform create alias | Guarded by campaign access and now awaits in-app alert reconciliation before responding | Proven locally by Current Commit 1 regression; still not the current GA4 UI create path |
| GA4 native metric refresh | GA4 daily/on-demand refresh writes selected campaign/property facts and then recomputes Benchmarks | Proven locally; controlled deployed provider/manual scheduler validation passed for the recorded campaign/window; future provider windows and timer-fired execution require fresh evidence |
| Revenue source add/edit/delete | Active revenue source changes recompute GA4 KPI/Benchmark values before alert checks where immediate correctness is promised | Proven locally by source lifecycle recompute coverage; individual source UI modals are upstream and not Benchmark-certified here |
| Spend source add/edit/delete | Active spend source changes recompute GA4 KPI/Benchmark values before alert checks where immediate correctness is promised | Proven locally by source lifecycle recompute coverage; individual source UI modals are upstream and not Benchmark-certified here |
| Source modal/list display | No Benchmark-specific source modal; revenue/spend provenance comes from GA4 financial source docs and Overview financial paths | Upstream dependency; not a Benchmark output |
| Totals/recompute path | `runGA4DailyKPIAndBenchmarkJobs` recomputes persisted Benchmark current values and history after GA4/source refresh | Proven locally |
| Alert lifecycle | Create/update/recompute evaluates breaches; disabled/non-breached/deleted rows resolve or hide; dismissed still-breached rows can be recreated by valid reconciliation | Proven locally |
| Notification visibility lifecycle | `/api/notifications` fail-closes missing/orphan/cross-campaign/non-breaching rows and uses active source-backed current values | Proven locally |
| Email lifecycle | Immediate/reminder email attempts use audit/dedupe/retry semantics and do not equate provider acceptance with delivery | Locally code-ready; provider/inbox delivery external |
| Report lifecycle | Browser and server reports consume current or preflight-recomputed Benchmark rows; covered paths fail closed on preflight failure | Proven locally |
| Scheduler lifecycle | GA4 daily and source-refresh paths update persisted Benchmark values before alert checks | Proven locally; controlled deployed manual trigger passed; daily timer-fired execution not proven |
| Existing damaged data | Prior ROAS percent-style persisted rows were bounded, dry-run inventoried, applied only for proven rows, and post-apply dry-run found 0 remaining candidates | Cleanup complete for known boundary; skipped rows intentionally left unchanged when exact source boundary was unproven |

## Negative-Case Matrix

| Negative case | Expected behavior | Evidence status |
| --- | --- | --- |
| Missing campaign id on current create/list path | Fail closed or return no rows; do not expose unrelated Benchmarks | Proven |
| User lacks campaign access | Route stops before storage read/mutation | Proven by route trace/tests |
| Platform route asked for campaign-level Benchmark rows | Return not found / do not leak campaign-level rows into platform routes | Proven by route isolation tests |
| Update attempts to change campaign or platform scope | Preserve existing campaign/platform and delete mutable payload fields | Proven |
| Delete attempts wrong platform route | Return not found; do not delete row | Proven |
| Missing revenue for revenue/ROAS/ROI Benchmark | Block or mark unavailable; do not score as poor or healthy | Proven |
| Missing or zero spend for ROAS/ROI/CPA | Mark blocked/insufficient; do not divide into misleading values | Proven |
| Missing conversions for CPA | Mark insufficient; do not score as valid CPA | Proven |
| Missing sessions for conversion/engagement rate | Mark insufficient; do not score | Proven |
| Invalid or zero Benchmark target | Exclude from scoring; show invalid/unavailable state | Proven |
| Lower-is-better cost Benchmark | Invert direction correctly for CPA/CPC/CPM/CPL/spend-style custom rows | Proven by shared math tests |
| Custom/unsupported Benchmark | Preserve saved current value; no guessed GA4 recompute | Proven for current custom path |
| Persisted ROAS old percent-style values | Correct only rows with proven GA4 source boundary; leave unproven rows untouched with skip reason | Completed cleanup evidence |
| Stale active notification after Benchmark no longer breaches | `/api/notifications` hides the row after source-backed re-evaluation | Proven locally |
| Deleted Benchmark with active alert | Soft-hide related notifications without deleting unrelated history | Proven |
| Dismissed still-breached Benchmark | Dismissal is visibility only; valid reconciliation may recreate one scoped active alert | Proven locally |
| Missing linked Benchmark from notification | Fail closed and hide active notification row | Proven locally |
| Benchmark alert email provider accepts send | Record acceptance/audit state; do not call it delivered without provider event or inbox receipt | Proven locally; delivery external |
| Non-current platform create alias creates breached Benchmark | Alias must complete scoped in-app alert reconciliation before response | Proven locally by Current Commit 1 regression |
| Mock industry lookup returns a value | Do not treat as production industry-standard Benchmark proof | Documented non-certified path |
| Live GA4 processing delay | Later refetch may change source values; do not treat delay as local calculation bug without provider evidence | External caveat |

## Test Coverage Matrix

Local test evidence is Benchmark-specific where the path affects Benchmarks. KPI-only evidence is not reused as Benchmark proof.

Focused validation recorded June 29, 2026 and rerun June 30, 2026 during strict clean-certification revalidation:

`npm test -- server/benchmark-math.test.ts server/ga4-benchmark-regression.test.ts server/ga4-kpi-benchmark-roas-regression.test.ts server/ga4-kpi-benchmark-summary-regression.test.ts server/benchmark-alert-lifecycle-regression.test.ts server/benchmark-route-isolation-regression.test.ts server/notification-visibility-regression.test.ts server/alert-email-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-scheduler-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-retry-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts`

Current rerun result after Current Commit 3 local implementation: 18 test files passed, 139 tests passed. `npm run check` also passed.

Current Commit 5 focused validation on June 30, 2026: `npm test -- server/benchmark-alert-email-delivery-validation-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-retry-regression.test.ts` passed: 6 test files, 30 tests. `npm run check` also passed.

| Coverage area | Test / validation source | What it proves for Benchmarks | Remaining gap |
| --- | --- | --- | --- |
| Metric-aware Benchmark math | `server/benchmark-math.test.ts` | progress/status direction, lower-is-better cost metrics, zero/invalid target handling, blocked/insufficient exclusions | Does not prove GA4 provider data accuracy |
| GA4 Benchmark visible/current-value behavior | `server/ga4-benchmark-regression.test.ts` and GA4 tab route/UI trace | GA4 platform Benchmark current values, list/create/edit/delete behavior, blocked/insufficient states, accessible edit/delete controls, browser-PDF source path, and industry helper target classification are locally pinned | Future UI changes require fresh validation |
| ROAS ratio semantics | `server/ga4-kpi-benchmark-roas-regression.test.ts` | ROAS uses ratio `x` semantics for GA4 KPI/Benchmark shared financial path | Does not prove future source ROAS paths |
| Benchmark summary/tracker | `server/ga4-kpi-benchmark-summary-regression.test.ts` | tracker counts and averages exclude blocked/insufficient rows | Does not prove future UI redesigns |
| Alert lifecycle | `server/benchmark-alert-lifecycle-regression.test.ts` | one active alert, stale resolution, deletion/disable behavior, dismissed still-breached recreation | Future provider email delivery remains per-send evidence |
| Route isolation/access | `server/benchmark-route-isolation-regression.test.ts` | campaign/platform route isolation, guarded access, and platform create alias alert reconciliation ordering | Alias timing covered locally; provider/deployed evidence remains separate |
| Commit 2/3/4 provider validation support | `server/ga4-benchmark-provider-validation-regression.test.ts` plus deployed endpoint evidence | campaign-scoped validation route reads requested provider, scheduler/current-value provider, persisted daily, financial, and Benchmark inputs; compares stored Benchmark current values to scheduler/current-value-window candidates; does not mutate Benchmark rows, history, sources, alerts, notifications, or reports; token metadata may refresh only after provider auth failure; controlled deployed provider auth, validation-only token-failure simulation, validation-window alignment, and final current-value-window evidence passed | Future GA4 provider windows, outages, delayed attribution cases, or real unsimulated token-revocation events require fresh evidence |
| Notification visibility | `server/notification-visibility-regression.test.ts` | stale/orphan/cross-campaign/non-breaching notifications fail closed; GA4 deep links and no-store freshness | Browser notification UI not rerun after this doc-only update |
| Immediate email route behavior | `server/alert-email-regression.test.ts`, `server/alert-email-immediate-route-regression.test.ts` | immediate Benchmark email attempts, audit semantics, no false delivery claims in local code | Future sends still need per-send provider/inbox evidence before delivery is claimed |
| Benchmark alert email delivery validation endpoint | `server/benchmark-alert-email-delivery-validation-regression.test.ts` plus user-confirmed deployed validation | read-only Benchmark-scoped audit evidence endpoint is access-guarded, filters exact Benchmark alert email rows, exposes provider response/delivery status, and does not send or mutate email records; controlled deployed provider/inbox validation passed by user confirmation | Exact raw endpoint JSON and inbox metadata were not pasted into this chat |
| Email idempotency/retry/scheduler | `server/alert-email-idempotency-regression.test.ts`, `server/alert-email-scheduler-regression.test.ts`, `server/alert-email-delivery-regression.test.ts`, `server/alert-email-retry-regression.test.ts` | dedupe, retry, scheduler email audit behavior, provider acceptance handling | Future provider event/inbox confirmation remains per-send evidence, not a blanket guarantee |
| Report consumers | `server/ga4-kpi-report-consumer-regression.test.ts` plus report route trace and user-confirmed deployed preflight validation | GA4 scheduled/test/manual snapshot/direct PDF paths run GA4 preflight before report output; Benchmark-section reports require selected Benchmark rows to be recomputed before PDF/snapshot/email continues; controlled deployed preflight validation passed with recompute and no duplicate history | Future report-output changes require fresh evidence |
| Scheduler/runtime observability | `server/ga4-scheduler-observability-regression.test.ts`, `server/ga4-daily-scheduler-regression.test.ts` plus user-confirmed deployed manual trigger response | `/health/scheduler` exposes GA4 daily scheduler status; report scheduler metrics update on each check; report send-event evidence endpoint is guarded and read-only; campaign-scoped manual GA4 daily scheduler validation trigger is access-guarded, suppresses global alert sweeps, and passed deployed validation for the controlled campaign | Daily timer firing by itself was not separately observed; do not claim timer-fired evidence |
| Auto-refresh and scheduler recompute | `server/ga4-auto-refresh-regression.test.ts`, `server/campaign-scheduler-current-value-regression.test.ts`, `server/ga4-kpi-financial-window-regression.test.ts` | GA4 refresh/scheduler paths run Benchmark recompute before alert/report consumers where covered; scheduler updates Benchmark current values and does not insert duplicate same-date Benchmark history when older report dates are reprocessed | Manual deployed scheduler validation passed; daily timer firing by itself was not separately observed |
| Source lifecycle recompute | `server/ga4-source-lifecycle-recompute-regression.test.ts` | revenue/spend source changes recompute GA4 Benchmark current values before covered alert checks | Live source-provider correctness external |
| Existing damaged-data cleanup | dry-run/apply/post-apply cleanup evidence recorded in this file | known persisted ROAS percent-style rows corrected only inside proven boundary; 0 remaining candidates after apply | Skipped rows remain intentionally unmodified because exact boundary was unproven |
| Deployed/UI validation | Current Commit 6 local guard plus user-confirmed deployed Render browser pass on July 1, 2026 | local browser-facing source path is pinned; deployed GA4 Benchmarks tab loaded and visible edit/delete controls were user-confirmed after commit `69ea9505` | Raw screenshots/network traces are not locally visible; future UI changes require a fresh pass |
| Industry target source classification | `server/ga4-benchmark-regression.test.ts` | industry route responses are labeled helper/uncertified; GA4 modal refuses auto-fill unless `targetSourceCertified: true`; visible copy no longer claims industry-standard targets | No certified production industry dataset exists |

Coverage rule:

- If a future answer needs provider delivery, timer-fired scheduler proof, or a new live GA4 API date window, the local test run is not enough.
- If a future code change affects any matrix row above, rerun or extend tests for the changed row before repeating the production-ready answer.

## Documentation Alignment Check

| Source doc | Alignment result | Status |
| --- | --- | --- |
| `AGENTS.md` | This file separates proven, partially reviewed, external, and deferred paths; does not use past claims as evidence | Aligned |
| `ARCHITECTURE_USER_JOURNEY.md` | GA4 Benchmarks remain inside the campaign-level platform analytics journey: client -> campaign -> connect GA4/source data -> analyze -> act | Aligned |
| `PRODUCTION_READINESS.md` | Includes value inventory, lifecycle matrix, downstream matrix, negative cases, test evidence, cleanup boundary, current commits, and external caveats | Aligned |
| `GA4/README.md` | Treats GA4 docs as canonical and does not redesign platform/user journey | Aligned |
| `GA4_DEVELOPMENT_WORKFLOW.md` | Preserves source checklist discipline for revenue, spend, scheduler, provenance, and downstream propagation | Aligned |
| `GA4/BENCHMARKS.md` | Certification follows the documented Benchmark tab contract and current metric semantics | Aligned after ROAS ratio/copy fixes |
| `GA4/KPIS_PRODUCTION_READINESS.md` | Uses KPI readiness only as structure/process template; not as Benchmark proof | Aligned |
| `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md` | Uses threshold/scoring history only where Benchmark math/status path is directly shared and tested | Aligned |
| `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` | Uses alert/notification lifecycle rules for Benchmark-specific alert paths; does not reuse KPI provider delivery as Benchmark delivery proof | Aligned |
| `GA4/FINANCIAL_SOURCES.md` | Revenue/spend inputs, Pipeline Proxy exclusion, UTC source windows, active source behavior, and additive imported revenue are treated as upstream dependencies | Aligned |
| `GA4/REFRESH_AND_PROCESSING.md` | Scheduler/reprocess paths are treated as required Benchmark current-value propagation paths | Aligned |

Known doc caveat:

- This file records closed-beta readiness for the exact August 2 revision while production certification and future-platform readiness remain `UNVERIFIED`.

## Historical Current Commit Queue (Commits 0-7)

The queue below is historical evidence for the July certification packet. The only active queue is Benchmark Current Commits 11-15 in the controlling status above.

- Current Commit 0 is implemented by this file rewrite and is required for clean future certification answers.
- Current Commit 1 is implemented: the non-current create alias now awaits in-app Benchmark alert reconciliation before responding.
- Current Commit 2 is complete for the controlled live provider/current-value-window validation recorded below.
- Current Commit 3 is complete for the controlled provider auth and validation-only refresh-failure paths.
- Current Commit 4 and Current Commit 4 Follow-Up are complete for validation-window alignment, report preflight, no duplicate history, and the accepted manual scheduler-validation path.
- Current Commits 5, 6, and 7 are complete for the controlled email, UI, and industry-target-source decisions recorded below.
- No Current Commit blockers remain open for the current GA4 Benchmarks certification scope.

### Current Commit 0 - Rewrite GA4 Benchmarks Readiness Into Strict Certification Document

Root cause:

Prior Benchmark readiness documentation mixed completed fixes, partial audit notes, historical threshold evidence, alert/notification evidence, and certification language. That made it possible for a future chat to repeat a production-ready answer without first checking the complete Benchmark value inventory, downstream propagation, lifecycle paths, negative cases, cleanup boundary, and external caveats.

Files expected:

- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`

Required behavior:

- The document must be the canonical GA4 Benchmark readiness source.
- It must use the same certification discipline as `GA4/KPIS_PRODUCTION_READINESS.md`.
- It must include all required sections: anti-overclaim rule, purpose, current status, durable future-chat answer, use instructions, reading order, current scope, prior confusion/root cause, non-negotiable rules, complete value inventory, end-to-end trace matrix, downstream matrix, lifecycle matrix, negative-case matrix, test matrix, documentation alignment, Current Commits, external caveats, and future-platform template.
- It must not use KPI readiness as Benchmark proof.
- It must not imply provider/deployed evidence that has not been validated.

Validation:

- Read required source docs in the requested order.
- Inspect the updated document headings and content for the required structure.
- Run markdown/diff hygiene validation (`git diff --check -- GA4/BENCHMARKS_PRODUCTION_READINESS.md`).
- Do not run runtime tests solely for this documentation rewrite unless the document update changes runtime code; it does not.

Implementation status:

Implemented. Runtime behavior unchanged.

### Current Commit 1 - Harden Or Classify The Non-Current Platform Benchmark Create Alias

Root cause:

The current GA4 Benchmarks tab creates rows through `POST /api/benchmarks`, which awaits in-app Benchmark alert reconciliation and immediate Benchmark email checks. Before Current Commit 1, the non-current alias `POST /api/platforms/:platformType/benchmarks` was campaign-access guarded and awaited immediate Benchmark email checks, but started in-app Benchmark alert reconciliation fire-and-forget. That could return before an immediately breached Benchmark's in-app alert state was reconciled if the alias became a current UI/API caller.

Files expected:

- `server/routes-oauth.ts`
- `server/benchmark-route-isolation-regression.test.ts` or a narrowly named new Benchmark alias regression test, if a new test is clearer
- this file, to record whether the alias is hardened or formally classified as guarded legacy

Required behavior:

- If the alias is retained as a current or externally supported create route, it must await the same in-app Benchmark alert reconciliation semantics as `/api/benchmarks` before responding.
- It must preserve existing campaign access checks, platform/campaign scoping, response shape, email attempt behavior, and error handling.
- It must not broaden the alias to campaign-level Benchmarks or unrelated platforms.
- If the alias is confirmed unreachable and intentionally legacy, document that reachability and keep it guarded; do not remove it without a separate route-deprecation audit.

Validation:

- Add or extend a regression proving that creating a breached GA4 Benchmark through the alias completes scoped in-app alert reconciliation before the response, or proving the alias is non-current guarded legacy.
- Re-run route isolation and alert lifecycle tests affected by the change.
- Verify current GA4 UI still uses `/api/benchmarks` and remains unchanged.

Implementation status:

Implemented. The alias is retained and now awaits the same in-app Benchmark alert reconciliation semantics before responding, while preserving existing campaign access checks, platform/campaign scoping, response shape, and immediate email attempt behavior.

### Current Commit 2 - Prove Live GA4 Provider Accuracy And Processing Freshness For Benchmark Inputs

Root cause:

Local tests and code traces prove formulas and source routing, but they do not prove that live GA4 provider responses for a real connected property match the values used by the GA4 Benchmarks tab, persisted recompute job, notifications, and reports. GA4 processing latency can also make a value temporarily unavailable or delayed without being a local calculation bug.

The narrower local root cause for this Current Commit was a proof-surface gap: existing GA4 diagnostics reported acquisition totals and warnings, but did not return a Benchmark-specific inventory that shows live provider totals, persisted daily fallback inputs, financial source inputs, stored Benchmark current values, scheduler-candidate current values, and UI-candidate current values together for the same campaign/property/date window.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record exact campaign/property/date-range evidence after validation
- optional validation note or runbook file if the project keeps deployed validation artifacts separately

Required behavior:

- For a controlled GA4 campaign/property/date range, verify live provider values for users, sessions, pageviews, conversions, engagement rate, GA4 native revenue, imported GA4 revenue, spend, ROAS, ROI, CPA, conversion rate, and any selected Benchmark row using those inputs.
- Expose a validation-support path that is campaign-access guarded and reports live provider totals, persisted daily inputs, active imported revenue/spend inputs, stored Benchmark current values, scheduler-candidate current values, and UI-candidate current values without mutating Benchmark rows, history, alerts, notifications, reports, or source records. Token metadata may refresh only as part of Current Commit 3 auth-failure handling.
- Confirm the same source window and campaign/property filter used by the UI is visible beside the scheduler/recompute source window for persisted Benchmark current values; where UI and scheduler windows intentionally differ, record that distinction instead of hiding it.
- Document GA4 processing-latency expectations: what is considered normal delay, what must fail closed, and what must not be called a local defect without provider evidence.
- If provider values differ from local outputs, lower the affected Benchmark path to unproven and add a narrower runtime fix commit before certification.

Validation:

- Local regression: `npm test -- server/ga4-benchmark-provider-validation-regression.test.ts`.
- Live provider evidence capture path: `GET /api/campaigns/<campaignId>/ga4-benchmark-provider-validation?propertyId=<propertyId>&startDate=<YYYY-MM-DD>&endDate=<YYYY-MM-DD>` in an authenticated tenant session with a real GA4 property.
- Capture live GA4 provider request/response evidence for the exact campaign, property, filter, and date range used.
- Compare provider totals to visible Benchmark card current values and persisted Benchmark current values after recompute.
- Validate blocked/insufficient behavior for a missing or delayed provider value.
- Re-run the focused Benchmark test suite after any code change caused by this validation.

Implementation status:

Complete for the controlled live provider/current-value-window validation path. Deployed Commit 2 validation first failed with `provider.status = live_provider_error` and `401 UNAUTHENTICATED` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, campaign filter `yesop_email_nurture` + `yesop_retargeting` + `yesop_paid_social`, and requested provider window `2026-06-19` through `2026-06-29`. Commit 3 cleared the live provider auth blocker. Current Commit 4 proved the earlier `12376.38` versus `21922.96` comparison was a validation-window defect, not stale Benchmark data.

Final deployed Current Commit 2 validation on July 1, 2026 used requested provider window `2026-06-19` through `2026-06-30`, current-value window `2026-06-24` through `2026-06-30`, and financial window `1900-01-01` through `2026-07-01`. The response returned `provider.status = live_provider_success`, `currentValueProvider.status = live_provider_success`, non-null provider totals, persisted daily `rowCount = 10`, current-value persisted daily `rowCount = 6`, latest daily date `2026-06-30`, and latest persisted update `2026-07-01T10:27:27.578Z`. The controlled Benchmark rows matched exactly: Total Conversions stored `84.00` versus scheduler candidate `84` with `storedVsSchedulerDelta = 0`, and Benchmark Revenue stored `14669.58` versus scheduler candidate `14669.58` with `storedVsSchedulerDelta = 0`. This closes Current Commit 2 for the current GA4 Benchmarks certification scope.

### Current Commit 3 - Prove Deployed OAuth Token Refresh And Tenant Failure Handling

Root cause:

Local code traces showed token refresh branches in other GA4 paths, but deployed Commit 2 validation proved the GA4 Benchmark provider validation path itself failed with `401 UNAUTHENTICATED` instead of refreshing the campaign/property-scoped OAuth token and retrying. That made the validation tool unable to prove live GA4 provider accuracy for the selected Benchmark input window.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record exact deployed validation evidence
- optional deployed validation runbook/artifact if the project keeps one

Required behavior:

- A deployed GA4 Benchmark provider validation path with an expired access token and valid refresh token must refresh, persist updated token metadata, and retry using the same campaign/property/filter/date window.
- A revoked, missing, or invalid refresh token must fail closed with `provider.status = live_provider_refresh_failed` and must not substitute unrelated property/account/campaign data.
- The validation path must not mutate Benchmark rows, Benchmark history, sources, alerts, notifications, reports, or source records.
- The visible tab, scheduler/recompute, notification freshness, and report preflight paths must either use valid refreshed data or expose/hide unavailable values without misleading Benchmark results.

Validation:

- Run the deployed validation endpoint again for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `startDate=2026-06-19`, and `endDate=2026-06-29` after this fix is deployed.
- Confirm the response returns `provider.status = live_provider_success_after_refresh` or `live_provider_success`, includes non-null `provider.totals`, and keeps the same campaign/property/filter/window.
- Confirm refreshed token persistence and unchanged campaign/property scope.
- Run or observe GA4 Benchmark list/current-value, scheduler/recompute, notification freshness, and report preflight behavior after refresh.
- Capture failure behavior through the validation-only `simulateRefreshFailure=1` path so the endpoint returns `provider.status = live_provider_refresh_failed`, `provider.totals = null`, `simulation.refreshFailure = true`, and no token refresh or token metadata update is attempted.

Implementation status:

Implemented, deployed, and validated for the controlled provider-access blocker and validation-only refresh-failure path. Deployed revalidation returned `provider.status = live_provider_success` and non-null provider totals for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, requested provider window `2026-06-19` through `2026-06-29`, and the expected campaign filter. The validation-only `simulateRefreshFailure=1` response returned `success = true`, `simulation.refreshFailure = true`, `provider.status = live_provider_refresh_failed`, `provider.totals = null`, and the explicit error `Simulated GA4 token refresh failure for validation; no token refresh was attempted and no token metadata was changed.` This closes Current Commit 3 for the controlled validation path without damaging the real GA4 connection.

### Current Commit 4 - Align Validation Candidates To The Scheduler Current-Value Window

Root cause:

The deployed validation endpoint correctly exposed live provider totals, persisted daily totals, financial inputs, and stored Benchmark values side by side. However, it used the manually requested provider window as the source for `schedulerCandidateCurrentValue` and `uiCandidateCurrentValue`. That overcompared stored Benchmark current values against a window the actual scheduler does not use. `runGA4DailyKPIAndBenchmarkJobs` computes persisted GA4 Benchmark current values from the campaign start/creation date through the selected complete end date, plus the GA4 financial source window. Therefore the apparent `12376.38` versus `21922.96` mismatch was a validation-window defect, not proven damaged Benchmark data.

Files expected:

- `server/routes-oauth.ts`
- `server/ga4-benchmark-provider-validation-regression.test.ts`
- this file, to record the RCA and deployed revalidation evidence

Required behavior:

- The validation endpoint must keep the requested provider window visible for provider freshness evidence.
- It must also expose a separate `sourceWindows.currentValue` window matching the scheduler/current-value window.
- `schedulerCandidateCurrentValue` and `uiCandidateCurrentValue` must be computed from the current-value window, not from an arbitrary requested provider window.
- The endpoint must not mutate Benchmark rows, Benchmark history, sources, alerts, notifications, reports, or source records.
- Token metadata may still refresh only after provider auth failure, as established in Current Commit 3.

Validation:

- Rerun the deployed validation endpoint for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, `startDate=2026-06-19`, and `endDate=2026-06-29` after this fix is deployed.
- Confirm `sourceWindows.provider` remains `2026-06-19` through `2026-06-29`.
- Confirm `sourceWindows.currentValue` starts at the campaign start/creation date and ends at `2026-06-29`.
- Confirm `currentValueProvider.totals` is non-null, `inputSets.schedulerInputSource` is `live_provider_current_value_window` or an explicit current-value persisted fallback, and stored deltas are evaluated against that current-value window.
- If a delta remains after the window correction, only then classify it as a stored Benchmark current-value freshness/recompute bug and add the next smallest fix.
- Deployed scheduler execution and report-preflight runtime behavior still need separate evidence after this validation-window fix.

Implementation status:

Implemented, pushed, deployed, and revalidated for validation-window alignment. Deployed evidence for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, requested provider window `2026-06-19` through `2026-06-29`, and current-value window `2026-06-24` through `2026-06-29` returned `currentValueProvider.totals` as non-null. Stored Benchmark Revenue `12376.38` matched `schedulerCandidateCurrentValue` `12376.38` with `storedVsSchedulerDelta = 0`. `uiCandidateCurrentValue` was `12376.39`, a one-cent persisted-daily rounding difference from provider totals, not proven Benchmark damage. This endpoint still does not recompute or update Benchmark rows.

### Current Commit 4 Follow-Up - Prove Deployed Scheduler And Report-Preflight Benchmark Recompute

Root cause:

The validation-window fix proved the controlled endpoint compared stored Benchmark current values against the correct scheduler/current-value window, but the scheduler/report proof was still too broad in two places:

- `runGA4DailyKPIAndBenchmarkJobs` returned only `benchmarksRecorded`, which counts newly inserted history rows, not Benchmark rows whose `currentValue` was actually refreshed. Report preflight could therefore prove only that the campaign was processed, not that Benchmark-section rows selected for report output were recomputed.
- Benchmark history de-duplication checked only the latest history row. If an older report date was reprocessed after newer history existed, the job could insert another history row for the same Benchmark/date.

The deployed follow-up RCA found an additional proof-surface gap, not a Benchmark calculation defect:

- GA4 daily scheduler runtime state was observable only through stdout logs. Render log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines, which did not prove the scheduler failed but also did not prove the timer ran.
- `/health/scheduler` exposed report scheduler metrics only; it did not expose GA4 daily scheduler timer state, next run, last trigger, or run counts.
- Report scheduler health fields `totalChecks` and `lastCheckTime` existed but were not updated inside `checkScheduledReports`, so the health endpoint could not prove the scheduled-send checker was actually running.
- `report_send_events` held scheduled-send runtime evidence, but there was no report-access-guarded read-only endpoint to inspect it for a specific scheduled GA4 Benchmark report without direct database access.
- After `/health/scheduler` showed `timerScheduled = true` but `totalRuns = 0`, there was no safe campaign-access-guarded manual validation trigger to run the same deployed GA4 daily refresh plus KPI/Benchmark recompute path without waiting for the next daily timer. A global unauthenticated or all-campaign trigger would have been unsafe because it could mutate unrelated campaign rows and alert state.

Files expected:

- `server/ga4-kpi-benchmark-jobs.ts`
- `server/report-scheduler.ts`
- `server/ga4-daily-scheduler.ts`
- `server/index.ts`
- `server/routes-oauth.ts`
- `server/ga4-kpi-financial-window-regression.test.ts`
- `server/ga4-kpi-report-consumer-regression.test.ts`
- `server/ga4-daily-scheduler-regression.test.ts`
- `server/ga4-scheduler-observability-regression.test.ts`
- this file, to record exact scheduler/report-preflight evidence
- optional scheduler/deployment validation artifact if the project keeps one

Required behavior:

- The deployed GA4 daily scheduler must run `runGA4DailyKPIAndBenchmarkJobs` for eligible campaigns and update only the intended campaign/property-scoped GA4 Benchmark rows.
- `runGA4DailyKPIAndBenchmarkJobs` must expose which Benchmark row IDs were updated so report preflight can verify Benchmark-section rows instead of accepting only `campaignsProcessed > 0`.
- Scheduler and report preflight must fail closed when the campaign, property, source context, or selected Benchmark recompute cannot be verified.
- Scheduled/server report outputs must use successfully recomputed Benchmark rows or skip/fail without creating misleading sent/downloadable output.
- Duplicate processing must not produce duplicate Benchmark history rows for the same Benchmark/date, including reprocessing an older date after newer history exists.
- `/health/scheduler` must expose read-only GA4 daily scheduler status, including timer scheduled state, configured schedule, next run, last run trigger/status, and run counts.
- Report scheduler health metrics must update on each scheduled check so deployed runtime observation does not depend only on log search.
- Report send-event evidence must be readable through a report-access-guarded, read-only endpoint that does not send, retry, recompute, snapshot, or mutate report rows.
- A manual deployed validation trigger, if used instead of waiting for the timer, must require campaign access, run only the authorized campaign's GA4 daily refresh plus KPI/Benchmark recompute path, update the same GA4 daily scheduler status fields, and suppress global alert sweeps to avoid cross-campaign side effects.

Validation:

- Local focused validation: `npm test -- server/ga4-kpi-financial-window-regression.test.ts server/ga4-kpi-custom-preservation-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-auto-refresh-regression.test.ts server/ga4-source-lifecycle-recompute-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts server/ga4-benchmark-provider-validation-regression.test.ts` passed on June 30, 2026: 8 files, 35 tests. `npm run check` also passed.
- The scheduler regression proves Benchmark `currentValue` updates are counted in `benchmarksUpdated`/`benchmarkIdsUpdated` and same-date history is not reinserted when the target date is not the latest history row.
- The report-preflight regression proves GA4 Benchmark-section reports inspect selected Benchmark rows, require `benchmarkIdsUpdated`, and fail closed with `GA4 Benchmark recompute skipped selected Benchmark rows` before scheduled/test/manual/direct report output continues.
- Deployed manual snapshot/report-preflight validation passed on June 30, 2026: `snapshotStatus = 200`, report type `benchmarks`, `passedPreflight = true`, `recomputedBenchmark = true`, `noDuplicateHistory = true`, Benchmark `updatedAt` changed from `2026-06-30T12:16:31.780Z` to `2026-06-30T18:11:34.767Z`, and history count stayed `5 -> 5`.
- Deployed scheduler-log search returned no matching `[GA4 Daily] Pipeline starting`, `[GA4 Daily] Refresh done`, or `[GA4 Daily] Pipeline done` lines. This is not proof the scheduler failed, but it is also not proof the daily scheduler timer ran.
- Local observability validation on June 30, 2026: `npm test -- server/ga4-scheduler-observability-regression.test.ts server/ga4-daily-scheduler-regression.test.ts server/ga4-kpi-report-consumer-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts server/alert-email-scheduler-regression.test.ts` passed: 5 files, 23 tests. `npm run check` also passed.
- Local manual-trigger validation on July 1, 2026: `npm test -- server/ga4-scheduler-observability-regression.test.ts server/ga4-daily-scheduler-regression.test.ts` passed: 2 files, 8 tests. `npm run check` also passed. This proves the route is campaign-access guarded, calls `runGA4DailyRefreshPipeline({ campaignId, suppressAlerts: true })`, reports before/after scheduler status, and does not call the global alert sweep from the route.
- Deployed `/health/scheduler` evidence captured July 1, 2026 at `2026-07-01T08:46:39.004Z`: report scheduler `schedulerStartedAt = 2026-06-30T20:18:16.607Z`, `cronSchedule = * * * * *`, `totalChecks = 748`, `lastCheckTime = 2026-07-01T08:46:00.007Z`, `lastCheckFinishedAt = 2026-07-01T08:46:06.019Z`, `lastScheduledReportsFound = 14`, `lastDueReportsFound = 12`, `lastError = null`; GA4 daily scheduler `started = true`, `timerScheduled = true`, `runOnStartup = false`, `nextRunAt = 2026-07-01T12:15:00.000Z`, `nextDataThroughDate = 2026-06-30`, `lastRunStatus = idle`, and `totalRuns = 0`.
- Deployed report send-event evidence captured for GA4 Benchmark report `eae94163-5608-4590-8dcd-7d927ba6b421`: `scheduledSendObserved = true`, `sentEventObserved = false`, `latestStatus = pending_delivery`, event `4db453e7-81e6-468a-9250-fe4bf0cd42a5`, `scheduledKey = 2026-07-01T09:00@Europe/Amsterdam`, `createdAt = 2026-07-01T07:02:05.251Z`, `recipientCount = 1`, `snapshotId = null`, `sentAt = null`, and error text `Mailgun accepted the email, but delivery was not confirmed yet`.
- Deployed manual scheduler-validation trigger passed on July 1, 2026 for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`: `success = true`, `beforeManualRuns = 1`, `afterManualRuns = 2`, `lastRunTrigger = manual`, `lastRunStatus = success`, and `lastError = null`. This proves the deployed campaign-scoped GA4 daily refresh plus KPI/Benchmark recompute pipeline can run on demand through the guarded validation trigger. It does not prove the daily timer fired by itself.

Implementation status:

Implemented and validated for the scheduler/report-preflight code path, observability support path, and controlled deployed manual scheduler-validation path. Deployed manual snapshot/report-preflight validation already passed for the controlled GA4 Benchmark report. The observability support exposes GA4 daily scheduler state through `/health/scheduler`, makes report scheduler health metrics update on each check, adds a guarded read-only report send-event endpoint, and adds a campaign-access-guarded manual GA4 daily scheduler validation trigger. Deployed evidence on July 1, 2026 proved the report scheduler checker was running, a controlled GA4 Benchmark report send event was created, the GA4 daily scheduler timer was scheduled, and the guarded manual trigger successfully ran the deployed campaign-scoped GA4 daily refresh plus KPI/Benchmark recompute path. The daily timer firing by itself is still not separately proven and must not be claimed.

### Current Commit 5 - Prove Benchmark Alert Email Provider Delivery And Inbox Receipt

Root cause:

Local code and tests prove Benchmark alert email attempt, audit, idempotency, retry, and provider-acceptance semantics. They do not prove provider-confirmed delivery or actual inbox receipt for a GA4 Benchmark alert email. Provider/API acceptance is not delivery.

The narrower local root cause for this Current Commit was an evidence-surface gap: the app records Benchmark alert email audit rows in `email_alert_events`, but there was no Benchmark-scoped, campaign-access-guarded read-only endpoint to inspect the latest Benchmark alert email audit state in production without sending or mutating email records. That made it too easy to infer delivery from provider acceptance or from unrelated UI behavior.

Files expected:

- `server/routes-oauth.ts`
- `server/benchmark-alert-email-delivery-validation-regression.test.ts`
- optional email validation artifact if the project keeps one
- this file, to record exact provider/inbox evidence

Required behavior:

- A controlled breached GA4 Benchmark with email notifications enabled must produce the expected immediate or scheduled email attempt.
- Provider acceptance must be recorded as accepted/pending, not delivered, unless a provider delivery event confirms delivery.
- The validation endpoint must be read-only, Benchmark-access guarded, filter `email_alert_events` to `kind = alert`, `entityType = benchmark`, and the exact Benchmark ID, and must not send, retry, update, insert, or delete email/Benchmark/notification/report rows.
- A confirmed provider delivery event or controlled inbox receipt must be recorded before anyone claims Benchmark alert email delivery.
- Failed, bounced, delayed, or unconfirmed sends must remain visible as unconfirmed/failed and must not be described as delivered.

Validation:

- Local regression: `npm test -- server/benchmark-alert-email-delivery-validation-regression.test.ts server/alert-email-delivery-regression.test.ts server/alert-email-audit-regression.test.ts server/alert-email-immediate-route-regression.test.ts server/alert-email-idempotency-regression.test.ts server/alert-email-retry-regression.test.ts`.
- Deployed evidence capture path after deploy: `GET /api/benchmarks/<benchmarkId>/alert-email-delivery-validation` in an authenticated tenant session.
- Trigger a controlled GA4 Benchmark breach with known recipients before reading the endpoint, or use a previously triggered Benchmark alert email if the audit row is unambiguous.
- Verify the response has `certificationStatus = validation_output_only`, the exact `benchmarkId`, latest `deliveryStatus`, `providerResponseId`, recipient count, and `providerDeliveryProven` value.
- Provider delivery is proven only when the exact Benchmark audit row has `deliveryStatus = delivered` and non-null `deliveredAt`; `accepted` or `pending_delivery` remains not delivered.
- Capture actual inbox receipt separately, or explicitly state inbox receipt remains unproven.
- Re-run focused alert-email tests after any runtime code change.

Implementation status:

Complete for the controlled Current Commit 5 validation. The local code exposes a read-only Benchmark-scoped alert email delivery validation endpoint and regression coverage proving it is access-guarded, audit-only, filtered to the exact Benchmark alert email rows, and does not mutate or send email. The deployed validation and inbox receipt were user-confirmed as passed on June 30, 2026. Exact endpoint JSON, provider response ID, delivered timestamp, recipient, subject, and received time were not pasted into this chat, so future audits should treat those raw details as externally confirmed but not locally visible in this transcript. This closes Current Commit 5 for the controlled GA4 Benchmark alert email proof, but it is not a blanket guarantee that every future Benchmark alert email is delivered; each future delivery claim still requires provider/inbox evidence.

### Current Commit 6 - Browser And Deployed UI Validation For The GA4 Benchmarks Tab

Root cause:

The blocker was an evidence and browser-operability gap, not a proven Benchmark calculation defect. Local code trace covered the helper/value logic, but there was no current authenticated deployed browser pass for the GA4 Benchmarks tab. RCA also found the GA4 Benchmark edit/delete icon buttons lacked stable accessible labels/titles, unlike the GA4 KPI icon buttons, so browser validation and assistive technology had to identify them by position/icon instead of a control name. The traced path did not show a need to change calculations, source scoping, alert logic, notification logic, scheduler behavior, email behavior, or API response contracts.

Files expected:

- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-benchmark-regression.test.ts`
- this file, to record exact local and deployed/browser evidence
- no manual-test artifact unless deployed/manual browser evidence is recorded there

Required behavior:

- The GA4 Benchmarks tab must render without blocking errors for a campaign with connected GA4.
- List, create, edit, delete, blocked state, insufficient state, current-value display, tracker counts, alert settings, notification deep link, and browser PDF Benchmark output must behave as documented.
- ROAS must display as an `x` ratio, ROI as percent, CPA as currency, and financial/revenue/spend dependency gates must match the documented source state.
- The Benchmark edit/delete icon buttons must have stable accessible names so browser validation can target the intended controls without relying on visual position.
- The UI must not show misleading connected/production-ready states when sources are missing, delayed, or unavailable.

Validation:

- Local validation run on July 1, 2026: `npm test -- server/ga4-benchmark-regression.test.ts` passed 1 test file and 10 tests.
- The new local guard pins the current GA4 route, `benchmarks` tab, campaign-scoped Benchmark read route, create/update/delete mutations, notification invalidation after lifecycle changes, blocked/insufficient UI states, ROAS/ROI/CPA unit rendering, accessible edit/delete controls, and browser-PDF Benchmark source path.
- Deployed Render browser validation was user-confirmed passed on July 1, 2026 for `https://marketforensics.onrender.com/campaigns/8aa735ee-c02f-41e2-bb1f-7c3f43bb9458/ga4-metrics?tab=benchmarks` after commit `69ea9505` deployed. The confirmed pass covers the GA4 Benchmarks tab loading, existing Benchmark visibility/value sanity, edit control opening the modal, and delete control opening the confirmation dialog without deleting production data.
- The deployed delete validation intentionally stopped at opening the confirmation dialog and cancelling/avoiding deletion; this is sufficient for browser-control validation without mutating production Benchmark data.
- Raw browser screenshots, console output, network traces, and PDF artifact were not pasted into this chat; future audits should treat the deployed browser result as user-confirmed evidence for this controlled pass, not locally inspected raw evidence.

Implementation status:

Complete for the controlled Current Commit 6 validation. Local browser-path hardening is implemented: the existing GA4 Benchmark edit/delete icon buttons now expose `title` and `aria-label` attributes, and focused regression coverage pins the current browser-facing Benchmark path without changing calculations, API contracts, scheduler behavior, alerts, notifications, emails, or source scoping. The deployed Render GA4 Benchmarks tab pass was user-confirmed on July 1, 2026 after commit `69ea9505`. This closes Current Commit 6 for the current controlled GA4 Benchmarks browser path. It is not a blanket guarantee for future UI changes, future campaigns, or untested browser/PDF artifacts; those require their own validation evidence.

### Current Commit 7 - Decide And Certify The GA4 Industry Benchmark Target Source

Root cause:

The GA4 Benchmark modal did not expose a current industry selector, but legacy/hidden industry paths still existed. The server industry endpoint defaulted to mock values, and an existing or legacy `benchmarkType = industry` row could trigger template-switch auto-fill from `/api/industry-benchmarks/:industry/:metric`. That meant mock or internal static reference values could silently become a saved Benchmark target if an industry row was edited, even though those values were not licensed, audited, or certified as production industry benchmarks.

The smallest safe decision is the non-production-helper path. No production industry dataset was certified in this commit. No Benchmark calculations, source/current-value logic, alerts, notifications, scheduler behavior, email behavior, report behavior, campaign/property scoping, or ownership checks were changed.

Files expected:

- `server/routes-oauth.ts`
- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-benchmark-regression.test.ts`
- this file, to record the source decision and validation evidence

Required behavior:

- Industry Benchmark route responses must clearly identify helper/mock/static values as not production-certified target evidence.
- The GA4 Benchmark modal must not auto-fill `benchmarkValue` from industry helper/mock/static responses unless a future response explicitly returns `targetSourceCertified: true`.
- GA4 Benchmark visible copy must not imply that saved GA4 Benchmark targets are certified industry standards.
- User-entered Benchmark targets remain supported and unchanged.
- Legacy saved `industry` metadata may remain visible as metadata; it is not certification proof.

Validation:

- Local validation run on July 1, 2026: `npm test -- server/ga4-benchmark-regression.test.ts` passed 1 test file and 11 tests.
- Regression coverage proves `/api/industry-benchmarks/:industry/:metric` marks mock helper values with `certificationStatus = non_production_helper`, `targetSourceCertified = false`, and a demo-only disclaimer.
- Regression coverage proves internal static reference values are also returned with `certificationStatus = uncertified_static_reference` and `targetSourceCertified = false`.
- Regression coverage proves the GA4 Benchmark modal only auto-fills industry values when `data.targetSourceCertified === true` and no longer uses visible `industry standards` wording in the current Benchmark tab/modal path.

Implementation status:

Complete for the current GA4 Benchmarks product surface. Current Commit 7 classifies industry Benchmark values as non-production helper/reference data and prevents silent mock/static industry target auto-fill in the GA4 Benchmark modal. This closes the target-source blocker by choosing the non-production-helper path, not by certifying a production industry dataset. Future work may add a certified vendor/versioned industry dataset, but that would be a new Current Commit and must include source provenance, version/date, route/UI tests, and deployed validation before industry targets can be described as production-certified.

## Historical Completed Fix Evidence

The following historical fix queue is closed for the current GA4 Benchmarks tab code scope. These fixes are evidence inputs only; they do not replace the matrices above.

| Historical item | Outcome | Certification relevance |
| --- | --- | --- |
| Commit 1 - Persist GA4 Benchmark ROAS As Ratio | Implemented, committed, pushed, deployed, and validated | Closed the persisted scheduler/report/alert ROAS percent-vs-ratio blocker |
| Commit 2 - Scope GA4 Metrics To Selected Primary Property | Implemented, committed, pushed, deployed, and validated | Closed cross-property/campaign source-scope risk for GA4 current values |
| Commit 3 - Refresh UI Values After `Set as Primary` | Implemented, committed, pushed, deployed, and validated | Closed selected-property UI alignment risk after source change |
| Commit 4 - Correct GA4 ROAS Copy | Implemented, committed, pushed, deployed, and validated | Closed user-facing unit/copy mismatch |
| Commit 5 - Enforce Shared Evaluated Route Access | Implemented, committed, pushed, deployed, and validated | Closed shared evaluated KPI/Benchmark access risk |
| Commit 6 - Inventory And Repair Existing GA4 Persisted ROAS Rows | Implemented, committed, pushed, deployed, and validated | Closed known damaged-data boundary: 46 rows updated, 0 remaining repair candidates after apply |

Existing damaged-data conclusion:

- Known persisted GA4 Benchmark ROAS percent-style damage has been bounded and repaired for rows with exact source proof.
- Rows skipped during cleanup were not silently changed because they had no active GA4 primary property or no persisted GA4 daily rows proving the correction boundary.
- No additional cleanup Current Commit is required for the known ROAS defect based on the recorded post-apply dry-run result.
- If a new persisted Benchmark defect is found, lower the affected path to unproven and add a new bounded inventory/cleanup Current Commit before recertifying.

## Not Locally Verifiable / External Caveats

The items below are caveats and boundaries, not open Current Commit blockers for the current GA4 Benchmarks certification scope. RCA conclusion: none of these items block the current GA4 Benchmarks clean certification. They are documented to prevent future overclaiming and become blocking only if a future answer tries to certify that broader future claim.

| Caveat / future claim boundary | Classification | Blocks current GA4 Benchmarks certification? | RCA / why it is not a current blocker | When fresh evidence is required |
| --- | --- | --- | --- | --- |
| Future GA4 API availability, delayed attribution, or processing latency outside the recorded windows | External provider caveat | No | The controlled provider/current-value window was validated; future provider behavior is outside the recorded evidence window | Any future claim about a new date window, outage, delayed attribution case, or provider incident |
| Real Google revoked-token event without simulation | External provider caveat | No | The accepted validation-only failure path proved safe handling without mutating token metadata; an actual revoked-token event has not occurred in the recorded evidence | Any future claim that an actual revoked Google token event was observed end to end |
| Daily timer firing by itself | Scheduler caveat | No | The deployed manual trigger proved the same campaign-scoped GA4 refresh/recompute pipeline; only the timer-fired event itself remains unclaimed | Any future claim that the daily timer itself fired successfully |
| Future Benchmark alert email delivery | Provider/inbox caveat | No | The controlled Commit 5 Benchmark email/inbox validation passed; future sends are separate delivery events | Every future delivery claim needs provider delivery event or inbox evidence |
| Future source mixes or new financial source types | Future scope-change caveat | No for unchanged current GA4 scope | Current certification covers the existing GA4 source mix; new source types or changed source behavior would create a new value path | Before certifying that changed/new source path |
| Future platform Benchmark readiness | Target-platform readiness queue | No; outside GA4 scope | GA4 evidence is only a template and cannot certify Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another platform | Always required before certifying the target platform |

Provider/email wording rule:

- It is acceptable to say local code attempts and audits Benchmark alert emails correctly for covered paths.
- It is acceptable to say Current Commit 5 passed for the controlled deployed Benchmark alert email send based on user-confirmed endpoint/inbox validation.
- It is not acceptable to say any future Benchmark alert email was delivered unless provider delivery events or actual inbox receipt prove that specific send.

Production-readiness wording rule:

- It is acceptable only to say GA4 Benchmarks were clean-certified for the controlled historical July packet.
- It is not acceptable to describe the current whole tab as clean-certified until Benchmark Current Commits 11-15 and the revision-bound integrity check pass.

## Future Platform Template

GA4 Benchmark docs are a template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source, but never proof that the target platform is production-ready.

For each future platform Benchmark certification, create or update that platform's Benchmark production-readiness file with this structure:

1. Mandatory anti-overclaim rule
2. Purpose
3. Current Status
4. Durable future-chat answer
5. How to use the file in a new chat
6. Future source reading order
7. Current scope
8. Root cause of prior confusion / prior overclaim risk
9. Non-negotiable accuracy rules
10. Complete platform Benchmark value inventory
11. End-to-end trace matrix
12. Downstream propagation matrix
13. Source/lifecycle matrix
14. Negative-case matrix
15. Test coverage matrix
16. Documentation alignment check
17. Exact smallest safe fix queue organized as Current Commits
18. Current Commit details: commit title, root cause, files expected, required behavior, validation, implementation status
19. Not locally verifiable / external caveats
20. Future platform reuse/template statement

Minimum proof required for a future platform:

- selected account/property/customer/sheet/ad/campaign source scope is proven
- every visible Benchmark metric has a source, formula, window, unit, fallback, blocked state, and downstream consumer
- add/edit/delete/source-refresh/scheduler/report/email/notification paths are traced end to end
- current-value helpers and persisted recompute jobs agree on metric units
- existing damaged-data risk is inventoried and either proven absent or handled by a bounded cleanup plan
- route ownership and platform/campaign isolation are regression-covered
- negative cases fail closed and do not write misleading current values
- tests cover the platform's own source values, not only shared helper behavior
- provider/deployed/inbox evidence is either supplied or explicitly listed as external and non-certified

Do not copy the GA4 `production-ready` answer into a target platform answer. Copy only the audit shape, then replace every evidence row with target-platform proof.
