import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign KPI UI regression guard", () => {
  it("hides GA4-first campaign KPI and Benchmark tab buttons while preserving legacy content access", () => {
    const campaignDetail = readFileSync(
      join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"),
      "utf-8"
    );
    expect(campaignDetail).not.toContain("<TabsList");
    expect(campaignDetail).not.toContain("<TabsTrigger");
    expect(campaignDetail).toContain("['overview','kpis','benchmarks'].includes(h)");
    expect(campaignDetail).toContain('<h2 className="text-2xl font-semibold text-foreground">Campaign Overview</h2>');
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
