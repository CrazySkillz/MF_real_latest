# Campaign DeepDive Executive Summary Certificate — 2026-09-20

## Decision

**Clean-certified, production-ready, and no-overclaiming for the exact boundary below.**

This certificate covers the Campaign DeepDive **Executive Summary** at commit `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422` for the GA4-first production campaign and source mix recorded here. It does not extend to other campaigns, future source mixes, unconfigured paid-media platforms, or excluded report surfaces.

No included path remains assumed. Current production state was checked on the exact deployed revision; alternate, zero, unavailable, failure, target-direction, and compatible-history branches were established by traced contracts and focused deterministic regressions. Where a branch was not naturally present in production, this certificate says so rather than representing it as live-observed.

## Revision And Workspace Gate

Final alignment:

- local `main`: `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422`
- `origin/main`: `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422`
- deployed Render `/api/health`: `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422`
- deployment environment: `production`
- certification date: `2026-09-20`

The readiness gate was checked before work and again after deployment. No merge, reset, overwrite, or unrelated staging was performed. The pre-existing user modification to `APP_PRODUCTION_READINESS.md` was not edited or committed.

Governing references applied in repository order:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. `GA4/README.md`
5. `GA4_DEVELOPMENT_WORKFLOW.md`
6. `CAMPAIGN_DEEPDIVE_EXECUTIVE_SUMMARY_PRODUCTION_READY.md`

The earlier Executive Summary readiness document was treated as historical/upstream evidence, not as proof by assertion.

## Certified Production Boundary

- campaign: `ga4_mock`
- campaign ID: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`
- GA4 property: `542352127`
- campaign currency: `USD`
- reporting timezone: `Europe/Amsterdam`
- completed reporting date: `2026-09-19`
- aggregate version: `performance_summary_aggregate_v3`
- reporting-window mode: `initial_import_to_latest_completed_day`
- current window: `2026-07-02` through `2026-09-19`
- data-through date: `2026-09-19`
- connected main source: GA4 web analytics
- connected child financial sources: five active revenue sources and four active spend sources in the GA4 campaign context
- excluded as unconfigured: Google Ads, Meta, LinkedIn, Instagram, TikTok, and other paid-media main sources

The campaign/client/property access boundary, currency, reporting timezone, and completed-day cutoff were confirmed through authenticated production reads and production persistence.

## Query, Calculation, Persistence, And UI Trace

| Visible consumer | Frontend query | Server/calculation | Persistence | UI use |
| --- | --- | --- | --- | --- |
| KPI, Benchmark, freshness inputs | `GET /api/campaigns/:id/executive-summary` | campaign access guard; GA4 platform KPI/Benchmark selection; verified-current resolver; target classification | `kpis`, `benchmarks`, scoped GA4 state | KPI/Benchmark states, Risk Level, action eligibility, freshness warnings |
| Narrative, funnel, cards, source capabilities | `GET /api/campaigns/:id/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date` | shared campaign performance aggregate; current window; financial source reconciliation; conditional snapshot upsert | campaign, GA4 connection/daily metrics, active revenue/spend definitions and records, `metric_snapshots` | narrative, all funnel stages, five cards, Risk Level, action evidence |
| Seven-day trajectory | `GET /api/campaigns/:id/executive-summary/trajectory?reportingDate=YYYY-MM-DD` | exact date and exact seven-day comparison through `evaluateExecutiveSummaryTrajectory` | `metric_snapshots` where `snapshot_type='executive_summary_daily'` | trajectory or an explicit unavailable reason |

The retained `executiveFinancialScope=campaign_to_date` request value is a backward-compatible API name only. Current native GA4 values start at the saved initial-import date; imported Revenue and Spend include every available mapped record.

All three production endpoints returned `200`. The combined authenticated page rendered from the deployed bundle at the certified SHA. Final read-only page validation rewrote only `captureExecutiveSnapshot=1` to `0` in the browser request so the audit itself did not mutate production.

Required query failures fail closed to the page-level `Unable to Load Executive Summary` state. Outcome and trajectory transport failures remain React Query errors; an HTTP failure cannot silently render cached-looking zero metrics.

## 1. Seven-Day Snapshot Trajectory

### Current Production Result

- displayed state: `Not enough history`
- API availability: `false`
- API reason: `incompatible_history`
- current date: `2026-09-19`
- comparison date: `2026-09-12`
- visible explanation: earlier readings used different sources or reporting settings and cannot be compared safely
- Risk Level: `MEDIUM`, driven by current KPI exceptions; no high-severity freshness or negative-ROI factor was present
- narrative: factual saved-import native and all-mapped-record imported wording, current ROI/ROAS, current risk classification, and explicit lack of compatible trajectory history

The unavailable trajectory is correct. The new current snapshot includes configuration-aware source identity, while the older comparison snapshot predates that compatible identity. The application did not combine the two.

### Snapshot Identity And Persistence

- schema: `executive_summary_daily_snapshot_v2`
- row ID: `d9c2a28a-c621-4781-8616-af1ad189a1f5`
- reporting date: `2026-09-19`
- database `recorded_at`: `2026-09-20 21:25:33.9279`
- uniqueness: one Executive Summary daily row per campaign/reporting date
- identity dimensions: campaign, currency, property, campaign filter, aggregate version, initial-import start, reporting timezone, connected main-source capabilities, and exact persisted financial-source configuration identities

Exact source signature:

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

Configuration fingerprints exclude refresh-only operational metadata but change for an in-place mapping/configuration change. Duplicate display labels do not collapse distinct persisted IDs.

### State Coverage

| State | Result | Evidence |
| --- | --- | --- |
| compatible exact seven-day history | pass | pure evaluator regression proves an available accelerating result and exact percentage; direct branch trace confirms `>10%` accelerating, `<-10%` declining, otherwise stable |
| missing exact prior date | pass | deterministic `not_enough_history` regression |
| property/source/window/configuration mismatch | pass | deterministic `incompatible_history` regressions plus current exact production result |
| revenue unavailable or invalid denominator | pass | deterministic `revenue_history_unavailable` regression |
| current snapshot before completed-day GA4 refresh | pass | writer rejects capture until a persisted GA4 row proves refresh after the reporting-day close |
| page/API failure | pass | transport and required-data failures render the explicit page failure state |

Only the incompatible-history state was naturally live-observed on this date. Available trajectory logic is certified by the same pure production evaluator and deterministic inputs; it is not represented as a live two-point production observation.

## 2. Marketing Funnel Performance

### Exact Current Values

| Value | Authoritative current value | Rendered value |
| --- | ---: | ---: |
| Users | 2,821 | `2,821 Users` |
| Sessions | 2,819 | `2,819 Sessions` |
| Summary conversions | 363 | `363` |
| Conversion rate | `363 / 2,819 * 100 = 12.8769067045...%` | `12.88%` |
| Native GA4 revenue | USD 101,597.10 | contributor to Total Revenue |
| Imported connected revenue | USD 22,700.00 | contributor to Total Revenue |
| Total Revenue | USD 124,297.10 | `$124,297.10` |
| Spend | USD 2,759.75 | `$2,759.75` |
| ROAS | `124,297.10 / 2,759.75 = 45.0392608026...x` | `45.04x` |
| ROI | `(124,297.10 - 2,759.75) / 2,759.75 * 100 = 4,403.926080...%` | `4403.93%` |
| Financial conversions used by CPA | 462 | not a funnel card; independent certified financial input |
| CPA | `2,759.75 / 462 = 5.973484848...` | aggregate/snapshot `5.97` where consumed |

CPA intentionally uses the conversions paired with the selected native GA4 financial candidate. It does not substitute the Summary Conversions value. This distinction was checked against the exact deployed response.

### Funnel And Five Cards

- live funnel path: `Users -> Sessions -> Conversions -> Revenue`
- top stage: Users with GA4 provenance
- middle stage: Sessions with GA4 provenance
- bottom stage: Summary Conversions, Total Revenue, ROAS, and ROI
- cards: Total Revenue/ROI, Return on Ad Spend/Spend, Total Conversions/CVR, Sessions/source, Users/source
- `Sources: ga4` rendered for web metrics
- CTR was unavailable and did not render as available
- Engagement Rate was absent from the final aggregate and was conditionally withheld

Valid zero remains available where source availability is proven. Missing, non-finite, unsupported, or denominator-blocked values remain unavailable rather than becoming zero. Currency formatting fails closed without a valid campaign ISO currency. Source capability rows distinguish web analytics, financial children, and paid media; the GA4-only source mix does not invent clicks, impressions, CTR, CPC, CPM, or paid-media recommendations.

## 3. KPIs And Benchmarks

### Current Production Result

- eight GA4 KPI rows refreshed successfully
- two GA4 Benchmark rows refreshed successfully
- page state: `KPIs Needing Attention`
- page state: `No Benchmark Exceptions`
- stale freshness alert: absent
- Risk Level propagation: current KPI exceptions contribute `MEDIUM`; the no-exception Benchmark state does not add risk
- action propagation: only eligible conversion/revenue/outcome target exceptions can create the website-outcome action

Eligibility requires a finite available current value, a positive target, supported metric identity, verified current source state, and applicable reporting window. Valid zero is preserved. Null, blank, malformed, stale, unverified, unsupported, or refresh-failed inputs are excluded from scoring.

Target direction uses the shared policy:

- higher-is-better metrics use normal attainment direction
- CPA and other recognized cost metrics use lower-is-better direction
- Benchmark `needs_attention` is monitor-only for Risk Level unless another risk factor applies
- Benchmark `behind` and KPI `below` propagate to risk only after eligibility succeeds

Exception, no-exception, unavailable, valid-zero, malformed, stale, target-direction, and downstream risk/action branches are covered by focused regressions. The current live campaign supplies the KPI-exception and Benchmark-no-exception states; alternate states were not fabricated in production.

## 4. Recommended Actions

Current production result:

- one evidence-backed action: `Investigate below-target website outcomes`
- scope notice: limited to connected web analytics, outcome metrics, and configured targets
- evidence: current Users, Sessions, Summary Conversions, Total Revenue, and CVR
- target context: eligible conversion/revenue/outcome KPI/Benchmark classifications only
- wording: investigate and inspect; it does not claim that any observed metric caused another
- paid-media budget or allocation claim: absent
- freshness alert: absent because the authoritative completed-day GA4 state is current

Recommendations fail closed when web/outcome evidence or eligible target exceptions are absent. Evidence and target lines are deduplicated and deterministically ordered. Freshness warnings are independently deduplicated and ordered. Stale/unverified evidence cannot create a recommendation, and one connected paid source cannot create comparative reallocation advice.

## Combined Page Result

The deployed page passed as one combined surface:

- all required queries completed successfully
- exact campaign, property, currency, timezone, window, and data-through identity matched
- trajectory and Risk Level did not contradict the narrative
- funnel totals, formulas, five cards, source labels, conditional omissions, KPI/Benchmark states, and action state agreed with the API contracts
- background refetch wiring remains mount/focus/60-second active-page refresh
- required-query failures fail closed
- the final read-only check left the certified snapshot fingerprint unchanged

## Controlled Runtime Evidence

The initial read-only inspection found that persisted GA4 rows had not yet crossed the completed-day snapshot guard. With explicit user authorization, one existing campaign-scoped validator was run:

- trigger: manual
- campaign scope: only the certified campaign
- alerts: suppressed
- Google Ads: inactive/excluded
- GA4 row count: 17 before and 17 after
- run status: success
- run finished: `2026-09-20T21:23:44.644Z`
- KPI IDs updated: eight
- Benchmark IDs updated: two
- failed/skipped target IDs: none

One exact snapshot upsert was then performed for `2026-09-19`. Unrelated campaign snapshots and other target dates remained unchanged. Subsequent page/API checks used capture-disabled reads.

Exact scheduler state after validation:

- GA4 daily schedule: `22:30 UTC`
- `runOnStartup=false`
- timer armed: true
- next completed data-through date: `2026-09-19`
- last run trigger/status: `manual` / `success`

Scheduler implementation and permanent configuration were unchanged from the applicable upstream evidence, so the existing natural-timer evidence was reused as instructed. This certificate does not claim that a new natural `22:30 UTC` firing was observed during this audit.

## Validation Record

- focused Executive Summary and shared evaluator regressions: 18 unique suites, 149 unique tests, all passed
- TypeScript validation: passed
- production build: passed once
- `git diff --check`: passed for the implementation diff
- deployed health: exact SHA passed
- deployed scheduler health: passed
- authenticated production API checks: all three Executive Summary queries returned `200`
- authenticated combined-page structural/state check: passed
- authenticated numeric UI parity check: passed
- campaign-scoped semantic persistence isolation: passed
- temporary validation scripts and Clerk sessions: removed/revoked

The implementation commit is `88a4cbb5a3ffb7ae44f17d81e6fe85ede33ea422` (`fix: harden campaign executive summary`). It contains the localized Executive Summary fixes and new isolated regressions. Existing certified contracts, readiness documents, and certified tests were not changed.

## Reused Upstream Evidence

Full GA4 provider and financial-source family audits were not repeated. Their evidence was reused only for the source-selection, property, currency, financial-conversion, and scheduler contracts that remained unchanged. This audit independently rechecked the values and downstream Executive Summary behavior consumed at the exact deployed SHA.

The Executive Summary changes did not alter GA4 provider queries, revenue/spend source lifecycle logic, the selected financial-candidate precedence, campaign currency rules, or scheduler configuration.

## Exclusions And Standing Gates

Excluded from this certificate:

- other campaigns, properties, tenants, currencies, or reporting timezones
- future or currently unconfigured paid-media source mixes
- source add/edit/delete lifecycle certification for GA4, revenue providers, and spend providers
- Campaign DeepDive sections outside Executive Summary
- Custom Reports, browser/PDF exports, scheduled reports, email acceptance/delivery, and inbox receipt
- obsolete campaigns and their scheduler behavior

Remaining gates within the exact certified boundary: **none**.

Standing future gates:

1. A new/refined main source must independently prove source capabilities, identity, aggregation, scheduler snapshot parity, KPI/Benchmark mapping, risk/action eligibility, and deployed source-mix behavior before this certificate can be extended to it.
2. A naturally available production seven-day trajectory may be recorded after two exact compatible snapshots exist. Until then, the available branch is deterministic evaluator evidence, not a claimed live observation.
3. The next natural `22:30 UTC` run is operational monitoring evidence, not a blocker because scheduler implementation/configuration were unchanged and exact-runtime manual execution succeeded.

Subject only to these explicit exclusions and future-extension gates, Campaign DeepDive → Executive Summary is clean-certified for the exact runtime and production boundary recorded above.
