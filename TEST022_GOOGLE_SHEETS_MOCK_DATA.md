# Test022 Google Sheets Mock Data

## Mock Data for "test022" Campaign

Use this data in your Google Sheets for testing the automatic conversion value calculation feature.

### Headers (Row 1):
```
Campaign ID | Campaign Name | Platform | Objective | Impressions | Clicks | Conversions | Spend (USD) | UTM Source | UTM Medium | UTM Campaign | UTM Term | UTM Content | Revenue
```

### Mock Data Rows (Rows 2-6):

#### Row 2:
```
CAMPAIGN_100 | test022 | LinkedIn Ads | Traffic | 100000 | 2500 | 100 | 1000.00 | linkedin | cpc | test022_q1 | product+launch | hero-banner | 5000.00
```

#### Row 3:
```
CAMPAIGN_101 | test022 | LinkedIn Ads | Conversions | 85000 | 2100 | 85 | 850.00 | linkedin | cpc | test022_q1 | product+launch | sidebar-ad | 4250.00
```

#### Row 4:
```
CAMPAIGN_102 | test022 | LinkedIn Ads | Engagement | 75000 | 1800 | 75 | 750.00 | linkedin | cpc | test022_q1 | brand+awareness | carousel-1 | 3750.00
```

#### Row 5 (Optional - Facebook for comparison):
```
CAMPAIGN_103 | test022 | Facebook Ads | Traffic | 80000 | 1800 | 50 | 800.00 | facebook | cpc | test022_q1 | product+launch | feed-ad | 3000.00
```

#### Row 6 (Optional - Google Ads for comparison):
```
CAMPAIGN_104 | test022 | Google Ads | Conversions | 90000 | 2200 | 50 | 900.00 | google | cpc | test022_q1 | product+launch | search-ad | 2000.00
```

---

## Expected Calculation

### LinkedIn Rows Only (Filtered):
- Row 2: Revenue $5,000, Conversions 100
- Row 3: Revenue $4,250, Conversions 85
- Row 4: Revenue $3,750, Conversions 75

**Total LinkedIn:**
- Revenue: $13,000
- Conversions: 260
- **Conversion Value = $13,000 ÷ 260 = $50.00**

### System Behavior:
1. Filters for Platform = "LinkedIn Ads" (Rows 2, 3, 4)
2. Sums Revenue: $5,000 + $4,250 + $3,750 = $13,000
3. Sums Conversions: 100 + 85 + 75 = 260
4. Calculates: $13,000 ÷ 260 = $50.00
5. Updates campaign conversion value to $50.00
6. Revenue metrics appear automatically

---

## Alternative: Single Row (Simpler Test)

If you want a simpler test with just one row:

### Single Row:
```
CAMPAIGN_100 | test022 | LinkedIn Ads | Traffic | 100000 | 2500 | 100 | 1000.00 | linkedin | cpc | test022_q1 | product+launch | hero-banner | 5000.00
```

**Expected Calculation:**
- Revenue: $5,000
- Conversions: 100
- **Conversion Value = $5,000 ÷ 100 = $50.00**

---

## CSV Format (Easy Copy-Paste)

```csv
Campaign ID,Campaign Name,Platform,Objective,Impressions,Clicks,Conversions,Spend (USD),UTM Source,UTM Medium,UTM Campaign,UTM Term,UTM Content,Revenue
CAMPAIGN_100,test022,LinkedIn Ads,Traffic,100000,2500,100,1000.00,linkedin,cpc,test022_q1,product+launch,hero-banner,5000.00
CAMPAIGN_101,test022,LinkedIn Ads,Conversions,85000,2100,85,850.00,linkedin,cpc,test022_q1,product+launch,sidebar-ad,4250.00
CAMPAIGN_102,test022,LinkedIn Ads,Engagement,75000,1800,75,750.00,linkedin,cpc,test022_q1,brand+awareness,carousel-1,3750.00
CAMPAIGN_103,test022,Facebook Ads,Traffic,80000,1800,50,800.00,facebook,cpc,test022_q1,product+launch,feed-ad,3000.00
CAMPAIGN_104,test022,Google Ads,Conversions,90000,2200,50,900.00,google,cpc,test022_q1,product+launch,search-ad,2000.00
```

---

## Testing Scenarios

### Scenario 1: All LinkedIn Rows
- Use Rows 2, 3, 4 only
- System filters for "LinkedIn Ads"
- Calculates: $13,000 ÷ 260 = $50.00

### Scenario 2: Multi-Platform (Current Setup)
- Use all 5 rows
- System filters for "LinkedIn Ads" (Rows 2, 3, 4)
- Calculates from LinkedIn rows only
- Other platforms ignored for conversion value

### Scenario 3: Single Row
- Use Row 2 only
- System calculates: $5,000 ÷ 100 = $50.00
- Simplest test case

---

## Notes

1. **Campaign Name:** All rows use "test022" to match your campaign
2. **Platform:** Rows 2-4 are "LinkedIn Ads" (will be filtered)
3. **Revenue:** Realistic values ($50 per conversion average)
4. **Conversions:** Match the revenue (100 conversions = $5,000 revenue)
5. **UTM Parameters:** Realistic tracking parameters for attribution

---

## Expected Results

After connecting Google Sheets:

1. **System Logs:**
   ```
   [Auto Conversion Value] Platform column detected. Filtered 3 LinkedIn rows from 5 total rows
   [Auto Conversion Value] Calculated from 3 LinkedIn rows: Revenue: $13,000, Conversions: 260
   [Auto Conversion Value] Calculated: $13,000 ÷ 260 = $50.00
   [Auto Conversion Value] ✅ Updated campaign conversion value to $50.00
   ```

2. **Campaign Updated:**
   - `conversionValue` = `$50.00`
   - `hasRevenueTracking` = `1`

3. **UI Changes:**
   - Revenue metrics appear in LinkedIn Analytics
   - Notifications disappear
   - ROI, ROAS, Profit metrics visible

