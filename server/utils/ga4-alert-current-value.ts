import { storage } from "../storage";
import { buildGoogleSheetsMetricSummary } from "./google-sheets-aggregate-source";
import { filterGoogleSheetsRows } from "./googleSheetsSelection";
import { hasCompleteGoogleSheetsCache } from "./google-sheets-revenue-ranges";
import { financialDailySnapshotInputSchema } from "../../shared/schema";
import { ga4Service } from "../analytics";
import {
  computeKpiValue,
  getGA4KPIReportingWindow,
  getYesopMockBaselineTotals,
  isNoRevenueFilter,
  isYesopMockProperty,
  parseGA4CampaignFilter,
} from "../ga4-kpi-benchmark-jobs";
import {
  getGA4KpiMetricDependencies,
  isGA4FinancialKpiMetricIdentity,
  resolveGA4KpiMetricIdentity,
} from "../../shared/ga4-kpi-metric-identity";
import {
  isGA4FinancialTotalsCandidate,
  parseGA4FinancialNumber,
  selectGA4FinancialTotalsSource,
} from "../../shared/ga4-financial-source";
import { summarizeGA4TrafficRows } from "../../shared/ga4-traffic-window";
import { applyAlertDataSufficiency, blockAlertDecision } from "./alert-decision";
import { getCampaignMetricTotals, resolveCampaignCurrentValueForAlert } from "./campaign-current-values";
import { getExpectedDailyRefreshAt, getExpectedScheduledRefreshAt, getReportingDateWindow, resolveGA4DailyFreshness } from "./reporting-timezone";
import { isSupportedGA4ConnectionMethod } from "./ga4-service-account";

const isGA4Platform = (value: unknown) => {
  const platform = String(value || "").trim().toLowerCase();
  return platform === "google_analytics" || platform === "ga4";
};

const toInputs = (totals: ReturnType<typeof summarizeGA4TrafficRows>) => ({
  users: Math.round(totals.users || 0),
  sessions: Math.round(totals.sessions || 0),
  pageviews: Math.round(totals.pageviews || 0),
  conversions: totals.conversions || 0,
  ga4Revenue: Number((totals.revenue || 0).toFixed(2)),
  engagementRate: Number(totals.engagementRate || 0) || 0,
});

type StoredGA4TrafficFreshnessInput = {
  rows: any[];
  startDate: string;
  dataThroughDate: string;
  now?: Date;
  schedulerConfig?: { reportingTimeZone: string; hour: number; hours?: number[]; minute: number };
  providerCoverageThroughDate?: string | null;
};

const addDateOnlyDays = (value: string, days: number): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const boundedSchedulerValue = (value: unknown, fallback: number, max: number) => {
  const parsed = parseInt(String(value ?? ""), 10);
  return Math.min(Math.max(Number.isFinite(parsed) ? parsed : fallback, 0), max);
};

export function resolveStoredGA4TrafficFreshness(input: StoredGA4TrafficFreshnessInput) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const now = input.now || new Date();
  const configuredHours = String(process.env.GA4_DAILY_REFRESH_HOURS || "").split(",")
    .map((value) => value.trim()).filter((value) => /^\d{1,2}$/.test(value))
    .map(Number).filter((value) => value >= 0 && value <= 23).sort((a, b) => a - b);
  const schedulerConfig = input.schedulerConfig || {
    reportingTimeZone: process.env.GA4_DAILY_REFRESH_TIME_ZONE || "UTC",
    hour: configuredHours[0] ?? boundedSchedulerValue(process.env.GA4_DAILY_REFRESH_HOUR, 3, 23),
    hours: configuredHours,
    minute: boundedSchedulerValue(process.env.GA4_DAILY_REFRESH_MINUTE, 0, 59),
  };
  const dates = rows
    .map((row: any) => String(row?.date || "").slice(0, 10))
    .filter((date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
  const latestStoredDailyDate = dates.length > 0 ? dates[dates.length - 1] : null;
  const oldestMissingDailyDate = latestStoredDailyDate
    ? (latestStoredDailyDate < input.dataThroughDate ? addDateOnlyDays(latestStoredDailyDate, 1) : null)
    : input.startDate;
  const missingExpectedRefreshAt = oldestMissingDailyDate
    ? getExpectedDailyRefreshAt(oldestMissingDailyDate, schedulerConfig.reportingTimeZone, schedulerConfig.hour, schedulerConfig.minute)
    : null;
  const oldestDueMissingDailyDate = oldestMissingDailyDate
    && oldestMissingDailyDate <= input.dataThroughDate
    && missingExpectedRefreshAt
    && missingExpectedRefreshAt.getTime() <= now.getTime()
      ? oldestMissingDailyDate
      : null;
  const lastCompletedRefreshAt = rows.reduce((latest: string | null, row: any) => {
    const time = row?.updatedAt ? new Date(row.updatedAt).getTime() : NaN;
    if (!Number.isFinite(time)) return latest;
    const timestamp = new Date(time).toISOString();
    return !latest || timestamp > latest ? timestamp : latest;
  }, null);

  return resolveGA4DailyFreshness({
    dataThroughDate: input.dataThroughDate,
    expectedRefreshAt: getExpectedScheduledRefreshAt(input.dataThroughDate, schedulerConfig, now),
    lastCompletedRefreshAt,
    oldestDueMissingDailyDate,
    providerCoverageThroughDate: input.providerCoverageThroughDate || null,
    now,
  });
}

export async function resolveAlertCurrentValueForDecision<T extends {
  campaignId?: string | null;
  calculationConfig?: unknown;
  currentValue?: unknown;
  metric?: unknown;
  name?: unknown;
  platformType?: unknown;
}>(
  row: T,
  cache?: Map<string, Promise<any>>,
  options: { allowCredentialRefresh?: boolean; requireCurrentTrafficFreshness?: boolean; providerCoverageThroughDate?: string | null; useSavedOverview?: boolean } = {},
): Promise<T & Record<string, any>> {
  const resolved = await resolveCampaignCurrentValueForAlert(row, cache, options.useSavedOverview === true);
  if (String(resolved.platformType || "").toLowerCase() === "google_ads"
    && (resolved.calculationConfig as any)?.currentValueMode === "automatic") {
    // Read current, campaign-scoped data for every consumer. Never overwrite a saved/manual goal.
    const unavailable = () => ({ ...blockAlertDecision(resolved, "unavailable"), currentValue: null }) as T & Record<string, any>;
    const campaignId = String(resolved.campaignId || "");
    if (!campaignId) return unavailable();
    try {
      const [campaign, connection] = await Promise.all([
        storage.getCampaign(campaignId),
        storage.getGoogleAdsConnection(campaignId, { migrateLegacyTokens: false }),
      ]);
      if (!campaign || campaign.status !== "active" || !connection || connection.campaignId !== campaignId || connection.spendOnly
        || !["oauth", "service_account", "test_mode"].includes(connection.method)
        || (connection.method === "test_mode" && process.env.NODE_ENV === "production")) return unavailable();
      const sourceScope = (parent: any, source: any) => JSON.stringify([parent?.id, parent?.ownerId, parent?.clientId, parent?.status, parent?.startDate, parent?.currency,
        parent?.reportingTimeZone, source?.id, source?.campaignId, source?.customerId, source?.managerAccountId,
        source?.method, source?.spendOnly, source?.selectedCampaignIds, source?.lastRefreshAt]);
      const expectedScope = sourceScope(campaign, connection);
      const window = getReportingDateWindow(90, campaign.reportingTimeZone);
      const campaignStart = new Date(campaign.startDate || "1900-01-01");
      if (!Number.isFinite(campaignStart.getTime())) return unavailable();
      const startDate = [window.startDate, campaignStart.toISOString().slice(0, 10)].sort().pop()!;
      const refreshedAt = new Date(connection.lastRefreshAt || "");
      if (startDate > window.endDate) return unavailable();
      if (connection.method !== "test_mode" && (!Number.isFinite(refreshedAt.getTime())
        || getReportingDateWindow(1, campaign.reportingTimeZone, refreshedAt).endDate < window.endDate)) return unavailable();
      const selected = JSON.parse(connection.selectedCampaignIds || "[]");
      if (!Array.isArray(selected) || selected.some(id => typeof id !== "string" || !id.trim())) return unavailable();
      const key = JSON.stringify(["google-ads-goal", campaignId, connection.id, connection.lastRefreshAt,
        connection.selectedCampaignIds, startDate, window.endDate]);
      let pending = cache?.get(key);
      if (!pending) {
        pending = storage.getGoogleAdsDailyMetrics(campaignId, startDate, window.endDate);
        cache?.set(key, pending);
      }
      const daily = (await pending).filter((item: any) => selected.length === 0 || selected.includes(item.googleCampaignId));
      if (!daily.length || daily.some((item: any) => item.campaignId !== campaignId
        || item.date < startDate || item.date > window.endDate)) return unavailable();
      // Refreshes replace the complete selected window; do not interpret absent rows as zero.
      const sum = (field: string): number => daily.reduce((total: number, item: any) => {
        const raw = item[field];
        const value = raw == null || String(raw).trim() === "" ? NaN : Number(raw);
        return total + (Number.isFinite(value) && value >= 0 ? value : NaN);
      }, 0);
      const metric = String(resolved.metric || (resolved as any).metricKey || "").toLowerCase();
      const divide = (numerator: number, denominator: number, scale = 1) => denominator > 0 ? numerator / denominator * scale : NaN;
      let value = NaN;
      const additive: Record<string, string> = { impressions: "impressions", clicks: "clicks", spend: "spend",
        conversions: "conversions", conversionvalue: "conversionValue", videoviews: "videoViews" };
      if (additive[metric]) value = sum(additive[metric]);
      else if (metric === "ctr") value = divide(sum("clicks"), sum("impressions"), 100);
      else if (metric === "cpc") value = divide(sum("spend"), sum("clicks"));
      else if (metric === "cpm") value = divide(sum("spend"), sum("impressions"), 1000);
      else if (metric === "conversionrate") value = divide(sum("conversions"), sum("clicks"), 100);
      else if (metric === "costperconversion") value = divide(sum("spend"), sum("conversions"));
      else if (metric === "searchimpressionshare") {
        const share = Number(daily[0].searchImpressionShare);
        value = daily.length === 1 && share >= 10 && share <= 100 ? share : NaN;
      } else if (["totalrevenue", "revenue", "profit", "roas", "roi"].includes(metric)) {
        const revenue = await storage.getRevenueTotalForRange(campaignId, startDate, window.endDate, "google_ads");
        const amount = revenue.totalRevenue;
        if (!revenue.sourceIds.length || !Number.isFinite(amount) || revenue.currency !== campaign.currency) return unavailable();
        const spend = sum("spend");
        value = metric === "profit" ? amount - spend : metric === "roas" ? divide(amount, spend)
          : metric === "roi" ? divide(amount - spend, spend, 100) : amount;
      }
      const [currentCampaign, currentConnection] = await Promise.all([
        storage.getCampaign(campaignId), storage.getGoogleAdsConnection(campaignId, { migrateLegacyTokens: false }),
      ]);
      if (sourceScope(currentCampaign, currentConnection) !== expectedScope) return unavailable();
      return Number.isFinite(value) ? { ...resolved, currentValue: String(value) } as T & Record<string, any> : unavailable();
    } catch {
      return unavailable();
    }
  }
  const sourcePlatform = String(resolved.platformType || "").trim().toLowerCase();
  if (sourcePlatform === "custom_integration" || sourcePlatform === "google_sheets") {
    const metric = String(resolved.metric || (resolved as any).metricKey || "").trim();
    // Custom manual goals intentionally retain their entered value.
    if (sourcePlatform === "custom_integration" && (!metric || metric === "custom")) return resolved;
    const unavailable = () => blockAlertDecision(resolved, "unavailable");
    try {
      const config = typeof resolved.calculationConfig === "string" ? JSON.parse(resolved.calculationConfig) : resolved.calculationConfig as any;
      const campaignId = String(resolved.campaignId || "");
      const campaign = campaignId ? await storage.getCampaign(campaignId) : null;
      if (!campaign || campaign.status === "deleted") return unavailable();
      const scope = config?.sourceScope;
      let value: number | null = null;
      let imported: any = null;
      let verifySource: () => Promise<boolean> = async () => true;
      const financialKey = sourcePlatform === "custom_integration"
        ? ({ revenue: "overview.total_revenue", spend: "overview.total_spend", roas: "overview.roas", roi: "overview.roi" } as Record<string, string>)[metric] || metric : metric;
      const financial = sourcePlatform === "custom_integration"
        ? ["overview.total_revenue", "overview.total_spend", "overview.roas", "overview.roi"].includes(financialKey)
        : config?.valueSource === "confirmed_financial_overview";
      if (sourcePlatform === "custom_integration") {
        const integration = await storage.getCustomIntegration(campaignId);
        if (scope?.platform !== sourcePlatform || scope.scopeType !== "latest_validated_import"
          || !integration || integration.campaignId !== campaignId || scope.integrationId !== integration.id) return unavailable();
        imported = await storage.getLatestCustomIntegrationMetrics(campaignId);
        verifySource = async () => {
          const [current, latest] = await Promise.all([storage.getCustomIntegration(campaignId), storage.getLatestCustomIntegrationMetrics(campaignId)]);
          return current?.id === integration.id && latest?.id === imported?.id;
        };
        if (!financial) {
          if (!imported || imported.campaignId !== campaignId) return unavailable();
          const allowed = ["impressions", "clicks", "conversions", "leads", "users", "sessions", "pageviews", "pagesPerSession", "bounceRate", "organicSearchShare", "directBrandedShare", "emailShare", "referralShare", "paidShare", "socialShare", "emailsDelivered", "openRate", "clickThroughRate", "clickToOpen", "clickToOpenRate", "listGrowth"];
          if (!allowed.includes(metric)) return unavailable();
          value = parseGA4FinancialNumber(metric === "clickToOpen" ? imported.clickToOpenRate ?? imported.clickToOpen : imported[metric]);
        }
      } else if (!financial) {
        const matches = (connection: any) => scope?.platform === sourcePlatform && scope?.activeSpreadsheetId
          && connection.campaignId === campaignId && connection.isActive !== false
          && (!connection.purpose || connection.purpose === "general")
          && [`${connection.spreadsheetId}:${connection.id}`, `${connection.spreadsheetId}:${connection.sheetName}`].includes(scope.activeSpreadsheetId)
          && (!scope.connectionId || scope.connectionId === connection.id)
          && (!scope.spreadsheetId || scope.spreadsheetId === connection.spreadsheetId)
          && (!scope.sheetName || scope.sheetName === connection.sheetName);
        const connections = (await storage.getGoogleSheetsConnections(campaignId, undefined, { migrateLegacyTokens: false, resolveRuntimeCredentials: false })).filter(matches);
        if (connections.length !== 1 || !hasCompleteGoogleSheetsCache(connections[0])) return unavailable();
        const connection = connections[0];
        const cache = connection.cachedData as any;
        const rows = filterGoogleSheetsRows(connection, cache.headers, cache.rows, campaign.name);
        const summary = buildGoogleSheetsMetricSummary(cache.headers, rows, connection.columnMappings);
        const columns = summary.detectedColumns.filter((column: any) => column.name === metric);
        if (columns.length !== 1) return unavailable();
        value = parseGA4FinancialNumber(columns[0].summaryValue);
        const fingerprint = (source: any) => JSON.stringify([source?.id, source?.columnMappings, source?.cachedData, source?.lastDataRefreshAt]);
        verifySource = async () => {
          const current = (await storage.getGoogleSheetsConnections(campaignId, undefined, { migrateLegacyTokens: false, resolveRuntimeCredentials: false })).filter(matches);
          return current.length === 1 && fingerprint(current[0]) === fingerprint(connection) && hasCompleteGoogleSheetsCache(current[0]);
        };
      }
      if (financial) {
        const needsRevenue = financialKey !== "overview.total_spend";
        const needsSpend = financialKey !== "overview.total_revenue";
        const [revenue, spend, revenueSources, spendSources] = await Promise.all([
          needsRevenue ? storage.getRevenueTotalForRange(campaignId, "1900-01-01", "2999-12-31", sourcePlatform) : Promise.resolve({ totalRevenue: 0, sourceIds: [], currency: undefined }),
          needsSpend ? storage.getSpendTotalForRange(campaignId, "1900-01-01", "2999-12-31", sourcePlatform) : Promise.resolve({ totalSpend: 0, sourceIds: [], currency: undefined }),
          needsRevenue ? storage.getRevenueSources(campaignId, sourcePlatform) : Promise.resolve([]),
          needsSpend ? storage.getSpendSources(campaignId, sourcePlatform) : Promise.resolve([]),
        ]);
        if ([revenue, spend].some(source => source.sourceIds.length > 0 && source.currency !== campaign.currency)) return unavailable();
        const importedRevenue = parseGA4FinancialNumber(imported?.revenue);
        const importedSpend = parseGA4FinancialNumber(imported?.spend);
        const hasRevenue = Number.isFinite(revenue.totalRevenue) && (revenue.sourceIds.length > 0 || importedRevenue !== null)
          && revenueSources.filter(source => source.isActive !== false).every(source => revenue.sourceIds.includes(String(source.id)));
        const hasSpend = Number.isFinite(spend.totalSpend) && (spend.sourceIds.length > 0 || importedSpend !== null)
          && spendSources.filter(source => source.isActive !== false).every(source => spend.sourceIds.includes(String(source.id)));
        const totalRevenue = revenue.totalRevenue + (importedRevenue ?? 0);
        const totalSpend = spend.totalSpend + (importedSpend ?? 0);
        if (financialKey === "overview.total_revenue" && hasRevenue) value = totalRevenue;
        if (financialKey === "overview.total_spend" && hasSpend) value = totalSpend;
        if (hasRevenue && hasSpend && totalSpend > 0 && (!revenue.currency || !spend.currency || revenue.currency === spend.currency)) {
          if (financialKey === "overview.roas") value = totalRevenue / totalSpend;
          if (financialKey === "overview.roi") value = (totalRevenue - totalSpend) / totalSpend * 100;
        }
      }
      const currentCampaign = await storage.getCampaign(campaignId);
      if (!currentCampaign || currentCampaign.ownerId !== campaign.ownerId || currentCampaign.clientId !== campaign.clientId
        || currentCampaign.status !== campaign.status || currentCampaign.currency !== campaign.currency || !(await verifySource())) return unavailable();
      return value !== null && Number.isFinite(value) ? { ...resolved, currentValue: String(value) } : unavailable();
    } catch {
      return unavailable();
    }
  }
  if (!isGA4Platform((resolved as any)?.platformType)) return resolved as T & Record<string, any>;

  const campaignId = String((resolved as any)?.campaignId || "").trim();
  const metric = resolveGA4KpiMetricIdentity((resolved as any)?.metric, (resolved as any)?.name);
  if (!campaignId) return blockAlertDecision(resolved, "blocked");
  if (!metric) return resolved as T & Record<string, any>;

  try {
    const [campaign, connections] = await Promise.all([
      storage.getCampaign(campaignId).catch(() => undefined as any),
      storage.getGA4Connections(campaignId, { migrateLegacyTokens: false }).catch(() => null as any),
    ]);
    const primary = (Array.isArray(connections) ? connections : []).find((connection: any) => connection?.isPrimary)
      || (Array.isArray(connections) ? connections : [])[0];
    const propertyId = String(primary?.propertyId || "").trim();
    if (!campaign || !propertyId) return blockAlertDecision(resolved, "unavailable");

    const reportingWindow = getGA4KPIReportingWindow(
      (campaign as any)?.reportingTimeZone,
      undefined,
      new Date(),
      primary.importStartDate,
    );
    const startDate = reportingWindow.startDate;
    const endDate = reportingWindow.endDate;
    const financialStartDate = reportingWindow.startDate;
    const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase();
    const sourceStartDate = financialStartDate < startDate ? financialStartDate : startDate;
    const usesFinancialSource = isGA4FinancialKpiMetricIdentity(metric);
    const configuredFilter = parseGA4CampaignFilter(campaign.ga4CampaignFilter);
    const useSavedOverview = options.useSavedOverview === true && usesFinancialSource && !isYesopMockProperty(propertyId)
      && (Array.isArray(configuredFilter) ? configuredFilter.length > 0 : !!configuredFilter);
    // Share successful stored-source reads only within this alert check. Keep scope and credentials fresh.
    const readSource = <T>(kind: string, args: unknown[], read: () => Promise<T>, usable: (value: T) => boolean): Promise<T> => {
      const key = JSON.stringify(["ga4-alert-stored-source", campaignId, propertyId,
        campaign.ga4CampaignFilter, campaign.reportingTimeZone, campaign.currency, kind, ...args]);
      const cached = cache?.get(key);
      if (cached) return cached;
      const pending = read().then((value) => {
        if (!usable(value)) cache?.delete(key);
        return value;
      }, (error) => {
        cache?.delete(key);
        throw error;
      });
      cache?.set(key, pending);
      return pending;
    };
    // Independent reads share the same resolved campaign/window; do not serialize their network waits.
    const financialWindow = { startDate: "1900-01-01", endDate: reportingWindow.endDate };
    const spendSourceStartDate = "1900-01-01";
    const financialInputsPromise = Promise.allSettled([
      usesFinancialSource
        ? readSource("revenue", [financialWindow.startDate, financialWindow.endDate],
          () => storage.getRevenueTotalForRange(campaignId, financialWindow.startDate, financialWindow.endDate, "ga4"),
          (value) => parseGA4FinancialNumber(value?.totalRevenue) !== null && Array.isArray(value?.sourceIds))
        : Promise.resolve(null),
      readSource("spend", [spendSourceStartDate, financialWindow.endDate],
        () => storage.getSpendTotalForRange(campaignId, spendSourceStartDate, financialWindow.endDate, "ga4"),
        (value) => parseGA4FinancialNumber(value?.totalSpend) !== null && Array.isArray(value?.sourceIds)),
    ]);
    const [rows, connection, overviewSnapshot, savedOverviewTotals] = await Promise.all([
      readSource("daily", [sourceStartDate, endDate],
        () => storage.getGA4DailyMetrics(campaignId, propertyId, sourceStartDate, endDate),
        (value) => Array.isArray(value) && value.length > 0).catch(() => null as any),
      !usesFinancialSource || useSavedOverview || isYesopMockProperty(propertyId) ? Promise.resolve(null)
        : storage.getGA4Connection(campaignId, propertyId).catch(() => null as any).then((value) => value || primary),
      usesFinancialSource
        ? readSource("overview-snapshot", [financialStartDate, endDate],
          () => storage.getGA4OverviewSnapshot(campaignId, propertyId),
          (value) => !!value).catch(() => null as any)
        : Promise.resolve(null),
      useSavedOverview
        ? readSource("verified-overview", [financialStartDate, endDate],
          () => getCampaignMetricTotals(campaignId, true, true),
          (value) => value?.ga4FinancialSource === "persisted_overview").catch(() => null)
        : Promise.resolve(null),
    ]);
    const sourceRows = Array.isArray(rows) ? rows : [];
    const trafficRows = sourceRows.filter((sourceRow: any) => {
      const date = String(sourceRow?.date || "");
      return date >= startDate && date <= endDate;
    });
    let trafficTotals = summarizeGA4TrafficRows(trafficRows);
    const financialTotals = summarizeGA4TrafficRows(sourceRows);
    const savedFinancialCandidate = savedOverviewTotals?.ga4FinancialSource === "persisted_overview"
      && savedOverviewTotals.sessions === financialTotals.sessions
      && savedOverviewTotals.financialConversions === financialTotals.conversions
        ? { revenue: savedOverviewTotals.ga4Revenue, conversions: savedOverviewTotals.financialConversions,
            sessions: savedOverviewTotals.sessions, users: savedOverviewTotals.users }
        : null;
    if (useSavedOverview && !savedFinancialCandidate) return blockAlertDecision(resolved, "unavailable");
    let ga4Inputs = toInputs(trafficTotals);
    let hasGA4SourceInput = trafficRows.length > 0;
    let hasAuthoritativeEngagementInput = trafficRows.length > 0;
    const usesTrafficSource = metric === "cpa" || !usesFinancialSource;
    if (options.requireCurrentTrafficFreshness && usesTrafficSource && resolveStoredGA4TrafficFreshness({
      rows: trafficRows,
      startDate,
      dataThroughDate: endDate,
      providerCoverageThroughDate: options.providerCoverageThroughDate,
    }).refreshIsStale) {
      return blockAlertDecision(resolved, "stale");
    }
    const storedFinancialCandidate = sourceRows.length > 0 ? {
      ...toInputs(financialTotals),
      revenue: Number((financialTotals.revenue || 0).toFixed(2)),
    } : null;
    const latestStoredDate = sourceRows.reduce((latest: string, sourceRow: any) =>
      String(sourceRow?.date || "") > latest ? String(sourceRow.date) : latest, "");
    const overviewTotals = (overviewSnapshot as any)?.campaignBreakdown?.totals;
    const overviewFinancialCandidate = overviewSnapshot
      && String((overviewSnapshot as any)?.windowStart || "") === financialStartDate
      && String((overviewSnapshot as any)?.windowEnd || "") === endDate
      && latestStoredDate === endDate
      && String((overviewSnapshot as any)?.campaignBreakdown?.meta?.currencyCode || "").trim().toUpperCase() === campaignCurrency
      && isGA4FinancialTotalsCandidate(overviewTotals)
        ? { ...overviewTotals, source: "ga4_overview_snapshot" }
        : null;
    let providerFinancialCandidate: any = null;
    let mockFinancialCandidate: any = null;

    if (isYesopMockProperty(propertyId)) {
      const noRevenue = isNoRevenueFilter((campaign as any)?.ga4CampaignFilter);
      const trafficBaseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue, 30);
      const baselineEngagedSessions = Math.round(trafficBaseline.sessions * trafficBaseline.engagementRate);
      const sessions = trafficTotals.sessions + trafficBaseline.sessions;
      trafficTotals = {
        users: trafficTotals.users + trafficBaseline.users,
        sessions,
        pageviews: trafficTotals.pageviews + trafficBaseline.pageviews,
        conversions: trafficTotals.conversions + trafficBaseline.conversions,
        revenue: trafficTotals.revenue + trafficBaseline.revenue,
        engagedSessions: trafficTotals.engagedSessions + baselineEngagedSessions,
        engagementRate: sessions > 0 ? (trafficTotals.engagedSessions + baselineEngagedSessions) / sessions : 0,
      };
      ga4Inputs = toInputs(trafficTotals);
      const financialBaseline = getYesopMockBaselineTotals(campaignId, (campaign as any)?.ga4CampaignFilter, noRevenue);
      mockFinancialCandidate = {
        users: financialTotals.users + financialBaseline.users,
        sessions: financialTotals.sessions + financialBaseline.sessions,
        pageviews: financialTotals.pageviews + financialBaseline.pageviews,
        conversions: financialTotals.conversions + financialBaseline.conversions,
        revenue: financialTotals.revenue + financialBaseline.revenue,
      };
      hasGA4SourceInput = true;
      hasAuthoritativeEngagementInput = true;
    } else {
      if (usesFinancialSource && isSupportedGA4ConnectionMethod(connection?.method) && connection?.accessToken) {
        const attempt = (token: string, fromDate: string) => {
          const args: Parameters<typeof ga4Service.getTotalsWithRevenue> = [
            String(connection.propertyId || propertyId),
            token,
            fromDate,
            endDate,
            parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter),
            campaignCurrency,
          ];
          // Reuse only identical native reads within this caller's alert check, never across saves.
          const key = JSON.stringify(["ga4-alert-native-totals", campaignId, ...args]);
          const cached = cache?.get(key);
          if (cached) return cached;
          const pending = ga4Service.getTotalsWithRevenue(...args).then((result) => {
            if (!isGA4FinancialTotalsCandidate(result?.totals)) cache?.delete(key);
            return result;
          }, (error) => {
            cache?.delete(key);
            throw error;
          });
          cache?.set(key, pending);
          return pending;
        };
        const assignProviderInputs = async (token: string) => {
          const candidate = (await attempt(token, financialStartDate))?.totals;
          providerFinancialCandidate = isGA4FinancialTotalsCandidate(candidate) ? candidate : null;
        };
        try {
          await assignProviderInputs(String(connection.accessToken));
        } catch (error: any) {
          const message = String(error?.message || "");
          const isAuth = message.includes("401")
            || message.includes("403")
            || message.toLowerCase().includes("unauthenticated")
            || message.toLowerCase().includes("invalid authentication credentials")
            || message.toLowerCase().includes("request had invalid authentication credentials")
            || message.toLowerCase().includes("invalid_grant");
          if (isAuth && options.allowCredentialRefresh !== false && connection?.refreshToken && connection?.id) {
            const refresh = await ga4Service.refreshAccessToken(
              String(connection.refreshToken),
              connection.clientId || undefined,
              connection.clientSecret || undefined,
            );
            await storage.updateGA4ConnectionTokens(connection.id, {
              accessToken: refresh.access_token,
              refreshToken: String(connection.refreshToken),
              expiresAt: new Date(Date.now() + refresh.expires_in * 1000),
            });
            await assignProviderInputs(String(refresh.access_token));
          }
        }
      }

    }

    const selectedFinancialCandidate = selectGA4FinancialTotalsSource(
      useSavedOverview ? [savedFinancialCandidate] : [mockFinancialCandidate, providerFinancialCandidate, overviewFinancialCandidate, storedFinancialCandidate],
      {} as any,
    );
    const financialCandidateAvailable = isGA4FinancialTotalsCandidate(selectedFinancialCandidate);
    const financialInputs = financialCandidateAvailable ? {
      users: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.users) ?? ga4Inputs.users),
      sessions: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.sessions ?? (selectedFinancialCandidate as any)?.sessionsRaw) ?? ga4Inputs.sessions),
      pageviews: Math.round(parseGA4FinancialNumber((selectedFinancialCandidate as any)?.pageviews) ?? ga4Inputs.pageviews),
      conversions: parseGA4FinancialNumber((selectedFinancialCandidate as any)?.conversions) ?? 0,
      ga4Revenue: Number((parseGA4FinancialNumber((selectedFinancialCandidate as any)?.revenue) ?? 0).toFixed(2)),
      engagementRate: parseGA4FinancialNumber((selectedFinancialCandidate as any)?.engagementRate) ?? ga4Inputs.engagementRate,
    } : null;

    const [importedRevenueResult, spendResult] = await financialInputsPromise;
    const importedRevenueValue = importedRevenueResult.status === "fulfilled"
      ? parseGA4FinancialNumber((importedRevenueResult.value as any)?.totalRevenue)
      : null;
    const hasImportedRevenueSource = importedRevenueResult.status === "fulfilled"
      && Array.isArray((importedRevenueResult.value as any)?.sourceIds)
      && (importedRevenueResult.value as any).sourceIds.length > 0;
    const spendValue = spendResult.status === "fulfilled"
      ? parseGA4FinancialNumber((spendResult.value as any)?.totalSpend)
      : null;

    if (usesFinancialSource) {
      const dependencies = getGA4KpiMetricDependencies(metric);
      const sourceVerified = !!financialInputs
        && (!dependencies.requiresRevenue || !hasImportedRevenueSource || !!mockFinancialCandidate || !!providerFinancialCandidate || !!savedFinancialCandidate)
        && (!dependencies.requiresRevenue || importedRevenueValue !== null)
        && (!dependencies.requiresSpend || spendValue !== null);
      if (!sourceVerified) return blockAlertDecision(resolved, "unavailable");
      if (useSavedOverview) {
        const snapshot = await readSource("financial-publication", [endDate],
          () => storage.getLatestFinancialDailySnapshot(campaignId, endDate), (value) => !!value);
        const parsed = financialDailySnapshotInputSchema.safeParse({
          ...(snapshot?.metrics as any)?.financialDaily,
          campaignId: snapshot?.campaignId, reportingDate: snapshot?.reportingDate,
        });
        if (!parsed.success || parsed.data.campaignId !== campaignId || parsed.data.currency !== campaignCurrency
          || parsed.data.currentValueWindow.startDate !== financialStartDate || parsed.data.reportingDate !== endDate
          || parsed.data.currentValueWindow.reportingTimeZone !== reportingWindow.reportingTimeZone) {
          return blockAlertDecision(resolved, "unavailable");
        }
        const published = parsed.data.inputs;
        if ((dependencies.requiresRevenue && (!published.revenue.available
              || Number(published.revenue.value) !== Number((financialInputs!.ga4Revenue + (importedRevenueValue ?? 0)).toFixed(2))))
          || (dependencies.requiresSpend && (!published.spend.available || Number(published.spend.value) !== spendValue))
          || (metric === "cpa" && (!published.conversions.available || published.conversions.value !== financialInputs!.conversions))) {
          return blockAlertDecision(resolved, "unavailable");
        }
      }
    } else if (!hasGA4SourceInput || (metric === "engagement_rate" && !hasAuthoritativeEngagementInput)) {
      return blockAlertDecision(resolved, "unavailable");
    }

    const inputs = usesFinancialSource ? financialInputs! : ga4Inputs;
    const currentValue = computeKpiValue(metric, {
      users: inputs.users,
      sessions: inputs.sessions,
      pageviews: inputs.pageviews,
      conversions: inputs.conversions,
      ga4Revenue: inputs.ga4Revenue,
      importedRevenue: importedRevenueValue ?? 0,
      spend: spendValue ?? 0,
      engagementRate: inputs.engagementRate,
    });
    return applyAlertDataSufficiency(
      { ...resolved, currentValue: String(currentValue) },
      {
        metric,
        name: String((resolved as any)?.name || ""),
        sessions: inputs.sessions,
        conversions: inputs.conversions,
        spend: spendValue,
      },
    );
  } catch {
    return blockAlertDecision(resolved, "unavailable");
  }
}
