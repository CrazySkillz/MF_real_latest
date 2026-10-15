import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getPendingMimosaasTrackingUtmAttributionEvents: vi.fn(),
  getPendingMimosaasTrackingGclidAttributionEvents: vi.fn(),
  getPendingMimosaasTrackingReturningDirectAttributionEvents: vi.fn(),
  resolveMimosaasTrackingUtmAttribution: vi.fn(),
  resolveMimosaasTrackingReturningDirectAttribution: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));

import {
  getMimosaasTrackingAttributionSchedulerConfig,
  runMimosaasTrackingAttributionOnce,
  startMimosaasTrackingAttributionScheduler,
  stopMimosaasTrackingAttributionScheduler,
} from "./mimosaas-tracking-attribution-scheduler";

describe("Mimosaas Tracking attribution recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getPendingMimosaasTrackingUtmAttributionEvents.mockResolvedValue([]);
    storageMock.getPendingMimosaasTrackingGclidAttributionEvents.mockResolvedValue([]);
    storageMock.getPendingMimosaasTrackingReturningDirectAttributionEvents.mockResolvedValue([]);
    storageMock.resolveMimosaasTrackingUtmAttribution.mockResolvedValue({ status: "attributed" });
    storageMock.resolveMimosaasTrackingReturningDirectAttribution.mockResolvedValue({ status: "attributed" });
    (global as any).__mimosaasTrackingAttributionInProgress = false;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopMimosaasTrackingAttributionScheduler();
    vi.restoreAllMocks();
  });

  it("stays disabled unless setup and ingestion are both enabled", () => {
    expect(getMimosaasTrackingAttributionSchedulerConfig({} as NodeJS.ProcessEnv).enabled).toBe(false);
    expect(getMimosaasTrackingAttributionSchedulerConfig({ MIMOSAAS_TRACKING_ENABLED: "true" } as NodeJS.ProcessEnv).enabled).toBe(false);
    const enabledWithoutOptionalResolvers = getMimosaasTrackingAttributionSchedulerConfig({
      MIMOSAAS_TRACKING_ENABLED: "true",
      MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
    } as NodeJS.ProcessEnv);
    expect(enabledWithoutOptionalResolvers.enabled).toBe(true);
    expect(enabledWithoutOptionalResolvers.googleAdsEnabled).toBe(false);
    expect(enabledWithoutOptionalResolvers.returningDirectEnabled).toBe(false);
    expect(getMimosaasTrackingAttributionSchedulerConfig({
      MIMOSAAS_TRACKING_ENABLED: "true",
      MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
      MIMOSAAS_TRACKING_GOOGLE_ADS_ATTRIBUTION_ENABLED: "true",
    } as NodeJS.ProcessEnv).googleAdsEnabled).toBe(true);
    expect(getMimosaasTrackingAttributionSchedulerConfig({
      MIMOSAAS_TRACKING_ENABLED: "true",
      MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
      MIMOSAAS_TRACKING_RETURNING_DIRECT_ATTRIBUTION_ENABLED: "true",
    } as NodeJS.ProcessEnv).returningDirectEnabled).toBe(true);
  });

  it("bounds interval and batch configuration", () => {
    const minimum = getMimosaasTrackingAttributionSchedulerConfig({
      MIMOSAAS_TRACKING_ATTRIBUTION_INTERVAL_MS: "1",
      MIMOSAAS_TRACKING_ATTRIBUTION_BATCH_SIZE: "0",
    } as NodeJS.ProcessEnv);
    const maximum = getMimosaasTrackingAttributionSchedulerConfig({
      MIMOSAAS_TRACKING_ATTRIBUTION_INTERVAL_MS: "99999999",
      MIMOSAAS_TRACKING_ATTRIBUTION_BATCH_SIZE: "999999",
    } as NodeJS.ProcessEnv);

    expect(minimum).toMatchObject({ intervalMs: 15_000, batchSize: 1 });
    expect(maximum).toMatchObject({ intervalMs: 3_600_000, batchSize: 1000 });
  });

  it("performs no storage work while the tracker feature flags are disabled", async () => {
    startMimosaasTrackingAttributionScheduler({ enabled: false, googleAdsEnabled: false, returningDirectEnabled: false, intervalMs: 60_000, batchSize: 100 });
    await Promise.resolve();

    expect(storageMock.getPendingMimosaasTrackingUtmAttributionEvents).not.toHaveBeenCalled();
    expect((global as any).__mimosaasTrackingAttributionInterval).toBeFalsy();
  });

  it("retries one bounded batch and continues after an individual event fails", async () => {
    storageMock.getPendingMimosaasTrackingUtmAttributionEvents.mockResolvedValue([
      { websiteConnectionId: "website-1", eventId: "event-1" },
      { websiteConnectionId: "website-2", eventId: "event-2" },
      { websiteConnectionId: "website-3", eventId: "event-3" },
    ]);
    storageMock.resolveMimosaasTrackingUtmAttribution
      .mockResolvedValueOnce({ status: "attributed" })
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({ status: "unattributed" });

    await expect(runMimosaasTrackingAttributionOnce(25)).resolves.toEqual({
      skipped: false, scanned: 3, processed: 2, failed: 1,
    });
    expect(storageMock.getPendingMimosaasTrackingUtmAttributionEvents).toHaveBeenCalledWith(25);
    expect(storageMock.resolveMimosaasTrackingUtmAttribution).toHaveBeenNthCalledWith(3, "website-3", "event-3");
  });

  it("skips overlapping runs without selecting another batch", async () => {
    (global as any).__mimosaasTrackingAttributionInProgress = true;

    await expect(runMimosaasTrackingAttributionOnce()).resolves.toEqual({
      skipped: true, reason: "overlap", scanned: 0, processed: 0, failed: 0,
    });
    expect(storageMock.getPendingMimosaasTrackingUtmAttributionEvents).not.toHaveBeenCalled();
  });

  it("processes gclid events only when the separate Google Ads attribution flag is enabled", async () => {
    const resolveGclid = vi.fn().mockResolvedValue({ status: "attributed" });
    storageMock.getPendingMimosaasTrackingGclidAttributionEvents.mockResolvedValue([
      { websiteConnectionId: "website-1", eventId: "gclid-event-1" },
    ]);

    await expect(runMimosaasTrackingAttributionOnce(25, storageMock as any, true, resolveGclid)).resolves.toEqual({
      skipped: false, scanned: 1, processed: 1, failed: 0,
    });
    expect(resolveGclid).toHaveBeenCalledWith("website-1", "gclid-event-1");
  });

  it("processes returning-direct events only when their separate flag is enabled", async () => {
    storageMock.getPendingMimosaasTrackingReturningDirectAttributionEvents.mockResolvedValue([
      { websiteConnectionId: "website-1", eventId: "direct-event-1" },
    ]);

    await expect(runMimosaasTrackingAttributionOnce(25, storageMock as any, false, vi.fn(), true)).resolves.toEqual({
      skipped: false, scanned: 1, processed: 1, failed: 0,
    });
    expect(storageMock.resolveMimosaasTrackingReturningDirectAttribution).toHaveBeenCalledWith("website-1", "direct-event-1");
  });

  it("selects only unresolved explicit UTM events without gclid and starts from server startup", () => {
    const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const selector = storageSource.slice(
      storageSource.indexOf("async getPendingMimosaasTrackingUtmAttributionEvents"),
      storageSource.indexOf("async resolveMimosaasTrackingUtmAttribution"),
    );
    const gclidSelector = storageSource.slice(
      storageSource.indexOf("async getPendingMimosaasTrackingGclidAttributionEvents"),
      storageSource.indexOf("async getMimosaasTrackingGclidAttributionContext"),
    );
    const returningDirectSelector = storageSource.slice(
      storageSource.indexOf("async getPendingMimosaasTrackingReturningDirectAttributionEvents"),
      storageSource.indexOf("async getMimosaasTrackingGclidAttributionContext"),
    );
    const indexSource = readFileSync(join(process.cwd(), "server", "index.ts"), "utf8");

    expect(selector).toContain('eq(mimosaasTrackingEvents.campaignResolutionStatus, "pending")');
    expect(selector).toContain("isNull(mimosaasTrackingEvents.resolvedCampaignId)");
    expect(selector).toContain("mimosaasTrackingEvents.utmCampaign");
    expect(selector).toContain("mimosaasTrackingEvents.gclid");
    expect(selector).toContain('eq(mimosaasTrackingAttributions.status, "pending")');
    expect(selector).toContain("orderBy(asc(mimosaasTrackingEvents.receivedAt)");
    expect(gclidSelector).toContain("CURRENT_TIMESTAMP - INTERVAL '15 minutes'");
    expect(gclidSelector).toContain("COALESCE(${mimosaasTrackingAttributions.updatedAt}");
    expect(returningDirectSelector).toContain("CURRENT_TIMESTAMP - INTERVAL '15 minutes'");
    expect(returningDirectSelector).toContain("mimosaasTrackingEvents.utmCampaign");
    expect(returningDirectSelector).toContain("mimosaasTrackingEvents.gclid");
    expect(indexSource).toContain('import { startMimosaasTrackingAttributionScheduler } from "./mimosaas-tracking-attribution-scheduler";');
    expect(indexSource).toContain("startMimosaasTrackingAttributionScheduler();");
  });
});
