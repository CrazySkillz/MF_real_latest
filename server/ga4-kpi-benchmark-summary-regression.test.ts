import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 KPI and Benchmark summary regression guard", () => {
  it("keeps KPI Avg. Progress bounded to per-card fill progress", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const kpiTracker = useMemo(() => {");
    expect(ga4MetricsFile).toContain("sumPct += p.fillPct;");
    expect(ga4MetricsFile).not.toContain("sumPct += p.attainmentPct;");
    expect(ga4MetricsFile).toContain("financialRevenue, financialROI, financialCPA");
  });

  it("wires GA4 KPI summary bands to the shared metric-aware threshold policy", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("resolveKpiThresholdPolicy");
    expect(ga4MetricsFile).toContain("classifyKpiBandWithPolicy");
    expect(ga4MetricsFile).toContain("const policy = resolveKpiThresholdPolicy({");
    expect(ga4MetricsFile).toContain("const band = classifyKpiBandWithPolicy({ current: safeCurrent, target: safeTarget, lowerIsBetter, policy })");
    expect(ga4MetricsFile).not.toContain("const NEAR_TARGET_BAND_PCT = 5");
    expect(ga4MetricsFile).not.toContain("within ±5% of target");
    expect(ga4MetricsFile).not.toContain("more than +5% above target");
    expect(ga4MetricsFile).not.toContain("more than −5% below target");
    expect(ga4MetricsFile).toContain("formatKpiTolerancePolicyLabel");
    expect(ga4MetricsFile).toContain("summarizeKpiToleranceLabels");
    expect(ga4MetricsFile).toContain("toleranceLabels.add(formatKpiTolerancePolicyLabel(p.policy));");
    expect(ga4MetricsFile).toContain("return \"each KPI's tolerance\";");
    expect(ga4MetricsFile).not.toContain("formatKpiCountToleranceUnitLabel");
    expect(ga4MetricsFile).not.toContain("absoluteTolerance.toLocaleString");
    expect(ga4MetricsFile).not.toContain("formatKpiToleranceTrackerDetail");
    expect(ga4MetricsFile).not.toContain("Scored KPI tolerances");
    expect(ga4MetricsFile).toContain("Different KPI types can use different tolerances.");
    expect(ga4MetricsFile).toContain("better than {kpiTracker.toleranceSummary}");
    expect(ga4MetricsFile).toContain("within {kpiTracker.toleranceSummary}");
    expect(ga4MetricsFile).toContain("outside {kpiTracker.toleranceSummary}");
    expect(ga4MetricsFile).toContain("outside ${toleranceLabel}");
  });

  it("keeps KPI card status text aligned with metric-aware bands", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain('if (p.band === "near") return `On track (within ${toleranceLabel})`;');
    expect(ga4MetricsFile.indexOf('if (p.band === "near") return `On track (within ${toleranceLabel})`;')).toBeLessThan(
      ga4MetricsFile.indexOf('`${absStr}% below target (outside ${toleranceLabel})`')
    );
  });

  it("keeps GA4 report KPI status aligned with the shared KPI progress helper", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const p = computeKpiProgress(k);");
    expect(ga4MetricsFile).toContain('const statusLabel = p.band === "above" ? "Above Target" : p.band === "near" ? "On Track" : "Below Target";');
    expect(ga4MetricsFile).toContain('const statusCol: C3 = p.band === "above" ? C.success : p.band === "near" ? C.info : C.danger;');
    expect(ga4MetricsFile).not.toContain("const targetDeltaPct = target > 0");
  });

  it("excludes insufficient-data KPIs from summary scoring and card progress", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("resolveKpiDataSufficiency");
    expect(ga4MetricsFile).toContain("const getKpiDataSufficiency = (kpi: any) => {");
    expect(ga4MetricsFile).toContain("let insufficient = 0;");
    expect(ga4MetricsFile).toContain("if (!sufficiency.sufficient) {");
    expect(ga4MetricsFile).toContain("continue; // do NOT score thin-data KPIs as strong or weak performance");
    expect(ga4MetricsFile).toContain("const p = isBlocked || isInsufficient ? null : computeKpiProgress(kpi);");
    expect(ga4MetricsFile).toContain("Insufficient data:");
  });

  it("prefills benchmark edit current value from the live current-value path", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const liveCurrentValue =");
    expect(ga4MetricsFile).toContain('? String(getLiveBenchmarkCurrentValue(metric))');
    expect(ga4MetricsFile).toContain("currentValue: formatNumberByUnit(liveCurrentValue, String(benchmark.unit || \"%\")),");
    expect(ga4MetricsFile).toContain("currentValue: formatNumberByUnit(liveCurrentValue, String((editingBenchmark as any).unit || \"%\")),");
  });

  it("documents the bounded KPI average and live benchmark edit-current-value behavior", () => {
    const kpisDoc = readFileSync(
      join(process.cwd(), "GA4", "KPIS.md"),
      "utf-8"
    );
    const benchmarksDoc = readFileSync(
      join(process.cwd(), "GA4", "BENCHMARKS.md"),
      "utf-8"
    );

    expect(kpisDoc).toContain("bounded to `0%` to `100%` per KPI");
    expect(kpisDoc).toContain("Metric-aware threshold policy:");
    expect(kpisDoc).toContain("performance tracker status-card copy should stay readable for mixed KPI types");
    expect(kpisDoc).toContain("each KPI's tolerance");
    expect(kpisDoc).toContain("outside 5% tolerance");
    expect(kpisDoc).not.toContain("41 users");
    expect(kpisDoc).not.toContain("41 count");
    expect(kpisDoc).toContain("count KPIs such as `Conversions`, `Users`, and `Sessions` use count-aware tolerance");
    expect(kpisDoc).toContain("rate KPIs such as `Conversion Rate` and `Engagement Rate` use relative tolerance");
    expect(kpisDoc).toContain("lower-is-better cost KPIs such as `CPA`, `CPC`, `CPM`, and `CPL` invert the direction");
    expect(kpisDoc).toContain("blocked or insufficient-data KPIs are excluded");
    expect(kpisDoc).toContain("Validation examples:");
    expect(kpisDoc).not.toContain("More than `+5%` above target.");
    expect(kpisDoc).not.toContain("More than `-5%` below target.");
    expect(benchmarksDoc).toContain("the edit modal should show the same live current value the benchmark card is using");
  });
});
