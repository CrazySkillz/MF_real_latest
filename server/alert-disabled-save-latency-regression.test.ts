import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rows: [] as any[],
  alerts: [] as any[],
  resolve: vi.fn(),
  clearKPI: vi.fn(),
  createKPI: vi.fn(),
  updateNotification: vi.fn(),
  updateRule: vi.fn(),
}));
vi.mock("./db", async () => {
  const { kpis, benchmarks, notifications } = await import("../shared/schema");
  return { db: {
    select: () => ({ from: (table: any) => {
      if (![kpis, benchmarks, notifications].includes(table)) throw new Error("Unexpected table");
      const rows = table === notifications ? mocks.alerts : mocks.rows;
      return Object.assign(Promise.resolve(rows), { where: () => Promise.resolve(rows) });
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async (condition: any) => mocks.updateRule(table, values, condition) }) }),
  } };
});
vi.mock("./storage", () => ({ storage: { updateNotification: mocks.updateNotification } }));
vi.mock("./utils/ga4-alert-current-value", () => ({ resolveAlertCurrentValueForDecision: mocks.resolve }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: vi.fn() }));
vi.mock("./kpi-notifications", () => ({
  createKPIReminder: vi.fn(), createKPIAlert: mocks.createKPI, createPeriodComplete: vi.fn(),
  createTrendAlert: vi.fn(), resolveKPIAlerts: mocks.clearKPI, shouldTriggerAlert: () => false,
}));

import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";

describe.each([
  ["KPI", checkPerformanceAlerts],
  ["Benchmark", checkBenchmarkPerformanceAlerts],
] as const)("%s alert reconciliation save work", (kind, check) => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rows = [{ id: "rule", campaignId: "campaign", platformType: "google_analytics",
      metric: "sessions", status: "active", alertsEnabled: true, alertThreshold: "10", currentValue: "20" }];
    mocks.alerts = [
      { id: "old-alert", metadata: JSON.stringify({ benchmarkId: "rule" }) },
      { id: "other-alert", metadata: JSON.stringify({ benchmarkId: "other-rule" }) },
    ];
    mocks.resolve.mockImplementation(async (row) => row);
  });

  it.each([
    { alertsEnabled: false, alertThreshold: "10" },
    { alertsEnabled: true, alertThreshold: null },
    { alertsEnabled: true, alertThreshold: undefined },
  ])("skips unused metric reads but clears existing alerts: %j", async (settings) => {
    Object.assign(mocks.rows[0], settings);
    await check();
    expect(mocks.resolve).not.toHaveBeenCalled();
    if (kind === "KPI") expect(mocks.clearKPI).toHaveBeenCalledWith("rule", "cleared");
    else {
      expect(mocks.updateRule).toHaveBeenCalledTimes(1);
      expect(mocks.updateRule.mock.calls[0][1]).toEqual({ lastAlertSent: null });
      expect(mocks.updateNotification).toHaveBeenCalledTimes(1);
      const [id, update] = mocks.updateNotification.mock.calls[0];
      expect(id).toBe("old-alert");
      expect(update.read).toBe(true);
      expect(JSON.parse(update.metadata)).toMatchObject({ benchmarkId: "rule", resolved: true, resolvedReason: "cleared" });
    }
  });

  it.each(["10", "0", 0])("still awaits fresh values for enabled threshold %s", async (threshold) => {
    mocks.rows[0].alertThreshold = threshold;
    let release!: (row: any) => void;
    mocks.resolve.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    let finished = false;
    const pending = check().then(() => { finished = true; });
    await vi.waitFor(() => expect(mocks.resolve).toHaveBeenCalledTimes(1));
    expect(finished).toBe(false);
    expect(mocks.clearKPI).not.toHaveBeenCalled();
    expect(mocks.updateNotification).not.toHaveBeenCalled();
    release(mocks.rows[0]);
    await pending;
    expect(finished).toBe(true);
  });
});
