import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Platform Comparison regression guard", () => {
  it("uses the shared aggregate contract for connected-source platform rows", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");

    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "30days"');
    expect(page).toContain('fetch(url, { credentials: "include" })');
    expect(page).toContain("const performanceSummary = outcomeTotals?.performanceSummary;");
    expect(page).toContain("const aggregateSources = Array.isArray(ot?.performanceSummary?.sources) ? ot.performanceSummary.sources : [];");
    expect(page).toContain('.filter((source: any) => source?.connected === true && source?.category !== "financial")');
    expect(page).toContain("const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String) : [];");
    expect(page).toContain('source?.id === "ga4" ? "#e37400"');
    expect(page).toContain('source?.id === "google_ads" ? "#34a853"');
  });

  it("does not render child revenue sources as separate platforms when the aggregate is present", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "platform-comparison.tsx"), "utf-8");

    expect(page).toContain("if (performanceSummary) return [];");
    expect(page).toContain("const revenueSourcesData = useMemo(() => {");
    expect(page).toContain("source?.category !== \"financial\"");
  });
});
