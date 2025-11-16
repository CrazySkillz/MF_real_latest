# 📋 William Reed Integration - Quick Reference Card

## 🎯 **For Platform Developer**

---

## **Client Onboarding (15 minutes)**

### **Step 1: Create Campaign** (2 min)
```
1. Log into MetricMind: https://mforensics.onrender.com
2. Create new campaign (or use existing)
3. Click "Connect Data Source" → "Custom Integration" → "Connect"
4. Copy webhook URL and CloudMailin email
```

### **Step 2: Configure CloudMailin** (5 min)
```
1. Go to CloudMailin.com
2. Create new email address
3. Settings:
   - Target URL: [webhook URL from Step 1]
   - Format: Multipart (Attachments)
   - Method: POST
   - ✅ Enable Attachment Store
4. Save and copy CloudMailin email address
```

### **Step 3: Client Email Setup** (5 min)
```
Send client:
- CloudMailin email address
- CLIENT_SETUP_WILLIAM_REED.md
- WILLIAM_REED_VISUAL_GUIDE.md

Client creates Gmail filter:
- From: william-reed.com
- Forward to: [CloudMailin email]
```

### **Step 4: Test** (3 min)
```
1. Client forwards sample William Reed report
2. Check Render logs: grep "[Webhook]"
3. Verify metrics in MetricMind dashboard
4. ✅ Done!
```

---

## **Webhook Endpoint**

```
POST https://mforensics.onrender.com/api/webhook/custom-integration/:token

Headers:
  Content-Type: multipart/form-data

Body:
  pdf: [file upload]
  OR
  pdfUrl: "https://..."
```

---

## **Testing Commands**

### **Test Webhook:**
```bash
curl -X POST \
  https://mforensics.onrender.com/api/webhook/custom-integration/YOUR_TOKEN \
  -F "pdf=@/path/to/report.pdf"
```

### **Check Recent Imports:**
```sql
SELECT campaign_id, pdf_file_name, users, sessions, uploaded_at
FROM custom_integration_metrics
ORDER BY uploaded_at DESC
LIMIT 5;
```

### **Check Webhook Token:**
```sql
SELECT campaign_id, webhook_token, connected_at
FROM custom_integrations
WHERE campaign_id = 'xxx';
```

---

## **Monitoring**

### **Render Logs:**
```bash
# Webhook activity
grep "\[Webhook\]" logs.txt

# PDF parsing
grep "\[PDF Parser\]" logs.txt

# Errors
grep "Error" logs.txt | grep -E "(Webhook|PDF)"
```

### **Database Health:**
```sql
-- Import frequency
SELECT 
  campaign_id,
  COUNT(*) as imports,
  MAX(uploaded_at) as last_import
FROM custom_integration_metrics
GROUP BY campaign_id;

-- Failed imports (no metrics)
SELECT *
FROM custom_integration_metrics
WHERE users IS NULL AND sessions IS NULL;
```

---

## **Troubleshooting**

### **Issue: Metrics not appearing**
```
1. Check Render logs for "[Webhook] Received request"
2. Check CloudMailin dashboard → Message Log
3. Verify webhook token matches
4. Test with manual curl command
```

### **Issue: Incorrect metrics**
```
1. Check "[PDF Parser] First 500 chars" in logs
2. Check "[PDF Parser] Detected William Reed" message
3. Add debug logging to see full extracted text
4. Refine regex patterns in pdf-parser.ts
```

### **Issue: Duplicate imports**
```
Normal behavior - each email = new snapshot
Can be deleted manually in dashboard
Future: Add duplicate detection
```

---

## **Cost Per Client**

| Report Frequency | CloudMailin Plan | Cost/Month |
|-----------------|------------------|------------|
| Weekly | Free (10/day) | $0 |
| Daily | Starter (1000/day) | $9 |
| Multiple/day | Business (10K/day) | $49 |

---

## **File Locations**

```
server/services/pdf-parser.ts       # PDF parsing logic
server/routes-oauth.ts              # Webhook endpoint (line 3172)
server/storage.ts                   # Database methods

Documentation:
├── WILLIAM_REED_SETUP_GUIDE.md              # Technical setup
├── CLIENT_SETUP_WILLIAM_REED.md             # Client-facing
├── WILLIAM_REED_VISUAL_GUIDE.md             # Visual/non-technical
├── DEVELOPER_NOTES_WILLIAM_REED.md          # Developer reference
└── WILLIAM_REED_IMPLEMENTATION_SUMMARY.md   # Project overview
```

---

## **Supported Metrics**

### **Website:**
- Users, Sessions, Pageviews
- Avg. Session Duration
- Pages per Session
- Bounce Rate

### **Traffic Sources:**
- Organic Search, Direct, Email
- Referral, Paid, Social (%)

### **Email:**
- Delivered, Open Rate, CTR
- CTOR, Bounces, Complaints
- Subscriber Growth

---

## **Quick Decisions**

### **"Should I use email forwarding or manual upload?"**
- **Email forwarding:** Best for recurring reports (automated)
- **Manual upload:** Best for one-off reports or testing

### **"Free or paid CloudMailin?"**
- **Free:** Weekly reports (most clients)
- **Paid:** Daily or multiple reports per day

### **"One campaign or multiple?"**
- **One:** Single brand/property
- **Multiple:** Different brands/properties (separate email addresses)

---

## **Support Contacts**

- **CloudMailin:** https://docs.cloudmailin.com/
- **William Reed:** Client's account manager
- **MetricMind:** support@metricmind.com

---

## **Emergency Fixes**

### **Webhook down:**
```bash
# Check Render service status
curl -I https://mforensics.onrender.com/api/webhook/custom-integration/test

# Restart service (Render dashboard)
# Check environment variables
```

### **Parser failing:**
```typescript
// Add debug logging to pdf-parser.ts
console.log('[DEBUG] Full text:', text);
console.log('[DEBUG] All matches:', Object.entries(patterns).map(...));

// Redeploy to Render
git push origin main
```

### **Database connection:**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check custom_integrations table
psql $DATABASE_URL -c "\d custom_integrations"
```

---

## **Checklist for Go-Live**

- [ ] PDF parser tested with real William Reed report
- [ ] Webhook endpoint tested with curl
- [ ] CloudMailin account created and configured
- [ ] Client email forwarding set up
- [ ] End-to-end test completed
- [ ] Metrics visible in dashboard
- [ ] Client trained on viewing analytics
- [ ] Documentation sent to client
- [ ] Support contact shared

---

**Print this card and keep it handy for client onboarding!**

**Last Updated:** November 2025

