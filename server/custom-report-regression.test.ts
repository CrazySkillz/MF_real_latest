import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Custom Report regression guard", () => {
  it("preserves campaign context from the Campaign DeepDive launcher", () => {
    const campaignDetail = readFileSync(join(process.cwd(), "client/src/pages/campaign-detail.tsx"), "utf-8");

    expect(campaignDetail).toContain('<Link href={`/reports?campaignId=${encodeURIComponent(campaign.id)}`}>');
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
    expect(reports).toContain("disabled={!isReportFormValid || !isReportFormChanged}");
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
    expect(reports).not.toContain('Scheduled reports are saved in this browser only right now. Automated email delivery is not connected for Custom Reports yet.');
    expect(reports).not.toContain('Schedule Automated Reports');
    expect(reports).not.toContain('Schedule Automatic Generation');
    expect(reports).not.toContain('variant={!editingReportId && scheduleEnabled ? "link" : "default"}');
    expect(reports).toContain("const downloadReportPdf = async (report: StoredReport) => {");
    expect(reports).toContain("const { jsPDF } = await import('jspdf');");
    expect(reports).toContain('await downloadReportPdf(savedReport);');
    expect(reports).toContain('selectedSections.forEach((section) => addText(`- ${getReportTabLabel(report.type, section)}`, { indent: 4 }));');
    expect(reports).toContain('const addDeepDiveSectionContent = (section: string) => {');
    expect(reports).toContain('selectedSections.forEach(addDeepDiveSectionContent);');
    expect(reports).toContain('addMetricList(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);');
    expect(reports).toContain('addSourceList();');
  });

  it("regenerates latest report downloads from freshly refetched campaign inputs", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("refetch: refetchCampaignOutcomeTotals");
    expect(reports).toContain("refetch: refetchCampaignExecutiveSummary");
    expect(reports).toContain("refetch: refetchCampaignFinancialContext");
    expect(reports).toContain("refetch: refetchCampaignKpis");
    expect(reports).toContain("refetch: refetchCampaignBenchmarks");
    expect(reports).toContain("const reportCampaignId = report.campaignId || campaignContextId;");
    expect(reports).toContain("const shouldRefreshCurrentCampaignContext = !!reportCampaignId && reportCampaignId === campaignContextId;");
    expect(reports).toContain("await Promise.all([");
    expect(reports).toContain("refetchCampaignOutcomeTotals()");
    expect(reports).toContain("fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/outcome-totals?dateRange=90days`).then((data) => ({ data }))");
    expect(reports).toContain("fetchReportJson(`/api/campaigns/${encodedReportCampaignId}/executive-summary`).then((data) => ({ data }))");
    expect(reports).toContain("const latestCampaignOutcomeTotals = latestOutcomeTotalsResult?.data ?? campaignOutcomeTotals;");
    expect(reports).toContain("const customReportPerformanceSummary = latestCampaignOutcomeTotals?.performanceSummary;");
    expect(reports).toContain("const campaignKpis: any[] = Array.isArray(latestKpisResult?.data) ? latestKpisResult.data : liveCampaignKpis;");
    expect(reports).toContain("const campaignBenchmarks: any[] = Array.isArray(latestBenchmarksResult?.data) ? latestBenchmarksResult.data : liveCampaignBenchmarks;");
  });

  it("routes generated reports to Standard Reports and scheduled reports to Scheduled Reports", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const standardReports = allStoredReports.filter(report => report.status === 'Generated');");
    expect(reports).toContain("const storedScheduledReports = allStoredReports.filter(report => (report.status === 'Scheduled' || report.status === 'Paused') && report.schedule);");
    expect(reports).toContain('<Tabs defaultValue="standard" className="space-y-6">');
    expect(reports).toContain('<TabsTrigger value="standard">Standard Reports</TabsTrigger>');
    expect(reports.indexOf('<TabsTrigger value="standard">Standard Reports</TabsTrigger>')).toBeLessThan(reports.indexOf('<TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>'));
    expect(reports.indexOf('<TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>')).toBeLessThan(reports.indexOf('<TabsTrigger value="all">All Reports</TabsTrigger>'));
    expect(reports).toContain('<TabsContent value="standard">');
    expect(reports).toContain("standardReports.map((report) => (");
    expect(reports).toContain("storedScheduledReports.map((report) => (");
    const scheduledTab = reports.slice(reports.indexOf('<TabsContent value="scheduled"'), reports.indexOf('<TabsContent value="all"'));
    expect(scheduledTab).toContain("onClick={() => openEditReport(report)}");
    expect(scheduledTab).toContain("onClick={() => downloadReportPdf(report)}");
    expect(scheduledTab).toContain("Download last sent report");
    expect(scheduledTab).toContain('report.status === "Paused" ? resumeScheduledReport(report) : pauseScheduledReport(report)');
    expect(scheduledTab).toContain('{report.status === "Paused" ? "Resume" : "Pause"}');
    expect(scheduledTab).toContain('{report.status === "Paused" ? "Paused" : "Enabled"}');
    expect(scheduledTab).not.toContain("<Badge");
    expect(scheduledTab).not.toContain("Settings");
    expect(reports).toContain("const getReportSelectedTabSummary = (report: StoredReport) => {");
    expect(scheduledTab).toContain("{getReportSelectedTabSummary(report)}");
    expect(reports).toContain("No scheduled reports yet");
    expect(reports).toContain("Use Schedule Report to create an automated report.");
    expect(reports).not.toContain("const scheduledReports = [");
    expect(reports).not.toContain("scheduledReports.map((report) => (");
    expect(reports).toContain("Download latest report");
    expect(reports).toContain('<SelectItem value="Paused">Paused</SelectItem>');
    expect(reports).toContain("{report.description && (");
    expect(reports).toContain('<p className="text-sm text-muted-foreground">{report.description}</p>');
    expect(reports).not.toContain('<span className="font-medium text-foreground">Format:</span>');
    expect(reports).not.toContain("Report Templates");
  });

  it("confirms report deletion and lists connected sources without metric-key noise", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const [reportPendingDelete, setReportPendingDelete] = useState<StoredReport | null>(null);");
    expect(reports).toContain("onClick={() => setReportPendingDelete(report)}");
    expect(reports).toContain("reportStorage.deleteReport(reportPendingDelete.id);");
    expect(reports).toContain("reportPendingDelete.backendReportId");
    expect(reports).toContain('method: "DELETE"');
    expect(reports).toContain("<AlertDialog open={!!reportPendingDelete}");
    expect(reports).toContain("<AlertDialogTitle>Delete report?</AlertDialogTitle>");
    expect(reports).toContain("This action cannot be undone.");
    expect(reports).toContain("Campaign connected-source data");
    expect(reports).toContain("customReportSources.map((source: any) => (");
    expect(reports).not.toContain("Selectable metrics:");
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
    expect(reports).toContain('body: JSON.stringify({ scheduleEnabled: false, status: "paused" }),');
    expect(reports).toContain("if (backendReportId) await disableBackendScheduledReport(backendReportId, backendPlatformType);");
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

  it("lets campaign-scoped reports choose Campaign DeepDive subsections and tabs", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const campaignDeepDiveReportTypes = [");
    expect(reports).toContain('label: "Budget & Financial Analysis"');
    expect(reports).toContain('label: "Platform Comparison"');
    expect(reports).toContain('label: "Trend Analysis"');
    expect(reports).toContain('label: "Executive Summary"');
    expect(reports).toContain('campaignDeepDiveReportTypes.map((type) => (');
    expect(reports.indexOf('label: "Performance Summary"')).toBeLessThan(reports.indexOf('label: "Budget & Financial Analysis"'));
    expect(reports.indexOf('label: "Budget & Financial Analysis"')).toBeLessThan(reports.indexOf('label: "Platform Comparison"'));
    expect(reports.indexOf('label: "Platform Comparison"')).toBeLessThan(reports.indexOf('label: "Trend Analysis"'));
    expect(reports.indexOf('label: "Trend Analysis"')).toBeLessThan(reports.indexOf('label: "Executive Summary"'));
    expect(reports).not.toContain('{ key: "custom", label: "Custom Report", tabs: customReportSections }');
    expect(reports).toContain('Select the tabs from this Campaign DeepDive subsection to include in the report.');
    expect(reports).toContain('selectedSections: activeCampaignId ? selectedReportSections : undefined,');
  });

  it("renders Executive Overview PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('fetch(`/api/campaigns/${campaignContextId}/executive-summary`, { credentials: "include" })');
    expect(reports).toContain("const addExecutiveOverviewContent = () => {");
    expect(reports).toContain('if (section === "executive-summary:overview")');
    expect(reports).toContain("7-Day Snapshot Trajectory");
    expect(reports).toContain("Risk Level");
    expect(reports).toContain("Executive Summary");
    expect(reports).toContain("Marketing Funnel Performance");
    expect(reports).toContain("KPI Progress");
    expect(reports).toContain("Benchmark Comparison");
    expect(reports).toContain("Risk Assessment");
  });

  it("renders Strategic Recommendations PDF exports with the live tab section set", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const addExecutiveRecommendationsContent = () => {");
    expect(reports).toContain('section === "executive-summary:recommendations"');
    expect(reports).toContain("Data Accuracy Notice");
    expect(reports).toContain("Data Freshness Alert");
    expect(reports).toContain("Enterprise Disclaimer");
    expect(reports).toContain("No Recommendations Available");
    expect(reports).toContain("Expected Impact");
    expect(reports).toContain("Timeframe:");
    expect(reports).toContain("Investment Required:");
    expect(reports).toContain("Projected Scenarios");
    expect(reports).toContain("Key Assumptions");
    expect(reports).toContain("Recommendation Disclaimer");
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
    expect(reports).toContain("Budget Utilization");
    expect(reports).toContain("Budget Used");
    expect(reports).toContain("Remaining");
    expect(reports).toContain("Budget Pacing & Burn Rate");
    expect(reports).toContain("Daily Burn Rate");
    expect(reports).toContain("Daily Burn Rate Basis");
    expect(reports).toContain("Target Daily Spend");
    expect(reports).toContain("Campaign Budget");
    expect(reports).toContain("Start Date");
    expect(reports).toContain("End Date");
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

  it("maps custom report KPI and Benchmark sections to campaign records and aggregate current values", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('queryKey: [`/api/campaigns/${campaignContextId}/kpis`],');
    expect(reports).toContain('queryKey: [`/api/campaigns/${campaignContextId}/benchmarks`],');
    expect(reports).toContain("const resolveCustomReportAggregateMetric = (record: any): string | null => {");
    expect(reports).toContain("customReportPerformanceSummary?.totals?.[metricName]?.available === true");
    expect(reports).toContain("const renderCustomReportKpiBenchmarkOutput = (report: StoredReport) => {");
    expect(reports).toContain("Current: {metric?.available === true ? formatCustomReportMetricValue(metricKey!, metric.value) : \"Unavailable\"}");
    expect(reports).toContain('selectedSections: activeCampaignId ? selectedReportSections : undefined,');
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
