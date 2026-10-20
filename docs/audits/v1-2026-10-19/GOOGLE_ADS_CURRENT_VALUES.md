# Google Ads retained page: current values, goals and Insights

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. Google Ads was not among the four providers the user deferred. The retained main page and GA4 child Spend connection are different contracts. This supplement reviews the main page without configuring a provider or using another live campaign. [Seven exact-declaration cases](google-ads-value-reproductions.json), [runner](google-ads-value-reproductions.cjs), [all22 Insight rules and complete source expression](google-ads-insight-rule-catalog.json). Existing provider, currency/window and aggregation findings remain in [paid-source evidence](RETAINED_PAID_VALUE_BOUNDARIES.md).

## Complete declared metric and rendered consumer contracts

Source: `google-ads-analytics.tsx:27–41,172–216,329–370,472–699,776–864`. Native values originate in selected Google Ads daily rows via current connection/daily API and scheduler/provider query contracts. Rows are fetched from now-minus90days through UTC today; this differs from inclusive90-day Revenue helper boundaries. Query failure becomes empty metrics; null summary renders “No data yet,” not an explicit failed provider state.

| Metric/field | Current calculation/unit and missing behavior | Consumers |
|---|---|---|
| Impressions | Sum integer row impressions, absent0; locale count | Overview, daily/rolling chart, campaign rows, KPI/Benchmark live values, Insights volume gates and reports |
| Clicks | Sum integer clicks, absent0 | Same consumers; cost/rate denominator |
| Conversions | Sum parseFloat row conversions, absent0; some Overview/text branches round to integer | Same consumers; CPA/CVR, volume/reliability and leader ranking |
| Spend | Sum parseFloat spend, absent0; literal$ formatting | Overview/charts/rows/goals/Insights/reports; numerator for costs and denominator for efficiency |
| Video Views | Sum row counts, absent0 | Overview/chart options/rows/goals/report metric family |
| CTR | Overview/campaign: clicks/impressions×100; no impressions→0. Daily chart averages row CTR, not denominators | Charts, goals, Insights, comparison; V1-107 |
| CPC | Spend/clicks, no clicks→0; literal$ | Overview, chart, rows, goals, efficiency rank/Insights; V1-128 |
| CPM | Spend/impressions×1000, no impressions→0; literal$ | Overview/chart/rows/goals/Insights; unavailable denominator is lost |
| Conversion Rate | Conversions/clicks×100, no clicks→0 | Overview/chart/rows/goals/Insights; click-based provider conversion rate, not GA4 session key-event rate |
| Cost per Conversion | Spend/conversions, no conversions→0; literal$ | Overview, rows, rolling/Insights, goals; V1-128 |
| Search Impression Share | Sum positive row percentages divided by positive-row count; chart divides all row sum by all row count | Overview/chart/goals/Insights. Eligible-impression denominator/censoring lost; V1-107 |
| Native conversionValue | Sum provider conversion values, absent0 | Internal native ROAS/ROI, daily/rolling series, Insights and comparison; not one of the15 selectable goal definitions, but live resolver accepts it |
| Total Revenue | Imported attributed source totals preferred when positive, otherwise bounded Revenue API total; active source presence determines available connection | Overview/Revenue modal/business goals/Insights. All-date versus90-day mismatch and currency-error fallback V1-104/106 |
| Profit | Imported Revenue−summary Spend; source absent returns numeric0 to goal resolver | Business goal/overview/report family; same-window/currency/source state required |
| ROAS | Business goal/overview uses imported Revenue/Spend; internal native summary/chart/comparison uses conversionValue/Spend; zero Spend→0 | Distinct definitions must stay labelled through reports; Insights selects imported source when present, otherwise explicitly labels native conversion value |
| ROI | Business goal/overview uses(imported Revenue−Spend)/Spend×100; native summary/comparison uses conversionValue; zero Spend→0 | Same definition split and error/zero requirements |
| Campaign identity/name | Group by nonempty provider ID, otherwise name; empty name “Unknown Campaign”; row.days counts rows | Overview/comparison tables, labels, ranking; ID fallback can merge same-name unknown-ID rows. Provider identity completeness still required |
| Campaign GA4 Revenue/ROAS | Sum ga4Revenue when truthy and mark hasGa4Revenue; divide by Spend | Exact enrichment/duplication gate V1-046; strings/numeric zero have different truthiness. Does not prove the GA4 value shares Ads attribution/window |
| Campaign imported Revenue/ROAS/ROI | Exact provider-ID lookup in imported attribution map; positive Revenue marks hasAttributedRevenue, otherwise ROAS/ROI null | Comparison/table provenance; measured zero versus no mapped Revenue is not represented independently |
| Comparison chart/leader fields | Sort selected metric descending, top10; name truncates beyond30chars, fullName retained; monetary/ratio chart values round2. Best=largest conversions; efficient=minimum positive-click CPC using cpc-or-Infinity; attention=lowest positive-click CTR | Descriptive heuristics. Zero-cost candidate is ranked Infinity, not best. Ties inherit order; no statistical significance evidence |
| Source modal identity/amount | Active source rows, display names, source type, mapping metadata, lastTotalRevenue and inherited currency | Source-to-date identity differs from summary date-window; add/edit/delete/refresh propagate through source records then API/query invalidation, not chart-only sums |

The declared15 metric definitions and11 time-chart choices are explicit in the page; native conversionValue and attributed/GA4 comparison fields are additional downstream values. Zero, missing, error, currency and window issues are not solved by having a formatter for each key.

## V1-127 — observed-row windows labelled as calendar weeks/months

**P1.** `google-ads-analytics.tsx:593–690`: dailySeries rolls the last7/30 *rows* and insightsRollups takes last/prior7/30 rows. availableDays is row count; minDaysForWoW14 does not check date continuity, successful coverage or a current completed-day boundary.

Exact fixture:14 observations over27 calendar dates pass the14-observation gate. “last7” covers September15–27 (13 calendar days), with a prior seven-row period and rolling series generated. Contiguous14-day control aligns properly. A one-row partial period produces a100% delta versus absent prior, although the separate14-row gate prevents claiming that WoW narrative renders in that one-row case. No claim that actual provider data are sparse on Ptomo or any live Ads account.

Required: define calendar/date/source coverage, preserve missing/unavailable versus successful zero, align prior periods and apply eligibility to chart labels, tracker comparisons, Insights/reliability and report exports. Do not blindly copy GA4 dense-day behavior; the provider's zero-row omission and coverage guarantees require independent validation.

## V1-128 — undefined cost/source inputs become goal scores

**P1.** `google-ads-analytics.tsx:487–491,776–843`: no clicks/conversions yields zero cost metrics; the live resolver returns numeric0 for absent financial sources/unknown metrics. Lower-is-better progress is target/current without a denominator/availability guard. Spend100 with no clicks becomes CPC0; target2 yields Infinity and on_track. Trackers cap it at200% and KPI/Benchmark cards/Insights consume the same score. Finite CPC1/target2 control returns200%; zero-target control returns unknown, which tracker counts in its “behind” else branch.

This is a visible goal-scoring defect, not proof of actual scheduled notification decisions for every Ads target. Stored/manual current values and alert resolvers have separate paths. Required fix must preserve explicit unavailable/manual/source-backed state, finite denominator and target direction through live scoring, tracker summaries, stored updates, report preflight and alert decisions; independent positive/zero/missing/failed-source cases.

## All22 Insights rules, ranking and provenance

The machine catalog retains every condition and title/description/recommendation/evidence expression, plus the complete engine expression for loop and sibling-flag context. Its initial ancestor walk omitted else-negation; corrected catalog records it explicitly. This was inventory tooling, not product behavior.

| Rule family | Current evidence/threshold logic and outputs |
|---|---|
| Four integrity rules | Spend with0conversions; conversions with0native value; impressions with0clicks; campaign rows with0spend/impressions. High reliability is hardcoded for several checks; it is not a provider completeness certificate. |
| Three financial rules | Negative ROI and ROAS<1 require positive selected revenue/value, Spend and≥5conversions; severity uses−20%ROI/0.5ROAS. Diminishing returns requires WoW gate, Spend+20%, conversion change<10%, prior≥20conversions and current Spend≥50. |
| Seven anomaly rules | CPC+20%/CTR−15% combined Quality Score hypothesis; CVR−20%/CTR within±5% landing-page hypothesis; standalone CVR/CPC fallbacks suppressed by those combined flags; impressions−20%; CPM+25%; native conversion-value ROAS−25%. Prior click/impression/conversion/spend volume gates vary by metric. |
| Three portfolio rules | Largest campaign≥70%Spend with≥2campaigns and totalSpend≥100; campaignCTR<1% when accountCTR≥1.5%; Search Impression Share0–40 with Spend>0 and≥1000impressions. Campaign comparison filtering/ranking occurs before these labels. |
| Four goal rules | KPI and Benchmark behind/attention narratives from the same live progress function; current/target/metric label, optional WoW delta, hardcoded strategic advice. Missing state and invalid direction/denominator remain V1-128. |
| One account CTR rule | CTR0–1%,≥5000impressions, only if campaign CTR outlier not fired; labels this “below Google Ads average” and asserts typical1–2% across verticals without a linked current dataset or network/industry selection. Treat it as unverified reference/advice under V1-014, not a proven measured benchmark. |

Reliability is a volume heuristic: prior7 when≥14observations, otherwise last7; clicks≥100/impressions≥5000 support CTR/cost metrics, conversions≥20 supports conversion metrics; financial return confidence is capped medium. Sorting is integrity first, then high/medium/low severity, preserving declaration order for ties. No causality or statistical significance is calculated. Recommendations about causes/strategic changes must be presented as hypotheses and validated independently; numeric correctness does not establish the causal wording.

## Lifecycle, reports and remaining acceptance

Goal forms create/update name, metric, target/current, unit, priority/category/timeframe/trackingPeriod and alert/email configuration. Local live values can initialize currentValue. Generic APIs enforce campaign/platform contracts; retained mutation exceptions are separately V1-054. Target edits/delete, saved/manual/current-source distinctions, email threshold meaning and destructive races remain governed by current goal/alert records, not this page helper alone.

Reports expose overview, KPIs, Benchmarks, comparison, Insights and custom subsets, with schedule/recipients/timezone. Saved/retained PDFs and current versus snapshot generation have V1-060/119 and delivery findings. All15 metric definitions, the additional native/attributed values, source provenance and22 narratives must reconcile through those outputs before page certification.

This closes the declared current page value/rule inventory at the code boundary. Real provider permission/pagination/attribution/currency, full authenticated lifecycle, competing refresh, saved-import propagation, complete PDF rendering and delivery remain separately unverified/failed. It is not a source-wide certificate and does not defer Google Ads by implication.
