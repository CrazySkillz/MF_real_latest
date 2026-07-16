import { storage } from "../storage";
import { ga4Service } from "../analytics";
import { selectGA4FinancialTotalsSource } from "../../shared/ga4-financial-source";

type CalcConfig = {
  metric?: string;
  inputs?: Record<string, string[]>;
};

type CampaignMetricTotals = {
  revenue: number;
  ga4Revenue: number;
  spend: number;
  conversions: number;
  financialConversions: number;
  users: number;
  sessions: number;
  engagementRate: number;
  revenueBySource: Map<string, number>;
  spendBySource: Map<string, number>;
};

const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));

const parseNum = (value: unknown): number => {
  const n = parseFloat(String(value ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const toISODateUTC = (value: unknown): string | null => {
  if (!value) return null;
  const d = new Date(value as any);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};

const todayUTC = () => new Date().toISOString().slice(0, 10);
const financialSourceStartDate = "1900-01-01";
const previousCompleteUTC = () => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

const parseConfig = (raw: unknown): CalcConfig | null => {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as CalcConfig;
    } catch {
      return null;
    }
  }
  return raw as CalcConfig;
};

const isCampaignLevel = (row: any) => {
  const platformType = String(row?.platformType || "").trim().toLowerCase();
  return !platformType || platformType === "campaign";
};

const isFinancialMetric = (metric: unknown) =>
  ["revenue", "profit", "roas", "roi", "cpa"].includes(String(metric || "").trim().toLowerCase());

const normalizePropertyIdForMock = (propertyId: string) => {
  const raw = String(propertyId || "").trim();
  const match = raw.match(/properties\/(\d+)/i);
  return match?.[1] || raw.replace(/^\/+/, "");
};

const isYesopMockProperty = (propertyId: string) => {
  const normalized = normalizePropertyIdForMock(propertyId).toLowerCase();
  return normalized === "yesop";
};

const parseGA4CampaignFilter = (raw: unknown): string[] => {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.startsWith("[") && value.endsWith("]")) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v || "").trim().toLowerCase()).filter(Boolean);
    } catch {
      // Treat invalid JSON as a single campaign value.
    }
  }
  return [value.toLowerCase()];
};

const getYesopMockBaselineTotals = (campaignId: string, ga4CampaignFilter: unknown) => {
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
  let profiles = parseGA4CampaignFilter(ga4CampaignFilter)
    .map((name) => utmToProfile[name])
    .filter(Boolean)
    .map((id) => campaignProfiles[id])
    .filter(Boolean);
  if (campaignProfiles[campaignId]) profiles = [campaignProfiles[campaignId]];
  if (profiles.length === 0) profiles = [{ scale: 1, engagementDelta: 0 }];
  const scale = profiles.reduce((sum, p) => sum + p.scale, 0) || 1;
  const weightedEngagementDelta = profiles.reduce((sum, p) => sum + p.engagementDelta * p.scale, 0) / scale;
  return {
    users: Math.round(31800 * scale),
    sessions: Math.round(41000 * scale),
    conversions: Math.round(1620 * scale),
    revenue: round2(150220.15 * scale),
    engagementRate: Math.min(100, Math.max(0, (0.57 + weightedEngagementDelta) * 100)),
  };
};

async function getCampaignMetricTotals(campaignId: string, useFullFinancialCandidate = false): Promise<CampaignMetricTotals | null> {
  const campaign = await storage.getCampaign(campaignId).catch(() => null as any);
  if (!campaign) return null;

  const startDate = toISODateUTC((campaign as any)?.startDate) || "1900-01-01";
  const endDate = todayUTC();
  let ga4Revenue = 0;
  let conversions = 0;
  let financialConversions: number | null = null;
  let users = 0;
  let sessions = 0;
  let engagementRate = 0;

  const connections = await storage.getGA4Connections(campaignId).catch(() => [] as any[]);
  const primary = (connections || []).find((conn: any) => conn?.isPrimary) || (connections || [])[0];
  if (primary?.propertyId) {
    const propertyId = String(primary.propertyId);
    const rows = await storage.getGA4DailyMetrics(campaignId, propertyId, startDate, endDate).catch(() => [] as any[]);
    let engagementSum = 0;
    let engagementRows = 0;
    for (const row of rows || []) {
      sessions += parseNum((row as any)?.sessions);
      users += parseNum((row as any)?.users);
      conversions += parseNum((row as any)?.conversions);
      ga4Revenue += parseNum((row as any)?.revenue);
      const rawRate = parseNum((row as any)?.engagementRate);
      if (rawRate > 0) {
        engagementSum += rawRate > 0 && rawRate <= 1 ? rawRate * 100 : rawRate;
        engagementRows += 1;
      }
    }
    if (engagementRows > 0) engagementRate = engagementSum / engagementRows;
    if (isYesopMockProperty(propertyId)) {
      const baseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter);
      sessions += baseline.sessions;
      users += baseline.users;
      conversions += baseline.conversions;
      ga4Revenue += baseline.revenue;
      engagementRate = engagementRate > 0 ? engagementRate : baseline.engagementRate;
      financialConversions = conversions;
    } else if (useFullFinancialCandidate) {
      const financialEndDate = previousCompleteUTC();
      const financialRows = await storage.getGA4DailyMetrics(campaignId, propertyId, startDate, financialEndDate).catch(() => [] as any[]);
      const dailyCandidate = (financialRows || []).reduce((totals: any, row: any) => ({
        revenue: totals.revenue + parseNum(row?.revenue),
        conversions: totals.conversions + parseNum(row?.conversions),
      }), { revenue: 0, conversions: 0 });
      let toDateCandidate: any = null;
      let breakdownCandidate: any = null;
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      if ((primary as any)?.method === "access_token" && (primary as any)?.accessToken && startDate <= financialEndDate) {
        try {
          const toDate = await ga4Service.getTotalsWithRevenue(
            propertyId,
            String((primary as any).accessToken),
            startDate,
            financialEndDate,
            campaignFilter,
          );
          toDateCandidate = (toDate as any)?.totals || {};
        } catch {
          // Keep persisted and breakdown candidates when to-date provider totals are unavailable.
        }
      }
      try {
        const lookbackDays = [30, 60, 90].includes(Number((primary as any)?.lookbackDays))
          ? Number((primary as any).lookbackDays)
          : 90;
        const breakdown = await ga4Service.getAcquisitionBreakdown(
          campaignId,
          storage,
          `${lookbackDays}daysAgo`,
          propertyId,
          2000,
          campaignFilter,
        );
        breakdownCandidate = (breakdown as any)?.totals || {};
      } catch {
        // Keep persisted and to-date candidates when breakdown totals are unavailable.
      }
      const selectedFinancialCandidate = selectGA4FinancialTotalsSource([
        toDateCandidate,
        financialRows.length > 0 ? dailyCandidate : null,
        breakdownCandidate,
      ], toDateCandidate || dailyCandidate);
      ga4Revenue = parseNum(selectedFinancialCandidate?.revenue);
      financialConversions = parseNum(selectedFinancialCandidate?.conversions);
    }
  }
  if (financialConversions === null) financialConversions = conversions;

  const [revenueTotals, spendTotals, revenueBreakdown, spendBreakdown] = await Promise.all([
    storage.getRevenueTotalForRange(campaignId, financialSourceStartDate, endDate, "ga4").catch(() => ({ totalRevenue: 0 })),
    storage.getSpendTotalForRange(campaignId, financialSourceStartDate, endDate).catch(() => ({ totalSpend: 0 })),
    storage.getRevenueBreakdownBySource(campaignId, financialSourceStartDate, endDate, "ga4").catch(() => [] as any[]),
    storage.getSpendBreakdownBySource(campaignId, financialSourceStartDate, endDate).catch(() => [] as any[]),
  ]);

  return {
    revenue: round2(ga4Revenue + parseNum((revenueTotals as any)?.totalRevenue)),
    ga4Revenue: round2(ga4Revenue),
    spend: round2(parseNum((spendTotals as any)?.totalSpend)),
    conversions: Math.round(conversions),
    financialConversions: Math.round(financialConversions),
    users: Math.round(users),
    sessions: Math.round(sessions),
    engagementRate: round2(engagementRate),
    revenueBySource: new Map((revenueBreakdown || []).map((row: any) => [String(row?.sourceId || ""), parseNum(row?.revenue)])),
    spendBySource: new Map((spendBreakdown || []).map((row: any) => [String(row?.sourceId || ""), parseNum(row?.spend)])),
  };
}

function sourceValue(inputKey: string, sourceId: string, totals: CampaignMetricTotals): number {
  if (sourceId === "total_revenue") return totals.revenue;
  if (sourceId === "total_spend") return totals.spend;
  if (sourceId === "total_conversions") return totals.conversions;
  if (sourceId === "total_users") return totals.users;
  if (sourceId === "total_sessions") return totals.sessions;
  if (sourceId === "total_engagement_rate") return totals.engagementRate;
  if (sourceId.startsWith("revenue-source:")) return totals.revenueBySource.get(sourceId.replace("revenue-source:", "")) || 0;
  if (sourceId.startsWith("spend-source:")) return totals.spendBySource.get(sourceId.replace("spend-source:", "")) || 0;
  if (sourceId === "ga4" && inputKey === "revenue") return totals.ga4Revenue;
  if (sourceId === "ga4" && inputKey === "conversions") return totals.conversions;
  if (sourceId === "ga4" && inputKey === "users") return totals.users;
  if (sourceId === "ga4" && inputKey === "sessions") return totals.sessions;
  if (sourceId === "ga4" && inputKey === "engagementRate") return totals.engagementRate;
  return 0;
}

function sumSelected(inputKey: string, sourceIds: string[] | undefined, totals: CampaignMetricTotals): number {
  return (sourceIds || []).reduce((sum, id) => sum + sourceValue(inputKey, String(id), totals), 0);
}

function sumSelectedFinancialConversions(sourceIds: string[] | undefined, totals: CampaignMetricTotals): number {
  return (sourceIds || []).reduce((sum, id) => {
    const sourceId = String(id);
    if (sourceId === "total_conversions" || sourceId === "ga4") return sum + totals.financialConversions;
    return sum + sourceValue("conversions", sourceId, totals);
  }, 0);
}

export function computeCampaignCurrentValueFromConfig(rawConfig: unknown, totals: CampaignMetricTotals): number | null {
  const cfg = parseConfig(rawConfig);
  const metric = String(cfg?.metric || "").trim();
  if (!metric) return null;

  if (metric === "revenue") return round2(sumSelected("revenue", cfg?.inputs?.revenue, totals));
  if (metric === "spend") return round2(sumSelected("spend", cfg?.inputs?.spend, totals));
  if (metric === "conversions") return Math.round(sumSelected("conversions", cfg?.inputs?.conversions, totals));
  if (metric === "users") return Math.round(sumSelected("users", cfg?.inputs?.users, totals));
  if (metric === "sessions") return Math.round(sumSelected("sessions", cfg?.inputs?.sessions, totals));
  if (metric === "engagementRate") return round2(sumSelected("engagementRate", cfg?.inputs?.engagementRate, totals));
  if (metric === "conversion-rate-website") {
    const conv = sumSelected("conversions", cfg?.inputs?.conversions, totals);
    const sessions = sumSelected("sessions", cfg?.inputs?.sessions, totals);
    return sessions > 0 ? round2((conv / sessions) * 100) : 0;
  }
  if (metric === "roas") {
    const revenue = sumSelected("revenue", cfg?.inputs?.revenue, totals);
    const spend = sumSelected("spend", cfg?.inputs?.spend, totals);
    return spend > 0 ? round2(revenue / spend) : 0;
  }
  if (metric === "roi") {
    const revenue = sumSelected("revenue", cfg?.inputs?.revenue, totals);
    const spend = sumSelected("spend", cfg?.inputs?.spend, totals);
    return spend > 0 ? round2(((revenue - spend) / spend) * 100) : 0;
  }
  if (metric === "profit") {
    const revenue = sumSelected("revenue", cfg?.inputs?.revenue, totals);
    const spend = sumSelected("spend", cfg?.inputs?.spend, totals);
    return round2(revenue - spend);
  }
  if (metric === "cpa") {
    const spend = sumSelected("spend", cfg?.inputs?.spend, totals);
    const conversions = sumSelectedFinancialConversions(cfg?.inputs?.conversions, totals);
    return conversions > 0 ? round2(spend / conversions) : 0;
  }

  return null;
}

export async function resolveCampaignCurrentValueForAlert<T extends { campaignId?: string | null; calculationConfig?: unknown; currentValue?: unknown }>(
  row: T,
  cache?: Map<string, Promise<CampaignMetricTotals | null>>
): Promise<T> {
  const campaignId = String(row?.campaignId || "").trim();
  if (!campaignId || !isCampaignLevel(row) || !row?.calculationConfig) return row;

  const config = parseConfig(row.calculationConfig);
  const useFullFinancialCandidate = isFinancialMetric(config?.metric);
  const cacheKey = `${campaignId}:${useFullFinancialCandidate ? "financial" : "base"}`;
  const totalsPromise = cache?.get(cacheKey) || getCampaignMetricTotals(campaignId, useFullFinancialCandidate);
  if (cache && !cache.has(cacheKey)) cache.set(cacheKey, totalsPromise);
  const totals = await totalsPromise;
  if (!totals) return row;

  const currentValue = computeCampaignCurrentValueFromConfig(row.calculationConfig, totals);
  if (currentValue === null || !Number.isFinite(currentValue)) return row;
  return { ...row, currentValue: String(currentValue) };
}

export async function refreshCampaignCurrentValuesForCampaign(campaignId: string): Promise<{ kpisUpdated: number; benchmarksUpdated: number }> {
  const id = String(campaignId || "").trim();
  if (!id) return { kpisUpdated: 0, benchmarksUpdated: 0 };

  const [kpis, benchmarks] = await Promise.all([
    storage.getCampaignKPIs(id).catch(() => [] as any[]),
    storage.getCampaignBenchmarks(id).catch(() => [] as any[]),
  ]);
  const rows = [...(Array.isArray(kpis) ? kpis : []), ...(Array.isArray(benchmarks) ? benchmarks : [])];
  const useFullFinancialCandidate = rows.some((row: any) => isFinancialMetric(parseConfig(row?.calculationConfig)?.metric));
  const totals = await getCampaignMetricTotals(id, useFullFinancialCandidate);
  if (!totals) return { kpisUpdated: 0, benchmarksUpdated: 0 };

  let kpisUpdated = 0;
  for (const kpi of Array.isArray(kpis) ? kpis : []) {
    if (!isCampaignLevel(kpi) || !(kpi as any)?.calculationConfig) continue;
    const currentValue = computeCampaignCurrentValueFromConfig((kpi as any).calculationConfig, totals);
    if (currentValue === null || !Number.isFinite(currentValue)) continue;
    const previous = (kpi as any)?.currentValue === null || typeof (kpi as any)?.currentValue === "undefined" ? null : round2(parseNum((kpi as any).currentValue));
    if (previous !== null && previous === round2(currentValue)) continue;
    await storage.updateKPI(String((kpi as any).id), { currentValue: String(round2(currentValue)) } as any);
    kpisUpdated += 1;
  }

  let benchmarksUpdated = 0;
  for (const benchmark of Array.isArray(benchmarks) ? benchmarks : []) {
    if (!isCampaignLevel(benchmark) || !(benchmark as any)?.calculationConfig) continue;
    const currentValue = computeCampaignCurrentValueFromConfig((benchmark as any).calculationConfig, totals);
    if (currentValue === null || !Number.isFinite(currentValue)) continue;
    const previous = (benchmark as any)?.currentValue === null || typeof (benchmark as any)?.currentValue === "undefined" ? null : round2(parseNum((benchmark as any).currentValue));
    if (previous !== null && previous === round2(currentValue)) continue;
    await storage.updateBenchmark(String((benchmark as any).id), { currentValue: String(round2(currentValue)) } as any);
    benchmarksUpdated += 1;
  }

  return { kpisUpdated, benchmarksUpdated };
}
