# GA4 Insights → Trends certification — 2026-09-17

## Decision and boundary

**CLEAN CERTIFIED / PRODUCTION READY for the GA4 Insights Trends card only** on the exact deployed Render commit `757cfc5926d59dbae4addd0a4d4a0531f675f3f7`. The live checks used two owned campaigns connected to GA4 property `542352127`, including the current campaign created on 2026-09-08 and an older campaign with enough history for a populated 30-day view. This is a bounded certification of the Trends implementation and its fail-closed behavior, not a claim about every GA4 property or future provider response.

This covers the browser's Daily, 7d, 30d, and Monthly charts and tables; Sessions, Daily-only Users, Conversions, GA4 Revenue, Page Views, and Engagement Rate; date and comparison eligibility; verified zero, unverified gap, stale, and unavailable states; and metric-selector stability. Reports/PDFs and other Insights sections are outside this certificate. Protected Overview, KPIs, Benchmarks, Ad Comparison, Executive Financials, their tests/contracts/certificates, the master ledger, and Render scheduler settings were not changed.

## Proven Trends data path

The existing GA4 importer requests date-dimension metrics for the selected campaign's active property and saved campaign filters through the completed reporting day. Its existing storage path atomically replaces the campaign/property/date window in `ga4_daily_metrics`. Insights reads those stored rows via `GET /api/campaigns/:id/ga4-daily?days=60&propertyId=...&readOnly=1`; that read-only request does not refresh or rewrite facts. The Trends-only coverage endpoint independently checks matching GA4 daily values and campaign presence against the stored rows. It returns zero dates only when the full check succeeds and the scope, timezone, cutoff, and stored metrics reconcile. The browser applies those dates only when the coverage response matches the selected property and daily response. Verification failure leaves absent dates as gaps.

Trends then filters the eligible reporting dates to **on or after the campaign creation calendar date in its reporting timezone**. The stored history and shared API contract remain intact for protected consumers. Daily shows up to 30 calendar days, including verified zeros, and compares only an actual adjacent prior day. 7d and 30d require complete consecutive calendar windows; comparisons require two complete adjacent windows. Monthly displays partial months but compares only adjacent complete calendar months. Engagement Rate uses `sum(engaged sessions) / sum(sessions)`, not an average of daily percentages. Users is selectable only in Daily because daily distinct users are not additive. A percentage change with a zero prior baseline is withheld.

## Passes

| Required gate | Evidence |
|---|---|
| Exact deployed revision and ownership | `/api/health` returned `757cfc5926d59dbae4addd0a4d4a0531f675f3f7`. An authenticated owner received the selected campaign/property responses. Unauthenticated coverage was denied; an authenticated non-owner received 404 from both daily and coverage routes on this revision. |
| Campaign/property and reporting time | Read-only campaign/connection inventory and both live API responses agreed on property `542352127` and `Europe/Amsterdam`. The current campaign's Trends display began on its 2026-09-08 creation date, although its stored 60-day response contained earlier history. The latest completed day was 2026-09-16; the Sep 17 intraday day was excluded. |
| Sparse rows and valid zero | For the current campaign, 13 stored rows matched GA4-verified daily rows and the coverage response supplied 26 verified no-match dates. The visible Daily span contained 9 completed dates, including verified zero Sessions on Sep 8 and Sep 11. No absent date was inferred to be zero without verification. |
| Values and comparisons | Independent live browser/API/database checks passed 16 chart-series configurations for the current campaign and 21 for the older campaign, including a populated 30d chart. Daily and Monthly table values, eligible rolling totals, weighted Engagement Rate, and unavailable adjacent comparisons matched independent calendar calculations. September's current-campaign Sessions total was 283 from Sep 8–16; the Overview 496 includes 213 Sessions from before campaign creation and is outside this Trends window. |
| Monthly positive comparison | A browser-only intercepted fixture with complete adjacent January and February 2027 months displayed totals 62 and 112 with +80.6% change. The live September month remained partial and was not compared. The fixture did not write app data. |
| Refresh, failure states, and persistence | Exact-runtime daily response said no provider refresh was attempted by the read-only request. Browser-only intercepted failure cases showed unverified dates as gaps, labeled stale last-good history, and withheld unavailable history. Database fingerprints before and after live checks were identical. Scheduler health showed GA4 daily timer started, scheduled, idle, and not in progress; no manual run or settings change occurred. |
| UI stability | On the exact deployed revision, opening and changing the Trends metric selector preserved its screen position and horizontal/vertical scroll coordinates at 1440×900 and 390×844 viewports. |
| Local gates | Six focused Trends and adjacent regression files passed (81 tests). `npm run check`, `npm run build`, and `git diff --check` passed on the deployed source revision. |

## Failures

**None open within the certified Trends boundary.** The first exact-runtime non-owner check encountered a transient Clerk sign-in timeout before reaching either app API. Its retry completed and both routes returned 404. The prior deployed selector had a mobile horizontal jump; the current exact-runtime selector check passed at both tested viewport sizes.

## Unverified or excluded paths

- The unchanged GA4 daily scheduler has not naturally fired on this exact commit. Its timer is active and idle; this certificate does not claim an exact-commit natural scheduler run or all-campaign scheduler success. The ongoing scheduler validation was not interrupted.
- A future GA4 provider outage or newly divergent stored/provider data was not induced in production. Browser failure fixtures and focused regressions establish the fail-closed presentation behavior for those cases.
- Reports/PDF Trends, other Insights sections, protected sections, arbitrary properties, and the overall mobile page layout were not recertified here. At a 390px viewport the existing page can still scroll horizontally, although changing this Trends selector did not move the card or alter scroll position.

This file is a Trends-only certificate. It does not update the master readiness ledger or certify downstream sections.
