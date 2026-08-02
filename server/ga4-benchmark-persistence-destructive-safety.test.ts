import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalState = () => ({
    benchmark: { id: "benchmark-1", campaignId: "campaign-1" } as null | { id: string; campaignId: string },
    history: ["history-1"],
    notifications: [
      { id: "notification-1", campaignId: "campaign-1", read: false, metadata: '{"benchmarkId":"benchmark-1"}' },
      { id: "notification-2", campaignId: "campaign-2", read: false, metadata: '{"benchmarkId":"benchmark-1"}' },
    ],
  });
  const state = { value: originalState(), failureStage: null as null | "notification" | "history" | "parent", deleteIndex: 0 };
  const tx = {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => state.value.benchmark ? [{ ...state.value.benchmark }] : []) })) })) })),
    update: vi.fn(() => ({ set: vi.fn((values: any) => ({ where: vi.fn(() => ({ returning: vi.fn(async () => {
      if (state.failureStage === "notification") throw new Error("forced Benchmark notification hide failure");
      state.value.notifications[0] = { ...state.value.notifications[0], ...values };
      return [{ id: "notification-1" }];
    }) })) })) })),
    delete: vi.fn(() => ({ where: vi.fn(async () => {
      const index = state.deleteIndex++;
      if (index === 0) {
        if (state.failureStage === "history") throw new Error("forced Benchmark history delete failure");
        state.value.history = [];
      }
      if (index === 1 && state.failureStage !== "parent") state.value.benchmark = null;
      return { rowCount: index === 1 && state.failureStage === "parent" ? 0 : 1 };
    }) })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = structuredClone(state.value);
    state.deleteIndex = 0;
    try { return await callback(tx); } catch (error) { state.value = before; throw error; }
  });
  return { originalState, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";
import { benchmarkHistory, benchmarks } from "../shared/schema";

describe("GA4 Benchmark persistence and destructive safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.value = mocks.originalState();
    mocks.state.failureStage = null;
    mocks.state.deleteIndex = 0;
  });

  const notificationHide = { id: "notification-1", campaignId: "campaign-1", metadata: '{"benchmarkId":"benchmark-1","dismissedAt":"now"}' };

  it("atomically hides the exact notification and deletes Benchmark history and parent", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.deleteBenchmark("benchmark-1", [notificationHide])).resolves.toBe(true);
    expect(mocks.state.value.benchmark).toBeNull();
    expect(mocks.state.value.history).toEqual([]);
    expect(mocks.state.value.notifications[0]).toMatchObject({ read: true, campaignId: "campaign-1" });
    expect(mocks.state.value.notifications[1]).toEqual(mocks.originalState().notifications[1]);
    expect(mocks.tx.delete.mock.calls.map((call) => call[0])).toEqual([benchmarkHistory, benchmarks]);
  });

  it.each([
    ["notification", "forced Benchmark notification hide failure"],
    ["history", "forced Benchmark history delete failure"],
    ["parent", "Benchmark parent delete failed"],
  ] as const)("rolls every change back when the %s stage fails", async (stage, message) => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = stage;
    await expect(storage.deleteBenchmark("benchmark-1", [notificationHide])).rejects.toThrow(message);
    expect(mocks.state.value).toEqual(mocks.originalState());
  });

  it("fails closed before mutation when notification campaign scope does not match", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.deleteBenchmark("benchmark-1", [{ ...notificationHide, id: "notification-2", campaignId: "campaign-2" }]))
      .rejects.toThrow("Benchmark notification campaign scope mismatch");
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it("prepares exact campaign-and-Benchmark hides before all shared Benchmark delete routes", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const helperStart = routes.indexOf("const prepareBenchmarkNotificationHides");
    const helperEnd = routes.indexOf("// Notifications routes", helperStart);
    const helper = routes.slice(helperStart, helperEnd);
    expect(helper).toContain('String(n?.campaignId || "").trim() === campaignId');
    expect(helper).toContain('String(notificationMetadata(n?.metadata)?.benchmarkId || "") === benchmarkId');
    expect(helper).toContain('metadata: dismissedNotificationMetadata(n, actorId, "benchmark_deleted")');

    for (const marker of [
      'app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId"',
      'app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId"',
      'app.delete("/api/benchmarks/:id"',
    ]) {
      const start = routes.indexOf(marker);
      const end = routes.indexOf("\n  });", start);
      const route = routes.slice(start, end);
      expect(route.indexOf("prepareBenchmarkNotificationHides")).toBeLessThan(route.indexOf("storage.deleteBenchmark"));
      expect(route).not.toContain("Failed to cascade delete benchmark notifications");
      expect(route).not.toContain("storage.getNotifications().catch");
    }
  });
});
