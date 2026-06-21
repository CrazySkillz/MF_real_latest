import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ga4MetricsFile = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

function computeExecutiveFinancials(input: {
  ga4Revenue: number;
  importedRevenue: number;
  spend: number;
  conversions: number;
  pipelineProxy: number;
}) {
  const revenue = Number((input.ga4Revenue + input.importedRevenue).toFixed(2));
  const spend = Number(input.spend.toFixed(2));
  return {
    revenue,
    spend,
    profit: Number((revenue - spend).toFixed(2)),
    roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
    roi: spend > 0 ? Number((((revenue - spend) / spend) * 100).toFixed(2)) : 0,
    cpa: input.conversions > 0 ? Number((spend / input.conversions).toFixed(2)) : 0,
    pipelineProxy: input.pipelineProxy,
  };
}

describe("GA4 Insights regression guard", () => {
  it("uses the same all-source financial model as Overview and excludes Pipeline Proxy from confirmed revenue", () => {
    const metrics = computeExecutiveFinancials({
      ga4Revenue: 265727.24,
      importedRevenue: 49200,
      spend: 50000,
      conversions: 2500,
      pipelineProxy: 8000,
    });

    expect(metrics.revenue).toBe(314927.24);
    expect(metrics.revenue).not.toBe(322927.24);
    expect(metrics.profit).toBe(264927.24);
    expect(metrics.roas).toBe(6.3);
    expect(metrics.roi).toBe(529.85);
    expect(metrics.cpa).toBe(20);
    expect(metrics.pipelineProxy).toBe(8000);
  });

  it("renders Insights Executive Financials from financialRevenue and financialSpend", () => {
    const content = ga4MetricsFile();
    const sectionStart = content.indexOf('<CardTitle className="text-lg">Executive Financials</CardTitle>');
    const sectionEnd = content.indexOf("{/* Trends card", sectionStart);
    const section = content.slice(sectionStart, sectionEnd);

    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(section).toContain("{formatMoney(Number(financialSpend || 0))}");
    expect(section).toContain("{formatMoney(Number(financialRevenue || 0))}");
    expect(section).toContain("{formatMoney(financialRevenue - financialSpend)}");
    expect(section).toContain("{Number(financialROAS || 0).toFixed(2)}x");
    expect(section).toContain("{formatPercentage(Number(financialROI || 0))}");
    expect(section).not.toContain("pipelineProxyData.totalToDate");
  });

  it("keeps Insights source provenance comma-separated rather than plus-joined", () => {
    const content = ga4MetricsFile();
    const sectionStart = content.indexOf("Sources used");
    const sectionEnd = content.indexOf("{/* Trends card", sectionStart);
    const section = content.slice(sectionStart, sectionEnd);

    expect(sectionStart).toBeGreaterThan(-1);
    expect(section).toContain('spendSourceLabels.join(", ")');
    expect(section).toContain('revenueSourceLabels.join(", ")');
    expect(section).not.toContain('spendSourceLabels.join(" + ")');
    expect(section).not.toContain('revenueSourceLabels.join(" + ")');
  });

  it("includes GA4 native revenue in Revenue source provenance when GA4 revenue exists", () => {
    const content = ga4MetricsFile();
    const labelsStart = content.indexOf("const revenueSourceLabels = useMemo");
    const labelsEnd = content.indexOf("const financialConversions", labelsStart);
    const labelsSection = content.slice(labelsStart, labelsEnd);

    expect(labelsStart).toBeGreaterThan(-1);
    expect(labelsEnd).toBeGreaterThan(labelsStart);
    expect(labelsSection).toContain('if (ga4HasRevenueMetric) labels.push("GA4 native revenue");');
    expect(labelsSection).toContain("revenueDisplaySources");
    expect(labelsSection).toContain("!labels.includes(label)");
  });

  it("groups What to investigate next findings by type without changing the flat insight source", () => {
    const content = ga4MetricsFile();
    const categoryStart = content.indexOf("const INSIGHT_CATEGORY_GROUPS = [");
    const categoryEnd = content.indexOf("const insights = useMemo<InsightItem[]>(() => {", categoryStart);
    const categorySection = content.slice(categoryStart, categoryEnd);
    const renderStart = content.indexOf('<CardTitle className="text-lg">What to investigate next</CardTitle>');
    const renderEnd = content.indexOf("</CardContent>", renderStart);
    const renderSection = content.slice(renderStart, renderEnd);

    expect(categoryStart).toBeGreaterThan(-1);
    expect(categoryEnd).toBeGreaterThan(categoryStart);
    expect(categorySection).toContain('{ key: "setup", label: "Data setup issues" }');
    expect(categorySection).toContain('{ key: "targets", label: "Targets off track" }');
    expect(categorySection).toContain('{ key: "trends", label: "Trend signals" }');
    expect(categorySection).toContain('{ key: "finance", label: "Revenue and spend checks" }');
    expect(categorySection).toContain('{ key: "context", label: "Informational context" }');
    expect(content).toContain("return out.map((item) => ({ ...item, category: getInsightCategory(item) }));");
    expect(renderSection).toContain("const visibleInsights = insights.slice(0, 12);");
    expect(renderSection).toContain("INSIGHT_CATEGORY_GROUPS.map((group) =>");
    expect(renderSection).toContain("visibleInsights.filter((i) => i.category === group.key)");
    expect(renderSection).toContain("groupInsights.map((i) =>");
  });
});
