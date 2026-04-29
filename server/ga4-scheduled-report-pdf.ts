import { ga4Service } from "./analytics";
import { storage } from "./storage";
import { computeCpa, computeRoiPercent, normalizeRateToPercent } from "../shared/metric-math";

type CampaignFilter = string | string[] | undefined;
type C3 = [number, number, number];

const REPORT_LOOKBACK_RANGE = "90daysAgo";

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
  ads: { summary: false, allCampaigns: false, bestWorst: false, revenueBreakdown: false },
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

const toISODateUTC = (value: any) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const yesterdayUTC = () => {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endD = new Date(todayUtc.getTime() - 24 * 60 * 60 * 1000);
  return `${endD.getUTCFullYear()}-${String(endD.getUTCMonth() + 1).padStart(2, "0")}-${String(endD.getUTCDate()).padStart(2, "0")}`;
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

const normalizeCampaignKey = (value: any) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

const parseMappingConfig = (value: any) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value || {};
};

const formatPct = (value: number) => `${Number(value || 0).toFixed(1)}%`;

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
  const items: Array<{ severity: "high" | "medium" | "positive" | "info"; title: string; description: string; recommendation?: string }> = [];
  const financialRevenue = Number(payload.financialRevenue || 0);
  const financialSpend = Number(payload.financialSpend || 0);
  const rollups = payload.insightsRollups;
  if (financialSpend > 0 && financialRevenue <= 0) {
    items.push({
      severity: "high",
      title: "Spend without revenue",
      description: `Spend-to-date is ${payload.formatMoney(financialSpend)}, but revenue-to-date is ${payload.formatMoney(0)}.`,
      recommendation: "Validate revenue tracking and attribution for this campaign before increasing spend.",
    });
  }
  if (rollups.prior7.revenue > 0 && rollups.deltas.revenue7 <= -25) {
    items.push({
      severity: "high",
      title: "Revenue down vs prior 7 days",
      description: `Last 7d revenue ${payload.formatMoney(rollups.last7.revenue)} vs prior 7d ${payload.formatMoney(rollups.prior7.revenue)}.`,
      recommendation: "Check campaign mix, landing pages, and revenue tracking changes across the last week.",
    });
  }
  if (rollups.prior7.sessions > 0 && rollups.deltas.sessions7 <= -20) {
    items.push({
      severity: "medium",
      title: "Traffic drop detected",
      description: `Last 7d sessions ${payload.formatNumber(rollups.last7.sessions)} vs prior 7d ${payload.formatNumber(rollups.prior7.sessions)}.`,
      recommendation: "Review source and medium mix to identify which acquisition channels dropped first.",
    });
  }
  if (rollups.prior7.conversions > 0 && rollups.deltas.conversions7 <= -20) {
    items.push({
      severity: "medium",
      title: "Conversions down vs prior 7 days",
      description: `Last 7d conversions ${payload.formatNumber(rollups.last7.conversions)} vs prior 7d ${payload.formatNumber(rollups.prior7.conversions)}.`,
      recommendation: "Review conversion-event firing, landing page changes, and traffic quality.",
    });
  }
  if (rollups.prior7.revenue > 0 && rollups.deltas.revenue7 >= 20) {
    items.push({
      severity: "positive",
      title: "Revenue momentum improving",
      description: `Last 7d revenue ${payload.formatMoney(rollups.last7.revenue)} vs prior 7d ${payload.formatMoney(rollups.prior7.revenue)}.`,
      recommendation: "Identify the winning sources and consider scaling them carefully while monitoring efficiency.",
    });
  }
  if (items.length === 0) {
    items.push({
      severity: "info",
      title: "No major anomalies detected",
      description: "Recent GA4 trends are stable relative to the prior comparison window.",
      recommendation: "Continue monitoring the main revenue, traffic, and conversion drivers for this campaign.",
    });
  }
  return items.slice(0, 8);
};

async function buildGA4ReportPayload(report: any) {
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) throw new Error("GA4_REPORT_CAMPAIGN_REQUIRED");
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  const connection = await choosePrimaryConnection(campaignId);
  const propertyId = String(connection.propertyId);
  const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
  const startDate = toISODateUTC((campaign as any)?.startDate) || toISODateUTC((campaign as any)?.createdAt) || "2020-01-01";
  const endDate = yesterdayUTC();
  const dailyStart = (() => {
    const d = new Date(`${endDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 89);
    return d.toISOString().slice(0, 10);
  })();
  const benchmarkStorage = storage as typeof storage & {
    getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<any[]>;
  };

  const [metrics, breakdown, landingPages, conversionEvents, timeSeries, revenueSources, spendSources, revenueBreakdown, spendBreakdown, platformKPIs, benchmarks] = await Promise.all([
    ga4Service.getMetricsWithAutoRefresh(campaignId, storage, REPORT_LOOKBACK_RANGE, propertyId, campaignFilter),
    ga4Service.getAcquisitionBreakdown(campaignId, storage, REPORT_LOOKBACK_RANGE, propertyId, 2000, campaignFilter),
    ga4Service.getLandingPagesReport(campaignId, storage, startDate, propertyId, 50, campaignFilter),
    ga4Service.getConversionEventsReport(campaignId, storage, startDate, propertyId, 50, campaignFilter),
    ga4Service.getTimeSeriesData(campaignId, storage, dailyStart, propertyId, campaignFilter),
    storage.getRevenueSources(campaignId, "ga4").catch(() => [] as any[]),
    storage.getSpendSources(campaignId).catch(() => [] as any[]),
    storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, "ga4").catch(() => [] as any[]),
    storage.getSpendBreakdownBySource(campaignId, startDate, endDate).catch(() => [] as any[]),
    storage.getPlatformKPIs("google_analytics", campaignId).catch(() => [] as any[]),
    benchmarkStorage.getPlatformBenchmarks("google_analytics", campaignId).catch(() => [] as any[]),
  ]);

  const ga4ToDate = await withTokenRefresh(connection, async (token) => {
    return await ga4Service.getTotalsWithRevenue(propertyId, token, startDate, endDate, campaignFilter);
  });

  let dailyRows = await storage.getGA4DailyMetrics(campaignId, propertyId, dailyStart, endDate).catch(() => [] as any[]);
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

  const breakdownTotals = {
    sessions: Math.max(Number((ga4ToDate as any)?.totals?.sessions || 0), Number(dailySummedTotals.sessions || 0)),
    conversions: Math.max(Number((ga4ToDate as any)?.totals?.conversions || 0), Number(dailySummedTotals.conversions || 0)),
    revenue: Math.max(Number((ga4ToDate as any)?.totals?.revenue || 0), Number(dailySummedTotals.revenue || 0)),
    users: Number((ga4ToDate as any)?.totals?.users || 0) || Number(dailySummedTotals.users || 0),
  };

  const importedRevenueForFinancials = Number(revenueBreakdown.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0).toFixed(2));
  const ga4RevenueForFinancials = Math.max(Number((ga4ToDate as any)?.totals?.revenue || 0), Number(dailySummedTotals.revenue || 0));
  const financialRevenue = Number((ga4RevenueForFinancials + importedRevenueForFinancials).toFixed(2));
  const financialConversions = Math.max(Number((ga4ToDate as any)?.totals?.conversions || 0), Number(dailySummedTotals.conversions || 0));
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
  let rawTotalRevenue = 0;
  for (const row of Array.isArray((breakdown as any)?.rows) ? (breakdown as any).rows : []) {
    const name = String((row as any)?.campaign || "(not set)").trim();
    const current = byCampaign.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0 };
    current.sessions += Number((row as any)?.sessions || 0);
    current.users += Number((row as any)?.users || 0);
    current.conversions += Number((row as any)?.conversions || 0);
    current.revenue += Number((row as any)?.revenue || 0);
    rawTotalRevenue += Number((row as any)?.revenue || 0);
    byCampaign.set(name, current);
  }
  const revenueScale = rawTotalRevenue > 0 ? breakdownTotals.revenue / rawTotalRevenue : 1;
  const campaignBreakdownAgg = Array.from(byCampaign.values())
    .filter((row) => importedCampaignNames.size === 0 || importedCampaignNames.has(normalizeCampaignKey(row.name)))
    .map((row) => {
      const revenue = Number((row.revenue * revenueScale).toFixed(2));
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

  const rowNameByKey = new Map<string, string>();
  for (const row of campaignBreakdownAgg) {
    const key = normalizeCampaignKey(row.name);
    if (key) rowNameByKey.set(key, row.name);
  }
  const campaignBreakdownMatchedExternalRevenue = new Map<string, number>();
  for (const source of revenueDisplaySources) {
    const cfg = parseMappingConfig((source as any)?.mappingConfig);
    const totals = Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
    for (const item of totals) {
      const key = normalizeCampaignKey(item?.campaignValue);
      const revenue = Number(item?.revenue || 0);
      const rowName = rowNameByKey.get(key);
      if (rowName && revenue > 0) campaignBreakdownMatchedExternalRevenue.set(rowName, (campaignBreakdownMatchedExternalRevenue.get(rowName) || 0) + revenue);
    }
  }

  const pipelineEntries = revenueSources
    .filter((source: any) => source?.isActive !== false)
    .map((source: any) => {
      const cfg = parseMappingConfig(source?.mappingConfig);
      if (cfg?.pipelineEnabled !== true || !(cfg.pipelineStageLabel || cfg.pipelineStageName || cfg.pipelineStageId)) return null;
      const providerLabel = source?.sourceType === "salesforce" ? "Salesforce" : source?.sourceType === "hubspot" ? "HubSpot" : String(source?.displayName || source?.sourceType || "CRM");
      const stage = String(cfg.pipelineStageLabel || cfg.pipelineStageName || cfg.pipelineStageId || "").trim();
      const totals = Array.isArray(cfg.pipelineValueRevenueTotals) ? cfg.pipelineValueRevenueTotals : [];
      const campaignValues = totals.length > 0
        ? totals.map((item: any) => String(item?.campaignValue || "").trim()).filter(Boolean)
        : Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((value: any) => String(value || "").trim()).filter(Boolean) : [];
      return {
        providerLabel,
        pipelineStageLabel: stage,
        totalToDate: Number(cfg.pipelineTotalToDate || 0),
        campaignValues,
      };
    })
    .filter(Boolean) as Array<{ providerLabel: string; pipelineStageLabel: string; totalToDate: number; campaignValues: string[] }>;

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
    importedRevenueForFinancials,
    campaignBreakdownAgg,
    campaignBreakdownMatchedExternalRevenue,
    pipelineEntries,
    insightsRollups,
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
  const { report, reportName, windowStart, windowEnd, campaignName } = _args;
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const payload = await buildGA4ReportPayload(report);
  const reportType = String(report?.reportType || "overview").toLowerCase();
  const rawCfg = typeof report?.configuration === "string" ? JSON.parse(report.configuration || "{}") : (report?.configuration || {});
  const cfg = normalizeCustomReportConfig(rawCfg);
  const sections = reportType === "custom"
    ? cfg.sections
    : { overview: reportType === "overview", kpis: reportType === "kpis", benchmarks: reportType === "benchmarks", ads: reportType === "ads", insights: reportType === "insights" };
  const selectedCustomKpiIds = new Set(cfg.selectedKpiIds || []);
  const selectedCustomBenchmarkIds = new Set(cfg.selectedBenchmarkIds || []);
  const latestImportedRevenue = Number((await storage.getRevenueBreakdownBySource(String(report.campaignId), windowEnd, windowEnd, "ga4").catch(() => [] as any[])).reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0).toFixed(2));
  const latestSpend = Number((await storage.getSpendBreakdownBySource(String(report.campaignId), windowEnd, windowEnd).catch(() => [] as any[])).reduce((sum: number, row: any) => sum + Number(row?.spend || 0), 0).toFixed(2));
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
  const addSimpleTable = (title: string, headers: string[], rows: string[][], widths: number[], color: C3 = COLORS.overview) => {
    if (rows.length === 0) return;
    const fullHeight = 18 + 10 + rows.length * 8 + 4;
    if (fullHeight <= 250 && y + fullHeight > 274) {
      addFooter();
      doc.addPage();
      y = 18;
    }
    sectionTitle(title, color);
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
    const min = Math.min(...values, 0);
    const innerX = MX + 8;
    const innerY = chartY + 6;
    const innerW = width - 16;
    const innerH = height - 14;
    doc.setDrawColor(...COLORS.divider);
    doc.line(innerX, innerY + innerH, innerX + innerW, innerY + innerH);
    doc.line(innerX, innerY, innerX, innerY + innerH);
    doc.setDrawColor(...COLORS.insights);
    doc.setLineWidth(0.8);
    rows.forEach((row, idx) => {
      const px = innerX + (idx * innerW) / Math.max(rows.length - 1, 1);
      const normalized = max === min ? 0.5 : (Number(row.value || 0) - min) / (max - min);
      const py = innerY + innerH - normalized * innerH;
      if (idx > 0) {
        const prev = rows[idx - 1];
        const prevX = innerX + ((idx - 1) * innerW) / Math.max(rows.length - 1, 1);
        const prevNorm = max === min ? 0.5 : (Number(prev.value || 0) - min) / (max - min);
        const prevY = innerY + innerH - prevNorm * innerH;
        doc.line(prevX, prevY, px, py);
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
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, MX + CW / 2, y + 7);
  doc.text(`Property: ${String(payload.connection?.displayName || payload.connection?.propertyName || payload.connection?.propertyId || "")}`, MX + 6, y + 15);
  doc.text(`Window: ${windowStart} to ${windowEnd} (UTC)`, MX + CW / 2, y + 15);
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
      const totalSessions = payload.dailyRows.reduce((sum: number, row: any) => sum + Number(row?.sessions || 0), 0);
      const totalEngagedSessions = payload.dailyRows.reduce((sum: number, row: any) => sum + Number(row?.engagedSessions || 0), 0);
      metricCards([
        ["Sessions", formatNumber(payload.breakdownTotals.sessions)],
        ["Users", formatNumber(payload.breakdownTotals.users)],
        ["Conversions", formatNumber(payload.breakdownTotals.conversions)],
        ["Engagement Rate", formatPct(normalizeRateToPercent(totalSessions > 0 ? totalEngagedSessions / totalSessions : Number(payload.metrics?.engagementRate || 0)))],
        ["Conv. Rate", formatPct(payload.breakdownTotals.sessions > 0 ? (payload.breakdownTotals.conversions / payload.breakdownTotals.sessions) * 100 : 0)],
      ], 3);
    }
    if (includeRevenue || includeSpend || includePerformance) subheading("Revenue & Financial", 10);
    if (includeRevenue) {
      subheading("Revenue");
      const latestGa4DayRevenue = Number([...payload.dailyRows].sort((a: any, b: any) => String(a.date || "").localeCompare(String(b.date || ""))).slice(-1)[0]?.revenue || 0);
      const pipelineTotal = payload.pipelineEntries.reduce((sum: number, entry: any) => sum + Number(entry?.totalToDate || 0), 0);
      const revenueCards: [string, string][] = [
        ["Total Revenue", formatMoney(payload.financialRevenue)],
        ["Latest Day Revenue", formatMoney(latestGa4DayRevenue + latestImportedRevenue)],
      ];
      if (pipelineTotal > 0) revenueCards.push(["Pipeline Proxy", formatMoney(pipelineTotal)]);
      metricCards(revenueCards, Math.min(revenueCards.length, 3));
      addSimpleTable(
        "Revenue Sources",
        ["SOURCE", "AMOUNT"],
        [
          ...(payload.ga4RevenueForFinancials > 0 ? [["GA4 Revenue", formatMoney(payload.ga4RevenueForFinancials)]] : []),
          ...payload.revenueDisplaySources.map((source: any) => [String(source?.displayName || source?.sourceType || "Revenue"), formatMoney(Number(source?.revenue || 0))]),
        ],
        [120, 64],
        COLORS.overview
      );
    }
    if (includeSpend) {
      subheading("Spend");
      metricCards([
        ["Total Spend", formatMoney(payload.financialSpend)],
        ["Latest Day Spend", formatMoney(latestSpend)],
      ], 2);
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
        ["CAMPAIGN", "SESSIONS", "USERS", "CONV", "REVENUE"],
        payload.campaignBreakdownAgg.slice(0, 15).map((row: any) => [
          String(row?.name || "(not set)"),
          formatNumber(row?.sessions || 0),
          formatNumber(row?.users || 0),
          formatNumber(row?.conversions || 0),
          formatMoney(Number((Number(row?.revenue || 0) + Number(payload.campaignBreakdownMatchedExternalRevenue.get(String(row?.name || "")) || 0)).toFixed(2))),
        ]),
        [76, 24, 22, 22, 40],
        COLORS.overview
      );
    }
    if (includeLandingPages) {
      addSimpleTable(
        "Landing Pages",
        ["LANDING PAGE", "SESSIONS", "USERS", "CONV", "REVENUE"],
        (payload.landingPages?.rows || []).slice(0, 15).map((row: any) => [
          String(row?.landingPage || "(not set)"),
          formatNumber(row?.sessions || 0),
          formatNumber(row?.users || 0),
          formatNumber(row?.conversions || 0),
          formatMoney(Number(row?.revenue || 0)),
        ]),
        [76, 24, 22, 22, 40],
        COLORS.overview
      );
    }
    if (includeConversionEvents) {
      addSimpleTable(
        "Conversion Events",
        ["EVENT", "CONV", "EVENTS", "USERS", "REVENUE"],
        (payload.conversionEvents?.rows || []).slice(0, 15).map((row: any) => [
          String(row?.eventName || "(not set)"),
          formatNumber(row?.conversions || 0),
          formatNumber(row?.eventCount || 0),
          formatNumber(row?.users || 0),
          formatMoney(Number(row?.revenue || 0)),
        ]),
        [76, 22, 24, 22, 40],
        COLORS.overview
      );
    }
  }

  if (sections.ads) {
    const s = cfg.subsections?.ads || {};
    const includeSummary = reportType !== "custom" || s.summary === true;
    const includeAllCampaigns = reportType !== "custom" || s.allCampaigns === true;
    const includeBestWorst = reportType !== "custom" || s.bestWorst === true;
    const includeRevenueBreakdown = reportType !== "custom" || s.revenueBreakdown === true;
    sectionTitle("Ad Comparison", COLORS.ads, 24);
    const rows = payload.campaignBreakdownAgg.map((row: any) => {
      const adjustedRevenue = Number((Number(row?.revenue || 0) + Number(payload.campaignBreakdownMatchedExternalRevenue.get(String(row?.name || "")) || 0)).toFixed(2));
      return { ...row, revenue: adjustedRevenue, revenuePerSession: Number(row?.sessions || 0) > 0 ? adjustedRevenue / Number(row?.sessions || 0) : 0 };
    });
    if (includeSummary) {
      metricCards([
        ["Campaigns", formatNumber(rows.length)],
        ["Total Sessions", formatNumber(rows.reduce((sum: number, row: any) => sum + Number(row?.sessions || 0), 0))],
        ["Total Revenue", formatMoney(payload.financialRevenue)],
      ], 3);
    }
    if (includeAllCampaigns) {
      addSimpleTable(
        "All Campaigns",
        ["CAMPAIGN", "SESSIONS", "CONV", "CR", "REVENUE"],
        rows.slice(0, 20).map((row: any) => [
          String(row?.name || "(not set)"),
          formatNumber(row?.sessions || 0),
          formatNumber(row?.conversions || 0),
          formatPct(row?.conversionRate || 0),
          formatMoney(Number(row?.revenue || 0)),
        ]),
        [72, 24, 20, 20, 48],
        COLORS.ads
      );
    }
    if (includeBestWorst && rows.length > 0) {
      const best = [...rows].sort((a: any, b: any) => Number(b?.sessions || 0) - Number(a?.sessions || 0))[0];
      const efficient = [...rows].filter((row: any) => Number(row?.sessions || 0) > 0).sort((a: any, b: any) => Number(b?.conversionRate || 0) - Number(a?.conversionRate || 0))[0];
      const lowest = [...rows].sort((a: any, b: any) => Number(a?.sessions || 0) - Number(b?.sessions || 0))[0];
      metricCards([
        ["Best Performing", `${String(best?.name || "").slice(0, 18)} (${formatNumber(best?.sessions || 0)})`],
        ["Most Efficient", `${String(efficient?.name || "").slice(0, 18)} (${formatPct(efficient?.conversionRate || 0)})`],
        ["Needs Attention", `${String(lowest?.name || "").slice(0, 18)} (${formatNumber(lowest?.sessions || 0)})`],
      ], 3, 28);
    }
    if (includeRevenueBreakdown) {
      addSimpleTable(
        "Revenue Breakdown",
        ["SOURCE", "AMOUNT"],
        [
          ...(payload.ga4RevenueForFinancials > 0 ? [["GA4 Revenue", formatMoney(payload.ga4RevenueForFinancials)]] : []),
          ...payload.revenueDisplaySources.map((source: any) => [String(source?.displayName || source?.sourceType || "Revenue"), formatMoney(Number(source?.revenue || 0))]),
        ],
        [120, 64],
        COLORS.ads
      );
    }
  }

  if (sections.insights) {
    const s = cfg.subsections?.insights || {};
    const includeSummaryCards = reportType !== "custom" || s.summaryCards === true;
    const includeTrends = reportType !== "custom" || s.trends === true;
    const includeDataSummary = reportType !== "custom" || s.dataSummary === true;
    const includeActions = reportType !== "custom" || s.actions === true;
    const onlyActions = reportType === "custom" && includeActions && !includeSummaryCards && !includeTrends && !includeDataSummary;
    sectionTitle(onlyActions ? "What changed, what to do next" : "Insights", COLORS.insights, 24);
    if (includeSummaryCards) {
      metricCards([
        ["Revenue", formatMoney(payload.financialRevenue)],
        ["Spend", formatMoney(payload.financialSpend)],
        ["Profit", formatMoney(payload.financialRevenue - payload.financialSpend)],
        ["ROAS", `${Number(payload.financialROAS || 0).toFixed(2)}x`],
        ["Days of Data", formatNumber(payload.insightsRollups.availableDays || 0)],
      ], 3);
    }
    if (includeTrends) {
      const trendRows = payload.insightsRollups.rows.slice(-14).map((row: any) => ({ label: String(row?.date || ""), value: Number(row?.sessions || 0) }));
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
          ["Sessions", formatNumber(payload.breakdownTotals.sessions), `~${formatNumber(Math.round(payload.breakdownTotals.sessions / Math.max(payload.insightsRollups.availableDays || 1, 1)))}/day avg`],
          ["Users", formatNumber(payload.breakdownTotals.users), ""],
          ["Conversions", formatNumber(payload.breakdownTotals.conversions), ""],
          ["Revenue", formatMoney(payload.financialRevenue), `~${formatMoney(payload.financialRevenue / Math.max(payload.insightsRollups.availableDays || 1, 1))}/day avg`],
          ...(payload.financialSpend > 0 ? [["Total Spend", formatMoney(payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 ? [["Profit", formatMoney(payload.financialRevenue - payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 ? [["CPA", formatMoney(payload.financialCPA), ""]] : []),
        ],
        [52, 46, 76],
        COLORS.insights
      );
    }
    if (includeActions) {
      if (!onlyActions) sectionTitle("What changed, what to do next", COLORS.insights, 16);
      for (const item of payload.insightsItems.slice(0, 8)) {
        const sevCol = item.severity === "high" ? COLORS.danger : item.severity === "positive" ? COLORS.success : item.severity === "medium" ? COLORS.warning : COLORS.info;
        const lines = doc.splitTextToSize(String(item.description || ""), CW - 20) as string[];
        const recLines = item.recommendation ? doc.splitTextToSize(`Next step: ${String(item.recommendation || "")}`, CW - 20) as string[] : [];
        const height = 18 + lines.length * 4.5 + (recLines.length > 0 ? recLines.length * 4.5 + 4 : 0);
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
  }

  if (reportType === "custom" && sections.kpis) {
    const items = payload.platformKPIs.filter((item: any) => selectedCustomKpiIds.size === 0 || selectedCustomKpiIds.has(String(item.id)));
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

  if (reportType === "custom" && sections.benchmarks) {
    const items = payload.benchmarks.filter((item: any) => selectedCustomBenchmarkIds.size === 0 || selectedCustomBenchmarkIds.has(String(item.id)));
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
