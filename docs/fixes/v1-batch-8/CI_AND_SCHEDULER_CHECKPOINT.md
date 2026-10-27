# CI and scheduler correction checkpoint - October 27, 2026

**Two bounded corrections are verified locally; the user authorized committing and pushing this packet. Hosted CI and deployment verification remain pending. Batch 8 remains IN PROGRESS and V1 remains NO-GO.** Base revision is `699a1ef6b9ee679c0fc69e394d78bddf640407fd`, confirmed deployed. This checkpoint supersedes the previous checkpoint's unverified hosted-CI diagnosis and runtime-unchanged statement only for this new candidate. No finding or release gate is closed.

## Hosted test failure: confirmed cause and correction

The [deployed revision's GitHub run](https://github.com/CrazySkillz/MF_real_latest/actions/runs/40455583623) installed packages and passed certification checks, then failed the blocking current-version test command. Its [preserved log](validation-2026-10-27-ci-scheduler/hosted-ci.log) reports 6,477 total tests, 5,143 passes, five assertion failures and 1,334 nonpassing outcomes, including 1,329 skipped or hook-aborted outcomes. The [identity inventory](validation-2026-10-27-ci-scheduler/hosted-failure-inventory.json) maps every nonpassing identity to the previous passing local result; that comparison alone is not a hosted pass.

The workflow omitted the isolated PostgreSQL service/fixture URLs and Playwright browser installation required by these tests. `npm ci --ignore-scripts` does not supply those prerequisites. A [sanitized negative reproduction](validation-2026-10-27-ci-scheduler/missing-prerequisites.json) reproduced two browser launch failures and three database hook-aborted cases, with nine passes. No application fix or relaxed assertion was needed for this failure.

Changes:

- `.github/workflows/test.yml`: ephemeral PostgreSQL 18, loopback-only port 55444, two fixture databases, empty application `DATABASE_URL`, Chromium/dependencies installed before tests, and preservation of historical test artifacts. The existing blocking current-version gate remains blocking; no dependency or production credential is added.
- `scripts/ga4-kpi-current-version-test-boundary.ts`: two workers bound test-resource use; the default reporter also prints failure causes alongside the existing machine-readable and incomplete-run checks.
- `server/v1-batch3-conversion-postgres.test.ts`: the precision fixture accepts the existing isolated port 55443 or the common fixture port 55444. Exact loopback host/database, absent query overrides and absent application database remain mandatory. [Seven actual-guard checks](validation-2026-10-27-ci-scheduler/precision-guard.json) pass, including five rejection cases.

The [workflow parse/setup check](validation-2026-10-27-ci-scheduler/workflow-check.json) passes. Configuration follows the existing dependencies and [GitHub service-container](https://docs.github.com/en/actions/tutorials/use-containerized-services/create-postgresql-service-containers) and [Playwright CI](https://playwright.dev/docs/ci-intro) setup contracts. Actual Linux-hosted execution of this candidate remains required after submission.

The actual `scripts/ga4-kpi-current-version-test-boundary.ts current` command passed in one local invocation: **6,477/6,477 tests, 382 files, zero failures/skips/incomplete-run errors**. See the [command log](validation-2026-10-27-ci-scheduler/ci-gate-tests.log) and [execution receipt](validation-2026-10-27-ci-scheduler/ci-gate-execution.json). This run completed before the four-line scheduler correction and before collection of its new test file; it is not a full-suite result for the final runtime candidate.

## Scheduler overlap: reproduced cause and correction

The four interval entry points in `server/auto-refresh-scheduler.ts` excluded other financial/interval jobs but did not exclude an ongoing GA4 pipeline. The daily pipeline keeps `__ga4DailyRefreshInProgress` set while it imports and publishes. Its internal `runDailyAutoRefreshOnce` provider stage clears `__autoRefreshInProgress` before the remaining publication stages finish. An interval could then start an ordinary financial-source refresh, whose storage write invalidates the current GA4 work through `writeGA4RefreshInputChange`. The previous owner is correctly rejected by subsequent ownership checks.

Traced path: existing interval registration -> Sheets spend/revenue or HubSpot/Salesforce interval entry -> campaign discovery and existing provider/process save path -> storage input invalidation -> daily pipeline ownership check. The reverse direction already waits on the financial/interval flags. The GA4-owned provider pass calls `runDailyAutoRefreshOnce`, not the four interval entry points.

**Runtime correction: four existing guard lines now also check `__ga4DailyRefreshInProgress`.** Intervals defer to their next existing tick while publication is busy, then resume. No calculation, source selection, response contract, lease, scope guard, database schema, UI or timeout changes. This is process-local exclusion; it does not claim cross-process coordination or explain every deployed ownership failure.

The new `server/v1-batch8-interval-publication.test.ts` executes the actual four entry points. Before the correction, the four overlap cases failed and 16 existing-exclusion/recovery cases passed ([reproduction](validation-2026-10-27-ci-scheduler/interval-before.json)). Afterward all **20/20** pass, proving no campaign discovery while GA4 is publishing, preservation of the owner's flag, resumption afterward, retained exclusion for existing busy flags, and retry after discovery failure.

Final candidate validation:

- [Focused scheduler/publication/ownership/CI/precision packet](validation-2026-10-27-ci-scheduler/scheduler-final.json): **669/669 tests across 12 files**, zero skips, including all 20 new cases and real PostgreSQL ownership/input-invalidation tests.
- [Run-error receipt](validation-2026-10-27-ci-scheduler/scheduler-final-run-errors.json): passed, no collection/hook/unhandled errors.
- [TypeScript and server build](validation-2026-10-27-ci-scheduler/final-build-checks.json): both exit zero. Client source is unchanged; no new client build is claimed.
- [Final execution receipt](validation-2026-10-27-ci-scheduler/scheduler-final-execution.json): tracked source hashes unchanged during the run, both owned fixture databases empty afterward, zero other sessions, local cluster stopped. The full CI-command run has the same cleanup guarantees.

Tests used isolated local fixtures, stripped credentials and blocked external Node HTTP. No provider writes, production mutations or personal-browser access occurred. The actual provider/network path and natural deployed refresh/recovery after this fix remain unvalidated.

## Separate deployed source failure and retained limits

Bounded production queries were enforced READ ONLY against the previously verified database target. The [verified scheduler state](validation-2026-10-27-ci-scheduler/scheduler-state-verified.json) identifies a completed publication for the report campaign (hash `de4775c3b435`). It also identifies the separate active **Campaign3** Shopify source (campaign hash `6caf32c94dbe`, source hash `428552cf603a`) with [saved renewal failure](validation-2026-10-27-ci-scheduler/shopify-failure.json) at **October 27, 05:51:42 UTC / 06:51:42 Amsterdam**: `Shopify OAuth credentials could not be renewed. Reconnect Shopify.` The saved message does not prove whether the underlying cause was revocation, expiry or a transport/provider error.

The user confirmed on October 27: **Campaign3 is redundant.** Its Shopify reconnection is therefore not required for active-campaign provider acceptance. Campaign3 and its HubSpot, Salesforce and Shopify connections remain unchanged; identifying a redundant campaign is not authorization to delete, deactivate or disconnect it. Its still-active scheduling and recorded failure remain an operational item until safely retired or recovered; the failure is not marked fixed or silently waived. The scheduler correction cannot repair provider authorization. An initial diagnostic compared serialized object key order; `scheduler-state-verified.json` corrects that comparison by matching connection IDs/fields. No runtime correction was based on the initial diagnostic.

The constant top-level `healthy` scheduler label, five previously observed resource-approval failures and complete natural recovery remain open monitoring/operational items. No lease guard was weakened to conceal failures.

## Release disposition

All eight dispositions in the [complete release-gate table](GA4_FIRST_REGRESSION_CHECKPOINT.md#complete-batch-8-release-disposition) remain OPEN: scheduler/monitoring (V1-010), hosted CI (V1-012), authenticated journeys (V1-013), full semantic/downstream inventory (V1-014), operations/backup/restore/rollback (V1-016), approved disposable live browser target (V1-018), dependency/runtime-image acceptance (V1-019), and evidence/status reconciliation (V1-020). This packet adds bounded evidence for V1-010/012/020 without closing broader acceptance. Counts remain **130 findings: 120 OPEN, 10 DEFERRED, zero CLOSED**.

The natural emailed Ad Comparison PDF and postponed live Google Ads acceptance remain pending. The user's downloaded EUR 8,003.96 report acceptance is retained. LinkedIn/Meta/TikTok/Instagram metric-provider certification remains outside GA4-first V1 scope; shared isolation checks remain in the suite. Redundant campaigns have not been deleted or deactivated.

Next: submit this candidate, require the actual hosted test gate to pass, then verify its deployed revision and subsequent scheduler execution. No UI retest is needed for the CI configuration itself. Do not represent these local passes as full production sign-off.
