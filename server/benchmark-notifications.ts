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

function isIsoCurrencyCode(unit: string): boolean {
  return /^[A-Z]{3}$/.test(String(unit || "").trim());
}

function formatPct(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.round(rounded)}%`;
  return `${rounded.toFixed(1)}%`;
}

function formatAlertDisplayValue(input: unknown, unit: unknown): string {
  const num = parseLooseNumber(input);
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
    const isGA4 = String((b?.platformType || "")).trim().toLowerCase() === "google_analytics";
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
        if (isGA4) {
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

    const actionUrl = buildBenchmarkActionUrl(b);
    const metadata = JSON.stringify({
      benchmarkId: b.id,
      alertType: "benchmark-alert",
      actionUrl,
      ...(windowKey ? { windowKey } : {}),
    });

    const notification: InsertNotification = {
      title: `⚠️ Benchmark Alert: ${b.name}`,
      message: `Current value: ${formatAlertDisplayValue(currentValue, b.unit)}. Alert threshold value: ${formatAlertDisplayValue(thresholdValue, b.unit)}`,
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


