import { ga4Service } from "./analytics";
import { storage } from "./storage";
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE, getReportingDateWindow, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { computeCpa, computeRoiPercent, normalizeRateToPercent } from "../shared/metric-math";
import { formatGA4AdComparisonCardPct, selectGA4AdComparisonLeaderCards } from "../shared/ga4-ad-comparison-cards";
import { normalizeGA4CampaignAllocationKey, selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { computeBenchmarkThresholdResult, resolveBenchmarkDataSufficiency } from "../shared/kpi-math";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";

type CampaignFilter = string | string[] | undefined;
type C3 = [number, number, number];

const defaultCustomReportSections = {
  overview: false,
  kpis: false,
  benchmarks: false,
  ads: false,
  insights: false,
};

const defaultCustomReportSubsections = {
  overview: { summary: false, revenue: false, spend: false, performance: false, campaignBreakdown: false, landingPages: false, conversionEvents: false },
  kpis: { items: false },
  benchmarks: { items: false },
  ads: { summary: false, topCampaigns: false, allCampaigns: false, bestWorst: false, revenueBreakdown: false },
  insights: { summaryCards: false, trends: false, dataSummary: false, actions: false },
};

const COLORS = {
  overview: [120, 80, 220] as C3,
  ads: [80, 130, 230] as C3,
  insights: [16, 175, 140] as C3,
  kpis: [120, 80, 220] as C3,
  benchmarks: [80, 130, 230] as C3,
  success: [34, 197, 94] as C3,
  warning: [245, 158, 11] as C3,
  danger: [239, 68, 68] as C3,
  info: [99, 102, 241] as C3,
  text: [24, 24, 27] as C3,
  textSec: [113, 113, 122] as C3,
  textTert: [161, 161, 170] as C3,
  white: [255, 255, 255] as C3,
  cardBorder: [228, 228, 231] as C3,
  cardBg: [250, 250, 252] as C3,
  divider: [240, 240, 243] as C3,
  barBg: [240, 240, 243] as C3,
};

const INSIGHT_CATEGORY_GROUPS = [
  { key: "setup", label: "Data setup issues" },
  { key: "targets", label: "Targets off track" },
  { key: "trends", label: "Trend signals" },
  { key: "finance", label: "Revenue and spend checks" },
  { key: "context", label: "Informational context" },
] as const;
type InsightCategory = typeof INSIGHT_CATEGORY_GROUPS[number]["key"];
type InsightConfidence = "High" | "Medium" | "Low";

const buildExecutiveFinancialsDescription = (spendLabels: string[], revenueLabels: string[]) => {
  const hasSpend = spendLabels.length > 0;
  const hasRevenue = revenueLabels.length > 0;
  const revenueText = revenueLabels.join(", ");
  if (hasSpend && hasRevenue) return `Uses source-backed spend-to-date and total revenue from ${revenueText}.`;
  if (hasRevenue) return `Uses total revenue from ${revenueText}; no spend source is connected.`;
  if (hasSpend) return "Uses source-backed spend-to-date; no revenue source is connected.";
  return "No spend or revenue source is connected.";
};

const toISODateUTC = (value: any) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};

const parseGA4CampaignFilter = (raw: any): CampaignFilter => {
  if (raw === null || raw === undefined) return undefined;
  const s = String(raw || "").trim();
  if (!s) return undefined;
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    } catch {
      return s;
    }
  }
  return s;
};

const normalizeCustomReportConfig = (cfg: any = {}) => ({
  ...cfg,
  sections: { ...defaultCustomReportSections, ...(cfg?.sections || {}) },
  subsections: {
    overview: { ...defaultCustomReportSubsections.overview, ...(cfg?.subsections?.overview || {}) },
    kpis: { ...defaultCustomReportSubsections.kpis, ...(cfg?.subsections?.kpis || {}) },
    benchmarks: { ...defaultCustomReportSubsections.benchmarks, ...(cfg?.subsections?.benchmarks || {}) },
    ads: { ...defaultCustomReportSubsections.ads, ...(cfg?.subsections?.ads || {}) },
    insights: { ...defaultCustomReportSubsections.insights, ...(cfg?.subsections?.insights || {}) },
  },
  selectedKpiIds: Array.isArray(cfg?.selectedKpiIds) ? cfg.selectedKpiIds.map(String) : [],
  selectedBenchmarkIds: Array.isArray(cfg?.selectedBenchmarkIds) ? cfg.selectedBenchmarkIds.map(String) : [],
});

const parseReportConfiguration = (configuration: any): Record<string, any> => {
  if (typeof configuration === "string") {
    try {
      return JSON.parse(configuration || "{}") || {};
    } catch {
      return {};
    }
  }
  return typeof configuration === "object" && configuration ? configuration : {};
};

const reportIncludesKPISection = (report: any): boolean => {
  const reportType = String(report?.reportType || "overview").toLowerCase();
  if (reportType === "kpis") return true;
  if (reportType !== "custom") return false;
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  return Boolean(cfg.sections?.kpis && cfg.subsections?.kpis?.items && cfg.selectedKpiIds.length > 0);
};

const reportIncludesBenchmarkSection = (report: any): boolean => {
  const reportType = String(report?.reportType || "overview").toLowerCase();
  if (reportType === "benchmarks" || reportType === "insights") return true;
  if (reportType !== "custom") return false;
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  return Boolean(cfg.sections?.insights || (cfg.sections?.benchmarks && cfg.subsections?.benchmarks?.items && cfg.selectedBenchmarkIds.length > 0));
};

const getOverviewReportRequirements = (report: any) => {
  const reportType = String(report?.reportType || "overview").toLowerCase();
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  const includesOverview = reportType === "overview" || (reportType === "custom" && cfg.sections?.overview);
  const subsections = cfg.subsections?.overview || {};
  return {
    summary: Boolean(includesOverview && (reportType !== "custom" || subsections.summary === true)),
    revenue: Boolean(includesOverview && (reportType !== "custom" || subsections.revenue === true || subsections.performance === true)),
    spend: Boolean(includesOverview && (reportType !== "custom" || subsections.spend === true || subsections.performance === true)),
    campaignBreakdown: Boolean(includesOverview && (reportType !== "custom" || subsections.campaignBreakdown === true)),
    landingPages: Boolean(includesOverview && (reportType !== "custom" || subsections.landingPages === true)),
    conversionEvents: Boolean(includesOverview && (reportType !== "custom" || subsections.conversionEvents === true)),
  };
};

const getAdComparisonReportRequirements = (report: any) => {
  const reportType = String(report?.reportType || 'overview').toLowerCase();
  const cfg = normalizeCustomReportConfig(
    parseReportConfiguration(report?.configuration),
  );
  const included =
    reportType === 'ads' || (reportType === 'custom' && cfg.sections?.ads);
  const subsections = cfg.subsections?.ads || {};
  return {
    included: Boolean(included),
    revenueBreakdown: Boolean(
      included && (reportType !== 'custom' || subsections.revenueBreakdown === true),
    ),
  };
};

const normalizeCampaignKey = normalizeGA4CampaignAllocationKey;

const parseMappingConfig = (value: any) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value || {};
};

const formatPct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

const formatReportingTimeZoneLabel = (value: any) => {
  const tz = String(value || "UTC").trim() || "UTC";
  if (tz === "UTC") return "UTC";
  const location = tz.split("/").filter(Boolean).pop() || tz;
  return location.replace(/_/g, " ");
};

const formatReportingDateLabel = (value: any) => {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "Not available yet";
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? s
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(d);
};

const formatReportingTimestampLabel = (value: any, reportingTimeZone: string) => {
  if (!value) return "Not available yet";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: reportingTimeZone,
      timeZoneName: "short",
    }).format(d);
};

const coercePdfBufferFromDoc = (doc: any): Buffer | null => {
  try {
    const nb = doc.output("nodebuffer");
    if (nb) {
      const buf = Buffer.isBuffer(nb) ? nb : Buffer.from(nb as any);
      if (buf.length > 100) return buf;
    }
  } catch {}
  try {
    const ab = doc.output("arraybuffer");
    const byteLen = (ab && (ab.byteLength ?? (ab as any).length)) || 0;
    if (byteLen && byteLen > 100) return Buffer.from(ab as any);
  } catch {}
  return null;
};

const choosePrimaryConnection = async (campaignId: string) => {
  const connections = await storage.getGA4Connections(campaignId);
  const selected = (connections || []).find((c: any) => c?.isPrimary) || (connections || [])[0];
  if (!selected) throw new Error("NO_GA4_CONNECTION");
  if (selected.method !== "access_token") throw new Error("GA4_CONNECTION_METHOD_UNSUPPORTED");
  return selected;
};

const getLatestGa4Token = async (connection: any) => {
  if (connection.accessToken) return String(connection.accessToken);
  throw Object.assign(new Error("TOKEN_EXPIRED"), { isTokenExpired: true });
};

const withTokenRefresh = async <T>(connection: any, fn: (token: string) => Promise<T>): Promise<T> => {
  const isAuthError = (value: any) => {
    const text = String(value?.message || value || "").toLowerCase();
    return text.includes('"code": 401') || text.includes("unauthenticated") || text.includes("invalid authentication credentials") || text.includes("request had invalid authentication credentials") || text.includes("invalid_grant") || text.includes("403");
  };
  const token = await getLatestGa4Token(connection);
  try {
    return await fn(token);
  } catch (error: any) {
    if (isAuthError(error) && connection.refreshToken) {
      const refresh = await ga4Service.refreshAccessToken(
        String(connection.refreshToken),
        connection.clientId || undefined,
        connection.clientSecret || undefined
      );
      await storage.updateGA4ConnectionTokens(connection.id, {
        accessToken: refresh.access_token,
        refreshToken: String(connection.refreshToken),
        expiresAt: new Date(Date.now() + refresh.expires_in * 1000),
      });
      return await fn(String(refresh.access_token));
    }
    throw error;
  }
};

const buildTrendRollups = (dailyRows: any[]) => {
  const rows = [...dailyRows]
    .map((row: any) => ({
      date: String(row?.date || ""),
      sessions: Number(row?.sessions || 0),
      users: Number(row?.users || 0),
      conversions: Number(row?.conversions || 0),
      revenue: Number(row?.revenue || 0),
      engagedSessions: Number(row?.engagedSessions || 0),
      pageviews: Number(row?.pageviews || 0),
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((a, b) => a.date.localeCompare(b.date));
  const sumWindow = (items: any[]) => {
    const sessions = items.reduce((sum, row) => sum + row.sessions, 0);
    const conversions = items.reduce((sum, row) => sum + row.conversions, 0);
    const revenue = Number(items.reduce((sum, row) => sum + row.revenue, 0).toFixed(2));
    const engagedSessions = items.reduce((sum, row) => sum + row.engagedSessions, 0);
    const pageviews = items.reduce((sum, row) => sum + row.pageviews, 0);
    return {
      sessions,
      conversions,
      revenue,
      engagementRate: sessions > 0 ? engagedSessions / sessions : 0,
      cr: sessions > 0 ? (conversions / sessions) * 100 : 0,
      pvps: sessions > 0 ? pageviews / sessions : 0,
    };
  };
  const last7 = sumWindow(rows.slice(-7));
  const prior7 = sumWindow(rows.slice(-14, -7));
  const last30 = sumWindow(rows.slice(-30));
  const prior30 = sumWindow(rows.slice(-60, -30));
  const last3 = sumWindow(rows.slice(-3));
  const prior3 = sumWindow(rows.slice(-6, -3));
  const pctDelta = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev) * 100 : 0;
  return {
    availableDays: rows.length,
    rows,
    last7,
    prior7,
    last30,
    prior30,
    last3,
    prior3,
    deltas: {
      sessions7: pctDelta(last7.sessions, prior7.sessions),
      revenue7: pctDelta(last7.revenue, prior7.revenue),
      conversions7: pctDelta(last7.conversions, prior7.conversions),
      sessions3: pctDelta(last3.sessions, prior3.sessions),
      revenue3: pctDelta(last3.revenue, prior3.revenue),
      conversions3: pctDelta(last3.conversions, prior3.conversions),
    },
  };
};

const buildInsightsItems = (payload: any) => {
  const items: Array<{ severity: "high" | "medium" | "positive" | "info"; title: string; description: string; recommendation?: string; category: InsightCategory; dataBasis: string; confidence: InsightConfidence }> = [];
  const financialRevenue = Number(payload.financialRevenue || 0);
  const financialSpend = Number(payload.financialSpend || 0);
  const rollups = payload.insightsRollups;
  if (financialSpend > 0 && financialRevenue <= 0) {
    items.push({
      severity: "high",
      title: "Spend without revenue",
      description: `Spend-to-date is ${payload.formatMoney(financialSpend)}, but revenue-to-date is ${payload.formatMoney(0)}.`,
      recommendation: "Validate revenue tracking and attribution for this campaign before increasing spend.",
      category: "finance",
      dataBasis: "Revenue/spend to-date totals",
      confidence: "High",
    });
  }
  if (rollups.prior7.revenue > 0 && rollups.deltas.revenue7 <= -25) {
    items.push({
      severity: "high",
      title: "Revenue down vs prior 7 days",
      description: `Last 7d revenue ${payload.formatMoney(rollups.last7.revenue)} vs prior 7d ${payload.formatMoney(rollups.prior7.revenue)}.`,
      recommendation: "Check campaign mix, landing pages, and revenue tracking changes across the last week.",
      category: "trends",
      dataBasis: "GA4 completed daily history",
      confidence: "Medium",
    });
  }
  if (rollups.prior7.sessions > 0 && rollups.deltas.sessions7 <= -20) {
    items.push({
      severity: "medium",
      title: "Traffic drop detected",
      description: `Last 7d sessions ${payload.formatNumber(rollups.last7.sessions)} vs prior 7d ${payload.formatNumber(rollups.prior7.sessions)}.`,
      recommendation: "Review source and medium mix for the largest acquisition-channel changes.",
      category: "trends",
      dataBasis: "GA4 completed daily history",
      confidence: "Medium",
    });
  }
  if (rollups.prior7.conversions > 0 && rollups.deltas.conversions7 <= -20) {
    items.push({
      severity: "medium",
      title: "Conversions down vs prior 7 days",
      description: `Last 7d conversions ${payload.formatNumber(rollups.last7.conversions)} vs prior 7d ${payload.formatNumber(rollups.prior7.conversions)}.`,
      recommendation: "Review conversion-event firing, landing page changes, and traffic quality.",
      category: "trends",
      dataBasis: "GA4 completed daily history",
      confidence: "Medium",
    });
  }
  if (rollups.prior7.revenue > 0 && rollups.deltas.revenue7 >= 20) {
    items.push({
      severity: "positive",
      title: "Revenue momentum improving",
      description: `Last 7d revenue ${payload.formatMoney(rollups.last7.revenue)} vs prior 7d ${payload.formatMoney(rollups.prior7.revenue)}.`,
      recommendation: "Check which sources contributed to the improvement before considering careful scaling.",
      category: "trends",
      dataBasis: "GA4 completed daily history",
      confidence: "Medium",
    });
  }
  for (const benchmark of Array.isArray(payload.benchmarks) ? payload.benchmarks : []) {
    const sufficiency = resolveBenchmarkDataSufficiency({
      metric: benchmark?.metric,
      name: benchmark?.name,
      sessions: Number(payload.breakdownTotals?.sessions || 0),
      conversions: Number(payload.financialConversions || 0),
      spend: Number(payload.financialSpend || 0),
    });
    if (!sufficiency.sufficient) continue;
    const current = Number(benchmark?.currentValue);
    const target = Number(benchmark?.benchmarkValue);
    const identity = resolveGA4KpiMetricIdentity(benchmark?.metric, benchmark?.name);
    if (!Number.isFinite(current) || !Number.isFinite(target) || target <= 0) continue;
    if ((identity === "conversion_rate" || identity === "engagement_rate") && target > 100) continue;
    const threshold = computeBenchmarkThresholdResult({
      metric: benchmark?.metric,
      name: benchmark?.name,
      unit: benchmark?.unit,
      current,
      benchmarkValue: target,
    });
    if (threshold.status !== "behind" && threshold.status !== "needs_attention") continue;
    const unit = String(benchmark?.unit || "").trim();
    const formatValue = (value: number) =>
      unit === "%" ? `${Number(value).toFixed(2)}%`
        : unit === "$" || unit.toUpperCase() === String(payload.currency || "").toUpperCase() ? payload.formatMoney(value)
          : `${Number(value).toFixed(2)}${unit === "ratio" || unit === "x" ? "x" : unit ? ` ${unit}` : ""}`;
    items.push({
      severity: threshold.status === "behind" ? "high" : "medium",
      title: `${String(benchmark?.name || benchmark?.metric || "Benchmark")}: ${threshold.status === "behind" ? "Behind Benchmark" : "Needs Attention"}`,
      description: `Current ${formatValue(current)} vs Benchmark ${formatValue(target)}.`,
      recommendation: "Review the campaign inputs behind this Benchmark before changing budget, creative, or landing pages.",
      category: "targets",
      dataBasis: "Freshly recomputed saved Benchmark",
      confidence: "Medium",
    });
  }
  if (items.length === 0) {
    items.push({
      severity: "info",
      title: "No major anomalies detected",
      description: "Recent GA4 trends are stable relative to the prior comparison window.",
      recommendation: "Continue monitoring the main revenue, traffic, and conversion inputs for this campaign.",
      category: "context",
      dataBasis: "Current campaign data",
      confidence: "Medium",
    });
  }
  return items;
};

const buildInsightsActionDescription = (availableDays: number) => {
  const days = Math.max(0, Number(availableDays || 0));
  const dayLabel = `${days} completed GA4 day${days === 1 ? "" : "s"}`;
  if (days < 6) {
    return `Only ${dayLabel} available. Trend and anomaly checks need at least 6 days; setup and KPI/Benchmark checks still run.`;
  }
  if (days < 14) {
    return `${dayLabel} available. Short-window trend checks are active; full 7-day vs prior 7-day analysis starts after 14 days.`;
  }
  return `${dayLabel} available. We compare the last 7 days vs the previous 7 days and cross-check KPI/Benchmark performance.`;
};

async function buildGA4ReportPayload(report: any) {
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) throw new Error("GA4_REPORT_CAMPAIGN_REQUIRED");
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  const connection = await choosePrimaryConnection(campaignId);
  const propertyId = String(connection.propertyId);
  const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
  const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase();
  const lookbackDays = [30, 60, 90].includes(Number(connection?.lookbackDays)) ? Number(connection.lookbackDays) : 90;
  const configuredImportStartDate = String((connection as any)?.importStartDate || "").trim();
  if (!configuredImportStartDate && lookbackDays !== 30) {
    throw new Error("GA4_REPORT_CUMULATIVE_WINDOW_UNAVAILABLE");
  }
  const reportImportStartDate = configuredImportStartDate || GA4_OVERVIEW_LEGACY_IMPORT_START_DATE;
  const reportCumulativeWindow = resolveGA4ImportToDateWindow(
    reportImportStartDate,
    (campaign as any)?.reportingTimeZone,
  );
  if (!reportCumulativeWindow) throw new Error("GA4_REPORT_CUMULATIVE_WINDOW_UNAVAILABLE");
  const reportLookbackRange = `${lookbackDays}daysAgo`;
  const adComparisonRequirements = getAdComparisonReportRequirements(report);
  const adComparisonWindow = adComparisonRequirements.included
    ? reportCumulativeWindow
    : null;
  if (adComparisonRequirements.included && !adComparisonWindow) {
    throw new Error('GA4_AD_COMPARISON_IMPORT_WINDOW_UNAVAILABLE');
  }
  const acquisitionRange = adComparisonRequirements.included
    ? '30daysAgo'
    : reportLookbackRange;
  const reportingWindow = getReportingDateWindow(lookbackDays, (campaign as any)?.reportingTimeZone);
  const financialStartDate = toISODateUTC((campaign as any)?.startDate)
    || toISODateUTC((campaign as any)?.createdAt)
    || "2000-01-01";
  const financialEndDate = reportCumulativeWindow.endDate;
  const spendSourceStartDate = "1900-01-01";
  const importedRevenueStartDate = "1900-01-01";
  const importedRevenueEndDate = new Date().toISOString().slice(0, 10);
  const dailyStart = reportingWindow.startDate;
  const dailyEnd = reportingWindow.endDate;
  const overviewStartDate = reportCumulativeWindow.startDate;
  const failedParts = new Set<string>();
  const logPartFailure = (label: string, error: any) => {
    failedParts.add(label);
    console.warn(`[GA4 Scheduled PDF] ${label} failed; checking persisted fallback:`, error?.message || error);
  };
  const benchmarkStorage = storage as typeof storage & {
    getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<any[]>;
  };
  const loadPlatformKPIs = reportIncludesKPISection(report)
    ? storage.getPlatformKPIs("google_analytics", campaignId)
    : storage.getPlatformKPIs("google_analytics", campaignId).catch(() => [] as any[]);
  const loadPlatformBenchmarks = reportIncludesBenchmarkSection(report)
    ? benchmarkStorage.getPlatformBenchmarks("google_analytics", campaignId)
    : benchmarkStorage.getPlatformBenchmarks("google_analytics", campaignId).catch(() => [] as any[]);

  const [metrics, breakdown, adComparisonBreakdown, landingPages, conversionEvents, timeSeries, revenueSources, spendSources, revenueBreakdown, adComparisonRevenueBreakdown, spendBreakdown, platformKPIs, benchmarks] = await Promise.all([
    ga4Service.getMetricsWithAutoRefresh(campaignId, storage, reportLookbackRange, propertyId, campaignFilter).catch((e) => { logPartFailure("metrics", e); return {} as any; }),
    ga4Service.getAcquisitionBreakdown(campaignId, storage, acquisitionRange, propertyId, 2000, campaignFilter).catch((e) => { logPartFailure("acquisition breakdown", e); return { rows: [] }; }),
    adComparisonRequirements.included && adComparisonWindow
      ? ga4Service.getAcquisitionBreakdown(campaignId, storage, adComparisonWindow.startDate, propertyId, 2000, campaignFilter, adComparisonWindow.endDate)
          .catch((e) => { logPartFailure("ad comparison breakdown", e); return { rows: [] }; })
      : Promise.resolve({ rows: [] }),
    ga4Service.getLandingPagesReport(campaignId, storage, dailyStart, propertyId, 50, campaignFilter).catch((e) => { logPartFailure("landing pages", e); return { rows: [] }; }),
    ga4Service.getConversionEventsReport(campaignId, storage, dailyStart, propertyId, 50, campaignFilter).catch((e) => { logPartFailure("conversion events", e); return { rows: [] }; }),
    ga4Service.getTimeSeriesData(campaignId, storage, dailyStart, propertyId, campaignFilter).catch((e) => { logPartFailure("time series", e); return []; }),
    storage.getRevenueSources(campaignId, "ga4").catch((e) => { logPartFailure("revenue sources", e); return [] as any[]; }),
    storage.getSpendSources(campaignId, "ga4").catch((e) => { logPartFailure("spend sources", e); return [] as any[]; }),
    storage.getRevenueBreakdownBySource(campaignId, importedRevenueStartDate, importedRevenueEndDate, "ga4").catch((e) => { logPartFailure("revenue breakdown", e); return [] as any[]; }),
    adComparisonRequirements.revenueBreakdown && adComparisonWindow
      ? storage.getRevenueBreakdownBySource(campaignId, importedRevenueStartDate, adComparisonWindow.endDate, "ga4")
          .catch((e) => { logPartFailure("ad comparison revenue breakdown", e); return [] as any[]; })
      : Promise.resolve([] as any[]),
    storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, financialEndDate, "ga4").catch((e) => { logPartFailure("spend breakdown", e); return [] as any[]; }),
    loadPlatformKPIs,
    loadPlatformBenchmarks,
  ]);

  const ga4ToDate = await withTokenRefresh(connection, async (token) => {
    return await ga4Service.getTotalsWithRevenue(propertyId, token, financialStartDate, financialEndDate, campaignFilter, campaignCurrency);
  }).catch((e) => {
    logPartFailure("totals with revenue", e);
    return { totals: {} };
  });

  let dailyRows = await storage.getGA4DailyMetrics(campaignId, propertyId, dailyStart, dailyEnd).catch((e) => {
    logPartFailure("persisted daily metrics", e);
    return [] as any[];
  });
  if (!dailyRows || dailyRows.length === 0) {
    dailyRows = (Array.isArray(timeSeries) ? timeSeries : []).map((row: any) => ({
      ...row,
      date: String(row?.date || ""),
      sessions: Number(row?.sessions || 0),
      users: Number(row?.users || 0),
      conversions: Number(row?.conversions || 0),
      revenue: Number(row?.revenue || 0),
      engagedSessions: Number(row?.engagedSessions || 0),
      pageviews: Number(row?.pageviews || 0),
      engagementRate: Number(row?.engagementRate || 0),
    }));
  }
  let overviewDailyRows = await storage.getGA4DailyMetrics(campaignId, propertyId, overviewStartDate, dailyEnd).catch((e) => {
    logPartFailure('persisted Overview Summary metrics', e);
    return [] as any[];
  });
  if (overviewDailyRows.length === 0 && overviewStartDate === dailyStart) {
    overviewDailyRows = dailyRows;
  }
  const overviewRequirements = getOverviewReportRequirements(report);
  const activeRevenueSources = revenueSources.filter((source: any) => source?.isActive !== false);
  const hasMaterializedRevenue = (row: any) => row?.revenue != null && Number.isFinite(Number(row.revenue));
  const revenueBreakdownSourceIds = new Set(revenueBreakdown.filter(hasMaterializedRevenue).map((row: any) => String(row?.sourceId || "")));
  const adComparisonRevenueBreakdownSourceIds = new Set(adComparisonRevenueBreakdown.filter(hasMaterializedRevenue).map((row: any) => String(row?.sourceId || "")));
  const overviewMaterializedRevenueUnavailable = activeRevenueSources.some(
    (source: any) => !revenueBreakdownSourceIds.has(String(source?.id || "")),
  );
  const adComparisonMaterializedRevenueUnavailable = activeRevenueSources.some(
    (source: any) => !adComparisonRevenueBreakdownSourceIds.has(String(source?.id || "")),
  );
  const hasImportedRevenueSource = revenueSources.some((source: any) => source?.isActive !== false) || revenueBreakdown.length > 0;
  const unavailableOverviewParts: string[] = [];
  if (overviewRequirements.revenue && overviewMaterializedRevenueUnavailable) {
    unavailableOverviewParts.push("Revenue");
  }
  if (overviewRequirements.summary && overviewDailyRows.length === 0 && (overviewStartDate < dailyStart || failedParts.has("time series"))) {
    unavailableOverviewParts.push("Summary");
  }
  if (overviewRequirements.revenue) {
    const nativeRevenueUnavailable = hasImportedRevenueSource
      ? failedParts.has("totals with revenue")
      : failedParts.has("totals with revenue") && dailyRows.length === 0 && failedParts.has("acquisition breakdown");
    if (nativeRevenueUnavailable || failedParts.has("revenue sources") || failedParts.has("revenue breakdown")) {
      unavailableOverviewParts.push("Revenue");
    }
  }
  if (overviewRequirements.spend && (failedParts.has("spend sources") || failedParts.has("spend breakdown"))) {
    unavailableOverviewParts.push("Spend");
  }
  if (overviewRequirements.campaignBreakdown && failedParts.has("acquisition breakdown")) {
    unavailableOverviewParts.push("Campaign Breakdown");
  }
  if (overviewRequirements.landingPages && failedParts.has("landing pages")) {
    unavailableOverviewParts.push("Landing Pages");
  }
  if (overviewRequirements.conversionEvents && failedParts.has("conversion events")) {
    unavailableOverviewParts.push("Conversion Events");
  }
  if (unavailableOverviewParts.length > 0) {
    throw new Error(`GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: ${Array.from(new Set(unavailableOverviewParts)).join(", ")}`);
  }
  const unavailableAdComparisonParts: string[] = [];
  if (adComparisonRequirements.revenueBreakdown && adComparisonMaterializedRevenueUnavailable) {
    unavailableAdComparisonParts.push('Imported revenue provenance');
  }
  if (
    adComparisonRequirements.included &&
    failedParts.has('ad comparison breakdown')
  ) {
    unavailableAdComparisonParts.push('Campaign breakdown');
  }
  if (
    adComparisonRequirements.revenueBreakdown &&
    (failedParts.has('revenue sources') || failedParts.has('ad comparison revenue breakdown'))
  ) {
    unavailableAdComparisonParts.push('Imported revenue provenance');
  }
  if (unavailableAdComparisonParts.length > 0) {
    throw new Error(
      'GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: '
      + Array.from(new Set(unavailableAdComparisonParts)).join(', '),
    );
  }
  const lastDailyRefreshAt = dailyRows.length > 0
    ? dailyRows.reduce((latest: string | null, row: any) => {
        const ts = row?.updatedAt ? new Date(row.updatedAt).toISOString() : null;
        if (!ts) return latest;
        return !latest || ts > latest ? ts : latest;
      }, null)
    : null;

  const dailySummedTotals = dailyRows.reduce((acc: any, row: any) => {
    acc.sessions += Number(row?.sessions || 0);
    acc.users += Number(row?.users || 0);
    acc.conversions += Number(row?.conversions || 0);
    acc.revenue += Number(row?.revenue || 0);
    acc.engagedSessions += Number(row?.engagedSessions || 0);
    acc.pageviews += Number(row?.pageviews || 0);
    return acc;
  }, { sessions: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0, pageviews: 0 });
  dailySummedTotals.revenue = Number(dailySummedTotals.revenue.toFixed(2));
  dailySummedTotals.engagementRate = dailySummedTotals.sessions > 0 ? dailySummedTotals.engagedSessions / dailySummedTotals.sessions : 0;
  const overviewSummedTotals = summarizeGA4TrafficRows(overviewDailyRows);

  const breakdownFinancialRows = Array.isArray((breakdown as any)?.rows) ? (breakdown as any).rows : [];
  const breakdownFinancialSummed = breakdownFinancialRows.reduce(
    (acc: { sessions: number; users: number; conversions: number; revenue: number; engagedSessions: number }, row: any) => ({
      sessions: acc.sessions + (Number(row?.sessions || 0) || 0),
      users: acc.users + (Number(row?.users || 0) || 0),
      conversions: acc.conversions + (Number(row?.conversions || 0) || 0),
      revenue: acc.revenue + (Number(row?.revenue || 0) || 0),
      engagedSessions: acc.engagedSessions + (Number(row?.engagedSessions || 0) || 0),
    }),
    { sessions: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0 }
  );
  const breakdownSessions = Number((breakdown as any)?.totals?.sessions ?? (breakdown as any)?.totals?.sessionsRaw);
  const breakdownEngagedSessions = Number((breakdown as any)?.totals?.engagedSessions);
  const breakdownFinancialTotals = {
    sessions: Number.isFinite(breakdownSessions) ? breakdownSessions : breakdownFinancialSummed.sessions,
    users: Number.isFinite(Number((breakdown as any)?.totals?.users)) ? Number((breakdown as any).totals.users) : breakdownFinancialSummed.users,
    conversions: Number.isFinite(Number((breakdown as any)?.totals?.conversions)) ? Number((breakdown as any).totals.conversions) : breakdownFinancialSummed.conversions,
    revenue: Number((Number.isFinite(Number((breakdown as any)?.totals?.revenue)) ? Number((breakdown as any).totals.revenue) : breakdownFinancialSummed.revenue).toFixed(2)),
    engagedSessions: Number.isFinite(breakdownEngagedSessions) ? breakdownEngagedSessions : breakdownFinancialSummed.engagedSessions,
  };
  const hasBreakdownOverviewTotals = Boolean((breakdown as any)?.totals) || breakdownFinancialRows.length > 0;
  const breakdownEngagementRate = breakdownFinancialTotals.sessions > 0
    ? breakdownFinancialTotals.engagedSessions / breakdownFinancialTotals.sessions
    : 0;
  const hasDailyOverviewResponse = overviewDailyRows.length > 0
    || (overviewStartDate === dailyStart && !failedParts.has("time series"));
  const overviewTotalsSource = hasDailyOverviewResponse ? overviewSummedTotals : null;
  const breakdownTotals = {
    sessions: Number(overviewTotalsSource?.sessions || 0),
    conversions: Number(overviewTotalsSource?.conversions || 0),
    revenue: Number(overviewTotalsSource?.revenue || 0),
    users: Number(overviewTotalsSource?.users || 0),
    engagementRate: Number(overviewTotalsSource?.engagementRate || 0),
  };
  const ga4ToDateFinancialTotals = {
    sessions: Number((ga4ToDate as any)?.totals?.sessions || 0),
    users: Number((ga4ToDate as any)?.totals?.users || 0),
    conversions: Number((ga4ToDate as any)?.totals?.conversions || 0),
    revenue: Number((ga4ToDate as any)?.totals?.revenue || 0),
  };
  const ga4FinancialCandidates = hasImportedRevenueSource
    ? [(ga4ToDate as any)?.totals]
    : [(ga4ToDate as any)?.totals, dailyRows.length > 0 ? dailySummedTotals : null, hasBreakdownOverviewTotals ? breakdownFinancialTotals : null];
  const ga4FinancialTotalsSource = selectGA4FinancialTotalsSource(ga4FinancialCandidates, ga4ToDateFinancialTotals);
  const importedRevenueForFinancials = Number(revenueBreakdown.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0).toFixed(2));
  const ga4RevenueForFinancials = Number(ga4FinancialTotalsSource.revenue || 0);
  const financialRevenue = Number((ga4RevenueForFinancials + importedRevenueForFinancials).toFixed(2));
  const financialConversions = Number(ga4FinancialTotalsSource.conversions || 0);
  const financialSpend = Number(spendBreakdown.reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0).toFixed(2));
  const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;
  const financialROI = computeRoiPercent(financialRevenue, financialSpend);
  const financialCPA = computeCpa(financialSpend, financialConversions);

  const revenueDisplaySources = revenueBreakdown.length > 0
    ? revenueBreakdown.map((row: any) => ({
        ...row,
        mappingConfig: revenueSources.find((source: any) => String(source?.id) === String(row?.sourceId))?.mappingConfig || null,
      }))
    : revenueSources.filter((source: any) => source?.isActive !== false).map((source: any) => ({
        sourceId: source.id,
        sourceType: source.sourceType,
        displayName: source.displayName,
        revenue: null,
        mappingConfig: source.mappingConfig,
      }));
  const adComparisonRevenueDisplaySources = adComparisonRequirements.revenueBreakdown
    ? (adComparisonRevenueBreakdown.length > 0
        ? adComparisonRevenueBreakdown.map((row: any) => ({
            ...row,
            mappingConfig: revenueSources.find((source: any) => String(source?.id) === String(row?.sourceId))?.mappingConfig || null,
          }))
        : revenueSources.filter((source: any) => source?.isActive !== false).map((source: any) => ({
            sourceId: source.id,
            sourceType: source.sourceType,
            displayName: source.displayName,
            revenue: null,
            mappingConfig: source.mappingConfig,
          })))
    : [];

  const spendDisplaySources = spendBreakdown.length > 0
    ? spendBreakdown.map((row: any) => ({
        ...row,
        mappingConfig: spendSources.find((source: any) => String(source?.id) === String(row?.sourceId))?.mappingConfig || null,
      }))
    : spendSources.filter((source: any) => source?.isActive !== false).map((source: any) => ({
        sourceId: source.id,
        sourceType: source.sourceType,
        displayName: source.displayName,
        spend: null,
        mappingConfig: source.mappingConfig,
      }));
  const spendSourceLabels = spendDisplaySources.map((source: any) => String(source?.displayName || source?.sourceType || "").trim()).filter(Boolean);
  const revenueSourceLabels: string[] = [];
  const ga4HasRevenueMetric = Boolean(String((ga4ToDate as any)?.revenueMetric || "").trim()) || ga4RevenueForFinancials !== 0;
  if (ga4HasRevenueMetric) revenueSourceLabels.push("GA4 native revenue");
  for (const source of revenueDisplaySources) {
    const label = String(source?.displayName || source?.sourceType || "Revenue").trim();
    if (label && !revenueSourceLabels.includes(label)) revenueSourceLabels.push(label);
  }
  const executiveFinancialsDescription = buildExecutiveFinancialsDescription(spendSourceLabels, revenueSourceLabels);

  const importedCampaignNames = new Set<string>();
  const rawFilter = (campaign as any)?.ga4CampaignFilter;
  const filterValues = rawFilter === null || rawFilter === undefined
    ? []
    : (() => {
        const s = String(rawFilter || "").trim();
        if (!s) return [] as string[];
        if (s.startsWith("[") && s.endsWith("]")) {
          try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parsed.map((value) => String(value || "").trim()).filter(Boolean);
          } catch {}
        }
        return [s];
      })();
  for (const value of filterValues) {
    const key = normalizeCampaignKey(value);
    if (key) importedCampaignNames.add(key);
  }

  const byCampaign = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number }>();
  for (const row of Array.isArray((breakdown as any)?.rows) ? (breakdown as any).rows : []) {
    const name = String((row as any)?.campaign || "(not set)").trim();
    const current = byCampaign.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
    current.sessions += Number((row as any)?.sessions || 0);
    current.users += Number((row as any)?.users || 0);
    current.conversions += Number((row as any)?.conversions || 0);
    current.revenue += Number((row as any)?.revenue || 0);
    byCampaign.set(name, current);
  }
  const filteredCampaignRows = Array.from(byCampaign.values())
    .filter((row) => importedCampaignNames.size === 0 || importedCampaignNames.has(normalizeCampaignKey(row.name)));
  const campaignBreakdownAgg = filteredCampaignRows
    .map((row) => {
      const revenue = Number(Number(row.revenue || 0).toFixed(2));
      const sessions = Number(row.sessions || 0);
      const conversions = Number(row.conversions || 0);
      return {
        ...row,
        revenue,
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        revenuePerSession: sessions > 0 ? revenue / sessions : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const adComparisonByCampaign = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number }>();
  for (const row of Array.isArray((adComparisonBreakdown as any)?.rows) ? (adComparisonBreakdown as any).rows : []) {
    const name = String((row as any)?.campaign || "(not set)").trim();
    const current = adComparisonByCampaign.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
    current.sessions += Number((row as any)?.sessions || 0);
    current.users += Number((row as any)?.users || 0);
    current.conversions += Number((row as any)?.conversions || 0);
    current.revenue += Number((row as any)?.revenue || 0);
    adComparisonByCampaign.set(name, current);
  }
  const adComparisonBreakdownAgg = Array.from(adComparisonByCampaign.values())
    .filter((row) => importedCampaignNames.size === 0 || importedCampaignNames.has(normalizeCampaignKey(row.name)))
    .map((row) => {
      const revenue = Number(Number(row.revenue || 0).toFixed(2));
      const sessions = Number(row.sessions || 0);
      const conversions = Number(row.conversions || 0);
      return {
        ...row,
        revenue,
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        revenuePerSession: sessions > 0 ? revenue / sessions : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const rowCounts = new Map<string, number>();
  const rowNameByKey = new Map<string, string>();
  for (const row of campaignBreakdownAgg) {
    const key = normalizeCampaignKey(row.name);
    if (!key) continue;
    rowCounts.set(key, (rowCounts.get(key) || 0) + 1);
    if (!rowNameByKey.has(key)) rowNameByKey.set(key, row.name);
  }
  const campaignBreakdownMatchedExternalRevenue = new Map<string, number>();
  for (const source of revenueDisplaySources) {
    const cfg = parseMappingConfig((source as any)?.mappingConfig);
    const totals = Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
    const mappings = Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [];
    const mappedCampaignByValue = new Map<string, string>();
    for (const mapping of mappings) {
      const valueKey = normalizeCampaignKey(mapping?.crmValue);
      const mappedName = String(mapping?.linkedinCampaignName || mapping?.linkedinCampaignUrn || "").trim();
      if (valueKey && mappedName) mappedCampaignByValue.set(valueKey, mappedName);
    }
    for (const item of totals) {
      const valueKey = normalizeCampaignKey(item?.campaignValue);
      const key = normalizeCampaignKey(mappedCampaignByValue.get(valueKey) || item?.campaignValue);
      const revenue = Number(item?.revenue || 0);
      if (rowCounts.get(key) !== 1) continue;
      const rowName = rowNameByKey.get(key);
      if (rowName && revenue > 0) campaignBreakdownMatchedExternalRevenue.set(rowName, (campaignBreakdownMatchedExternalRevenue.get(rowName) || 0) + revenue);
    }
  }

  const sourceRevenueBreakdowns = new Map<string, any[]>(
    revenueDisplaySources.map((source: any) => {
      const cfg = parseMappingConfig(source?.mappingConfig);
      const totals = Array.isArray(cfg?.campaignValueRevenueTotals)
        ? cfg.campaignValueRevenueTotals.filter(
            (item: any) => item?.revenue != null && Number.isFinite(Number(item.revenue)),
          )
        : [];
      return [String(source?.sourceId || ""), totals];
    })
  );
  const adComparisonSourceRevenueBreakdowns = new Map<string, any[]>(
    adComparisonRevenueDisplaySources.map((source: any) => {
      const cfg = parseMappingConfig(source?.mappingConfig);
      const totals = Array.isArray(cfg?.campaignValueRevenueTotals)
        ? cfg.campaignValueRevenueTotals.filter(
            (item: any) => item?.revenue != null && Number.isFinite(Number(item.revenue)),
          )
        : [];
      return [String(source?.sourceId || ""), totals];
    })
  );
  const insightsRollups = buildTrendRollups(dailyRows);
  const currency = String((campaign as any)?.currency || "USD");
  const formatMoney = (value: number) => `${currency} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatNumber = (value: number) => `${Math.round(Number(value || 0)).toLocaleString()}`;

  const payload = {
    campaign,
    connection,
    currency,
    metrics,
    breakdown,
    landingPages,
    conversionEvents,
    dailyRows,
    breakdownTotals,
    revenueDisplaySources,
    adComparisonRevenueDisplaySources,
    spendDisplaySources,
    platformKPIs: Array.isArray(platformKPIs) ? platformKPIs : [],
    benchmarks: Array.isArray(benchmarks) ? benchmarks : [],
    financialRevenue,
    financialSpend,
    financialROAS,
    financialROI,
    financialCPA,
    financialConversions,
    ga4RevenueForFinancials,
    ga4HasRevenueMetric,
    importedRevenueForFinancials,
    executiveFinancialsDescription,
    campaignBreakdownAgg,
    adComparisonBreakdownAgg,
    adComparisonWindow,
    campaignBreakdownMatchedExternalRevenue,
    sourceRevenueBreakdowns,
    adComparisonSourceRevenueBreakdowns,
    insightsRollups,
    insightsFreshness: {
      dataThroughDate: reportingWindow.dataThroughDate,
      reportingTimeZone: reportingWindow.reportingTimeZone,
      lastRefreshedAt: lastDailyRefreshAt,
    },
    reportCumulativeWindow,
    formatMoney,
    formatNumber,
  };
  return {
    ...payload,
    insightsItems: buildInsightsItems(payload),
  };
}

export async function buildGA4ScheduledPdfAttachment(_args: {
  report: any;
  reportName?: string;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
}): Promise<Buffer | null> {
  const { report, reportName, campaignName } = _args;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const payload = await buildGA4ReportPayload(report);
  const lookbackDays = [30, 60, 90].includes(Number(payload.connection?.lookbackDays))
    ? Number(payload.connection.lookbackDays)
    : 90;
  const reportType = String(report?.reportType || "overview").toLowerCase();
  const rawCfg = parseReportConfiguration(report?.configuration);
  const cfg = normalizeCustomReportConfig(rawCfg);
  const sections = reportType === "custom"
    ? cfg.sections
    : { overview: reportType === "overview", kpis: reportType === "kpis", benchmarks: reportType === "benchmarks", ads: reportType === "ads", insights: reportType === "insights" };
  const selectedCustomKpiIds = reportType === "custom" ? new Set(cfg.selectedKpiIds || []) : null;
  const selectedCustomBenchmarkIds = reportType === "custom" ? new Set(cfg.selectedBenchmarkIds || []) : null;
  const PW = 210, MX = 16, CW = PW - MX * 2;
  let y = 18;

  const checkPage = (need: number) => {
    if (y + need > 274) {
      addFooter();
      doc.addPage();
      y = 18;
    }
  };
  const addFooter = () => {
    doc.setDrawColor(...COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(MX, 282, PW - MX, 282);
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textTert);
    doc.text("MimoSaaS Analytics", MX, 287);
    doc.text(new Date().toLocaleDateString(), PW - MX, 287, { align: "right" });
  };
  const sectionTitle = (title: string, color: C3, keepWithNext = 0) => {
    checkPage(18 + keepWithNext);
    doc.setFillColor(...color);
    doc.roundedRect(MX, y, 3, 12, 1, 1, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, MX + 8, y + 9);
    y += 18;
  };
  const subheading = (title: string, keepWithNext = 18) => {
    checkPage(10 + keepWithNext);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, MX, y + 5);
    y += 10;
  };
  const metricCards = (items: [string, string][], cols: number, cellH = 24) => {
    const width = (CW - (cols - 1) * 4) / cols;
    for (let i = 0; i < items.length; i += cols) {
      checkPage(cellH + 4);
      for (let c = 0; c < cols && i + c < items.length; c++) {
        const [lbl, val] = items[i + c];
        const cx = MX + c * (width + 4);
        doc.setFillColor(...COLORS.white);
        doc.setDrawColor(...COLORS.cardBorder);
        doc.roundedRect(cx, y, width, cellH, 3, 3, "FD");
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textTert);
        doc.text(lbl.toUpperCase(), cx + 6, y + 8);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.text);
        doc.text(val, cx + 6, y + 18);
      }
      y += cellH + 4;
    }
  };
  const addSimpleTable = (title: string, headers: string[], rows: string[][], widths: number[], color: C3 = COLORS.overview, note?: string) => {
    if (rows.length === 0) return;
    const fullHeight = 18 + (note ? 6 : 0) + 10 + rows.length * 8 + 4;
    if (fullHeight <= 250 && y + fullHeight > 274) {
      addFooter();
      doc.addPage();
      y = 18;
    }
    sectionTitle(title, color);
    if (note) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textSec);
      doc.text(note, MX, y + 2);
      y += 6;
    }
    doc.setFillColor(...COLORS.cardBg);
    doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.textTert);
    let x = MX + 4;
    headers.forEach((header, idx) => {
      doc.text(header, x, y + 5.5, idx === 0 ? undefined : { align: "right" });
      x += widths[idx];
    });
    y += 10;
    rows.forEach((row) => {
      checkPage(9);
      doc.setDrawColor(...COLORS.divider);
      doc.setLineWidth(0.2);
      doc.line(MX, y - 1.5, MX + CW, y - 1.5);
      let colX = MX + 4;
      row.forEach((cell, idx) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.text);
        const safeValue = idx === 0 && cell.length > 32 ? `${cell.slice(0, 31)}…` : cell;
        doc.text(safeValue, colX, y + 3.5, idx === 0 ? undefined : { align: "right" });
        colX += widths[idx];
      });
      y += 8;
    });
    y += 4;
  };
  const drawTrendChart = (title: string, rows: Array<{ label: string; value: number }>) => {
    if (rows.length < 2) return;
    sectionTitle(title, COLORS.insights, 50);
    checkPage(58);
    const chartY = y;
    const width = CW;
    const height = 40;
    doc.setFillColor(...COLORS.white);
    doc.setDrawColor(...COLORS.cardBorder);
    doc.roundedRect(MX, chartY, width, height, 3, 3, "FD");
    const values = rows.map((row) => Number(row.value || 0));
    const max = Math.max(...values, 1);
    const roughTick = max / 4;
    const yTickStep = roughTick >= 10 ? Math.ceil(roughTick / 10) * 10 : roughTick >= 1 ? Math.ceil(roughTick) : Math.max(0.1, Math.ceil(roughTick * 10) / 10);
    const yAxisMax = yTickStep * 4;
    const innerX = MX + 14;
    const innerY = chartY + 6;
    const innerW = width - 22;
    const innerH = height - 14;
    const yFor = (value: number) => innerY + innerH - (Number(value || 0) / yAxisMax) * innerH;
    const xFor = (idx: number) => innerX + (idx * innerW) / Math.max(rows.length - 1, 1);
    doc.setLineWidth(0.2);
    for (let tick = 0; tick <= 4; tick++) {
      const tickValue = tick * yTickStep;
      const py = yFor(tickValue);
      doc.setDrawColor(241, 245, 249);
      doc.line(innerX, py, innerX + innerW, py);
      doc.setFontSize(5.8);
      doc.setTextColor(...COLORS.textTert);
      doc.text(formatNumber(tickValue), innerX - 2, py + 1.4, { align: "right" });
    }
    doc.setDrawColor(100, 116, 139);
    doc.line(innerX, innerY + innerH, innerX + innerW, innerY + innerH);
    doc.line(innerX, innerY, innerX, innerY + innerH);
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.8);
    rows.forEach((row, idx) => {
      const px = xFor(idx);
      const py = yFor(Number(row.value || 0));
      if (idx > 0) {
        const prev = rows[idx - 1];
        doc.line(xFor(idx - 1), yFor(Number(prev.value || 0)), px, py);
      }
    });
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.textTert);
    doc.text(rows[0].label, innerX, chartY + height - 2);
    doc.text(rows[rows.length - 1].label, innerX + innerW, chartY + height - 2, { align: "right" });
    y += height + 6;
  };
  const formatMoney = payload.formatMoney;
  const formatNumber = payload.formatNumber;

  doc.setFillColor(...COLORS.overview);
  doc.rect(0, 0, PW, 4, "F");
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(String(reportName || report?.name || "GA4 Report").slice(0, 45), MX, 22);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textSec);
  doc.text("GA4 Analytics Report", MX, 30);
  y = 38;
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(MX, y, CW, 22, 3, 3, "F");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textSec);
  doc.text(`Campaign: ${String(campaignName || (payload.campaign as any)?.name || "—")}`, MX + 6, y + 7);
  const standaloneAdComparison = reportType === "ads";
  if (standaloneAdComparison) {
    doc.text(`Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, MX + CW / 2, y + 7);
    const propertyIdLabel = String(payload.connection?.propertyId || "").replace(/^properties\//, "");
    const propertyNameLabel = String(payload.connection?.displayName || payload.connection?.propertyName || "");
    doc.text(`Property: ${propertyNameLabel}${propertyIdLabel ? ` (${propertyIdLabel})` : ""}`, MX + 6, y + 15);
    const campaignFilterLabel = String((payload.campaign as any)?.ga4CampaignFilter || "").trim();
    if (campaignFilterLabel) doc.text(`Filter: ${campaignFilterLabel}`, MX + CW / 2, y + 15);
  } else {
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, MX + CW / 2, y + 7);
    doc.text(`Property: ${String(payload.connection?.displayName || payload.connection?.propertyName || payload.connection?.propertyId || "")}`, MX + 6, y + 15);
    doc.text(`Completed data through: ${payload.reportCumulativeWindow.endDate} (${formatReportingTimeZoneLabel(payload.reportCumulativeWindow.reportingTimeZone)})`, MX + CW / 2, y + 15);
  }
  y += 30;

  if (sections.overview) {
    const s = cfg.subsections?.overview || {};
    const includeSummary = reportType !== "custom" || s.summary === true;
    const includeRevenue = reportType !== "custom" || s.revenue === true;
    const includeSpend = reportType !== "custom" || s.spend === true;
    const includePerformance = reportType !== "custom" || s.performance === true;
    const includeCampaignBreakdown = reportType !== "custom" || s.campaignBreakdown === true;
    const includeLandingPages = reportType !== "custom" || s.landingPages === true;
    const includeConversionEvents = reportType !== "custom" || s.conversionEvents === true;
    sectionTitle("Performance Overview", COLORS.overview, 24);
    if (includeSummary) {
      subheading("Summary");
      metricCards([
        ["Sessions", formatNumber(payload.breakdownTotals.sessions)],
        ["Users", formatNumber(payload.breakdownTotals.users)],
        ["Conversions", formatNumber(payload.breakdownTotals.conversions)],
        ["Engagement Rate", formatPct(normalizeRateToPercent(payload.breakdownTotals.engagementRate))],
        ["Conv. Rate", formatPct(payload.breakdownTotals.sessions > 0 ? (payload.breakdownTotals.conversions / payload.breakdownTotals.sessions) * 100 : 0)],
      ], 3);
    }
    if (includeRevenue || includeSpend || includePerformance) subheading("Revenue & Financial", 10);
    if (includeRevenue) {
      subheading("Revenue");
      const revenueCards: [string, string][] = [
        ["Total Revenue", formatMoney(payload.financialRevenue)],
      ];
      metricCards(revenueCards, Math.min(revenueCards.length, 3));
      addSimpleTable(
        "Revenue Sources",
        ["SOURCE", "AMOUNT"],
        [
          ...(payload.ga4HasRevenueMetric ? [["GA4 Revenue", formatMoney(payload.ga4RevenueForFinancials)]] : []),
          ...payload.revenueDisplaySources.map((source: any) => [String(source?.displayName || source?.sourceType || "Revenue"), formatMoney(Number(source?.revenue))]),
        ],
        [120, 64],
        COLORS.overview
      );
    }
    if (includeSpend) {
      subheading("Spend");
      metricCards([
        ["Total Spend", formatMoney(payload.financialSpend)],
      ], 1);
    }
    if (includePerformance) {
      subheading("Performance");
      metricCards([
        ["Profit", formatMoney(payload.financialRevenue - payload.financialSpend)],
        ["ROAS", `${Number(payload.financialROAS || 0).toFixed(2)}x`],
        ["ROI", formatPct(payload.financialROI)],
        ["CPA", payload.financialConversions > 0 ? formatMoney(payload.financialCPA) : "—"],
      ], 4);
    }
    if (includeCampaignBreakdown) {
      addSimpleTable(
        "Campaign Breakdown",
        ["CAMPAIGN", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE", "REVENUE"],
        payload.campaignBreakdownAgg.slice(0, 15).map((row: any) => [
          String(row?.name || "(not set)"),
          formatNumber(row?.sessions || 0),
          formatNumber(row?.users || 0),
          formatNumber(row?.conversions || 0),
          formatPct(Number(row?.conversionRate || 0)),
          formatMoney(Number((Number(row?.revenue || 0) + Number(payload.campaignBreakdownMatchedExternalRevenue.get(String(row?.name || "")) || 0)).toFixed(2))),
        ]),
        [52, 22, 20, 28, 26, 36],
        COLORS.overview,
        `GA4 metrics: last ${lookbackDays} completed days; Revenue includes exact campaign-matched source-to-date imports.`,
      );
    }
    if (includeLandingPages) {
      addSimpleTable(
        "Landing Pages",
        ["LANDING PAGE", "SOURCE/MEDIUM", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE"],
        (payload.landingPages?.rows || []).slice(0, 15).map((row: any) => [
          String(row?.landingPage || "(not set)"),
          `${String(row?.source || "(not set)")}/${String(row?.medium || "(not set)")}`,
          formatNumber(row?.sessions || 0),
          formatNumber(row?.users || 0),
          formatNumber(row?.conversions || 0),
          formatPct(Number(row?.sessions || 0) > 0 ? (Number(row?.conversions || 0) / Number(row?.sessions || 0)) * 100 : 0),
        ]),
        [52, 44, 22, 20, 28, 26],
        COLORS.overview
      );
    }
    if (includeConversionEvents) {
      addSimpleTable(
        "Conversion Events",
        ["EVENT", "CONVERSIONS", "EVENT COUNT", "USERS"],
        (payload.conversionEvents?.rows || []).slice(0, 15).map((row: any) => [
          String(row?.eventName || "(not set)"),
          formatNumber(row?.conversions || 0),
          formatNumber(row?.eventCount || 0),
          formatNumber(row?.users || 0),
        ]),
        [76, 36, 36, 28],
        COLORS.overview
      );
    }
  }

  if (sections.ads) {
    const s = cfg.subsections?.ads || {};
    const includeTopCampaigns = reportType !== "custom" || s.topCampaigns === true || s.summary === true;
    const includeAllCampaigns = reportType !== "custom" || s.allCampaigns !== false;
    const includeBestWorst = reportType !== "custom" || s.bestWorst !== false;
    const includeRevenueBreakdown = reportType !== "custom" || s.revenueBreakdown !== false;
    sectionTitle("Ad Comparison", COLORS.ads, 24);
    const rows = payload.adComparisonBreakdownAgg.map((row: any) => {
      const nativeRevenue = Number(Number(row?.revenue || 0).toFixed(2));
      return { ...row, revenue: nativeRevenue, revenuePerSession: Number(row?.sessions || 0) > 0 ? nativeRevenue / Number(row?.sessions || 0) : 0 };
    });
    const selectedMetric = "sessions";
    const metricLabels: Record<string, string> = { sessions: "Sessions", users: "Users", conversions: "Conversions", revenue: "Revenue", conversionRate: "Conversion Rate" };
    const formatMetricValue = (metric: string, value: number) => metric === "revenue" ? formatMoney(value) : metric === "conversionRate" ? formatGA4AdComparisonCardPct(value) : formatNumber(value);
    const sortedByMetric = [...rows].sort((a: any, b: any) => Number(b?.[selectedMetric] || 0) - Number(a?.[selectedMetric] || 0));
    const totalMetric = sortedByMetric.reduce((sum: number, row: any) => sum + Number(row?.[selectedMetric] || 0), 0);
    const { bestPerforming, mostEfficient, needsAttention } = selectGA4AdComparisonLeaderCards(rows, selectedMetric);
    if (includeBestWorst && sortedByMetric.length > 1) {
      y += 4;
      checkPage(28);
      const colW = (CW - 8) / 3;
      const rankCards = [
        { title: "BEST PERFORMING", name: String(bestPerforming?.name || ""), detail: `${formatMetricValue(selectedMetric, Number(bestPerforming?.[selectedMetric] || 0))} Sessions - ${formatGA4AdComparisonCardPct(Number(bestPerforming?.conversionRate || 0))} CR`, color: COLORS.success, x: MX },
        { title: "MOST EFFICIENT", name: String(mostEfficient?.name || ""), detail: `${formatGA4AdComparisonCardPct(Number(mostEfficient?.conversionRate || 0))} CR - ${formatMoney(Number(mostEfficient?.revenue || 0))} revenue`, color: COLORS.info, x: MX + colW + 4 },
        { title: "NEEDS ATTENTION", name: String(needsAttention?.name || ""), detail: `${formatGA4AdComparisonCardPct(Number(needsAttention?.conversionRate || 0))} CR - ${formatNumber(Number(needsAttention?.sessions || 0))} sessions`, color: COLORS.danger, x: MX + (colW + 4) * 2 },
      ];
      rankCards.forEach((card) => {
        doc.setFillColor(...COLORS.white); doc.setDrawColor(...card.color);
        doc.setLineWidth(0.6); doc.roundedRect(card.x, y, colW, 24, 3, 3, "FD"); doc.setLineWidth(0.3);
        doc.setFillColor(...card.color); doc.circle(card.x + 8, y + 9, 2, "F");
        doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(...card.color); doc.text(card.title, card.x + 13, y + 7);
        doc.setFontSize(8); doc.setTextColor(...COLORS.text); doc.text(card.name.slice(0, 22), card.x + 13, y + 14);
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...COLORS.textSec); doc.text(card.detail.slice(0, 32), card.x + 13, y + 20);
      });
      y += 30;
    }
    if (includeTopCampaigns && sortedByMetric.length > 0) {
      const chartData = sortedByMetric.slice(0, 10).map((row: any) => ({ name: String(row?.name || "(not set)"), value: Number(row?.[selectedMetric] || 0) }));
      checkPage(70);
      doc.setFillColor(...COLORS.white); doc.setDrawColor(...COLORS.cardBorder); doc.roundedRect(MX, y, CW, 52, 3, 3, "FD");
      doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.text); doc.text(`Top Campaigns by ${metricLabels[selectedMetric]}`, MX + 6, y + 7);
      const chartX = MX + 40, chartY = y + 15, chartW = CW - 48, chartH = 19;
      const maxValue = Math.max(...chartData.map((item) => item.value), 1);
      const slotW = chartW / chartData.length;
      const barW = Math.max(12, Math.min(28, slotW * 0.56));
      doc.setDrawColor(...COLORS.divider); doc.setLineWidth(0.2); doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH); doc.line(chartX, chartY, chartX, chartY + chartH);
      chartData.forEach((item, index) => {
        const px = chartX + index * slotW + (slotW - barW) / 2;
        const barH = Math.max(1, (item.value / maxValue) * (chartH - 2));
        doc.setFillColor(...COLORS.ads); doc.rect(px, chartY + chartH - barH, barW, barH, "F");
        doc.setFontSize(5.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...(barH >= 8 ? COLORS.white : COLORS.text));
        doc.text(formatMetricValue(selectedMetric, item.value), px + barW / 2, barH >= 8 ? chartY + chartH - barH + 4 : chartY + chartH - barH - 1.5, { align: "center" });
        const nameLines = doc.splitTextToSize(item.name, Math.max(slotW - 4, 18)).slice(0, 2) as string[];
        if (nameLines.length > 1 && doc.getTextWidth(nameLines[1]) > slotW - 4) nameLines[1] = nameLines[1].slice(0, 18);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...COLORS.text);
        nameLines.forEach((line, lineIndex) => doc.text(line, px + barW / 2, chartY + chartH + 5 + lineIndex * 4, { align: "center" }));
      });
      doc.setFontSize(6.5); doc.setTextColor(...COLORS.textTert); doc.text(formatMetricValue(selectedMetric, maxValue), chartX + chartW, chartY + 1, { align: "right" });
      y += 58;
      metricCards([[`Total ${metricLabels[selectedMetric]}`, formatMetricValue(selectedMetric, totalMetric)], ["Campaigns Compared", String(sortedByMetric.length)]], 2, 18);
    }
    if (includeAllCampaigns) {
      const colXs = [MX + 4, MX + 18, MX + 82, MX + 104, MX + 124, MX + 144, MX + CW - 8];
      sectionTitle("All Campaigns", COLORS.ads);
      checkPage(14);
      doc.setFillColor(...COLORS.cardBg); doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.textTert);
      ["#", "CAMPAIGN", "SESSIONS", "USERS", "CONV", "REVENUE", "CR"].forEach((header, index) => doc.text(header, colXs[index], y + 5.5));
      y += 10;
      const allCampaignRows = rows.map((row: any, index: number) => ({ row, index }));
      allCampaignRows.forEach(({ row, index }: { row: any; index: number }) => {
        checkPage(9);
        const sessions = Number(row?.sessions || 0), users = Number(row?.users || 0);
        const conversions = Number(row?.conversions || 0), revenue = Number(row?.revenue || 0);
        const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0;
        doc.setDrawColor(...COLORS.divider); doc.setLineWidth(0.2); doc.line(MX + 2, y - 1, MX + CW - 2, y - 1);
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...COLORS.textSec);
        doc.text(String(index + 1), colXs[0], y + 4);
        doc.setTextColor(...COLORS.text); doc.text(String(row?.name || "(not set)").slice(0, 28), colXs[1], y + 4);
        doc.setTextColor(...COLORS.textSec);
        doc.text(formatNumber(sessions), colXs[2], y + 4); doc.text(formatNumber(users), colXs[3], y + 4);
        doc.text(formatNumber(conversions), colXs[4], y + 4); doc.text(formatMoney(revenue), colXs[5], y + 4);
        doc.text(formatGA4AdComparisonCardPct(conversionRate).replace(".00%", "%"), colXs[6], y + 4);
        y += 8;
      });
    }
    if (includeRevenueBreakdown) {
      y += 4;
      const revenueBreakdownRows: { label: string; amount: string; muted?: boolean }[] = [
        { label: "GA4 Revenue (Imported to Date)", amount: formatMoney(rows.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0)) },
        ...payload.adComparisonRevenueDisplaySources.flatMap((source: any) => [
            { label: `${String(source?.displayName || source?.sourceType || "Revenue")} (source-to-date; excluded from ranking)`, amount: formatMoney(Number(source?.revenue)) },
            ...(payload.adComparisonSourceRevenueBreakdowns.get(String(source?.sourceId || ""))
              || payload.sourceRevenueBreakdowns.get(String(source?.sourceId || ""))
              || []).map((item: any) => ({
              label: String(item?.campaignValue || ""), amount: formatMoney(Number(item?.revenue || 0)), muted: true,
            })),
          ]),
      ];
      const fullSectionHeight = 18 + 10 + revenueBreakdownRows.length * 8 + 4;
      if (fullSectionHeight <= 250 && y + fullSectionHeight > 274) { addFooter(); doc.addPage(); y = 18; }
      sectionTitle("Revenue Breakdown", COLORS.ads);
      checkPage(10);
      doc.setFillColor(...COLORS.cardBg); doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.textTert);
      doc.text("SOURCE", MX + 4, y + 5.5); doc.text("AMOUNT", MX + CW - 4, y + 5.5, { align: "right" });
      y += 10;
      revenueBreakdownRows.forEach((row) => {
        checkPage(8);
        doc.setDrawColor(...COLORS.divider); doc.setLineWidth(0.2); doc.line(MX + 2, y - 1, MX + CW - 2, y - 1);
        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...(row.muted ? COLORS.textSec : COLORS.text));
        doc.text(row.label.slice(0, 42), MX + (row.muted ? 8 : 4), y + 4);
        doc.text(row.amount, MX + CW - 4, y + 4, { align: "right" });
        y += 8;
      });
    }
  }

  if (sections.insights) {
    const s = cfg.subsections?.insights || {};
    const includeSummaryCards = reportType !== "custom" || s.summaryCards === true;
    const includeTrends = reportType !== "custom" || s.trends === true;
    const includeDataSummary = reportType !== "custom" || s.dataSummary === true;
    const includeActions = reportType !== "custom" || s.actions === true;
    const onlyActions = reportType === "custom" && includeActions && !includeSummaryCards && !includeTrends && !includeDataSummary;
    sectionTitle(onlyActions ? "What to investigate next" : "Insights", COLORS.insights, 24);
    checkPage(14);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.textSec);
    doc.text(`Completed-day cutoff: ${formatReportingDateLabel(payload.insightsFreshness.dataThroughDate)}`, MX, y + 4);
    doc.text(`Reporting timezone: ${formatReportingTimeZoneLabel(payload.insightsFreshness.reportingTimeZone)}`, MX + 66, y + 4);
    doc.text(`Last refreshed: ${formatReportingTimestampLabel(payload.insightsFreshness.lastRefreshedAt, payload.insightsFreshness.reportingTimeZone)}`, MX, y + 10);
    y += 14;
    if (includeSummaryCards) {
      const financialNoteLines = doc.splitTextToSize(String(payload.executiveFinancialsDescription || ""), CW) as string[];
      checkPage(financialNoteLines.length * 4.5 + 6);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textSec);
      for (const line of financialNoteLines) {
        doc.text(line, MX, y);
        y += 4.5;
      }
      y += 3;
      metricCards([
        ["Revenue", formatMoney(payload.financialRevenue)],
        ["Spend", formatMoney(payload.financialSpend)],
        ["Profit", formatMoney(payload.financialRevenue - payload.financialSpend)],
        ["ROAS", `${Number(payload.financialROAS || 0).toFixed(2)}x`],
        ["Days of Data", formatNumber(payload.insightsRollups.availableDays || 0)],
      ], 3);
    }
    if (includeTrends) {
      const trendNoteLines = doc.splitTextToSize("Daily shows day-by-day values. 7d/30d show rolling totals for non-rate metrics and weighted averages for rates. Monthly compares calendar months.", CW) as string[];
      checkPage(trendNoteLines.length * 4.5 + 6);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textSec);
      for (const line of trendNoteLines) {
        doc.text(line, MX, y);
        y += 4.5;
      }
      y += 3;
      const trendRows = payload.insightsRollups.rows.slice(-14).map((row: any) => ({ label: String(row?.date || "").slice(5), value: Number(row?.sessions || 0) }));
      drawTrendChart("Trends", trendRows);
      addSimpleTable(
        "Trend Table",
        ["DATE", "SESSIONS", "REVENUE", "CONVERSIONS"],
        payload.insightsRollups.rows.slice(-14).map((row: any) => [
          String(row?.date || ""),
          formatNumber(row?.sessions || 0),
          formatMoney(Number(row?.revenue || 0)),
          formatNumber(row?.conversions || 0),
        ]),
        [52, 36, 48, 44],
        COLORS.insights
      );
    }
    if (includeDataSummary) {
      addSimpleTable(
        "Data Summary",
        ["METRIC", "VALUE", "NOTE"],
        [
          ["Sessions", formatNumber(payload.breakdownTotals.sessions), "Current GA4 total"],
          ["Users", formatNumber(payload.breakdownTotals.users), ""],
          ["Conversions", formatNumber(payload.breakdownTotals.conversions), ""],
          ["Revenue", formatMoney(payload.financialRevenue), "Total across revenue sources"],
          ...(payload.financialSpend > 0 ? [["Total Spend", formatMoney(payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 ? [["Profit", formatMoney(payload.financialRevenue - payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 ? [["CPA", formatMoney(payload.financialCPA), ""]] : []),
        ],
        [52, 46, 76],
        COLORS.insights
      );
    }
    if (includeActions) {
      if (!onlyActions) sectionTitle("What to investigate next", COLORS.insights, 16);
      const actionLines = doc.splitTextToSize(buildInsightsActionDescription(Number(payload.insightsRollups.availableDays || 0)), CW - 8) as string[];
      if (actionLines.length > 0) {
        checkPage(actionLines.length * 4.5 + 6);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textSec);
        for (const line of actionLines) {
          doc.text(line, MX + 4, y);
          y += 4.5;
        }
        y += 3;
      }
      const topInsights = payload.insightsItems.slice(0, 8);
      const groupedInsights = INSIGHT_CATEGORY_GROUPS.map((group) => ({
        ...group,
        items: topInsights.filter((item: any) => item.category === group.key),
      })).filter((group) => group.items.length > 0);
      for (const group of groupedInsights) {
        checkPage(10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.text);
        doc.text(group.label, MX + 4, y);
        y += 6;
        for (const item of group.items) {
          const sevCol = item.severity === "high" ? COLORS.danger : item.severity === "positive" ? COLORS.success : item.severity === "medium" ? COLORS.warning : COLORS.info;
          const lines = doc.splitTextToSize(String(item.description || ""), CW - 20) as string[];
          const meta = [item.dataBasis ? `Basis: ${String(item.dataBasis)}` : "", item.confidence ? `Confidence: ${String(item.confidence)}` : ""].filter(Boolean).join(" | ");
          const metaLines = meta ? doc.splitTextToSize(meta, CW - 20) as string[] : [];
          const recLines = item.recommendation ? doc.splitTextToSize(`Recommended check: ${String(item.recommendation || "")}`, CW - 20) as string[] : [];
          const height = 18 + metaLines.length * 4 + (metaLines.length > 0 ? 2 : 0) + lines.length * 4.5 + (recLines.length > 0 ? recLines.length * 4.5 + 4 : 0);
          checkPage(height + 4);
          doc.setFillColor(...COLORS.white);
          doc.setDrawColor(...COLORS.cardBorder);
          doc.roundedRect(MX, y, CW, height, 3, 3, "FD");
          doc.setFillColor(...sevCol);
          doc.roundedRect(MX, y, 3, height, 1, 1, "F");
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.text);
          doc.text(String(item.title || "").slice(0, 80), MX + 8, y + 8);
          let lineY = y + 14;
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...COLORS.textSec);
          if (metaLines.length > 0) {
            doc.setFontSize(7);
            doc.setTextColor(...COLORS.textTert);
            for (const line of metaLines) {
              doc.text(line, MX + 8, lineY);
              lineY += 4;
            }
            lineY += 1;
            doc.setFontSize(8);
            doc.setTextColor(...COLORS.textSec);
          }
          for (const line of lines) {
            doc.text(line, MX + 8, lineY);
            lineY += 4.5;
          }
          if (recLines.length > 0) {
            lineY += 2;
            for (const line of recLines) {
              doc.text(line, MX + 8, lineY);
              lineY += 4.5;
            }
          }
          y += height + 4;
        }
      }
      if (payload.insightsItems.length > topInsights.length) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.textTert);
        doc.text(`+ ${payload.insightsItems.length - topInsights.length} more insights`, MX + 4, y + 2);
        y += 8;
      }
    }
  }

  if (sections.kpis && (reportType !== "custom" || cfg.subsections?.kpis?.items === true)) {
    const items = payload.platformKPIs.filter((item: any) => !selectedCustomKpiIds || selectedCustomKpiIds.has(String(item.id)));
    if (items.length > 0) {
      addSimpleTable(
        "Key Performance Indicators",
        ["KPI", "CURRENT", "TARGET"],
        items.map((item: any) => [
          String(item?.name || item?.metric || "KPI"),
          String(item?.currentValue || "0"),
          String(item?.targetValue || "0"),
        ]),
        [96, 40, 48],
        COLORS.kpis
      );
    }
  }

  if (sections.benchmarks && (reportType !== "custom" || cfg.subsections?.benchmarks?.items === true)) {
    const items = payload.benchmarks.filter((item: any) => !selectedCustomBenchmarkIds || selectedCustomBenchmarkIds.has(String(item.id)));
    if (items.length > 0) {
      addSimpleTable(
        "Performance Benchmarks",
        ["BENCHMARK", "CURRENT", "TARGET"],
        items.map((item: any) => [
          String(item?.name || item?.metric || "Benchmark"),
          String(item?.currentValue || "0"),
          String(item?.benchmarkValue || "0"),
        ]),
        [96, 40, 48],
        COLORS.benchmarks
      );
    }
  }

  addFooter();
  return coercePdfBufferFromDoc(doc);
}
