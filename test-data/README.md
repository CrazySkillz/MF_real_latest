# Test Data CSV Files

This directory contains CSV files for testing the Google Sheets mapping feature.

## Quick Start

1. **Import into Google Sheets:**
   - Open Google Sheets
   - File → Import → Upload
   - Select a CSV file
   - Choose "Replace spreadsheet" or "Insert new sheet"
   - Click "Import data"

2. **Or Create New Sheet:**
   - Create new Google Sheet
   - File → Import → Upload
   - Select CSV file
   - Import

3. **Connect via App:**
   - Go to LinkedIn campaign
   - Click "Upload Additional Data"
   - Connect Google Sheets
   - Select the imported sheet

## Test Files

### 01_Standard_Format.csv
- **Purpose:** Perfect match scenario
- **Columns:** Campaign Name, Revenue, Date
- **Expected:** 100% auto-mapping success
- **Use Case:** Baseline test

### 02_CRM_Format.csv
- **Purpose:** Non-standard column names
- **Columns:** Ad Campaign, Deal Value, Close Date, Sales Rep
- **Expected:** 85% auto-mapping, needs review
- **Use Case:** Real-world CRM export

### 03_Sales_Format.csv
- **Purpose:** Formatted currency and dates
- **Columns:** Campaign Name, Revenue ($5,000.00), Date (mixed formats)
- **Expected:** 90% auto-mapping, should normalize
- **Use Case:** Sales data with formatting

### 04_Minimal_Data.csv
- **Purpose:** Only essential columns
- **Columns:** Campaign Name, Revenue
- **Expected:** 100% auto-mapping, no Date
- **Use Case:** Minimal viable data

### 05_Ambiguous_Columns.csv
- **Purpose:** Multiple columns that could match
- **Columns:** Campaign Name, Value, Amount, Total, Revenue
- **Expected:** 80% auto-mapping, user should verify
- **Use Case:** Testing column selection logic

### 06_Incomplete_Data.csv
- **Purpose:** Missing values
- **Columns:** Campaign Name, Revenue, Date (some empty)
- **Expected:** 100% mapping, but handles empty cells
- **Use Case:** Real-world incomplete data

### 07_Name_Variations.csv
- **Purpose:** Campaign name variations
- **Columns:** Campaign Name (variations), Revenue, Date
- **Expected:** 100% mapping, fuzzy matching for names
- **Use Case:** Testing campaign name matching

## Testing Order

1. **Start with:** `01_Standard_Format.csv` (baseline)
2. **Then test:** `02_CRM_Format.csv` (real-world)
3. **Verify:** `03_Sales_Format.csv` (formatting)
4. **Edge cases:** `05_Ambiguous_Columns.csv`, `06_Incomplete_Data.csv`
5. **Advanced:** `07_Name_Variations.csv` (fuzzy matching)

## Notes

- Update campaign names to match your actual LinkedIn campaigns
- Adjust revenue values to realistic ranges
- Add more rows for comprehensive testing
- Test with multiple sheets connected simultaneously

## Customization

You can modify these CSV files to:
- Match your actual campaign names
- Use your revenue data ranges
- Add more test rows
- Create edge cases specific to your use case

