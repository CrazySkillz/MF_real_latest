import { storage } from "./storage";
import { ga4Service } from "./analytics";
import { computeCpa, computeConversionRatePercent, computeRoiPercent, normalizeRateToPercent } from "../shared/metric-math";
import {
  getGA4KpiMetricDependencies,
  getGA4KpiMetricIdentity,
  isComputableGA4KpiMetricIdentity,
  isGA4FinancialKpiMetricIdentity,
  resolveGA4KpiMetricIdentity,
} from "../shared/ga4-kpi-metric-identity";
import { isGA4FinancialTotalsCandidate, parseGA4FinancialNumber, selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { refreshCampaignCurrentValuesForCampaign } from "./utils/campaign-current-values";
import { getReportingDateWindow, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { assertGA4InsightsFinancialCurrencyScope, buildGA4InsightsHistoryScopeMarker, filterGA4InsightsHistoryByScope } from "../shared/ga4-insights";

const isoDateUTC = (d: Date) => d.toISOString().slice(0, 10);
const GA4_KPI_FINANCIAL_SOURCE_START_DATE = "1900-01-01";

export const getGA4KPIFinancialSourceWindow = (reportingTimeZone: unknown = "UTC", now: Date = new Date()) => ({
  startDate: GA4_KPI_FINANCIAL_SOURCE_START_DATE,
  endDate: getReportingDateWindow(1, reportingTimeZone, now).endDate,
});

export const getGA4KPIReportingWindow = (reportingTimeZone: unknown, requestedDate?: string, now: Date = new Date(), importStartDate?: unknown) => {
  const currentWindow = resolveGA4ImportToDateWindow(importStartDate, reportingTimeZone, now);
  if (!currentWindow) throw new Error("Invalid GA4 KPI import-to-date reporting window");
  const requested = String(requestedDate || "").trim();
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested < currentWindow.endDate
    ? requested
    : currentWindow.endDate;
  if (endDate < currentWindow.startDate) throw new Error("GA4 KPI reporting date precedes the import boundary");
  const start = new Date(`${currentWindow.startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return {
    ...currentWindow,
    endDate,
    dataThroughDate: endDate,
    days: Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1,
  };
};

export const parseGA4CampaignFilter = (raw: any): string | string[] | undefined => {
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.map((v) => String(v || "").trim()).filter(Boolean);
  const s = String(raw || "").trim();
  if (!s) return undefined;
  if (s.startsWith("[") && s.endsWith("]")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim()).filter(Boolean);
    } catch {
      // ignore
    }
  }
  return s;
};

const normalizePropertyIdForMock = (pid: string) => {
  const raw = String(pid || "").trim();
  if (!raw) return raw;
  const m = raw.match(/properties\/(\d+)/i);
  if (m && m[1]) return m[1];
  return raw.replace(/^\/+/, "");
};

export const isYesopMockProperty = (pid: string) => {
  const v = String(pid || "").trim().toLowerCase();
  const normalized = normalizePropertyIdForMock(v).toLowerCase();
  return v === "yesop" || normalized === "yesop";
};

export const isNoRevenueFilter = (raw: any): boolean => {
  const s = String(raw || "").toLowerCase();
  return s.includes("no_revenue") || s.includes("no-revenue") || s.includes("no revenue") || s.includes("no_rev") || s.includes("no-rev");
};

export const getYesopMockBaselineTotals = (campaignId: string, ga4CampaignFilter: any, noRevenue: boolean, windowDays: 30 | 90 = 90) => {
  const campaignProfiles: Record<string, { scale: number; engagementDelta: number }> = {
    "yesop-brand": { scale: 1.0, engagementDelta: 0.0 },
    "yesop-prospecting": { scale: 0.6, engagementDelta: -0.08 },
    "yesop-retargeting": { scale: 0.35, engagementDelta: 0.12 },
    "yesop-email": { scale: 0.25, engagementDelta: 0.05 },
    "yesop-social": { scale: 0.5, engagementDelta: -0.04 },
  };
  const utmToProfile: Record<string, string> = {
    "yesop_brand_search": "yesop-brand",
    "yesop_prospecting": "yesop-prospecting",
    "yesop_retargeting": "yesop-retargeting",
    "yesop_email_nurture": "yesop-email",
    "yesop_paid_social": "yesop-social",
  };
  const resolveFilterNames = () => {
    const raw = String(ga4CampaignFilter || "").trim();
    if (!raw) return [] as string[];
    if (raw.startsWith("[") && raw.endsWith("]")) {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map((v: any) => String(v || "").trim().toLowerCase()).filter(Boolean);
      } catch {
        // ignore invalid JSON and treat as a single value
      }
    }
    return [raw.toLowerCase()];
  };

  const filterNames = resolveFilterNames();
  let profilesToSum: Array<{ scale: number; engagementDelta: number }> = [];
  if (campaignProfiles[campaignId]) {
    profilesToSum = [campaignProfiles[campaignId]];
  } else if (filterNames.length > 0) {
    profilesToSum = filterNames
      .map((name) => utmToProfile[name])
      .filter(Boolean)
      .map((id) => campaignProfiles[id])
      .filter(Boolean);
  }
  if (profilesToSum.length === 0) profilesToSum = [{ scale: 1.0, engagementDelta: 0 }];

  const totalScale = profilesToSum.reduce((s, p) => s + p.scale, 0);
  const weightedEngDelta = profilesToSum.reduce((s, p) => s + p.engagementDelta * p.scale, 0) / (totalScale || 1);
  const scale = totalScale || 1;
  const isThirtyDayWindow = windowDays === 30;
  return {
    users: Math.round((isThirtyDayWindow ? 10800 : 31800) * scale),
    sessions: Math.round((isThirtyDayWindow ? 14075 : 41000) * scale),
    pageviews: Math.round((isThirtyDayWindow ? 42110 : 123400) * scale),
    conversions: Math.round((isThirtyDayWindow ? 553 : 1620) * scale),
    revenue: Number(((noRevenue ? 0 : isThirtyDayWindow ? 54680.78 : 150220.15) * scale).toFixed(2)),
    engagementRate: Math.min(1, Math.max(0, (isThirtyDayWindow ? 0.59 : 0.57) + weightedEngDelta)),
  };
};


const toRecordedAtUtc = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T23:59:59.000Z`);

const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));

const computeRoasRatio = (revenue: number, spend: number) => {
  const r = Number.isFinite(revenue) ? revenue : 0;
  const s = Number.isFinite(spend) ? spend : 0;
  return s > 0 ? r / s : 0;
};

export function isComputableGA4KpiMetric(metricOrName: string) {
  return isComputableGA4KpiMetricIdentity(metricOrName);
}

const isGA4FinancialKpiMetric = (metricOrName: string) => {
  return isGA4FinancialKpiMetricIdentity(metricOrName);
};

export function computeKpiValue(metricOrName: string, inputs: {
  users: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  ga4Revenue: number;
  importedRevenue: number;
  spend: number;
  engagementRate: number; // 0..1
}) {
  const m = getGA4KpiMetricIdentity(metricOrName);
  const revenue = inputs.ga4Revenue + inputs.importedRevenue;

  if (m === "revenue") return round2(revenue);
  if (m === "conversions") return Math.round(inputs.conversions || 0);
  if (m === "sessions") return Math.round(inputs.sessions || 0);
  if (m === "users") return Math.round(inputs.users || 0);
  if (m === "pageviews") return Math.round(inputs.pageviews || 0);
  if (m === "conversion_rate") return round2(computeConversionRatePercent(inputs.conversions, inputs.sessions));
  if (m === "engagement_rate") return round2(normalizeRateToPercent(inputs.engagementRate));
  if (m === "roas") return round2(computeRoasRatio(revenue, inputs.spend));
  if (m === "roi") return round2(computeRoiPercent(revenue, inputs.spend));
  if (m === "cpa") return round2(computeCpa(inputs.spend, inputs.conversions));

  // Unknown KPI metric -> return 0 (we don't guess).
  return 0;
}

function computeRollingAverage(existing: Array<{ value: number; recordedAt: Date }>, days: number, newPoint: { value: number; recordedAt: Date }) {
  const cutoff = new Date(newPoint.recordedAt);
  cutoff.setUTCDate(cutoff.getUTCDate() - (days - 1));
  cutoff.setUTCHours(0, 0, 0, 0);
  const values = existing
    .filter((p) => {
      const t = new Date(p.recordedAt);
      return t.getTime() >= cutoff.getTime() && t.getTime() <= newPoint.recordedAt.getTime();
    })
    .map((p) => p.value);
  values.push(newPoint.value);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : newPoint.value;
  return round2(avg);
}

function computeTrendDirection(prevValue: number | null, nextValue: number) {
  if (prevValue === null || !Number.isFinite(prevValue)) return "neutral";
  if (nextValue > prevValue) return "up";
  if (nextValue < prevValue) return "down";
  return "neutral";
}

export function computeBenchmarkVariance(metricKey: string, current: number, benchmark: number) {
  const lowerIsBetter = getGA4KpiMetricIdentity(metricKey) === "cpa";
  if (!(benchmark > 0)) return 0;
  if (lowerIsBetter) return round2(((benchmark - current) / benchmark) * 100);
  return round2(((current - benchmark) / benchmark) * 100);
}

export function computeBenchmarkRating(variancePct: number) {
  // Historical performanceRating is a variance bucket for trend history, not the live
  // on_track / needs_attention / behind benchmark status used by cards and reports.
  if (variancePct >= 20) return "excellent";
  if (variancePct >= 5) return "good";
  if (variancePct >= -5) return "average";
  if (variancePct >= -20) return "below_average";
  return "poor";
}

export async function runGA4DailyKPIAndBenchmarkJobs(opts?: { campaignId?: string; campaignIds?: string[]; date?: string; suppressAlerts?: boolean }) {
  const requestedDate = String(opts?.date || "").trim();
  const requestedCampaignIds = Array.isArray(opts?.campaignIds)
    ? new Set(opts.campaignIds.map((id) => String(id)))
    : null;
  const campaigns = opts?.campaignId
    ? [await storage.getCampaign(String(opts.campaignId)).catch(() => undefined)].filter(Boolean) as any[]
    : (await storage.getCampaigns().catch(() => []))
      .filter((campaign: any) => !requestedCampaignIds || requestedCampaignIds.has(String(campaign?.id || "")));

  let reportedDate = requestedDate || getReportingDateWindow(1, "UTC").endDate;
  let processed = 0;
  let kpisRecorded = 0;
  let benchmarksRecorded = 0;
  let benchmarksUpdated = 0;
  const benchmarkIdsUpdated: string[] = [];
  const benchmarkIdsSkipped = new Set<string>();
  const benchmarkIdsFailed = new Set<string>();
  const campaignIdsProcessed = new Set<string>();
  const campaignIdsSkipped = new Set<string>();
  const campaignIdsFailed = new Set<string>();
  const kpiIdsUpdated = new Set<string>();
  const kpiIdsSkipped = new Set<string>();
  const kpiIdsFailed = new Set<string>();
  const alertReconciliationFailures: string[] = [];
  let kpiAlertReconciliationAttempted = false;

  for (const campaign of campaigns) {
    const campaignId = String((campaign as any)?.id || "");
    if (!campaignId) continue;
    const campaignOwnerId = String((campaign as any)?.ownerId || "").trim();
    if (!campaignOwnerId) {
      campaignIdsSkipped.add(campaignId);
      continue;
    }
    let campaignKpis: any[] = [];
    let campaignBenchmarks: any[] = [];

    try {
      const [campaignKpisResult, campaignBenchmarksResult, connectionsResult] = await Promise.allSettled([
        storage.getPlatformKPIs("google_analytics", campaignId),
        storage.getPlatformBenchmarks("google_analytics", campaignId),
        storage.getGA4Connections(campaignId),
      ]);
      if (campaignKpisResult.status === "fulfilled") {
        campaignKpis = campaignKpisResult.value;
      } else {
        campaignIdsFailed.add(campaignId);
        console.warn(`[GA4 KPI/Benchmarks] KPI rows failed to load for campaign ${campaignId}:`, campaignKpisResult.reason?.message || campaignKpisResult.reason);
      }
      if (campaignBenchmarksResult.status === "fulfilled") {
        campaignBenchmarks = campaignBenchmarksResult.value;
      } else {
        campaignIdsFailed.add(campaignId);
        console.warn(`[GA4 KPI/Benchmarks] Benchmark rows failed to load for campaign ${campaignId}:`, campaignBenchmarksResult.reason?.message || campaignBenchmarksResult.reason);
      }
      const connections = connectionsResult.status === "fulfilled" ? connectionsResult.value : [];
      const primary = (connections as any[]).find((c: any) => c?.isPrimary) || (connections as any[])[0];
      if (!primary?.propertyId) {
        campaignIdsSkipped.add(campaignId);
        for (const kpi of campaignKpis) {
          const kpiId = String(kpi?.id || "").trim();
          if (kpiId) kpiIdsSkipped.add(kpiId);
        }
        for (const benchmark of campaignBenchmarks) {
          const benchmarkId = String(benchmark?.id || "").trim();
          if (benchmarkId) benchmarkIdsSkipped.add(benchmarkId);
        }
        continue;
      }
      const propertyId = String(primary.propertyId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      const historyScopeMarker = buildGA4InsightsHistoryScopeMarker(
        propertyId,
        campaignFilter,
        (campaign as any)?.reportingTimeZone,
        (campaign as any)?.currency,
      );
      const reportingWindow = getGA4KPIReportingWindow(
        (campaign as any)?.reportingTimeZone,
        requestedDate,
        new Date(),
        primary.importStartDate,
      );
      const date = reportingWindow.endDate;
      const recordedAt = toRecordedAtUtc(date);
      if (opts?.campaignId) reportedDate = date;

      // Ensure the daily row exists (best-effort backfill)
      let daily = await storage.getGA4DailyMetrics(campaignId, propertyId, date, date).catch(() => []);
      if (!daily || daily.length === 0) {
        const series = await ga4Service.getTimeSeriesData(
          campaignId,
          storage,
          date, // explicit YYYY-MM-DD
          propertyId,
          campaignFilter,
          date,
        ).catch(() => []);
        const rows = Array.isArray(series) ? series : [];
        const upserts = rows
          .map((r: any) => ({
            campaignId,
            propertyId,
            date: String(r?.date || "").trim(),
            users: Number(r?.users || 0) || 0,
            sessions: Number(r?.sessions || 0) || 0,
            engagedSessions: r?.engagedSessions == null ? null : Math.max(0, Math.round(Number(r.engagedSessions) || 0)),
            pageviews: Number(r?.pageviews || 0) || 0,
            conversions: Number(r?.conversions || 0) || 0,
            revenue: String(Number(r?.revenue || 0).toFixed(2)),
            engagementRate: (r as any)?.engagementRate ?? null,
            revenueMetric: (r as any)?.revenueMetric ?? null,
            isSimulated: Boolean((campaign as any)?.ga4CampaignFilter && String((campaign as any).ga4CampaignFilter).toLowerCase().includes("mock")),
          }))
          .filter((x: any) => String(x.date) === date);
        await storage.replaceGA4DailyMetricsWindow(campaignId, propertyId, date, date, upserts as any);
        daily = await storage.getGA4DailyMetrics(campaignId, propertyId, date, date).catch(() => []);
      }

      let row = Array.isArray(daily) ? (daily as any[])[0] : null;
      const hasExactDailyRow = Boolean(row && String((row as any)?.date || "") === date);
      if (!row) {
        row = await storage.getLatestGA4DailyMetric(campaignId, propertyId).catch(() => null as any);
      }
      if (!row) {
        campaignIdsSkipped.add(campaignId);
        for (const kpi of campaignKpis) {
          const kpiId = String(kpi?.id || "").trim();
          if (kpiId) kpiIdsSkipped.add(kpiId);
        }
        for (const benchmark of campaignBenchmarks) {
          const benchmarkId = String(benchmark?.id || "").trim();
          if (benchmarkId) benchmarkIdsSkipped.add(benchmarkId);
        }
        continue;
      }

      // Build GA4 to-date totals (campaign lifetime) for accurate financial KPIs (ROAS/ROI/CPA).
      // Production path: GA4 API totals (with automatic token refresh).
      // Stored daily totals are retained only for the explicit mock/demo property.
      const financialStartDate = (() => {
        const raw = (campaign as any)?.startDate || (campaign as any)?.createdAt || null;
        if (!raw) return "2000-01-01";
        const date = new Date(raw);
        return Number.isNaN(date.getTime()) ? "2000-01-01" : isoDateUTC(date);
      })();
      const noRevenue = isNoRevenueFilter((campaign as any)?.ga4CampaignFilter);
      const [reportingRows, toDateRows] = await Promise.all([
        storage.getGA4DailyMetrics(campaignId, propertyId, reportingWindow.startDate, reportingWindow.endDate).catch(() => null as any),
        storage.getGA4DailyMetrics(campaignId, propertyId, financialStartDate, reportingWindow.endDate).catch(() => null as any),
      ]);
      const trafficInputsAvailable = (Array.isArray(reportingRows) && reportingRows.length > 0) || isYesopMockProperty(propertyId);
      let trafficTotals = summarizeGA4TrafficRows(Array.isArray(reportingRows) ? reportingRows : []);
      if (isYesopMockProperty(propertyId)) {
        const baseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue, 30);
        const baselineEngagedSessions = Math.round(baseline.sessions * baseline.engagementRate);
        const sessions = trafficTotals.sessions + baseline.sessions;
        trafficTotals = {
          users: trafficTotals.users + baseline.users,
          sessions,
          pageviews: trafficTotals.pageviews + baseline.pageviews,
          conversions: trafficTotals.conversions + baseline.conversions,
          revenue: trafficTotals.revenue + baseline.revenue,
          engagedSessions: trafficTotals.engagedSessions + baselineEngagedSessions,
          engagementRate: sessions > 0 ? (trafficTotals.engagedSessions + baselineEngagedSessions) / sessions : 0,
        };
      }
      let sessionsToDate = 0;
      let usersToDate = 0;
      let conversionsToDate = 0;
      let pageviewsToDate = 0;
      let ga4RevenueToDate = 0;
      for (const r of Array.isArray(toDateRows) ? (toDateRows as any[]) : []) {
        sessionsToDate += Number((r as any)?.sessions || 0) || 0;
        usersToDate += Number((r as any)?.users || 0) || 0;
        conversionsToDate += Number((r as any)?.conversions || 0) || 0;
        pageviewsToDate += Number((r as any)?.pageviews || 0) || 0;
        ga4RevenueToDate += Number((r as any)?.revenue || 0) || 0;
      }

      const financialSourceWindow = { startDate: "1900-01-01", endDate: reportingWindow.endDate };
      const spendSourceWindow = { startDate: "1900-01-01", endDate: financialSourceWindow.endDate };
      const financialInputsPromise = Promise.allSettled([
        storage.getRevenueTotalForRange(campaignId, financialSourceWindow.startDate, financialSourceWindow.endDate, "ga4"),
        storage.getSpendTotalForRange(campaignId, spendSourceWindow.startDate, spendSourceWindow.endDate, "ga4"),
        storage.getRevenueSources(campaignId, "ga4"),
        storage.getSpendSources(campaignId, "ga4"),
      ]);
      let providerFinancialCandidate: any = null;
      if (isYesopMockProperty(propertyId)) {
        const baseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue);
        sessionsToDate += baseline.sessions;
        usersToDate += baseline.users;
        conversionsToDate += baseline.conversions;
        pageviewsToDate += baseline.pageviews;
        ga4RevenueToDate += baseline.revenue;
      } else {
        try {
          const conn = await storage.getGA4Connection(campaignId, propertyId).catch(() => null as any);
          if (conn && conn.method === "access_token" && conn.accessToken) {
            const attempt = async (token: string) => {
              return await ga4Service.getTotalsWithRevenue(propertyId, token, financialStartDate, reportingWindow.endDate, campaignFilter, String((campaign as any)?.currency || "USD").trim().toUpperCase());
            };
            try {
              const res = await attempt(String(conn.accessToken));
              assertGA4InsightsFinancialCurrencyScope(campaign, [], res?.currencyCode, "GA4 native revenue", true);
              providerFinancialCandidate = isGA4FinancialTotalsCandidate(res?.totals) ? res.totals : null;
            } catch (e: any) {
              const msg = String(e?.message || "");
              const isAuth =
                msg.includes('"code": 401') ||
                msg.toLowerCase().includes("unauthenticated") ||
                msg.toLowerCase().includes("invalid authentication credentials") ||
                msg.toLowerCase().includes("request had invalid authentication credentials") ||
                msg.toLowerCase().includes("invalid_grant") ||
                msg.includes("401") ||
                msg.includes("403");
              if (isAuth && conn.refreshToken) {
                const refresh = await ga4Service.refreshAccessToken(
                  String(conn.refreshToken),
                  conn.clientId || undefined,
                  conn.clientSecret || undefined
                );
                await storage.updateGA4ConnectionTokens(conn.id, {
                  accessToken: refresh.access_token,
                  refreshToken: String(conn.refreshToken),
                  expiresAt: new Date(Date.now() + refresh.expires_in * 1000),
                });
                const res = await attempt(String(refresh.access_token));
                assertGA4InsightsFinancialCurrencyScope(campaign, [], res?.currencyCode, "GA4 native revenue", true);
                providerFinancialCandidate = isGA4FinancialTotalsCandidate(res?.totals) ? res.totals : null;
              }
            }
          }
        } catch {
          // Financial metrics remain unavailable when the live provider path fails.
        }
      }

      const [importedRevenueResult, spendTotalResult, revenueSourcesResult, spendSourcesResult] = await financialInputsPromise;
      let importedRevenueValue = importedRevenueResult.status === "fulfilled" && revenueSourcesResult.status === "fulfilled"
        ? parseGA4FinancialNumber((importedRevenueResult.value as any)?.totalRevenue)
        : null;
      let spendValue = spendTotalResult.status === "fulfilled" && spendSourcesResult.status === "fulfilled"
        ? parseGA4FinancialNumber((spendTotalResult.value as any)?.totalSpend)
        : null;
      try {
        if (importedRevenueValue !== null) assertGA4InsightsFinancialCurrencyScope(
          campaign,
          revenueSourcesResult.status === "fulfilled" ? revenueSourcesResult.value as any[] : [],
          importedRevenueResult.status === "fulfilled" ? (importedRevenueResult.value as any)?.currency : null,
          "Imported revenue",
        );
      } catch { importedRevenueValue = null; }
      try {
        if (spendValue !== null) assertGA4InsightsFinancialCurrencyScope(
          campaign,
          spendSourcesResult.status === "fulfilled" ? spendSourcesResult.value as any[] : [],
          spendTotalResult.status === "fulfilled" ? (spendTotalResult.value as any)?.currency : null,
          "Spend",
        );
      } catch { spendValue = null; }

      const inputs = {
        users: Math.round(trafficTotals.users || 0),
        sessions: Math.round(trafficTotals.sessions || 0),
        pageviews: Math.round(trafficTotals.pageviews || 0),
        conversions: Math.round(trafficTotals.conversions || 0),
        ga4Revenue: round2(trafficTotals.revenue || 0),
        importedRevenue: round2(importedRevenueValue ?? 0),
        spend: round2(spendValue ?? 0),
        engagementRate: Number(trafficTotals.engagementRate || 0) || 0,
      };
      const kpis = campaignKpis;
      const benchmarkStorage = storage as typeof storage & {
        getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<any[]>;
        updateBenchmark(id: string, benchmark: any): Promise<any>;
        getBenchmarkHistory(benchmarkId: string): Promise<any[]>;
        recordBenchmarkHistory(history: any): Promise<any>;
      };
      const benchmarks = campaignBenchmarks;
      const persistedFinancialCandidate = (Array.isArray(toDateRows) && toDateRows.length > 0) || isYesopMockProperty(propertyId) ? {
        users: Math.round(usersToDate || 0),
        sessions: Math.round(sessionsToDate || 0),
        pageviews: Math.round(pageviewsToDate || 0),
        conversions: Math.round(conversionsToDate || 0),
        revenue: round2(ga4RevenueToDate || 0),
      } : null;
      const selectedFinancialCandidate = selectGA4FinancialTotalsSource(
        [providerFinancialCandidate, isYesopMockProperty(propertyId) ? persistedFinancialCandidate : null],
        {} as any,
      );
      const financialCandidateAvailable = isGA4FinancialTotalsCandidate(selectedFinancialCandidate);
      const financialInputs = financialCandidateAvailable ? {
        ...inputs,
        users: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.users) ?? inputs.users),
        sessions: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.sessions ?? (selectedFinancialCandidate as any)?.sessionsRaw) ?? inputs.sessions),
        pageviews: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.pageviews) ?? inputs.pageviews),
        conversions: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.conversions) ?? 0),
        ga4Revenue: round2(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.revenue) ?? 0),
        importedRevenue: round2(importedRevenueValue ?? 0),
        spend: round2(spendValue ?? 0),
      } : null;
      const inputsForMetric = (metric: string) => {
        if (!isGA4FinancialKpiMetric(metric)) return inputs;
        const dependencies = getGA4KpiMetricDependencies(metric);
        if (!financialInputs) return null;
        if (dependencies.requiresRevenue && importedRevenueValue === null) return null;
        if (dependencies.requiresSpend && spendValue === null) return null;
        return financialInputs;
      };
      const benchmarkInputsForMetric = (metric: string) => {
        if (!isGA4FinancialKpiMetric(metric) && !trafficInputsAvailable) return null;
        return inputsForMetric(metric);
      };

      // 1) KPI progress points (daily)
      for (const kpi of Array.isArray(kpis) ? kpis : []) {
        const kpiId = String((kpi as any)?.id || "");
        if (!kpiId) continue;

        const metricOrName = resolveGA4KpiMetricIdentity((kpi as any)?.metric, (kpi as any)?.name);
        if (!metricOrName) {
          kpiIdsSkipped.add(kpiId);
          continue;
        }

        const metricInputs = inputsForMetric(metricOrName);
        if (!metricInputs) {
          kpiIdsSkipped.add(kpiId);
          continue;
        }
        const valueNum = computeKpiValue(metricOrName, metricInputs);
        try {
          const existing = await storage.getKPIProgress(kpiId);
          const existingPts = filterGA4InsightsHistoryByScope(Array.isArray(existing) ? existing : [], historyScopeMarker)
            .map((p: any) => ({
              id: String(p?.id || ""),
              value: Number(p?.value || 0) || 0,
              recordedAt: p?.recordedAt ? new Date(p.recordedAt) : new Date(0),
            }))
            .filter((p) => Number.isFinite(p.recordedAt.getTime()))
            .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

          const sameDatePts = existingPts.filter((p) => isoDateUTC(p.recordedAt) === date);
          if (hasExactDailyRow && (sameDatePts.length > 1 || (sameDatePts.length === 1 && !sameDatePts[0].id))) {
            throw new Error("KPI same-date progress is ambiguous");
          }
          const otherDatePts = existingPts.filter((p) => isoDateUTC(p.recordedAt) !== date);
          const progressData = hasExactDailyRow ? (() => {
            const prev = otherDatePts.length > 0 ? otherDatePts[0].value : null;
            const newPoint = { value: valueNum, recordedAt };
            return {
              kpiId,
              value: String(round2(valueNum)),
              rollingAverage7d: String(round2(computeRollingAverage(otherDatePts, 7, newPoint))),
              rollingAverage30d: String(round2(computeRollingAverage(otherDatePts, 30, newPoint))),
              trendDirection: computeTrendDirection(prev, valueNum),
              recordedAt,
              notes: `auto:ga4_daily:${date};${historyScopeMarker}`,
            };
          })() : null;

          // A row is reported updated only after its current value and applicable daily progress write succeed.
          const updated = await storage.updateKPI(kpiId, { currentValue: String(round2(valueNum)) } as any);
          if (!updated) throw new Error("KPI current-value update did not change a row");

          if (progressData && sameDatePts.length === 1) {
            const progress = await storage.updateKPIProgress(sameDatePts[0].id, progressData as any);
            if (!progress) throw new Error("KPI same-date progress update did not change a row");
          } else if (progressData) {
            await storage.recordKPIProgress(progressData as any);
            kpisRecorded += 1;
          }
          kpiIdsUpdated.add(kpiId);
        } catch (e: any) {
          kpiIdsFailed.add(kpiId);
          console.warn(`[GA4 KPI/Benchmarks] KPI ${kpiId} failed for campaign ${campaignId}:`, e?.message || e);
        }
      }

      // 2) Benchmark history points (daily)
      for (const b of Array.isArray(benchmarks) ? benchmarks : []) {
        const benchmarkId = String((b as any)?.id || "");
        if (!benchmarkId) continue;
        const metricKey = resolveGA4KpiMetricIdentity((b as any)?.metric, (b as any)?.name);
        if (!metricKey) continue; // custom/unsupported Benchmarks retain their manually managed current value

        const metricInputs = benchmarkInputsForMetric(metricKey);
        if (!metricInputs) {
          benchmarkIdsSkipped.add(benchmarkId);
          continue;
        }
        const currentValue = computeKpiValue(metricKey, metricInputs);
        // Always refresh stored currentValue so same-day persisted GA4 daily rows update what alert checks read,
        // even if we skip writing another history point for the same date.
        try {
          const updated = await benchmarkStorage.updateBenchmark(benchmarkId, { currentValue: String(round2(currentValue)) } as any);
          if (!updated) throw new Error("Benchmark current-value update did not change a row");

          const history = await benchmarkStorage.getBenchmarkHistory(benchmarkId);
          const hist = filterGA4InsightsHistoryByScope(Array.isArray(history) ? history : [], historyScopeMarker);
          const already = hist.some((h: any) => isoDateUTC(new Date((h as any)?.recordedAt || 0)) === date);
          if (hasExactDailyRow && !already) {
            const benchmarkValue = Number((b as any)?.benchmarkValue || 0) || 0;
            const variance = computeBenchmarkVariance(metricKey, currentValue, benchmarkValue);
            const rating = computeBenchmarkRating(variance);

            await benchmarkStorage.recordBenchmarkHistory({
              benchmarkId,
              currentValue: String(round2(currentValue)),
              benchmarkValue: String(round2(benchmarkValue)),
              variance: String(round2(variance)),
              performanceRating: rating,
              recordedAt,
              notes: `auto:ga4_daily:${date};${historyScopeMarker}`,
            } as any);
            benchmarksRecorded += 1;
          }
          benchmarksUpdated += 1;
          benchmarkIdsUpdated.push(benchmarkId);
        } catch (e: any) {
          benchmarkIdsFailed.add(benchmarkId);
          console.warn(`[GA4 KPI/Benchmarks] Benchmark ${benchmarkId} failed for campaign ${campaignId}:`, e?.message || e);
        }
      }

      await refreshCampaignCurrentValuesForCampaign(campaignId);

      processed += 1;
      campaignIdsProcessed.add(campaignId);
    } catch (e: any) {
      campaignIdsFailed.add(campaignId);
      for (const kpi of campaignKpis) {
        const kpiId = String(kpi?.id || "").trim();
        if (kpiId && !kpiIdsUpdated.has(kpiId) && !kpiIdsSkipped.has(kpiId)) kpiIdsFailed.add(kpiId);
      }
      for (const benchmark of campaignBenchmarks) {
        const benchmarkId = String(benchmark?.id || "").trim();
        if (benchmarkId && !benchmarkIdsUpdated.includes(benchmarkId) && !benchmarkIdsSkipped.has(benchmarkId)) benchmarkIdsFailed.add(benchmarkId);
      }
      console.warn(`[GA4 KPI/Benchmarks] Failed for campaign ${campaignId}:`, e?.message || e);
    }
  }

  if (opts?.campaignId && processed > 0 && kpiIdsSkipped.size === 0 && kpiIdsFailed.size === 0 && benchmarkIdsSkipped.size === 0 && benchmarkIdsFailed.size === 0 && campaignIdsSkipped.size === 0 && campaignIdsFailed.size === 0 && !opts?.suppressAlerts) {
    try {
      kpiAlertReconciliationAttempted = true;
      const { checkPerformanceAlerts } = await import("./kpi-scheduler.js");
      await checkPerformanceAlerts();
    } catch (e: any) {
      alertReconciliationFailures.push("kpi");
      console.warn("[GA4 KPI/Benchmarks] KPI alert reconciliation failed:", e?.message || e);
    }
    try {
      const { checkBenchmarkPerformanceAlerts } = await import("./benchmark-notifications.js");
      await checkBenchmarkPerformanceAlerts();
    } catch (e: any) {
      alertReconciliationFailures.push("benchmark");
      console.warn("[GA4 KPI/Benchmarks] Benchmark alert reconciliation failed:", e?.message || e);
    }
  }

  return {
    date: reportedDate,
    campaignsProcessed: processed,
    campaignIdsProcessed: Array.from(campaignIdsProcessed),
    campaignIdsSkipped: Array.from(campaignIdsSkipped),
    campaignIdsFailed: Array.from(campaignIdsFailed),
    kpisRecorded,
    kpiIdsUpdated: Array.from(kpiIdsUpdated),
    kpiIdsSkipped: Array.from(kpiIdsSkipped),
    kpiIdsFailed: Array.from(kpiIdsFailed),
    benchmarksRecorded,
    benchmarksUpdated,
    benchmarkIdsUpdated,
    benchmarkIdsSkipped: Array.from(benchmarkIdsSkipped),
    benchmarkIdsFailed: Array.from(benchmarkIdsFailed),
    kpiAlertReconciliationAttempted,
    alertReconciliationFailures,
  };
}


