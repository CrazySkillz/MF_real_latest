# User Journey: Dynamic Standardization for LinkedIn Conversion Value

## Goal
Connect any Google Sheet format and automatically calculate conversion value for LinkedIn campaigns.

---

## Complete User Journey

### Step 1: Connect Google Sheet

**User Action:**
1. User navigates to LinkedIn campaign → "View Detailed Analytics"
2. Clicks "Upload Additional Data"
3. Selects "Connect Google Sheets"
4. Authorizes Google access
5. Selects spreadsheet from list
6. Clicks "Connect Spreadsheet"

**What Happens Behind the Scenes:**
- System connects to Google Sheets API
- Stores connection in database
- **System does NOT yet process the data**

**User Sees:**
- ✅ "Google Sheets Connected!" toast notification
- "Next" button appears at bottom

---

### Step 2: View Connected Datasets

**User Action:**
1. Clicks "Next" button
2. Sees connected datasets list
3. Sees conversion value calculation info card

**What Happens Behind the Scenes:**
- System fetches list of connected Google Sheets
- Shows mapping status for each dataset

**User Sees:**
- List of connected Google Sheets
- "Map" button for unmapped datasets
- "Edit Mapping" button for mapped datasets
- Info card explaining conversion value calculation

---

### Step 3: Click "Map" on Dataset

**User Action:**
1. Clicks "Map" button on a dataset
2. Column Mapping Interface opens

**What Happens Behind the Scenes (Automatic):**
- **Phase 1: Schema Discovery**
  - System reads all rows from Google Sheet
  - Scans all columns (no assumptions)
  - Detects data types from actual values
  - Identifies patterns (time-series, multi-platform, etc.)
  - Analyzes data quality (missing values, outliers)

- **Phase 2: Semantic Mapping**
  - System analyzes each column:
    - Column name ("Campaign Name", "Campaign", "Ad Campaign")
    - Data patterns (what values look like)
    - Context (relationship to other columns)
    - Statistics (uniqueness, distribution)
  - Maps columns to semantic concepts:
    - "Campaign Name" → `campaign_identifier`
    - "Revenue" → `revenue_value`
    - "Platform" → `platform_identifier`
    - "Date" → `temporal_dimension`

- **Phase 3: Auto-Mapping**
  - System creates mappings automatically:
    - High confidence matches (exact/alias) → Auto-mapped
    - Medium confidence matches → Suggested
    - Low confidence matches → User review needed

**User Sees:**
- Loading indicator: "Analyzing dataset structure..."
- Then: Column mapping interface with:
  - Detected columns list
  - Auto-mapped fields (with confidence scores)
  - Suggested mappings (for review)
  - Unmapped fields (if any)

---

### Step 4: Review Auto-Mappings

**User Action:**
1. Reviews auto-mapped columns
2. Sees confidence scores (High/Medium/Low)
3. Adjusts mappings if needed (optional)

**What User Sees:**

**Required Fields Section:**
```
✅ Campaign Name
   Mapped to: "Campaign Name" (Auto, 100% confidence)
   ✓ Mapped to: Campaign Name

✅ Revenue
   Mapped to: "Revenue" (Auto, 100% confidence)
   💡 For Conversion Value
   ✓ Mapped to: Revenue
```

**Optional Fields Section:**
```
⚠️ Platform
   Mapped to: "Platform" (Auto, 95% confidence)
   ⚠️ Review suggested
   [Dropdown: Platform ▼]

⚠️ Date
   Mapped to: "Date" (Auto, 90% confidence)
   ⚠️ Review suggested
   [Dropdown: Date ▼]
```

**Conversion Value Calculation Status Card:**
```
✅ Conversion Value Can Be Calculated

Required Fields:
✓ Campaign Name: Mapped
✓ Revenue: Mapped

Conversions: Will use LinkedIn API (more accurate)

Expected Calculation:
Conversion Value = Revenue ÷ LinkedIn API Conversions
```

**If Mapping Issues:**
```
⚠️ Some Fields Need Attention

Required Fields:
✓ Campaign Name: Mapped
⚠️ Revenue: Not mapped (required for conversion value)

Please map Revenue column to calculate conversion value.
```

**User Can:**
- ✅ Accept auto-mappings (if confident)
- ✅ Adjust mappings manually (if needed)
- ✅ See data preview (sample values)
- ✅ See confidence scores

---

### Step 5: Save Mappings

**User Action:**
1. Reviews mappings
2. Clicks "Save Mappings" button

**What Happens Behind the Scenes (Automatic Processing):**

**Phase 4: Adaptive Transformation**
- System processes all rows:
  - Normalizes campaign names: "Test024" → "test024"
  - Standardizes revenue: "$24,000.00" → 24000.00
  - Normalizes platform: "LinkedIn Ads" → "linkedin"
  - Standardizes dates: "Jan 15, 2024" → "2024-01-15"

**Phase 5: Contextual Enrichment**
- System enriches missing data:
  - If Platform missing → Uses campaign's platform ("linkedin")
  - If Date missing → Infers from sequence or uses null
  - If Revenue missing → Flags as error (required)

**Phase 6: Dynamic Filtering**
- System filters rows for this campaign:
  - Campaign Name: "test024" (fuzzy matching)
  - Platform: "linkedin" (if Platform column exists)
  - Result: Only relevant rows selected

**Phase 7: Data Validation**
- System validates:
  - All required fields present
  - Data types correct
  - Values in reasonable ranges
  - No duplicates (or handles appropriately)

**Phase 8: Canonical Format Creation**
- System creates standardized dataset:
  ```javascript
  {
    rows: [{
      campaign_identifier: "test024",
      platform_identifier: "linkedin",
      revenue: 24000.00,
      date: "2024-01-15"
    }],
    aggregated: {
      total_revenue: 24000.00,
      row_count: 1
    }
  }
  ```

**Phase 9: Conversion Value Calculation**
- System calculates:
  - Total Revenue: Sum from filtered rows
  - Total Conversions: From LinkedIn API (prioritized)
  - Conversion Value: Revenue ÷ Conversions
  - Updates campaign with conversion value

**User Sees:**
- Loading indicator: "Processing data and calculating conversion value..."
- Success message: "Mappings saved! Conversion value calculated: $24.17"
- Dataset shows as "Mapped" with green badge
- Conversion value appears in campaign analytics

---

### Step 6: View Results

**User Action:**
1. Closes mapping interface
2. Returns to campaign analytics
3. Views conversion value and revenue metrics

**What User Sees:**

**In Campaign Analytics:**
- ✅ Conversion Value: $24.17
- ✅ Revenue: $24,000.00
- ✅ ROI, ROAS, Profit metrics (now unlocked)
- ✅ Data source: "Google Sheets + LinkedIn API"

**In Connected Platforms:**
- Google Sheets shows as "Connected" and "Mapped"
- Can click "Edit Mapping" to adjust
- Can connect additional sheets

---

## Key User Experience Features

### 1. Automatic Intelligence

**User Doesn't Need To:**
- ❌ Know exact column names
- ❌ Format data in specific way
- ❌ Include all columns
- ❌ Use consistent naming

**System Handles:**
- ✅ Any column names ("Campaign", "Campaign Name", "Ad Campaign")
- ✅ Any formats ("$5,000.00", "5000", "5,000")
- ✅ Missing columns (infers from context)
- ✅ Extra columns (ignores irrelevant ones)

### 2. Smart Suggestions

**System Provides:**
- ✅ Auto-mappings with confidence scores
- ✅ Suggestions for ambiguous columns
- ✅ Warnings for missing required fields
- ✅ Data preview for verification

**User Can:**
- ✅ Accept suggestions (one click)
- ✅ Adjust if needed (manual override)
- ✅ See why system made each mapping

### 3. Transparent Processing

**User Sees:**
- ✅ What columns were detected
- ✅ How columns were mapped
- ✅ Confidence scores for each mapping
- ✅ Data quality indicators
- ✅ Processing results

**User Understands:**
- ✅ Which rows were processed
- ✅ How conversion value was calculated
- ✅ What data was used (Google Sheets + LinkedIn API)

### 4. Error Prevention

**System Prevents:**
- ❌ Processing wrong rows (filters by campaign + platform)
- ❌ Using wrong data (validates and cleans)
- ❌ Calculation errors (handles missing data gracefully)

**System Warns:**
- ⚠️ Missing required fields
- ⚠️ Low confidence mappings
- ⚠️ Data quality issues
- ⚠️ Potential calculation problems

---

## Example User Journey: Different Dataset Formats

### Scenario A: Perfect Format

**User's Sheet:**
```
Campaign Name | Revenue | Date
test024       | 24000   | 2024-01-15
```

**User Experience:**
1. Connects sheet
2. Clicks "Map"
3. System auto-maps everything (100% confidence)
4. User clicks "Save" (no adjustments needed)
5. Conversion value calculated automatically

**Time:** 30 seconds

---

### Scenario B: Non-Standard Format

**User's Sheet:**
```
Ad Campaign | Deal Value | Transaction Date
test024     | $24,000.00 | Jan 15, 2024
```

**User Experience:**
1. Connects sheet
2. Clicks "Map"
3. System auto-maps:
   - "Ad Campaign" → Campaign Name (95% confidence)
   - "Deal Value" → Revenue (90% confidence)
   - "Transaction Date" → Date (85% confidence)
4. User reviews suggestions (all look correct)
5. User clicks "Save"
6. System transforms: "$24,000.00" → 24000.00, "Jan 15, 2024" → "2024-01-15"
7. Conversion value calculated

**Time:** 1 minute (review + save)

---

### Scenario C: Missing Columns

**User's Sheet:**
```
Campaign | Revenue
test024  | 24000
```

**User Experience:**
1. Connects sheet
2. Clicks "Map"
3. System auto-maps:
   - "Campaign" → Campaign Name (100% confidence)
   - "Revenue" → Revenue (100% confidence)
   - Platform: Not found (system infers from campaign context)
4. User sees: "Platform will be inferred from campaign (LinkedIn)"
5. User clicks "Save"
6. System enriches: Adds platform = "linkedin" from campaign context
7. Conversion value calculated

**Time:** 30 seconds (no Platform column needed)

---

### Scenario D: Multi-Platform Dataset

**User's Sheet:**
```
Campaign Name | Platform      | Revenue
test024       | Facebook Ads  | 5000
test024       | LinkedIn Ads  | 24000
test024       | Twitter Ads   | 3000
```

**User Experience:**
1. Connects sheet
2. Clicks "Map"
3. System auto-maps all columns (100% confidence)
4. System detects: Multi-platform dataset
5. User sees: "Platform column detected. Rows will be filtered by platform."
6. User clicks "Save"
7. System filters: Only "LinkedIn Ads" rows processed
8. Conversion value calculated from LinkedIn rows only

**Time:** 30 seconds (system handles filtering automatically)

---

### Scenario E: Inconsistent Formats

**User's Sheet:**
```
Campaign  | Revenue      | Date
test024   | $24,000.00   | 2024-01-15
test024   | 5000         | Jan 16, 2024
test024   | 3,000.50     | 16/01/2024
```

**User Experience:**
1. Connects sheet
2. Clicks "Map"
3. System auto-maps columns (100% confidence)
4. System detects: Inconsistent formats
5. User sees: "Formats will be standardized automatically"
6. User clicks "Save"
7. System normalizes:
   - "$24,000.00" → 24000.00
   - "5000" → 5000.00
   - "3,000.50" → 3000.50
   - All dates → ISO format
8. Conversion value calculated

**Time:** 30 seconds (system handles format variations)

---

## User Journey Summary

### Before Dynamic Standardization:
- ❌ User must format data exactly right
- ❌ User must use specific column names
- ❌ User must include all columns
- ❌ Manual mapping required
- ❌ Errors if format doesn't match

### After Dynamic Standardization:
- ✅ User connects any format
- ✅ System discovers structure automatically
- ✅ System maps intelligently
- ✅ User reviews (optional adjustments)
- ✅ System processes and calculates
- ✅ Conversion value calculated accurately

### Key Benefits:
1. **Faster**: Auto-mapping saves time
2. **Easier**: Works with any format
3. **Smarter**: System understands data semantics
4. **Accurate**: Filters and validates correctly
5. **Transparent**: User sees what's happening

---

## Complete Flow Diagram

```
User Action                    System Process                    User Sees
─────────────────────────────────────────────────────────────────────────
1. Connect Sheet        →      Store connection              →   "Connected!"
                                                             
2. Click "Next"         →      Fetch datasets               →   Dataset list
                                                             
3. Click "Map"          →      Phase 1: Schema Discovery    →   "Analyzing..."
                              Phase 2: Semantic Mapping     →   Auto-mappings
                              Phase 3: Auto-Mapping         →   Mappings UI
                                                             
4. Review Mappings      →      Show confidence scores        →   Review screen
   (Optional)          →      Show data preview             →   Adjust if needed
                                                             
5. Click "Save"         →      Phase 4: Transformation       →   "Processing..."
                              Phase 5: Enrichment           →   "Calculating..."
                              Phase 6: Filtering            →   
                              Phase 7: Validation           →   
                              Phase 8: Canonical Format     →   
                              Phase 9: Calculate CV         →   "Saved! CV: $24.17"
                                                             
6. View Analytics       →      Display metrics              →   Revenue metrics
                                                             
```

---

## Success Criteria

**User Success:**
- ✅ Can connect any Google Sheet format
- ✅ System understands data automatically
- ✅ Conversion value calculated accurately
- ✅ Process takes < 2 minutes
- ✅ No technical knowledge required

**System Success:**
- ✅ Handles any dataset structure
- ✅ Maps columns intelligently
- ✅ Filters rows correctly
- ✅ Calculates conversion value accurately
- ✅ Provides clear feedback

---

## Summary

**The Dynamic Standardization User Journey:**

1. **Connect** → User connects Google Sheet (any format)
2. **Discover** → System automatically analyzes structure
3. **Map** → System intelligently maps columns
4. **Review** → User reviews (optional adjustments)
5. **Process** → System standardizes and filters
6. **Calculate** → Conversion value calculated automatically
7. **View** → User sees results in analytics

**Result**: Seamless experience where users can connect any Google Sheet format and get accurate conversion value calculation with minimal effort! 🎯

