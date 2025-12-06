# Conversion Value Webhook API - MVP Implementation

## Overview

This is the **easiest and quickest MVP solution** for automated conversion value ingestion that is also **professional and industry standard**. The webhook API allows any system (e-commerce platforms, CRMs, custom backends) to send conversion events with actual values directly to MetricMind.

## Why Webhook API for MVP?

✅ **Fastest to implement** (1 week vs 4-6 weeks for platform integrations)  
✅ **Works with any system** (e-commerce, CRM, custom backend)  
✅ **Industry standard** (used by Stripe, Shopify, Zapier, etc.)  
✅ **Professional** (server-to-server, reliable, secure)  
✅ **Flexible** (handles variable conversion values automatically)  
✅ **No frontend changes required** (backend-only implementation)

---

## API Endpoint

### POST `/api/webhook/conversion/:campaignId`

Accepts conversion events with actual values from any external system.

**URL Parameters:**
- `campaignId` (required): The MetricMind campaign ID

**Request Body (JSON):**
```json
{
  "value": 29.99,              // Required: Conversion value (number)
  "currency": "USD",            // Optional: Currency code (default: "USD")
  "conversionId": "order-123",  // Optional: External conversion ID (e.g., order ID)
  "conversionType": "purchase", // Optional: Type of conversion (e.g., "purchase", "lead", "signup")
  "occurredAt": "2024-01-15T10:30:00Z", // Optional: When conversion happened (ISO 8601)
  "metadata": {                 // Optional: Additional data
    "productId": "prod-123",
    "customerId": "cust-456",
    "discount": 5.00
  }
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "event": {
    "id": "event-uuid",
    "value": "29.99",
    "currency": "USD",
    "occurredAt": "2024-01-15T10:30:00.000Z"
  },
  "message": "Conversion event recorded successfully"
}
```

**Response (Error - 400/404/500):**
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Usage Examples

### Example 1: E-commerce Order (Shopify, WooCommerce, etc.)

```bash
curl -X POST https://your-domain.com/api/webhook/conversion/campaign-123 \
  -H "Content-Type: application/json" \
  -d '{
    "value": 149.99,
    "currency": "USD",
    "conversionId": "order-456",
    "conversionType": "purchase",
    "occurredAt": "2024-01-15T10:30:00Z",
    "metadata": {
      "orderId": "order-456",
      "productIds": ["prod-1", "prod-2"],
      "customerEmail": "customer@example.com"
    }
  }'
```

### Example 2: Lead Generation (CRM, Form Submissions)

```bash
curl -X POST https://your-domain.com/api/webhook/conversion/campaign-123 \
  -H "Content-Type: application/json" \
  -d '{
    "value": 50.00,
    "currency": "USD",
    "conversionId": "lead-789",
    "conversionType": "lead",
    "metadata": {
      "leadSource": "contact-form",
      "leadScore": 85
    }
  }'
```

### Example 3: Subscription Signup (SaaS)

```bash
curl -X POST https://your-domain.com/api/webhook/conversion/campaign-123 \
  -H "Content-Type: application/json" \
  -d '{
    "value": 99.00,
    "currency": "USD",
    "conversionId": "subscription-abc",
    "conversionType": "signup",
    "metadata": {
      "plan": "pro",
      "billingCycle": "monthly"
    }
  }'
```

---

## Integration Examples

### Shopify (Liquid Template)

Add to your Shopify order confirmation page:

```liquid
<script>
  fetch('https://your-domain.com/api/webhook/conversion/{{ campaign_id }}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      value: {{ order.total_price | divided_by: 100.0 }},
      currency: '{{ order.currency }}',
      conversionId: '{{ order.order_number }}',
      conversionType: 'purchase',
      occurredAt: new Date().toISOString(),
      metadata: {
        orderId: '{{ order.id }}',
        customerId: '{{ customer.id }}',
        items: {{ order.line_items | json }}
      }
    })
  });
</script>
```

### WooCommerce (PHP Hook)

Add to your WordPress theme's `functions.php`:

```php
add_action('woocommerce_thankyou', 'send_conversion_to_metricmind', 10, 1);
function send_conversion_to_metricmind($order_id) {
    $order = wc_get_order($order_id);
    $campaign_id = 'your-campaign-id'; // Get from settings
    
    $data = array(
        'value' => floatval($order->get_total()),
        'currency' => $order->get_currency(),
        'conversionId' => (string)$order_id,
        'conversionType' => 'purchase',
        'occurredAt' => $order->get_date_created()->format('c'),
        'metadata' => array(
            'orderId' => $order_id,
            'customerId' => $order->get_customer_id(),
        )
    );
    
    wp_remote_post("https://your-domain.com/api/webhook/conversion/{$campaign_id}", array(
        'headers' => array('Content-Type' => 'application/json'),
        'body' => json_encode($data),
        'timeout' => 5
    ));
}
```

### Stripe Webhook

Configure Stripe webhook to call MetricMind:

```javascript
// Stripe webhook handler
app.post('/stripe-webhook', async (req, res) => {
  const event = req.body;
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    
    // Forward to MetricMind
    await fetch(`https://your-domain.com/api/webhook/conversion/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: session.amount_total / 100, // Convert cents to dollars
        currency: session.currency.toUpperCase(),
        conversionId: session.id,
        conversionType: 'purchase',
        occurredAt: new Date(session.created * 1000).toISOString(),
      })
    });
  }
  
  res.json({ received: true });
});
```

### Zapier / Make.com (No-Code)

1. Create a new Zap/Make scenario
2. Trigger: Your e-commerce platform (Shopify, WooCommerce, etc.)
3. Action: Webhook (POST)
4. URL: `https://your-domain.com/api/webhook/conversion/{campaignId}`
5. Method: POST
6. Headers: `Content-Type: application/json`
7. Body: Map your order data to the webhook format

---

## How It Works

1. **External system sends conversion event** → Webhook receives POST request
2. **Event is validated** → Campaign exists, value is valid number
3. **Event is stored** → Saved to `conversion_events` table
4. **Campaign updated** → Average conversion value calculated from last 30 days
5. **Revenue calculated** → Uses actual event values (not fixed campaign value)

---

## Benefits

### For E-commerce:
- ✅ Captures actual order values (handles discounts, variable pricing)
- ✅ Works with any platform (Shopify, WooCommerce, BigCommerce, etc.)
- ✅ Real-time value tracking

### For B2B/CRM:
- ✅ Tracks actual deal values from Salesforce, HubSpot, etc.
- ✅ Handles complex sales cycles
- ✅ Links marketing to revenue

### For Custom Systems:
- ✅ Works with any backend (Node.js, Python, PHP, etc.)
- ✅ Simple HTTP POST request
- ✅ No SDK required

---

## Security Considerations (Future Enhancements)

For MVP, the webhook uses `campaignId` in the URL. For production, consider:

1. **Webhook Tokens** (like custom integrations)
   - Generate unique token per campaign
   - Validate token instead of campaignId in URL

2. **Signature Verification**
   - HMAC signature from source system
   - Verify request authenticity

3. **Rate Limiting**
   - Prevent abuse
   - Limit requests per campaign

---

## Next Steps

1. **Test the webhook** with sample conversion events
2. **Integrate with your e-commerce platform** (Shopify, WooCommerce, etc.)
3. **Update revenue calculations** to use actual conversion events
4. **Add webhook tokens** for enhanced security (Phase 2)

---

## Comparison to Other Methods

| Method | Time to Implement | Works With | Complexity |
|--------|------------------|------------|------------|
| **Webhook API** ⭐ | 1 week | Everything | Low |
| JavaScript Tracking | 1-2 weeks | Websites only | Medium |
| E-commerce Integration | 2-4 weeks | One platform | High |
| CRM Integration | 3-6 weeks | One CRM | High |

**Webhook API is the best MVP choice** because it's fastest, most flexible, and works with any system.

