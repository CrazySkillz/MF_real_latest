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

let server: ReturnType<ReturnType<typeof express>["listen"]>;
let baseUrl = "";

function setAuthoritativeFixture() {
  for (const value of Object.values(storageMock)) value.mockReset();
  for (const value of Object.values(ga4ServiceMock)) value.mockReset();
  pdfTextCalls.length = 0;
  for (const row of kpiRows) row.currentValue = "-1";

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
  storageMock.getPlatformBenchmarks.mockResolvedValue([]);
  storageMock.getBenchmarkHistory.mockResolvedValue([]);
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
});
