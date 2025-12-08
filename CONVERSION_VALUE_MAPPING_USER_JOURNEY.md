# Conversion Value Calculation with Flexible Mapping - User Journey

## Overview
This document explains how the flexible data mapping system integrates with conversion value calculation for LinkedIn campaigns, using campaign "test023" as a concrete example.

---

## Current System vs. Enhanced System

### Current System (Rigid)
- **Requires exact column names**: "Platform", "Campaign Name", "Revenue", "Conversions"
- **Hardcoded column positions**: Assumes specific column order
- **No flexibility**: Fails if column names differ slightly

### Enhanced System (Flexible)
- **Auto-detects columns**: Recognizes "Revenue", "Sales", "Income", "Total Revenue", etc.
- **Intelligent mapping**: Maps any column structure to required fields
- **Template support**: Remembers successful mappings for future use

---

## User Journey: Campaign "test023"

### Scenario
**Campaign**: test023  
**Platform**: LinkedIn Ads  
**Goal**: Calculate conversion value from Google Sheets data  
**Challenge**: Google Sheet has columns named differently than expected

---

## Step-by-Step Journey

### Step 1: User Connects Google Sheets

**Current State:**
- Campaign "test023" exists
- LinkedIn connection is active
- No conversion value set (LinkedIn doesn't provide revenue data)

**User Action:**
1. Navigates to campaign "test023"
2. Clicks "Connect Google Sheets" in Connected Platforms section
3. Authorizes Google Sheets access
4. Selects spreadsheet: "Q4 Marketing Data"

**System Response:**
- Connects to Google Sheets
- Fetches first 100 rows to analyze structure
- Detects columns automatically

---

### Step 2: Column Detection & Analysis

**Google Sheet Structure (Example):**
```
| Ad Campaign      | Platform  | Views    | Clicks  | Budget ($) | Sales Revenue | Conv Count |
|------------------|-----------|----------|---------|------------|--------------|------------|
| test023          | LinkedIn  | 12500    | 450     | 1250.00    | 5000.00      | 100        |
| Summer Sale      | LinkedIn  | 20000    | 600     | 2000.00    | 8000.00      | 160        |
| Holiday Campaign | Facebook  | 30000    | 900     | 3000.00    | 12000.00     | 240        |
```

**System Detection:**
```typescript
Detected Columns:
1. "Ad Campaign" → text, confidence: 0.95
2. "Platform" → text, confidence: 0.98
3. "Views" → number, confidence: 0.99
4. "Clicks" → number, confidence: 0.99
5. "Budget ($)" → currency, confidence: 0.97
6. "Sales Revenue" → currency, confidence: 0.96
7. "Conv Count" → number, confidence: 0.92
```

**Key Observations:**
- Column names differ from expected: "Sales Revenue" vs "Revenue", "Conv Count" vs "Conversions"
- Currency format includes "$" symbol
- Campaign name column is "Ad Campaign" not "Campaign Name"

---

### Step 3: Auto-Mapping for Conversion Value Calculation

**Platform Fields Required for Conversion Value:**
```typescript
Required Fields:
1. Campaign Name (or identifier) → to match rows to campaign "test023"
2. Platform → to filter LinkedIn rows
3. Revenue → to calculate total revenue
4. Conversions → to calculate conversion value

Optional but helpful:
- Spend → for ROAS calculation
- Impressions/Clicks → for additional metrics
```

**Auto-Mapping Results:**
```typescript
Auto-Mapping Suggestions:
✅ "Ad Campaign" → Campaign Name (confidence: 0.85)
   - Matched via alias: "campaign"
   - Type compatible: text → text

✅ "Platform" → Platform (confidence: 0.98)
   - Exact match
   - Type compatible: text → text

✅ "Sales Revenue" → Revenue (confidence: 0.88)
   - Matched via pattern: /revenue|sales|income/i
   - Type compatible: currency → currency
   - Transform: strip "$" and parse

✅ "Conv Count" → Conversions (confidence: 0.82)
   - Matched via pattern: /conversion|conv/i
   - Type compatible: number → number

⚠️ "Budget ($)" → Spend (confidence: 0.75)
   - Matched via alias: "spend", "cost", "budget"
   - Type compatible: currency → currency
   - Optional field, can be mapped later
```

**UI Display:**
```
┌─────────────────────────────────────────────────────────────┐
│  Mapping Google Sheets Data for Conversion Value           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 Detected Columns (7 columns)                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Column Name      │ Type    │ Sample                 │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Ad Campaign      │ text    │ "test023"              │  │
│  │ Platform         │ text    │ "LinkedIn"             │  │
│  │ Views            │ number  │ 12500                  │  │
│  │ Clicks           │ number  │ 450                    │  │
│  │ Budget ($)       │ currency│ $1,250.00              │  │
│  │ Sales Revenue    │ currency│ $5,000.00              │  │
│  │ Conv Count       │ number  │ 100                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  🎯 Required for Conversion Value Calculation              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Field              │ Status  │ Mapped To             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ ✓ Campaign Name    │ ✅ Auto │ Ad Campaign           │  │
│  │ ✓ Platform         │ ✅ Auto │ Platform              │  │
│  │ ✓ Revenue          │ ✅ Auto │ Sales Revenue         │  │
│  │ ✓ Conversions      │ ✅ Auto │ Conv Count            │  │
│  │ ○ Spend (optional) │ ⚠️  Map │ [Select: Budget ($)] │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [✅ Confirm Mapping]  [✏️ Edit]  [💾 Save Template]      │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 4: User Confirms Mapping

**User Action:**
- Reviews auto-mapping suggestions
- Optionally maps "Budget ($)" to "Spend" for additional metrics
- Clicks "✅ Confirm Mapping"

**System Action:**
- Saves mapping configuration for this Google Sheets connection
- Stores mapping in database for future use
- Optionally saves as template if user chooses

---

### Step 5: Data Transformation & Filtering

**System Processing:**

1. **Read Google Sheets Data:**
```typescript
Raw Data:
[
  ["Ad Campaign", "Platform", "Views", "Clicks", "Budget ($)", "Sales Revenue", "Conv Count"],
  ["test023", "LinkedIn", "12500", "450", "$1,250.00", "$5,000.00", "100"],
  ["Summer Sale", "LinkedIn", "20000", "600", "$2,000.00", "$8,000.00", "160"],
  ["Holiday Campaign", "Facebook", "30000", "900", "$3,000.00", "$12,000.00", "240"]
]
```

2. **Apply Mappings:**
```typescript
Transformed Data:
[
  {
    campaignName: "test023",
    platform: "LinkedIn",
    revenue: 5000.00,        // Transformed from "$5,000.00"
    conversions: 100,        // Transformed from "100"
    spend: 1250.00          // Optional, from "Budget ($)"
  },
  {
    campaignName: "Summer Sale",
    platform: "LinkedIn",
    revenue: 8000.00,
    conversions: 160,
    spend: 2000.00
  },
  {
    campaignName: "Holiday Campaign",
    platform: "Facebook",
    revenue: 12000.00,
    conversions: 240,
    spend: 3000.00
  }
]
```

3. **Filter for Campaign "test023" and Platform "LinkedIn":**
```typescript
Filtered Rows:
[
  {
    campaignName: "test023",
    platform: "LinkedIn",
    revenue: 5000.00,
    conversions: 100,
    spend: 1250.00
  }
]
```

**Note:** If campaign name doesn't match exactly, system falls back to platform-only filtering (as per existing logic).

---

### Step 6: Conversion Value Calculation

**Calculation Logic:**
```typescript
// For campaign "test023"
const matchedRows = filteredRows; // Only "test023" + "LinkedIn" row

// Sum revenue and conversions
const totalRevenue = matchedRows.reduce((sum, row) => sum + row.revenue, 0);
// = 5000.00

const totalConversions = matchedRows.reduce((sum, row) => sum + row.conversions, 0);
// = 100

// Calculate conversion value
const conversionValue = totalConversions > 0 
  ? totalRevenue / totalConversions 
  : 0;
// = 5000.00 / 100 = $50.00 per conversion
```

**System Updates:**
1. Updates `linkedinConnections.conversionValue = 50.00` for campaign "test023"
2. Updates campaign-level conversion value (if single platform)
3. Triggers KPI refresh to recalculate revenue metrics
4. Displays success message in UI

---

### Step 7: Revenue Metrics Available

**After Calculation:**
- **Conversion Value**: $50.00 per conversion
- **Total Revenue**: $5,000.00 (from 100 conversions)
- **ROAS**: 4.0 (Revenue $5,000 / Spend $1,250)
- **ROI**: 300% ((Revenue - Spend) / Spend * 100)

**UI Updates:**
- Green success card in Connected Platforms section
- Revenue metrics now visible in Overview, Ad Comparison, Financial Analysis
- Conversion value tooltip shows source: "Calculated from Google Sheets data"

---

## Alternative: Custom Data Integration

### Scenario: User uploads CSV instead of Google Sheets

**User Action:**
1. Navigates to campaign "test023"
2. Clicks "Custom Integration" → "Upload CSV"
3. Selects file: "marketing_data_q4.csv"

**CSV Structure:**
```csv
Campaign,Channel,Impressions,Clicks,Cost,Revenue,Conversions
test023,LinkedIn,12500,450,1250,5000,100
Summer Sale,LinkedIn,20000,600,2000,8000,160
```

**System Processing:**

1. **Upload & Parse:**
   - Parses CSV file
   - Detects columns: Campaign, Channel, Impressions, Clicks, Cost, Revenue, Conversions

2. **Column Detection:**
```typescript
Detected Columns:
1. "Campaign" → text (matches "Campaign Name")
2. "Channel" → text (matches "Platform")
3. "Impressions" → number
4. "Clicks" → number
5. "Cost" → currency (matches "Spend")
6. "Revenue" → currency (exact match!)
7. "Conversions" → number (exact match!)
```

3. **Auto-Mapping:**
```typescript
✅ "Campaign" → Campaign Name (confidence: 0.95)
✅ "Channel" → Platform (confidence: 0.90) // via alias "channel"
✅ "Revenue" → Revenue (confidence: 1.0) // exact match
✅ "Conversions" → Conversions (confidence: 1.0) // exact match
✅ "Cost" → Spend (confidence: 0.85) // via alias "cost"
```

4. **User Confirms:**
   - System shows mapping preview
   - User confirms
   - Data is imported

5. **Conversion Value Calculation:**
   - Same logic as Google Sheets
   - Filters for "test023" + "LinkedIn"
   - Calculates: $5,000 / 100 = $50.00

---

## Template Reuse Example

### Scenario: User uploads similar file next month

**User Action:**
1. Uploads "marketing_data_q5.csv" with same structure
2. System recognizes similar column structure
3. Suggests saved template: "Q4 Marketing Data Template"

**System Action:**
```typescript
Template Match Found:
- Template: "Q4 Marketing Data Template"
- Match Score: 0.95 (very similar structure)
- Suggested Mappings:
  ✅ Campaign → Campaign Name
  ✅ Channel → Platform
  ✅ Revenue → Revenue
  ✅ Conversions → Conversions
```

**User Experience:**
- One-click to apply template
- No manual mapping needed
- Instant conversion value calculation

---

## Edge Cases & Fallbacks

### Case 1: Column Names Don't Match Well

**Example Sheet:**
```
| Ad Name | Ad Network | Money Made | Sales Count |
```

**System Response:**
- Auto-mapping confidence low (< 0.6)
- Shows manual mapping UI
- User manually selects:
  - "Ad Name" → Campaign Name
  - "Ad Network" → Platform
  - "Money Made" → Revenue
  - "Sales Count" → Conversions

### Case 2: Missing Required Column

**Example Sheet:**
```
| Campaign | Platform | Revenue |
// Missing "Conversions" column
```

**System Response:**
- Detects missing "Conversions" field
- Shows warning: "Conversions column not found"
- Options:
  1. Use default: Assume 1 conversion per row
  2. Skip conversion value calculation
  3. User provides manual value

### Case 3: Multiple Revenue Columns

**Example Sheet:**
```
| Campaign | Platform | Product Revenue | Service Revenue | Total Revenue |
```

**System Response:**
- Detects multiple revenue-like columns
- Asks user: "Which column represents total revenue?"
- User selects "Total Revenue"
- System maps accordingly

---

## Integration with Existing System

### Current Conversion Value Flow (Enhanced)

```typescript
// Existing logic in routes-oauth.ts (enhanced with mapping)

async function calculateConversionValueFromGoogleSheets(
  campaignId: string,
  connectionId: string
) {
  // 1. Get mapping configuration for this connection
  const mapping = await storage.getColumnMapping(connectionId);
  
  // 2. Fetch raw Google Sheets data
  const rawData = await fetchGoogleSheetsData(connectionId);
  
  // 3. Apply mapping transformations
  const transformedData = transformDataWithMapping(rawData, mapping);
  
  // 4. Filter for campaign and platform (existing logic)
  const campaign = await storage.getCampaign(campaignId);
  const platformLower = campaign?.platform?.toLowerCase();
  
  const filteredRows = filterRowsByCampaignAndPlatform(
    transformedData,
    campaign.name,
    platformLower
  );
  
  // 5. Calculate conversion value (existing logic)
  const totalRevenue = sumColumn(filteredRows, 'revenue');
  const totalConversions = sumColumn(filteredRows, 'conversions');
  
  if (totalConversions > 0) {
    const conversionValue = totalRevenue / totalConversions;
    
    // 6. Update platform connection (existing logic)
    if (platformLower === 'linkedin') {
      await storage.updateLinkedInConnection(campaignId, {
        conversionValue: conversionValue.toString()
      });
    }
    
    return conversionValue;
  }
  
  return null;
}
```

---

## Benefits for Campaign "test023"

### Before (Rigid System):
❌ Fails if columns named "Sales Revenue" instead of "Revenue"  
❌ Requires exact column names  
❌ Manual work to rename columns in Google Sheets  
❌ No reuse for similar files

### After (Flexible Mapping):
✅ Auto-detects "Sales Revenue" → "Revenue"  
✅ Works with any column structure  
✅ One-time mapping, saved for reuse  
✅ Template system for similar files  
✅ Handles edge cases gracefully

---

## Summary

The flexible mapping system enhances conversion value calculation by:

1. **Detecting any column structure** - Works with "Revenue", "Sales Revenue", "Total Revenue", etc.
2. **Intelligent matching** - Auto-suggests mappings with high confidence
3. **User control** - Manual override when needed
4. **Template reuse** - Save time on similar files
5. **Seamless integration** - Works with existing conversion value calculation logic

**For campaign "test023":**
- User connects Google Sheets with non-standard column names
- System auto-maps columns to required fields
- Conversion value calculated: $50.00 per conversion
- Revenue metrics become available immediately
- Mapping saved for future use

