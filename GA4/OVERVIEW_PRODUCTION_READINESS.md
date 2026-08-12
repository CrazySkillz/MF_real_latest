# GA4 Overview Production Readiness

## Purpose

This is the concise canonical index for the current GA4 Overview readiness decision and active gates.

- [Evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md): detailed inventories, traces, blockers, validation packets, and active-gate specifications
- [History ledger](./OVERVIEW_PRODUCTION_READINESS_HISTORY.md): chronological Current Commit 0-22 and UI-validation record
- [Overview behavior](./OVERVIEW.md): implemented product contract
- [Refresh contract](./REFRESH_AND_PROCESSING.md): completed-day, OAuth, and scheduler behavior

## Anti-Overclaim Rule

Only evidence from the same deployed commit, production-data state, and documented scope can support certification. Every status must remain **proven**, **unproven**, or **requires external validation**.

## Current Decision — Stable Cross-Session Answer

**CLEAN-CERTIFIED AND PRODUCTION-READY for the documented current-production boundary at deployed runtime commit `ee22f0e470826f1cb247115497c9a15229d0142d`: campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`, GA4 property `542352127`, the supported 30-completed-day Overview model, campaign currency USD, and the enabled source set recorded below. Google Ads, redundant campaigns with obsolete data, future source configurations, future 60/90-day options, scheduled report delivery, and future provider behavior are excluded.**

**Local candidate override (controlling for repository HEAD): UNVERIFIED at `c7e708e27d73416a96cf9a79d0f875f60b725d6b`. Shared Overview dependencies changed and the candidate is not deployed. The prior exact-SHA statement above is preserved evidence only and does not certify this candidate.**

## Revision, Configuration, And Dependency Boundary

- Certified runtime SHA: `ee22f0e470826f1cb247115497c9a15229d0142d`
- Certified production configuration: `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, hour `8`, minute `0`, `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`
- Certified campaign/property/currency: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / `542352127` / `USD`
- Certified client boundary: `client/src/pages/ga4-metrics.tsx`, `client/src/components/AddRevenueWizardModal.tsx`, `client/src/components/HubSpotRevenueWizard.tsx`, `client/src/components/ShopifyRevenueWizard.tsx`, and `client/src/components/AddSpendWizardModal.tsx`
- Certified shared/storage/API boundary: `shared/schema.ts`, `shared/ga4-financial-source.ts`, `server/routes-oauth.ts`, `server/storage.ts`, `server/analytics.ts`, `server/utils/revenue-record-total.ts`, `server/utils/hubspot-currency.ts`, `server/utils/shopify-provider.ts`, and `server/utils/shopify-revenue.ts`
- Certified refresh/downstream boundary: `server/ga4-daily-scheduler.ts`, `server/auto-refresh-scheduler.ts`, `server/ga4-kpi-benchmark-jobs.ts`, and `server/utils/reporting-timezone.ts`
- Canonical documentation boundary: this file, `OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`, `OVERVIEW_PRODUCTION_READINESS_HISTORY.md`, `OVERVIEW.md`, `FINANCIAL_SOURCES.md`, and `REFRESH_AND_PROCESSING.md`

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
| Exact-SHA carry-forward | **Passed** | Compared the prior certified boundary with deployed `ee22f0e470826f1cb247115497c9a15229d0142d`. Relevant runtime diffs are confined to KPI same-date history, mutation-free notification validation, and KPI browser-PDF/test-send behavior; no Overview query, calculation, source, card, or report value changed. The protected boundary passed 44 files / 496 tests, and the exact-SHA authenticated validation retained the documented campaign/property/filter/timezone/currency boundary with unchanged persistence. No Overview recompute or cleanup was performed. |

| Gate | Status | Required outcome |
| --- | --- | --- |
| Total Revenue currency and persisted-data gate | **Passed in the certified boundary** | Native GA4 requested and returned USD; all five active imported source IDs were present, materialized, and USD. Native GA4 was `$52,532.70`, imported revenue was `$16,799.99`, and Total Revenue was `$69,332.69`. Missing materialization remains distinct from an authoritative `$0`; source/record currency mismatch fails closed. |
| Current Commit 21 | **Deployed; bounded path closed** | Google Sheets is present in the GA4 Revenue and Spend choosers and new requests retain campaign access, GA4 context, mapping validation, and atomic exact-source persistence. The certified production-data boundary does not generalize to an unconfigured future Google Sheets Revenue source. |
| Current Commit 20 | **Deployed; bounded path closed** | Explicit `importStartDate` remains authoritative; retained pre-field connections use the verified compatibility boundary rather than OAuth `connectedAt`. The existing supported 30-day Summary/UI/report packet remains the recorded parity evidence. |
| Current Commit 19 | **Bounded implementation closed** | Runtime `ba2e4329` deployed; the existing `GA4 single` / `ga4_mock` page showed `Last 30 completed days` and loaded normally. Unsupported-write rejection is automated/code-path proven at this source, not production-injected. |
| Current-release GA4 scheduled run | **Passed for the certified campaign/property** | The normal timer fired at `2026-08-10T08:00:00.002Z`. The target property persisted through `2026-08-09`, updated at `08:00:21.147`, retained 21 unique stored dates, and had zero duplicate dates. The global job reported failures for 17 explicitly excluded obsolete campaigns; that global result is not generalized as healthy. |
| OAuth durability | **Passed for the certified connection** | The post-publish GA4 connection remained provider-usable after `2026-08-07`; authenticated read-only totals and the timer-fired persisted refresh both succeeded on `2026-08-10`. This is observed durability for the certified connection, not a guarantee for future credentials. |
| Deterministic/read-only pack | **Passed** | The local packet passed 19 files / 190 tests, production health passed, and the four visible retained Spend sources totaling $2,698.75 were explicitly approved to remain. Their presence is not damage. The post-publish Google Sheets reconnect and observed automatic mapped-value update remove the stale reconnect blocker. No cleanup was performed. |
| External revenue refresh | **Passed for the enabled sources** | The same three HubSpot source IDs refreshed in place at `$5,100`, `$7,000`, and `$4,000`; Shopify source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` remained `$99.99`; CSV remained `$600`. All were available in USD and no source was deleted or rewritten by validation. |

The exact implementation, no-mutation, validation, and completion requirements are preserved in the [evidence ledger](./OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md#active-gate-specifications-moved-from-the-main-index).

## Scheduler Boundary

The current-release timer-fired GA4 daily scheduler run is included and passed for the certified campaign/property. Google Sheets automatic propagation has one deployed no-click observation.

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

## Certification Rule

The documented initial-30-day-import scope is clean-certified because, at the same deployed commit and data state:

1. Current Commits 20 and 21 plus the Total Revenue currency/total fix are committed and deployed; Summary API/UI/Overview-report parity and both Google Sheets chooser cards are validated.
2. One current-release timer-fired GA4 daily scheduler run proves that a zero-activity day does not drop the oldest imported day or change unchanged totals.
3. OAuth durability passes on 2026-08-07 or later.
4. The deterministic/read-only pack has no unresolved included value, source, lifecycle, failure, or downstream path.
5. Native GA4 to-date, persisted daily, and breakdown revenue use a proven campaign-currency contract without rewriting mixed historical rows unsafely.
6. Read-only revenue-source inventory and provider-authoritative HubSpot/Shopify packets establish the exact current persisted-data state; all canonical documents record the same decision.

**GA4 Overview is clean-certified and production-ready for the recorded current campaign/property, supported 30-completed-day scope, deployed commit, enabled source set, and USD data state. Current-release target GA4 daily scheduled execution and the bounded Google Sheets automatic-propagation observation are included. Google Ads, redundant campaigns, future 60/90-day options, startup-triggered refresh, scheduled report delivery, future configurations, and future provider behavior are excluded.**

## Source Authority

The three enabled HubSpot Revenue sources are **clean-certified inside this exact Overview boundary** under `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`; broader future HubSpot configurations are not inferred.

The enabled Shopify Revenue source is **clean-certified inside this exact Overview boundary** under `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`. A zero-match preview remains authoritative only for the provider order set and mapping fingerprint shown at preview time.

The enabled Upload CSV Revenue source is **clean-certified inside this exact Overview boundary** under `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`. An unconfigured future Google Sheets Revenue source and unlisted CSV variants remain outside the certification.
