# Conversion Value Calculation Across Data Sources

## Overview

Conversion value can come from multiple sources. This document explains what data each platform provides, the priority/fallback logic, and how to handle all connection permutations professionally.

## Data Source Capabilities

### 1. **LinkedIn Ads API**
**What it provides:**
- ✅ Impressions, clicks, spend, conversions, leads, engagements
- ❌ **NO conversion value or revenue** (LinkedIn doesn't track revenue)

**Conversion Value Source:**
- Must come from external source: Google Sheets, webhook, or manual entry

### 2. **Google Ads API**
**What it provides:**
- ✅ Impressions, clicks, spend, conversions
- ✅ **Conversion value/revenue** (if conversion tracking with value is configured)
- ✅ Can track purchase values, lead values, etc.

**Conversion Value Source:**
- Can come directly from Google Ads API if value tracking is enabled
- Can also come from Google Sheets or webhook

### 3. **Facebook/Meta Ads API**
**What it provides:**
- ✅ Impressions, clicks, spend, conversions
- ✅ **Conversion value/revenue** (if Facebook Pixel value tracking is configured)
- ✅ Can track purchase values, lead values, etc.

**Conversion Value Source:**
- Can come directly from Facebook Ads API if value tracking is enabled
- Can also come from Google Sheets or webhook

### 4. **Google Sheets**
**What it provides:**
- ✅ Any data structure (flexible columns)
- ✅ **Revenue and Conversions columns** → Can calculate conversion value
- ✅ Can contain data for multiple platforms in one sheet

**Conversion Value Calculation:**
- `Conversion Value = Total Revenue / Total Conversions`
- Filters by Platform column + Campaign Name for accuracy

### 5. **Google Analytics 4 (GA4)**
**What it provides:**
- ✅ Sessions, pageviews, users, bounce rate
- ✅ Conversions (if configured)
- ⚠️ **Conversion value** (only if e-commerce tracking is set up with purchase values)

**Conversion Value Source:**
- Usually requires e-commerce implementation
- Can also come from Google Sheets or webhook

### 6. **Custom Integration (PDF/Email/Webhook)**
**What it provides:**
- ✅ Flexible data structure (parsed from PDFs or sent via webhook)
- ✅ Can include revenue, conversions, conversion value
- ✅ Can include any custom metrics

**Conversion Value Source:**
- Can be included directly in uploaded data
- Can also come from webhook conversion events

### 7. **Webhook Conversion Events**
**What it provides:**
- ✅ **Actual transaction values** (most accurate)
- ✅ Real-time conversion data
- ✅ Individual conversion events with actual values

**Conversion Value Calculation:**
- Uses actual event values (not averages)
- Most accurate source for revenue calculations

## Priority/Fallback Logic for Conversion Value

### Current Implementation Priority:

1. **Webhook Conversion Events** (Highest Priority - Most Accurate)
   - Actual transaction values from external systems
   - Used for: Real-time, accurate revenue calculations

2. **Platform Connection's `conversionValue`** (Platform-Specific)
   - Stored in `linkedinConnections.conversionValue`, `metaConnections.conversionValue`, etc.
   - Calculated from Google Sheets or set manually
   - Used for: Platform-specific revenue calculations

3. **LinkedIn Import Session `conversionValue`** (Fallback)
   - Stored in `linkedinImportSessions.conversionValue`
   - Used for: Backward compatibility

4. **Campaign `conversionValue`** (Last Fallback)
   - Stored in `campaigns.conversionValue`
   - Only populated when exactly ONE platform is connected
   - Used for: General fallback

## Scenario Analysis

### Scenario 1: Multiple Platform Connections (Google Ads + Facebook Ads)

**Question:** Does imported Google Ads or Facebook Ads data typically include conversion value?

**Answer:**
- **Google Ads:** ✅ Yes, if conversion tracking with value is configured
- **Facebook Ads:** ✅ Yes, if Facebook Pixel value tracking is configured
- **LinkedIn:** ❌ No, never includes conversion value

**Which Conversion Value Will the System Use?**

**Current Behavior:**
- Each platform connection maintains its own `conversionValue`
- Google Ads connection: Uses Google Ads API value (if available) OR Google Sheets value
- Facebook Ads connection: Uses Facebook Ads API value (if available) OR Google Sheets value
- LinkedIn connection: Uses Google Sheets value OR manual entry

**Revenue Calculations:**
- Google Ads revenue: `Google Ads Conversions × googleAdsConnections.conversionValue`
- Facebook Ads revenue: `Facebook Ads Conversions × metaConnections.conversionValue`
- LinkedIn revenue: `LinkedIn Conversions × linkedinConnections.conversionValue`

**Campaign-Level Conversion Value Field:**
- Left **blank** (multiple platforms detected)
- Prevents confusion

### Scenario 2: Google Sheets with Only LinkedIn Data

**Question:** If "my_test_campaign" has Google Sheets data only for LinkedIn (not Google Ads, Facebook, etc.)?

**Answer:**
- Google Sheets filters rows where Platform = "LinkedIn Ads" + Campaign Name = "my_test_campaign"
- Calculates: `Total Revenue / Total Conversions = Conversion Value`
- Updates: `linkedinConnections.conversionValue = calculated value`
- Campaign-level field: Shows the value (only one platform connected)

**What if Google Sheets has data for other platforms too?**
- System filters by Platform column
- Only LinkedIn rows are used for LinkedIn conversion value
- Other platform rows are ignored for LinkedIn calculations

## All Connection Permutations

### Permutation 1: LinkedIn Only
- **LinkedIn API:** Conversions (no value)
- **Google Sheets:** Revenue + Conversions → Calculates conversion value
- **Result:** `linkedinConnections.conversionValue` = Google Sheets calculated value
- **Campaign field:** Shows the value

### Permutation 2: LinkedIn + Google Sheets (LinkedIn data only)
- Same as Permutation 1

### Permutation 3: LinkedIn + Google Sheets (Multiple platforms)
- **Google Sheets:** Has LinkedIn, Google Ads, Facebook rows
- **LinkedIn:** Filters LinkedIn rows → Calculates conversion value
- **Result:** `linkedinConnections.conversionValue` = LinkedIn-specific value
- **Campaign field:** Shows the value (only LinkedIn platform connected)

### Permutation 4: Google Ads Only
- **Google Ads API:** May include conversion value (if configured)
- **Google Sheets:** Can also provide conversion value
- **Priority:** Google Ads API value (if available) > Google Sheets > Manual
- **Result:** `googleAdsConnections.conversionValue` = Best available value
- **Campaign field:** Shows the value

### Permutation 5: Facebook Ads Only
- **Facebook Ads API:** May include conversion value (if configured)
- **Google Sheets:** Can also provide conversion value
- **Priority:** Facebook Ads API value (if available) > Google Sheets > Manual
- **Result:** `metaConnections.conversionValue` = Best available value
- **Campaign field:** Shows the value

### Permutation 6: LinkedIn + Google Ads
- **LinkedIn:** Uses Google Sheets (LinkedIn rows) or manual entry
- **Google Ads:** Uses Google Ads API value OR Google Sheets (Google Ads rows)
- **Result:** Each platform has its own `conversionValue`
- **Campaign field:** **Blank** (multiple platforms)

### Permutation 7: LinkedIn + Facebook Ads
- **LinkedIn:** Uses Google Sheets (LinkedIn rows) or manual entry
- **Facebook Ads:** Uses Facebook Ads API value OR Google Sheets (Facebook rows)
- **Result:** Each platform has its own `conversionValue`
- **Campaign field:** **Blank** (multiple platforms)

### Permutation 8: Google Ads + Facebook Ads
- **Google Ads:** Uses Google Ads API value OR Google Sheets (Google Ads rows)
- **Facebook Ads:** Uses Facebook Ads API value OR Google Sheets (Facebook rows)
- **Result:** Each platform has its own `conversionValue`
- **Campaign field:** **Blank** (multiple platforms)

### Permutation 9: LinkedIn + Google Sheets + Custom Integration
- **LinkedIn:** Uses Google Sheets (LinkedIn rows)
- **Custom Integration:** Can include conversion value in uploaded data
- **Priority:** Custom Integration value (if provided) > Google Sheets > Manual
- **Result:** `linkedinConnections.conversionValue` = Best available value
- **Campaign field:** Shows the value (only LinkedIn platform connected)

### Permutation 10: Multiple Platforms + Google Sheets + Webhook
- **All Platforms:** Use their respective API values OR Google Sheets values
- **Webhook Events:** Provide actual transaction values (highest priority)
- **Revenue Calculation:** Uses webhook events if available, otherwise platform-specific values
- **Result:** Most accurate revenue calculations possible
- **Campaign field:** **Blank** (multiple platforms)

## Professional Handling Recommendations

### 1. **Clear Data Source Priority**
```
Priority Order:
1. Webhook Conversion Events (actual values)
2. Platform API conversion value (if available)
3. Google Sheets calculated value
4. Custom Integration value
5. Manual entry (last resort)
```

### 2. **Platform-Specific Storage**
- ✅ Each platform connection has its own `conversionValue`
- ✅ Prevents overwriting issues
- ✅ Enables accurate per-platform revenue calculations

### 3. **Campaign-Level Field Logic**
- ✅ **Single platform:** Show the value
- ✅ **Multiple platforms:** Leave blank (prevents confusion)
- ✅ Clear indication of data source

### 4. **Google Sheets Auto-Calculation**
- ✅ Filters by Platform column for accuracy
- ✅ Optionally filters by Campaign Name for precision
- ✅ Calculates per-platform conversion value
- ✅ Updates platform connection, not just campaign

### 5. **Transparent Status Indicators**
- ✅ Show which data source provided the conversion value
- ✅ Indicate if value is from API, Google Sheets, or manual
- ✅ Display last updated timestamp

### 6. **Fallback Chain**
- ✅ Always have a fallback (never leave revenue calculations broken)
- ✅ Log which source was used for debugging
- ✅ Allow manual override if needed

### 7. **Multi-Platform Revenue Aggregation**
- ✅ Calculate revenue per platform separately
- ✅ Aggregate total revenue across all platforms
- ✅ Show platform breakdown in analytics

## Implementation Status

### ✅ Currently Implemented:
- Platform-specific conversion value storage
- Google Sheets auto-calculation with Platform filtering
- Webhook conversion events (highest priority)
- Campaign-level field logic (blank when multiple platforms)

### 🔄 To Be Implemented (Future Enhancements):
- Google Ads API conversion value extraction
- Facebook Ads API conversion value extraction
- Custom Integration conversion value extraction
- Data source indicators in UI
- Last updated timestamps
- Manual override with source tracking

## Summary

**Yes, it is accurate to say:**
When multiple platforms are connected and Google Sheets has a "Platform" column with multiple entries and all requisite columns (Revenue, Conversions), the conversion value **will be calculated based on data from Google Sheets**, but **separately for each platform** by filtering the Platform column.

**Key Points:**
1. Each platform gets its own conversion value (stored in platform connection)
2. Google Sheets filters by Platform column for accuracy
3. Platform APIs (Google Ads, Facebook) may provide conversion value directly
4. Webhook events provide the most accurate values (actual transactions)
5. Campaign-level field is blank when multiple platforms are connected (prevents confusion)
6. Revenue calculations use platform-specific values for accuracy

This approach ensures professional, accurate, and transparent conversion value handling across all data sources and connection permutations.

