# GA4 README

## Purpose

This folder is the canonical GA4 documentation set for this codebase.

Use it for all GA4-related development, reviews, testing, and bug fixes.

This is the GA4-specific companion to `ARCHITECTURE_USER_JOURNEY.md`.

Campaign-level KPI/Benchmark production-readiness tracking lives in `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`. GA4 is the first connected platform being validated against that campaign-level standard.

Current GA4 tab production-readiness status:

<!-- ga4-insights-current-status -->
<!-- ga4-insights-certification-status: PRODUCTION_READY -->

- GA4 Insights is **PRODUCTION_READY** only for the exact certified runtime boundary in `GA4/certifications/ga4-insights.json`, `4be16c54c550a45dbf3104313c820ea47b453604`. Authenticated value parity remains bounded to the recorded campaign/property/configuration.

<!-- /ga4-insights-current-status -->

<!-- ga4-kpi-certification-status: PRODUCTION_READY -->

<!-- ga4-overview-current-status -->
<!-- ga4-overview-certification-status: PRODUCTION_READY -->

- GA4 Overview is **PRODUCTION_READY** only for the exact certified runtime boundary in `GA4/certifications/ga4-overview.json`, `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`. That record remains bounded to its campaign/property/source/configuration.

- The concise current decision lives in `GA4/OVERVIEW_PRODUCTION_READINESS.md`; detailed evidence lives in `GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`; chronological Current Commits 0–24 live in `GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md`. No production cleanup was performed or authorized.

<!-- /ga4-overview-current-status -->
- Current Commit 7's deployed validation also confirmed that an active OAuth placeholder with an empty GA4 Property ID fails closed instead of rendering permanent skeletons, while persisted campaign-scoped financial sources remain reachable for exact reviewed removal.
- GA4 KPIs are **PRODUCTION_READY** only for exact certified runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1` recorded in `GA4/certifications/ga4-kpis.json`.
- GA4 Benchmarks remain **PRODUCTION_READY** for their locked certified runtime boundary `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`. Authenticated read-only supporting parity passed on `19f05537`, but the protected Benchmark certification record is not reissued here.
- GA4 Ad Comparison remains **PRODUCTION_READY** at certified runtime boundary `4be16c54c550a45dbf3104313c820ea47b453604` for its recorded property/filter/source boundary.
- GA4 Reports is **PRODUCTION_READY** only for exact certified runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e` recorded in `GA4/certifications/ga4-reports.json`. Campaign DeepDive remains excluded from that GA4 Reports certification.
- The final combined GA4 release-certification audit is complete for these six recorded section boundaries. It does not certify excluded platforms, Campaign DeepDive, future configurations, future provider availability, or the 17 obsolete campaigns outside the active boundary.
- Absent later code changes, failed validation, contradictory deployed evidence, or changed requirements, future readiness reviews should use the tab-specific readiness doc for each GA4 section and must not infer KPI production readiness from Overview or Benchmark readiness.
- Mandatory anti-overclaim rule: do not repeat any GA4 production-ready answer from this README unless the requested value path's complete value inventory, post-fetch transforms, fallback branches, negative cases, and downstream propagation matrix are covered by current readiness evidence. If a new bug is found, mark that path unproven until root cause, tests, and docs are updated.
- Certification integrity rule: GA4 readiness is valid only for the exact certified SHA/configuration/dependency boundary. A relevant upstream or downstream change automatically invalidates affected tabs. The Overview record is `GA4/certifications/ga4-overview.json` and its checker is `npm run check:ga4-overview-certification`; the KPI record and checker remain separate. Copied formulas and source-text guards are structural evidence only.
- Exact-SHA reconciliation note (2026-09-05): KPI and Overview are certified at deployed runtime `dc20c1e1`. Review limits the delta from their prior boundaries to Notifications and post-refresh alert reconciliation; KPI/Overview values, formulas, cards, aggregates, financial-source rules, and report renderers are unchanged. The exact required non-Playwright regression inventory, TypeScript, production build, production health, production Notifications checks, and manual scheduler recomputation passed. Historical authenticated value/browser evidence carries only through unchanged paths. No new browser-automation, natural-timer, inbox-delivery, or global scheduler-health claim is made. Benchmark remains locked at `12789c1e`; Ad Comparison and Insights remain at `4be16c54`; Reports remains at `94f1096f`.
- Shopify Revenue status (2026-08-10): **clean-certified for exact enabled source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` inside the recorded Overview boundary**. Dormant OAuth, non-GA4 sources, future stores, and generalized provider behavior remain excluded.
- Upload CSV Revenue status (2026-08-10): **clean-certified for exact enabled source `d4421cb9-8298-4d96-8697-c82ef5f0b7b5` inside the recorded Overview boundary**. Unlisted CSV variants and an unconfigured future Google Sheets Revenue source remain excluded.
- HubSpot Revenue status (2026-08-10): **clean-certified for exact enabled sources `d4ad51ef-85fe-4b67-bbd5-854900be3dee`, `65867434-cbed-4792-9496-8072f63a9c82`, and `5b2ac08d-16dd-44f5-aca6-18d68c9d5a7c` inside the recorded Overview boundary**. Future mappings and unrelated historical rows remain excluded.
- Google Sheets Revenue is no longer on hold. Current Commit 21 deployed its existing GA4 chooser/API entry point without changing production data; an unconfigured future Revenue source is not certified by chooser availability.

- Insights has no source chooser. Overview owns the GA4 financial-source chooser and Insights audits must not change it. Google Ads has no live-test evidence and is excluded from Insights certification; LinkedIn, Meta/Facebook, and Instagram are not enabled as Insights inputs for this release.
- Google Sheets spend product requirement: mapped sheet-value edits must automatically update the same stored spend source and its GA4 Overview/downstream consumers without a source-wizard resave. The default near-real-time target is a provider pull within 1 minute plus an open Overview refetch within 15 additional seconds, approximately 75 seconds under normal provider/runtime conditions; literal zero-latency delivery is not guaranteed. Upload CSV remains a user-updated snapshot source.
- Google Sheets spend continuity status: the recurring disconnect root cause was confirmed as Google OAuth `External + Testing`; Publishing status is now `In production`. The post-publish Google Sheets reconnect plus one deployed no-click automatic mapped-value update were user-confirmed on `2026-08-01`. That configured source is included in the exact Overview boundary; automatic renewal, generalized more-than-seven-day durability, broader Google verification, and exhaustive polling/failure behavior remain outside an independent source-family certification. See `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`.
- Whole-Overview Current Commit 5's temporary Google Sheets Revenue/Spend setup block is superseded by Current Commit 21. New Google Sheets setup uses the existing guarded mapped workflows. New GA4 CSV Spend remains dated-only; already-undated saved sources are retained but unproven.

## How To Use This Folder

Use these files in this order:

1. `GA4/README.md`
2. `../PRODUCTION_READINESS.md` for production-readiness audits, analytics-sensitive feature refinement, and section/source certification work
3. `GA4/REFRESH_AND_PROCESSING.md`
4. `GA4_DEVELOPMENT_WORKFLOW.md` for GA4 stabilization, fix sequencing, regression checks, and testing workflow
5. the specific tab doc you are changing
6. `GA4/OVERVIEW.md` when the work touches Overview behavior, card/table meaning, or GA4 scope
7. `GA4/OVERVIEW_PRODUCTION_READINESS.md` for the current Overview decision, supported release scope, completed section gates, and exact boundary
8. `GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md` for detailed inventories, traces, blockers, production-data findings, and validation packets
9. `GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md` for the chronological Current Commit 0–21 and UI-validation record
10. `GA4/FINANCIAL_SOURCES.md` if the work touches revenue, spend, `Latest Day Revenue`, `Latest Day Spend`, `Profit`, `ROAS`, `ROI`, `CPA`, source modal provenance, or imported values

## Canonical GA4 Journey

`Campaign Management -> click on campaign -> campaign-level Overview -> Connected Platforms -> Google Analytics -> View Detailed Analytics`

Important meaning:

- the campaign `Overview` page is still the campaign hub
- `Connected Platforms` is the campaign-scoped launcher and connection-status section
- the GA4 page is the platform-specific analytics layer for that campaign
- the GA4 page is not the campaign-wide rollup page
- the GA4 property and GA4 campaign values are selected during setup; the GA4 analytics page displays the saved scope and does not provide a post-setup campaign picker
- the configured historical lookback establishes the fixed initial-import boundary; current GA4 Summary traffic values then accumulate through the latest completed reporting day instead of rolling forward with the original lookback length
- the setup picker must discover real UTM campaign values from GA4 campaign dimensions where available, GA4 manual UTM campaign dimensions where available, and `pageLocation` `utm_campaign` fallback when fresh tagged traffic has not yet populated GA4 attribution dimensions
- revenue and spend sources configured inside GA4, such as HubSpot, Shopify, CSV, or Google Sheets imports, are GA4/campaign financial child inputs; users do not connect them from the campaign `Connected Platforms` section, and they feed financial totals only through the GA4/campaign financial path. Salesforce revenue code/docs are retained as deferred non-v1 behavior and are hidden from the v1 revenue-source chooser.
- Campaign DeepDive `Performance Summary` must consume GA4 and every other implemented main Connected Platform through the shared connected-source aggregate contract, not by special-casing GA4-only UI logic
- Campaign DeepDive must not require duplicate setup for GA4 child revenue/spend systems; those child inputs should affect only the relevant financial totals and should not appear as separate main Connected Platforms
- Campaign DeepDive `Platform Comparison` may show GA4 single-source aggregate financial totals in the Overview table when GA4 is the only main Connected Platform, but GA4 remains a web analytics source and should not be treated as a paid-media source for Cost Analysis or budget recommendations
- Campaign DeepDive `Trend Analysis` production-readiness is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`. The current page is one comprehensive Executive View. For a GA4-only campaign, current traffic totals are cumulative from the saved initial-import boundary through the latest completed reporting day; the `7/14/30/90-day` selector changes the exact comparison date and chart window, not those current totals.
- Campaign DeepDive `Executive Summary` production-readiness work is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`; GA4-only campaigns should show GA4-capable web analytics and outcome metrics, while paid-media metrics such as impressions, clicks, CTR, CPC, CPM, and paid-media recommendations remain unavailable unless a main paid-media platform supplies the required inputs.

## Doc Map

- `../PRODUCTION_READINESS.md`
  Root-level mandatory production-readiness checklist. Use it before GA4 section-specific readiness docs when auditing, refining, or certifying any GA4 section or future source template.
- `GA4/OVERVIEW.md`
  Covers the GA4 Overview tab, tables, card-population rules, and GA4 campaign scope.
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
  Concise canonical current-status index. Current section status: **PRODUCTION_READY** for certified runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`.
- `GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`
  Detailed Overview evidence ledger containing the preserved audit scope, inventories, end-to-end traces, blocker analyses, production-data findings, negative cases, and validation packets.
- `GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md`
  Chronological Overview Current Commit 0–24 and UI-validation ledger preserved from the pre-split canonical file.
- `GA4/KPIS.md`
  Covers KPI creation, display, current-value sourcing, gating, alerts, and KPI refresh behavior.
- `GA4/KPIS_PRODUCTION_READINESS.md`
  Canonical whole-tab KPIs production-readiness source of truth. Current status: **PRODUCTION_READY** for certified runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`.
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`
  KPI threshold/scoring policy template and historical slice record. Use it after `GA4/KPIS_PRODUCTION_READINESS.md` when refining KPI scoring for Meta, Google Ads, LinkedIn, Google Sheets, or another source; it is not whole-tab readiness proof by itself.
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`
  KPI/Benchmark alert, notification, email-audit, action URL, bell, and Notifications lifecycle template. Use it after the tab-specific readiness doc when refining KPI alert/notification behavior for another source; GA4 evidence is a template, not proof for the target source.
- `GA4/BENCHMARKS.md`
  Covers benchmark creation, custom benchmark values, status/progress, gating, alerts, and benchmark refresh behavior.
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
  Canonical whole-tab Benchmarks production-readiness source of truth. Current status: **PRODUCTION_READY** for locked certified runtime boundary `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`. Reports generation/delivery remains separately certified by the Reports record.
- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
  Canonical whole-tab Ad Comparison production-readiness source of truth.
  Current status: `PRODUCTION_READY` for certified runtime boundary `4be16c54`
  and the recorded dependency/configuration boundary. The live tab uses the
  saved initial-import boundary through the latest completed day. Reports-owned
  PDFs and all other Reports behavior are separate.
- `GA4/INSIGHTS.md`
  Short functional overview of the live GA4 Insights tab, including sections, scope contract, and refresh pattern.
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
  Canonical live-tab Insights production-readiness source of truth. Current status: **PRODUCTION_READY** for certified runtime boundary `4be16c54c550a45dbf3104313c820ea47b453604`. Reports-owned behavior remains separately certified by the Reports record.
- `GA4/REPORTS.md`
  Covers GA4 report creation, scheduling, downloads, report-library behavior, and current-state caveats. Current status: **PRODUCTION_READY** for certified runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e`. Campaign DeepDive is excluded.
- `GA4/REPORTS_PRODUCTION_READINESS.md`
  Canonical GA4 Reports-tab production-readiness source of truth. Current status: **PRODUCTION_READY** for certified runtime boundary `94f1096f3d08c1443f27a032bc5a44c8468c1a7e`. Campaign DeepDive is outside this boundary.
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
- `GA4/OVERVIEW_PRODUCTION_READINESS.md` states the current decision and active gates; its evidence and history companion ledgers preserve the detailed record
- `GA4/FINANCIAL_SOURCES.md` explains the underlying revenue/spend source system that feeds Overview and other GA4 tabs
- HubSpot-specific readiness is canonical in `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`; H10d is historical, and the three exact enabled source IDs are clean-certified inside the recorded Overview boundary.
- Shopify-specific readiness is canonical in `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`; the exact enabled source is clean-certified inside the recorded Overview boundary, while dormant OAuth, non-GA4 sources, and future stores remain excluded.

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
- live Overview Summary cards must use scheduler-backed persisted daily facts for the selected property and saved campaign filter from the fixed initial historical-import boundary through the latest completed day; the scheduler's rolling repair window must not become the Summary display boundary
- when GA4 exposes selected-campaign traffic through `pageLocation` `utm_campaign` but exposes conversions/native revenue through `campaignName`, the Overview import path supplements only missing `Conversions` and GA4-native `Revenue`; it must not overwrite sessions, users, pageviews, engagement, KPI/Benchmark math, imported revenue, spend, or alert behavior
- Campaign Breakdown remains independent table detail and must not replace or alter scheduler-backed Summary values
- Overview Summary cards should show a stable skeleton until the scheduler-backed daily response is available; later Campaign Breakdown loading cannot replace or change those values.
- GA4 Overview `Landing Pages` and `Conversion Events` use the same selected Overview date range as the nearby Summary/Campaign Breakdown/current performance sections, while preserving GA4 property selection and saved GA4 campaign scope
- GA4 Overview `Landing Pages` can supplement missing row conversions from conversion-prioritized same-scope `pageLocation` UTM rows only by exact landing-page/source/medium match, including when the base rows came from same-scope `pageLocation` traffic fallback because primary campaign attribution dimensions were empty; `Conversion Events` can supplement missing row conversions from conversion-prioritized same-scope `pageLocation` UTM rows only by exact event-name match; neither table may allocate campaign-level conversions or imported revenue into unmatched rows, and rows that already have conversions/revenue are not overwritten
- GA4 Overview `Landing Pages` and `Conversion Events` are live row-level GA4 Data API views for numeric property IDs, not reconstructions from scheduler-populated `ga4_daily_metrics`; zero row-level conversions are valid only when GA4 returns zero for the exact table grain
- GA4 Overview financial cards use one selected scoped GA4 financial source for native revenue and CPA conversions in fixed order: campaign-to-date provider totals, persisted daily totals where available to the caller, then configured-lookback breakdown only when earlier complete candidates are absent. Valid zero and negative values remain authoritative; selection is never based on maximum revenue. Browser, scheduled/server output, validation runner, and Benchmark comparison follow the same contract. Commit 13 proved provider-first selection even when persisted-daily revenue was one cent higher; the later exact-boundary reconciliation closed the included downstream and negative-state gates. Future source mixes and excluded fixtures remain outside the certification. `GA4/OVERVIEW_PRODUCTION_READINESS.md` is canonical.
- GA4 Overview `Campaign Breakdown` preserves raw selected-property 30-completed-day GA4 row metrics for Sessions, Users, Conversions, and GA4-native Revenue; it must not scale campaign rows to Summary card totals
- displayed Campaign Breakdown Revenue adds only exact campaign-matched source-to-date imported revenue, and the table subtitle must disclose that mixed window
- exact campaign-matched imported revenue can propagate into GA4 Overview
  `Campaign Breakdown` and Reports-owned output under their own contracts.
  The live GA4 `Ad Comparison` ranking, chart, summaries, and All Campaigns
  table deliberately remain native-only from the saved initial-import boundary
  through the latest completed day; imported revenue is source-to-date
  provenance in Revenue Breakdown and cannot create or adjust ranked rows
- HubSpot-specific report value propagation is guarded in Current Commit 4.12 by `GA4OverviewValidation.hubspotReportValuePack(...)` and static scheduled/server PDF formula checks; deployed evidence passed for the configured `GA4 Overview Report` packet and remains limited to that report/campaign/property
- the `Add revenue source` chooser shows saved-source status for v1 revenue source families: Shopify and HubSpot show connection/import status where applicable, Google Sheets shows `Connected` when an active Google Sheets revenue source exists for the current platform context, CSV shows `Uploaded` when an active CSV revenue source exists, and Salesforce revenue is hidden/deferred for v1
- CRM/ecommerce Crosswalk screens should not render a redundant `Selected Campaigns label` field; selected counts and selected value rows are the visible selection summary
- HubSpot and Salesforce `Review Settings` show the selected deal/opportunity labels together with the amount that will be imported for each selected record; HubSpot also shows the selected CRM value to saved platform-campaign mapping before save, hides the zero Pipeline Proxy summary in unchanged edit mode once the open-stage amount is known to be zero, and keeps confirmed `Total Revenue (to date)` as the sum of included confirmed records
- HubSpot and Shopify rows in the GA4 Overview `Revenue Sources` modal should show the saved mapped platform-campaign name under the source title when `campaignMappings` exist, falling back to the source type when no mapping is saved
- Shopify `Review Settings` revenue breakdown rows show campaign/value revenue amounts without appending order-count text such as `(1 order)`
- GA4 KPI creation uses a constrained unit dropdown, highlights `Create Custom KPI` when selected, keeps custom KPI current/target values in generic numeric format until a real unit is selected, disables `Create KPI` until `KPI Name` and `Target Value` are entered, and disables `Update KPI` in edit mode until at least one form value changes
- GA4 KPI whole-tab status is `PRODUCTION_READY` for certified runtime boundary `dc20c1e1c0a78c03a8f9c8d53af30b94c1a70cc1`.
- GA4 Benchmark creation follows the same custom-entry pattern: `Create Custom Benchmark` is highlighted when selected, shows `Choose name + unit, then set values`, uses a constrained unit dropdown, keeps custom current/benchmark values in generic numeric format until a real unit is selected, disables `Create Benchmark` until `Benchmark Name` and `Benchmark Value` are entered, and disables `Update Benchmark` in edit mode until at least one form value changes
- GA4 Benchmark whole-tab status is **PRODUCTION_READY** for locked certified runtime boundary `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`; deployed `19f05537` read-only parity is supporting evidence, not a reissued protected certification. Reports remains separately certified by the Reports record.
- GA4 `Ad Comparison` leader cards, chart, summary, and All Campaigns table use the same native initial-import-to-latest-completed-day campaign rows; source-to-date imported revenue remains separate provenance in Revenue Breakdown and cannot create or adjust ranked rows
- GA4 `Ad Comparison` uses explicit loading/ready/stale/unavailable states,
  blocks previous-property placeholders, and retains valid source zero. Its
  current machine status is `PRODUCTION_READY` for certified runtime boundary
  `4be16c54` and the recorded dependency/configuration boundary. All PDF,
  saved-report, snapshot, scheduler, delivery, and report-library behavior
  belongs to the Reports certification
- GA4 daily time-series/backfill uses the same selected-campaign import rule as Overview: query campaign attribution dimensions first, use `pageLocation` `utm_campaign` only when the primary daily result has no rows, and supplement missing conversion/revenue fields from a compatible selected-campaign `campaignName` query when GA4 splits traffic and purchase attribution across dimensions. Visible Trends rows remain completed-day rows and exclude today's intraday data.
- GA4 Insights Trends history gating is mode-specific: `Daily` needs 2 imported daily rows; `7d` needs two complete adjacent 7-calendar-day windows; `30d` needs two complete adjacent 30-calendar-day windows; and `Monthly` needs 2 calendar months. Scattered rows outside the required rolling windows do not satisfy 7d/30d coverage.
- GA4 reporting timezone is a campaign-level setting. `Create New Campaign` and `Edit Campaign` both expose a `Reporting Timezone` select, default new campaigns from the browser timezone when available, fall back to `UTC`, and save the selected IANA timezone through the campaign create/update payload. Dropdown labels remove underscores for readability while preserving exact saved values such as `America/New_York`.
- GA4 live/mock property boundary is part of the template contract: numeric GA4 property IDs must use live GA4 import/query paths, while only explicit `yesop` demo connections or request-level `?mock=1` may use deterministic simulation. Commit `4074d282` fixed the prior leakage where property `498536418` was treated as the Yesop simulator; user validation passed.
- GA4 Insights is `PRODUCTION_READY` for certified runtime boundary `4be16c54c550a45dbf3104313c820ea47b453604`. `GA4/INSIGHTS_PRODUCTION_READINESS.md` and `GA4/certifications/ga4-insights.json` are controlling.
- The Overview financial-source chooser is outside the Insights certification boundary and remains governed by `GA4/OVERVIEW.md` and `GA4/FINANCIAL_SOURCES.md`. Insights may consume only documented GA4-context totals; foreign platform contexts must not feed GA4 Insights totals.
- GA4 Insights Executive Financials source copy is conditional on actual connected sources: it must not claim imported revenue or source-backed spend unless those sources are present, and it should not append date-range copy because Trends owns freshness/date context
- GA4 Insights Trends uses `Completed-day cutoff` for the completed reporting-day boundary and `Latest imported day` for the latest actual persisted visible row; those can differ when GA4 returns no row for a completed day
- GA4 Insights `What to investigate next` is validated as grouped, evidence-aware, history-aware, non-causal executive guidance with explicit data basis, confidence, and `Recommended check:` wording

Live GA4 processing caveat:

- GA4 Measurement Protocol and GA4 reporting are asynchronous. Values can increase after a script run or live traffic event without rerunning the script because Google may finish processing already-sent events later and the app may refetch updated GA4 Data API values.
- Native GA4 `Conversions` depend on the property's configured key events. Validation scripts should avoid sending standalone events that the property may classify as key events unless the test is explicitly about conversion configuration.

Performance Summary GA4 validation should use the exact value paths documented in `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`. Key Outcomes consume current cumulative GA4 Summary values and campaign financial totals. Recent Movement compares Sessions and Conversions by deriving the cumulative value at the exact prior date from covered GA4 daily facts, Spend from a stable compatible snapshot on that exact date, and Total Revenue from same-source native/imported totals through that exact date. Missing, incompatible, or ambiguous historical inputs fail closed rather than reusing the current value as a verified comparison.

Performance Summary Campaign Health, Top Priority Action, and Recommended Actions use campaign-scoped GA4 KPI and Benchmark records whose current values are refreshed from the authoritative cumulative traffic or campaign-to-date financial inputs. Health is withheld when any configured metric is unverified. Top Priority ranks below-target KPIs by configured priority and then gap severity, with Benchmark fallback only when no eligible KPI lags. Recommendations identify verified target gaps and are guidance to investigate causes, not causal proof. When no connected-source metrics or no targets exist, the section shows the corresponding setup state instead of claiming all metrics are on track.

Budget & Financial Analysis GA4 financial behavior is tracked in `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` and `GA4/FINANCIAL_SOURCES.md`. GA4 child revenue/spend inputs can feed aggregate financial totals, but Budget Allocation and Financial Performance Insights should treat spend-capable main Connected Platforms as the source set for allocation and paid-media optimization guidance. Budget & Financial current values refetch through the same aggregate contract while visible and on window focus, and trend comparisons must use compatible aggregate snapshots rather than legacy top-level snapshot totals. Current GA4 financial aggregate values in `/outcome-totals.performanceSummary` should align with GA4 Overview selected scoped native GA4 financial totals plus imported revenue/spend provenance, while top-level date-range GA4 fields can remain windowed.

Platform Comparison GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`. GA4 should appear as the main Google Analytics source, not as separate child revenue/spend inputs. The Overview table can display aggregate Spend, ROAS, and ROI for a GA4-only campaign when the shared aggregate has those totals, while Cost Analysis and paid-media Insights remain unavailable until a main paid-media platform with source-level spend is connected.

Trend Analysis GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`. The visible Executive View combines the aggregate-backed performance chart, efficiency trends, cumulative website engagement/conversion summary, and contextual recommendations. GA4-only current Sessions, Users, Conversions, CVR, and Engagement Rate use the authoritative cumulative GA4 window. Revenue, Spend, ROAS, ROI, and CPA use the campaign financial contract. Exact-date historical inputs fail closed; the page never substitutes today's cumulative value for a missing historical value.

Executive Summary GA4 behavior is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`. Its current endpoint now includes the shared `performanceSummary` aggregate and should use aggregate availability to decide which Executive Overview metrics are shown. GA4-only Executive Summary validation should confirm Google Analytics appears as the main source, active GA4-context financial child sources can appear as `category: "financial"` provenance in `performanceSummary.sources`, and stale paid-media sources such as Meta/Facebook do not appear unless the main paid-media platform is connected. The Marketing Funnel Performance chart should make the GA4-only path explicit as users -> sessions -> conversions -> revenue, so executives can see whether the bottleneck is traffic reaching the site, sessions/engagement, conversion, or financial return.

For a newly connected mock-live GA4 campaign, Executive Summary can validate current connected-source metrics immediately, but 7-day snapshot trajectory should show `Not enough history` until compatible `performanceSummary` snapshots exist for both the latest point and the point roughly seven days earlier. This trajectory is independent of the removed Executive Summary date dropdown. This newly connected mock-live path is the best validation path for the no-history state because existing mock campaigns may already have seeded or legacy snapshot history. Risk Level is different from trajectory: it should populate immediately from current available connected-source inputs. Seven days is the default trajectory window because 1-2 day comparisons are too noisy for executive direction, while 30 days is slower than needed for an Executive Summary signal. Outstanding validation: connect a new mock-live GA4 campaign, confirm current GA4 metrics and Risk Level populate immediately, confirm `7-Day Snapshot Trajectory` initially shows `Not enough history`, and later confirm trajectory appears only after compatible `performanceSummary` snapshot history exists.

Executive Summary should not show Campaign Grade or Health Score in the UI. Those values may still exist in the backend response for API compatibility, but they are product-defined heuristics rather than direct GA4 or connected-source metrics. The narrative Executive Summary paragraph should also avoid hidden grade/score wording and should state factual available ROI/ROAS from the same `performanceSummary` aggregate used by the visible Executive Overview metrics, plus Risk Level and 7-day snapshot trajectory state. GA4 validation should focus on connected-source metrics, Marketing Funnel Performance, Risk Level, and 7-day snapshot trajectory state. The separate Campaign Story paragraph and duplicate Platform Performance card should not appear in Executive Summary; platform-level side-by-side detail belongs in Platform Comparison.

Executive Summary unavailable clicks and impressions should display executive-facing copy such as `Unavailable from connected sources`. Detailed aggregate unavailable reasons remain in the API for diagnostics, but the executive UI should not expose source-specific diagnostic wording in those compact metric cards.

Executive Summary shows the top Risk Level badge but no longer renders the former full Risk Assessment card. Risk Level uses the current ROI/ROAS, compatible seven-day trajectory, GA4 platform KPI/Benchmark exceptions, applicable freshness state, and paid-platform concentration when a paid source exists. Budget pacing remains in Budget & Financial Analysis.

Executive Summary refreshes its Executive Summary endpoint data and page-level outcome totals when the page mounts or the browser regains focus so its visible Risk Level, trajectory, funnel, exceptions, and recommendations stay aligned.

Executive Summary should not block the full subsection on the secondary outcome-totals request. It should render from `/executive-summary` once available, then use `/outcome-totals` to align page-level aggregate values when that response arrives or refetches.

Executive Summary should preserve the active tab through the URL hash. Refreshing while viewing Strategic Recommendations should reload Strategic Recommendations, not reset to Executive Overview.

Executive Summary Strategic Recommendations now use source-capability gating. For GA4-only campaigns, the tab may show web/outcome guidance from available GA4 users, sessions, conversions, revenue, or CVR, but it must not show paid-media budget reallocation, paid platform diversification, scaling, ROAS/ROI, CPA, CPC, CTR, or CPM claims unless a main paid-media platform supplies the required inputs. GA4-only web/outcome guidance should state live revenue, conversion, and CVR outcomes plainly, compare mapped KPI/Benchmark targets for CVR, revenue, and conversions when available, and give a next action without making paid-media claims.

In GA4-only Strategic Recommendations, Website Outcomes `Expected Impact` should render as bullet points for readability. `Timeframe` should communicate the review/action window, and `Investment Required` should clarify that the recommendation is analysis-only unless a paid-media source is connected.

Strategic Recommendations are executive-ready in the implemented GA4-only scope when they show factual web/outcome guidance from available GA4/current-source values, target context when mapped KPI/Benchmark records exist, a clear next action, assumptions, and no paid-media claims. Recommendation inputs update through the Executive Summary refetch path: the endpoint recomputes source eligibility and target context, and the UI renders Website Outcomes values from page-level `performanceSummary.totals` after mount, window-focus, or active-tab interval refetch.

When GA4 is combined with paid-media integrations such as Google Ads, Executive Summary must use the same aggregate source composition as `/outcome-totals`. Paid-media sources should enter Executive Summary through normalized `platformSources` and must be covered in `/executive-summary`, `/outcome-totals`, scheduler snapshots, source freshness, KPI/Benchmark mapping, risk inputs, and Strategic Recommendation eligibility before that source mix is treated as production-ready. Paid-media `attributedRevenue` counts as an aggregate revenue input for Executive Summary eligibility when the source has a validated attribution path. Google Ads local Connected Platforms refinement and attributed-revenue import evidence is tracked in `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` through Commit 29; live OAuth still needs deployed or production-like evidence before that path is considered production-ready. That is separate source work, not an Executive Summary implementation blocker.

Campaign DeepDive `Custom Report` production-readiness is tracked in `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`. Commit `41ec6015b4aae0090e834294a5355c06fbccaa34` retains the historical GA4-first lifecycle, isolation, artifact, scheduler, and delivery evidence. Later downloads disproved Performance Summary value parity, and the same downstream review found stale PDF-only contracts for Budget & Financial Analysis, Trend Analysis, and Executive Summary. The current local correction makes the shared direct/snapshot/scheduled renderer consume each subsection's existing UI inputs and single-page composition, with unavailable or incompatible data failing closed. Fresh deployed comparisons are still required before these changed PDF bodies are called production-ready. No protected GA4 calculation or certification record is changed. Google Ads, Meta, Instagram, and TikTok remain disabled/unconfigured and uncertified for this scope.

Campaign DeepDive opens `/reports?campaignId=<campaignId>`. In campaign context the page hides the standalone Standard Reports, Scheduled Reports, and All Reports tab/filter shell and displays only the active campaign's backend scheduled report cards. Unscheduled `Download Report` uses `POST /api/campaigns/:campaignId/custom-report-pdf` and creates no report-library or snapshot row. New campaign-scoped reports hide `Tabs to include`; choosing a report type automatically saves its single-page composition, while legacy saved keys normalize when read/rendered. Performance Summary, Budget & Financial Analysis, Trend Analysis, and Executive Summary each render one current UI-aligned body through the shared server renderer used by direct downloads, snapshots, and scheduled attachments. Scheduled create/edit persists recipients, schedule, browser time zone, report type, and composition through `/api/platforms/campaign_deepdive/reports`. Saved-report downloads create an immutable server PDF snapshot and download the exact stored artifact. The current Mailgun production path deduplicates scheduled work by report ID and scheduled key, fails closed for missing campaigns/recipients/artifacts or unconfirmed delivery, and updates snapshots and `lastSentAt` only after confirmed delivery. Historical production validation on 2026-08-28 proved the lifecycle, campaign/client/owner/platform isolation, artifact parity, provider `delivered` evidence, and user-confirmed inbox receipt for the then-deployed renderer; all changed PDF bodies still need fresh deployed comparison. Future source mixes require separate source-specific evidence. The standalone `/reports` route keeps its separate report-library behavior and is not represented as a sidebar Reports item.

Executive Summary status is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Executive Summary Status Map`. Completed aggregate future-proofing work is tracked under `Completed Executive Summary future-proofing checklist`. Google Ads platform-specific refinement is tracked separately from Executive Summary aggregate-readiness.

The Executive Summary future-platform acceptance gate is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Future Connected Platform acceptance gate`. This is a standing rule for future or refined main sources, not an open Executive Summary implementation task. A new or refined platform is not production-ready as an Executive Summary source until it passes the shared aggregate, `/outcome-totals`, `/executive-summary`, scheduler snapshot, KPI/Benchmark, Risk input, Strategic Recommendation, regression, and deployed-validation checks.

The Executive Summary deployed-validation checklist is tracked in `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` under `Deployed validation checklist and evidence log`. It is an acceptance evidence log for deployed source mixes, not a separate implementation task. Scenario evidence should remain incomplete until GA4-only, GA4 plus refined Google Ads, and GA4 plus multiple-paid-source campaign variants are validated in a deployed or production-like environment.

Executive Summary and `/outcome-totals` should enter the shared aggregate contract through the same route-level aggregate wrapper so future refined main platform sources use one source-composition path before being passed to `buildPerformanceSummaryAggregate`.

Scheduler snapshots that feed Executive Summary `7-Day Snapshot Trajectory` must include the same normalized main source set in `metrics.performanceSummary`. For the current future-proofing slice, Google Ads rows are passed into scheduler snapshot `performanceSummary` as a normalized `platformSources` source; future platforms need the same scheduler wiring before they are production-ready in Executive Summary.

GA4-only Strategic Recommendations regression coverage should guard four cases: web/outcome guidance with targets, web/outcome guidance without targets, paid-media guidance remaining blocked, and insufficient GA4/web inputs producing no recommendation instead of zero-filled claims.

Executive Summary KPI Progress should be fed by campaign-level KPI records whose current value can be mapped to available GA4/connected-source aggregate metrics. Campaign-level KPI create, update, and delete actions should refresh the campaign Executive Summary query so KPI Progress reflects the latest KPI list and targets. Targets come from campaign-level KPI records, but current values, progress percentages, and statuses should render from live GA4/connected-source aggregate values for metrics such as users, sessions, conversions, revenue, ROI, ROAS, CTR, or CVR. Executive Summary must not silently fall back to saved KPI progress/current values when a KPI cannot be mapped to an available aggregate metric.

Executive Summary Benchmark Comparison should follow the same source-of-truth rule. Campaign-level Benchmark records define the rows and benchmark targets, and campaign-level Benchmark create, update, and delete actions should refresh the campaign Executive Summary query. `Yours` current values should come from live GA4/connected-source aggregate metrics when mapped and available. Executive Summary must not silently fall back to saved Benchmark `currentValue` snapshots for unmapped or unavailable current values.

Trend Analysis Executive Recommendations are contextual decision guidance derived from the available trend, efficiency, and conversion signals in the same comprehensive view. They do not use Google Trends keyword widgets and must not present cumulative growth as like-for-like period performance.

Trend Analysis scheduler snapshots now store `metrics.trendAnalysis` using the same `trend_analysis_aggregate_v1` contract. Manual snapshots, platform-sync snapshots, and automatic scheduler snapshots should therefore carry compatible Trend Analysis history while legacy snapshots without `metrics.trendAnalysis` remain incompatible and should not be used for aggregate trend comparisons.

The exact deployed GA4-only Trend boundary validated on `2026-08-26` is commit `cd35bba1c4ff4bb0b045c3bc6c176f2847cd80eb`. Authenticated read-only parity covered all `7/14/30/90-day` options, the visible Executive View sections, persisted GA4 source rows, exact-date missing-data behavior, and the canonical Trend report consumer. The audited window was `2026-07-02` through `2026-08-25` in `Europe/Amsterdam`. This is Campaign DeepDive evidence only; it does not modify or broaden the protected GA4 Overview, KPI, Benchmark, Ad Comparison, Insights, or Reports certification records.

Trend report composition exposes one saved section, `trend-analysis:overview` labelled `Executive View`. Legacy saved Trend section keys are normalized to that one section so browser and scheduled PDFs cannot repeat the retired tab content. GA4-only report rows are clamped to the saved initial-import boundary and latest completed reporting day, then filtered by exact calendar dates; sparse row count is never used as a substitute for a date window.

## Reference Rule

For future development:

- reference `GA4/README.md` in high-level docs
- reference the tab-specific file when work is scoped to one tab
- reference `GA4/FINANCIAL_SOURCES.md` for any spend/revenue work, even if the visible bug is elsewhere
