# Mailgun Testing Guide (30-Day Trial)

## 🎯 Purpose

Test the complete email forwarding workflow using Mailgun's 30-day free trial, then switch to SendGrid + your own domain for production.

---

## ✅ Step-by-Step Setup

### **Step 1: Sign Up for Mailgun**

1. Go to: https://signup.mailgun.com/new/signup
2. Create account with your email
3. **Add credit card** (required, but no charge for 30 days)
4. Verify your email address

---

### **Step 2: Get Your Sandbox Domain**

1. Log into Mailgun dashboard
2. Go to **"Sending"** → **"Domains"**
3. You'll see a sandbox domain (looks like):
   ```
   sandboxABCDEF1234567890.mailgun.org
   ```
4. **Copy this domain** - you'll need it!

---

### **Step 3: Get API Key**

1. Go to **"Settings"** → **"API Keys"**
2. Find **"Private API key"** (starts with `key-...`)
3. Click **"Copy"**
4. Save it somewhere safe

---

### **Step 4: Authorize Your Test Email**

1. Go to **"Sending"** → **"Domains"**
2. Click on your sandbox domain
3. Scroll to **"Authorized Recipients"**
4. Click **"Add Recipient"**
5. Enter the email you'll send test emails FROM (e.g., your Gmail)
6. Check your email and click verification link
7. **Repeat for any other test emails** (up to 5)

---

### **Step 5: Configure Inbound Route**

1. Go to **"Receiving"** → **"Routes"**
2. Click **"Create Route"**
3. Fill in:
   - **Expression Type:** Select "Catch All"
   - **Actions:** Select "Forward"
   - **Forward URL:** 
     ```
     https://mforensics.onrender.com/api/mailgun/inbound
     ```
   - **Priority:** `0`
   - **Description:** `MetricMind PDF Import`
4. Click **"Create Route"**
i creait 
**Done!** Mailgun will now forward ALL emails to your webhook.

---

### **Step 6: Add Environment Variables to Render**

1. Go to Render dashboard: https://dashboard.render.com
2. Select your `metricmind` service
3. Go to **"Environment"** tab
4. Click **"Add Environment Variable"**
5. Add these variables:

```bash
# Your Mailgun sandbox domain (REPLACE WITH YOURS!)
EMAIL_DOMAIN=sandboxABCDEF1234567890.mailgun.org

# Your Mailgun API key (REPLACE WITH YOURS!)
MAILGUN_API_KEY=key-xxxxxxxxxxxxxxxxxxxxxxxx

# Your Mailgun domain (same as EMAIL_DOMAIN)
MAILGUN_DOMAIN=sandboxABCDEF1234567890.mailgun.org

# Optional: Webhook signing key for security
MAILGUN_WEBHOOK_SIGNING_KEY=your-signing-key-here
```

6. Click **"Save Changes"**
7. Render will automatically redeploy (takes ~2-3 minutes)

---

## 🧪 Testing the Complete Flow

### **Step 7: Create Test Campaign**

1. Go to: https://mforensics.onrender.com
2. Click **"Create New Campaign"**
3. Fill in:
   - **Name:** "Test Campaign"
   - **Budget:** 10000
4. Click **"Next"**
5. In "Connect Data Sources":
   - Click **"Custom Integration"**
   - Click **"Email Forwarding"** (option 2)
   - Click **"Connect"**
6. **Copy the generated email address**:
   ```
   test-campaign@sandboxABCDEF1234567890.mailgun.org
   ```
7. Click **"Got it!"**
8. Click **"Create Campaign with 1 platform"**

---

### **Step 8: Create Test PDF**

Create a PDF with this content (or use any marketing report):

```
Campaign Performance Report

Impressions: 125,000
Clicks: 8,500
Conversions: 450
Spend: $12,500
Revenue: $45,000
CTR: 6.8%
Conversion Rate: 5.3%
ROAS: 3.6x
```

Save as `test-report.pdf`

---

### **Step 9: Send Test Email**

1. Open your email client (Gmail, Outlook, etc.)
2. Compose new email
3. Fill in:
   - **To:** `test-campaign@sandboxABCDEF1234567890.mailgun.org`
   - **Subject:** "Weekly Performance Report"
   - **Body:** (optional, can be empty)
   - **Attach:** `test-report.pdf`
4. Click **"Send"**

**Important:** Send from the email address you authorized in Step 4!

---

### **Step 10: Verify Metrics Appear**

1. Wait **30-60 seconds**
2. Go back to MetricMind
3. Click on **"Test Campaign"**
4. You should see:
   - ✅ Blue **"Connected"** badge on Custom Integration
   - ✅ **"View Detailed Analytics"** link
5. Click **"View Detailed Analytics"**
6. **Metrics should appear!** 🎉

Expected metrics:
- Impressions: 125,000
- Clicks: 8,500
- Conversions: 450
- Spend: $12,500
- Revenue: $45,000
- CTR: 6.8%
- Conversion Rate: 5.3%

---

## 🔍 Troubleshooting

### **Issue 1: Email Not Received**

**Check Mailgun Logs:**
1. Go to **"Logs"** → **"Receiving"**
2. Look for your test email
3. Check status (delivered, failed, etc.)

**Common Causes:**
- Email sent from non-authorized address
- Inbound route not configured correctly
- Webhook URL incorrect

**Fix:**
1. Verify sender email is authorized
2. Check inbound route URL: `https://mforensics.onrender.com/api/mailgun/inbound`
3. Test route by clicking "Test" in Mailgun

---

### **Issue 2: Webhook Not Called**

**Check Render Logs:**
1. Go to Render dashboard
2. Select your service
3. Go to **"Logs"** tab
4. Search for `[Mailgun]`

**What to look for:**
```
[Mailgun] Received inbound email webhook
[Mailgun] Recipient: test-campaign@sandbox...
[Mailgun] From: your-email@gmail.com
[Mailgun] Subject: Weekly Performance Report
[Mailgun] Attachment count: 1
[Mailgun] Attachment 1: test-report.pdf, type: application/pdf
[Mailgun] Processing PDF: test-report.pdf, size: 12345 bytes
[Mailgun] ✅ Metrics stored for campaign test-campaign-id
```

**Common Causes:**
- Webhook URL incorrect
- Service not deployed
- Environment variables not set

**Fix:**
1. Verify `EMAIL_DOMAIN` is set in Render
2. Check service is running (not crashed)
3. Redeploy if needed

---

### **Issue 3: PDF Not Extracted**

**Check Render Logs for:**
```
[Mailgun] No PDF attachment found in email
```

**Common Causes:**
- PDF not attached
- Attachment format unexpected
- PDF is password-protected

**Fix:**
1. Ensure PDF is attached (not inline)
2. Remove password protection
3. Try with a simple PDF first

---

### **Issue 4: Metrics Not Displayed**

**Check Render Logs for:**
```
[Mailgun] ✅ Metrics stored for campaign CAMPAIGN_ID
[Mailgun] Confidence: XX%
```

**Common Causes:**
- Campaign email doesn't match
- Database connection issue
- Metrics parsing failed

**Fix:**
1. Verify campaign email matches exactly
2. Check database connection in Render
3. Review PDF parsing confidence score
4. Try manual upload to test parsing

---

## 📊 Monitoring Usage

### **Check Mailgun Dashboard:**

1. Go to **"Dashboard"** → **"Overview"**
2. Monitor:
   - Emails received per day
   - Webhook success rate
   - Errors

### **30-Day Trial Limits:**

- ✅ Unlimited emails (during trial)
- ✅ Full API access
- ✅ All features enabled

**After 30 days:**
- ❌ Must upgrade to paid plan ($35/month)
- ❌ OR switch to your own domain + SendGrid (free)

---

## 🔄 Switching to Production (After Testing)

### **When to Switch:**

Once you've confirmed the email flow works perfectly:

1. ✅ Buy a domain (e.g., `metricmind.com` for $12/year)
2. ✅ Set up SendGrid with your domain (free forever)
3. ✅ Update `EMAIL_DOMAIN` in Render to your domain
4. ✅ Cancel Mailgun before 30 days

### **Steps to Switch:**

1. **Buy domain** from Namecheap/Google Domains
2. **Follow `SENDGRID_SETUP.md`** to configure SendGrid
3. **Update Render environment variable:**
   ```bash
   EMAIL_DOMAIN=import.yourdomain.com
   ```
4. **Remove Mailgun variables:**
   - Remove `MAILGUN_API_KEY`
   - Remove `MAILGUN_DOMAIN`
   - Remove `MAILGUN_WEBHOOK_SIGNING_KEY`
5. **Redeploy**
6. **Cancel Mailgun subscription**

---

## ✅ Testing Checklist

- [ ] Mailgun account created
- [ ] Sandbox domain copied
- [ ] API key copied
- [ ] Test email authorized
- [ ] Inbound route configured
- [ ] Environment variables added to Render
- [ ] Render service redeployed
- [ ] Test campaign created
- [ ] Test PDF created
- [ ] Test email sent
- [ ] Metrics appeared in dashboard
- [ ] Tested with different PDF formats
- [ ] Tested with multiple campaigns
- [ ] Reviewed Mailgun logs
- [ ] Reviewed Render logs

---

## 🎯 Success Criteria

**You'll know it's working when:**

1. ✅ Email sent to campaign address
2. ✅ Mailgun receives email (check logs)
3. ✅ Mailgun forwards to webhook (check logs)
4. ✅ Webhook processes PDF (check Render logs)
5. ✅ Metrics appear in MetricMind dashboard
6. ✅ "Awaiting Data" state disappears
7. ✅ Analytics page shows extracted metrics

**Total time from send to display: ~30-60 seconds**

---

## 💡 Tips

1. **Test with simple PDFs first** - Easier to debug
2. **Check logs frequently** - Mailgun and Render logs are your friends
3. **Use authorized email** - Sandbox requires pre-authorization
4. **Monitor trial period** - Set reminder before 30 days
5. **Plan domain purchase** - Buy domain before trial ends

---

## 📞 Support

### **Mailgun Support:**
- Documentation: https://documentation.mailgun.com
- Support: https://www.mailgun.com/support

### **If Stuck:**
- Check Mailgun logs first
- Check Render logs second
- Verify environment variables
- Test with manual upload to isolate PDF parsing

---

## 🚀 Next Steps

1. **Complete Mailgun setup** (Steps 1-6)
2. **Test email flow** (Steps 7-10)
3. **Validate with multiple PDFs**
4. **Plan production switch** (buy domain)
5. **Switch to SendGrid + domain** (before 30 days)

**Good luck with testing!** 🎉

