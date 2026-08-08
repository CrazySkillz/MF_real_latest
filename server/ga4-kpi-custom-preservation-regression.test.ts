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
vi.mock("./kpi-scheduler.js", () => ({ checkPerformanceAlerts: checkPerformanceAlertsMock }));
vi.mock("./benchmark-notifications.js", () => ({ checkBenchmarkPerformanceAlerts: checkBenchmarkPerformanceAlertsMock }));

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

    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", startDate: "2026-06-01T00:00:00.000Z", reportingTimeZone: "UTC", currency: "USD" });
    storageMock.getGA4Connections.mockResolvedValue([{ propertyId: "properties/123", isPrimary: true, method: "access_token", accessToken: "token" }]);
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
