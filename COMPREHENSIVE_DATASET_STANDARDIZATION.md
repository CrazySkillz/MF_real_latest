# Comprehensive Dataset Standardization Strategy

## Problem Statement

Datasets come in infinite variations:
- **Column names**: "Campaign Name" vs "Campaign" vs "Ad Campaign" vs "Campaign Title"
- **Data formats**: "$5,000.00" vs "5000" vs "5,000" vs "5000.00"
- **Date formats**: "2024-01-15" vs "Jan 15, 2024" vs "15/01/2024" vs "01-15-2024"
- **Missing columns**: Some datasets have Platform, some don't; some have Date, some don't
- **Extra columns**: Unmapped columns that don't affect processing
- **Data types**: Numbers as text, currency as text, dates as text
- **Empty cells**: Missing values, nulls, empty strings
- **Inconsistent naming**: "test024" vs "Test024" vs "test 024" vs "test-024"
- **Multiple structures**: Different sheets with different formats
- **Aggregated vs detailed**: Some rows are daily, some are monthly totals

**Goal**: Transform ANY dataset into a standardized, canonical format that the system can reliably process to calculate conversion value accurately.

---

## Standardization Pipeline: 7 Stages

### Stage 1: Dataset Analysis & Detection

**Purpose**: Understand the dataset structure before processing

**What to Detect:**
1. **Column Structure**
   - Which columns exist?
   - What are their names (original)?
   - What data types are detected?
   - Are there duplicate column names?

2. **Data Patterns**
   - Is this a multi-platform dataset? (Check for Platform column with multiple values)
   - Is this time-series data? (Check for Date column with sequential dates)
   - Is this aggregated data? (Check if rows represent totals vs individual records)
   - Are there missing values? (Count nulls/empties per column)

3. **Data Quality**
   - Are there formatting inconsistencies? (Mixed currency formats, date formats)
   - Are there outliers? (Revenue values that seem incorrect)
   - Are there duplicates? (Identical rows)

**Output**: Dataset metadata object
```javascript
{
  structure: {
    totalRows: 100,
    totalColumns: 8,
    hasHeader: true,
    columnNames: [...],
    detectedTypes: {...}
  },
  patterns: {
    isMultiPlatform: true,
    isTimeSeries: true,
    isAggregated: false,
    hasMissingValues: true
  },
  quality: {
    duplicateRows: 2,
    inconsistentFormats: ['revenue', 'date'],
    outliers: [...]
  }
}
```

---

### Stage 2: Column Name Normalization

**Purpose**: Map any column name variation to canonical field names

**Strategy**: Multi-level matching

**Level 1: Exact Match**
- "Campaign Name" → `campaign_name`
- "Revenue" → `revenue`

**Level 2: Alias Matching**
- "Campaign" → `campaign_name` (via alias list)
- "Ad Campaign" → `campaign_name` (via alias list)
- "Deal Value" → `revenue` (via alias list)
- "Sales" → `revenue` (via alias list)

**Level 3: Fuzzy Matching**
- "Campaign_Name" → `campaign_name` (normalize separators)
- "campaignname" → `campaign_name` (detect word boundaries)
- "CampaignName" → `campaign_name` (camelCase detection)

**Level 4: Pattern Matching**
- Column matching `/campaign.*name/i` → `campaign_name`
- Column matching `/revenue|sales|income/i` → `revenue`
- Column matching `/date|time|timestamp/i` → `date`

**Output**: Normalized column mapping
```javascript
{
  originalName: "Ad Campaign",
  normalizedName: "campaign_name",
  confidence: 0.95,
  matchType: "alias"
}
```

---

### Stage 3: Data Type Standardization

**Purpose**: Convert all values to consistent, canonical types

**Currency Standardization:**
```javascript
Input variations:
- "$5,000.00" → 5000.00
- "5,000" → 5000.00
- "5000" → 5000.00
- "5,000.50" → 5000.50
- "$ 5,000.00" → 5000.00
- "USD 5000" → 5000.00

Output: Always a number (float)
```

**Date Standardization:**
```javascript
Input variations:
- "2024-01-15" → "2024-01-15" (ISO format)
- "Jan 15, 2024" → "2024-01-15"
- "15/01/2024" → "2024-01-15"
- "01-15-2024" → "2024-01-15"
- "2024/01/15" → "2024-01-15"

Output: Always ISO 8601 format (YYYY-MM-DD)
```

**Number Standardization:**
```javascript
Input variations:
- "1,000" → 1000
- "1000" → 1000
- "1.000" (European) → 1000
- "1 000" → 1000

Output: Always a number (integer or float)
```

**Text Standardization:**
```javascript
Input variations:
- "test024" → "test024"
- "Test024" → "test024" (lowercase)
- "test 024" → "test024" (normalize whitespace)
- "test-024" → "test024" (normalize separators)
- "test_024" → "test024"

Output: Normalized string (lowercase, trimmed, separators normalized)
```

**Platform Standardization:**
```javascript
Input variations:
- "LinkedIn Ads" → "linkedin"
- "Linked In" → "linkedin"
- "LinkedIn" → "linkedin"
- "Facebook Ads" → "facebook"
- "Meta Ads" → "facebook"
- "Google Ads" → "google"

Output: Canonical platform identifier
```

---

### Stage 4: Missing Data Handling

**Purpose**: Handle missing values intelligently

**Strategies:**

1. **Required Fields**
   - Campaign Name: Cannot be missing → Error
   - Revenue: Cannot be missing for conversion value → Warning

2. **Optional Fields**
   - Platform: If missing, infer from campaign context
   - Date: If missing, use current date or null
   - Conversions: If missing, use API conversions (for LinkedIn)

3. **Inference Rules**
   ```javascript
   if (platform missing && campaign.platform exists) {
     row.platform = campaign.platform; // Infer from context
   }
   
   if (date missing && isTimeSeries) {
     row.date = inferDateFromContext(); // Use row index or sequence
   }
   ```

4. **Default Values**
   ```javascript
   if (revenue missing) {
     row.revenue = 0; // Or null if required
   }
   
   if (conversions missing && linkedInAPI available) {
     row.conversions = null; // Will use API conversions
   }
   ```

**Output**: Rows with all required fields populated (or marked as invalid)

---

### Stage 5: Data Validation & Cleaning

**Purpose**: Ensure data quality and consistency

**Validation Rules:**

1. **Campaign Name Validation**
   ```javascript
   - Must not be empty
   - Must be string
   - Length: 1-255 characters
   - No special characters that break matching
   ```

2. **Revenue Validation**
   ```javascript
   - Must be numeric (if provided)
   - Must be >= 0 (no negative revenue)
   - Must be reasonable (not 999999999)
   - Must be parseable (handle "$5,000.00" format)
   ```

3. **Date Validation**
   ```javascript
   - Must be valid date (if provided)
   - Must be in reasonable range (not year 1900 or 2100)
   - Must be parseable from various formats
   ```

4. **Platform Validation**
   ```javascript
   - Must match known platforms (if provided)
   - Must be normalized to canonical form
   ```

**Cleaning Actions:**

1. **Remove Invalid Rows**
   - Missing required fields
   - Invalid data types
   - Outlier values (configurable thresholds)

2. **Fix Common Issues**
   - Trim whitespace
   - Remove special characters from campaign names
   - Normalize separators
   - Fix encoding issues

3. **Deduplication**
   - Identify duplicate rows
   - Option 1: Remove duplicates
   - Option 2: Sum values (if aggregated data)

**Output**: Clean, validated dataset

---

### Stage 6: Context-Aware Filtering

**Purpose**: Filter rows based on campaign context

**Filtering Logic:**

1. **Campaign Name Matching**
   ```javascript
   function matchesCampaign(row, campaign) {
     const normalizedRow = normalizeCampaignName(row.campaign_name);
     const normalizedCampaign = normalizeCampaignName(campaign.name);
     return normalizedRow === normalizedCampaign;
   }
   ```

2. **Platform Filtering**
   ```javascript
   function matchesPlatform(row, campaign) {
     // If Platform column exists and is mapped
     if (row.platform) {
       return normalizePlatform(row.platform) === normalizePlatform(campaign.platform);
     }
     // If Platform column missing, assume all rows are for campaign's platform
     return true;
   }
   ```

3. **Date Filtering (Optional)**
   ```javascript
   function matchesDateRange(row, dateRange) {
     if (!dateRange || !row.date) return true;
     return row.date >= dateRange.start && row.date <= dateRange.end;
   }
   ```

**Output**: Filtered rows that match campaign context

---

### Stage 7: Canonical Format Creation

**Purpose**: Create final standardized dataset in canonical format

**Canonical Format:**
```javascript
{
  // Metadata
  metadata: {
    source: "google_sheets",
    connectionId: "...",
    processedAt: "2024-01-15T10:30:00Z",
    totalRows: 100,
    filteredRows: 3,
    warnings: [...],
    errors: [...]
  },
  
  // Standardized rows
  rows: [
    {
      // Identifiers (normalized)
      campaign_name: "test024",        // Always lowercase, trimmed
      platform: "linkedin",            // Always canonical platform ID
      
      // Metrics (standardized types)
      revenue: 24000.00,               // Always number (float)
      conversions: null,                // null if using API conversions
      
      // Optional fields
      date: "2024-01-15",              // Always ISO format
      impressions: 91976,              // Always number (integer)
      clicks: 14171,                   // Always number (integer)
      spend: 36315.93,                 // Always number (float)
      
      // Metadata
      originalRowIndex: 2,             // Track original row for debugging
      dataQuality: {
        hasMissingValues: false,
        isOutlier: false,
        confidence: 1.0
      }
    },
    // ... more rows
  ],
  
  // Aggregated metrics (for conversion value calculation)
  aggregated: {
    totalRevenue: 72000.00,
    totalConversions: null,            // Will use LinkedIn API
    rowCount: 3,
    dateRange: {
      start: "2024-01-15",
      end: "2024-01-17"
    }
  }
}
```

---

## Conversion Value Calculation with Standardized Data

**Process:**

1. **Get Filtered Rows**
   ```javascript
   const filteredRows = canonicalData.rows;
   // Already filtered by campaign name and platform
   ```

2. **Aggregate Revenue**
   ```javascript
   const totalRevenue = filteredRows.reduce((sum, row) => {
     return sum + (row.revenue || 0);
   }, 0);
   ```

3. **Get Conversions**
   ```javascript
   let totalConversions;
   if (campaign.platform === 'linkedin' && linkedInAPI.available) {
     totalConversions = linkedInAPI.getConversions(campaign.id);
   } else {
     totalConversions = filteredRows.reduce((sum, row) => {
       return sum + (row.conversions || 0);
     }, 0);
   }
   ```

4. **Calculate Conversion Value**
   ```javascript
   if (totalConversions > 0) {
     const conversionValue = totalRevenue / totalConversions;
     return conversionValue;
   }
   return null;
   ```

---

## Implementation Strategy

### Phase 1: Detection & Analysis
- Implement dataset structure detection
- Implement pattern recognition
- Create dataset metadata object

### Phase 2: Normalization
- Implement column name normalization (all 4 levels)
- Implement data type standardization
- Create normalization functions for each data type

### Phase 3: Validation & Cleaning
- Implement validation rules
- Implement cleaning functions
- Create data quality scoring

### Phase 4: Context-Aware Processing
- Implement campaign context filtering
- Implement platform inference
- Create filtering pipeline

### Phase 5: Canonical Format
- Create canonical format schema
- Implement format conversion
- Create aggregation functions

---

## Benefits of This Approach

1. **Handles Any Dataset Format**
   - Works with any column names
   - Works with any data formats
   - Works with missing columns
   - Works with extra columns

2. **Accurate Processing**
   - Normalized data ensures consistent matching
   - Validation prevents errors
   - Context-aware filtering ensures correct rows processed

3. **Robust Error Handling**
   - Detects issues early
   - Provides clear warnings
   - Handles edge cases gracefully

4. **Maintainable**
   - Clear pipeline stages
   - Modular functions
   - Easy to extend

5. **User-Friendly**
   - Clear feedback about processing
   - Warnings for potential issues
   - Transparent about what was processed

---

## Example: Processing Your Multi-Platform Dataset

**Input Dataset:**
```
Campaign ID          | Campaign Name | Platform      | Revenue
CAMPAIGN_100 test024 | test024       | Facebook Ads  | 5000.00
CAMPAIGN_100 test024 | test024       | LinkedIn Ads  | 24000.00
CAMPAIGN_100 test024 | test024       | Twitter Ads   | 3000.00
```

**Stage 1: Analysis**
- Detects: Multi-platform dataset, has Platform column, 3 rows

**Stage 2: Normalization**
- "Campaign Name" → `campaign_name`
- "Platform" → `platform`
- "Revenue" → `revenue`
- Normalizes: "LinkedIn Ads" → "linkedin"

**Stage 3: Standardization**
- Revenue: "24000.00" → 24000.00 (number)
- Platform: "LinkedIn Ads" → "linkedin" (canonical)
- Campaign Name: "test024" → "test024" (normalized)

**Stage 4: Missing Data**
- All required fields present ✅

**Stage 5: Validation**
- All values valid ✅

**Stage 6: Filtering**
- Campaign: "test024" matches ✅
- Platform: "linkedin" matches ✅
- Result: 1 row (LinkedIn Ads row)

**Stage 7: Canonical Format**
```javascript
{
  rows: [{
    campaign_name: "test024",
    platform: "linkedin",
    revenue: 24000.00
  }],
  aggregated: {
    totalRevenue: 24000.00,
    totalConversions: null // Will use LinkedIn API
  }
}
```

**Conversion Value Calculation:**
- Total Revenue: $24,000.00
- Total Conversions: From LinkedIn API (e.g., 993)
- Conversion Value: $24,000.00 / 993 = $24.17

---

## Summary

**The standardization pipeline transforms ANY dataset into a canonical format through:**

1. ✅ **Analysis** - Understand dataset structure
2. ✅ **Normalization** - Map variations to standard names
3. ✅ **Standardization** - Convert to consistent types/formats
4. ✅ **Validation** - Ensure data quality
5. ✅ **Filtering** - Match to campaign context
6. ✅ **Canonical Format** - Create standardized output
7. ✅ **Calculation** - Accurate conversion value

**Result**: System can process any dataset format and calculate conversion value accurately, regardless of how the data is structured.

