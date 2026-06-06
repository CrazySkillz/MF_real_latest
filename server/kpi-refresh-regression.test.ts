import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readKpiRefreshSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "utils", "kpi-refresh.ts"), "utf8");
}

describe("KPI refresh regression guards", () => {
  it("does not substitute aggregate metrics for missing campaign-specific LinkedIn KPI metrics", () => {
    const source = readKpiRefreshSource();
    const campaignSpecificBlock = source.slice(
      source.indexOf("if (kpi.applyTo === 'specific' && kpi.specificCampaignId)"),
      source.indexOf("const newCurrentValue = calculateKPIValue", source.indexOf("if (kpi.applyTo === 'specific' && kpi.specificCampaignId)"))
    );

    expect(campaignSpecificBlock).toContain("const campaignMetrics = await getCampaignSpecificMetrics");
    expect(campaignSpecificBlock).toContain("continue;");
    expect(campaignSpecificBlock).not.toContain("Using aggregate metrics for campaign-specific KPI");
  });

  it("refreshes Instagram KPIs only from selected source-backed Instagram daily rows", () => {
    const source = readKpiRefreshSource();

    expect(source).toContain("export async function refreshInstagramKPIsForCampaign");
    expect(source).toContain('storage.getPlatformKPIs("instagram", campaignId)');
    expect(source).toContain("storage.getInstagramConnection(campaignId)");
    expect(source).toContain("storage.getInstagramDailyMetrics(campaignId, startDate, endDate)");
    expect(source).toContain("selectedSet.has(String(row?.instagramCampaignId || \"\"))");
    expect(source).toContain('String(row?.publisherPlatform || "instagram").trim().toLowerCase() === "instagram"');
    expect(source).toContain('String((target as any).applyTo || "") === "specific"');
    expect(source).toContain("if (specificId && !selectedSet.has(specificId)) return null;");
    expect(source).toContain("mapKPIMetricToInstagramKey");
    expect(source).toContain("costPerConversion");
    expect(source).toContain("conversionRate");
    expect(source).not.toContain("getMetaDailyMetrics");
    expect(source).not.toContain("MetaGraphAPIClient");
  });

  it("refreshes Instagram Benchmarks only from selected source-backed Instagram daily rows", () => {
    const source = readKpiRefreshSource();

    expect(source).toContain("export async function refreshInstagramBenchmarksForCampaign");
    expect(source).toContain('storage.getPlatformBenchmarks("instagram", campaignId)');
    expect(source).toContain("getInstagramMetricsForTarget(campaignId, benchmark)");
    expect(source).toContain("storage.updateBenchmark(String((benchmark as any).id)");
    expect(source).toContain("currentValue,");
    expect(source).toContain("variance: String(variance)");
    expect(source).toContain("selectedSet.has(String(row?.instagramCampaignId || \"\"))");
    expect(source).toContain('String(row?.publisherPlatform || "instagram").trim().toLowerCase() === "instagram"');
    expect(source).not.toContain("getMetaDailyMetrics");
    expect(source).not.toContain("MetaGraphAPIClient");
  });
});
