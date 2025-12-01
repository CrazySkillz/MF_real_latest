# KPI Campaign Scope Feature

## Overview
Users can now create KPIs for individual campaigns or for all campaigns (aggregate), providing granular tracking capabilities similar to the Benchmark system.

## Feature Details

### 1. **Apply To Options**
- **All Campaigns (Aggregate)**: Tracks metrics across all LinkedIn campaigns combined
- **Specific Campaign**: Tracks metrics for a single LinkedIn campaign

### 2. **User Interface**

#### KPI Creation Modal
```
┌─────────────────────────────────────────┐
│ Create New KPI                          │
├─────────────────────────────────────────┤
│ KPI Name: LinkedIn CTR Target           │
│ Metric Source: CTR                      │
│ Target Value: 2.5                       │
│ Current Value: 2.1                      │
│ Unit: %                                 │
│                                         │
│ Priority: High    Timeframe: Monthly    │
│                                         │
│ Apply To: [Specific Campaign ▼]        │
│ Select Campaign: [Lead Gen Campaign ▼] │
│                                         │
│ [Cancel]              [Create KPI]      │
└─────────────────────────────────────────┘
```

#### KPI Card Display
```
┌─────────────────────────────────────────────────────┐
│ LinkedIn CTR Target [CTR]    [active] [high] [✏️] [🗑️]│
│ Monitor click-through rate                          │
│ [Campaign: Lead Generation - Tech Professionals]    │ ← Blue badge
│                                                     │
│ Current: 2.1%          Target: 2.5%                │
│ 🟡 Fair               16% below target              │
│ 🕐 Monthly                                          │
└─────────────────────────────────────────────────────┘
```

For aggregate KPIs (Apply To: All Campaigns), no campaign badge is shown.

## Technical Implementation

### Database Schema
```sql
-- New columns in kpis table
apply_to TEXT DEFAULT 'all'              -- 'all' or 'specific'
specific_campaign_id TEXT                -- LinkedIn campaign name
```

### Frontend Changes

#### 1. State Management
```typescript
const [kpiForm, setKpiForm] = useState({
  // ... existing fields
  applyTo: 'all',
  specificCampaignId: ''
});
```

#### 2. KPI Modal Form
- Added "Apply To" dropdown (All Campaigns / Specific Campaign)
- Added "Select Campaign" dropdown (conditionally shown)
- Campaign list populated from `availableCampaigns`

#### 3. KPI Card Display
- Shows campaign badge for specific KPIs
- Badge format: `Campaign: {campaignName}`
- Blue styling to match platform design

#### 4. Data Flow
```
Create KPI → handleCreateKPI() → 
  kpiData includes applyTo & specificCampaignId →
    Backend saves to database →
      Frontend displays with badge
```

### Backend Changes

#### 1. Schema Update
```typescript
// shared/schema.ts
export const kpis = pgTable("kpis", {
  // ... existing fields
  applyTo: text("apply_to").default("all"),
  specificCampaignId: text("specific_campaign_id"),
});
```

#### 2. API Endpoints
- `POST /api/platforms/linkedin/kpis` - Creates KPI with scope
- `PATCH /api/platforms/linkedin/kpis/:id` - Updates KPI with scope
- `GET /api/platforms/linkedin/kpis` - Returns KPIs with scope info

## Migration

### Running the Migration
```bash
# On server (production)
npx tsx run-kpi-migration.ts
```

### Migration SQL
```sql
ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;
```

## Usage Examples

### Example 1: Aggregate KPI
```
KPI Name: Overall LinkedIn ROI
Metric: ROI
Apply To: All Campaigns (Aggregate)
Result: Tracks ROI across all campaigns combined
Display: No campaign badge shown
```

### Example 2: Campaign-Specific KPI
```
KPI Name: Tech Professionals CTR
Metric: CTR
Apply To: Specific Campaign
Campaign: Lead Generation - Tech Professionals
Result: Tracks CTR for this campaign only
Display: Shows blue "Campaign: Lead Generation..." badge
```

## Benefits

1. **Granular Tracking**: Track performance at campaign level
2. **Consistency**: Matches Benchmark system design
3. **Flexibility**: Choose aggregate or specific tracking
4. **Clear Visibility**: Campaign badges make scope obvious
5. **Enterprise Ready**: Professional UI/UX for marketing executives

## Validation

### Form Validation
- If "Specific Campaign" selected, campaign must be chosen
- Revenue metrics require conversion value (same as Benchmarks)
- All required fields must be filled

### Data Validation
- `applyTo` must be 'all' or 'specific'
- If `applyTo` is 'specific', `specificCampaignId` must be set
- Campaign name must match existing LinkedIn campaign

## Future Enhancements

Potential future improvements:
1. Filter KPI list by campaign
2. Bulk create KPIs for multiple campaigns
3. Compare KPIs across campaigns
4. Campaign-specific KPI templates
5. Auto-sync campaign list when new campaigns added

## Testing Checklist

- [ ] Create aggregate KPI (Apply To: All Campaigns)
- [ ] Create campaign-specific KPI
- [ ] Edit KPI and change from aggregate to specific
- [ ] Edit KPI and change from specific to aggregate
- [ ] Delete campaign-specific KPI
- [ ] Verify campaign badge displays correctly
- [ ] Verify no badge for aggregate KPIs
- [ ] Test with revenue metrics (conversion value required)
- [ ] Test campaign dropdown population
- [ ] Verify data persists after page refresh

## Related Features

- **Benchmarks**: Similar "Apply To" functionality
- **Campaign Management**: Source of campaign list
- **LinkedIn Integration**: Provides campaign data
- **Revenue Tracking**: Requires conversion value for revenue KPIs

---

**Status**: ✅ Deployed and Ready
**Version**: 1.0
**Date**: December 2024

