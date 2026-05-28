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
    expect(reports).toContain("setSelectedReportMetrics(customReportSelectableMetricKeys);");
    expect(reports).toContain("group.keys.filter((key) => customReportSelectableMetricSet.has(key))");
    expect(reports).toContain("Unavailable paid-media metrics are hidden until a connected source provides them.");
    expect(reports).toContain('selectedMetrics: reportType === "custom" && activeCampaignId ? selectedReportMetrics : undefined,');
    expect(reports).toContain('selectedReportSections.includes("metrics") && selectedReportMetrics.length === 0');
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

  it("maps custom report KPI and Benchmark sections to campaign records and aggregate current values", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");

    expect(reports).toContain('queryKey: [`/api/campaigns/${campaignContextId}/kpis`],');
    expect(reports).toContain('queryKey: [`/api/campaigns/${campaignContextId}/benchmarks`],');
    expect(reports).toContain("const resolveCustomReportAggregateMetric = (record: any): string | null => {");
    expect(reports).toContain("customReportPerformanceSummary?.totals?.[metricName]?.available === true");
    expect(reports).toContain("const renderCustomReportKpiBenchmarkOutput = (report: StoredReport) => {");
    expect(reports).toContain("Current: {metric?.available === true ? formatCustomReportMetricValue(metricKey!, metric.value) : \"Unavailable\"}");
    expect(reports).toContain('selectedSections: reportType === "custom" && activeCampaignId ? selectedReportSections : undefined,');
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
