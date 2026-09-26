# GA4 Insights — Executive Financials certification — 2026-09-17

## Decision and boundary

**HISTORICAL EXACT-RUNTIME EVIDENCE for the Executive Financials cards and their “Sources used” provenance at Render revision `f4fe2f3e3b47a3b350dd14c8a8d336bc8ff946ca`, within the campaign, property, sources, and value states below.** The later V1 financial-boundary correction invalidates this record as current production-readiness evidence. Current native financial values start at the saved GA4 initial-import date; imported Revenue and Spend include every mapped record. The remaining formula, currency, and unavailable-state observations are retained as historical evidence only.

This decision covers only Spend, Revenue, Profit, ROAS, ROI, and “Sources used” in `GA4 Insights → Executive Financials`. It does not certify Trends, Data Summary, What to investigate next, any tracker or report/PDF, the whole Insights tab, the parent Overview Revenue & Financials section, or a different campaign or runtime.

GA4 Overview Revenue, Spend, and Performance were used as **read-only input boundaries**. Their separate, historical bounded certificates remain unchanged:

- `GA4/OVERVIEW_REVENUE_SECTION_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md` and `GA4/OVERVIEW_SPEND_POST_DEPLOYMENT_RECERTIFICATION_2026-09-14.md`
- `GA4/OVERVIEW_PERFORMANCE_CERTIFICATION_2026-09-14.md`

Those documents do not themselves certify the exact Insights runtime above. The shared page file was edited only inside its Executive Financials block. No Overview calculation, card, route, storage function, source contract, test, certificate, or behavior was edited for this work.

## Exact deployed scope and value trace

The authenticated owner campaign was `eee3e654-b736-4e8e-86ec-1050e4d905c0`, with selected active GA4 property `542352127`, reporting timezone `Europe/Amsterdam`, and campaign currency USD. The owner campaign API matched the campaign/client inventory; an authenticated request for a campaign owned by another account returned `404`. The selected property and saved campaign filters matched the Insights scope labels. Each contributing breakdown source ID matched a source definition whose currency was USD.

The page reads its existing, campaign-scoped inputs through `/api/campaigns/:id/ga4-to-date?insightsScope=1&readOnly=1`, `/revenue-to-date`, `/spend-to-date?platformContext=ga4`, their source lists, and their source breakdowns. The native response reported `validationReadOnly: true`, the selected property, USD, and the Amsterdam reporting timezone. The Spend and imported Revenue routes call their existing source-backed range totals in `server/storage.ts`. In `client/src/pages/ga4-metrics.tsx`, Overview and Executive Financials use the same outer financial values; Executive Financials does not recalculate Spend, ROAS, or ROI. `client/src/lib/ga4-insights-executive-financials.ts` resolves provenance and requires an available, finite Overview Spend plus at least one Overview Spend display source before that value is shown. Missing contributor names are labeled unavailable. The helper does not return an alternate Spend amount.

| Input or card | Exact deployed evidence | Calculation or UI result |
| --- | ---: | ---: |
| GA4 native Revenue | $9,022.63 | Selected property, campaign filter, USD response |
| Imported Revenue | $57,676.90 | Five GA4-context source IDs |
| Revenue card | $66,699.53 | $9,022.63 + $57,676.90 |
| Spend card | $338.00 | Two GA4-context source IDs; breakdown and to-date totals equal |
| Profit card | $66,361.53 | $66,699.53 − $338.00 |
| ROAS card | 197.34x | $66,699.53 ÷ $338.00, two decimals |
| ROI card | 19633.6% | ($66,699.53 − $338.00) ÷ $338.00 × 100, one decimal |

The exact deployed source breakdowns summed to their respective to-date amounts:

| “Sources used” kind | Contributing source | USD amount |
| --- | --- | ---: |
| Spend | `csv_spend_updated.csv` | $38.00 |
| Spend | Google Sheets | $300.00 |
| Imported Revenue | `csv_spend.csv` | $20.00 |
| Imported Revenue | Google Sheets revenue | $54,200.00 |
| Imported Revenue | Salesforce (Opportunities) | $251.00 |
| Imported Revenue | Shopify (`linkedin-revenue.myshopify.com`) | $5.90 |
| Imported Revenue | HubSpot (Deals) | $3,200.00 |

The “Sources used” footer displayed both Spend names, “GA4 native revenue,” and all five imported Revenue names. The source-ID and currency checks prevent counting a similarly named source from another campaign or currency as evidence for these amounts.

## Date windows and no-overclaiming display

The historical deployed native GA4 response covered `2026-09-08` through the last completed Amsterdam day, `2026-09-16`. All mapped Spend records and the spend breakdown covered `1900-01-01` through `2026-09-16`. The existing imported Revenue endpoint and breakdown covered `1900-01-01` through current UTC date `2026-09-17`. The earlier `e2a8e361` read-only database inventory found zero imported records after `2026-09-16`; that record-level check was not repeated at `f4fe2f3e`. Exact-deployment source breakdowns summed to the displayed source totals. This record does not certify the current boundary: native GA4 values now start at the saved initial-import date and imported values include every mapped record.

The Executive Financials footer displays the three API cutoff dates when all three are present and any differ, and states that Profit, ROAS, and ROI combine those source windows. A controlled $100 current-day imported Revenue response demonstrated this disclosure on the previous `e2a8e361` revision; it was not repeated at `f4fe2f3e`. The certified deployed normal state had all three dates and showed the disclosure. These numeric ratios are formulas over the displayed source totals; **they are not represented as same-period performance when the cutoffs differ**. A missing cutoff date does not trigger this three-date disclosure.

## Failure, zero, stale, and refresh evidence

- With both Spend source-list and breakdown GETs forced to `503` while source-backed Spend to-date remained successful, the shared Overview Spend expression had no verified source list and could yield a false zero. Executive Financials rendered Spend, Profit, ROAS, and ROI as `Unavailable`, while Revenue remained available. “Sources used” showed `Source details unavailable` instead of claiming Spend was not connected. This is the availability limit of importing Overview's calculated value without editing protected Overview code.
- With both Revenue source-list and breakdown GETs forced to `503` while imported Revenue to-date remained successful, the Revenue card remained equal to Overview. “Sources used” showed `Imported source details unavailable` alongside GA4 native revenue, rather than silently omitting imported contributors.
- Controlled valid-zero Spend rendered `$0.00`, preserved source provenance, and withheld ROAS and ROI with an em dash because their denominator was zero. Controlled valid-zero Revenue rendered `$0.00` and a negative Profit based on the still-available Spend.
- With Spend to-date and breakdown both unavailable, Spend and Profit rendered `Unavailable`; no false `$0.00` was presented as a measured amount.
- After successful values had been cached, an injected Spend-breakdown refresh failure showed the last-good-value warning and kept Spend equal to Overview's cached `$338.00`. A later successful read cleared the warning. The source-label regression also checked that a cached breakdown value is attributed to its breakdown IDs, not to newer unmatched to-date IDs. This checks the card's refresh and stale display path; it does not trigger or certify an upstream provider scheduler run.

The earlier false `$0.00` Spend and incomplete provenance were render/fallback defects. This fix did not write or clean up persisted financial rows. All application requests made by the validator were GETs; it observed zero attempted application writes. The production database inventory ran in a read-only transaction and was rolled back. The temporary authenticated Clerk sessions were revoked.

## Gates and remaining limits

| Gate | Result |
| --- | --- |
| Focused Executive Financials, Insights, source, and bounded Overview regressions | **PASS:** 13 files, 100 tests |
| TypeScript | **PASS:** `npm run check` |
| Production build | **PASS:** `npm run build`, 3,472 client modules and bundled server |
| Exact deployment | **PASS:** `/api/health` reported `f4fe2f3e3b47a3b350dd14c8a8d336bc8ff946ca` before and after authenticated checks |
| Exact deployed API/UI and negative-state parity | **PASS:** Overview-to-Insights card equality, source sums, provenance, foreign-campaign denial, property, currency, dates, controlled Spend and Revenue detail failures, valid zero Spend and Revenue, unavailable Spend totals, stale recovery, and mixed-cutoff disclosure; zero attempted application writes |

Documentation-only commit `51a89829c034306eabed0f0abdc4ce48f03f5dca` changed only this evidence file after the application revision above. Render reported that exact commit, and a separate authenticated read-only browser check confirmed Overview-to-Insights Revenue and Spend equality, the five expected card values, complete displayed provenance, and zero attempted application writes. The controlled failure, zero, stale, and source-row inventory checks were run at application revision `f4fe2f3e`, not repeated at the documentation-only revision.

Unverified outside this certificate: real Google Sheets, CSV, CRM, Shopify, or GA4 provider refresh/reconnect and scheduler lifecycles on this revision; campaigns/properties/currencies/source configurations outside the exact inventory; future source data or changed provider/configuration behavior; whole-tab Insights status. The existing whole-Insights certificate is a historical record for `4be16c54c550a45dbf3104313c820ea47b453604` and was not edited or renewed. Its repository checker failed for the `f4fe2f3e` whole-tab dependency hashes; that failure is **not** counted as a pass or silently treated as an Executive Financials certificate. The separate Overview certificates likewise retain only their documented boundaries and revisions.

`APP_PRODUCTION_READINESS.md` was not updated as part of this Executive Financials certification work. This evidence document is the only new certification document for this work.
