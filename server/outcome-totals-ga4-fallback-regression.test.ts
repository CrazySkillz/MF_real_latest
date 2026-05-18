import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("outcome-totals GA4 persisted fallback regression guard", () => {
  it("falls back to stored GA4 daily users, sessions, conversions, and revenue when live GA4 is unavailable", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const rows = await storage.getGA4DailyMetrics(campaignId, String(primaryGA4.propertyId), startDate, endDate);");
    expect(route).toContain("users: totals.users + parseNum(row?.users)");
    expect(route).toContain("sessions: totals.sessions + parseNum(row?.sessions)");
    expect(route).toContain("conversions: totals.conversions + parseNum(row?.conversions)");
    expect(route).toContain("revenue: totals.revenue + parseNum(row?.revenue)");
    expect(route).toContain('if (usedPersistedGA4) ga4Totals.fallbackSource = "ga4_daily_metrics";');
  });

  it("keeps outcome-totals aligned with system-generated GA4 test data and spend-to-date", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/outcome-totals"');
    const routeEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("isYesopMockProperty(primaryPropertyId)");
    expect(route).toContain("simulateGA4({");
    expect(route).toContain("isSimulated: true");
    expect(route).toContain("const spendBreakdown = await storage.getSpendBreakdownBySource(campaignId, spendStartDate, spendEndDate);");
    expect(route).toContain("performanceSummarySpendTotals");
    expect(route).toContain("unifiedSpend: performanceSummarySpend > 0 ? performanceSummarySpend : unifiedSpend");
  });
});
