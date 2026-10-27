# GA4-first regression reconciliation — October 27, 2026

**Local regression reconciliation is complete: 6,477 passed, zero failed, zero skipped/todo, 382 files. Batch 8 release acceptance remains IN PROGRESS / NO-GO.** This is the current checkpoint over the [October 26 inventory](LOCAL_RELEASE_CHECKPOINT.md). No application runtime or production data changed. The user subsequently authorized committing and pushing this packet; hosted CI and deployment remain unverified.

## Scope

The user confirmed that V1 is GA4-first and that some campaigns are redundant. LinkedIn, Meta, TikTok and Instagram metric-provider certification is outside this release's primary onboarding scope. Their retained code still needs shared access, financial-context and cancellation isolation. No provider was enabled, configured or certified. The existing GA4-only platform selection/finalization and Connected Platform filter remain enforced and regression-covered.

Redundancy is not an exact damaged-data boundary. No campaign was deleted, deactivated, renamed or otherwise changed. No personal browser, signed-in account, live provider, production database or email service was accessed. The only deployed access was four anonymous GET requests.

## Corrections and proof

All **123** failures in the previous ledger are bound to passing assertions in the final complete results. Nine test descriptions changed to name the current contract; the reconciliation explicitly retains their old IDs and maps each new identity. **No failed assertion was waived, skipped or silently dropped.** The existing deferred-failure manifest was not expanded or used to filter the raw full run.

The precommit check found one stale Meta wizard test name in that manifest. Only its name was synchronized with the already-passing assertion; all 52 entries and their policies remain. The [precommit receipt](validation-2026-10-27/precommit-ci-boundary.json) records 19 focused CI tests passing and the actual classifier accepting all 6,477 preserved full-run outcomes with zero missing identities. The full suite was not rerun for this metadata-only correction; the original execution receipts remain unchanged. The oversized October 26 terminal transcript is retained locally; its complete structured results and reconciliation are included in the packet.

The [exact reconciliation](validation-2026-10-27/final-reconciliation.json) contains every original ID, file, failure, confirmed cause, current assertion name, result and source hash. The changes are localized to tests, the previously prepared CI-completion safeguards, and audit evidence. Application files in `client/`, `shared/` and non-test `server/` code are unchanged from `ea0b843afbb8946eaaa248ea57786651cd3d457b`.

| Confirmed test failure cause | Correction and retained behavior |
|---|---|
| Storage mocks predated campaign locks, parent lookups and publication-table/work reads. The Sheets PostgreSQL fixture omitted the mandatory work table. | Added the missing query/schema shapes. Existing add/edit/delete/disconnect, rollback, conflict, history and cross-campaign assertions remain. Fixtures without a GA4 connection do not purport to prove queued publication; the real publication and ownership suites run separately in the full suite. |
| Extracted handlers lacked current imports; scheduler fixtures lacked pending-delivery reads, publication versions or a valid owned active campaign. | Supplied the actual imports and current input shapes. Report campaign isolation, failed refreshes, cancellation and custom-value retention still execute. |
| Notification metadata is now a SQL merge rather than serialized JSON. | Compile and inspect the actual SQL guard/patch instead of parsing the SQL object as JSON. Real PostgreSQL notification suites also pass; these unit assertions alone do not prove database execution. |
| Source-text assertions expected superseded connection-date eligibility, independent polling, unscoped snapshots, old filenames or inline finalization. | Assert the implemented sale-date materialization, publication-coordinated refresh with failure fallback, scoped shared writer, generation-date filenames and shared finalization caller. Monetary formulas and runtime behavior are untouched. |
| Timeout fixtures predated complete-page validation and the shared Sheets retry helper. | Supply Salesforce `totalSize`, bind the HubSpot validator and execute the current Sheets 401 retry callback. Stalled body parsing and owner cancellation remain covered. |
| Retained-provider assertions omitted later GA4/custom contexts or sliced beyond their intended handler on CRLF files. | Update the exact current context strings and normalize only the affected extraction inputs, with explicit end-bound assertions. GA4-only visibility and shared source boundaries remain checked. |

Validation:

- [Full run](validation-2026-10-27/consolidated.json): **6,459/6,459**, 381 files. Only the older fixed-port precision file was excluded from this invocation.
- [Precision fixture](validation-2026-10-27/precision-isolated.json): **18/18** on its required port `55443`. Together these are the complete 382-file inventory, not one single invocation.
- Both runs exited zero with **no collection/hook or unhandled errors**. [Full receipt](validation-2026-10-27/consolidated-run-errors.json), [precision receipt](validation-2026-10-27/precision-isolated-run-errors.json).
- All **710 report-neighbor checks across 46 files** pass again, including generation failure/recovery and precision. This proves their covered scenarios, not every live provider or report state.
- [TypeScript](validation-2026-10-27/final-build-checks.json) passes. The previous client/server builds remain applicable because no application runtime source changed; no dependency changed.
- [Full execution](validation-2026-10-27/consolidated-execution.json) and [precision execution](validation-2026-10-27/precision-isolated-execution.json) prove tracked files unchanged during execution, empty fixture databases afterward, no remaining sessions and a stopped local cluster. Credentials were stripped, external Node networking blocked, and historical PDF artifacts preserved.

The earlier focused failures remain saved as diagnostic evidence. The final full run supersedes them. Test contracts are now coherent with the inspected implementation; passing them does not establish an exhaustive value/lifecycle certificate beyond their documented coverage.

## Deployed scheduler boundary

[Anonymous observations](validation-2026-10-27/public-check.json), **October 27 at 00:27 Amsterdam / October 26 at 23:27 UTC**:

- `/api/health` reports the unchanged base revision. Unsigned campaign/client requests return 401.
- The automatic scheduler still records `GA4 financial refresh request failed (500)`; its latest attempt finished at 23:27:18 UTC.
- The daily scheduler's recorded startup bootstrap failed at 21:50:05 UTC with `GA4_REFRESH_WORK_OWNERSHIP_LOST`. Five discovery failures report unapproved customer/provider resources, and one reports ownership loss. The next natural daily run is **October 27 at 08:00 Amsterdam / 07:00 UTC**.
- The top-level `/health/scheduler` label remains the constant `healthy` in `server/index.ts`. That label does not override the recorded failures.

Code trace: automatic financial refresh calls `postJson` in `server/auto-refresh-scheduler.ts`, which performs a loopback request under publication ownership and classifies a 500 as a transient error. The public message omits the failing route and response body. Ownership errors can originate from several scope/lease checks in storage and the daily scheduler. The public response identifies neither the exact failed check nor an exact campaign/provider configuration. These errors therefore cannot safely be attributed to redundant campaigns or repaired by speculative deletion, relaxed ownership guards or guessed refresh changes. Their deployed root causes and recovery remain unproven.

## Complete Batch 8 release disposition

| Gate | Current evidence and remaining limit |
|---|---|
| V1-010 scheduler health/recovery | Recorded failures and constant health label confirmed; exact deployed causes, truthful monitoring and subsequent natural recovery still open. |
| V1-012 tests/CI | All 123 local identities resolved; complete local suite and TypeScript pass. Actual hosted CI at the submitted revision remains unverified. |
| V1-013 authenticated journeys | Earlier bounded confirmations retained. Complete deployed owner/new-account/lifecycle and tenant acceptance remains open; no personal-browser access. |
| V1-014 semantic/downstream | Current full regression evidence added. Complete source/value/fallback/lifecycle/downstream certification remains governed by the detailed inventories, not the aggregate test count. |
| V1-016 operations | Isolated database cleanup and source integrity proven locally. Hosting capacity, production backup/key restoration, rollback, monitoring and natural recovery remain unverified. |
| V1-018 browser target | Fresh synthetic browser fixtures run locally. The retired/shared destructive live target was not used; an approved disposable live target remains required. |
| V1-019 dependencies | Previous offline installed-tree evidence retained; no dependency changes. Advisory identities/reachability and production-image acceptance remain open. No new advisory request was made. |
| V1-020 status navigation | Current evidence and all gate limits reconciled here. Historical records retained; no finding is silently closed. |

Batch 7's natural emailed Ad Comparison PDF and the user-postponed Batch 6 Google Ads live check remain separate pending acceptances. The verified downloaded report remains EUR **8,003.96**. These are not the only whole-application release gates. The next submission can carry this test/CI/evidence packet without an application behavior change; production readiness cannot be claimed from this local pass alone.
