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
