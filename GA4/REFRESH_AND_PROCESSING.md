# GA4 Refresh And Processing

## Purpose

This file defines the daily auto-refresh and auto-process model for GA4.

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
- Publishing status has been changed to `In production`, but public `mumus.app` pages/domain ownership, branding/data-access verification, final post-publish reconnects, automatic token renewal, and more-than-seven-day durability proof are explicitly on hold
- until that work resumes and the evidence is captured, background refresh code and a successful repaired manual refresh must not be described as stable production OAuth operation
- the authoritative hold and blocking commit queue are in `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`

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

The required GA4 platform pattern is:

1. refresh the GA4 `Overview` inputs first
2. recompute dependent KPI values and KPI performance state
3. refresh the KPI `Executive snapshot` cards from the recomputed KPI state
4. recompute dependent Benchmark values and Benchmark performance state
5. refresh the Benchmark `Executive snapshot` cards from the recomputed Benchmark state
6. refresh `Ad Comparison` from refreshed breakdown and revenue inputs
7. refresh `Insights` from refreshed Overview, KPI, and Benchmark context
8. ensure `Reports` render from those refreshed inputs when generated or sent

Important meaning:

- `Overview` is the upstream data layer
- `KPIs`, `Benchmarks`, `Ad Comparison`, and `Insights` are downstream analytics layers
- `Reports` is the output layer
- because GA4 campaign scope feeds the entire chain, post-setup campaign-scope edits are not currently exposed in the GA4 analytics page
- GA4 Overview is not production-ready or clean-certified. Current Commit 2 (`5cff21ad`) is deployed and its bounded UI smoke validation passed, but later failure-state, spend-scope, source lifecycle, freshness, cleanup, and downstream gates remain. See `GA4/OVERVIEW_PRODUCTION_READINESS.md`.

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

1. finds campaigns with a GA4 connection
2. resolves the campaign's GA4 campaign filter
3. fetches GA4 time-series data
4. upserts rows into `ga4_daily_metrics`
5. recomputes GA4 KPI and Benchmark values from the refreshed daily facts
6. runs KPI and Benchmark alert checks after recompute

Important meaning:

- it keeps persisted GA4 daily facts current
- GA4 native daily revenue remains native GA4 fact data in `ga4_daily_metrics`; this pipeline must not create synthetic imported `revenue_records` for `ga4_daily_metrics`
- it is campaign-scoped and property-scoped
- this is only one part of `Overview` freshness; `Overview` also depends on refreshed external revenue and spend source state where applicable
- it does not replace the external value auto-refresh scheduler or the report delivery scheduler

Runtime cadence:

- the scheduler starts from the server startup background-scheduler block, about 5 seconds after the server begins listening
- it schedules one daily run at `GA4_DAILY_REFRESH_HOUR:GA4_DAILY_REFRESH_MINUTE` in `GA4_DAILY_REFRESH_TIME_ZONE`, defaulting to `03:00 UTC`
- `GA4_DAILY_REFRESH_TIME_ZONE` is a deployment-level scheduler setting, not a per-campaign UI setting
- `GA4_DAILY_REFRESH_RUN_ON_STARTUP` controls the best-effort startup run and defaults to `true`
- scheduler logs include the next UTC run time, local reporting-time label, timezone, and expected `dataThroughDate`
- an in-process overlap guard skips a second GA4 daily pipeline if one is already running
- it fetches a lookback window controlled by `GA4_DAILY_LOOKBACK_DAYS`, defaulting to `90` days and bounded between `7` and `365`
- daily facts are persisted by date; the Trends endpoint returns only completed daily rows through the campaign reporting timezone's latest completed day, so current-day intraday data is not a visible Trends history row
- the Trends UI separates the completed-day cutoff from the latest imported row; if GA4 returns no row for a completed day, the app does not invent a zero row for that date

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

## On-Demand GA4 Refresh

The GA4 on-demand refresh endpoint follows the same downstream dependency rule for the refreshed campaign:

1. refresh the latest complete GA4 daily row
2. recompute GA4 KPI and Benchmark values for that campaign
3. run KPI and Benchmark alert checks through the existing GA4 recompute path

Important meaning:

- on-demand GA4 refresh should not leave KPIs, Benchmarks, or Insights relying on stale daily GA4 facts
- external revenue/spend source refresh remains handled by the external value auto-refresh scheduler
- system-generated GA4 test properties such as `yesop` use the deterministic GA4 simulator during on-demand refresh and must not require a live OAuth token
- Render validation passed for the `yesop` on-demand refresh path: the endpoint returned `success: true` with refreshed metric values instead of `TOKEN_EXPIRED`

## GA4 Page Query Refetch Timing

The GA4 analytics page has live query refetches in addition to the background scheduler:

- `/api/campaigns/:id/ga4-daily` refetches on page load, browser focus/reconnect, and every 5 minutes while the page is open
- `/api/campaigns/:id/ga4-to-date` and `/api/campaigns/:id/ga4-breakdown` refetch on page load, browser focus/reconnect, and every 10 minutes while the page is open
- `/api/campaigns/:id/ga4-landing-pages` and `/api/campaigns/:id/ga4-conversion-events` use the selected GA4 Overview date range and refetch on page load/reconnect for the selected property and saved GA4 campaign scope
- `/ga4-daily` reads persisted daily rows first; if the selected campaign/property has no stored rows for the requested window, it attempts an on-demand Data API backfill, persists the rows, and returns the stored result
- if persisted selected-campaign daily rows already have traffic but no conversions or native revenue, `/ga4-daily` may self-repair them by rerunning the same selected-campaign daily import and upserting only when the refetch recovers conversion or revenue values
- `Landing Pages` and `Conversion Events` are not reconstructed from `ga4_daily_metrics`; they fetch row-level GA4 Data API views directly and use exact-match fallback supplementation only when GA4 returns compatible row-level values
- numeric live or live-test GA4 property IDs can correctly show row-level `Conversions = 0` when GA4 returns zero conversions for the exact table grain; production properties with conversion-bearing rows should populate through the same live API path

Important timing:

- Overview values can update as soon as GA4 has processed the events and the relevant page query refetches
- Overview does not need to wait for the next completed reporting day when it is reading live to-date or breakdown data
- Trends uses persisted completed-day rows through the campaign reporting timezone's latest completed day, so same-day script events generally do not become a new Trends day until the following reporting day and a scheduler/on-demand backfill reads them

## Scheduler 2: External Value Auto-Refresh And Auto-Process

This scheduler reprocesses eligible source-backed revenue and spend values.

Current eligible sources include:

- HubSpot revenue
- Salesforce revenue
- Shopify revenue
- Google Sheets revenue
- Google Sheets spend
- LinkedIn Ads spend
- Meta spend through `ad_platforms`
- Google Ads spend through `ad_platforms`

Runtime cadence:

- the scheduler starts from the server startup background-scheduler block, about 5 seconds after the server begins listening
- it schedules one daily run at `AUTO_REFRESH_DAILY_HOUR:AUTO_REFRESH_DAILY_MINUTE` in `AUTO_REFRESH_TIME_ZONE`
- active Google Sheets spend sources also use a source-family-only polling timer controlled by `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES`, default `1` and bounded to `1..60`; this timer does not refresh Google Sheets revenue, CSV, CRM, ecommerce, LinkedIn, Meta, or Google Ads
- the Google Sheets spend timer and full daily external-value run share overlap guards, so they do not reprocess the same source concurrently
- if `AUTO_REFRESH_TIME_ZONE` is unset, it falls back to `GA4_DAILY_REFRESH_TIME_ZONE`, then `UTC`
- `AUTO_REFRESH_RUN_ON_STARTUP` remains a test-only override and defaults to `false`
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

1. Set `GA4_DAILY_REFRESH_TIME_ZONE`, `GA4_DAILY_REFRESH_HOUR`, and `GA4_DAILY_REFRESH_MINUTE` to the intended schedule.
2. Set `GA4_DAILY_REFRESH_RUN_ON_STARTUP=false` when validating the scheduled path.
3. Redeploy or restart and confirm:
   - `[GA4 Daily] Scheduler started`
   - `[GA4 Daily] Next scheduled run at ... timezone=... dataThroughDate=...`
4. After the scheduled time, confirm:
   - `[GA4 Daily] Pipeline starting (trigger=scheduled)`
   - `[GA4 Daily] Pipeline done (trigger=scheduled, elapsedSeconds=...)`
5. In Insights Trends, confirm `Last refreshed` is at or after `Expected refresh` and no stale warning appears.

Current deployed evidence:

- June 29, 2026: the controlled Render validation passed for the scheduled GA4 daily path. This proves the GA4 daily scheduler timing path, not scheduled report sending or provider/email delivery.

GA4 daily startup-refresh validation:

- set `GA4_DAILY_REFRESH_RUN_ON_STARTUP=true`
- restart the server
- confirm `[GA4 Daily] Pipeline starting (trigger=startup)` and `[GA4 Daily] Pipeline done (trigger=startup, ...)`
- this proves the startup path only; it does not prove the daily scheduled path fired

External revenue/spend scheduled-refresh validation:

1. Set `AUTO_REFRESH_TIME_ZONE`, `AUTO_REFRESH_DAILY_HOUR`, and `AUTO_REFRESH_DAILY_MINUTE` to the intended schedule.
2. Set `AUTO_REFRESH_RUN_ON_STARTUP=false` when validating the scheduled path.
3. Redeploy or restart and confirm `[Auto Refresh] Next scheduled run at ... timezone=... expectedCompleteDay=...`.
4. After the scheduled time, confirm:
   - `=== DAILY AUTO-REFRESH + AUTO-PROCESS RUNNING ===`
   - provider-specific success or failure logs for the sources under test
   - `=== AUTO-REFRESH COMPLETE (...s) ===`

External revenue/spend startup-refresh validation:

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
- scheduler failures should log source-specific phrases: `LinkedIn spend reprocess failed`, `Meta spend reprocess failed`, `Google Ads spend reprocess failed`, and `Google Sheets spend reprocess failed`
- internal scheduler self-calls should have a bounded timeout so one stalled provider refresh cannot prevent the full auto-refresh cycle from completing
- the LinkedIn refresh phase inside the external auto-refresh scheduler should also have a bounded timeout so CRM/ecommerce revenue reprocess can still run when LinkedIn refresh stalls
- LinkedIn revenue cleanup must not clear HubSpot pipeline proxy configuration unless the saved HubSpot mapping is explicitly `platformContext=linkedin`

Google Sheets spend auto-refresh rule:

- creating a new Google Sheets spend source is additive and must not reuse an existing source just because the same Google Sheets connection or tab is selected
- Google Sheets spend is refreshed by the external value auto-refresh scheduler, not by the GA4 daily refresh scheduler
- after setup, a mapped Google Sheets spend-value edit must update the same active source automatically without a wizard resave; the default near-real-time target is a provider pull within 1 minute and an open GA4 Overview refetch within 15 additional seconds, approximately 75 seconds under normal provider/runtime conditions
- this is near-real-time polling, not a literal zero-latency guarantee; provider/runtime failures can delay convergence and must be logged without replacing the last successful stored value. Google Drive webhook/channel registration and renewal are not implemented or certified in this path
- the frequent Google Sheets spend timer must remain isolated from Upload CSV and all other provider families
- GA4 daily refresh env vars such as `GA4_DAILY_REFRESH_HOUR`, `GA4_DAILY_REFRESH_MINUTE`, and `GA4_DAILY_REFRESH_RUN_ON_STARTUP` are not valid fast tests for Google Sheets spend
- to validate the normal Google Sheets spend update contract, change a known mapped value and wait for `GOOGLE_SHEETS_SPEND_REFRESH_INTERVAL_MINUTES` plus the Overview display-refetch interval; `AUTO_REFRESH_RUN_ON_STARTUP=true` exercises the full scheduler and is not proof that the source-family timer fired
- production should not keep `AUTO_REFRESH_RUN_ON_STARTUP=true`; the full scheduler remains daily while Google Sheets spend uses its separate bounded interval
- on refresh, the saved Google Sheets spend source is reprocessed from the current sheet rows and replaces the previous stored amount for that source
- refresh must update by stable spend `sourceId`; it must not create a duplicate source, update another source that shares the same connection, or append duplicate rows on repeated scheduler runs
- if a `Date` column is mapped, daily spend records are materialized from the dated rows; adding a new matching dated row should increase `Total Spend` by that row's spend amount after refresh
- if a campaign identifier/value filter is mapped, only rows matching the saved campaign value set should be included

Google Sheets source-modal UI rule:

- Google Sheets revenue/spend setup should prefetch or silently refresh connections while preserving stable content
- do not show transient text such as `Checking Google connection`, `Checking connection...`, `Checking connected Google Sheets...`, or `Loading...` in the modal body if it causes content jumps during entry, Back navigation, or sheet dropdown changes

Google Sheets revenue refresh rule:

- creating a new Google Sheets revenue source is additive and must not reuse an existing source just because the same Google Sheets connection or tab is selected
- scheduled Google Sheets revenue refresh must reprocess the saved source itself and update by stable revenue `sourceId`
- refresh must replace that source's own materialized revenue records before inserting refreshed rows
- refresh must not create a duplicate source, update another source that shares the same connection, or append duplicate rows on repeated scheduler runs
- if a `Date` column is mapped, daily revenue records are materialized from the dated rows; if no date column is mapped, the source remains revenue-to-date snapshot style

CRM auto-reprocess rule:

- saved HubSpot and Salesforce mappings should be reprocessed by the daily auto-refresh scheduler without requiring a user to manually reopen and save the wizard
- HubSpot auto-reprocess should use active HubSpot revenue source mappings as the source of truth and pass the stable revenue `sourceId`
- HubSpot auto-reprocess should self-heal legacy `stageIds:["closedwon"]` mappings by resolving the account's current Closed Won stage IDs before querying deals
- HubSpot auto-reprocess must refresh an expired or missing access token from the stored refresh token before querying HubSpot; it must not silently continue with an expired token
- Salesforce auto-reprocess should use active Salesforce revenue source mappings as the source of truth and pass the stable revenue `sourceId` and saved date field so refresh updates the existing source instead of creating duplicate revenue sources
- the scheduler may use an internal same-process authorization path for its own loopback requests
- internal scheduler self-calls should use same-process loopback so the internal auto-refresh token is accepted by campaign access checks
- public HubSpot and Salesforce save-mapping endpoints must still require normal user authentication and campaign access
- refreshed CRM revenue should update materialized revenue records and recomputed campaign financial state
- if an auto-reprocess self-call returns `404 revenue source not found` for a stable HubSpot, Salesforce, or Shopify source ID, the scheduler should skip that stale source and log it as a stale-source skip; it must not create a replacement source, retry as add mode, or report the skip as a successful refresh
- ad-platform spend auto-refresh must reprocess by stable spend source ID when a source already exists; for LinkedIn spend this means the scheduler passes the active `linkedin_api` source ID and the process endpoint updates only that source instead of creating a replacement row
- validating that the total source count stayed stable is useful duplicate-prevention evidence, but LinkedIn-specific in-place refresh is only live-validated when an active LinkedIn spend source exists before the refresh
- refreshed Pipeline Proxy values remain separate early-signal values and must not be added into confirmed Total Revenue
- Overview Pipeline Proxy visibility should be anchored to the active saved CRM revenue source config; refreshed endpoint data may update the amount/provenance, but a stale endpoint response must not hide an otherwise configured active Pipeline Proxy card
- if both HubSpot and Salesforce have active Pipeline Proxy configuration, the Overview card should aggregate both providers' exact proxy totals while keeping provider-specific provenance in the read-only Pipeline Proxy sources modal

Shopify auto-reprocess rule:

- saved Shopify revenue mappings should be reprocessed by the daily auto-refresh scheduler without requiring a user to manually reopen and save the wizard
- Shopify auto-reprocess should use active Shopify revenue source mappings as the source of truth and pass the stable revenue `sourceId`
- refreshed Shopify revenue should update the existing source's materialized order-date revenue records and recomputed campaign financial state
- Shopify `Tags` attribution should match exact individual Shopify order tags during manual edit and scheduled refresh
- Shopify certification boundary (2026-07-15): GA4 Overview Shopify Revenue is production-ready and clean-certified for the currently enabled Admin API token scope. The canonical evidence in `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md` covers stable refresh identity, transactional rematerialization and last-good retention, failure visibility, connected deployed refresh, exact cleanup, and final owner-scoped clean inventory. Dormant OAuth is excluded; future scheduler/provider events are operational monitoring and reopen only a specifically contradicted path.

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
- for GA4 mock/test flows, the stored KPI value used by alerts must be refreshed from the same total-construction model as the live KPI cards
- `/api/notifications` must also resolve GA4 financial KPI visibility from the same selected financial-source model as the live KPI cards, so stale `performance-alert` rows disappear when the refreshed Revenue/ROAS/ROI/CPA value no longer breaches
- if the exact report-date daily row is missing for a GA4 campaign, the GA4 KPI recompute path should fall back to the latest available persisted GA4 daily row instead of skipping that campaign's alert reconciliation
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
- if the exact report-date daily row is missing for a GA4 campaign, the GA4 benchmark recompute path should fall back to the latest available persisted GA4 daily row instead of skipping that campaign's alert reconciliation

## Ad Comparison Refresh

The current `Ad Comparison` tab has no dedicated background job.

It refreshes because:

- GA4 breakdown inputs refresh
- revenue-source inputs refresh
- the derived comparison view rerenders from those refreshed inputs

Readiness note: GA4 Ad Comparison is production-ready for the current GA4 code scope. The only deferred validation is deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured; see `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`.

## Insights Refresh

The current `Insights` tab is downstream of:

- refreshed GA4 daily facts
- refreshed GA4 to-date totals
- refreshed spend and revenue values
- refreshed KPI context
- refreshed benchmark context

Trend history gates:

- `Daily` requires at least 2 daily rows
- `7d` requires at least 14 daily rows
- `30d` requires at least 60 daily rows
- `Monthly` requires at least 2 calendar months

These requirements are history requirements, not event-count requirements. Running a seed script repeatedly on the same UTC day can increase current metrics, but it does not create multiple daily-history rows for trend comparisons.

## Reports Refresh

Reports do not have a separate report-metrics recompute job.

Instead:

- ad hoc GA4 reports use live refreshed page state at generation time
- scheduled/server-generated reports use saved config plus shared report-generation infrastructure
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

The current codebase is broadly aligned with the required dependency order, but it is split rather than fully consolidated.

What is true today:

- Overview freshness is updated through the GA4 daily refresh pipeline plus external-value auto-refresh processing
- the GA4 daily refresh pipeline refreshes GA4 daily facts, then recomputes GA4 KPI/Benchmark state, then runs KPI/Benchmark alert checks
- the generic KPI scheduler can skip its duplicate GA4 KPI/Benchmark recompute when `GA4_DAILY_PIPELINE_OWNS_RECOMPUTE=true`
- the on-demand GA4 refresh endpoint recomputes GA4 KPI/Benchmark state after updating the latest daily GA4 row
- external source auto-refresh calls the GA4 KPI/Benchmark recompute helper directly after a campaign's upstream source values change
- the GA4 KPI/Benchmark recompute helper also reconciles campaign-level KPI and Benchmark persisted `currentValue` fields from connected-platform totals after GA4, revenue, or spend refresh changes
- when a GA4 KPI/Benchmark recompute runs for a campaign, breached GA4 KPIs and Benchmarks should restore exactly one active in-app alert row if the row is missing
- active bell and Notifications visibility remains breach-only: alert-enabled GA4 KPI/Benchmark rows that are not currently breached should not appear in `/api/notifications`, even if a stale `performance-alert` row exists; for GA4 financial KPI alerts, the breach check must use the same selected GA4 native revenue plus imported revenue/spend model as the live KPI cards
- Ad Comparison refreshes indirectly from refreshed inputs
- Insights refreshes indirectly from refreshed inputs
- Campaign DeepDive Budget & Financial Analysis refreshes current aggregate financial values while visible and on window focus, and historical trend indicators use compatible `metrics.performanceSummary` snapshots created by the snapshot scheduler
- report outputs are generated from already-refreshed tab inputs, with scheduled GA4 reports also performing a best-effort KPI/Benchmark recompute before PDF generation
- scheduled/server-generated GA4 reports now have dedicated server-side rendering for `Overview`, `Ad Comparison`, `Insights`, and `Custom`, using saved report config plus existing refreshed GA4 inputs
- scheduled report processing now fails closed for missing campaign ownership and deduplicates report rows before due checks
- scheduled/test-send report emails now use a simple `MimoSaaS report attached` transactional payload with the generated PDF attachment, and test-send checks Mailgun delivery events when available
- GA4 report final validation passed for the report scheduler/output scope: targeted report regression tests, TypeScript check, production build, GA4 report test-send/PDF delivery, direct snapshot PDF output, and scheduled-report log-cycle behavior
- July 3, 2026: deployed GA4 Overview Report email delivery was user-confirmed for the recorded Overview report packet; future scheduled/test deliveries and report variants still require their own runtime evidence if separately questioned

What is not yet fully consolidated:

- external revenue/spend source refresh is still handled by the external value auto-refresh scheduler
- some immediate post-refresh behavior still relies on a generic KPI refresh helper
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
- `Upload CSV` sources may materialize daily rows when a date column is mapped, but those rows still update only when the user imports or edits the CSV source
- existing stored snapshot sources are still included in recomputed totals until the user edits, replaces, or deletes them
