import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ rules: [] as any[], alerts: [] as any[], reason: "unavailable" as string | null,
  update: vi.fn(), updateNotification: vi.fn(), insert: vi.fn() }));
vi.mock("./db", async () => {
  const { notifications } = await import("../shared/schema");
  return { db: {
    select: () => ({ from: (table: any) => {
      const rows = table === notifications ? state.alerts : state.rules;
      return { then: (resolve: any) => Promise.resolve(rows).then(resolve), where: async () => rows };
    } }),
    update: (table: any) => ({ set: (values: any) => ({ where: async () => state.update(table, values) }) }),
    insert: state.insert,
  } };
});
vi.mock("./storage", () => ({ storage: { updateNotification: state.updateNotification } }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: vi.fn() }));
vi.mock("./utils/ga4-alert-current-value", () => ({ resolveAlertCurrentValueForDecision: async (row: any) => ({
  ...row, __alertDecisionEligible: !state.reason, __alertDecisionReason: state.reason,
}) }));

import { checkGA4PerformanceAlertsForCampaign } from "./kpi-scheduler";
import { checkGA4BenchmarkPerformanceAlertsForCampaign } from "./benchmark-notifications";

describe("financial alert history during an unverified publication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    state.reason = "unavailable";
    state.rules = [{ id: "rule-1", campaignId: "campaign-1", platformType: "google_analytics", metric: "Revenue",
      currentValue: "150", alertThreshold: "100", alertCondition: "below", alertsEnabled: true,
      alertFrequency: "immediate", lastAlertSent: new Date(), status: "active" }];
    state.alerts = [{ id: "alert-1", metadata: JSON.stringify({ kpiId: "rule-1", benchmarkId: "rule-1" }) }];
  });
  afterEach(() => vi.restoreAllMocks());

  for (const [kind, check] of [["KPI", checkGA4PerformanceAlertsForCampaign], ["Benchmark", checkGA4BenchmarkPerformanceAlertsForCampaign]] as const) {
    it.each(["unavailable", "stale"])(`retains ${kind} history and email bookkeeping when inputs are %s`, async (reason) => {
      state.reason = reason;
      await check("campaign-1", "2026-10-16");
      expect(state.updateNotification).not.toHaveBeenCalled();
      expect(state.update).not.toHaveBeenCalled();
      expect(state.insert).not.toHaveBeenCalled();
    });
    it(`resolves ${kind} history when a verified value proves recovery`, async () => {
      state.reason = null;
      await check("campaign-1", "2026-10-16");
      expect(state.updateNotification).toHaveBeenCalledWith("alert-1", expect.objectContaining({ read: true }));
      expect(JSON.parse(state.updateNotification.mock.calls[0][1].metadata)).toMatchObject({ resolved: true, resolvedReason: "cleared" });
    });
    it(`still clears a disabled ${kind} rule`, async () => {
      state.rules[0].alertsEnabled = false;
      await check("campaign-1", "2026-10-16");
      expect(state.updateNotification).toHaveBeenCalledWith("alert-1", expect.objectContaining({ read: true }));
    });
  }
});
