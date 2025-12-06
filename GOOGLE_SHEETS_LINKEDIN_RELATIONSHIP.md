# Google Sheets and LinkedIn Metrics Relationship

## The Key Question

**Do Google Sheets conversions need to match LinkedIn conversions?**

**Answer: It depends on what data is in your Google Sheets.**

---

## Three Common Scenarios

### Scenario 1: Google Sheets Contains ONLY LinkedIn Data ✅

**Your Google Sheets:**
- Campaign ID: LinkedIn campaign IDs
- Platform: "LinkedIn Ads" (or all rows are LinkedIn)
- Conversions: LinkedIn conversion events
- Revenue: Revenue from LinkedIn conversions

**Relationship:**
- Google Sheets Conversions = LinkedIn Conversions ✅
- They match perfectly
- Use Google Sheets conversions for calculation

**Example:**
```
LinkedIn: 100 conversions
Google Sheets: 100 conversions (same campaigns)
Revenue: $5,000
Conversion Value = $5,000 ÷ 100 = $50 ✅
```

---

### Scenario 2: Google Sheets Contains MULTI-PLATFORM Data ⚠️

**Your Google Sheets:**
- Campaign ID: Multiple platforms (LinkedIn, Facebook, Google Ads)
- Platform: "LinkedIn Ads", "Facebook Ads", "Google Ads"
- Conversions: Total conversions across ALL platforms
- Revenue: Total revenue across ALL platforms

**Relationship:**
- Google Sheets Conversions = LinkedIn + Facebook + Google Ads conversions
- LinkedIn Conversions = Only LinkedIn conversions
- They DON'T match ❌

**Example:**
```
LinkedIn: 100 conversions
Google Sheets: 300 conversions (100 LinkedIn + 100 Facebook + 100 Google Ads)
Revenue: $15,000 (total across all platforms)
Conversion Value = $15,000 ÷ 300 = $50

BUT: This is wrong for LinkedIn!
LinkedIn should use: $5,000 ÷ 100 = $50 (LinkedIn-specific)
```

**Problem:**
- Using total conversions dilutes the conversion value
- LinkedIn revenue metrics will be inaccurate

---

### Scenario 3: Google Sheets Contains E-COMMERCE Data (Orders) ⚠️

**Your Google Sheets:**
- Campaign ID: Order IDs or transaction IDs
- Platform: "E-commerce" or "Website"
- Conversions: Actual orders/purchases
- Revenue: Actual order values

**Relationship:**
- Google Sheets Conversions = Actual orders
- LinkedIn Conversions = LinkedIn conversion events (may not be orders)
- They might not match ❌

**Example:**
```
LinkedIn: 100 conversion events (form submissions, button clicks)
Google Sheets: 80 orders (actual purchases)
Revenue: $4,000 (from actual orders)
Conversion Value = $4,000 ÷ 80 = $50

BUT: LinkedIn has 100 conversions, not 80!
This creates a mismatch.
```

---

## Current Implementation Behavior

### What It Does Now:

1. **Reads Google Sheets:**
   - Sums "Revenue" column
   - Sums "Conversions" column
   - Calculates: `Conversion Value = Revenue ÷ Conversions`

2. **Saves to Campaign:**
   - Updates campaign `conversionValue`
   - Updates LinkedIn import session `conversionValue`

3. **Uses for LinkedIn Revenue:**
   - `LinkedIn Revenue = LinkedIn Conversions × Conversion Value`

### The Problem:

If Google Sheets has multi-platform data:
- Conversion Value = Total Revenue ÷ Total Conversions (all platforms)
- But LinkedIn only has LinkedIn conversions
- Result: LinkedIn revenue might be inaccurate

---

## Recommended Solutions

### Solution 1: Filter Google Sheets by Platform (Best)

**If your Google Sheets has a "Platform" column:**

1. Filter rows where `Platform = "LinkedIn Ads"` or `Platform = "LinkedIn"`
2. Sum Revenue and Conversions for LinkedIn rows only
3. Calculate: `Conversion Value = LinkedIn Revenue ÷ LinkedIn Conversions`

**Example:**
```
Google Sheets:
Row 1: LinkedIn, $5,000 revenue, 100 conversions
Row 2: Facebook, $3,000 revenue, 50 conversions
Row 3: Google Ads, $2,000 revenue, 50 conversions

Filtered for LinkedIn:
LinkedIn Revenue: $5,000
LinkedIn Conversions: 100
Conversion Value = $5,000 ÷ 100 = $50 ✅
```

### Solution 2: Use LinkedIn Conversions (Alternative)

**If Google Sheets has total revenue but mixed conversions:**

1. Use Google Sheets Revenue (total)
2. Use LinkedIn Conversions (from LinkedIn import)
3. Calculate: `Conversion Value = Google Sheets Revenue ÷ LinkedIn Conversions`

**Example:**
```
Google Sheets Revenue: $15,000 (total)
LinkedIn Conversions: 100
Conversion Value = $15,000 ÷ 100 = $150

BUT: This assumes all revenue is from LinkedIn (probably wrong)
```

### Solution 3: Separate Sheets (Simplest)

**Best practice:**
- Create separate Google Sheets for each platform
- Or filter your sheet to only LinkedIn rows
- Connect the filtered sheet to the campaign

---

## Updated Implementation Recommendation

The system should:

1. **Check if Google Sheets has "Platform" column:**
   - If yes: Filter for LinkedIn rows only
   - If no: Use all rows (assume all are LinkedIn)

2. **Calculate conversion value:**
   - Use filtered LinkedIn data if available
   - Otherwise use all data

3. **Log what was used:**
   - Show which rows were used
   - Show if filtering was applied

---

## For Your Specific Case

Based on your spreadsheet structure:
- Campaign ID, Campaign Name, Platform, Objective, Impressions, Clicks, Conversions, Spend (USD), UTM Source, UTM Medium, UTM Campaign, UTM Term, UTM Content, Revenue

**If Platform column shows "LinkedIn Ads":**
- System should filter for LinkedIn rows only
- Calculate from LinkedIn-specific data

**If Platform column shows multiple platforms:**
- System should filter for LinkedIn only
- Or you should filter the sheet before connecting

**If all rows are LinkedIn:**
- Current implementation works fine
- No filtering needed

---

## Answer to Your Questions

### Q: Does Google Sheets have to have a Conversions column?

**A: Yes, for automatic calculation.**
- System needs both Revenue and Conversions
- Without Conversions, it can't calculate conversion value

### Q: Does it have to match the Conversions value in LinkedIn metrics?

**A: Ideally yes, but it depends:**

**If Google Sheets contains ONLY LinkedIn data:**
- ✅ Yes, they should match
- Conversions should be the same

**If Google Sheets contains MULTI-PLATFORM data:**
- ❌ No, they won't match
- System should filter for LinkedIn rows only
- Or use LinkedIn conversions instead of Google Sheets conversions

**Best Practice:**
- Filter Google Sheets to LinkedIn rows only
- Or use separate sheets per platform
- This ensures accurate conversion value calculation

