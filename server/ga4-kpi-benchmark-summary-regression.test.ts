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
    expect(ga4MetricsFile).toContain("within metric-aware tolerance");
  });

  it("keeps KPI card status text aligned with metric-aware bands", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain('if (p.band === "near") return "On track";');
    expect(ga4MetricsFile.indexOf('if (p.band === "near") return "On track";')).toBeLessThan(
      ga4MetricsFile.indexOf('`${absStr}% below target`')
    );
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
    expect(benchmarksDoc).toContain("the edit modal should show the same live current value the benchmark card is using");
  });
});
