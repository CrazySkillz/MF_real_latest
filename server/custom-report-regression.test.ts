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
  });

  it("keeps create mode blank and separates download from scheduling", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('const [reportType, setReportType] = useState("");');
    expect(reports).toContain('const [selectedReportSections, setSelectedReportSections] = useState<string[]>([]);');
    expect(reports).toContain('<SelectValue placeholder="Select report type" />');
    expect(reports).toContain('Schedule Automated Reports');
    expect(reports).not.toContain('Schedule Automatic Generation');
    expect(reports).toContain("const downloadReportPdf = async (report: StoredReport) => {");
    expect(reports).toContain("const { jsPDF } = await import('jspdf');");
    expect(reports).toContain('await downloadReportPdf(savedReport);');
    expect(reports).toContain('selectedSections.forEach((section) => addText(`- ${getReportTabLabel(report.type, section)}`, { indent: 4 }));');
  });

  it("lets campaign-scoped reports choose Campaign DeepDive subsections and tabs", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain("const campaignDeepDiveReportTypes = [");
    expect(reports).toContain('label: "Executive Summary"');
    expect(reports).toContain('label: "Budget & Financial Analysis"');
    expect(reports).toContain('label: "Platform Comparison"');
    expect(reports).toContain('label: "Trend Analysis"');
    expect(reports).toContain('label: "Custom Report"');
    expect(reports).toContain('campaignDeepDiveReportTypes.map((type) => (');
    expect(reports).toContain('Select the tabs from this Campaign DeepDive subsection to include in the report.');
    expect(reports).toContain('selectedSections: activeCampaignId ? selectedReportSections : undefined,');
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
