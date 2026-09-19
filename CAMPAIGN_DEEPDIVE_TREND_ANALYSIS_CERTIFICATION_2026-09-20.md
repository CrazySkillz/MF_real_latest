# Campaign DeepDive Trend Analysis Certification — 2026-09-20

## Decision

Status: **PASS — bounded production certification for the current GA4-first Trend Analysis surface at deployed revision `58a93a81feb189cbf7b502f3ae57a72120a9a80d`.**

This is not a global or multi-source certification. In the current release, campaign metrics are imported through GA4. Meta, Instagram, LinkedIn, TikTok, and other non-GA4 main-source Trend paths are not configured. The positive `Paid Acquisition Funnel` and multi-source `Source Contribution` branches are therefore excluded; their correct GA4-only behavior is to remain hidden.

## Certified Runtime And Configuration

- Branch: local `main`, matching `origin/main` at validation.
- Deployed service: `https://marketforensics.onrender.com`.
- Deployed health revision: `58a93a81feb189cbf7b502f3ae57a72120a9a80d`.
- Audited production campaign: `Campaign2`.
- Main source boundary: exactly one connected `ga4` source (`Google Analytics`).
- Campaign currency: `USD`.
- Campaign reporting timezone: `Europe/Amsterdam`.
- Browser observation data-through date: `2026-09-18`.
- Browser default-window observation: 15 daily records across 30 calendar dates; missing dates remained gaps.
- Later deployed PDF/API observation at the same revision: Revenue `70473.69`, Spend `338`, Conversions `96`, Sessions `569`, and Users `569`. These values were compared dynamically between the production aggregate and generated PDF rather than against stale hardcoded values.

## Subsection Results

| Subsection | Result | Bounded finding |
| --- | --- | --- |
| 1. Top Summary Cards | **PASS** | Revenue, Spend, ROAS, ROI, Conversions, CPA, Sessions, Users, CVR, and Engagement Rate use campaign-scoped GA4/canonical financial inputs, campaign currency, compatible cumulative windows, and guarded formulas. Missing and valid-zero inputs are not conflated. |
| 2. Campaign Performance Trend | **PASS** | The selected calendar window uses actual daily rows, preserves missing dates as gaps, and does not interpolate absent activity. The deployed page exercised all four selectors. |
| 3. Efficiency Trends | **PASS** | Return, cost, and rate series render only with compatible inputs. Valid zero is preserved; unavailable financial history is explained instead of rendered as fabricated zero performance. |
| 4. Website Engagement & Conversion Summary | **PASS** | Sessions, engaged sessions, conversions, engagement rate, and conversions per 100 sessions remain GA4-scoped and use consistent cumulative numerator/denominator windows. |
| 5. Anomaly Detection | **PASS** | Browser anomaly flags derive from compatible daily history, preserve observed zero drops, and use descriptive—not causal—wording. This is a browser decision-support panel, not a claim of cause. |
| 6. Executive Recommendations | **PASS** | Recommendations use only available Trend signals, distinguish selected-window from campaign-to-date context, and require business targets/source capacity before spend decisions. No causal improvement claim is made. |

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
| Browser/scheduled Trend report parity | **PASS — shared renderer** | A deployed one-off Trend PDF at the exact revision matched current production aggregate values and correctly omitted both unsupported conditional panels. Browser one-off and scheduled Trend PDFs call the same server renderer; focused parity regressions cover the shared output. No new scheduled firing or email was required. |

## Dependency-Impact Comparison

Compared with the prior certified runtime `cd35bba1c4ff4bb0b045c3bc6c176f2847cd80eb`:

- Changed and revalidated: `client/src/pages/trend-analysis.tsx`, the Trend endpoint/composition in `server/routes-oauth.ts`, `server/utils/trend-analysis-aggregate.ts`, and the Trend section of `server/report-scheduler.ts`.
- The changed runtime added exact calendar-window handling, cumulative GA4 summary alignment, valid-zero handling, campaign-currency formatting, GA4/paid-source isolation, conditional report sections, and distinct loading/empty/stale/unavailable/failure behavior.
- Relevant persisted-read contracts and shared Trend field meanings remain compatible. Changes elsewhere in `server/storage.ts` and `shared/schema.ts` did not change the audited Trend read contract.
- The relevant scheduler snapshot composition still uses the existing `aggregateCampaignMetrics` → `trend_analysis_aggregate_v1` path. File-level scheduler changes outside that path were not treated as Trend evidence.
- No shared API response contract, database schema, or source ownership boundary was changed by the final unavailable-state fix.

## Evidence

Fresh current-revision evidence:

- focused Trend/UI/report packet: **71/71 passed** across six focused files
- `npm run check`: passed once after the final fix
- `npm run build`: passed once after the final fix
- deployed health: exact revision matched
- authenticated deployed browser validation: all selectors and six visible subsections passed
- exact deployed-bundle state validation: empty, stale, unavailable, and failure passed
- deployed one-off GA4-only Trend PDF: valid PDF, current aggregate values present, unsupported conditional panels absent
- PDF validation created no campaign, analytics, report, snapshot, schedule, or email records

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
- This certificate is uncommitted and unpushed pending explicit approval.
