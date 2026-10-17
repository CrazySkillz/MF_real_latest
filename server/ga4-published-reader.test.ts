import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isGA4FinancialTotalsCandidate, selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { financialDailySnapshotInputSchema } from "../shared/schema";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { getReportingDateWindow, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";
import { resolveCampaignCumulativeFinancials } from "./utils/campaign-cumulative-financials";

const source = readFileSync("server/routes-oauth.ts", "utf8");
const file = ts.createSourceFile("routes-oauth.ts", source, ts.ScriptTarget.Latest, true);
function route(path: string, bindings: Record<string, any>) {
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "app.get" && node.arguments[0]?.getText(file) === JSON.stringify(path)) callback = node.arguments.at(-1);
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!callback) throw new Error(`Route not found: ${path}`);
  return new Function(...Object.keys(bindings), ts.transpileModule(`return (${callback.getText(file)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
}
const campaign = { id: "campaign-a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "sale" };
const connection = { id: "connection-a", campaignId: campaign.id, propertyId: "123", importStartDate: "2026-10-15", isActive: true, isPrimary: true, method: "access_token", accessToken: "token" };
const overview = () => ({ campaignId: campaign.id, propertyId: connection.propertyId, windowStart: "2026-10-15", windowEnd: "2026-10-16",
  campaignBreakdown: { totals: { sessions: 30, users: 25, conversions: 5, revenue: 100.01 }, meta: { currencyCode: "EUR", revenueMetric: "totalRevenue" } },
});
const published = () => ({ campaignId: campaign.id, reportingDate: "2026-10-16", metrics: { financialDaily: {
  version: "financial_daily_snapshot_v1", currency: "EUR", currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-15", endDate: "2026-10-16", dataThroughDate: "2026-10-16", reportingTimeZone: "Europe/Amsterdam" },
  inputs: { revenue: { available: true, value: "130.01", sources: ["ga4", "revenue-source:r"] }, spend: { available: true, value: "20.00", sources: ["spend-source:s"] }, conversions: { available: true, value: 5, sources: ["ga4"] } },
} } });
const response = () => { const r: any = { code: 200, body: null, setHeader: vi.fn(), status(code: number) { r.code = code; return r; }, json(body: any) { r.body = body; return r; } }; return r; };

describe("published GA4 readers", () => {
  let storage: Record<string, any>, provider: Record<string, any>, bindings: Record<string, any>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-17T10:00:00Z"));
    storage = Object.fromEntries(["getCampaign", "getGA4Connection", "getGA4Connections", "getGA4OverviewSnapshot", "getGA4DailyMetrics", "getLatestFinancialDailySnapshot", "getLinkedInConnection", "getMetaConnection", "getCustomIntegration", "getGoogleSheetsConnections", "getSpendTotalForRange", "getSpendBreakdownBySource", "getSpendSources", "getRevenueTotalForRange", "getRevenueBreakdownBySource", "getRevenueSources"].map((key) => [key, vi.fn().mockResolvedValue(null)]));
    storage.getCampaign.mockResolvedValue({ ...campaign }); storage.getGA4Connection.mockResolvedValue({ ...connection }); storage.getGA4Connections.mockResolvedValue([{ ...connection }]);
    storage.getGA4OverviewSnapshot.mockImplementation(async () => overview()); storage.getLatestFinancialDailySnapshot.mockImplementation(async () => published());
    storage.getGA4DailyMetrics.mockResolvedValue([{ date: "2026-10-15", sessions: 10, users: 10, conversions: 2, revenue: 40, engagedSessions: 5 }, { date: "2026-10-16", sessions: 20, users: 15, conversions: 3, revenue: 60.01, engagedSessions: 10 }]);
    storage.getGoogleSheetsConnections.mockResolvedValue([]);
    storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, currency: "EUR", sourceIds: ["s"] });
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 30, currency: "EUR", sourceIds: ["r"] });
    storage.getSpendSources.mockResolvedValue([{ id: "s", currency: "EUR" }]); storage.getRevenueSources.mockResolvedValue([{ id: "r", currency: "EUR" }]);
    storage.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "s", spend: 20, currency: "EUR" }]); storage.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "r", revenue: 30, currency: "EUR" }]);
    provider = { getTotalsWithRevenue: vi.fn().mockResolvedValue({ currencyCode: "EUR", revenueMetric: "totalRevenue", totals: { sessions: 31, users: 26, conversions: 6, revenue: 110 } }), getAcquisitionBreakdown: vi.fn().mockRejectedValue(new Error("no live request")) };
    bindings = { storage, ga4Service: provider, ensureCampaignAccess: vi.fn().mockResolvedValue({ ...campaign }),
      parseGA4CampaignFilter: (value: string) => value ? [value] : [], isNoRevenueFilter: () => false,
      normalizePropertyIdForMock: (id: string) => id.replace("properties/", ""), isYesopMockProperty: (id: string) => id === "yesop", isSupportedGA4ConnectionMethod: () => true,
      getReportingDateWindow, resolveGA4ImportToDateWindow, isGA4FinancialTotalsCandidate, selectGA4FinancialTotalsSource, financialDailySnapshotInputSchema,
      assertGA4InsightsFinancialCurrencyScope: () => {}, getDateRangeBounds: () => ({ startDate: "2026-07-19", endDate: "2026-10-16" }),
      summarizeGA4TrafficRows, resolveCampaignCumulativeFinancials, observeFinancialDailySnapshotReadiness: vi.fn(),
      getShopifyRevenueSourceFreshness: () => undefined,
      buildLinkedInPlatformSourceForAggregate: async () => ({ linkedIn: { connected: false }, linkedInSpend: 0 }),
      buildGoogleAdsPlatformSourceForAggregate: async () => ({ googleAds: { connected: false }, googleAdsSpend: 0 }),
      buildInstagramPlatformSourceForAggregate: async () => ({ instagram: { connected: false }, instagramSpend: 0 }),
      buildTikTokPlatformSourceForAggregate: async () => ({ tiktok: { connected: false }, tiktokSpend: 0 }),
      getGoogleSheetsConfirmedFinancialsForAggregate: async () => null, buildGoogleSheetsPlatformSourceForAggregate: () => ({ connected: false }),
      getSynchronizedGA4OverviewSnapshot: (...args: any[]) => storage.getGA4OverviewSnapshot(...args),
      getCampaignMetricTotals: vi.fn().mockResolvedValue({ ga4FinancialSource: "persisted_overview", revenueAvailable: true, spendAvailable: true, revenue: 130.01, ga4Revenue: 100.01, spend: 20, financialConversions: 5, sessions: 30, users: 25 }),
      buildCampaignPerformanceSummaryAggregate: (input: any) => buildPerformanceSummaryAggregate({ ...input, platformSources: [] }),
    };
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  const req = (query: any = {}) => ({ params: { id: campaign.id }, query: { propertyId: connection.propertyId, ...query } });

  it("reads the saved current native total even with an expired provider token", async () => {
    storage.getGA4Connection.mockResolvedValue({ ...connection, accessToken: null });
    const res = response(); await route("/api/campaigns/:id/ga4-to-date", bindings)(req(), res);
    expect(res.code).toBe(200); expect(res.body.totals).toMatchObject({ revenue: 100.01, conversions: 5 });
    expect(res.body.revenueMetric).toBe("totalRevenue"); expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
  it.each(["missing", "wrong property", "wrong campaign", "old date", "currency"])("withholds a current read with %s saved data", async (kind) => {
    const saved = overview();
    if (kind === "wrong property") saved.propertyId = "other";
    if (kind === "wrong campaign") saved.campaignId = "other";
    if (kind === "old date") saved.windowEnd = "2026-10-15";
    if (kind === "currency") saved.campaignBreakdown.meta.currencyCode = "USD";
    storage.getGA4OverviewSnapshot.mockResolvedValue(kind === "missing" ? null : saved);
    const res = response(); await route("/api/campaigns/:id/ga4-to-date", bindings)(req(), res);
    expect(res.code).toBe(503); expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
  it("preserves the exact historical-date provider path", async () => {
    const res = response(); await route("/api/campaigns/:id/ga4-to-date", bindings)(req({ endDate: "2026-10-15", readOnly: "1" }), res);
    expect(res.code).toBe(200); expect(provider.getTotalsWithRevenue).toHaveBeenCalledWith("123", "token", "2026-10-15", "2026-10-15", ["sale"], "EUR");
  });
  it("checks campaign access before reading saved data", async () => {
    bindings.ensureCampaignAccess.mockResolvedValue(null);
    await route("/api/campaigns/:id/ga4-to-date", bindings)(req(), response());
    expect(storage.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });
  it("keeps diagnostic totals and provenance on the published values", async () => {
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.performanceSummary.totals.revenue).toMatchObject({ available: true, value: 130.01 });
    expect(res.body.financials).toMatchObject({ totalRevenue: 130.01, spend: 20, conversions: 5, cpa: 4 });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled(); expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it.each(["missing publication", "new imported revenue", "changed publication", "failed source read"])("withholds mixed diagnostic figures: %s", async (kind) => {
    if (kind === "missing publication") storage.getLatestFinancialDailySnapshot.mockResolvedValue(null);
    if (kind === "new imported revenue") storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 40, currency: "EUR", sourceIds: ["r"] });
    if (kind === "changed publication") { const saved = published(); saved.metrics.financialDaily.inputs.conversions.value = 6; storage.getLatestFinancialDailySnapshot.mockResolvedValue(saved); }
    if (kind === "failed source read") storage.getSpendTotalForRange.mockRejectedValue(new Error("unavailable"));
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(503);
    expect(res.body.performanceSummary).toBeUndefined();
  });
});
