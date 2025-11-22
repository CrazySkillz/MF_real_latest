# Platform Count Display Fix

## Summary
Fixed the campaign creation flow to correctly display the number of connected platforms in the "Create campaign with X platforms" button, and ensured that only connected platforms show the blue "Connected" badge with "View Detailed Analytics" link on the campaign detail page.

## Changes Made

### 1. **Campaign Creation Button Text** (`client/src/pages/campaigns.tsx`)

**Before:**
```typescript
Create Campaign with {connectedPlatformsInDialog.length} platform{connectedPlatformsInDialog.length !== 1 ? 's' : ''}
```

**After:**
```typescript
Create campaign with {connectedPlatformsInDialog.length} {connectedPlatformsInDialog.length === 1 ? 'platform' : 'platforms'}
```

**What it does:**
- Shows "Create campaign with 1 platform" when 1 platform is connected
- Shows "Create campaign with 2 platforms" when 2+ platforms are connected
- Shows "Create Campaign" when no platforms are connected
- Uses lowercase "campaign" for consistency with the UI

### 2. **Dynamic Platform Display** (`client/src/pages/campaign-detail.tsx`)

**Before:**
- All platforms were shown regardless of connection status
- Hardcoded list of platforms always displayed

**After:**
```typescript
// Build platformMetrics array dynamically based on connected platforms
const allPlatformMetrics: PlatformMetrics[] = [
  // ... all platform definitions
];

// Filter to only show platforms that are connected or were selected during campaign creation
const platformMetrics = allPlatformMetrics.filter(platform => {
  // Always show if connected
  if (platform.connected) return true;
  
  // Show if platform was selected during campaign creation
  const isInCampaignPlatforms = connectedPlatformNames.some(name => 
    name.toLowerCase().includes(platform.platform.toLowerCase()) || 
    platform.platform.toLowerCase().includes(name.toLowerCase())
  );
  
  return isInCampaignPlatforms;
});
```

**What it does:**
- Only displays platforms that are actually connected OR were selected during campaign creation
- Hides platforms that were never connected or selected
- Ensures the "Connected Platforms" section only shows relevant platforms

## How It Works

### Campaign Creation Flow:

1. **User enters campaign details** → Clicks "Next"
2. **User selects platforms to connect** → Each connected platform is tracked in `connectedPlatformsInDialog` state
3. **Button updates dynamically** → Shows count: "Create campaign with 2 platforms"
4. **User clicks button** → Campaign is created with `platform` field set to comma-separated list (e.g., "google-analytics, custom-integration")
5. **Connections are transferred** → Each platform connection is moved from `temp-campaign-setup` to the new campaign ID

### Campaign Detail Page Display:

1. **Page loads** → Fetches campaign data and connected platform statuses via `/api/campaigns/:id/connected-platforms`
2. **Platform statuses mapped** → Creates `platformStatusMap` with connection status for each platform
3. **Metrics array built** → Creates `allPlatformMetrics` with all possible platforms
4. **Filtered for display** → Only shows platforms that are:
   - Currently connected (from `platformStatusMap`), OR
   - Were selected during campaign creation (from `campaign.platform` field)
5. **Renders platform cards** → Each connected platform shows:
   - Blue "Connected" badge
   - "View Detailed Analytics" button with link to platform-specific analytics page

## Supported Platforms

The following platforms are supported with full connection tracking:

1. **Google Analytics** (`google-analytics`)
   - Analytics path: `/campaigns/:id/ga4-metrics`
   
2. **Google Sheets** (`google-sheets`)
   - Analytics path: `/campaigns/:id/google-sheets-data`
   
3. **LinkedIn Ads** (`linkedin`)
   - Analytics path: `/campaigns/:id/linkedin-analytics`
   
4. **Meta/Facebook Ads** (`facebook`)
   - Analytics path: `/campaigns/:id/meta-analytics`
   
5. **Custom Integration** (`custom-integration`)
   - Analytics path: `/campaigns/:id/custom-integration-analytics`
   - Supports PDF import via email forwarding or manual upload

## Testing

### Test Case 1: Single Platform
1. Create a campaign
2. Connect only "Custom Integration"
3. **Expected:** Button shows "Create campaign with 1 platform"
4. Click campaign on Campaign Management page
5. **Expected:** Only "Custom Integration" shows with blue "Connected" badge and "View Detailed Analytics" link

### Test Case 2: Multiple Platforms
1. Create a campaign
2. Connect "Google Analytics" and "Custom Integration"
3. **Expected:** Button shows "Create campaign with 2 platforms"
4. Click campaign on Campaign Management page
5. **Expected:** Both platforms show with blue "Connected" badges and "View Detailed Analytics" links

### Test Case 3: No Platforms
1. Create a campaign
2. Don't connect any platforms
3. **Expected:** Button shows "Create Campaign"
4. Click campaign on Campaign Management page
5. **Expected:** No platforms shown in "Connected Platforms" section (or all shown as "Not Connected")

## Backend API Reference

### Get Connected Platforms Status
```
GET /api/campaigns/:id/connected-platforms
```

**Response:**
```json
{
  "statuses": [
    {
      "id": "google-analytics",
      "name": "Google Analytics",
      "connected": true,
      "analyticsPath": "/campaigns/:id/ga4-metrics",
      "lastConnectedAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "custom-integration",
      "name": "Custom Integration",
      "connected": true,
      "analyticsPath": "/campaigns/:id/custom-integration-analytics",
      "lastConnectedAt": "2025-01-15T10:32:00Z"
    }
  ]
}
```

## Notes

- The `campaign.platform` field stores a comma-separated list of platform IDs (e.g., "google-analytics, custom-integration")
- Platform IDs are mapped to display names using `platformIdToName` in `campaign-detail.tsx`
- The filtering logic uses case-insensitive matching to handle variations in platform names
- All platform connections are stored in separate database tables (e.g., `ga4_connections`, `custom_integrations`)

