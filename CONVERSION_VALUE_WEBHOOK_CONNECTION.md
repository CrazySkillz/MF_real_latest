# How Webhook Relates to Conversion Value

## The Connection Explained Simply

### Current System (Manual Conversion Value)

**In Campaign Settings:**
- You see a field: **"Conversion Value"**
- You enter: **$50** (a fixed number)
- This means: "Every conversion is worth $50"

**Revenue Calculation:**
```
Total Revenue = Number of Conversions × $50
Example: 10 conversions × $50 = $500 revenue
```

**Problem:**
- Not all conversions are worth $50!
- Some orders are $29.99
- Some orders are $149.99
- Some orders are $5.00
- Using $50 for all is inaccurate

---

### With Webhook (Actual Conversion Values)

**What Webhook Does:**
- Sends the **actual value** of each conversion
- Conversion 1: $29.99 (actual order)
- Conversion 2: $149.99 (actual order)
- Conversion 3: $5.00 (actual order)

**Revenue Calculation:**
```
Total Revenue = Sum of all actual conversion values
Example: $29.99 + $149.99 + $5.00 = $184.98 revenue
```

**Much More Accurate!**

---

## How They Connect

### Step 1: You Set Initial Conversion Value (Optional)
- In Campaign Settings → "Conversion Value" field
- Enter: $50 (or leave empty)
- This is used as a **fallback** if no webhook events exist yet

### Step 2: Webhook Sends Actual Values
- External system (Shopify, etc.) sends conversion events
- Each event has the **actual order value**
- Example: `{"value": 149.99}`

### Step 3: System Automatically Updates
- MetricMind receives webhook events
- Calculates **average conversion value** from recent events (last 30 days)
- **Automatically updates** the campaign's "Conversion Value" field
- Example: If events are $29.99, $149.99, $5.00 → Average = $61.66

### Step 4: Revenue Uses Actual Values
- Revenue calculations use **actual event values** (not the average)
- More accurate than using a fixed $50

---

## Visual Example

### Before Webhook (Manual):
```
Campaign Settings:
┌─────────────────────────┐
│ Conversion Value: $50   │ ← You manually enter this
└─────────────────────────┘

Revenue Calculation:
10 conversions × $50 = $500
(But actual orders were: $29.99, $149.99, $5.00, etc.)
❌ Inaccurate!
```

### After Webhook (Automatic):
```
Webhook Events:
┌─────────────────────────┐
│ Event 1: $29.99        │ ← Actual order value
│ Event 2: $149.99       │ ← Actual order value
│ Event 3: $5.00         │ ← Actual order value
└─────────────────────────┘
         ↓
Campaign Settings (Auto-updated):
┌─────────────────────────┐
│ Conversion Value: $61.66│ ← Automatically calculated average
└─────────────────────────┘

Revenue Calculation:
$29.99 + $149.99 + $5.00 = $184.98
✅ Accurate!
```

---

## Where You See This

### 1. Campaign Settings Page
- Field: **"Conversion Value (optional)"**
- **Before webhook:** You manually enter a value
- **After webhook:** This field is automatically updated with the average

### 2. Revenue Calculations
- **ROI, ROAS, Total Revenue** metrics
- **Before webhook:** Uses fixed conversion value
- **After webhook:** Uses actual conversion event values

### 3. LinkedIn Analytics
- Revenue metrics (Total Revenue, ROAS, ROI, Profit)
- **Before webhook:** Uses fixed conversion value
- **After webhook:** Uses actual conversion event values

---

## How to Test the Connection

### Test 1: Send Webhook Event
1. Go to Campaign → Webhooks tab
2. Enter value: **149.99**
3. Click "Send Test Webhook"

### Test 2: Check Campaign Settings
1. Go to Campaign Settings
2. Look at "Conversion Value" field
3. It should show the average of recent events (or your manual value if no events)

### Test 3: Check Revenue Metrics
1. Go to LinkedIn Analytics → Overview
2. Look at "Total Revenue"
3. It should use actual webhook event values (not the fixed conversion value)

---

## Summary

**Conversion Value Field:**
- Manual entry (optional)
- Used as fallback if no webhook events
- Automatically updated by webhook (average of recent events)

**Webhook Events:**
- Send actual conversion values
- More accurate than fixed value
- Used for revenue calculations

**The Connection:**
- Webhook events → Calculate average → Update Conversion Value field
- Revenue calculations use actual event values (not the average)
- Best of both worlds: Manual fallback + Automatic accuracy

---

## Code Connection

In `server/routes.ts` (webhook endpoint):
```typescript
// After receiving webhook event:
// 1. Store the event with actual value
const event = await storage.createConversionEvent({
  value: "149.99",  // Actual order value
  ...
});

// 2. Calculate average from recent events
const recentEvents = await storage.getConversionEvents(campaignId, thirtyDaysAgo);
const avgValue = (totalValue / recentEvents.length).toFixed(2);

// 3. Update campaign's conversionValue field
await storage.updateCampaign(campaignId, {
  conversionValue: avgValue  // Auto-update the field you see in UI
});
```

This is how the webhook **automatically updates** the conversion value field you see in campaign settings!

