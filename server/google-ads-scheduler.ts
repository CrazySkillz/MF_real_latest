/**
 * Google Ads Data Scheduler
 * Handles periodic data sync for Google Ads connections (mock + real)
 * Follows the meta-scheduler.ts pattern
 */
import { storage, type GA4RefreshWriteInput, type GA4RefreshGoogleAdsWriteInput } from "./storage";
import { db } from "./db";
import { googleAdsConnections, googleAdsDailyMetrics, ga4GoogleAdsSpendConnections } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import { enrichPlatformWithGA4Revenue } from "./utils/ga4RevenueEnrichment";
import { getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { buildGA4GoogleAdsSpendMaterialization } from "./ga4-google-ads-spend";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { isSupportedGoogleAdsSpendConnectionMethod } from "./utils/google-ads-service-account";
import { filterActiveSchedulerCampaigns } from "./utils/campaign-scheduler-eligibility";

const iso = (d: Date) => d.toISOString().slice(0, 10);

// Mock campaign profiles with distinct metric characteristics
const MOCK_CAMPAIGNS = [
  { id: 'gads_brand_search',     name: 'Brand Search Campaign',         impressionBase: 18000, ctrBase: 0.06, spendBase: 350, convRateBase: 0.06 },
  { id: 'gads_performance_max',  name: 'Performance Max Campaign',      impressionBase: 12000, ctrBase: 0.03, spendBase: 250, convRateBase: 0.04 },
  { id: 'gads_display_retarget', name: 'Display Retargeting Campaign',  impressionBase: 8000,  ctrBase: 0.01, spendBase: 120, convRateBase: 0.08 },
];

/**
 * Generate mock Google Ads data for test mode connections
 */
async function generateMockGoogleAdsData(
  campaignId: string,
  connection: any,
  opts?: { advanceDay?: boolean }
): Promise<void> {
  if (String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") throw new Error("Test-mode data is disabled in production");
  // Get the last imported date
  let existingDates: string[] = [];
  try {
    const existing = await storage.getGoogleAdsDailyMetrics(campaignId, '2000-01-01', '2099-12-31');
    existingDates = Array.from(new Set(existing.map((m) => m.date)));
  } catch {
    // ignore
  }

  const now = new Date();
  const yesterdayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const windowStart = new Date(yesterdayUtc);
  windowStart.setDate(windowStart.getDate() - 59);

  // Determine the next date to generate data for
  let nextDate: Date;
  if (existingDates.length === 0) {
    nextDate = windowStart;
  } else {
    const maxDate = existingDates.sort().pop()!;
    const d = new Date(maxDate + 'T00:00:00Z');
    d.setDate(d.getDate() + 1);
    nextDate = d;
  }

  const cap = opts?.advanceDay ? new Date(yesterdayUtc.getTime() + 86400000) : yesterdayUtc;
  if (nextDate > cap) {
    console.log(`[Google Ads Mock] No new dates to generate for campaign ${campaignId}`);
    return;
  }

  const dateStr = iso(nextDate);

  // Filter by selected campaigns if configured
  const selectedIds: string[] | undefined = connection.selectedCampaignIds
    ? JSON.parse(connection.selectedCampaignIds)
    : undefined;
  const campaignsToGenerate = selectedIds && selectedIds.length > 0
    ? MOCK_CAMPAIGNS.filter(c => selectedIds.includes(c.id))
    : MOCK_CAMPAIGNS;

  // Generate metrics for each mock campaign
  const metricsToUpsert: any[] = [];
  let totalSpend = 0;

  for (const mc of campaignsToGenerate) {
    const impressions = Math.max(2000, mc.impressionBase + Math.floor(Math.random() * mc.impressionBase * 0.5));
    const clicks = Math.max(10, Math.floor(impressions * (mc.ctrBase + Math.random() * mc.ctrBase * 0.5)));
    const spend = Math.max(20, mc.spendBase + Math.random() * mc.spendBase * 0.6);
    const conversions = Math.max(0, Math.floor(clicks * (mc.convRateBase + Math.random() * mc.convRateBase * 0.5)));
    const conversionValue = conversions * (20 + Math.random() * 80);
    const videoViews = Math.floor(impressions * (0.02 + Math.random() * 0.03));

    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(4)) : 0;
    const cpc = clicks > 0 ? Number((spend / clicks).toFixed(2)) : 0;
    const cpm = impressions > 0 ? Number(((spend / impressions) * 1000).toFixed(2)) : 0;
    const costPerConversion = conversions > 0 ? Number((spend / conversions).toFixed(2)) : 0;
    const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;
    const searchImpressionShare = Number((40 + Math.random() * 50).toFixed(2));

    totalSpend += spend;

    metricsToUpsert.push({
      campaignId,
      googleCampaignId: mc.id,
      googleCampaignName: mc.name,
      date: dateStr,
      impressions,
      clicks,
      spend: String(spend.toFixed(2)),
      conversions: String(conversions),
      conversionValue: String(conversionValue.toFixed(2)),
      ctr: String(ctr),
      cpc: String(cpc),
      cpm: String(cpm),
      interactionRate: String(ctr),
      videoViews,
      searchImpressionShare: String(searchImpressionShare),
      costPerConversion: String(costPerConversion),
      conversionRate: String(conversionRate),
    });
  }

  await storage.upsertGoogleAdsDailyMetrics(metricsToUpsert);

  // Write campaignUtmMap for GA4 matching (only on first run)
  if (existingDates.length === 0) {
    try {
      const utmMap: Record<string, string> = {
        'gads_brand_search': 'yesop_brand_search',
        'gads_performance_max': 'yesop_prospecting',
        'gads_display_retarget': 'yesop_retargeting',
      };
      await storage.updateGoogleAdsConnection(campaignId, {
        campaignUtmMap: JSON.stringify(utmMap),
      } as any);
    } catch {
      // ignore — connection may not support this field yet
    }
  }

  console.log(`[Google Ads Mock] Generated data for ${dateStr} — ${campaignsToGenerate.length} campaigns, total spend=$${totalSpend.toFixed(2)}`);
}

/**
 * Fetch real data from Google Ads API
 */
async function fetchRealGoogleAdsData(
  campaignId: string,
  connection: any,
  campaign: any,
  dedicatedSpend = false,
  refreshWriteInput: GA4RefreshGoogleAdsWriteInput = {},
): Promise<void> {
  const { GoogleAdsClient, mapGoogleAdsDailyInsights } = await import('./googleAdsClient');

  let accessToken = connection.accessToken;
  const refreshToken = connection.refreshToken;
  const clientId = connection.clientId || process.env.GOOGLE_ADS_CLIENT_ID || '';
  const clientSecret = connection.clientSecret || process.env.GOOGLE_ADS_CLIENT_SECRET || '';
  const developerToken = connection.developerToken || process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';

  // Refresh token if needed
  if (refreshToken && clientId && clientSecret) {
    try {
      const refreshed = await GoogleAdsClient.refreshAccessToken(refreshToken, clientId, clientSecret);
      accessToken = refreshed.access_token;
      const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      const renewed = dedicatedSpend
        ? await storage.updateGA4GoogleAdsSpendConnection(campaignId, { accessToken, expiresAt } as any, { ...refreshWriteInput, expectedConnection: connection })
        : await storage.updateGoogleAdsConnection(campaignId, { accessToken, expiresAt } as any, { ...refreshWriteInput, expectedConnection: connection });
      if (refreshWriteInput.refreshScope && renewed) Object.assign(connection, renewed);
      if (refreshWriteInput.googleAdsRefresh) {
        if (!renewed) throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
        Object.assign(connection, renewed);
        refreshWriteInput.googleAdsRefresh.connection = { ...connection };
      }
    } catch (e: any) {
      if (refreshWriteInput.refreshScope || /^(GOOGLE_ADS_REFRESH_|GA4_REFRESH_)/.test(String(e?.message || '')) || ['ERR_CANCELED', 'ECONNABORTED', 'ETIMEDOUT'].includes(e?.code)) throw e;
      console.warn(`[Google Ads] Token refresh failed for campaign ${campaignId}:`, e.message);
    }
  }

  if (!accessToken) {
    throw new Error(`Google Ads access token is unavailable for campaign ${campaignId}`);
  }

  const client = new GoogleAdsClient({
    accessToken,
    developerToken,
    customerId: connection.customerId,
    managerAccountId: connection.managerAccountId || undefined,
  });

  const campaignStart = new Date((campaign as any)?.startDate || "2000-01-01");
  const startDate = Number.isNaN(campaignStart.getTime()) ? new Date("2000-01-01T00:00:00Z") : campaignStart;

  // Filter by selected campaigns if configured
  let selectedIds: string[] | undefined = !connection.spendOnly && connection.selectedCampaignIds
    ? JSON.parse(connection.selectedCampaignIds)
    : undefined;
  if (connection.spendOnly) {
    const sources = (await storage.getSpendSources(campaignId, "ga4")).filter((source: any) => {
      if (source.isActive === false || source.sourceType !== "ad_platforms") return false;
      const mapping = typeof source.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source.mappingConfig || {};
      return String(mapping.platform || "").trim().toLowerCase() === "google_ads" || String(source.displayName || "").trim() === "Google Ads";
    });
    if (refreshWriteInput.refreshScope && (sources.length !== 1 || sources[0].id !== refreshWriteInput.expectedSource?.id || sources[0].mappingConfig !== refreshWriteInput.expectedSource?.mappingConfig)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    if (sources.length > 1) throw new Error(`Multiple active GA4 Google Ads spend sources require review for campaign ${campaignId}`);
    if (refreshWriteInput.googleAdsRefresh) refreshWriteInput.googleAdsRefresh.source = sources[0] ? { ...sources[0] } : null;
    const mapping = sources.length ? (typeof sources[0].mappingConfig === "string" ? JSON.parse(sources[0].mappingConfig) : sources[0].mappingConfig || {}) : null;
    if (mapping && String(mapping.platform || "").trim().toLowerCase() !== "google_ads") throw new Error(`GA4 Google Ads source mapping is unavailable for campaign ${campaignId}`);
    selectedIds = mapping ? parseSelectedGoogleAdsCampaignIds(mapping.selectedCampaignIds) : undefined;
    if (mapping && !selectedIds?.length) throw new Error(`GA4 Google Ads selected campaign scope is unavailable for campaign ${campaignId}`);
  }
  const startDateIso = iso(startDate);
  const reportingTimeZone = normalizeReportingTimeZone((campaign as any)?.reportingTimeZone);
  const endDateIso = getReportingDateWindow(1, reportingTimeZone).endDate;
  if (startDateIso > endDateIso) throw new Error(`Google Ads has no completed reporting day for campaign ${campaignId}`);
  const account = await client.getCustomerAccount();
  const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase();
  if (account.manager || account.currencyCode !== campaignCurrency || normalizeReportingTimeZone(account.timeZone) !== reportingTimeZone) {
    throw new Error(`Google Ads account scope does not match campaign currency/timezone for campaign ${campaignId}`);
  }
  const insights = await client.getDailyMetrics(startDateIso, endDateIso, selectedIds && selectedIds.length > 0 ? selectedIds : undefined);

  const metricsToUpsert = mapGoogleAdsDailyInsights(campaignId, insights);

  const writeOptions = { ...refreshWriteInput, expectedConnection: connection };
  const { replaced } = dedicatedSpend
    ? await storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow(campaignId, startDateIso, endDateIso, metricsToUpsert as any, writeOptions)
    : await storage.replaceGoogleAdsDailyMetricsForWindow(campaignId, startDateIso, endDateIso, metricsToUpsert as any, writeOptions);
  console.log(`[Google Ads] Replaced ${replaced} daily metrics for campaign ${campaignId}`);

  // Ordinary refresh publishes freshness with its facts; durable refresh retains its owned completion path.
  if (!refreshWriteInput.googleAdsRefresh) {
    if (dedicatedSpend) await storage.updateGA4GoogleAdsSpendConnection(campaignId, { lastRefreshAt: new Date() } as any, writeOptions);
    else await storage.updateGoogleAdsConnection(campaignId, { lastRefreshAt: new Date() } as any, writeOptions);
  }
}

const parseSelectedGoogleAdsCampaignIds = (value: unknown): string[] => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.from(new Set((Array.isArray(parsed) ? parsed : []).map(String).map((id) => id.trim()).filter(Boolean))).sort();
  } catch {
    return [];
  }
};

export async function materializeGA4GoogleAdsSpendForCampaign(
  campaignId: string,
  campaign?: any,
  connection?: any,
  dedicatedSpend = false,
  deferDownstream = false,
  refreshWriteInput: GA4RefreshGoogleAdsWriteInput = {},
): Promise<{ updated: boolean; sourceId: string | null; records: number; totalSpend: number | null }> {
  campaign = campaign || await storage.getCampaign(campaignId).catch(() => null);
  connection = connection || await (dedicatedSpend ? storage.getGA4GoogleAdsSpendConnection(campaignId) : storage.getGoogleAdsConnection(campaignId, ...("refreshScope" in refreshWriteInput ? [refreshWriteInput] : []))).catch(() => null);
  if (!campaign || !connection || !connection.spendOnly || !isSupportedGoogleAdsSpendConnectionMethod(connection.method)) {
    throw new Error(`GA4 Google Ads spend scope is unavailable for campaign ${campaignId}`);
  }
  const sources = await storage.getSpendSources(campaignId, "ga4");
  const googleAdsSources = (Array.isArray(sources) ? sources : []).filter((source: any) => {
    if (!source || source.isActive === false || String(source.sourceType || "") !== "ad_platforms") return false;
    try {
      const mapping = typeof source.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source.mappingConfig || {};
      return String(mapping.platform || "").trim().toLowerCase() === "google_ads";
    } catch {
      return false;
    }
  });
  if (googleAdsSources.length === 0) return { updated: false, sourceId: null, records: 0, totalSpend: null };
  if (googleAdsSources.length !== 1) throw new Error(`Multiple active GA4 Google Ads spend sources require review for campaign ${campaignId}`);
  const source = googleAdsSources[0];
  if (refreshWriteInput.refreshScope && (!deferDownstream || source.id !== refreshWriteInput.expectedSource?.id || source.mappingConfig !== refreshWriteInput.expectedSource?.mappingConfig)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
  if (refreshWriteInput.refreshScope && ["id", "campaignId", "encryptedTokens", "customerId", "managerAccountId", "method"].some(field => (connection[field] ?? null) !== (refreshWriteInput.expectedConnection?.[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
  const mapping = typeof source.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source.mappingConfig || {};
  const sourceIds = parseSelectedGoogleAdsCampaignIds(mapping.selectedCampaignIds);
  if (sourceIds.length === 0) throw new Error(`GA4 Google Ads selected campaign scope is unavailable for campaign ${campaignId}`);
  const campaignCurrency = String(campaign.currency || "USD").trim().toUpperCase();
  if (String(source.currency || "").trim().toUpperCase() !== campaignCurrency) {
    throw new Error(`GA4 Google Ads spend currency mismatch for campaign ${campaignId}`);
  }
  const campaignStart = new Date(campaign.startDate || "1900-01-01");
  const startDate = Number.isNaN(campaignStart.getTime()) ? "1900-01-01" : campaignStart.toISOString().slice(0, 10);
  const endDate = getReportingDateWindow(1, campaign.reportingTimeZone).endDate;
  if (startDate > endDate) throw new Error(`Google Ads has no completed reporting day for campaign ${campaignId}`);
  const refreshedAt = connection.lastRefreshAt ? new Date(connection.lastRefreshAt) : null;
  if (!refreshedAt || !Number.isFinite(refreshedAt.getTime()) || Date.now() - refreshedAt.getTime() > 6 * 60 * 60 * 1000) {
    throw new Error(`GA4 Google Ads provider data is stale for campaign ${campaignId}`);
  }
  const materialized = buildGA4GoogleAdsSpendMaterialization({
    campaignId,
    currency: campaignCurrency,
    accountName: String(connection.customerName || "Google Ads Account"),
    selectedCampaignIds: sourceIds,
    rows: dedicatedSpend
      ? await storage.getGA4GoogleAdsSpendDailyMetrics(campaignId, startDate, endDate)
      : await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate),
    startDate,
    endDate,
    fetchedAt: refreshedAt.toISOString(),
    requireEverySelectedCampaign: false,
  });
  if (refreshWriteInput.refreshScope || refreshWriteInput.googleAdsRefresh) await storage.replaceSpendRecordsForSource(campaignId, String(source.id), "ad_platforms", "ga4", materialized.records as any, refreshWriteInput.expectedSource?.mappingConfig ?? source.mappingConfig, refreshWriteInput);
  else await storage.replaceSpendRecordsForSource(campaignId, String(source.id), "ad_platforms", "ga4", materialized.records as any);
  const totals = await storage.getSpendTotalForRange(campaignId, "1900-01-01", endDate, "ga4");
  const updatedCampaign = await storage.updateCampaign(campaignId, { spend: totals.totalSpend.toFixed(2) } as any, refreshWriteInput);
  if (refreshWriteInput.googleAdsRefresh && !updatedCampaign) throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
  if (!deferDownstream) {
    await storage.invalidateExecutiveSummaryDailySnapshotAlignment(campaignId, endDate, refreshWriteInput);
    const recompute = await runGA4DailyKPIAndBenchmarkJobs({ campaignId, useSavedOverview: true });
    if (Number(recompute.campaignsProcessed || 0) <= 0 || recompute.campaignIdsSkipped.length > 0 || recompute.campaignIdsFailed.length > 0 || recompute.kpiIdsSkipped.length > 0 || recompute.kpiIdsFailed.length > 0 || recompute.benchmarkIdsSkipped.length > 0 || recompute.benchmarkIdsFailed.length > 0 || recompute.alertReconciliationFailures.length > 0) {
      throw new Error(`GA4 Google Ads downstream recompute was incomplete for campaign ${campaignId}`);
    }
  }
  return { updated: true, sourceId: String(source.id), records: materialized.records.length, totalSpend: totals.totalSpend };
}

/**
 * Enrich Google Ads daily metrics with GA4-attributed revenue.
 * Calls GA4 acquisition breakdown to get per-UTM-campaign revenue,
 * matches to Google Ads campaigns, and distributes revenue by spend weight.
 */
export async function enrichGoogleAdsWithGA4Revenue(
  campaignId: string,
  connection?: any,
): Promise<{ enriched: number; matched: number; unmatched: string[] }> {
  if (!connection) {
    connection = await storage.getGoogleAdsConnection(campaignId);
  }
  if (!connection) return { enriched: 0, matched: 0, unmatched: [] };

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - 90);

  return enrichPlatformWithGA4Revenue({
    campaignId,
    campaignUtmMap: connection.campaignUtmMap,
    platformLabel: 'Google Ads',
    getMetrics: async () => {
      const metrics = await storage.getGoogleAdsDailyMetrics(campaignId, iso(startDate), iso(now));
      return metrics.map((m: any) => ({
        platformCampaignId: m.googleCampaignId,
        platformCampaignName: m.googleCampaignName || m.googleCampaignId,
        date: m.date,
        spend: parseFloat(String(m.spend || '0')),
      }));
    },
    writeUpdates: async (updates) => {
      return storage.updateGoogleAdsDailyMetricsGA4Revenue(campaignId,
        updates.map(u => ({ googleCampaignId: u.platformCampaignId, date: u.date, ga4Revenue: u.ga4Revenue, ga4UtmName: u.ga4UtmName }))
      );
    },
  });
}

/**
 * Refresh Google Ads data for a single campaign
 */
export async function refreshGoogleAdsForCampaign(
  campaignId: string,
  connection?: any,
  opts?: GA4RefreshWriteInput & { advanceTestDay?: boolean; ga4SpendConnection?: boolean; deferDownstream?: boolean; allowDraftPreview?: boolean }
): Promise<{ providerRefreshed: boolean; spendMaterialization: { updated: boolean; sourceId: string | null; records: number; totalSpend: number | null } | null }> {
  const guarded = !!opts && "refreshScope" in opts;
  const refreshWriteInput: GA4RefreshGoogleAdsWriteInput = guarded ? { refreshScope: opts!.refreshScope } : {};
  if (guarded) {
    if (opts?.refreshScope?.campaignId !== campaignId || !opts?.deferDownstream || opts?.advanceTestDay) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    await storage.writeWithGA4RefreshOwnership(opts.refreshScope, async () => {});
    const sources = (await storage.getSpendSources(campaignId, "ga4")).filter(source => source.isActive !== false && source.sourceType === "ad_platforms"
      && JSON.parse(source.mappingConfig || "{}").platform === "google_ads");
    if (sources.length !== 1) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    refreshWriteInput.expectedSource = { id: sources[0].id, mappingConfig: sources[0].mappingConfig };
  }
  if (!connection) {
    connection = opts?.ga4SpendConnection
      ? await storage.getGA4GoogleAdsSpendConnection(campaignId)
      : await storage.getGoogleAdsConnection(campaignId, ...("refreshScope" in refreshWriteInput ? [refreshWriteInput] : []));
  }
  if (!connection) throw new Error(`Google Ads connection is unavailable for campaign ${campaignId}`);
  if (guarded) refreshWriteInput.expectedConnection = connection;
  const isSpendOnly = !!(connection as any).spendOnly;
  if (guarded && (!isSpendOnly || connection.method === "test_mode")) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
  const isTestMode = String((connection as any).method || "") === "test_mode";
  if (isSpendOnly && isTestMode) return { providerRefreshed: false, spendMaterialization: null };
  const campaign = await storage.getCampaign(campaignId).catch(() => null);
  if (!campaign || !String(campaign.ownerId || "").trim()
    || !filterActiveSchedulerCampaigns([campaign], guarded || (isSpendOnly && opts?.allowDraftPreview) ? campaignId : "").length) {
    throw new Error(`Google Ads campaign scope is unavailable for campaign ${campaignId}`);
  }
  if (connection.campaignId && connection.campaignId !== campaignId) throw new Error("Google Ads connection campaign scope does not match");
  if (isTestMode && String(process.env.NODE_ENV || "").trim().toLowerCase() === "production") throw new Error("Test-mode data is disabled in production");

  if (connection.method === 'test_mode') {
    await generateMockGoogleAdsData(campaignId, connection, { advanceDay: opts?.advanceTestDay });
    return { providerRefreshed: true, spendMaterialization: null };
  } else {
    if (!guarded) refreshWriteInput.googleAdsRefresh = { campaign: { ...campaign }, connection: { ...connection }, dedicatedSpend: !!opts?.ga4SpendConnection, allowDraftPreview: !!(isSpendOnly && opts?.allowDraftPreview) };
    await fetchRealGoogleAdsData(campaignId, connection, campaign, !!opts?.ga4SpendConnection, refreshWriteInput);
    if (isSpendOnly) {
      const refreshedConnection = opts?.ga4SpendConnection
        ? await storage.getGA4GoogleAdsSpendConnection(campaignId)
        : await storage.getGoogleAdsConnection(campaignId, ...("refreshScope" in refreshWriteInput ? [refreshWriteInput] : []));
      const spendMaterialization = await materializeGA4GoogleAdsSpendForCampaign(campaignId, campaign, refreshedConnection, !!opts?.ga4SpendConnection, !!opts?.deferDownstream, refreshWriteInput);
      return { providerRefreshed: true, spendMaterialization };
    }
    return { providerRefreshed: true, spendMaterialization: null };
  }
}

/**
 * Start the Google Ads scheduler
 * Runs every 4 hours (similar to Meta scheduler)
 */
export function startGoogleAdsScheduler(): void {
  if ((global as any).googleAdsSchedulerInterval) return;
  console.log('[Google Ads Scheduler] Starting Google Ads data refresh scheduler...');

  const refreshIntervalHours = Number(process.env.GOOGLE_ADS_REFRESH_INTERVAL_HOURS ?? '4');
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;
  if (!Number.isInteger(refreshIntervalHours) || refreshIntervalHours < 1 || refreshIntervalMs > 2147483647) {
    throw new Error('GOOGLE_ADS_REFRESH_INTERVAL_HOURS must be a whole number from 1 to 596');
  }

  console.log(`[Google Ads Scheduler] Refresh interval: ${refreshIntervalHours} hours`);

  (global as any).googleAdsSchedulerInterval = setInterval(() => {
    void refreshAllGoogleAdsMetrics().catch((error: any) => {
      console.error("[Google Ads Scheduler] Scheduled refresh failed:", error?.message || error);
    });
  }, refreshIntervalMs);

  console.log('[Google Ads Scheduler] Started successfully');
}

export function stopGoogleAdsScheduler(): void {
  if ((global as any).googleAdsSchedulerInterval) {
    clearInterval((global as any).googleAdsSchedulerInterval);
    (global as any).googleAdsSchedulerInterval = null;
  }
}

/**
 * Refresh all Google Ads connections (called by main scheduler)
 */
export async function refreshAllGoogleAdsMetrics(
  opts?: { advanceDay?: boolean }
): Promise<{ attempted: number; succeeded: number; failedCampaignIds: string[] }> {
  let connections: any[] = [];
  let spendConnections: Array<{ campaignId: string }> = [];
  try {
    connections = await db.select().from(googleAdsConnections);
  } catch (error: any) {
    throw new Error(`Google Ads connection inventory failed: ${error?.message || error}`);
  }
  let spendInventoryError: any = null;
  try {
    spendConnections = await db.select({ campaignId: ga4GoogleAdsSpendConnections.campaignId }).from(ga4GoogleAdsSpendConnections);
  } catch (error: any) {
    spendInventoryError = error;
  }

  let succeeded = 0;
  const failedCampaignIds: string[] = [];
  const dedicatedCampaignIds = new Set(spendConnections.map((connection) => connection.campaignId));
  const mainConnections = connections.filter((connection) => !connection.spendOnly || !dedicatedCampaignIds.has(connection.campaignId));
  for (const conn of mainConnections) {
    try {
      // Reload through storage so encrypted provider credentials are hydrated before refresh.
      await refreshGoogleAdsForCampaign(conn.campaignId, undefined, { advanceTestDay: opts?.advanceDay });
      succeeded++;
    } catch (e: any) {
      failedCampaignIds.push(String(conn.campaignId));
      console.error(`[Google Ads Scheduler] Error refreshing campaign ${conn.campaignId}:`, e.message);
    }
  }
  if (spendInventoryError) throw new Error(`GA4 Google Ads Spend connection inventory failed: ${spendInventoryError?.message || spendInventoryError}`);
  for (const connection of spendConnections) {
    try {
      await refreshGoogleAdsForCampaign(connection.campaignId, undefined, { ga4SpendConnection: true });
      succeeded++;
    } catch (error: any) {
      failedCampaignIds.push(connection.campaignId);
      console.error(`[Google Ads Scheduler] Error refreshing GA4 Spend campaign ${connection.campaignId}:`, error?.message || error);
    }
  }
  return { attempted: mainConnections.length + spendConnections.length, succeeded, failedCampaignIds };
}
