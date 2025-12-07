# LinkedIn Conversions vs Google Sheets Conversions: Real-Life Example

## Real-Life Scenario: B2B SaaS Company

**Company:** CloudSoft Inc. - Sells cloud-based project management software  
**Campaign:** "Enterprise Project Management Q1 2025"  
**Platform:** LinkedIn Ads

---

## The Two Data Sources

### 1. LinkedIn API Conversions (Imported Directly from LinkedIn)

**What LinkedIn Tracks:**
- Conversion events configured in your LinkedIn campaign
- Tracked via LinkedIn Pixel or Conversion Tracking API
- Happens immediately when user completes the action

**Real Example from LinkedIn API:**
```
Campaign: "Enterprise Project Management Q1 2025"
Date Range: January 1-31, 2025

LinkedIn Metrics (from LinkedIn API):
├─ Impressions: 100,000
├─ Clicks: 5,000
├─ Conversions: 200  ← LinkedIn conversion events
├─ Spend: $10,000
└─ CTR: 5%
```

**What "200 Conversions" Means:**
- 200 people completed the conversion event you configured
- Example conversion events:
  - "Form Submission" (filled out demo request form)
  - "Button Click" (clicked "Start Free Trial")
  - "Page View" (visited pricing page)
  - "Download" (downloaded whitepaper)

**Important Characteristics:**
- These are **tracked by LinkedIn** in real-time
- They happen **on your website** (via LinkedIn Pixel)
- They're **immediate** (happens seconds after ad click)
- They're **lead generation events** (not necessarily sales)

---

### 2. Google Sheets Conversions (Exported from Your Business Systems)

**What Google Sheets Contains:**
- Data exported from your CRM, e-commerce platform, or sales system
- Could be the same as LinkedIn conversions OR different
- Usually represents actual business outcomes

**Real Example from Google Sheets:**
```
Campaign Name: Enterprise Project Management Q1 2025
Platform: LinkedIn
Date Range: January 1-31, 2025

Google Sheets Data (from Salesforce CRM):
├─ Revenue: $150,000
├─ Conversions: 50  ← Actual sales/closed deals
├─ Average Deal Size: $3,000
└─ Sales Cycle: 21 days average
```

**What "50 Conversions" Means:**
- 50 actual sales were closed
- These are **revenue-generating conversions** (completed purchases)
- This data comes from your **CRM/Sales system**, not LinkedIn
- Represents **closed deals**, not just leads

**Important Characteristics:**
- These are **tracked by your business systems** (Salesforce, Shopify, etc.)
- They happen **days or weeks later** (after sales cycle)
- They're **actual sales** (money in the bank)
- They're **bottom-of-funnel outcomes**

---

## Why They're Different: The Complete Customer Journey

### Step-by-Step Real-Life Flow

**Day 1: LinkedIn Ad Click**
```
User sees LinkedIn ad → Clicks → Lands on website
```

**Day 1: LinkedIn Conversion Event (Tracked by LinkedIn)**
```
User fills out "Request Demo" form
→ LinkedIn Pixel fires
→ LinkedIn records: 1 conversion ✅
→ This is conversion #1 of 200 (LinkedIn API)
```

**Day 1-7: Lead Processing**
```
Form submission goes to Salesforce
→ Sales team receives lead
→ Lead is qualified
→ Demo is scheduled
```

**Day 8-21: Sales Process**
```
Sales team conducts demo
→ Follow-up calls
→ Proposal sent
→ Negotiation
```

**Day 22: Actual Sale (Tracked in Google Sheets)**
```
Customer signs contract
→ Payment processed
→ Deal closed in Salesforce
→ This is conversion #1 of 50 (Google Sheets)
```

---

## Real Example: Complete Data Comparison

### LinkedIn API Data (Imported to MetricMind)

```
Campaign: "Enterprise Project Management Q1 2025"
Source: LinkedIn Ads API
Time Period: January 1-31, 2025

LinkedIn Metrics:
├─ Impressions: 100,000
├─ Clicks: 5,000
├─ Conversions: 200  ← Form submissions (leads)
├─ Spend: $10,000
├─ Cost per Conversion: $50
└─ Conversion Rate: 4% (200 ÷ 5,000)
```

**What This Tells You:**
- Your LinkedIn ads generated 200 leads
- Each lead cost $50 to acquire
- Ad performance metrics (CTR, CPC, etc.)

**What This Doesn't Tell You:**
- How many leads became customers
- How much revenue was generated
- Actual ROI or ROAS

---

### Google Sheets Data (Connected to MetricMind)

```
Campaign Name: Enterprise Project Management Q1 2025
Platform: LinkedIn
Source: Salesforce CRM Export
Time Period: January 1-31, 2025

Google Sheets Data:
├─ Revenue: $150,000
├─ Conversions: 50  ← Closed deals (sales)
├─ Average Deal Size: $3,000
├─ Sales Cycle: 21 days
└─ Lead-to-Sale Rate: 25% (50 ÷ 200)
```

**What This Tells You:**
- 50 of the 200 leads became paying customers
- Total revenue: $150,000
- Average revenue per sale: $3,000
- Lead-to-sale conversion rate: 25%

**What This Doesn't Tell You:**
- How many leads were generated
- Ad performance metrics
- Cost per lead

---

## The Key Difference Explained

### LinkedIn Conversions (200) = Lead Generation

**What They Are:**
- Form submissions (demo requests)
- Button clicks (start free trial)
- Page views (pricing page)
- Downloads (whitepaper)

**When They Happen:**
- Immediately after ad click
- Within seconds or minutes
- Tracked by LinkedIn Pixel

**What They Represent:**
- Top of funnel (awareness/interest)
- Lead generation
- Marketing qualified leads (MQLs)

**Example:**
```
User clicks LinkedIn ad
→ Lands on website
→ Fills out "Request Demo" form
→ LinkedIn Pixel fires
→ LinkedIn records: 1 conversion ✅
→ This is a LEAD, not a sale yet
```

---

### Google Sheets Conversions (50) = Actual Sales

**What They Are:**
- Closed deals
- Completed purchases
- Signed contracts
- Revenue-generating transactions

**When They Happen:**
- Days or weeks after lead generation
- After sales cycle completes
- Tracked by your CRM/Sales system

**What They Represent:**
- Bottom of funnel (purchase)
- Revenue generation
- Sales qualified leads (SQLs) that closed

**Example:**
```
Sales team contacts the lead
→ Qualifies the lead
→ Conducts demo
→ Sends proposal
→ Customer signs contract
→ Deal closed in Salesforce
→ This is a SALE ✅
```

---

## Why They Don't Match: The Conversion Funnel

### The Complete Funnel

```
100,000 Impressions (LinkedIn)
  ↓
5,000 Clicks (LinkedIn)
  ↓
200 LinkedIn Conversions (Form Submissions)
  → These are LEADS
  → Tracked by LinkedIn Pixel
  → Happen immediately
  ↓
150 Leads Contacted by Sales Team
  → 50 leads didn't respond
  → 50 leads not qualified
  → 50 leads qualified
  ↓
50 Google Sheets Conversions (Closed Deals)
  → These are SALES
  → Tracked by Salesforce CRM
  → Happen 21 days later on average
```

### The Math

```
LinkedIn Conversions: 200 (leads)
Google Sheets Conversions: 50 (sales)
Lead-to-Sale Conversion Rate: 50 ÷ 200 = 25%

This means:
- 200 people filled out the form (LinkedIn)
- 50 people became customers (Google Sheets)
- 25% of leads converted to sales
- 75% of leads did not convert
```

---

## How MetricMind Uses Both

### Step 1: Get LinkedIn Conversion Count
```
LinkedIn API says: 200 conversions (leads)
```

### Step 2: Get Google Sheets Revenue Data
```
Google Sheets says:
- Revenue: $150,000
- Sales: 50 conversions
```

### Step 3: Calculate Conversion Value
```
Conversion Value = Revenue ÷ Sales
Conversion Value = $150,000 ÷ 50 = $3,000 per sale
```

### Step 4: Apply to LinkedIn Metrics
```
LinkedIn Conversions: 200 (leads)
Conversion Value: $3,000 per sale
Estimated Potential Revenue: 200 × $3,000 = $600,000

But Actual Revenue: $150,000 (from Google Sheets)
Actual ROAS: $150,000 ÷ $10,000 = 15x
Actual ROI: (($150,000 - $10,000) ÷ $10,000) × 100 = 1,400%
```

---

## Real-Life Example: Complete Picture

### The Marketing Executive's View

**LinkedIn Metrics (Ad Performance):**
```
✅ 200 conversions generated
✅ $50 cost per lead
✅ 4% conversion rate
✅ 5% CTR
```

**Google Sheets Data (Revenue Impact):**
```
✅ 50 sales closed
✅ $150,000 revenue
✅ $3,000 average deal size
✅ 25% lead-to-sale rate
```

**MetricMind Calculation (Complete Picture):**
```
✅ Conversion Value: $3,000 per sale
✅ ROAS: 15x
✅ ROI: 1,400%
✅ Lead-to-Sale Rate: 25%
✅ Revenue per Lead: $750 ($150,000 ÷ 200)
```

---

## Common Scenarios

### Scenario 1: Google Sheets Has Same Conversions as LinkedIn

**When This Happens:**
- Google Sheets is exported directly from LinkedIn
- Or Google Sheets tracks the same conversion events

**Example:**
```
LinkedIn: 200 conversions (form submissions)
Google Sheets: 200 conversions (same form submissions)
Revenue: $0 (no sales data yet)
```

**Result:**
- Conversions match ✅
- But no revenue data to calculate conversion value
- Need actual sales data in Google Sheets

---

### Scenario 2: Google Sheets Has Different Conversions (Most Common)

**When This Happens:**
- Google Sheets contains actual sales from CRM
- LinkedIn contains lead generation events

**Example:**
```
LinkedIn: 200 conversions (form submissions - leads)
Google Sheets: 50 conversions (closed deals - sales)
Revenue: $150,000
```

**Result:**
- Conversions don't match ✅ (this is normal!)
- Google Sheets has revenue data
- System calculates: $150,000 ÷ 50 = $3,000 per sale
- Applies to LinkedIn: 200 leads × $3,000 = $600,000 potential

---

### Scenario 3: Google Sheets Has More Conversions

**When This Happens:**
- Longer sales cycle (sales close months after lead)
- Multiple touchpoints (attribution)
- Data includes other marketing channels

**Example:**
```
LinkedIn (January): 200 conversions (leads)
Google Sheets (January): 250 conversions (sales)
  → Includes sales from December leads
  → Includes sales from other channels
```

**Result:**
- Google Sheets has more conversions
- Need to filter by date range and platform
- Or use Campaign Name matching to isolate LinkedIn sales

---

## Key Takeaways

1. **LinkedIn Conversions = Leads**
   - Form submissions, button clicks, page views
   - Tracked by LinkedIn Pixel
   - Happen immediately
   - Top of funnel

2. **Google Sheets Conversions = Sales**
   - Closed deals, completed purchases
   - Tracked by CRM/Sales system
   - Happen days/weeks later
   - Bottom of funnel

3. **They Don't Need to Match**
   - LinkedIn: 200 leads
   - Google Sheets: 50 sales
   - This is normal! (25% conversion rate)

4. **MetricMind Combines Both**
   - Uses LinkedIn for ad performance
   - Uses Google Sheets for revenue calculation
   - Shows complete picture (ROI, ROAS, etc.)

---

## Summary

**LinkedIn Conversions (from LinkedIn API):**
- What: Lead generation events (form submissions)
- When: Immediately after ad click
- Source: LinkedIn Ads platform
- Purpose: Track ad performance

**Google Sheets Conversions (from your business systems):**
- What: Actual sales (closed deals)
- When: Days/weeks after lead generation
- Source: CRM/Sales system (Salesforce, etc.)
- Purpose: Track revenue performance

**They're Different by Design:**
- LinkedIn = Marketing metrics (leads)
- Google Sheets = Sales metrics (revenue)
- MetricMind = Combines both for complete ROI picture

