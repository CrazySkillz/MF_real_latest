# GA4 Overview Production Readiness

## Purpose

This is the concise canonical index for the current GA4 Overview readiness decision and active gates.

- [Evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md): detailed inventories, traces, blockers, validation packets, and active-gate specifications
- [History ledger](./OVERVIEW_PRODUCTION_READINESS_HISTORY.md): chronological Current Commit 0-24 and UI-validation record
- [Overview behavior](./OVERVIEW.md): implemented product contract
- [Refresh contract](./REFRESH_AND_PROCESSING.md): completed-day, OAuth, and scheduler behavior
- [Machine record](./certifications/ga4-overview.json): fail-closed current status, dependency boundary, test evidence, and external gates

## Anti-Overclaim Rule

Only evidence from the same deployed commit, production-data state, and documented scope can support certification. Every status must remain **proven**, **unproven**, or **requires external validation**.

2026-09-05 revalidation: the authoritative machine record certifies deployed runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`. Review from `4be16c54` found no change to Overview values, formulas, cards, source selection, aggregates, or renderers; changed shared dependencies are limited to Notifications and post-refresh alert checks. Exact production health, the complete required non-Playwright regression inventory, TypeScript, production build, and manual scheduler recomputation passed. Historical authenticated Summary/financial/source parity carries only through unchanged paths. No current browser-automation, natural-timer, or global scheduler-health claim is made. Older narrative SHA references remain revision-specific history.

## Current Decision — Stable Cross-Session Answer

<!-- ga4-overview-current-status -->
<!-- ga4-overview-certification-status: PRODUCTION_READY -->

**Current section status: PRODUCTION_READY.** The certified runtime boundary is `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1` for the recorded campaign, live property `542352127`, USD source set, and persisted-data boundary. Authenticated read-only Summary, native/imported Revenue, Spend, source-inventory, Campaign Breakdown, and outcome-total evidence remains bounded to `4be16c54` and carries forward only because exact dependency review found those paths unchanged. Exact-current production health, required regressions, TypeScript, build, and manual eight-KPI/two-Benchmark recomputation passed. Reports remain separately bounded; no current browser-automation, natural timer, or global all-campaign scheduler-health claim is made.

The immediately prior certification at `4be16c54c550a45dbf3104313c820ea47b453604` and the earlier certification at `ee22f0e470826f1cb247115497c9a15229d0142d` remain historical evidence for their exact recorded boundaries only.

<!-- /ga4-overview-current-status -->

## Revision, Configuration, And Dependency Boundary

- Historical reviewed runtime implementation boundary, user-confirmed before later certification: `c6487555c55726427afed8342312b8393498303b`
- Current deployed scheduler configuration: `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, hour `22`, minute `0`, `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`, `AUTO_REFRESH_RUN_ON_STARTUP=false`
- Natural-run validation runtime/configuration: `85f5233ebfc298afc35f4c24e0930c1a66fbd07c`, temporarily scheduled for `20:35 UTC`, both startup refreshes disabled
- Previous certified runtime SHA: `ee22f0e470826f1cb247115497c9a15229d0142d`
- Previous certified production configuration: `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, hour `8`, minute `0`, `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`
- Previous certified campaign/property/currency: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / `542352127` / `USD`
- Current reviewed client boundary: `client/src/pages/ga4-metrics.tsx`, `client/src/components/AddRevenueWizardModal.tsx`, `client/src/components/HubSpotRevenueWizard.tsx`, `client/src/components/ShopifyRevenueWizard.tsx`, and `client/src/components/AddSpendWizardModal.tsx`
- Current reviewed shared/storage/API boundary: `shared/schema.ts`, `shared/ga4-financial-source.ts`, `server/routes-oauth.ts`, `server/storage.ts`, `server/analytics.ts`, `server/utils/revenue-record-total.ts`, `server/utils/hubspot-currency.ts`, `server/utils/shopify-provider.ts`, and `server/utils/shopify-revenue.ts`
- Current reviewed refresh/downstream boundary: `server/ga4-daily-scheduler.ts`, `server/auto-refresh-scheduler.ts`, `server/ga4-kpi-benchmark-jobs.ts`, and `server/utils/reporting-timezone.ts`
- Current canonical documentation boundary: this file, `OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`, `OVERVIEW_PRODUCTION_READINESS_HISTORY.md`, `OVERVIEW.md`, `FINANCIAL_SOURCES.md`, and `REFRESH_AND_PROCESSING.md`

Any later change to a listed runtime dependency, relevant production configuration, source set, campaign/property/currency boundary, or newly discovered Overview consumer invalidates this certification until its impact is reviewed and the affected evidence is rerun. A documentation-only clarification does not alter the certified runtime SHA.

## Intended Release Scope

The initial production target is:

- an initial import of the 30 completed GA4 reporting days preceding property setup
- subsequent completed reporting days appended by the existing daily pipeline without dropping the oldest imported day
- exact selected property and saved campaign-value scope
- scheduler-backed persisted daily Summary values
- independent Campaign Breakdown detail
- separately labeled campaign-to-date financial values

Future 60/90-day options are outside this release and require later implementation and validation.

## Certification Evidence

| Gate | Status | Required outcome |
| --- | --- | --- |
| Current certified boundary | **PRODUCTION_READY** | Certified runtime boundary `b8c7362121593502955d41e522d32396a963fdcc`; the only change from `12789c1e` is the established campaign-access guard on outcome totals. Authenticated Summary/financial/source parity, exact Campaign Breakdown reconciliation, guarded owner access, unauthenticated denial, and the read-only zero-finding production inventory passed. The scheduler fix passed its regression-first packet, TypeScript, production build, and natural target-persistence observation at `85f5233e`; the process-wide 17 obsolete-campaign failures remain excluded. |
| Previous exact-SHA carry-forward | **Historical pass** | Compared the earlier certified boundary with deployed `ee22f0e470826f1cb247115497c9a15229d0142d`. Relevant runtime diffs were confined to KPI same-date history, mutation-free notification validation, and KPI browser-PDF/test-send behavior; no Overview query, calculation, source, card, or report value changed. The protected boundary passed 44 files / 496 tests, and exact-SHA authenticated validation retained the documented campaign/property/filter/timezone/currency boundary with unchanged persistence. No Overview recompute or cleanup was performed. |
| Total Revenue currency and persisted-data gate | **Passed for the release-candidate boundary** | Native GA4 requested and returned USD; all five active imported source IDs were present, materialized, and USD. Current native GA4 was `$55,966.70`, imported revenue was `$16,799.99`, and Total Revenue was `$72,766.69`. Missing materialization remains distinct from an authoritative `$0`; source/record currency mismatch fails closed. |
| Current Commit 21 | **Deployed; bounded path closed** | Google Sheets is present in the GA4 Revenue and Spend choosers and new requests retain campaign access, GA4 context, mapping validation, and atomic exact-source persistence. The release-candidate production-data boundary does not generalize to an unconfigured future Google Sheets Revenue source. |
| Current Commit 20 | **Deployed; bounded path closed** | Explicit `importStartDate` remains authoritative; retained pre-field connections use the verified compatibility boundary rather than OAuth `connectedAt`. The existing supported 30-day Summary/UI/report packet remains the recorded parity evidence. |
| Current Commit 19 | **Bounded implementation closed** | Runtime `ba2e4329` deployed; the existing `GA4 single` / `ga4_mock` page showed `Last 30 completed days` and loaded normally. Unsupported-write rejection is automated/code-path proven at this source, not production-injected. |
| Current-release GA4 scheduled run | **Passed for the release-candidate campaign/property** | The natural timer fired at `2026-08-14T20:35:00.001Z` on runtime `85f5233e` and finished at `20:35:40.499Z`. The target retained 22 unique dates, all 22 rows carried scheduler-run timestamps, and no later app repair occurred. The Overview display boundary contained 11 rows through `2026-08-13` totaling 1,183 Sessions, 1,184 Users, 152 Conversions, 809 engaged sessions, and `$34,273.00` native revenue. The process-wide job still reported 17 excluded obsolete-campaign failures; no global scheduler-health claim is made. |
| OAuth durability | **Passed for the release-candidate connection** | The post-publish GA4 connection remained provider-usable after `2026-08-07`; authenticated reads and timer-fired persisted refreshes succeeded through the current scheduler evidence. This is observed durability for the recorded connection, not a guarantee for future credentials. |
| Deterministic/read-only pack | **Historical supporting pass** | The dated local packet passed 19 files / 190 tests, production health passed, and the then-visible four retained Spend sources totaling `$2,698.75` were explicitly approved to remain. The later authenticated release-candidate inventory reconciled the same four source identities at their current `$2,699.75` total. No cleanup was performed. |
| External revenue refresh | **Passed for the enabled sources** | The same three HubSpot source IDs refreshed in place at `$5,100`, `$7,000`, and `$4,000`; Shopify source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` remained `$99.99`; CSV remained `$600`. All were available in USD and no source was deleted or rewritten by validation. |

The exact implementation, no-mutation, validation, and completion requirements are preserved in the [evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md#active-gate-specifications-moved-from-the-main-index).

## Scheduler Boundary

The release-candidate boundary includes the `2026-08-14T20:35:00.001Z` natural timer-fired run described above. The scheduler was then restored to `22:00 UTC`, with GA4 daily and automatic-refresh startup runs disabled. The prior `2026-08-10` timer run and Google Sheets no-click observation remain historical exact-boundary evidence.

The scheduler health object is process-wide. Its `2026-08-10` scheduled run reported failure because 17 obsolete campaigns outside the certified boundary failed; the certified target independently proves successful timer execution through its exact persisted `updated_at`, property/date scope, stable row count, and zero-duplicate result. The separate external-source scheduler likewise reports whole-process failures rather than falsely reporting success; the certified HubSpot and Shopify sources retained their last-good USD values.

The Overview certification does not claim:

- startup-triggered refresh
- scheduled email delivery
- scheduled PDF/snapshot generation
- exhaustive Google Sheets polling cadence, failure-injection, and future-provider behavior; one deployed no-click automatic update was observed, but it is not generalized beyond that event

The scheduler-backed Summary begins with the initial 30-day import and accumulates later completed days. The scheduler's rolling repair/lookback query is an operational fetch boundary, not the Summary display boundary.

## Production-Data Boundary

- no cleanup, reconnect, migration, deletion, or rewrite is authorized by this documentation
- the three certified HubSpot source IDs now carry verified USD source and record provenance; unrelated historical rows remain outside this decision and must not be silently relabeled, deleted, or declared correct
- Commit 17 rollback behavior is regression-covered; unsafe production provider-failure injection is not required or claimed
- the eight retained inventory sources are not silently certified or cleaned

## Previous Certification Rule

The previous documented initial-30-day-import scope was clean-certified because, at the same deployed commit and data state:

1. Current Commits 20 and 21 plus the Total Revenue currency/total fix are committed and deployed; Summary API/UI/Overview-report parity and both Google Sheets chooser cards are validated.
2. One timer-fired GA4 daily scheduler run at that prior release proved that a zero-activity day did not drop the oldest imported day or change unchanged totals.
3. OAuth durability passes on 2026-08-07 or later.
4. The deterministic/read-only pack has no unresolved included value, source, lifecycle, failure, or downstream path.
5. Native GA4 to-date, persisted daily, and breakdown revenue use a proven campaign-currency contract without rewriting mixed historical rows unsafely.
6. Read-only revenue-source inventory and provider-authoritative HubSpot/Shopify packets establish the exact current persisted-data state; all canonical documents record the same decision.

**Historical decision only:** GA4 Overview was clean-certified and production-ready for the recorded `ee22f0e470826f1cb247115497c9a15229d0142d` campaign/property, supported 30-completed-day scope, enabled source set, and USD data state. That decision does not certify the current candidate.

## Source Authority

The three enabled HubSpot Revenue sources are **clean-certified inside this exact Overview boundary** under `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`; broader future HubSpot configurations are not inferred.

For the previous exact-SHA Overview boundary, the enabled Shopify Revenue source was **clean-certified inside that exact boundary** under `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`. A zero-match preview remains authoritative only for the provider order set and mapping fingerprint shown at preview time.

For the previous exact-SHA Overview boundary, the enabled Upload CSV Revenue source was **clean-certified inside that exact boundary** under `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`. An unconfigured future Google Sheets Revenue source and unlisted CSV variants remain outside that certification.
