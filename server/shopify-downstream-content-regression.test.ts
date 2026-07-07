import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pdfTextCalls = vi.hoisted((): string[] => []);

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getCampaigns: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4Connection: vi.fn(),
  updateGA4ConnectionTokens: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getLatestGA4DailyMetric: vi.fn(),
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
const getAuthMock = vi.hoisted(() => vi.fn(() => ({ userId: "user-1" })));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: getAuthMock }));
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
    splitTextToSize(value: any) {
      return [String(value)];
    }
    text(value: any) {
      if (Array.isArray(value)) {
        value.forEach((item) => pdfTextCalls.push(String(item)));
      } else {
        pdfTextCalls.push(String(value));
      }
    }
    output(kind: string) {
      if (kind === "nodebuffer") return Buffer.from("x".repeat(256));
      return new ArrayBuffer(256);
    }
  },
}));

import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { registerRoutes } from "./routes-oauth";

const campaign = {
  id: "campaign-1",
  name: "Shopify Downstream Campaign",
  ownerId: "user-1",
  currency: "USD",
  startDate: "2026-06-01T00:00:00.000Z",
  createdAt: "2026-06-01T00:00:00.000Z",
  ga4CampaignFilter: "shopify_campaign",
};

const dailyRow = {
  date: "2026-07-04",
  sessions: 10,
  users: 5,
  pageviews: 20,
  conversions: 2,
  revenue: "100.00",
  engagedSessions: 6,
  engagementRate: 0.6,
  updatedAt: "2026-07-05T09:00:00.000Z",
};

const revenueSource = {
  id: "shopify-source-1",
  sourceType: "shopify",
  displayName: "Shopify",
  isActive: true,
  mappingConfig: {
    platformContext: "ga4",
    campaignValueRevenueTotals: [
      { campaignValue: "shopify_campaign", revenue: 199.98, orderCount: 2 },
    ],
  },
};

const revenueKpi = {
  id: "kpi-revenue",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Revenue KPI",
  metric: "Revenue",
  currentValue: "299.98",
  targetValue: "500",
  alertThreshold: "350",
  alertCondition: "below",
  alertsEnabled: true,
};

const revenueBenchmark = {
  id: "benchmark-revenue",
  campaignId: campaign.id,
  platformType: "google_analytics",
  name: "Revenue Benchmark",
  metric: "Revenue",
  currentValue: "299.98",
  benchmarkValue: "400",
  alertThreshold: "350",
  alertCondition: "below",
  alertsEnabled: true,
};

function resetMocks() {
  for (const value of Object.values(storageMock)) value.mockReset();
  for (const value of Object.values(ga4ServiceMock)) value.mockReset();
  refreshCampaignCurrentValuesForCampaignMock.mockReset();
  resolveCampaignCurrentValueForAlertMock.mockReset();
  resolveCampaignCurrentValueForAlertMock.mockImplementation(async (row: any) => row);
  getAuthMock.mockReset();
  getAuthMock.mockReturnValue({ userId: "user-1" });
  pdfTextCalls.length = 0;
}

function setCommonShopifyFinancialMocks() {
  storageMock.getCampaign.mockResolvedValue(campaign);
  storageMock.getCampaigns.mockResolvedValue([campaign]);
  storageMock.getGA4Connections.mockResolvedValue([
    { id: "ga4-1", campaignId: campaign.id, propertyId: "properties/123", method: "access_token", accessToken: "ga4-token", isPrimary: true },
  ]);
  storageMock.getGA4Connection.mockResolvedValue(null);
  storageMock.getGA4DailyMetrics.mockResolvedValue([dailyRow]);
  storageMock.getLatestGA4DailyMetric.mockResolvedValue(dailyRow);
  storageMock.getRevenueSources.mockResolvedValue([revenueSource]);
  storageMock.getSpendSources.mockResolvedValue([]);
  storageMock.getRevenueBreakdownBySource.mockResolvedValue([
    { sourceId: revenueSource.id, sourceType: "shopify", displayName: "Shopify", revenue: 199.98 },
  ]);
  storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
  storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 199.98, sourceIds: [revenueSource.id] });
  storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
  storageMock.getPlatformKPIs.mockResolvedValue([revenueKpi]);
  storageMock.updateKPI.mockResolvedValue({});
  storageMock.getKPIProgress.mockResolvedValue([]);
  storageMock.recordKPIProgress.mockResolvedValue({});
  storageMock.getPlatformBenchmarks.mockResolvedValue([revenueBenchmark]);
  storageMock.updateBenchmark.mockResolvedValue({});
  storageMock.getBenchmarkHistory.mockResolvedValue([]);
  storageMock.recordBenchmarkHistory.mockResolvedValue({});
  storageMock.getKPI.mockResolvedValue(revenueKpi);
  storageMock.getBenchmark.mockResolvedValue(revenueBenchmark);
  storageMock.getNotifications.mockResolvedValue([]);
  refreshCampaignCurrentValuesForCampaignMock.mockResolvedValue(undefined);

  ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue({ sessions: 10, users: 5, conversions: 2, revenue: 100 });
  ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({
    rows: [{ campaign: "shopify_campaign", sessions: 10, users: 5, conversions: 2, revenue: 100 }],
    totals: { sessions: 10, users: 5, conversions: 2, revenue: 100 },
  });
  ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getTimeSeriesData.mockResolvedValue([dailyRow]);
  ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({
    revenueMetric: "purchaseRevenue",
    totals: { sessions: 10, users: 5, conversions: 2, pageviews: 20, revenue: 100 },
  });
}

describe("Shopify downstream value/content regression guard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00.000Z"));
    resetMocks();
    setCommonShopifyFinancialMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders scheduled GA4 PDF content with Shopify source revenue and total revenue", async () => {
    const buffer = await buildGA4ScheduledPdfAttachment({
      report: {
        id: "report-1",
        campaignId: campaign.id,
        name: "Shopify Downstream Report",
        reportType: "custom",
        configuration: JSON.stringify({
          sections: { overview: true, kpis: true, benchmarks: true, ads: true },
          subsections: {
            overview: { revenue: true, performance: true, campaignBreakdown: true },
            kpis: { items: true },
            benchmarks: { items: true },
            ads: { summary: true, allCampaigns: true, revenueBreakdown: true },
          },
        }),
      },
      reportName: "Shopify Downstream Report",
      windowStart: "2026-06-01",
      windowEnd: "2026-07-04",
      campaignName: campaign.name,
    });

    const text = pdfTextCalls.join("\n");
    expect(buffer?.length).toBeGreaterThan(100);
    expect(text).toContain("Total Revenue");
    expect(text).toContain("USD 299.98");
    expect(text).toContain("Revenue Sources");
    expect(text).toContain("Shopify");
    expect(text).toContain("USD 199.98");
    expect(text).toContain("shopify_campaign");
    expect(text).toContain("Revenue KPI");
    expect(text).toContain("Revenue Benchmark");
    expect(text).toContain("299.98");
  });

  it("persists GA4 KPI and Benchmark row values from the Shopify imported revenue total", async () => {
    await runGA4DailyKPIAndBenchmarkJobs({ campaignId: campaign.id, date: "2026-07-04", suppressAlerts: true });

    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-05", "ga4");
    expect(storageMock.updateKPI).toHaveBeenCalledWith(revenueKpi.id, { currentValue: "299.98" });
    expect(storageMock.updateBenchmark).toHaveBeenCalledWith(revenueBenchmark.id, { currentValue: "299.98" });
  });

  it("returns notification metadata with the current Shopify-backed GA4 revenue value", async () => {
    storageMock.getNotifications.mockResolvedValue([
      {
        id: "notification-1",
        campaignId: campaign.id,
        type: "performance-alert",
        title: "Old alert title",
        message: "Old alert message",
        read: false,
        createdAt: "2026-07-05T09:00:00.000Z",
        metadata: JSON.stringify({ alertType: "performance-alert", kpiId: revenueKpi.id }),
      },
    ]);

    const app = express();
    const server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/notifications`);
      const body = await response.json();
      const metadata = JSON.parse(body[0].metadata);

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].title).toBe("GA4 KPI Alert: Revenue KPI");
      expect(metadata.currentValue).toBe("299.98");
      expect(metadata.thresholdValue).toBe("350");
      expect(metadata.actionUrl).toBe(`/campaigns/${campaign.id}/ga4-metrics?tab=kpis&highlight=${revenueKpi.id}`);
      expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-07-05", "ga4");
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
