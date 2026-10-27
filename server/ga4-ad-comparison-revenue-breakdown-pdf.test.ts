import { afterEach, beforeEach, expect, it, vi } from "vitest";

const pdfText = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(), getGA4Connections: vi.fn(), getGA4DailyMetrics: vi.fn(),
  getRevenueSources: vi.fn(), getSpendSources: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
  getPlatformKPIs: vi.fn(), getPlatformBenchmarks: vi.fn(),
  getGA4OverviewSnapshot: vi.fn(), getLatestFinancialDailySnapshot: vi.fn(),
}));
const ga4ServiceMock = vi.hoisted(() => ({
  getMetricsWithAutoRefresh: vi.fn(), getAcquisitionBreakdown: vi.fn(),
  getLandingPagesReport: vi.fn(), getConversionEventsReport: vi.fn(),
  getTimeSeriesData: vi.fn(), getTotalsWithRevenue: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("jspdf", () => ({ jsPDF: class {
  setFillColor() {} rect() {} roundedRect() {} setFontSize() {} setFont() {}
  setTextColor() {} setDrawColor() {} setLineWidth() {} line() {} circle() {}
  getTextWidth(value: unknown) { return String(value).length * 2; }
  addPage() {} splitTextToSize(value: unknown) { return [String(value)]; }
  text(value: unknown) { pdfText.push(String(value)); }
  output() { return Buffer.from("x".repeat(256)); }
} }));

import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  pdfText.length = 0;
  for (const mock of Object.values(storageMock)) mock.mockReset();
  for (const mock of Object.values(ga4ServiceMock)) mock.mockReset();
  const campaign = { id: "campaign-1", name: "Campaign", currency: "USD", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "campaign-a", startDate: new Date("2026-09-01T00:00:00.000Z") };
  storageMock.getCampaign.mockResolvedValue(campaign);
  storageMock.getGA4Connections.mockResolvedValue([{ id: "ga4-1", campaignId: campaign.id, propertyId: "123", method: "access_token", accessToken: "token", isPrimary: true, lookbackDays: 30, importStartDate: "2026-09-01" }]);
  storageMock.getGA4DailyMetrics.mockResolvedValue(Array.from({ length: 15 }, (_, i) => ({ date: `2026-09-${String(i + 1).padStart(2, "0")}`, sessions: i === 14 ? 10 : 0, users: i === 14 ? 10 : 0, conversions: i === 14 ? 1 : 0, revenue: i === 14 ? "100" : "0", engagedSessions: i === 14 ? 5 : 0 })));
  storageMock.getGA4OverviewSnapshot.mockResolvedValue({ campaignId: campaign.id, propertyId: "123", windowStart: "2026-09-01", windowEnd: "2026-09-15",
    campaignBreakdown: { rows: [{ campaign: "campaign-a", sessions: 10, users: 10, conversions: 1, revenue: 100, sessionKeyEventRate: 0.1 }], totals: { sessions: 10, users: 10, conversions: 1, revenue: 100 }, meta: { currencyCode: "USD", revenueMetric: "totalRevenue" } }, landingPages: { rows: [] }, conversionEvents: { rows: [] } });
  storageMock.getLatestFinancialDailySnapshot.mockResolvedValue({ campaignId: campaign.id, reportingDate: "2026-09-15", metrics: { financialDaily: {
    version: "financial_daily_snapshot_v1", currency: "USD", currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-09-01", endDate: "2026-09-15", dataThroughDate: "2026-09-15", reportingTimeZone: "Europe/Amsterdam" },
    inputs: { revenue: { available: true, value: "110.00", sources: ["ga4", "revenue-source:source-1"] }, spend: { available: false, value: null, sources: [] }, conversions: { available: true, value: 1, sources: ["ga4"] } },
  } } });
  storageMock.getRevenueSources.mockResolvedValue([{ id: "source-1", campaignId: campaign.id, sourceType: "csv", displayName: "Imported source", currency: "USD", isActive: true, mappingConfig: JSON.stringify({ campaignValueRevenueTotals: [{ campaignValue: "campaign-a", revenue: 15 }] }) }]);
  storageMock.getSpendSources.mockResolvedValue([]);
  storageMock.getRevenueBreakdownBySource.mockImplementation(async (_id, _start, end) => [{ sourceId: "source-1", sourceType: "csv", displayName: "Imported source", currency: "USD", revenue: end === "2026-09-16" ? 15 : 10 }]);
  storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
  storageMock.getPlatformKPIs.mockResolvedValue([]);
  storageMock.getPlatformBenchmarks.mockResolvedValue([]);
  ga4ServiceMock.getMetricsWithAutoRefresh.mockResolvedValue({ sessions: 10, users: 10, conversions: 1, revenue: 100 });
  ga4ServiceMock.getAcquisitionBreakdown.mockResolvedValue({ rows: [{ campaign: "campaign-a", sessions: 10, users: 10, conversions: 1, revenue: 100, sessionKeyEventRate: 0.1 }], totals: { sessions: 10, users: 10, conversions: 1, revenue: 100 } });
  ga4ServiceMock.getLandingPagesReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getConversionEventsReport.mockResolvedValue({ rows: [] });
  ga4ServiceMock.getTimeSeriesData.mockResolvedValue([]);
  ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ revenueMetric: "totalRevenue", currencyCode: "USD", totals: { sessions: 10, users: 10, conversions: 1, revenue: 100 } });
});

afterEach(() => vi.useRealTimers());

it.each([1, -1, 0].flatMap(sign => [false, true].map(mapped => ({ sign, mapped }))))("preserves chart subtotal precision in scheduled PDFs (sign $sign, mapped $mapped)", async ({ sign, mapped }) => {
  const native = Number((7653.956333 * sign).toFixed(2));
  const campaign = await storageMock.getCampaign();
  storageMock.getCampaign.mockResolvedValue({ ...campaign, ga4CampaignFilter: JSON.stringify(["campaign-a", "campaign-b"]) });
  const snapshot = await storageMock.getGA4OverviewSnapshot();
  storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...snapshot, campaignBreakdown: {
    ...snapshot.campaignBreakdown, totals: { ...snapshot.campaignBreakdown.totals, revenue: native }, rows: [
      { campaign: "campaign-a", sessions: 6, users: 6, conversions: 0.6, sessionKeyEventRate: 0.1, revenue: 3400.434193 * sign },
      { campaign: "campaign-b", sessions: 4, users: 4, conversions: 0.4, sessionKeyEventRate: 0.1, revenue: 4253.52214 * sign },
    ],
  } });
  const sources = [{ id: "source-1", sourceType: "hubspot", displayName: "HubSpot", revenue: 250 }, { id: "source-2", sourceType: "salesforce", displayName: "Salesforce", revenue: 100 }];
  storageMock.getRevenueSources.mockResolvedValue(sources.map(source => ({ ...source, campaignId: campaign.id, currency: "USD", isActive: true,
    mappingConfig: JSON.stringify({ pipelineEnabled: true, pipelineTotalToDate: 3200,
      campaignMappings: mapped && source.id === "source-1" ? [{ crmValue: "deal-a", linkedinCampaignName: "campaign-a" }] : [],
      campaignValueRevenueTotals: [{ campaignValue: "deal-a", revenue: source.revenue }],
    }),
  })));
  storageMock.getRevenueBreakdownBySource.mockResolvedValue(sources.map(source => ({ ...source, sourceId: source.id, currency: "USD" })));
  const financial = await storageMock.getLatestFinancialDailySnapshot();
  financial.metrics.financialDaily.inputs.revenue.value = (native + 350).toFixed(2);
  storageMock.getLatestFinancialDailySnapshot.mockResolvedValue(financial);
  await buildGA4ScheduledPdfAttachment({
    report: { id: "report-precision", campaignId: campaign.id, reportType: "ads", configuration: JSON.stringify({ adComparisonMetric: "revenue" }) },
    reportName: "Chart precision", windowStart: "2026-09-01", windowEnd: "2026-09-15", campaignName: "Campaign",
  });
  const summary = pdfText.findIndex(text => text.toUpperCase() === "CAMPAIGN BREAKDOWN REVENUE");
  expect(summary).toBeGreaterThan(-1);
  const money = (value: number) => `USD ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  expect(pdfText[summary + 1]).toBe(money(native + (mapped ? 250 : 0)));
  expect(pdfText).toContain(money(native + 350));
  expect(pdfText).not.toContain("USD 3,200.00");
});

it("excludes today's imported source amount from the completed-day scheduled PDF", async () => {
  await buildGA4ScheduledPdfAttachment({
    report: { id: "report-1", campaignId: "campaign-1", reportType: "custom", configuration: JSON.stringify({ sections: { ads: true }, subsections: { ads: { revenueBreakdown: true } } }) },
    reportName: "Revenue Breakdown", windowStart: "2026-09-01", windowEnd: "2026-09-15", campaignName: "Campaign",
  });

  expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledTimes(2);
  expect(storageMock.getRevenueBreakdownBySource.mock.calls.every((call) => call[2] === "2026-09-15")).toBe(true);
  expect(pdfText.join("\n")).toContain("USD 10.00");
  expect(pdfText.join("\n")).not.toContain("USD 15.00");
});

it("omits All Campaigns from a new standard Ad Comparison PDF", async () => {
  await buildGA4ScheduledPdfAttachment({
    report: { id: "report-2", campaignId: "campaign-1", reportType: "ads", configuration: "{}" },
    reportName: "Ad Comparison", windowStart: "2026-09-01", windowEnd: "2026-09-15", campaignName: "Campaign",
  });

  expect(pdfText.join("\n")).toContain("Revenue Breakdown");
  expect(pdfText.join("\n")).not.toContain("All Campaigns");
});

it("retains All Campaigns in an explicitly saved legacy custom PDF", async () => {
  await buildGA4ScheduledPdfAttachment({
    report: { id: "report-3", campaignId: "campaign-1", reportType: "custom", configuration: JSON.stringify({ sections: { ads: true }, subsections: { ads: { allCampaigns: true } } }) },
    reportName: "Legacy comparison", windowStart: "2026-09-01", windowEnd: "2026-09-15", campaignName: "Campaign",
  });

  expect(pdfText.join("\n")).toContain("All Campaigns");
});
