# GA4 Refresh And Processing

## Purpose

This file defines the daily auto-refresh and auto-process model for GA4.

For the current Salesforce reference implementation, HubSpot parity gaps, and CRM lifecycle invariants, also read `GA4/CRM_REVENUE_SOURCE_PATTERN.md`.

## Daily Auto-Refresh And Auto-Process

This platform has a required no-click freshness pattern for GA4 campaigns.

Executive-ready local reporting-time behavior is tracked in `GA4/REPORTING_TIMEZONE_PRODUCTION_READINESS.md`. GA4 Trends uses the campaign reporting timezone for completed-day cutoff, the GA4 daily scheduler uses a configured local reporting-time schedule, and the external value scheduler uses a configured operations timezone.

User expectation:

- users should not need to reopen setup flows each day just to keep GA4 analytics current
- the system should refresh eligible GA4 and source-backed financial data in the background
- the next page load or query refetch should show updated values derived from the latest stored facts and source records
- users should not need to reselect or manually type GA4 campaign values after property selection when the selected property exposes real UTM campaign values through GA4 dimensions or tagged page URLs
- GA4 Data API values can change after Google finishes processing already-sent events, so a later refetch can show higher values even when no new seed script run occurred

Google OAuth continuity boundary:

- recurring Google Sheets and GA4 disconnects were traced to the OAuth app being `External + Testing`, whose relevant authorizations expired after seven days
- Publishing status has been changed to `In production`. The post-publish GA4 reconnect completed on `2026-07-30`; the post-publish Google Sheets reconnect and one no-click automatic mapped-value update were user-confirmed on `2026-08-01`. Broader branding/data-access verification remains outside the whole-Overview non-scheduler decision
- the `2026-07-29` GA4 reconnect incident was the expected pre-publish-token boundary. Reconnect classifier `efaa6f60` and picker fix `6d32514a` deployed; the user confirmed GA4 connected, the intended campaign selection and metrics loaded, and the state remained correct after refresh
- `Reconnect required` is now reserved for a missing refresh credential or Google `invalid_grant`; a GA4 `403`, transient token-endpoint failure, server OAuth configuration failure, storage failure, or provider failure after successful refresh remains an operational error
- for the certified connection, post-publish OAuth durability was observed on `2026-08-10`: authenticated native totals succeeded and the timer-fired job persisted the selected property after the `2026-08-07` durability threshold. This is exact-connection evidence, not a guarantee for future credentials
- the authoritative Google Sheets source-family evidence and broader exclusions are in `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`; no whole-Overview section gate remains open inside the exact release-candidate campaign/property boundary

GA4 connection lifecycle boundary:

- a database trigger blocks changing an existing GA4 connection directly from active to inactive; disconnect must use the campaign-scoped delete path
- connection creation, reactivation, and deletion write retained lifecycle events with connection ID, campaign ID, property ID, database actor, reason, and timestamp
- lifecycle events intentionally remain after the connection or campaign is deleted so production validation and maintenance scripts cannot erase the evidence with the operational row
- validation and maintenance scripts must remain read-only unless an exact campaign-scoped connection mutation is explicitly authorized

## Campaign Reporting Timezone Configuration

The campaign reporting timezone is the source of truth for completed-day GA4 history in Insights Trends.

Current behavior:

- `Create New Campaign` exposes `Reporting Timezone` in the first details step
- new campaigns default to the browser IANA timezone when available, then fall back to `UTC`
- `Edit Campaign` exposes the same field and persists changes through the campaign update payload when `Save Changes` is clicked
- dropdown labels remove underscores for readability while preserving exact IANA timezone values in storage and API payloads
- changing the campaign reporting timezone affects the Trends completed-day cutoff, freshness labels, and report timezone metadata
- changing the campaign reporting timezone does not change the saved GA4 property, selected GA4 campaign values, source/campaign/property scoping, or KPI/Benchmark metric formulas

The GA4 daily scheduler still uses deployment-level `GA4_DAILY_REFRESH_TIME_ZONE` to decide when the daily refresh job runs. That scheduler timezone and the per-campaign reporting timezone are related timing controls, but they are not the same setting.

## Live Vs Mock GA4 Property Boundary

Only explicit demo/mock selectors should use deterministic GA4 simulation.

Current behavior:

- stored GA4 property ID `yesop` is the seeded demo property and may use deterministic simulation
- request-level `?mock=1` may force simulation for supported test flows
- numeric GA4 property IDs, including the mock-live validation property `498536418`, must use the live GA4 connection/import/query path
- live numeric properties must not receive a simulated Yesop baseline in Overview, Insights Trends, KPI/Benchmark current values, or campaign current-value refreshes
- deployed validation for commit `4074d282` passed after confirming numeric property responses no longer expose `isSimulated: true` or `simulationReason`

## Cross-Tab Refresh Dependency Order

For active real GA4 campaigns, one ordered daily pipeline owns the publication cycle:

1. refresh mapped financial sources
2. atomically refresh GA4 Overview facts and the Campaign Breakdown, Landing Pages, and Conversion Events snapshot
3. recompute KPI and Benchmark values and classifications
4. write the guarded financial daily snapshot used by Trend Analysis
5. write the compatible campaign aggregate snapshot used by Performance Summary and Budget & Financial Analysis history
6. capture the Executive Summary daily trajectory snapshot
7. run campaign KPI and Benchmark alert checks; recommendations then read the same refreshed inputs
8. make the refreshed persisted state available to Ad Comparison, Insights, and Campaign DeepDive consumers, which reread it through their normal query refetches
9. persist exact-date scheduled-report readiness and permit due GA4 or Campaign DeepDive reports to send only after the campaign has completed the cycle for the expected reporting date

Important meaning:

- `Overview` is the upstream data layer
- `KPIs`, `Benchmarks`, `Ad Comparison`, and `Insights` are downstream analytics layers
- `Campaign DeepDive`, alerts, recommendations, and `Reports` are downstream consumers; scheduled reports are the final output layer
- because GA4 campaign scope feeds the entire chain, post-setup campaign-scope edits are not currently exposed in the GA4 analytics page
- GA4 Overview is **UNVERIFIED** overall. The earlier production-ready decision remains historical evidence for its exact recorded runtime and campaign/property/source boundary only. The current scheduler-owned snapshot, attribution/reconciliation, and completed-day financial implementation is governed by `GA4/OVERVIEW_PRODUCTION_READINESS.md`; runtime `b6457a08` has a bounded Campaign3 UI/API reconciliation across the visible Overview, not whole-Overview recertification.

Historical Commit 16 record: authenticated connection responses added sanitized saved-window metadata, and runner `2026-07-31.13` detected mismatches. The existing `GA4 single` / `ga4_mock` response returned `lookbackDays: 30`, closing that bounded correction. Commit 19 later narrowed the supported production contract to 30 days only; retained non-30 rows now fail closed. No scheduler cadence, provider query, formula, storage/schema, campaign scope, or production data changed. Timer-fired and durability evidence were unproven at that date; the `2026-08-10` exact target run and provider-usable connection evidence closed those gates for the certified boundary.

Historical Commit 17 record: Google Sheets Revenue daily reprocess and Google Ads/Meta Spend daily reprocess replace last-good records inside the existing exact campaign/source/type/context transaction boundary; individual Spend deletion deactivates the source and deletes only its same-campaign records in one transaction. The user confirmed existing Total Revenue, Total Spend, and source lists remained unchanged. The retained-source disposition was later explicitly closed as keep/support; unsafe provider-failure injection remains deliberately unclaimed.

Historical Commit 18 record: on `2026-08-01`, the existing `GA4 single` / `ga4_mock` rendered 30-day Summary and exact scheduler-backed `/ga4-daily` response agreed at 866 Sessions, 867 daily-summed Users, 110 Conversions, 68.4% Engagement Rate, and 12.7% Conversion Rate, with `refreshIsStale: false`. This closed the bounded metric correction. The later exact target timer run and durability evidence closed those remaining gates for the certified boundary; future 60/90-day options remain outside this release.

Whole-Overview Current Commit 19 runtime `ba2e4329` is deployed: both GA4 property setup surfaces expose 30 days only, corresponding persistence APIs reject unsupported writes before mutation, and retained non-30 records remain unchanged and fail closed at the Overview connection boundary. Its bounded evidence is historical and does not override Current Commit 20's invalidation. No production data was modified.

Historical Overview scheduler record (`2026-08-10`): `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, `GA4_DAILY_REFRESH_HOUR=8`, `GA4_DAILY_REFRESH_MINUTE=0`, and `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`. The normal timer fired at `08:00:00.002Z`; target property `542352127` updated at `08:00:21.147`, retained 21 unique dates through `2026-08-09`, and had zero duplicate dates. The process-wide run failed 17 obsolete campaigns outside that certification, so no global-success claim was made.

Configuration verified on `2026-08-13`: `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, `GA4_DAILY_REFRESH_HOUR=22`, `GA4_DAILY_REFRESH_MINUTE=0`, and `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`. The Benchmark certification's natural run fired under the temporary `23:00 UTC` validation schedule on exact runtime SHA `650ce59c4b0d14a21a198e8a2effd0c3a6d1fccd`; the active Benchmark campaign and both active Benchmark rows updated successfully. The process-wide run remained failed for 17 excluded obsolete campaigns, so no global all-campaign scheduler-health claim is made. The permanent schedule was restored to `22:00 UTC` and verified after deployment.

Overview/KPI/Benchmark release-candidate scheduler evidence (`2026-08-14`): under the temporary `20:35 UTC` schedule on deployed SHA `85f5233ebfc298afc35f4c24e0930c1a66fbd07c`, the natural timer fired at `2026-08-14T20:35:00.001Z`. The target recompute updated all 12 KPIs and both Benchmarks with zero KPI/Benchmark skips or failures, and all 22 underlying daily rows were scheduler-written without later application repair. The 11-row Overview display boundary matched the authenticated Summary values. The process-wide run failed because of 17 excluded obsolete campaigns and is not described as globally successful. Later reviewed changes through `c6487555c55726427afed8342312b8393498303b` changed KPI/Benchmark browser freshness and notification visibility, not Overview values, the scheduler, or the daily-data producer. The permanent schedule was restored to `22:00 UTC`; no natural run on a later documentation-only revision is claimed or required for this implementation boundary.

The `2026-08-01` final non-scheduler read-only run passed 19 files / 190 non-mutating local tests and public production health. The authenticated guarded inventory returned zero generic damage findings. The user matched the four active retained Spend sources totaling $2,698.75 to the deployed modal and explicitly approved keeping all four; their keep/remove disposition is closed without cleanup. No `/ga4-daily`, provider-validation, refresh, scheduler-trigger, report-write/send, cleanup, or other mutation-capable endpoint was called by that read-only packet. Later that day, the user completed the post-publish Google Sheets reconnect, changed the mapped sheet, left Overview open without manually refreshing, and confirmed the displayed value updated automatically. The final non-scheduler pack passes; exact scheduler-family behavior is not generalized from that one event.

## GA4 Scope Changes

Current production behavior:

- GA4 property and campaign-value scope is saved during campaign creation or GA4 connection setup
- the GA4 analytics page reads and displays that saved scope
- users cannot add or remove GA4 campaign values from the GA4 analytics page after setup

Reason:

- changing GA4 campaign values after setup is a rescope operation, not a simple UI edit
- a safe future rescope workflow would need to save the new scope, refresh Overview inputs, recompute KPIs and Benchmarks, refresh downstream Insights and report outputs, and make alert/report implications explicit
- until that workflow is intentionally implemented, the safest production behavior is setup-time selection only

## Scheduler 1: GA4 Daily Refresh Pipeline

This scheduler now runs the GA4 daily refresh pipeline:

1. runs the existing mapped financial-source refresh in financial-only/deferred-downstream mode
2. finds campaigns with a GA4 connection and resolves each saved GA4 campaign filter
3. fetches and validates GA4 time-series data, including explicit verified zero-activity dates
4. atomically replaces the exact authorized `ga4_daily_metrics` window and synchronized Overview detail snapshot
5. recomputes GA4 KPI and Benchmark values from the refreshed facts and financial inputs
6. writes the guarded financial daily snapshot
7. writes the compatible `platform_sync` campaign aggregate snapshot
8. requests and confirms the guarded Executive Summary daily snapshot write
9. runs campaign-scoped KPI and Benchmark alert checks
10. records the campaign/reporting-date completion marker consumed by scheduled-report delivery

Important meaning:

- it keeps persisted GA4 daily facts current, and those exact property/campaign-scoped rows feed the Overview Summary and Trends completed-day windows
- its Overview snapshot reconciliation requires exact Sessions and Conversions parity; native Revenue permits only the mathematical maximum difference caused by storing each daily value at cent precision, preserves the provider aggregate, and never creates a residual adjustment row
- GA4 native daily revenue remains native GA4 fact data in `ga4_daily_metrics`; this pipeline must not create synthetic imported `revenue_records` for `ga4_daily_metrics`
- it is campaign-scoped and refreshes every active property independently
- campaigns whose provider refresh succeeds continue into KPI/Benchmark recompute even when unrelated campaigns fail; failed and skipped campaign IDs are excluded from recompute
- a failed or expired credential on an unrelated campaign does not prevent a successfully refreshed campaign from completing its campaign-scoped snapshots, alerts, or scheduled-report readiness marker; the process-wide run still records the unrelated failure and skips the unsafe global alert sweep
- the campaign aggregate snapshot and Executive Summary capture run only after the same campaign's GA4 facts, KPI/Benchmark recompute, and financial daily snapshot succeed
- Executive Summary capture failures are returned to the internal scheduler as failures, retained as hashed scheduler-health evidence, and prevent that campaign from being released as aligned for scheduled reports
- the independent Executive Summary daily scheduler skips campaigns with an active GA4 property and remains active for campaigns that do not use the GA4 daily pipeline
- the generic aggregate snapshot scheduler and source-triggered snapshot calls also defer active real GA4 campaigns to this ordered pipeline
- the generic KPI scheduler defaults to leaving GA4 recompute ownership with this pipeline
- any provider failure keeps the process-wide run failed and suppresses the unsafe global alert sweep; successful in-scope recompute evidence does not become a global scheduler-success claim
- a property-level provider failure, incomplete activity evidence, invalid row, duplicate row, or out-of-window row prevents replacement for that property and preserves its last-good stored window
- a saved campaign-filter or reporting-timezone change invalidates only that campaign's prior daily facts before scoped refresh, so old-scope rows cannot remain visible
- this is only one part of `Overview` freshness; `Overview` also depends on refreshed external revenue and spend source state where applicable
- it owns the daily financial refresh invocation for active real GA4 campaigns by default, while the existing short-interval financial-source polling remains available
- the report delivery scheduler remains separate, but due GA4 and Campaign DeepDive reports wait for this pipeline's exact reporting-date completion marker before creating send bookkeeping or sending; the marker is persisted on the exact Executive Summary daily snapshot and restored after a server restart

Runtime cadence:

- the scheduler starts from the server startup background-scheduler block, about 5 seconds after the server begins listening
- every recurring GA4 refresh, startup snapshot discovery, financial-source pass, KPI/Benchmark recompute, aggregate/Executive Summary snapshot job, and Google Sheets token-refresh pass filters to campaigns whose persisted status is exactly `active`; draft, inactive, paused, missing-status, and deleted campaigns are skipped. Campaign creation has one bounded exception: its initial GA4 import may process only the explicitly targeted draft, which is activated only after that import succeeds
- it schedules recurring runs at the comma-separated hours in `GA4_DAILY_REFRESH_HOURS`, using `GA4_DAILY_REFRESH_MINUTE` and `GA4_DAILY_REFRESH_TIME_ZONE`; when the hours list is absent or invalid, the existing `GA4_DAILY_REFRESH_HOUR` single-run schedule remains the fallback and still defaults to `03:00 UTC`
- `GA4_DAILY_PIPELINE_OWNS_REFRESH` defaults to `true`, preventing the separate full daily financial timer from racing the GA4 pipeline at the same configured time
- `GA4_DAILY_REFRESH_TIME_ZONE` is a deployment-level scheduler setting, not a per-campaign UI setting
- general startup refresh is disabled in code; `GA4_DAILY_REFRESH_RUN_ON_STARTUP` does not trigger an unconditional GA4 daily-history write. The bounded exception is snapshot initialization: startup discovery invokes the same campaign-scoped daily pipeline only for configured campaigns whose synchronized Overview snapshot is missing or mismatched, and skips campaigns that already have a valid snapshot
- scheduler logs include the next UTC run time, local reporting-time label, timezone, and expected `dataThroughDate`
- an in-process overlap guard skips a second GA4 daily pipeline if one is already running
- it fetches a lookback window controlled by `GA4_DAILY_LOOKBACK_DAYS`, defaulting to `90` days and bounded between `7` and `365`
- daily facts are persisted by date; Overview Summary and Trends use only completed daily rows through the campaign reporting timezone's latest completed day, so current-day intraday data is excluded
- when compatible campaign attribution splits traffic from conversion/revenue, the provider query supplements only missing conversion/revenue fields on the exact affected daily rows and never overwrites populated traffic or outcome values
- the scheduler writes explicit zero rows for completed dates that provider verification proves had no activity; the Trends UI also presents the campaign calendar from creation through its scheduler-derived history boundary, with those no-activity dates as zero

Production configuration observed on `2026-10-03`:

- `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, `GA4_DAILY_REFRESH_HOUR=6`, and `GA4_DAILY_REFRESH_MINUTE=0`; scheduler health reported the next run at `2026-10-04T06:00:00.000Z`, which is `08:00` Amsterdam while daylight saving time is active, with completed data through `2026-10-03`
- the configured `AUTO_REFRESH_DAILY_HOUR=23` and `AUTO_REFRESH_DAILY_MINUTE=0` do not schedule a second daily run because `GA4_DAILY_PIPELINE_OWNS_REFRESH=true`; scheduler health correctly reports `autoRefreshScheduler.timerScheduled=false`
- this observed production schedule is fixed to UTC. To run primary and same-day reconciliation passes at `08:00`, `14:00`, and `20:00` Amsterdam across daylight-saving changes, configure `GA4_DAILY_REFRESH_TIME_ZONE=Europe/Amsterdam`, `GA4_DAILY_REFRESH_HOURS=8,14,20`, and `GA4_DAILY_REFRESH_MINUTE=0`

## Live GA4 UTM And Measurement Protocol Behavior

Live GA4 properties can expose fresh UTM-tagged traffic in phases:

1. tagged URLs appear in `pageLocation`
2. manual UTM campaign dimensions may populate
3. generic GA4 campaign attribution dimensions may populate later or remain placeholder-heavy for fresh Measurement Protocol traffic

Required app behavior:

- campaign setup should discover selectable UTM campaign values from all three levels, preserving the existing campaign-values response shape
- Overview should query the saved GA4 campaign scope through campaign dimensions first, then use `pageLocation` `utm_campaign` fallback only when primary scoped results are empty
- GA4 to-date totals should preserve traffic, pageview, and engagement totals from the selected-campaign traffic query, and supplement only missing conversions/native revenue from a compatible selected-campaign `campaignName` conversion/revenue query when GA4 exposes purchase attribution there
- GA4 daily time-series/backfill should query `sessionCampaignName` first, use `pageLocation` `utm_campaign` fallback only when the primary daily result returns no rows, and supplement only missing daily conversions/native revenue from a compatible selected-campaign `campaignName` conversion/revenue query
- fallback behavior must stay scoped to the selected campaign values and must not broaden to unrelated property traffic
- live breakdown totals may be used as a visible-card fallback when to-date or persisted daily totals are still empty

Mock-live seed scripts used for validation should send standard GA4 events:

- `page_view` for sessions, users, page views, source/medium, campaign, and engagement parameters
- `purchase` for purchase revenue
- engagement inputs such as `session_engaged` and `engagement_time_msec` on the `page_view`

They should not send a separate standalone `user_engagement` event unless the test explicitly validates that event. Some GA4 test properties can mark `user_engagement` as a key event, which inflates native GA4 `Conversions` after delayed processing.

`scripts/seed_ga4_mock_campaigns.py` requires the completed reporting date, the target campaign/property timezone, and its currency. It also requires `GA4_SEED_API_SECRET` in the environment; the secret must not be stored in source code. Each run generates unique GA4 client and transaction identities so repeated validations cannot merge with an earlier run. For KYC Promo, use `--reporting-time-zone Europe/Amsterdam --currency EUR`; do not resend a batch while an earlier accepted batch is still being processed by GA4.

## On-Demand GA4 Daily Refresh

On-demand GA4 daily-history writes are restricted to the same ordered pipeline used by the timer.

- `POST /api/campaigns/:id/ga4/refresh` verifies campaign access and returns `409 GA4_DAILY_HISTORY_SCHEDULER_MANAGED`
- `POST /api/campaigns/:id/ga4-daily-scheduler/run-now` verifies campaign access and runs the ordered financial-source refresh, GA4 daily/Overview import, KPI/Benchmark recompute, and downstream snapshot path for that campaign only; it returns `409 GA4_DAILY_PIPELINE_BUSY` if another daily pipeline is already running
- page loads, browser focus/reconnect, polling, notification reconciliation, and validation reads cannot invoke the daily provider import or rewrite `ga4_daily_metrics`
- the on-demand ordered pipeline checks every configured external revenue/spend source for the target campaign; a campaign with no external Revenue or Spend sources has no provider jobs to run, uses GA4 Revenue, and leaves Spend unavailable without blocking GA4 publication

## GA4 Page Query Refetch Timing

The GA4 analytics page periodically rereads saved values in addition to the background scheduler:

- `/api/campaigns/:id/ga4-daily` refetches on page load, browser focus/reconnect, and every 5 minutes while the page is open, but normal browser callers use `readOnly=1` and cannot query GA4 or rewrite daily history
- `/api/campaigns/:id/ga4-to-date` and the Overview table endpoints refetch on page load, browser focus/reconnect, and every 10 minutes while the page is open; an Overview table refetch rereads storage and does not contact GA4
- `/api/campaigns/:id/ga4-breakdown`, `/api/campaigns/:id/ga4-landing-pages`, and `/api/campaigns/:id/ga4-conversion-events` read the atomic scheduler snapshot for the fixed initial-import boundary through the exact stored day returned with Summary; the browser query identity includes that day so different scheduler generations are not mixed. The separate Insights breakdown request retains its live analysis-window behavior
- `/ga4-daily` is hard read-only on the server even if a caller omits `readOnly=1`; it never contacts GA4 and never rewrites daily history
- `/ga4-daily` returns stored rows, scheduler/history coverage metadata, and `providerRefreshOutcome: "read_only"`; its browser refetch cadence is not a live GA4 refresh
- scheduler-written zero/no-activity dates are returned as normal stored rows; the Insights client additionally fills any bounded legacy gap from campaign creation through `historyDataThroughDate` with zero for chart/finding consistency
- `Landing Pages` and `Conversion Events` are scheduler-captured row-level GA4 payloads rather than browser-live queries. Landing Pages creates rows only from session-scoped landing-page results and may supplement missing Conversions on an existing exact row from same-scope `pageLocation` data. Conversion Events starts with exact session/campaign scopes; when their event total does not reconcile to the scheduler's per-date facts, it may use exact saved-UTM `pageLocation` scope or a date-specific exact combination of session, page-location, and campaign scopes. First-user attribution, unrelated traffic, maximum-value selection, and allocation remain forbidden
- numeric live or live-test GA4 property IDs can correctly show `Conversions = 0` on Landing Pages when GA4 returns zero for that exact grain. Conversion Events deliberately excludes zero-conversion rows and renders an empty result only after its complete exact-scope queries return no positive conversion rows
- the Conversion Events snapshot version participates in startup bootstrap discovery. A missing or outdated version runs the same campaign-scoped daily pipeline for that configured campaign; a current synchronized version is skipped. A successful snapshot stores the exact accepted validation request and reconciliation totals, while browser refetches only reread that persisted evidence

Important timing:

- cumulative Overview table values update only after GA4 has processed the latest completed day and a successful daily scheduler run atomically publishes the reconciled detail snapshot with the daily facts; page refetches only reveal that published state
- live financial to-date queries may update separately; they do not change the completed-day boundary of the three Overview tables
- Trends uses persisted completed-day rows and a scheduler-derived `historyDataThroughDate`; opening the page only rereads those values. The visible chart/history boundary changes only after the daily scheduler persists a newer state
- Connection Details shows the successful provider check-through date separately from the latest stored activity date. The normal campaign header does not insert that success text after load; Overview still warns when no successful current coverage exists or a stale refresh attempt fails, and retains stored values on failure
- generic GA4 `403 PERMISSION_DENIED` responses are provider/permission failures, not confirmed authentication expiry; this includes the daily time-series fetch before and after a confirmed token refresh, and only confirmed authentication signals may trigger token refresh/reconnect handling

Deployed UI-stability validation passed after commit `c26d2768`: the user confirmed the normal campaign header remained stable and did not insert the duplicate freshness text after load. Read-only scheduler health captured at `2026-07-30T15:14:09.442Z` showed `started=true`, `timerScheduled=true`, UTC `03:00`, `runOnStartup=false`, next run `2026-07-31T03:00:00.000Z`, no error, and `totalScheduledRuns=0`. This proves configuration and timer scheduling for the current process, not that its timer has fired.

## Scheduler 2: External Value Auto-Refresh And Auto-Process

Runtime `8ba694060411a2a05663a4915652767e4e3ba713` exposes this scheduler under `/health/scheduler.autoRefreshScheduler`, including configuration, next run, trigger, status, errors, summary counts, and run counters. Incomplete provider jobs now produce a visible failed scheduler status instead of a false success. This observability does not change provider queries, attribution, persistence, cadence, atomic replacement, or last-good retention.

This scheduler reprocesses eligible source-backed revenue and spend values.

For each GA4 campaign, the guarded financial snapshot combines verified native
GA4 revenue with every active GA4-context external revenue source and checks
every active GA4-context spend source. A verified native GA4 value of zero is a
valid value, external revenue still contributes to the total, and any configured
provider refresh failure blocks that campaign's publication instead of publishing
partial financial results. It does not block another active campaign from
completing its own ordered publication, although the overall scheduler status
still records the failed provider job.

If no Spend source is configured for the completed-day window, Spend remains
explicitly unavailable and does not block GA4 traffic, native revenue,
conversions, KPI/Benchmark recompute, or downstream snapshot publication. Once
a Spend source is configured, its missing or failed materialization remains a
blocking financial-source failure.

Current eligible sources include:

- HubSpot revenue
- Salesforce revenue
- Shopify revenue
- Google Sheets revenue
- Google Sheets spend
- LinkedIn Ads spend
- Meta spend through `ad_platforms`
- Google Ads spend through `ad_platforms`

Google Ads is the one enabled ad-platform child Spend shape for current GA4 Insights financial inputs: an active GA4-context `ad_platforms` source whose saved mapping identifies `google_ads`. LinkedIn, Meta/Facebook, Instagram, malformed Google Ads mappings, and explicit foreign platform contexts remain outside that enabled Insights boundary. This implemented inclusion does not extend the historical Insights certificates; current exact-revision Insights recertification remains pending.

LinkedIn and Meta schedulers persist their analytics in their canonical platform daily tables. They must not also append those windows to generic `spend_records` under pseudo source IDs such as `linkedin_daily_metrics` or `meta_daily_metrics`; generic financial spend must remain backed by a real campaign-scoped `spend_sources` row.

Runtime cadence:

- the scheduler timer is registered from the server startup background-scheduler block, about 5 seconds after the server begins listening; registration does not run the refresh pipeline
- with the default `GA4_DAILY_PIPELINE_OWNS_REFRESH=true`, it does not arm a separate full daily timer; the ordered GA4 daily pipeline invokes the same external-value refresh in financial-only/deferred-downstream mode before GA4 publication
- only when `GA4_DAILY_PIPELINE_OWNS_REFRESH=false` does it schedule its legacy standalone full daily run at `AUTO_REFRESH_DAILY_HOUR:AUTO_REFRESH_DAILY_MINUTE` in `AUTO_REFRESH_TIME_ZONE`
- every full daily and short-interval financial pass processes only campaigns whose persisted status is `active`
- active Google Sheets spend sources and active GA4 Google Sheets revenue sources use sequential isolated passes on the Google Sheets financial polling timer controlled by `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES`, default `1` and bounded to `1..60`; the revenue pass does not refresh CSV, CRM, ecommerce, non-GA4 revenue, LinkedIn, Meta, or Google Ads
- one CRM polling timer is controlled by `SALESFORCE_PIPELINE_REFRESH_INTERVAL_MINUTES`, default `5` and bounded to `1..60`. Its Salesforce and HubSpot passes reprocess every active exact GA4 CRM source with saved selected values, including revenue-only sources; `pipelineEnabled` controls only Pipeline Proxy calculation. Both reuse the saved mapping and stable revenue source ID
- the separate Google Ads scheduler remains active at `GOOGLE_ADS_REFRESH_INTERVAL_HOURS`, default `4`, and refreshes both eligible main Google Ads connections and dedicated GA4 Spend connections. A dedicated Spend refresh replaces provider daily facts and the exact source's materialized Spend records, then recomputes downstream state unless its caller explicitly defers that recompute
- the ordered GA4 daily pipeline also refreshes an active GA4 Google Ads Spend source during its financial phase. It calls the same dedicated provider/materialization path with downstream recompute deferred, then performs the shared KPI/Benchmark and snapshot stages after the financial and GA4 inputs are ready
- the Google Sheets financial timer and full daily external-value run share overlap guards, so they do not reprocess the same source concurrently
- the CRM Pipeline timer, Google Sheets financial timer, and full daily external-value run share overlap guards, so they do not replace the same financial state concurrently
- if `AUTO_REFRESH_TIME_ZONE` is unset, it falls back to `GA4_DAILY_REFRESH_TIME_ZONE`, then `UTC`
- `AUTO_REFRESH_RUN_ON_STARTUP` remains a test-only override, defaults to `false`, and is honored only when `GA4_DAILY_PIPELINE_OWNS_REFRESH=false`
- scheduler logs include the next UTC run time, local reporting-time label, timezone, and expected complete day
- the existing in-process overlap guard skips a second run if one is already in progress

## Operational Runbook: Scheduled Vs Startup Refresh

Use scheduler logs as the source of truth for refresh timing. Hosting log timestamps may be shown in UTC or another console display timezone; compare the ISO timestamp ending in `Z` and the explicit `timezone=...` label inside the application log message.

Local/server time checks:

- local development: compare `Get-Date` with `Get-Date -AsUTC` in PowerShell
- deployed logs: trust application log lines that include both UTC and configured timezone, such as `Next scheduled run at ... timezone=UTC`
- June 29, 2026 deployed validation: Render GA4 daily scheduler timing passed with `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false`, `GA4_DAILY_REFRESH_TIME_ZONE=UTC`, a controlled near-future `GA4_DAILY_REFRESH_HOUR` / `GA4_DAILY_REFRESH_MINUTE`, and scheduled-run logs showing `trigger=scheduled`
- a log timestamp shown by the hosting console is not proof that the app timezone is wrong unless it conflicts with the app's own `timezone=...` field

GA4 daily scheduled-refresh validation:

1. Set `GA4_DAILY_REFRESH_TIME_ZONE`, `GA4_DAILY_REFRESH_HOURS`, and `GA4_DAILY_REFRESH_MINUTE` to the intended recurring schedule. Retain `GA4_DAILY_REFRESH_HOUR` only as the single-run fallback.
2. Redeploy or restart and confirm:
   - `[GA4 Daily] Scheduler started`
   - `[GA4 Daily] Next scheduled run at ... timezone=... dataThroughDate=...`
3. After the scheduled time, confirm:
   - `[GA4 Daily] Pipeline starting (trigger=scheduled)`
   - `[GA4 Daily] Pipeline done (trigger=scheduled, elapsedSeconds=...)`
4. In the authenticated `ga4-daily` response, confirm the scheduler-written rows cover the expected completed calendar through `historyDataThroughDate`, including explicit zeros for verified no-activity dates. In Insights Trends, confirm `Latest imported day`, `Chart through`, chart rows, and findings match that persisted state. Loading the page must not change the rows or timestamps.

Current deployed evidence:

- June 29, 2026: the controlled Render validation passed for the scheduled GA4 daily path. This proves the GA4 daily scheduler timing path, not scheduled report sending or provider/email delivery.

GA4 daily startup-refresh validation is not applicable: startup execution is disabled in code, so changing `GA4_DAILY_REFRESH_RUN_ON_STARTUP` must not run the GA4 daily pipeline.

External revenue/spend scheduled-refresh validation:

With the default `GA4_DAILY_PIPELINE_OWNS_REFRESH=true`, validate the synchronized financial phase through the GA4 daily scheduled-refresh procedure above. A separate `[Auto Refresh] Next scheduled run ...` line is not expected; the external scheduler logs that the ordered GA4 daily pipeline owns the daily financial cycle. The Google Sheets and CRM short-interval timers remain active.

To validate the legacy standalone full daily path intentionally:

1. Set `GA4_DAILY_PIPELINE_OWNS_REFRESH=false`.
2. Set `AUTO_REFRESH_TIME_ZONE`, `AUTO_REFRESH_DAILY_HOUR`, and `AUTO_REFRESH_DAILY_MINUTE` to the intended schedule.
3. Set `AUTO_REFRESH_RUN_ON_STARTUP=false` when validating the scheduled path.
4. Redeploy or restart and confirm `[Auto Refresh] Next scheduled run at ... timezone=... expectedCompleteDay=...`.
5. After the scheduled time, confirm:
   - `=== DAILY AUTO-REFRESH + AUTO-PROCESS RUNNING ===`
   - provider-specific success or failure logs for the sources under test
   - `=== AUTO-REFRESH COMPLETE (...s) ===`
6. Restore `GA4_DAILY_PIPELINE_OWNS_REFRESH=true` after this isolated legacy-path test.

External revenue/spend startup-refresh validation:

- this test applies only when `GA4_DAILY_PIPELINE_OWNS_REFRESH=false`; the default ordered-pipeline ownership deliberately suppresses the standalone startup run
- set `AUTO_REFRESH_RUN_ON_STARTUP=true`
- restart the server
- confirm `[Auto Refresh] Running once on startup (AUTO_REFRESH_RUN_ON_STARTUP=true)...` and `=== AUTO-REFRESH COMPLETE (...s) ===`
- this is useful for quick provider-refresh testing, but it does not prove the configured daily scheduled time fired

HubSpot deployed provider-propagation evidence:

- Current Commit 4.8b passed on `2026-07-04T11:19:09.927Z` with validation runner `2026-07-04.3` for campaign `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458` / property `542352127`
- the controlled Total Revenue-only packet showed the same active HubSpot source, HubSpot source revenue delta `-$100`, total revenue delta `-$100`, spend delta `$0`, unchanged HubSpot record count, and clear inventory/provenance checks
- this proves only that exact controlled scheduler/provider propagation packet; it does not prove the normal wall-clock daily scheduled time, Pipeline Proxy, other campaigns, alternate mappings, Reports, KPI/Benchmark, emails, sandbox provider mutation automation, or future provider changes
- after startup-fired validation, set `AUTO_REFRESH_RUN_ON_STARTUP=false` and redeploy/restart so production returns to the normal daily schedule

Ad-platform spend auto-refresh rule:

- Meta and Google Ads spend refresh must reuse the campaign IDs saved in the Spend source mapping
- refresh must replace that source's previously materialized spend records before inserting refreshed daily rows
- edit or refresh mode must validate the stable spend source ID before updating records; a stale or wrong-platform source ID must fail closed instead of creating a new source
- scheduler refresh must not broaden spend to all campaigns available in the connected account
- scheduler refresh must not append duplicate rows on repeated runs
- GA4 Google Ads Spend is enabled in the current implementation and accepted by GA4 Insights financial scope, while the historical Insights certificates still exclude it. Its dedicated four-hour refresh plus ordered-daily refresh/materialization paths require an exact-current complete validation before a new certificate can include it
- scheduler failures should log source-specific phrases: `LinkedIn spend reprocess failed`, `Meta spend reprocess failed`, `Google Ads spend reprocess failed`, and `Google Sheets spend reprocess failed`
- internal scheduler self-calls should have a bounded timeout so one stalled provider refresh cannot prevent the full auto-refresh cycle from completing
- the LinkedIn refresh phase inside the external auto-refresh scheduler should also have a bounded timeout so CRM/ecommerce revenue reprocess can still run when LinkedIn refresh stalls
- LinkedIn revenue cleanup must not clear HubSpot pipeline proxy configuration unless the saved HubSpot mapping is explicitly `platformContext=linkedin`

Google Sheets spend auto-refresh rule:

- creating a new Google Sheets spend source is additive and must not reuse an existing source just because the same Google Sheets connection or tab is selected
- provider data-read failures, including `404`, preserve the saved Google Sheets connection and last-good records; the user verifies spreadsheet existence/access and retries or reconnects, and the read path never silently deletes the connection
- Google Sheets spend is refreshed by the external scheduler's isolated short-interval pass; the ordered GA4 daily pipeline also invokes the same financial refresh logic before synchronized daily publication, while the GA4 provider-fact refresh itself does not query Google Sheets
- after setup, a mapped Google Sheets spend-value edit must update the same active source automatically without a wizard resave; the default near-real-time target is a provider pull within 1 minute and an open GA4 Overview refetch within 15 additional seconds, approximately 75 seconds under normal provider/runtime conditions
- this is near-real-time polling, not a literal zero-latency guarantee; provider/runtime failures can delay convergence and must be logged without replacing the last successful stored value. Google Drive webhook/channel registration and renewal are not implemented or certified in this path
- the frequent Google Sheets spend timer must remain isolated from Upload CSV and all other provider families
- `GA4_DAILY_REFRESH_HOURS` and `GA4_DAILY_REFRESH_MINUTE` control the recurring synchronized cycles when the hours list is configured; otherwise `GA4_DAILY_REFRESH_HOUR` remains the single-run fallback. These variables do not control the one-minute Google Sheets polling test, and `GA4_DAILY_REFRESH_RUN_ON_STARTUP` is disabled in code
- to validate the normal Google Sheets spend update contract, change a known mapped value and wait for `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES` plus the Overview display-refetch interval; when legacy standalone ownership is intentionally enabled, `AUTO_REFRESH_RUN_ON_STARTUP=true` exercises the full scheduler and is still not proof that the source-family timer fired
- production should not keep `AUTO_REFRESH_RUN_ON_STARTUP=true`; the ordered GA4 pipeline owns the full daily cycle by default while Google Sheets spend uses its separate bounded interval
- on refresh, the saved Google Sheets spend source is reprocessed from the current sheet rows and replaces the previous stored amount for that source
- refresh must update by stable spend `sourceId`; it must not create a duplicate source, update another source that shares the same connection, or append duplicate rows on repeated scheduler runs
- if a `Date` column is mapped, daily spend records are materialized from the dated rows; adding a new matching dated row should increase `Total Spend` by that row's spend amount after refresh
- if a campaign identifier/value filter is mapped, only rows matching the saved campaign value set should be included

Google Sheets revenue auto-refresh rule:

- the bounded revenue pass selects only active campaign-owned GA4 `google_sheets` revenue sources with a saved connection and Revenue column, and runs after the spend pass under the same overlap lock
- Upload CSV and other revenue provider families remain excluded from this pass; non-GA4 Google Sheets revenue contexts retain their existing daily refresh behavior
- while an active GA4 Google Sheets revenue source exists, the open Overview revenue-to-date, source-list, and breakdown queries refetch every 15 seconds; without one, they retain the ten-minute interval
- deployed provider timing and already-open browser convergence still require direct validation and are not proven by local timer/query wiring

Google Sheets source-modal UI rule:

- Google Sheets revenue/spend setup should prefetch or silently refresh connections while preserving stable content
- do not show transient text such as `Checking Google connection`, `Checking connection...`, `Checking connected Google Sheets...`, or `Loading...` in the modal body if it causes content jumps during entry, Back navigation, or sheet dropdown changes

Google Sheets revenue refresh rule:

- creating a new Google Sheets revenue source is additive and must not reuse an existing source just because the same Google Sheets connection or tab is selected
- scheduled Google Sheets revenue refresh must reprocess the saved source itself and update by stable revenue `sourceId`
- refresh must replace that source's own materialized revenue records before inserting refreshed rows
- refresh must not create a duplicate source, update another source that shares the same connection, or append duplicate rows on repeated scheduler runs
- if a `Date` column is mapped, daily revenue records are materialized from the dated rows; if no date column is mapped, the source remains revenue-to-date snapshot style
- selected GA4 Google Sheets revenue cells must be blank, finite numeric values, plain decimal values, dollar-prefixed values, or valid US-grouped values; ambiguous locale or partial numeric text fails before foreground/scheduler replacement, and scheduler rejection preserves last-good data

CRM auto-reprocess rule:

- saved HubSpot and Salesforce mappings should be reprocessed by the ordered daily financial phase without requiring a user to manually reopen and save the wizard; supported CRM mappings also retain their separate five-minute polling path
- every active exact GA4 Salesforce mapping with saved selected values is reprocessed every five minutes by default without a wizard resave; Pipeline enablement controls only whether the proxy is recalculated
- every active exact GA4 HubSpot mapping with saved selected values is reprocessed every five minutes by default; a saved stage ID is required only when Pipeline Proxy is enabled, so revenue-only mappings refresh confirmed revenue without a Pipeline card
- HubSpot auto-reprocess should use active HubSpot revenue source mappings as the source of truth and pass the stable revenue `sourceId`
- a mapped HubSpot deal that moves from the selected open stage to a current Closed Won stage should leave Pipeline Proxy and enter confirmed Total Revenue plus Revenue Sources provenance in the same atomic refresh; repeated refreshes must replace the source's records rather than duplicate the deal
- HubSpot auto-reprocess should self-heal legacy `stageIds:["closedwon"]` mappings by resolving the account's current Closed Won stage IDs before querying deals
- HubSpot auto-reprocess must refresh an expired or missing access token from the stored refresh token before querying HubSpot; it must not silently continue with an expired token
- concurrent HubSpot token renewals are serialized per active connection, re-read current credentials before provider refresh, preserve rotated refresh tokens, and verify the renewed access token was persisted
- Salesforce auto-reprocess should use active Salesforce revenue source mappings as the source of truth and pass the stable revenue `sourceId` and saved date field so refresh updates the existing source instead of creating duplicate revenue sources
- the Salesforce pass must preserve `pipelineEnabled=false`, null stage fields, and no proxy contribution for revenue-only sources while still refreshing their confirmed Closed Won revenue
- the scheduler may use an internal same-process authorization path for its own loopback requests
- internal scheduler self-calls should use same-process loopback so the internal auto-refresh token is accepted by campaign access checks
- public HubSpot and Salesforce save-mapping endpoints must still require normal user authentication and campaign access
- GA4 HubSpot has a non-UI, campaign-access-guarded validation route that resolves one exact active GA4 HubSpot revenue `sourceId` and invokes the same scheduler reprocess function immediately; it does not run the global daily cycle or prove the natural timer
- refreshed CRM revenue should update materialized revenue records and recomputed campaign financial state
- if an auto-reprocess self-call returns `404 revenue source not found` for a stable HubSpot, Salesforce, or Shopify source ID, the scheduler should skip that stale source and log it as a stale-source skip; it must not create a replacement source, retry as add mode, or report the skip as a successful refresh
- ad-platform spend auto-refresh must reprocess by stable spend source ID when a source already exists; for LinkedIn spend this means the scheduler passes the active `linkedin_api` source ID and the process endpoint updates only that source instead of creating a replacement row
- validating that the total source count stayed stable is useful duplicate-prevention evidence, but LinkedIn-specific in-place refresh is only live-validated when an active LinkedIn spend source exists before the refresh
- refreshed Pipeline Proxy values remain separate early-signal values and must not be added into confirmed Total Revenue
- Overview Pipeline Proxy visibility should be anchored to the active saved CRM revenue source config; refreshed endpoint data may update the amount/provenance, but a stale endpoint response must not hide an otherwise configured active Pipeline Proxy card
- an open Overview should poll the saved HubSpot and Salesforce Pipeline results every minute and refetch Total Revenue, Revenue Sources, and Revenue Breakdown when either provider refresh timestamp changes
- if both HubSpot and Salesforce have active Pipeline Proxy configuration, the Overview card should aggregate both providers' exact proxy totals while keeping provider-specific provenance in the read-only Pipeline Proxy sources modal
- the five-minute CRM loop and full daily external-source run are distinct validation gates. Passing one does not prove the other. Both gates passed for the exact Salesforce source and exercised boundary recorded in `GA4/OVERVIEW_REVENUE_SALESFORCE_PRODUCTION_READINESS.md`; unrelated failures in the same daily process remain excluded from that exact-source result

Shopify auto-reprocess rule:

- saved Shopify revenue mappings should be reprocessed by the ordered daily financial phase without requiring a user to manually reopen and save the wizard
- Shopify auto-reprocess should use active Shopify revenue source mappings as the source of truth and pass the stable revenue `sourceId`
- for OAuth connections, runtime credential resolution may use only the newest renewable token pair from another active campaign with the same owner and exact normalized store; mappings, sources, and revenue records remain campaign-scoped
- OAuth acquisition and renewal are serialized by a PostgreSQL advisory lock keyed by normalized store, including across Render instances
- GA4 Shopify has a non-UI, campaign-access-guarded validation route that resolves one exact active GA4 Shopify revenue `sourceId` and invokes the same scheduler reprocess function immediately; it does not run the global daily cycle or prove the natural timer
- refreshed Shopify revenue should update the existing source's materialized order-date revenue records and recomputed campaign financial state
- Shopify `Tags` attribution should match exact individual Shopify order tags during manual edit and scheduled refresh
- Shopify's current readiness remains unverified after the 2026-10-03 cross-campaign OAuth renewal defect. The same-owner/same-store recovery fix and exact Campaign2 provider/source/API recovery passed before that redundant campaign was deliberately deleted; multi-instance collision testing and whole-source recertification remain open in `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`.

CRM token continuity rule:

- HubSpot and Salesforce reconnect flows should request offline/refresh capability so scheduled refresh and on-demand proxy/status endpoints do not drop out after short-lived access-token expiry
- if a CRM connection is temporarily disconnected but the saved source is still active, display surfaces may fall back to persisted org/stage/proxy metadata for clarity, but those fallbacks must not be treated as fresh live data
- if a saved Salesforce revenue source exists but live auth is down, source-selection surfaces should communicate `Reconnect required` rather than `Not connected`
- Salesforce status recovery should attempt refresh-token recovery when a refresh token exists, even if the stored access token is missing, before reporting `connected: false`
- Salesforce reconnect must not be treated as durable unless the callback receives a returned `refresh_token` or an existing stored refresh token is still available to preserve
- if reconnect diagnostics show Salesforce granted only `scope: 'api'`, the remaining fix is the Salesforce Connected App scopes/policies, not downstream revenue logic or later token loss in the app

## After Overview Refresh: KPI Recompute And Alert Checks

Required order:

1. recompute GA4 KPI values
2. refresh KPI progress and performance state
3. refresh the KPI `Executive snapshot` cards from the recomputed KPI grid/state
4. update stored KPI history where applicable
5. run KPI alert checks

Important meaning:

- KPI alerts must run only after both the KPI grid state and the KPI `Executive snapshot` state are coherent with the latest recomputed values
- traffic KPI current values are recomputed from the fixed initial-import boundary through the latest completed reporting day; the scheduler repair window and saved target-period metadata must not replace that cumulative boundary
- for GA4 mock/test flows, the stored KPI value used by alerts must be refreshed from the same total-construction model as the live KPI cards
- `/api/notifications` must also resolve GA4 financial KPI visibility from the same selected financial-source model as the live KPI cards, so stale `performance-alert` rows disappear when the refreshed Revenue/ROAS/ROI/CPA value no longer breaches
- if the exact report-date daily row is missing, an earlier current value may remain as last-good state, but the KPI recompute path must not record that value as target-day history
- real-property financial KPI values require a complete live saved-import-window GA4 response and campaign/native/imported/spend currency parity; retained daily totals or a configured-lookback breakdown must not substitute for that financial window
- if duplicate GA4 KPI rows exist for the same `campaign + metric`, only the newest row should remain eligible to emit the active alert

## After Overview Refresh: Benchmark Recompute And Alert Checks

Required order:

1. recompute GA4 benchmark values
2. refresh benchmark progress and performance state
3. refresh the Benchmark `Executive snapshot` cards from the recomputed benchmark grid/state
4. update stored benchmark history where applicable
5. run benchmark alert checks

Important meaning:

- Benchmark alerts must run only after both the benchmark grid state and the Benchmark `Executive snapshot` state are coherent with the latest recomputed values
- traffic Benchmark current values are recomputed from the fixed initial-import boundary through the latest completed reporting day; the scheduler repair window and saved target-period metadata must not replace that cumulative boundary
- if the exact report-date daily row is missing, an earlier current value may remain as last-good state, but the benchmark recompute path must not record that value as target-day history
- real-property financial Benchmark values follow the same live saved-import-window and currency-parity requirements as financial KPI values

## Ad Comparison Refresh

The current `Ad Comparison` tab has no dedicated background job.

It refreshes because:

- the daily scheduler atomically publishes the reconciled Overview Campaign
  Breakdown snapshot with the completed-day daily facts
- browser refetches reread that stored snapshot without contacting GA4 or
  rewriting scheduler-owned data
- the separate native Ad Comparison request refreshes the GA4 import-to-date
  row used by Revenue Breakdown
- revenue-source inputs refresh
- the derived comparison view rerenders from those refreshed inputs

Readiness note: the chart, leader cards, and summary cards consume the
scheduler-published Overview Campaign Breakdown snapshot for the saved
initial-import boundary through the campaign-timezone latest completed day.
Revenue Breakdown uses a separate native provider query over that same named
boundary. Its imported source rows refresh from the campaign-scoped
completed-day revenue breakdown, and `TOTAL` adds native GA4 revenue plus every
confirmed imported amount. The current implementation is `UNVERIFIED` after
the `TOTAL` change in `5d6d9f79`; the older certified runtime is historical.
The tab has no independent scheduler, and Reports-owned generation and delivery
remain outside the tab boundary.

## Insights Refresh

The current `Insights` tab is downstream of:

- refreshed GA4 daily facts
- refreshed GA4 to-date totals
- refreshed spend and revenue values
- refreshed KPI context
- refreshed benchmark context

Trend history gates:

- `Daily` requires at least 1 eligible campaign date and can render a single point
- `7d` can chart each complete 7-calendar-day window; its latest comparison requires two adjacent 7-day windows
- `30d` can chart each complete 30-calendar-day window; its latest comparison requires two adjacent 30-day windows
- `Monthly` can show one partial calendar month with reduced opacity and a partial label; comparison requires two adjacent complete months

These are campaign-age/calendar requirements, not activity-row or event-count requirements. Completed no-activity dates count as zero. Running a seed script repeatedly on the same UTC day can increase current metrics, but it does not create multiple completed campaign dates.

KPI/Benchmark snapshot history used by live Insights is eligible only when its versioned marker matches the selected GA4 property, saved campaign filter, campaign reporting timezone, and campaign currency. Legacy or mismatched history is retained but withheld from the live tab.

For native financial KPI/Benchmark recompute, the start boundary is always the saved GA4 `importStartDate`. The end boundary is the latest completed reporting day. Campaign metadata dates and app creation time are never substituted. Imported Revenue and Spend include a source only when its definition was created on or before that same campaign-timezone completed-day cutoff, and include only its mapped materialized records dated on or before the cutoff or selected earlier comparison date. Newer source definitions and records remain visible as pending and do not enter recomputation until their reporting day completes.

## Reports Refresh

Reports do not have a separate report-metrics recompute job.

Instead:

- ad hoc GA4 reports use live refreshed page state at generation time
- scheduled/server-generated reports use saved config plus shared report-generation infrastructure
- due scheduled GA4 and Campaign DeepDive reports for active real GA4 campaigns wait for the ordered daily pipeline's exact campaign/reporting-date completion marker before send-event insertion, PDF generation, or email delivery; the marker is persisted on the exact Executive Summary daily snapshot and restored after server restart
- GA4 scheduled/server report generation resolves the saved initial-import boundary through the latest completed campaign reporting day and fails closed when that cumulative boundary cannot be proven
- scheduled/server-generated GA4 reports and direct GA4 snapshot PDF downloads fail closed unless the campaign KPI/Benchmark recompute runs for the target campaign before PDF generation; direct GA4 snapshot PDF deployed validation passed after commit `4d3a3838`
- platform report test-send uses the same email-provider compatibility rule as scheduled delivery, including Mailgun HTTP API when `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` are configured
- scheduled/test-send report emails must attach the generated PDF and keep the email body plain and transactional; the PDF is the report artifact

Important meaning:

- `Reports` is a downstream output layer
- reports should render from refreshed GA4 tab inputs
- reports must not become a competing source of truth for campaign metrics
- report delivery, manual snapshot creation, and direct GA4 snapshot PDF download must not continue when GA4 KPI/Benchmark preflight recompute fails or skips the target campaign
- scheduled reports must be saved with at least one non-empty recipient before the scheduler can process them
- scheduled report delivery must verify the campaign still exists before snapshot creation, GA4 recompute, PDF generation, email sending, or report send-bookkeeping updates
- if a campaign-scoped scheduled report points to a missing campaign, the scheduler should mark that scheduled send as skipped/failed and not send the report
- scheduled report selection should deduplicate by report ID before due checks so shared legacy storage and platform-specific report queries cannot process the same report twice
- scheduled report idempotency remains based on `reportId + scheduledKey`, but deduplication should prevent duplicate in-memory processing before the idempotency insert
- Mailgun/API acceptance is not the same as delivery; report delivery diagnostics should preserve accepted, delivered, failed, and pending states when provider events are available

## Current-State Notes

The current implementation has one ordered daily publication cycle for active real GA4 campaigns. Short-interval source polling and shared report delivery remain separate services.

What is true today:

- the GA4 daily pipeline invokes mapped financial refresh first, atomically refreshes GA4 facts and Overview detail, recomputes KPI/Benchmark state, writes financial and campaign aggregate snapshots, captures Executive Summary history, runs campaign alerts, and then persists the exact campaign/reporting-date report-readiness marker on that Executive Summary daily snapshot
- the generic KPI scheduler defaults to skipping its duplicate KPI/Benchmark recompute and alert sweeps; the ordered GA4 pipeline performs both after the synchronized inputs and snapshots are ready. An explicit `GA4_DAILY_PIPELINE_OWNS_RECOMPUTE=false` override restores the legacy behavior
- timer and owner-guarded on-demand runs use the same ordered GA4 pipeline; the on-demand route is campaign-scoped and suppresses cross-campaign alert sweeps
- active real GA4 campaigns defer external-source downstream recompute/snapshot publication to the ordered GA4 cycle; non-GA4 campaigns retain the prior external-source behavior
- the GA4 KPI/Benchmark recompute helper also reconciles campaign-level KPI and Benchmark persisted `currentValue` fields from connected-platform totals after GA4, revenue, or spend refresh changes
- when a GA4 KPI/Benchmark recompute runs for a campaign, breached GA4 KPIs and Benchmarks should restore exactly one active in-app alert row if the row is missing
- active bell and Notifications visibility remains breach-only: alert-enabled GA4 KPI/Benchmark rows that are not currently breached should not appear in `/api/notifications`, even if a stale `performance-alert` row exists; for GA4 financial KPI alerts, the breach check must use the same selected GA4 native revenue plus imported revenue/spend model as the live KPI cards
- Ad Comparison refreshes indirectly from refreshed inputs
- Insights refreshes indirectly from refreshed inputs
- Campaign DeepDive Trend Analysis rereads its inputs every 30 seconds while visible and on window focus. Its current GA4-first outcome request is persisted-only: current Revenue and Spend prefer a compatible `financial_daily_snapshot_v1` row and otherwise use the authoritative persisted `performance_summary_aggregate_v3` totals. Its exact-date financial comparison prefers the matching snapshot and can invoke the existing scoped read-only GA4/source derivation when that snapshot is absent; this derivation writes no history and never substitutes the current value as the baseline. Missing current inputs show unavailable/scheduler-waiting, while a missing exact baseline leaves current values visible with `Comparison unavailable`. Campaign Performance Trend and GA4 efficiency charts use only complete scheduler-stored `/ga4-daily` rows; the mounted page makes no separate provider-coverage request. The scheduler stores the verified GA4 report currency in the atomic Overview snapshot, fails closed on a missing/mismatched code, and bootstraps legacy snapshots that lack that proof.
- Campaign DeepDive Performance Summary and Budget & Financial Analysis history use the compatible aggregate snapshot written inside the ordered cycle; their current cards still refetch authoritative aggregate values while visible and on window focus
- Campaign DeepDive Executive Summary history uses the confirmed guarded snapshot from that same cycle
- report outputs are generated from already-refreshed inputs; scheduled GA4/Campaign DeepDive delivery is deferred until the exact expected reporting date is marked aligned, restores that persisted marker after a server restart, and can still perform its existing preflight checks
- scheduled/server-generated GA4 reports now have dedicated server-side rendering for `Overview`, `Ad Comparison`, `Insights`, and `Custom`, using saved report config plus existing refreshed GA4 inputs
- scheduled report processing fails closed for missing campaign ownership, deduplicates report rows before due checks, and retries a due report after the aligned refresh completes without prematurely creating its idempotency row
- scheduled/test-send report emails now use a simple `MimoSaaS report attached` transactional payload with the generated PDF attachment, and test-send checks Mailgun delivery events when available
- GA4 report final validation passed for the report scheduler/output scope: targeted report regression tests, TypeScript check, production build, GA4 report test-send/PDF delivery, direct snapshot PDF output, and scheduled-report log-cycle behavior
- July 3, 2026: deployed GA4 Overview Report email delivery was user-confirmed for the recorded Overview report packet; future scheduled/test deliveries and report variants still require their own runtime evidence if separately questioned

What remains separate by design:

- short-interval Google Sheets/CRM source polling remains in the external value scheduler; the ordered daily pipeline invokes its financial-only refresh mode for the synchronized publication cycle
- scheduled email delivery still depends on shared scheduler/runtime email infrastructure rather than a GA4-only delivery path
- opening the bell, opening Notifications, or simply loading the GA4 page is not itself a backfill trigger for missing GA4 in-app alert rows; reconciliation happens when the existing GA4 recompute / scheduler paths run

## Snapshot Inputs That Do Not Auto-Refresh

Not all sources auto-refresh.

Current examples:

- `Manual`
- `Upload CSV`

These behave more like snapshot inputs unless the user updates them again.

Important meaning:

- new direct `Manual` source creation is no longer available from the production revenue/spend pickers
- existing stored `Manual` sources do not participate in scheduled daily source refresh on their own
- `Upload CSV` sources do not participate in scheduled daily source refresh on their own
- new GA4 `Upload CSV` spend sources require a Date column and materialize daily rows; already-undated saved spend sources remain continuity-only snapshots, and all CSV rows update only when the user imports or edits the CSV source
- existing stored snapshot sources are still included in recomputed totals until the user edits, replaces, or deletes them
