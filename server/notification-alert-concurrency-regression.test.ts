import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const state = {
    alerts: [] as any[],
    benchmarks: [] as any[],
    lockTail: Promise.resolve(),
    nextId: 1,
    failLock: false,
    campaignOwnerId: "owner-1",
  };
  const execute = vi.fn();
  const insert = vi.fn();
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
    let releaseLock: (() => void) | null = null;
    let lockAcquired = false;
    const tx = {
      execute: vi.fn(async (query: any) => {
        execute(query);
        if (state.failLock) throw new Error("advisory lock failed");
        const previous = state.lockTail;
        state.lockTail = new Promise<void>((resolve) => { releaseLock = resolve; });
        await previous;
        lockAcquired = true;
      }),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => state.alerts.slice()),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(async (values: any) => {
          insert(values);
          state.alerts.push({
            id: `notification-${state.nextId++}`,
            createdAt: new Date(),
            ...values,
          });
        }),
      })),
    };
    try {
      return await callback(tx);
    } finally {
      if (lockAcquired) releaseLock?.();
    }
  });
  return { state, execute, insert, transaction };
});

vi.mock("./db", async () => {
  const { benchmarks } = await import("../shared/schema");
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: any) => ({
          where: vi.fn(async () => table === benchmarks ? mocks.state.benchmarks.slice() : []),
        })),
      })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })),
      transaction: mocks.transaction,
    },
    pool: null,
  };
});

vi.mock("./storage", () => ({
  storage: {
    getCampaign: vi.fn(async () => ({ id: "campaign-1", name: "Campaign One", ownerId: mocks.state.campaignOwnerId })),
    getLinkedInConnection: vi.fn(async () => undefined),
    updateNotification: vi.fn(),
  },
}));

vi.mock("./utils/ga4-alert-current-value", () => ({
  resolveAlertCurrentValueForDecision: vi.fn(async (row: any) => row),
}));

import { createKPIAlert } from "./kpi-notifications";
import { checkGA4BenchmarkPerformanceAlertsForCampaign } from "./benchmark-notifications";
import { db } from "./db";
import { storage } from "./storage";

const breachedRule = {
  campaignId: "campaign-1",
  platformType: "google_analytics",
  alertsEnabled: true,
  alertThreshold: "100",
  alertCondition: "below",
  currentValue: "50",
  unit: "count",
};

describe("active notification concurrency regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.alerts = [];
    mocks.state.benchmarks = [];
    mocks.state.lockTail = Promise.resolve();
    mocks.state.nextId = 1;
    mocks.state.failLock = false;
    mocks.state.campaignOwnerId = "owner-1";
  });

  it("creates one active KPI alert under concurrent reconciliation and retains dismissed history", async () => {
    mocks.state.alerts.push({
      id: "dismissed",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      metadata: JSON.stringify({ kpiId: "kpi-1", dismissedAt: "2026-09-20T11:00:00.000Z" }),
    });
    const kpi = { id: "kpi-1", name: "Sessions", priority: "high", ...breachedRule } as any;

    await Promise.all([createKPIAlert(kpi), createKPIAlert(kpi)]);

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.state.alerts).toHaveLength(2);
    expect(mocks.state.alerts[0].id).toBe("dismissed");
  });

  it("creates one active Benchmark alert under concurrent reconciliation", async () => {
    mocks.state.benchmarks = [{ id: "benchmark-1", name: "Sessions floor", status: "active", ...breachedRule }];

    const results = await Promise.all([
      checkGA4BenchmarkPerformanceAlertsForCampaign("campaign-1", "2026-09-20"),
      checkGA4BenchmarkPerformanceAlertsForCampaign("campaign-1", "2026-09-20"),
    ]);

    expect(mocks.execute).toHaveBeenCalledTimes(2);
    expect(mocks.insert).toHaveBeenCalledTimes(1);
    expect(mocks.state.alerts).toHaveLength(1);
    expect(results.reduce((sum, value) => sum + value, 0)).toBe(1);
  });

  it("permits a new breach after the prior alert was resolved", async () => {
    mocks.state.alerts.push({
      id: "resolved",
      createdAt: new Date("2026-09-20T10:00:00.000Z"),
      metadata: JSON.stringify({ benchmarkId: "benchmark-1", resolved: true, resolvedReason: "cleared" }),
    });
    mocks.state.benchmarks = [{ id: "benchmark-1", name: "Sessions floor", status: "active", ...breachedRule }];

    await expect(checkGA4BenchmarkPerformanceAlertsForCampaign("campaign-1", "2026-09-20")).resolves.toBe(1);
    expect(mocks.state.alerts).toHaveLength(2);
    expect(mocks.state.alerts[0].id).toBe("resolved");
  });

  it("fails closed when the insert lock cannot be acquired", async () => {
    mocks.state.failLock = true;
    const kpi = { id: "kpi-1", name: "Sessions", priority: "high", ...breachedRule } as any;

    await expect(createKPIAlert(kpi)).rejects.toThrow("advisory lock failed");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.state.alerts).toHaveLength(0);
  });

  it("does not create a GA4 KPI alert for a legacy campaign without an owner", async () => {
    mocks.state.campaignOwnerId = "";
    const kpi = { id: "kpi-1", name: "Sessions", priority: "high", ...breachedRule } as any;

    await createKPIAlert(kpi);

    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.state.alerts).toHaveLength(0);
  });

  it("preserves GA4 KPI alert state when campaign lookup fails", async () => {
    vi.mocked(storage.getCampaign).mockRejectedValueOnce(new Error("campaign lookup failed"));
    const kpi = { id: "kpi-1", name: "Sessions", priority: "high", ...breachedRule } as any;

    await expect(createKPIAlert(kpi)).rejects.toThrow("campaign lookup failed");
    expect(db.update).not.toHaveBeenCalled();
    expect(storage.updateNotification).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("still resolves a GA4 KPI alert when the campaign is confirmed missing", async () => {
    vi.mocked(storage.getCampaign).mockResolvedValueOnce(undefined);
    const kpi = { id: "kpi-1", name: "Sessions", priority: "high", ...breachedRule } as any;

    await createKPIAlert(kpi);
    expect(db.update).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("preserves GA4 Benchmark alert state when campaign lookup fails", async () => {
    mocks.state.benchmarks = [{ id: "benchmark-1", name: "Sessions floor", status: "active", ...breachedRule }];
    vi.mocked(storage.getCampaign).mockRejectedValueOnce(new Error("campaign lookup failed"));

    await expect(checkGA4BenchmarkPerformanceAlertsForCampaign("campaign-1", "2026-09-20"))
      .rejects.toThrow("campaign lookup failed");
    expect(db.update).not.toHaveBeenCalled();
    expect(storage.updateNotification).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("still resolves a GA4 Benchmark alert when the campaign is confirmed missing", async () => {
    mocks.state.benchmarks = [{ id: "benchmark-1", name: "Sessions floor", status: "active", ...breachedRule }];
    vi.mocked(storage.getCampaign).mockResolvedValueOnce(undefined);

    await expect(checkGA4BenchmarkPerformanceAlertsForCampaign("campaign-1", "2026-09-20")).resolves.toBe(0);
    expect(db.update).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
