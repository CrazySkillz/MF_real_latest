# MetricMind (MF_real_latest) — Architecture Reference

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
