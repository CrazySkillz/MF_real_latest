# October 29 regression-gate repair

The current-version regression gate passes locally: **6,703/6,703 tests across 391 files**, zero failures, skips or visible deferred failures. TypeScript and the standalone GA4 KPI certification gate also pass. This correction changes tests and documentation only. Application code, dependencies, deployment configuration, production data and the separate early-access endpoint remain unchanged.

## Reproduced failures and corrections

The [hosted baseline on d2fba530](https://github.com/CrazySkillz/MF_real_latest/actions/runs/40860623087) failed 27 of 6,703 tests in ten files. The preceding a2403403 run failed 26; the additional failure is the same source-deletion timing mismatch for Salesforce, which previously passed through an initialization race.

| Count | Confirmed cause | Test correction and retained protection |
| --- | --- | --- |
| 4 | Trends PDF tests write into an untracked `audit-temp` directory absent from a clean checkout. | Create that directory before writing synthetic artifacts. Existing chart, gap, zero and single-point assertions remain. |
| 1 | The scheduled PDF test double lacks `jsPDF.circle`, now used by the real Trends renderer. | Add the missing mock method. Real-jsPDF chart tests and cross-consumer financial/Benchmark assertions still run. |
| 3 | Overview tests still require the removed independent ten-minute polling. | Assert no independent timer; retain publication updates, focus/reconnect, campaign/property isolation and cached-data checks. |
| 1 | Landing Pages asserts the old inline row expression. | Assert the current derived-row render condition and the original provider-row extraction. Loading, unavailable, cached and empty states remain checked. The user-requested Promo-only fixture is unchanged. |
| 2 | PostgreSQL fixtures expect a rename to cancel valid work and a source created today to exclude old Spend. | Check that rename preserves the work ID, a changed GA4 filter replaces it, and old Spend is included while today/future records are excluded. |
| 1 | A Sheets propagation test requires the removed 15-second Sheets timer. | Check the shared publication invalidation and one-minute follow-up only for unfinished imports, stopping when settled. |
| 1 | A materialization test still requires the removed Spend source-creation-date predicate. | Assert the record-date cutoff instead; keep all revenue provenance/materialization guards. |
| 14 | Seven source deletion and seven publication fixtures omit `nextCheckAt` and still expect results after six or 31 seconds. | Model pending versus current publication and the scheduler-provided next check. Settle initial reads, verify the old value remains after 30 seconds, and verify completion at the one-minute follow-up. Cancellation, failed removal, exact deletion scope, partial CRM mappings and Pipeline Proxy checks remain. |

No test was skipped, deferred, removed or made nonblocking. No application polling, aggregation, source eligibility, report generation or access rule was changed to satisfy an obsolete expectation.

## Evidence

[Compact validation receipt](validation-2026-10-29-ci-repair/local-validation.json) records all 27 original failure identities, their passing replacements, exact test-file hashes, raw-log hashes and isolation/cleanup evidence.

- Local reproduction: **324 passed / 23 failed**, 347 tests in the ten affected files. The four filesystem failures do not reproduce when `audit-temp` already exists; the clean hosted checkout proves that boundary.
- Corrected targeted packet: **357/357**, 12 files, no skips. It includes actual PostgreSQL Spend/publication paths and the rendered-browser schedule/warning regression.
- One complete current-version execution: **6,703/6,703**, 391 files, no blocking or deferred failures. The runner removes application credentials, blocks external Node networking, uses isolated loopback PostgreSQL and synthetic browser APIs, verifies empty fixture databases afterward, stops its cluster and checks that no tracked file changed during execution.
- TypeScript and the same standalone GA4 KPI certification command used by CI: exit zero.

The repair commit uses `[skip render]`, following [Render's documented skip-deploy option](https://render.com/docs/deploys#skipping-an-auto-deploy). Hosted clean-checkout acceptance is the `Tests` check attached to that commit and is recorded separately after submission. No new application build or deployment is necessary for these test-only changes; neither is claimed as validation here.

## Release boundary

This restores the regression evidence for V1-012 once the corresponding hosted `Tests` check also passes. It does **not** close the other production-readiness gates or certify Batches 1-5 end to end. Production Clerk/domain migration, credential disposition and key recovery, dependency exposure, provider lifecycle acceptance, persisted-data integrity, natural scheduled refresh/email receipt, monitoring, restore and rollback acceptance remain governed by the existing tracker. Earlier whole-app readiness statements are not evidence for those outstanding paths.
