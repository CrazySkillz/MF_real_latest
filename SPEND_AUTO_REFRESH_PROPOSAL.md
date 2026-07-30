# GA4 Spend Auto-Refresh Implementation Proposal

**Status**: Historical proposal; GA4 Manual Spend creation/editing is now blocked, with exact legacy deletion only
**Last Updated**: July 30, 2026

## Executive Summary

**Strategic Decisions Made**:
1. ✅ **CSV Mode**: Keep with prominent warning about no auto-updates
2. ✅ **Manual Entry**: Deprecated (removed from UI, never used)
3. ✅ **LinkedIn Ads API**: Extend to fetch daily spend data
4. 🚀 **Google Ads API**: Implement OAuth and daily spend fetching (Priority)
5. 🚀 **Meta Ads API**: Implement OAuth and daily spend fetching (Priority)
6. 🚀 **Daily Granularity**: Add spend_records and revenue_records tables (Phase 2)
7. 📋 **Insights Tab**: Will follow LinkedIn Insights pattern with daily deltas (after other tabs)

---

## Problem Statement

Currently, GA4 spend data updates are **mostly manual**:

1. **CSV Spend**: User uploads CSV → Spend calculated → **NEVER auto-updates** (becomes stale immediately)
2. **Google Sheets Spend**: Retained continuity only; new GA4 setup and certification work are on hold
3. **Legacy Manual Spend**: Unsupported retained value → **no creation/editing; exact reviewed deletion only**
4. **Paste Spend**: Same as CSV → **NEVER auto-updates**

**Result**: Spend data is stale, requiring users to manually re-upload CSVs every day to keep ROAS/ROI/CPA accurate.

---

## Root Cause Analysis

### 1. **Scheduler Only Handles Google Sheets**

From `server/auto-refresh-scheduler.ts`:
```typescript
const spendSources = await storage.getSpendSources(campaignId);
const sheetSpend = spendSources.find((s: any) => 
  s.isActive && s.sourceType === "google_sheets"  // ❌ Only Sheets!
);
if (sheetSpend && spendCfg?.connectionId && spendCfg?.spendColumn) {
  await reprocessGoogleSheetsSpend(campaignId, spendCfg);
}
```

**Why CSV is ignored**:
- CSV files are uploaded once → File buffer is processed → **File is discarded**
- No stored connection to the original CSV file
- No way to re-fetch updated data

### 2. **No Daily Spend Tracking**

All spend is stored as **cumulative "to date"** totals:
```typescript
await storage.updateCampaign(campaignId, { 
  spend: totalSpend  // ❌ Single cumulative number
});
```

**Problems**:
- Can't track **daily spend trends**
- Can't calculate **daily ROAS/ROI/CPA**
- Can't detect **budget pacing issues**

### 3. **CSV Data is Ephemeral**

From `routes-oauth.ts`:
```typescript
const file = req.file as any;
const csvText = Buffer.from(file.buffer).toString("utf-8");
const parsed = parseCsvText(csvText);
// Process rows → Calculate spend → Discard file ❌
```

**No persistence** = No auto-refresh capability

---

## Proposed Solution

### **Option 1: Google Sheets as Primary Spend Source (Recommended)**

**Strategy**: Encourage users to maintain spend in Google Sheets → Auto-refresh works automatically

**Implementation**:
1. **UX Update**: When user selects CSV upload, show:
   ```
   💡 Pro Tip: Upload this CSV to Google Sheets for automatic daily updates!
   
   [Continue with CSV (manual updates)] [Upload to Google Sheets (auto-updates)]
   ```

2. **Google Sheets Onboarding**:
   - User uploads CSV to their Google Drive
   - Connects via OAuth
   - Daily auto-refresh works immediately

**Pros**:
- ✅ **Zero code changes** to scheduler (already works)
- ✅ **Zero infrastructure** (Google Sheets is free)
- ✅ Users can **manually edit** spend in Sheets
- ✅ **Multi-platform aggregation** (combine Google Ads + Meta + TikTok in one sheet)

**Cons**:
- ❌ Requires users to maintain a Google Sheet
- ❌ Extra step vs direct CSV upload

---

### **Option 2: Store CSV Data for Auto-Refresh (Complex)**

**Strategy**: Store raw CSV data in database → Re-process daily from stored data

**Database Schema Changes**:
```sql
ALTER TABLE spend_sources ADD COLUMN raw_data TEXT;  -- Store CSV rows as JSON
ALTER TABLE spend_sources ADD COLUMN auto_refresh_enabled BOOLEAN DEFAULT false;
```

**Implementation**:
```typescript
// On CSV upload
const source = await storage.createSpendSource({
  campaignId,
  sourceType: "csv",
  autoRefreshEnabled: true,  // ✅ Enable auto-refresh
  rawData: JSON.stringify(parsed.rows),  // ✅ Store CSV rows
  mappingConfig: JSON.stringify(mapping)
});

// In scheduler
const csvSpend = spendSources.find(s => 
  s.sourceType === "csv" && s.autoRefreshEnabled
);
if (csvSpend) {
  const rows = JSON.parse(csvSpend.rawData);
  // Re-process rows daily using stored mappingConfig
  await reprocessCsvSpend(campaignId, rows, csvSpend.mappingConfig);
}
```

**Pros**:
- ✅ **True auto-refresh** for CSV uploads
- ✅ No Google Sheets dependency

**Cons**:
- ❌ **Stale data**: CSV is a snapshot from upload day
- ❌ **Database bloat**: Storing large CSVs (could be 10,000+ rows)
- ❌ **Still requires manual re-upload** when ad spend changes
- ❌ **Complex**: New database columns, migration, backward compatibility

**Verdict**: ❌ **Not recommended** - Storing static CSV data doesn't solve the core problem (stale data)

---

### **Option 3: Daily Spend Granularity (Enhancement)**

**Strategy**: Track spend **per day** (not cumulative totals)

**Database Schema**:
```sql
CREATE TABLE spend_records (
  id SERIAL PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  spend_source_id TEXT NOT NULL,
  date DATE NOT NULL,
  spend DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(spend_source_id, date)
);
```

**Implementation**:
```typescript
// When processing CSV with date column
for (const row of rows) {
  const date = parseDate(row[dateColumn]);
  const spend = parseNum(row[spendColumn]);
  
  await storage.createSpendRecord({
    campaignId,
    spendSourceId: source.id,
    date,
    spend,
    currency
  });
}

// Query spend for date range
const dailySpend = await storage.getSpendByDateRange(
  campaignId, 
  startDate, 
  endDate
);
// Returns: [{ date: '2026-02-01', spend: 125.50 }, ...]
```

**Benefits**:
- ✅ **Daily ROAS/ROI/CPA** calculations
- ✅ **Spend trends** over time
- ✅ **Budget pacing** alerts
- ✅ Matches **GA4 daily granularity**

**Cons**:
- ❌ **Major refactor**: Spend is currently `campaigns.spend` (single field)
- ❌ **Breaking change**: Existing spend sources would need migration
- ❌ **Doesn't solve auto-refresh** (still need Option 1 or 2)

**Verdict**: ✅ **Recommended as future enhancement** (after auto-refresh is solved)

---

## Implementation Roadmap

### **Phase 1A: UX Improvements (COMPLETED - February 12, 2026)**

**Goal**: Immediate warnings to guide users toward auto-refreshing sources

**Changes Completed**:
1. ✅ **CSV Warning Added**: Prominent alert when CSV mode selected  
   - "⚠️ CSV data won't auto-update. Consider using Google Sheets for automatic daily refreshes"
   - Uses AlertCircle icon with amber styling

2. ✅ **Paste Warning Added**: Same warning for paste mode  
   - Maintains consistency across static data entry methods

3. ✅ **Manual Entry Removed**: Deprecated from UI  
   - Removed "Manual" button from mode selection
   - Removed manual entry form
   - Database support retained for legacy data

**Code Changes**:
- File: `client/src/components/AddSpendWizardModal.tsx`
- Type: `SpendSourceMode = "google_sheets" | "upload" | "paste"` (removed "manual")
- Import: Added `AlertCircle` from lucide-react
- UI: Added warning cards for CSV and Paste modes

**Impact**: Users now clearly understand which sources auto-refresh vs require manual updates

---

### **Phase 1B: LinkedIn Ads API Spend Integration (Next - 1 week)**

**Goal**: Extend existing LinkedIn OAuth to fetch daily spend data

**Implementation Plan**:
1. Update LinkedIn API queries to include spend metrics
2. Modify `linkedin-scheduler.ts` to fetch and store daily spend alongside conversions
3. Add spend_records for LinkedIn campaigns (requires Phase 2 tables)
4. Update LinkedIn dashboard to show spend + ROAS/ROI/CPA

**API Endpoints**:
- LinkedIn Ads API: `/adAnalytics` endpoint includes `costInLocalCurrency`
- Already have OAuth tokens (reuse existing connection)

**Effort**: 1 week  
**Impact**: High (LinkedIn becomes fully auto-refreshing platform)

---

### **Phase 2: Daily Granularity Architecture (2-4 weeks)**

### **Phase 2: Daily Granularity Architecture (2-4 weeks)**

**Goal**: Track spend and revenue per day (not cumulative totals)

**Database Schema**:
```sql
CREATE TABLE spend_records (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id),
  record_date DATE NOT NULL,
  spend DECIMAL(10,2) NOT NULL,
  source_id INTEGER REFERENCES spend_sources(id),
  source_type VARCHAR(50),  -- 'google_sheets', 'google_ads_api', 'meta_api', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, record_date, source_id)
);

CREATE TABLE revenue_records (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id),
  record_date DATE NOT NULL,
  revenue DECIMAL(10,2) NOT NULL,
  source_id INTEGER REFERENCES revenue_sources(id),
  source_type VARCHAR(50),  -- 'ga4', 'hubspot', 'salesforce', etc.
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(campaign_id, record_date, source_id)
);

CREATE INDEX idx_spend_records_campaign_date ON spend_records(campaign_id, record_date);
CREATE INDEX idx_revenue_records_campaign_date ON revenue_records(campaign_id, record_date);
```

**Migration Strategy**:
1. **Existing Cumulative Data**: Create single record with earliest available date
2. **Google Sheets Connections**: Re-fetch all rows, populate daily records
3. **CSV Uploads**: Prompt user: "Upload contains daily data? Map date column"
4. **Backfill**: Optional historical data import for last 30-90 days

**Query Updates**:
```typescript
// OLD: Direct field access
const totalSpend = campaign.spend;

// NEW: Sum from daily records
const totalSpend = await db.query(
  `SELECT SUM(spend) as total FROM spend_records 
   WHERE campaign_id = $1 AND record_date <= $2`,
  [campaignId, endDate]
);
```

**UI Updates**:

**Overview Tab** (cumulative + daily views):
- Keep cumulative totals at top: "Total Spend: $10,000", "Total Revenue: $50,000"
- Add optional daily view toggle
- Date range selector for filtered analysis
- Calculated as: `SUM(spend_records.spend)`, `SUM(revenue_records.revenue)`

**Insights Tab** (daily trends - TO BE IMPLEMENTED AFTER OTHER TABS):
- **Pattern**: Follow LinkedIn Insights tab structure
- **Daily Deltas**: Show Spend and Revenue changes day-over-day
- Time series charts for daily spend/revenue
- Daily ROAS line graph: `(daily_revenue / daily_spend) × 100`
- Budget pacing vs target
- Weekday performance analysis
- **Note**: Implementation after completing Overview, KPIs, Benchmarks, Reports tabs

**GA4 Acquisition Breakdown**:
- Add date range filter
- Show: "Revenue (Jan 1 - Feb 12): $15,000"
- Support period comparisons

**Effort**: 2-4 weeks (database migration, query rewrites, UI updates, testing)  
**Impact**: High (unlocks daily analytics, enables Insights tab, supports direct APIs)

---

### **Phase 3: Google Ads API Integration (2 months)**

### **Phase 3: Google Ads API Integration (2 months)**

**Goal**: Fully automated spend fetching from Google Ads

**Implementation**:
1. **OAuth Setup**: Google Ads API OAuth flow
   - Scopes: `adwords` for accessing ad spend data
   - Store refresh tokens per user/campaign

2. **API Integration**:
   ```javascript
   // Fetch daily spend per campaign
   async function fetchGoogleAdsSpend(customerId, campaignId, startDate, endDate) {
     const query = `
       SELECT 
         campaign.id,
         campaign.name,
         segments.date,
         metrics.cost_micros
       FROM campaign
       WHERE campaign.id = ${campaignId}
         AND segments.date BETWEEN '${startDate}' AND '${endDate}'
       ORDER BY segments.date ASC
     `;
     
     const response = await googleAds.query(query);
     
     // Store in spend_records table
     for (const row of response) {
       await createSpendRecord({
         campaignId: dbCampaignId,
         recordDate: row.segments.date,
         spend: row.metrics.cost_micros / 1000000,  // Convert micros to dollars
         sourceType: 'google_ads_api'
       });
     }
   }
   ```

3. **Scheduler Integration**:
   - Add `reprocessGoogleAdsSpend()` to auto-refresh-scheduler.ts
   - Fetch last 7 days daily (handles delayed conversions)
   - Run at 3:00 AM alongside other sources

4. **UI Updates**:
   - Add "Connect Google Ads" button in AddSpendWizardModal
   - Show OAuth connection status
   - Display last sync time

**Benefits**:
- ✅ **Zero manual work**: Fully automated after OAuth
- ✅ **Always accurate**: Real-time spend data
- ✅ **Historical backfill**: Can fetch last 90 days on connection
- ✅ **Campaign auto-match**: Match by campaign ID (no manual mapping)

**Effort**: 2 months (OAuth setup, API integration, testing, error handling)  
**Impact**: Very High (eliminates Google Sheets dependency for Google Ads users)

---

### **Phase 4: Meta Ads API Integration (2 months)**

**Goal**: Fully automated spend fetching from Meta (Facebook/Instagram)

**Implementation**:
1. **OAuth Setup**: Meta for Developers OAuth
   - Scopes: `ads_read` for accessing ad spend data
   - Store long-lived tokens

2. **API Integration**:
   ```javascript
   // Fetch daily spend per campaign
   async function fetchMetaAdsSpend(adAccountId, campaignId, startDate, endDate) {
     const insights = await fetch(
       `https://graph.facebook.com/v18.0/${campaignId}/insights?
       time_range={'since':'${startDate}','until':'${endDate}'}
       &time_increment=1
       &fields=spend,date_start
       &access_token=${accessToken}`
     );
     
     for (const day of insights.data) {
       await createSpendRecord({
         campaignId: dbCampaignId,
         recordDate: day.date_start,
         spend: parseFloat(day.spend),
         sourceType: 'meta_api'
       });
     }
   }
   ```

3. **Multi-Campaign Support**:
   - User can link multiple Meta campaigns to one GA4 campaign
   - Sum spend across all linked Meta campaigns

**Benefits**:
- ✅ **Supports Facebook + Instagram** ads
- ✅ **Automatic currency conversion**
- ✅ **Works with ad sets and ads** (not just campaigns)

**Effort**: 2 months (similar to Google Ads)  
**Impact**: Very High (Meta is 2nd largest ad platform)

---

### **Phase 5: Additional Platform APIs (4-6 months)**

**Priority Order**:
1. **TikTok Ads API**: Growing platform for video advertisers
2. **Amazon Ads API**: Critical for e-commerce clients
3. **DV360 API**: For programmatic buyers
4. **LinkedIn Ads API** (Spend Only): Already have conversions, add spend
5. **Microsoft Ads API**: Bing/Yahoo search ads
6. **Twitter/X Ads API**: For social advertisers

**Implementation Pattern**: Follow Google Ads/Meta template
- OAuth → Daily fetch → Store in spend_records → Auto-refresh scheduler

---

## Success Metrics

**Phase 1 (UX Improvements)**:
- ✅ CSV/Paste warnings visible to 100% of users
- ✅ Manual entry removed from UI
- Target: 50% increase in Google Sheets adoption

**Phase 2 (Daily Granularity)**:
- 100% of campaigns using daily spend/revenue records
- Insights tab showing daily trends
- Zero query performance degradation

**Phase 3+ (Direct APIs)**:
- 80% of GA4 campaigns using direct API integrations
- 90% reduction in support tickets about stale spend
- Average ROAS accuracy improved by 35%

---

## Technical Considerations

### **API Rate Limits**:
- **Google Ads**: 15,000 operations/day per developer token
- **Meta**: 200 calls/hour per user
- **Solution**: Batch requests, exponential backoff, queue system

### **Data Freshness**:
- Ad platforms report spend with 0-24 hour delay
- **Solution**: Fetch last 7 days daily to capture delayed data

### **Currency Conversion**:
- Ad platforms report in campaign currency
- **Solution**: Store original currency, convert to user's display currency

### **Error Handling**:
- OAuth token expiration
- API downtime
- Campaign deletion
- **Solution**: Graceful fallback, user notifications, retry logic

---

## Insights Tab Implementation Notes

**Pattern**: Follow LinkedIn Insights tab structure

**Requirements**:
- Daily deltas for Spend and Total Revenue
- WoW (Week-over-Week) comparisons
- MoM (Month-over-Month) comparisons
- Trend visualizations (up/down indicators)
- Budget pacing alerts

**Dependencies**:
- Requires Phase 2 (daily granularity) completion
- TO BE IMPLEMENTED AFTER: Overview, KPIs, Benchmarks, Reports tabs

**Implementation Timeline**: After other tabs complete (estimated 2-3 weeks)

---

### Users with CSV Spend:
1. **Notification**: "Enable auto-refresh by switching to Google Sheets"
2. **One-Click Migration**: 
   - Export current CSV from spend source
   - Upload to Google Sheets via API
   - Connect Sheets to MetricMind
   - Deactivate old CSV source

### Campaigns with retained Google Sheets Spend:
- ⚠️ **Continuity only**; new GA4 setup is blocked and automatic refresh remains unproven while certification work is on hold

### Campaigns with legacy Manual Spend:
- ⚠️ **Unsupported retained data**; GA4 creation and editing are blocked
- Review provenance, delete only an exact confirmed legacy source, and verify totals plus the post-delete inventory

---

## Success Metrics

- **% of GA4 campaigns** using Google Sheets spend: Target 80%
- **% of spend sources** with auto-refresh enabled: Target 90%
- **Support tickets** about stale ROAS/ROI: Target -50%

---

## Technical Debt / Future Work

1. **Direct ad platform integrations**:
   - Google Ads API → Pull spend automatically
   - Meta Ads API → Pull spend automatically
   - Eliminates Google Sheets dependency

2. **Spend forecasting**:
   - Predict future spend based on historical trends
   - Alert when actual spend deviates from forecast

3. **Budget pacing alerts**:
   - Track daily spend vs monthly budget
   - Alert when overspending or underspending

---

## Conclusion

**Immediate Action**: Promote Google Sheets as primary spend source  
**Medium-term**: Add daily spend granularity  
**Long-term**: Direct ad platform integrations

This approach **balances user experience with engineering complexity**, getting users on auto-refreshing sources quickly while laying groundwork for advanced analytics.
