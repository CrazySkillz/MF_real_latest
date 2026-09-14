# GA4 Overview - Campaign Breakdown Certification - 2026-09-14

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY only for the GA4 Overview `Campaign Breakdown` subsection documented below, at deployed application revision `87f951206a60358fd25e3145ba10ea097151800f`.**

Required steps remaining within this exact deployed runtime boundary: **0**.

This certificate does not certify Summary, Landing Pages, Conversion Events, Reports as a section, the parent Revenue & Financials section, or the whole Overview tab. Google Ads remains excluded.

## Certified visible contract

The certified table has exactly these columns, in this order:

1. Campaign
2. Sessions
3. Users
4. Conversions
5. Conv. Rate
6. Revenue

Only normalized exact matches to the saved GA4 campaign scope are rendered. Empty, unrelated, duplicate-normalized, other-property, other-campaign, other-client, and other-owner values are rejected or excluded rather than merged into the table.

Traffic metrics use the saved initial-import start date through the latest completed day in the campaign reporting timezone. Native row revenue uses campaign start through that same completed day. Conversion rate is `Conversions / Sessions * 100`, with a safe zero-session result and no `NaN` or `Infinity` display.

Users are directional GA4 row values. They are not forced to equal the Summary Users card. Sessions can also be non-additive across separately filtered GA4 report grains; this certificate does not invent a row allocation or force summed campaign rows to equal a differently grained Summary query.

## Revenue attribution contract

Each displayed row contains:

`native GA4 revenue for the exact saved campaign + imported revenue mapped through an exact saved campaign mapping`

The certified behavior is:

- native row revenue reconciles to native GA4 Revenue for the campaign-start window;
- imported revenue is added only when a source has an exact saved mapping from its source campaign value to a displayed GA4 campaign value;
- source/display-name coincidence is not a mapping;
- unmatched imported revenue remains outside Campaign Breakdown rows;
- imported revenue is never proportionally allocated;
- displayed row revenue reconciles to Total Revenue only when every imported-revenue amount is exactly mapped;
- relevant duplicate or ambiguous mappings, currency mismatches, invalid values, unavailable source materialization, and materialization-total mismatches fail the subsection closed;
- unrelated or unmatched imported sources do not suppress otherwise valid rows;
- zero and negative exact adjustments are handled without converting them into missing values.

## Root cause and correction

The confirmed code-level cause of the unavailable-table symptom was a blanket frontend availability condition over every active imported revenue source. An unavailable source could suppress the entire Campaign Breakdown even when that source had no exact mapping to any displayed GA4 campaign. Historical logs do not retain enough state to prove which individual source produced the exact screenshot-time response, so this certificate does not claim that unobservable detail.

The smallest safe correction scopes availability and materialization checks to exact saved campaign mappings used by the table. The same resolver is used by the UI and scheduled-PDF consumer. Related Campaign Breakdown defects corrected in the same bounded change were:

- removal of direct same-name imported-revenue fallback;
- exact UTM campaign boundary anchoring;
- explicit property and nonempty saved-campaign guards before provider access;
- removal of the 15-row truncation in browser and scheduled Overview PDF Campaign Breakdown tables.

No public API response field was renamed or removed. No Revenue, Spend, Performance, HubSpot, Salesforce, Shopify, Google Sheets, or CSV producer/persistence/source-management behavior was changed.

## End-to-end path certified

`saved GA4 property and campaign scope -> completed-day/import boundary resolution -> GA4 provider queries and fixed fallback order -> exact campaign filtering -> native row-revenue merge -> exact imported-revenue mapping -> campaign-scoped API -> rendered table -> browser Overview PDF -> scheduled Overview PDF builder`

The current route and focused negative tests cover:

- explicit property and saved campaign scope requirements;
- fixed traffic and native-revenue windows;
- provider query shapes, currency verification, pagination completion, query limits, fallback selection, and empty/error behavior;
- normalized exact merge keys and duplicate rejection;
- native row/provider/card revenue reconciliation;
- exact imported-revenue mapping, unmatched values, ambiguity, stale/unavailable materialization, and currency failures;
- conversion-rate zero handling;
- campaign/property/client/owner isolation;
- API, UI, browser PDF, and scheduled PDF parity;
- reload, focus/visibility refetch, and ten-minute automatic refresh behavior;
- all Campaign Breakdown rows being retained in both PDF consumers.

## Exact deployed reconciliation

The authenticated production audit used:

- deployed application revision: `87f951206a60358fd25e3145ba10ea097151800f`
- campaign hash: `fc734ddaf728`
- client hash: `613d89abb175`
- owner hash: `1900b95d7361`
- GA4 property: `542352127`
- campaign currency: `USD`
- campaign reporting timezone: `Europe/Amsterdam`
- traffic window: `2026-07-02` through `2026-09-14`
- native-revenue window: `2026-06-24` through `2026-09-14`
- database transaction: read only and rolled back
- authentication: temporary Clerk session revoked after the run

Exact rendered rows:

| Campaign | Sessions | Users | Conversions | Conv. Rate | Displayed Revenue |
| --- | ---: | ---: | ---: | ---: | ---: |
| `yesop_paid_social` | 899 | 900 | 83 | 9.2% | $32,989.60 |
| `yesop_retargeting` | 674 | 677 | 115 | 17.1% | $42,807.70 |
| `yesop_email_nurture` | 596 | 596 | 82 | 13.8% | $23,897.40 |

Revenue reconciliation:

| Value | Amount |
| --- | ---: |
| Native GA4 Revenue | $82,994.70 |
| Imported revenue total | $22,700.00 |
| Imported revenue exactly mapped to displayed rows | $16,700.00 |
| Unmatched imported revenue retained outside rows | $6,000.00 |
| Displayed row revenue | $99,694.70 |
| Total Revenue | $105,694.70 |
| Total Revenue minus displayed rows | $6,000.00 |

The `$6,000.00` difference is the exact unmatched imported amount. Because not all imported revenue is mapped, the displayed rows correctly do not reconcile to Total Revenue.

## Sessions and conversions discrepancy diagnosis

The earlier deployed comparison showed Campaign Breakdown at `2,169 sessions / 280 conversions` and persisted Summary at `2,068 / 267`. Read-only persistence evidence later showed that the scheduled daily refresh had replaced the stale rows, bringing the persisted completed-day values through `2026-09-13` to `2,171 / 280`.

Current provider diagnostics independently returned `280` conversions for all supported campaign-name attribution dimensions. The remaining session differences are observed GA4 query-grain non-additivity:

- exact per-campaign aggregate row sum: `2,169`
- combined selected-UTM aggregate total: `2,164`
- combined selected-UTM date-row sum: `2,171`
- exact per-campaign date-row sum: `2,172`

The table preserves each campaign's exact provider aggregate. It does not proportionally adjust, duplicate, or discard sessions merely to match a differently grained total. Summary remains outside this certificate.

## Consumer parity and refresh evidence

The exact deployed audit proved:

- API response values matched the expected saved scope and source reconciliation;
- rendered UI values and column order matched the API-derived values;
- browser-generated Overview PDF contained every row and matching values;
- authenticated GET of an existing GA4 Overview snapshot invoked the deployed scheduled-PDF builder and contained every Campaign Breakdown row and matching Sessions, Users, Conversions, Conv. Rate, and Revenue values;
- page reload returned a fresh successful Campaign Breakdown response;
- focus/visibility refetch returned a fresh successful response;
- the automatic ten-minute interval returned a fresh successful response;
- unauthenticated and cross-owner requests were denied.

The scheduled-PDF proof certifies only Campaign Breakdown value rendering in that consumer. It does not certify report configuration, scheduling, dispatch, provider acceptance, email delivery, inbox receipt, snapshot immutability, or Reports as a section.

## Automated validation

Focused Campaign Breakdown and protected-source regression packet:

- test files: **12/12 passed**
- tests: **225/225 passed**

Current-version suite:

- total: **1,982**
- passed: **1,941**
- explicitly deferred future-platform failures: **41**
- blocking failures: **0**

Additional gates:

- TypeScript (`npm run check`): **passed**
- production build (`npm run build`): **passed**
- staged/worktree whitespace validation (`git diff --check`): **passed**
- exact-SHA authenticated deployed audit: **passed**
- deployed API/UI/browser-PDF/scheduled-PDF value parity: **passed**

The 41 deferred current-version failures belong to explicitly excluded future or unconfigured platform boundaries, including Google Ads. They are not evidence for this certificate and are not represented as globally passing tests.

## Files in deployed application revision `87f9512`

Runtime and shared logic:

- `client/src/pages/ga4-metrics.tsx`
- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `shared/ga4-campaign-breakdown.ts`

Focused evidence and protected-source regression coverage:

- `scripts/ga4-overview-campaign-breakdown-audit.ts`
- `scripts/ga4-overview-campaign-discrepancy-readonly.ts`
- `server/ga4-overview-campaign-breakdown-regression.test.ts`
- `server/ga4-filter.test.ts`
- `server/ga4-kpi-real-path-parity-regression.test.ts`
- `server/ga4-ui-regression.test.ts`
- `server/google-sheets-revenue-validation.test.ts`
- `server/hubspot-mapping-downstream-matrix.test.ts`
- `server/hubspot-revenue-ga4-overview-regression.test.ts`
- `server/shopify-downstream-content-regression.test.ts`

The post-deployment scheduled-PDF assertion added to the read-only audit script is evidence-only and does not alter deployed runtime behavior.

## Explicit exclusions

- Summary
- Landing Pages
- Conversion Events
- Reports as a section
- report scheduling, dispatch, provider acceptance, email delivery, and inbox receipt
- the parent Revenue & Financials section
- the whole GA4 Overview tab
- Revenue, Spend, and Performance recertification
- HubSpot, Salesforce, Shopify, Google Sheets, and CSV source-family recertification
- Google Ads
- values outside the exact audited campaign/property/currency boundary
- future provider, configuration, data, mapping, or code changes
- a globally clean historical database

## Final decision

The GA4 Overview Campaign Breakdown subsection is clean-certified for the exact saved-scope, time-window, mapping, reconciliation, availability, isolation, UI, browser-PDF, and scheduled-PDF value boundary documented above at deployed runtime revision `87f951206a60358fd25e3145ba10ea097151800f`.

No broader GA4 Overview or Reports certification is made.
