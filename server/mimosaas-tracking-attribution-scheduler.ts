import { storage, type IStorage } from "./storage";
import { resolveMimosaasTrackingGclidEvent } from "./mimosaas-tracking-google-ads-attribution";

type MimosaasTrackingAttributionSchedulerConfig = {
  enabled: boolean;
  googleAdsEnabled: boolean;
  returningDirectEnabled: boolean;
  intervalMs: number;
  batchSize: number;
};

export type MimosaasTrackingAttributionRunResult = {
  skipped: boolean;
  reason?: "overlap";
  scanned: number;
  processed: number;
  failed: number;
};

const DEFAULT_INTERVAL_MS = 60 * 1000;
const MIN_INTERVAL_MS = 15 * 1000;
const MAX_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

const boundedInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : fallback, min), max);
};

export function getMimosaasTrackingAttributionSchedulerConfig(
  env: NodeJS.ProcessEnv = process.env,
): MimosaasTrackingAttributionSchedulerConfig {
  const enabled = String(env.MIMOSAAS_TRACKING_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_INGESTION_ENABLED || "").trim().toLowerCase() === "true";
  return {
    enabled,
    googleAdsEnabled: enabled && String(env.MIMOSAAS_TRACKING_GOOGLE_ADS_ATTRIBUTION_ENABLED || "").trim().toLowerCase() === "true",
    returningDirectEnabled: enabled && String(env.MIMOSAAS_TRACKING_RETURNING_DIRECT_ATTRIBUTION_ENABLED || "").trim().toLowerCase() === "true",
    intervalMs: boundedInt(env.MIMOSAAS_TRACKING_ATTRIBUTION_INTERVAL_MS, DEFAULT_INTERVAL_MS, MIN_INTERVAL_MS, MAX_INTERVAL_MS),
    batchSize: boundedInt(env.MIMOSAAS_TRACKING_ATTRIBUTION_BATCH_SIZE, DEFAULT_BATCH_SIZE, 1, MAX_BATCH_SIZE),
  };
}

export async function runMimosaasTrackingAttributionOnce(
  batchSize = DEFAULT_BATCH_SIZE,
  store: Pick<IStorage, "getPendingMimosaasTrackingUtmAttributionEvents" | "resolveMimosaasTrackingUtmAttribution" | "getPendingMimosaasTrackingGclidAttributionEvents" | "getPendingMimosaasTrackingReturningDirectAttributionEvents" | "resolveMimosaasTrackingReturningDirectAttribution"> = storage,
  googleAdsEnabled = false,
  resolveGclid: typeof resolveMimosaasTrackingGclidEvent = resolveMimosaasTrackingGclidEvent,
  returningDirectEnabled = false,
): Promise<MimosaasTrackingAttributionRunResult> {
  if ((global as any).__mimosaasTrackingAttributionInProgress) {
    return { skipped: true, reason: "overlap", scanned: 0, processed: 0, failed: 0 };
  }

  (global as any).__mimosaasTrackingAttributionInProgress = true;
  try {
    const events = await store.getPendingMimosaasTrackingUtmAttributionEvents(batchSize);
    const gclidEvents = googleAdsEnabled ? await store.getPendingMimosaasTrackingGclidAttributionEvents(batchSize) : [];
    const returningDirectEvents = returningDirectEnabled ? await store.getPendingMimosaasTrackingReturningDirectAttributionEvents(batchSize) : [];
    let processed = 0;
    let failed = 0;
    for (const event of events) {
      try {
        await store.resolveMimosaasTrackingUtmAttribution(event.websiteConnectionId, event.eventId);
        processed += 1;
      } catch (error: any) {
        failed += 1;
        console.error(`[Mimosaas Tracking Attribution] Retry failed for event ${event.eventId}:`, error?.message || error);
      }
    }
    for (const event of gclidEvents) {
      try {
        await resolveGclid(event.websiteConnectionId, event.eventId);
        processed += 1;
      } catch (error: any) {
        failed += 1;
        console.error(`[Mimosaas Tracking Attribution] Google Ads retry failed for event ${event.eventId}:`, error?.message || error);
      }
    }
    for (const event of returningDirectEvents) {
      try {
        await store.resolveMimosaasTrackingReturningDirectAttribution(event.websiteConnectionId, event.eventId);
        processed += 1;
      } catch (error: any) {
        failed += 1;
        console.error(`[Mimosaas Tracking Attribution] Returning-direct retry failed for event ${event.eventId}:`, error?.message || error);
      }
    }
    return { skipped: false, scanned: events.length + gclidEvents.length + returningDirectEvents.length, processed, failed };
  } finally {
    (global as any).__mimosaasTrackingAttributionInProgress = false;
  }
}

export function startMimosaasTrackingAttributionScheduler(
  config = getMimosaasTrackingAttributionSchedulerConfig(),
): void {
  if (!config.enabled) {
    console.log("[Mimosaas Tracking Attribution] Disabled by tracker feature flags");
    return;
  }
  if ((global as any).__mimosaasTrackingAttributionInterval) return;

  const run = () => runMimosaasTrackingAttributionOnce(config.batchSize, storage, config.googleAdsEnabled, resolveMimosaasTrackingGclidEvent, config.returningDirectEnabled).catch((error: any) => {
    console.error("[Mimosaas Tracking Attribution] Batch failed:", error?.message || error);
  });
  void run();
  (global as any).__mimosaasTrackingAttributionInterval = setInterval(run, config.intervalMs);
}

export function stopMimosaasTrackingAttributionScheduler(): void {
  if ((global as any).__mimosaasTrackingAttributionInterval) {
    clearInterval((global as any).__mimosaasTrackingAttributionInterval);
    (global as any).__mimosaasTrackingAttributionInterval = null;
  }
  (global as any).__mimosaasTrackingAttributionInProgress = false;
}
