# GA4 README

## Purpose

This folder is the canonical GA4 documentation set for this codebase.

Use it for all GA4-related development, reviews, testing, and bug fixes.

This is the GA4-specific companion to `ARCHITECTURE_USER_JOURNEY.md`.

Campaign-level KPI/Benchmark production-readiness tracking lives in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`. GA4 is the first connected platform being validated against that campaign-level standard.

Current GA4 tab production-readiness status:

- GA4 Overview is production-ready for the current GA4 code scope. The durable source of truth is `GA4/OVERVIEW_PRODUCTION_READINESS.md`.
- GA4 KPIs are production-ready for the current GA4 code scope. Current local fixes, user-confirmed deployed UI validation, GA4 Revenue notification financial-source visibility validation, target-database damaged-data dry-run, direct GA4 snapshot PDF deployed validation, GA4 daily scheduler timing validation, immediate alert email validation, and scheduled GA4 report/provider validation are complete. The durable source of truth is `GA4/KPIS_PRODUCTION_READINESS.md`.
- GA4 Benchmarks have passed validation for production-ready clean certification for the current GA4 Benchmarks section under the documented scope in `GA4/BENCHMARKS_PRODUCTION_READINESS.md`. The Current Commit queue is complete. Future boundaries are not certified claims: future code changes, future GA4 properties/windows, future alert email deliveries, a real unsimulated Google revoked-token event, daily timer-fired evidence, future source mixes, and future platforms require fresh evidence.
- Absent later code changes, failed validation, contradictory deployed evidence, or changed requirements, future readiness reviews should use the tab-specific readiness doc for each GA4 section and must not infer KPI production readiness from Overview or Benchmark readiness.
- Mandatory anti-overclaim rule: do not repeat any GA4 production-ready answer from this README unless the requested value path's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current readiness evidence. If a new bug is found, mark that path unproven until root cause, tests, and docs are updated.
- Future-reference Shopify revenue status: Shopify Admin API token GA4 Overview revenue is production-ready and clean-certified under the no-overclaiming standard for the validated v1 source-family scope documented in `GA4/OVERVIEW_PRODUCTION_READINESS.md` and `GA4/FINANCIAL_SOURCES.md`. Explicit exclusions remain Shopify OAuth, real >250 matching-order provider pagination, future Shopify/API/provider changes, future untested report/email variants or sends, revenue-changing scheduler provider mutation proof, and optional strict normal wall-clock scheduler timing. This status does not certify Google Ads spend or any other source family.
- Google Sheets/Upload CSV revenue readiness: Current Commits 2 and 3 have user-confirmed deployed UI validation for the normal CSV Revenue flow, but no exact numeric/source-ID packet or forced-failure browser evidence was recorded, so the server rejection and transactional rollback boundaries remain local automated evidence. Current Commit 4 locally adds GA4-only Google Sheets Revenue mapping/date/row rejection before foreground or scheduler revenue source/record mutation. Neither source is clean-certified; use `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` for the exact boundary.

- Google Sheets spend product requirement: mapped sheet-value edits must automatically update the same stored spend source and its GA4 Overview/downstream consumers without a source-wizard resave. The default near-real-time target is a provider pull within 1 minute plus an open Overview refetch within 15 additional seconds, approximately 75 seconds under normal provider/runtime conditions; literal zero-latency delivery is not guaranteed. Upload CSV remains a user-updated snapshot source.
- Google Sheets spend readiness hold: the recurring disconnect root cause was confirmed as Google OAuth `External + Testing`; Publishing status is now `In production`, but `mumus.app` public legal pages/domain ownership, Google branding/data-access verification, final post-publish Google Sheets and GA4 reconnects, automatic token renewal, and more-than-seven-day durability proof are explicitly deferred. Google Sheets spend is not clean-certified while these and the deployed automatic-mutation packet remain open. See `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`.

## How To Use This Folder

Use these files in this order:

1. `GA4/README.md`
2. `../PRODUCTION_READINESS.md` for production-readiness audits, analytics-sensitive feature refinement, and section/source certification work
3. `GA4/REFRESH_AND_PROCESSING.md`
4. `GA4_DEVELOPMENT_WORKFLOW.md` for GA4 stabilization, fix sequencing, regression checks, and testing workflow
5. the specific tab doc you are changing
6. `GA4/OVERVIEW.md` when the work touches Overview behavior, card/table meaning, or GA4 scope
7. `GA4/OVERVIEW_PRODUCTION_READINESS.md` when the work asks whether Overview is production-ready or when using Overview as a template for Meta, Google Ads, LinkedIn, or another source
8. `GA4/FINANCIAL_SOURCES.md` if the work touches revenue, spend, `Latest Day Revenue`, `Latest Day Spend`, `Profit`, `ROAS`, `ROI`, `CPA`, source modal provenance, or imported values

## Canonical GA4 Journey

`Campaign Management -> click on campaign -> campaign-level Overview -> Connected Platforms -> Google Analytics -> View Detailed Analytics`

Important meaning:

- the campaign `Overview` page is still the campaign hub
- `Connected Platforms` is the campaign-scoped launcher and connection-status section
- the GA4 page is the platform-specific analytics layer for that campaign
- the GA4 page is not the campaign-wide rollup page
- the GA4 property and GA4 campaign values are selected during setup; the GA4 analytics page displays the saved scope and does not provide a post-setup campaign picker
- the setup picker must discover real UTM campaign values from GA4 campaign dimensions where available, GA4 manual UTM campaign dimensions where available, and `pageLocation` `utm_campaign` fallback when fresh tagged traffic has not yet populated GA4 attribution dimensions
- revenue and spend sources configured inside GA4, such as HubSpot, Shopify, CSV, or Google Sheets imports, are GA4/campaign financial child inputs; users do not connect them from the campaign `Connected Platforms` section, and they feed financial totals only through the GA4/campaign financial path. Salesforce revenue code/docs are retained as deferred non-v1 behavior and are hidden from the v1 revenue-source chooser.
- Campaign DeepDive `Performance Summary` must consume GA4 and every other implemented main Connected Platform through the shared connected-source aggregate contract, not by special-casing GA4-only UI logic
- Campaign DeepDive must not require duplicate setup for GA4 child revenue/spend systems; those child inputs should affect only the relevant financial totals and should not appear as separate main Connected Platforms
- Campaign DeepDive `Platform Comparison` may show GA4 single-source aggregate financial totals in the Overview table when GA4 is the only main Connected Platform, but GA4 remains a web analytics source and should not be treated as a paid-media source for Cost Analysis or budget recommendations
- Campaign DeepDive `Trend Analysis` production-readiness work is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`; its Overview, Efficiency Metrics, Conversion Funnel, Platform Breakdown, and Insights tabs consume the source-aware trend aggregate so GA4-only campaigns show only GA4-capable trend metrics and executive recommendations.
- Campaign DeepDive `Executive Summary` production-readiness work is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`; GA4-only campaigns should show GA4-capable web analytics and outcome metrics, while paid-media metrics such as impressions, clicks, CTR, CPC, CPM, and paid-media recommendations remain unavailable unless a main paid-media platform supplies the required inputs.

## Doc Map

- `../PRODUCTION_READINESS.md`
  Root-level mandatory production-readiness checklist. Use it before GA4 section-specific readiness docs when auditing, refining, or certifying any GA4 section or future source template.
- `GA4/OVERVIEW.md`
  Covers the GA4 Overview tab, tables, card-population rules, and GA4 campaign scope.
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
  Canonical whole-tab Overview production-readiness source of truth. Current status: production-ready for the current GA4 code scope, with external deployed/provider validation gates documented in that file. It also contains the future-platform template and readiness checklist for Meta, Google Ads, LinkedIn, and other sources.
- `GA4/KPIS.md`
  Covers KPI creation, display, current-value sourcing, gating, alerts, and KPI refresh behavior.
- `GA4/KPIS_PRODUCTION_READINESS.md`
  Canonical whole-tab KPIs production-readiness source of truth. Current status: production-ready for the current GA4 code scope. Current local fixes, user-confirmed deployed UI validation, target-database damaged-data dry-run, direct GA4 snapshot PDF deployed validation, GA4 daily scheduler timing validation, immediate alert email validation, and scheduled GA4 report/provider validation are complete. It also contains the future-source reading order and KPI readiness gates for Meta, Google Ads, LinkedIn, Google Sheets, or another source.
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`
  KPI threshold/scoring policy template and historical slice record. Use it after `GA4/KPIS_PRODUCTION_READINESS.md` when refining KPI scoring for Meta, Google Ads, LinkedIn, Google Sheets, or another source; it is not whole-tab readiness proof by itself.
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`
  KPI/Benchmark alert, notification, email-audit, action URL, bell, and Notifications lifecycle template. Use it after the tab-specific readiness doc when refining KPI alert/notification behavior for another source; GA4 evidence is a template, not proof for the target source.
- `GA4/BENCHMARKS.md`
  Covers benchmark creation, custom benchmark values, status/progress, gating, alerts, and benchmark refresh behavior.
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
  Canonical whole-tab Benchmarks production-readiness source of truth. Current status: passed validation for production-ready clean certification for the current GA4 Benchmarks section under the documented scope. The Current Commit queue is complete. The file explicitly marks future boundaries as non-blockers for current certification and non-certified future claims: future code changes, future GA4 properties/windows, future alert email deliveries, a real unsimulated Google revoked-token event, daily timer-fired evidence, future source mixes, and future platforms require fresh evidence.
- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
  Canonical whole-tab Ad Comparison production-readiness source of truth. Current status: production-ready for the current GA4 code scope, with exactly one deferred validation: deployed scheduled/server PDF revenue-provenance evidence after Mailgun is properly configured.
  Future-reference rule: use that file for the stable answer; do not reopen closed Ad Comparison blockers unless later code changes, failed deferred validation, contradictory deployed evidence, changed requirements, or a new platform assessment requires it.
- `GA4/INSIGHTS.md`
  Short functional overview of the GA4 Insights tab, including sections, scope contract, reports, and refresh pattern.
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
  Canonical whole-tab Insights production-readiness source of truth. It contains section-by-section status, validation evidence, consolidated `What to investigate next` hardening history, and the reusable future-platform template for Meta, Google Ads, LinkedIn, and other sources. Current status: production-ready for the current GA4 Insights code scope, with external runtime caveats documented in that file. Use this file before answering whether the whole Insights tab is production-ready or reusable as a template.
- `GA4/REPORTS.md`
  Covers report creation, custom reports, scheduling, downloads, report-library behavior, and current-state caveats. Current status: production-ready for the current GA4 Reports implementation except for the named deferred `Campaign DeepDive Scheduled Report Visibility`; deployed GA4 Overview Report email delivery is user-confirmed for the recorded 2026-07-03 Overview packet, while future scheduled/test deliveries and report variants require their own runtime evidence if separately questioned.
- `GA4/REPORTS_PRODUCTION_READINESS.md`
  Canonical whole-tab Reports production-readiness source of truth. Use this file before answering whether the Reports section is production-ready; the stable answer is yes, with only `Campaign DeepDive Scheduled Report Visibility` deferred until Campaign DeepDive refinement. Deployed GA4 Overview Report email delivery is user-confirmed for the recorded 2026-07-03 Overview packet; future scheduled/test deliveries and report variants require their own runtime evidence if separately questioned.
- `GA4/REFRESH_AND_PROCESSING.md`
  Covers schedulers, cross-tab dependency order, recomputation rules, and current-state notes for background freshness.
- `GA4/REPORTING_TIMEZONE_PRODUCTION_READINESS.md`
  Tracks the commit plan for executive-ready reporting timezone, campaign create/edit timezone configuration, completed-day cutoff, last-refreshed, scheduler timing, and stale-data behavior.
- `GA4_DEVELOPMENT_WORKFLOW.md`
  Covers the recommended GA4 bug-fix, regression-testing, and manual-testing workflow for stabilizing the platform safely.
- `GA4/FINANCIAL_SOURCES.md`
  Covers `Total Revenue`, `Total Spend`, the `+` source flows, source modal provenance, edit/delete behavior, and computation rules.

## Overview Vs Financial Sources

- `GA4/OVERVIEW.md` explains what the Overview tab contains and how its cards/tables should be understood
- `GA4/OVERVIEW_PRODUCTION_READINESS.md` states that GA4 Overview is production-ready for the current GA4 code scope and provides the reusable future-platform readiness template
- `GA4/FINANCIAL_SOURCES.md` explains the underlying revenue/spend source system that feeds Overview and other GA4 tabs
- HubSpot-specific downstream certification is tracked in `GA4/OVERVIEW_PRODUCTION_READINESS.md`; Current Commit 4.13 has local KPI/Benchmark propagation automation, the persisted-job financial-source fix, and deployed recompute/value-packet evidence closed only for the configured Revenue KPI/Benchmark packet. Current Commit 4.14 locally guards the HubSpot-backed GA4 report email attachment path and has user-confirmed deployed email/PDF evidence only for the configured GA4 Overview Report packet. Current Commit 4.15 has deployed other-campaign portability evidence closed only for the supplied two-campaign packet. Current Commit 4.16 has deployed alternate-mapping matrix evidence closed only for the configured one-variant packet (`2026-07-05.2`, `overallPass: true`, `variantCount: 1`); it does not prove other mappings, raw HubSpot provider objects, raw daily row dates, untested report/KPI/email variants, or future provider changes. HubSpot revenue is production-ready for the validated GA4 Overview revenue section after Current Commit 4.16; future scoped evidence, not current release blockers, would be needed for every possible HubSpot mapping, raw HubSpot provider-object audit, raw daily-row date audit, every report/KPI/email variant, and future provider changes.
- Shopify-specific GA4 Overview source-family certification is tracked in `GA4/OVERVIEW_PRODUCTION_READINESS.md` and `GA4/FINANCIAL_SOURCES.md`. Shopify Admin API token GA4 Overview revenue is clean-certified for the validated source lifecycle, startup-fired scheduler refresh/reprocess, downstream value/content, delivered report email, and deployed Current Commit 8 second-campaign/mapping portability packets. OAuth is deferred and excluded. Real >250-order provider evidence is excluded until a matching Shopify fixture exists. Future Shopify/API/provider changes and untested future report/email variants require future revalidation; normal wall-clock daily scheduler timing is optional operational proof beyond the validated startup-fired scheduler path.

Why this file is separate:

- refresh and processing is shared platform infrastructure, not one tab's behavior
- it affects `Overview`, `KPIs`, `Benchmarks`, `Ad Comparison`, `Insights`, and `Reports`
- keeping it separate avoids duplicating the same refresh rules across multiple tab docs

## Cross-Tab Dependency Rule

The required GA4 platform pattern is:

1. refresh `Overview` inputs first
2. recompute `KPIs`
3. refresh the KPI `Executive snapshot`
4. recompute `Benchmarks`
5. refresh the Benchmark `Executive snapshot`
6. refresh `Ad Comparison`
7. refresh `Insights`
8. let `Reports` render from refreshed tab state when generated or sent

## Template Readiness Status

GA4 is ready to use as the implementation template for the next integration work.

This means future integrations should copy the validated GA4 patterns for:

- campaign and platform scoping
- source add/edit/delete/refresh identity
- scheduler fail-closed behavior
- KPI/Benchmark recompute ordering
- alert/notification visibility behavior
- report create/update/delete/snapshot/test-send/scheduled-send safety
- shared PDF generation and transactional report email delivery

Do not copy old legacy shortcuts or create parallel paths. If a new integration needs different provider-specific behavior, keep that behavior inside the existing platform-specific layer while preserving the same campaign-scoped architecture.

For future main Connected Platforms, the integration is not complete until it also participates in the Campaign DeepDive aggregate contract through the generic source contract: source identity, capabilities, included/excluded metric reasons, freshness, current totals, scheduler snapshot inputs, and regression coverage. Future standalone platforms such as Google Ads, TikTok, Instagram, and other sources should plug into the same aggregate contract instead of adding Performance Summary tab-specific logic.

## Recent Live GA4 Production-Readiness Fixes

These are now part of the GA4 template contract:

- live GA4 campaign setup should show selectable UTM campaign values after property selection, not require the user to retype `campaignName` when real campaign values can be discovered
- placeholder values such as `(direct)` must not be treated as the only available campaign choice when manual UTM dimensions or `pageLocation` URLs contain real `utm_campaign` values
- live Overview cards and tables should use the selected UTM campaign scope from GA4 attribution dimensions first, with a `pageLocation` `utm_campaign` fallback for fresh Measurement Protocol or tagged traffic that is visible in URLs before attribution dimensions populate
- live Overview Summary cards must import metrics from the selected GA4 property and saved campaign values as one coherent source: persisted selected-campaign daily facts when available, then selected-campaign to-date totals, then selected-campaign breakdown totals
- when GA4 exposes selected-campaign traffic through `pageLocation` `utm_campaign` but exposes conversions/native revenue through `campaignName`, the Overview import path supplements only missing `Conversions` and GA4-native `Revenue`; it must not overwrite sessions, users, pageviews, engagement, KPI/Benchmark math, imported revenue, spend, or alert behavior
- live breakdown totals can feed the visible Overview cards when GA4 to-date totals or persisted daily rows are still empty, so a live property with current UTM traffic does not render zero top-line metrics while populated tables exist
- Overview Summary cards should not flash stale fallback totals while the selected GA4 property's campaign breakdown is still loading. During that initial breakdown load, card values render a stable skeleton so values such as `Conversions` load directly into the current total instead of briefly showing an older lower value.
- GA4 Overview `Landing Pages` and `Conversion Events` use the same selected Overview date range as the nearby Summary/Campaign Breakdown/current performance sections, while preserving GA4 property selection and saved GA4 campaign scope
- GA4 Overview `Landing Pages` can supplement missing row conversions from conversion-prioritized same-scope `pageLocation` UTM rows only by exact landing-page/source/medium match, including when the base rows came from same-scope `pageLocation` traffic fallback because primary campaign attribution dimensions were empty; `Conversion Events` can supplement missing row conversions from conversion-prioritized same-scope `pageLocation` UTM rows only by exact event-name match; neither table may allocate campaign-level conversions or imported revenue into unmatched rows, and rows that already have conversions/revenue are not overwritten
- GA4 Overview `Landing Pages` and `Conversion Events` are live row-level GA4 Data API views for numeric property IDs, not reconstructions from scheduler-populated `ga4_daily_metrics`; zero row-level conversions are valid only when GA4 returns zero for the exact table grain
- GA4 Overview financial cards use one selected scoped GA4 financial source for native revenue and CPA conversions, choosing the most complete native revenue source across to-date, daily, and breakdown totals while Summary cards keep their coherent daily/to-date/breakdown source hierarchy; KPI, Benchmark, Ad Comparison, Insights, browser-generated report output, and scheduled/server GA4 report output must use the same relevant Overview source model; deployed automated Overview endpoint, report/PDF, recorded report-email, target-campaign source-damage inventory, and configured Google Sheets mapping-variant evidence are documented in `GA4/OVERVIEW_PRODUCTION_READINESS.md`; GA4 Overview whole-tab status is production-ready for the current GA4 code scope, with that file as the durable source of truth
- GA4 Overview `Campaign Breakdown` preserves raw selected-property GA4 row metrics for Sessions, Users, Conversions, and GA4-native Revenue; it must not scale campaign rows to Summary card totals
- exact campaign-matched imported revenue now propagates into GA4 Overview `Campaign Breakdown`, GA4 `Ad Comparison`, and report output while `Total Revenue` remains GA4 native revenue plus all active imported revenue sources; targeted validation passed for commits `44c68a2a`, `2713efd7`, and `8c4103fd`; HubSpot-specific deployed Campaign Breakdown mapped-row evidence is recorded in `GA4/OVERVIEW_PRODUCTION_READINESS.md` under Current Commit 4.11
- HubSpot-specific report value propagation is guarded in Current Commit 4.12 by `GA4OverviewValidation.hubspotReportValuePack(...)` and static scheduled/server PDF formula checks; deployed evidence passed for the configured `GA4 Overview Report` packet and remains limited to that report/campaign/property
- the `Add revenue source` chooser shows saved-source status for v1 revenue source families: Shopify and HubSpot show connection/import status where applicable, Google Sheets shows `Connected` when an active Google Sheets revenue source exists for the current platform context, CSV shows `Uploaded` when an active CSV revenue source exists, and Salesforce revenue is hidden/deferred for v1
- CRM/ecommerce Crosswalk screens should not render a redundant `Selected Campaigns label` field; selected counts and selected value rows are the visible selection summary
- HubSpot and Salesforce `Review Settings` show the selected deal/opportunity labels together with the amount that will be imported for each selected record; HubSpot also shows the selected CRM value to saved platform-campaign mapping before save, hides the zero Pipeline Proxy summary in unchanged edit mode once the open-stage amount is known to be zero, and keeps confirmed `Total Revenue (to date)` as the sum of included confirmed records
- HubSpot and Shopify rows in the GA4 Overview `Revenue Sources` modal should show the saved mapped platform-campaign name under the source title when `campaignMappings` exist, falling back to the source type when no mapping is saved
- Shopify `Review Settings` revenue breakdown rows show campaign/value revenue amounts without appending order-count text such as `(1 order)`
- GA4 KPI creation uses a constrained unit dropdown, highlights `Create Custom KPI` when selected, keeps custom KPI current/target values in generic numeric format until a real unit is selected, disables `Create KPI` until `KPI Name` and `Target Value` are entered, and disables `Update KPI` in edit mode until at least one form value changes
- GA4 KPI whole-tab status is production-ready for the current GA4 code scope; `GA4/KPIS_PRODUCTION_READINESS.md` is the durable source of truth. The GA4 Revenue notification financial-source visibility fix has been deployed and user-validated, the target-database damaged-data inventory dry-run found 0 candidates and 9 skipped rows, direct snapshot PDF validation passed, GA4 daily scheduler timing passed, immediate alert email delivery passed, and scheduled GA4 report/provider validation passed.
- GA4 Benchmark creation follows the same custom-entry pattern: `Create Custom Benchmark` is highlighted when selected, shows `Choose name + unit, then set values`, uses a constrained unit dropdown, keeps custom current/benchmark values in generic numeric format until a real unit is selected, disables `Create Benchmark` until `Benchmark Name` and `Benchmark Value` are entered, and disables `Update Benchmark` in edit mode until at least one form value changes
- GA4 Benchmark whole-tab status has passed validation for production-ready clean certification for the current GA4 Benchmarks section under the documented scope; `GA4/BENCHMARKS_PRODUCTION_READINESS.md` is the durable source of truth for future production-readiness answers. Future boundaries are not current blockers, but they are not certified claims without fresh evidence.
- GA4 `Ad Comparison` leader cards and report output use the same refreshed campaign comparison rows as the live table, including exact campaign-matched imported revenue and mapped-revenue-created rows; `Best Performing`, `Most Efficient`, and `Needs Attention` must not render stale GA4-only values when the underlying revenue/breakdown inputs update, and card CR details use two-decimal exact-rate formatting so close decisions are explainable
- GA4 `Ad Comparison` display provenance is now part of the template: the metric selector sits in the header because it controls the cards, chart ranking, and selected-metric summary while the All Campaigns table keeps stable campaign-row order and removes the blank descriptor gap under the title when no provenance description is rendered; conversion-rate summary uses `Overall Conversion Rate`, unallocated external revenue is computed from imported-source residuals only, and `Revenue Breakdown` uses source-level GA4/imported revenue totals rather than rounded campaign-row sums. Current status: production-ready for the current GA4 code scope, with deployed scheduled/server PDF revenue-provenance evidence deferred until Mailgun is properly configured.
- GA4 daily time-series/backfill uses the same selected-campaign import rule as Overview: query campaign attribution dimensions first, use `pageLocation` `utm_campaign` only when the primary daily result has no rows, and supplement missing conversion/revenue fields from a compatible selected-campaign `campaignName` query when GA4 splits traffic and purchase attribution across dimensions. Visible Trends rows remain completed-day rows and exclude today's intraday data.
- GA4 Insights Trends history gating is mode-specific: `Daily` needs 2 days, `7d` needs 14 days, `30d` needs 60 days, and `Monthly` needs 2 calendar months
- GA4 reporting timezone is a campaign-level setting. `Create New Campaign` and `Edit Campaign` both expose a `Reporting Timezone` select, default new campaigns from the browser timezone when available, fall back to `UTC`, and save the selected IANA timezone through the campaign create/update payload. Dropdown labels remove underscores for readability while preserving exact saved values such as `America/New_York`.
- GA4 live/mock property boundary is part of the template contract: numeric GA4 property IDs must use live GA4 import/query paths, while only explicit `yesop` demo connections or request-level `?mock=1` may use deterministic simulation. Commit `4074d282` fixed the prior leakage where property `498536418` was treated as the Yesop simulator; user validation passed.
- GA4 Insights whole-tab status is production-ready for the current GA4 code scope; `GA4/INSIGHTS_PRODUCTION_READINESS.md` is the durable source of truth for future production-readiness answers
- GA4 Insights Executive Financials source copy is conditional on actual connected sources: it must not claim imported revenue or source-backed spend unless those sources are present, and it should not append date-range copy because Trends owns freshness/date context
- GA4 Insights Trends uses `Completed-day cutoff` for the completed reporting-day boundary and `Latest imported day` for the latest actual persisted visible row; those can differ when GA4 returns no row for a completed day
- GA4 Insights report-rendered Trends charts follow the live UI visual contract for the data rendered: zero-based y-axis, light gridlines, muted axes, blue line/bar styling, and readable date labels
- GA4 Insights `What to investigate next` is validated as grouped, evidence-aware, history-aware, non-causal executive guidance; downloaded and scheduled report output preserves the same intro, finding groups, data basis, confidence, and `Recommended check:` wording as the live Insights tab

Live GA4 processing caveat:

- GA4 Measurement Protocol and GA4 reporting are asynchronous. Values can increase after a script run or live traffic event without rerunning the script because Google may finish processing already-sent events later and the app may refetch updated GA4 Data API values.
- Native GA4 `Conversions` depend on the property's configured key events. Validation scripts should avoid sending standalone events that the property may classify as key events unless the test is explicitly about conversion configuration.

Performance Summary GA4 validation should use the live/mock GA4 test-property setup documented in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`. That setup validates GA4 data changes over time, app refresh, updated Performance Summary current values, compatible snapshot creation, `What's Changed`, and `Metric Trends`. It requires at least two compatible snapshots for trends, two comparable periods for `What's Changed`, seven or more days for `Last 7 Days`, and thirty or more days for `Last 30 Days`.

Performance Summary Overview should not label a campaign as `all metrics on track` unless at least one campaign KPI or Benchmark target exists. When connected-source metrics exist but no KPI/Benchmark targets are configured, `Top Priority Action` should ask the user to add campaign KPIs or Benchmarks. When no connected-source metrics exist, it should ask the user to connect a source. Unavailable impression cards should use executive-facing copy such as `Unavailable from connected sources`; detailed unavailable reasons remain in the aggregate/API for diagnostics.

Budget & Financial Analysis GA4 financial behavior is tracked in `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` and `GA4/FINANCIAL_SOURCES.md`. GA4 child revenue/spend inputs can feed aggregate financial totals, but Budget Allocation and Financial Performance Insights should treat spend-capable main Connected Platforms as the source set for allocation and paid-media optimization guidance. Budget & Financial current values refetch through the same aggregate contract while visible and on window focus, and trend comparisons must use compatible aggregate snapshots rather than legacy top-level snapshot totals. Current GA4 financial aggregate values in `/outcome-totals.performanceSummary` should align with GA4 Overview selected scoped native GA4 financial totals plus imported revenue/spend provenance, while top-level date-range GA4 fields can remain windowed.

Platform Comparison GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`. GA4 should appear as the main Google Analytics source, not as separate child revenue/spend inputs. The Overview table can display aggregate Spend, ROAS, and ROI for a GA4-only campaign when the shared aggregate has those totals, while Cost Analysis and paid-media Insights remain unavailable until a main paid-media platform with source-level spend is connected.

Trend Analysis GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`. The Trend Analysis aggregate returns connected main sources, daily rows, source capabilities, included metrics, unavailable reasons, and aggregate daily totals. The Overview, Efficiency Metrics, Conversion Funnel, Platform Breakdown, and Insights tabs now use that aggregate, so GA4-only campaigns should show GA4-capable trends such as sessions, users, conversions, revenue, CVR, and engagement rate where available, while paid-media metrics remain unavailable unless a main paid-media platform supplies the required inputs.

Executive Summary GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`. Its current endpoint now includes the shared `performanceSummary` aggregate and should use aggregate availability to decide which Executive Overview metrics are shown. GA4-only Executive Summary validation should confirm Google Analytics appears as the main source, active GA4-context financial child sources can appear as `category: "financial"` provenance in `performanceSummary.sources`, and stale paid-media sources such as Meta/Facebook do not appear unless the main paid-media platform is connected. The Marketing Funnel Performance chart should make the GA4-only path explicit as users -> sessions -> conversions -> revenue, so executives can see whether the bottleneck is traffic reaching the site, sessions/engagement, conversion, or financial return.

For a newly connected mock-live GA4 campaign, Executive Summary can validate current connected-source metrics immediately, but 7-day snapshot trajectory should show `Not enough history` until compatible `performanceSummary` snapshots exist for both the latest point and the point roughly seven days earlier. This trajectory is independent of the removed Executive Summary date dropdown. This newly connected mock-live path is the best validation path for the no-history state because existing mock campaigns may already have seeded or legacy snapshot history. Risk Level is different from trajectory: it should populate immediately from current available connected-source inputs. Seven days is the default trajectory window because 1-2 day comparisons are too noisy for executive direction, while 30 days is slower than needed for an Executive Summary signal. Outstanding validation: connect a new mock-live GA4 campaign, confirm current GA4 metrics and Risk Level populate immediately, confirm `7-Day Snapshot Trajectory` initially shows `Not enough history`, and later confirm trajectory appears only after compatible `performanceSummary` snapshot history exists.

Executive Summary should not show Campaign Grade or Health Score in the UI. Those values may still exist in the backend response for API compatibility, but they are product-defined heuristics rather than direct GA4 or connected-source metrics. The narrative Executive Summary paragraph should also avoid hidden grade/score wording and should state factual available ROI/ROAS from the same `performanceSummary` aggregate used by the visible Executive Overview metrics, plus Risk Level and 7-day snapshot trajectory state. GA4 validation should focus on connected-source metrics, Marketing Funnel Performance, Risk Level, and 7-day snapshot trajectory state. The separate Campaign Story paragraph and duplicate Platform Performance card should not appear in Executive Summary; platform-level side-by-side detail belongs in Platform Comparison.

Executive Summary unavailable clicks and impressions should display executive-facing copy such as `Unavailable from connected sources`. Detailed aggregate unavailable reasons remain in the API for diagnostics, but the executive UI should not expose source-specific diagnostic wording in those compact metric cards.

Executive Summary Risk Assessment should show a fixed executive-facing `Risk inputs` list: KPI Risk, Benchmark Risk, Data Freshness, ROI / ROAS Risk, 7-Day Trend Risk, and Paid Platform Concentration Risk. For GA4-only campaigns, Paid Platform Concentration Risk should remain visible as `Not Applicable` because no main paid-media platform is connected. Visible ROI/ROAS risk-input values and KPI/Benchmark risk counts should use the same page-level `performanceSummary` aggregate as the Executive Summary metric cards, KPI Progress, and Benchmark Comparison. Budget pacing remains in Budget & Financial Analysis until Executive Summary has a shared pacing input.

Executive Summary Risk Assessment should refresh both its Executive Summary endpoint data and its page-level outcome totals aggregate when the page mounts or the browser regains focus. This keeps the six risk inputs aligned after GA4/current-source metrics, KPI targets, Benchmark targets, freshness state, compatible snapshots, or paid-source connections change.

Executive Summary should not block the full subsection on the secondary outcome-totals request. It should render from `/executive-summary` once available, then use `/outcome-totals` to align page-level aggregate values when that response arrives or refetches.

Executive Summary should preserve the active tab through the URL hash. Refreshing while viewing Strategic Recommendations should reload Strategic Recommendations, not reset to Executive Overview.

Executive Summary Strategic Recommendations now use source-capability gating. For GA4-only campaigns, the tab may show web/outcome guidance from available GA4 users, sessions, conversions, revenue, or CVR, but it must not show paid-media budget reallocation, paid platform diversification, scaling, ROAS/ROI, CPA, CPC, CTR, or CPM claims unless a main paid-media platform supplies the required inputs. GA4-only web/outcome guidance should state live revenue, conversion, and CVR outcomes plainly, compare mapped KPI/Benchmark targets for CVR, revenue, and conversions when available, and give a next action without making paid-media claims.

In GA4-only Strategic Recommendations, Website Outcomes `Expected Impact` should render as bullet points for readability. `Timeframe` should communicate the review/action window, and `Investment Required` should clarify that the recommendation is analysis-only unless a paid-media source is connected.

Strategic Recommendations are executive-ready in the implemented GA4-only scope when they show factual web/outcome guidance from available GA4/current-source values, target context when mapped KPI/Benchmark records exist, a clear next action, assumptions, and no paid-media claims. Recommendation inputs update through the Executive Summary refetch path: the endpoint recomputes source eligibility and target context, and the UI renders Website Outcomes values from page-level `performanceSummary.totals` after mount, window-focus, or active-tab interval refetch.

When GA4 is combined with paid-media integrations such as Google Ads, Executive Summary must use the same aggregate source composition as `/outcome-totals`. Paid-media sources should enter Executive Summary through normalized `platformSources` and must be covered in `/executive-summary`, `/outcome-totals`, scheduler snapshots, source freshness, KPI/Benchmark mapping, risk inputs, and Strategic Recommendation eligibility before that source mix is treated as production-ready. Paid-media `attributedRevenue` counts as an aggregate revenue input for Executive Summary eligibility when the source has a validated attribution path. Google Ads local Connected Platforms refinement and attributed-revenue import evidence is tracked in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` through Commit 29; live OAuth still needs deployed or production-like evidence before that path is considered production-ready. That is separate source work, not an Executive Summary implementation blocker.

Campaign DeepDive `Custom Report` production-readiness is tracked in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`. From Campaign DeepDive, Custom Report opens the Reports builder with campaign context, reads `/api/campaigns/:campaignId/outcome-totals`, and uses `performanceSummary.sources` plus `performanceSummary.totals` as the source of truth. For GA4-only campaigns, the metric picker and saved report output should expose only GA4-capable web analytics and outcome metrics such as users, sessions, conversions, revenue, and CVR when available. Paid-media metrics such as impressions, clicks, spend, CTR, CPC, CPM, CPA, paid-media ROAS, and paid-media ROI remain hidden until a connected main paid-media source supplies those inputs. Custom Report KPI and Benchmark sections use campaign records for rows and targets, while current values come from available aggregate metrics. All Reports cards are summary-only and should not show connected-source values, KPI/Benchmark row details, generated status pills, or `Includes` configuration details inline. The card edit icon should reopen the report dialog with saved values prefilled, show `Update Report`, and keep update disabled until a value changes. The top-level `Create Report` action should always open a blank create form instead of reusing values from the last edited report; unscheduled create mode should show `Download Report` and save the report under `Standard Reports`, while scheduled create mode should use `Schedule Automated Report`, show `Schedule Report`, save the report under `Scheduled Reports`, and create a backend scheduled report record through `/api/platforms/campaign_deepdive/reports` so `server/report-scheduler.ts` can send the email. When opened from Campaign DeepDive Custom Report, the report type dropdown should show Campaign DeepDive subsection report types and allow users to select which tabs from the selected subsection to include; selected tabs are saved as report composition in `selectedSections`. Downloaded Campaign DeepDive subsection PDFs should render body content for each selected tab from `performanceSummary.totals` and `performanceSummary.sources`, not only the selected tab names. Scheduled Campaign DeepDive PDFs should also render selected section body content from a shared latest-value server context that includes campaign context, `performanceSummary`, Executive Summary context where selected, KPI rows, Benchmark rows, and Trend Analysis aggregate only when selected. The final scheduled-email acceptance checklist lives in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md` under `Deployed Scheduled Email Evidence Checklist`; it can be completed with the current GA4-only campaign or later with another validated Connected Platform such as LinkedIn, and it proves the source mix tested rather than every future source mix. It remains pending until a real scheduled send confirms receipt, selected section body content, values matching the current app at send time, and the connected-source mix active at send time. The standalone `/reports` route is not represented as a sidebar Reports item.

When Custom Report is opened from Campaign DeepDive with `/reports?campaignId=<campaignId>`, Standard Reports, Scheduled Reports, All Reports, report type filters, and result counts should show only stored reports whose `campaignId` matches the active campaign. Campaign-scoped pages should not seed global/demo reports.

Executive Summary status is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Executive Summary Status Map`. Completed aggregate future-proofing work is tracked under `Completed Executive Summary future-proofing checklist`. Google Ads platform-specific refinement is tracked separately from Executive Summary aggregate-readiness.

The Executive Summary future-platform acceptance gate is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Future Connected Platform acceptance gate`. This is a standing rule for future or refined main sources, not an open Executive Summary implementation task. A new or refined platform is not production-ready as an Executive Summary source until it passes the shared aggregate, `/outcome-totals`, `/executive-summary`, scheduler snapshot, KPI/Benchmark, Risk input, Strategic Recommendation, regression, and deployed-validation checks.

The Executive Summary deployed-validation checklist is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Deployed validation checklist and evidence log`. It is an acceptance evidence log for deployed source mixes, not a separate implementation task. Scenario evidence should remain incomplete until GA4-only, GA4 plus refined Google Ads, and GA4 plus multiple-paid-source campaign variants are validated in a deployed or production-like environment.

Executive Summary and `/outcome-totals` should enter the shared aggregate contract through the same route-level aggregate wrapper so future refined main platform sources use one source-composition path before being passed to `buildPerformanceSummaryAggregate`.

Scheduler snapshots that feed Executive Summary `7-Day Snapshot Trajectory` must include the same normalized main source set in `metrics.performanceSummary`. For the current future-proofing slice, Google Ads rows are passed into scheduler snapshot `performanceSummary` as a normalized `platformSources` source; future platforms need the same scheduler wiring before they are production-ready in Executive Summary.

GA4-only Strategic Recommendations regression coverage should guard four cases: web/outcome guidance with targets, web/outcome guidance without targets, paid-media guidance remaining blocked, and insufficient GA4/web inputs producing no recommendation instead of zero-filled claims.

Executive Summary KPI Progress should be fed by campaign-level KPI records whose current value can be mapped to available GA4/connected-source aggregate metrics. Campaign-level KPI create, update, and delete actions should refresh the campaign Executive Summary query so KPI Progress reflects the latest KPI list and targets. Targets come from campaign-level KPI records, but current values, progress percentages, and statuses should render from live GA4/connected-source aggregate values for metrics such as users, sessions, conversions, revenue, ROI, ROAS, CTR, or CVR. Executive Summary must not silently fall back to saved KPI progress/current values when a KPI cannot be mapped to an available aggregate metric.

Executive Summary Benchmark Comparison should follow the same source-of-truth rule. Campaign-level Benchmark records define the rows and benchmark targets, and campaign-level Benchmark create, update, and delete actions should refresh the campaign Executive Summary query. `Yours` current values should come from live GA4/connected-source aggregate metrics when mapped and available. Executive Summary must not silently fall back to saved Benchmark `currentValue` snapshots for unmapped or unavailable current values.

The Trend Analysis `Insights` tab should provide executive recommendations from the other aggregate-backed Trend Analysis tabs. It should not use Google Trends keyword widgets as campaign performance recommendations, and it should not show the page-level history dropdown because it summarizes the other Trend Analysis views.

Trend Analysis scheduler snapshots now store `metrics.trendAnalysis` using the same `trend_analysis_aggregate_v1` contract. Manual snapshots, platform-sync snapshots, and automatic scheduler snapshots should therefore carry compatible Trend Analysis history while legacy snapshots without `metrics.trendAnalysis` remain incompatible and should not be used for aggregate trend comparisons.

For current `yesop` mock GA4 campaigns, validate Trend Analysis against the same date window used by the GA4 platform view. If the mock campaign was created or viewed with a 90-day scope, choose `Last 90 Days` in Trend Analysis. Mock validation proves source-aware wiring and date-window behavior; final numeric accuracy still requires the planned mock-live GA4 account with controlled daily data.

Current Render validation for Trend Analysis proves UI and aggregate-contract wiring only. Full historical trend accuracy requires the planned mock-live GA4 account, because Trend Analysis needs multiple saved daily records from different days to prove Day 2 versus Day 1 comparison and later 7-day/30-day windows. New snapshots after the scheduler alignment should include `metrics.trendAnalysis.version = "trend_analysis_aggregate_v1"`; older snapshots without that block are legacy history and should not be used as proof of Trend Analysis historical accuracy.

For the Trend Analysis Conversion Funnel tab, current mock-placeholder validation should confirm that GA4 appears only as a web analytics source and paid-media funnel metrics remain unavailable unless a main paid-media platform supplies impressions or clicks. Full-period funnel trend validation should be done later with the planned mock-live GA4 account after enough controlled daily rows exist.

For the Trend Analysis Platform Breakdown tab, current mock-placeholder validation should confirm that Google Analytics appears as the main connected source and child revenue/spend inputs do not appear as separate platforms. Full historical breakdown validation should be done later with the planned mock-live GA4 account after enough controlled daily rows exist.

## Reference Rule

For future development:

- reference `GA4/README.md` in high-level docs
- reference the tab-specific file when work is scoped to one tab
- reference `GA4/FINANCIAL_SOURCES.md` for any spend/revenue work, even if the visible bug is elsewhere
