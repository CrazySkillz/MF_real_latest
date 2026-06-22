import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 Benchmark regression guard", () => {
  it("wires GA4 benchmark cards and tracker to shared metric-aware benchmark policy", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const progressStart = ga4MetricsFile.indexOf("const computeBenchmarkProgress = (benchmark: any) => {");
    const progressEnd = ga4MetricsFile.indexOf("const getBenchmarkDisplayCurrentValue", progressStart);
    const progressSection = ga4MetricsFile.slice(progressStart, progressEnd);
    const trackerStart = ga4MetricsFile.indexOf("const benchmarkTracker = useMemo(() => {");
    const trackerEnd = ga4MetricsFile.indexOf("// --- Rolling window rollups", trackerStart);
    const trackerSection = ga4MetricsFile.slice(trackerStart, trackerEnd);

    expect(progressStart).toBeGreaterThan(-1);
    expect(progressEnd).toBeGreaterThan(progressStart);
    expect(trackerStart).toBeGreaterThan(-1);
    expect(trackerEnd).toBeGreaterThan(trackerStart);
    expect(ga4MetricsFile).toContain("computeBenchmarkThresholdResult");
    expect(progressSection).toContain("const result = computeBenchmarkThresholdResult({");
    expect(progressSection).toContain("status === \"on_track\" ? \"bg-green-500\"");
    expect(progressSection).not.toContain("ratio >= 0.9");
    expect(progressSection).not.toContain("ratio >= 0.7");
    expect(trackerSection).toContain("const p = computeBenchmarkProgress(b);");
    expect(trackerSection).toContain("sumPct += Number(p?.pct || 0);");
  });

  it("keeps GA4 benchmark tracker labels metric-aware instead of fixed 90/70 copy", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("within benchmark tolerance");
    expect(ga4MetricsFile).toContain("moderate benchmark miss");
    expect(ga4MetricsFile).toContain("material benchmark miss");
    expect(ga4MetricsFile).not.toContain("90% or more of benchmark");
    expect(ga4MetricsFile).not.toContain("70% to under 90% of benchmark");
    expect(ga4MetricsFile).not.toContain("below 70% of benchmark");
  });

  it("routes GA4 benchmark notifications to ga4-metrics benchmarks", () => {
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(benchmarkNotificationsFile).toContain('if (platform === "google_analytics") return `/campaigns/${campaignId}/ga4-metrics?tab=benchmarks&highlight=${id}`;');
    expect(benchmarkNotificationsFile).toContain("export async function checkBenchmarkPerformanceAlerts(): Promise<number> {");
  });

  it("runs benchmark alert checks in the immediate post-refresh path and keeps stored benchmark currentValue fresh on rerun", () => {
    const autoRefreshFile = readFileSync(
      join(process.cwd(), "server", "auto-refresh-scheduler.ts"),
      "utf-8"
    );
    const ga4JobsFile = readFileSync(
      join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"),
      "utf-8"
    );

    expect(autoRefreshFile).toContain('import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";');
    expect(autoRefreshFile).toContain("await checkBenchmarkPerformanceAlerts().catch((e) => {");
    expect(ga4JobsFile).toContain("Always refresh stored currentValue so same-day persisted GA4 daily rows update what alert checks read,");
    expect(ga4JobsFile).toContain("await benchmarkStorage.updateBenchmark(benchmarkId, { currentValue: String(round2(currentValue)) } as any);");
  });

  it("runs notification checks immediately after GA4 refresh paths", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const ga4JobsFile = readFileSync(
      join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const { checkBenchmarkPerformanceAlerts } = await import("./benchmark-notifications.js");');
    expect(routesFile).toContain("await checkBenchmarkPerformanceAlerts();");
    expect(ga4JobsFile).toContain('const { checkBenchmarkPerformanceAlerts } = await import("./benchmark-notifications.js");');
    expect(ga4JobsFile).toContain("await checkBenchmarkPerformanceAlerts();");
  });
});
