# Multi-Platform Conversion Value Issue

## The Problem

**Current Architecture:**
- One campaign can have multiple platform connections:
  - LinkedIn connection (`linkedinConnections` table)
  - Facebook Ads connection (`metaConnections` table)
  - Google Ads connection (when implemented)
  - Google Sheets connection (`googleSheetsConnections` table)
  - GA4 connection (`ga4Connections` table)

**But:**
- Campaign has only ONE `platform` field (e.g., "linkedin", "facebook_ads", "google_ads")
- Campaign has only ONE `conversionValue` field

## Current Behavior

### When Google Sheets Auto-Calculates Conversion Value:

1. **Gets Campaign Platform**: Reads `campaign.platform` from database
2. **Filters Google Sheets**: Filters rows where Platform column matches `campaign.platform`
3. **Calculates**: `Total Revenue / Total Conversions` from filtered rows
4. **Updates**: Overwrites `campaign.conversionValue` with calculated value

### Example Scenario:

**Campaign "test022":**
- `platform: "linkedin"` (set when campaign was created or first platform connected)
- Has LinkedIn connection
- Has Facebook Ads connection
- Has Google Sheets connection (contains LinkedIn + Facebook + Google Ads rows)

**What Happens:**
1. Google Sheets auto-calculation runs
2. Gets `campaign.platform = "linkedin"`
3. Filters Google Sheets rows: Platform = "LinkedIn Ads" only
4. Calculates: `$5,000 Revenue / 100 Conversions = $50.00`
5. Updates: `campaign.conversionValue = $50.00`
6. ❌ **Facebook Ads rows are ignored!**

**Result:**
- ✅ Conversion value is autofilled: `$50.00`
- ❌ But only for LinkedIn platform
- ❌ Facebook Ads conversion value is NOT calculated
- ❌ If campaign has `platform: null`, it might use ALL rows (incorrect)

## The Issue

### Problem 1: Platform Mismatch
- If `campaign.platform = "linkedin"` but Facebook Ads is also connected, Facebook conversion value is never calculated
- The single `conversionValue` field can only store ONE value

### Problem 2: Overwriting
- Each time Google Sheets data is fetched, `campaign.conversionValue` is overwritten
- If multiple platforms are connected, only the platform matching `campaign.platform` is used

### Problem 3: Revenue Calculations
- Revenue calculations use `campaign.conversionValue` for ALL platforms
- If LinkedIn conversion value is $50 but Facebook is $60, Facebook revenue will be calculated incorrectly using $50

## Solutions

### Option 1: Store Conversion Value Per Platform Connection (Recommended)

**Change:**
- Add `conversionValue` field to each platform connection table:
  - `linkedinConnections.conversionValue`
  - `metaConnections.conversionValue`
  - `ga4Connections.conversionValue` (if applicable)
- Keep `campaign.conversionValue` as a fallback/default

**How It Works:**
1. When Google Sheets calculates conversion value for LinkedIn:
   - Filter rows: Platform = "LinkedIn Ads"
   - Calculate: `$5,000 / 100 = $50.00`
   - Update: `linkedinConnections.conversionValue = $50.00`

2. When Google Sheets calculates conversion value for Facebook:
   - Filter rows: Platform = "Facebook Ads"
   - Calculate: `$6,000 / 100 = $60.00`
   - Update: `metaConnections.conversionValue = $60.00`

3. Revenue calculations:
   - LinkedIn revenue: `LinkedIn Conversions × linkedinConnections.conversionValue`
   - Facebook revenue: `Facebook Conversions × metaConnections.conversionValue`

**Benefits:**
- ✅ Each platform has its own conversion value
- ✅ No overwriting issues
- ✅ Accurate revenue calculations per platform
- ✅ `campaign.conversionValue` can be used as default/fallback

### Option 2: Calculate Weighted Average

**Change:**
- Calculate conversion value for each platform separately
- Store in platform connections
- Calculate weighted average: `(LinkedIn Revenue + Facebook Revenue) / (LinkedIn Conversions + Facebook Conversions)`
- Update `campaign.conversionValue` with weighted average

**Benefits:**
- ✅ Single value for campaign-level metrics
- ✅ Accounts for all platforms

**Drawbacks:**
- ❌ Less accurate for platform-specific revenue calculations
- ❌ Doesn't solve the overwriting issue

### Option 3: Platform-Specific Campaigns (Current Implicit Behavior)

**Change:**
- Enforce: One campaign = One platform
- When connecting a new platform, create a new campaign
- Each campaign has its own conversion value

**Benefits:**
- ✅ Simple architecture
- ✅ No overwriting issues
- ✅ Clear separation

**Drawbacks:**
- ❌ Users might want one campaign with multiple platforms
- ❌ More campaigns to manage

## Recommended Solution: Option 1

**Implementation Steps:**

1. **Add `conversionValue` to platform connection tables:**
   ```sql
   ALTER TABLE linkedin_connections ADD COLUMN conversion_value DECIMAL(10,2);
   ALTER TABLE meta_connections ADD COLUMN conversion_value DECIMAL(10,2);
   ```

2. **Update Google Sheets auto-calculation:**
   - Instead of updating `campaign.conversionValue`
   - Update the specific platform connection's `conversionValue`
   - Determine which platform connection to update based on:
     - Which platform's rows were used in calculation
     - Or explicitly pass platform type

3. **Update revenue calculations:**
   - Use platform-specific conversion value from connection
   - Fallback to `campaign.conversionValue` if connection value not available

4. **Update Campaign Settings Modal:**
   - Show platform-specific conversion values
   - Allow manual override per platform
   - Show aggregated/average value for campaign-level view

## Current Answer to User's Question

**Q: When conversion value is calculated for each platform, will the Conversion Value field in the create campaign modal be autofilled?**

**A: Partially - but with limitations:**

1. ✅ **Yes, the field will be autofilled** - but only for the platform matching `campaign.platform`
2. ❌ **Other platforms' conversion values are NOT calculated** - they're ignored
3. ❌ **The field gets overwritten** - each time Google Sheets data is fetched, it overwrites with the value for `campaign.platform`
4. ❌ **Revenue calculations may be inaccurate** - if multiple platforms are connected, they all use the same conversion value (from `campaign.platform`)

**Example:**
- Campaign "test022" has `platform: "linkedin"`
- LinkedIn connection calculates: `$50.00` → Updates `campaign.conversionValue = $50.00`
- Facebook Ads connection exists but conversion value is NOT calculated
- Facebook revenue uses `$50.00` (LinkedIn's value) → ❌ Incorrect

## Conclusion

The current implementation has a **design limitation** when multiple platforms are connected to one campaign. The `conversionValue` field will be autofilled, but only for the platform matching `campaign.platform`. Other platforms' conversion values are not calculated, leading to inaccurate revenue metrics.

**Recommended fix:** Store conversion value per platform connection, not per campaign.

