# GA4 Overview Benchmarks Certification — 2026-09-15

## Controlling Decision

<!-- ga4-benchmarks-certification-status: PRODUCTION_READY -->

**Status: CLEAN-CERTIFIED / PRODUCTION_READY for the GA4 Benchmarks section only, for application behavior at runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d` and the exact dependency boundary below. Evidence-only revision `d3d1cfa0c0b34a44b405a74d8970c1d9ac9c1e7f` was subsequently deployed and confirmed healthy without changing that behavior.**

Certification was completed on 2026-09-16 after the forward duplicate-history fix was deployed, concurrently verified, existing duplicate history was cleaned within its proven boundary, and the full authenticated post-cleanup lifecycle passed.

This file does not certify GA4 Overview as a whole. Overview is a read-only upstream dependency. GA4 KPIs, Landing Pages, Conversion Events, Ad Comparison, Insights, Reports as a standalone section, and every other platform/section are excluded and were not modified or recertified. Only the Benchmark row and document register in `APP_PRODUCTION_READINESS.md` were later aligned to this certificate.

## Certified Scope

- GA4 Benchmark add, list, edit, delete, target, metric, unit, period, category, performance classification, and alert configuration for the current active-row UI lifecycle.
- Active-definition duplicate inventory and automatic-history idempotency. The deployed active inventory had zero exact-duplicate definition groups; logical uniqueness of user-created definitions is not enforced or claimed.
- Source-computed current values and user-managed custom current values.
- Count, percentage, ratio, and campaign-currency formatting.
- Ready zero, unavailable, stale/last-good, loading, blocked, and insufficient-data behavior.
- Manual refresh, scheduled recomputation, report preflight recomputation, completed-day boundaries, selected property, and source/currency scope.
- Benchmark cards/tracker, analytics/history, alerts/Notifications, Insights conclusions, Executive Summary comparisons, browser/server report consumers, and snapshots within the documented report boundary.
- Campaign, client, owner, property, platform, and report isolation.
- Exact forward-history concurrency safety and the completed cleanup of the two previously duplicated logical history points.

Custom Benchmark values are saved user values and are not represented as GA4-calculated metrics. Industry recommendations are not certified as target data; the saved `benchmarkValue` remains authoritative.

## Explicit Overview Dependency Boundary

The controlling upstream manifest is `GA4/OVERVIEW_BENCHMARKS_DEPENDENCY_MANIFEST_2026-09-15.md`.

It enumerates every Overview-facing campaign/connection field, API field, date window, source precedence, freshness state, currency rule, zero/unavailable distinction, formula input, recompute rule, and downstream consumer used by Benchmarks.

- A future change outside that manifest does not automatically invalidate this certificate.
- A shared-file change requires symbol/contract impact analysis, not automatic whole-file invalidation.
- A change to a manifested field, semantic, window, freshness rule, currency rule, source selector, scope boundary, formula, lifecycle path, alert path, or consumer requires proportionate Benchmark revalidation.
- An upstream mismatch blocks the affected Benchmark path and must not be repaired by modifying or recertifying Overview under this certificate.

## Exact Current-Value Contract

| Benchmark identity | Current-value contract | Required certified state |
|---|---|---|
| Users | GA4 traffic users | selected-property traffic ready |
| Sessions | GA4 traffic sessions | selected-property traffic ready |
| Pageviews | GA4 traffic pageviews | selected-property traffic ready |
| Conversions | GA4 traffic conversions | selected-property traffic ready |
| Conversion rate | `traffic conversions / traffic sessions * 100` | traffic ready; sessions positive |
| Engagement rate | normalized GA4 engagement ratio rendered as percent | traffic ready |
| Revenue | eligible native GA4 revenue plus campaign-scoped imported GA4 revenue | revenue ready and currency-compatible |
| ROAS | `financial revenue / spend` | revenue and spend ready; spend positive |
| ROI | `(financial revenue - spend) / spend * 100` | revenue and spend ready; spend positive |
| CPA | `spend / selected financial conversions` | spend and financial conversions ready; conversions positive |
| Custom | persisted user-entered current value | no automatic GA4 source claim |

Traffic uses the selected connection import start through the latest completed day in the campaign reporting time zone. Native financial data uses its manifested campaign-to-completed-day window. Imported revenue and spend retain their manifested source-to-date contracts. The current incomplete day is excluded.

Ready numeric zero is authoritative and must not fall through to another source. Missing, stale, malformed, currency-mismatched, or insufficient input must not be turned into a verified zero or a fresh status/alert/report conclusion.

## Target, Status, Unit, And Formatting Contract

- The saved `benchmarkValue` is the target. Missing, non-finite, or non-positive targets are unscored/insufficient.
- Status uses the shared metric-aware threshold/comparison helpers across cards, analytics, alerts, Executive Summary, Insights, and reports.
- Revenue and CPA use campaign ISO currency; legacy `$` display is normalized to that campaign currency.
- ROI, conversion rate, and engagement rate use `%`; ROAS uses `x`; traffic totals use whole-number count formatting; custom rows retain their saved unit.
- Currency/ratio output uses the shared two-decimal contract; counts use locale-aware whole-number formatting.
- Unavailable, stale, blocked, loading, failed, and insufficient rows cannot create a fresh scored conclusion.

## Baseline And Delta Review

- Historical Benchmark certificate/runtime baseline: `a96ba06e21c9344c1767c960e702ac4a647dc5f1`.
- Certified application-behavior runtime: `236afff993e60c5f9eaf75c42bca8b31b52f601d`.
- Subsequent deployed evidence-only revision: `d3d1cfa0c0b34a44b405a74d8970c1d9ac9c1e7f`; production health returned `200` and that revision changed no application behavior.
- The 188-commit delta through runtime `88e755a69cea84b83767535c0734f1` was reviewed before deployed validation.
- Direct Benchmark-impacting changes in that delta were limited to non-blocking modal pending/error restoration and the corrected CPA financial-conversion freshness/source selection plus valid-zero fallback behavior. Existing focused tests covered both.
- Core Benchmark metric identity, formulas, units, threshold math, scheduler selection, alert resolver, and report consumption were unchanged from the historical baseline.
- Commit `236afff993e60c5f9eaf75c42bca8b31b52f601d` changed only automatic Benchmark-history persistence behavior: reserved `auto:ga4_daily:` writes now serialize per Benchmark, check the exact logical note inside the same transaction, and return the existing row on a concurrent duplicate attempt.
- Manual history remains append-only. API response shapes, Benchmark calculation results, target meanings, units, ownership guards, and source contracts were not changed by the history fix.

Historical evidence was carried forward only for unchanged manifested paths. Changed paths received new focused and deployed evidence.

## Duplicate-History Root Cause And Resolution

The previous job performed a read/check/insert sequence without an atomic database guarantee. Two concurrent recomputes could both observe no same-date/same-scope history point and insert identical rows.

Resolution:

1. The forward path was changed to use a transaction-scoped PostgreSQL advisory lock per Benchmark and an exact duplicate lookup before insertion.
2. A concurrent unit regression proved two simultaneous identical writes store one logical row while manual history remains append-only.
3. Deployed authenticated verification sent two identical concurrent history requests. Both returned the same row identity and exactly one row existed.
4. A read-only cleanup dry run proved two duplicate groups, two rows per group, and semantic equality across every persisted field.
5. A separately authorized serializable transaction deleted exactly one redundant row from each pair and retained one deterministic canonical row per pair.
6. Independent read-only inventories after cleanup and after the full lifecycle found zero active-definition duplicates, zero history duplicates, and no temporary validation rows.

No unique history value was lost. No Benchmark definition or unrelated history row was changed.

## Authenticated Production Evidence

Validation ran against exact deployed SHA `236afff993e60c5f9eaf75c42bca8b31b52f601d`, one exact owner/client/campaign, one selected GA4 property, provider method `access_token`, and campaign currency USD. Identifiers were emitted only as hashes.

- Two existing active GA4 Benchmarks reconciled against the live provider.
- Provider/persisted/scheduler/UI mismatch count: 0.
- Two Executive Summary Benchmark rows matched current value, target, unit, and shared status classification.
- Temporary zero-current Benchmark create, read, formatting, target/unit edit, status transition, delete, and child cleanup passed.
- Repeated alert reconciliation produced one visible alert, and resolving the temporary breach removed its visible notification.
- Same-owner cross-client list isolation passed.
- Cross-owner list/edit/delete returned non-enumerating denial and did not mutate the row.
- Manual campaign scheduler completed successfully and reconciled alerts.
- The read-only downstream audit found two campaigns, four Benchmarks, zero failures, and exact cards/tracker/Insights/alerts/report consumption.
- Temporary Benchmark, history, visible-notification, Clerk-user, and authentication-session cleanup passed.
- Final inventory returned to the original active-definition boundary.

## Required Lifecycle Matrix

| Required path | Evidence | Result |
|---|---|---|
| Add/create | Authenticated temporary custom Benchmark with zero current value | Passed |
| Edit/update | Current value, target, unit, and alert reconciliation | Passed |
| Delete | Parent, history, and visible-notification cleanup | Passed |
| Definition duplicates | Deployed active-definition inventory | Passed for observed state; 0 groups. Duplicate-definition rejection is not implemented or claimed. |
| History duplicates | Concurrent unit/deployed tests plus post-cleanup inventory | Passed; 0 groups |
| Current values | Live provider vs persisted/scheduler/UI comparison | Passed; 0 mismatches |
| Targets | Persistence, formatting, edit, and shared comparison | Passed |
| Units/formatting | USD deployed fixture plus deterministic count/percent/ratio/currency tests | Passed within stated evidence |
| Status classification | Shared helper parity across UI/Executive Summary/consumers | Passed |
| Ready zero | Deployed temporary zero-current card and deterministic source-zero tests | Passed |
| Unavailable/stale/loading/blocked/insufficient | Deterministic focused tests; no live source was damaged | Passed within stated evidence |
| Refresh/recompute | Manual scheduler, source/job tests, report preflight tests | Passed |
| Executive Snapshot/Summary | Exact deployed comparison rows and shared classification | Passed |
| Alerts/Notifications | Create, deduplicate, resolve, freshness eligibility, ownership | Passed |
| Ownership isolation | Same-owner other client and foreign owner | Passed |
| Reports and downstream consumers | Read-only deployed audit plus unchanged focused report paths | Passed within stated evidence |

## Validation Gates

- Direct persistence regression set: 17/17 tests passed.
- Widened GA4 Benchmark/job/alert regression set: 18 files, 130/130 tests passed.
- Earlier 28-file focused packet: every Benchmark-focused assertion passed; 10 failures were confined to unrelated stale Instagram/Google Ads source-shape assertions.
- TypeScript: `npm run check` passed after each validator/fix stage.
- Production build: `npm run build` passed with 3,471 modules transformed.
- Deployed forward concurrency validation: passed.
- Authorized exact cleanup and independent post-cleanup inventory: passed.
- Authenticated post-cleanup lifecycle/value reconciliation: passed.
- Final current-version suite: 2,029 executed; 1,985 passed; 42 declared deferred future-platform failures remained visible; 2 additional KPI/readiness-only failures remained visible and are documented below; 0 Benchmark-relevant failures.

## Visible Out-Of-Scope Boundary Failures

The final repository-wide suite still reports these two failures:

1. `server/app-production-readiness-ledger.test.ts` expects GA4 KPIs to be `UNVERIFIED`, while the ledger already records them as `CERTIFIED`.
2. `server/ga4-kpi-certification-gate.test.ts` detects a whole-file `server/storage.ts` hash change in the separate KPI certificate. The only relevant current delta in that shared file is the Benchmark-history method above; production callers are the Benchmark job/history route, not KPI paths.

These failures are explained, visible, and outside the explicit Benchmark dependency boundary. They are not counted as passes and do not certify KPIs or the application ledger. No KPI or ledger artifact was changed to suppress them.

## Evidence Limits

- The live fixture proves the populated selected-property/USD configuration exercised above. Other currencies and source combinations rely on deterministic focused coverage and require impact analysis when their manifested contracts change.
- The current GA4 UI writes active rows and hard-deletes them. The list API itself does not filter `status`, and archived/draft rows created outside the current UI were not exercised.
- The API and database do not enforce logical uniqueness for identical user-created Benchmark definitions. Certification proves the deployed active inventory was clean, not that a repeated identical definition will be rejected.
- Zero formatting/status was exercised live. Unavailable, stale, provider-failure, malformed-input, and write-failure states were exercised deterministically rather than by damaging the production source.
- The manual scheduler path was exercised live; a natural timer firing was not observed during this audit.
- Benchmark cards, tracker, Insights, alerts, Executive Summary, and report consumers were reconciled. No report email was sent during this recertification.
- Alert email regression coverage passed, and unchanged historical provider evidence carries forward. Provider acceptance is not inbox delivery; current inbox receipt is not claimed.
- The certificate applies to the exact runtime, manifested contracts, and stated evidence. It is not a claim about future provider behavior, different unreviewed configurations, or excluded sections.

## Repository Actions

- Certified deployed runtime: `236afff993e60c5f9eaf75c42bca8b31b52f601d`.
- Historical baseline retained: `a96ba06e21c9344c1767c960e702ac4a647dc5f1`.
- Forward history fix commit: `236afff993e60c5f9eaf75c42bca8b31b52f601d`.
- Evidence/certificate commit deployed healthy: `d3d1cfa0c0b34a44b405a74d8970c1d9ac9c1e7f`.
- Production cleanup removed only the two proven semantically identical redundant history rows and retained both canonical rows.
- GA4 Overview, KPIs, Landing Pages, all other product sections, and the historical machine certificate were not modified or recertified. The Benchmark row and document register in `APP_PRODUCTION_READINESS.md` were later aligned to this controlling certificate; its KPI entry was not changed.
- The follow-up evidence commit contains only this certification documentation and validation tooling; it does not change the certified application behavior introduced at runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d`.
