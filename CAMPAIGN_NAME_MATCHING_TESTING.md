# Testing Campaign Name + Platform Matching in Test Mode

## Overview

This guide explains how to test the Campaign Name + Platform matching feature using mock Google Sheets data in test mode. The system uses a multi-tier matching strategy to automatically calculate conversion values.

## Quick Answers

**Q: When does the logic kick in?**  
A: **Automatically** when Google Sheets data is fetched. No manual trigger needed - it runs as part of the data fetch process.

**Q: Does the system automatically detect column names?**  
A: **Yes!** The system automatically detects columns by:
- Reading headers from the first row
- Case-insensitive matching (e.g., "Campaign Name" = "campaign name")
- Flexible keyword matching (e.g., "Revenue" = "Sales Revenue" = "revenue")

**Q: What if campaign names don't match?**  
A: The system falls back to Platform-only matching, then to all rows. It always provides a result.

## Matching Strategy

The system tries matching in this order:

1. **Campaign Name + Platform** (Best) - Matches by both campaign name and platform
2. **Platform Only** (Fallback) - Uses all LinkedIn rows if no name match
3. **All Rows** (Last Resort) - Uses all rows if no platform column exists

## When Does the Logic Run?

**The matching logic runs automatically** when:
- Google Sheets data is fetched via the `/api/campaigns/:id/google-sheets-data` endpoint
- This happens automatically after you connect Google Sheets (no manual trigger needed)
- The logic executes as part of the data fetch process

## How Does Column Detection Work?

**The system automatically detects column names** by:
1. Reading all headers from the first row of your Google Sheet
2. Using case-insensitive matching (e.g., "Campaign Name" = "campaign name" = "CampaignName")
3. Looking for keywords in column names:
   - **Platform:** "platform", "Platform", "Platform Name"
   - **Campaign Name:** "campaign name", "Campaign Name", "campaign"
   - **Revenue:** "revenue", "Revenue", "Sales Revenue", "Revenue Amount"
   - **Conversions:** "conversions", "Conversions", "Orders", "Purchases"

**You don't need to configure anything** - the system detects columns automatically!

---

## Test Scenarios

### Scenario 1: Perfect Match (Campaign Name + Platform)

**Goal:** Test successful Campaign Name + Platform matching

**Steps:**
1. Create a campaign in MetricMind with name: `"test022"` (or any name)
2. Connect Google Sheets with the following mock data:

**Mock Google Sheets Data:**
```
Campaign ID | Campaign Name | Platform    | Impressions | Clicks | Conversions | Spend (USD) | Revenue
------------|---------------|-------------|-------------|--------|-------------|-------------|--------
12345       | test022       | LinkedIn    | 10000       | 500    | 50          | 1000        | 2500
12346       | test022       | LinkedIn    | 8000        | 400    | 40          | 800         | 2000
12347       | other_campaign| LinkedIn    | 5000        | 250    | 25          | 500         | 1250
```

**Expected Result:**
- ✅ Green success message: "Campaign matched successfully"
- Shows: "Matched: test022"
- Shows: "Other campaigns in sheet: other_campaign"
- Conversion Value = $50.00 (calculated from matched rows only: $4500 ÷ 90 conversions)
- Only rows 1-2 are used (test022 + LinkedIn)

---

### Scenario 2: Platform-Only Match (Fallback)

**Goal:** Test fallback to Platform-only matching when campaign name doesn't match

**Steps:**
1. Create a campaign in MetricMind with name: `"my_campaign"` (IMPORTANT: This name does NOT exist in Google Sheets)
2. Connect Google Sheets with the following mock data:

**Mock Google Sheets Data:**
```
Campaign ID | Campaign Name | Platform    | Impressions | Clicks | Conversions | Spend (USD) | Revenue
------------|---------------|-------------|-------------|--------|-------------|-------------|--------
12345       | campaign_a    | LinkedIn    | 10000       | 500    | 50          | 1000        | 2500
12346       | campaign_b    | LinkedIn    | 8000        | 400    | 40          | 800         | 2000
12347       | campaign_c    | LinkedIn    | 5000        | 250    | 25          | 500         | 1250
12348       | facebook_ads  | Facebook    | 3000        | 150    | 15          | 300         | 750
```

**Important:** The MetricMind campaign name `"my_campaign"` does NOT match any campaign names in the Google Sheet (`campaign_a`, `campaign_b`, `campaign_c`, `facebook_ads`), so the system will fall back to Platform-only matching.

**Expected Result:**
- ⚠️ Amber warning message: "Using all LinkedIn data"
- Shows: "Found 3 LinkedIn campaigns. Tip: Use the same campaign name in Google Sheets for more accurate conversion value calculation."
- Shows: "Found LinkedIn campaigns: campaign_a, campaign_b, campaign_c"
- Conversion Value = $50.00 (calculated from ALL LinkedIn rows: $5750 ÷ 115 conversions)
- All 3 LinkedIn rows are used (campaign_a, campaign_b, campaign_c)

---

### Scenario 3: No Platform Column (All Rows)

**Goal:** Test fallback to all rows when no Platform column exists

**Steps:**
1. Create a campaign in MetricMind with name: `"test022"`
2. Connect Google Sheets with the following mock data (NO Platform column):

**Mock Google Sheets Data:**
```
Campaign ID | Campaign Name | Impressions | Clicks | Conversions | Spend (USD) | Revenue
------------|---------------|-------------|--------|-------------|-------------|--------
12345       | test022       | 10000       | 500    | 50          | 1000        | 2500
12346       | test022       | 8000        | 400    | 40          | 800         | 2000
12347       | other_campaign| 5000        | 250    | 25          | 500         | 1250
```

**Expected Result:**
- ℹ️ Info message: "Using all rows"
- Shows: "No Platform column detected. Using all rows from the sheet."
- Conversion Value = $50.00 (calculated from ALL rows: $5750 ÷ 115 conversions)
- All 3 rows are used

---

### Scenario 4: Multiple Campaigns with Same Name (Best Practice)

**Goal:** Test that matching works when multiple rows have the same campaign name

**Steps:**
1. Create a campaign in MetricMind with name: `"Q1_Launch"`
2. Connect Google Sheets with the following mock data:

**Mock Google Sheets Data:**
```
Campaign ID | Campaign Name | Platform    | Impressions | Clicks | Conversions | Spend (USD) | Revenue
------------|---------------|-------------|-------------|--------|-------------|-------------|--------
12345       | Q1_Launch      | LinkedIn    | 10000       | 500    | 50          | 1000        | 2500
12346       | Q1_Launch      | LinkedIn    | 8000        | 400    | 40          | 800         | 2000
12347       | Q1_Launch      | LinkedIn    | 5000        | 250    | 25          | 500         | 1250
12348       | Q2_Launch      | LinkedIn    | 3000        | 150    | 15          | 300         | 750
```

**Expected Result:**
- ✅ Green success message: "Campaign matched successfully"
- Shows: "Matched: Q1_Launch"
- Shows: "Other campaigns in sheet: Q2_Launch"
- Conversion Value = $50.00 (calculated from Q1_Launch rows only: $5750 ÷ 115 conversions)
- Only rows 1-3 are used (Q1_Launch + LinkedIn)

---

## How the Logic Works

### Automatic Detection & Execution

The matching logic **automatically runs** when:
1. Google Sheets data is fetched via `/api/campaigns/:id/google-sheets-data`
2. This happens automatically after connecting Google Sheets
3. No manual trigger needed - it's part of the data fetch process

### Column Detection

The system **automatically detects** column names by:
1. **Reading all headers** from the first row of your Google Sheet
2. **Case-insensitive matching** - "Campaign Name", "campaign name", "CampaignName" all work
3. **Flexible matching** - Looks for keywords:
   - Platform: "platform", "Platform", "Platform Name"
   - Campaign Name: "campaign name", "Campaign Name", "campaign"
   - Revenue: "revenue", "Revenue", "Sales Revenue", "Revenue Amount"
   - Conversions: "conversions", "Conversions", "Orders", "Purchases"

### Matching Process Flow

```
1. Fetch Google Sheets data
   ↓
2. Detect column indices (Platform, Campaign Name, Revenue, Conversions)
   ↓
3. Get MetricMind campaign name
   ↓
4. Try Strategy 1: Campaign Name + Platform matching
   ├─ If match found → Use matched rows only ✅
   └─ If no match → Continue to Strategy 2
   ↓
5. Try Strategy 2: Platform-only matching
   ├─ If LinkedIn rows found → Use all LinkedIn rows ⚠️
   └─ If no LinkedIn rows → Continue to Strategy 3
   ↓
6. Strategy 3: Use all rows (last resort) ℹ️
   ↓
7. Calculate conversion value from selected rows
   ↓
8. Update campaign and return matching info to frontend
```

## Step-by-Step Testing Instructions

### 1. Create Test Campaign

1. Go to Campaigns page
2. Click "Create New Campaign"
3. Enter Campaign Name: `"test022"` (or your test name)
4. Select "LinkedIn Ads" as platform
5. **Enable Test Mode** (important!)
6. Complete campaign creation

### 2. Prepare Google Sheets

1. Create a new Google Sheet
2. Add headers in first row (case-insensitive):
   - `Campaign Name` (or `campaign name`)
   - `Platform` (or `platform`)
   - `Revenue` (or `revenue`)
   - `Conversions` (or `conversions`)
3. Add test data rows (see scenarios above)
4. **Important:** For Scenario 2, make sure campaign name in MetricMind does NOT match any names in the sheet

### 3. Connect Google Sheets

1. Go to Campaign Detail page
2. Scroll to "Connected Platforms" section
3. Click on "Google Sheets" card
4. Click "Connect Google Sheets"
5. Follow OAuth flow to connect your Google account
6. Select or enter your test spreadsheet
7. **The matching logic runs automatically** when data is fetched

### 3. Prepare Mock Data in Google Sheets

Create a Google Sheet with these columns:
- **Campaign ID** (optional)
- **Campaign Name** (required for name matching)
- **Platform** (required for platform filtering)
- **Impressions** (optional)
- **Clicks** (optional)
- **Conversions** (required for conversion value calculation)
- **Spend (USD)** (optional)
- **Revenue** (required for conversion value calculation)

**Important:** Column names are case-insensitive and flexible:
- "Campaign Name" or "campaign name" or "CampaignName" all work
- "Platform" or "platform" or "Platform Name" all work
- "Revenue" or "revenue" or "Sales Revenue" all work
- "Conversions" or "conversions" or "Orders" all work

### 4. Verify Matching Status

After connecting Google Sheets:

1. Look at the "Google Sheets" card in Connected Platforms
2. Check the matching status message:
   - ✅ Green = Campaign Name + Platform matched
   - ⚠️ Amber = Platform-only match (fallback)
   - ℹ️ Gray = All rows used (last resort)

3. Verify conversion value:
   - Go to Campaign Settings
   - Check "Conversion Value" field
   - Should be automatically calculated

4. Verify revenue metrics:
   - Go to "View Detailed Analytics"
   - Check Overview tab
   - Revenue metrics should appear (no "add conversion value" notification)

---

## Testing Checklist

- [ ] **Scenario 1:** Perfect match (Campaign Name + Platform)
  - [ ] Green success message appears
  - [ ] Shows matched campaign name
  - [ ] Shows other campaigns in sheet
  - [ ] Conversion value calculated correctly
  - [ ] Only matched rows used

- [ ] **Scenario 2:** Platform-only match (fallback)
  - [ ] Amber warning message appears
  - [ ] Shows tip about using same campaign name
  - [ ] Lists all LinkedIn campaigns found
  - [ ] Conversion value calculated from all LinkedIn rows
  - [ ] All LinkedIn rows used

- [ ] **Scenario 3:** No Platform column (all rows)
  - [ ] Info message appears
  - [ ] Explains no Platform column detected
  - [ ] Conversion value calculated from all rows
  - [ ] All rows used

- [ ] **Scenario 4:** Multiple rows with same name
  - [ ] Green success message appears
  - [ ] All rows with matching name are aggregated
  - [ ] Conversion value calculated correctly
  - [ ] Other campaigns shown separately

---

## Expected Conversion Value Calculations

### Scenario 1 (Perfect Match):
```
Matched rows: test022 + LinkedIn
Revenue: $2500 + $2000 = $4500
Conversions: 50 + 40 = 90
Conversion Value = $4500 ÷ 90 = $50.00
```

### Scenario 2 (Platform-Only):
```
All LinkedIn rows (no name match)
Revenue: $2500 + $2000 + $1250 = $5750
Conversions: 50 + 40 + 25 = 115
Conversion Value = $5750 ÷ 115 = $50.00
```

### Scenario 3 (All Rows):
```
All rows (no Platform column)
Revenue: $2500 + $2000 + $1250 = $5750
Conversions: 50 + 40 + 25 = 115
Conversion Value = $5750 ÷ 115 = $50.00
```

---

## Troubleshooting

### Issue: "No Revenue or Conversions columns detected"

**Solution:** Make sure your Google Sheet has columns named:
- "Revenue" (or "revenue", "Sales Revenue", etc.)
- "Conversions" (or "conversions", "Orders", "Purchases", etc.)

### Issue: "Platform column detected but no LinkedIn rows found"

**Solution:** Make sure Platform column contains "LinkedIn" or "Linked In" (case-insensitive)

### Issue: Matching status shows "Platform-only" but expected "Campaign Name + Platform"

**Solution:** 
- Check that Campaign Name column exists
- Check that campaign name in MetricMind matches (case-insensitive, partial match works)
- Example: "test022" matches "Test022", "test022", "Q1_test022", etc.

### Issue: Conversion value not updating

**Solution:**
- Refresh the page after connecting Google Sheets
- Check browser console for errors
- Verify Revenue and Conversions columns have numeric values
- Make sure at least one row matches the criteria

---

## Quick Test Data Templates

### Template 1: Perfect Match Test
```
Campaign Name: test022
Platform: LinkedIn
Revenue: 2500
Conversions: 50
```

### Template 2: Platform-Only Test
```
Campaign Name: different_name (not matching MetricMind campaign)
Platform: LinkedIn
Revenue: 2500
Conversions: 50
```

### Template 3: No Platform Column Test
```
Campaign Name: test022
(No Platform column)
Revenue: 2500
Conversions: 50
```

---

## Next Steps After Testing

1. **Verify Revenue Metrics:** After conversion value is calculated, check that revenue metrics (ROI, ROAS, etc.) appear in:
   - Overview tab
   - Ad Comparison tab
   - KPI section

2. **Test with Real Data:** Once test mode works, try with real Google Sheets data

3. **Check Notifications:** Verify that "add conversion value" notifications disappear after successful matching

---

## Notes

- Matching is **case-insensitive**
- Partial name matching works (e.g., "test022" matches "Q1_test022")
- Platform matching looks for "linkedin" or "linked in" (case-insensitive)
- Revenue and Conversions must be numeric values
- System always provides a fallback (never fails completely)

