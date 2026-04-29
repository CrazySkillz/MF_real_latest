# TypeScript Error Inventory

Generated from `npm run check` after the GA4 cleanup checkpoint.

Raw compiler output is saved in `tsc-error-inventory.txt`.

## Summary

- Total TypeScript errors: 514
- This is a repo-wide type health issue, not evidence that the latest GA4 cleanup broke bundling.
- `npm run build` passed after Stage 1.
- `client/src/pages/campaigns.tsx` has no current TypeScript errors after the dead-code cleanup.

## Largest Error Groups By File

| Count | File | Area |
| ---: | --- | --- |
| 171 | `server/storage.ts` | storage/interface drift, attribution/KPI report methods, nullability |
| 123 | `client/src/pages/custom-integration-analytics.tsx` | custom integration nullability/string handling |
| 113 | `server/routes-oauth.ts` | mixed API route type drift, storage interface drift, GA4/benchmark/report sections |
| 23 | `client/src/pages/google-sheets-data.tsx` | Google Sheets page types |
| 13 | `client/src/pages/ga4-metrics.tsx` | GA4 page state/iterator tuple types |
| 12 | `client/src/pages/financial-analysis.tsx` | financial analysis types |
| 7 | `server/report-scheduler.ts` | report scheduler types |
| 6 | `server/meta-scheduler.ts` | Meta scheduler types |
| 5 | `client/src/components/AddRevenueWizardModal.tsx` | revenue platform union types |
| 4 | `server/ga4-kpi-benchmark-jobs.ts` | benchmark storage interface methods |
| 4 | `server/kpi-notifications.ts` | KPI notification types |

## Largest Error Groups By Type

| Count | Code | Meaning |
| ---: | --- | --- |
| 148 | `TS2345` | argument type mismatch |
| 90 | `TS2339` | missing property on type |
| 54 | `TS2551` | missing/wrong property name |
| 45 | `TS18046` | `unknown` value not narrowed |
| 36 | `TS2802` | iterator/downlevel target issue |
| 35 | `TS2322` | assignment type mismatch |
| 33 | `TS2304` | missing name/import/type |
| 26 | `TS7006` | implicit `any` parameter |
| 12 | `TS2353` | object literal has unknown property |

## Stage 3 Safe Starting Scope

Fix only GA4/touched files first:

1. `client/src/pages/campaigns.tsx`
   - Current inventory: 0 errors.
   - Action: no changes needed unless new errors appear.

2. `client/src/pages/ga4-metrics.tsx`
   - Current inventory: 13 errors.
   - Main types: benchmark state shape, iterator conversion, tuple typing, unknown Set values.
   - Risk: medium because this is the active GA4 analytics page.

3. `server/ga4-kpi-benchmark-jobs.ts`
   - Current inventory: 4 errors.
   - Main types: benchmark storage interface methods not declared on shared storage union.
   - Risk: medium/high because it touches KPI/benchmark recompute paths.

4. `server/ga4-scheduled-report-pdf.ts`
   - Current inventory: 1 error.
   - Main type: benchmark storage interface method not declared.
   - Risk: medium because scheduled reports are downstream output.

5. `server/routes-oauth.ts`
   - Current inventory: 113 errors.
   - GA4-near active errors include:
     - `lookbackDays` missing from `InsertGA4Connection`/update schema typing.
     - GA4 metric response type missing fields such as `users`, `revenueMetric`, `engagementRate`, `bounceRate`, `avgSessionDuration`.
     - iterator target errors in active route helpers.
   - Risk: high because this file contains many unrelated route families.
   - Safe rule: fix only GA4-adjacent errors first; do not batch unrelated benchmark/attribution/report-route type drift.

## Do Not Start With

- `server/storage.ts`
  - It has the most errors and many are broad interface/legacy implementation drift.
  - Fixing it first risks touching unrelated features.

- `client/src/pages/custom-integration-analytics.tsx`
  - It has many repeated nullability errors, but it is not part of the GA4 critical path.

- Attribution/report storage method errors
  - These appear broad and structural.
  - They should be separate cleanup stages after GA4-critical files are clean.

## Recommended Next Stage

Stage 3 should begin with `client/src/pages/ga4-metrics.tsx`, because it is GA4-critical and has a bounded number of errors.

Fix rules:

- One file per commit.
- Type-only changes where possible.
- No behavior changes.
- Run `npm run build` after each file.
- Run `npm run check` after each file and confirm the error count drops without new errors.
