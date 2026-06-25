import { db } from "../db";
import { campaigns, kpis, benchmarks, kpiAlerts } from "../../shared/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { emailService } from "./email-service.js";
import { evaluateAlertCondition, parseAlertNumber as parseSharedAlertNumber } from "../utils/alert-evaluation";
import { resolveCampaignCurrentValueForAlert } from "../utils/campaign-current-values";
import { claimAlertEmailSend, type AlertEmailSendClaim } from "../utils/alert-email-audit";

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
    return evaluateAlertCondition(currentValue, thresholdValue, condition);
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

  private parseAlertNumber(value: unknown): number {
    return parseSharedAlertNumber(value);
  }

  private async getExistingCampaignName(campaignId: unknown): Promise<string | null> {
    const id = String(campaignId || '').trim();
    if (!id) return null;
    const [campaign] = await db.select({ name: campaigns.name }).from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return campaign?.name || null;
  }

  private async claimAlertEmailWindow(args: {
    itemType: "kpi" | "benchmark";
    itemId: unknown;
    itemName: unknown;
    frequency: unknown;
    recipients: string[];
    campaignId: unknown;
    campaignName: string;
  }): Promise<AlertEmailSendClaim | null> {
    const claim = await claimAlertEmailSend({
      itemType: args.itemType,
      itemId: String(args.itemId || ""),
      frequency: args.frequency,
      recipients: args.recipients,
      subject: `Alert email send claim: ${String(args.itemName || args.itemType)}`,
      campaignId: String(args.campaignId || "").trim() || undefined,
      campaignName: args.campaignName,
    });
    return claim.claimed ? claim : null;
  }

  async sendImmediateKPIAlertIfNeeded(kpiId: string): Promise<boolean> {
    const [rawKpi] = await db.select().from(kpis).where(eq(kpis.id, kpiId));
    if (!rawKpi || !rawKpi.alertsEnabled || !rawKpi.emailNotifications || !rawKpi.emailRecipients) return false;
    const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);
    const campaignName = await this.getExistingCampaignName((kpi as any).campaignId);
    if (!campaignName) return false;

    const frequency = (kpi.alertFrequency || 'daily') as any;
    const frequencyHours =
      frequency === 'immediate' ? 1 :
      frequency === 'weekly' ? 24 * 7 :
      24;
    if (this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) return false;

    const currentValue = this.parseAlertNumber(kpi.currentValue);
    const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (kpi.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;

    const recipients = this.parseEmailRecipients(kpi.emailRecipients);
    if (recipients.length === 0) return false;
    const claim = await this.claimAlertEmailWindow({
      itemType: "kpi",
      itemId: kpi.id,
      itemName: kpi.name,
      frequency,
      recipients,
      campaignId: (kpi as any).campaignId,
      campaignName,
    });
    if (!claim) return false;

    const emailSent = await emailService.sendAlertEmail(recipients, {
      type: 'kpi',
      name: kpi.name,
      currentValue,
      thresholdValue,
      condition,
      targetValue: parseFloat(kpi.targetValue?.toString() || '0'),
      unit: kpi.unit || undefined,
    }, {
      entityId: kpi.id,
      auditEventId: claim.auditEventId,
      dedupeKey: claim.dedupeKey,
      campaignId: (kpi as any).campaignId || undefined,
      campaignName,
      attemptCount: 1,
    });

    if (!emailSent) return false;

    await db.update(kpis).set({ lastAlertSent: sql`CURRENT_TIMESTAMP` }).where(eq(kpis.id, kpi.id));
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
    return true;
  }

  async sendImmediateBenchmarkAlertIfNeeded(benchmarkId: string): Promise<boolean> {
    const [rawBenchmark] = await db.select().from(benchmarks).where(eq(benchmarks.id, benchmarkId));
    if (!rawBenchmark || !rawBenchmark.alertsEnabled || !rawBenchmark.emailNotifications || !rawBenchmark.emailRecipients) return false;
    const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark);
    if (String((benchmark as any).status || 'active') !== 'active') return false;
    const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId);
    if (!campaignName) return false;

    const frequency = (benchmark.alertFrequency || 'daily') as any;
    const frequencyHours =
      frequency === 'immediate' ? 1 :
      frequency === 'weekly' ? 24 * 7 :
      24;
    if (this.shouldThrottleAlert(benchmark.lastAlertSent, frequencyHours)) return false;

    const currentValue = this.parseAlertNumber(benchmark.currentValue);
    const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (benchmark.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;

    const recipients = this.parseEmailRecipients(benchmark.emailRecipients);
    if (recipients.length === 0) return false;
    const claim = await this.claimAlertEmailWindow({
      itemType: "benchmark",
      itemId: benchmark.id,
      itemName: benchmark.name,
      frequency,
      recipients,
      campaignId: (benchmark as any).campaignId,
      campaignName,
    });
    if (!claim) return false;

    const emailSent = await emailService.sendAlertEmail(recipients, {
      type: 'benchmark',
      name: benchmark.name,
      currentValue,
      thresholdValue,
      condition,
      targetValue: parseFloat(benchmark.benchmarkValue?.toString() || '0'),
      unit: benchmark.unit || undefined,
    }, {
      entityId: benchmark.id,
      auditEventId: claim.auditEventId,
      dedupeKey: claim.dedupeKey,
      campaignId: (benchmark as any).campaignId || undefined,
      campaignName,
      attemptCount: 1,
    });

    if (!emailSent) return false;

    await db.update(benchmarks).set({ lastAlertSent: sql`CURRENT_TIMESTAMP` }).where(eq(benchmarks.id, benchmark.id));
    return true;
  }

  // Check all KPIs for alerts
  async checkKPIAlerts(): Promise<number> {
    try {
      // Query all KPIs with alerts enabled
      const kpisToCheck = await db
        .select()
        .from(kpis)
        .where(and(eq(kpis.alertsEnabled, true), eq(kpis.emailNotifications, true)));

      let alertsSent = 0;
      const campaignMetricCache = new Map<string, Promise<any>>();

      for (const rawKpi of kpisToCheck) {
        const kpi = await resolveCampaignCurrentValueForAlert(rawKpi, campaignMetricCache);
        // Skip if no email recipients configured
        if (!kpi.emailRecipients) continue;
        const campaignName = await this.getExistingCampaignName((kpi as any).campaignId);
        if (!campaignName) continue;

        const frequency = (kpi.alertFrequency || 'daily') as any;
        const frequencyHours =
          frequency === 'immediate' ? 1 : // at most once per hour to avoid spam
          frequency === 'weekly' ? 24 * 7 :
          24;

        // Skip if alert was sent recently (based on chosen frequency)
        if (this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) {
          console.log(`Throttling alert for KPI ${kpi.name} (last sent: ${kpi.lastAlertSent})`);
          continue;
        }

        const currentValue = this.parseAlertNumber(kpi.currentValue);
        const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);
        if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) continue;
        const condition = (kpi.alertCondition || 'below') as 'below' | 'above' | 'equals';

        // Check if alert condition is met
        if (this.shouldSendAlert(currentValue, thresholdValue, condition)) {
          const recipients = this.parseEmailRecipients(kpi.emailRecipients);
          
          if (recipients.length === 0) continue;
          const claim = await this.claimAlertEmailWindow({
            itemType: "kpi",
            itemId: kpi.id,
            itemName: kpi.name,
            frequency,
            recipients,
            campaignId: (kpi as any).campaignId,
            campaignName,
          });
          if (!claim) continue;

          // Send alert email
          const emailSent = await emailService.sendAlertEmail(recipients, {
            type: 'kpi',
            name: kpi.name,
            currentValue,
            thresholdValue,
            condition,
            targetValue: parseFloat(kpi.targetValue?.toString() || '0'),
            unit: kpi.unit || undefined,
          }, {
            entityId: kpi.id,
            auditEventId: claim.auditEventId,
            dedupeKey: claim.dedupeKey,
            campaignId: (kpi as any).campaignId || undefined,
            campaignName,
            attemptCount: 1,
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
        .where(and(eq(benchmarks.alertsEnabled, true), eq(benchmarks.emailNotifications, true)));

      let alertsSent = 0;
      const campaignMetricCache = new Map<string, Promise<any>>();

      for (const rawBenchmark of benchmarksToCheck) {
        const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark, campaignMetricCache);
        // Skip if no email recipients configured
        if (!benchmark.emailRecipients) continue;
        const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId);
        if (!campaignName) continue;

        const frequency = (benchmark.alertFrequency || 'daily') as any;
        const frequencyHours =
          frequency === 'immediate' ? 1 :
          frequency === 'weekly' ? 24 * 7 :
          24;

        // Skip if alert was sent recently (based on chosen frequency)
        if (this.shouldThrottleAlert(benchmark.lastAlertSent, frequencyHours)) {
          console.log(`Throttling alert for Benchmark ${benchmark.name} (last sent: ${benchmark.lastAlertSent})`);
          continue;
        }

        const currentValue = this.parseAlertNumber(benchmark.currentValue);
        const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);
        if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) continue;
        const condition = (benchmark.alertCondition || 'below') as 'below' | 'above' | 'equals';

        // Check if alert condition is met
        if (this.shouldSendAlert(currentValue, thresholdValue, condition)) {
          const recipients = this.parseEmailRecipients(benchmark.emailRecipients);
          
          if (recipients.length === 0) continue;
          const claim = await this.claimAlertEmailWindow({
            itemType: "benchmark",
            itemId: benchmark.id,
            itemName: benchmark.name,
            frequency,
            recipients,
            campaignId: (benchmark as any).campaignId,
            campaignName,
          });
          if (!claim) continue;

          // Send alert email
          const emailSent = await emailService.sendAlertEmail(recipients, {
            type: 'benchmark',
            name: benchmark.name,
            currentValue,
            thresholdValue,
            condition,
            targetValue: parseFloat(benchmark.benchmarkValue?.toString() || '0'),
            unit: benchmark.unit || undefined,
          }, {
            entityId: benchmark.id,
            auditEventId: claim.auditEventId,
            dedupeKey: claim.dedupeKey,
            campaignId: (benchmark as any).campaignId || undefined,
            campaignName,
            attemptCount: 1,
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
