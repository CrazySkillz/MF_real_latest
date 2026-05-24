type SourceCategory = "web_analytics" | "paid_media" | "custom";

type TrendSourceInput = {
  id: string;
  label: string;
  category: SourceCategory;
  connected: boolean;
  capabilities: string[];
  includedMetrics: string[];
  excludedMetrics: { metric: string; reason: string }[];
  dailyRows: Array<{ date: string; metrics: Record<string, any> }>;
  freshness?: Record<string, any>;
};

type FinancialDailyRow = {
  date: string;
  spend?: any;
  revenue?: any;
};

type TrendAnalysisAggregateInput = {
  campaignId: string;
  dateRange: string;
  startDate: string;
  endDate: string;
  sources: TrendSourceInput[];
  financialDailyRows?: FinancialDailyRow[];
};

const parseNum = (value: any): number => {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => parseFloat(value.toFixed(2));

const normalizeDate = (value: any): string => String(value || "").slice(0, 10);

const hasMetric = (source: TrendSourceInput, metricName: string) =>
  source.includedMetrics.includes(metricName);

const metricSources = (sources: TrendSourceInput[], metricName: string) =>
  sources.filter((source) => hasMetric(source, metricName)).map((source) => source.id);

export function buildTrendAnalysisAggregate(input: TrendAnalysisAggregateInput) {
  const sources = input.sources
    .filter((source) => source.connected === true)
    .map((source) => ({
      id: String(source.id),
      label: String(source.label || source.id),
      category: source.category,
      connected: true,
      capabilities: Array.isArray(source.capabilities) ? source.capabilities.map(String) : [],
      includedMetrics: Array.isArray(source.includedMetrics) ? source.includedMetrics.map(String) : [],
      excludedMetrics: Array.isArray(source.excludedMetrics) ? source.excludedMetrics : [],
      freshness: source.freshness,
      dailyRows: (Array.isArray(source.dailyRows) ? source.dailyRows : [])
        .map((row) => ({
          date: normalizeDate(row.date),
          metrics: Object.fromEntries(
            Object.entries(row.metrics || {}).map(([key, value]) => [key, round2(parseNum(value))]),
          ),
        }))
        .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date)),
    }));

  const totalsByDate = new Map<string, Record<string, number>>();
  const ensureDate = (date: string) => {
    const existing = totalsByDate.get(date);
    if (existing) return existing;
    const created: Record<string, number> = { spend: 0, revenue: 0 };
    totalsByDate.set(date, created);
    return created;
  };

  for (const source of sources) {
    for (const row of source.dailyRows) {
      const total = ensureDate(row.date);
      for (const metricName of source.includedMetrics) {
        total[metricName] = round2((total[metricName] || 0) + parseNum(row.metrics[metricName]));
      }
    }
  }

  const financialRows = Array.isArray(input.financialDailyRows) ? input.financialDailyRows : [];
  for (const row of financialRows) {
    const date = normalizeDate(row.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const total = ensureDate(date);
    total.spend = round2(parseNum(row.spend));
    total.revenue = round2(parseNum(row.revenue) || total.revenue || 0);
  }

  const dailyTotals = Array.from(totalsByDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, metrics]) => {
      const spend = parseNum(metrics.spend);
      const revenue = parseNum(metrics.revenue);
      const impressions = parseNum(metrics.impressions);
      const clicks = parseNum(metrics.clicks);
      const conversions = parseNum(metrics.conversions);
      const sessions = parseNum(metrics.sessions);
      return {
        date,
        metrics: {
          ...metrics,
          cpc: spend > 0 && clicks > 0 ? round2(spend / clicks) : null,
          cpm: spend > 0 && impressions > 0 ? round2((spend / impressions) * 1000) : null,
          cpa: spend > 0 && conversions > 0 ? round2(spend / conversions) : null,
          roas: spend > 0 && revenue > 0 ? round2(revenue / spend) : null,
          roi: spend > 0 && revenue > 0 ? round2(((revenue - spend) / spend) * 100) : null,
          ctr: impressions > 0 && clicks > 0 ? round2((clicks / impressions) * 100) : null,
          cvr: clicks > 0 && conversions > 0
            ? round2((conversions / clicks) * 100)
            : sessions > 0 && conversions > 0
              ? round2((conversions / sessions) * 100)
              : null,
        },
      };
    });

  const availableSources = (metricName: string) => {
    const sourcesForMetric = metricSources(sources, metricName);
    if (metricName === "spend" && financialRows.some((row) => parseNum(row.spend) > 0)) {
      return ["canonical_spend_sources"];
    }
    return sourcesForMetric;
  };

  return {
    campaignId: input.campaignId,
    dateRange: input.dateRange,
    startDate: input.startDate,
    endDate: input.endDate,
    version: "trend_analysis_aggregate_v1",
    sources,
    dailyTotals,
    metrics: {
      users: { sources: availableSources("users"), unavailableReasons: ["No connected web analytics source provides users"] },
      sessions: { sources: availableSources("sessions"), unavailableReasons: ["No connected web analytics source provides sessions"] },
      conversions: { sources: availableSources("conversions"), unavailableReasons: ["No connected source provides conversions"] },
      revenue: { sources: availableSources("revenue"), unavailableReasons: ["No connected source provides revenue"] },
      spend: { sources: availableSources("spend"), unavailableReasons: ["No connected spend source provides spend"] },
      impressions: { sources: availableSources("impressions"), unavailableReasons: ["No connected paid-media source provides impressions"] },
      clicks: { sources: availableSources("clicks"), unavailableReasons: ["No connected paid-media source provides clicks"] },
    },
  };
}
