# GA4 Insights Production Readiness

## Controlling Current Status

<!-- ga4-insights-current-status -->
<!-- ga4-insights-certification-status: UNVERIFIED -->

Status: **UNVERIFIED**

Audit baseline SHA: `231afeb141d7c25caf1ca4a99144d651c70ddcfd`

Certified SHA: none

Deployed correction SHA: `e34514c289cc353a4730d41cdd11ef9ca5fea29c`

Reason: the strict live-tab audit found and corrected ten Major value-path defects. The exact correction SHA is deployed; authenticated owner API/UI parity and deterministic scheduler validation pass. Production contains only one Clerk user, so a real authenticated non-owner request cannot be executed without explicit authority to create and delete an ephemeral production identity. That tenant-isolation gate and final dependency hashes remain pending. Historical readiness wording is invalidated and is not evidence.

No Critical finding is open. No clean certification may be issued while any Major finding below is open or any production gate remains pending.

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
| Trends | Sessions, Users in Daily only, Conversions, Revenue, Page Views, Engagement Rate; Daily, 7d, 30d, Monthly; cutoff/import/refresh/timezone labels | isolated 60-day `ga4-daily` response for the selected property; completed campaign-reporting days; shared calendar rollups; session-weighted engagement; prior-calendar-day deltas; partial/incomplete month labeling |
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

All ten Major findings invalidate every earlier whole-tab readiness claim. Their fixes pass locally and on the deployed owner path; no Major finding remains open.

### Minor

1. Some legacy mixed Insights regression files also assert Reports output. They may run as repository-wide compatibility checks, but those assertions are not Insights certification evidence.
2. The daily table previously said vs prior while comparing the prior returned row. It now requires the actual prior calendar day.
3. The first production validator compared API Sessions with the DOM before the isolated 60-day request reached its stable state. The validator now captures the exact page response and waits for the completed-day summary before comparison.
4. The initial tenant fixture selected stale campaign owner IDs. The validator now checks Clerk's authoritative user inventory and fails explicitly when no second identity exists; owner-only evidence mode records tenant isolation as not run and cannot satisfy that gate.

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
| focused live Insights and affected UI/timezone suite | PASS: 11 files, 83 tests |
| auth, isolation, source, parity, lifecycle, scheduler-consumer suite | PASS: 13 files, 298 tests |
| focused production calendar/monthly functions | PASS: 5 tests |
| TypeScript | PASS: `npm run check` |
| production build | PASS: Vite 3,466 modules and server bundle |
| machine certification checker | PASS: 5 gate tests and repository checker |

Source-text assertions are structural evidence only. Numeric calendar and monthly correctness is exercised through the actual shared functions imported by the live page.

## Production Evidence

| Gate | Result |
|---|---|
| exact Render revision | PASS: health reported `e34514c289cc353a4730d41cdd11ef9ca5fea29c` |
| authenticated owner API/UI parity | PASS: property `542352127`, `Europe/Amsterdam`, three saved filters, exact daily/breakdown windows, and API-derived 655 Sessions rendered |
| incomplete-history state | PASS: 20/30 imported days remained incomplete and was not certified as a complete comparison window |
| deterministic scheduler | PASS: campaign-scoped manual trigger finished successfully at `2026-08-03T22:38:04.238Z`; global alerts were suppressed |
| production identity inventory | BLOCKED: Clerk returned exactly one user, the campaign owner; tenant denial is not inferred from local tests |

## Required Production Gates

The machine record must remain `UNVERIFIED` until all are recorded against one unchanged revision. Gates 1-4 and 6-8 pass for the deployed correction SHA; gates 5 and 9 remain open:

1. production build passes
2. machine certification checker passes
3. focused commits are pushed
4. Render health identifies the exact reviewed revision
5. authenticated non-owner access fails closed
6. authenticated owner APIs prove campaign/property/filter/window/source parity
7. live browser values and states match those API responses
8. the deterministic campaign-scoped daily pipeline completes and the post-run live inputs remain in parity
9. dependency/configuration hashes match the reviewed boundary

Only after all nine gates pass with no Critical or Major issue may the status marker and machine record change to `PRODUCTION_READY`.

## Historical Note

Earlier documents described bounded copy, grouping, visual, and report-parity work. Those statements are historical only and were invalidated by this audit. Reports-owned behavior is intentionally absent from the current Insights status and evidence boundary.
