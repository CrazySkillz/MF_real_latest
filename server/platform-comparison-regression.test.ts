import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Platform Comparison regression guard", () => {
  it("uses the shared aggregate contract for connected-source platform rows", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");

    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days"');
    expect(page).toContain('outcome-totals?dateRange=90days');
    expect(page).toContain('fetch(url, { credentials: "include" })');
    expect(page).toContain("isFetched: outcomeTotalsFetched");
    expect(page).toContain("if (!outcomeTotalsFetched && !ot) return [];");
    expect(page).toContain("const performanceSummary = outcomeTotals?.performanceSummary;");
    expect(page).toContain("const aggregateSources = Array.isArray(ot?.performanceSummary?.sources) ? ot.performanceSummary.sources : [];");
    expect(page).toContain('.filter((source: any) => source?.connected === true && source?.category !== "financial")');
    expect(page).toContain("const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String) : [];");
    expect(page).toContain("const sessions = includesMetric(\"sessions\") ? num(metrics.sessions) : 0;");
    expect(page).toContain("const users = includesMetric(\"users\") ? num(metrics.users) : 0;");
    expect(page).toContain('source?.id === "ga4" && num(ot?.revenue?.totalRevenue) > 0');
    expect(page).toContain('source?.id === "ga4" ? "#e37400"');
    expect(page).toContain('source?.id === "google_ads" ? "#34a853"');
  });

  it("does not render child revenue sources as separate platforms when the aggregate is present", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");

    expect(page).toContain("if (performanceSummary) return [];");
    expect(page).toContain("const revenueSourcesData = useMemo(() => {");
    expect(page).toContain("source?.category !== \"financial\"");
  });

  it("renders the Overview tab with web analytics fields for GA4 instead of paid-media zeroes", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="performance"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(overview).toContain("platform.isAnalyticsOnly && (");
    expect(overview).toContain("<span className=\"text-xs text-muted-foreground\">Sessions</span>");
    expect(overview).toContain("<span className=\"text-xs text-muted-foreground\">Users</span>");
    expect(overview).toContain("<span className=\"text-xs text-muted-foreground\">Revenue</span>");
    expect(overview).toContain('className={platform.isAnalyticsOnly ? "hidden" : "flex items-center justify-between"}');
    expect(overview).toContain("No connected platform data available yet. Connect a platform in Connected Platforms to see comparison data.");
    expect(overview).not.toContain("Connect platforms (LinkedIn, Meta) or revenue sources (Shopify, HubSpot, Salesforce)");
  });

  it("renders the Performance Metrics tab with source-capability aware unavailable states", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");
    const performanceStart = page.indexOf('<TabsContent value="performance"');
    const performanceEnd = page.indexOf('<TabsContent value="cost-analysis"', performanceStart);
    const performance = page.slice(performanceStart, performanceEnd);

    expect(page).toContain("const canShowCtr = (platform: any) => hasMetric(platform, \"impressions\") && hasMetric(platform, \"clicks\");");
    expect(page).toContain("const canShowCpc = (platform: any) => hasMetric(platform, \"spend\") && hasMetric(platform, \"clicks\");");
    expect(page).toContain("const canShowFinancialEfficiency = (platform: any) => hasMetric(platform, \"spend\") && (hasMetric(platform, \"revenue\") || hasMetric(platform, \"attributedRevenue\"));");
    expect(performance).toContain("ROAS and ROI require both spend and revenue from this connected source.");
    expect(performance).toContain('hasMetric(platform, "clicks") ? "Clicks" : hasMetric(platform, "sessions") ? "Sessions" : "Engagement"');
    expect(performance).toContain("No connected platform data available yet. Connect a platform in Connected Platforms to see performance metrics.");
    expect(performance).not.toContain("Connect platforms (LinkedIn, Meta) to see performance metrics.");
  });

  it("keeps the GA4 aggregate source aligned with the GA4 platform overview source of truth", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(routes).toContain("let ga4TotalsFromSourceTruth = false;");
    expect(routes).toContain("ga4TotalsFromSourceTruth = true;");
    expect(routes).toContain("!ga4TotalsFromSourceTruth && activeGA4");
    expect(routes).toContain("dailyStart.setUTCDate(dailyStart.getUTCDate() - (dateRangeToDays(dateRange) - 1));");
    expect(routes).toContain("const dbByDate = new Map<string, any>();");
    expect(routes).toContain("const simDates = new Set(simRows.map((row: any) => String(row.date)));");
    expect(routes).toContain("if (!simDates.has(date)) dailyMergedRows.push(dbRow);");
    expect(routes).toContain("const toDateTotals = sumRows([...simRows, ...(Array.isArray(toDateRows) ? toDateRows : [])]);");
    expect(routes).toContain("const dailyTotals = sumRows(dailyMergedRows);");
    expect(routes).toContain("revenue: Math.max(toDateTotals.revenue, dailyTotals.revenue),");
    expect(routes).toContain("conversions: Math.max(toDateTotals.conversions, dailyTotals.conversions),");
    expect(routes).toContain("sessions: Math.max(toDateTotals.sessions, dailyTotals.sessions),");
    expect(routes).toContain("users: toDateTotals.users || dailyTotals.users,");
  });
});
