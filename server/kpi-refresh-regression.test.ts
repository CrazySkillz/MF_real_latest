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
});
