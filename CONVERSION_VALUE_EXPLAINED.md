# Conversion Value Explained - What It Means and How It Works

## What is Conversion Value?

**Conversion Value = Revenue Per Conversion**

It represents the dollar amount you earn from each conversion. This can be:
- **The price of an item** (if selling a single product)
- **Average Order Value** (if selling multiple products)
- **Average Deal Value** (B2B/SaaS)
- **Average Value Per Lead** (lead generation)

---

## Examples by Business Type

### Single Product E-commerce
- **Conversion Value:** Price of the Item
- **Example:** Selling only one product at $29.99
  - Conversion Value = **$29.99** (the price of the item)

### Multi-Product E-commerce Store
- **Conversion Value:** Average Order Value (AOV)
- **Example:** If customers buy $29.99, $149.99, and $5.00 products
  - Average = ($29.99 + $149.99 + $5.00) / 3 = **$61.66**
  - Conversion Value = **$61.66** (average revenue per order)

### B2B/SaaS
- **Conversion Value:** Average Deal Value
- **Example:** If deals are $500, $1,000, and $2,000
  - Average = ($500 + $1,000 + $2,000) / 3 = **$1,166.67**
  - Conversion Value = **$1,166.67** (average revenue per deal)

### Lead Generation
- **Conversion Value:** Average Value Per Lead
- **Example:** If leads convert to sales worth $50, $100, and $150
  - Average = ($50 + $100 + $150) / 3 = **$100**
  - Conversion Value = **$100** (average revenue per lead)

---

## Current System Logic (Before Webhook)

### How Revenue is Calculated

**Formula:**
```
Total Revenue = Number of Conversions × Conversion Value
```

**Example:**
- Conversions: 10
- Conversion Value: $50 (fixed average)
- **Total Revenue = 10 × $50 = $500**

**Problem:**
- Uses a **fixed value** for all conversions
- Not all conversions are worth $50!
- Some might be $29.99, some $149.99, some $5.00
- **Inaccurate** if actual values vary

---

## With Webhook (After Implementation)

### How Revenue is Calculated

**Formula:**
```
Total Revenue = Sum of All Actual Conversion Values
```

**Example:**
- Conversion 1: $29.99 (actual order)
- Conversion 2: $149.99 (actual order)
- Conversion 3: $5.00 (actual order)
- Conversion 4: $29.99 (actual order)
- ... (7 more conversions with actual values)

- **Total Revenue = $29.99 + $149.99 + $5.00 + $29.99 + ... = $500.00** (sum of actual values)

**Benefit:**
- Uses **actual values** for each conversion
- **Much more accurate** than using a fixed average

---

## How Conversion Value Field is Used

### In Campaign Settings

**Field Name:** "Conversion Value (optional)"

**What it stores:**
- **Before webhook:** Manual entry (e.g., $50)
- **After webhook:** Automatically calculated average from webhook events

**Purpose:**
- Fallback if no webhook events exist yet
- Reference value for quick calculations
- Automatically updated by webhook (average of last 30 days)

---

## Revenue Calculation Logic

### Current Implementation (Code Review)

**Location:** `server/utils/kpi-refresh.ts`, `server/routes-oauth.ts`

**Formula Used:**
```typescript
// Current (uses fixed conversion value)
const totalRevenue = totalConversions * conversionValue;
// Example: 10 conversions × $50 = $500

// With webhook (uses actual values)
const totalRevenue = sum(conversionEvent.values);
// Example: $29.99 + $149.99 + $5.00 + ... = $500.00
```

**Where it's used:**
1. **Total Revenue** = Conversions × Conversion Value (or sum of webhook events)
2. **ROAS** = Revenue / Ad Spend
3. **ROI** = (Revenue - Cost) / Cost × 100
4. **Profit** = Revenue - Ad Spend
5. **Profit Margin** = (Profit / Revenue) × 100

---

## Real-World Example

### Scenario: E-commerce Store

**Products:**
- Product A: $29.99
- Product B: $149.99
- Product C: $5.00

**Sales:**
- Day 1: Customer buys Product A ($29.99)
- Day 2: Customer buys Product B ($149.99)
- Day 3: Customer buys Product C ($5.00)
- Day 4: Customer buys Product A ($29.99)
- Day 5: Customer buys Product B ($149.99)

**Total Conversions:** 5

---

### Before Webhook (Manual Conversion Value)

**Campaign Settings:**
- Conversion Value: $50 (manually entered average)

**Revenue Calculation:**
```
Total Revenue = 5 conversions × $50 = $250
```

**Actual Revenue:** $29.99 + $149.99 + $5.00 + $29.99 + $149.99 = **$364.96**

**Error:** $250 vs $364.96 = **-31.5% inaccurate!**

---

### After Webhook (Automatic Actual Values)

**Webhook Events:**
- Event 1: $29.99
- Event 2: $149.99
- Event 3: $5.00
- Event 4: $29.99
- Event 5: $149.99

**Campaign Settings (Auto-updated):**
- Conversion Value: $72.99 (automatically calculated average)

**Revenue Calculation:**
```
Total Revenue = $29.99 + $149.99 + $5.00 + $29.99 + $149.99 = $364.96
```

**Actual Revenue:** $364.96

**Accuracy:** **100% accurate!**

---

## How It Applies to Campaign Revenue Metrics

### 1. Total Revenue
```
Before: Total Revenue = Conversions × Fixed Conversion Value
After:  Total Revenue = Sum of All Webhook Event Values
```

### 2. ROAS (Return on Ad Spend)
```
Before: ROAS = (Conversions × Fixed Value) / Ad Spend
After:  ROAS = (Sum of Webhook Values) / Ad Spend
```

### 3. ROI (Return on Investment)
```
Before: ROI = ((Conversions × Fixed Value) - Cost) / Cost × 100
After:  ROI = ((Sum of Webhook Values) - Cost) / Cost × 100
```

### 4. Profit
```
Before: Profit = (Conversions × Fixed Value) - Ad Spend
After:  Profit = (Sum of Webhook Values) - Ad Spend
```

### 5. Profit Margin
```
Before: Profit Margin = ((Conversions × Fixed Value) - Ad Spend) / (Conversions × Fixed Value) × 100
After:  Profit Margin = ((Sum of Webhook Values) - Ad Spend) / (Sum of Webhook Values) × 100
```

---

## Key Differences

| Aspect | Before Webhook | After Webhook |
|--------|---------------|--------------|
| **Conversion Value** | Fixed (e.g., $50) | Variable (actual values) |
| **Revenue Calculation** | Conversions × $50 | Sum of actual values |
| **Accuracy** | Inaccurate if values vary | 100% accurate |
| **Manual Work** | Update conversion count manually | Fully automated |
| **Example** | 10 × $50 = $500 | $29.99 + $149.99 + ... = $500 |

---

## Summary

### Conversion Value Definition:
- **IS** the revenue per conversion
- **CAN BE** the price of an item (if selling a single product)
- **CAN BE** the average revenue per conversion (if selling multiple products or services)
- Examples: Item Price, Average Order Value, Average Deal Value, Average Lead Value

### How It's Used:
1. **Campaign Settings Field:** Stores average (manual or auto-calculated)
2. **Revenue Calculations:** Uses actual values from webhook events (if available)
3. **Fallback:** Uses fixed conversion value if no webhook events exist

### The Webhook Advantage:
- Sends **actual values** for each conversion (not averages)
- Makes revenue calculations **100% accurate**
- **Eliminates manual work** - fully automated

### Real-World Application:
- **E-commerce:** Conversion Value = Average Order Value
- **B2B:** Conversion Value = Average Deal Value  
- **Lead Gen:** Conversion Value = Average Value Per Lead

**The webhook sends the actual dollar amount of each conversion, making revenue metrics much more accurate than using a fixed average!**

