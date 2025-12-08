# Phase 2 Testing Scenarios

## Overview

This document outlines comprehensive test scenarios to verify Phase 2 UI enhancements for conversion value transparency and data source indicators.

---

## Test Environment Setup

### Prerequisites
1. Test mode enabled (for LinkedIn)
2. At least one campaign created
3. Google Sheets connection capability
4. Multiple platform connections (LinkedIn, Facebook) if testing multi-platform scenarios

### Test Data Requirements
- Campaign with LinkedIn connection
- Campaign with Google Sheets connection
- Campaign with multiple platform connections
- Campaign with no conversion value set

---

## Scenario 1: Campaign Settings - Single Platform Conversion Value

### Objective
Verify that when a single platform is connected, the conversion value status displays correctly in the edit campaign modal.

### Steps
1. **Create a campaign** with LinkedIn connection only
2. **Connect Google Sheets** with Revenue and Conversions columns
3. **Verify auto-calculation** - Check that conversion value is calculated automatically
4. **Open Edit Campaign modal** (click Edit button on campaign card)
5. **Verify Status Display:**
   - ✅ Should show green success card: "LinkedIn: $X.XX"
   - ✅ Should show: "Conversion value from connected data sources. You can override manually below."
   - ✅ Conversion Value input field should be enabled
   - ✅ Field should show the calculated value

### Expected Results
- Green status card appears above the form
- Conversion value field is populated with calculated value
- User can manually override the value
- Source is clearly indicated

### Test Cases
- [ ] Single platform (LinkedIn) with Google Sheets CV
- [ ] Single platform (LinkedIn) with manual CV entry
- [ ] Single platform (Facebook) with Google Sheets CV
- [ ] Single platform with no CV (should show guidance)

---

## Scenario 2: Campaign Settings - Multiple Platforms Conversion Value

### Objective
Verify that when multiple platforms are connected, the conversion value status shows platform breakdown and the field is disabled.

### Steps
1. **Create a campaign** with LinkedIn connection
2. **Connect Facebook Ads** to the same campaign
3. **Connect Google Sheets** with data for both platforms (Platform column with "LinkedIn" and "Facebook Ads")
4. **Open Edit Campaign modal**
5. **Verify Status Display:**
   - ✅ Should show blue info card: "Conversion Value: (Multiple platforms)"
   - ✅ Should list each platform with its conversion value:
     - "• LinkedIn: $X.XX"
     - "• Facebook Ads: $X.XX"
   - ✅ Should show: "Each platform has its own conversion value. Edit in Connected Platforms section."
   - ✅ Conversion Value input field should be **disabled**
   - ✅ Field placeholder should say: "Multiple platforms - see status above"

### Expected Results
- Blue info card with platform breakdown
- Conversion value field is disabled
- Clear explanation that each platform has its own value
- Guidance to edit in Connected Platforms section

### Test Cases
- [ ] LinkedIn + Facebook with Google Sheets CV for both
- [ ] LinkedIn + Facebook with only LinkedIn CV
- [ ] LinkedIn + Facebook with no CV (should show guidance)
- [ ] Three platforms (LinkedIn + Facebook + Google Ads)

---

## Scenario 3: Campaign Settings - No Conversion Value

### Objective
Verify that when no conversion value is set, helpful guidance is displayed.

### Steps
1. **Create a campaign** with LinkedIn connection only
2. **Do NOT connect Google Sheets** or set manual conversion value
3. **Open Edit Campaign modal**
4. **Verify Status Display:**
   - ✅ Should show amber warning card: "No conversion value set"
   - ✅ Should show: "Connect data sources (Google Sheets, webhooks, custom integration) to calculate automatically."
   - ✅ Conversion Value input field should be enabled
   - ✅ Field should be empty

### Expected Results
- Amber warning card appears
- Clear guidance on how to set conversion value
- Field is available for manual entry
- No confusing empty state

### Test Cases
- [ ] New campaign with no connections
- [ ] Campaign with LinkedIn but no Google Sheets
- [ ] Campaign with Google Sheets but no Revenue/Conversions columns

---

## Scenario 4: LinkedIn Analytics - Total Revenue Tooltip

### Objective
Verify that Total Revenue metric shows tooltip with calculation details and data source badge.

### Steps
1. **Navigate to LinkedIn Analytics** page for a campaign
2. **Ensure campaign has:**
   - LinkedIn connection with conversions
   - Conversion value set (from Google Sheets or manual)
   - Revenue metrics enabled (`hasRevenueTracking === 1`)
3. **Locate Total Revenue card** in Overview tab
4. **Verify Display:**
   - ✅ Total Revenue value is displayed
   - ✅ Info icon (ℹ️) appears next to "Total Revenue" label
   - ✅ Data source badge appears (e.g., "Google Sheets" or "LinkedIn Connection")
   - ✅ Calculation breakdown shows below value: "X conversions × $Y.XX"

5. **Hover over Info icon:**
   - ✅ Tooltip appears with:
     - "Calculation" heading
     - "Revenue = Conversions × Conversion Value"
     - Detailed calculation: "X conversions × $Y.XX = $Z,ZZZ.ZZ"
     - Source: "Conversion value from: [Source]"

### Expected Results
- Tooltip shows complete calculation breakdown
- Data source is clearly indicated
- Calculation is transparent and verifiable
- Badge provides quick visual reference

### Test Cases
- [ ] Revenue from Google Sheets conversion value
- [ ] Revenue from LinkedIn connection conversion value
- [ ] Revenue from manual entry
- [ ] Revenue with zero conversions (should show $0.00)
- [ ] Revenue with large numbers (formatting test)

---

## Scenario 5: LinkedIn Analytics - Revenue Metrics Data Source Badges

### Objective
Verify that all revenue metrics show appropriate data source badges.

### Steps
1. **Navigate to LinkedIn Analytics** page
2. **Ensure revenue tracking is enabled**
3. **Check each revenue metric card:**
   - Total Revenue
   - ROAS
   - ROI
   - Profit
   - Profit Margin
   - Revenue Per Lead

4. **Verify Badges:**
   - ✅ If Google Sheets connected: Badge shows "Google Sheets"
   - ✅ If only LinkedIn connection: Badge shows "LinkedIn Connection"
   - ✅ Badge appears next to or below the metric value
   - ✅ Badge is styled consistently (outline variant, small text)

### Expected Results
- All revenue metrics have data source badges
- Badges are consistent in styling
- Badges accurately reflect the data source
- Badges don't clutter the UI

### Test Cases
- [ ] All metrics with Google Sheets source
- [ ] All metrics with LinkedIn connection source
- [ ] Mixed sources (if applicable)
- [ ] No source (should not show badge or show "Manual")

---

## Scenario 6: Financial Analysis - Platform Breakdown

### Objective
Verify that Financial Analysis page shows platform breakdown with data sources and calculations.

### Steps
1. **Navigate to Financial Analysis** page for a campaign
2. **Ensure campaign has:**
   - Multiple platforms connected (LinkedIn + Custom Integration)
   - Conversion values set for each platform
3. **Locate "Estimated Revenue" card**
4. **Verify Display:**
   - ✅ Revenue value is displayed
   - ✅ Data source badge appears (e.g., "Google Sheets")
   - ✅ Platform breakdown shows below:
     - "LinkedIn: X conversions × $Y.XX = $Z,ZZZ.ZZ"
     - "Other: X conversions × $Y.XX = $Z,ZZZ.ZZ"

5. **Scroll to "Platform ROAS Performance" section**
6. **Verify LinkedIn Ads card:**
   - ✅ Shows ROAS badge
   - ✅ Shows spend, conversions, revenue
   - ✅ Shows calculation: "X conversions × $Y.XX"
   - ✅ Shows data source badge (Google Sheets or LinkedIn Connection)

7. **Verify Custom Integration card:**
   - ✅ Shows calculation breakdown
   - ✅ Shows data source badge (GA4/Custom Integration)

### Expected Results
- Platform breakdown is clear and detailed
- Each platform's calculation is shown
- Data sources are indicated for each platform
- Totals match sum of platform revenues

### Test Cases
- [ ] LinkedIn + Custom Integration with Google Sheets
- [ ] LinkedIn + Custom Integration with different sources
- [ ] Single platform only
- [ ] No conversion value (should show guidance)

---

## Scenario 7: Google Sheets Auto-Calculation Feedback

### Objective
Verify that when Google Sheets calculates conversion values, feedback is shown in Connected Platforms section.

### Steps
1. **Navigate to Campaign Detail** page
2. **Go to Connected Platforms** section
3. **Connect Google Sheets** with:
   - Platform column (with "LinkedIn", "Facebook Ads", etc.)
   - Revenue column
   - Conversions column
   - Campaign Name column (matching campaign name)
4. **After connection, verify feedback:**
   - ✅ Green success card appears
   - ✅ Shows: "Conversion Value Calculated Automatically!"
   - ✅ Lists each platform with:
     - Platform name
     - Conversion value: "$X.XX"
     - Number of conversions used: "(X conversions)"
   - ✅ Shows matching status (Campaign Name + Platform, Platform-only, or All rows)

### Expected Results
- Clear success feedback
- Platform-specific values are shown
- Matching method is indicated
- User understands what happened

### Test Cases
- [ ] Perfect match (Campaign Name + Platform)
- [ ] Platform-only match (fallback)
- [ ] All rows match (last resort)
- [ ] Multiple platforms in Google Sheets
- [ ] Single platform in Google Sheets

---

## Scenario 8: End-to-End User Journey

### Objective
Test the complete user journey from campaign creation to viewing revenue metrics.

### Steps
1. **Create New Campaign:**
   - Enter campaign name: "Test Campaign"
   - Select platform: LinkedIn
   - Leave Conversion Value blank
   - ✅ Verify tooltip explains data source options

2. **Connect LinkedIn:**
   - Complete LinkedIn connection flow
   - ✅ Verify amber alert shows: "Conversion Value: Not available from API"
   - ✅ Verify guidance to connect other data sources

3. **Connect Google Sheets:**
   - Connect Google Sheets with Revenue and Conversions
   - ✅ Verify green success card shows calculated values
   - ✅ Verify matching status is displayed

4. **Edit Campaign:**
   - Open Edit Campaign modal
   - ✅ Verify conversion value status shows LinkedIn value
   - ✅ Verify field is populated

5. **View LinkedIn Analytics:**
   - Navigate to LinkedIn Analytics
   - ✅ Verify Total Revenue shows with tooltip
   - ✅ Verify data source badge appears
   - ✅ Verify calculation breakdown is shown

6. **View Financial Analysis:**
   - Navigate to Financial Analysis
   - ✅ Verify platform breakdown is shown
   - ✅ Verify data sources are indicated
   - ✅ Verify calculations are transparent

### Expected Results
- Smooth user journey with clear guidance at each step
- No confusion about conversion value sources
- Transparent calculations throughout
- Professional, enterprise-grade experience

---

## Scenario 9: Multi-Platform Edge Cases

### Objective
Test edge cases with multiple platforms and various data source combinations.

### Test Cases

### 9.1: Multiple Platforms, Only One Has CV
- **Setup:** LinkedIn + Facebook connected, only LinkedIn has conversion value
- **Expected:**
  - Edit modal shows LinkedIn CV, Facebook shows "Not set"
  - Revenue metrics show LinkedIn revenue only
  - Financial Analysis shows LinkedIn breakdown only

### 9.2: Multiple Platforms, Different Sources
- **Setup:** LinkedIn (Google Sheets CV) + Facebook (Manual CV)
- **Expected:**
  - Edit modal shows both platforms with their sources
  - Revenue metrics show appropriate badges
  - Financial Analysis shows correct breakdowns

### 9.3: Platform Added After CV Set
- **Setup:** Campaign with LinkedIn + Google Sheets CV, then add Facebook
- **Expected:**
  - Edit modal updates to show multiple platforms
  - Conversion value field becomes disabled
  - Status card updates to show platform breakdown

### 9.4: Platform Removed
- **Setup:** Campaign with LinkedIn + Facebook, remove Facebook
- **Expected:**
  - Edit modal updates to show single platform
  - Conversion value field becomes enabled
  - Status card updates to show single platform value

---

## Scenario 10: Data Source Priority Testing

### Objective
Verify that data source priority is correctly indicated in UI.

### Priority Order (Highest to Lowest):
1. Webhook events (actual transaction values)
2. Platform-specific connection conversion value (Google Sheets, etc.)
3. Session conversion value
4. Campaign conversion value (manual entry)

### Steps
1. **Set manual campaign conversion value:** $100
2. **Connect Google Sheets** (calculates $50)
3. **Verify UI shows:** Google Sheets as source (higher priority)
4. **Send webhook events** (if webhook tester available)
5. **Verify UI shows:** Webhook as source (highest priority)

### Expected Results
- UI always shows the highest priority source
- Badges and tooltips reflect the actual source used
- User understands which source is being used

---

## Testing Checklist

### Campaign Settings (Enhancement 4)
- [ ] Single platform with CV shows green card
- [ ] Multiple platforms show blue card with breakdown
- [ ] No CV shows amber guidance card
- [ ] Field is disabled when multiple platforms
- [ ] Field is enabled when single platform
- [ ] Manual override works for single platform
- [ ] Status updates when platforms are added/removed

### Revenue Metrics (Enhancement 5)
- [ ] Total Revenue tooltip shows calculation
- [ ] Data source badges appear correctly
- [ ] Calculation breakdown is accurate
- [ ] Platform breakdown in Financial Analysis is correct
- [ ] All revenue metrics have appropriate indicators
- [ ] Tooltips are responsive and don't break layout
- [ ] Badges are styled consistently

### Integration Points
- [ ] Google Sheets feedback appears after connection
- [ ] Platform connection indicators show CV status
- [ ] Campaign creation tooltip explains options
- [ ] End-to-end journey is smooth

### Edge Cases
- [ ] Zero conversions (shows $0.00)
- [ ] Very large numbers (formatting)
- [ ] Missing data sources (graceful degradation)
- [ ] Platform removal/addition (UI updates)
- [ ] Multiple data sources (priority handling)

---

## Common Issues to Watch For

1. **Missing Data Source Badges**
   - Check if badges appear for all revenue metrics
   - Verify badge text matches actual source

2. **Incorrect Calculations**
   - Verify tooltip calculations match displayed values
   - Check platform breakdowns sum to total

3. **Status Card Not Updating**
   - Verify status updates when platforms are added/removed
   - Check that field enable/disable state is correct

4. **Tooltip Not Showing**
   - Check Info icon is visible
   - Verify tooltip component is properly imported
   - Test hover interaction

5. **Styling Issues**
   - Check badges are consistent
   - Verify cards don't break layout
   - Test responsive design on mobile

---

## Success Criteria

✅ **Phase 2 is successful if:**
- Users can clearly see where conversion values come from
- Users understand why conversion value field is blank/disabled
- Users can verify revenue calculations are accurate
- Data sources are transparent throughout the UI
- Multi-platform scenarios are handled gracefully
- No confusion about which source is being used
- Professional, enterprise-grade user experience

---

## Notes

- Test in both light and dark mode
- Test on different screen sizes (desktop, tablet, mobile)
- Test with various data combinations
- Document any issues found for follow-up fixes
- Gather user feedback on clarity and usefulness

