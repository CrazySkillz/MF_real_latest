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
Source (CSV, Sheets, LinkedIn API, Meta API, Manual)
  → spendSources (definition)
  → spendRecords (daily normalized rows: date, spend, currency, platformContext)
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
- `DELETE /api/campaigns/:id/spend-sources/:sourceId` — remove a spend source + its records

### Revenue Cards
- **GA4 page** (`ga4-metrics.tsx`): `financialRevenue` = GA4 native revenue only (falls back to imported if no GA4 revenue metric). This is platform-specific — do NOT add CRM revenue here. No add/edit icons on the GA4 Total Revenue card.
- **Campaign Overview** (`campaign-detail.tsx`): Uses `outcome-totals` endpoint which returns unified cross-platform revenue (GA4 + CRM offsite sources). This is the right place for combined totals. Shows micro copy breakdown, "+" icon opens Add Revenue modal, edit icon opens existing source.

### Spend Cards (GA4 Overview)
- **Total Spend**: Uses `financialSpend` (prefers `spend-breakdown` total, falls back to `spend-to-date`). Shows "+" icon to add sources and per-source breakdown with edit/trash icons when sources exist. Shows "Add Spend" prompt when no spend exists.
- **Latest Day Spend**: Queries `/spend-daily?date=yesterday` for imported spend, falls back to GA4 daily row data.
- **Empty state gate**: Card shows populated view when `spendBreakdownResp.sources.length > 0 OR financialSpend > 0` (prevents showing $0 when breakdown hasn't loaded but spend exists).
- Per-source trash uses AlertDialog confirmation → `DELETE /api/campaigns/:id/spend-sources/:sourceId`.

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
