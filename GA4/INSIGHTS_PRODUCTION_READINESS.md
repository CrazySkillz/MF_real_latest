# GA4 Insights Production Readiness

2026-08-28 revalidation: the authoritative machine record certifies deployed runtime boundary `4be16c54c550a45dbf3104313c820ea47b453604`. Focused, current-version, TypeScript, build, exact-health, authenticated-owner, tenant-isolation, and deployed read-only Insights checks passed. Older narrative SHA references below are revision-specific history where they differ.

## Controlling Current Status

<!-- ga4-insights-current-status -->
<!-- ga4-insights-certification-status: PRODUCTION_READY -->

Section status: **PRODUCTION_READY** for certified live GA4 Insights runtime boundary `4be16c54c550a45dbf3104313c820ea47b453604`.

Authenticated read-only value parity, expected-stale handling, tenant isolation, protected regressions, TypeScript, and the production build passed. The controlled rerun matched five Executive Financial values, three summary values, three channel rows, four trend modes, three tracker values, the visible findings, exact cumulative KPI/Benchmark inputs, and unchanged semantic persistence. Financial totals reconciled at Revenue `$72,766.69`, Spend `$2,699.75`, Profit `$70,066.94`, ROAS `26.9531`, ROI `2595.31%`, CPA `$10.76`, and `251` financial conversions. The temporary Clerk-only non-owner was deleted during cleanup.

<!-- /ga4-insights-current-status -->

Previous certified SHA: `09e3b64ed67fec70aa84f969a09aae1f368a4f02`. Its evidence is preserved in the machine record and below as historical revision-specific evidence; it does not certify the current boundary.

Previous certified configuration fingerprint: `f9106c79d9735b88cdc3adac06f435072810fb691486567256254006825d0be0`

Historical August 15 local validation: the protected boundary passed 44 files / 505 tests and TypeScript passed; production health then returned revision `7374e824ee625032cd6967f81edb22fb1001a15e`. The current controlling exact-SHA evidence is recorded above and in the machine record.

August 15, 2026 exact-SHA read-only validation on `e8a83b2a095700b715b08c80fca9f0c714026d93`: property `542352127`, `Europe/Amsterdam`, USD, three saved filters, five Executive Financial values, three summary values, three channel rows, four Trends modes, three tracker values, and five visible findings matched the page-consumed inputs. Financial totals reconciled at native revenue `$55,966.70`, imported revenue `$16,799.99`, total revenue `$72,766.69`, spend `$2,699.75`, profit `$70,066.94`, ROAS `26.9531`, ROI `2595.31%`, CPA `$10.76`, and `251` conversions. The read-only transaction rolled back and campaign-scoped persistence remained unchanged. The response correctly exposed the pre-target stale state: latest stored activity `2026-08-10`, data-through `2026-08-14`, no provider warning, and next configured natural target `2026-08-15T22:00:00.000Z`.

Natural scheduler carry-forward: on deployed scheduler-fix SHA `85f5233ebfc298afc35f4c24e0930c1a66fbd07c`, the timer fired naturally at `2026-08-14T20:35:00.001Z` and finished at `20:35:40.499Z`, after its temporary `20:35 UTC` target. All 22 retained daily rows carried scheduler-run timestamps, all 12 KPIs and both Benchmarks updated with zero skips or failures, and no later application repair occurred. The process-wide run still failed for 17 excluded obsolete campaigns, so no global scheduler-health claim is made.

Historical later-change classification through deployed `7374e824`: `950307b6`, `1a93d8d8`, and `3d762260` were legitimate KPI/Benchmark freshness-consumer and Notification changes; `7366051f`, `d6656e11`, `c6487555`, `ab26b36b`, and `e8a83b2a` were evidence/documentation changes; `7374e824` changed only Insights documentation, its machine record, and the certification checker/test. Twelve recorded Insights dependencies changed after `85f5233e`: five documentation files, three regression-test files, one non-runtime certification checker, and three runtime files confined to KPI/Benchmark freshness consumption and Notification visibility. None changed `server/ga4-daily-scheduler.ts`, `server/analytics.ts`, daily storage, reporting-timezone helpers, timer wiring, or scheduler configuration parsing. At that historical checkpoint, production health reconfirmed `UTC`, `22:00`, with GA4 startup refresh disabled.

Decision: the live GA4 Insights section is production-ready at the exact certified boundary above. Natural scheduler evidence is explicitly carried from `85f5233e` across byte-identical scheduler/producer/job files; no exact-`b8c73621` natural timer firing or global all-campaign scheduler-health claim is made. Reports-owned behavior remains separately certified.

August 12, 2026 exact-SHA re-verification: the KPI same-date history correction intentionally affects the history consumed by Insights, so this connection was not assumed unchanged. The authenticated production validator passed on deployed `ee22f0e470826f1cb247115497c9a15229d0142d`: all Executive Financials, Data Summary, channel, Daily/7d/30d/Monthly Trends, tracker, and visible finding values matched the scoped APIs; Daily rendered 111, 108, 106, and 103 on the exact imported dates with gaps elsewhere; tenant isolation failed closed; and campaign persistence remained unchanged. The campaign-scoped manual scheduler run succeeded with all 12 KPIs and both Benchmarks updated and none skipped/failed. The complete protected boundary passed 44 files / 496 tests; TypeScript and the production build passed. A natural timer firing on this SHA is not claimed.

## Certification Boundary

Included:

- the live GA4 Insights tab in `client/src/pages/ga4-metrics.tsx`
- Executive Financials
- Trends
- Data Summary
- the three tracker cards
- What to investigate next
- only the GA4 daily, breakdown, to-date, financial-source, KPI, and Benchmark paths that directly supply those rendered values
- real access-token GA4 properties; the built-in `yesop` simulation is test-only and is not certified as production analytics
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
- simulated/test-only GA4 properties such as `yesop`
- LinkedIn, Meta/Facebook, and Instagram platform connectors and analytics; they are not enabled as Insights inputs and explicit foreign platform contexts must not feed GA4 Insights
- Google Ads Insights values; no live test account is available, so Google Ads cannot supply a value certified by Insights. Overview chooser availability is separately owned and unchanged by this exclusion.

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

## Historical Commit Queue (completed or superseded)

Historical execution record: the earlier five-commit queue is complete or superseded. The final regression guard is `b273d2a9`; the deployed sparse-refresh correction and certification candidate is `80ffc60c`.

### Commit 1 - `fix(ga4): enforce the Insights release and OAuth boundary`

- derive separate GA4 and Google Sheets OAuth-state signing keys from the existing mandatory production token-encryption secret when an explicit provider state secret is absent; retain explicit-secret precedence and fail closed when no stable production secret exists
- prove with focused production-path tests that the derived GA4 and Sheets keys are stable, purpose-separated, and unavailable without the mandatory secret
- remove Google Ads from the live GA4 Insights source chooser and prevent it from being treated as a certified live Insights input in this release
- update the source-boundary documentation and machine dependency boundary without weakening foreign-platform fail-closed guards

Completion gate: focused OAuth, authentication, source-scope, chooser, and tenant-boundary regressions pass. No Render secret or Google Ads credential change is required for this release.

Local result: PASS - five focused production-path files, 79 tests, TypeScript, and production build. Production clearance remains pending Commit 3.

### Commit 2 - `fix(ga4): make native revenue currency scope provable`

- preserve the existing fail-closed no-conversion rule
- return a safe, explicit expected-versus-observed Data API response-currency mismatch so the exact currency of the rendered native value can be established without guessing
- add production-path tests covering matching currency, mismatching currency, unavailable currency, imported/native source parity, and valid zero
- after the deployed diagnostic proves the actual report-response currency, make only the explicitly approved campaign/property/source correction; never convert or relabel stored values implicitly

Completion gate: the selected production property, campaign, and every active GA4 Insights financial source have one verified currency, and authenticated `ga4-to-date` succeeds with exact provenance.

Local result: PASS - three focused production-path files, 47 tests, and TypeScript. The production configuration gate remains open until the deployed response proves the observed currency.

### Commit 3 - `fix(ga4): preserve exact Insights production failure evidence`

- read the actual GA4 OAuth response field used by the production route
- include only the authenticated API `error` or `message`, capped at 300 characters, when an evidence endpoint fails
- regression-guard both escaped validator defects
- record the exact GBP property versus USD campaign/source/record evidence without changing any production value

Completion gate: focused validator regression passes and the read-only validator reports the exact bounded production blocker. Result: PASS locally and against deployed Commit 2; the blocker is `GA4 native revenue currency GBP does not match campaign currency USD`.

### Commit 4 - `test(ga4): freeze the final Insights certification candidate`

- freeze one implementation SHA and its dependency/configuration hashes
- run the focused Insights suite, affected shared regressions, authentication and tenant-isolation tests, source-scope tests, TypeScript, production build, and machine checker
- push only the focused commits and confirm Render deploys the exact candidate SHA
- run authenticated read-only owner API/UI parity, non-owner isolation, completed-day/timezone/window/source-state parity, and deterministic scheduler validation only for producers that directly update live Insights inputs

Completion gate: every in-scope command and deployed check passes on the same SHA with no Critical or Major finding open. Any failure leaves status `not certified` and creates a new classified finding before further work.

Local result: PASS on `3862d5afabd5210e305013c88bfce806415786d9` - 53 production-path files and 498 tests, TypeScript, production build, and machine checker. Production-only gates remain open.

### Commit 5 - `docs(ga4): record exact Insights certification evidence [skip render]`

- record the certified and deployed candidate SHA, dependency/configuration boundary, commands, results, findings, external evidence, and known limitations
- change machine and controlling status to `PRODUCTION_READY` only if Commit 3's complete local and production evidence packet passed; otherwise record the failed gate and retain `not certified`
- keep Reports-owned functionality and later-release ad connectors outside the Insights certification, not as deferred Insights validation

This documentation-only evidence commit does not alter the certified runtime boundary and must not trigger a different Render runtime revision.

## Complete Visible Value Inventory

| Surface | Visible values | Authoritative live inputs and transforms |
|---|---|---|
| Shared live-tab context | Client, Campaign, selected GA4 Property ID, saved Property Campaigns filter, delayed/provider-refresh warning when applicable | authenticated client and campaign responses; selected active GA4 connection; 30-day daily response freshness metadata |
| Executive Financials | Spend, Revenue, Profit, ROAS, ROI, source labels, loading/unavailable/not-connected/last-good state | GA4-context spend sources and totals; native GA4 to-date totals; GA4-context imported revenue; fixed native-source precedence; Revenue = native + imported; Profit = Revenue - Spend; ROAS = Revenue / Spend only when Spend > 0; ROI uses shared metric math only when Spend > 0 |
| Trends | Sessions, Users in Daily only, Conversions, Revenue, Page Views, Engagement Rate; Daily, 7d, 30d, Monthly; completed-day cutoff, latest-imported-day, and last-refreshed labels | non-mutating Insights reads for overlapping 30-day and isolated 60-day `ga4-daily` responses; selected property; completed campaign-reporting days; Daily chart bounded to the latest 30 calendar days and beginning at the first imported date; shared calendar rollups; session-weighted engagement preserving explicit zero engaged sessions; prior-calendar-day deltas; partial/incomplete month labeling |
| Data Summary | 30-day Sessions, Conversions, conversion rate, Top Channel, channel Sessions/Share/Conversions/CR | exact last 30 calendar days from the isolated daily response; raw same-window GA4 acquisition breakdown for the selected property/filter; no campaign-to-date financial duplication; no proportional allocation |
| Tracker cards | Total findings, High-severity findings, Medium-severity findings | full generated finding list before the visible finding cap; verified KPI/Benchmark conclusions are counted separately; shared unverified-source effects are consolidated; total includes positive and informational findings |
| What to investigate next | stable page header; settled-input tracker counts; grouped finding title, description, recommended check, severity, basis, confidence, hidden count | initial multi-query readiness gate; financial integrity rules; eligible KPI/Benchmark values and snapshot analytics; fail-closed saved-target/current-window period matching with affected target identification; saved KPI priority and factual below-target status; consolidated unverified-target readiness finding; factual no-snapshot state; complete 3-day or 7-day calendar comparisons; raw same-window channel context; explicit unavailable/stale/configuration findings; no generic total-ROAS strength inference |

## End-To-End Path Matrix

### Daily and trend values

`campaign reporting timezone + selected property + saved ga4CampaignFilter`
-> authenticated `GET /api/campaigns/:id/ga4-daily?days=60&propertyId=...`
-> campaign/property connection lookup
-> GA4 provider refresh when due
-> atomic exact-window replacement in `ga4_daily_metrics` by campaign, property, and date, including successful empty provider windows
-> response cutoff/freshness metadata
-> property identity check
-> `normalizeGA4InsightsDailyRows`
-> `buildGA4InsightsRollups`, `buildGA4InsightsCalendarRollup`, or `buildGA4InsightsMonthlySeries`
-> Trends, Data Summary, tracker inputs, and trend findings.

Daily charts consider the latest 30 calendar dates ending at the latest imported date, begin at the first imported date in that range, and render later `null` dates as gaps so non-consecutive observations are not presented as a continuous trend. Rollups use persisted `engagedSessions` whenever present, including zero, and derive it from that row's normalized engagement rate only for legacy absence.

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
- production OAuth configuration must supply Google client credentials and a stable token-encryption secret; GA4 and Sheets state must use explicit provider secrets when configured or stable purpose-separated keys derived from that mandatory token secret; the deployed read-only packet must prove both in-scope authorization URLs contain signed state

## State And Misleading-Guidance Contract

| State | Required live behavior |
|---|---|
| loading | stable skeleton or existing unaffected content; no inferred zero |
| valid zero | render numeric zero when the source response/configuration proves availability |
| not connected | show Not connected and block denominator-dependent metrics |
| unavailable/failed | show unavailable and withhold affected comparisons/recommendations |
| stale/last-good | label last-good state; withhold trend recommendations until refresh succeeds |
| insufficient data | show exact missing calendar coverage; do not widen the window |
| no completed campaign day | label native GA4 revenue as awaiting the first completed day; do not call it disconnected or score revenue-dependent conclusions |
| blocked configuration | show setup/configuration finding before performance guidance |
| partial/incomplete month | label partial and do not compare it with a full month |

## Findings

Historical certified-boundary findings were Critical `0`, Major `0`, and Minor `0`. Every item below is a closed historical finding retained for root-cause traceability. The current release-candidate review found no new in-scope runtime regression.

### Historical Critical Findings (closed)

1. **Ownerless campaigns could be claimed by the first authenticated requester.** Root cause: the campaign-access helper mutated an ownerless campaign instead of failing closed, and the campaign list exposed ownerless rows. Path: authenticated request -> campaign list/access helper -> campaign ownership persistence -> every campaign-scoped Insights API. Fix under validation: exclude ownerless campaigns and return 404 without mutation.
2. **The live GA4 OAuth callback could replace a campaign connection after authorization without re-checking the current session owner.** Root cause: signed callback state authenticated the initiation but the callback did not bind the current actor to the campaign before token exchange and connection replacement. Path: OAuth callback -> Google token exchange -> GA4 connection delete/create -> all live Insights GA4 inputs. Fix under validation: re-check campaign ownership before external calls or storage mutation; retained legacy OAuth mutation routes receive the same access guard.
3. **Retained GA4 OAuth entry/callback routes could reach external token work or persisted connection mutation without campaign access.** Root cause: legacy handlers relied on authentication or state without applying the current campaign-owner guard. Path: legacy integrated connect, callback, URL, or token callback -> Google/provider request -> GA4 connection state -> every native Insights input. Fix under validation: require `ensureCampaignAccess` before external or persisted work on every retained route.
4. **Campaign create, reassignment, and list paths did not consistently bind the requested client to the authenticated owner.** Root cause: client IDs were accepted or rows were listed without first proving the owner-client relationship. Path: authenticated campaign create/update/list -> client/campaign association -> every Insights campaign and source read. Fix under validation: require an owned client for create/reassignment and return only campaigns whose client and campaign ownership both match the actor.
5. **Legacy Google/GA4 OAuth state could be forged for an account-injection callback.** Root cause: retained GA4 integrated, browser-callback, and Google Sheets source OAuth flows used a plain campaign ID or unsigned base64 JSON as `state`; an ownership check at callback time did not prove that the owner initiated that exact OAuth transaction. A known development signing fallback would also have remained forgeable if production secrets were absent. Path: forged callback -> temporary or persisted Google credentials/property or Sheets source -> native GA4, imported revenue, and spend inputs rendered by Insights. Fix under validation: issue HMAC-signed, nonce-bearing, expiring state from every retained entry route; verify it before campaign access, token exchange, external provider reads, or connection mutation; reject legacy unsigned state; and fail closed in production unless a feature-specific or session secret is configured.
6. **GA4 and directly consumed source OAuth secrets/provider text could reach logs or executable popup HTML.** Root cause: a retained GA4 code-exchange route logged the complete token request containing the authorization code and client secret, while GA4, Google Sheets, and HubSpot callback error/property values were interpolated into HTML or JavaScript without script-safe encoding. Path: OAuth request/provider metadata -> production logs or callback popup -> credential exposure or authenticated browser script execution -> connected native or imported inputs rendered by Insights. Fix under validation: remove all secret-bearing request logging, render constant callback errors, and script-escape serialized GA4 property metadata before posting it to the opener.
7. **Directly consumed HubSpot and Salesforce OAuth paths could attach a different tenant's source connection.** Root cause: Salesforce initiation and callback did not verify campaign ownership, HubSpot callback relied on signed state without rechecking the current actor, and HubSpot used a known signing fallback when production secrets were absent. Path: forged or cross-tenant OAuth flow -> CRM connection/token persistence -> materialized imported revenue -> live Revenue, Profit, ROAS, ROI, KPI/Benchmark values, and findings. Fix under validation: fail closed on missing production signing configuration and require current campaign ownership before PKCE storage, token exchange, external reads, or connection mutation in every directly consumed CRM OAuth path.
8. **The current-release Google Ads spend OAuth path could be forged, used across tenants, or expose bearer credentials to browser code.** Root cause: its signed state used a known production fallback, initiation did not verify campaign ownership, callback exchanged the authorization code before verifying the current actor, plaintext access/refresh tokens were posted through popup JavaScript and back to the API, and provider-controlled values were embedded without script-safe serialization. Path: Google Ads source chooser -> OAuth initiation/callback -> browser-held credentials -> selected customer and materialized spend -> live Spend, Profit, ROAS, ROI, CPA, KPI/Benchmark values, and findings. Fix under validation: fail closed on missing signing/encryption/provider configuration, require campaign access before state issuance or token exchange, send only a short-lived encrypted package bound to the owner/campaign/provider account, render constant errors, and script-escape the popup payload.
9. **The live Google Ads spend source trusted a browser-calculated amount.** Root cause: the source wizard summed preview rows client-side and posted the resulting amount through the generic manual-spend route, which persisted it without recomputing from campaign-owned provider facts. An authenticated caller could therefore change every spend-derived executive value without changing Google Ads data. Path: Google Ads daily facts -> browser preview/amount -> manual-spend route -> GA4-context spend records -> Spend, Profit, ROAS, ROI, CPA, KPI/Benchmark values, and findings. Fix under validation: treat the client payload as selection only; recompute the amount, per-day records, account label, and breakdown from the selected campaign's server-held Google Ads facts through one exercised production helper.

### Historical Major Findings (closed)
56. **The Insights audit changed Overview-owned behavior and a shared Overview revenue calculation.** Root cause: the audit treated shared financial inputs and the Overview source chooser as if Insights owned them. Path: GA4 provider request and fallback -> `/ga4-to-date` -> page-wide financial availability -> Overview Total Revenue; and Overview Total Spend `+` chooser. Effect: native revenue could become `Unavailable`, source selection changed, and later currency conversion changed Overview values. Correction `27b1cfb4234757340a681209d32df9b09efd52eb` restores the normal Overview request and source precedence, keeps the stricter currency request on `insightsScope=1` only, restores the Overview chooser, and adds cross-tab boundary regressions. Follow-up `afcadf2129562799f2a387546fd60e2ceec0fcbb` retains Insights-only currency metadata after the supplemental provider merge without changing normal Overview output. Closed: deployed owner parity proved the Insights request while this audit made no Overview change.

57. **The production validator required local decryption of a production-only GA4 token.** Root cause: the external runner queried encrypted credentials and called the Admin API directly, even though the local evidence environment intentionally does not hold the production token-encryption key. Path: authenticated page/API parity -> local credential decryption -> property metadata check -> certification abort. Effect: exact deployed `4830767193cf434d0de464436b4e06e412f33ab2` reached authenticated parity but could not complete its evidence packet. Correction `2655f3c928868128b9ef13b76d54942053474b47` propagates Data API response timezone only for the explicit Insights request and validates the provider-returned response currency/timezone; normal Overview requests still expose neither field. Closed: the exact-SHA packet verified provider-returned USD and Amsterdam metadata without local token decryption.

58. **The production validator compared grouped visible findings to an ungrouped generated sequence.** Root cause: the UI caps the first twelve findings and then renders them in the documented `setup`, `targets`, `trends`, `finance`, `context` category order, while the validator expected the original flat priority order. Path: complete generated finding metadata -> first-twelve cap -> grouped live cards -> authenticated parity comparison. Effect: exact deployed `d981a0a73c398e8b08e028239b20bcb15de232c4` failed despite the same finding records being present. Correction `b634d991602e149c926da05422833b46475ab4e8` applies the production category order to the expected first-twelve packet before field-for-field comparison. Closed: all ten current visible findings matched the grouped live render.

59. **The Insights validator entered and judged the Overview-owned financial source chooser.** Root cause: the production runner switched from Insights to Overview and asserted that Google Ads was absent, contradicting the documented boundary that Google Ads remains available in Overview but is excluded only as a current Insights input. Path: completed Insights parity -> Overview tab -> Total Spend `+` chooser -> false certification failure. Effect: exact deployed `788ff46dbdb2173c54a4de47c0e93a87563cf30b` failed because the restored Overview chooser was correct. Correction `c23010342d4186c9bfe79c25e626eb28be11361e` removes the Overview tab/chooser interaction entirely and regression-forbids it in the Insights validator. Closed: the final validator remained entirely inside Insights.

60. **The Insights evidence JSON retained a hard-coded Overview chooser claim after the interaction was removed.** Root cause: `liveSurfaceParity.spendChooser` was a static array, not measured evidence. Path: successful Insights-only validation -> emitted certification packet -> false Overview parity claim. Effect: exact deployed `477deb04acec3b7e58163732a72ce2df02d1ff71` passed every executed Insights gate but its output overclaimed an unexecuted Overview surface, so it is not accepted as clean certification evidence. Correction `76eec088a8b832522396d6d25a7c9b0d6646f595` removes and regression-forbids that field. Closed: the final evidence contains only measured Insights surfaces.

61. **The read-only persistence guard collapsed every in-scope table into one opaque hash.** Root cause: a concurrent production update and a validator-caused mutation produced the same undifferentiated error. Path: before/after campaign-scoped table hashes -> one aggregate SHA-256 -> certification failure without an affected component. Effect: the first clean-packet run on deployed `c292e9d340591ca308401765343464db1b39701d` observed a persistence change but could not attribute it; an immediate diagnostic rerun on the unchanged app passed with persistence unchanged, supporting a concurrent update but not proving its component. Correction `1f29fffe1910bc557dccdf3e42764a8853ff18eb` compares and reports only component names while keeping values hashed. Closed: final owner and non-owner runs reported every component unchanged.

62. **The deterministic scheduler validator's pre/post daily reads were not explicitly read-only.** Root cause: the same `/ga4-daily` GET can refresh provider data when stale, so the evidence runner could mutate daily facts before the intended `run-now` POST and blur the scheduler mutation boundary. Path: pre-run daily GET -> optional refresh/persistence -> scheduler POST -> post-run daily GET. Correction `abb49a0a121077cc64b6b76991bac936e59d4acf` adds `readOnly=1` to both evidence reads; only the authorized campaign-scoped scheduler POST remains mutable. Closed: the exact-SHA scheduler packet bounded mutation to the authorized daily refresh and direct recompute.

63. **Daily Trends visually connected observations across missing calendar dates.** Root cause: the live Recharts line set `connectNulls` for Daily mode, so sparse observations were joined even though the table and copy said missing dates were skipped. Path: persisted sparse GA4 daily rows -> calendar-slot transform with nulls -> Recharts line -> visible Daily chart. Effect: `2026-07-12` appeared connected to `2026-08-08` across 26 absent dates. The prior certification was invalidated immediately in `76d37170`; correction `3e6b46c6` keeps the null slots and renders them as gaps. Closed: production SVG parity proved separate path segments for the exact sparse fixture.
64. **The regression/certification guard encoded the misleading Daily bridge.** Root cause: a source guard required `connectNulls` in Daily mode instead of checking the rendered production path. Path: UI regression -> certification evidence -> incorrect acceptance of the visual defect. Correction `76d37170` reversed the escaped expectation before the value fix; `11c65b91` additionally validates distinct SVG move segments across null gaps. Closed: the corrected guard fails if the Daily line bridges missing dates.
65. **The live validator retained obsolete assertions and did not accept one documented fail-closed state.** Root cause: its Data Summary assertions expected removed start/end-date text, while explicit channel-property mismatch was omitted from the accepted blocked states. Path: authenticated production page -> validator assertions -> certification result. Correction `11c65b91` removes only the stale text checks, preserves value parity, and validates the documented fail-closed mismatch state. Closed: focused validator regressions and both production packets passed.


1. **The certification record and narrative could contradict each other.** Root cause: no machine guard rejected a ready claim while the controlling JSON or status block remained `not certified`. Path: readiness documents -> machine record -> release decision. Fix: committed guard `dc3c46db407f30f529760263eac9281e1965ae69` binds the current status block, required dependencies, evidence gates, hashes, and exact SHAs.
2. **Sparse rows could be described as satisfying or merely missing a fixed 14-row requirement.** Root cause: visible copy and some guards treated response row count as calendar coverage. Path: 60-day daily response -> Trends gate/copy -> 7d/30d chart and recommendation eligibility. Fix under validation: use the actual shared current/prior calendar rollups and disclose both exact windows and imported-day counts. The reported 21-row fixture correctly remains incomplete because its current and prior seven-day windows contain 1/7 and 0/7 dates.
3. **Rolling and monthly comparisons could compare non-equivalent periods.** Root cause: returned-row slicing widened sparse windows, and monthly deltas did not require adjacent comparable calendar months. Path: persisted daily rows -> rollup/monthly transforms -> charts, tables, deltas, and findings. Fix under validation: exact calendar ranges, completeness flags, cutoff-month rules, and adjacency checks.
4. **Negative values could reverse or disappear in deltas and provider repair.** Root cause: percent change divided by the signed prior value and several paths used positive-only presence checks or truthy whole-object fallback. Path: GA4 provider totals/daily rows -> repair/normalization -> Trends, Executive Financials, KPI/Benchmark inputs, and findings. Fix under validation: divide by `abs(previous)`, preserve valid negative values, and resolve conversions/revenue independently per field.
5. **Explicit zero engaged sessions could be replaced by a derived nonzero value.** Root cause: zero was treated as absence. Path: GA4 daily fact -> rollup/monthly weighted Engagement Rate -> Trends and Data Summary. Fix under validation: preserve explicit zero and derive only for genuinely absent legacy values.
6. **A successful empty KPI/Benchmark analytics response could be presented as recorded history, and sparse dates could become a false streak.** Root cause: response-object truthiness and row-order counting replaced non-empty and adjacent-date checks. Path: analytics API -> history/streak/volatility text -> findings. Fix under validation: require non-empty scoped arrays and consecutive calendar dates.
7. **Zero-valued daily facts could produce a false `No issues` state.** Root cause: data availability was inferred from positive totals rather than an observed completed row. Path: valid zero daily response -> generated finding list/tracker -> executive guidance. Fix under validation: treat observed zero as data and keep unavailable distinct.
8. **Imported revenue records could join a source belonging to another campaign.** Root cause: joins matched source ID without also matching `revenue_sources.campaign_id`. Path: revenue records/source definitions -> to-date and breakdown totals -> Revenue, Profit, ROAS, ROI, Data Summary, KPI/Benchmark values, and findings. Fix under validation: enforce the same campaign on both sides of every in-scope financial join.
9. **Materialized imported revenue precedence mishandled valid zero or negative aggregate rows.** Root cause: aggregate presence was inferred from a positive total, so subcampaign rows could be added when an authoritative aggregate was zero/negative. Path: materialized records -> source total/breakdown -> all imported-revenue consumers. Fix under validation: track aggregate-row presence independently of value and choose exactly one representation.
10. **Spend and imported-revenue provenance could name configured sources that did not contribute, while a configured valid-zero source could lose provenance.** Root cause: totals did not return contributing source IDs and UI fallbacks conflated nonzero contribution with configured zero. Path: source definitions/records -> total endpoints -> `Sources used` and source tables. Fix under validation: return exact contributing IDs; only use all active configured sources for a proven zero result.
11. **Native, imported-revenue, and spend currencies could be silently combined.** Root cause: runtime totals did not bind GA4 report-response metadata, source definitions, record currencies, and campaign currency. Path: provider/source totals -> Revenue/Spend -> Profit, ROAS, ROI, CPA, KPI/Benchmark values, and findings. Fix under validation: fail closed for missing native currency, missing source currency, mixed record/source currencies, or any campaign-currency mismatch; deployed validation reads the exact Data API response metadata returned for the rendered native value.
12. **Financial valid-zero, negative, unavailable, and denominator-blocked states could be conflated.** Root cause: truthy/positive gates and hidden arithmetic drove visibility or styling. Path: financial responses -> Executive Financials/Data Summary -> recommendation rules. Fix under validation: preserve zero and negative values, use neutral unavailable styling, and withhold ROI/ROAS/CPA when the denominator is not valid.
13. **Financial and traffic values were displayed without sufficiently explicit window provenance.** Root cause: Data Summary mixed exact completed-day traffic, native lifetime revenue, and UTC source-to-date imports under generic copy. Path: daily/to-date/source responses -> Data Summary and Executive Financials. Fix under validation: disclose each financial window and mark partial traffic coverage with exact imported-day counts.
14. **Lower-is-better KPIs could generate false positive `outperforms target` guidance.** Root cause: the positive-signal rule interpreted a raw target percentage as universally higher-is-better. Path: live KPI value/target -> generated finding. Fix under validation: use the metric-direction-aware effective delta from the same live KPI progress calculation.
15. **ROAS and engagement guidance overclaimed meaning.** Root cause: copy treated `1.0x` as profitability breakeven and described pageviews/session as engagement rate. Path: derived metrics -> finding title/description/recommendation. Fix under validation: call ROAS a revenue-to-spend ratio with margin caveat and call pageviews/session engagement depth.
16. **The daily scheduler could report success after a targeted campaign/property failure.** Root cause: per-campaign exceptions were logged and swallowed. Path: scheduled/manual refresh -> scheduler status -> freshness and certification evidence. Fix under validation: accumulate failures and fail the run while retaining exact affected IDs.
17. **Only the primary GA4 property was refreshed by the scheduler.** Root cause: the producer selected one connection although Insights can render any selected active property. Path: scheduler -> `ga4_daily_metrics` -> property switch -> Trends/Data Summary/findings. Fix under validation: refresh every active campaign property independently.
18. **A missing provider day could survive indefinitely as stale persisted data.** Root cause: provider refresh upserted returned rows but never removed dates absent from a successful exact-window response. Path: provider result -> persisted daily facts -> rolling completeness and visible values. Fix under validation: atomically replace the authorized campaign/property/date window, including a successful empty result; reject any replacement row outside that exact scope.
19. **A saved campaign-filter or reporting-timezone change could continue rendering old-scope daily facts.** Root cause: daily rows have no embedded filter/timezone provenance and update only overlaid new rows. Path: campaign update -> persisted daily facts -> all Trends/Data Summary/recommendation consumers. Fix under validation: atomically save the scope change and delete only that campaign's daily facts before deterministic refetch; failure leaves unavailable data rather than old-scope values.
20. **KPI/Benchmark history could cross property, filter, timezone, currency, or platform scope.** Root cause: persisted history lacked complete scope provenance and analytics endpoints returned it without validating the requested GA4 property/platform. Path: scheduler history -> item analytics API -> streak/trend/volatility findings. Fix under validation: persist and require a versioned property/filter/timezone/currency marker, verify item platform and campaign-owned property, and exclude legacy/mismatched rows.
21. **A last-good daily row could be timestamped as though the missing target day had been observed.** Root cause: recompute fell back to an earlier daily row but recorded history under the requested report date. Path: scheduler daily lookup -> KPI/Benchmark history -> streak and trend guidance. Fix under validation: record daily history only for an exact target-day row; retain the earlier current value without fabricating history.
22. **Source add/edit/delete/refresh could race its dependent recompute.** Root cause: some mutations started campaign-value recompute without awaiting completion. Path: source mutation -> financial materialization -> KPI/Benchmark current/history -> Insights cards/findings. Fix under validation: await the existing recompute at every directly relevant lifecycle path and keep the operation campaign/platform scoped.
23. **Production validation could mutate live inputs before measuring them.** Root cause: opening the page or GA4 APIs without a complete read-only mode could trigger a daily refresh, lazily rewrite legacy connection tokens, persist refreshed OAuth tokens, or invoke unrelated provider-backed tab queries; a post-hoc fingerprint could detect but not prevent every mutation. Path: validator -> connection, daily, breakdown, to-date, or unrelated page API reads -> storage/external mutation -> self-altered parity evidence. Fix under validation: explicit `readOnly=1` disables connection-token migration, daily refresh, and breakdown/to-date token refresh/persistence on both direct API and page-consumed requests; unrelated tab/provider queries do not run on the validation page; every in-scope GA4 response must confirm read-only mode; and before/after campaign-scoped persistence fingerprints must match.
24. **The production validator did not fully prove valid-zero spend, report-response timezone/currency, source currencies, or nested scheduler freshness.** Root cause: evidence checked rendered totals but omitted these configuration and state branches. Path: deployed validator -> certification packet. Fix under validation: compare exact Data API response metadata, campaign/source currencies, zero-source provenance, exact source windows, and the actual nested refresh response.
25. **Tenant-isolation validation could select an arbitrary production user or create a new user without explicit authorization.** Root cause: the validator chose a non-owner from the Clerk inventory and created a fixture by default. Path: certification tool -> Clerk identity/session -> non-owner API request. Fix under validation: require an explicitly supplied existing non-owner ID or an explicit temporary-user flag, revoke every created session, and delete only the exact authorized temporary user.
26. **A campaign/property scope mismatch could be silently discarded during exact-window persistence.** Root cause: the replacement helper filtered caller rows instead of rejecting an invalid batch. Path: provider/scheduler rows -> transactional replacement -> daily facts. Fix under validation: reject the whole batch before deletion when any row lies outside the authorized campaign/property/date scope.
27. **Scheduled financial KPI/Benchmark snapshots could diverge from the live Insights financial model.** Root cause: the recompute job accepted retained daily totals or a configured-lookback acquisition breakdown when the live campaign-to-date GA4 response was incomplete, and it did not enforce campaign/native/imported/spend currency parity. Path: provider and source totals -> scheduled KPI/Benchmark current values and history -> Insights KPI/Benchmark trend, streak, volatility, and investigation guidance. Fix under validation: real GA4 properties require a complete live campaign-to-date native candidate, apply the shared currency gate independently to native, imported-revenue, and spend inputs, never substitute a differently windowed breakdown, and preserve last-good values without writing misleading history when an input is unavailable.
28. **Observed zero conversions and revenue could be mistaken for missing legacy data and force a provider repair.** Root cause: the on-demand daily route used nonzero presence as the repair signal even after a provider-shaped row had explicitly recorded zero. Path: persisted completed-day zero -> live Insights daily request -> unnecessary provider refresh/failure -> stale or unavailable Trends and recommendations. Fix under validation: provider-shaped rows with explicit revenue-metric provenance preserve valid zero and do not enter the legacy repair branch.
29. **A campaign with no completed reporting day could be mislabeled as having no revenue connection and its zero payload could be consumed as observed financial data.** Root cause: the successful `ga4-to-date` no-window response intentionally contains zero totals and an empty revenue-metric name, but the browser inferred source configuration and denominator state from those fields. Path: future/same-day campaign start -> `noCompletedWindow` response -> Executive Financials provenance/value, Data Summary CPA, missing-source finding, and revenue/CPA-dependent KPI/Benchmark state. Fix under validation: preserve the no-window state through a shared production helper, render explicit first-completed-day copy, suppress the false missing-source classification, and mark native-revenue/CPA evaluations insufficient while leaving independently verified imported revenue usable.
30. **Tracker and recommendation memos could retain the prior no-window classification after that semantic state changed.** Root cause: memo dependencies included numeric availability but not the no-completed-window sufficiency state, so a transition with the same zero values could leave blocked/insufficient counts or findings stale. Path: refreshed `ga4-to-date` response -> KPI/Benchmark consumer state -> tracker counts and investigation findings. Fix under validation: bind each memo to the shared revenue-window sufficiency state.
31. **An OAuth setup placeholder could be shown as a usable GA4 connection with one property.** Root cause: the retained connection-status fallback reports an in-memory pre-selection OAuth state as connected, while the Insights provenance renderer checked only that flag and defaulted the property count to one. Path: OAuth callback before property persistence -> connection-status response -> live Insights connection provenance. Fix under validation: Insights calls a connection usable only when an active supported property exists and renders the exact property count with no fabricated fallback.
32. **Deployed parity did not capture the separate 30-day daily response used by live KPI and Benchmark inputs.** Root cause: the validator captured the isolated 60-day Trends request but the browser also consumes a distinct 30-day daily response for overview-derived live values such as Engagement Rate. Path: 30-day daily API -> live KPI/Benchmark resolver -> tracker and investigation findings. Fix under validation: capture, property-check, completed-window-check, and read-only-check the exact page-consumed 30-day response independently of the 60-day Trends response.
33. **The deployed checker proved only the first twelve finding cards while the visible tracker counts every generated finding.** Root cause: hidden findings were represented only by a count and the validator compared the visible subset back to its own DOM attributes. Path: complete generated finding list -> priority sort/cap -> tracker totals, visible cards, and hidden-count disclosure. Fix under validation: expose the complete production-generated finding packet as non-visual metadata, verify unique IDs, required fields, severity ordering and exact tracker counts, then require the rendered first twelve cards to match that packet field-for-field and apply history/scope guards to the complete packet.
34. **The exact browser-consumed campaign response was absent from deployed parity.** Root cause: the validator read the campaign row directly from the database but did not capture the page request that supplies client, currency, reporting timezone, and saved GA4 filter context to the renderer. Path: campaign API -> browser campaign state -> currency formatting, source/filter labels, and scoped value interpretation. Fix under validation: capture the exact page response and compare campaign/client, currency, normalized reporting timezone, and saved-filter set with the read-only database boundary before validating rendered values.
35. **The deployed checker could accept an unscoped KPI or Benchmark analytics-history request.** Root cause: response matching checked only the analytics URL path and did not require the browser's `ga4Scope=1`, selected property, or KPI timeframe query. Path: stored history -> analytics endpoint query -> streak/trend/volatility text and finding counts. Fix under validation: require the exact scoped query parameters and verify every returned history row carries the selected property/filter/timezone/currency scope marker.
36. **The shared context rendered above the live Insights tab was omitted from the value inventory and deployed UI parity.** Root cause: prior evidence began at Executive Financials even though the same live page visibly renders client, campaign, selected property, saved Property Campaigns filter, and a conditional daily-freshness warning. Path: authenticated client/campaign/connection/daily responses -> shared GA4 header -> interpretation of every Insights value. Fix under validation: include the shared context because it directly labels live Insights, capture the authenticated client response, and compare every context label and conditional freshness state with the same scoped inputs used by the tab.
37. **Several deployed browser-response matchers accepted the right path with the wrong query scope.** Root cause: only the 30/60-day and breakdown requests checked selected query parameters; KPI/Benchmark lists, financial routes, connection reads, and other page inputs were matched by pathname alone. Path: exact page request -> captured response -> API/UI parity packet. Fix under validation: every expected query parameter, including campaign ID, property ID, platform context, read-only flag, days, and date range, must match before a browser response can enter certification evidence.
38. **Selecting a Google Ads spend account could destroy the prior connection/daily facts before the replacement succeeded and could clear unrelated Google Ads-platform revenue.** Root cause: the GA4 child-spend OAuth selection route sequentially cleared attributed revenue, deleted the connection and daily metrics with swallowed failures, then inserted the replacement; `spendOnly` was not honored at the foreign-platform cleanup boundary. Path: GA4 Insights spend chooser -> Google Ads account selection -> shared provider connection/daily facts and Google Ads-context revenue -> materialized GA4 spend -> live Spend and every derived financial value/finding. Fix under validation: bind the replacement to one database transaction that restores the prior connection and daily facts on failure, and never clear Google Ads-platform attributed revenue for a `spendOnly` connection.
39. **Google Ads refresh could change value meaning across runs.** Root cause: initial import stored cumulative spend on today's date, provider refresh upserted a fixed 60-day window without removing disappeared rows, and materialized refresh later replaced the source from a different 90-day window while hard-coding USD. Path: OAuth refresh/provider daily facts -> source materialization scheduler -> lifetime and daily spend -> financial cards, latest-day KPI/Benchmark history, and findings. Fix under validation: query the MetricMind campaign window, atomically replace that exact provider window including successful empty results, materialize the same selected daily rows with source/campaign currency, preserve valid zero, and retain last-good records only when provider freshness is not proven.
40. **The scheduled Google Ads refresh bypassed credential hydration.** Root cause: the all-connections scheduler selected encrypted database rows directly and passed their null plaintext token columns to the provider refresh, instead of reloading each campaign connection through the storage decryption boundary. Path: four-hour scheduler -> raw connection row -> provider refresh no-token branch -> stale daily facts -> stale materialized spend and every derived Insights value. Fix under validation: enumerate campaign IDs only, reload each connection through storage, and regression-guard that raw rows are never passed into provider refresh.
41. **Deployed finding parity did not bind KPI/Benchmark integrity cards to the scoped item lists.** Root cause: the validator checked performance finding IDs such as `kpi:` and `bench:` but omitted the `integrity:kpi_*` and `integrity:bench_*` families, allowing a stale or cross-scope configuration/availability card to pass. Path: scoped KPI/Benchmark response -> consumer-state integrity finding -> tracker/list parity evidence. Fix under validation: map every KPI/Benchmark integrity finding's terminal item ID to the exact authenticated scoped list response.
42. **A successful Google Ads provider refresh did not directly update the live GA4 spend source.** Root cause: the four-hour provider scheduler refreshed `google_ads_daily_metrics`, while GA4 spend materialization remained in a different daily auto-refresh path and could therefore stay stale until another job ran. Path: Google Ads provider -> provider daily facts -> GA4 `spend_records` -> Spend, Profit, ROAS, ROI, CPA, KPI/Benchmark values, and findings. Fix under validation: the dedicated Google Ads refresh now materializes the exact active GA4 source immediately, updates the completed-day campaign total, and requires a complete downstream recompute.
43. **Financial-source mutations could return success after live Insights recompute failed or skipped rows.** Root cause: the shared recompute wrapper logged and returned `false`, and a revenue lifecycle helper swallowed current-value refresh failures. Path: add/edit/delete/refresh -> source records -> KPI/Benchmark current values/history -> tracker and findings. Fix under validation: every directly consumed lifecycle operation now awaits recompute and fails the request when campaign, KPI, Benchmark, or alert reconciliation evidence is incomplete.
44. **Imported financial dates and success totals could disagree with the live completed-day value.** Root cause: CSV and Google Sheets paths used different JavaScript date coercion rules, offset timestamps could shift calendar dates, invalid selected Sheets spend dates could be silently omitted, and responses reported raw selected totals including future/intraday rows while live Insights excluded them. Path: uploaded/sheet rows -> validation -> persisted records -> mutation response/toast -> completed-day financial APIs -> Executive Financials, Data Summary, and findings. Fix under validation: one strict source-calendar date normalizer is used for validation and persistence, selected invalid dates fail before mutation, and responses separate raw imported totals from the completed-day value displayed by Insights.
45. **Invalid GA4 provider numbers could be destructively converted to valid zero.** Root cause: provider, storage, and browser normalization used `Number(value) || 0`, so non-finite, negative traffic, impossible engagement, or malformed values could replace last-good facts and render as observed zero. Path: provider daily response -> scheduler/on-demand exact-window replacement -> `ga4_daily_metrics` -> Trends, Data Summary, KPI/Benchmark values, and findings. Fix under validation: the shared production normalizer rejects corrupt rows; the scheduler and storage reject the complete batch before deletion; valid zero remains valid and revenue may remain negative.
46. **Two schedulers could materialize live GA4 Google Ads spend using different source-identification rules, while an inventory failure looked like a successful zero-work run.** Root cause: the general external-value scheduler identified Google Ads by display text and rewrote GA4 spend independently of the dedicated provider scheduler; the dedicated scheduler swallowed a failed connection inventory read. Path: scheduler inventory/source selection -> provider daily facts -> GA4 spend replacement -> every spend-derived Insights value and freshness claim. Fix under validation: the dedicated Google Ads scheduler is the sole GA4 ad-platform spend updater, exact mapping platform and selected IDs are required, inventory failure throws, and the timer records the failure instead of producing false success.
47. **Native revenue and imported revenue/spend could use different end dates.** Root cause: native GA4 used the campaign-reporting-timezone completed day while source totals and copy used UTC/current-day boundaries. Path: native and imported financial APIs -> combined Revenue/Spend -> Profit, ROAS, ROI, CPA, KPI/Benchmark values, Data Summary, and findings. Fix under validation: all live financial inputs and direct recomputes end on the same latest completed campaign-reporting day; the UI and evidence packet disclose that exact cutoff.
48. **The on-demand GA4 daily route could bypass the corrupt-value guard.** Root cause: its provider mapper applied `Number(value) || 0` before the strict storage replacement boundary, converting malformed values to valid zero even though the scheduler and storage paths rejected the raw input. Path: live `/ga4-daily` refresh -> provider mapper -> exact-window replacement -> Trends, Data Summary, KPI/Benchmark values, and findings. Fix under validation: the route now applies the shared production normalizer to raw provider values, rejects invalid or out-of-window rows before replacement, and has an actual Express-route regression proving last-good persistence is untouched.
49. **The production read-only validator did not compile.** Root cause: the browser request helper redeclared its `body` parameter as a local response variable, a syntax failure outside the main TypeScript project boundary. Path: exact deployed revision -> authenticated owner parity runner -> no executable production evidence. Fix under validation: use a distinct parsed-response variable and compile both executable certification scripts in the machine-gate regression suite.
50. **The in-scope production OAuth paths depend on absent optional state secrets.** Root cause: GA4 and Google Sheets state signing does not yet derive purpose-separated signing keys from the stable token-encryption secret already required for production token storage. Path: GA4/Sheets connect initiation -> signed campaign-bound state/provider authorization -> selected native/imported inputs -> live Insights. Production evidence: authenticated requests on deployed `0a066fd38673a45d1e8639646f7099c230d144cc` returned HTTP 500. Required fix: Commit 1 adds the secure production fallback and focused signed-state tests without requiring new Render variables.
51. **The selected production campaign could not serve native GA4 financials in its configured currency.** Root cause: campaign-to-date and KPI/Benchmark provider requests omitted the Data API `currencyCode`, so GA4 used the property's GBP default while every combined campaign source is USD. Path: selected GA4 property -> `ga4-to-date` and direct KPI/Benchmark recompute -> native Revenue -> Profit, ROAS, ROI, CPA, Data Summary, and findings. Fix on deployed `9db1985b`: request the validated campaign currency on the primary, UTM-fallback, and conversion/revenue-supplement reports and retain the response-currency guard. Authenticated evidence now returns HTTP 200, `currencyCode: USD`, and native revenue `46,101.90`. This code fix does not clear the separate daily/to-date parity and asserted-total contradiction below.
52. **Google Ads remains exposed without a certifiable live provider boundary for this release.** Root cause: the source chooser still advertises the connector even though no authorized live Google Ads test account is available and the connector is explicitly outside the release boundary. Path: live source chooser -> Google Ads connection/materialization -> Spend and every spend-derived Insights value. Required fix: Commit 1 removes the chooser entry and excludes the connector from the certified dependency boundary while preserving fail-closed backend guards for a later release.
53. **The read-only production validator rejected a successful GA4 OAuth response.** Root cause: it read camel-case `oauthUrl` while the exercised production route returns `oauth_url`. Path: authenticated GA4 OAuth initiation -> validator URL/state parsing -> owner production evidence packet. Production evidence: exact deployed Commit 1 reached URL parsing and failed with `ERR_INVALID_URL` from an empty field. Fix under validation: read the actual production response field and regression-guard both the required snake-case field and absence of the incorrect camel-case read.
54. **The read-only production validator discarded the API failure reason needed to diagnose a blocked value.** Root cause: its response loop reported only endpoint name and HTTP status even though the authenticated API returned a bounded error field. Path: `ga4-to-date` response -> validator failure handling -> currency evidence and release decision. Production evidence: exact deployed Commit 2 reached `ga4-to-date` and reported only `toDate endpoint failed (500)`. Fix under validation: include only the authenticated API `error` or `message`, capped at 300 characters, and regression-guard that bounded fail path.
55. **The asserted Total Revenue does not match current authoritative production inputs.** Root cause: `58,935.33` is present in historical KPI progress but is not reconstructible from the current selected-property to-date response and active source-backed imported revenue. The exact deployed inputs are native GA4 USD `46,101.90` plus imported USD `16,700.00`, producing UI/API Total Revenue `62,801.90`; Shopify is zero for the saved exact UTM mapping. Path: GA4 Data API plus active CSV/HubSpot/Shopify records -> `ga4-to-date`/`revenue-to-date` -> Executive Financials and Data Summary. Required resolution: reconcile the expected value to an authoritative property/window/filter/source record; never copy the historical KPI snapshot or invent a Shopify amount.

All Critical and Major findings above are historical and closed by the passed candidate evidence. A recurrence or contradictory result immediately invalidates the candidate.

### Historical Minor Findings (closed)

1. **The UI regression guard still expected Google Ads in the current-release spend chooser.** Root cause: the assertion was not updated with the approved release boundary. Path: chooser source list -> automated release-boundary evidence. Fix: require Google Ads, LinkedIn, and Meta to be absent while Google Sheets and CSV remain present.
2. **The Shopify downstream fixture could not exercise the current financial producer contract.** Root cause: it expected an intraday end date and omitted the exact access-token connection and USD source/native aggregate provenance now required by the production path. Path: Shopify materialized revenue -> completed-day/currency guard -> KPI/Benchmark and notification values. Fix: bind the fixture to USD at every source boundary, supply the exercised GA4 connection, and require the last completed day.

### Historical findings for superseded revisions

The following findings and evidence are historical only:

1. **Sparse daily history was still described as a fixed row-count requirement outside the Trends card.** Root cause: `What to investigate next` used total rows in the 60-day response as completed-day history. Path: isolated daily response -> rollups -> action intro and short-window findings. Fix: every live explanation now reports the exact current/prior calendar ranges, imported-day coverage, and total imported rows.
2. **A property switch could retain channel analysis from the prior property.** Root cause: the channel-analysis memo omitted the placeholder/property-transition dependency. Path: selected property -> cached breakdown -> channel analysis -> Data Summary and findings. Fix: invalidate the memo on placeholder transition.
3. **A failed channel refresh could still drive recommendations.** Root cause: cached channel rows remained eligible for KPI, Benchmark, anomaly, and top-channel guidance. Path: breakdown error with last-good response -> channel analysis -> finding text. Fix: keep labeled last-good values visible but use a fail-closed recommendation-only channel input.
4. **Financial integrity findings could remain stale after source or to-date state changed.** Root cause: the findings memo omitted to-date error and financial availability dependencies. Path: GA4/imported revenue/spend queries -> availability flags -> findings. Fix: add every directly consumed dependency.
5. **Cached Data Summary values lacked local stale/unavailable labels.** Root cause: only the financial header exposed some refresh failures. Path: daily, breakdown, and financial query cache -> Data Summary. Fix: add explicit daily, channel, and financial unavailable/last-good messages while preserving verified zero.
6. **The Daily chart altered observed history.** Root cause: leading verified zero rows were trimmed and missing calendar dates were compressed between returned rows. Path: normalized daily rows -> Daily chart. Fix: preserve zero, consider up to 30 calendar days through the latest import, start the visible chart at the first imported date in that window, and retain later missing dates as `null`. Daily points remain separated across those null slots so missing history is visible and is not converted to zero.
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

Those ten findings were remediated on the historical revision; only the current exact-SHA packet above certifies the present boundary.

### Historical Minor Findings (closed)

1. An unreachable inner Trends fallback repeated the obsolete raw 14/60-row requirement. It was removed so no contradictory implementation text remains.
2. Daily insufficient-history copy called returned records days. It now says imported daily rows.
3. Unavailable Profit/ROAS values could inherit positive or negative color from hidden arithmetic. Unavailable values now use neutral styling.

Historical Minor corrections for prior-calendar-day Daily deltas, validator timing, temporary Clerk-user selection and cleanup, Shopify label precedence, and channel table shape remain preserved in the regression boundary.

No Minor finding changes a visible numeric result after the fixes above.

## Persistence, Refresh, And Destructive Safety

- the live tab itself performs no delete or destructive write
- successful daily provider refreshes atomically replace only the authorized campaign/property/date window; successful empty responses remove stale rows in that window, failures preserve the last good window, and out-of-scope replacement rows fail before deletion
- saved GA4 filter or reporting-timezone changes atomically invalidate only that campaign's daily facts before deterministic scoped refresh
- KPI/Benchmark history is retained but only the exact selected property/filter/timezone/currency marker is eligible for live Insights; mismatched and legacy history is not deleted or rendered
- imported source add/edit/delete/refresh paths recompute only the owning campaign and GA4 platform context
- source deletion can change live financial values but cannot broaden to another campaign or platform
- the campaign-scoped deterministic scheduler trigger runs the deployed daily refresh plus KPI/Benchmark recompute for only the authorized campaign and suppresses the global alert sweep
- a timer status alone is not a successful value refresh

Existing damaged-data cleanup is not authorized by this audit. No cleanup is required for the removed client-only channel allocation because it was not persisted.

## Historical Local Evidence

Historical controlling local results for exact deployed runtime `ee22f0e470826f1cb247115497c9a15229d0142d`:

- final certification-gate packet: 1 file, 10 tests passed; the standalone checker passed
- complete Insights/shared dependency boundary: 44 files, 496 tests passed
- `npm run check`: passed
- `npm run build`: passed, 3,466 client modules and bundled production server
- historical `npm run check:ga4-insights-certification`: passed on that revision's final `PRODUCTION_READY` machine record

The table below preserves earlier supporting evidence; it does not override the current exact-SHA packet.

| Gate | Result |
|---|---|
| focused live Insights and affected UI/timezone suite | PASS on implementation `3862d5afabd5210e305013c88bfce806415786d9`: 53 files, 498 tests, including executable compilation of both production validators and every active GA4, CSV, Google Sheets, HubSpot, and Shopify producer/consumer guard selected for the live tab. |
| affected auth, isolation, source, parity, lifecycle, and scheduler-consumer suite | PASS inside the same 53-file/498-test production-path packet. The complete shared source-safety file is reported separately below. |
| focused production calendar/monthly/currency functions | PASS inside the same packet, including the reported sparse 21-row fixture and actual shared production functions. |
| TypeScript | PASS: `npm run check` on `3862d5afabd5210e305013c88bfce806415786d9`; both external validators compile in the regression packet. |
| production build | PASS: `npm run build` on `3862d5afabd5210e305013c88bfce806415786d9`. |
| historical machine certification checker | PASS; that intermediate record was not certified. |
| Commit 1 focused release/OAuth boundary | PASS: 5 production-path files, 79 tests, including actual Express GA4/Sheets initiation success from the mandatory production token key, missing-all-secret fail-closed behavior, excluded Google Ads chooser/input scope, and deterministic validator scope. |
| Commit 1 TypeScript and build | PASS: `npm run check` and `npm run build`. |
| Commit 2 focused currency diagnostic | PASS: 3 production-path files, 47 tests, including matching, unavailable, mixed imported/native, explicit observed mismatch, valid-zero preservation, source scope, and live-validator coverage. |
| Commit 2 TypeScript | PASS: `npm run check`. |
| campaign-currency correction | PASS on implementation `9db1985bec59a8d1afbe844a7cf0bfbd39e1cd49`: 6 focused files, 103 tests, including actual provider request bodies, selected-property to-date, KPI/Benchmark recompute, auth/scope, and certification-validation guards. |
| historical campaign-currency TypeScript/build/machine gate | PASS; that intermediate record was not certified. |
| Overview isolation and Insights metadata correction | PASS on `afcadf2129562799f2a387546fd60e2ceec0fcbb`: 7 focused production/shared files, 132 tests; normal Overview requests retain their original provider/fallback/output contract, while explicit Insights requests retain USD response metadata through the supplemental merge. |
| historical Overview-isolation TypeScript/build/machine gate | PASS; that intermediate record was not certified. |
| response-metadata validator correction | PASS on `2655f3c928868128b9ef13b76d54942053474b47`: 7 production/shared files, 132 tests; explicit Insights requests propagate provider response currency/timezone, normal Overview requests expose neither field, and the validator cannot decrypt production credentials locally. |
| historical response-metadata TypeScript/build/machine gate | PASS; that intermediate record was not certified. |
| grouped-findings validator correction | PASS on `b634d991602e149c926da05422833b46475ab4e8`: 11 focused validator tests and `npm run check`; the expected packet is capped before applying the documented category render order. The production app bundle is unchanged from the prior passing build. |
| Insights/Overview validator boundary correction | PASS on `c23010342d4186c9bfe79c25e626eb28be11361e`: 49 focused validator/UI tests and `npm run check`; the Insights validator contains no Overview-tab or financial-source chooser interaction. The production app bundle is unchanged from the prior passing build. |
| false Overview evidence removal | PASS on `76eec088a8b832522396d6d25a7c9b0d6646f595`: 11 focused validator tests and `npm run check`; the emitted Insights packet contains no hard-coded chooser field. The production app bundle is unchanged from the prior passing build. |
| component-level persistence diagnostics | PASS on `1f29fffe1910bc557dccdf3e42764a8853ff18eb`: 11 focused validator tests and `npm run check`; component names are reported while all persisted values remain hashed. The production app bundle is unchanged from the prior passing build. |
| deterministic scheduler read-only boundary | PASS on `abb49a0a121077cc64b6b76991bac936e59d4acf`: 12 scheduler/live-validator tests and `npm run check`; pre/post daily reads require `readOnly=1`, while the campaign-scoped run-now POST remains the only allowed mutation. The production app bundle is unchanged from the prior passing build. |

Source-text assertions are structural evidence only. Numeric calendar and monthly correctness is exercised through the actual shared functions imported by the live page.

Historical out-of-scope repository result: the complete `server/source-safety-regression.test.ts` file reported 77 passed and 10 failed, and all ten failures were Instagram route-extraction assertions. The in-scope revenue, spend, and GA4 subsets passed independently as recorded above. Those Instagram failures neither executed nor supplied a value to live GA4 Insights and were not Insights findings, limitations, or deferred Insights work.

## Historical Production Evidence - `4f3b2b6f0fb47a76d4506888733b46233b6c90c4`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` returned exact production commit `4f3b2b6f0fb47a76d4506888733b46233b6c90c4`. |
| authenticated owner API/UI parity | PASS: property `542352127`, three saved filters, USD response currency, Amsterdam response timezone, 5 Executive Financial values, 3 Data Summary values, 3 channel rows, 4 Trends modes, 3 tracker values, and 10 visible findings all matched the exact page-consumed responses. The Daily chart showed `2026-07-12 = 111`, `2026-08-08 = 108`, and `2026-08-09 = 106` across 29 calendar slots and three imported observations; the SVG contained separate path segments across the missing dates. |
| tenant isolation and cleanup | PASS: one explicitly authorized ephemeral Clerk-only non-owner received `404`; its session was revoked, the exact user was deleted, and campaign persistence was unchanged. |
| deterministic direct-input scheduler | PASS by bounded carry-forward: the authorized campaign-only GA4 daily refresh and direct KPI/Benchmark recompute completed successfully at `2026-08-10T11:38:55.023Z`; alerts were suppressed and daily rows remained 21 before and after. The exact diff to `4f3b2b6f0fb47a76d4506888733b46233b6c90c4` does not change scheduler/runtime configuration dependencies, and the full protected scheduler packet passed without triggering another production recompute. |
| post-scheduler parity and persistence | PASS: immediate follow-up parity matched native revenue `52,532.70`, imported revenue `16,799.99`, total revenue `69,332.69`, spend `2,699.75`, profit `66,632.94`, ROAS `25.6812`, ROI `2468.12%`, CPA `11.39`, and conversions `237`; the validation transaction was read-only and rolled back, and campaign-scoped persistence remained semantically unchanged. |
| dependency and configuration boundary | PASS: all 84 dependency hashes matched; the canonical non-secret boundary is property `542352127`, campaign `fc734ddaf728`, `Europe/Amsterdam`, USD, three saved filters, Google Ads inactive/excluded, LinkedIn/Meta/Instagram disabled, and signed GA4/Sheets OAuth configuration passed. Its reproducible SHA-256 fingerprint is `f9106c79d9735b88cdc3adac06f435072810fb691486567256254006825d0be0`. |

The production dataset contains one complete historical 7-day rolling window ending `2026-07-02`, but not two adjacent complete 7-day windows at the latest cutoff and no complete 30-day window. The certified UI shows the historical complete window, reports exact imported-day coverage, and withholds only comparisons that require complete paired windows.

Separate external observation: the global startup auto-refresh reported failures for unrelated provider jobs across other campaigns. It was not used as target evidence and is neither an Insights finding nor deferred Insights work; the campaign-scoped daily refresh and direct recompute that supply this certified tab passed deterministically.

## Superseded Production Evidence - `1ae85d88928e306e52f02d7a0e3c1ecd9ad5719e`

The `2026-08-08` claim is invalidated: its live Daily chart connected sparse observations across missing dates and its regression test required that defect. Its remaining evidence is historical only and cannot certify the corrected runtime.

## Superseded Production Evidence - `477deb04acec3b7e58163732a72ce2df02d1ff71`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `477deb04acec3b7e58163732a72ce2df02d1ff71` in production |
| authenticated Insights-only owner/non-owner execution | PASS: all executed financial, summary, channel, Trends, tracker, grouped-finding, tenant-isolation, persistence, OAuth-state, property/filter/timezone, and response-currency checks passed; the temporary session was revoked and user deleted. |
| evidence integrity | FAIL: the emitted JSON still claimed a hard-coded Overview spend-chooser result that was not executed. The Insights results are supporting evidence but `477deb04acec3b7e58163732a72ce2df02d1ff71` is not accepted as a clean certification packet. |
| corrected replacement | deployed as descendant `c292e9d340591ca308401765343464db1b39701d`; that revision emitted clean output but its first attempt collided with an unattributed concurrent persistence change. |

## Superseded Production Evidence - `788ff46dbdb2173c54a4de47c0e93a87563cf30b`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `788ff46dbdb2173c54a4de47c0e93a87563cf30b` in production |
| authenticated owner packet | FAIL after Insights parity: the runner entered Overview and rejected its correctly restored Google Ads chooser, an explicit Insights scope violation. Cleanup succeeded; the temporary session was revoked and user deleted. This failure invalidates `788ff46dbdb2173c54a4de47c0e93a87563cf30b` as a certification candidate. |
| corrected replacement | deployed as descendant `477deb04acec3b7e58163732a72ce2df02d1ff71`; that revision passed the Insights-only execution but retained the false hard-coded evidence field recorded above. |

## Superseded Production Evidence - `d981a0a73c398e8b08e028239b20bcb15de232c4`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `d981a0a73c398e8b08e028239b20bcb15de232c4` in production |
| authenticated owner/non-owner packet | FAIL: authenticated owner API/UI parity reached the complete finding-card comparison, then rejected the documented grouped render order as though it were the flat generated order. Cleanup succeeded; the temporary session was revoked and user deleted. This failure invalidates `d981a0a73c398e8b08e028239b20bcb15de232c4` as a certification candidate. |
| corrected replacement | deployed as descendant `788ff46dbdb2173c54a4de47c0e93a87563cf30b`; that revision reached the later Overview-boundary failure recorded above. |

## Superseded Production Evidence - `4830767193cf434d0de464436b4e06e412f33ab2`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `4830767193cf434d0de464436b4e06e412f33ab2` in production |
| authenticated owner/non-owner packet | FAIL: authenticated Insights/API parity reached the independent metadata gate, then the external runner could not decrypt the production GA4 credential because its local environment intentionally lacks the production token-encryption key. Cleanup succeeded; the temporary session was revoked and user deleted. This failure invalidates `4830767193cf434d0de464436b4e06e412f33ab2` as a certification candidate. |
| corrected replacement | deployed as descendant `d981a0a73c398e8b08e028239b20bcb15de232c4`; that revision reached the later grouped-findings gate recorded above. |

## Superseded Production Evidence - `56edb3af429a64952bc30376c349001a0dd0442e`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `56edb3af429a64952bc30376c349001a0dd0442e` in production |
| authenticated owner Insights financial API parity | FAIL: the read-only `ga4-to-date?insightsScope=1` request returned HTTP 500, `GA4 native revenue currency is unavailable`; the supplemental merge dropped the provider response metadata. This invalidates `56edb3af429a64952bc30376c349001a0dd0442e` as a certification candidate. |
| corrected replacement | deployed as descendant `4830767193cf434d0de464436b4e06e412f33ab2`; that revision reached the later validator-metadata gate recorded above. |

## Superseded Production Evidence - `9db1985bec59a8d1afbe844a7cf0bfbd39e1cd49`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `9db1985bec59a8d1afbe844a7cf0bfbd39e1cd49` in production |
| deterministic scheduler | historically not run on this revision: historical evidence is not carried forward; rerun only on the final corrected candidate |
| production OAuth configuration | PASS on this exact candidate: authenticated GA4 and Google Sheets initiation returned signed state and configured Google client IDs without optional provider/session state secrets |
| authenticated owner financial API/UI parity | PASS for the bounded corrected surfaces: `ga4-to-date` returned native USD `46,101.90`; `revenue-to-date` returned imported USD `16,700.00`; Executive Financials and Data Summary both rendered USD `62,801.90`; Spend, Profit, ROAS, and ROI rendered `2,699.75`, `60,102.15`, `23.26x`, and `2226.2%`. Complete owner parity remains open. |
| financial source/record currency inventory | Authenticated APIs report one active CSV (`600`), three active HubSpot sources (`5,100`, `7,000`, `4,000`), and one active valid-zero Shopify definition, all USD. Shopify's exact full-history provider diagnostic found no saved UTM match; the two eligible provider-visible tags total USD `600` but are outside the live campaign window and are not authorized substitutes. |
| GA4 Admin metadata parity | historical blocker: the default property metadata remains GBP while request-level campaign-currency reporting returns USD; the validator and daily/native dependency boundary must be reconciled before certification. |
| live surface value parity | PARTIAL: the corrected financial surfaces match their current APIs, but `58,935.33` conflicts with those inputs and the complete tab packet has not passed. |
| Google Ads release boundary | PARTIAL: deployed code removes and fails closed the connector, and production inventory has no active source; authenticated chooser parity remains behind the failed financial packet and is not counted complete |
| tenant isolation | historically not run: no newly authorized non-owner identity was available; no temporary user was created |

## Historical Production Certification Evidence — `a158229e20b5416395f32395bd2e14039c765db8`

| Gate | Result |
|---|---|
| exact Render revision | PASS: `/api/health` reported `a158229e20b5416395f32395bd2e14039c765db8` |
| authenticated owner API/UI parity | PASS: selected property `542352127`, `Europe/Amsterdam`, USD, three saved filters, 21 daily rows, 15 breakdown rows, five financial values, eight Data Summary values, three raw channel rows, tracker values, 12 visible findings, and three hidden findings matched the exact page-consumed inputs |
| every Trends metric and surface | PASS: Daily selected Sessions, Users, Conversions, Revenue, Page Views, and Engagement Rate; 7d/30d exact incomplete-window states passed; Monthly selected every eligible metric; every visible table row and chart series matched production functions |
| tenant isolation and cleanup | PASS: one authorized ephemeral Clerk-only non-owner received 404; its session was revoked, the exact user was deleted, and cleanup completed before success |
| deterministic scheduler | PASS: campaign-scoped manual run completed at `2026-08-05T19:04:33.463Z`, alerts were suppressed, property/timezone/cutoff stayed exact, and rows remained 21 |
| post-scheduler parity | PASS: owner-only read-only parity passed again with temporary-user creation disabled and unchanged scoped values |
| persistence safety | PASS: parity transactions were read-only and rolled back; only the authorized campaign-scoped daily refresh and direct KPI/Benchmark recompute mutated live inputs |

The certified real-property production dataset has incomplete adjacent 7d/30d windows, so production evidence proves the exact unavailable/coverage state. Complete-window numeric totals, weighted rates, deltas, tables, and chart inputs are exercised through the actual shared production functions in the focused regression suite. The `yesop` simulation is excluded because its test-only breakdown window contract is not the real GA4 provider contract.

## Historical Production Correction Evidence — `2a2dab20071bf4c2f7deb4362678151a98fc9b66`

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

## Certification Gates And Invalidation Rule

All required gates passed on the historical frozen boundary:

1. focused and affected shared/auth/isolation/source/scheduler tests passed
2. TypeScript and production build passed
3. the machine certification checker passed
4. focused commits were pushed
5. Render health identified the exact reviewed revision
6. authenticated non-owner access failed closed
7. authenticated owner APIs proved campaign/property/filter/window/source parity
8. every live browser value and state matched those API responses
9. the deterministic campaign-scoped daily pipeline completed and post-run live inputs remained in parity
10. dependency and non-secret configuration hashes matched the reviewed boundary

The certification remains valid only for the recorded SHA, dependencies, configuration fingerprint, and exclusions. Any relevant change or contradictory production result immediately invalidates this certification until a new exact-revision packet passes.
## Known Limitations And Remaining Validation

- The current production property/filter has sparse activity rows and does not contain two complete adjacent 7-day or 30-day windows. The correct live behavior is an exact coverage/unavailable state, not a fabricated comparison.
- Google Ads has no authorized live test account and is excluded from this certification. LinkedIn, Meta/Facebook, and Instagram are not enabled as Insights inputs in this release.
- Reports, PDFs, scheduled reports, report schedulers, and email delivery are outside the Insights certification definition.
- The historical `ee22f0e470826f1cb247115497c9a15229d0142d` boundary had no remaining production-only validation. The current release-candidate boundary is recorded in the controlling status block; final production certification and the final combined GA4 certification remain intentionally unperformed.

## Historical Note

Earlier documents described bounded copy, grouping, visual, and report-parity work. Those statements are historical only and were invalidated by this audit. Reports-owned behavior is intentionally absent from the current Insights status and evidence boundary.
