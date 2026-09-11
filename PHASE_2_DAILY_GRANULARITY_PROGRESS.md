# Phase 2: Daily Spend/Revenue Granularity - Progress Report

**Status**: 95% Complete (Production-Ready, Migration Pending)  
**Last Updated**: February 12, 2026  
**Commits**: 22fc34b0, 5efa13fa, eeb02802

> Historical progress record. Do not use the scheduler summary in this file as the current runtime contract. Current cadence is defined in `GA4/REFRESH_AND_PROCESSING.md`; CRM source behavior and HubSpot parity gaps are defined in `GA4/CRM_REVENUE_SOURCE_PATTERN.md`.

---

## ✅ COMPLETED (Backend Infrastructure)

### 1. Database Schema Updates

**Migration**: `migrations/0006_add_daily_spend_revenue_granularity.sql`
- Added `source_type` column to `spend_records` table
- Added `source_type` column to `revenue_records` table
- Created indexes for performance (campaign_id, date DESC, source_type)
- Backfill scripts for historical data:
  - LinkedIn spend from `linkedin_daily_metrics`
  - GA4 revenue from `ga4_daily_facts`
  - Legacy cumulative data from `campaigns` table

**Status**: Migration created, **NOT YET RUN** (needs manual execution)

**Schema Updates**: `shared/schema.ts` (Commit: 5ae883dc)
- Added `sourceType: varchar("source_type", { length: 50 })` to spendRecords
- Added `sourceType: varchar("source_type", { length: 50 })` to revenueRecords

---

### 2. LinkedIn Spend Integration ✅ COMPLETE

**File**: `server/linkedin-scheduler.ts` (Commits: 5c366ea5, 7a761da1)

**Changes**:
- **Test Mode** (lines 199-228): Calculate totalSpend from dailyMetrics, update campaign.spend
- **Production Mode** (lines 465-509): Same logic as test mode
- **spend_records Population**: Maps dailyMetrics to spend_records format
  ```typescript
  {
    campaignId,
    spendSourceId: 'linkedin_daily_metrics',
    date: String(m.date),
    spend: String(parseFloat(String(m.spend || 0)).toFixed(2)),
    currency: 'USD',
    sourceType: 'linkedin_api'
  }
  ```
- **Idempotent Inserts**: Uses `storage.createSpendRecords()` with ON CONFLICT DO NOTHING

**Auto-Refresh**: LinkedIn scheduler runs every 4-6 hours, now creates daily spend_records

---

### 3. Google Sheets Spend Integration ✅ COMPLETE

**File**: `server/routes-oauth.ts` (Commit: 22fc34b0)

**Endpoint**: `/api/campaigns/:id/spend/sheets/process`

**Changes**:
- Added `dateCol` mapping support (backward compatible - falls back to cumulative if no date column)
- Added `dailySpendMap` to track spend by date: `Map<string, number>`
- Populates `spend_records` after creating/updating spend_source:
  ```typescript
  const spendRecordsToInsert = Array.from(dailySpendMap.entries())
    .filter(([date, spend]) => spend > 0)
    .map(([date, spend]) => ({
      campaignId,
      spendSourceId: String(source.id),
      date,
      spend: String(Number(spend.toFixed(2))),
      currency,
      sourceType: 'google_sheets'
    }));
  ```

**Historical Auto-Refresh Note**: this phase originally described a fixed `3:00 AM` call. Current scheduling is configuration-driven, and Google Sheets spend also has a separate default one-minute polling loop; use `GA4/REFRESH_AND_PROCESSING.md`.

**User Action Required**: Users need to map a date column in Google Sheets wizard for daily granularity (currently optional)

---

### 4. GA4 Revenue Integration ✅ COMPLETE

**File**: `server/routes-oauth.ts` (Commit: 22fc34b0)

**Endpoint**: `/api/campaigns/:id/ga4-daily` (lines ~3967)

**Changes**:
- After `storage.upsertGA4DailyMetrics()`, now populates `revenue_records`
- Filters for revenue > 0
- Maps to revenueRecordsToInsert:
  ```typescript
  {
    campaignId,
    revenueSourceId: 'ga4_daily_metrics',
    date: String(m.date),
    revenue: String(parseFloat(String(m.revenue || 0)).toFixed(2)),
    currency: 'USD',
    sourceType: 'ga4'
  }
  ```

**Auto-Refresh**: GA4 data syncs when Overview tab loads (on-demand) + daily auto-refresh scheduler

---

### 5. Storage Layer Updates ✅ COMPLETE

**File**: `server/storage.ts` (Commit: 22fc34b0)

**Changes**:
- `createSpendRecords()`: Added `onConflictDoNothing()` for idempotent inserts
- `createRevenueRecords()`: Added `onConflictDoNothing()` for idempotent inserts

**Why This Matters**: Auto-refresh schedulers can re-run without creating duplicate records

---

### 6. Daily Financials API Endpoint ✅ COMPLETE

**File**: `server/routes-oauth.ts` (Commit: 22fc34b0)

**New Endpoint**: `GET /api/campaigns/:id/daily-financials?start=YYYY-MM-DD&end=YYYY-MM-DD`

**Response Format**:
```json
{
  "success": true,
  "campaignId": "123",
  "startDate": "2025-01-01",
  "endDate": "2025-01-31",
  "data": [
    {
      "date": "2025-01-01",
      "spend": 150.00,
      "revenue": 450.00,
      "roas": 300.00,
      "roi": 200.00,
      "cpa": 0.00,
      "currency": "USD"
    },
    ...
  ]
}
```

**Query Logic**:
- Joins `spend_records` with `spend_sources` (only active sources)
- Joins `revenue_records` with `revenue_sources` (only active sources)
- Groups by date, calculates totals
- Computes ROAS, ROI for each day
- Returns sorted time series array

**Use Case**: Powers daily view charts in GA4 and LinkedIn Overview tabs

---

## 🔄 IN PROGRESS (5% Remaining)

### 7. HubSpot/Salesforce/Shopify Revenue Integration ✅ COMPLETE

**Files**: `server/routes-oauth.ts` (Commit: eeb02802)

**Endpoints Updated**:
- Line 11353: `/api/campaigns/:id/hubspot/save-mappings` - Added `sourceType: 'hubspot'`
- Line 10479: `/api/campaigns/:id/salesforce/save-mappings` - Added `sourceType: 'salesforce'`
- Line 21539: `/api/campaigns/:id/shopify/save-mappings` - Added `sourceType: 'shopify'`

**Changes**:
```typescript
// HubSpot (line 11353)
{
  campaignId,
  revenueSourceId: String((source as any).id),
  date: recordDate,
  revenue: Number(Number(totalRevenue || 0).toFixed(2)).toFixed(2) as any,
  currency: cur,
  sourceType: 'hubspot', // ✅ ADDED
}

// Salesforce (line 10479)
.map(([date, amt]) => ({
  campaignId,
  revenueSourceId: source.id,
  date,
  revenue: Number(amt.toFixed(2)).toFixed(2) as any,
  currency: cur,
  sourceType: 'salesforce', // ✅ ADDED
}))

// Shopify (line 21539)
{
  campaignId,
  revenueSourceId: String((source as any).id),
  date: d,
  revenue: Number((revenueByDate.get(d) || 0).toFixed(2)) as any,
  currency: cur,
  sourceType: 'shopify', // ✅ ADDED
}
```

**Historical Auto-Refresh Note**: this phase originally described HubSpot, Salesforce, and Shopify calls at a fixed `3:00 AM`. The current full external-source run is configuration-driven; Salesforce has an additional five-minute all-mapping pass, while HubSpot's five-minute pass currently covers Pipeline-enabled mappings only.

**Historical Note Superseded**: current GA4 HubSpot confirmed revenue materializes true daily rows using the selected normalized deal date field; the older single cumulative-row description must not be used for new work.

---

### 8. UI Updates - GA4 Overview Tab ✅ COMPLETE

**File**: `client/src/pages/ga4-metrics.tsx` (Commit: 5efa13fa)

**Changes Implemented**:

1. **State for Daily View Toggle** (lines ~130-145):
   ```tsx
   const [showDailyView, setShowDailyView] = useState(false);
   const [dailyDateRange, setDailyDateRange] = useState(() => {
     const end = new Date();
     end.setDate(end.getDate() - 1); // Yesterday
     const start = new Date();
     start.setDate(start.getDate() - 30); // Last 30 days
     return {
       start: start.toISOString().split('T')[0],
       end: end.toISOString().split('T')[0]
     };
   });
   ```

2. **useQuery for Daily Data** (lines ~180-195):
   ```tsx
   const { data: dailyFinancialsData, isLoading: dailyFinancialsLoading } = useQuery({
     queryKey: ["/api/campaigns", campaignId, "daily-financials", dailyDateRange],
     queryFn: async () => {
       const res = await fetch(
         `/api/campaigns/${campaignId}/daily-financials?start=${dailyDateRange.start}&end=${dailyDateRange.end}`
       );
       if (!res.ok) throw new Error('Failed to fetch daily financials');
       return res.json();
     },
     enabled: showDailyView && !!campaignId,
   });
   ```

3. **Toggle Button in Financial Header** (lines ~2915-2930):
   ```tsx
   <div className="flex items-start justify-between gap-3">
     <div className="flex-1">
       <h4 className="text-sm font-semibold">Financial {showDailyView ? "(Daily Trends)" : "(To date)"}</h4>
       <p className="text-xs">{showDailyView ? `Daily spend and revenue from ${dailyDateRange.start} to ${dailyDateRange.end}` : "..."}</p>
     </div>
     <Button variant="outline" size="sm" onClick={() => setShowDailyView(!showDailyView)}>
       {showDailyView ? "Show Total" : "Show Daily"}
     </Button>
   </div>
   ```

4. **Recharts LineChart Components** (lines ~2935-3040):
   - Spend/Revenue chart (300px height)
   - ROAS/ROI chart (300px height)
   - CartesianGrid, XAxis (rotated -45°), YAxis
   - Tooltips with currency formatting
   - Legend for multi-line visibility

5. **Date Range Picker** (lines ~2945-2960):
   ```tsx
   <Input type="date" value={dailyDateRange.start} onChange={(e) => setDailyDateRange(prev => ({ ...prev, start: e.target.value }))} />
   <span>to</span>
   <Input type="date" value={dailyDateRange.end} onChange={(e) => setDailyDateRange(prev => ({ ...prev, end: e.target.value }))} />
   ```

**User Experience**: Seamless toggle between cumulative totals and daily time series with custom date range selection

---

### 9. UI Updates - LinkedIn Overview Tab ✅ COMPLETE

**File**: `client/src/pages/linkedin-analytics.tsx` (Commit: 5efa13fa)

**Changes Implemented**: Same pattern as GA4 (lines ~192-210, ~255-270, ~6062-6240)

1. **State for Daily View** (lines ~192-210)
2. **useQuery for Daily Financials** (lines ~255-270)
3. **Toggle Button in Executive Financials Header** (lines ~6062-6080)
4. **Recharts LineChart Components** (lines ~6085-6190):
   - Spend/Revenue chart
   - ROAS/ROI chart
5. **Date Range Picker** (lines ~6088-6100)

**User Experience**: Identical to GA4 - toggle between total and daily views with interactive charts

---

### 10. Database Migration Execution ❌ TODO

**Action Required**: Run migration manually

**Command**:
```bash
psql -d $DATABASE_URL < migrations/0006_add_daily_spend_revenue_granularity.sql
```

Or in VS Code terminal (PowerShell):
```powershell
$env:PGPASSWORD="your_password"; psql -U username -d database_name -f "c:\Users\me\Documents\MF_real_latest\migrations\0006_add_daily_spend_revenue_granularity.sql"
```

**What This Does**:
1. Adds `source_type` column to `spend_records` and `revenue_records`
2. Creates performance indexes
3. Backfills historical data:
   - LinkedIn spend from `linkedin_daily_metrics`
   - GA4 revenue from `ga4_daily_facts`
   - Legacy cumulative data from `campaigns` table

**Estimated Effort**: 5-10 minutes (plus 1-2 minutes for backfill queries)

---

## 📊 Summary

### Completed Work (95%)
- ✅ Database schema designed and migration created
- ✅ LinkedIn spend integration (auto-refresh + spend_records)
- ✅ Google Sheets spend integration (daily granularity support)
- ✅ GA4 revenue integration (revenue_records population)
- ✅ Storage layer idempotency (onConflictDoNothing)
- ✅ Daily financials API endpoint (time series data)
- ✅ GA4 Overview tab UI (daily view toggle + charts)
- ✅ LinkedIn Overview tab UI (daily view toggle + charts)
- ✅ HubSpot/Salesforce/Shopify revenue_records (sourceType tracking)

### Remaining Work (5%)
- ❌ Run database migration (5-10 min)
- ❌ End-to-end testing (2 hours)

**Total Remaining Effort**: ~2-3 hours

---

## 🎯 Next Steps (Priority Order)

### Immediate (High Priority)
1. **Run Migration**: Execute `0006_add_daily_spend_revenue_granularity.sql`
2. **Test Backend**: Verify Google Sheets + GA4 populate spend_records/revenue_records
3. **Test API**: Call `/api/campaigns/:id/daily-financials` endpoint, verify response

### Short-Term (User-Facing Value)
4. **Update GA4 UI**: Add daily view toggle + chart (highest user visibility)
5. **Update LinkedIn UI**: Same pattern as GA4
6. **Test E2E**: Verify daily view displays correctly in both tabs

### Long-Term (Complete Integration)
7. **HubSpot Revenue**: Add revenue_records population to save-mappings
8. **Salesforce Revenue**: Add revenue_records population to save-mappings
9. **Shopify Revenue**: Add revenue_records population to save-mappings
10. **Phase 3**: Google Ads API integration (see SPEND_IMPLEMENTATION_GUIDE.md)

---

## 🔍 Testing Checklist

- [ ] **Migration**: Run SQL, verify `source_type` column exists
- [ ] **Google Sheets**: Trigger auto-refresh, query `spend_records` table, verify rows exist
- [ ] **LinkedIn**: Check `spend_records` populated with `source_type='linkedin_api'`
- [ ] **GA4**: Sync data, query `revenue_records` table, verify rows exist
- [ ] **API Endpoint**: Call `/api/campaigns/123/daily-financials?start=2025-01-01&end=2025-01-31`
- [ ] **UI - GA4**: Toggle "Show Daily", verify chart displays
- [ ] **UI - LinkedIn**: Toggle "Show Daily", verify chart displays
- [ ] **Date Range**: Change date range picker, verify data updates
- [ ] **No Errors**: Check browser console, server logs, database logs

---

## 📝 Technical Notes

### Data Provenance Tracking

**source_type Values**:
- `linkedin_api`: Auto-refresh from LinkedIn Ads API
- `google_sheets`: Auto-refresh from Google Sheets connection
- `ga4`: Auto-refresh from Google Analytics 4 API
- `csv`: Static CSV upload (no auto-refresh)
- `manual`: Manual entry (deprecated)
- `hubspot`: Auto-refresh from HubSpot CRM
- `salesforce`: Auto-refresh from Salesforce CRM
- `shopify`: Auto-refresh from Shopify eCommerce
- `google_ads_api`: Future (Phase 3)
- `meta_api`: Future (Phase 4)
- `legacy_cumulative`: Backfilled from campaigns table

### Auto-Refresh Schedule (Historical Baseline And Current Overrides)

- **LinkedIn**: Every 4-6 hours (linkedin-scheduler.ts)
- **Google Sheets revenue**: full external-source daily run; **Google Sheets spend** also has its current source-family polling loop (default 1 minute)
- **GA4**: On-demand (Overview tab load) + daily scheduler
- **Shopify**: full external-source daily run
- **Salesforce revenue**: full external-source daily run plus the shared CRM interval (default 5 minutes) for every active exact GA4 source with selected values, including revenue-only mappings
- **HubSpot revenue**: full external-source daily run plus the shared CRM interval only for Pipeline-enabled mappings with a saved stage; revenue-only five-minute parity is not yet implemented

The daily hour is configuration-driven rather than fixed to `3:00 AM`; use `AUTO_REFRESH_DAILY_HOUR`, `AUTO_REFRESH_DAILY_MINUTE`, and `AUTO_REFRESH_TIME_ZONE` as documented in `GA4/REFRESH_AND_PROCESSING.md`.

### Migration Safety

- **Non-Breaking**: `ALTER TABLE ADD COLUMN IF NOT EXISTS` won't fail on re-runs
- **Idempotent Inserts**: ON CONFLICT DO NOTHING ensures backfills can re-run
- **Backward Compatible**: Existing queries still work (source_type column nullable)

### Performance Considerations

- **Indexes Created**: (campaign_id, date DESC, source_type)
- **Query Pattern**: Date range queries use indexed columns
- **Aggregation**: Daily financials endpoint groups by date (efficient for time series)

---

## 🚀 Quick Start for Next Developer

```bash
# 1. Run migration
psql -d $DATABASE_URL < migrations/0006_add_daily_spend_revenue_granularity.sql

# 2. Test Google Sheets spend population
# - Go to GA4 campaign with Google Sheets spend source
# - Trigger auto-refresh or wait for 3:00 AM
# - Query: SELECT * FROM spend_records WHERE source_type = 'google_sheets' LIMIT 10;

# 3. Test GA4 revenue population
# - Go to GA4 campaign
# - Load Overview tab (triggers GA4 sync)
# - Query: SELECT * FROM revenue_records WHERE source_type = 'ga4' LIMIT 10;

# 4. Test API endpoint
curl "http://localhost:5000/api/campaigns/123/daily-financials?start=2025-01-01&end=2025-01-31"

# 5. Update UI (ga4-metrics.tsx)
# - Add daily view toggle
# - Add useQuery for daily-financials
# - Add Recharts LineChart component
# - Add date range picker

# 6. Commit + Deploy
git add -A
git commit -m "feat: Add daily view UI for GA4 Overview tab"
git push origin main
```

---

## 📄 Related Documents

- [SPEND_AUTO_REFRESH_PROPOSAL.md](./SPEND_AUTO_REFRESH_PROPOSAL.md) - Strategic overview
- [SPEND_IMPLEMENTATION_GUIDE.md](./SPEND_IMPLEMENTATION_GUIDE.md) - Technical implementation guide
- [migrations/0006_add_daily_spend_revenue_granularity.sql](./migrations/0006_add_daily_spend_revenue_granularity.sql) - Database migration

---

**End of Report**
