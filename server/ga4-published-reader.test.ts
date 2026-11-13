import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isGA4FinancialTotalsCandidate, selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { financialDailySnapshotInputSchema } from "../shared/schema";
import { getGA4DistinctUsers, summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { getReportingDateWindow, getGA4ReportingDateWindow, getGA4ReportingWindowMode, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { buildTrendAnalysisAggregate } from "./utils/trend-analysis-aggregate";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";
import { resolveCampaignCumulativeFinancials } from "./utils/campaign-cumulative-financials";
import { getInternalGA4RefreshWriteInput, isInternalAutoRefreshRequest } from "./internal-request-auth";
import { evaluateExecutiveSummaryTrajectory, buildExecutiveSummaryDailySnapshotInput, buildExecutiveSummaryFinancialSourceIdentity, hasRefreshedGA4RowsForExecutiveSummarySnapshot } from "./utils/executive-summary-daily-snapshot";

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
    bindings = { storage, ga4Service: provider, getInternalGA4RefreshWriteInput, isInternalAutoRefreshRequest, ensureCampaignAccess: vi.fn().mockResolvedValue({ ...campaign }),
      parseGA4CampaignFilter: (value: string) => value ? [value] : [], isNoRevenueFilter: () => false,
      normalizePropertyIdForMock: (id: string) => id.replace("properties/", ""), isYesopMockProperty: (id: string) => id === "yesop", isSupportedGA4ConnectionMethod: () => true,
      getReportingDateWindow, getGA4ReportingWindowMode, resolveGA4ImportToDateWindow, isGA4FinancialTotalsCandidate, selectGA4FinancialTotalsSource, financialDailySnapshotInputSchema,
      assertGA4InsightsFinancialCurrencyScope: () => {}, getDateRangeBounds: () => ({ startDate: "2026-07-19", endDate: "2026-10-16" }),
      getGA4DistinctUsers, summarizeGA4TrafficRows, resolveCampaignCumulativeFinancials, observeFinancialDailySnapshotReadiness: vi.fn(),
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
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  const req = (query: any = {}) => ({ params: { id: campaign.id }, query: { propertyId: connection.propertyId, ...query } });

  it.each([["true", true, "2026-11-11"], ["false", true, "2026-11-09"], ["true", false, "2026-11-09"]])(
    "keeps Trend query and output dates aligned without changing other platforms: %s/%s", async (enabled, hasGA4, endDate) => {
      vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", String(enabled)); vi.setSystemTime(new Date("2026-11-10T23:30:00Z"));
      storage.getGA4Connections.mockResolvedValue(hasGA4 ? [connection] : []);
      storage.getGoogleAdsConnection = vi.fn().mockResolvedValue(null);
      storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, currency: "EUR", sourceIds: [] });
      storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: "EUR", sourceIds: [] });
      storage.getGA4DailyMetrics.mockImplementation(async (_c, _p, start, end) => [
        { date: "2026-11-09", sessions: 9, revenue: 90 }, { date: "2026-11-11", sessions: 1, revenue: 10 },
      ].filter(row => row.date >= start && row.date <= end));
      const res = response(); await route("/api/campaigns/:id/trend-analysis", { ...bindings,
        getReportingDateWindow: getGA4ReportingDateWindow, formatISODateUTC: (date: Date) => date.toISOString().slice(0, 10),
        dateRangeToDays: () => 7, parseNum: (value: any) => Number(value || 0), buildTrendAnalysisAggregate,
        db: { execute: vi.fn().mockResolvedValue({ rows: [] }) }, sql: Object.assign(() => "", { join: () => "" }),
      })(req({ days: 7 }), res);
      expect(res.code).toBe(200); expect(res.body.trendAnalysis.endDate).toBe(endDate);
      const startDate = endDate === "2026-11-11" ? "2026-11-05" : "2026-11-03";
      expect(res.body.trendAnalysis.startDate).toBe(startDate);
      if (hasGA4) {
        expect(storage.getGA4DailyMetrics).toHaveBeenCalledWith(campaign.id, connection.propertyId, startDate, endDate);
        expect(res.body.trendAnalysis.sources[0].dailyRows.length).toBe(enabled === "true" ? 2 : 1);
      } else expect(storage.getGA4DailyMetrics).not.toHaveBeenCalled();
    });

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
  it.each([21, 0, null])("returns the exact published Users value %s in diagnostic aliases without adding daily users", async (users) => {
    const saved: any = overview();
    saved.campaignBreakdown.meta.propertyId = connection.propertyId;
    if (users !== null) saved.campaignBreakdown.meta.distinctUsers = { version: 1, metric: "totalUsers", propertyId: connection.propertyId,
      startDate: saved.windowStart, endDate: saved.windowEnd, total: users, campaigns: [{ name: "sale", users }], daily: [], windows: [] };
    storage.getGA4OverviewSnapshot.mockResolvedValue(saved);
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.ga4.users).toBe(users); expect(res.body.webAnalytics.users).toBe(users);
    expect(res.body.performanceSummary.totals.users).toMatchObject({ value: users ?? 0, available: users !== null });
    expect(res.body.ga4).toMatchObject({ sessions: 30, conversions: 5, revenue: 100.01 });
    expect(res.body.financials).toMatchObject({ totalRevenue: 130.01, spend: 20, conversions: 5 });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled(); expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it.each([false, true])("reads and captures today's CSV with older native coverage (capture: %s)", async capture => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    const saved: any = published(); saved.reportingDate = "2026-10-17";
    Object.assign(saved.metrics.financialDaily.currentValueWindow, { mode: "initial_import_to_latest_available_day", endDate: "2026-10-17", dataThroughDate: "2026-10-17", nativeDataThroughDate: "2026-10-16" });
    saved.metrics.financialDaily.inputs.revenue.value = "142.35";
    storage.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 42.34, currency: "EUR", sourceIds: ["r"] });
    storage.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "r", revenue: 42.34, currency: "EUR" }]);
    bindings.getCampaignMetricTotals.mockResolvedValue({ ga4FinancialSource: "persisted_overview", nativeDataThroughDate: "2026-10-16", revenueAvailable: true, spendAvailable: true,
      revenue: 142.35, ga4Revenue: 100.01, spend: 20, financialConversions: 5, sessions: 30, users: 25, usersAvailable: true });
    const daily = await storage.getGA4DailyMetrics();
    storage.getGA4DailyMetrics.mockResolvedValue(daily.map((row: any) => ({ ...row, updatedAt: "2026-10-16T18:00:00Z" })));
    storage.upsertExecutiveSummaryDailySnapshot = vi.fn().mockResolvedValue({ id: "snapshot" });
    storage.getGA4PublicationVersion = vi.fn().mockResolvedValue(null);
    Object.assign(bindings, { buildExecutiveSummaryDailySnapshotInput, buildExecutiveSummaryFinancialSourceIdentity, hasRefreshedGA4RowsForExecutiveSummarySnapshot,
      isInternalAutoRefreshRequest: () => capture, getInternalGA4RefreshWriteInput: () => ({ publicationVersion: { campaignId: campaign.id, version: null } }) });
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(capture ? { captureExecutiveSnapshot: "1", executiveFinancialScope: "campaign_to_date" } : {}), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.financials).toMatchObject({ totalRevenue: 142.35, spend: 20, conversions: 5 });
    expect(res.body.performanceSummary.currentValueWindow).toMatchObject({ endDate: "2026-10-17", nativeDataThroughDate: "2026-10-16" });
    if (capture) expect(storage.upsertExecutiveSummaryDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({ reportingDate: "2026-10-17", totals: expect.objectContaining({ revenue: expect.objectContaining({ value: 142.35 }), users: expect.objectContaining({ value: 25 }) }) }));
    for (const mock of Object.values(provider)) expect(mock).not.toHaveBeenCalled();
  });

  it("keeps diagnostic totals and provenance on the published values", async () => {
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.performanceSummary.totals.revenue).toMatchObject({ available: true, value: 130.01 });
    expect(res.body.financials).toMatchObject({ totalRevenue: 130.01, spend: 20, conversions: 5, cpa: 4 });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled(); expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it("retains the published diagnostic cutoff across local midnight without relabeling or fetching", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z")); // October 18, 00:30 Amsterdam; October 17 is not published yet.
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.performanceSummary.currentValueWindow).toMatchObject({ startDate: "2026-10-15", endDate: "2026-10-16", dataThroughDate: "2026-10-16" });
    expect(res.body.financials).toMatchObject({ totalRevenue: 130.01, spend: 20, profit: 110.01, conversions: 5, cpa: 4 });
    expect(bindings.getCampaignMetricTotals).toHaveBeenCalledWith(campaign.id, true, true, "2026-10-16");
    expect(storage.getRevenueTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-10-16", "ga4");
    expect(storage.getSpendTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-10-16", "ga4");
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled(); expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
  it("does not use the prior publication for an internal refresh writer", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    bindings.isInternalAutoRefreshRequest = () => true;
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code).toBe(503);
    expect(bindings.getCampaignMetricTotals).toHaveBeenCalledWith(campaign.id, true, true, "2026-10-17");
  });
  it("does not rewrite an older Executive Summary snapshot while displaying the prior publication", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    storage.getGA4PublicationVersion = vi.fn().mockResolvedValue(null);
    storage.upsertExecutiveSummaryDailySnapshot = vi.fn();
    bindings.hasRefreshedGA4RowsForExecutiveSummarySnapshot = () => true;
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req({ captureExecutiveSnapshot: "1", executiveFinancialScope: "campaign_to_date" }), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(storage.upsertExecutiveSummaryDailySnapshot).not.toHaveBeenCalled();
  });
  it("advances the read cutoff when the new native and financial publication are complete", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    const native = overview(), financial = published();
    native.windowEnd = "2026-10-17"; financial.reportingDate = "2026-10-17";
    financial.metrics.financialDaily.currentValueWindow.endDate = "2026-10-17";
    financial.metrics.financialDaily.currentValueWindow.dataThroughDate = "2026-10-17";
    storage.getGA4OverviewSnapshot.mockResolvedValue(native); storage.getLatestFinancialDailySnapshot.mockResolvedValue(financial);
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    expect(res.body.performanceSummary.currentValueWindow.dataThroughDate).toBe("2026-10-17");
  });
  it.each(["missing publication", "changed spend", "wrong publication campaign", "currency", "timezone", "different native cutoff"])("still withholds incompatible overnight financial inputs: %s", async (kind) => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    const financial = published();
    if (kind === "missing publication") storage.getLatestFinancialDailySnapshot.mockResolvedValue(null);
    if (kind === "changed spend") storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 21, currency: "EUR", sourceIds: ["s"] });
    if (kind === "wrong publication campaign") { financial.campaignId = "other"; storage.getLatestFinancialDailySnapshot.mockResolvedValue(financial); }
    if (kind === "currency") { financial.metrics.financialDaily.currency = "USD"; storage.getLatestFinancialDailySnapshot.mockResolvedValue(financial); }
    if (kind === "timezone") { financial.metrics.financialDaily.currentValueWindow.reportingTimeZone = "UTC"; storage.getLatestFinancialDailySnapshot.mockResolvedValue(financial); }
    if (kind === "different native cutoff") { const native = overview(); native.windowEnd = "2026-10-17"; storage.getGA4OverviewSnapshot.mockResolvedValue(native); }
    const res = response(); await route("/api/campaigns/:id/outcome-totals", bindings)(req(), res);
    expect(res.code, JSON.stringify(res.body)).toBe(503); expect(res.body.performanceSummary).toBeUndefined();
  });
  it("reads Executive trajectory for the displayed prior publication without fabricating missing history", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    storage.getExecutiveSummaryDailyComparisonData = vi.fn().mockResolvedValue({ current: null, previous: null });
    bindings.evaluateExecutiveSummaryTrajectory = evaluateExecutiveSummaryTrajectory;
    const res = response(); await route("/api/campaigns/:id/executive-summary/trajectory", bindings)({ ...req({ reportingDate: "2026-10-16" }), _campaign: campaign }, res);
    expect(res.code).toBe(200); expect(res.body.available).toBe(false);
    expect(storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith(campaign.id, "2026-10-16", "2026-10-09");
  });
  it("uses the same dated revenue evidence in the UI response without exposing source records", async () => {
    const snapshots = { current: { id: "current" }, previous: { id: "previous" }, revenueHistory: { publicationMatches: true, records: ["private inputs"] } };
    storage.getExecutiveSummaryDailyComparisonData = vi.fn().mockResolvedValue(snapshots);
    bindings.evaluateExecutiveSummaryTrajectory = vi.fn().mockReturnValue({ available: true, trajectory: "accelerating", trendPercentage: 19.1862, reason: null, source: "dated_revenue_history" });
    const res = response(); await route("/api/campaigns/:id/executive-summary/trajectory", bindings)({ ...req({ reportingDate: "2026-10-16" }), _campaign: campaign }, res);
    expect(res.code).toBe(200);
    expect(bindings.evaluateExecutiveSummaryTrajectory).toHaveBeenCalledWith(snapshots.current, snapshots.previous, snapshots.revenueHistory);
    expect(res.body).toMatchObject({ available: true, trendPercentage: 19.1862, source: "dated_revenue_history" });
    expect(res.body.revenueHistory).toBeUndefined();
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
  it.each(["2026-10-15", "2026-10-18", "invalid"])("rejects a trajectory date outside the current or last published cutoff: %s", async (reportingDate) => {
    vi.setSystemTime(new Date("2026-10-17T22:30:00Z"));
    storage.getExecutiveSummaryDailyComparisonData = vi.fn();
    const res = response(); await route("/api/campaigns/:id/executive-summary/trajectory", bindings)({ ...req({ reportingDate }), _campaign: campaign }, res);
    expect(res.code).toBe(400); expect(storage.getExecutiveSummaryDailyComparisonData).not.toHaveBeenCalled();
  });
  it.each([undefined, "0", "1"])("keeps native-only GA4 diagnostics on saved figures with persistedOnly=%s", async (persistedOnly) => {
    const saved = published();
    saved.metrics.financialDaily.inputs.revenue = { available: true, value: "100.01", sources: ["ga4"] };
    saved.metrics.financialDaily.inputs.spend = { available: false, value: null, sources: [] } as any;
    storage.getLatestFinancialDailySnapshot.mockResolvedValue(saved);
    storage.getRevenueSources.mockResolvedValue([]); storage.getSpendSources.mockResolvedValue([]);
    storage.getRevenueBreakdownBySource.mockResolvedValue([]); storage.getSpendBreakdownBySource.mockResolvedValue([]);
    storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: "EUR", sourceIds: [] });
    storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, currency: "EUR", sourceIds: [] });
    bindings.getCampaignMetricTotals.mockResolvedValue({ ga4FinancialSource: "persisted_overview", revenueAvailable: true, spendAvailable: true,
      revenue: 100.01, ga4Revenue: 100.01, spend: 0, financialConversions: 5, sessions: 30, users: 25 });
    const res = response();
    await route("/api/campaigns/:id/outcome-totals", bindings)(req(persistedOnly === undefined ? {} : { persistedOnly }), res);
    expect(res.code, JSON.stringify(res.body)).toBe(200);
    const totals = res.body.performanceSummary.totals;
    expect(totals.revenue).toMatchObject({ available: true, value: 100.01 });
    expect(totals.sessions.value).toBe(30); expect(totals.conversions.value).toBe(5);
    expect(totals.spend).toMatchObject({ available: false, sources: [] });
    for (const metric of ["roas", "roi", "cpa"]) expect(totals[metric]).toMatchObject({ available: false, value: null });
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
