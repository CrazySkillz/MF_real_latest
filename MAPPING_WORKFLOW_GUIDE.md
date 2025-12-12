# Google Sheets Mapping Workflow Guide

## Complete User Journey

### Step 1: Connect Google Sheets
1. User navigates to LinkedIn campaign → "View Detailed Analytics"
2. Clicks "Upload Additional Data" button
3. Selects "Connect Google Sheets"
4. Clicks "Connect Google Sheets" → OAuth popup opens
5. User authorizes Google access
6. System fetches available spreadsheets
7. User selects a spreadsheet from dropdown
8. Clicks "Connect Spreadsheet"
9. **"Next" button appears at bottom**

### Step 2: View Connected Datasets
1. User clicks "Next" button
2. System shows:
   - Conversion value calculation info card
   - **Google Sheets Datasets View** (list of connected sheets)
   - "Connect Google Sheets" interface (to add more sheets)

### Step 3: Map Columns
1. User clicks "Map" button on a dataset
2. **Column Mapping Interface opens**
3. System automatically:
   - Detects all columns in the spreadsheet
   - Identifies data types (text, number, currency, date)
   - Analyzes sample values
   - **Auto-maps columns** using fuzzy matching

### Step 4: Review Auto-Mappings
The system shows:
- **Required Fields** (must be mapped):
  - Campaign Name (to match rows to LinkedIn campaigns)
  - Platform (usually "LinkedIn" - can be auto-filled)
  - Impressions, Clicks, Spend (from LinkedIn API, but can be overridden)
  
- **Optional Fields**:
  - Revenue (needed for conversion value calculation)
  - Conversions (from LinkedIn API, but can be overridden)
  - Date (for time-based matching)

### Step 5: Adjust Mappings (if needed)
1. User reviews auto-mapped columns
2. If incorrect, user manually selects correct column from dropdown
3. System shows:
   - ✅ Green checkmark for correctly mapped required fields
   - ⚠️ Warning if required fields are missing
   - 💡 Info about conversion value calculation status

### Step 6: Save Mappings
1. User clicks "Save Mappings"
2. System validates:
   - All required fields are mapped
   - Data types are compatible
   - No duplicate mappings
3. Mappings are saved to database
4. **System automatically fetches data and calculates conversion value**
5. Dataset shows as "Mapped" with green badge

### Step 7: Data Processing
After mappings are saved:
1. System fetches all rows from Google Sheet
2. Transforms data based on mappings
3. Matches rows to LinkedIn campaigns by Campaign Name
4. Calculates conversion value: `Revenue ÷ LinkedIn API Conversions`
5. Updates campaign metrics with revenue data

---

## Test Scenarios with Realistic Datasets

### Scenario 1: Perfect Match (Ideal Case)
**Google Sheet Structure:**
```
| Campaign Name          | Revenue  | Date       |
|------------------------|----------|------------|
| Q4 Product Launch      | 5000.00  | 2024-01-15 |
| Brand Awareness 2024   | 3200.50  | 2024-01-16 |
| Lead Gen Campaign      | 7800.00  | 2024-01-17 |
```

**Expected Behavior:**
- ✅ Auto-mapping should match:
  - "Campaign Name" → Campaign Name (100% confidence)
  - "Revenue" → Revenue (100% confidence)
  - "Date" → Date (100% confidence)
- ✅ All required fields mapped automatically
- ✅ User can save without adjustments
- ✅ Conversion value calculated successfully

**How to Test:**
1. Create Google Sheet with exact column names
2. Connect and map
3. Verify all fields auto-mapped correctly
4. Save and verify conversion value appears

---

### Scenario 2: Non-Standard Column Names (Common Case)
**Google Sheet Structure:**
```
| Ad Campaign            | Deal Value | Transaction Date |
|------------------------|------------|------------------|
| Q4 Product Launch      | 5000.00    | 2024-01-15       |
| Brand Awareness 2024   | 3200.50    | 2024-01-16       |
| Lead Gen Campaign      | 7800.00    | 2024-01-17       |
```

**Expected Behavior:**
- ⚠️ Auto-mapping should attempt:
  - "Ad Campaign" → Campaign Name (85% confidence - partial match)
  - "Deal Value" → Revenue (90% confidence - alias match)
  - "Transaction Date" → Date (80% confidence - pattern match)
- ✅ User should review and confirm mappings
- ✅ May need to manually adjust "Ad Campaign" if confidence is low

**How to Test:**
1. Create Google Sheet with alternative column names
2. Connect and map
3. Verify auto-mapping attempts to match
4. Manually adjust if needed
5. Save and verify data matches correctly

---

### Scenario 3: Missing Required Fields
**Google Sheet Structure:**
```
| Campaign               | Sales Amount | Notes        |
|------------------------|--------------|--------------|
| Q4 Product Launch      | 5000.00      | High ROI     |
| Brand Awareness 2024   | 3200.50      | Good reach   |
```

**Expected Behavior:**
- ⚠️ Auto-mapping should match:
  - "Campaign" → Campaign Name (90% confidence)
  - "Sales Amount" → Revenue (95% confidence)
- ❌ Missing: Platform field (required)
- ✅ System should show warning: "Platform field is required"
- ✅ User must manually add Platform column or set default value

**How to Test:**
1. Create Google Sheet without Platform column
2. Connect and map
3. Verify warning appears for missing required field
4. Add Platform column or set default
5. Save and verify validation passes

---

### Scenario 4: Multiple Sheets with Different Structures
**Sheet A (CRM Data):**
```
| Campaign Name          | Deal Value | Close Date  |
|------------------------|------------|-------------|
| Q4 Product Launch      | 5000.00    | 2024-01-15  |
```

**Sheet B (Sales Data):**
```
| Ad Campaign            | Revenue    | Sale Date   |
|------------------------|------------|-------------|
| Brand Awareness 2024   | 3200.50    | 2024-01-16  |
```

**Expected Behavior:**
- ✅ Each sheet should be mapped independently
- ✅ Sheet A mappings: Campaign Name, Revenue (Deal Value), Date (Close Date)
- ✅ Sheet B mappings: Campaign Name (Ad Campaign), Revenue, Date (Sale Date)
- ✅ System should handle both structures
- ✅ Data from both sheets should be aggregated by Campaign Name

**How to Test:**
1. Connect Sheet A and map columns
2. Connect Sheet B (click "Connect Google Sheets" again)
3. Map Sheet B with different column names
4. Verify both sheets show as "Mapped"
5. Verify data from both sheets is processed correctly

---

### Scenario 5: Ambiguous Column Names
**Google Sheet Structure:**
```
| Campaign               | Value      | Amount      | Total      |
|------------------------|------------|-------------|------------|
| Q4 Product Launch      | 5000.00    | 5000.00     | 5000.00    |
```

**Expected Behavior:**
- ⚠️ Auto-mapping may be confused:
  - Multiple columns could match "Revenue" (Value, Amount, Total)
  - System should pick highest confidence match
  - User should review and manually select correct column
- ✅ System should show all potential matches
- ✅ User can override auto-mapping

**How to Test:**
1. Create Google Sheet with multiple similar columns
2. Connect and map
3. Verify auto-mapping selects one column
4. Manually change to correct column if needed
5. Save and verify correct data is used

---

### Scenario 6: Data Type Mismatches
**Google Sheet Structure:**
```
| Campaign Name          | Revenue      | Date         |
|------------------------|--------------|--------------|
| Q4 Product Launch      | $5,000.00    | Jan 15, 2024 |
| Brand Awareness 2024   | 3,200.50     | 2024-01-16   |
```

**Expected Behavior:**
- ✅ System should detect:
  - Revenue as currency (with $ and commas)
  - Date in mixed formats
- ✅ Transform functions should:
  - Strip $ and commas from Revenue
  - Normalize date formats
- ✅ Data should be processed correctly despite format differences

**How to Test:**
1. Create Google Sheet with formatted currency and dates
2. Connect and map
3. Verify data types are detected correctly
4. Save and verify transformed data is correct

---

### Scenario 7: Empty or Missing Data
**Google Sheet Structure:**
```
| Campaign Name          | Revenue      | Date         |
|------------------------|--------------|--------------|
| Q4 Product Launch      | 5000.00      | 2024-01-15   |
| Brand Awareness 2024   |              | 2024-01-16   |
| Lead Gen Campaign      | 7800.00      |              |
```

**Expected Behavior:**
- ⚠️ System should handle:
  - Empty Revenue cells (treat as 0 or null)
  - Missing dates (skip time-based matching)
- ✅ Mappings should still work
- ✅ System should process available data
- ⚠️ May show warnings for rows with missing required data

**How to Test:**
1. Create Google Sheet with some empty cells
2. Connect and map
3. Verify mappings work despite empty cells
4. Save and verify system handles missing data gracefully

---

### Scenario 8: Campaign Name Mismatch
**Google Sheet Structure:**
```
| Campaign Name              | Revenue  |
|----------------------------|----------|
| Q4 Product Launch Campaign | 5000.00  |
```

**LinkedIn Campaign Name:** "Q4 Product Launch"

**Expected Behavior:**
- ⚠️ Exact match may fail
- ✅ System should use fuzzy matching:
  - "Q4 Product Launch Campaign" ≈ "Q4 Product Launch" (85% similarity)
- ✅ Should match if similarity threshold is met
- ⚠️ May need manual adjustment if names are too different

**How to Test:**
1. Create Google Sheet with slightly different campaign names
2. Connect LinkedIn campaign with exact name
3. Map and save
4. Verify fuzzy matching works
5. Adjust if needed for better matching

---

## Testing Checklist

### Basic Functionality
- [ ] Connect Google Sheet successfully
- [ ] Auto-mapping detects columns correctly
- [ ] Required fields are identified
- [ ] Optional fields are suggested
- [ ] Manual mapping works
- [ ] Save mappings successfully
- [ ] Dataset shows as "Mapped"

### Edge Cases
- [ ] Non-standard column names
- [ ] Missing required fields
- [ ] Multiple sheets with different structures
- [ ] Ambiguous column names
- [ ] Data type mismatches
- [ ] Empty/missing data
- [ ] Campaign name mismatches
- [ ] Special characters in column names
- [ ] Very long column names
- [ ] Mixed data types in same column

### Data Processing
- [ ] Data is fetched after mapping
- [ ] Conversion value is calculated correctly
- [ ] Revenue data appears in analytics
- [ ] ROI/ROAS metrics are updated
- [ ] Multiple sheets aggregate correctly
- [ ] Campaign matching works accurately

### UI/UX
- [ ] Conversion value status card shows correctly
- [ ] Required fields are clearly marked
- [ ] Warnings appear for missing fields
- [ ] Auto-mapping feedback is clear
- [ ] Manual adjustments are intuitive
- [ ] Save button is disabled when invalid

---

## How to Create Test Datasets

### Option 1: Use Google Sheets
1. Create a new Google Sheet
2. Add columns with various naming conventions
3. Add sample data (5-10 rows)
4. Share with your Google account
5. Connect via the app

### Option 2: Use Sample Data Templates

**Template 1: Standard Format**
```
Campaign Name | Revenue | Date
Q4 Launch | 5000 | 2024-01-15
Brand 2024 | 3200 | 2024-01-16
```

**Template 2: CRM Format**
```
Ad Campaign | Deal Value | Close Date
Q4 Product Launch | 5000.00 | 2024-01-15
Brand Awareness | 3200.50 | 2024-01-16
```

**Template 3: Sales Format**
```
Campaign | Sales Amount | Transaction Date
Q4 Launch | $5,000.00 | Jan 15, 2024
Brand 2024 | $3,200.50 | Jan 16, 2024
```

---

## Troubleshooting

### Auto-mapping not working?
- Check column names match aliases in field definitions
- Verify data types are detected correctly
- Try manual mapping if confidence is low

### Conversion value not calculating?
- Ensure Revenue column is mapped
- Verify LinkedIn API has conversions data
- Check that campaign names match between sheet and LinkedIn

### Data not appearing?
- Verify mappings are saved
- Check that campaign names match exactly (or use fuzzy matching)
- Ensure data is being fetched after mapping

### Multiple sheets not aggregating?
- Verify each sheet is mapped independently
- Check that campaign names are consistent across sheets
- Ensure primary sheet is set correctly

