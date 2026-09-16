# GA4 Ad Comparison Chart and Summary Certification - 2026-09-16

## Certification decision

**CLEAN-CERTIFIED and production-ready only for the GA4 Ad Comparison metric
selector, Top Campaigns chart, selected-metric summary card, and Campaigns
Compared card described below.**

This is a narrow subsection certification. It does not certify the complete Ad
Comparison tab, GA4 Overview, All Campaigns, Revenue Breakdown, the Reports
feature, or any other existing certified section.

- certified deployed application boundary: `199ea4c64394a692ea4fc85fffd80ff6a74fe902`
- core chart/PDF parity implementation: `b1d6367fcf1f5ccb5098d94ee86d0b8094b63fce`
- validator-only cache correction: `7ee97aab1cd9e252a27361ed1d39d1ee83e35bbb`
- chart/summary scope isolation: `199ea4c64394a692ea4fc85fffd80ff6a74fe902`
- production health at the certified boundary: HTTP 200 with the exact full SHA
- certification date: 2026-09-16

The existing full-tab machine record remains `UNVERIFIED`. It has a broader
boundary that includes surfaces deliberately excluded from this review and is
not promoted by this subsection certification.

## Exact boundary

Included:

- the Ad Comparison metric dropdown
- the `Top Campaigns by <selected metric>` chart
- the chart title, subtitle, campaign labels, values, deterministic ordering,
  tooltips, and top-10 limit
- the selected-metric summary card
- the `Campaigns Compared` summary card
- the same chart-and-summary payload in the browser-generated and scheduled GA4
  PDF consumers
- the provider, API, transformation, refresh, cache, ownership, and formatting
  paths that supply those values

Excluded and not assessed as part of this result:

- GA4 Overview and its existing certification
- All Campaigns
- Revenue Breakdown
- leader cards
- every other Ad Comparison subsection
- Reports configuration, report library, snapshots, scheduling, email delivery,
  and the overall Reports/PDFs certification
- KPI, Benchmark, alert, and notification readiness
- `APP_PRODUCTION_READINESS.md`

PDF validation below establishes parity only for this chart-and-summary payload.
It does not certify Reports/PDFs as a feature.

## Production configuration reconciled

The reviewed production campaign is bound to:

- GA4 property `542352127`
- campaign reporting timezone `Europe/Amsterdam`
- saved initial-import start `2026-08-09`
- latest completed reporting day `2026-09-15`
- saved campaign scope consisting of `yesop_retargeting`,
  `yesop_paid_social`, and `yesop_email_nurture`

The window is resolved server-side from the saved connection boundary and the
campaign reporting timezone. It is not a rolling browser date range. The API
requires an explicit saved property and a non-empty saved campaign filter before
provider work begins.

## Complete value path

| Layer | Current path | Proven rule |
|---|---|---|
| Provider | `server/analytics.ts` -> `getAcquisitionBreakdown` | Uses the saved property, explicit start/end dates, exact saved campaign matching, complete pagination through provider `rowCount`, fractional conversions, and native GA4 `totalRevenue` with the existing `purchaseRevenue` compatibility fallback. Incomplete, changed, empty-required, oversized, or over-returned pagination fails closed. |
| API | `server/routes-oauth.ts` -> `GET /api/campaigns/:id/ga4-breakdown?window=import-to-date&propertyId=...` | Checks campaign ownership first; requires the property and saved campaign scope; resolves the exact active connection and initial-import-to-latest-completed-day window; returns provider rows without imported-revenue allocation. |
| Base transformation | `client/src/pages/ga4-metrics.tsx` -> `adComparisonBreakdownAgg` | Aggregates repeated provider dimension rows by their original exact campaign names. This preserves the pre-existing base rows consumed by excluded All Campaigns and Revenue Breakdown. |
| Chart/summary transformation | `client/src/pages/ga4-ad-comparison.tsx` -> `chartSummaryRows` | Case-folds only the chart/summary rows, coalesces case variants, recalculates conversion rate, and leaves the base rows unchanged. |
| Chart and cards | `client/src/pages/ga4-ad-comparison.tsx` | Applies the selected metric, deterministic descending sort, stable name tie-breaks, top-10 slicing, metric formatting, weighted overall conversion rate, and the de-duplicated campaign count. |
| Browser PDF | `client/src/pages/ga4-metrics.tsx` -> Ad Comparison PDF section | Builds a chart/summary-only case-folded set while retaining the original rows for excluded PDF subsections; uses the saved/selected allowlisted metric and matching ordering, top-10, totals, labels, and campaign count. |
| Scheduled PDF | `server/ga4-scheduled-report-pdf.ts` -> Ad Comparison PDF section | Resolves the same saved window and scope, fails closed when scope is missing, creates a chart/summary-only case-folded set, and preserves original rows for excluded PDF subsections. |

No alternate chart data path, proportional allocation, imported-revenue merge,
or unsaved-property fallback was found in the certified subsection.

## Selector and summary contract

| Selector option | Chart/card value | Ordering | Summary |
|---|---|---|---|
| Sessions (High to Low) | Sum of session rows per normalized campaign | Descending sessions, then deterministic campaign-name tie-break | `Total Sessions`: sum of all compared chart/summary rows |
| Users (High to Low) | Sum of user row counts per normalized campaign | Descending users, then deterministic campaign-name tie-break | `Total Users`: summed campaign-row counts; the UI tooltip and PDFs disclose that users are non-additive |
| Conversions (High to Low) | Fraction-preserving sum of conversions per normalized campaign | Descending conversions, then deterministic campaign-name tie-break | `Total Conversions`: fraction-preserving sum across compared rows |
| Revenue (High to Low) | Native GA4 row revenue only | Descending native revenue, then deterministic campaign-name tie-break | `GA4 Revenue (Imported to Date)`: native GA4 sum only |
| Conversion Rate (High to Low) | Per-campaign conversions / sessions x 100; zero only with a proven zero denominator | Descending calculated rate, then deterministic campaign-name tie-break | `Overall Conversion Rate`: total conversions / total sessions x 100, not an average of campaign percentages |

Every selector displays `Top Campaigns by <metric>` and `Up to 10 campaigns
sorted by <metric>`. Axis labels may be shortened after 30 characters, while
the tooltip retains the full campaign name. Chart data is limited to the first
10 deterministically sorted campaigns; summary totals and Campaigns Compared
use the complete de-duplicated chart/summary set.

`Campaigns Compared` is the case-insensitive normalized chart/summary campaign
count. Case variants cannot inflate it. A saved campaign with a valid zero row
is counted; a saved campaign with no provider row is not invented.

## Revenue boundary

Ranking, chart values, tooltips, and the selected-metric summary use native GA4
revenue only. Imported Shopify, HubSpot, CSV, Google Sheets, or other materialized
revenue is not added to a campaign row and cannot affect the Revenue ranking.

Imported revenue remains a separate provenance path owned by Revenue Breakdown,
which is explicitly outside this certification. The reviewed chart and PDF
consumer code reads Revenue from normalized GA4 acquisition rows.

## State, refresh, and isolation results

| Condition | Certified behavior |
|---|---|
| Exact matching | Only campaigns in the saved filter are admitted; comparisons use exact names and chart/summary case normalization without partial-name matching. |
| Pagination | Provider pages accumulate to the declared `rowCount`; ambiguous or incomplete pagination fails closed. |
| Duplicate rows | Repeated provider dimension rows aggregate by exact campaign name; chart/summary case variants then coalesce without changing excluded base-row consumers. |
| Valid zero | Zero remains zero, does not receive a fabricated positive PDF bar, and remains countable when the provider returned the campaign. |
| Verified empty | Renders the explicit no-campaign-data state rather than invented rows or totals. |
| Formatting | Revenue uses campaign currency formatting; conversion rate uses percentage formatting; conversions retain fractional values; names remain available in full tooltips. |
| Refresh | The query refetches on mount/focus/reconnect and on its interval using the same property/window key. |
| Cached last-good failure | A failed refresh may keep the last verified rows visible only with the explicit last-verified warning; an unverified initial failure renders unavailable instead of zero. |
| Missing property | Import-to-date API fails before provider work with `400 GA4_PROPERTY_SCOPE_REQUIRED`. |
| Missing saved campaigns | Import-to-date API fails before provider work with `409 GA4_CAMPAIGN_SCOPE_REQUIRED`. |
| Unsaved property | No matching active connection is returned; the request fails closed. |
| Unauthenticated request | Returns 401. |
| Cross-owner request | Campaign access fails closed without disclosing campaign data. |
| Excluded-surface isolation | A scheduled-PDF regression proves case variants collapse to two chart/summary campaigns while all three original rows remain in All Campaigns. Source guards prove the same separation in the live and browser-PDF consumers. |

## Current validation evidence

### Product and regression gates

- focused/affected Ad Comparison packet: 7 files / 174 tests passed at the
  final application boundary, covering provider filtering and pagination,
  accumulation, all selector metrics, UI rules, browser and scheduled PDF
  parity, zero/empty/failure states, ownership-sensitive routes, native revenue
  separation, and excluded-surface isolation
- TypeScript: `npm run check` passed
- production build: `npm run build` passed; 3,471 client modules and the server
  bundle completed successfully
- `git diff --check`: passed for the delivered changes
- production `/api/health`: HTTP 200 with exact application SHA
  `199ea4c64394a692ea4fc85fffd80ff6a74fe902`

### Current-version boundary

The exact final application boundary executed 2,035 tests: 1,991 passed and 44
failed. There are zero newly introduced or Ad Comparison chart/summary failures.

- 42 failures are declared non-blocking deferred platform work
- 2 failures are pre-existing repository-level KPI/readiness-record
  inconsistencies:
  - `server/app-production-readiness-ledger.test.ts`
  - `server/ga4-kpi-certification-gate.test.ts`

Those two failures concern the separate GA4 KPI certification and application
ledger. They existed on the untouched deployed baseline and are not converted
to passes, waived, reclassified, or edited by this certification. Therefore the
repository as a whole is **not** claimed to have an all-green readiness suite.
They do not alter the code or data path within this narrow subsection.

### Deployed reconciliation and delta carry-forward

The core implementation was authenticated against the deployed runtime before
the validator reached its mock-restoration race. Before that validator-only
failure, it proved the exact deployed SHA, owner-bound inventory, property,
saved campaign scope, import-to-date window, authenticated breakdown response,
native row aggregation, and separate materialized-revenue inventory. The
failure occurred after a mocked valid-zero response remained in the browser
query cache; it was not a product mismatch.

Commit `7ee97aab` changed only the read-only validator so restoration waits for
the exact live response. Commit `199ea4c6` then isolated case-variant aggregation
to the chart/summary consumers and added the excluded-surface regression. It did
not change the provider, API, saved property, campaign filter, ownership guard,
window resolver, or imported-revenue boundary. Production health returned exact
`199ea4c64394a692ea4fc85fffd80ff6a74fe902`. The authenticated provider/API
evidence therefore carries forward, while the final UI/PDF delta is covered by
the rerun 174-test packet, TypeScript, build, source trace, and exact deployment.

Historical evidence carries forward only where the relevant source/query is
unchanged and a current regression covers its invariant:

- ownership isolation carries because `ensureCampaignAccess` remains the route
  boundary and current route regressions pass
- exact campaign filtering and pagination carry because their provider code is
  current and the affected tests were rerun
- empty, zero, cached-last-good, selector, ordering, formatting, isolation, and
  PDF rules are supported by current deterministic tests rather than an old
  readiness statement

Two additional direct provider attempts were made with writes prohibited. Both
failed closed before contacting GA4 because the local environment could not
access a production OAuth credential. No access token was issued, refreshed,
or persisted; both temporary validators were removed. These attempts are not
counted as successful provider evidence.

## Browser and PDF evidence limit

Per the accepted validation approach, Playwright is not a certification gate.
No completed automated-browser run against `199ea4c6` is claimed. The current
selector, chart, card, cached-state, and PDF behavior is established through the
authenticated deployed API evidence, exact deployed source revision,
deterministic regression tests, TypeScript, build, and source-to-consumer trace.

This certification does not claim visual pixel parity, complete Reports UI
behavior, report delivery, or overall PDF certification. If an organization
requires a real-browser acceptance gate, that is an additional optional gate
and must be recorded separately without changing this evidence statement.

## Root-cause-confirmed changes

The corrections within this workstream were limited to:

- preserving fractional GA4 conversions rather than truncating them
- requiring saved property and campaign scope before import-to-date provider
  work
- deterministic descending order and name tie-breaks
- full campaign names in chart tooltips
- selected-metric parity across browser and scheduled PDF chart/summary output
- weighted overall conversion rate and accurate metric-specific labels
- native-only Revenue ranking and summary
- zero-safe PDF bars and non-additive Users disclosure
- validator cache restoration after mocked states
- case-insensitive duplicate handling isolated to chart/summary consumers so
  excluded All Campaigns and Revenue Breakdown retain their prior base rows

No change was made to GA4 Overview behavior, the application readiness ledger,
or an existing certification status. All Campaigns and Revenue Breakdown were
not validated; their pre-existing base-row inputs were restored and protected
only as an isolation invariant.

## Final no-overclaim statement

For the boundary explicitly listed as included, every provider/API,
transformation, calculation, state, ownership, and PDF-consumer rule has current
code evidence and focused regression coverage, with deployed authentication and
configuration evidence carried forward only across reviewed deltas.

The clean-certified result must not be shortened to “GA4 Ad Comparison is
certified” or “Reports/PDFs are certified.” The accurate reusable statement is:

> The GA4 Ad Comparison metric selector, Top Campaigns chart, selected-metric
> summary, Campaigns Compared card, and only their corresponding PDF payload are
> clean-certified at deployed application boundary `199ea4c6`; all other Ad
> Comparison and Reports surfaces retain their separate existing status.
