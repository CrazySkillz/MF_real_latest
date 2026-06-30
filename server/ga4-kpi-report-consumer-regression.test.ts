import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 KPI report consumer regression guards", () => {
  it("fails scheduled GA4 report sends closed when KPI recompute does not process the target campaign", () => {
    const source = readFileSync(join(process.cwd(), "server", "report-scheduler.ts"), "utf-8");
    const preflightStart = source.indexOf("export async function preflightGA4ReportKPIConsumers");
    const preflightEnd = source.indexOf("const CUSTOM_INTEGRATION_REPORT_METRICS", preflightStart);
    const preflight = source.slice(preflightStart, preflightEnd);
    const sendStart = source.indexOf("const ga4Preflight = await preflightGA4ReportKPIConsumers(report, windowEnd)");
    const sendEnd = source.indexOf("const pdfBuffer = await buildPdfAttachmentForReport", sendStart);
    const sendGuard = source.slice(sendStart, sendEnd);

    expect(preflight).toContain('toLowerCase() !== "google_analytics"');
    expect(preflight).toContain("runGA4DailyKPIAndBenchmarkJobs({ campaignId, ...(date ? { date } : {}), ...(opts?.suppressAlerts ? { suppressAlerts: true } : {}) })");
    expect(preflight).toContain("campaignsProcessed");
    expect(preflight).toContain("reportIncludesGA4BenchmarkSection(report)");
    expect(preflight).toContain('storage.getPlatformBenchmarks("google_analytics", campaignId)');
    expect(preflight).toContain("benchmarkIdsUpdated");
    expect(preflight).toContain("GA4 KPI/Benchmark recompute skipped target campaign");
    expect(preflight).toContain("GA4 Benchmark recompute skipped selected Benchmark rows");
    expect(sendGuard).toContain("preflightGA4ReportKPIConsumers(report, windowEnd)");
    expect(sendGuard).toContain('status: "failed"');
    expect(sendGuard).toContain("skipped scheduled report");
    expect(sendGuard).toContain("continue;");
  });

  it("requires GA4 report PDF output for scheduled and test-send report paths", () => {
    const source = readFileSync(join(process.cwd(), "server", "report-scheduler.ts"), "utf-8");
    const sourceBackedStart = source.indexOf("function platformRequiresSourceBackedReportOutput");
    const sourceBackedEnd = source.indexOf("const CUSTOM_INTEGRATION_REPORT_METRICS", sourceBackedStart);
    const sourceBacked = source.slice(sourceBackedStart, sourceBackedEnd);
    const testSendStart = source.indexOf("export async function sendTestReport");
    const testSendEnd = source.indexOf("const safeName =", testSendStart);
    const testSend = source.slice(testSendStart, testSendEnd);

    expect(sourceBacked).toContain('normalized === "google_analytics"');
    expect(sourceBacked).toContain('normalized === "instagram"');
    expect(sourceBacked).toContain('normalized === "tiktok"');
    expect(sourceBacked).toContain('normalized === "google_sheets"');
    expect(sourceBacked).toContain('"GA4"');
    expect(testSend).toContain("preflightGA4ReportKPIConsumers(report, windowEnd, { suppressAlerts: true })");
    expect(testSend).toContain("test report skipped");
    expect(testSend.indexOf("preflightGA4ReportKPIConsumers(report, windowEnd, { suppressAlerts: true })")).toBeLessThan(testSend.indexOf("buildPdfAttachmentForReport"));
  });

  it("keeps manual GA4 report snapshots from being inserted without preflight and PDF output", () => {
    const source = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const route = source.slice(
      source.indexOf('app.post("/api/platforms/:platformType/reports/:reportId/snapshots"'),
      source.indexOf('app.get("/api/report-snapshots/:snapshotId"')
    );

    expect(route).toContain('sourceBackedReportPlatform === "google_analytics"');
    expect(route).toContain("preflightGA4ReportKPIConsumers(existing, windowEnd, { suppressAlerts: true })");
    expect(route).toContain("GA4");
    expect(route).toContain("snapshot not created");
    expect(route.indexOf("preflightGA4ReportKPIConsumers(existing, windowEnd, { suppressAlerts: true })")).toBeLessThan(route.indexOf("const buf = await buildPdfAttachmentForReport"));
    expect(route.indexOf("const buf = await buildPdfAttachmentForReport")).toBeLessThan(route.indexOf(".insert(reportSnapshots as any)"));
  });

  it("preflights direct GA4 snapshot PDF downloads before regenerating current KPI values", () => {
    const source = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const route = source.slice(
      source.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'),
      source.indexOf("// Get single benchmark")
    );

    expect(route).toContain("preflightGA4ReportKPIConsumers(okReport, undefined, { suppressAlerts: true })");
    expect(route).toContain("snapshot PDF not generated");
    expect(route.indexOf("preflightGA4ReportKPIConsumers(okReport, undefined, { suppressAlerts: true })")).toBeLessThan(route.indexOf("const buf = await buildPdfAttachmentForReport"));
  });

  it("fails GA4 KPI-section PDF generation when persisted KPI rows cannot be read", () => {
    const source = readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");
    const includesStart = source.indexOf("const reportIncludesKPISection");
    const includesEnd = source.indexOf("const normalizeCampaignKey", includesStart);
    const includes = source.slice(includesStart, includesEnd);
    const payloadStart = source.indexOf("async function buildGA4ReportPayload");
    const payloadEnd = source.indexOf("const ga4ToDate =", payloadStart);
    const payload = source.slice(payloadStart, payloadEnd);

    expect(includes).toContain('reportType === "kpis"');
    expect(includes).toContain("cfg.sections?.kpis");
    expect(includes).toContain("cfg.subsections?.kpis?.items");
    expect(includes).toContain("cfg.selectedKpiIds.length > 0");
    expect(payload).toContain("const loadPlatformKPIs = reportIncludesKPISection(report)");
    expect(payload).toContain('? storage.getPlatformKPIs("google_analytics", campaignId)');
    expect(payload).toContain(': storage.getPlatformKPIs("google_analytics", campaignId).catch(() => [] as any[])');
  });

  it("preserves alert side effects for scheduled preflight only", () => {
    const jobsSource = readFileSync(join(process.cwd(), "server", "ga4-kpi-benchmark-jobs.ts"), "utf-8");
    const schedulerSource = readFileSync(join(process.cwd(), "server", "report-scheduler.ts"), "utf-8");
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const sendStart = schedulerSource.indexOf("const ga4Preflight = await preflightGA4ReportKPIConsumers(report, windowEnd);");
    const testStart = schedulerSource.indexOf("preflightGA4ReportKPIConsumers(report, windowEnd, { suppressAlerts: true })");

    expect(jobsSource).toContain("if (opts?.campaignId && processed > 0 && !opts?.suppressAlerts)");
    expect(sendStart).toBeGreaterThan(-1);
    expect(testStart).toBeGreaterThan(-1);
    expect(routesSource).toContain("preflightGA4ReportKPIConsumers(existing, windowEnd, { suppressAlerts: true })");
    expect(routesSource).toContain("preflightGA4ReportKPIConsumers(okReport, undefined, { suppressAlerts: true })");
  });

  it("documents GA4 report refresh as fail-closed instead of best-effort", () => {
    const refreshDoc = readFileSync(join(process.cwd(), "GA4", "REFRESH_AND_PROCESSING.md"), "utf-8");
    const readinessDoc = readFileSync(join(process.cwd(), "GA4", "KPIS_PRODUCTION_READINESS.md"), "utf-8");

    expect(refreshDoc).toContain("scheduled/server-generated GA4 reports and direct GA4 snapshot PDF downloads fail closed");
    expect(refreshDoc).toContain("manual snapshot creation, and direct GA4 snapshot PDF download must not continue when GA4 KPI/Benchmark preflight recompute fails");
    expect(readinessDoc).toContain("manual GA4 report snapshots are not inserted unless GA4 preflight recompute and PDF generation succeed");
    expect(readinessDoc).toContain("GA4 KPI-section PDF generation fails closed when persisted KPI rows cannot be read");
    expect(readinessDoc).toContain("direct GA4 snapshot PDF preflight fix");
  });
});
