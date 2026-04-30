import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 Benchmark regression guard", () => {
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
    expect(ga4JobsFile).toContain("await storage.updateBenchmark(benchmarkId, { currentValue: String(round2(currentValue)) } as any);");
  });

  it("refetches notifications immediately after GA4 Run refresh", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain('queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(ga4MetricsFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"] });');
  });
});
