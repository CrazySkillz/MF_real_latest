import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
  getGA4Connection: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendSources: vi.fn(),
  getPlatformKPIs: vi.fn(),
  updateKPI: vi.fn(),
  getKPIProgress: vi.fn(),
  updateKPIProgress: vi.fn(),
  recordKPIProgress: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  updateBenchmark: vi.fn(),
  getBenchmarkHistory: vi.fn(),
  recordBenchmarkHistory: vi.fn(),
}));

const ga4ServiceMock = vi.hoisted(() => ({
  getTimeSeriesData: vi.fn(),
  getTotalsWithRevenue: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

const refreshCampaignCurrentValuesForCampaignMock = vi.hoisted(() => vi.fn());
const checkPerformanceAlertsMock = vi.hoisted(() => vi.fn());
const checkBenchmarkPerformanceAlertsMock = vi.hoisted(() => vi.fn());

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./utils/campaign-current-values", () => ({
  refreshCampaignCurrentValuesForCampaign: refreshCampaignCurrentValuesForCampaignMock,
}));
vi.mock("./kpi-scheduler.js", () => ({ checkPerformanceAlerts: checkPerformanceAlertsMock, checkGA4PerformanceAlertsForCampaign: checkPerformanceAlertsMock }));
vi.mock("./benchmark-notifications.js", () => ({ checkBenchmarkPerformanceAlerts: checkBenchmarkPerformanceAlertsMock, checkGA4BenchmarkPerformanceAlertsForCampaign: checkBenchmarkPerformanceAlertsMock }));

import {
  computeKpiValue,
  isComputableGA4KpiMetric,
  runGA4DailyKPIAndBenchmarkJobs,
} from "./ga4-kpi-benchmark-jobs";

const dailyRow = {
  date: "2026-06-27",
  sessions: 100,
  users: 50,
  pageviews: 200,
  conversions: 10,
  revenue: "1000.00",
  engagementRate: 0.5,
};

const resetMocks = () => {
  for (const value of Object.values(storageMock)) value.mockReset();
  for (const value of Object.values(ga4ServiceMock)) value.mockReset();
  refreshCampaignCurrentValuesForCampaignMock.mockReset();
  checkPerformanceAlertsMock.mockReset();
  checkBenchmarkPerformanceAlertsMock.mockReset();
};

describe("GA4 custom KPI recompute preservation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    resetMocks();

    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", ownerId: "owner-1", startDate: "2026-06-01T00:00:00.000Z", reportingTimeZone: "UTC", currency: "USD" });
    storageMock.getGA4Connections.mockResolvedValue([{ propertyId: "properties/123", isPrimary: true, method: "access_token", accessToken: "token", importStartDate: "2026-06-01" }]);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_campaignId, _propertyId, startDate, endDate) => {
      if (startDate === "2026-06-27" && endDate === "2026-06-27") return [dailyRow];
      if (startDate === "2026-06-01" && endDate === "2026-06-27") return [dailyRow];
      return [];
    });
    storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
    storageMock.getGA4Connection.mockResolvedValue({ propertyId: "properties/123", method: "access_token", accessToken: "token" });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, sourceIds: ["revenue-current-day"], currency: "USD" });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 200, sourceIds: ["spend-current-day"], currency: "USD" });
    storageMock.getRevenueSources.mockResolvedValue([{ id: "revenue-current-day", sourceType: "csv", currency: "USD", isActive: true }]);
    storageMock.getSpendSources.mockResolvedValue([{ id: "spend-current-day", sourceType: "csv", currency: "USD", isActive: true }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "USD", totals: { ...dailyRow, revenue: 1000 } });
    storageMock.getPlatformKPIs.mockResolvedValue([
      { id: "kpi-revenue", metric: "Revenue", currentValue: "12.00" },
      { id: "kpi-custom-name", metric: "", name: "Qualified Pipeline", currentValue: "42.00" },
      { id: "kpi-custom-marker", metric: "__custom__", name: "Custom KPI", currentValue: "99.00" },
    ]);
    storageMock.updateKPI.mockResolvedValue({});
    storageMock.getKPIProgress.mockResolvedValue([]);
    storageMock.recordKPIProgress.mockResolvedValue({});
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    refreshCampaignCurrentValuesForCampaignMock.mockResolvedValue(undefined);
    checkPerformanceAlertsMock.mockResolvedValue(undefined);
    checkBenchmarkPerformanceAlertsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const configureRows = (kpiCount: number, benchmarkCount: number) => {
    const kpis = Array.from({ length: kpiCount }, (_, i) => ({ id: `kpi-${i}`, metric: "sessions" }));
    const benchmarks = Array.from({ length: benchmarkCount }, (_, i) => ({ id: `benchmark-${i}`, metric: "sessions", benchmarkValue: "200" }));
    storageMock.getPlatformKPIs.mockResolvedValue(kpis);
    storageMock.getPlatformBenchmarks.mockResolvedValue(benchmarks);
    storageMock.updateBenchmark.mockResolvedValue({});
    storageMock.getBenchmarkHistory.mockResolvedValue([]);
    storageMock.recordBenchmarkHistory.mockResolvedValue({});
    return { kpis, benchmarks };
  };

  it("bounds history reads to four and preserves ordered writes and alert completion", async () => {
    const { kpis, benchmarks } = configureRows(8, 2);
    let active = 0;
    let peak = 0;
    const delayedHistory = async () => {
      peak = Math.max(peak, ++active);
      await new Promise(resolve => setTimeout(resolve, 100));
      active--;
      return [];
    };
    storageMock.getKPIProgress.mockImplementation(delayedHistory);
    storageMock.getBenchmarkHistory.mockImplementation(delayedHistory);
    const writes: string[] = [];
    const delayedWrite = async (label: string) => {
      writes.push(label);
      await new Promise(resolve => setTimeout(resolve, 10));
      return {};
    };
    storageMock.updateKPI.mockImplementation(id => delayedWrite(`value:${id}`));
    storageMock.recordKPIProgress.mockImplementation(data => delayedWrite(`history:${data.kpiId}`));
    storageMock.updateBenchmark.mockImplementation(id => delayedWrite(`value:${id}`));
    storageMock.recordBenchmarkHistory.mockImplementation(data => delayedWrite(`history:${data.benchmarkId}`));
    let completed = false;
    const pending = runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" })
      .then(result => { completed = true; return result; });
    await vi.advanceTimersByTimeAsync(499);
    expect(completed).toBe(false);
    expect(checkPerformanceAlertsMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;
    expect(peak).toBe(4);
    expect(writes).toEqual([...kpis, ...benchmarks].flatMap(item => [`value:${item.id}`, `history:${item.id}`]));
    expect(result.kpiIdsUpdated).toEqual(kpis.map(item => item.id));
    expect(result.benchmarkIdsUpdated).toEqual(benchmarks.map(item => item.id));
    expect(result.kpiIdsFailed).toEqual([]);
    expect(result.benchmarkIdsFailed).toEqual([]);
    expect(storageMock.updateKPI.mock.calls.every(([, data]) => data.currentValue === "100")).toBe(true);
    expect(storageMock.updateBenchmark.mock.calls.every(([, data]) => data.currentValue === "100")).toBe(true);
    expect(checkPerformanceAlertsMock).toHaveBeenCalledWith("campaign-1", "2026-06-27");
    expect(checkBenchmarkPerformanceAlertsMock).toHaveBeenCalledWith("campaign-1", "2026-06-27");
  });

  it("keeps a rejected KPI history read isolated to its exact row", async () => {
    configureRows(5, 0);
    storageMock.getKPIProgress.mockImplementation(async id => {
      if (id === "kpi-1") throw new Error("history unavailable");
      return [];
    });
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });
    expect(result.kpiIdsFailed).toEqual(["kpi-1"]);
    expect(result.kpiIdsUpdated).toEqual(["kpi-0", "kpi-2", "kpi-3", "kpi-4"]);
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("kpi-1", expect.anything());
    expect(checkPerformanceAlertsMock).not.toHaveBeenCalled();
    expect(checkBenchmarkPerformanceAlertsMock).not.toHaveBeenCalled();
  });

  it("preserves Benchmark current-value writes and failure reporting when history fails", async () => {
    configureRows(0, 2);
    storageMock.getBenchmarkHistory.mockRejectedValueOnce(new Error("history unavailable"));
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });
    expect(storageMock.updateBenchmark.mock.calls.map(([id]) => id)).toEqual(["benchmark-0", "benchmark-1"]);
    expect(result.benchmarkIdsFailed).toEqual(["benchmark-0"]);
    expect(result.benchmarkIdsUpdated).toEqual(["benchmark-1"]);
    expect(storageMock.recordBenchmarkHistory).toHaveBeenCalledTimes(1);
    expect(checkBenchmarkPerformanceAlertsMock).not.toHaveBeenCalled();
  });

  it("does not prefetch unsupported or missing-input rows", async () => {
    configureRows(0, 0);
    storageMock.getPlatformKPIs.mockResolvedValue([{ id: "custom", metric: "__custom__" }, { id: "revenue", metric: "revenue" }]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([{ id: "custom-b", metric: "__custom__" }, { id: "revenue-b", metric: "revenue" }]);
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error("provider unavailable"));
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });
    expect(storageMock.getKPIProgress).not.toHaveBeenCalled();
    expect(storageMock.getBenchmarkHistory).not.toHaveBeenCalled();
    expect(storageMock.updateKPI).not.toHaveBeenCalled();
    expect(storageMock.updateBenchmark).not.toHaveBeenCalled();
  });

  it("does not prefetch or write when campaign ownership is missing", async () => {
    configureRows(8, 2);
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1" });
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });
    expect(storageMock.getPlatformKPIs).not.toHaveBeenCalled();
    expect(storageMock.getKPIProgress).not.toHaveBeenCalled();
    expect(storageMock.getBenchmarkHistory).not.toHaveBeenCalled();
  });

  it("classifies only supported GA4 KPI metrics as recomputable", () => {
    expect(isComputableGA4KpiMetric("Revenue")).toBe(true);
    expect(isComputableGA4KpiMetric("Total Revenue")).toBe(true);
    expect(isComputableGA4KpiMetric("totalRevenue")).toBe(true);
    expect(computeKpiValue("totalRevenue", { users: 0, sessions: 0, pageviews: 0, conversions: 0, ga4Revenue: 700, importedRevenue: 300, spend: 0, engagementRate: 0 })).toBe(1000);
    expect(isComputableGA4KpiMetric("conversionRate")).toBe(true);
    expect(isComputableGA4KpiMetric("ROAS")).toBe(true);
    expect(isComputableGA4KpiMetric("Qualified Pipeline")).toBe(false);
    expect(isComputableGA4KpiMetric("__custom__")).toBe(false);
    expect(isComputableGA4KpiMetric("")).toBe(false);
  });

  it("does not overwrite custom or unsupported KPI rows during the shared GA4 recompute job", async () => {
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });

    expect(storageMock.updateKPI).toHaveBeenCalledTimes(1);
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-revenue", { currentValue: "1300" });
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("kpi-custom-name", expect.anything());
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith("kpi-custom-marker", expect.anything());

    expect(storageMock.getKPIProgress).toHaveBeenCalledTimes(1);
    expect(storageMock.getKPIProgress).toHaveBeenCalledWith("kpi-revenue");
    expect(storageMock.recordKPIProgress).toHaveBeenCalledTimes(1);
    expect(storageMock.recordKPIProgress).toHaveBeenCalledWith(expect.objectContaining({
      kpiId: "kpi-revenue",
      value: "1300",
      notes: "auto:ga4_daily:2026-06-27;ga4_scope_v1:123:UTC:USD:%5B%5D",
    }));
    expect(result.kpiIdsUpdated).toEqual(["kpi-revenue"]);
    expect(result.kpiIdsSkipped).toEqual(["kpi-custom-name", "kpi-custom-marker"]);
    expect(result.kpiIdsFailed).toEqual([]);
    expect(checkPerformanceAlertsMock).not.toHaveBeenCalled();
  });
});
