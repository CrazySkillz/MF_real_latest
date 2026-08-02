import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
  upsertGA4DailyMetrics: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendSources: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getPlatformKPIs: vi.fn(),
  updateKPI: vi.fn(),
  getKPIProgress: vi.fn(),
  recordKPIProgress: vi.fn(),
  getPlatformBenchmarks: vi.fn(),
  updateBenchmark: vi.fn(),
  getBenchmarkHistory: vi.fn(),
  recordBenchmarkHistory: vi.fn(),
  getNotifications: vi.fn(),
  getKPI: vi.fn(),
  getBenchmark: vi.fn(),
  getLinkedInConnection: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getMetricsWithAutoRefresh: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
  getLandingPagesReport: vi.fn(),
  getConversionEventsReport: vi.fn(),
  getTimeSeriesData: vi.fn(),
  getTotalsWithRevenue: vi.fn(),
  refreshAccessToken: vi.fn(),
}));
const refreshCampaignCurrentValuesForCampaignMock = vi.hoisted(() => vi.fn());
const resolveCampaignCurrentValueForAlertMock = vi.hoisted(() => vi.fn(async (row: any) => row));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: vi.fn(() => ({ userId: "owner-1" })) }));
vi.mock("./utils/campaign-current-values", () => ({
  refreshCampaignCurrentValuesForCampaign: refreshCampaignCurrentValuesForCampaignMock,
  resolveCampaignCurrentValueForAlert: resolveCampaignCurrentValueForAlertMock,
}));
vi.mock("./middleware/rateLimiter", () => {
  const passThrough = (_req: any, _res: any, next: any) => next();
  return {
    oauthRateLimiter: passThrough,
    linkedInApiRateLimiter: passThrough,
    googleSheetsRateLimiter: passThrough,
    ga4RateLimiter: passThrough,
    importRateLimiter: passThrough,
  };
});
vi.mock("jspdf", () => ({
  jsPDF: class {
    setFillColor() {}
    rect() {}
    roundedRect() {}
    setFontSize() {}
    setFont() {}
    setTextColor() {}
    setDrawColor() {}
    setLineWidth() {}
    line() {}
    addPage() {}
    splitTextToSize(value: any) { return [String(value)]; }
    text(value: any) {
      (Array.isArray(value) ? value : [value]).forEach((item) => pdfTextCalls.push(String(item)));
    }
    output(kind: string) {
      return kind === "nodebuffer" ? Buffer.from("x".repeat(256)) : new ArrayBuffer(256);
    }
  },
}));

import { resolveGA4KpiLiveValue } from "../shared/ga4-kpi-live-value";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";
import { preflightGA4ReportKPIConsumers, buildPdfAttachmentForReport } from "./report-scheduler";
import { shouldTriggerAlert } from "./kpi-notifications";
import { registerRoutes } from "./routes-oauth";

const campaign = {
  id: "ga4-parity-campaign",
  name: "GA4 parity campaign",
  ownerId: "owner-1",
  currency: "USD",
  startDate: "2026-07-01T00:00:00.000Z",
  createdAt: "2026-07-01T00:00:00.000Z",
  ga4CampaignFilter: "parity_campaign",
};
const connection = {
  id: "ga4-parity-connection",
  campaignId: campaign.id,
  propertyId: "properties/123456",
  method: "access_token",
  accessToken: "token",
  isPrimary: true,
  lookbackDays: 30,
};
const dailyRow = {
  date: "2026-07-31",
  sessions: 100,
  users: 80,
  pageviews: 200,
  conversions: 5,
  revenue: "150.00",
  engagedSessions: 60,
  engagementRate: 0.6,
  updatedAt: "2026-08-01T08:00:00.000Z",
};
const metricFixtures = [
  { metric: "revenue", expected: "200", unit: "USD" },
  { metric: "totalRevenue", expected: "200", unit: "USD" },
  { metric: "conversions", expected: "5", unit: "count" },
  { metric: "Total Conversions", expected: "5", unit: "count" },
  { metric: "conversionRate", expected: "5", unit: "%" },
  { metric: "engagementRate", expected: "60", unit: "%" },
  { metric: "users", expected: "80", unit: "count" },
  { metric: "Total Users", expected: "80", unit: "count" },
  { metric: "sessions", expected: "100", unit: "count" },
  { metric: "Total Sessions", expected: "100", unit: "count" },
  { metric: "pageviews", expected: "200", unit: "count" },
  { metric: "roas", expected: "2", unit: "ratio" },
  { metric: "roi", expected: "100", unit: "%" },
  { metric: "cpa", expected: "20", unit: "USD" },
] as const;
const expectedByMetric = Object.fromEntries(metricFixtures.map(({ metric, expected }) => [metric, expected]));
const kpiRows = metricFixtures.map(({ metric, unit }, index) => ({
  id: `kpi-${index + 1}`,
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: `${metric} KPI`,
  metric,
  unit,
  currentValue: "-1",
  targetValue: "250",
  alertThreshold: metric === "totalRevenue" ? "250" : null,
  alertCondition: "below",
  alertsEnabled: metric === "totalRevenue",
}));
const benchmarkRows = [
  ...metricFixtures.map(({ metric, unit }, index) => ({
    id: `benchmark-${index + 1}`,
    campaignId: campaign.id,
    platformType: "google_analytics",
    name: `${metric} Benchmark`,
    metric,
    unit,
    currentValue: "-1",
    benchmarkValue: "250",
  })),
  {
    id: "benchmark-custom",
    campaignId: campaign.id,
    platformType: "google_analytics",
    name: "Manual quality score",
    metric: "__custom__",
    unit: "score",
    currentValue: "77",
    benchmarkValue: "80",
  },
];
const report = {
  id: "ga4-parity-report",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "GA4 KPI parity report",
  reportType: "custom",
  configuration: JSON.stringify({
    sections: { overview: false, kpis: true, benchmarks: false, ads: false, insights: true },
    subsections: { kpis: { items: true }, insights: { summaryCards: true, trends: false, dataSummary: true, actions: false } },
    selectedKpiIds: kpiRows.map((row) => row.id),
  }),
};
const benchmarkReport = {
  ...report,
  id: "ga4-benchmark-parity-report",
  name: "GA4 Benchmark parity report",
  configuration: JSON.stringify({
    sections: { overview: false, kpis: false, benchmarks: true, ads: false, insights: false },
    subsections: { benchmarks: { items: true } },
    selectedBenchmarkIds: benchmarkRows.slice(0, -1).map((row) => row.id),
  }),
};
const insightsReport = {
  ...report,
  id: "ga4-insights-benchmark-parity-report",
  name: "GA4 Insights Benchmark parity report",
  reportType: "insights",
  configuration: null,
};

let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

function setAuthoritativeFixture() {
  for (const value of Object.values(storageMock)) value.mockReset();
  for (const value of Object.values(ga4ServiceMock)) value.mockReset();
  pdfTextCalls.length = 0;
  for (const row of kpiRows) row.currentValue = "-1";
  for (const row of benchmarkRows.slice(0, -1)) row.currentValue = "-1";
  benchmarkRows[benchmarkRows.length - 1].currentValue = "77";

  storageMock.getCampaign.mockResolvedValue(campaign);
  storageMock.getCampaigns.mockResolvedValue([campaign]);
  storageMock.getGA4Connections.mockResolvedValue([connection]);
  storageMock.getGA4Connection.mockResolvedValue(connection);
  storageMock.getGA4DailyMetrics.mockResolvedValue([dailyRow]);
  storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
  storageMock.getRevenueSources.mockResolvedValue([{ id: "revenue-source", sourceType: "upload_csv", displayName: "Imported revenue", isActive: true }]);
  storageMock.getSpendSources.mockResolvedValue([{ id: "spend-source", sourceType: "upload_csv", displayName: "Imported spend", isActive: true }]);
  storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-source", sourceType: "upload_csv", displayName: "Imported revenue", revenue: 50 }]);
  storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-source", sourceType: "upload_csv", displayName: "Imported spend", spend: 100 }]);
  storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 50, sourceIds: ["revenue-source"] });
  storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"] });
  storageMock.getPlatformKPIs.mockImplementation(async () => kpiRows);
  storageMock.updateKPI.mockImplementation(async (id: string, update: any) => {
    const row = kpiRows.find((item) => item.id === id);
    if (row && update.currentValue !== undefined) row.currentValue = String(update.currentValue);
    return row;
  });
  storageMock.getKPIProgress.mockResolvedValue([]);
  storageMock.recordKPIProgress.mockResolvedValue({});
  storageMock.getPlatformBenchmarks.mockImplementation(async () => benchmarkRows);
  storageMock.updateBenchmark.mockImplementation(async (id: string, update: any) => {
    const row = benchmarkRows.find((item) => item.id === id);
    if (row && update.currentValue !== undefined) row.currentValue = String(update.currentValue);
    return row;
  });
  storageMock.getBenchmarkHistory.mockResolvedValue([]);
  storageMock.recordBenchmarkHistory.mockResolvedValue({});
  storageMock.getNotifications.mockResolvedValue([]);
  storageMock.getKPI.mockImplementation(async (id: string) => kpiRows.find((item) => item.id === id));
  storageMock.getLinkedInConnection.mockResolvedValue(undefined);
  refreshCampaignCurrentValuesForCampaignMock.mockResolvedValue({ kpisUpdated: 0, benchmarksUpdated: 0 });
  resolveCampaignCurrentValueForAlertMock.mockImplementation(async (row: any) => row);

  ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue(dailyRow);
  ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({ rows: [{ campaign: "parity_campaign", ...dailyRow, revenue: 150 }], totals: { ...dailyRow, revenue: 150 } });
  ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getTimeSeriesData.mockResolvedValue([dailyRow]);
  ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ revenueMetric: "purchaseRevenue", totals: { ...dailyRow, revenue: 150 } });
}

describe("GA4 KPI real-path cross-consumer parity", () => {
  beforeAll(async () => {
    const app = express();
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    setAuthoritativeFixture();
  });

  afterEach(() => vi.useRealTimers());
  afterAll(async () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  it("feeds the authoritative fixture through the actual live-card and browser-PDF value resolver", () => {
    const common = {
      breakdownTotals: { sessions: 100, users: 80, pageviews: 200, conversions: 5 },
      overviewEngagementRate: 0.6,
      financialRevenue: 200,
      financialSpend: 100,
      financialROI: 100,
      financialCPA: 20,
    };
    for (const row of kpiRows) {
      expect(Number(resolveGA4KpiLiveValue({ ...common, kpi: row }))).toBe(Number(expectedByMetric[row.metric]));
    }
  });

  it("persists the same fixture through the actual GA4 daily job and exposes it through the KPI API", async () => {
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    expect(result.campaignsProcessed).toBe(1);
    expect(result.campaignIdsProcessed).toEqual([campaign.id]);
    expect(result.kpiIdsUpdated).toEqual(kpiRows.map((row) => row.id));
    expect(result.kpiIdsSkipped).toEqual([]);
    expect(result.kpiIdsFailed).toEqual([]);
    for (const row of kpiRows) expect(Number(row.currentValue)).toBe(Number(expectedByMetric[row.metric]));

    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/platforms/google_analytics/kpis?campaignId=${campaign.id}`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.map((row: any) => [row.metric, Number(row.currentValue)])).toEqual(
      kpiRows.map((row) => [row.metric, Number(expectedByMetric[row.metric])]),
    );
  });

  it("uses the same recomputed revenue for actual alert truth and notification enrichment", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const revenueKpi = kpiRows.find((row) => row.metric === "totalRevenue")!;
    expect(shouldTriggerAlert(revenueKpi as any)).toBe(true);
    storageMock.getNotifications.mockResolvedValue([{
      id: "notification-1",
      campaignId: campaign.id,
      type: "performance-alert",
      title: "stale title",
      message: "stale message",
      read: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      metadata: JSON.stringify({ alertType: "performance-alert", kpiId: revenueKpi.id }),
    }]);

    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/notifications`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Number(JSON.parse(body[0].metadata).currentValue)).toBe(200);
  });

  it("keeps authoritative provider zero ahead of higher persisted and breakdown candidates in the job and Notifications", async () => {
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      revenueMetric: "purchaseRevenue",
      totals: { ...dailyRow, revenue: 0, conversions: 5 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: 0, totalRevenue: 0, roas: 0, roi: -100, cpa: 20 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();

    const revenueKpi = kpiRows.find((row) => row.metric === "totalRevenue")!;
    storageMock.getNotifications.mockResolvedValue([{
      id: "notification-zero",
      campaignId: campaign.id,
      type: "performance-alert",
      title: "stale title",
      message: "stale message",
      read: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      metadata: JSON.stringify({ alertType: "performance-alert", kpiId: revenueKpi.id }),
    }]);

    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/notifications`);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Number(JSON.parse(body[0].metadata).currentValue)).toBe(0);
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it("keeps persisted campaign-to-date totals ahead of configured breakdown when the provider candidate is incomplete", async () => {
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { sessions: 100, users: 80 } });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      totals: { ...dailyRow, revenue: 999, conversions: 99 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: 200, totalRevenue: 200, roas: 2, roi: 100, cpa: 20 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it("uses the configured-lookback breakdown only when provider and persisted candidates are absent", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { sessions: 100, users: 80 } });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      totals: { ...dailyRow, revenue: 150, conversions: 5 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: 200, totalRevenue: 200, roas: 2, roi: 100, cpa: 20 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenCalledWith(
      campaign.id,
      storageMock,
      "30daysAgo",
      connection.propertyId,
      2000,
      "parity_campaign",
    );
  });

  it("preserves last-good financial rows only when their required source read is unavailable", async () => {
    storageMock.getRevenueTotalForRange.mockRejectedValue(new Error("revenue read failed"));
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    let values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: -1, totalRevenue: -1, roas: -1, roi: -1, cpa: 20 });
    for (const metric of ["revenue", "totalRevenue", "roas", "roi"]) {
      const id = kpiRows.find((row) => row.metric === metric)!.id;
      expect(storageMock.updateKPI).not.toHaveBeenCalledWith(id, expect.anything());
    }

    const revenueKpi = kpiRows.find((row) => row.metric === "totalRevenue")!;
    storageMock.getNotifications.mockResolvedValue([{
      id: "notification-unavailable",
      campaignId: campaign.id,
      type: "performance-alert",
      title: "stale title",
      message: "stale message",
      read: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      metadata: JSON.stringify({ alertType: "performance-alert", kpiId: revenueKpi.id }),
    }]);
    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/notifications`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);

    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-01T12:00:00.000Z"));
    setAuthoritativeFixture();
    storageMock.getSpendTotalForRange.mockRejectedValue(new Error("spend read failed"));
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: 200, totalRevenue: 200, roas: -1, roi: -1, cpa: -1 });
  });

  it("preserves every last-good financial row when all native GA4 candidates are unavailable", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error("provider unavailable"));
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("breakdown unavailable"));

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: -1, totalRevenue: -1, roas: -1, roi: -1, cpa: -1 });
    for (const metric of ["revenue", "totalRevenue", "roas", "roi", "cpa"]) {
      const id = kpiRows.find((row) => row.metric === metric)!.id;
      expect(storageMock.updateKPI).not.toHaveBeenCalledWith(id, expect.anything());
    }
  });

  it("renders matching KPI and Insights values through the actual scheduled GA4 PDF path", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const buffer = await buildGA4ScheduledPdfAttachment({ report, reportName: report.name, windowStart: "2026-07-02", windowEnd: "2026-07-31", campaignName: campaign.name });
    const text = pdfTextCalls.join("\n");
    expect(buffer.length).toBeGreaterThan(100);
    expect(text).toContain("Data Summary");
    expect(text).toContain("USD 200.00");
    expect(text).toContain("totalRevenue KPI");
    expect(text).toContain("200");
  });

  it("feeds the fixture through the shared direct, test-send, manual, and scheduled report preflight/builder", async () => {
    const preflight = await preflightGA4ReportKPIConsumers(report, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: true });
    pdfTextCalls.length = 0;
    const buffer = await buildPdfAttachmentForReport({ report, windowStart: "2026-07-02", windowEnd: "2026-07-31", campaignName: campaign.name, isTest: true });
    expect(buffer?.length).toBeGreaterThan(100);
    expect(pdfTextCalls.join("\n")).toContain("totalRevenue KPI");
    expect(pdfTextCalls.join("\n")).toContain("200");
  });

  it("returns exact failed KPI IDs and blocks every shared report preflight when a selected write fails", async () => {
    const failedId = kpiRows[0].id;
    storageMock.updateKPI.mockImplementation(async (id: string, update: any) => {
      if (id === failedId) throw new Error("simulated KPI write failure");
      const row = kpiRows.find((item) => item.id === id);
      if (row && update.currentValue !== undefined) row.currentValue = String(update.currentValue);
      return row;
    });

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    expect(result.kpiIdsFailed).toEqual([failedId]);
    expect(result.kpiIdsUpdated).not.toContain(failedId);
    expect(result.kpiIdsUpdated).toHaveLength(kpiRows.length - 1);

    const preflight = await preflightGA4ReportKPIConsumers(report, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: false, error: "GA4 KPI recompute skipped or failed selected KPI rows" });
  });

  it("returns exact skipped KPI IDs and blocks preserved last-good financial rows from reports", async () => {
    storageMock.getRevenueTotalForRange.mockRejectedValue(new Error("simulated imported revenue outage"));

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const skippedIds = kpiRows
      .filter((row) => ["revenue", "totalRevenue", "roas", "roi"].includes(row.metric))
      .map((row) => row.id);
    expect(result.kpiIdsSkipped).toEqual(skippedIds);
    expect(result.kpiIdsFailed).toEqual([]);
    for (const id of skippedIds) expect(storageMock.updateKPI).not.toHaveBeenCalledWith(id, expect.anything());

    const preflight = await preflightGA4ReportKPIConsumers(report, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: false, error: "GA4 KPI recompute skipped or failed selected KPI rows" });
  });

  it("persists every supported Benchmark alias through the actual daily job and preserves custom values", async () => {
    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const computedRows = benchmarkRows.slice(0, -1);

    expect(result.benchmarkIdsUpdated).toEqual(computedRows.map((row) => row.id));
    expect(result.benchmarkIdsSkipped).toEqual([]);
    expect(result.benchmarkIdsFailed).toEqual([]);
    for (const row of computedRows) expect(Number(row.currentValue)).toBe(Number(expectedByMetric[row.metric]));
    expect(benchmarkRows[benchmarkRows.length - 1].currentValue).toBe("77");
    expect(storageMock.updateBenchmark).not.toHaveBeenCalledWith("benchmark-custom", expect.anything());
  });

  it("preserves last-good traffic Benchmarks when the reporting-window read fails", async () => {
    storageMock.getGA4DailyMetrics.mockImplementation(async (_campaignId: string, _propertyId: string, startDate: string, endDate: string) => {
      if (startDate === "2026-07-02" && endDate === "2026-07-31") throw new Error("reporting window read failed");
      return [dailyRow];
    });

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const trafficRows = benchmarkRows.slice(0, -1).filter((row) => !["revenue", "totalRevenue", "roas", "roi", "cpa"].includes(row.metric));
    expect(result.benchmarkIdsSkipped).toEqual(trafficRows.map((row) => row.id));
    for (const row of trafficRows) expect(row.currentValue).toBe("-1");
  });

  it("returns exact failed Benchmark IDs and blocks report preflight when a selected write fails", async () => {
    const failedId = benchmarkRows[0].id;
    storageMock.updateBenchmark.mockImplementation(async (id: string, update: any) => {
      if (id === failedId) throw new Error("simulated Benchmark write failure");
      const row = benchmarkRows.find((item) => item.id === id);
      if (row && update.currentValue !== undefined) row.currentValue = String(update.currentValue);
      return row;
    });

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    expect(result.benchmarkIdsFailed).toEqual([failedId]);
    expect(result.benchmarkIdsUpdated).not.toContain(failedId);

    const preflight = await preflightGA4ReportKPIConsumers(benchmarkReport, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: false, error: "GA4 Benchmark recompute skipped or failed selected Benchmark rows" });
  });

  it("fails report preflight closed when a selected Benchmark row no longer exists", async () => {
    const missingReport = {
      ...benchmarkReport,
      configuration: JSON.stringify({
        sections: { benchmarks: true },
        subsections: { benchmarks: { items: true } },
        selectedBenchmarkIds: [benchmarkRows[0].id, "missing-benchmark"],
      }),
    };
    const preflight = await preflightGA4ReportKPIConsumers(missingReport, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: false, error: "GA4 report selected Benchmark rows are unavailable" });
  });

  it("fails the actual scheduled Benchmark PDF path closed when its Benchmark read fails", async () => {
    storageMock.getPlatformBenchmarks.mockRejectedValue(new Error("Benchmark read failed"));
    await expect(buildGA4ScheduledPdfAttachment({
      report: benchmarkReport,
      reportName: benchmarkReport.name,
      windowStart: "2026-07-02",
      windowEnd: "2026-07-31",
      campaignName: campaign.name,
    })).rejects.toThrow("Benchmark read failed");
  });

  it("includes freshly recomputed Benchmark conclusions in the actual scheduled Insights PDF", async () => {
    const preflight = await preflightGA4ReportKPIConsumers(insightsReport, "2026-07-31", { suppressAlerts: true });
    expect(preflight).toEqual({ ok: true });

    pdfTextCalls.length = 0;
    await buildGA4ScheduledPdfAttachment({
      report: insightsReport,
      reportName: insightsReport.name,
      windowStart: "2026-07-02",
      windowEnd: "2026-07-31",
      campaignName: campaign.name,
    });
    const text = pdfTextCalls.join("\n");
    expect(text).toContain("revenue Benchmark: Needs Attention");
    expect(text).toContain("Current USD 200.00 vs Benchmark USD 250.00");
    expect(text).not.toContain("conversionRate Benchmark:");
  });
});
