import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ga4MetricsFile = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
const ga4ScheduledReportPdfFile = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

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
    expect(content).toContain("category: getInsightCategory(item),");
    expect(renderSection).toContain("const visibleInsights = insights.slice(0, 12);");
    expect(renderSection).toContain("INSIGHT_CATEGORY_GROUPS.map((group) =>");
    expect(renderSection).toContain("visibleInsights.filter((i) => i.category === group.key)");
    expect(renderSection).toContain("groupInsights.map((i) =>");
  });

  it("flags invalid KPI and Benchmark targets before generating performance guidance", () => {
    const content = ga4MetricsFile();
    const helperStart = content.indexOf("const isBoundedRateMetric =");
    const insightsStart = content.indexOf("const insights = useMemo<InsightItem[]>(() => {");
    const insightsEnd = content.indexOf("// Collect GA4 campaign names from all imported campaigns", insightsStart);
    const helperSection = content.slice(helperStart, insightsStart);
    const insightsSection = content.slice(insightsStart, insightsEnd);

    expect(helperStart).toBeGreaterThan(-1);
    expect(insightsEnd).toBeGreaterThan(insightsStart);
    expect(helperSection).toContain('keys.includes("conversionrate") || keys.includes("engagementrate")');
    expect(helperSection).toContain("value <= 0");
    expect(helperSection).toContain("value > 100");
    expect(helperSection).toContain("percentage rate metrics");
    expect(insightsSection).toContain("const invalidKpis =");
    expect(insightsSection).toContain("const invalidBenchmarks =");
    expect(insightsSection).toContain("integrity:kpi_invalid_config");
    expect(insightsSection).toContain("integrity:bench_invalid_config");
    expect(insightsSection).toContain("if (getInvalidKpiConfigReason(k)) continue; // invalid KPIs are handled in integrity checks above");
    expect(insightsSection).toContain("if (getInvalidBenchmarkConfigReason(b)) continue; // invalid benchmarks are handled in integrity checks above");
    expect(insightsSection).toContain("This KPI is not used for behind-target guidance until the saved target is corrected.");
    expect(insightsSection).toContain("This Benchmark is not used for behind-benchmark guidance until the saved benchmark value is corrected.");
  });

  it("shows data basis and confidence metadata on What to investigate next cards", () => {
    const content = ga4MetricsFile();
    const metadataStart = content.indexOf("const getInsightDataBasis =");
    const metadataEnd = content.indexOf("const insights = useMemo<InsightItem[]>(() => {", metadataStart);
    const metadataSection = content.slice(metadataStart, metadataEnd);
    const renderStart = content.indexOf('<CardTitle className="text-lg">What to investigate next</CardTitle>');
    const renderEnd = content.indexOf("</CardContent>", renderStart);
    const renderSection = content.slice(renderStart, renderEnd);

    expect(metadataStart).toBeGreaterThan(-1);
    expect(metadataEnd).toBeGreaterThan(metadataStart);
    expect(content).toContain('type InsightConfidence = "High" | "Medium" | "Low";');
    expect(content).toContain("dataBasis?: string;");
    expect(content).toContain("confidence?: InsightConfidence;");
    expect(metadataSection).toContain("Saved KPI target + current values");
    expect(metadataSection).toContain("Saved Benchmark + current values");
    expect(metadataSection).toContain("GA4 completed daily history");
    expect(metadataSection).toContain("Revenue/spend to-date totals");
    expect(metadataSection).toContain("GA4 native + imported revenue");
    expect(content).toContain("dataBasis: getInsightDataBasis(item),");
    expect(content).toContain("confidence: getInsightConfidence(item),");
    expect(renderSection).toContain("Basis: {i.dataBasis}");
    expect(renderSection).toContain("Confidence: {i.confidence}");
  });

  it("makes What to investigate next intro copy reflect available daily history", () => {
    const content = ga4MetricsFile();
    const copyStart = content.indexOf("const insightsActionDescription = useMemo(() => {");
    const copyEnd = content.indexOf("// Collect GA4 campaign names from all imported campaigns", copyStart);
    const copySection = content.slice(copyStart, copyEnd);
    const renderStart = content.indexOf('<CardTitle className="text-lg">What to investigate next</CardTitle>');
    const renderEnd = content.indexOf("</CardHeader>", renderStart);
    const renderSection = content.slice(renderStart, renderEnd);

    expect(copyStart).toBeGreaterThan(-1);
    expect(copyEnd).toBeGreaterThan(copyStart);
    expect(copySection).toContain("availableDays < INSIGHTS_SHORT_WINDOW_DAYS");
    expect(copySection).toContain("Trend and anomaly checks need at least ${INSIGHTS_SHORT_WINDOW_DAYS} days");
    expect(copySection).toContain("availableDays < INSIGHTS_MIN_HISTORY_DAYS");
    expect(copySection).toContain("Short-window trend checks are active");
    expect(copySection).toContain("full 7-day vs prior 7-day analysis starts after ${INSIGHTS_MIN_HISTORY_DAYS} days");
    expect(copySection).toContain("We compare the last 7 days vs the previous 7 days");
    expect(renderSection).toContain("<CardDescription>{insightsActionDescription}</CardDescription>");
    expect(renderSection).not.toContain("when enough daily history exists");
  });

  it("keeps What to investigate next recommendations worded as checks rather than causal conclusions", () => {
    const content = ga4MetricsFile();
    const pdfContent = ga4ScheduledReportPdfFile();
    const insightsStart = content.indexOf("const insights = useMemo<InsightItem[]>(() => {");
    const insightsEnd = content.indexOf("// Collect GA4 campaign names from all imported campaigns", insightsStart);
    const insightsSection = content.slice(insightsStart, insightsEnd);

    expect(insightsStart).toBeGreaterThan(-1);
    expect(insightsEnd).toBeGreaterThan(insightsStart);
    expect(insightsSection).toContain('accounts for ${ch.topRevenueShare.toFixed(0)}% of revenue; check that channel first.');
    expect(insightsSection).toContain('accounts for ${ch.topSessionShare.toFixed(0)}% of sessions; check whether its volume or quality changed.');
    expect(insightsSection).toContain("Check top-performing channels before considering budget increases.");
    expect(insightsSection).toContain("Check which channels contributed to the increase before considering scaling.");
    expect(insightsSection).toContain("Review high-ROAS channels before considering spend increases or new audience tests.");
    expect(insightsSection).toContain("Review whether the target should be raised before changing budget allocation.");
    expect(insightsSection).not.toContain("drives ${ch.topRevenueShare.toFixed(0)}% of revenue");
    expect(insightsSection).not.toContain("drives ${ch.topSessionShare.toFixed(0)}% of sessions");
    expect(insightsSection).not.toContain("Momentum is positive.");
    expect(insightsSection).not.toContain("Revenue momentum is strong.");
    expect(insightsSection).not.toContain("Performance is strong.");
    expect(insightsSection).not.toContain("This KPI is performing well.");
    expect(pdfContent).toContain("Review source and medium mix for the largest acquisition-channel changes.");
    expect(pdfContent).not.toContain("dropped first");
  });

  it("keeps GA4 Insights report output aligned with grouped and evidence-aware findings", () => {
    const content = ga4MetricsFile();
    const renderStart = content.indexOf("const renderInsightsSection = () => {");
    const renderEnd = content.indexOf("// ========== KPIs ==========", renderStart);
    const renderSection = content.slice(renderStart, renderEnd);

    expect(renderStart).toBeGreaterThan(-1);
    expect(renderEnd).toBeGreaterThan(renderStart);
    expect(renderSection).toContain("const actionDescLines = wrapPdfText(String(insightsActionDescription || \"\")");
    expect(renderSection).toContain("const groupedTop = INSIGHT_CATEGORY_GROUPS.map((group) => ({");
    expect(renderSection).toContain("items: top.filter((i: any) => i.category === group.key)");
    expect(renderSection).toContain("for (const group of groupedTop)");
    expect(renderSection).toContain("doc.text(group.label");
    expect(renderSection).toContain("const meta = [basis ? `Basis: ${basis}` : \"\", confidence ? `Confidence: ${confidence}` : \"\"].filter(Boolean).join(\" | \");");
    expect(renderSection).toContain("Recommended check: ${rec}");
    expect(renderSection).toContain("renderInsightCard(item)");
  });
});
