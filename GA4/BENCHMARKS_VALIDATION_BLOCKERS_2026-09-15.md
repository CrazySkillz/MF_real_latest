# GA4 Benchmarks Validation Record — 2026-09-15

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY — GA4 BENCHMARKS ONLY**

The requested controlling certificate is `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md`. This file remains the supporting chronological validation record, including the discovered blocker, forward fix, cleanup, and final evidence.

GA4 Overview, GA4 KPIs, Landing Pages, and every other section remain outside this certification decision and were not modified or recertified.

## Runtime comparison

- Historical certified Benchmark runtime: `a96ba06e21c9344c1767c960e702ac4a647dc5f1`.
- Certified and deployed application runtime validated through `/api/health`: `236afff993e60c5f9eaf75c42bca8b31b52f601d`. The later evidence-only commit does not change application behavior.
- Commit distance reviewed: 188 commits after the historical baseline.
- Historical evidence source: `GA4/certifications/ga4-benchmarks.json` and `GA4/BENCHMARKS_PRODUCTION_READINESS.md`.
- Current dependency boundary: `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`.

## Benchmark-impacting delta

The core Benchmark calculation, persistence, scheduler, alert, math, schema, and historical validator files were unchanged across the runtime delta. Two direct Benchmark-consumer changes were identified:

1. Commit `8b6ebb46` changed create/edit modal pending behavior. The modal closes optimistically, reopens on an error for the same campaign, and the global analytics-save pending state disables conflicting KPI/Benchmark actions. The existing `server/ga4-save-pending-ui-regression.test.ts` covers this changed path.
2. Commit `0c49cc6a` changed CPA to use the selected financial-source conversion value and freshness state rather than a traffic-summary fallback. It also preserved valid zero values in Executive/report-related conversion selection by using nullish rather than truthy fallback. The existing `server/ga4-kpi-ui-browser-state-regression.test.ts` and `server/ga4-overview-performance-readiness.test.ts` cover these changed paths.

Other changes to Overview tables, source setup, Landing Pages, Conversion Events, and other platform sections were outside the explicit dependency manifest. They do not automatically invalidate Benchmark evidence unless they alter a manifested aggregate, source, freshness, currency, window, scoping, or API contract.

## Evidence carried forward

Historical evidence was carried forward only for paths whose implementation and manifested contract did not change:

| Path | Why the historical evidence remains applicable |
|---|---|
| Metric identity, formula, unit, sufficiency, and classification | The shared Benchmark math/identity implementation was unchanged. |
| Persisted current values and ordinary sequential history behavior | The Benchmark job and storage implementation were unchanged; concurrent-history safety is separately blocked below. |
| Scheduler source selection and completed-day window | The job/scheduler implementations and manifested window helpers were unchanged. |
| Alert resolver and threshold behavior | The GA4 alert resolver and Benchmark notification implementation were unchanged. |
| Campaign/owner route guards and destructive delete behavior | The relevant Benchmark routes/storage contracts were unchanged and remained covered by focused regression tests. |
| Executive Summary Benchmark comparison | The persisted GA4 platform Benchmark selection and shared comparison math were unchanged; the changed zero fallback was covered by an existing focused test. |
| Report Benchmark sections | Benchmark preflight and platform-row consumption were unchanged; unrelated Overview report-table changes were outside the manifest. |

Carry-forward evidence does not replace a required current-runtime authenticated lifecycle. It narrows retesting of unchanged paths; it does not turn an incomplete gate into a pass.

## Gate results

### 1. Delta and dependency impact

Completed. The dependency manifest records every Overview-facing field, aggregate, window, freshness rule, currency rule, source precedence rule, scope boundary, API contract, recompute rule, and relevant downstream consumer used by GA4 Benchmarks.

### 2. Focused Benchmark tests

Command scope: the existing 28-file focused Benchmark suite, including the tests for both changed paths.

- Test files passed: 27 of 28.
- Tests passed: 397 of 407.
- Ten failures were confined to stale Instagram/Google Ads code-shape assertions in `server/source-safety-regression.test.ts`.
- Those ten failures are outside the GA4 Benchmark dependency manifest and did not exercise a Benchmark value or lifecycle path.
- All focused GA4 Benchmark tests passed.
- No new runtime regression test was added because the two direct changed paths already had focused coverage. A deployed authorized lifecycle validator and a read-only duplicate inventory validator were added for the uncovered current-runtime gate.

### 3. TypeScript and production build

- `npm run check`: passed; run once.
- `npm run build`: passed; run once.
- Production build completed successfully with 3,471 modules transformed.

### 4. Authenticated deployed lifecycle and value reconciliation

Validator: `scripts/ga4-benchmark-lifecycle-authorized-validation.ts`

The single authorized run:

1. proved the deployed SHA was `88e755a69cea84b83767535c0734f1`;
2. established authenticated access;
3. confirmed there were no exact duplicate active Benchmark definitions;
4. ran the one authorized manual scheduler refresh/recompute for the two existing target-campaign Benchmarks; and
5. failed closed before creating a temporary Benchmark because duplicate same-date/same-scope history was present.

Cleanup ran. No temporary Benchmark was created. The run therefore did not complete the current-runtime add, edit, delete, zero, alert, ownership-isolation, report-consumer, and full value-reconciliation lifecycle.

Read-only follow-up validator: `scripts/ga4-benchmark-duplicate-inventory-readonly.ts`

The diagnostic found:

- no duplicate active Benchmark definitions;
- one Revenue history group with two rows for the same reporting date and scope;
- one Conversions history group with two rows for the same reporting date and scope;
- both duplicate groups were recorded at `2026-09-12T21:59:59.000Z` for reporting date `2026-09-11T22:00:00.000Z`;
- Revenue inventory: 55 rows across 54 distinct date/scope keys; and
- Conversions inventory: 50 rows across 49 distinct date/scope keys.

Only hashes were emitted for campaign, Benchmark, scope-note, and history-row identifiers. No damaged row was deleted or rewritten.

#### Deployed concurrent-write verification

Validator: `scripts/ga4-benchmark-history-concurrency-authorized-validation.ts`

At runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d`, the controlled authenticated test:

- created one alerts-disabled temporary GA4 Benchmark;
- issued two identical automatic-history requests concurrently;
- received the same history-row ID from both requests;
- proved exactly one logical history row was stored;
- deleted the temporary Benchmark and proved both its parent and child history count returned to zero;
- proved every pre-existing Benchmark definition remained unchanged; and
- proved the two pre-existing duplicate groups remained at the exact same hashed row boundary before and after the test.

The first harness attempt stopped before issuing concurrent requests because a nested browser helper was not serializable. Its temporary Benchmark cleanup was subsequently proven by a read-only database transaction before the corrected single retry. No abandoned validation row remained.

#### Duplicate cleanup dry run

Validator: `scripts/ga4-benchmark-history-duplicate-cleanup-dry-run.ts`

The production database was inspected inside a read-only transaction after the deployed concurrency test:

- exactly two duplicate groups remain, containing four rows total;
- each group contains exactly two reserved `auto:ga4_daily:` rows;
- every persisted semantic field is identical within each pair;
- deterministic canonical rows `2731171931d5` and `bc9a0da10aa2` are eligible to be retained; and
- redundant rows `74b2d11c244f` and `3526475ce198` are the only rows eligible for deletion.

These are opaque SHA-256-derived identifiers, not database IDs. The dry run did not update or delete any row.

#### Authorized exact cleanup — 2026-09-16

Validator: `scripts/ga4-benchmark-history-duplicate-cleanup-authorized.ts`

The cleanup ran in one serializable transaction after rechecking deployed SHA `236afff993e60c5f9eaf75c42bca8b31b52f601d`. It acquired the same per-Benchmark advisory locks used by automatic recomputation, locked both parent rows, repeated the full semantic and hash boundary validation, and committed only after all post-delete checks passed.

- Deleted exactly the two redundant rows `74b2d11c244f` and `3526475ce198`.
- Retained exactly canonical rows `2731171931d5` and `bc9a0da10aa2`.
- Deleted rows: 2; retained canonical rows: 2.
- Benchmark definitions changed: 0.
- Duplicate groups after commit: 0.
- Independent read-only inventory: no active exact duplicates, no history duplicates, Conversions 49 rows/49 distinct date-scope keys, Revenue 54 rows/54 distinct date-scope keys, and no temporary concurrency-validation row.

The hashes above are opaque identifiers. No row outside the two proven pairs was deleted or updated.

#### Post-cleanup authenticated lifecycle and value reconciliation

The strengthened lifecycle validator was run once against deployed runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d` after cleanup and passed:

- temporary zero-current Benchmark creation, currency unit, target/current edit, delete, child cleanup, and final inventory restoration passed;
- alert creation, repeated-reconciliation deduplication, and resolution passed without email delivery;
- same-owner cross-client list isolation and cross-owner read/edit/delete denial passed;
- the authorized campaign scheduler completed successfully;
- two active Benchmarks reconciled against the live provider with zero persisted/scheduler/UI mismatches;
- two Executive Summary Benchmark rows matched current values, targets, units, and shared status classification;
- the authenticated read-only consumer validator found two campaigns, four Benchmarks, zero failures, and exact card/tracker/Insights/alert/report consumption; and
- an independent post-run inventory proved zero active exact duplicates, zero history duplicates, and zero temporary concurrency-validation rows.

### 5. Current-version boundary suite

The final post-cleanup `npm run test:current-version` run completed after all Benchmark-specific gates.

- Total tests: 2,029.
- Passed: 1,985.
- Failed/deferred: 44.
- Forty-two were visible non-blocking future-platform deferrals outside the Benchmark dependency manifest.
- Two additional failures remained visible and both are outside the Benchmark dependency manifest:
  - `server/app-production-readiness-ledger.test.ts` expects the GA4 KPI ledger row to be `UNVERIFIED`, while `APP_PRODUCTION_READINESS.md` records it as `CERTIFIED`.
  - `server/ga4-kpi-certification-gate.test.ts` reports `server/storage.ts: changed since the certified dependency snapshot`. The KPI certificate hashes the whole shared storage file, and the localized Benchmark-history method changed that file after the KPI certificate was issued.

Neither assertion changes the now-proven Benchmark value or lifecycle evidence. Under the explicit user-approved standard—zero Benchmark-relevant or unexplained blocking failures, with unchanged unrelated deferrals kept visible—they do not invalidate Benchmarks. The repository-wide suite remained nonzero and that fact is not hidden. The KPI certificate and KPI ledger entry were not modified or recertified because the request explicitly excluded them; only the Benchmark ledger entry was later aligned to the controlling Benchmark certificate.

## Resolved Benchmark blocker: duplicate automatic history

### Proven root cause

`server/ga4-kpi-benchmark-jobs.ts` performs an application-level read/check/insert sequence:

1. read Benchmark history;
2. filter it by the GA4 history scope marker;
3. check whether the date/scope point already exists; and
4. call `recordBenchmarkHistory` when it does not.

`server/storage.ts` then inserts the history row after checking that the parent exists. `shared/schema.ts` has no database uniqueness constraint for the logical `(benchmarkId, reportingDate, scopeMarker)` identity. Two concurrent recomputes can therefore both observe no row and both insert one. The identical timestamp and scope of the observed duplicate pairs are consistent with this race.

This invalidated duplicate-history, concurrent refresh/recompute, and downstream history-propagation readiness on runtime `88e755a69cea84b83767535c0734f1`. The forward race is corrected and concurrently retested on runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d`, and the two redundant persisted rows have now been removed within their proven boundary.

### Deployed forward-path remediation

The deployed fix changes only `DatabaseStorage.recordBenchmarkHistory` for the reserved `auto:ga4_daily:` path:

- a PostgreSQL transaction-scoped advisory lock serializes automatic history writes for the same Benchmark across application processes;
- the parent existence check, exact `(benchmarkId, notes)` lookup, and conditional insert run inside that transaction;
- a concurrent caller returns the existing logical history row instead of inserting another;
- manual history remains append-only; and
- no existing history row or schema was changed.

All production history insertion paths resolve through this storage method. The two canonical rows remain and the two redundant rows have been removed.

Validation of this local remediation:

- direct persistence set: 17/17 tests passed;
- widened GA4 Benchmark/job/alert set: 130/130 tests passed across 18 files;
- the new regression executes two concurrent same-date/same-scope writes and proves one logical row is stored;
- the regression separately proves manual history remains append-only and missing-parent writes fail closed;
- `npm run check`: passed once after the change; and
- `npm run build`: passed once after the change, with 3,471 modules transformed.

### Certification completion

All Benchmark-relevant gates are complete. The two final-suite KPI/readiness failures remain visible, explained, and outside the explicit Benchmark dependency manifest. They were not counted as passes and no excluded artifact was changed to suppress them.

The forward-path fix, exact cleanup, post-cleanup deployed lifecycle, value reconciliation, and downstream consumer checks are complete and verified. The dated Benchmark certificate was created without modifying or recertifying KPI/readiness scope.

## Files created by this validation

- `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`
- `GA4/BENCHMARKS_VALIDATION_BLOCKERS_2026-09-15.md`
- `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md`
- `scripts/ga4-benchmark-lifecycle-authorized-validation.ts`
- `scripts/ga4-benchmark-duplicate-inventory-readonly.ts`
- `scripts/ga4-benchmark-history-concurrency-authorized-validation.ts`
- `scripts/ga4-benchmark-history-duplicate-cleanup-dry-run.ts`
- `scripts/ga4-benchmark-history-duplicate-cleanup-authorized.ts`
- `server/ga4-benchmark-history-idempotency.test.ts`

The localized forward fix changes `server/storage.ts` and updates its existing isolation guard in `server/benchmark-route-isolation-regression.test.ts`. That forward-fix commit did not change any Overview file, KPI file, Landing Pages file, `APP_PRODUCTION_READINESS.md`, existing machine certificate, or excluded readiness status. Commit `236afff993e60c5f9eaf75c42bca8b31b52f601d` was pushed and deployed. The separately authorized production cleanup deleted only the two proven redundant history rows. The follow-up evidence commit contains documentation and validation tooling only.
