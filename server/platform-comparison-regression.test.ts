import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Platform Comparison regression guard", () => {
  it("uses the shared aggregate contract for connected-source platform rows", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");

    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days"');
    expect(page).toContain('outcome-totals?dateRange=90days');
    expect(page).toContain('fetch(url, { credentials: "include" })');
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

  it("keeps the GA4 aggregate source aligned with the GA4 platform overview source of truth", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(routes).toContain("let ga4TotalsFromSourceTruth = false;");
    expect(routes).toContain("ga4TotalsFromSourceTruth = true;");
    expect(routes).toContain("!ga4TotalsFromSourceTruth && activeGA4");
    expect(routes).toContain("const rows = [...(Array.isArray(sim?.timeSeries) ? sim.timeSeries : []), ...(Array.isArray(storedRows) ? storedRows : [])];");
  });
});
