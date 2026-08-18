import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign KPI UI regression guard", () => {
  it("hides GA4-first campaign KPI and Benchmark tab buttons while preserving legacy content access", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );
    const tabsNavigation = campaignDetail.slice(
      campaignDetail.indexOf("{/* Tabs Navigation */}"),
      campaignDetail.indexOf('<TabsContent value="overview"')
    );

    expect(tabsNavigation).toContain('className="grid w-full grid-cols-3"');
    expect(tabsNavigation).not.toContain('<TabsTrigger value="kpis">');
    expect(tabsNavigation).not.toContain('<TabsTrigger value="benchmarks">');
    expect(campaignDetail).toContain("['overview','kpis','benchmarks','insights','webhooks'].includes(h)");
    expect(campaignDetail).toContain('<TabsContent value="kpis"');
    expect(campaignDetail).toContain('<TabsContent value="benchmarks"');
  });

  it("colors campaign KPI progress bars from the same band used by the summary panel", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );

    expect(campaignDetail).toContain("const progressBand = getCampaignKpiSnapshot(kpi)?.band || 'below';");
    expect(campaignDetail).toContain("progressBand === 'above' ? 'bg-green-600'");
    expect(campaignDetail).toContain("progressBand === 'near' ? 'bg-blue-600' : 'bg-red-600'");
    expect(campaignDetail).not.toContain("progressPercentRaw >= 70 ? 'bg-yellow-600' : 'bg-red-600'");
  });
});
