# GA4 Overview Production Readiness

## Purpose

This is the concise canonical index for the current GA4 Overview readiness decision and active gates.

- [Evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md): detailed inventories, traces, blockers, validation packets, and active-gate specifications
- [History ledger](./OVERVIEW_PRODUCTION_READINESS_HISTORY.md): chronological Current Commit 0-22 and UI-validation record
- [Overview behavior](./OVERVIEW.md): implemented product contract
- [Refresh contract](./REFRESH_AND_PROCESSING.md): completed-day, OAuth, and scheduler behavior
- [Machine record](./certifications/ga4-overview.json): fail-closed current status, dependency boundary, test evidence, and external gates

## Anti-Overclaim Rule

Only evidence from the same deployed commit, production-data state, and documented scope can support certification. Every status must remain **proven**, **unproven**, or **requires external validation**.

## Current Decision — Stable Cross-Session Answer

<!-- ga4-overview-current-status -->
<!-- ga4-overview-certification-status: UNVERIFIED -->

**Current production-certification status: UNVERIFIED.** Exact current runtime `82fc3a7887d14e370e29a27ae4349333bacc2f58` is user-confirmed deployed. Authenticated UI/API/source parity and the read-only production-data inventory passed for the recorded campaign, live property `542352127`, USD source set, and persisted records. Campaign Breakdown reconciled all three visible rows exactly; the deployed subtitle now distinguishes its 30-day GA4 metrics from source-to-date imported revenue. The sole remaining external gate is one natural `22:00 UTC` target-persistence observation. No new exact-SHA certification exists until that gate passes and is recorded.

The prior clean certification at `ee22f0e470826f1cb247115497c9a15229d0142d` remains historical evidence for its exact campaign/property/configuration/data boundary only.

<!-- /ga4-overview-current-status -->

## Revision, Configuration, And Dependency Boundary

- Current reviewed and user-confirmed deployed runtime: `82fc3a7887d14e370e29a27ae4349333bacc2f58`
- Current deployed scheduler configuration: `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, hour `22`, minute `0`, `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`
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
| Current evidence candidate | **Deployed and authenticated parity passed; one external validation remains** | Runtime `82fc3a7887d14e370e29a27ae4349333bacc2f58` is user-confirmed deployed. The current focused Overview packet passed 28 files / 288 tests and the affected shared-dependency packet passed 10 files / 93 tests; the copy-only Campaign Breakdown guard failed before the runtime edit and passed afterward. Current authenticated Summary/financial/source parity, exact Campaign Breakdown reconciliation, and the read-only zero-finding production inventory passed. Only the next natural `22:00 UTC` target-persistence observation remains pending. |
| Previous exact-SHA carry-forward | **Historical pass** | Compared the earlier certified boundary with deployed `ee22f0e470826f1cb247115497c9a15229d0142d`. Relevant runtime diffs were confined to KPI same-date history, mutation-free notification validation, and KPI browser-PDF/test-send behavior; no Overview query, calculation, source, card, or report value changed. The protected boundary passed 44 files / 496 tests, and exact-SHA authenticated validation retained the documented campaign/property/filter/timezone/currency boundary with unchanged persistence. No Overview recompute or cleanup was performed. |
| Total Revenue currency and persisted-data gate | **Passed in the certified boundary** | Native GA4 requested and returned USD; all five active imported source IDs were present, materialized, and USD. Native GA4 was `$52,532.70`, imported revenue was `$16,799.99`, and Total Revenue was `$69,332.69`. Missing materialization remains distinct from an authoritative `$0`; source/record currency mismatch fails closed. |
| Current Commit 21 | **Deployed; bounded path closed** | Google Sheets is present in the GA4 Revenue and Spend choosers and new requests retain campaign access, GA4 context, mapping validation, and atomic exact-source persistence. The certified production-data boundary does not generalize to an unconfigured future Google Sheets Revenue source. |
| Current Commit 20 | **Deployed; bounded path closed** | Explicit `importStartDate` remains authoritative; retained pre-field connections use the verified compatibility boundary rather than OAuth `connectedAt`. The existing supported 30-day Summary/UI/report packet remains the recorded parity evidence. |
| Current Commit 19 | **Bounded implementation closed** | Runtime `ba2e4329` deployed; the existing `GA4 single` / `ga4_mock` page showed `Last 30 completed days` and loaded normally. Unsupported-write rejection is automated/code-path proven at this source, not production-injected. |
| Current-release GA4 scheduled run | **Passed for the certified campaign/property** | The normal timer fired at `2026-08-10T08:00:00.002Z`. The target property persisted through `2026-08-09`, updated at `08:00:21.147`, retained 21 unique stored dates, and had zero duplicate dates. The global job reported failures for 17 explicitly excluded obsolete campaigns; that global result is not generalized as healthy. |
| OAuth durability | **Passed for the certified connection** | The post-publish GA4 connection remained provider-usable after `2026-08-07`; authenticated read-only totals and the timer-fired persisted refresh both succeeded on `2026-08-10`. This is observed durability for the certified connection, not a guarantee for future credentials. |
| Deterministic/read-only pack | **Passed** | The local packet passed 19 files / 190 tests, production health passed, and the four visible retained Spend sources totaling $2,698.75 were explicitly approved to remain. Their presence is not damage. The post-publish Google Sheets reconnect and observed automatic mapped-value update remove the stale reconnect blocker. No cleanup was performed. |
| External revenue refresh | **Passed for the enabled sources** | The same three HubSpot source IDs refreshed in place at `$5,100`, `$7,000`, and `$4,000`; Shopify source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` remained `$99.99`; CSV remained `$600`. All were available in USD and no source was deleted or rewritten by validation. |

The exact implementation, no-mutation, validation, and completion requirements are preserved in the [evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md#active-gate-specifications-moved-from-the-main-index).

## Previous Certified Scheduler Boundary

The prior exact-SHA certification included one timer-fired GA4 daily scheduler run for the recorded campaign/property. Google Sheets automatic propagation had one deployed no-click observation. These are historical exact-boundary evidence and do not close the current candidate's natural-run gate.

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

For the previous exact-SHA Overview boundary, the three enabled HubSpot Revenue sources were **clean-certified inside that exact boundary** under `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`; broader future HubSpot configurations are not inferred.

For the previous exact-SHA Overview boundary, the enabled Shopify Revenue source was **clean-certified inside that exact boundary** under `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`. A zero-match preview remains authoritative only for the provider order set and mapping fingerprint shown at preview time.

For the previous exact-SHA Overview boundary, the enabled Upload CSV Revenue source was **clean-certified inside that exact boundary** under `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`. An unconfigured future Google Sheets Revenue source and unlisted CSV variants remain outside that certification.
