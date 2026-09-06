import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
  fail: false,
}));

vi.mock("./db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          if (mocks.fail) throw new Error("notification read failed");
          return mocks.rows;
        },
      }),
    }),
  },
}));

import { alertMonitoringService } from "./services/alert-monitoring";

const episodeKey = (itemType: "kpi" | "benchmark", itemId: string, campaignId = "campaign-1") =>
  (alertMonitoringService as any).getImmediateAlertEpisodeKey(itemType, itemId, campaignId);

describe("Immediate alert breach episode regression", () => {
  beforeEach(() => {
    mocks.rows = [];
    mocks.fail = false;
  });

  it("keeps a dismissed alert in the same unresolved breach episode", async () => {
    mocks.rows = [
      { id: "dismissed-first", createdAt: new Date("2026-06-25T10:00:00Z"), metadata: JSON.stringify({ kpiId: "kpi-1", dismissedAt: "2026-06-25T10:05:00Z" }) },
      { id: "replacement", createdAt: new Date("2026-06-25T10:10:00Z"), metadata: JSON.stringify({ kpiId: "kpi-1" }) },
    ];

    await expect(episodeKey("kpi", "kpi-1")).resolves.toBe("active:dismissed-first");
  });

  it("uses the latest real recovery to re-arm a later breach", async () => {
    mocks.rows = [
      { id: "older", createdAt: new Date("2026-06-24T10:00:00Z"), metadata: JSON.stringify({ benchmarkId: "benchmark-1", resolved: true, resolvedReason: "cleared", resolvedAt: "2026-06-24T11:00:00Z" }) },
      { id: "newer", createdAt: new Date("2026-06-25T10:00:00Z"), metadata: JSON.stringify({ benchmarkId: "benchmark-1", resolved: true, resolvedReason: "cleared", resolvedAt: "2026-06-25T11:00:00Z" }) },
      { id: "cleanup", createdAt: new Date("2026-06-26T10:00:00Z"), metadata: JSON.stringify({ benchmarkId: "benchmark-1", resolved: true, resolvedReason: "superseded", resolvedAt: "2026-06-26T11:00:00Z" }) },
    ];

    await expect(episodeKey("benchmark", "benchmark-1")).resolves.toBe("cleared:newer:2026-06-25T11:00:00Z");
  });

  it("fails closed when the campaign-scoped notification state cannot be read", async () => {
    mocks.fail = true;

    await expect(episodeKey("kpi", "kpi-1")).resolves.toBeNull();
  });
});
