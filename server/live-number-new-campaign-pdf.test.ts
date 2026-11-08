import { afterEach, expect, it, vi } from "vitest";
import { PDFParse } from "pdf-parse";
const storage = vi.hoisted(() => Object.fromEntries([
  "getCampaign", "getGA4Connections", "getGA4DailyMetrics", "getGA4OverviewSnapshot", "getLatestFinancialDailySnapshot",
  "getRevenueSources", "getSpendSources", "getRevenueBreakdownBySource", "getSpendBreakdownBySource", "getPlatformKPIs", "getPlatformBenchmarks",
].map(name => [name, vi.fn()])));
vi.mock("./storage", () => ({ storage }));
vi.mock("./analytics", () => ({ ga4Service: new Proxy({}, { get: () => () => { throw new Error("Unexpected provider call"); } }) }));
import { buildGA4ScheduledPdfAttachment } from "./ga4-scheduled-report-pdf";
import { checkGeneratedReportText, checkReportDetailText } from "./live-number-generated-report-checks";
import type { LiveNumberSnapshot } from "./live-number-checks";

afterEach(() => { vi.useRealTimers(); vi.resetAllMocks(); });
it.each(["insights", "custom"])("verifies actual %s PDF bytes for a just-imported campaign with no saved summaries or trend history", async type => {
  const now = new Date("2026-11-05T13:30:00Z");
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
  const campaign = { id: "a", name: "New campaign", ownerId: "owner", clientId: "client", status: "active", createdAt: "2026-11-05T13:05:00Z",
    currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["search"]' };
  const connection = { id: "connection", campaignId: "a", propertyId: "123", isPrimary: true, isActive: true, method: "access_token", accessToken: "fixture", importStartDate: "2026-11-04", lookbackDays: 30 };
  const daily = [{ campaignId: "a", propertyId: "123", date: "2026-11-04", sessions: 20, users: 10, conversions: 1.5, revenue: "100.00", engagedSessions: 10, pageviews: 30, engagementRate: "0.5" }];
  const publication = { campaignId: "a", propertyId: "123", windowStart: "2026-11-04", windowEnd: "2026-11-04",
    campaignBreakdown: { meta: { propertyId: "123", currencyCode: "EUR" }, totals: { users: 10, sessions: 20, conversions: 1.5, revenue: 100, engagedSessions: 10 },
      rows: [{ campaign: "search", users: 10, sessions: 20, conversions: 1.5, revenue: 100, engagedSessions: 10, sessionKeyEventRate: 0.05 }] }, landingPages: { rows: [] }, conversionEvents: { rows: [] } };
  const snapshot: LiveNumberSnapshot = { campaign, rows: { ga4Connections: [connection], ga4DailyMetrics: daily, ga4OverviewSnapshots: [publication],
    revenueSources: [], spendSources: [], revenueRecords: [], spendRecords: [], kpis: [], benchmarks: [], metricSnapshots: [] } };
  storage.getCampaign.mockResolvedValue(campaign); storage.getGA4Connections.mockResolvedValue([connection]);
  storage.getGA4OverviewSnapshot.mockResolvedValue(publication);
  storage.getLatestFinancialDailySnapshot.mockResolvedValue({ campaignId: "a", reportingDate: "2026-11-04", metrics: { financialDaily: {
    version: "financial_daily_snapshot_v1", currency: "EUR",
    currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-11-04", endDate: "2026-11-04", dataThroughDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" },
    inputs: { revenue: { value: "100.00", available: true, sources: ["ga4"] }, spend: { value: null, available: false, sources: [] },
      conversions: { value: 1.5, available: true, sources: ["ga4"] } },
  } } });
  storage.getGA4DailyMetrics.mockImplementation(async (_campaign, _property, start, end) => daily.filter(row => row.date >= start && row.date <= end));
  for (const name of ["getRevenueSources", "getSpendSources", "getRevenueBreakdownBySource", "getSpendBreakdownBySource", "getPlatformKPIs", "getPlatformBenchmarks"]) storage[name].mockResolvedValue([]);
  const pdf = await buildGA4ScheduledPdfAttachment({ campaignName: campaign.name, windowStart: "2026-11-04", windowEnd: "2026-11-04",
    report: { id: "report", campaignId: "a", platformType: "google_analytics", reportType: type,
      ...(type === "custom" ? { configuration: { sections: { insights: true }, subsections: { insights: { summaryCards: true, trends: true, dataSummary: true, actions: true } } } } : {}) } });
  expect(pdf?.subarray(0, 4).toString()).toBe("%PDF");
  const parser = new PDFParse({ data: pdf! });
  try {
    const { text } = await parser.getText();
    const checks = [...checkGeneratedReportText(snapshot, text, "insights", now), ...checkReportDetailText(snapshot, text, "insights", now)];
    expect(checks.length).toBeGreaterThanOrEqual(10);
    expect(checks.filter(check => check.status !== "passed")).toEqual([]);
    expect(text).toContain("EUR 100.00"); expect(text).toContain("Unavailable");
    expect(text).not.toContain("DATE SESSIONS REVENUE CONVERSIONS");
    expect(checkGeneratedReportText(snapshot, text.replace("EUR 100.00", "EUR 99.00"), "insights", now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "difference" }));
  } finally { await parser.destroy(); }
}, 30_000);
