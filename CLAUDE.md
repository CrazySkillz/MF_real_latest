# MetricMind (MF_real_latest) — Architecture Reference

> **Enterprise-grade platform.** Marketing executives rely on MetricMind for business-critical decisions. All metrics, computations, and visualizations must be accurate. Specific rules:
> - **GA4 Users are non-additive** — never sum users across dimensions (dates, devices, sources, campaigns) without a tooltip warning. Per-campaign user counts from breakdown reports are approximate (overcounted).
> - **Exclude partial intraday data** — GA4 endpoints should use `endDate: "yesterday"` (not `"today"`) to report only complete UTC days. Partial data makes metrics look artificially low.
> - **Date range consistency** — document when different tabs use different date windows (e.g., 90-day breakdown vs campaign lifetime totals) so executives understand why numbers may differ.
> - **Financial metrics must match** — spend/revenue totals should be consistent across tabs. Use `recalcCampaignSpend` as single source of truth.
> - **Full pipeline review required** — when auditing a tab, trace the complete data path: component → memo/aggregation → API query → backend endpoint → external API call → response processing. Component-level logic review alone is insufficient for enterprise accuracy.
> - **Verify return shape contracts** — when a function's result is consumed (e.g., `p?.status`), verify the field actually exists in the function's return type. Two similar functions (e.g., `computeKpiProgress` vs `computeBenchmarkProgress`) may return different field names for equivalent concepts (`band` vs `status`, `attainmentPct` vs `labelPct`). Confirming "correct function called" is insufficient — must also confirm "correct fields accessed."

## Stack

- **Frontend:** React 18, TypeScript, Vite, Wouter (routing), TanStack React Query, Radix UI, Tailwind CSS, Recharts
- **Backend:** Express.js, Drizzle ORM, PostgreSQL (Neon), esbuild (server build — NOT tsc)
- **Auth:** Clerk (`@clerk/clerk-react` + `@clerk/express`)
- **Validation:** Zod (shared between client/server)
- **File Uploads:** Multer

---

## Project Structure

```
client/src/
  App.tsx              — Routes + auth gate (WelcomeGate, ClerkLoaded)
  pages/               — All page components
  components/          — Shared components (sidebar, modals, wizards)
  lib/
    queryClient.ts     — React Query client + apiRequest() helper
    clientContext.tsx   — ClientProvider + useClient() hook

server/
  index.ts             — Express app setup, DB migrations, scheduler bootstrap
  routes-oauth.ts      — ALL API endpoints (~26k lines, single file)
  storage.ts           — IStorage interface + DatabaseStorage (Drizzle queries)
  *-scheduler.ts       — Background jobs (GA4, LinkedIn, Meta, reports, KPIs)

shared/
  schema.ts            — ALL Drizzle table definitions + Zod types (single source of truth)
```

---

## Multi-Tenant Model

```
User (Clerk) → owns Clients → owns Campaigns → owns Connections/Metrics/Sources
```

- `clients` table: `ownerId` (Clerk user ID), `name`
- `campaigns` table: `clientId` (tenant isolation), `ownerId` (claimed on first access)
- `ClientProvider` context supplies `selectedClientId` (persisted to localStorage)
- `WelcomeGate` redirects to `/welcome` when no clients exist
- Sidebar shows client dropdown; navigation greyed out when no client selected

---

## Platform-Level vs Campaign-Level

### Platform-Level (cross-campaign)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Dashboard | Aggregated metrics cards, performance charts, campaign table |
| `/welcome` | Welcome | First-time onboarding, client creation |
| `/clients` | Clients | Create/switch clients |
| `/audiences` | Audiences | Audience segmentation |
| `/reports` | Reports | Report scheduling |
| `/notifications` | Notifications | Alert center |
| `/platforms/:platformType/kpis` | Platform KPIs | KPIs spanning all campaigns on a platform |

### Campaign-Level (single campaign)

| Route | Page | Purpose |
|-------|------|---------|
| `/campaigns` | Campaign List | List, create, edit, delete campaigns |
| `/campaigns/:id` | Campaign Detail | Core config: tabs for Overview, Connections, KPIs, Benchmarks, Reports, Attribution, A/B Tests |
| `/campaigns/:id/ga4-metrics` | GA4 Metrics | GA4 analytics: events, users, sessions, revenue, KPIs, financial cards |
| `/campaigns/:id/linkedin-analytics` | LinkedIn Analytics | LinkedIn campaign perf: KPIs, benchmarks, reports |
| `/campaigns/:id/meta-analytics` | Meta Analytics | Meta/Facebook campaign perf |
| `/campaigns/:id/google-ads-analytics` | Google Ads Analytics | Google Ads campaign perf |
| `/campaigns/:id/google-sheets-data` | Google Sheets Data | Sheets-sourced data viewer/importer |
| `/campaigns/:id/custom-integration-analytics` | Custom Integration | Webhook/API data viewer |
| `/campaigns/:id/performance` | Performance | Time-series perf with KPIs, benchmarks |
| `/campaigns/:id/financial-analysis` | Financial Analysis | Revenue & spend deep-dive |
| `/campaigns/:id/executive-summary` | Executive Summary | High-level overview across sources |
| `/campaigns/:id/trend-analysis` | Trend Analysis | Trend visualization, anomaly detection |
| `/campaigns/:id/platform-comparison` | Platform Comparison | Cross-platform metric comparison |

---

## Campaign Detail Tabs (`campaign-detail.tsx`)

The campaign detail page has these main sections/tabs:

1. **Overview** — Performance Summary grid (Spend, Revenue, ROAS, ROI, Conversions, CPA), KPI Health, Benchmark Health, Recommendations
2. **Connections** — Connected platform cards (GA4, LinkedIn, Meta, Google Ads), Revenue & Spend Sources with CRM cards (HubSpot, Salesforce, Shopify, Google Sheets, Manual, CSV)
3. **KPIs** — Campaign-level KPI definitions with targets, alerts, progress tracking
4. **Benchmarks** — Industry/competitor/historical benchmarks with variance tracking
5. **Reports** — Scheduled report configurations
6. **Attribution** — Attribution model dashboard (first/last touch, linear, time decay, position, data-driven)
7. **A/B Tests** — Test configuration with variants, traffic allocation, statistical significance

---

## Platform Integrations

| Platform | Connection Table | Daily Metrics Table | Key Fields |
|----------|-----------------|-------------------|------------|
| GA4 | `ga4Connections` | `ga4DailyMetrics` | `propertyId`, `ga4CampaignFilter`, OAuth/service account |
| LinkedIn | `linkedinConnections` | `linkedinDailyMetrics` | `adAccountId`, `conversionValue`, `campaignUtmMap` |
| Meta | `metaConnections` | `metaDailyMetrics` | `adAccountId`, `selectedCampaignIds`, `campaignUtmMap` |
| Google Ads | `googleAdsConnections` | `googleAdsDailyMetrics` | `customerId`, `developerToken`, `campaignUtmMap` |
| Google Sheets | `googleSheetsConnections` | — | `spreadsheetId`, `columnMappings`, `purpose` (spend/revenue) |
| HubSpot | `hubspotConnections` | — | `portalId`, `mappingConfig` (deal field mapping, pipeline proxy) |
| Salesforce | `salesforceConnections` | — | `instanceUrl`, `mappingConfig` (opportunity mapping) |
| Shopify | `shopifyConnections` | — | `shopDomain`, `mappingConfig` |
| Custom | `customIntegrations` | `customIntegrationMetrics` | `webhookToken`, flexible schema |

---

## Revenue & Spend Architecture

### Spend Flow
```
Source (CSV, Sheets, LinkedIn API, Meta API, Google Ads API, Manual)
  → spendSources (definition: sourceType, displayName, mappingConfig, isActive)
  → spendRecords (daily normalized rows: date, spend, currency, sourceType)
  → campaign.spend (denormalized total, recalculated by recalcCampaignSpend)
```

### Revenue Flow
```
Source (GA4 native, Manual, CSV, Sheets, HubSpot, Salesforce, Shopify)
  → revenueSources (definition)
  → revenueRecords (daily normalized rows: date, revenue, currency, platformContext)
```

### Platform Context
- `platformContext` field (`'ga4' | 'linkedin' | 'meta'`) prevents cross-platform revenue/spend leakage
- GA4 native revenue tracked separately from CRM-sourced revenue
- Campaign-level Total Revenue (in `outcome-totals`) = GA4 onsite + CRM offsite (additive)
- Platform-specific pages (GA4, LinkedIn, Meta) show only their own platform's revenue

### Financial Aggregation Endpoints
- `GET /api/campaigns/:id/spend-totals` / `spend-breakdown` / `spend-to-date` / `spend-daily?date=YYYY-MM-DD`
- `GET /api/campaigns/:id/revenue-totals` / `revenue-breakdown` / `revenue-to-date`
- `GET /api/campaigns/:id/outcome-totals` — unified metrics (GA4 + platforms + revenue + spend)
- `DELETE /api/campaigns/:id/spend-sources/:sourceId` — soft-delete a spend source, recalculate total

### Spend Mutation Endpoints
- `POST /api/campaigns/:id/spend/process/manual` — Manual, LinkedIn test, Meta test, Google Ads test. Accepts optional `sourceId` for edit/update.
- `POST /api/campaigns/:id/spend/csv/process` — CSV upload. Accepts optional `sourceId` in mapping JSON for edit/update.
- `POST /api/campaigns/:id/spend/sheets/process` — Google Sheets. Deduplicates by `connectionId` in mappingConfig (auto-detects existing source).
- `POST /api/campaigns/:id/spend/linkedin/process` — LinkedIn production mode (real API data).

### Revenue Cards
- **GA4 page** (`ga4-metrics.tsx`): `financialRevenue` = GA4 native revenue only (falls back to imported if no GA4 revenue metric). This is platform-specific — do NOT add CRM revenue here. No add/edit icons on the GA4 Total Revenue card.
- **Campaign Overview** (`campaign-detail.tsx`): Uses `outcome-totals` endpoint which returns unified cross-platform revenue (GA4 + CRM offsite sources). This is the right place for combined totals. Shows micro copy breakdown, "+" icon opens Add Revenue modal, edit icon opens existing source.

### Spend Cards (GA4 Overview)
- **Total Spend**: Uses `financialSpend` (prefers `spend-breakdown` total, falls back to `spend-to-date`). Shows "+" icon to add sources and per-source breakdown with edit/trash icons when sources exist. Shows "Add Spend" prompt when no spend exists.
- **Latest Day Revenue**: Uses `ga4ReportDate` to find the most recent **complete** day (skips today's partial intraday data). GA4-only — does not include CRM/imported revenue.
- **Latest Day Spend**: Queries `/spend-daily` for both today and yesterday, prefers whichever has data. Manual/CSV/ad platform spend records are dated today; scheduler records have actual historical dates. No dead fallback to GA4 `_raw.spend` (ga4_daily_metrics has no spend column).
- **Empty state gate**: Card shows populated view when `spendBreakdownResp.sources.length > 0 OR financialSpend > 0` (prevents showing $0 when breakdown hasn't loaded but spend exists).
- Per-source trash uses AlertDialog confirmation → `DELETE /api/campaigns/:id/spend-sources/:sourceId`.

### Spend Recalculation Rules (CRITICAL)
- **`recalcCampaignSpend(campaignId)`** in `routes-oauth.ts` is the SINGLE SOURCE OF TRUTH for recalculating `campaign.spend`. ALL spend mutation endpoints MUST call it after changes.
- It sums `spend_records` via `getSpendBreakdownBySource` (uses today as end date, NOT yesterday) + `mappingConfig.amount` for sources without records.
- **Every spend source MUST create at least one `spend_record`** — even CSV/Sheets without a date column create a single record dated today. Without records, `spend-breakdown` returns $0 for that source and micro copy shows wrong amounts.
- **Never overwrite `campaign.spend` directly** — always call `recalcCampaignSpend` which sums ALL active sources.
- **Edit flows MUST pass `sourceId`** to update the existing source (not create a duplicate). The backend checks for `sourceId` in the request body and calls `updateSpendSource` + `deleteSpendRecordsBySource` before creating new records.
- **Delete endpoint** soft-deletes the source (`isActive = false`), then calls `recalcCampaignSpend` to update the total.

### GA4 Overview Data Scoping
- **Summary cards** (`ga4-to-date`): Campaign lifetime (startDate → yesterday), current campaign's `ga4CampaignFilter` only. This is the source of truth for total Sessions, Users, Conversions, Revenue.
- **Campaign Breakdown** (`ga4-breakdown`): Last 90 days (hardcoded `dateRange`), acquisition dimensions (source/medium/campaign). Drops "uninformative" rows where source/medium are `(not set)`, so its sum may be lower than Summary totals. Uses current campaign's filter only.
- **Landing Pages** (`ga4-landing-pages`): Campaign lifetime, top 50 rows. Uses current campaign's `ga4CampaignFilter` only (NOT cross-client).
- **Conversion Events** (`ga4-conversion-events`): Campaign lifetime, top 25 rows. Uses current campaign's `ga4CampaignFilter` only (NOT cross-client).
- **Users are non-additive**: Summing users across campaigns or sections over-counts due to user overlap. Landing Pages has a tooltip warning about this.
- **IMPORTANT**: All GA4 Overview endpoints MUST scope to the current campaign's `ga4CampaignFilter`. Never aggregate filters across all client campaigns — that would mix data from unrelated campaigns sharing the same GA4 property.

### KPI UI Pattern (shared across GA4 and LinkedIn)

**Summary cards** (5-column grid): Total KPIs | Above Target (>+5%) | On Track (±5%) | Below Track (<-5%) | Avg. Progress. Uses `classifyKpiBand()` from `shared/kpi-math.ts` with `NEAR_TARGET_BAND_PCT = 5`.

**Progress logic** (from `shared/kpi-math.ts`):
- `isLowerIsBetterKpi()` — detects CPC/CPM/CPA/CPL/Spend as "lower is better"
- `computeEffectiveDeltaPct()` — percent delta vs target (sign-flipped for lower-is-better)
- `classifyKpiBand()` — above/near/below using ±5% band
- `computeAttainmentPct()` — uncapped progress percentage (can exceed 100%)
- `computeAttainmentFillPct()` — capped 0-100% for progress bar fill
- Progress bar colors: green ≥100%, amber ≥90%, red <90%

**KPI card rendering**: Current/Target values in 2-col grid, progress bar with uncapped attainment %, delta text below ("X% above/below target"). No status label text — delta text replaces it. Alert indicators next to KPI name: yellow `AlertTriangle` icon (tooltip "Alerts enabled") when `alertsEnabled`, red pulsing dot (`animate-pulse` + `animate-ping`) when threshold actively breached (tooltip shows current/threshold/condition). Alert threshold input formats on blur (e.g. `500` → `500.00`).

**Create KPI modal layout** (LinkedIn is the reference pattern):
- Template/metric selection (platform-specific tiles or dropdown)
- Grid 2 cols: KPI Name | [empty]
- Full width: Description (Textarea with char counter)
- Grid 3 cols: Current Value | Target Value | Unit (free text input)
- Grid 2 cols: Priority (Low/Medium/High) | [empty]
- Alert Settings (border-t separator, no heading):
  - Checkbox: "Enable alerts for this KPI" + description text
  - [Conditional when enabled, indented `pl-6`]:
    - Grid 2 cols: Alert Threshold (free text decimal, "Value at which to trigger the alert") | Alert When (Below/Above/Equals)
    - Grid 2 cols: Alert Frequency (Immediate/Daily/Weekly) + helper text | Email checkbox + conditional email recipients
- DialogFooter: Cancel | Create/Update KPI

### Benchmark UI Pattern (shared across GA4 and LinkedIn)

**Summary cards** (5-column grid): Total Benchmarks (purple `Target`) | On Track (green `CheckCircle2`, "meeting or exceeding target") | Needs Attention (amber `AlertCircle`, "within 70–90% of target") | Behind (red `AlertTriangle`, "below 70% of target") | Avg. Progress (violet `TrendingUp`). All use `p-4`, `w-8 h-8` icons, `text-xs` descriptions.

**Progress logic**: Ratio-based thresholds (NOT kpi-math.ts delta bands). `ratio >= 0.9` = on_track (green), `>= 0.7` = needs_attention (yellow), `< 0.7` = behind (red). Lower-is-better detection for CPA/CPC/CPM/CPL/Spend inverts ratio (`benchmark / current`). Progress bar fill capped 0–100%, label shows uncapped.

**Benchmark card rendering**: 2-column grid (`lg:grid-cols-2`). Name with metric `Badge` (outline, font-mono). Inline `Pencil` (blue) + `Trash2` (red) buttons with per-card `AlertDialog` delete confirmation (no dropdown menu). 3-column metrics grid (Current Value | Benchmark Value | Source) in `bg-slate-50 rounded-lg` boxes. Progress bar + delta/performance line below. Alert indicators: yellow `AlertTriangle` when `alertsEnabled`, red pulsing dot when threshold breached (same pattern as KPI cards).

**Create Benchmark modal layout** (LinkedIn is the reference pattern):
- Template/metric selection (platform-specific tiles or dropdown)
- Full width: Benchmark Name
- Full width: Description (Textarea with char counter, 200 max)
- Grid 3 cols: Current Value | Benchmark Value | Unit (free text input, NOT Select dropdown)
- Benchmark Type (Industry/Custom) + conditional Industry dropdown
- Alert Settings (border-t separator):
  - Checkbox: "Enable alerts for this Benchmark" + description text
  - [Conditional when enabled, indented `pl-6`]:
    - Grid 2 cols: Alert Threshold (decimal, formats on blur) | Alert When (Below/Above/Equals)
    - Grid 2 cols: Alert Frequency (Immediate/Daily/Weekly) + helper text | Email checkbox + conditional email recipients
- DialogFooter: Cancel | Create/Update Benchmark

**Accuracy (pipeline-verified)**:
- `getLiveBenchmarkCurrentValue()` uses the **same data sources** as `getLiveKpiValue()`: `financialSpend`, `financialRevenue`, `breakdownTotals`, `dailySummedTotals`. ROAS: `financialROAS * 100` = `computeRoasPercent(rev, spend)` — identical to KPIs.
- Users: prefers deduplicated `ga4-to-date` count via `breakdownTotals.users` (same fix as KPIs).
- CPA correctly identified as "lower is better" in both client (`computeBenchmarkProgress`) and scheduler (`computeBenchmarkVariance`).
- Progress thresholds (0.9/0.7 ratio) are intentionally different from KPI bands (±5% delta) — benchmarks compare against a standard, KPIs track toward a target.
- Scheduler uses same `computeKpiValue()` function for both KPIs and Benchmarks. Scheduler's `computeBenchmarkRating` (±5%/±20% bands) is stored in history but not displayed on cards (cards compute their own progress).

### Ad Comparison Tab (`ga4-campaign-comparison.tsx`)

Extracted component comparing GA4 campaigns by selected metric. Data from `/api/campaigns/:id/ga4-breakdown` (90-day window), aggregated by campaign name in `campaignBreakdownAgg` memo.

- **Ranking cards** (3-col, shown when ≥2 campaigns): Best Performing (dynamic, sorts by selected metric), Most Efficient (highest CR), Needs Attention (lowest CR, guards against duplicating Best Performing)
- **Bar chart**: Top 10 campaigns by selected metric (horizontal Recharts `BarChart`)
- **Summary cards**: Total metric + Campaigns Compared. Users metric shows amber `Info` tooltip warning about non-additivity.
- **Comparison table**: All campaigns sorted by selected metric, top row green, bottom row red
- **Users non-additivity**: GA4 users are non-additive across breakdown dimensions (dates, devices, sources) AND across campaigns. Per-campaign user counts from the multi-dimensional breakdown are approximate (overcounted). Tooltip warnings on both the Total summary card (when Users selected) and the Users column header in the comparison table.
- **Date range**: Breakdown endpoint uses `endDate: "yesterday"` to exclude partial intraday data, matching `ga4-to-date`. 90-day window (hardcoded) means totals will be lower than Overview Summary (campaign lifetime) for campaigns older than 90 days — this is by design.
- **Accurate metrics**: Sessions, conversions, revenue are additive across breakdown dimensions — sums are correct. Conversion rate is properly computed as `(totalConversions / totalSessions) * 100` (weighted, not averaged).

### GA4 Insights Tab (inline in `ga4-metrics.tsx`)

4 sections: Executive Financials (Spend/Revenue/Profit/ROAS/ROI with provenance), Trends (daily/7d/30d rolling window chart + tables), Insights Summary (total/high/medium counts), Insights List (max 12, severity-sorted).

**Insights engine** (`insights` useMemo) generates 5 categories:
- Financial integrity checks (blocked KPIs, mismatched sources, negative ROI, low ROAS)
- KPI performance — channel-enriched recommendations using `channelAnalysis` (lowest-CR channel for conversion KPIs, top revenue/session channels for others)
- Benchmark performance — channel-enriched recommendations (same pattern as KPIs)
- Anomaly detection — WoW deltas: CR drop ≥15% (high), engagement depth drop ≥20% (medium), sessions drop ≥20% (high), revenue drop ≥25% (high), conversions drop ≥20% (high). Requires ≥14 days history. Volume anomalies use `insightsRollups.deltas` and include top channel context.
- Positive signals — sessions/revenue/conversions up WoW, strong ROAS (≥3x), KPIs exceeding target (≥110%). Green "Positive" badge. Minimum volume thresholds to prevent noise.

**Supporting memos** (defined before `insights` for dependency ordering):
- `insightsRollups`: Last 7d vs Prior 7d, Last 30d vs Prior 30d with pre-computed deltas. CR and engagement rate as proper aggregates.
- `channelAnalysis`: Aggregates `ga4Breakdown.rows` by source/medium. Produces top channel by sessions/revenue, lowest-CR significant channel (≥5% of total sessions).

**Data sources**: `ga4-daily` (persisted daily facts), `ga4-to-date` (lifetime totals), `ga4-breakdown` (acquisition channels), financial APIs (spend/revenue). All client-side computation, no dedicated insights endpoint.

**Accuracy (pipeline-verified)**:
- Executive Financials uses the exact same `financialSpend`, `financialRevenue`, `financialROAS`, `financialROI` variables as the Overview tab. No divergence.
- ROAS consistency: `financialROAS` is a ratio (e.g., 2.5). Display: `2.50x`. Insight check: `< 1` (below break-even). KPI/Benchmark ROAS: `* 100` for percentage. All correct within their contexts.
- Anomaly detection uses `ga4DailyRows` (persisted daily facts, one row per date) — NOT the multi-dimensional breakdown. No Users non-additivity issue. Sessions/conversions/revenue/pageviews are additive across dates.
- Rolling window CR: properly computed as `(summedConversions / summedSessions) * 100` per window, not averaged from daily CRs.
- KPI/Benchmark insights use the same `getLiveKpiValue`/`computeKpiProgress`/`computeBenchmarkProgress` functions as the KPI and Benchmarks tabs. Thresholds match (0.9/0.7).
- **KPI insights bug fix**: `computeKpiProgress()` returns `{ band, attainmentPct }` (NOT `status`). The insights code previously read `p?.status` which was always `undefined`, silently skipping all KPI insights. Fixed to use `p?.attainmentPct` with 90%/70% thresholds (matching benchmark logic). Also fixed `p?.labelPct` → `attPct.toFixed(1)` since KPI progress has no `labelPct` field.
- **Return shape difference**: `computeKpiProgress` → `{ band, attainmentPct, fillPct, progressColor }`. `computeBenchmarkProgress` → `{ status, pct, labelPct, color, deltaPct }`. These are NOT interchangeable — always use the correct field names for each.

### GA4 KPIs Tab
- **Templates**: ROAS, ROI, CPA, Revenue, Conversions, Engagement Rate, Conversion Rate, Users, Sessions + Custom. Templates requiring spend/revenue are disabled when sources aren't connected.
- **Live values**: `getLiveKpiValue()` computes current values from live query data (NOT stored `currentValue`). Stored `currentValue` is only a fallback for custom/legacy KPIs.
- **Blocked KPIs**: KPIs missing required data (spend/revenue) show "Blocked" status with explanation link. Excluded from scoring.
- **No timeframe scaling**: `timeframe`, `trackingPeriod`, and `rollingAverage` fields were removed from the form. All KPIs evaluate on cumulative values. Targets are absolute goals.
- **ROAS unit**: GA4 ROAS is stored/displayed as percentage (300 = 3x). LinkedIn ROAS is stored as ratio (3.0). These are separate KPI systems on separate pages — no cross-platform display.
- **Scheduler**: `ga4-kpi-benchmark-jobs.ts` records daily `kpiProgress` rows. Uses `getSpendTotalForRange()` (NOT `campaign.spend`) for accurate financial KPIs.
- **Auth**: All KPI CRUD endpoints require `ensureCampaignAccess` or `ensureKpiAccess`. `test-alerts` endpoint requires authenticated user.
- **Cascade delete**: Deleting a KPI also deletes its `kpiProgress` and `kpiAlerts` rows.

**Accuracy (pipeline-verified)**:
- `getLiveKpiValue()` and scheduler `computeKpiValue()` use the **same shared formulas** from `metric-math.ts`: `computeRoasPercent`, `computeRoiPercent`, `computeCpa`, `computeConversionRatePercent`, `normalizeRateToPercent`. Both return ROAS/ROI as percentages, CPA as ratio.
- `breakdownTotals` uses `Math.max(ga4ToDate, dailySummed)` for sessions/conversions/revenue (additive metrics). For **users**, it prefers the deduplicated `ga4-to-date` count (dimension-free GA4 API query) and only falls back to daily sum (overcounted) when unavailable.
- Scheduler prefers `getTotalsWithRevenue` API response for all metrics (deduplicated), falling back to summed daily rows only when API fails.
- Engagement Rate: client uses cumulative weighted average (`engagedSessions / sessions` across all days), scheduler records daily snapshot. This is by design — different time scopes for different purposes.
- Financial metrics (Spend/Revenue/ROAS/ROI/CPA) use the **same sources** as Overview and Insights tabs: `financialSpend`, `financialRevenue`, shared `computeRoasPercent`/`computeRoiPercent`/`computeCpa`.
- `normalizeRateToPercent` handles GA4's inconsistent rate format: if `v ≤ 1` assumes decimal (×100), if `v > 1` assumes already percentage.

### GA4 Reports Tab (inline in `ga4-metrics.tsx`)

CRUD library for saved report definitions + client-side PDF download. Reports stored in `linkedin_reports` table with `platformType='google_analytics'`. No server-side PDF generation for GA4 — PDF built entirely in browser from already-loaded page data.

**PDF sections** (controlled by `reportType` or `configuration.sections`): Overview, Acquisition (top 25 breakdown rows), Trends (last 25 daily data points), KPIs Snapshot, Benchmarks Snapshot.

**Accuracy (pipeline-verified)**:
- Overview: Uses `financialSpend`, `financialRevenue`, `financialConversions`, `breakdownTotals` — same sources as Overview tab. ROAS/ROI/CPA computed inline with same formulas.
- Acquisition: Uses `ga4Breakdown.rows` — same data as Campaign Breakdown section.
- Trends: Uses `ga4TimeSeries` (alias for `ga4DailyRows`) — same persisted daily facts.
- KPIs: Uses `computeKpiProgress()` → `p.band` for status, `p.attainmentPct` for progress. Labels: "Above Target"/"On Track"/"Below Target" matching KPI tab.
- Benchmarks: Uses `computeBenchmarkProgress()` → `p.status` for status, `p.pct` for progress. Correct return shape.
- **Bug fixed**: KPI section previously read `p.status`/`p.pct` from `computeKpiProgress` (which returns `band`/`attainmentPct`). `p.pct.toFixed(1)` crashed (TypeError). Fixed to use correct field names.
- **Bug fixed**: PDF Overview used `spendToDateResp?.spendToDate` bypassing the `financialSpend` preference chain. Fixed to use `financialSpend` for consistency with UI.
- **Design note**: GA4 reports have no email scheduling — scheduler only processes `platformType='linkedin'`. The Reports tab UI does not expose scheduling fields for GA4.

---

## Add Spend Wizard (`AddSpendWizardModal.tsx`)

### Steps
`select` → source-specific step (`ad_platform`, `csv`, `csv_map`, `sheets_choose`, `sheets_map`, `manual`, `paste`)

### Source Types & Flows
| Source | sourceType stored | Processing function | Endpoint |
|--------|------------------|-------------------|----------|
| LinkedIn (test) | `linkedin_api` | `processLinkedInSpend` | `/spend/process/manual` |
| LinkedIn (prod) | `linkedin_api` | `processLinkedInSpend` | `/spend/linkedin/process` |
| Meta (test) | `ad_platforms` | `importAdPlatformSpend` | `/spend/process/manual` |
| Google Ads (test) | `ad_platforms` | `importAdPlatformSpend` | `/spend/process/manual` |
| CSV | `csv` | `processCsv` | `/spend/csv/process` |
| Google Sheets | `google_sheets` | `processSheets` | `/spend/sheets/process` |
| Manual | `manual` | `processManual` | `/spend/process/manual` |

### Ad Platform Test Mode (LinkedIn, Meta, Google Ads)
- Test mode toggle → mock campaigns with name, spend, impressions, clicks
- Campaign selection table with checkboxes (select-all + individual)
- Import button shows selected total only
- Saves `mappingConfig.breakdown` with per-campaign data + `selectedCampaignIds`
- **Must exactly simulate production** — no extra UI elements (date pickers, config) that don't exist in real flow

### Edit Mode
- `isEditing = Boolean(props.initialSource?.id)` — detects edit mode from passed source
- Edit prefill `useEffect` routes to correct step and pre-populates state based on `sourceType`
- ALL processing functions pass `sourceId` when editing to update (not create duplicate)
- Cancel button closes modal when editing (doesn't go back to source selection)

### Input Formatting
- Manual spend input formats to 2 decimal places on blur (e.g. `500` → `500.00`) using `toLocaleString("en-US", { minimumFractionDigits: 2 })`

### Micro Copy Display (`ga4-metrics.tsx`)
- `spendDisplaySources` merges `spend-breakdown` (has per-source amounts from records) with `spend-sources` (definitions fallback)
- Each source line shows: `displayName` (e.g. "Meta Ads", "Google Ads", "Google Sheets") + formatted spend amount
- **displayName must be a clean platform label** — use "Google Sheets" (NOT the spreadsheet name), "Meta Ads", "Google Ads", "LinkedIn Ads", "CSV" etc.
- Edit icon (pencil) + trash icon per source, "+" button to add new sources

---

## Key Patterns

### Page Layout
Each page renders `<Navigation />` + `<Sidebar />` directly — there is no shared layout wrapper component.

### API Auth
Use `getActorId(req)` for Clerk user ID in route handlers.

### Campaign Ownership
`ownerId` field on campaigns; campaigns without it get claimed on first access via `ensureCampaignAccess()`.

### Query Keys
Include filter params (e.g., `dateRange`, `platformContext`, `clientId`) for correct cache invalidation.

### Cache Invalidation After Revenue/Spend Changes
```typescript
// Revenue mutations (AddRevenueWizardModal):
// Invalidates: outcome-totals, revenue-sources, revenue-to-date, revenue-totals, revenue-breakdown

// Spend mutations (add/edit/delete in ga4-metrics.tsx):
// Invalidates: spend-totals, spend-to-date, spend-sources, spend-breakdown, spend-daily
// Refetches: spend-to-date, spend-breakdown
```

### OAuth Flow (CRM Sources)
1. User clicks CRM card in Add Revenue modal
2. `handleCrmSourceClick` checks connection status
3. If not connected → opens OAuth popup window
4. OAuth callback stores tokens → popup closes
5. Wizard step loads (campaign field mapping → crosswalk → pipeline → revenue → review → save)

### HubSpot Pipeline (Proxy)
Available for all platform contexts. Lets users select a HubSpot deal stage (e.g., SQL) as an early pipeline signal for long sales cycles. Optional — default is Revenue-only.

### Disconnect CRM Sources
Trash icon + AlertDialog confirmation on CRM cards in Add Revenue modal. Deletes revenue source + OAuth connection. LinkedIn/Meta queries wrapped in try-catch to handle missing `campaign_utm_map` column.

---

## Database Migrations

Migrations run in `server/index.ts` on startup (ALTER TABLE statements). Schema changes in `shared/schema.ts` need `db:push` with `DATABASE_URL` to apply to production DB.

**Known issue:** `campaign_utm_map` column exists in Drizzle schema but may not exist in the actual DB if migrations haven't run. Disconnect endpoints handle this gracefully with try-catch.

---

## Pre-existing TS Errors

`storage.ts` has many pre-existing TypeScript errors (KPIReport, attributionModels, etc.) that are NOT caused by recent changes. These don't block the build because `esbuild` is used for the server, not `tsc`.

---

## Key Component Files

| Component | File | Purpose |
|-----------|------|---------|
| Add Revenue Modal | `components/AddRevenueWizardModal.tsx` | Multi-step wizard for adding revenue sources |
| Add Spend Modal | `components/AddSpendWizardModal.tsx` | Multi-step wizard for adding spend sources |
| HubSpot Wizard | `components/HubSpotRevenueWizard.tsx` | HubSpot deal mapping + pipeline proxy |
| Salesforce Wizard | `components/SalesforceRevenueWizard.tsx` | Salesforce opportunity mapping |
| Shopify Wizard | `components/ShopifyRevenueWizard.tsx` | Shopify store connection |
| Sidebar | `components/layout/sidebar.tsx` | Main nav with client dropdown |
| Navigation | `components/layout/Navigation.tsx` | Top bar with notifications + user button |
| Column Mapping | `components/GuidedColumnMapping.tsx` | CSV/Sheets column mapping wizard |
| Attribution | `components/AttributionDashboard.tsx` | Attribution model visualization |

---

## UI Libraries & Conventions

- **Icons:** Lucide React (e.g., `Trash2` for delete, `Plus` for add, `Pencil`/`Edit` for edit)
- **Dialogs:** Radix UI AlertDialog for destructive confirmations (NOT native `window.confirm()`)
- **Toasts:** `useToast()` hook from `@/hooks/use-toast`
- **Forms:** React Hook Form + Zod validation
- **Styling:** Tailwind CSS with dark mode support (`dark:` variants)
- **Charts:** Recharts (LineChart, BarChart, PieChart)
- **Date formatting:** `date-fns`
