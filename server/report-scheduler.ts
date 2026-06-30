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
import { computeBenchmarkThresholdResult } from "../shared/kpi-math";
import { mapMailgunDeliveryToAlertEmailStatus, waitForMailgunDelivery } from "./utils/mailgun-delivery";

/**
 * Report Scheduler - Automated Email Reports
 * Checks for scheduled reports and sends them via email
 */

interface ReportWithCampaign extends LinkedInReport {
  campaignId: string | null;
  platformType: string;
}

const SCHEDULED_REPORT_PLATFORM_TYPES = ['linkedin', 'google_analytics', 'google_ads', 'instagram', 'tiktok', 'google_sheets', 'custom-integration', 'campaign_deepdive'];

// Monitoring metrics for scheduler health
const schedulerMetrics = {
  schedulerStartedAt: null as Date | null,
  cronSchedule: null as string | null,
  totalChecks: 0,
  totalSent: 0,
  totalFailed: 0,
  lastCheckTime: null as Date | null,
  lastCheckFinishedAt: null as Date | null,
  lastScheduledReportsFound: 0,
  lastDueReportsFound: 0,
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

async function getLatestReportEmailAudit(reportId: string, success: boolean): Promise<{ id: string; provider: string; error: string; providerResponseId: string; deliveryStatus: string }> {
  const rows = await db
    .select({
      id: emailAlertEvents.id,
      provider: emailAlertEvents.provider,
      error: emailAlertEvents.error,
      metadata: emailAlertEvents.metadata,
      providerResponseId: emailAlertEvents.providerResponseId,
      deliveryStatus: emailAlertEvents.deliveryStatus,
    })
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
  let providerResponseId = String(row?.providerResponseId || "").trim();
  if (!providerResponseId) {
    try {
      providerResponseId = String(JSON.parse(String(row?.metadata || "{}"))?.providerResponseId || "").trim();
    } catch {
      providerResponseId = "";
    }
  }
  return {
    id: String(row?.id || "").trim(),
    provider: String(row?.provider || "").trim(),
    error: String(row?.error || "").trim(),
    providerResponseId,
    deliveryStatus: String(row?.deliveryStatus || "").trim(),
  };
}

async function confirmScheduledReportEmailDelivery(reportId: string): Promise<{ sent: boolean; status: "sent" | "failed" | "pending_delivery"; error: string }> {
  const audit = await getLatestReportEmailAudit(reportId, true);
  if (audit.provider !== "mailgun-api") return { sent: true, status: "sent", error: "" };

  const delivery = await waitForMailgunDelivery(audit.providerResponseId);
  const deliveryStatus = delivery.status === "not_checked"
    ? "pending_delivery"
    : mapMailgunDeliveryToAlertEmailStatus(delivery.status);
  const error = delivery.status === "failed"
    ? `Mailgun delivery failed: ${delivery.error || "unknown error"}`
    : delivery.status === "delivered"
      ? ""
      : "Mailgun accepted the email, but delivery was not confirmed yet";

  if (audit.id) {
    const updates: any = {
      deliveryStatus,
      providerResponseId: audit.providerResponseId || null,
      metadata: JSON.stringify({
        providerResponseId: audit.providerResponseId,
        mailgunDeliveryStatus: delivery.status,
        mailgunDeliveryError: delivery.error,
      }),
    };
    if (delivery.status === "delivered") updates.deliveredAt = new Date();
    if (delivery.status === "failed") {
      updates.failedAt = new Date();
      updates.error = error;
    }
    await db.update(emailAlertEvents)
      .set(updates)
      .where(eq(emailAlertEvents.id, audit.id))
      .catch(() => { });
  }

  if (delivery.status === "delivered") return { sent: true, status: "sent", error: "" };
  return { sent: false, status: delivery.status === "failed" ? "failed" : "pending_delivery", error };
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

function parseReportConfiguration(configuration: any): Record<string, any> {
  if (!configuration) return {};
  if (typeof configuration === "string") {
    try {
      return JSON.parse(configuration || "{}") || {};
    } catch {
      return {};
    }
  }
  return typeof configuration === "object" ? configuration : {};
}

function getCustomIntegrationReportSourceScope(configuration: any): Record<string, any> | null {
  const scope = parseReportConfiguration(configuration)?.sourceScope;
  const platform = String(scope?.platform || "").replace("-", "_");
  const integrationId = String(scope?.integrationId || "").trim();
  return platform === "custom_integration" && scope?.scopeType === "latest_validated_import" && integrationId ? scope : null;
}

function customIntegrationSourceScopeMatchesReport(rowScope: any, reportScope: any): boolean {
  const rowIntegrationId = String(rowScope?.integrationId || "").trim();
  const reportIntegrationId = String(reportScope?.integrationId || "").trim();
  return Boolean(rowIntegrationId && reportIntegrationId && rowIntegrationId === reportIntegrationId);
}

function platformRequiresSourceBackedReportOutput(platformType: any): boolean {
  const normalized = String(platformType || "").trim().toLowerCase();
  return normalized === "google_analytics" || normalized === "instagram" || normalized === "tiktok" || normalized === "google_sheets" || normalized === "custom-integration" || normalized === "custom_integration";
}

function sourceBackedReportOutputUnavailableMessage(platformType: any): string {
  const normalized = String(platformType || "").trim().toLowerCase();
  const label = normalized === "google_analytics" ? "GA4" : normalized === "tiktok" ? "TikTok" : normalized === "google_sheets" ? "Google Sheets" : normalized === "custom-integration" || normalized === "custom_integration" ? "Custom Integration" : "Instagram";
  return `${label} source-backed PDF output unavailable`;
}

function reportIncludesGA4BenchmarkSection(report: any): boolean {
  const reportType = String((report as any)?.reportType || "overview").trim().toLowerCase();
  if (reportType === "benchmarks") return true;
  if (reportType !== "custom") return false;
  const cfg = parseReportConfiguration((report as any)?.configuration);
  const selectedBenchmarkIds = [
    ...(Array.isArray(cfg?.selectedBenchmarkIds) ? cfg.selectedBenchmarkIds : []),
    ...(Array.isArray(cfg?.benchmarks) ? cfg.benchmarks : []),
  ].map((id: any) => String(id || "").trim()).filter(Boolean);
  return Boolean(cfg?.sections?.benchmarks || cfg?.subsections?.benchmarks?.items || selectedBenchmarkIds.length > 0);
}

function getGA4ReportSelectedBenchmarkIds(report: any): Set<string> {
  const cfg = parseReportConfiguration((report as any)?.configuration);
  return new Set([
    ...(Array.isArray(cfg?.selectedBenchmarkIds) ? cfg.selectedBenchmarkIds : []),
    ...(Array.isArray(cfg?.benchmarks) ? cfg.benchmarks : []),
  ].map((id: any) => String(id || "").trim()).filter(Boolean));
}

export async function preflightGA4ReportKPIConsumers(report: any, date?: string, opts?: { suppressAlerts?: boolean }): Promise<{ ok: boolean; error?: string }> {
  if (String((report as any)?.platformType || "").trim().toLowerCase() !== "google_analytics") return { ok: true };
  const campaignId = String((report as any)?.campaignId || "").trim();
  if (!campaignId) return { ok: false, error: "GA4 report campaign is missing" };
  try {
    let requiredBenchmarkIds = new Set<string>();
    if (reportIncludesGA4BenchmarkSection(report)) {
      const selectedBenchmarkIds = getGA4ReportSelectedBenchmarkIds(report);
      const reportBenchmarks = await storage.getPlatformBenchmarks("google_analytics", campaignId);
      requiredBenchmarkIds = new Set((Array.isArray(reportBenchmarks) ? reportBenchmarks : [])
        .filter((row: any) => selectedBenchmarkIds.size === 0 || selectedBenchmarkIds.has(String(row?.id || "")))
        .filter((row: any) => String(row?.metric || "").trim())
        .map((row: any) => String(row?.id || "").trim())
        .filter(Boolean));
    }

    const result = await runGA4DailyKPIAndBenchmarkJobs({ campaignId, ...(date ? { date } : {}), ...(opts?.suppressAlerts ? { suppressAlerts: true } : {}) });
    if (Number((result as any)?.campaignsProcessed || 0) <= 0) {
      return { ok: false, error: "GA4 KPI/Benchmark recompute skipped target campaign" };
    }
    if (requiredBenchmarkIds.size > 0) {
      const updatedBenchmarkIds = new Set((Array.isArray((result as any)?.benchmarkIdsUpdated) ? (result as any).benchmarkIdsUpdated : []).map((id: any) => String(id || "").trim()).filter(Boolean));
      const missing = Array.from(requiredBenchmarkIds).filter((id) => !updatedBenchmarkIds.has(id));
      if (missing.length > 0) return { ok: false, error: "GA4 Benchmark recompute skipped selected Benchmark rows" };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "GA4 KPI/Benchmark recompute before report failed" };
  }
}

const CUSTOM_INTEGRATION_REPORT_METRICS = [
  { key: "overview.total_revenue", label: "Total Revenue", unit: "$", type: "currency", fields: ["revenue"] },
  { key: "overview.total_spend", label: "Total Spend", unit: "$", type: "currency", fields: ["spend"] },
  { key: "overview.roas", label: "ROAS", unit: "x", type: "ratio", fields: ["roas"] },
  { key: "overview.roi", label: "ROI", unit: "%", type: "percent", fields: ["roi"] },
  { key: "impressions", label: "Impressions", unit: "", type: "count" },
  { key: "clicks", label: "Clicks", unit: "", type: "count" },
  { key: "conversions", label: "Conversions", unit: "", type: "count" },
  { key: "leads", label: "Leads", unit: "", type: "count" },
  { key: "users", label: "Users", unit: "", type: "count" },
  { key: "sessions", label: "Sessions", unit: "", type: "count" },
  { key: "pageviews", label: "Pageviews", unit: "", type: "count" },
  { key: "pagesPerSession", label: "Pages / Session", unit: "", type: "count" },
  { key: "bounceRate", label: "Bounce Rate", unit: "%", type: "percent" },
  { key: "organicSearchShare", label: "Organic Search", unit: "%", type: "percent" },
  { key: "directBrandedShare", label: "Direct / Branded", unit: "%", type: "percent" },
  { key: "emailShare", label: "Email Traffic", unit: "%", type: "percent" },
  { key: "referralShare", label: "Referral / Partners", unit: "%", type: "percent" },
  { key: "paidShare", label: "Paid Traffic", unit: "%", type: "percent" },
  { key: "socialShare", label: "Social Traffic", unit: "%", type: "percent" },
  { key: "emailsDelivered", label: "Emails Delivered", unit: "", type: "count" },
  { key: "openRate", label: "Email Open Rate", unit: "%", type: "percent" },
  { key: "clickThroughRate", label: "Email CTR", unit: "%", type: "percent" },
  { key: "clickToOpen", label: "Email CTOR", unit: "%", type: "percent", fields: ["clickToOpenRate", "clickToOpen"] },
  { key: "listGrowth", label: "List Growth", unit: "", type: "count" },
];

function getCustomIntegrationSourceLabel(metrics: any): string {
  if (metrics?.pdfFileName) return `Import: ${metrics.pdfFileName}`;
  if (metrics?.emailSubject) return `Import: ${metrics.emailSubject}`;
  if (metrics?.uploadedAt) return `Import: ${new Date(metrics.uploadedAt).toLocaleString()}`;
  return "Custom Integration import";
}

function parseCustomIntegrationMetricNumber(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number"
    ? value
    : parseFloat(String(value).replace(/,/g, "").replace(/[$%x]/gi, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCustomIntegrationFinancialReportMetricKey(metricKey: any): string {
  const key = String(metricKey || "").trim();
  if (key === "revenue") return "overview.total_revenue";
  if (key === "spend") return "overview.total_spend";
  if (key === "roas") return "overview.roas";
  if (key === "roi") return "overview.roi";
  return key;
}

function isCustomIntegrationFinancialReportMetric(metricKey: any): boolean {
  return ["overview.total_revenue", "overview.total_spend", "overview.roas", "overview.roi"].includes(
    normalizeCustomIntegrationFinancialReportMetricKey(metricKey)
  );
}

async function buildCustomIntegrationFinancialReportMetrics(campaignId: string, metrics: any) {
  const startDate = "1900-01-01";
  const endDate = "2999-12-31";
  const importedRevenue = parseCustomIntegrationMetricNumber(metrics?.revenue);
  const importedSpend = parseCustomIntegrationMetricNumber(metrics?.spend);
  const [revenueSources, revenueTotal, spendSources, spendBreakdown] = await Promise.all([
    storage.getRevenueSources(campaignId, "custom_integration").catch(() => [] as any[]),
    storage.getRevenueTotalForRange(campaignId, startDate, endDate, "custom_integration").catch(() => ({ totalRevenue: 0 })),
    storage.getSpendSources(campaignId).catch(() => [] as any[]),
    storage.getSpendBreakdownBySource(campaignId, startDate, endDate).catch(() => [] as any[]),
  ]);
  const activeRevenueSources = (Array.isArray(revenueSources) ? revenueSources : []).filter((source: any) => source?.isActive !== false);
  const eligibleSpendIds = new Set((Array.isArray(spendSources) ? spendSources : [])
    .filter((source: any) => source?.isActive !== false && String(source?.platformContext || "").trim().toLowerCase() === "custom_integration")
    .map((source: any) => String(source?.id || ""))
    .filter(Boolean));
  const externalRevenue = Number((revenueTotal as any)?.totalRevenue || 0);
  const externalSpend = (Array.isArray(spendBreakdown) ? spendBreakdown : [])
    .filter((row: any) => eligibleSpendIds.has(String(row?.sourceId || "")))
    .reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0);
  const totalRevenue = externalRevenue + (importedRevenue ?? 0);
  const totalSpend = externalSpend + (importedSpend ?? 0);
  const hasRevenue = importedRevenue !== null || activeRevenueSources.length > 0;
  const hasSpend = importedSpend !== null || eligibleSpendIds.size > 0;
  const hasDerived = hasRevenue && hasSpend && totalSpend > 0;
  const values = new Map<string, { available: boolean; value: number | null; label: string; unit: string; type: string; reason: string }>();
  values.set("overview.total_revenue", hasRevenue
    ? { available: true, value: totalRevenue, label: "Total Revenue", unit: "$", type: "currency", reason: "" }
    : { available: false, value: null, label: "Total Revenue", unit: "$", type: "currency", reason: "Revenue is not available from the active Custom Integration import or added sources." });
  values.set("overview.total_spend", hasSpend
    ? { available: true, value: totalSpend, label: "Total Spend", unit: "$", type: "currency", reason: "" }
    : { available: false, value: null, label: "Total Spend", unit: "$", type: "currency", reason: "Spend is not available from the active Custom Integration import or added sources." });
  values.set("overview.roas", hasDerived
    ? { available: true, value: totalRevenue / totalSpend, label: "ROAS", unit: "x", type: "ratio", reason: "" }
    : { available: false, value: null, label: "ROAS", unit: "x", type: "ratio", reason: "ROAS requires source-backed revenue and spend." });
  values.set("overview.roi", hasDerived
    ? { available: true, value: ((totalRevenue - totalSpend) / totalSpend) * 100, label: "ROI", unit: "%", type: "percent", reason: "" }
    : { available: false, value: null, label: "ROI", unit: "%", type: "percent", reason: "ROI requires source-backed revenue and spend." });
  return values;
}

function resolveCustomIntegrationReportMetric(metrics: any, metricKey: any, financialMetrics?: Map<string, { available: boolean; value: number | null; label: string; unit: string; type: string; reason: string }>): { available: boolean; value: number | null; label: string; unit: string; type: string; reason: string } {
  const key = normalizeCustomIntegrationFinancialReportMetricKey(metricKey);
  const option = CUSTOM_INTEGRATION_REPORT_METRICS.find((metric: any) => metric.key === key || (metric.fields || []).includes(key)) as any;
  if (!option) return { available: false, value: null, label: key || "Metric", unit: "", type: "count", reason: "Metric is not supported by Custom Integration." };
  if (isCustomIntegrationFinancialReportMetric(metricKey) && financialMetrics?.has(key)) {
    return financialMetrics.get(key)!;
  }
  if (key === "overview.roi" || key === "overview.roas") {
    const revenue = parseCustomIntegrationMetricNumber(metrics?.revenue);
    const spend = parseCustomIntegrationMetricNumber(metrics?.spend);
    if (revenue === null) return { available: false, value: null, label: option.label, unit: option.unit, type: option.type, reason: "Revenue is not available in the selected Custom Integration import." };
    if (spend === null || spend <= 0) return { available: false, value: null, label: option.label, unit: option.unit, type: option.type, reason: "Spend is not available in the selected Custom Integration import." };
    return {
      available: true,
      value: key === "overview.roi" ? ((revenue - spend) / spend) * 100 : revenue / spend,
      label: option.label,
      unit: option.unit,
      type: option.type,
      reason: "",
    };
  }
  const fields = option.fields || [option.key];
  const raw = fields.map((field: string) => metrics?.[field]).find((value: any) => value !== null && value !== undefined && value !== "");
  const value = parseCustomIntegrationMetricNumber(raw);
  if (value === null) return { available: false, value: null, label: option.label, unit: option.unit, type: option.type, reason: `${option.label} is not available in the selected Custom Integration import.` };
  return { available: true, value, label: option.label, unit: option.unit, type: option.type, reason: "" };
}

function formatCustomIntegrationReportMetric(value: number | null, unit: string, type: string): string {
  if (value === null || !Number.isFinite(value)) return "Unavailable";
  if (type === "currency" || unit === "$") return `$${formatNumberLike(value)}`;
  if (type === "percent" || unit === "%") return `${formatNumberLike(value)}%`;
  if (type === "ratio" || unit === "x") return `${formatNumberLike(value)}x`;
  return formatNumberLike(value);
}

async function buildCustomIntegrationScheduledPdfAttachment(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return null;
  const configuration = parseReportConfiguration(report?.configuration);
  const reportSourceScope = getCustomIntegrationReportSourceScope(configuration);
  if (!reportSourceScope) return null;
  const sourceIntegrationId = String(reportSourceScope.integrationId || "").trim();
  if (sourceIntegrationId) {
    const integration = await storage.getCustomIntegration(campaignId).catch(() => null as any);
    if (String(integration?.id || "").trim() !== sourceIntegrationId) return null;
  }
  const metrics = await storage.getLatestCustomIntegrationMetrics(campaignId).catch(() => null as any);
  if (!metrics) return null;
  const customIntegrationFinancialReportMetrics = await buildCustomIntegrationFinancialReportMetrics(campaignId, metrics);

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;
  const safeText = (value: any) => String(value ?? "").replace(/[^\x20-\x7E]/g, " ").trim();
  const addText = (value: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) => {
    const indent = opts.indent || 0;
    doc.setFontSize(opts.size || 10);
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    const lines = doc.splitTextToSize(safeText(value), pageWidth - margin * 2 - indent);
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += opts.size && opts.size >= 14 ? 8 : 6;
    });
  };
  const addMetric = (metricKey: any) => {
    const resolved = resolveCustomIntegrationReportMetric(metrics, metricKey, customIntegrationFinancialReportMetrics);
    const value = resolved.available
      ? formatCustomIntegrationReportMetric(resolved.value, resolved.unit, resolved.type)
      : `Unavailable - ${resolved.reason}`;
    addText(`- ${resolved.label}: ${value}`, { indent: 4 });
  };
  const formatSavedCustomIntegrationGoal = (value: any, unit: any) => {
    const normalizedUnit = String(unit || "");
    const type = normalizedUnit === "$" ? "currency" : normalizedUnit === "%" ? "percent" : normalizedUnit === "x" ? "ratio" : "count";
    return formatCustomIntegrationReportMetric(parseCustomIntegrationMetricNumber(value), normalizedUnit, type);
  };
  const addKpiRows = async (selectedIds?: Set<string>) => {
    const rows = await storage.getPlatformKPIs("custom-integration", campaignId).catch(() => [] as any[]);
    const filtered = rows.filter((row: any) => !selectedIds || selectedIds.has(String(row?.id || "")));
    if (filtered.length === 0) {
      addText("- No KPI rows selected.", { indent: 4 });
      return;
    }
    filtered.forEach((row: any) => {
      const rowScope = getCustomIntegrationReportSourceScope(row?.calculationConfig);
      const name = safeText(row?.name || row?.metric || "KPI");
      if (!rowScope) {
        addText(`- ${name}: Current Unavailable - Saved Custom Integration source scope is missing; Target ${formatSavedCustomIntegrationGoal(row?.targetValue, row?.unit)}`, { indent: 4 });
        return;
      }
      if (!customIntegrationSourceScopeMatchesReport(rowScope, reportSourceScope)) {
        addText(`- ${name}: Current Unavailable - Saved Custom Integration source is no longer connected; Target ${formatSavedCustomIntegrationGoal(row?.targetValue, row?.unit)}`, { indent: 4 });
        return;
      }
      const resolved = resolveCustomIntegrationReportMetric(metrics, row?.metric || row?.metricKey, customIntegrationFinancialReportMetrics);
      const current = resolved.available ? formatCustomIntegrationReportMetric(resolved.value, resolved.unit, resolved.type) : `Unavailable - ${resolved.reason}`;
      const target = formatCustomIntegrationReportMetric(parseCustomIntegrationMetricNumber(row?.targetValue), resolved.unit || row?.unit || "", resolved.type);
      addText(`- ${name}: Current ${current}; Target ${target}`, { indent: 4 });
    });
  };
  const addBenchmarkRows = async (selectedIds?: Set<string>) => {
    const rows = await storage.getPlatformBenchmarks("custom-integration", campaignId).catch(() => [] as any[]);
    const filtered = rows.filter((row: any) => !selectedIds || selectedIds.has(String(row?.id || "")));
    if (filtered.length === 0) {
      addText("- No Benchmark rows selected.", { indent: 4 });
      return;
    }
    filtered.forEach((row: any) => {
      const rowScope = getCustomIntegrationReportSourceScope(row?.calculationConfig);
      const name = safeText(row?.name || row?.metric || "Benchmark");
      if (!rowScope) {
        addText(`- ${name}: Current Unavailable - Saved Custom Integration source scope is missing; Benchmark ${formatSavedCustomIntegrationGoal(row?.benchmarkValue, row?.unit)}`, { indent: 4 });
        return;
      }
      if (!customIntegrationSourceScopeMatchesReport(rowScope, reportSourceScope)) {
        addText(`- ${name}: Current Unavailable - Saved Custom Integration source is no longer connected; Benchmark ${formatSavedCustomIntegrationGoal(row?.benchmarkValue, row?.unit)}`, { indent: 4 });
        return;
      }
      const resolved = resolveCustomIntegrationReportMetric(metrics, row?.metric || row?.metricKey, customIntegrationFinancialReportMetrics);
      const current = resolved.available ? formatCustomIntegrationReportMetric(resolved.value, resolved.unit, resolved.type) : `Unavailable - ${resolved.reason}`;
      const benchmark = formatCustomIntegrationReportMetric(parseCustomIntegrationMetricNumber(row?.benchmarkValue), resolved.unit || row?.unit || "", resolved.type);
      addText(`- ${name}: Current ${current}; Benchmark ${benchmark}`, { indent: 4 });
    });
  };
  const addInsightRows = () => {
    const revenue = resolveCustomIntegrationReportMetric(metrics, "revenue", customIntegrationFinancialReportMetrics);
    const spend = resolveCustomIntegrationReportMetric(metrics, "spend", customIntegrationFinancialReportMetrics);
    const clicks = resolveCustomIntegrationReportMetric(metrics, "clicks", customIntegrationFinancialReportMetrics);
    const impressions = resolveCustomIntegrationReportMetric(metrics, "impressions", customIntegrationFinancialReportMetrics);
    const conversions = resolveCustomIntegrationReportMetric(metrics, "conversions", customIntegrationFinancialReportMetrics);
    if (!revenue.available && spend.available) addText("- Source-backed Spend is available but Revenue is unavailable, so ROI and ROAS cannot be evaluated.", { indent: 4 });
    if (revenue.available && !spend.available) addText("- Source-backed Revenue is available but Spend is unavailable, so ROI and ROAS cannot be evaluated.", { indent: 4 });
    if (clicks.available && impressions.available && impressions.value && impressions.value > 0) {
      addText(`- Click-through rate from imported clicks and impressions is ${formatNumberLike((Number(clicks.value) / Number(impressions.value)) * 100)}%.`, { indent: 4 });
    }
    if (conversions.available && clicks.available && clicks.value && clicks.value > 0) {
      addText(`- Conversion rate from imported conversions and clicks is ${formatNumberLike((Number(conversions.value) / Number(clicks.value)) * 100)}%.`, { indent: 4 });
    }
  };

  const reportType = String(report?.reportType || "overview").toLowerCase();
  addText(String(report?.name || "Custom Integration Report"), { size: 18, bold: true });
  addText(`Campaign: ${campaignName || "Campaign"}`);
  addText(`Report Type: ${reportType}`);
  addText(`Window: ${windowStart} to ${windowEnd}`);
  addText(`Source: ${getCustomIntegrationSourceLabel(metrics)}`);
  y += 4;

  if (reportType === "overview" || reportType === "summary") {
    addText(reportType === "summary" ? "Summary" : "Overview", { size: 14, bold: true });
    CUSTOM_INTEGRATION_REPORT_METRICS.slice(0, reportType === "summary" ? 8 : CUSTOM_INTEGRATION_REPORT_METRICS.length).forEach((metric: any) => addMetric(metric.key));
  } else if (reportType === "kpis") {
    addText("KPIs", { size: 14, bold: true });
    await addKpiRows();
  } else if (reportType === "benchmarks") {
    addText("Benchmarks", { size: 14, bold: true });
    await addBenchmarkRows();
  } else if (reportType === "insights") {
    addText("Insights", { size: 14, bold: true });
    addInsightRows();
  } else if (reportType === "custom") {
    const selectedMetrics = Array.from(new Set([...(configuration.coreMetrics || []), ...(configuration.derivedMetrics || [])]));
    if (configuration.sections?.overview || selectedMetrics.length > 0) {
      addText("Overview", { size: 14, bold: true });
      (selectedMetrics.length > 0 ? selectedMetrics : CUSTOM_INTEGRATION_REPORT_METRICS.map((metric: any) => metric.key)).forEach((metricKey: any) => addMetric(metricKey));
    }
    if (configuration.sections?.summary) {
      addText("Summary", { size: 14, bold: true });
      addText(`- Source: ${getCustomIntegrationSourceLabel(metrics)}`, { indent: 4 });
      addText(`- Source-backed metrics: ${CUSTOM_INTEGRATION_REPORT_METRICS.filter((metric: any) => resolveCustomIntegrationReportMetric(metrics, metric.key, customIntegrationFinancialReportMetrics).available).length}`, { indent: 4 });
    }
    if (configuration.sections?.kpis || (configuration.kpis || []).length > 0) {
      addText("KPIs", { size: 14, bold: true });
      await addKpiRows((configuration.kpis || []).length > 0 ? new Set((configuration.kpis || []).map(String)) : undefined);
    }
    if (configuration.sections?.benchmarks || (configuration.benchmarks || []).length > 0) {
      addText("Benchmarks", { size: 14, bold: true });
      await addBenchmarkRows((configuration.benchmarks || []).length > 0 ? new Set((configuration.benchmarks || []).map(String)) : undefined);
    }
    if (configuration.sections?.insights) {
      addText("Insights", { size: 14, bold: true });
      addInsightRows();
    }
  } else {
    addText("Overview", { size: 14, bold: true });
    CUSTOM_INTEGRATION_REPORT_METRICS.forEach((metric: any) => addMetric(metric.key));
  }

  return coercePdfBufferFromDoc(doc);
}

async function validateInstagramScheduledReportScope(report: any): Promise<{ ok: boolean; message?: string; disableSchedule?: boolean }> {
  if (String(report?.platformType || "").trim().toLowerCase() !== "instagram") return { ok: true };
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return { ok: false, message: "Instagram scheduled report campaign is missing", disableSchedule: true };
  const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).catch(() => []);
  if (!campaign) return { ok: false, message: "Campaign not found; skipped scheduled report", disableSchedule: true };
  const connection = await storage.getInstagramConnection(campaignId).catch(() => null as any);
  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map((id: any) => String(id || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  if (!connection || (connection as any).spendOnly || selectedCampaignIds.length === 0) {
    return { ok: false, message: "Instagram source scope is invalid; skipped scheduled report", disableSchedule: true };
  }
  return { ok: true };
}

async function validateTikTokScheduledReportScope(report: any): Promise<{ ok: boolean; message?: string; disableSchedule?: boolean }> {
  if (String(report?.platformType || "").trim().toLowerCase() !== "tiktok") return { ok: true };
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return { ok: false, message: "TikTok scheduled report campaign is missing", disableSchedule: true };
  const [campaign] = await db.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).limit(1).catch(() => []);
  if (!campaign) return { ok: false, message: "Campaign not found; skipped scheduled report", disableSchedule: true };
  const connection = await storage.getTikTokConnection(campaignId).catch(() => null as any);
  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map((id: any) => String(id || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  if (!connection || (connection as any).spendOnly || selectedCampaignIds.length === 0) {
    return { ok: false, message: "TikTok source scope is invalid; skipped scheduled report", disableSchedule: true };
  }
  return { ok: true };
}

async function buildInstagramScheduledPdfAttachment(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return null;
  const connection = await storage.getInstagramConnection(campaignId).catch(() => null as any);
  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map((id: any) => String(id || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  const selectedIds = new Set(selectedCampaignIds);
  if (!connection || selectedIds.size === 0) return null;
  const rows = (await storage.getInstagramDailyMetrics(campaignId, windowStart, windowEnd).catch(() => []))
    .filter((row: any) => selectedIds.has(String(row?.instagramCampaignId || "")))
    .filter((row: any) => String(row?.publisherPlatform || "instagram").trim().toLowerCase() === "instagram");
  if (rows.length === 0) return null;

  const totals = rows.reduce((acc: any, row: any) => {
    acc.impressions += Number(row?.impressions || 0);
    acc.clicks += Number(row?.clicks || 0);
    acc.spend += Number(row?.spend || 0);
    acc.conversions += Number(row?.conversions || 0);
    acc.videoViews += Number(row?.videoViews || 0);
    acc.revenue += Number(row?.ga4Revenue || 0);
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, revenue: 0 });
  const derived = {
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
    roas: totals.spend > 0 && totals.revenue > 0 ? totals.revenue / totals.spend : null,
    roi: totals.spend > 0 && totals.revenue > 0 ? ((totals.revenue - totals.spend) / totals.spend) * 100 : null,
    profit: totals.revenue > 0 ? totals.revenue - totals.spend : null,
  };
  const byCampaign = Array.from(rows.reduce((map: Map<string, any>, row: any) => {
    const key = String(row?.instagramCampaignId || "");
    const current = map.get(key) || { id: key, name: row?.instagramCampaignName || key, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    current.impressions += Number(row?.impressions || 0);
    current.clicks += Number(row?.clicks || 0);
    current.spend += Number(row?.spend || 0);
    current.conversions += Number(row?.conversions || 0);
    map.set(key, current);
    return map;
  }, new Map<string, any>()).values()).sort((a: any, b: any) => b.spend - a.spend);

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
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
  const money = (value: number) => `$${formatNumberLike(value)}`;
  const pct = (value: number) => `${formatNumberLike(value)}%`;

  addText(String(report?.name || "Instagram Report"), { size: 18, bold: true });
  addText(`Campaign: ${campaignName || "Campaign"}`);
  addText(`Report Type: ${String(report?.reportType || "overview")}`);
  addText(`Window: ${windowStart} to ${windowEnd}`);
  addText(`Source: selected Instagram daily metric rows only`);
  y += 4;
  addText("Overview", { size: 14, bold: true });
  addText(`- Impressions: ${formatNumberLike(totals.impressions)}`, { indent: 4 });
  addText(`- Clicks: ${formatNumberLike(totals.clicks)}`, { indent: 4 });
  addText(`- Spend: ${money(totals.spend)}`, { indent: 4 });
  addText(`- Conversions: ${formatNumberLike(totals.conversions)}`, { indent: 4 });
  addText(`- Video Views: ${formatNumberLike(totals.videoViews)}`, { indent: 4 });
  addText(`- CTR: ${pct(derived.ctr)}`, { indent: 4 });
  addText(`- CPC: ${money(derived.cpc)}`, { indent: 4 });
  addText(`- CPM: ${money(derived.cpm)}`, { indent: 4 });
  addText(`- Cost / Conversion: ${money(derived.costPerConversion)}`, { indent: 4 });
  addText(`- Conversion Rate: ${pct(derived.conversionRate)}`, { indent: 4 });
  addText(`- Total Revenue: ${totals.revenue > 0 ? money(totals.revenue) : "Unavailable"}`, { indent: 4 });
  addText(`- ROAS: ${derived.roas === null ? "Unavailable" : `${formatNumberLike(derived.roas)} ratio`}`, { indent: 4 });
  addText(`- ROI: ${derived.roi === null ? "Unavailable" : pct(derived.roi)}`, { indent: 4 });
  addText(`- Profit: ${derived.profit === null ? "Unavailable" : money(derived.profit)}`, { indent: 4 });
  y += 4;
  addText("Selected Instagram Campaigns", { size: 14, bold: true });
  byCampaign.slice(0, 10).forEach((row: any) => {
    addText(`- ${row.name}: ${formatNumberLike(row.impressions)} impressions, ${formatNumberLike(row.clicks)} clicks, ${money(row.spend)} spend, ${formatNumberLike(row.conversions)} conversions`, { indent: 4 });
  });

  return coercePdfBufferFromDoc(doc);
}

async function buildTikTokScheduledPdfAttachment(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return null;
  const connection = await storage.getTikTokConnection(campaignId).catch(() => null as any);
  const selectedCampaignIds = (() => {
    try {
      const parsed = JSON.parse(String(connection?.selectedCampaignIds || "[]"));
      return Array.isArray(parsed) ? parsed.map((id: any) => String(id || "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();
  const selectedIds = new Set(selectedCampaignIds);
  if (!connection || selectedIds.size === 0) return null;
  const rows = (await storage.getTikTokDailyMetrics(campaignId, windowStart, windowEnd).catch(() => []))
    .filter((row: any) => selectedIds.has(String(row?.tiktokCampaignId || "")));
  if (rows.length === 0) return null;

  const totals = rows.reduce((acc: any, row: any) => {
    acc.impressions += Number(row?.impressions || 0);
    acc.clicks += Number(row?.clicks || 0);
    acc.spend += Number(row?.spend || 0);
    acc.conversions += Number(row?.conversions || 0);
    acc.videoViews += Number(row?.videoViews || 0);
    acc.engagements += Number(row?.engagements || 0);
    return acc;
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, engagements: 0 });
  const attributedRevenue = Number(await storage.getRevenueTotalForRange(campaignId, windowStart, windowEnd, "tiktok").catch(() => 0) || 0);
  const derived = {
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    conversionRate: totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0,
    roas: totals.spend > 0 && attributedRevenue > 0 ? attributedRevenue / totals.spend : null,
    roi: totals.spend > 0 && attributedRevenue > 0 ? ((attributedRevenue - totals.spend) / totals.spend) * 100 : null,
  };
  const byCampaign = Array.from(rows.reduce((map: Map<string, any>, row: any) => {
    const key = String(row?.tiktokCampaignId || "");
    const current = map.get(key) || { id: key, name: row?.tiktokCampaignName || key, impressions: 0, clicks: 0, spend: 0, conversions: 0 };
    current.impressions += Number(row?.impressions || 0);
    current.clicks += Number(row?.clicks || 0);
    current.spend += Number(row?.spend || 0);
    current.conversions += Number(row?.conversions || 0);
    map.set(key, current);
    return map;
  }, new Map<string, any>()).values()).sort((a: any, b: any) => b.spend - a.spend);

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
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
  const money = (value: number) => `$${formatNumberLike(value)}`;
  const pct = (value: number) => `${formatNumberLike(value)}%`;

  addText(String(report?.name || "TikTok Report"), { size: 18, bold: true });
  addText(`Campaign: ${campaignName || "Campaign"}`);
  addText(`Report Type: ${String(report?.reportType || "overview")}`);
  addText(`Window: ${windowStart} to ${windowEnd}`);
  addText(`Source: selected TikTok daily metric rows only`);
  y += 4;
  addText("Overview", { size: 14, bold: true });
  addText(`- Impressions: ${formatNumberLike(totals.impressions)}`, { indent: 4 });
  addText(`- Clicks: ${formatNumberLike(totals.clicks)}`, { indent: 4 });
  addText(`- Spend: ${money(totals.spend)}`, { indent: 4 });
  addText(`- Conversions: ${formatNumberLike(totals.conversions)}`, { indent: 4 });
  addText(`- Video Views: ${formatNumberLike(totals.videoViews)}`, { indent: 4 });
  addText(`- Engagements: ${formatNumberLike(totals.engagements)}`, { indent: 4 });
  addText(`- CTR: ${pct(derived.ctr)}`, { indent: 4 });
  addText(`- CPC: ${money(derived.cpc)}`, { indent: 4 });
  addText(`- CPM: ${money(derived.cpm)}`, { indent: 4 });
  addText(`- Cost / Conversion: ${money(derived.costPerConversion)}`, { indent: 4 });
  addText(`- Conversion Rate: ${pct(derived.conversionRate)}`, { indent: 4 });
  addText(`- Total Revenue: ${attributedRevenue > 0 ? money(attributedRevenue) : "Unavailable"}`, { indent: 4 });
  addText(`- ROAS: ${derived.roas === null ? "Unavailable" : `${formatNumberLike(derived.roas)}x`}`, { indent: 4 });
  addText(`- ROI: ${derived.roi === null ? "Unavailable" : pct(derived.roi)}`, { indent: 4 });
  y += 4;
  addText("Selected TikTok Campaigns", { size: 14, bold: true });
  byCampaign.slice(0, 10).forEach((row: any) => {
    addText(`- ${row.name}: ${formatNumberLike(row.impressions)} impressions, ${formatNumberLike(row.clicks)} clicks, ${money(row.spend)} spend, ${formatNumberLike(row.conversions)} conversions`, { indent: 4 });
  });

  return coercePdfBufferFromDoc(doc);
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

type CampaignDeepDiveReportContext = {
  campaign: any | null;
  performanceSummary: any | null;
  executiveSummary: any | null;
  trendAnalysis: any | null;
  kpis: any[];
  benchmarks: any[];
  aggregateSources: any[];
};

async function buildCampaignDeepDiveReportContext(campaignId: string, selectedSections: string[]): Promise<CampaignDeepDiveReportContext> {
  const needsTrendAnalysis = selectedSections.some((section) => section.startsWith("trend-analysis:"));
  const needsExecutiveSummary = selectedSections.some((section) => section.startsWith("executive-summary:"));
  const needsKpiRows = selectedSections.some((section) =>
    section === "performance-summary:overview" ||
    section === "performance-summary:health" ||
    section === "executive-summary:overview" ||
    section === "kpis"
  );
  const needsBenchmarkRows = selectedSections.some((section) =>
    section === "performance-summary:overview" ||
    section === "performance-summary:health" ||
    section === "executive-summary:overview" ||
    section === "benchmarks"
  );
  const [campaignMetrics, campaign, kpis, benchmarks] = await Promise.all([
    aggregateCampaignMetrics(campaignId, { includeTrendAnalysis: needsTrendAnalysis }).catch(() => null),
    storage.getCampaign(campaignId).catch(() => null),
    needsKpiRows ? storage.getCampaignKPIs(campaignId).catch(() => []) : Promise.resolve([]),
    needsBenchmarkRows ? storage.getCampaignBenchmarks(campaignId).catch(() => []) : Promise.resolve([]),
  ]);
  const performanceSummary = (campaignMetrics as any)?.detailedMetrics?.performanceSummary || null;
  const trendAnalysis = needsTrendAnalysis ? ((campaignMetrics as any)?.detailedMetrics?.trendAnalysis || null) : null;
  const aggregateSources = Array.isArray(performanceSummary?.sources)
    ? performanceSummary.sources.filter((source: any) => source?.connected === true && source?.category !== "financial")
    : [];
  const executiveSummary = needsExecutiveSummary ? { performanceSummary, kpis, benchmarks } : null;
  return { campaign, performanceSummary, executiveSummary, trendAnalysis, kpis, benchmarks, aggregateSources };
}

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
  const reportContext = campaignId
    ? await buildCampaignDeepDiveReportContext(campaignId, selectedSections)
    : { campaign: null, performanceSummary: null, executiveSummary: null, trendAnalysis: null, kpis: [], benchmarks: [], aggregateSources: [] };
  const { campaign, performanceSummary, executiveSummary, trendAnalysis, kpis, benchmarks, aggregateSources } = reportContext;
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
  const benchmarkThresholdResult = (row: any) => {
    const key = resolveAggregateMetric(row);
    return key ? computeBenchmarkThresholdResult({
      metric: key,
      name: row?.name || row?.metric,
      unit: row?.unit,
      current: metricNumber(key),
      benchmarkValue: Number(row?.benchmarkValue ?? row?.benchmark) || 0,
    }) : null;
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
      if (!executiveSummary?.performanceSummary) {
        addText("- Executive Summary source context unavailable.", { indent: 8 });
      }
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
        return benchmarkThresholdResult(row)?.status === "behind";
      }).length;
      addText(`- KPI Risk: ${kpiRisk > 0 ? `${kpiRisk} KPI row(s) below 70% of target` : "No mapped KPI rows below 70% of target"}`, { indent: 8 });
      addText(`- Benchmark Risk: ${benchmarkRisk > 0 ? `${benchmarkRisk} Benchmark row(s) classified behind benchmark` : "No mapped Benchmark rows classified behind"}`, { indent: 8 });
    } else if (section === "executive-summary:recommendations") {
      addText("Recommendation basis", { bold: true, indent: 4 });
      if (!executiveSummary?.performanceSummary) {
        addText("- Executive Summary source context unavailable.", { indent: 8 });
      }
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

const GOOGLE_SHEETS_REPORT_DATE_COLUMN_PATTERN = /^(date|week|day|time|timestamp|period|month|year)/i;
const GOOGLE_SHEETS_REPORT_CURRENCY_PATTERN = /(\$|revenue|spend|cost|budget|profit|cpa|cpc|cpm)/i;

const parseGoogleSheetsReportNumber = (value: any): number | null => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const cleaned = typeof value === "string" ? value.replace(/[$,%\s,]/g, "") : value;
  const parsed = typeof cleaned === "string" ? parseFloat(cleaned) : Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGoogleSheetsReportKey = (value: any): string => String(value || "").trim().toLowerCase();

function getGoogleSheetsReportSourceScope(value: any): any | null {
  const cfg = parseReportConfiguration(value);
  const scope = cfg?.sourceScope;
  return scope && String(scope?.platform || "") === "google_sheets" && scope?.activeSpreadsheetId ? scope : null;
}

function isGoogleSheetsConfirmedFinancialMetric(value: any): boolean {
  return parseReportConfiguration(value)?.valueSource === "confirmed_financial_overview";
}

function googleSheetsConnectionMatchesSavedScope(conn: any, scope: any | null): boolean {
  if (!scope?.activeSpreadsheetId) return false;
  const spreadsheetId = String(conn?.spreadsheetId || "");
  const connectionId = String(conn?.id || "");
  const sheetName = String(conn?.sheetName || "");
  return scope.activeSpreadsheetId === `${spreadsheetId}:${connectionId}` ||
    (!!sheetName && scope.activeSpreadsheetId === `${spreadsheetId}:${sheetName}`) ||
    (!!scope.connectionId && String(scope.connectionId) === connectionId);
}

function buildGoogleSheetsCachedMetricSummary(connections: any[], sourceScope: any | null = null) {
  const metrics = new Map<string, { label: string; total: number; type: string }>();
  let rowCount = 0;
  let latestRefresh = "";
  const sourceNames: string[] = [];

  for (const conn of Array.isArray(connections) ? connections : []) {
    if (sourceScope && !googleSheetsConnectionMatchesSavedScope(conn, sourceScope)) continue;
    const purpose = String(conn?.purpose || "").trim().toLowerCase();
    if (conn?.isActive === false || !conn?.spreadsheetId || conn.spreadsheetId === "pending" || (purpose && purpose !== "general")) continue;
    const cache = conn?.cachedData || {};
    const headers = Array.isArray(cache.headers) ? cache.headers : [];
    const rows = Array.isArray(cache.rows) ? cache.rows : [];
    if (headers.length === 0 || rows.length === 0) continue;
    rowCount += rows.length;
    sourceNames.push(String(conn?.sheetName || conn?.spreadsheetName || conn?.spreadsheetId || "Google Sheets").trim());
    if (conn?.lastDataRefreshAt) {
      const refreshed = new Date(conn.lastDataRefreshAt);
      if (Number.isFinite(refreshed.getTime()) && refreshed.toISOString() > latestRefresh) latestRefresh = refreshed.toISOString();
    }

    headers.forEach((header: any, index: number) => {
      const label = String(header || "").trim();
      if (!label || GOOGLE_SHEETS_REPORT_DATE_COLUMN_PATTERN.test(label)) return;
      let total = 0;
      let count = 0;
      let hasDecimal = false;
      let hasCurrency = GOOGLE_SHEETS_REPORT_CURRENCY_PATTERN.test(label);
      for (const row of rows) {
        const cell = Array.isArray(row) ? row[index] : null;
        const parsed = parseGoogleSheetsReportNumber(cell);
        if (parsed === null || Math.abs(parsed) >= 1e12) continue;
        total += parsed;
        count += 1;
        if (String(cell || "").includes(".")) hasDecimal = true;
        if (String(cell || "").includes("$") || String(cell || "").toUpperCase().includes("USD")) hasCurrency = true;
      }
      if (count === 0) return;
      const key = normalizeGoogleSheetsReportKey(label);
      const existing = metrics.get(key);
      metrics.set(key, {
        label,
        total: Number(((existing?.total || 0) + total).toFixed(2)),
        type: hasCurrency ? "currency" : hasDecimal ? "decimal" : "integer",
      });
    });
  }

  return { metrics, rowCount, latestRefresh, sourceNames };
}

function formatGoogleSheetsReportValue(value: any, label: string, type?: string): string {
  const parsed = parseGoogleSheetsReportNumber(value);
  if (parsed === null) return "Unavailable";
  const normalized = String(label || "").toLowerCase();
  if (type === "currency" || GOOGLE_SHEETS_REPORT_CURRENCY_PATTERN.test(normalized)) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(parsed);
  }
  if (normalized.includes("%") || /rate|ctr|cvr|roi/.test(normalized)) {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed)}%`;
  }
  if (/roas|return on/.test(normalized)) {
    return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)}x`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: type === "integer" ? 0 : 2 }).format(parsed);
}

async function buildGoogleSheetsConfirmedFinancialMetricSummary(campaignId: string) {
  const startDate = "1900-01-01";
  const endDate = "2999-12-31";
  const revenueTotal = await storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_sheets").catch(() => ({ totalRevenue: 0 }));
  const [spendSources, spendBreakdown] = await Promise.all([
    storage.getSpendSources(campaignId).catch(() => [] as any[]),
    storage.getSpendBreakdownBySource(campaignId, startDate, endDate).catch(() => [] as any[]),
  ]);
  const eligibleSpendIds = new Set((Array.isArray(spendSources) ? spendSources : [])
    .filter((source: any) => source?.isActive !== false && String(source?.platformContext || "").trim().toLowerCase() === "google_sheets")
    .map((source: any) => String(source?.id || ""))
    .filter(Boolean));
  const totalSpend = (Array.isArray(spendBreakdown) ? spendBreakdown : [])
    .filter((row: any) => eligibleSpendIds.has(String(row?.sourceId || "")))
    .reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0);
  const totalRevenue = Number((revenueTotal as any)?.totalRevenue || 0);
  const metrics = new Map<string, { label: string; total: number; type: string }>();
  if (totalRevenue > 0) metrics.set("overview.total_revenue", { label: "Total Revenue", total: totalRevenue, type: "currency" });
  if (totalSpend > 0) metrics.set("overview.total_spend", { label: "Total Spend", total: totalSpend, type: "currency" });
  if (totalRevenue > 0 && totalSpend > 0) {
    metrics.set("overview.roas", { label: "ROAS", total: Number((totalRevenue / totalSpend).toFixed(2)), type: "decimal" });
    metrics.set("overview.roi", { label: "ROI", total: Number((((totalRevenue - totalSpend) / totalSpend) * 100).toFixed(2)), type: "decimal" });
  }
  return metrics;
}

async function buildGoogleSheetsScheduledPdfAttachment(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName } = args;
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) return null;
  const connections = await storage.getGoogleSheetsConnections(campaignId).catch(() => [] as any[]);
  const cfg = parseReportConfiguration(report?.configuration);
  const reportSourceScope = getGoogleSheetsReportSourceScope(report?.configuration);
  if (!reportSourceScope) return null;
  const source = buildGoogleSheetsCachedMetricSummary(connections, reportSourceScope);
  if (source.metrics.size === 0) return null;

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;
  const reportType = String(report?.reportType || "overview").toLowerCase();
  const selectedMetrics = new Set((Array.isArray(cfg.selectedMetrics) ? cfg.selectedMetrics : []).map((metric: any) => normalizeGoogleSheetsReportKey(metric)));
  const selectedKpiIds = new Set([...(Array.isArray(cfg.kpis) ? cfg.kpis : []), ...(Array.isArray(cfg.selectedKpiIds) ? cfg.selectedKpiIds : [])].map((id: any) => String(id)));
  const selectedBenchmarkIds = new Set([...(Array.isArray(cfg.benchmarks) ? cfg.benchmarks : []), ...(Array.isArray(cfg.selectedBenchmarkIds) ? cfg.selectedBenchmarkIds : [])].map((id: any) => String(id)));
  const confirmedFinancialMetrics = await buildGoogleSheetsConfirmedFinancialMetricSummary(campaignId);

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
  const addMetricRows = (filter?: (metric: { label: string; total: number; type: string }) => boolean) => {
    const rows = Array.from(source.metrics.values()).filter((metric) => !filter || filter(metric));
    if (rows.length === 0) {
      addText("- No selected Google Sheets metrics are available from refreshed cached rows.", { indent: 4 });
      return;
    }
    rows.slice(0, 30).forEach((metric) => {
      addText(`- ${metric.label}: ${formatGoogleSheetsReportValue(metric.total, metric.label, metric.type)}`, { indent: 4 });
    });
    if (rows.length > 30) addText(`- ${rows.length - 30} additional metric(s) omitted from PDF view.`, { indent: 4 });
  };
  const addKpiRows = async () => {
    const rows = await storage.getPlatformKPIs("google_sheets", campaignId).catch(() => [] as any[]);
    const filtered = selectedKpiIds.size > 0 ? rows.filter((row: any) => selectedKpiIds.has(String(row?.id))) : rows;
    if (filtered.length === 0) {
      addText("- No Google Sheets KPI rows are available.", { indent: 4 });
      return;
    }
    filtered.forEach((row: any) => {
      const rowSource = isGoogleSheetsConfirmedFinancialMetric(row?.calculationConfig)
        ? { metrics: confirmedFinancialMetrics }
        : (() => {
          const rowScope = getGoogleSheetsReportSourceScope(row?.calculationConfig);
          return rowScope ? buildGoogleSheetsCachedMetricSummary(connections, rowScope) : { metrics: new Map<string, { label: string; total: number; type: string }>() };
        })();
      const metric = rowSource.metrics.get(normalizeGoogleSheetsReportKey(row?.metric || row?.metricKey));
      const current = metric ? formatGoogleSheetsReportValue(metric.total, metric.label, metric.type) : "Unavailable";
      const target = formatGoogleSheetsReportValue(row?.targetValue, metric?.label || row?.metric || row?.name, metric?.type);
      addText(`- ${row?.name || row?.metric || "KPI"}: Current ${current}; Target ${target}`, { indent: 4 });
    });
  };
  const addBenchmarkRows = async () => {
    const rows = await storage.getPlatformBenchmarks("google_sheets", campaignId).catch(() => [] as any[]);
    const filtered = selectedBenchmarkIds.size > 0 ? rows.filter((row: any) => selectedBenchmarkIds.has(String(row?.id))) : rows;
    if (filtered.length === 0) {
      addText("- No Google Sheets Benchmark rows are available.", { indent: 4 });
      return;
    }
    filtered.forEach((row: any) => {
      const rowSource = isGoogleSheetsConfirmedFinancialMetric(row?.calculationConfig)
        ? { metrics: confirmedFinancialMetrics }
        : (() => {
          const rowScope = getGoogleSheetsReportSourceScope(row?.calculationConfig);
          return rowScope ? buildGoogleSheetsCachedMetricSummary(connections, rowScope) : { metrics: new Map<string, { label: string; total: number; type: string }>() };
        })();
      const metric = rowSource.metrics.get(normalizeGoogleSheetsReportKey(row?.metric || row?.metricKey));
      const current = metric ? formatGoogleSheetsReportValue(metric.total, metric.label, metric.type) : "Unavailable";
      const target = formatGoogleSheetsReportValue(row?.benchmarkValue, metric?.label || row?.metric || row?.name, metric?.type);
      addText(`- ${row?.name || row?.metric || "Benchmark"}: Current ${current}; Benchmark ${target}`, { indent: 4 });
    });
  };

  addText(String(report?.name || "Google Sheets Report"), { size: 18, bold: true });
  addText(`Campaign: ${campaignName || "Campaign"}`);
  addText(`Window: ${windowStart} to ${windowEnd}`);
  addText(`Rows: ${source.rowCount}`);
  addText(`Source: ${source.sourceNames.join(", ") || "Google Sheets"}`);
  if (source.latestRefresh) addText(`Last refreshed: ${source.latestRefresh}`);
  y += 4;

  if (reportType === "overview") {
    addText("Overview", { size: 14, bold: true });
    addMetricRows();
  } else if (reportType === "kpis") {
    addText("KPIs", { size: 14, bold: true });
    await addKpiRows();
  } else if (reportType === "benchmarks") {
    addText("Benchmarks", { size: 14, bold: true });
    await addBenchmarkRows();
  } else if (reportType === "custom") {
    addText("Custom Report", { size: 14, bold: true });
    if (selectedMetrics.size > 0 || cfg?.sections?.overview) {
      addText("Overview", { bold: true });
      addMetricRows(selectedMetrics.size > 0 ? (metric) => selectedMetrics.has(normalizeGoogleSheetsReportKey(metric.label)) : undefined);
    }
    if (selectedKpiIds.size > 0 || cfg?.sections?.kpis) {
      addText("KPIs", { bold: true });
      await addKpiRows();
    }
    if (selectedBenchmarkIds.size > 0 || cfg?.sections?.benchmarks) {
      addText("Benchmarks", { bold: true });
      await addBenchmarkRows();
    }
    if (cfg?.sections?.insights) {
      addText("Insights", { bold: true });
      addText(`- Detected source-backed metrics: ${source.metrics.size}`, { indent: 4 });
      addText(`- Current refreshed rows: ${source.rowCount}`, { indent: 4 });
    }
  } else if (reportType === "ads") {
    addText("Ad Comparison", { size: 14, bold: true });
    addText("- Google Sheets does not expose ad-level rows for this source. Use a paid-media source for Ad Comparison reports.", { indent: 4 });
  } else {
    addText("Insights", { size: 14, bold: true });
    addText(`- Detected source-backed metrics: ${source.metrics.size}`, { indent: 4 });
    addText(`- Current refreshed rows: ${source.rowCount}`, { indent: 4 });
    addMetricRows();
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

    if (String((report as any)?.platformType || "") === "instagram") {
      return buildInstagramScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });
    }
    if (String((report as any)?.platformType || "") === "tiktok") {
      return buildTikTokScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });
    }
    if (String((report as any)?.platformType || "") === "google_sheets") {
      return buildGoogleSheetsScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });
    }
    if (String((report as any)?.platformType || "") === "custom-integration" || String((report as any)?.platformType || "") === "custom_integration") {
      return buildCustomIntegrationScheduledPdfAttachment({ report, windowStart, windowEnd, campaignName });
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
    const reportConfiguration = parseReportConfiguration((report as any)?.configuration);
    const revenueSemantics = reportConfiguration?.revenueSemantics || {};

    const addGoogleAdsRevenueSemantics = () => {
      if (platformType !== "google_ads") return;
      const totalRevenueConnected = String(revenueSemantics?.totalRevenueSource || "") === "google_ads_imported_attributed_revenue";
      const sourceRows = Array.isArray(revenueSemantics?.sourceProvenance) ? revenueSemantics.sourceProvenance : [];
      ensureSpace(38 + Math.min(sourceRows.length, 5) * 6);
      text("Revenue semantics", left, y, 12, "bold");
      y += 8;
      line(left, y, right, y);
      y += 8;
      text(`Total Revenue: ${totalRevenueConnected ? "Imported Google Ads attributed revenue" : "Not connected"}`, left, y, 9, "normal", [71, 85, 105]);
      y += 6;
      text("Conversion Value: Native Google Ads conversion value", left, y, 9, "normal", [71, 85, 105]);
      y += 6;
      text(`ROAS/ROI/Profit: ${totalRevenueConnected ? "Imported attributed revenue / spend" : "Unavailable until attributed revenue is connected"}`, left, y, 9, "normal", [71, 85, 105]);
      y += 6;
      if (sourceRows.length > 0) {
        text("Source provenance", left, y, 9, "bold", [71, 85, 105]);
        y += 6;
        sourceRows.slice(0, 5).forEach((source: any) => {
          const label = safeText(source?.label || source?.sourceType || "Revenue source");
          const type = safeText(source?.sourceType || "source");
          text(`- ${label} (${type})`, left + 4, y, 9, "normal", [71, 85, 105]);
          y += 6;
        });
      }
      y += 4;
    };

    addGoogleAdsRevenueSemantics();

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
  const now = new Date();
  schedulerMetrics.totalChecks++;
  schedulerMetrics.lastCheckTime = now;
  schedulerMetrics.lastCheckFinishedAt = null;
  schedulerMetrics.lastScheduledReportsFound = 0;
  schedulerMetrics.lastDueReportsFound = 0;
  try {
    console.log('[Report Scheduler] Checking for due scheduled reports...');

    // Fetch campaign-scoped and platform-level scheduled rows from shared report storage explicitly.
    const allReports = await storage.getScheduledPlatformReports([...SCHEDULED_REPORT_PLATFORM_TYPES]);
    console.log(`[Report Scheduler] Found ${allReports.length} scheduled platform report rows`);

    if (allReports.length === 0) {
      console.log('[Report Scheduler] No scheduled platform reports found');
      return;
    }

    const uniqueReports = Array.from(
      new Map(allReports.map(report => [String(report.id), report])).values()
    );
    const scheduledReports = uniqueReports.filter(r => r.scheduleEnabled && r.status === 'active');
    schedulerMetrics.lastScheduledReportsFound = scheduledReports.length;

    if (scheduledReports.length === 0) {
      console.log('[Report Scheduler] No scheduled reports found');
      return;
    }

    console.log(`[Report Scheduler] Found ${scheduledReports.length} scheduled reports`);

    for (const report of scheduledReports) {
      const due = isReportDueNow(report, now);
      if (!due.due || !due.scheduledKey) continue;
      schedulerMetrics.lastDueReportsFound++;
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

      const instagramScope = await validateInstagramScheduledReportScope(report);
      if (!instagramScope.ok) {
        const message = instagramScope.message || "Instagram scheduled report skipped";
        console.warn(`[Report Scheduler] ${message}: report=${report.id}, campaign=${(report as any).campaignId || "none"}`);
        if (instagramScope.disableSchedule) {
          await db
            .update(linkedinReports)
            .set({ scheduleEnabled: false, updatedAt: new Date() } as any)
            .where(eq(linkedinReports.id, String((report as any).id)))
            .catch(() => { });
        }
        await db
          .update(reportSendEvents)
          .set({ status: "skipped", error: message } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

      const tiktokScope = await validateTikTokScheduledReportScope(report);
      if (!tiktokScope.ok) {
        const message = tiktokScope.message || "TikTok scheduled report skipped";
        console.warn(`[Report Scheduler] ${message}: report=${report.id}, campaign=${(report as any).campaignId || "none"}`);
        if (tiktokScope.disableSchedule) {
          await db
            .update(linkedinReports)
            .set({ scheduleEnabled: false, updatedAt: new Date() } as any)
            .where(eq(linkedinReports.id, String((report as any).id)))
            .catch(() => { });
        }
        await db
          .update(reportSendEvents)
          .set({ status: "skipped", error: message } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

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

      const snapshotPlatformType = String((report as any).platformType || "linkedin");
      const snapshotPayload = {
        reportId: String((report as any).id),
        reportName: String((report as any).name || ""),
        reportType: String((report as any).reportType || ""),
        platformType: snapshotPlatformType,
        campaignId: (report as any).campaignId || null,
        campaignName,
        windowStart,
        windowEnd,
        generatedAt: now.toISOString(),
        scheduledKey: due.scheduledKey,
        ...(snapshotPlatformType === "google_ads" ? { configuration: parseReportConfiguration((report as any).configuration) } : {}),
      };

      const ga4Preflight = await preflightGA4ReportKPIConsumers(report, windowEnd);
      if (!ga4Preflight.ok) {
        const error = `${ga4Preflight.error}; skipped scheduled report`;
        console.warn(`[Report Scheduler] ${error}: report=${report.id}, campaign=${(report as any).campaignId || "none"}`);
        await db
          .update(reportSendEvents)
          .set({ status: "failed", error } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

      const pdfBuffer = await buildPdfAttachmentForReport({
        report,
        windowStart,
        windowEnd,
        campaignName,
        isTest: false,
      });
      console.log(`[Report Scheduler] PDF attachment bytes: ${pdfBuffer ? pdfBuffer.length : 0}`);
      if (platformRequiresSourceBackedReportOutput(snapshotPlatformType) && !pdfBuffer) {
        const error = `${sourceBackedReportOutputUnavailableMessage(snapshotPlatformType)}; skipped scheduled report`;
        console.warn(`[Report Scheduler] ${error}: report=${report.id}, campaign=${(report as any).campaignId || "none"}`);
        await db
          .update(reportSendEvents)
          .set({ status: "failed", error } as any)
          .where(and(eq(reportSendEvents.reportId, String((report as any).id)), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => { });
        continue;
      }

      // Send email with retry mechanism (with PDF attachment when possible)
      let sent = await sendReportEmailWithRetry(report, recipients, {
        windowStart,
        windowEnd,
        campaignName,
        attachment: pdfBuffer ? { filename: `${snapshotPayload.reportName.replace(/\s+/g, "_")}_${windowEnd}.pdf`, content: pdfBuffer } : null,
      });
      let sendEventStatus: "sent" | "failed" | "pending_delivery" = sent ? "sent" : "failed";
      let deliveryError = "";
      if (sent) {
        const deliveryConfirmation = await confirmScheduledReportEmailDelivery(snapshotPayload.reportId);
        sent = deliveryConfirmation.sent;
        sendEventStatus = deliveryConfirmation.status;
        deliveryError = deliveryConfirmation.error;
      }


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
      const emailError = sent ? "" : (deliveryError || await getLatestReportEmailError(snapshotPayload.reportId));
      const sendError = emailError || "Email send failed after retries";
      const persistedSendError = retryingFailedSend && sendEventStatus === "failed" ? `Retry failed after previous failure: ${sendError}` : sendError;

      if (sent) {
        schedulerMetrics.totalSent++;
        schedulerMetrics.lastSuccessTime = new Date();
      } else if (sendEventStatus === "failed") {
        schedulerMetrics.totalFailed++;
        schedulerMetrics.lastErrorTime = new Date();
        schedulerMetrics.lastError = persistedSendError;
      }

      await db
        .update(reportSendEvents)
        .set({
          status: sendEventStatus,
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
  } finally {
    schedulerMetrics.lastCheckFinishedAt = new Date();
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
      for (const platformType of SCHEDULED_REPORT_PLATFORM_TYPES) {
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
          ...(await storage.getPlatformReports('google_ads')),
          ...(await storage.getPlatformReports('instagram')),
          ...(await storage.getPlatformReports('tiktok')),
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

    const instagramScope = await validateInstagramScheduledReportScope(report);
    if (!instagramScope.ok) {
      return { success: false, message: instagramScope.message || "Instagram scheduled report skipped", recipients: (report as any).scheduleRecipients || [] };
    }
    const tiktokScope = await validateTikTokScheduledReportScope(report);
    if (!tiktokScope.ok) {
      return { success: false, message: tiktokScope.message || "TikTok scheduled report skipped", recipients: (report as any).scheduleRecipients || [] };
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

    const ga4Preflight = await preflightGA4ReportKPIConsumers(report, windowEnd, { suppressAlerts: true });
    if (!ga4Preflight.ok) {
      return { success: false, message: `${ga4Preflight.error}; test report skipped`, recipients };
    }

    const pdfBuffer = await buildPdfAttachmentForReport({
      report,
      windowStart,
      windowEnd,
      campaignName,
      isTest: true,
    });
    console.log(`[Report Scheduler] PDF attachment bytes (test): ${pdfBuffer ? pdfBuffer.length : 0}`);
    if (platformRequiresSourceBackedReportOutput((report as any)?.platformType) && !pdfBuffer) {
      return { success: false, message: `${sourceBackedReportOutputUnavailableMessage((report as any)?.platformType)}; test report skipped`, recipients };
    }

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

  // Enterprise-grade: Use node-cron for guaranteed execution times
  // Run every minute for precision (idempotency prevents duplicates)
  const cronSchedule = process.env.REPORT_SCHEDULER_CRON || '* * * * *'; // Default: every minute
  schedulerMetrics.schedulerStartedAt = new Date();
  schedulerMetrics.cronSchedule = cronSchedule;

  // Optionally run immediately on startup
  if (process.env.RUN_REPORT_SCHEDULER_ON_STARTUP === "true") {
    void checkScheduledReports();
  }

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

