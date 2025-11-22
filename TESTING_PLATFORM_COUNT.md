# Testing Guide: Platform Count Display

## Quick Test Steps

### Test 1: Create Campaign with Multiple Platforms ✅

1. **Navigate to Campaign Management**
   - Click "New Campaign" button

2. **Fill Campaign Details**
   - Name: "Test Multi-Platform Campaign"
   - Budget: 10000
   - Click "Next"

3. **Connect Multiple Platforms**
   - Click "Google Analytics" → Connect (follow OAuth flow)
   - Click "Custom Integration" → Choose "Email Forwarding" → Click button
   - **✅ Verify:** Both platforms show green checkmarks

4. **Check Button Text**
   - **✅ Expected:** Button shows "Create campaign with 2 platforms"
   - Click the button

5. **Verify Campaign Detail Page**
   - Campaign should appear in Campaign Management list
   - Click the campaign card
   - **✅ Expected:** 
     - "Google Analytics" shows blue "Connected" badge
     - "Custom Integration" shows blue "Connected" badge
     - Both have "View Detailed Analytics" buttons
     - No other platforms are shown (unless they were also connected)

### Test 2: Create Campaign with Single Platform ✅

1. **Create New Campaign**
   - Name: "Test Single Platform"
   - Click "Next"

2. **Connect Only Custom Integration**
   - Click "Custom Integration" → "Manual Upload" → Upload a PDF
   - **✅ Verify:** Custom Integration shows green checkmark

3. **Check Button Text**
   - **✅ Expected:** Button shows "Create campaign with 1 platform" (singular)
   - Click the button

4. **Verify Campaign Detail Page**
   - **✅ Expected:**
     - Only "Custom Integration" shows with blue "Connected" badge
     - "View Detailed Analytics" button is present
     - Other platforms are not shown

### Test 3: Create Campaign with No Platforms ✅

1. **Create New Campaign**
   - Name: "Test No Platforms"
   - Click "Next"

2. **Don't Connect Any Platforms**
   - Just click "Back" or close modal

3. **Check Button Text**
   - **✅ Expected:** Button shows "Create Campaign" (no count)

4. **Verify Campaign Detail Page**
   - **✅ Expected:**
     - All platforms show "Not Connected" badge
     - No "View Detailed Analytics" buttons
     - Can still expand platforms to connect them later

### Test 4: View Detailed Analytics Links ✅

For each connected platform, verify the "View Detailed Analytics" button navigates to the correct page:

1. **Google Analytics**
   - Should go to: `/campaigns/:id/ga4-metrics`
   - Should display GA4 metrics dashboard

2. **Custom Integration**
   - Should go to: `/campaigns/:id/custom-integration-analytics`
   - Should display parsed PDF metrics

3. **LinkedIn Ads**
   - Should go to: `/campaigns/:id/linkedin-analytics`
   - Should display LinkedIn campaign metrics

4. **Google Sheets**
   - Should go to: `/campaigns/:id/google-sheets-data`
   - Should display spreadsheet data

5. **Meta/Facebook Ads**
   - Should go to: `/campaigns/:id/meta-analytics`
   - Should display Meta ad metrics

## Expected Behavior Summary

### Campaign Creation Modal

| Connected Platforms | Button Text |
|---------------------|-------------|
| 0 | "Create Campaign" |
| 1 | "Create campaign with 1 platform" |
| 2 | "Create campaign with 2 platforms" |
| 3+ | "Create campaign with X platforms" |

### Campaign Detail Page

| Platform Status | Badge Color | Badge Text | Analytics Button |
|-----------------|-------------|------------|------------------|
| Connected | Blue | "Connected" | ✅ Visible |
| Not Connected | Gray | "Not Connected" | ❌ Hidden |
| Not in Campaign | - | - | ❌ Not shown |

## Common Issues & Fixes

### Issue 1: Button shows wrong count
**Symptom:** Button says "Create campaign with 0 platforms" when platforms are connected

**Cause:** `connectedPlatformsInDialog` state not updating

**Fix:** Check that `onPlatformsChange` callback is being called in `DataConnectorsStep`

### Issue 2: All platforms show on campaign detail page
**Symptom:** All 8 platforms are visible even though only 2 were connected

**Cause:** Filtering logic not working

**Fix:** Verify `platformMetrics` is using the filtered array, not `allPlatformMetrics`

### Issue 3: Connected platform doesn't show "View Detailed Analytics"
**Symptom:** Platform shows "Connected" badge but no analytics button

**Cause:** `analyticsPath` is undefined or null

**Fix:** Check backend `/api/campaigns/:id/connected-platforms` returns correct `analyticsPath` for the platform

## Debug Commands

### Check Campaign Platform Field
```javascript
// In browser console on campaign detail page
console.log('Campaign platforms:', campaign?.platform);
// Should output: "google-analytics, custom-integration"
```

### Check Connected Platforms API Response
```bash
# Replace :id with actual campaign ID
curl https://your-app.render.com/api/campaigns/:id/connected-platforms
```

### Check Platform Status Map
```javascript
// In browser console on campaign detail page
console.log('Platform status map:', platformStatusMap);
// Should show Map with platform IDs as keys
```

## Success Criteria ✅

- [x] Button text updates dynamically based on connected platform count
- [x] Singular "platform" used when count is 1
- [x] Plural "platforms" used when count is 2+
- [x] Only connected platforms show on campaign detail page
- [x] All connected platforms show blue "Connected" badge
- [x] All connected platforms show "View Detailed Analytics" button
- [x] Analytics buttons navigate to correct platform-specific pages
- [x] Platforms not connected during creation are hidden (not shown as "Not Connected")

