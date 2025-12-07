# Multi-Campaign Aggregation Issue

## The Problem

### Current Behavior:

**Google Sheets with Multiple LinkedIn Campaigns:**
```
Campaign ID | Campaign Name | Platform      | Revenue  | Conversions
CAMPAIGN_100| test022       | LinkedIn Ads  | $5,000   | 100
CAMPAIGN_101| test022       | LinkedIn Ads  | $4,250   | 85
CAMPAIGN_102| test023       | LinkedIn Ads  | $3,000   | 60
CAMPAIGN_103| test024       | LinkedIn Ads  | $2,000   | 40
```

**Current System Behavior:**
1. Filters for Platform = "LinkedIn Ads" ✅
2. Aggregates ALL LinkedIn Ads rows ❌
   - Revenue: $5,000 + $4,250 + $3,000 + $2,000 = **$14,250**
   - Conversions: 100 + 85 + 60 + 40 = **285**
   - Conversion Value = $14,250 ÷ 285 = **$50.00**

**Problem:**
- This includes test023 and test024 data!
- test022 campaign gets conversion value from ALL campaigns
- Not accurate for test022 specifically

---

## When This Is a Problem

### Problem Scenario 1: Multiple Campaigns in Same Sheet
```
Google Sheets has:
- test022 campaigns (Rows 1-2)
- test023 campaigns (Row 3)
- test024 campaigns (Row 4)

System aggregates ALL → Wrong conversion value for test022
```

### Problem Scenario 2: Different Campaign Values
```
test022 campaigns: $50 per conversion
test023 campaigns: $30 per conversion
test024 campaigns: $75 per conversion

System averages them → $50 (might be close, but not accurate)
```

### Problem Scenario 3: Different Time Periods
```
test022: Current month data
test023: Last month data
test024: Last quarter data

System mixes time periods → Inaccurate conversion value
```

---

## When Aggregation Is OK

### Scenario 1: All Rows Are Same Campaign
```
All rows are "test022" campaigns:
- Row 1: test022, LinkedIn Ads, $5,000, 100
- Row 2: test022, LinkedIn Ads, $4,250, 85
- Row 3: test022, LinkedIn Ads, $3,750, 75

Aggregation is correct ✅
```

### Scenario 2: You Want Average Across All Campaigns
```
You want average conversion value for all LinkedIn campaigns:
- test022: $50 per conversion
- test023: $30 per conversion
- test024: $75 per conversion
- Average: $51.67 per conversion

Aggregation is what you want ✅
```

---

## Solution: Campaign Name Matching

### Enhanced Implementation:

**Current (Platform Filter Only):**
```
1. Filter: Platform = "LinkedIn Ads"
2. Aggregate: All LinkedIn rows
3. Calculate: Total Revenue ÷ Total Conversions
```

**Enhanced (Platform + Campaign Name Filter):**
```
1. Filter: Platform = "LinkedIn Ads"
2. Filter: Campaign Name = "test022" (matches MetricMind campaign name)
3. Aggregate: Only test022 LinkedIn rows
4. Calculate: test022 Revenue ÷ test022 Conversions
```

---

## How Campaign Matching Would Work

### Step 1: Get MetricMind Campaign Name
```
Campaign: "test022"
```

### Step 2: Filter Google Sheets
```
Filter for:
- Platform = "LinkedIn Ads"
- Campaign Name = "test022" (or contains "test022")
```

### Step 3: Aggregate Filtered Rows Only
```
Google Sheets (filtered):
- Row 1: test022, LinkedIn Ads, $5,000, 100
- Row 2: test022, LinkedIn Ads, $4,250, 85

Aggregate:
- Revenue: $5,000 + $4,250 = $9,250
- Conversions: 100 + 85 = 185
- Conversion Value = $9,250 ÷ 185 = $50.00 ✅
```

---

## Implementation Options

### Option 1: Campaign Name Matching (Recommended)

**Logic:**
1. Get MetricMind campaign name: "test022"
2. Filter Google Sheets:
   - Platform = "LinkedIn Ads"
   - Campaign Name contains "test022" (or exact match)
3. Aggregate filtered rows only
4. Calculate conversion value

**Pros:**
- Accurate per-campaign
- Handles multiple campaigns in same sheet
- Matches campaign-specific data

**Cons:**
- Requires Campaign Name column
- Needs exact or partial name matching

### Option 2: Campaign ID Matching (Future Enhancement)

**Logic:**
1. Get LinkedIn campaign IDs from import
2. Match Google Sheets Campaign ID to LinkedIn Campaign ID
3. Filter and aggregate matched campaigns only

**Pros:**
- Most accurate
- Handles multiple campaigns perfectly
- Campaign-specific insights

**Cons:**
- Requires Campaign ID column
- Needs ID matching logic
- More complex

### Option 3: Current (Platform Only) + Warning

**Logic:**
1. Filter Platform = "LinkedIn Ads"
2. Aggregate all rows
3. Show warning if multiple campaign names detected

**Pros:**
- Simple
- Works with any data structure

**Cons:**
- May aggregate wrong campaigns
- Less accurate

---

## Recommended Solution

### Enhanced Filtering:

```javascript
// Get MetricMind campaign name
const campaign = await storage.getCampaign(campaignId);
const campaignName = campaign.name; // "test022"

// Filter Google Sheets
const linkedInRows = allRows.filter((row) => {
  const platform = String(row[platformColumnIndex] || '').toLowerCase();
  const campaignNameInSheet = String(row[campaignNameColumnIndex] || '').toLowerCase();
  
  // Filter by Platform
  const isLinkedIn = platform.includes('linkedin');
  
  // Filter by Campaign Name (if Campaign Name column exists)
  const campaignNameColumnIndex = headers.findIndex((h: string) => 
    String(h || '').toLowerCase().includes('campaign name')
  );
  
  if (campaignNameColumnIndex >= 0) {
    const matchesCampaign = campaignNameInSheet.includes(campaignName.toLowerCase()) ||
                           campaignName.toLowerCase().includes(campaignNameInSheet);
    return isLinkedIn && matchesCampaign;
  }
  
  // Fallback: Platform only if no Campaign Name column
  return isLinkedIn;
});
```

---

## For Your Test Data

### Current Behavior (Platform Only):
```
Google Sheets:
- test022 rows: $9,250 revenue, 185 conversions
- test023 rows: $3,000 revenue, 60 conversions
- test024 rows: $2,000 revenue, 40 conversions

System aggregates ALL:
- Total: $14,250 revenue, 285 conversions
- Conversion Value = $50.00

Applied to test022: 100 conversions × $50 = $5,000 ✅ (works, but uses other campaigns' data)
```

### Enhanced Behavior (Platform + Campaign Name):
```
Google Sheets:
- test022 rows: $9,250 revenue, 185 conversions
- test023 rows: $3,000 revenue, 60 conversions (ignored)
- test024 rows: $2,000 revenue, 40 conversions (ignored)

System filters for test022 only:
- Total: $9,250 revenue, 185 conversions
- Conversion Value = $50.00

Applied to test022: 100 conversions × $50 = $5,000 ✅ (accurate, uses only test022 data)
```

---

## Summary

### Current Issue:
- **Yes, it aggregates ALL LinkedIn Ads rows**
- This includes other campaigns (test023, test024, etc.)
- May be inaccurate if campaigns have different conversion values

### Solution:
- **Add Campaign Name filtering**
- Filter for Platform = "LinkedIn Ads" AND Campaign Name = "test022"
- Only aggregate rows that match the MetricMind campaign

### When Aggregation Is OK:
- All rows are the same campaign
- You want average across all campaigns
- Single campaign in the sheet

### When It's a Problem:
- Multiple campaigns in same sheet
- Different conversion values per campaign
- Different time periods

**Recommendation:** Implement Campaign Name matching to ensure accuracy per campaign.

