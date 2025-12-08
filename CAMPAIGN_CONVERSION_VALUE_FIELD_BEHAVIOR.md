# Campaign Conversion Value Field Behavior

## Question
**What value will the "Conversion Value" field in the create campaign modal be autofilled with when multiple platforms are connected?**

## Answer

The **campaign-level `conversionValue` field** (displayed in the modal) will be autofilled with the value calculated for the platform matching `campaign.platform`.

## Example Scenario

**Campaign "test022":**
- `campaign.platform = "linkedin"` (set when campaign was created)
- Has LinkedIn connection → Gets `$50.00` (stored in `linkedinConnections.conversionValue`)
- Has Facebook Ads connection → Gets `$60.00` (stored in `metaConnections.conversionValue`)

**What happens:**

1. **Platform-specific values are calculated:**
   - LinkedIn: Filters Google Sheets rows where Platform = "LinkedIn Ads" + Campaign Name = "test022"
   - Calculates: `$5,000 Revenue / 100 Conversions = $50.00`
   - Updates: `linkedinConnections.conversionValue = $50.00`

   - Facebook: Filters Google Sheets rows where Platform = "Facebook Ads" + Campaign Name = "test022"
   - Calculates: `$6,000 Revenue / 100 Conversions = $60.00`
   - Updates: `metaConnections.conversionValue = $60.00`

2. **Campaign-level value is calculated:**
   - Uses `campaign.platform = "linkedin"` to determine which rows to use
   - Filters Google Sheets rows: Platform = "LinkedIn Ads" + Campaign Name = "test022"
   - Calculates: `$5,000 Revenue / 100 Conversions = $50.00`
   - Updates: `campaigns.conversionValue = $50.00`

3. **Modal displays:**
   - **Conversion Value field shows: `$50.00`** (the LinkedIn value, because `campaign.platform = "linkedin"`)

## Behavior by Campaign Platform

| Campaign Platform | Conversion Value Field Shows |
|------------------|----------------------------|
| `"linkedin"` | LinkedIn's calculated value (e.g., `$50.00`) |
| `"facebook_ads"` | Facebook's calculated value (e.g., `$60.00`) |
| `null` or `undefined` | Uses all rows (may aggregate multiple platforms incorrectly) |

## Important Notes

1. **Platform-specific values are stored separately:**
   - `linkedinConnections.conversionValue = $50.00`
   - `metaConnections.conversionValue = $60.00`
   - These are used for accurate revenue calculations per platform

2. **Campaign-level value is a fallback:**
   - `campaigns.conversionValue = $50.00` (matches the primary platform)
   - Used for backward compatibility
   - Displayed in the modal
   - Used as fallback if platform connection value is missing

3. **Revenue calculations prioritize platform-specific values:**
   - LinkedIn revenue: Uses `linkedinConnections.conversionValue = $50.00`
   - Facebook revenue: Uses `metaConnections.conversionValue = $60.00`
   - Each platform gets accurate calculations

## Summary

**The Conversion Value field in the campaign modal will be autofilled with the value for the platform matching `campaign.platform`.**

In the example:
- If `campaign.platform = "linkedin"` → Field shows **$50.00**
- If `campaign.platform = "facebook_ads"` → Field shows **$60.00**

This ensures the modal shows a value, while each platform connection maintains its own accurate conversion value for revenue calculations.

