# GA4 Overview -> Benchmarks Dependency Manifest — 2026-09-15

## Status and purpose

- Manifest status: complete for the certified application behavior at runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d`.
- Certification status: **CLEAN-CERTIFIED / PRODUCTION_READY for GA4 Benchmarks only** for application behavior at runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d`. Evidence-only revision `d3d1cfa0c0b34a44b405a74d8970c1d9ac9c1e7f` was subsequently deployed and confirmed healthy; it did not change application behavior. The controlling certificate is `GA4/OVERVIEW_BENCHMARKs_CERTIFICATION_2026-09-15.md`; this manifest does not recertify GA4 Overview.
- Historical Benchmark baseline: runtime `a96ba06e21c9344c1767c960e702ac4a647dc5f1` and `GA4/certifications/ga4-benchmarks.json`.
- GA4 Overview is an upstream, read-only dependency. Its certification status is not changed by this manifest.
- This manifest defines the complete Overview-facing contract consumed by GA4 Benchmarks. A future change outside the entries below does not automatically invalidate Benchmark certification.

## Change-impact rule

A future delta invalidates or requires targeted revalidation of GA4 Benchmarks only when it changes one or more of the following:

1. a named API route, response field, persistence field, resolver, formula, window, freshness rule, currency rule, scope rule, or downstream consumer in this manifest;
2. the meaning, source precedence, zero/unavailable behavior, or access boundary of a manifested value; or
3. the timing or atomicity of Benchmark recomputation, history recording, alert evaluation, or report preflight.

A file-level change alone is not enough to invalidate certification. When a shared file changes, inspect the changed symbol and contract against this manifest. Layout, copy, or logic outside the manifested symbols does not automatically invalidate GA4 Benchmarks.

## Explicit exclusions

The following are outside this dependency boundary unless a future change also modifies a manifested contract:

- GA4 Landing Pages, Conversion Events, Ad Comparison, Audience, Technology, Geography, and row-level Campaign Breakdown presentation;
- Overview chart selection, table sorting/pagination, layout, copy, loading presentation, and visual styling;
- non-GA4 platform KPIs, Benchmarks, sources, alerts, and reports;
- GA4 KPI CRUD or KPI-only presentation paths that do not share a manifested resolver or source contract;
- industry-target lookup and recommendation content (`targetSourceCertified` remains false); and
- the campaign-detail legacy Performance Summary when it reads campaign-level rows rather than GA4 platform Benchmark rows.

## 1. Campaign, ownership, and selected-property contract

| Contract | Fields/rules consumed by Benchmarks |
|---|---|
| Campaign identity | `id`, `ownerId`, `clientId` |
| Reporting configuration | `currency`, `reportingTimeZone`, `ga4CampaignFilter`, `startDate`, `createdAt` |
| Campaign access | Every list, create, update, delete, analytics, history, recompute, alert, Executive Summary, and report operation must prove access to the campaign that owns the row. A row ID alone is not an authorization boundary. |
| GA4 connection discovery | `/api/ga4/check-connection/:campaignId` and `/api/campaigns/:id/ga4-connections` |
| Connection fields | `connected`, connection `id`, `propertyId`, `isPrimary`, `lookbackDays`, `importStartDate`, `method`, and active/usable state |
| Selected property | The Overview/Benchmark source is the active selected GA4 connection for the campaign. The property returned by data endpoints must equal that selected `propertyId`. Benchmark values must not broaden to another property in the same Google account. |
| Overview candidate | The GA4 page's Overview candidate is the selected connection configured for the Overview flow (currently the 30-day connection designation), while the actual accumulated value window is the import-to-date window below, not a rolling 30-day total. |

## 2. Benchmark API and persistence contract

| Contract | Required behavior |
|---|---|
| List | `GET /api/platforms/google_analytics/benchmarks?campaignId=<campaignId>` returns GA4 platform Benchmark rows belonging to the accessible campaign. The storage query does not independently filter `status`; the current GA4 UI creates and updates rows as `active` and hard-deletes them. Archived/draft direct-API rows were not exercised by this certification. |
| Create | `POST /api/benchmarks`; campaign and `platformType=google_analytics` are authoritative at creation. The current route and schema do not enforce logical uniqueness for otherwise identical definitions. Certification proved zero active exact-duplicate groups in the deployed inventory; it does not claim duplicate-definition rejection. |
| Update | `PUT /api/benchmarks/:id`; campaign and platform identity cannot be moved by the update payload. |
| Delete | `DELETE /api/platforms/google_analytics/benchmarks/:id`; deletion is campaign-access guarded and removes only the target Benchmark and its own child history. |
| Analytics/history | The existing Benchmark analytics and history routes remain row/campaign access guarded and retain their response shapes. |
| Benchmark fields | `id`, `campaignId`, `platformType`, `status`, `metric`, `name`, `description`, `category`, `benchmarkValue`, `currentValue`, `unit`, `benchmarkType`, `period`, `alertsEnabled`, `alertThreshold`, `alertCondition`, `alertFrequency`, `emailNotifications`, `emailRecipients`, `lastUpdated`, `createdAt`, `updatedAt` |
| Precision | Persisted `currentValue` and `benchmarkValue` use the schema's fixed decimal precision. Formatting is applied at the consumer; persisted numbers are not preformatted strings. |
| Logical history identity | One automatic history point per `(benchmarkId, reportingDate, historyScopeMarker)`. The scope marker includes selected property, campaign filter, reporting time zone, and currency. This identity must be atomic under concurrent recompute. |

## 3. Traffic Overview source contract

### API

`GET /api/campaigns/:id/ga4-daily?days=30&propertyId=<selectedPropertyId>`

The `days=30` query identifies the Overview connection path; it does not redefine the accumulated import-to-date value window.

### Fields consumed

- Top-level: `propertyId`, `overviewTotals`, `data`, `dataThroughDate`, `endDate`, `refreshIsStale`, `latestStoredDailyDate`, `providerCoverageThroughDate`, `lastCompletedRefreshAt`, `lastUpdated`, and endpoint error/placeholder state.
- `overviewTotals`: `users`, `sessions`, `pageviews`, `conversions`, `revenue`, `engagementRate`.
- `data[]` fallback, used only when the `overviewTotals` property is absent: `date`, `users`, `sessions`, `pageviews`, `conversions`, `revenue`, `engagedSessions`, `engagementRate`.
- Rows after `dataThroughDate` (or the endpoint's bounded `endDate` fallback) are excluded.

### Window

- Start: selected connection `importStartDate`.
- Legacy fallback when that date is absent: `GA4_OVERVIEW_LEGACY_IMPORT_START_DATE`, currently `2026-07-02`.
- End: latest completed calendar day in `campaign.reportingTimeZone`.
- Resolver: `resolveGA4ImportToDateWindow` in `server/utils/reporting-timezone.ts`.
- The current incomplete reporting day must not enter a Benchmark value.

### Values

- `users`, `sessions`, `pageviews`, and traffic `conversions` come from this contract.
- Engagement is normalized to a ratio at the source boundary (values over 1 are interpreted as percentages and divided by 100) and is rendered/classified as a percentage.
- A successful, usable response containing numeric zero is authoritative zero. It must not fall through to another source.

### Freshness

- Connection lookup initial failure with no last-good data: unavailable.
- Connection lookup failure with last-good data: stale.
- No selected/usable property: unavailable; an in-progress initial resolution may remain loading.
- Initial daily-data failure with no last-good data: unavailable.
- Daily-data failure with last-good data: stale.
- `refreshIsStale=true`: stale.
- Provider-placeholder or unresolved initial data: loading/unavailable according to the existing `resolveGA4KpiConsumerState` branch; it is never a valid numeric conclusion.
- A ready response requires the selected property and bounded date window to match.

## 4. Native GA4 financial source contract

### Primary API

`GET /api/campaigns/:id/ga4-to-date?propertyId=<selectedPropertyId>&insightsScope=1`

Fields consumed: `totals.revenue`, `totals.conversions`, `totals.sessions`, `totals.users`, `revenueMetric`, `currencyCode`, `startDate`, `endDate`, `noCompletedWindow`, and error/placeholder state.

### Bounded fallback API

`GET /api/campaigns/:id/ga4-breakdown?window=import-to-date&propertyId=<selectedPropertyId>&overviewCampaignBreakdown=1`

Only the aggregate fallback contract is in scope: `totals.sessions`, `totals.users`, `totals.conversions`, `totals.revenue`, and row fields needed to derive those totals when `totals` is absent. Row-level attribution and the rendered Campaign Breakdown table are excluded.

Current availability preconditions: import-to-date requests fail closed without an explicit selected property or saved campaign filter. Populated `overviewCampaignBreakdown=1` provider rows also require a finite `sessionKeyEventRate` between 0 and 1 when sessions are positive. Benchmarks do not calculate from that rate, but a missing/invalid rate makes this bounded breakdown fallback unavailable; it must not be treated as a verified financial zero. This was added by the shared Campaign Breakdown/Ad Comparison delta after the original Benchmark runtime.

### Window and precedence

- Native financial start: campaign `startDate`, falling back to `createdAt` under the existing route/job contract.
- End: latest completed calendar day in the campaign reporting time zone.
- Browser source selection is controlled by `selectGA4FinancialTotalsSource`.
- Browser precedence is verified GA4 to-date totals, then persisted daily-summed totals, then bounded breakdown totals only where the existing imported-revenue currency-verification rule permits the fallback.
- Background recompute is intentionally stricter: for a numeric live property it requires the campaign/property-scoped provider financial candidate and fails closed when that candidate is unavailable; only the explicit `yesop` mock path may use its persisted financial candidate. The job does not silently substitute the browser breakdown fallback.
- When imported revenue is present for a selected property, native revenue is admissible for addition only when the native currency is verified against the campaign currency. An unverified fallback must not be combined with imported revenue.
- `noCompletedWindow=true` is insufficient for metrics that require native financial data, unless an independently valid imported source supplies the required value under the existing selection rule.
- The financial conversion count used by CPA is the conversion value from the selected financial candidate. It must not silently use traffic-summary conversions.
- Financial conversion freshness is the freshness of that selected financial candidate.

## 5. Imported revenue contract

| API/storage contract | Fields/rules consumed |
|---|---|
| `GET /api/campaigns/:id/revenue-sources?platformContext=ga4` | `sources[]`: source `id`/`sourceId`, `sourceType`, `platformContext`, `isActive`, `currency`, `displayName`, and connection/source state. Only active GA4-scoped sources are eligible. |
| `GET /api/campaigns/:id/revenue-to-date?platformContext=ga4` | `success`, `totalRevenue`, `currency`, `sourceIds`, `endDate`, and error state. |
| Revenue breakdown/source presentation | May provide source provenance and a last-good aggregate only through the existing financial selector; it may not override a successful authoritative zero. |
| Background recompute | Existing storage aggregation through the latest completed reporting day, filtered to active GA4 platform context. |

Rules:

- Financial revenue is selected native GA4 revenue plus the active imported GA4 revenue total when both are currency-compatible.
- Pipeline Proxy is excluded from certified GA4 Benchmark revenue.
- A successful response with a known source set and `totalRevenue=0` is ready zero.
- Initial failure without last-good data is unavailable; failure with retained last-good data is stale.
- Loading or an unresolved source inventory is not ready zero.
- A source change must complete the applicable recompute before alert/report consumers rely on the new value.

## 6. Spend contract

| API/storage contract | Fields/rules consumed |
|---|---|
| `GET /api/campaigns/:id/spend-sources?platformContext=ga4` | Active GA4-scoped source identity, currency, and connection/source state. |
| `GET /api/campaigns/:id/spend-to-date?platformContext=ga4` | `spendToDate`, `currency`, `sourceIds`, `endDate`, success/error state. |
| Spend breakdown | `totalSpend`, source list/provenance, and error/loading state. |
| Background recompute | Existing storage aggregation through the latest completed reporting day, filtered to active GA4 platform context. |

Rules:

- UI selection uses nullish precedence: `spendBreakdown.totalSpend ?? spendToDate.spendToDate ?? 0`. Numeric zero must not fall through.
- No connected active spend source is unavailable/not connected for spend-dependent metrics; it is not an inferred zero-spend source.
- A connected, ready source with zero spend is valid zero, but ratios requiring a positive denominator remain insufficient.
- Initial failure without last-good data is unavailable; failure with last-good data is stale.

## 7. Currency contract

- `campaign.currency` is the authoritative ISO currency; the existing default is USD when the campaign value is absent.
- Native GA4, imported revenue, and spend values may be combined only when their source currency is verified as the campaign currency.
- No implicit foreign-exchange conversion is certified.
- Currency mismatch or missing required currency provenance makes the affected financial metric unavailable/insufficient; it must not produce a mixed-currency Benchmark value.
- Revenue and CPA use the campaign ISO currency for formatting. A legacy `$` unit is normalized to the campaign currency rather than treated as proof of USD source data.

## 8. Metric mapping, formulas, and required inputs

| Metric | Current-value contract | Required ready inputs |
|---|---|---|
| Users | traffic users | traffic |
| Sessions | traffic sessions | traffic |
| Pageviews | traffic pageviews | traffic |
| Conversions | traffic conversions | traffic |
| Conversion rate | `(traffic conversions / traffic sessions) * 100` | traffic and sessions `> 0` |
| Engagement rate | normalized engagement ratio rendered/classified as percent | traffic |
| Revenue | selected native revenue plus eligible imported revenue | revenue |
| ROAS | `financial revenue / spend` | revenue, spend, and spend `> 0` |
| ROI | `((financial revenue - spend) / spend) * 100` | revenue, spend, and spend `> 0` |
| CPA | `spend / financial conversions` | spend, financial conversions, and conversions `> 0` |
| Custom | persisted user-entered current value; no automatic GA4 recompute | no Overview source |

Additional rules:

- The user-entered target is `benchmarkValue`; it is not replaced by an industry recommendation.
- A target `<= 0`, non-finite target, or missing target is unscored/insufficient.
- Formula behavior is defined by `shared/ga4-kpi-live-value.ts`, `shared/ga4-kpi-metric-identity.ts`, `shared/kpi-math.ts`, and `shared/metric-math.ts`.

## 9. Status, unit, formatting, and unavailable-state contract

- Classification uses the shared threshold/comparison helpers and the Benchmark's comparison direction. The same helper semantics must be used by cards, analytics, alerts, Executive Summary, and reports.
- Units:
  - revenue and CPA: campaign ISO currency;
  - ROI, conversion rate, and engagement rate: `%`;
  - ROAS: ratio rendered with `x`;
  - users, sessions, pageviews, and conversions: `count`;
  - custom: the saved custom unit.
- Currency and ratio values render to two decimal places under the existing helpers; counts render as locale-aware whole numbers; percentages use the shared percentage formatting contract.
- Ready numeric zero is displayed as zero, not `N/A`, and is not replaced through truthiness fallback.
- Loading, unavailable, stale, failed, blocked, or insufficient source states must not create a fresh status conclusion, alert breach, Executive Summary comparison, insight conclusion, or report conclusion.
- Stale last-good values may remain visibly identified as stale, but must not be represented as current certified data.

## 10. Refresh, recompute, and history contract

- Automatic current-value calculation is performed by `server/ga4-kpi-benchmark-jobs.ts` with the same metric identities, formulas, scopes, and currency checks used by live consumers. Its live-property financial acquisition is deliberately stricter than the browser fallback chain, as documented in section 4.
- Traffic window: connection import start through the latest completed reporting day.
- Native financial window: campaign start/creation fallback through the latest completed reporting day.
- Imported revenue and spend aggregation retain their existing historical-start storage contract through that same completed-day boundary.
- The requested scheduler date may reduce the completed-day end boundary; it must never move the start before the manifested start date.
- Daily refresh, manual refresh/recompute, financial-source changes, report preflight, and scheduled refresh must preserve selected-property, campaign, time-zone, currency, and platform scope.
- Recompute writes `currentValue`/`lastUpdated`, then records at most one logical automatic history point for the manifested history identity.
- Alert evaluation must use the recomputed current value and the same freshness/sufficiency result.
- Failed or unavailable refreshes must fail closed and preserve provenance; they must not synthesize zero.

## 11. Downstream consumers in certification scope

| Consumer | Manifested dependency |
|---|---|
| GA4 Benchmark cards and tracker | Platform Benchmark list, live/persisted current value, target, unit, status, freshness, and history. |
| Benchmark analytics/history | Target/current comparison and scope-filtered history for the accessed Benchmark. |
| Alerts and notifications | Same current-value resolver, threshold direction, target, freshness, alert configuration, campaign/owner scope, deduplication/frequency, and action URL. |
| Insights | Benchmark-derived conclusions only when the manifested current value is ready and sufficient. |
| Executive Summary | `/api/campaigns/:id/executive-summary` GA4 `benchmarkComparison[]`: `metric`, `metricKey`, `yours`, `benchmark`, `unit`, `delta`, `status`, `category`; values remain campaign/platform scoped and use the shared comparison math. |
| Live/downloadable GA4 reports | Report preflight recompute plus GA4 platform Benchmark rows; Benchmark sections in Benchmark, Insights, and eligible Custom reports. |
| Scheduled reports | Same preflight, campaign/platform access, freshness, formulas, and unit contracts before snapshot/send. |
| Report snapshots | Benchmark identity/name/metric, current value, target, unit, status, and update timestamp remain tied to the valid report campaign/platform. |

## 12. Code anchors

These are anchors for impact analysis, not a rule that every edit to a listed file invalidates certification:

- `client/src/pages/ga4-metrics.tsx`: source selection, consumer freshness, modal CRUD wiring, current values, units, formatting, and GA4 report/browser consumers.
- `server/routes-oauth.ts`: GA4 daily/to-date/breakdown and source endpoints; Benchmark CRUD/list/analytics/history; Executive Summary; access checks.
- `server/ga4-kpi-benchmark-jobs.ts`: recompute, source selection, persistence, and automatic history.
- `server/ga4-daily-scheduler.ts`: refresh/recompute ordering and scheduled trigger.
- `server/benchmark-notifications.ts` and `server/utils/ga4-alert-current-value.ts`: alert current values, thresholds, freshness, and notification scope.
- `server/storage.ts` and `shared/schema.ts`: campaign-scoped persistence, delete behavior, precision, and history identity enforcement.
- `server/utils/reporting-timezone.ts`: completed-day and import-to-date window.
- `shared/ga4-kpi-live-value.ts`, `shared/ga4-kpi-metric-identity.ts`, `shared/kpi-math.ts`, and `shared/metric-math.ts`: mapping, formulas, units, sufficiency, and classification.
- `server/report-scheduler.ts` and `server/ga4-scheduled-report-pdf.ts`: report preflight and Benchmark report consumption.

## 13. Resolved history and out-of-scope observations recorded without changing Overview

1. Resolved on 2026-09-16: the authenticated deployed run originally found two logical duplicate automatic history groups (one Revenue and one Conversions group), each containing two same-date/same-scope rows. Runtime `236afff993e60c5f9eaf75c42bca8b31b52f601d` serializes reserved automatic GA4 history writes and performs the exact duplicate check inside the same transaction. A deployed test proved that two concurrent identical writes resolved to one stored row. A separately authorized serializable cleanup then deleted exactly one semantically identical redundant row from each pair, retained both deterministic canonical rows, and an independent read-only inventory proved zero remaining active-definition or history duplicate groups.
2. The final current-version boundary suite has two visible failures outside this manifest: the application readiness-ledger regression expects GA4 KPIs to remain `UNVERIFIED` while the ledger records them as `CERTIFIED`, and the KPI certification gate detects the Benchmark-only `server/storage.ts` change through its whole-file KPI dependency hash. Neither failure changes Benchmark values or invalidates this manifest-scoped certificate. Neither failure was counted as a pass, and neither the ledger nor the KPI section was modified or recertified.
3. Resolved on 2026-09-16: the current-runtime authenticated add/edit/delete/zero/target/unit/status/alert/ownership/scheduler/provider/Executive Summary/report lifecycle passed after cleanup with zero value mismatches, and an independent final inventory found no active-definition, history, or temporary validation duplicates.
