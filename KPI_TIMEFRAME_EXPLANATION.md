# KPI Timeframe Implementation

## Overview
The **Timeframe** field in KPIs defines **how often to measure progress** toward the target. It's a **static configuration field** that is **NOT automatically updated**.

---

## How It Works

### 1. **Timeframe Options**
```
- Daily (24 hours)
- Weekly (7 days)
- Monthly (30 days)
- Quarterly (90 days)
- Yearly (365 days)
```

### 2. **What Timeframe Means**
The timeframe tells you:
- **How frequently** you should check the KPI
- **The period** over which progress is measured
- **When** the target should be achieved

**Example:**
```
KPI: LinkedIn CTR Target
Target: 2.5%
Current: 2.1%
Timeframe: Monthly

Meaning: This KPI should be reviewed monthly, 
and the target of 2.5% CTR should be achieved 
within a monthly period.
```

---

## Current Implementation

### ✅ **What IS Automated:**
1. **Current Value Auto-Population**
   - When you select a metric (e.g., CTR, CPC), the current value is automatically populated from LinkedIn data
   - This happens in real-time when creating/editing a KPI

2. **Performance Calculation**
   - The system automatically calculates if you're meeting, exceeding, or below target
   - Performance badges (Excellent, Good, Fair, Poor) are auto-generated

3. **Rolling Averages**
   - 7-day and 30-day rolling averages are calculated automatically
   - Used for trend analysis

### ❌ **What IS NOT Automated:**
1. **Timeframe Field**
   - This is a **manual setting** that you choose when creating the KPI
   - It does NOT change automatically
   - It's stored in the database and remains constant unless you manually edit it

2. **Target Value**
   - You set this manually based on your goals
   - It doesn't auto-update

3. **Tracking Period**
   - Number of days to track (defaults to 30)
   - Manual setting

---

## Database Schema

```typescript
timeframe: text("timeframe").notNull().default("monthly")
// Options: 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'

trackingPeriod: integer("tracking_period").notNull().default(30)
// Number of days to track (numeric value)
```

---

## User Workflow

### Creating a KPI:
```
1. User selects Timeframe: "Monthly"
2. System saves: timeframe = "monthly"
3. KPI card displays: 🕐 Monthly
4. This setting persists until manually changed
```

### Editing a KPI:
```
1. User clicks Edit
2. Modal shows current timeframe: "Monthly"
3. User can change to "Weekly", "Quarterly", etc.
4. System updates database
5. KPI card reflects new timeframe
```

---

## Display in UI

### KPI Card:
```
┌─────────────────────────────────────────┐
│ LinkedIn CTR Target [CTR]    [active]   │
│ Monitor click-through rate              │
│                                         │
│ Current: 2.1%    Target: 2.5%          │
│ 🟡 Fair         16% below target        │
│ 🕐 Monthly      ← Timeframe displayed   │
└─────────────────────────────────────────┘
```

The timeframe is displayed with a clock icon at the bottom of the KPI card.

---

## Why Timeframe is Manual (Not Automated)

### Business Reasons:
1. **Strategic Decision**: Timeframe is a business goal, not a metric
2. **Varies by KPI**: Different KPIs have different review cycles
3. **Organizational Alignment**: Should match reporting cycles
4. **Stability**: Shouldn't change without deliberate decision

### Examples:
```
✓ CTR Target: Monthly (aligns with campaign reviews)
✓ ROI Target: Quarterly (aligns with business quarters)
✓ Lead Generation: Weekly (fast-paced sales cycle)
✓ Brand Awareness: Yearly (long-term strategy)
```

---

## Related Fields

### 1. **Tracking Period** (trackingPeriod)
- Numeric value (e.g., 30 days)
- Used for rolling average calculations
- Also manual, not auto-updated

### 2. **Rolling Average** (rollingAverage)
- Options: '1day', '7day', '30day', 'none'
- Used for smoothing out daily fluctuations
- Manual setting

### 3. **Target Date** (targetDate)
- Optional deadline for achieving the target
- Manual setting
- Used for deadline alerts

---

## Future Enhancement Ideas

If you wanted to add automation in the future:

### 1. **Auto-Reminder System**
```
If timeframe = "monthly"
→ Send reminder on 1st of each month to review KPI
```

### 2. **Auto-Reset Current Value**
```
If timeframe = "weekly" and new week starts
→ Option to reset current value to 0 (for cumulative metrics)
```

### 3. **Timeframe-Based Alerts**
```
If timeframe = "quarterly" and end of quarter approaching
→ Send alert if target not on track
```

### 4. **Smart Timeframe Suggestions**
```
Based on metric type:
- CTR, CPC → Suggest "Weekly" or "Monthly"
- ROI, ROAS → Suggest "Monthly" or "Quarterly"
- Brand metrics → Suggest "Quarterly" or "Yearly"
```

---

## Summary

| Aspect | Status | Notes |
|--------|--------|-------|
| **Timeframe Selection** | Manual | User chooses from dropdown |
| **Timeframe Storage** | Database | Persists until manually changed |
| **Timeframe Display** | Automatic | Shows on KPI card with clock icon |
| **Current Value** | Auto-Updated | Pulled from LinkedIn metrics |
| **Performance Calculation** | Auto-Updated | Based on current vs target |
| **Timeframe Changes** | Manual Edit | User must edit KPI to change |

---

## Key Takeaway

**The Timeframe is a configuration setting, not a dynamic metric.**

Think of it like:
- ✅ **Metric Type** (CTR, CPC) → What you're measuring
- ✅ **Target Value** (2.5%) → What you want to achieve
- ✅ **Timeframe** (Monthly) → When/how often to review
- ✅ **Current Value** (2.1%) → Auto-updated from data

The timeframe tells the system and users **"This KPI should be reviewed monthly"**, but it doesn't automatically change the review period or reset values.

---

**Status**: Current Implementation
**Type**: Manual Configuration Field
**Auto-Update**: No (by design)

