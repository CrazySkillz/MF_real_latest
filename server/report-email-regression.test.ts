import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  isValidReportScheduleDayOfMonth,
  isValidReportScheduleDayOfWeek,
  isValidReportScheduleFrequency,
  isValidReportScheduleQuarterTiming,
  isValidReportScheduleTime,
  isValidReportScheduleTimeZone,
} from "./routes-oauth";

const REPORT_SCHEDULER_FILE = join(__dirname, "report-scheduler.ts");
const GA4_SCHEDULED_PDF_FILE = join(__dirname, "ga4-scheduled-report-pdf.ts");

function readReportScheduler(): string {
  return readFileSync(REPORT_SCHEDULER_FILE, "utf-8");
}

describe("scheduled report email regression guard", () => {
  it("keeps the scheduled report email body focused on the attached report", () => {
    const source = readReportScheduler();

    expect(source).toContain("Your scheduled MimoSaaS report is attached.");
    expect(source).toContain("deliverableSubject");
    expect(source).toContain("subject: deliverableSubject");
    expect(source).toContain('const html = text.replace(/\\n/g, "<br>")');
    expect(source).toContain("text,");
    expect(source).toContain("Frequency: ${frequencyLabel}");
    expect(source).toContain("Report Type: ${reportLabel}");
    expect(source).toContain("Generated: ${generatedAt}");
    expect(source).toContain("MimoSaaS report attached:");
    expect(source).not.toContain("subject,");
    expect(source).not.toContain("box-shadow:");
    expect(source).not.toContain("report-info");
    expect(source).not.toContain("View Report in Dashboard");
    expect(source).not.toContain("<span class=\"info-label\">Window:");
    expect(source).not.toContain("<div class=\"header\">");
    expect(source).not.toContain("Overview Report</h1>");
    expect(source).not.toContain("Daily Report Delivery");
    expect(source).not.toContain("Your scheduled MetricMind report is ready.");
    expect(source).not.toContain("subject: `");
    expect(source).not.toContain("Executive Marketing Analytics");
    expect(source).not.toContain("latest available data");
    expect(source).not.toContain("automated email");
  });

  it("keeps scheduled report emails wired to attach generated PDFs", () => {
    const source = readReportScheduler();

    expect(source).toContain("PDF attachment bytes:");
    expect(source).toContain("attachments: meta?.attachment");
    expect(source).toContain("contentType: 'application/pdf'");
    expect(source).toContain("GA4 PDF builder failed; refusing generic fallback");
    expect(source).toContain("Refusing generic fallback for GA4");
    expect(source).toContain("Refusing to send report");
  });

  it("creates scheduled report snapshots only after a successful send", () => {
    const source = readReportScheduler();
    const sendIndex = source.indexOf("let sent = await sendReportEmailWithRetry");
    const snapshotInsertIndex = source.indexOf(".insert(reportSnapshots)", sendIndex);
    const sendEventUpdateIndex = source.indexOf(".update(reportSendEvents)", snapshotInsertIndex);

    expect(sendIndex).toBeGreaterThan(-1);
    expect(snapshotInsertIndex).toBeGreaterThan(sendIndex);
    expect(sendEventUpdateIndex).toBeGreaterThan(snapshotInsertIndex);
    expect(source).toContain("const [snap] = sent");
  });

  it("keeps optional GA4 scheduled PDF fallbacks but fails closed for selected Overview sections", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");

    expect(source).toContain("[GA4 Scheduled PDF]");
    expect(source).toContain("checking persisted fallback");
    expect(source).toContain('return { rows: [] };');
    expect(source).toContain("return { totals: {} };");
    expect(source).toContain("const getOverviewReportRequirements = (report: any) => {");
    expect(source).toContain('subsections.summary === true');
    expect(source).toContain('subsections.revenue === true || subsections.performance === true');
    expect(source).toContain("const failedParts = new Set<string>();");
    expect(source).toContain("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE:");
    expect(source).toContain('failedParts.has("revenue breakdown")');
    expect(source).toContain('failedParts.has("spend breakdown")');
    expect(source).toContain('failedParts.has("landing pages")');
    expect(source).toContain('failedParts.has("conversion events")');
  });

  it("keeps browser and server GA4 Reports on the authoritative cumulative Summary boundary", () => {
    const browserSource = readFileSync(join(__dirname, "../client/src/pages/ga4-metrics.tsx"), "utf-8");
    const serverSource = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");

    expect(browserSource).toContain("const sess = Number(overviewSummaryTotals?.sessions || 0);");
    expect(browserSource).not.toContain("const sess = Number(dailySummedTotals?.sessions || 0);");
    expect(serverSource).toContain("const reportCumulativeWindow = resolveGA4ImportToDateWindow(");
    expect(serverSource).toContain("GA4_REPORT_CUMULATIVE_WINDOW_UNAVAILABLE");
    expect(serverSource).toContain("const overviewStartDate = reportCumulativeWindow.startDate;");
    expect(serverSource).toContain("const financialStartDate = toISODateUTC((campaign as any)?.startDate)");
    expect(serverSource).toContain('|| toISODateUTC((campaign as any)?.createdAt)');
    expect(serverSource).toContain("const financialEndDate = reportCumulativeWindow.endDate;");
    expect(serverSource).toContain('const spendSourceStartDate = "1900-01-01";');
    expect(serverSource).toContain('storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, financialEndDate, "ga4")');
    expect(serverSource).toContain('const importedRevenueStartDate = "1900-01-01";');
    expect(serverSource).toContain("const importedRevenueEndDate = new Date().toISOString().slice(0, 10);");
    expect(serverSource).not.toContain("lookbackDays === 30 ? GA4_OVERVIEW_LEGACY_IMPORT_START_DATE : dailyStart");
    expect(serverSource).not.toContain("Window: ${windowStart} to ${windowEnd} (UTC)");
  });

  it("labels GA4 scheduled Campaign Breakdown revenue by the actual mixed-source value", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");
    const campaignBreakdownBlock = source.slice(
      source.indexOf('"Campaign Breakdown"'),
      source.indexOf("payload.campaignBreakdownAgg", source.indexOf('"Campaign Breakdown"'))
    );

    expect(campaignBreakdownBlock).toContain('["CAMPAIGN", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE", "REVENUE"]');
    expect(campaignBreakdownBlock).not.toContain("GA4 REVENUE");
  });

  it("fails scheduled GA4 Reports closed when active imported revenue is not materialized", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");
    const guardStart = source.indexOf("const overviewRequirements = getOverviewReportRequirements(report);");
    const guardEnd = source.indexOf("const lastDailyRefreshAt", guardStart);
    const guardSection = source.slice(guardStart, guardEnd);

    expect(guardStart).toBeGreaterThan(-1);
    expect(guardEnd).toBeGreaterThan(guardStart);
    expect(guardSection).toContain("const activeRevenueSources = revenueSources.filter(");
    expect(guardSection).toContain("const hasMaterializedRevenue = (row: any) => row?.revenue != null && Number.isFinite(Number(row.revenue));");
    expect(guardSection).toContain("revenueBreakdown.filter(hasMaterializedRevenue).map");
    expect(guardSection).toContain("adComparisonRevenueBreakdown.filter(hasMaterializedRevenue).map");
    expect(guardSection).toContain("const revenueBreakdownSourceIds = new Set(");
    expect(guardSection).toContain("const adComparisonRevenueBreakdownSourceIds = new Set(");
    expect(guardSection).toContain("const overviewMaterializedRevenueUnavailable = activeRevenueSources.some(");
    expect(guardSection).toContain("const adComparisonMaterializedRevenueUnavailable = activeRevenueSources.some(");
    expect(guardSection).toContain('!revenueBreakdownSourceIds.has(String(source?.id || ""))');
    expect(guardSection).toContain('!adComparisonRevenueBreakdownSourceIds.has(String(source?.id || ""))');
    expect(guardSection).toContain("overviewRequirements.revenue && overviewMaterializedRevenueUnavailable");
    expect(guardSection).toContain("adComparisonRequirements.revenueBreakdown && adComparisonMaterializedRevenueUnavailable");
    expect(source).not.toContain("formatMoney(Number(source?.revenue || 0))");
    expect(source).not.toContain(".filter((source: any) => source?.revenue != null)");
  });

  it("discloses the mixed Campaign Breakdown window in scheduled GA4 Reports", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");
    const breakdownStart = source.indexOf("if (includeCampaignBreakdown)");
    const breakdownEnd = source.indexOf("if (includeLandingPages)", breakdownStart);
    const breakdownSection = source.slice(breakdownStart, breakdownEnd);

    expect(breakdownStart).toBeGreaterThan(-1);
    expect(breakdownEnd).toBeGreaterThan(breakdownStart);
    expect(breakdownSection).toContain(
      "GA4 metrics: last ${lookbackDays} completed days; Revenue includes exact campaign-matched source-to-date imports.",
    );
  });

  it("keeps GA4 scheduled Total Revenue on the selected scoped financial source", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");

    expect(source).toContain("const breakdownFinancialTotals = {");
    expect(source).toContain("const ga4ToDateFinancialTotals = {");
    expect(source).toContain("const ga4FinancialCandidates = hasImportedRevenueSource");
    expect(source).toContain("? [(ga4ToDate as any)?.totals]");
    expect(source).toContain(": [(ga4ToDate as any)?.totals, dailyRows.length > 0 ? dailySummedTotals : null, hasBreakdownOverviewTotals ? breakdownFinancialTotals : null];");
    expect(source).toContain("selectGA4FinancialTotalsSource(ga4FinancialCandidates, ga4ToDateFinancialTotals)");
    expect(source).toContain("const ga4RevenueForFinancials = Number(ga4FinancialTotalsSource.revenue || 0);");
    expect(source).toContain("const financialConversions = Number(ga4FinancialTotalsSource.conversions || 0);");
    expect(source).not.toContain("const financialConversions = Number(breakdownTotals.conversions || 0);");
    expect(source).not.toContain("const ga4RevenueForFinancials = Math.max(Number((ga4ToDate as any)?.totals?.revenue || 0), Number(dailySummedTotals.revenue || 0));");
    expect(source).not.toContain("const financialConversions = Math.max(Number((ga4ToDate as any)?.totals?.conversions || 0), Number(dailySummedTotals.conversions || 0));");
  });
  it("keeps GA4 scheduled Ad Comparison revenue provenance aligned with live output", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");
    const adsStart = source.indexOf("if (sections.ads)");
    const adsEnd = source.indexOf("if (sections.insights)", adsStart);
    const adsSection = source.slice(adsStart, adsEnd);

    expect(adsStart).toBeGreaterThan(-1);
    expect(adsEnd).toBeGreaterThan(adsStart);
    expect(source).toContain("resolveGA4ImportToDateWindow");
    expect(source).toContain("const adComparisonWindow = adComparisonRequirements.included");
    expect(source).toContain("adComparisonWindow.startDate");
    expect(source).toContain('const importedRevenueStartDate = "1900-01-01";');
    expect(source).toContain("'GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: '");
    expect(adsSection).toContain("const nativeRevenue = Number(Number(row?.revenue || 0).toFixed(2));");
    expect(adsSection).toContain("payload.adComparisonBreakdownAgg");
    expect(adsSection).toContain("Top Campaigns by ${metricLabels[selectedMetric]}");
    expect(adsSection).toContain("Campaigns Compared");
    expect(adsSection).toContain("payload.adComparisonSourceRevenueBreakdowns.get");
    expect(adsSection).toContain("GA4 Revenue (Imported to Date)");
    expect(adsSection).toContain("const allCampaignRows = rows.map");
    expect(adsSection).not.toContain("rows.slice(0, 20)");
    expect(adsSection).not.toContain("Unallocated External Revenue");
    expect(adsSection).not.toContain("Total Revenue (All Sources)");
    expect(adsSection).toContain("source-to-date; excluded from ranking");
    expect(adsSection).toContain("payload.sourceRevenueBreakdowns.get(String(source?.sourceId || \"\"))");
  });

  it("keeps report test-send aligned with Mailgun HTTP API configuration", () => {
    const schedulerSource = readReportScheduler();
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const testSendRoute = routesSource.slice(
      routesSource.indexOf('app.post("/api/platforms/:platformType/reports/:reportId/send-test"'),
      routesSource.indexOf("// Report snapshots (immutable history)")
    );

    expect(schedulerSource).toContain("process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN");
    expect(schedulerSource).toContain("For Mailgun API: MAILGUN_API_KEY, MAILGUN_DOMAIN");
    expect(testSendRoute).toContain("ensurePlatformReportAccess(req as any, res as any, reportId)");
    expect(testSendRoute).toContain("sendTestReport(reportId)");
    expect(testSendRoute).not.toContain("hasEmailConfig");
    expect(testSendRoute).not.toContain("MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS");
  });

  it("keeps direct report snapshot reads scoped to the owning report campaign and platform", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const snapshotReadRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/report-snapshots/:snapshotId"'),
      routesSource.indexOf("// Download a snapshot PDF")
    );
    const snapshotPdfRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'),
      routesSource.indexOf("// Get single benchmark")
    );

    for (const route of [snapshotReadRoute, snapshotPdfRoute]) {
      expect(route).toContain("ensurePlatformReportAccess");
      expect(route).toContain("snapshotCampaignId !== reportCampaignId");
      expect(route).toContain("snapshotPlatform !== reportPlatform");
      expect(route).toContain('error: "Snapshot not found"');
    }
  });

  it("keeps direct snapshot PDF downloads on the shared report PDF builder", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const snapshotPdfRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'),
      routesSource.indexOf("// Get single benchmark")
    );

    expect(snapshotPdfRoute).toContain("buildPdfAttachmentForReport");
    expect(snapshotPdfRoute).toContain('filename="mimosaas_report_${snapshotId}.pdf"');
    expect(snapshotPdfRoute).not.toContain("MetricMind Report Snapshot");
    expect(snapshotPdfRoute).not.toContain("metricmind_report_");
    expect(snapshotPdfRoute).not.toContain("This PDF is generated from an immutable snapshot.");
  });

  it("fails closed before rebuilding a snapshot PDF after its report type changes", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const snapshotPdfRoute = routesSource.slice(
      routesSource.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'),
      routesSource.indexOf("// Get single benchmark")
    );

    expect(snapshotPdfRoute).toContain("snapshotReportType !== reportReportType");
    expect(snapshotPdfRoute.indexOf("snapshotReportType !== reportReportType"))
      .toBeLessThan(snapshotPdfRoute.indexOf("preflightGA4ReportKPIConsumers"));
  });

  it("proves source-backed manual report snapshots have PDF output before insertion", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const manualSnapshotRoute = routesSource.slice(
      routesSource.indexOf('app.post("/api/platforms/:platformType/reports/:reportId/snapshots"'),
      routesSource.indexOf('app.get("/api/report-snapshots/:snapshotId"')
    );

    expect(manualSnapshotRoute).toContain('sourceBackedReportPlatform === "instagram"');
    expect(manualSnapshotRoute).toContain('sourceBackedReportPlatform === "tiktok"');
    expect(manualSnapshotRoute).toContain('sourceBackedReportPlatform === "google_sheets"');
    expect(manualSnapshotRoute).toContain('sourceBackedReportPlatform === "custom-integration"');
    expect(manualSnapshotRoute).toContain('sourceBackedReportPlatform === "custom_integration"');
    expect(manualSnapshotRoute).toContain("buildPdfAttachmentForReport");
    expect(manualSnapshotRoute).toContain("Custom Integration");
    expect(manualSnapshotRoute).toContain("${label} source-backed PDF output unavailable; snapshot not created");
    expect(manualSnapshotRoute.indexOf("buildPdfAttachmentForReport")).toBeLessThan(manualSnapshotRoute.indexOf(".insert(reportSnapshots as any)"));
  });

  it("keeps legacy Meta/Google Ads report updates from changing report ownership", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const metaUpdateRoute = routesSource.slice(
      routesSource.indexOf('app.patch("/api/meta/reports/:reportId"'),
      routesSource.indexOf("/**\n   * Delete Meta report")
    );

    expect(metaUpdateRoute).toContain("ensureCampaignAccess");
    expect(metaUpdateRoute).toContain("existingReport.campaignId");
    expect(metaUpdateRoute).toContain("delete updates.campaignId");
    expect(metaUpdateRoute).toContain("delete updates.platformType");
    expect(metaUpdateRoute).toContain("delete updates.createdAt");
    expect(metaUpdateRoute).toContain("delete updates.updatedAt");
  });

  it("keeps Mailgun report delivery using explicit recipients and text fallback", () => {
    const source = readFileSync(join(process.cwd(), "server", "services", "email-service.ts"), "utf-8");

    expect(source).toContain("normalizeRecipients");
    expect(source).toContain("for (const recipient of recipients) fd.append('to', recipient)");
    expect(source).toContain("for (const recipient of recipients) formData.append('to', recipient)");
    expect(source).toContain("const textBody = options.text || this.stripHtml(options.html)");
    expect(source).toContain("fd.append('o:tracking', 'no')");
    expect(source).toContain("fd.append('o:tracking-clicks', 'no')");
    expect(source).toContain("fd.append('o:tracking-opens', 'no')");
    expect(source).toContain("formData.append('o:tracking', 'no')");
    expect(source).toContain("formData.append('o:tracking-clicks', 'no')");
    expect(source).toContain("formData.append('o:tracking-opens', 'no')");
  });

  it("does not report Mailgun test-send success until delivery is confirmed", () => {
    const schedulerSource = readReportScheduler();
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const testSendSource = schedulerSource.slice(
      schedulerSource.indexOf("export async function sendTestReport"),
      schedulerSource.indexOf("export function startReportScheduler"),
    );

    expect(schedulerSource).toContain("waitForMailgunDelivery");
    expect(testSendSource).toContain("const deliveryConfirmation = await confirmScheduledReportEmailDelivery(reportId)");
    expect(testSendSource).not.toContain("const delivery = await waitForMailgunDelivery(");
    expect(testSendSource).toContain('deliveryConfirmation.status === "pending_delivery" ? "pending"');
    expect(routesSource).toContain("deliveryStatus: result.deliveryStatus");
    expect(routesSource).not.toContain("Test report email sent successfully! Check your inbox.");
  });

  it("does not describe non-Mailgun provider acceptance as confirmed delivery", () => {
    const source = readReportScheduler();
    const successFlag = source.indexOf("success: true", source.indexOf("export async function sendTestReport"));
    const successStart = source.lastIndexOf("return {", successFlag);
    const successBlock = source.slice(
      successStart,
      source.indexOf("};", successFlag),
    );

    expect(successFlag).toBeGreaterThan(-1);
    expect(successStart).toBeGreaterThan(-1);
    expect(successBlock).toContain('audit.provider === "mailgun-api"');
    expect(successBlock).toContain("Test report email accepted by the provider; delivery was not confirmed");
    expect(successBlock).toContain('deliveryStatus: audit.provider === "mailgun-api" ? "delivered" : "accepted"');
    expect(successBlock).not.toContain('message: "Test report email delivered successfully"');
  });

  it("does not create scheduled Mailgun snapshots until delivery is confirmed", () => {
    const source = readReportScheduler();
    const confirmationBlock = source.slice(
      source.indexOf("async function confirmScheduledReportEmailDelivery"),
      source.indexOf("function coercePdfBufferFromDoc")
    );
    const sendIndex = source.indexOf("let sent = await sendReportEmailWithRetry");
    const deliveryConfirmIndex = source.indexOf("const deliveryConfirmation = await confirmScheduledReportEmailDelivery", sendIndex);
    const snapshotInsertIndex = source.indexOf(".insert(reportSnapshots)", deliveryConfirmIndex);

    expect(confirmationBlock).toContain('audit.provider !== "mailgun-api"');
    expect(confirmationBlock).toContain("waitForMailgunDelivery(");
    expect(confirmationBlock).toContain("audit.providerResponseId,");
    expect(confirmationBlock).toContain("audit.mailgunRegion ? { region: audit.mailgunRegion } : {}");
    expect(confirmationBlock).toContain('delivery.status === "delivered"');
    expect(confirmationBlock).toContain('"pending_delivery"');
    expect(sendIndex).toBeGreaterThan(-1);
    expect(deliveryConfirmIndex).toBeGreaterThan(sendIndex);
    expect(snapshotInsertIndex).toBeGreaterThan(deliveryConfirmIndex);
    expect(source).toContain("status: sendEventStatus");
  });

  it("keeps report test-send fail-closed for missing campaign ownership", () => {
    const source = readReportScheduler();

    expect(source).toContain("const reportCampaignId = String((report as any)?.campaignId || \"\").trim()");
    expect(source).toContain("Report campaign is missing");
    expect(source).toContain("Campaign not found; test report skipped");
    expect(source).toContain("Campaign lookup failed; test report skipped");
  });

  it("requires recipients when saving scheduled platform reports", () => {
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(routesSource).toContain('const REPORT_SCHEDULE_FREQUENCIES = new Set(["daily", "weekly", "monthly", "quarterly"])');
    expect(routesSource.match(/isValidReportScheduleFrequency\(freq\)/g)).toHaveLength(2);
    expect(routesSource.match(/isValidReportScheduleTimeZone\(tz\)/g)).toHaveLength(2);
    expect(routesSource.match(/isValidReportScheduleTime\(time\)/g)).toHaveLength(2);
    expect(routesSource.match(/isValidReportScheduleDayOfWeek\(dow\)/g)).toHaveLength(2);
    expect(routesSource.match(/isValidReportScheduleDayOfMonth\(dom\)/g)).toHaveLength(4);
    expect(routesSource.match(/isValidReportScheduleQuarterTiming\(qt\)/g)).toHaveLength(2);
    expect(routesSource).toContain("scheduleFrequency must be daily, weekly, monthly, or quarterly");
    expect(routesSource).toContain("scheduleTimeZone must be a valid IANA timezone");
    expect(routesSource).toContain("scheduleRecipients must include at least one recipient when scheduleEnabled=true");
    expect(routesSource).toContain("nextScheduleEnabled");
    expect(routesSource).toContain('String(body?.scheduleFrequency ?? (existing as any)?.scheduleFrequency ?? "")');
    expect(routesSource).not.toContain("Email recipients are optional");
  });

  it("rejects invalid schedule frequency, clock time, and IANA timezone values", () => {
    for (const frequency of ["daily", "weekly", "monthly", "quarterly"]) {
      expect(isValidReportScheduleFrequency(frequency)).toBe(true);
    }
    expect(isValidReportScheduleFrequency("hourly")).toBe(false);
    expect(isValidReportScheduleTime("0:00")).toBe(true);
    expect(isValidReportScheduleTime("23:59")).toBe(true);
    expect(isValidReportScheduleTime("24:00")).toBe(false);
    expect(isValidReportScheduleTime("09:60")).toBe(false);
    expect(isValidReportScheduleTime("99:99")).toBe(false);
    expect(isValidReportScheduleTimeZone("UTC")).toBe(true);
    expect(isValidReportScheduleTimeZone("Europe/Amsterdam")).toBe(true);
    expect(isValidReportScheduleTimeZone("Not/A_Zone")).toBe(false);
    expect(isValidReportScheduleDayOfWeek(0)).toBe(true);
    expect(isValidReportScheduleDayOfWeek(6)).toBe(true);
    expect(isValidReportScheduleDayOfWeek(6.5)).toBe(false);
    expect(isValidReportScheduleDayOfWeek(7)).toBe(false);
    expect(isValidReportScheduleDayOfMonth(0)).toBe(true);
    expect(isValidReportScheduleDayOfMonth(31)).toBe(true);
    expect(isValidReportScheduleDayOfMonth(1.5)).toBe(false);
    expect(isValidReportScheduleDayOfMonth(32)).toBe(false);
    expect(isValidReportScheduleQuarterTiming("start")).toBe(true);
    expect(isValidReportScheduleQuarterTiming("end")).toBe(true);
    expect(isValidReportScheduleQuarterTiming("middle")).toBe(false);
  });

  it("discovers scheduled platform reports through an explicit shared-table scheduler path", () => {
    const source = readReportScheduler();
    const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf-8");
    const discoveryStart = source.indexOf("const allReports = await storage.getScheduledPlatformReports");
    const schedulerDiscoveryBlock = source.slice(
      discoveryStart,
      source.indexOf("const scheduledReports = uniqueReports.filter", discoveryStart)
    );

    expect(source).toContain("const SCHEDULED_REPORT_PLATFORM_TYPES = ['linkedin', 'google_analytics', 'google_ads', 'instagram', 'tiktok', 'google_sheets', 'custom-integration', 'campaign_deepdive'];");
    expect(source).toContain("'google_analytics'");
    expect(source).toContain("'campaign_deepdive'");
    expect(source).toContain("'google_ads'");
    expect(source).toContain("'instagram'");
    expect(source).toContain("'tiktok'");
    expect(source).toContain("'google_sheets'");
    expect(source).toContain("'custom-integration'");
    expect(schedulerDiscoveryBlock).toContain("storage.getScheduledPlatformReports([...SCHEDULED_REPORT_PLATFORM_TYPES])");
    expect(schedulerDiscoveryBlock).toContain("new Map(allReports.map(report => [String(report.id), report])).values()");
    expect(schedulerDiscoveryBlock).not.toContain("storage.getLinkedInReports()");
    expect(schedulerDiscoveryBlock).not.toContain("storage.getPlatformReports('google_analytics')");
    expect(storageSource).toContain("getScheduledPlatformReports(platformTypes?: string[]): Promise<LinkedInReport[]>;");
    expect(storageSource).toContain("async getScheduledPlatformReports(platformTypes: string[] = []): Promise<LinkedInReport[]> {");
    expect(storageSource).toContain("eq(linkedinReports.scheduleEnabled, true)");
    expect(storageSource).toContain('eq(linkedinReports.status, "active")');
    expect(storageSource).toContain("inArray(linkedinReports.platformType, expandedPlatformTypes)");
    expect(storageSource).toContain('["custom-integration", "custom_integration"]');
    expect(source).toContain('String((report as any)?.platformType || "") === "campaign_deepdive"');
    expect(source).toContain("buildCampaignDeepDiveScheduledPdfAttachment");
    expect(source).toContain("validateInstagramScheduledReportScope(report)");
    expect(source).toContain("validateTikTokScheduledReportScope(report)");
    expect(source).toContain("Instagram source scope is invalid; skipped scheduled report");
    expect(source).toContain("TikTok source scope is invalid; skipped scheduled report");
    expect(source).toContain("buildInstagramScheduledPdfAttachment");
    expect(source).toContain("buildTikTokScheduledPdfAttachment");
    expect(source).toContain("storage.getInstagramDailyMetrics(campaignId, windowStart, windowEnd)");
    expect(source).toContain("storage.getTikTokDailyMetrics(campaignId, windowStart, windowEnd)");
    expect(source).toContain('selectedIds.has(String(row?.instagramCampaignId || ""))');
    expect(source).toContain('selectedIds.has(String(row?.tiktokCampaignId || ""))');
    expect(source).toContain("Source: selected Instagram daily metric rows only");
    expect(source).toContain("Source: selected TikTok daily metric rows only");
    expect(source).toContain("buildGoogleSheetsScheduledPdfAttachment");
    expect(source).toContain("buildCustomIntegrationScheduledPdfAttachment");
    expect(source).toContain("sourceBackedReportOutputUnavailableMessage(snapshotPlatformType)");
    expect(source).toContain("sourceBackedReportOutputUnavailableMessage((report as any)?.platformType)");
    expect(source).toContain("; skipped scheduled report");
    expect(source).toContain("; test report skipped");
  });

  it("disables orphaned scheduled reports after campaign-missing proof", () => {
    const source = readReportScheduler();
    const missingCampaignBlock = source.slice(
      source.indexOf('const error = "Campaign not found; skipped scheduled report"'),
      source.indexOf("continue;", source.indexOf('const error = "Campaign not found; skipped scheduled report"'))
    );

    expect(missingCampaignBlock).toContain(".update(linkedinReports)");
    expect(missingCampaignBlock).toContain("scheduleEnabled: false");
    expect(missingCampaignBlock).toContain(".update(reportSendEvents)");
    expect(missingCampaignBlock).toContain('status: "skipped"');
  });

  it("disables already-skipped scheduled reports that cannot be sent", () => {
    const source = readReportScheduler();
    const alreadyProcessedBlock = source.slice(
      source.indexOf('if (existingStatus === "skipped" && ('),
      source.indexOf('console.log(`[Report Scheduler] Report "${report.name}" already processed', source.indexOf('if (existingStatus === "skipped" && ('))
    );

    expect(alreadyProcessedBlock).toContain('displayError.includes("Campaign not found")');
    expect(alreadyProcessedBlock).toContain('displayError.includes("No recipients configured")');
    expect(alreadyProcessedBlock).toContain(".update(linkedinReports)");
    expect(alreadyProcessedBlock).toContain("scheduleEnabled: false");
    expect(alreadyProcessedBlock).toContain("existingReportId");
  });
});
