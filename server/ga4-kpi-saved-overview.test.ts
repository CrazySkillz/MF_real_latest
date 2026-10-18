import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => Object.fromEntries([
  "getCampaign", "getCampaigns", "getGA4Connections", "getGA4Connection", "getGA4DailyMetrics", "getLatestGA4DailyMetric",
  "getGA4OverviewSnapshot", "getRevenueTotalForRange", "getSpendTotalForRange", "getRevenueSources", "getSpendSources",
  "getRevenueBreakdownBySource", "getSpendBreakdownBySource", "getPlatformKPIs", "getPlatformBenchmarks",
  "getCampaignKPIs", "getCampaignBenchmarks", "updateKPI", "updateBenchmark", "getKPIProgress", "recordKPIProgress",
  "updateKPIProgress", "getBenchmarkHistory", "recordBenchmarkHistory", "getLatestFinancialDailySnapshot",
].map((name) => [name, vi.fn()])));
const provider = vi.hoisted(() => ({ getTotalsWithRevenue: vi.fn(), getAcquisitionBreakdown: vi.fn(), refreshAccessToken: vi.fn() }));
const alerts = vi.hoisted(() => ({ kpi: vi.fn(), benchmark: vi.fn() }));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: provider }));
vi.mock("./kpi-scheduler.js", () => ({ checkGA4PerformanceAlertsForCampaign: alerts.kpi }));
vi.mock("./benchmark-notifications.js", () => ({ checkGA4BenchmarkPerformanceAlertsForCampaign: alerts.benchmark }));

import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { preflightGA4ReportKPIConsumers } from "./report-scheduler";
import { resolveAlertCurrentValueForDecision } from "./utils/ga4-alert-current-value";
import { isAlertDecisionBreached } from "./utils/alert-decision";

const campaignId = "campaign-1";
const propertyId = "542352127";
const date = "2026-10-16";
const overview = () => ({ campaignId, propertyId, windowStart: "2026-10-15", windowEnd: date,
  campaignBreakdown: { totals: { sessions: 30, conversions: 5, revenue: 100.009 }, meta: { currencyCode: "EUR" } },
});
const financialSnapshot = () => ({ campaignId, reportingDate: date, metrics: { financialDaily: {
  version: "financial_daily_snapshot_v1", currency: "EUR",
  currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-15", endDate: date, dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
  inputs: { revenue: { value: "130.01", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
    spend: { value: "20.00", available: true, sources: ["spend-source:spend-1"] },
    conversions: { value: 5, available: true, sources: ["ga4"] } },
} } });
const rows = () => [
  { campaignId, propertyId, date: "2026-10-15", sessions: 10, users: 10, pageviews: 20, engagedSessions: 5, conversions: 2, revenue: "40.00" },
  { campaignId, propertyId, date, sessions: 20, users: 20, pageviews: 40, engagedSessions: 10, conversions: 3, revenue: "60.00" },
];
const metrics = ["Revenue", "ROAS", "ROI", "CPA", "Sessions", "Conversions"];
const run = () => runGA4DailyKPIAndBenchmarkJobs({ campaignId, suppressAlerts: true, useSavedOverview: true });

describe("scheduled KPI and Benchmark saved Overview inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T08:00:00Z"));
    Object.values(storageMock).forEach((mock) => mock.mockReset());
    Object.values(provider).forEach((mock) => mock.mockReset());
    Object.values(alerts).forEach((mock) => mock.mockReset());
    vi.spyOn(console, "warn").mockImplementation(() => {});
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["sale_a","sale_b"]' });
    const connection = { campaignId, propertyId, isActive: true, isPrimary: true, importStartDate: "2026-10-15", method: "access_token", accessToken: "test-token" };
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    storageMock.getGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => rows().filter((row) => row.date >= start && row.date <= end));
    storageMock.getLatestGA4DailyMetric.mockResolvedValue(rows()[1]);
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(overview());
    storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(financialSnapshot());
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 30, currency: "EUR", sourceIds: ["revenue-1"] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, currency: "EUR", sourceIds: ["spend-1"] });
    storageMock.getRevenueSources.mockResolvedValue([{ id: "revenue-1", currency: "EUR", sourceType: "csv", isActive: true }]);
    storageMock.getSpendSources.mockResolvedValue([{ id: "spend-1", currency: "EUR", sourceType: "csv", isActive: true }]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-1", revenue: 30 }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-1", spend: 20 }]);
    storageMock.getPlatformKPIs.mockResolvedValue(metrics.map((metric) => ({ id: `kpi-${metric}`, metric })));
    storageMock.getPlatformBenchmarks.mockResolvedValue(metrics.map((metric) => ({ id: `benchmark-${metric}`, metric, benchmarkValue: "100" })));
    storageMock.getCampaignKPIs.mockResolvedValue([{ id: "campaign-revenue", platformType: "campaign", currentValue: "777", calculationConfig: JSON.stringify({ metric: "revenue", inputs: { revenue: ["total_revenue"] } }) }]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([{ id: "campaign-cpa", platformType: "campaign", currentValue: "777", calculationConfig: JSON.stringify({ metric: "cpa", inputs: { spend: ["total_spend"], conversions: ["total_conversions"] } }) }]);
    for (const name of ["getKPIProgress", "getBenchmarkHistory"]) storageMock[name].mockResolvedValue([]);
    for (const name of ["updateKPI", "updateBenchmark", "recordKPIProgress", "updateKPIProgress", "recordBenchmarkHistory"]) storageMock[name].mockResolvedValue({ id: "saved" });
    provider.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "EUR", totals: { sessions: 31, users: 31, conversions: 6, revenue: 110 } });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("saves financial values and progress from Overview rather than a newer provider response", async () => {
    const result = await run();
    expect(result.campaignIdsFailed).toEqual([]);
    expect(result.kpiIdsSkipped).toEqual([]);
    expect(result.benchmarkIdsSkipped).toEqual([]);
    const expected = { Revenue: "130.01", ROAS: "6.5", ROI: "550.05", CPA: "4", Sessions: "30", Conversions: "5" };
    for (const [metric, value] of Object.entries(expected)) {
      expect(storageMock.updateKPI).toHaveBeenCalledWith(`kpi-${metric}`, { currentValue: value });
      expect(storageMock.updateBenchmark).toHaveBeenCalledWith(`benchmark-${metric}`, { currentValue: value });
      expect(storageMock.recordKPIProgress).toHaveBeenCalledWith(expect.objectContaining({ kpiId: `kpi-${metric}`, value }));
      expect(storageMock.recordBenchmarkHistory).toHaveBeenCalledWith(expect.objectContaining({ benchmarkId: `benchmark-${metric}`, currentValue: value }));
    }
    expect(storageMock.updateKPI).toHaveBeenCalledWith("campaign-revenue", { currentValue: "130.01" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("campaign-cpa", { currentValue: "4" });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(alerts.kpi).not.toHaveBeenCalled();
    expect(alerts.benchmark).not.toHaveBeenCalled();
    expect(storageMock.getRevenueTotalForRange).toHaveBeenLastCalledWith(campaignId, "1900-01-01", date, "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenLastCalledWith(campaignId, "1900-01-01", date, "ga4");
  });

  it("keeps report preflight on the same saved GA4 values as the ordered refresh", async () => {
    const result = await preflightGA4ReportKPIConsumers({ campaignId, platformType: "google_analytics", reportType: "kpis" }, date, { suppressAlerts: true });
    expect(result.ok).toBe(true);
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Revenue", { currentValue: "130.01" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-CPA", { currentValue: "4" });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
  it("carries supplied ownership to platform and campaign current values and daily history", async () => {
    const refreshScope = { campaignId, ownerId: "owner-1", reportingDate: date, work: { id: "work", leaseToken: "lease" } };
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId, suppressAlerts: true, useSavedOverview: true, refreshScope });
    expect(result.campaignIdsFailed).toEqual([]);
    for (const name of ["updateKPI", "updateBenchmark"]) {
      expect(storageMock[name]).toHaveBeenCalled();
      for (const [, data] of storageMock[name].mock.calls) expect(data.refreshScope).toEqual(refreshScope);
    }
    for (const name of ["recordKPIProgress", "recordBenchmarkHistory"]) {
      expect(storageMock[name]).toHaveBeenCalled();
      for (const [data] of storageMock[name].mock.calls) expect(data.refreshScope).toEqual(refreshScope);
    }
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(alerts.kpi).not.toHaveBeenCalled(); expect(alerts.benchmark).not.toHaveBeenCalled();
  });
  it("fails closed if a guarded recompute would emit unguarded alerts", async () => {
    const refreshScope = { campaignId, ownerId: "owner-1", reportingDate: date, work: { id: "work", leaseToken: "lease" } };
    await expect(runGA4DailyKPIAndBenchmarkJobs({ campaignId, useSavedOverview: true, refreshScope })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(storageMock.updateKPI).not.toHaveBeenCalled(); expect(alerts.kpi).not.toHaveBeenCalled();
  });

  it.each([["revenue", "130.01"], ["roas", "6.5"], ["roi", "550.05"], ["cpa", "4"]])(
    "evaluates %s alerts from verified saved GA4 inputs", async (metric, value) => {
      const result = await resolveAlertCurrentValueForDecision({ campaignId, platformType: "google_analytics", metric, currentValue: "777" }, undefined, { useSavedOverview: true });
      expect(result).toMatchObject({ currentValue: value, __alertDecisionEligible: true });
      expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    },
  );

  it("blocks an alert when its saved inputs are missing instead of using a newer provider response", async () => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    const result = await resolveAlertCurrentValueForDecision({ campaignId, platformType: "google_analytics", metric: "revenue", currentValue: "777" }, undefined, { useSavedOverview: true });
    expect(result).toMatchObject({ currentValue: "777", __alertDecisionEligible: false });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["missing publication", "old window", "wrong currency", "different revenue", "different conversions", "source changed"])(
    "withholds financial alerts when the publication is incompatible: %s", async (condition) => {
      const saved = financialSnapshot();
      if (condition === "old window") saved.metrics.financialDaily.currentValueWindow.startDate = "2026-10-14";
      if (condition === "wrong currency") saved.metrics.financialDaily.currency = "USD";
      if (condition === "different revenue") saved.metrics.financialDaily.inputs.revenue.value = "140.01";
      if (condition === "different conversions") saved.metrics.financialDaily.inputs.conversions.value = 6;
      storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(condition === "missing publication" ? null : saved);
      if (condition === "source changed") storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 40, currency: "EUR", sourceIds: ["revenue-1"] });
      const result = await resolveAlertCurrentValueForDecision({ campaignId, platformType: "google_analytics", metric: condition === "different conversions" ? "cpa" : "revenue", currentValue: "777" }, undefined, { useSavedOverview: true });
      expect(result).toMatchObject({ currentValue: "777", __alertDecisionEligible: false });
      expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    },
  );

  it("does not create a false breach from a later provider response and recognizes the published breach", async () => {
    const rule = { campaignId, platformType: "google_analytics", metric: "Revenue", currentValue: "777", alertsEnabled: true, alertThreshold: "135", alertCondition: "above" };
    expect(isAlertDecisionBreached(await resolveAlertCurrentValueForDecision(rule, undefined, { useSavedOverview: true }))).toBe(false);
    expect(isAlertDecisionBreached(await resolveAlertCurrentValueForDecision({ ...rule, alertCondition: "below" }, undefined, { useSavedOverview: true }))).toBe(true);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["getGA4OverviewSnapshot", "getLatestFinancialDailySnapshot", "getRevenueTotalForRange", "getSpendTotalForRange"])(
    "withholds financial alerts after a %s failure", async (method) => {
      storageMock[method].mockRejectedValue(new Error("storage unavailable"));
      expect(await resolveAlertCurrentValueForDecision({ campaignId, platformType: "google_analytics", metric: "roas", currentValue: "777" }, undefined, { useSavedOverview: true }))
        .toMatchObject({ currentValue: "777", __alertDecisionEligible: false });
      expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    },
  );

  it("retains report KPI values and rejects preflight when saved GA4 inputs cannot be verified", async () => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    const result = await preflightGA4ReportKPIConsumers({ campaignId, platformType: "google_analytics", reportType: "kpis" }, date, { suppressAlerts: true });
    expect(result.ok).toBe(false);
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("kpi-Revenue", expect.anything());
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined], ["other campaign", { ...overview(), campaignId: "other" }],
    ["other property", { ...overview(), propertyId: "999" }],
    ["old end", { ...overview(), windowEnd: "2026-10-15" }],
    ["wrong currency", { ...overview(), campaignBreakdown: { ...overview().campaignBreakdown, meta: { currencyCode: "USD" } } }],
    ["different conversions", { ...overview(), campaignBreakdown: { ...overview().campaignBreakdown, totals: { ...overview().campaignBreakdown.totals, conversions: 6 } } }],
  ])("retains financial values and histories when saved GA4 inputs are incompatible: %s", async (_label, saved) => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(saved);
    const result = await run();
    for (const metric of ["Revenue", "ROAS", "ROI", "CPA"]) {
      expect(result.kpiIdsSkipped).toContain(`kpi-${metric}`);
      expect(result.benchmarkIdsSkipped).toContain(`benchmark-${metric}`);
      expect(storageMock.updateKPI).not.toHaveBeenCalledWith(`kpi-${metric}`, expect.anything());
      expect(storageMock.updateBenchmark).not.toHaveBeenCalledWith(`benchmark-${metric}`, expect.anything());
      expect(storageMock.recordKPIProgress).not.toHaveBeenCalledWith(expect.objectContaining({ kpiId: `kpi-${metric}` }));
      expect(storageMock.recordBenchmarkHistory).not.toHaveBeenCalledWith(expect.objectContaining({ benchmarkId: `benchmark-${metric}` }));
    }
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("campaign-revenue", expect.anything());
    expect(storageMock.updateBenchmark).not.toHaveBeenCalledWith("campaign-cpa", expect.anything());
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Sessions", { currentValue: "30" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-Conversions", { currentValue: "5" });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("keeps the previous provider path for callers that do not opt in", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId, suppressAlerts: true });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Revenue", { currentValue: "140" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-CPA", { currentValue: "3.33" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("campaign-revenue", { currentValue: "140" });
    expect(provider.getTotalsWithRevenue).toHaveBeenCalled();
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it.each(["Revenue", "Spend"] as const)("still skips only dependent financial metrics when external %s reads fail", async (source) => {
    storageMock[`get${source}TotalForRange`].mockRejectedValue(new Error("source read failed"));
    const result = await run();
    const skipped = source === "Revenue" ? ["Revenue", "ROAS", "ROI"] : ["ROAS", "ROI", "CPA"];
    for (const metric of skipped) {
      expect(result.kpiIdsSkipped).toContain(`kpi-${metric}`);
      expect(result.benchmarkIdsSkipped).toContain(`benchmark-${metric}`);
    }
    expect(storageMock.updateKPI).toHaveBeenCalledWith(source === "Revenue" ? "kpi-CPA" : "kpi-Revenue", { currentValue: source === "Revenue" ? "4" : "130.01" });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("accepts genuine zero GA4 values without external sources", async () => {
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => rows()
      .filter((row) => row.date >= start && row.date <= end).map((row) => ({ ...row, conversions: 0, revenue: "0.00" })));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...overview(), campaignBreakdown: {
      ...overview().campaignBreakdown, totals: { sessions: 30, conversions: 0, revenue: 0 },
    } });
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue([]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "EUR" });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [], currency: "EUR" });
    await run();
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Revenue", { currentValue: "0" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-Conversions", { currentValue: "0" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("campaign-revenue", { currentValue: "0" });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("retains financial values after a saved Overview read error and recovers on a later run", async () => {
    storageMock.getGA4OverviewSnapshot.mockRejectedValue(new Error("database read failed"));
    await run();
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("kpi-Revenue", expect.anything());
    expect(storageMock.updateBenchmark).not.toHaveBeenCalledWith("campaign-cpa", expect.anything());
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(overview());
    expect((await run()).campaignIdsFailed).toEqual([]);
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Revenue", { currentValue: "130.01" });
  });

  it("rejects current saved totals for a historical reporting date before writes", async () => {
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId, date: "2026-10-15", useSavedOverview: true });
    expect(result.campaignIdsFailed).toEqual([campaignId]);
    expect(storageMock.updateKPI).not.toHaveBeenCalled();
    expect(storageMock.updateBenchmark).not.toHaveBeenCalled();
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("refreshes same-day Benchmark history alongside the current value and KPI progress", async () => {
    await run();
    const progress = storageMock.recordKPIProgress.mock.calls.map(([row]) => ({ ...row, id: `progress-${row.kpiId}` }));
    const history = storageMock.recordBenchmarkHistory.mock.calls.map(([row]) => ({ ...row, id: `history-${row.benchmarkId}` }));
    storageMock.getKPIProgress.mockImplementation(async (id) => progress.filter((row) => row.kpiId === id));
    storageMock.getBenchmarkHistory.mockImplementation(async (id) => history.filter((row) => row.benchmarkId === id));
    storageMock.recordKPIProgress.mockClear();
    storageMock.recordBenchmarkHistory.mockClear();
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 50, currency: "EUR", sourceIds: ["revenue-1"] });
    const result = await run();
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-Revenue", { currentValue: "150.01" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-Revenue", { currentValue: "150.01" });
    expect(storageMock.updateKPIProgress).toHaveBeenCalledWith("progress-kpi-Revenue", expect.objectContaining({ value: "150.01" }));
    expect(storageMock.recordKPIProgress).not.toHaveBeenCalled();
    expect(storageMock.recordBenchmarkHistory).toHaveBeenCalledWith(expect.objectContaining({
      benchmarkId: "benchmark-Revenue", currentValue: "150.01", benchmarkValue: "100", variance: "50.01", performanceRating: "excellent",
      notes: history.find((row) => row.benchmarkId === "benchmark-Revenue")!.notes,
    }));
    expect(result.benchmarksRecorded).toBe(0);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["unfiltered", "simulation"])("preserves the existing %s path when the scheduler opts in", async (scope) => {
    const campaign = await storageMock.getCampaign(campaignId);
    if (scope === "unfiltered") storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: "" });
    else {
      const connection = { ...await storageMock.getGA4Connection(campaignId, propertyId), propertyId: "yesop" };
      storageMock.getGA4Connections.mockResolvedValue([connection]);
      storageMock.getGA4Connection.mockResolvedValue(connection);
    }
    await run();
    const firstWrites = storageMock.updateKPI.mock.calls.map((args) => structuredClone(args));
    storageMock.updateKPI.mockClear();
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId, suppressAlerts: true });
    expect(storageMock.updateKPI.mock.calls).toEqual(firstWrites);
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it("updates the same-day history target, variance and rating when the Benchmark target changes", async () => {
    await run();
    const history = storageMock.recordBenchmarkHistory.mock.calls.map(([row]) => ({ ...row, id: `history-${row.benchmarkId}` }));
    storageMock.getBenchmarkHistory.mockImplementation(async (id) => history.filter((row) => row.benchmarkId === id));
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "benchmark-Sessions", metric: "Sessions", benchmarkValue: "20" }]);
    storageMock.recordBenchmarkHistory.mockClear();
    const result = await run();
    expect(storageMock.recordBenchmarkHistory).toHaveBeenCalledWith(expect.objectContaining({
      benchmarkId: "benchmark-Sessions", currentValue: "30", benchmarkValue: "20", variance: "50", performanceRating: "excellent",
    }));
    expect(result.benchmarksRecorded).toBe(0);
  });

  it("does not replace manual history that shares the same date and GA4 scope", async () => {
    await run();
    const manual = storageMock.recordBenchmarkHistory.mock.calls.map(([row]) => ({ ...row, id: `manual-${row.benchmarkId}`, notes: row.notes.replace(`auto:ga4_daily:${date}`, "manual review") }));
    storageMock.getBenchmarkHistory.mockImplementation(async (id) => manual.filter((row) => row.benchmarkId === id));
    storageMock.recordBenchmarkHistory.mockClear();
    const result = await run();
    expect(result.benchmarksRecorded).toBe(metrics.length);
    for (const [row] of storageMock.recordBenchmarkHistory.mock.calls) {
      expect(row.notes).toMatch(/^auto:ga4_daily:2026-10-16;ga4_scope_v1:/);
      expect(row).not.toHaveProperty("id");
    }
  });

  it("does not write target-day history when the exact daily GA4 row is missing", async () => {
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => start === end ? [] : rows());
    storageMock.getLatestGA4DailyMetric.mockResolvedValue(rows()[0]);
    const result = await run();
    expect(result.benchmarksRecorded).toBe(0);
    expect(storageMock.recordBenchmarkHistory).not.toHaveBeenCalled();
  });

  it("reports a same-day history write failure and withholds alert reconciliation", async () => {
    await run();
    const history = storageMock.recordBenchmarkHistory.mock.calls.map(([row]) => ({ ...row, id: `history-${row.benchmarkId}` }));
    storageMock.getBenchmarkHistory.mockImplementation(async (id) => history.filter((row) => row.benchmarkId === id));
    storageMock.recordBenchmarkHistory.mockImplementation(async (row) => {
      if (row.benchmarkId === "benchmark-Revenue") throw new Error("history write failed");
      return { id: "saved", ...row };
    });
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId, useSavedOverview: true });
    expect(result.benchmarkIdsFailed).toEqual(["benchmark-Revenue"]);
    expect(result.benchmarkIdsUpdated).not.toContain("benchmark-Revenue");
    expect(result.benchmarkIdsUpdated).toContain("benchmark-Sessions");
    expect(alerts.kpi).not.toHaveBeenCalled();
    expect(alerts.benchmark).not.toHaveBeenCalled();
  });
});
