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
  getAcquisitionBreakdown: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./utils/campaign-current-values", () => ({
  refreshCampaignCurrentValuesForCampaign: vi.fn(),
}));
vi.mock("./kpi-scheduler.js", () => ({ checkPerformanceAlerts: vi.fn() }));
vi.mock("./benchmark-notifications.js", () => ({ checkBenchmarkPerformanceAlerts: vi.fn() }));

import { getGA4KPIReportingWindow, runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";

const trafficRows = [
  { date: "2026-07-01", users: 50, sessions: 100, pageviews: 200, conversions: 10, revenue: "100", engagementRate: "0.20" },
  { date: "2026-07-30", users: 150, sessions: 300, pageviews: 600, conversions: 30, revenue: "300", engagementRate: "80" },
];
const lifetimeRow = {
  date: "2026-07-30",
  users: 500,
  sessions: 1000,
  pageviews: 2000,
  conversions: 100,
  revenue: "1000",
  engagementRate: "0.99",
};

describe("GA4 KPI authoritative reporting window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T00:30:00.000Z"));
    for (const value of Object.values(storageMock)) value.mockReset();
    for (const value of Object.values(ga4ServiceMock)) value.mockReset();

    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      ownerId: "owner-1",
      startDate: "2026-06-01T00:00:00.000Z",
      reportingTimeZone: "America/Los_Angeles",
      currency: "USD",
    });
    storageMock.getGA4Connections.mockResolvedValue([
      { propertyId: "properties/123", isPrimary: true, method: "access_token", accessToken: "token", importStartDate: "2026-07-01" },
    ]);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_campaignId, _propertyId, startDate, endDate) => {
      if (startDate === "2026-07-30" && endDate === "2026-07-30") return [trafficRows[1]];
      if (startDate === "2026-07-01" && endDate === "2026-07-30") return trafficRows;
      if (startDate === "2026-06-01" && endDate === "2026-07-30") return [lifetimeRow];
      return [];
    });
    storageMock.getLatestGA4DailyMetric.mockResolvedValue(trafficRows[1]);
    storageMock.getGA4Connection.mockResolvedValue({ propertyId: "properties/123", method: "access_token", accessToken: "token" });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "USD" });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 1000, sourceIds: ["spend-source"], currency: "USD" });
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue([{ id: "spend-source", sourceType: "csv", currency: "USD", isActive: true }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "USD", totals: lifetimeRow });
    storageMock.getPlatformKPIs.mockResolvedValue([
      { id: "users", metric: "users" },
      { id: "sessions", metric: "sessions" },
      { id: "pageviews", metric: "pageviews" },
      { id: "conversions", metric: "conversions" },
      { id: "conversion-rate", metric: "conversionRate" },
      { id: "engagement-rate", metric: "engagementRate" },
      { id: "cpa", metric: "cpa" },
    ]);
    storageMock.updateKPI.mockResolvedValue({});
    storageMock.getKPIProgress.mockResolvedValue([]);
    storageMock.recordKPIProgress.mockResolvedValue({});
    storageMock.getPlatformBenchmarks.mockResolvedValue([]);
  });

  afterEach(() => vi.useRealTimers());

  it("keeps the fixed import boundary and clamps explicit incomplete dates", () => {
    const now = new Date("2026-08-01T00:30:00.000Z");
    expect(getGA4KPIReportingWindow("America/Los_Angeles", undefined, now, "2026-07-01")).toMatchObject({
      reportingTimeZone: "America/Los_Angeles",
      startDate: "2026-07-01",
      endDate: "2026-07-30",
    });
    expect(getGA4KPIReportingWindow("Europe/Amsterdam", undefined, now, "2026-07-02")).toMatchObject({
      startDate: "2026-07-02",
      endDate: "2026-07-31",
    });
    expect(getGA4KPIReportingWindow("America/Los_Angeles", "2026-08-01", now, "2026-07-01").endDate).toBe("2026-07-30");
    expect(getGA4KPIReportingWindow("America/Los_Angeles", "2026-07-15", now, "2026-07-01")).toMatchObject({
      startDate: "2026-07-01",
      endDate: "2026-07-15",
      days: 15,
    });
    expect(() => getGA4KPIReportingWindow("America/Los_Angeles", "2026-06-30", now, "2026-07-01")).toThrow(
      "GA4 KPI reporting date precedes the import boundary",
    );
    expect(getGA4KPIReportingWindow("Europe/Amsterdam", undefined, new Date("2026-08-20T12:00:00.000Z"), "2026-07-02")).toMatchObject({
      startDate: "2026-07-02",
      endDate: "2026-08-19",
      days: 49,
    });
  });

  it("weights engagement by sessions using the same daily-row transform as Overview", () => {
    expect(summarizeGA4TrafficRows(trafficRows)).toMatchObject({
      sessions: 400,
      engagedSessions: 260,
      engagementRate: 0.65,
    });
  });

  it("reproduces the campaign's exact cumulative Overview totals from the persisted rows", () => {
    expect(summarizeGA4TrafficRows([
      { date: "2026-07-12", users: 867, sessions: 866, conversions: 110, engagedSessions: 592 },
      { date: "2026-08-08", users: 108, sessions: 108, conversions: 14, engagedSessions: 74 },
      { date: "2026-08-09", users: 106, sessions: 106, conversions: 14, engagedSessions: 72 },
      { date: "2026-08-10", users: 103, sessions: 103, conversions: 14, engagedSessions: 71 },
    ])).toMatchObject({
      users: 1_184,
      sessions: 1_183,
      conversions: 152,
      engagedSessions: 809,
      engagementRate: 809 / 1_183,
    });
  });

  it("persists cumulative traffic values while CPA uses campaign-to-date financial conversions", async () => {
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: "campaign-1", suppressAlerts: true });

    expect(result.date).toBe("2026-07-30");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-07-01", "2026-07-30");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-06-01", "2026-07-30");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith(
      "properties/123", "token", "2026-06-01", "2026-07-30", undefined, "USD",
    );
    expect(storageMock.updateKPI).toHaveBeenCalledWith("users", { currentValue: "200" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("sessions", { currentValue: "400" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("pageviews", { currentValue: "800" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("conversions", { currentValue: "40" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("conversion-rate", { currentValue: "10" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("engagement-rate", { currentValue: "65" });
    expect(storageMock.updateKPI).toHaveBeenCalledWith("cpa", { currentValue: "10" });
    expect(storageMock.recordKPIProgress).toHaveBeenCalledWith(expect.objectContaining({
      recordedAt: new Date("2026-07-30T23:59:59.000Z"),
      notes: "auto:ga4_daily:2026-07-30;ga4_scope_v1:123:America%2FLos_Angeles:USD:%5B%5D",
    }));
  });
});
