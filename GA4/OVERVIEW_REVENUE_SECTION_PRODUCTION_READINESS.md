# GA4 Overview Revenue Section Production Readiness

## Status

**Current status: CLEAN-CERTIFIED for the exact combined GA4 Overview Revenue boundary documented below at deployed runtime `8a4b463b99b8e489168098279242005112c91fee`.**

Required steps remaining within this documented boundary: **0**.

This decision certifies the combined Revenue subsection only. It does not certify Spend, Performance, Summary, Campaign Breakdown, Landing Pages, Conversion Events, Reports, or the whole GA4 Overview tab.

## Certified Boundary

Included:

- GA4 Overview `Total Revenue`, its displayed source count, and the `Revenue Sources` modal
- native GA4 campaign-to-date revenue plus active GA4-context imported revenue
- the authoritative aggregate-versus-attributed record-grain selection
- HubSpot and Salesforce Pipeline Proxy separation from confirmed Total Revenue
- active-source filtering, stable source identity, campaign ownership, campaign currency, and cross-campaign isolation
- database, API, rendered-card, and source-modal reconciliation for the exact production campaign/property below
- the separately certified source-family boundaries listed below

Excluded:

- source configurations, organisations, stores, spreadsheets, files, currencies, fields, windows, and provider behavior outside each controlling source certificate
- proof that all five imported source families coexist in one production campaign; the exact audited campaign contained four HubSpot sources and one CSV source
- other users' production data, a globally clean historical database, and global scheduler health
- horizontally scaled or multi-worker coordination beyond the boundaries in the source certificates
- future code, provider, configuration, and production-data changes
- Spend, Performance, Summary, Campaign Breakdown, Landing Pages, Conversion Events, Reports, and the whole Overview tab

## Source Certificates Preserved

| Source family | Controlling certificate | Deployed application boundary | Evidence revision |
| --- | --- | --- | --- |
| HubSpot Revenue and Pipeline Proxy | `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md` | `490c8ae685821389d1f433a5943f856478f52e5c` | `de16a8e564139846aed03f59078751c2cfcfc69e` |
| Shopify Revenue | `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md` | `ea516f3a0d2c7636215811a0df1d95a460fd04c5` | `bc46d0a44a6efddcdd4bce4a5650925599b410a0` |
| Salesforce Revenue and Pipeline Proxy | `GA4/OVERVIEW_REVENUE_SALESFORCE_PRODUCTION_READINESS.md` | `d4f1ec0ea24caea3d7d565da0be773d219f68b32` | `6fa4bff2fbb89cfb058af63c244dcf6fa4e949ad` |
| Google Sheets Revenue | `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` | `f8061d135a85fbe2c4c11433fffb3f80dedceae8` | `f4a648a84153d61aa5cad7503c68c04e0c40d264` |
| CSV Revenue | `GA4/OVERVIEW_REVENUE_CSV_PRODUCTION_READINESS.md` | `b2fd97a9af8b51a5cea88a6f88b2b3e0c8a4b6cc` | `4476e807e74b303c40004638e074ad34e7d06fc2` |

These certificates remain authoritative only for their own documented boundaries. This combined decision does not broaden any source certificate.

## Current-Code Reconciliation

The exact current deployed application revision was confirmed by `/api/health`:

- HTTP status: `200`
- commit: `8a4b463b99b8e489168098279242005112c91fee`

The current revision passed a focused 26-file Revenue packet covering the shared total, materialization, currency, source identity, lifecycle/recompute, transaction, damaged-data, Pipeline Proxy, and source-family paths:

- test files: **26/26 passed**
- tests: **226/226 passed**
- TypeScript: **passed**

One stale HubSpot UI assertion still expected the pre-Google-Sheets/CSV `shopify`-specific subtitle guard. The rendered implementation had already moved to the equivalent `hasSingleSourceBreakdown` guard. Only that test assertion was aligned; no application behavior, formula, response contract, or certified source path changed.

## Exact Deployed Revenue Audit

The authenticated Revenue-only audit used:

- deployed commit: `8a4b463b99b8e489168098279242005112c91fee`
- campaign hash: `fc734ddaf728`
- client hash: `613d89abb175`
- owner hash: `1900b95d7361`
- GA4 property: `542352127`
- campaign currency: `USD`
- database transaction: `BEGIN TRANSACTION READ ONLY`, followed by rollback
- application access: temporary Clerk session revoked after the run

Exact reconciled values:

| Value | Amount |
| --- | ---: |
| Native GA4 revenue | `$80,280.60` |
| Active imported revenue | `$22,700.00` |
| Rendered Total Revenue | `$102,980.60` |
| Rendered Pipeline Proxy | `$0.00` |

The rendered Total Revenue card showed `Sources (6)`: one native GA4 source plus five active imported sources. The imported sources were four HubSpot sources totaling `$22,100.00` and one CSV source totaling `$600.00`.

The audit proved for this exact production boundary:

- revenue breakdown sum equals the imported-revenue API total
- source-by-source database totals equal the API breakdown
- database and API active-source counts match
- rendered Total Revenue equals native plus imported revenue
- the rendered source count matches the modal entries
- every Revenue Sources modal amount matches its API source amount
- the HubSpot Pipeline Proxy endpoint and rendered card both return `$0.00`
- Pipeline Proxy is not added to Total Revenue
- zero orphan revenue records
- zero duplicate external revenue keys among active sources
- zero cross-campaign records for the active audited sources
- source and record currencies match the campaign currency
- unauthenticated access is denied
- a cross-owner campaign request is denied

The audit was read-only with respect to campaign, source, record, and revenue data. It did not run refresh, save, edit, delete, cleanup, or repair operations.

## Explicit Non-Claim

The broader complete-Overview audit was also attempted at the same deployed revision and stopped before Revenue on an unrelated Campaign Breakdown/Summary sessions mismatch (`2,056` versus `1,949`). That result keeps Campaign Breakdown and the whole Overview tab unverified. It does not contradict the independently completed Revenue-only database/API/UI/modal reconciliation above.

## Final Decision

GA4 Overview Revenue is clean-certified for the exact documented source certificates and the exact combined deployed Revenue boundary above. Required steps remaining for this boundary: **0**.

Operational monitoring remains required for future executions and does not convert this bounded certificate into a claim about every future configuration or global application state.
