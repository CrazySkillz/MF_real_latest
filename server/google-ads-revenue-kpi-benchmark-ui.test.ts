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

  it("fetches Google Ads KPIs through the implemented campaign-scoped platform route", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("fetch(`/api/platforms/google_ads/kpis?campaignId=${encodeURIComponent(String(campaignId))}`)");
    expect(page).not.toContain("fetch(`/api/platforms/google_ads/kpis/${campaignId}`)");
  });

  it("sends Google Ads KPI trackingPeriod as a number and surfaces create errors", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("trackingPeriod: Number(kpiForm.trackingPeriod || 30)");
    expect(page).toContain("title: 'Failed to create KPI'");
  });

  it("prefills Google Ads KPI edit mode from live values without selecting the name field", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");
    const kpiModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsKpiModal.tsx");

    expect(page).toContain("currentValue: String(currentVal)");
    expect(page).toContain("unit: kpi.unit || metricDef.unit || ''");
    expect(page).toContain("trackingPeriod: String(kpi.trackingPeriod || 30)");
    expect(kpiModal).toContain("onOpenAutoFocus={(event) => {");
    expect(kpiModal).toContain("if (editingKPI) event.preventDefault();");
  });

  it("uses platform-scoped Google Ads benchmark create and read routes", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("fetch(`/api/platforms/google_ads/benchmarks?campaignId=${encodeURIComponent(String(campaignId))}`)");
    expect(page).toContain("fetch('/api/platforms/google_ads/benchmarks'");
    expect(page).toContain("category: 'performance'");
    expect(page).not.toContain("benchmarks/evaluated?platform=google_ads");
    expect(page).not.toContain("fetch(`/api/campaigns/${campaignId}/benchmarks`");
  });

  it("keeps Google Ads benchmark creation on custom values without industry controls", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");
    const benchmarkModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsBenchmarkModal.tsx");

    expect(page).toContain("benchmarkType: 'custom' as 'industry' | 'custom'");
    expect(page).toContain("benchmarkType: 'custom'");
    expect(benchmarkModal).not.toContain('Label htmlFor="benchmark-type">Benchmark Type</Label>');
    expect(benchmarkModal).not.toContain('data-testid="select-benchmark-type"');
    expect(benchmarkModal).not.toContain('Label htmlFor="benchmark-industry">Select Industry</Label>');
    expect(benchmarkModal).not.toContain('data-testid="select-benchmark-industry"');
    expect(benchmarkModal).not.toContain('benchmarkForm.benchmarkType === "industry"');
  });

  it("prefills Google Ads benchmark edit mode from live values without selecting the name field", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");
    const benchmarkModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsBenchmarkModal.tsx");

    expect(page).toContain("currentValue: String(currentVal)");
    expect(page).toContain("unit: b.unit || metricDef.unit || ''");
    expect(page).toContain("benchmarkType: b.benchmarkType || 'custom'");
    expect(benchmarkModal).toContain("onOpenAutoFocus={(event) => {");
    expect(benchmarkModal).toContain("if (editingBenchmark) event.preventDefault();");
  });

  it("formats Google Ads KPI and Benchmark current values while keeping numeric payloads unformatted", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");
    const kpiModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsKpiModal.tsx");
    const benchmarkModal = readSource("client", "src", "pages", "google-ads-analytics", "GoogleAdsBenchmarkModal.tsx");

    expect(kpiModal).toContain("useGrouping: true");
    expect(benchmarkModal).toContain("useGrouping: true");
    expect(page).toContain("function stripNumberFormatting(value: any): any");
    expect(page).toContain("currentValue: stripNumberFormatting(kpiForm.currentValue) || String(getLiveMetricValue(kpiForm.metric))");
    expect(page).toContain("currentValue: stripNumberFormatting(benchmarkForm.currentValue) || String(getLiveMetricValue(benchmarkForm.metric))");
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

  it("keeps Google Ads Insights financial semantics source-aware", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("const insightsRevenueValue = hasGoogleAdsAttributedRevenue ? googleAdsAttributedRevenue : summary.conversionValue;");
    expect(page).toContain("const insightsRoasValue = hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoas : summary.roas;");
    expect(page).toContain("const insightsRoiValue = hasGoogleAdsAttributedRevenue ? googleAdsAttributedRoi : summary.roi;");
    expect(page).toContain("This uses imported Google Ads attributed revenue, not native Google Ads conversion value.");
    expect(page).toContain("This is conversion-value efficiency, not business revenue.");
    expect(page).toContain("Conversion-value ROAS (${summary.roas.toFixed(2)}x) and conversion-value ROI");
    expect(page).toContain("Spend, native conversion value, and imported Google Ads attributed revenue when connected.");
    expect(page).toContain("{hasGoogleAdsAttributedRevenue ? fmtCurrency(googleAdsAttributedRevenue) : 'N/A'}");
    expect(page).toContain("{hasGoogleAdsAttributedRevenue ? `${googleAdsAttributedRoas.toFixed(2)}x` : 'N/A'}");
    expect(page).toContain("{hasGoogleAdsAttributedRevenue ? fmtPct(googleAdsAttributedRoi) : 'N/A'}");
    expect(page).toContain("Conversion Value ROAS");
    expect(page).toContain("Conversion-value ROAS declined");
  });
});
