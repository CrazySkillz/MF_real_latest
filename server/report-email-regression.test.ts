import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

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

  it("keeps GA4 scheduled PDFs resilient to optional section query failures", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");

    expect(source).toContain("[GA4 Scheduled PDF]");
    expect(source).toContain("using persisted fallback");
    expect(source).toContain('return { rows: [] };');
    expect(source).toContain("return { totals: {} };");
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

  it("keeps GA4 scheduled Ad Comparison revenue provenance aligned with live output", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");
    const payloadStart = source.indexOf("const sourceRevenueBreakdowns = new Map<string, any[]>");
    const adsStart = source.indexOf("if (sections.ads)");
    const adsEnd = source.indexOf("if (sections.insights)", adsStart);
    const adsSection = source.slice(adsStart, adsEnd);

    expect(payloadStart).toBeGreaterThan(-1);
    expect(adsStart).toBeGreaterThan(-1);
    expect(adsEnd).toBeGreaterThan(adsStart);
    expect(source.slice(payloadStart, source.indexOf("const pipelineEntries", payloadStart))).toContain("campaignValueRevenueTotals");
    expect(adsSection).toContain("let unallocatedExternalRevenue = Math.max(0, Number((payload.importedRevenueForFinancials - matchedExternalRevenue).toFixed(2)));");
    expect(adsSection).toContain("REVENUE_ALLOCATION_RESIDUAL_THRESHOLD");
    expect(adsSection).toContain('allCampaignRows.push(["Unallocated External Revenue", "", "", "", formatMoney(unallocatedExternalRevenue)])');
    expect(adsSection).toContain('allCampaignRows.push(["Total Revenue (All Sources)", "", "", "", formatMoney(payload.financialRevenue > 0 ? payload.financialRevenue : payload.ga4RevenueForFinancials)])');
    expect(adsSection).toContain("payload.sourceRevenueBreakdowns.get(String(source?.sourceId || \"\"))");
    expect(adsSection).toContain('revenueBreakdownRows.push(["Total Revenue", formatMoney(payload.financialRevenue)])');
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

    expect(schedulerSource).toContain("waitForMailgunDelivery");
    expect(schedulerSource).toContain('delivery.status !== "delivered"');
    expect(schedulerSource).toContain("Mailgun accepted the email, but delivery was not confirmed yet");
    expect(routesSource).toContain("deliveryStatus: result.deliveryStatus");
    expect(routesSource).not.toContain("Test report email sent successfully! Check your inbox.");
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
    expect(confirmationBlock).toContain("waitForMailgunDelivery(audit.providerResponseId)");
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

    expect(routesSource).toContain("scheduleRecipients must include at least one recipient when scheduleEnabled=true");
    expect(routesSource).toContain("nextScheduleEnabled");
    expect(routesSource).toContain('String(body?.scheduleFrequency ?? (existing as any)?.scheduleFrequency ?? "")');
    expect(routesSource).not.toContain("Email recipients are optional");
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
