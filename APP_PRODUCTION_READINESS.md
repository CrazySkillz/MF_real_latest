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
| 1 | Overview | `NEXT` |
| 2 | KPIs | `QUEUED` |
| 3 | Benchmarks | `QUEUED` |
| 4 | Ad Comparison | `QUEUED` |
| 5 | Insights | `QUEUED` |
| 6 | Reports | `QUEUED` |

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
| `CERTIFIED` | The controlling certificate explicitly records production readiness for an exact runtime and scope. |
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
| GA4 KPIs | `UNVERIFIED` | `GA4/certifications/ga4-kpis.json`; `GA4/KPIS_PRODUCTION_READINESS.md` | Exact-current certification was not rerun after later shared dependency changes. |
| GA4 Benchmarks | `CERTIFIED` | `GA4/certifications/ga4-benchmarks.json`; `GA4/BENCHMARKS_PRODUCTION_READINESS.md` | Exact deployed runtime `a96ba06e21c9344c1767c960e702ac4a647dc5f1` and recorded campaign/property/source boundary. |
| GA4 Ad Comparison | `UNVERIFIED` | `GA4/certifications/ga4-ad-comparison.json`; `GA4/AD_COMPARISON_PRODUCTION_READINESS.md` | Later shared dependencies changed after the previous exact certificate. |
| GA4 Insights | `CERTIFIED` | `GA4/certifications/ga4-insights.json`; `GA4/INSIGHTS_PRODUCTION_READINESS.md` | Exact live-tab runtime `4be16c54c550a45dbf3104313c820ea47b453604`. |
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
| HubSpot Revenue and Pipeline Proxy | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md` | Five exact active GA4 sources and exercised configurations at deployed runtime `490c8ae685821389d1f433a5943f856478f52e5c`; this evidence set is not a five-source product limit. |
| Shopify Revenue | `RELEASE_CANDIDATE` | `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md` | First timer-fired scheduler refresh and deployed expiring-token renewal evidence remain named gates. |
| Upload CSV Revenue | `CERTIFIED` | `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` | Exact enabled source and bounded CSV lifecycle inside its recorded Overview boundary. |
| Google Sheets Revenue | `UNVERIFIED` | `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` | Last committed record excludes it from certification; current uncommitted work remains in progress. |
| Salesforce Revenue and Pipeline Proxy | `NO_CERTIFICATE` | `GA4/CRM_REVENUE_SOURCE_PATTERN.md` | Strong bounded implementation and user evidence is recorded, but that document explicitly says it is not a production-readiness certificate. |
| GA4 Google Sheets/CSV Spend family | `RELEASE_CANDIDATE` | `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md` | Configured spend values have bounded evidence; the general Google Sheets provider/scheduler lifecycle is not independently clean-certified. |
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
   production-ready, while current GA4 Overview, KPI, Ad Comparison, and Reports
   machine records say `UNVERIFIED`.
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
- `GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_REVENUE_SHOPIFY_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_SPEND_PRODUCTION_READINESS.md`
- `GA4/KPIS_PRODUCTION_READINESS.md`
- `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
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
