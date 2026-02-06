import { db } from "./db";
import { benchmarks, linkedinDailyMetrics, notifications } from "../shared/schema";
import { and, desc, eq } from "drizzle-orm";
import type { InsertNotification } from "../shared/schema";
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

function shouldTriggerBenchmarkAlert(opts: {
  currentValue: number;
  thresholdValue: number;
  condition: 'below' | 'above' | 'equals';
}): boolean {
  const { currentValue, thresholdValue, condition } = opts;
  switch (condition) {
    case 'below':
      return currentValue < thresholdValue;
    case 'above':
      return currentValue > thresholdValue;
    case 'equals':
      return Math.abs(currentValue - thresholdValue) < 0.01;
    default:
      return false;
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
    .where(and(eq(benchmarks.status, "active"), eq(benchmarks.alertsEnabled, true)));

  // Pull all performance-alert notifications once and do metadata matching in-memory (cheap at current scale).
  const existingAlerts = await db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "performance-alert"));

  let created = 0;
  const windowKeyByCampaign = new Map<string, string>();

  for (const b of items as any[]) {
    const thresholdRaw = b.alertThreshold;
    const currentRaw = b.currentValue;
    if (thresholdRaw === null || typeof thresholdRaw === "undefined") continue;

    const thresholdValue = parseLooseNumber(thresholdRaw);
    const currentValue = parseLooseNumber(currentRaw ?? "0");
    if (!Number.isFinite(thresholdValue)) continue;
    if (!Number.isFinite(currentValue)) continue;

    const condition = (String(b.alertCondition || "below") as any) as 'below' | 'above' | 'equals';
    if (!shouldTriggerBenchmarkAlert({ currentValue, thresholdValue, condition })) continue;

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

    // Duplicate prevention: benchmarkId + createdAt >= today
    const hasRecent = (existingAlerts || []).some((n: any) => {
      if (!n?.metadata) return false;
      try {
        const meta = typeof n.metadata === "string" ? JSON.parse(n.metadata) : n.metadata;
        const createdAt = new Date(n.createdAt);
        if (windowKey) {
          return String(meta?.benchmarkId || "") === String(b.id) && String(meta?.windowKey || "") === windowKey;
        }
        return String(meta?.benchmarkId || "") === String(b.id) && createdAt >= today;
      } catch {
        return false;
      }
    });
    if (hasRecent) continue;

    let campaignName: string | undefined = undefined;
    if (b.campaignId) {
      try {
        const c = await storage.getCampaign(String(b.campaignId));
        campaignName = c?.name;
      } catch {
        // ignore
      }
    }

    const benchmarkValue = parseLooseNumber(b.benchmarkValue ?? "0");
    const unit = String(b.unit || "");
    const actionUrl = buildBenchmarkActionUrl(b);

    const gapText =
      Number.isFinite(benchmarkValue) && benchmarkValue > 0
        ? `${Math.abs(((currentValue - benchmarkValue) / benchmarkValue) * 100).toFixed(1)}% ${currentValue >= benchmarkValue ? "above" : "below"}`
        : (currentValue >= thresholdValue ? "above" : "below");

    const metadata = JSON.stringify({
      benchmarkId: b.id,
      alertType: "benchmark-alert",
      actionUrl,
      ...(windowKey ? { windowKey } : {}),
    });

    const notification: InsertNotification = {
      title: `⚠️ Benchmark Alert: ${b.name}`,
      message: `Current value (${Number(currentValue).toFixed(2)}${unit}) is ${gapText} your benchmark (${Number(benchmarkValue || 0).toFixed(2)}${unit}). Alert threshold: ${Number(thresholdValue).toFixed(2)}${unit}`,
      type: "performance-alert",
      priority: "high",
      campaignId: b.campaignId || undefined,
      campaignName,
      read: false,
      metadata,
    };

    await db.insert(notifications).values(notification);
    created += 1;
  }

  return created;
}


