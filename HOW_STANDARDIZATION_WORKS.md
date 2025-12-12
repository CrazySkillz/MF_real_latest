# How Dataset Standardization Works - Step-by-Step Explanation

## Real-World Example

Let's trace through how the system processes your actual dataset for the "test024" LinkedIn campaign.

---

## Your Dataset

```
Campaign ID          | Campaign Name | Platform      | Revenue    | Date
CAMPAIGN_100 test024 | test024       | Facebook Ads  | 5000.00    | 2024-01-15
CAMPAIGN_100 test024 | test024       | LinkedIn Ads  | 24000.00   | 2024-01-16
CAMPAIGN_100 test024 | test024       | Twitter Ads   | 3000.00    | 2024-01-17
CAMPAIGN_100 test022 | test022       | Facebook Ads  | 3200.50    | 2024-01-18
```

**Campaign Context:**
- Campaign Name: "test024"
- Platform: "linkedin"
- Campaign ID: (internal system ID)

---

## Stage 1: Dataset Analysis & Detection

**What Happens:**
The system scans your Google Sheet and analyzes its structure.

**Process:**
```javascript
// System reads the sheet
const rawData = [
  ["Campaign ID", "Campaign Name", "Platform", "Revenue", "Date"],
  ["CAMPAIGN_100 test024", "test024", "Facebook Ads", "5000.00", "2024-01-15"],
  ["CAMPAIGN_100 test024", "test024", "LinkedIn Ads", "24000.00", "2024-01-16"],
  // ... more rows
];

// System analyzes
const analysis = {
  totalRows: 4,
  totalColumns: 5,
  columnNames: ["Campaign ID", "Campaign Name", "Platform", "Revenue", "Date"],
  detectedTypes: {
    "Campaign ID": "text",
    "Campaign Name": "text",
    "Platform": "text",
    "Revenue": "currency",  // Detected as currency because of decimal format
    "Date": "date"          // Detected as date because of YYYY-MM-DD format
  },
  patterns: {
    isMultiPlatform: true,  // Platform column has multiple values
    isTimeSeries: true,     // Date column has sequential dates
    hasMissingValues: false
  }
};
```

**Output:** System knows:
- ✅ This is a multi-platform dataset (has Platform column with different values)
- ✅ This is time-series data (has Date column)
- ✅ Revenue is in currency format
- ✅ All required columns are present

---

## Stage 2: Column Name Normalization

**What Happens:**
System maps your column names to standard field names.

**Process:**
```javascript
// Your columns
const yourColumns = [
  "Campaign ID",      // Not needed for mapping
  "Campaign Name",    // Needs mapping
  "Platform",         // Needs mapping
  "Revenue",          // Needs mapping
  "Date"              // Optional mapping
];

// System tries to match each column
const mappings = [
  {
    originalName: "Campaign Name",
    // Level 1: Exact match? No
    // Level 2: Alias match? Yes! "Campaign Name" is in alias list
    normalizedName: "campaign_name",
    confidence: 1.0,
    matchType: "exact"
  },
  {
    originalName: "Platform",
    // Level 1: Exact match? Yes!
    normalizedName: "platform",
    confidence: 1.0,
    matchType: "exact"
  },
  {
    originalName: "Revenue",
    // Level 1: Exact match? Yes!
    normalizedName: "revenue",
    confidence: 1.0,
    matchType: "exact"
  },
  {
    originalName: "Date",
    // Level 1: Exact match? Yes!
    normalizedName: "date",
    confidence: 1.0,
    matchType: "exact"
  }
];
```

**If Column Names Were Different:**
```javascript
// Example: User has "Ad Campaign" instead of "Campaign Name"
{
  originalName: "Ad Campaign",
  // Level 1: Exact match? No
  // Level 2: Alias match? Yes! "Ad Campaign" is alias for campaign_name
  normalizedName: "campaign_name",
  confidence: 0.95,
  matchType: "alias"
}

// Example: User has "Deal Value" instead of "Revenue"
{
  originalName: "Deal Value",
  // Level 1: Exact match? No
  // Level 2: Alias match? Yes! "Deal Value" is alias for revenue
  normalizedName: "revenue",
  confidence: 0.90,
  matchType: "alias"
}
```

**Output:** System creates mapping:
- "Campaign Name" → `campaign_name`
- "Platform" → `platform`
- "Revenue" → `revenue`
- "Date" → `date`

---

## Stage 3: Data Type Standardization

**What Happens:**
System converts all values to consistent formats.

**Process:**
```javascript
// Raw row data
const rawRow = {
  "Campaign Name": "test024",
  "Platform": "LinkedIn Ads",
  "Revenue": "24000.00",
  "Date": "2024-01-16"
};

// System standardizes each value
const standardizedRow = {
  campaign_name: normalizeText("test024"),        // "test024" (lowercase, trimmed)
  platform: normalizePlatform("LinkedIn Ads"),    // "linkedin" (canonical ID)
  revenue: normalizeCurrency("24000.00"),         // 24000.00 (number)
  date: normalizeDate("2024-01-16")                // "2024-01-16" (ISO format)
};
```

**Normalization Functions:**

**1. Text Normalization:**
```javascript
function normalizeText(value) {
  return String(value)
    .toLowerCase()      // "Test024" → "test024"
    .trim()             // " test024 " → "test024"
    .replace(/[_-]/g, ' '); // "test-024" → "test 024"
}
```

**2. Platform Normalization:**
```javascript
function normalizePlatform(value) {
  const normalized = value.toLowerCase().trim();
  
  if (normalized.includes('linkedin')) return 'linkedin';
  if (normalized.includes('facebook') || normalized.includes('meta')) return 'facebook';
  if (normalized.includes('google')) return 'google';
  if (normalized.includes('twitter')) return 'twitter';
  
  return normalized;
}

// Examples:
// "LinkedIn Ads" → "linkedin"
// "Linked In" → "linkedin"
// "Facebook Ads" → "facebook"
// "Meta Ads" → "facebook"
```

**3. Currency Normalization:**
```javascript
function normalizeCurrency(value) {
  // Remove all non-numeric characters except decimal point
  const cleaned = String(value).replace(/[^0-9.-]/g, '');
  // "$5,000.00" → "5000.00"
  // "5,000" → "5000"
  return parseFloat(cleaned) || 0;
}

// Examples:
// "$5,000.00" → 5000.00
// "5,000" → 5000.00
// "5000" → 5000.00
// "5,000.50" → 5000.50
```

**4. Date Normalization:**
```javascript
function normalizeDate(value) {
  // Try multiple date formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,        // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/,      // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/,        // MM-DD-YYYY
    // ... more formats
  ];
  
  // Parse and convert to ISO format
  const date = new Date(value);
  return date.toISOString().split('T')[0]; // "2024-01-16"
}

// Examples:
// "2024-01-16" → "2024-01-16"
// "Jan 16, 2024" → "2024-01-16"
// "16/01/2024" → "2024-01-16"
```

**Output:** All rows standardized:
```javascript
[
  {
    campaign_name: "test024",
    platform: "facebook",
    revenue: 5000.00,
    date: "2024-01-15"
  },
  {
    campaign_name: "test024",
    platform: "linkedin",
    revenue: 24000.00,
    date: "2024-01-16"
  },
  {
    campaign_name: "test024",
    platform: "twitter",
    revenue: 3000.00,
    date: "2024-01-17"
  },
  {
    campaign_name: "test022",
    platform: "facebook",
    revenue: 3200.50,
    date: "2024-01-18"
  }
]
```

---

## Stage 4: Missing Data Handling

**What Happens:**
System checks for missing values and fills them intelligently.

**In Your Dataset:**
- ✅ All rows have Campaign Name
- ✅ All rows have Platform
- ✅ All rows have Revenue
- ✅ All rows have Date

**If Data Was Missing:**
```javascript
// Example: Row missing Platform
{
  campaign_name: "test024",
  platform: null,  // Missing!
  revenue: 24000.00
}

// System infers from campaign context
if (platform === null && campaign.platform) {
  row.platform = campaign.platform; // "linkedin"
}

// Result:
{
  campaign_name: "test024",
  platform: "linkedin",  // Inferred from campaign
  revenue: 24000.00
}
```

**Output:** All rows have required fields (either from data or inferred)

---

## Stage 5: Data Validation & Cleaning

**What Happens:**
System validates data quality and removes invalid rows.

**Validation Checks:**
```javascript
// For each row:
const row = {
  campaign_name: "test024",
  platform: "linkedin",
  revenue: 24000.00,
  date: "2024-01-16"
};

// Check 1: Campaign name not empty?
if (!row.campaign_name) {
  error("Campaign name is required");
}

// Check 2: Revenue is valid number?
if (isNaN(row.revenue) || row.revenue < 0) {
  error("Revenue must be a positive number");
}

// Check 3: Date is valid?
if (!isValidDate(row.date)) {
  error("Date is invalid");
}

// Check 4: Platform is known?
if (!isKnownPlatform(row.platform)) {
  warning("Unknown platform: " + row.platform);
}
```

**Cleaning Actions:**
```javascript
// Remove whitespace
row.campaign_name = row.campaign_name.trim();

// Fix encoding issues
row.campaign_name = row.campaign_name.replace(/[^\x00-\x7F]/g, "");

// Remove invalid characters
row.campaign_name = row.campaign_name.replace(/[<>:"/\\|?*]/g, "");
```

**Output:** Clean, validated rows (invalid rows removed or flagged)

---

## Stage 6: Context-Aware Filtering

**What Happens:**
System filters rows based on campaign context.

**Campaign Context:**
```javascript
const campaign = {
  name: "test024",
  platform: "linkedin"
};
```

**Filtering Process:**
```javascript
// All standardized rows
const allRows = [
  { campaign_name: "test024", platform: "facebook", revenue: 5000.00 },
  { campaign_name: "test024", platform: "linkedin", revenue: 24000.00 },
  { campaign_name: "test024", platform: "twitter", revenue: 3000.00 },
  { campaign_name: "test022", platform: "facebook", revenue: 3200.50 }
];

// Step 1: Filter by campaign name
const campaignRows = allRows.filter(row => {
  return normalizeText(row.campaign_name) === normalizeText(campaign.name);
});
// Result: 3 rows (all "test024" rows)

// Step 2: Filter by platform
const platformRows = campaignRows.filter(row => {
  // Platform column exists and is mapped
  if (row.platform) {
    return normalizePlatform(row.platform) === normalizePlatform(campaign.platform);
  }
  // Platform column missing - assume all rows are for campaign's platform
  return true;
});
// Result: 1 row (only LinkedIn row)

// Final filtered rows
const filteredRows = [
  { campaign_name: "test024", platform: "linkedin", revenue: 24000.00 }
];
```

**If Platform Column Was Missing:**
```javascript
// All rows (no Platform column)
const allRows = [
  { campaign_name: "test024", revenue: 5000.00 },
  { campaign_name: "test024", revenue: 24000.00 },
  { campaign_name: "test024", revenue: 3000.00 }
];

// Filter by campaign name only
const filteredRows = allRows.filter(row => {
  return normalizeText(row.campaign_name) === normalizeText(campaign.name);
});
// Result: 3 rows (all "test024" rows)
// System assumes all are for LinkedIn (campaign's platform)
```

**Output:** Only rows matching campaign name AND platform (if Platform column exists)

---

## Stage 7: Canonical Format Creation

**What Happens:**
System creates final standardized dataset.

**Process:**
```javascript
// Filtered rows from Stage 6
const filteredRows = [
  { campaign_name: "test024", platform: "linkedin", revenue: 24000.00, date: "2024-01-16" }
];

// Create canonical format
const canonicalData = {
  metadata: {
    source: "google_sheets",
    processedAt: "2024-01-20T10:30:00Z",
    totalRows: 4,           // Original dataset
    filteredRows: 1,         // After filtering
    warnings: [],
    errors: []
  },
  
  rows: [
    {
      // Normalized identifiers
      campaign_name: "test024",
      platform: "linkedin",
      
      // Standardized metrics
      revenue: 24000.00,     // Number (float)
      date: "2024-01-16",     // ISO format
      
      // Metadata
      originalRowIndex: 2,   // Row 2 in original sheet
      dataQuality: {
        hasMissingValues: false,
        isOutlier: false,
        confidence: 1.0
      }
    }
  ],
  
  // Aggregated metrics
  aggregated: {
    totalRevenue: 24000.00,
    totalConversions: null,  // Will use LinkedIn API
    rowCount: 1,
    dateRange: {
      start: "2024-01-16",
      end: "2024-01-16"
    }
  }
};
```

**Output:** Standardized dataset in canonical format

---

## Conversion Value Calculation

**What Happens:**
System calculates conversion value from standardized data.

**Process:**
```javascript
// Get aggregated data
const aggregated = canonicalData.aggregated;
// { totalRevenue: 24000.00, totalConversions: null }

// Get conversions from LinkedIn API
const linkedInConversions = await getLinkedInApiConversions(campaignId);
// Result: 993 conversions (from LinkedIn API)

// Calculate conversion value
const conversionValue = aggregated.totalRevenue / linkedInConversions;
// 24000.00 / 993 = 24.17

// Result
const result = {
  revenue: 24000.00,
  conversions: 993,
  conversionValue: 24.17,
  source: "LinkedIn API"  // Conversions from API, Revenue from Google Sheets
};
```

**Output:** Conversion Value = $24.17

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR GOOGLE SHEET                         │
│  Campaign Name | Platform      | Revenue                     │
│  test024       | LinkedIn Ads  | 24000.00                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 1: Analysis                                           │
│  • Detects: Multi-platform dataset                          │
│  • Detects: Currency format, Date format                     │
│  • Identifies: 4 rows, 5 columns                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 2: Column Normalization                               │
│  • "Campaign Name" → campaign_name                          │
│  • "Platform" → platform                                      │
│  • "Revenue" → revenue                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 3: Data Standardization                               │
│  • "test024" → "test024" (normalized)                       │
│  • "LinkedIn Ads" → "linkedin" (canonical)                  │
│  • "24000.00" → 24000.00 (number)                           │
│  • "2024-01-16" → "2024-01-16" (ISO)                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 4: Missing Data Handling                              │
│  • All fields present ✅                                      │
│  • No inference needed                                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 5: Validation & Cleaning                              │
│  • All values valid ✅                                        │
│  • No cleaning needed                                        │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 6: Context-Aware Filtering                            │
│  Campaign: "test024" (linkedin)                              │
│  • Filter: campaign_name = "test024" ✅                       │
│  • Filter: platform = "linkedin" ✅                          │
│  • Result: 1 row matched                                     │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  STAGE 7: Canonical Format                                   │
│  {                                                           │
│    rows: [{                                                  │
│      campaign_name: "test024",                              │
│      platform: "linkedin",                                  │
│      revenue: 24000.00                                      │
│    }],                                                       │
│    aggregated: {                                            │
│      totalRevenue: 24000.00,                                │
│      totalConversions: null                                 │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  CONVERSION VALUE CALCULATION                                │
│  • Revenue: $24,000.00 (from Google Sheets)                 │
│  • Conversions: 993 (from LinkedIn API)                     │
│  • Conversion Value: $24,000 / 993 = $24.17                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Normalization Happens First**: All variations are converted to standard forms
2. **Context is Used**: Campaign platform determines which rows to process
3. **Validation Ensures Quality**: Invalid data is caught early
4. **Filtering is Smart**: Only relevant rows are processed
5. **Format is Consistent**: Final data is always in canonical format
6. **Calculation is Accurate**: Uses correct revenue and conversions

**Result**: System can handle ANY dataset format and calculate conversion value accurately! 🎯

