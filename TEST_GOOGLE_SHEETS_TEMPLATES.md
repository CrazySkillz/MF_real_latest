# Google Sheets Test Templates

Copy these templates into Google Sheets to test different mapping scenarios.

---

## Template 1: Standard Format (Perfect Match)
**Use Case:** Ideal scenario with standard column names

**Sheet Name:** `Standard_Revenue_Data`

| Campaign Name          | Revenue  | Date       |
|------------------------|----------|------------|
| Q4 Product Launch      | 5000.00  | 2024-01-15 |
| Brand Awareness 2024   | 3200.50  | 2024-01-16 |
| Lead Gen Campaign     | 7800.00  | 2024-01-17 |
| Holiday Promo 2024    | 12000.00 | 2024-01-18 |
| Summer Sale Campaign  | 6500.75  | 2024-01-19 |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (100%)
- ✅ Date → Date (100%)

**Test:** Should auto-map perfectly, no manual adjustments needed.

---

## Template 2: CRM Format (Non-Standard Names)
**Use Case:** Real-world CRM export with alternative column names

**Sheet Name:** `CRM_Deal_Data`

| Ad Campaign            | Deal Value | Close Date  | Sales Rep    |
|------------------------|------------|--------------|--------------|
| Q4 Product Launch      | 5000.00    | 2024-01-15   | John Smith   |
| Brand Awareness 2024   | 3200.50    | 2024-01-16   | Jane Doe     |
| Lead Gen Campaign      | 7800.00    | 2024-01-17   | Bob Johnson   |
| Holiday Promo 2024    | 12000.00   | 2024-01-18   | Alice Brown   |
| Summer Sale Campaign  | 6500.75    | 2024-01-19   | Charlie Wilson|

**Expected Auto-Mapping:**
- ⚠️ Ad Campaign → Campaign Name (85% - needs review)
- ✅ Deal Value → Revenue (90% - should work)
- ⚠️ Close Date → Date (80% - needs review)

**Test:** Auto-mapping should attempt matches, user may need to confirm.

---

## Template 3: Sales Format (Formatted Data)
**Use Case:** Sales data with currency formatting and mixed date formats

**Sheet Name:** `Sales_Revenue_Data`

| Campaign Name          | Revenue      | Date         |
|------------------------|--------------|--------------|
| Q4 Product Launch      | $5,000.00    | Jan 15, 2024 |
| Brand Awareness 2024   | $3,200.50    | 2024-01-16   |
| Lead Gen Campaign      | $7,800.00    | Jan 17, 2024 |
| Holiday Promo 2024    | $12,000.00   | 2024-01-18   |
| Summer Sale Campaign  | $6,500.75    | Jan 19, 2024 |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (95% - formatted but should work)
- ⚠️ Date → Date (90% - mixed formats, should normalize)

**Test:** System should handle formatted currency and normalize dates.

---

## Template 4: Minimal Data (Missing Optional Fields)
**Use Case:** Sheet with only essential columns

**Sheet Name:** `Minimal_Revenue_Data`

| Campaign Name          | Revenue  |
|------------------------|----------|
| Q4 Product Launch      | 5000.00  |
| Brand Awareness 2024   | 3200.50  |
| Lead Gen Campaign      | 7800.00  |
| Holiday Promo 2024    | 12000.00 |
| Summer Sale Campaign  | 6500.75  |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (100%)
- ⚠️ Date → Not available (optional, should be fine)

**Test:** Should work without Date column, but time-based matching won't work.

---

## Template 5: Ambiguous Columns (Multiple Matches)
**Use Case:** Multiple columns that could match Revenue field

**Sheet Name:** `Ambiguous_Columns`

| Campaign Name          | Value      | Amount      | Total      | Revenue    |
|------------------------|------------|-------------|------------|------------|
| Q4 Product Launch      | 5000.00    | 5000.00     | 5000.00    | 5000.00    |
| Brand Awareness 2024   | 3200.50    | 3200.50     | 3200.50    | 3200.50    |
| Lead Gen Campaign      | 7800.00    | 7800.00     | 7800.00    | 7800.00    |
| Holiday Promo 2024    | 12000.00   | 12000.00    | 12000.00   | 12000.00   |
| Summer Sale Campaign  | 6500.75    | 6500.75     | 6500.75    | 6500.75    |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ⚠️ Revenue → Revenue (100% - exact match, should be selected)
- ⚠️ Value/Amount/Total → May be suggested as alternatives

**Test:** System should pick "Revenue" column, but user can verify.

---

## Template 6: Incomplete Data (Empty Cells)
**Use Case:** Real-world data with missing values

**Sheet Name:** `Incomplete_Data`

| Campaign Name          | Revenue  | Date       |
|------------------------|----------|------------|
| Q4 Product Launch      | 5000.00  | 2024-01-15 |
| Brand Awareness 2024   |          | 2024-01-16 |
| Lead Gen Campaign      | 7800.00  |            |
| Holiday Promo 2024    | 12000.00 | 2024-01-18 |
| Summer Sale Campaign  |          | 2024-01-19 |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (100% - but some cells empty)
- ✅ Date → Date (100% - but some cells empty)

**Test:** System should handle empty cells gracefully, process available data.

---

## Template 7: Campaign Name Variations (Fuzzy Matching)
**Use Case:** Campaign names that don't exactly match LinkedIn

**Sheet Name:** `Name_Variations`

| Campaign Name                    | Revenue  | Date       |
|----------------------------------|----------|------------|
| Q4 Product Launch Campaign       | 5000.00  | 2024-01-15 |
| Brand Awareness Campaign 2024    | 3200.50  | 2024-01-16 |
| Lead Generation Campaign         | 7800.00  | 2024-01-17 |
| Holiday Promotion 2024          | 12000.00 | 2024-01-18 |
| Summer Sale Campaign 2024        | 6500.75  | 2024-01-19 |

**LinkedIn Campaign Names:**
- "Q4 Product Launch"
- "Brand Awareness 2024"
- "Lead Gen Campaign"
- "Holiday Promo 2024"
- "Summer Sale Campaign"

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (100%)
- ✅ Date → Date (100%)

**Test:** Fuzzy matching should match "Q4 Product Launch Campaign" to "Q4 Product Launch".

---

## Template 8: Multiple Metrics (Extended Data)
**Use Case:** Sheet with additional metrics beyond Revenue

**Sheet Name:** `Extended_Metrics`

| Campaign Name          | Revenue  | Conversions | Leads | Date       |
|------------------------|----------|-------------|--------|------------|
| Q4 Product Launch      | 5000.00  | 25          | 50    | 2024-01-15 |
| Brand Awareness 2024   | 3200.50  | 16          | 32    | 2024-01-16 |
| Lead Gen Campaign      | 7800.00  | 39          | 78    | 2024-01-17 |
| Holiday Promo 2024    | 12000.00 | 60          | 120   | 2024-01-18 |
| Summer Sale Campaign  | 6500.75  | 33          | 65    | 2024-01-19 |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ✅ Revenue → Revenue (100%)
- ⚠️ Conversions → Conversions (optional, may override LinkedIn API)
- ⚠️ Leads → Not mapped (not a standard field)
- ✅ Date → Date (100%)

**Test:** System should map standard fields, ignore non-standard ones.

---

## Template 9: Wrong Data Types (Edge Case)
**Use Case:** Data that looks correct but has type issues

**Sheet Name:** `Type_Issues`

| Campaign Name          | Revenue      | Date         |
|------------------------|--------------|--------------|
| Q4 Product Launch      | 5000         | 2024-01-15   |
| Brand Awareness 2024   | $3,200.50    | Jan 16, 2024 |
| Lead Gen Campaign      | "7800.00"    | 2024-01-17   |
| Holiday Promo 2024    | 12000        | 2024-01-18   |
| Summer Sale Campaign  | N/A          | 2024-01-19   |

**Expected Auto-Mapping:**
- ✅ Campaign Name → Campaign Name (100%)
- ⚠️ Revenue → Revenue (90% - mixed formats, should normalize)
- ⚠️ Date → Date (85% - mixed formats)

**Test:** System should detect types and transform data correctly.

---

## Template 10: Very Long Names (Edge Case)
**Use Case:** Extremely long campaign names and column names

**Sheet Name:** `Long_Names`

| This is a very long campaign name that might cause issues with matching | This is a very long revenue column name that might cause issues | Date       |
|--------------------------------------------------------------------------|----------------------------------------------------------------|------------|
| Q4 Product Launch Campaign for New Product Line 2024                    | 5000.00                                                        | 2024-01-15 |
| Brand Awareness Campaign for Target Audience 2024                        | 3200.50                                                        | 2024-01-16 |
| Lead Generation Campaign for B2B Sales Team 2024                         | 7800.00                                                        | 2024-01-17 |

**Expected Auto-Mapping:**
- ⚠️ Long Campaign Name → Campaign Name (70% - partial match)
- ⚠️ Long Revenue Name → Revenue (75% - partial match)
- ✅ Date → Date (100%)

**Test:** System should handle long names, may need manual adjustment.

---

## Quick Setup Instructions

### Method 1: Manual Entry
1. Open Google Sheets
2. Create a new spreadsheet
3. Copy the table data from a template above
4. Paste into the sheet
5. Name the sheet according to template
6. Share with your Google account
7. Connect via the app

### Method 2: CSV Import
1. Copy the table data from a template
2. Paste into a text editor
3. Save as CSV file
4. Import into Google Sheets
5. Connect via the app

### Method 3: Direct Copy-Paste
1. Select the entire table from a template
2. Copy (Ctrl+C / Cmd+C)
3. Open Google Sheets
4. Click cell A1
5. Paste (Ctrl+V / Cmd+V)
6. Google Sheets should auto-format the table

---

## Testing Workflow

### Step 1: Create Test Sheets
1. Create 3-5 different templates from above
2. Use realistic campaign names that match your LinkedIn campaigns
3. Add 5-10 rows of sample data

### Step 2: Connect Sheets
1. Go to LinkedIn campaign → "Upload Additional Data"
2. Connect each test sheet
3. Click "Next" after each connection

### Step 3: Test Mapping
1. Click "Map" on each dataset
2. Observe auto-mapping results
3. Test manual adjustments
4. Save mappings

### Step 4: Verify Results
1. Check conversion value calculation
2. Verify data appears in analytics
3. Test with different scenarios

### Step 5: Test Edge Cases
1. Try templates with missing data
2. Test ambiguous column names
3. Verify fuzzy matching works
4. Check error handling

---

## Expected Results Summary

| Template | Auto-Map Success | Manual Adjust Needed | Conversion Value |
|----------|------------------|----------------------|-------------------|
| Template 1 (Standard) | ✅ 100% | ❌ No | ✅ Yes |
| Template 2 (CRM) | ⚠️ 85% | ✅ Yes | ✅ Yes |
| Template 3 (Formatted) | ⚠️ 90% | ⚠️ Maybe | ✅ Yes |
| Template 4 (Minimal) | ✅ 100% | ❌ No | ✅ Yes |
| Template 5 (Ambiguous) | ⚠️ 80% | ✅ Yes | ✅ Yes |
| Template 6 (Incomplete) | ✅ 100% | ❌ No | ⚠️ Partial |
| Template 7 (Variations) | ✅ 100% | ❌ No | ✅ Yes |
| Template 8 (Extended) | ✅ 95% | ⚠️ Maybe | ✅ Yes |
| Template 9 (Type Issues) | ⚠️ 85% | ✅ Yes | ⚠️ Maybe |
| Template 10 (Long Names) | ⚠️ 70% | ✅ Yes | ✅ Yes |

---

## Tips for Testing

1. **Start Simple**: Begin with Template 1 (Standard) to verify basic functionality
2. **Progress Gradually**: Move to more complex templates as you verify each works
3. **Test Edge Cases**: Use Templates 6, 9, 10 to test error handling
4. **Verify Matching**: Ensure campaign names match between sheets and LinkedIn
5. **Check Calculations**: Verify conversion value = Revenue ÷ LinkedIn Conversions
6. **Test Multiple Sheets**: Connect 2-3 different templates to test aggregation
7. **Document Issues**: Note any unexpected behaviors for debugging

---

## Common Issues & Solutions

### Issue: Auto-mapping not working
**Solution:** Check column names match aliases in field definitions. Try manual mapping.

### Issue: Conversion value not calculating
**Solution:** Ensure Revenue is mapped and LinkedIn has conversions data.

### Issue: Campaign names not matching
**Solution:** Verify exact names match or use fuzzy matching. Check for extra spaces/characters.

### Issue: Data type errors
**Solution:** Check data formats. System should normalize, but verify transformations work.

### Issue: Multiple sheets not aggregating
**Solution:** Ensure campaign names are consistent across sheets. Check primary sheet setting.

