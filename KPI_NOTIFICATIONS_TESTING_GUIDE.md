# KPI Notifications - Testing Guide

## Overview
This guide explains how to test the complete KPI notifications and period tracking feature.

---

## **Test Mode: Quick Setup**

### **Step 1: Run Test Script**

The test script will automatically:
- Create period snapshots for all your active KPIs
- Generate test notifications (reminders, alerts, period complete)
- Populate the Notifications page with sample data

```bash
# Make sure you have active KPIs first!
# Then run:
npx tsx test-kpi-notifications.ts
```

**What it does:**
1. Finds all active KPIs
2. Creates "previous month" period snapshots
3. Generates 2-3 notifications per KPI:
   - Monthly reminder
   - Performance alert (if below target)
   - Period complete summary

---

### **Step 2: View Results**

#### **A) Check KPI Cards:**
1. Go to **LinkedIn Analytics → KPIs tab**
2. Look for **"Previous Period"** section on each KPI card
3. You should see:
   ```
   Previous Period (November 2024)
   Final: 2.6%      Target: 2.5%
   ✓ Target Achieved    ↑ 12.5% vs previous
   ```

#### **B) Check Notifications:**
1. Click **bell icon (🔔)** in left navigation
2. You should see multiple notifications:
   - 🔔 "Time to Review: [KPI Name]"
   - ⚠️ "KPI Alert: [KPI Name]"
   - 📊 "Period Complete: [KPI Name]"

#### **C) Test Navigation:**
1. Click **[View KPI →]** button on any notification
2. Should navigate to LinkedIn Analytics → KPIs tab
3. Notification should be marked as read

---

## **Manual Testing (Without Script)**

If you prefer to test manually without running the script:

### **Test 1: Create a KPI**
1. Go to LinkedIn Analytics → KPIs tab
2. Click "Create KPI"
3. Fill in:
   - Name: "Test CTR KPI"
   - Metric: CTR
   - Target: 2.5
   - Current: (auto-filled)
   - Timeframe: Monthly
   - ☑ Enable Alerts & Reminders
   - Alert Threshold: 2.0
4. Click "Create KPI"

**Expected Result:**
- KPI card appears
- Shows "Period tracking active" message (no previous period yet)
- Scheduler will create notifications automatically

### **Test 2: Wait for Scheduler**
The scheduler runs:
- **Immediately on server startup** (for testing)
- **Daily at midnight** (production)

**What happens:**
- If today is 1st of month → Reminder notification created
- If current value < alert threshold → Alert notification created
- If end of month → Period snapshot + Period complete notification

### **Test 3: Simulate End of Month**
To test without waiting for end of month, use the test script (Step 1 above).

---

## **Production Testing Timeline**

### **Day 1 (Today):**
- Create KPI with alerts enabled
- KPI card shows "Period tracking active"
- No notifications yet (unless today is 1st of month)

### **Day 2-30:**
- Scheduler runs daily at midnight
- If current value drops below threshold → Alert notification
- No period comparison yet (first period still ongoing)

### **Day 31 (End of Month):**
- Scheduler captures period snapshot
- Creates "Period Complete" notification
- Notification appears in Notifications page

### **Day 32 (Next Month - 1st):**
- Scheduler sends "Monthly Reminder" notification
- KPI card NOW shows "Previous Period" section
- Can see last month's performance vs this month

---

## **What Each Notification Type Looks Like**

### **1. Monthly Reminder (1st of Month)**
```
┌─────────────────────────────────────────┐
│ 🔔 Time to Review: LinkedIn CTR Target  │
│ Just now                        [Normal]│
│                                         │
│ Your monthly KPI review is due.        │
│ Current: 2.1%, Target: 2.5%           │
│                                         │
│ [View KPI →]  [✓]  [×]                 │
└─────────────────────────────────────────┘
```

### **2. Performance Alert (When Below Threshold)**
```
┌─────────────────────────────────────────┐
│ ⚠️ KPI Alert: LinkedIn CTR Target       │
│ 2 hours ago                       [High]│
│                                         │
│ Current value (2.0%) is 20% below your │
│ target (2.5%). Alert threshold: 2.0%   │
│                                         │
│ [View KPI →]  [✓]  [×]                 │
└─────────────────────────────────────────┘
```

### **3. Period Complete (End of Month)**
```
┌─────────────────────────────────────────┐
│ 📊 Period Complete: LinkedIn CTR Target │
│ Just now                        [Normal]│
│                                         │
│ March 2024 ended.                      │
│ Final: 2.0%, Target: 2.5%             │
│ ✗ Target Missed (↓ 19% from previous) │
│                                         │
│ [View KPI →]  [✓]  [×]                 │
└─────────────────────────────────────────┘
```

### **4. Trend Alert (3+ Consecutive Declines)**
```
┌─────────────────────────────────────────┐
│ 📉 Trend Alert: LinkedIn CTR Target     │
│ Just now                          [High]│
│                                         │
│ This KPI has been declining for 3      │
│ consecutive periods.                    │
│ Current: 2.0%, Target: 2.5%           │
│                                         │
│ [View KPI →]  [✓]  [×]                 │
└─────────────────────────────────────────┘
```

---

## **KPI Card with Period Comparison**

### **Before (No Period Data):**
```
┌─────────────────────────────────────────┐
│ LinkedIn CTR Target [CTR]    [active]   │
│                                         │
│ Current: 2.1%    Target: 2.5%         │
│ 🟡 Fair - 16% below target             │
│ 🕐 Monthly                              │
│ ─────────────────────────────────────  │
│ Period tracking active. Historical     │
│ comparison will appear after first     │
│ monthly period completes.              │
└─────────────────────────────────────────┘
```

### **After (With Period Data):**
```
┌─────────────────────────────────────────┐
│ LinkedIn CTR Target [CTR]    [active]   │
│                                         │
│ Current: 2.1%    Target: 2.5%         │
│ 🟡 Fair - 16% below target             │
│ 🕐 Monthly                              │
│ ─────────────────────────────────────  │
│ Previous Period (February 2024)        │
│ Final: 2.6%      Target: 2.5%         │
│ ✓ Target Achieved    ↓ 19.2% vs prev  │
└─────────────────────────────────────────┘
```

---

## **Testing Checklist**

### **✅ KPI Creation:**
- [ ] Create KPI with "Enable Alerts & Reminders" checked
- [ ] Verify label says "Enable Alerts & Reminders" (not "Enable Email Alerts")
- [ ] Verify helper text mentions "in-app notifications"

### **✅ Period Tracking:**
- [ ] Run test script to create period snapshots
- [ ] Verify "Previous Period" section appears on KPI cards
- [ ] Verify previous values are displayed correctly
- [ ] Verify achievement badge (✓/✗) shows correctly
- [ ] Verify trend indicator (↑↓) shows correctly
- [ ] Verify change percentage is accurate

### **✅ Notifications:**
- [ ] Run test script to create notifications
- [ ] Click bell icon in left navigation
- [ ] Verify notifications appear
- [ ] Verify [View KPI →] button is visible
- [ ] Click [View KPI →] button
- [ ] Verify navigation to LinkedIn Analytics → KPIs tab
- [ ] Verify notification is marked as read

### **✅ Scheduler (Production):**
- [ ] Wait for 1st of month (or run script)
- [ ] Verify reminder notifications are created
- [ ] Wait for end of month
- [ ] Verify period snapshot is captured
- [ ] Verify period complete notification is created
- [ ] Verify next month shows previous period comparison

---

## **Troubleshooting**

### **Problem: No period data showing on KPI cards**
**Solution:**
- Run the test script: `npx tsx test-kpi-notifications.ts`
- This creates historical period data immediately
- Refresh the page

### **Problem: No [View KPI →] button in notifications**
**Solution:**
- Check notification metadata (should contain kpiId and actionUrl)
- Run test script to create properly formatted notifications
- Check browser console for JSON parsing errors

### **Problem: Scheduler not running**
**Solution:**
- Check server logs for "KPI scheduler started successfully"
- Scheduler runs 5 seconds after server startup
- Check for migration errors in logs

### **Problem: Notifications not appearing**
**Solution:**
- Verify KPI has alertsEnabled = true
- Check database: `SELECT * FROM notifications;`
- Run test script to generate test notifications
- Hard refresh browser (Ctrl+Shift+R)

---

## **Database Queries for Debugging**

### **Check Period Snapshots:**
```sql
SELECT 
  kp.period_label,
  k.name as kpi_name,
  kp.final_value,
  kp.target_value,
  kp.target_achieved,
  kp.change_percentage,
  kp.trend_direction
FROM kpi_periods kp
JOIN kpis k ON k.id = kp.kpi_id
ORDER BY kp.period_end DESC;
```

### **Check Notifications:**
```sql
SELECT 
  title,
  message,
  type,
  priority,
  read,
  metadata,
  created_at
FROM notifications
WHERE metadata IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### **Check KPI Alert Settings:**
```sql
SELECT 
  name,
  metric,
  current_value,
  target_value,
  timeframe,
  alerts_enabled,
  alert_threshold,
  status
FROM kpis
WHERE status = 'active';
```

---

## **Expected Behavior Summary**

| Event | Trigger | Notification | Period Data |
|-------|---------|--------------|-------------|
| **Create KPI** | User action | None | Tracking starts |
| **1st of Month** | Scheduler | Reminder | None yet |
| **Below Threshold** | Scheduler | Alert | None yet |
| **End of Month** | Scheduler | Period Complete | Snapshot created |
| **Next Month** | View KPI card | None | Previous period shows |

---

## **Success Criteria**

✅ **Feature is working if:**
1. Period snapshots are created at end of month
2. Notifications appear in Notifications page
3. [View KPI →] button navigates correctly
4. Previous period shows on KPI cards
5. Trend indicators are accurate
6. Achievement badges are correct

---

## **Quick Test (5 Minutes)**

```bash
# 1. Run test script
npx tsx test-kpi-notifications.ts

# 2. Open browser
# 3. Go to LinkedIn Analytics → KPIs tab
# 4. Verify period comparison appears
# 5. Click bell icon
# 6. Verify notifications appear
# 7. Click [View KPI →]
# 8. Verify navigation works

# Done! ✅
```

---

**Ready to test!** 🚀

