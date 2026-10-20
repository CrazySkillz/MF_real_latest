# Current GA4 failing-test root causes

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. The original full suite remains **3,789 passed / 182 failed**; application tests and runtime are unchanged. This supplement resolves the cause of all **37** failures previously classified `BEHAVIOR_ASSERTION_WITH_INCOMPLETE_FIXTURE`. It does not change the recorded full-suite result.

## Exact root cause and diagnostic execution

`server/ga4-kpi-benchmark-jobs.ts:264–267` reads `storage.getGA4PublicationVersion` before reading targets/provider facts and verifies the parent again. `server/scheduler.ts:784–786` does the same before recording a campaign snapshot. The six affected test fixtures omit that method. The resulting exception is caught by the actual job/snapshot failure paths, so later assertions observe no writes or preserved old values. Their common cause is missing fixture infrastructure.

Six audit-only copies add this missing reader and resolve imports to the unchanged production files. The [first diagnostic run](ga4-fixture-diagnostics-results.json) retained every original assertion: **102 passed / 6 failed / 0 skipped** out of108 tests. Remaining failures are exact-object assertions expecting `{currentValue: ...}` while current writes additionally carry the required `publicationVersion` identity.

The [acceptance copies](ga4-fixture-acceptance-preparation.json) preserve every expected metric value and additionally require the **exact campaign ID and publication version**. They do not strip the new guard from actual writes or accept arbitrary payloads. [Final run](ga4-fixture-acceptance-results.json): **108 passed / 0 failed / 0 skipped**, six files. [Preparation script](prepare-ga4-fixture-diagnostics.cjs), [Vitest configuration](ga4-fixture-diagnostics.vitest.config.ts), [log](ga4-fixture-acceptance.log).

| Original file | Behavior exercised in the audit copies |
|---|---|
| `server/ga4-aggregate-saved-overview.test.ts` | Saved Overview versus newer provider input; completed-day imported Revenue; cumulative financials; zero; incompatible snapshots; failed final reads; previous-snapshot preservation/recovery; ordinary/simulated/unfiltered distinctions. |
| `server/ga4-kpi-custom-preservation-regression.test.ts` | Custom/unsupported goal preservation; bounded history reads; ordered value/history writes; per-row read failure; Benchmark failure reporting; alert completion ordering. |
| `server/ga4-kpi-financial-window-regression.test.ts` | Fixed native boundary, imported source-to-completed-day totals, formulas, legacy boundary, exact requested history date and Benchmark update. |
| `server/ga4-kpi-reporting-window-regression.test.ts` | Cumulative traffic and separately defined financial conversions for CPA. |
| `server/ga4-kpi-real-path-parity-regression.test.ts` | Actual job/registered HTTP fixture, supported goal aliases, saved-current states, progress ambiguity, running/failed refresh state, zero, report preflight/PDF-text consumers. |
| `server/shopify-downstream-content-regression.test.ts` | Shopify-backed confirmed Revenue through current report/content, goals, provenance, failure and zero consumer cases. |

Assertion names match all37 original stable failure IDs in [the original ledger](test-failures.json); [exact per-ID mapping](ga4-failed-test-root-causes.json) verifies all37 pass in the final audit copies. They remain original-suite `OPEN / V1-012` until minimal fixture/expectation corrections are agreed, applied to actual test files and the full suite rerun. This is a test-maintenance queue item, not a reason to change these runtime calculations.

## Limits and audit-harness corrections

Storage, providers, authentication and PDF text capture are mocked as in the original files. Publication-version propagation is checked; real database fencing/leases are not established by a mock returning zero. Provider permissions, all source lifecycles, deployed tenant access, full PDF layout, natural scheduling and delivery retain separate gates.

The preparer initially asserted a fixture marker occurred once even though it also appears in later tests; it failed before writing copies. The check was corrected to locate the initial declaration. The first run's Shopify insertion landed in a later test rather than shared setup, leaving its mocked version undefined. The acceptance preparer targets the first method setup independently of indentation; final expectations require version zero. These are audit-harness corrections, not application defects.

The first Vitest launch was blocked by sandbox `spawn EPERM`; the isolated worker run succeeded after approval. Application, test and GA4 database URLs were cleared. No production server, database, provider refresh or email was used. The dependency sourcemap warning is not a failing assertion.
