import { db } from "./db";
import { linkedinDailyMetrics, notifications, kpis } from "../shared/schema";
import { desc, eq } from "drizzle-orm";
import type { KPI, InsertNotification } from "../shared/schema";
import { storage } from "./storage";

function parseLooseNumber(input: unknown): number {
  // Accept formatted inputs like "370,000", "$1,234.50", "  1000  ".
  // Keep digits, decimal point, and leading minus.
  const s = String(input ?? "").trim();
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

async function getLinkedInWindowKey(campaignId: string): Promise<string | null> {
  const cid = String(campaignId || "").trim();
  if (!cid) return null;
  try {
    if (!db) return null;
    const rows = await db
      .select({ date: linkedinDailyMetrics.date })
      .from(linkedinDailyMetrics)
      .where(eq(linkedinDailyMetrics.campaignId, cid))
      .orderBy(desc(linkedinDailyMetrics.date))
      .limit(1);
    const d = String((rows as any[])?.[0]?.date || "").trim();
    return d || null;
  } catch {
    return null;
  }
}

/**
 * KPI Notification Helper Functions
 * Creates in-app notifications for KPI events
 */

/**
 * Create a monthly reminder notification
 * Triggered on 1st of month for monthly KPIs
 */
export async function createKPIReminder(kpi: KPI): Promise<void> {
  const actionUrl = kpi.campaignId
    ? `/campaigns/${kpi.campaignId}/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
    : `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`;
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'reminder',
    actionUrl
  });

  const notification: InsertNotification = {
    title: `Time to Review: ${kpi.name}`,
    message: `Your ${kpi.timeframe} KPI review is due. Current: ${kpi.currentValue}${kpi.unit}, Target: ${kpi.targetValue}${kpi.unit}`,
    type: 'info',
    priority: 'normal',
    campaignId: kpi.campaignId || undefined,
    campaignName: undefined,
    read: false,
    metadata
  };

  await db.insert(notifications).values(notification);
  console.log(`[KPI Notification] Created reminder for KPI: ${kpi.name}`);
}

/**
 * Create a performance alert notification
 * Triggered when current value breaches alert threshold
 */
export async function createKPIAlert(kpi: KPI): Promise<void> {
  // Dedupe:
  // - default: prevent duplicates within the same real-world day
  // - LinkedIn test-mode: prevent duplicates per simulated day (windowKey == latest daily metrics date)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let windowKey: string | null = null;
  try {
    if (kpi.campaignId) {
      const conn = await storage.getLinkedInConnection(String(kpi.campaignId)).catch(() => undefined as any);
      const method = String((conn as any)?.method || "").toLowerCase();
      const token = String((conn as any)?.accessToken || "");
      const isTestMode =
        method.includes("test") ||
        process.env.LINKEDIN_TEST_MODE === "true" ||
        token === "test-mode-token" ||
        token.startsWith("test_") ||
        token.startsWith("test-");
      if (isTestMode) {
        windowKey = await getLinkedInWindowKey(String(kpi.campaignId));
      }
    }
  } catch {
    // ignore
  }
  
  const existingAlerts = await db.select()
    .from(notifications)
    .where(eq(notifications.type, 'performance-alert'));
  
  // Check if there's already an alert for this KPI in the current dedupe window
  const hasRecentAlert = existingAlerts.some(n => {
    if (!n.metadata) return false;
    try {
      const meta = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
      const createdAt = new Date(n.createdAt);
      if (windowKey) {
        return String(meta.kpiId) === String(kpi.id) && String(meta.windowKey || "") === windowKey;
      }
      return String(meta.kpiId) === String(kpi.id) && createdAt >= today;
    } catch {
      return false;
    }
  });
  
  if (hasRecentAlert) {
    console.log(`[KPI Notification] Skipping duplicate alert for KPI: ${kpi.name} (already alerted today)`);
    return;
  }

  const currentValue = parseLooseNumber(kpi.currentValue);
  const alertThreshold = kpi.alertThreshold ? parseLooseNumber(kpi.alertThreshold) : null;
  const targetValue = parseLooseNumber(kpi.targetValue);
  
  // Calculate gap
  const gap = ((targetValue - currentValue) / targetValue) * 100;
  const gapText = gap > 0 ? `${Math.abs(gap).toFixed(1)}% below` : `${Math.abs(gap).toFixed(1)}% above`;

  // Build the correct URL based on whether KPI is campaign-specific
  const actionUrl = kpi.campaignId 
    ? `/campaigns/${kpi.campaignId}/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
    : `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`;
  
  // Fetch campaign name if campaignId exists
  let campaignName: string | undefined = undefined;
  if (kpi.campaignId) {
    try {
      const campaign = await storage.getCampaign(kpi.campaignId);
      campaignName = campaign?.name;
    } catch (error) {
      console.error(`[KPI Notification] Failed to fetch campaign name for ${kpi.campaignId}:`, error);
    }
  }
  
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'performance-alert',
    actionUrl,
    ...(windowKey ? { windowKey } : {}),
  });

  const notification: InsertNotification = {
    title: `⚠️ KPI Alert: ${kpi.name}`,
    message: `Current value (${kpi.currentValue}${kpi.unit}) is ${gapText} your target (${kpi.targetValue}${kpi.unit}). ${alertThreshold ? `Alert threshold: ${alertThreshold}${kpi.unit}` : ''}`,
    type: 'performance-alert',
    priority: kpi.priority === 'high' ? 'high' : 'normal',
    campaignId: kpi.campaignId || undefined,
    campaignName: campaignName,
    read: false,
    metadata
  };

  await db.insert(notifications).values(notification);
  console.log(`[KPI Notification] Created alert for KPI: ${kpi.name}`);
}

/**
 * Create a period complete notification
 * Triggered at end of period with performance summary
 */
export async function createPeriodComplete(
  kpi: KPI,
  periodData: {
    periodLabel: string;
    finalValue: number;
    targetAchieved: boolean;
    changePercentage?: number;
    trendDirection?: string;
  }
): Promise<void> {
  const { periodLabel, finalValue, targetAchieved, changePercentage, trendDirection } = periodData;
  
  const targetValue = parseFloat(kpi.targetValue);
  const achievedText = targetAchieved ? '✓ Target Achieved' : '✗ Target Missed';
  const changeText = changePercentage 
    ? ` (${trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} ${Math.abs(changePercentage).toFixed(1)}% from previous period)`
    : '';

  const actionUrl = kpi.campaignId
    ? `/campaigns/${kpi.campaignId}/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
    : `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`;
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'period-complete',
    actionUrl
  });

  const notification: InsertNotification = {
    title: `📊 Period Complete: ${kpi.name}`,
    message: `${periodLabel} ended. Final: ${finalValue}${kpi.unit}, Target: ${targetValue}${kpi.unit}. ${achievedText}${changeText}`,
    type: targetAchieved ? 'success' : 'warning',
    priority: 'normal',
    campaignId: kpi.campaignId || undefined,
    campaignName: undefined,
    read: false,
    metadata
  };

  await db.insert(notifications).values(notification);
  console.log(`[KPI Notification] Created period complete for KPI: ${kpi.name} - ${periodLabel}`);
}

/**
 * Create a trend alert notification
 * Triggered when KPI shows consistent decline
 */
export async function createTrendAlert(kpi: KPI, consecutivePeriods: number): Promise<void> {
  const actionUrl = kpi.campaignId
    ? `/campaigns/${kpi.campaignId}/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
    : `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`;
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'trend-alert',
    actionUrl
  });

  const notification: InsertNotification = {
    title: `📉 Trend Alert: ${kpi.name}`,
    message: `This KPI has been declining for ${consecutivePeriods} consecutive periods. Current: ${kpi.currentValue}${kpi.unit}, Target: ${kpi.targetValue}${kpi.unit}`,
    type: 'warning',
    priority: 'high',
    campaignId: kpi.campaignId || undefined,
    campaignName: undefined,
    read: false,
    metadata
  };

  await db.insert(notifications).values(notification);
  console.log(`[KPI Notification] Created trend alert for KPI: ${kpi.name}`);
}

/**
 * Helper function to check if KPI should trigger alert
 */
export function shouldTriggerAlert(kpi: KPI): boolean {
  if (!kpi.alertsEnabled || !kpi.alertThreshold) {
    return false;
  }

  const currentValue = parseLooseNumber(kpi.currentValue);
  const alertThreshold = parseLooseNumber(kpi.alertThreshold);
  const alertCondition = kpi.alertCondition || 'below';

  switch (alertCondition) {
    case 'below':
      return currentValue < alertThreshold;   // Triggers when value goes BELOW threshold
    case 'above':
      return currentValue > alertThreshold;   // Triggers when value goes ABOVE threshold
    case 'equals':
      return Math.abs(currentValue - alertThreshold) < 0.01;  // Triggers when value EQUALS threshold
    default:
      return false;
  }
}

