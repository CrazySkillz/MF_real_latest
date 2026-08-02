import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalState = () => ({
    kpi: { id: "kpi-1", campaignId: "campaign-1" } as null | { id: string; campaignId: string },
    progress: ["progress-1"],
    alerts: ["alert-1"],
    periods: ["period-1"],
    notifications: [
      { id: "notification-1", campaignId: "campaign-1", read: false, metadata: '{"kpiId":"kpi-1"}' },
      { id: "notification-2", campaignId: "campaign-2", read: false, metadata: '{"kpiId":"kpi-1"}' },
    ],
  });
  const state = {
    value: originalState(),
    failureStage: null as null | "notification" | "periods" | "parent",
    deleteIndex: 0,
  };
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => state.value.kpi ? [{ ...state.value.kpi }] : []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (state.failureStage === "notification") throw new Error("forced notification hide failure");
            state.value.notifications[0] = { ...state.value.notifications[0], ...values };
            return [{ id: "notification-1" }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        const index = state.deleteIndex++;
        if (index === 0) state.value.progress = [];
        if (index === 1) state.value.alerts = [];
        if (index === 2) {
          if (state.failureStage === "periods") throw new Error("forced KPI period delete failure");
          state.value.periods = [];
        }
        if (index === 3 && state.failureStage !== "parent") state.value.kpi = null;
        return { rowCount: index === 3 && state.failureStage === "parent" ? 0 : 1 };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = structuredClone(state.value);
    state.deleteIndex = 0;
    try {
      return await callback(tx);
    } catch (error) {
      state.value = before;
      throw error;
    }
  });
  return { originalState, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";
import { kpiAlerts, kpiPeriods, kpiProgress, kpis } from "../shared/schema";

describe("GA4 KPI Commit 9 persistence and destructive safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.value = mocks.originalState();
    mocks.state.failureStage = null;
    mocks.state.deleteIndex = 0;
  });

  it("keeps KPI progress schema and startup migration at numeric(18,2)", () => {
    const schema = readFileSync(join(process.cwd(), "shared", "schema.ts"), "utf8");
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf8");
    const progressStart = schema.indexOf('export const kpiProgress = pgTable("kpi_progress"');
    const progressEnd = schema.indexOf('export const kpiAlerts = pgTable("kpi_alerts"', progressStart);
    const progress = schema.slice(progressStart, progressEnd);

    expect(progress.match(/precision: 18, scale: 2/g)).toHaveLength(3);
    expect(progress).not.toContain("precision: 10, scale: 2");
    expect(index).toContain("ALTER TABLE kpi_progress");
    expect(index).toContain("ALTER COLUMN value TYPE DECIMAL(18, 2)");
    expect(index).toContain("ALTER COLUMN rolling_average_7d TYPE DECIMAL(18, 2)");
    expect(index).toContain("ALTER COLUMN rolling_average_30d TYPE DECIMAL(18, 2)");
  });

  it("atomically hides the exact notification and deletes every KPI child table", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.deleteKPI("kpi-1", [{
      id: "notification-1",
      campaignId: "campaign-1",
      metadata: '{"kpiId":"kpi-1","dismissedAt":"now"}',
    }])).resolves.toBe(true);

    expect(mocks.state.value.kpi).toBeNull();
    expect(mocks.state.value.progress).toEqual([]);
    expect(mocks.state.value.alerts).toEqual([]);
    expect(mocks.state.value.periods).toEqual([]);
    expect(mocks.state.value.notifications[0]).toMatchObject({ read: true, campaignId: "campaign-1" });
    expect(mocks.state.value.notifications[1]).toEqual(mocks.originalState().notifications[1]);
    expect(mocks.tx.delete.mock.calls.map((call) => call[0])).toEqual([kpiProgress, kpiAlerts, kpiPeriods, kpis]);
  });

  it("rolls notification and earlier child changes back when a child delete fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "periods";

    await expect(storage.deleteKPI("kpi-1", [{
      id: "notification-1",
      campaignId: "campaign-1",
      metadata: '{"kpiId":"kpi-1","dismissedAt":"now"}',
    }])).rejects.toThrow("forced KPI period delete failure");
    expect(mocks.state.value).toEqual(mocks.originalState());
  });

  it("leaves the KPI and every child row retryable when notification hiding fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "notification";

    await expect(storage.deleteKPI("kpi-1", [{
      id: "notification-1",
      campaignId: "campaign-1",
      metadata: '{"kpiId":"kpi-1","dismissedAt":"now"}',
    }])).rejects.toThrow("forced notification hide failure");
    expect(mocks.state.value).toEqual(mocks.originalState());
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it("rolls all changes back when the parent delete loses a concurrent race", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "parent";

    await expect(storage.deleteKPI("kpi-1", [{
      id: "notification-1",
      campaignId: "campaign-1",
      metadata: '{"kpiId":"kpi-1","dismissedAt":"now"}',
    }])).rejects.toThrow("KPI parent delete failed");
    expect(mocks.state.value).toEqual(mocks.originalState());
  });

  it("fails closed before mutation when notification campaign scope does not match", async () => {
    const storage = new DatabaseStorage();

    await expect(storage.deleteKPI("kpi-1", [{
      id: "notification-2",
      campaignId: "campaign-2",
      metadata: '{"kpiId":"kpi-1","dismissedAt":"now"}',
    }])).rejects.toThrow("KPI notification campaign scope mismatch");
    expect(mocks.state.value).toEqual(mocks.originalState());
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it("prepares exact campaign-and-KPI hides before both shared KPI delete routes", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const helperStart = routes.indexOf("const prepareKPINotificationHides");
    const helperEnd = routes.indexOf("// Notifications routes", helperStart);
    const helper = routes.slice(helperStart, helperEnd);
    const platformStart = routes.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"');
    const platformEnd = routes.indexOf('app.post("/api/campaigns/:id/kpis"', platformStart);
    const platformRoute = routes.slice(platformStart, platformEnd);
    const campaignStart = routes.indexOf('app.delete("/api/campaigns/:id/kpis/:kpiId"');
    const campaignEnd = routes.indexOf("// Campaign-level Benchmark routes", campaignStart);
    const campaignRoute = routes.slice(campaignStart, campaignEnd);

    expect(helper).toContain('String(n?.campaignId || "").trim() === campaignId');
    expect(helper).toContain('String(notificationMetadata(n?.metadata)?.kpiId || "") === kpiId');
    expect(helper).toContain('metadata: dismissedNotificationMetadata(n, actorId, "kpi_deleted")');
    for (const route of [platformRoute, campaignRoute]) {
      expect(route.indexOf("prepareKPINotificationHides")).toBeLessThan(route.indexOf("storage.deleteKPI(kpiId, notificationHides)"));
      expect(route).not.toContain("Failed to cascade delete KPI notifications");
      expect(route).not.toContain("storage.getNotifications().catch");
    }
  });
});
