# GA4 Overview Revenue & Financials - Performance Certification - 2026-09-14

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY for the exact GA4 Overview `Revenue & Financials -> Performance` boundary documented below at deployed application revision `0c49cc6a217457c8ab33f21b7dcc348127cee5ab`.**

Required steps remaining within this exact boundary: **0**.

This certificate covers only the four Performance cards:

- Profit
- ROAS
- ROI
- CPA

It does not certify the parent Revenue & Financials section, the Summary subsection, Campaign Breakdown, Landing Pages, Conversion Events, Reports, Campaign DeepDive, or the whole GA4 Overview tab. It independently validates only the exact GA4 financial-conversions input consumed by CPA; it does not certify Summary Conversions or the Summary subsection.

## Certified formulas

| Card | Formula | Display rule |
| --- | --- | --- |
| Profit | `Revenue - Spend` | Campaign currency, two decimals; negative values remain negative. |
| ROAS | `Revenue / Spend` | Two decimals plus `x`; unavailable when Spend is zero or unavailable. |
| ROI | `(Revenue - Spend) / Spend` | Percentage, one decimal when needed; unavailable when Spend is zero or unavailable. |
| CPA | `Spend / GA4 financial conversions` | Campaign currency, two decimals; unavailable when Spend or financial conversions is zero or unavailable. |

The finite-number guards return safe values internally at invalid denominator boundaries, while the UI and both Overview PDF render paths display an em dash instead of presenting a fabricated ratio. No certified visible path emits `NaN` or `Infinity`.

## Certified input boundary

### Revenue

Revenue is the already-certified combined GA4 Overview Revenue value: native GA4 campaign-to-date revenue plus active GA4-context imported revenue selected by the certified aggregate-versus-attributed record rule.

Controlling certificate: `GA4/OVERVIEW_REVENUE_SECTION_PRODUCTION_READINESS.md`.

This Performance certification consumes that value without modifying, reopening, or broadening any Revenue source-family certificate. HubSpot and Salesforce Pipeline Proxy values remain excluded from confirmed Revenue and therefore from Profit, ROAS, ROI, and CPA.

### Spend

Spend is the already-certified GA4 Overview Total Spend value from the active GA4-context Spend source total/breakdown path.

Controlling certificates:

- `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_SPEND_POST_DEPLOYMENT_RECERTIFICATION_2026-09-14.md`

This Performance certification consumes that value without modifying, reopening, or broadening the Google Sheets Spend or CSV Spend certificates.

### CPA conversions

CPA uses the conversions paired with the selected native GA4 financial totals, not the Summary Conversions card and not a cross-platform or truthy fallback total.

The traced path is:

`selected campaign/property -> GET /api/campaigns/:id/ga4-to-date -> campaign access check -> saved GA4 connection/property -> exact campaign filter/date window/campaign currency -> getTotalsWithRevenue -> totals.conversions -> ga4FinancialTotalsSource.conversions -> CPA`

The aggregate provider request has no row-level allocation or pagination merge. Its conversions remain paired with the same selected financial response used for native Revenue. If the selected candidate is unavailable, stale, non-finite, or does not match the required current window/currency boundary, CPA and its downstream consumer state fail closed instead of substituting Summary conversions.

This is an independent certification of this CPA input only. Summary Conversions remains outside this certificate.

## Exact deployed reconciliation

The authenticated, read-only production reconciliation used:

- application revision: `0c49cc6a217457c8ab33f21b7dcc348127cee5ab`
- campaign hash: `fc734ddaf728`
- client hash: `613d89abb175`
- owner hash: `1900b95d7361`
- GA4 property: `542352127`
- campaign currency: `USD`
- business-data transaction: read only and rolled back
- authentication: temporary Clerk session revoked after the run

Exact reconciled values:

| Input/output | Exact value |
| --- | ---: |
| Revenue | `$105,694.70` |
| Spend | `$2,759.75` |
| GA4 financial conversions used by CPA | `379` |
| Profit | `$102,934.95` |
| ROAS | `38.30x` |
| ROI | `3729.9%` |
| CPA | `$7.28` |

Independent formula reconciliation:

- `105,694.70 - 2,759.75 = 102,934.95`
- `105,694.70 / 2,759.75 = 38.298650...`, rendered as `38.30x`
- `(105,694.70 - 2,759.75) / 2,759.75 = 37.298650...`, rendered as `3729.9%`
- `2,759.75 / 379 = 7.281662...`, rendered as `$7.28`

The Summary Conversions card showed `267`, independently confirming that CPA used the financial-conversions value `379` rather than silently substituting Summary conversions.

The deployed run reconciled the campaign-scoped source APIs, rendered four Performance cards, access denial for unauthenticated and cross-owner requests, and successful generation/parsing of the Overview browser PDF. Exact derived-value formatting in the browser and scheduled PDF paths is additionally guarded by current automated tests; this certificate does not promote the whole Reports area.

## Availability, refresh, and lifecycle behavior

The Performance cards have no independent persistence or mutation path. They are derived during render from the current Revenue, Spend, and paired financial-conversions query results. Consequently:

- a successful Revenue change updates Profit, ROAS, and ROI;
- a successful Spend change updates all four cards;
- a successful paired GA4 financial-conversions change updates CPA;
- page reload and normal query refresh recompute the values from the same inputs;
- source add, edit, delete, and automatic refresh behavior remains owned by the existing Revenue and Spend certificates;
- a failed refresh may retain visible last-good inputs only with stale/unverified state; it cannot silently replace CPA conversions with Summary conversions;
- unavailable required inputs remain unavailable, and zero denominators render as an em dash;
- no cached campaign-wide or other-client value is accepted as a substitute for a missing campaign-scoped input.

No live source add, edit, delete, cleanup, repair, or destructive mutation was performed for this certificate. Existing Revenue and Spend lifecycle evidence is carried forward only because revision `0c49cc6a` did not modify their producer, persistence, or source-management behavior.

## Ownership and contract boundary

The production audit and current route trace confirm:

- the GA4 financial request is campaign-access guarded;
- the saved GA4 property belongs to the selected campaign;
- active Revenue and Spend records remain campaign scoped;
- cross-owner requests are denied;
- the audited active source inventories contained no cross-campaign records;
- no public API response field was renamed or removed by the Performance correction;
- the UI, browser PDF, scheduled PDF, KPI, Benchmark, Insights, and DeepDive consumers retain their existing contracts.

## Downstream propagation

| Consumer | Certified Performance boundary |
| --- | --- |
| Overview cards | Exact Profit, ROAS, ROI, and CPA formulas, formatting, availability, and denominator behavior. |
| Overview browser PDF | Uses the same Performance values; zero/invalid denominators render unavailable. This is not whole-Report certification. |
| Scheduled Overview PDF | Uses the paired financial inputs and fail-closed denominator formatting. This is not scheduler or delivery certification. |
| KPI and Benchmark | Revenue/ROAS/ROI use certified Revenue and Spend; CPA eligibility and value use paired financial conversions rather than Summary conversions. This does not certify the whole KPI or Benchmark sections. |
| Insights | Shared financial values and PDF rendering retain the same zero-denominator behavior. This does not broaden the Insights certificate. |
| Campaign DeepDive Performance Summary | CPA scoring uses paired financial conversions; Revenue/Spend-derived metrics use the shared financial aggregate. This does not certify the whole DeepDive page. |
| Scheduled DeepDive report | CPA scoring and recommended actions use paired financial conversions and their independent availability state. This does not certify report delivery or inbox receipt. |

## Root causes corrected at `0c49cc6a`

1. CPA downstream consumers could use Summary/unified conversions when the paired financial conversion value was zero or absent because truthy `||` fallback semantics treated zero as missing.
2. DeepDive and scheduled report CPA scoring consumed traffic conversions instead of the conversions paired with the financial response.
3. Browser and scheduled PDF paths could format ratio values without the same zero-denominator availability rules as the cards.
4. CPA consumer eligibility shared traffic state instead of tracking the independent financial-conversions response state.

The correction uses the exact paired financial input and explicit availability state. It does not change the Revenue or Spend calculations, persistence, source lifecycle, or API response contracts.

## Current automated evidence

Performance-focused packet:

- test files: **14/14 passed**
- tests: **107/107 passed**

Consolidated stale-expectation packet:

- test files: **4/4 passed**
- tests: **39/39 passed**

Boundary guards:

- current-version boundary plus notification visibility: **48/48 passed**
- TypeScript (`npm run check`): **passed**
- production build (`npm run build`): **passed**
- full current-version execution: **1,970 total; 1,929 passed; 41 explicitly deferred; 0 blocking failures**

The 41 visible deferred failures belong to explicitly excluded future-platform or unconfigured-platform boundaries. They are not used as evidence for this certificate. Google Ads is not configured and remains excluded.

## Files in the certified application correction

Application revision `0c49cc6a217457c8ab33f21b7dcc348127cee5ab` changed exactly:

- `client/src/pages/campaign-detail.tsx`
- `client/src/pages/campaign-performance.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `server/campaign-section-ui-parity-scheduled-pdf.test.ts`
- `server/ga4-kpi-ui-browser-state-regression.test.ts`
- `server/ga4-overview-performance-readiness.test.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/performance-summary-scheduled-pdf.test.ts`
- `server/report-scheduler.ts`
- `shared/ga4-kpi-consumer-state.ts`

The final evidence cleanup accompanying this certificate changes tests and current-version boundary metadata only. It does not change application runtime behavior.

## Explicit exclusions

- the parent Revenue & Financials section
- Summary, including any general certification of Summary Conversions
- Campaign Breakdown, Landing Pages, and Conversion Events
- whole Overview readiness
- whole KPI, Benchmark, Insights, Campaign DeepDive, or Reports readiness
- report scheduling, provider acceptance, email delivery, or inbox receipt
- Google Ads, which is not configured
- source configurations and production data outside the exact recorded campaign/property/currency boundary
- future provider, configuration, source, data, or code changes
- global scheduler health and multi-worker coordination
- a globally clean historical database

## Final decision

The GA4 Overview Revenue & Financials Performance subsection is clean-certified for the exact four-card, exact-input, exact-consumer, and exact deployed boundary documented above. Revenue and Spend retain their own controlling certificates and behavior. CPA's `379` financial-conversions input is certified independently without certifying Summary or its displayed `267` conversions.

This decision does not certify the parent Revenue & Financials section or the whole GA4 Overview tab.
