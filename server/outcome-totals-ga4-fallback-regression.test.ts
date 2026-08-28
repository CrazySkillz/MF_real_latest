import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("outcome-totals GA4 persisted fallback regression guard", () => {
  it("falls back to stored GA4 daily users, sessions, conversions, and revenue when live GA4 is unavailable", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
   const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
   const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain('case "60days":');
    expect(route).toContain('return "60daysAgo";');
   expect(route).toContain("const rows = await storage.getGA4DailyMetrics(campaignId, persistedPropertyId, startDate, endDate);");
    expect(route).toContain("users: totals.users + parseNum(row?.users)");
    expect(route).toContain("sessions: totals.sessions + parseNum(row?.sessions)");
    expect(route).toContain("conversions: totals.conversions + parseNum(row?.conversions)");
    expect(route).toContain("revenue: totals.revenue + parseNum(row?.revenue)");
    expect(route).toContain('if (usedPersistedGA4) ga4Totals.fallbackSource = "ga4_daily_metrics";');
  });

  it("keeps native financial metrics campaign-to-date without clipping source-to-date financial inputs", () => {
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
    expect(route).toContain("resolveGA4ImportToDateWindow((persistedPrimaryGA4 as any)?.importStartDate");
    expect(route).toContain('mode: "initial_import_to_latest_completed_day" as const');
    expect(route).toContain('const spendStartDate = "1900-01-01";');
    expect(route).toContain('const spendEndDate = currentValueWindow?.endDate || new Date().toISOString().slice(0, 10);');
    expect(route).toContain("Imported spend is source-to-date; the GA4 import boundary applies only to native GA4 metrics.");
    expect(route).toContain('storage.getSpendTotalForRange(campaignId, spendStartDate, spendEndDate, "ga4")');
    expect(route).toContain('storage.getSpendBreakdownBySource(campaignId, spendStartDate, spendEndDate, "ga4")');
    expect(route).toContain("let financialSpendInputs: any[] = [];");
    expect(route).toContain("financialSpendInputs = spendBreakdown");
    expect(route).toContain("performanceSummarySpendTotals");
    expect(route).toContain("const financialSpendForOutcome = currentValueWindow");
    expect(route).toContain("unifiedSpend: financialSpendForOutcome");
    expect(route).toContain('const revenueStartDate = "1900-01-01";');
    expect(route).toContain("Imported revenue is source-to-date; the GA4 import boundary applies only to native GA4 metrics.");
    expect(route).not.toContain('const revenueStartDate = currentValueWindow?.startDate');
    expect(route).toContain('storage.getRevenueTotalForRange(campaignId, revenueStartDate, revenueEndDate, "ga4")');
    expect(route).toContain('storage.getRevenueBreakdownBySource(campaignId, revenueStartDate, revenueEndDate, "ga4")');
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

    expect(route).toContain("await storage.replaceGA4DailyMetricsWindow(");
    expect(route).not.toContain("storage.createRevenueRecords");
    expect(route).not.toContain("revenueSourceId: 'ga4_daily_metrics'");
    expect(route).not.toContain('revenueSourceId: "ga4_daily_metrics"');
  });

  it("reconciles stored GA4 daily rows after an exact repair refetch, including authoritative zeros", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const needsConversionRevenueRepair = (rows: any[]) =>");
    expect(route).toContain("const hasTraffic = list.some");
    expect(route).toContain("const hasConversions = list.some");
    expect(route).toContain("const hasRevenue = list.some");
    expect(route).toContain("return hasTraffic && !hasObservedProviderRevenueShape && (!hasConversions || !hasRevenue);");
    expect(route).toContain("} else if (needsConversionRevenueRepair(stored)) {");
    expect(route).toContain("await storage.replaceGA4DailyMetricsWindow(");
    expect(route).not.toContain("const recoveredConversionRevenue = upserts.some");
  });

  it("derives engagedSessions in the ga4-daily response from stored sessions and engagementRate", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const trafficWindow = readFileSync(join(process.cwd(), "shared", "ga4-traffic-window.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const addDerivedEngagedSessions = addDerivedGA4EngagedSessions;");
    expect(trafficWindow).toContain("const rate = rawRate > 1 ? rawRate / 100 : rawRate;");
    expect(trafficWindow).toContain("Math.round(sessions * rate)");
    expect(route).toContain("data: stored.map(addDerivedEngagedSessions)");
  });

  it("keeps GA4 to-date totals able to supply engagement rate for Overview Summary", () => {
    const analytics = readFileSync(join(process.cwd(), "server", "analytics.ts"), "utf-8");
    const methodStart = analytics.indexOf("async getTotalsWithRevenue(");
    const methodEnd = analytics.indexOf("/**", methodStart + 1);
    const method = analytics.slice(methodStart, methodEnd);

    expect(method).toContain("{ name: 'engagedSessions' }");
    expect(method).toContain("{ name: 'engagementRate' }");
    expect(method).toContain("const engagedSessions = parseInt(String(mv?.[5]?.value || '0'), 10) || 0;");
    expect(method).toContain("const engagementRate = rawEngagementRate || (sessions > 0 ? engagedSessions / sessions : 0);");
  });

  it("aligns outcome-totals performanceSummary financial GA4 values with GA4 Overview to-date totals", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("let ga4TotalsAvailable = !activeGA4;");
    expect(route).toContain("let importedRevenueAvailable = false;");
    expect(route).toContain("let hasImportedRevenueSource = false;");
    expect(route).toContain('const revenueStartDate = "1900-01-01";');
    expect(route).not.toContain("Campaign-to-date revenue source is not fully materialized");
    expect(route).toContain("let financialGa4Totals = { ...ga4Totals, available: currentValueWindow ? false : ga4TotalsAvailable };");
    expect(route).toContain("const financialStartDateUsed = (() => {");
    expect(route).not.toContain("if (!useExecutiveCampaignToDateFinancials) return currentValueWindow.startDate;");
    expect(route).toContain("const raw = (campaign as any)?.startDate || (campaign as any)?.createdAt || null;");
    expect(route).toContain("storage.getGA4DailyMetrics(campaignId, persistedPropertyId, financialStartDateUsed, endDateUsed)");
    expect(route).toContain("storage.getGA4DailyMetrics(campaignId, persistedPropertyId, currentValueWindow.startDate, endDateUsed)");
    expect(route).toContain("financialStartDateUsed,");
    expect(route).toContain('const endDateUsed = currentValueWindow.endDate;');
    expect(route).toContain("latestPersistedFinancialDate === endDateUsed");
    expect(route).toContain("ga4Service.getTotalsWithRevenue(");
    expect(route).toContain("const exactFinancialCandidate = selectGA4FinancialTotalsSource([");
    expect(route).toContain("toDateFinancialCandidate,");
    expect(route).toContain("persistedFinancialCandidate,");
    expect(route).toContain("if (hasImportedRevenueSource && !isGA4FinancialTotalsCandidate(toDateFinancialCandidate))");
    expect(route).toContain("financialWebAnalytics.available = false;");
    expect(route).toContain("financialWebAnalytics.users = parseNum(financialGa4Totals.users);");
    expect(route).not.toContain("parseNum(financialGa4Totals.users) || parseNum(financialWebAnalytics.users)");
    expect(route).toContain("const onsiteRevenue = parseNum(financialWebAnalytics.revenue);");
    expect(route).toContain("ga4: financialGa4Totals,");
    expect(route).toContain("webAnalytics: financialWebAnalytics,");
    expect(route).toContain('const ga4FinancialConversions = webAnalyticsProvider === "ga4" ? {');
    expect(route).toContain("financialConversions: ga4FinancialConversions || undefined,");
    expect(route).toContain('available: (webAnalyticsProvider !== "ga4" || financialWebAnalytics.available) && importedRevenueAvailable,');
    expect(route).toContain("...(currentValueWindow ? { currentValueWindow } : {}),");
    expect(route).toContain("ga4: ga4Totals,");
  });
});
