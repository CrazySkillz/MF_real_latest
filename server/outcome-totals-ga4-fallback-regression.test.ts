import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("outcome-totals GA4 persisted fallback regression guard", () => {
  it("falls back to stored GA4 daily users, sessions, conversions, and revenue when live GA4 is unavailable", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const rows = await storage.getGA4DailyMetrics(campaignId, persistedPropertyId, startDate, endDate);");
    expect(route).toContain("users: totals.users + parseNum(row?.users)");
    expect(route).toContain("sessions: totals.sessions + parseNum(row?.sessions)");
    expect(route).toContain("conversions: totals.conversions + parseNum(row?.conversions)");
    expect(route).toContain("revenue: totals.revenue + parseNum(row?.revenue)");
    expect(route).toContain('if (usedPersistedGA4) ga4Totals.fallbackSource = "ga4_daily_metrics";');
  });

  it("keeps outcome-totals aligned with system-generated GA4 test data, stored daily overlays, and spend-to-date", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("isYesopMockProperty(primaryPropertyId)");
    expect(route).toContain("simulateGA4({");
    expect(route).toContain("isSimulated: true");
    expect(route).toContain("isYesopMockProperty(persistedPropertyId)");
    expect(route).toContain("ga4Totals.sessions = Math.round(parseNum(ga4Totals.sessions) + persistedGA4.sessions);");
    expect(route).toContain("ga4Totals.conversions = Math.round(parseNum(ga4Totals.conversions) + persistedGA4.conversions);");
    expect(route).toContain('ga4Totals.mergedSource = "ga4_daily_metrics";');
    expect(route).toContain('const spendStartDate = "1900-01-01";');
    expect(route).toContain("Budget pacing dates are campaign metadata and must not narrow imported spend provenance.");
    expect(route).toContain("const spendBreakdown = await storage.getSpendBreakdownBySource(campaignId, spendStartDate, spendEndDate);");
    expect(route).toContain("let financialSpendInputs: any[] = [];");
    expect(route).toContain("financialSpendInputs = spendBreakdown");
    expect(route).toContain("performanceSummarySpendTotals");
    expect(route).toContain("unifiedSpend: performanceSummarySpend > 0 ? performanceSummarySpend : unifiedSpend");
    expect(route).toContain("const revenueBreakdown = await storage.getRevenueBreakdownBySource(campaignId, revenueStartDate, revenueEndDate, \"ga4\");");
    expect(route).toContain('const revenueStartDate = "1900-01-01";');
    expect(route).toContain("Budget pacing dates are campaign metadata and must not narrow imported revenue provenance.");
    expect(route).toContain("let financialRevenueInputs: any[] = [];");
    expect(route).toContain("financialRevenueInputs = revenueBreakdown");
    expect(route).toContain("importedRevenueToDateTotal");
    expect(route).toContain("let offsiteRevenueTotal = importedRevenueToDateTotal;");
    expect(route).toContain("const totalRevenueUnified = parseFloat((onsiteRevenue + offsiteRevenueTotal).toFixed(2));");
    expect(route).toContain('id: "ga4_native_revenue"');
    expect(route).toContain('label: "GA4 Revenue"');
    expect(route).toContain('sourceType: "Native GA4 revenue"');
    expect(route).toContain("financialInputs,");
  });

  it("refreshes system-generated yesop GA4 test data without requiring a live OAuth token", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.post("/api/campaigns/:id/ga4/refresh"');
    const routeEnd = routes.indexOf('app.post("/api/campaigns/:id/linkedin-daily/mock"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const simulated = isYesopMockProperty(String(primaryConn.propertyId || \"\"));");
    expect(route).toContain("simulated");
    expect(route).toContain("simulateGA4({");
    expect(route).toContain('dateRange: "7days"');
    expect(route).toContain("ga4Service.getMetricsWithAutoRefresh");
    expect(route).toContain("isSimulated: simulated");
  });

  it("keeps ga4-daily backfill revenue in native GA4 daily metrics instead of synthetic imported revenue records", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("await storage.upsertGA4DailyMetrics(upserts as any);");
    expect(route).not.toContain("storage.createRevenueRecords");
    expect(route).not.toContain("revenueSourceId: 'ga4_daily_metrics'");
    expect(route).not.toContain('revenueSourceId: "ga4_daily_metrics"');
  });

  it("derives engagedSessions in the ga4-daily response from stored sessions and engagementRate", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const addDerivedEngagedSessions = (row: any) =>");
    expect(route).toContain("const rate = rawRate > 1 ? rawRate / 100 : rawRate;");
    expect(route).toContain("Math.round(sessions * rate)");
    expect(route).toContain("data: stored.map(addDerivedEngagedSessions)");
  });

  it("aligns outcome-totals performanceSummary financial GA4 values with GA4 Overview to-date totals", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const financialGa4Totals = { ...ga4Totals };");
    expect(route).toContain("const financialWebAnalytics = { ...webAnalytics };");
    expect(route).toContain("ga4Service.getTotalsWithRevenue(");
    expect(route).toContain('financialGa4Totals.toDateSource = "ga4_to_date";');
    expect(route).toContain("const onsiteRevenue = parseNum(financialWebAnalytics.revenue);");
    expect(route).toContain("ga4: financialGa4Totals,");
    expect(route).toContain("webAnalytics: financialWebAnalytics,");
    expect(route).toContain("ga4: ga4Totals,");
  });
});
