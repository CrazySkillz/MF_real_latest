import { afterEach, beforeEach, expect, it, vi } from "vitest";

const pdfText = vi.hoisted((): string[] => []);
const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(), getGA4Connections: vi.fn(), getGA4DailyMetrics: vi.fn(),
  getRevenueSources: vi.fn(), getSpendSources: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
  getPlatformKPIs: vi.fn(), getPlatformBenchmarks: vi.fn(),
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
  storageMock.getGA4DailyMetrics.mockResolvedValue([{ date: "2026-09-15", sessions: 10, users: 10, conversions: 1, revenue: "100", engagedSessions: 5 }]);
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

it("includes a same-UTC-day imported source amount in Revenue Breakdown's scheduled PDF", async () => {
  await buildGA4ScheduledPdfAttachment({
    report: { id: "report-1", campaignId: "campaign-1", reportType: "custom", configuration: JSON.stringify({ sections: { ads: true }, subsections: { ads: { revenueBreakdown: true } } }) },
    reportName: "Revenue Breakdown", windowStart: "2026-09-01", windowEnd: "2026-09-15", campaignName: "Campaign",
  });

  expect(storageMock.getRevenueBreakdownBySource).toHaveBeenCalledTimes(2);
  expect(storageMock.getRevenueBreakdownBySource.mock.calls.every((call) => call[2] === "2026-09-16")).toBe(true);
  expect(pdfText.join("\n")).toContain("USD 15.00");
  expect(pdfText.join("\n")).not.toContain("USD 10.00");
});
