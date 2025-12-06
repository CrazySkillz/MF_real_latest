# Webhook Production Workflow for Marketing Executives

## The Key Point

**Marketing executives don't directly use the webhook.** Instead, they (or their technical team) configure external systems **once**, and then conversion values are automatically sent to MetricMind forever. No manual work needed!

---

## Production Workflow (Step-by-Step)

### Step 1: Get Your Webhook URL (One-Time Setup)

**Who does this:** Marketing Executive or IT Team  
**When:** Once, when setting up the campaign

1. Go to Campaign → Webhooks tab
2. Copy the webhook URL (e.g., `https://your-domain.com/api/webhook/conversion/campaign-123`)
3. Save this URL somewhere safe (you'll need it for Step 2)

**Time:** 30 seconds

---

### Step 2: Configure External System (One-Time Setup)

**Who does this:** IT Team or Marketing Executive (depending on system)  
**When:** Once, when connecting the external system

#### Option A: Shopify (E-commerce)

1. Go to Shopify Admin → Settings → Notifications → Webhooks
2. Click "Create webhook"
3. **Event:** Order creation
4. **Format:** JSON
5. **URL:** Paste your MetricMind webhook URL
6. Click "Save webhook"

**Result:** Every time a customer buys something, Shopify automatically sends the order value to MetricMind.

**Time:** 2 minutes

#### Option B: WooCommerce (WordPress)

1. Install a webhook plugin (or use built-in webhooks)
2. Go to WooCommerce → Settings → Advanced → Webhooks
3. Click "Add webhook"
4. **Topic:** Order created
5. **Delivery URL:** Paste your MetricMind webhook URL
6. Click "Save webhook"

**Result:** Every time a customer buys something, WooCommerce automatically sends the order value to MetricMind.

**Time:** 5 minutes

#### Option C: Stripe (Payment Processor)

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Endpoint URL:** Paste your MetricMind webhook URL
4. **Events to send:** Select `checkout.session.completed` or `payment_intent.succeeded`
5. Click "Add endpoint"

**Result:** Every time a payment succeeds, Stripe automatically sends the payment amount to MetricMind.

**Time:** 3 minutes

#### Option D: Zapier / Make.com (No-Code Automation)

1. Create a new Zap/Make scenario
2. **Trigger:** Your e-commerce platform (Shopify, WooCommerce, etc.)
3. **Action:** Webhook (POST)
4. **URL:** Paste your MetricMind webhook URL
5. **Method:** POST
6. **Body:** Map order data to webhook format:
   ```json
   {
     "value": {{Order Total}},
     "currency": "USD",
     "conversionId": "{{Order Number}}",
     "conversionType": "purchase"
   }
   ```
7. Activate the Zap/Make scenario

**Result:** Every time an order is created, Zapier/Make automatically sends it to MetricMind.

**Time:** 10 minutes

---

### Step 3: That's It! (Fully Automated Forever)

**After Step 2, everything is automatic:**

✅ Customer buys $149.99 product → External system sends to MetricMind automatically  
✅ Customer buys $29.99 product → External system sends to MetricMind automatically  
✅ Customer buys $5.00 product → External system sends to MetricMind automatically  

**Marketing executives:**
- ✅ **No manual data entry needed**
- ✅ **No updating conversion values**
- ✅ **No remembering to record each sale**
- ✅ **Just check MetricMind dashboard for accurate revenue metrics**

---

## Before vs. After

### Before Webhook (Manual Process):

**Every time a sale happens:**
1. Marketing executive opens MetricMind
2. Goes to Campaign Settings
3. Updates conversion count manually
4. Uses fixed conversion value (e.g., $50)
5. Revenue = Conversions × $50 (inaccurate!)

**Problems:**
- ❌ Time-consuming
- ❌ Easy to forget
- ❌ Inaccurate (uses fixed value, not actual order values)
- ❌ Doesn't scale

### After Webhook (Automated Process):

**Every time a sale happens:**
1. External system (Shopify, etc.) automatically sends conversion event
2. MetricMind automatically records it with actual value
3. Revenue calculations use actual values automatically

**Benefits:**
- ✅ Zero manual work
- ✅ Always accurate (uses actual order values)
- ✅ Real-time updates
- ✅ Scales infinitely

---

## Real-World Example

### Scenario: E-commerce Store with Shopify

**Day 1 (Setup - 5 minutes):**
1. Marketing executive copies webhook URL from MetricMind
2. IT team configures Shopify webhook (2 minutes)
3. Done!

**Day 2-365 (Fully Automated):**
- Customer buys $149.99 product → Shopify sends automatically → MetricMind records $149.99
- Customer buys $29.99 product → Shopify sends automatically → MetricMind records $29.99
- Customer buys $5.00 product → Shopify sends automatically → MetricMind records $5.00

**Marketing executive:**
- Opens MetricMind dashboard
- Sees accurate revenue: $184.98 (sum of actual values)
- Sees accurate ROAS, ROI, Profit
- **No manual work at all!**

---

## What Marketing Executives Actually Do

### Initial Setup (Once):
1. ✅ Get webhook URL from MetricMind
2. ✅ Give it to IT team (or configure themselves if using Zapier)
3. ✅ IT team configures external system (Shopify, WooCommerce, etc.)

### Ongoing Use (Daily):
1. ✅ Open MetricMind dashboard
2. ✅ View accurate revenue metrics
3. ✅ Make data-driven decisions
4. ✅ **That's it! No manual data entry needed**

---

## Common Questions

### Q: Do I need to be technical to use this?
**A:** No! You just need to:
- Copy the webhook URL (anyone can do this)
- Give it to your IT team or use Zapier (no-code solution)

### Q: What if I don't have an IT team?
**A:** Use Zapier or Make.com - they're no-code tools that anyone can use. Just connect your e-commerce platform to MetricMind's webhook URL.

### Q: Do I still need to manually enter conversion values?
**A:** **No!** Once configured, the webhook sends conversion values automatically. You can still manually enter a conversion value in Campaign Settings as a fallback, but it's not needed if webhooks are working.

### Q: What if my e-commerce platform isn't listed?
**A:** Most platforms support webhooks. Check your platform's documentation for "webhooks" or "API integrations". You can also use Zapier/Make.com to connect any platform to MetricMind.

### Q: How do I know if it's working?
**A:** 
1. Make a test purchase on your store
2. Check MetricMind → Campaign → Webhooks tab
3. You should see the conversion event appear
4. Check Campaign Settings → Conversion Value should update automatically

---

## Summary

**For Marketing Executives:**

1. **One-time setup:** Copy webhook URL, configure external system (or have IT do it)
2. **Ongoing:** Just use MetricMind dashboard - everything is automatic!
3. **No manual work:** Conversion values are sent automatically from your e-commerce/CRM system
4. **More accurate:** Uses actual order values, not fixed estimates

**The webhook is the "plumbing" that makes automation possible. Marketing executives don't interact with it directly - they just benefit from the automation!**

