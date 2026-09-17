# GA4 Insights → Data Summary certification — 2026-09-17

## Decision and exact boundary

**CLEAN CERTIFIED / PRODUCTION READY for the on-screen GA4 Insights Data Summary card only**, on deployed Render commit `0bce5024b1b5ab7dd6cbbbf1f7f91e81b94b24cf`. All gates within this boundary passed; **0 remaining gates**. The live value check used campaign `eee3e654-b736-4e8e-86ec-1050e4d905c0`, its selected OAuth GA4 property `542352127`, and its two saved campaign filters. This is a bounded certification of this campaign/property/configuration and the current code behavior, not a claim about arbitrary future provider data.

This card now contains Sessions and Conversions only. Top Channel, the source/medium channel table, and channel-availability warnings are disabled in this app version. Their attribution completeness and source/medium matching are therefore **excluded**, not certified. The adjacent Total/High/Medium findings cards were checked for parity with the visible `What to investigate next` findings, but their rule engine and the rest of Insights are outside this certificate. Overview, Trends, KPIs, Benchmarks, other certified sections, Reports, PDFs, report delivery, and the master readiness ledger were not recertified or changed.

## Proven value path

| Stage | Data Summary evidence |
|---|---|
| Selected source | The campaign and client have the same owner. The active selected GA4 connection is property `542352127`, with two saved campaign filters and `Europe/Amsterdam` reporting time. The deployed page showed that property and the saved filter selection. |
| Producer and storage | The unchanged GA4 daily producer persists selected-campaign/property/date facts in `ga4_daily_metrics`. The provider-backed coverage check on the exact deployed revision reconciled all 13 stored rows against GA4 under the saved filters and verified 26 dates with no matching campaign data. It did not manufacture zero values for unverified gaps. |
| API | The page-consumed `GET /api/campaigns/:id/ga4-daily?days=60&propertyId=...&readOnly=1` returned `overviewStartDate: 2026-08-09`, `dataThroughDate: 2026-09-16`, and `overviewTotals` of 496 Sessions and 84 Conversions. A separate read-only sum of the 13 selected campaign/property daily records over those exact dates returned the same values. The completed-day cutoff excludes September 17 intraday data. |
| UI | The deployed Data Summary rendered 496 Sessions, 84 Conversions, the August 9–September 16 Amsterdam import-history label, and 16.9% conversion rate (`84 / 496`). Its history totals come from `overviewTotals`, including pre-creation imported rows; the independent Trends creation-date display filter does not narrow this card. |
| Adjacent counts | The exact deployed findings array contained 3 findings: 0 high and 0 medium. The three tracker cards showed 3/0/0, all three finding IDs appeared below, and none were hidden. Tracker values are derived from that findings array; the Data Summary traffic cards do not feed those counts. |

The Data Summary history variables are rendered in this card and its conversion-rate text. They do not write data or feed KPI, Benchmark, financial, or recommendation calculations. Other Insights recommendations retain their existing separate rolling-window and channel-analysis inputs. Browser and server PDFs use report-owned payload paths and are outside this certificate; the focused local test confirms this app version does not render channel values in their Data Summary blocks.

## Gate results

| Gate | Result |
|---|---|
| Exact revision and selected source | PASS: deployed `/api/health` returned `0bce5024b1b5ab7dd6cbbbf1f7f91e81b94b24cf`; owner browser, selected property, saved filters, timezone, API, and stored rows agreed. The similarly named `ga4_mock` campaign was excluded from this value decision. |
| Provider/date reconciliation and gaps | PASS: provider coverage verified 13 stored days plus 26 no-match days across the 39-day imported-history window; row totals matched 496/84. |
| On-screen values and disabled channels | PASS: owner browser/API/database parity was 496/84 and 16.9%; no Top Channel, channel row, or channel warning was rendered. |
| Valid zero, stale, and unavailable | PASS: browser-only intercepted response fixtures on the deployed bundle showed 0/0 with `Valid zero sessions`, labeled stale last-good totals, and an initial failure message with both numeric cards withheld. These fixtures did not alter production records or simulate a real provider outage. |
| Ownership and refresh | PASS: current owner access worked and current unauthenticated daily access returned 401. The daily response confirmed read-only mode and no provider refresh attempt, reported `refreshIsStale: false`, and showed last completed refresh at `2026-09-17T10:05:51.322Z`. The same server route and GA4 storage/producer files are byte-identical to the certified Trends revision `757cfc5926d59dbae4addd0a4d4a0531f675f3f7`, whose authenticated non-owner check returned 404. No exact-commit natural scheduler firing is claimed. |
| Adjacent findings and downstream boundary | PASS: 3/0/0 tracker values matched the generated findings and three displayed cards. The displayed Data Summary traffic totals have no mutation or cross-section calculation path. |
| Local gates | PASS: six focused/adjacent test files, 33 tests; `npm run check`; `npm run build`. The exact-campaign script `scripts/ga4-insights-data-summary-live-readonly.ts` passed against the deployed commit with app requests limited to GET. |

## Exclusions and stable answer

The certification excludes channel attribution and source/medium rows because this version does not display them in Data Summary. It excludes the `ga4_mock` campaign's unrelated 2,497/322 values, other campaigns/properties, the rest of Insights, protected sections, Reports/PDF behavior, future provider failures, and a natural scheduler run on this exact commit. These exclusions are not open Data Summary display gates.

Stable answer: **the on-screen GA4 Insights Data Summary card is clean-certified for deployed commit `0bce5024b1b5ab7dd6cbbbf1f7f91e81b94b24cf` and the recorded campaign/property configuration, with 0 remaining gates in its stated boundary.** Recheck this certificate if its UI/API/dependency code, selected source configuration, or contradictory production evidence changes. No master readiness file was updated, and no whole-Insights or Reports certification is asserted.
