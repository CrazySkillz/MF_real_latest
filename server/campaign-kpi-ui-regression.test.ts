import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign KPI UI regression guard", () => {
  it("hides GA4-first campaign KPI and Benchmark tab buttons while preserving legacy content access", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );
    const tabsStart = campaignDetail.indexOf("<Tabs defaultValue=");
    const overviewStart = campaignDetail.indexOf('<TabsContent value="overview"', tabsStart);
    expect(tabsStart).toBeGreaterThan(-1);
    expect(overviewStart).toBeGreaterThan(tabsStart);
    const tabsNavigation = campaignDetail.slice(tabsStart, overviewStart);

    expect(tabsNavigation).toContain('Campaign Overview</h2>');
    expect(campaignDetail).not.toContain('<TabsList');
    expect(campaignDetail).not.toContain('<TabsTrigger');
    expect(tabsNavigation).toContain("['overview','kpis','benchmarks'].includes(h)");
    expect(campaignDetail).toContain('<TabsContent value="kpis"');
    expect(campaignDetail).toContain('<TabsContent value="benchmarks"');
    const ga4Page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
    expect(ga4Page).toContain('<TabsTrigger value="kpis">KPIs</TabsTrigger>');
    expect(ga4Page).toContain('<TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>');
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
