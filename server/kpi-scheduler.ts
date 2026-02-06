import { db } from "./db";
import { kpis, kpiPeriods } from "../shared/schema";
import { eq, and, lt, desc } from "drizzle-orm";
import type { KPI, InsertKPIPeriod } from "../shared/schema";
import {
  createKPIReminder,
  createKPIAlert,
  createPeriodComplete,
  createTrendAlert,
  shouldTriggerAlert
} from "./kpi-notifications";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";

/**
 * KPI Scheduler - Daily Jobs
 * Runs automated checks for KPI notifications and period tracking
 */

/**
 * Check if today is the first day of the month
 */
function isFirstOfMonth(): boolean {
  const today = new Date();
  return today.getDate() === 1;
}

/**
 * Check if today is the last day of the month
 */
function isLastOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

/**
 * Check if today is the first day of the week (Monday)
 */
function isFirstOfWeek(): boolean {
  const today = new Date();
  return today.getDay() === 1; // Monday
}

/**
 * Check if today is the last day of the week (Sunday)
 */
function isLastOfWeek(): boolean {
  const today = new Date();
  return today.getDay() === 0; // Sunday
}

/**
 * Check if today is the last day of the quarter
 */
function isLastOfQuarter(): boolean {
  const today = new Date();
  const month = today.getMonth();
  const lastDayOfMonth = new Date(today.getFullYear(), month + 1, 0).getDate();
  
  // Last day of Mar (2), Jun (5), Sep (8), Dec (11)
  return [2, 5, 8, 11].includes(month) && today.getDate() === lastDayOfMonth;
}

/**
 * Get period label for display
 */
function getPeriodLabel(date: Date, timeframe: string): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  switch (timeframe) {
    case 'daily':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    case 'weekly':
      const weekNum = Math.ceil(date.getDate() / 7);
      return `Week ${weekNum}, ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    case 'monthly':
      return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `Q${quarter} ${date.getFullYear()}`;
    case 'yearly':
      return `${date.getFullYear()}`;
    default:
      return date.toLocaleDateString();
  }
}

/**
 * Calculate period start and end dates
 */
function getPeriodDates(timeframe: string): { start: Date; end: Date } {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);
  
  switch (timeframe) {
    case 'daily':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'weekly':
      // Start of week (Monday)
      const dayOfWeek = today.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start.setDate(today.getDate() + diffToMonday);
      start.setHours(0, 0, 0, 0);
      // End of week (Sunday)
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'monthly':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'quarterly':
      const currentQuarter = Math.floor(today.getMonth() / 3);
      start.setMonth(currentQuarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(currentQuarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yearly':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }
  
  return { start, end };
}

/**
 * Calculate performance level based on percentage
 */
function calculatePerformanceLevel(percentage: number): string {
  if (percentage >= 100) return 'excellent';
  if (percentage >= 90) return 'good';
  if (percentage >= 75) return 'fair';
  return 'poor';
}

/**
 * Check and send monthly reminders
 */
export async function checkMonthlyReminders(): Promise<void> {
  if (!isFirstOfMonth()) {
    return;
  }

  console.log('[KPI Scheduler] Checking monthly reminders...');

  try {
    const monthlyKPIs = await db.select()
      .from(kpis)
      .where(and(
        eq(kpis.timeframe, 'monthly'),
        eq(kpis.status, 'active'),
        eq(kpis.alertsEnabled, true)
      ));

    console.log(`[KPI Scheduler] Found ${monthlyKPIs.length} monthly KPIs with alerts enabled`);

    for (const kpi of monthlyKPIs) {
      await createKPIReminder(kpi);
    }
  } catch (error) {
    console.error('[KPI Scheduler] Error checking monthly reminders:', error);
  }
}

/**
 * Check and send daily reminders
 */
export async function checkDailyReminders(): Promise<void> {
  console.log('[KPI Scheduler] Checking daily reminders...');

  try {
    const dailyKPIs = await db.select()
      .from(kpis)
      .where(and(
        eq(kpis.timeframe, 'daily'),
        eq(kpis.status, 'active'),
        eq(kpis.alertsEnabled, true)
      ));

    console.log(`[KPI Scheduler] Found ${dailyKPIs.length} daily KPIs with alerts enabled`);

    for (const kpi of dailyKPIs) {
      await createKPIReminder(kpi);
    }
  } catch (error) {
    console.error('[KPI Scheduler] Error checking daily reminders:', error);
  }
}

/**
 * Check and send weekly reminders
 */
export async function checkWeeklyReminders(): Promise<void> {
  if (!isFirstOfWeek()) {
    return;
  }

  console.log('[KPI Scheduler] Checking weekly reminders...');

  try {
    const weeklyKPIs = await db.select()
      .from(kpis)
      .where(and(
        eq(kpis.timeframe, 'weekly'),
        eq(kpis.status, 'active'),
        eq(kpis.alertsEnabled, true)
      ));

    console.log(`[KPI Scheduler] Found ${weeklyKPIs.length} weekly KPIs with alerts enabled`);

    for (const kpi of weeklyKPIs) {
      await createKPIReminder(kpi);
    }
  } catch (error) {
    console.error('[KPI Scheduler] Error checking weekly reminders:', error);
  }
}

/**
 * Check performance alerts for all active KPIs
 */
export async function checkPerformanceAlerts(): Promise<void> {
  console.log('[KPI Scheduler] Checking performance alerts...');

  try {
    const activeKPIs = await db.select()
      .from(kpis)
      .where(and(
        eq(kpis.status, 'active'),
        eq(kpis.alertsEnabled, true)
      ));

    console.log(`[KPI Scheduler] Found ${activeKPIs.length} active KPIs with alerts enabled`);

    for (const kpi of activeKPIs) {
      // NOTE: KPI numeric values may be stored as formatted strings (e.g. "370,000").
      // Use shouldTriggerAlert/createKPIAlert for truth; these logs are best-effort.
      const currentValue = parseFloat(String(kpi.currentValue || "").replace(/,/g, ""));
      const alertThreshold = kpi.alertThreshold ? parseFloat(String(kpi.alertThreshold).replace(/,/g, "")) : null;
      const alertCondition = kpi.alertCondition || 'below';
      
      console.log(`[KPI Scheduler] Checking KPI: ${kpi.name}`);
      console.log(`  - Current Value: ${currentValue}`);
      console.log(`  - Alert Threshold: ${alertThreshold}`);
      console.log(`  - Alert Condition: ${alertCondition}`);
      console.log(`  - Should Trigger: ${shouldTriggerAlert(kpi)}`);
      
      if (shouldTriggerAlert(kpi)) {
        console.log(`[KPI Scheduler] ✅ TRIGGERING ALERT for: ${kpi.name}`);
        await createKPIAlert(kpi);
      } else {
        console.log(`[KPI Scheduler] ❌ No alert needed for: ${kpi.name}`);
      }
    }
  } catch (error) {
    console.error('[KPI Scheduler] Error checking performance alerts:', error);
  }
}

/**
 * Capture end-of-period snapshots
 */
export async function captureEndOfPeriod(): Promise<void> {
  console.log('[KPI Scheduler] Checking for end-of-period snapshots...');

  try {
    // Capture daily KPIs (runs every day at midnight)
    await capturePeriodSnapshots('daily');

    // Check monthly KPIs
    if (isLastOfMonth()) {
      await capturePeriodSnapshots('monthly');
    }

    // Check weekly KPIs
    if (isLastOfWeek()) {
      await capturePeriodSnapshots('weekly');
    }

    // Check quarterly KPIs
    if (isLastOfQuarter()) {
      await capturePeriodSnapshots('quarterly');
    }
  } catch (error) {
    console.error('[KPI Scheduler] Error capturing end-of-period snapshots:', error);
  }
}

/**
 * Capture snapshots for specific timeframe
 */
async function capturePeriodSnapshots(timeframe: string): Promise<void> {
  console.log(`[KPI Scheduler] Capturing ${timeframe} period snapshots...`);

  const kpisToSnapshot = await db.select()
    .from(kpis)
    .where(and(
      eq(kpis.timeframe, timeframe),
      eq(kpis.status, 'active')
    ));

  console.log(`[KPI Scheduler] Found ${kpisToSnapshot.length} ${timeframe} KPIs to snapshot`);

  for (const kpi of kpisToSnapshot) {
    try {
      const { start, end } = getPeriodDates(timeframe);
      const periodLabel = getPeriodLabel(end, timeframe);

      // Get previous period for comparison
      const previousPeriods = await db.select()
        .from(kpiPeriods)
        .where(and(
          eq(kpiPeriods.kpiId, kpi.id),
          lt(kpiPeriods.periodEnd, start)
        ))
        .orderBy(desc(kpiPeriods.periodEnd))
        .limit(1);

      const previousPeriod = previousPeriods[0];

      // Calculate metrics
      const finalValue = parseFloat(kpi.currentValue);
      const targetValue = parseFloat(kpi.targetValue);
      const targetAchieved = finalValue >= targetValue;
      const performancePercentage = (finalValue / targetValue) * 100;
      const performanceLevel = calculatePerformanceLevel(performancePercentage);

      // Comparison with previous period
      const previousValue = previousPeriod ? parseFloat(previousPeriod.finalValue.toString()) : null;
      const changeAmount = previousValue ? finalValue - previousValue : null;
      const changePercentage = previousValue ? ((finalValue - previousValue) / previousValue) * 100 : null;
      const trendDirection = changeAmount ? (changeAmount > 0 ? 'up' : changeAmount < 0 ? 'down' : 'stable') : null;

      // Create period snapshot
      const periodData: InsertKPIPeriod = {
        kpiId: kpi.id,
        periodStart: start,
        periodEnd: end,
        periodType: timeframe,
        periodLabel,
        finalValue: finalValue.toString(),
        targetValue: targetValue.toString(),
        unit: kpi.unit,
        targetAchieved,
        performancePercentage: performancePercentage.toString(),
        performanceLevel,
        previousPeriodValue: previousValue?.toString(),
        changeAmount: changeAmount?.toString(),
        changePercentage: changePercentage?.toString(),
        trendDirection,
        notes: undefined
      };

      await db.insert(kpiPeriods).values(periodData);

      // Create period complete notification
      await createPeriodComplete(kpi, {
        periodLabel,
        finalValue,
        targetAchieved,
        changePercentage: changePercentage || undefined,
        trendDirection: trendDirection || undefined
      });

      console.log(`[KPI Scheduler] Captured snapshot for KPI: ${kpi.name} - ${periodLabel}`);

      // Check for declining trend (3+ consecutive periods)
      const recentPeriods = await db.select()
        .from(kpiPeriods)
        .where(eq(kpiPeriods.kpiId, kpi.id))
        .orderBy(desc(kpiPeriods.periodEnd))
        .limit(3);

      if (recentPeriods.length >= 3) {
        const allDeclining = recentPeriods.every((p, i) => 
          i === 0 || parseFloat(p.finalValue.toString()) < parseFloat(recentPeriods[i - 1].finalValue.toString())
        );

        if (allDeclining) {
          await createTrendAlert(kpi, recentPeriods.length);
        }
      }
    } catch (error) {
      console.error(`[KPI Scheduler] Error capturing snapshot for KPI ${kpi.id}:`, error);
    }
  }
}

/**
 * Main daily job runner
 * Call this once per day (e.g., at midnight)
 * 
 * SIMPLIFIED FOR OPTION C (Hybrid Notifications):
 * Only runs performance alerts (below/above target notifications)
 * Removed: Monthly reminders, period complete, trend alerts
 */
export async function runDailyKPIJobs(): Promise<void> {
  console.log('[KPI Scheduler] Running simplified KPI jobs (Option C: Performance alerts only)...');

  try {
    // Ensure GA4 KPIs/Benchmarks have daily progress/history so Insights can show trends/streaks.
    // Best-effort: never fail the whole scheduler if GA4 refresh has issues.
    await runGA4DailyKPIAndBenchmarkJobs().catch((e) => {
      console.warn("[KPI Scheduler] GA4 daily KPI/Benchmark job failed:", (e as any)?.message || e);
    });

    // Only check for performance alerts (below/above target)
    await checkPerformanceAlerts();

    // In-app Benchmark alerts (same pattern as KPI notifications)
    try {
      const { checkBenchmarkPerformanceAlerts } = await import("./benchmark-notifications.js");
      await checkBenchmarkPerformanceAlerts();
    } catch (e: any) {
      console.warn("[KPI Scheduler] Benchmark in-app alert check failed:", (e as any)?.message || e);
    }

    // Email alerts (KPI + Benchmark) - respects emailNotifications + alertFrequency.
    try {
      const { alertMonitoringService } = await import("./services/alert-monitoring.js");
      await alertMonitoringService.runAlertChecks();
    } catch (e: any) {
      console.warn("[KPI Scheduler] Email alert monitoring failed:", (e as any)?.message || e);
    }

    console.log('[KPI Scheduler] Daily KPI jobs completed successfully');
  } catch (error) {
    console.error('[KPI Scheduler] Error running daily KPI jobs:', error);
  }
}

/**
 * Start the KPI scheduler
 * Runs daily at midnight
 */
export function startKPIScheduler(): void {
  console.log('[KPI Scheduler] Starting KPI scheduler...');

  // Run immediately on startup (for testing)
  runDailyKPIJobs();

  // Schedule to run daily at midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();

  setTimeout(() => {
    runDailyKPIJobs();
    
    // Then run every 24 hours
    setInterval(runDailyKPIJobs, 24 * 60 * 60 * 1000);
  }, timeUntilMidnight);

  console.log('[KPI Scheduler] KPI scheduler started successfully');
}

