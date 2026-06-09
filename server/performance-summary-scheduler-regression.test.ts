import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Performance Summary scheduler snapshot alignment", () => {
  it("stores scheduled snapshots from the Performance Summary aggregate contract", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { buildPerformanceSummaryAggregate }');
    expect(scheduler).toContain("const performanceSummary = buildPerformanceSummaryAggregate({");
    expect(scheduler).toContain('dateRange: "90days"');
    expect(scheduler).toContain('platformSources: [');
    expect(scheduler).toContain('id: "google_ads"');
    expect(scheduler).toContain('metrics: googleAdsData');
    expect(scheduler).toContain('freshness: { selectedCampaignIds: googleAdsSelectedCampaignIds }');
    expect(scheduler).toContain("const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend) + metaData.spend + googleAdsData.spend + instagramData.spend + tiktokData.spend;");
    expect(scheduler).toContain("storage.getTikTokConnection(campaignId)");
    expect(scheduler).toContain("storage.getTikTokDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("selectedIds.has(String(row?.tiktokCampaignId || \"\"))");
    expect(scheduler).toContain('id: "tiktok"');
    expect(scheduler).toContain('label: "TikTok Ads"');
    expect(scheduler).toContain("metrics: tiktokData");
    expect(scheduler).toContain("freshness: { selectedCampaignIds: tiktokSelectedCampaignIds }");
    expect(scheduler).toContain("performanceSummary,");
    expect(scheduler).toContain('aggregateValue("impressions")');
    expect(scheduler).toContain('aggregateValue("conversions")');
    expect(scheduler).toContain('aggregateValue("spend")');
    expect(scheduler).toContain("hasSnapshotMetricValue(metrics)");
    expect(scheduler).not.toContain("totalImpressions = advertisingImpressions + webPageviews");
  });

  it("keeps the legacy manual snapshot route on the scheduler aggregate path", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const start = routes.indexOf('app.post("/api/campaigns/:id/snapshots"');
    const end = routes.indexOf('app.get("/api/campaigns/:id/snapshots/comparison"', start);
    const route = routes.slice(start, end);

    expect(route).toContain('app.post("/api/campaigns/:id/snapshots", requireCampaignAccessParamId');
    expect(route).toContain('const { aggregateCampaignMetrics } = await import("./scheduler.js");');
    expect(route).toContain("const metrics = await aggregateCampaignMetrics(id);");
    expect(route).toContain("metrics: metrics.detailedMetrics");
    expect(route).toContain("snapshotType: 'manual'");
    expect(route).not.toContain("linkedinMetrics");
    expect(route).not.toContain("customIntegrationData");
  });

  it("keeps snapshot read routes campaign-access guarded", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(routes).toContain('app.get("/api/campaigns/:id/snapshots/comparison", requireCampaignAccessParamId');
    expect(routes).toContain('app.get("/api/campaigns/:id/snapshots", requireCampaignAccessParamId');
  });

  it("compares What's Changed only against compatible aggregate snapshots", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const start = page.indexOf("const getChanges = () => {");
    const end = page.indexOf("const changeData = getChanges();", start);
    const getChanges = page.slice(start, end);

    expect(page).toContain('const changeMetricConfigs = [');
    expect(page).toContain('{ key: "sessions", label: "Sessions" }');
    expect(page).toContain('{ key: "users", label: "Users" }');
    expect(page).toContain('{ key: "revenue", label: "Revenue", isCurrency: true }');
    expect(getChanges).toContain("const baseline = comparisonData?.previous;");
    expect(getChanges).not.toContain("comparisonData?.previous || comparisonData?.current");
    expect(getChanges).toContain('return { changes: [], baselineTimestamp: null, emptyReason: "not_enough_history" };');
    expect(getChanges).toContain("const baselineAggregate = baseline?.metrics?.performanceSummary;");
    expect(getChanges).toContain("baselineAggregate?.version !== performanceSummary.version");
    expect(getChanges).toContain("aggregateSnapshotMetricAvailable(performanceSummary, config.key)");
    expect(getChanges).toContain("aggregateSnapshotMetricAvailable(baselineAggregate, config.key)");
    expect(getChanges).toContain("sourceLabel: sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(\", \")}` : \"Sources unavailable\"");
    expect(getChanges).toContain("changeMetricConfigs.forEach(addChange);");
    expect(getChanges).not.toContain('addChange("Engagements"');
    expect(getChanges).not.toContain("parseNum(baseline.totalImpressions)");
    expect(getChanges).not.toContain("parseNum(baseline.totalSpend)");
  });

  it("renders Metric Trends from compatible aggregate snapshot totals", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const start = page.indexOf("{/* Trend Charts");
    const end = page.indexOf("{/* Insights Tab */}", start);
    const trends = page.slice(start, end);

    expect(trends).toContain("snapshot?.metrics?.performanceSummary?.version === performanceSummary.version");
    expect(trends).toContain("const trendMetrics = changeMetricConfigs.filter((config: any) => aggregateSnapshotMetricAvailable(performanceSummary, config.key));");
    expect(trends).toContain("const aggregate = snapshot?.metrics?.performanceSummary;");
    expect(trends).toContain("aggregateSnapshotMetricAvailable(aggregate, config.key) ? aggregateSnapshotMetricValue(aggregate, config.key) : null");
    expect(trends).toContain("const chartMetrics = trendMetrics.filter");
    expect(trends).toContain("Not enough compatible trend data yet");
    expect(trends).toContain("dataKey={config.key}");
    expect(trends).toContain("Sources: ${sourceLabels.join");
    expect(trends).not.toContain("snapshot.totalImpressions");
    expect(trends).not.toContain("snapshot.totalClicks");
    expect(trends).not.toContain("snapshot.totalConversions");
    expect(trends).not.toContain("snapshot.totalSpend");
  });
});
