# GA4 Production-Ready Tracker

## Purpose

Track GA4 production-readiness findings that are confirmed in code or production-like validation.

Important scope note:

The completed checklist below is complete for the May 2026 GA4 report-template validation scope. It should not be read as a current end-to-end proof that every GA4-adjacent shared report, scheduler, source lifecycle, aggregate, and financial path remains production-ready after later shared-infrastructure changes.

Rule: do not add new items here unless the root cause is confirmed in code or production validation. Operational configuration issues, such as an expired OAuth token or a report missing recipients, are not template blockers unless the code mishandles them.

Campaign-level KPI/Benchmark production-readiness is tracked separately in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md` because those rules apply to every connected platform, not only GA4.

## May 2026 GA4 Report-Template Scope

- [x] Update the stale report regression test so it covers the current scheduler behavior for already-skipped scheduled reports with `Campaign not found` or `No recipients configured`.
- [x] Tighten scheduled-report create/update validation so `scheduleEnabled=true` requires at least one recipient at save time.
- [x] Fix direct report snapshot PDF legacy branding/format so it no longer uses old `MetricMind Report Snapshot` wording or the basic legacy fallback layout.
- [x] Run final validation: targeted report tests, `npm run check`, `npm run build`, one GA4 report test-send, one direct snapshot PDF validation, and one scheduled-report log cycle.

## Completed

- [x] Scheduled report processing disables stale no-recipient schedules instead of logging `already processed ... No recipients configured` every minute.
- [x] Report scheduler regression coverage now asserts already-skipped reports are disabled for both stale campaign and missing-recipient failure states.
- [x] Platform report create/update routes now reject scheduled reports without at least one non-empty recipient before saving.
- [x] Direct report snapshot PDF downloads now reuse the shared report PDF builder and `mimosaas_report_...` filename pattern.
- [x] Final validation passed for the GA4 report template readiness scope:
  targeted report regression tests passed, TypeScript check passed, production build passed, GA4 report test-send/PDF delivery was validated, direct snapshot PDF output was validated, and scheduled-report log-cycle behavior was validated.

## Current Status

The tracked May 2026 GA4 report-template blockers are complete. GA4 can be used as the implementation template for report routes, scheduled report handling, source-backed PDF generation, direct snapshot PDF output, and report email safety, provided future integrations copy the proven GA4 patterns rather than introducing parallel report, scheduler, source, or visibility paths.

This status does not close the newer findings below. Later shared report/source infrastructure changes can affect GA4 even when the visible GA4 page is not directly edited.

## Completed Newer Fixes

- [x] Commit 1 `eb50b64f` - refreshed stale source-backed report regression guards and fixed the confirmed scheduler discovery gap for `custom-integration` platform reports.
- [x] Commit 2 `cedd01cb` - removed the orphan `/api/campaigns/:id/ga4-daily` synthetic imported-revenue write while preserving native `ga4_daily_metrics` backfill.
- [x] Commit 3 `5b5f147d` - aligned `/api/campaigns/:id/outcome-totals.performanceSummary` GA4 financial inputs with GA4 Overview to-date native GA4 totals while preserving the top-level date-range GA4 response.
- [ ] Commit 4 - clean up the three proven orphan `ga4_daily_metrics` synthetic revenue records with an exact-ID guarded migration.

Validation completed for each fix:

- focused GA4/report regression subset passed after each commit
- `npm run check` passed after each commit

Not locally verified:

- live GA4 numeric parity on a production or staging campaign after Commit 3
- deployed scheduled email receipt/provider delivery evidence

Production/staging inventory result for Commit 4:

- read-only inventory date: 2026-06-18
- query target: `revenue_records.revenue_source_id = 'ga4_daily_metrics'`
- result: 3 orphan rows across 1 campaign
- matching `revenue_sources.id = 'ga4_daily_metrics'`: 0
- affected campaign: `247d8ebf-9554-45b9-8a50-482ec25da5a7` (`ga4_brand`)
- affected row IDs:
  - `5cc4657b-f4df-4709-8d10-5d9b7639633c` for `2025-11-10`, revenue `116.57`; matches a native `ga4_daily_metrics` row and should remain native GA4 fact data only
  - `ec2552dc-cbcf-4d3b-b987-c61aa691bf82` for `2026-01-02`, revenue `9999999999.99`; no matching native `ga4_daily_metrics` row was found
  - `6b6111cc-4d53-4e88-a41e-5386acbabe7a` for `2026-01-03`, revenue `9999999999.99`; no matching native `ga4_daily_metrics` row was found

Root cause:

- legacy migration `migrations/0006_add_daily_spend_revenue_granularity.sql` backfilled GA4 native daily revenue into imported `revenue_records` with the synthetic source ID `ga4_daily_metrics`
- the now-fixed `/api/campaigns/:id/ga4-daily` on-demand backfill path also had the same synthetic imported-revenue write pattern before Commit 2
- imported revenue readers require a real active `revenue_sources` row, so rows with `revenue_source_id = 'ga4_daily_metrics'` have no valid imported-revenue provenance

## Current Fix Plan

Use these commit labels when assigning the next work. Each commit should be completed, validated, and reported before moving to the next one.

### Commit 1: Refresh stale report regression guards

Fix scope:

Update only the stale assertions in `server/report-email-regression.test.ts` so they match current source-backed report behavior, including `custom-integration`.

Status: completed and pushed in `eb50b64f`.

Evidence:

- `npm test -- server/ga4-auto-refresh-regression.test.ts server/ga4-financial-rules.test.ts server/ga4-kpi-regression.test.ts server/ga4-benchmark-regression.test.ts server/ga4-insights-regression.test.ts server/report-email-regression.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/campaign-scheduler-current-value-regression.test.ts`
- Initial result: 61 passed, 2 failed.
- Failing file: `server/report-email-regression.test.ts`.
- Root cause: exact-string expectations still describe the older source-backed report platform set and manual-snapshot label logic. Later shared report infrastructure added `custom-integration`, so the current code is broader than the old assertions.
- Additional confirmed runtime gap: scheduled report discovery included Google Sheets source-backed platform reports but did not fetch `custom-integration` platform reports, even though the scheduler constant and PDF builder already supported `custom-integration`.

Implementation strategy:

1. Update only the stale assertions in `server/report-email-regression.test.ts`.
2. Keep the existing safety intent unchanged:
   - source-backed manual snapshots must prove PDF output before insertion
   - source-backed scheduled reports must be discoverable by the scheduler
   - source-backed scheduled reports must fail closed when PDF output is unavailable
3. Make the assertions resilient to adding future source-backed platforms without weakening the guard. Prefer checking for the helper/condition behavior and required platform entries rather than one obsolete full literal list.
4. Run the same focused regression subset after the test update.
5. If the focused subset passes, run `npm run check`.

Runtime scheduler behavior was changed only for the confirmed safety gap: `checkScheduledReports()` now also collects `storage.getPlatformReports('custom-integration')`.

Validation:

- focused regression subset from this tracker passed: 63 tests
- `npm run check` passed

### Commit 2: Investigate and fix `/ga4-daily` synthetic revenue-record path

Fix scope:

Trace and resolve the potential orphan GA4 native revenue write from `/api/campaigns/:id/ga4-daily`.

Status: completed and pushed in `cedd01cb`; impact not yet proven in persisted production data.

Evidence:

- `/api/campaigns/:id/ga4-daily` can create `revenue_records` with `revenueSourceId: 'ga4_daily_metrics'`.
- Normal imported revenue totals and breakdowns use `storage.getRevenueTotalForRange` and `storage.getRevenueBreakdownBySource`, which inner join `revenue_records` to active `revenue_sources`.
- No matching active `revenue_sources` row for synthetic source ID `ga4_daily_metrics` was proven in the code trace.
- Current visible GA4 Total Revenue uses `ga4-to-date` native GA4 revenue plus imported revenue-to-date, so this path may be orphaned legacy data rather than visible card logic.

Implementation strategy:

1. Trace current callers of `/api/campaigns/:id/ga4-daily` and confirm whether the revenue-record insertion is still needed.
2. Check whether any production or seeded data contains `revenue_records.revenue_source_id = 'ga4_daily_metrics'`.
3. If the rows are not consumed by any supported visible/API path, remove the write from the backfill path and add a regression guard that GA4 native revenue remains sourced from `ga4_daily_metrics` / `ga4-to-date`, not synthetic imported revenue records.
4. If the rows are consumed by a legacy path, replace the string-literal source ID with a proper campaign-scoped revenue source or migrate the consumer to the GA4 native revenue path. Do not invent imported revenue provenance for GA4 native revenue.
5. If existing orphan rows are present, prepare a separate cleanup plan:
   - read-only inventory first
   - prove rows are synthetic GA4-native rows only
   - delete or migrate only the proven synthetic boundary
   - do not touch imported CRM, ecommerce, CSV, Google Sheets, or manual revenue records

Validation:

- focused regression subset from this tracker passed: 64 tests
- `npm run check` passed
- proven in code: `/ga4-daily` still upserts `ga4_daily_metrics`
- proven in code: `/ga4-daily` no longer calls `storage.createRevenueRecords` or writes `revenueSourceId: 'ga4_daily_metrics'`

### Commit 3: Validate and align GA4 Overview vs Campaign DeepDive current totals

Fix scope:

Prove whether GA4 Overview current financial totals drift from `/api/campaigns/:id/outcome-totals.performanceSummary`, then fix only the confirmed boundary if drift exists.

Status: completed and pushed in `5b5f147d`; live numeric parity still needs production-like validation.

Evidence:

- GA4 Overview computes financial revenue from `ga4-to-date` native revenue plus imported revenue-to-date.
- `/api/campaigns/:id/outcome-totals` initially built GA4 aggregate values from date-range acquisition breakdown and only fell back to persisted daily rows when live values were missing.
- Campaign DeepDive consumers use `/outcome-totals.performanceSummary`.
- Confirmed drift boundary: Campaign DeepDive current financial values read `performanceSummary`, while GA4 Overview financial cards use `/ga4-to-date` native GA4 revenue plus imported revenue-to-date.

Implementation strategy:

1. Define the expected comparison precisely:
   - GA4 Overview lifetime/to-date card values
   - Campaign DeepDive current aggregate values for the same campaign
   - date-range trend/history values, which may intentionally use a window
2. Create a controlled GA4-only fixture or persisted mock scenario with:
   - GA4 native revenue
   - imported revenue-to-date
   - spend-to-date
   - at least one persisted GA4 daily row
3. Compare:
   - GA4 Overview `Total Revenue`, `Total Spend`, `ROAS`, `ROI`, `CPA`
   - `/api/campaigns/:id/outcome-totals.performanceSummary.totals`
   - Campaign DeepDive Budget & Financial visible values
4. If drift is proven, fix the smallest shared boundary so current aggregate financial totals use the same current source-of-truth as GA4 Overview while preserving windowed historical trend semantics.
5. Add a regression guard that GA4-only aggregate current financial totals match GA4 Overview financial inputs.

Implementation completed:

- top-level `/outcome-totals.ga4` remains the existing date-range response
- `performanceSummary` now receives separate `financialGa4Totals` and `financialWebAnalytics` values aligned to the same GA4 to-date native totals used by GA4 Overview financial cards
- historical trend comparison logic was not changed

Validation:

- focused regression subset from this tracker passed: 65 tests
- `npm run check` passed

## Next Step

Before new GA4 production-readiness fixes, perform the two remaining evidence-gathering steps that cannot be proven from local code alone:

1. Run a read-only production/staging inventory for `revenue_records.revenue_source_id = 'ga4_daily_metrics'`.
2. Run one real or production-like GA4 campaign parity check comparing GA4 Overview financial cards with `/api/campaigns/:id/outcome-totals.performanceSummary.totals`.

Only after those checks should a cleanup or parity follow-up commit be created.

## Current Unverified Areas

Do not mark GA4 fully production-ready until these are separately traced or validated:

- full add/edit/delete/scheduler/display/totals/cleanup lifecycle for each GA4 revenue source family: Shopify, HubSpot, Salesforce, Google Sheets, CSV, and legacy Manual
- full add/edit/delete/scheduler/display/totals/cleanup lifecycle for each GA4 spend source family: Google Sheets, CSV, LinkedIn Ads, Meta, Google Ads, and legacy Manual
- real GA4 property validation for Overview tables, Insights trends, Ad Comparison, reports, and OAuth/token refresh
- deployed scheduled email receipt and provider-event delivery status
- existing damaged-data cleanup boundaries for duplicate or orphan financial source records

Future GA4 production-readiness items should be added only when root cause is confirmed in code or deployed validation.

Template rules for future integrations:

- preserve campaign/platform ownership guards before read, update, delete, snapshot, send, or scheduler mutation
- preserve fail-closed scheduler behavior for missing campaigns, stale sources, missing recipients, and wrong platform/source identity
- preserve stable source identity for edit/refresh paths; add mode and refresh mode must not be confused
- preserve shared report PDF generation for scheduled, test-send, download, and direct snapshot output
- preserve transactional/plain report email delivery with the generated PDF as the report artifact
- add targeted regression coverage before calling a copied integration path production-ready
