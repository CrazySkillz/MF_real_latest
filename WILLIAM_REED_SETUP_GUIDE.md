# William Reed Metrics - Automated Import Setup

## 🎯 Overview

This guide helps you automatically import William Reed metrics reports from email into MetricMind with **zero manual work**.

---

## 📧 **Setup Steps** (5 minutes)

### **Step 1: Get Your Webhook URL**

1. Go to your campaign in MetricMind
2. Click **"Connect Data Source"** → **"Custom Integration"**
3. Click **"Connect"** button
4. Copy your unique webhook URL (looks like):
   ```
   https://mforensics.onrender.com/api/webhook/custom-integration/abc123xyz
   ```

---

### **Step 2: Set Up CloudMailin** (Free Plan Available)

#### **2.1 Create CloudMailin Account**
1. Go to [CloudMailin.com](https://www.cloudmailin.com/)
2. Sign up (free plan: 10 emails/day, $9/month for 1000/day)
3. Create a new email address

#### **2.2 Configure CloudMailin to Forward to MetricMind**

1. In CloudMailin dashboard, click **"Edit Target"**
2. Set **Target URL** to your webhook URL from Step 1
3. Set **Format** to: `Multipart (Attachments)`
4. Set **HTTP Method** to: `POST`
5. **Enable** "Attachment Store" (so PDFs are accessible)
6. Click **"Save"**

#### **2.3 Configure Email Forwarding**

**Option A: Gmail Auto-Forward** (Recommended)
1. Open Gmail settings → **Forwarding and POP/IMAP**
2. Click **"Add a forwarding address"**
3. Enter your CloudMailin email address (e.g., `abc123@cloudmailin.net`)
4. Verify the forwarding address
5. Create a Gmail filter:
   - From: `*@william-reed.com`
   - Subject: Contains `metrics` OR `report` OR `performance`
   - Action: **Forward to** your CloudMailin address
   - ✅ **Skip Inbox** (optional, keeps inbox clean)

**Option B: Outlook Auto-Forward**
1. Settings → **Mail** → **Forwarding**
2. Enable forwarding to your CloudMailin address
3. Create rule:
   - From: `william-reed.com`
   - Forward to: CloudMailin address

---

### **Step 3: Test the Setup**

1. Forward a William Reed PDF report email to your CloudMailin address
2. Wait 10-30 seconds
3. Check MetricMind → Your Campaign → **Custom Integration Analytics**
4. You should see the imported metrics! 🎉

---

## 🔄 **How It Works (Behind the Scenes)**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. William Reed sends report to client@company.com         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Gmail auto-forwards to abc123@cloudmailin.net           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. CloudMailin extracts PDF attachment                      │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CloudMailin POSTs PDF to MetricMind webhook              │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. MetricMind parses PDF (William Reed-specific patterns)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Metrics appear in dashboard automatically! ✅            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **What Metrics Are Extracted?**

The parser automatically detects and imports:

### **Audience & Traffic**
- Users (unique visitors)
- Sessions
- Pageviews
- Avg. Session Duration
- Pages per Session
- Bounce Rate

### **Traffic Sources**
- Organic Search %
- Direct/Branded %
- Email %
- Referral/Partners %
- Paid (Display/Search) %
- Social %

### **Email Performance** (if included)
- Emails Delivered
- Open Rate
- Click-Through Rate (CTR)
- Click-to-Open Rate (CTOR)
- Hard Bounces
- Spam Complaints
- List Growth

### **Campaign Metrics**
- Impressions
- Clicks
- Conversions
- Spend
- Reach
- Engagements

---

## 🔧 **Troubleshooting**

### **"Metrics not appearing"**
1. Check CloudMailin dashboard → **"Message Log"** to see if email was received
2. Check MetricMind webhook logs (contact support)
3. Verify PDF format matches expected structure

### **"Some metrics are missing"**
- William Reed reports vary by subscription tier
- Parser extracts all available metrics
- Missing values show as "0" or "-"

### **"Duplicate imports"**
- Each email creates a new metrics snapshot
- You can delete duplicates in MetricMind dashboard

---

## 💡 **Pro Tips**

1. **Set up email filters** to auto-archive William Reed reports after forwarding
2. **Use CloudMailin's "Attachment Store"** to keep PDFs accessible for 30 days
3. **Schedule reports** from William Reed to arrive at consistent times
4. **Create separate campaigns** for different William Reed properties/brands

---

## 📞 **Support**

- CloudMailin Setup: [CloudMailin Docs](https://docs.cloudmailin.com/)
- MetricMind Support: support@metricmind.com
- William Reed Reports: Check your William Reed account manager

---

## 🚀 **Alternative: Manual Upload**

If you prefer not to use email forwarding:

1. Download William Reed PDF from email
2. Go to MetricMind → Campaign → **Custom Integration**
3. Click **"Upload PDF"**
4. Drag and drop the PDF file
5. Metrics imported instantly! ✅

---

## 📈 **Cost Breakdown**

| Service | Free Tier | Paid Plan |
|---------|-----------|-----------|
| **MetricMind** | Included | - |
| **CloudMailin** | 10 emails/day | $9/mo (1000/day) |
| **Gmail Forwarding** | Free | Free |

**Estimated Cost:** $0-9/month depending on report frequency

---

## ✅ **Checklist**

- [ ] Created campaign in MetricMind
- [ ] Connected Custom Integration
- [ ] Copied webhook URL
- [ ] Created CloudMailin account
- [ ] Configured CloudMailin target URL
- [ ] Set up Gmail auto-forwarding
- [ ] Created Gmail filter for William Reed emails
- [ ] Tested with sample report
- [ ] Verified metrics in MetricMind dashboard

---

**Last Updated:** November 2025

