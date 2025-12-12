# Dynamic Dataset Standardization Strategy

## Core Principle: Adaptive Schema Discovery

Instead of forcing datasets into a rigid structure, the system should **dynamically discover and adapt** to any dataset format, then transform it into a canonical format for processing.

---

## The Dynamic Standardization Engine

### Phase 1: Schema Discovery (Dynamic Detection)

**Goal**: Understand the dataset structure without assumptions

**What It Does:**
1. **Column Detection**
   - Scans all columns (no assumptions about names)
   - Detects data types from actual values (not just headers)
   - Identifies patterns in data (not just column names)

2. **Pattern Recognition**
   - Detects if data is time-series (sequential dates)
   - Detects if data is aggregated (totals vs individual records)
   - Detects if data is multi-dimensional (multiple campaigns, platforms, etc.)
   - Detects data quality issues (missing values, outliers, inconsistencies)

3. **Semantic Analysis**
   - Understands what each column represents (not just what it's named)
   - Identifies relationships between columns
   - Detects data hierarchies (campaign → ad set → ad)

**Example:**
```javascript
// System discovers this dataset structure:
{
  columns: [
    { name: "Campaign", type: "text", semantic: "campaign_identifier" },
    { name: "Revenue", type: "currency", semantic: "monetary_value" },
    { name: "Date", type: "date", semantic: "temporal_dimension" },
    { name: "Platform", type: "text", semantic: "platform_identifier" }
  ],
  patterns: {
    isTimeSeries: true,
    isMultiPlatform: true,
    aggregationLevel: "campaign",
    dataQuality: "high"
  }
}
```

---

### Phase 2: Semantic Mapping (Intelligent Field Identification)

**Goal**: Map discovered columns to semantic concepts, not just field names

**How It Works:**
Instead of matching "Campaign Name" → `campaign_name`, the system understands:

1. **Semantic Concepts**
   - Campaign Identifier (could be "Campaign", "Campaign Name", "Ad Campaign", "Campaign ID")
   - Revenue Value (could be "Revenue", "Sales", "Deal Value", "Income", "Total Revenue")
   - Temporal Dimension (could be "Date", "Time", "Timestamp", "Period")
   - Platform Identifier (could be "Platform", "Channel", "Network", "Source")

2. **Multi-Level Matching**
   - **Level 1**: Column name analysis (exact, alias, fuzzy)
   - **Level 2**: Data pattern analysis (what values look like)
   - **Level 3**: Contextual analysis (relationship to other columns)
   - **Level 4**: Statistical analysis (distribution, uniqueness, etc.)

**Example:**
```javascript
// Column: "Deal Value"
// System analyzes:
{
  name: "Deal Value",
  type: "currency",
  values: [5000.00, 3200.50, 7800.00],
  patterns: {
    isMonetary: true,
    isPositive: true,
    hasDecimals: true,
    range: [0, 100000]
  },
  context: {
    appearsWith: ["Campaign", "Date"],
    similarTo: ["Revenue", "Sales"]
  }
}

// System concludes: This is a Revenue field
// Maps to: revenue (semantic concept)
```

---

### Phase 3: Adaptive Transformation (Format-Agnostic Processing)

**Goal**: Transform any format into canonical format, regardless of input structure

**Transformation Rules:**

1. **Type Coercion**
   ```javascript
   // Handles ANY format:
   "$5,000.00" → 5000.00
   "5,000" → 5000.00
   "5000" → 5000.00
   "5.000,50" (European) → 5000.50
   "5 000" (French) → 5000.00
   ```

2. **Name Normalization**
   ```javascript
   // Handles ANY variation:
   "test024" → "test024"
   "Test024" → "test024"
   "test 024" → "test024"
   "test-024" → "test024"
   "test_024" → "test024"
   "TEST 024" → "test024"
   ```

3. **Date Parsing**
   ```javascript
   // Handles ANY date format:
   "2024-01-15" → "2024-01-15"
   "Jan 15, 2024" → "2024-01-15"
   "15/01/2024" → "2024-01-15"
   "01-15-2024" → "2024-01-15"
   "2024/01/15" → "2024-01-15"
   "15-Jan-2024" → "2024-01-15"
   ```

4. **Platform Normalization**
   ```javascript
   // Handles ANY platform name:
   "LinkedIn Ads" → "linkedin"
   "Linked In" → "linkedin"
   "LinkedIn" → "linkedin"
   "LI" → "linkedin" (if context suggests)
   ```

---

### Phase 4: Contextual Enrichment (Smart Data Completion)

**Goal**: Fill missing data intelligently using context

**Enrichment Strategies:**

1. **Campaign Context**
   ```javascript
   // If Platform column missing:
   if (!row.platform && campaign.platform) {
     row.platform = campaign.platform; // Use campaign's platform
   }
   
   // If Campaign Name missing but Campaign ID exists:
   if (!row.campaign_name && row.campaign_id) {
     row.campaign_name = extractCampaignName(row.campaign_id);
   }
   ```

2. **Temporal Inference**
   ```javascript
   // If Date missing in time-series:
   if (isTimeSeries && !row.date) {
     row.date = inferDateFromSequence(rowIndex, previousDate);
   }
   ```

3. **Statistical Inference**
   ```javascript
   // If Revenue missing but similar rows exist:
   if (!row.revenue && hasSimilarRows) {
     row.revenue = calculateAverageFromSimilarRows();
   }
   ```

4. **Cross-Reference**
   ```javascript
   // If data exists in other sheets:
   if (!row.revenue && otherSheet.hasRevenue) {
     row.revenue = lookupFromOtherSheet(row.campaign_name);
   }
   ```

---

### Phase 5: Dynamic Filtering (Context-Aware Row Selection)

**Goal**: Select relevant rows based on multiple criteria, not just exact matches

**Filtering Strategies:**

1. **Fuzzy Campaign Matching**
   ```javascript
   // Not just exact match:
   campaign.name = "test024"
   row.campaign_name = "Test024" → ✅ Match (case-insensitive)
   row.campaign_name = "test 024" → ✅ Match (whitespace normalized)
   row.campaign_name = "test-024" → ✅ Match (separator normalized)
   row.campaign_name = "test024 Campaign" → ⚠️ Partial match (configurable)
   ```

2. **Platform Inference**
   ```javascript
   // If Platform column exists: Use it
   // If Platform column missing: Infer from campaign context
   // If Platform column has variations: Normalize first
   ```

3. **Temporal Filtering**
   ```javascript
   // Optional: Filter by date range
   if (dateRange) {
     filterByDateRange(rows, dateRange);
   }
   ```

4. **Quality-Based Filtering**
   ```javascript
   // Filter out low-quality rows
   filterByDataQuality(rows, {
     minConfidence: 0.7,
     allowMissingOptional: true
   });
   ```

---

### Phase 6: Canonical Schema Creation (Universal Output Format)

**Goal**: Create a standardized output that works for any input structure

**Canonical Schema:**
```javascript
{
  // Metadata about the transformation
  metadata: {
    source: "google_sheets",
    originalStructure: {...},
    transformations: [...],
    quality: {...}
  },
  
  // Standardized data rows
  rows: [
    {
      // Core identifiers (always present)
      campaign_identifier: "test024",  // Normalized campaign name
      platform_identifier: "linkedin",  // Canonical platform
      
      // Metrics (standardized types)
      revenue: 24000.00,                // Always number
      conversions: null,                 // null if using API
      
      // Dimensions (optional)
      date: "2024-01-15",               // ISO format
      time_period: "daily",             // Aggregation level
      
      // Metadata
      _original: {...},                 // Original row data
      _confidence: 1.0,                 // Data quality score
      _source_row: 2                    // Original row index
    }
  ],
  
  // Aggregated metrics
  aggregated: {
    total_revenue: 24000.00,
    row_count: 1,
    date_range: {...},
    quality_metrics: {...}
  }
}
```

---

## Dynamic Adaptation Examples

### Example 1: Completely Different Structure

**Input Dataset:**
```
ID | Name      | Sales Amt | When        | Channel
1  | test024   | 24000     | 2024-01-15  | LI
2  | test024   | 5000      | 2024-01-16  | FB
```

**System Process:**
1. **Discovers**: "ID" (identifier), "Name" (campaign), "Sales Amt" (revenue), "When" (date), "Channel" (platform)
2. **Maps**: "Name" → campaign_identifier, "Sales Amt" → revenue, "When" → date, "Channel" → platform_identifier
3. **Transforms**: "LI" → "linkedin", "24000" → 24000.00, "2024-01-15" → "2024-01-15"
4. **Filters**: Campaign = "test024", Platform = "linkedin"
5. **Output**: Canonical format with revenue = 24000.00

**Result**: Works perfectly, even though structure is completely different! ✅

---

### Example 2: Missing Columns

**Input Dataset:**
```
Campaign | Revenue
test024  | 24000
test024  | 5000
```

**System Process:**
1. **Discovers**: No Platform column, no Date column
2. **Enriches**: Platform from campaign context ("linkedin"), Date inferred or null
3. **Transforms**: Standardizes what exists
4. **Filters**: Campaign = "test024" (all rows, assumes same platform)
5. **Output**: Canonical format with inferred platform

**Result**: Works with missing columns! ✅

---

### Example 3: Extra Columns

**Input Dataset:**
```
Campaign | Revenue | Date       | Notes        | Sales Rep | Region
test024  | 24000   | 2024-01-15 | High ROI     | John      | US
```

**System Process:**
1. **Discovers**: Extra columns ("Notes", "Sales Rep", "Region")
2. **Maps**: Only maps relevant columns (Campaign, Revenue, Date)
3. **Ignores**: Extra columns (stored in metadata but not used)
4. **Transforms**: Standardizes mapped columns
5. **Output**: Canonical format (extra columns preserved in metadata)

**Result**: Works with extra columns! ✅

---

### Example 4: Inconsistent Formats

**Input Dataset:**
```
Campaign  | Revenue      | Date
test024   | $24,000.00   | 2024-01-15
test024   | 5000         | Jan 16, 2024
test024   | 3,000.50     | 16/01/2024
```

**System Process:**
1. **Discovers**: Inconsistent formats (currency, dates)
2. **Normalizes**: All revenue to numbers, all dates to ISO format
3. **Transforms**: "$24,000.00" → 24000.00, "Jan 16, 2024" → "2024-01-16"
4. **Output**: Canonical format with consistent types

**Result**: Works with inconsistent formats! ✅

---

### Example 5: Different Aggregation Levels

**Input Dataset A (Daily):**
```
Campaign | Revenue | Date
test024  | 1000    | 2024-01-15
test024  | 1500    | 2024-01-16
test024  | 2000    | 2024-01-17
```

**Input Dataset B (Monthly Total):**
```
Campaign | Revenue | Period
test024  | 4500    | January 2024
```

**System Process:**
1. **Discovers**: Dataset A is daily, Dataset B is monthly
2. **Normalizes**: Both to same aggregation level (or preserves level in metadata)
3. **Transforms**: Standardizes formats
4. **Output**: Canonical format with aggregation level metadata

**Result**: Works with different aggregation levels! ✅

---

## The Dynamic Engine Architecture

```
┌─────────────────────────────────────────────────────────┐
│              INPUT: Any Dataset Format                  │
│  (Unknown structure, unknown format, unknown quality)    │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 1: Schema Discovery                              │
│  • Scans structure (no assumptions)                    │
│  • Detects patterns (data-driven)                       │
│  • Identifies semantics (intelligent analysis)          │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 2: Semantic Mapping                              │
│  • Maps to concepts (not just names)                    │
│  • Multi-level matching (name + pattern + context)      │
│  • Confidence scoring (how sure are we?)                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 3: Adaptive Transformation                      │
│  • Type coercion (any format → canonical)               │
│  • Name normalization (any variation → standard)        │
│  • Format standardization (any format → ISO)            │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 4: Contextual Enrichment                        │
│  • Fills missing data (from context)                    │
│  • Infers values (from patterns)                        │
│  • Cross-references (from other sources)                │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 5: Dynamic Filtering                            │
│  • Fuzzy matching (not just exact)                       │
│  • Context-aware (uses campaign info)                   │
│  • Quality-based (filters bad data)                     │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  PHASE 6: Canonical Schema                              │
│  • Universal format (works for any input)               │
│  • Standardized types (consistent structure)             │
│  • Rich metadata (preserves original info)              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           OUTPUT: Standardized Dataset                  │
│  (Consistent structure, consistent format, high quality) │
└─────────────────────────────────────────────────────────┘
```

---

## Key Principles

1. **No Assumptions**: System doesn't assume dataset structure
2. **Pattern Recognition**: Learns from data, not just column names
3. **Semantic Understanding**: Understands meaning, not just labels
4. **Adaptive Transformation**: Handles any format variation
5. **Contextual Intelligence**: Uses all available context
6. **Quality Preservation**: Maintains data quality throughout

---

## Benefits

✅ **Handles ANY dataset structure** (columns, formats, types)
✅ **Works with missing data** (infers from context)
✅ **Works with extra data** (ignores irrelevant columns)
✅ **Works with inconsistent formats** (normalizes everything)
✅ **Works with different aggregation levels** (preserves metadata)
✅ **Works with any naming convention** (semantic mapping)
✅ **Maintains data quality** (validation and cleaning)
✅ **Provides transparency** (metadata about transformations)

---

## Summary

**The Dynamic Standardization Engine:**
- **Discovers** structure (doesn't assume)
- **Maps** semantically (understands meaning)
- **Transforms** adaptively (handles any format)
- **Enriches** contextually (fills gaps intelligently)
- **Filters** dynamically (uses all available context)
- **Outputs** canonically (consistent format)

**Result**: System can process **ANY** dataset format and calculate conversion value accurately, regardless of structure, format, or quality! 🎯

