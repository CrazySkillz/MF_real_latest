# GA4 Overview Landing Pages correction — 2026-11-10

Status: local correction verified; deployment pending. User approved displaying the complete available Landing Pages period with clear date labels.

## Root causes and scope

- Promo had a frontend-only override that generated five pages from Summary percentages. The saved API rows and both PDF paths were empty. Remove that override; no persisted mock rows require cleanup.
- Native Landing Pages queried only `sessionCampaignName`. Property 542352127 has native landing rows whose campaigns are available through tagged page URLs instead. When the primary selection is empty, query the same `landingPagePlusQueryString`, `sessionSource`, `sessionMedium` dimensions with the existing exact saved-UTM filter.
- Keep campaign/property/date/limit boundaries, provider quality guards, authentication, scheduler ownership and row formulas. No database migration or financial calculation change.

## Evidence

Read-only independent Data API queries and the corrected application query agree for test campaign `d0f57209-8938-4dd2-9146-b836181c8a85` (Ads Connection Test), property 542352127, selected `yesop_brand_search` and `yesop_paid_social`, 2026-10-10 through 2026-11-09:

| Landing page | Source | Medium | Sessions | Users | Conversions | Conv. rate |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| /landing | (not set) | (not set) | 1,152 | 1,149 | 112 | 9.7% |

Source/Medium remain GA4's actual `(not set)` values. The application rate is 112 / 1152 × 100, rounded to one decimal. Revenue is not a Landing Pages column.

Promo (`b74f98af-ede9-47af-9b19-0720ebb4d2c0`) requests 2026-09-04 through 2026-11-09. GA4 reports a property history limit for the tagged native-landing query. Earlier diagnostic requests reported September 9; the exact application query at 09:38 UTC reports September 10. The correction follows the provider's declared date, rather than hardcoding either date, and accepts only a newly queried complete response. The actual application result is `/landing`, `(not set)` source and medium, 3,758 Sessions, 3,790 Users and 388 Conversions for 2026-09-10 through 2026-11-09. These match a separate direct query for that period. The original September 4 campaign boundary and Summary dates are unchanged.

The stored Landing Pages metadata records `historyLimited`, `requestedStartDate`, `startDate`, and `endDate` only when the available period is shorter. UI, browser PDF and scheduled PDF label those dates. Source verification compares both the row values and these dates. Invalid/out-of-range provider dates, non-property truncation, combined quality issues, and a still-incomplete retry remain errors; truncated values are never published.

## Traced paths and validation

- `server/analytics.ts` → scheduler `getLandingPagesReport` → atomic Overview snapshot in storage → campaign-access-guarded `/ga4-landing-pages?window=import-to-date` → Overview table.
- Browser PDF and scheduled PDF consume actual Landing Pages rows, preserve the six columns, first 20 rows, fractional conversions and conversions/sessions rate.
- Source verification compares stored rows with a fresh scoped provider query. A failed/partial provider query is unverified, not a successful empty match.
- Focused validation: 289 distinct tests passed across Landing Pages regression (22), scheduled PDF (2), GA4 filters (39), Overview scheduler snapshot (5), source verification (24), provider quality/concurrency (76), and browser report publication (121). These cover a complete retry, a still-incomplete retry, date/quality rejection, scope preservation, and actual PDF rows/date labels. TypeScript passed after the final changes; the prior base correction built successfully, and the final release build remains required.
- Test-app deployment/UI verification, monitor deployment parity and live release remain outstanding. No production data or configuration has been changed by this work.
