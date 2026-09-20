# Campaign DeepDive Trend Analysis Certification — 2026-09-20

## Decision

Status: **PASS — bounded production certification for the current GA4-first Trend Analysis surface at deployed revision `637d0c31e1466ff2b2d7f0ad25543c5ec3ddd828`.**

The earlier `58a93a81feb189cbf7b502f3ae57a72120a9a80d` decision is historical. The current revision was revalidated after the initial-render, cumulative-input, anomaly-helper, financial-reconciliation, and Executive Recommendation changes. This decision applies only to the exact scope and evidence below.

Post-certification candidate `52bf90fb2b26642e8268434f268857ffaab96c01`: **UNVERIFIED pending deployment and browser confirmation.** The subsequent top-card title and directional-color presentation change does not alter metric values or calculations, but it changes the certified UI dependency.

This is not a global or multi-source certification. In the current release, campaign metrics are imported through GA4. Meta, Instagram, LinkedIn, TikTok, and other non-GA4 main-source Trend paths are not configured. The positive `Paid Acquisition Funnel` and multi-source `Source Contribution` branches are therefore excluded; their correct GA4-only behavior is to remain hidden.

## Certified Runtime And Configuration

- Branch: local `main`, matching `origin/main` at validation.
- Deployed service: `https://marketforensics.onrender.com`.
- Deployed health revision: `637d0c31e1466ff2b2d7f0ad25543c5ec3ddd828`.
- Audited production campaign: `Campaign2`.
- Main source boundary: exactly one connected `ga4` source (`Google Analytics`).
- Campaign currency: `USD`.
- Campaign reporting timezone: `Europe/Amsterdam`.
- Browser observation data-through date: `2026-09-19`.
- Authenticated selector observation: the 7-, 14-, and 30-day selections rendered charts; the 90-day selection rendered the explicit insufficient-history state rather than an empty or fabricated chart. Their corresponding `2x` aggregate requests returned 12, 14, 17, and 40 stored daily rows respectively.
- Deployed browser/PDF observation at the same revision: Revenue `124297.10`, Spend `2759.75`, Conversions `349`, Sessions `2728`, and Users `2730`. These values were compared dynamically between the authenticated browser cards and a newly generated production PDF rather than against stale hardcoded values.

## Subsection Results

| Subsection | Result | Bounded finding |
| --- | --- | --- |
| 1. Top Summary Cards | **PASS** | Revenue, Spend, ROAS, ROI, Conversions, CPA, Sessions, Users, CVR, and Engagement Rate use campaign-scoped GA4/canonical financial inputs, campaign currency, compatible cumulative windows, and guarded formulas. Missing and valid-zero inputs are not conflated. |
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
| Browser/scheduled Trend report parity | **PASS — shared renderer, bounded fields** | A deployed one-off Trend PDF at the exact revision matched browser Revenue, Spend, Conversions, Sessions, and Users; included the reconciled ROAS guidance; removed the redundant Selected-Window Comparison recommendation; and correctly omitted both unsupported conditional panels. Browser one-off and scheduled Trend PDFs call the same server renderer. Anomaly Detection remains a browser-only decision-support panel and is not claimed as PDF content. No new scheduled firing or email was required. |

## Dependency-Impact Comparison

Compared with the previously certified runtime `58a93a81feb189cbf7b502f3ae57a72120a9a80d`:

- Changed and revalidated: `client/src/lib/trend-analysis-cumulative.ts`, `client/src/pages/trend-analysis.tsx`, the certified outcome-total reader in `server/routes-oauth.ts`, and the Trend PDF branch in `server/report-scheduler.ts`.
- The page now waits for the GA4 coverage contract before deriving verified daily rows, preventing the initial blank/render exception while retaining explicit loading and failure states.
- Cumulative GA4 Users, Sessions, Conversions, CVR, Engagement Rate, and anomaly rows are derived from the verified GA4 daily path; financial decisions use reconciled campaign-scoped revenue and spend inputs.
- The anomaly algorithm is shared as a deterministic helper without changing its descriptive seven-comparable-date statistical contract. Direct warning, critical, valid-zero, missing-value, and zero-variance cases are regression-covered.
- The relevant scheduler composition still uses `aggregateCampaignMetrics` → `trend_analysis_aggregate_v1`; the PDF ROAS recommendation now fails closed unless the full financial decision context reconciles.
- No shared API response shape, database schema, source ownership boundary, or unrelated page architecture changed.

## Evidence

Fresh current-revision evidence:

- focused Trend/UI/report packet: **94/94 passed** across nine focused files
- adjacent financial/Overview/scheduler packet: **79/79 passed** across eight files
- `npm run check`: passed after the final implementation
- `npm run build`: passed after the final implementation
- deployed health: HTTP 200 and exact revision matched
- authenticated deployed browser validation: initial render remained stable; all four selectors requested the matching `dateRange` and `2x` history; all required browser sections loaded; no page error or critical Trend request failure occurred
- current-revision focused regressions covered loading, empty, valid-zero, stale, unavailable, initial-failure, and background-failure branches; the authenticated deployed run separately proved the normal live state and initial-render path
- deployed one-off GA4-only Trend PDF: valid PDF; current browser Revenue, Spend, Conversions, Sessions, and Users matched; reconciled ROAS guidance was present; the redundant comparison recommendation and unsupported conditional panels were absent
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
- No product code, shared contract, existing test, or existing certificate was changed by this certification record.
- The post-certification UI candidate is committed and pushed at `52bf90fb2b26642e8268434f268857ffaab96c01`, but remains unverified until that exact revision is deployed and browser-confirmed.
