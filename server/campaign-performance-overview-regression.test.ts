import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Performance Summary Overview regression guard", () => {
  it("wires Overview cards to the performanceSummary aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const overviewStart = page.indexOf("{/* Overview Tab */}");
    const overviewEnd = page.indexOf("{/* Campaign Health Tab */}", overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain('const performanceSummary = outcomeTotals?.performanceSummary;');
    expect(page).toContain('queryKey: ["/api/campaigns", campaignId, "outcome-totals", "90days"');
    expect(page).toContain("outcome-totals?dateRange=90days");
    expect(page).toContain('const overviewImpressions = getOverviewMetric("impressions", totalImpressions);');
    expect(page).toContain('const overviewSessions = getOverviewMetric("sessions", webSessions);');
    expect(page).toContain('const overviewConversions = getOverviewMetric("conversions", totalConversions);');
    expect(page).toContain('const overviewSpend = getOverviewMetric("spend", totalSpend);');
    expect(overview).toContain("formatOverviewValue(overviewImpressions");
    expect(overview).toContain("formatOverviewValue(overviewSessions");
    expect(overview).toContain("formatOverviewValue(overviewConversions");
    expect(overview).toContain("formatOverviewValue(overviewSpend");
    expect(overview).toContain("overviewSourceLabel(overviewConversions");
    expect(overview).not.toContain("LinkedIn: {linkedinConversions.toLocaleString()} | CI: {ciConversions.toLocaleString()}");
  });

  it("shows connected non-financial sources for unavailable Overview metrics", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain('filter((source: any) => source?.category !== "financial")');
    expect(page).toContain('const reason = metric?.unavailableReasons?.[0] || "No connected source provides this metric";');
    expect(page).toContain('return sourceLabels.length > 0 ? `Sources: ${sourceLabels.join(", ")} - Impressions not available` : reason;');
  });

  it("selects top priority from lagging campaign KPIs before Benchmark fallback", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("const laggingKPIs = effectiveKpis.map((kpi: any) => {");
    expect(page).toContain("}).filter((entry: any) => entry.deltaPct < -5);");
    expect(page).toContain("const laggingBenchmarks = effectiveBenchmarks.map((benchmark: any) => {");
    expect(page).toContain("}).filter((entry: any) => entry.progressPct < 90);");
    expect(page).toContain("const topLaggingKPI = laggingKPIs.sort((a: any, b: any) => b.severity - a.severity)[0];");
    expect(page).toContain("if (topLaggingKPI) {");
    expect(page).toContain("const topCandidate: any = laggingBenchmarks.sort((a: any, b: any) => b.severity - a.severity)[0];");
    expect(page).not.toContain("const priorityCandidate = [...laggingKPIs, ...laggingBenchmarks]");
    expect(page).not.toContain("const gapA = parseNum(a.targetValue) - parseNum(a.currentValue);");
  });

  it("formats Top Priority Action currency values with thousands separators and two decimals", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("parseNum(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })");
    expect(page).toContain("if (String(unit || '').toLowerCase() === 'count' || !unit) return parseNum(value).toLocaleString('en-US', { maximumFractionDigits: 0 });");
    expect(page).not.toContain("parseNum(value).toFixed(2)");
    expect(page).not.toContain("return `${value}${unit}`;");
  });

  it("counts campaign health from on-track KPI and Benchmark status bands", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("const getKpiDeltaPct = (kpi: any) => {");
    expect(page).toContain("const kpisOnTrackOrAbove = effectiveKpis.filter((kpi: any) => getKpiDeltaPct(kpi) >= -5).length;");
    expect(page).toContain("const benchmarksOnTrack = effectiveBenchmarks.filter((benchmark: any) => getBenchmarkProgressPct(benchmark) >= 90).length;");
    expect(page).toContain("const totalOnTrackMetrics = kpisOnTrackOrAbove + benchmarksOnTrack;");
    expect(page).toContain("{totalOnTrackMetrics} of {totalMetrics} metrics on track");
    expect(page).toContain("KPIs On Track or Above");
    expect(page).toContain("Benchmarks On Track");
    expect(page).not.toContain("metrics above target");
  });

  it("wires Campaign Health data source status to the aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("const dataSources = performanceSources.length > 0");
    expect(page).toContain("name: source?.label || source?.id || \"Connected source\"");
    expect(page).toContain("connected: source?.connected === true");
    expect(page).toContain("source?.category === \"financial\" ? DollarSign : Activity");
    expect(page).toContain("{dataSources.map((source: any) => {");
  });
});
