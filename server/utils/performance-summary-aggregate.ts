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
  revenueSemantics?: Record<string, any>;
  freshness?: Record<string, any>;
};

type PerformanceSummaryAggregateInput = {
  campaignId: string;
  dateRange: string;
  currentValueWindow?: {
    mode: "initial_import_to_latest_completed_day";
    startDate: string;
    endDate: string;
    dataThroughDate: string;
    reportingTimeZone: string;
  };
  ga4?: any;
  webAnalytics?: any;
  financialConversions?: { value?: unknown; available?: boolean; sources?: unknown };
  spend?: any;
  platforms?: {
    linkedin?: any;
    meta?: any;
    customIntegration?: any;
  };
  revenue?: any;
  revenueSources?: any[];
  platformSources?: any[];
};

type SourceAdapter = {
  id: string;
  build: (input: PerformanceSummaryAggregateInput) => SourceBreakdown;
};

const parseNum = (value: any): number => {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const hasSourceMetric = (source: any, metricName: string): boolean => {
  const value = source?.[metricName];
  return value !== null && typeof value !== "undefined" && value !== "";
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

const addMainSource = (
  sources: SourceBreakdown[],
  source: SourceBreakdown,
) => {
  if (!source.connected || sources.some((existing) => existing.id === source.id)) return;
  sources.push(source);
};

const normalizeMainPlatformSource = (source: any): SourceBreakdown | null => {
  const id = String(source?.id || "").trim();
  if (!id || source?.connected !== true || source?.category === "financial") return null;
  const metrics = source?.metrics && typeof source.metrics === "object" ? source.metrics : {};
  return {
    id,
    label: String(source?.label || id),
    category: ["web_analytics", "paid_media", "custom"].includes(String(source?.category))
      ? source.category
      : "custom",
    connected: true,
    capabilities: Array.isArray(source?.capabilities) ? source.capabilities.map(String) : [],
    includedMetrics: Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String) : [],
    excludedMetrics: Array.isArray(source?.excludedMetrics) ? source.excludedMetrics : [],
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, value === null ? null : parseNum(value)]),
    ),
    revenueSemantics: source?.revenueSemantics && typeof source.revenueSemantics === "object" ? source.revenueSemantics : undefined,
    freshness: source?.freshness && typeof source.freshness === "object" ? source.freshness : undefined,
  };
};

const mainSourceAdapters: SourceAdapter[] = [
  {
    id: "ga4",
    build: (input) => {
      const ga4Connected = input.ga4?.connected === true;
      const ga4Available = ga4Connected && input.ga4?.available !== false;
      return {
        id: "ga4",
        label: "Google Analytics",
        category: "web_analytics",
        connected: ga4Connected,
        capabilities: ["users", "sessions", "conversions", "revenue"],
        includedMetrics: ga4Available ? ["users", "sessions", "conversions", "revenue"] : [],
        excludedMetrics: [
          { metric: "impressions", reason: "GA4 is not an ad-impression source" },
          { metric: "clicks", reason: "GA4 is not an ad-click source" },
          { metric: "spend", reason: "Spend is not a GA4 metric" },
          { metric: "leads", reason: "Leads are not available from GA4 unless mapped as conversions" },
        ],
        metrics: {
          users: ga4Available ? parseNum(input.ga4?.users) : null,
          sessions: ga4Available ? parseNum(input.ga4?.sessions) : null,
          conversions: ga4Available ? parseNum(input.ga4?.conversions) : null,
          revenue: ga4Available ? parseNum(input.ga4?.revenue) : null,
        },
      };
    },
  },
  {
    id: "linkedin",
    build: (input) => {
      const linkedin = input.platforms?.linkedin || {};
      const linkedinConnected = linkedin.connected === true;
      const linkedinAvailable = linkedinConnected && linkedin.available !== false;
      const linkedinSpendAvailable = linkedinAvailable && linkedin.spendAvailable !== false;
      const hasLinkedInRevenue = linkedinAvailable && linkedin.hasRevenueTracking === true;
      return {
        id: "linkedin",
        label: "LinkedIn Ads",
        category: "paid_media",
        connected: linkedinConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions", "leads", "attributedRevenue"],
        includedMetrics: linkedinAvailable
          ? ["impressions", "clicks", ...(linkedinSpendAvailable ? ["spend"] : []), "conversions", "leads", ...(hasLinkedInRevenue ? ["attributedRevenue"] : [])]
          : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          { metric: "pageviews", reason: "Pageviews are web analytics metrics" },
          ...(linkedinConnected && !hasLinkedInRevenue
            ? [{ metric: "attributedRevenue", reason: "LinkedIn revenue requires a LinkedIn-scoped revenue source" }]
            : []),
        ],
        metrics: {
          impressions: linkedinAvailable ? parseNum(linkedin.impressions) : null,
          clicks: linkedinAvailable ? parseNum(linkedin.clicks) : null,
          spend: linkedinSpendAvailable ? parseNum(linkedin.spend) : null,
          conversions: linkedinAvailable ? parseNum(linkedin.conversions) : null,
          leads: linkedinAvailable ? parseNum(linkedin.leads) : null,
          attributedRevenue: hasLinkedInRevenue ? parseNum(linkedin.attributedRevenue) : null,
        },
        freshness: linkedin.lastImportedAt ? { lastImportedAt: linkedin.lastImportedAt } : undefined,
      };
    },
  },
  {
    id: "meta",
    build: (input) => {
      const meta = input.platforms?.meta || {};
      const metaConnected = meta.connected === true;
      const metaAvailable = metaConnected && meta.available !== false;
      const metaSpendAvailable = metaAvailable && meta.spendAvailable !== false;
      const hasMetaRevenue = metaAvailable && meta.hasRevenueTracking === true;
      return {
        id: "meta",
        label: "Meta Ads",
        category: "paid_media",
        connected: metaConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: metaAvailable
          ? ["impressions", "clicks", ...(metaSpendAvailable ? ["spend"] : []), "conversions", ...(hasMetaRevenue ? ["attributedRevenue"] : [])]
          : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          { metric: "pageviews", reason: "Pageviews are web analytics metrics" },
          { metric: "leads", reason: "Leads are not available in the current Meta aggregate" },
          ...(metaConnected && !hasMetaRevenue
            ? [{ metric: "attributedRevenue", reason: "Meta Total Revenue requires a Meta-scoped imported revenue source" }]
            : []),
        ],
        metrics: {
          impressions: metaAvailable ? parseNum(meta.impressions) : null,
          clicks: metaAvailable ? parseNum(meta.clicks) : null,
          spend: metaSpendAvailable ? parseNum(meta.spend) : null,
          conversions: metaAvailable ? parseNum(meta.conversions) : null,
          attributedRevenue: hasMetaRevenue ? parseNum(meta.attributedRevenue) : null,
        },
      };
    },
  },
  {
    id: "custom_integration",
    build: (input) => {
      const custom = input.platforms?.customIntegration || {};
      const customConnected = custom.connected === true;
      const customAvailable = customConnected && custom.available !== false;
      const customIsWebProvider = input.webAnalytics?.provider === "custom_integration";
      const paidMetricKeys = ["impressions", "clicks", "spend", "conversions"];
      const webMetricKeys = ["users", "sessions", "pageviews", "revenue"];
      const includedPaidMetrics = paidMetricKeys.filter((metricName) => hasSourceMetric(custom, metricName));
      const includedWebMetrics = customIsWebProvider
        ? webMetricKeys.filter((metricName) => hasSourceMetric(custom, metricName))
        : [];
      return {
        id: "custom_integration",
        label: "Custom Integration",
        category: "custom",
        connected: customConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions", "users", "sessions", "pageviews", "revenue"],
        includedMetrics: customAvailable
          ? [...includedPaidMetrics, ...includedWebMetrics]
          : [],
        excludedMetrics: customConnected
          ? [
              ...paidMetricKeys
                .filter((metricName) => !hasSourceMetric(custom, metricName))
                .map((metricName) => ({
                  metric: metricName,
                  reason: `Selected Custom Integration import does not include ${metricName}`,
                })),
              ...webMetricKeys
                .filter((metricName) => !customIsWebProvider || !hasSourceMetric(custom, metricName))
                .map((metricName) => ({
                  metric: metricName,
                  reason: customIsWebProvider
                    ? `Selected Custom Integration import does not include ${metricName}`
                    : input.webAnalytics?.provider === "ga4"
                      ? "GA4 is the primary web analytics source"
                      : hasSourceMetric(custom, metricName)
                        ? "Custom Integration is not the active web analytics source"
                        : `Selected Custom Integration import does not include ${metricName}`,
                })),
            ]
          : [],
        metrics: {
          impressions: customAvailable ? parseNum(custom.impressions) : null,
          clicks: customAvailable ? parseNum(custom.clicks) : null,
          spend: customAvailable ? parseNum(custom.spend) : null,
          conversions: customAvailable ? parseNum(custom.conversions) : null,
          users: customAvailable ? parseNum(custom.users) : null,
          sessions: customAvailable ? parseNum(custom.sessions) : null,
          pageviews: customAvailable ? parseNum(custom.pageviews) : null,
          revenue: customAvailable ? parseNum(custom.revenue) : null,
        },
        freshness: custom.lastUploadedAt ? { lastUploadedAt: custom.lastUploadedAt } : undefined,
      };
    },
  },
];

export const getPerformanceSummaryMainSourceAdapterIds = () => mainSourceAdapters.map((adapter) => adapter.id);

export function buildPerformanceSummaryAggregate(input: PerformanceSummaryAggregateInput) {
  const sourceBreakdown: SourceBreakdown[] = [];
  const currentValueWindow = input.currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && /^\d{4}-\d{2}-\d{2}$/.test(input.currentValueWindow.startDate)
    && /^\d{4}-\d{2}-\d{2}$/.test(input.currentValueWindow.endDate)
    && input.currentValueWindow.startDate <= input.currentValueWindow.endDate
    && input.currentValueWindow.dataThroughDate === input.currentValueWindow.endDate
    && Boolean(input.currentValueWindow.reportingTimeZone)
      ? input.currentValueWindow
      : null;

  for (const adapter of mainSourceAdapters) {
    addMainSource(sourceBreakdown, adapter.build(input));
  }

  const platformSources = Array.isArray(input.platformSources) ? input.platformSources : [];
  for (const source of platformSources) {
    const normalized = normalizeMainPlatformSource(source);
    if (normalized) addMainSource(sourceBreakdown, normalized);
  }

  const revenueSources = Array.isArray(input.revenueSources) ? input.revenueSources : [];
  const revenueAvailable = input.revenue?.available !== false;
  for (const source of revenueSources) {
    if (source?.connected !== true) continue;
    addSource(sourceBreakdown, {
      id: `revenue_${String(source.type || "source")}`,
      label: String(source.type || "Revenue Source"),
      category: "financial",
      connected: true,
      capabilities: ["revenue"],
      includedMetrics: revenueAvailable ? ["revenue"] : [],
      excludedMetrics: [
        { metric: "impressions", reason: "Revenue sources do not provide ad impressions" },
        { metric: "clicks", reason: "Revenue sources do not provide ad clicks" },
        { metric: "spend", reason: "Revenue sources do not provide spend" },
        { metric: "sessions", reason: "Revenue sources do not provide web sessions" },
        { metric: "users", reason: "Revenue sources do not provide web users" },
      ],
      metrics: {
        revenue: revenueAvailable ? parseNum(source.lastTotalRevenue) : null,
      },
      freshness: source.freshness && typeof source.freshness === "object"
        ? { ...source.freshness, ...(source.platformContext ? { platformContext: source.platformContext } : {}) }
        : source.platformContext ? { platformContext: source.platformContext } : undefined,
    });
  }

  const paidSources = sourceBreakdown.filter((source) => source.category === "paid_media" || source.id === "custom_integration");
  const paidMetricSources = (metricName: string) =>
    paidSources.filter((source) =>
      source.includedMetrics.includes(metricName)
    );
  const sumPaidMetric = (metricName: string) =>
    paidMetricSources(metricName).reduce((sum, source) => sum + parseNum(source.metrics[metricName]), 0);

  const webConnected = input.webAnalytics?.connected === true && input.webAnalytics?.available !== false;
  const webProviderConfigured = input.webAnalytics?.connected === true
    && ["ga4", "custom_integration"].includes(String(input.webAnalytics?.provider || ""));
  const webSource = webConnected && input.webAnalytics?.provider === "ga4" ? "ga4"
    : webConnected && input.webAnalytics?.provider === "custom_integration" ? "custom_integration"
      : null;

  const spendValue = parseNum(input.spend?.unifiedSpend);
  const spendAvailable = input.spend?.available !== false;
  const hasCanonicalSpendSource = spendAvailable && (input.spend?.spendSource === "persisted_spend_sources"
    || (Array.isArray(input.spend?.sourceIds) && input.spend.sourceIds.length > 0));
  const spendSource = hasCanonicalSpendSource
    ? ["canonical_spend_sources"]
    : spendAvailable ? paidMetricSources("spend").map((source) => source.id) : [];
  const revenueValue = parseNum(input.revenue?.totalRevenue);
  const revenueSourceIds = revenueAvailable
    ? sourceBreakdown
      .filter((source) => source.includedMetrics.includes("revenue") || source.includedMetrics.includes("attributedRevenue"))
      .map((source) => source.id)
    : [];
  const hasRevenue = revenueSourceIds.length > 0;
  const hasSpend = spendSource.length > 0;

  const impressionsSources = paidMetricSources("impressions").map((source) => source.id);
  const clicksSources = paidMetricSources("clicks").map((source) => source.id);
  const paidConversionSources = paidMetricSources("conversions").map((source) => source.id);
  const conversionSources = webSource ? [webSource] : webProviderConfigured ? [] : paidConversionSources;
  const leadsSources = paidMetricSources("leads").map((source) => source.id);
  const sessionSources = webSource ? [webSource] : [];
  const userSources = webSource ? [webSource] : [];

  const totalImpressions = sumPaidMetric("impressions");
  const totalClicks = sumPaidMetric("clicks");
  const totalConversions = webSource
    ? parseNum(input.webAnalytics?.conversions)
    : webProviderConfigured ? 0 : sumPaidMetric("conversions");
  const hasSeparateFinancialConversions = typeof input.financialConversions !== "undefined";
  const financialConversionSources = input.financialConversions?.available === true && Array.isArray(input.financialConversions.sources)
    ? input.financialConversions.sources.map(String).filter(Boolean)
    : [];
  const cpaConversions = hasSeparateFinancialConversions ? parseNum(input.financialConversions?.value) : totalConversions;
  const cpaConversionsAvailable = hasSeparateFinancialConversions ? financialConversionSources.length > 0 : conversionSources.length > 0;
  const totalLeads = sumPaidMetric("leads");
  const totalSessions = webSource ? parseNum(input.webAnalytics?.sessions) : 0;
  const totalUsers = webSource ? parseNum(input.webAnalytics?.users) : 0;
  const costSources = currentValueWindow ? paidMetricSources("spend") : paidSources;
  const costSpendValue = currentValueWindow
    ? costSources.reduce((sum, source) => sum + parseNum(source.metrics.spend), 0)
    : spendValue;
  const costClicks = currentValueWindow
    ? costSources.reduce((sum, source) => sum + (source.includedMetrics.includes("clicks") ? parseNum(source.metrics.clicks) : 0), 0)
    : totalClicks;
  const costImpressions = currentValueWindow
    ? costSources.reduce((sum, source) => sum + (source.includedMetrics.includes("impressions") ? parseNum(source.metrics.impressions) : 0), 0)
    : totalImpressions;
  const cpc = costSpendValue > 0 && costClicks > 0 ? round2(costSpendValue / costClicks) : null;
  const cpa = spendValue > 0 && cpaConversions > 0 && cpaConversionsAvailable ? round2(spendValue / cpaConversions) : null;
  const cpm = costSpendValue > 0 && costImpressions > 0 ? round2((costSpendValue / costImpressions) * 1000) : null;
  const roas = hasRevenue && hasSpend && spendValue > 0 ? round2(revenueValue / spendValue) : null;
  const roi = hasRevenue && hasSpend && spendValue > 0 ? round2(((revenueValue - spendValue) / spendValue) * 100) : null;
  const ctr = totalImpressions > 0 && totalClicks > 0 ? round2((totalClicks / totalImpressions) * 100) : null;
  const cvr = webSource && totalSessions > 0 && totalConversions > 0
      ? round2((totalConversions / totalSessions) * 100)
    : !webSource && totalClicks > 0 && totalConversions > 0
      ? round2((totalConversions / totalClicks) * 100)
      : null;
  const cvrSources = webSource && totalSessions > 0 && totalConversions > 0
      ? ["conversions", "sessions"]
    : !webSource && totalClicks > 0 && totalConversions > 0
      ? ["conversions", "clicks"]
      : [];

  return {
    campaignId: input.campaignId,
    dateRange: input.dateRange,
    version: currentValueWindow ? "performance_summary_aggregate_v3" : "performance_summary_aggregate_v2",
    ...(currentValueWindow ? { currentValueWindow } : {}),
    sources: sourceBreakdown,
    totals: {
      impressions: metric(totalImpressions, impressionsSources, ["No connected paid-media source provides impressions; GA4 engagement rate is not an impressions metric"]),
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
      cpm: metric(cpm, cpm === null ? [] : ["spend", "impressions"], ["CPM requires available spend and impressions"]),
      ctr: metric(ctr, ctr === null ? [] : ["clicks", "impressions"], ["CTR requires available clicks and impressions"]),
      cvr: metric(cvr, cvrSources, ["CVR requires available conversions and clicks or web sessions"]),
    },
  };
}
