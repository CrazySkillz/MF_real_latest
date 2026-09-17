# Application Production-Readiness Ledger

## Controlling App Status

<!-- app-certification-status: NOT_CERTIFIED -->

**The complete application is not yet app-certified. Existing section and source
certificates listed below remain valid inside their recorded boundaries.** This
ledger is a reconciliation layer; it does not revoke, broaden, or replace those
certificates.

Ledger baseline: committed `main` at `de16a8e5` on 2026-09-12.

The HubSpot certificate is committed at `de16a8e5`. Concurrent uncommitted
Google Sheets files are preserved but are not promoted into the durable ledger
status until their own work is committed and certified.

## Purpose

This is the single app-wide index for production-readiness status. It prevents
completed certification work from being repeated and prevents historical or
broad summary documents from overriding a newer section-specific decision.

This file is not a substitute for the evidence in each linked certificate.
`AGENTS.md`, `ARCHITECTURE_USER_JOURNEY.md`, and `PRODUCTION_READINESS.md` remain
the governing standards.

## Current Fresh Certification Program

The application will now be certified through one new current-release program.
Earlier certificates remain preserved as supporting or historical evidence, but
they do not automatically pass a section into this new program. No earlier
certificate or evidence block will be deleted or rewritten.

The supported ownership model to prove in every section is: one authenticated
user may own multiple clients, and each client may contain multiple campaigns.
Every section must isolate owners, clients, campaigns, connected accounts, and
saved source configuration.

### Phase 1 - GA4 platform section

| Order | Section | Program state |
| ---: | --- | --- |
| 1 | Overview | `IN_PROGRESS` |
| 2 | KPIs | `COMPLETE` |
| 3 | Benchmarks | `COMPLETE` |
| 4 | Ad Comparison | `COMPLETE` |
| 5 | Insights | `IN_PROGRESS` |
| 6 | Reports | `QUEUED` |

#### GA4 Overview certification breakdown

Overview remains `UNVERIFIED` until every category below passes independently.
Historical evidence remains available to accelerate a fresh check, but does not
silently advance a row to `CERTIFIED`. Work state and certification status are
separate: `IN_PROGRESS` never means production-ready.

| Order | Overview section or subsection | Work state | Certification status | Current evidence disposition |
| ---: | --- | --- | --- | --- |
| - | Overview (whole tab) | `IN_PROGRESS` | `UNVERIFIED` | Every enabled subsection and combined Overview gate must pass. |
| 1 | Summary | `QUEUED` | `UNVERIFIED` | Requires a fresh current-runtime certification. |
| - | Revenue & Financials (parent section) | `IN_PROGRESS` | `UNVERIFIED` | Revenue, Spend, Performance, combined totals, and provenance must all pass. |
| 2 | Revenue & Financials - Revenue | `COMPLETE` | `CERTIFIED` | Clean-certified for the exact combined GA4 Overview Revenue boundary at deployed application commit `8a4b463b`; controlling certificate: `GA4/OVERVIEW_REVENUE_SECTION_PRODUCTION_READINESS.md`; required steps remaining: 0. |
| 3 | Revenue & Financials - Spend | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the documented Google Sheets and CSV Spend boundary at deployed runtime `002a7caa`; evidence commit `8d3da627`; required steps remaining: 0. Google Ads is not configured and remains excluded. |
| - | Revenue & Financials - Performance (`Profit`, `ROAS`, `ROI`, `CPA`) | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact four-card Performance boundary at deployed runtime `0c49cc6a`; controlling certificate: `GA4/OVERVIEW_PERFORMANCE_CERTIFICATION_2026-09-14.md`; evidence commit `93a69edc`; required steps remaining: 0. Google Ads remains excluded. |
| 4 | Campaign Breakdown | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented Campaign Breakdown boundary at current deployed commit `9b2a090d9b3673a94dae7891b3e355e3bc269b4f`; controlling certificate: `GA4/OVERVIEW_CAMPAIGN_BREAKDOWN_CERTIFICATION_2026-09-14.md`; required steps remaining: 0. |
| 5 | Landing Pages | `QUEUED` | `UNVERIFIED` | Requires a fresh current-runtime certification. |
| 6 | Conversion Events | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented campaign, property, date, provider-to-API-to-UI-to-PDF, refresh, failure, pagination, and ownership boundary at application runtime `176d02ef00a65091917136f1ed2bd8c7cc817fcb`; controlling certificate: `GA4/OVERVIEW_CONVERSION_EVENTS_CERTIFICATION_2026-09-15.md`; latest documentation commit: `9ec5ba5d6c2153c90b02b004f6068cb3488cd5d3`; required steps remaining: 0. The user-accepted `48 / 48 / 48` display is UI smoke evidence only; independent Google Analytics reconciliation remains deferred. |

Revenue source families:

| Source | Work state | Certification status | Required disposition |
| --- | --- | --- | --- |
| HubSpot, including Pipeline Proxy | `COMPLETE` | `CERTIFIED` | Production-ready, clean-certified, and no-overclaiming for only the exact runtime, active sources, exercised configurations, and exclusions in the controlling HubSpot certificate. |
| Shopify | `COMPLETE` | `CERTIFIED` | Clean-certified for the exact documented GA4 Overview, USD, OAuth `read_orders`, recent-order-window scope at deployed application commit `ea516f3a`; evidence commit `bc46d0a4`; OAuth renewal and timer-fired scheduled refresh are proven; required steps remaining: 0. |
| Salesforce, including Pipeline Proxy | `COMPLETE` | `CERTIFIED` | Clean-certified for the exact documented GA4 source, configuration, and exercised lifecycle at deployed application commit `d4f1ec0e`; evidence commit `6fa4bff2`; required steps remaining: 0. |
| Google Sheets | `COMPLETE` | `CERTIFIED` | Clean-certified and production-ready for the documented deployed single-runtime V1 scope in `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`; required V1 steps remaining: 0. |
| Upload CSV | `COMPLETE` | `CERTIFIED` | Clean-certified for the documented GA4 CSV Revenue scope on deployed application commit `b2fd97a9`; evidence commit `4476e807`; manual source-refresh scheduler behavior is inapplicable; required steps remaining: 0. |

Spend source families:

| Source | Work state | Certification status | Required disposition |
| --- | --- | --- | --- |
| Google Sheets | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented GA4 Overview Spend boundary at deployed runtime `002a7caa`; evidence commit `8d3da627`; required steps remaining: 0. |
| Upload CSV | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented GA4 Overview Spend boundary at deployed runtime `002a7caa`; evidence commit `8d3da627`; required steps remaining: 0. |
| Google Ads | `NOT_CONFIGURED` | `EXCLUDED` | Not configured and outside this certification boundary; no Google Ads readiness claim is made. |

The Performance gate includes zero, unavailable, stale/last-good, currency, and
downstream states. Source-family passes alone cannot certify the full Revenue &
Financials parent section.

For every revenue or spend source family, use the same fixed lifecycle order:
add/save, edit/update, delete/deactivate, refresh/scheduler (or documented manual
snapshot behavior), source-modal display, totals/recompute, damaged-data inventory,
and downstream propagation. A source moves to `CERTIFIED` only after every
applicable lifecycle path and external gate is recorded in its controlling
certificate.

#### GA4 Ad Comparison certification breakdown

Both retained subsections below retain their separate documented certificates.
Their combined live page and the removal of All Campaigns were verified at
deployed runtime `70b73a229ebb9e1021c3d18d63119d05bdee7e26`; the whole
live-tab certificate applies only to its exact Campaign2/property/saved-filter
boundary. Reports delivery remains excluded.
Existing GA4 Overview, KPI, Benchmark, and source certifications remain read-only
dependencies and are not reopened by this work.

| Order | Ad Comparison subsection | Work state | Certification status | Required validation boundary |
| ---: | --- | --- | --- | --- |
| - | Ad Comparison (whole section) | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` only for the retained live tab at deployed runtime `70b73a229ebb9e1021c3d18d63119d05bdee7e26`, Campaign2/property/saved-filter/USD; both retained subsections and All Campaigns removal passed together. Controlling certificate: `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`. Reports delivery and other configurations are excluded; required steps remaining for this boundary: 0. |
| 1 | Ad Comparison (chart and summary) | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` only for the documented Campaign2/property/saved-campaign boundary at deployed runtime `3013ec6b52a93eaca01cd14c538dd0a20f350fac`: metric dropdown, chart, three ranking cards, two summary cards, and matching PDF values. Controlling certificate: `GA4/AD_COMPARISON_CHART_CERTIFICATION_2026-09-16.md`. All Campaigns, Revenue Breakdown, and Reports delivery remain excluded. |
| 2 | Revenue Breakdown | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` only for the exact documented Campaign2/property/source boundary at runtime `dd9cd51ea755e896838c78be8cab020fc0249eba`; controlling certificate: `GA4/AD_COMPARISON_REVENUE_BREAKDOWN_CERTIFICATION_2026-09-16.md`. Native comparison-window revenue and imported source-to-date amounts remain separate; no cross-window Total Revenue or report-delivery claim. |

#### GA4 Insights fresh subsection validation

The existing whole-live-tab Insights certificate at `4be16c54c550a45dbf3104313c820ea47b453604` remains preserved at its exact documented boundary. The rows below track a new, separate subsection-by-subsection pass; `UNVERIFIED` rows have not passed that fresh check, and a subsection pass does not certify the current whole tab. Treat GA4 Overview, KPIs, Benchmarks, and financial-source certificates as read-only dependencies. Do not modify protected certified behavior or evidence without explicit approval. Reports and delivery remain outside this Insights pass.

| Order | Insights subsection | Work state | Fresh certification status | Required validation boundary |
| ---: | --- | --- | --- | --- |
| - | Insights (fresh combined-page pass) | `QUEUED` | `UNVERIFIED` | After all four rows pass, reconcile shared inputs, header/freshness states, cross-section consistency, ownership, refresh/failure behavior, and the complete live page at one exact deployed runtime. Preserve the earlier bounded whole-tab certificate. |
| 1 | Executive Financials | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` only for Spend, Revenue, Profit, ROAS, ROI, and “Sources used” within the exact campaign/property/USD/source and value-state boundary in `GA4/INSIGHTS_EXECUTIVE_FINANCIALS_CERTIFICATION_2026-09-17.md`; validated application runtime `f4fe2f3e3b47a3b350dd14c8a8d336bc8ff946ca`, corrected documentation commit `74b778e33d9bf2758b5a681c90424b781f414b3e`. GA4 Overview financial values are read-only inputs; the whole Insights tab, its other subsections, upstream source lifecycles, and other configurations are not certified by this row. Required steps remaining for this bounded consumer result: 0. |
| 2 | Trends | `QUEUED` | `UNVERIFIED` | Daily, 7d, 30d, and Monthly values and charts; completed-day/timezone cutoff, sparse history, weighted rates, comparison eligibility, freshness, and scheduler-fed daily inputs. |
| 3 | Data Summary | `QUEUED` | `UNVERIFIED` | Sessions, conversions, Top Channel, channel table/share/rate, exact date/source/medium matching, incomplete attribution, valid zero, and withheld or stale states. |
| 4 | What to investigate next | `QUEUED` | `UNVERIFIED` | All finding categories, order, severity, basis/confidence, recommendations, deduplication and withholding; include the three finding-count tracker cards and KPI/Benchmark input boundaries. |

Each GA4 section must independently pass the complete no-overclaim standard at
an exact current runtime: visible/downstream value inventory, provider/query and
post-fetch transforms, scope and ownership, date/timezone rules, formulas,
fallback and negative cases, add/edit/delete/refresh lifecycle where applicable,
scheduler and concurrency behavior, last-good-data behavior, damaged-data
inventory where applicable, downstream propagation, focused regressions,
TypeScript, production build, and required deployed/provider validation.

After each pass:

1. add a new authoritative current-status block to that section's certificate;
2. preserve all older certificate material as history;
3. record the exact certified runtime, configuration, evidence, and exclusions;
4. update only that section's row in this ledger;
5. commit the section certificate separately before starting the next section.

After all six sections pass, create one GA4 roll-up certificate from those six
current certificates. There is no separate up-front status-reconciliation task;
the fresh section certificates supersede stale summaries as the program advances.

### Phase 2 - campaign-level dependencies

Freshly certify campaign-level KPIs and Benchmarks after the GA4 section passes.
This must prove the current connected-platform inputs, CRUD, refresh/recompute,
alerts, notifications, owner/client/campaign isolation, and downstream consumers.

### Phase 3 - Campaign DeepDive

Certify in dependency order:

1. Performance Summary
2. Budget & Financial Analysis
3. Platform Comparison if it remains visible; otherwise hide it and mark it
   `EXCLUDED` before app certification
4. Trend Analysis
5. Executive Summary
6. Custom Reports

Each DeepDive certificate must consume the newly certified GA4 and campaign-level
inputs without independently changing or reinterpreting those upstream values.

## Authority Order

When documents disagree, use this order:

1. A section/source-specific machine record and its matching current-status block.
2. The section/source-specific production-readiness document.
3. A platform or Campaign DeepDive status tracker.
4. Broad roll-ups, historical evidence, implementation plans, and old completion notes.

Conflicting status is recorded as `RECONCILE`; it must not be guessed upward to
`CERTIFIED`. Reconciliation updates documentation only unless a current
certificate identifies a real code or evidence gap.

## Status Vocabulary

| Status | Meaning |
| --- | --- |
| `COMPLETE` | The work packet is complete; certification still depends on the separate certification-status column. |
| `NEXT` | The next program unit to begin; it is not certified. |
| `IN_PROGRESS` | Validation or fixes are underway; the unit is not certified. |
| `QUEUED` | The fresh certification has not started or has not yet been accepted. |
| `CERTIFIED` | Production-ready, clean-certified, and no-overclaiming for only the exact runtime and scope recorded by the controlling certificate. |
| `RELEASE_CANDIDATE` | Local and bounded deployed evidence exists, but a named production/provider gate remains. |
| `LOCAL_ONLY` | The implemented local/test path is called ready, but its live provider path is not certified. |
| `UNVERIFIED` | The controlling current document or machine record explicitly withholds certification. |
| `RECONCILE` | Evidence exists, but current documents conflict or do not state one explicit controlling result. |
| `NO_CERTIFICATE` | Implementation or targeted evidence may exist, but no complete section certificate exists. |
| `NOT_IMPLEMENTED` | The tracker states that the first-class product section is not implemented. |
| `EXCLUDED` | Intentionally outside the supported release and hidden or disabled in the shipped product. |

`NO_CERTIFICATE`, `RECONCILE`, and `UNVERIFIED` do not mean that a feature is
known broken. They mean the app-wide production-ready claim is not yet proven.

## GA4 Section Ledger

| Section | Durable status | Controlling authority | Exact boundary or open gate |
| --- | --- | --- | --- |
| GA4 Overview | `UNVERIFIED` | `GA4/certifications/ga4-overview.json`; `GA4/OVERVIEW_PRODUCTION_READINESS.md` | Current machine record is fail-closed; separately certified source components do not certify the whole tab. |
| GA4 KPIs | `CERTIFIED` | `GA4/OVERVIEW_KPIs_CERTIFICATION_2026-09-15.md` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented KPI boundary at deployed runtime `f7afeb2b`; documentation commit `47180dcf`; required steps remaining: 0. GA4 Overview remains a read-only upstream dependency and is not recertified by this entry. |
| GA4 Benchmarks | `CERTIFIED` | `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md`; `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`; `GA4/BENCHMARKS_PRODUCTION_READINESS.md` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact documented Benchmark boundary at application runtime `47180dcf96586fa4fff9a83e7a097e33e42c0721`; deployed evidence commit `bdecb67142bdbe505084d397f195e252db40a4f8` changed Benchmark documentation only. The earlier `236afff9` runtime and `a96ba06e` machine record remain historical. GA4 Overview and KPIs are not recertified by this entry. |
| GA4 Ad Comparison | `CERTIFIED` | `GA4/certifications/ga4-ad-comparison.json`; `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`; `GA4/AD_COMPARISON_CHART_CERTIFICATION_2026-09-16.md`; `GA4/AD_COMPARISON_REVENUE_BREAKDOWN_CERTIFICATION_2026-09-16.md` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact Campaign2/property/saved-filter/USD retained live-tab boundary at deployed runtime `70b73a229ebb9e1021c3d18d63119d05bdee7e26`; chart/cards/summary and Revenue Breakdown passed together, All Campaigns absent. Reports delivery and other configurations excluded; required steps remaining: 0. |
| GA4 Insights | `CERTIFIED` | `GA4/certifications/ga4-insights.json`; `GA4/INSIGHTS_PRODUCTION_READINESS.md` | Historical bounded whole-live-tab certificate for exact runtime `4be16c54c550a45dbf3104313c820ea47b453604` is preserved, not renewed for `f4fe2f3e`; Executive Financials alone has a fresh subsection certificate above. The current combined Insights page remains unverified. |
| GA4 Reports | `UNVERIFIED` | `GA4/certifications/ga4-reports.json`; `GA4/REPORTS_PRODUCTION_READINESS.md` | Exact-current scheduled/server Campaign Breakdown artifact parity remains pending. |
| GA4 reporting timezone | `RECONCILE` | `GA4/REPORTING_TIMEZONE_PRODUCTION_READINESS.md` | Individual validation commits are recorded, but the document has no single current whole-path certificate. |
| GA4 KPI/Benchmark alerts and notifications | `RECONCILE` | `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md` | Lifecycle evidence exists, but its broad KPI status conflicts with the newer KPI machine record. |
| Whole GA4 roll-up | `RECONCILE` | Section rows above override `GA4_PRODUCTION_READY_TRACKER.md` and `GA4_PRODUCTION_READINESS_OUTSTANDING.md` | The broad tracker says all tabs are production-ready while four current machine records say `UNVERIFIED`. |

Threshold documents are supporting evidence, not whole-tab authorities:

- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md`

## GA4 Financial Source Ledger

| Source family | Durable status | Controlling authority | Exact boundary or open gate |
| --- | --- | --- | --- |
| GA4 Overview Revenue subsection | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_SECTION_PRODUCTION_READINESS.md` | Exact combined Revenue boundary at deployed application commit `8a4b463b`; all five source certificates are preserved without broadening; required steps remaining: 0. |
| HubSpot Revenue and Pipeline Proxy | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md` | Five exact active GA4 sources and exercised configurations at deployed runtime `490c8ae685821389d1f433a5943f856478f52e5c`; this evidence set is not a five-source product limit. |
| Shopify Revenue | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md` | Deployed application commit `ea516f3a`; evidence commit `bc46d0a4`; clean-certified for the exact documented GA4 Overview, USD, OAuth `read_orders`, recent-order-window scope; OAuth renewal and timer-fired scheduled refresh are proven; required steps remaining: 0. |
| Upload CSV Revenue | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_CSV_PRODUCTION_READINESS.md` | Deployed application commit `b2fd97a9`; evidence commit `4476e807`; clean-certified for the documented GA4 scope with source-refresh scheduling inapplicable and required steps remaining: 0. |
| Google Sheets Revenue | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` | Documentation commit `f4a648a8`; deployed runtime `f8061d135a85fbe2c4c11433fffb3f80dedceae8`; clean-certified for the documented single-runtime V1 scope with required steps remaining: 0. |
| Salesforce Revenue and Pipeline Proxy | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_SALESFORCE_PRODUCTION_READINESS.md` | Deployed application commit `d4f1ec0e`; evidence commit `6fa4bff2`; clean-certified for the exact documented GA4 source, configuration, and exercised lifecycle with required steps remaining: 0. Other Salesforce configurations, organisations, currencies, fields, non-GA4 contexts, and global scheduler health remain excluded. |
| GA4 Google Sheets/CSV Spend family | `CERTIFIED` | `GA4/OVERVIEW_SPEND_POST_DEPLOYMENT_RECERTIFICATION_2026-09-14.md` | Evidence commit `8d3da627834184b5e751caef2e00240db157c1ab`; `CLEAN-CERTIFIED / PRODUCTION_READY` for Google Sheets and CSV Spend at validated deployed runtime `002a7caae7cc01b5a815799f8ddc05a2f9e0fe86`; required steps remaining: 0. Google Ads is `NOT CONFIGURED / EXCLUDED`. |
| GA4 Overview Performance subsection | `CERTIFIED` | `GA4/OVERVIEW_PERFORMANCE_CERTIFICATION_2026-09-14.md` | Evidence commit `93a69edc`; `CLEAN-CERTIFIED / PRODUCTION_READY` for the exact Profit, ROAS, ROI, and CPA boundary at deployed runtime `0c49cc6a217457c8ab33f21b7dcc348127cee5ab`; required steps remaining: 0. Summary and Google Ads remain excluded. |
| Whole GA4 financial model | `UNVERIFIED` | `GA4/OVERVIEW_PRODUCTION_READINESS.md` | Component certificates remain preserved, but whole-Overview status controls the combined visible financial surface. |

## Campaign DeepDive Ledger

| Subsection | Durable status | Controlling authority | Exact boundary or open gate |
| --- | --- | --- | --- |
| Performance Summary | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md` | Exact runtime `12789c1ebb92dd6a905a9f2f0f877f0bc6a90627`, recorded GA4-only configuration. |
| Budget & Financial Analysis | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` | Exact GA4-first runtime `19f055372abe8aee789dd4205eba5decef5f39a5`. |
| Platform Comparison | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md` | Current aggregate-backed implementation and Render-validated GA4-only scenario. |
| Trend Analysis | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md` | Exact deployed GA4-only runtime `cd35bba1c4ff4bb0b045c3bc6c176f2847cd80eb`. |
| Executive Summary | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` | Exact GA4-first deployed runtime `ec1305b92e5eba439ce74685ea2d06ecd3fabd50`. |
| Custom Report | `RELEASE_CANDIDATE` | `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md` | Current status requires deployment validation for changed Performance Summary PDF composition. |
| Whole Campaign DeepDive | `RECONCILE` | `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md` plus subsection authorities | The top-level file explicitly says it is not a whole-section certificate and contains a stale Custom Report summary. |

## Connected Platform Ledger

| Platform/source | Durable status | Controlling authority | Exact boundary or open gate |
| --- | --- | --- | --- |
| LinkedIn | `CERTIFIED` | `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Current supported mock-live/test-data scope; live-provider claims must remain within the recorded evidence. |
| LinkedIn Revenue Import | `CERTIFIED` | `LINKEDIN_REVENUE_IMPORT_PRODUCTION_READY.md` | Current supported implementation scope recorded after Commit 7. |
| Google Ads | `LOCAL_ONLY` | `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Implemented source-backed test-mode path is locally ready; live OAuth connect/select/refresh is not certified. |
| Meta/Facebook | `LOCAL_ONLY` | `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Implemented test-mode path is locally ready; live OAuth, scheduler, placement-action, and deployed report gates remain. |
| Instagram | `UNVERIFIED` | `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Tracker explicitly says final production readiness is pending and live OAuth connect UI remains incomplete. |
| TikTok | `NOT_IMPLEMENTED` | `TIKTOK_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Tracker says no first-class TikTok connected platform exists. It must be completed or excluded from the supported release. |
| Google Sheets Connected Platform | `UNVERIFIED` | `GOOGLE_SHEETS_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Extensive implementation evidence exists, but the tracker withholds final readiness pending live provider gates. |
| Custom Integration | `CERTIFIED` | `CUSTOM_INTEGRATION_CONNECTED_PLATFORM_PRODUCTION_READY.md` | Validated manual upload plus Mailgun inbound scope; optional SendGrid and historical production cleanup remain outside the certificate. |

## Campaign And Global Product Ledger

| Product surface | Durable status | Existing evidence | Required closure |
| --- | --- | --- | --- |
| Authentication and owner isolation | `NO_CERTIFICATE` | Architecture contract, route guards, source-specific ownership tests | One app-wide authentication/owner/client/campaign access certificate. |
| Home and client lifecycle | `NO_CERTIFICATE` | `ARCHITECTURE_USER_JOURNEY.md`; targeted destructive audit | Certify create/select/delete, owner isolation, transactional cascade, and empty/error states. |
| Campaign create/manage lifecycle | `NO_CERTIFICATE` | Architecture contract and platform-specific flow tests | Certify create/edit/delete, draft/finalization, source attachment, owner/client scope, and damaged-data boundary. |
| Campaign Overview and Connected Platforms | `NO_CERTIFICATE` | Platform-specific trackers and Campaign DeepDive launchers | One whole-surface inventory covering source cards, statuses, navigation, refresh, and unavailable states. |
| Campaign-level KPIs and Benchmarks | `RECONCILE` | `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md` records completed tasks and validation | Add one explicit current status/runtime boundary; do not repeat completed implementation work. |
| Notifications page and bell | `NO_CERTIFICATE` | Targeted visibility audit and alert/notification regression evidence | One whole-surface certificate covering list, filters, links, dismiss/recreate, ownership, email status, and source changes. |
| Global Dashboard | `UNVERIFIED` | Architecture says the Dashboard still needs refinement | Complete value inventory, scope, formulas, lifecycle, and downstream trace. |
| Global Reports route/library | `UNVERIFIED` | GA4 Reports and Campaign DeepDive Custom Report have separate records | Certify the visible route as a composition of only its supported report families. |
| Audiences | `NO_CERTIFICATE` | Visible application route; no readiness document found | Decide supported release scope, then certify or explicitly exclude. |
| Freestyle Chat | `UNVERIFIED` | Architecture describes it as still in progress | Complete and certify, or hide and mark `EXCLUDED` for this release. |
| Global scheduler health | `UNVERIFIED` | Several exact target jobs are certified; current evidence repeatedly excludes obsolete/test failures | Define active production job inventory and pass one global healthy-cycle gate without treating excluded jobs as success. |
| App-wide destructive/visibility behavior | `RECONCILE` | `TARGETED_DESTRUCTIVE_VISIBILITY_AUDIT.md` contains broad targeted evidence | Convert completed evidence into an explicit exact-runtime certificate and preserve unresolved rows. |

## Known Status Conflicts Superseded By The Fresh Program

1. `GA4_PRODUCTION_READY_TRACKER.md` says the complete GA4 section is
   production-ready, while current GA4 Overview and Reports machine records
   say `UNVERIFIED` and the KPI/Ad Comparison records have narrower boundaries.
2. Historical whole-Overview conclusions in revenue, spend, and outstanding
   trackers conflict with the current Overview machine record.
3. The GA4 alert/notification tracker repeats an older KPI whole-tab certificate,
   while the current KPI machine record is fail-closed as `UNVERIFIED`.
4. `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md` lists Custom Report as
   production-ready, while its current source-specific document requires deployed
   validation.
5. The broad GA4 tracker preserves an older Shopify clean certificate, while the
   current Shopify source document is only release-candidate ready.
6. The Google Sheets Connected Platform tracker contains extensive later
   completion evidence but still begins with a status withholding production
   readiness. Its final result must be reconciled only after its current external
   gates close.

These conflicts remain visible for audit history. They are not a separate work
phase. Each fresh section certificate will supersede the stale summary for that
section, and the final GA4 roll-up will replace the conflicting broad conclusion.

## Durable No-Repeat Rule

A `CERTIFIED` row carries forward when all are true:

- its controlling certificate contains the required value, lifecycle, failure,
  ownership, downstream, test, and deployed/provider evidence for its scope;
- no code file or shared dependency named by that certificate changed;
- its provider/configuration boundary did not change;
- no failed validation, contradictory evidence, new bug, or requirement change
  affects it.

A calendar change, unrelated commit, documentation-only commit, or certification
of another section does not invalidate it.

When a relevant file changes:

1. Diff the certified runtime against the candidate.
2. Map changed files to the ledger rows that consume them.
3. Reopen only those rows and their proven downstream dependants.
4. Run only the affected certificate matrix plus the standard TypeScript/build gate.
5. Append a new current-status amendment; retain historical evidence unchanged.

When a bug is found, reopen the exact affected value/lifecycle path and dependent
consumers. Do not revoke unrelated sections.

## Efficient Completion Order

1. **Freshly certify GA4:** Overview, KPIs, Benchmarks, Ad Comparison, Insights,
   and Reports, one section and one certificate at a time.
2. **Create the GA4 roll-up:** only after all six new section certificates pass.
3. **Freshly certify campaign-level KPIs and Benchmarks:** use the certified GA4
   values and prove lifecycle, alerts, ownership, and downstream propagation.
4. **Freshly certify Campaign DeepDive:** Performance Summary, Budget & Financial
   Analysis, visible Platform Comparison, Trend Analysis, Executive Summary, and
   Custom Reports.
5. **Certify remaining enabled app surfaces and sources:** work only on ledger
   rows that are not already accepted into the new program; hide and mark
   unsupported features `EXCLUDED` rather than certifying unfinished behavior.
6. **Issue the app certificate:** on one exact deployed release SHA, run the
   integrated owner -> client -> campaign -> source -> analysis -> action journey,
   app-wide ownership/isolation matrix, production data inventories, active
   scheduler cycle, focused certificate guards, TypeScript, production build,
   and supported provider smoke tests.

## App Certification Exit Gate

The app can be marked `CERTIFIED` only when:

- every visible and enabled row is `CERTIFIED` for the release boundary;
- every intentionally unsupported row is hidden/disabled and marked `EXCLUDED`;
- no `UNVERIFIED`, `RECONCILE`, `NO_CERTIFICATE`, `LOCAL_ONLY`,
  `RELEASE_CANDIDATE`, or `NOT_IMPLEMENTED` row remains in the supported scope;
- all carried-forward certificates pass dependency-impact review against the
  release SHA;
- one deployed end-to-end owner -> client -> campaign -> source -> analysis ->
  action journey passes without cross-owner leakage or analytics drift;
- the active production scheduler inventory completes with accurate health;
- certification documentation and machine guards agree.

## Existing Certificate Register

The following records are preserved and indexed by this ledger:

- `PRODUCTION_READINESS.md`
- `GA4_PRODUCTION_READY_TRACKER.md`
- `GA4_PRODUCTION_READINESS_OUTSTANDING.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS_EVIDENCE.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS_HISTORY.md`
- `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_CSV_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_SALESFORCE_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_SECTION_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`
- `GA4/KPIS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md`
- `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`
- `GA4/AD_COMPARISON_PRODUCTION_READINESS.md`
- `GA4/INSIGHTS_PRODUCTION_READINESS.md`
- `GA4/REPORTS_PRODUCTION_READINESS.md`
- `GA4/REPORTING_TIMEZONE_PRODUCTION_READINESS.md`
- `GA4/KPI_THRESHOLDS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARK_THRESHOLDS_PRODUCTION_READINESS.md`
- `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`
- `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PRODUCTION_READY_STATUS.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_CUSTOM_REPORT_PRODUCTION_READY.md`
- `LINKEDIN_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `LINKEDIN_REVENUE_IMPORT_PRODUCTION_READY.md`
- `GOOGLE_ADS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `META_FACEBOOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `INSTAGRAM_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `TIKTOK_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `GOOGLE_SHEETS_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `CUSTOM_INTEGRATION_CONNECTED_PLATFORM_PRODUCTION_READY.md`
- `TARGETED_DESTRUCTIVE_VISIBILITY_AUDIT.md`

GA4 machine records:

- `GA4/certifications/ga4-overview.json`
- `GA4/certifications/ga4-kpis.json`
- `GA4/certifications/ga4-benchmarks.json`
- `GA4/certifications/ga4-ad-comparison.json`
- `GA4/certifications/ga4-insights.json`
- `GA4/certifications/ga4-reports.json`

## Update Protocol

Every future certification task must start here, read the target's controlling
certificate, and work only on rows marked non-certified or directly impacted by
the proposed change. After validation:

1. update the target certificate first;
2. update only its row and any directly affected roll-up row here;
3. preserve prior evidence as history;
4. update the focused ledger guard;
5. record the exact commit and deployed evidence boundary.
