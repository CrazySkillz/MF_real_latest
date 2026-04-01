# MimoSaaS (MF_real_latest) — Architecture Reference

> **Enterprise-grade platform.** Marketing executives rely on MimoSaaS for business-critical decisions. Every number, chart, and table must be accurate and consistent — executives make budget and strategy decisions based on these metrics. When in doubt, don't show inaccurate data; hide the metric or show a clear caveat.
>
> **Quality standard: "Tests pass" is NOT "done."** After every fix, trace the full user journey — what will the user actually see? For auth/OAuth fixes, test with existing stale connections, not just fresh ones. For error changes, trace every UI surface (toasts, inline errors, disabled buttons). For wizard fixes, walk every step. Ship the complete fix (backend + frontend + error handling + migration path) in one commit. Never ship a partial backend fix and wait for the user to report the frontend symptoms.
>
> Specific rules:
> - **GA4 Users are non-additive** — never sum or average users across dates, dimensions, or campaigns. In rolling windows (7d/30d), hide Users from the metric selector entirely rather than showing overcounted values. Per-campaign user counts from breakdown reports are approximate.
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
- `WelcomeGate` redirects to `/` (Home) when no clients exist; Home is always accessible
- Sidebar shows Home link + expandable client list (chevron toggles expand/collapse independently; clicking client name selects + navigates to Dashboard) + "Add Client" button
- **Color scheme:** Orange primary (`hsl(24, 95%, 53%)`), defined via `--primary` / `--gradient-primary` CSS variables in `index.css`

---

## Platform-Level vs Campaign-Level

### Platform-Level (cross-campaign)

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home | Landing page with hero + marketing news (always accessible) |
| `/dashboard` | Dashboard | Aggregated metrics cards, performance charts, campaign table |
| `/clients` | Clients | Create/switch clients |
| `/audiences` | Audiences | Audience segmentation |
| `/reports` | Reports | Report scheduling |
| `/notifications` | Notifications | Alert center |
| `/platforms/:platformType/kpis` | Platform KPIs | KPIs spanning all campaigns on a platform |

### Campaign-Level (single campaign)

| Route | Page | Purpose |
|-------|------|---------|
| `/campaigns` | Campaign List | List, create, edit, delete campaigns |
| `/campaigns/:id` | Campaign Detail | Core config: tabs for Overview, KPIs, Benchmarks, Freestyle Chat, Webhooks |
| `/campaigns/:id/ga4-metrics` | GA4 Metrics | GA4 analytics: events, users, sessions, revenue, KPIs, financial cards |
| `/campaigns/:id/linkedin-analytics` | LinkedIn Analytics | LinkedIn campaign perf: KPIs, benchmarks, reports |
| `/campaigns/:id/meta-analytics` | Meta Analytics | Meta/Facebook campaign perf |
| `/campaigns/:id/google-ads-analytics` | Google Ads Analytics | Google Ads campaign perf |
| `/campaigns/:id/google-sheets-data` | Google Sheets Data | Sheets-sourced data viewer/importer |
| `/campaigns/:id/custom-integration-analytics` | Custom Integration | Webhook/API data viewer |
| `/campaigns/:id/performance` | Performance | Time-series perf with KPIs, benchmarks |
| `/campaigns/:id/financial-analysis` | Financial Analysis | Revenue & spend deep-dive |
| `/campaigns/:id/executive-summary` | Executive Summary | High-level overview across sources |
| `/campaigns/:id/trend-analysis` | Trend Analysis | 5-tab executive analytics: Overview, Efficiency, Funnel, Platform Breakdown, Market Trends |
| `/campaigns/:id/platform-comparison` | Platform Comparison | Cross-platform metric comparison |

---

## Campaign Detail Tabs (`campaign-detail.tsx`)

The campaign detail page has these main sections/tabs:

1. **Overview** — Performance Summary grid (Spend, Revenue, ROAS, ROI, Conversions, CPA), KPI Health, Benchmark Health, Recommendations, Connected Platforms
2. **KPIs** — Campaign-level KPI definitions with targets, alerts, progress tracking
3. **Benchmarks** — Industry/competitor/historical benchmarks with variance tracking
4. **Freestyle Chat** — OpenRouter-powered AI chat for campaign analysis (uses campaign context: KPIs, benchmarks, spend/revenue breakdown)
5. **Webhooks** — Custom integration webhook configuration

---

## Platform Integrations

| Platform | Connection Table | Daily Metrics Table | Key Fields |
|----------|-----------------|-------------------|------------|
| GA4 | `ga4Connections` | `ga4DailyMetrics` | `propertyId`, `ga4CampaignFilter`, `lookbackDays` (30/60/90, default 90), OAuth/service account |
| LinkedIn | `linkedinConnections` | `linkedinDailyMetrics` | `adAccountId`, `conversionValue`, `campaignUtmMap` |
| Meta | `metaConnections` | `metaDailyMetrics` | `adAccountId`, `selectedCampaignIds`, `campaignUtmMap` |
| Google Ads | `googleAdsConnections` | `googleAdsDailyMetrics` | `customerId`, `developerToken`, `campaignUtmMap` |
| Google Sheets | `googleSheetsConnections` | — | `spreadsheetId`, `columnMappings`, `purpose` (spend/revenue) |
| HubSpot | `hubspotConnections` | — | `portalId`, `mappingConfig` (deal field mapping, pipeline proxy) |
| Salesforce | `salesforceConnections` | — | `instanceUrl`, `mappingConfig` (opportunity mapping) |
| Shopify | `shopifyConnections` | — | `shopDomain`, `mappingConfig` |
| Custom | `customIntegrations` | `customIntegrationMetrics` | `webhookToken`, flexible schema |

### `spendOnly` Flag (LinkedIn, Meta, Google Ads)
- `linkedinConnections`, `metaConnections`, `googleAdsConnections` have a `spend_only BOOLEAN DEFAULT FALSE` column
- Set to `true` when a connection is made from the **Add Spend Wizard** (to import spend data only)
- Set to `false` (default) when connected from **Create Campaign modal** or **Connected Platforms** section
- The `connected-platforms` endpoint filters out `spendOnly` connections — they do NOT show as "Connected" or "View Detailed Analytics"
- `spendOnly` is propagated through OAuth state payloads (`s: 1|0`) so callbacks know the connection's intent
- Upgrading a spend-only connection to full analytics: reconnecting from Connected Platforms creates/updates with `spendOnly: false`

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

### Per-Day Revenue Records (CSV/Sheets)
- CSV and Sheets revenue import endpoints support an optional `dateColumn` in the mapping
- When mapped: creates one `revenueRecord` per date (enables Latest Day Revenue card + Trends daily tracking)
- When not mapped: sums all rows into a single record dated yesterday (backward compatible)
- The Date column selector is labeled "(recommended)" in both CSV and Sheets mapping UIs
- Spend already had per-day support via `dateColumn` — revenue now matches
- Daily scheduler (`auto-refresh-scheduler.ts`) preserves per-day records on re-sync

### Google Sheets Daily Sync (`auto-refresh-scheduler.ts`)
- Runs daily at 3 AM alongside LinkedIn/CRM refresh
- Re-reads ALL active Google Sheets spend and revenue sources (fixed `.find()` → `.filter()` bug)
- Revenue uses direct DB operations (fixed auth failure from `postJson` to endpoints requiring Clerk)
- Revenue checks all platform contexts: ga4, linkedin, meta (fixed missing context bug)
- Spend uses `postJson` to spend/sheets/process endpoint (no auth required)
- Updates `mappingConfig.lastSyncedAt` on success
- One failure doesn't stop others (try/catch per source)

### Platform Context
- `platformContext` field (`'ga4' | 'linkedin' | 'meta'`) prevents cross-platform revenue/spend leakage
- GA4 native revenue tracked separately from CRM-sourced revenue
- Campaign-level Total Revenue (in `outcome-totals`) = GA4 onsite + CRM offsite (additive)
- GA4 page `financialRevenue` = `ga4RevenueForFinancials + importedRevenueForFinancials` (additive — GA4 native + manual/CSV/Sheets/CRM). NOT either/or.
- **CRM double-count prevention**: HubSpot/Salesforce wizards hardcode `revenueClassification = "offsite_not_in_ga4"` and show a warning: "Only add this revenue if NOT already tracked in GA4." No user-facing classification toggle — users should simply not add CRM revenue that duplicates GA4 ecommerce data.

### Financial Aggregation Endpoints
- `GET /api/campaigns/:id/spend-totals` / `spend-breakdown` / `spend-to-date` / `spend-daily?date=YYYY-MM-DD`
- `GET /api/campaigns/:id/revenue-totals` / `revenue-breakdown` / `revenue-to-date` / `revenue-daily?date=YYYY-MM-DD`
- `GET /api/campaigns/:id/outcome-totals` — unified metrics (GA4 + platforms + revenue + spend)
- `DELETE /api/campaigns/:id/spend-sources/:sourceId` — soft-delete a spend source, recalculate total

### Spend Mutation Endpoints
- `POST /api/campaigns/:id/spend/process/manual` — Manual, LinkedIn test, Meta test, Google Ads test. Accepts optional `sourceId` for edit/update.
- `POST /api/campaigns/:id/spend/csv/process` — CSV upload. Accepts optional `sourceId` in mapping JSON for edit/update.
- `POST /api/campaigns/:id/spend/sheets/process` — Google Sheets. Deduplicates by `connectionId` in mappingConfig (auto-detects existing source).
- `POST /api/campaigns/:id/spend/linkedin/process` — LinkedIn production mode (real API data).

### Revenue Cards
- **GA4 page** (`ga4-metrics.tsx`): `financialRevenue` = `ga4RevenueForFinancials + importedRevenueForFinancials` (additive). Shows "+" icon to add sources via `AddRevenueWizardModal`. Per-source microcopy uses HTML `<table>` for guaranteed column alignment: GA4 Revenue line first, then each imported source (from `revenueDisplaySources`) with edit/delete icons. Delete uses `AlertDialog` → `DELETE /revenue-sources/:sourceId`. Empty state shows GA4 Revenue micro copy when ga4 revenue exists.
- **Campaign Overview** (`campaign-detail.tsx`): Uses `outcome-totals` endpoint which returns unified cross-platform revenue (GA4 + CRM offsite sources). This is the right place for combined totals. Shows micro copy breakdown, "+" icon opens Add Revenue modal, edit icon opens existing source.

### Spend Cards (GA4 Overview)
- **Total Spend**: Uses `financialSpend` (prefers `spend-breakdown` total, falls back to `spend-to-date`). Shows "+" icon to add sources and per-source breakdown with edit/trash icons when sources exist. Shows "Add Spend" prompt when no spend exists.
- **Latest Day Revenue**: GA4 native daily revenue (`ga4DailyRows[ga4ReportDate].revenue`) + imported revenue for the same date (`revenue-daily?date=ga4ReportDate`). Uses `ga4ReportDate` (most recent complete day, skips today's partial). Falls back to yesterday when no GA4 data. Imported revenue only shows for sources with per-day records (date column mapped in CSV/Sheets, or CRM with actual deal dates).
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
- **Summary cards** (`ga4-to-date`): Campaign lifetime (startDate → yesterday), current campaign's `ga4CampaignFilter` only. This is the source of truth for total Sessions, Users, Conversions, Revenue. 6-card grid: Sessions, Users, Conversions, Engagement Rate, Conv. Rate (replaced Bounce Rate). Financial section: Profit, ROAS, ROI, CPA.
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

**KPI card rendering**: Current/Target values in 2-col grid, progress bar with uncapped attainment %, delta text below ("X% above/below target"). No status label text — delta text replaces it. Progress % uses 1 decimal place in the 99.5–99.9% range to avoid falsely showing 100% when below target; whole numbers otherwise. Delta text uses 1 decimal when <1% (e.g., "0.2% below target") to avoid showing "0% below target". Alert indicators next to KPI name: yellow `AlertTriangle` icon (tooltip shows threshold value + condition, `bg-slate-900` dark background) when `alertsEnabled`, red pulsing dot (`animate-pulse` + `animate-ping`) when threshold actively breached (tooltip shows "Alert Threshold Breached" + current value + threshold + condition, same dark background). Alert threshold input formats on blur (e.g. `500` → `500.00`). All alert tooltips use `bg-slate-900 text-white` — NOT `bg-card text-white` which is invisible on light theme.

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
- `getLiveBenchmarkCurrentValue()` uses the **same data sources** as `getLiveKpiValue()`: `financialSpend`, `financialRevenue`, `breakdownTotals`, `dailySummedTotals`. ROAS: returns `financialROAS` directly (ratio, e.g., 48.91) — identical to KPIs and Overview.
- Users: prefers deduplicated `ga4-to-date` count via `breakdownTotals.users` (same fix as KPIs).
- CPA correctly identified as "lower is better" in both client (`computeBenchmarkProgress`) and scheduler (`computeBenchmarkVariance`).
- Progress thresholds (0.9/0.7 ratio) are intentionally different from KPI bands (±5% delta) — benchmarks compare against a standard, KPIs track toward a target.
- Scheduler uses same `computeKpiValue()` function for both KPIs and Benchmarks. Scheduler's `computeBenchmarkRating` (±5%/±20% bands) is stored in history but not displayed on cards (cards compute their own progress).

### Ad Comparison Tab (`ga4-campaign-comparison.tsx`)

Extracted component comparing GA4 campaigns by selected metric. Data from `/api/campaigns/:id/ga4-breakdown` (90-day window), aggregated by campaign name in `campaignBreakdownAgg` memo.

- **Ranking cards** (3-col, shown when ≥2 campaigns): Best Performing (dynamic, sorts by selected metric), Most Efficient (highest CR), Needs Attention (lowest CR, guards against duplicating Best Performing)
- **Bar chart**: Top 10 campaigns by selected metric (horizontal Recharts `BarChart`)
- **Summary cards**: Total metric + Campaigns Compared. Users metric shows amber `Info` tooltip warning about non-additivity. **Revenue total** uses `financialRevenue` (GA4 + imported sources) instead of breakdown sum — matches Overview tab.
- **Comparison table**: All campaigns sorted by selected metric, top row green, bottom row red. Values scaled proportionally to match `breakdownTotals` (includes Run Refresh data).
- **Revenue Breakdown sub-table**: Separate card below All Campaigns showing Total Revenue (bold), GA4 Revenue, then each imported source with amount. Data from `revenueDisplaySources` — stays in sync with Overview tab. Revenue banner shown above chart when Revenue metric is selected.
- **Revenue attribution**: When imported revenue exists (manual/CSV/Sheets/CRM), per-campaign breakdown shows GA4-attributed revenue only (imported can't be split by campaign). The Revenue Breakdown sub-table shows the full picture.
- **Users non-additivity**: GA4 users are non-additive across breakdown dimensions (dates, devices, sources) AND across campaigns. Per-campaign user counts from the multi-dimensional breakdown are approximate (overcounted). Tooltip warnings on both the Total summary card (when Users selected) and the Users column header in the comparison table. Component requires `TooltipProvider` wrapper for Radix tooltips to render. Tooltip uses `bg-slate-900 text-white` for readability in both light/dark mode.
- **Date range**: Breakdown endpoint uses `endDate: "yesterday"` to exclude partial intraday data, matching `ga4-to-date`. 90-day window (hardcoded) means totals will be lower than Overview Summary (campaign lifetime) for campaigns older than 90 days — this is by design.
- **Accurate metrics**: Sessions, conversions, revenue are additive across breakdown dimensions — sums are correct. Conversion rate is properly computed as `(totalConversions / totalSessions) * 100` (weighted, not averaged).

### GA4 Insights Tab (inline in `ga4-metrics.tsx`)

5 sections: Executive Financials (Spend/Revenue/Profit/ROAS/ROI with sources used — shows "GA4 native revenue" or "Imported" for revenue, spend source labels for spend), Trends (daily/7d/30d/monthly chart + tables — see below), Data Summary (always-visible campaign stats), Insights Summary (total/high/medium counts), Insights List (max 12, severity-sorted).

**Trends section** — 4 modes (Daily / 7d / 30d / Monthly), metric selector (Sessions, Users, Conversions, Revenue, Page Views, Engagement Rate). No date range picker. All data from `ga4DailyRows` (persisted daily facts via `ga4-daily` endpoint, lookback window set during GA4 connection — 30/60/90 days, default 90).

| Mode | Chart | Table |
|------|-------|-------|
| **Daily** | Last 30 days, 1 point per day = that day's raw value | Last 14 days (expandable to 30), each row = 1 day with day-over-day % delta |
| **7d** | 8 data points over 14 days, each = 7-day rolling window total | 2 rows: "Last 7 days" total vs "Prior 7 days" total |
| **30d** | Up to 31 points over 60 days, each = 30-day rolling window total | 2 rows: "Last 30 days" total vs "Prior 30 days" total |
| **Monthly** | BarChart with 1 bar per calendar month = monthly total (weighted avg for rates). Current month bar at 50% opacity. | 1 row per month (most recent first), month-over-month % delta. Current month marked "(partial, N days)". |

- **Chart XAxis**: Daily/7d/30d use numeric (`type="number"`, `dataKey="idx"`) to eliminate Recharts categorical axis padding. Monthly uses categorical `dataKey="date"` on BarChart.
- **Rolling totals**: 7d/30d chart shows rolling window totals (sum of last N days). Engagement rate is a weighted average (engagedSessions/totalSessions) — the only metric that isn't summed. Tooltips: "7-day period ending: MM/DD".
- **Users non-additive**: Users metric is **hidden from the dropdown in 7d/30d/Monthly modes** — GA4 users can't be accurately summed/averaged across dates. Auto-switches to Sessions if Users was selected when entering non-daily mode. Users remains available in Daily mode where per-day counts are accurate.
- **`insightsRollups` memo**: Computes last3/prior3, last7/prior7, last30/prior30 from `ga4TimeSeries`. `byDate` map includes: date, sessions, users, conversions, revenue, pageviews, engagementRate, engagedSessions. Engagement rate computed as weighted average (engagedSessions/totalSessions × 100).
- **Daily table index math**: Uses `sortedIdx = sorted.length - 1 - idx` for O(1) previous-row lookup (not `indexOf` reference scan).

**Data Summary section** — Always visible when `breakdownTotals.sessions > 0` or `breakdownTotals.revenue > 0`. Shows: Sessions (+ daily avg), Conversions (+ CR%), Revenue (+ daily avg), Top Channel (+ share % + channel count). Financial row (when spend exists): Total Spend, Profit (green/red), ROAS (green/red), CPA. Channel Breakdown table (visible when `channels.length >= 1`) showing all traffic sources with sessions, share %, conversions, and Conv. Rate (lowest-CR channel highlighted red only when 2+ channels exist). Channel values are scaled proportionally to match `breakdownTotals` (which includes Run Refresh data). Uses `breakdownTotals`, `insightsRollups.availableDays`, `channelAnalysis` (exposes `channels` array sorted by sessions desc), `financialSpend`, `financialROAS`.

**Insights engine** (`insights` useMemo) generates 6 categories:
- Financial integrity checks (blocked KPIs, mismatched sources, negative ROI, low ROAS)
- KPI performance — channel-enriched recommendations using `channelAnalysis` (lowest-CR channel for conversion KPIs, top revenue/session channels for others)
- Benchmark performance — channel-enriched recommendations (same pattern as KPIs)
- Anomaly detection — WoW deltas: CR drop ≥15% (high), engagement depth drop ≥20% (medium), sessions drop ≥20% (high), revenue drop ≥25% (high), conversions drop ≥20% (high). Requires ≥14 days history. Volume anomalies use `insightsRollups.deltas` and include top channel context.
- Positive signals — sessions/revenue/conversions up WoW, strong ROAS (≥3x), KPIs exceeding target (≥110%). Green "Positive" badge. Minimum volume thresholds to prevent noise.
- Informational insights — always fire with ≥7 days of data, no KPIs required: avg daily sessions (+ CR + conversions/day), engagement rate (with qualitative assessment), top channel (with concentration warning + lowest-CR channel), revenue summary (with ROAS if spend exists). Blue "Info" badge. Ensures Insights tab is never empty when data exists.

**Insight badge colors**: High = red, Medium = amber, Positive (`positive:*` id prefix) = green, Info (`info:*` id prefix) = blue, Low = gray. Badge text matches: "High", "Medium", "Positive", "Info", "Low".

**Insight title grammar**: KPI/Benchmark insight titles must NOT use "X is Needs Attention" pattern. Correct: "X Needs Attention", "X Behind Target". Drop the verb "is" before the status.

**Supporting memos** (defined before `insights` for dependency ordering):
- `insightsRollups`: Last 7d vs Prior 7d, Last 30d vs Prior 30d with pre-computed deltas. CR and engagement rate as proper aggregates.
- `channelAnalysis`: Aggregates `ga4Breakdown.rows` by source/medium. Produces top channel by sessions/revenue, lowest-CR significant channel (≥5% of total sessions). Data comes from `ga4-breakdown` endpoint (90-day window, acquisition dimensions). Channel labels are GA4 source/medium values (e.g., "google / cpc", "facebook / paid_social").

**Data sources**: `ga4-daily` (persisted daily facts), `ga4-to-date` (lifetime totals), `ga4-breakdown` (acquisition channels), financial APIs (spend/revenue). All client-side computation, no dedicated insights endpoint.

**Accuracy (pipeline-verified)**:
- Executive Financials uses the exact same `financialSpend`, `financialRevenue`, `financialROAS`, `financialROI` variables as the Overview tab. No divergence.
- ROAS consistency: `financialROAS` is a ratio (e.g., 48.91). Display: `48.91x`. Insight check: `< 1` (below break-even). KPI/Benchmark ROAS also uses ratio (not percentage). All surfaces show the same value.
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
- **ROAS unit**: GA4 ROAS is stored/displayed as **ratio** (48.91 = 48.91x return). This matches the Overview display. KPI/Benchmark templates use `unit: "ratio"`. LinkedIn ROAS is also stored as ratio. Both are consistent.
- **Scheduler**: `ga4-kpi-benchmark-jobs.ts` records daily `kpiProgress` rows. Uses `getSpendTotalForRange()` (NOT `campaign.spend`) for accurate financial KPIs. After recording progress, updates `kpi.currentValue` so alert checkers use fresh values (not stale stored values).
- **Alert → Notification pipeline**: `checkPerformanceAlerts()` (KPIs) and `checkBenchmarkPerformanceAlerts()` (benchmarks) evaluate thresholds and call `storage.createNotification()`. Triggered by: (1) daily scheduler, (2) KPI create/update endpoints, (3) benchmark create endpoint, (4) mock-refresh. Deduplicates per calendar day. Notifications appear in nav bell + `/notifications` page.
- **Auth**: All KPI CRUD endpoints require `ensureCampaignAccess` or `ensureKpiAccess`. `test-alerts` endpoint requires authenticated user.
- **Cascade delete**: Deleting a KPI also deletes its `kpiProgress` and `kpiAlerts` rows.

**Accuracy (pipeline-verified)**:
- `getLiveKpiValue()` and scheduler `computeKpiValue()` use the **same shared formulas** from `metric-math.ts`: `computeRoiPercent`, `computeCpa`, `computeConversionRatePercent`, `normalizeRateToPercent`. ROAS uses direct ratio (revenue/spend), ROI as percentage, CPA as ratio.
- `breakdownTotals` uses `Math.max(ga4ToDate, dailySummed)` for sessions/conversions/revenue (additive metrics). For **users**, it prefers the deduplicated `ga4-to-date` count (dimension-free GA4 API query) and only falls back to daily sum (overcounted) when unavailable.
- Scheduler prefers `getTotalsWithRevenue` API response for all metrics (deduplicated), falling back to summed daily rows only when API fails.
- Engagement Rate: client uses cumulative weighted average (`engagedSessions / sessions` across all days), scheduler records daily snapshot. This is by design — different time scopes for different purposes.
- Financial metrics (Spend/Revenue/ROAS/ROI/CPA) use the **same sources** as Overview and Insights tabs: `financialSpend`, `financialRevenue`, shared `computeRoasPercent`/`computeRoiPercent`/`computeCpa`.
- `normalizeRateToPercent` handles GA4's inconsistent rate format: if `v ≤ 1` assumes decimal (×100), if `v > 1` assumes already percentage.

### GA4 Reports Tab (inline in `ga4-metrics.tsx`)

Client-side PDF download + optional scheduling. Reports stored in `linkedin_reports` table with `platformType='google_analytics'`. PDF built entirely in browser from already-loaded page data.

**Standard Templates**: Overview, KPIs, Benchmarks, Ad Comparison, Insights (matches LinkedIn Reports pattern exactly). No template is pre-selected on modal open — user must click one. Clicking a template always sets the report name to `GA4 {Template} Report`.

**Generate & Download vs Schedule**: Non-scheduled reports download the PDF immediately (no library save). Only scheduled reports are saved to the reports library. This matches LinkedIn's `handleCreateReport` pattern: `scheduleEnabled ? save to DB : download immediately`.

**Schedule UI**: Both Standard Templates and Custom Report sections include full scheduling capability (frequency, day-of-week/month, quarter timing, time, timezone, email recipients). Matches LinkedIn `LinkedInReportModal.tsx` pattern.

**PDF design** (styled to match LinkedIn PDFs): Google blue header bar with white title, colored section bars per section. Overview: 2-column metric cards in rounded gray boxes. Ad Comparison: table with header row, alternating row backgrounds, Best/Worst summary cards. KPIs: rounded border cards with metric badges, progress bars, status badges. Benchmarks: same card pattern. Insights: bordered cards with colored severity pill badges. Footer: "MimoSaaS Analytics Platform".

**Accuracy (pipeline-verified)**:
- Overview: Uses `financialSpend`, `financialRevenue`, `financialConversions`, `breakdownTotals` — same sources as Overview tab.
- Ad Comparison: Uses `campaignBreakdownAgg` — same data as Campaign Comparison tab.
- Insights: Uses `insights` array (5-category data-driven engine) — same data as Insights tab.
- KPIs: Uses `computeKpiProgress()` → `p.band` for status, `p.attainmentPct` for progress.
- Benchmarks: Uses `computeBenchmarkProgress()` → `p.status` for status, `p.pct` for progress.

**Scheduling**: `report-scheduler.ts` fetches both `linkedin` and `google_analytics` platform reports. GA4 scheduled reports use the same scheduler logic as LinkedIn.

**Report Library**: Cards show schedule badges (frequency + time + timezone), "Last sent" date, created date. Edit prefills all schedule fields including recipients.

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

### Fetch Credentials
All `fetch()` calls to mutation endpoints (POST/PATCH/PUT/DELETE) MUST include `credentials: "include"` so Clerk session cookies are sent. The `apiRequest()` helper in `queryClient.ts` does this automatically, but raw `fetch()` calls do not. Missing credentials causes `ensureCampaignAccess` to fail with 401/500.

### Numeric Input Formatting
Values displayed with comma formatting (e.g., "2,300") MUST be stripped via `stripNumberFormatting()` before sending to the backend. PostgreSQL decimal columns reject comma-formatted strings. Apply to: `currentValue`, `targetValue`, `alertThreshold`, `benchmarkValue`.

### Percentage Formatting
Use `formatPct()` from `shared/metric-math.ts` for all percentage displays. Shows whole numbers when possible (54%), 1 decimal when meaningful (59.3%). Never use `.toFixed(2)` + `%`. For KPI/Benchmark form fields, `formatNumberByUnit()` in `ga4-metrics.tsx` uses smart formatting: % and ratio units get whole/1-decimal, currency gets 2 decimals, count gets 0 decimals.

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
2. `handleCrmSourceClick` checks `crmOAuth` (NOT `crmStatus`) — `crmOAuth` = OAuth tokens exist, `crmStatus` = revenue actually imported
3. If not authenticated → opens OAuth popup window
4. OAuth callback stores tokens → popup closes
5. Wizard step loads (campaign field mapping → crosswalk → pipeline → revenue → review → save)
6. **"Connected" badge** only shows when BOTH OAuth done AND active revenue source exists

### CRM Endpoint Requirements (CRITICAL — enforced by `endpoint-auth-audit.test.ts`)

Every `/api/salesforce/:campaignId/*`, `/api/hubspot/:campaignId/*`, `/api/shopify/:campaignId/*` endpoint MUST:

1. **Have `ensureCampaignAccess`** in the first 10 lines:
   ```typescript
   const campaignId = String(req.params.campaignId || "");
   const ok = await ensureCampaignAccess(req as any, res as any, campaignId);
   if (!ok) return;
   ```

2. **OAuth scopes MUST include `refresh_token`** — without it, tokens expire (~2h for Salesforce) and connections silently die. Default Salesforce scope: `'api id refresh_token'`.

3. **Token refresh errors MUST propagate** — never silently catch and use expired tokens. Throw with a clear message so the endpoint returns a proper error and the UI can prompt re-auth.

4. **Client-side `encodeURIComponent`** takes exactly ONE argument — never pass `{ credentials: "include" }` as a second arg (JS silently ignores it, but it indicates a copy-paste bug).

5. **No duplicate `credentials` in fetch options** — `credentials: "include"` must appear exactly once per fetch call.

These rules are enforced by `server/endpoint-auth-audit.test.ts` (7 tests, <1s). The test scans source code and fails immediately if any rule is violated. Run `npm run test` before every push.

### CRM Edit Mode (CRITICAL — read before modifying HubSpot/Salesforce wizards)

Edit mode must work with **expired OAuth tokens**. All data prefilled from stored `mappingConfig`.

- **Edit opens on Review step** with HubSpot-style settings summary (account, revenue field, campaign field, date field, selected values)
- **Review step NEVER fetches from CRM APIs** — only displays data from stored `mappingConfig`. Labels fall back to raw field names (`"Amount"`, `"Opportunity Name"`).
- **useEffect guards** — CRM API useEffects must handle edit mode gracefully:
  - Properties/Fields (Salesforce): attempts fetch but **suppresses errors** in edit mode — Select dropdown shows fallback `SelectItem` with prefilled raw field name so the user always sees their current selection
  - Unique Values (crosswalk): skip when `selectedValues.length > 0` — instead, synthesize `uniqueValues` from `selectedValues` so checkboxes render
  - Pipelines/Stages: skip when `pipelineStageId`/`pipelineStageName` is prefilled
- **Reconnect flow (Salesforce)** — `isConnecting` stays `true` until the OAuth popup completes (not until popup opens). `handleAuthSuccess` calls `fetchFields()` **directly** (not via useEffect — edit-mode conditions would block it). No red toast on token expiry — inline error with Retry link only.
- **Select dropdown fallback** — Radix Select only shows a value if a matching `SelectItem` exists. When `fields` is empty (expired token), a single fallback `SelectItem` is rendered with the prefilled value so the dropdown isn't blank.
- **handleNext guards** — forward navigation must also skip API calls in edit mode:
  - `!isConnected` check: bypass when `mode === "edit"` (user is editing existing config, not connecting)
  - `fetchUniqueValues()` call: skip when `mode === "edit" && selectedValues.length > 0`
- **Continue button disabled states** — must allow proceeding in edit mode:
  - `!isConnected`: bypass when `mode !== "edit"`
  - `fields.length === 0`: bypass when `mode !== "edit"`
- **Google Sheets edit**: backend preview/process use purpose-agnostic connection fallback; client auto-selects first available connection if stored ID is invalid
- **Salesforce Zod**: `conversionValueField` is `.nullable()` — GA4 context omits it instead of sending null

### HubSpot Pipeline (Proxy)
Available for all platform contexts. Lets users select a HubSpot deal stage (e.g., SQL) as an early pipeline signal for long sales cycles. Optional — default is Revenue-only.

### CRM Date Field Selection
HubSpot revenue wizard includes a date field selector (in Advanced section) controlling which date revenue is reported under:
- **Close Date** (default) — when the deal was won. Recommended for financial reporting.
- **Last Modified Date** — when the deal record was last updated. Useful for LinkedIn exec flows.
- **Created Date** — when the deal was first entered.
Stored in `mappingConfig.dateField`. Backend uses it for HubSpot search query filter. Old configs without `dateField` fall back to platform-specific defaults (GA4=closedate, LinkedIn=hs_lastmodifieddate). Salesforce currently hardcoded to CloseDate (TODO: add same selector).

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
| Sidebar | `components/layout/sidebar.tsx` | Home link + expandable client list with sub-nav |
| Navigation | `components/layout/Navigation.tsx` | Top bar with notifications + user button |
| Column Mapping | `components/GuidedColumnMapping.tsx` | CSV/Sheets column mapping wizard |
| Attribution | `components/AttributionDashboard.tsx` | Attribution model visualization |
| Campaign Chat | `components/CampaignChat.tsx` | AI chat for campaign analysis (OpenRouter) |
| Trend Analysis | `pages/trend-analysis.tsx` | 5-tab executive analytics (Overview, Efficiency, Funnel, Platform, Market) |
| Campaign Creation Wizard | `pages/campaigns.tsx` | 5-step Funnel.io-style wizard (see below) |

### Campaign Creation Wizard (`campaigns.tsx`)

5-step Funnel.io-style modal wizard:

| Step | Title | Content |
|------|-------|---------|
| **1** | Campaign Details | Existing form: name, website, label, budget, currency, start/end dates. Creates draft campaign on "Next". |
| **2** | Select Platform | Clean tile grid of platforms (GA4, Sheets, LinkedIn, Meta, Google Ads, X). Click one → advance. "Skip — connect later" link → jump to Step 5. |
| **3** | Authenticate | Per-platform OAuth component (IntegratedGA4Auth, SimpleGoogleSheetsAuth, LinkedInConnectionFlow, SimpleMetaAuth). On success → advance. GA4 has a "Use test data instead" toggle that bypasses OAuth and loads mock Yesop property for testing. |
| **4** | Configure | Platform-specific setup: GA4 = property selector + lookback window (30/60/90 days) + campaign filter. LinkedIn = account selection. Sheets/Meta = auto-advance (no config). |
| **5** | Confirm & Create | Summary of campaign details + connected platform. "Create Campaign" finalizes draft → active. "Add another platform" → back to Step 2. |

**Key design**: One platform per wizard pass. Additional platforms connected later from Campaign Detail → Connected Platforms.

**State**: `wizardStep` (1-5), `selectedWizardPlatform` (platform ID or null), `wizardPlatformConnected` (boolean), `wizardLookbackDays` (30/60/90, default 90), `wizardGA4TestMode` (boolean). Draft campaign created at end of Step 1 (`draftCampaignId`). Finalized at Step 5 (`handleConnectorsComplete` patches draft → active). Draft cleaned up if modal closed mid-wizard.

**Auth components reused**: `IntegratedGA4Auth`, `SimpleGoogleSheetsAuth`, `LinkedInConnectionFlow`, `SimpleMetaAuth` — rendered inline per step, not as modals.

**GA4 Test Mode**: Step 3 shows "Use test data instead" link below the OAuth component. Clicking it reveals a "Connect Test Property" button that loads the Yesop mock property (`id: "yesop"`) and advances to Step 4 without requiring Google credentials. The backend recognizes `yesop` via `isYesopMockProperty()` and returns simulated data. Toggle back with "Use real Google account instead".

---

## AI Campaign Chat

- **Backend**: `POST /api/campaigns/:id/chat` in `routes-oauth.ts` — gathers campaign context (KPIs, benchmarks, spend/revenue breakdown), builds system prompt, proxies to OpenRouter
- **Frontend**: `CampaignChat.tsx` — chat UI with suggested questions, message bubbles, context badges
- **Model**: `openai/gpt-oss-120b:free` (configurable via `OPENROUTER_MODEL` env var)
- **Auth**: Uses `ensureCampaignAccess` — requires Clerk auth
- **No DB persistence**: Chat history is React state only (no tables, no migrations)
- **Env vars**: `OPENROUTER_API_KEY` (required), `OPENROUTER_MODEL` (optional override)
- **Conversation cap**: Last 20 messages sent to avoid token limits

---

## Trend Analysis (`trend-analysis.tsx`)

5-tab executive analytics page under Campaign DeepDive.

### Tabs
1. **Executive Overview** — 6 summary cards (Spend, Revenue, ROAS, Conversions, CPA, CTR with % change), ComposedChart with metric toggles, anomaly ReferenceDots, KPI target ReferenceLines
2. **Efficiency Metrics** — ROAS/ROI dual-axis, CPA/CPC dual-axis, CTR/Engagement Rate, CPM area chart
3. **Conversion Funnel** — Conversion rate trends, funnel volume (impressions→clicks→conversions), GA4 engagement funnel
4. **Platform Breakdown** — Comparison table (best-value highlighted), spend PieChart, efficiency bars, stacked platform trends
5. **Market Trends** — Google Trends embed widgets (Interest Over Time, Interest by Region, Related Queries). Users configure keywords → saved to campaign → iframes load instantly from user's browser. No server-side API needed (cloud IPs blocked by Google). "View on Google Trends" link opens full Google Trends page.

### Data Layer
- Merges GA4 + LinkedIn + Meta + Google Ads daily metrics by date into unified time series
- Computes daily efficiency: ROAS, ROI, CPA, CPC, CPM, CTR, conversion rate using `shared/metric-math.ts`
- Period selector (7d/14d/30d/90d) shared across all tabs
- Anomaly detection: 2σ (warning) / 3σ (critical) from 7-day rolling mean on raw + efficiency metrics
- Period comparison: fetches `days * 2`, splits into current/previous halves

### Data Sources
- `daily-financials` (spend + revenue by date)
- `ga4-daily?days=N` (GA4 users, sessions, conversions, revenue, engagement)
- `linkedin/:id/daily-metrics` (impressions, clicks, spend, conversions)
- `meta/:id/daily-metrics` (persisted table, NOT live API)
- `google-ads/:id/daily-metrics` (impressions, clicks, spend, conversions)
- `campaigns/:id/kpis` (target reference lines)

---

## UI Libraries & Conventions

- **Icons:** Lucide React (e.g., `Trash2` for delete, `Plus` for add, `Pencil`/`Edit` for edit)
- **Dialogs:** Radix UI AlertDialog for destructive confirmations (NOT native `window.confirm()`)
- **Toasts:** `useToast()` hook from `@/hooks/use-toast`
- **Forms:** React Hook Form + Zod validation
- **Styling:** Tailwind CSS with dark mode support (`dark:` variants)
- **Charts:** Recharts (LineChart, BarChart, PieChart)
- **Date formatting:** `date-fns`
- **Transitions:** All `TabsContent` elements use `fade-in` CSS class (200ms fade + 4px slide). Period-dependent queries use `placeholderData: keepPreviousData` (TanStack React Query v5) so charts stay visible during data refresh, with `chart-transition`/`chart-refreshing` classes for subtle opacity dimming. All analytics pages (GA4, LinkedIn, Meta, Google Ads) scroll to top on mount (`useEffect(() => { window.scrollTo(0, 0); }, [])`) for smooth navigation from campaign detail.
- **Scheduled Reports:** Email recipients are optional for scheduled reports (both GA4 and LinkedIn). Reports can be scheduled without email — they save to the reports library regardless.

---

## Testing

### Test Layers

| Layer | Count | Command | What it proves |
|-------|-------|---------|---------------|
| **Unit tests** | 212+ | `npm run test` | Math formulas, revenue/spend additivity, template gates, credentials audit, endpoint auth audit, cross-tab propagation, formatPct/formatNumberByUnit |
| **E2E tests** | 131 | `npm run test:e2e:headed` | App doesn't crash, tabs load, buttons work, modals open |
| **Manual test plan** | 16 journeys | `GA4-MANUAL-TEST-PLAN.md` | Full data flow, cross-tab consistency, data accuracy |

### Key Test Files

| File | Purpose |
|------|---------|
| `server/ga4-cross-tab-consistency.test.ts` | 109 unit tests — all 5 yesop profiles × all formulas |
| `server/metric-math.test.ts` | Core math: ROAS, ROI, CPA, CR, progress |
| `server/kpi-math.test.ts` | KPI band classification, attainment |
| `server/revenue-additivity.test.ts` | financialRevenue additive, ROAS ratio consistency, formatPct |
| `server/mock-refresh-accumulation.test.ts` | Simulation + DB aggregation, sequential dates, no spend/revenue records |
| `server/cross-tab-propagation.test.ts` | Spend/revenue changes → ROAS/CPA/KPI progress updates |
| `server/spend-and-template-gates.test.ts` | Spend additivity, KPI/Benchmark template gates, formatNumberByUnit |
| `server/fetch-credentials-audit.test.ts` | Scans 10 wizard files for missing credentials, deactivation audit |
| `server/endpoint-auth-audit.test.ts` | Scans CRM endpoints for missing auth guards, OAuth scope, token refresh, client fetch bugs |
| `e2e/ga4-refresh-validation.spec.ts` | 131 E2E tests — UI journeys |
| `GA4-MANUAL-TEST-PLAN.md` | 16 manual test journeys — data flow verification |

### Test Execution Order

1. `npm run test` — 212 unit tests (instant, catches regressions)
2. `npm run test:e2e:headed` — 131 E2E tests (browser, ~30 min)
3. Walk through `GA4-MANUAL-TEST-PLAN.md` Journeys 1-15 (manual, catches data flow bugs)
4. Journey 16 — real integration tests (when real accounts available)

### Future: E2E Data Flow Tests

After all platform flows (GA4, LinkedIn, Meta, Google Ads) are manually tested, build Playwright tests that verify actual data values after actions. Shared framework: ~80% shared patterns (add source → verify propagation) + ~20% platform-specific (connection flow, unique metrics). Adding new platforms = mostly configuration.

### Mock System (Yesop) — For Testing & Demos

5 UTM campaign profiles with deterministic values per day:

| Campaign | Sessions | Conversions | Revenue | Spend | Source / Medium |
|----------|----------|-------------|---------|-------|-----------------|
| yesop_brand_search | 750 | 38 | $2,850 | $950 | google / cpc |
| yesop_prospecting | 420 | 18 | $1,350 | $680 | google / cpc |
| yesop_retargeting | 260 | 22 | $1,650 | $410 | google / display |
| yesop_email_nurture | 180 | 12 | $900 | $150 | newsletter / email |
| yesop_paid_social | 375 | 15 | $1,125 | $750 | facebook / paid_social |

- **Simulation configs**: `simulateGA4()` has distinct configs for 7/30/60/90-day ranges. Lookback window selection (30/60/90 days) controls which config is used, producing proportionally different totals (e.g., 60-day ≈ 2× 30-day values).
- **Run Refresh** writes GA4 daily metrics to DB only (sessions, conversions, revenue). Does NOT create spend or revenue records. Each click writes to a sequential date (offset by existing row count) so data accumulates.
- `ga4-to-date` and `ga4-daily` aggregate simulation baseline + DB rows from Run Refresh (additive, not replacement).
- **Run Refresh button** currently visible for any connected GA4 property (staging/testing). Will be hidden behind env var (`SHOW_MOCK_REFRESH`) when deploying to production clients. Each click: writes daily metrics, runs KPI/benchmark progress, triggers alert checking, auto-cleans stale "GA4 Revenue" and "Mock Spend" sources from older code.
- Select 2 campaigns → Run Refresh → both campaigns' data aggregated (e.g., brand + prospecting = 1,170 sessions/day).

### Pre-Push Checklist (MANDATORY)

After EVERY code change, before committing and pushing:

1. `npm run test` — 212 unit tests, ~3 seconds. Must all pass.
2. `npx vite build` — compile check, ~20 seconds. Must succeed.
3. Both pass → commit and push.
4. Either fails → fix before pushing. Never push broken code.

### Running Tests

```bash
npm run test                    # Unit tests (instant, no browser) — RUN BEFORE EVERY PUSH
npx vite build                  # Compile check — RUN BEFORE EVERY PUSH
npm run test:e2e:headed         # E2E tests (browser opens, ~30 min)
npx playwright show-report      # View HTML report with screenshots
npx playwright test --update-snapshots  # Update visual baselines after UI changes
```
