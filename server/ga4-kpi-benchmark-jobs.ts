import { storage } from "./storage";
import { ga4Service } from "./analytics";
import { computeCpa, computeConversionRatePercent, computeRoiPercent, computeRoasPercent } from "../shared/metric-math";

const isoDateUTC = (d: Date) => d.toISOString().slice(0, 10);

const reportDateUTC = () => {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const y = new Date(todayUtc);
  y.setUTCDate(y.getUTCDate() - 1);
  return isoDateUTC(y);
};

const parseGA4CampaignFilter = (raw: any): string | string[] | undefined => {
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

const normalizeRateToPercent = (v: number) => {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  // GA4 engagementRate is 0..1; some older flows might provide 0..100.
  return n <= 1 ? n * 100 : n;
};

const toRecordedAtUtc = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T23:59:59.000Z`);

const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));

function computeKpiValue(metricOrName: string, inputs: {
  users: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  ga4Revenue: number;
  importedRevenue: number;
  spend: number;
  engagementRate: number; // 0..1
}) {
  const m = String(metricOrName || "").trim().toLowerCase();
  const revenue = inputs.ga4Revenue > 0 ? inputs.ga4Revenue : inputs.importedRevenue;

  if (m === "revenue") return round2(revenue);
  if (m === "total conversions" || m === "conversions") return Math.round(inputs.conversions || 0);
  if (m === "total sessions" || m === "sessions") return Math.round(inputs.sessions || 0);
  if (m === "total users" || m === "users") return Math.round(inputs.users || 0);
  if (m === "pageviews") return Math.round(inputs.pageviews || 0);
  if (m === "conversion rate" || m === "conversionrate") return round2(computeConversionRatePercent(inputs.conversions, inputs.sessions));
  if (m === "engagement rate" || m === "engagementrate") return round2(normalizeRateToPercent(inputs.engagementRate));
  if (m === "roas") return round2(computeRoasPercent(revenue, inputs.spend));
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

function computeBenchmarkVariance(metricKey: string, current: number, benchmark: number) {
  const m = String(metricKey || "").toLowerCase();
  const lowerIsBetter = m === "cpa" || m.includes("cpa");
  if (!(benchmark > 0)) return 0;
  if (lowerIsBetter) return round2(((benchmark - current) / benchmark) * 100);
  return round2(((current - benchmark) / benchmark) * 100);
}

function computeBenchmarkRating(variancePct: number) {
  if (variancePct >= 20) return "excellent";
  if (variancePct >= 5) return "good";
  if (variancePct >= -5) return "average";
  if (variancePct >= -20) return "below_average";
  return "poor";
}

export async function runGA4DailyKPIAndBenchmarkJobs(opts?: { campaignId?: string; date?: string }) {
  const date = String(opts?.date || reportDateUTC()).trim();
  const campaigns = opts?.campaignId
    ? [await storage.getCampaign(String(opts.campaignId)).catch(() => undefined)].filter(Boolean) as any[]
    : await storage.getCampaigns().catch(() => []);

  const recordedAt = toRecordedAtUtc(date);
  let processed = 0;
  let kpisRecorded = 0;
  let benchmarksRecorded = 0;

  for (const campaign of campaigns) {
    const campaignId = String((campaign as any)?.id || "");
    if (!campaignId) continue;

    try {
      const connections = await storage.getGA4Connections(campaignId).catch(() => []);
      const primary = (connections as any[]).find((c: any) => c?.isPrimary) || (connections as any[])[0];
      if (!primary?.propertyId) continue;
      const propertyId = String(primary.propertyId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);

      // Ensure the daily row exists (best-effort backfill)
      let daily = await storage.getGA4DailyMetrics(campaignId, propertyId, date, date).catch(() => []);
      if (!daily || daily.length === 0) {
        const series = await ga4Service.getTimeSeriesData(
          campaignId,
          storage,
          date, // explicit YYYY-MM-DD
          propertyId,
          campaignFilter
        ).catch(() => []);
        const rows = Array.isArray(series) ? series : [];
        const upserts = rows
          .map((r: any) => ({
            campaignId,
            propertyId,
            date: String(r?.date || "").trim(),
            users: Number(r?.users || 0) || 0,
            sessions: Number(r?.sessions || 0) || 0,
            pageviews: Number(r?.pageviews || 0) || 0,
            conversions: Number(r?.conversions || 0) || 0,
            revenue: String(Number(r?.revenue || 0).toFixed(2)),
            engagementRate: (r as any)?.engagementRate ?? null,
            revenueMetric: (r as any)?.revenueMetric ?? null,
            isSimulated: Boolean((campaign as any)?.ga4CampaignFilter && String((campaign as any).ga4CampaignFilter).toLowerCase().includes("mock")),
          }))
          .filter((x: any) => String(x.date) === date);
        if (upserts.length > 0) {
          await storage.upsertGA4DailyMetrics(upserts as any);
        }
        daily = await storage.getGA4DailyMetrics(campaignId, propertyId, date, date).catch(() => []);
      }

      const row = Array.isArray(daily) ? (daily as any[])[0] : null;
      if (!row) continue;

      // Build GA4 to-date totals (campaign lifetime) for accurate financial KPIs (ROAS/ROI/CPA).
      // Primary path: GA4 API totals (with automatic token refresh).
      // Fallback: sum stored daily rows (retention window), mainly for mock/demo flows.
      const startDateUsed = (() => {
        const raw = (campaign as any)?.startDate || (campaign as any)?.createdAt || null;
        if (!raw) return "2000-01-01";
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return "2000-01-01";
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      })();

      const toDateRows = await storage.getGA4DailyMetrics(campaignId, propertyId, "2000-01-01", date).catch(() => []);
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

      try {
        const conn = await storage.getGA4Connection(campaignId, propertyId).catch(() => null as any);
        if (conn && conn.method === "access_token" && conn.accessToken) {
          const attempt = async (token: string) => {
            return await ga4Service.getTotalsWithRevenue(propertyId, token, startDateUsed, date, campaignFilter);
          };
          try {
            const res = await attempt(String(conn.accessToken));
            sessionsToDate = Number(res?.totals?.sessions || sessionsToDate) || 0;
            usersToDate = Number(res?.totals?.users || usersToDate) || 0;
            conversionsToDate = Number(res?.totals?.conversions || conversionsToDate) || 0;
            pageviewsToDate = Number(res?.totals?.pageviews || pageviewsToDate) || 0;
            ga4RevenueToDate = Number(res?.totals?.revenue || ga4RevenueToDate) || 0;
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
              sessionsToDate = Number(res?.totals?.sessions || sessionsToDate) || 0;
              usersToDate = Number(res?.totals?.users || usersToDate) || 0;
              conversionsToDate = Number(res?.totals?.conversions || conversionsToDate) || 0;
              pageviewsToDate = Number(res?.totals?.pageviews || pageviewsToDate) || 0;
              ga4RevenueToDate = Number(res?.totals?.revenue || ga4RevenueToDate) || 0;
            }
          }
        }
      } catch {
        // ignore and keep fallback
      }

      // Imported revenue-to-date is stored as a single snapshot record dated "yesterday (UTC)".
      // Summing from a wide range yields the same number.
      const importedRevenueTotals = await storage.getRevenueTotalForRange(campaignId, "2000-01-01", date).catch(() => ({ totalRevenue: 0 }));
      const spendToDate = Number((campaign as any)?.spend || 0) || 0;

      const rawFilter = String((campaign as any)?.ga4CampaignFilter || "").toLowerCase();
      const forceNoRevenue = rawFilter.includes("no_rev") || rawFilter.includes("no-rev") || rawFilter.includes("no revenue");
      if (forceNoRevenue) ga4RevenueToDate = 0;

      const inputs = {
        users: Math.round(usersToDate || 0),
        sessions: Math.round(sessionsToDate || 0),
        pageviews: Math.round(pageviewsToDate || 0),
        conversions: Math.round(conversionsToDate || 0),
        ga4Revenue: round2(ga4RevenueToDate || 0),
        importedRevenue: round2(Number((importedRevenueTotals as any)?.totalRevenue || 0) || 0),
        spend: round2(spendToDate || 0),
        engagementRate: Number((row as any)?.engagementRate || 0) || 0,
      };

      // 1) KPI progress points (daily)
      const kpis = await storage.getPlatformKPIs("google_analytics", campaignId).catch(() => []);
      for (const kpi of Array.isArray(kpis) ? kpis : []) {
        const kpiId = String((kpi as any)?.id || "");
        if (!kpiId) continue;

        const existing = await storage.getKPIProgress(kpiId).catch(() => []);
        const existingPts = (Array.isArray(existing) ? existing : [])
          .map((p: any) => ({
            value: Number(p?.value || 0) || 0,
            recordedAt: p?.recordedAt ? new Date(p.recordedAt) : new Date(0),
          }))
          .filter((p) => Number.isFinite(p.recordedAt.getTime()))
          .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

        const already = existingPts.some((p) => isoDateUTC(p.recordedAt) === date);
        if (already) continue;

        const metricOrName = String((kpi as any)?.metric || (kpi as any)?.name || "");
        const valueNum = computeKpiValue(metricOrName, inputs);
        const prev = existingPts.length > 0 ? existingPts[0].value : null;

        const newPoint = { value: valueNum, recordedAt };
        const rolling7 = computeRollingAverage(existingPts, 7, newPoint);
        const rolling30 = computeRollingAverage(existingPts, 30, newPoint);
        const trendDirection = computeTrendDirection(prev, valueNum);

        await storage.recordKPIProgress({
          kpiId,
          value: String(round2(valueNum)),
          rollingAverage7d: String(round2(rolling7)),
          rollingAverage30d: String(round2(rolling30)),
          trendDirection,
          recordedAt,
          notes: `auto:ga4_daily:${date}`,
        } as any);

        kpisRecorded += 1;
      }

      // 2) Benchmark history points (daily)
      const benchmarks = await storage.getPlatformBenchmarks("google_analytics", campaignId).catch(() => []);
      for (const b of Array.isArray(benchmarks) ? benchmarks : []) {
        const benchmarkId = String((b as any)?.id || "");
        if (!benchmarkId) continue;
        const metricKey = String((b as any)?.metric || "").trim();
        if (!metricKey) continue; // can't compute without a metric key

        const history = await storage.getBenchmarkHistory(benchmarkId).catch(() => []);
        const hist = Array.isArray(history) ? history : [];
        const last = hist.length > 0 ? hist[hist.length - 1] : null; // history is ordered asc in DB
        if (last && isoDateUTC(new Date((last as any)?.recordedAt || 0)) === date) continue;

        const currentValue = computeKpiValue(metricKey, inputs);
        const benchmarkValue = Number((b as any)?.benchmarkValue || 0) || 0;
        const variance = computeBenchmarkVariance(metricKey, currentValue, benchmarkValue);
        const rating = computeBenchmarkRating(variance);

        await storage.recordBenchmarkHistory({
          benchmarkId,
          currentValue: String(round2(currentValue)),
          benchmarkValue: String(round2(benchmarkValue)),
          variance: String(round2(variance)),
          performanceRating: rating,
          recordedAt,
          notes: `auto:ga4_daily:${date}`,
        } as any);

        benchmarksRecorded += 1;
      }

      processed += 1;
    } catch (e: any) {
      console.warn(`[GA4 KPI/Benchmarks] Failed for campaign ${campaignId}:`, e?.message || e);
    }
  }

  return { date, campaignsProcessed: processed, kpisRecorded, benchmarksRecorded };
}


