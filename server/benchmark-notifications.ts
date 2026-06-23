import { db } from "./db";
import { benchmarks, linkedinDailyMetrics, notifications } from "../shared/schema";
import { desc, eq } from "drizzle-orm";
import type { InsertNotification } from "../shared/schema";
import { storage } from "./storage";
import { resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";
import { evaluateAlertThreshold, parseAlertNumber } from "./utils/alert-evaluation";

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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const items = await db
    .select()
    .from(benchmarks)
    .where(eq(benchmarks.status, "active"));

  // Pull all performance-alert notifications once and do metadata matching in-memory (cheap at current scale).
  const existingAlerts = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "performance-alert"));

  let created = 0;
  const windowKeyByCampaign = new Map<string, string>();
  const campaignMetricCache = new Map<string, Promise<any>>();

  for (const rawBenchmark of items as any[]) {
    const b = await resolveCampaignCurrentValueForAlert(rawBenchmark, campaignMetricCache);
    const thresholdRaw = b.alertThreshold;
    const currentRaw = b.currentValue;
    const platformType = String((b?.platformType || "")).trim().toLowerCase();
    const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";
    if (!b.alertsEnabled || thresholdRaw === null || typeof thresholdRaw === "undefined") {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
      continue;
    }

    const evaluation = evaluateAlertThreshold({
      currentValue: currentRaw,
      thresholdValue: thresholdRaw,
      condition: b.alertCondition,
    });
    const { currentValue, thresholdValue } = evaluation;
    if (!Number.isFinite(thresholdValue)) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
      continue;
    }
    if (!Number.isFinite(currentValue)) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
      continue;
    }

    if (!evaluation.triggered) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
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
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
      continue;
    }
    const campaign = await storage.getCampaign(campaignId).catch(() => undefined);
    if (!campaign) {
      if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");
      continue;
    }

    const actionUrl = buildBenchmarkActionUrl(b);
    const metadata = JSON.stringify({
      benchmarkId: b.id,
      alertType: "benchmark-alert",
      actionUrl,
      ...(windowKey ? { windowKey } : {}),
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
          await storage.updateNotification(String(alert.id), {
            read: true,
            metadata: JSON.stringify({
              ...meta,
              resolved: true,
              resolvedAt: new Date().toISOString(),
              resolvedReason: "superseded",
            }),
          } as any);
        } catch {
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
          await storage.updateNotification(String(preservedAlert.id), {
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
            }),
          } as any);
        } catch {
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

    await db.insert(notifications).values(notification);
    created += 1;
  }

  return created;
}

export async function resolveBenchmarkAlerts(benchmarkId: string, reason: "cleared" | "superseded" = "cleared"): Promise<void> {
  const id = String(benchmarkId || "").trim();
  if (!id) return;
  const existingAlerts = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "performance-alert"));
  for (const alert of existingAlerts) {
    if (!alert.metadata) continue;
    try {
      const meta = typeof alert.metadata === "string" ? JSON.parse(alert.metadata) : alert.metadata;
      if (String(meta?.benchmarkId || "") !== id || meta?.resolved) continue;
      await storage.updateNotification(String(alert.id), {
        read: true,
        metadata: JSON.stringify({
          ...meta,
          resolved: true,
          resolvedAt: new Date().toISOString(),
          resolvedReason: reason,
        }),
      } as any);
    } catch {
      // ignore malformed legacy metadata
    }
  }
}
