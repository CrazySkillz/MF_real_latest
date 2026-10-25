# Batch 6: Deferred-source isolation and included Ads

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 6 status

**Publication checkpoint, October 25:** The tested ordinary-refresh overlap correction and goal-lifecycle evidence accompany the user-authorized commit/push to `main`. Render deployment remains unverified. The local/uncommitted statuses below describe earlier validation checkpoints; their evidence and remaining acceptance limits are unchanged.

**Latest overlap correction, October 25:** The remaining ordinary Google Ads refresh overlap under V1-024/V1-055 was reproduced locally on deployed `3e285b9d`: an older response can replace committed newer facts before their separately written success timestamp. The [localized correction](#ordinary-refresh-overlap-correction-october-25) commits facts and their timestamp in the same existing storage transaction. **232/232 checks in nine files pass**, including 12 new overlap/rollback/empty-window cases; TypeScript and the server build pass. This runtime correction is **uncommitted and not deployed**. No production occurrence or damaged data is claimed. All nine release acceptances remain OPEN.

**Deployment and lifecycle checkpoint, October 25:** The saved-goal correction is committed, pushed and deployed in `3e285b9df14bb8be2a8e4acf79262c684a3e8ae0`. [Public verification](validation-2026-10-24/goal-values-deployment-oct25.json) confirms that revision, HTTP 200 and `ok: true`; this proves health/revision only. The [post-deployment local lifecycle checks](#goal-lifecycle-and-scheduled-consumer-verification-october-25) pass **266/266 across seven files**, including **34 new HTTP/PostgreSQL/scheduled-notification cases**. TypeScript passes. This checkpoint changes tests/documentation only; application code and production records are unchanged. All nine Batch 6 release acceptances remain OPEN.

**IN PROGRESS.** The [ordinary-refresh correction](#ordinary-google-ads-refresh-write-guards-october-25) and earlier ratio corrections are committed and pushed in `9f7a40db5be72b89d256c44d94db730ae279d399`. [Public deployment verification](validation-2026-10-24/refresh-guards-deployment-oct25.json) on October 25 confirms that revision, HTTP 200 and `ok: true`; this proves revision/health only. The pre-deployment validation has **436 focused checks passing in 11 files**, including 57 new PostgreSQL/caller/baseline controls; TypeScript and both builds pass. A separate source-safety run retains the same **82 passed / 6 failed** static assertions. Latest evidence per file including earlier packets is **705 passed, 6 failed, zero skipped, 27 files**. All 9 V1 release acceptances remain OPEN; 10 provider-functional findings remain DEFERRED. This is not Batch 6 completion or a production-readiness certificate.

The [saved-consumer correction](#saved-goal-value-correction-october-25) is deployed under V1-128: explicit automatic/saved provenance, a shared read-only Google Ads goal resolver, and aligned goal cards, alerts and KPI/Benchmark report values. Its original **72 acceptance cases pass**. Pre-deployment expanded validation was **426 passed / 4 failed / 0 skipped in 19 files**, including 17 frozen pre-fix characterization cases; all four failures independently reproduced on `9f7a40db`. TypeScript and both builds passed. The newer lifecycle packet above adds evidence without changing the correction. The full remaining inventory below remains authoritative; this is not Batch 6 completion.

### Certification reconciliation and progress reporting, October 25

The nine OPEN rows are original audit assignments with partial corrections and outstanding acceptance, not a count of nine newly discovered or still-unfixed bugs. The four remaining work blocks described in conversation group overlapping verification work; they are not an estimate of four fixes, commits or deployments. Report confirmed unfixed defects, implemented corrections awaiting verification, and unreviewed paths separately before proposing more code changes.

Earlier evidence must be reused within its proven, unchanged boundary. The [main Google Ads tracker](../../../GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md#current-status) approved the implemented local test-mode path and explicitly left live OAuth acceptance open. The [Google Ads child Spend record](../../../GA4/OVERVIEW_SPEND_GOOGLE_ADS_GATE_STATUS_2026-09-22.md#decision-and-boundary) explicitly issued no certificate. The [GA4 Reports certificate](../../../GA4/REPORTS_CERTIFICATION_2026-09-21.md#decision-and-exact-boundary) did certify its specified GA4 surface; it neither certifies Google Ads reports nor justifies reopening unrelated GA4 report behavior. The [October 20 whole-app audit](../../audits/v1-2026-10-19/FINAL_AUDIT_DISPOSITION.md) was completed with a NO-GO decision, not an application certificate.

Before reopening a previously certified path, identify the relevant code/configuration change or contradictory reproducible evidence and its exact dependency impact. An unexecuted check alone is not a confirmed application defect or authorization for a speculative fix. For each further runtime correction, record the failing pre-change case and test the fixed case plus affected neighbors. Provider/deployed evidence gaps remain explicitly unverified and must not be converted into guessed code changes. This reconciliation changes no application code, does not reset unrelated certificates and closes no acceptance item.

## Saved goal and report value check, October 25

This subsection is the historical pre-fix checkpoint at `9f7a40db`; its unchanged-code and unfinished-fix statements are superseded by the correction below. The characterization fixture is frozen to those Git objects so a future passing run cannot be mistaken for current acceptance.

**Confirmed pre-existing mismatch; not yet corrected.** The actual `getLiveMetricValue` on the Google Ads page uses current metric inputs. `resolveCampaignCurrentValueForAlert` returns platform-level Google Ads rows unchanged, and `resolveAlertCurrentValueForDecision` then returns them because they are not GA4 rows. The KPI scheduler and Benchmark notification path call this resolver before threshold evaluation. The generic scheduled Google Ads KPI/Benchmark PDF builder separately reads stored `currentValue`. Therefore a saved CPC of 1 and a current CPC of 10 can produce different page and alert/report values. For a threshold above 2, the tested saved value does not trigger while the current value does; the reverse discrepancy is also reproduced.

The [17-case characterization suite](../../../server/v1-batch6-google-ads-saved-consumers.test.ts) executes actual page, resolver, alert-evaluator and report-builder declarations from both current `9f7a40db` and original audit `777aae6f`, with synthetic inputs and captured renderer calls. Both revisions reproduce the saved/live disagreement and null-to-zero report formatting. The current page correctly reports CPC unavailable without clicks, while a previously stored zero remains eligible in the tested below-threshold alert case. Matching saved/current and intentional manual-input controls are included. **Passing characterization assertions prove the mismatch exists; they do not mean the feature passes acceptance.** No actual live false alert, PDF or delivery is claimed.

[Packet](validation-2026-10-24/saved-consumers-audit-final-oct25.json): **35 executed assertions passed**, comprising 17 characterization cases and 18 existing neighboring regressions, zero failed/skipped. [Assessment and exact file hashes](validation-2026-10-24/saved-consumers-audit-evidence-oct25.json). Application code is unchanged. No provider, user browser, account, production database or email access occurred. This adds evidence under the existing V1-128 saved/manual/alert/report gap, with the existing V1-106 report-availability dependency; it adds no finding ID. V1-060 historical snapshot behavior stays assigned to Batch 7 and is not duplicated here.

[TypeScript validation](validation-2026-10-24/saved-consumers-audit-oct25-build-checks.json) passes for the added fixture. Earlier aggregate pass counts remain tied to their original correction packets and do not count these reproduction assertions as feature acceptance.

**Required compatibility boundary before a fix:** current-value fields in both Google Ads goal modals are editable, and the page save payload does not record whether a number came from automatic prefill or a manual override. Replacing every saved value with a live value could change intentional user input. Existing-row origin must not be guessed. A safe correction must preserve manual input while aligning source-backed values, unavailable states and date/currency scope. Source-backed resolver implementation, persisted provenance, full goal lifecycle and complete scheduled/report acceptance remain unfinished. Other report templates, PDF layout, snapshot access and provider/deployed behavior are outside this diagnostic packet.

## Saved goal value correction, October 25

**Deployed correction; release acceptance remains OPEN.** This addresses the reproduced saved/live mismatch above, under existing V1-128 and its V1-106 report-value dependency. It does not add an audit finding or reopen unrelated certified GA4 behavior.

### Exact change and compatibility

- Both Google Ads goal forms persist `calculationConfig.currentValueMode` through the existing JSON contract. New goals default to `automatic`; existing untagged goals remain saved/manual until the user explicitly selects automatic updates. Existing values/configuration are not migrated, guessed or overwritten. The current-value input remains editable for saved values, including zero. Cards identify automatic versus saved values.
- `resolveAlertCurrentValueForDecision` now resolves only explicitly automatic Google Ads goals. It reads the existing main connection and daily storage path, filters selected provider campaign IDs, uses 90 completed campaign-local dates bounded by campaign start, preserves fractional conversion credit, and computes ratios from summed inputs. Missing denominators, missing/invalid records, stale live refreshes, incompatible revenue currency, unavailable exact Search Impression Share, disconnected/wrong-campaign/Spend-only/unsupported sources and production test-mode sources fail closed. Imported revenue uses the existing dated `google_ads` total; native conversion value remains distinct. Revenue without a materialized in-window source is unavailable, not an inferred zero.
- The resolver rechecks campaign/connection identity after reads. A disconnect, selection/currency change or refresh during the tested read cannot publish a mixed result. This does not prove edit-then-restore races, provider coverage or atomicity across independent page requests.
- The existing platform KPI/Benchmark GET routes retain access checks and array contracts. Page goal cards, progress trackers, goal Insights and edit values consume their resolved rows. The existing KPI/Benchmark notification and immediate/scheduled email decision callers already use the same resolver; no email delivery code or provider calls were added.
- Google Ads KPI/Benchmark PDF generation uses that resolver, preserves null as `Unavailable`, and reads benchmarks from the exact platform/campaign rather than every campaign benchmark. The PDF identifies current automatic/saved values instead of implying historical period reconstruction. Other report builders are unchanged. Historical snapshot semantics remain V1-060 in Batch 7.
- `getGoogleAdsConnection` adds an optional `migrateLegacyTokens: false` read option. These goal reads cannot trigger credential migration. Default migration and durable refresh ownership behavior are covered by actual-method tests and remain unchanged. No schema migration, new endpoint, dependency, provider write or persisted-data repair was introduced.

### Evidence and lifecycle boundary

[New actual-code suite](../../../server/google-ads-goal-values.test.ts): **72/72 pass**. It executes the resolver, page goal/save calculations, GET handlers, storage credential-read method and PDF builder with isolated dependencies. Cases include all 17 supported metric identities/aliases, multi-day fractional inputs, automatic/manual/legacy values, explicit zero, source errors, midnight/timezone boundaries, concurrent source/ownership changes, access denial and platform-scoped reports. Captured PDF renderer calls prove values, not rendered layout or actual email delivery. The [final ownership/GA4 packet](validation-2026-10-24/goal-values-ownership-oct25.json) passes **177/177** after the final guard includes campaign owner/client identity.

[Final expanded packet](validation-2026-10-24/goal-values-final-oct25.json): **426 passed / 4 failed / 0 skipped across 19 files**. The 426 includes 17 historical characterization cases, which remain reproduction evidence rather than feature acceptance. The four failures are older exact-text expectations in `google-ads-revenue-platform-context.test.ts` and `google-ads-revenue-scheduler-flow.test.ts`. [Independent deployed-baseline execution](validation-2026-10-24/goal-neighbor-baseline-oct25.json) reproduces all four against `9f7a40db`; they are left visible and are not fixed by weakening assertions. They are separate from the six earlier `source-safety-regression.test.ts` failures. The latest union is not claimed as a fresh whole-repository run.

[Client/server build packet](validation-2026-10-24/goal-values-build-oct25-build-checks.json) passes. After the final ownership guard, [TypeScript and server build](validation-2026-10-24/goal-values-ownership-oct25-build-checks.json) pass; client code was unchanged after its successful build. [Current file hashes and result manifest](validation-2026-10-24/goal-values-evidence-oct25.json).

| Lifecycle / consumer | Proven or traced here | Remaining limit |
| --- | --- | --- |
| Add/edit | Actual save handlers retain mode, manual zero and existing config; blank/unavailable saves rejected. The later lifecycle packet executes POST/PATCH/PUT -> schemas -> PostgreSQL -> resolved GET, including immutable campaign/platform identity. | Authenticated deployed forms and real Clerk/session middleware remain unexecuted. |
| Goal delete | Later HTTP/PostgreSQL cases prove exact parent/child deletion, notification soft-hide/history retention, unrelated record preservation, retry 404 and rollback after final-write failure. | Concurrent deletion versus independent alert workers and deployed UI interaction are not covered by those sequential cases. |
| Source edit/disconnect/refresh | Resolver tests reject unavailable or concurrently changed sources; existing disconnect and scheduler neighbor tests pass. | Full provider lifecycle, restart/retry and edit-then-restore cases remain open. |
| Lists/cards/trackers/Insights | Same resolved row value and unavailable state; actual tracker/Insight fixtures pass. | Live visual acceptance not performed. |
| Alerts/email decisions | Shared resolver and actual threshold checks agree; later actual scheduler/notification functions persist matching automatic/manual/zero values in PostgreSQL and suppress unavailable-source alerts. GA4/notification-concurrency neighbors pass. | Timer dispatch, deployed scheduling and actual email delivery are not asserted. |
| KPI/Benchmark reports | Actual builder captures correct automatic, saved and unavailable values with exact platform scope. | PDF layout, all templates and immutable historical snapshots remain open. |
| Historical/damaged records | No records rewritten; legacy provenance is not inferred. `captureEndOfPeriod` has no current production caller and is unchanged. | Provider truth, historical source contamination and broader saved-output cleanup remain unverified. |

No user browser, provider account, production database or delivery service was accessed. This is a bounded local correction, **not completion of work block 1 or Batch 6**. The four existing work blocks remain the planning grouping; all nine Batch 6 release acceptances remain OPEN.

## Goal lifecycle and scheduled consumer verification, October 25

This is verification of deployed `3e285b9d`, not another runtime correction. The [new 34-case suite](../../../server/google-ads-goal-lifecycle-postgres.test.ts) mounts the actual extracted route callbacks and access helpers in a localhost Express fixture, runs the real shared insert schemas and `DatabaseStorage` methods against PostgreSQL, and executes the actual imported KPI scheduler and Benchmark notification functions. Provider facts are synthetic. Clerk claims and route-triggered dispatch are controlled adapters; scheduled-consumer cases call the real job functions separately. The disposable tables include current schema columns, defaults, nullability, primary keys and declared CHECK constraints; this is not verification of production migrations or the entire production schema catalog.

- Both KPI and Benchmark create/edit/list flows persist `currentValueMode`, preserve unrelated JSON options and manual zero, resolve automatic CPC from selected facts, and leave stored values untouched on reads. Legacy/null values are preserved until explicitly switched. Spoofed campaign/platform edits cannot move a goal; unauthenticated/foreign-owner mutations, missing parents and wrong-platform goal IDs are rejected. Neighboring campaign/platform rows remain unchanged.
- Both delete routes remove only the selected goal and its existing child rows, retain notifications with the correct dismissal metadata, preserve other-goal/other-campaign/malformed notices, and return 404 on a repeated delete. A fixture trigger forces the final parent delete to fail; the real transaction restores the notification state and all child rows.
- Fourteen scheduled-consumer cases cover automatic breach with saved zero, automatic clear with a saved breach, manual override, manual zero, missing denominator, disconnection and measured zero. They assert persisted in-app notification amounts and goal identity, not only a mocked threshold result. For example saved CPC 137 with current CPC 10 and threshold 20 produces no automatic alert; saved/manual 137 does. No email is sent.

[Final packet](validation-2026-10-24/goal-lifecycle-complete-oct25.json): **266 passed / 0 failed / 0 skipped in seven files**, including the 34 new cases, 72 existing goal-value cases and 160 shared GA4/notification cases. [TypeScript](validation-2026-10-24/goal-lifecycle-complete-oct25-build-checks.json) passes. Runtime code is unchanged, so the previously passing builds remain applicable; no new build/deployment is needed for these test-only additions. [Evidence and cleanup record](validation-2026-10-24/goal-lifecycle-evidence-oct25.json).

The initial new fixture omitted two closure dependencies; binding the actual notification-platform helpers resolved those harness failures. The expanded packet also exposed an older notification concurrency fixture missing `getGA4PublicationVersion` and `writeGA4DerivedChange`, so its Benchmark case never reached the intended advisory-lock contention. Four test-only lines now provide those dependencies and execute the callback inside a real PostgreSQL transaction. Its original contention/history assertions pass unchanged. That fixture does not claim to validate publication ownership; the existing storage suites retain that responsibility. The four earlier static goal-neighbor failures and six earlier source-safety failures remain separately OPEN; the green seven-file packet does not erase them or represent a whole-repository run.

This closes the previously unexecuted **local goal HTTP/storage round trip, sequential goal deletion/notification retention, and scheduled decision-to-notification** checks. Still unverified: actual provider truth, production schema/data, authenticated deployed interaction, all report templates/rendered layout, historical snapshot/data isolation, full source mutation/restart/retry/concurrency lifecycle, and final release acceptance. No production data or browser was accessed. All nine release acceptances remain OPEN; Batch 6 and the four work-block plan remain in progress.

## Ordinary refresh overlap correction, October 25

**Root cause and exact reproduced path.** Manual `POST /api/google-ads/:campaignId/refresh` and the periodic `refreshAllGoogleAdsMetrics` call the same `refreshGoogleAdsForCampaign` -> `fetchRealGoogleAdsData` path. The ordinary storage methods checked campaign/source/connection inputs under locks, then committed replacement facts. The caller updated `lastRefreshAt` in a separate transaction. In that gap, another response with the same captured timestamp could pass the guard and overwrite the first response. The first worker's later metadata write could then fail, despite its facts already having been replaced. The same gap existed for the main table and the dedicated GA4 Spend table.

The [pre-change actual-caller/PostgreSQL packet](validation-2026-10-24/refresh-overlap-caller-before-oct25.json) has **57 passed / 6 failed / 0 skipped** against unchanged deployed runtime code. Four cases reproduce the fact/timestamp atomicity failure; two control actual overlapping schedulers so a newer EUR 25 response commits its facts while the older EUR 5 response is pending. Before the correction the older response succeeds, instead of being rejected. This is the already-listed overlap acceptance gap, not a new finding ID or proof of production damage.

**Smallest correction.** Only `server/storage.ts` and `server/google-ads-scheduler.ts` change at runtime. For ordinary calls carrying `googleAdsRefresh`, each existing daily replacement transaction writes its matching connection's `lastRefreshAt` after successful inserts, verifies one connection row changed, and commits both together. The marker advances by at least one millisecond so distinct completions cannot reuse the same captured timestamp. The caller's expected connection advances only after the transaction commits. The scheduler omits its now-redundant ordinary metadata write. Existing durable `refreshScope` completion remains on its owned path. No schema, return shape, provider query, formula, selection, date window, schedule or frontend change was introduced.

**Validation.** The existing [refresh PostgreSQL suite](../../../server/v1-batch6-google-ads-refresh-postgres.test.ts) grows from 57 to **69 cases**, including the existing historical `8a9da324` characterization. The 12 added cases cover both connection tables: stale overlapping response rejection, rollback when metadata writes throw or affect zero rows, consecutive completions at the same millisecond, successful empty-window replacement without stale resurrection, and the two actual overlapping scheduler cases. The unchanged owner/client/campaign/source/currency/selection/disconnect/credential and downstream guards continue to pass. The caller unit test now rejects a separate ordinary freshness write and explicitly asserts that durable completion still performs its owned metadata write; the atomicity proof comes from actual SQL, not that mock.

[Final packet](validation-2026-10-24/refresh-overlap-final-oct25.json): **232 passed / 0 failed / 0 skipped in nine files**. This includes one existing historical characterization case, plus current refresh, timeout/recovery, dedicated/legacy Spend isolation, disconnect, goal lifecycle, alert and report-value neighbors. [TypeScript/server build](validation-2026-10-24/refresh-overlap-oct25-build-checks.json) and `git diff --check` pass. The client is unchanged. [Exact hashes, result inventory and local database cleanup](validation-2026-10-24/refresh-overlap-evidence-oct25.json).

**Remaining boundary.** This proves the exercised ordinary fact/freshness overlap and rollback behavior; it does not make the entire multi-stage Spend refresh one transaction or validate every independent worker/restart/retry. Full add/edit/delete/reconnect source lifecycles, edit-then-restore, retained legacy import races, other providers, provider completeness, authenticated deployed UI/API, all report templates and historical data remain open. No browser, provider account, production database or email was accessed; no historical rows were repaired. The earlier four goal-neighbor and six source-safety static failures remain recorded outside this green packet. The correction is local and uncommitted; `3e285b9d` remains the last verified deployment. Batch 6 and whole-app release acceptance remain OPEN/NO-GO.

## Ordinary Google Ads refresh write guards, October 25

### Root cause and exact path

The ordinary `refreshAllGoogleAdsMetrics` / manual refresh -> `refreshGoogleAdsForCampaign` -> `fetchRealGoogleAdsData` path checked campaign eligibility before provider I/O. Its token, daily-fact replacement and metadata writes did not recheck the original connection/campaign under the write transaction. The later Spend materialization/cache path also omitted the original source mapping/connection identity. A reconnect, disconnect, owner/status change or mapping edit during provider I/O could therefore be followed by an old response writing into the current campaign. The new PostgreSQL suite executes the deployed `8a9da324` replacement method against the same disposable fixture and reproduces a write after connection deletion; no production occurrence is claimed.

### Localized correction

- The ordinary scheduler passes internal campaign, connection, dedicated/main identity and (for Spend) source snapshots through the existing storage options. The independent durable `refreshScope` path retains its existing ownership rules.
- A private Google Ads assertion in `server/storage.ts` checks current values under parent -> source -> connection row locks. Parent checks cover identity, owner/client, active status, currency, timezone, start date and creation identity. Connection checks cover a single exact identity, provider account/manager, mode, selection, credentials and last successful refresh. Source checks cover exact active same-campaign GA4 Google Ads identity, mapping and currency, including absence during setup preview.
- The checks run before token renewal saves, main/dedicated daily replacements, successful-refresh metadata, normalized Spend replacement, campaign Spend cache writes and downstream snapshot invalidation. A changed boundary throws `GOOGLE_ADS_REFRESH_INPUTS_CHANGED` before that write; the existing caller error path prevents subsequent materialization/jobs. Previously committed valid stages are not silently deleted or rolled back across transactions.
- Successful token/metadata saves advance the in-memory expected connection. Hydrated credential comparison tolerates legacy encryption migration; legacy plaintext refresh credentials are preserved when saving renewed tokens. Temporary service-account access tokens remain runtime-only and the configured manager fallback is normalized consistently with the existing hydrator.
- Main platform, dedicated Spend and legacy main-table Spend stay distinct. The explicit same-campaign Spend draft-preview exception remains; ordinary draft refresh is rejected. Existing source definitions, provider queries, formulas, schedules, API response shapes and schema are unchanged.

Runtime files: `server/google-ads-scheduler.ts`, `server/storage.ts`. The private assertion stays in the existing persistence layer and reuses existing transactions/locks; it is not a replacement refresh pipeline. Tests: new `server/v1-batch6-google-ads-refresh-postgres.test.ts`; existing `google-ads-spend-production-path.test.ts` and `ga4-google-ads-scheduler-regression.test.ts` mocks/assertions now include the internal options and actual successful storage return shape. The same commit includes the earlier page corrections documented separately below.

### Executed evidence

- [Manifest with runtime/test hashes and per-file packets](validation-2026-10-24/refresh-guards-evidence-oct25.json).
- [Database packet](validation-2026-10-24/refresh-guards-pg-final-oct25.json): **210 passed / 0 failed / 0 skipped**. Includes the 57 new cases plus 64 existing durable input-invalidation cases, 84 revenue-publication cases and 5 disconnect transaction controls. New cases cover current-value changes to owner/client/status/currency/timezone/start/parent, disconnect/reconnect/account/credential/refresh-time changes, mapping/source deletion/deactivation/recreation, duplicate connections, selected campaigns, main/dedicated separation, rollback, other-campaign preservation, draft preview, legacy Spend, service-account credential/manager behavior, real scheduler calls and cache/downstream stopping. Concurrent edit tests observe PostgreSQL lock waiting before allowing the edit to commit, then prove the old save is rejected.
- [Neighbor packet](validation-2026-10-24/refresh-guards-neighbors-final-oct25.json): **226 passed / 0 failed / 0 skipped** across 7 files, including production Spend flow, service-account controls, deferred-source isolation, retained import and the earlier 76 page-value cases.
- [Fresh source-safety packet](validation-2026-10-24/refresh-guards-source-safety-oct25.json): **82 passed / 6 failed**, the same six previously reproduced static failures. They remain unresolved; no new failure is hidden by the focused 436-pass count.
- [TypeScript, production client/server builds](validation-2026-10-24/refresh-guards-final-oct25-build-checks.json) pass. `git diff --check` passes. Disposable schema count verified **0** and the local PostgreSQL fixture stopped. Provider responses were synthetic; no user browser, provider account or production data was accessed.
- Initial fixture-only failures were corrected: provider stubs omitted required response fields; a Spend source created today was correctly excluded from completed-day totals; old mocks returned no saved connection or omitted the newly required internal options. Runtime behavior was not weakened to make those cases pass.

### Acceptance limits and next boundary

The ordinary checks compare **current input values under locks**, not a persisted input revision or job lease. Edit-then-restore, ordering of simultaneous provider responses with otherwise identical inputs, and every restart/retry remain unproven. Changes between snapshot invalidation and independently scheduled downstream computation still require the full job-level ownership matrix. Resource-grant revocation during service-account I/O is not certified by these fixtures. The separate retained spend-import endpoint and deferred-provider writers have not acquired this new ordinary Google Ads guard.

No historical fact/source/snapshot repair was attempted. Add/edit/delete are exercised as boundary changes around this refresh, not certified as entire source lifecycles. Source-list/report/browser acceptance, scheduled goals/alerts/reports, full financial propagation and provider truth retain the earlier open inventory. V1-024 and V1-055 receive partial local evidence, not release closure; all nine Batch 6 findings and whole-app **NO-GO** remain.

## Google Ads ratio availability, October 25

### Root causes, trace and correction

`GoogleAdsClient.getDailyMetrics` -> `mapGoogleAdsDailyInsights` -> stored daily rows -> existing daily-metrics endpoint -> `google-ads-analytics.tsx` was traced for these values. The page calculates ratios independently in its summary, daily chart, campaign breakdown, rolling series and period comparisons. Each used zero when its denominator was zero; the daily chart additionally omitted Cost/Conversion. Several render/live-goal branches then converted unavailable inputs back to zero. Comparisons manufactured a percentage change when the prior value was zero.

The existing calculations now retain unavailable ratios; finite formatters display `Unavailable`, chart callbacks emit `null` gaps, and undefined comparisons have a neutral dash. Actual zero numerators with positive denominators remain zero. Daily Cost/Conversion uses summed spend / summed conversions, including fractional conversions (150 / 1.5 = 100). Summary, daily, campaign, rolling and comparison formulas are preserved for valid inputs. The live goal resolver, Insights wording and trend guards preserve availability instead of scoring or describing a fabricated value.

Search Impression Share previously used a simple average across campaign/date observations. The provider query and saved schema have no eligible-search-impression denominator. [Google's field definition](https://developers.google.com/google-ads/api/fields/v25/metrics#metrics.search_impression_share) also specifies that values below 0.1 are returned as 0.0999; the existing mapper stores that as 9.99%. The page now preserves a single exact observation from 10% through 100%, and keeps combined, missing, censored or out-of-range shares unavailable. **Multi-row Search Impression Share will display Unavailable** until an exact provider aggregate or suitable denominator exists; this change deliberately does not estimate one or treat 9.99% as an exact share. Its unavailable state reaches the live goal resolver and suppresses unsupported share Insights.

Runtime change: only `client/src/pages/google-ads-analytics.tsx`. Regression changes: `server/v1-batch6-google-ads-values.test.ts` and one expected formatter expression in `server/google-ads-revenue-kpi-benchmark-ui.test.ts`. No server/provider/storage/schema/connection/scheduler behavior or persisted data changed in this checkpoint. The diff spans each existing calculation and consumer to prevent one corrected card from still feeding false zeros to another display; it adds no new runtime abstraction.

### Validation

- [Evidence manifest](validation-2026-10-24/ratios-evidence-oct25.json), including code hashes, deployment revision observation, packet identity and explicit inherited evidence boundaries.
- Before correction: **51 passed / 22 failed** in the 73-case actual-code calculation packet. The expanded final page suite has **76 passing cases**, 28 more than the deployed baseline, covering zero and positive denominators, fractional Cost/Conversion, missing/censored/exact/multiple shares, finite formatting, chart gaps, comparison availability and Insights propagation.
- [Final fresh packet](validation-2026-10-24/ratios-final-oct25.json): **253 passed / 0 failed / 0 skipped in 12 files**, including page/goal/Overview/connection semantics, provider mapping, dedicated Spend, retained import, isolation and scheduler neighbors. Actual page declarations and chart callbacks execute with synthetic inputs; this is not rendered-browser or provider acceptance. One old exact-string assertion was updated for the new finite formatter; the actual Insights calculation has separate executable coverage.
- [TypeScript, production client and server builds](validation-2026-10-24/ratios-final-oct25-build-checks.json) pass. Credentials were removed and test outbound access restricted to loopback. No user browser, provider account, production database or historical data was accessed. No commit, push or deployment performed for this new checkpoint.
- The six earlier source-safety static failures remain unresolved. The **579/6/0** latest-per-file total includes retained earlier evidence, not a fresh 24-file or whole-repository run.

### Scheduler boundary traced at the ratio checkpoint

Read-only trace: `refreshAllGoogleAdsMetrics` reloads connections through storage and calls `refreshGoogleAdsForCampaign`; its parent/owner/status checks run before `fetchRealGoogleAdsData`. Ordinary refreshes supply no `refreshScope`. `fetchRealGoogleAdsData` therefore omits expected connection options from token, daily-replacement and final-refresh-time writes. In `storage.replaceGoogleAdsDailyMetricsForWindow`, source/connection checks and the ownership wrapper run only when `refreshScope` is present; the ordinary branch performs its replacement in a transaction without rechecking the parent or connection. The corresponding dedicated Spend ordinary-refresh branch must be included in the eventual correction.

This identified an unguarded final-write boundary after provider I/O. The subsequent [ordinary refresh checkpoint](#ordinary-google-ads-refresh-write-guards-october-25) corrects the current-value transaction boundary with PostgreSQL/caller evidence. It does **not** prove a production race occurred, or certify all job/revision/response-ordering paths. V1-024/V1-055 remain open.

### Lifecycle and remaining acceptance

| Path | Current evidence and limits |
|---|---|
| Add/edit | Live page resolver and existing goal-form/save tests pass; not all source lifecycle/provenance paths |
| Delete/deactivate | No delete mutation changed; earlier transaction/publication controls remain, ordinary in-flight refresh boundary unresolved |
| Refresh/scheduler/reprocess | Existing guard neighbors pass; final-write race, retry/restart and full source matrix remain unverified |
| Source/modal/list and cards | Existing revenue UI neighbors pass; corrected page calculations/formatters run locally, no authenticated browser acceptance |
| Totals/KPIs/benchmarks | Corrected local ratios and live-goal propagation tested; saved/manual provenance and scheduled recomputation remain open |
| Reports/alerts/export | Complete propagation and historical outputs remain unverified; no readiness inferred from page tests |
| Existing damaged data | No data cleanup attempted; historical synthetic/unverified attribution and saved outputs still need exact inventory |

Other open value paths include provider zero-row completeness, historical numeric/currency validity, midnight/reprocess behavior and remaining fractional-conversion display rounding. All nine Batch 6 acceptance rows below stay OPEN. Whole-app status remains **NO-GO**.

## Retained attribution and spend boundaries, October 25

### Confirmed causes and exact corrections

- **V1-046:** the shared enrichment utility gives the full 90-day GA4 campaign-name revenue pool to each matching provider campaign and spreads it over spend dates. A name or manual UTM mapping does not prove the provider source or sale date. The Google Ads branch now refuses this unverified enrichment before GA4/provider reads or writes. Its existing storage writer also refuses nonempty updates. `getGoogleAdsDailyMetrics` returns the existing nullable enrichment fields as `null`; native amounts, dates, spend, selection identifiers and persisted rows remain intact. The current aggregate/outcome/trend descriptors explicitly keep the excluded amount unavailable, preserving imported Google Ads revenue separately. This is effective exclusion at the exercised current Google Ads boundaries, not a new attribution model. Deferred Meta/LinkedIn enrichment is unchanged.
- **V1-055:** the retained `POST /api/campaigns/:id/spend/ad-platform/import` read unselected facts, labeled amounts USD, looked up a source in the default GA4 context, deleted then inserted outside a transaction, and wrote the shared campaign spend cache from GA4 totals. It now validates completed campaign dates, the real same-campaign connection and selected IDs, exact row scope, finite nonnegative spend, unique campaign/date facts, and persisted matching currency. It reads only the requested platform context, rejects ambiguous source selection, and uses the existing `replaceSpendSourceWithRecords` transaction with the previous mapping as a compare-and-set guard. It no longer overwrites the shared GA4 spend cache.
- **Compatibility consequence:** Google Ads, Meta and LinkedIn legacy daily tables do not carry persisted currency. This retained import therefore returns an explicit 409 and preserves existing spend for those facts; it does not guess their currency from a campaign setting. Repository search found no current frontend or scheduled caller of this exact endpoint. The current GA4 Google Ads Spend wizard uses the separate existing process/materialization path and its checks pass. Unknown external callers and historical legacy sources still need inventory. TikTok's currency-bearing positive control is synthetic; its provider functionality remains deferred.

Runtime changes in this checkpoint are limited to `server/utils/ga4RevenueEnrichment.ts`, `server/storage.ts`, `server/routes-oauth.ts`, and `server/scheduler.ts`. No schema, provider client, dependency, connection record, persisted source or historical report was changed. The earlier Batch 6 work is included in the same user-authorized publication.

### Trace and validation boundaries

| Path | Current evidence | Remaining limit |
|---|---|---|
| Enrichment create/update | Actual shared utility rejects Google Ads before reads/writes; direct storage writer rejects nonempty updates | Deferred providers unchanged; no exact GA4 provider/date attribution implemented |
| Existing enriched rows | Real PostgreSQL read returns null enrichment while stored EUR/native facts and original enriched columns remain unchanged | Historical saved snapshots/reports not rewritten or inventoried |
| Current reads/downstream | All repository current Google Ads daily consumers use the storage reader; main daily/list API, Spend readers and aggregate paths retain native fields. Actual aggregate preserves imported revenue 100 and native conversion value 25 while withholding fabricated enrichment 999 | Direct route/report/scheduled-goal acceptance is not complete; old saved outputs remain unverified |
| Retained spend add/edit | Actual route rejects invalid selection, currency, dates, malformed amounts, duplicates, simulated data, foreign source context and ambiguous source selection; zero is preserved | Positive currency-bearing test is synthetic TikTok data, not provider acceptance; owner/connection changes during a request remain unproven |
| Replacement/failure | Real PostgreSQL proves exact campaign/platform/source replacement, mapping conflict rejection and rollback of source metadata plus deleted facts on insert failure, including failed creation | No change to other importers or historical cleanup; full lifecycle/reconnect races remain open |
| Delete/refresh/neighbors | Existing GA4 publication 84 cases, GA4 Spend path and saved Overview controls pass in the current packet | This is not all paid-source deletion/scheduler/recovery acceptance |

- [Current evidence manifest](validation-2026-10-24/retained-boundaries-evidence-oct25.json): **542 passed / 6 failed / 0 skipped across 22 files**, selecting the latest executed result per file. The [fresh final packet](validation-2026-10-24/retained-boundaries-final-oct25.json) is **426 passed / 6 failed / 0 skipped across 14 files**. No full-repository run is claimed.
- Before correction, actual enrichment cases were **1 passed / 2 failed**, and actual retained-import cases **1 passed / 26 failed**. Current new enrichment/import cases all pass; the expanded PostgreSQL file passes **9/9** and the aggregate file **82/82**.
- The six remaining failures in `source-safety-regression.test.ts` independently reproduce on deployed `2c3097bc` ([baseline](validation-2026-10-24/retained-source-deployed-oct25.json): 82 passed / 6 failed). They assert older revenue-deletion transaction syntax, Sheets aggregate import syntax, Sheets goal unit expressions, Sheets report source-filter syntax, Google Ads reconnect/daily syntax, and Google Ads scheduler return syntax. They were not changed here. Three assertions affected by the current or preceding Batch 6 corrections now check unavailable enrichment, atomic selected-source import, and refusal to mutate a missing TikTok parent. No application guard was relaxed to satisfy a test.
- [TypeScript, client and server builds](validation-2026-10-24/retained-boundaries-verified-oct25-build-checks.json) pass. An initial TypeScript error required an explicit existing row type on the new storage projection; the final run passes. `git diff --check` passes. Disposable fixture schemas remaining: **0**; localhost PostgreSQL stopped.
- Validation used no browser, provider account or production database. The user subsequently authorized commit and push on October 25; deployment verification remains open. All finding release acceptances, full historical-data review and whole-app **NO-GO** remain unchanged. Next local work remains the worker/in-flight boundaries, impression-share and raw-ratio availability, and the documented goal/report/downstream gaps; the six static failures also remain tracked.

## Google Ads value checkpoint, October 25

### Confirmed causes, correction and exact scope

- **Revenue window (V1-104):** the main page summed `lastTotalRevenue` from the all-time source list ahead of the bounded total. Its daily query also requested 91 inclusive UTC dates, while the revenue API used 90. The existing date-bound helper now accepts an optional completed-campaign argument, used only by the Google Ads total/campaign-revenue handlers and the main daily `dateRange` request. They share 90 completed reporting days, clamped to campaign start. For an existing campaign on October 25, 2026 in Amsterdam, that is **July 27–October 24**. A campaign starting October 1 uses **October 1–24**. The page uses the bounded response exclusively. GA4 and other callers retain the existing helper behavior; explicitly dated GA4 Spend previews retain their requested dates.
- **Campaign attribution (V1-104/106):** the Google Ads campaign-revenue endpoint used undated mapping-config amounts whenever a dated record pair was absent. That fallback is removed only from this endpoint. Its existing query now checks both source and record campaign ownership and both currencies; exact dated zero and negative rows are retained. Unmapped rows remain outside Campaign Breakdown. No persisted mappings or records were deleted, rewritten or backfilled. Historical sources lacking dated records are not assigned invented amounts.
- **Currency and failed reads (V1-106):** Google Ads source-list reads previously swallowed storage/currency failures and displayed cached config totals. That context now fails explicitly; successful empty reads do not resurrect cached money. Total and campaign-breakdown reads reject mismatched or unverified record currency. The connection response adds the existing campaign currency, and the page, monetary goal values/forms, chart labels/tooltips and money-bearing Insights wording use it. Existing account-currency validation is retained; this does not add currency conversion or prove the currency of historical provider rows.
- **CTR (part of V1-107):** daily chart CTR is now total clicks / total impressions, not the average of row CTR percentages. The fixture with 10 clicks/100 impressions plus 0/900 now yields **1%**, previously **5%**. Search Impression Share aggregation/censoring is still uncorrected.
- **Calendar comparisons (part of V1-127):** rolling windows require contiguous dates. Current/prior periods use calendar boundaries anchored to the API reporting end date, and comparison eligibility counts the uninterrupted history ending there. Fourteen sparse observations over 27 days and stale September observations do not qualify as a current October week comparison. The daily table only compares adjacent calendar dates. Missing days are not manufactured as zero.
- **Goal availability (part of V1-128):** absent/failed business revenue, unknown metrics and missing click/impression/conversion denominators stay unavailable in the live resolver. Non-finite values/targets and undefined inverse-cost progress cannot produce Infinity or an on-track score. Trackers count unavailable goals separately and exclude them from their average. Goal forms leave unavailable automatic values blank; save rejects a non-finite automatic value while preserving explicit finite manual values, including zero. Finite formatters render `Unavailable`; no non-finite value is submitted by these save handlers. This is local live-goal coverage, not proof of scheduled goal, alert or report calculations.

Runtime files in this checkpoint: `server/routes-oauth.ts`, `client/src/pages/google-ads-analytics.tsx`, and its existing `GoogleAdsKpiModal.tsx` / `GoogleAdsBenchmarkModal.tsx`. No schema, storage implementation, provider client, scheduler, dependency or connection record was changed in this checkpoint. Earlier uncommitted isolation changes remain in the working tree.

### Validation and limits

- [Evidence manifest](validation-2026-10-24/values-evidence-oct25.json): **423 passed / 0 failed / 0 skipped across 19 files**, taking the latest run of each file from the four named packets. This is not a full-repository test run. The folder retains its October 24 name; the `*-oct25` artifacts are the separate October 25 checkpoint.
- **48 actual page/helper/handler cases** in `v1-batch6-google-ads-values.test.ts`; initial before-fix packet was **4 passed / 17 failed** before expansion. These execute the current TypeScript declarations with synthetic inputs. They do not prove rendered-browser behavior, external OAuth or provider completeness.
- **4 actual PostgreSQL query/storage cases** cover bounded versus all-time amounts, foreign-parent/source joins, selected versus unmapped rows, inactive/foreign-context sources, mixed currencies, zero and negative revenue. They execute the current route SQL and storage reads against disposable schemas. The initial PG run failed because the fixture supplied a string to a timestamp column; corrected to a `Date`, with no runtime change for that failure.
- **84 GA4 publication PostgreSQL cases pass**, together with the existing isolation, aggregate, Spend, source-display, OAuth contract and goal neighbors listed in the manifest. This checks the shared Revenue Sources route's GA4 behavior without changing live data.
- Eight older static failures were traced to obsolete implementation/type-union/display assertions: four had already been reproduced on the deployed revision in the October 24 checkpoint, and [four more were independently reproduced](validation-2026-10-24/values-neighbor-deployed-oct25.json) on `2c3097bc`. Assertions now follow the existing signed authorization, atomic connection replacement, current union membership and saved financial displays. Three Overview assertions were intentionally updated for this checkpoint's removal of the incorrect all-time/config fallback. Five disconnect unit failures came from missing parent-lock/migration-query mock support; [the deployed storage and test hashes were identical](validation-2026-10-24/disconnect-fixture-baseline-oct25.json) before correcting that fixture. Its five transactional deletion/rollback cases now pass; migrated publication behavior has the separate real-PG coverage.
- [Final TypeScript, client and server builds](validation-2026-10-24/values-verified-oct25-build-checks.json) pass. `git diff --check` passes. The local fixture schemas were removed (remaining count **0**) and PostgreSQL was stopped. No user browser, provider account, production database, deployment, commit or push was used for this checkpoint.

### Full remaining Batch 6 inventory

| Finding | Proven in current local evidence | Still open |
|---|---|---|
| V1-024 | Dispatch guards; ordinary Google Ads current-value transaction checks; atomic fact/freshness commit with actual overlapping-worker and rollback controls | Edit-then-restore, independent later-stage worker ordering, other provider workers, every restart/retry, complete lifecycle and historical rows |
| V1-046 | Google Ads unverified enrichment excluded at utility/writer/current storage reads and aggregate descriptors; native/imported controls pass | Complete saved/report/goal propagation, historical outputs, deployed acceptance; deferred provider enrichment unchanged |
| V1-055 | Retained route selection/currency/date/scope guards and atomic replacement; GA4 cache preserved; ordinary Google Ads materialization transaction guards | Retained-route in-flight races, historical sources, every other retained scheduler/downstream path and unknown external callers |
| V1-104 | Main page and bounded total/campaign-read window, real SQL and zero/refund controls | Every import/edit/delete/reprocess path, saved report/export parity and old unmapped/undated records |
| V1-106 | Main page/form currency, explicit Google Ads read failures, matching-currency SQL guards | Provider truth for historical saved facts; all source write/refresh failure states, reports and other consumers |
| V1-107 | Daily count-weighted CTR; exact-only Search Impression Share and live availability propagation in the ratio checkpoint | Exact aggregate provider share/denominator remains unavailable; complete saved/report/alert propagation and provider acceptance |
| V1-121 | Earlier production generator/dispatch/shared-aggregate exclusions | Retained direct reads, shared legacy writers, historical synthetic rows and saved outputs |
| V1-127 | Main-page contiguous rolling/current/prior periods and comparison gates | Provider zero-row completeness, refresh/midnight transitions, export/report parity |
| V1-128 | Live resolver, finite progress, trackers, forms/saves; explicit automatic/manual provenance; aligned current goal/alert/KPI-Benchmark report values; HTTP/PostgreSQL lifecycle and scheduled decision-to-notification cases | Complete historical/provider numeric validity, authenticated deployed behavior, independent-worker lifecycle races, every report template and scheduled delivery acceptance |

All nine findings remain OPEN for release acceptance. Add/create and edit/save are only covered at the tested handlers/form boundaries; delete has neighboring transaction/publication controls, not every paid-source lifecycle; refresh/recovery retains the October 24 limits; source displays/calculations have local evidence; full reports/provider/deployed acceptance and historical-data inventory remain unproven. Whole-app status remains **NO-GO**. No claim of “no possible side effects” is made.

## Initial isolation checkpoint, October 24

### Deployment and scope

Public health verified the user-reported Batch 5 deployment at `2026-10-24T21:40:28.1664200Z`: `ok: true`, commit `2c3097bc13dc5206ae158a5ef505eee2b30d2ba0`. This proves the deployed revision and health response, not provider/lifecycle acceptance. No browser, authenticated production account, provider, production database, or Ptomo access was used for this checkpoint.

The local change addresses the confirmed dispatch/generation/aggregate portion of V1-024 and V1-121. It does not enable deferred providers, change financial formulas, rewrite saved records, or change database schemas. It is not yet committed or deployed.

### Confirmed causes and localized correction

- Dedicated refresh wrappers did not consistently require an existing owned active campaign. Meta could dispatch without a parent; other wrappers accepted paused/ownerless parents. They now reuse the existing active-campaign filter, reject a mismatched supplied connection campaign, and stop before provider/generator/downstream dispatch for ineligible parents. TikTok no longer writes failure metadata for a missing/ineligible parent.
- Four `connect-test` routes (Meta, Instagram, TikTok, Google Ads), two explicit `refresh-test` routes (Instagram, TikTok), and Instagram's empty-row GET seeding could generate simulated data in production. The six test routes now return 404 before storage access in production. The Instagram daily GET refuses an existing test connection with 409. Meta's exported generator and Google's private generator also refuse production generation; the LinkedIn/Meta/Google/TikTok wrappers prevent production mock dispatch.
- `aggregateCampaignMetrics` previously accepted saved test connections as ordinary sources. Its five paid-source inputs now exclude identifiable test connections in production; TikTok also excludes rows explicitly marked by its persisted `isSimulated` column. Both Performance Summary and Trend Analysis consume these filtered inputs. Instagram has no persisted row-level simulation marker: its connection marker is the boundary, not an invented row-level guarantee.
- The owner-authorized Google Ads Spend setup preview remains available for a draft campaign through an explicit `allowDraftPreview` option, restricted to spend-only connections. Ordinary scheduled drafts remain ineligible. Existing durable GA4 initial-import ownership still controls its draft exception. Paused campaigns are not admitted by either exception.

Runtime files: `server/routes-oauth.ts`, `server/scheduler.ts`, and the five existing paid-provider scheduler files. Tests: `server/v1-batch6-paid-isolation.test.ts`, plus three fixture corrections in `ga4-aggregate-saved-overview.test.ts`, `google-ads-spend-production-path.test.ts`, and `v1-batch1-access-regression.test.ts`. The latter fixtures now supply the existing publication-version dependency, an owned active campaign, and distinct transfer IDs; production behavior was not weakened to satisfy an old test.

### Validation and evidence

- [Final targeted packet](validation-2026-10-24/isolation-final.json): **248 passed, zero failed/skipped, 10 files**, including **81 new isolation cases**. Synthetic storage/provider responses only; credentials removed and outbound provider network blocked by the runner. No live data was saved.
- [Pre-fix packet](validation-2026-10-24/isolation-baseline.json): 20 passed, 48 failed. This reproduces missing guards and simulated contributions at the exercised boundaries, not 48 distinct product bugs. Initial runner startup was blocked by sandbox child-process restrictions; the subsequent isolated run used approved child-process permissions.
- [Deployed neighboring baseline](validation-2026-10-24/deployed-neighbor-baseline.json) reproduces all 14 older neighboring failures on `2c3097bc` before fixture corrections: 12 lacked the publication-version read; two used identical transfer IDs and hit input validation before authorization. The corrected neighboring cases now pass.
- The broader first run also found four old **static assertion failures** in `google-ads-production-regression.test.ts`: old provider-call syntax, old delete/create reconnect implementation, old documentation wording, and the previous OAuth token handoff. [The deployed baseline](validation-2026-10-24/deployed-google-ads-baseline.json) independently reproduces all four (3 passed / 4 failed); they remain unresolved. Accordingly the latest result per executed file is **251 passed / 4 failed / 0 skipped across 11 files**, not a wholly green Batch 6 suite.
- Positive controls retain real Google Ads/LinkedIn/Meta dispatch, selected Instagram placement writes, development-only setup/generation, Google Ads draft Spend preview, owned Spend publication, GA4 saved financial values, snapshot scheduling, and aggregate contracts. Negative controls cover missing/blank owner, missing/draft/paused/archived parent, wrong connection campaign, production test flags, anonymous/foreign development callers, and persisted simulated TikTok rows.
- The [server build](validation-2026-10-24/isolation-final-build-checks.json) and [final TypeScript check](validation-2026-10-24/isolation-types-final-build-checks.json) pass. An earlier concurrent TypeScript run saw disposable baseline files disappear during cleanup; the serial rerun passes without code changes. Client code is unchanged; no client browser or live-provider result is claimed. The [evidence manifest](validation-2026-10-24/isolation-evidence.json) records source hashes, per-file results and the explicit limits.

### Lifecycle and downstream boundaries still open

| Path | Evidence in this slice | Remaining acceptance |
|---|---|---|
| Add/create | Exact test handlers reject production; owned development controls pass | Real provider setup/reconnect completeness and retained non-test entry points |
| Edit/update | Google Ads draft Spend preview and existing owned Spend refresh tests pass | Deferred-provider selection edits, all retained import paths, concurrent edits |
| Delete/deactivate | Parent/connection dispatch guards; existing Spend pipeline neighboring tests | All paid-source delete/reconnect lifecycles and already-running write races |
| Refresh/scheduler/recovery | Five actual wrapper bodies; Google Ads actual scheduler/provider fixtures and owned publication controls | All-worker restart/retry, late parent/connection changes, independent provider truth |
| Source lists/pages | No broad source-list/UI change; Instagram old-test GET fails explicitly | Other retained direct reads, modal states, full simulated-data visibility isolation |
| Totals and downstream | Actual shared aggregate plus GA4 publication/snapshot neighboring tests | All direct API KPI/Benchmark/report consumers, shared legacy Spend imports, saved historical snapshots |
| Historical data | No records changed or deleted | Read-only inventory of unmarked old synthetic rows and any derived saved values; exact cleanup boundary required before mutation |

The four deferred providers remain functionally deferred. V1-046/055/104/106/107/127/128 remain uncorrected in this slice. The rest of V1-024/V1-121, applicable provider/deployed acceptance, and Batch 6 completion remain OPEN. Whole-app production readiness remains **NO-GO**.

## Scope and acceptance

For LinkedIn/Instagram/Meta/TikTok, verify access/job/simulation/shared-data isolation; defer provider-functional repair and provider acceptance until future enablement. Retain evidence and severity without treating an unconfigured provider as a tested V1 feature. Google Ads and any actually offered child-source paths retain their own selection, currency/window/ratio, permission and failure requirements unless separately excluded. See the scope amendment for mixed and deferred findings.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) shared access/signing/mock protections and [Batch 2](../v1-batch-2/README.md) worker startup controls. Included Google Ads financial contracts intersect [Batch 3](../v1-batch-3/README.md) and downstream [Batch 7](../v1-batch-7/README.md); [Batch 8](../v1-batch-8/README.md) must verify effective exclusions. Functional deferral never removes shared safety obligations.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Deferred providers and Ptomo scope](../../audits/v1-2026-10-19/UNCONFIGURED_SOURCES_AND_PTOMO.md)
- [Paid-media trace](../../audits/v1-2026-10-19/PAID_MEDIA_TRACE.md)
- [Retained paid-source values](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md)
- [Included Google Ads values and Insights](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-024](#v1-024) | P1 | OPEN | OPEN |
| [V1-046](#v1-046) | P1 | OPEN | OPEN |
| [V1-047](#v1-047) | P1 | DEFERRED | DEFERRED |
| [V1-048](#v1-048) | P1 | DEFERRED | DEFERRED |
| [V1-049](#v1-049) | P1 | DEFERRED | DEFERRED |
| [V1-050](#v1-050) | P1 | DEFERRED | DEFERRED |
| [V1-055](#v1-055) | P1 | OPEN | OPEN |
| [V1-082](#v1-082) | P1 | DEFERRED | DEFERRED |
| [V1-104](#v1-104) | P1 | OPEN | OPEN |
| [V1-105](#v1-105) | P1 | DEFERRED | DEFERRED |
| [V1-106](#v1-106) | P1 | OPEN | OPEN |
| [V1-107](#v1-107) | P1 | OPEN | OPEN |
| [V1-115](#v1-115) | P1 | DEFERRED | DEFERRED |
| [V1-116](#v1-116) | P1 | DEFERRED | DEFERRED |
| [V1-117](#v1-117) | P1 | DEFERRED | DEFERRED |
| [V1-118](#v1-118) | P1 | DEFERRED | DEFERRED |
| [V1-121](#v1-121) | P1 | OPEN | OPEN |
| [V1-127](#v1-127) | P1 | OPEN | OPEN |
| [V1-128](#v1-128) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-024

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: code and isolated dispatch evidence, live configuration unknown):

Instagram18/TikTok70 and LinkedIn672/Ads347 refresh wrappers lack owner/active-status eligibility; Meta303 omits parent lookup. All connection IDs are scheduled by dedicated jobs. Four wrapper fixtures prove Meta dispatch without parent and LinkedIn/Ads dispatch for paused ownerless parents; LinkedIn missing-parent control rejects. These prove dispatch, not DB persistence. TikTok live refresh is deferred while test-mode scheduled writes simulated USD. Require fail-closed eligibility/simulation gating and actual recovery tests.

**Implementation / validation:** The [isolation checkpoint](#initial-isolation-checkpoint-october-24) covers owner/active-parent/connection dispatch and production mock exclusion. The [ordinary Google Ads refresh checkpoint](#ordinary-google-ads-refresh-write-guards-october-25) adds current-value transaction guards for campaign, connection and source changes. The [overlap correction](#ordinary-refresh-overlap-correction-october-25) adds atomic fact/freshness publication and 12 passing PostgreSQL/caller controls. Edit-then-restore, independent later-stage worker ordering, other provider workers, all-worker recovery, historical data and deployed/provider acceptance remain open; this finding is not closed.

### V1-046

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed attribution duplication):

`server/utils/ga4RevenueEnrichment.ts:119-147` applies a whole90-day GA4 revenue pool independently to every normalized name match and allocates it by platform spend dates. Exact fixture turns100 into200 for two matched campaigns. Current retained LinkedIn/Google Ads consumers show ga4Revenue/ROAS. Failed/empty enrichment also leaves old values. Exact source/date/unique allocation needed, or effective exclusion.

**Implementation / validation:** The [October 25 retained-boundary checkpoint](#retained-attribution-and-spend-boundaries-october-25) excludes unverified Google Ads enrichment before materialization and at the current storage read/aggregate boundary. Real PostgreSQL proves native and stored historical values are preserved; focused utility and aggregate cases pass. Exact attribution was not invented. Deferred provider enrichment and historical saved outputs remain unverified; release acceptance remains OPEN.

### V1-047

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed paid-media pagination gap):

`server/services/meta-graph-api.ts:205,267,387,431,456` reads one page and ignores paging.next. Exact campaign/placement fixtures prove one request despite next link. LinkedIn client84-276 similarly lacks iteration in current code. Selected-source discovery and metrics can be partial; independent provider completeness tests required.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-048

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Meta failure/freshness corruption):

`server/meta-scheduler.ts:233-294` catches selected-campaign request failures then updates lastRefreshAt. Exact fixture proves all requests fail yet freshness advances. Wrapper303 then runs KPI/alerts. `meta-graph-api.ts:590` also substitutes zero insights for failed batch requests, separately reproduced. Preserve last-good state with failure/partial freshness; do not publish failed requests as measured zero.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-049

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed LinkedIn refresh duplication/fabrication):

`server/linkedin-scheduler.ts:419` uses Set of newly created objects, so each prior metric repeats a campaign; exact fixture one campaign/two metrics writes four metrics and two creative rows. Creative revenue632 defaults conversionValue150 when absent, also reproduced. Substring identity and missing queried metric fallbacks are additional traced risks. Requires exact campaign identity, no invented revenue, coherent session publication and damage inventory.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-050

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conflicting conversion contracts):

`server/services/meta-graph-api.ts:405-412` sums purchase/lead/conversion action labels, while aggregate513/550 selects first matching label. Exact Instagram-placement fixture produces9 from three labels of3. Whether labels overlap needs provider validation; current code lacks a verified non-overlapping conversion contract. This blocks treating Meta/Instagram values as certified or reusing the definition for future sources.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-055

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Spend scope/currency defect):

Ad-platform import27325 reads all Google Ads/Meta/LinkedIn daily rows without selected-ID eligibility, labels sources/recordsUSD and updates campaign total from defaultGA4 scope. Exact EUR campaign fixture imports selected10+unselected90 as100USD. Delete/insert is non-atomic. Dedicated GA4 Ads Spend safeguards do not cover this route.

**Implementation / validation:** The [October 25 retained-boundary checkpoint](#retained-attribution-and-spend-boundaries-october-25) adds connection/selection/date/currency/fact guards, exact platform/source selection and existing atomic replacement; shared GA4 spend is no longer overwritten. Currency-less legacy facts explicitly fail without mutation. Real transaction tests prove rollback and neighboring record preservation. No current frontend/scheduler caller of the exact retained endpoint was found, but external callers, historical sources, other reprocessing paths and in-flight ownership/connection races remain unverified. Release acceptance remains OPEN.

### V1-082

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: code plus official provider support evidence):

`linkedinClient.ts:47` pins202405, officially sunset May15,2025. Real refresh and Spend discovery/process6243/6321 use it, so GA4 child-source configurations also need review. No live provider request performed. Migrate with source-specific permission/query/metric/attribution/pagination tests or effectively restrict affected supported scope.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-104

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained financial-window mismatch):

Instagram374–382, Google Ads499–508 and Meta658–668 page expressions prefer all-history source totals over bounded Revenue, then divide by period Spend. Three cases900 all-history/100 bounded/100 Spend yield ROAS9. TikTok API25234 separately reads1900-through-today Revenue beside30-day Spend. [Exact boundaries](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Match and label numerator/denominator dates through every consumer.

**Implementation / validation:** Partial local correction in the [October 25 checkpoint](#google-ads-value-checkpoint-october-25): common completed-day bounds, bounded main-page revenue and removal of undated campaign-revenue fallback. Real SQL and negative/zero/refund cases pass. Full lifecycle, scheduler and report/export propagation and historical-data acceptance remain open.

### V1-105

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed DB failure-to-empty analytics):

`routes-oauth.ts:25370,25212` catches Instagram/TikTok daily DB errors as[]; two actual-handler cases return200/success/empty rows, hiding failures from page error controls. Instagram overview25294 has the same catch. [Evidence](../../audits/v1-2026-10-19/retained-value-boundary-reproductions.json). Preserve failure/stale/empty distinctions; no claim that empty Instagram overview renders measured-zero cards.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-106

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conditional currency fallback and labels):

`routes-oauth.ts:3679–3735` hides breakdown currency errors behind mapping totals; fixture USD100/EUR200 then sums300 in Instagram. Monetary formatters Google Ads699/Meta622/TikTok104/Instagram70 hardcode dollars despite available source currency. [Exact cases and limits](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Preserve currency identity/validation through source lists, totals and presentation; live mixed-source occurrence unknown.

**Implementation / validation:** Partial local correction in the [October 25 checkpoint](#google-ads-value-checkpoint-october-25): explicit Google Ads read/currency failure, campaign currency presentation and goal forms. Deferred-provider functionality is unchanged. Historical provider currency proof and all downstream/write/refresh consumers remain open.

### V1-107

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained ratio aggregation defects):

`google-ads-analytics.tsx:492,532,536` averages row rates; same-day fixture CTR50.5% conflicts with count-derived1.9802%. Search share also lacks its eligible denominator, and provider306 loses below10% bound semantics. [Fixture/provider contract](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Use verified aggregate grains and preserve censoring; do not reconstruct provider eligibility from rounded shares.

**Implementation / validation:** Daily CTR corrected and tested in the [value checkpoint](#google-ads-value-checkpoint-october-25). The [ratio checkpoint](#google-ads-ratio-availability-october-25) preserves exact single-row shares and excludes unsupported aggregates/censored values at page/live-goal/Insights boundaries. No exact combined denominator or provider aggregate is introduced. Complete saved/report/alert propagation and provider acceptance remain open; the finding is not closed.

### V1-115

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed read-failure-triggered source mutation):

`server/utils/linkedin-revenue.ts:74–89,125–135` converts failed Revenue/source reads to0/[] and treats them as proof of a stale connection conversionValue. Complete actual helper fixture then calls `updateLinkedInConnection(campaignId,{conversionValue:null})`. [Evidence/current callers](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Never derive destructive self-heal from failed reads; prove exact stale-data boundary independently and preserve valid configuration.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-116

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed LinkedIn zero/legacy precedence defect):

`linkedin-revenue.ts:117–118,191–210,234–266` ignores stored conversionValue only when imported Revenue is positive. Active actual-revenue source measured0 plus legacy CV50/10conversions returns500; source-free legacy session CV can still supply500 after connection self-heal. [Zero/negative/positive/explicit-mode cases](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Preserve current source/mode identity and valid zero; complete source-delete/reconnect/damaged-session propagation before release.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-117

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed undisclosed ad revenue allocation):

`routes-oauth.ts:32575–32622` maps webhook-origin Revenue to explicit conversion-value status, then allocates total by ad conversion shares. Exact expressions yield75/225 from campaign-level300 with no ad attribution and `revenueIsEstimated:false`. [Evidence and visible/PDF flag consumers](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Preserve attribution provenance and explicit estimates; campaign actual amounts do not prove actual ad attribution.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-118

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed invented Shopify denominator in LinkedIn):

`linkedin-revenue.ts:180–185` assumes one order when Shopify Revenue exists but count/AOV metadata is absent. Complete helper returns conversionValue1000 from Revenue1000 without an order-count source. [Exact case](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Keep total Revenue authoritative while making unsupported per-order value unavailable; exact legacy repair requires real count/provenance.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-121

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed incomplete production exclusion):

`routes-oauth.ts:24438,24581,24851` lets an authenticated campaign owner create Meta/Instagram/TikTok simulated connections without provider credentials or a production/mock gate. Actual Instagram handler writes simulated metrics; Meta dispatches its generator30 times; actual TikTok refresh materializes simulated rows. [Fourteen owner/negative/no-connection cases and shared-consumer trace](../../audits/v1-2026-10-19/UNCONFIGURED_SOURCES_AND_PTOMO.md). Effective API/job/simulation exclusion remains required for V1; this is not a requirement to implement deferred providers. No live contamination claimed.

**Implementation / validation:** Partial local correction in the [October 24 isolation checkpoint](#initial-isolation-checkpoint-october-24): production test-entry/generation guards and shared aggregate filtering. Other retained direct reads, financial imports, historical saved outputs, deployed acceptance and the full consumer inventory remain open; this finding is not closed.

### V1-127

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Ads calendar/coverage mismatch):

`google-ads-analytics.tsx:593–690`: rolling7/30 and prior-period comparisons count observed rows, not calendar days;14 rows enable WoW even across27 dates. [Exact sparse/contiguous/partial controls and22-rule trace](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md). Preserve provider coverage and align windows through charts, reliability, Insights and reports; no live sparse-property claim.

**Implementation / validation:** Main-page calendar windows and eligibility corrected in the [October 25 checkpoint](#google-ads-value-checkpoint-october-25), with sparse/contiguous/stale and month-boundary fixtures. Provider coverage, refresh/midnight transitions and full report parity remain unverified.

### V1-128

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Ads missing-input goal scoring):

`google-ads-analytics.tsx:487–491,776–843`: no clicks/conversions becomes zero cost; target/current produces Infinity/on_track, capped200% in trackers. Absent imported Revenue returns numeric0; unknown target statuses count behind. [Exact cases and downstream limits](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md). Source/denominator availability and finite scoring must survive goals, Insights, reports and alert resolver acceptance.

**Implementation / validation:** Live resolver, finite progress, trackers, modal prefill and save guards corrected in the [value checkpoint](#google-ads-value-checkpoint-october-25). The [ratio checkpoint](#google-ads-ratio-availability-october-25) covers local raw card/chart/table ratios, daily Cost/Conversion and dependent Insights/live-goal availability. The [saved-value correction](#saved-goal-value-correction-october-25) adds explicit provenance and shared current-value resolution for goal cards, alert decisions and KPI/Benchmark reports, with 72 new passing cases. The [later 34-case lifecycle suite](#goal-lifecycle-and-scheduled-consumer-verification-october-25) verifies actual HTTP/PostgreSQL goal persistence, sequential deletion/notification retention and scheduled decision-to-notification behavior. Full source/concurrent-worker lifecycle, authenticated deployed acceptance, historical/provider truth and all report templates remain open. This is not complete goal-system acceptance.
