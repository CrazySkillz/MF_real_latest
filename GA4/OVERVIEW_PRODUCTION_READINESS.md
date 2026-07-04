# GA4 Overview Production Readiness


## Mandatory Anti-Overclaim Rule

Before using this document to answer an audit, review, or production-readiness question, apply PRODUCTION_READINESS.md and AGENTS.md. Do not repeat any production-ready or status claim from this file unless the current request's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current documented evidence. A prior readiness statement is not evidence. A passing test suite is not enough unless it covers the traced value paths. If any path is incomplete, classify it as partially reviewed or not locally verifiable and update the fix queue instead of calling it production-ready.

## Purpose

This file is the canonical production-readiness source of truth for the GA4 `Overview` tab.

Use `GA4/OVERVIEW.md` to understand what the tab is, what the cards and tables mean, and how the user-facing GA4 Overview should behave.

Use this file to answer whether GA4 Overview is production-ready, what has been proven, what remains unproven, what fixes are required, and how the Overview pattern should be replicated for Meta, Google Ads, LinkedIn, or another platform source.

This file supersedes scattered Overview status notes in broader GA4 trackers when the question is specifically about GA4 Overview readiness.

## Current Status

GA4 Overview is clean-certified as production-ready for the current local GA4 Overview code scope documented in this file.

That certification is limited to the current GA4 Overview implementation, local code traces, local regression coverage recorded below, and already documented Overview cleanup boundaries. It is not evidence that any other GA4 section or any future platform implementation is production-ready.

The certification rests on these currently traced facts:

- GA4 Overview Summary cards intentionally keep one coherent selected-campaign source hierarchy: persisted daily rows, then GA4 to-date totals, then breakdown fallback.
- GA4 Overview financial cards use one selected scoped GA4 native financial source for native revenue and conversions, choosing the most complete native revenue total across to-date, daily, and breakdown totals.
- Imported revenue and spend are source-backed, campaign-scoped, active-source-only values.
- `ga4RevenueForFinancials` does not read directly from the Summary-card `breakdownTotals.revenue` value.
- `financialConversions` does not read directly from the Summary-card `breakdownTotals.conversions` value.
- Campaign Breakdown, Landing Pages, and Conversion Events table fallbacks do not allocate campaign-level conversions or imported revenue into rows.
- Pipeline Proxy remains separate from confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, and Reports unless the product contract changes explicitly.

Use this durable answer only when the current request is limited to the traced local GA4 Overview code scope:

`GA4 Overview is production-ready for the current local GA4 Overview code scope, with explicit external caveats for live GA4 API behavior, normal clock-time deployed scheduler execution beyond the recorded startup-fired Google Sheets spend scheduler evidence, deployed provider/source refreshes, provider-backed source-family lifecycle validation, future scheduled/test email deliveries outside the recorded GA4 Overview Report email packet, unvalidated report variants, and production database inventory outside the recorded Current Commit 3 target-campaign packet.`

Do not use a shorter production-ready answer unless the current request's complete value inventory, end-to-end trace matrix, fallback branches, negative cases, downstream propagation matrix, and validation evidence are all covered by this file.

External caveats remain and must be stated:

- live GA4 API processing latency and provider-side data freshness are not locally provable
- normal wall-clock deployed scheduler execution beyond the recorded startup-fired Google Sheets spend packet must be verified in the deployed environment; the recorded Google Sheets spend startup-fired scheduler packet proves only that narrow scheduler execution path
- deployed provider/source refreshes must be verified with provider-backed data
- real source-family add/edit/delete/refresh validation remains an external validation gate
- production database health outside the recorded Current Commit 3 target-campaign inventory remains unproven unless the bounded read-only inventory is run for that additional campaign/scope
- the recorded GA4 Overview Report email delivery packet is user-confirmed, but future scheduled/test email deliveries outside that packet remain Reports/runtime evidence rather than Overview local-code proof

These external caveats do not block the current local GA4 Overview code-scope certification. They do block any blanket claim that deployed provider behavior, production database health, future scheduled email delivery outside the recorded packet, unvalidated report variants, or a different platform's Overview is fully production-ready.

That answer must be lowered to unproven for any affected value path if one of these changes:

- relevant Overview, financial-source, scheduler, report, KPI, Benchmark, or shared aggregate code changes
- validation fails
- source requirements change
- deployed evidence contradicts this document
- a new platform/source is being assessed instead of the existing GA4 implementation
- production data inventory proves damaged source records outside the already documented cleanup boundary

## How To Use This File In A New Chat

Read in this order:

1. `Current Status`
2. `Current Scope`
3. `Clean Certification Matrices`
4. `Current Commit Queue`
5. `Section Production-Readiness Map`
6. `Validation Evidence`
7. `Future Platform Template`
8. `Stable Response For Future Chats`

Do not reopen GA4 KPIs, GA4 Benchmarks, GA4 Ad Comparison, or GA4 Reports unless an Overview code path directly depends on a narrow value from those sections.

When applying this to another platform source, do not copy GA4 implementation details blindly. Copy the gates and contracts, then prove the new platform satisfies each gate with its own source model, account/property/customer scoping, date-window model, financial-source model, refresh model, and report-output path. For future-platform work, use `Future Platform Template` and `Future Platform Readiness Checklist` as the reusable acceptance checklist.

## Current Scope

This readiness file applies to the current GA4 Overview tab for:

- live UI rendering in `client/src/pages/ga4-metrics.tsx`
- GA4 campaign/property/source scoping
- Summary cards
- Total Revenue, Pipeline Proxy, Total Spend, Profit, ROAS, ROI, and CPA
- Campaign Breakdown
- Landing Pages
- Conversion Events
- source-provenance modals launched from Total Revenue, Pipeline Proxy, and Total Spend
- Overview values consumed by KPIs, Benchmarks, Ad Comparison, Insights, and browser-generated report output
- GA4 daily refresh behavior only where it feeds Overview values
- source-backed revenue/spend refresh behavior only where it feeds Overview values

This readiness file does not automatically certify:

- Meta Overview
- Google Ads Overview
- LinkedIn Overview
- custom-upload Overview
- whole GA4 Reports readiness
- whole GA4 Insights readiness
- whole GA4 Ad Comparison readiness
- whole GA4 KPI or Benchmark readiness
- provider-side delivery of scheduled emails
- live GA4 API behavior outside what local code and local tests can prove
- production database health outside the specific data boundaries that have been inventoried

## Clean Certification Matrices

These matrices define the current certification boundary. `Proven locally` means the value path has been traced through the current code and is covered by recorded local regression evidence where applicable. `External caveat` means the path needs deployed, provider, or production-data evidence that cannot be proven from local code alone. KPI and Benchmark readiness evidence is not used as proof for Overview; only the narrow Overview value propagation into those consumers is listed.

### Complete GA4 Overview Value Inventory

| Overview value path | Contract | Scope and window | Local evidence | Certification status |
| --- | --- | --- | --- | --- |
| Campaign/client/property/source scope | Every Overview query stays inside the selected campaign, selected client access boundary, selected GA4 property, and selected GA4 campaign/source filter. | Campaign route context, saved GA4 connection, selected property, selected GA4 campaign filter, and selected Overview date window where the endpoint supports it. | UI query keys in `client/src/pages/ga4-metrics.tsx`; `ensureCampaignAccess` and selected-property resolution in GA4 routes; campaign filters in `server/analytics.ts`. | Proven locally for current code; live provider data freshness remains external. |
| Summary Sessions | Render from the coherent Summary source hierarchy, not from per-metric maxima. | Persisted daily rows first, then GA4 to-date totals, then breakdown fallback. | `dailySummedTotals`, `ga4ToDateOverviewTotals`, `ga4BreakdownTotals`, `overviewTotalsSource`, and `breakdownTotals` trace in `ga4-metrics.tsx`; scheduled report parity trace in `server/ga4-scheduled-report-pdf.ts`. | Proven locally. |
| Summary Users | Render from the same Summary source object as Sessions. Users are non-additive where provider rows report that caveat. | Same Summary source hierarchy; GA4 provider user semantics preserved. | Same trace as Summary Sessions; landing-page metadata preserves `usersAreNonAdditive`. | Proven locally for source selection; provider non-additive semantics remain provider-defined. |
| Summary Conversions | Render from Summary conversions, not financial conversions. | Same Summary source hierarchy. | `breakdownTotals.conversions` trace and recorded UI regression coverage that Summary Conversions is guarded against `financialConversions`. | Proven locally. |
| Summary Engagement Rate | Render from Summary source where available; no financial-source substitution. | Same Summary source hierarchy. | `breakdownTotals.engagementRate` and Summary card render trace. | Proven locally. |
| Summary Conversion Rate | Compute from Summary conversions and Summary sessions. | Same Summary source hierarchy. | Summary render and regression coverage for coherent Summary source behavior. | Proven locally. |
| GA4 native financial revenue | Use one selected scoped native GA4 financial source and do not read directly from Summary `breakdownTotals.revenue`. | Best scoped native revenue source among GA4 to-date totals, daily totals, and breakdown totals. | `ga4FinancialTotalsSource` and `ga4RevenueForFinancials` trace; `server/ga4-ui-regression.test.ts` and `server/revenue-additivity.test.ts` recorded validation. | Proven locally. |
| Financial conversions for CPA | Use conversions from the same selected scoped GA4 financial source as native financial revenue. | Same selected native financial source as GA4 native financial revenue. | `financialConversions` trace; CPA propagation tests recorded in UI/report regressions. | Proven locally. |
| Imported revenue | Add source-backed imported revenue to GA4 native financial revenue; do not allocate imported revenue into Landing Pages or Conversion Events rows. | Campaign-scoped active revenue sources for GA4 platform context, to-date read window. | `/revenue-to-date`, `/revenue-breakdown`, `/revenue-sources`, `getRevenueTotalForRange`, active-source joins in `storage.ts`; revenue additivity tests. | Proven locally for current code; production source data inventory remains external. |
| Total Revenue | `selected scoped GA4 native financial revenue + imported revenue-to-date`. | Native GA4 financial source plus active imported revenue sources in campaign/platform context. | `financialRevenue` trace and recorded revenue additivity/financial rules validation. | Proven locally. |
| Total Spend | Explicit source-backed spend only; GA4 native source does not invent spend. | Campaign-scoped active spend sources, to-date read window. | `/spend-to-date`, `/spend-breakdown`, `/spend-sources`, `getSpendTotalForRange`, active-source joins in `storage.ts`; spend-source additivity evidence. | Proven locally for current code; provider-backed source lifecycle remains external. |
| Profit | `Total Revenue - Total Spend`; shown only when revenue and spend prerequisites exist. | Same financial revenue and spend inputs. | `financialProfit` render trace. | Proven locally. |
| ROAS | `Total Revenue / Total Spend`; gated when spend is unavailable or zero. | Same financial revenue and spend inputs. | `financialROAS` render trace and financial rules evidence. | Proven locally. |
| ROI | `(Total Revenue - Total Spend) / Total Spend`; gated when spend is unavailable or zero. | Same financial revenue and spend inputs. | `financialROI` render trace and financial rules evidence. | Proven locally. |
| CPA | `Total Spend / financialConversions`; gated when spend or selected financial conversions are unavailable. | Same financial spend and financial conversion source. | `financialCPA` trace; UI, Insights, KPI/Benchmark propagation, and report parity regression evidence. | Proven locally for the Overview-originated value path. |
| Pipeline Proxy | Early-signal CRM/ecommerce pipeline estimate; excluded from confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, and Reports. | Active pipeline-capable source configs scoped to the selected GA4 campaign where possible. | Pipeline Proxy trace in `ga4-metrics.tsx` and source modal contract. | Proven locally for exclusion; provider-backed source freshness remains external. |
| Campaign Breakdown rows | Display GA4 row sessions/users/conversions/revenue plus exact campaign-matched imported revenue only; no row allocation. | Selected Overview date range, selected GA4 property, selected campaign/source filter. | `/ga4-breakdown`, `getAcquisitionBreakdown`, row render trace; exact imported campaign matching documented in `OVERVIEW.md`. | Proven locally; live GA4 row availability remains external. |
| Landing Pages rows | Display landing page/source/medium/sessions/users/conversions/revenue from GA4; no imported revenue allocation. | Selected Overview date range, selected GA4 property, selected campaign/source filter. | `/ga4-landing-pages`, `getLandingPagesReport`, exact-key `pageLocation` supplement trace; `ga4-filter` and UI regression evidence. | Proven locally; live GA4 API latency remains external. |
| Conversion Events rows | Display event-name/user/conversion/event-count/revenue values from GA4; no imported revenue allocation. | Selected Overview date range, selected GA4 property, selected campaign/source filter. | `/ga4-conversion-events`, `getConversionEventsReport`, exact-event supplement trace; `ga4-filter` and UI regression evidence. | Proven locally; live GA4 API latency remains external. |
| Revenue/Spend/Pipeline source modals | Show source provenance for the total card without replacing the Overview totals contract. | Campaign-scoped active sources and selected platform context; Pipeline Proxy read-only provenance. | Source modal render, source list endpoints, active-source joins, and delete route guards. | Proven locally for current code; full provider-family lifecycle remains external. |
| Browser-generated GA4 report output | Reuse Overview values and preserve Summary vs financial source split. | Same campaign/property/source scope as the loaded Overview page. | Report output trace in `ga4-metrics.tsx`; recorded UI/report regression evidence. | Proven locally for Overview value propagation; report delivery is Reports scope. |
| Scheduled/server GA4 report output | Rebuild Summary and financial values with the same Overview source model. | Scheduled report campaign/platform scope and GA4 source inputs. | `server/ga4-scheduled-report-pdf.ts` trace; recorded report-email regression evidence for selected scoped financial source. | Proven locally for payload values; deployed scheduler/send execution remains external. |

### End-To-End Trace Matrix

| Path | Traced boundary | Proven behavior | Status |
| --- | --- | --- | --- |
| UI entry to GA4 Overview queries | `client/src/pages/ga4-metrics.tsx` campaign context, selected GA4 property, selected campaign filter, query keys. | Overview queries are campaign/property/source scoped and do not use a post-setup scope picker. | Proven locally. |
| Access control to API endpoints | `server/routes-oauth.ts` GA4 and financial endpoints. | Campaign routes call `ensureCampaignAccess` or equivalent campaign access helpers before returning campaign data. | Proven locally for traced Overview endpoints. |
| Daily metrics path | `/api/campaigns/:id/ga4-daily` to persisted daily rows and optional scoped backfill. | Daily rows feed Summary fallback hierarchy without mirroring GA4 native revenue into imported revenue records; stale-but-nonempty persisted rows are now freshness-flagged and trigger due missing-day backfill attempts. | Proven locally; deployed stale-warning and post-reauthorization provider backfill validated for the affected campaign/property. |
| To-date totals path | `/api/campaigns/:id/ga4-to-date` to `getTotalsWithRevenue`. | Native totals use selected property/campaign filter and totalRevenue to purchaseRevenue fallback. | Proven locally; provider latency is external. |
| Breakdown path | `/api/campaigns/:id/ga4-breakdown` to `getAcquisitionBreakdown`. | Campaign Breakdown values stay row-level GA4 values with selected campaign/property/date scope. | Proven locally. |
| Landing Pages path | `/api/campaigns/:id/ga4-landing-pages` to `getLandingPagesReport`. | Primary rows are supplemented only with same-scope exact-key fallback rows when conversions/revenue are missing. | Proven locally. |
| Conversion Events path | `/api/campaigns/:id/ga4-conversion-events` to `getConversionEventsReport`. | Primary rows are supplemented only by exact event-name fallback rows; unmatched fallback rows are not added. | Proven locally. |
| Imported revenue path | Source setup/import/refresh to `revenue_sources` and `revenue_records`, then `/revenue-to-date`, `/revenue-breakdown`, and `/revenue-sources`. | Active source rows in the campaign/platform context feed Total Revenue and provenance modals. | Proven locally for code path; production-data inventory remains external. |
| Spend path | Source setup/import/refresh to `spend_sources` and `spend_records`, then `/spend-to-date`, `/spend-breakdown`, and `/spend-sources`. | Active source rows in the campaign feed Total Spend and provenance modals. | Proven locally for code path; provider-family lifecycle remains external. |
| Source delete path | Revenue/spend source delete routes to storage soft-delete and recompute calls. | Route-level campaign/source membership is checked before source rows are deactivated. | Proven locally for traced route shape; provider-family user validation remains external. |
| Browser report path | Loaded Overview values to browser-generated report sections. | Report output preserves Summary vs financial source split and CPA source choice. | Proven locally. |
| Scheduled report path | Scheduled report payload builder to Overview summary/financial reconstruction. | Scheduled/server GA4 PDF payload preserves Overview source model. | Proven locally for payload construction; deployed send/snapshot behavior remains Reports/external. |

### Downstream Propagation Matrix

| Downstream consumer | Direct Overview dependency | Evidence used | Status |
| --- | --- | --- | --- |
| Overview cards and tables | Direct render of all Summary, financial, source modal, Campaign Breakdown, Landing Pages, and Conversion Events values. | Current frontend/API/storage/service trace and recorded local tests. | Proven locally. |
| Revenue/Spend/Pipeline source modals | Provenance display for the financial cards and Pipeline Proxy card. | Source endpoint and modal trace. | Proven locally for code; real provider-family lifecycle remains external. |
| GA4 KPIs | Narrow dependency on Overview-originated current values and CPA conversion source. | Overview UI regression coverage only for value propagation. KPI readiness evidence is not reused as Overview proof. | Proven locally for the narrow Overview value path; whole KPI readiness is separate. |
| GA4 Benchmarks | Narrow dependency on Overview-originated current values and CPA source choice. | Overview UI regression coverage only for value propagation. Benchmark readiness evidence is not reused as Overview proof. | Proven locally for the narrow Overview value path; whole Benchmark readiness is separate. |
| GA4 Ad Comparison | Uses Overview-selected financial/source values where wired in the GA4 page. | Frontend prop trace and recorded Overview UI regression coverage. | Proven locally for narrow value propagation; whole Ad Comparison readiness is separate. |
| GA4 Insights | Uses Overview-originated financial CPA and source availability flags. | Frontend trace and recorded regression coverage for Insights CPA propagation. | Proven locally for narrow Overview value propagation; whole Insights readiness is separate. |
| Browser-generated GA4 reports | Uses the loaded Overview value model. | Frontend report trace and recorded regression coverage. | Proven locally for Overview values; report UX/readiness is separate. |
| Scheduled/server GA4 reports | Rebuilds Overview Summary and financial values on the server. | `server/ga4-scheduled-report-pdf.ts` trace and recorded report regression evidence. | Proven locally for values; scheduler execution and email delivery remain external/Reports scope. |
| Campaign DeepDive | Separate aggregate path that previously needed parity with Overview financial semantics. | Existing Overview-related hardening history only for the direct aggregate parity boundary. | Proven only for the documented parity boundary; whole DeepDive readiness is separate. |
| Alerts and notifications | No direct Overview alert emission; affected only through KPI/Benchmark current-value paths. | Narrow KPI/Benchmark propagation trace. | No direct Overview path to certify. |
| Future platform Overviews | GA4 Overview docs provide process and structure only. | No target-platform evidence. | Unproven for every future platform until its own inventory, trace, tests, and deployed caveats are completed. |

### Lifecycle And Source-Safety Matrix

| Lifecycle path | Overview requirement | Current evidence | Status |
| --- | --- | --- | --- |
| GA4 source connect/select | Saved GA4 property and campaign/source filter define Overview scope. | Architecture and GA4 docs, UI/API trace. | Proven locally. |
| GA4 refresh/backfill | Refresh selected campaign/property data without changing source meaning or imported revenue records. | `/ga4-daily`, scheduler docs, and daily-row trace. | Proven locally for code; deployed scheduler run is external. |
| Revenue source add/import | New source rows must affect Total Revenue and provenance only inside the campaign/platform context. | Source endpoint/storage trace. | Proven locally for code; provider-family validation remains external. |
| Revenue source edit/refresh | Existing source identity should be updated or replaced without duplicate totals. | Storage/source contract and historical hardening docs. | Partially proven locally; real provider-family lifecycle validation remains Current Commit work. |
| Revenue source delete/deactivate | Remove only the verified source contribution from Total Revenue and provenance. | Route membership guard and storage soft-delete trace. | Proven locally for route shape; provider-family user validation remains external. |
| Spend source add/import | New spend rows must affect Total Spend and derived financial metrics only inside the campaign. | Source endpoint/storage trace. | Proven locally for code; provider-family validation remains external. |
| Spend source edit/refresh | Existing spend source identity should update without duplicate totals. | Storage/source contract and historical hardening docs. | Partially proven locally; real provider-family lifecycle validation remains Current Commit work. |
| Spend source delete/deactivate | Remove only the verified source contribution from Total Spend and derived metrics. | Route membership guard and storage soft-delete trace. | Proven locally for route shape; provider-family user validation remains external. |
| Existing damaged data cleanup | Known synthetic GA4 revenue record damage was cleaned within the documented boundary. | Completed hardening history and current docs. | Proven only for that boundary; broader production source damage inventory remains external Current Commit work. |

### Negative-Case Matrix

| Negative case | Expected behavior | Evidence | Status |
| --- | --- | --- | --- |
| User lacks campaign access | Overview endpoints fail closed instead of returning another campaign's data. | `ensureCampaignAccess` and campaign access helper trace. | Proven locally for traced endpoints. |
| Missing GA4 property or token | GA4 endpoints return guarded empty/error states instead of broadening scope. | Route/service trace. | Proven locally. |
| Numeric live property without explicit mock | Numeric property is treated as live, not automatically mocked. | GA4 route/service docs and tests recorded in broader validation. | Proven locally. |
| Primary GA4 rows empty | Use documented same-scope fallback where implemented; otherwise render empty stable state. | `getTotalsWithRevenue`, `getLandingPagesReport`, `getConversionEventsReport`, `getAcquisitionBreakdown` trace. | Proven locally. |
| Primary rows have traffic but missing conversions/revenue | Supplement only matching rows from same-scope fallback; do not add unmatched rows. | Landing Pages exact-key and Conversion Events exact-event trace/tests. | Proven locally. |
| Imported revenue exists | Add only to Total Revenue and exact Campaign Breakdown matches; do not allocate to Landing Pages or Conversion Events. | Frontend render trace and `OVERVIEW.md` contract. | Proven locally. |
| Spend missing or zero | ROAS, ROI, and CPA show gated unavailable states instead of invented values. | Financial render trace and financial rules evidence. | Proven locally. |
| Pipeline Proxy exists | Keep separate from confirmed revenue and downstream derived financial metrics. | Pipeline Proxy trace and exclusion contract. | Proven locally. |
| Inactive or deleted source rows | Exclude inactive sources from revenue/spend totals and provenance. | Active-source joins in storage and source endpoint trace. | Proven locally for code; production orphan inventory remains external. |
| Duplicate or orphan production records | Do not assume clean data; perform bounded read-only inventory before cleanup. | Current Commit Queue. | Unproven externally until inventory is run. |

### Test And Validation Coverage Matrix

| Evidence area | Recorded validation | What it proves | Limit |
| --- | --- | --- | --- |
| Financial source selection and revenue additivity | `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts`; broader 9-file suite; `npm run check`. | Summary and financial source split, native plus imported revenue, CPA conversion source, no response-shape changes. | Recorded evidence, not rerun during this doc-only certification update. |
| Overview propagation hardening | `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`; broader 11-file suite; `npm run check`; `git diff --check` for changed files. | Summary conversions, Insights CPA propagation, KPI create fallback source choice, scheduled/server Summary parity, Conversion Events fallback. | Recorded evidence, not whole KPI/Benchmark/Insights certification. |
| Landing Pages and Conversion Events fallback | `server/ga4-filter.test.ts` and `server/ga4-ui-regression.test.ts` recorded passes. | Exact-key/exact-event fallback supplement behavior and no unmatched fallback-row allocation. | Live GA4 provider latency remains external. |
| Report payload values | `server/report-email-regression.test.ts` and scheduled PDF trace. | Selected scoped financial source survives scheduled/server report value generation. | Provider delivery, inbox receipt, scheduler run, and snapshot delivery semantics remain Reports/external scope. |
| Source safety/additivity | `server/latest-day-revenue-regression.test.ts`, `server/latest-day-spend-regression.test.ts`, `server/source-safety-regression.test.ts`, `server/spend-source-additivity.test.ts` recorded in validation suites. | Active-source and provenance boundaries that feed Overview totals. | Real provider-family lifecycle validation remains external. |
| Current Commit 1 harness and documentation update | PowerShell syntax check for `scripts/ga4_overview_current_commit_1_validation.ps1`; `git diff --check -- GA4/OVERVIEW_PRODUCTION_READINESS.md scripts/ga4_overview_current_commit_1_validation.ps1`. | The validation harness parses and the doc/script diff has no whitespace errors. | Deployed endpoint evidence has since been recorded for one campaign/property; scheduled/server report payload evidence remains external. |
| Current Commit 2 source lifecycle harness and documentation update | PowerShell syntax check for `scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1`; trailing-whitespace scan for the script; `git diff --check -- GA4/OVERVIEW_PRODUCTION_READINESS.md`. | The source lifecycle snapshot harness parses, is GET-only, and the doc diff has no whitespace errors. | Does not prove provider-family add/edit/refresh/delete behavior until before/after snapshots are captured around real provider actions. |
| GA4 Overview browser validation runner | `node --check client/public/ga4-overview-validation-runner.js`; `git diff --check -- client/public/ga4-overview-validation-runner.js GA4/OVERVIEW_VALIDATION_RUNNER.md GA4/OVERVIEW_AUTOMATED_VALIDATION.md GA4/OVERVIEW_PRODUCTION_READINESS.md`. | Adds a static browser-loaded validation helper for logged-in deployed sessions. `snapshot`, `before`, `after`, `overviewPack`, `sourceDamageInventory`, `hubspotInventory`, `hubspotProvenance`, and `googleSheetsVariantPack` are GET-only/read-only evidence functions; `refreshSpend` and `refreshRevenue` are explicit source-scoped POST helpers for already-existing run-now validation routes. The helper summarizes totals, endpoint status, source counts, target-source presence, configured Google Sheets fixture mapping checks, and pass/fail without printing full endpoint rows. | Evidence tooling only. It does not change analytics behavior, production calculations, source persistence, scheduler behavior, report behavior, ownership checks, or readiness status by itself. |
| Current Commit 2a Google Sheets revenue refresh validation trigger | `npm test -- server/ga4-auto-refresh-regression.test.ts`; `npm run check`. | The route is campaign/source-scoped, requires campaign access, reuses the scheduler Google Sheets revenue reprocess function, and avoids a full daily scheduler run. | Does not prove the deployed route until the pushed commit is deployed and run against the changed Sheet with before/after endpoint and UI evidence. |
| Current Commit 2b revenue source delete false-failure guard | `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts`; `npm run check`; deployed DELETE evidence captured on `2026-07-01T18:28:32.608Z`; UI parity confirmed by user on `2026-07-01`. | GA4 revenue source mutation routes keep source deletion/update response semantics stable even if downstream GA4 KPI/Benchmark recompute fails after the source mutation; deployed evidence proves the fixed response for disposable source `32661325-d2a5-404f-a898-2c84e4275809`. | Closed for this deployed Google Sheets revenue delete/deactivate path only; does not certify other campaigns/properties/source families. |
| Current Commit 2c revenue import/update response latency guard | `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts`; `npm run check`; deployed latency timing user-confirmed on `2026-07-01`. | GA4 revenue source process routes no longer block the user-facing success response on the heavyweight GA4 KPI/Benchmark daily/history/alert job after source records are durable; source-backed campaign current values still refresh synchronously before the response. | Closed for the user-confirmed deployed timing check only; no exact elapsed-time packet or numeric SLA is recorded in this file. |
| Current Commit 2d Google Sheets spend refresh validation trigger | `npm test -- server/ga4-auto-refresh-regression.test.ts`; `npm run check`; deployed run-now evidence captured on `2026-07-01T19:52:43.021Z`; UI parity confirmed by user on `2026-07-01`. | The route is campaign/source-scoped, requires campaign access, reuses the scheduler Google Sheets spend reprocess function, and avoids a full daily scheduler run; deployed evidence proves the route refreshed source `8f67b03f-a00b-434f-b81f-db1b2b951595` to `$198.75` without creating a duplicate source or changing imported revenue. | Closed for this deployed Google Sheets spend run-now refresh/reprocess path only; does not certify daily scheduler timer execution, delete/deactivate, other campaigns/properties/source families, report/email propagation, or GA4 native provider stability. |
| Current Commit 2e Google Sheets spend startup-fired scheduler evidence | Deployed scheduler evidence captured on `2026-07-01T21:15:15.453Z`; user UI validation confirmed and startup flag removal confirmed on `2026-07-01`. | The deployed scheduler path refreshed active Google Sheets spend source `618e5e12-0f3f-44a2-837a-d2677ad95f64` from baseline `$180.20` to `$678.95`, kept the same source ID, created no duplicate Google Sheets spend source, kept imported revenue unchanged at `$600`, and all checked endpoints returned HTTP `200`. | Closed for this deployed startup-fired Google Sheets spend scheduler path only; normal wall-clock daily timer execution remains external if strict scheduled-hour proof is required, and this does not certify other campaigns/properties/source families, report/email propagation, or GA4 native provider stability. |
| GA4 daily stale-row freshness guard | `npm test -- server/ga4-reporting-day-cutoff-regression.test.ts`; `npm run check`; deployed diagnostic packet from `2026-07-03T07:48:10.650Z` identified stale persisted rows through `2026-06-30` while `dataThroughDate` was `2026-07-02`; deployed recheck on `2026-07-03T08:44:38.952Z` returned `refreshIsStale: true` and the UI displayed the stale daily-history warning; after GA4 reauthorization, deployed daily diagnostic on `2026-07-03T09:47:21.991Z` returned `dailyEndpointPasses: true`, `authStillOk: true`, `hasRowsAfterJune30: true`, `latestReachedDataThroughDate: true`, and `staleCleared: true` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`; user confirmed the GA4/Insights Trends UI shows dates after `2026-06-30` on `2026-07-03`. | The `/ga4-daily` route now treats stale-but-nonempty persisted rows as stale when due completed dates are missing, attempts a provider backfill for due missing daily rows, preserves existing stored rows with `providerRefreshWarning` if provider refresh fails, and backfilled fresh daily rows once the GA4 connection was reauthorized. | Closed for deployed stale detection/warning, post-reauthorization daily backfill, and GA4/Insights Trends UI parity on the affected campaign/property. This does not prove future GA4 provider availability, other campaign/property pairs, or normal wall-clock scheduled-hour execution. |
| GA4 timeseries reconnect response guard | `npm test -- server/ga4-reporting-day-cutoff-regression.test.ts`; `npm run check`; deployed console packet on `2026-07-03` showed `/ga4-timeseries` returned HTTP `500` with `error: AUTO_REFRESH_NEEDED` and no reconnect flag; after reconnect, deployed provider-auth check returned HTTP `200`, `ok: true`, `success: true`, and no `requiresReauthorization` flag. | The `/ga4-timeseries` route now maps `AUTO_REFRESH_NEEDED` and `TOKEN_EXPIRED` to HTTP `401` with `requiresReauthorization: true` and a reconnect message, matching the GA4 daily route's auth-error semantics. | Local negative-branch fix is covered by regression tests; deployed operational auth is healthy after reconnect. The deployed broken-token negative branch is no longer reproducible without deliberately invalidating GA4 auth and remains not separately rechecked. |
| GA4 Connected Platforms reconnect-required badge | `npm test -- server/ga4-ui-regression.test.ts`; `npm run check`; commit `3b253ef2` Render deploy user-confirmed; deployed console packet returned `/ga4-metrics` HTTP `200`, `ok: true`, `requiresReauthorization: false`, and no error/message for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`. | Campaign Detail now maps `/ga4-metrics` HTTP `401` responses with `requiresReauthorization` into a GA4 card state that shows `Reconnect Required`, renders an inline reconnect warning, and expands to the existing GA4 OAuth flow instead of continuing to show only `Connected`; deployed operational auth is currently healthy. | Local UI guard and deployed healthy-provider state are covered; the deployed negative reconnect UI state remains unproven because no real auth failure is currently present and production GA4 should not be deliberately broken. Does not change GA4 calculations, source totals, scheduler behavior, storage, API ownership, or provider token semantics. |
| Current Commit 2f Google Sheets spend second-campaign add/import evidence | Deployed second-campaign cleanup snapshot captured on `2026-07-03T11:30:06.922Z`; after-add snapshot captured on `2026-07-03T11:42:32.717Z`; endpoint status packet captured on `2026-07-03T11:45:16.366Z`; user UI validation confirmed `$507.70` on `2026-07-03`; post-fix endpoint recheck captured on `2026-07-03T12:17:39.484Z`; post-deploy UI reconfirmation passed on `2026-07-03`. | Campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418` was cleaned to zero Google Sheets spend sources, then one Google Sheets spend source was imported with expected spend `$507.70`; `exactlyOneGoogleSheetsSpendSourceAdded`, `spendIncreasedByExpected`, and `revenueUnchanged` passed; revenue/spend endpoints returned HTTP `200`; the visible GA4 Overview spend card/source modal matched `$507.70`; post-fix endpoint recheck returned `overallPass: true`, spend breakdown `$507.70`, one Google Sheets spend source, and native `ga4ToDate` HTTP `200`. | Closed only for this second-campaign Google Sheets spend add/import UI/source-modal financial path, the post-fix endpoint recheck, and post-deploy UI reconfirmation after commit `3b25a01a`. The compact after packet still showed `spendToDate: 0` while spend breakdown/UI showed `$507.70`; refresh/reprocess and delete/deactivate were later closed in separate 2f packets. |
| Current Commit 2f Google Sheets spend second-campaign edit/update evidence | Deployed after-edit packet captured on `2026-07-03T12:34:20.583Z`. | Existing second-campaign Google Sheets spend source changed from `$507.70` to `$706.45` with expected delta `$198.75`; all checked endpoints passed; native `ga4ToDate` stayed healthy; exactly one Google Sheets spend source remained; spend breakdown matched `$706.45`; revenue source count stayed `0`; no duplicate spend source was created. | Closed only for this second-campaign Google Sheets spend edit/update endpoint path. Refresh/reprocess and delete/deactivate were later closed in separate 2f packets. |
| Current Commit 2f Google Sheets spend second-campaign refresh/reprocess endpoint evidence | Deployed run-now packet captured on `2026-07-03T12:46:42.256Z`; deployed 2f.2 self-heal packet captured on `2026-07-03T13:14:11.596Z` for source `62772549-88dc-4cc5-bfe6-2e991d518ef5`; user UI edit-mode validation confirmed. | The first run-now trigger returned HTTP `200` and `successField: true`; endpoints passed; the same source ID remained; exactly one Google Sheets spend source remained; native `ga4ToDate` stayed healthy; spend changed from `$706.45` to `$807.70`; revenue source count stayed `0`. User clarified `$807.70` is the correct mapped total for both campaigns after changing one sheet campaign amount from `$198.75` to `$300`. After 2f.2 deploy, rerunning the same source refresh returned HTTP `200`, `success: true`, `overallPass: true`, `spendStillCorrect: true`, `sameSourceStillPresent: true`, and edit mode showed updated sheet data instead of stale `$198.75`. | Closed only for this second-campaign Google Sheets spend refresh/reprocess totals, source identity, and edit-preview metadata path. It does not certify other tabs/mappings, other campaigns/properties, normal wall-clock scheduler execution, reports/emails, or other source families. |
| Current Commit 2f Google Sheets spend second-campaign delete/deactivate evidence | Before snapshot captured on `2026-07-03T13:26:16.247Z`; after-delete packet captured on `2026-07-03T13:27:43.736Z`; user UI validation confirmed. | Source `62772549-88dc-4cc5-bfe6-2e991d518ef5` was removed from spend sources and spend breakdown; spend dropped by expected `$807.70` to `$0`; revenue breakdown stayed `$0`; revenue source count stayed `0`; all six checked revenue/spend endpoints passed; spend card/source modal no longer showed the Google Sheets spend source. | Closed only for this second-campaign Google Sheets spend delete/deactivate source/totals/UI path. It does not certify other tabs/mappings, other campaigns/properties, normal wall-clock scheduler execution, reports/emails, or other source families. |
| Current Commit 2f.1 GA4 to-date no-completed-window guard | `npm test -- server/ga4-reporting-day-cutoff-regression.test.ts`; `npm run check`; deployed endpoint packet captured on `2026-07-03T12:17:39.484Z`. | `/api/campaigns/:id/ga4-to-date` now returns scoped zero native GA4 totals with `noCompletedWindow: true` when the selected campaign's start/created date is later than the latest completed GA4 reporting day, instead of calling GA4 Data API with an inverted date window. Deployed packet for campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418` returned HTTP `200`, `successField: true`, `noCompletedWindow: true`, and `checks.ga4ToDateFixed: true`. | Closed for this deployed second-campaign native GA4 no-completed-window endpoint path. It does not certify future GA4 provider availability, a later valid completed-day provider window, or the remaining Current Commit 2f source lifecycle actions. |
| Current Commit 2f.2 Google Sheets spend refresh edit-preview metadata guard | `npm test -- server/ga4-auto-refresh-regression.test.ts`; `npm run check`; deployed self-heal packet captured on `2026-07-03T13:14:11.596Z`; user UI edit-mode validation confirmed. | `/api/campaigns/:id/spend/sheets/process` now persists fresh `sheetHeaders`, `sheetSampleRows`, and `sheetRowCount` from the sheet rows fetched during process/reprocess. Deployed validation for source `62772549-88dc-4cc5-bfe6-2e991d518ef5` returned HTTP `200`, `success: true`, `overallPass: true`, `spendStillCorrect: true`, and `sameSourceStillPresent: true`; edit mode showed updated sheet data instead of stale `$198.75`. | Closed only for this deployed source refresh/edit-preview metadata path. It does not certify other Google Sheets spend sources, other tabs/mappings, other campaigns/properties, delete/deactivate, reports/emails, or normal wall-clock scheduler execution. |
| Google Sheets spend add/import deployed evidence | Deployed browser-console after-snapshot captured on `2026-07-01T19:00:36.141Z`; user UI validation confirmed on `2026-07-01`. | One Google Sheets spend source was visible after import for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`: source `8f67b03f-a00b-434f-b81f-db1b2b951595`, spend to-date `$240`, spend breakdown `$240`, and all checked endpoints HTTP `200`. | Closed only for this deployed Google Sheets spend add/import source/totals/UI path; the simplified packet did not archive a full before JSON or prove edit, refresh, delete, other campaigns, other tabs/mappings, daily scheduler timer execution, report/email propagation, or GA4 native provider stability. |
| Google Sheets spend edit/update deployed evidence | Deployed browser-console after-snapshot captured on `2026-07-01T19:15:03.362Z`; user UI validation confirmed on `2026-07-01`. | Source `8f67b03f-a00b-434f-b81f-db1b2b951595` persisted as the only active Google Sheets spend source; spend to-date, spend breakdown, and target breakdown amount all reconciled to `$420.20`; imported revenue stayed `$600`; all checked endpoints HTTP `200`. | Closed only for this deployed Google Sheets spend edit/update source/totals/UI path; the simplified packet did not archive a full before JSON or prove refresh, delete, other campaigns, other tabs/mappings, daily scheduler timer execution, report/email propagation, or GA4 native provider stability. |
| Google Sheets spend delete/deactivate deployed evidence | Deployed before/after browser-console snapshot captured on `2026-07-01T20:00:40.616Z`; user UI validation confirmed on `2026-07-01`. | Source `8f67b03f-a00b-434f-b81f-db1b2b951595` was removed from spend sources and spend breakdown; spend dropped from `$198.75` to `$0`; imported revenue stayed `$600`; all checked endpoints HTTP `200`. | Closed only for this deployed Google Sheets spend delete/deactivate source/totals/UI path; does not certify other campaigns, other tabs/mappings, daily scheduler timer execution, report/email propagation, or other source families. |
| Current Commit 2j spend import/update response latency guard | `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts`; `npm run check`; `git diff --check -- server/routes-oauth.ts server/ga4-source-lifecycle-recompute-regression.test.ts GA4/OVERVIEW_PRODUCTION_READINESS.md`. | Spend source process routes now return after source rows and spend records are durable and `campaign.spend` is recalculated; the heavier GA4 KPI/Benchmark recompute is scheduled after the response for manual, LinkedIn Ads, CSV, and Google Sheets spend add/import or edit/update routes. | Local code/regression evidence plus user-confirmed deployed timing/UI responsiveness after commit `29c67820` deployed on `2026-07-03`. No exact elapsed-time packet or numeric SLA is recorded. |

### Documentation Alignment Matrix

| Source document | How it was used | Status |
| --- | --- | --- |
| `AGENTS.md` | Operating contract, anti-overclaim standard, architecture preservation, validation and output rules. | Applied. |
| `ARCHITECTURE_USER_JOURNEY.md` | User journey, platform/campaign split, campaign Overview role, downstream action surfaces. | Applied. |
| `PRODUCTION_READINESS.md` | Required certification standard, value inventory, trace/downstream/lifecycle/negative-case/test matrices. | Applied. |
| `GA4/README.md` | GA4 platform entry point and current claims treated as claims to verify, not evidence by themselves. | Applied without overclaiming. |
| `GA4_DEVELOPMENT_WORKFLOW.md` | GA4 trace-before-edit workflow and source checklist. | Applied. |
| `GA4/OVERVIEW.md` | Intended Overview behavior and value contracts. | Applied as the behavior contract. |
| `GA4/FINANCIAL_SOURCES.md` | Revenue/spend/Pipeline Proxy source contracts and lifecycle constraints. | Applied for narrow Overview financial paths. |
| `GA4/REFRESH_AND_PROCESSING.md` | Refresh and scheduler contracts that feed Overview. | Applied for narrow Overview refresh paths. |
| `GA4/KPIS_PRODUCTION_READINESS.md` | Structure/process template only. | Not used as Overview proof. |
| `GA4/BENCHMARKS_PRODUCTION_READINESS.md` | Structure/process template only. | Not used as Overview proof. |

## Current Commit Queue

This queue is the clean-certification queue for GA4 Overview. The detailed historical fix queue below preserves earlier implementation labels, but this table is the current source of truth for outstanding Overview work.

| Current Commit | Status | Scope | Smallest safe action | Blocks current local Overview certification? |
| --- | --- | --- | --- | --- |
| Current Commit 0: Strict clean certification documentation update | Completed in this documentation pass. | Update this file with explicit value inventory, trace, downstream, lifecycle, negative-case, validation, and documentation matrices. | Documentation-only update to `GA4/OVERVIEW_PRODUCTION_READINESS.md`; no runtime code changes. | No. |
| Current Commit 1: Provider/deployed Overview validation pack | Deployed Overview endpoint evidence captured for the listed campaign/property; scheduled/server report payload evidence remains external, not a confirmed code bug. | Real GA4 provider/deployed validation for Summary, financial cards, Campaign Breakdown, Landing Pages, Conversion Events, source totals, and scheduled/server payload values. | Endpoint packet passed on `2026-07-01T12:21:31.789Z`; capture scheduled/server payload evidence separately through the report validation path before making a blanket report-output claim. | No for local code-scope certification; endpoint portion no for deployed Overview endpoint certification; report payload remains external for blanket scheduled/server certification. |
| Current Commit 2: Real source-family lifecycle validation | Local source-lifecycle snapshot/compare harness implemented; provider-family lifecycle evidence remains external, not a confirmed code bug. | Revenue and spend source families that can feed Overview totals and modals. | Use `scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1` before and after exactly one source-family add/import, edit, refresh, or delete action, then record the before/after source IDs, totals, and provenance reconciliation. | No for local code-scope certification; yes for provider-family lifecycle certification until each source family is validated. |
| Current Commit 2a: Google Sheets revenue refresh validation trigger | Implemented, deployed, and validated for the recorded run-now source path. | One active Google Sheets revenue source in one authorized campaign. | Add a campaign/source-scoped validation route that reuses the scheduler Google Sheets revenue reprocess function for `/api/campaigns/:id/revenue-sources/:sourceId/google-sheets-refresh/run-now`; do not run the full daily scheduler, unrelated providers, reports, emails, alerts, or unrelated campaigns. | No for local code-scope certification; no for the recorded Google Sheets revenue run-now refresh/reprocess path; yes for daily scheduler timer execution and unvalidated source families. |
| Current Commit 2b: Revenue source delete false-failure response guard | Completed for the recorded deployed Google Sheets revenue delete/deactivate path. | Google Sheets revenue delete/deactivate false-failure observed during Current Commit 2. | Guard GA4 KPI/Benchmark recompute inside `recomputeCampaignDerivedValues`; deployed evidence proved HTTP `200`/`success: true`, source removal, expected revenue decrease, and visible UI parity. | No for local code-scope certification; no for the recorded Google Sheets revenue delete/deactivate path; yes for unvalidated campaigns/properties/source families. |
| Current Commit 2c: Revenue import/update response latency guard | User-confirmed deployed latency timing validation complete. | GA4 revenue source add/import and edit/update paths for source-backed revenue. | Keep source writes and source-backed campaign current-value refresh synchronous, then schedule the heavier GA4 KPI/Benchmark daily/history/alert reconciliation after the response so imports/updates are not blocked by live GA4/Data API or global alert work. | No for local code-scope certification; no for the user-confirmed deployed latency check; no exact elapsed-time SLA is certified. |
| Current Commit 2d: Google Sheets spend refresh validation trigger | Implemented, deployed, and validated for the recorded run-now source path. | One active Google Sheets spend source in one authorized campaign. | Add a campaign/source-scoped validation route that reuses the scheduler Google Sheets spend reprocess function for `/api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now`; do not run the full daily scheduler, unrelated providers, reports, emails, alerts, or unrelated campaigns. | No for local code-scope certification; no for the recorded Google Sheets spend run-now refresh/reprocess path; yes for daily scheduler timer execution. |
| Current Commit 2e: Google Sheets spend daily scheduler timer execution | Completed for the recorded startup-fired deployed scheduler path; normal wall-clock daily timer proof remains external if strict scheduled-hour evidence is required. | Daily external-value auto-refresh scheduler for Google Sheets spend in the validated campaign/source path. | Temporarily set `AUTO_REFRESH_RUN_ON_STARTUP=true`, redeployed/restarted once, captured before/after endpoint evidence and UI parity for source `618e5e12-0f3f-44a2-837a-d2677ad95f64`, then removed the startup flag. | No for local code-scope certification; no for the recorded startup-fired scheduler path; yes only if the requested certification requires proof of the normal scheduled clock-time run. |
| Current Commit 2e.1: GA4 daily stale-row freshness guard | Completed for deployed stale detection/warning, post-reauthorization daily backfill, and UI Trends parity on the affected campaign/property. | `/api/campaigns/:id/ga4-daily` persisted daily rows that feed Overview/Insights trends. | Treat due missing completed dates as stale even when older stored rows exist; attempt a provider backfill for due missing dates; if provider refresh fails, return existing rows with explicit `providerRefreshWarning` and `refreshIsStale: true` instead of silently claiming freshness. | No for local code-scope certification; no for the deployed affected-campaign stale-warning/backfill path; yes for other campaign/property pairs and normal wall-clock scheduled-hour proof if those are requested. |
| Current Commit 2e.2: GA4 timeseries reconnect response guard | Implemented and regression-covered; deployed operational provider-auth check is healthy after reconnect, but the deployed broken-token negative branch was not re-triggered. | `/api/campaigns/:id/ga4-timeseries` live provider path used for diagnosing/backfilling GA4 daily freshness. | Return HTTP `401`, `requiresReauthorization: true`, and a reconnect message for `AUTO_REFRESH_NEEDED` and `TOKEN_EXPIRED` instead of a generic HTTP `500`. | No for local code-scope certification after tests; no for restored deployed GA4 provider access; yes only for deployed negative-branch proof unless a future token-expired state naturally occurs. |
| Current Commit 2e.3: GA4 Connected Platforms reconnect-required badge | Implemented, pushed in commit `3b253ef2`, Render deploy user-confirmed, and deployed operational `/ga4-metrics` auth health validated; deployed negative reconnect UI state remains not reproducible without a real token failure. | Campaign Detail `Connected Platforms` GA4 card. | Map the existing `/ga4-metrics` provider-auth failure into `requiresReauthorization`, render `Reconnect Required`, and expose the existing GA4 OAuth flow from the card without adding new provider calls or changing GA4 metrics/source/scheduler behavior. | No for local code-scope certification after tests; no for deployed healthy-provider operation; yes only for deployed negative reconnect UI proof until a real or controlled non-production reconnect-required state is available. |
| Current Commit 2f: Google Sheets spend campaign/property portability | Completed for the validated second-campaign Google Sheets spend lifecycle: add/import, edit/update, refresh/reprocess including 2f.2 edit-preview self-heal, and delete/deactivate. | Campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418` / source `62772549-88dc-4cc5-bfe6-2e991d518ef5`. | Evidence proves the source lifecycle in this second campaign/property only. Do not repeat basic Google Sheets spend lifecycle validation unless a new bug or source shape is being tested. | No for local code-scope certification; no for this deployed second-campaign Google Sheets spend lifecycle; yes for other tabs/mappings if tab/mapping breadth certification is required, other campaigns/properties, normal wall-clock scheduler execution, reports/emails, and other source families. |
| Current Commit 2f.1: GA4 to-date no-completed-window guard | Completed for deployed second-campaign endpoint validation. | `/api/campaigns/:id/ga4-to-date` for a selected campaign/property when the campaign start/created date is later than the latest completed GA4 reporting day. | Return scoped zero native GA4 totals with `noCompletedWindow: true` before calling the provider when `startDateUsed > endDateUsed`; preserve auth, campaign access, property scoping, imported revenue/spend endpoints, scheduler behavior, and source behavior. Deployed packet on `2026-07-03T12:17:39.484Z` passed for campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418`. | No for local code-scope certification; no for the deployed no-completed-window endpoint path; yes for future valid completed-day provider data and the remaining Current Commit 2f lifecycle evidence. |
| Current Commit 2f.2: Google Sheets spend refresh edit-preview metadata guard | Completed for deployed source `62772549-88dc-4cc5-bfe6-2e991d518ef5`. | Google Sheets spend refresh/reprocess source metadata used by edit mode after `/spend/sheets/process`. | Persist fresh sheet preview metadata from the fetched rows during process/reprocess so edit mode no longer shows stale `mappingConfig.sheetSampleRows` after a successful refresh. Local tests passed; deployed self-heal packet on `2026-07-03T13:14:11.596Z` passed; user confirmed edit mode showed updated sheet data instead of stale `$198.75`. | No for local code-scope certification; no for this deployed second-campaign source refresh/edit-mode path; yes for other sources, other tabs/mappings, delete/deactivate, reports/emails, and normal wall-clock scheduler execution. |
| Current Commit 2g.0: GA4 Overview validation runner | Implemented, committed, pushed, deployed, and browser-load validated by the user. | Repeated GA4 Overview endpoint evidence capture for source lifecycle actions. | Load `/ga4-overview-validation-runner.js` in a logged-in deployed browser session, then use `GA4OverviewValidation.before(...)`, one UI/provider action, and `GA4OverviewValidation.after(...)`. Use explicit `refreshSpend`/`refreshRevenue` only for run-now refresh validation. | Does not change or certify Overview behavior. It only reduces one-off console snippets and keeps future evidence packets consistent. |
| Current Commit 2i: GA4 Overview automated validation pack | Implemented, pushed in commit `4cf7d0b8`, deployed, and user-validated in a logged-in deployed browser session on `2026-07-03T19:10:12.204Z`. | Repeatable GA4 Overview endpoint health, native GA4 daily/to-date/breakdown/table endpoints, source-backed revenue/spend endpoints, stale daily-row status, and optional saved-report snapshot/PDF smoke validation. | `GA4OverviewValidation.overviewPack(...)` returned `overallPass: true` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`: all 14 checked endpoints passed, no reauthorization was required, native GA4 to-date and breakdown endpoints passed, financial endpoints passed, daily history was not stale, landing pages and conversion events endpoints passed, and `failedEndpoints` was empty. | Closed for deployed automated Overview endpoint/freshness/source-total smoke evidence only. Does not mutate analytics data, source records, scheduler state, or calculations. Still does not prove UI pixel parity, PDF text/value parity, inbox delivery, untested source families, or future provider behavior by itself. |
| Current Commit 2g: Google Sheets mapping variant automated pack | Closed for the configured deployed Google Sheets spend fixture on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`; unlisted mapping shapes remain unproven. | Configured Google Sheets revenue/spend tab and mapping-shape evidence for already-created fixture sources; not another basic lifecycle retest. | Deployed `GA4OverviewValidation.googleSheetsVariantPack(...)` on `2026-07-03T21:09:01.553Z` returned `overallPass: true`, `allVariantsPass: true`, no duplicate active Google Sheets revenue/spend signatures, spend breakdown `$678.95`, one spend source, and user-confirmed UI Total Spend/source modal parity at `$678.95`. | No for local code-scope certification; no for this configured Google Sheets spend fixture. Yes remains for unlisted Google Sheets mapping shapes and other source families. |
| Current Commit 2h: Overview financial report/email propagation for source-backed spend | Closed for the recorded deployed report API/snapshot/PDF endpoint path, user-confirmed PDF value parity, and user-confirmed deployed report email delivery for the same GA4 Overview Report path. | Browser/downloaded report values, scheduled/server report values, and email delivery after source-backed spend changes. | Deployed `GA4OverviewValidation.reportPack({ createSnapshot: true })` returned `overallPass: true` on `2026-07-03T19:24:20.738Z` for report `c5a9ea60-3c0f-4809-98bf-7a5a0b118f9f` (`GA4 Overview Report`) and snapshot `5b8ea82b-628b-47a6-a354-afa49ceb68d7`; user inspected/downloaded the generated PDF and confirmed the visible values matched Overview; user then confirmed deployed report email delivery validation passed. | No for local Overview code-scope certification; no for this recorded deployed report snapshot/PDF/email path. Yes remains for future scheduled/test email deliveries outside this packet and for untested report variants. |
| Current Commit 2j: Spend import/update response latency guard | Implemented, pushed in commit `29c67820`, deployed, and user-confirmed for timing/UI responsiveness. | Manual, LinkedIn Ads, CSV, and Google Sheets spend process routes that back Overview Total Spend and spend source provenance. | Keep spend source writes, spend records, and `campaign.spend` recalculation synchronous; move only the downstream GA4 KPI/Benchmark recompute to post-response background work for spend add/import and edit/update routes. | No for local code-scope certification after tests; no for the user-confirmed deployed timing/UI responsiveness gate. No exact elapsed-time SLA is certified. |
| Current Commit 3: Production source-damage inventory | Closed for deployed target campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`; read-only inventory returned `overallPass: true`. | Production/staging inventory for orphan, duplicate, inactive, or platform-context-drifted revenue/spend records outside the already documented synthetic-GA4-revenue cleanup boundary. | Deployed `GA4OverviewValidation.sourceDamageInventory({ campaignId })` on `2026-07-03T20:10:30.499Z` returned HTTP `200`, `readonly: true`, `inventoryPass: true`, `overallPass: true`, and no orphan, inactive-source-record, duplicate-active-source, or unexpected-platform-context candidates for the target campaign. | No for local code-scope certification; no for this target-campaign production inventory. Yes remains for other campaigns/scopes not inventoried. |

If any Current Commit discovers an actual Overview bug, lower the affected path to unproven, add the exact smallest runtime fix as the next Current Commit, and do not call that path production-ready until root cause, tests, docs, and any bounded cleanup are complete.

### Current Commit 1 Root Cause And Smallest Safe Fix

User-reported task:

- proceed with Current Commit 1 by doing root cause analysis and implementing the smallest safe fix with no Overview side effects.

Confirmed root cause:

- Current Commit 1 was not a confirmed GA4 Overview calculation, scoping, scheduler, source, report, or UI bug.
- The blocker was an evidence-capture gap: local code traces and regression tests covered the Overview model, but there was no repeatable provider/deployed validation packet for the same Overview value paths.
- The existing `/api/campaigns/:id/ga4-diagnostics` endpoint was useful but narrow; it exposed breakdown provenance and warnings, not a complete Current Commit 1 packet across Summary inputs, financial inputs, Campaign Breakdown, Landing Pages, Conversion Events, source totals, and optional scheduler evidence.
- Because the GA4 Overview page already calls diagnostics, broadening that runtime endpoint would add provider/API work to normal UI loads and increase regression risk.

Smallest safe fix implemented:

- Added `scripts/ga4_overview_current_commit_1_validation.ps1` as an opt-in evidence-capture harness.
- The script defaults to GET-only requests against the existing deployed Overview endpoints and writes one JSON validation packet for review.
- It does not change server routes, UI queries, calculations, source persistence, scheduler behavior, report generation, KPI/Benchmark behavior, alerts, notifications, or response contracts.
- It has an explicit `-IncludeSchedulerRun` switch for the campaign-scoped scheduler validation POST route; that switch is off by default and must be treated as an intentional validation side effect if used.

Validation performed for the fix:

- PowerShell syntax check: `$null = [scriptblock]::Create((Get-Content -Path scripts/ga4_overview_current_commit_1_validation.ps1 -Raw))`
- Whitespace check: `git diff --check -- GA4/OVERVIEW_PRODUCTION_READINESS.md scripts/ga4_overview_current_commit_1_validation.ps1`

Deployed endpoint evidence captured:

- Commit deployed for validation: `dd81b14a Add GA4 Overview deployed validation harness`.
- First unauthenticated validation attempt against `https://marketforensics.onrender.com` returned `401 Unauthorized` for every endpoint, proving the route boundary failed closed without a logged-in session.
- Authenticated browser-console validation passed on `2026-07-01T12:21:31.789Z` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`.
- `__overall.pass` was `true`; all checked endpoints returned HTTP `200` with no endpoint error: campaign, `ga4-daily`, `ga4-to-date`, `ga4-breakdown`, `ga4-landing-pages`, `ga4-conversion-events`, `ga4-diagnostics`, `revenue-to-date`, `revenue-breakdown`, `revenue-sources`, `spend-to-date`, `spend-breakdown`, and `spend-sources`.
- Returned deployed endpoint facts included: daily row count `10`; to-date totals `666` sessions, `664` users, `84` conversions, `$14,069.58` GA4 revenue; breakdown totals `138` sessions, `138` users, `138` conversions, `$23,616.16` GA4 revenue; landing pages row count `6`; conversion events row count `1`; imported revenue `$600`; spend breakdown total `$0`.
- Diagnostics returned `warningsCount: 1`. This does not prove a code failure, but it remains a provider/configuration data-quality caveat because the deployed breakdown had conversions equal to users.

Current Commit 2i automated deployed Overview pack captured on `2026-07-03T19:10:12.204Z`:

- Runner version `2026-07-03.2`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- Checks passed: endpoint availability, no reauthorization required, GA4 to-date endpoint, GA4 breakdown endpoint, financial endpoints, nonnegative source counts, GA4 daily endpoint, daily freshness (`refreshIsStale: false`), landing pages endpoint, and conversion events endpoint.
- Financial summary: imported revenue to-date `$600`, revenue breakdown total `$600`, revenue source count `1`, spend to-date `$0`, spend breakdown total `$678.95`, spend source count `1`.
- GA4 summary: no completed-window guard not active (`noCompletedWindow: false`), to-date GA4 revenue `$18,617.57`, breakdown GA4 revenue `$28,164.15`, daily row count `12`, latest daily row `2026-07-02`, data-through date `2026-07-02`, landing page row count `6`, conversion event row count `1`, and `failedEndpoints: []`.
- Certification boundary: this is deployed automated endpoint/freshness/source-total smoke evidence only. It does not prove UI pixel parity, PDF text/value parity, inbox delivery, untested source families, or future provider behavior.

Current Commit 2h deployed report snapshot/PDF smoke pack captured on `2026-07-03T19:24:20.738Z`:

- Runner version `2026-07-03.2`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, platform `google_analytics`, report `c5a9ea60-3c0f-4809-98bf-7a5a0b118f9f`, report name `GA4 Overview Report`, report type `overview`, snapshot `5b8ea82b-628b-47a6-a354-afa49ceb68d7`, `sendTest: false`, `overallPass: true`.
- Checks passed: reports endpoint, report resolution, snapshot creation, snapshots endpoint, PDF endpoint, and the runner's PDF content-type/byte smoke check as implied by `overallPass: true` for the effective check set.
- User-confirmed PDF validation: the generated/downloaded PDF was inspected and its visible values matched Overview for this report snapshot.
- User-confirmed email delivery validation: after the PDF parity packet, the user confirmed deployed report email delivery validation passed for the GA4 Overview Report path. This is inbox/report-delivery evidence for the recorded packet, not provider-event proof for every future send.

Current Commit 3 deployed read-only source-damage inventory captured on `2026-07-03T20:10:30.499Z`:

- Runner version `2026-07-03.3`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, stage `ga4-overview-source-damage-inventory`, endpoint HTTP `200`, `readonly: true`, `inventoryPass: true`, `overallPass: true`.
- Certification impact returned by the deployed route: no orphan, inactive-source-record, duplicate-active-source, or unexpected-platform-context candidates were found for this campaign inventory.
- Finding groups were empty for orphan revenue records, orphan spend records, inactive revenue-source records, inactive spend-source records, duplicate active revenue sources, duplicate active spend sources, unexpected revenue platform contexts, and unexpected spend platform contexts.
- Visible summary fields in the pasted packet: `revenueSourceCount: 4`, `activeRevenueSourceCount: 1`, `inactiveRevenueSourceCount: 3`, `revenueRecordCount: 2`, and `spendSourceCount: 4`. The collapsed browser object was not expanded for every remaining summary count, so do not invent omitted counts in future answers.
- Certification boundary: this closes Current Commit 3 only for the recorded target-campaign inventory. The route is campaign-access guarded and read-only; it does not prove other campaigns unless run for them, and it did not perform cleanup, deactivate sources, refresh providers, recompute metrics, or send reports/emails.

Current Commit 2g deployed Google Sheets mapping variant pack captured on `2026-07-03T21:09:01.553Z`:

- Commit deployed for validation: `4281bf78 Add GA4 Overview Google Sheets variant pack`.
- Runner version `2026-07-03.4`, campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, stage `ga4-overview-google-sheets-variant-pack`, date range `30days`, `overallPass: true`.
- Checks passed: endpoints passed, variants configured, all configured variants passed, no duplicate active Google Sheets revenue signatures, and no duplicate active Google Sheets spend signatures.
- Fixture financial state: revenue breakdown total `$600`, revenue source count `1`, Google Sheets revenue source count `0`, spend breakdown total `$678.95`, and spend source count `1`.
- User-confirmed UI parity: Total Spend card and Spend Sources modal showed `$678.95`.
- Certification boundary: this closes Current Commit 2g only for the configured deployed Google Sheets spend fixture. It does not prove every possible Google Sheets tab/mapping shape, live Google Sheets cell-by-cell contents, refresh/delete behavior, UI pixels beyond the user-confirmed card/modal parity, or any other source family.
What remains unproven externally:

- Visible UI screenshot parity was not separately recorded in this file; the authenticated evidence came from the browser console using the deployed app session.
- Deployed report API/snapshot/PDF endpoint smoke evidence, user-confirmed PDF value parity, and user-confirmed report email delivery are recorded for Current Commit 2h on the listed `GA4 Overview Report` path. This does not prove other report types, future report snapshots, or future scheduled/test email deliveries.
- Future scheduled/test email deliveries outside the recorded GA4 Overview Report packet remain unproven until paired with provider delivery events or actual inbox receipt plus attachment review.
- Deployed scheduler timer execution remains separate from endpoint availability; the validation did not use `-IncludeSchedulerRun`.
- If later deployed validation shows a value mismatch, lower only the affected Overview path to unproven and add the exact runtime fix as the next Current Commit.

### Current Commit 2 Root Cause And Smallest Safe Fix

User-reported task:

- proceed with Current Commit 2 by doing root cause analysis and implementing the smallest safe fix with no Overview side effects.

Confirmed root cause:

- Current Commit 2 was not a confirmed GA4 Overview source lifecycle code bug.
- The blocker was an evidence-capture gap: local traces show guarded source endpoints, active-source joins, source ownership checks, and source-modal refetch paths, but there was no repeatable before/after snapshot for real provider-backed source-family lifecycle validation.
- Current Commit 1's deployed endpoint packet proved the current source endpoints are reachable for one campaign/property, but it did not prove add/import, edit, refresh, or delete lifecycle behavior for each revenue/spend source family.
- Automating provider add/edit/delete/refresh from the repo would be higher risk because those actions are intentionally mutative and provider-specific.

Smallest safe fix implemented:

- Added `scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1` as an opt-in source lifecycle evidence harness.
- The script is GET-only and captures sanitized source IDs, source types, source counts, revenue/spend totals, breakdown totals, source-modal provenance inputs, and optional before/after comparison deltas.
- It does not create, edit, refresh, delete, recompute, or mutate campaign, source, report, KPI, Benchmark, alert, notification, scheduler, or provider state.
- Lifecycle actions must still be performed manually through the intended deployed app/provider flow; the script only captures the evidence before and after one action.

Validation performed for the fix:

- PowerShell syntax check: `$null = [scriptblock]::Create((Get-Content -Path scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1 -Raw))`
- Trailing whitespace scan: `Select-String -Path scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1 -Pattern '[ \t]+$'`
- Whitespace check: `git diff --check -- GA4/OVERVIEW_PRODUCTION_READINESS.md`
- Unauthenticated deployed smoke run: `scripts/ga4_overview_current_commit_2_source_lifecycle_snapshot.ps1` wrote `C:\tmp\ga4-overview-cc2-source-lifecycle-unauthenticated.json` and captured `401 Unauthorized` for each checked endpoint, proving the harness executes and the deployed route boundary fails closed without a logged-in session.

Authenticated baseline capture attempt received on `2026-07-01T13:04:07.433Z`:

- The pasted attachment was exactly `5000` bytes and ended mid-`mappingKeys` array, so it is not a complete parseable evidence packet and cannot close the Current Commit 2 baseline gate.
- Visible facts from the partial packet: campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, property `542352127`, date range `30days`, `overallPass: true`, and HTTP `200` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Visible revenue facts from the partial packet: `totalToDate` `$600`, `breakdownTotal` `$600`, one active `csv` revenue source with displayed ID prefix `d4421cb9-829`.
- Spend source details, full source identity, and any after-action comparison were missing from the truncated packet; do not treat this as provider-family lifecycle proof.
- Follow-up harness adjustment: mapping config output is now bounded to `mappingKeyCount`, `mappingKeySample`, and `mappingKeysTruncated` so future evidence packets can remain compact.

Complete authenticated baseline captured on `2026-07-01T13:09:35.415Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue baseline: `totalToDate` `$600`, `breakdownTotal` `$600`, one active CSV revenue source, source ID `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, source amount `$600`.
- CSV revenue mapping baseline: `hasMappingConfig: true`, `mappingKeyCount: 22`, `mappingKeysTruncated: true`; captured sample keys included `allocationMethod`, `campaignColumn`, `campaignDisplayName`, `campaignMappings`, `campaignValue`, `campaignValueRevenueTotals`, `campaignValues`, `conversionValueColumn`, `csvHeaders`, `csvRowCount`, `csvSampleRows`, and `csvStoredRevenueRows`.
- Spend baseline: `totalToDate: null`, `breakdownTotal` `$0`, `sourceCount: 0`, no spend sources.
- Certification boundary: this closes the Current Commit 2 baseline snapshot for this campaign only. It does not close CSV revenue add/import, edit/update, refresh/reprocess, delete/deactivate, source-modal visual parity, downstream card parity, scheduler/report propagation, or any non-CSV source family lifecycle action.

CSV revenue add/import after-snapshot captured on `2026-07-01T13:36:15.567Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue after-add snapshot: `totalToDate` `$1,200`, `breakdownTotal` `$1,200`, `sourceCount: 2`, both active CSV revenue sources.
- Persisted baseline source remained active: `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, amount `$600`.
- New source appeared: `8ba9a131-526c-4e59-a751-c91b92d78b8b`, amount `$600`.
- Spend remained unchanged: `totalToDate: null`, `breakdownTotal` `$0`, `sourceCount: 0`, no spend sources.
- Endpoint-level source identity/additivity result: pass for CSV revenue add/import on this campaign if the imported test CSV was intentionally expected to contribute `$600`; otherwise amount-mapping correctness remains unproven and the CSV import should be investigated before closing the action.
- User-reported UI validation passed after the add/import: GA4 Overview showed `Total Revenue` `$1,200`, the Revenue Sources modal/list showed two CSV sources, both sources showed `$600`, and `Total Spend` remained `$0` or empty/no spend.
- UI validation boundary: this closes visible Total Revenue, revenue source-modal/list, and Total Spend parity for CSV revenue add/import on this campaign by user report. Screenshot evidence was not captured in this file.
- User-reported derived-card observation after the add/import: Profit, ROAS, ROI, and CPA had no displayed value because no spend source was imported for this campaign.
- Derived-card validation boundary: this is not evidence of a CSV revenue add/import failure, but the spend-dependent derived card behavior is not certified from this revenue-only action. Validate those cards during a separate spend-source add/import action or a controlled campaign state with known revenue and spend.

CSV revenue source identity check captured after add/import:

- Source count remained `2`.
- Row 1 was source ID `8ba9a131-526c-4e59-a751-c91b92d78b8b`, display name `Test_rev_spend.csv`, type `csv`, active `true`, amount `$600`.
- Row 2 was source ID `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, display name `Test_rev_spend.csv`, type `csv`, active `true`, amount `$600`.
- Safety caveat: both CSV revenue sources have the same visible display name and amount, so UI-only row selection is ambiguous unless the source modal order is verified immediately before clicking edit. Do not edit/delete until the intended source row is clearly identified.

CSV revenue edit/update partial source-list evidence captured:

- Source count remained `2` after editing the intended disposable CSV source.
- Edited source ID persisted: `8ba9a131-526c-4e59-a751-c91b92d78b8b`, display name `Test_rev_spend.csv`, type `csv`, active `true`, amount `$1,200`.
- Original source remained active and unchanged in the source list: `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, display name `Test_rev_spend.csv`, type `csv`, active `true`, amount `$600`.
- Certification boundary: this is partial source-list evidence only. It does not include endpoint status, revenue total, revenue breakdown total, spend unchanged status, source-modal UI parity, or the expected edited CSV amount. If `$1,200` was not the intended edited amount, CSV edit/update amount correctness is unproven and must be investigated before closing this lifecycle action.

CSV revenue edit/update complete endpoint after-snapshot captured on `2026-07-01T14:09:12.691Z`:

- User confirmed the edited disposable CSV source was intended to become `$1,200`.
- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue after-edit snapshot: `totalToDate` `$1,800`, `breakdownTotal` `$1,800`, `sourceCount: 2`, both active CSV revenue sources.
- Edited source ID persisted and updated in place: `8ba9a131-526c-4e59-a751-c91b92d78b8b`, display name `Test_rev_spend.csv`, amount `$1,200`, `mappingKeyCount: 22`, `mappingKeysTruncated: true`.
- Original baseline source remained active and unchanged: `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, display name `Test_rev_spend.csv`, amount `$600`, `mappingKeyCount: 22`, `mappingKeysTruncated: true`.
- Spend remained unchanged: `totalToDate: null`, `breakdownTotal` `$0`, `sourceCount: 0`, no spend sources.
- Endpoint-level edit/update result: pass for CSV revenue edit/update source identity, no duplicate source creation, intended source amount replacement, total/breakdown reconciliation, and unrelated source preservation on this campaign.
- Remaining gate for this CSV revenue edit/update action: source-modal/list UI parity after the edit is not captured in this endpoint packet.

CSV revenue edit/update UI screenshot evidence received after edit:

- User-provided screenshots showed the GA4 Overview Revenue card displaying `Total Revenue` `$25,416.16` with `Sources (3)`.
- User-provided Revenue Sources modal screenshot showed native `GA4 Revenue` `$23,616.16`, edited CSV source `Test_rev_spend.csv` `$1,200.00`, and original CSV source `Test_rev_spend.csv` `$600.00`.
- UI reconciliation: `$23,616.16` native GA4 revenue + `$1,200.00` edited CSV revenue + `$600.00` original CSV revenue = `$25,416.16` displayed Total Revenue.
- User stated the UI looked correct.
- UI parity result: pass for CSV revenue edit/update visible Total Revenue, Revenue Sources modal/list, native GA4 plus imported CSV additivity, edited source amount, and original source preservation on this campaign.
- Certification boundary: this closes CSV revenue edit/update for the traced endpoint and visible Overview UI paths on this campaign. It does not close CSV revenue refresh/reprocess, delete/deactivate, spend-dependent derived cards, scheduler/report propagation, or any non-CSV source-family lifecycle action.

CSV revenue delete/deactivate endpoint after-snapshot captured on `2026-07-01T14:18:22.136Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue after-delete snapshot: `totalToDate` `$600`, `breakdownTotal` `$600`, `sourceCount: 1`.
- Deleted disposable source no longer appeared in the source list: `8ba9a131-526c-4e59-a751-c91b92d78b8b`.
- Original baseline source remained active and unchanged: `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, display name `Test_rev_spend.csv`, amount `$600`, `mappingKeyCount: 22`, `mappingKeysTruncated: true`.
- Spend remained unchanged: `totalToDate: null`, `breakdownTotal` `$0`, `sourceCount: 0`, no spend sources.
- Endpoint-level delete/deactivate result: pass for CSV revenue delete/deactivate source removal, total/breakdown recalculation, original source preservation, and spend non-interference on this campaign.
- User-reported UI validation passed after delete/deactivate: GA4 Overview showed `Total Revenue` `$24,216.16`, `Sources (2)`, Revenue Sources modal/list showed native `GA4 Revenue` `$23,616.16` and the remaining CSV source `$600.00`, the deleted `$1,200.00` CSV source was absent, and `Total Spend` remained `$0` or empty/no spend.
- UI reconciliation after delete/deactivate: `$23,616.16` native GA4 revenue + `$600.00` remaining CSV revenue = `$24,216.16` displayed Total Revenue.
- UI parity result: pass for CSV revenue delete/deactivate visible Total Revenue, Revenue Sources modal/list, source removal, original source preservation, and spend non-interference on this campaign by user report.
- Certification boundary: this closes CSV revenue delete/deactivate for the traced endpoint and visible Overview UI paths on this campaign. It does not close CSV revenue refresh/reprocess, spend-dependent derived cards, scheduler/report propagation, or any non-CSV source-family lifecycle action.

CSV revenue refresh/reprocess narrow trace conclusion:

- UI trace in `client/src/components/AddRevenueWizardModal.tsx` shows CSV revenue is intentionally not auto-refreshed: the wizard states `CSV data won't auto-update` and `Requires manual re-upload to update`.
- Edit-mode UI trace shows the CSV update path is manual re-upload/reprocess through the existing edit wizard: `To edit a CSV import, please re-upload the same (or updated) file. We'll re-process revenue using your updated mappings after preview.`
- Route trace in `server/routes-oauth.ts` found CSV revenue preview/process routes only: `/api/campaigns/:id/revenue/csv/preview` and `/api/campaigns/:id/revenue/csv/process`.
- Targeted search found no distinct CSV revenue `refresh` or `reprocess` endpoint or Overview UI refresh button for CSV revenue sources.
- Server edit/reprocess behavior for CSV revenue is handled by `/api/campaigns/:id/revenue/csv/process` when `mapping.sourceId` is provided: it validates campaign/source/platform ownership, updates the existing source, deletes old records for that source, and recreates records from the uploaded or stored CSV rows.
- Certification conclusion for this campaign/source family: CSV revenue refresh/reprocess is not a separate product lifecycle action. The applicable refresh/reprocess behavior is manual edit/re-upload, which was covered by the CSV revenue edit/update evidence above.
- Certification boundary: this conclusion applies only to CSV revenue in GA4 Overview. It does not mark Google Sheets, Shopify, HubSpot, Salesforce, ad-platform spend, CSV spend, or scheduler/provider refresh paths as not applicable.

CSV spend add/import endpoint after-snapshot captured on `2026-07-01T14:45:46.610Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue stayed unchanged from the post-delete baseline: imported revenue `totalToDate` `$600`, `breakdownTotal` `$600`, `sourceCount: 1`, remaining active CSV revenue source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` amount `$600`.
- Spend after-add snapshot: `spendBreakdownTotal` `$2,020`, `sourceCount: 1`, active CSV spend source `c3611c0f-4bbf-47b9-8615-93e4b140385e`, display name `Test_rev_spend.csv`, `mappingKeyCount: 17`, `mappingKeysTruncated: true`.
- Spend response-shape caveat: the validation packet showed `spend.totalToDate: null` and source `amount: null`; local UI trace shows GA4 Overview financial spend intentionally prefers `spendBreakdownResp.totalSpend` over `spendToDateResp.spendToDate` because `spend-to-date` can read stale/zero campaign metadata. This is not by itself proof of a spend add/import failure.
- Endpoint-level add/import result: pass for CSV spend source creation, spend breakdown materialization, revenue non-interference, and endpoint availability on this campaign if the imported test CSV was intentionally expected to contribute `$2,020`; otherwise amount-mapping correctness remains unproven and the CSV spend import should be investigated before closing this lifecycle action.
- User-reported UI validation passed after CSV spend add/import: visible Overview Total Spend, Spend Sources modal/list, revenue non-interference, and spend-dependent card availability matched the requested checklist.
- UI validation boundary: this closes visible Total Spend, Spend Sources modal/list, and revenue non-interference for CSV spend add/import on this campaign by user report. Exact Profit, ROAS, ROI, and CPA displayed values were not pasted in this file.
- Certification boundary: CSV spend add/import remains closed for endpoint source creation, spend breakdown materialization, visible spend/source UI, and revenue non-interference on this campaign if `$2,020` was the intended imported spend total. If `$2,020` was not the intended spend amount, amount-mapping correctness must be lowered to unproven and investigated.

CSV spend edit/update endpoint after-snapshot captured on `2026-07-01T15:04:12.170Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Revenue remained unchanged: imported revenue `totalToDate` `$600`, `breakdownTotal` `$600`, `sourceCount: 1`, remaining active CSV revenue source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` amount `$600`.
- Spend after-edit snapshot: `spendBreakdownTotal` `$3,120`, `sourceCount: 1`, active CSV spend source ID persisted `c3611c0f-4bbf-47b9-8615-93e4b140385e`, display name `Test_rev_spend.csv`, `mappingKeyCount: 17`, `mappingKeysTruncated: true`.
- Spend response-shape caveat persisted: `spend.totalToDate: null` and source `amount: null`; GA4 Overview financial spend uses `spendBreakdownResp.totalSpend` for this path.
- Endpoint-level edit/update result: pass for CSV spend source identity preservation, no duplicate source creation, spend breakdown recalculation, revenue non-interference, and endpoint availability on this campaign if the edited CSV was intentionally expected to contribute `$3,120`; otherwise amount-mapping correctness remains unproven and the CSV spend edit should be investigated before closing this lifecycle action.
- UI validation passed on `2026-07-01`: user confirmed the Overview UI was correct after the CSV spend edit/update, including the expected `$3,120` spend state and visible parity for the affected Overview financial display.
- Certification boundary: CSV spend edit/update is closed only for this deployed campaign/source path after endpoint evidence plus user UI validation. This does not certify CSV spend refresh/reprocess, CSV spend delete/deactivate, other source families, other campaigns/properties, or provider-backed deployed behavior.

CSV spend refresh/reprocess narrow trace conclusion:

- Product-doc trace: `GA4/FINANCIAL_SOURCES.md` states CSV spend does not auto-refresh on a schedule; `GA4/REFRESH_AND_PROCESSING.md` states `Upload CSV` sources do not participate in scheduled daily source refresh and update only when the user imports or edits the CSV source.
- UI trace: `client/src/components/AddSpendWizardModal.tsx` shows `Upload CSV` spend as manual re-upload to update, edit mode says to re-upload the same or updated file to re-process spend, and the GA4 Overview Spend Sources modal in `client/src/pages/ga4-metrics.tsx` exposes edit and remove actions but no separate refresh action.
- API trace: `server/routes-oauth.ts` exposes CSV spend preview/process routes only (`/api/campaigns/:id/spend/csv/preview` and `/api/campaigns/:id/spend/csv/process`) plus the shared spend-source delete route. No distinct CSV spend refresh endpoint was found.
- Server edit/reprocess behavior: `/api/campaigns/:id/spend/csv/process` handles CSV spend reprocessing when `mapping.sourceId` is provided; it validates the active CSV spend source for the campaign/platform context, updates that source, deletes old spend records for that source, materializes replacement spend records from uploaded or stored rows, recalculates campaign spend, and triggers GA4 KPI/Benchmark recompute.
- Scheduler trace: `server/auto-refresh-scheduler.ts` reprocesses Google Sheets spend, LinkedIn spend, and `ad_platforms` spend, but the traced scheduler filters spend sources by `google_sheets`, `linkedin_api`, and `ad_platforms`; no CSV spend scheduler branch was found.
- Certification conclusion for this campaign/source family: CSV spend refresh/reprocess is not a separate product lifecycle action. The applicable user-initiated reprocess behavior is manual CSV edit/re-upload, or stored-row recalculation when only eligible mapping selections change, through the CSV spend edit/update flow already validated above.
- Certification boundary: this conclusion applies only to CSV spend in GA4 Overview. It does not certify CSV spend delete/deactivate, Google Sheets spend refresh, ad-platform spend refresh, provider-backed refresh behavior, other source families, other campaigns/properties, scheduler timer execution, or report/email propagation.

CSV spend delete/deactivate endpoint after-snapshot captured on `2026-07-01T15:25:26.753Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, target CSV spend source `c3611c0f-4bbf-47b9-8615-93e4b140385e`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Before delete: `spendBreakdownTotal` `$3,120`, `spendSourceCount: 1`, imported revenue `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- After delete: `spendToDate` `$0`, `spendBreakdownTotal` `$0`, `spendSourceCount: 0`, target source absent from spend sources and spend breakdown.
- Revenue non-interference: imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`; GA4 revenue remained `ga4ToDateRevenue` `$14,069.58` and `ga4BreakdownRevenue` `$23,616.16`.
- Automated checks all passed: baseline found, endpoints pass, target removed from spend sources, target removed from breakdown, spend dropped by expected `$3,120`, spend source count decremented, revenue unchanged, and GA4 revenue unchanged.
- Endpoint-level delete/deactivate result: pass for target source removal, spend record removal from Overview totals/provenance, revenue non-interference, GA4 native revenue non-interference, and endpoint availability on this campaign.
- UI validation passed on `2026-07-01`: user confirmed the Overview UI was correct after delete, including removed CSV spend source visibility, spend dropping to `$0`/unavailable, revenue staying correct, and spend-dependent derived cards returning to blank/unavailable because spend is gone.
- Certification boundary: CSV spend delete/deactivate is closed only for this deployed campaign/source path after endpoint evidence plus user UI validation. This does not certify other source families, other campaigns/properties, provider-backed refresh/delete behavior, scheduler timer execution, or report/email propagation.

Google Sheets revenue add/import endpoint after-snapshot captured on `2026-07-01T15:52:25.333Z`:

- RCA: this was a validation-expectation error, not a confirmed Google Sheets revenue import bug. The browser check was configured with `expectedAddedRevenue: 700`, but the user confirmed `$30,300` was the correct imported amount for the selected Google Sheets tab/column. The server path sums every positive value in the selected revenue column for the fetched tab range, optionally filtered by campaign mapping; that behavior matches the traced add/import route.
- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, date range `30days`, stage `after-google-sheets-revenue-add`.
- Baseline before add: imported revenue `totalToDate` `$600`, `breakdownTotal` `$600`, `sourceCount: 1`, existing CSV revenue source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, no Google Sheets revenue source IDs, spend `$0`, GA4 to-date revenue `$14,069.58`, GA4 breakdown revenue `$23,616.16`.
- After add: imported revenue `revenueToDate` `$30,900`, `revenueBreakdownTotal` `$30,900`, `revenueSourceCount: 2`, one added source ID `dd5dc470-814d-42b9-af19-4b53ac7d08f8`, added source type `google_sheets`, added amount `$30,300`.
- Non-target values stayed stable: spend stayed `$0` with `spendSourceCount: 0`; GA4 to-date revenue stayed `$14,069.58`; GA4 breakdown revenue stayed `$23,616.16`.
- Endpoint-level checks that passed independent of the original wrong expected amount: baseline found, endpoints pass, exactly one revenue source added, added source is Google Sheets, spend unchanged, and GA4 revenue unchanged.
- Amount correction: with the user-confirmed expected amount of `$30,300`, the added source amount and imported revenue delta reconcile: `$600` baseline imported revenue + `$30,300` Google Sheets revenue = `$30,900` after-add imported revenue.
- Endpoint-level add/import result: pass for Google Sheets revenue source creation, additive imported revenue, total/breakdown reconciliation, spend non-interference, GA4 native revenue non-interference, and endpoint availability on this campaign/source path.
- UI validation passed on `2026-07-01`: user confirmed the Overview UI was correct after Google Sheets revenue add/import, including Total Revenue, Revenue Sources modal/list display of the `$30,300` Google Sheets source, and preservation of the existing CSV revenue source.
- Certification boundary: Google Sheets revenue add/import is closed only for this deployed campaign/source path after endpoint evidence plus user UI validation. This does not certify Google Sheets revenue edit/update, refresh/reprocess, delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, or report/email propagation.

Google Sheets revenue edit/update endpoint after-snapshot captured on `2026-07-01T16:13:53.064Z`:

- RCA: this was a validation-expectation error, not a confirmed Google Sheets revenue edit/update bug. The browser check was configured with `expectedUpdatedRevenue: 31300`, but the user confirmed `$54,200` was the correct updated amount for the selected Google Sheets tab/column.
- Target source `dd5dc470-814d-42b9-af19-4b53ac7d08f8`, stage `after-google-sheets-revenue-edit`.
- Baseline before edit: imported revenue `totalToDate` `$30,900`, `breakdownTotal` `$30,900`, `sourceCount: 2`, source IDs `dd5dc470-814d-42b9-af19-4b53ac7d08f8` and `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`, target Google Sheets amount `$30,300`, spend `$0`.
- After edit: imported revenue `revenueToDate` `$54,800`, `revenueBreakdownTotal` `$54,800`, `sourceCount: 2`, same source IDs persisted, target source still present, target source type `google_sheets`, target amount `$54,200`, spend stayed `$0`.
- Endpoint-level checks that passed independent of the original wrong expected amount: baseline found, endpoints pass, same source ID persisted, target is Google Sheets, no source count change, no duplicate source IDs, and spend unchanged.
- Amount correction: with the user-confirmed expected amount of `$54,200`, the target source amount and imported revenue total reconcile: `$54,200` updated Google Sheets revenue + `$600` existing CSV revenue = `$54,800` after-edit imported revenue.
- Endpoint-level edit/update result: pass for stable Google Sheets source identity, in-place update without duplicate source creation, total/breakdown reconciliation, CSV source preservation, spend non-interference, and endpoint availability on this campaign/source path.
- UI validation passed on `2026-07-01`: user-provided Overview screenshots showed Total Revenue `$78,416.16` and Revenue Sources modal rows `GA4 Revenue` `$23,616.16`, `Google Sheets revenue` `$54,200.00`, and `Test_rev_spend.csv` `$600.00`; these reconcile exactly to the displayed Total Revenue and prove no duplicate Google Sheets source appeared in the visible modal.
- Certification boundary: Google Sheets revenue edit/update is closed only for this deployed campaign/source path after endpoint evidence plus user UI validation. This does not certify Google Sheets revenue refresh/reprocess, delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, or report/email propagation.

Google Sheets revenue refresh/reprocess validation helper added in Current Commit 2a:

- RCA: this was an evidence-speed and blast-radius problem, not a confirmed Google Sheets revenue calculation bug. The normal deployed daily auto-refresh scheduler is the production refresh/reprocess path, but waiting for the timer blocks the current evidence packet; the existing `/api/campaigns/:id/google-sheets-refresh` route refreshes raw cached Google Sheets rows and is not proof that GA4 Overview revenue records were reprocessed.
- Smallest safe fix implemented: added `/api/campaigns/:id/revenue-sources/:sourceId/google-sheets-refresh/run-now`, guarded by campaign access and Google Sheets rate limiting, which calls only the scheduler Google Sheets revenue source reprocess helper for the requested active `google_sheets` revenue source ID.
- Side-effect boundary: the validation route does not run the full daily auto-refresh cycle, unrelated providers, alerts, emails, reports, or unrelated campaigns. It mutates only the target source's materialized revenue records and `lastSyncedAt` metadata through the same source identity path used by the scheduler helper.
- Deployed run-now endpoint evidence captured on `2026-07-01T17:10:02.050Z`: trigger returned HTTP `200` with `success: true` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, source `dd5dc470-814d-42b9-af19-4b53ac7d08f8`, and platform context `ga4`.
- Corrected source reconciliation evidence captured on `2026-07-01T17:12:49.833Z`: all checked endpoints returned HTTP `200`; imported revenue `totalToDate` `$85,100`; revenue breakdown total `$85,100`; source count `2`; Google Sheets source count `1`; target source still present; target source amount `$84,500`; target breakdown amount `$84,500`; CSV revenue remained `$600`; spend breakdown remained `$0`.
- Endpoint-level refresh/reprocess result: pass for run-now trigger availability, stable Google Sheets source identity, no duplicate Google Sheets revenue source, refreshed source amount matching expected `$84,500`, imported revenue reconciliation (`$84,500` Google Sheets + `$600` CSV = `$85,100`), and spend non-interference on this campaign/source path.
- UI validation passed on `2026-07-01`: user confirmed visible Overview UI parity after refresh/reprocess, including the refreshed `$84,500` Google Sheets revenue source, no duplicate Google Sheets revenue source, preserved `$600` CSV revenue source, and Total Revenue/Revenue Sources reconciliation.
- Certification boundary: Google Sheets revenue refresh/reprocess is closed only for this deployed campaign/source run-now path after endpoint evidence plus user UI validation. This deployed run-now evidence does not prove the daily timer fired by itself, and it does not certify Google Sheets revenue delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, or report/email propagation.

Google Sheets revenue delete/deactivate false-failure finding in Current Commit 2b:

- RCA: the user observed a `Delete failed` UI response for Google Sheets revenue source `dd5dc470-814d-42b9-af19-4b53ac7d08f8`, then later observed that the source was actually deleted. Local route trace shows the delete route removes the revenue source and records before awaiting `recomputeCampaignDerivedValues`; inside that helper ordinary KPI recompute and alert checks were guarded, but GA4 KPI/Benchmark recompute was unguarded. A downstream GA4 recompute exception could therefore convert a completed destructive source mutation into a failed DELETE response.
- Smallest safe fix implemented: guard `recomputeGA4KPIAndBenchmarkValues(campaignId, "Revenue Update")` inside `recomputeCampaignDerivedValues`, log the warning, and continue the source endpoint response. This preserves source mutation semantics and does not change revenue calculations, spend calculations, campaign/property/source scoping, response shape, scheduler behavior, email/report behavior, or API ownership rules.
- Evidence boundary: this fixes the false-failure response class locally and is covered by `server/ga4-source-lifecycle-recompute-regression.test.ts`. It does not prove the deployed fixed route until Render deploys the commit and a delete action returns success while after-delete endpoint/UI evidence confirms the intended source removal and non-target source preservation.
- Current source boundary: the already-attempted source may now be removed in the deployed database, but that eventual removal is not proof that the first DELETE response was correct. If the original source is already gone, capture read-only after-delete state for that source and use one additional disposable Google Sheets revenue source to prove the corrected deployed delete response path.
- Deployed fixed-response endpoint evidence captured on `2026-07-01T18:28:32.608Z` for disposable Google Sheets revenue source `32661325-d2a5-404f-a898-2c84e4275809`: DELETE response returned HTTP `200`, `success: true`, elapsed `2845ms`, and no error. Before delete, imported revenue `revenueToDate` and `revenueBreakdownTotal` were `$31,600`, source count `2`, Google Sheets source count `1`, and target amount `$31,000`. After delete, imported revenue `revenueToDate` and `revenueBreakdownTotal` were `$600`, source count `1`, Google Sheets source count `0`, target was absent from sources and breakdown, and all endpoint checks passed.
- Certification boundary after this evidence: Google Sheets revenue delete/deactivate is closed only for this deployed campaign/source path after fixed-response endpoint evidence plus user UI validation. This does not certify other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, report/email propagation, or other source families.
- UI validation passed on `2026-07-01`: user-provided screenshots showed Total Revenue `$24,216.16` and Revenue Sources modal rows `GA4 Revenue` `$23,616.16` plus `Test_rev_spend.csv` `$600.00`; these reconcile exactly and prove the deleted Google Sheets row is no longer visible.

Revenue import/update response latency finding in Current Commit 2c:

- RCA: GA4 revenue source process routes for manual/CSV/Google Sheets/CRM/ecommerce sources saved the source definition and materialized records, then awaited `recomputeCampaignDerivedValues` before returning success. For GA4 platform context that helper synchronously awaited the heavyweight GA4 KPI/Benchmark daily/history job and alert reconciliation. That job may fetch or backfill GA4 daily data, read GA4 to-date totals, update KPI and Benchmark history/current values, and run alert checks. Therefore the user could wait on downstream analytics work after the revenue source records were already durable.
- Smallest safe fix implemented: for GA4 revenue source saves, `recomputeCampaignDerivedValues` now refreshes source-backed campaign current values synchronously with `refreshCampaignCurrentValuesForCampaign(campaignId)`, then schedules the heavier GA4 KPI/Benchmark and alert reconciliation through `setImmediate`. Non-GA4 revenue contexts keep the existing synchronous `refreshKPIsForCampaign` plus alert behavior.
- Side-effect boundary: the fix does not change revenue calculations, spend calculations, source materialization, source identity, campaign/property/source scoping, response shape, scheduler behavior, email/report behavior, or API ownership checks. Overview Total Revenue and source modal paths still read the committed revenue records immediately after the process response.
- Certification boundary: local code and tests prove the response no longer awaits the heavyweight GA4 job. Deployed latency timing was user-confirmed as validated on `2026-07-01`, but no exact elapsed-time packet was pasted into this file, so this evidence closes the practical deployed timing gate without certifying a numeric SLA. A short delay can still exist before downstream GA4 KPI/Benchmark history and alerts finish reconciling; that is explicit background work rather than a blocking import/update step.
- User-confirmed validation boundary: Current Commit 2c is closed for the deployed latency behavior observed by the user. It does not prove future provider latency, other source families, or every possible sheet/tab/mapping size.

Google Sheets spend add/import endpoint after-snapshot captured on `2026-07-01T19:00:36.141Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, stage `after-google-sheets-spend-add`, expected added spend `$240`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, `spendSources`, `ga4ToDate`, and `ga4Breakdown`.
- Spend after add/import: `spendToDate` `$240`, `spendBreakdownTotal` `$240`, `spendSourceCount: 1`, `googleSheetsSpendSourceCount: 1`, active Google Sheets spend source `8f67b03f-a00b-434f-b81f-db1b2b951595`, display name `Google Sheets`.
- Revenue non-target after-state: imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- GA4 provider caveat: the simplified after packet reported `ga4ToDateRevenue` `$0` and `ga4BreakdownRevenue` `$0`; this packet is not used as proof that native GA4 provider revenue was unchanged. It proves checked endpoint availability and the Google Sheets spend source/totals state for this action only.
- UI validation passed on `2026-07-01`: user confirmed GA4 Overview Total Spend, Spend Sources, Total Revenue, and spend-dependent derived cards looked correct after import.
- Certification boundary: Google Sheets spend add/import is closed only for this deployed campaign/source path after endpoint after-state evidence plus user UI validation. The baseline script was run in the browser before import, but its JSON was not pasted into this file; therefore this evidence should not be reused as a complete archived before/after proof for other campaigns. It does not certify Google Sheets spend edit/update, refresh/reprocess, delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, report/email propagation, or GA4 native provider stability.

Google Sheets spend edit/update endpoint after-snapshot captured on `2026-07-01T19:15:03.362Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, target Google Sheets spend source `8f67b03f-a00b-434f-b81f-db1b2b951595`, stage `after-google-sheets-spend-edit`, expected updated spend `$420.20`, `overallPass: true`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, and `spendSources`.
- Spend after edit/update: `spendToDate` `$420.20`, `spendBreakdownTotal` `$420.20`, `spendSourceCount: 1`, `googleSheetsSpendSourceCount: 1`, target source still present, target source type `google_sheets`, target breakdown amount `$420.20`.
- Source identity and duplicate checks passed: same source ID present, target is Google Sheets, and no duplicate Google Sheets spend source was created.
- Revenue non-interference checks passed: imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- UI validation passed on `2026-07-01`: user confirmed GA4 Overview Total Spend, Spend Sources, Revenue, and Profit/ROAS/ROI/CPA reflected the updated spend correctly.
- Certification boundary: Google Sheets spend edit/update is closed only for this deployed campaign/source path after endpoint after-state evidence plus user UI validation. The prior recorded add/import state was `$240`, but this edit packet did not paste a full before JSON and did not include GA4 native endpoint checks; therefore it should not be reused as complete archived before/after proof for other campaigns. It does not certify Google Sheets spend refresh/reprocess, delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, scheduler timer execution, report/email propagation, or GA4 native provider stability.

Google Sheets spend refresh/reprocess validation helper added in Current Commit 2d:

- RCA: Google Sheets spend already had a scheduler reprocess helper that calls `/api/campaigns/:id/spend/sheets/process` with the stable spend `sourceId`, but there was no deployed campaign/source-scoped run-now route for one Google Sheets spend source. The existing `/api/campaigns/:id/google-sheets-refresh` route refreshes only raw cached Google Sheets rows for main/general connections and is not proof that the materialized `spend_sources` and `spend_records` refresh path ran.
- Smallest safe fix implemented: added `runGoogleSheetsSpendSourceRefreshForValidation(campaignId, sourceId)` beside the revenue validation helper and added `/api/campaigns/:id/spend-sources/:sourceId/google-sheets-refresh/run-now`. The helper finds only an active `google_sheets` spend source by the requested campaign/source ID, requires saved `connectionId` and `spendColumn`, and reuses the scheduler `reprocessGoogleSheetsSpend` path.
- Side-effect boundary: the validation route requires campaign access, keeps the existing Google Sheets rate limiter, does not run the full daily auto-refresh cycle, does not touch unrelated providers, alerts, emails, reports, or unrelated campaigns, and does not change spend calculations, revenue calculations, source materialization, source identity, campaign/property/source scoping, response shape, scheduler timer behavior, email/report behavior, or API ownership rules.
- Local validation: `npm test -- server/ga4-auto-refresh-regression.test.ts` passed and `npm run check` passed after the helper/route/test update.
- Local implementation boundary: Current Commit 2d proved the source-scoped validation trigger shape and route wiring locally before deploy; it did not by itself prove provider/deployed refresh behavior.
- Deployed run-now endpoint evidence captured on `2026-07-01T19:52:43.021Z` for Google Sheets spend source `8f67b03f-a00b-434f-b81f-db1b2b951595`: trigger returned HTTP `200`, `success: true`, and result source ID/campaign ID matched the requested campaign/source.
- After refresh/reprocess: `spendToDate` `$198.75`, `spendBreakdownTotal` `$198.75`, `spendSourceCount: 1`, `googleSheetsSpendSourceCount: 1`, target source still present, target source type `google_sheets`, target breakdown amount `$198.75`.
- Endpoint-level checks all passed: trigger passed, all checked endpoints returned HTTP `200`, same source ID persisted, no duplicate Google Sheets spend source was created, spend to-date/breakdown/target amount matched expected `$198.75`, and imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- UI validation passed on `2026-07-01`: user confirmed GA4 Overview Total Spend, Spend Sources, Revenue, and Profit/ROAS/ROI/CPA reflected the refreshed spend correctly.
- Certification boundary after deployed evidence: Google Sheets spend refresh/reprocess is closed only for this deployed campaign/source run-now path after endpoint evidence plus UI validation. This deployed run-now evidence does not prove the daily timer fired by itself, and it does not certify Google Sheets spend delete/deactivate, other campaigns/properties, other Google Sheets tabs/mappings, report/email propagation, or GA4 native provider stability.

Google Sheets spend delete/deactivate endpoint after-snapshot captured on `2026-07-01T20:00:40.616Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, target Google Sheets spend source `8f67b03f-a00b-434f-b81f-db1b2b951595`, expected removed spend `$198.75`, `overallPass: true`.
- Baseline before delete captured on `2026-07-01T19:58:54.311Z`: imported revenue `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`, `spendToDate` `$198.75`, `spendBreakdownTotal` `$198.75`, `spendSourceCount: 1`, target present, target breakdown amount `$198.75`.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, and `spendSources`.
- After delete/deactivate: `spendToDate` `$0`, `spendBreakdownTotal` `$0`, `spendSourceCount: 0`, target absent from spend sources and spend breakdown.
- Revenue non-interference checks passed: imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- Endpoint-level checks all passed: baseline found, baseline target present, endpoints pass, target removed from spend sources, target removed from breakdown, spend dropped by expected `$198.75`, spend source count decremented, and revenue unchanged.
- UI validation passed on `2026-07-01`: user confirmed Total Spend returned to `$0`/unavailable, the Google Sheets spend source disappeared from Spend Sources, Revenue stayed unchanged, and Profit/ROAS/ROI/CPA returned to blank/unavailable because spend is gone.
- Certification boundary: Google Sheets spend delete/deactivate is closed only for this deployed campaign/source path after endpoint before/after evidence plus user UI validation. It does not certify other campaigns/properties, other Google Sheets tabs/mappings, daily scheduler timer execution, report/email propagation, other source families, or GA4 native provider stability.

Google Sheets spend startup-fired scheduler endpoint after-snapshot captured on `2026-07-01T21:15:15.453Z`:

- Campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, target Google Sheets spend source `618e5e12-0f3f-44a2-837a-d2677ad95f64`, expected scheduler spend `$678.95`, `overallPass: true`.
- Baseline before scheduler captured on `2026-07-01T20:50:09.431Z`: imported revenue `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`, `spendToDate` `$180.20`, `spendBreakdownTotal` `$180.20`, `spendSourceCount: 1`, `googleSheetsSpendSourceCount: 1`, active source ID `618e5e12-0f3f-44a2-837a-d2677ad95f64`.
- Scheduler trigger boundary: the deployed Render startup path with `AUTO_REFRESH_RUN_ON_STARTUP=true` was used to run the daily auto-refresh/auto-process scheduler immediately; the source-scoped run-now validation route was not used for this packet. User confirmed the startup flag was removed after validation.
- HTTP `200` with pass `true` for `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, and `spendSources` after the scheduler run.
- After scheduler execution: `spendToDate` `$678.95`, `spendBreakdownTotal` `$678.95`, `spendSourceCount: 1`, `googleSheetsSpendSourceCount: 1`, target source still present, target breakdown amount `$678.95`.
- Source identity and duplicate checks passed: same Google Sheets spend source ID persisted, no duplicate Google Sheets spend source was created, and the target breakdown amount matched the expected scheduler amount.
- Revenue non-interference checks passed: imported revenue remained `revenueToDate` `$600`, `revenueBreakdownTotal` `$600`, `revenueSourceCount: 1`.
- UI validation passed on `2026-07-01`: user confirmed GA4 Overview Total Spend, Spend Sources, Revenue, and derived spend-dependent cards reflected the scheduler-refreshed spend correctly.
- Certification boundary: Current Commit 2e is closed for this deployed startup-fired Google Sheets spend scheduler path only. It proves the deployed scheduler execution path can update a stable Google Sheets spend source without creating a duplicate source under the startup trigger; it does not prove a normal wall-clock scheduled-hour run if that distinct proof is required, other campaigns/properties, other Google Sheets tabs/mappings, report/email propagation, other source families, or GA4 native provider stability.

Current Commit 2f second campaign/property Google Sheets spend add/import evidence captured on `2026-07-03`:

- Scope: deployed URL `https://marketforensics.onrender.com/`, campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6`, GA4 property `498536418`, Google Sheets spend add/import only.
- Cleanup before retry captured on `2026-07-03T11:30:06.922Z`: endpoint pass `true`, `spendToDate` `$0`, `spendBreakdownTotal` `$0`, `spendSourceCount: 0`, `googleSheetsSpendSourceCount: 0`, and `readyForBaseline: true`.
- Baseline was then captured on `2026-07-03T11:32:15.550Z` before the add/import action. The compact pasted after packet confirms `baselineWasAvailable: true`, but the baseline endpoint pass was already `false` because the native GA4 `ga4ToDate` provider path was unhealthy; this baseline is not used as proof that every Overview endpoint was healthy.
- After add/import snapshot captured on `2026-07-03T11:42:32.717Z`: expected added spend `$507.70`, exactly one Google Sheets spend source was added, spend increased by expected amount, and imported revenue stayed unchanged at `$0`.
- Endpoint status packet captured on `2026-07-03T11:45:16.366Z`: `revenueToDate`, `revenueBreakdown`, `revenueSources`, `spendToDate`, `spendBreakdown`, and `spendSources` returned HTTP `200` with no reauthorization requirement; `ga4ToDate` returned HTTP `500` with GA4 `INVALID_ARGUMENT` and `requiresReauthorization: false`.
- UI validation passed on `2026-07-03`: user confirmed the Overview spend card and source modal look correct for `$507.70`.
- Certification boundary: this closes only the visible second-campaign Google Sheets spend add/import UI/source-modal financial path. It does not close second-campaign native GA4 future valid completed-day provider data, spend-to-date exact-value parity from the compact packet, run-now refresh/reprocess, delete/deactivate, alternate tabs/mappings, report/email propagation, normal scheduler proof, or other source families.

Current Commit 2f.1 native GA4 to-date no-completed-window finding:

- RCA: the second campaign/property failed only on native `ga4ToDate`; all checked revenue/spend source endpoints returned HTTP `200`. The route derived `startDateUsed` from the campaign start/created date while `endDateUsed` is the latest completed GA4 reporting day. For a newly created campaign whose start/created date is after the latest completed day, `startDateUsed > endDateUsed`; GA4 Data API rejects that impossible date window with `400 INVALID_ARGUMENT`, which surfaced as HTTP `500` from `/ga4-to-date`.
- Smallest safe fix implemented: `/api/campaigns/:id/ga4-to-date` now checks `startDateUsed > endDateUsed` after campaign access, selected-property, and token validation but before the provider call. In that no-completed-window case it returns `success: true`, selected `propertyId`, the computed dates, `noCompletedWindow: true`, and zero native GA4 totals instead of calling the provider with an invalid range.
- Side-effect boundary: the fix is route-local and does not change GA4 calculations for valid completed windows, imported revenue/spend behavior, campaign/property/source scoping, source add/edit/refresh/delete behavior, scheduler behavior, email/report behavior, API ownership checks, or provider token semantics. It intentionally does not broaden the date window or invent provider metrics for a campaign with no completed GA4 day.
- Local validation: `npm test -- server/ga4-reporting-day-cutoff-regression.test.ts` passed with `9` tests; `npm run check` passed.
- Deployed endpoint validation captured on `2026-07-03T12:17:39.484Z`: `overallPass: true`, all checked endpoints passed, `/ga4-to-date` returned HTTP `200`, `successField: true`, `noCompletedWindow: true`, `checks.ga4ToDateFixed: true`, spend breakdown stayed `$507.70`, and one Google Sheets spend source was present. Post-deploy UI reconfirmation after commit `3b25a01a` passed; user confirmed the refreshed UI still showed `$507.70` in the spend card/source modal.
Current Commit 2f.2 Google Sheets spend refresh edit-preview metadata finding:

- RCA: the second-campaign run-now refresh correctly materialized spend records and Overview totals from the current sheet, changing source `62772549-88dc-4cc5-bfe6-2e991d518ef5` from `$706.45` to `$807.70` with the same source ID and no duplicate. However, edit mode hydrated its preview table from `spend_sources.mapping_config.sheetSampleRows`, and the scheduler/run-now refresh posted the old mapping config back through `/spend/sheets/process`. The process route fetched fresh sheet rows for calculations but saved the old preview metadata back to `mappingConfig`, so edit mode could still show the stale `$198.75` row even after the materialized spend total was correct.
- Smallest safe fix implemented: `/api/campaigns/:id/spend/sheets/process` now overwrites `sheetHeaders`, `sheetSampleRows`, and `sheetRowCount` in the stored mapping config from the fresh sheet rows already fetched during that process call. The fix is local to Google Sheets spend process metadata.
- Side-effect boundary: this does not change spend parsing, spend totals, spend record dates, source identity, campaign/property/source scoping, scheduler timing, revenue behavior, report/email behavior, API ownership checks, or the run-now route shape. It updates only saved edit-preview metadata so edit mode reflects the same fetched sheet used for refreshed totals.
- Local validation: `npm test -- server/ga4-auto-refresh-regression.test.ts` passed with `8` tests; `npm run check` passed.
- Existing-data boundary: existing stale `mappingConfig.sheetSampleRows` for source `62772549-88dc-4cc5-bfe6-2e991d518ef5` was bounded to the affected source metadata and self-healed by rerunning that source's Google Sheets spend run-now refresh after deploy. The deployed self-heal packet on `2026-07-03T13:14:11.596Z` returned `overallPass: true`, `spendStillCorrect: true`, and `sameSourceStillPresent: true`; user confirmed edit mode showed updated sheet data instead of stale `$198.75`. No direct database cleanup is required for this source.

Current Commit 2j spend import/update response latency finding:

- RCA: manual, LinkedIn Ads, CSV, and Google Sheets spend process routes wrote the source/spend records and recalculated `campaign.spend`, then still awaited `recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update")` before returning success. That recompute runs the heavier GA4 KPI/Benchmark daily/history path and can make the user-facing `Import/update spend` click wait after the Overview spend source data is already durable.
- Smallest safe fix implemented: added `scheduleGA4SpendPostResponseRecompute(campaignId)` and changed only the spend add/import/edit process routes to call it after awaited `recalcCampaignSpend(campaignId)`. The source write, spend record write, and `campaign.spend` recalculation still complete before the response; only downstream GA4 KPI/Benchmark recompute moves post-response.
- Side-effect boundary: this does not change spend parsing, spend totals, spend record dates, source identity, campaign/property/source scoping, revenue behavior, scheduler behavior, report/email behavior, API ownership checks, or delete/cleanup recompute behavior. Spend delete and cleanup paths still await their existing recompute after durable spend changes.
- Local validation: `npm test -- server/ga4-source-lifecycle-recompute-regression.test.ts` passed with `4` tests; `npm run check` passed; `git diff --check -- server/routes-oauth.ts server/ga4-source-lifecycle-recompute-regression.test.ts GA4/OVERVIEW_PRODUCTION_READINESS.md` passed.
- Deployed boundary: user confirmed deployed timing/UI responsiveness after commit `29c67820` deployed on `2026-07-03`; no exact elapsed-time packet or numeric SLA is recorded. This closes the practical deployed timing gate for the validated spend import/update click, while future source families or a formal SLA would need their own timing evidence.

Required provider-family validation pattern:

1. Run a baseline snapshot before the source-family action.
2. Perform exactly one add/import, edit, refresh, or delete/deactivate action through the deployed app/provider flow.
3. Run an after snapshot with `-CompareToPath` pointing at the baseline output.
4. Confirm only the intended source IDs and totals changed.
5. Confirm source modal provenance reconciles to the relevant revenue or spend total.
6. For refresh, confirm the intended source ID persisted instead of creating a duplicate active source.
7. For delete, confirm the intended source ID was removed/deactivated and unrelated source IDs persisted.

Full Current Commit 2 source-family lifecycle plan:

- A source family is closed only for the exact lifecycle action that has before/after evidence; one source family or one action cannot certify another family or action.
- Each evidence packet must record the deployed URL, campaign ID, actor/session boundary, timestamp, source family, lifecycle action, before/after source IDs, before/after totals, source-modal provenance, and whether downstream Overview financial cards changed only as expected.
- A lifecycle action can be marked `not applicable` only after the UI/API route trace proves the product has no such action for that source family. Until then it remains `unproven`, not passed.
- HubSpot and Salesforce validation must distinguish confirmed revenue-source behavior from Pipeline Proxy early-signal behavior; Pipeline Proxy evidence is not proof that confirmed `Total Revenue` is correct.

Current Commit queue for the HubSpot revenue certification track:

1. Current Commit 4.0: test-hygiene unblock only. Root cause: `server/source-safety-regression.test.ts` mixes many source families and its Google Sheets Reports assertion still expected the pre-GA4 source-backed report platform list, while `server/report-scheduler.ts` and `server/routes-oauth.ts` now intentionally include `google_analytics`. Smallest safe fix: update only the stale exact-string assertions so the mixed file can run again. Local validation: `npm test -- server/source-safety-regression.test.ts`. This is not HubSpot production-readiness evidence.
2. Current Commit 4.1: HubSpot OAuth ownership hardening. Root cause confirmed locally: HubSpot connect created an auth URL without `ensureCampaignAccess`, and callback trusted raw `state` as `campaignId` before writing `hubspot_connections`. Smallest safe local fix: require campaign access before auth URL generation and verify HMAC/TTL-signed HubSpot state in callback before using the campaign ID. Local validation: `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts server/endpoint-auth-audit.test.ts` and `npm run check`. Provider callback behavior remains unproven until deployed validation.
3. Current Commit 4.2: HubSpot GA4 materialization fail-closed behavior. Root cause confirmed locally: the HubSpot save route caught `revenue_sources`/`revenue_records` materialization failures, logged `Failed to materialize revenue records`, then continued to recompute and return `success: true`. Smallest safe local fix: for `platformCtx === "ga4"`, return HTTP `500` from that catch before recompute/success response; non-GA4 HubSpot contexts keep existing behavior in this commit to avoid adjacent side effects. Local validation: `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts server/latest-day-revenue-regression.test.ts server/ga4-auto-refresh-regression.test.ts` and `npm run check`. Provider/deployed behavior and any pre-existing partial materialization damage remain unproven.
4. Current Commit 4.3: GA4 Pipeline Proxy platform scoping. Root cause confirmed locally: the GA4 Overview page fetched HubSpot Pipeline Proxy without `platformContext=ga4`, while the HubSpot endpoint defaults unscoped requests across `ga4`, `linkedin`, and `meta`, allowing a newer non-GA4 HubSpot proxy source to be selected. Smallest safe local fix: add `?platformContext=ga4` only to the GA4 page HubSpot Pipeline Proxy fetch; query keys, server selection logic, Salesforce fetch behavior, confirmed revenue math, scheduler behavior, and storage contracts are unchanged. Local validation: `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts` and `npm run check`. Deployed/provider values and Salesforce Pipeline Proxy scoping remain outside this HubSpot commit unless separately validated.
5. Current Commit 4.4: focused HubSpot GA4 Overview automated lifecycle guards. Root cause confirmed locally: after fixing the three runtime blockers, HubSpot still had no focused automated guard proving the GA4 Overview route/storage/scheduler lifecycle invariants in one HubSpot-only test file; relying on mixed source-family tests or provider evidence would overclaim. Smallest safe local fix: expand `server/hubspot-revenue-ga4-overview-regression.test.ts` only, covering signed OAuth state/access, stable source identity on save/edit, GA4 daily materialization markers, fail-closed materialization, delete source/record scoping, active/platform-scoped storage reads, scheduler `sourceId`/`platformContext`, and GA4 Pipeline Proxy context. Local validation: `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts`. This remains source-level automated evidence, not deployed/provider or production-data proof.
6. Current Commit 4.5: deployed HubSpot provider lifecycle validation. Partial deployed evidence captured for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` using `Total Revenue only (no Pipeline card)`, so Pipeline Proxy is not part of this evidence. Add/import passed endpoint and inventory checks on `2026-07-04T08:42:58.869Z`: `inventoryPass: true`, active HubSpot GA4 source count `1`, HubSpot revenue record count `2`, source-backed revenue `$10,600`, endpoint pass `true`, no HubSpot findings, and source IDs `73067acd-06d9-4bf4-925a-cc8a0cfad7c9` plus preserved non-HubSpot source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5`. Edit/update passed on `2026-07-04T08:45:44.181Z`: still one active HubSpot GA4 source, HubSpot record count `4`, source-backed revenue `$16,600`, endpoint pass `true`, and no HubSpot findings. Delete/deactivate passed on `2026-07-04T08:59:09.919Z`: active HubSpot source count `0`, HubSpot record count `0`, source-backed revenue returned to `$600`, only source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` remained active, endpoint pass `true`, and no HubSpot findings. Refresh/reprocess was not separately validated because no deployed UI refresh/sync/reprocess button was found during the tested flow. Required provenance gaps remain: HubSpot account identity, selected HubSpot deal fields/date field, selected campaign values, and source-modal provenance were not recorded in this packet. Therefore this is deployed endpoint/data-health evidence for add/edit/delete only, not full HubSpot clean certification.
7. Current Commit 4.6: production HubSpot data-health inventory runner. Root cause confirmed locally: the HubSpot certification track had deployed provider lifecycle validation queued, but no HubSpot-specific, repeatable, read-only production-data inventory runner to bracket that validation without using other source-family evidence. Smallest safe local fix: extend the existing campaign-access-guarded GET source-damage inventory endpoint with separate `hubspotInventoryPass`, `hubspotSummary`, and `hubspotFindings`, and expose `GA4OverviewValidation.hubspotInventory({ campaignId })` for before/after runs. The existing broad `overallPass` source-damage semantics are unchanged. Local validation: `node --check client/public/ga4-overview-validation-runner.js`, `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts server/spend-source-additivity.test.ts`, and `npm run check`. Deployed before inventory on `2026-07-04T08:18:27.469Z` passed with `inventoryPass: true`, `overallPass: true`, no existing HubSpot revenue sources/records, and no HubSpot findings. Deployed after inventory on `2026-07-04T09:02:41.076Z` passed with `inventoryPass: true`, `overallPass: true`, `hubspotRevenueSourceCount: 1`, `activeHubspotRevenueSourceCount: 0`, `hubspotRevenueRecordCount: 0`, `scopedGa4CampaignValueCount: 3`, `hubspotFindingCount: 0`, and all HubSpot finding arrays empty. Cleanup is not indicated by this evidence; any future cleanup must be a separate Current Commit with exact affected IDs.
8. Current Commit 4.7a: HubSpot provenance automation. Root cause confirmed locally: Current Commit 4.5/4.6 endpoint evidence proved add/edit/delete data health, but did not record the non-secret HubSpot account identity, saved mapping fields, selected campaign values, date/revenue fields, Pipeline Proxy setting, or source-modal expected provenance needed for clean certification. Smallest safe local fix: extend the existing campaign-access-guarded, read-only source-damage inventory endpoint with separate `hubspotProvenancePass`/`hubspotProvenance` fields and expose `GA4OverviewValidation.hubspotProvenance({ campaignId, expectedPipelineEnabled: false })`. The route uses a direct column-limited HubSpot connection `db.select` and must not call token-hydrating storage helpers, refresh providers, mutate records, recompute metrics, or expose OAuth tokens/secrets. Local validation: `node --check client/public/ga4-overview-validation-runner.js`, `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts server/spend-source-additivity.test.ts`, and `npm run check`. Deployed provenance capture remains pending until the runner is run after a HubSpot add/import or edit/update while the active source still exists.
9. Current Commit 4.7b: deployed HubSpot provenance capture. Deployed provenance evidence captured on `2026-07-04T09:38:07.410Z` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` after re-adding a HubSpot Total Revenue-only source. `provenancePass: true`, `overallPass: true`, `accountPresent: true`, and all checks passed (`endpointPass`, `readonly`, `serverProvenancePass`, `activeSourceCountPass`, `pipelineExpectationPass`). Non-secret account evidence: connection `902d0a19-1dbf-4d02-b475-2043e756322b`, portal ID `147492723`, active since `2026-07-04T08:33:02.584Z`, no portal name recorded. Active source evidence: source `65867434-cbed-4792-9496-8072f63a9c82`, display `HubSpot (Deals)`, `platformContext: ga4`, record count `2`, source revenue `$14,000`, active since `2026-07-04T09:35:47.703Z`. Mapping evidence: `campaignProperty: dealname`, `selectedValues: [LI_B2B_SaaS_US_Q1 - Deal 3]`, `revenueProperty: amount`, `dateField: closedate`, `pipelineEnabled: false`, `pipelineStageId: null`, source `dailyMaterialization: selected_date_field_v1`. Source-modal expected evidence: display `HubSpot (Deals)`, type label `HubSpot`, date label `Close Date`, revenue `$14,000`. Findings were empty: no missing account, no missing mapping provenance, and no connection/source mapping mismatch. No tokens or secrets were included. This closes deployed provenance capture for this exact active HubSpot source only.
10. Current Commit 4.7c: HubSpot refresh/reprocess applicability trace. Root cause/applicability confirmed locally: GA4 Overview mounts `AddRevenueWizardModal` for add/edit/save and the Revenue Sources dialog exposes edit/delete controls, but no HubSpot refresh/sync/reprocess control; server source-scoped run-now routes exist only for Google Sheets revenue/spend, while HubSpot reprocess is scheduler-only through `auto-refresh-scheduler.ts` calling `/api/campaigns/:id/hubspot/save-mappings` with stable `sourceId` and `platformContext`. Smallest safe local fix: add a static regression guard proving the UI/API boundary and scheduler-only distinction without changing runtime behavior. Local validation: `npm test -- server/hubspot-revenue-ga4-overview-regression.test.ts` and `npm run check`. Deployed user validation already observed no refresh button in the HubSpot revenue source edit flow. Result: HubSpot GA4 revenue refresh/reprocess is not applicable as a deployed user-facing source action; background scheduler/provider propagation remains a separate optional proof, not evidence of a UI refresh button.
11. Current Commit 4.7d: final HubSpot clean-certification documentation update. Root cause confirmed locally: after 4.7c was committed/pushed, the readiness document still carried a pending HubSpot certification state even though the remaining user-facing refresh/reprocess gate had been closed as not applicable. Smallest safe fix: documentation-only status update, with no runtime, calculation, scheduler, route, storage, or API contract changes. Result: HubSpot is clean-certified only for the exact proven interactive GA4 Overview `Total Revenue only (no Pipeline card)` scope on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`: add/import, edit/update, delete/deactivate, before/after inventory, provenance, and no deployed user-facing refresh/reprocess applicability. Pipeline Proxy, other campaigns, alternate mappings, background scheduler/provider propagation, Reports, KPI/Benchmark propagation, emails, and provider mutation propagation remain unproven unless separately validated.
12. Current Commit 4.8a: HubSpot scheduler/provider propagation automation. Root cause confirmed locally: HubSpot clean-certification excludes background scheduler/provider propagation because the existing runner could capture generic before/after snapshots, inventory, and provenance separately, but it did not enforce a single HubSpot provider-change packet with same active source ID, no duplicate source, HubSpot revenue delta matching total revenue delta, spend unchanged, and clear HubSpot findings. Smallest safe local fix: add read-only `hubspotPropagationBefore(...)` and `hubspotPropagationAfter(...)` runner helpers plus a static regression guard. These helpers must not trigger the scheduler, call HubSpot, post to `save-mappings`, create/edit/delete sources, recompute metrics, send reports, or mutate provider/source data. Deployed provider evidence remains pending until 4.8b.
13. Current Commit 4.8a.1: HubSpot propagation provenance/modal parity fix. Root cause confirmed from deployed 4.8b attempt: the visible Revenue Sources modal and `/revenue-breakdown` showed the correct HubSpot source delta (`$7,000` to `$7,100`, total revenue `$7,600` to `$7,700`), but the read-only provenance endpoint reported `$14,000` to `$14,200` because it summed aggregate and sub-campaign HubSpot records together. Smallest safe fix: change only the source-damage inventory HubSpot provenance `revenueTotal`/`sourceModalExpected.revenue` calculation to mirror `getRevenueBreakdownBySource` (`aggregate > 0 ? aggregate : subCampaign`) and add a static guard. This does not change source records, Overview calculations, scheduler behavior, provider behavior, UI rendering, or report/KPI/Benchmark paths. Deployed 4.8b remains pending until the after-packet is rerun against this fixed endpoint.
14. Current Commit 4.8b: deployed HubSpot scheduler/provider propagation proof. Deployed evidence captured on `2026-07-04T11:19:09.927Z` with runner `2026-07-04.3` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127` after a controlled HubSpot provider value change using label `4.8b-after-provenance-fix`. The after packet returned `overallPass: true`, `expectedPipelineEnabled: false`, active HubSpot source count `1`, before revenue breakdown `$7,700`, after revenue breakdown `$7,600`, HubSpot source revenue delta `-$100`, total revenue delta `-$100`, spend delta `$0`, HubSpot record-count delta `0`, and all encoded checks passed, including same active HubSpot source IDs, same revenue/spend source IDs, clear inventory/provenance, and no Pipeline Proxy inclusion. This closes scheduler/provider propagation only for this exact controlled Total Revenue-only packet; it does not certify Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark propagation, emails, sandbox provider mutation automation, or future provider changes.
15. Current Commit 4.9: HubSpot Pipeline Proxy automation and deployed evidence. Build mocked local tests and deployed runner checks for `Total Revenue + Pipeline (Proxy)` only. Required proof: proxy uses the saved selected HubSpot campaign values plus selected stage, remains `platformContext=ga4`, does not enter confirmed Total Revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, or Reports, and source-modal provenance remains read-only. This does not certify `Total Revenue only` again or Salesforce.
16. Current Commit 4.10: HubSpot other-campaign portability pack. Parameterize the HubSpot runner over additional `campaignId/propertyId` pairs. Required proof per campaign: campaign access passes, source IDs and records stay campaign-scoped, no cross-campaign source/record leakage, expected totals match only that campaign's selected HubSpot values, and other source families are not used as proof.
17. Current Commit 4.11: HubSpot alternate mapping matrix. Add fixture coverage for supported campaign property, selected-value count, revenue property, and date-field variants, then capture deployed packets only for configured variants. Required proof: daily rows follow the selected HubSpot date field, totals match expected mapped values, edit/update keeps the same source ID, and unlisted mappings remain unproven.
18. Current Commit 4.12: HubSpot Reports value propagation. Add local report payload/snapshot tests and deployed report API/PDF evidence only for Overview values sourced from HubSpot. This proves report value propagation, not provider delivery, report scheduler behavior, or unrelated report variants.
19. Current Commit 4.13: HubSpot KPI/Benchmark value propagation. Add local tests where HubSpot revenue changes the Overview-originated inputs used by ROI, ROAS, CPA, KPI, and Benchmark paths. This proves narrow Overview value propagation only; it does not certify whole KPI or Benchmark readiness.
20. Current Commit 4.14: HubSpot email evidence. Add local mocked-email assertions for HubSpot-backed report payload attachments. Deployed proof requires provider acceptance plus actual inbox or delivery-event evidence; provider API acceptance alone is not delivery proof.
21. Current Commit 4.15: HubSpot provider mutation sandbox automation. Only if sandbox HubSpot write credentials are available, automate create/update/delete of test deals and validate source totals with the runner. Without sandbox write access, keep provider mutation validation as manual HubSpot changes plus automated before/after runner packets.

| Source family | Overview paths affected | Add/import | Edit/update | Refresh/reprocess | Delete/deactivate | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| Google Sheets revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Closed for deployed campaign/source add/import of `dd5dc470-814d-42b9-af19-4b53ac7d08f8` after endpoint plus UI evidence (`$30,300`) | Closed for deployed campaign/source edit/update of `dd5dc470-814d-42b9-af19-4b53ac7d08f8` after endpoint plus UI evidence (`$54,200`) | Closed for deployed campaign/source run-now reprocess of `dd5dc470-814d-42b9-af19-4b53ac7d08f8` after endpoint plus UI evidence (`$84,500`) | Closed for deployed disposable source `32661325-d2a5-404f-a898-2c84e4275809` after fixed-response endpoint evidence plus UI parity (`$31,000` removed, `$600` CSV source preserved) | Closed only for the validated deployed Google Sheets revenue campaign/source lifecycle: add/import, edit/update, run-now refresh/reprocess, and delete/deactivate. Does not certify other campaigns/properties or source families. |
| CSV revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Closed for validated deployed campaign/source add/import after endpoint plus UI evidence (`$600`) | Closed for validated deployed campaign/source edit/update after endpoint plus UI evidence (`$1,200` edited source, `$1,800` imported total) | Not applicable as a separate CSV revenue action after UI/API trace; manual edit/re-upload is the reprocess path already covered by edit/update evidence | Closed for validated deployed campaign/source delete/deactivate after endpoint plus UI evidence (`$1,200` removed, `$600` source preserved) | Closed only for the validated CSV revenue campaign/source lifecycle: add/import, edit/update, no separate refresh/reprocess, and delete/deactivate. Does not certify other campaigns/properties or other source families. |
| Manual/legacy revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required if manual add is exposed | Required | Prove not applicable or validate if a refresh/reprocess route exists | Required | Unproven until deployed before/after evidence is recorded. |
| Shopify revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required if mapping/config edit is exposed | Required | Required | Unproven until deployed before/after evidence is recorded. |
| HubSpot revenue or Pipeline Proxy | Confirmed HubSpot Total Revenue path only for the tested `Total Revenue only (no Pipeline card)` flow; Pipeline Proxy remains early-signal only and was not selected or certified | Endpoint/data-health evidence captured for add/import on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`: active HubSpot source `1`, records `2`, revenue `$10,600`, no findings | Endpoint/data-health evidence captured for edit/update: active HubSpot source stayed `1`, records `4`, revenue `$16,600`, no findings | No deployed user-facing action: UI exposes add/edit/save/delete only and source-scoped run-now routes are Google Sheets-only. Scheduler/provider propagation is closed only for the controlled 4.8b Total Revenue-only packet (`-$100` HubSpot source delta, `-$100` total revenue delta, spend unchanged, `overallPass: true`). | Endpoint/data-health evidence captured for delete/deactivate: active HubSpot source `0`, records `0`, revenue returned to `$600`, no findings | Clean-certified for this campaign's confirmed GA4 Overview `Total Revenue only` interactive revenue path and the exact controlled 4.8b scheduler/provider propagation packet. Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark propagation, emails, sandbox provider mutation automation, future provider changes, and other HubSpot configurations remain unproven. |
| Salesforce revenue or Pipeline Proxy | Confirmed revenue paths only if Salesforce writes revenue sources; Pipeline Proxy remains early-signal only | Required for the exposed source/proxy action | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded and revenue/proxy paths are separated. |
| Google Sheets spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Closed for deployed campaign/source add/import of `8f67b03f-a00b-434f-b81f-db1b2b951595` after endpoint plus UI evidence (`$240`); second-campaign/property add/import UI/source-modal path user-confirmed for `$507.70` on campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418`, with native `ga4ToDate` unblocked by deployed Current Commit 2f.1 endpoint evidence | Closed for deployed campaign/source edit/update of `8f67b03f-a00b-434f-b81f-db1b2b951595` after endpoint plus UI evidence (`$420.20`); second-campaign/property edit/update endpoint path closed for `$706.45` on campaign `61bf28cb-74b0-4beb-9afe-fd02f2f285c6` / property `498536418` | Closed for deployed campaign/source run-now reprocess of `8f67b03f-a00b-434f-b81f-db1b2b951595` after endpoint plus UI evidence (`$198.75`); startup-fired scheduler execution closed separately for source `618e5e12-0f3f-44a2-837a-d2677ad95f64` after endpoint plus UI evidence (`$678.95`); second-campaign refresh/reprocess closed for totals, source identity, and edit-preview freshness at `$807.70` after 2f.2 deployed self-heal evidence | Closed for deployed campaign/source delete/deactivate of `8f67b03f-a00b-434f-b81f-db1b2b951595` after endpoint plus UI evidence (`$198.75` removed); second-campaign/property delete/deactivate closed for source `62772549-88dc-4cc5-bfe6-2e991d518ef5` after endpoint plus UI evidence (`$807.70` removed) | Closed only for the validated deployed Google Sheets spend campaign/source lifecycle, the recorded startup-fired scheduler execution path, the second-campaign add/import, edit/update, refresh/reprocess, and delete/deactivate evidence, and the configured Current Commit 2g mapping fixture at `$678.95`. Does not certify future valid completed-day native GA4 provider data, unlisted tabs/mappings, normal wall-clock scheduled-hour execution if separately required, reports/emails, or other source families. |
| CSV spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Closed for deployed campaign/source add/import after endpoint plus UI evidence (`$2,020`) | Closed for deployed campaign/source edit/update after endpoint plus UI evidence (`$3,120`) | Not applicable as a separate CSV spend action after UI/API/scheduler trace; manual edit/re-upload or stored-row recalculation is the reprocess path already covered by edit/update evidence | Closed for deployed campaign/source delete of `c3611c0f-4bbf-47b9-8615-93e4b140385e` after endpoint plus UI evidence (`$3,120` removed) | Closed only for the validated CSV spend campaign/source lifecycle: add/import, edit/update, no separate refresh/reprocess, and delete/deactivate. Does not certify other campaigns/properties or other source families. |
| Manual/legacy spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required if manual add is exposed | Required | Prove not applicable or validate if a refresh/reprocess route exists | Required | Unproven until deployed before/after evidence is recorded. |
| Google Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |
| Meta Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |
| LinkedIn Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |

Execution order for the next validation step:

1. Google Sheets spend add/import, edit/update, run-now refresh/reprocess, and delete/deactivate are closed only for source `8f67b03f-a00b-434f-b81f-db1b2b951595` in the validated deployed campaign/source path.
2. Current Commit 2e startup-fired scheduler execution is closed only for source `618e5e12-0f3f-44a2-837a-d2677ad95f64` in the validated deployed campaign/source path.
3. Current Commit 2f second-campaign add/import is closed only for the visible Google Sheets spend UI/source-modal financial path at `$507.70` and the post-fix endpoint recheck; Current Commit 2f.1 is closed for deployed no-completed-window endpoint behavior; second-campaign edit/update endpoint evidence is closed for `$706.45`; second-campaign refresh/reprocess totals, source identity, and edit-preview freshness are closed for `$807.70` after Current Commit 2f.2 deployed self-heal validation; second-campaign delete/deactivate is closed for source `62772549-88dc-4cc5-bfe6-2e991d518ef5` after endpoint plus UI evidence (`$807.70` removed). Current Commit 2g.0 adds a reusable validation runner to reduce console-snippet churn, and Current Commit 2g deployed variant evidence is closed for the configured Google Sheets spend fixture at `$678.95`; it does not create, refresh, delete, or certify unlisted Google Sheets shapes. If strict normal wall-clock scheduled-hour proof is required, capture that natural timer run separately rather than mixing it into 2f.
4. Current Commit 2i automates repeatable Overview endpoint and report-smoke evidence so future validation should start with `GA4OverviewValidation.overviewPack(...)` instead of new one-off console snippets.
5. Current Commit 2h report API/snapshot/PDF validation, user-confirmed PDF value parity, and user-confirmed report email delivery are closed for the recorded `GA4 Overview Report` packet only; do not treat it as proof for future scheduled/test sends or untested report variants.
6. Current Commit 3 production source-damage inventory is closed for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`; rerun `GA4OverviewValidation.sourceDamageInventory({ campaignId })` for any other campaign/scope before making cleanup or database-health claims there.
7. Keep evidence packets separate: do not combine Google Sheets spend with revenue latency validation, another source family, Reports evidence, scheduler evidence, or damaged-data inventory.
8. If any action changes an unrelated source ID, duplicates an active source, loses provenance, changes totals unexpectedly, broadens source scope, or still shows a false failed response after a successful delete, stop Current Commit 2 and add the exact runtime fix as the next Current Commit.

What remains unproven externally:

- Google Sheets revenue delete/deactivate is closed only for the validated deployed campaign/source path recorded above. Current Commit 2c deployed latency timing is user-confirmed closed without a numeric SLA. Google Sheets spend lifecycle and startup-fired scheduler execution are closed only for the validated deployed campaign/source paths recorded above.
- Normal wall-clock daily scheduler execution remains unproven if required beyond the startup-fired scheduler packet. The GA4 daily stale-row freshness fix is deployed-validated for stale detection/warning, post-reauthorization backfill, and UI Trends parity on the affected campaign/property; future GA4 provider availability, other campaign/property pairs, and normal wall-clock scheduled-hour execution remain external. The `/ga4-timeseries` reconnect response guard is regression-covered locally and deployed operational auth is healthy after reconnect, but the deployed broken-token negative branch was not re-triggered. The GA4 Connected Platforms reconnect-required badge is locally regression-covered, pushed/deployed in commit `3b253ef2`, and deployed operational auth returned `/ga4-metrics` HTTP `200` with `requiresReauthorization: false`; the deployed negative reconnect UI state remains unproven because no real auth failure is currently present. Current Commit 2f second-campaign Google Sheets spend add/import is closed only for visible UI/source-modal financial parity at `$507.70` and endpoint recheck; Current Commit 2f.1 is closed for deployed native GA4 no-completed-window endpoint behavior; second-campaign edit/update endpoint evidence is closed for `$706.45`; second-campaign refresh/reprocess totals, source identity, and edit-preview freshness are closed for `$807.70` after Current Commit 2f.2 deployed validation; second-campaign delete/deactivate is closed for source `62772549-88dc-4cc5-bfe6-2e991d518ef5` after endpoint plus UI evidence (`$807.70` removed). Current Commit 2g.0 validation-runner deployment, Current Commit 2i deployed automated Overview endpoint pack, and Current Commit 2h deployed report API/snapshot/PDF endpoint smoke are closed for their recorded scopes. Current Commit 2g mapping-variant automation is deployed and closed for the configured Google Sheets spend fixture at `$678.95`; unlisted Google Sheets tabs/mappings remain unproven until their own configured `googleSheetsVariantPack(...)` output and UI parity are captured. Production source-damage inventory for campaigns/scopes outside the recorded Current Commit 3 target campaign, future scheduled/test email deliveries outside the recorded GA4 Overview Report packet, untested report variants, and other source families remain unproven until their own evidence packets are captured.
- Shopify, Salesforce, legacy Manual revenue, LinkedIn Ads, Meta Ads, Google Ads, and legacy Manual spend remain provider/user validation work until each relevant family has before/after evidence. HubSpot is clean-certified only for the exact proven GA4 Overview `Total Revenue only` scope on campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, including the controlled 4.8b scheduler/provider propagation packet; Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark propagation, emails, sandbox provider mutation automation, future provider changes, and other HubSpot configurations remain unproven.
- CSV revenue and CSV spend are closed only for the validated deployed campaign/source paths recorded above; they do not prove other campaigns/properties, other uploaded files/mappings, scheduler/report propagation, or future-platform behavior.
- If a before/after snapshot shows a duplicate source, missing source, wrong total, wrong source modal provenance, or unintended unrelated source change, lower only that source-family path to unproven and add the exact runtime fix as the next Current Commit.

## Root Cause Of Prior Confusion

Earlier Overview readiness statements were too broad for the evidence available at the time.

This was a process failure, not just an implementation failure. Future Overview readiness answers must not repeat the current status answer unless the exact value path being questioned is covered by this file's evidence. If a new Overview bug is found, the affected path must immediately be treated as unproven until the root cause, missing test coverage, and documentation are fixed.

The main mismatch was scope:

- prior work proved important Overview-adjacent fixes, including GA4 campaign discovery, live `pageLocation` UTM fallback, removal of synthetic imported GA4 revenue writes, and Campaign DeepDive aggregate parity
- prior tracker language said GA4 Overview financial cards used GA4 to-date native totals
- the later frontend trace proved `ga4RevenueForFinancials` and `financialConversions` were still reading from `breakdownTotals`, the Summary-card source object
- Commit 1 fixed that boundary by keeping Summary cards on their coherent source hierarchy while moving financial revenue and CPA conversions to one selected scoped financial source
- Summary cards and financial cards have different intended window rules, so this file now records both contracts separately

This file fixes the documentation problem by keeping one Overview-specific source of truth:

- `OVERVIEW.md` describes intended tab behavior
- `OVERVIEW_PRODUCTION_READINESS.md` states whether the current implementation satisfies that behavior
- confirmed blockers are listed as commits
- validation gaps are separated from code defects

## Non-Negotiable Accuracy Rules

GA4 Overview must preserve:

- client scoping
- campaign scoping
- selected GA4 property scoping
- selected GA4 campaign/source scoping
- date-window semantics
- GA4 native metric meaning
- financial source provenance
- active-source-only revenue and spend totals
- Pipeline Proxy separation from confirmed revenue
- downstream KPI, Benchmark, Ad Comparison, Insights, and report meaning
- scheduler behavior and fail-closed ownership checks

Do not change calculations, attribution, source ownership, scheduler behavior, alert behavior, notification behavior, report behavior, or response shapes unless a traced root cause proves a bug in that exact path.

Before saying an Overview value is correct, prove the query dimensions, filters, ordering, limits, fallback query shape, merge keys, exact-match rules, negative cases, and downstream consumers for that value. The Landing Pages conversion issue proved that an exact-match merge test was not enough when the fallback query could fail to retrieve conversion-bearing rows.
Do not use wider refactors for future Overview fixes. The completed financial-source fix was intentionally limited to a narrow frontend source-selection correction plus regression coverage.

## Data Path Summary

Primary live UI path:

`GA4 source connection -> saved campaign GA4 scope -> Overview API queries -> frontend Overview model -> visible cards and tables`

Native GA4 daily path:

`GA4 Data API time-series fetch -> ga4_daily_metrics rows -> /ga4-daily -> Summary cards and trend-adjacent context`

Native GA4 to-date path:

`GA4 Data API to-date totals -> /ga4-to-date -> candidate financial GA4 revenue/conversions source`

Financial source path:

`source setup/import/refresh -> revenue_records or spend_records joined to active source definitions -> /revenue-to-date, /revenue-breakdown, /spend-to-date, /spend-breakdown -> financial cards and source modals`

Report/output path:

`same Overview value model -> browser-generated GA4 report sections and downstream consumers`

Important meaning:

- Summary cards and financial cards may use different GA4 source windows by design.
- Summary cards need a coherent visible selected-campaign source and must avoid per-metric maximums.
- Financial cards need one selected scoped native GA4 financial source because imported revenue-to-date and spend-to-date are source-backed values, but native GA4 Revenue must not understate larger visible selected-campaign GA4 rows.
- Pipeline Proxy is an early-signal value and must not enter confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, or Reports unless the product contract changes explicitly.

## Historical Fix Queue And Validation Detail

Use these historical commit labels for completed Overview fixes and detailed remaining validation gates. The `Current Commit Queue` above is the current clean-certification queue; this section preserves the implementation and validation detail behind it.

### Commit 1: Align Overview financial GA4 source with scoped totals

Status: completed and validated.

Fix scope:

Correct only the frontend financial-source selection in `client/src/pages/ga4-metrics.tsx`.

Confirmed root cause:

- `overviewTotalsSource` selects the Summary-card source from daily rows, then GA4 to-date totals, then breakdown totals.
- `breakdownTotals` is built from `overviewTotalsSource`.
- `ga4RevenueForFinancials` previously read `Number(breakdownTotals.revenue || 0)`.
- `financialConversions` previously read `Number(breakdownTotals.conversions || 0)`.
- This coupled financial calculations to the Summary-card source hierarchy.
- When persisted daily rows existed for the default lookback window, financial cards could use that daily-window native revenue/conversion value instead of the intended selected financial source.
- A follow-up mismatch was then proven where Total Revenue showed `$6,718.74` while visible Campaign Breakdown GA4-native rows summed to `$16,265.32`, because `/ga4-to-date` was treated as unconditional financial source even when the visible selected-campaign daily/breakdown source had recovered a larger scoped native GA4 total.

Implementation completed:

1. Summary-card logic stayed unchanged.
2. Added a separate `ga4FinancialTotalsSource` near the existing financial calculations.
3. `ga4FinancialTotalsSource` selects one source object across `ga4ToDateOverviewTotals`, `dailySummedTotals`, and `ga4BreakdownTotals` by the largest scoped native GA4 revenue total.
4. `ga4FinancialTotalsSource` keeps revenue and conversions on that same selected source object instead of using per-metric maxima.
5. `ga4RevenueForFinancials` now reads from `ga4FinancialTotalsSource.revenue`.
6. `financialConversions` now reads from `ga4FinancialTotalsSource.conversions`.
7. Imported revenue, spend, Pipeline Proxy, Campaign Breakdown, Landing Pages, Conversion Events, KPI/Benchmark wiring, report wiring, API routes, scheduler behavior, alerts, and notifications were not changed.

Files changed:

- `client/src/pages/ga4-metrics.tsx`
- `server/ga4-ui-regression.test.ts`
- `server/revenue-additivity.test.ts`

Regression coverage completed:

- Summary cards still use the coherent selected-campaign hierarchy of daily rows, then to-date totals, then breakdown totals.
- `ga4RevenueForFinancials` no longer reads directly from `breakdownTotals.revenue`.
- `financialConversions` no longer reads directly from `breakdownTotals.conversions`.
- financial GA4 revenue uses the most complete scoped native GA4 source across `/ga4-to-date`, daily totals, and breakdown totals.
- CPA uses the same financial conversion source as the selected financial revenue source.
- stale test expectations that forced an unconditional to-date-first rule were updated to prevent GA4 Revenue from understating larger visible native GA4 totals.

Validation completed:

- `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts`
  - result: passed, 2 files, 42 tests
- `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-filter.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
  - result: passed, 9 files, 178 tests
- `npm run check`
  - result: passed

Pass criteria:

- Total Revenue is `selected scoped GA4 native financial revenue + imported revenue-to-date`.
- CPA is `spend-to-date / conversions from the same selected GA4 financial source`.
- Summary cards keep their existing coherent source behavior.
- Pipeline Proxy remains excluded.
- no response shape changes.
- no source lifecycle behavior changes.

Production-like numeric parity:

- not rerun in this local Commit 1 pass.
- prior production-like Campaign DeepDive parity remains documented in broader GA4 readiness history.
- future deployed parity checks are validation gates, not known local code blockers.

### Commit 2: Document and validate the fixed Overview status

Status: completed in this documentation update.

Fix scope:

Update only this file after Commit 1 passed validation.

Implementation completed:

1. Moved Commit 1 from required to completed.
2. Recorded files changed.
3. Recorded exact tests run.
4. Recorded that production-like numeric parity was not rerun in this local pass.
5. Changed `Current Status` to the post-fix local code-scope certification answer and kept external caveats explicit.
6. Kept external caveats separate from code readiness.

Files changed:

- `GA4/OVERVIEW_PRODUCTION_READINESS.md`

Pass criteria:

- future chats can answer Overview readiness by reading this file without reopening unrelated GA4 sections.
- the answer separates proven local readiness from deployed/provider validation.

### Follow-up: Align remaining Overview metric propagation paths

Status: completed and validated locally.

Fix scope:

Correct only proven Overview-originated value propagation gaps found during the post-Landing-Pages review.

Confirmed root cause:

- prior readiness checks proved the financial-source selection fix and the Landing Pages exact-key fix, but they did not line-by-line compare every visible Overview formula and downstream consumer formula against the intended source model.
- the Summary `Conversions` card could render `financialConversions`, even though Summary `Sessions`, `Users`, and `Conv. Rate` use the coherent Summary source hierarchy.
- Insights live Data Summary and browser-generated Insights report CPA could divide `financialSpend` by `breakdownTotals.conversions` instead of using the Overview `financialCPA` value derived from the selected financial conversion source.
- `Conversion Events` used same-scope `pageLocation` fallback only when the primary event query was empty, not when primary event rows existed with event counts/users but missing conversions/revenue.
- scheduled/server GA4 PDF payload generation rebuilt Overview Summary totals with per-metric daily/to-date maxima, so scheduled report output could diverge from the Overview coherent source hierarchy.
- KPI creation fallback recalculated the initial stored value with `financialConversions` for every template; CPA needs financial conversions, but `Total Conversions` and `Conversion Rate` must use the Summary conversion source.

Implementation completed:

1. Summary `Conversions` now renders `breakdownTotals.conversions || ga4Metrics?.conversions`, matching Summary `Conv. Rate` and KPI `Total Conversions` live values.
2. Insights live Data Summary and browser-generated report CPA now render `financialCPA` and gate on `financialConversions` plus spend availability.
3. `getConversionEventsReport` now supplements missing conversion/revenue fields from same-scope `pageLocation` UTM rows only by exact `eventName` match; unmatched fallback rows are not added.
4. scheduled/server GA4 PDF Summary totals now use the same coherent source order as the Overview UI: daily rows, then GA4 to-date totals, then breakdown totals.
5. KPI create fallback now uses financial conversions only for CPA; `Total Conversions` and `Conversion Rate` use the Summary conversion source.

Files changed:

- `client/src/pages/ga4-metrics.tsx`
- `server/analytics.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/ga4-filter.test.ts`
- `server/ga4-ui-regression.test.ts`
- `GA4/OVERVIEW.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
- `GA4/README.md`
- `GA4_PRODUCTION_READY_TRACKER.md`

Regression coverage completed:

- Summary `Conversions` is guarded against using `financialConversions`.
- Insights CPA is guarded against `financialSpend / breakdownTotals.conversions` drift.
- KPI create fallback is guarded so only CPA uses `financialConversions`.
- scheduled/server GA4 PDF Summary totals are guarded against per-metric `Math.max` drift.
- Conversion Events exact-key supplementation is covered with same-scope `pageLocation` fallback rows and unmatched fallback rows that must not be added.

Validation completed:

- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
  - result: passed, 2 files, 44 tests
- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
  - result: passed, 11 files, 204 tests
- `npm run check`
  - result: passed
- `git diff --check -- client/src/pages/ga4-metrics.tsx server/analytics.ts server/ga4-scheduled-report-pdf.ts server/ga4-filter.test.ts server/ga4-ui-regression.test.ts GA4/OVERVIEW.md GA4/OVERVIEW_PRODUCTION_READINESS.md GA4/README.md GA4_PRODUCTION_READY_TRACKER.md`
  - result: passed

Pass criteria:

- Overview Summary values use one coherent source hierarchy.
- Overview financial values use one selected scoped financial source.
- CPA uses the financial conversion source consistently in Overview, Insights, KPI/Benchmark financial paths, and report output.
- `Total Conversions` and `Conversion Rate` use Summary conversions, not CPA conversions.
- table row supplements require exact row-level matches and never allocate campaign-level conversions or imported revenue.
- browser-generated and scheduled/server GA4 report output do not diverge from the relevant Overview value model.

### Commit 3: Real source-family lifecycle validation

Status: validation gate, not a confirmed code bug.

Fix scope:

Validate each real source family only when deployed/provider credentials and test data are available.

Revenue source families:

- Shopify
- HubSpot
- Salesforce
- Google Sheets
- CSV
- legacy Manual revenue, if present

Spend source families:

- LinkedIn Ads
- Meta Ads
- Google Ads
- Google Sheets
- CSV
- legacy Manual spend, if present

Validation strategy for each source family:

1. Add or import the source with known test data.
2. Confirm it appears in `Total Revenue -> Sources` or `Total Spend -> Sources`.
3. Confirm the total card equals active source rows plus native GA4 revenue where applicable.
4. Confirm downstream values update: Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Insights, and reports generated after the change.
5. Edit the source.
6. Confirm the old amount is replaced, not duplicated.
7. Confirm the source count stays correct.
8. Delete the source.
9. Confirm only that source contribution is removed.
10. Confirm unrelated source rows and totals remain unchanged.
11. For refreshable sources, run or wait for scheduler refresh.
12. Confirm refresh updates the same source ID instead of creating a duplicate.

Pass criteria:

- add, edit, delete, source modal display, totals, and downstream recompute work for the source family
- source modal provenance reconciles to the relevant total card
- edit and scheduler paths preserve stable source identity
- delete affects only the verified source ID
- refreshable sources update in place and do not append duplicates

### Commit 4: Production data inventory for source damage

Status: validation gate, not a confirmed code bug.

Fix scope:

Perform read-only production or staging inventory before writing any cleanup.

Validation strategy:

1. Query for `revenue_records` rows whose `revenue_source_id` has no matching active `revenue_sources.id`.
2. Query for `spend_records` rows whose `spend_source_id` has no matching active `spend_sources.id`.
3. Group results by campaign, source type, platform context, and source ID.
4. Check for duplicate active source definitions with identical campaign/source/platform/mapping signatures.
5. For suspicious rows, inspect exact IDs and source metadata before deciding whether they are valid legacy data or damaged data.
6. Do not delete or rewrite anything during inventory.

Pass criteria:

- either no orphan or duplicate source records are found, or exact affected IDs are documented
- any cleanup plan has a proven source/campaign/record boundary before a migration is written
- CRM, ecommerce, CSV, Google Sheets, Manual, and ad-platform rows are not touched unless individually proven damaged

### Commit 5: Landing Pages exact-key conversion supplement

Status: completed and locally validated.

Fix scope:

Correct only the GA4 Landing Pages service response in `server/analytics.ts` for the case where primary landing-page rows have traffic but no conversion/revenue values while the same selected campaign scope has compatible `pageLocation` UTM rows with row-level conversion values.

Confirmed root cause:

- `/api/campaigns/:id/ga4-landing-pages` calls `getLandingPagesReport`.
- The service queried `landingPagePlusQueryString + sessionSource + sessionMedium` first.
- The existing `pageLocation` UTM fallback ran only when the primary result was empty.
- For fresh or Measurement Protocol-style GA4 data, the primary result can contain landing-page traffic rows while conversions are exposed only through same-scope `pageLocation` UTM rows.
- The service returned the traffic rows as-is, so visible `Conversions` and `Conv. rate` could show zero even when a row-level `pageLocation` match existed.

Implementation completed:

1. Primary landing-page traffic rows remain the base table.
2. If those rows already contain conversion/revenue values, behavior is unchanged.
3. If primary rows contain traffic but no conversion/revenue values, the service queries the existing same-scope `pageLocation` UTM fallback.
4. Fallback conversion/revenue values are merged only when `Landing page + Source + Medium` match exactly.
5. Unmatched fallback rows are not added to the table and campaign-level conversions are not allocated into page rows.
6. Frontend table rendering, imported revenue behavior, Summary cards, Campaign Breakdown, Conversion Events, KPI/Benchmark wiring, reports, scheduler behavior, alerts, and notifications were not changed.

Validation completed:

- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
  - result: passed, 2 files, 41 tests
- `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts`
  - result: passed, 5 files, 77 tests
- `npm run check`
  - result: passed

Pass criteria:

- Landing Pages can recover exact row-level conversions when GA4 exposes them through same-scope `pageLocation` UTM rows.
- Landing Pages still leaves row conversions at zero when no exact row-level match exists.
- no campaign-level conversion allocation is introduced.
- no response shape changes.
- no source lifecycle, scheduler, alert, notification, KPI, Benchmark, Ad Comparison, Insights, or Reports behavior changes.

### Follow-up: Landing Pages pageLocation traffic fallback conversion supplement

Status: completed and locally validated.

Fix scope:

Correct only the GA4 Landing Pages service response in `server/analytics.ts` for the case where the primary `landingPagePlusQueryString + sessionSource + sessionMedium` query returns no rows, the same-scope `pageLocation` UTM traffic fallback returns landing-page rows, and conversion/revenue values are available only through a conversion-prioritized same-scope `pageLocation` query.

Confirmed root cause:

- temporary deployed diagnostics for `/api/campaigns/:id/ga4-landing-pages?diagnostics=1` showed `primaryLandingPages` returned `rowCount: 0` for the saved `sessionCampaignName` filter.
- the API response still returned six Landing Pages rows because the service fell back to same-scope `pageLocation` traffic rows ordered by `sessions`.
- that primary-empty branch returned the traffic fallback rows directly and did not run the conversion-prioritized `pageLocation` supplement against those fallback rows.
- the previous regression coverage covered primary landing-page rows with missing conversions, but not the primary-empty plus `pageLocation` traffic-fallback branch.

Implementation completed:

1. Kept the existing primary query and `pageLocation` traffic fallback behavior.
2. Added a shared conversion-supplement step that runs only when the current base rows have traffic/users but missing conversion/revenue values.
3. Applied that step to both primary landing-page rows and `pageLocation` traffic-fallback rows.
4. Kept exact `Landing page + Source + Medium` matching.
5. Kept unmatched fallback rows out of the table and did not allocate campaign-level conversions.
6. Kept frontend rendering, response shape, Summary cards, Campaign Breakdown, Conversion Events, KPI/Benchmark wiring, reports, scheduler behavior, alerts, and notifications unchanged.

Files changed:

- `server/analytics.ts`
- `server/ga4-filter.test.ts`
- `GA4/OVERVIEW.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
- `GA4/README.md`

Validation completed:

- `npm test -- server/ga4-filter.test.ts`
  - result: passed, 1 file, 16 tests
- `npm test -- server/ga4-ui-regression.test.ts`
  - result: passed, 1 file, 30 tests
- `npm run check`
  - result: passed

Pass criteria:

- Landing Pages can recover exact row-level conversions when the base rows came from the same-scope `pageLocation` traffic fallback.
- Landing Pages still leaves row conversions at zero when no exact row-level conversion match exists.
- no campaign-level conversion allocation is introduced.
- no response shape changes.
- no source lifecycle, scheduler, alert, notification, KPI, Benchmark, Ad Comparison, Insights, or Reports behavior changes.

### Follow-up: Remove temporary Landing Pages diagnostics

Status: completed after deployed validation.

Cleanup scope:

Remove the temporary `diagnostics=1` support from `/api/campaigns/:id/ga4-landing-pages` after it proved the deployed live-test behavior. Keep the production GA4 query path, exact-key fallback supplement, and regression coverage.

Deployed validation result:

- property `542352127` is a live GA4 test property, not the deterministic `yesop` simulator.
- the deployed diagnostic run showed `primaryLandingPages` returned zero rows, `pageLocationTrafficFallback` returned six rows, and `pageLocationConversionFallback` returned six rows.
- the conversion fallback rows for that live test property had `Conversions = 0` and `Revenue = 0` for the exact landing-page/source/medium keys.
- therefore visible Landing Pages `Conversions = 0` and `Conv. rate = 0.0%` are correct for that live test property data.
- production properties with real conversion-bearing GA4 rows should populate from the same live GA4 Data API path; the app must not allocate campaign-level conversions into Landing Pages rows when GA4 does not return exact row-level conversion values.

Implementation completed:

1. Removed the endpoint query flag and service response diagnostics payload.
2. Removed the diagnostic-only regression test.
3. Kept the production fallback conversion supplement and its regression test.
4. Kept the normal `meta: { usersAreNonAdditive: true }` response shape for Landing Pages.

Files changed:

- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/ga4-filter.test.ts`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`

Validation completed:

- `npm test -- server/ga4-filter.test.ts`
  - result: passed, 1 file, 16 tests
- `npm test -- server/ga4-ui-regression.test.ts`
  - result: passed, 1 file, 30 tests
- `npm run check`
  - result: passed

Pass criteria:

- production Landing Pages no longer exposes temporary raw diagnostics.
- live GA4 Data API values remain the source of truth for numeric properties.
- exact row-level conversion supplementation remains covered.
- zero row-level conversions remain valid when GA4 returns zero for the exact Landing page + Source + Medium grain.

## Section Production-Readiness Map

### 1. Campaign, Client, Property, And Source Scope

Status: production-ready locally for current code scope.

User-facing role:

- ensure Overview represents one app campaign's selected GA4 source scope, not a client-wide or property-wide rollup

Inputs:

- authenticated user
- selected client/campaign
- campaign's saved GA4 property ID
- campaign's saved GA4 campaign filter
- selected Overview date range where applicable

Current logic:

- Overview routes verify campaign access before returning campaign data.
- GA4 API calls use the selected GA4 property.
- GA4 campaign filters are applied to campaign dimensions first.
- `pageLocation` `utm_campaign` fallback is used only when primary scoped results are empty.
- setup stores GA4 scope; Overview renders from current query-backed values for that scope.

Proven locally:

- `/ga4-daily`, `/ga4-to-date`, `/ga4-breakdown`, `/ga4-landing-pages`, and `/ga4-conversion-events` are campaign-access guarded
- live GA4 fallback remains selected-campaign scoped
- numeric live GA4 properties are not treated as deterministic Yesop simulation paths
- current regression coverage guards the selected Overview date range for Landing Pages and Conversion Events

Partially reviewed:

- post-setup GA4 campaign rescope is intentionally not a current UI workflow

Not locally verifiable:

- real OAuth token health
- live GA4 property permissions
- live GA4 Data API consistency for a deployed account

Future-platform template rule:

- every platform Overview must prove the exact account/property/customer/source scope before rendering metrics
- fallback discovery may broaden dimensions only inside the same selected platform source and campaign scope
- no platform Overview may silently roll up unrelated account or property data

### 2. Summary Cards

Status: production-ready locally for current code scope.

User-facing role:

- show selected-campaign GA4-native traffic, user, conversion, engagement, and conversion-rate values

Inputs:

- `/ga4-daily`
- `/ga4-to-date`
- `/ga4-breakdown`
- selected GA4 property
- saved GA4 campaign filter

Current logic:

- Summary cards use one coherent selected-campaign source.
- Persisted selected-campaign daily facts are preferred when present.
- If daily facts are unavailable, Summary cards fall back to selected-campaign to-date totals.
- If to-date totals are unavailable, Summary cards fall back to selected-campaign breakdown totals.
- The cards avoid taking per-metric maximum values across incompatible sources.
- A stable skeleton is shown while breakdown-backed fallback totals are still loading.

Proven locally:

- regression coverage guards coherent Summary source selection
- regression coverage guards the live `pageLocation` fallback path
- regression coverage guards that Landing Pages and Conversion Events use selected Overview date range

Partially reviewed:

- exact real-property numeric parity depends on live GA4 processing and tagging quality

Not locally verifiable:

- GA4 delayed processing behavior after Measurement Protocol or newly tagged traffic
- whether a user's real GA4 conversion events are configured as expected

Future-platform template rule:

- each platform must define its own Summary-card source hierarchy
- do not combine incompatible date windows by taking maximum values
- if a fallback is needed for fresh attribution gaps, it must remain inside the selected platform account/source/campaign scope

### 3. Financial Cards

Status: production-ready locally for current GA4 code scope.

User-facing role:

- show confirmed financial performance for the selected GA4 campaign

Inputs:

- selected scoped GA4 native financial revenue
- imported revenue-to-date from active revenue sources
- spend-to-date from active spend sources
- conversions from the same selected GA4 financial source for CPA

Current logic:

- `Total Revenue = selected scoped GA4 native financial revenue + imported campaign revenue-to-date`
- `Total Spend = active campaign spend-source total`
- `Profit = Total Revenue - Total Spend`
- `ROAS = Total Revenue / Total Spend`
- `ROI = (Total Revenue - Total Spend) / Total Spend`
- `CPA = Total Spend / conversions from the same selected GA4 financial source`
- Pipeline Proxy is excluded

Fixed defect:

- `ga4RevenueForFinancials` now reads from `ga4FinancialTotalsSource.revenue`, not directly from `breakdownTotals.revenue`.
- `financialConversions` now reads from `ga4FinancialTotalsSource.conversions`, not directly from `breakdownTotals.conversions`.
- `ga4FinancialTotalsSource` selects one source object across `ga4ToDateOverviewTotals`, `dailySummedTotals`, and `ga4BreakdownTotals` by largest scoped native GA4 revenue.
- `breakdownTotals` remains the Summary-card source object and is no longer the direct financial source of truth.

Proven locally:

- imported revenue is additive with GA4 native revenue
- Pipeline Proxy is excluded from confirmed revenue calculations
- spend comes from active spend sources
- source-backed totals use active source joins in storage
- financial GA4 native revenue and CPA conversions use the same selected scoped financial source
- Summary-card source behavior remains unchanged

Partially reviewed:

- individual provider add/edit/delete/refresh lifecycles are not fully certified source family by source family

Not locally verifiable:

- real provider refresh values
- deployed scheduler refresh timing
- production duplicate or orphan source record inventory beyond previously documented GA4 synthetic rows

Future-platform template rule:

- financial totals must name their source set
- every platform must define whether native platform revenue exists, whether spend is native or imported, and which conversions are valid for CPA
- financial cards must not reuse Summary-card values unless the Summary and financial windows are proven identical
### 4. Pipeline Proxy

Status: production-ready locally for current code scope.

User-facing role:

- show CRM open-pipeline early-signal value separately from confirmed revenue

Inputs:

- active HubSpot or Salesforce revenue source configuration
- saved provider campaign-value mapping
- selected pipeline stage
- live or saved proxy amount metadata

Current logic:

- Pipeline Proxy appears from active CRM source configuration, not only from endpoint success.
- Salesforce and HubSpot proxy values can aggregate when both are configured for the same GA4 campaign.
- only positive provider contributions count as contributing sources.
- the card is display-only.
- source management remains under Total Revenue.
- deleting or deactivating the associated CRM source removes the Pipeline Proxy card.
- Pipeline Proxy does not feed confirmed revenue, Profit, ROAS, ROI, CPA, KPIs, Benchmarks, Ad Comparison, Insights, or Reports.

Proven locally:

- the card is derived separately from `financialRevenue`
- source modal behavior is read-only for Pipeline Proxy provenance

Partially reviewed:

- provider-specific live refresh depends on CRM APIs and saved source metadata

Not locally verifiable:

- live HubSpot or Salesforce API values without deployed/provider credentials

Future-platform template rule:

- early-signal pipeline or lead values must be visually and computationally separate from confirmed revenue
- no platform may include pipeline proxy values in confirmed financial metrics without an explicit product redesign

### 5. Campaign Breakdown

Status: production-ready locally for current code scope.

User-facing role:

- show selected GA4 campaign-scope performance grouped by UTM campaign

Inputs:

- `/ga4-breakdown`
- selected GA4 property
- saved GA4 campaign filter
- exact campaign-matched imported revenue mappings where present

Current logic:

- rows are scoped to the selected GA4 campaign values.
- row `Sessions`, `Users`, `Conversions`, and GA4-native `Revenue` preserve the raw GA4 breakdown row values returned for the selected property and saved campaign scope; they are not scaled to Summary card totals.
- the visible revenue column label is `Revenue`, not `GA4 Revenue`, because exact campaign-matched imported revenue may be included.
- imported revenue is added only when source campaign mappings match GA4 campaign rows exactly.
- imported revenue is not proportionally allocated.
- users in row-level breakdowns are directional and are not expected to sum exactly to the top Users card.

Proven locally:

- exact campaign-matched imported revenue behavior is regression-covered
- selected campaign filters are parsed and applied
- regression coverage guards against rescaling Campaign Breakdown row values to Summary card totals
- report label work confirms `Revenue` is the correct executive-facing label when the value can include imported revenue

Partially reviewed:

- visual parity of all report renderers is covered by Reports readiness, not this file

Not locally verifiable:

- live GA4 row availability for every real property/tagging pattern

Future-platform template rule:

- a platform breakdown may include external revenue only when exact row-level matching keys exist
- never allocate campaign-level imported revenue into row-level breakdowns by proportion unless the product explicitly defines and labels allocation

### 6. Landing Pages

Status: production-ready locally for current code scope.

User-facing role:

- show landing-page traffic and conversion context for the selected GA4 campaign scope

Inputs:

- `/ga4-landing-pages`
- selected GA4 property
- saved GA4 campaign filter
- selected Overview date range

Current logic:

- rows use the selected Overview date range.
- rows are fetched through the live `/ga4-landing-pages` GA4 Data API path for numeric property IDs, not reconstructed from scheduler-populated `ga4_daily_metrics`.
- revenue is intentionally not shown.
- imported campaign revenue is not allocated into landing-page rows.
- source/medium can be derived from tagged `pageLocation` fallback rows when attribution dimensions are empty.
- when primary landing-page rows or same-scope `pageLocation` traffic-fallback rows have traffic but missing conversion/revenue values, conversion-prioritized same-scope `pageLocation` UTM rows may supplement conversions only by exact `Landing page + Source + Medium` match.
- unmatched fallback rows are not added and campaign-level conversions are not allocated into landing-page rows.
- zero row-level conversions are valid only when GA4 returns zero for the exact landing-page/source/medium grain.
- row-level Users values are directional and are not expected to reconcile exactly to the top Users card.

Proven locally:

- regression coverage guards selected date-range query usage
- regression coverage guards absence of revenue columns
- regression coverage guards exact-key `pageLocation` conversion supplementation without campaign-level allocation
- regression coverage guards conversion-prioritized Landing Pages fallback queries for both primary landing-page rows and `pageLocation` traffic-fallback rows, so conversion-bearing rows are not hidden by session ordering or UI table limits
- GA4 service code keeps fallback scoped to selected campaign values

Partially reviewed:

- live row quality depends on tagging and GA4 processing

Not locally verifiable:

- exact live landing-page values without real GA4 property validation

Future-platform template rule:

- landing-page or destination-page tables must not receive campaign-level imported revenue unless exact page-level matching identifiers exist

### 7. Conversion Events

Status: production-ready locally for current code scope.

User-facing role:

- show event-level conversion volume context for the selected GA4 campaign scope

Inputs:

- `/ga4-conversion-events`
- selected GA4 property
- saved GA4 campaign filter
- selected Overview date range

Current logic:

- rows use the selected Overview date range.
- rows are fetched through the live `/ga4-conversion-events` GA4 Data API path for numeric property IDs, not reconstructed from scheduler-populated `ga4_daily_metrics`.
- revenue is intentionally not shown.
- imported campaign revenue is not allocated into event rows.
- when primary event rows have event counts/users but missing conversion/revenue values, conversion-prioritized same-scope `pageLocation` UTM rows may supplement conversions only by exact `Event` name match.
- rows that already have conversions/revenue are not overwritten by fallback rows.
- unmatched fallback rows are not added and campaign-level conversions are not allocated into event rows.
- zero row-level conversions are valid only when GA4 returns zero for the exact event grain.
- row-level Users values are directional and are not expected to reconcile exactly to the top Users card.

Proven locally:

- regression coverage guards selected date-range query usage
- regression coverage guards absence of revenue columns
- regression coverage guards exact-key `pageLocation` conversion supplementation without campaign-level allocation
- regression coverage guards row-level Conversion Events supplementation when only some primary rows are missing conversions/revenue
- regression coverage guards conversion-prioritized Conversion Events fallback queries so conversion-bearing event rows are not hidden by UI table limits
- GA4 service code keeps fallback scoped to selected campaign values

Partially reviewed:

- live row quality depends on event naming and GA4 key-event configuration

Not locally verifiable:

- exact live event values without real GA4 property validation

Future-platform template rule:

- event/action tables must define whether values are event counts, conversions, users, revenue, or attribution outputs
- do not attach financial values to event rows without exact event-level financial identifiers

### 8. Source Modals And Source Lifecycle

Status: production-ready locally for current Overview source-modal code scope; provider/source-family lifecycle checks remain external validation gates.

User-facing role:

- show financial provenance and allow users to manage active revenue/spend sources

Inputs:

- `/revenue-sources`
- `/revenue-breakdown`
- `/spend-sources`
- `/spend-breakdown`
- source edit/delete handlers

Current logic:

- Total Revenue and Total Spend cards open source-provenance modals.
- source modals are scrollable.
- source delete handlers invalidate and refetch relevant totals and breakdowns.
- backend delete routes verify campaign access and source ownership before mutation.
- storage totals join records to active source definitions.

Proven locally:

- source modals have vertical scrolling behavior
- source delete routes verify campaign/source ownership
- active-source joins protect totals from inactive/orphan source definitions
- no synthetic GA4 native revenue records should be written into imported revenue records by `/ga4-daily`

Provider/deployed validation gates:

- full add/edit/delete/display/totals/scheduler lifecycle should still be validated for every source family with real provider data
- source modal fallback behavior when breakdown rows are absent is locally understood; source-family certification remains a provider validation gate

Not locally verifiable:

- provider refresh behavior without credentials
- production duplicate/orphan source inventory

Future-platform template rule:

- every source family copied to a new platform needs lifecycle validation: add, edit, delete, refresh, display, totals, downstream recompute, and cleanup boundary

### 9. Refresh And Scheduler Paths

Status: production-ready locally for current Overview refresh code scope; deployed startup-fired Google Sheets spend scheduler execution is recorded for one campaign/source; normal wall-clock scheduler timing and broader provider checks remain external validation gates.

User-facing role:

- keep Overview values fresh without silently broadening scope or writing misleading values

Inputs:

- GA4 daily scheduler
- external source auto-refresh scheduler
- `/ga4-daily` on-demand backfill
- frontend query refetch intervals

Current logic:

- `/ga4-daily` can read persisted rows and backfill native GA4 daily facts when needed.
- daily refresh uses saved GA4 campaign filters.
- external source refresh can trigger downstream KPI/Benchmark and alert checks after source updates.
- Overview page queries refetch while the page is open.

Proven locally:

- scheduler code uses saved GA4 campaign filter parsing
- `/ga4-daily` no longer writes synthetic imported revenue records in current regression coverage
- focused regression tests cover daily fallback and no synthetic revenue write

Provider/deployed validation gates:

- scheduler behavior is traced at code level, with one deployed startup-fired Google Sheets spend scheduler packet recorded for source `618e5e12-0f3f-44a2-837a-d2677ad95f64`
- normal wall-clock scheduled-hour execution and source-family refresh identity should still be certified for each real provider when that broader proof is requested

Not locally verifiable:

- normal wall-clock deployed scheduler execution beyond the recorded startup-fired Google Sheets spend packet
- provider API availability
- real GA4 delayed processing

Future-platform template rule:

- schedulers must fail closed when campaign/source ownership cannot be verified
- refreshes must update stable source IDs and must not append duplicate source definitions or records

### 10. Downstream Consumers

Status: production-ready locally for current Overview-originated values, with one recorded deployed GA4 Overview Report email-delivery packet and future report/email variants still requiring their own evidence.

User-facing role:

- keep values consistent when Overview financial and GA4 metrics feed other GA4 sections

Consumers:

- KPIs
- Benchmarks
- Ad Comparison
- Insights
- browser-generated report output
- scheduled/server GA4 report PDF output where it renders GA4 Overview-originated Total Revenue

Current logic:

- Summary `Conversions`, KPI `Total Conversions`, and Conversion Rate paths use the coherent Summary source hierarchy.
- CPA paths use `financialConversions` and `financialCPA`, which are derived from the selected GA4 financial source used by Total Revenue.
- many downstream UI paths consume `financialRevenue`, `financialConversions`, `financialCPA`, or `ga4RevenueForFinancials`.
- revenue-availability gates for KPIs, Benchmarks, and Insights use `ga4HasRevenueMetric`, which is derived from the same selected GA4 financial source used by Total Revenue.
- browser-generated and scheduled/server GA4 report output use the relevant Overview source model for Summary values, Total Revenue, and CPA conversions.
- Commit 1 and the follow-up propagation hardening corrected those Overview-originated values without reopening independent KPI, Benchmark, Ad Comparison, Insights, or Reports readiness beyond this value-propagation path.

Proven locally:

- KPIs read `financialRevenue` for Revenue, ROAS, and ROI live values; KPI creation prefill/fallback uses Summary conversions for `Total Conversions` and `Conversion Rate`, and financial conversions only for CPA.
- Benchmarks read `financialRevenue`/`financialCPA` for revenue/financial current values; the availability gate now follows `ga4HasRevenueMetric`.
- Ad Comparison receives `totalRevenue={financialRevenue}` and `ga4RevenueTotal={ga4RevenueForFinancials}`; its browser and scheduled report output use those same totals for all-source revenue and source provenance.
- Insights executive cards, data summary, and financial integrity checks read `financialRevenue`; Insights CPA uses `financialCPA`, not `financialSpend / breakdownTotals.conversions`.
- Browser-generated and scheduled/server GA4 Reports read the selected scoped GA4 financial source for Total Revenue and CPA conversions, and scheduled/server GA4 report Summary totals use the same coherent source hierarchy as the Overview UI.
- Campaign DeepDive aggregate/report parity remains a separate aggregate route concern and was not broadened by this Overview propagation fix.
- Reports readiness separately covers scheduled/server report output labels and delivery caveats
- KPI and Benchmark readiness is separate and should not be reopened unless the corrected Overview financial value changes their input contract

Partially reviewed:

- deployed/manual visual parity can be checked separately when needed

Not locally verifiable:

- deployed scheduled PDF/email values without deployed report validation

Future-platform template rule:

- downstream consumers must read the same authoritative platform Overview values or explicitly document a different window/source
- no platform may let live UI and report output diverge in executive-facing financial meaning

## Completed Overview-Related Hardening History

The following Overview-related work is already complete and should not be reopened unless relevant code changes or validation fails:

1. Removed synthetic imported GA4 revenue writes from `/api/campaigns/:id/ga4-daily` while preserving native `ga4_daily_metrics` facts.
2. Cleaned up the proven orphan `revenue_records` rows with `revenue_source_id = 'ga4_daily_metrics'`.
3. Fixed real-property GA4 campaign picker discovery through manual UTM campaign dimensions and `pageLocation` `utm_campaign`.
4. Fixed live real-property Overview zero-metric paths by using selected-campaign `pageLocation` fallback only when primary scoped results are empty.
5. Kept Summary cards on a coherent selected-campaign source instead of per-metric maximum values.
6. Kept Landing Pages and Conversion Events on the selected Overview date range.
7. Kept imported revenue out of Landing Pages and Conversion Events.
8. Corrected Campaign Breakdown revenue labeling where exact campaign-matched imported revenue can be included.
9. Kept Pipeline Proxy separate from confirmed revenue and performance calculations.
10. Added exact-key Landing Pages conversion supplementation from same-scope `pageLocation` UTM rows without allocating campaign-level conversions into page rows.
11. Prioritized conversion-bearing same-scope `pageLocation` rows when supplementing Landing Pages from primary rows and `pageLocation` traffic-fallback rows, so conversion rows are not missed by session ordering or UI table limits.
12. Added exact-key Conversion Events conversion supplementation from same-scope `pageLocation` UTM rows without allocating campaign-level conversions into event rows.
13. Aligned Summary `Conversions`, Insights CPA, KPI creation fallback, and scheduled/server report Summary values to the relevant Overview source model.
14. Stopped Campaign Breakdown UI and scheduled/server PDF output from scaling GA4 row values to Summary card totals; row metrics now preserve the selected-property GA4 breakdown response.
15. Made Conversion Events supplementation row-level and conversion-prioritized so rows missing conversions can be filled by exact event match without overwriting rows that already have GA4 conversions/revenue.

## Validation Evidence

Latest local validation run for the completed Campaign Breakdown and Conversion Events source-path hardening:

- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
- result: passed, 2 files, 45 tests
- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/ga4-financial-rules.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-insights-report-parity-regression.test.ts`
- result: passed, 6 files, 74 tests
- command: `npm run check`
- result: passed

What the validation proves:

- Campaign Breakdown live UI aggregation no longer rescales row Sessions, Users, Conversions, or GA4-native Revenue to Summary card totals.
- scheduled/server GA4 PDF Campaign Breakdown aggregation no longer rescales row GA4-native Revenue to Summary card totals.
- Conversion Events supplementation is row-level: rows that already have conversions/revenue are preserved, rows missing conversions can be filled by exact event-name match, unmatched fallback rows are not added, and the fallback query uses a widened conversion-prioritized limit.

Latest local validation run for the completed Landing Pages conversion-prioritized supplement:

- command: `npm test -- server/ga4-filter.test.ts`
- result: passed, 1 file, 16 tests
- command: `npm test -- server/ga4-ui-regression.test.ts`
- result: passed, 1 file, 30 tests

What the validation proves:

- Landing Pages conversion supplementation uses a conversion-prioritized same-scope `pageLocation` fallback query when primary landing-page traffic rows or same-scope `pageLocation` traffic-fallback rows have missing conversions.
- exact landing-page/source/medium matching is still required.
- unmatched fallback rows are not added and campaign-level conversions are not allocated into page rows.

Latest local validation run for the completed Overview metric propagation hardening:

- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
- result: passed, 2 files, 44 tests
- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
- result: passed, 11 files, 204 tests
- command: `npm run check`
- result: passed
- command: `git diff --check -- client/src/pages/ga4-metrics.tsx server/analytics.ts server/ga4-scheduled-report-pdf.ts server/ga4-filter.test.ts server/ga4-ui-regression.test.ts GA4/OVERVIEW.md GA4/OVERVIEW_PRODUCTION_READINESS.md GA4/README.md GA4_PRODUCTION_READY_TRACKER.md`
- result: passed

What the validation proves:

- Summary `Conversions` uses the Summary source hierarchy, not `financialConversions`.
- Conversion Events exact-key supplementation works without adding unmatched fallback rows.
- KPI creation fallback uses financial conversions only for CPA.
- Insights CPA uses `financialCPA` instead of recomputing from Summary conversions.
- scheduled/server GA4 report Summary totals use the same coherent source hierarchy as the Overview UI.
Latest local validation run for the completed Landing Pages exact-key conversion supplement:

- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts`
- result: passed, 2 files, 41 tests
- command: `npm test -- server/ga4-filter.test.ts server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/report-email-regression.test.ts server/ga4-insights-report-parity-regression.test.ts`
- result: passed, 5 files, 77 tests
- command: `npm run check`
- result: passed

What the validation proves:

- Landing Pages uses exact `Landing page + Source + Medium` matching when supplementing missing conversions from same-scope `pageLocation` UTM rows
- Landing Pages does not add unmatched fallback rows or allocate campaign-level conversions into page rows
- existing Overview UI regression guards still pass

Latest local validation run for the completed Overview financial-source fix:

- command: `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts`
- result: passed, 2 files, 42 tests
- command: `npm test -- server/ga4-ui-regression.test.ts server/revenue-additivity.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-filter.test.ts server/ga4-financial-rules.test.ts server/latest-day-revenue-regression.test.ts server/latest-day-spend-regression.test.ts server/source-safety-regression.test.ts server/spend-source-additivity.test.ts`
- result: passed, 9 files, 178 tests
- command: `npm run check`
- result: passed

What the validation proves:

- the confirmed financial source defect is fixed at the local code/regression level
- Summary cards still use the coherent selected-campaign source hierarchy
- financial GA4 revenue and CPA conversions now use the same selected scoped financial source
- additive native GA4 revenue plus imported revenue behavior remains covered
- current TypeScript compiles
- campaign/property scoping guards and existing source-safety guards remain intact
- no synthetic GA4 imported revenue write is expected from `/ga4-daily`

What the validation does not prove:

- real GA4 provider values match a deployed property
- normal wall-clock deployed scheduler execution beyond the recorded startup-fired Google Sheets spend packet works
- every provider source-family lifecycle is production-ready
- production data has no duplicate or orphan source records outside previously inventoried rows
- future deployed scheduled/test email delivery evidence outside the recorded GA4 Overview Report packet, which remains Reports readiness/runtime scope unless the Overview values inside a report are wrong

## Future Platform Template

GA4 Overview readiness documentation is a structure, process, and certification-quality template for Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source. It is never proof that the target platform is production-ready. Each target platform must produce its own value inventory, trace matrix, downstream matrix, lifecycle matrix, negative-case matrix, tests, deployed/provider caveats, and existing-data inventory where applicable.

### Platform Identity Gate

Before a new platform Overview can be called production-ready, document:

- client boundary
- campaign boundary
- platform account/property/customer boundary
- selected platform campaign/ad group/source boundary
- whether post-setup rescope exists
- which API routes enforce the boundary
- which storage calls enforce the boundary
- which scheduler jobs enforce the boundary

Required answer:

`This platform's Overview data is scoped by [client], [campaign], [platform source/account/property/customer], and [selected source campaign/ad group/etc]. It does not include unrelated platform data.`

### Summary Metric Gate

Before copying GA4 Summary-card behavior, document:

- source endpoint for each Summary metric
- date window for each metric
- fallback order
- whether fallbacks stay inside selected platform scope
- whether values are native, imported, or derived
- whether users/people metrics are deduplicated or row-summed

Required answer:

`Summary cards use [source hierarchy] for [window]. They do not combine incompatible source windows by maxing values across endpoints.`

### Financial Gate

Before copying GA4 Financial-card behavior, document:

- native platform revenue source, if any
- imported revenue sources
- spend sources
- conversion source for CPA
- date window for every financial input
- whether early-signal/pipeline values exist
- whether early-signal values are excluded from confirmed financials
- source modal provenance and source lifecycle behavior

Required answer:

`Spend comes from [source]. Revenue comes from [source set]. Profit, ROAS, ROI, and CPA derive from those same values. The UI names those sources and does not imply unavailable sources are connected.`

### Table Gate

Before copying GA4 table behavior, document:

- row grain
- row scope
- date range
- whether revenue appears
- whether imported financial values can be exactly matched to row keys
- whether row totals are expected to reconcile to top cards

Required answer:

`Rows represent [grain] inside [scope] for [window]. Imported revenue is [excluded / included only by exact row-level match]. Row totals [are / are not] expected to reconcile to top cards because [reason].`

### Refresh Gate

Before copying GA4 refresh behavior, document:

- on-demand fetch path
- persisted daily/history path
- scheduler path
- external source refresh path
- stable source ID behavior
- duplicate prevention
- failure behavior when campaign/source ownership cannot be verified

Required answer:

`Refresh updates the same scoped source/history records and fails closed when ownership cannot be proven. It does not create duplicate active sources or broaden scope.`

### Downstream Consumer Gate

Before copying GA4 downstream behavior, document:

- which Overview values feed KPIs
- which Overview values feed Benchmarks
- which Overview values feed Ad Comparison
- which Overview values feed Insights
- which Overview values feed Reports
- whether each consumer uses the same source/window or intentionally different source/window

Required answer:

`Downstream consumers read [authoritative value set]. Any intentional difference in window/source is documented and labeled.`

### Validation Gate

Before calling a new platform Overview production-ready, confirm:

- focused unit/static regression coverage passes
- TypeScript check passes
- local code trace proves ownership and source scoping
- at least one production-like or deployed validation proves real provider values when provider access is required
- source-family lifecycle is validated where financial sources exist
- existing-data inventory is complete if prior bugs may have persisted damaged data

## Future Platform Readiness Checklist

A future platform Overview is not production-ready until every item below is answered with platform-specific evidence:

- platform identity and scoping are proven
- Summary-card source hierarchy is documented and regression-covered
- financial source set is documented and regression-covered
- early-signal values are separated from confirmed financials
- source modals reconcile to card totals
- source add/edit/delete/refresh lifecycle is validated per source family
- scheduler and refresh paths fail closed on missing ownership
- row-level tables do not allocate financial values without exact row keys
- downstream consumers preserve the same executive-facing meaning
- report output uses the same labeled values as live UI
- validation commands and results are recorded
- deployed/provider caveats are separated from local code readiness

## Stable Response For Future Chats

Answer only when the request is limited to the current traced local GA4 Overview code scope:

`GA4 Overview is production-ready for the current local GA4 Overview code scope. The canonical reference is GA4/OVERVIEW_PRODUCTION_READINESS.md. External caveats remain for live GA4 API behavior, deployed scheduler execution, deployed provider/source refreshes, provider-backed source-family lifecycle validation, future scheduled/test email deliveries outside the recorded GA4 Overview Report packet, unvalidated report variants, and production database inventory outside the recorded Current Commit 3 target-campaign packet.`

If the user asks for deployed/provider, production database health outside the recorded Current Commit 3 target campaign, future scheduled email delivery outside the recorded GA4 Overview Report packet, unvalidated report variants, or another platform's readiness, do not reuse the local GA4 Overview certification as proof. State the relevant unproven external gate and use the Current Commit Queue or Future Platform Template.

This answer should stay the same only while all of these remain true:

- relevant Overview, financial-source, scheduler, report, KPI, Benchmark, and shared aggregate code has not changed in a way that affects Overview values
- validation evidence still passes for the traced paths
- source requirements have not changed
- deployed evidence has not contradicted this document
- the user is assessing the existing GA4 implementation, not Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source
- production data inventory has not proven damaged source records outside the already documented cleanup boundary

Do not answer future Overview readiness questions by reopening unrelated GA4 KPIs, Benchmarks, Ad Comparison, Reports, or Insights unless the Overview code path directly depends on a narrow value from those sections.
