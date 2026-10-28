# Promo Insights Trends review — 2026-10-28

## Decision and scope

Initial review of `main` at `9beb5a91` used no application-code changes or production writes. The user subsequently authorized the targeted corrections recorded below.
**Current decision: Promo's displayed daily values match its stored facts; targeted monthly-history and PDF corrections are implemented locally. Deployment/provider validation and whole-section certification remain unproven.** Original review observations below are retained as baseline evidence.

Scope: Insights Trends Daily, 7d, 30d, Monthly; Sessions, Daily-only Users, Conversions, native GA4 Revenue, Page Views, Engagement Rate; scope/date boundaries, missing/zero rows, comparisons, and directly related PDF propagation. This is not whole-Insights, importer, scheduler, or production-readiness certification. Earlier certification applies to its own revision and is not evidence for this review.

## Live evidence and independently calculated results

An exact-campaign, repeatable-read, read-only database transaction captured Promo at `2026-10-27T23:20:57.996Z` (October 28 Amsterdam). It checked the campaign's owning client, active primary property `542352127`, EUR, `Europe/Amsterdam`, and saved scope `yesop_brand_search` / `yesop_retargeting`. No tokens were selected or logged. The transaction ended with rollback. No personal browser was accessed.

- Campaign creation: October 4, 2026 in Amsterdam. Initial import: September 4.
- Stored daily history: September 4–October 27, 54 unique consecutive dates; all rows marked non-simulated.
- Eligible Trends history: October 4–27, 24 dates, eight nonzero Sessions dates and sixteen explicitly persisted zero dates. There are no missing dates in this window.
- Screenshot boundary October 26: 23 dates, eight active and fifteen explicit zeros. The eight Sessions values are October 4: 111; October 5: 100; October 13: 121; October 16: 113; October 21: 119; October 22: 118; October 23: 112; October 24: 107.
- Every zero-Sessions date also has zero Users, Conversions, Revenue, Page Views, and Engaged Sessions. These are recorded zeros, not a frontend conversion of missing rows into zero.
- Latest captured work for October 27 is completed and not invalidated; the October 27 executive snapshot has its alignment marker. This is read evidence, not a newly triggered refresh or a blanket scheduler sign-off.

| Value | Screenshot: Oct 4–26 | Last 7 days: Oct 20–26 | Prior 7 days: Oct 13–19 |
|---|---:|---:|---:|
| Sessions | 901 | 456 | 234 |
| Conversions | 108 | 54 | 27 |
| Native GA4 Revenue | €27,729.90 | €14,774.35 | €6,625.60 |
| Page Views | 1,553 | 784 | 404 |
| Engagement Rate | 72.3640% | 71.9298% | 72.6496% |

The screenshot's seven-day Sessions change is **+94.9%**. Once the cutoff advances to October 27, the windows become October 21–27 and October 14–20: **456 vs 113, +303.5%**. That change is explained by October 13 leaving the prior window; it is not a changed calculation. October 27 has zero recorded activity, so the month totals above are unchanged.

Monthly October is correctly marked partial, with no prior-month comparison. 30d is correctly unavailable because eligible history is only 23/24 days. A first rolling 30-day point needs 30 dates; a last-vs-prior comparison needs 60 dates. Users is intentionally unavailable outside Daily to avoid summing distinct-user counts across dates.

Trends Revenue contains native GA4 daily revenue only. It does not include Promo's separate €250 CSV revenue or Pipeline Proxy. Overview uses history from September 4, so Overview Sessions 3,433 and native Revenue €80,433.85 are not expected to equal these October-only Trends totals. Daily rates agree with engaged-sessions/session ratios to the stored four-decimal fractional-rate precision (maximum observed difference 0.004286 percentage points).

## Findings reproduced before correction

### T1 — Monthly comparisons are constrained by an insufficient read window

`client/src/pages/ga4-metrics.tsx:1714` fixes the Insights request at 60 days. `server/utils/reporting-timezone.ts` returns exactly 60 inclusive calendar dates. `shared/ga4-insights.ts:357` correctly marks a month partial when days are absent. Together, these can withhold a valid month comparison despite full older history existing in storage.

Offline reproduction: full September + October 2026 is 61 dates. With a value of one Session per day, the complete data produces September 30 and October 31, both complete. The actual 60-day request produces September 29 (partial) and October 31. July/August requires 62 days; including an in-progress current month requires additional history. This is an availability/coverage defect, not fabricated growth. It does not explain Promo's current partial October: Promo was created October 4.

Smallest correction direction: supply enough calendar-month history to Monthly within the existing read path, while explicitly preserving Daily, 7d, 30d and non-Trends consumers' windows. No such change was implemented here.

### T2 — Downloaded Insights PDF percentage changes disagree with the live card

`client/src/pages/ga4-metrics.tsx:4270` has a separate `trendDeltaPct` used by the browser PDF. Unlike the UI's zero-baseline guards and shared signed calculation, it manufactures +100% for positive values after zero, 0% for zero after zero, and mishandles a negative revenue baseline.

Executed current helper against real Promo dates: October 20 Sessions 0 → October 21 Sessions 119 yields **+100% in the PDF calculation**, whereas the live card correctly says **No % baseline**. A revenue fixture -20 → -10 yields 0% instead of +50%. The daily table actually renders these helper results when a prior row exists; monthly and rolling report comparisons use the same helper. No previously emailed or downloaded artifact was claimed to have been inspected during this task.

Smallest correction direction: use the existing shared delta rule and the UI's zero-baseline eligibility in report rendering. This does not require changing report preparation, publication checks, data fetching, financial totals, or stored facts.

### T3 — Other downstream report parity gaps

Source-traced, not visually exercised against a newly generated PDF during this review:

- Browser PDF renders Trends only when more than one chart point exists (`ga4-metrics.tsx:4350`). Promo's single partial October month is visible in the live Monthly card but this branch omits its PDF chart and table. A first single daily point or single complete rolling window has the same omission.
- Browser PDF selects the last 30 returned rows for Daily and the last 14 returned rows for 7d, whereas the live chart uses calendar dates and all complete eligible rolling windows. Sparse data or older eligible windows can therefore produce different ranges. The browser PDF checks adjacency before drawing lines, but positions retained rows by index, compressing missing dates.
- Scheduled Insights output (`server/ga4-scheduled-report-pdf.ts:1743`) deliberately renders a fixed last-14-row Sessions chart/table, rather than the live metric/mode selection. Its `drawTrendChart` connects adjacent returned rows without checking calendar adjacency. With missing rows it can visually bridge an unobserved interval. Promo currently has no such gaps, so this was not observed in its stored history.

At the initial review these paths were unproven for UI/PDF parity. The subsequent correction below addresses the chart and comparison defects; scheduled reports still use their supported fixed Sessions mode rather than a persisted UI selection.

## Trace and boundaries

| Stage | Evidence / behavior reviewed |
|---|---|
| Provider acquisition | `server/analytics.ts:3111` requests daily metrics for selected `sessionCampaignName`, with ordered dates, requested currency and response currency validation. `totalRevenue` can fall back to `purchaseRevenue`; trailing/empty session attribution can use exact campaign UTM traffic in bounded chunks. A date-keyed supplement can fill zero conversions/revenue from selected `campaignName`. Returned-row count checks reject incomplete primary/supplemental responses. |
| Source caveat | The multi-campaign UTM fallback sums daily Users across campaign responses. This is not proof of deduplicated people across campaigns. This review did not establish whether the same user appears in both selected campaigns or compare the saved facts with a fresh provider response. Provider attribution/deduplication semantics therefore remain outside the proven result claim. |
| Zero verification / scheduler | `ga4-daily-scheduler.ts:427` validates numeric/date/duplicate rows, checks presence reports, rejects activity without a complete daily row, and materializes explicit zeros only after those checks. Failed attempts do not call replacement. Currency and Overview totals are reconciled before publication. |
| Persistence | `storage.ts:1959` replaces only the campaign/property/date window and publishes Overview in the same transaction. It checks scope and refresh-work ownership, and rolls back on a changed scope or lost work ownership. This review inspected that existing path; it did not execute production writes or independently exercise every transaction race. |
| Read route | `routes-oauth.ts:9387` uses campaign access enforcement and the selected active property. Normal `/api/campaigns/:id/ga4-daily?days=60&propertyId=...&readOnly=1` reads stored data, excludes today's reporting date, and does not fetch Google or persist results. Storage filters campaign/property/inclusive dates, orders ascending and has no row limit. Schema uniqueness is campaign/property/date. |
| Cache and normalization | The query key includes campaign/property/currency; publication changes invalidate this history. Existing cached values remain available during a background error; absence of all data withholds Trends. Normalization sorts/deduplicates dates, rejects corrupt numeric rows and excludes later dates. Legacy missing engaged sessions may be derived; explicit zero is preserved. |
| Scope/window | The UI filters dates before campaign creation in the reporting timezone. This does not alter Overview history or stored facts. Actual captured daily rows have no duplicates, missing dates, simulated markers, negative revenue, or fractional conversions. |
| Daily | Six selectable metrics; actual day values; missing dates plot null; `connectNulls={false}`. Only an existing prior calendar day permits a comparison; zero baseline is labeled rather than divided into. Counts retain decimals; money and percentages use existing formatters. |
| 7d/30d | Sessions, Conversions, Revenue and Page Views sum exact consecutive calendar dates. Engagement Rate is sum(engaged sessions)/sum(sessions), not mean(daily rates). Each chart point needs a complete window; the comparison table needs both adjacent complete windows. |
| Monthly | Sums by calendar month, weighted Engagement Rate, partial-month labels; percentage comparison needs adjacent full months and nonzero prior value. T1 limits which full months reach this correct calculation. |
| Downstream | Shared eligible history also feeds Insights findings. Browser PDF consumes current Trends state; scheduled PDF rebuilds its own daily view. Findings rules themselves, other tabs, report delivery/bookkeeping, and source mutations were not recertified. No Trends output is written back to Overview, KPIs or financial sources by this read. |

## Validation and evidence files

- 58 existing checks passed across seven targeted Trends/Insights files.
- 121 existing source/scheduler checks passed across `ga4-daily-scheduler-regression`, `ga4-incremental-refresh`, and `ga4-filter`.
- Offline execution of the actual current chart-data code checked **467 chart points** against independent arithmetic for both the screenshot cutoff and the captured latest cutoff. It covered all available metrics/modes, separately verified last/prior rollups, and reproduced T1/T2. These are point assertions, not 467 independent tests or live browser checks.
- `git diff --check` passed. No application-code diff; no build/deployment requested or needed for this review.

Local evidence (not automatically staged):

- `audit-temp/promo-trends-readonly-2026-10-28.mjs` and `.json`: scoped DB read and sanitized facts.
- `audit-temp/promo-trends-review-2026-10-28.ts` and `promo-trends-review-results-2026-10-28.json`: offline arithmetic/source execution and reproductions.
- `docs/fixes/v1-batch-8/validation-2026-10-27-report-incident/promo-trends-review-2026-10-28.{json,log}`: 58 tests.
- Same directory, `promo-trends-source-review-2026-10-28.{json,log}`: 121 tests.

Initial review limits: no fresh Google API reconciliation, authenticated deployed API/UI check, visual PDF generation, scheduled email observation, or production outage/race injection at that stage. Source/API/storage behavior was traced and existing isolated tests executed; exact live deployment parity was not re-established. No runtime fix or production-readiness claim was made at that stage.

## Authorized correction — local implementation

The three user-approved issues are corrected locally. No production write, source refresh, migration, report send, commit, push, or deployment was performed.

### Exact changes and isolation

- `server/routes-oauth.ts`: optional `includeMonthly=1` adds `monthlyData` containing the two previous calendar months and current month, sourced from the same campaign/property Overview daily-history read already performed by this route. It adds no database/provider request. The original 60-day `data`, coverage, freshness, totals, ownership guard, and error paths remain unchanged. Existing callers without this flag retain their response shape.
- `client/src/pages/ga4-metrics.tsx`: the existing Insights request opts in; a separately normalized, creation/cutoff-filtered monthly array feeds only Monthly UI/browser-PDF rendering. Daily/7d/30d, findings, Data Summary, Overview, KPIs, Benchmarks, financial totals, report preflight and publication guards are unchanged. The cache key distinguishes the optional payload; existing prefix invalidations still match it. Missing optional data falls back to the prior daily response for compatibility.
- Browser PDF rendering uses the existing shared signed-delta calculation and says `No % baseline` when the prior value is zero. Monthly comparisons retain raw input precision before formatting. Single daily/rolling points and single partial months render; partial months are labeled and shaded. Daily chart history is calendar-bounded, rolling history includes all eligible windows, and real date spacing separates gaps.
- `server/ga4-scheduled-report-pdf.ts`: the existing fixed Sessions chart retains its mode and last-14-record selection. It receives each row's date, spaces points by calendar distance, joins only consecutive dates, and draws a single recorded point. Source fetches, financial calculations, snapshot generation, scheduling, and email/send bookkeeping are unchanged.

### Regression evidence

- Before correction: the real-route monthly tests failed in three cases (61-day pair, 62-day pair, leap-year partial current month). Twelve neighboring route checks passed.
- Before correction: nine browser PDF cases failed while 106 existing checks passed. The corrected drawing recorder confirmed the missing-date spacing failure independently of PDF color-string quantization.
- Before correction: scheduled chart checks reproduced joining across a missing interval and omission of a singleton. A separate point-marker assertion also failed because the old renderer drew no markers.
- After correction: actual monthly-route responses are identical to the original responses after removing the new optional field, including coverage/refresh metadata and all 60 daily rows. Only the original two storage reads occur; no provider call or storage mutation occurs. Another owner's campaign is denied. Creation-date/cutoff, missing-optional-payload fallback and isolation of daily rows are executed separately.
- The actual complete browser PDF handler is tested for all four zero-baseline modes, signed revenue change, small nonzero monthly baselines, single-point/month output, old complete rolling windows, calendar spacing, and the existing publication/input guards. The scheduled chart tests execute its current drawing function with actual jsPDF, including missing dates, explicit zero, empty history and one point.
- Rendered local one-page PDF samples were visually inspected for Monthly, Daily, 7d and scheduled missing-date chart output. Fixtures replace data/logo/file saving only; they are not production reports or delivered emails.

### Final local outcome

- **247/247 checks passed**, no skips/failures, across ten targeted files. Receipt: `validation-2026-10-27-report-incident/trends-fixes-isolated-final-oct28.{json,log}`. This includes the actual browser PDF handler, the real monthly API route, scheduled chart drawing, financial report neighbors and publication-refresh behavior.
- **One isolated Promo browser journey passed**: real page, intercepted local fixtures, five successful downloads across delayed Insights, failed refresh and recovery cases; unchanged Promo revenue cents and missing-spend behavior. Receipt: `trends-browser-promo-diagnostic-oct28.{json,log}` in the same directory. Eleven unrelated browser variants were deliberately filtered out of this focused run. No personal browser/profile or live service was used.
- A broader combined browser packet exceeded the runner's 600-second limit (`trends-fixes-final-oct28.log`); it has no completed result receipt and is **not counted as passed**. The final core packet and focused browser run above are the completed evidence; this is not a claim that every browser variant completed.
- **467 Promo chart points rechecked unchanged** against the earlier read-only capture. Receipt: `audit-temp/promo-trends-fixed-values-2026-10-28.json`; no fresh production query or mutation.
- TypeScript, client build and server build passed (`trends-fixes-oct28-build-checks.json`); the final TypeScript check after the last small PDF adjustments also passed (`trends-fixes-final-oct28-build-checks.json`). `git diff --check` passed.
- Final rendered Monthly/Daily singleton samples were inspected again after removing duplicate endpoint labels. Four local PDF/PNG fixtures are under `audit-temp/trends-fixed-*-oct28.*`. No user-facing report artifact is being delivered by this coding task.

Remaining limits: deployment pending; no live deployed UI/API validation, provider re-reconciliation or scheduled email delivery check. The review's source/deduplication and whole-section certification limits continue to apply. These changes correct display and read-window behavior; there is no damaged persisted data to clean up. No broader production-ready claim is made.
