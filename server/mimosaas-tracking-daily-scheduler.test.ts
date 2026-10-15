import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  getMimosaasTrackingDailyPublicationState: vi.fn(),
  claimMimosaasTrackingDailyPublicationRun: vi.fn(),
  releaseMimosaasTrackingDailyPublicationRun: vi.fn(),
  aggregateMimosaasTrackingDailyMetrics: vi.fn(),
  publishMimosaasTrackingDailySnapshot: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));

import {
  buildMimosaasTrackingPublicationQueue,
  getMimosaasTrackingDueSlot,
  isMimosaasTrackingDailySchedulerEnabled,
  runMimosaasTrackingDailySchedulerOnce,
  startMimosaasTrackingDailyScheduler,
  stopMimosaasTrackingDailyScheduler,
} from "./mimosaas-tracking-daily-scheduler";

const enabledEnv = {
  MIMOSAAS_TRACKING_ENABLED: "true",
  MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
  MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED: "true",
  MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED: "true",
  MIMOSAAS_TRACKING_DAILY_SCHEDULER_ENABLED: "true",
} as NodeJS.ProcessEnv;

const campaign = (overrides: Record<string, unknown> = {}) => ({
  id: "campaign-1",
  ownerId: "owner-1",
  clientId: "client-1",
  platform: "mimosaas-tracking",
  status: "active",
  reportingTimeZone: "Europe/Amsterdam",
  createdAt: new Date("2026-10-01T00:00:00.000Z"),
  ...overrides,
} as any);

describe("Mimosaas Tracking daily scheduler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getCampaigns.mockResolvedValue([campaign()]);
    storageMock.getMimosaasTrackingDailyPublicationState.mockResolvedValue({ latestFinalizedDate: null, pendingDates: [] });
    storageMock.claimMimosaasTrackingDailyPublicationRun.mockResolvedValue("claimed");
    storageMock.releaseMimosaasTrackingDailyPublicationRun.mockResolvedValue(true);
    storageMock.aggregateMimosaasTrackingDailyMetrics.mockResolvedValue({ id: "metric-1" });
    storageMock.publishMimosaasTrackingDailySnapshot.mockResolvedValue({ status: "published", reasons: [] });
    (global as any).__mimosaasTrackingDailySchedulerInProgress = false;
    (global as any).__mimosaasTrackingDailySchedulerInterval = null;
    (global as any).__mimosaasTrackingDailyProcessedSlots = new Set<string>();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopMimosaasTrackingDailyScheduler();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("requires every earlier tracker gate plus its own scheduler flag", () => {
    expect(isMimosaasTrackingDailySchedulerEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailySchedulerEnabled({
      ...enabledEnv,
      MIMOSAAS_TRACKING_DAILY_SCHEDULER_ENABLED: "false",
    } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailySchedulerEnabled(enabledEnv)).toBe(true);
  });

  it("uses each campaign timezone and only the latest due 08:00, 14:00, or 20:00 slot", () => {
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-10-15T05:59:59.000Z"))).toBeNull();
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-10-15T06:00:00.000Z"))).toMatchObject({
      reportingDate: "2026-10-14", hour: 8,
    });
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-10-15T12:00:00.000Z"))).toMatchObject({ hour: 14 });
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-10-15T18:00:00.000Z"))).toMatchObject({ hour: 20 });
    expect(getMimosaasTrackingDueSlot(campaign({ reportingTimeZone: "Europe/London" }), new Date("2026-10-15T07:00:00.000Z"))).toMatchObject({
      reportingDate: "2026-10-14", hour: 8,
    });
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-03-30T06:00:00.000Z"))).toMatchObject({
      reportingDate: "2026-03-29", hour: 8,
    });
    expect(getMimosaasTrackingDueSlot(campaign(), new Date("2026-10-26T07:00:00.000Z"))).toMatchObject({
      reportingDate: "2026-10-25", hour: 8,
    });
    expect(getMimosaasTrackingDueSlot(campaign({ reportingTimeZone: "Invalid/Zone" }), new Date("2026-10-15T08:00:00.000Z"))).toBeNull();
  });

  it("queues durable pending dates and every missing date after the last finalized snapshot", () => {
    expect(buildMimosaasTrackingPublicationQueue("2026-10-14", {
      latestFinalizedDate: "2026-10-11",
      pendingDates: ["2026-10-13"],
    })).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(buildMimosaasTrackingPublicationQueue("2026-10-14", {
      latestFinalizedDate: "2026-10-14",
      pendingDates: [],
    })).toEqual([]);
    expect(() => buildMimosaasTrackingPublicationQueue("2026-10-14", {
      latestFinalizedDate: null,
      pendingDates: ["invalid"],
    })).toThrow("publication state is invalid");
  });

  it("does no database or timer work while disabled", async () => {
    await expect(runMimosaasTrackingDailySchedulerOnce(new Date("2026-10-15T06:00:00.000Z"), storageMock as any, {} as NodeJS.ProcessEnv))
      .resolves.toMatchObject({ skipped: true, reason: "disabled" });
    startMimosaasTrackingDailyScheduler({} as NodeJS.ProcessEnv);
    await Promise.resolve();
    expect(storageMock.getCampaigns).not.toHaveBeenCalled();
    expect((global as any).__mimosaasTrackingDailySchedulerInterval).toBeFalsy();
  });

  it("aggregates before publishing the exact previous local day", async () => {
    const order: string[] = [];
    storageMock.aggregateMimosaasTrackingDailyMetrics.mockImplementation(async () => { order.push("aggregate"); return { id: "metric-1" }; });
    storageMock.publishMimosaasTrackingDailySnapshot.mockImplementation(async () => { order.push("publish"); return { status: "published", reasons: [] }; });

    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T06:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toEqual({
      skipped: false,
      campaignsScanned: 1,
      campaignsDue: 1,
      datesAttempted: 1,
      datesFinalized: 1,
      datesPending: 0,
      datesFailed: 0,
    });
    expect(order).toEqual(["aggregate", "publish"]);
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics).toHaveBeenCalledWith(
      "owner-1", "client-1", "campaign-1", "2026-10-14", new Date("2026-10-15T06:00:00.000Z"),
    );
  });

  it("keeps configured-source publication pending and stops before newer dates", async () => {
    storageMock.getMimosaasTrackingDailyPublicationState.mockResolvedValue({
      latestFinalizedDate: "2026-10-12", pendingDates: ["2026-10-13"],
    });
    storageMock.publishMimosaasTrackingDailySnapshot.mockResolvedValue({
      status: "pending", reasons: ["financial_snapshot_pending"],
    });

    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T12:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toMatchObject({ datesAttempted: 1, datesFinalized: 0, datesPending: 1, datesFailed: 0 });
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics).toHaveBeenCalledTimes(1);
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics.mock.calls[0][3]).toBe("2026-10-13");
  });

  it("does not aggregate while another application instance owns the durable attempt", async () => {
    storageMock.claimMimosaasTrackingDailyPublicationRun.mockResolvedValue("busy");

    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T06:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toMatchObject({ datesAttempted: 1, datesPending: 1, datesFinalized: 0, datesFailed: 0 });
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics).not.toHaveBeenCalled();
    expect(storageMock.publishMimosaasTrackingDailySnapshot).not.toHaveBeenCalled();
  });

  it("releases a failed claimed attempt so the next configured slot can retry it", async () => {
    storageMock.aggregateMimosaasTrackingDailyMetrics.mockRejectedValue(new Error("aggregation failed"));

    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T06:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toMatchObject({ datesAttempted: 1, datesFailed: 1 });
    expect(storageMock.releaseMimosaasTrackingDailyPublicationRun).toHaveBeenCalledWith(
      "owner-1", "client-1", "campaign-1", "2026-10-14", "scheduler_attempt_failed",
    );
  });

  it("isolates campaign failures and rejects inactive, GA4, unowned, and newly created scopes", async () => {
    storageMock.getCampaigns.mockResolvedValue([
      campaign(),
      campaign({ id: "campaign-2" }),
      campaign({ id: "inactive", status: "inactive" }),
      campaign({ id: "ga4", platform: "ga4" }),
      campaign({ id: "unowned", ownerId: null }),
      campaign({ id: "new", createdAt: new Date("2026-10-15T05:00:00.000Z") }),
    ]);
    storageMock.getMimosaasTrackingDailyPublicationState
      .mockRejectedValueOnce(new Error("database failure"))
      .mockResolvedValueOnce({ latestFinalizedDate: null, pendingDates: [] });

    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T06:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toMatchObject({ campaignsScanned: 6, campaignsDue: 2, datesFinalized: 1, datesFailed: 1 });
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics).toHaveBeenCalledTimes(1);
  });

  it("skips overlap and does not repeat a completed local slot in one process", async () => {
    (global as any).__mimosaasTrackingDailySchedulerInProgress = true;
    await expect(runMimosaasTrackingDailySchedulerOnce(
      new Date("2026-10-15T06:00:00.000Z"), storageMock as any, enabledEnv,
    )).resolves.toMatchObject({ skipped: true, reason: "overlap" });
    (global as any).__mimosaasTrackingDailySchedulerInProgress = false;

    await runMimosaasTrackingDailySchedulerOnce(new Date("2026-10-15T06:01:00.000Z"), storageMock as any, enabledEnv);
    await runMimosaasTrackingDailySchedulerOnce(new Date("2026-10-15T06:02:00.000Z"), storageMock as any, enabledEnv);
    expect(storageMock.aggregateMimosaasTrackingDailyMetrics).toHaveBeenCalledTimes(1);
  });
});
