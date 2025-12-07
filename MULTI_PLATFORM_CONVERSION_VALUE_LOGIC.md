# Multi-Platform Conversion Value Calculation Logic

## Current State (LinkedIn Only)

The current implementation is **hardcoded to filter for LinkedIn only**:

```typescript
// Current logic (lines 2831-2838 in routes-oauth.ts)
linkedInRows = allRows.filter((row: any[]) => {
  const platformValue = String(row[platformColumnIndex] || '').toLowerCase();
  const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
  const isLinkedIn = platformValue.includes('linkedin') || platformValue.includes('linked in');
  const matchesCampaign = campaignNameValue.includes(campaignName.toLowerCase()) ||
                         campaignName.toLowerCase().includes(campaignNameValue);
  return isLinkedIn && matchesCampaign;
});
```

**Issues:**
- Variable name `linkedInRows` is misleading for multi-platform support
- Hardcoded platform check: `platformValue.includes('linkedin')`
- Only works for LinkedIn campaigns

## Impact When Other Platforms Are Connected

### Scenario from Screenshot
The Google Sheets data contains:
- **LinkedIn Ads**: 3 rows (CAMPAIGN_1001, CAMPAIGN_1004, CAMPAIGN_1007)
- **Facebook Ads**: 2 rows (CAMPAIGN_1000, CAMPAIGN_1005)
- **Google Ads**: 2 rows (CAMPAIGN_1003, CAMPAIGN_1009)
- **Twitter Ads**: 3 rows (CAMPAIGN_1002, CAMPAIGN_1006, CAMPAIGN_1008)

### Current Behavior (LinkedIn Campaign)
For a LinkedIn campaign named "test022":
1. ✅ Filters Google Sheets rows where Platform = "LinkedIn Ads"
2. ✅ Matches Campaign Name = "test022"
3. ✅ Calculates conversion value from matched LinkedIn rows only
4. ✅ Updates LinkedIn campaign's `conversionValue`

### Future Behavior (Other Platforms)
When Google Ads, Facebook Ads, etc. are connected:

**For a Google Ads campaign:**
- ❌ **Current logic would FAIL** - it only looks for "LinkedIn"
- ❌ Would fall back to "all rows" strategy, mixing platforms
- ❌ Conversion value would be inaccurate (includes LinkedIn, Facebook, Twitter data)

**For a Facebook Ads campaign:**
- ❌ **Current logic would FAIL** - it only looks for "LinkedIn"
- ❌ Would fall back to "all rows" strategy
- ❌ Conversion value would be inaccurate

## Required Changes

### 1. Get Campaign Platform from Database
```typescript
const campaign = await storage.getCampaign(campaignId);
const campaignPlatform = campaign?.platform; // 'linkedin', 'google_ads', 'facebook_ads', etc.
```

### 2. Map Platform Names
Create a mapping between MetricMind platform values and Google Sheets platform values:

```typescript
const platformMapping: Record<string, string[]> = {
  'linkedin': ['linkedin', 'linked in', 'linkedin ads'],
  'google_ads': ['google ads', 'google', 'google adwords'],
  'facebook_ads': ['facebook ads', 'facebook', 'meta', 'meta ads'],
  'twitter_ads': ['twitter ads', 'twitter', 'x ads'],
  // ... etc
};
```

### 3. Dynamic Platform Filtering
Replace hardcoded LinkedIn check with dynamic platform detection:

```typescript
// NEW: Dynamic platform filtering
let filteredRows: any[] = [];
let allRows = rows.slice(1);

if (platformColumnIndex >= 0 && campaignPlatform) {
  const platformKeywords = platformMapping[campaignPlatform.toLowerCase()] || [campaignPlatform.toLowerCase()];
  
  filteredRows = allRows.filter((row: any[]) => {
    const platformValue = String(row[platformColumnIndex] || '').toLowerCase();
    const matchesPlatform = platformKeywords.some(keyword => 
      platformValue.includes(keyword)
    );
    
    if (campaignNameColumnIndex >= 0 && campaignName) {
      const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
      const matchesCampaign = campaignNameValue.includes(campaignName.toLowerCase()) ||
                             campaignName.toLowerCase().includes(campaignNameValue);
      return matchesPlatform && matchesCampaign;
    }
    
    return matchesPlatform;
  });
}
```

### 4. Update Variable Names
- Rename `linkedInRows` → `filteredRows` or `platformRows`
- Rename `totalLinkedInRows` → `totalFilteredRows` or `totalPlatformRows`
- Update matching info to be platform-agnostic

## Example: Google Ads Campaign

**Campaign Setup:**
- MetricMind Campaign: Name = "test022", Platform = "google_ads"
- Google Sheets: Contains rows for LinkedIn, Facebook, Google Ads, Twitter

**New Logic Flow:**
1. ✅ Get campaign platform: `"google_ads"`
2. ✅ Map to Google Sheets keywords: `["google ads", "google", "google adwords"]`
3. ✅ Filter rows where Platform column matches keywords
4. ✅ Further filter by Campaign Name = "test022" (if available)
5. ✅ Calculate conversion value from filtered Google Ads rows only
6. ✅ Update Google Ads campaign's `conversionValue`

**Result:**
- Only Google Ads rows are used for conversion value calculation
- LinkedIn, Facebook, Twitter rows are ignored
- Accurate conversion value specific to Google Ads campaign

## Benefits of This Approach

1. **Platform-Specific Accuracy**: Each platform gets its own conversion value
2. **No Data Mixing**: LinkedIn conversion value doesn't include Google Ads data
3. **Scalable**: Easy to add new platforms by updating `platformMapping`
4. **Backward Compatible**: LinkedIn campaigns continue to work as before
5. **Flexible Matching**: Handles variations in platform naming (e.g., "Facebook Ads" vs "Meta Ads")

## Migration Path

1. **Phase 1**: Add platform detection and mapping (non-breaking)
2. **Phase 2**: Update filtering logic to use campaign platform
3. **Phase 3**: Update variable names and matching info
4. **Phase 4**: Test with multiple platforms
5. **Phase 5**: Deploy and verify each platform works correctly

## Summary

**Yes, the logic MUST be updated** when other platforms are connected. The current implementation is LinkedIn-specific and will produce incorrect conversion values for other platforms.

The fix requires:
- Reading campaign platform from database
- Creating platform name mapping
- Replacing hardcoded "LinkedIn" checks with dynamic platform filtering
- Updating variable names to be platform-agnostic

This ensures each platform's conversion value is calculated from its own data only, maintaining accuracy and preventing cross-platform contamination.

