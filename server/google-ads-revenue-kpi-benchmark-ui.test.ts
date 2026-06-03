import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("Google Ads revenue KPI and Benchmark UI semantics", () => {
  it("maps revenue-dependent live values to imported Google Ads attributed revenue", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("{ key: 'totalRevenue', label: 'Total Revenue'");
    expect(page).toContain("{ key: 'profit', label: 'Profit'");
    expect(page).toContain("{ key: 'roi', label: 'ROI'");
    expect(page).toContain("if (normalizedKey === 'totalrevenue' || normalizedKey === 'revenue') return hasGoogleAdsAttributedRevenue ? googleAdsAttributedRevenue : 0;");
    expect(page).toContain("if (normalizedKey === 'profit') return hasGoogleAdsAttributedRevenue ? googleAdsAttributedProfit : 0;");
    expect(page).toContain("if (normalizedKey === 'roas') return hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoas : 0;");
    expect(page).toContain("if (normalizedKey === 'roi') return hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoi : 0;");
    expect(page).not.toContain("roas: summary.roas || 0");
    expect(page).not.toContain("roi: summary.roi || 0");
  });

  it("passes revenue-aware summary values only into KPI and Benchmark modals", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("summary={{");
    expect(page).toContain("totalRevenue: hasGoogleAdsAttributedRevenue ? googleAdsAttributedRevenue : 0");
    expect(page).toContain("profit: hasGoogleAdsAttributedRevenue ? googleAdsAttributedProfit : 0");
    expect(page).toContain("roas: hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoas : 0");
    expect(page).toContain("roi: hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoi : 0");
  });

  it("exposes attributed revenue metrics in Google Ads KPI and Benchmark pickers", () => {
    const kpiModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsKpiModal.tsx");
    const benchmarkModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsBenchmarkModal.tsx");

    for (const source of [kpiModal, benchmarkModal]) {
      expect(source).toContain('<SelectItem value="totalRevenue">Total Revenue</SelectItem>');
      expect(source).toContain('<SelectItem value="profit">Profit</SelectItem>');
      expect(source).toContain('<SelectItem value="roas">ROAS</SelectItem>');
      expect(source).toContain('<SelectItem value="roi">ROI</SelectItem>');
      expect(source).toContain("case \"totalRevenue\":");
      expect(source).toContain("case \"profit\":");
      expect(source).toContain("case \"roas\":");
      expect(source).toContain("case \"roi\":");
    }
  });
});
