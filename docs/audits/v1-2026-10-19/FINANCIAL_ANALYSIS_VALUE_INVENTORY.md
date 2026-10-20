# Current Financial Analysis value inventory

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Index](../../V1_RELEASE_READINESS.md), [aggregate/diagnostic trace](KPI_AND_DIAGNOSTIC_VALUE_TRACE.md), [13 boundary cases](financial-boundary-reproductions.json), [runner](financial-boundary-reproductions.cjs).

This inventories the active render at `client/src/pages/financial-analysis.tsx:806–1186`, its calculations and pacing edits. The old tab renderer after1188 is behind a literal-false condition; its charts, health score and platform tables are not active visible values. Shared navigation remains in the whole-app inventory. This is a current-page semantic inventory, not a certificate for upstream sources, all configurations or the whole application.

## Source and window contracts

The page reads campaign identity at85 and `/api/campaigns/:id/outcome-totals` at189. The latter builds `performanceSummary`, `financialInputs` and `budgetPacing` in `server/routes-oauth.ts:15738–15867`. `performance_summary_aggregate_v3.currentValueWindow` is import-start through the latest completed campaign-timezone day; it is separate from the user-selected pacing period. `server/utils/performance-summary-aggregate.ts:274–428` supplies metric availability/source identities and formulas. Exact source-provider/file-to-record paths remain in their linked source records.

Current page484–508 prefers aggregate metrics. Missing/error aggregate state withholds values; its legacy/demo fallback remains a separate branch. Failed refetch with cached data produces an explicit stale warning825–828. Currency comes from the campaign308 and `Intl.NumberFormat`414–419. All currency values below use that display contract; upstream currency verification and edit propagation must independently pass (V1-087).

Budget Spend is a separately dated contract: route15843–15865 requires valid period dates, available aggregate Spend, canonical spend records and an exact active-source set; it caps the end at the financial data-through date and calls `storage.getSpendTotalForRange(...,"ga4")`. Read/currency failure withholds budget Spend. `resolveFinancialBudgetPeriodSpend:84–109` checks version, campaign, period start/end, currency, availability and finite nonnegative value. These checks do not certify every retained non-GA4 source combination.

## Active visible values and derived text

Page line references below are to `client/src/pages/financial-analysis.tsx`. **R** means traced current code, with the exact executed helper positives noted below; none implies complete provider-to-browser acceptance.

| Value | Exact calculation / rendering | Zero, missing, scope and propagation boundary |
|---|---|---|
| Total Spend | aggregate Spend →510/577 →841–844 | Available zero renders currency0; unavailable renders reason. Campaign financial source/window contract. R. |
| Total Revenue | aggregate Revenue →511/578 →847–850 | Available zero preserved; unavailable reason. Native plus imported revenue has separate source/grain gates. R. |
| Profit | available Revenue minus available Spend745–748 →853–856 | Requires both; zero and loss remain numeric. R. |
| ROAS | aggregate Revenue/Spend;519/580 →859–862 | Positive Spend denominator;2decimal ratio suffixx; unavailable reason otherwise. R. |
| ROI | aggregate (Revenue−Spend)/Spend×100;517/579 →865–868 | Negative values retained; positive denominator; percent formatting. R. |
| CPA | aggregate financial Spend/financial conversions;514 →871–874 | Separate financial-conversion availability. Whole upstream source/zero-denominator matrix remains open. R. |
| Conversion Efficiency CVR | aggregate web conversions/sessions, otherwise eligible paid conversions/clicks →704/886–897 | Withheld without compatible cumulative window or available metric. Configured unavailable GA4 must not substitute paid outcomes. R + helper control. |
| CVR source labels | main sources declaring conversions plus sessions/clicks679–685 →892 | Metadata labels, not an independent proof of matching value source. Mixed-source rendered reconciliation remains required. R. |
| Campaign Budget | saved positive campaign budget400–401 →922–923 | Missing/nonpositive budget is Unavailable. Same currency display. R. |
| Remaining Budget | campaign budget minus budget-period Spend530 →926–928 | Requires budget and available period Spend; may be negative. R. |
| Budget utilization text | period Spend/budget×100529 →935 | Can exceed100%; no artificial cap on numeric text. R. |
| Spent in budget period | matched `budgetPacing.spend`528 →936 | Distinct from cumulative Total Spend. Measured zero accepted. R + identity/zero controls. |
| Budget utilization bar | clamp utilization to0..100 at938 | Visual cap only; text retains full ratio. R. |
| Daily Burn Rate | period Spend/inclusive elapsed calendar days749 →968–973 | Requires available period Spend and elapsed days>0. R + DST/boundary calendar controls. |
| Target Daily Spend | budget/inclusive total calendar days752 →977–984 | Requires budget, valid range, period Spend and elapsed>0. R. |
| Total period days label | `pacingCalendar.totalDays` →980 | Inclusive calendar ordinals, not elapsed milliseconds across local DST. R + helper controls. |
| Pacing Status | burn/target×100753–754 →988–1003 | >115 ahead, <85 behind, inclusive85..115 on-track; unavailable gates distinct. Policy thresholds, not causal forecasts. R. |
| Over/Under variance | pacing percentage distance from100 →1001–1002 | Percent text describes current burn relative to target. R. |
| Budget exceeded amount | abs(negative remaining budget)750 →1006–1008 | Requires available period Spend/budget. R. |
| Exhaustion days | ceil(remaining budget/burn)958 →1091–1093 | Only available period Spend, positive burn/remaining and not over-budget. Extrapolation at current average rate; no future spend commitment assumed. R. |
| Exhaustion relation to period end | data-through calendar day + ceil(days)960, compare1094 | Exact-end equality is incorrectly labelled before; V1-094. Dates after the period are still an extrapolation, not actual delivery evidence. |
| Budget/period start/period end edit values | controlled state/input fields1030–1058; PATCH121–125 | Empty save/delete becomes null. Cancel restores saved fields535–538. Missing/invalid date ranges withhold pacing. Error text136–137; pending disables save/delete. Live reload/concurrent edit acceptance remains open. R. |
| CPC | aggregate cost-source Spend / cost-source clicks →697/1114–1117 | Cumulative helper375–386 uses clicks only from spend-capable sources; verified fixture excludes an extra clicks-only source. UI additionally checks capability metadata. R + positive control. |
| CPM | same cost-source Spend / impressions×100 →698/1114–1117 | Same spend-source subset and positive denominator. R + positive control. |
| CTR | aggregate paid clicks/impressions×100 →699/1114–1117 | UI helper requires identical click/impression source-ID sets; compatible cumulative window required. R. |
| Paid efficiency source labels | deduplicated contributing labels701–703 →1121–1123 | Need per-source provenance and currency/window acceptance. R. |
| Revenue source name and amount | exact financial input rows629–638 →1146–1151 | Prefers detailed input IDs/labels/values; fallback aggregate financial-source rows; finite nonnegative filter keeps0, omits negative (refund policy remains V1-036/071). Empty means no detailed inputs. R. |
| Spend source name and amount | detailed financial input rows639–646 →1157–1162 | Finite nonnegative amounts, exact ID/name retained; empty has explicit message. Whole source-modal/card reconciliation remains required. R. |
| Return action title/body/tone | current available ROAS/ROI757–774 →1175–1179 | Below-break-even warning, otherwise Positive financial return; equality0 profit is mislabelled positive in UI and both server renderers (V1-094). Unavailable is separate. |
| Budget action title/body/tone | `buildFinancialBudgetAction`149–211 called777–789 | Ordered unavailable, over-budget, invalid range, not-started, behind, ahead, on-track. Requires period Spend, not cumulative Spend. R. |
| Allocation action title/body/tone | `buildFinancialAllocationAction`213–271 called791–798 | Requires cumulative scope; detailed spend sum must reconcile within0.01 before naming largest amount/share. Otherwise requires multiple compatible source returns. R + mismatch/match controls. |
| Stale warning and unavailable reasons |825–828, format helpers571–576, card881 | Last successful cached values explicitly labelled after refetch failure; server freshness/source failure still requires full propagation validation. R. |

## V1-094 — P2: equality is misdescribed in executive text

With Revenue100 and Spend100, the actual aggregate returns ROAS1 and ROI0. The current page action at757–768 and both server report expressions at `server/report-scheduler.ts:2005–2009,2661–2665` all emit **Positive financial return**. The numeric values are correct; the title overstates a break-even outcome. Fixtures also execute Revenue99 and101 as negative/positive controls. This is not a newly generated Financial PDF comparison: exact current report expressions were evaluated independently of full rendering.

The active projection expression at page1094 returns **before** when projected exhaustion equals the budget end date. Its binary comparison lacks an equality description. The exact expression fixture uses the same date on both sides. The legacy hidden renderer has a duplicate expression; initial AST selection found both, so the fixture was explicitly narrowed to the active render before the rollback-reference marker. No runtime code changed.

Acceptance: distinguish loss, break-even and positive return, and before/on/after period end, consistently in current UI and server artifacts. Preserve numerical formulas and existing architecture. This is a bounded text defect; it does not supersede the higher-severity source, authorization or data-integrity gates.

## Executed evidence and remaining work

The13 cases cover current cost-source subset, unavailable GA4 conversion fallback, spring/autumn DST, future and ended periods, invalid calendar date, budget identity/zero/mismatch inputs, allocation reconciliation, three return outcomes across three consumers, and projection equality. Fixtures use actual pure helpers and AST-selected current expressions. No real source ingestion, browser rendering, save/delete concurrency or full Financial PDF was executed in this packet.

Pacing Save/Delete updates the existing campaign endpoint and invalidates campaign/outcome queries119–139. Scope/date edits and source add/edit/disconnect/refresh must still propagate to period Spend, financial publications, KPIs/Benchmarks, Insights, diagnostics, notifications and reports with exact revision identity. The current server report financial sections reuse pacing/allocation helpers, but source mixtures, attachment bytes and full rendered artifact parity remain V1-015 gates. Previous-period variables724–743 serve the hidden legacy renderer; they are not active headline comparisons on this page. No whole-section GO is issued.
