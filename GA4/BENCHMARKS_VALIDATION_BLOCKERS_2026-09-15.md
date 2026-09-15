# GA4 Benchmarks Validation Record — 2026-09-15

## Decision

**NOT CERTIFIED — BLOCKED**

The requested `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md` was not created because the required deployed lifecycle and final boundary gates did not pass. This record is evidence of the attempted validation, not a production-readiness certificate.

GA4 Overview, GA4 KPIs, Landing Pages, and every other section remain outside this certification decision and were not modified or recertified.

## Runtime comparison

- Historical certified Benchmark runtime: `a96ba06e21c9344c1767c960e702ac4a647dc5f1`.
- Current local `HEAD`, `main`, `origin/main`, and deployed `/api/health` runtime: `88e755a69cea84b83767535c0734f1`.
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

### 5. Current-version boundary suite

`npm run test:current-version` was run once at the end.

- Total tests: 2,025.
- Passed: 1,982.
- Failed/deferred: 43.
- Forty-two were visible non-blocking future-platform deferrals outside the Benchmark dependency manifest.
- One was blocking: `server/app-production-readiness-ledger.test.ts` expects the GA4 KPI ledger row to be `UNVERIFIED`, while `APP_PRODUCTION_READINESS.md` currently records it as `CERTIFIED`.

The blocking assertion is outside the Benchmark dependency manifest and does not change a Benchmark value. It nevertheless means the user-mandated final boundary gate is not clean. The ledger and KPI files were not modified because the request explicitly excluded them.

## Primary Benchmark blocker: duplicate automatic history

### Proven root cause

`server/ga4-kpi-benchmark-jobs.ts` performs an application-level read/check/insert sequence:

1. read Benchmark history;
2. filter it by the GA4 history scope marker;
3. check whether the date/scope point already exists; and
4. call `recordBenchmarkHistory` when it does not.

`server/storage.ts` then inserts the history row after checking that the parent exists. `shared/schema.ts` has no database uniqueness constraint for the logical `(benchmarkId, reportingDate, scopeMarker)` identity. Two concurrent recomputes can therefore both observe no row and both insert one. The identical timestamp and scope of the observed duplicate pairs are consistent with this race.

This invalidates duplicate-history, concurrent refresh/recompute, and downstream history-propagation readiness on the deployed runtime until corrected and retested.

### Local forward-path remediation

The local working tree now changes only `DatabaseStorage.recordBenchmarkHistory` for the reserved `auto:ga4_daily:` path:

- a PostgreSQL transaction-scoped advisory lock serializes automatic history writes for the same Benchmark across application processes;
- the parent existence check, exact `(benchmarkId, notes)` lookup, and conditional insert run inside that transaction;
- a concurrent caller returns the existing logical history row instead of inserting another;
- manual history remains append-only; and
- no existing history row or schema was changed.

All production history insertion paths resolve through this storage method. The local fix is not deployed and does not remove the four known duplicate rows.

Validation of this local remediation:

- direct persistence set: 17/17 tests passed;
- widened GA4 Benchmark/job/alert set: 130/130 tests passed across 18 files;
- the new regression executes two concurrent same-date/same-scope writes and proves one logical row is stored;
- the regression separately proves manual history remains append-only and missing-parent writes fail closed;
- `npm run check`: passed once after the change; and
- `npm run build`: passed once after the change, with 3,471 modules transformed.

### Required work before certification can resume

1. Review and deploy the localized forward-path fix.
2. After the fixed runtime is verified, run a separate, explicitly authorized targeted cleanup for only the four proven duplicate rows; do not infer a broader damaged-data boundary.
3. Rerun the one authenticated deployed lifecycle and value-reconciliation gate after deployment and cleanup.
4. Resolve or explicitly update the unrelated current-version ledger assertion within its owning section, then rerun the final boundary suite.
5. Create the requested certificate only if every required gate then passes.

The forward-path fix exists only in the local working tree. No production-data cleanup or deployment was performed.

## Files created by this validation

- `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`
- `GA4/BENCHMARKS_VALIDATION_BLOCKERS_2026-09-15.md`
- `scripts/ga4-benchmark-lifecycle-authorized-validation.ts`
- `scripts/ga4-benchmark-duplicate-inventory-readonly.ts`
- `server/ga4-benchmark-history-idempotency.test.ts`

The localized forward fix changes `server/storage.ts` and updates its existing isolation guard in `server/benchmark-route-isolation-regression.test.ts`. No Overview file, KPI file, Landing Pages file, `APP_PRODUCTION_READINESS.md`, existing certificate, or readiness status was changed. No commit, deployment, cleanup, or push was performed.
