import { db } from "./db";
import { notifications, kpis } from "../shared/schema";
import type { KPI, InsertNotification } from "../shared/schema";

/**
 * KPI Notification Helper Functions
 * Creates in-app notifications for KPI events
 */

/**
 * Create a monthly reminder notification
 * Triggered on 1st of month for monthly KPIs
 */
export async function createKPIReminder(kpi: KPI): Promise<void> {
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'reminder',
    actionUrl: `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
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
  const currentValue = parseFloat(kpi.currentValue);
  const alertThreshold = kpi.alertThreshold ? parseFloat(kpi.alertThreshold.toString()) : null;
  const targetValue = parseFloat(kpi.targetValue);
  
  // Calculate gap
  const gap = ((targetValue - currentValue) / targetValue) * 100;
  const gapText = gap > 0 ? `${Math.abs(gap).toFixed(1)}% below` : `${Math.abs(gap).toFixed(1)}% above`;

  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'performance-alert',
    actionUrl: `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
  });

  const notification: InsertNotification = {
    title: `⚠️ KPI Alert: ${kpi.name}`,
    message: `Current value (${kpi.currentValue}${kpi.unit}) is ${gapText} your target (${kpi.targetValue}${kpi.unit}). ${alertThreshold ? `Alert threshold: ${alertThreshold}${kpi.unit}` : ''}`,
    type: 'warning',
    priority: kpi.priority === 'high' ? 'high' : 'normal',
    campaignId: kpi.campaignId || undefined,
    campaignName: undefined,
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

  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'period-complete',
    actionUrl: `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
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
  const metadata = JSON.stringify({
    kpiId: kpi.id,
    alertType: 'trend-alert',
    actionUrl: `/linkedin-analytics?tab=kpis&highlight=${kpi.id}`
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

  const currentValue = parseFloat(kpi.currentValue);
  const alertThreshold = parseFloat(kpi.alertThreshold.toString());
  const alertCondition = kpi.alertCondition || 'below';

  switch (alertCondition) {
    case 'below':
      return currentValue < alertThreshold;
    case 'above':
      return currentValue > alertThreshold;
    case 'equals':
      return Math.abs(currentValue - alertThreshold) < 0.01;
    default:
      return false;
  }
}

