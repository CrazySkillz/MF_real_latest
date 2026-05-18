type SourceCategory = "web_analytics" | "paid_media" | "financial" | "custom";

type MetricAvailability = {
  value: number | null;
  available: boolean;
  sources: string[];
  unavailableReasons: string[];
};

type SourceMetric = number | null;

type SourceBreakdown = {
  id: string;
  label: string;
  category: SourceCategory;
  connected: boolean;
  capabilities: string[];
  includedMetrics: string[];
  excludedMetrics: { metric: string; reason: string }[];
  metrics: Record<string, SourceMetric>;
  freshness?: Record<string, any>;
};

type PerformanceSummaryAggregateInput = {
  campaignId: string;
  dateRange: string;
  ga4?: any;
  webAnalytics?: any;
  spend?: any;
  platforms?: {
    linkedin?: any;
    meta?: any;
    customIntegration?: any;
  };
  revenue?: any;
  revenueSources?: any[];
};

const parseNum = (value: any): number => {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round2 = (value: number): number => parseFloat(value.toFixed(2));

const metric = (value: number | null, sources: string[], unavailableReasons: string[] = []): MetricAvailability => ({
  value,
  available: sources.length > 0,
  sources,
  unavailableReasons: sources.length > 0 ? [] : unavailableReasons,
});

const addSource = (
  sources: SourceBreakdown[],
  source: SourceBreakdown,
) => {
  if (source.connected) sources.push(source);
};

export function buildPerformanceSummaryAggregate(input: PerformanceSummaryAggregateInput) {
  const platforms = input.platforms || {};
  const sourceBreakdown: SourceBreakdown[] = [];

  const ga4Connected = input.ga4?.connected === true;
  addSource(sourceBreakdown, {
    id: "ga4",
    label: "Google Analytics",
    category: "web_analytics",
    connected: ga4Connected,
    capabilities: ["users", "sessions", "conversions", "revenue"],
    includedMetrics: ga4Connected ? ["users", "sessions", "conversions", "revenue"] : [],
    excludedMetrics: [
      { metric: "impressions", reason: "GA4 is not an ad-impression source" },
      { metric: "clicks", reason: "GA4 is not an ad-click source" },
      { metric: "spend", reason: "Spend is not a GA4 metric" },
      { metric: "leads", reason: "Leads are not available from GA4 unless mapped as conversions" },
    ],
    metrics: {
      users: parseNum(input.ga4?.users),
      sessions: parseNum(input.ga4?.sessions),
      conversions: parseNum(input.ga4?.conversions),
      revenue: parseNum(input.ga4?.revenue),
    },
  });

  const linkedin = platforms.linkedin || {};
  const linkedinConnected = linkedin.connected === true;
  addSource(sourceBreakdown, {
    id: "linkedin",
    label: "LinkedIn Ads",
    category: "paid_media",
    connected: linkedinConnected,
    capabilities: ["impressions", "clicks", "spend", "conversions", "leads", "attributedRevenue"],
    includedMetrics: linkedinConnected ? ["impressions", "clicks", "spend", "conversions", "leads", "attributedRevenue"] : [],
    excludedMetrics: [
      { metric: "sessions", reason: "Sessions are web analytics metrics" },
      { metric: "users", reason: "Users are web analytics metrics" },
      { metric: "pageviews", reason: "Pageviews are web analytics metrics" },
    ],
    metrics: {
      impressions: parseNum(linkedin.impressions),
      clicks: parseNum(linkedin.clicks),
      spend: parseNum(linkedin.spend),
      conversions: parseNum(linkedin.conversions),
      leads: parseNum(linkedin.leads),
      attributedRevenue: parseNum(linkedin.attributedRevenue),
    },
    freshness: linkedin.lastImportedAt ? { lastImportedAt: linkedin.lastImportedAt } : undefined,
  });

  const meta = platforms.meta || {};
  const metaConnected = meta.connected === true;
  addSource(sourceBreakdown, {
    id: "meta",
    label: "Meta Ads",
    category: "paid_media",
    connected: metaConnected,
    capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
    includedMetrics: metaConnected ? ["impressions", "clicks", "spend", "conversions", "attributedRevenue"] : [],
    excludedMetrics: [
      { metric: "sessions", reason: "Sessions are web analytics metrics" },
      { metric: "users", reason: "Users are web analytics metrics" },
      { metric: "pageviews", reason: "Pageviews are web analytics metrics" },
      { metric: "leads", reason: "Leads are not available in the current Meta aggregate" },
    ],
    metrics: {
      impressions: parseNum(meta.impressions),
      clicks: parseNum(meta.clicks),
      spend: parseNum(meta.spend),
      conversions: parseNum(meta.conversions),
      attributedRevenue: parseNum(meta.attributedRevenue),
    },
  });

  const custom = platforms.customIntegration || {};
  const customConnected = custom.connected === true;
  const customIsWebProvider = input.webAnalytics?.provider === "custom_integration";
  addSource(sourceBreakdown, {
    id: "custom_integration",
    label: "Custom Integration",
    category: "custom",
    connected: customConnected,
    capabilities: ["impressions", "clicks", "spend", "conversions", "users", "sessions", "pageviews", "revenue"],
    includedMetrics: customConnected
      ? ["impressions", "clicks", "spend", "conversions", ...(customIsWebProvider ? ["users", "sessions", "pageviews", "revenue"] : [])]
      : [],
    excludedMetrics: customConnected && !customIsWebProvider
      ? [
          { metric: "users", reason: "GA4 is the primary web analytics source" },
          { metric: "sessions", reason: "GA4 is the primary web analytics source" },
          { metric: "pageviews", reason: "GA4 is the primary web analytics source" },
        ]
      : [],
    metrics: {
      impressions: parseNum(custom.impressions),
      clicks: parseNum(custom.clicks),
      spend: parseNum(custom.spend),
      conversions: parseNum(custom.conversions),
      users: parseNum(custom.users),
      sessions: parseNum(custom.sessions),
      pageviews: parseNum(custom.pageviews),
      revenue: parseNum(custom.revenue),
    },
    freshness: custom.lastUploadedAt ? { lastUploadedAt: custom.lastUploadedAt } : undefined,
  });

  const revenueSources = Array.isArray(input.revenueSources) ? input.revenueSources : [];
  for (const source of revenueSources) {
    if (source?.connected !== true) continue;
    addSource(sourceBreakdown, {
      id: `revenue_${String(source.type || "source")}`,
      label: String(source.type || "Revenue Source"),
      category: "financial",
      connected: true,
      capabilities: ["revenue"],
      includedMetrics: ["revenue"],
      excludedMetrics: [
        { metric: "impressions", reason: "Revenue sources do not provide ad impressions" },
        { metric: "clicks", reason: "Revenue sources do not provide ad clicks" },
        { metric: "spend", reason: "Revenue sources do not provide spend" },
        { metric: "sessions", reason: "Revenue sources do not provide web sessions" },
        { metric: "users", reason: "Revenue sources do not provide web users" },
      ],
      metrics: {
        revenue: parseNum(source.lastTotalRevenue),
      },
      freshness: source.platformContext ? { platformContext: source.platformContext } : undefined,
    });
  }

  const paidSources = sourceBreakdown.filter((source) => source.category === "paid_media" || source.id === "custom_integration");
  const paidMetricSources = (metricName: string) =>
    paidSources.filter((source) => source.includedMetrics.includes(metricName));
  const sumPaidMetric = (metricName: string) =>
    paidMetricSources(metricName).reduce((sum, source) => sum + parseNum(source.metrics[metricName]), 0);

  const webConnected = input.webAnalytics?.connected === true;
  const webSource = webConnected && input.webAnalytics?.provider === "ga4" ? "ga4"
    : webConnected && input.webAnalytics?.provider === "custom_integration" ? "custom_integration"
      : null;

  const spendValue = parseNum(input.spend?.unifiedSpend);
  const hasCanonicalSpendSource = input.spend?.spendSource === "persisted_spend_sources"
    || (Array.isArray(input.spend?.sourceIds) && input.spend.sourceIds.length > 0);
  const spendSource = hasCanonicalSpendSource
    ? ["canonical_spend_sources"]
    : paidMetricSources("spend").map((source) => source.id);
  const revenueValue = parseNum(input.revenue?.totalRevenue);
  const revenueSourceIds = sourceBreakdown.filter((source) => source.includedMetrics.includes("revenue")).map((source) => source.id);

  const impressionsSources = paidMetricSources("impressions").map((source) => source.id);
  const clicksSources = paidMetricSources("clicks").map((source) => source.id);
  const paidConversionSources = paidMetricSources("conversions").map((source) => source.id);
  const conversionSources = webSource ? [webSource] : paidConversionSources;
  const leadsSources = paidMetricSources("leads").map((source) => source.id);
  const sessionSources = webSource ? [webSource] : [];
  const userSources = webSource ? [webSource] : [];

  const totalImpressions = sumPaidMetric("impressions");
  const totalClicks = sumPaidMetric("clicks");
  const totalConversions = webSource
    ? parseNum(input.webAnalytics?.conversions)
    : sumPaidMetric("conversions");
  const totalLeads = sumPaidMetric("leads");
  const totalSessions = webSource ? parseNum(input.webAnalytics?.sessions) : 0;
  const totalUsers = webSource ? parseNum(input.webAnalytics?.users) : 0;
  const cpc = spendValue > 0 && totalClicks > 0 ? round2(spendValue / totalClicks) : null;
  const cpa = spendValue > 0 && totalConversions > 0 ? round2(spendValue / totalConversions) : null;
  const roas = spendValue > 0 && revenueValue > 0 ? round2(revenueValue / spendValue) : null;
  const roi = spendValue > 0 && revenueValue > 0 ? round2(((revenueValue - spendValue) / spendValue) * 100) : null;
  const ctr = totalImpressions > 0 && totalClicks > 0 ? round2((totalClicks / totalImpressions) * 100) : null;
  const cvr = totalClicks > 0 && totalConversions > 0 ? round2((totalConversions / totalClicks) * 100) : null;

  return {
    campaignId: input.campaignId,
    dateRange: input.dateRange,
    version: "performance_summary_aggregate_v1",
    sources: sourceBreakdown,
    totals: {
      impressions: metric(totalImpressions, impressionsSources, ["No connected paid-media source provides impressions"]),
      clicks: metric(totalClicks, clicksSources, ["No connected paid-media source provides clicks"]),
      conversions: metric(totalConversions, conversionSources, ["No connected source provides conversions"]),
      leads: metric(totalLeads, leadsSources, ["No connected source provides leads"]),
      sessions: metric(totalSessions, sessionSources, ["No connected web analytics source provides sessions"]),
      users: metric(totalUsers, userSources, ["No connected web analytics source provides users"]),
      spend: metric(spendValue, spendSource, ["No connected spend source or paid-platform spend is available"]),
      revenue: metric(revenueValue, revenueSourceIds, ["No connected revenue source provides revenue"]),
      roas: metric(roas, roas === null ? [] : ["revenue", "spend"], ["ROAS requires available revenue and spend"]),
      roi: metric(roi, roi === null ? [] : ["revenue", "spend"], ["ROI requires available revenue and spend"]),
      cpc: metric(cpc, cpc === null ? [] : ["spend", "clicks"], ["CPC requires available spend and clicks"]),
      cpa: metric(cpa, cpa === null ? [] : ["spend", "conversions"], ["CPA requires available spend and conversions"]),
      ctr: metric(ctr, ctr === null ? [] : ["clicks", "impressions"], ["CTR requires available clicks and impressions"]),
      cvr: metric(cvr, cvr === null ? [] : ["conversions", "clicks"], ["CVR requires available conversions and clicks"]),
    },
  };
}
