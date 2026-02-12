# Spend Auto-Refresh Implementation Guide

**Status**: Phase 1A Complete  
**Last Updated**: February 12, 2026  
**Next Phase**: Phase 1B - LinkedIn Spend Integration

---

## Phase 1A: UX Improvements ✅ COMPLETED

### Changes Made

**1. CSV/Paste Mode Warnings**
- Added prominent amber warning cards with AlertCircle icons
- Message: "⚠️ CSV data won't auto-update. Consider using Google Sheets for automatic daily refreshes"
- Visible immediately when user selects CSV or Paste mode

**2. Manual Entry Removed**
- Removed "Manual" button from mode selection
- Removed manual entry form
- Type updated: `SpendSourceMode = "google_sheets" | "upload" | "paste"`
- Database support retained for backward compatibility

**3. Code Changes**
- File: `client/src/components/AddSpendWizardModal.tsx`
- Commit: `ff16b91e`
- No errors, build successful

### Testing Checklist
- [ ] CSV upload shows warning banner
- [ ] Paste mode shows warning banner
- [ ] Manual button is hidden
- [ ] Google Sheets flow works normally
- [ ] Existing CSV sources still display correctly

---

## Phase 1B: LinkedIn Spend Integration (Next - 1 week)

### Current State

**LinkedIn API Already Includes Spend**:
- Endpoint: `/adAnalytics`
- Field: `costInLocalCurrency`
- Already fetched in `getCampaignAnalyticsDaily()`
- Daily granularity: `timeGranularity: 'DAILY'`

### What's Missing

LinkedIn spend is **fetched but not stored**:
1. `linkedinClient.ts`: Returns `costInLocalCurrency` ✅
2. `auto-refresh-scheduler.ts`: Processes conversions/impressions but **ignores spend** ❌
3. Database: No `spend` field update for LinkedIn campaigns ❌

### Implementation Plan

#### Step 1: Update LinkedIn Scheduler to Store Spend

**File**: `server/auto-refresh-scheduler.ts`

**Current Code** (lines ~60-100):
```typescript
// Process LinkedIn daily facts
for (const dayData of dailyData) {
  await storage.createLinkedInDailyFact({
    campaignId: dbCampaignId,
    date: dayData.date,
    impressions: dayData.impressions,
    clicks: dayData.clicks,
    conversions: dayData.conversions,
    // ❌ Missing: spend field
  });
}
```

**Updated Code**:
```typescript
// Process LinkedIn daily facts
let totalSpend = 0;
for (const dayData of dailyData) {
  const spend = parseFloat(dayData.costInLocalCurrency || 0);
  totalSpend += spend;
  
  await storage.createLinkedInDailyFact({
    campaignId: dbCampaignId,
    date: dayData.date,
    impressions: dayData.impressions,
    clicks: dayData.clicks,
    conversions: dayData.conversions,
    spend: spend,  // ✅ Add spend field
  });
}

// Update campaign cumulative spend
await storage.updateCampaign(dbCampaignId, {
  spend: totalSpend
});
```

#### Step 2: Add Spend Column to linkedin_daily_facts Table

**Migration**: `migrations/0XX_add_spend_to_linkedin_daily_facts.sql`

```sql
-- Add spend column to linkedin_daily_facts
ALTER TABLE linkedin_daily_facts 
ADD COLUMN spend DECIMAL(10,2) DEFAULT 0;

-- Add index for spend queries
CREATE INDEX idx_linkedin_daily_facts_spend 
ON linkedin_daily_facts(campaign_id, spend);

-- Backfill: Calculate spend from LinkedIn API for existing campaigns
-- (Manual step - run backfill script after migration)
```

#### Step 3: Update LinkedIn Dashboard to Show Spend Metrics

**File**: `client/src/pages/linkedin-metrics.tsx`

**Add Financial Metrics Card**:
```tsx
// Calculate financial metrics
const totalSpend = linkedinDailyFacts.reduce((sum, fact) => sum + (fact.spend || 0), 0);
const totalRevenue = campaign.revenue || 0;
const roas = totalSpend > 0 ? (totalRevenue / totalSpend) * 100 : 0;
const roi = computeRoiPercent(totalRevenue, totalSpend);
const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

// Add to Overview tab
<div className="grid grid-cols-4 gap-4">
  <MetricCard 
    title="Total Spend" 
    value={formatCurrency(totalSpend)} 
    currency={campaign.currency}
  />
  <MetricCard 
    title="ROAS" 
    value={`${roas.toFixed(0)}%`}
    trend={roasTrend}
  />
  <MetricCard 
    title="ROI" 
    value={`${roi.toFixed(0)}%`}
    trend={roiTrend}
  />
  <MetricCard 
    title="CPA" 
    value={formatCurrency(cpa)}
    currency={campaign.currency}
  />
</div>
```

#### Step 4: Testing

**Test Scenarios**:
1. **New LinkedIn Connection**:
   - Connect LinkedIn account
   - Verify spend data appears in Overview
   - Check ROAS/ROI/CPA calculations

2. **Existing LinkedIn Campaign**:
   - Run auto-refresh scheduler manually
   - Verify spend updates
   - Check daily spend trends in Insights tab

3. **Historical Backfill**:
   - Run backfill script for last 30 days
   - Verify daily spend records created
   - Check cumulative spend matches LinkedIn Ads Manager

**Success Criteria**:
- ✅ LinkedIn spend auto-refreshes daily at 3:00 AM
- ✅ ROAS/ROI/CPA visible on Overview tab
- ✅ Daily spend trends visible in Insights tab
- ✅ Zero errors in production logs

### Estimated Effort
- Database migration: 1 hour
- Scheduler updates: 2 hours
- Dashboard UI updates: 3 hours
- Testing + QA: 2 hours
- **Total**: 8 hours (1 day)

---

## Phase 2: Daily Granularity Architecture (2-4 weeks)

### Database Schema

**New Tables**:
```sql
CREATE TABLE spend_records (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id),
  record_date DATE NOT NULL,
  spend DECIMAL(10,2) NOT NULL,
  source_id INTEGER REFERENCES spend_sources(id),
  source_type VARCHAR(50),  -- 'google_sheets', 'google_ads_api', 'meta_api', 'linkedin_api', 'csv'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_campaign_date_source UNIQUE(campaign_id, record_date, source_id)
);

CREATE TABLE revenue_records (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id),
  record_date DATE NOT NULL,
  revenue DECIMAL(10,2) NOT NULL,
  source_id INTEGER REFERENCES revenue_sources(id),
  source_type VARCHAR(50),  -- 'ga4', 'hubspot', 'salesforce', 'shopify', 'manual', 'csv'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_campaign_date_revenue_source UNIQUE(campaign_id, record_date, source_id)
);

CREATE INDEX idx_spend_records_campaign_date ON spend_records(campaign_id, record_date DESC);
CREATE INDEX idx_revenue_records_campaign_date ON revenue_records(campaign_id, record_date DESC);
CREATE INDEX idx_spend_records_source_type ON spend_records(source_type);
CREATE INDEX idx_revenue_records_source_type ON revenue_records(source_type);
```

### Migration Strategy

**Step 1: Create Tables**
```sql
-- Run migration
\i migrations/0XX_create_spend_revenue_records.sql
```

**Step 2: Backfill Existing Data**

**For Cumulative Spend**:
```typescript
async function backfillCumulativeSpend() {
  const campaigns = await storage.getAllCampaigns();
  
  for (const campaign of campaigns) {
    if (campaign.spend && campaign.spend > 0) {
      // Create single record with earliest available date
      const earliestDate = campaign.created_at || new Date();
      
      await storage.createSpendRecord({
        campaignId: campaign.id,
        recordDate: earliestDate,
        spend: campaign.spend,
        sourceType: 'legacy_cumulative',
        sourceId: null
      });
    }
  }
}
```

**For Google Sheets Spend**:
```typescript
async function backfillGoogleSheetsSpend() {
  const sheetsSources = await storage.getSpendSources({ sourceType: 'google_sheets' });
  
  for (const source of sheetsSources) {
    // Re-fetch Google Sheet with date column
    const rows = await fetchGoogleSheet(source.connectionId, source.mappingConfig);
    
    for (const row of rows) {
      await storage.createSpendRecord({
        campaignId: source.campaignId,
        recordDate: row.date,
        spend: row.spend,
        sourceType: 'google_sheets',
        sourceId: source.id
      });
    }
  }
}
```

**For LinkedIn Daily Facts** (if Phase 1B complete):
```typescript
async function backfillLinkedInSpend() {
  const linkedinCampaigns = await storage.getLinkedInCampaigns();
  
  for (const campaign of linkedinCampaigns) {
    const dailyFacts = await storage.getLinkedInDailyFacts(campaign.id);
    
    for (const fact of dailyFacts) {
      if (fact.spend && fact.spend > 0) {
        await storage.createSpendRecord({
          campaignId: campaign.id,
          recordDate: fact.date,
          spend: fact.spend,
          sourceType: 'linkedin_api',
          sourceId: null  // LinkedIn doesn't use spend_sources table
        });
      }
    }
  }
}
```

**Step 3: Update Queries**

**OLD** (direct field access):
```typescript
const totalSpend = campaign.spend || 0;
```

**NEW** (sum from daily records):
```typescript
const totalSpend = await db.query(`
  SELECT COALESCE(SUM(spend), 0) as total 
  FROM spend_records 
  WHERE campaign_id = $1 
    AND record_date <= $2
`, [campaignId, endDate]);
```

### UI Updates

#### Overview Tab

**Current State**: Cumulative totals only

**Updated State**: Cumulative + optional daily view

```tsx
// Add toggle for daily view
const [showDailyView, setShowDailyView] = useState(false);

// Fetch daily records
const dailySpendQuery = useQuery({
  queryKey: ['daily-spend', campaignId, dateRange],
  queryFn: async () => {
    const res = await fetch(`/api/campaigns/${campaignId}/spend/daily?start=${startDate}&end=${endDate}`);
    return res.json();
  },
  enabled: showDailyView
});

// Render
<Card>
  <CardHeader className="flex flex-row items-center justify-between">
    <CardTitle>Spend Overview</CardTitle>
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setShowDailyView(!showDailyView)}
    >
      {showDailyView ? 'Show Total' : 'Show Daily'}
    </Button>
  </CardHeader>
  <CardContent>
    {showDailyView ? (
      <DailySpendChart data={dailySpendQuery.data} />
    ) : (
      <div className="text-3xl font-bold">
        {formatCurrency(totalSpend)}
      </div>
    )}
  </CardContent>
</Card>
```

#### Insights Tab (TO BE IMPLEMENTED AFTER OTHER TABS)

**Pattern**: Follow LinkedIn Insights structure

**Requirements**:
- Daily delta cards (Spend, Revenue, ROAS, ROI, CPA)
- WoW (Week-over-Week) comparisons
- MoM (Month-over-Month) comparisons
- Time series charts
- Budget pacing alerts

**Example**:
```tsx
// Calculate daily deltas
const yesterdaySpend = await getSpendForDate(yesterday);
const todaySpend = await getSpendForDate(today);
const spendDelta = todaySpend - yesterdaySpend;
const spendDeltaPercent = yesterdaySpend > 0 ? (spendDelta / yesterdaySpend) * 100 : 0;

<DeltaCard
  title="Daily Spend"
  value={formatCurrency(todaySpend)}
  delta={spendDelta}
  deltaPercent={spendDeltaPercent}
  trend={spendDelta >= 0 ? 'up' : 'down'}
/>
```

### Estimated Effort
- Database migration: 1 day
- Backfill scripts: 2 days
- Query updates: 3 days
- Overview tab UI: 2 days
- Testing + QA: 2 days
- **Total**: 10 days (2 weeks)

---

## Phase 3: Google Ads API Integration (2 months)

### Prerequisites
- Phase 2 (daily granularity) must be complete
- Google Cloud project with Ads API enabled
- OAuth 2.0 credentials configured

### Implementation Steps

#### 1. Google Ads API Setup

**Register App**:
1. Go to Google Cloud Console
2. Enable Google Ads API
3. Create OAuth 2.0 credentials
4. Add scopes: `https://www.googleapis.com/auth/adwords`

**Environment Variables**:
```env
GOOGLE_ADS_CLIENT_ID=<client_id>
GOOGLE_ADS_CLIENT_SECRET=<client_secret>
GOOGLE_ADS_DEVELOPER_TOKEN=<developer_token>
GOOGLE_ADS_REDIRECT_URI=https://app.metricmind.com/oauth/google-ads/callback
```

#### 2. OAuth Flow

**Client-Side** (`client/src/components/GoogleAdsConnect.tsx`):
```tsx
export function GoogleAdsConnect({ campaignId }: { campaignId: string }) {
  const connectGoogleAds = () => {
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_ADS_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(process.env.GOOGLE_ADS_REDIRECT_URI)}&` +
      `response_type=code&` +
      `scope=https://www.googleapis.com/auth/adwords&` +
      `state=${campaignId}&` +
      `access_type=offline&` +
      `prompt=consent`;
    
    window.location.href = authUrl;
  };
  
  return (
    <Button onClick={connectGoogleAds}>
      <Image src="/google-ads-icon.svg" className="w-4 h-4 mr-2" />
      Connect Google Ads
    </Button>
  );
}
```

**Server-Side** (`server/routes-oauth.ts`):
```typescript
app.get('/oauth/google-ads/callback', async (req, res) => {
  const { code, state: campaignId } = req.query;
  
  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);
  
  // Store tokens
  await storage.createGoogleAdsConnection({
    campaignId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000
  });
  
  // Redirect back to campaign
  res.redirect(`/campaigns/${campaignId}?google_ads=connected`);
});
```

#### 3. Fetch Daily Spend

**File**: `server/googleAdsClient.ts`

```typescript
import { GoogleAdsApi } from 'google-ads-api';

export class GoogleAdsClient {
  private client: GoogleAdsApi;
  
  constructor(customerId: string, accessToken: string, refreshToken: string) {
    this.client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });
    
    this.client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });
  }
  
  async fetchCampaignSpend(
    campaignId: string,
    startDate: string,  // YYYY-MM-DD
    endDate: string      // YYYY-MM-DD
  ): Promise<Array<{ date: string; spend: number }>> {
    const customer = this.client.Customer({
      customer_id: process.env.GOOGLE_ADS_CUSTOMER_ID,
    });
    
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
    
    const results = await customer.query(query);
    
    return results.map(row => ({
      date: row.segments.date,
      spend: row.metrics.cost_micros / 1000000  // Convert micros to dollars
    }));
  }
}
```

#### 4. Auto-Refresh Scheduler Integration

**File**: `server/auto-refresh-scheduler.ts`

```typescript
async function reprocessGoogleAdsSpend(campaignId: string) {
  // Get Google Ads connection
  const connection = await storage.getGoogleAdsConnection(campaignId);
  if (!connection) return false;
  
  // Refresh token if expired
  if (connection.expiresAt < Date.now()) {
    const newTokens = await refreshGoogleAdsToken(connection.refreshToken);
    await storage.updateGoogleAdsConnection(connection.id, {
      accessToken: newTokens.access_token,
      expiresAt: Date.now() + newTokens.expires_in * 1000
    });
  }
  
  // Fetch last 7 days (handles delayed spend reporting)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const client = new GoogleAdsClient(
    connection.customerId,
    connection.accessToken,
    connection.refreshToken
  );
  
  const dailySpend = await client.fetchCampaignSpend(
    connection.externalCampaignId,
    startDate,
    endDate
  );
  
  // Store in spend_records
  for (const day of dailySpend) {
    await storage.upsertSpendRecord({
      campaignId: campaignId,
      recordDate: day.date,
      spend: day.spend,
      sourceType: 'google_ads_api',
      sourceId: connection.id
    });
  }
  
  return true;
}

// Add to main scheduler function
async function runDailyAutoRefreshOnce() {
  // ... existing code ...
  
  // Process Google Ads spend
  const googleAdsConnections = await storage.getActiveGoogleAdsConnections();
  for (const connection of googleAdsConnections) {
    await reprocessGoogleAdsSpend(connection.campaignId);
  }
}
```

### Estimated Effort
- OAuth setup: 1 week
- API client implementation: 1 week
- Scheduler integration: 3 days
- UI updates: 3 days
- Testing + QA: 1 week
- **Total**: 6 weeks

---

## Phase 4: Meta Ads API Integration (2 months)

Similar pattern to Google Ads API (see Phase 3 for detailed steps).

**Key Differences**:
- OAuth: Meta for Developers instead of Google Cloud
- API: Facebook Graph API instead of Google Ads API
- Scopes: `ads_read` instead of `adwords`
- Endpoint: `/insights` instead of `/adAnalytics`

### Estimated Effort
- 6 weeks (same as Google Ads)

---

## Testing Strategy

### Unit Tests
- [ ] `linkedinClient.ts`: Verify `costInLocalCurrency` parsing
- [ ] `auto-refresh-scheduler.ts`: Test spend aggregation logic
- [ ] `storage.ts`: Test spend_records CRUD operations

### Integration Tests
- [ ] LinkedIn auto-refresh: Verify daily spend updates
- [ ] Google Ads API: Verify token refresh + spend fetch
- [ ] Meta API: Verify spend fetch + currency conversion

### End-to-End Tests
- [ ] User connects Google Ads → Spend appears in Overview
- [ ] Scheduler runs → Spend updates for all connected platforms
- [ ] User views Insights tab → Daily spend trends visible

---

## Rollback Plan

**If Phase 1B Fails**:
1. Revert scheduler changes
2. LinkedIn continues to work (just without spend)
3. No data loss

**If Phase 2 Fails**:
1. Keep using cumulative spend fields
2. Don't migrate to daily records
3. Rollback database migration

**If Phase 3/4 Fails**:
1. Google Sheets remains as fallback
2. No impact to existing users
3. Disable API integrations in UI

---

## Success Metrics

### Phase 1B (LinkedIn Spend)
- [ ] 100% of LinkedIn campaigns show spend data
- [ ] 0 errors in production logs
- [ ] ROAS/ROI/CPA calculations accurate

### Phase 2 (Daily Granularity)
- [ ] All campaigns using daily records within 1 month
- [ ] Query performance < 200ms for 90 days of data
- [ ] Zero data loss during migration

### Phase 3+ (Direct APIs)
- [ ] 50% of users connect Google Ads within 3 months
- [ ] 30% of users connect Meta within 6 months
- [ ] Support tickets about stale spend reduced by 80%

---

## Next Steps

1. **Review this document** with engineering team
2. **Prioritize Phase 1B** (LinkedIn spend) - highest ROI
3. **Plan Phase 2** migration strategy
4. **Estimate Phase 3** Google Ads API timeline
