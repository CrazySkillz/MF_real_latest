import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign KPI UI regression guard", () => {
  it("populates campaign KPI current values from the certified GA4 KPI list", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );
    const campaignKpiSection = campaignDetail.slice(
      campaignDetail.indexOf("function CampaignKPIs"),
      campaignDetail.indexOf("function CampaignBenchmarks")
    );

    expect(campaignKpiSection).toContain("fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaign.id))}`)");
    expect(campaignKpiSection).toContain("const ga4KpiValue = getKpiGA4CurrentNumber(metric);");
    expect(campaignKpiSection).toContain("if (ga4KpiValue !== null) return { value: ga4KpiValue, unit: getMetricDisplayUnit(metric) };");
    expect(campaignKpiSection).not.toContain("/ga4-to-date");
    expect(campaignKpiSection).not.toContain("/ga4-daily");
  });

  it("colors campaign KPI progress bars from the same band used by the summary panel", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("const kpiSnapshot = getCampaignKpiSnapshot(kpi);");
    expect(campaignDetail).toContain("const progressPercentRaw = kpiSnapshot?.progressPct ?? 0;");
    expect(campaignDetail).toContain("const progressBand = kpiSnapshot?.band || 'below';");
    expect(campaignDetail).not.toContain("lowerBetter ? (current > 0 ? target / current : 0)");
    expect(campaignDetail).toContain("progressBand === 'above' ? 'bg-green-600'");
    expect(campaignDetail).toContain("progressBand === 'near' ? 'bg-blue-600' : 'bg-red-600'");
    expect(campaignDetail).not.toContain("progressPercentRaw >= 70 ? 'bg-yellow-600' : 'bg-red-600'");
  });
});
