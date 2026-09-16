# GA4 Overview KPIs Certification — 2026-09-15

## Controlling Decision

<!-- ga4-kpi-certification-status: PRODUCTION_READY -->

**Status: CLEAN-CERTIFIED / PRODUCTION_READY for the GA4 KPIs section only, at deployed application runtime `f7afeb2b98a56a3387156a3d7b9b99d5128a2980` and the exact dependency boundary below.**

This dated file is the controlling certificate for this KPI validation. It does not certify GA4 Overview as a whole. Overview is a read-only upstream dependency. Revenue, Spend, Performance, Campaign Breakdown, Conversion Events, Landing Pages, and every other GA4 section are excluded and were not modified or re-certified by this KPI revalidation. `APP_PRODUCTION_READINESS.md` is separate, is not a KPI dependency, and was not modified by this KPI revalidation.

## Certified Scope

- GA4 KPI add, read, edit, delete, target, operator, unit, alert configuration, and formatting contracts.
- Standard source-computed KPI values and saved custom KPI values.
- Loading, zero, unavailable, stale/last-good, blocked, insufficient-data, and verified states.
- Exact campaign ownership, client isolation, selected-property/campaign scope, and cross-owner denial.
- Duplicate prevention on create and edit, including canonical aliases; cross-campaign independence.
- API, persistence, recomputation, scheduler, cards, KPI Executive Snapshot tracker, alerts/Notifications, Insights, browser PDF, and server report consumers.
- Failure preservation: invalid edits do not persist; standard current values cannot be overwritten by browser input; source/recompute failures retain last-good values without treating them as verified.

Custom KPI values are user-supplied saved values and are not represented as GA4-calculated metrics. Unsupported metric identities are preserved rather than guessed.

## Exact KPI Calculation Contract

| KPI identity | Exact source input | Calculation | Required state/window |
|---|---|---|---|
| `users` | `ga4-daily.overviewTotals.users` | rounded count | Initial import through latest completed campaign-timezone day |
| `sessions` | `ga4-daily.overviewTotals.sessions` | rounded count | Same traffic window |
| `pageviews` | `ga4-daily.overviewTotals.pageviews` | rounded count | Same traffic window |
| `conversions` | `ga4-daily.overviewTotals.conversions` | rounded count | Same traffic window |
| `conversion_rate` | the same conversions and sessions | `conversions / sessions * 100` | Sessions must be sufficient; percentage |
| `engagement_rate` | `ga4-daily.overviewTotals.engagementRate` | normalize ratio to percent, then 2 decimals | Same traffic window; weighted upstream aggregate |
| `revenue` | selected native GA4 revenue plus campaign-scoped imported revenue | `nativeRevenue + importedRevenue` | Campaign/source-to-date inputs; campaign currency must reconcile |
| `roas` | certified revenue and campaign-scoped spend | `revenue / spend` | Spend must be available and positive; ratio |
| `roi` | certified revenue and campaign-scoped spend | `(revenue - spend) / spend * 100` | Spend must be available and positive; percentage |
| `cpa` | campaign-scoped spend and conversions from the fixed financial-source selection | `spend / conversions` | Spend and conversions must be available and conversions positive; campaign currency |
| custom/unsupported | persisted `currentValue` | no automatic GA4 calculation | Saved custom value; no standard GA4 window claim |

Standard identities and legacy aliases resolve through one canonical metric identity before calculation, duplicate checks, thresholds, alerts, Insights, and reports. Valid source-backed zero is authoritative. Missing, stale, malformed, currency-mismatched, or insufficient input is not silently converted into a verified zero.

## Explicit Overview Dependency Manifest

Only the following upstream fields and behaviors are consumed by KPIs. A future GA4 change outside this manifest does not automatically invalidate this certificate; it requires impact analysis first.

| Upstream contract | Exact consumed fields/behavior | KPI use |
|---|---|---|
| Campaign row | `id`, `ownerId`, `clientId`, `currency`, `reportingTimeZone`, saved GA4 campaign filter | ownership, tenant boundary, currency, completed-day boundary, campaign scope |
| Active GA4 connection | `campaignId`, selected `propertyId`, active/connected state, primary selection, `importStartDate`, saved selected campaign values | exact property/campaign scope and traffic start date; no property-wide fallback |
| `GET /api/ga4/check-connection/:campaignId` and campaign connection list | connected/usable state and selected property identity | fail-closed availability and selected-property binding |
| `GET /api/campaigns/:id/ga4-daily?days=30&propertyId=...` | `overviewTotals.users`, `.sessions`, `.pageviews`, `.conversions`, `.revenue`, `.engagementRate`; `overviewStartDate`, `dataThroughDate`/`endDate`, `propertyId`, `refreshIsStale`; fallback `data[].date/users/sessions/pageviews/conversions/revenue/engagedSessions` only when the `overviewTotals` property is absent | primary traffic/rate values, freshness, reporting boundary, deterministic legacy fallback |
| persisted GA4 daily rows | exact campaign + selected property + date; `users`, `sessions`, `pageviews`, `conversions`, `revenue`, `engagedSessions` | scheduler recomputation; engagement is weighted from engaged sessions and sessions |
| `GET /api/campaigns/:id/ga4-to-date?propertyId=...&insightsScope=1` | `totals.revenue`, `totals.conversions`, `totals.sessions`, `totals.users`, `currencyCode`, `revenueMetric`, `startDate`, `endDate`, `noCompletedWindow` | preferred native financial revenue/conversion candidate, currency verification, sufficiency/window state |
| `GET /api/campaigns/:id/ga4-breakdown?window=import-to-date&propertyId=...&overviewCampaignBreakdown=1` | exact saved property/campaign scope, response availability (including the upstream campaign-row `sessionKeyEventRate` validation), and `totals.revenue/conversions/sessions/users` only as the fixed lower-priority native financial fallback | native financial fallback and failure state; KPI math does not consume the campaign-row rate or replace the primary traffic total |
| revenue-to-date contract | `totalRevenue`, `sourceIds`, `currency`, `startDate`, `endDate`, success/failure | imported revenue contribution and window |
| revenue-source contract | active campaign-scoped `id/sourceId`, `status`, `sourceType`, `platformType`, `currency`, `displayName` | source existence, scope, labels, and valid-zero availability |
| revenue-breakdown contract | response success/failure, scoped sources/source IDs, total/currency | source reconciliation and stale/unavailable state |
| spend-to-date contract | `spendToDate`, `sourceIds`, `currency`, `startDate`, `endDate`, success/failure | spend fallback, source/window proof |
| spend-source contract | active campaign-scoped `id/sourceId`, `status`, `sourceType`, `platformType`, `currency`, `displayName` | source existence, scope, labels, and valid-zero availability |
| spend-breakdown contract | `totalSpend`, scoped sources/source IDs, currency, success/failure | preferred spend value and stale/unavailable state |
| selected financial-source rule | fixed candidate precedence; exact campaign/property/source scope; valid zero is authoritative; unavailable is distinct from zero | Revenue, ROAS, ROI, CPA parity across browser and persisted recompute |
| freshness contract | query loading/error/placeholder state, `refreshIsStale`, provider coverage-through date, latest completed reporting day | verified vs loading/unavailable/stale status; alert and report eligibility |

No other Overview display value, table row, chart, attribution presentation, or Overview certification status is consumed as KPI certification evidence.

### September 16 current-revision impact analysis

Twenty-three commits follow the `6ea70599` KPI documentation baseline. The net comparison to deployed `f7afeb2b` changes 12 recorded dependency files; unchanged dependencies retain their exact prior hashes. Each changed dependency was reviewed, not automatically treated as a KPI regression:

| Changed dependency | KPI impact and current proof |
|---|---|
| `GA4/README.md`, `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`, `GA4/BENCHMARKS.md`, `GA4/BENCHMARKS_PRODUCTION_READINESS.md` | Section-status/copy changes only; no KPI input or runtime contract change. The `f7afeb2b` README edit is Ad Comparison status copy and does not recertify Ad Comparison or Overview. |
| `server/ga4-kpi-real-path-parity-regression.test.ts`, `server/ga4-filter.test.ts` | Test changes strengthen exact import-to-date scope, fractional conversion, campaign-row rate, and provider-quota guards; no production transformation is changed by these files. |
| `client/src/pages/ga4-metrics.tsx` | Ad Comparison query/chart/PDF/configuration changes share the page, but KPI CRUD, card value resolver, tracker, and KPI-only browser-PDF branches are unchanged. Exact-deployed browser KPI parity passed. |
| `server/routes-oauth.ts` | The import-to-date breakdown now requires exact selected property and saved campaign scope before provider work; the new Ad Comparison branch is separate. The KPI-consumed Overview breakdown branch remains scoped and returns its native financial totals or fails closed. Route/ownership and deployed input checks passed. |
| `server/storage.ts` | Change is confined to automatic Benchmark-history idempotency; KPI persistence and delete contracts are unchanged. |
| `server/analytics.ts`, `shared/ga4-traffic-window.ts` | The Overview-preferred campaign breakdown now requests/validates `sessionKeyEventRate`, preserves fractional conversion credit, and weights the row rate. KPI traffic still uses persisted daily `overviewTotals`; the breakdown remains only a lower-priority financial fallback. Invalid rate/quota fails closed, and provider/fallback regressions plus exact deployed response availability passed. |
| `server/ga4-scheduled-report-pdf.ts` | Ad Comparison report inputs/formatting changed within the shared builder; KPI selection, recompute preflight, and KPI row rendering are unchanged. Exact-deployed KPI browser PDF and focused server-report/failure regressions passed. No live scheduled delivery is claimed. |

No current KPI value, formula, ownership, lifecycle, or selected-source mismatch was found. This impact result applies only to the recorded candidate; it does not certify the changed Overview or Ad Comparison sections.

## End-to-End Trace

| Layer | Proven contract |
|---|---|
| Calculation | Shared canonical identity and live-value math produce the same values in browser and server paths; target classification is metric-aware, including lower-is-better CPA. |
| API | GA4 platform KPI list/create/update/delete routes enforce campaign/KPI access and exact platform scope. Invalid configuration returns `400`; canonical duplicate create/edit returns `409`; foreign access returns non-enumerating `404`. |
| Persistence | KPI target/unit/operator/alert fields persist exactly. Recompute writes source-computed current values and progress only after validated input. Delete atomically removes KPI progress, alerts, and periods. |
| UI | Cards show exact current/target formatting by count, percent, ratio, or campaign currency. Only verified values are scored/pulsed; unavailable or blocked values render `—`; stale values remain explicitly last-good/unverified. |
| Refresh/recompute | Initial/focus/reconnect/interval browser queries refresh inputs. Source lifecycle, on-demand refresh, daily scheduler, and report preflight share campaign-scoped recomputation and exact updated/skipped/failed identities. |
| KPI Executive Snapshot | Total, Above Target, On Track, Below Target, and bounded Average Progress are derived from the same eligible KPI rows and shared classification policy as the cards. |
| Alerts/Notifications | Alert evaluation occurs only after current source coverage and recompute are proven. Duplicate alerts are prevented; latest persisted breached values and card values reconcile. Dismissal visibility remains separate from the underlying breach. |
| Insights | KPI target findings use the same current values, sufficiency state, direction, and absolute target-window contract. |
| Reports | Browser KPI PDF uses the same page resolver/state. Server snapshot, test-send, manual, and scheduled report preflights require exact successful KPI recompute and preserve selected KPI identity/state. |

## September 16 Current-Boundary Production Evidence

Authenticated lifecycle and read-only consumer validation passed against exact deployed SHA `f7afeb2b98a56a3387156a3d7b9b99d5128a2980`, the same eight-KPI owner/client/campaign, property `542352127`, `Europe/Amsterdam`, and USD. All eight card values/targets/states/alert pulses matched their exact inputs. The KPI Executive Snapshot, both visible breached notifications, all eight KPI-related Insights findings, and a temporary browser KPI PDF matched. Duplicate create/edit, invalid and partial edits, source-computed-value protection, cross-client/cross-owner denial, create/read/edit/delete, manual scheduler recompute, alert reconciliation, and temporary-record cleanup passed. The read-only phase made no application mutation. Final inventory was 16 active canonical rows, zero inactive rows, and zero duplicate groups.

Current financial inputs for this fixture were native GA4 revenue `89299.30`, imported revenue `22700.00`, total revenue `111999.30`, spend `2759.75`, and financial conversions `407`. These reconcile KPI inputs only; they do not certify the whole Overview. The live fixture proves populated/verified values. Zero, stale/last-good, unavailable, malformed, provider-failure, and write-failure branches remain deterministic-test evidence; natural timer firing, alert/report email delivery, inbox receipt, and live scheduled-report delivery are not claimed.

## September 16 Current-Boundary Validation Gates

- Focused KPI and changed-shared-path packet: 15 files, 354 tests passed, 0 failed.
- Current-version suite: 2,041 tests executed; 2,000 passed, 41 declared deferred/external failures remained visible, and 0 blocking current-version failures remained.
- `npm run check`, `npm run build`, and the KPI certification integrity gate passed.
- Exact-`f7afeb2b` authenticated deployed lifecycle, scheduler, KPI inputs, browser consumers, and post-cleanup inventory passed as bounded above.

The 41 deferred/external failures are not counted as passes or certified. This is a KPI-only decision, not a whole-app or whole-Overview readiness claim.

## September 15 Baseline Production Evidence (historical)

Authenticated validation ran against deployed SHA `1c949dc9710f36b1760a3fbf7253037236b52e00`, one exact owner/client/campaign, property `542352127`, campaign timezone `Europe/Amsterdam`, and currency `USD`. Identifiers are recorded only as hashes in validator output.

- 8 configured GA4 KPI cards matched their exact API inputs, calculations, targets, units, state labels, and alert pulse state.
- The KPI Executive Snapshot matched those same 8 rows exactly.
- Notifications and both active breached-alert values matched the current cards exactly.
- All 8 KPI-related Insights findings matched the same current values and target evaluation.
- A temporary authenticated KPI report proved exact browser-PDF parity and was deleted automatically.
- The manual campaign scheduler completed with `trigger=manual`, `lastRunStatus=success`, followed by successful alert reconciliation.
- Authorized lifecycle proof passed duplicate create, create/read/edit/delete, invalid edit preservation, partial edit preservation, duplicate edit rejection, standard current-value overwrite prevention, cross-client isolation, and cross-owner read/edit/delete denial.
- Temporary KPI child counts for KPI, progress, alerts, and periods were all zero after delete. The temporary authentication user, sessions, KPI, and report were cleaned up.
- The read-only consumer audit left the application persistence fingerprint unchanged.
- Post-validation production inventory: 16 active canonical GA4 KPI rows, 0 inactive rows, 0 duplicate groups, 0 excess rows; cleanup was not needed.

Production financial reconciliation for this fixture used native GA4 revenue `86178.30`, imported revenue `22700.00`, total revenue `108878.30`, spend `2759.75`, and financial conversions `394`. The eight saved card outputs were independently checked against their applicable inputs; no unrelated Overview value was certified by that reconciliation.

## September 15 Baseline Validation Gates (historical)

- Focused KPI/API/persistence/scheduler/UI/alert/report/certification packet: 11 files, 165 tests passed, 0 failed.
- Current-version suite: 2,025 tests executed; 1,983 passed; 42 declared deferred/external failures remained visible; 0 blocking current-version failures.
- TypeScript: `npm run check` passed.
- Production build: `npm run build` passed.
- KPI certification integrity checker: passed in its pre-certificate internally consistent state.
- Authenticated deployed lifecycle and consumer validation: passed.
- Read-only post-cleanup duplicate inventory: passed.

The 42 deferred/external failures are not counted as passes or certified. They cover separate repository work, including the independently maintained application-readiness ledger and future/non-KPI platform work.

## Evidence Limits

- The production fixture proves the current populated/verified state. Zero, unavailable, stale/last-good, blocked, insufficient-data, malformed-input, provider-failure, and write-failure branches are proven by focused deterministic tests, not by damaging or disabling the live source.
- The exact manual scheduler path was exercised in production; a natural timer firing was not observed during this audit.
- Browser KPI PDF was exercised in production. Server snapshot/test-send/scheduled-report propagation is proven by focused tests because invoking those paths would create durable artifacts or external delivery side effects.
- Alert records and Notifications were reconciled in production. No alert email or report email was sent, and provider delivery or inbox receipt is not claimed.
- Certification applies to the exact runtime and dependency manifest above. It is not a claim about future provider behavior, a different campaign/property configuration, or any excluded GA4 section.

## Future Change And Invalidation Rule

Future GA4 work must compare its changed fields, response semantics, source precedence, scopes, freshness rules, or consumers with the explicit manifest above.

- A change outside the manifest receives documented **no KPI impact** analysis and does not automatically invalidate this certificate.
- A change to a consumed field or contract requires focused KPI impact analysis and proportionate reruns.
- A semantic change to KPI calculation, scope, persistence, failure preservation, alert eligibility, Executive Snapshot, Insights, or report propagation invalidates the affected KPI path until it is re-proven.
- An upstream mismatch is a blocker and must be documented; it must not be repaired by modifying Overview under this certificate.

## Repository Actions

- Certified application runtime: `f7afeb2b98a56a3387156a3d7b9b99d5128a2980`; the earlier `1c949dc9710f36b1760a3fbf7253037236b52e00` evidence remains historical.
- This revalidation changed KPI statements in the shared status documents, KPI-only documentation/test guards, and the KPI certification record; it did not change KPI, Overview, Ad Comparison, or Benchmark application code.
- `APP_PRODUCTION_READINESS.md` and excluded GA4 section code/certificates were not modified by this KPI revalidation.
- No production cleanup or rewrite was required; only temporary validator-owned records were created and automatically removed.
