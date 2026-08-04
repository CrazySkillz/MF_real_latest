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

  it("exposes stable non-visual selectors for every live Insights surface", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");
    for (const testId of [
      "insights-executive-financials", "insights-financial-spend", "insights-financial-revenue",
      "insights-financial-profit", "insights-financial-roas", "insights-financial-roi",
      "insights-financial-sources", "insights-trends", "insights-data-summary",
      "insights-summary-sessions", "insights-summary-conversions", "insights-summary-revenue",
      "insights-summary-top-channel", "insights-summary-spend", "insights-summary-profit",
      "insights-summary-roas", "insights-summary-cpa", "insights-summary-channel-row",
      "insights-trackers", "insights-tracker-total", "insights-tracker-high",
      "insights-tracker-medium", "insights-findings", "insights-finding", "insights-hidden-count",
    ]) {
      expect(page).toContain(`data-testid="${testId}"`);
    }
    for (const attribute of [
      "data-insight-id", "data-category", "data-severity", "data-title",
      "data-description", "data-recommendation", "data-basis", "data-confidence",
    ]) {
      expect(page).toContain(attribute);
    }
  });

  it("compares every rendered surface after the page's exact 60-day response is stable", () => {
    const validator = read("scripts", "ga4-insights-live-readonly.ts");

    expect(validator).toContain("const pageInputPromises = Object.entries(paths)");
    expect(validator).toContain('actual.searchParams.get("days") === "60"');
    expect(validator).toContain("const pageInputEntries = await Promise.all(pageInputPromises)");
    expect(validator).toContain("responses[name] = { ok: true, status: response.status(), body: await response.json() }");
    expect(validator).toContain("const analyticsResponsePromises = analyticsPaths.map");
    expect(validator).toContain("getByText(\"Exact completed-day window\", { exact: true }).waitFor");
    expect(validator).toContain("buildGA4InsightsRollups(uiDailyBody?.data, uiDailyBody?.dataThroughDate)");
    expect(validator).toContain('cardText("insights-financial-sources")');
    expect(validator).toContain('source?.displayName || revenueTypeLabel(source?.sourceType)');
    expect(validator).toContain('cardText("insights-summary-sessions")');
    expect(validator).toContain('getByTestId("insights-summary-channel-row")');
    const channelCellsStart = validator.indexOf("const expectedCells = [", validator.indexOf("const channelRows"));
    const channelCellsEnd = validator.indexOf("];", channelCellsStart);
    const channelCells = validator.slice(channelCellsStart, channelCellsEnd);
    expect(channelCells).toContain("formatNumber(expected.conversions)");
    expect(channelCells).toContain("formatPct(expected.sessions > 0");
    expect(channelCells).not.toContain("formatMoney(expected.revenue");
    expect(validator).toContain('validateRollingMode("7d", 7)');
    expect(validator).toContain('validateRollingMode("30d", 30)');
    expect(validator).toContain('getByRole("button", { name: "Monthly", exact: true }).click()');
    expect(validator).toContain('getByTestId("insights-trackers")');
    expect(validator).toContain('getByTestId("insights-finding")');
    expect(validator).toContain('finding.id.endsWith(":wow")');
    expect(validator).toContain('finding.id.endsWith(":3d")');
    expect(validator).toContain("liveSurfaceParity");
    for (const path of ["revenueSources", "revenueBreakdown", "spendSources", "spendBreakdown"]) {
      expect(validator).toContain(path + ":");
    }
    expect(validator).toContain("clerkGet(\"/users?limit=100&order_by=-created_at\")");
    expect(validator).toContain("String(candidate?.id || \"\") !== String(row.owner_id)");
    expect(validator).toContain("allowMissing && tokenResponse.status === 404");
    expect(validator).toContain("GA4_INSIGHTS_REQUIRE_TENANT_ISOLATION");
    expect(validator).toContain("tenantIsolation = \"not run; no second production identity was authorized\"");
    expect(validator).toContain("GA4_INSIGHTS_ALLOW_TEMPORARY_USER");
    expect(validator).toContain("temporary GA4 Insights tenant-isolation certification");
    expect(validator).toContain("temporary user deletion failed");
    expect(validator).toContain("temporary user still resolves");
    expect(validator).toContain("if (deletedLookup?.status !== 404)");
    expect(validator).toContain('"not applicable; tenant isolation skipped"');
    expect(validator).toContain("console.log(JSON.stringify(output, null, 2))");
  });
});
