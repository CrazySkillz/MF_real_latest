# Webhook Testing - Simple Explanation

## What is a Webhook?

A **webhook** is like a phone number that external systems (like your e-commerce store, CRM, or payment processor) can "call" to tell MetricMind when a conversion happens and what it's worth.

## Real-Life Scenario

### Without Webhook (Manual):
1. Customer buys a $149.99 product on your Shopify store
2. You manually go to MetricMind
3. You enter "149.99" as the conversion value
4. ❌ **Problem**: You have to do this manually for every sale

### With Webhook (Automated):
1. Customer buys a $149.99 product on your Shopify store
2. Shopify **automatically** sends a message to MetricMind's webhook URL
3. The message says: "Conversion happened! Value: $149.99"
4. MetricMind automatically records it
5. ✅ **Benefit**: No manual work, always accurate, real-time

## How It Works

### Step 1: Get Your Webhook URL
- Each campaign has a unique webhook URL
- Example: `https://your-domain.com/api/webhook/conversion/campaign-123`
- This is like your "address" where external systems send conversion data

### Step 2: Give URL to External System
- **Shopify**: Add webhook URL in Shopify settings
- **WooCommerce**: Install plugin that sends to webhook URL
- **Stripe**: Configure webhook to send to this URL
- **Zapier**: Connect your e-commerce to this webhook URL

### Step 3: External System Sends Data
When a conversion happens, the external system sends:
```json
{
  "value": 149.99,
  "currency": "USD",
  "conversionId": "order-12345",
  "conversionType": "purchase"
}
```

### Step 4: MetricMind Receives and Stores
- MetricMind receives the data
- Stores the conversion event
- Updates revenue calculations automatically

## What the UI Tester Does

The **Webhook Tester** in the UI **simulates** what an external system would do:

1. **You manually enter** conversion data (like Shopify would automatically)
2. **You click "Send"** (like Shopify would automatically send)
3. **MetricMind receives it** (same as if Shopify sent it)
4. **You see the result** (to verify it worked)

**It's like testing a phone call before giving out your phone number!**

## Why Copy the Webhook URL?

You copy the webhook URL to:
1. **Give it to external systems** (Shopify, WooCommerce, Stripe, etc.)
2. **Configure integrations** (Zapier, Make.com, custom code)
3. **Share with developers** (if building custom integrations)

**You don't use the URL in the UI tester** - the UI tester is just for testing!

## How Conversion Value Works

### Before Webhook (Fixed Value):
- You set: "Each conversion = $50"
- Problem: Not all conversions are worth $50!
- Some are $29.99, some are $149.99, some are $5.00

### With Webhook (Actual Values):
- Conversion 1: $29.99 (actual order value)
- Conversion 2: $149.99 (actual order value)
- Conversion 3: $5.00 (actual order value)
- MetricMind calculates: Total Revenue = $184.98
- MetricMind calculates: Average = $61.66

**Much more accurate!**

## Testing Process

### Option 1: Use UI Tester (What You're Doing Now)
1. Go to Campaign → Webhooks tab
2. Enter conversion value (e.g., 149.99)
3. Click "Send Test Webhook"
4. See if it worked
5. ✅ **Purpose**: Verify the webhook works before connecting real systems

### Option 2: Use External Tool (More Realistic)
1. Copy the webhook URL
2. Use a tool like Postman, curl, or Zapier
3. Send a POST request to the URL
4. ✅ **Purpose**: Test like a real external system would

### Option 3: Connect Real System (Production)
1. Copy the webhook URL
2. Configure Shopify/WooCommerce/Stripe to send to this URL
3. Real conversions automatically flow in
4. ✅ **Purpose**: Actual production use

## Example: Shopify Integration

1. **Copy webhook URL** from MetricMind
2. **Go to Shopify** → Settings → Notifications → Webhooks
3. **Create webhook**:
   - Event: Order creation
   - URL: (paste your MetricMind webhook URL)
   - Format: JSON
4. **When customer buys**:
   - Shopify automatically sends: `{"value": 149.99, "orderId": "123"}`
   - MetricMind receives it automatically
   - Revenue is calculated automatically
   - ✅ **No manual work!**

## Summary

- **Webhook URL** = Address where external systems send conversion data
- **UI Tester** = Simulates what external systems do (for testing)
- **Conversion Value** = Actual dollar amount of each conversion
- **Purpose** = Automate conversion value tracking (no manual entry)

The UI tester is just a **testing tool** - in production, external systems use the webhook URL automatically!

