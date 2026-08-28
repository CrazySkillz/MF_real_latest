import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Custom Report regression guard", () => {
  it("preserves campaign context from the Campaign DeepDive launcher", () => {
    const campaignDetail = readFileSync(join(process.cwd(), "client/src/pages/campaign-detail.tsx"), "utf-8");

    expect(campaignDetail).toContain('<Link href={`/reports?campaignId=${encodeURIComponent(campaign.id)}`}>');
    expect(campaignDetail).not.toContain('<Link href={`/campaigns/${campaign.id}/platform-comparison`}>');
  });

  it("initializes and persists campaign context without changing the global reports route", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const app = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf-8");

    expect(app).toContain('<Route path="/reports" component={Reports} />');
    expect(reports).toContain('new URLSearchParams(window.location.search).get("campaignId") || ""');
    expect(reports).toContain('const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(() => campaignContextId ? [campaignContextId] : []);');
    expect(reports).toContain('const activeCampaignId = campaignContextId || selectedCampaigns[0] || "";');
    expect(reports).toContain("campaignId: activeCampaignId || undefined,");
  });

  it("reads connected-source aggregate input for campaign-scoped custom reports", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('queryKey: [`/api/campaigns/${campaignContextId}/outcome-totals`, "90days"],');
    expect(reports).toContain('fetch(`/api/campaigns/${campaignContextId}/outcome-totals?dateRange=90days`, { credentials: "include" })');
    expect(reports).toContain("enabled: !!campaignContextId,");
    expect(reports).toContain("const customReportPerformanceSummary = campaignOutcomeTotals?.performanceSummary;");
    expect(reports).toContain('source?.connected === true && source?.category !== "financial"');
    expect(reports).toContain("metric?.available === true");
  });

  it("gates custom report metric selection to available connected-source metrics", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "client/src/lib/reportStorage.ts"), "utf-8");

    expect(storage).toContain("selectedMetrics?: string[];");
    expect(storage).toContain("selectedSections?: string[];");
    expect(reports).toContain("Only metrics available from this campaign's connected sources are selectable.");
    expect(reports).toContain('return source?.category === "paid_media" && includedMetrics.some((metric: string) => customReportPaidMetricKeys.has(metric));');
    expect(reports).toContain(".filter((key) => !customReportPaidMetricKeys.has(key) || hasCustomReportPaidMediaSource);");
    expect(reports).toContain("const customReportSelectableMetricSet = new Set(customReportSelectableMetricKeys);");
    expect(reports).toContain("setSelectedReportMetrics([]);");
    expect(reports).toContain("group.keys.filter((key) => customReportSelectableMetricSet.has(key))");
    expect(reports).toContain("Unavailable paid-media metrics are hidden until a connected source provides them.");
    expect(reports).toContain('selectedMetrics: reportType === "custom" && activeCampaignId ? selectedReportMetrics : undefined,');
    expect(reports).toContain('!selectedReportSections.includes("metrics") || selectedReportMetrics.length > 0');
  });

  it("keeps saved custom report output aggregate-backed without rendering details on report cards", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const renderCustomReportMetricOutput = (report: StoredReport) => {");
    expect(reports).toContain('report.campaignId !== campaignContextId || report.type !== "custom"');
    expect(reports).toContain("const metric = customReportPerformanceSummary?.totals?.[key];");
    expect(reports).toContain("metric?.available === true");
    expect(reports).toContain("formatCustomReportMetricValue(key, metric?.value)");
    expect(reports).toContain("Connected-source report values");
    expect(reports).toContain("Unavailable${reason ? ` - ${reason}` : \"\"}");
    expect(reports).not.toContain("{renderCustomReportMetricOutput(report)}");
    expect(reports).not.toContain("Includes: {report.includeKPIs ? 'KPIs' : ''}");
  });

  it("does not show a blocking browser confirmation after creating a report", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).not.toContain("report created successfully");
    expect(reports).not.toContain("alert(");
  });

  it("keeps the Campaign Report modal from shifting the page scrollbar gutter", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const styles = readFileSync(join(process.cwd(), "client/src/index.css"), "utf-8");

    expect(reports).toContain("data-campaign-report-dialog");
    expect(styles).toContain("body[data-scroll-locked]:has([data-campaign-report-dialog])");
  });

  it("supports editing stored report cards through the report dialog", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "client/src/lib/reportStorage.ts"), "utf-8");

    expect(storage).toContain("updateReport(id: string, updates: Partial<StoredReport>)");
    expect(reports).toContain("const [editingReportId, setEditingReportId] = useState<string | null>(null);");
    expect(reports).toContain('setReportType("");');
    expect(reports).toContain("setSelectedReportMetrics([]);");
    expect(reports).toContain("const openCreateReport = () => {");
    expect(reports).toContain("<Button onClick={openCreateReport}>");
    expect(reports).toContain("const openEditReport = (report: StoredReport) => {");
    expect(reports).toContain("setOriginalReportFormSignature(getReportFormSignature(nextValues));");
    expect(reports).toContain("reportStorage.updateReport(editingReportId, reportPayload);");
    expect(reports).toContain('{editingReportId ? "Update Report" : scheduleEnabled ? "Schedule Report" : "Download Report"}');
    expect(reports).toContain("disabled={!isReportFormValid || !isReportFormChanged || reportSavePending}");
    expect(reports).toContain("onClick={() => openEditReport(report)}");
    expect(reports).toContain("onOpenAutoFocus={(event) => {");
    expect(reports).toContain("if (editingReportId) event.preventDefault();");
    expect(reports).toContain("const REPORT_DESCRIPTION_MAX_LENGTH = 160;");
    expect(reports).toContain("description: limitReportDescription(report.description || \"\"),");
    expect(reports).toContain("maxLength={REPORT_DESCRIPTION_MAX_LENGTH}");
    expect(reports).toContain("setReportDescription(limitReportDescription(e.target.value))");
    expect(reports).toContain("{reportDescription.length}/{REPORT_DESCRIPTION_MAX_LENGTH}");
  });

  it("keeps create mode blank and separates download from scheduling", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('const [reportType, setReportType] = useState("");');
    expect(reports).toContain('const [selectedReportSections, setSelectedReportSections] = useState<string[]>([]);');
    expect(reports).toContain('<SelectValue placeholder="Select report type" />');
    expect(reports).toContain('<DialogTitle>{editingReportId ? "Edit Report" : "Create Report"}</DialogTitle>');
    expect(reports).toContain('Schedule Automated Report');
    expect(reports).toContain('const [scheduleFrequency, setScheduleFrequency] = useState("daily");');
    expect(reports).toContain('setScheduleFrequency("daily");');
    expect(reports).toContain('scheduleFrequency: report.schedule?.frequency || "daily",');
    expect(reports).toContain("const getDefaultScheduleDayForFrequency =");
    expect(reports).toContain("setScheduleDay(getDefaultScheduleDayForFrequency(value));");
    expect(reports).toContain('Label>Day of Month</Label>');
    expect(reports).toContain('1st day of month');
    expect(reports).toContain('15th day of month');
    expect(reports).toContain('Last day of month');
    expect(reports).toContain('Label>Quarter Timing</Label>');
    expect(reports).toContain('Start of quarter');
    expect(reports).toContain('End of quarter');
    expect(reports).toContain('payload.scheduleDayOfMonth = schedule?.day === "last" ? 0 : Number(schedule?.day) || 1;');
    expect(reports).toContain('payload.quarterTiming = schedule?.day === "start" ? "start" : "end";');
    expect(reports).toContain('const CAMPAIGN_DEEPDIVE_REPORT_PLATFORM = "campaign_deepdive";');
    expect(reports).toContain('fetch(`/api/platforms/${CAMPAIGN_DEEPDIVE_REPORT_PLATFORM}/reports${backendReportId ? `/${encodeURIComponent(backendReportId)}` : ""}`');
    expect(reports).toContain('scheduleTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"');
    expect(reports).toContain('Scheduled reports are sent by email using the saved recipients and your time zone:');
    for (const hour of ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]) {
      expect(reports).toContain(`<SelectItem value="${hour}">`);
    }
    expect(reports).not.toContain('<SelectItem value="06:00">');
    expect(reports).not.toContain('Scheduled reports are saved in this browser only right now. Automated email delivery is not connected for Custom Reports yet.');
    expect(reports).not.toContain('Schedule Automated Reports');
    expect(reports).not.toContain('Schedule Automatic Generation');
    expect(reports).not.toContain('variant={!editingReportId && scheduleEnabled ? "link" : "default"}');
    expect(reports).toContain("const downloadReportPdf = async (report: StoredReport) => {");
    expect(reports).toContain("const { jsPDF } = await import('jspdf');");
    const campaignDownload = reports.indexOf("await downloadCampaignReportPdf({", reports.indexOf("} else if (scheduleEnabled)"));
    const standaloneStorage = reports.indexOf("const savedReport = reportStorage.addReport", campaignDownload);
    expect(campaignDownload).toBeGreaterThan(-1);
    expect(standaloneStorage).toBeGreaterThan(campaignDownload);
    expect(reports.slice(campaignDownload, standaloneStorage)).not.toContain("reportStorage.addReport");
    expect(reports).toContain('await downloadReportPdf(savedReport);');
    expect(reports).toContain('selectedSections.forEach((section) => addText(`- ${getReportTabLabel(report.type, section)}`, { indent: 4 }));');
    expect(reports).toContain('const addDeepDiveSectionContent = (section: string) => {');
    expect(reports).toContain('selectedSections.forEach(addDeepDiveSectionContent);');
    expect(reports).toContain('addMetricList(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);');
    expect(reports).toContain('addSourceList();');
  });

  it("uses the scheduled server renderer for Campaign Custom Report downloads", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server/routes-oauth.ts"), "utf-8");
    const directPdfRoute = routes.slice(
      routes.indexOf('app.post("/api/campaigns/:id/custom-report-pdf"'),
      routes.indexOf("// Get platform reports"),
    );

    expect(reports).toContain("const downloadCampaignReportPdf = async (report: StoredReport) => {");
    expect(reports).toContain("if (report.backendReportId) {");
    expect(reports).toContain("/snapshots`");
    expect(reports).toContain("`/api/report-snapshots/${encodeURIComponent(snapshotId)}/pdf`");
    expect(reports).toContain("`/api/campaigns/${encodeURIComponent(reportCampaignId)}/custom-report-pdf`");
    expect(reports).toContain('if (!signature.startsWith("%PDF-")) throw new Error("Generated report PDF is invalid");');
    expect(reports).toContain("const isCampaignDeepDiveDownloadReport = (report: StoredReport) =>");
    expect(reports).toContain("if ((report.campaignId || campaignContextId) && isCampaignDeepDiveDownloadReport(report)) await downloadCampaignReportPdf(report);");
    expect(reports).toContain("else await downloadReportPdf(report);");
    expect(directPdfRoute).toContain("await ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(directPdfRoute).toContain('platformType: "campaign_deepdive"');
    expect(directPdfRoute).toContain("buildPdfAttachmentForReport");
    expect(directPdfRoute).toContain("Custom Report source-backed PDF output unavailable");
    expect(directPdfRoute).not.toContain("createPlatformReport");
    expect(directPdfRoute).not.toContain("reportSnapshots");
  });

  it("shows campaign schedules directly while preserving standalone report tabs", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const visibleStoredReports = campaignContextId");
    expect(reports).toContain("allStoredReports.filter(report => report.campaignId === campaignContextId)");
    expect(reports).toContain("const standardReports = visibleStoredReports.filter(report => report.status === 'Generated');");
    expect(reports).toContain("const storedScheduledReports = visibleStoredReports.filter(report => (report.status === 'Scheduled' || report.status === 'Paused') && report.schedule);");
    expect(reports).toContain('<Tabs defaultValue={campaignContextId ? "scheduled" : "standard"} className="space-y-6">');
    expect(reports).toContain("{!campaignContextId && (");
    expect(reports).toContain("<TabsList>");
    expect(reports).toContain('<TabsTrigger value="standard">Standard Reports</TabsTrigger>');
    expect(reports.indexOf('<TabsTrigger value="standard">Standard Reports</TabsTrigger>')).toBeLessThan(reports.indexOf('<TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>'));
    expect(reports.indexOf('<TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>')).toBeLessThan(reports.indexOf('<TabsTrigger value="all">All Reports</TabsTrigger>'));
    expect(reports).toContain('<TabsContent value="standard">');
    expect(reports).toContain("standardReports.map((report) => (");
    expect(reports).toContain("storedScheduledReports.map((report) => (");
    const scheduledTab = reports.slice(reports.indexOf('<TabsContent value="scheduled"'), reports.indexOf('<TabsContent value="all"'));
    expect(scheduledTab).toContain("onClick={() => openEditReport(report)}");
    expect(scheduledTab).toContain("onClick={() => downloadLatestReport(report)}");
    expect(scheduledTab).toContain("Download latest report");
    expect(scheduledTab).not.toContain("Download last sent report");
    expect(scheduledTab).toContain('report.status === "Paused" ? resumeScheduledReport(report) : pauseScheduledReport(report)');
    expect(scheduledTab).toContain('{report.status === "Paused" ? "Resume" : "Pause"}');
    expect(scheduledTab).not.toContain('<span className="font-medium text-foreground">Status:</span>');
    expect(scheduledTab).not.toContain("<Badge");
    expect(scheduledTab).not.toContain("Settings");
    expect(reports).toContain("const getReportSelectedTabSummary = (report: StoredReport) => {");
    expect(scheduledTab).toContain("{getReportSelectedTabSummary(report)}");
    expect(reports).toContain("Back to main Campaign Overview");
    expect(reports).toContain("`/campaigns/${encodeURIComponent(campaignContextId)}`");
    const allTab = reports.slice(reports.indexOf('<TabsContent value="all">'), reports.indexOf('<TabsContent value="standard">'));
    expect(allTab).toContain("Download latest report");
    expect(allTab).not.toContain("Download last sent report");
    expect(allTab).not.toContain("pauseScheduledReport(report)");
    expect(allTab).not.toContain("resumeScheduledReport(report)");
    expect(reports).not.toContain("const [campaignFilter, setCampaignFilter]");
    expect(reports).not.toContain('<SelectItem value="all">All Campaigns</SelectItem>');
    expect(reports).not.toContain("setCampaignFilter");
    expect(reports).not.toContain("const [statusFilter, setStatusFilter]");
    expect(reports).not.toContain('<SelectItem value="all">All Statuses</SelectItem>');
    expect(reports).not.toContain("setStatusFilter");
    expect(reports).toContain("No scheduled reports yet");
    expect(reports).toContain("Use Schedule Report to create an automated report.");
    expect(reports).not.toContain("const scheduledReports = [");
    expect(reports).not.toContain("scheduledReports.map((report) => (");
    expect(reports).toContain("if (campaignContextId) {");
    expect(reports).toContain("setAllStoredReports([]);");
    expect(reports).toContain("Showing {filteredReports.length} of {visibleStoredReports.length} reports");
    expect(reports).toContain("Download latest report");
    expect(reports).toContain("{report.description && (");
    expect(reports).toContain('<p className="text-sm text-muted-foreground">{report.description}</p>');
    expect(reports).not.toContain('<span className="font-medium text-foreground">Format:</span>');
    expect(reports).not.toContain("Report Templates");
  });

  it("renders complete weekly, monthly, and quarterly schedule descriptions", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const formatReportSchedule =");
    expect(reports).toContain("return `Weekly on ${dayLabel} at ${schedule.time}`;");
    expect(reports).toContain('schedule.day === "last" ? "the last day" : `day ${schedule.day}`');
    expect(reports).toContain("return `Monthly on ${dayLabel} of the month at ${schedule.time}`;");
    expect(reports).toContain("return `Quarterly at the ${schedule.day} of the quarter at ${schedule.time}`;");
    expect(reports.match(/\{formatReportSchedule\(report\.schedule\)\}/g)).toHaveLength(2);
  });

  it("confirms report deletion and lists connected sources without metric-key noise", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const [reportPendingDelete, setReportPendingDelete] = useState<StoredReport | null>(null);");
    expect(reports).toContain("onClick={() => setReportPendingDelete(report)}");
    expect(reports).toContain("const localReportMirror = reportStorage.getReports().find((report) =>");
    expect(reports).toContain("report.backendReportId === reportPendingDelete.backendReportId");
    expect(reports).toContain("report.campaignId === reportPendingDelete.campaignId");
    expect(reports).toContain("String(report.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM) === String(reportPendingDelete.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM)");
    expect(reports).toContain("if (localReportMirror) reportStorage.deleteReport(localReportMirror.id);");
    expect(reports).toContain("reportStorage.deleteReport(reportPendingDelete.id);");
    expect(reports).toContain("reportPendingDelete.backendReportId");
    expect(reports).toContain('method: "DELETE"');
    expect(reports).toContain("<AlertDialog open={!!reportPendingDelete}");
    expect(reports).toContain("<AlertDialogTitle>Delete report?</AlertDialogTitle>");
    expect(reports).toContain("This action cannot be undone.");
    expect(reports).toContain("Campaign connected-source data");
    expect(reports).toContain("customReportSources.map((source: any) => (");
    expect(reports).not.toContain("Selectable metrics:");
    const failedBackendDelete = reports.indexOf('if (!response.ok) throw new Error("Failed to delete scheduled report");');
    const localMirrorCleanup = reports.indexOf("const localReportMirror", failedBackendDelete);
    expect(localMirrorCleanup).toBeGreaterThan(failedBackendDelete);
  });

  it("shows report lifecycle action errors in the report library", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const lifecycleStart = reports.indexOf("const deletePendingReport = async () => {");
    const lifecycleEnd = reports.indexOf("const localVisibleReports", lifecycleStart);
    const lifecycleHandlers = reports.slice(lifecycleStart, lifecycleEnd);

    expect(reports).toContain('const [reportActionError, setReportActionError] = useState("");');
    expect(reports).toContain('<div role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">');
    expect(reports).toContain("{reportActionError}");
    expect(lifecycleHandlers).toContain('setReportActionError(error?.message || "Failed to delete report");');
    expect(lifecycleHandlers).toContain('setReportActionError(error?.message || "Failed to pause scheduled report");');
    expect(lifecycleHandlers).toContain('setReportActionError(error?.message || "Failed to resume scheduled report");');
    expect(lifecycleHandlers).not.toContain("setReportSaveError");
  });

  it("shows stored-report download failures in the report library", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const downloadLatestReport = async (report: StoredReport) => {");
    expect(reports).toContain("if ((report.campaignId || campaignContextId) && isCampaignDeepDiveDownloadReport(report)) await downloadCampaignReportPdf(report);");
    expect(reports).toContain("else await downloadReportPdf(report);");
    expect(reports).toContain('setReportActionError(error?.message || "Failed to download report");');
    expect(reports.match(/onClick=\{\(\) => downloadLatestReport\(report\)\}/g)).toHaveLength(3);
    expect(reports).not.toContain("onClick={() => downloadReportPdf(report)}");
  });

  it("prevents duplicate report create and update submissions", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const saveStart = reports.indexOf("const saveReport = async () => {");
    const firstBackendSave = reports.indexOf("await saveBackendScheduledReport", saveStart);
    const failedSave = reports.indexOf('setReportSaveError(error?.message || "Failed to save report");', firstBackendSave);
    const failedSaveUnlock = reports.indexOf("reportSaveInProgress.current = false;", failedSave);
    const successfulSaveClose = reports.indexOf("setShowCreateDialog(false);", failedSaveUnlock);
    const successfulSaveUnlock = reports.indexOf("reportSaveInProgress.current = false;", successfulSaveClose);

    expect(reports).toContain('import { useState, useEffect, useRef } from "react";');
    expect(reports).toContain("const reportSaveInProgress = useRef(false);");
    expect(reports).toContain("const [reportSavePending, setReportSavePending] = useState(false);");
    expect(reports).toContain("if (reportSaveInProgress.current) return;");
    expect(reports.indexOf("reportSaveInProgress.current = true;", saveStart)).toBeLessThan(firstBackendSave);
    expect(failedSaveUnlock).toBeGreaterThan(failedSave);
    expect(successfulSaveUnlock).toBeGreaterThan(successfulSaveClose);
    expect(reports).toContain("disabled={!isReportFormValid || !isReportFormChanged || reportSavePending}");
    expect(reports).toContain("aria-busy={reportSavePending}");
  });

  it("wires Campaign DeepDive scheduled reports into backend scheduler records", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const storage = readFileSync(join(process.cwd(), "client/src/lib/reportStorage.ts"), "utf-8");
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");

    expect(storage).toContain("backendReportId?: string;");
    expect(storage).toContain("backendPlatformType?: string;");
    expect(reports).toContain("const buildBackendScheduledReportPayload =");
    expect(reports).toContain('reportType: "custom"');
    expect(reports).toContain('createdFrom: "campaign-deepdive-custom-report"');
    expect(reports).toContain("const backendReport = await saveBackendScheduledReport(reportPayload);");
    expect(reports).toContain("backendReportId: String(backendReport?.id || \"\")");
    expect(reports).toContain('reportPayload?: Omit<StoredReport, "id" | "generatedAt">');
    expect(reports).toContain("const reportContentPayload = reportPayload ? buildBackendScheduledReportPayload(reportPayload) : null;");
    expect(reports).toContain("name: reportContentPayload.name,");
    expect(reports).toContain("description: reportContentPayload.description,");
    expect(reports).toContain("reportType: reportContentPayload.reportType,");
    expect(reports).toContain("configuration: reportContentPayload.configuration,");
    expect(reports).toContain("if (backendReportId) await disableBackendScheduledReport(backendReportId, backendPlatformType, reportPayload);");
    expect(reports).toContain("const pauseScheduledReport = async (report: StoredReport) => {");
    expect(reports).toContain("if (report.backendReportId) await disableBackendScheduledReport(report.backendReportId, report.backendPlatformType || CAMPAIGN_DEEPDIVE_REPORT_PLATFORM);");
    expect(reports).toContain('reportStorage.updateReport(report.id, { status: "Paused" });');
    expect(reports).toContain("const resumeScheduledReport = async (report: StoredReport) => {");
    expect(reports).toContain('status: "Scheduled",');
    expect(reports).toContain("const backendReport = await saveBackendScheduledReport(reportPayload, report.backendReportId);");
    expect(reports).toContain('reportStorage.updateReport(report.id, {');
    expect(reports).toContain('throw new Error(errorBody?.message || "Failed to pause scheduled report");');
    expect(scheduler).toContain("const scheduledReports = uniqueReports.filter(r => r.scheduleEnabled && r.status === 'active');");
    expect(scheduler).toContain('String((report as any)?.platformType || "") === "campaign_deepdive"');
    expect(scheduler).toContain("buildCampaignDeepDiveScheduledPdfAttachment");
  });

  it("renders backend scheduled Campaign DeepDive reports without localStorage records", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const backendScheduledReportToStoredReport =");
    expect(reports).toContain('queryKey: [`/api/platforms/${CAMPAIGN_DEEPDIVE_REPORT_PLATFORM}/reports`, campaignContextId],');
    expect(reports).toContain('fetch(`/api/platforms/${CAMPAIGN_DEEPDIVE_REPORT_PLATFORM}/reports?campaignId=${encodeURIComponent(campaignContextId)}`, { credentials: "include" })');
    expect(reports).toContain('id: `backend:${String(report?.id || "")}`');
    expect(reports).toContain('backendReportId: String(report?.id || "")');
    expect(reports).toContain("const backendScheduledStoredReports = campaignContextId");
    expect(reports).toContain('.filter((report: any) => report?.scheduleEnabled || String(report?.status || "").toLowerCase() === "paused")');
    expect(reports).toContain("const backendScheduledReportIds = new Set");
    expect(reports).toContain("const storedReportsForEdit = [...allStoredReports, ...backendScheduledStoredReports];");
    expect(reports).toContain("storedReportsForEdit.find((report) => report.id === editingReportId)");
    expect(reports).toContain("...localVisibleReports.filter(report => !report.backendReportId || !backendScheduledReportIds.has(report.backendReportId)),");
    expect(reports).toContain("...backendScheduledStoredReports,");
    expect(reports).toContain("if (campaignContextId) refetchBackendScheduledReports();");
  });

  it("keeps report-list failures distinct from successful empty report libraries", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const ga4 = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf-8");

    expect(ga4).toContain("isError: ga4ReportsError");
    expect(ga4).toContain('throw new Error(json?.message || "Failed to load saved reports")');
    expect(ga4).toContain('throw new Error("Invalid saved reports response")');
    expect(ga4).toContain("ga4ReportsError ? (");
    expect(reports).toContain("isError: backendScheduledReportsError");
    expect(reports).toContain("isLoading: backendScheduledReportsLoading");
    expect(reports).toContain('throw new Error(json?.message || "Failed to load scheduled reports")');
    expect(reports).toContain('throw new Error("Invalid scheduled reports response")');
    expect(reports).toContain("backendScheduledReportsError && backendScheduledReports.length === 0 && campaignContextId");
    expect(reports).toContain("storedScheduledReports.length === 0 && !backendScheduledReportsLoading && !backendScheduledReportsError");
    expect(reports).not.toContain("Loading scheduled reports");
    expect(ga4).toContain("Reports unavailable");
    expect(reports).toContain("Reports unavailable");
  });

  it("renders scheduled Campaign DeepDive PDFs with selected section body content", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { aggregateCampaignMetrics } from "./scheduler";');
    expect(scheduler).toContain("type CampaignDeepDiveReportContext = {");
    expect(scheduler).toContain("async function buildCampaignDeepDiveReportContext");
    expect(scheduler).toContain("const reportContext = campaignId");
    expect(scheduler).toContain("const { campaign, performanceSummary, executiveSummary, trendAnalysis, kpis, benchmarks, aggregateSources } = reportContext;");
    expect(scheduler).toContain("const addSelectedSectionBody = (section: string) => {");
    expect(scheduler).toContain('addText("Selected section content", { size: 14, bold: true });');
    expect(scheduler).toContain("selectedSections.forEach(addSelectedSectionBody);");
    expect(scheduler).toContain("Marketing Funnel Performance");
    expect(scheduler).toContain("KPI Exceptions");
    expect(scheduler).toContain("Benchmark Exceptions");
    expect(scheduler).toContain("Risk Assessment");
    expect(scheduler).toContain("Platform Performance Summary Cards");
    expect(scheduler).toContain("Trend metrics");
    expect(scheduler).toContain("Recommended Actions");
  });

  it("stores and serves the exact Campaign DeepDive PDF artifact without regeneration", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server/routes-oauth.ts"), "utf-8");
    const scheduledSend = scheduler.slice(
      scheduler.indexOf("const pdfBuffer = await buildPdfAttachmentForReport"),
      scheduler.indexOf("// Update metrics", scheduler.indexOf("const pdfBuffer = await buildPdfAttachmentForReport")),
    );
    const snapshotPdfRoute = routes.slice(
      routes.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'),
      routes.indexOf("// Get single benchmark"),
    );

    expect(scheduledSend).toContain('snapshotPlatformType === "campaign_deepdive"');
    expect(scheduledSend).toContain("createReportPdfArtifact(pdfBuffer)");
    expect(scheduledSend).toContain("(snapshotPayload as any).pdfArtifact = customReportPdfArtifact");
    expect(scheduledSend.indexOf("createReportPdfArtifact(pdfBuffer)"))
      .toBeLessThan(scheduledSend.indexOf("sendReportEmailWithRetry"));
    expect(snapshotPdfRoute).toContain('snapshotPlatform === "campaign_deepdive"');
    expect(snapshotPdfRoute).toContain("readReportPdfArtifact(payload)");
    expect(snapshotPdfRoute).toContain("Immutable Custom Report PDF artifact unavailable");
    expect(snapshotPdfRoute.indexOf("readReportPdfArtifact(payload)"))
      .toBeLessThan(snapshotPdfRoute.indexOf('import("./report-scheduler.js")'));
  });

  it("keeps scheduled Budget & Financial PDFs aligned with campaign pacing metadata", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const builderStart = scheduler.indexOf("async function buildCampaignDeepDiveScheduledPdfAttachment");
    const builderEnd = scheduler.indexOf("export async function buildPdfAttachmentForReport", builderStart);
    const builder = scheduler.slice(builderStart, builderEnd);

    expect(builder).toContain('(campaign as any)?.pacingStartDate');
    expect(builder).toContain('(campaign as any)?.pacingEndDate');
    expect(builder).toContain('getZonedParts(new Date(), String((report as any)?.scheduleTimeZone || (campaign as any)?.reportingTimeZone || "UTC"))');
    expect(builder).not.toContain('(campaign as any)?.startDate');
    expect(builder).not.toContain('(campaign as any)?.endDate');
    expect(builder).toContain('const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase() || "USD";');
    expect(builder).toContain('rawBudget === null || rawBudget === undefined || String(rawBudget).trim() === ""');
    expect(builder).toContain('const effectiveElapsedEnd = pacingEndDate && pacingEndDate.getTime() < today.getTime() ? pacingEndDate : today;');
    expect(builder).toContain('Math.floor((effectiveElapsedEnd.getTime() - pacingStartDate.getTime()) / (24 * 60 * 60 * 1000)) + 1');
    expect(builder).toContain('const remainingBudget = campaignBudget !== null && spend !== null ? campaignBudget - spend : null;');
    expect(builder).toContain('const dailyBurnRate = spend !== null && elapsedDays > 0 ? spend / elapsedDays : null;');
    expect(builder).toContain('const targetDailySpend = campaignBudget !== null && totalDays > 0 ? campaignBudget / totalDays : null;');
    expect(builder).toContain('pacingPercentage > 115');
    expect(builder).toContain('pacingPercentage < 85');
    expect(builder).toContain('Campaign Budget');
    expect(builder).toContain('Remaining Budget');
    expect(builder).toContain('Daily Burn Rate');
    expect(builder).toContain('Target Daily Spend');
    expect(builder).toContain('Budget Period Start');
    expect(builder).toContain('Budget Period End');
    expect(builder).toContain('addMetricRows(["revenue", "spend", "conversions", "cvr", "cpc", "cpa", "roas", "roi"], 8, campaignCurrency);');
    expect(builder).toContain('if (section === "financial-analysis:overview")');
    expect(builder).toContain('const isFinancialAnalysisReport = reportType === "financial-analysis" || selectedSections.some((section: string) => section.startsWith("financial-analysis:"));');
    expect(builder).toContain('financial values are campaign-to-date');
  });

  it("loads latest aggregate context for scheduled Campaign DeepDive PDFs", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server/routes-oauth.ts"), "utf-8");

    expect(scheduler).toContain("async function buildCampaignDeepDiveReportContext");
    expect(scheduler).toContain('import("./routes-oauth.js").then(({ readCertifiedCampaignPerformanceSummary }) =>');
    expect(scheduler).toContain('readCertifiedCampaignPerformanceSummary(campaignId, "90days")');
    expect(scheduler).toContain("const performanceSummary = certifiedPerformanceSummary");
    expect(scheduler).toContain("storage.getCampaign(campaignId)");
    expect(scheduler).toContain("const aggregateSources = Array.isArray(performanceSummary?.sources)");
    expect(scheduler).toContain("const reportContext = campaignId");
    expect(scheduler).toContain("const { campaign, performanceSummary, executiveSummary, trendAnalysis, kpis, benchmarks, aggregateSources } = reportContext;");
    expect(routes).toContain('layer?.route?.path === "/api/campaigns/:id/outcome-totals"');
    expect(routes).toContain("const campaignOutcomeTotalsHandler = campaignOutcomeTotalsRoute?.route?.stack?.at(-1)?.handle");
    expect(routes).toContain("campaignOutcomeTotalsReader = async");
    expect(routes).toContain("await campaignOutcomeTotalsHandler({ params: { id: campaignId }, query: { dateRange } }, internalResponse)");
    expect(routes).toContain('app.get("/api/campaigns/:id/outcome-totals", requireCampaignAccessParamId, async (req, res) => {');
    expect(routes).toContain('performanceSummary?.version !== "performance_summary_aggregate_v3"');
  });

  it("keeps scheduled report LinkedIn values tied to an active Connected Platforms source", () => {
    const metricsScheduler = readFileSync(join(process.cwd(), "server/scheduler.ts"), "utf-8");
    const linkedInStart = metricsScheduler.indexOf("// Fetch LinkedIn metrics");
    const linkedInEnd = metricsScheduler.indexOf("// Fetch Custom Integration metrics", linkedInStart);
    const linkedInBlock = metricsScheduler.slice(linkedInStart, linkedInEnd);

    expect(linkedInBlock).toContain("const linkedInConnection = await storage.getLinkedInConnection(campaignId);");
    expect(linkedInBlock).toContain("const latestSession = linkedInConnection && !(linkedInConnection as any).spendOnly");
    expect(linkedInBlock).toContain("await storage.getLatestLinkedInImportSession(campaignId)");
    expect(linkedInBlock).toContain("linkedinConnected = true;");
    expect(linkedInBlock).toContain("linkedinLastImportedAt = (latestSession as any).importedAt || null;");
  });

  it("loads scheduled Trend Analysis aggregate only when Trend Analysis tabs are selected", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const metricsScheduler = readFileSync(join(process.cwd(), "server/scheduler.ts"), "utf-8");

    expect(scheduler).toContain('section.startsWith("trend-analysis:")');
    expect(scheduler).toContain("const needsTrendAnalysis = selectedSections.some((section) => section.startsWith(\"trend-analysis:\"));");
    expect(scheduler).toContain("aggregateCampaignMetrics(campaignId, { includeTrendAnalysis: needsTrendAnalysis })");
    expect(scheduler).toContain("const trendAnalysis = needsTrendAnalysis ? ((campaignMetrics as any)?.detailedMetrics?.trendAnalysis || null) : null;");
    expect(scheduler).toContain("addTrendRows([\"sessions\", \"users\", \"conversions\", \"revenue\", \"spend\", \"impressions\", \"clicks\"]);");
    expect(metricsScheduler).toContain("interface AggregateCampaignMetricsOptions");
    expect(metricsScheduler).toContain("includeTrendAnalysis?: boolean;");
    expect(metricsScheduler).toContain("const includeTrendAnalysis = options.includeTrendAnalysis !== false;");
    expect(metricsScheduler).toContain("if (includeTrendAnalysis) {");
    expect(metricsScheduler).toContain("const trendAnalysis = includeTrendAnalysis ? buildTrendAnalysisAggregate({");
  });

  it("keeps Trend reports single-view and uses exact 90-day calendar windows", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const reportTypeBlock = reports.slice(
      reports.indexOf('key: "trend-analysis"'),
      reports.indexOf('key: "executive-summary"'),
    );
    const clientTrendBuilder = reports.slice(
      reports.indexOf("const addTrendAnalysisContent ="),
      reports.indexOf("const addDeepDiveSectionContent ="),
    );

    expect(reportTypeBlock.match(/trend-analysis:[a-z-]+/g)).toEqual(["trend-analysis:overview"]);
    expect(reportTypeBlock).toContain('label: "Executive View"');
    expect(reports).toContain("const normalizeTrendReportSections =");
    expect(scheduler).toContain("const normalizeCampaignDeepDiveTrendSections =");
    expect(clientTrendBuilder).toContain("currentStart?.setUTCDate(currentStart.getUTCDate() - 89);");
    expect(clientTrendBuilder).toContain("previousStart?.setUTCDate(previousStart.getUTCDate() - 179);");
    expect(clientTrendBuilder).toContain('cumulativeStartDate > requestedCurrentStartDate');
    expect(clientTrendBuilder).not.toContain("Math.ceil(trendRows.length / 2)");
    expect(scheduler).toContain("date.setUTCDate(date.getUTCDate() - 89);");
    expect(scheduler).toContain('cumulativeStartDate > requestedTrendWindowStart');
    expect(scheduler).toContain("resolveGA4ImportToDateWindow((cumulativeGA4Connection as any)?.importStartDate");
    expect(scheduler).toContain('cumulativeGA4Window?.endDate || trendAnalysis?.endDate');
    expect(scheduler).toContain("const rows = trendWindowRows;");
    expect(scheduler).not.toContain("rows.slice(-Math.max(1, Math.ceil(rows.length / 2)))");
  });

  it("loads scheduled Executive Summary context only when Executive Summary tabs are selected", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");

    expect(scheduler).toContain('section.startsWith("executive-summary:")');
    expect(scheduler).toContain('section === "performance-summary:overview"');
    expect(scheduler).toContain('section === "performance-summary:health"');
    expect(scheduler).toContain('section === "executive-summary:overview"');
    expect(scheduler).toContain('section === "kpis"');
    expect(scheduler).toContain('section === "benchmarks"');
    expect(scheduler).toContain('needsKpiRows ? storage.getPlatformKPIs("google_analytics", campaignId)');
    expect(scheduler).toContain('needsBenchmarkRows ? storage.getPlatformBenchmarks("google_analytics", campaignId)');
    expect(scheduler).not.toContain("needsKpiRows ? storage.getCampaignKPIs(campaignId)");
    expect(scheduler).not.toContain("needsBenchmarkRows ? storage.getCampaignBenchmarks(campaignId)");
    expect(scheduler).toContain("needsExecutiveSummary ? storage.getCampaignKPIs(campaignId)");
    expect(scheduler).toContain("needsExecutiveSummary ? storage.getCampaignBenchmarks(campaignId)");
    expect(scheduler).toContain("formatCampaignDeepDiveRecordValue(row, row?.currentValue ?? row?.current)");
    expect(scheduler).toContain("formatCampaignDeepDiveRecordValue(row, row?.currentValue ?? row?.yours)");
    expect(scheduler).toContain("const executiveSummary = needsExecutiveSummary ? { performanceSummary, kpis: executiveKpis, benchmarks: executiveBenchmarks } : null;");
    expect(scheduler).toContain("if (!executiveSummary?.performanceSummary)");
    expect(scheduler).toContain("Marketing Funnel Performance");
    expect(scheduler).toContain("Recommended Actions");
  });

  it("does not allow scheduled Campaign DeepDive PDFs to fall back to metadata-only section names", () => {
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const builderStart = scheduler.indexOf("async function buildCampaignDeepDiveScheduledPdfAttachment");
    const builderEnd = scheduler.indexOf("export async function buildPdfAttachmentForReport", builderStart);
    const builder = scheduler.slice(builderStart, builderEnd);

    expect(builder).toContain('addText("Selected section content", { size: 14, bold: true });');
    expect(builder).toContain("selectedSections.forEach(addSelectedSectionBody);");
    expect(builder).toContain("addMetricRows([\"users\", \"sessions\", \"conversions\", \"revenue\", \"cvr\", \"impressions\", \"clicks\", \"spend\"]);");
    expect(builder).toContain("addSourceRows();");
    expect(builder).toContain("addKpiRows();");
    expect(builder).toContain("addBenchmarkRows();");
    expect(builder).toContain("addTrendRows([\"sessions\", \"users\", \"conversions\", \"revenue\", \"spend\", \"impressions\", \"clicks\"]);");
    expect(builder).not.toContain("This PDF includes the report header only.");
    expect(builder).not.toContain("For full interactive content, open the dashboard Reports tab.");
  });

  it("covers every Campaign DeepDive scheduled report tab with a body renderer", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const scheduler = readFileSync(join(process.cwd(), "server/report-scheduler.ts"), "utf-8");
    const reportTypeBlock = reports.slice(
      reports.indexOf("const campaignDeepDiveReportTypes = ["),
      reports.indexOf("const getCampaignReportTabs ="),
    );
    const tabKeys = Array.from(reportTypeBlock.matchAll(/key: "([^"]+:[^"]+)"/g)).map((match) => match[1]);
    const scheduledRendererGates: Record<string, string> = {
      "performance-summary": 'section.startsWith("performance-summary:")',
      "financial-analysis": 'section.startsWith("financial-analysis:")',
      "platform-comparison": 'section.startsWith("platform-comparison:")',
      "trend-analysis": 'section.startsWith("trend-analysis:")',
      "executive-summary:overview": 'section === "executive-summary:overview"',
    };

    expect(tabKeys.length).toBeGreaterThan(0);
    for (const key of tabKeys) {
      const gate = scheduledRendererGates[key] || scheduledRendererGates[key.split(":")[0]];
      expect(gate, `${key} should have scheduled PDF body handling`).toBeTruthy();
      expect(scheduler).toContain(gate);
      expect(scheduler).toContain(`"${key}":`);
    }
  });

  it("lets campaign-scoped reports choose Campaign DeepDive subsections and tabs", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const campaignDeepDiveReportTypes = [");
    expect(reports).toContain('label: "Budget & Financial Analysis"');
    expect(reports).toContain('label: "Platform Comparison"');
    expect(reports).toContain('label: "Trend Analysis"');
    expect(reports).toContain('label: "Executive Summary"');
    expect(reports).toContain('const campaignReportTypeOptions = editingReportId && reportType === "platform-comparison"');
    expect(reports).toContain('campaignDeepDiveReportTypes.filter((type) => type.key !== "platform-comparison")');
    expect(reports).toContain('campaignReportTypeOptions.map((type) => (');
    expect(reports.indexOf('label: "Performance Summary"')).toBeLessThan(reports.indexOf('label: "Budget & Financial Analysis"'));
    expect(reports.indexOf('label: "Budget & Financial Analysis"')).toBeLessThan(reports.indexOf('label: "Platform Comparison"'));
    expect(reports.indexOf('label: "Platform Comparison"')).toBeLessThan(reports.indexOf('label: "Trend Analysis"'));
    expect(reports.indexOf('label: "Trend Analysis"')).toBeLessThan(reports.indexOf('label: "Executive Summary"'));
    expect(reports).not.toContain('{ key: "custom", label: "Custom Report", tabs: customReportSections }');
    expect(reports).toContain('Select the tabs from this Campaign DeepDive subsection to include in the report.');
    expect(reports).toContain('selectedSections: activeCampaignId ? selectedReportSections : undefined,');
  });

  it("requires every Campaign DeepDive report type to have a dedicated PDF renderer", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const reportTypeBlock = reports.slice(
      reports.indexOf("const campaignDeepDiveReportTypes = ["),
      reports.indexOf("const getCampaignReportTabs ="),
    );
    const menuReportTypes = Array.from(reportTypeBlock.matchAll(/key: "([^":]+)"/g)).map((match) => match[1]);
    const dedicatedRendererGates: Record<string, string[]> = {
      "performance-summary": ['section.startsWith("performance-summary:")', "addPerformanceSummaryContent(section)"],
      "financial-analysis": ['section.startsWith("financial-analysis:")', "addFinancialAnalysisContent(section)"],
      "platform-comparison": ['section.startsWith("platform-comparison:")', "addPlatformComparisonContent(section)"],
      "trend-analysis": ['section.startsWith("trend-analysis:")', "addTrendAnalysisContent(section)"],
      "executive-summary": ['section === "executive-summary:overview"', "addExecutiveOverviewContent()", "addExecutiveRecommendationsContent()"],
    };

    expect(menuReportTypes).toEqual(Object.keys(dedicatedRendererGates));
    for (const gates of Object.values(dedicatedRendererGates)) {
      gates.forEach((gate) => expect(reports).toContain(gate));
    }
  });

  it("renders one consolidated Executive Summary PDF section with the live section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const reportTypeBlock = reports.slice(reports.indexOf('key: "executive-summary"'), reports.indexOf("];", reports.indexOf('key: "executive-summary"')));

    expect(reports).toContain('fetch(`/api/campaigns/${campaignContextId}/executive-summary`, { credentials: "include" })');
    expect(reportTypeBlock.match(/executive-summary:[a-z-]+/g)).toEqual(["executive-summary:overview"]);
    expect(reportTypeBlock).toContain('label: "Executive Summary"');
    expect(reports).toContain("let executiveSummaryIncluded = false;");
    expect(reports).toContain('return ["executive-summary:overview"];');
    expect(reports).toContain("const addExecutiveOverviewContent = () => {");
    expect(reports).toContain('if (section === "executive-summary:overview")');
    expect(reports).not.toContain('section === "executive-summary:recommendations"');
    expect(reports).toContain("addExecutiveOverviewContent();");
    expect(reports).toContain("addExecutiveRecommendationsContent();");
    expect(reports).toContain("7-Day Snapshot Trajectory");
    expect(reports).toContain("Risk Level");
    expect(reports).toContain("Executive Summary");
    expect(reports).toContain("Marketing Funnel Performance");
    expect(reports).toContain("KPI Exceptions");
    expect(reports).toContain("Benchmark Exceptions");
    expect(reports).toContain("Risk Assessment");
    expect(reports).toContain('currentValueWindow?.mode === "initial_import_to_latest_completed_day"');
    expect(reports).toContain('`the ${currentValueWindow.startDate} to ${currentValueWindow.endDate} reporting window`');
    expect(reports).toContain("for ${executiveWindowDescription}.");
    expect(reports).toContain('GA4-native outcomes cover ${executiveWindowDescription}; connected ${customReportSourceToDateFinancialLabel}');
    expect(reports).toContain('source-to-date through ${currentValueWindow.endDate}. Combined connected-source financial metrics show');
  });

  it("keeps consolidated Executive Summary PDF actions evidence-backed and non-speculative", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const recommendationsStart = reports.indexOf("const addExecutiveRecommendationsContent = () => {");
    const recommendationsEnd = reports.indexOf("const addMetricList =", recommendationsStart);
    const recommendations = reports.slice(recommendationsStart, recommendationsEnd);

    expect(recommendations).toContain("customReportHasWebAnalyticsOutcomeEvidence");
    expect(recommendations).toContain("customReportHasWebsiteOutcomeTargetException");
    expect(recommendations).toContain('category: "Website Outcomes"');
    expect(recommendations).toContain('action: "Review website conversion path before making paid-media budget decisions"');
    expect(recommendations).not.toContain("campaignExecutiveSummary.recommendations");
    expect(recommendations).toContain("Data Accuracy Notice");
    expect(recommendations).toContain("Data Freshness Alert");
    expect(recommendations).toContain("Recommended Actions");
    expect(recommendations).toContain("No Evidence-Backed Actions Available");
    expect(recommendations).not.toContain("Enterprise Disclaimer");
    expect(recommendations).not.toContain("Projected Scenarios");
    expect(recommendations).not.toContain("Investment Required:");
    expect(recommendations).not.toContain("Recommendation Disclaimer");
  });

  it("renders Performance Summary PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const addPerformanceSummaryContent = (section: string) => {");
    expect(reports).toContain('section.startsWith("performance-summary:")');
    expect(reports).toContain("Campaign Health");
    expect(reports).toContain("Top Priority Action");
    expect(reports).toContain("Aggregated Metrics Snapshot");
    expect(reports).toContain("Overall Health Summary");
    expect(reports).toContain("KPIs On Track or Above");
    expect(reports).toContain("Benchmarks On Track");
    expect(reports).toContain("Key Performance Indicators (KPIs)");
    expect(reports).toContain("Data Sources");
    expect(reports).toContain("What's Changed");
    expect(reports).toContain("Metric Trends");
    expect(reports).toContain("Data-Driven Insights & Recommendations");
    expect(reports).toContain("Performance Analysis");
  });

  it("renders Budget & Financial Analysis PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const addFinancialAnalysisContent = (section: string) => {");
    expect(reports).toContain('queryKey: ["/api/campaigns", campaignContextId],');
    expect(reports).toContain('section.startsWith("financial-analysis:")');
    expect(reports).toContain("Campaign Health Score");
    expect(reports).toContain("Score");
    expect(reports).toContain("Rating");
    expect(reports).toContain("Pacing Status");
    expect(reports).toContain("Campaign ROI");
    expect(reports).toContain("Campaign ROAS");
    expect(reports).toContain("Key Financial Metrics");
    expect(reports).toContain('addFinancialMetricRow("Total Revenue", "revenue");');
    expect(reports).toContain('addRow("Profit", metricAvailable("revenue") && metricAvailable("spend") ? formatCustomReportMetricValue("revenue", revenue - spend) : "Unavailable");');
    expect(reports).not.toContain('`${pacingPercentage === null ? "Unavailable" : `${pacingPercentage.toFixed(1)}%`} - ${pacingHealthStatus}`');
    expect(reports).toContain("Budget Utilization");
    expect(reports).toContain("Budget Used");
    expect(reports).toContain("Remaining");
    expect(reports).toContain("Budget Pacing & Burn Rate");
    expect(reports).toContain("Daily Burn Rate");
    expect(reports).toContain("Daily Burn Rate Basis");
    expect(reports).toContain("Target Daily Spend");
    expect(reports).toContain("Campaign Budget");
    expect(reports).toContain("Budget Period Start");
    expect(reports).toContain("Budget Period End");
    expect(reports).toContain("campaignFinancialContext?.pacingStartDate");
    expect(reports).toContain("campaignFinancialContext?.pacingEndDate");
    expect(reports).toContain("Cost Efficiency Metrics");
    expect(reports).toContain("ROI & ROAS Analysis");
    expect(reports).toContain("Return on Ad Spend (ROAS)");
    expect(reports).toContain("Return on Investment (ROI)");
    expect(reports).toContain("Net Profit");
    expect(reports).toContain("Investment");
    expect(reports).toContain("Source ROAS Performance");
    expect(reports).toContain("Source ROI Performance");
    expect(reports).toContain("Financial Inputs");
    expect(reports).toContain("Revenue");
    expect(reports).toContain("Spend");
    expect(reports).toContain("Cost Analysis Breakdown");
    expect(reports).toContain("Cost Metrics");
    expect(reports).toContain("Efficiency Indicators");
    expect(reports).toContain("Performance-Based Budget Allocation");
    expect(reports).toContain("Performance Tiers");
    expect(reports).toContain("Source Budget Analysis");
    expect(reports).toContain("Allocation Guidance");
    expect(reports).toContain("Financial Performance Insights");
    expect(reports).toContain("Performance Summary");
    expect(reports).toContain("Cost Efficiency");
    expect(reports).toContain("Budget Management");
    expect(reports).toContain("Source Performance Insights");
    expect(reports).toContain("Source Data Status");
    expect(reports).toContain("Key Opportunities");
    expect(reports).toContain("Budget Underutilized");
    expect(reports).toContain("Conversion Rate Optimization");
    expect(reports).toContain("Improve Ad Engagement");
    expect(reports).toContain("Budget Capacity");
    expect(reports).toContain("Budget Optimization Recommendations");
    expect(reports).toContain("Budget Reallocation Opportunity");
    expect(reports).toContain("Cost Optimization Insights");
  });

  it("renders Platform Comparison PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const addPlatformComparisonContent = (section: string) => {");
    expect(reports).toContain('section.startsWith("platform-comparison:")');
    expect(reports).toContain("Platform Performance Summary Cards");
    expect(reports).toContain("Channel Performance Overview");
    expect(reports).toContain("Revenue Tracking Platforms");
    expect(reports).toContain("Total Revenue (All Tracking Sources)");
    expect(reports).toContain("Detailed Performance Metrics");
    expect(reports).toContain("Efficiency Comparison");
    expect(reports).toContain("Volume Comparison");
    expect(reports).toContain("Cost per Conversion");
    expect(reports).toContain("Budget Allocation");
    expect(reports).toContain("Return on Investment (ROI) & Return on Ad Spend (ROAS)");
    expect(reports).toContain("No paid-media platform connected");
    expect(reports).toContain("Platform Performance Insights");
    expect(reports).toContain("Platform Summary");
    expect(reports).toContain("Available Source Metrics");
    expect(reports).toContain("Paid-Media Comparison Unavailable");
    expect(reports).toContain("Data Source Analysis");
    expect(reports).toContain("Top Performer");
    expect(reports).toContain("Volume Leader");
    expect(reports).toContain("Highest Engagement");
    expect(reports).toContain("Optimization Opportunity");
    expect(reports).toContain("Strategic Recommendations");
  });

  it("renders Trend Analysis PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const addTrendAnalysisContent = (section: string) => {");
    expect(reports).toContain("fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/trend-analysis?dateRange=90days&days=180`)");
    expect(reports).toContain('section.startsWith("trend-analysis:")');
    expect(reports).toContain("Cross-Platform Performance");
    expect(reports).toContain("Summary Metrics");
    expect(reports).toContain("Anomaly Detection");
    expect(reports).toContain("ROAS & ROI Trend");
    expect(reports).toContain("Cost Efficiency Trend");
    expect(reports).toContain("Website Conversion Funnel");
    expect(reports).toContain("Paid-Media Funnel");
    expect(reports).toContain("Platform Performance Comparison");
    expect(reports).toContain("Spend Distribution");
    expect(reports).toContain("Efficiency Comparison");
    expect(reports).toContain("Trend Performance Insights");
  });

  it("maps Campaign DeepDive KPI and Benchmark report sections directly to GA4 records", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('queryKey: ["/api/platforms/google_analytics/kpis", campaignContextId],');
    expect(reports).toContain('queryKey: ["/api/platforms/google_analytics/benchmarks", campaignContextId],');
    expect(reports).toContain('fetchReportJson(`/api/platforms/google_analytics/kpis?campaignId=${encodedReportCampaignId}`)');
    expect(reports).toContain('fetchReportJson(`/api/platforms/google_analytics/benchmarks?campaignId=${encodedReportCampaignId}`)');
    expect(reports).not.toContain('queryKey: [`/api/campaigns/${campaignContextId}/kpis`],');
    expect(reports).not.toContain('queryKey: [`/api/campaigns/${campaignContextId}/benchmarks`],');
    expect(reports).toContain("const resolveCustomReportAggregateMetric = (record: any): string | null => {");
    expect(reports).toContain("const renderCustomReportKpiBenchmarkOutput = (report: StoredReport) => {");
    expect(reports).toContain("Current: {formatCustomReportRecordValue(record, record?.currentValue)}");
    expect(reports).toContain("Target: {formatCustomReportRecordValue(record, record?.[targetField])}");
    expect(reports).toContain("const current = reportRecordCurrentValue(kpi);");
    expect(reports).toContain("const current = reportRecordCurrentValue(bm);");
    expect(reports).toContain('selectedSections: activeCampaignId ? selectedReportSections : undefined,');
    expect(reports).toContain("classifyKpiBandWithPolicy");
    expect(reports).toContain("const kpiBand = (kpi: any) => {");
    expect(reports).toContain("const policy = resolveKpiThresholdPolicy({");
    expect(reports).toContain('return classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy }) ?? "below";');
    expect(reports).toContain("const band = kpiBand(kpi);");
    expect(reports).not.toContain('return pct > 105 ? "Above Target" : pct >= 95 ? "On Track" : "Below Target";');
    expect(reports).not.toContain("{renderCustomReportKpiBenchmarkOutput(report)}");
  });

  it("covers the production-ready connected-source regression gates", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const campaignDetail = readFileSync(join(process.cwd(), "client/src/pages/campaign-detail.tsx"), "utf-8");
    const app = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf-8");

    expect(campaignDetail).toContain('<Link href={`/reports?campaignId=${encodeURIComponent(campaign.id)}`}>');
    expect(app).toContain('<Route path="/reports" component={Reports} />');
    expect(reports).toContain('source?.connected === true && source?.category !== "financial"');
    expect(reports).toContain('return source?.category === "paid_media" && includedMetrics.some((metric: string) => customReportPaidMetricKeys.has(metric));');
    expect(reports).toContain(".filter((key) => !customReportPaidMetricKeys.has(key) || hasCustomReportPaidMediaSource);");
    expect(reports).toContain("Unavailable${reason ? ` - ${reason}` : \"\"}");
    expect(reports).toContain('report.campaignId !== campaignContextId || report.type !== "custom"');
  });
});
