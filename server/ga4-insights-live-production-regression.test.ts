import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("live GA4 Insights production boundary", () => {
  it("uses an isolated, property-verified 60-day daily-history request", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(page).toContain("const GA4_INSIGHTS_DAILY_LOOKBACK_DAYS = 60;");
    expect(page).toContain('"ga4-insights-daily", GA4_INSIGHTS_DAILY_LOOKBACK_DAYS, selectedGA4PropertyId');
    expect(page).toContain('activeTab === "insights"');
    expect(page).toContain('String(data?.propertyId || "") !== String(selectedGA4PropertyId)');
    expect(page).toContain('const insightsRollupRows = activeTab === "insights" ? ga4InsightsTimeSeries : ga4TimeSeries');
    expect(page).toContain("buildGA4InsightsRollups(insightsRollupRows, insightsRollupCutoff)");
    expect(page).not.toContain('queryKey: ["/api/campaigns", campaignId, "ga4-insights-daily", GA4_DAILY_LOOKBACK_DAYS');
  });

  it("withholds failed or stale history instead of emitting recommendations from it", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(page).toContain('id: "integrity:daily_history_unavailable"');
    expect(page).toContain('id: "integrity:daily_history_stale"');
    expect(page).toContain("!trendsRefreshIsStale && insightsRollups.last7.complete && insightsRollups.prior7.complete");
    expect(page).toContain('id: "integrity:analytics_history_unavailable"');
    expect(page).toContain("if (!resp.ok) throw new Error(json?.message || json?.error || \"Failed to fetch KPI analytics history\")");
  });

  it("renders raw channel rows without proportional allocation", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");
    const start = page.indexOf('<CardTitle className="text-lg">Data Summary</CardTitle>');
    const end = page.indexOf("</CardContent>", start);
    const section = page.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(section).toContain("formatNumber(ch.sessions)");
    expect(section).toContain("formatNumber(ch.conversions)");
    expect(section).toContain("ch.sessions / channelAnalysis.totalSessions");
    expect(section).not.toContain("sessScale");
    expect(section).not.toContain("convScaleFactor");
    expect(section).not.toContain("scaledSessions");
  });

  it("keeps valid-zero, unavailable, not-connected, and last-good financial states distinct", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");
    const start = page.indexOf('<CardTitle className="text-lg">Executive Financials</CardTitle>');
    const end = page.indexOf("{/* Trends card", start);
    const section = page.slice(start, end);

    expect(section).toContain("renderFinancialValue(financialSpendLoading, financialSpendAvailable");
    expect(section).toContain('spendMetricAvailable ? "Unavailable" : "Not connected"');
    expect(section).toContain('revenueMetricAvailable ? "Unavailable" : "Not connected"');
    expect(section).toContain("Showing last-good financial values");
    expect(section).toContain('financialSpendAvailable && financialSpend <= 0 ? "—" : "Unavailable"');
  });

  it("binds daily, breakdown, and to-date values to campaign access and completed reporting days", () => {
    const routes = read("server", "routes-oauth.ts");
    const dailyStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily"');
    const dailyEnd = routes.indexOf('// GA4 to-date totals', dailyStart);
    const daily = routes.slice(dailyStart, dailyEnd);
    const toDateStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"');
    const toDateEnd = routes.indexOf('// Benchmark-read-only GA4 input validation', toDateStart);
    const toDate = routes.slice(toDateStart, toDateEnd);
    const breakdownStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-breakdown"');
    const breakdown = routes.slice(breakdownStart, routes.indexOf("app.get(", breakdownStart + 20));

    for (const route of [daily, toDate, breakdown]) {
      expect(route).toContain("ensureCampaignAccess");
    }
    expect(daily).toContain("getReportingDateWindow(days, (campaign as any)?.reportingTimeZone)");
    expect(toDate).toContain("getReportingDateWindow(");
    expect(toDate).toContain("(campaign as any)?.reportingTimeZone");
    expect(breakdown).toContain("getReportingDateWindow(dateRangeToDays(dateRange), (campaign as any)?.reportingTimeZone)");
    expect(breakdown).toContain("campaignFilter");
    expect(breakdown).toContain("providerEndDate");
  });
});
