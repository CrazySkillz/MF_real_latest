import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Performance Summary scheduler snapshot alignment", () => {
  it("stores scheduled snapshots from the Performance Summary aggregate contract", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { buildPerformanceSummaryAggregate }');
    expect(scheduler).toContain("const performanceSummary = buildPerformanceSummaryAggregate({");
    expect(scheduler).toContain('dateRange: "90days"');
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

  it("compares What's Changed only against compatible aggregate snapshots", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const start = page.indexOf("const getChanges = () => {");
    const end = page.indexOf("const changeData = getChanges();", start);
    const getChanges = page.slice(start, end);

    expect(getChanges).toContain("const baselineAggregate = baseline?.metrics?.performanceSummary;");
    expect(getChanges).toContain("baselineAggregate?.version !== performanceSummary.version");
    expect(getChanges).toContain("const currentMetricValue = (metricName: string, fallbackValue: number) => {");
    expect(getChanges).toContain("const baselineMetricValue = (metricName: string, fallbackValue: number) => {");
    expect(getChanges).toContain('addChange("Sessions"');
    expect(getChanges).not.toContain('addChange("Engagements"');
  });
});
