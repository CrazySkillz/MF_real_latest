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

  it("excludes insufficient GA4 benchmarks from scoring and shows the reason on cards", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const trackerStart = ga4MetricsFile.indexOf("const benchmarkTracker = useMemo(() => {");
    const trackerEnd = ga4MetricsFile.indexOf("// --- Rolling window rollups", trackerStart);
    const trackerSection = ga4MetricsFile.slice(trackerStart, trackerEnd);
    const cardStart = ga4MetricsFile.indexOf("{benchmarks.map((benchmark) => {");
    const cardEnd = ga4MetricsFile.indexOf("No Benchmarks Yet", cardStart);
    const cardSection = ga4MetricsFile.slice(cardStart, cardEnd);
    const insightsStart = ga4MetricsFile.indexOf("// 2) Actionable insights from Benchmark performance");
    const insightsEnd = ga4MetricsFile.indexOf("// 2b) Scheduler dependency", insightsStart);
    const insightsSection = ga4MetricsFile.slice(insightsStart, insightsEnd);
    const reportStart = ga4MetricsFile.indexOf("sectionTitle(\"Performance Benchmarks\"");
    const reportEnd = ga4MetricsFile.indexOf("renderAdsSection();", reportStart);
    const reportSection = ga4MetricsFile.slice(reportStart, reportEnd);

    expect(ga4MetricsFile).toContain("resolveBenchmarkDataSufficiency");
    expect(trackerStart).toBeGreaterThan(-1);
    expect(trackerEnd).toBeGreaterThan(trackerStart);
    expect(cardStart).toBeGreaterThan(-1);
    expect(cardEnd).toBeGreaterThan(cardStart);
    expect(insightsStart).toBeGreaterThan(-1);
    expect(insightsEnd).toBeGreaterThan(insightsStart);
    expect(reportStart).toBeGreaterThan(-1);
    expect(reportEnd).toBeGreaterThan(reportStart);
    expect(trackerSection).toContain("const sufficiency = getBenchmarkDataSufficiency(b);");
    expect(trackerSection).toContain("insufficient += 1;");
    expect(trackerSection).toContain("return { total: items.length, scored, onTrack, needsAttention, behind, blocked, insufficient, avgPct };");
    expect(cardSection).toContain("const isInsufficient = !sufficiency.sufficient;");
    expect(cardSection).toContain("const isUnavailable = isBlocked || isInsufficient;");
    expect(cardSection).toContain("sufficiency.reason || \"This Benchmark needs more data before it can be scored.\"");
    expect(insightsSection).toContain("if (!getBenchmarkDataSufficiency(b).sufficient) continue;");
    expect(reportSection).toContain("const sufficiency = getBenchmarkDataSufficiency(b);");
    expect(reportSection).toContain("Insufficient data -");
    expect(ga4MetricsFile).toContain("Some Benchmarks Need More Data");
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

  it("keeps downstream Benchmark status surfaces on the shared threshold policy", () => {
    const executivePage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"),
      "utf-8"
    );
    const reportsPage = readFileSync(
      join(process.cwd(), "client", "src", "pages", "reports.tsx"),
      "utf-8"
    );
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const schedulerFile = readFileSync(
      join(process.cwd(), "server", "report-scheduler.ts"),
      "utf-8"
    );

    const executiveBenchmarkStart = executivePage.indexOf("const executiveBenchmarkComparison =");
    const executiveBenchmarkEnd = executivePage.indexOf("const kpiProgressPct", executiveBenchmarkStart);
    const executiveBenchmarkSection = executivePage.slice(executiveBenchmarkStart, executiveBenchmarkEnd);
    expect(executiveBenchmarkSection).toContain("const threshold = computeBenchmarkThresholdResult({");
    expect(executiveBenchmarkSection).not.toContain("progressPct >= 90");
    expect(executiveBenchmarkSection).not.toContain("progressPct >= 70");
    expect(executivePage).not.toContain("below 70% of benchmark");

    const reportDownloadStart = reportsPage.indexOf("const downloadReportPdf = async");
    const reportDownloadEnd = reportsPage.indexOf("const safeName", reportDownloadStart);
    const reportDownloadSection = reportsPage.slice(reportDownloadStart, reportDownloadEnd);
    expect(reportDownloadSection).toContain("const benchmarkThresholdResult = (benchmark: any) => computeBenchmarkThresholdResult({");
    expect(reportDownloadSection).toContain('benchmarkThresholdResult(bm).status === "behind"');
    expect(reportDownloadSection).not.toContain("return pct >= 90");
    expect(reportDownloadSection).not.toContain("return pct >= 70");
    expect(reportDownloadSection).not.toContain("below 70% of benchmark");

    const executiveRouteStart = routesFile.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const executiveRouteEnd = routesFile.indexOf("// ============================================================================", executiveRouteStart);
    const executiveRoute = routesFile.slice(executiveRouteStart, executiveRouteEnd);
    expect(executiveRoute).toContain("const threshold = computeBenchmarkThresholdResult({");
    expect(executiveRoute).not.toContain("progressPct >= 90");
    expect(executiveRoute).not.toContain("progressPct >= 70");
    expect(executiveRoute).not.toContain("below 70% of benchmark");

    const evaluatedRouteStart = routesFile.indexOf('app.get("/api/campaigns/:id/benchmarks/evaluated"');
    const evaluatedRouteEnd = routesFile.indexOf("  // Get platform benchmarks", evaluatedRouteStart);
    const evaluatedRoute = routesFile.slice(evaluatedRouteStart, evaluatedRouteEnd);
    expect(evaluatedRoute).toContain("const threshold = computeBenchmarkThresholdResult({");
    expect(evaluatedRoute).not.toContain("ratio >= 0.9");
    expect(evaluatedRoute).not.toContain("ratio >= 0.7");

    const scheduledRiskStart = schedulerFile.indexOf('section === "executive-summary:overview"');
    const scheduledRiskEnd = schedulerFile.indexOf('} else if (section === "executive-summary:recommendations")', scheduledRiskStart);
    const scheduledRiskSection = schedulerFile.slice(scheduledRiskStart, scheduledRiskEnd);
    expect(schedulerFile).toContain("const benchmarkThresholdResult = (row: any) => {");
    expect(scheduledRiskSection).toContain('benchmarkThresholdResult(row)?.status === "behind"');
    expect(scheduledRiskSection).not.toContain("below 70% of benchmark");
  });

  it("documents GA4 background benchmark history ratings as distinct from live status", () => {
    const ga4JobsFile = readFileSync(
      join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"),
      "utf-8"
    );

    expect(ga4JobsFile).toContain("Historical performanceRating is a variance bucket for trend history");
    expect(ga4JobsFile).toContain("not the live");
    expect(ga4JobsFile).toContain("on_track / needs_attention / behind benchmark status");
  });

  it("guards the shared evaluated Benchmark route before reading campaign Benchmarks", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const firstRouteStart = routesFile.indexOf('app.get("/api/campaigns/:id/benchmarks/evaluated"');
    const sharedRouteStart = routesFile.indexOf('app.get("/api/campaigns/:id/benchmarks/evaluated"', firstRouteStart + 1);
    const sharedRouteEnd = routesFile.indexOf('app.post("/api/campaigns/:id/benchmarks"', sharedRouteStart);
    const sharedRoute = routesFile.slice(sharedRouteStart, sharedRouteEnd);

    expect(firstRouteStart).toBeGreaterThan(-1);
    expect(sharedRouteStart).toBeGreaterThan(firstRouteStart);
    expect(sharedRouteEnd).toBeGreaterThan(sharedRouteStart);
    expect(sharedRoute).toContain("const ok = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(sharedRoute.indexOf("ensureCampaignAccess")).toBeLessThan(sharedRoute.indexOf("storage.getCampaignBenchmarks(campaignId)"));
    expect(sharedRoute).toContain("return res.json({");
    expect(sharedRoute).toContain("success: true,");
    expect(sharedRoute).toContain("campaignId,");
    expect(sharedRoute).toContain("sessionIdUsed:");
    expect(sharedRoute).toContain("hasRevenueTracking,");
    expect(sharedRoute).toContain("benchmarks: evaluated,");
  });
});
