import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8").replace(/\r\n?/g, "\n");

describe("live GA4 Insights production boundary", () => {
  it("uses an isolated, property-verified 60-day daily-history request", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(page).toContain("const GA4_INSIGHTS_DAILY_LOOKBACK_DAYS = 60;");
    expect(page).toContain('"ga4-insights-daily", GA4_INSIGHTS_DAILY_LOOKBACK_DAYS, selectedGA4PropertyId');
    expect(page).toContain('new URLSearchParams(search).get("readOnly") === "1"');
    expect(page).toContain('insightsValidationReadOnly ? "&readOnly=1" : ""');
    expect(page.match(/insightsValidationReadOnly \? "&readOnly=1" : ""/g)?.length).toBe(4);
    expect(page).toContain('"ga4-breakdown", dateRange, selectedGA4PropertyId, insightsValidationReadOnly');
    expect(page).toContain('selectedGA4PropertyId, insightsValidationReadOnly]');
    expect(page).toContain('["/api/ga4/check-connection", campaignId, insightsValidationReadOnly]');
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

  it("reports exact rolling-window coverage instead of calling scattered rows complete days", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(page).toContain("Both adjacent calendar windows must contain every completed reporting day.");
    expect(page).toContain("{rollingWindow.current.days}/{rollingWindow.current.expectedDays} imported days");
    expect(page).toContain("{rollingWindow.prior.days}/{rollingWindow.prior.expectedDays} imported days");
    expect(page).toContain("Total imported rows in the 60-day response: {dailyRows.length}.");
    expect(page).toContain("Missing dates are not assumed to be zero.");
    expect(page).not.toContain("`${dailyRows.length} complete ${trendsReportingTimeZoneLabel} day");
    expect(page).not.toContain("completed GA4 day${availableDays");
    expect(page).not.toContain("Full 7-day week-over-week analysis will activate after");
    expect(page).not.toContain("Full 7-day vs prior 7-day anomaly checks start after");
    expect(page).not.toContain("Need at least {insightsTrendMode === \"7d\" ? 14 : 60} days of history");
    expect(page).not.toContain("Number(insightsRollups?.availableDays || 0) < minDays");
    expect(page).toContain("Current 7-day window ${insightsRollups.last7.startDate}");
    expect(page).toContain("Current 3-day window ${insightsRollups.last3.startDate}");
    expect(page).toContain("const finalDate = String(trendsDataThroughDate || sorted[sorted.length - 1]?.date || \"\");");
    expect(page).toContain("addGA4InsightsDateDays(finalDate, -29)");
    expect(page).not.toContain("const dailyChartRows = sorted.slice(-30);");
    expect(page).toContain('data-testid="insights-daily-chart-coverage"');
    expect(page).toContain('data-testid="insights-trend-metric"');
    expect(page).toContain("Missing dates are shown as gaps, not zero.");
    expect(page).toContain("value: row ? (isRate");
    expect(page).toContain(": null,");
    expect(page).toContain("connectNulls={false}");
  });

  it("does not reuse prior-property or stale channel data for recommendations", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(page).toContain("}, [ga4Breakdown, breakdownPlaceholder]);");
    expect(page).toContain("const recommendationChannelAnalysis = breakdownError ? null : channelAnalysis;");
    expect(page).toContain("const ch = recommendationChannelAnalysis;");
    expect(page).toContain("if (recommendationChannelAnalysis && recommendationChannelAnalysis.topSessionChannel");
    expect(page).toContain("Showing last-good channel values; channel-based recommendations are withheld until refresh succeeds.");
  });

  it("recomputes financial integrity findings when source availability changes", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");
    const findingsStart = page.indexOf("const insights = useMemo<InsightItem[]>(() => {");
    const findingsEnd = page.indexOf("const insightsActionDescription", findingsStart);
    const findings = page.slice(findingsStart, findingsEnd);

    for (const dependency of [
      "ga4ToDateError",
      "ga4HasRevenueMetric",
      "spendMetricAvailable",
      "revenueMetricAvailable",
    ]) {
      expect(findings).toContain(dependency);
      expect(findings.slice(findings.lastIndexOf("}, ["))).toContain(dependency);
    }
    expect(findings).toContain('revenueKpiInputState === "ready" && ga4HasRevenueMetric && Number(importedRevenueForFinancials || 0) > 0');
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
    expect(section).toContain('spendKpiInputState === "ready" && !spendMetricAvailable ? "Not connected" : "Unavailable"');
    expect(section).toContain('revenueKpiInputState === "ready" && !revenueMetricAvailable ? "Not connected" : "Unavailable"');
    expect(section).toContain("Showing last-good financial values");
    expect(page).toContain("Showing last-good Data Summary financial values because one or more source refreshes failed.");
    expect(page).toContain('const financialRevenueAvailable = activeTab === "insights"');
    expect(page).toContain("? ga4ToDateResp !== undefined && importedRevenueAvailable && revenueMetricAvailable");
    expect(page).toContain(": ga4FinancialNativeAvailable && importedRevenueAvailable && revenueMetricAvailable;");
    expect(page).toContain('if (ga4ToDateError) return "unavailable";');
    expect(page).toContain('id: ga4ToDateResp === undefined ? "financial:ga4_to_date_unavailable" : "financial:ga4_to_date_stale"');
    expect(page).toContain('title: ga4ToDateResp === undefined ? "GA4 lifetime totals are unavailable" : "GA4 lifetime totals are stale"');
    expect(page).toContain("{ga4ToDateResp !== undefined && (");
    expect(page).toContain('if (spendKpiInputState === "ready" && revenueKpiInputState === "ready" && spendMetricAvailable && !revenueMetricAvailable)');
    expect(page).toContain('if (revenueKpiInputState === "ready" && spendKpiInputState === "ready" && revenueMetricAvailable && !spendMetricAvailable)');
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
    expect(daily).toContain("campaignFilter,\n          endDate,");
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
      "insights-trends-chart",
      "insights-summary-sessions", "insights-summary-conversions", "insights-summary-revenue",
      "insights-summary-top-channel", "insights-summary-spend", "insights-summary-profit",
      "insights-summary-roas", "insights-summary-cpa", "insights-summary-channel-row",
      "insights-trackers", "insights-tracker-total", "insights-tracker-high",
      "insights-tracker-medium", "insights-findings", "insights-finding", "insights-hidden-count",
      "insights-scope-context", "insights-scope-client", "insights-scope-campaign", "insights-scope-property", "insights-scope-filter",
    ]) {
      expect(page).toContain(`data-testid="${testId}"`);
    }
    for (const attribute of [
      "data-insight-id", "data-category", "data-severity", "data-title",
      "data-description", "data-recommendation", "data-basis", "data-confidence", "data-findings",
    ]) {
      expect(page).toContain(attribute);
    }
  });

  it("does not present a pre-property OAuth placeholder as a usable connection", () => {
    const page = read("client", "src", "pages", "ga4-metrics.tsx");
    expect(page).toContain('const ga4ConnectionUsable = !!ga4Connection?.connected && availableGA4Properties.length > 0');
    expect(page).toContain('{ga4ConnectionUsable ? "Connected" : "Not connected"}');
    expect(page).not.toContain("||\n    1;\n\n  const rateToPercent");
  });

  it("compares every rendered surface after the page's exact 60-day response is stable", () => {
    const validator = read("scripts", "ga4-insights-live-readonly.ts");

    expect(validator).toContain("const pageInputPromises = Object.entries(paths)");
    expect(validator).toContain("for (const [key, value] of expected.searchParams)");
    expect(validator).toContain("campaign: `/api/campaigns/${CAMPAIGN_ID}`");
    expect(validator).toContain('clients: "/api/clients"');
    expect(validator).toContain("Campaign response saved-filter parity failed");
    expect(validator).toContain('request(owner.page, "/api/auth/google/url", "POST"');
    expect(validator).toContain('request(owner.page, "/api/auth/google-sheets/connect", "POST"');
    expect(validator).not.toContain('request(owner.page, "/api/auth/google-ads/connect", "POST"');
    expect(validator).toContain("ga4OAuthConfig.body?.oauth_url");
    expect(validator).not.toContain("ga4OAuthConfig.body?.oauthUrl");
    expect(validator).toContain('throw new Error("Production OAuth state is not signed")');
    expect(validator).toContain("oauthConfiguration: { ga4SignedState: true, sheetsSignedState: true, googleClientConfigured: true }");
    expect(validator).toContain("ga4-breakdown?dateRange=30days");
    expect(validator).toContain("ga4-breakdown?dateRange=30days");
    expect(validator).not.toContain("&debug=1&readOnly=1");
    expect(validator).toContain("ga4-to-date?propertyId=");
    expect(validator).toContain('if (responses[name]?.body?.validationReadOnly !== true)');
    expect(validator).toContain("connectionStatus:");
    expect(validator).toContain("overviewDaily:");
    expect(validator).toContain('actual.searchParams.get("days") === "30"');
    expect(validator).toContain('actual.searchParams.get("days") === "60"');
    expect(validator).toContain("overviewDailyWindow:");
    expect(validator).toContain("const pageInputEntries = await Promise.all(pageInputPromises)");
    expect(validator).toContain("responses[name] = { ok: true, status: response.status(), body: await response.json() }");
    expect(validator).toContain('response.body?.error || response.body?.message || "no API reason returned"');
    expect(validator).toContain(".slice(0, 300)");
    expect(validator).toContain("const analyticsResponsePromises = analyticsRequests.map");
    expect(validator).toContain('actual.searchParams.get("ga4Scope") === "1"');
    expect(validator).toContain("buildGA4InsightsHistoryScopeMarker(propertyId, filters");
    expect(validator).toContain("analytics history escaped the selected property/filter/timezone/currency scope");
    expect(validator).toContain('getByTestId("insights-summary-sessions").waitFor');
    expect(validator).toContain('cardText("insights-scope-client")');
    expect(validator).toContain('getByTestId("ga4-overview-freshness-warning")');
    expect(validator).toContain("buildGA4InsightsRollups(uiDailyBody?.data, uiDailyBody?.dataThroughDate)");
    expect(validator).toContain('cardText("insights-financial-sources")');
    expect(validator).toContain('source?.displayName || revenueTypeLabel(source?.sourceType)');
    expect(validator).toContain("const importedRevenueSourceIds = new Set(");
    expect(validator).toContain("revenueDisplaySources.filter((source: any) => importedRevenueSourceIds.has");
    expect(validator).toContain('cardText("insights-summary-sessions")');
    expect(validator).toContain('"summary traffic completeness"');
    expect(validator).toContain('getByTestId("insights-summary-channel-row")');
    const channelCellsStart = validator.indexOf("const expectedCells = [", validator.indexOf("const channelRows"));
    const channelCellsEnd = validator.indexOf("];", channelCellsStart);
    const channelCells = validator.slice(channelCellsStart, channelCellsEnd);
    expect(channelCells).toContain("formatNumber(expected.conversions)");
    expect(channelCells).toContain("formatPct(expected.sessions > 0");
    expect(channelCells).not.toContain("formatMoney(expected.revenue");
    expect(validator).toContain('validateRollingMode("7d", 7)');
    expect(validator).toContain('validateRollingMode("30d", 30)');
    expect(validator).toContain('getByTestId("insights-trends-chart").getAttribute("data-chart-series")');
    expect(validator).toContain('await assertChartSeries(expectedChart, "Daily")');
    expect(validator).toContain('getByTestId("insights-daily-chart-coverage")');
    expect(validator).toContain("for (const metric of allTrendMetrics)");
    expect(validator).toContain("for (const metric of nonUserTrendMetrics)");
    expect(validator).toContain('chooseTrendMetric(metric.label)');
    expect(validator).toContain('formatMoney(value, currency)');
    expect(validator).toContain('await assertChartSeries(expectedChart, mode)');
    expect(validator).toContain('}), "Monthly")');
    expect(validator).toContain('current.days + "/" + current.expectedDays + " imported days"');
    expect(validator).toContain('prior.days + "/" + prior.expectedDays + " imported days"');
    expect(validator).toContain('"Missing dates are not assumed to be zero."');
    expect(validator).toContain('getByRole("button", { name: "Monthly", exact: true }).click()');
    expect(validator).toContain('getByTestId("insights-trackers")');
    expect(validator).toContain('tracker.getAttribute("data-findings")');
    expect(validator).toContain("Complete finding inventory does not match the tracker");
    expect(validator).toContain('const findingCategoryOrder = ["setup", "targets", "trends", "finance", "context"]');
    expect(validator).toContain("Visible grouped findings do not match the first twelve generated findings");
    expect(validator).toContain('getByTestId("insights-finding")');
    expect(validator).toContain('finding.id.endsWith(":wow")');
    expect(validator).toContain('finding.id.endsWith(":3d")');
    expect(validator).toContain("A KPI integrity finding does not map to the scoped KPI response");
    expect(validator).toContain("A Benchmark integrity finding does not map to the scoped Benchmark response");
    expect(validator).toContain("liveSurfaceParity");
    expect(validator).toContain("financialReconciliation:");
    expect(validator).toContain("dailyFreshness:");
    expect(validator).toContain("totalRevenue: Number(financialRevenue.toFixed(2))");
    expect(validator).not.toContain('getByRole("tab", { name: "Overview"');
    expect(validator).not.toContain('getByTestId("ga4-add-spend-source")');
    expect(validator).not.toContain("Choose where your spend data comes from.");
    expect(validator).not.toContain("spendChooser:");
    expect(validator).toContain("&readOnly=1");
    expect(validator).toContain("ga4-metrics?tab=insights&readOnly=1");
    expect(validator).toContain("uiDailyBody?.providerRefreshAttempted !== false");
    expect(validator).toContain("uiOverviewDailyBody?.providerRefreshAttempted !== false");
    expect(validator).toContain("readPersistenceFingerprint");
    expect(validator).toContain("changedPersistenceComponents = Object.keys(persistenceFingerprintBefore)");
    expect(validator).toContain("Read-only certification observed changed campaign-scoped persistence:");
    expect(validator).toContain("persistenceUnchanged: true");
    expect(validator).not.toContain("decryptTokens");
    expect(validator).toContain("responseTimeZone !== expected60.reportingTimeZone");
    expect(validator).toContain("responseCurrency !== currency");
    expect(validator).toContain("Campaign client scope is missing or belongs to another tenant");
    expect(validator).toContain("assertSourceCurrencies(revenueDefinitions, revenueBreakdownSources");
    expect(validator).toContain("assertSourceCurrencies(spendDefinitions, spendBreakdownSources");
    expect(validator).toContain('responses.revenue.body?.startDate !== "1900-01-01"');
    expect(validator).toContain('responses.spend.body?.startDate !== "1900-01-01"');
    expect(validator).toContain('"Windows: " + financialWindowDescription');
    for (const path of ["revenueSources", "revenueBreakdown", "spendSources", "spendBreakdown"]) {
      expect(validator).toContain(path + ":");
    }
    expect(validator).toContain("clerkGet(\"/users?limit=100&order_by=-created_at\")");
    expect(validator).toContain("GA4_INSIGHTS_NONOWNER_USER_ID");
    expect(validator).toContain("String(candidate?.id || \"\") === authorizedNonOwnerUserId");
    expect(validator).not.toContain('users.find((candidate) => String(candidate?.id || "") !== String(row.owner_id))');
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
