# Mailgun Email Forwarding Setup Guide

This guide explains how to set up Mailgun for automatic PDF import via email forwarding.

## Overview

Users get a unique email address per campaign (e.g., `q4-wine-marketing@import.mforensics.com`). When they forward emails with PDF attachments to this address, the PDFs are automatically parsed and metrics imported into their dashboard.

---

## 1. Create Mailgun Account

1. Go to https://mailgun.com
2. Sign up for free account (5,000 emails/month free)
3. Verify your email address

---

## 2. Add and Verify Domain

### Option A: Use Subdomain (Recommended)
Use `import.mforensics.com` for clean separation.

### Option B: Use Sandbox Domain
For testing, use Mailgun's sandbox domain (limited to authorized recipients).

### Steps:
1. In Mailgun dashboard → **Sending** → **Domains**
2. Click **Add New Domain**
3. Enter: `import.mforensics.com`
4. Click **Add Domain**

---

## 3. Configure DNS Records

Add these DNS records to your domain registrar (e.g., GoDaddy, Cloudflare, Namecheap):

### Required Records:

```
Type  | Host/Name                              | Value/Target                | Priority | TTL
------|----------------------------------------|----------------------------|----------|-----
TXT   | import.mforensics.com                  | v=spf1 include:mailgun.org ~all |      | 3600
TXT   | k1._domainkey.import.mforensics.com    | [DKIM key from Mailgun]    |          | 3600
CNAME | email.import.mforensics.com            | mailgun.org                |          | 3600
MX    | import.mforensics.com                  | mxa.mailgun.org            | 10       | 3600
MX    | import.mforensics.com                  | mxb.mailgun.org            | 10       | 3600
```

**Note:** Get the exact DKIM key value from Mailgun dashboard after adding the domain.

### Verification:
- Wait 10-30 minutes for DNS propagation
- In Mailgun dashboard, click **Verify DNS Settings**
- All records should show green checkmarks ✅

---

## 4. Create Catch-All Route

This routes ALL emails to `*@import.mforensics.com` to your webhook.

### Steps:
1. In Mailgun dashboard → **Sending** → **Routes**
2. Click **Create Route**
3. Configure:
   - **Priority:** 0 (highest)
   - **Filter Expression:** `match_recipient(".*@import.mforensics.com")`
   - **Actions:**
     - ✅ **Forward:** `https://mforensics.onrender.com/api/mailgun/inbound`
     - ✅ **Store:** Yes (optional, for debugging)
   - **Description:** "Custom Integration PDF Imports"
4. Click **Create Route**

---

## 5. Get API Credentials

### API Key:
1. Go to **Settings** → **API Keys**
2. Copy your **Private API key**
3. Format: `key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Webhook Signing Key:
1. Go to **Settings** → **Webhooks**
2. Find **HTTP webhook signing key**
3. Copy the key
4. Format: `whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

---

## 6. Configure Environment Variables

Add these to your Render service:

```bash
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
MAILGUN_DOMAIN=import.mforensics.com
MAILGUN_WEBHOOK_SIGNING_KEY=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### In Render Dashboard:
1. Go to your service → **Environment**
2. Click **Add Environment Variable**
3. Add each variable above
4. Click **Save Changes**
5. Service will redeploy automatically

---

## 7. Test the Setup

### Test Email:
1. Create a test campaign (e.g., "Test Campaign")
2. System generates email: `test-campaign@import.mforensics.com`
3. Send a test email with PDF attachment to this address
4. Check Render logs for processing confirmation

### Expected Logs:
```
[Mailgun] Received inbound email webhook
[Mailgun] Recipient: test-campaign@import.mforensics.com
[Mailgun] From: your-email@gmail.com
[Mailgun] Routing to campaign: abc123...
[Mailgun] Processing PDF: report.pdf, size: 123456 bytes
[Mailgun] ✅ Metrics stored for campaign abc123...
[Mailgun] Confidence: 95%
```

---

## 8. Troubleshooting

### Email Not Received:
- Check DNS records are properly configured
- Verify domain in Mailgun dashboard
- Check Mailgun logs: **Sending** → **Logs**
- Ensure route is active and has priority 0

### Webhook Not Called:
- Verify webhook URL is correct: `https://mforensics.onrender.com/api/mailgun/inbound`
- Check Render logs for incoming requests
- Test webhook manually using Mailgun dashboard

### PDF Not Parsed:
- Check Render logs for parsing errors
- Verify PDF is attached (not inline)
- Ensure PDF is valid and not corrupted

### Signature Verification Failed:
- Verify `MAILGUN_WEBHOOK_SIGNING_KEY` is correct
- Check for extra spaces in environment variable
- Temporarily disable signature check for testing (not recommended for production)

---

## 9. Email Address Format

### Generated Automatically:
- Campaign: "Q4 Wine Marketing" → `q4-wine-marketing@import.mforensics.com`
- Campaign: "Product Launch 2024" → `product-launch-2024@import.mforensics.com`
- Campaign: "Brand Awareness" → `brand-awareness@import.mforensics.com`

### Duplicate Names:
- First: "Q4 Wine Marketing" → `q4-wine-marketing@import.mforensics.com`
- Second: "Q4 Wine Marketing" → `q4-wine-marketing-2@import.mforensics.com`
- Third: "Q4 Wine Marketing" → `q4-wine-marketing-3@import.mforensics.com`

---

## 10. Security Features

### Webhook Signature Verification:
- All incoming webhooks are verified using HMAC-SHA256
- Prevents unauthorized access and spoofing

### Email Whitelist (Optional):
- Users can specify allowed sender addresses
- Only emails from whitelisted addresses are processed
- Configured per campaign

### Campaign Validation:
- Only processes emails for existing campaigns
- Invalid email addresses are rejected

---

## 11. Cost

### Free Tier:
- 5,000 emails/month
- Sufficient for most users

### Paid Plans:
- $35/month for 50,000 emails
- $80/month for 100,000 emails
- Pay-as-you-go available

---

## 12. Alternative: Mailgun Sandbox (Testing Only)

For testing without domain setup:

1. Use Mailgun sandbox domain: `sandboxXXXXX.mailgun.org`
2. Add authorized recipients in Mailgun dashboard
3. Only authorized emails can send to sandbox
4. **Not suitable for production** (limited recipients)

---

## Support

- Mailgun Documentation: https://documentation.mailgun.com
- Mailgun Support: https://help.mailgun.com
- MetricMind Support: [Your support email]

---

## Summary

✅ **User Experience:** Forward email → Metrics imported automatically  
✅ **Setup Time:** 30 minutes (one-time)  
✅ **Cost:** Free for 5,000 emails/month  
✅ **Maintenance:** Zero (fully automated)  

**No CloudMailin, no user setup, just forward emails!** 🚀

