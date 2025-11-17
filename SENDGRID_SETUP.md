# SendGrid Setup Guide for MetricMind

## Overview

This guide will help you set up SendGrid's Inbound Parse to automatically process PDF reports emailed to your campaigns.

**What you'll achieve:**
- Users can forward PDF reports to unique campaign emails (e.g., `q4-wine-marketing@import.mforensics.com`)
- PDFs are automatically parsed and metrics appear in MetricMind within 60 seconds
- 100% free for up to 100 emails/day (3,000/month)
- No credit card required

---

## Prerequisites

- Access to your domain's DNS settings (for `mforensics.com` or subdomain)
- SendGrid account (free tier)
- MetricMind deployed on Render

---

## Step 1: Create SendGrid Account (5 minutes)

### 1.1 Sign Up

1. Go to: https://signup.sendgrid.com
2. Click **"Start for Free"**
3. Fill in:
   - Email address
   - Password
   - First/Last name
4. Click **"Create Account"**
5. Verify your email address

### 1.2 Complete Setup

1. Log into SendGrid dashboard
2. Complete the onboarding wizard:
   - Select **"Integrate using our Web API or SMTP Relay"**
   - Skip API key creation for now (we'll do this later)

---

## Step 2: Add Your Domain to SendGrid (10 minutes)

### 2.1 Navigate to Domain Authentication

1. In SendGrid dashboard, go to **Settings** → **Sender Authentication**
2. Click **"Authenticate Your Domain"**

### 2.2 Configure Domain

1. **DNS Host:** Select your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)
2. **Domain:** Enter `import.mforensics.com` (recommended to use subdomain)
   - ✅ Using a subdomain keeps your main domain separate
   - ✅ Easier to manage DNS records
3. **Advanced Settings:**
   - Leave defaults (use automated security, branded links)
4. Click **"Next"**

### 2.3 Add DNS Records

SendGrid will show you DNS records to add. You'll need to add these to your DNS provider:

**Example DNS Records:**

```
Type: CNAME
Name: em1234.import.mforensics.com
Value: u1234567.wl123.sendgrid.net

Type: CNAME
Name: s1._domainkey.import.mforensics.com
Value: s1.domainkey.u1234567.wl123.sendgrid.net

Type: CNAME
Name: s2._domainkey.import.mforensics.com
Value: s2.domainkey.u1234567.wl123.sendgrid.net

Type: MX
Name: import.mforensics.com
Priority: 10
Value: mx.sendgrid.net
```

**How to Add DNS Records (Cloudflare Example):**

1. Log into Cloudflare
2. Select your domain (`mforensics.com`)
3. Go to **DNS** → **Records**
4. Click **"Add record"**
5. Copy each record from SendGrid exactly as shown
6. Click **"Save"**
7. Repeat for all records

**Important:**
- DNS propagation can take 5-30 minutes
- Some providers may take up to 48 hours (rare)

### 2.4 Verify DNS Setup

1. Go back to SendGrid
2. Click **"Verify"**
3. Wait for all records to show ✅ green checkmarks
4. If verification fails, wait 10 minutes and try again

---

## Step 3: Configure Inbound Parse (5 minutes)

### 3.1 Navigate to Inbound Parse

1. In SendGrid dashboard, go to **Settings** → **Inbound Parse**
2. Click **"Add Host & URL"**

### 3.2 Configure Parse Settings

1. **Receiving Domain:** Select `import.mforensics.com` (the domain you just verified)
2. **Subdomain:** Leave blank or enter `*` (catch-all)
   - This allows emails to `anything@import.mforensics.com` to be received
3. **Destination URL:** Enter your webhook URL:
   ```
   https://mforensics.onrender.com/api/sendgrid/inbound
   ```
4. **Check spam:** ✅ Enable (recommended)
5. **Send raw:** ❌ Disable (we want parsed data)
6. **POST the raw, full MIME message:** ❌ Disable
7. Click **"Add"**

**What this does:**
- Any email sent to `*@import.mforensics.com` will be forwarded to your webhook
- SendGrid will parse the email and send it as JSON to your app
- Your app will extract the PDF, parse metrics, and store them

---

## Step 4: Get API Key (Optional - for verification)

### 4.1 Create API Key

1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. **API Key Name:** `MetricMind Inbound Parse`
4. **API Key Permissions:** Select **"Restricted Access"**
5. Enable only:
   - **Mail Send** → **Mail Send** (if you want to send confirmation emails later)
   - **Inbound Parse** → **Read Access**
6. Click **"Create & View"**
7. **Copy the API key** (you won't see it again!)

### 4.2 Store API Key (Optional)

If you want to verify webhook signatures for security:

1. Go to Render dashboard
2. Select your `metricmind` service
3. Go to **Environment** tab
4. Add:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. Click **"Save Changes"**

---

## Step 5: Configure Webhook Verification (Optional - Security)

### 5.1 Get Webhook Verification Key

1. In SendGrid, go to **Settings** → **Inbound Parse**
2. Click on your parse webhook
3. Scroll to **"Event Webhook"** section
4. Copy the **"Verification Key"**

### 5.2 Add to Render Environment

1. Go to Render dashboard
2. Select your `metricmind` service
3. Go to **Environment** tab
4. Add:
   ```
   SENDGRID_WEBHOOK_VERIFICATION_KEY=your-verification-key-here
   ```
5. Click **"Save Changes"**
6. Render will redeploy automatically

---

## Step 6: Test the Complete Flow (5 minutes)

### 6.1 Create Test Campaign

1. Go to MetricMind: https://mforensics.onrender.com
2. Click **"Create New Campaign"**
3. Fill in:
   - **Name:** "Test Campaign"
   - **Budget:** 10000
   - Click **"Next"**
4. In "Connect Data Sources":
   - Click **"Custom Integration"**
   - Click **"Email Forwarding"**
   - Click **"Connect"**
5. Note the generated email: `test-campaign@import.mforensics.com`
6. Click **"Got it!"**
7. Click **"Create Campaign with 1 platform"**

### 6.2 Prepare Test PDF

Create a simple PDF with this content:

```
Campaign Performance Report

Impressions: 125,000
Clicks: 8,500
Conversions: 450
Spend: $12,500
Revenue: $45,000
CTR: 6.8%
Conversion Rate: 5.3%
```

Save as `test-report.pdf`

### 6.3 Send Test Email

1. Open your email client (Gmail, Outlook, etc.)
2. Compose new email
3. **To:** `test-campaign@import.mforensics.com`
4. **Subject:** "Weekly Performance Report"
5. **Attach:** `test-report.pdf`
6. Click **"Send"**

### 6.4 Verify Import

1. Wait 30-60 seconds
2. Go back to MetricMind
3. Click on **"Test Campaign"**
4. You should see:
   - ✅ Blue **"Connected"** badge on Custom Integration
   - ✅ **"View Detailed Analytics"** link
5. Click **"View Detailed Analytics"**
6. You should see the extracted metrics:
   - Impressions: 125,000
   - Clicks: 8,500
   - Conversions: 450
   - Spend: $12,500
   - Revenue: $45,000
   - CTR: 6.8%
   - Conversion Rate: 5.3%

**If metrics don't appear:**
- Check Render logs for `[SendGrid]` entries
- Check SendGrid **Activity** → **Inbound Parse** for delivery status
- Verify DNS records are propagated
- Verify webhook URL is correct

---

## Troubleshooting

### Issue 1: Email Not Received

**Check SendGrid Activity:**
1. Go to SendGrid dashboard
2. Go to **Activity** → **Inbound Parse**
3. Look for your test email
4. Check status and error messages

**Common Causes:**
- DNS records not propagated (wait 30 minutes, try again)
- MX record priority incorrect (should be 10)
- Subdomain misconfigured in Inbound Parse settings

**Fix:**
1. Verify all DNS records show ✅ in SendGrid
2. Use https://dnschecker.org to verify MX records globally
3. Wait for full DNS propagation (up to 48 hours in rare cases)

---

### Issue 2: Webhook Not Called

**Check Render Logs:**
1. Go to Render dashboard
2. Select your service
3. Go to **Logs** tab
4. Search for `[SendGrid]`

**Common Causes:**
- Webhook URL incorrect
- Service not deployed
- Firewall blocking SendGrid

**Fix:**
1. Verify webhook URL: `https://mforensics.onrender.com/api/sendgrid/inbound`
2. Test webhook manually:
   ```bash
   curl -X POST https://mforensics.onrender.com/api/sendgrid/inbound \
     -H "Content-Type: application/json" \
     -d '{"to":"test@import.mforensics.com","from":"sender@example.com","subject":"Test"}'
   ```
3. Check for 200 OK response

---

### Issue 3: PDF Not Extracted

**Check Render Logs:**
1. Look for `[SendGrid] Found X attachment(s)`
2. Look for `[SendGrid] Found PDF: filename.pdf`
3. Look for parsing errors

**Common Causes:**
- PDF is password-protected
- PDF is scanned image (not text)
- Attachment format unexpected

**Fix:**
1. Ensure PDF contains searchable text (not just images)
2. Remove password protection
3. Try uploading PDF manually in MetricMind to test parsing

---

### Issue 4: Metrics Not Stored

**Check Render Logs:**
1. Look for `[SendGrid] ✅ Metrics stored for campaign`
2. Look for database errors

**Common Causes:**
- Campaign not found (email address mismatch)
- Database connection issue
- Metrics parsing failed

**Fix:**
1. Verify campaign email matches exactly
2. Check database connection in Render
3. Review PDF parsing confidence score in logs

---

## Usage Monitoring

### Check SendGrid Usage

1. Go to SendGrid dashboard
2. Go to **Dashboard** → **Overview**
3. Monitor:
   - Emails received per day
   - Webhook success rate
   - Errors

**Free Tier Limits:**
- 100 emails/day
- 3,000 emails/month
- You'll get email alerts if approaching limits

### Upgrade If Needed

If you exceed free tier:
- **$15/month:** 40,000 emails/month
- **$60/month:** 100,000 emails/month

---

## Security Best Practices

### 1. Enable Webhook Verification

Always set `SENDGRID_WEBHOOK_VERIFICATION_KEY` in production to verify webhooks are from SendGrid.

### 2. Use Email Whitelist

When creating campaigns, specify allowed sender addresses:

```
Allowed Senders:
reports@williamreed.com
analytics@agency.com
```

This prevents unauthorized emails from being processed.

### 3. Monitor Activity

Regularly check SendGrid **Activity** logs for:
- Unexpected senders
- High volume spikes
- Failed deliveries

### 4. Rate Limiting

The webhook endpoint has built-in rate limiting to prevent abuse.

---

## Quick Reference

### Environment Variables

```bash
# Required
DATABASE_URL=postgresql://...

# Optional (for webhook verification)
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SENDGRID_WEBHOOK_VERIFICATION_KEY=your-verification-key

# Optional (for sending emails)
SENDGRID_FROM_EMAIL=noreply@mforensics.com
```

### Webhook URL

```
https://mforensics.onrender.com/api/sendgrid/inbound
```

### DNS Records Summary

```
MX    import.mforensics.com → mx.sendgrid.net (Priority: 10)
CNAME em1234.import.mforensics.com → u1234567.wl123.sendgrid.net
CNAME s1._domainkey.import.mforensics.com → s1.domainkey.u1234567.wl123.sendgrid.net
CNAME s2._domainkey.import.mforensics.com → s2.domainkey.u1234567.wl123.sendgrid.net
```

### Test Email Format

```
To: campaign-slug@import.mforensics.com
Subject: Any subject
Attachment: report.pdf (must contain searchable text)
```

---

## Support

### SendGrid Support

- Documentation: https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook
- Support: https://support.sendgrid.com

### MetricMind Support

- Check Render logs for detailed error messages
- All webhook activity is logged with `[SendGrid]` prefix
- Metrics parsing confidence scores are logged

---

## Next Steps

1. ✅ Complete SendGrid setup
2. ✅ Test with sample PDF
3. ✅ Create real campaigns
4. ✅ Forward actual reports
5. ✅ Monitor usage and metrics

**You're all set!** Users can now forward PDF reports to campaign-specific emails and metrics will automatically appear in MetricMind. 🚀

