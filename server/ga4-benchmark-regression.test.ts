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
    const trackerEnd = ga4MetricsFile.indexOf("const insightsRollupRows", trackerStart);
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
    const trackerEnd = ga4MetricsFile.indexOf("const insightsRollupRows", trackerStart);
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
    expect(trackerSection).toContain("const consumerState = getBenchmarkConsumerState(b);");
    expect(trackerSection).toContain("insufficient += 1;");
    expect(trackerSection).toContain("unavailable, stale, pending, avgPct");
    expect(cardSection).toContain('const isInsufficient = consumerState.code === "insufficient_data";');
    expect(cardSection).toContain("const consumerState = getBenchmarkConsumerState(benchmark);");
    expect(cardSection).toContain("sufficiency.reason || \"This Benchmark needs more data before it can be scored.\"");
    expect(insightsSection).toContain("if (!getBenchmarkConsumerState(b).eligible) continue;");
    expect(reportSection).toContain("const sufficiency = getBenchmarkDataSufficiency(b);");
    expect(reportSection).toContain("Insufficient data -");
    expect(ga4MetricsFile).toContain("Some Benchmarks Need More Data");
  });

  it("fails every Benchmark consumer closed on unavailable, stale, loading, or failed source state", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const trackerStart = ga4MetricsFile.indexOf("const benchmarkTracker = useMemo(() => {");
    const trackerEnd = ga4MetricsFile.indexOf("const insightsRollupRows", trackerStart);
    const trackerSection = ga4MetricsFile.slice(trackerStart, trackerEnd);
    const reportStart = ga4MetricsFile.indexOf('sectionTitle("Performance Benchmarks"');
    const reportEnd = ga4MetricsFile.indexOf("renderAdsSection();", reportStart);
    const reportSection = ga4MetricsFile.slice(reportStart, reportEnd);
    const insightsStart = ga4MetricsFile.indexOf("const blockedBenchmarks =");
    const insightsEnd = ga4MetricsFile.indexOf("// 2b) Scheduler dependency", insightsStart);
    const insightsSection = ga4MetricsFile.slice(insightsStart, insightsEnd);
    const trafficStateStart = ga4MetricsFile.indexOf("const trafficKpiInputState");
    const kpiTrafficStateStart = ga4MetricsFile.indexOf("const kpiTrafficInputState", trafficStateStart);
    const benchmarkTrafficStateSection = ga4MetricsFile.slice(trafficStateStart, kpiTrafficStateStart);

    expect(ga4MetricsFile).toContain("isError: benchmarksError");
    expect(ga4MetricsFile).toContain("const benchmarkListState");
    expect(ga4MetricsFile).toContain("const getBenchmarkConsumerState = (benchmark: any) =>");
    expect(ga4MetricsFile).toContain("resolveGA4KpiLiveValue({");
    expect(benchmarkTrafficStateSection).toContain('(ga4DailyResp as any)?.refreshIsStale === true');
    expect(benchmarkTrafficStateSection).not.toContain("trendsRefreshIsStale");
    expect(trackerSection).toContain("if (!consumerState.eligible) continue;");
    expect(reportSection).toContain("const consumerState = getBenchmarkConsumerState(b);");
    expect(reportSection).toContain("Last-good value (not verified)");
    expect(insightsSection).toContain("const unverifiedBenchmarks");
    expect(insightsSection).toContain("No KPI or Benchmark performance conclusion is generated from these values.");
  });

  it("routes GA4 benchmark notifications to ga4-metrics benchmarks", () => {
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(benchmarkNotificationsFile).toContain('if (platform === "google_analytics") return `/campaigns/${campaignId}/ga4-metrics?tab=benchmarks&highlight=${id}`;');
    expect(benchmarkNotificationsFile).toContain("export async function checkBenchmarkPerformanceAlerts(): Promise<number> {");
  });

  it("fails stale GA4 Benchmark notifications closed before returning them", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const resolveNotificationBenchmarkAlertRowForRequest");
    expect(routesFile).toMatch(/resolveNotificationBenchmarkAlertRowForRequest[\s\S]*requireCurrentTrafficFreshness: true/);
    expect((routesFile.match(/resolveNotificationBenchmarkAlertRowForRequest\(benchmark, validationReadOnly\)/g) || []).length).toBe(2);
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
    expect(scheduledRiskSection).toContain('benchmarkThresholdResult(row).status === "behind"');
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

  it("keeps the current GA4 Benchmarks browser tab path locally pinned", () => {
    const appFile = readFileSync(
      join(process.cwd(), "client", "src", "App.tsx"),
      "utf-8"
    );
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    const tabStart = ga4MetricsFile.indexOf('<TabsContent value="benchmarks" id="ga4-benchmarks-section"');
    const tabEnd = ga4MetricsFile.indexOf('<TabsContent value="reports"', tabStart);
    const tabSection = ga4MetricsFile.slice(tabStart, tabEnd);
    const mutationsStart = ga4MetricsFile.indexOf("// Benchmark mutations");
    const mutationsEnd = ga4MetricsFile.indexOf("// Benchmark handlers", mutationsStart);
    const mutationsSection = ga4MetricsFile.slice(mutationsStart, mutationsEnd);
    const cardStart = ga4MetricsFile.indexOf("{benchmarks.map((benchmark) => {");
    const cardEnd = ga4MetricsFile.indexOf("No Benchmarks Yet", cardStart);
    const cardSection = ga4MetricsFile.slice(cardStart, cardEnd);
    const reportStart = ga4MetricsFile.indexOf('sectionTitle("Performance Benchmarks"');
    const reportEnd = ga4MetricsFile.indexOf("renderAdsSection();", reportStart);
    const reportSection = ga4MetricsFile.slice(reportStart, reportEnd);

    expect(appFile).toContain('<Route path="/campaigns/:id/ga4-metrics" component={GA4Metrics} />');
    expect(ga4MetricsFile).toContain('const VALID_GA4_TABS = ["overview", "kpis", "benchmarks", "campaigns", "insights", "reports"] as const;');
    expect(tabStart).toBeGreaterThan(-1);
    expect(tabEnd).toBeGreaterThan(tabStart);
    expect(mutationsStart).toBeGreaterThan(-1);
    expect(mutationsEnd).toBeGreaterThan(mutationsStart);
    expect(cardStart).toBeGreaterThan(-1);
    expect(cardEnd).toBeGreaterThan(cardStart);
    expect(reportStart).toBeGreaterThan(-1);
    expect(reportEnd).toBeGreaterThan(reportStart);

    expect(ga4MetricsFile).toContain('fetch(`/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(String(campaignId || ""))}`);');
    expect(mutationsSection).toContain('fetch("/api/benchmarks"');
    expect(mutationsSection).toContain('fetch(`/api/benchmarks/${benchmarkId}`');
    expect(mutationsSection).toContain('fetch(`/api/platforms/google_analytics/benchmarks/${benchmarkId}`');
    expect(mutationsSection).toContain('platformType: "google_analytics"');
    expect((mutationsSection.match(/await refreshNotificationQueries\(\);/g) || []).length).toBe(3);

    expect(tabSection).toContain("Some Benchmarks are Blocked");
    expect(tabSection).toContain("Some Benchmarks Need More Data");
    expect(cardSection).toContain('title="Edit Benchmark"');
    expect(cardSection).toContain('aria-label="Edit Benchmark"');
    expect(cardSection).toContain('title="Delete Benchmark"');
    expect(cardSection).toContain('aria-label="Delete Benchmark"');
    expect(cardSection).toContain("showCurrentValue ?");
    expect(cardSection).toContain("formatBenchmarkValue(getBenchmarkDisplayCurrentValue(benchmark), benchmark.unit)");

    expect(ga4MetricsFile).toContain('case "ratio":');
    expect(ga4MetricsFile).toContain('return `${numValue.toFixed(2)}x`;');
    expect(ga4MetricsFile).toContain("return formatPct(numValue);");
    expect(ga4MetricsFile).toContain("return formatMoney(numValue);");

    expect(ga4MetricsFile).toContain('const selectedCustomBenchmarkIds = reportType === "custom"');
    expect(reportSection).toContain("const items = (Array.isArray(benchmarks) ? benchmarks : []).filter");
    expect(reportSection).toContain("selectedCustomBenchmarkIds.has(String(b.id))");
    expect(reportSection).toContain("formatBenchmarkValue(currentLive");
    expect(reportSection).toContain("formatBenchmarkValue((b as any)?.benchmarkValue");
    expect(reportSection).toContain("Blocked");
    expect(reportSection).toContain("Insufficient data -");
  });

  it("classifies GA4 industry Benchmark targets as helper-only unless explicitly certified", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );
    const routeStart = routesFile.indexOf('app.get("/api/industry-benchmarks/:industry/:metric"');
    const routeEnd = routesFile.indexOf("  // Campaign routes", routeStart);
    const routeSection = routesFile.slice(routeStart, routeEnd);
    const modalStart = ga4MetricsFile.indexOf('<TabsContent value="benchmarks" id="ga4-benchmarks-section"');
    const modalEnd = ga4MetricsFile.indexOf('<TabsContent value="reports"', modalStart);
    const modalSection = ga4MetricsFile.slice(modalStart, modalEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(routeSection).toContain('certificationStatus: "non_production_helper"');
    expect(routeSection).toContain('certificationStatus: "uncertified_static_reference"');
    expect(routeSection).toContain('targetSourceCertified: false');
    expect(routeSection).toContain('disclaimer: "Demo-only mock dataset. Not licensed/audited."');
    expect(routeSection).toContain('source: "mock"');

    expect(modalStart).toBeGreaterThan(-1);
    expect(modalEnd).toBeGreaterThan(modalStart);
    expect(modalSection).toContain('data?.targetSourceCertified === true && typeof data.value !== "undefined"');
    expect(modalSection).toContain('industry benchmark for the new metric only when the response is certified for production targets.');
    expect(modalSection).not.toContain('industry standards');
    expect(ga4MetricsFile).toContain('Track and measure performance against custom targets');
    expect(ga4MetricsFile).toContain('Create your first benchmark to start tracking performance against your targets');
    expect(ga4MetricsFile).toContain('chips: ["Targets", "Historical", "Goals"],');
  });

  it("keeps the historical certification bounded and locks the current production certification", () => {
    const record = JSON.parse(readFileSync(
      join(process.cwd(), "GA4", "certifications", "ga4-benchmarks.json"),
      "utf-8",
    ));
    const readiness = readFileSync(
      join(process.cwd(), "GA4", "BENCHMARKS_PRODUCTION_READINESS.md"),
      "utf-8",
    );

    expect(record).toMatchObject({
      sectionId: "ga4-benchmarks",
      betaReadinessStatus: "BETA_READY",
      productionCertificationStatus: "PRODUCTION_READY",
      reviewedBaseGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      reviewedImplementationGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      certifiedGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      candidateRevision: {
        baseGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
        runtimeGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
        deployedEvidenceGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
        currentDeployedGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
        currentDeploymentChangeClass: "exact_sha_documentation_reconciliation_on_revalidated_runtime",
        status: "PRODUCTION_READY",
      },
      previousCertification: {
        status: "PRODUCTION_READY",
        certifiedGitSha: "892ff3396ec9c9332008128897e5703cc6bb3817",
      },
    });
    expect(readiness).toContain("<!-- ga4-benchmark-production-certification-status: PRODUCTION_READY -->");
    expect(readiness).toContain("<!-- ga4-benchmark-beta-readiness-status: BETA_READY -->");
    expect(record.productionOnlyEvidenceOutstanding).toEqual([]);
    expect(record.dependencyBoundary).toEqual(expect.arrayContaining([
      "server/analytics.ts",
      "server/utils/ga4-alert-current-value.ts",
    ]));
    expect(record.currentLocalReleaseCandidateGate).toMatchObject({
      status: "complete_for_exact_sha_revalidation",
      implementationGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      focusedFilesPassed: 16,
      focusedTestsPassed: 185,
      typescriptCheck: "passed",
      productionBuild: "passed",
    });
    expect(record.currentDeployedReleaseCandidateGate).toMatchObject({
      status: "complete_for_exact_sha_revalidation",
      implementationGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      deployedEvidenceGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      currentDeployedGitSha: "12789c1ebb92dd6a905a9f2f0f877f0bc6a90627",
      currentDeploymentChangeClass: "exact_sha_documentation_reconciliation_on_revalidated_runtime",
      mode: "read_only_application_data",
      campaignCount: 2,
      benchmarkCount: 4,
      failureCount: 0,
      applicationMutationAttempts: 0,
      staleFailClosedEvidence: {
        refreshIsStale: true,
        validationReadOnly: true,
        dataThroughDate: "2026-08-20",
        latestStoredDailyDate: "2026-08-10",
        oldestDueMissingDailyDate: "2026-08-11",
      },
    });
    expect(record.laterNaturalSchedulerEvidence).toMatchObject({
      deployedGitSha: "85f5233ebfc298afc35f4c24e0930c1a66fbd07c",
      globalAllCampaignSchedulerHealthClaimed: false,
      benchmarkBoundaryResult: {
        benchmarksUpdated: 2,
        benchmarksSkipped: 0,
        benchmarksFailed: 0,
        underlyingDailyRowsSchedulerWritten: 22,
        laterApplicationRepairDetected: false,
      },
    });
    expect(record.activeProductionCertificationCommits).toContainEqual(expect.objectContaining({
      id: 14,
      status: "complete",
    }));
    expect(record.scope).toContain("Reports generation, scheduling, delivery, attachments, and inbox receipt are outside this Benchmark certification");
    expect(readiness).toContain("lastRunTrigger = scheduled");
    expect(readiness).toContain("2026-08-14T20:35:00.001Z");
    expect(readiness).toContain("17 excluded obsolete campaigns");
  });

  it("keeps deployed consumer parity certification read-only and complete", () => {
    const validator = readFileSync(
      join(process.cwd(), "scripts", "ga4-benchmark-beta-clearance-readonly.ts"),
      "utf-8",
    );

    expect(validator).toContain('await client.query("BEGIN TRANSACTION READ ONLY")');
    expect(validator).toContain('if (route.request().method() !== "GET")');
    expect(validator).toContain('await api(page, "/api/notifications?readOnly=1")');
    expect(validator).toContain('/ga4-metrics?tab=benchmarks&readOnly=1');
    expect(validator).toContain('url.searchParams.get("days") !== "30"');
    expect(validator).toContain("dailyFreshness?.refreshIsStale === true");
    expect(validator).toContain("expectedConsumerStateById");
    expect(validator).toContain("staleFailClosed");
    expect(validator).toContain('getByRole("tab", { name: "Insights", exact: true }).click()');
    expect(validator).toContain("await pdfText(await downloadBuffer(download))");
    expect(validator).toContain("/send-events");
    expect(validator).toContain("/snapshots");
    expect(validator).toContain("scheduledArtifactValueParity");
    expect(validator).toContain("scheduledArtifactCapturedValueEvidence");
    expect(validator).not.toContain("(!scheduledArtifactMetadataParity || !scheduledArtifactValueParity)");
    expect(validator).toContain("scheduledArtifactCorrectlyFailClosed");
    expect(validator).toContain('latestEvent?.status === "pending_delivery"');
    expect(validator).toContain("scheduledArtifactPdfFetchAttempted: false");
    expect(validator).toContain("performs a persisted GA4 KPI/Benchmark recompute");
    expect(validator).not.toContain('api(page, `/api/report-snapshots/');
  });

  it("keeps authorized Commit 13 report validation scoped and reversible", () => {
    const validator = readFileSync(
      join(process.cwd(), "scripts", "ga4-benchmark-commit13-authorized-validation.ts"),
      "utf-8",
    );

    expect(validator).toContain("GA4_BENCHMARK_AUTHORIZED_RECIPIENT");
    expect(validator).toContain("GA4_BENCHMARK_BETA_EXPECTED_SHA");
    expect(validator).toContain("createManualArtifact");
    expect(validator).toContain("waitForScheduledArtifact");
    expect(validator).toContain('scheduledDeliveryState: "pending_delivery"');
    expect(validator).toContain("productionConfigurationRestored: true");
    expect(validator).toContain("existingProviderResponseIds");
    expect(validator).not.toContain("created_at >= $2");
    expect(validator).toContain("restoreViaDatabaseIfStillTemporary");
    expect(validator).toContain("Restored configuration hash mismatch");
  });
});
