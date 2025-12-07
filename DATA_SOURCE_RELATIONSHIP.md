# Google Sheets and LinkedIn Data Relationship

## The Core Question

**How do Google Sheets and LinkedIn metrics connect to provide campaign insights?**

---

## Typical Marketing Executive Data Sources

### 1. LinkedIn Ads (via MetricMind)
**What it provides:**
- Ad performance metrics: Impressions, Clicks, Conversions, Spend
- Campaign-level data
- Real-time or scheduled updates
- **What it DOESN'T provide:** Revenue/Value data

**Example LinkedIn Data:**
```
Campaign: "Q1 Product Launch"
Impressions: 100,000
Clicks: 2,500
Conversions: 100
Spend: $1,000
Revenue: ❌ (Not available from LinkedIn)
```

### 2. Google Sheets (Marketing Executive's Data)
**What it typically contains:**
- Campaign performance data exported from multiple platforms
- Revenue data from e-commerce/CRM systems
- Conversion data (may include LinkedIn + other platforms)
- Campaign IDs/Names for matching
- Multi-platform aggregated data

**Example Google Sheets Data:**
```
Campaign ID | Campaign Name        | Platform      | Revenue  | Conversions
CAMPAIGN_100| Q1 Product Launch   | LinkedIn Ads  | $5,000   | 100
CAMPAIGN_101| Q1 Product Launch   | Facebook Ads  | $3,000   | 50
CAMPAIGN_102| Q1 Product Launch   | Google Ads    | $2,000   | 50
```

---

## The Data Relationship

### LinkedIn Provides: Volume Metrics
- **Conversions:** Count of conversion events (100 conversions)
- **Spend:** Ad spend ($1,000)
- **Performance:** CTR, CPC, CVR, etc.

### Google Sheets Provides: Value Metrics
- **Revenue:** Actual dollar value ($5,000)
- **Conversion Value:** Revenue per conversion ($50)
- **Business Impact:** ROI, ROAS, Profit

### The Connection: Campaign Matching

**They connect via:**
1. **Campaign ID** - If both have the same campaign IDs
2. **Campaign Name** - If names match
3. **Time Period** - Same date range
4. **Platform Filter** - Filter Google Sheets for LinkedIn rows only

---

## How They Work Together

### Scenario 1: Campaign-Level Matching (Ideal)

**LinkedIn Data:**
```
Campaign: "Q1 Product Launch"
Conversions: 100
Spend: $1,000
```

**Google Sheets Data:**
```
Campaign Name: "Q1 Product Launch"
Platform: "LinkedIn Ads"
Revenue: $5,000
Conversions: 100
```

**Connection:**
- Match by Campaign Name: "Q1 Product Launch"
- Match by Platform: "LinkedIn Ads"
- Use LinkedIn Conversions: 100
- Use Google Sheets Revenue: $5,000
- Calculate: Conversion Value = $5,000 ÷ 100 = $50

**Result:**
- LinkedIn Revenue = 100 × $50 = $5,000
- ROAS = $5,000 ÷ $1,000 = 5.0x
- ROI = (($5,000 - $1,000) ÷ $1,000) × 100 = 400%

---

### Scenario 2: Aggregate Matching (Current Implementation)

**LinkedIn Data:**
```
Total Conversions: 100 (across all LinkedIn campaigns)
Total Spend: $1,000
```

**Google Sheets Data:**
```
All LinkedIn rows:
- Campaign 1: Revenue $2,000, Conversions 40
- Campaign 2: Revenue $2,000, Conversions 35
- Campaign 3: Revenue $1,000, Conversions 25
Total: Revenue $5,000, Conversions 100
```

**Connection:**
- Filter Google Sheets for Platform = "LinkedIn Ads"
- Sum all LinkedIn Revenue: $5,000
- Sum all LinkedIn Conversions: 100
- Calculate: Conversion Value = $5,000 ÷ 100 = $50

**Result:**
- Uses aggregate totals
- Applies to all LinkedIn campaigns
- Works even if individual campaigns don't match exactly

---

## Typical Marketing Executive Workflow

### Step 1: Export Data from Multiple Sources
Marketing executive exports data to Google Sheets:
- LinkedIn Ads export → Google Sheets
- Facebook Ads export → Google Sheets
- Google Ads export → Google Sheets
- E-commerce revenue → Google Sheets

**Result:** One consolidated spreadsheet with all campaign data

### Step 2: Connect to MetricMind
- Connect LinkedIn → Gets conversion counts and spend
- Connect Google Sheets → Gets revenue data

### Step 3: System Matches and Calculates
- System filters Google Sheets for LinkedIn rows
- Matches by Platform = "LinkedIn Ads"
- Calculates conversion value from revenue ÷ conversions
- Applies to LinkedIn campaigns

### Step 4: Insights Generated
- Revenue metrics appear
- ROI/ROAS calculated
- Campaign performance insights
- Cross-platform comparisons

---

## Test Mode Example

### LinkedIn Test Mode Data:
```
Campaign: "Test Campaign 001"
Conversions: 100 (mock data)
Spend: $1,000 (mock data)
```

### Google Sheets Mock Data:
```
Campaign ID | Campaign Name      | Platform      | Revenue  | Conversions
CAMPAIGN_100| Test Campaign 001  | LinkedIn Ads  | $5,000   | 100
CAMPAIGN_101| Test Campaign 002  | Facebook Ads  | $3,000   | 50
```

### System Behavior:
1. **LinkedIn Import:** Gets 100 conversions from test mode
2. **Google Sheets Connection:** Reads spreadsheet
3. **Platform Filter:** Filters for "LinkedIn Ads" rows
4. **Matching:** Finds "Test Campaign 001" row (or uses aggregate)
5. **Calculation:** $5,000 ÷ 100 = $50 conversion value
6. **Application:** Applies $50 to LinkedIn campaigns
7. **Result:** Revenue metrics appear automatically

---

## Data Matching Strategies

### Current Implementation: Aggregate Matching
- **Pros:** Simple, works with any data structure
- **Cons:** Doesn't match individual campaigns
- **Use Case:** When you want average conversion value across all campaigns

### Future Enhancement: Campaign-Level Matching
- **Pros:** More accurate, campaign-specific insights
- **Cons:** Requires exact campaign ID/name matching
- **Use Case:** When you need per-campaign revenue metrics

---

## Common Data Structures

### Structure 1: Multi-Platform Export
```
Campaign ID | Campaign Name | Platform      | Impressions | Clicks | Conversions | Spend | Revenue
CAMPAIGN_100| Q1 Launch    | LinkedIn Ads  | 100,000     | 2,500  | 100        | $1,000| $5,000
CAMPAIGN_101| Q1 Launch    | Facebook Ads  | 80,000      | 1,800  | 50         | $800  | $3,000
```

**Relationship:**
- Google Sheets has ALL platforms
- LinkedIn only has LinkedIn rows
- System filters for LinkedIn → Gets $5,000 revenue, 100 conversions
- Calculates: $50 conversion value

### Structure 2: Revenue-Only Export
```
Campaign ID | Campaign Name | Platform      | Revenue  | Orders
CAMPAIGN_100| Q1 Launch    | LinkedIn Ads  | $5,000   | 100
```

**Relationship:**
- Google Sheets has revenue data
- LinkedIn has conversion counts
- System uses Google Sheets Revenue + LinkedIn Conversions
- Calculates: $5,000 ÷ 100 = $50

### Structure 3: Separate Revenue Source
```
Order ID | Campaign ID | Revenue  | Date
ORDER_001| CAMPAIGN_100| $50      | 2024-01-15
ORDER_002| CAMPAIGN_100| $50      | 2024-01-16
...
```

**Relationship:**
- Google Sheets has individual order data
- System sums by Campaign ID
- Matches to LinkedIn Campaign ID
- Calculates conversion value per campaign

---

## How They Connect in MetricMind

### Connection Flow:

1. **LinkedIn Connection:**
   - User connects LinkedIn account
   - System imports campaign metrics
   - Gets: Conversions, Spend, Impressions, Clicks
   - **Missing:** Revenue data

2. **Google Sheets Connection:**
   - User connects Google Sheets
   - System reads spreadsheet
   - Detects: Revenue, Conversions, Platform columns
   - **Provides:** Revenue data

3. **Automatic Matching:**
   - System filters Google Sheets for LinkedIn rows
   - Calculates conversion value from revenue ÷ conversions
   - Updates campaign automatically

4. **Revenue Metrics:**
   - System uses: LinkedIn Conversions × Conversion Value
   - Calculates: Revenue, ROAS, ROI, Profit
   - Displays in analytics dashboard

---

## Key Insights

### Why Both Data Sources Are Needed:

1. **LinkedIn:** Provides conversion volume and ad performance
2. **Google Sheets:** Provides revenue value and business impact
3. **Together:** Complete picture of campaign ROI

### The Relationship:

- **LinkedIn = "How many?"** (Volume metrics)
- **Google Sheets = "How much?"** (Value metrics)
- **Combined = "What's the ROI?"** (Business impact)

### Typical Use Case:

Marketing executive wants to know:
- **LinkedIn tells them:** "We got 100 conversions for $1,000"
- **Google Sheets tells them:** "Those conversions generated $5,000 in revenue"
- **MetricMind calculates:** "ROI = 400%, ROAS = 5.0x"

---

## Summary

**Google Sheets and LinkedIn connect via:**
1. **Campaign matching** (ID or Name)
2. **Platform filtering** (LinkedIn rows only)
3. **Time period alignment** (same date range)
4. **Aggregate calculation** (total revenue ÷ total conversions)

**They provide complementary data:**
- LinkedIn: Conversion counts, ad spend, performance metrics
- Google Sheets: Revenue data, business value, multi-platform context

**Together they enable:**
- Complete ROI analysis
- Revenue attribution
- Cross-platform comparison
- Business impact measurement

The system automatically connects them to provide comprehensive campaign insights without manual data entry.

