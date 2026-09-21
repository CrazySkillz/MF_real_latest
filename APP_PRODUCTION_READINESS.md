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
| 5 | Insights | `COMPLETE` |
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
| Google Sheets | `COMPLETE` | `CERTIFIED` | Clean-certified and production-ready for the documented deployed single-runtime V1 scope in `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`; documentation commit `f4a648a8`; certified deployed runtime `f8061d135a85fbe2c4c11433fffb3f80dedceae8`; required V1 steps remaining: 0. |
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

The existing whole-live-tab Insights certificate at `4be16c54c550a45dbf3104313c820ea47b453604` remains preserved at its exact documented boundary. The rows below track a new, separate subsection-by-subsection pass and the current combined on-screen page; a subsection pass alone does not certify the whole tab. Treat GA4 Overview, KPIs, Benchmarks, and financial-source certificates as read-only dependencies. Do not modify protected certified behavior or evidence without explicit approval. Reports and delivery remain outside this Insights pass.

| Order | Insights subsection | Work state | Fresh certification status | Required validation boundary |
| ---: | --- | --- | --- | --- |
| - | Insights (fresh combined-page pass) | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the four combined on-screen subsections, header/freshness, shared inputs, cross-section consistency, and scoped refresh/failure behavior on Campaign2/property `542352127`, saved filters, USD, and Amsterdam time at deployed runtime `f74167597d8f9aad09a43466f3a94ce3b7c7cedd`. Controlling certificate: `GA4/INSIGHTS_COMBINED_ONSCREEN_CERTIFICATION_2026-09-18.md`; required gates remaining within that exact boundary: 0. The historical whole-tab machine record is preserved, not renewed. Other configurations, natural timer firing, global scheduler health, Reports, PDFs, and delivery are excluded. |
| 1 | Executive Financials | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` only for Spend, Revenue, Profit, ROAS, ROI, and “Sources used” within the exact campaign/property/USD/source and value-state boundary in `GA4/INSIGHTS_EXECUTIVE_FINANCIALS_CERTIFICATION_2026-09-17.md`; validated application runtime `f4fe2f3e3b47a3b350dd14c8a8d336bc8ff946ca`, corrected documentation commit `74b778e33d9bf2758b5a681c90424b781f414b3e`. GA4 Overview financial values are read-only inputs; the whole Insights tab, its other subsections, upstream source lifecycles, and other configurations are not certified by this row. Required steps remaining for this bounded consumer result: 0. |
| 2 | Trends | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the Trends card's Daily, 7d, 30d, and Monthly values, charts, and fail-closed states on the certificate's two owned campaigns/property `542352127` at deployed runtime `757cfc5926d59dbae4addd0a4d4a0531f675f3f7`; controlling certificate: `GA4/INSIGHTS_TRENDS_CERTIFICATION_2026-09-17.md` (documentation commit `77d65bc5`). Required Trends gates remaining within that boundary: 0. A natural GA4 daily timer run on this exact commit and a production provider outage or divergent stored/provider data remain unverified; Reports/PDFs, other Insights sections, protected sections, arbitrary properties, and overall mobile layout (including existing 390px horizontal scroll) remain excluded. The fresh combined Insights page is not certified by this row. |
| 3 | Data Summary | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY` for the on-screen Sessions, Conversions, imported-history label, conversion rate, and valid-zero/stale/unavailable states on the exact campaign `eee3e654-b736-4e8e-86ec-1050e4d905c0`, property `542352127`, and saved filters at tested application runtime `0bce5024b1b5ab7dd6cbbbf1f7f91e81b94b24cf`; controlling certificate: `GA4/INSIGHTS_DATA_SUMMARY_CERTIFICATION_2026-09-17.md` (documentation/script commit `d59b1ccf`, deployed without application-code changes). Required gates remaining for this on-screen scope: 0. Top Channel, the source/medium channel breakdown, and channel warnings are disabled and excluded; findings-rule logic, other Insights sections, protected sections, Reports/PDFs/delivery, other campaigns/properties, future provider failures, and an exact-commit natural scheduler run are not certified by this row. This subsection row alone does not certify the combined page. |
| 4 | What to investigate next | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED` for the on-screen findings and Total/High/Medium cards on the certificate's owned campaign `eee3e654-b736-4e8e-86ec-1050e4d905c0`, property `542352127`, saved filters, and imported-history boundary at deployed product runtime `6673a976f98d853b9eb37ddc99a2afc195f302d9`; controlling certificate: `GA4/INSIGHTS_FINDINGS_CERTIFICATION_2026-09-18.md` (documentation commit `31d066860eceb88d3c40cd8f01d90efe65a55d73`). Required gates remaining within this on-screen scope: 0. A natural timer run on this commit, live configured KPI/Benchmark target findings, other campaigns/properties, an immutable creation-day snapshot, other Insights and protected sections, browser/server PDFs, Reports, and report delivery remain excluded; the broader report-copy regression is not counted as passing. This subsection row alone does not certify the combined page. |

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

### Phase 2 - Campaign DeepDive

Standalone campaign-level KPI and Benchmark tabs are disabled in normal
navigation and are not a certification phase in this program. This does not
exclude GA4 KPI/Benchmark inputs still consumed by visible DeepDive content.
The legacy `#kpis` and `#benchmarks` entry points remain an app-exit visibility
check; do not call those tabs fully `EXCLUDED` while they remain reachable.

The fresh Performance Summary review is complete. Its current certificate is
separate from the preserved historical certificate for runtime `12789c1e`.

| Order | Performance Summary review | Work state | Fresh certification status | Boundary |
| ---: | --- | --- | --- | --- |
| - | Combined Performance Summary | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY / NO-OVERCLAIMING` for the exact two-campaign, property `542352127`, USD, Europe/Amsterdam, data-through `2026-09-18` boundary at deployed runtime `ee6e11ebf8cb0a13dd182dde54af790a3757ef2f`; controlling certificate: `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md`; required steps remaining within that scope: 0. Timer-fired financial/GA4 evidence is carried only from immediate parent `2ee07fa6` because the certified diff changed no scheduler/provider/storage/configuration path and the exact runtime had both next timers armed. Unrelated campaign/provider failures, global scheduler health, future restatements/configurations, other DeepDive sections, Reports/delivery, and provider behavior after the evidence boundary remain excluded. |
| 1 | Key Outcomes | `COMPLETE` | `CERTIFIED` | PASS for Users, Sessions, Conversions, Spend, Revenue, source labels, currency, completed-day boundary, and valid-zero/unavailable distinction within the exact certificate boundary. |
| 2 | Campaign Health | `COMPLETE` | `CERTIFIED` | PASS for target-free setup and the recorded complete 8-KPI/2-Benchmark configured-target state; incomplete inputs fail closed. |
| 3 | Top Priority Action | `COMPLETE` | `CERTIFIED` | PASS for target-free and configured-target states using verified source-derived current values rather than stale persisted values. |
| 4 | Recent Movement | `COMPLETE` | `CERTIFIED` | PASS for yesterday, seven-day, and one-month exact-date comparisons with source/property/currency compatibility and fail-closed invalid states. |
| 5 | Recommended Actions | `COMPLETE` | `CERTIFIED` | PASS for target-free and configured-target states, metric direction, eligibility, ordering, deduplication, and fail-closed unavailable inputs. |

Google Sheets Revenue is incorporated only as a certified read-only Key Outcomes
dependency. Its lifecycle authority remains
`GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md` at documentation commit
`f4a648a8` and deployed runtime `f8061d13`; the Performance Summary certificate
does not recertify or broaden that source boundary.

Remaining DeepDive certification order after the completed Budget, Trend, and
Executive Summary reviews:

1. Reports
2. Platform Comparison if it remains visible; otherwise hide it and mark it
   `EXCLUDED` before app certification

Budget & Financial Analysis completed its fresh four-packet and combined-page
review at deployed application runtime `b36047bbce419df9d606239c340398e69a409211`.
The earlier certificate for runtime `19f05537` remains preserved as historical
evidence and is not the controlling current-program result.

| Order | Budget & Financial Analysis review | Work state | Fresh certification status | Boundary |
| ---: | --- | --- | --- | --- |
| - | Combined Budget & Financial Analysis | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY / NO-OVERCLAIMING` for the exact existing-campaign and isolated-fixture boundary at deployed runtime `b36047bbce419df9d606239c340398e69a409211`; controlling certificate: `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_CERTIFICATE_2026-09-19.md`; required steps remaining within that boundary: 0. Live paid-provider OAuth, live email delivery, a newly generated production PDF, other configurations, and the certificate's stated V1 decision-support limits remain excluded. |
| 1 | Financial Position | `COMPLETE` | `CERTIFIED` | PASS for Spend, Revenue, Profit, ROAS, ROI, CPA, Conversion Efficiency, valid-zero/unavailable/stale states, and conditional Paid Media Efficiency. The section was proven hidden without compatible paid inputs and visible as CTR-only with exact compatible Instagram fixture inputs; live Instagram provider accuracy remains excluded. |
| 2 | Budget & Pacing | `COMPLETE` | `CERTIFIED` | PASS for deployed UI add, edit, delete, final render, timezone-safe inclusive calendar math, linear pacing thresholds, and unavailable states without changing source totals. The V1 pacing plan is uniform daily spend: below `85%` is behind, above `115%` is ahead, otherwise on track. |
| 3 | Allocation & Sources | `COMPLETE` | `CERTIFIED` | PASS for authoritative revenue/spend provenance and exact displayed-total reconciliation in the certified configuration. The implementation validates arithmetic and currency but assumes configured revenue sources are additive and non-overlapping; cross-source business-transaction deduplication is not claimed. |
| 4 | Executive Action | `COMPLETE` | `CERTIFIED` | PASS as deterministic V1 decision support: break-even return classification, linear budget pacing, and reconciled largest-source concentration from the same displayed values. It is not causal attribution, accounting-profit analysis, or an automatic reallocation recommendation; incrementality, margins/COGS, LTV, seasonality, non-linear flighting, source-overlap detection, and campaign-specific return targets are excluded. |

`Paid Media Efficiency` has its own conditional UI heading. It is included in
the Financial Position packet and combined-page gate, not omitted or declared
certified when no compatible paid-media source is configured.

Trend Analysis completed its fresh six-packet and combined-page review for the
exact GA4-first boundary at application runtime
`7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`, deployed within documentation-only
successor `595268463c79b111e77b181ad3003e58f912d208`. Documentation-alignment
commit `08df7c98856c132c55b7cdec9511fedb1ececf81` is not a new application runtime.

| Order | Trend Analysis review | Work state | Fresh certification status | Boundary |
| ---: | --- | --- | --- | --- |
| - | Combined Trend Analysis | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY / NO-OVERCLAIMING` for the exact audited Campaign2, one-GA4-source, USD, Europe/Amsterdam, data-through `2026-09-19` boundary at application runtime `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`; controlling evidence: `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_CERTIFICATION_2026-09-20.md`; supporting contract: `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md`; required implementation/certification steps remaining within that scope: 0. |
| 1 | Campaign-to-Date Performance Summary | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first scope for the observed Revenue, Spend, ROAS, ROI, Conversions, CPA, Sessions, Users, CVR, and Engagement Rate paths, guarded formulas, currency, windows, and valid-zero/unavailable distinction. Positive paid-media CPC, CPM, and CTR card paths are not certified. |
| 2 | Campaign Performance Trend | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first scope for all four selectors, actual daily rows, missing-date gaps, provider-verified zero, and the explicit 90-day insufficient-history state. |
| 3 | Efficiency Trends | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first conversion-quality and unavailable-daily-financial-history boundary; return, cost, and rate series remain independently capability-gated and do not fabricate unavailable performance. |
| 4 | Website Engagement & Conversion Summary | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first scope for Sessions, Engaged Sessions, Conversions, Engagement Rate, conversions per 100 sessions, and compatible cumulative numerator/denominator windows. |
| 5 | Anomaly Detection | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first conversion-history scope, including descriptive statistical flags, eligible observed-zero drops, no-anomaly/missing-data handling, and non-causal wording. This panel remains browser-only and is not claimed as PDF content. |
| 6 | Executive Recommendations | `COMPLETE` | `CERTIFIED` | PASS within the exact certified GA4-first scope for evidence-gated adjacent-window and reconciled financial guidance, fail-closed incomplete context, ordering/cap, and non-causal/non-automatic-action limits. |

`Paid Acquisition Funnel` and `Source Contribution` are conditional visible
panels rather than separate requested packets. Their hidden single-GA4 behavior
passed. Positive paid-media `Paid Acquisition Funnel`, positive multi-source
`Source Contribution`, non-GA4 main sources, and future source mixes remain
uncertified and require separate evidence. Global scheduler health, a new
scheduled firing, provider delivery, inbox receipt, whole-application readiness,
and global multi-source readiness are also outside this certificate.

Executive Summary completed its fresh four-packet and combined-page review for
the exact `ga4_mock` boundary at certified implementation commit
`2d9625437683ccef081e60831f2a59c76246d438`. Certificate commit
`1d646c0cfef12e45035ae0770f2ebcebb19a33b2` and documentation-alignment commit
`686abb2e316292a4118a91a7c83c8f704f6d6e31` changed documentation only; the
certified application implementation remained unchanged.

| Order | Executive Summary review | Work state | Fresh certification status | Boundary |
| ---: | --- | --- | --- | --- |
| - | Combined Executive Summary | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY / NO-OVERCLAIMING` for the exact `ga4_mock`, property `542352127`, USD, Europe/Amsterdam, GA4-first configuration documented by `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_CERTIFICATE_2026-09-21.md`; all four packets passed together and required steps remaining within that boundary: 0. |
| 1 | 7-Day Snapshot Trajectory and Risk Level | `COMPLETE` | `CERTIFIED` | PASS for the exact snapshot identity, current live `incompatible_history` state, compatible/missing/unavailable deterministic branches, Risk Level, and the factual four-bullet narrative within the certified boundary. A naturally observed compatible seven-day production trajectory remains a standing future evidence opportunity, not a required gate. |
| 2 | Marketing Funnel Performance | `COMPLETE` | `CERTIFIED` | PASS for source-capability-driven funnel stages, conditional rates, Bottom of Funnel values, all five metric cards, formulas, provenance, currency, valid-zero/unavailable behavior, and the absence of invented paid-media metrics. |
| 3 | KPIs & Benchmarks | `COMPLETE` | `CERTIFIED` | PASS for exception, no-exception, unavailable, target-direction, verified-current classification, and downstream risk/action behavior. User-configured target commercial reasonableness and disabled standalone campaign-level KPI/Benchmark tabs remain outside this packet. |
| 4 | Recommended Actions | `COMPLETE` | `CERTIFIED` | PASS for eligibility, evidence and target context, freshness handling, ordering/deduplication, non-causal wording, paid-media guardrails, and the fail-closed no-evidence state. |

This certificate does not extend to Campaign2, other campaigns, properties,
tenants, currencies, timezones, source configurations, paid-media variants,
other Campaign DeepDive sections, source lifecycle recertification, PDFs,
reports, schedules/delivery surfaces, inbox receipt, or target commercial
reasonableness. Source-configuration changes require the certificate's stated
identity, capability, aggregation, snapshot, KPI/Benchmark, risk/action, and
deployed-source-mix revalidation gates.

Reports completed its fresh four-packet and combined-surface review for the
exact enabled GA4-first boundary at deployed runtime
`809227f7aefba97d50d9c7649de8e7d06c022371`. Controlling evidence is
`CAMPAIGN_DEEPDIVE_REPORTS_CERTIFICATION_2026-09-21.md` with supporting audit
`CAMPAIGN_DEEPDIVE_REPORTS_AUDIT_2026-09-21.md`; documentation commit
`826e1a89f03361d276e62ef9909a20afd395f968` changed documentation only.

| Order | Reports review | Work state | Fresh certification status | Boundary |
| ---: | --- | --- | --- | --- |
| - | Combined Reports | `COMPLETE` | `CERTIFIED` | `CLEAN-CERTIFIED / PRODUCTION_READY / NO-OVERCLAIMING` for the exact documented GA4-first, USD, Europe/Amsterdam configuration at deployed runtime `809227f7aefba97d50d9c7649de8e7d06c022371`; all four packets and the standalone fail-closed Combined Reports surface passed together. Required certification steps remaining within this boundary: 0. |
| 1 | Report Builder & Source Selection | `COMPLETE` | `CERTIFIED` | PASS for campaign context/navigation, owner/client/campaign/platform isolation, connected-source capability gating, and the enabled creation types. Legacy saved Platform Comparison and `custom` configurations are recoverable during edit but are not offered for unsupported new GA4-only creation. |
| 2 | Report Content & PDF Parity | `COMPLETE` | `CERTIFIED` | PASS for six production PDF compositions, exact values, currency, formatting, windows, selected metrics/KPIs/Benchmarks, unavailable/freshness guards, and non-persisting direct generation. Deployed parity from `c4fbc498` is reused only because the intervening product change did not touch renderer dependencies. |
| 3 | Scheduled Report Library & Lifecycle | `COMPLETE` | `CERTIFIED` | PASS for create and invalid-create, scoped list, edit, reschedule, pause, resume, latest-value snapshot/download, cross-owner denial, delete/repeated-delete, concurrency, deduplication, and exact cleanup. Lifecycle evidence from `243a3be1` is reused under unchanged route, storage, and contract dependencies. |
| 4 | Delivery, Artifacts & Failure Safety | `COMPLETE` | `CERTIFIED` | PASS for access and campaign/platform consistency, immutable artifacts, scheduler deduplication, fail-closed missing campaign/artifact/send states, provider-acceptance versus confirmed-delivery terminology, and send bookkeeping. Prior Mailgun delivery evidence is reused under unchanged dependencies; no email was sent and no scheduler was triggered during final certification. |

The standalone Combined Reports surface is certified only as fail-closed: it
shows a real empty state and ignores legacy unscoped browser-local rows without
deleting them; no combined authoring, aggregation, scheduling, or local
lifecycle is claimed. Live source-backed valid-zero behavior was not observed
and remains deterministic regression evidence. Google Ads, Meta, Instagram,
TikTok, other main-source mixes, and future Combined Reports authoring remain
outside this exact certificate.

Each DeepDive certificate must consume certified GA4 and enabled connected-platform
inputs without independently changing or reinterpreting upstream values. An
unverified upstream input keeps its dependent DeepDive claim unverified; it does
not require reopening an unrelated certified section.

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
| GA4 Insights | `CERTIFIED` | `GA4/INSIGHTS_COMBINED_ONSCREEN_CERTIFICATION_2026-09-18.md`; historical `GA4/certifications/ga4-insights.json` and `GA4/INSIGHTS_PRODUCTION_READINESS.md` | Current combined on-screen Insights page is `CLEAN-CERTIFIED / PRODUCTION_READY` only for the exact Campaign2/property/saved-filter/USD/Amsterdam boundary at deployed runtime `f74167597d8f9aad09a43466f3a94ce3b7c7cedd`; required gates within that boundary: 0. Reports/PDFs, other configurations, natural timer firing, and global scheduler health are excluded. The earlier `4be16c54` machine certificate remains historical and was not renewed. |
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
| Performance Summary | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md`; historical `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md` | Current clean certificate: exact deployed runtime `ee6e11ebf8cb0a13dd182dde54af790a3757ef2f`, two recorded campaigns, property `542352127`, USD, Europe/Amsterdam, data through `2026-09-18`; all five visible results and combined page passed with 0 required steps remaining inside that boundary. Parent timer evidence is accepted only through the documented unchanged-scheduler dependency check; global scheduler health and the certificate's other exclusions remain outside the claim. |
| Budget & Financial Analysis | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_CERTIFICATE_2026-09-19.md`; historical `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md` | Current bounded clean certificate: deployed application runtime `b36047bbce419df9d606239c340398e69a409211`; all four visible sections and the combined page passed, including budget/date add-edit-delete and both hidden/visible Paid Media Efficiency conditions. Executive Action is deterministic V1 decision support, not causal attribution, accounting-profit analysis, source-overlap detection, or automatic budget optimization. Required steps remaining inside the exact certificate boundary: 0. |
| Platform Comparison | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md` | Current aggregate-backed implementation and Render-validated GA4-only scenario. |
| Trend Analysis | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_CERTIFICATION_2026-09-20.md`; supporting `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_PRODUCTION_READY.md` | Current bounded clean certificate: application runtime `7dc72dc8dc5ba302146128b62c45f3bf7d86f6eb`, deployed within documentation-only successor `595268463c79b111e77b181ad3003e58f912d208`; documentation-alignment commit `08df7c98856c132c55b7cdec9511fedb1ececf81` is not an application runtime. All six current sections and the combined single-GA4 page passed with 0 required implementation/certification steps remaining inside the exact boundary. Positive conditional panels, non-GA4/future source mixes, global scheduler health, new timer firing, provider/inbox delivery, and whole-app/global multi-source claims remain excluded. |
| Executive Summary | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_CERTIFICATE_2026-09-21.md`; supporting `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md` | Current bounded clean certificate: application implementation `2d9625437683ccef081e60831f2a59c76246d438`, certificate commit `1d646c0cfef12e45035ae0770f2ebcebb19a33b2`, and deployed documentation-alignment commit `686abb2e316292a4118a91a7c83c8f704f6d6e31`. All four sections and the combined page passed for the exact documented `ga4_mock` GA4-first configuration, with 0 required steps remaining inside that boundary. Campaign2, other campaigns/configurations, other DeepDive sections, PDFs/reports, scheduling/delivery surfaces, target commercial reasonableness, and the certificate's standing future gates remain excluded. |
| Reports | `CERTIFIED` | `CAMPAIGN_DEEPDIVE_REPORTS_CERTIFICATION_2026-09-21.md`; supporting `CAMPAIGN_DEEPDIVE_REPORTS_AUDIT_2026-09-21.md` | Current bounded clean certificate: deployed runtime `809227f7aefba97d50d9c7649de8e7d06c022371`, documentation commit `826e1a89f03361d276e62ef9909a20afd395f968`, all four Reports packets, and the standalone fail-closed Combined Reports surface passed with 0 required certification steps remaining. The certificate's reused-evidence limits, no-final-send/no-final-scheduler qualification, deterministic-only live-zero coverage, GA4-first source scope, and future-source/authoring exclusions remain controlling. |
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
| Campaign-level KPIs and Benchmarks | `RECONCILE` | `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md` preserves historical evidence; standalone tabs are absent from normal navigation | Outside the fresh certification queue. Legacy `#kpis`/`#benchmarks` still render content, so verify release visibility before marking `EXCLUDED`; audit any visible GA4 KPI/Benchmark consumers within their own sections. |
| Notifications page and bell | `NO_CERTIFICATE` | Targeted visibility audit and alert/notification regression evidence | One whole-surface certificate covering list, filters, links, dismiss/recreate, ownership, email status, and source changes. |
| Global Dashboard | `UNVERIFIED` | Architecture says the Dashboard still needs refinement | Complete value inventory, scope, formulas, lifecycle, and downstream trace. |
| Global Reports route/library | `UNVERIFIED` | GA4 Reports and Campaign DeepDive Reports have separate records | Certify the visible route as a composition of only its supported report families. |
| Audiences | `NO_CERTIFICATE` | Visible application route; no readiness document found | Decide supported release scope, then certify or explicitly exclude. |
| Freestyle Chat | `UNVERIFIED` | Architecture describes it as still in progress | Complete and certify, or hide and mark `EXCLUDED` for this release. |
| Global scheduler health | `UNVERIFIED` | Several exact target jobs are certified; current evidence repeatedly excludes obsolete/test failures | Define active production job inventory and pass one global healthy-cycle gate without treating excluded jobs as success. |
| App-wide destructive/visibility behavior | `RECONCILE` | `TARGETED_DESTRUCTIVE_VISIBILITY_AUDIT.md` contains broad targeted evidence | Convert completed evidence into an explicit exact-runtime certificate and preserve unresolved rows. |

## Automatic Scheduler Validation Track

This is a **separate app-wide operational gate**, not a replacement for any section or source certificate. The table below is an initial work queue, **not a complete active-job inventory**. A manual `run-now` call, startup run, configured timer, or successful UI poll does **not** prove that the normal scheduler timer fired. Existing bounded timer-fired source evidence remains valid within its own certificate; it must not be generalized into global scheduler health.

| Scheduler family | Evidence to preserve | App-wide timer status |
| --- | --- | --- |
| GA4 daily facts and KPI/Benchmark recompute | `GA4/REFRESH_AND_PROCESSING.md` records earlier bounded natural runs; `GA4/INSIGHTS_COMBINED_ONSCREEN_CERTIFICATION_2026-09-18.md` records a successful Campaign2 manual run on product revision `f7416759`. | `UNVERIFIED` for a natural timer firing on that revision; the manual run is not counted as one. |
| HubSpot and Salesforce revenue/Pipeline Proxy | Their controlling GA4 Revenue source certificates own the exact source, cadence, transition, and refresh evidence. | Source-bounded evidence only; a current app-wide healthy cycle is `UNVERIFIED`. |
| Shopify and Google Sheets Revenue/Spend | Their controlling GA4 source certificates own their exact automatic-refresh evidence and exclusions. | Source-bounded evidence only; a current app-wide healthy cycle is `UNVERIFIED`. |
| Scheduled reports and alerts | Their separate Reports and notification readiness records control delivery and alert claims. | `UNVERIFIED` in this app-wide track; no send/delivery claim is inferred from a timer starting. |
| Other platform, KPI, token, snapshot, and maintenance jobs | Enumerate enabled jobs from the deployed scheduler configuration before testing; do not infer enablement from a source card or a scheduler file. | `INVENTORY_PENDING`; no app-wide pass is claimed. |
| CSV uploads | CSV Revenue and Spend certificates define user-updated snapshots. | `NOT_APPLICABLE` for automatic source refresh. |

For each **enabled production job**, record the deployed product revision and dependency-impact check; the configured cadence/timezone and actual timer trigger; exact owner/campaign/property/source or report scope; run ID, start/end, result, skips/failures, and overlap handling; provider-to-storage before/after values; downstream open-page convergence; idempotency; and last-good-data behavior on failure. Preserve provider/API acceptance versus confirmed email delivery as separate outcomes. Mark a job `TIMER_VERIFIED` only from an observed normal timer firing with reconciled effects—not from manual, startup, or browser-only fixtures.

The app-wide gate stays `UNVERIFIED` until the active production job inventory is explicit and one healthy natural cycle covers every enabled family in scope. Disposable/test campaigns and unconfigured sources may be excluded only by recorded ownership/configuration evidence; their failures must not be silently relabeled as successes. Do not modify a certified section to close this track without explicit approval.

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

1. **Budget & Financial Analysis is complete:** carry forward only within the
   exact controlling certificate boundary and reopen affected paths when its
   code, source contracts, configuration, or deployment changes.
2. **Trend Analysis is complete:** carry forward only within the exact
   controlling GA4-first certificate boundary and reopen affected paths when its
   code, source contracts, configuration, or deployment changes.
3. **Continue Campaign DeepDive:** freshly review Reports, then visible Platform
   Comparison if it remains in the supported release. Preserve historical
   bounded certificates; do not promote unverified input paths.
4. **Complete pending GA4 work and its roll-up:** finish the remaining Overview
   and Reports gates independently; create the GA4 roll-up only after all six
   section certificates pass. Keep the existing certified rows unchanged.
5. **Resolve excluded-feature visibility:** standalone campaign-level KPI and
   Benchmark tabs require no fresh certificate, but legacy entry points must be
   hidden/disabled before recording them as `EXCLUDED` for app certification.
6. **Certify remaining enabled app surfaces and sources:** work only on ledger
   rows that are not already accepted into the new program; hide and mark
   unsupported features `EXCLUDED` rather than certifying unfinished behavior.
7. **Issue the app certificate:** on one exact deployed release SHA, run the
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
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_CERTIFICATE_2026-09-19.md`
- `CAMPAIGN_DEEPDIVE_PERFORMANCE_SUMMARY_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_BUDGET_FINANCIAL_ANALYSIS_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_PLATFORM_COMPARISON_PRODUCTION_READY.md`
- `CAMPAIGN_DEEPDIVE_TREND_ANALYSIS_CERTIFICATION_2026-09-20.md`
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
