# Promo Spend: transaction-date eligibility

Status: implemented and verified locally; deployment and live-UI validation remain pending. This is a bounded eligibility correction, not Spend source-family or production-readiness certification. The Trends correction is recorded separately.

## Authorized behavior and root cause

On October 28 the user explicitly authorized Spend to follow Revenue: past-dated records count regardless of the source's connection/import date; today's and future records remain excluded until their reporting day is complete.

Read-only production inspection confirmed Promo's active EUR CSV source `451385b7-4c29-4e78-825b-561fd3d09f47` was added October 28 at 07:55 UTC. Its selected `LI_B2B_SaaS_US_Q1` rows (800 + 300) materialized correctly as one EUR 1,100 record dated January 1, 2026. The campaign's Amsterdam completed-day cutoff was October 27. No CSV date, amount or selection was lost.

Both `getSpendTotalForRange` and `getSpendBreakdownBySource` additionally required the source definition to have been created by the reporting cutoff. That condition excluded this otherwise eligible record. `/spend-sources` repeated the creation-date condition for its pending label. The earlier rules deliberately retained this restriction for Spend after Revenue moved to sale-date eligibility; this correction supersedes that restriction by explicit user instruction.

## Localized change and trace

- `server/storage.ts`: remove only the source-creation predicate and its now-unused campaign lookup from the two Spend queries. Keep inclusive record-date bounds, active source, exact source/record campaign joins, platform scope (including legacy null-context GA4 compatibility), currency checks, precision and response shapes.
- `server/routes-oauth.ts`: pending status now means the source has materialized records but none through the completed-day cutoff. Latest imported values and completed contributions still have separate fields.
- No provider import, stored amount/date, source selection, attribution, schema, formula, report preflight or refresh scheduling code changes.

Confirmed path: Add Spend -> CSV mapping -> `/spend/csv/process` -> selected-row aggregation -> transactional `replaceCsvSpendSourceWithRecords` -> normalized records -> the two shared scoped queries -> `/spend-sources`, `/spend-to-date`, `/spend-breakdown` -> source-modal data and downstream financial calculations. The Overview money card renders the persisted `financial_daily` snapshot's Spend input, not the modal's imported amount.

| Consumer | Traced behavior / validation |
| --- | --- |
| CSV add/edit/delete | Local PostgreSQL save, exact source replacement and deletion; totals follow the same record boundary. Existing rollback tests also pass. |
| Sources modal | Execute the actual guarded route against local PostgreSQL. New historical source: imported 1,100, completed 1,100, pending false; today-only source: imported 1,100, completed 0, pending true. |
| Overview / financial snapshot | Execute the real snapshot writer with Spend from the real storage query. New source's historical 1,100 remains available through the existing readiness checks. |
| KPI / Benchmark / diagnostics | Existing shared queries feed current-value and aggregate paths. Existing formula tests and direct positive-Spend ROAS/ROI/CPA assertions pass; no formulas change. |
| Browser reports | Execute the real browser download handler with real jsPDF and a consistent published 1,100 Spend fixture; existing pending, mismatch, missing-Spend and refresh tests pass. |
| Scheduled reports | Execute the existing report builder with a published 1,100 Spend and newly created source; verify printed Spend, Revenue and CPA and the unchanged completed-date read boundary. Provider calls are rejected in the fixture. |
| Refresh/recovery | Existing Spend writes invalidate campaign publication work/alignment. Local PostgreSQL invalidation tests and actual startup-discovery tests cover recovery of the invalidated publication after a source is added today. Scheduler code is unchanged. |

The snapshot writer and startup discovery retain their existing missing-input readiness checks. Those checks do not remove materialized historical spend returned by the corrected queries. No report-readiness guard is bypassed.

## Evidence

- Initial new PostgreSQL packet reproduced eight failures caused by historical spend returning zero; today-only exclusion passed.
- Final focused packet: **143 passed, 0 failed, 0 skipped** (`validation-2026-10-27-report-incident/spend-date-fixed-fixture-oct28.json`). Coverage includes selected CSV rows, source-family query fixtures, earlier comparison dates, today/future exclusion, explicit zero, inactive/foreign/orphan/cross-campaign rows, legacy null context, currency mismatch, source replacement/deletion and financial snapshot/formula propagation. Two fixture setup corrections were necessary: the actual CSV save intentionally forces active/CSV, so inactive and alternate-family query fixtures must be explicitly seeded as such.
- Final report/recovery packet: **342 passed, 0 failed, 0 skipped** (`validation-2026-10-27-report-incident/spend-date-reports-recovery-final-oct28.json`). A newly exercised source-table branch initially lacked its label helper in the test harness; adding the fixture binding resolved that test-only failure without changing application code.
- TypeScript and server production build pass (`validation-2026-10-27-report-incident/spend-date-oct28-build-checks.json`). Client runtime code is unchanged by this correction; the earlier Trends build is separate evidence.
- The October 28 09:25 UTC production check used a repeatable-read, read-only transaction. The corrected date-only SQL returns exactly **EUR 1,100** from Promo's existing saved record. Its live financial snapshot still showed Spend unavailable and Revenue 84,399.90; its latest completed refresh work was invalidated by the import. Captured evidence is in `audit-temp/promo-spend-date-correction-readonly-2026-10-28.json`. The earlier read accidentally selected executive snapshots for the financial payload; the later check explicitly selects `financial_daily`.

## Publication and remaining limits

Eligibility is not proof that a new financial snapshot is published. The existing Spend save recomputes current values and invalidates readiness; Overview and reports must wait for a successful existing owned financial/GA4 publication. Startup discovery and normal scheduled refresh can perform that publication. This fix does not promise immediate import-to-card completion or change Spend's publication latency.

Promo's existing saved row needs no re-upload or data cleanup. After deployment, a successful financial publication is required before the Overview card can show the corrected value. No production data or provider account was modified and no browser account was accessed. Deployment, actual post-deploy publication/UI/PDF parity, live provider lifecycles, natural scheduled email delivery and broader source-family certification remain unverified. Historical snapshots are not rewritten by this correction.
