import { db } from "../db/index.js";
import { kpis, benchmarks, kpiAlerts } from "../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { emailService } from "./email-service.js";

interface AlertCheck {
  id: string;
  name: string;
  currentValue: number;
  thresholdValue: number;
  condition: 'below' | 'above' | 'equals';
  targetValue?: number;
  unit?: string;
  emailRecipients?: string;
  lastAlertSent?: Date;
  type: 'kpi' | 'benchmark';
}

class AlertMonitoringService {
  
  // Check if alert should be sent based on condition
  private shouldSendAlert(
    currentValue: number,
    thresholdValue: number,
    condition: 'below' | 'above' | 'equals'
  ): boolean {
    switch (condition) {
      case 'below':
        return currentValue < thresholdValue;
      case 'above':
        return currentValue > thresholdValue;
      case 'equals':
        return Math.abs(currentValue - thresholdValue) < 0.01; // Allow small floating point difference
      default:
        return false;
    }
  }

  // Check if enough time has passed since last alert (to prevent spam)
  private shouldThrottleAlert(lastAlertSent: Date | null | undefined, frequencyHours: number = 24): boolean {
    if (!lastAlertSent) return false;
    
    const hoursSinceLastAlert = (Date.now() - new Date(lastAlertSent).getTime()) / (1000 * 60 * 60);
    return hoursSinceLastAlert < frequencyHours;
  }

  // Parse email recipients from comma-separated string
  private parseEmailRecipients(recipients: string | null | undefined): string[] {
    if (!recipients) return [];
    return recipients.split(',').map(email => email.trim()).filter(email => email.length > 0);
  }

  // Check all KPIs for alerts
  async checkKPIAlerts(): Promise<number> {
    try {
      // Query all KPIs with alerts enabled
      const kpisToCheck = await db
        .select()
        .from(kpis)
        .where(eq(kpis.alertsEnabled, true));

      let alertsSent = 0;

      for (const kpi of kpisToCheck) {
        // Skip if no email recipients configured
        if (!kpi.emailRecipients) continue;

        // Skip if alert was sent recently
        if (this.shouldThrottleAlert(kpi.lastAlertSent)) {
          console.log(`Throttling alert for KPI ${kpi.name} (last sent: ${kpi.lastAlertSent})`);
          continue;
        }

        const currentValue = parseFloat(kpi.currentValue?.toString() || '0');
        const thresholdValue = parseFloat(kpi.alertThreshold?.toString() || '0');
        const condition = (kpi.alertCondition || 'below') as 'below' | 'above' | 'equals';

        // Check if alert condition is met
        if (this.shouldSendAlert(currentValue, thresholdValue, condition)) {
          const recipients = this.parseEmailRecipients(kpi.emailRecipients);
          
          if (recipients.length === 0) continue;

          // Send alert email
          const emailSent = await emailService.sendAlertEmail(recipients, {
            type: 'kpi',
            name: kpi.name,
            currentValue,
            thresholdValue,
            condition,
            targetValue: parseFloat(kpi.targetValue?.toString() || '0'),
            unit: kpi.unit || undefined,
          });

          if (emailSent) {
            // Update last alert sent timestamp
            await db
              .update(kpis)
              .set({ lastAlertSent: sql`CURRENT_TIMESTAMP` })
              .where(eq(kpis.id, kpi.id));

            // Create alert record
            await db.insert(kpiAlerts).values({
              kpiId: kpi.id,
              alertType: 'threshold_breach',
              severity: 'high',
              message: `${kpi.name} has ${condition} threshold of ${thresholdValue}${kpi.unit || ''}`,
              currentValue: kpi.currentValue,
              targetValue: kpi.targetValue,
              thresholdValue: kpi.alertThreshold,
              isActive: true,
              emailSent: true,
            });

            alertsSent++;
            console.log(`Alert sent for KPI: ${kpi.name} to ${recipients.length} recipient(s)`);
          }
        }
      }

      return alertsSent;
    } catch (error) {
      console.error('Error checking KPI alerts:', error);
      return 0;
    }
  }

  // Check all Benchmarks for alerts
  async checkBenchmarkAlerts(): Promise<number> {
    try {
      // Query all Benchmarks with alerts enabled
      const benchmarksToCheck = await db
        .select()
        .from(benchmarks)
        .where(eq(benchmarks.alertsEnabled, true));

      let alertsSent = 0;

      for (const benchmark of benchmarksToCheck) {
        // Skip if no email recipients configured
        if (!benchmark.emailRecipients) continue;

        // Skip if alert was sent recently
        if (this.shouldThrottleAlert(benchmark.lastAlertSent)) {
          console.log(`Throttling alert for Benchmark ${benchmark.name} (last sent: ${benchmark.lastAlertSent})`);
          continue;
        }

        const currentValue = parseFloat(benchmark.currentValue?.toString() || '0');
        const thresholdValue = parseFloat(benchmark.alertThreshold?.toString() || '0');
        const condition = (benchmark.alertCondition || 'below') as 'below' | 'above' | 'equals';

        // Check if alert condition is met
        if (this.shouldSendAlert(currentValue, thresholdValue, condition)) {
          const recipients = this.parseEmailRecipients(benchmark.emailRecipients);
          
          if (recipients.length === 0) continue;

          // Send alert email
          const emailSent = await emailService.sendAlertEmail(recipients, {
            type: 'benchmark',
            name: benchmark.name,
            currentValue,
            thresholdValue,
            condition,
            unit: benchmark.unit || undefined,
          });

          if (emailSent) {
            // Update last alert sent timestamp
            await db
              .update(benchmarks)
              .set({ lastAlertSent: sql`CURRENT_TIMESTAMP` })
              .where(eq(benchmarks.id, benchmark.id));

            alertsSent++;
            console.log(`Alert sent for Benchmark: ${benchmark.name} to ${recipients.length} recipient(s)`);
          }
        }
      }

      return alertsSent;
    } catch (error) {
      console.error('Error checking Benchmark alerts:', error);
      return 0;
    }
  }

  // Run all alert checks
  async runAlertChecks(): Promise<{ kpiAlerts: number; benchmarkAlerts: number }> {
    console.log('Starting alert monitoring check...');
    
    const kpiAlerts = await this.checkKPIAlerts();
    const benchmarkAlerts = await this.checkBenchmarkAlerts();
    
    console.log(`Alert check complete. KPI alerts: ${kpiAlerts}, Benchmark alerts: ${benchmarkAlerts}`);
    
    return { kpiAlerts, benchmarkAlerts };
  }
}

export const alertMonitoringService = new AlertMonitoringService();
