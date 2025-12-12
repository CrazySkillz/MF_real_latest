# LinkedIn Campaign Mapping Requirements

## Problem Statement

For LinkedIn campaigns with LinkedIn API connected, the system was incorrectly requiring users to map **Impressions, Clicks, Spend, and Platform** from Google Sheets, even though these metrics are already available from the LinkedIn API.

## Correct Behavior

### When LinkedIn API is Connected:

**Required Fields from Google Sheets:**
1. ✅ **Campaign Name** - Required to match Google Sheets rows to LinkedIn campaigns
2. ✅ **Revenue** - Required to calculate conversion value (LinkedIn doesn't provide revenue data)

**Optional Fields from Google Sheets:**
- **Platform** - Optional (can default to "LinkedIn" since it's a LinkedIn campaign)
- **Impressions** - Optional (LinkedIn API provides this)
- **Clicks** - Optional (LinkedIn API provides this)
- **Spend** - Optional (LinkedIn API provides this)
- **Conversions** - Optional (LinkedIn API provides this - system uses LinkedIn API conversions for conversion value calculation)
- **Date** - Optional (for time-based matching)

### Why This Makes Sense:

1. **LinkedIn API Already Provides:**
   - Impressions, Clicks, Spend, Conversions, Leads, Engagements
   - These are imported automatically when LinkedIn is connected

2. **Google Sheets Should Only Provide:**
   - **Campaign Name**: To match revenue data to the correct LinkedIn campaign
   - **Revenue**: LinkedIn doesn't provide revenue data, so this must come from Google Sheets

3. **Conversion Value Calculation:**
   - Formula: `Conversion Value = Revenue (from Google Sheets) ÷ Conversions (from LinkedIn API)`
   - System prioritizes LinkedIn API conversions over Google Sheets conversions for accuracy

## Implementation

### Backend Changes (`routes-oauth.ts`):

The `/api/platforms/:platform/fields` endpoint now:
1. Accepts optional `campaignId` query parameter
2. Checks if LinkedIn API is connected for the campaign
3. If connected, adjusts required fields:
   - Campaign Name: Required
   - Revenue: Required
   - All other fields: Optional

### Frontend Changes (`ColumnMappingInterface.tsx`):

The component now:
1. Passes `campaignId` when fetching platform fields
2. Receives context-aware required fields based on LinkedIn API connection status

## Testing

### Test Scenario 1: LinkedIn Campaign with LinkedIn API Connected

**Expected Behavior:**
- Only "Campaign Name" and "Revenue" should be marked as required
- Platform, Impressions, Clicks, Spend should be optional
- User can save mappings with just Campaign Name and Revenue mapped

**Test Steps:**
1. Create LinkedIn campaign
2. Connect LinkedIn API
3. Connect Google Sheet
4. Click "Map"
5. Verify only Campaign Name and Revenue are required
6. Map Campaign Name and Revenue
7. Save mappings
8. Verify conversion value is calculated

### Test Scenario 2: LinkedIn Campaign WITHOUT LinkedIn API Connected

**Expected Behavior:**
- All standard required fields should be required (Campaign Name, Platform, Impressions, Clicks, Spend)
- Revenue should be optional (but recommended for conversion value)

**Test Steps:**
1. Create LinkedIn campaign
2. DO NOT connect LinkedIn API
3. Connect Google Sheet
4. Click "Map"
5. Verify all standard required fields are shown
6. Map all required fields
7. Save mappings

## User Experience

### Before Fix:
- ❌ User confused why Impressions, Clicks, Spend are required when LinkedIn API already provides them
- ❌ User forced to include unnecessary columns in Google Sheet
- ❌ Mapping process more complex than needed

### After Fix:
- ✅ Clear requirements: Only Campaign Name and Revenue needed
- ✅ Simpler Google Sheet structure
- ✅ Faster mapping process
- ✅ Better user experience

## Summary

**For LinkedIn campaigns with LinkedIn API connected:**
- **Required:** Campaign Name, Revenue
- **Optional:** Platform, Impressions, Clicks, Spend, Conversions, Date

**For LinkedIn campaigns WITHOUT LinkedIn API:**
- **Required:** Campaign Name, Platform, Impressions, Clicks, Spend
- **Optional:** Revenue, Conversions, Date

This ensures users only need to provide data that LinkedIn API doesn't already supply.

