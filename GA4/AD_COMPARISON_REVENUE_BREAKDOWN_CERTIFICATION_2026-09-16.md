# GA4 Ad Comparison → Revenue Breakdown Certification — 2026-09-16

**Status: CLEAN-CERTIFIED for the Revenue Breakdown value, display, and PDF paths described here.** This is a section certificate. It does not certify the whole Ad Comparison tab, All Campaigns, the chart or cards, GA4 Overview, source connector lifecycles, report email delivery, or any other platform.

## Exact scope and source of truth

- Validated runtime baseline: `dd9cd51ea755e896838c78be8cab020fc0249eba`, confirmed by `/api/health` after the Revenue Breakdown scheduled-PDF fix was pushed. The later certificate/test commit changes no runtime code.
- Read-only reconciliation target: Campaign2 `eee3e654-b736-4e8e-86ec-1050e4d905c0`, GA4 property `542352127`, saved campaign values `yesop_retargeti` and `yesop_email_nurture`, currency USD, reporting zone `Europe/Amsterdam`.
- GA4 Overview → Revenue & Financials was read-only. The Overview and Ad Comparison UI use the same campaign-scoped `revenue-sources` and `revenue-breakdown` responses for imported-source definitions and materialized records. Ad Comparison's native GA4 line uses its own documented comparison window and the exact selected campaign rows from GA4. No cross-window Total Revenue or native parity is claimed.
- All database inventory checks used `BEGIN TRANSACTION READ ONLY` and `ROLLBACK`. Browser report generation used the unsaved download flow. No source, report, snapshot, schedule, or email was created or changed.

## Amount, ID, currency, and window reconciliation

| Revenue Breakdown line | Exact source ID | Displayed USD amount | Saved exact subsection values |
| --- | --- | ---: | --- |
| GA4 Revenue (imported to date) | GA4 property `542352127`; saved two-value campaign filter | $15,841.20 | Native provider row sum; two rows |
| `csv_spend.csv` | `0d07b4cd-0ccf-46d0-b2c7-fa8edeedeadb` | $20.00 | Campaign2 $20.00 |
| Google Sheets revenue | `254dfde1-58da-49b3-847e-9ece7d5a14f0` | $54,200.00 | 3011 $54,200.00 |
| Salesforce (Opportunities) | `72ca7970-c6fd-4a67-af12-339897b2cb9f` | $251.00 | Acme Annual Subscription $100.00; Acme Expansion $51.00; SF Test A $100.00 |
| Shopify (linkedin-revenue.myshopify.com) | `d11a829b-d4a0-4c40-b724-3590ca1cb949` | $5.90 | brand_search_q1 $5.90 |
| HubSpot (Deals) | `38049121-4b3f-475a-a82c-0c766f8bf18d` | $3,200.00 | yesop_prospecting $3,200.00 |

The native Ad Comparison API queried GA4's `totalRevenue` metric for **2026-08-09 through 2026-09-15**. Its two selected rows summed to the provider total, **$15,841.20**. An older read-only Overview native financial API response used **2026-09-08 through 2026-09-15** and returned **$7,740.00**. That second boundary is superseded and must not be used as current evidence: the current Overview native financial contract starts at the saved GA4 initial-import date, which was **2026-08-09** for this campaign.

The five active imported source IDs, source API amounts, materialized source-breakdown amounts, and stored exact subsection totals matched. Their all-mapped-record query window was **1900-01-01 through 2026-09-16 UTC**, and their separate imported sum was **$57,676.90** in both `revenue-breakdown` and Overview's backward-compatible `revenue-to-date` API. The `revenue-breakdown` response's `totalRevenue` field sums imported sources only; the UI does not display it as native plus imported revenue. Every active source was available and configured in USD; no record/source currency mismatch was found. Revenue Breakdown displays the source lines separately and makes no combined Total Revenue claim.

HubSpot and Salesforce each store aggregate records and corresponding per-campaign detail records. Raw addition of both representations would double-count them. The storage read selects the aggregate representation when present, producing the $3,200.00 and $251.00 source amounts above. Exact external-key duplicates, cross-campaign records among these source IDs, and source/record currency mismatches were all **zero** in the read-only inventory.

## API, UI, PDF, refresh, and negative states

- The deployed authenticated APIs returned the exact native row sum, five active source IDs and amounts, source availability, USD currency, and stated date windows. The deployed table showed the same native and five imported parent amounts plus all seven saved subsection rows. Its source rows matched the screenshot.
- An unsaved deployed Revenue Breakdown-only browser PDF contained the native $15,841.20 and each of the five imported amounts and subsections. The UI uses `$` and the PDF writes `USD`; their numeric values match. No report was saved or sent.
- The scheduled/server PDF previously queried imported revenue only through the native GA4 completed-day boundary. The one-line fix now queries through the same current UTC day used by the imported source API and Overview source data. A behavioral test gave the source $15 on the current day versus $10 on the previous day and verified that the PDF selected $15. The corrected code is in the exact deployed SHA. There were no current-day imported records in this target campaign, so a real test email would not distinguish the old and corrected cutoff. No email-delivery claim is made.
- With an active Google Sheets source, the deployed page made two `revenue-breakdown` and two `revenue-sources` reads during the observed refresh interval. A browser-only response replay changed the exact CSV parent line **$20.00 → $0.00 → $20.00** on refetch. A failed refetch retained the last-good amount with an explicit stale warning, and a successful refetch cleared that warning. The replay changed no production data.
- Focused rendering tests passed for native zero, exact imported zero, unavailable source without configuration-total fallback, stale last-good disclosure, loading, and no additional sources. These tests use a nonempty verified native campaign row, matching the live Ad Comparison availability envelope. A genuinely empty native comparison returns the existing no-campaign-data state; this certificate does not claim imported lines remain visible in that distinct state.
- The acquisition pagination test passed for multi-page `rowCount` retrieval and fail-closed empty-page handling. The live target had two native rows, so no live multi-page observation is claimed.
- Unauthenticated Revenue Breakdown returned **401**. Using only the target owner's session, `revenue-breakdown` and `revenue-sources` for one other-owned campaign each returned **404**. The target property and saved two-value campaign filter were checked against its active GA4 connection; no cross-campaign source records were present for the five active source IDs.

## Validation and change boundary

- Focused packet: **7 files, 122 tests passed** (`ga4-ad-comparison-revenue-breakdown-render`, `ga4-ad-comparison-revenue-breakdown-pdf`, `report-email-regression`, `ga4-ui-regression`, `ga4-filter`, and the two Overview revenue source regressions). The final native-zero assertion also passed in a focused rerun.
- `npm run check`: passed. `npm run build`: passed. `git diff --check`: passed.
- Runtime change: one source-window line in `server/ga4-scheduled-report-pdf.ts`, committed in `dd9cd51e`. Its two PDF regression files are in that commit. The Revenue Breakdown renderer test and this certificate are committed and pushed separately, with no additional runtime-code change.
- A separate broader source-safety run had ten failures in Instagram/Google Ads structural assertions. Those paths are outside this certificate; no claim is made that that broader suite passes.
- No protected chart/card, Overview, Spend, Performance, Campaign Breakdown, KPI, Benchmark, HubSpot, Salesforce, Shopify, Google Sheets, CSV, contract, or certificate behavior was changed. Two Revenue Breakdown-only assertions were added to the shared `server/report-email-regression.test.ts` in the pushed PDF fix; no protected assertions were altered. The master ledger was not updated.
