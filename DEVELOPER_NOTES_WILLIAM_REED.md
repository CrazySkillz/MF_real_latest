# 🔧 William Reed Integration - Developer Notes

## Overview

This document explains the technical implementation of automated William Reed PDF report imports via email forwarding.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Email (Gmail/Outlook)                                    │
│ - Receives William Reed PDF reports                             │
│ - Auto-forwards via filter rule                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ CloudMailin (Email-to-HTTP Gateway)                             │
│ - Converts email → HTTP POST                                    │
│ - Extracts PDF attachments                                      │
│ - Forwards to webhook URL                                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ MetricMind Webhook Endpoint                                     │
│ POST /api/webhook/custom-integration/:token                     │
│ - Validates webhook token                                       │
│ - Receives PDF buffer                                           │
│ - Calls PDF parser                                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ PDF Parser (server/services/pdf-parser.ts)                      │
│ - Extracts text from PDF                                        │
│ - Detects William Reed format                                   │
│ - Applies regex patterns                                        │
│ - Returns structured metrics                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ Database Storage (storage.ts)                                   │
│ - Stores metrics in custom_integration_metrics table            │
│ - Links to campaign via campaignId                              │
│ - Timestamps for historical tracking                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

### **1. Webhook Endpoint** (`server/routes-oauth.ts`)

**Location:** Lines 3172-3280

**Endpoint:** `POST /api/webhook/custom-integration/:token`

**Features:**
- ✅ Token-based authentication
- ✅ Accepts PDF file upload (multipart/form-data)
- ✅ Accepts PDF URL (for IFTTT/Zapier)
- ✅ Comprehensive error handling
- ✅ Detailed logging

**Key Code:**
```typescript
app.post("/api/webhook/custom-integration/:token", upload.single('pdf'), async (req, res) => {
  const { token } = req.params;
  
  // Find integration by webhook token
  const integration = customIntegrations.find(ci => ci.webhookToken === token);
  
  if (!integration) {
    return res.status(401).json({ error: "Invalid webhook token" });
  }

  // Handle file upload or URL
  let pdfBuffer: Buffer;
  if (req.file) {
    pdfBuffer = req.file.buffer;
  } else if (req.body.pdfUrl) {
    const response = await fetch(req.body.pdfUrl);
    pdfBuffer = Buffer.from(await response.arrayBuffer());
  }

  // Parse PDF
  const parsedMetrics = await parsePDFMetrics(pdfBuffer);
  
  // Store metrics
  await storage.createCustomIntegrationMetrics({
    campaignId: integration.campaignId,
    ...parsedMetrics,
    pdfFileName: fileName,
  });
});
```

---

### **2. PDF Parser** (`server/services/pdf-parser.ts`)

**Enhanced Features:**
- ✅ William Reed format detection
- ✅ Extended regex patterns for WR-specific terminology
- ✅ Support for multiple metric formats
- ✅ Handles K/M suffixes (e.g., "1.2M" → 1,200,000)
- ✅ Currency symbol handling
- ✅ Percentage parsing

**William Reed Detection:**
```typescript
const isWilliamReed = /william[\s-]?reed/i.test(text) || 
                      /food[\s&]+drink/i.test(text) ||
                      /convenience\s+store/i.test(text);
```

**Enhanced Patterns:**
```typescript
const patterns = {
  // Standard formats
  users: /(?:users?\s*\(unique\)|unique\s*users?)[:\s|]+([0-9,.KM]+)/i,
  
  // William Reed variations
  users: /(?:unique\s*visitors?|visitors?)[:\s|]+([0-9,.KM]+)/i,
  sessions: /(?:sessions?|visits?)[:\s|]+([0-9,.KM]+)/i,
  avgSessionDuration: /(?:avg\.?\s*time\s*on\s*site|average\s*time)[:\s|]+([0-9:]+)/i,
  
  // Email metrics (WR newsletter reports)
  openRate: /(?:open\s*rate|opens?)\s*(?:\(unique\))?[:\s|]+([0-9,.]+)%?/i,
  clickThroughRate: /(?:click\s*rate|ctr)[:\s|]+([0-9,.]+)%?/i,
};
```

---

### **3. Storage Layer** (`server/storage.ts`)

**Table:** `custom_integration_metrics`

**Schema:**
```typescript
{
  id: string (UUID)
  campaignId: string
  
  // Traffic metrics
  users: number
  sessions: number
  pageviews: number
  avgSessionDuration: string (e.g., "00:02:38")
  pagesPerSession: decimal
  bounceRate: decimal
  
  // Traffic sources (percentages)
  organicSearchShare: decimal
  directBrandedShare: decimal
  emailShare: decimal
  referralShare: decimal
  paidShare: decimal
  socialShare: decimal
  
  // Email metrics
  emailsDelivered: number
  openRate: decimal
  clickThroughRate: decimal
  clickToOpenRate: decimal
  hardBounces: decimal
  spamComplaints: decimal
  listGrowth: number
  
  // Metadata
  pdfFileName: string
  emailSubject: string (nullable)
  emailId: string (nullable)
  uploadedAt: timestamp
}
```

---

## CloudMailin Configuration

### **Setup Steps:**

1. **Create CloudMailin Account**
   - Free tier: 10 emails/day
   - Paid: $9/mo for 1000 emails/day

2. **Configure Target URL**
   ```
   URL: https://mforensics.onrender.com/api/webhook/custom-integration/{token}
   Method: POST
   Format: Multipart (Attachments)
   ```

3. **Enable Attachment Store**
   - Allows PDFs to be accessible via URL
   - 30-day retention

4. **Get CloudMailin Email Address**
   - Format: `abc123@cloudmailin.net`
   - Unique per integration

---

## Client Setup Flow

### **1. Create Custom Integration**

**Frontend:** `client/src/pages/campaigns.tsx`

```typescript
// User clicks "Connect Custom Integration"
const { data: integration } = await apiRequest("POST", 
  `/api/custom-integration/${campaignId}/connect`
);

// Returns:
{
  id: "uuid",
  campaignId: "campaign-123",
  webhookToken: "secure-token-xyz",
  webhookUrl: "https://mforensics.onrender.com/api/webhook/custom-integration/secure-token-xyz",
  cloudmailinEmail: "abc123@cloudmailin.net", // If CloudMailin is configured
  connectedAt: "2025-11-16T10:00:00Z"
}
```

### **2. Display Setup Instructions**

**Frontend Modal:**
```typescript
<Alert>
  <h3>Your Unique Email Address</h3>
  <code>{integration.cloudmailinEmail}</code>
  
  <h4>Setup Auto-Forwarding:</h4>
  <ol>
    <li>Open Gmail Settings → Filters</li>
    <li>Create filter: From "william-reed.com"</li>
    <li>Forward to: {integration.cloudmailinEmail}</li>
  </ol>
</Alert>
```

---

## Testing

### **Manual Test (Developer)**

```bash
# 1. Get webhook token from database
psql $DATABASE_URL -c "SELECT webhook_token FROM custom_integrations WHERE campaign_id = 'your-campaign-id';"

# 2. Test with curl
curl -X POST \
  https://mforensics.onrender.com/api/webhook/custom-integration/YOUR_TOKEN \
  -F "pdf=@/path/to/william-reed-report.pdf"

# 3. Check logs
# Render Dashboard → Logs → Filter for "[Webhook]"

# 4. Verify database
psql $DATABASE_URL -c "SELECT * FROM custom_integration_metrics WHERE campaign_id = 'your-campaign-id' ORDER BY uploaded_at DESC LIMIT 1;"
```

### **Client Test**

1. Forward a William Reed report to CloudMailin email
2. Check Render logs for webhook receipt
3. Verify metrics in MetricMind dashboard
4. Check Custom Integration Analytics page

---

## Error Handling

### **Common Issues**

#### **1. Invalid Token (401)**
```json
{
  "success": false,
  "error": "Invalid webhook token"
}
```
**Fix:** Verify token in database matches URL parameter

#### **2. No PDF Provided (400)**
```json
{
  "success": false,
  "error": "No PDF file or PDF URL provided"
}
```
**Fix:** Ensure CloudMailin is configured to send attachments

#### **3. PDF Parse Error (500)**
```json
{
  "success": false,
  "error": "Failed to parse PDF document"
}
```
**Fix:** Check PDF format, add debug logging to parser

---

## Monitoring

### **Webhook Logs**

```typescript
console.log('[Webhook] Received request with token:', token);
console.log('[Webhook] Processing PDF for campaign:', campaignId);
console.log('[Webhook] Parsed metrics:', parsedMetrics);
console.log('[Webhook] Metrics stored successfully:', metrics.id);
```

**Check Render Logs:**
```bash
# Search for webhook activity
grep "\[Webhook\]" logs.txt

# Search for parse errors
grep "PDF Parser.*Error" logs.txt
```

### **Database Queries**

```sql
-- Recent imports
SELECT 
  campaign_id,
  pdf_file_name,
  users,
  sessions,
  pageviews,
  uploaded_at
FROM custom_integration_metrics
ORDER BY uploaded_at DESC
LIMIT 10;

-- Import frequency by campaign
SELECT 
  campaign_id,
  COUNT(*) as import_count,
  MAX(uploaded_at) as last_import,
  MIN(uploaded_at) as first_import
FROM custom_integration_metrics
GROUP BY campaign_id;

-- Failed imports (no metrics extracted)
SELECT *
FROM custom_integration_metrics
WHERE users IS NULL 
  AND sessions IS NULL 
  AND pageviews IS NULL;
```

---

## Performance Optimization

### **Current Performance:**
- PDF parsing: ~500ms - 2s (depends on PDF size)
- Database write: ~50ms
- Total webhook response: ~1-3s

### **Optimization Opportunities:**

1. **Async Processing**
   ```typescript
   // Return 202 Accepted immediately
   res.status(202).json({ message: "Processing PDF..." });
   
   // Process in background
   processWebhookAsync(token, pdfBuffer);
   ```

2. **PDF Caching**
   ```typescript
   // Cache parsed PDFs by hash to avoid re-parsing duplicates
   const pdfHash = crypto.createHash('md5').update(pdfBuffer).digest('hex');
   const cached = await redis.get(`pdf:${pdfHash}`);
   if (cached) return JSON.parse(cached);
   ```

3. **Batch Processing**
   ```typescript
   // If multiple reports arrive simultaneously, batch DB writes
   await storage.createCustomIntegrationMetricsBatch(metricsArray);
   ```

---

## Security

### **Webhook Token Generation**

```typescript
import { randomBytes } from 'crypto';

const webhookToken = randomBytes(32).toString('hex');
// Example: "a3f5e8d9c2b1f4e6a7d8c9b0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0"
```

### **Token Validation**

```typescript
// Constant-time comparison to prevent timing attacks
import { timingSafeEqual } from 'crypto';

const isValid = timingSafeEqual(
  Buffer.from(providedToken),
  Buffer.from(storedToken)
);
```

### **Rate Limiting**

```typescript
// Apply rate limiter to webhook endpoint
import { webhookRateLimiter } from './middleware/rateLimiter';

app.post("/api/webhook/custom-integration/:token", 
  webhookRateLimiter, // Max 100 requests per 15 min per token
  upload.single('pdf'), 
  async (req, res) => { /* ... */ }
);
```

---

## Future Enhancements

### **1. Multi-Format Support**
```typescript
// Support CSV, Excel, JSON in addition to PDF
if (req.file.mimetype === 'application/pdf') {
  metrics = await parsePDFMetrics(buffer);
} else if (req.file.mimetype === 'text/csv') {
  metrics = await parseCSVMetrics(buffer);
} else if (req.file.mimetype === 'application/vnd.ms-excel') {
  metrics = await parseExcelMetrics(buffer);
}
```

### **2. Smart Field Mapping**
```typescript
// Learn from user corrections to improve parsing
const userCorrections = await storage.getUserCorrections(campaignId);
const enhancedMetrics = applyLearning(parsedMetrics, userCorrections);
```

### **3. Duplicate Detection**
```typescript
// Detect and prevent duplicate imports
const recentImports = await storage.getRecentMetrics(campaignId, 7); // Last 7 days
const isDuplicate = recentImports.some(m => 
  m.pdfFileName === fileName && 
  m.users === parsedMetrics.users
);
if (isDuplicate) {
  return res.status(200).json({ message: "Duplicate detected, skipping" });
}
```

### **4. Notification System**
```typescript
// Notify user after successful import
await sendNotification(integration.userId, {
  title: "New metrics imported",
  body: `William Reed report processed: ${fileName}`,
  link: `/campaigns/${campaignId}/custom-integration-analytics`
});
```

---

## Troubleshooting Guide

### **Issue: Metrics not appearing**

**Check:**
1. Webhook received? → Check Render logs for `[Webhook] Received request`
2. Token valid? → Check `[Webhook] Invalid token` errors
3. PDF parsed? → Check `[PDF Parser] Extracted text length`
4. Metrics stored? → Check `[Webhook] Metrics stored successfully`

**Debug:**
```bash
# Check webhook endpoint is accessible
curl -I https://mforensics.onrender.com/api/webhook/custom-integration/test

# Check CloudMailin logs
# CloudMailin Dashboard → Message Log → View delivery status

# Check database
psql $DATABASE_URL -c "SELECT * FROM custom_integrations WHERE campaign_id = 'xxx';"
```

---

### **Issue: Incorrect metrics extracted**

**Check:**
1. PDF text extraction → Check `[PDF Parser] First 500 chars`
2. Pattern matching → Check `[PDF Parser] Found rate-related lines`
3. William Reed detection → Check `[PDF Parser] ✅ Detected William Reed report format`

**Debug:**
```typescript
// Add temporary debug logging to pdf-parser.ts
console.log('[PDF Parser] Full extracted text:', text);
console.log('[PDF Parser] All regex matches:', 
  Object.entries(patterns).map(([key, pattern]) => ({
    metric: key,
    match: text.match(pattern)?.[1] || 'NO MATCH'
  }))
);
```

---

## Cost Analysis

### **CloudMailin Pricing**

| Plan | Emails/Day | Cost/Month | Best For |
|------|-----------|------------|----------|
| **Free** | 10 | $0 | Testing, low-volume |
| **Starter** | 1,000 | $9 | Most clients (weekly reports) |
| **Business** | 10,000 | $49 | High-volume, multiple clients |

### **Render Hosting**

- Webhook endpoint: Included in base plan
- No additional cost per webhook call
- Database storage: ~1KB per import

### **Total Cost per Client**

- **Low Volume** (1 report/week): $0/month (free tier)
- **Medium Volume** (1 report/day): $9/month
- **High Volume** (multiple reports/day): $9-49/month

---

## Deployment Checklist

- [ ] CloudMailin account created
- [ ] Target URL configured in CloudMailin
- [ ] Attachment store enabled
- [ ] Webhook endpoint tested with curl
- [ ] PDF parser tested with sample William Reed report
- [ ] Database schema includes all required fields
- [ ] Error logging configured
- [ ] Rate limiting applied
- [ ] Client documentation provided
- [ ] Support team trained on troubleshooting

---

**Last Updated:** November 2025  
**Maintained By:** Development Team

