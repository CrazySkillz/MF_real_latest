import { buildGA4InsightsRollups, buildGA4InsightsHistoryScopeMarker, filterGA4InsightsHistoryByScope, countGA4InsightsConsecutiveDays, filterGA4InsightsBreakdownRowsToImportedDates, selectUniqueLowestGA4InsightsConversionRateChannel } from "../shared/ga4-insights";
import { conversionCreditsMatch, computeProgress } from "../shared/metric-math";
import { ga4Service } from "./analytics";
import { storage } from "./storage";
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE, getReportingDateWindow, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { computeCpa, computeRoiPercent, normalizeRateToPercent, formatPct as formatMetricPct, formatConversionCredit } from "../shared/metric-math";
import { formatGA4AdComparisonCardPct, selectGA4AdComparisonLeaderCards } from "../shared/ga4-ad-comparison-cards";
import { normalizeGA4CampaignAllocationKey, selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { mergeGA4OverviewCampaignRevenueRows, summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { resolveExactGA4CampaignBreakdownRevenue } from "../shared/ga4-campaign-breakdown";
import { computeAttainmentPct, computeEffectiveDeltaPct, computeBenchmarkThresholdResult, isLowerIsBetterKpi, resolveKpiDataSufficiency, resolveBenchmarkDataSufficiency } from "../shared/kpi-math";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { resolveGA4KpiLiveValue } from "../shared/ga4-kpi-live-value";
import { resolveGA4InsightTargetPeriodCompatibility, resolveGA4KpiConsumerState } from "../shared/ga4-kpi-consumer-state";
import { isSupportedGA4ConnectionMethod } from "./utils/ga4-service-account";
import { financialDailySnapshotInputSchema } from "../shared/schema";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

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
  accent: [244, 174, 126] as C3,
  accentText: [183, 82, 24] as C3,
  accentBg: [255, 239, 226] as C3,
  background: [254, 249, 243] as C3,
  overview: [244, 174, 126] as C3,
  ads: [244, 174, 126] as C3,
  insights: [244, 174, 126] as C3,
  kpis: [244, 174, 126] as C3,
  benchmarks: [244, 174, 126] as C3,
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

let cachedMimoSaaSReportLogo: string | null | undefined;
const getMimoSaaSReportLogo = (): string | null => {
  if (cachedMimoSaaSReportLogo !== undefined) return cachedMimoSaaSReportLogo;
  const fileName = "logo_fff8f3_bg_orange_fill.jpg";
  const candidates = [
    resolve(process.cwd(), "dist", "public", fileName),
    resolve(process.cwd(), "client", "public", fileName),
    resolve(import.meta.dirname, "public", fileName),
    resolve(import.meta.dirname, "..", "client", "public", fileName),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  try {
    cachedMimoSaaSReportLogo = logoPath
      ? `data:image/jpeg;base64,${readFileSync(logoPath).toString("base64")}`
      : null;
  } catch {
    cachedMimoSaaSReportLogo = null;
  }
  return cachedMimoSaaSReportLogo;
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
  if (reportType === "kpis" || reportType === "insights") return true;
  if (reportType !== "custom") return false;
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  return Boolean(cfg.sections?.insights || (cfg.sections?.kpis && cfg.subsections?.kpis?.items && cfg.selectedKpiIds.length > 0));
};

const reportIncludesBenchmarkSection = (report: any): boolean => {
  const reportType = String(report?.reportType || "overview").toLowerCase();
  if (reportType === "benchmarks" || reportType === "insights") return true;
  if (reportType !== "custom") return false;
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  return Boolean(cfg.sections?.insights || (cfg.sections?.benchmarks && cfg.subsections?.benchmarks?.items && cfg.selectedBenchmarkIds.length > 0));
};

const reportIncludesInsightsActions = (report: any): boolean => {
  const type = String(report?.reportType || "overview").toLowerCase();
  const cfg = normalizeCustomReportConfig(parseReportConfiguration(report?.configuration));
  return type === "insights" || (type === "custom" && cfg.sections.insights && cfg.subsections.insights.actions);
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
    topCampaigns: Boolean(included && (reportType !== 'custom' || subsections.topCampaigns === true || subsections.summary === true || subsections.bestWorst === true)),
    nativeDetail: Boolean(included && (reportType !== 'custom' || subsections.allCampaigns === true || subsections.revenueBreakdown === true)),
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
  const active = (connections || []).filter((c: any) => c?.isActive !== false);
  const selected = active.find((c: any) => c?.isPrimary) || active[0];
  if (!selected) throw new Error("NO_GA4_CONNECTION");
  if (!isSupportedGA4ConnectionMethod(selected.method)) throw new Error("GA4_CONNECTION_METHOD_UNSUPPORTED");
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

const buildTrendRollups = (dailyRows: any[], dataThroughDate?: string) => {
  const rollups = buildGA4InsightsRollups(dailyRows, dataThroughDate || null);
  // Preserve the report's fraction unit while sharing exact calendar coverage with Insights.
  const fraction = (window: typeof rollups.last7) => ({ ...window, engagementRate: window.engagementRate / 100 });
  return { ...rollups, last7: fraction(rollups.last7), prior7: fraction(rollups.prior7),
    last30: fraction(rollups.last30), prior30: fraction(rollups.prior30), last3: fraction(rollups.last3), prior3: fraction(rollups.prior3) };
};

const buildInsightsItems = (payload: any) => {
  const items: Array<{ severity: "high" | "medium" | "positive" | "info"; title: string; description: string; recommendation?: string; category: InsightCategory; dataBasis: string; confidence: InsightConfidence }> = [];
  const financialRevenue = Number(payload.financialRevenue || 0);
  const financialSpend = Number(payload.financialSpend || 0);
  const rollups = payload.insightsRollups;
  if (payload.financialSpendAvailable === false) {
    items.push({ severity: "high", title: "Spend is not connected",
      description: "Spend is not configured for this campaign, so ROI/ROAS/CPA and spend-based KPIs/Benchmarks are blocked until a spend source is added.",
      recommendation: "Import spend to enable spend-based executive metrics.", category: "finance", dataBasis: "Connected-source revenue/spend totals", confidence: "High" });
  }
  if (financialRevenue < 0 || (payload.financialSpendAvailable && financialSpend < 0)) {
    for (const [name, value] of [["revenue", financialRevenue], ["spend", payload.financialSpendAvailable ? financialSpend : 0]] as const) {
      if (value >= 0) continue;
      items.push({ severity: "high", title: `Connected-source ${name} is negative`,
        description: `Connected-source ${name} is ${payload.formatMoney(value)}; it is not treated as zero.`,
        recommendation: "Verify refunds, credits, adjustments, and source signs before acting on financial metrics.", category: "finance", dataBasis: "Connected-source revenue/spend totals", confidence: "High" });
    }
  }
  if (payload.financialSpendAvailable && financialSpend > 0 && financialRevenue === 0) {
    items.push({
      severity: "high",
      title: "Spend without revenue",
      description: `Connected-source spend is ${payload.formatMoney(financialSpend)}, but connected-source revenue is ${payload.formatMoney(0)}.`,
      recommendation: "Validate revenue tracking and attribution for this campaign before increasing spend.",
      category: "finance",
      dataBasis: "Connected-source revenue/spend totals",
      confidence: "High",
    });
  }
  if (payload.insightsCurrentValuesVerified !== false && payload.financialSpendAvailable && financialSpend === 0 && financialRevenue > 0) {
    items.push({ severity: "medium", title: `Revenue exists, but connected-source spend is ${payload.formatMoney(0)}`,
      description: `Connected-source revenue is ${payload.formatMoney(financialRevenue)}, but connected-source spend is ${payload.formatMoney(0)}.`,
      recommendation: "Verify the connected spend source and reporting window before acting on ROI, ROAS, or CPA.",
      category: "finance", dataBasis: "Connected-source revenue/spend totals", confidence: "High" });
  }
  if (payload.insightsCurrentValuesVerified !== false && payload.financialSpendAvailable && financialSpend > 0 && financialRevenue > 0) {
    const roi = computeRoiPercent(financialRevenue, financialSpend);
    const roas = financialRevenue / financialSpend;
    if (roi !== null && roi < 0) items.push({ severity: roi <= -20 ? "high" : "medium", title: "ROI is negative to date",
      description: `ROI is ${roi.toFixed(2)}% for the connected-source financial window.`,
      recommendation: "Confirm revenue attribution, then review conversion rate, AOV, and spend allocation before judging performance.",
      category: "finance", dataBasis: "Connected-source revenue/spend totals", confidence: "High" });
    if (roas < 1) items.push({ severity: "medium", title: "ROAS is below 1.0x to date",
      description: `ROAS is ${roas.toFixed(2)}x for the connected-source financial window.`,
      recommendation: "Check the conversion funnel, traffic mix, revenue source, and campaign filter before treating ROAS as a performance diagnosis.",
      category: "finance", dataBasis: "Connected-source revenue/spend totals", confidence: "High" });
  }
  const trend = (severity: "high" | "medium" | "positive" | "info", title: string, description: string) => items.push({
    severity, title, description, category: "trends", dataBasis: "GA4 completed daily history", confidence: "Medium",
    recommendation: "Verify the daily import and compare traffic sources and conversion paths before changing campaign delivery.",
  });
  const sevenDayComparisonReady = rollups.last7.complete && rollups.prior7.complete;
  const shortComparisonReady = rollups.last3.complete && rollups.prior3.complete;
  if (sevenDayComparisonReady || shortComparisonReady) {
    const days = sevenDayComparisonReady ? 7 : 3;
    const current = sevenDayComparisonReady ? rollups.last7 : rollups.last3;
    const prior = sevenDayComparisonReady ? rollups.prior7 : rollups.prior3;
    const suffix = sevenDayComparisonReady ? "week-over-week" : "(3-day comparison)";
    const delta = (key: string) => prior[key] > 0 ? ((current[key] - prior[key]) / prior[key]) * 100 : 0;
    if (prior.cr > 0 && delta("cr") <= (sevenDayComparisonReady ? -15 : -25)) {
      trend(sevenDayComparisonReady ? "high" : "medium", `Conversion rate dropped ${Math.abs(delta("cr")).toFixed(1)}% ${suffix}`,
        `Last ${days}d ${Number(current.cr).toFixed(2)}% vs prior ${days}d ${Number(prior.cr).toFixed(2)}%.`);
    }
    if (prior.pvps > 0 && delta("pvps") <= (sevenDayComparisonReady ? -20 : -30)) {
      trend(sevenDayComparisonReady ? "medium" : "info", `Engagement depth decreased ${Math.abs(delta("pvps")).toFixed(1)}% ${suffix}`,
        `Pageviews/session last ${days}d ${Number(current.pvps).toFixed(2)} vs prior ${days}d ${Number(prior.pvps).toFixed(2)}.`);
    }
    const correlatedVolumeDrop = !sevenDayComparisonReady && prior.sessions > 0 && delta("sessions") <= -30 &&
      prior.revenue > 0 && delta("revenue") <= -35 && prior.conversions > 0 && delta("conversions") <= -30 && current.cr >= prior.cr;
    if (correlatedVolumeDrop) {
      trend("medium", "Traffic and revenue fell in the latest 3 days",
        `${current.startDate} to ${current.endDate}: ${payload.formatNumber(current.sessions)} sessions, ${formatConversionCredit(current.conversions)} conversions, ${payload.formatMoney(current.revenue)} native GA4 revenue. Prior ${prior.startDate} to ${prior.endDate}: ${payload.formatNumber(prior.sessions)} sessions, ${formatConversionCredit(prior.conversions)} conversions, ${payload.formatMoney(prior.revenue)} native GA4 revenue. Conversion rate was ${Number(current.cr).toFixed(2)}% vs ${Number(prior.cr).toFixed(2)}%.`);
    }
    for (const [key, label, threshold, shortThreshold, format] of [
      ["sessions", "Sessions", -20, -30, payload.formatNumber],
      ["revenue", "Revenue", -25, -35, payload.formatMoney],
      ["conversions", "Conversions", -20, -30, formatConversionCredit],
    ] as const) {
      if (!correlatedVolumeDrop && prior[key] > 0 && delta(key) <= (sevenDayComparisonReady ? threshold : shortThreshold)) {
        trend(sevenDayComparisonReady ? "high" : "medium", `${label} dropped ${Math.abs(delta(key)).toFixed(1)}% ${suffix}`,
          `Last ${days}d: ${format(current[key])} vs prior ${days}d: ${format(prior[key])}.`);
      }
    }
    for (const [key, label, threshold, minimum, format] of [
      ["sessions", "Sessions", sevenDayComparisonReady ? 15 : 25, sevenDayComparisonReady ? 50 : 20, payload.formatNumber],
      ["revenue", "Revenue", 20, 0, payload.formatMoney],
      ["conversions", "Conversions", 15, 5, formatConversionCredit],
    ] as const) {
      if ((sevenDayComparisonReady || key === "sessions") && prior[key] > minimum && delta(key) >= threshold) {
        trend("positive", `${label} up ${delta(key).toFixed(1)}% ${suffix}`, `Last ${days}d: ${format(current[key])} vs prior ${days}d: ${format(prior[key])}.`);
      }
    }
  } else {
    items.push({ severity: "info", title: "Trend signals need more history", category: "trends",
      dataBasis: "GA4 recorded completed daily history; missing dates are unavailable", confidence: "High",
      description: `Current 7-day window ${rollups.last7.startDate} to ${rollups.last7.endDate}: ${rollups.last7.days}/7 completed days. Prior 7-day window ${rollups.prior7.startDate} to ${rollups.prior7.endDate}: ${rollups.prior7.days}/7 completed days. Current 3-day window ${rollups.last3.startDate} to ${rollups.last3.endDate}: ${rollups.last3.days}/3 completed days. Prior window ${rollups.prior3.startDate} to ${rollups.prior3.endDate}: ${rollups.prior3.days}/3 completed days. Both adjacent calendar windows must be complete before comparisons run; ${rollups.availableDays} recorded campaign dates are available.`,
      recommendation: "Check the daily refresh. Comparisons require recorded data for every day in both windows." });
  }
  const unverifiedTargets: Array<{ name: string; detail: string; unavailable: boolean }> = [];
  const incompatibleTargets: string[] = [];
  for (const [entityLabel, targets] of [["KPI", payload.platformKPIs], ["Benchmark", payload.benchmarks]] as const) {
    for (const targetRow of Array.isArray(targets) ? targets : []) {
      const name = String(targetRow?.name || targetRow?.metric || entityLabel);
      const rawTarget = String(entityLabel === "KPI" ? targetRow?.targetValue ?? "" : targetRow?.benchmarkValue ?? "").replace(/,/g, "").trim();
      const target = Number(rawTarget);
      const identity = resolveGA4KpiMetricIdentity(targetRow?.metric, targetRow?.name);
      const invalid = !rawTarget || !Number.isFinite(target) ? `${entityLabel === "KPI" ? "Target" : "Benchmark"} value must be a valid number.`
        : target <= 0 ? `${entityLabel === "KPI" ? "Target" : "Benchmark"} value must be greater than 0.`
        : (identity === "conversion_rate" || identity === "engagement_rate") && target > 100 ? "Percentage rate targets cannot exceed 100%." : "";
      if (invalid) items.push({ severity: "high", title: `${entityLabel} configuration needs review: ${name}`,
        description: invalid, recommendation: `Edit the ${entityLabel} value before using this target for decisions.`,
        category: "setup", dataBasis: `Saved ${entityLabel} configuration`, confidence: "High" });
      if (payload.insightsCurrentValuesVerified === false) {
        unverifiedTargets.push({ name, detail: "Current target values lack a reconciled saved publication for this campaign and property.", unavailable: true });
        continue;
      }
      const sufficiency = (entityLabel === "KPI" ? resolveKpiDataSufficiency : resolveBenchmarkDataSufficiency)({
        metric: targetRow?.metric,
        name: targetRow?.name,
        sessions: Number(payload.breakdownTotals?.sessions || 0),
        conversions: Number(payload.financialConversions || 0),
        spend: Number(payload.financialSpend || 0),
      });
      const consumer = resolveGA4KpiConsumerState({ metric: targetRow?.metric, name: targetRow?.name, entityLabel,
        listState: "ready", trafficState: "ready", revenueState: "ready", financialConversionsState: "ready",
        spendState: payload.financialSpendAvailable === false ? "unavailable" : "ready",
        sufficiencyReason: sufficiency.sufficient ? null : sufficiency.reason });
      const rawCurrent = String(targetRow?.currentValue ?? "").replace(/,/g, "").trim();
      const current = Number(rawCurrent);
      if (!consumer.eligible || !rawCurrent || !Number.isFinite(current)) {
        unverifiedTargets.push({ name, detail: consumer.eligible ? "A required current value could not be verified." : consumer.detail,
          unavailable: consumer.code === "unavailable" || !rawCurrent || !Number.isFinite(current) });
        continue;
      }
      if (invalid) continue;
      const period = resolveGA4InsightTargetPeriodCompatibility(targetRow);
      if (!period.comparable) { incompatibleTargets.push(`${name} (${entityLabel === "KPI" ? "target" : "benchmark"} ${rawTarget})`); continue; }
      const unit = String(targetRow?.unit || "").trim();
      const formatValue = (value: number) => identity === "conversions" ? formatConversionCredit(value)
        : unit === "$" || unit.toUpperCase() === String(payload.currency || "").toUpperCase() ? payload.formatMoney(value)
        : `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}${unit === "%" ? "%" : unit === "ratio" || unit === "x" ? "x" : ""}`;
      if (entityLabel === "KPI") {
        const lowerIsBetter = isLowerIsBetterKpi({ metric: targetRow?.metric, name: targetRow?.name });
        const attainment = computeAttainmentPct({ current, target, lowerIsBetter });
        const improvement = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
        const priority = String(targetRow?.priority || "medium").trim().toLowerCase();
        const history = payload.insightsKpiHistory?.get(String(targetRow.id)) || [];
        const statusFor = (point: any) => computeProgress({ current: Number(point.value), target, lowerIsBetter }).status;
        const streak = history.length && statusFor(history[0]) !== "on_track"
          ? countGA4InsightsConsecutiveDays(history, (point: any) => point.recordedAt, (point: any) => statusFor(point) === statusFor(history[0])) : 0;
        const recent = history.filter((point: any) => new Date(point.recordedAt).getTime() >= Date.now() - 30 * 86400000);
        const earliest = Number(recent[recent.length - 1]?.value);
        const pct = recent.length >= 2 && earliest !== 0 ? (Number(recent[0].value) - earliest) / Math.abs(earliest) * 100 : null;
        const historyNote = `${streak > 1 ? ` Streak: ${streak} days.` : ""}${pct === null ? "" : Math.abs(pct) < 0.1 ? " Stable over recent period." : ` Trending ${pct > 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% over 30d.`}`;
        const ch = payload.insightsChannelAnalysis;
        const context = (identity === "conversions" || identity === "conversion_rate") && ch?.lowestCRChannel
          ? ` "${ch.lowestCRChannel.label}" has the lowest conversion rate (${ch.lowestCRChannel.cr.toFixed(1)}%) among significant channels; check targeting and landing pages for this source first.`
          : identity === "revenue" && ch?.topRevenueChannel ? ` "${ch.topRevenueChannel.label}" accounts for ${ch.topRevenueShare.toFixed(0)}% of native GA4 revenue in the imported 30-day window; check that channel first.`
          : ["sessions", "users", "pageviews"].includes(String(identity)) && ch?.topSessionChannel ? ` "${ch.topSessionChannel.label}" accounts for ${ch.topSessionShare.toFixed(0)}% of sessions; check whether its volume or quality changed.` : "";
        if (attainment !== null && attainment < 100) items.push({
          severity: priority === "high" || priority === "critical" ? "high" : priority === "low" ? "info" : "medium",
          title: `${name} ${lowerIsBetter ? "Above" : "Below"} Saved Target`,
          description: `${period.currentWindow}: Current ${formatValue(current)} vs target ${formatValue(target)} (${attainment.toFixed(1)}% progress).${historyNote}`,
          recommendation: "Review the traffic, conversion, revenue and spend inputs relevant to this KPI before changing campaign delivery." + context,
          category: "targets", dataBasis: "Saved KPI target + current values", confidence: "Medium" });
        if (improvement !== null && improvement >= 10) items.push({ severity: "positive", title: `${name} outperforms target by ${improvement.toFixed(0)}%`,
          description: `${period.currentWindow}: Current ${formatValue(current)} vs target ${formatValue(target)}.`,
          recommendation: "Review whether the target should be raised before changing budget allocation.",
          category: "context", dataBasis: "Saved KPI target + current values", confidence: "Medium" });
        continue;
      }
      const threshold = computeBenchmarkThresholdResult({
        metric: targetRow?.metric,
        name: targetRow?.name,
        unit: targetRow?.unit,
        current,
        benchmarkValue: target,
      });
      if (threshold.status !== "behind" && threshold.status !== "needs_attention") continue;
      const history = payload.insightsBenchmarkHistory?.get(String(targetRow.id)) || [];
      const recent = history.slice(-3);
      const improving = recent.length >= 2 && recent.every((point: any, index: number) => index === 0 || Number(point.variance) >= Number(recent[index - 1].variance));
      const declining = recent.length >= 2 && recent.every((point: any, index: number) => index === 0 || Number(point.variance) <= Number(recent[index - 1].variance));
      const average = history.length ? history.reduce((sum: number, point: any) => sum + Number(point.variance), 0) / history.length : 0;
      const historyNote = `${history.length >= 2 ? ` Trend ${improving ? "improving" : declining ? "declining" : "neutral"}.` : ""}${average ? ` Avg variance ${average.toFixed(1)}%.` : ""}`;
      const ch = payload.insightsChannelAnalysis;
      const context = (identity === "conversions" || identity === "conversion_rate") && ch?.lowestCRChannel
        ? ` "${ch.lowestCRChannel.label}" has the lowest conversion rate (${ch.lowestCRChannel.cr.toFixed(1)}%); check this source first.`
        : identity === "revenue" && ch?.topRevenueChannel ? ` "${ch.topRevenueChannel.label}" accounts for ${ch.topRevenueShare.toFixed(0)}% of native GA4 revenue in the imported 30-day window; check changes there first.`
        : identity !== "engagement_rate" && ch?.topSessionChannel ? ` Top traffic source: "${ch.topSessionChannel.label}" (${ch.topSessionShare.toFixed(0)}% of sessions).` : "";
      items.push({
        severity: threshold.status === "behind" ? "high" : "medium",
        title: `${name} ${threshold.status === "behind" ? "Behind Benchmark" : "Below Benchmark"}`,
        description: `${period.currentWindow}: Current ${formatValue(current)} vs benchmark ${formatValue(target)} (${threshold.labelPct}% to benchmark).${historyNote}`,
        recommendation: "Review the campaign inputs behind this Benchmark before changing budget, creative, or landing pages." + context,
        category: "targets",
        dataBasis: "Saved Benchmark + current values",
        confidence: "Medium",
      });
    }
  }
  if (incompatibleTargets.length > 0) items.push({ severity: "medium", title: "Target reporting periods need review",
    description: `A matching reporting window cannot be verified for: ${incompatibleTargets.join(", ")}.`,
    recommendation: "Compare each saved target only with a value calculated for the same reporting period.",
    category: "setup", dataBasis: "Saved target period + current-value reporting window", confidence: "High" });
  if (unverifiedTargets.length > 0) items.push({ severity: unverifiedTargets.some(item => item.unavailable) ? "high" : "medium",
    title: `${unverifiedTargets.length} saved target evaluation${unverifiedTargets.length === 1 ? "" : "s"} withheld`,
    description: `${Array.from(new Set(unverifiedTargets.map(item => item.detail))).join(" ")} Affected saved targets: ${unverifiedTargets.map(item => item.name).join(", ")}.`,
    recommendation: "Resolve the stated data condition before using these targets for decisions.",
    category: "setup", dataBasis: "Required source state + saved KPI/Benchmark configuration", confidence: "High" });
  if (payload.insightsHistoryFailures?.length) items.push({ severity: "high", title: `${payload.insightsHistoryFailures.join(" and ")} trend history is unavailable`,
    description: "The scoped analytics history request failed, so affected streak and trend context is withheld. Current target checks are shown separately.",
    recommendation: "Retry the report after verifying access to the affected analytics history.", category: "setup", dataBasis: "Scoped KPI/Benchmark history", confidence: "High" });
  const channel = payload.insightsChannelAnalysis;
  if (rollups.last7.complete && channel?.channelCount >= 2 && channel.topSessionShare > 70) items.push({ severity: "info",
    title: `Top channel: ${channel.topSessionChannel.label} (${channel.topSessionShare.toFixed(0)}% of sessions)`,
    description: `${channel.topSessionChannel.label} supplied ${payload.formatNumber(channel.topSessionChannel.sessions)} sessions across ${channel.channelCount} channels in the imported 30-day window. Traffic is concentrated in this source.`,
    recommendation: `Check whether changes to ${channel.topSessionChannel.label} explain the campaign's traffic movement before shifting spend to other sources.`,
    category: "context", dataBasis: "Reconciled native GA4 channel data", confidence: "Medium" });
  if (items.length === 0) {
    items.push({
      severity: "info",
      title: "No findings from the report checks",
      description: "No KPI, trend or Benchmark threshold was triggered by the available report inputs. This does not establish that every Insights check is clear.",
      recommendation: "Continue monitoring the main revenue, traffic, and conversion inputs for this campaign.",
      category: "context",
      dataBasis: "Current campaign data",
      confidence: "Medium",
    });
  }
  const order = { high: 0, medium: 1, positive: 2, info: 2 };
  const categoryOrder = { setup: 0, finance: 1, targets: 2, trends: 3, context: 4 };
  return items.sort((a, b) => order[a.severity] - order[b.severity] || categoryOrder[a.category] - categoryOrder[b.category]);
};

const buildInsightsActionDescription = (availableDays: number) => {
  const days = Math.max(0, Number(availableDays || 0));
  const dayLabel = `${days} completed GA4 day${days === 1 ? "" : "s"}`;
  if (days < 6) {
    return `Only ${dayLabel} available. Trend and anomaly checks need at least 6 days; financial setup and saved-target checks still run.`;
  }
  if (days < 14) {
    return `${dayLabel} available. Trend checks require consecutive recorded dates; a 7-day comparison needs two complete adjacent windows.`;
  }
  return `${dayLabel} available. Comparisons are shown only for complete adjacent windows; missing dates are unavailable. KPI and Benchmark performance are checked separately.`;
};

async function buildGA4ReportPayload(report: any) {
  const campaignId = String(report?.campaignId || "").trim();
  if (!campaignId) throw new Error("GA4_REPORT_CAMPAIGN_REQUIRED");
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) throw new Error("CAMPAIGN_NOT_FOUND");
  const connection = await choosePrimaryConnection(campaignId);
  const propertyId = String(connection.propertyId);
  const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
  const importedCampaignNames = new Set(
    (Array.isArray(campaignFilter) ? campaignFilter : campaignFilter ? [campaignFilter] : [])
      .map(normalizeCampaignKey)
      .filter(Boolean),
  );
  const overviewRequirements = getOverviewReportRequirements(report);
  if (overviewRequirements.campaignBreakdown && importedCampaignNames.size === 0) {
    throw new Error("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Campaign Breakdown");
  }
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
  if (adComparisonRequirements.included && importedCampaignNames.size === 0) {
    throw new Error('GA4_AD_COMPARISON_REPORT_INPUT_UNAVAILABLE: Campaign scope');
  }
  const adComparisonWindow = adComparisonRequirements.included
    ? reportCumulativeWindow
    : null;
  if (adComparisonRequirements.included && !adComparisonWindow) {
    throw new Error('GA4_AD_COMPARISON_IMPORT_WINDOW_UNAVAILABLE');
  }
  const includesInsights = String(report?.reportType).toLowerCase() === "insights" ||
    (String(report?.reportType).toLowerCase() === "custom" && normalizeCustomReportConfig(parseReportConfiguration(report?.configuration)).sections.insights);
  const reportingWindow = getReportingDateWindow(includesInsights ? 60 : lookbackDays, (campaign as any)?.reportingTimeZone);
  const financialStartDate = reportCumulativeWindow.startDate;
  const financialEndDate = reportCumulativeWindow.endDate;
  const spendSourceStartDate = "1900-01-01";
  const importedRevenueStartDate = "1900-01-01";
  const importedRevenueEndDate = financialEndDate;
  const dailyStart = reportingWindow.startDate;
  const dailyEnd = reportingWindow.endDate;
  const overviewStartDate = reportCumulativeWindow.startDate;
  const useSavedOverview = importedCampaignNames.size > 0 && propertyId.toLowerCase() !== "yesop";
  const savedOverview: any = useSavedOverview ? await storage.getGA4OverviewSnapshot(campaignId, propertyId) : null;
  if (useSavedOverview && (!savedOverview || savedOverview.campaignId !== campaignId || savedOverview.propertyId !== propertyId ||
      savedOverview.windowStart !== overviewStartDate || savedOverview.windowEnd !== financialEndDate ||
      String((savedOverview.campaignBreakdown as any)?.meta?.currencyCode || "").toUpperCase() !== campaignCurrency)) {
    throw new Error("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Saved publication");
  }
  const failedParts = new Set<string>();
  const logPartFailure = (label: string, error: any) => {
    failedParts.add(label);
    console.warn(`[GA4 Scheduled PDF] ${label} failed; checking persisted fallback:`, error?.message || error);
  };
  if (useSavedOverview && !savedOverview!.landingPages) failedParts.add("landing pages");
  if (useSavedOverview && !savedOverview!.conversionEvents) failedParts.add("conversion events");
  const benchmarkStorage = storage as typeof storage & {
    getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<any[]>;
  };
  const loadPlatformKPIs = reportIncludesKPISection(report)
    ? storage.getPlatformKPIs("google_analytics", campaignId)
    : storage.getPlatformKPIs("google_analytics", campaignId).catch(() => [] as any[]);
  const loadPlatformBenchmarks = reportIncludesBenchmarkSection(report)
    ? benchmarkStorage.getPlatformBenchmarks("google_analytics", campaignId)
    : benchmarkStorage.getPlatformBenchmarks("google_analytics", campaignId).catch(() => [] as any[]);

  const [metrics, breakdownTraffic, adComparisonBreakdown, landingPages, conversionEvents, timeSeries, revenueSources, spendSources, revenueBreakdown, adComparisonRevenueBreakdown, spendBreakdown, platformKPIs, benchmarks] = await Promise.all([
    useSavedOverview ? Promise.resolve({}) : ga4Service.getMetricsWithAutoRefresh(campaignId, storage, reportLookbackRange, propertyId, campaignFilter).catch((e) => { logPartFailure("metrics", e); return {} as any; }),
    useSavedOverview ? Promise.resolve(savedOverview!.campaignBreakdown) : ga4Service.getAcquisitionBreakdown(campaignId, storage, overviewStartDate, propertyId, 2000, campaignFilter, dailyEnd, false, false, campaignCurrency, true).catch((e) => { logPartFailure("acquisition breakdown", e); return { rows: [] }; }),
    adComparisonRequirements.nativeDetail && adComparisonWindow
      ? useSavedOverview ? Promise.resolve(savedOverview!.campaignBreakdown) : ga4Service.getAcquisitionBreakdown(
          campaignId, storage, adComparisonWindow.startDate, propertyId, 2000, campaignFilter,
          adComparisonWindow.endDate, false, false, campaignCurrency, true,
        )
          .catch((e) => { logPartFailure("ad comparison breakdown", e); return { rows: [] }; })
      : Promise.resolve({ rows: [] }),
    useSavedOverview ? Promise.resolve(savedOverview!.landingPages) : ga4Service.getLandingPagesReport(campaignId, storage, overviewStartDate, propertyId, 50, campaignFilter, dailyEnd).catch((e) => { logPartFailure("landing pages", e); return { rows: [] }; }),
    useSavedOverview ? Promise.resolve(savedOverview!.conversionEvents) : ga4Service.getConversionEventsReport(campaignId, storage, overviewStartDate, propertyId, 50, campaignFilter, dailyEnd).catch((e) => { logPartFailure("conversion events", e); return { rows: [] }; }),
    useSavedOverview ? Promise.resolve([]) : ga4Service.getTimeSeriesData(campaignId, storage, dailyStart, propertyId, campaignFilter).catch((e) => { logPartFailure("time series", e); return []; }),
    storage.getRevenueSources(campaignId, "ga4").catch((e) => { logPartFailure("revenue sources", e); return [] as any[]; }),
    storage.getSpendSources(campaignId, "ga4").catch((e) => { logPartFailure("spend sources", e); return [] as any[]; }),
    storage.getRevenueBreakdownBySource(campaignId, importedRevenueStartDate, importedRevenueEndDate, "ga4").catch((e) => { logPartFailure("revenue breakdown", e); return [] as any[]; }),
    adComparisonRequirements.revenueBreakdown && adComparisonWindow
      ? storage.getRevenueBreakdownBySource(campaignId, importedRevenueStartDate, importedRevenueEndDate, "ga4")
          .catch((e) => { logPartFailure("ad comparison revenue breakdown", e); return [] as any[]; })
      : Promise.resolve([] as any[]),
    storage.getSpendBreakdownBySource(campaignId, spendSourceStartDate, financialEndDate, "ga4").catch((e) => { logPartFailure("spend breakdown", e); return [] as any[]; }),
    loadPlatformKPIs,
    loadPlatformBenchmarks,
  ]);

  const ga4ToDate = useSavedOverview ? { totals: savedOverview!.campaignBreakdown?.totals, revenueMetric: savedOverview!.campaignBreakdown?.meta?.revenueMetric } : await withTokenRefresh(connection, async (token) => {
    return await ga4Service.getTotalsWithRevenue(propertyId, token, financialStartDate, financialEndDate, campaignFilter, campaignCurrency);
  }).catch((e) => {
    logPartFailure("totals with revenue", e);
    return { totals: {} };
  });
  const nativeCampaignRevenueBreakdown = useSavedOverview ? savedOverview!.campaignBreakdown : await ga4Service.getAcquisitionBreakdown(
    campaignId, storage, financialStartDate, propertyId, 2000, campaignFilter,
    financialEndDate, false, false, campaignCurrency, true,
  ).catch((error) => {
    logPartFailure("campaign revenue breakdown", error);
    return { rows: [] } as any;
  });
  let breakdown: any = breakdownTraffic;
  try {
    const selectedCampaignNames = (Array.isArray(campaignFilter) ? campaignFilter : campaignFilter ? [campaignFilter] : [])
      .map((name) => String(name || "").trim()).filter(Boolean);
    const rows = mergeGA4OverviewCampaignRevenueRows((breakdownTraffic as any)?.rows, (nativeCampaignRevenueBreakdown as any)?.rows, selectedCampaignNames);
    // The merge above validates campaign scope but rounds display rows; reconcile raw amounts.
    const rowRevenue = Number(((nativeCampaignRevenueBreakdown as any)?.rows || []).reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0).toFixed(2));
    const providerRevenue = Number(Number((nativeCampaignRevenueBreakdown as any)?.totals?.revenue || 0).toFixed(2));
    // Keep Campaign Breakdown validation independent from protected report totals.
    if (Math.abs(rowRevenue - providerRevenue) >= 0.01) {
      throw new Error("GA4_OVERVIEW_CAMPAIGN_REVENUE_UNVERIFIED");
    }
    breakdown = { ...breakdownTraffic, rows, totals: { ...(breakdownTraffic as any)?.totals, revenue: providerRevenue } };
  } catch (error) {
    logPartFailure("campaign revenue breakdown", error);
  }

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
  let activeRevenueSources = revenueSources.filter((source: any) => source?.isActive !== false);
  const hasMaterializedRevenue = (row: any) => row?.revenue != null && Number.isFinite(Number(row.revenue));
  const revenueBreakdownSourceIds = new Set(revenueBreakdown.filter(hasMaterializedRevenue).map((row: any) => String(row?.sourceId || "")));
  const adComparisonRevenueBreakdownSourceIds = new Set(adComparisonRevenueBreakdown.filter(hasMaterializedRevenue).map((row: any) => String(row?.sourceId || "")));
  if (activeRevenueSources.some((source: any) => !revenueBreakdownSourceIds.has(String(source.id)))) {
    // A valid source containing only later sales contributes nothing yet. Missing
    // materialization still blocks the report; source connection dates do not.
    const afterCutoff = new Date(Date.parse(financialEndDate) + 86400000).toISOString().slice(0, 10);
    const futureRevenue = await storage.getRevenueBreakdownBySource(campaignId, afterCutoff, "2999-12-31", "ga4")
      .catch((e) => { logPartFailure("future revenue materialization", e); return [] as any[]; });
    const futureSourceIds = new Set(futureRevenue.filter(hasMaterializedRevenue).map((row: any) => String(row.sourceId)));
    activeRevenueSources = activeRevenueSources.filter((source: any) => revenueBreakdownSourceIds.has(String(source.id)) || !futureSourceIds.has(String(source.id)));
  }
  const overviewMaterializedRevenueUnavailable = activeRevenueSources.some(
    (source: any) => !revenueBreakdownSourceIds.has(String(source?.id || "")),
  );
  const campaignBreakdownRevenueBySourceId = new Map(
    revenueBreakdown.map((row: any) => [String(row?.sourceId || ""), row?.revenue]),
  );
  const campaignBreakdownRevenueSources = activeRevenueSources.map((source: any) => ({
    ...source,
    sourceId: String(source?.id || ""),
    revenue: campaignBreakdownRevenueBySourceId.has(String(source?.id || ""))
      ? campaignBreakdownRevenueBySourceId.get(String(source?.id || ""))
      : null,
  }));
  const campaignBreakdownRevenueResolution = resolveExactGA4CampaignBreakdownRevenue(
    Array.from(importedCampaignNames).map((name) => ({ name })),
    campaignBreakdownRevenueSources,
    campaignCurrency,
  );
  const overviewCampaignBreakdownMaterializedRevenueUnavailable =
    campaignBreakdownRevenueResolution.ambiguous || campaignBreakdownRevenueResolution.currencyMismatch ||
    campaignBreakdownRevenueResolution.materializationMismatch || activeRevenueSources.some((source: any) =>
      campaignBreakdownRevenueResolution.mappedSourceIds.has(String(source?.id || "")) &&
      !revenueBreakdownSourceIds.has(String(source?.id || "")));
  const adComparisonMaterializedRevenueUnavailable = activeRevenueSources.some(
    (source: any) => !adComparisonRevenueBreakdownSourceIds.has(String(source?.id || "")),
  );
  const hasImportedRevenueSource = activeRevenueSources.length > 0 || revenueBreakdown.length > 0;
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
  if (overviewRequirements.campaignBreakdown && (
    failedParts.has("acquisition breakdown") ||
    failedParts.has("campaign revenue breakdown") ||
    failedParts.has("revenue sources") ||
    overviewCampaignBreakdownMaterializedRevenueUnavailable
  )) {
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
  if (adComparisonRequirements.topCampaigns && (
    failedParts.has('acquisition breakdown') || failedParts.has('campaign revenue breakdown') ||
    failedParts.has('revenue sources') || failedParts.has('revenue breakdown') ||
    overviewCampaignBreakdownMaterializedRevenueUnavailable
  )) {
    unavailableAdComparisonParts.push('GA4 Overview Campaign Breakdown');
  }
  if (adComparisonRequirements.revenueBreakdown && adComparisonMaterializedRevenueUnavailable) {
    unavailableAdComparisonParts.push('Imported revenue provenance');
  }
  if (
    adComparisonRequirements.nativeDetail &&
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
  const latestOverview = useSavedOverview ? await storage.getGA4OverviewSnapshot(campaignId, propertyId) : null;
  if (useSavedOverview && (failedParts.has("persisted daily metrics") || failedParts.has("persisted Overview Summary metrics") ||
      !latestOverview || String(latestOverview.updatedAt) !== String(savedOverview!.updatedAt) ||
      overviewDailyRows.length !== (Date.parse(financialEndDate) - Date.parse(overviewStartDate)) / 86400000 + 1 ||
      new Set(overviewDailyRows.map((row: any) => String(row.date))).size !== overviewDailyRows.length ||
      overviewDailyRows.some((row: any) => String(row.date) < overviewStartDate || String(row.date) > financialEndDate) ||
      overviewSummedTotals.sessions !== Number((savedOverview!.campaignBreakdown as any)?.totals?.sessions) ||
      !conversionCreditsMatch(overviewSummedTotals.conversions, Number((savedOverview!.campaignBreakdown as any)?.totals?.conversions), overviewDailyRows.length))) {
    throw new Error("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Daily publication changed");
  }

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
  const reportType = String(report?.reportType || "overview").toLowerCase();
  const reportConfig = typeof report?.configuration === "string" ? JSON.parse(report.configuration || "{}") : report?.configuration || {};
  const financialTarget = (item: any) => ["revenue", "roas", "roi", "cpa"].includes(resolveGA4KpiMetricIdentity(item?.metric, item?.name) || "");
  const includesFinancialTarget = (reportIncludesKPISection(report) && platformKPIs.some((item: any) => financialTarget(item) &&
    (reportType !== "custom" || reportConfig.selectedKpiIds?.includes(String(item.id))))) ||
    (reportIncludesBenchmarkSection(report) && benchmarks.some((item: any) => financialTarget(item) &&
      (reportType !== "custom" || reportConfig.selectedBenchmarkIds?.includes(String(item.id)))));
  const needsFinancialPublication = overviewRequirements.revenue || overviewRequirements.spend || adComparisonRequirements.revenueBreakdown ||
    includesFinancialTarget || reportType === "insights" || (reportType === "custom" && reportConfig.sections?.insights);
  let publishedFinancialInputs: any = null;
  if (useSavedOverview && needsFinancialPublication) {
    const published = await storage.getLatestFinancialDailySnapshot(campaignId, financialEndDate);
    const parsed = financialDailySnapshotInputSchema.safeParse({ campaignId: published?.campaignId, reportingDate: published?.reportingDate, ...(published?.metrics as any)?.financialDaily });
    if (!parsed.success || parsed.data.campaignId !== campaignId || parsed.data.reportingDate !== financialEndDate ||
        parsed.data.currency !== campaignCurrency || parsed.data.currentValueWindow.startDate !== financialStartDate ||
        parsed.data.currentValueWindow.reportingTimeZone !== reportCumulativeWindow.reportingTimeZone ||
        overviewMaterializedRevenueUnavailable || failedParts.has("revenue sources") || failedParts.has("revenue breakdown") || failedParts.has("spend sources") || failedParts.has("spend breakdown") ||
        [...activeRevenueSources, ...spendSources.filter((source: any) => source?.isActive !== false)].some((source: any) => String(source?.currency || "").trim().toUpperCase() !== campaignCurrency) ||
        !parsed.data.inputs.revenue.available || Number(parsed.data.inputs.revenue.value) !== financialRevenue ||
        !parsed.data.inputs.conversions.available || Number(parsed.data.inputs.conversions.value) !== financialConversions ||
        (parsed.data.inputs.spend.available ? Number(parsed.data.inputs.spend.value) !== financialSpend : financialSpend !== 0)) {
      throw new Error("GA4_OVERVIEW_REPORT_INPUT_UNAVAILABLE: Financial publication changed");
    }
    publishedFinancialInputs = parsed.data.inputs;
  }
  const reportCurrentValue = (item: any) => useSavedOverview ? { ...item, currentValue:
    publishedFinancialInputs?.spend.available === false && ["roas", "roi", "cpa"].includes(resolveGA4KpiMetricIdentity(item?.metric, item?.name) || "") ? "Unavailable" : resolveGA4KpiLiveValue({
    kpi: item, breakdownTotals: { ...breakdownTotals, pageviews: overviewSummedTotals.pageviews }, overviewEngagementRate: overviewSummedTotals.engagementRate,
    financialRevenue, financialSpend, financialROI, financialCPA,
  }) } : item;

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

  const byCampaign = new Map<string, { name: string; sessions: number; users: number; conversions: number; revenue: number; sessionKeyEventRateWeighted: number }>();
  for (const row of Array.isArray((breakdown as any)?.rows) ? (breakdown as any).rows : []) {
    const name = String((row as any)?.campaign || "(not set)").trim();
    const current = byCampaign.get(name) || { name, sessions: 0, users: 0, conversions: 0, revenue: 0, sessionKeyEventRateWeighted: 0 };
    const rowSessions = Number((row as any)?.sessions || 0);
    const rowRate = Number((row as any)?.sessionKeyEventRate);
    if (rowSessions > 0 && ((row as any)?.sessionKeyEventRate == null || !Number.isFinite(rowRate) || rowRate < 0 || rowRate > 1)) {
      throw new Error("GA4_SESSION_KEY_EVENT_RATE_UNVERIFIED");
    }
    current.sessions += Number((row as any)?.sessions || 0);
    current.users += Number((row as any)?.users || 0);
    current.conversions += Number((row as any)?.conversions || 0);
    current.revenue += Number((row as any)?.revenue || 0);
    current.sessionKeyEventRateWeighted += rowSessions * (rowSessions > 0 ? rowRate : 0);
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
        conversionRate: sessions > 0 ? (row.sessionKeyEventRateWeighted / sessions) * 100 : 0,
        revenuePerSession: sessions > 0 ? revenue / sessions : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const campaignBreakdownMatchedExternalRevenue = resolveExactGA4CampaignBreakdownRevenue(
    campaignBreakdownAgg,
    revenueDisplaySources,
    campaignCurrency,
  ).revenueByCampaign;

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
        revenue: Number(row.revenue || 0),
        conversionRate: sessions > 0 ? (conversions / sessions) * 100 : 0,
        revenuePerSession: sessions > 0 ? revenue / sessions : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);

  const sourceRevenueBreakdowns = new Map<string, any[]>(
    revenueDisplaySources.map((source: any) => {
      const cfg = parseMappingConfig(source?.mappingConfig);
      const totals = Array.isArray(cfg?.campaignValueRevenueTotals)
        ? cfg.campaignValueRevenueTotals.filter(
            (item: any) => item?.revenue != null && Number.isFinite(Number(item.revenue)),
          )
        : [];
      return [String(source?.sourceId || ""), source?.revenue != null &&
        Number(totals.reduce((sum: number, item: any) => sum + Number(item.revenue), 0).toFixed(2)) === Number(source.revenue) ? totals : []];
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
      return [String(source?.sourceId || ""), source?.revenue != null &&
        Number(totals.reduce((sum: number, item: any) => sum + Number(item.revenue), 0).toFixed(2)) === Number(source.revenue) ? totals : []];
    })
  );
  const created = new Date((campaign as any)?.createdAt || "");
  const createdParts = Number.isFinite(created.getTime()) ? Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: reportingWindow.reportingTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(created).map(part => [part.type, part.value])) : null;
  const campaignHistoryStart = createdParts ? `${createdParts.year}-${createdParts.month}-${createdParts.day}` : "";
  const insightsRollups = buildTrendRollups(dailyRows.filter((row: any) => campaignHistoryStart && String(row.date) >= campaignHistoryStart), reportingWindow.dataThroughDate);
  const insightsKpiHistory = new Map<string, any[]>(), insightsBenchmarkHistory = new Map<string, any[]>();
  const insightsHistoryFailures: string[] = [];
  let insightsChannelAnalysis: any = null;
  if (reportIncludesInsightsActions(report) && useSavedOverview && publishedFinancialInputs) {
    const marker = buildGA4InsightsHistoryScopeMarker(propertyId, campaignFilter, reportingWindow.reportingTimeZone, campaignCurrency);
    const failures = new Set<string>();
    await Promise.all([
      ...platformKPIs.map(async (target: any) => {
        try {
          const history = filterGA4InsightsHistoryByScope(await storage.getKPIProgress(target.id), marker)
            .filter(point => point.kpiId === target.id && Number.isFinite(new Date(point.recordedAt).getTime()) && new Date(point.recordedAt).toISOString().slice(0, 10) <= dailyEnd && String(point.value ?? "").trim() !== "" && Number.isFinite(Number(point.value)));
          insightsKpiHistory.set(String(target.id), history);
        } catch { failures.add("KPI"); }
      }),
      ...benchmarks.map(async (target: any) => {
        try {
          const history = filterGA4InsightsHistoryByScope(await storage.getBenchmarkHistory(target.id), marker)
            .filter(point => point.benchmarkId === target.id && Number.isFinite(new Date(point.recordedAt).getTime()) && new Date(point.recordedAt).toISOString().slice(0, 10) <= dailyEnd && String(point.variance ?? "").trim() !== "" && Number.isFinite(Number(point.variance)));
          insightsBenchmarkHistory.set(String(target.id), history);
        } catch { failures.add("Benchmark"); }
      }),
    ]);
    insightsHistoryFailures.push(...["KPI", "Benchmark"].filter(label => failures.has(label)));
    try {
      const window = insightsRollups.last30;
      const breakdown = await ga4Service.getAcquisitionBreakdown(campaignId, storage, window.startDate!, propertyId, 2000, campaignFilter, window.endDate!, true, true, campaignCurrency);
      const rows = filterGA4InsightsBreakdownRowsToImportedDates(breakdown.rows, dailyRows, window.startDate, window.endDate);
      const channels = new Map<string, { label: string; sessions: number; conversions: number; revenue: number }>();
      for (const row of rows) {
        const label = `${String(row.source || "(direct)").trim()} / ${String(row.medium || "(none)").trim()}`;
        const channel = channels.get(label) || { label, sessions: 0, conversions: 0, revenue: 0 };
        for (const key of ["sessions", "conversions", "revenue"] as const) {
          if (row[key] == null || !Number.isFinite(Number(row[key])) || (key !== "revenue" && Number(row[key]) < 0)) throw new Error("Unverified channel values");
          channel[key] += Number(row[key]);
        }
        channels.set(label, channel);
      }
      const values = Array.from(channels.values());
      const sessions = values.reduce((sum, row) => sum + row.sessions, 0), conversions = values.reduce((sum, row) => sum + row.conversions, 0), revenue = values.reduce((sum, row) => sum + row.revenue, 0);
      if (String(breakdown.meta?.propertyId).replace(/^properties\//, "") === propertyId.replace(/^properties\//, "") && breakdown.meta?.currencyCode === campaignCurrency && sessions > 0 && sessions === window.sessions && conversionCreditsMatch(conversions, window.conversions, rows.length + dailyRows.length) && Math.abs(revenue - window.revenue) < 0.005) {
        const topSessionChannel = [...values].sort((a, b) => b.sessions - a.sessions)[0];
        const topRevenueChannel = revenue > 0 ? [...values].sort((a, b) => b.revenue - a.revenue)[0] : null;
        insightsChannelAnalysis = { channelCount: values.length, topSessionChannel, topSessionShare: topSessionChannel.sessions / sessions * 100,
          topRevenueChannel, topRevenueShare: topRevenueChannel ? topRevenueChannel.revenue / revenue * 100 : 0,
          lowestCRChannel: selectUniqueLowestGA4InsightsConversionRateChannel(values.filter(row => row.sessions >= sessions * 0.05).map(row => ({ ...row, cr: row.conversions / row.sessions * 100 }))) };
      }
    } catch (error) { console.warn("[GA4 Scheduled PDF] Optional Insights channel context unavailable:", (error as Error)?.message); }
  }
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
    platformKPIs: Array.isArray(platformKPIs) ? platformKPIs.map(reportCurrentValue) : [],
    benchmarks: Array.isArray(benchmarks) ? benchmarks.map(reportCurrentValue) : [],
    insightsCurrentValuesVerified: useSavedOverview && Boolean(publishedFinancialInputs),
    financialSpendAvailable: publishedFinancialInputs ? publishedFinancialInputs.spend.available : true,
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
    insightsKpiHistory,
    insightsBenchmarkHistory,
    insightsHistoryFailures,
    insightsChannelAnalysis,
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

  const paintPage = () => {
    doc.setFillColor(...COLORS.background);
    doc.rect(0, 0, PW, 297, "F");
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 0, PW, 4, "F");
  };
  const checkPage = (need: number) => {
    if (y + need > 274) {
      addFooter();
      doc.addPage();
      paintPage();
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
  const sectionTitle = (title: string, _color: C3, keepWithNext = 0) => {
    checkPage(18 + keepWithNext);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(title, MX, y + 9);
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
    const columnWidths = widths.map(width => width * CW / widths.reduce((sum, value) => sum + value, 0));
    const fullHeight = 18 + (note ? 6 : 0) + 10 + rows.length * 8 + 4;
    if (fullHeight <= 250 && y + fullHeight > 274) {
      addFooter();
      doc.addPage();
      paintPage();
      y = 18;
    }
    sectionTitle(title, color);
    if (note) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.textSec);
      const noteLines = doc.splitTextToSize(note, CW);
      doc.text(noteLines, MX, y + 2);
      y += noteLines.length * 3.5 + 3;
    }
    const tableHeader = () => {
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    const labels = headers.map((header, idx) => doc.splitTextToSize(header, columnWidths[idx] - 8) as string[]);
    const headerHeight = Math.max(...labels.map(lines => lines.length)) * 3.2 + 5;
    doc.setFillColor(...COLORS.cardBg);
    doc.roundedRect(MX, y, CW, headerHeight, 2, 2, "F");
    doc.setTextColor(...COLORS.textTert);
    let x = MX;
    labels.forEach((lines, idx) => {
      doc.text(lines, idx === 0 ? x + 4 : x + columnWidths[idx] - 4, y + 5.5, idx === 0 ? undefined : { align: "right" });
      x += columnWidths[idx];
    });
    y += headerHeight + 2;
    };
    tableHeader();
    rows.forEach((row) => {
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      const cells = row.map((cell, idx) => doc.splitTextToSize(cell, columnWidths[idx] - 8) as string[]);
      const rowHeight = Math.max(...cells.map(lines => lines.length)) * 3.5 + 5;
      if (y + rowHeight > 274) { checkPage(rowHeight); tableHeader(); }
      doc.setDrawColor(...COLORS.divider);
      doc.setLineWidth(0.2);
      doc.line(MX, y - 1.5, MX + CW, y - 1.5);
      let colX = MX;
      cells.forEach((cell, idx) => {
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.text);
        doc.text(cell, idx === 0 ? colX + 4 : colX + columnWidths[idx] - 4, y + 3.5, idx === 0 ? undefined : { align: "right" });
        colX += columnWidths[idx];
      });
      y += rowHeight;
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
      doc.text(tickValue.toLocaleString(undefined, { maximumFractionDigits: 1 }), innerX - 2, py + 1.4, { align: "right" });
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

  paintPage();
  const reportLogo = getMimoSaaSReportLogo();
  if (reportLogo) (doc as any).addImage?.(reportLogo, "JPEG", PW - MX - 42, 7, 42, 26.5);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(String(reportName || report?.name || "GA4 Report").slice(0, 45), MX, 22, { maxWidth: CW - 50 });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.textSec);
  doc.text("GA4 Analytics Report", MX, 30);
  y = 38;
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.textSec);
  const standaloneAdComparison = reportType === "ads";
  const propertyIdLabel = String(payload.connection?.propertyId || "").replace(/^properties\//, "");
  const propertyNameLabel = String(payload.connection?.displayName || payload.connection?.propertyName || "");
  const campaignFilterLabel = String((payload.campaign as any)?.ga4CampaignFilter || "").trim();
  const metadata = [
    [`Campaign: ${String(campaignName || (payload.campaign as any)?.name || "—")}`, `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`],
    [standaloneAdComparison ? `Property: ${propertyNameLabel}${propertyIdLabel ? ` (${propertyIdLabel})` : ""}` : `Property: ${String(payload.connection?.displayName || payload.connection?.propertyName || payload.connection?.propertyId || "")}`,
      standaloneAdComparison ? (campaignFilterLabel ? `Filter: ${campaignFilterLabel}` : "") : `Completed data through: ${payload.reportCumulativeWindow.endDate} (${formatReportingTimeZoneLabel(payload.reportCumulativeWindow.reportingTimeZone)})`],
  ].map(cells => cells.map(cell => doc.splitTextToSize(cell, CW / 2 - 12) as string[]));
  const metadataHeights = metadata.map(cells => Math.max(...cells.map(lines => lines.length)) * 4 + 4);
  doc.setFillColor(...COLORS.cardBg);
  doc.roundedRect(MX, y, CW, metadataHeights.reduce((sum, height) => sum + height, 0) + 6, 3, 3, "F");
  metadata.forEach((cells, idx) => {
    cells.forEach((lines, col) => doc.text(lines, MX + 6 + col * CW / 2, y + 7));
    y += metadataHeights[idx];
  });
  y += 14;

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
        ["Conversions", formatConversionCredit(payload.breakdownTotals.conversions)],
        ["Engagement Rate", payload.breakdownTotals.sessions > 0 ? formatPct(normalizeRateToPercent(payload.breakdownTotals.engagementRate)) : "Unavailable"],
        ["Conv. Rate", payload.breakdownTotals.sessions > 0 ? formatPct((payload.breakdownTotals.conversions / payload.breakdownTotals.sessions) * 100) : "Unavailable"],
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
        ["Total Spend", payload.financialSpendAvailable ? formatMoney(payload.financialSpend) : "Unavailable"],
      ], 1);
    }
    if (includePerformance) {
      subheading("Performance");
      metricCards([
        ["Profit", payload.financialSpendAvailable ? formatMoney(payload.financialRevenue - payload.financialSpend) : "Unavailable"],
        ["ROAS", payload.financialSpend > 0 ? `${Number(payload.financialROAS || 0).toFixed(2)}x` : "—"],
        ["ROI", payload.financialSpend > 0 ? formatPct(payload.financialROI) : "—"],
        ["CPA", payload.financialSpend > 0 && payload.financialConversions > 0 ? formatMoney(payload.financialCPA) : "—"],
      ], 4);
    }
    if (includeCampaignBreakdown) {
      addSimpleTable(
        "Campaign Breakdown",
        ["CAMPAIGN", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE", "REVENUE"],
        payload.campaignBreakdownAgg.map((row: any) => [
          String(row?.name || "(not set)"),
          formatNumber(row?.sessions || 0),
          formatNumber(row?.users || 0),
          formatConversionCredit(row?.conversions || 0),
          formatPct(Number(row?.conversionRate || 0)),
          formatMoney(Number((Number(row?.revenue || 0) + Number(payload.campaignBreakdownMatchedExternalRevenue.get(String(row?.name || "")) || 0)).toFixed(2))),
        ]),
        [52, 22, 20, 28, 26, 36],
        COLORS.overview,
        "Traffic metrics are cumulative from the initial GA4 import; Revenue combines native GA4 revenue from the imported data window with exact campaign-mapped imported revenue.",
      );
    }
    if (includeLandingPages) {
      addSimpleTable(
        "Landing Pages",
        ["LANDING PAGE", "SOURCE/MEDIUM", "SESSIONS", "USERS", "CONVERSIONS", "CONV. RATE"],
        (payload.landingPages?.rows || []).slice(0, 20).map((row: any) => [
          String(row?.landingPage || "(not set)"),
          `${String(row?.source || "(not set)")}/${String(row?.medium || "(not set)")}`,
          Number(row?.sessions || 0).toLocaleString("en-US"),
          Number(row?.users || 0).toLocaleString("en-US"),
          formatConversionCredit(Number(row?.conversions || 0)),
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
        (payload.conversionEvents?.rows || []).slice(0, 25).map((row: any) => [
          String(row?.eventName || "(not set)"),
          formatConversionCredit(Number(row?.conversions || 0)),
          row?.eventCount == null ? "Unavailable" : formatNumber(row.eventCount),
          row?.users == null ? "Unavailable" : formatNumber(row.users),
        ]),
        [76, 36, 36, 28],
        COLORS.overview
      );
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

  if (sections.ads) {
    const s = cfg.subsections?.ads || {};
    const includeTopCampaigns = reportType !== "custom" || s.topCampaigns === true || s.summary === true;
    const includeAllCampaigns = reportType === "custom" && s.allCampaigns === true;
    const includeBestWorst = reportType !== "custom" || s.bestWorst !== false;
    const includeRevenueBreakdown = reportType !== "custom" || s.revenueBreakdown !== false;
    sectionTitle("Ad Comparison", COLORS.ads, 24);
    const rows = payload.adComparisonBreakdownAgg.map((row: any) => {
      const nativeRevenue = Number(Number(row?.revenue || 0).toFixed(2));
      return { ...row, revenue: nativeRevenue, revenuePerSession: Number(row?.sessions || 0) > 0 ? nativeRevenue / Number(row?.sessions || 0) : 0 };
    });
    const selectedMetric = ["sessions", "users", "conversions", "revenue", "conversionRate"].includes(String(rawCfg?.adComparisonMetric || ""))
      ? String(rawCfg.adComparisonMetric)
      : "sessions";
    const metricLabels: Record<string, string> = { sessions: "Sessions", users: "Users", conversions: "Conversions", revenue: "Revenue", conversionRate: "Conversion Rate" };
    const formatMetricValue = (metric: string, value: number) => metric === "revenue" ? formatMoney(value) : metric === "conversionRate" ? formatMetricPct(value) : metric === "conversions" ? formatConversionCredit(Number(value || 0)) : formatNumber(value);
    const chartSummaryByCampaign = new Map<string, any>();
    for (const row of payload.campaignBreakdownAgg) {
      const key = String(row?.name || "").toLocaleLowerCase("en-US");
      const current = chartSummaryByCampaign.get(key) || { ...row, sessions: 0, users: 0, conversions: 0, revenue: 0, conversionRate: 0 };
      current.sessions += Number(row?.sessions || 0);
      current.users += Number(row?.users || 0);
      current.conversions += Number(row?.conversions || 0);
      current.revenue += Number((Number(row?.revenue || 0) + Number(payload.campaignBreakdownMatchedExternalRevenue.get(String(row?.name || "")) || 0)).toFixed(2));
      current.conversionRate += Number(row?.conversionRate || 0) * Number(row?.sessions || 0);
      chartSummaryByCampaign.set(key, current);
    }
    const chartSummaryRows = Array.from(chartSummaryByCampaign.values()).map((row: any) => ({
      ...row,
      conversionRate: Number(row?.sessions || 0) > 0 ? Number(row.conversionRate || 0) / Number(row.sessions) : 0,
    }));
    const sortedByMetric = [...chartSummaryRows].sort((a: any, b: any) =>
      (Number(b?.[selectedMetric] || 0) - Number(a?.[selectedMetric] || 0))
      || String(a?.name || "").localeCompare(String(b?.name || ""), "en", { sensitivity: "base" })
      || String(a?.name || "").localeCompare(String(b?.name || ""), "en", { sensitivity: "variant" }));
    const totalMetric = selectedMetric === "conversionRate"
      ? (() => {
          const totalSessions = sortedByMetric.reduce((sum: number, row: any) => sum + Number(row?.sessions || 0), 0);
          const weightedRates = sortedByMetric.reduce((sum: number, row: any) => sum + Number(row?.conversionRate || 0) * Number(row?.sessions || 0), 0);
          return totalSessions > 0 ? weightedRates / totalSessions : 0;
        })()
      : sortedByMetric.reduce((sum: number, row: any) => sum + Number(row?.[selectedMetric] || 0), 0);
    const leaderMetric = selectedMetric;
    const { bestPerforming, mostEfficient, needsAttention } = selectGA4AdComparisonLeaderCards(chartSummaryRows, leaderMetric);
    if (includeBestWorst && chartSummaryRows.length > 1) {
      y += 4;
      checkPage(28);
      const colW = (CW - 8) / 3;
      const rankCards = [
        { title: "MOST KEY EVENTS", name: String(bestPerforming?.name || "No key event leader"), detail: bestPerforming ? `${formatMetricValue("conversions", bestPerforming.conversions)} Key Events - ${formatGA4AdComparisonCardPct(bestPerforming.conversionRate)} CR` : "No key events recorded", color: COLORS.success, x: MX },
        { title: "HIGHEST CONVERSION RATE", name: String(mostEfficient?.name || "No rate leader"), detail: mostEfficient ? `${formatGA4AdComparisonCardPct(mostEfficient.conversionRate)} CR - ${formatMoney(Number(mostEfficient.revenue || 0))} revenue` : "No conversions recorded", color: COLORS.info, x: MX + colW + 4 },
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
        const barH = item.value > 0 ? Math.max(1, (item.value / maxValue) * (chartH - 2)) : 0;
        if (barH > 0) { doc.setFillColor(...COLORS.ads); doc.rect(px, chartY + chartH - barH, barW, barH, "F"); }
        doc.setFontSize(5.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...(barH >= 8 ? COLORS.white : COLORS.text));
        doc.text(formatMetricValue(selectedMetric, item.value), px + barW / 2, barH >= 8 ? chartY + chartH - barH + 4 : chartY + chartH - barH - 1.5, { align: "center" });
        const nameLines = doc.splitTextToSize(item.name, Math.max(slotW - 4, 18)).slice(0, 2) as string[];
        if (nameLines.length > 1 && doc.getTextWidth(nameLines[1]) > slotW - 4) nameLines[1] = nameLines[1].slice(0, 18);
        doc.setFont("helvetica", "normal"); doc.setTextColor(...COLORS.text);
        nameLines.forEach((line, lineIndex) => doc.text(line, px + barW / 2, chartY + chartH + 5 + lineIndex * 4, { align: "center" }));
      });
      doc.setFontSize(6.5); doc.setTextColor(...COLORS.textTert); doc.text(formatMetricValue(selectedMetric, maxValue), chartX + chartW, chartY + 1, { align: "right" });
      y += 58;
      const summaryMetricLabel = selectedMetric === "revenue" ? "Campaign Breakdown Revenue" : selectedMetric === "conversionRate" ? "Overall Conversion Rate" : `Total ${metricLabels[selectedMetric]}`;
      metricCards([[summaryMetricLabel, formatMetricValue(selectedMetric, totalMetric)], ["Campaigns Compared", String(sortedByMetric.length)]], 2, 18);
      if (selectedMetric === "users") {
        doc.setFontSize(6.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...COLORS.textTert);
        doc.text("Users are summed campaign-row counts and are non-additive.", MX, y);
        y += 5;
      }
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
        doc.text(formatConversionCredit(conversions), colXs[4], y + 4); doc.text(formatMoney(revenue), colXs[5], y + 4);
        doc.text(formatGA4AdComparisonCardPct(conversionRate).replace(".00%", "%"), colXs[6], y + 4);
        y += 8;
      });
    }
    if (includeRevenueBreakdown) {
      y += 4;
      const nativeRevenueTotal = Number(payload.adComparisonBreakdownAgg.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0).toFixed(2));
      const revenueBreakdownRows: { label: string; amount: string; bold?: boolean }[] = [
        { label: "GA4 Revenue (Imported to Date)", amount: formatMoney(nativeRevenueTotal) },
        ...payload.adComparisonRevenueDisplaySources.filter((source: any) => Number(source.revenue) !== 0).map((source: any) => (
            { label: String(source?.displayName || source?.sourceType || "Revenue"), amount: formatMoney(Number(source?.revenue)) }
          )),
        { label: "TOTAL", amount: formatMoney(nativeRevenueTotal + payload.adComparisonRevenueDisplaySources.reduce((sum: number, source: any) => sum + Number(source.revenue), 0)), bold: true },
      ];
      const fullSectionHeight = 18 + 10 + revenueBreakdownRows.length * 8 + 4;
      if (fullSectionHeight <= 250 && y + fullSectionHeight > 274) { addFooter(); doc.addPage(); paintPage(); y = 18; }
      sectionTitle("Revenue Breakdown", COLORS.ads);
      checkPage(10);
      doc.setFillColor(...COLORS.cardBg); doc.roundedRect(MX, y, CW, 8, 2, 2, "F");
      doc.setFontSize(6.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...COLORS.textTert);
      doc.text("SOURCE", MX + 4, y + 5.5); doc.text("AMOUNT", MX + CW - 4, y + 5.5, { align: "right" });
      y += 10;
      revenueBreakdownRows.forEach((row) => {
        doc.setFontSize(8); doc.setFont("helvetica", row.bold ? "bold" : "normal");
        const labelLines = doc.splitTextToSize(row.label, CW - doc.getTextWidth(row.amount) - 16) as string[];
        const rowHeight = Math.max(8, labelLines.length * 4 + 4);
        checkPage(rowHeight);
        doc.setDrawColor(...COLORS.divider); doc.setLineWidth(0.2); doc.line(MX + 2, y - 1, MX + CW - 2, y - 1);
        doc.setFontSize(8); doc.setFont("helvetica", row.bold ? "bold" : "normal"); doc.setTextColor(...COLORS.text);
        labelLines.forEach((line, index) => doc.text(line, MX + 4, y + 4 + index * 4));
        doc.text(row.amount, MX + CW - 4, y + 4, { align: "right" });
        y += rowHeight;
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
        ["Spend", payload.financialSpendAvailable ? formatMoney(payload.financialSpend) : "Unavailable"],
        ["Profit", payload.financialSpendAvailable ? formatMoney(payload.financialRevenue - payload.financialSpend) : "Unavailable"],
        ["ROAS", payload.financialSpend > 0 ? `${Number(payload.financialROAS || 0).toFixed(2)}x` : "—"],
        ["ROI", payload.financialSpendAvailable && payload.financialSpend > 0 ? formatPct(payload.financialROI) : "—"],
        ["Days of Data", formatNumber(payload.insightsRollups.availableDays || 0)],
      ], 3);
    }
    if (includeTrends) {
      const trendNoteLines = doc.splitTextToSize("Daily shows recorded values; missing dates are unavailable. 7d/30d require consecutive recorded days. Monthly comparisons require adjacent complete months.", CW) as string[];
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
          formatConversionCredit(row?.conversions || 0),
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
          ["Users", formatNumber(payload.breakdownTotals.users), "Sum of daily users"],
          ["Conversions", formatConversionCredit(payload.breakdownTotals.conversions), ""],
          ["Revenue", formatMoney(payload.financialRevenue), "Total across revenue sources"],
          ...(payload.financialSpend > 0 ? [["Total Spend", formatMoney(payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 ? [["Profit", formatMoney(payload.financialRevenue - payload.financialSpend), ""]] : []),
          ...(payload.financialSpend > 0 && payload.financialConversions > 0 ? [["CPA", formatMoney(payload.financialCPA), ""]] : []),
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
      const topInsights = payload.insightsItems.slice(0, 12);
      const groupedInsights = INSIGHT_CATEGORY_GROUPS.map((group) => ({
        ...group,
        items: topInsights.filter((item: any) => item.category === group.key),
      })).filter((group) => group.items.length > 0);
      for (const group of groupedInsights) {
        const firstItem = group.items[0];
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        const firstTitleLines = doc.splitTextToSize(String(firstItem?.title || ""), CW - 20) as string[];
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const firstMeta = [firstItem?.dataBasis ? `Basis: ${String(firstItem.dataBasis)}` : "", firstItem?.confidence ? `Confidence: ${String(firstItem.confidence)}` : ""].filter(Boolean).join(" | ");
        const firstMetaLines = firstMeta ? doc.splitTextToSize(firstMeta, CW - 20) as string[] : [];
        const firstDescriptionLines = doc.splitTextToSize(String(firstItem?.description || ""), CW - 20) as string[];
        const firstRecommendationLines = firstItem?.recommendation ? doc.splitTextToSize(`Recommended check: ${String(firstItem.recommendation || "")}`, CW - 20) as string[] : [];
        const firstCardHeight = 18 + Math.max(0, firstTitleLines.length - 1) * 4.5 + firstMetaLines.length * 4 + (firstMetaLines.length > 0 ? 2 : 0) + firstDescriptionLines.length * 4.5 + (firstRecommendationLines.length > 0 ? firstRecommendationLines.length * 4.5 + 4 : 0);
        checkPage(10 + firstCardHeight + 4);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...COLORS.text);
        doc.text(group.label, MX + 4, y);
        y += 6;
        for (const item of group.items) {
          const sevCol = item.severity === "high" ? COLORS.danger : item.severity === "positive" ? COLORS.success : item.severity === "medium" ? COLORS.warning : COLORS.info;
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          const titleLines = doc.splitTextToSize(String(item.title || ""), CW - 20) as string[];
          const titleExtraHeight = Math.max(0, titleLines.length - 1) * 4.5;
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          const lines = doc.splitTextToSize(String(item.description || ""), CW - 20) as string[];
          const meta = [item.dataBasis ? `Basis: ${String(item.dataBasis)}` : "", item.confidence ? `Confidence: ${String(item.confidence)}` : ""].filter(Boolean).join(" | ");
          const metaLines = meta ? doc.splitTextToSize(meta, CW - 20) as string[] : [];
          const recLines = item.recommendation ? doc.splitTextToSize(`Recommended check: ${String(item.recommendation || "")}`, CW - 20) as string[] : [];
          const height = 18 + titleExtraHeight + metaLines.length * 4 + (metaLines.length > 0 ? 2 : 0) + lines.length * 4.5 + (recLines.length > 0 ? recLines.length * 4.5 + 4 : 0);
          checkPage(height + 4);
          doc.setFillColor(...COLORS.white);
          doc.setDrawColor(...COLORS.cardBorder);
          doc.roundedRect(MX, y, CW, height, 3, 3, "FD");
          doc.setFillColor(...sevCol);
          doc.roundedRect(MX, y, 3, height, 1, 1, "F");
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.text);
          titleLines.forEach((line, index) => doc.text(line, MX + 8, y + 8 + index * 4.5));
          let lineY = y + 14 + titleExtraHeight;
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

  addFooter();
  return coercePdfBufferFromDoc(doc);
}
