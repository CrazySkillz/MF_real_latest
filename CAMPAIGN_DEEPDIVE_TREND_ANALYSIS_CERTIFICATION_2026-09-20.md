# Campaign DeepDive Trend Analysis Certification — 2026-09-20

## Decision

Status: **PASS — bounded production certification for the current GA4-first Trend Analysis surface at application runtime `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`, currently deployed within documentation-only successor `595268463c79b111e77b181ad3003e58f912d208`.**

The earlier `58a93a81feb189cbf7b502f3ae57a72120a9a80d` decision is historical. The current revision was revalidated after the initial-render, cumulative-input, anomaly-helper, financial-reconciliation, and Executive Recommendation changes. This decision applies only to the exact scope and evidence below.

The top-card presentation candidate introduced at `52bf90fb2b26642e8268434f268857ffaab96c01` and included in application runtime `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb` passed authenticated browser confirmation. The heading is `Campaign-to-Date Performance Summary`; positive comparisons are green, negative comparisons are red, and zero comparisons remain neutral. The change does not alter metric values or calculations. Repository comparison proves that current deployed revision `595268463c79b111e77b181ad3003e58f912d208` changes only this certification record relative to `7dc72dc8`, so the application evidence carries forward without broadening its scope.

This is not a global or multi-source certification. In the current release, campaign metrics are imported through GA4. Meta, Instagram, LinkedIn, TikTok, and other non-GA4 main-source Trend paths are not configured. The positive `Paid Acquisition Funnel` and multi-source `Source Contribution` branches are therefore excluded; their correct GA4-only behavior is to remain hidden.

## Certified Runtime And Configuration

- Branch: local `main`, matching `origin/main` at validation.
- Deployed service: `https://marketforensics.onrender.com`.
- Certified application runtime: `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`.
- Current deployed health revision: `595268463c79b111e77b181ad3003e58f912d208` (documentation-only relative to the certified runtime).
- Audited production campaign: `Campaign2`.
- Main source boundary: exactly one connected `ga4` source (`Google Analytics`).
- Campaign currency: `USD`.
- Campaign reporting timezone: `Europe/Amsterdam`.
- Browser observation data-through date: `2026-09-19`.
- Authenticated selector observation: the 7-, 14-, and 30-day selections rendered charts; the 90-day selection rendered the explicit insufficient-history state rather than an empty or fabricated chart. Their corresponding `2x` aggregate requests returned 12, 14, 17, and 40 stored daily rows respectively.
- Bounded browser/PDF value observation within the certified dependency chain: Revenue `124297.10`, Spend `2759.75`, Conversions `349`, Sessions `2728`, and Users `2730`. These values were compared dynamically between authenticated browser cards and a newly generated production PDF rather than against stale hardcoded values; the exact carried-forward renderer revisions are identified in the report-parity and evidence rows below.

## Subsection Results

| Subsection | Result | Bounded finding |
| --- | --- | --- |
| 1. Campaign-to-Date Performance Summary | **PASS** | The observed Revenue, Spend, ROAS, ROI, Conversions, CPA, Sessions, Users, CVR, and Engagement Rate cards use campaign-scoped GA4/canonical financial inputs, campaign currency, compatible cumulative windows, and guarded formulas. Missing and valid-zero inputs are not conflated. The implementation can also render CPC, CPM, or CTR when their required aggregate inputs are available; those positive paid-media card paths are not part of this GA4-only certification. |
| 2. Campaign Performance Trend | **PASS** | The selected calendar window uses actual daily rows, preserves missing dates as gaps, and does not interpolate absent activity. The deployed page exercised all four selectors. |
| 3. Efficiency Trends | **PASS** | Return, cost, and rate series render only with compatible inputs. Valid zero is preserved; unavailable financial history is explained instead of rendered as fabricated zero performance. |
| 4. Website Engagement & Conversion Summary | **PASS** | Sessions, engaged sessions, conversions, engagement rate, and conversions per 100 sessions remain GA4-scoped and use consistent cumulative numerator/denominator windows. |
| 5. Anomaly Detection | **PASS** | Browser anomaly flags derive from compatible daily history, preserve observed zero drops, and use descriptive—not causal—wording. This is a browser decision-support panel, not a claim of cause. |
| 6. Executive Recommendations | **PASS** | Complete adjacent windows produce an evidence-labelled, actionable traffic/conversion comparison. Campaign-to-date ROAS guidance is promoted only when active revenue/spend inputs, scope, dates, currency, and formula totals reconcile; otherwise budget guidance fails closed. No causal improvement claim is made. |

## Combined-Page Results

Overall combined page: **PASS within the certified GA4-first boundary.**

| Gate | Result | Evidence boundary |
| --- | --- | --- |
| `7/14/30/90-day` selector | **PASS** | Each option changed the visible selector and requested the matching `dateRange` with a `2x` daily-history fetch. The deployed responses used the latest completed reporting-day boundary. |
| Conditional Paid Acquisition Funnel | **PASS — hidden** | The exact production aggregate exposed only GA4. The panel was absent in both the deployed page and deployed PDF, as required because GA4 does not provide paid-media impressions/clicks. Positive paid-media rendering is excluded. |
| Conditional Source Contribution | **PASS — hidden** | One main source was present, so the panel was absent in both the deployed page and deployed PDF. GA4 child financial inputs were not promoted to separate main sources. Positive multi-source rendering is excluded. |
| Loading | **PASS** | The mounted loading branch and stable-content behavior are covered by the focused current-revision regression packet and production build. |
| Empty | **PASS** | Exact deployed-bundle state injection distinguished a successful empty result from failure/unavailability. |
| Valid zero | **PASS** | Aggregate, UI, and report regressions prove explicit zero values remain available values and participate in the guarded formulas. |
| Stale | **PASS** | Exact deployed-bundle state injection retained the latest available data and displayed the stale warning. |
| Unavailable | **PASS** | Invalid or incomplete consumer contracts withheld dependent values and displayed the unavailable state. |
| Failure | **PASS** | Non-2xx core Trend responses throw, initial failure is distinct from empty data, and background failure retains last-good values with a warning. |
| Refresh propagation | **PASS — request/data path** | Queries refetch on focus and at the existing interval. A later read-only deployed observation at the same revision returned the next current aggregate values. No separate Trend write path was introduced or claimed. |
| Browser/scheduled Trend report parity | **PASS — shared renderer, bounded fields** | A deployed one-off Trend PDF at runtime `637d0c31` matched browser Revenue, Spend, Conversions, Sessions, and Users; included the reconciled ROAS guidance; removed the redundant Selected-Window Comparison recommendation; and correctly omitted both unsupported conditional panels. The only later runtime change through `7dc72dc8` is the client-only heading/color presentation, so the unchanged shared PDF renderer evidence carries forward. Anomaly Detection remains a browser-only decision-support panel and is not claimed as PDF content. No new scheduled firing or email was required. |

## Dependency-Impact Comparison

Compared with the previously certified runtime `58a93a81feb189cbf7b502f3ae57a72120a9a80d`:

- Changed and revalidated: `client/src/lib/trend-analysis-cumulative.ts`, `client/src/pages/trend-analysis.tsx`, the certified outcome-total reader in `server/routes-oauth.ts`, and the Trend PDF branch in `server/report-scheduler.ts`.
- The page now waits for the GA4 coverage contract before deriving verified daily rows, preventing the initial blank/render exception while retaining explicit loading and failure states.
- Cumulative GA4 Users, Sessions, Conversions, CVR, Engagement Rate, and anomaly rows are derived from the verified GA4 daily path; financial decisions use reconciled campaign-scoped revenue and spend inputs.
- The anomaly algorithm is shared as a deterministic helper without changing its descriptive seven-comparable-date statistical contract. Direct warning, critical, valid-zero, missing-value, and zero-variance cases are regression-covered.
- The relevant scheduler composition still uses `aggregateCampaignMetrics` → `trend_analysis_aggregate_v1`; the PDF ROAS recommendation now fails closed unless the full financial decision context reconciles.
- No shared API response shape, database schema, source ownership boundary, or unrelated page architecture changed.

## Documentation-To-Implementation Alignment

The current documentation was rechecked against `client/src/pages/trend-analysis.tsx`, `client/src/lib/trend-analysis-cumulative.ts`, `server/utils/trend-analysis-aggregate.ts`, the relevant Trend composition in `server/routes-oauth.ts`, and the shared PDF branch in `server/report-scheduler.ts`.

- The browser selector defaults to 7 days, supports 7/14/30/90 days, controls chart dates and the exact cumulative comparison date, and requests `2x` daily history for comparison context.
- Top-card current values remain cumulative; the selector does not turn them into rolling-window totals. Direction colors describe numeric movement only and do not encode whether a movement is favorable.
- The certified GA4 Campaign Performance chart exposes Users, Sessions, and Conversions from provider-verified/persisted daily history. Missing dates remain null gaps; provider-verified zeros remain zero.
- Efficiency subcharts are capability-gated independently. In the certified GA4-only case, daily return/cost charts are withheld without compatible daily financial history, while CVR and Engagement Rate use verified daily traffic. Verified all-zero activity dates display an amber no-activity marker and no fabricated rate.
- GA4-only anomaly detection evaluates Conversions against the prior seven comparable numeric values. Warning requires more than two population standard deviations, critical requires more than three, zero-variance and missing-value windows are skipped, and verified zero remains eligible. The browser list is capped at eight; Anomaly Detection is not included in the PDF.
- Website Engagement & Conversion Summary uses cumulative Sessions, Engaged Sessions, Conversions, Engagement Rate, and conversions per 100 Sessions from one compatible numerator/denominator window.
- Paid Acquisition Funnel and Source Contribution remain capability/cardinality conditional. Their hidden GA4-only behavior is certified; their positive non-GA4 branches are not.
- Browser Executive Recommendations are capped at three. The adjacent-window action requires complete equal-length daily windows; ROAS budget guidance requires fully reconciled financial decision context; conversion-volume guidance requires positive cumulative Sessions. Internal coverage/single-source informational cards are filtered out.
- Initial loading, successful empty, stale/background failure, unavailable contract, and initial failure have distinct mounted states. Core queries refetch every 30 seconds while visible and on focus; the provider-coverage verifier refetches every 30 minutes and on focus.
- Direct, snapshot, and scheduled Trend PDFs share one renderer and one normalized `Executive View`. That renderer uses a fixed 30-day calendar window, independent of the browser's current/default selector.
- Retained legacy source queries, `crossPlatformData`, and retired tab panels still exist in the page file but do not supply the mounted Executive View or current report composition. Their presence is documented implementation debt, not a certified alternate value path.

## Evidence

Fresh current-revision evidence:

- focused Trend/UI/report packet: **94/94 passed** across nine focused files
- adjacent financial/Overview/scheduler packet: **79/79 passed** across eight files
- `npm run check`: passed after the final implementation
- `npm run build`: passed after the final implementation
- current deployed health: HTTP 200 and exact documentation-only successor `595268463c79b111e77b181ad3003e58f912d208` matched; `git diff 7dc72dc8..59526846` contained only this certification file
- authenticated deployed browser validation at application runtime `7dc72dc8`: initial render remained stable; all four selectors requested the matching `dateRange` and `2x` history; all required browser sections loaded; no page error or critical Trend request failure occurred
- authenticated deployed top-card presentation validation at `7dc72dc8`: the new section heading rendered; Revenue, ROAS, ROI, Conversions, Sessions, and Users increases were green; CPA, CVR, and Engagement Rate decreases were red; the zero Spend change remained neutral
- current-revision focused regressions covered loading, empty, valid-zero, stale, unavailable, initial-failure, and background-failure branches; the authenticated deployed run separately proved the normal live state and initial-render path
- carried-forward deployed one-off GA4-only Trend PDF evidence from `637d0c31`: valid PDF; current browser Revenue, Spend, Conversions, Sessions, and Users matched; reconciled ROAS guidance was present; the redundant comparison recommendation and unsupported conditional panels were absent. The PDF/server path did not change in `52bf90fb` or the documentation-only successors through `59526846`
- strict persistence checks proved campaign, GA4 daily, revenue, report, and snapshot records unchanged. A concurrent three-minute Google Sheets spend refresh regenerated row IDs and `lastSyncedAt`; a repeat gate compared the spend business-value projection and proved dates, amounts, currency, source scope, and totals unchanged
- the repository-wide suite was not globally clean: 2012 tests passed and 45 unrelated tests failed across 38 suites. None of the failing suite filenames belonged to the bounded Trend packet, so this certificate makes no whole-repository or whole-application claim

Reused evidence, after dependency comparison:

- prior GA4 persistence, campaign/property isolation, exact-comparison, missing-date, and snapshot-version evidence was reused only where the relevant path remained unchanged
- prior scheduled Trend evidence was reused only for the unchanged Trend snapshot path
- no timer firing was awaited and no global scheduler-health claim is made

## Exclusions And Future Gates

This certificate does not certify:

- positive paid-media or multi-source Trend behavior
- Meta, Instagram, LinkedIn, TikTok, Google Ads, Custom Integration, or any other non-GA4 main source
- a future source mix merely because synthetic regression coverage exists
- global scheduler health, provider delivery, or inbox receipt
- GA4 Overview, Performance Summary, Budget & Financial Analysis, KPI, Benchmark, Ad Comparison, Insights, or Reports beyond the specific Trend dependencies and output checked here
- arbitrary GA4 properties, campaign filters, currencies, timezones, or data histories outside the exact audited configuration

Before any non-GA4 main source is enabled for this release, its positive conditional panels, ownership and campaign isolation, capability mapping, date/currency behavior, refresh propagation, valid-zero/unavailable states, and browser/shared-PDF parity require deployed source-specific evidence and a renewed bounded certification.

## Repository Hygiene

- `APP_PRODUCTION_READINESS.md` was not modified.
- The pre-existing uncommitted ledger edit and unrelated untracked paths were preserved.
- This documentation-alignment update changes this certificate's wording only. It changes no product code, shared contract, existing test, or other certification record.
- The UI runtime change is committed at `52bf90fb2b26642e8268434f268857ffaab96c01` and included in certified application runtime `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`. Current deployed revision `595268463c79b111e77b181ad3003e58f912d208` changes only this certification record relative to that runtime; the documentation-alignment edits do not change application code.
