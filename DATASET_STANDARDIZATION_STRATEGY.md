# Dataset Standardization Strategy for Conversion Value Calculation

## Problem Statement

Datasets come in various formats:
- **With Platform column**: Multi-platform datasets (Facebook, LinkedIn, Google Ads mixed)
- **Without Platform column**: Single-platform datasets (all rows are for one platform)
- **Different naming conventions**: "LinkedIn Ads" vs "LinkedIn" vs "Linked In"
- **Different campaign name formats**: "test024" vs "Test024" vs "test024 Campaign"

The system needs to accurately:
1. Identify which rows belong to the target campaign
2. Filter by platform (if applicable)
3. Aggregate revenue correctly
4. Calculate conversion value accurately

---

## Standardization Strategy

### Core Principle: **Context-Aware Processing**

The system should use **multiple sources of truth** in priority order:

1. **Campaign Context** (Primary) - What platform is the campaign?
2. **Dataset Context** (Secondary) - Does the dataset have a Platform column?
3. **Mapping Context** (Tertiary) - What did the user map?

---

## Standardization Rules

### Rule 1: Campaign Platform as Primary Context

**When processing data for a campaign, use the campaign's platform as the primary filter:**

```javascript
// Campaign context
campaign.platform = "linkedin"  // This is the source of truth

// Processing logic
if (campaign.platform === "linkedin") {
  // Filter rows for LinkedIn only
  // Use LinkedIn API conversions
}
```

**Benefits:**
- ✅ Works even if Platform column is missing
- ✅ Prevents cross-platform contamination
- ✅ Ensures accuracy for single-platform datasets

**Example:**
- Campaign: "test024" (platform: "linkedin")
- Dataset: Has Platform column with "Facebook Ads", "LinkedIn Ads", "Twitter Ads"
- **Result**: System only processes rows where Platform = "LinkedIn Ads" (or similar)

---

### Rule 2: Platform Column as Secondary Filter (When Available)

**If Platform column exists and is mapped, use it for additional filtering:**

```javascript
// Dataset has Platform column
if (platformColumnMapped) {
  // Filter by both campaign name AND platform
  rows = filterByCampaignNameAndPlatform(rows, campaignName, campaignPlatform);
} else {
  // Filter by campaign name only (assume all rows are for campaign's platform)
  rows = filterByCampaignName(rows, campaignName);
}
```

**Benefits:**
- ✅ Handles multi-platform datasets correctly
- ✅ Prevents including wrong platform data
- ✅ Works with single-platform datasets (all rows match)

**Example:**
- Campaign: "test024" (platform: "linkedin")
- Dataset: Has Platform column
- **Result**: System filters rows where Campaign Name = "test024" AND Platform matches "LinkedIn"

---

### Rule 3: Fallback Logic for Missing Platform Column

**If Platform column is NOT mapped, assume all rows are for the campaign's platform:**

```javascript
// Platform column not mapped
if (!platformColumnMapped) {
  // Assume all rows matching campaign name are for campaign's platform
  rows = filterByCampaignName(rows, campaignName);
  // No platform filtering needed - dataset is single-platform
}
```

**Benefits:**
- ✅ Works with single-platform datasets (most common case)
- ✅ Simplifies mapping for users
- ✅ Prevents errors when Platform column is missing

**Example:**
- Campaign: "test024" (platform: "linkedin")
- Dataset: No Platform column (all rows are LinkedIn data)
- **Result**: System processes all rows where Campaign Name = "test024"

---

### Rule 4: Campaign Name Matching with Normalization

**Normalize campaign names for accurate matching:**

```javascript
function normalizeCampaignName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[_-]/g, ' '); // Normalize separators
}

// Matching logic
const normalizedCampaignName = normalizeCampaignName(campaign.name);
const normalizedRowName = normalizeCampaignName(row.campaign_name);

if (normalizedCampaignName === normalizedRowName) {
  // Match!
}
```

**Benefits:**
- ✅ Handles case variations: "test024" = "Test024" = "TEST024"
- ✅ Handles whitespace: "test 024" = "test024"
- ✅ Handles separators: "test-024" = "test_024" = "test024"

**Example:**
- Campaign: "test024"
- Dataset: "Test024", "test 024", "test-024"
- **Result**: All match correctly

---

### Rule 5: Platform Name Normalization

**Normalize platform names for flexible matching:**

```javascript
function normalizePlatformName(platform: string): string[] {
  const normalized = platform.toLowerCase().trim();
  
  // Return array of possible matches
  if (normalized.includes('linkedin')) {
    return ['linkedin', 'linked in', 'linkedin ads'];
  }
  if (normalized.includes('facebook') || normalized.includes('meta')) {
    return ['facebook', 'meta', 'facebook ads', 'meta ads'];
  }
  // ... etc
}

// Matching logic
const campaignPlatformKeywords = normalizePlatformName(campaign.platform);
const rowPlatform = normalizePlatformName(row.platform);

if (campaignPlatformKeywords.some(keyword => rowPlatform.includes(keyword))) {
  // Match!
}
```

**Benefits:**
- ✅ Handles variations: "LinkedIn Ads" = "LinkedIn" = "Linked In"
- ✅ Case-insensitive matching
- ✅ Handles common abbreviations

**Example:**
- Campaign: "linkedin"
- Dataset: "LinkedIn Ads", "Linked In", "linkedin"
- **Result**: All match correctly

---

## Processing Flow

### Scenario 1: Multi-Platform Dataset WITH Platform Column

**Dataset:**
```
Campaign Name | Platform      | Revenue
test024       | Facebook Ads  | 5000
test024       | LinkedIn Ads  | 24000
test024       | Twitter Ads   | 3000
```

**Campaign:** "test024" (platform: "linkedin")

**Processing:**
1. ✅ Platform column is mapped → Use it for filtering
2. ✅ Filter: Campaign Name = "test024" AND Platform = "LinkedIn Ads"
3. ✅ Result: 1 row matched (Revenue: $24,000)
4. ✅ Calculate: $24,000 ÷ LinkedIn API Conversions

---

### Scenario 2: Single-Platform Dataset WITHOUT Platform Column

**Dataset:**
```
Campaign Name | Revenue
test024       | 24000
test024       | 15000
test024       | 9000
```

**Campaign:** "test024" (platform: "linkedin")

**Processing:**
1. ✅ Platform column NOT mapped → Assume all rows are LinkedIn
2. ✅ Filter: Campaign Name = "test024" (no platform filter)
3. ✅ Result: 3 rows matched (Total Revenue: $48,000)
4. ✅ Calculate: $48,000 ÷ LinkedIn API Conversions

---

### Scenario 3: Multi-Platform Dataset WITHOUT Platform Column (Problematic)

**Dataset:**
```
Campaign Name | Revenue
test024       | 5000   (Facebook)
test024       | 24000  (LinkedIn)
test024       | 3000   (Twitter)
```

**Campaign:** "test024" (platform: "linkedin")

**Current Behavior (Problem):**
- ❌ All 3 rows matched (Total Revenue: $38,000)
- ❌ Includes Facebook and Twitter revenue
- ❌ Incorrect conversion value

**Standardized Behavior (Solution):**
- ⚠️ System detects: Platform column missing but campaign is LinkedIn
- ⚠️ **Warning to user**: "Platform column not mapped. All rows will be processed. Ensure dataset contains only LinkedIn data."
- ✅ Filter: Campaign Name = "test024" (assume all are LinkedIn)
- ✅ Result: 3 rows matched (Total Revenue: $38,000)
- ⚠️ **User responsibility**: Ensure dataset is single-platform OR map Platform column

**Better Solution:**
- ✅ System detects: Multiple platforms likely (based on data patterns)
- ✅ **Prompt user**: "Dataset appears to contain multiple platforms. Please map Platform column for accurate filtering."
- ✅ If user confirms single-platform: Process all rows
- ✅ If user maps Platform: Filter by platform

---

## Implementation Strategy

### Step 1: Detect Dataset Type

```javascript
function detectDatasetType(columns: Column[], mappings: Mapping[]): DatasetType {
  const hasPlatformColumn = mappings.some(m => m.targetFieldId === 'platform');
  
  if (hasPlatformColumn) {
    // Check if platform values are consistent
    const platformValues = getUniquePlatformValues(rows, platformColumnIndex);
    if (platformValues.length > 1) {
      return 'MULTI_PLATFORM_WITH_COLUMN';
    } else {
      return 'SINGLE_PLATFORM_WITH_COLUMN';
    }
  } else {
    // Cannot determine - assume single-platform
    return 'UNKNOWN_PLATFORM';
  }
}
```

### Step 2: Apply Standardization Rules

```javascript
function standardizeAndFilterRows(
  rows: any[],
  campaign: Campaign,
  mappings: Mapping[],
  datasetType: DatasetType
): any[] {
  const campaignName = campaign.name;
  const campaignPlatform = campaign.platform;
  
  // Step 1: Filter by campaign name (always required)
  let filteredRows = rows.filter(row => 
    normalizeCampaignName(row.campaign_name) === normalizeCampaignName(campaignName)
  );
  
  // Step 2: Filter by platform (if applicable)
  if (datasetType === 'MULTI_PLATFORM_WITH_COLUMN') {
    // Platform column exists - use it for filtering
    const platformKeywords = normalizePlatformName(campaignPlatform);
    filteredRows = filteredRows.filter(row => {
      const rowPlatform = normalizePlatformName(row.platform);
      return platformKeywords.some(keyword => rowPlatform.includes(keyword));
    });
  } else if (datasetType === 'UNKNOWN_PLATFORM') {
    // Platform column missing - assume all rows are for campaign's platform
    // No additional filtering needed
    // But warn user if dataset seems large or has suspicious patterns
  }
  
  return filteredRows;
}
```

### Step 3: Calculate Conversion Value

```javascript
function calculateConversionValueStandardized(
  filteredRows: any[],
  campaign: Campaign,
  linkedInConversions?: number | null
): number | null {
  // Aggregate revenue from filtered rows
  const totalRevenue = filteredRows.reduce((sum, row) => {
    return sum + (parseFloat(row.revenue) || 0);
  }, 0);
  
  // Use platform-specific conversions
  let totalConversions: number;
  if (campaign.platform === 'linkedin' && linkedInConversions) {
    totalConversions = linkedInConversions; // Use LinkedIn API
  } else {
    totalConversions = filteredRows.reduce((sum, row) => {
      return sum + (parseInt(row.conversions) || 0);
    }, 0); // Use Google Sheets conversions
  }
  
  if (totalConversions > 0) {
    return totalRevenue / totalConversions;
  }
  
  return null;
}
```

---

## User Experience Enhancements

### 1. Smart Platform Detection

**During Mapping:**
- System analyzes dataset and detects if Platform column exists
- If Platform column exists: Show warning if values are inconsistent
- If Platform column missing: Show info that all rows will be processed

**UI Messages:**
- ✅ "Platform column detected. Rows will be filtered by platform."
- ⚠️ "Platform column not mapped. All rows matching campaign name will be processed."
- ⚠️ "Multiple platforms detected. Ensure Platform column is mapped for accurate filtering."

### 2. Validation Warnings

**Before Saving Mappings:**
- Check if dataset appears multi-platform but Platform column not mapped
- Warn user: "Dataset contains multiple platforms. Map Platform column for accurate filtering."
- Allow user to proceed if they confirm dataset is single-platform

### 3. Processing Feedback

**After Processing:**
- Show summary: "Processed X rows for LinkedIn platform"
- Show revenue: "Total Revenue: $X from Y rows"
- Show conversion value: "Conversion Value: $X (using LinkedIn API conversions)"

---

## Standardization Matrix

| Dataset Type | Platform Column | Campaign Platform | Filtering Logic | Result |
|-------------|----------------|-------------------|-----------------|---------|
| Multi-platform | ✅ Mapped | linkedin | Campaign Name + Platform | ✅ Accurate |
| Single-platform | ✅ Mapped | linkedin | Campaign Name + Platform | ✅ Accurate |
| Single-platform | ❌ Not mapped | linkedin | Campaign Name only | ✅ Accurate (assumes all LinkedIn) |
| Multi-platform | ❌ Not mapped | linkedin | Campaign Name only | ⚠️ **Problem** (includes other platforms) |
| Multi-platform | ✅ Mapped | linkedin | Campaign Name + Platform | ✅ Accurate |

---

## Recommendations

### For Users:

1. **Best Practice**: Always include Platform column in multi-platform datasets
2. **Single-Platform Datasets**: Platform column is optional (but recommended for clarity)
3. **Campaign Names**: Use consistent naming (case doesn't matter, but avoid extra text)
4. **Platform Names**: Use standard names ("LinkedIn Ads", "Facebook Ads", etc.)

### For System:

1. **Always use campaign.platform as primary context**
2. **Use Platform column as secondary filter when available**
3. **Warn users when Platform column is missing in multi-platform datasets**
4. **Normalize all names for flexible matching**
5. **Provide clear feedback about which rows were processed**

---

## Summary

**Standardization Strategy:**
1. ✅ **Campaign Platform** = Primary source of truth
2. ✅ **Platform Column** = Secondary filter (when available)
3. ✅ **Campaign Name** = Always required for matching
4. ✅ **Normalization** = Handles variations in names
5. ✅ **Smart Detection** = Identifies dataset type and warns users

**Result:**
- ✅ Accurate conversion value calculation
- ✅ Works with any dataset format
- ✅ Prevents cross-platform contamination
- ✅ Clear user feedback and warnings

