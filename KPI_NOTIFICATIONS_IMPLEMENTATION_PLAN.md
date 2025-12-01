# KPI In-App Notifications - Implementation Plan

## **Approved: Phase 1 - In-App Notifications Only**

**Effort:** 2-3 days
**Complexity:** LOW
**Value:** HIGH

---

## **What We're Building:**

### **1. Notification Types**

#### **A) Monthly Reminder**
```
Trigger: 1st of each month (for monthly KPIs)
Title: "Time to Review: [KPI Name]"
Message: "Your monthly KPI review is due. Current: X, Target: Y"
Type: info
Priority: normal
```

#### **B) Performance Alert**
```
Trigger: Current value goes below alert threshold
Title: "KPI Alert: [KPI Name]"
Message: "Current value (X) is below your alert threshold (Y)"
Type: warning
Priority: high
```

#### **C) Period Complete**
```
Trigger: End of month (last day)
Title: "Period Complete: [KPI Name]"
Message: "March 2024 ended. Final: X, Target: Y (Achieved/Missed)"
Type: success/warning
Priority: normal
```

---

## **Implementation Steps:**

### **Step 1: Update KPI Modal** (30 min)
- Change "Enable Email Alerts" → "Enable Alerts & Reminders"
- Update label and description
- Keep existing fields (threshold, condition, recipients for future use)

### **Step 2: Create Notification Helper Functions** (2 hours)
- `createKPIReminder(kpi)` - Monthly reminder
- `createKPIAlert(kpi)` - Performance alert
- `createPeriodComplete(kpi, snapshot)` - End of period
- `getKPIActionUrl(kpiId)` - Generate link to KPI

### **Step 3: Implement Scheduler** (4 hours)
- Daily job that runs at midnight
- Check for monthly reminders (1st of month)
- Check for performance alerts (threshold breaches)
- Check for period end (last day of month)

### **Step 4: Period Tracking** (4 hours)
- Create `kpi_periods` table
- Implement snapshot capture at end of period
- Store: final value, target, achieved, change from previous

### **Step 5: Update KPI Cards** (3 hours)
- Add "Previous Period" section
- Show period comparison
- Display countdown (X days remaining)

### **Step 6: Enhance Notifications Page** (2 hours)
- Add KPI-specific filters
- Add [View KPI →] action button
- Test notification clicking and navigation

### **Step 7: Testing** (3 hours)
- Test reminder creation
- Test alert triggering
- Test period snapshots
- Test notification navigation
- Test all timeframes (daily, weekly, monthly, quarterly)

---

## **Total Effort: 18.5 hours (~2.5 days)**

---

## **Database Changes:**

### **New Table: kpi_periods**
```sql
CREATE TABLE kpi_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id TEXT NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL, -- 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  period_label TEXT NOT NULL, -- 'March 2024', 'Q1 2024', 'Week 12 2024'
  
  final_value DECIMAL(10, 2) NOT NULL,
  target_value DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  
  target_achieved BOOLEAN NOT NULL,
  performance_percentage DECIMAL(5, 2),
  
  previous_period_value DECIMAL(10, 2),
  change_amount DECIMAL(10, 2),
  change_percentage DECIMAL(5, 2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_kpi_periods_kpi_id ON kpi_periods(kpi_id);
```

### **Update Notifications Table (Already Exists)**
```sql
-- Add metadata field if not exists
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Metadata will store:
-- { kpiId, alertType, actionUrl }
```

---

## **Code Structure:**

```
server/
  ├── kpi-scheduler.ts (NEW)
  │   ├── checkMonthlyReminders()
  │   ├── checkPerformanceAlerts()
  │   ├── captureEndOfPeriod()
  │   └── runDailyKPIJobs()
  │
  ├── kpi-notifications.ts (NEW)
  │   ├── createKPIReminder()
  │   ├── createKPIAlert()
  │   ├── createPeriodComplete()
  │   └── getKPIActionUrl()
  │
  └── index.ts (UPDATE)
      └── Start scheduler on server startup

client/src/pages/
  ├── linkedin-analytics.tsx (UPDATE)
  │   ├── Change label to "Enable Alerts & Reminders"
  │   ├── Add period comparison to KPI cards
  │   └── Add countdown display
  │
  └── notifications.tsx (UPDATE)
      ├── Add KPI filter
      └── Add [View KPI →] button with navigation
```

---

## **User Journey (Final Result):**

### **Day 1 (March 1st):**
1. User logs into platform
2. Sees notification badge (🔔 1)
3. Clicks bell → Notifications page
4. Sees: "Time to Review: LinkedIn CTR Target"
5. Clicks [View KPI →]
6. Reviews KPI with period comparison

### **Day 15 (Mid-Month):**
1. User logs in
2. Sees notification (🔔 1)
3. Sees: "KPI Alert: LinkedIn CTR Target - Below threshold"
4. Clicks [View KPI →]
5. Takes action to improve

### **Day 31 (End of Month):**
1. System automatically captures snapshot
2. Creates notification: "Period Complete: March 2024"
3. User sees summary next time they log in

### **Day 32 (April 1st):**
1. New reminder notification
2. KPI card now shows March in "Previous Period"
3. Cycle repeats

---

## **Success Metrics:**

- ✅ Notifications created automatically
- ✅ User can click to view KPI
- ✅ Period comparison shows on KPI cards
- ✅ No manual intervention needed
- ✅ Works for all timeframes (daily, weekly, monthly, quarterly)

---

## **Future Enhancements (Phase 2):**

1. Email notifications (3-4 days)
2. Slack integration (2-3 days)
3. Custom reminder schedules (1-2 days)
4. Trend analysis alerts (2-3 days)
5. Forecasting (3-4 days)

---

## **Ready to Start Implementation!**

**Estimated Completion:** 2-3 days
**Start Date:** Now
**End Date:** ~3 days from now

Let's build this! 🚀

