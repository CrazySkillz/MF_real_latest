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
vi.mock("./kpi-scheduler.js", () => ({ checkGA4PerformanceAlertsForCampaign: checkPerformanceAlertsMock }));
vi.mock("./benchmark-notifications.js", () => ({ checkGA4BenchmarkPerformanceAlertsForCampaign: checkBenchmarkPerformanceAlertsMock }));

import {
  getGA4KPIFinancialSourceWindow,
  getGA4KPIReportingWindow,
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

describe("GA4 KPI persisted financial source window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-28T12:00:00.000Z"));
    resetMocks();

    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      ownerId: "owner-1",
      startDate: "2026-05-20T00:00:00.000Z",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getGA4Connections.mockResolvedValue([{ propertyId: "properties/123", isPrimary: true, method: "service_account", importStartDate: "2026-06-01" }]);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_campaignId, _propertyId, startDate, endDate) => {
      if (startDate === "2026-06-27" && endDate === "2026-06-27") return [dailyRow];
      if (startDate === "2026-06-01" && endDate === "2026-06-27") return [dailyRow];
      if (startDate === "2026-05-20" && endDate === "2026-06-27") return [dailyRow];
      return [];
    });
    storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
    storageMock.getGA4Connection.mockResolvedValue({ id: "connection-1", method: "access_token", accessToken: "token" });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      currencyCode: "USD",
      totals: { users: 50, sessions: 100, pageviews: 200, conversions: 20, revenue: 1000 },
    });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, currency: "USD", sourceIds: ["revenue-current-day"] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 200, currency: "USD", sourceIds: ["spend-current-day"] });
    storageMock.getRevenueSources.mockResolvedValue([{ sourceType: "csv", currency: "USD", isActive: true }]);
    storageMock.getSpendSources.mockResolvedValue([{ sourceType: "csv", currency: "USD", isActive: true }]);
    storageMock.getPlatformKPIs.mockResolvedValue([
      { id: "kpi-revenue", metric: "Revenue" },
      { id: "kpi-roas", metric: "ROAS" },
      { id: "kpi-roi", metric: "ROI" },
      { id: "kpi-cpa", metric: "CPA" },
    ]);
    storageMock.updateKPI.mockResolvedValue({});
    storageMock.getKPIProgress.mockResolvedValue([]);
    storageMock.recordKPIProgress.mockResolvedValue({});
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
    storageMock.updateBenchmark.mockResolvedValue({});
    refreshCampaignCurrentValuesForCampaignMock.mockResolvedValue(undefined);
    checkPerformanceAlertsMock.mockResolvedValue(undefined);
    checkBenchmarkPerformanceAlertsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the saved initial import boundary through the campaign-timezone latest completed day", () => {
    expect(getGA4KPIReportingWindow("Europe/Amsterdam", undefined, new Date("2026-06-28T12:00:00.000Z"), "2026-06-01")).toMatchObject({
      startDate: "2026-06-01",
      endDate: "2026-06-27",
    });
    expect(getGA4KPIFinancialSourceWindow("Europe/Amsterdam", new Date("2026-06-28T12:00:00.000Z"))).toEqual({
      startDate: "1900-01-01",
      endDate: "2026-06-27",
    });
  });

  it("persists KPI financial current values from source totals through the same completed report date", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });

    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-06-27", "2026-06-27");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-06-01", "2026-06-27");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-05-20", "2026-06-27");
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-06-27", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-06-27", "ga4");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      "properties/123",
      "token",
      "2026-05-20",
      "2026-06-27",
      undefined,
      "USD",
    );

    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-revenue", { currentValue: "1300" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-roas", { currentValue: "6.5" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-roi", { currentValue: "550" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-cpa", { currentValue: "10" });
    expect(checkPerformanceAlertsMock).toHaveBeenCalledExactlyOnceWith("campaign-1", "2026-06-27");
  });

  it("uses the saved GA4 import boundary for financial values when no campaign start is configured", async () => {
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      ownerId: "owner-1",
      createdAt: "2026-06-22T15:59:49.000Z",
      startDate: null,
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      currencyCode: "USD",
      totals: { users: 2256, sessions: 2256, pageviews: 3000, conversions: 145, revenue: 37518.74 },
    });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: "USD", sourceIds: [] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 1250, currency: "USD", sourceIds: ["spend-source"] });
    storageMock.getPlatformKPIs.mockResolvedValue([
      { id: "kpi-sessions", metric: "Sessions" },
      { id: "kpi-revenue", metric: "Revenue" },
      { id: "kpi-roas", metric: "ROAS" },
      { id: "kpi-cpa", metric: "CPA" },
    ]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([
      { id: "benchmark-revenue", metric: "Revenue", benchmarkValue: "80000" },
      { id: "benchmark-roas", metric: "ROAS", benchmarkValue: "50" },
    ]);

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });

    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      "properties/123",
      "token",
      "2026-06-01",
      "2026-06-27",
      undefined,
      "USD",
    );
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-sessions", { currentValue: "100" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-revenue", { currentValue: "37518.74" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-roas", { currentValue: "30.01" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("kpi-cpa", { currentValue: "8.62" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-revenue", { currentValue: "37518.74" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-roas", { currentValue: "30.01" });
  });

  it("retains the creation-date fallback when no campaign or import start is available", async () => {
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      ownerId: "owner-1",
      createdAt: "2026-06-22T15:59:49.000Z",
      startDate: null,
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getGA4Connections.mockResolvedValue([{ propertyId: "properties/123", isPrimary: true, method: "service_account" }]);
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ ...dailyRow, date: "2026-07-31" }]);

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-07-31" });

    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      "properties/123",
      "token",
      "2026-06-22",
      "2026-07-31",
      undefined,
      "USD",
    );
  });

  it("updates Benchmark current values and skips same-date history even when the target date is not latest", async () => {
    storageMock.getPlatformKPIs.mockResolvedValue([]);
    storageMock.getPlatformBenchmarks.mockResolvedValue([
      { id: "benchmark-revenue", metric: "Revenue", benchmarkValue: "2000" },
    ]);
    storageMock.getBenchmarkHistory.mockResolvedValue([
      { recordedAt: new Date("2026-06-27T23:59:59.000Z"), currentValue: "1300", notes: "auto:ga4_daily:2026-06-27;ga4_scope_v1:123:Europe%2FAmsterdam:USD:%5B%5D" },
      { recordedAt: new Date("2026-06-28T23:59:59.000Z"), currentValue: "1400", notes: "auto:ga4_daily:2026-06-28;ga4_scope_v1:123:Europe%2FAmsterdam:USD:%5B%5D" },
    ]);

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", date: "2026-06-27" });

    expect(storageMock.updateBenchmark).toHaveBeenCalledWith("benchmark-revenue", { currentValue: "1300" });
    expect(storageMock.recordBenchmarkHistory).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      benchmarksUpdated: 1,
      benchmarksRecorded: 0,
      benchmarkIdsUpdated: ["benchmark-revenue"],
    });
  });
});
