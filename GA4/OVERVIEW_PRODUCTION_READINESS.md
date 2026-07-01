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

`GA4 Overview is production-ready for the current local GA4 Overview code scope, with explicit external caveats for live GA4 API behavior, deployed scheduler execution, deployed provider/source refreshes, provider-backed source-family lifecycle validation, report/email delivery, and production database inventory outside the already documented cleanup boundary.`

Do not use a shorter production-ready answer unless the current request's complete value inventory, end-to-end trace matrix, fallback branches, negative cases, downstream propagation matrix, and validation evidence are all covered by this file.

External caveats remain and must be stated:

- live GA4 API processing latency and provider-side data freshness are not locally provable
- deployed scheduler execution must be verified in the deployed environment
- deployed provider/source refreshes must be verified with provider-backed data
- real source-family add/edit/delete/refresh validation remains an external validation gate
- production database health outside the already documented synthetic-GA4-revenue cleanup boundary remains unproven until the bounded read-only inventory in the Current Commit Queue is completed
- deployed report/email delivery evidence belongs to Reports readiness, not Overview readiness, unless the Overview values inside a generated report are wrong

These external caveats do not block the current local GA4 Overview code-scope certification. They do block any blanket claim that deployed provider behavior, production database health, scheduled email delivery, or a different platform's Overview is fully production-ready.

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
| Daily metrics path | `/api/campaigns/:id/ga4-daily` to persisted daily rows and optional scoped backfill. | Daily rows feed Summary fallback hierarchy without mirroring GA4 native revenue into imported revenue records. | Proven locally; deployed scheduler timing is external. |
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
| Current Commit 3: Production source-damage inventory | Outstanding external validation gate, not a confirmed code bug. | Production/staging inventory for orphan, duplicate, inactive, or platform-context-drifted revenue/spend records outside the already documented synthetic-GA4-revenue cleanup boundary. | Read-only inventory first; document exact affected IDs before proposing any cleanup migration. | No for local code-scope certification; yes for production database-health certification. |

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

What remains unproven externally:

- Visible UI screenshot parity was not separately recorded in this file; the authenticated evidence came from the browser console using the deployed app session.
- Scheduled/server report payload evidence still needs to be captured through the report validation path before making any blanket scheduled/server report-output claim.
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

| Source family | Overview paths affected | Add/import | Edit/update | Refresh/reprocess | Delete/deactivate | Current status |
| --- | --- | --- | --- | --- | --- | --- |
| Google Sheets revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required | Required if refresh/sync is exposed | Required | Unproven until deployed before/after evidence is recorded. |
| CSV revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required if CSV replacement/edit is exposed | Required if re-import/reprocess is exposed | Required | Unproven until deployed before/after evidence is recorded. |
| Manual/legacy revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required if manual add is exposed | Required | Prove not applicable or validate if a refresh/reprocess route exists | Required | Unproven until deployed before/after evidence is recorded. |
| Shopify revenue | `Total Revenue`, revenue sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required if mapping/config edit is exposed | Required | Required | Unproven until deployed before/after evidence is recorded. |
| HubSpot revenue or Pipeline Proxy | Confirmed revenue paths only if HubSpot writes revenue sources; Pipeline Proxy remains early-signal only | Required for the exposed source/proxy action | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded and revenue/proxy paths are separated. |
| Salesforce revenue or Pipeline Proxy | Confirmed revenue paths only if Salesforce writes revenue sources; Pipeline Proxy remains early-signal only | Required for the exposed source/proxy action | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded and revenue/proxy paths are separated. |
| Google Sheets spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required | Required if refresh/sync is exposed | Required | Unproven until deployed before/after evidence is recorded. |
| CSV spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required | Required if CSV replacement/edit is exposed | Required if re-import/reprocess is exposed | Required | Unproven until deployed before/after evidence is recorded. |
| Manual/legacy spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required if manual add is exposed | Required | Prove not applicable or validate if a refresh/reprocess route exists | Required | Unproven until deployed before/after evidence is recorded. |
| Google Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |
| Meta Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |
| LinkedIn Ads spend | `Total Spend`, spend sources modal, Profit, ROAS, ROI, CPA, report payload values after the change | Required/connect | Required for mapping/config changes | Required | Required/disconnect if exposed | Unproven until deployed before/after evidence is recorded. |

Execution order for the next validation step:

1. Capture an authenticated Current Commit 2 baseline snapshot for the deployed campaign before touching source data.
2. Use the baseline to identify the actual source family currently present in the campaign; do not infer it from totals alone.
3. Pick the lowest-risk disposable test source for the first lifecycle action, preferably a source family with controlled test data and a rollback path.
4. Validate one lifecycle action at a time: baseline snapshot, one UI/provider action, after snapshot with `-CompareToPath`, source-modal visual check, and downstream Overview financial-card check.
5. Record the evidence in this file before moving to the next lifecycle action or source family.
6. If any action changes an unrelated source ID, duplicates an active source, loses provenance, or changes totals unexpectedly, stop Current Commit 2 and add the exact runtime fix as the next Current Commit.

What remains unproven externally:

- No real provider-family lifecycle action has been validated in this local pass.
- Shopify, HubSpot, Salesforce, Google Sheets, CSV, legacy Manual revenue, LinkedIn Ads, Meta Ads, Google Ads, Google Sheets spend, CSV spend, and legacy Manual spend remain provider/user validation work until each relevant family has before/after evidence.
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

Status: production-ready locally for current Overview refresh code scope; deployed scheduler/provider checks remain external validation gates.

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

- scheduler behavior is traced at code level, but deployed-run evidence remains environment validation
- source-family refresh identity should still be certified for each real provider

Not locally verifiable:

- deployed scheduler execution
- provider API availability
- real GA4 delayed processing

Future-platform template rule:

- schedulers must fail closed when campaign/source ownership cannot be verified
- refreshes must update stable source IDs and must not append duplicate source definitions or records

### 10. Downstream Consumers

Status: production-ready locally for current Overview-originated values, with deployed report/email caveats owned by Reports readiness.

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
- deployed scheduler execution works
- every provider source-family lifecycle is production-ready
- production data has no duplicate or orphan source records outside previously inventoried rows
- deployed report/email delivery evidence, which remains Reports readiness scope unless the Overview values inside a report are wrong

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

`GA4 Overview is production-ready for the current local GA4 Overview code scope. The canonical reference is GA4/OVERVIEW_PRODUCTION_READINESS.md. External caveats remain for live GA4 API behavior, deployed scheduler execution, deployed provider/source refreshes, provider-backed source-family lifecycle validation, report/email delivery, and production database inventory outside the already documented cleanup boundary.`

If the user asks for deployed/provider, production database health, scheduled email delivery, or another platform's readiness, do not reuse the local GA4 Overview certification as proof. State the relevant unproven external gate and use the Current Commit Queue or Future Platform Template.

This answer should stay the same only while all of these remain true:

- relevant Overview, financial-source, scheduler, report, KPI, Benchmark, and shared aggregate code has not changed in a way that affects Overview values
- validation evidence still passes for the traced paths
- source requirements have not changed
- deployed evidence has not contradicted this document
- the user is assessing the existing GA4 implementation, not Meta, Google Ads, LinkedIn, Google Sheets, Custom Integration, or another source
- production data inventory has not proven damaged source records outside the already documented cleanup boundary

Do not answer future Overview readiness questions by reopening unrelated GA4 KPIs, Benchmarks, Ad Comparison, Reports, or Insights unless the Overview code path directly depends on a narrow value from those sections.
