# 🧪 Testing Custom Integration PDF Upload

## Quick Test Guide

### **Step 1: Create Test PDF**

1. Open `test-sample-metrics.txt` (in this folder)
2. Copy all the content
3. Paste into **Microsoft Word** or **Google Docs**
4. **Format the tables** (the markdown tables should auto-format)
   - Or: Copy into Excel, then copy formatted tables to Word
5. **Save as PDF** → Name it `test-metrics-report.pdf`

**Pro Tip:** The test file uses **table format** (like professional analytics reports) which is the most common format you'll encounter.

**Alternative:** Use any existing PDF report you have with metrics in table format.

---

### **Step 2: Test the Upload Flow**

#### **2.1 Start Campaign Creation**

1. Go to: https://mforensics.onrender.com
2. Navigate to **Campaign Management**
3. Click **"+ New Campaign"**
4. Fill in campaign details:
   - Name: `Test PDF Upload Campaign`
   - Budget: `5000`
   - Currency: `USD`
   - (Other fields optional)
5. Click **"Next"** or **"Continue"**

#### **2.2 Connect Custom Integration**

1. In the "Connect Data Sources" step
2. Find **"Custom Integration"** card
3. Click **"Connect"**
4. Modal opens with 2 options

#### **2.3 Upload PDF**

1. Click **"① Manual Upload (Recommended)"**
2. File picker opens automatically
3. Select your `test-metrics-report.pdf`
4. Wait for upload (should take 5-10 seconds)

**Expected Result:**
```
✅ Toast notification appears:
"PDF Uploaded Successfully!
Metrics extracted with XX% confidence"
```

**If confidence < 95%:**
```
⚠️ Toast notification:
"PDF Uploaded - Please Review
Confidence: XX%"
```

#### **2.4 Create Campaign**

1. Modal closes automatically after upload
2. Click **"Create Campaign with 1 platform"** button
3. Wait for campaign creation (2-3 seconds)

**Expected Result:**
```
✅ Campaign created
✅ Redirects to Campaign Management page
✅ New campaign appears in list
```

---

### **Step 3: Verify Connection Status**

1. Find your new campaign in the list
2. Click on the campaign name
3. Campaign Detail page opens

**Expected Result:**
```
Connected Platforms section shows:

Custom Integration
├─ ✅ Blue "Connected" badge
└─ 🔗 "View Detailed Analytics" link
```

---

### **Step 4: View Parsed Metrics**

1. Click **"View Detailed Analytics"** under Custom Integration
2. Custom Integration Analytics page opens

**Expected Metrics Display:**

```
📊 Custom Integration Analytics

Summary Cards:
├─ Users: 1,275,432
├─ Sessions: 1,980,120
├─ Pageviews: 4,050,980
└─ Bounce Rate: 41.2%

Traffic Sources Chart:
├─ Organic Search: 39%
├─ Direct / Branded: 26%
├─ Email: 14%
├─ Referral: 11%
├─ Paid: 7%
└─ Social: 3%

Email Performance:
├─ Delivered: 1,870,420
├─ Open Rate: 25.1%
├─ CTR: 4.1%
├─ CTOR: 16.3%
├─ Hard Bounces: 0.35%
├─ Spam Complaints: 0.08%
└─ List Growth: +2,450
```

---

## 🔍 What to Check

### **✅ Accuracy Checklist**

Compare the displayed metrics with your PDF:

- [ ] **Users/Visitors** - Should match exactly
- [ ] **Sessions** - Should match exactly
- [ ] **Pageviews** - Should match exactly
- [ ] **Bounce Rate** - Should match (as percentage)
- [ ] **Traffic Sources** - All percentages correct
- [ ] **Email Metrics** - Open rate, CTR, etc.
- [ ] **Campaign Metrics** - Impressions, clicks, spend

### **✅ Confidence Score**

Check the toast notification confidence score:

- **95-100%**: ✅ Excellent - All metrics extracted correctly
- **90-94%**: ⚠️ Good - Most metrics correct, minor issues
- **85-89%**: ⚠️ Fair - Some metrics may be missing
- **< 85%**: ❌ Poor - Manual review required

### **✅ Validation Warnings**

If you see warnings in the logs (check browser console):

```javascript
// Open browser DevTools (F12)
// Look for these messages:

[PDF Parser] Confidence: 98%
[PDF Parser] Extracted: 15 / 30 fields
[PDF Parser] ⚠️  Warnings: [...]
```

**Common Warnings:**
- `"Missing required metrics: pageviews"` - Field not found in PDF
- `"Bounce rate out of range"` - Value validation failed
- `"Low extraction rate (40%)"` - Many fields not detected

---

## 🐛 Troubleshooting

### **Issue: "Upload Failed"**

**Possible Causes:**
1. PDF file is corrupted
2. PDF is scanned image (no text)
3. File size too large (> 10MB)
4. Network error

**Solution:**
- Try a different PDF
- Ensure PDF has selectable text (not just an image)
- Check browser console for errors

---

### **Issue: Confidence < 90%**

**Possible Causes:**
1. PDF format doesn't match expected patterns
2. Metrics have unusual labels
3. PDF has complex layout

**Solution:**
- Check which metrics were extracted (browser console)
- Verify PDF has clear "Metric: Value" format
- Consider using CSV export instead (100% accuracy)

---

### **Issue: Some Metrics Missing**

**Possible Causes:**
1. Metric labels don't match patterns
2. Values in unexpected format
3. Metrics in tables vs. plain text

**What to Check:**
```javascript
// Browser console will show:
[PDF Parser] ✅ users → users = 125432
[PDF Parser] ✅ sessions → sessions = 234567
[PDF Parser] ⚠️  Unknown metric: "Page Views" (should be "Pageviews")
```

**Solution:**
- Adjust PDF to use standard metric names
- Or: Use email forwarding for consistent format
- Or: Request CSV export from provider (100% accuracy)

---

### **Issue: "View Detailed Analytics" Not Showing**

**Possible Causes:**
1. Campaign not created yet
2. Connection transfer failed
3. Page cache issue

**Solution:**
1. Refresh the page (Ctrl+R or Cmd+R)
2. Check browser console for transfer errors
3. Verify campaign was created successfully

---

## 📊 Testing Different PDF Formats

### **Format 1: Table Format (Most Common)** ⭐ **RECOMMENDED**
```
| Metric    | This Period | Previous Period |
|-----------|-------------|-----------------|
| Users     | 1,275,432   | 1,210,000       |
| Sessions  | 1,980,120   | 1,900,450       |
```
**Expected Confidence:** 90-100%
**This is the format used in the test file and most professional reports**

### **Format 2: Key-Value**
```
Metric Name: Value
Users: 1,275,432
Sessions: 1,980,120
```
**Expected Confidence:** 95-100%

### **Format 3: Inline Text**
```
This month we had 1,275,432 users and 1,980,120 sessions.
```
**Expected Confidence:** 70-85%

---

## 🎯 Success Criteria

Your test is successful if:

1. ✅ PDF uploads without errors
2. ✅ Confidence score ≥ 95%
3. ✅ Campaign appears in Campaign Management
4. ✅ Blue "Connected" badge shows
5. ✅ "View Detailed Analytics" link works
6. ✅ All major metrics display correctly
7. ✅ Values match your PDF exactly

---

## 📞 If Something Goes Wrong

### **Check Render Logs:**

1. Go to: https://dashboard.render.com
2. Select your service
3. Click **"Logs"**
4. Search for:
   - `[Webhook]` - Upload activity
   - `[PDF Parser]` - Parsing results
   - `[Custom Integration Transfer]` - Connection transfer

### **Check Browser Console:**

1. Press F12 (Windows) or Cmd+Option+I (Mac)
2. Go to **"Console"** tab
3. Look for errors or warnings
4. Copy any error messages

### **Common Log Messages:**

**Success:**
```
[PDF Parser] ✅ Validation complete
[PDF Parser] Confidence: 98%
[PDF Parser] Extracted: 15 / 30 fields
[Webhook] Metrics stored successfully
[Custom Integration Transfer] Transfer complete
```

**Warnings:**
```
[PDF Parser] ⚠️  WARNING: Low extraction rate (40%)
[PDF Parser] ⚠️  WARNING: Missing required metrics: pageviews
```

**Errors:**
```
[PDF Parser] ❌ CRITICAL: Users cannot be negative
[Webhook] Error processing PDF: Failed to parse PDF document
```

---

## 💡 Pro Tips

1. **Use consistent PDF format** - Same provider, same template = higher accuracy
2. **Check confidence score** - If < 95%, review the data
3. **Test with real PDFs** - Use actual reports from your provider
4. **Compare with source** - Verify a few key metrics manually
5. **Report issues** - If accuracy is low, share the PDF format for improvements

---

**Ready to test?** Follow the steps above and let me know the results! 🚀

