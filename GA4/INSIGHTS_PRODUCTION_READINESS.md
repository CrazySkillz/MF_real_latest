# GA4 Insights Production Readiness

## Controlling Current Status

<!-- ga4-insights-current-status -->
<!-- ga4-insights-certification-status: PRODUCTION_READY -->

Status: **PRODUCTION_READY**

Audit baseline and deployed SHA: `deb368b16d7bd970a3f19dbac634eed199227b22`

Certified SHA: `a158229e20b5416395f32395bd2e14039c765db8`

Deployed SHA: `a158229e20b5416395f32395bd2e14039c765db8`

Reason: all twelve current-audit Major findings are fixed, the full dependency/configuration boundary is frozen, local gates pass, Render health reports the exact certified SHA, authenticated owner API/UI parity passes for every live surface and Trends metric, the authorized Clerk-only non-owner request fails closed with 404 and is cleaned up, the deterministic campaign-scoped scheduler passes, and owner parity passes again after recompute.

No Critical or Major finding remains open. This certification applies only to the exact SHA and frozen boundary recorded here; any relevant dependency or configuration change invalidates it immediately.

<!-- /ga4-insights-current-status -->

## Certification Boundary

Included:

- the live GA4 Insights tab in `client/src/pages/ga4-metrics.tsx`
- Executive Financials
- Trends
- Data Summary
- the three tracker cards
- What to investigate next
- only the GA4 daily, breakdown, to-date, financial-source, KPI, and Benchmark paths that directly supply those rendered values
- the campaign-scoped GA4 daily pipeline only because it directly updates daily history and KPI/Benchmark context consumed by the live tab
- authentication, tenant, client, campaign, property, saved-filter, reporting-timezone, persistence, and source-lifecycle boundaries for those inputs

Excluded from this certification:

- Reports
- downloaded or scheduled PDFs
- report snapshots or libraries
- report schedulers
- report email generation or delivery
- unrelated GA4 tabs, except a shared producer whose value is rendered by live Insights
- alerts and notifications

The excluded items are outside the Insights certification definition. They are not deferred Insights validation and do not qualify or limit a future clean live-tab certification.

## Finite Validation Plan

1. Freeze the revision, dirty-worktree boundary, and live-tab scope.
2. Inventory every visible value, state, source, transform, API, storage call, and direct consumer.
3. Trace auth, ownership, client/campaign/property/filter scope and completed-day windows.
4. Exercise actual production calculations for calendar rollups and monthly values.
5. Classify every finding; invalidate earlier claims; fix all Critical and Major findings with minimal changes.
6. Run focused, shared, auth, isolation, source, scheduler-consumer, type, build, and machine-gate evidence.
7. Commit only the focused boundary, push, confirm the exact Render revision, and run deterministic deployed scheduler validation.
8. Run authenticated read-only API/UI parity and record dependency hashes before changing status.

This plan is finite. Certification stops at the live-tab boundary above.

## Complete Visible Value Inventory

| Surface | Visible values | Authoritative live inputs and transforms |
|---|---|---|
| Executive Financials | Spend, Revenue, Profit, ROAS, ROI, source labels, loading/unavailable/not-connected/last-good state | GA4-context spend sources and totals; native GA4 to-date totals; GA4-context imported revenue; fixed native-source precedence; Revenue = native + imported; Profit = Revenue - Spend; ROAS = Revenue / Spend only when Spend > 0; ROI uses shared metric math only when Spend > 0 |
| Trends | Sessions, Users in Daily only, Conversions, Revenue, Page Views, Engagement Rate; Daily, 7d, 30d, Monthly; cutoff/import/refresh/timezone labels | isolated 60-day `ga4-daily` response for the selected property; completed campaign-reporting days; exact 30-calendar-day Daily chart with null gaps; shared calendar rollups; session-weighted engagement preserving explicit zero engaged sessions; prior-calendar-day deltas; partial/incomplete month labeling |
| Data Summary | 30-day Sessions, Conversions, conversion rate, total Revenue, Top Channel, Spend, Profit, ROAS, CPA, channel Sessions/Share/Conversions/CR | exact last 30 calendar days from the isolated daily response; the same financial totals as Executive Financials; raw 30-day GA4 acquisition breakdown for selected property/filter; no proportional allocation |
| Tracker cards | Total insights, High priority, Needs attention | full generated finding list before the visible finding cap |
| What to investigate next | grouped finding title, description, recommended check, severity, basis, confidence, hidden count | financial integrity rules; eligible KPI/Benchmark values and snapshot analytics; complete 3-day or 7-day calendar comparisons; raw channel context; explicit unavailable/stale/configuration findings |

## End-To-End Path Matrix

### Daily and trend values

`campaign reporting timezone + selected property + saved ga4CampaignFilter`
-> authenticated `GET /api/campaigns/:id/ga4-daily?days=60&propertyId=...`
-> campaign/property connection lookup
-> GA4 provider refresh when due
-> `ga4_daily_metrics` upsert/read by campaign, property, and date
-> response cutoff/freshness metadata
-> property identity check
-> `normalizeGA4InsightsDailyRows`
-> `buildGA4InsightsRollups`, `buildGA4InsightsCalendarRollup`, or `buildGA4InsightsMonthlySeries`
-> Trends, Data Summary, tracker inputs, and trend findings.

Daily charts iterate the exact 30 calendar dates ending at `dataThroughDate`; missing rows become `null` gaps and are not connected. Rollups use persisted `engagedSessions` whenever present, including zero, and derive it from that row's normalized engagement rate only for legacy absence.

### Channel values

`campaign + selected property + saved ga4CampaignFilter + 30 completed campaign-reporting days`
-> authenticated `GET /api/campaigns/:id/ga4-breakdown`
-> complete paginated GA4 provider response
-> raw source/medium aggregation
-> Top Channel, channel shares, channel table, and channel context in findings.

No channel row is scaled, allocated, or reconciled to a different total.

### Financial values

- native: authenticated `ga4-to-date` with the selected property, saved filter, campaign start, and latest completed campaign-reporting day
- imported revenue: campaign-owned GA4-context revenue source definitions and materialized totals
- spend: campaign-owned GA4-context spend source definitions and materialized totals
- client transform: fixed native precedence, additive imported revenue, then shared Profit/ROAS/ROI/CPA math

Initial failures render unavailable. Cached failures render last-good state. A configured zero remains a numeric zero. Missing source configuration is not presented as numeric zero for a derived denominator metric.

### KPI and Benchmark context

Authenticated campaign/platform lists
-> campaign-owned KPI or Benchmark rows
-> shared live-value resolver and consumer-state eligibility
-> authenticated per-row analytics history
-> configuration, target, streak, volatility, and performance findings.

An analytics request failure produces an integrity finding. It is not converted into scheduler-no-history copy.

## Scope, Auth, And Tenant Contract

- every browser route in scope requires authentication
- every campaign route calls campaign access validation before provider or storage work
- KPI and Benchmark analytics require item access and inherit the item campaign boundary
- property reads resolve a connection belonging to the same campaign
- daily storage keys include campaign, property, and date
- financial source reads are campaign-owned and GA4-platform-context scoped
- the saved GA4 campaign filter is passed to daily, breakdown, and to-date provider queries
- the isolated Trends response must return the selected property ID or it fails closed
- previous-property placeholder rows are not used by live Insights financial or recommendation paths

## State And Misleading-Guidance Contract

| State | Required live behavior |
|---|---|
| loading | stable skeleton or existing unaffected content; no inferred zero |
| valid zero | render numeric zero when the source response/configuration proves availability |
| not connected | show Not connected and block denominator-dependent metrics |
| unavailable/failed | show unavailable and withhold affected comparisons/recommendations |
| stale/last-good | label last-good state; withhold trend recommendations until refresh succeeds |
| insufficient data | show exact missing calendar coverage; do not widen the window |
| blocked configuration | show setup/configuration finding before performance guidance |
| partial/incomplete month | label partial and do not compare it with a full month |

## Findings

### Critical

None found.

### Major

Current audit findings, resolved and production-validated on `a158229e20b5416395f32395bd2e14039c765db8`:

1. **Sparse daily history was still described as a fixed row-count requirement outside the Trends card.** Root cause: `What to investigate next` used total rows in the 60-day response as completed-day history. Path: isolated daily response -> rollups -> action intro and short-window findings. Fix: every live explanation now reports the exact current/prior calendar ranges, imported-day coverage, and total imported rows.
2. **A property switch could retain channel analysis from the prior property.** Root cause: the channel-analysis memo omitted the placeholder/property-transition dependency. Path: selected property -> cached breakdown -> channel analysis -> Data Summary and findings. Fix: invalidate the memo on placeholder transition.
3. **A failed channel refresh could still drive recommendations.** Root cause: cached channel rows remained eligible for KPI, Benchmark, anomaly, and top-channel guidance. Path: breakdown error with last-good response -> channel analysis -> finding text. Fix: keep labeled last-good values visible but use a fail-closed recommendation-only channel input.
4. **Financial integrity findings could remain stale after source or to-date state changed.** Root cause: the findings memo omitted to-date error and financial availability dependencies. Path: GA4/imported revenue/spend queries -> availability flags -> findings. Fix: add every directly consumed dependency.
5. **Cached Data Summary values lacked local stale/unavailable labels.** Root cause: only the financial header exposed some refresh failures. Path: daily, breakdown, and financial query cache -> Data Summary. Fix: add explicit daily, channel, and financial unavailable/last-good messages while preserving verified zero.
6. **The Daily chart altered observed history.** Root cause: leading verified zero rows were trimmed and missing calendar dates were compressed between returned rows. Path: normalized daily rows -> Daily chart. Fix: preserve zero, render exactly 30 calendar dates through the completed-day cutoff, insert `null` for missing dates, and disable line connection across gaps.
7. **The production validator did not prove chart-series parity.** Root cause: it checked table text but not the Recharts input series. Path: page-consumed API response -> chart transform -> rendered chart. Fix: expose the chart series as read-only test metadata and compare Daily, 7d, 30d, and Monthly series against the actual shared production functions.
8. **An initial GA4 to-date failure could substitute a 30-day daily/breakdown value for lifetime financials.** Root cause: the native financial consumer state accepted fallback responses with different windows. Path: failed `ga4-to-date` -> daily/breakdown fallback -> Executive Financials, Data Summary, CPA, KPI/Benchmark inputs, and findings. Fix: lifetime Insights availability now requires the actual selected-property `ga4-to-date` response; failure is unavailable and cached failure is stale.
9. **Loading or failed source requests could be mislabeled as not connected.** Root cause: absence was inferred before both spend and revenue definition/input states were ready. Path: source query state -> missing-source findings and financial cards. Fix: emit Not connected only after ready source states prove absence; otherwise render unavailable/loading.
10. **A cached GA4 to-date failure was described as fully unavailable.** Root cause: the finding did not distinguish no response from a last-good cached response. Path: query cache/error -> financial integrity finding. Fix: distinct unavailable and stale finding IDs, severity, basis, confidence, and copy; performance conclusions remain withheld.
11. **Explicit zero engaged sessions could become nonzero.** Root cause: the shared rollup treated `engagedSessions > 0` as presence and derived `sessions × engagementRate` for explicit zero. Path: persisted daily row -> daily API -> shared normalization/rollup/monthly series -> visible Engagement Rate and findings. Fix: preserve null versus zero and derive only when the value is genuinely absent.
12. **A mixed native/imported revenue provenance finding could use unready inputs.** Root cause: the informational finding checked cached values but not the combined revenue input state. Path: to-date/imported revenue cache -> provenance finding. Fix: require a fully ready combined revenue state.

All twelve are Major because each could change a visible value, state, comparison, provenance assertion, or recommendation, or leave that output unproved. Local and deployed evidence is recorded below.

Historical remediated findings from the `d6a82a79e11e043154d993e439898c2645871cc9` audit:

1. **Thirty-day Trends could never pass its own history gate.** Root cause: the live tab fetched 30 days but required 60. Path: daily route -> client query -> 30d chart/table. Fix: isolated 60-day Insights query.
2. **Missing dates widened rolling periods.** Root cause: rollups sliced the last N returned rows. Path: persisted rows -> rollups -> charts/tables/findings. Fix: shared exact calendar-window production functions and completeness flags.
3. **A property switch could render previous-property last-good rows.** Root cause: shared daily placeholder data was accepted in financial and KPI inputs. Fix: isolated non-placeholder Insights query, response property assertion, and fail-closed placeholder gates.
4. **Channel rows were invented by proportional allocation.** Root cause: raw breakdown rows were scaled to another total. Path: breakdown -> Data Summary channel table. Fix: raw rows and shares only.
5. **Executive Financials conflated unavailable/not-connected with zero.** Root cause: unconditional zero formatting. Fix: explicit loading, unavailable, not-connected, valid-zero, and last-good rendering; denominator-dependent metrics show no numeric result when Spend is zero/unavailable.
6. **Daily-history failures looked like insufficient history and could still support recommendations.** Root cause: no explicit failed/stale recommendation gate. Fix: integrity findings, unavailable UI, stale label, and trend-recommendation withholding.
7. **KPI/Benchmark analytics failures looked like a scheduler with no history.** Root cause: non-OK responses returned null. Fix: errors remain errors and generate an integrity finding.
8. **Monthly comparisons used UTC current-month identity and compared partial with full periods.** Root cause: browser UTC month plus unconditional delta. Fix: campaign cutoff month, completeness metadata, and non-comparable partial/incomplete rows.
9. **GA4 to-date and channel inputs used UTC/provider-relative yesterday.** Root cause: direct UTC and relative-date cutoffs. Fix: explicit campaign-reporting-timezone completed-day windows.
10. **Data Summary hid verified zero and omitted failure state.** Root cause: positive-value render guards. Fix: stable card, exact window label, verified zero display, and unavailable message.

Those ten historical Major findings were remediated and validated for `d6a82a79e11e043154d993e439898c2645871cc9`. That evidence does not certify the current revision or clear the current production finding above.

### Minor

1. An unreachable inner Trends fallback repeated the obsolete raw 14/60-row requirement. It was removed so no contradictory implementation text remains.
2. Daily insufficient-history copy called returned records days. It now says imported daily rows.
3. Unavailable Profit/ROAS values could inherit positive or negative color from hidden arithmetic. Unavailable values now use neutral styling.

Historical Minor corrections for prior-calendar-day Daily deltas, validator timing, temporary Clerk-user selection and cleanup, Shopify label precedence, and channel table shape remain preserved in the regression boundary.

No Minor finding changes a visible numeric result after the fixes above.

## Persistence, Refresh, And Destructive Safety

- the live tab itself performs no delete or destructive write
- daily provider refreshes upsert only the authorized campaign/property/date rows
- imported source add/edit/delete/refresh paths recompute only the owning campaign and GA4 platform context
- source deletion can change live financial values but cannot broaden to another campaign or platform
- the campaign-scoped deterministic scheduler trigger runs the deployed daily refresh plus KPI/Benchmark recompute for only the authorized campaign and suppresses the global alert sweep
- a timer status alone is not a successful value refresh

Existing damaged-data cleanup is not authorized by this audit. No cleanup is required for the removed client-only channel allocation because it was not persisted.

## Local Evidence

| Gate | Result |
|---|---|
| focused live Insights and affected UI/timezone suite | PASS: 11 files, 91 tests |
| affected auth, isolation, source, parity, lifecycle, and scheduler-consumer suite | PASS: 13 files, 110 tests; source-safety subsets separately PASS: revenue 12, spend 9, GA4 scope 2 |
| focused production calendar/monthly functions | PASS: 8 tests, including the reported 21-row sparse-date fixture, every visible rollup metric, and explicit-zero versus absent engaged sessions |
| TypeScript | PASS: `npm run check` |
| production build | PASS: Vite 3,466 modules and server bundle |
| machine certification checker | PASS: the frozen boundary is internally consistent and machine status remains `UNVERIFIED` |

Source-text assertions are structural evidence only. Numeric calendar and monthly correctness is exercised through the actual shared functions imported by the live page.

Separate repository result: the complete `server/source-safety-regression.test.ts` file currently reports 80 passed and 7 failed, and all seven failures are Instagram route-extraction assertions. The in-scope revenue, spend, and GA4 subsets pass independently as recorded above. The Instagram failures neither execute nor supply a value to live GA4 Insights and are not Insights findings, limitations, or deferred Insights work.

## Current Production Certification Evidence — `a158229e20b5416395f32395bd2e14039c765db8`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `a158229e20b5416395f32395bd2e14039c765db8` |
| authenticated owner API/UI parity | PASS: selected property `542352127`, `Europe/Amsterdam`, USD, three saved filters, 21 daily rows, 15 breakdown rows, five financial values, eight Data Summary values, three raw channel rows, tracker values, 12 visible findings, and three hidden findings matched the exact page-consumed inputs |
| every Trends metric and surface | PASS: Daily selected Sessions, Users, Conversions, Revenue, Page Views, and Engagement Rate; 7d/30d exact incomplete-window states passed; Monthly selected every eligible metric; every visible table row and chart series matched production functions |
| tenant isolation and cleanup | PASS: one authorized ephemeral Clerk-only non-owner received 404; its session was revoked, the exact user was deleted, and cleanup completed before success |
| deterministic scheduler | PASS: campaign-scoped manual run completed at `2026-08-05T19:04:33.463Z`, alerts were suppressed, property/timezone/cutoff stayed exact, and rows remained 21 |
| post-scheduler parity | PASS: owner-only read-only parity passed again with temporary-user creation disabled and unchanged scoped values |
| persistence safety | PASS: parity transactions were read-only and rolled back; only the authorized campaign-scoped daily refresh and direct KPI/Benchmark recompute mutated live inputs |

## Current Production Correction Evidence — `2a2dab20071bf4c2f7deb4362678151a98fc9b66`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `2a2dab20071bf4c2f7deb4362678151a98fc9b66` |
| authenticated owner API/UI parity | PASS: property `542352127`, `Europe/Amsterdam`, USD, three saved filters, 21 daily rows, and four Trends modes matched the exact page-consumed response |
| sparse 7-day coverage | PASS: the deployed surface withheld comparison and reported the exact incomplete current/prior calendar windows rather than treating 21 scattered response rows as complete history |
| authenticated non-owner isolation | PASS: an authorized ephemeral Clerk-only user received 404 from the campaign daily endpoint |
| temporary identity cleanup | PASS: validation sessions were revoked, the exact temporary user was deleted, and the validator emitted success only after cleanup |
| deterministic scheduler | PASS: campaign-scoped manual trigger completed at `2026-08-05T17:39:58.341Z`; alerts were suppressed and rows remained 21 before/after |
| post-scheduler parity | PASS: the authenticated owner packet passed again with unchanged scoped values |
| database safety | PASS: read-only validation transaction was rolled back; only the explicitly authorized campaign scheduler refresh mutated analytics inputs |

These results clear the reported defect but do not, by themselves, re-certify the later whole-tab dependency boundary.

## Historical Production Evidence — `d6a82a79e11e043154d993e439898c2645871cc9`

The following packet is historical and cannot validate the corrected revision:

| Gate | Result |
|---|---|
| exact Render revision | PASS: health reported `d6a82a79e11e043154d993e439898c2645871cc9` |
| authenticated owner API/UI parity | PASS: property `542352127`, `Europe/Amsterdam`, USD, three saved filters, exact 60-day daily and 30-day breakdown windows, and page-consumed response parity |
| incomplete-history state | PASS: 20/30 imported days remained incomplete and was not certified as a complete comparison window |
| authenticated non-owner isolation | PASS: an explicitly authorized ephemeral Clerk-only user received 404 from the campaign daily endpoint |
| temporary identity cleanup | PASS: both validation sessions were revoked, the exact user was deleted, its lookup returned 404, and independent inventory returned to one user |
| deterministic scheduler | PASS: campaign-scoped manual trigger finished successfully at `2026-08-04T04:03:42.140Z`; global alerts were suppressed; rows remained 20 before/after |
| post-scheduler parity | PASS: the complete authenticated owner packet passed again after recompute with unchanged scoped values |
| every-surface numeric UI/API parity | PASS: 5 Executive Financial values, source provenance, 8 Data Summary values, 3 raw channel rows, 4 Trends modes, 3 tracker values, and all 12 visible findings across id/category/severity/title/description/recommendation/basis/confidence matched the exact live-page inputs |

## Required Production Gates For A New Certification

The machine record remains `UNVERIFIED`. A future revision may be certified only after all of these gates pass on one frozen dependency/configuration boundary:

1. production build passes
2. machine certification checker passes
3. focused commits are pushed
4. Render health identifies the exact reviewed revision
5. authenticated non-owner access fails closed
6. authenticated owner APIs prove campaign/property/filter/window/source parity
7. live browser values and states match those API responses
8. the deterministic campaign-scoped daily pipeline completes and the post-run live inputs remain in parity
9. dependency/configuration hashes match the reviewed boundary

The earlier `d6a82a79e11e043154d993e439898c2645871cc9` `PRODUCTION_READY` record is historical and invalid for the current tree. It cannot be carried forward without fresh evidence.

## Historical Note

Earlier documents described bounded copy, grouping, visual, and report-parity work. Those statements are historical only and were invalidated by this audit. Reports-owned behavior is intentionally absent from the current Insights status and evidence boundary.
