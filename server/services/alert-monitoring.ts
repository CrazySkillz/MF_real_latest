import { db } from "../db";
import { campaigns, clients, kpis, benchmarks, kpiAlerts, emailAlertEvents } from "../../shared/schema.js";
import { eq, and, sql, lte } from "drizzle-orm";
import { emailService } from "./email-service.js";
import { evaluateAlertCondition, parseAlertNumber as parseSharedAlertNumber } from "../utils/alert-evaluation";
import { resolveCampaignCurrentValueForAlert } from "../utils/campaign-current-values";
import { getGA4KPIDuplicateKey, getLatestGA4KPIIdsByDuplicateKey, isLatestGA4KPIForDuplicateKey } from "../utils/ga4-kpi-alert-dedupe";
import { ALERT_EMAIL_MAX_ATTEMPTS, claimAlertEmailSend, isAlertEmailScheduleDue, type AlertEmailSendClaim } from "../utils/alert-email-audit";

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

type ExistingAlertEmailClaim = {
  auditEventId?: string;
  dedupeKey: string;
  attemptCount: number;
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

  private async isLatestGA4KPIAlertCandidate(kpi: any): Promise<boolean> {
    const duplicateKey = getGA4KPIDuplicateKey(kpi);
    if (!duplicateKey) return true;
    const campaignId = String((kpi as any)?.campaignId || "").trim();
    if (!campaignId) return true;

    const campaignGA4KPIs = await db
      .select()
      .from(kpis)
      .where(and(eq(kpis.campaignId, campaignId), eq(kpis.platformType, "google_analytics")));
    const latestGA4KpiIdsByDuplicateKey = getLatestGA4KPIIdsByDuplicateKey(campaignGA4KPIs);
    return isLatestGA4KPIForDuplicateKey(kpi, latestGA4KpiIdsByDuplicateKey);
  }

  private async getExistingCampaignName(campaignId: unknown, requireClient = false): Promise<string | null> {
    const id = String(campaignId || '').trim();
    if (!id) return null;
    const [campaign] = await db.select({ name: campaigns.name, clientId: campaigns.clientId }).from(campaigns).where(eq(campaigns.id, id)).limit(1);
    if (!campaign?.name) return null;
    if (requireClient && campaign.clientId) {
      const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.id, campaign.clientId)).limit(1);
      if (!client?.id) return null;
    }
    return campaign.name;
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
      sender: String(process.env.EMAIL_FROM_ADDRESS || '').trim() || 'alerts@mimo.app',
    });
    return claim.claimed ? claim : null;
  }

  async sendImmediateKPIAlertIfNeeded(kpiId: string, retryClaim?: ExistingAlertEmailClaim): Promise<boolean> {
    const [rawKpi] = await db.select().from(kpis).where(eq(kpis.id, kpiId));
    if (!rawKpi || !rawKpi.alertsEnabled || !rawKpi.emailNotifications || !rawKpi.emailRecipients) return false;
    if (!(await this.isLatestGA4KPIAlertCandidate(rawKpi))) return false;
    const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);
    const campaignName = await this.getExistingCampaignName((kpi as any).campaignId, Boolean(retryClaim));
    if (!campaignName) return false;

    const frequency = (kpi.alertFrequency || 'daily') as any;
    if (!retryClaim && !isAlertEmailScheduleDue((kpi as any).calculationConfig, frequency)) return false;

    const currentValue = this.parseAlertNumber(kpi.currentValue);
    const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (kpi.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;

    const recipients = this.parseEmailRecipients(kpi.emailRecipients);
    if (recipients.length === 0) return false;
    const claim = retryClaim || await this.claimAlertEmailWindow({
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
      attemptCount: retryClaim?.attemptCount || 1,
    });

    if (!emailSent) return false;

    await db.update(kpis).set({ lastAlertSent: sql`CURRENT_TIMESTAMP` }).where(eq(kpis.id, kpi.id));
    if (!retryClaim) {
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
    }
    return true;
  }

  async sendImmediateBenchmarkAlertIfNeeded(benchmarkId: string, retryClaim?: ExistingAlertEmailClaim): Promise<boolean> {
    const [rawBenchmark] = await db.select().from(benchmarks).where(eq(benchmarks.id, benchmarkId));
    if (!rawBenchmark || !rawBenchmark.alertsEnabled || !rawBenchmark.emailNotifications || !rawBenchmark.emailRecipients) return false;
    const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark);
    if (String((benchmark as any).status || 'active') !== 'active') return false;
    const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId, Boolean(retryClaim));
    if (!campaignName) return false;

    const frequency = (benchmark.alertFrequency || 'daily') as any;

    const currentValue = this.parseAlertNumber(benchmark.currentValue);
    const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (benchmark.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;

    const recipients = this.parseEmailRecipients(benchmark.emailRecipients);
    if (recipients.length === 0) return false;
    const claim = retryClaim || await this.claimAlertEmailWindow({
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
      attemptCount: retryClaim?.attemptCount || 1,
    });

    if (!emailSent) return false;

    await db.update(benchmarks).set({ lastAlertSent: sql`CURRENT_TIMESTAMP` }).where(eq(benchmarks.id, benchmark.id));
    return true;
  }

  private async markAlertEmailRetrySkipped(row: any, reason: string): Promise<void> {
    const id = String(row?.id || "").trim();
    if (!id) return;
    await db.update(emailAlertEvents)
      .set({
        deliveryStatus: "skipped",
        nextAttemptAt: null,
        error: reason,
        metadata: JSON.stringify({
          retrySkippedReason: reason,
          originalDedupeKey: row?.dedupeKey || null,
        }),
      } as any)
      .where(eq(emailAlertEvents.id, id));
  }

  private async markAlertEmailRetryExhausted(row: any): Promise<void> {
    const id = String(row?.id || "").trim();
    if (!id) return;
    await db.update(emailAlertEvents)
      .set({
        deliveryStatus: "failed",
        nextAttemptAt: null,
        failedAt: new Date(),
        error: "Alert email retry attempts exhausted",
        metadata: JSON.stringify({
          retryExhausted: true,
          originalDedupeKey: row?.dedupeKey || null,
        }),
      } as any)
      .where(eq(emailAlertEvents.id, id));
  }

  private async isKPIAlertRetryStillSendable(kpiId: string): Promise<boolean> {
    const [rawKpi] = await db.select().from(kpis).where(eq(kpis.id, kpiId));
    if (!rawKpi || !rawKpi.alertsEnabled || !rawKpi.emailNotifications || !rawKpi.emailRecipients) return false;
    if (!(await this.isLatestGA4KPIAlertCandidate(rawKpi))) return false;
    const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);
    const campaignName = await this.getExistingCampaignName((kpi as any).campaignId, true);
    if (!campaignName) return false;
    const currentValue = this.parseAlertNumber(kpi.currentValue);
    const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (kpi.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;
    return this.parseEmailRecipients(kpi.emailRecipients).length > 0;
  }

  private async isBenchmarkAlertRetryStillSendable(benchmarkId: string): Promise<boolean> {
    const [rawBenchmark] = await db.select().from(benchmarks).where(eq(benchmarks.id, benchmarkId));
    if (!rawBenchmark || !rawBenchmark.alertsEnabled || !rawBenchmark.emailNotifications || !rawBenchmark.emailRecipients) return false;
    const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark);
    if (String((benchmark as any).status || 'active') !== 'active') return false;
    const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId, true);
    if (!campaignName) return false;
    const currentValue = this.parseAlertNumber(benchmark.currentValue);
    const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);
    if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
    const condition = (benchmark.alertCondition || 'below') as 'below' | 'above' | 'equals';
    if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;
    return this.parseEmailRecipients(benchmark.emailRecipients).length > 0;
  }

  async processDueAlertEmailRetries(now: Date = new Date()): Promise<number> {
    const rows = await db
      .select()
      .from(emailAlertEvents)
      .where(and(
        eq(emailAlertEvents.kind, "alert"),
        eq(emailAlertEvents.deliveryStatus, "retry_scheduled"),
        lte(emailAlertEvents.nextAttemptAt, now),
      ))
      .limit(50)
      .catch((error: any) => {
        console.warn("[Alert Email Retry] Failed to load due retries:", error?.message || error);
        return [];
      });

    let retried = 0;
    for (const row of rows as any[]) {
      const id = String(row?.id || "").trim();
      const entityType = String(row?.entityType || "").trim().toLowerCase();
      const entityId = String(row?.entityId || "").trim();
      const dedupeKey = String(row?.dedupeKey || "").trim();
      const attemptCount = Number(row?.attemptCount || 0);

      if (!id || !entityId || !dedupeKey || (entityType !== "kpi" && entityType !== "benchmark")) {
        await this.markAlertEmailRetrySkipped(row, "retry skipped: missing alert email retry identity");
        continue;
      }
      if (attemptCount >= ALERT_EMAIL_MAX_ATTEMPTS) {
        await this.markAlertEmailRetryExhausted(row);
        continue;
      }

      const stillSendable = entityType === "kpi"
        ? await this.isKPIAlertRetryStillSendable(entityId)
        : await this.isBenchmarkAlertRetryStillSendable(entityId);
      if (!stillSendable) {
        await this.markAlertEmailRetrySkipped(row, "retry skipped: alert no longer sendable");
        continue;
      }

      const retryClaim = {
        auditEventId: id,
        dedupeKey,
        attemptCount: attemptCount + 1,
      };
      const sent = entityType === "kpi"
        ? await this.sendImmediateKPIAlertIfNeeded(entityId, retryClaim)
        : await this.sendImmediateBenchmarkAlertIfNeeded(entityId, retryClaim);
      if (sent) retried++;
    }

    return retried;
  }
  // Check all KPIs for alerts
  async checkKPIAlerts(): Promise<number> {
    try {
      // Query all KPIs with alerts enabled
      const kpisToCheck = await db
        .select()
        .from(kpis)
        .where(and(eq(kpis.alertsEnabled, true), eq(kpis.emailNotifications, true)));

      const allGA4KPIsForDuplicateCheck = await db
        .select()
        .from(kpis)
        .where(eq(kpis.platformType, "google_analytics"));
      const latestGA4KpiIdsByDuplicateKey = getLatestGA4KPIIdsByDuplicateKey(allGA4KPIsForDuplicateCheck);

      let alertsSent = 0;
      const campaignMetricCache = new Map<string, Promise<any>>();

      for (const rawKpi of kpisToCheck) {
        if (!isLatestGA4KPIForDuplicateKey(rawKpi, latestGA4KpiIdsByDuplicateKey)) continue;
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
        if (!isAlertEmailScheduleDue((kpi as any).calculationConfig, frequency)) continue;

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
    
    const retries = await this.processDueAlertEmailRetries();
    const kpiAlerts = await this.checkKPIAlerts();
    const benchmarkAlerts = await this.checkBenchmarkAlerts();
    
    console.log(`Alert check complete. KPI alerts: ${kpiAlerts}, Benchmark alerts: ${benchmarkAlerts}, retries: ${retries}`);
    
    return { kpiAlerts, benchmarkAlerts };
  }
}

export const alertMonitoringService = new AlertMonitoringService();
