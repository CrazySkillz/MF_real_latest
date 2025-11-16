# 📊 William Reed → MetricMind: Visual Setup Guide

## 🎯 The Goal

**Before:** You receive William Reed reports via email → Manually copy numbers → Enter into spreadsheets

**After:** You receive William Reed reports via email → **Metrics automatically appear in MetricMind!**

---

## 📧 How It Works (Simple Version)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  📧 William Reed sends you an email with PDF report    │
│                                                         │
│  "Your Monthly Analytics Report"                       │
│  📎 Attachment: analytics-nov-2025.pdf                 │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ (You receive email as normal)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  🔄 Gmail automatically forwards to MetricMind         │
│                                                         │
│  (Happens in the background - you don't do anything)   │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ (Takes 10 seconds)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  🤖 MetricMind reads the PDF like a human would       │
│                                                         │
│  "Unique Visitors: 125,432" → Extracted!              │
│  "Pageviews: 456,789" → Extracted!                    │
│  "Open Rate: 24.5%" → Extracted!                      │
│                                                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ (Takes 20 seconds)
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  📊 Metrics appear in your MetricMind dashboard!      │
│                                                         │
│  ✅ All numbers extracted automatically               │
│  ✅ Charts and graphs updated                         │
│  ✅ Trends calculated                                 │
│  ✅ Ready to share with your team                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Setup (One-Time, 5 Minutes)

### Step 1: Get Your Magic Email Address

1. Log into MetricMind
2. Go to your campaign
3. Click "Connect Data Source" → "Custom Integration"
4. Click "Connect"
5. **Copy the email address** (looks like: `abc123@cloudmailin.net`)

```
┌──────────────────────────────────────┐
│  MetricMind Dashboard                │
├──────────────────────────────────────┤
│                                      │
│  Your Unique Email Address:          │
│                                      │
│  ┌────────────────────────────────┐ │
│  │ abc123@cloudmailin.net         │ │
│  │                                │ │
│  │ [Copy to Clipboard]            │ │
│  └────────────────────────────────┘ │
│                                      │
│  Forward William Reed reports to     │
│  this address for automatic import.  │
│                                      │
└──────────────────────────────────────┘
```

---

### Step 2: Tell Gmail to Auto-Forward

1. Open Gmail Settings
2. Create a filter:
   - **From:** `william-reed.com`
   - **Forward to:** Your magic email from Step 1

```
┌──────────────────────────────────────────────────────┐
│  Gmail Settings → Filters                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Create a new filter:                                │
│                                                      │
│  From:  [william-reed.com                    ]      │
│                                                      │
│  Has the words:  [metrics OR report          ]      │
│                                                      │
│  ✅ Forward it to: abc123@cloudmailin.net           │
│                                                      │
│  ✅ Skip the Inbox (optional)                       │
│                                                      │
│  [Create Filter]                                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

### Step 3: Test It!

1. Find your most recent William Reed email
2. Click "Forward"
3. Send to your magic email address
4. Wait 30 seconds
5. Check MetricMind → Your metrics are there! 🎉

```
┌──────────────────────────────────────────────────────┐
│  Gmail                                               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  From: William Reed <reports@william-reed.com>      │
│  Subject: Your November Analytics Report            │
│  📎 analytics-nov-2025.pdf                          │
│                                                      │
│  [Forward]  ← Click this                            │
│                                                      │
│  ┌────────────────────────────────────────────────┐ │
│  │ To: abc123@cloudmailin.net                     │ │
│  │                                                │ │
│  │ [Send]  ← Click this                          │ │
│  └────────────────────────────────────────────────┘ │
│                                                      │
└──────────────────────────────────────────────────────┘

                    ⏱️ Wait 30 seconds...

┌──────────────────────────────────────────────────────┐
│  MetricMind Dashboard                                │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ✅ New metrics imported!                           │
│                                                      │
│  📊 Unique Visitors:    125,432                     │
│  📊 Pageviews:          456,789                     │
│  📊 Avg. Time on Site:  00:02:38                    │
│  📊 Open Rate:          24.5%                       │
│  📊 Click Rate:         3.2%                        │
│                                                      │
│  [View Full Report]                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 🎉 You're Done!

From now on, every William Reed report you receive will **automatically** appear in MetricMind within 30 seconds.

### What You'll See:

```
┌────────────────────────────────────────────────────────────┐
│  Custom Integration Analytics                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  📈 Traffic Trends                                         │
│                                                            │
│     150K ┤                                          ╭──    │
│          │                                    ╭────╯       │
│     100K ┤                          ╭────────╯             │
│          │                    ╭────╯                       │
│      50K ┤          ╭────────╯                             │
│          │    ╭────╯                                       │
│        0 ┴────┴────┴────┴────┴────┴────┴────┴────┴────    │
│          Oct  Nov  Dec  Jan  Feb  Mar  Apr  May  Jun      │
│                                                            │
│  📊 Latest Metrics (Nov 2025)                             │
│                                                            │
│  Unique Visitors        125,432  ↑ 12% from last month   │
│  Pageviews              456,789  ↑ 8% from last month    │
│  Avg. Session Duration  00:02:38 ↑ 5% from last month    │
│  Bounce Rate            42.3%    ↓ 3% from last month    │
│                                                            │
│  📧 Email Performance                                      │
│                                                            │
│  Open Rate              24.5%    ↑ 2% from last month    │
│  Click-Through Rate     3.2%     ↑ 0.5% from last month  │
│  Subscriber Growth      +1,234   ↑ 15% from last month   │
│                                                            │
│  🔄 Last Updated: 2 minutes ago                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## ❓ Common Questions

### **"Will I still receive the emails?"**

**Yes!** The emails are just forwarded, not moved. You'll still get them in your inbox unless you chose "Skip the Inbox" in the filter.

---

### **"What if I have multiple William Reed properties?"**

Create a separate campaign in MetricMind for each property. Each gets its own magic email address.

```
Campaign 1 (Brand A) → abc123@cloudmailin.net
Campaign 2 (Brand B) → def456@cloudmailin.net
Campaign 3 (Brand C) → ghi789@cloudmailin.net
```

Then create separate Gmail filters for each:
- Filter 1: Subject contains "Brand A" → Forward to abc123@cloudmailin.net
- Filter 2: Subject contains "Brand B" → Forward to def456@cloudmailin.net
- Filter 3: Subject contains "Brand C" → Forward to ghi789@cloudmailin.net

---

### **"Can I manually upload a report if needed?"**

**Absolutely!** Just drag-and-drop any PDF into MetricMind:

```
┌──────────────────────────────────────┐
│  Custom Integration                  │
├──────────────────────────────────────┤
│                                      │
│  📤 Upload PDF Report                │
│                                      │
│  ┌────────────────────────────────┐ │
│  │                                │ │
│  │   Drag & drop PDF here         │ │
│  │   or click to browse           │ │
│  │                                │ │
│  └────────────────────────────────┘ │
│                                      │
│  [Upload]                            │
│                                      │
└──────────────────────────────────────┘
```

---

### **"How do I know it's working?"**

Check the "Custom Integration" section in your campaign. You'll see:

```
┌──────────────────────────────────────┐
│  Custom Integration Status           │
├──────────────────────────────────────┤
│                                      │
│  ✅ Connected                        │
│                                      │
│  📊 Last Import: 2 minutes ago       │
│                                      │
│  📄 File: analytics-nov-2025.pdf     │
│                                      │
│  📈 Metrics Imported: 12             │
│                                      │
│  [View Analytics]                    │
│                                      │
└──────────────────────────────────────┘
```

---

## 🆘 Need Help?

### **Setup Issues?**

📧 Email: support@metricmind.com  
📞 Phone: [Your support number]  
💬 Live Chat: Available in MetricMind dashboard

### **William Reed Report Issues?**

Contact your William Reed account manager:  
🌐 https://www.william-reed.com/

---

## ✅ Quick Checklist

Print this and check off as you go:

- [ ] Logged into MetricMind
- [ ] Opened my campaign
- [ ] Connected Custom Integration
- [ ] Copied my magic email address
- [ ] Opened Gmail Settings
- [ ] Created forwarding filter
- [ ] Tested with a sample report
- [ ] Saw metrics in MetricMind
- [ ] Celebrated! 🎉

---

**Questions?** Just reply to your welcome email or contact support@metricmind.com

**Last Updated:** November 2025

