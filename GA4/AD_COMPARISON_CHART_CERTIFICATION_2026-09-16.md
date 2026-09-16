# GA4 Ad Comparison Chart and Summary Certification - 2026-09-16

## Current status amendment - Campaign2

**CLEAN-CERTIFIED for the Campaign2 metric dropdown, Top Campaigns chart,
three leader cards, two summary cards, and their matching PDF values at
deployed runtime `3013ec6b52a93eaca01cd14c538dd0a20f350fac`.** This is a
narrow subsection result for Client2 / Campaign2, property `542352127`, and
the two exact saved names `yesop_retargeti` and `yesop_email_nurture`. The
complete Ad Comparison tab and its machine record remain **UNVERIFIED**;
All Campaigns, Revenue Breakdown, Reports delivery, and other GA4 sections
are outside this certificate. The earlier decision below is historical.

On 2026-09-16, deployed revision `3013ec6b52a93eaca01cd14c538dd0a20f350fac`
created one authorized, draft, unscheduled Campaign2 GA4 custom report
(`abc09608-ef65-40c8-adc7-59fa23bd9565`) and manual snapshot
(`ceee23ae-6486-4c53-b5de-cb88d9e7ca5d`) through the authenticated report
API. Its downloaded 14,927-byte scheduled-builder PDF contained exactly
`yesop_retargeti` and `yesop_email_nurture`, excluded `yesop_retargeting`, and
showed the three ranking cards, Conversion Rate chart (100% and 0%), and
summary (16.7%, two campaigns). Card values were 77 key events/100.00% CR
for `yesop_retargeti`, 0.00% CR/385 sessions for `yesop_email_nurture`, and
USD 65,296.90 revenue on the highest-rate card. These agree with the current
authenticated Campaign2 API/UI values captured earlier on this deployed
revision. The report remained `draft` with scheduling disabled and zero send
events; no email was sent. The temporary validator's final assertion failed
only because it searched for title-case summary text while PDF extraction
returned uppercase headings. Its recorded PDF text proves both headings are
present. No GA4 retry was made. The snapshot PDF download route regenerates
GA4 output from live data; this check does not prove immutable historical
PDF bytes, a scheduled send, or email delivery. Three assertions still fail in
the separate application-ledger and GA4 KPI test files. They do not check or
change this narrow Ad Comparison value path; the repository as a whole is not
all-green.

At this same deployed revision, one authenticated Campaign2 Overview breakdown
response was replayed through the deployed Ad Comparison UI. Both exact saved
campaigns and all five dropdown metric orders, values, tooltips, and summary
cards passed; all three leader-card values matched that response. A separate
cross-owner request failed closed before provider access. Empty, valid-zero,
and stale states passed browser checks without GA4 calls. The scoped focused,
certification-gate, and scheduled-PDF regressions passed (123 tests), as did
TypeScript and the build. The full current-version run had 1,997/2,041 passing,
42 classified deferred failures, and the two unrelated failing test files
described above. The Ad Comparison-specific gates passed; this is not an
all-green repository claim or a full-tab certificate.

Current value contract for this narrow certificate: Sessions, Users (GA4
`totalUsers`), Key Events, and native session key event rate come from the
authenticated, saved-scope GA4 Overview Campaign Breakdown rows. Revenue is
that table's native GA4 revenue plus only exact campaign-mapped imported
revenue. The dropdown sorts those rows by the selected metric; the first
summary totals that metric (or session-weights the rate), and Campaigns
Compared counts the distinct compared names. Most Key Events ranks positive
key-event counts; Highest Conversion Rate ranks positive rates; Needs
Attention selects the lowest rate among campaigns meeting the implemented
session floor. Browser and scheduled PDF chart/card/summary consumers use
that same Overview-row path. The separate native Ad Comparison rows continue
to serve the excluded All Campaigns and Revenue Breakdown surfaces.

Campaign2 saves the two *distinct, exact* GA4 names `yesop_retargeti` and
`yesop_email_nurture`. Its one-bar screenshot exposed a missing-campaign case
that the earlier validator did not reject. The Ad Comparison-only API request
and scheduled-PDF input were changed at deployed commit
`60a72c95a9b50e43c29777ee884423e545ced394` to use the existing exact-UTM
reconstruction. Affected tests, TypeScript, and build passed, but the deployed
two-campaign result was **not** proven: the subsequent authenticated GA4 API
request failed with HTTP 500 caused by upstream GA4 HTTP 429
`RESOURCE_EXHAUSTED` (server-errors quota). A completed live provider/API/UI/PDF
reconciliation is required before this subsection can be certified again.
Neither saved campaign name was changed; KPI, Overview, All Campaigns, and
Revenue Breakdown were not recertified by this amendment.

At deployed revision `40c6b88a875c4b3fbb08858594811a477fa8873f`, one
authenticated Campaign2 request passed the read-only validator's exact saved
campaign row checks, but the browser check timed out before the chart rendered
and the validator did not record the row values. A subsequent single diagnostic
API request returned GA4 `429 RESOURCE_EXHAUSTED`; no further GA4 requests were
made. The 7-file focused packet passed (143 tests), TypeScript and build passed,
and the current-version run had 1,991/2,035 passing with two blocking
readiness-ledger/KPI-record failures and 42 classified deferred failures.
At that point, the two-campaign chart, cards, and PDF values were **UNVERIFIED**.

Subsequent authenticated read-only validation at the same deployed SHA returned
`yesop_retargeti` (76 sessions, 76 users, 76 conversions, $15,614.16 GA4
revenue) and `yesop_email_nurture` (384 sessions, 384 users, zero conversions
and revenue) for 2026-08-09 through 2026-09-15. The supplied Sessions screenshot
matches the two chart labels, five visible cards, 460 total sessions, and two
campaigns. A single later API response was replayed into the deployed UI:
all five selector options passed chart order, labels, tooltip values, and
selected-metric summary checks. The focused packet passed 104 tests, TypeScript
and build passed. Full certification remains **UNVERIFIED**: the live validator
stopped after those checks because no second-owner Clerk login was available,
so its ownership-isolation and browser-PDF gates did not run. The current-version
gate still has two blocking readiness-ledger/KPI-record failures and 42
classified deferred failures. No runtime fix was made.

A later visual audit found a gap in that validator: it skipped tooltip checks
for zero-valued bars. Recharts rendered the zero Conversion Rate bar for
`yesop_email_nurture` at zero width, leaving its 0% value invisible and
unhoverable. The same renderer affects its zero Conversions and Revenue. A
chart-only local fix now renders a visible formatted value label for every
campaign row, including zero. An isolated browser check using the authenticated
Campaign2 aggregate values passed all five dropdown choices, and the validator
now requires every value label. The post-fix focused packet passed 104 tests,
TypeScript and build passed; the current-version gate retained the same two
blocking failures and 42 deferred failures. The chart fix was deployed at
`089116b8c2160e6c0d3f5561c94a0c8140351560` and remains **UNCERTIFIED**.

At that deployed revision, one authenticated Campaign2 API response again
returned exactly the two saved campaigns and the values above. Replaying that
response through the deployed UI passed all five dropdown chart orders,
tooltips, visible value labels (including zero), summary cards, and ownership
checks. The integrated browser-PDF validator then failed because its own page
reload reset the selected metric to Sessions while it expected a Conversion
Rate PDF. A separate browser-PDF inspection, using the just-observed campaign
aggregates with GA4 calls intercepted, confirmed the Conversion Rate title,
both exact names, 100% and 0% campaign values, 16.5% overall rate, and count
two. The validator now reselects Conversion Rate after reload. It was not
rerun against GA4 to avoid another provider request. The current-version
blocking failures and scheduled-PDF live artifact gate keep certification
**UNVERIFIED**.

A separate value error was confirmed in the Conversions dropdown: the chart
used the generic number formatter, which rounds fractional GA4 conversions in
the visible bar labels, tooltips, and selected-metric total even while sorting
by the fractional number. The browser and scheduled PDF charts also rounded
these displayed values. Commit `b883e7688f77efb47e6bfb05e38ae3c3ab1b790e`
changes only these three Ad Comparison chart/summary formatters to retain up to
15 decimal places. A Vite-only browser fixture with independent asymmetric
values passed all five dropdown chart orders and totals, including 2.5, 1.25,
zero, and 3.75 total Conversions. The focused 109 tests, TypeScript, and build
passed. The current-version boundary remains 1,991/2,035 passed with the same
two unrelated blocking failures and 42 deferred failures. The observed
Campaign2 conversions are whole numbers, so this precision correction does
not change their displayed values. Current deployed reconciliation and the
scheduled-PDF artifact gate remain pending; status is **UNVERIFIED**.

A later local chart-only candidate removes the white bar-value labels and turns
off Recharts' 400 ms bar-width animation. On a dropdown change, that animation
interpolated widths from the previous metric, briefly drawing bars at values
that did not match the selected metric. A local browser fixture using the two
previously observed Campaign2 rows passed immediate bar order and width checks
for all five options; zero-valued campaign rows drew no bar. Focused tests (24), TypeScript,
and build passed. The current-version run remains 1,991/2,035 with the same two
blocking failures and 42 deferred failures. This candidate is not deployed;
current deployed reconciliation and PDF gates remain pending. **UNVERIFIED.**

The user clarified the chart contract: each dropdown and both summary cards
must use the values displayed in GA4 Overview's Campaign Breakdown table.
The current local candidate now takes Sessions, Users, Conversions, and rate
from that table's campaign rows; Revenue also includes its campaign-to-date
native GA4 amount plus exact matched imports. The chart and summary paths in
both PDFs use those same table rows. The separate native Ad Comparison query
continues to supply the excluded leader cards, All Campaigns, and Revenue
Breakdown. A local browser fixture passed all five dropdowns and the case where
native detail fails while the Overview-based chart remains available. The
focused chart/Overview/PDF packet passed 108 tests; TypeScript and production
build passed. The current-version run finished at 1,992/2,036 passed, with the
same two blocking readiness-ledger/KPI-record failures and 42 deferred failures.
The read-only live validator now targets the Overview query and checks exact
mapped revenue. Deployed Campaign2 values and PDF artifacts have not been
rechecked. **UNVERIFIED.**

Commit `82b4400b9662b369da46fa46e195cc41dab5e4f5` was pushed and confirmed
by production health. One authenticated Overview Campaign Breakdown API request
for the exact Campaign2 property/filter returned `yesop_retargeti` (76 sessions,
76 users, 76 conversions, $7,512.96 native campaign-start GA4 revenue) and
`yesop_email_nurture` (384 sessions, 384 users, zero conversions/revenue) for
2026-08-09 through 2026-09-15. These native revenue amounts exclude exact
mapped imports and are not the final Revenue dropdown values. The validator
replayed that response but timed out on its empty-state probe before chart/card
or browser-PDF reconciliation. No second GA4 request was made. **UNVERIFIED.**

The next local candidate extends the Overview Campaign Breakdown source to the
three leader cards. The shared ranking formulas are unchanged; the screen and
both PDF paths now select leaders from the same campaign values as the dropdown
chart. Scheduled PDFs also honor the selected metric for Best Performing and
skip the separate native Ad Comparison query when only leader cards are
included. A browser fixture with deliberately divergent Overview/native rows
confirmed all three card values for Sessions and Revenue. The focused card,
UI, chart, and scheduled-PDF packet passed 83 tests; a further leader-only PDF
test passed. TypeScript and build passed. The final current-version run had
1,993/2,037 passing, with the same two blocking readiness-ledger/KPI-record
failures and 42 deferred failures. Deployed card values and PDF
artifacts have not been reconciled. **UNVERIFIED.**

The leader-card fix was pushed at `0222d6b45cddc06d1dad9e18605a177b9ba99ac7`
and confirmed by production health. One authenticated Campaign2 Overview API
request returned exactly the two saved names for 2026-08-09 through 2026-09-15.
Their displayed Overview Campaign Breakdown values, including exact mapped
imports, were `yesop_retargeti`: 76 sessions, 76 users, 76 conversions,
$65,069.86 revenue; `yesop_email_nurture`: 384 sessions, 384 users, zero
conversions, $100 revenue. The same response was replayed into the deployed UI
while the separate native Ad Comparison response was deliberately changed.
All three leader cards matched the Overview rows for each of the five dropdown
metrics. This proves the deployed card source and values for that captured
response; unmocked UI refresh, current browser/scheduled PDFs, ownership
isolation, and the two blocking current-version gates remain unverified.
**UNVERIFIED.**

## Historical certification decision - superseded for Campaign2

At the recorded `199ea4c6` boundary, this decision was **CLEAN-CERTIFIED and
production-ready only for the GA4 Ad Comparison metric
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
