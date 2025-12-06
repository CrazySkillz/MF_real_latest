# Ad Comparison Tab - Revenue Metrics Behavior

## Issue Identified

When a campaign has **no conversion value** set, the Ad Comparison tab was incorrectly displaying revenue metrics. This has been fixed.

---

## Correct Behavior (After Fix)

### When Conversion Value is NOT Set (`hasRevenueTracking === 0`)

**What Should Be Displayed:**

1. **Sorting:**
   - Ads sorted by **Spend** (or Impressions if spend not available)
   - NOT sorted by revenue

2. **Top Performer Banner:**
   - Shows "Top Performer" (not "Top Revenue Driver")
   - Displays **Spend** or **Impressions** value
   - NOT revenue

3. **Ad Limit Indicator:**
   - Says "Showing top 15 of X ads **by spend**"
   - NOT "by revenue"

4. **Ad Detail Cards:**
   - Shows **Spend** or **Impressions** for each ad
   - NOT revenue
   - Label: "Spend" or "Impressions" (not "Revenue")

5. **Quick Stats Summary:**
   - Shows **Total Spend** (not Total Revenue)
   - Shows **Total Conversions** (not Average Revenue/Ad)
   - Shows **Total Ads**

6. **Metric Selector:**
   - Revenue metrics (Total Revenue, ROAS, ROI, Profit, etc.) are **NOT** available in dropdown
   - Only shows core and derived metrics that don't require conversion value

7. **Notification:**
   - Shows an amber alert at the top:
     > "Revenue metrics require a conversion value. Add a conversion value to your campaign to see revenue, ROAS, ROI, and profit metrics in ad comparison."

---

### When Conversion Value IS Set (`hasRevenueTracking === 1`)

**What Should Be Displayed:**

1. **Sorting:**
   - Ads sorted by **Revenue** (highest to lowest)

2. **Top Performer Banner:**
   - Shows "Top Revenue Driver"
   - Displays revenue value

3. **Ad Limit Indicator:**
   - Says "Showing top 15 of X ads **by revenue**"

4. **Ad Detail Cards:**
   - Shows **Revenue** for each ad
   - Label: "Revenue"

5. **Quick Stats Summary:**
   - Shows **Total Revenue**
   - Shows **Average Revenue/Ad**
   - Shows **Total Ads**

6. **Metric Selector:**
   - Revenue metrics ARE available:
     - Total Revenue
     - ROAS
     - ROI
     - Profit
     - Profit Margin
     - Revenue Per Lead (if leads tracked)

7. **No Notification:**
   - No alert shown (revenue tracking is enabled)

---

## Metrics Available in Ad Comparison Tab

### Always Available (Core Metrics):
- Impressions
- Clicks
- Spend
- Conversions
- Leads (if tracked)
- Engagements (if tracked)
- Reach (if tracked)
- Video Views (if tracked)
- Viral Impressions (if tracked)

### Always Available (Derived Metrics):
- CTR (if clicks + impressions tracked)
- CPC (if clicks + spend tracked)
- CPM (if impressions + spend tracked)
- CVR (if conversions + clicks tracked)
- CPA (if conversions + spend tracked)
- CPL (if leads + spend tracked)
- ER (if engagements + impressions tracked)

### Only Available When Conversion Value Set (Revenue Metrics):
- **Total Revenue** ❌ (requires conversion value)
- **ROAS** ❌ (requires conversion value)
- **ROI** ❌ (requires conversion value)
- **Profit** ❌ (requires conversion value)
- **Profit Margin** ❌ (requires conversion value)
- **Revenue Per Lead** ❌ (requires conversion value + leads tracked)

---

## Summary

**Without Conversion Value:**
- ✅ Core metrics (Impressions, Clicks, Spend, Conversions, etc.)
- ✅ Derived metrics (CTR, CPC, CPM, CVR, CPA, CPL, ER)
- ❌ Revenue metrics (Total Revenue, ROAS, ROI, Profit, etc.)
- ✅ Notification explaining conversion value is needed
- ✅ Ads sorted by Spend (not Revenue)
- ✅ Stats show Total Spend and Total Conversions (not Revenue)

**With Conversion Value:**
- ✅ All core metrics
- ✅ All derived metrics
- ✅ All revenue metrics
- ✅ No notification
- ✅ Ads sorted by Revenue
- ✅ Stats show Total Revenue and Average Revenue/Ad

---

## Implementation Details

The fix ensures:
1. `hasRevenueTracking` flag is checked before displaying revenue metrics
2. Ads are sorted by appropriate metric (revenue if available, spend otherwise)
3. Top performer banner adapts based on available metrics
4. Ad detail cards show appropriate metric
5. Stats summary shows appropriate metrics
6. Revenue metrics are excluded from metric selector when conversion value not set
7. Clear notification explains why revenue metrics aren't available

This ensures data accuracy and prevents misleading revenue displays when conversion value is not configured.

