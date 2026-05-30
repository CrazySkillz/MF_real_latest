import { db } from "./db";
import { emailService } from "./services/email-service";
import { storage } from "./storage";
import { campaigns, emailAlertEvents, linkedinReports, reportSendEvents, reportSnapshots } from "../shared/schema";
import { and, desc, eq } from "drizzle-orm";
import type { LinkedInReport } from "../shared/schema";
import * as cron from "node-cron";
import { DateTime } from "luxon";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { aggregateCampaignMetrics } from "./scheduler";

/**
 * Report Scheduler - Automated Email Reports
 * Checks for scheduled reports and sends them via email
 */

interface ReportWithCampaign extends LinkedInReport {
  campaignId: string | null;
  platformType: string;
}

// Monitoring metrics for scheduler health
const schedulerMetrics = {
  totalChecks: 0,
  totalSent: 0,
  totalFailed: 0,
  lastCheckTime: null as Date | null,
  lastSuccessTime: null as Date | null,
  lastErrorTime: null as Date | null,
  lastError: null as string | null,
};

async function getLatestReportEmailError(reportId: string): Promise<string> {
  const rows = await db
    .select({ provider: emailAlertEvents.provider, error: emailAlertEvents.error })
    .from(emailAlertEvents)
    .where(and(
      eq(emailAlertEvents.kind, "report"),
      eq(emailAlertEvents.entityType, "report"),
      eq(emailAlertEvents.entityId, reportId),
      eq(emailAlertEvents.success, false),
    ))
    .orderBy(desc(emailAlertEvents.createdAt))
    .limit(1)
    .catch(() => []);
  const row = rows[0];
  const error = String(row?.error || "").trim();
  const provider = String(row?.provider || "").trim();
  return error ? `${provider ? `${provider}: ` : ""}${error}` : "";
}

async function getLatestReportEmailAudit(reportId: string, success: boolean): Promise<{ provider: string; error: string; providerResponseId: string }> {
  const rows = await db
    .select({ provider: emailAlertEvents.provider, error: emailAlertEvents.error, metadata: emailAlertEvents.metadata })
    .from(emailAlertEvents)
    .where(and(
      eq(emailAlertEvents.kind, "report"),
      eq(emailAlertEvents.entityType, "report"),
      eq(emailAlertEvents.entityId, reportId),
      eq(emailAlertEvents.success, success),
    ))
    .orderBy(desc(emailAlertEvents.createdAt))
    .limit(1)
    .catch(() => []);
  const row = rows[0] as any;
  let providerResponseId = "";
  try {
    providerResponseId = String(JSON.parse(String(row?.metadata || "{}"))?.providerResponseId || "").trim();
  } catch {
    providerResponseId = "";
  }
  return {
    provider: String(row?.provider || "").trim(),
    error: String(row?.error || "").trim(),
    providerResponseId,
  };
}

async function waitForMailgunDelivery(providerResponseId: string): Promise<{ status: string; error?: string }> {
  const domain = process.env.MAILGUN_DOMAIN;
  const apiKey = process.env.MAILGUN_API_KEY;
  if (!domain || !apiKey || !providerResponseId) return { status: "not_checked" };
  const region = process.env.MAILGUN_REGION || "us";
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net/v3" : "https://api.mailgun.net/v3";
  const messageIds = Array.from(new Set([providerResponseId, providerResponseId.replace(/^<|>$/g, "")].filter(Boolean)));

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 2500));
    for (const messageId of messageIds) {
      const params = new URLSearchParams();
      params.set("message-id", messageId);
      params.set("limit", "10");
      const response = await fetch(`${baseUrl}/${domain}/events?${params.toString()}`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      });
      if (!response.ok) return { status: "not_checked", error: await response.text().catch(() => "") };
      const data = await response.json().catch(() => ({}));
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const delivered = items.find((item: any) => String(item?.event || "").toLowerCase() === "delivered");
      if (delivered) return { status: "delivered" };
      const failed = items.find((item: any) => ["failed", "rejected"].includes(String(item?.event || "").toLowerCase()));
      if (failed) return { status: "failed", error: String(failed?.["delivery-status"]?.message || failed?.reason || failed?.event || "Mailgun delivery failed") };
    }
  }

  return { status: "pending" };
}

function coercePdfBufferFromDoc(doc: any): Buffer | null {
  // Try the most reliable forms across Node runtimes and bundlers.
  try {
    const nb = doc.output("nodebuffer");
    if (nb) {
      const buf = Buffer.isBuffer(nb) ? nb : Buffer.from(nb as any);
      if (buf.length > 100) return buf;
    }
  } catch {
    // fallthrough
  }

  try {
    const ab = doc.output("arraybuffer");
    const byteLen = (ab && (ab.byteLength ?? (ab as any).length)) || 0;
    if (byteLen && byteLen > 100) {
      // Node supports Buffer.from(ArrayBuffer) and Buffer.from(Uint8Array)
      try {
        return Buffer.from(ab as any);
      } catch {
        try {
          return Buffer.from(new Uint8Array(ab));
        } catch {
          // fallthrough
        }
      }
    }
  } catch {
    // fallthrough
  }

  try {
    const dataUri = doc.output("datauristring");
    const base64 = String(dataUri || "").split(",")[1] || "";
    const buf = base64 ? Buffer.from(base64, "base64") : null;
    if (buf && buf.length > 100) return buf;
  } catch {
    // fallthrough
  }

  return null;
}

function formatNumberLike(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  // Keep 0-2 decimals, avoid trailing ".00" unless needed.
  const rounded = Math.round(n * 100) / 100;
  const str = String(rounded);
  return str.includes(".") ? str.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") : str;
}

function formatWithUnit(value: any, unit: any): string {
  const v = formatNumberLike(value);
  const u = String(unit || "").trim();
  if (!v) return u ? `0${u}` : "0";
  if (!u) return v;
  if (u === "$") return `$${v}`;
  if (u === "%") return `${v}%`;
  return `${v}${u}`;
}

const campaignDeepDiveReportTypeLabels: Record<string, string> = {
  "performance-summary": "Performance Summary",
  "financial-analysis": "Budget & Financial Analysis",
  "platform-comparison": "Platform Comparison",
  "trend-analysis": "Trend Analysis",
  "executive-summary": "Executive Summary",
};

const campaignDeepDiveTabLabels: Record<string, string> = {
  "performance-summary:overview": "Overview",
  "performance-summary:health": "Campaign Health",
  "performance-summary:changes": "What's Changed",
  "performance-summary:insights": "Insights",
  "financial-analysis:overview": "Overview",
  "financial-analysis:roi-roas": "ROI & ROAS",
  "financial-analysis:costs": "Cost Analysis",
  "financial-analysis:budget": "Budget Allocation",
  "financial-analysis:insights": "Insights",
  "platform-comparison:overview": "Overview",
  "platform-comparison:performance": "Performance Metrics",
  "platform-comparison:cost-analysis": "Financial Comparison",
  "platform-comparison:insights": "Insights",
  "trend-analysis:overview": "Overview",
  "trend-analysis:efficiency": "Efficiency Metrics",
  "trend-analysis:funnel": "Conversion Funnel",
  "trend-analysis:platforms": "Platform Breakdown",
  "trend-analysis:insights": "Insights",
  "executive-summary:overview": "Executive Overview",
  "executive-summary:recommendations": "Strategic Recommendations",
};

const campaignDeepDiveMetricLabels: Record<string, string> = {
  users: "Users",
  sessions: "Sessions",
  conversions: "Conversions",
  revenue: "Revenue",
  cvr: "Conversion rate",
  impressions: "Impressions",
  clicks: "Clicks",
  spend: "Spend",
  ctr: "Click-through rate",
  cpc: "Cost per click",
  cpm: "Cost per thousand impressions",
  cpa: "Cost per acquisition",
  roas: "ROAS",
  roi: "ROI",
  leads: "Leads",
};

const campaignDeepDiveMetricAliases: Record<string, string> = {
  totalusers: "users",
  users: "users",
  user: "users",
  totalsessions: "sessions",
  sessions: "sessions",
  totalrevenue: "revenue",
  revenue: "revenue",
  totalconversions: "conversions",
  conversions: "conversions",
  totalspend: "spend",
  spend: "spend",
  totalclicks: "clicks",
  clicks: "clicks",
  totalimpressions: "impressions",
  impressions: "impressions",
  conversionrate: "cvr",
  cvr: "cvr",
  ctr: "ctr",
  cpc: "cpc",
  cpm: "cpm",
  cpa: "cpa",
  roas: "roas",
  roi: "roi",
};

function formatCampaignDeepDiveMetricValue(key: string, value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "Unavailable";
  if (["revenue", "spend", "cpc", "cpa", "cpm"].includes(key)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
  }
  if (["ctr", "cvr", "roi"].includes(key)) return `${n.toFixed(1)}%`;
  if (key === "roas") return `${n.toFixed(1)}x`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

const normalizeCampaignDeepDiveMetricKey = (value: unknown): string =>
  String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

async function buildCampaignDeepDiveScheduledPdfAttachment(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const cfg = typeof report?.configuration === "string"
    ? JSON.parse(report.configuration || "{}")
    : (report?.configuration || {});
  const reportType = String(cfg?.reportType || "").trim();
  const selectedSections = Array.isArray(cfg?.selectedSections) ? cfg.selectedSections.map(String).filter(Boolean) : [];
  const selectedMetrics = Array.isArray(cfg?.selectedMetrics) ? cfg.selectedMetrics.map(String).filter(Boolean) : [];
  const campaignId = String(report?.campaignId || cfg?.campaignId || "").trim();
  const [campaignMetrics, campaign, kpis, benchmarks] = campaignId
    ? await Promise.all([
        aggregateCampaignMetrics(campaignId).catch(() => null),
        storage.getCampaign(campaignId).catch(() => null),
        storage.getCampaignKPIs(campaignId).catch(() => []),
        storage.getCampaignBenchmarks(campaignId).catch(() => []),
      ])
    : [null, null, [], []];
  const performanceSummary = (campaignMetrics as any)?.detailedMetrics?.performanceSummary;
  const trendAnalysis = (campaignMetrics as any)?.detailedMetrics?.trendAnalysis;
  const aggregateSources = Array.isArray(performanceSummary?.sources)
    ? performanceSummary.sources.filter((source: any) => source?.connected === true && source?.category !== "financial")
    : [];
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  const addText = (value: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) => {
    const indent = opts.indent || 0;
    doc.setFontSize(opts.size || 10);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(String(value || ""), pageWidth - margin * 2 - indent);
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += opts.size && opts.size >= 14 ? 8 : 6;
    });
  };

  const metric = (key: string) => performanceSummary?.totals?.[key];
  const metricAvailable = (key: string) => metric(key)?.available === true;
  const metricNumber = (key: string) => metricAvailable(key) ? Number(metric(key)?.value) || 0 : 0;
  const metricValue = (key: string) => {
    const value = metric(key);
    if (value?.available === true) return formatCampaignDeepDiveMetricValue(key, value.value);
    const reason = Array.isArray(value?.unavailableReasons) ? value.unavailableReasons[0] : "";
    return `Unavailable${reason ? ` - ${reason}` : ""}`;
  };
  const resolveAggregateMetric = (record: any) => {
    for (const candidate of [record?.metricKey, record?.metric, record?.metricType, record?.name]) {
      const key = campaignDeepDiveMetricAliases[normalizeCampaignDeepDiveMetricKey(candidate)];
      if (key && metricAvailable(key)) return key;
    }
    return null;
  };
  const addMetricRows = (keys: string[], indent = 8) => {
    if (!performanceSummary) {
      addText("- Connected-source aggregate values are unavailable.", { indent });
      return;
    }
    keys.forEach((key) => addText(`- ${campaignDeepDiveMetricLabels[key] || key}: ${metricValue(key)}`, { indent }));
  };
  const addSourceRows = (indent = 8) => {
    if (aggregateSources.length === 0) {
      addText("- No connected main sources available.", { indent });
      return;
    }
    aggregateSources.forEach((source: any) => {
      const included = Array.isArray(source?.includedMetrics) ? source.includedMetrics.join(", ") : "none";
      addText(`- ${source?.label || source?.id}: ${included}`, { indent });
    });
  };
  const addKpiRows = (indent = 8) => {
    const mapped = (Array.isArray(kpis) ? kpis : [])
      .map((row: any) => ({ row, key: resolveAggregateMetric(row) }))
      .filter((item: any) => item.key);
    if (mapped.length === 0) {
      addText("- No mapped campaign KPI rows available.", { indent });
      return;
    }
    mapped.forEach((item: any) => {
      const target = Number(item.row?.targetValue ?? item.row?.target) || 0;
      addText(`- ${item.row?.name || item.row?.metric || "KPI"}: Current ${metricValue(item.key)}; Target ${formatCampaignDeepDiveMetricValue(item.key, target)}`, { indent });
    });
  };
  const addBenchmarkRows = (indent = 8) => {
    const mapped = (Array.isArray(benchmarks) ? benchmarks : [])
      .map((row: any) => ({ row, key: resolveAggregateMetric(row) }))
      .filter((item: any) => item.key);
    if (mapped.length === 0) {
      addText("- No mapped campaign Benchmark rows available.", { indent });
      return;
    }
    mapped.forEach((item: any) => {
      const target = Number(item.row?.benchmarkValue ?? item.row?.benchmark) || 0;
      addText(`- ${item.row?.name || item.row?.metric || "Benchmark"}: Yours ${metricValue(item.key)}; Benchmark ${formatCampaignDeepDiveMetricValue(item.key, target)}`, { indent });
    });
  };
  const addTrendRows = (keys: string[], indent = 8) => {
    const rows = Array.isArray(trendAnalysis?.dailyTotals) ? trendAnalysis.dailyTotals : [];
    if (rows.length === 0) {
      addText("- No connected source trend rows available.", { indent });
      return;
    }
    const currentRows = rows.slice(-Math.max(1, Math.ceil(rows.length / 2)));
    keys.forEach((key) => {
      const total = currentRows.reduce((sum: number, row: any) => sum + (Number(row?.metrics?.[key]) || 0), 0);
      addText(`- ${campaignDeepDiveMetricLabels[key] || key}: ${total > 0 ? formatCampaignDeepDiveMetricValue(key, total) : "Unavailable"}`, { indent });
    });
  };
  const addSelectedSectionBody = (section: string) => {
    addText(campaignDeepDiveTabLabels[section] || section, { size: 14, bold: true });
    if (section.startsWith("performance-summary:")) {
      addText("Connected-source performance", { bold: true, indent: 4 });
      addMetricRows(["users", "sessions", "conversions", "revenue", "cvr", "impressions", "clicks", "spend"]);
      if (section === "performance-summary:health" || section === "performance-summary:overview") {
        addText("Campaign KPI rows", { bold: true, indent: 4 });
        addKpiRows();
        addText("Campaign Benchmark rows", { bold: true, indent: 4 });
        addBenchmarkRows();
      }
      if (section === "performance-summary:changes") addText("Metric trends require compatible historical aggregate snapshots; current values are included above.", { indent: 4 });
      addText("Data Sources", { bold: true, indent: 4 });
      addSourceRows();
    } else if (section.startsWith("financial-analysis:")) {
      addText("Financial metrics", { bold: true, indent: 4 });
      addMetricRows(["revenue", "spend", "conversions", "cvr", "cpc", "cpa", "roas", "roi"]);
      addText("Campaign budget context", { bold: true, indent: 4 });
      addText(`- Budget: ${formatCampaignDeepDiveMetricValue("spend", (campaign as any)?.budget)}`, { indent: 8 });
      addText(`- Start Date: ${(campaign as any)?.startDate || "Unavailable"}`, { indent: 8 });
      addText(`- End Date: ${(campaign as any)?.endDate || "Unavailable"}`, { indent: 8 });
      addText("Financial source rows", { bold: true, indent: 4 });
      addSourceRows();
    } else if (section.startsWith("platform-comparison:")) {
      addText("Platform Performance Summary Cards", { bold: true, indent: 4 });
      addSourceRows();
      addText("Detailed Performance Metrics", { bold: true, indent: 4 });
      addMetricRows(["users", "sessions", "impressions", "clicks", "conversions", "revenue", "spend", "roas", "roi"]);
    } else if (section.startsWith("trend-analysis:")) {
      addText("Trend window", { bold: true, indent: 4 });
      addText(`- ${trendAnalysis?.startDate || "Unavailable"} to ${trendAnalysis?.endDate || "Unavailable"}`, { indent: 8 });
      addText("Trend metrics", { bold: true, indent: 4 });
      addTrendRows(["sessions", "users", "conversions", "revenue", "spend", "impressions", "clicks"]);
    } else if (section === "executive-summary:overview") {
      addText("Marketing Funnel Performance", { bold: true, indent: 4 });
      addMetricRows(["users", "sessions", "conversions", "revenue", "cvr", "roas", "roi"]);
      addText("KPI Progress", { bold: true, indent: 4 });
      addKpiRows();
      addText("Benchmark Comparison", { bold: true, indent: 4 });
      addBenchmarkRows();
      addText("Risk Assessment", { bold: true, indent: 4 });
      const kpiRisk = (Array.isArray(kpis) ? kpis : []).filter((row: any) => {
        const key = resolveAggregateMetric(row);
        const target = Number(row?.targetValue ?? row?.target) || 0;
        return key && target > 0 && metricNumber(key) / target < 0.7;
      }).length;
      const benchmarkRisk = (Array.isArray(benchmarks) ? benchmarks : []).filter((row: any) => {
        const key = resolveAggregateMetric(row);
        const target = Number(row?.benchmarkValue ?? row?.benchmark) || 0;
        return key && target > 0 && metricNumber(key) / target < 0.7;
      }).length;
      addText(`- KPI Risk: ${kpiRisk > 0 ? `${kpiRisk} KPI row(s) below 70% of target` : "No mapped KPI rows below 70% of target"}`, { indent: 8 });
      addText(`- Benchmark Risk: ${benchmarkRisk > 0 ? `${benchmarkRisk} Benchmark row(s) below 70% of benchmark` : "No mapped Benchmark rows below 70% of benchmark"}`, { indent: 8 });
    } else if (section === "executive-summary:recommendations") {
      addText("Recommendation basis", { bold: true, indent: 4 });
      addMetricRows(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);
      addText("Next action: compare below-target KPI or Benchmark rows against landing-page and conversion-path performance before changing spend.", { indent: 4 });
      addText("Key assumptions", { bold: true, indent: 4 });
      addText("- Based on connected-source aggregate values available to the scheduler at send time.", { indent: 8 });
    } else {
      addMetricRows(["users", "sessions", "conversions", "revenue", "cvr", "spend", "roas", "roi"]);
    }
  };

  addText(String(report?.name || "Campaign Report"), { size: 18, bold: true });
  addText(`Campaign: ${campaignName || "Campaign"}`);
  addText(`Report Type: ${campaignDeepDiveReportTypeLabels[reportType] || reportType || "Custom Report"}`);
  addText(`Window: ${windowStart} to ${windowEnd}`);
  addText(`Generated: ${new Date().toLocaleString()}`);
  y += 4;
  addText("Included sections", { size: 14, bold: true });
  if (selectedSections.length === 0) {
    addText("- No sections selected.", { indent: 4 });
  } else {
    selectedSections.forEach((section: string) => addText(`- ${campaignDeepDiveTabLabels[section] || section}`, { indent: 4 }));
  }
  if (selectedMetrics.length > 0) {
    y += 4;
    addText("Selected metrics", { size: 14, bold: true });
    selectedMetrics.forEach((metric: string) => addText(`- ${metric}`, { indent: 4 }));
  }
  if (selectedSections.length > 0) {
    y += 4;
    addText("Selected section content", { size: 14, bold: true });
    selectedSections.forEach(addSelectedSectionBody);
  }

  return coercePdfBufferFromDoc(doc);
}

export async function buildPdfAttachmentForReport(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
  isTest?: boolean;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  try {
    if (String((report as any)?.platformType || "") === "campaign_deepdive") {
      return buildCampaignDeepDiveScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });
    }

    if (String((report as any)?.platformType || "") === "google_analytics") {
      const ga4ReportType = String((report as any)?.reportType || "").toLowerCase();
      if (ga4ReportType === "overview" || ga4ReportType === "kpis" || ga4ReportType === "benchmarks" || ga4ReportType === "ads" || ga4ReportType === "insights" || ga4ReportType === "custom") {
        try {
          const { buildGA4ScheduledPdfAttachment } = await import("./ga4-scheduled-report-pdf.js");
          const ga4Pdf = await buildGA4ScheduledPdfAttachment({
            report,
            reportName: String((report as any)?.name || "GA4 Report"),
            windowStart,
            windowEnd,
            campaignName,
          });
          if (ga4Pdf) return ga4Pdf;
        } catch (e) {
          console.warn("[Report Scheduler] GA4 PDF builder failed; refusing generic fallback:", e);
        }
      }
      console.error(`[Report Scheduler] Refusing generic fallback for GA4 ${ga4ReportType || "report"} PDF`);
      return null;
    }

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    // Layout constants
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const left = margin;
    const right = pageW - margin;
    const pageBottom = pageH - 16;
    let y = 18;

    const safeText = (t: any) => String(t ?? "").replace(/[^\x20-\x7E]/g, " ").trim();
    const setFont = (style: "normal" | "bold" = "normal") => {
      try {
        doc.setFont("helvetica", style);
      } catch {
        // ignore if font/style not supported
      }
    };
    const line = (x1: number, y1: number, x2: number, y2: number) => {
      doc.setDrawColor(226, 232, 240);
      doc.line(x1, y1, x2, y2);
    };
    const ensureSpace = (needed: number) => {
      if (y + needed > pageBottom) {
        doc.addPage();
        y = 18;
      }
    };
    const text = (t: any, x: number, yy: number, fontSize = 10, style: "normal" | "bold" = "normal", color?: [number, number, number]) => {
      setFont(style);
      doc.setFontSize(fontSize);
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      else doc.setTextColor(15, 23, 42); // slate-900
      doc.text(safeText(t), x, yy);
    };
    const addLabelValue = (label: string, value: string, yy: number) => {
      text(label, left, yy, 9, "bold", [71, 85, 105]); // slate-600
      text(value, left + 36, yy, 9, "normal", [71, 85, 105]);
    };

    const reportName = safeText(report?.name || "MimoSaaS Report");
    const reportType = safeText(report?.reportType || "report");
    const campaignLabel = campaignName ? safeText(campaignName) : "(platform-level)";

    // Header band
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageW, 30, "F");
    text("MimoSaaS", left, 18, 16, "bold", [255, 255, 255]);
    text("Executive Report", left + 62, 18, 10, "normal", [203, 213, 225]); // slate-300

    // Title + metadata card
    y = 42;
    text(reportName, left, y, 16, "bold");
    y += 8;
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(left, y, right - left, 26, 3, 3, "FD");
    addLabelValue("Campaign", campaignLabel, y + 8);
    addLabelValue("Type", reportType.toLowerCase(), y + 16);
    // Right column
    text("Window", left + 110, y + 8, 9, "bold", [71, 85, 105]);
    text(`${safeText(windowStart)} to ${safeText(windowEnd)} (UTC)`, left + 145, y + 8, 9, "normal", [71, 85, 105]);
    text("Generated", left + 110, y + 16, 9, "bold", [71, 85, 105]);
    text(new Date().toUTCString(), left + 145, y + 16, 9, "normal", [71, 85, 105]);
    y += 38;

    const platformType = String((report as any)?.platformType || "linkedin");
    const campaignId = (report as any)?.campaignId ? String((report as any).campaignId) : undefined;

    // Content by report type (start with high-signal types; fall back gracefully).
    if (reportType.toLowerCase() === "kpis") {
      ensureSpace(24);
      text("KPIs", left, y, 12, "bold");
      y += 8;
      line(left, y, right, y);
      y += 8;

      let kpis: any[] = [];
      try {
        kpis = await storage.getPlatformKPIs(platformType, campaignId);
      } catch {
        kpis = [];
      }

      if (!kpis || kpis.length === 0) {
        text("No KPIs found for this scope.", left, y, 10, "normal", [71, 85, 105]);
        y += 10;
      } else {
        // Table header
        const cols = {
          name: left,
          metric: left + 62,
          status: left + 105,
          cur: left + 132,
          tgt: left + 160,
        };
        doc.setFillColor(241, 245, 249); // slate-100
        doc.rect(left, y - 5, right - left, 10, "F");
        text("Name", cols.name, y + 2, 9, "bold", [51, 65, 85]);
        text("Metric", cols.metric, y + 2, 9, "bold", [51, 65, 85]);
        text("Status", cols.status, y + 2, 9, "bold", [51, 65, 85]);
        text("Current", cols.cur, y + 2, 9, "bold", [51, 65, 85]);
        text("Target", cols.tgt, y + 2, 9, "bold", [51, 65, 85]);
        y += 14;

        for (let i = 0; i < kpis.length; i++) {
          const kpi = kpis[i];
          ensureSpace(12);
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252); // subtle zebra
            doc.rect(left, y - 6, right - left, 10, "F");
          }
          const name = safeText(kpi?.name || "KPI");
          const metric = safeText(kpi?.metricKey || kpi?.metric || "");
          const status = safeText(kpi?.status || "");
          const cur = safeText(formatWithUnit(kpi?.currentValue, kpi?.unit));
          const tgt = safeText(formatWithUnit(kpi?.targetValue, kpi?.unit));

          // Truncate long names so columns don't collide
          const nameShort = name.length > 24 ? `${name.slice(0, 23)}…` : name;
          text(nameShort, cols.name, y, 9, "normal", [15, 23, 42]);
          text(metric, cols.metric, y, 9, "normal", [71, 85, 105]);
          text(status, cols.status, y, 9, "normal", [71, 85, 105]);
          text(cur, cols.cur, y, 9, "normal", [15, 23, 42]);
          text(tgt, cols.tgt, y, 9, "normal", [15, 23, 42]);
          y += 12;
        }
      }
    } else if (reportType.toLowerCase() === "benchmarks") {
      ensureSpace(24);
      text("Benchmarks", left, y, 12, "bold");
      y += 8;
      line(left, y, right, y);
      y += 8;

      let benchmarks: any[] = [];
      try {
        benchmarks = campaignId
          ? await storage.getCampaignBenchmarks(campaignId)
          : await storage.getPlatformBenchmarks(platformType);
      } catch {
        benchmarks = [];
      }

      if (!benchmarks || benchmarks.length === 0) {
        text("No benchmarks found for this scope.", left, y, 10, "normal", [71, 85, 105]);
        y += 10;
      } else {
        const cols = {
          name: left,
          metric: left + 78,
          cur: left + 120,
          bm: left + 160,
        };
        doc.setFillColor(241, 245, 249);
        doc.rect(left, y - 5, right - left, 10, "F");
        text("Name", cols.name, y + 2, 9, "bold", [51, 65, 85]);
        text("Metric", cols.metric, y + 2, 9, "bold", [51, 65, 85]);
        text("Current", cols.cur, y + 2, 9, "bold", [51, 65, 85]);
        text("Benchmark", cols.bm, y + 2, 9, "bold", [51, 65, 85]);
        y += 14;

        for (let i = 0; i < benchmarks.length; i++) {
          const b = benchmarks[i];
          ensureSpace(12);
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(left, y - 6, right - left, 10, "F");
          }
          const name = safeText(b?.name || "Benchmark");
          const metric = safeText(b?.metric || "");
          const cur = safeText(formatWithUnit(b?.currentValue, b?.unit));
          const tgt = safeText(formatWithUnit(b?.benchmarkValue, b?.unit));
          const nameShort = name.length > 30 ? `${name.slice(0, 29)}…` : name;

          text(nameShort, cols.name, y, 9, "normal", [15, 23, 42]);
          text(metric, cols.metric, y, 9, "normal", [71, 85, 105]);
          text(cur, cols.cur, y, 9, "normal", [15, 23, 42]);
          text(tgt, cols.bm, y, 9, "normal", [15, 23, 42]);
          y += 12;
        }
      }
    } else {
      // For other types (overview/ads/custom) we still attach a useful cover page.
      text("Summary", left, y, 12, "bold");
      y += 10;
      text("This PDF includes the report header only.", left, y, 10, "normal", [71, 85, 105]);
      y += 8;
      text("For full interactive content, open the dashboard Reports tab.", left, y, 10, "normal", [71, 85, 105]);
      y += 10;
    }

    // Footer
    doc.setTextColor(100, 116, 139); // slate-500
    doc.setFontSize(8);
    doc.text("Generated by MimoSaaS", left, pageH - 10);
    doc.text(`${new Date().toISOString().slice(0, 10)} (UTC)`, right - 38, pageH - 10);

    return coercePdfBufferFromDoc(doc);
  } catch (e) {
    console.warn("[Report Scheduler] buildPdfAttachmentForReport failed:", e);
    return null;
  }
}

/**
 * Scheduling helpers (timezone-aware, idempotent) - Enterprise-grade with Luxon
 */
function getZonedParts(now: Date, timeZone: string): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0-6 (Sun-Sat)
  hour: number; // 0-23
  minute: number; // 0-59
  localDate: string; // YYYY-MM-DD
} {
  try {
    const dt = DateTime.fromJSDate(now, { zone: timeZone });
    return {
      year: dt.year,
      month: dt.month, // Luxon uses 1-12
      day: dt.day,
      weekday: dt.weekday === 7 ? 0 : dt.weekday, // Convert Sunday from 7 to 0
      hour: dt.hour,
      minute: dt.minute,
      localDate: dt.toISODate() || `${dt.year}-${String(dt.month).padStart(2, "0")}-${String(dt.day).padStart(2, "0")}`,
    };
  } catch (error) {
    console.error(`[Report Scheduler] Invalid timezone "${timeZone}", falling back to UTC:`, error);
    const dt = DateTime.fromJSDate(now, { zone: "UTC" });
    return {
      year: dt.year,
      month: dt.month,
      day: dt.day,
      weekday: dt.weekday === 7 ? 0 : dt.weekday,
      hour: dt.hour,
      minute: dt.minute,
      localDate: dt.toISODate() || `${dt.year}-${String(dt.month).padStart(2, "0")}-${String(dt.day).padStart(2, "0")}`,
    };
  }
}

function parseHHMM(s: any): { hh: number; mm: number } | null {
  const raw = String(s || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function isReportDueNow(report: ReportWithCampaign, now: Date): { due: boolean; scheduledKey?: string; tz?: string; scheduleTime?: string } {
  if (!report.scheduleEnabled || report.status !== "active") return { due: false };
  if (!report.scheduleFrequency) return { due: false };

  const tz = String((report as any).scheduleTimeZone || "UTC").trim() || "UTC";
  const scheduleTime = String(report.scheduleTime || "09:00").trim();
  const hhmm = parseHHMM(scheduleTime) || { hh: 9, mm: 0 };

  const zp = getZonedParts(now, tz);
  const scheduledMinuteOfDay = hhmm.hh * 60 + hhmm.mm;
  const currentMinuteOfDay = zp.hour * 60 + zp.minute;
  if (currentMinuteOfDay < scheduledMinuteOfDay) return { due: false };

  const createdAt = (report as any).createdAt ? new Date((report as any).createdAt) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    const createdParts = getZonedParts(createdAt, tz);
    const createdMinuteOfDay = createdParts.hour * 60 + createdParts.minute;
    if (createdParts.localDate === zp.localDate && createdMinuteOfDay > scheduledMinuteOfDay) {
      return { due: false };
    }
  }

  const monthLast = lastDayOfMonth(zp.year, zp.month);
  const dayOfMonth = zp.day;
  const month = zp.month - 1; // 0-11

  let matches = false;
  switch (String(report.scheduleFrequency).toLowerCase()) {
    case "daily":
      matches = true;
      break;
    case "weekly": {
      const target = typeof report.scheduleDayOfWeek === "number" ? report.scheduleDayOfWeek : null;
      matches = target === null ? false : zp.weekday === target;
      break;
    }
    case "monthly": {
      const raw = typeof report.scheduleDayOfMonth === "number" ? report.scheduleDayOfMonth : null;
      if (raw === null) { matches = false; break; }
      const target = raw === 0 ? monthLast : Math.min(Math.max(raw, 1), monthLast);
      matches = dayOfMonth === target;
      break;
    }
    case "quarterly": {
      const quarterTiming = String((report as any).quarterTiming || "end").toLowerCase();
      const isQuarterStartMonth = [0, 3, 6, 9].includes(month);
      const isQuarterEndMonth = [2, 5, 8, 11].includes(month);
      if (quarterTiming === "start") {
        matches = isQuarterStartMonth && dayOfMonth === 1;
      } else {
        // End of quarter month, default to last day unless scheduleDayOfMonth overrides
        if (!isQuarterEndMonth) { matches = false; break; }
        const raw = typeof report.scheduleDayOfMonth === "number" ? report.scheduleDayOfMonth : 0;
        const target = raw === 0 ? monthLast : Math.min(Math.max(raw, 1), monthLast);
        matches = dayOfMonth === target;
      }
      break;
    }
    default:
      matches = false;
  }

  if (!matches) return { due: false };
  const scheduledKey = `${zp.localDate}T${String(hhmm.hh).padStart(2, "0")}:${String(hhmm.mm).padStart(2, "0")}@${tz}`;
  return { due: true, scheduledKey, tz, scheduleTime: `${String(hhmm.hh).padStart(2, "0")}:${String(hhmm.mm).padStart(2, "0")}` };
}

/**
 * Send report email with retry mechanism (exponential backoff)
 */
async function sendReportEmailWithRetry(
  report: ReportWithCampaign,
  recipients: string[],
  meta?: {
    windowStart?: string;
    windowEnd?: string;
    campaignName?: string | null;
    snapshotId?: string;
    attachment?: { filename: string; content: Buffer } | null;
  },
  maxRetries: number = 3
): Promise<boolean> {
  const delays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendReportEmail(report, recipients, meta);
      if (result) {
        if (attempt > 1) {
          console.log(`[Report Scheduler] ✅ Email sent successfully on attempt ${attempt}/${maxRetries}`);
        }
        return true;
      }

      if (attempt < maxRetries) {
        const delay = delays[attempt - 1];
        console.warn(`[Report Scheduler] ⚠️ Email send failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`[Report Scheduler] ❌ Email send error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        const delay = delays[attempt - 1];
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[Report Scheduler] ❌ Email failed after ${maxRetries} attempts`);
  return false;
}

/**
 * Send report email (single attempt)
 */
async function sendReportEmail(
  report: ReportWithCampaign,
  recipients: string[],
  meta?: {
    windowStart?: string;
    windowEnd?: string;
    campaignName?: string | null;
    snapshotId?: string;
    attachment?: { filename: string; content: Buffer } | null;
  }
): Promise<boolean> {
  try {
    console.log(`[Report Scheduler] Preparing to send report: ${report.name} to ${recipients.length} recipients`);
    if (!meta?.attachment?.content || meta.attachment.content.length <= 100) {
      console.error(`[Report Scheduler] Refusing to send report "${report.name}" without a valid PDF attachment`);
      return false;
    }

    // Get report configuration (optional)
    const config = typeof report.configuration === 'string'
      ? JSON.parse(report.configuration)
      : report.configuration;

    const reportTypeLabels: Record<string, string> = {
      overview: 'Overview Report',
      kpis: 'KPIs Report',
      benchmarks: 'Benchmarks Report',
      ads: 'Ad Comparison Report',
      insights: 'Insights Report',
      custom: 'Custom Report'
    };

    const reportLabel = reportTypeLabels[report.reportType]
      || (report.platformType === 'google_analytics' ? 'GA4 Report' : 'LinkedIn Analytics Report');
    const frequencyLabels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly'
    };
    const scheduleFrequencyKey = String(report.scheduleFrequency || '');
    const frequencyLabel = frequencyLabels[scheduleFrequencyKey] || scheduleFrequencyKey || 'Scheduled';
    const generatedAt = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const text = [
      'Hello,',
      '',
      'Your scheduled MimoSaaS report is attached.',
      '',
      `Report: ${report.name}`,
      meta?.campaignName ? `Campaign: ${meta.campaignName}` : '',
      `Report Type: ${reportLabel}`,
      `Frequency: ${frequencyLabel}`,
      `Generated: ${generatedAt}`,
    ].filter(Boolean).join('\n');

    const html = text.replace(/\n/g, "<br>");
    const deliverableSubject = `MimoSaaS report attached: ${report.name}`;

    const sent = await emailService.sendEmail({
      to: recipients,
      subject: deliverableSubject,
      html,
      text,
      attachments: meta?.attachment ? [{ filename: meta.attachment.filename, content: meta.attachment.content, contentType: 'application/pdf' }] : undefined,
      auditContext: {
        kind: 'report',
        entityType: 'report',
        entityId: String((report as any)?.id || ''),
        campaignId: String((report as any)?.campaignId || ''),
        campaignName: String(meta?.campaignName || (report as any)?.campaignName || ''),
      }
    });

    if (sent) {
      console.log(`[Report Scheduler] ✅ Successfully sent report "${report.name}" to ${recipients.length} recipients`);
    } else {
      console.error(`[Report Scheduler] ❌ Failed to send report "${report.name}"`);
    }

    return sent;
  } catch (error) {
    console.error(`[Report Scheduler] Error sending report email:`, error);
    return false;
  }
}

/**
 * Main scheduler function - checks and sends scheduled reports
 */
export async function checkScheduledReports(): Promise<void> {
  try {
    console.log('[Report Scheduler] Checking for due scheduled reports...');
    const now = new Date();

    // Get all active reports with schedules - try both storage methods
    let allReports: any[] = [];

    try {
      // Try LinkedIn-specific reports first
      const linkedInReports = await storage.getLinkedInReports();
      allReports = allReports.concat(linkedInReports);
      console.log(`[Report Scheduler] Found ${linkedInReports.length} LinkedIn reports`);
    } catch (error) {
      console.log('[Report Scheduler] No LinkedIn reports found');
    }

    try {
      // Also check platform reports (LinkedIn)
      const platformReports = await storage.getPlatformReports('linkedin');
      allReports = allReports.concat(platformReports);
      console.log(`[Report Scheduler] Found ${platformReports.length} LinkedIn platform reports`);
    } catch (error) {
      console.log('[Report Scheduler] No LinkedIn platform reports found');
    }

    try {
      // Check GA4 platform reports
      const ga4Reports = await storage.getPlatformReports('google_analytics');
      allReports = allReports.concat(ga4Reports);
      console.log(`[Report Scheduler] Found ${ga4Reports.length} GA4 platform reports`);
    } catch (error) {
      console.log('[Report Scheduler] No GA4 platform reports found');
    }

    if (allReports.length === 0) {
      console.log('[Report Scheduler] No reports found in either storage');
      return;
    }

    const uniqueReports = Array.from(
      new Map(allReports.map(report => [String(report.id), report])).values()
    );
    const scheduledReports = uniqueReports.filter(r => r.scheduleEnabled && r.status === 'active');

    if (scheduledReports.length === 0) {
      console.log('[Report Scheduler] No scheduled reports found');
      return;
    }

    console.log(`[Report Scheduler] Found ${scheduledReports.length} scheduled reports`);

    for (const report of scheduledReports) {
      const due = isReportDueNow(report, now);
      if (!due.due || !due.scheduledKey) continue;
      let retryingFailedSend = false;

      // Idempotency: ensure we only send once per scheduled slot.
      const inserted = await db
        .insert(reportSendEvents)
        .values({
          reportId: String((report as any).id),
          scheduledKey: due.scheduledKey,
          timeZone: due.tz || null,
          recipients: (report as any).scheduleRecipients || null,
          status: "pending",
        } as any)
        .onConflictDoNothing()
        .returning()
        .catch(() => []);
      if (!inserted || inserted.length === 0) {
        const [existingEvent] = await db
          .select()
          .from(reportSendEvents)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .limit(1)
          .catch(() => []);
        const existingStatus = String((existingEvent as any)?.status || "").toLowerCase();
        const existingReportId = String((report as any).id);
        const existingError = String((existingEvent as any)?.error || "").trim();
        const auditError = existingStatus !== "sent" && (!existingError || existingError === "Email send failed after retries")
          ? await getLatestReportEmailError(existingReportId)
          : "";
        const displayError = existingStatus === "sent" ? "" : (auditError || existingError);
        const existingCreatedAt = (existingEvent as any)?.createdAt ? new Date((existingEvent as any).createdAt) : null;
        const stalePending = existingStatus === "pending" && (!existingCreatedAt || now.getTime() - existingCreatedAt.getTime() > 10 * 60 * 1000);
        const staleFailed = existingStatus === "failed"
          && !(existingEvent as any)?.sentAt
          && !String(existingError || "").startsWith("Retry failed after previous failure:")
          && (!existingCreatedAt || now.getTime() - existingCreatedAt.getTime() > 10 * 60 * 1000);
        if (!stalePending && !staleFailed) {
          if (existingStatus === "skipped" && (displayError.includes("Campaign not found") || displayError.includes("No recipients configured"))) {
            await db
              .update(linkedinReports)
              .set({ scheduleEnabled: false, updatedAt: new Date() } as any)
              .where(eq(linkedinReports.id, existingReportId))
              .catch(() => { });
          }
          console.log(`[Report Scheduler] Report "${report.name}" already processed for ${due.scheduledKey} (status=${existingStatus || "unknown"}${displayError ? `, error=${displayError}` : ""})`);
          continue; // already processed
        }
        retryingFailedSend = staleFailed;
        console.warn(`[Report Scheduler] Retrying ${staleFailed ? "stale failed" : "stale pending"} report "${report.name}" for ${due.scheduledKey}`);
        await db
          .update(reportSendEvents)
          .set({ status: "pending", error: null, recipients: (report as any).scheduleRecipients || null } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
      }

      console.log(`[Report Scheduler] Report "${report.name}" is due now (${due.scheduledKey})`);

      // Get recipients
      const recipients = report.scheduleRecipients || [];

      if (!recipients || recipients.length === 0) {
        console.warn(`[Report Scheduler] Report "${report.name}" has no recipients, disabling schedule: report=${report.id}, campaign=${(report as any).campaignId || "none"}`);
        await db
          .update(linkedinReports)
          .set({ scheduleEnabled: false, updatedAt: new Date() } as any)
          .where(eq(linkedinReports.id, String((report as any).id)))
          .catch(() => { });
        await db
          .update(reportSendEvents)
          .set({ status: "skipped", error: "No recipients configured" } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

      // Compute report window (align to LinkedIn analytics: last 30 complete UTC days)
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
      const start = new Date(end.getTime());
      start.setUTCDate(start.getUTCDate() - 29);
      const windowStart = start.toISOString().slice(0, 10);
      const windowEnd = end.toISOString().slice(0, 10);

      // Snapshot (what was sent)
      let campaignName: string | null = null;
      try {
        if ((report as any).campaignId) {
          const [c] = await db.select().from(campaigns).where(eq(campaigns.id, String((report as any).campaignId)));
          if (!c) {
            const error = "Campaign not found; skipped scheduled report";
            console.warn(`[Report Scheduler] ${error}: report=${report.id}, campaign=${(report as any).campaignId}`);
            await db
              .update(linkedinReports)
              .set({ scheduleEnabled: false, updatedAt: new Date() } as any)
              .where(eq(linkedinReports.id, String((report as any).id)))
              .catch(() => { });
            await db
              .update(reportSendEvents)
              .set({ status: "skipped", error } as any)
              .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
              .catch(() => { });
            continue;
          }
          campaignName = (c as any)?.name || null;
        }
      } catch (error: any) {
        const message = error?.message || "Campaign lookup failed; skipped scheduled report";
        console.warn(`[Report Scheduler] Campaign lookup failed; skipped scheduled report: report=${report.id}, campaign=${(report as any).campaignId}, error=${message}`);
        await db
          .update(reportSendEvents)
          .set({ status: "failed", error: message } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

      const snapshotPayload = {
        reportId: String((report as any).id),
        reportName: String((report as any).name || ""),
        reportType: String((report as any).reportType || ""),
        platformType: String((report as any).platformType || "linkedin"),
        campaignId: (report as any).campaignId || null,
        campaignName,
        windowStart,
        windowEnd,
        generatedAt: now.toISOString(),
        scheduledKey: due.scheduledKey,
      };

      if (snapshotPayload.platformType === "google_analytics" && snapshotPayload.campaignId) {
        try {
          await runGA4DailyKPIAndBenchmarkJobs({ campaignId: String(snapshotPayload.campaignId), date: windowEnd });
        } catch (e: any) {
          console.warn("[Report Scheduler] GA4 KPI/Benchmark recompute before report failed:", e?.message || e);
        }
      }

      const pdfBuffer = await buildPdfAttachmentForReport({
        report,
        windowStart,
        windowEnd,
        campaignName,
        isTest: false,
      });
      console.log(`[Report Scheduler] PDF attachment bytes: ${pdfBuffer ? pdfBuffer.length : 0}`);

      // Send email with retry mechanism (with PDF attachment when possible)
      const sent = await sendReportEmailWithRetry(report, recipients, {
        windowStart,
        windowEnd,
        campaignName,
        attachment: pdfBuffer ? { filename: `${snapshotPayload.reportName.replace(/\s+/g, "_")}_${windowEnd}.pdf`, content: pdfBuffer } : null,
      });

      const [snap] = sent
        ? await db
          .insert(reportSnapshots)
          .values({
            reportId: snapshotPayload.reportId,
            campaignId: snapshotPayload.campaignId,
            platformType: snapshotPayload.platformType,
            reportType: snapshotPayload.reportType,
            windowStart,
            windowEnd,
            snapshotJson: JSON.stringify(snapshotPayload),
            hasEstimated: false,
          } as any)
          .returning()
          .catch(() => [])
        : [];

      // Update metrics
      const emailError = sent ? "" : await getLatestReportEmailError(snapshotPayload.reportId);
      const sendError = emailError || "Email send failed after retries";
      const persistedSendError = retryingFailedSend ? `Retry failed after previous failure: ${sendError}` : sendError;

      if (sent) {
        schedulerMetrics.totalSent++;
        schedulerMetrics.lastSuccessTime = new Date();
      } else {
        schedulerMetrics.totalFailed++;
        schedulerMetrics.lastErrorTime = new Date();
        schedulerMetrics.lastError = persistedSendError;
      }

      await db
        .update(reportSendEvents)
        .set({
          status: sent ? "sent" : "failed",
          error: sent ? null : persistedSendError,
          sentAt: sent ? new Date() : null,
          snapshotId: (snap as any)?.id ? String((snap as any).id) : null,
        } as any)
        .where(and(eq(reportSendEvents.reportId, snapshotPayload.reportId), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
        .catch(() => { });

      if (sent) {
        // Update report book-keeping
        await db
          .update(linkedinReports)
          .set({ lastSentAt: new Date() } as any)
          .where(eq(linkedinReports.id, snapshotPayload.reportId))
          .catch(() => { });
      }

      // Add a small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[Report Scheduler] ✅ Due reports check completed');
  } catch (error) {
    console.error('[Report Scheduler] Error in checkScheduledReports:', error);
    schedulerMetrics.lastErrorTime = new Date();
    schedulerMetrics.lastError = error instanceof Error ? error.message : String(error);
  }
}

/**
 * Get scheduler health metrics for monitoring
 */
export function getSchedulerMetrics() {
  return {
    ...schedulerMetrics,
    uptime: schedulerMetrics.lastCheckTime ? Date.now() - schedulerMetrics.lastCheckTime.getTime() : null,
    successRate: schedulerMetrics.totalSent + schedulerMetrics.totalFailed > 0
      ? (schedulerMetrics.totalSent / (schedulerMetrics.totalSent + schedulerMetrics.totalFailed) * 100).toFixed(2) + '%'
      : 'N/A',
  };
}

/**
 * For testing - manually trigger a report email
 */
export async function sendTestReport(reportId: string): Promise<{ success: boolean; message?: string; recipients?: string[]; providerResponseId?: string; deliveryStatus?: string }> {
  try {
    console.log(`[Report Scheduler] Sending test report: ${reportId}`);

    // Check email configuration
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    const hasEmailConfig =
      (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) ||
      (process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) ||
      (process.env.SENDGRID_API_KEY) ||
      (process.env.SMTP_USER && process.env.SMTP_PASS);

    if (!hasEmailConfig) {
      console.error(`[Report Scheduler] ❌ Email provider configured as "${emailProvider}" but credentials are missing`);
      console.error('[Report Scheduler] Please configure email environment variables on Render:');
      console.error('  - For Mailgun API: MAILGUN_API_KEY, MAILGUN_DOMAIN');
      console.error('  - For Mailgun SMTP: MAILGUN_SMTP_USER, MAILGUN_SMTP_PASS');
      console.error('  - For SendGrid: SENDGRID_API_KEY');
      console.error('  - For SMTP: SMTP_USER, SMTP_PASS');
      return { success: false, message: "Email credentials are missing" };
    }

    // Try both storage methods - LinkedIn-specific first, then platform-generic
    console.log(`[Report Scheduler] Fetching report from storage...`);

    let report;
    try {
      // First try LinkedIn-specific reports (used by /api/linkedin/reports)
      report = await storage.getLinkedInReport(reportId);
      console.log(`[Report Scheduler] Found report via getLinkedInReport: ${report ? 'YES' : 'NO'}`);
    } catch (error) {
      console.log(`[Report Scheduler] LinkedIn report fetch failed, trying platform reports...`);
    }

    // If not found, try platform reports
    if (!report) {
      for (const platformType of ['linkedin', 'google_analytics']) {
        const allReports = await storage.getPlatformReports(platformType);
        report = allReports.find(r => r.id === reportId);
        if (report) break;
      }
      console.log(`[Report Scheduler] Found report via getPlatformReports: ${report ? 'YES' : 'NO'}`);
    }

    if (!report) {
      console.error(`[Report Scheduler] Report not found in either storage method: ${reportId}`);

      // Debug: List all available reports
      try {
        const linkedInReports = await storage.getLinkedInReports();
        const platformReports = [
          ...(await storage.getPlatformReports('linkedin')),
          ...(await storage.getPlatformReports('google_analytics')),
        ];
        console.log(`[Report Scheduler] DEBUG - Available LinkedIn reports: ${linkedInReports.length}`);
        console.log(`[Report Scheduler] DEBUG - Available platform reports: ${platformReports.length}`);
        if (linkedInReports.length > 0) {
          console.log(`[Report Scheduler] DEBUG - LinkedIn report IDs:`, linkedInReports.map(r => r.id));
        }
        if (platformReports.length > 0) {
          console.log(`[Report Scheduler] DEBUG - Platform report IDs:`, platformReports.map(r => r.id));
        }
      } catch (debugError) {
        console.error(`[Report Scheduler] DEBUG - Error listing reports:`, debugError);
      }

      return { success: false, message: "Report not found" };
    }

    console.log(`[Report Scheduler] Found report: ${report.name}`);
    console.log(`[Report Scheduler] Report type: ${report.reportType}`);
    console.log(`[Report Scheduler] Schedule recipients:`, report.scheduleRecipients);

    const reportCampaignId = String((report as any)?.campaignId || "").trim();
    if (!reportCampaignId) {
      return { success: false, message: "Report campaign is missing" };
    }

    const recipients = report.scheduleRecipients || [];

    if (recipients.length === 0) {
      console.error(`[Report Scheduler] No recipients configured for report: ${reportId}`);
      return { success: false, message: "No recipients configured", recipients: [] };
    }

    console.log(`[Report Scheduler] Attempting to send test email to: ${recipients.join(', ')}`);

    // Match production behavior: include window + best-effort PDF attachment.
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const start = new Date(end.getTime());
    start.setUTCDate(start.getUTCDate() - 29);
    const windowStart = start.toISOString().slice(0, 10);
    const windowEnd = end.toISOString().slice(0, 10);

    // Snapshot meta (optional, best-effort campaign name)
    let campaignName: string | null = null;
    try {
      const [c] = await db.select().from(campaigns).where(eq(campaigns.id, reportCampaignId));
      if (!c) {
        return { success: false, message: "Campaign not found; test report skipped", recipients };
      }
      campaignName = (c as any)?.name || null;
    } catch {
      return { success: false, message: "Campaign lookup failed; test report skipped", recipients };
    }

    const pdfBuffer = await buildPdfAttachmentForReport({
      report,
      windowStart,
      windowEnd,
      campaignName,
      isTest: true,
    });
    console.log(`[Report Scheduler] PDF attachment bytes (test): ${pdfBuffer ? pdfBuffer.length : 0}`);

    const safeName = String((report as any)?.name || "MimoSaaS_Report").replace(/\s+/g, "_");
    const result = await sendReportEmail(report, recipients, {
      windowStart,
      windowEnd,
      campaignName,
      attachment: pdfBuffer ? { filename: `${safeName}_${windowEnd}.pdf`, content: pdfBuffer } : null,
    });
    console.log(`[Report Scheduler] Send result: ${result ? 'SUCCESS ✅' : 'FAILED ❌'}`);

    const audit = await getLatestReportEmailAudit(reportId, result);
    if (!result) {
      return { success: false, message: audit.error || "Email send failed", recipients };
    }

    if (audit.provider === "mailgun-api") {
      const delivery = await waitForMailgunDelivery(audit.providerResponseId);
      console.log(`[Report Scheduler] Mailgun delivery status for test report "${report.name}": ${delivery.status}${delivery.error ? ` (${delivery.error})` : ""}`);
      if (delivery.status !== "delivered") {
        return {
          success: false,
          message: delivery.status === "failed" ? `Mailgun delivery failed: ${delivery.error || "unknown error"}` : "Mailgun accepted the email, but delivery was not confirmed yet",
          recipients,
          providerResponseId: audit.providerResponseId,
          deliveryStatus: delivery.status,
        };
      }
    }

    return {
      success: true,
      message: "Test report email delivered successfully",
      recipients,
      providerResponseId: audit.providerResponseId,
      deliveryStatus: audit.provider === "mailgun-api" ? "delivered" : "accepted",
    };
  } catch (error) {
    console.error('[Report Scheduler] Error sending test report:', error);
    console.error('[Report Scheduler] Error details:', error instanceof Error ? error.message : String(error));
    return { success: false, message: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Start the report scheduler - Enterprise-grade with node-cron
 */
export function startReportScheduler(): void {
  console.log('[Report Scheduler] 🚀 Starting enterprise-grade report scheduler...');

  // Optionally run immediately on startup
  if (process.env.RUN_REPORT_SCHEDULER_ON_STARTUP === "true") {
    void checkScheduledReports();
  }

  // Enterprise-grade: Use node-cron for guaranteed execution times
  // Run every minute for precision (idempotency prevents duplicates)
  const cronSchedule = process.env.REPORT_SCHEDULER_CRON || '* * * * *'; // Default: every minute

  cron.schedule(cronSchedule, () => {
    void checkScheduledReports();
  }, {
    timezone: 'UTC', // Cron runs in UTC, per-report timezones handled in isReportDueNow
  });

  console.log(`[Report Scheduler] ✅ Report scheduler started with cron schedule: "${cronSchedule}" (UTC)`);
  console.log('[Report Scheduler] 📊 Health metrics available via getSchedulerMetrics()');
  console.log('[Report Scheduler] 🔒 Idempotency: report_send_events prevents duplicate sends');
  console.log('[Report Scheduler] 🔄 Retry: 3 attempts with exponential backoff (1s, 2s, 4s)');
  console.log('[Report Scheduler] 🌍 Timezones: Luxon-powered DST-safe timezone handling');
}

