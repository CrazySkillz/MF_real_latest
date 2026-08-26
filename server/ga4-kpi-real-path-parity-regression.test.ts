import express from "express";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getClients: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
  upsertGA4DailyMetrics: vi.fn(),
  replaceGA4DailyMetricsWindow: vi.fn(),
  getRevenueSources: vi.fn(),
  getSpendSources: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getPlatformKPIs: vi.fn(),
  updateKPI: vi.fn(),
  getKPIProgress: vi.fn(),
  updateKPIProgress: vi.fn(),
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
  getTimeSeriesWithToken: vi.fn(),
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
  getCampaignMetricTotals: vi.fn(),
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
import { buildGA4InsightsHistoryScopeMarker } from "../shared/ga4-insights";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";
import { preflightGA4ReportKPIConsumers, buildPdfAttachmentForReport } from "./report-scheduler";
import { shouldTriggerAlert } from "./kpi-notifications";
import { registerRoutes } from "./routes-oauth";

const campaign = {
  id: "ga4-parity-campaign",
  name: "GA4 parity campaign",
  ownerId: "owner-1",
  clientId: "client-1",
  currency: "USD",
  reportingTimeZone: "Europe/Amsterdam",
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
  for (const row of kpiRows) {
    row.currentValue = "-1";
    row.alertThreshold = row.metric === "totalRevenue" ? "250" : null;
    row.alertsEnabled = row.metric === "totalRevenue";
  }
  for (const row of benchmarkRows.slice(0, -1)) row.currentValue = "-1";
  benchmarkRows[benchmarkRows.length - 1].currentValue = "77";

  storageMock.getCampaign.mockResolvedValue(campaign);
  storageMock.getCampaigns.mockResolvedValue([campaign]);
  storageMock.getClients.mockResolvedValue([{ id: campaign.clientId, ownerId: campaign.ownerId }]);
  storageMock.getGA4Connections.mockResolvedValue([connection]);
  storageMock.getGA4Connection.mockResolvedValue(connection);
  storageMock.getGA4DailyMetrics.mockResolvedValue([dailyRow]);
  storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
  storageMock.replaceGA4DailyMetricsWindow.mockResolvedValue({ replaced: 1 });
  storageMock.getRevenueSources.mockResolvedValue([{ id: "revenue-source", sourceType: "csv", displayName: "Imported revenue", currency: "USD", isActive: true }]);
  storageMock.getSpendSources.mockResolvedValue([{ id: "spend-source", sourceType: "csv", displayName: "Imported spend", currency: "USD", isActive: true }]);
  storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-source", sourceType: "upload_csv", displayName: "Imported revenue", revenue: 50 }]);
  storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-source", sourceType: "upload_csv", displayName: "Imported spend", spend: 100 }]);
  storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 50, sourceIds: ["revenue-source"], currency: "USD" });
  storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, sourceIds: ["spend-source"], currency: "USD" });
  storageMock.getPlatformKPIs.mockImplementation(async () => kpiRows);
  storageMock.updateKPI.mockImplementation(async (id: string, update: any) => {
    const row = kpiRows.find((item) => item.id === id);
    if (row && update.currentValue !== undefined) row.currentValue = String(update.currentValue);
    return row;
  });
  storageMock.getKPIProgress.mockResolvedValue([]);
  storageMock.updateKPIProgress.mockResolvedValue({});
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
  ga4ServiceMock.getTimeSeriesWithToken.mockResolvedValue([dailyRow]);
  ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
    revenueMetric: "purchaseRevenue",
    currencyCode: "USD",
    totals: { ...dailyRow, revenue: 150, engagedSessions: 61, engagementRate: 0.61 },
  });
}

describe("GA4 KPI real-path cross-consumer parity", () => {
  beforeAll(async () => {
    const app = express();
    app.use(express.json());
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

  it("updates the exact scoped same-date KPI progress row when its source total changes", async () => {
    const sessionsKpi = kpiRows.find((row) => row.metric === "sessions")!;
    const marker = buildGA4InsightsHistoryScopeMarker(
      connection.propertyId,
      campaign.ga4CampaignFilter,
      campaign.reportingTimeZone,
      campaign.currency,
    );
    const progressRows = [
      {
        id: "progress-sessions-current",
        kpiId: sessionsKpi.id,
        value: "90",
        rollingAverage7d: "70",
        rollingAverage30d: "70",
        trendDirection: "up",
        recordedAt: new Date("2026-07-31T23:59:59.000Z"),
        notes: `auto:ga4_daily:2026-07-31;${marker}`,
      },
      {
        id: "progress-sessions-previous",
        kpiId: sessionsKpi.id,
        value: "50",
        rollingAverage7d: "50",
        rollingAverage30d: "50",
        trendDirection: "neutral",
        recordedAt: new Date("2026-07-30T23:59:59.000Z"),
        notes: `auto:ga4_daily:2026-07-30;${marker}`,
      },
    ];
    storageMock.getKPIProgress.mockImplementation(async (kpiId: string) =>
      kpiId === sessionsKpi.id ? progressRows : [],
    );
    storageMock.updateKPIProgress.mockImplementation(async (id: string, update: any) => {
      const row = progressRows.find((item) => item.id === id);
      if (!row) return undefined;
      Object.assign(row, update);
      return row;
    });

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    expect(result.kpiIdsFailed).toEqual([]);
    expect(Number(sessionsKpi.currentValue)).toBe(100);
    expect(storageMock.updateKPIProgress).toHaveBeenCalledWith("progress-sessions-current", expect.objectContaining({
      value: "100",
      rollingAverage7d: "75",
      rollingAverage30d: "75",
      trendDirection: "up",
      recordedAt: new Date("2026-07-31T23:59:59.000Z"),
      notes: `auto:ga4_daily:2026-07-31;${marker}`,
    }));
    expect(storageMock.recordKPIProgress).not.toHaveBeenCalledWith(expect.objectContaining({ kpiId: sessionsKpi.id }));
  });

  it("fails a KPI closed when scoped same-date progress is ambiguous", async () => {
    const sessionsKpi = kpiRows.find((row) => row.metric === "sessions")!;
    const marker = buildGA4InsightsHistoryScopeMarker(
      connection.propertyId,
      campaign.ga4CampaignFilter,
      campaign.reportingTimeZone,
      campaign.currency,
    );
    storageMock.getKPIProgress.mockImplementation(async (kpiId: string) => kpiId === sessionsKpi.id ? [
      { id: "duplicate-a", value: "90", recordedAt: new Date("2026-07-31T23:59:59.000Z"), notes: marker },
      { id: "duplicate-b", value: "91", recordedAt: new Date("2026-07-31T23:59:59.000Z"), notes: marker },
    ] : []);

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    expect(result.kpiIdsFailed).toContain(sessionsKpi.id);
    expect(result.kpiIdsUpdated).not.toContain(sessionsKpi.id);
    expect(storageMock.updateKPI).not.toHaveBeenCalledWith(sessionsKpi.id, expect.anything());
    expect(storageMock.updateKPIProgress).not.toHaveBeenCalled();
  });

  it("lists only campaigns whose campaign owner and client owner both match the actor", async () => {
    storageMock.getCampaigns.mockResolvedValue([
      campaign,
      { ...campaign, id: "foreign-client-campaign", clientId: "foreign-client" },
      { ...campaign, id: "ownerless-campaign", ownerId: null },
    ]);

    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/campaigns`);
    expect(response.status).toBe(200);
    expect((await response.json()).map((row: any) => row.id)).toEqual([campaign.id]);
  });

  it("lists GA4 connections without lazy token migration in read-only validation mode", async () => {
    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-connections?readOnly=1`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ validationReadOnly: true });
    expect(storageMock.getGA4Connections).toHaveBeenLastCalledWith(campaign.id, { migrateLegacyTokens: false });

    const status = await fetch(`${baseUrl}/api/ga4/check-connection/${campaign.id}?readOnly=1`);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ validationReadOnly: true });
    expect(storageMock.getGA4Connections).toHaveBeenLastCalledWith(campaign.id, { migrateLegacyTokens: false });
  });

  it("rejects unsigned legacy Google OAuth callbacks before external token work", async () => {
    vi.useRealTimers();
    const integrated = await fetch(`${baseUrl}/api/auth/google/callback?code=fake&state=${campaign.id}`);
    expect(integrated.status).toBe(400);
    expect(await integrated.text()).toContain("Invalid state");

    const browser = await fetch(`${baseUrl}/api/auth/google/callback`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "fake", state: Buffer.from(JSON.stringify({ campaignId: campaign.id })).toString("base64") }),
    });
    expect(browser.status).toBe(400);
    expect(await browser.json()).toMatchObject({ error: "Invalid state" });

    const sheets = await fetch(`${baseUrl}/api/auth/google-sheets/callback?code=fake&state=${campaign.id}:revenue`);
    expect(sheets.status).toBe(200);
    expect(await sheets.text()).toContain("Invalid state");
  });

  it("fails closed instead of signing GA4 or Sheets OAuth state with a known development secret in production", async () => {
    vi.useRealTimers();
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      session: process.env.SESSION_SECRET,
      ga4: process.env.GA4_OAUTH_STATE_SECRET,
      sheets: process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET,
      tokenEncryption: process.env.TOKEN_ENCRYPTION_KEY,
      encryption: process.env.ENCRYPTION_KEY,
    };
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.GA4_OAUTH_STATE_SECRET;
    delete process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET;
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    try {
      const ga4 = await fetch(`${baseUrl}/api/auth/google/integrated-connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      expect(ga4.status).toBe(500);

      const sheets = await fetch(`${baseUrl}/api/auth/google-sheets/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, purpose: "revenue" }),
      });
      expect(sheets.status).toBe(500);
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.session === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.session;
      if (previous.ga4 === undefined) delete process.env.GA4_OAUTH_STATE_SECRET; else process.env.GA4_OAUTH_STATE_SECRET = previous.ga4;
      if (previous.sheets === undefined) delete process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET; else process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET = previous.sheets;
      if (previous.tokenEncryption === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previous.tokenEncryption;
      if (previous.encryption === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previous.encryption;
    }
  });

  it("signs GA4 and Sheets OAuth state from the mandatory production token key", async () => {
    vi.useRealTimers();
    const previous = {
      nodeEnv: process.env.NODE_ENV,
      session: process.env.SESSION_SECRET,
      ga4: process.env.GA4_OAUTH_STATE_SECRET,
      sheets: process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET,
      tokenEncryption: process.env.TOKEN_ENCRYPTION_KEY,
      encryption: process.env.ENCRYPTION_KEY,
    };
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_SECRET;
    delete process.env.GA4_OAUTH_STATE_SECRET;
    delete process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET;
    delete process.env.ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = "stable-production-token-key";
    try {
      const ga4 = await fetch(`${baseUrl}/api/auth/google/integrated-connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id }),
      });
      expect(ga4.status).toBe(200);
      const ga4State = new URL((await ga4.json()).authUrl).searchParams.get("state") || "";
      expect(ga4State.split(".")).toHaveLength(2);

      const sheets = await fetch(`${baseUrl}/api/auth/google-sheets/connect`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId: campaign.id, purpose: "revenue" }),
      });
      expect(sheets.status).toBe(200);
      const sheetsState = new URL((await sheets.json()).authUrl).searchParams.get("state") || "";
      expect(sheetsState.startsWith("sheets:")).toBe(true);
      expect(sheetsState.slice(7).split(".")).toHaveLength(2);
    } finally {
      if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
      if (previous.session === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous.session;
      if (previous.ga4 === undefined) delete process.env.GA4_OAUTH_STATE_SECRET; else process.env.GA4_OAUTH_STATE_SECRET = previous.ga4;
      if (previous.sheets === undefined) delete process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET; else process.env.GOOGLE_SHEETS_OAUTH_STATE_SECRET = previous.sheets;
      if (previous.tokenEncryption === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = previous.tokenEncryption;
      if (previous.encryption === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = previous.encryption;
    }
  });

  it("uses a last-good row for current-value reconciliation without inventing target-day history", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    storageMock.getLatestGA4DailyMetric.mockResolvedValue({ ...dailyRow, date: "2026-07-30" });
    ga4ServiceMock.getTimeSeriesData.mockResolvedValue([]);

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    expect(storageMock.updateKPI).toHaveBeenCalled();
    expect(storageMock.recordKPIProgress).not.toHaveBeenCalled();
    expect(storageMock.recordBenchmarkHistory).not.toHaveBeenCalled();
    expect(result.kpisRecorded).toBe(0);
    expect(result.benchmarksRecorded).toBe(0);
    expect(ga4ServiceMock.getTimeSeriesData).toHaveBeenCalledWith(
      campaign.id,
      storageMock,
      "2026-07-31",
      connection.propertyId,
      campaign.ga4CampaignFilter,
      "2026-07-31",
    );
  });

  it("keeps date-dimension Engagement Rate authoritative when the dimensionless aggregate differs", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const engagementKpi = kpiRows.find((row) => row.metric === "engagementRate")!;
    engagementKpi.alertsEnabled = true;
    engagementKpi.alertThreshold = "100";
    expect(Number(engagementKpi.currentValue)).toBe(60);
    storageMock.getNotifications.mockResolvedValue([{
      id: "notification-engagement",
      campaignId: campaign.id,
      type: "performance-alert",
      title: "stale title",
      message: "stale message",
      read: false,
      createdAt: "2026-08-01T09:00:00.000Z",
      metadata: JSON.stringify({ alertType: "performance-alert", kpiId: engagementKpi.id }),
    }]);

    const response = await fetch(baseUrl + "/api/notifications");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(Number(JSON.parse(body[0].metadata).currentValue)).toBe(60);
  });

  it("exposes both exact provider numerators while using weighted date rows in read-only validation", async () => {
    const dateRows = [
      { ...dailyRow, date: "2026-07-30", sessions: 50, engagedSessions: 25, engagementRate: 0.5 },
      { ...dailyRow, date: "2026-07-31", sessions: 50, engagedSessions: 35, engagementRate: 0.7 },
    ];
    storageMock.getGA4DailyMetrics.mockResolvedValue(dateRows);
    ga4ServiceMock.getTimeSeriesWithToken.mockResolvedValue(dateRows);

    vi.useRealTimers();
    const response = await fetch(baseUrl + "/api/campaigns/" + campaign.id + "/ga4-benchmark-provider-validation?propertyId=" + encodeURIComponent(connection.propertyId) + "&startDate=2026-07-02&endDate=2026-07-31&disableTokenRefresh=1");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.currentValueProvider.totals.engagedSessions).toBe(61);
    expect(body.currentValueDateDimensionProvider.totals.engagedSessions).toBe(60);
    expect(body.currentValuePersistedDaily.totals.engagementRate).toBe(0.6);
    expect(body.engagementRateQueryShapeParity).toMatchObject({
      authoritativeSource: "date_dimension_engaged_sessions",
      aggregateEngagedSessions: 61,
      dateDimensionEngagedSessions: 60,
      numeratorDelta: 1,
    });
    expect(ga4ServiceMock.getTimeSeriesWithToken).toHaveBeenCalledWith(
      connection.propertyId,
      connection.accessToken,
      body.engagementRateQueryShapeParity.scope.startDate,
      campaign.ga4CampaignFilter,
      body.engagementRateQueryShapeParity.scope.endDate,
    );
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("serves the browser daily-state validation path without provider or persistence mutations", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    vi.useRealTimers();
    const response = await fetch(baseUrl + "/api/campaigns/" + campaign.id + "/ga4-daily?days=30&propertyId=" + encodeURIComponent(connection.propertyId) + "&readOnly=1");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.validationReadOnly).toBe(true);
    expect(body.providerRefreshAttempted).toBe(false);
    expect(body.providerRefreshOutcome).toBe("read_only");
    expect(ga4ServiceMock.getTimeSeriesData).not.toHaveBeenCalled();
    expect(storageMock.upsertGA4DailyMetrics).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("rejects malformed on-demand GA4 daily provider values before replacing persisted history", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTimeSeriesData.mockResolvedValue([{ ...dailyRow, date: "2026-07-31", sessions: "not-a-number" }]);
    vi.useRealTimers();

    const response = await fetch(baseUrl + "/api/campaigns/" + campaign.id + "/ga4-daily?days=30&propertyId=" + encodeURIComponent(connection.propertyId));

    expect(response.status).toBe(500);
    expect(storageMock.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it("propagates read-only mode through breakdown and prevents to-date token refresh persistence", async () => {
    vi.useRealTimers();
    const breakdown = await fetch(baseUrl + "/api/campaigns/" + campaign.id + "/ga4-breakdown?dateRange=30days&propertyId=" + encodeURIComponent(connection.propertyId) + "&readOnly=1");
    expect(breakdown.status).toBe(200);
    expect(await breakdown.json()).toMatchObject({ validationReadOnly: true });
    expect(ga4ServiceMock.getAcquisitionBreakdown).toHaveBeenLastCalledWith(
      campaign.id,
      storageMock,
      expect.any(String),
      connection.propertyId,
      2000,
      campaign.ga4CampaignFilter,
      expect.any(String),
      true,
      false,
    );

    storageMock.getGA4Connection.mockResolvedValue({ ...connection, refreshToken: "refresh-token" });
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValueOnce(new Error("GA4 API Error: 401 unauthenticated"));
    const toDate = await fetch(baseUrl + "/api/campaigns/" + campaign.id + "/ga4-to-date?propertyId=" + encodeURIComponent(connection.propertyId) + "&readOnly=1");
    expect(toDate.status).toBe(401);
    expect(await toDate.json()).toMatchObject({ validationReadOnly: true, error: "TOKEN_EXPIRED" });
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
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
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "USD" });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      revenueMetric: "purchaseRevenue",
      currencyCode: "USD",
      totals: { ...dailyRow, revenue: 0, conversions: 5 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });
    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: 0, totalRevenue: 0, roas: 0, roi: -100, cpa: 20 });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenLastCalledWith(
      connection.propertyId,
      connection.accessToken,
      expect.any(String),
      "2026-07-31",
      campaign.ga4CampaignFilter,
      campaign.currency,
    );
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

  it("preserves last-good financial values when live to-date totals are incomplete", async () => {
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "USD", totals: { sessions: 100, users: 80 } });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      totals: { ...dailyRow, revenue: 999, conversions: 99 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: -1, totalRevenue: -1, roas: -1, roi: -1, cpa: -1 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it("does not treat observed provider zero conversions and revenue as missing repair data", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{
      ...dailyRow,
      date: "2026-07-31",
      conversions: 0,
      revenue: "0.00",
      revenueMetric: "totalRevenue",
    }]);

    vi.useRealTimers();
    const response = await fetch(`${baseUrl}/api/campaigns/${campaign.id}/ga4-daily?days=30&readOnly=true&propertyId=${encodeURIComponent(connection.propertyId)}`);
    expect(response.status).toBe(200);
    expect((await response.json()).data[0]).toMatchObject({ conversions: 0, revenue: "0.00" });
    expect(ga4ServiceMock.getTimeSeriesData).not.toHaveBeenCalled();
    expect(storageMock.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
  });

  it("does not substitute a configured-lookback breakdown for live to-date financial totals", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "USD", totals: { sessions: 100, users: 80 } });
    ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
      totals: { ...dailyRow, revenue: 150, conversions: 5 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: -1, totalRevenue: -1, roas: -1, roi: -1, cpa: -1 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it("preserves last-good financial values when native GA4 currency differs from campaign currency", async () => {
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
      revenueMetric: "purchaseRevenue",
      currencyCode: "EUR",
      totals: { ...dailyRow, revenue: 150, conversions: 5 },
    });

    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-31", suppressAlerts: true });

    const values = Object.fromEntries(kpiRows.map((row) => [row.metric, Number(row.currentValue)]));
    expect(values).toMatchObject({ revenue: -1, totalRevenue: -1, roas: -1, roi: -1, cpa: -1 });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
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

  it("does not expand an empty Custom Report KPI/Benchmark selection to every saved row", async () => {
    const emptySelectionReport = {
      ...report,
      id: "ga4-empty-selection-report",
      configuration: JSON.stringify({
        sections: { overview: false, kpis: true, benchmarks: true, ads: false, insights: false },
        subsections: { kpis: { items: true }, benchmarks: { items: true } },
        selectedKpiIds: [],
        selectedBenchmarkIds: [],
      }),
    };

    expect(await preflightGA4ReportKPIConsumers(emptySelectionReport, "2026-07-31", { suppressAlerts: true })).toEqual({ ok: true });
    expect(storageMock.getPlatformKPIs).not.toHaveBeenCalled();
    expect(storageMock.getPlatformBenchmarks).not.toHaveBeenCalled();

    pdfTextCalls.length = 0;
    const buffer = await buildGA4ScheduledPdfAttachment({
      report: emptySelectionReport,
      reportName: emptySelectionReport.name,
      windowStart: "2026-07-02",
      windowEnd: "2026-07-31",
      campaignName: campaign.name,
    });
    const text = pdfTextCalls.join("\n");
    expect(buffer.length).toBeGreaterThan(100);
    for (const row of [...kpiRows, ...benchmarkRows]) expect(text).not.toContain(row.name);
  });

  it("feeds the fixture through the shared direct, test-send, manual, and scheduled report preflight/builder", async () => {
    const preflight = await preflightGA4ReportKPIConsumers(report, "2026-07-31", { suppressAlerts: true });
    expect(preflight.ok).toBe(true);
    expect(preflight.benchmarks).toHaveLength(benchmarkRows.length);
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
    expect(preflight.ok).toBe(true);
    expect(preflight.benchmarks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "benchmark-1",
        currentValue: "200",
        benchmarkValue: "250",
        thresholdStatus: "needs_attention",
      }),
    ]));

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
