import { db } from "./db";
import { benchmarks, linkedinDailyMetrics, notifications } from "../shared/schema";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { InsertNotification } from "../shared/schema";
import { storage, type GA4RefreshWriteInput } from "./storage";
import { resolveAlertCurrentValueForDecision } from "./utils/ga4-alert-current-value";
import { evaluateAlertThreshold, parseAlertNumber } from "./utils/alert-evaluation";
import { isAlertDecisionBreached } from "./utils/alert-decision";

function isIsoCurrencyCode(unit: string): boolean {
  return /^[A-Z]{3}$/.test(String(unit || "").trim());
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.round(rounded)}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatAlertDisplayValue(input: unknown, unit: unknown): string {
  const num = parseAlertNumber(input);
  if (!Number.isFinite(num)) return String(input ?? "");
  const normalizedUnit = String(unit || "").trim();

  switch (normalizedUnit) {
    case "%":
      return formatPct(num);
    case "$":
      return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    case "ratio":
      return `${num.toFixed(2)}x`;
    case "seconds":
      return `${num.toFixed(1)}s`;
    case "count":
      return num.toLocaleString();
    default:
      if (isIsoCurrencyCode(normalizedUnit)) {
        try {
          return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: normalizedUnit,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(num);
        } catch {
          return num.toLocaleString();
        }
      }
      return num.toLocaleString();
  }
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

function buildBenchmarkActionUrl(b: any): string {
  const campaignId = String(b?.campaignId || "").trim();
  const id = String(b?.id || "").trim();
  const platform = String(b?.platformType || "").trim().toLowerCase();
  if (!campaignId || !id) return "/notifications";
  if (platform === "linkedin") return `/campaigns/${campaignId}/linkedin-analytics?tab=benchmarks&highlight=${id}`;
  if (platform === "google_analytics") return `/campaigns/${campaignId}/ga4-metrics?tab=benchmarks&highlight=${id}`;
  return `/campaigns/${campaignId}`;
}

/**
 * Create in-app Benchmark alert notifications (same pattern as KPI notifications).
 * - Triggered when currentValue breaches alertThreshold per alertCondition
 * - Prevents duplicates for the same benchmark within the same day
 */
export async function checkBenchmarkPerformanceAlerts(): Promise<number> {
  return checkBenchmarkPerformanceAlertsForScope();
}

export async function checkGA4BenchmarkPerformanceAlertsForCampaign(campaignId: string, providerCoverageThroughDate: string, options: GA4RefreshWriteInput = {}): Promise<number> {
  const requestedCampaignId = String(campaignId || "").trim();
  if (!requestedCampaignId) throw new Error("Campaign ID is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(providerCoverageThroughDate)) throw new Error("GA4 provider coverage date is required");
  if ("refreshScope" in options) {
    if (options.refreshScope?.campaignId !== requestedCampaignId || options.refreshScope.reportingDate !== providerCoverageThroughDate) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    return storage.writeWithGA4RefreshOwnership(options.refreshScope, tx => checkBenchmarkPerformanceAlertsForScope(requestedCampaignId, providerCoverageThroughDate, tx));
  }
  const publicationVersion = options.publicationVersion ?? { campaignId: requestedCampaignId, version: await storage.getGA4PublicationVersion(requestedCampaignId) };
  return storage.writeGA4DerivedChange(requestedCampaignId, { publicationVersion }, tx => checkBenchmarkPerformanceAlertsForScope(requestedCampaignId, providerCoverageThroughDate, tx));
}

async function checkBenchmarkPerformanceAlertsForScope(campaignId?: string, providerCoverageThroughDate?: string, transaction?: any, includeCampaignLevel = false): Promise<number> {
  const alertDb = transaction || db;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const requestedCampaignId = String(campaignId || "").trim();
  const itemQuery = alertDb.select().from(benchmarks).where(requestedCampaignId
    ? and(eq(benchmarks.status, "active"), eq(benchmarks.campaignId, requestedCampaignId), includeCampaignLevel
      ? sql`COALESCE(${benchmarks.platformType}, '') IN ('', 'campaign', 'google_analytics')` : eq(benchmarks.platformType, "google_analytics"))
    : eq(benchmarks.status, "active"));
  const items = transaction ? await itemQuery.for("share") : await itemQuery;

  // Pull all performance-alert notifications once and do metadata matching in-memory (cheap at current scale).
  const existingAlerts = await alertDb
    .select()
    .from(notifications)
    .where(and(eq(notifications.type, "performance-alert"), transaction ? eq(notifications.campaignId, requestedCampaignId) : undefined));

  let created = 0;
  const windowKeyByCampaign = new Map<string, string>();
  const campaignMetricCache = new Map<string, Promise<any>>();
  const checkedCampaigns = new Set<string>();

  for (const rawBenchmark of items as any[]) {
    if (!requestedCampaignId && rawBenchmark.campaignId && ['', 'campaign', 'google_analytics'].includes(String(rawBenchmark.platformType || ''))) {
      if (checkedCampaigns.has(rawBenchmark.campaignId)) continue;
      checkedCampaigns.add(rawBenchmark.campaignId);
      try {
        const publicationVersion = { campaignId: rawBenchmark.campaignId, version: await storage.getGA4PublicationVersion(rawBenchmark.campaignId) };
        created += await storage.writeGA4DerivedChange(rawBenchmark.campaignId, { publicationVersion }, tx => checkBenchmarkPerformanceAlertsForScope(rawBenchmark.campaignId, undefined, tx, true));
      } catch (error: any) {
        if (!String(error?.message).startsWith('GA4_REFRESH_PUBLICATION_')) throw error;
      }
      continue;
    }
    const b = rawBenchmark.alertsEnabled && rawBenchmark.alertThreshold != null
      ? await resolveAlertCurrentValueForDecision(rawBenchmark, campaignMetricCache, { useSavedOverview: true })
      : rawBenchmark;
    const thresholdRaw = b.alertThreshold;
    const currentRaw = b.currentValue;
    const platformType = String((b?.platformType || "")).trim().toLowerCase();
    const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";
    if (!b.alertsEnabled || thresholdRaw === null || typeof thresholdRaw === "undefined") {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }
    if (b.__alertDecisionEligible === false && ["unavailable", "stale"].includes(b.__alertDecisionReason)) continue;
    if (!isAlertDecisionBreached(b)) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }

    const evaluation = evaluateAlertThreshold({
      currentValue: currentRaw,
      thresholdValue: thresholdRaw,
      condition: b.alertCondition,
    });
    const { currentValue, thresholdValue } = evaluation;
    if (!Number.isFinite(thresholdValue)) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }
    if (!Number.isFinite(currentValue)) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }

    if (!evaluation.triggered) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }

    // For LinkedIn test-mode, dedupe per simulated day instead of per real day.
    let windowKey: string | null = null;
    try {
      const platform = String(b?.platformType || "").trim().toLowerCase();
      const campaignId = String(b?.campaignId || "").trim();
      if (platform === "linkedin" && campaignId) {
        const conn = await storage.getLinkedInConnection(campaignId).catch(() => undefined as any);
        const method = String((conn as any)?.method || "").toLowerCase();
        const token = String((conn as any)?.accessToken || "");
        const isTestMode =
          method.includes("test") ||
          process.env.LINKEDIN_TEST_MODE === "true" ||
          token === "test-mode-token" ||
          token.startsWith("test_") ||
          token.startsWith("test-");
        if (isTestMode) {
          const cached = windowKeyByCampaign.get(campaignId);
          if (cached) windowKey = cached;
          else {
            const wk = await getLinkedInWindowKey(campaignId);
            if (wk) {
              windowKeyByCampaign.set(campaignId, wk);
              windowKey = wk;
            }
          }
        }
      }
    } catch {
      // ignore
    }

    const campaignId = String(b.campaignId || "").trim();
    if (!campaignId) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }
    const campaign = await storage.getCampaign(campaignId).catch((error) => {
      if (platformType === "google_analytics") throw error;
      return undefined;
    });
    if (!campaign) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }
    const campaignOwnerId = String((campaign as any).ownerId || "").trim();
    if (!campaignOwnerId) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared", transaction);
      continue;
    }

    const actionUrl = buildBenchmarkActionUrl(b);
    const metadata = JSON.stringify({
      benchmarkId: b.id,
      alertType: "benchmark-alert",
      actionUrl,
      ...(windowKey ? { windowKey } : {}),
      ...(providerCoverageThroughDate ? { providerCoverageThroughDate } : {}),
    });
    const nextTitle = `⚠️ Benchmark Alert: ${b.name}`;
    const nextMessage = `Current value: ${formatAlertDisplayValue(currentValue, b.unit)}. Alert threshold value: ${formatAlertDisplayValue(thresholdValue, b.unit)}`;

    // Duplicate prevention: benchmarkId + createdAt >= today
    const hasRecent = (existingAlerts || []).some((n: any) => {
      if (!n?.metadata) return false;
      try {
        const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
        if (meta?.dismissedAt) return false;
        const createdAt = new Date(n.createdAt);
        if (usesSingleActiveAlert) {
          return String(meta?.benchmarkId || "") === String(b.id) && !meta?.resolved;
        }
        if (windowKey) {
          return String(meta?.benchmarkId || "") === String(b.id) && String(meta?.windowKey || "") === windowKey;
        }
        return String(meta?.benchmarkId || "") === String(b.id) && createdAt >= today;
      } catch {
        return false;
      }
    });
    let preservedAlertId: string | undefined;
    if (usesSingleActiveAlert) {
      const sameBenchmarkAlerts = (existingAlerts || []).filter((n: any) => {
        if (!n?.metadata) return false;
        try {
          const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
          return String(meta?.benchmarkId || "") === String(b.id) && !meta?.resolved && !meta?.dismissedAt;
        } catch {
          return false;
        }
      });
      preservedAlertId = sameBenchmarkAlerts
        .sort((a: any, b: any) => new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime())[0]?.id;
      for (const alert of sameBenchmarkAlerts) {
        if (preservedAlertId && String(alert.id) === String(preservedAlertId)) continue;
        try {
          const meta = typeof alert.metadata === "string" ? JSON.parse(alert.metadata) : (alert.metadata || {});
          const changes = {
            read: true,
            metadata: JSON.stringify({
              ...meta,
              resolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedReason: "superseded",
            }),
          };
          if (transaction) await transaction.update(notifications).set(changes).where(and(eq(notifications.id, String(alert.id)), eq(notifications.campaignId, campaignId)));
          else await storage.updateNotification(String(alert.id), changes as any);
        } catch (error) {
          if (transaction && !(error instanceof SyntaxError)) throw error;
          // ignore malformed legacy metadata
        }
      }
    }
    if (hasRecent) {
      const preservedAlert = preservedAlertId
        ? (existingAlerts || []).find((alert: any) => String(alert.id) === String(preservedAlertId))
        : null;
      if (preservedAlert) {
        try {
          const meta = typeof preservedAlert.metadata === "string"
            ? JSON.parse(preservedAlert.metadata)
            : (preservedAlert.metadata || {});
          const changes = {
            title: nextTitle,
            message: nextMessage,
            priority: "high",
            campaignId,
            campaignName: campaign.name,
            metadata: JSON.stringify({
              ...meta,
              benchmarkId: b.id,
              alertType: "benchmark-alert",
              actionUrl,
              ...(windowKey ? { windowKey } : {}),
              ...(providerCoverageThroughDate ? { providerCoverageThroughDate } : {}),
            }),
          };
          if (transaction) await transaction.update(notifications).set(changes).where(and(eq(notifications.id, String(preservedAlert.id)), eq(notifications.campaignId, campaignId)));
          else await storage.updateNotification(String(preservedAlert.id), changes as any);
        } catch (error) {
          if (transaction && !(error instanceof SyntaxError)) throw error;
          // ignore malformed legacy metadata
        }
      }
      continue;
    }

    const notification: InsertNotification = {
      title: nextTitle,
      message: nextMessage,
      type: "performance-alert",
      priority: "high",
      campaignId,
      campaignName: campaign.name,
      read: false,
      metadata,
    };

    if (usesSingleActiveAlert) {
      const inserted = await alertDb.transaction(async (tx: any) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`active-alert:benchmark:${String(b.id)}`}, 0))`);
        const latestAlerts = await tx.select().from(notifications).where(eq(notifications.type, "performance-alert"));
        const activeExists = latestAlerts.some((alert: any) => {
          try {
            const meta = typeof alert?.metadata === "string" ? JSON.parse(alert.metadata) : alert?.metadata;
            return String(meta?.benchmarkId || "") === String(b.id) && !meta?.resolved && !meta?.dismissedAt;
          } catch {
            return false;
          }
        });
        if (activeExists) return false;
        await tx.insert(notifications).values(notification);
        return true;
      });
      if (inserted) created += 1;
    } else {
      await alertDb.insert(notifications).values(notification);
      created += 1;
    }
  }

  return created;
}

export async function resolveBenchmarkAlerts(benchmarkId: string, reason: "cleared" | "superseded" = "cleared", transaction?: any): Promise<void> {
  const id = String(benchmarkId || "").trim();
  if (!id) return;
  const alertDb = transaction || db;
  const [parent] = transaction ? await transaction.select({ campaignId: benchmarks.campaignId }).from(benchmarks).where(eq(benchmarks.id, id)).for("share") : [];
  if (transaction && !parent?.campaignId) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
  if (reason === "cleared") {
    await alertDb.update(benchmarks).set({ lastAlertSent: null }).where(and(
      eq(benchmarks.id, id),
      eq(benchmarks.alertFrequency, "immediate"),
      isNotNull(benchmarks.lastAlertSent),
    ));
  }
  const existingAlerts = await alertDb
    .select()
    .from(notifications)
    .where(and(eq(notifications.type, "performance-alert"), transaction ? eq(notifications.campaignId, parent.campaignId) : undefined));
  for (const alert of existingAlerts) {
    if (!alert.metadata) continue;
    try {
      const meta = typeof alert.metadata === "string" ? JSON.parse(alert.metadata) : alert.metadata;
      if (String(meta?.benchmarkId || "") !== id || meta?.resolved) continue;
      const changes = {
        read: true,
        metadata: JSON.stringify({
          ...meta,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedReason: reason,
        }),
      };
      if (transaction) await transaction.update(notifications).set(changes).where(and(eq(notifications.id, String(alert.id)), eq(notifications.campaignId, parent.campaignId)));
      else await storage.updateNotification(String(alert.id), changes as any);
    } catch (error) {
      if (transaction && !(error instanceof SyntaxError)) throw error;
      // ignore malformed legacy metadata
    }
  }
}
