# Campaign DeepDive Executive Summary Certificate - 2026-09-21

## Decision

**Clean-certified, production-ready, and no-overclaiming for the exact boundary recorded below.**

This certificate covers Campaign DeepDive -> Executive Summary at deployed commit `2d9625437683ccef081e60831f2a59c76246d438`, limited to the production campaign `ga4_mock` and its exact configuration. It is a current delta revalidation of the implementation certified on 2026-09-20. It does not extend to Campaign2, other campaigns, other source mixes, future configuration changes, or excluded report surfaces.

Current production state was checked against the exact deployed revision. Alternate zero, unavailable, compatible-history, target-direction, failure, and fail-closed branches were proved through the unchanged production contracts and focused deterministic regressions. They are not represented as live-observed states.

## Revision And Workspace Gate

Final alignment:

- local `main`: `2d9625437683ccef081e60831f2a59c76246d438`
- `origin/main`: `2d9625437683ccef081e60831f2a59c76246d438`
- deployed Render `/api/health`: `2d9625437683ccef081e60831f2a59c76246d438`
- deployment environment: `production`
- final health response: HTTP `200` at `2026-09-21T09:41:34.062Z`
- certification date: `2026-09-21`

No merge, reset, overwrite, commit, or push was performed during this revalidation. The pre-existing user modification to `APP_PRODUCTION_READINESS.md` and unrelated untracked paths were not edited or staged.

Governing references applied in repository order:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. `GA4/README.md`
5. `GA4_DEVELOPMENT_WORKFLOW.md`
6. `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`
7. `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_CERTIFICATE_2026-09-20.md`

The prior readiness document and certificate were treated as upstream evidence only after confirming that their relevant API, calculation, persistence, ownership, source, and scheduler contracts were unchanged.

## Certified Production Boundary

- campaign: `ga4_mock`
- campaign ID: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`
- GA4 property: `542352127`
- campaign currency: `USD`
- reporting timezone: `Europe/Amsterdam`
- completed reporting date: `2026-09-20`
- aggregate version: `performance_summary_aggregate_v3`
- reporting-window mode: `initial_import_to_latest_completed_day`
- current window: `2026-07-02` through `2026-09-20`
- data-through date: `2026-09-20`
- connected main source: GA4 web analytics
- connected child financial sources: five active revenue sources and four active spend sources in the GA4 campaign context, including legacy-null context records selected by the existing GA4 scoping contract
- connected paid-media main sources: none

The current authenticated API identity, campaign ownership boundary, property, currency, timezone, completed-day window, main-source capability, active financial-source inventory, and snapshot source signature were checked against production persistence.

## Revalidated Change Boundary

The diff from the certified implementation commit `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422` to the current deployed commit changes only:

- the prior certificate file
- `client/src/pages/executive-summary.tsx`
- three focused Executive Summary regression files

The post-certificate product changes are presentation and evidence-wording refinements:

- distinct incompatible-history copy: `History not comparable yet`
- concise four-bullet Executive Summary narrative with the visible date bullet removed
- trajectory heading typography aligned with Marketing Funnel Performance
- ROI placed on the same Bottom of Funnel row
- all five metric cards placed inside Marketing Funnel Performance
- KPI and Benchmark cards grouped under `KPIs & Benchmarks`
- the action title and next step name only eligible exception metrics

No route, storage method, shared schema, aggregate formula, source-selection contract, ownership guard, snapshot evaluator/writer, scheduler implementation, provider query, currency rule, or financial-source lifecycle path changed. Those unchanged contracts support reuse of the applicable 2026-09-20 evidence.

## Three-Query Trace

| Visible consumer | Frontend query | Calculation and persistence | UI use |
| --- | --- | --- | --- |
| KPI, Benchmark, freshness | `GET /api/campaigns/:id/executive-summary` | campaign access; GA4 KPI/Benchmark selection; verified-current resolver; shared target policy | Risk Level, KPI/Benchmark states, action eligibility and freshness |
| Narrative, funnel, cards, capabilities | `GET /api/campaigns/:id/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date` | shared aggregate; completed-day GA4 window; saved-import native financials plus all mapped imported records; gated daily snapshot | narrative, funnel stages, conditional metrics, formulas, five cards and action evidence |
| Seven-day trajectory | `GET /api/campaigns/:id/executive-summary/trajectory?reportingDate=2026-09-20` | exact current and seven-day-prior snapshot selection through the production evaluator | trajectory or explicit unavailable reason |

The retained `executiveFinancialScope=campaign_to_date` request value is a backward-compatible API name only. Current native GA4 values start at the saved initial-import date; imported Revenue and Spend include every available mapped record.

The three authenticated production queries succeeded. An unauthenticated campaign aggregate request was rejected. Required query failures remain wired to the explicit page-level `Unable to Load Executive Summary` state rather than rendered zeros.

The final deployed browser check rewrote only `captureExecutiveSnapshot=1` to `0` so the audit did not update production. The snapshot fingerprint was identical before and after the check. The real page's conditional Engagement Rate was independently recomputed from persisted production rows and its unchanged `capture=1` calculation path remains regression-covered.

## 1. Seven-Day Snapshot Trajectory

Current production result:

- visible state: `History not comparable yet`
- API availability: `false`
- API reason: `incompatible_history`
- current date: `2026-09-20`
- comparison date: `2026-09-13`
- visible explanation: earlier readings used different sources or reporting settings, so they cannot be compared safely
- Risk Level: `MEDIUM`
- risk explanation: `2 KPIs are below target.`
- narrative: `The 7-day trend is not comparable yet.`

This state is correct for the persisted pair and does not claim that calendar history alone is comparable history. The evaluator requires compatible campaign, currency, property, campaign filter, aggregate version, reporting window, timezone, source capability, and financial-source configuration identities.

Current snapshot identity:

- schema: `executive_summary_daily_snapshot_v2`
- row ID: `78c8c879-9358-4d63-9abb-57d6aa4273b7`
- reporting date: `2026-09-20`
- `recorded_at`: `2026-09-21T07:07:35.583Z`
- active source configuration and persisted snapshot signature: exact match
- snapshot fingerprint after validation: unchanged

State coverage remains passed for compatible history, missing exact prior date, incompatible identity, unavailable revenue/invalid denominator, pre-refresh capture rejection, and query failure. Only `incompatible_history` was naturally observed in this production revalidation.

## 2. Marketing Funnel Performance

Exact production values:

| Metric | Authoritative value | Rendered value |
| --- | ---: | ---: |
| Users | 2,824 | `2,824 Users` |
| Sessions | 2,822 | `2,822 Sessions` |
| Engaged sessions | 1,924 | evidence for Engagement Rate |
| Engagement Rate | `1,924 / 2,822 * 100 = 68.1785...%` | `68.18%` |
| Summary conversions | 363 | `363` |
| Conversion Rate | `363 / 2,822 * 100 = 12.8632...%` | `12.86%` |
| Total Revenue | USD 126,865.36 | `$126,865.36` |
| Spend | USD 2,759.75 | `$2,759.75` |
| ROAS | `126,865.36 / 2,759.75 = 45.9698...x` | `45.97x` |
| ROI | `(126,865.36 - 2,759.75) / 2,759.75 * 100 = 4,496.987...%` | `4496.99%` |

Production persistence contained 26 non-simulated GA4 daily rows spanning the exact window. Their sessions and engaged sessions reproduced the displayed Engagement Rate.

Validated presentation and provenance:

- funnel path: `Users -> Sessions -> Conversions -> Revenue`
- top stage: Users, `Sources: ga4`
- middle stage: Sessions, `Sources: ga4`, conditional Engagement Rate and Conversion Rate
- bottom stage: Conversions, Revenue, ROAS, and ROI on one row
- cards inside the Marketing Funnel Performance card: Total Revenue/ROI, Return on Ad Spend/Spend, Total Conversions/CVR, Sessions/source, and Users/source
- GA4 capability row includes Users, Sessions, Conversions, and Revenue
- unsupported paid metrics such as Clicks and Impressions remained unavailable
- no paid-media source or paid-media claim was invented

Valid-zero, unavailable, unsupported capability, invalid currency, denominator-blocked formula, and source-failure behavior remain covered by the unchanged aggregate contract and focused regressions. Those alternate states were not fabricated in production.

## 3. KPIs And Benchmarks

Current production result:

- eligible KPI rows: eight
- KPI exceptions: two
- Conversion Rate: `12.86% / 39.00%`, `Below Target`
- Engagement Rate: `68.18% / 90.00%`, `Below Target`
- eligible Benchmark rows: two
- Benchmark exceptions: zero
- visible states: `KPIs Needing Attention` and `No Benchmark Exceptions`
- stale freshness warning: absent
- downstream Risk Level: `MEDIUM` from the two eligible KPI exceptions

The 39% and 90% targets are user-configured targets. This certificate validates their retrieval, eligibility, direction, classification, rendering, and propagation; it does not endorse their commercial reasonableness.

Exception, no-exception, unavailable, valid-zero, malformed, stale, unsupported, refresh-failed, higher-is-better, lower-is-better, Benchmark monitor, and downstream risk/action branches passed focused regressions. Only the two-KPI-exception and no-Benchmark-exception states were live-observed.

## 4. Recommended Actions

Current production result:

- one evidence-backed action: `Investigate Conversion Rate`
- scope notice: actions are limited to connected web analytics, outcome metrics, and configured targets
- evidence: 2,824 users, 2,822 sessions, 363 conversions, USD 126,865.36 total connected revenue, and 12.86% Conversion Rate
- target context: Conversion Rate KPI below target; Conversions Benchmark on track; Revenue Benchmark on track; Revenue KPI on track
- next step: investigate Conversion Rate, then inspect the relevant measurement and reporting inputs
- wording: investigative and non-causal
- paid-media budget/reallocation claim: absent
- duplicate action/evidence lines: absent
- freshness warning: absent because the current completed-day state passed the verified-current contract

Engagement Rate contributes to Risk Level but is intentionally outside this outcome-action metric set. Only Conversion Rate, Conversions, and Revenue exceptions are eligible to name this action. Eligibility, ordering, deduplication, freshness handling, and no-evidence/no-exception fail-closed behavior passed focused regressions.

## Combined Page Result

The exact deployed page passed as one combined surface:

- all required read-only queries completed
- campaign, property, currency, timezone, window, data-through date, source mix, and current values matched
- trajectory, Risk Level, four narrative bullets, KPI/Benchmark states, and action did not contradict one another
- trajectory and Marketing Funnel headings had equal computed font size
- funnel stages, Bottom of Funnel metrics, and all five cards were grouped correctly
- KPI and Benchmark states were grouped under `KPIs & Benchmarks`
- the removed date bullet and prior generic action title were absent
- required-data failures remain fail-closed
- background refresh wiring remains mount/focus/60-second active-page refresh
- production snapshots were not changed by validation

## Exact Source Configuration Identity

The active source definitions reproduced the current persisted snapshot signature exactly:

- `ga4:web_analytics:conversions:revenue:sessions:users`
- `revenue_source:45dab21e-b4e3-4c03-9885-968a47404bfd:configuration_sha256:7217b5f340ccdf2e4a8a8dc63f50bbbbedf3fb86322c7c926aac5850158bdedd`
- `revenue_source:5b2ac08d-16dd-44f5-aca6-18d68c9d5a7c:configuration_sha256:e92e60b9e03b2557db274f656747c31e4ea38696cecbeea3168dcea2336b8dca`
- `revenue_source:65867434-cbed-4792-9496-8072f63a9c82:configuration_sha256:019e75664df51479818f6acb3e022ba803cf1abd2028ab48767b25aee6c4411d`
- `revenue_source:d4421cb9-8298-4d96-8697-c82ef5f0b7b5:configuration_sha256:67fc4f653cc29f27dfab250393d14799cd4daf1025b5d6ed24795b05cfff3dde`
- `revenue_source:d4ad51ef-85fe-4b67-bbd5-854900be3dee:configuration_sha256:605ccaf353b2dbd9942657d4f8b62514ad7f4ef8e78a0a4102c53ff86a0faa6a`
- `spend_source:22c2ea02-2e54-4dba-babc-149863e7dd93:configuration_sha256:77a694eb84856eeb546c45d75c377e40dcef33eeb2e16b61a99220955d1572d6`
- `spend_source:618e5e12-0f3f-44a2-837a-d2677ad95f64:configuration_sha256:f02a41bd288475157c3366da9820e7d13bf5dce18fca471d21a9fc9101eecb79`
- `spend_source:6c0a40a9-52fd-414f-bb02-4319075b304c:configuration_sha256:61a5fe3e69671c581871f001d12599f24163d8265a350789f4d2a0319b08ba89`
- `spend_source:d6cfcea0-ddad-4060-96bf-61e94ad975c6:configuration_sha256:1582a7e0c38bf90ebd6b76aa49ee1bd3dd1cc0da3d5b196a3acd106531e75798`

Configuration fingerprints exclude refresh-only metadata but change when a source's relevant mapping/configuration changes.

## Scheduler And Refresh Evidence

Read-only `/health/scheduler` returned HTTP `200` and `healthy` at `2026-09-21T09:24:20.346Z`.

- GA4 daily scheduler: started, timer armed, idle, no error
- GA4 schedule: `22:30 UTC`
- GA4 `runOnStartup`: `false`
- next GA4 run: `2026-09-21T22:30:00.000Z`
- next data-through date: `2026-09-20`
- auto-refresh scheduler: started, timer armed, idle, no error
- auto-refresh schedule: `22:00 UTC`
- auto-refresh `runOnStartup`: `false`

Scheduler implementation and configuration did not change from the certified base. Applicable prior exact-runtime and natural-timer evidence was therefore reused. This revalidation does not claim that a new natural `22:30 UTC` firing occurred after the current Render process started.

## Validation Record

- focused in-scope suites: 13 passed
- focused in-scope tests: 79 passed
- TypeScript validation: passed
- production build: passed once
- exact deployed revision check: passed
- unauthenticated campaign read: rejected
- authenticated production API checks: passed
- authenticated combined-page content and structure: passed
- metric formulas and display precision: passed
- persisted Engagement Rate recomputation: passed
- active source definitions vs current snapshot signature: exact match
- snapshot fingerprint before/after deployed validation: unchanged
- database validators: read-only transactions rolled back
- temporary scripts: removed
- temporary Clerk sessions/tokens: revoked

A separately attempted, excluded Performance Summary scheduled-PDF suite did not start because its test mock lacks `getCampaignMetricTotalsAtDate`. That report surface is outside this certificate, was not modified, and is not represented as passing.

## Reused Upstream Evidence

Full GA4 provider and financial-source family audits were not repeated. Evidence was reused only for unchanged property scoping, provider selection, source lifecycle, currency, financial reconciliation, ownership/isolation, scheduler, snapshot, valid-zero, unavailable, and failure contracts. Current production identity, values, source configuration, section behavior, and downstream propagation were independently rechecked.

Campaign2 was not used as positive evidence and is not certified here.

## Exclusions And Remaining Gates

Excluded:

- Campaign2 and all other campaigns, properties, tenants, currencies, and reporting timezones
- future source-configuration changes and future/currently unconfigured paid-media mixes
- source add/edit/delete lifecycle recertification
- Campaign DeepDive sections outside Executive Summary
- Custom Reports, browser/PDF exports, scheduled reports, email acceptance/delivery, and inbox receipt
- the excluded Performance Summary scheduled-PDF test path noted above
- commercial reasonableness of user-configured KPI and Benchmark targets

Remaining gates within the exact certified Executive Summary boundary: **none**.

Standing future gates:

1. Any main-source or relevant financial-source configuration change requires source identity, capability, aggregation, snapshot, KPI/Benchmark, risk/action, and deployed-source-mix revalidation.
2. A naturally available exact seven-day production trajectory may be recorded after compatible snapshots exist; until then, that live state remains unobserved and only its deterministic evaluator branches are certified.
3. Reports and delivery surfaces require their own certification and are not covered by this page certificate.

Subject only to these explicit exclusions and future-extension gates, Campaign DeepDive -> Executive Summary is clean-certified for the exact runtime, campaign, source configuration, and deployed revision recorded above.
