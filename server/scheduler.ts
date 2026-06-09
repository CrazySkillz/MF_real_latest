import { storage } from './storage';
import { buildPerformanceSummaryAggregate } from './utils/performance-summary-aggregate';
import { buildTrendAnalysisAggregate } from './utils/trend-analysis-aggregate';
import { db } from './db';
import { sql } from 'drizzle-orm';

interface SnapshotMetrics {
  totalImpressions: number;
  totalEngagements: number;
  totalClicks: number;
  totalConversions: number;
  totalLeads: number;
  totalSpend: number;
}

interface AggregateCampaignMetricsOptions {
  includeTrendAnalysis?: boolean;
}

const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

const hasSnapshotMetricValue = (metrics: SnapshotMetrics & { detailedMetrics: any }) => {
  const totals = metrics.detailedMetrics?.performanceSummary?.totals || {};
  return metrics.totalImpressions > 0
    || metrics.totalClicks > 0
    || metrics.totalConversions > 0
    || metrics.totalLeads > 0
    || metrics.totalSpend > 0
    || parseNum(totals.sessions?.value) > 0
    || parseNum(totals.users?.value) > 0
    || parseNum(totals.revenue?.value) > 0;
};

export async function aggregateCampaignMetrics(campaignId: string, options: AggregateCampaignMetricsOptions = {}): Promise<SnapshotMetrics & { detailedMetrics: any }> {
  const includeTrendAnalysis = options.includeTrendAnalysis !== false;
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - 90);
  const startDate = startDateObj.toISOString().slice(0, 10);

  // Fetch LinkedIn metrics
  let linkedinMetrics: any = {};
  let linkedinConnected = false;
  let linkedinLastImportedAt: any = null;
  let linkedinDailyRows: any[] = [];
  try {
    const linkedInConnection = await storage.getLinkedInConnection(campaignId);
    const latestSession = linkedInConnection && !(linkedInConnection as any).spendOnly
      ? await storage.getLatestLinkedInImportSession(campaignId)
      : null;
    if (latestSession) {
      linkedinConnected = true;
      linkedinLastImportedAt = (latestSession as any).importedAt || null;
      const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
      linkedinDailyRows = await storage.getLinkedInDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]);
      
      metrics.forEach((m: any) => {
        const value = parseFloat(m.metricValue || '0');
        const key = m.metricKey.toLowerCase();
        linkedinMetrics[key] = (linkedinMetrics[key] || 0) + value;
      });
    }
  } catch (err) {
    console.log(`No LinkedIn metrics found for campaign ${campaignId}`);
  }
  
  // Fetch Custom Integration metrics
  let customIntegrationData: any = {};
  let customIntegrationConnected = false;
  try {
    const customIntegration = await storage.getLatestCustomIntegrationMetrics(campaignId);
    if (customIntegration) {
      customIntegrationConnected = true;
      customIntegrationData = customIntegration;
    }
  } catch (err) {
    console.log(`No custom integration metrics found for campaign ${campaignId}`);
  }

  // Fetch Meta metrics (sum daily metrics across all dates)
  let metaData = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
  let metaConnected = false;
  let metaDailyRows: any[] = [];
  try {
    const metaConnection = await storage.getMetaConnection(campaignId);
    if (metaConnection) {
      metaConnected = true;
      metaDailyRows = await storage.getMetaDailyMetrics(campaignId, startDate, endDate);
      metaData = {
        impressions: metaDailyRows.reduce((s: number, m: any) => s + (m.impressions || 0), 0),
        clicks: metaDailyRows.reduce((s: number, m: any) => s + (m.clicks || 0), 0),
        spend: metaDailyRows.reduce((s: number, m: any) => s + parseNum(m.spend), 0),
        conversions: metaDailyRows.reduce((s: number, m: any) => s + (m.conversions || 0), 0),
      };
    }
  } catch (err) {
    console.log(`No Meta metrics found for campaign ${campaignId}`);
  }

  // Fetch GA4 metrics (website analytics)
  let ga4Data = { sessions: 0, users: 0, pageviews: 0, conversions: 0, revenue: 0 };
  let ga4Connected = false;
  let ga4DailyRows: any[] = [];
  let ga4PropertyId: string | null = null;
  try {
    const ga4Conn = await storage.getPrimaryGA4Connection(campaignId);
    if (ga4Conn) {
      ga4Connected = true;
      ga4PropertyId = String(ga4Conn.propertyId);
      ga4DailyRows = await storage.getGA4DailyMetrics(campaignId, ga4PropertyId, startDate, endDate);
      ga4Data = {
        sessions: ga4DailyRows.reduce((s: number, m: any) => s + (m.sessions || 0), 0),
        users: ga4DailyRows.reduce((s: number, m: any) => s + (m.users || 0), 0),
        pageviews: ga4DailyRows.reduce((s: number, m: any) => s + (m.pageviews || 0), 0),
        conversions: ga4DailyRows.reduce((s: number, m: any) => s + (m.conversions || 0), 0),
        revenue: ga4DailyRows.reduce((s: number, m: any) => s + parseNum(m.revenue), 0),
      };
    }
  } catch (err) {
    console.log(`No GA4 metrics found for campaign ${campaignId}`);
  }

  let googleAdsConn: any = null;
  let googleAdsDailyRows: any[] = [];
  let googleAdsSelectedCampaignIds: string[] = [];
  try {
    googleAdsConn = await storage.getGoogleAdsConnection(campaignId);
    if (googleAdsConn && !(googleAdsConn as any).spendOnly) {
      const rawRows = await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]);
      const selectedIds = (() => {
        try {
          const parsed = JSON.parse(String((googleAdsConn as any)?.selectedCampaignIds || "[]"));
          googleAdsSelectedCampaignIds = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
          return new Set(googleAdsSelectedCampaignIds);
        } catch {
          googleAdsSelectedCampaignIds = [];
          return new Set<string>();
        }
      })();
      googleAdsDailyRows = selectedIds.size > 0
        ? rawRows.filter((row: any) => selectedIds.has(String(row?.googleCampaignId || "")))
        : rawRows;
    }
  } catch (err) {
    console.log(`No Google Ads metrics found for campaign ${campaignId}`);
  }

  let instagramConn: any = null;
  let instagramDailyRows: any[] = [];
  let instagramSelectedCampaignIds: string[] = [];
  try {
    instagramConn = await storage.getInstagramConnection(campaignId);
    if (instagramConn && !(instagramConn as any).spendOnly && String((instagramConn as any).publisherPlatformFilter || "instagram") === "instagram") {
      const rawRows = await storage.getInstagramDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]);
      const selectedIds = (() => {
        try {
          const parsed = JSON.parse(String((instagramConn as any)?.selectedCampaignIds || "[]"));
          instagramSelectedCampaignIds = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
          return new Set(instagramSelectedCampaignIds);
        } catch {
          instagramSelectedCampaignIds = [];
          return new Set<string>();
        }
      })();
      instagramDailyRows = selectedIds.size > 0
        ? rawRows.filter((row: any) => selectedIds.has(String(row?.instagramCampaignId || "")) && String(row?.publisherPlatform || "instagram") === "instagram")
        : [];
    }
  } catch (err) {
    console.log(`No Instagram metrics found for campaign ${campaignId}`);
  }

  let tiktokConn: any = null;
  let tiktokDailyRows: any[] = [];
  let tiktokSelectedCampaignIds: string[] = [];
  try {
    tiktokConn = await storage.getTikTokConnection(campaignId);
    if (tiktokConn && !(tiktokConn as any).spendOnly) {
      const rawRows = await storage.getTikTokDailyMetrics(campaignId, startDate, endDate).catch(() => [] as any[]);
      const selectedIds = (() => {
        try {
          const parsed = JSON.parse(String((tiktokConn as any)?.selectedCampaignIds || "[]"));
          tiktokSelectedCampaignIds = Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
          return new Set(tiktokSelectedCampaignIds);
        } catch {
          tiktokSelectedCampaignIds = [];
          return new Set<string>();
        }
      })();
      tiktokDailyRows = selectedIds.size > 0
        ? rawRows.filter((row: any) => selectedIds.has(String(row?.tiktokCampaignId || "")))
        : [];
    }
  } catch (err) {
    console.log(`No TikTok metrics found for campaign ${campaignId}`);
  }

  // Aggregate legacy engagement only for the existing snapshot schema column.
  const linkedinClicks = parseNum(linkedinMetrics.clicks);
  const ciClicks = parseNum(customIntegrationData.clicks);
  const metaClicks = metaData.clicks;
  // LinkedIn stores engagement as singular 'engagement' from the API
  const linkedinEngagement = parseNum(linkedinMetrics.engagement);
  const ciEngagements = parseNum(customIntegrationData.engagements);
  const ciSessions = parseNum(customIntegrationData.sessions);
  const googleAdsRawData = googleAdsDailyRows.reduce((totals: any, row: any) => ({
    impressions: totals.impressions + parseNum(row?.impressions),
    clicks: totals.clicks + parseNum(row?.clicks),
    spend: totals.spend + parseNum(row?.spend),
    conversions: totals.conversions + parseNum(row?.conversions),
    conversionValue: totals.conversionValue + parseNum(row?.conversionValue),
    ga4AttributedRevenue: totals.ga4AttributedRevenue + parseNum(row?.ga4Revenue),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, ga4AttributedRevenue: 0 });
  let googleAdsImportedAttributedRevenue = 0;
  let googleAdsImportedRevenueSourceIds: string[] = [];
  const googleAdsImportedRevenueByDate = new Map<string, number>();
  try {
    const googleAdsImportedRevenueTotals = await storage.getRevenueTotalForRange(campaignId, startDate, endDate, "google_ads");
    googleAdsImportedAttributedRevenue = parseNum((googleAdsImportedRevenueTotals as any)?.totalRevenue);
    googleAdsImportedRevenueSourceIds = Array.isArray((googleAdsImportedRevenueTotals as any)?.sourceIds)
      ? (googleAdsImportedRevenueTotals as any).sourceIds.map((id: any) => String(id)).filter(Boolean)
      : [];
    const googleAdsDailyRevenueRows = await db.execute(sql`
      SELECT rr.date, rr.revenue_source_id as source_id, rr.revenue, rr.sub_campaign_urn
      FROM revenue_records rr
      INNER JOIN revenue_sources rs ON rs.id::text = rr.revenue_source_id
      WHERE rr.campaign_id = ${campaignId}
        AND rs.is_active = true
        AND rs.platform_context = 'google_ads'
        AND rr.date >= ${startDate}
        AND rr.date <= ${endDate}
    `);
    const totalsByDateAndSource = new Map<string, { aggregate: number; subCampaign: number }>();
    for (const row of (googleAdsDailyRevenueRows.rows as any[])) {
      const date = String(row.date || "").slice(0, 10);
      const sourceId = String(row.source_id || "");
      if (!date || !sourceId) continue;
      const key = `${date}::${sourceId}`;
      const current = totalsByDateAndSource.get(key) || { aggregate: 0, subCampaign: 0 };
      const value = parseNum(row.revenue);
      if (row.sub_campaign_urn) current.subCampaign += value;
      else current.aggregate += value;
      totalsByDateAndSource.set(key, current);
    }
    for (const [key, totals] of Array.from(totalsByDateAndSource.entries())) {
      const date = key.split("::")[0];
      const value = totals.aggregate > 0 ? totals.aggregate : totals.subCampaign;
      googleAdsImportedRevenueByDate.set(date, parseFloat(((googleAdsImportedRevenueByDate.get(date) || 0) + value).toFixed(2)));
    }
  } catch {
    // Keep Google Ads revenue unavailable if imported attributed revenue cannot be resolved.
  }
  const hasGoogleAdsImportedAttributedRevenue = googleAdsImportedAttributedRevenue > 0;
  const googleAdsAttributedRevenueSource = hasGoogleAdsImportedAttributedRevenue ? "google_ads_imported_attributed_revenue" : "unavailable";
  const googleAdsData = {
    ...googleAdsRawData,
    importedAttributedRevenue: googleAdsImportedAttributedRevenue,
    attributedRevenue: hasGoogleAdsImportedAttributedRevenue ? googleAdsImportedAttributedRevenue : 0,
  };
  const instagramData = instagramDailyRows.reduce((totals: any, row: any) => ({
    impressions: totals.impressions + parseNum(row?.impressions),
    clicks: totals.clicks + parseNum(row?.clicks),
    spend: totals.spend + parseNum(row?.spend),
    conversions: totals.conversions + parseNum(row?.conversions),
    videoViews: totals.videoViews + parseNum(row?.videoViews),
    ga4AttributedRevenue: totals.ga4AttributedRevenue + parseNum(row?.ga4Revenue),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, ga4AttributedRevenue: 0 });
  const tiktokData = tiktokDailyRows.reduce((totals: any, row: any) => ({
    impressions: totals.impressions + parseNum(row?.impressions),
    clicks: totals.clicks + parseNum(row?.clicks),
    spend: totals.spend + parseNum(row?.spend),
    conversions: totals.conversions + parseNum(row?.conversions),
    videoViews: totals.videoViews + parseNum(row?.videoViews),
    engagements: totals.engagements + parseNum(row?.engagements),
  }), { impressions: 0, clicks: 0, spend: 0, conversions: 0, videoViews: 0, engagements: 0 });

  // Double-counting prevention: GA4 and CI both track website analytics.
  // When GA4 is connected, prefer GA4 for web metrics; otherwise use CI.
  const webSessions = ga4Connected ? ga4Data.sessions : ciSessions;

  // Advertising metrics: LinkedIn + CI(ads) + Meta — no overlap
  const advertisingEngagements = linkedinClicks + linkedinEngagement + ciClicks + ciEngagements + metaClicks;
  const totalEngagements = advertisingEngagements + webSessions;
  const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend) + metaData.spend + googleAdsData.spend + instagramData.spend + tiktokData.spend;

  let persistedSpend = 0;
  let spendSourceIds: string[] = [];
  try {
    const spendTotals = await storage.getSpendTotalForRange(campaignId, startDate, endDate);
    persistedSpend = parseNum((spendTotals as any)?.totalSpend);
    spendSourceIds = Array.isArray((spendTotals as any)?.sourceIds) ? (spendTotals as any).sourceIds : [];
  } catch {
    // Keep platform spend fallback if persisted spend cannot be resolved.
  }

  const revenueSources: any[] = [];
  let offsiteRevenueTotal = 0;
  try {
    const sources = await storage.getRevenueSources(campaignId, "ga4");
    const breakdown = await storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, "ga4");
    for (const source of sources as any[]) {
      const match = (breakdown as any[]).find((row: any) => String(row?.sourceId) === String(source?.id));
      const lastTotalRevenue = parseNum(match?.revenue);
      revenueSources.push({
        type: String(source?.sourceType || "source"),
        connected: true,
        lastTotalRevenue,
        platformContext: (source as any)?.platformContext || "ga4",
      });
      offsiteRevenueTotal += lastTotalRevenue;
    }
  } catch {
    // Keep GA4 onsite revenue only if external revenue cannot be resolved.
  }

  let trendFinancialDailyRows: any[] = [];
  if (includeTrendAnalysis) {
    try {
      const financialData = await db.execute(sql`
        SELECT sr.date, SUM(sr.spend::NUMERIC) as spend, 0::NUMERIC as revenue
        FROM spend_records sr
        INNER JOIN spend_sources ss ON ss.id::text = sr.spend_source_id
        WHERE sr.campaign_id = ${campaignId} AND ss.is_active = true AND sr.date >= ${startDate} AND sr.date <= ${endDate}
        GROUP BY sr.date
        UNION ALL
        SELECT rr.date, 0::NUMERIC as spend, SUM(rr.revenue::NUMERIC) as revenue
        FROM revenue_records rr
        INNER JOIN revenue_sources rs ON rs.id::text = rr.revenue_source_id
        WHERE rr.campaign_id = ${campaignId} AND rs.is_active = true AND rr.date >= ${startDate} AND rr.date <= ${endDate}
        GROUP BY rr.date
      `);
      const financialByDate = new Map<string, { date: string; spend: number; revenue: number }>();
      for (const row of (financialData.rows as any[])) {
        const date = String(row.date || "").slice(0, 10);
        if (!date) continue;
        const current = financialByDate.get(date) || { date, spend: 0, revenue: 0 };
        current.spend += parseNum(row.spend);
        current.revenue += parseNum(row.revenue);
        financialByDate.set(date, current);
      }
      trendFinancialDailyRows = Array.from(financialByDate.values());
    } catch {
      // Trend snapshots can still store platform daily rows if financial daily rows are unavailable.
    }
  }

  const performanceSummary = buildPerformanceSummaryAggregate({
    campaignId,
    dateRange: "90days",
    ga4: { connected: ga4Connected, ...ga4Data },
    webAnalytics: {
      connected: ga4Connected || customIntegrationConnected,
      provider: ga4Connected ? "ga4" : customIntegrationConnected ? "custom_integration" : null,
      revenue: ga4Connected ? ga4Data.revenue : parseNum(customIntegrationData.revenue),
      conversions: ga4Connected ? ga4Data.conversions : parseNum(customIntegrationData.conversions),
      sessions: ga4Connected ? ga4Data.sessions : parseNum(customIntegrationData.sessions),
      users: ga4Connected ? ga4Data.users : parseNum(customIntegrationData.users),
    },
    spend: {
      persistedSpend,
      unifiedSpend: persistedSpend > 0 ? persistedSpend : totalSpend,
      spendSource: spendSourceIds.length > 0 ? "persisted_spend_sources" : "platform_spend_fallback",
      sourceIds: spendSourceIds,
    },
    platforms: {
      linkedin: { connected: linkedinConnected, ...linkedinMetrics, lastImportedAt: linkedinLastImportedAt },
      meta: { connected: metaConnected, ...metaData },
      customIntegration: { connected: customIntegrationConnected, ...customIntegrationData },
    },
    platformSources: [
      {
        id: "google_ads",
        label: "Google Ads",
        category: "paid_media",
        connected: Boolean(googleAdsConn && !(googleAdsConn as any).spendOnly),
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: googleAdsConn && !(googleAdsConn as any).spendOnly ? ["impressions", "clicks", "spend", "conversions", ...(hasGoogleAdsImportedAttributedRevenue ? ["attributedRevenue"] : [])] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          ...(hasGoogleAdsImportedAttributedRevenue ? [] : [{ metric: "attributedRevenue", reason: "Google Ads Total Revenue requires a Google Ads-scoped imported revenue source" }]),
        ],
        metrics: googleAdsData,
        revenueSemantics: {
          attributedRevenueSource: googleAdsAttributedRevenueSource,
          attributedRevenueLabel: hasGoogleAdsImportedAttributedRevenue ? "Google Ads imported attributed revenue" : "Unavailable",
          importedRevenueSourceIds: googleAdsImportedRevenueSourceIds,
          conversionValueLabel: "Native Google Ads conversion value",
          ga4AttributedRevenueLabel: "GA4-matched revenue; not used as Google Ads Total Revenue",
        },
        freshness: { selectedCampaignIds: googleAdsSelectedCampaignIds },
      },
      {
        id: "instagram",
        label: "Instagram Ads",
        category: "paid_media",
        connected: Boolean(instagramConn && !(instagramConn as any).spendOnly && instagramSelectedCampaignIds.length > 0),
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: instagramConn && !(instagramConn as any).spendOnly && instagramSelectedCampaignIds.length > 0 ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          { metric: "attributedRevenue", reason: "Instagram attributed revenue is unavailable until an Instagram-scoped revenue source is configured" },
        ],
        metrics: instagramData,
        revenueSemantics: {
          attributedRevenueSource: "unavailable",
          attributedRevenueLabel: "Unavailable",
          ga4AttributedRevenueLabel: "GA4-matched revenue; not used as Instagram Total Revenue",
        },
        freshness: { selectedCampaignIds: instagramSelectedCampaignIds },
      },
      {
        id: "tiktok",
        label: "TikTok Ads",
        category: "paid_media",
        connected: Boolean(tiktokConn && !(tiktokConn as any).spendOnly && tiktokSelectedCampaignIds.length > 0),
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: tiktokConn && !(tiktokConn as any).spendOnly && tiktokSelectedCampaignIds.length > 0 ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          { metric: "attributedRevenue", reason: "TikTok attributed revenue is unavailable until a TikTok-scoped revenue source is configured" },
        ],
        metrics: tiktokData,
        revenueSemantics: {
          attributedRevenueSource: "unavailable",
          attributedRevenueLabel: "Unavailable",
        },
        freshness: { selectedCampaignIds: tiktokSelectedCampaignIds },
      },
    ],
    revenue: {
      onsiteRevenue: ga4Data.revenue,
      offsiteRevenue: parseFloat((offsiteRevenueTotal + googleAdsData.attributedRevenue).toFixed(2)),
      totalRevenue: parseFloat((ga4Data.revenue + offsiteRevenueTotal + googleAdsData.attributedRevenue).toFixed(2)),
    },
    revenueSources,
  });

  const aggregateValue = (metricName: string) => {
    const metric = (performanceSummary as any)?.totals?.[metricName];
    return metric?.available && metric?.value !== null ? parseNum(metric.value) : 0;
  };

  const trendAnalysis = includeTrendAnalysis ? buildTrendAnalysisAggregate({
    campaignId,
    dateRange: "90days",
    startDate,
    endDate,
    financialDailyRows: trendFinancialDailyRows,
    sources: [
      {
        id: "ga4",
        label: "Google Analytics",
        category: "web_analytics",
        connected: ga4Connected,
        capabilities: ["users", "sessions", "conversions", "revenue", "engagementRate"],
        includedMetrics: ga4Connected ? ["users", "sessions", "conversions", "revenue", "engagementRate"] : [],
        excludedMetrics: [
          { metric: "impressions", reason: "GA4 is not an ad-impression source" },
          { metric: "clicks", reason: "GA4 is not an ad-click source" },
          { metric: "spend", reason: "Spend is not a GA4 metric" },
        ],
        dailyRows: ga4DailyRows.map((row: any) => ({
          date: row.date,
          metrics: {
            users: row.users,
            sessions: row.sessions,
            conversions: row.conversions,
            revenue: row.revenue,
            engagementRate: row.engagementRate,
          },
        })),
        freshness: ga4PropertyId ? { propertyId: ga4PropertyId } : undefined,
      },
      {
        id: "linkedin",
        label: "LinkedIn Ads",
        category: "paid_media",
        connected: linkedinConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: linkedinConnected ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
        ],
        dailyRows: linkedinDailyRows.map((row: any) => ({
          date: row.date,
          metrics: {
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend || row.costInLocalCurrency,
            conversions: row.conversions,
          },
        })),
      },
      {
        id: "meta",
        label: "Meta Ads",
        category: "paid_media",
        connected: metaConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: metaConnected ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
        ],
        dailyRows: metaDailyRows.map((row: any) => ({
          date: row.date,
          metrics: {
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            conversions: row.conversions,
          },
        })),
      },
      {
        id: "google_ads",
        label: "Google Ads",
        category: "paid_media",
        connected: Boolean(googleAdsConn && !(googleAdsConn as any).spendOnly),
        capabilities: ["impressions", "clicks", "spend", "conversions", "attributedRevenue"],
        includedMetrics: googleAdsConn && !(googleAdsConn as any).spendOnly ? ["impressions", "clicks", "spend", "conversions", ...(hasGoogleAdsImportedAttributedRevenue ? ["attributedRevenue"] : [])] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
          ...(hasGoogleAdsImportedAttributedRevenue ? [] : [{ metric: "attributedRevenue", reason: "Google Ads Total Revenue requires a Google Ads-scoped imported revenue source" }]),
        ],
        dailyRows: googleAdsDailyRows.map((row: any) => {
          const ga4AttributedRevenue = parseNum(row.ga4Revenue);
          const conversionValue = parseNum(row.conversionValue);
          const importedAttributedRevenue = parseNum(googleAdsImportedRevenueByDate.get(String(row.date || "").slice(0, 10)));
          return {
            date: row.date,
            metrics: {
              impressions: row.impressions,
              clicks: row.clicks,
              spend: row.spend,
              conversions: row.conversions,
              conversionValue,
              ga4AttributedRevenue,
              importedAttributedRevenue,
              attributedRevenue: hasGoogleAdsImportedAttributedRevenue ? importedAttributedRevenue : 0,
            },
          };
        }),
      },
      {
        id: "instagram",
        label: "Instagram Ads",
        category: "paid_media",
        connected: Boolean(instagramConn && !(instagramConn as any).spendOnly && instagramSelectedCampaignIds.length > 0),
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: instagramConn && !(instagramConn as any).spendOnly && instagramSelectedCampaignIds.length > 0 ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
        ],
        dailyRows: instagramDailyRows.map((row: any) => ({
          date: row.date,
          metrics: {
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            conversions: row.conversions,
            ga4AttributedRevenue: row.ga4Revenue,
          },
        })),
        freshness: { selectedCampaignIds: instagramSelectedCampaignIds },
      },
      {
        id: "tiktok",
        label: "TikTok Ads",
        category: "paid_media",
        connected: Boolean(tiktokConn && !(tiktokConn as any).spendOnly && tiktokSelectedCampaignIds.length > 0),
        capabilities: ["impressions", "clicks", "spend", "conversions"],
        includedMetrics: tiktokConn && !(tiktokConn as any).spendOnly && tiktokSelectedCampaignIds.length > 0 ? ["impressions", "clicks", "spend", "conversions"] : [],
        excludedMetrics: [
          { metric: "sessions", reason: "Sessions are web analytics metrics" },
          { metric: "users", reason: "Users are web analytics metrics" },
        ],
        dailyRows: tiktokDailyRows.map((row: any) => ({
          date: row.date,
          metrics: {
            impressions: row.impressions,
            clicks: row.clicks,
            spend: row.spend,
            conversions: row.conversions,
            videoViews: row.videoViews,
            engagements: row.engagements,
          },
        })),
        freshness: { selectedCampaignIds: tiktokSelectedCampaignIds },
      },
      {
        id: "custom_integration",
        label: "Custom Integration",
        category: "custom",
        connected: customIntegrationConnected,
        capabilities: ["impressions", "clicks", "spend", "conversions", "users", "sessions", "pageviews", "revenue"],
        includedMetrics: customIntegrationConnected ? ["impressions", "clicks", "spend", "conversions", "users", "sessions", "pageviews", "revenue"] : [],
        excludedMetrics: [],
        dailyRows: [],
      },
    ],
  }) : null;

  // Store detailed metrics from all sources for historical tracking
  const detailedMetrics = {
    linkedin: {
      impressions: parseNum(linkedinMetrics.impressions),
      clicks: parseNum(linkedinMetrics.clicks),
      totalEngagements: parseNum(linkedinMetrics.engagement) + parseNum(linkedinMetrics.engagements),
      conversions: parseNum(linkedinMetrics.conversions),
      leads: parseNum(linkedinMetrics.leads),
      costInLocalCurrency: linkedinMetrics.costinlocalcurrency || linkedinMetrics.costInLocalCurrency || '0',
    },
    customIntegration: {
      impressions: parseNum(customIntegrationData.impressions),
      clicks: parseNum(customIntegrationData.clicks),
      engagements: parseNum(customIntegrationData.engagements),
      conversions: parseNum(customIntegrationData.conversions),
      leads: parseNum(customIntegrationData.leads),
      spend: customIntegrationData.spend || '0',
      sessions: parseNum(customIntegrationData.sessions),
      users: parseNum(customIntegrationData.users),
      pageviews: parseNum(customIntegrationData.pageviews),
    },
    meta: {
      impressions: metaData.impressions,
      clicks: metaData.clicks,
      spend: metaData.spend,
      conversions: metaData.conversions,
    },
    ga4: {
      sessions: ga4Data.sessions,
      users: ga4Data.users,
      pageviews: ga4Data.pageviews,
      conversions: ga4Data.conversions,
      revenue: ga4Data.revenue,
    },
    webAnalyticsProvider: ga4Connected ? 'ga4' : 'custom_integration',
    performanceSummary,
    trendAnalysis,
  };
  
  return {
    totalImpressions: Math.round(aggregateValue("impressions")),
    totalEngagements: Math.round(totalEngagements),
    totalClicks: Math.round(aggregateValue("clicks")),
    totalConversions: Math.round(aggregateValue("conversions")),
    totalLeads: Math.round(aggregateValue("leads")),
    totalSpend: parseFloat(aggregateValue("spend").toFixed(2)),
    detailedMetrics
  };
}

/**
 * Record current metrics for a single campaign after a platform sync (LinkedIn refresh, CI upload, etc.)
 */
export async function recordCampaignMetrics(campaignId: string): Promise<void> {
  try {
    const metrics = await aggregateCampaignMetrics(campaignId);
    if (hasSnapshotMetricValue(metrics)) {
      await storage.createMetricSnapshot({
        campaignId,
        totalImpressions: metrics.totalImpressions,
        totalEngagements: metrics.totalEngagements,
        totalClicks: metrics.totalClicks,
        totalConversions: metrics.totalConversions,
        totalLeads: metrics.totalLeads,
        totalSpend: metrics.totalSpend.toFixed(2),
        metrics: metrics.detailedMetrics,
        snapshotType: 'platform_sync'
      });
      console.log(`[Metrics] Recorded data point for campaign ${campaignId} after platform sync`);
    }
  } catch (error: any) {
    console.error(`[Metrics] Failed to record data point for campaign ${campaignId}:`, error?.message || error);
  }
}

async function createSnapshotsForAllCampaigns() {
  console.log('=== AUTOMATED SNAPSHOT SCHEDULER RUNNING ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const campaigns = await storage.getCampaigns();
    console.log(`Found ${campaigns.length} campaigns`);
    
    for (const campaign of campaigns) {
      try {
        const metrics = await aggregateCampaignMetrics(campaign.id);
        
        // Only create snapshot if there's actual aggregate data
        if (hasSnapshotMetricValue(metrics)) {
          const snapshot = await storage.createMetricSnapshot({
            campaignId: campaign.id,
            totalImpressions: metrics.totalImpressions,
            totalEngagements: metrics.totalEngagements,
            totalClicks: metrics.totalClicks,
            totalConversions: metrics.totalConversions,
            totalLeads: metrics.totalLeads,
            totalSpend: metrics.totalSpend.toFixed(2),
            metrics: metrics.detailedMetrics,
            snapshotType: 'automatic'
          });
          
          console.log(`✓ Snapshot created for campaign "${campaign.name}" (${campaign.id})`);
        } else {
          console.log(`⊗ Skipped campaign "${campaign.name}" (${campaign.id}) - no metrics data`);
        }
      } catch (error: any) {
        // Log error but continue with other campaigns
        console.error(`✗ Failed to create snapshot for campaign ${campaign.id}:`, error?.message || error);
      }
    }
    
    console.log('=== AUTOMATED SNAPSHOT SCHEDULER COMPLETED ===\n');
  } catch (error: any) {
    // Handle connection errors gracefully
    if (error?.message?.includes('Connection terminated') || error?.message?.includes('ECONNREFUSED')) {
      console.error('⚠️ Database connection error in scheduler - will retry on next run:', error?.message);
    } else {
      console.error('Automated snapshot scheduler error:', error?.message || error);
    }
  }
}

export class SnapshotScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private frequency: 'hourly' | 'daily' | 'weekly' = 'daily';
  
  constructor(frequency?: 'hourly' | 'daily' | 'weekly') {
    // Read from environment variable or use provided frequency or default to 'daily'
    const envFrequency = process.env.SNAPSHOT_FREQUENCY as 'hourly' | 'daily' | 'weekly' | undefined;
    this.frequency = envFrequency || frequency || 'daily';
  }
  
  start() {
    if (this.intervalId) {
      console.log('Snapshot scheduler is already running');
      return;
    }
    
    const intervals = {
      hourly: 60 * 60 * 1000,      // 1 hour
      daily: 24 * 60 * 60 * 1000,  // 24 hours
      weekly: 7 * 24 * 60 * 60 * 1000  // 7 days
    };
    
    const interval = intervals[this.frequency];
    
    console.log(`\n🕐 Snapshot Scheduler Started`);
    console.log(`   Frequency: ${this.frequency}`);
    console.log(`   Next run: ${new Date(Date.now() + interval).toLocaleString()}\n`);
    
    // Delay first run to let the HTTP server respond to health checks first
    setTimeout(() => createSnapshotsForAllCampaigns(), 30000);

    // Then schedule regular runs
    this.intervalId = setInterval(() => {
      createSnapshotsForAllCampaigns();
    }, interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Snapshot scheduler stopped');
    }
  }
  
  setFrequency(frequency: 'hourly' | 'daily' | 'weekly') {
    this.frequency = frequency;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }
  
  getStatus() {
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = intervals[this.frequency];
    
    return {
      running: this.intervalId !== null,
      frequency: this.frequency,
      nextRun: this.intervalId ? new Date(Date.now() + interval).toISOString() : null
    };
  }
}

// Export singleton instance
export const snapshotScheduler = new SnapshotScheduler();
