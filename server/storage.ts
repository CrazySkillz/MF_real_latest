import { type Client, type InsertClient, type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GA4DailyMetric, type InsertGA4DailyMetric, type GA4OverviewSnapshot, type LinkedInDailyMetric, type InsertLinkedInDailyMetric, type SpendSource, type InsertSpendSource, type SpendRecord, type InsertSpendRecord, type RevenueSource, type InsertRevenueSource, type RevenueRecord, type InsertRevenueRecord, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type HubspotConnection, type InsertHubspotConnection, type SalesforceConnection, type InsertSalesforceConnection, type ShopifyConnection, type InsertShopifyConnection, type LinkedInConnection, type InsertLinkedInConnection, type MetaConnection, type InsertMetaConnection, type MetaDailyMetric, type InsertMetaDailyMetric, type MetaKpi, type InsertMetaKpi, type MetaBenchmark, type InsertMetaBenchmark, type MetaReport, type InsertMetaReport, type GoogleAdsConnection, type InsertGoogleAdsConnection, type GoogleAdsDailyMetric, type InsertGoogleAdsDailyMetric, type LinkedInImportSession, type InsertLinkedInImportSession, type LinkedInImportMetric, type InsertLinkedInImportMetric, type LinkedInAdPerformance, type InsertLinkedInAdPerformance, type LinkedInReport, type InsertLinkedInReport, type CustomIntegration, type InsertCustomIntegration, type CustomIntegrationMetrics, type InsertCustomIntegrationMetrics, type ConversionEvent, type InsertConversionEvent, type KPI, type InsertKPI, type KPIPeriod, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, type KPIReport, type InsertKPIReport, type Benchmark, type InsertBenchmark, type BenchmarkHistory, type InsertBenchmarkHistory, type MetricSnapshot, type InsertMetricSnapshot, type FinancialDailySnapshotInput, financialDailySnapshotInputSchema, type Notification, type InsertNotification, type ABTest, type InsertABTest, type ABTestVariant, type InsertABTestVariant, type ABTestResult, type InsertABTestResult, type ABTestEvent, type InsertABTestEvent, type AttributionModel, type InsertAttributionModel, type CustomerJourney, type InsertCustomerJourney, type Touchpoint, type InsertTouchpoint, type AttributionResult, type InsertAttributionResult, type AttributionInsight, type InsertAttributionInsight, clients, campaigns, metrics, integrations, performanceData, ga4Connections, ga4DailyMetrics, ga4OverviewSnapshots, linkedinDailyMetrics, spendSources, spendRecords, revenueSources, revenueRecords, notifications, emailAlertEvents, googleSheetsConnections, hubspotConnections, salesforceConnections, shopifyConnections, linkedinConnections, metaConnections, metaDailyMetrics, metaKpis, metaBenchmarks, metaReports, googleAdsConnections, googleAdsDailyMetrics, linkedinImportSessions, linkedinImportMetrics, linkedinAdPerformance, linkedinReports, reportSnapshots, reportSendEvents, customIntegrations, customIntegrationMetrics, conversionEvents, kpis, kpiPeriods, kpiProgress, kpiAlerts, kpiReports, benchmarks, benchmarkHistory, metricSnapshots, abTests, abTestVariants, abTestResults, abTestEvents, attributionModels, customerJourneys, touchpoints, attributionResults, attributionInsights } from "@shared/schema";
import { type InstagramConnection, type InsertInstagramConnection, type InstagramDailyMetric, type InsertInstagramDailyMetric, type TikTokConnection, type InsertTikTokConnection, type TikTokDailyMetric, type InsertTikTokDailyMetric, instagramConnections, instagramDailyMetrics, tiktokConnections, tiktokDailyMetrics } from "@shared/schema";
import { type GA4GoogleAdsSpendConnection, type InsertGA4GoogleAdsSpendConnection, type GA4GoogleAdsSpendDailyMetric, type InsertGA4GoogleAdsSpendDailyMetric, ga4GoogleAdsSpendConnections, ga4GoogleAdsSpendDailyMetrics } from "@shared/schema";
import { randomUUID, createHash } from "crypto";
import { ga4RefreshWork, ga4ConnectionLifecycleEvents, type GA4RefreshWork, type GA4InitialImportStatus } from "@shared/schema";
import { filterActiveSchedulerCampaigns } from "./utils/campaign-scheduler-eligibility";
import { db, pool } from "./db";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, or, isNull, desc, sql, gte, lte, lt, inArray, ne } from "drizzle-orm";
import { assertProductionTokenEncryptionConfigured, buildEncryptedTokens, decryptTokens, encryptString, type EncryptedTokens } from "./utils/tokenVault";
import { isDeepStrictEqual } from "node:util";
import { inboundWebhookReceipts, serviceAccountResourceGrants, campaignCreationRequests } from "@shared/schema";
import { assertGA4ServiceAccountPropertyAllowed, GA4_SERVICE_ACCOUNT_METHOD, hydrateGA4ServiceAccountConnection } from "./utils/ga4-service-account";
import { GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD, hydrateGoogleSheetsServiceAccountConnection } from "./utils/google-sheets-service-account";
import { GOOGLE_ADS_SERVICE_ACCOUNT_METHOD, getGoogleAdsServiceAccountLoginCustomerId, hydrateGoogleAdsServiceAccountConnection } from "./utils/google-ads-service-account";
import { assertGa4RevenueCurrencyIntegrity, assertGa4RevenueMaterializationComplete, requiresGa4RevenueMaterializationCompleteness } from "./utils/revenue-record-total";
import { normalizeGA4InsightsDailyMetricValues } from "../shared/ga4-insights";
import { GA4_OVERVIEW_LEGACY_IMPORT_START_DATE, getLatestCompleteReportingDate, getReportingComparisonBoundary, getReportingDateEndAt, isCreatedThroughReportingDate, normalizeReportingTimeZone } from "./utils/reporting-timezone";
import { executiveSummaryDailySnapshotInputSchema, type ExecutiveSummaryDailySnapshotInput } from "./utils/executive-summary-daily-snapshot";
import { createActiveCanonicalGA4KPI, isActiveGA4KPI, updateCanonicalGA4KPI as updateCanonicalGA4KPIWithGuard } from "./utils/ga4-kpi-create-guard";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { normalizeShopifyDomain, resolveNewestShopifyOauthCredential } from "./utils/shopify-provider";

const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
function hasValidatedCustomIntegrationMetadata(metrics: any): boolean {
  const metadata = metrics?.parserMetadata;
  return metadata?.validationVersion === 2 && metadata.requiresReview === false
    && Number(metadata.confidence) >= 95 && Number(metadata.extractedFields) > 0
    && Array.isArray(metadata.warnings) && metadata.warnings.length === 0;
}
const devLog = (...args: any[]) => {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

export type RevenuePlatformContext = 'ga4' | 'linkedin' | 'meta' | 'google_ads' | 'instagram' | 'tiktok' | 'google_sheets' | 'custom_integration';
export type SpendPlatformContext = RevenuePlatformContext;
export type GA4RevenuePublication = { version: 1; reportingDate: string; sources: Record<string, string>; pendingSourceIds: string[] };
export type GA4RevenuePublicationStatus = Record<string, { status: "published" | "pending" | "failed"; hash: string }>;
export type KPINotificationHide = { id: string; campaignId: string; metadata: string };
export type CampaignDeepDiveReportLimitCode = "REPORT_LIMIT_REACHED" | "SCHEDULED_REPORT_LIMIT_REACHED";
export type CampaignDeepDiveReportLimits = { maxActiveReports: number; maxScheduledActiveReports: number };
export type CampaignDeepDiveReportWriteResult = { report: LinkedInReport | undefined; limitCode: CampaignDeepDiveReportLimitCode | null };
export function resolveCampaignDeepDiveReportWriteLimit(
  existingReports: Array<{ status: string | null; scheduleEnabled: boolean | null }>,
  change: { incrementsActiveCount: boolean; incrementsScheduledActiveCount: boolean },
  limits: CampaignDeepDiveReportLimits,
): CampaignDeepDiveReportLimitCode | null {
  const activeReports = existingReports.filter((report) => String(report.status || "active") !== "archived");
  if (change.incrementsActiveCount && activeReports.length >= limits.maxActiveReports) return "REPORT_LIMIT_REACHED";
  const scheduledActiveReports = activeReports.filter((report) => report.scheduleEnabled === true && String(report.status || "") === "active");
  if (change.incrementsScheduledActiveCount && scheduledActiveReports.length >= limits.maxScheduledActiveReports) return "SCHEDULED_REPORT_LIMIT_REACHED";
  return null;
}
export const selectMaterializedRevenueTotal = (aggregate: number, subCampaign: number, hasAggregate: boolean) =>
  hasAggregate ? aggregate : subCampaign;

export const selectStableExactDateSpendSnapshot = <T extends { totalSpend?: any; metrics?: any }>(snapshots: T[]): T | undefined => {
  const snapshotKey = (snapshot: T): string | null => {
    const metric = snapshot?.metrics?.performanceSummary?.totals?.spend;
    const value = Number(metric?.value);
    const totalSpend = Number(snapshot?.totalSpend);
    const sources = Array.isArray(metric?.sources) ? metric.sources.map(String).sort() : [];
    if (metric?.available !== true || !Number.isFinite(value) || value < 0 || sources.length === 0
      || !Number.isFinite(totalSpend) || Math.abs(totalSpend - value) >= 0.005) return null;
    return `${value.toFixed(2)}::${sources.join("|")}`;
  };
  const keyed = snapshots.map((snapshot) => ({ snapshot, key: snapshotKey(snapshot) }));
  if (keyed.length === 0 || keyed.some(({ key }) => key === null)) return undefined;
  const counts = new Map<string, number>();
  for (const { key } of keyed) counts.set(key!, (counts.get(key!) || 0) + 1);
  const stableKey = Array.from(counts).find(([, count]) => count > keyed.length / 2)?.[0];
  return stableKey ? keyed.find(({ key }) => key === stableKey)?.snapshot : undefined;
};

async function hydrateGoogleSheetsConnectionForRead<T extends Record<string, any>>(connection: T): Promise<T> {
  try {
    return await hydrateGoogleSheetsServiceAccountConnection(connection);
  } catch {
    if (String(connection?.method || "") !== GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD) {
      throw new Error("Failed to read Google Sheets connection");
    }
    return { ...connection, accessToken: null, refreshToken: null, clientId: null, clientSecret: null };
  }
}

const spendPlatformContextPredicate = (platformContext?: SpendPlatformContext) => {
  if (!platformContext) return undefined;
  return platformContext === "ga4"
    ? or(eq(spendSources.platformContext, "ga4"), isNull(spendSources.platformContext))
    : eq(spendSources.platformContext, platformContext);
};

const deleteInstagramFinancialDataForCampaign = async (tx: any, campaignId: string): Promise<void> => {
  const instagramSpendSources = await tx
    .select({ id: spendSources.id })
    .from(spendSources)
    .where(and(
      eq(spendSources.campaignId, campaignId),
      or(eq(spendSources.sourceType, "instagram_api"), eq(spendSources.platformContext, "instagram"))
    ));
  const instagramSpendSourceIds = instagramSpendSources.map((source: any) => String(source.id)).filter(Boolean);
  if (instagramSpendSourceIds.length > 0) {
    await tx.delete(spendRecords).where(or(
      inArray(spendRecords.spendSourceId, instagramSpendSourceIds),
      and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.sourceType, "instagram_api"))
    ));
    await tx.update(spendSources)
      .set({ isActive: false } as any)
      .where(inArray(spendSources.id, instagramSpendSourceIds));
  } else {
    await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.sourceType, "instagram_api")));
  }

  const instagramRevenueSources = await tx
    .select({ id: revenueSources.id })
    .from(revenueSources)
    .where(and(eq(revenueSources.campaignId, campaignId), eq(revenueSources.platformContext, "instagram")));
  const instagramRevenueSourceIds = instagramRevenueSources.map((source: any) => String(source.id)).filter(Boolean);
  if (instagramRevenueSourceIds.length > 0) {
    await tx.delete(revenueRecords).where(inArray(revenueRecords.revenueSourceId, instagramRevenueSourceIds));
    await tx.update(revenueSources)
      .set({ isActive: false } as any)
      .where(inArray(revenueSources.id, instagramRevenueSourceIds));
  }
};

const deleteTikTokFinancialDataForCampaign = async (tx: any, campaignId: string): Promise<void> => {
  const tiktokSpendSources = await tx
    .select({ id: spendSources.id })
    .from(spendSources)
    .where(and(
      eq(spendSources.campaignId, campaignId),
      or(eq(spendSources.sourceType, "tiktok_api"), eq(spendSources.platformContext, "tiktok"))
    ));
  const tiktokSpendSourceIds = tiktokSpendSources.map((source: any) => String(source.id)).filter(Boolean);
  if (tiktokSpendSourceIds.length > 0) {
    await tx.delete(spendRecords).where(or(
      inArray(spendRecords.spendSourceId, tiktokSpendSourceIds),
      and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.sourceType, "tiktok_api"))
    ));
    await tx.update(spendSources)
      .set({ isActive: false } as any)
      .where(inArray(spendSources.id, tiktokSpendSourceIds));
  } else {
    await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.sourceType, "tiktok_api")));
  }

  const tiktokRevenueSources = await tx
    .select({ id: revenueSources.id })
    .from(revenueSources)
    .where(and(eq(revenueSources.campaignId, campaignId), eq(revenueSources.platformContext, "tiktok")));
  const tiktokRevenueSourceIds = tiktokRevenueSources.map((source: any) => String(source.id)).filter(Boolean);
  if (tiktokRevenueSourceIds.length > 0) {
    await tx.delete(revenueRecords).where(inArray(revenueRecords.revenueSourceId, tiktokRevenueSourceIds));
    await tx.update(revenueSources)
      .set({ isActive: false } as any)
      .where(inArray(revenueSources.id, tiktokRevenueSourceIds));
  }
};

function hydrateDecryptedTokens<T extends Record<string, any>>(row: T): T {
  const enc = (row as any)?.encryptedTokens as EncryptedTokens | undefined;
  const dec = decryptTokens(enc);
  const merged = { ...row } as any;
  if (dec.accessToken !== undefined && dec.accessToken !== null) merged.accessToken = dec.accessToken;
  if (dec.refreshToken !== undefined && dec.refreshToken !== null) merged.refreshToken = dec.refreshToken;
  if (dec.clientSecret !== undefined && dec.clientSecret !== null) merged.clientSecret = dec.clientSecret;
  return merged;
}

export type GA4OverviewSnapshotInput = {
  windowStart: string;
  windowEnd: string;
  campaignBreakdown: Record<string, any>;
  landingPages: Record<string, any>;
  conversionEvents: Record<string, any>;
  refreshScope?: {
    campaign: Record<string, unknown>;
    connection: Record<string, unknown>;
    previousUpdatedAt: string | null;
    previousWorkVersion?: string | null;
    work?: { id: string; leaseToken: string };
  };
};

// Internal refresh metadata; never part of a persisted metric or API response.
export type GA4RefreshWriteInput = {
  refreshScope?: { campaignId: string; ownerId: string; reportingDate: string; work: { id: string; leaseToken: string } };
  publicationVersion?: { campaignId: string; version: string | null };
  googleAdsRefresh?: { campaign: Record<string, any>; connection: Record<string, any>; dedicatedSpend: boolean; allowDraftPreview?: boolean; source?: Record<string, any> | null };
};

export type GA4RefreshConnectionWriteInput = GA4RefreshWriteInput & { expectedConnection?: Record<string, any> };

export type GA4RefreshGoogleAdsWriteInput = GA4RefreshConnectionWriteInput & { expectedSource?: { id: string; mappingConfig: string | null } };

export interface IStorage {
  withGA4PropertyRequest<T>(propertyId: string, signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>): Promise<T>;
  assertServiceAccountResourceAccess(campaignId: string, provider: "ga4" | "google_sheets" | "google_ads", resourceId: string): Promise<void>;
  writeWithGA4RefreshOwnership<T>(scope: GA4RefreshWriteInput["refreshScope"], write: (tx: any) => Promise<T>): Promise<T>;
  getGA4PublicationVersion(campaignId: string): Promise<string | null>;
  isGA4NativeRecoveryEligible(campaignId: string, options?: { includeFinancialSources?: boolean; revenueChange?: boolean }): Promise<boolean>;
  getRecoverableGA4RefreshWork(): Promise<GA4RefreshWork[]>;
  requestGA4InitialImport(campaignId: string, ownerId: string, updates: Pick<InsertCampaign, "platform" | "ga4CampaignFilter">, retry?: boolean): Promise<GA4RefreshWork | undefined>;
  getGA4InitialImportWork(campaignId: string, ownerId: string, workId?: string): Promise<GA4RefreshWork | undefined>;
  getGA4InitialImportStatus(campaignId: string, ownerId: string): Promise<GA4InitialImportStatus | null>;
  retireGA4RefreshWork(campaignId: string): Promise<void>;
  writeGA4DerivedChange<T>(campaignId: string | null | undefined, options: GA4RefreshWriteInput, write: (tx: any) => Promise<T>): Promise<T>;
  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign, requestId?: string): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>, options?: GA4RefreshWriteInput): Promise<Campaign | undefined>;
  updateCampaignWithGA4DailyInvalidation(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  deleteCampaignCascade(id: string, options?: { expectedDraftOwnerId: string }): Promise<boolean>;
  cancelCampaignCreation(ownerId: string, clientId: string, requestId: string): Promise<boolean>;

  // Metrics
  getMetrics(ownerId?: string): Promise<Metric[]>;
  createMetric(metric: InsertMetric, ownerId?: string): Promise<Metric>;

  // Integrations
  getIntegrations(ownerId?: string): Promise<Integration[]>;
  getIntegration(id: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration, ownerId?: string): Promise<Integration>;
  updateIntegration(id: string, integration: Partial<InsertIntegration>): Promise<Integration | undefined>;

  // Performance Data
  getPerformanceData(ownerId?: string): Promise<PerformanceData[]>;
  createPerformanceData(data: InsertPerformanceData, ownerId?: string): Promise<PerformanceData>;

  // GA4 Connections
  transferCampaignConnection(fromCampaignId: string, toCampaignId: string, ownerId: string, platform: "ga4" | "google_sheets" | "linkedin" | "meta"): Promise<{ connectionId: string } | undefined>;
  getGA4Connections(campaignId: string, options?: { migrateLegacyTokens?: boolean; resolveRuntimeCredentials?: boolean }): Promise<GA4Connection[]>;
  getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined>;
  getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined>;
  createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection>;
  stageGA4OAuthConnection(connection: InsertGA4Connection): Promise<GA4Connection>;
  getPendingGA4OAuthConnection(campaignId: string, connectionId?: string): Promise<GA4Connection | undefined>;
  commitGA4OAuthConnection(campaignId: string, connectionId: string, propertyId: string, propertyName: string, importStartDate: string): Promise<GA4Connection>;
  cancelGA4OAuthConnection(campaignId: string, connectionId: string): Promise<boolean>;
  updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined>;
  updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }, options?: GA4RefreshConnectionWriteInput): Promise<GA4Connection | undefined>;
  setPrimaryGA4Connection(campaignId: string, connectionId: string): Promise<boolean>;
  deleteGA4Connection(connectionId: string): Promise<boolean>;

  // GA4 Daily Metrics (daily facts)
  ensureGA4RefreshWork(campaignId: string, ownerId: string, dueAt: Date, reportingDate: string, options?: { suppressAlerts?: boolean; revenueChange?: boolean }): Promise<GA4RefreshWork | undefined>;
  claimGA4RefreshWork(campaignId: string, ownerId: string, workId: string, leaseMs: number): Promise<GA4RefreshWork | undefined>;
  updateGA4RefreshWorkLease(campaignId: string, ownerId: string, workId: string, leaseToken: string, action: "renew" | "release" | "complete" | "complete_without_alerts" | "complete_initial_import", leaseMs?: number, publicationCompletedAt?: string, failure?: { retryable: boolean; code: string; retryAfterMs?: number }): Promise<GA4RefreshWork | undefined>;
  upsertGA4DailyMetrics(rows: InsertGA4DailyMetric[]): Promise<{ upserted: number }>;
  replaceGA4DailyMetricsWindow(campaignId: string, propertyId: string, startDate: string, endDate: string, rows: InsertGA4DailyMetric[], overviewSnapshot?: GA4OverviewSnapshotInput): Promise<{ replaced: number }>;
  getGA4DailyMetrics(campaignId: string, propertyId: string, startDate: string, endDate: string): Promise<GA4DailyMetric[]>;
  getLatestGA4DailyMetric(campaignId: string, propertyId: string): Promise<GA4DailyMetric | undefined>;
  getGA4OverviewSnapshot(campaignId: string, propertyId: string): Promise<GA4OverviewSnapshot | undefined>;

  // LinkedIn Daily Metrics (daily facts)
  upsertLinkedInDailyMetrics(rows: InsertLinkedInDailyMetric[]): Promise<{ upserted: number }>;
  getLinkedInDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<LinkedInDailyMetric[]>;

  // Spend (generic)
  getSpendSources(campaignId: string, platformContext?: SpendPlatformContext): Promise<SpendSource[]>;
  getInactiveSpendSources(campaignId: string): Promise<SpendSource[]>;
  getGoogleSheetsSpendCleanupState(campaignId: string): Promise<{ sources: SpendSource[]; records: SpendRecord[] }>;
  cleanupGoogleSheetsSpendDuplicates(campaignId: string, expected: { sources: SpendSource[]; records: SpendRecord[] }, sourceIds: string[], mode: 'deactivate' | 'purge'): Promise<string[]>;
  getSpendSource(campaignId: string, sourceId: string, platformContext?: SpendPlatformContext): Promise<SpendSource | undefined>;
  createSpendSource(source: InsertSpendSource): Promise<SpendSource>;
  updateSpendSource(sourceId: string, source: Partial<InsertSpendSource>): Promise<SpendSource | undefined>;
  deleteSpendSource(sourceId: string): Promise<boolean>;
  deleteSpendSourceWithRecords(campaignId: string, sourceId: string, platformContext: SpendPlatformContext): Promise<boolean>;
  disconnectGa4GoogleSheetsSpend(campaignId: string): Promise<{ sourceIds: string[]; connectionIds: string[] }>;
  disconnectGa4GoogleAdsSpend(campaignId: string): Promise<{ sourceIds: string[]; connectionRemoved: boolean }>;
  hardDeleteInactiveSpendSource(campaignId: string, sourceId: string): Promise<boolean>;
  deleteSpendRecordsBySource(sourceId: string): Promise<boolean>;
  countSpendRecordsBySource(sourceId: string): Promise<number>;
  createSpendRecords(records: InsertSpendRecord[]): Promise<SpendRecord[]>;
  replaceSpendSourceWithRecords(campaignId: string, existingSourceId: string | null, sourceType: string, platformContext: SpendPlatformContext, source: InsertSpendSource, records: Array<Omit<InsertSpendRecord, 'spendSourceId'>>, expectedSourceMappingConfig?: string | null, options?: GA4RefreshWriteInput): Promise<SpendSource>;
  replaceSpendRecordsForSource(campaignId: string, sourceId: string, sourceType: string, platformContext: SpendPlatformContext, records: Array<Omit<InsertSpendRecord, 'spendSourceId'>>, expectedSourceMappingConfig?: string | null, options?: GA4RefreshWriteInput): Promise<void>;
  replaceCsvSpendSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    source: InsertSpendSource,
    records: Array<Omit<InsertSpendRecord, "spendSourceId">>,
  ): Promise<SpendSource>;
  getSpendTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext): Promise<{ totalSpend: number; currency?: string; sourceIds: string[] }>;
  getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; spend: number; currency?: string }>>;

  // Revenue (generic; platform-scoped to avoid GA4/LinkedIn leakage)
  getRevenueSources(campaignId: string, platformContext?: RevenuePlatformContext): Promise<RevenueSource[]>;
  getGA4RevenuePublication(campaignId: string, reportingDate: string): Promise<GA4RevenuePublication>;
  getGA4RevenuePublicationStatus(campaignId: string, reportingDate: string): Promise<GA4RevenuePublicationStatus>;
  getRevenueSource(campaignId: string, sourceId: string): Promise<RevenueSource | undefined>;
  createRevenueSource(source: InsertRevenueSource): Promise<RevenueSource>;
  updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined>;
  deleteRevenueSource(sourceId: string): Promise<boolean>;
  deleteRevenueRecordsBySource(sourceId: string): Promise<boolean>;
  deleteRevenueSourceWithRecords(campaignId: string, sourceId: string, platformContext: RevenuePlatformContext): Promise<boolean>;
  disconnectGa4HubspotRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionId: string }>;
  disconnectGa4GoogleSheetsRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionIds: string[] }>;
  disconnectGa4ShopifyRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionId: string }>;
  cleanupDisconnectedGa4ShopifyRevenue(
    requests: Array<{ campaignId: string; expectedActiveSourceIds: string[]; expectedActiveConnectionIds: string[] }>,
  ): Promise<Array<{ campaignId: string; deactivatedSourceIds: string[]; deactivatedConnectionIds: string[]; deletedRecordIds: string[]; resolvedNotificationIds: string[] }>>;
  createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]>;
  replaceRevenueSourceWithRecords(campaignId: string, existingSourceId: string | null, sourceType: string, platformContext: RevenuePlatformContext, source: InsertRevenueSource, records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>, expectedSourceMappingConfig?: string | null, options?: GA4RefreshWriteInput): Promise<RevenueSource>;
  replaceGa4SalesforceRevenueSourceWithRecords(campaignId: string, existingSourceId: string | null, connectionId: string, connectionMappingConfig: string, source: InsertRevenueSource, records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>, expectedSourceMappingConfig?: string | null, options?: GA4RefreshWriteInput & { expectedConnectionMappingConfig?: string | null }): Promise<RevenueSource>;
  replaceGa4CsvRevenueSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    source: InsertRevenueSource,
    records: Array<Omit<InsertRevenueRecord, "revenueSourceId">>,
    expectedSourceMappingConfig?: string,
  ): Promise<RevenueSource>;
  replaceGa4HubspotRevenueSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    connectionId: string,
    connectionMappingConfig: string,
    source: InsertRevenueSource,
    records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>,
    expectedSourceMappingConfig?: string | null,
    options?: GA4RefreshWriteInput & { expectedConnectionMappingConfig?: string | null },
  ): Promise<RevenueSource>;
  disableGa4CrmPipelineProxy(
    campaignId: string,
    sourceId: string,
    sourceType: "salesforce" | "hubspot",
    nextSourceMappingConfig: string,
    expectedSourceMappingConfig: string,
    connectionState?: { connectionId: string; nextMappingConfig: string; expectedMappingConfig: string | null } | null,
  ): Promise<RevenueSource>;
  replaceGa4ShopifyRevenueSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    connectionId: string,
    connectionMappingConfig: string,
    source: InsertRevenueSource,
    records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>,
    expectedState?: { sourceMappingConfig: string | null; connectionMappingConfig: string | null },
    options?: GA4RefreshWriteInput,
  ): Promise<RevenueSource>;
  updateGa4ShopifyRevenueSourceRefreshState(campaignId: string, sourceId: string, mappingConfig: string, expectedRunId?: string, options?: GA4RefreshWriteInput & { expectedSourceMappingConfig?: string | null }): Promise<RevenueSource | undefined>;
  getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: RevenuePlatformContext): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }>;
  getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: RevenuePlatformContext): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number; currency?: string }>>;

  // Google Sheets Connections
  getGoogleSheetsConnections(campaignId: string, purpose?: string, options?: GA4RefreshWriteInput & { migrateLegacyTokens?: boolean; resolveRuntimeCredentials?: boolean }): Promise<GoogleSheetsConnection[]>;
  getGoogleSheetsConnection(campaignId: string, spreadsheetId?: string): Promise<GoogleSheetsConnection | undefined>;
  getPrimaryGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined>;
  createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection>;
  updateGoogleSheetsConnection(connectionId: string, connection: Partial<InsertGoogleSheetsConnection>, options?: GA4RefreshConnectionWriteInput): Promise<GoogleSheetsConnection | undefined>;
  setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string): Promise<boolean>;
  deleteGoogleSheetsConnection(connectionId: string): Promise<boolean>;

  // HubSpot Connections
  getHubspotConnections(campaignId: string): Promise<HubspotConnection[]>;
  getHubspotConnection(campaignId: string, options?: GA4RefreshWriteInput): Promise<HubspotConnection | undefined>;
  createHubspotConnection(connection: InsertHubspotConnection): Promise<HubspotConnection>;
  updateHubspotConnection(connectionId: string, connection: Partial<InsertHubspotConnection>, options?: GA4RefreshConnectionWriteInput): Promise<HubspotConnection | undefined>;
  deleteHubspotConnection(connectionId: string): Promise<boolean>;

  // Salesforce Connections
  getSalesforceConnections(campaignId: string): Promise<SalesforceConnection[]>;
  getSalesforceConnection(campaignId: string, options?: GA4RefreshWriteInput): Promise<SalesforceConnection | undefined>;
  createSalesforceConnection(connection: InsertSalesforceConnection): Promise<SalesforceConnection>;
  updateSalesforceConnection(connectionId: string, connection: Partial<InsertSalesforceConnection>, options?: GA4RefreshConnectionWriteInput): Promise<SalesforceConnection | undefined>;
  deleteSalesforceConnection(connectionId: string): Promise<boolean>;

  // Shopify Connections
  getShopifyConnections(campaignId: string): Promise<ShopifyConnection[]>;
  getShopifyConnection(campaignId: string, options?: GA4RefreshWriteInput): Promise<ShopifyConnection | undefined>;
  createShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection>;
  replaceShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection>;
  updateShopifyConnection(connectionId: string, connection: Partial<InsertShopifyConnection>, options?: GA4RefreshConnectionWriteInput): Promise<ShopifyConnection | undefined>;
  deleteShopifyConnection(connectionId: string): Promise<boolean>;
  withShopifyOauthStoreLock<T>(shopDomain: string, operation: () => Promise<T>): Promise<T>;

  // LinkedIn Connections
  getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined>;
  createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection>;
  updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined>;
  deleteLinkedInConnection(campaignId: string): Promise<boolean>;
  deleteLinkedInCampaignAnalytics(campaignId: string): Promise<boolean>;

  // Meta Connections
  getMetaConnection(campaignId: string): Promise<MetaConnection | undefined>;
  createMetaConnection(connection: InsertMetaConnection): Promise<MetaConnection>;
  updateMetaConnection(campaignId: string, connection: Partial<InsertMetaConnection>): Promise<MetaConnection | undefined>;
  deleteMetaConnection(campaignId: string): Promise<boolean>;

  // Instagram Connections
  getInstagramConnection(campaignId: string): Promise<InstagramConnection | undefined>;
  createInstagramConnection(connection: InsertInstagramConnection): Promise<InstagramConnection>;
  updateInstagramConnection(campaignId: string, connection: Partial<InsertInstagramConnection>): Promise<InstagramConnection | undefined>;
  deleteInstagramConnection(campaignId: string): Promise<boolean>;
  deleteInstagramFinancialData(campaignId: string): Promise<boolean>;
  deleteInstagramDailyMetrics(campaignId: string): Promise<boolean>;

  // Instagram Daily Metrics
  getInstagramDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<InstagramDailyMetric[]>;
  upsertInstagramDailyMetrics(metrics: InsertInstagramDailyMetric[]): Promise<{ upserted: number }>;

  // TikTok Connections
  getTikTokConnection(campaignId: string): Promise<TikTokConnection | undefined>;
  createTikTokConnection(connection: InsertTikTokConnection): Promise<TikTokConnection>;
  updateTikTokConnection(campaignId: string, connection: Partial<InsertTikTokConnection>): Promise<TikTokConnection | undefined>;
  deleteTikTokConnection(campaignId: string): Promise<boolean>;
  deleteTikTokDailyMetrics(campaignId: string): Promise<boolean>;
  deleteTikTokFinancialData(campaignId: string): Promise<boolean>;

  // TikTok Daily Metrics
  getTikTokDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<TikTokDailyMetric[]>;
  upsertTikTokDailyMetrics(metrics: InsertTikTokDailyMetric[]): Promise<{ upserted: number }>;

  // Google Ads Connections
  getGoogleAdsConnection(campaignId: string, options?: GA4RefreshWriteInput & { migrateLegacyTokens?: boolean }): Promise<GoogleAdsConnection | undefined>;
  createGoogleAdsConnection(connection: InsertGoogleAdsConnection): Promise<GoogleAdsConnection>;
  replaceGoogleAdsConnection(connection: InsertGoogleAdsConnection, dailyMetrics?: InsertGoogleAdsDailyMetric[]): Promise<GoogleAdsConnection>;
  updateGoogleAdsConnection(campaignId: string, connection: Partial<InsertGoogleAdsConnection>, options?: GA4RefreshConnectionWriteInput): Promise<GoogleAdsConnection | undefined>;
  deleteGoogleAdsConnection(campaignId: string): Promise<boolean>;
  deleteGoogleAdsDailyMetrics(campaignId: string): Promise<boolean>;

  // Google Ads Daily Metrics
  getGoogleAdsDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GoogleAdsDailyMetric[]>;
  upsertGoogleAdsDailyMetrics(metrics: InsertGoogleAdsDailyMetric[]): Promise<{ upserted: number }>;
  replaceGoogleAdsDailyMetricsForWindow(campaignId: string, startDate: string, endDate: string, metrics: InsertGoogleAdsDailyMetric[], options?: GA4RefreshGoogleAdsWriteInput): Promise<{ replaced: number }>;
  updateGoogleAdsDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ googleCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }>;
  getGA4GoogleAdsSpendConnection(campaignId: string): Promise<GA4GoogleAdsSpendConnection | undefined>;
  replaceGA4GoogleAdsSpendConnection(connection: InsertGA4GoogleAdsSpendConnection, dailyMetrics: InsertGA4GoogleAdsSpendDailyMetric[]): Promise<GA4GoogleAdsSpendConnection>;
  updateGA4GoogleAdsSpendConnection(campaignId: string, connection: Partial<InsertGA4GoogleAdsSpendConnection>, options?: GA4RefreshConnectionWriteInput): Promise<GA4GoogleAdsSpendConnection | undefined>;
  getGA4GoogleAdsSpendDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GA4GoogleAdsSpendDailyMetric[]>;
  replaceGA4GoogleAdsSpendDailyMetricsForWindow(campaignId: string, startDate: string, endDate: string, metrics: InsertGA4GoogleAdsSpendDailyMetric[], options?: GA4RefreshGoogleAdsWriteInput): Promise<{ replaced: number }>;
  updateMetaDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ metaCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }>;
  updateLinkedInDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ linkedinCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }>;

  // Meta KPIs
  getMetaKPIs(campaignId: string): Promise<MetaKpi[]>;
  getMetaKPIById(id: string): Promise<MetaKpi | undefined>;
  createMetaKPI(kpi: InsertMetaKpi): Promise<MetaKpi>;
  updateMetaKPI(id: string, kpi: Partial<InsertMetaKpi>): Promise<MetaKpi | undefined>;
  deleteMetaKPI(id: string): Promise<boolean>;

  // Meta Benchmarks
  getMetaBenchmarks(campaignId: string): Promise<MetaBenchmark[]>;
  getMetaBenchmarkById(id: string): Promise<MetaBenchmark | undefined>;
  createMetaBenchmark(benchmark: InsertMetaBenchmark): Promise<MetaBenchmark>;
  updateMetaBenchmark(id: string, benchmark: Partial<InsertMetaBenchmark>): Promise<MetaBenchmark | undefined>;
  deleteMetaBenchmark(id: string): Promise<boolean>;

  // Meta Reports
  getMetaReports(campaignId: string): Promise<MetaReport[]>;
  getMetaReportById(id: string): Promise<MetaReport | undefined>;
  createMetaReport(report: InsertMetaReport): Promise<MetaReport>;
  updateMetaReport(id: string, report: Partial<InsertMetaReport>): Promise<MetaReport | undefined>;
  deleteMetaReport(id: string): Promise<boolean>;

  // Meta Daily Metrics
  getMetaDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<MetaDailyMetric[]>;
  createMetaDailyMetric(metric: InsertMetaDailyMetric): Promise<MetaDailyMetric>;
  upsertMetaDailyMetrics(metrics: InsertMetaDailyMetric[]): Promise<void>;

  // LinkedIn Import Sessions
  getLinkedInImportSession(sessionId: string): Promise<LinkedInImportSession | undefined>;
  getCampaignLinkedInImportSessions(campaignId: string): Promise<LinkedInImportSession[]>;
  getLatestLinkedInImportSession(campaignId: string): Promise<LinkedInImportSession | undefined>;
  createLinkedInImportSession(session: InsertLinkedInImportSession): Promise<LinkedInImportSession>;
  updateLinkedInImportSession(sessionId: string, updates: Partial<InsertLinkedInImportSession>): Promise<LinkedInImportSession | undefined>;

  // LinkedIn Import Metrics
  getLinkedInImportMetrics(sessionId: string): Promise<LinkedInImportMetric[]>;
  createLinkedInImportMetric(metric: InsertLinkedInImportMetric): Promise<LinkedInImportMetric>;

  // LinkedIn Ad Performance
  getLinkedInAdPerformance(sessionId: string): Promise<LinkedInAdPerformance[]>;
  createLinkedInAdPerformance(ad: InsertLinkedInAdPerformance): Promise<LinkedInAdPerformance>;

  // LinkedIn Reports
  getLinkedInReports(): Promise<LinkedInReport[]>;
  getLinkedInReport(id: string): Promise<LinkedInReport | undefined>;
  createLinkedInReport(report: InsertLinkedInReport): Promise<LinkedInReport>;
  updateLinkedInReport(id: string, report: Partial<InsertLinkedInReport>): Promise<LinkedInReport | undefined>;
  deleteLinkedInReport(id: string): Promise<boolean>;

  // Platform Reports
  getPlatformReports(platformType: string, campaignId?: string): Promise<LinkedInReport[]>;
  getScheduledPlatformReports(platformTypes?: string[]): Promise<LinkedInReport[]>;
  createPlatformReport(report: any): Promise<LinkedInReport>;
  createCampaignDeepDivePlatformReport(report: any, limits: CampaignDeepDiveReportLimits): Promise<CampaignDeepDiveReportWriteResult>;
  updatePlatformReport(id: string, report: any): Promise<LinkedInReport | undefined>;
  updateCampaignDeepDivePlatformReport(id: string, campaignId: string, report: any, limits: CampaignDeepDiveReportLimits): Promise<CampaignDeepDiveReportWriteResult>;
  deletePlatformReport(id: string): Promise<boolean>;

  // Custom Integrations
  getCustomIntegration(campaignId: string): Promise<CustomIntegration | undefined>;
  getCustomIntegrationById(integrationId: string): Promise<CustomIntegration | undefined>;
  getCustomIntegrationByToken(token: string): Promise<CustomIntegration | undefined>;
  getCustomIntegrationByEmail(email: string): Promise<CustomIntegration | undefined>;
  getAllCustomIntegrations(): Promise<CustomIntegration[]>;
  createCustomIntegration(integration: InsertCustomIntegration): Promise<CustomIntegration>;
  deleteCustomIntegration(campaignId: string): Promise<boolean>;

  // Custom Integration Metrics
  getCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined>;
  getAllCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics[]>;
  createCustomIntegrationMetrics(metrics: InsertCustomIntegrationMetrics, access?: { integrationId: string; webhookToken?: string; receipt?: string; senderEmail?: string; recipientEmail?: string; allowDraft?: boolean }): Promise<CustomIntegrationMetrics & { alreadyProcessed?: boolean }>;
  getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined>;
  transferCustomIntegration(fromCampaignId: string, toCampaignId: string, ownerId: string): Promise<boolean>;

  // Conversion Events
  getConversionEvents(campaignId: string, startDate?: Date, endDate?: Date): Promise<ConversionEvent[]>;
  createConversionEvent(event: InsertConversionEvent, access?: { ownerId: string; webhookToken?: string }): Promise<ConversionEvent>;
  getConversionEventTotalValue(campaignId: string, startDate?: Date, endDate?: Date): Promise<number>;
  getConversionEventCount(campaignId: string, startDate?: Date, endDate?: Date): Promise<number>;

  // KPIs
  getCampaignKPIs(campaignId: string): Promise<KPI[]>;
  getPlatformKPIs(platformType: string, campaignId?: string): Promise<KPI[]>;
  getKPI(id: string): Promise<KPI | undefined>;
  createKPI(kpi: InsertKPI): Promise<KPI>;
  updateKPI(id: string, kpi: Partial<InsertKPI> & GA4RefreshWriteInput): Promise<KPI | undefined>;
  updateCanonicalGA4KPI(id: string, kpi: Partial<InsertKPI>): Promise<KPI | undefined>;
  deleteKPI(id: string, notificationHides?: KPINotificationHide[]): Promise<boolean>;

  // KPI Progress
  getKPIProgress(kpiId: string): Promise<KPIProgress[]>;
  updateKPIProgress(id: string, progress: Partial<InsertKPIProgress> & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<KPIProgress | undefined>;
  getLatestKPIPeriod(kpiId: string): Promise<KPIPeriod | null>;
  recordKPIProgress(progress: InsertKPIProgress & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<KPIProgress>;

  // KPI Alerts
  getKPIAlerts(kpiId?: string, activeOnly?: boolean): Promise<KPIAlert[]>;
  createKPIAlert(alert: InsertKPIAlert): Promise<KPIAlert>;
  acknowledgeKPIAlert(alertId: string): Promise<boolean>;
  resolveKPIAlert(alertId: string): Promise<boolean>;
  checkKPIAlerts(kpiId: string): Promise<KPIAlert[]>;
  getKPIAnalytics(kpiId: string, timeframe?: string): Promise<{
    progress: KPIProgress[];
    rollingAverage7d: number;
    rollingAverage30d: number;
    trendAnalysis: {
      direction: string;
      percentage: number;
      period: string;
    };
  }>;

  // Benchmarks
  getCampaignBenchmarks(campaignId: string): Promise<Benchmark[]>;
  getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<Benchmark[]>;
  getBenchmark(id: string): Promise<Benchmark | undefined>;
  createBenchmark(benchmark: InsertBenchmark): Promise<Benchmark>;
  updateBenchmark(id: string, benchmark: Partial<InsertBenchmark> & GA4RefreshWriteInput): Promise<Benchmark | undefined>;
  deleteBenchmark(id: string, notificationHides?: KPINotificationHide[]): Promise<boolean>;

  // Benchmark History
  getBenchmarkHistory(benchmarkId: string): Promise<BenchmarkHistory[]>;
  recordBenchmarkHistory(history: InsertBenchmarkHistory & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<BenchmarkHistory>;

  // Metric Snapshots
  getCampaignSnapshots(campaignId: string): Promise<MetricSnapshot[]>;
  getCampaignSnapshotsByPeriod(campaignId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<MetricSnapshot[]>;
  getSnapshotByDate(campaignId: string, date: Date): Promise<MetricSnapshot | undefined>;
  createMetricSnapshot(snapshot: InsertMetricSnapshot & GA4RefreshWriteInput): Promise<MetricSnapshot>;
  upsertFinancialDailySnapshot(snapshot: FinancialDailySnapshotInput & GA4RefreshWriteInput & { revenuePublication?: GA4RevenuePublication }): Promise<MetricSnapshot>;
  upsertExecutiveSummaryDailySnapshot(snapshot: ExecutiveSummaryDailySnapshotInput & GA4RefreshWriteInput): Promise<MetricSnapshot>;
  markExecutiveSummaryDailySnapshotAligned(campaignId: string, reportingDate: string, completedAt: string, options?: GA4RefreshWriteInput): Promise<boolean>;
  invalidateExecutiveSummaryDailySnapshotAlignment(campaignId: string, reportingDate: string, options?: GA4RefreshWriteInput): Promise<void>;
  getExecutiveSummaryDailyComparisonData(campaignId: string, currentReportingDate: string, comparisonDate: string): Promise<{
    current: MetricSnapshot | null;
    previous: MetricSnapshot | null;
  }>;
  getFinancialDailyComparisonData(campaignId: string, currentReportingDate: string, comparisonDate: string): Promise<{
    current: MetricSnapshot | null;
    previous: MetricSnapshot | null;
  }>;
  getLatestFinancialDailySnapshot(campaignId: string, throughReportingDate: string): Promise<MetricSnapshot | null>;
  getComparisonData(campaignId: string, comparisonType: 'yesterday' | 'last_week' | 'last_month', reportingTimeZone?: string, comparisonDate?: string): Promise<{
    current: MetricSnapshot | null;
    previous: MetricSnapshot | null;
  }>;

  // KPI Reports
  getCampaignKPIReports(campaignId: string): Promise<any[]>;
  getKPIReport(id: string): Promise<KPIReport | undefined>;
  createKPIReport(report: InsertKPIReport): Promise<KPIReport>;
  updateKPIReport(id: string, report: Partial<InsertKPIReport>): Promise<KPIReport | undefined>;
  deleteKPIReport(id: string): Promise<boolean>;

  // Notifications
  getNotifications(): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, notification: Partial<InsertNotification>): Promise<Notification | undefined>;
  deleteNotification(id: string): Promise<boolean>;
  markAllNotificationsAsRead(): Promise<boolean>;
  getBenchmarkAnalytics(benchmarkId: string): Promise<{
    history: BenchmarkHistory[];
    averageVariance: number;
    performanceTrend: string;
    lastPerformanceRating: string;
  }>;

  // A/B Tests
  getCampaignABTests(campaignId: string): Promise<ABTest[]>;
  getABTest(testId: string): Promise<ABTest | undefined>;
  createABTest(test: InsertABTest): Promise<ABTest>;
  updateABTest(testId: string, test: Partial<InsertABTest>): Promise<ABTest | undefined>;
  deleteABTest(testId: string): Promise<boolean>;

  // A/B Test Variants
  getABTestVariants(testId: string): Promise<ABTestVariant[]>;
  createABTestVariant(variant: InsertABTestVariant): Promise<ABTestVariant>;
  updateABTestVariant(variantId: string, variant: Partial<InsertABTestVariant>): Promise<ABTestVariant | undefined>;
  deleteABTestVariant(variantId: string): Promise<boolean>;

  // A/B Test Results
  getABTestResults(testId: string): Promise<ABTestResult[]>;
  getABTestResult(testId: string, variantId: string): Promise<ABTestResult | undefined>;
  updateABTestResult(testId: string, variantId: string, result: Partial<InsertABTestResult>): Promise<ABTestResult>;

  // A/B Test Events
  recordABTestEvent(event: InsertABTestEvent): Promise<ABTestEvent>;
  getABTestEvents(testId: string, variantId?: string): Promise<ABTestEvent[]>;

  // A/B Test Analytics
  getABTestAnalytics(testId: string): Promise<{
    test: ABTest;
    variants: ABTestVariant[];
    results: ABTestResult[];
    statisticalSignificance: boolean;
    confidenceLevel: number;
    winnerVariant?: string;
  }>;

  // Attribution Models
  getAttributionModels(ownerId?: string): Promise<AttributionModel[]>;
  getAttributionModel(id: string): Promise<AttributionModel | undefined>;
  createAttributionModel(model: InsertAttributionModel, ownerId?: string): Promise<AttributionModel>;
  updateAttributionModel(id: string, model: Partial<InsertAttributionModel>): Promise<AttributionModel | undefined>;
  deleteAttributionModel(id: string): Promise<boolean>;
  setDefaultAttributionModel(id: string): Promise<boolean>;

  // Customer Journeys
  getCustomerJourneys(status?: string, ownerId?: string): Promise<CustomerJourney[]>;
  getCustomerJourney(id: string): Promise<CustomerJourney | undefined>;
  createCustomerJourney(journey: InsertCustomerJourney, ownerId?: string): Promise<CustomerJourney>;
  updateCustomerJourney(id: string, journey: Partial<InsertCustomerJourney>): Promise<CustomerJourney | undefined>;
  deleteCustomerJourney(id: string): Promise<boolean>;

  // Touchpoints
  getJourneyTouchpoints(journeyId: string): Promise<Touchpoint[]>;
  getCampaignTouchpoints(campaignId: string): Promise<Touchpoint[]>;
  createTouchpoint(touchpoint: InsertTouchpoint): Promise<Touchpoint>;
  updateTouchpoint(id: string, touchpoint: Partial<InsertTouchpoint>): Promise<Touchpoint | undefined>;
  deleteTouchpoint(id: string): Promise<boolean>;

  // Attribution Results
  getAttributionResults(journeyId?: string, modelId?: string): Promise<AttributionResult[]>;
  calculateAttributionResults(journeyId: string, modelId: string): Promise<AttributionResult[]>;
  getChannelAttributionResults(channel: string, modelId?: string): Promise<AttributionResult[]>;

  // Attribution Insights
  getAttributionInsights(modelId?: string, period?: string): Promise<AttributionInsight[]>;
  getCampaignAttributionInsights(campaignId: string, modelId?: string): Promise<AttributionInsight[]>;
  generateAttributionInsights(modelId: string, startDate: Date, endDate: Date): Promise<AttributionInsight[]>;

  // Attribution Analytics
  getAttributionComparison(journeyId: string): Promise<{
    journey: CustomerJourney;
    touchpoints: Touchpoint[];
    modelResults: { model: AttributionModel; results: AttributionResult[] }[];
  }>;

  getChannelPerformanceAttribution(startDate: Date, endDate: Date, modelId?: string, ownerId?: string): Promise<{
    channel: string;
    totalAttributedValue: number;
    totalTouchpoints: number;
    averageCredit: number;
    assistedConversions: number;
    lastClickConversions: number;
    firstClickConversions: number;
  }[]>;

  // Notifications
  getNotifications(): Promise<Notification[]>;

  // Clients
  getClients(ownerId: string): Promise<Client[]>;
  createClient(data: InsertClient): Promise<Client>;
  deleteClientCascade(ownerId: string, clientId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async withGA4PropertyRequest<T>(propertyId: string, signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (!pool || !/^\d+$/.test(propertyId)) throw new Error('GA4_PROPERTY_UNVERIFIED');
    // Transaction locks bind all updated workers and pin transaction-pooled connections.
    // Release the checkout while queued; hold the acquired slot through response-body parsing.
    while (true) {
      signal.throwIfAborted();
      const client = await pool.connect();
      const disconnected = new AbortController();
      const onError = (error: Error) => disconnected.abort(error);
      client.on('error', onError);
      let key: string | undefined;
      let destroy = false;
      try {
        signal.throwIfAborted();
        await (client as any).query({ text: 'BEGIN', query_timeout: 5000 });
        for (let slot = 0; slot < 5; slot++) {
          const candidate = `ga4_property_request:${propertyId}:${slot}`;
          const result = await (client as any).query({ text: 'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired', values: [candidate], query_timeout: 5000 });
          if (result.rows[0]?.acquired) { key = candidate; break; }
          signal.throwIfAborted();
        }
        if (key) return await operation(AbortSignal.any([signal, disconnected.signal]));
      } catch (error) {
        // A query timeout can leave an unknown lock result. Destroy the checkout.
        destroy = !key;
        throw error;
      } finally {
        if (!destroy && !disconnected.signal.aborted) {
          try {
            await (client as any).query({ text: 'ROLLBACK', query_timeout: 5000 });
          } catch { destroy = true; }
        }
        client.removeListener('error', onError);
        client.release(destroy || disconnected.signal.aborted);
      }
      await new Promise<void>((resolve, reject) => {
        signal.throwIfAborted();
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 50);
        signal.addEventListener('abort', abort, { once: true });
      });
    }
  }
  async assertServiceAccountResourceAccess(campaignId: string, provider: "ga4" | "google_sheets" | "google_ads", resourceId: string): Promise<void> {
    const [campaign] = await db.select({ ownerId: campaigns.ownerId, clientId: campaigns.clientId, status: campaigns.status })
      .from(campaigns).innerJoin(clients, and(eq(clients.id, campaigns.clientId), eq(clients.ownerId, campaigns.ownerId))).where(eq(campaigns.id, campaignId));
    let grants: unknown;
    try { grants = JSON.parse(process.env.SERVICE_ACCOUNT_RESOURCE_GRANTS || "[]"); } catch { grants = []; }
    if (campaign?.ownerId && campaign.clientId && campaign.status !== "deleted" && resourceId) {
      if (Array.isArray(grants) && grants.some(grant =>
        grant?.ownerId === campaign.ownerId && grant?.clientId === campaign.clientId &&
        grant?.provider === provider && grant?.resourceId === resourceId)) return;
      const [grant] = await db.select({ id: serviceAccountResourceGrants.id }).from(serviceAccountResourceGrants).where(and(
        eq(serviceAccountResourceGrants.ownerId, campaign.ownerId), eq(serviceAccountResourceGrants.clientId, campaign.clientId),
        eq(serviceAccountResourceGrants.provider, provider), eq(serviceAccountResourceGrants.resourceId, resourceId),
      )).limit(1);
      if (grant) return;
    }
    throw Object.assign(new Error("This provider resource is not approved for this customer"), { code: "SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED" });
  }

  // Campaign methods
  async getCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(campaigns.createdAt);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(insertCampaign: InsertCampaign, requestId?: string): Promise<Campaign> {
    return db.transaction(async (tx: any) => {
      if (insertCampaign.clientId) {
        const [client] = await tx.select({ id: clients.id }).from(clients).where(and(
          eq(clients.id, insertCampaign.clientId), eq(clients.ownerId, String(insertCampaign.ownerId || '')),
        )).for('key share');
        if (!client) throw new Error('CAMPAIGN_CLIENT_NOT_FOUND');
      }
      if (requestId && (insertCampaign.status !== 'draft' || !insertCampaign.ownerId || !insertCampaign.clientId)) {
        throw new Error('CAMPAIGN_DRAFT_REQUEST_INVALID');
      }
      if (requestId) {
        const scope = and(eq(campaignCreationRequests.ownerId, insertCampaign.ownerId!), eq(campaignCreationRequests.clientId, insertCampaign.clientId!), eq(campaignCreationRequests.requestId, requestId));
        await tx.insert(campaignCreationRequests).values({ ownerId: insertCampaign.ownerId, clientId: insertCampaign.clientId, requestId }).onConflictDoNothing();
        const [request] = await tx.select().from(campaignCreationRequests).where(scope).for('update');
        if (request.cancelled) throw new Error('CAMPAIGN_DRAFT_CANCELLED');
        if (request.created) {
          const [existing] = await tx.select().from(campaigns).where(eq(campaigns.id, requestId));
          if (!existing || existing.ownerId !== insertCampaign.ownerId || existing.clientId !== insertCampaign.clientId) throw new Error('CAMPAIGN_DRAFT_REQUEST_RETIRED');
          Object.defineProperty(existing, '__creationReplay', { value: true, enumerable: false });
          return existing;
        }
        await tx.update(campaignCreationRequests).set({ created: true }).where(scope);
      }
      const [campaign] = await tx.insert(campaigns)
        .values({ ...insertCampaign, ...(requestId ? { id: requestId } : {}) })
        .onConflictDoNothing({ target: campaigns.id }).returning();
      if (campaign) return campaign;
      const [existing] = await tx.select().from(campaigns).where(eq(campaigns.id, String(requestId)));
      if (!existing || existing.ownerId !== insertCampaign.ownerId || existing.clientId !== insertCampaign.clientId) {
        throw new Error('CAMPAIGN_DRAFT_REQUEST_CONFLICT');
      }
      Object.defineProperty(existing, '__creationReplay', { value: true, enumerable: false });
      return existing;
    });
  }

  async updateCampaign(id: string, updateData: Partial<InsertCampaign>, options: GA4RefreshWriteInput = {}): Promise<Campaign | undefined> {
    const write = async (db: any) => {
    if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(db, id, options);
    const previous = updateData.currency !== undefined
      ? (await db.select({ currency: campaigns.currency }).from(campaigns).where(eq(campaigns.id, id)))[0] : undefined;
    const [campaign] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();
    if (previous && campaign && String(previous.currency || 'USD').trim().toUpperCase() !== String(campaign.currency || 'USD').trim().toUpperCase()) {
      await db.delete(ga4DailyMetrics).where(eq(ga4DailyMetrics.campaignId, id));
      await db.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, id));
    }
    return campaign || undefined;
    };
    if ("refreshScope" in options && options.refreshScope?.campaignId !== id) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    return "refreshScope" in options ? this.writeWithGA4RefreshOwnership(options.refreshScope, write) : this.writeGA4RefreshInputChange(id, write).catch(error => {
      if (error?.message === "GA4_REFRESH_TARGET_SCOPE_CHANGED") return undefined;
      throw error;
    });
  }

  async updateCampaignWithGA4DailyInvalidation(id: string, updateData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    return this.writeGA4RefreshInputChange(id, async (tx: any) => {
      const [campaign] = await tx
        .update(campaigns)
        .set(updateData)
        .where(eq(campaigns.id, id))
        .returning();
      if (!campaign) return undefined;
      await tx.delete(ga4DailyMetrics).where(eq(ga4DailyMetrics.campaignId, id));
      await tx.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, id));
      return campaign;
    }).catch(error => {
      if (error?.message === "GA4_REFRESH_TARGET_SCOPE_CHANGED") return undefined;
      throw error;
    });
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id));
    return (result.rowCount || 0) > 0;
  }

  private async deleteCampaignChildren(campaignId: string, tx: any = db): Promise<void> {
    const kpiRows = await tx.select({ id: kpis.id }).from(kpis).where(eq(kpis.campaignId, campaignId));
    const kpiIds = kpiRows.map((row: any) => String(row.id));
    if (kpiIds.length > 0) {
      await tx.delete(kpiProgress).where(inArray(kpiProgress.kpiId, kpiIds));
      await tx.delete(kpiAlerts).where(inArray(kpiAlerts.kpiId, kpiIds));
      await tx.delete(kpiPeriods).where(inArray(kpiPeriods.kpiId, kpiIds));
    }

    const benchmarkRows = await tx.select({ id: benchmarks.id }).from(benchmarks).where(eq(benchmarks.campaignId, campaignId));
    const benchmarkIds = benchmarkRows.map((row: any) => String(row.id));
    if (benchmarkIds.length > 0) {
      await tx.delete(benchmarkHistory).where(inArray(benchmarkHistory.benchmarkId, benchmarkIds));
    }

    const linkedInSessionRows = await tx.select({ id: linkedinImportSessions.id }).from(linkedinImportSessions).where(eq(linkedinImportSessions.campaignId, campaignId));
    const linkedInSessionIds = linkedInSessionRows.map((row: any) => String(row.id));
    if (linkedInSessionIds.length > 0) {
      await tx.delete(linkedinImportMetrics).where(inArray(linkedinImportMetrics.sessionId, linkedInSessionIds));
      await tx.delete(linkedinAdPerformance).where(inArray(linkedinAdPerformance.sessionId, linkedInSessionIds));
    }

    const linkedInReportRows = await tx.select({ id: linkedinReports.id }).from(linkedinReports).where(eq(linkedinReports.campaignId, campaignId));
    const kpiReportRows = await tx.select({ id: kpiReports.id }).from(kpiReports).where(eq(kpiReports.campaignId, campaignId));
    const reportIds = [...linkedInReportRows, ...kpiReportRows].map((row: any) => String(row.id));
    if (reportIds.length > 0) {
      await tx.delete(reportSendEvents).where(inArray(reportSendEvents.reportId, reportIds));
      await tx.delete(reportSnapshots).where(inArray(reportSnapshots.reportId, reportIds));
    }
    await tx.execute(sql`
      DELETE FROM report_send_events
      WHERE report_id IN (SELECT report_id FROM report_snapshots WHERE campaign_id = ${campaignId})
        AND NOT EXISTS (
          SELECT 1 FROM linkedin_reports
          WHERE linkedin_reports.id = report_send_events.report_id
            AND COALESCE(linkedin_reports.campaign_id, '') <> ${campaignId}
        )
        AND NOT EXISTS (
          SELECT 1 FROM kpi_reports
          WHERE kpi_reports.id = report_send_events.report_id
            AND kpi_reports.campaign_id <> ${campaignId}
        )
    `);

    const abTestRows = await tx.select({ id: abTests.id }).from(abTests).where(eq(abTests.campaignId, campaignId));
    const abTestIds = abTestRows.map((row: any) => String(row.id));
    if (abTestIds.length > 0) {
      await tx.delete(abTestEvents).where(inArray(abTestEvents.testId, abTestIds));
      await tx.delete(abTestResults).where(inArray(abTestResults.testId, abTestIds));
      await tx.delete(abTestVariants).where(inArray(abTestVariants.testId, abTestIds));
    }

    const deleteOptionalCampaignTable = async (tableName: string): Promise<void> => {
      const exists = await tx.execute(sql`SELECT to_regclass(${tableName}) AS table_name`);
      if (exists.rows?.[0]?.table_name) {
        await tx.execute(sql`DELETE FROM ${sql.raw(tableName)} WHERE campaign_id = ${campaignId}`);
      }
    };

    await deleteOptionalCampaignTable("ga4_refresh_work");
    await tx.delete(spendRecords).where(eq(spendRecords.campaignId, campaignId));
    await tx.delete(revenueRecords).where(eq(revenueRecords.campaignId, campaignId));
    await tx.delete(spendSources).where(eq(spendSources.campaignId, campaignId));
    await tx.delete(revenueSources).where(eq(revenueSources.campaignId, campaignId));
    await tx.delete(ga4DailyMetrics).where(eq(ga4DailyMetrics.campaignId, campaignId));
    await tx.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, campaignId));
    await tx.delete(linkedinDailyMetrics).where(eq(linkedinDailyMetrics.campaignId, campaignId));
    await tx.delete(metaDailyMetrics).where(eq(metaDailyMetrics.campaignId, campaignId));
    await tx.delete(instagramDailyMetrics).where(eq(instagramDailyMetrics.campaignId, campaignId));
    await tx.delete(tiktokDailyMetrics).where(eq(tiktokDailyMetrics.campaignId, campaignId));
    await tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, campaignId));
    await deleteOptionalCampaignTable("ga4_google_ads_spend_daily_metrics");
    await tx.delete(ga4Connections).where(eq(ga4Connections.campaignId, campaignId));
    await tx.delete(googleSheetsConnections).where(eq(googleSheetsConnections.campaignId, campaignId));
    await tx.delete(hubspotConnections).where(eq(hubspotConnections.campaignId, campaignId));
    await tx.delete(salesforceConnections).where(eq(salesforceConnections.campaignId, campaignId));
    await tx.delete(shopifyConnections).where(eq(shopifyConnections.campaignId, campaignId));
    await tx.delete(linkedinConnections).where(eq(linkedinConnections.campaignId, campaignId));
    await tx.delete(metaConnections).where(eq(metaConnections.campaignId, campaignId));
    await tx.delete(instagramConnections).where(eq(instagramConnections.campaignId, campaignId));
    await tx.delete(tiktokConnections).where(eq(tiktokConnections.campaignId, campaignId));
    await tx.delete(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId));
    await deleteOptionalCampaignTable("ga4_google_ads_spend_connections");
    await deleteOptionalCampaignTable("meta_kpis");
    await deleteOptionalCampaignTable("meta_benchmarks");
    await deleteOptionalCampaignTable("meta_reports");
    await tx.delete(linkedinImportSessions).where(eq(linkedinImportSessions.campaignId, campaignId));
    await tx.delete(linkedinReports).where(eq(linkedinReports.campaignId, campaignId));
    await tx.delete(reportSnapshots).where(eq(reportSnapshots.campaignId, campaignId));
    await tx.delete(customIntegrationMetrics).where(eq(customIntegrationMetrics.campaignId, campaignId));
    await tx.delete(customIntegrations).where(eq(customIntegrations.campaignId, campaignId));
    await tx.delete(conversionEvents).where(eq(conversionEvents.campaignId, campaignId));
    await tx.delete(kpis).where(eq(kpis.campaignId, campaignId));
    await tx.delete(kpiReports).where(eq(kpiReports.campaignId, campaignId));
    await tx.delete(benchmarks).where(eq(benchmarks.campaignId, campaignId));
    await tx.delete(metricSnapshots).where(eq(metricSnapshots.campaignId, campaignId));
    await tx.delete(abTests).where(eq(abTests.campaignId, campaignId));
    await tx.update(notifications)
      .set({
        read: true,
        metadata: sql`(COALESCE(NULLIF(${notifications.metadata}, '')::jsonb, '{}'::jsonb) || jsonb_build_object('dismissedAt', NOW(), 'dismissedBy', 'system', 'dismissalReason', 'campaign_deleted'))::text`,
      })
      .where(eq(notifications.campaignId, campaignId));
    await tx.delete(emailAlertEvents).where(eq(emailAlertEvents.campaignId, campaignId));
    await tx.delete(touchpoints).where(eq(touchpoints.campaignId, campaignId));
    await tx.delete(attributionResults).where(eq(attributionResults.campaignId, campaignId));
    await tx.delete(attributionInsights).where(eq(attributionInsights.campaignId, campaignId));
  }

  async deleteCampaignCascade(id: string, options?: { expectedDraftOwnerId: string }): Promise<boolean> {
    return db.transaction(async (tx: any) => {
      const [existing] = await tx.select({ id: campaigns.id, status: campaigns.status, ownerId: campaigns.ownerId })
        .from(campaigns).where(eq(campaigns.id, id)).for("update");
      if (!existing) return false;
      if (options) {
        if (!options.expectedDraftOwnerId?.trim() || existing.ownerId !== options.expectedDraftOwnerId) return false;
        if (String(existing.status || "").trim().toLowerCase() !== "draft") throw new Error("CAMPAIGN_NO_LONGER_DRAFT");
        const workTable = await tx.execute(sql`SELECT to_regclass('ga4_refresh_work') AS name`);
        if (workTable.rows[0]?.name) {
          const [accepted] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork)
            .where(and(eq(ga4RefreshWork.campaignId, id), sql`${ga4RefreshWork.scope}->>'kind' = 'initial_import'`)).limit(1);
          if (accepted) throw new Error("CAMPAIGN_NO_LONGER_DRAFT");
        }
      }
      await this.deleteCampaignChildren(id, tx);
      const deleted = await tx.delete(campaigns).where(eq(campaigns.id, id));
      return (deleted.rowCount || 0) > 0;
    });
  }

  async cancelCampaignCreation(ownerId: string, clientId: string, requestId: string): Promise<boolean> {
    return db.transaction(async (tx: any) => {
      const [client] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).for('key share');
      if (!client) return false;
      const scope = and(eq(campaignCreationRequests.ownerId, ownerId), eq(campaignCreationRequests.clientId, clientId), eq(campaignCreationRequests.requestId, requestId));
      await tx.insert(campaignCreationRequests).values({ ownerId, clientId, requestId }).onConflictDoNothing();
      await tx.select({ id: campaignCreationRequests.id }).from(campaignCreationRequests).where(scope).for('update');
      const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, requestId)).for('update');
      if (campaign) {
        if (campaign.ownerId !== ownerId || campaign.clientId !== clientId) return false;
        if (campaign.status !== 'draft') throw new Error('CAMPAIGN_NO_LONGER_DRAFT');
        const [accepted] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork)
          .where(and(eq(ga4RefreshWork.campaignId, requestId), sql`${ga4RefreshWork.scope}->>'kind' = 'initial_import'`)).limit(1);
        if (accepted) throw new Error('CAMPAIGN_NO_LONGER_DRAFT');
        await this.deleteCampaignChildren(requestId, tx);
        await tx.delete(campaigns).where(eq(campaigns.id, requestId));
      }
      await tx.update(campaignCreationRequests).set({ cancelled: true }).where(scope);
      return true;
    });
  }

  // Metrics methods
  async getMetrics(ownerId?: string): Promise<Metric[]> {
    return db.select().from(metrics).where(ownerId === undefined ? undefined : eq(metrics.ownerId, ownerId)).orderBy(metrics.date);
  }

  async createMetric(insertMetric: InsertMetric, ownerId?: string): Promise<Metric> {
    const [metric] = await db
      .insert(metrics)
      .values({ ...insertMetric, ownerId: ownerId || null })
      .returning();
    return metric;
  }

  // Integration methods
  async getIntegrations(ownerId?: string): Promise<Integration[]> {
    const rows = await db.select().from(integrations).where(ownerId === undefined ? undefined : eq(integrations.ownerId, ownerId)).orderBy(integrations.createdAt);
    return rows.map((row: Integration) => ({ ...row, credentials: null }));
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration || undefined;
  }

  async createIntegration(insertIntegration: InsertIntegration, ownerId?: string): Promise<Integration> {
    const [integration] = await db
      .insert(integrations)
      .values({ ...insertIntegration, ownerId: ownerId || null, connected: false,
        credentials: insertIntegration.credentials ? JSON.stringify(encryptString(insertIntegration.credentials)) : null })
      .returning();
    return { ...integration, credentials: null };
  }

  async updateIntegration(id: string, updateData: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const [integration] = await db
      .update(integrations)
      .set({ ...updateData, lastSync: new Date() })
      .where(eq(integrations.id, id))
      .returning();
    return integration || undefined;
  }

  // Performance Data methods
  async getPerformanceData(ownerId?: string): Promise<PerformanceData[]> {
    return db.select().from(performanceData).where(ownerId === undefined ? undefined : eq(performanceData.ownerId, ownerId));
  }

  async createPerformanceData(insertData: InsertPerformanceData, ownerId?: string): Promise<PerformanceData> {
    const [data] = await db
      .insert(performanceData)
      .values({ ...insertData, ownerId: ownerId || null })
      .returning();
    return data;
  }

  // GA4 Connection methods
  async transferCampaignConnection(fromCampaignId: string, toCampaignId: string, ownerId: string, platform: "ga4" | "google_sheets" | "linkedin" | "meta"): Promise<{ connectionId: string } | undefined> {
    const conflict = (message: string): never => { throw Object.assign(new Error(message), { code: "CONNECTION_TRANSFER_CONFLICT" }); };
    if (!fromCampaignId || !toCampaignId || fromCampaignId === toCampaignId || !ownerId) conflict("Distinct owned campaigns required");
    const table = { ga4: ga4Connections, google_sheets: googleSheetsConnections, linkedin: linkedinConnections, meta: metaConnections }[platform];
    if (!table) conflict("Unsupported connection transfer");
    return this.writeGA4RefreshInputChange([fromCampaignId, toCampaignId], async (tx: any) => {
      const parents = await tx.select().from(campaigns).where(inArray(campaigns.id, [fromCampaignId, toCampaignId]));
      if (parents.length !== 2 || parents.some((parent: any) => parent.ownerId !== ownerId || parent.status !== "draft")) conflict("Connection transfers require two owned draft campaigns");
      const from = parents.find((parent: any) => parent.id === fromCampaignId), to = parents.find((parent: any) => parent.id === toCampaignId);
      if (!from.clientId || from.clientId !== to.clientId) conflict("Connection transfers must stay within the same client");
      const [client] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, from.clientId), eq(clients.ownerId, ownerId)));
      if (!client) conflict("Client unavailable");
      if (["currency", "reportingTimeZone", "startDate", "endDate", "ga4CampaignFilter", "conversionValue", "platform"]
        .some(key => String(from[key] ?? "") !== String(to[key] ?? ""))) conflict("Campaign currency, dates and source scope must match before transfer");
      if (parents.some((parent: any) => Number(parent.spend) !== 0 || parent.impressions !== 0 || parent.clicks !== 0)) conflict("Campaign already has analytics; reconnect through its source setup instead");
      const connections: any[] = await tx.select().from(table).where(inArray(table.campaignId, [fromCampaignId, toCampaignId])).orderBy(table.id).for("update");
      if (connections.some(row => row.campaignId === toCampaignId)) conflict("Destination already has a connection");
      const source = connections.filter(row => row.campaignId === fromCampaignId);
      const active = source.filter(row => row.isActive !== false);
      if (!active.length) return undefined;
      if ((["linkedin", "meta"].includes(platform) && source.length !== 1) || active.filter(row => row.isPrimary).length > 1) conflict("Ambiguous source connections");
      // These retained endpoints move setup, not live analytics or financial sources.
      for (const dependent of [ga4DailyMetrics, ga4OverviewSnapshots, ga4RefreshWork, metricSnapshots,
        revenueSources, revenueRecords, spendSources, spendRecords, kpis, metaKpis, benchmarks, metaBenchmarks,
        linkedinReports, metaReports, kpiReports, reportSnapshots, notifications, conversionEvents, inboundWebhookReceipts,
        linkedinDailyMetrics, metaDailyMetrics, googleAdsDailyMetrics, ga4GoogleAdsSpendDailyMetrics,
        instagramDailyMetrics, tiktokDailyMetrics, customIntegrationMetrics, abTests, touchpoints, attributionResults, attributionInsights]) {
        const [existing] = await tx.select({ id: dependent.id }).from(dependent).where(inArray(dependent.campaignId, [fromCampaignId, toCampaignId])).limit(1);
        if (existing) conflict("Campaign has dependent data or work; reconnect through its source setup instead");
      }
      const sessions = await tx.select().from(linkedinImportSessions).where(inArray(linkedinImportSessions.campaignId, [fromCampaignId, toCampaignId])).for("update");
      if (sessions.some((session: any) => platform !== "linkedin" || session.campaignId === toCampaignId || session.adAccountId !== source[0].adAccountId)) conflict("Campaign has incompatible import sessions");
      if (platform === "linkedin") await tx.update(linkedinImportSessions).set({ campaignId: toCampaignId }).where(eq(linkedinImportSessions.campaignId, fromCampaignId));
      // Move original rows: retain every selected property/tab, credential, mapping, cache and timestamp.
      const moved = await tx.update(table).set({ campaignId: toCampaignId }).where(and(eq(table.campaignId, fromCampaignId), inArray(table.id, source.map(row => row.id)))).returning({ id: table.id });
      if (moved.length !== source.length) conflict("Connection changed during transfer");
      if (platform === "ga4") await tx.insert(ga4ConnectionLifecycleEvents).values(source.map(row => ({ connectionId: row.id, subjectCampaignId: fromCampaignId, propertyId: row.propertyId, action: "transfer", actor: "application", reason: `Transferred to campaign ${toCampaignId}` })));
      return { connectionId: (active.find(row => row.isPrimary) || active[0]).id };
    }, 5_000);
  }

  async getGA4Connections(campaignId: string, options?: { migrateLegacyTokens?: boolean; resolveRuntimeCredentials?: boolean }): Promise<GA4Connection[]> {
    const rows = await db
      .select()
      .from(ga4Connections)
      .where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)))
      .orderBy(ga4Connections.connectedAt);
    // Lazy backfill: encrypt legacy plaintext tokens.
    if (options?.migrateLegacyTokens !== false) await Promise.all(
      rows.map(async (r: any) => {
        const hasPlain = Boolean(r?.accessToken) || Boolean(r?.refreshToken) || Boolean(r?.clientSecret);
        const hasEnc = Boolean(r?.encryptedTokens);
        if (!hasPlain || hasEnc || !r?.id) return;
        try {
          const nextEnc = buildEncryptedTokens({
            accessToken: r.accessToken,
            refreshToken: r.refreshToken,
            clientSecret: r.clientSecret,
          });
          await db
            .update(ga4Connections)
            .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
            .where(and(eq(ga4Connections.id, String(r.id)), isNull(ga4Connections.encryptedTokens),
              sql`${ga4Connections.accessToken} IS NOT DISTINCT FROM ${r.accessToken}`,
              sql`${ga4Connections.refreshToken} IS NOT DISTINCT FROM ${r.refreshToken}`,
              sql`${ga4Connections.clientSecret} IS NOT DISTINCT FROM ${r.clientSecret}`));
        } catch {
          // ignore
        }
      })
    );

    const hydrated = rows.map((r: any) => hydrateDecryptedTokens(r)) as any[];
    return (options?.resolveRuntimeCredentials === false
      ? hydrated
      : await Promise.all(hydrated.map((connection) => hydrateGA4ServiceAccountConnection(connection)))) as any;
  }

  async getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined> {
    if (propertyId) {
      const [connection] = await db.select().from(ga4Connections)
        .where(and(
          eq(ga4Connections.campaignId, campaignId),
          eq(ga4Connections.propertyId, propertyId),
          eq(ga4Connections.isActive, true)
        ));
      return connection ? (await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(connection) as any) as any) : undefined;
    }

    // Return the primary connection if no propertyId specified
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));

    if (primary) return await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(primary) as any) as any;

    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first ? (await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(first) as any) as any) : undefined;
  }

  async getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));

    if (primary) return await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(primary) as any) as any;

    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first ? (await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(first) as any) as any) : undefined;
  }

  async stageGA4OAuthConnection(connection: InsertGA4Connection): Promise<GA4Connection> {
    if (!connection.accessToken || !connection.refreshToken) throw new Error('GA4_OAUTH_CREDENTIALS_REQUIRED');
    return this.withGA4RefreshTransaction(async tx => {
      const [campaign] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, connection.campaignId)).for('update');
      if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
      // Replace only abandoned pending authorizations; active source facts/configuration stay intact.
      await tx.delete(ga4Connections).where(and(eq(ga4Connections.campaignId, connection.campaignId),
        eq(ga4Connections.isActive, false), eq(ga4Connections.propertyId, ''), eq(ga4Connections.propertyName, 'Pending OAuth')));
      const [saved] = await tx.insert(ga4Connections).values({ ...connection,
        propertyId: '', propertyName: 'Pending OAuth', method: 'access_token', isPrimary: false, isActive: false,
        encryptedTokens: buildEncryptedTokens({ accessToken: connection.accessToken, refreshToken: connection.refreshToken, clientSecret: connection.clientSecret }),
        accessToken: null, refreshToken: null, clientSecret: null,
      }).returning();
      return hydrateDecryptedTokens(saved) as GA4Connection;
    });
  }

  async getPendingGA4OAuthConnection(campaignId: string, connectionId?: string): Promise<GA4Connection | undefined> {
    const [pending] = await db.select().from(ga4Connections).where(and(
      eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, false),
      eq(ga4Connections.propertyId, ''), eq(ga4Connections.propertyName, 'Pending OAuth'),
      connectionId ? eq(ga4Connections.id, connectionId) : undefined,
      sql`${ga4Connections.connectedAt} > CURRENT_TIMESTAMP - INTERVAL '30 minutes'`,
    )).orderBy(desc(ga4Connections.connectedAt)).limit(1);
    return pending ? hydrateDecryptedTokens(pending) as GA4Connection : undefined;
  }

  async cancelGA4OAuthConnection(campaignId: string, connectionId: string): Promise<boolean> {
    const removed = await db.delete(ga4Connections).where(and(eq(ga4Connections.campaignId, campaignId),
      eq(ga4Connections.id, connectionId), eq(ga4Connections.isActive, false), eq(ga4Connections.propertyId, ''),
      eq(ga4Connections.propertyName, 'Pending OAuth'))).returning({ id: ga4Connections.id });
    return removed.length === 1;
  }

  async commitGA4OAuthConnection(campaignId: string, connectionId: string, propertyId: string, propertyName: string, importStartDate: string): Promise<GA4Connection> {
    return this.writeGA4RefreshInputChange(campaignId, async tx => {
      const [pending] = await tx.select().from(ga4Connections).where(and(eq(ga4Connections.id, connectionId),
        eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, false), eq(ga4Connections.propertyId, ''),
        eq(ga4Connections.propertyName, 'Pending OAuth'), sql`${ga4Connections.connectedAt} > CURRENT_TIMESTAMP - INTERVAL '30 minutes'`,
      )).for('update');
      if (!pending) throw new Error('GA4_OAUTH_PENDING_EXPIRED');
      const active = await tx.select().from(ga4Connections).where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true))).for('update');
      const existing = active.find((row: any) => row.propertyId === propertyId) || active.find((row: any) => row.isPrimary) || active[0];
      const sameProperty = existing?.propertyId === propertyId;
      const [saved] = await tx.update(ga4Connections).set({
        propertyId, propertyName, method: 'access_token', isActive: true, isPrimary: true,
        encryptedTokens: pending.encryptedTokens, accessToken: null, refreshToken: null, clientSecret: null,
        clientId: pending.clientId, expiresAt: pending.expiresAt, lookbackDays: 30,
        importStartDate: sameProperty ? existing.importStartDate || GA4_OVERVIEW_LEGACY_IMPORT_START_DATE : importStartDate,
      }).where(eq(ga4Connections.id, existing?.id || pending.id)).returning();
      await tx.update(ga4Connections).set({ isPrimary: false }).where(and(eq(ga4Connections.campaignId, campaignId), sql`${ga4Connections.id} <> ${saved.id}`));
      if (existing) await tx.delete(ga4Connections).where(eq(ga4Connections.id, pending.id));
      if (existing && !sameProperty) await tx.delete(ga4OverviewSnapshots).where(and(eq(ga4OverviewSnapshots.campaignId, campaignId), eq(ga4OverviewSnapshots.propertyId, existing.propertyId)));
      return hydrateDecryptedTokens(saved) as GA4Connection;
    });
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    if (String(connection.method || "").trim().toLowerCase() === GA4_SERVICE_ACCOUNT_METHOD) {
      assertGA4ServiceAccountPropertyAllowed(connection.propertyId);
      await this.assertServiceAccountResourceAccess(connection.campaignId, "ga4", connection.propertyId);
    }
    // Check if this is the first connection for this campaign
    const existingConnections = await this.getGA4Connections(connection.campaignId, { resolveRuntimeCredentials: false });
    const isFirstConnection = existingConnections.length === 0;

    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });

    const connectionData: any = {
      ...connection,
      // Never store plaintext tokens/secrets at rest.
      accessToken: null,
      refreshToken: null,
      clientSecret: null,
      encryptedTokens: enc,
      isPrimary: connection.isPrimary !== undefined ? connection.isPrimary : isFirstConnection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      displayName: connection.displayName || connection.propertyName || null,
    };

    const ga4Connection = await this.writeGA4RefreshInputChange(connection.campaignId, async tx => {
    const [saved] = await tx
      .insert(ga4Connections)
      .values(connectionData)
      .returning();
    return saved;
    });
    return await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(ga4Connection) as any) as any;
  }

  async updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const [target] = await db.select({ campaignId: ga4Connections.campaignId }).from(ga4Connections).where(eq(ga4Connections.id, connectionId));
    if (!target) return undefined;
    const saved = await this.writeGA4RefreshInputChange(target.campaignId, async db => {
    const [existing] = await db.select().from(ga4Connections).where(and(eq(ga4Connections.id, connectionId), eq(ga4Connections.campaignId, target.campaignId))).for("update");
    if (!existing) return undefined;
    const nextMethod = String(connection.method ?? existing.method ?? "").trim().toLowerCase();
    if (nextMethod === GA4_SERVICE_ACCOUNT_METHOD) {
      assertGA4ServiceAccountPropertyAllowed(connection.propertyId ?? existing.propertyId);
      await this.assertServiceAccountResourceAccess(existing.campaignId, "ga4", connection.propertyId ?? existing.propertyId);
    }

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
      Object.prototype.hasOwnProperty.call(connection, "clientSecret");

    const setObj: any = { ...connection };

    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens,
      });
      // Clear plaintext if we are maintaining encrypted tokens.
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }

    const [updated] = await db
      .update(ga4Connections)
      .set(setObj)
      .where(eq(ga4Connections.id, connectionId))
      .returning();
    const invalidatesOverviewSnapshot = ['propertyId', 'importStartDate', 'isActive'].some((key) =>
      Object.prototype.hasOwnProperty.call(connection, key) && String((connection as any)[key] ?? '') !== String((existing as any)[key] ?? '')
    );
    if (updated && invalidatesOverviewSnapshot) {
      await db.delete(ga4OverviewSnapshots).where(and(
        eq(ga4OverviewSnapshots.campaignId, String((existing as any).campaignId)),
        eq(ga4OverviewSnapshots.propertyId, String((existing as any).propertyId)),
      ));
    }
    return updated;
    });
    return saved ? await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(saved) as any) as any : undefined;
  }

  async updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }, options: GA4RefreshConnectionWriteInput = {}): Promise<GA4Connection | undefined> {
    const guarded = "refreshScope" in options || "publicationVersion" in options;
    const write = async (db: any) => {
    const query = db.select().from(ga4Connections).where(eq(ga4Connections.id, connectionId));
    const [existing] = await (guarded ? query.for("update") : query);
    if (guarded && (!existing || existing.isActive === false || existing.campaignId !== (options.refreshScope?.campaignId ?? options.publicationVersion?.campaignId))) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    if (!existing) return undefined;
    if ("publicationVersion" in options) {
      const expected = options.expectedConnection;
      const current = hydrateDecryptedTokens(existing) as any;
      if (!expected || ["id", "campaignId", "propertyId", "method", "clientId", "accessToken", "refreshToken", "clientSecret"]
        .some(field => (current[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }

    const nextEnc = buildEncryptedTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      clientSecret: undefined, // preserve
      prev: (existing as any).encryptedTokens || (guarded ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
    });

    const [updated] = await db
      .update(ga4Connections)
      .set({
        encryptedTokens: nextEnc,
        accessToken: null,
        refreshToken: null,
        // keep clientSecret plaintext null once encryptedTokens is in use
        clientSecret: null as any,
        expiresAt: tokens.expiresAt,
      } as any)
      .where(eq(ga4Connections.id, connectionId))
      .returning();
    return updated;
    };
    const [target] = guarded ? [] : await db.select({ campaignId: ga4Connections.campaignId }).from(ga4Connections).where(eq(ga4Connections.id, connectionId));
    const saved = guarded ? await this.writeGA4DerivedChange(options.refreshScope?.campaignId ?? options.publicationVersion?.campaignId, options, write)
      : target ? await this.writeGA4RefreshInputChange(target.campaignId, write) : undefined;
    return saved ? await hydrateGA4ServiceAccountConnection(hydrateDecryptedTokens(saved) as any) as any : undefined;
  }

  async setPrimaryGA4Connection(campaignId: string, connectionId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    const [targetConnection] = await db
      .select()
      .from(ga4Connections)
      .where(and(
        eq(ga4Connections.id, connectionId),
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ));
    if (!targetConnection) return false;

    // First, set all connections for this campaign to non-primary
    await db
      .update(ga4Connections)
      .set({ isPrimary: false })
      .where(eq(ga4Connections.campaignId, campaignId));

    // Then set the specified connection as primary
    const [updated] = await db
      .update(ga4Connections)
      .set({ isPrimary: true })
      .where(and(
        eq(ga4Connections.id, connectionId),
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .returning();

    return !!updated;
    });
  }

  async deleteGA4Connection(connectionId: string): Promise<boolean> {
    const [target] = await db.select({ campaignId: ga4Connections.campaignId }).from(ga4Connections).where(eq(ga4Connections.id, connectionId));
    if (!target) return false;
    return this.writeGA4RefreshInputChange(target.campaignId, async (tx: any) => {
      const [connection] = await tx.select().from(ga4Connections).where(and(eq(ga4Connections.id, connectionId), eq(ga4Connections.campaignId, target.campaignId)));
      if (!connection) return false;
      await tx.delete(ga4OverviewSnapshots).where(and(
        eq(ga4OverviewSnapshots.campaignId, String(connection.campaignId)),
        eq(ga4OverviewSnapshots.propertyId, String(connection.propertyId)),
      ));
      const result = await tx.delete(ga4Connections).where(eq(ga4Connections.id, connectionId));
      return (result.rowCount || 0) > 0;
    });
  }

  // All work transitions lock the campaign first, serializing competing slots and workers.
  // This foundation is not invoked by the scheduler until publication fencing is integrated.
  private async withGA4RefreshTransaction<T>(write: (tx: any) => Promise<T>): Promise<T> {
    if (!pool) return db.transaction(write);
    const refreshPool = pool;
    // A transaction's SET LOCAL limits cannot bound waiting for a pool connection.
    const client = await new Promise<import("pg").PoolClient>((resolve, reject) => {
      let expired = false;
      const timer = setTimeout(() => { expired = true; reject(new Error("GA4_REFRESH_DATABASE_WAIT_TIMEOUT")); }, 10_000);
      refreshPool.connect().then(client => {
        clearTimeout(timer);
        if (expired) client.release(); else resolve(client);
      }, error => { clearTimeout(timer); if (!expired) reject(error); });
    });
    let destroyed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let connectionError: ((error: Error) => void) | undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      connectionError = error => { if (!destroyed) { destroyed = true; client.release(true); } reject(error); };
      client.on("error", connectionError);
      // Closing the connection rolls back even if BEGIN/ROLLBACK or the callback stalls.
      timer = setTimeout(() => connectionError!(new Error("GA4_REFRESH_DATABASE_TRANSACTION_TIMEOUT")), 120_000);
    });
    try {
      return await Promise.race([interrupted, drizzle(client).transaction(async tx => {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
        await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = '30s'`);
        return write(tx);
      })]);
    } finally {
      if (timer) clearTimeout(timer);
      if (connectionError) client.removeListener("error", connectionError);
      if (!destroyed) client.release();
    }
  }

  private async readGA4RefreshWorkScope(tx: any, campaignId: string, ownerId: string, options: { initialImport?: boolean; revenueChange?: boolean; workId?: string } = {}) {
    if (!campaignId?.trim() || !ownerId?.trim()) return undefined;
    const [campaign] = await tx.select().from(campaigns).where(and(
      eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId),
    )).for("update");
    let initialImport = options.initialImport === true;
    let revenueChange = options.revenueChange === true;
    if (options.workId) {
      const [work] = await tx.select({ scope: ga4RefreshWork.scope }).from(ga4RefreshWork)
        .where(and(eq(ga4RefreshWork.id, options.workId), eq(ga4RefreshWork.campaignId, campaignId)));
      initialImport = work?.scope?.kind === "initial_import";
      revenueChange = work?.scope?.kind === "revenue_change";
    }
    if (!campaign || (initialImport ? campaign.status !== "draft" : !filterActiveSchedulerCampaigns([campaign]).length)) return undefined;
    const connections = await tx.select({ id: ga4Connections.id, propertyId: ga4Connections.propertyId,
      importStartDate: ga4Connections.importStartDate, isPrimary: ga4Connections.isPrimary,
      method: ga4Connections.method, lookbackDays: ga4Connections.lookbackDays, connectedAt: ga4Connections.connectedAt,
    }).from(ga4Connections).where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)))
      .orderBy(ga4Connections.id).for("share");
    if (!connections.length || connections.some((connection: any) => !connection.propertyId.trim())) return undefined;
    if (initialImport) {
      if (!campaign.ga4CampaignFilter?.trim() || connections.some((connection: any) => !/^\d+$/.test(connection.propertyId)
        || !["access_token", "service_account"].includes(connection.method))) return undefined;
      for (const table of [revenueSources, spendSources, googleSheetsConnections, hubspotConnections, salesforceConnections, shopifyConnections]) {
        const [source] = await tx.select({ id: table.id }).from(table).where(and(eq(table.campaignId, campaignId), eq(table.isActive, true))).limit(1);
        if (source) return undefined;
      }
      for (const table of [linkedinConnections, metaConnections, instagramConnections, tiktokConnections, googleAdsConnections, ga4GoogleAdsSpendConnections]) {
        const [source] = await tx.select({ id: table.id }).from(table).where(eq(table.campaignId, campaignId)).limit(1);
        if (source) return undefined;
      }
    }
    const scope = { version: 1, campaign: Object.fromEntries([
      "id", "createdAt", "ownerId", "clientId", "status", "ga4CampaignFilter", "currency", "reportingTimeZone",
    ].map(key => [key, campaign[key] ?? null])), connections, ...(initialImport ? { kind: "initial_import" } : revenueChange ? { kind: "revenue_change" } : {}) };
    return { scope, scopeHash: createHash("sha256").update(JSON.stringify(scope)).digest("hex") };
  }

  // Serialize an ordinary input edit with owned publication. Invalidating the work
  // identity also rejects edit-then-restore; comparing current field values cannot.
  private async writeGA4RefreshInputChange<T>(campaignId: string | null | undefined | string[], write: (tx: any) => Promise<T>, lockTimeoutMs = 0, revenueChange = false, preserveRevenueWork = true): Promise<T> {
    const campaignIds = Array.from(new Set((Array.isArray(campaignId) ? campaignId : [campaignId]).filter((id): id is string => Boolean(id)))).sort();
    return db.transaction(async (tx: any) => {
      if (lockTimeoutMs > 0) await tx.execute(sql`SELECT set_config('lock_timeout', ${`${lockTimeoutMs}ms`}, true)`);
      if (campaignIds.length) {
        const parents = await tx.select({ id: campaigns.id }).from(campaigns).where(inArray(campaigns.id, campaignIds)).orderBy(campaigns.id).for("update");
        if (parents.length !== campaignIds.length) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      const result = await write(tx);
      if (campaignIds.length && result !== false && result !== undefined) {
        // Ordinary saves also run on installations where durable work has not
        // been migrated yet; no owner can exist without its work table.
        const workTable = await tx.execute(sql`SELECT to_regclass('ga4_refresh_work') AS name`);
        if (!workTable.rows[0]?.name) {
          if (revenueChange) throw new Error('GA4_REVENUE_PUBLICATION_UNAVAILABLE');
          return result;
        }
        const unfinished = await tx.select({ campaignId: ga4RefreshWork.campaignId, scope: ga4RefreshWork.scope }).from(ga4RefreshWork)
          .where(and(inArray(ga4RefreshWork.campaignId, campaignIds), ne(ga4RefreshWork.status, 'completed'),
            sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`));
        const invalidated = await tx.update(ga4RefreshWork).set({
          scopeHash: sql`'invalidated:' || ${ga4RefreshWork.id}`,
          status: sql`CASE WHEN ${ga4RefreshWork.status} = 'completed' THEN 'completed' ELSE 'pending' END`,
          leaseToken: null, leaseExpiresAt: null, updatedAt: sql`clock_timestamp()`,
        }).where(inArray(ga4RefreshWork.campaignId, campaignIds)).returning({ campaignId: ga4RefreshWork.campaignId });
        const unchangedPublications = new Set<string>();
        // Persist publication work in the source-save transaction: a restart must
        // not strand a successful import. Unchanged provider rows need no new total.
        for (const id of campaignIds) {
          const unfinishedRevenue = preserveRevenueWork && unfinished.some((work: any) => work.campaignId === id && work.scope?.kind === 'revenue_change');
          if (!revenueChange && !unfinishedRevenue) continue;
          const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, id));
          if (!campaign?.ownerId || !campaign.ga4CampaignFilter?.trim()) continue;
          const scope = await this.readGA4RefreshWorkScope(tx, id, campaign.ownerId, { revenueChange: true });
          if (!scope) continue;
          const reportingDate = getLatestCompleteReportingDate(campaign.reportingTimeZone);
          const current = await this.readGA4RevenuePublication(tx, id, reportingDate);
          const [published] = await tx.select({ metrics: metricSnapshots.metrics, reportingDate: metricSnapshots.reportingDate })
            .from(metricSnapshots).where(and(eq(metricSnapshots.campaignId, id), eq(metricSnapshots.snapshotType, 'financial_daily'),
              lte(metricSnapshots.reportingDate, reportingDate))).orderBy(desc(metricSnapshots.reportingDate)).limit(1);
          const receipt = published?.metrics?.revenuePublication;
          const [receiptWork] = receipt?.workId ? await tx.select({ status: ga4RefreshWork.status }).from(ga4RefreshWork)
            .where(and(eq(ga4RefreshWork.id, receipt.workId), eq(ga4RefreshWork.campaignId, id))) : [];
          // Identical revenue can still need recovery after another input cleared
          // report readiness. Only a completed aligned publication can skip work.
          const [aligned] = await tx.select({ notes: metricSnapshots.notes }).from(metricSnapshots).where(and(
            eq(metricSnapshots.campaignId, id), eq(metricSnapshots.snapshotType, 'executive_summary_daily'),
            eq(metricSnapshots.reportingDate, reportingDate),
          )).limit(1);
          const alignedPrefix = `ga4_aligned_refresh_v1:${reportingDate}:`;
          const alignedAt = aligned?.notes?.startsWith(alignedPrefix) ? new Date(aligned.notes.slice(alignedPrefix.length)) : null;
          if (receipt?.version === 1 && published.reportingDate === reportingDate
            && alignedAt && Number.isFinite(alignedAt.getTime()) && alignedAt.getTime() <= Date.now()
            && (!receipt.workId || receiptWork?.status === 'completed')
            && Object.keys(receipt.sources || {}).length === Object.keys(current.sources).length
            && Object.entries(current.sources).every(([sourceId, hash]) => receipt.sources[sourceId] === hash)
            && !unfinished.some((work: any) => work.campaignId === id)) {
            unchangedPublications.add(id);
            continue;
          }
          if (process.env.GA4_DURABLE_RECOVERY_ENABLED === 'false') throw new Error('GA4_REVENUE_PUBLICATION_UNAVAILABLE');
          await tx.insert(ga4RefreshWork).values({ campaignId: id, dueAt: sql`date_trunc('milliseconds', clock_timestamp())`, reportingDate, ...scope });
        }
        const changedCampaignIds = invalidated.map((work: any) => work.campaignId).filter((id: string) => !unchangedPublications.has(id));
        if (changedCampaignIds.length) await tx.update(metricSnapshots).set({ notes: null }).where(and(
          inArray(metricSnapshots.campaignId, changedCampaignIds), eq(metricSnapshots.snapshotType, "executive_summary_daily"),
          sql`split_part(${metricSnapshots.notes}, ':', 1) IN ('ga4_aligned_refresh_v1', 'ga4_refresh_publication_v1')`,
        ));
      }
      return result;
    });
  }

  private async readGA4PublicationVersion(tx: any, campaignId: string): Promise<string | null> {
    const table = await tx.execute(sql`SELECT to_regclass('ga4_refresh_work') AS name`);
    if (!table.rows[0]?.name) return null;
    const result = await tx.execute(sql`SELECT md5(string_agg(id || ':' || xmin::text, ',' ORDER BY id)) AS version,
      bool_or(status <> 'completed' AND scope_hash NOT LIKE 'invalidated:%') AS busy FROM ga4_refresh_work WHERE campaign_id = ${campaignId}`);
    const row = result.rows[0];
    if (row?.busy) throw new Error("GA4_REFRESH_PUBLICATION_BUSY");
    return row?.version ?? null;
  }

  async getGA4PublicationVersion(campaignId: string): Promise<string | null> {
    return this.withGA4RefreshTransaction(tx => this.readGA4PublicationVersion(tx, campaignId));
  }

  async isGA4NativeRecoveryEligible(campaignId: string, options: { includeFinancialSources?: boolean; revenueChange?: boolean } = {}): Promise<boolean> {
    return this.withGA4RefreshTransaction(async tx => {
      const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for("share");
      if (!campaign?.ownerId || !filterActiveSchedulerCampaigns([campaign]).length || !campaign.ga4CampaignFilter?.trim()) return false;
      const connections = await tx.select().from(ga4Connections).where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)));
      if (!connections.length || connections.some((connection: any) => !/^\d+$/.test(connection.propertyId) ||
        !['access_token', 'service_account'].includes(connection.method))) return false;
      for (const table of [revenueSources, spendSources, googleSheetsConnections, hubspotConnections, salesforceConnections, shopifyConnections]) {
        if (options.includeFinancialSources) {
          if (table !== revenueSources && table !== spendSources) continue;
          const sources = await tx.select().from(table).where(and(eq(table.campaignId, campaignId), eq(table.isActive, true)));
          for (const source of sources) {
            if ((source.platformContext || 'ga4') !== 'ga4') continue;
            const types = table === revenueSources ? ['hubspot', 'salesforce', 'shopify', 'google_sheets', 'csv', 'manual', 'custom']
              : ['google_sheets', 'ad_platforms', 'csv', 'manual', 'custom'];
            if (!types.includes(source.sourceType)) return false;
            if (source.sourceType === 'ad_platforms') {
              try { if (JSON.parse(source.mappingConfig || '{}').platform !== 'google_ads') return false; } catch { return false; }
            }
          }
          continue;
        }
        const [source] = await tx.select({ id: table.id }).from(table).where(and(eq(table.campaignId, campaignId), eq(table.isActive, true))).limit(1);
        if (source) return false;
      }
      for (const table of [linkedinConnections, metaConnections, instagramConnections, tiktokConnections, googleAdsConnections, ga4GoogleAdsSpendConnections]) {
        if (options.includeFinancialSources && options.revenueChange) continue;
        if (options.includeFinancialSources && (table === googleAdsConnections || table === ga4GoogleAdsSpendConnections)) continue;
        const [source] = await tx.select({ id: table.id }).from(table).where(eq(table.campaignId, campaignId)).limit(1);
        if (source) return false;
      }
      return true;
    });
  }

  async writeGA4DerivedChange<T>(campaignId: string | null | undefined, options: GA4RefreshWriteInput, write: (tx: any) => Promise<T>): Promise<T> {
    if ("refreshScope" in options) return this.writeWithGA4RefreshOwnership(options.refreshScope, write);
    if (!campaignId) {
      if ("publicationVersion" in options || "googleAdsRefresh" in options) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      return db.transaction(write);
    }
    return this.withGA4RefreshTransaction(async tx => {
      const [campaign] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
      if (!campaign) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(tx, campaignId, options);
      const version = await this.readGA4PublicationVersion(tx, campaignId);
      if ("publicationVersion" in options) {
        if (options.publicationVersion?.campaignId !== campaignId || options.publicationVersion.version !== version) throw new Error("GA4_REFRESH_PUBLICATION_CHANGED");
      } else if (version !== null) throw new Error("GA4_REFRESH_PUBLICATION_CHANGED");
      return write(tx);
    });
  }

  async writeWithGA4RefreshOwnership<T>(scope: GA4RefreshWriteInput["refreshScope"], write: (tx: any) => Promise<T>): Promise<T> {
    if (![scope?.campaignId, scope?.ownerId, scope?.reportingDate, scope?.work?.id, scope?.work?.leaseToken]
      .every(value => typeof value === "string" && value.trim())) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    return this.withGA4RefreshTransaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
      const current = await this.readGA4RefreshWorkScope(tx, scope!.campaignId, scope!.ownerId, { workId: scope!.work.id });
      if (!current) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      const owned = and(eq(ga4RefreshWork.id, scope!.work.id), eq(ga4RefreshWork.campaignId, scope!.campaignId),
        eq(ga4RefreshWork.reportingDate, scope!.reportingDate), eq(ga4RefreshWork.scopeHash, current.scopeHash),
        eq(ga4RefreshWork.status, "running"), eq(ga4RefreshWork.leaseToken, scope!.work.leaseToken),
        sql`${ga4RefreshWork.leaseExpiresAt} > clock_timestamp()`,
        sql`${ga4RefreshWork.startedAt} + interval '15 minutes' > clock_timestamp()`);
      const [work] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(owned).for("share");
      if (!work) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      const result = await write(tx);
      // Campaign/work locks prevent takeover; expiry during writing must roll back the result.
      const [stillOwned] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(owned);
      if (!stillOwned) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      return result;
    });
  }

  async getRecoverableGA4RefreshWork(): Promise<GA4RefreshWork[]> {
    return this.withGA4RefreshTransaction(tx => tx.select().from(ga4RefreshWork).where(and(
      sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`, eq(ga4RefreshWork.retryable, true), lt(ga4RefreshWork.attemptCount, 3),
      sql`${ga4RefreshWork.dueAt} <= clock_timestamp()`,
      or(eq(ga4RefreshWork.status, 'pending'), and(eq(ga4RefreshWork.status, 'running'), sql`${ga4RefreshWork.leaseExpiresAt} <= clock_timestamp()`)),
      sql`(${ga4RefreshWork.nextAttemptAt} IS NULL OR ${ga4RefreshWork.nextAttemptAt} <= clock_timestamp())`,
    )).orderBy(desc(ga4RefreshWork.dueAt)));
  }

  async retireGA4RefreshWork(campaignId: string): Promise<void> {
    await this.writeGA4RefreshInputChange(campaignId, async () => true, 0, false, false);
  }

  async requestGA4InitialImport(campaignId: string, ownerId: string, updates: Pick<InsertCampaign, "platform" | "ga4CampaignFilter">, retry = false): Promise<GA4RefreshWork | undefined> {
    return this.withGA4RefreshTransaction(async tx => {
      const [campaign] = await tx.select().from(campaigns).where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId))).for("update");
      if (!campaign || campaign.status !== "draft") return undefined;
      const changes = { platform: updates.platform ?? campaign.platform, ga4CampaignFilter: updates.ga4CampaignFilter ?? campaign.ga4CampaignFilter };
      const changed = changes.platform !== campaign.platform || changes.ga4CampaignFilter !== campaign.ga4CampaignFilter;
      if (changed) {
        await tx.update(campaigns).set(changes).where(eq(campaigns.id, campaignId));
        if (changes.ga4CampaignFilter !== campaign.ga4CampaignFilter) {
          await tx.delete(ga4DailyMetrics).where(eq(ga4DailyMetrics.campaignId, campaignId));
          await tx.delete(ga4OverviewSnapshots).where(eq(ga4OverviewSnapshots.campaignId, campaignId));
        }
        await tx.update(ga4RefreshWork).set({ scopeHash: sql`'invalidated:' || ${ga4RefreshWork.id}`,
          status: "pending", leaseToken: null, leaseExpiresAt: null, completedAt: null, updatedAt: sql`clock_timestamp()` })
          .where(eq(ga4RefreshWork.campaignId, campaignId));
      }
      const scope = await this.readGA4RefreshWorkScope(tx, campaignId, ownerId, { initialImport: true });
      if (!scope) throw new Error("GA4_INITIAL_IMPORT_CONFIGURATION_REQUIRED");
      const [existing] = await tx.select().from(ga4RefreshWork).where(and(eq(ga4RefreshWork.campaignId, campaignId),
        eq(ga4RefreshWork.scopeHash, scope.scopeHash))).orderBy(desc(ga4RefreshWork.dueAt)).limit(1);
      if (existing) {
        // Repeated Create, lost responses and reopened browsers reuse the same request.
        if (retry && existing.status !== "completed" && (!existing.retryable || existing.attemptCount >= 3)
          && !(existing.status === "running" && existing.leaseExpiresAt > new Date())) {
          const [updated] = await tx.update(ga4RefreshWork).set({ status: "pending", retryable: true, attemptCount: 0,
            leaseToken: null, leaseExpiresAt: null, completedAt: null,
            nextAttemptAt: existing.lastError === "GA4_PROVIDER_BACKOFF" ? existing.nextAttemptAt : null,
            updatedAt: sql`clock_timestamp()` }).where(eq(ga4RefreshWork.id, existing.id)).returning();
          return updated;
        }
        return existing;
      }
      const dueAt = new Date();
      const reportingDate = getLatestCompleteReportingDate(campaign.reportingTimeZone, dueAt);
      const [work] = await tx.insert(ga4RefreshWork).values({ campaignId, dueAt, reportingDate, suppressAlerts: true, ...scope }).returning();
      return work;
    });
  }

  async getGA4InitialImportWork(campaignId: string, ownerId: string, workId?: string): Promise<GA4RefreshWork | undefined> {
    const [row] = await db.select({ work: ga4RefreshWork }).from(ga4RefreshWork)
      .innerJoin(campaigns, and(eq(campaigns.id, ga4RefreshWork.campaignId), eq(campaigns.ownerId, ownerId)))
      .where(and(eq(ga4RefreshWork.campaignId, campaignId), sql`${ga4RefreshWork.scope}->>'kind' = 'initial_import'`,
        workId ? eq(ga4RefreshWork.id, workId) : undefined))
      .orderBy(desc(ga4RefreshWork.dueAt), desc(ga4RefreshWork.updatedAt)).limit(1);
    return row?.work;
  }

  async getGA4InitialImportStatus(campaignId: string, ownerId: string): Promise<GA4InitialImportStatus | null> {
    const work = await this.getGA4InitialImportWork(campaignId, ownerId);
    if (!work) return null;
    const invalidated = work.scopeHash.startsWith("invalidated:");
    const completed = work.status === "completed" && !invalidated;
    const running = work.status === "running" && Boolean(work.leaseExpiresAt && work.leaseExpiresAt > new Date());
    const failed = invalidated || (!running && (!work.retryable || work.attemptCount >= 3));
    return { state: completed ? "completed" : failed ? "failed" : running ? "running" : work.attemptCount > 0 ? "retrying" : "queued",
      canRetry: !completed && failed, dataThroughDate: work.reportingDate,
      error: failed ? invalidated ? "GA4_INITIAL_IMPORT_CONFIGURATION_CHANGED" : work.lastError || "GA4_INITIAL_IMPORT_INTERRUPTED" : null };
  }

  async ensureGA4RefreshWork(campaignId: string, ownerId: string, dueAt: Date, reportingDate: string, options: { suppressAlerts?: boolean; revenueChange?: boolean } = {}): Promise<GA4RefreshWork | undefined> {
    if (!(dueAt instanceof Date) || !Number.isFinite(dueAt.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(reportingDate)
      || new Date(`${reportingDate}T00:00:00Z`).toISOString().slice(0, 10) !== reportingDate) throw new Error("Invalid GA4 work date");
    return this.withGA4RefreshTransaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
      const scope = await this.readGA4RefreshWorkScope(tx, campaignId, ownerId, { revenueChange: options.revenueChange });
      if (!scope) return undefined;
      // A later slot supersedes unfinished older slots, including after midnight.
      const [newer] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(and(
        eq(ga4RefreshWork.campaignId, campaignId), sql`${ga4RefreshWork.dueAt} > ${dueAt}`,
        sql`COALESCE(${ga4RefreshWork.scope}->>'kind', '') <> 'initial_import'`,
        sql`${ga4RefreshWork.dueAt} <= clock_timestamp()`, sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`));
      if (newer) return undefined;
      await tx.update(ga4RefreshWork).set({ scopeHash: sql`'invalidated:' || ${ga4RefreshWork.id}`,
        status: "pending", leaseToken: null, leaseExpiresAt: null, updatedAt: sql`clock_timestamp()` })
        .where(and(eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.status, "pending"),
          or(lt(ga4RefreshWork.dueAt, dueAt), and(eq(ga4RefreshWork.dueAt, dueAt), ne(ga4RefreshWork.reportingDate, reportingDate))),
          sql`NOT (COALESCE(${ga4RefreshWork.lastError}, '') = 'GA4_PROVIDER_BACKOFF' AND ${ga4RefreshWork.nextAttemptAt} > clock_timestamp())`,
          sql`${dueAt}::timestamptz <= clock_timestamp()`, sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`));
      await tx.insert(ga4RefreshWork).values({ campaignId, dueAt, reportingDate, suppressAlerts: options.suppressAlerts === true, ...scope }).onConflictDoNothing();
      const [work] = await tx.select().from(ga4RefreshWork).where(and(eq(ga4RefreshWork.campaignId, campaignId),
        eq(ga4RefreshWork.dueAt, dueAt), eq(ga4RefreshWork.reportingDate, reportingDate), eq(ga4RefreshWork.scopeHash, scope.scopeHash)));
      return work;
    });
  }

  async claimGA4RefreshWork(campaignId: string, ownerId: string, workId: string, leaseMs: number): Promise<GA4RefreshWork | undefined> {
    if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 900_000) throw new Error("Invalid GA4 work lease duration");
    return this.withGA4RefreshTransaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
      const scope = await this.readGA4RefreshWorkScope(tx, campaignId, ownerId, { workId });
      if (!scope) return undefined;
      const [work] = await tx.select().from(ga4RefreshWork).where(and(eq(ga4RefreshWork.id, workId),
        eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.scopeHash, scope.scopeHash),
        sql`${ga4RefreshWork.dueAt} <= clock_timestamp()`,
        sql`(${ga4RefreshWork.nextAttemptAt} IS NULL OR ${ga4RefreshWork.nextAttemptAt} <= clock_timestamp())`));
      if (!work || work.status === "completed" || !work.retryable || work.attemptCount >= 3) return undefined;
      const [providerBackoff] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(and(
        eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.scopeHash, scope.scopeHash),
        eq(ga4RefreshWork.lastError, "GA4_PROVIDER_BACKOFF"), sql`${ga4RefreshWork.nextAttemptAt} > clock_timestamp()`));
      if (providerBackoff) return undefined;
      const [newer] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(and(
        eq(ga4RefreshWork.campaignId, campaignId), sql`${ga4RefreshWork.dueAt} > ${work.dueAt}`,
        scope.scope.kind === "initial_import" ? undefined : sql`COALESCE(${ga4RefreshWork.scope}->>'kind', '') <> 'initial_import'`,
        sql`${ga4RefreshWork.dueAt} <= clock_timestamp()`, sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`));
      if (newer) return undefined;
      // Expiry clears only work ownership; it never authorizes an old owner to publish.
      await tx.update(ga4RefreshWork).set({ status: "pending", leaseToken: null, leaseExpiresAt: null, updatedAt: sql`clock_timestamp()`,
        scopeHash: sql`CASE WHEN ${ga4RefreshWork.id} = ${workId} THEN ${ga4RefreshWork.scopeHash} ELSE 'invalidated:' || ${ga4RefreshWork.id} END` })
        .where(and(eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.status, "running"),
          sql`${ga4RefreshWork.leaseExpiresAt} <= clock_timestamp()`));
      const [busy] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork)
        .where(and(eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.status, "running")));
      if (busy) return undefined;
      const [claimed] = await tx.update(ga4RefreshWork).set({ status: "running", leaseToken: randomUUID(),
        attemptCount: sql`${ga4RefreshWork.attemptCount} + 1`, nextAttemptAt: null,
        leaseExpiresAt: sql`clock_timestamp() + ${leaseMs} * interval '1 millisecond'`,
        startedAt: sql`clock_timestamp()`, updatedAt: sql`clock_timestamp()`,
      }).where(and(eq(ga4RefreshWork.id, workId), eq(ga4RefreshWork.campaignId, campaignId), eq(ga4RefreshWork.status, "pending"))).returning();
      return claimed;
    });
  }

  async updateGA4RefreshWorkLease(campaignId: string, ownerId: string, workId: string, leaseToken: string,
    action: "renew" | "release" | "complete" | "complete_without_alerts" | "complete_initial_import", leaseMs = 120_000, publicationCompletedAt?: string, failure?: { retryable: boolean; code: string; retryAfterMs?: number }): Promise<GA4RefreshWork | undefined> {
    if (!["renew", "release", "complete", "complete_without_alerts", "complete_initial_import"].includes(action) || !Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 900_000)
      throw new Error("Invalid GA4 work lease update");
    if (!leaseToken?.trim()) return undefined;
    if (publicationCompletedAt !== undefined && (!["complete", "complete_without_alerts"].includes(action) || !Number.isFinite(Date.parse(publicationCompletedAt)))) throw new Error("Invalid GA4 work completion time");
    return this.withGA4RefreshTransaction(async (tx: any) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
      await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
      const scope = await this.readGA4RefreshWorkScope(tx, campaignId, ownerId, { workId });
      if (!scope) return undefined;
      const owned = and(eq(ga4RefreshWork.id, workId), eq(ga4RefreshWork.campaignId, campaignId),
        eq(ga4RefreshWork.scopeHash, scope.scopeHash), eq(ga4RefreshWork.status, "running"),
        eq(ga4RefreshWork.leaseToken, leaseToken), sql`${ga4RefreshWork.leaseExpiresAt} > clock_timestamp()`,
        sql`${ga4RefreshWork.startedAt} + interval '15 minutes' > clock_timestamp()`);
      const [work] = await tx.select().from(ga4RefreshWork).where(owned);
      if (!work) return undefined;
      const initialImport = work.scope?.kind === "initial_import";
      if (action.startsWith("complete") && initialImport !== (action === "complete_initial_import")) return undefined;
      let completedAt: Date | null = null;
      if (action === "complete_initial_import") {
        const receipt = createHash("sha256").update(leaseToken).digest("hex");
        if (!scope.scope.connections.every((connection: any) => work.scope?.initialImportPublications?.[connection.id] === receipt)) return undefined;
        // Native-only creation must publish the card's financial input in the same activation transaction.
        const primary = scope.scope.connections.find((connection: any) => connection.isPrimary)
          || [...scope.scope.connections].sort((a: any, b: any) => new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime())[0];
        const [overview] = await tx.select().from(ga4OverviewSnapshots).where(and(
          eq(ga4OverviewSnapshots.campaignId, campaignId), eq(ga4OverviewSnapshots.propertyId, primary.propertyId),
        )).for("share");
        const totals = overview?.campaignBreakdown?.totals;
        const currency = String(scope.scope.campaign.currency || "USD").trim().toUpperCase();
        if (!overview || overview.windowStart !== (primary.importStartDate || GA4_OVERVIEW_LEGACY_IMPORT_START_DATE)
          || overview.windowEnd !== work.reportingDate || String(overview.campaignBreakdown?.meta?.currencyCode || "").trim().toUpperCase() !== currency
          || typeof totals?.revenue !== "number" || !Number.isFinite(totals.revenue)
          || typeof totals?.conversions !== "number" || !Number.isFinite(totals.conversions) || totals.conversions < 0) return undefined;
        const parsed = financialDailySnapshotInputSchema.safeParse({
          version: "financial_daily_snapshot_v1", campaignId, reportingDate: work.reportingDate, currency,
          currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: overview.windowStart,
            endDate: work.reportingDate, dataThroughDate: work.reportingDate, reportingTimeZone: normalizeReportingTimeZone(scope.scope.campaign.reportingTimeZone) },
          inputs: { revenue: { value: totals.revenue.toFixed(2), available: true, sources: ["ga4"] },
            conversions: { value: totals.conversions, available: true, sources: ["ga4"] },
            spend: { value: null, available: false, sources: [] } },
        });
        if (!parsed.success) return undefined;
        const { campaignId: snapshotCampaignId, reportingDate, ...financialDaily } = parsed.data;
        await tx.insert(metricSnapshots).values({ campaignId: snapshotCampaignId, reportingDate,
          snapshotType: "financial_daily", totalConversions: totals.conversions, metrics: { financialDaily } })
          .onConflictDoUpdate({ target: [metricSnapshots.campaignId, metricSnapshots.reportingDate],
            targetWhere: sql`${metricSnapshots.snapshotType} = 'financial_daily' AND ${metricSnapshots.reportingDate} IS NOT NULL`,
            set: { totalConversions: totals.conversions, totalSpend: "0", metrics: { financialDaily }, recordedAt: sql`CURRENT_TIMESTAMP` } });
        // Snapshot, activation and completion share the campaign lock and commit together.
        await tx.update(campaigns).set({ status: "active" }).where(and(eq(campaigns.id, campaignId), eq(campaigns.ownerId, ownerId), eq(campaigns.status, "draft")));
        completedAt = new Date();
      }
      if (action === "complete" || action === "complete_without_alerts") {
        const [snapshot] = await tx.select({ notes: metricSnapshots.notes }).from(metricSnapshots).where(and(
          eq(metricSnapshots.campaignId, campaignId), eq(metricSnapshots.snapshotType, "executive_summary_daily"),
          eq(metricSnapshots.reportingDate, work.reportingDate),
        )).for("share");
        const prefix = `ga4_aligned_refresh_v1:${work.reportingDate}:`;
        if (publicationCompletedAt !== undefined) {
          const receipt = `ga4_refresh_publication_v1:${workId}:${createHash("sha256").update(leaseToken).digest("hex")}`;
          if (snapshot?.notes !== receipt) return undefined;
          completedAt = new Date(publicationCompletedAt);
        } else {
          if (!snapshot?.notes?.startsWith(prefix)) return undefined;
          completedAt = new Date(snapshot.notes.slice(prefix.length));
        }
        if (!Number.isFinite(completedAt.getTime()) || completedAt < work.dueAt || completedAt < work.startedAt) return undefined;
        if (publicationCompletedAt !== undefined && action === "complete") {
          const [marked] = await tx.update(metricSnapshots).set({ notes: `${prefix}${publicationCompletedAt}` }).where(and(
            eq(metricSnapshots.campaignId, campaignId), eq(metricSnapshots.snapshotType, "executive_summary_daily"),
            eq(metricSnapshots.reportingDate, work.reportingDate), sql`${completedAt}::timestamptz <= clock_timestamp()`,
          )).returning({ id: metricSnapshots.id });
          if (!marked) return undefined;
        }
      }
      const [updated] = await tx.update(ga4RefreshWork).set(action === "renew" ? {
        leaseExpiresAt: sql`LEAST(clock_timestamp() + ${leaseMs} * interval '1 millisecond', ${ga4RefreshWork.startedAt} + interval '15 minutes')`, updatedAt: sql`clock_timestamp()`,
      } : { status: action.startsWith("complete") ? "completed" : "pending", leaseToken: null, leaseExpiresAt: null,
        completedAt, updatedAt: sql`clock_timestamp()`,
        ...(action === "release" && failure ? {
          retryable: failure.retryable, lastError: failure.code.replace(/[^a-z0-9_:.-]/gi, "_").slice(0, 160),
          nextAttemptAt: failure.retryAfterMs !== undefined && (!Number.isFinite(failure.retryAfterMs) || failure.retryAfterMs > 31_536_000_000)
            ? sql`'infinity'::timestamptz`
            : sql`clock_timestamp() + ${Math.max(60_000 * 2 ** Math.min(work.attemptCount - 1, 2), failure.retryAfterMs || 0)} * interval '1 millisecond'`,
        } : {}),
      }).where(and(owned, completedAt ? sql`${completedAt}::timestamptz <= clock_timestamp()` : undefined)).returning();
      if ((publicationCompletedAt !== undefined || action === "complete_initial_import") && !updated) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      if (publicationCompletedAt !== undefined || action === "complete_initial_import") {
        const [withinLease] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(and(
          eq(ga4RefreshWork.id, workId), sql`${work.leaseExpiresAt}::timestamptz > clock_timestamp()`,
        ));
        if (!withinLease) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      }
      return updated;
    });
  }

  async upsertGA4DailyMetrics(rows: InsertGA4DailyMetric[]): Promise<{ upserted: number }> {
    const input = Array.isArray(rows) ? rows : [];
    if (input.length === 0) return { upserted: 0 };

    // Row-by-row upsert (small daily batches; simplest + reliable)
    for (const r of input) {
      const campaignId = String((r as any)?.campaignId || "");
      const propertyId = String((r as any)?.propertyId || "");
      const date = String((r as any)?.date || "");
      if (!campaignId || !propertyId || !date) continue;

      const users = Number((r as any)?.users || 0) || 0;
      const sessions = Number((r as any)?.sessions || 0) || 0;
      const engagedSessions = (r as any)?.engagedSessions == null ? null : Math.max(0, Math.round(Number((r as any).engagedSessions) || 0));
      const pageviews = Number((r as any)?.pageviews || 0) || 0;
      const conversions = Number((r as any)?.conversions || 0) || 0;
      const revenue = String((r as any)?.revenue ?? "0");
      const engagementRate = (r as any)?.engagementRate ?? null;
      const revenueMetric = (r as any)?.revenueMetric ?? null;
      const isSimulated = Boolean((r as any)?.isSimulated);

      await db.execute(sql`
        INSERT INTO ga4_daily_metrics
          (campaign_id, property_id, date, users, sessions, engaged_sessions, pageviews, conversions, revenue, engagement_rate, revenue_metric, is_simulated, updated_at)
        VALUES
          (${campaignId}, ${propertyId}, ${date}, ${users}, ${sessions}, ${engagedSessions}, ${pageviews}, ${conversions}, ${revenue}, ${engagementRate}, ${revenueMetric}, ${isSimulated}, CURRENT_TIMESTAMP)
        ON CONFLICT (campaign_id, property_id, date)
        DO UPDATE SET
          users = EXCLUDED.users,
          sessions = EXCLUDED.sessions,
          engaged_sessions = EXCLUDED.engaged_sessions,
          pageviews = EXCLUDED.pageviews,
          conversions = EXCLUDED.conversions,
          revenue = EXCLUDED.revenue,
          engagement_rate = EXCLUDED.engagement_rate,
          revenue_metric = EXCLUDED.revenue_metric,
          is_simulated = EXCLUDED.is_simulated,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }

    return { upserted: input.length };
  }

  async replaceGA4DailyMetricsWindow(campaignId: string, propertyId: string, startDate: string, endDate: string, rows: InsertGA4DailyMetric[], overviewSnapshot?: GA4OverviewSnapshotInput): Promise<{ replaced: number }> {
    const cid = String(campaignId || "").trim();
    const pid = String(propertyId || "").trim();
    const start = String(startDate || "").trim();
    const end = String(endDate || "").trim();
    if (!cid || !pid || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      throw new Error("Invalid GA4 daily replacement scope");
    }
    const inputRows = Array.isArray(rows) ? rows : [];
    const normalizedRows = inputRows.map((row: any) => {
      const normalized = normalizeGA4InsightsDailyMetricValues(row);
      return normalized ? { ...row, ...normalized } : null;
    });
    if (normalizedRows.some((row) => !row)) throw new Error("GA4 daily replacement contains an invalid metric value");
    const scoped = normalizedRows.filter((row: any) =>
      String(row.campaignId || "") === cid &&
      String(row.propertyId || "") === pid &&
      String(row.date || "") >= start &&
      String(row.date || "") <= end
    );
    if (scoped.length !== inputRows.length) {
      throw new Error("GA4 daily replacement row scope mismatch");
    }
    if (overviewSnapshot && (
      !/^\d{4}-\d{2}-\d{2}$/.test(String(overviewSnapshot.windowStart || "")) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(overviewSnapshot.windowEnd || "")) ||
      overviewSnapshot.windowStart > overviewSnapshot.windowEnd ||
      overviewSnapshot.windowEnd !== end ||
      !overviewSnapshot.campaignBreakdown || !overviewSnapshot.landingPages || !overviewSnapshot.conversionEvents
    )) throw new Error("Invalid GA4 Overview snapshot");

    const transaction = overviewSnapshot?.refreshScope && "work" in overviewSnapshot.refreshScope
      ? this.withGA4RefreshTransaction.bind(this) : db.transaction.bind(db);
    await transaction(async (tx: any) => {
      let workOwnership: ReturnType<typeof and> = undefined;
      if (overviewSnapshot?.refreshScope && "work" in overviewSnapshot.refreshScope) {
        await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
        await tx.execute(sql`SET LOCAL statement_timeout = '30s'`);
      }
      if (overviewSnapshot?.refreshScope) {
        const scope = overviewSnapshot.refreshScope;
        const [currentCampaign] = await tx.select().from(campaigns).where(eq(campaigns.id, cid)).for("update");
        const [currentConnection] = await tx.select().from(ga4Connections).where(and(
          eq(ga4Connections.id, String(scope.connection.id)), eq(ga4Connections.campaignId, cid), eq(ga4Connections.propertyId, pid),
        )).for("share");
        if (!currentCampaign || !currentConnection || currentConnection.isActive === false ||
            Object.entries(scope.campaign).some(([key, value]) => JSON.stringify(currentCampaign[key] ?? null) !== JSON.stringify(value ?? null)) ||
            Object.entries(scope.connection).some(([key, value]) => JSON.stringify(currentConnection[key] ?? null) !== JSON.stringify(value ?? null))) {
          throw new Error("GA4 refresh scope changed before publication");
        }
        const [previous] = await tx.select().from(ga4OverviewSnapshots).where(and(eq(ga4OverviewSnapshots.campaignId, cid), eq(ga4OverviewSnapshots.propertyId, pid)));
        if ((previous?.updatedAt ? new Date(previous.updatedAt).toISOString() : null) !== scope.previousUpdatedAt) {
          throw new Error("Another GA4 refresh published before this attempt");
        }
        if (!("work" in scope) && (scope.previousWorkVersion ?? null) !== await this.readGA4PublicationVersion(tx, cid)) {
          throw new Error("GA4_REFRESH_PUBLICATION_CHANGED");
        }
        if ("work" in scope) {
          if (typeof scope.work?.id !== "string" || !scope.work.id.trim() ||
              typeof scope.work?.leaseToken !== "string" || !scope.work.leaseToken.trim()) {
            throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
          }
          const currentScope = await this.readGA4RefreshWorkScope(tx, cid, String(scope.campaign.ownerId || ""), { workId: scope.work.id });
          if (!currentScope) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
          workOwnership = and(eq(ga4RefreshWork.id, scope.work.id), eq(ga4RefreshWork.campaignId, cid),
            eq(ga4RefreshWork.scopeHash, currentScope.scopeHash), eq(ga4RefreshWork.reportingDate, end),
            eq(ga4RefreshWork.status, "running"), eq(ga4RefreshWork.leaseToken, scope.work.leaseToken),
            sql`${ga4RefreshWork.leaseExpiresAt} > clock_timestamp()`,
            sql`${ga4RefreshWork.startedAt} + interval '15 minutes' > clock_timestamp()`);
          const [owned] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(workOwnership).for("share");
          if (!owned) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
        }
      }
      await tx.delete(ga4DailyMetrics).where(and(
        eq(ga4DailyMetrics.campaignId, cid),
        eq(ga4DailyMetrics.propertyId, pid),
        sql`${ga4DailyMetrics.date} >= ${start} AND ${ga4DailyMetrics.date} <= ${end}`,
      ));
      // Bound query parameters while keeping every batch and Overview in this transaction.
      for (let offset = 0; offset < scoped.length; offset += 500) {
        await tx.insert(ga4DailyMetrics).values(scoped.slice(offset, offset + 500).map((row: any) => ({
          ...row,
          campaignId: cid,
          propertyId: pid,
          date: String(row.date),
          users: row.users,
          sessions: row.sessions,
          engagedSessions: row.engagedSessions == null ? null : Math.round(row.engagedSessions),
          pageviews: row.pageviews,
          conversions: row.conversions,
          revenue: String(row?.revenue ?? "0"),
          engagementRate: row?.engagementRate ?? null,
          revenueMetric: row?.revenueMetric ?? null,
          isSimulated: Boolean(row?.isSimulated),
          updatedAt: new Date(),
        })));
      }
      if (overviewSnapshot) {
        await tx.insert(ga4OverviewSnapshots).values({
          campaignId: cid,
          propertyId: pid,
          windowStart: overviewSnapshot.windowStart,
          windowEnd: overviewSnapshot.windowEnd,
          campaignBreakdown: overviewSnapshot.campaignBreakdown,
          landingPages: overviewSnapshot.landingPages,
          conversionEvents: overviewSnapshot.conversionEvents,
          updatedAt: new Date(),
        } as any).onConflictDoUpdate({
          target: [ga4OverviewSnapshots.campaignId, ga4OverviewSnapshots.propertyId],
          set: {
            windowStart: overviewSnapshot.windowStart,
            windowEnd: overviewSnapshot.windowEnd,
            campaignBreakdown: overviewSnapshot.campaignBreakdown,
            landingPages: overviewSnapshot.landingPages,
            conversionEvents: overviewSnapshot.conversionEvents,
            updatedAt: new Date(),
          },
        });
      }
      // The campaign lock excludes takeover until commit; expiry during the writes rolls both outputs back.
      if (workOwnership) {
        const scope = overviewSnapshot!.refreshScope!;
        if ("work" in scope && scope.work) {
          const receipt = createHash("sha256").update(scope.work.leaseToken).digest("hex");
          await tx.update(ga4RefreshWork).set({ scope: sql`jsonb_set(${ga4RefreshWork.scope}, '{initialImportPublications}',
            COALESCE(${ga4RefreshWork.scope}->'initialImportPublications', '{}'::jsonb) || jsonb_build_object(${String(scope.connection.id)}::text, ${receipt}::text))` })
            .where(and(workOwnership, sql`${ga4RefreshWork.scope}->>'kind' = 'initial_import'`));
        }
        const [owned] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(workOwnership);
        if (!owned) throw new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST");
      }
    });
    return { replaced: scoped.length };
  }

  async getGA4DailyMetrics(campaignId: string, propertyId: string, startDate: string, endDate: string): Promise<GA4DailyMetric[]> {
    const cid = String(campaignId || "");
    const pid = String(propertyId || "");
    const start = String(startDate || "");
    const end = String(endDate || "");
    const rows = await db
      .select()
      .from(ga4DailyMetrics)
      .where(
        and(
          eq(ga4DailyMetrics.campaignId, cid),
          eq(ga4DailyMetrics.propertyId, pid),
          sql`${ga4DailyMetrics.date} >= ${start} AND ${ga4DailyMetrics.date} <= ${end}`
        )
      )
      .orderBy(ga4DailyMetrics.date);
    return rows as any;
  }

  async getLatestGA4DailyMetric(campaignId: string, propertyId: string): Promise<GA4DailyMetric | undefined> {
    const cid = String(campaignId || "");
    const pid = String(propertyId || "");
    const rows = await db
      .select()
      .from(ga4DailyMetrics)
      .where(and(eq(ga4DailyMetrics.campaignId, cid), eq(ga4DailyMetrics.propertyId, pid)))
      .orderBy(desc(ga4DailyMetrics.date))
      .limit(1);
    return (rows?.[0] as any) || undefined;
  }

  async getGA4OverviewSnapshot(campaignId: string, propertyId: string): Promise<GA4OverviewSnapshot | undefined> {
    const [snapshot] = await db.select().from(ga4OverviewSnapshots).where(and(
      eq(ga4OverviewSnapshots.campaignId, String(campaignId || "")),
      eq(ga4OverviewSnapshots.propertyId, String(propertyId || "")),
    )).limit(1);
    return snapshot as any;
  }

  async upsertLinkedInDailyMetrics(rows: InsertLinkedInDailyMetric[]): Promise<{ upserted: number }> {
    const input = Array.isArray(rows) ? rows : [];
    if (input.length === 0) return { upserted: 0 };

    for (const r of input) {
      const campaignId = String((r as any)?.campaignId || "");
      const date = String((r as any)?.date || "");
      if (!campaignId || !date) continue;

      const impressions = Number((r as any)?.impressions || 0) || 0;
      const clicks = Number((r as any)?.clicks || 0) || 0;
      const reach = Number((r as any)?.reach || 0) || 0;
      const engagements = Number((r as any)?.engagements || 0) || 0;
      const conversions = Number((r as any)?.conversions || 0) || 0;
      const leads = Number((r as any)?.leads || 0) || 0;
      const spend = String((r as any)?.spend ?? "0");
      const videoViews = Number((r as any)?.videoViews || 0) || 0;
      const viralImpressions = Number((r as any)?.viralImpressions || 0) || 0;

      await db.execute(sql`
        INSERT INTO linkedin_daily_metrics
          (campaign_id, date, impressions, clicks, reach, engagements, conversions, leads, spend, video_views, viral_impressions, updated_at)
        VALUES
          (${campaignId}, ${date}, ${impressions}, ${clicks}, ${reach}, ${engagements}, ${conversions}, ${leads}, ${spend}, ${videoViews}, ${viralImpressions}, CURRENT_TIMESTAMP)
        ON CONFLICT (campaign_id, date)
        DO UPDATE SET
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          reach = EXCLUDED.reach,
          engagements = EXCLUDED.engagements,
          conversions = EXCLUDED.conversions,
          leads = EXCLUDED.leads,
          spend = EXCLUDED.spend,
          video_views = EXCLUDED.video_views,
          viral_impressions = EXCLUDED.viral_impressions,
          updated_at = CURRENT_TIMESTAMP;
      `);
    }

    return { upserted: input.length };
  }

  async getLinkedInDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<LinkedInDailyMetric[]> {
    const cid = String(campaignId || "");
    const start = String(startDate || "");
    const end = String(endDate || "");
    const rows = await db
      .select()
      .from(linkedinDailyMetrics)
      .where(and(eq(linkedinDailyMetrics.campaignId, cid), sql`${linkedinDailyMetrics.date} >= ${start} AND ${linkedinDailyMetrics.date} <= ${end}`))
      .orderBy(linkedinDailyMetrics.date);
    return rows as any;
  }

  // Spend methods
  async getSpendSources(campaignId: string, platformContext?: SpendPlatformContext): Promise<SpendSource[]> {
    return db.select().from(spendSources)
      .where(and(
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.isActive, true),
        spendPlatformContextPredicate(platformContext),
      ))
      .orderBy(desc(spendSources.connectedAt));
  }

  async getInactiveSpendSources(campaignId: string): Promise<SpendSource[]> {
    return db.select().from(spendSources)
      .where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, false)))
      .orderBy(desc(spendSources.connectedAt));
  }

  async getSpendSource(campaignId: string, sourceId: string, platformContext?: SpendPlatformContext): Promise<SpendSource | undefined> {
    const [s] = await db.select().from(spendSources)
      // Some DBs have spend_sources.id as UUID while our API passes string IDs.
      // Cast to text to avoid "operator does not exist: uuid = text".
      .where(and(
        sql`${spendSources.id}::text = ${sourceId}`,
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.isActive, true),
        spendPlatformContextPredicate(platformContext),
      ));
    return s || undefined;
  }

  async createSpendSource(source: InsertSpendSource): Promise<SpendSource> {
    const save = async (db: any) => {
    const [s] = await db
      .insert(spendSources)
      .values({
        ...source,
        isActive: source.isActive !== undefined ? source.isActive : true,
      } as any)
      .returning();
    return s;
    };
    return !source.platformContext || source.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(source.campaignId, save) : save(db);
  }

  async updateSpendSource(sourceId: string, source: Partial<InsertSpendSource>): Promise<SpendSource | undefined> {
    const [target] = await db.select().from(spendSources).where(sql`${spendSources.id}::text = ${sourceId}`);
    if (!target) return undefined;
    const save = async (db: any) => {
    const [s] = await db
      .update(spendSources)
      .set(source as any)
      .where(sql`${spendSources.id}::text = ${sourceId}`)
      .returning();
    return s || undefined;
    };
    return !target.platformContext || target.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(target.campaignId, save) : save(db);
  }

  async deleteSpendSource(sourceId: string): Promise<boolean> {
    const [target] = await db.select().from(spendSources).where(sql`${spendSources.id}::text = ${sourceId}`);
    if (!target) return false;
    const save = async (db: any) => {
    const result = await db
      .update(spendSources)
      .set({ isActive: false } as any)
      .where(sql`${spendSources.id}::text = ${sourceId}`);
    return (result.rowCount || 0) > 0;
    };
    return !target.platformContext || target.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(target.campaignId, save) : save(db);
  }

  async deleteSpendSourceWithRecords(campaignId: string, sourceId: string, platformContext: SpendPlatformContext): Promise<boolean> {
    const transaction = platformContext === 'ga4' ? this.writeGA4RefreshInputChange.bind(this, campaignId) : db.transaction.bind(db);
    return await transaction(async (tx: any) => {
      const contextCondition = platformContext === "ga4"
        ? or(eq(spendSources.platformContext, "ga4" as any), isNull(spendSources.platformContext))
        : eq(spendSources.platformContext, platformContext as any);
      const [deletedSource] = await tx.update(spendSources).set({ isActive: false } as any).where(and(
        sql`${spendSources.id}::text = ${sourceId}`,
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.isActive, true),
        contextCondition,
      )).returning({ id: spendSources.id });
      if (!deletedSource) return false;
      await tx.delete(spendRecords).where(and(
        eq(spendRecords.spendSourceId, sourceId),
        eq(spendRecords.campaignId, campaignId),
      ));
      return true;
    });
  }

  async hardDeleteInactiveSpendSource(campaignId: string, sourceId: string): Promise<boolean> {
    const result = await db
      .delete(spendSources)
      .where(and(sql`${spendSources.id}::text = ${sourceId}`, eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, false)));
    return (result.rowCount || 0) > 0;
  }

  async getGoogleSheetsSpendCleanupState(campaignId: string, executor: any = db): Promise<{ sources: SpendSource[]; records: SpendRecord[] }> {
    const sources = await executor.select().from(spendSources).where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.sourceType, 'google_sheets'))).orderBy(spendSources.id);
    // Include foreign-campaign records referencing these IDs so corruption cannot be hidden by a filter.
    const records = sources.length ? await executor.select().from(spendRecords).where(inArray(spendRecords.spendSourceId, sources.map((s: any) => s.id))).orderBy(spendRecords.id) : [];
    return { sources, records };
  }

  async cleanupGoogleSheetsSpendDuplicates(campaignId: string, expected: { sources: SpendSource[]; records: SpendRecord[] }, sourceIds: string[], mode: 'deactivate' | 'purge'): Promise<string[]> {
    if (!sourceIds.length) return [];
    if (!['deactivate', 'purge'].includes(mode)) throw new Error('Invalid spend cleanup mode');
    return this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      // This retained maintenance API has no current UI caller. Bound its lock wait and
      // fence legacy writers too; row locks alone do not prevent new child records.
      await tx.execute(sql`SET LOCAL statement_timeout = '10s'`);
      await tx.execute(sql`LOCK TABLE spend_sources, spend_records IN SHARE ROW EXCLUSIVE MODE`);
      const current = await this.getGoogleSheetsSpendCleanupState(campaignId, tx);
      if (JSON.stringify(current) !== JSON.stringify(expected)) throw Object.assign(new Error('Spend data changed. Inspect duplicates again.'), { code: 'SPEND_SOURCE_CHANGED' });
      const targets = current.sources.filter(s => sourceIds.includes(s.id) && s.isActive === (mode === 'deactivate'));
      if (targets.length !== new Set(sourceIds).size || current.records.some(r => sourceIds.includes(r.spendSourceId) && (r.campaignId !== campaignId || mode === 'purge'))) {
        throw Object.assign(new Error('Spend cleanup scope changed'), { code: 'SPEND_SOURCE_CHANGED' });
      }
      if (mode === 'deactivate') {
        await tx.update(spendSources).set({ isActive: false }).where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.sourceType, 'google_sheets'), inArray(spendSources.id, sourceIds)));
        await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), inArray(spendRecords.spendSourceId, sourceIds)));
      } else {
        await tx.delete(spendSources).where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.sourceType, 'google_sheets'), eq(spendSources.isActive, false), inArray(spendSources.id, sourceIds)));
      }
      return targets.map(s => s.id);
    }, 3000);
  }

  async disconnectGa4GoogleSheetsSpend(campaignId: string): Promise<{ sourceIds: string[]; connectionIds: string[] }> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const activeSources = await tx
        .select({ id: spendSources.id, platformContext: spendSources.platformContext, mappingConfig: spendSources.mappingConfig })
        .from(spendSources)
        .where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.sourceType, 'google_sheets'), eq(spendSources.isActive, true)));
      const targetSources = activeSources.filter((source: any) => String(source.platformContext || 'ga4').toLowerCase() === 'ga4');
      const sourceIds = targetSources.map((source: any) => String(source.id));
      const readConnectionId = (source: any): string => {
        try {
          const config = source?.mappingConfig ? JSON.parse(String(source.mappingConfig)) : null;
          return String(config?.connectionId || '').trim();
        } catch {
          return '';
        }
      };
      const mappedConnectionIds = new Set(targetSources.map(readConnectionId).filter(Boolean));
      const sharedSpendConnectionIds = new Set(activeSources
        .filter((source: any) => String(source.platformContext || 'ga4').toLowerCase() !== 'ga4')
        .map(readConnectionId)
        .filter(Boolean));
      const activeRevenueSources = await tx
        .select({ mappingConfig: revenueSources.mappingConfig })
        .from(revenueSources)
        .where(and(eq(revenueSources.campaignId, campaignId), eq(revenueSources.sourceType, 'google_sheets'), eq(revenueSources.isActive, true)));
      const sharedRevenueConnectionIds = new Set(activeRevenueSources.map(readConnectionId).filter(Boolean));
      const activeConnections = await tx
        .select({ id: googleSheetsConnections.id, purpose: googleSheetsConnections.purpose, isPrimary: googleSheetsConnections.isPrimary })
        .from(googleSheetsConnections)
        .where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.isActive, true)));
      const targetConnections = activeConnections.filter((connection: any) => {
        const id = String(connection.id);
        const purpose = String(connection.purpose || '').toLowerCase();
        const belongsToGa4Spend = purpose === 'spend' || (!purpose && mappedConnectionIds.has(id));
        return belongsToGa4Spend && !sharedSpendConnectionIds.has(id) && !sharedRevenueConnectionIds.has(id);
      });
      const connectionIds = targetConnections.map((connection: any) => String(connection.id));
      if (sourceIds.length === 0 && connectionIds.length === 0) {
        throw Object.assign(new Error('No active Google Sheets Spend connection found'), { code: 'GOOGLE_SHEETS_SPEND_CONNECTION_NOT_FOUND' });
      }

      if (sourceIds.length > 0) {
        const disabledSources = await tx
          .update(spendSources)
          .set({ isActive: false } as any)
          .where(and(
            eq(spendSources.campaignId, campaignId),
            eq(spendSources.sourceType, 'google_sheets'),
            eq(spendSources.isActive, true),
            or(eq(spendSources.platformContext, 'ga4' as any), isNull(spendSources.platformContext)),
            inArray(spendSources.id, sourceIds),
          ))
          .returning({ id: spendSources.id });
        if (disabledSources.length !== sourceIds.length) throw new Error('Google Sheets Spend sources changed during disconnect');
        await tx.delete(spendRecords).where(and(
          eq(spendRecords.campaignId, campaignId),
          inArray(spendRecords.spendSourceId, sourceIds),
        ));
      }

      if (connectionIds.length > 0) {
        const disabledConnections = await tx
          .update(googleSheetsConnections)
          .set({ isActive: false, isPrimary: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null } as any)
          .where(and(
            eq(googleSheetsConnections.campaignId, campaignId),
            eq(googleSheetsConnections.isActive, true),
            inArray(googleSheetsConnections.id, connectionIds),
          ))
          .returning({ id: googleSheetsConnections.id });
        if (disabledConnections.length !== connectionIds.length) throw new Error('Google Sheets Spend connections changed during disconnect');

        const remainingConnections = activeConnections.filter((connection: any) => !connectionIds.includes(String(connection.id)));
        if (targetConnections.some((connection: any) => connection.isPrimary === true) && !remainingConnections.some((connection: any) => connection.isPrimary === true) && remainingConnections[0]?.id) {
          const [promoted] = await tx
            .update(googleSheetsConnections)
            .set({ isPrimary: true })
            .where(and(
              eq(googleSheetsConnections.id, String(remainingConnections[0].id)),
              eq(googleSheetsConnections.campaignId, campaignId),
              eq(googleSheetsConnections.isActive, true),
            ))
            .returning({ id: googleSheetsConnections.id });
          if (!promoted) throw new Error('Google Sheets primary connection changed during Spend disconnect');
        }
      }
      return { sourceIds, connectionIds };
    });
  }

  async disconnectGa4GoogleAdsSpend(campaignId: string): Promise<{ sourceIds: string[]; connectionRemoved: boolean }> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const candidates = await tx.select({
        id: spendSources.id, displayName: spendSources.displayName, mappingConfig: spendSources.mappingConfig,
      }).from(spendSources).where(and(
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.sourceType, 'ad_platforms'),
        eq(spendSources.isActive, true),
        or(eq(spendSources.platformContext, 'ga4' as any), isNull(spendSources.platformContext)),
      ));
      const targetSources = candidates.filter((source: any) => {
        if (String(source.displayName || '').trim() === 'Google Ads') return true;
        try {
          const mapping = source.mappingConfig ? JSON.parse(String(source.mappingConfig)) : {};
          return String(mapping?.platform || '').trim().toLowerCase() === 'google_ads';
        } catch { return false; }
      });
      if (targetSources.length > 1) {
        throw Object.assign(new Error('Multiple active Google Ads Spend sources require exact removal from Spend Sources'), { code: 'GOOGLE_ADS_SPEND_MULTIPLE_SOURCES' });
      }
      const dedicatedConnections = await tx.select({ id: ga4GoogleAdsSpendConnections.id })
        .from(ga4GoogleAdsSpendConnections).where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId));
      const legacyConnections = await tx.select({ id: googleAdsConnections.id })
        .from(googleAdsConnections).where(and(eq(googleAdsConnections.campaignId, campaignId), eq(googleAdsConnections.spendOnly, true)));
      if (targetSources.length === 0 && dedicatedConnections.length === 0 && legacyConnections.length === 0) {
        throw Object.assign(new Error('No active Google Ads Spend connection found'), { code: 'GOOGLE_ADS_SPEND_CONNECTION_NOT_FOUND' });
      }

      const sourceIds = targetSources.map((source: any) => String(source.id));
      if (sourceIds.length > 0) {
        const disabledSources = await tx.update(spendSources).set({ isActive: false } as any).where(and(
          eq(spendSources.campaignId, campaignId),
          eq(spendSources.sourceType, 'ad_platforms'),
          eq(spendSources.isActive, true),
          or(eq(spendSources.platformContext, 'ga4' as any), isNull(spendSources.platformContext)),
          inArray(spendSources.id, sourceIds),
        )).returning({ id: spendSources.id });
        if (disabledSources.length !== sourceIds.length) throw new Error('Google Ads Spend source changed during disconnect');
        await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), inArray(spendRecords.spendSourceId, sourceIds)));
      }
      if (sourceIds.length > 0 || dedicatedConnections.length > 0) {
        await tx.delete(ga4GoogleAdsSpendDailyMetrics).where(eq(ga4GoogleAdsSpendDailyMetrics.campaignId, campaignId));
      }
      if (dedicatedConnections.length > 0) {
        const removed = await tx.delete(ga4GoogleAdsSpendConnections)
          .where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId)).returning({ id: ga4GoogleAdsSpendConnections.id });
        if (removed.length !== dedicatedConnections.length) throw new Error('Google Ads Spend connection changed during disconnect');
      }
      if (legacyConnections.length > 0) {
        await tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, campaignId));
        const removed = await tx.delete(googleAdsConnections).where(and(
          eq(googleAdsConnections.campaignId, campaignId), eq(googleAdsConnections.spendOnly, true),
        )).returning({ id: googleAdsConnections.id });
        if (removed.length !== legacyConnections.length) throw new Error('Legacy Google Ads Spend connection changed during disconnect');
      }
      return { sourceIds, connectionRemoved: dedicatedConnections.length > 0 || legacyConnections.length > 0 };
    });
  }

  async deleteSpendRecordsBySource(sourceId: string): Promise<boolean> {
    const [target] = await db.select().from(spendSources).where(sql`${spendSources.id}::text = ${sourceId}`);
    const write = async (db: any) => {
    const result = await db
      .delete(spendRecords)
      .where(eq(spendRecords.spendSourceId, sourceId));
    return (result.rowCount || 0) >= 0;
    };
    return target && (!target.platformContext || target.platformContext === 'ga4')
      ? this.writeGA4RefreshInputChange(target.campaignId, write) : write(db);
  }

  async countSpendRecordsBySource(sourceId: string): Promise<number> {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(spendRecords)
      .where(eq(spendRecords.spendSourceId, sourceId));
    return Number((rows[0] as any)?.count || 0);
  }

  async createSpendRecords(records: InsertSpendRecord[]): Promise<SpendRecord[]> {
    if (!records.length) return [];

    // Use onConflictDoNothing for idempotent inserts (auto-refresh scheduler may re-run)
    const sourceIds = Array.from(new Set(records.map(record => record.spendSourceId)));
    const sources = await db.select().from(spendSources).where(inArray(spendSources.id, sourceIds));
    const affected = sources.filter((source: any) => !source.platformContext || source.platformContext === 'ga4').map((source: any) => source.campaignId);
    const write = async (db: any) => {
    const results = await db
      .insert(spendRecords)
      .values(records as any)
      .onConflictDoNothing()
      .returning();

    return results;
    };
    return affected.length ? this.writeGA4RefreshInputChange(affected, write) : write(db);
  }
  async replaceSpendSourceWithRecords(campaignId: string, existingSourceId: string | null, sourceType: string, platformContext: SpendPlatformContext, source: InsertSpendSource, records: Array<Omit<InsertSpendRecord, 'spendSourceId'>>, expectedSourceMappingConfig?: string | null, options: GA4RefreshWriteInput = {}): Promise<SpendSource> {
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || platformContext !== 'ga4' || !existingSourceId || expectedSourceMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      if (sourceType === "connector_derived") {
        const [parent] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
        if (!parent?.ownerId || source.currency !== (parent.currency || "USD") || records.some(r => r.currency !== source.currency)) throw new Error("Spend campaign or currency changed");
      }
      const contextCondition = platformContext === 'ga4'
        ? or(eq(spendSources.platformContext, 'ga4' as any), isNull(spendSources.platformContext))
        : eq(spendSources.platformContext, platformContext as any);
      let savedSource: SpendSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx.update(spendSources).set({ ...source, campaignId, sourceType, platformContext, isActive: true } as any).where(and(
          sql`${spendSources.id}::text = ${existingSourceId}`,
          eq(spendSources.campaignId, campaignId),
          eq(spendSources.sourceType, sourceType),
          eq(spendSources.isActive, true),
          contextCondition,
          expectedSourceMappingConfig === undefined ? undefined : expectedSourceMappingConfig === null ? isNull(spendSources.mappingConfig) : eq(spendSources.mappingConfig, expectedSourceMappingConfig),
        )).returning();
        if (!savedSource) throw Object.assign(new Error(expectedSourceMappingConfig === undefined ? 'Spend source not found' : 'Spend source changed. Refresh and try again.'), { code: expectedSourceMappingConfig === undefined ? 'SPEND_SOURCE_NOT_FOUND' : 'SPEND_SOURCE_CHANGED' });
      } else {
        [savedSource] = await tx.insert(spendSources).values({ ...source, campaignId, sourceType, platformContext, isActive: true } as any).returning();
      }
      if (!savedSource) throw new Error('Failed to save spend source');
      const sourceId = String(savedSource.id);
      await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.spendSourceId, sourceId)));
      if (records.length) await tx.insert(spendRecords).values(records.map((record) => ({ ...record, campaignId, spendSourceId: sourceId, sourceType })) as any);
      return savedSource;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : platformContext === 'ga4' ? this.writeGA4RefreshInputChange(campaignId, save) : db.transaction(save);
  }

  async replaceSpendRecordsForSource(campaignId: string, sourceId: string, sourceType: string, platformContext: SpendPlatformContext, records: Array<Omit<InsertSpendRecord, 'spendSourceId'>>, expectedSourceMappingConfig?: string | null, options: GA4RefreshWriteInput = {}): Promise<void> {
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || platformContext !== 'ga4' || !sourceId || expectedSourceMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(tx, campaignId, options);
      if (options.googleAdsRefresh && (platformContext !== 'ga4' || sourceType !== 'ad_platforms' || sourceId !== options.googleAdsRefresh.source?.id)) throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      const contextCondition = platformContext === "ga4"
        ? or(eq(spendSources.platformContext, "ga4" as any), isNull(spendSources.platformContext))
        : eq(spendSources.platformContext, platformContext as any);
      const [source] = await tx.select({ id: spendSources.id }).from(spendSources).where(and(
        sql`${spendSources.id}::text = ${sourceId}`,
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.sourceType, sourceType),
        eq(spendSources.isActive, true),
        contextCondition,
        expectedSourceMappingConfig === undefined ? undefined : expectedSourceMappingConfig === null ? isNull(spendSources.mappingConfig) : eq(spendSources.mappingConfig, expectedSourceMappingConfig),
      )).limit(1).for("update");
      if (!source) throw new Error("Spend source not found");
      await tx.delete(spendRecords).where(and(eq(spendRecords.campaignId, campaignId), eq(spendRecords.spendSourceId, sourceId)));
      if (records.length) await tx.insert(spendRecords).values(records.map((record) => ({ ...record, campaignId, spendSourceId: sourceId, sourceType })) as any);
      return true;
    };
    await (guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : platformContext === 'ga4' ? this.writeGA4RefreshInputChange(campaignId, save) : db.transaction(save));
  }
  async replaceCsvSpendSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    source: InsertSpendSource,
    records: Array<Omit<InsertSpendRecord, "spendSourceId">>,
  ): Promise<SpendSource> {
    const transaction = !source.platformContext || source.platformContext === 'ga4' ? this.writeGA4RefreshInputChange.bind(this, campaignId) : db.transaction.bind(db);
    return await transaction(async (tx: any) => {
      const platformContext = String((source as any)?.platformContext || "").trim() as SpendPlatformContext;
      let savedSource: SpendSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx
          .update(spendSources)
          .set({ ...source, campaignId, sourceType: "csv" } as any)
          .where(and(
            sql`${spendSources.id}::text = ${existingSourceId}`,
            eq(spendSources.campaignId, campaignId),
            eq(spendSources.sourceType, "csv"),
            eq(spendSources.isActive, true),
            platformContext ? spendPlatformContextPredicate(platformContext) : undefined,
          ))
          .returning();
        if (!savedSource) throw new Error("Spend source not found");
      } else {
        [savedSource] = await tx
          .insert(spendSources)
          .values({ ...source, campaignId, sourceType: "csv", isActive: true } as any)
          .returning();
      }

      if (!savedSource) throw new Error("Failed to save CSV spend source");
      const sourceId = String(savedSource.id);
      await tx.delete(spendRecords).where(and(eq(spendRecords.spendSourceId, sourceId), eq(spendRecords.campaignId, campaignId)));
      await tx.insert(spendRecords).values(records.map((record) => ({
        ...record,
        campaignId,
        spendSourceId: sourceId,
        sourceType: "csv",
      })) as any);

      return savedSource;
    });
  }

  async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext): Promise<{ totalSpend: number; currency?: string; sourceIds: string[] }> {
    // spend_records.date is stored as YYYY-MM-DD; lexicographic compare works.
    const campaign = platformContext === 'ga4' ? await this.getCampaign(campaignId) : null;
    const sourceCreatedThrough = campaign ? getReportingDateEndAt(endDate, (campaign as any)?.reportingTimeZone) : null;
    const rows = await db
      .select({
        spend: spendRecords.spend,
        currency: spendRecords.currency,
        sourceCurrency: spendSources.currency,
        spendSourceId: spendRecords.spendSourceId,
      })
      .from(spendRecords)
      // Cast spend_sources.id to text for compatibility with spend_records.spend_source_id stored as text.
      .innerJoin(spendSources, sql`${spendSources.id}::text = ${spendRecords.spendSourceId}`)
      .where(and(
        eq(spendRecords.campaignId, campaignId),
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.isActive, true),
        spendPlatformContextPredicate(platformContext),
        sourceCreatedThrough ? lte(spendSources.createdAt, sourceCreatedThrough) : undefined,
        sql`${spendRecords.date} >= ${startDate}`,
        sql`${spendRecords.date} <= ${endDate}`
      ));

    let total = 0;
    const sourceIds = new Set<string>();
    const currencies = new Set<string>();
    for (const r of rows as any[]) {
      const v = parseFloat(String((r as any).spendRecords?.spend ?? (r as any).spend ?? "0"));
      if (!Number.isNaN(v)) total += v;
      const sid = String((r as any).spendRecords?.spendSourceId ?? (r as any).spendSourceId);
      if (sid) sourceIds.add(sid);
      for (const cur of [(r as any).spendRecords?.currency ?? (r as any).currency, (r as any).sourceCurrency]) {
        const normalized = String(cur || "").trim().toUpperCase();
        if (normalized) currencies.add(normalized);
      }
    }
    if (currencies.size > 1) throw new Error("Spend source currencies do not match");
    const currency = Array.from(currencies)[0];
    return { totalSpend: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  async getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: SpendPlatformContext): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; spend: number; currency?: string }>> {
    const campaign = platformContext === 'ga4' ? await this.getCampaign(campaignId) : null;
    const sourceCreatedThrough = campaign ? getReportingDateEndAt(endDate, (campaign as any)?.reportingTimeZone) : null;
    const rows = await db
      .select({
        spendSourceId: spendRecords.spendSourceId,
        displayName: spendSources.displayName,
        sourceType: spendSources.sourceType,
        spend: spendRecords.spend,
        currency: spendRecords.currency,
        sourceCurrency: spendSources.currency,
      })
      .from(spendRecords)
      .innerJoin(spendSources, sql`${spendSources.id}::text = ${spendRecords.spendSourceId}`)
      .where(and(
        eq(spendRecords.campaignId, campaignId),
        eq(spendSources.campaignId, campaignId),
        eq(spendSources.isActive, true),
        spendPlatformContextPredicate(platformContext),
        sourceCreatedThrough ? lte(spendSources.createdAt, sourceCreatedThrough) : undefined,
        sql`${spendRecords.date} >= ${startDate}`,
        sql`${spendRecords.date} <= ${endDate}`
      ));

    const totals = new Map<string, { displayName: string; sourceType: string; spend: number; currency?: string }>();
    const currencies = new Set<string>();
    for (const r of rows as any[]) {
      const sid = String(r.spendSourceId ?? r.spendRecords?.spendSourceId);
      const v = parseFloat(String(r.spend ?? r.spendRecords?.spend ?? "0"));
      if (Number.isNaN(v)) continue;
      const existing = totals.get(sid) || {
        displayName: String(r.displayName ?? r.spendSources?.displayName ?? 'Unknown'),
        sourceType: String(r.sourceType ?? r.spendSources?.sourceType ?? 'unknown'),
        spend: 0,
        currency: r.currency ?? r.spendRecords?.currency,
      };
      existing.spend += v;
      totals.set(sid, existing);
      for (const cur of [r.currency ?? r.spendRecords?.currency, r.sourceCurrency]) {
        const normalized = String(cur || "").trim().toUpperCase();
        if (normalized) currencies.add(normalized);
      }
    }
    if (currencies.size > 1) throw new Error("Spend source currencies do not match");

    return Array.from(totals.entries()).map(([sourceId, data]) => ({
      sourceId, displayName: data.displayName, sourceType: data.sourceType,
      spend: Number(data.spend.toFixed(2)), currency: data.currency,
    }));
  }

  // Revenue methods
  private async readGA4RevenuePublication(tx: any, campaignId: string, reportingDate: string): Promise<GA4RevenuePublication> {
    const sources = await tx.select({ id: revenueSources.id, sourceType: revenueSources.sourceType, currency: revenueSources.currency })
      .from(revenueSources).where(and(eq(revenueSources.campaignId, campaignId), eq(revenueSources.isActive, true),
        or(eq(revenueSources.platformContext, 'ga4'), isNull(revenueSources.platformContext)))).orderBy(revenueSources.id);
    const rows = await tx.select({ sourceId: revenueRecords.revenueSourceId, date: revenueRecords.date,
      revenue: revenueRecords.revenue, currency: revenueRecords.currency, externalId: revenueRecords.externalId,
      subCampaignUrn: revenueRecords.subCampaignUrn }).from(revenueRecords)
      .innerJoin(revenueSources, sql`${revenueSources.id}::text = ${revenueRecords.revenueSourceId}`)
      .where(and(eq(revenueRecords.campaignId, campaignId), eq(revenueSources.campaignId, campaignId), eq(revenueSources.isActive, true),
        or(eq(revenueSources.platformContext, 'ga4'), isNull(revenueSources.platformContext))));
    const included = new Map<string, string[]>(), pending = new Set<string>();
    for (const row of rows) {
      if (row.date > reportingDate) { pending.add(row.sourceId); continue; }
      if (row.date < '1900-01-01') continue;
      const values = included.get(row.sourceId) || [];
      // Row IDs and import timestamps change on an identical reimport. Amount,
      // sale date, currency and attribution identify the financial input instead.
      values.push(JSON.stringify([row.date, String(row.revenue), row.currency, row.externalId, row.subCampaignUrn]));
      included.set(row.sourceId, values);
    }
    return { version: 1, reportingDate, sources: Object.fromEntries(sources.map((source: any) => [source.id,
      createHash('sha256').update(JSON.stringify([source.sourceType, source.currency, (included.get(source.id) || []).sort()])).digest('hex'),
    ])), pendingSourceIds: Array.from(pending).sort() };
  }

  async getGA4RevenuePublication(campaignId: string, reportingDate: string): Promise<GA4RevenuePublication> {
    return this.withGA4RefreshTransaction(async tx => {
      await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for('share');
      return this.readGA4RevenuePublication(tx, campaignId, reportingDate);
    });
  }

  async getGA4RevenuePublicationStatus(campaignId: string, reportingDate: string): Promise<GA4RevenuePublicationStatus> {
    return this.withGA4RefreshTransaction(async tx => {
      await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for('share');
      const current = await this.readGA4RevenuePublication(tx, campaignId, reportingDate);
      const [snapshot] = await tx.select().from(metricSnapshots).where(and(eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'financial_daily'), lte(metricSnapshots.reportingDate, reportingDate)))
        .orderBy(desc(metricSnapshots.reportingDate)).limit(1);
      const receipt = snapshot?.metrics?.revenuePublication;
      const [work] = await tx.select().from(ga4RefreshWork).where(and(eq(ga4RefreshWork.campaignId, campaignId),
        sql`${ga4RefreshWork.scopeHash} NOT LIKE 'invalidated:%'`)).orderBy(desc(ga4RefreshWork.dueAt)).limit(1);
      const [receiptWork] = receipt?.workId ? await tx.select({ status: ga4RefreshWork.status }).from(ga4RefreshWork)
        .where(and(eq(ga4RefreshWork.id, receipt.workId), eq(ga4RefreshWork.campaignId, campaignId))) : [];
      const completed = !receipt?.workId || receiptWork?.status === 'completed';
      const failed = work?.status !== 'completed' && (Boolean(work?.lastError) || work?.retryable === false || work?.attemptCount >= 3);
      return Object.fromEntries(Object.entries(current.sources).map(([id, hash]) => {
        const included = receipt?.version === 1 && receipt.reportingDate === reportingDate && receipt.sources?.[id] === hash && completed;
        return [id, { status: included && !current.pendingSourceIds.includes(id) ? 'published' : !included && failed ? 'failed' : 'pending', hash }];
      }));
    });
  }

  async getRevenueSources(campaignId: string, platformContext: RevenuePlatformContext = 'ga4'): Promise<RevenueSource[]> {
    const ctx = platformContext;
    return db.select().from(revenueSources)
      .where(and(
        eq(revenueSources.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        ctx === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, ctx as any)
      ))
      .orderBy(desc(revenueSources.connectedAt));
  }

  async getRevenueSource(campaignId: string, sourceId: string): Promise<RevenueSource | undefined> {
    const [s] = await db.select().from(revenueSources)
      .where(and(sql`${revenueSources.id}::text = ${sourceId}`, eq(revenueSources.campaignId, campaignId), eq(revenueSources.isActive, true)));
    return s || undefined;
  }

  async createRevenueSource(source: InsertRevenueSource): Promise<RevenueSource> {
    const save = async (db: any) => {
    const [s] = await db
      .insert(revenueSources)
      .values({
        ...source,
        isActive: source.isActive !== undefined ? source.isActive : true,
      } as any)
      .returning();
    return s;
    };
    return !source.platformContext || source.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(source.campaignId, save, 0, true) : save(db);
  }

  async updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined> {
    const [target] = await db.select().from(revenueSources).where(sql`${revenueSources.id}::text = ${sourceId}`);
    if (!target) return undefined;
    const save = async (db: any) => {
    const [s] = await db
      .update(revenueSources)
      .set(source as any)
      .where(sql`${revenueSources.id}::text = ${sourceId}`)
      .returning();
    return s || undefined;
    };
    return !target.platformContext || target.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(target.campaignId, save, 0, true) : save(db);
  }

  async deleteRevenueSource(sourceId: string): Promise<boolean> {
    const [target] = await db.select().from(revenueSources).where(sql`${revenueSources.id}::text = ${sourceId}`);
    if (!target) return false;
    const save = async (db: any) => {
    const result = await db
      .update(revenueSources)
      .set({ isActive: false } as any)
      .where(sql`${revenueSources.id}::text = ${sourceId}`);
    return (result.rowCount || 0) > 0;
    };
    return !target.platformContext || target.platformContext === 'ga4' ? this.writeGA4RefreshInputChange(target.campaignId, save, 0, true) : save(db);
  }

  async deleteRevenueRecordsBySource(sourceId: string): Promise<boolean> {
    const [target] = await db.select().from(revenueSources).where(sql`${revenueSources.id}::text = ${sourceId}`);
    const write = async (db: any) => {
    const result = await db
      .delete(revenueRecords)
      .where(eq(revenueRecords.revenueSourceId, sourceId));
    return (result.rowCount || 0) >= 0;
    };
    return target && (!target.platformContext || target.platformContext === 'ga4')
      ? this.writeGA4RefreshInputChange(target.campaignId, write, 0, true) : write(db);
  }

  async deleteRevenueSourceWithRecords(campaignId: string, sourceId: string, platformContext: RevenuePlatformContext): Promise<boolean> {
    const transaction = platformContext === 'ga4' ? (write: (tx: any) => Promise<boolean>) => this.writeGA4RefreshInputChange(campaignId, write, 0, true) : db.transaction.bind(db);
    return await transaction(async (tx: any) => {
      const contextCondition = platformContext === "ga4"
        ? or(eq(revenueSources.platformContext, "ga4" as any), isNull(revenueSources.platformContext))
        : eq(revenueSources.platformContext, platformContext as any);
      const [deletedSource] = await tx
        .update(revenueSources)
        .set({ isActive: false } as any)
        .where(and(
          sql`${revenueSources.id}::text = ${sourceId}`,
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.isActive, true),
          contextCondition,
        ))
        .returning({ id: revenueSources.id });
      if (!deletedSource) return false;
      await tx.delete(revenueRecords).where(and(
        eq(revenueRecords.revenueSourceId, sourceId),
        eq(revenueRecords.campaignId, campaignId),
      ));
      return true;
    });
  }

  async disconnectGa4HubspotRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionId: string }> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const activeSources = await tx
        .select({ id: revenueSources.id, platformContext: revenueSources.platformContext })
        .from(revenueSources)
        .where(and(
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'hubspot'),
          eq(revenueSources.isActive, true),
        ));
      if (activeSources.some((source: any) => String(source.platformContext || 'ga4').toLowerCase() !== 'ga4')) {
        throw Object.assign(new Error('HubSpot is still used by another platform in this campaign'), { code: 'HUBSPOT_CONNECTION_IN_USE' });
      }
      const [connection] = await tx
        .select({ id: hubspotConnections.id })
        .from(hubspotConnections)
        .where(and(eq(hubspotConnections.campaignId, campaignId), eq(hubspotConnections.isActive, true)))
        .orderBy(desc(hubspotConnections.connectedAt))
        .limit(1);
      if (!connection) {
        throw Object.assign(new Error('No active HubSpot connection found'), { code: 'HUBSPOT_CONNECTION_NOT_FOUND' });
      }

      const sourceIds = activeSources.map((source: any) => String(source.id));
      if (sourceIds.length > 0) {
        const disabledSources = await tx
          .update(revenueSources)
          .set({ isActive: false } as any)
          .where(and(
            eq(revenueSources.campaignId, campaignId),
            eq(revenueSources.sourceType, 'hubspot'),
            eq(revenueSources.isActive, true),
            or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
            inArray(revenueSources.id, sourceIds),
          ))
          .returning({ id: revenueSources.id });
        if (disabledSources.length !== sourceIds.length) throw new Error('HubSpot revenue sources changed during disconnect');
        await tx.delete(revenueRecords).where(and(
          eq(revenueRecords.campaignId, campaignId),
          inArray(revenueRecords.revenueSourceId, sourceIds),
        ));
      }

      const [disabledConnection] = await tx
        .update(hubspotConnections)
        .set({ isActive: false })
        .where(and(
          eq(hubspotConnections.id, String(connection.id)),
          eq(hubspotConnections.campaignId, campaignId),
          eq(hubspotConnections.isActive, true),
        ))
        .returning({ id: hubspotConnections.id });
      if (!disabledConnection) throw new Error('HubSpot connection changed during disconnect');
      return { sourceIds, connectionId: String(disabledConnection.id) };
    }, 0, true);
  }

  async disconnectGa4GoogleSheetsRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionIds: string[] }> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const activeSources = await tx
        .select({ id: revenueSources.id, platformContext: revenueSources.platformContext, mappingConfig: revenueSources.mappingConfig })
        .from(revenueSources)
        .where(and(
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'google_sheets'),
          eq(revenueSources.isActive, true),
        ));
      const targetSources = activeSources.filter((source: any) => String(source.platformContext || 'ga4').toLowerCase() === 'ga4');
      const sourceIds = targetSources.map((source: any) => String(source.id));
      const readConnectionId = (source: any): string => {
        try {
          const config = source?.mappingConfig ? JSON.parse(String(source.mappingConfig)) : null;
          return String(config?.connectionId || '').trim();
        } catch {
          return '';
        }
      };
      const mappedConnectionIds = new Set(targetSources.map(readConnectionId).filter(Boolean));
      const sharedRevenueConnectionIds = new Set(activeSources
        .filter((source: any) => String(source.platformContext || 'ga4').toLowerCase() !== 'ga4')
        .map(readConnectionId)
        .filter(Boolean));
      const activeSpendSources = await tx
        .select({ mappingConfig: spendSources.mappingConfig })
        .from(spendSources)
        .where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, true)));
      const sharedSpendConnectionIds = new Set(activeSpendSources.map(readConnectionId).filter(Boolean));
      const activeConnections = await tx
        .select({ id: googleSheetsConnections.id, purpose: googleSheetsConnections.purpose, isPrimary: googleSheetsConnections.isPrimary })
        .from(googleSheetsConnections)
        .where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.isActive, true)));
      const targetConnections = activeConnections.filter((connection: any) => {
        const id = String(connection.id);
        const belongsToGa4Revenue = String(connection.purpose || '').toLowerCase() === 'revenue' || mappedConnectionIds.has(id);
        return belongsToGa4Revenue && !sharedRevenueConnectionIds.has(id) && !sharedSpendConnectionIds.has(id);
      });
      const connectionIds = targetConnections.map((connection: any) => String(connection.id));
      if (sourceIds.length === 0 && connectionIds.length === 0) {
        throw Object.assign(new Error('No active Google Sheets revenue connection found'), { code: 'GOOGLE_SHEETS_CONNECTION_NOT_FOUND' });
      }

      if (sourceIds.length > 0) {
        const disabledSources = await tx
          .update(revenueSources)
          .set({ isActive: false } as any)
          .where(and(
            eq(revenueSources.campaignId, campaignId),
            eq(revenueSources.sourceType, 'google_sheets'),
            eq(revenueSources.isActive, true),
            or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
            inArray(revenueSources.id, sourceIds),
          ))
          .returning({ id: revenueSources.id });
        if (disabledSources.length !== sourceIds.length) throw new Error('Google Sheets revenue sources changed during disconnect');
        await tx.delete(revenueRecords).where(and(
          eq(revenueRecords.campaignId, campaignId),
          inArray(revenueRecords.revenueSourceId, sourceIds),
        ));
      }

      if (connectionIds.length > 0) {
        const disabledConnections = await tx
          .update(googleSheetsConnections)
          .set({ isActive: false, isPrimary: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null } as any)
          .where(and(
            eq(googleSheetsConnections.campaignId, campaignId),
            eq(googleSheetsConnections.isActive, true),
            inArray(googleSheetsConnections.id, connectionIds),
          ))
          .returning({ id: googleSheetsConnections.id });
        if (disabledConnections.length !== connectionIds.length) throw new Error('Google Sheets connections changed during disconnect');

        const remainingConnections = activeConnections.filter((connection: any) => !connectionIds.includes(String(connection.id)));
        if (targetConnections.some((connection: any) => connection.isPrimary === true) && !remainingConnections.some((connection: any) => connection.isPrimary === true) && remainingConnections[0]?.id) {
          const [promoted] = await tx
            .update(googleSheetsConnections)
            .set({ isPrimary: true })
            .where(and(
              eq(googleSheetsConnections.id, String(remainingConnections[0].id)),
              eq(googleSheetsConnections.campaignId, campaignId),
              eq(googleSheetsConnections.isActive, true),
            ))
            .returning({ id: googleSheetsConnections.id });
          if (!promoted) throw new Error('Google Sheets primary connection changed during disconnect');
        }
      }
      return { sourceIds, connectionIds };
    }, 0, true);
  }

  async disconnectGa4ShopifyRevenue(campaignId: string): Promise<{ sourceIds: string[]; connectionId: string }> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const activeSources = await tx
        .select({ id: revenueSources.id, platformContext: revenueSources.platformContext })
        .from(revenueSources)
        .where(and(
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'shopify'),
          eq(revenueSources.isActive, true),
        ));
      if (activeSources.some((source: any) => String(source.platformContext || 'ga4').toLowerCase() !== 'ga4')) {
        throw Object.assign(new Error('Shopify is still used by another platform in this campaign'), { code: 'SHOPIFY_CONNECTION_IN_USE' });
      }
      const [connection] = await tx
        .select({ id: shopifyConnections.id })
        .from(shopifyConnections)
        .where(and(eq(shopifyConnections.campaignId, campaignId), eq(shopifyConnections.isActive, true)))
        .orderBy(desc(shopifyConnections.connectedAt))
        .limit(1);
      if (!connection) {
        throw Object.assign(new Error('No active Shopify connection found'), { code: 'SHOPIFY_CONNECTION_NOT_FOUND' });
      }

      const sourceIds = activeSources.map((source: any) => String(source.id));
      if (sourceIds.length > 0) {
        const disabledSources = await tx
          .update(revenueSources)
          .set({ isActive: false } as any)
          .where(and(
            eq(revenueSources.campaignId, campaignId),
            eq(revenueSources.sourceType, 'shopify'),
            eq(revenueSources.isActive, true),
            or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
            inArray(revenueSources.id, sourceIds),
          ))
          .returning({ id: revenueSources.id });
        if (disabledSources.length !== sourceIds.length) throw new Error('Shopify revenue sources changed during disconnect');
        await tx.delete(revenueRecords).where(and(
          eq(revenueRecords.campaignId, campaignId),
          inArray(revenueRecords.revenueSourceId, sourceIds),
        ));
      }

      const [disabledConnection] = await tx
        .update(shopifyConnections)
        .set({ isActive: false })
        .where(and(
          eq(shopifyConnections.id, String(connection.id)),
          eq(shopifyConnections.campaignId, campaignId),
          eq(shopifyConnections.isActive, true),
        ))
        .returning({ id: shopifyConnections.id });
      if (!disabledConnection) throw new Error('Shopify connection changed during disconnect');
      return { sourceIds, connectionId: String(disabledConnection.id) };
    }, 0, true);
  }

  async cleanupDisconnectedGa4ShopifyRevenue(
    requests: Array<{ campaignId: string; expectedActiveSourceIds: string[]; expectedActiveConnectionIds: string[] }>,
  ): Promise<Array<{ campaignId: string; deactivatedSourceIds: string[]; deactivatedConnectionIds: string[]; deletedRecordIds: string[]; resolvedNotificationIds: string[] }>> {
    if (requests.length === 0) throw new Error('At least one Shopify cleanup campaign is required');
    if (new Set(requests.map((request) => request.campaignId)).size !== requests.length) {
      throw new Error('Duplicate Shopify cleanup campaign');
    }
    return await db.transaction(async (tx: any) => {
      const results = [];
      for (const request of requests) {
        const activeConnections = await tx
          .select({ id: shopifyConnections.id })
          .from(shopifyConnections)
          .where(and(eq(shopifyConnections.campaignId, request.campaignId), eq(shopifyConnections.isActive, true)));
        const activeConnectionIds = activeConnections.map((connection: any) => String(connection.id)).sort();
        const expectedConnectionIds = Array.from(new Set(request.expectedActiveConnectionIds.map(String))).sort();
        if (JSON.stringify(activeConnectionIds) !== JSON.stringify(expectedConnectionIds)) {
          throw Object.assign(new Error('Active Shopify connections changed since cleanup review'), { code: 'SHOPIFY_CLEANUP_CONNECTION_MISMATCH' });
        }

        const campaignSources = await tx
          .select({
            id: revenueSources.id,
            sourceType: revenueSources.sourceType,
            platformContext: revenueSources.platformContext,
            isActive: revenueSources.isActive,
          })
          .from(revenueSources)
          .where(eq(revenueSources.campaignId, request.campaignId));
        const shopifySources = campaignSources.filter((source: any) => String(source.sourceType || '').toLowerCase() === 'shopify');
        if (shopifySources.some((source: any) => source.isActive !== false && String(source.platformContext || 'ga4').toLowerCase() !== 'ga4')) {
          throw Object.assign(new Error('Shopify source is still used by another platform'), { code: 'SHOPIFY_SOURCE_IN_USE' });
        }
        const ga4ShopifySources = shopifySources.filter((source: any) => String(source.platformContext || 'ga4').toLowerCase() === 'ga4');
        const activeSourceIds = ga4ShopifySources
          .filter((source: any) => source.isActive !== false)
          .map((source: any) => String(source.id))
          .sort();
        const expectedSourceIds = Array.from(new Set(request.expectedActiveSourceIds.map(String))).sort();
        if (JSON.stringify(activeSourceIds) !== JSON.stringify(expectedSourceIds)) {
          throw Object.assign(new Error('Active Shopify sources changed since cleanup review'), { code: 'SHOPIFY_CLEANUP_SOURCE_MISMATCH' });
        }

        const campaignRecords = await tx
          .select({
            id: revenueRecords.id,
            revenueSourceId: revenueRecords.revenueSourceId,
            sourceType: revenueRecords.sourceType,
          })
          .from(revenueRecords)
          .where(eq(revenueRecords.campaignId, request.campaignId));
        const sourceById = new Map(campaignSources.map((source: any) => [String(source.id), source]));
        const ga4ShopifySourceIds = new Set(ga4ShopifySources.map((source: any) => String(source.id)));
        const deletedRecordIds = campaignRecords.filter((record: any) => {
          const linkedSourceId = String(record.revenueSourceId || '');
          if (ga4ShopifySourceIds.has(linkedSourceId)) return true;
          if (String(record.sourceType || '').toLowerCase() !== 'shopify') return false;
          const linkedSource: any = sourceById.get(linkedSourceId);
          return !linkedSource || String(linkedSource.sourceType || '').toLowerCase() !== 'shopify';
        }).map((record: any) => String(record.id));

        if (activeSourceIds.length > 0) {
          const deactivated = await tx.update(revenueSources)
            .set({ isActive: false } as any)
            .where(and(
              eq(revenueSources.campaignId, request.campaignId),
              eq(revenueSources.sourceType, 'shopify'),
              eq(revenueSources.isActive, true),
              or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
              inArray(revenueSources.id, activeSourceIds),
            ))
            .returning({ id: revenueSources.id });
          if (deactivated.length !== activeSourceIds.length) throw new Error('Shopify cleanup source deactivation changed');
        }
        if (deletedRecordIds.length > 0) {
          await tx.delete(revenueRecords).where(and(
            eq(revenueRecords.campaignId, request.campaignId),
            inArray(revenueRecords.id, deletedRecordIds),
          ));
        }
        if (activeConnectionIds.length > 0) {
          const deactivatedConnections = await tx.update(shopifyConnections)
            .set({ isActive: false })
            .where(and(
              eq(shopifyConnections.campaignId, request.campaignId),
              eq(shopifyConnections.isActive, true),
              inArray(shopifyConnections.id, activeConnectionIds),
            ))
            .returning({ id: shopifyConnections.id });
          if (deactivatedConnections.length !== activeConnectionIds.length) throw new Error('Shopify cleanup connection deactivation changed');
        }

        const campaignNotifications = await tx.select().from(notifications).where(eq(notifications.campaignId, request.campaignId));
        const resolvedNotificationIds: string[] = [];
        for (const notification of campaignNotifications) {
          let metadata: any = {};
          try { metadata = notification.metadata ? JSON.parse(String(notification.metadata)) : {}; } catch { metadata = {}; }
          if (metadata?.kind !== 'shopify_revenue_refresh_failure'
            || !activeSourceIds.includes(String(metadata?.sourceId || ''))
            || metadata?.resolvedAt
            || metadata?.dismissedAt) continue;
          await tx.update(notifications).set({
            read: true,
            metadata: JSON.stringify({
              ...metadata,
              resolvedAt: new Date().toISOString(),
              resolutionReason: 'disconnected_shopify_test_data_removed',
            }),
          } as any).where(and(eq(notifications.id, String(notification.id)), eq(notifications.campaignId, request.campaignId)));
          resolvedNotificationIds.push(String(notification.id));
        }
        results.push({
          campaignId: request.campaignId,
          deactivatedSourceIds: activeSourceIds,
          deactivatedConnectionIds: activeConnectionIds,
          deletedRecordIds,
          resolvedNotificationIds,
        });
      }
      return results;
    });
  }

  async createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]> {
    if (!records.length) return [];

    // Use onConflictDoNothing for idempotent inserts (auto-refresh scheduler may re-run)
    const sourceIds = Array.from(new Set(records.map(record => record.revenueSourceId)));
    const sources = await db.select().from(revenueSources).where(inArray(revenueSources.id, sourceIds));
    const affected = sources.filter((source: any) => !source.platformContext || source.platformContext === 'ga4').map((source: any) => source.campaignId);
    const write = async (db: any) => {
    const results = await db
      .insert(revenueRecords)
      .values(records as any)
      .onConflictDoNothing()
      .returning();

    return results;
    };
    return affected.length ? this.writeGA4RefreshInputChange(affected, write, 0, true) : write(db);
  }
  async replaceRevenueSourceWithRecords(campaignId: string, existingSourceId: string | null, sourceType: string, platformContext: RevenuePlatformContext, source: InsertRevenueSource, records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>, expectedSourceMappingConfig?: string | null, options: GA4RefreshWriteInput = {}): Promise<RevenueSource> {
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || platformContext !== 'ga4' || !existingSourceId || expectedSourceMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      if (sourceType === 'csv' && platformContext !== 'ga4') {
        const [parent] = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for('update');
        if (!parent) throw new Error('CAMPAIGN_NOT_FOUND');
      }
      const contextCondition = platformContext === 'ga4'
        ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
        : eq(revenueSources.platformContext, platformContext as any);
      let savedSource: RevenueSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx.update(revenueSources).set({ ...source, campaignId, sourceType, platformContext, isActive: true } as any).where(and(
          sql`${revenueSources.id}::text = ${existingSourceId}`,
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, sourceType),
          eq(revenueSources.isActive, true),
          contextCondition,
          expectedSourceMappingConfig === undefined ? undefined : expectedSourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, expectedSourceMappingConfig),
        )).returning();
        if (!savedSource) {
          const error: any = new Error(expectedSourceMappingConfig !== undefined ? 'Revenue source changed. Refresh and try again.' : 'Revenue source not found');
          if (expectedSourceMappingConfig !== undefined) error.code = 'REVENUE_SOURCE_CHANGED';
          throw error;
        }
      } else {
        [savedSource] = await tx.insert(revenueSources).values({ ...source, campaignId, sourceType, platformContext, isActive: true } as any).returning();
      }
      if (!savedSource) throw new Error('Failed to save revenue source');
      const sourceId = String(savedSource.id);
      await tx.delete(revenueRecords).where(and(eq(revenueRecords.campaignId, campaignId), eq(revenueRecords.revenueSourceId, sourceId)));
      if (records.length) await tx.insert(revenueRecords).values(records.map((record) => ({ ...record, campaignId, revenueSourceId: sourceId, sourceType })) as any);
      return savedSource;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : platformContext === 'ga4' ? this.writeGA4RefreshInputChange(campaignId, save, 0, true) : db.transaction(save);
  }

  async replaceGa4SalesforceRevenueSourceWithRecords(campaignId: string, existingSourceId: string | null, connectionId: string, connectionMappingConfig: string, source: InsertRevenueSource, records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>, expectedSourceMappingConfig?: string | null, options: GA4RefreshWriteInput & { expectedConnectionMappingConfig?: string | null } = {}): Promise<RevenueSource> {
    if (!records.length) throw new Error('Salesforce revenue requires at least one materialized record');
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || !existingSourceId || expectedSourceMappingConfig === undefined || options.expectedConnectionMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      const sourceValues = { ...source, campaignId, sourceType: 'salesforce', platformContext: 'ga4', isActive: true } as any;
      let savedSource: RevenueSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx.update(revenueSources).set(sourceValues).where(and(
          sql`${revenueSources.id}::text = ${existingSourceId}`,
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'salesforce'),
          eq(revenueSources.isActive, true),
          or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
          expectedSourceMappingConfig === undefined ? undefined : expectedSourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, expectedSourceMappingConfig),
        )).returning();
        if (!savedSource) {
          const error: any = new Error(expectedSourceMappingConfig !== undefined
            ? 'Salesforce revenue source changed. Refresh and try again.'
            : 'Salesforce revenue source not found');
          if (expectedSourceMappingConfig !== undefined) error.code = 'SALESFORCE_REVENUE_SOURCE_CHANGED';
          throw error;
        }
      } else {
        [savedSource] = await tx.insert(revenueSources).values(sourceValues).returning();
      }
      if (!savedSource) throw new Error('Failed to save Salesforce revenue source');
      const sourceId = String(savedSource.id);
      await tx.delete(revenueRecords).where(and(eq(revenueRecords.campaignId, campaignId), eq(revenueRecords.revenueSourceId, sourceId)));
      if (records.length) await tx.insert(revenueRecords).values(records.map((record) => ({ ...record, campaignId, revenueSourceId: sourceId, sourceType: 'salesforce' })) as any);
      const [savedConnection] = await tx.update(salesforceConnections).set({ mappingConfig: connectionMappingConfig } as any).where(and(
        eq(salesforceConnections.id, connectionId),
        eq(salesforceConnections.campaignId, campaignId),
        eq(salesforceConnections.isActive, true),
        options.expectedConnectionMappingConfig === undefined ? undefined : options.expectedConnectionMappingConfig === null ? isNull(salesforceConnections.mappingConfig) : eq(salesforceConnections.mappingConfig, options.expectedConnectionMappingConfig),
      )).returning({ id: salesforceConnections.id });
      if (!savedConnection) throw new Error('Salesforce connection not found');
      return savedSource;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : this.writeGA4RefreshInputChange(campaignId, save, 0, true);
  }

  async replaceGa4CsvRevenueSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    source: InsertRevenueSource,
    records: Array<Omit<InsertRevenueRecord, "revenueSourceId">>,
    expectedSourceMappingConfig?: string,
  ): Promise<RevenueSource> {
    if (!records.length) throw new Error("No valid revenue records to save");
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const sourceValues = {
        ...source,
        campaignId,
        sourceType: "csv",
        platformContext: "ga4",
        isActive: true,
      } as any;
      let savedSource: RevenueSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx
          .update(revenueSources)
          .set(sourceValues)
          .where(and(
            sql`${revenueSources.id}::text = ${existingSourceId}`,
            eq(revenueSources.campaignId, campaignId),
            eq(revenueSources.sourceType, "csv"),
            eq(revenueSources.isActive, true),
            or(eq(revenueSources.platformContext, "ga4" as any), isNull(revenueSources.platformContext)),
            ...(expectedSourceMappingConfig ? [eq(revenueSources.mappingConfig, expectedSourceMappingConfig)] : []),
          ))
          .returning();
        if (!savedSource) {
          const error: any = new Error(expectedSourceMappingConfig
            ? "CSV revenue source changed. Refresh and try again."
            : "Revenue source not found");
          if (expectedSourceMappingConfig) error.code = "CSV_REVENUE_SOURCE_CHANGED";
          throw error;
        }
      } else {
        [savedSource] = await tx
          .insert(revenueSources)
          .values(sourceValues)
          .returning();
      }

      if (!savedSource) throw new Error("Failed to save CSV revenue source");
      const sourceId = String(savedSource.id);
      await tx.delete(revenueRecords).where(and(
        eq(revenueRecords.revenueSourceId, sourceId),
        eq(revenueRecords.campaignId, campaignId),
      ));
      await tx.insert(revenueRecords).values(records.map((record) => ({
        ...record,
        campaignId,
        revenueSourceId: sourceId,
        sourceType: "csv",
      })) as any);

      return savedSource;
    }, 0, true);
  }

  async replaceGa4HubspotRevenueSourceWithRecords(
    campaignId: string,
    existingSourceId: string | null,
    connectionId: string,
    connectionMappingConfig: string,
    source: InsertRevenueSource,
    records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>,
    expectedSourceMappingConfig?: string | null,
    options: GA4RefreshWriteInput & { expectedConnectionMappingConfig?: string | null } = {},
  ): Promise<RevenueSource> {
    if (!records.length) throw new Error('No HubSpot revenue records to save');
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || !existingSourceId || expectedSourceMappingConfig === undefined || options.expectedConnectionMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      const sourceValues = {
        ...source,
        campaignId,
        sourceType: 'hubspot',
        platformContext: 'ga4',
        isActive: true,
      } as any;
      let savedSource: RevenueSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx
          .update(revenueSources)
          .set(sourceValues)
          .where(and(
            sql`${revenueSources.id}::text = ${existingSourceId}`,
            eq(revenueSources.campaignId, campaignId),
            eq(revenueSources.sourceType, 'hubspot'),
            eq(revenueSources.isActive, true),
            or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
            expectedSourceMappingConfig === undefined ? undefined : expectedSourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, expectedSourceMappingConfig),
          ))
          .returning();
        if (!savedSource) {
          const error: any = new Error(expectedSourceMappingConfig !== undefined
            ? 'HubSpot revenue source changed. Refresh and try again.'
            : 'HubSpot revenue source not found');
          if (expectedSourceMappingConfig !== undefined) error.code = 'HUBSPOT_REVENUE_SOURCE_CHANGED';
          throw error;
        }
      } else {
        [savedSource] = await tx
          .insert(revenueSources)
          .values(sourceValues)
          .returning();
      }

      if (!savedSource) throw new Error('Failed to save HubSpot revenue source');
      const sourceId = String(savedSource.id);
      await tx.delete(revenueRecords).where(and(
        eq(revenueRecords.revenueSourceId, sourceId),
        eq(revenueRecords.campaignId, campaignId),
      ));
      await tx.insert(revenueRecords).values(records.map((record) => ({
        ...record,
        campaignId,
        revenueSourceId: sourceId,
        sourceType: 'hubspot',
      })) as any);

      const [savedConnection] = await tx
        .update(hubspotConnections)
        .set({ mappingConfig: connectionMappingConfig } as any)
        .where(and(
          sql`${hubspotConnections.id}::text = ${connectionId}`,
          eq(hubspotConnections.campaignId, campaignId),
          eq(hubspotConnections.isActive, true),
          options.expectedConnectionMappingConfig === undefined ? undefined : options.expectedConnectionMappingConfig === null ? isNull(hubspotConnections.mappingConfig) : eq(hubspotConnections.mappingConfig, options.expectedConnectionMappingConfig),
        ))
        .returning({ id: hubspotConnections.id });
      if (!savedConnection) throw new Error('HubSpot connection not found');

      return savedSource;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : this.writeGA4RefreshInputChange(campaignId, save, 0, true);
  }

  async disableGa4CrmPipelineProxy(
    campaignId: string,
    sourceId: string,
    sourceType: "salesforce" | "hubspot",
    nextSourceMappingConfig: string,
    expectedSourceMappingConfig: string,
    connectionState?: { connectionId: string; nextMappingConfig: string; expectedMappingConfig: string | null } | null,
  ): Promise<RevenueSource> {
    return await db.transaction(async (tx: any) => {
      const [savedSource] = await tx
        .update(revenueSources)
        .set({ mappingConfig: nextSourceMappingConfig } as any)
        .where(and(
          sql`${revenueSources.id}::text = ${sourceId}`,
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, sourceType),
          eq(revenueSources.isActive, true),
          or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
          eq(revenueSources.mappingConfig, expectedSourceMappingConfig),
        ))
        .returning();
      if (!savedSource) {
        const error: any = new Error(`${sourceType === "salesforce" ? "Salesforce" : "HubSpot"} revenue source changed. Refresh and try again.`);
        error.code = "CRM_PIPELINE_PROXY_SOURCE_CHANGED";
        throw error;
      }

      if (connectionState) {
        const connectionTable = sourceType === "salesforce" ? salesforceConnections : hubspotConnections;
        const expectedConnectionCondition = connectionState.expectedMappingConfig === null
          ? isNull(connectionTable.mappingConfig)
          : eq(connectionTable.mappingConfig, connectionState.expectedMappingConfig);
        const [savedConnection] = await tx
          .update(connectionTable)
          .set({ mappingConfig: connectionState.nextMappingConfig } as any)
          .where(and(
            sql`${connectionTable.id}::text = ${connectionState.connectionId}`,
            eq(connectionTable.campaignId, campaignId),
            eq(connectionTable.isActive, true),
            expectedConnectionCondition,
          ))
          .returning({ id: connectionTable.id });
        if (!savedConnection) {
          const error: any = new Error(`${sourceType === "salesforce" ? "Salesforce" : "HubSpot"} connection changed. Refresh and try again.`);
          error.code = "CRM_PIPELINE_PROXY_CONNECTION_CHANGED";
          throw error;
        }
      }

      return savedSource;
    });
  }

  async replaceGa4ShopifyRevenueSourceWithRecords(campaignId: string, existingSourceId: string | null, connectionId: string, connectionMappingConfig: string, source: InsertRevenueSource, records: Array<Omit<InsertRevenueRecord, 'revenueSourceId'>>, expectedState?: { sourceMappingConfig: string | null; connectionMappingConfig: string | null }, options: GA4RefreshWriteInput = {}): Promise<RevenueSource> {
    if (!records.length) throw new Error('No Shopify revenue records to save');
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || !existingSourceId || expectedState?.sourceMappingConfig === undefined || expectedState?.connectionMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      const sourceValues = { ...source, campaignId, sourceType: 'shopify', platformContext: 'ga4', isActive: true } as any;
      let savedSource: RevenueSource | undefined;
      if (existingSourceId) {
        [savedSource] = await tx.update(revenueSources).set(sourceValues).where(and(
          eq(revenueSources.id, existingSourceId),
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'shopify'),
          eq(revenueSources.isActive, true),
          or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
          expectedState ? (expectedState.sourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, expectedState.sourceMappingConfig)) : undefined,
        )).returning();
        if (!savedSource) throw new Error(expectedState ? 'Shopify revenue source changed since preview' : 'Shopify revenue source not found');
      } else {
        [savedSource] = await tx.insert(revenueSources).values(sourceValues).returning();
      }

      if (!savedSource) throw new Error('Failed to save Shopify revenue source');
      const sourceId = String(savedSource.id);
      await tx.delete(revenueRecords).where(and(
        eq(revenueRecords.revenueSourceId, sourceId),
        eq(revenueRecords.campaignId, campaignId),
      ));
      await tx.insert(revenueRecords).values(records.map((record) => ({
        ...record, campaignId, revenueSourceId: sourceId, sourceType: 'shopify',
      })) as any);

      const [savedConnection] = await tx.update(shopifyConnections)
        .set({ mappingConfig: connectionMappingConfig } as any)
        .where(and(
          eq(shopifyConnections.id, connectionId),
          eq(shopifyConnections.campaignId, campaignId),
          eq(shopifyConnections.isActive, true),
          expectedState ? (expectedState.connectionMappingConfig === null ? isNull(shopifyConnections.mappingConfig) : eq(shopifyConnections.mappingConfig, expectedState.connectionMappingConfig)) : undefined,
        ))
        .returning({ id: shopifyConnections.id });
      if (!savedConnection) throw new Error(expectedState ? 'Shopify connection changed since preview' : 'Shopify connection not found');
      return savedSource;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : this.writeGA4RefreshInputChange(campaignId, save, 0, true);
  }

  async updateGa4ShopifyRevenueSourceRefreshState(campaignId: string, sourceId: string, mappingConfig: string, expectedRunId?: string, options: GA4RefreshWriteInput & { expectedSourceMappingConfig?: string | null } = {}): Promise<RevenueSource | undefined> {
    const guarded = "refreshScope" in options;
    if (guarded && (options.refreshScope?.campaignId !== campaignId || !sourceId || options.expectedSourceMappingConfig === undefined)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    const save = async (tx: any) => {
      const [source] = await tx.update(revenueSources)
        .set({ mappingConfig } as any)
        .where(and(
          sql`${revenueSources.id}::text = ${sourceId}`,
          eq(revenueSources.campaignId, campaignId),
          eq(revenueSources.sourceType, 'shopify'),
          eq(revenueSources.isActive, true),
          or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext)),
          expectedRunId ? sql`${revenueSources.mappingConfig}::jsonb ->> 'lastRefreshRunId' = ${expectedRunId}` : undefined,
          options.expectedSourceMappingConfig === undefined ? undefined : options.expectedSourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, options.expectedSourceMappingConfig),
        ))
        .returning();
      if (guarded && !source) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      return source || undefined;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, save) : this.writeGA4RefreshInputChange(campaignId, save, 0, true);
  }

  async getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext: RevenuePlatformContext = 'ga4'): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }> {
    const campaign = platformContext === 'ga4' ? await this.getCampaign(campaignId) : null;
    const rows = await db
      .select({
        revenue: revenueRecords.revenue,
        currency: revenueRecords.currency,
        revenueSourceId: revenueRecords.revenueSourceId,
        subCampaignUrn: revenueRecords.subCampaignUrn,
        sourceCurrency: revenueSources.currency,
        sourceType: revenueSources.sourceType,
        mappingConfig: revenueSources.mappingConfig,
      })
      .from(revenueRecords)
      .innerJoin(revenueSources, sql`${revenueSources.id}::text = ${revenueRecords.revenueSourceId}`)
      .where(and(
        eq(revenueRecords.campaignId, campaignId),
        eq(revenueSources.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        platformContext === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, platformContext as any),
        sql`${revenueRecords.date} >= ${startDate}`,
        sql`${revenueRecords.date} <= ${endDate}`
      ));

    if (requiresGa4RevenueMaterializationCompleteness(platformContext, startDate, endDate)) {
      const activeSources = await this.getRevenueSources(campaignId, platformContext);
      try {
        assertGa4RevenueMaterializationComplete(activeSources as any[], rows as any[]);
      } catch (error: any) {
        if (error?.code !== 'GA4_REVENUE_MATERIALIZATION_INCOMPLETE') throw error;
        const allMaterializedSources = await this.getRevenueBreakdownBySource(campaignId, '1900-01-01', '2999-12-31', platformContext);
        assertGa4RevenueMaterializationComplete(activeSources as any[], allMaterializedSources as any[]);
      }
    }
    const validatedCurrency = platformContext === 'ga4'
      ? assertGa4RevenueCurrencyIntegrity(rows as any[], (campaign as any)?.currency || 'USD')
      : undefined;

    const totalsBySource = new Map<string, { aggregate: number; subCampaign: number; hasAggregate: boolean }>();
    const sourceIds = new Set<string>();
    const currencies = new Set<string>();
    let currency: string | undefined = validatedCurrency;
    for (const r of rows as any[]) {
      const v = parseFloat(String((r as any).revenueRecords?.revenue ?? (r as any).revenue ?? "0"));
      if (Number.isNaN(v)) continue;
      const sid = String((r as any).revenueRecords?.revenueSourceId ?? (r as any).revenueSourceId);
      if (sid) sourceIds.add(sid);
      const existing = totalsBySource.get(sid) || { aggregate: 0, subCampaign: 0, hasAggregate: false };
      if ((r as any).subCampaignUrn ?? (r as any).revenueRecords?.subCampaignUrn) existing.subCampaign += v;
      else { existing.aggregate += v; existing.hasAggregate = true; }
      totalsBySource.set(sid, existing);
      for (const cur of [(r as any).revenueRecords?.currency ?? (r as any).currency, (r as any).sourceCurrency]) {
        const normalized = String(cur || "").trim().toUpperCase();
        if (normalized) currencies.add(normalized);
      }
    }
    if (platformContext !== 'ga4') {
      if (currencies.size > 1) throw new Error("Imported revenue source currencies do not match");
      currency = Array.from(currencies)[0];
    }
    const total = Array.from(totalsBySource.values()).reduce(
      (sum, item) => sum + selectMaterializedRevenueTotal(item.aggregate, item.subCampaign, item.hasAggregate),
      0,
    );
    return { totalRevenue: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  async getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext: RevenuePlatformContext = 'ga4'): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number; currency?: string }>> {
    const campaign = platformContext === 'ga4' ? await this.getCampaign(campaignId) : null;
    const rows = await db
      .select({
        revenueSourceId: revenueRecords.revenueSourceId,
        displayName: revenueSources.displayName,
        sourceType: revenueSources.sourceType,
        revenue: revenueRecords.revenue,
        currency: revenueRecords.currency,
        subCampaignUrn: revenueRecords.subCampaignUrn,
        sourceCurrency: revenueSources.currency,
        mappingConfig: revenueSources.mappingConfig,
      })
      .from(revenueRecords)
      .innerJoin(revenueSources, sql`${revenueSources.id}::text = ${revenueRecords.revenueSourceId}`)
      .where(and(
        eq(revenueRecords.campaignId, campaignId),
        eq(revenueSources.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        platformContext === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, platformContext as any),
        sql`${revenueRecords.date} >= ${startDate}`,
        sql`${revenueRecords.date} <= ${endDate}`
      ));

    if (platformContext === 'ga4') {
      assertGa4RevenueCurrencyIntegrity(rows as any[], (campaign as any)?.currency || 'USD');
    }

    const totals = new Map<string, { displayName: string; sourceType: string; aggregate: number; subCampaign: number; hasAggregate: boolean; currency?: string }>();
    const currencies = new Set<string>();
    for (const r of rows as any[]) {
      const sid = String(r.revenueSourceId ?? r.revenueRecords?.revenueSourceId);
      const v = parseFloat(String(r.revenue ?? r.revenueRecords?.revenue ?? "0"));
      if (Number.isNaN(v)) continue;
      const existing = totals.get(sid) || {
        displayName: String(r.displayName ?? r.revenueSources?.displayName ?? 'Unknown'),
        sourceType: String(r.sourceType ?? r.revenueSources?.sourceType ?? 'unknown'),
        aggregate: 0,
        subCampaign: 0,
        hasAggregate: false,
        currency: r.currency ?? r.revenueRecords?.currency,
      };
      if (r.subCampaignUrn ?? r.revenueRecords?.subCampaignUrn) existing.subCampaign += v;
      else { existing.aggregate += v; existing.hasAggregate = true; }
      totals.set(sid, existing);
      for (const cur of [r.currency ?? r.revenueRecords?.currency, r.sourceCurrency]) {
        const normalized = String(cur || "").trim().toUpperCase();
        if (normalized) currencies.add(normalized);
      }
    }
    if (currencies.size > 1) throw new Error("Imported revenue source currencies do not match");

    return Array.from(totals.entries()).map(([sourceId, data]) => ({
      sourceId, displayName: data.displayName, sourceType: data.sourceType,
      revenue: Number(selectMaterializedRevenueTotal(data.aggregate, data.subCampaign, data.hasAggregate).toFixed(2)), currency: data.currency,
    }));
  }

  // Google Sheets Connection methods
  async getGoogleSheetsConnections(campaignId: string, purpose?: string, options: GA4RefreshWriteInput & { migrateLegacyTokens?: boolean; resolveRuntimeCredentials?: boolean } = {}): Promise<GoogleSheetsConnection[]> {
    try {
      const purposeCol = (googleSheetsConnections as any).purpose;
      const purposeFilter = purpose
        ? (purpose === "spend"
          ? or(eq(purposeCol, "spend"), isNull(purposeCol))
          : eq(purposeCol, purpose))
        : undefined;

      const rows = await db.select({
        id: googleSheetsConnections.id,
        campaignId: googleSheetsConnections.campaignId,
        spreadsheetId: googleSheetsConnections.spreadsheetId,
        spreadsheetName: googleSheetsConnections.spreadsheetName,
        sheetName: googleSheetsConnections.sheetName,
        purpose: (googleSheetsConnections as any).purpose,
        method: (googleSheetsConnections as any).method,
        accessToken: googleSheetsConnections.accessToken,
        refreshToken: googleSheetsConnections.refreshToken,
        clientId: googleSheetsConnections.clientId,
        clientSecret: googleSheetsConnections.clientSecret,
        encryptedTokens: (googleSheetsConnections as any).encryptedTokens,
        expiresAt: googleSheetsConnections.expiresAt,
        isPrimary: googleSheetsConnections.isPrimary,
        isActive: googleSheetsConnections.isActive,
        columnMappings: googleSheetsConnections.columnMappings,
        cachedData: (googleSheetsConnections as any).cachedData,
        lastDataRefreshAt: (googleSheetsConnections as any).lastDataRefreshAt,
        connectedAt: googleSheetsConnections.connectedAt,
        createdAt: googleSheetsConnections.createdAt,
      }).from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isActive, true),
          ...(purposeFilter ? [purposeFilter] : [])
        ))
        .orderBy(googleSheetsConnections.connectedAt);
      // Lazy backfill: encrypt legacy plaintext tokens.
      await Promise.all(
        rows.map(async (r: any) => {
          const hasPlain = Boolean(r?.accessToken) || Boolean(r?.refreshToken) || Boolean(r?.clientSecret);
          const hasEnc = Boolean(r?.encryptedTokens);
          if (options.migrateLegacyTokens === false || "refreshScope" in options || !hasPlain || hasEnc || !r?.id) return;
          try {
            const nextEnc = buildEncryptedTokens({
              accessToken: r.accessToken,
              refreshToken: r.refreshToken,
              clientSecret: r.clientSecret,
            });
            await db
              .update(googleSheetsConnections)
              .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
              .where(and(eq(googleSheetsConnections.id, String(r.id)), isNull(googleSheetsConnections.encryptedTokens),
                sql`${googleSheetsConnections.accessToken} IS NOT DISTINCT FROM ${r.accessToken ?? null}`,
                sql`${googleSheetsConnections.refreshToken} IS NOT DISTINCT FROM ${r.refreshToken ?? null}`,
                sql`${googleSheetsConnections.clientSecret} IS NOT DISTINCT FROM ${r.clientSecret ?? null}`));
          } catch {
            // ignore
          }
        })
      );

      return await Promise.all(rows.map(async (r: any) => (
        options.resolveRuntimeCredentials === false ? hydrateDecryptedTokens(r) : hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(r) as any)
      ))) as any;
    } catch (error: any) {
      // If sheet_name/purpose column doesn't exist yet, use raw SQL query
      if (error.message?.includes('sheet_name') || error.message?.includes('purpose') || error.message?.includes('column') || error.code === '42703') {
        devLog('[Storage] sheet_name/purpose column not found, using fallback query');
        const result = await db.execute(sql`
          SELECT id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, encrypted_tokens,
                 client_id, client_secret, expires_at, is_primary, is_active, column_mappings, 
                 connected_at, created_at
          FROM google_sheets_connections
          WHERE campaign_id = ${campaignId} AND is_active = true
          ORDER BY connected_at
        `);
        // Map raw results to GoogleSheetsConnection format
        const all = result.rows.map((row: any) => hydrateDecryptedTokens({
          id: row.id,
          campaignId: row.campaign_id,
          spreadsheetId: row.spreadsheet_id,
          spreadsheetName: row.spreadsheet_name,
          sheetName: null, // Column doesn't exist yet
          purpose: null,
          method: "access_token",
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          clientId: row.client_id,
          clientSecret: row.client_secret,
          encryptedTokens: row.encrypted_tokens,
          expiresAt: row.expires_at,
          isPrimary: row.is_primary,
          isActive: row.is_active,
          columnMappings: row.column_mappings,
          cachedData: null,
          lastDataRefreshAt: null,
          connectedAt: row.connected_at,
          createdAt: row.created_at
        })) as GoogleSheetsConnection[];

        if (!purpose) return all;
        if (purpose === 'spend') return all; // legacy connections treated as spend
        return []; // purpose-specific filtering isn't possible without the column
      }
      throw error;
    }
  }

  async getGoogleSheetsConnection(campaignId: string, spreadsheetId?: string): Promise<GoogleSheetsConnection | undefined> {
    try {
      if (spreadsheetId) {
        const [connection] = await db.select().from(googleSheetsConnections)
          .where(and(
            eq(googleSheetsConnections.campaignId, campaignId),
            eq(googleSheetsConnections.spreadsheetId, spreadsheetId),
            eq(googleSheetsConnections.isActive, true)
          ));
        return connection
          ? await hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(connection) as any) as any
          : undefined;
      }

      // Return the primary connection if no spreadsheetId specified
      const [primary] = await db.select().from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isPrimary, true),
          eq(googleSheetsConnections.isActive, true)
        ));

      if (primary) return await hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(primary) as any) as any;

      // Fallback to first active connection if no primary
      const [first] = await db.select().from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isActive, true)
        ))
        .limit(1);

      return first
        ? await hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(first) as any) as any
        : undefined;
    } catch (error: any) {
      // If sheet_name column doesn't exist yet, use raw SQL query
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
        devLog('[Storage] sheet_name column not found, using fallback query for getGoogleSheetsConnection');
        let query;
        if (spreadsheetId) {
          query = sql`
            SELECT id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, encrypted_tokens,
                   client_id, client_secret, expires_at, is_primary, is_active, column_mappings, 
                   connected_at, created_at
            FROM google_sheets_connections
            WHERE campaign_id = ${campaignId} AND spreadsheet_id = ${spreadsheetId} AND is_active = true
            LIMIT 1
          `;
        } else {
          // Try primary first
          query = sql`
            SELECT id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, encrypted_tokens,
                   client_id, client_secret, expires_at, is_primary, is_active, column_mappings, 
                   connected_at, created_at
            FROM google_sheets_connections
            WHERE campaign_id = ${campaignId} AND is_primary = true AND is_active = true
            LIMIT 1
          `;
        }
        const result = await db.execute(query);
        if (result.rows.length === 0 && !spreadsheetId) {
          // Fallback to first active
          const fallbackResult = await db.execute(sql`
            SELECT id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, encrypted_tokens,
                   client_id, client_secret, expires_at, is_primary, is_active, column_mappings, 
                   connected_at, created_at
            FROM google_sheets_connections
            WHERE campaign_id = ${campaignId} AND is_active = true
            LIMIT 1
          `);
          if (fallbackResult.rows.length === 0) return undefined;
          const row = fallbackResult.rows[0] as any;
          return hydrateDecryptedTokens({
            id: row.id,
            campaignId: row.campaign_id,
            spreadsheetId: row.spreadsheet_id,
            spreadsheetName: row.spreadsheet_name,
            sheetName: null,
            accessToken: row.access_token,
            refreshToken: row.refresh_token,
            clientId: row.client_id,
            clientSecret: row.client_secret,
            encryptedTokens: row.encrypted_tokens,
            expiresAt: row.expires_at,
            isPrimary: row.is_primary,
            isActive: row.is_active,
            columnMappings: row.column_mappings,
            connectedAt: row.connected_at,
            createdAt: row.created_at
          } as any) as any;
        }
        if (result.rows.length === 0) return undefined;
        const row = result.rows[0] as any;
        return hydrateDecryptedTokens({
          id: row.id,
          campaignId: row.campaign_id,
          spreadsheetId: row.spreadsheet_id,
          spreadsheetName: row.spreadsheet_name,
          sheetName: null,
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          clientId: row.client_id,
          clientSecret: row.client_secret,
          encryptedTokens: row.encrypted_tokens,
          expiresAt: row.expires_at,
          isPrimary: row.is_primary,
          isActive: row.is_active,
          columnMappings: row.column_mappings,
          connectedAt: row.connected_at,
          createdAt: row.created_at
        } as any) as any;
      }
      throw error;
    }
  }

  async getPrimaryGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined> {
    try {
      const [primary] = await db.select().from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isPrimary, true),
          eq(googleSheetsConnections.isActive, true)
        ));
      return primary
        ? await hydrateGoogleSheetsConnectionForRead(primary as any) as any
        : undefined;
    } catch (error: any) {
      // If sheet_name column doesn't exist yet, use raw SQL query
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
        devLog('[Storage] sheet_name column not found, using fallback query for getPrimaryGoogleSheetsConnection');
        const result = await db.execute(sql`
          SELECT id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, 
                 client_id, client_secret, expires_at, is_primary, is_active, column_mappings, 
                 connected_at, created_at
          FROM google_sheets_connections
          WHERE campaign_id = ${campaignId} AND is_primary = true AND is_active = true
          LIMIT 1
        `);
        if (result.rows.length === 0) return undefined;
        const row = result.rows[0] as any;
        return {
          id: row.id,
          campaignId: row.campaign_id,
          spreadsheetId: row.spreadsheet_id,
          spreadsheetName: row.spreadsheet_name,
          sheetName: null,
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          clientId: row.client_id,
          clientSecret: row.client_secret,
          expiresAt: row.expires_at,
          isPrimary: row.is_primary,
          isActive: row.is_active,
          columnMappings: row.column_mappings,
          connectedAt: row.connected_at,
          createdAt: row.created_at
        } as GoogleSheetsConnection;
      }
      throw error;
    }
  }

  async createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection> {
    // Check if this is the first connection for this campaign - make it primary
    const existingConnections = await this.getGoogleSheetsConnections(connection.campaignId);
    const isPrimary = existingConnections.length === 0;

    const method = String((connection as any).method || "access_token").trim().toLowerCase();
    const isServiceAccount = method === GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD;

    const saved = await this.writeGA4RefreshInputChange(connection.campaignId, async db => {
    await db.execute(sql`SAVEPOINT sheets_connection_create`);
    try {
      // Try to insert - Drizzle will include all fields from schema, which may fail if sheet_name doesn't exist
      const enc = buildEncryptedTokens({
        accessToken: isServiceAccount ? null : (connection as any).accessToken,
        refreshToken: isServiceAccount ? null : (connection as any).refreshToken,
        clientSecret: isServiceAccount ? null : (connection as any).clientSecret,
      });

      const [sheetsConnection] = await db
        .insert(googleSheetsConnections)
        .values({
          ...connection,
          method,
          accessToken: null,
          refreshToken: null,
          clientId: isServiceAccount ? null : (connection as any).clientId,
          clientSecret: null,
          encryptedTokens: enc,
          isPrimary: isPrimary,
          isActive: true
        })
        .returning();
      return sheetsConnection;
    } catch (error: any) {
      // If sheet_name column doesn't exist yet, use raw SQL insert
      if (error.message?.includes('sheet_name') || error.message?.includes('purpose') || error.message?.includes('column') || error.code === '42703') {
        await db.execute(sql`ROLLBACK TO SAVEPOINT sheets_connection_create`);
        if (isServiceAccount) throw new Error('Google Sheets service-account storage migration is required');
        devLog('[Storage] sheet_name/purpose column not found, using fallback insert for createGoogleSheetsConnection');
        const enc = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
        });
        const result = await db.execute(sql`
          INSERT INTO google_sheets_connections (
            campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token,
            client_id, client_secret, encrypted_tokens, expires_at, is_primary, is_active, column_mappings,
            connected_at, created_at
          )
          VALUES (
            ${connection.campaignId}, ${connection.spreadsheetId}, ${connection.spreadsheetName || null},
            ${null}, ${null},
            ${connection.clientId || null}, ${null},
            ${JSON.stringify(enc)}::jsonb,
            ${connection.expiresAt || null}, ${isPrimary}, true,
            ${(connection as any).columnMappings || null},
            CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          )
          RETURNING id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token,
                    client_id, client_secret, encrypted_tokens, expires_at, is_primary, is_active, column_mappings,
                    connected_at, created_at
        `);
        const row = result.rows[0] as any;
        return hydrateDecryptedTokens({
          id: row.id,
          campaignId: row.campaign_id,
          spreadsheetId: row.spreadsheet_id,
          spreadsheetName: row.spreadsheet_name,
          sheetName: null, // Column doesn't exist yet
          purpose: null,
          method: "access_token",
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          clientId: row.client_id,
          clientSecret: row.client_secret,
          encryptedTokens: row.encrypted_tokens,
          expiresAt: row.expires_at,
          isPrimary: row.is_primary,
          isActive: row.is_active,
          columnMappings: row.column_mappings,
          connectedAt: row.connected_at,
          createdAt: row.created_at
        } as any) as any;
      }
      throw error;
    }
    });
    return await hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(saved) as any) as any;
  }

  async updateGoogleSheetsConnection(connectionId: string, connection: Partial<InsertGoogleSheetsConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<GoogleSheetsConnection | undefined> {
    const guarded = "refreshScope" in options;
    const cacheWrite = (connection as any).cachedData?.complete === true;
    const write = async (db: any) => {
    if (!guarded) await db.execute(sql`SAVEPOINT sheets_connection_update`);
    try {
      const existingQuery = db.select().from(googleSheetsConnections).where(eq(googleSheetsConnections.id, connectionId));
    const [existing] = await (guarded || cacheWrite ? existingQuery.for("update") : existingQuery);
      if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;
    if (cacheWrite) {
      const expected = options.expectedConnection;
      const cache = (connection as any).cachedData;
      const currentTokens = hydrateDecryptedTokens(existing as any);
      const started = Date.parse(cache.readStartedAt);
      const previous = Date.parse((existing as any).cachedData?.readStartedAt || "");
      if (!expected || existing.isActive === false || expected.id !== existing.id || !Number.isFinite(started)
        || ["campaignId", "spreadsheetId", "sheetName", "purpose", "method", "clientId"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))
        || ["accessToken", "refreshToken", "clientSecret"].some(field => (currentTokens[field] ?? null) !== (expected[field] ?? null))
        || cache.spreadsheetId !== existing.spreadsheetId || cache.sheetName !== existing.sheetName
        || (Number.isFinite(previous) && previous > started)) throw new Error("GOOGLE_SHEETS_CACHE_INPUT_CHANGED");
    }
      const method = String((connection as any).method || (existing as any).method || "access_token").trim().toLowerCase();
      const isServiceAccount = method === GOOGLE_SHEETS_SERVICE_ACCOUNT_METHOD;

      // Build the set object with explicit field mapping for columnMappings
      const setData: any = {};
      if (connection.spreadsheetId !== undefined) setData.spreadsheetId = connection.spreadsheetId;
      if (connection.spreadsheetName !== undefined) setData.spreadsheetName = connection.spreadsheetName;
      if ((connection as any).sheetName !== undefined) setData.sheetName = (connection as any).sheetName;
      if ((connection as any).purpose !== undefined) setData.purpose = (connection as any).purpose;
      if ((connection as any).method !== undefined) setData.method = method;
      const tokenFieldsProvided =
        Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
        Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
        Object.prototype.hasOwnProperty.call(connection, "clientSecret");

      if (isServiceAccount) {
        setData.encryptedTokens = buildEncryptedTokens({ accessToken: null, refreshToken: null, clientSecret: null });
        setData.accessToken = null;
        setData.refreshToken = null;
        setData.clientId = null;
        setData.clientSecret = null;
      } else if (tokenFieldsProvided || (existing as any).encryptedTokens) {
        setData.encryptedTokens = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
          prev: (existing as any).encryptedTokens || (guarded ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
        });
        setData.accessToken = null;
        setData.refreshToken = null;
        setData.clientSecret = null;
      }
      if (!isServiceAccount && connection.clientId !== undefined) setData.clientId = connection.clientId;
      if (connection.expiresAt !== undefined) setData.expiresAt = connection.expiresAt;
      if (connection.isPrimary !== undefined) setData.isPrimary = connection.isPrimary;
      if (connection.isActive !== undefined) setData.isActive = connection.isActive;
      // CRITICAL: Explicitly include columnMappings
      if ((connection as any).columnMappings !== undefined) {
        setData.columnMappings = (connection as any).columnMappings;
      }
      if ((connection as any).cachedData !== undefined) {
        setData.cachedData = (connection as any).cachedData;
      }
      if ((connection as any).lastDataRefreshAt !== undefined) {
        setData.lastDataRefreshAt = (connection as any).lastDataRefreshAt;
      }

      const [updated] = await db
        .update(googleSheetsConnections)
        .set(setData)
        .where(eq(googleSheetsConnections.id, connectionId))
        .returning({
          id: googleSheetsConnections.id,
          campaignId: googleSheetsConnections.campaignId,
          spreadsheetId: googleSheetsConnections.spreadsheetId,
          spreadsheetName: googleSheetsConnections.spreadsheetName,
          sheetName: googleSheetsConnections.sheetName,
          purpose: (googleSheetsConnections as any).purpose,
          method: (googleSheetsConnections as any).method,
          accessToken: googleSheetsConnections.accessToken,
          refreshToken: googleSheetsConnections.refreshToken,
          clientId: googleSheetsConnections.clientId,
          clientSecret: googleSheetsConnections.clientSecret,
          encryptedTokens: (googleSheetsConnections as any).encryptedTokens,
          expiresAt: googleSheetsConnections.expiresAt,
          isPrimary: googleSheetsConnections.isPrimary,
          isActive: googleSheetsConnections.isActive,
          columnMappings: googleSheetsConnections.columnMappings,
          cachedData: (googleSheetsConnections as any).cachedData,
          lastDataRefreshAt: (googleSheetsConnections as any).lastDataRefreshAt,
          connectedAt: googleSheetsConnections.connectedAt,
          createdAt: googleSheetsConnections.createdAt,
        });
      return updated;
    } catch (error: any) {
      if (cacheWrite) throw error;
      if (guarded) throw error;
      // If sheet_name column doesn't exist yet, use raw SQL update
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
        await db.execute(sql`ROLLBACK TO SAVEPOINT sheets_connection_update`);
        devLog('[Storage] sheet_name column not found, using fallback update for updateGoogleSheetsConnection');
        // Build update query without sheet_name
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (connection.spreadsheetId !== undefined) {
          updates.push(`spreadsheet_id = $${paramIndex++}`);
          values.push(connection.spreadsheetId);
        }
        if (connection.spreadsheetName !== undefined) {
          updates.push(`spreadsheet_name = $${paramIndex++}`);
          values.push(connection.spreadsheetName);
        }
        if (connection.accessToken !== undefined) {
          updates.push(`access_token = $${paramIndex++}`);
          values.push(connection.accessToken);
        }
        if (connection.refreshToken !== undefined) {
          updates.push(`refresh_token = $${paramIndex++}`);
          values.push(connection.refreshToken);
        }
        if (connection.clientId !== undefined) {
          updates.push(`client_id = $${paramIndex++}`);
          values.push(connection.clientId);
        }
        if (connection.clientSecret !== undefined) {
          updates.push(`client_secret = $${paramIndex++}`);
          values.push(connection.clientSecret);
        }
        if (connection.expiresAt !== undefined) {
          updates.push(`expires_at = $${paramIndex++}`);
          values.push(connection.expiresAt);
        }
        if ((connection as any).columnMappings !== undefined) {
          updates.push(`column_mappings = $${paramIndex++}`);
          values.push((connection as any).columnMappings);
        }
        if ((connection as any).cachedData !== undefined && !String(error.message || "").includes('cached_data')) {
          updates.push(`cached_data = $${paramIndex++}::jsonb`);
          values.push((connection as any).cachedData === null ? null : JSON.stringify((connection as any).cachedData));
        }
        if ((connection as any).lastDataRefreshAt !== undefined && !String(error.message || "").includes('last_data_refresh_at')) {
          updates.push(`last_data_refresh_at = $${paramIndex++}`);
          values.push((connection as any).lastDataRefreshAt);
        }
        if (connection.isPrimary !== undefined) {
          updates.push(`is_primary = $${paramIndex++}`);
          values.push(connection.isPrimary);
        }
        if (connection.isActive !== undefined) {
          updates.push(`is_active = $${paramIndex++}`);
          values.push(connection.isActive);
        }

        if (updates.length === 0) {
          // No updates to make, just fetch the connection
          const [conn] = await db.select().from(googleSheetsConnections)
            .where(eq(googleSheetsConnections.id, connectionId))
            .limit(1);
          if (!conn) return undefined;
          // Map to include sheetName as null
          return { ...conn, sheetName: null } as GoogleSheetsConnection;
        }

        // Keep the legacy fallback on the same transaction and parameterize every value.
        const updateClause = updates.join(', ');
        values.push(connectionId);
        const queryText = `UPDATE google_sheets_connections SET ${updateClause} WHERE id = $${paramIndex} RETURNING id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, client_id, client_secret, expires_at, is_primary, is_active, column_mappings, connected_at, created_at`;

        const result = await db.execute(sql.join(queryText.split(/\$(\d+)/g).map((part, index) =>
          index % 2 ? sql`${values[Number(part) - 1]}` : sql.raw(part)), sql.raw('')));

        if (result.rows.length === 0) return undefined;
        const row = result.rows[0] as any;
        return {
          id: row.id,
          campaignId: row.campaign_id,
          spreadsheetId: row.spreadsheet_id,
          spreadsheetName: row.spreadsheet_name,
          sheetName: null,
          accessToken: row.access_token,
          refreshToken: row.refresh_token,
          clientId: row.client_id,
          clientSecret: row.client_secret,
          expiresAt: row.expires_at,
          isPrimary: row.is_primary,
          isActive: row.is_active,
          columnMappings: row.column_mappings,
          connectedAt: row.connected_at,
          createdAt: row.created_at
        } as GoogleSheetsConnection;
      }
      throw error;
    }
    };
    const [target] = guarded ? [] : await db.select({ campaignId: googleSheetsConnections.campaignId }).from(googleSheetsConnections).where(eq(googleSheetsConnections.id, connectionId));
    const saved = guarded ? await this.writeWithGA4RefreshOwnership(options.refreshScope, write)
      : target ? await this.writeGA4RefreshInputChange(target.campaignId, write) : undefined;
    return saved ? await hydrateGoogleSheetsConnectionForRead(hydrateDecryptedTokens(saved) as any) as any : undefined;
  }

  async setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    const [targetConnection] = await db
      .select({ id: googleSheetsConnections.id })
      .from(googleSheetsConnections)
      .where(and(
        eq(googleSheetsConnections.id, connectionId),
        eq(googleSheetsConnections.campaignId, campaignId),
        eq(googleSheetsConnections.isActive, true)
      ))
      .limit(1);

    if (!targetConnection) return false;

    // First, set all connections for this campaign to non-primary
    await db
      .update(googleSheetsConnections)
      .set({ isPrimary: false })
      .where(eq(googleSheetsConnections.campaignId, campaignId));

    // Then set the specified connection as primary
    const result = await db
      .update(googleSheetsConnections)
      .set({ isPrimary: true })
      .where(and(
        eq(googleSheetsConnections.id, connectionId),
        eq(googleSheetsConnections.campaignId, campaignId)
      ));

    return (result.rowCount || 0) > 0;
    });
  }

  async deleteGoogleSheetsConnection(connectionId: string): Promise<boolean> {
    const [target] = await db.select({ campaignId: googleSheetsConnections.campaignId }).from(googleSheetsConnections).where(eq(googleSheetsConnections.id, connectionId));
    if (!target) return false;
    return this.writeGA4RefreshInputChange(target.campaignId, async db => {
    await db.execute(sql`SAVEPOINT sheets_connection_delete`);
    try {
      const connection = await db.select().from(googleSheetsConnections)
        .where(eq(googleSheetsConnections.id, connectionId))
        .limit(1);

      if (connection.length === 0) return false;

      const wasPrimary = connection[0].isPrimary;
      const campaignId = connection[0].campaignId;

      // Soft delete by setting isActive to false
      await db
        .update(googleSheetsConnections)
        .set({ isActive: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null } as any)
        .where(eq(googleSheetsConnections.id, connectionId));

      // If this was the primary connection, make the first remaining connection primary
      if (wasPrimary) {
        const remainingConnections = await db.select({ id: googleSheetsConnections.id }).from(googleSheetsConnections)
          .where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.isActive, true))).orderBy(googleSheetsConnections.connectedAt);
        if (remainingConnections.length > 0) {
          await db.update(googleSheetsConnections).set({ isPrimary: false }).where(eq(googleSheetsConnections.campaignId, campaignId));
          await db.update(googleSheetsConnections).set({ isPrimary: true }).where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.id, remainingConnections[0].id)));
        }
      }

      return true;
    } catch (error: any) {
      // Fallback if sheet_name column doesn't exist
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
        await db.execute(sql`ROLLBACK TO SAVEPOINT sheets_connection_delete`);
        devLog('[Storage] sheet_name column not found, using fallback query for deleteGoogleSheetsConnection');
        try {
          // First, get connection info using raw SQL
          const selectResult = await db.execute(sql`
            SELECT id, campaign_id, is_primary
            FROM google_sheets_connections
            WHERE id = ${connectionId} AND is_active = true
            LIMIT 1
          `);

          if (selectResult.rows.length === 0) return false;

          const row = selectResult.rows[0] as any;
          const wasPrimary = row.is_primary;
          const campaignId = row.campaign_id;

          // Soft delete using raw SQL
          await db.execute(sql`
            UPDATE google_sheets_connections
            SET is_active = false
            WHERE id = ${connectionId}
          `);

          // If this was the primary connection, make the first remaining connection primary
          if (wasPrimary) {
            const remainingConnections = await db.select({ id: googleSheetsConnections.id }).from(googleSheetsConnections)
              .where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.isActive, true))).orderBy(googleSheetsConnections.connectedAt);
            if (remainingConnections.length > 0) {
              await db.update(googleSheetsConnections).set({ isPrimary: false }).where(eq(googleSheetsConnections.campaignId, campaignId));
              await db.update(googleSheetsConnections).set({ isPrimary: true }).where(and(eq(googleSheetsConnections.campaignId, campaignId), eq(googleSheetsConnections.id, remainingConnections[0].id)));
            }
          }

          return true;
        } catch (fallbackError: any) {
          console.error('[Storage] Fallback delete also failed:', fallbackError);
          throw fallbackError;
        }
      }
      throw error;
    }
    });
  }

  // HubSpot Connection methods
  async getHubspotConnections(campaignId: string): Promise<HubspotConnection[]> {
    const rows = await db
      .select()
      .from(hubspotConnections)
      .where(and(eq(hubspotConnections.campaignId, campaignId), eq(hubspotConnections.isActive, true)))
      .orderBy(hubspotConnections.connectedAt);
    await Promise.all(
      rows.map(async (r: any) => {
        const hasPlain = Boolean(r?.accessToken) || Boolean(r?.refreshToken) || Boolean(r?.clientSecret);
        const hasEnc = Boolean(r?.encryptedTokens);
        if (!hasPlain || hasEnc || !r?.id) return;
        try {
          const nextEnc = buildEncryptedTokens({
            accessToken: r.accessToken,
            refreshToken: r.refreshToken,
            clientSecret: r.clientSecret,
          });
          await db
            .update(hubspotConnections)
            .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
            .where(and(eq(hubspotConnections.id, String(r.id)), isNull(hubspotConnections.encryptedTokens),
              sql`${hubspotConnections.accessToken} IS NOT DISTINCT FROM ${r.accessToken ?? null}`,
              sql`${hubspotConnections.refreshToken} IS NOT DISTINCT FROM ${r.refreshToken ?? null}`,
              sql`${hubspotConnections.clientSecret} IS NOT DISTINCT FROM ${r.clientSecret ?? null}`));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getHubspotConnection(campaignId: string, options: GA4RefreshWriteInput = {}): Promise<HubspotConnection | undefined> {
    const [latest] = await db
      .select()
      .from(hubspotConnections)
      .where(and(eq(hubspotConnections.campaignId, campaignId), eq(hubspotConnections.isActive, true)))
      .orderBy(desc(hubspotConnections.connectedAt))
      .limit(1);
    if (!latest) return undefined;
    const hydrated = hydrateDecryptedTokens(latest) as any;
    const hasPlain = Boolean((latest as any).accessToken) || Boolean((latest as any).refreshToken) || Boolean((latest as any).clientSecret);
    const hasEnc = Boolean((latest as any).encryptedTokens);
    if (!("refreshScope" in options) && hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (latest as any).accessToken,
          refreshToken: (latest as any).refreshToken,
          clientSecret: (latest as any).clientSecret,
        });
        await db
          .update(hubspotConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(and(eq(hubspotConnections.id, latest.id), isNull(hubspotConnections.encryptedTokens),
            sql`${hubspotConnections.accessToken} IS NOT DISTINCT FROM ${latest.accessToken ?? null}`,
            sql`${hubspotConnections.refreshToken} IS NOT DISTINCT FROM ${latest.refreshToken ?? null}`,
            sql`${hubspotConnections.clientSecret} IS NOT DISTINCT FROM ${latest.clientSecret ?? null}`));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createHubspotConnection(connection: InsertHubspotConnection): Promise<HubspotConnection> {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });
    const connectionData: any = {
      ...connection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      clientId: connection.clientId || null,
      clientSecret: null,
      accessToken: null,
      refreshToken: null,
      encryptedTokens: enc as any,
    };
    const [created] = await this.writeGA4RefreshInputChange<HubspotConnection[]>(connection.campaignId, tx => tx.insert(hubspotConnections).values(connectionData).returning());
    return hydrateDecryptedTokens(created) as any;
  }

  async updateHubspotConnection(connectionId: string, connection: Partial<InsertHubspotConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<HubspotConnection | undefined> {
    const guarded = "refreshScope" in options;
    const write = async (db: any) => {
    const existingQuery = db.select().from(hubspotConnections).where(eq(hubspotConnections.id, connectionId));
    const [existing] = await (guarded ? existingQuery.for("update") : existingQuery);
    if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
      Object.prototype.hasOwnProperty.call(connection, "clientSecret");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens || (guarded ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
      });
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }

    const [updated] = await db
      .update(hubspotConnections)
      .set(setObj)
      .where(eq(hubspotConnections.id, connectionId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(options.refreshScope, write);
    const [target] = await db.select({ campaignId: hubspotConnections.campaignId }).from(hubspotConnections).where(eq(hubspotConnections.id, connectionId));
    return target ? this.writeGA4RefreshInputChange(target.campaignId, write) : undefined;
  }

  async deleteHubspotConnection(connectionId: string): Promise<boolean> {
    const [target] = await db.select({ campaignId: hubspotConnections.campaignId }).from(hubspotConnections).where(eq(hubspotConnections.id, connectionId));
    if (!target) return false;
    return this.writeGA4RefreshInputChange(target.campaignId, async db => {
    const result = await db
      .update(hubspotConnections)
      .set({ isActive: false })
      .where(eq(hubspotConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
    });
  }

  // Salesforce Connection methods
  async getSalesforceConnections(campaignId: string): Promise<SalesforceConnection[]> {
    const rows = await db
      .select()
      .from(salesforceConnections)
      .where(and(eq(salesforceConnections.campaignId, campaignId), eq(salesforceConnections.isActive, true)))
      .orderBy(salesforceConnections.connectedAt);
    await Promise.all(
      rows.map(async (r: any) => {
        const hasPlain = Boolean(r?.accessToken) || Boolean(r?.refreshToken) || Boolean(r?.clientSecret);
        const hasEnc = Boolean(r?.encryptedTokens);
        if (!hasPlain || hasEnc || !r?.id) return;
        try {
          const nextEnc = buildEncryptedTokens({
            accessToken: r.accessToken,
            refreshToken: r.refreshToken,
            clientSecret: r.clientSecret,
          });
          await db
            .update(salesforceConnections)
            .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
            .where(and(eq(salesforceConnections.id, String(r.id)), isNull(salesforceConnections.encryptedTokens),
              sql`${salesforceConnections.accessToken} IS NOT DISTINCT FROM ${r.accessToken ?? null}`,
              sql`${salesforceConnections.refreshToken} IS NOT DISTINCT FROM ${r.refreshToken ?? null}`,
              sql`${salesforceConnections.clientSecret} IS NOT DISTINCT FROM ${r.clientSecret ?? null}`));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getSalesforceConnection(campaignId: string, options: GA4RefreshWriteInput = {}): Promise<SalesforceConnection | undefined> {
    const [latest] = await db
      .select()
      .from(salesforceConnections)
      .where(and(eq(salesforceConnections.campaignId, campaignId), eq(salesforceConnections.isActive, true)))
      .orderBy(desc(salesforceConnections.connectedAt))
      .limit(1);
    if (!latest) return undefined;
    const hydrated = hydrateDecryptedTokens(latest) as any;
    const hasPlain = Boolean((latest as any).accessToken) || Boolean((latest as any).refreshToken) || Boolean((latest as any).clientSecret);
    const hasEnc = Boolean((latest as any).encryptedTokens);
    if (!("refreshScope" in options) && hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (latest as any).accessToken,
          refreshToken: (latest as any).refreshToken,
          clientSecret: (latest as any).clientSecret,
        });
        await db
          .update(salesforceConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(and(eq(salesforceConnections.id, latest.id), isNull(salesforceConnections.encryptedTokens),
            sql`${salesforceConnections.accessToken} IS NOT DISTINCT FROM ${latest.accessToken ?? null}`,
            sql`${salesforceConnections.refreshToken} IS NOT DISTINCT FROM ${latest.refreshToken ?? null}`,
            sql`${salesforceConnections.clientSecret} IS NOT DISTINCT FROM ${latest.clientSecret ?? null}`));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createSalesforceConnection(connection: InsertSalesforceConnection): Promise<SalesforceConnection> {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });
    const connectionData: any = {
      ...connection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      clientId: connection.clientId || null,
      clientSecret: null,
      accessToken: null,
      refreshToken: null,
      encryptedTokens: enc as any,
    };
    const [created] = await this.writeGA4RefreshInputChange<SalesforceConnection[]>(connection.campaignId, tx => tx.insert(salesforceConnections).values(connectionData).returning());
    return hydrateDecryptedTokens(created) as any;
  }

  async updateSalesforceConnection(connectionId: string, connection: Partial<InsertSalesforceConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<SalesforceConnection | undefined> {
    const guarded = "refreshScope" in options;
    const write = async (db: any) => {
    const existingQuery = db.select().from(salesforceConnections).where(eq(salesforceConnections.id, connectionId));
    const [existing] = await (guarded ? existingQuery.for("update") : existingQuery);
    if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
      Object.prototype.hasOwnProperty.call(connection, "clientSecret");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens || (guarded ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
      });
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }

    const [updated] = await db
      .update(salesforceConnections)
      .set(setObj)
      .where(eq(salesforceConnections.id, connectionId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(options.refreshScope, write);
    const [target] = await db.select({ campaignId: salesforceConnections.campaignId }).from(salesforceConnections).where(eq(salesforceConnections.id, connectionId));
    return target ? this.writeGA4RefreshInputChange(target.campaignId, write) : undefined;
  }

  async deleteSalesforceConnection(connectionId: string): Promise<boolean> {
    const [target] = await db.select({ campaignId: salesforceConnections.campaignId }).from(salesforceConnections).where(eq(salesforceConnections.id, connectionId));
    if (!target) return false;
    return this.writeGA4RefreshInputChange(target.campaignId, async db => {
    const result = await db
      .update(salesforceConnections)
      .set({ isActive: false })
      .where(eq(salesforceConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
    });
  }

  // Shopify Connection methods
  async getShopifyConnections(campaignId: string): Promise<ShopifyConnection[]> {
    assertProductionTokenEncryptionConfigured();
    const rows = await db
      .select()
      .from(shopifyConnections)
      .where(and(eq(shopifyConnections.campaignId, campaignId), eq(shopifyConnections.isActive, true)))
      .orderBy(shopifyConnections.connectedAt);
    await Promise.all(
      rows.map(async (r: any) => {
        const hasPlain = Boolean(r?.accessToken);
        const hasEnc = Boolean(r?.encryptedTokens);
        if (!hasPlain || hasEnc || !r?.id) return;
        try {
          const nextEnc = buildEncryptedTokens({ accessToken: r.accessToken });
          await db
            .update(shopifyConnections)
            .set({ encryptedTokens: nextEnc as any, accessToken: null } as any)
            .where(and(eq(shopifyConnections.id, String(r.id)), isNull(shopifyConnections.encryptedTokens),
              sql`${shopifyConnections.accessToken} IS NOT DISTINCT FROM ${r.accessToken ?? null}`));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getShopifyConnection(campaignId: string, options: GA4RefreshWriteInput = {}): Promise<ShopifyConnection | undefined> {
    assertProductionTokenEncryptionConfigured();
    const [latest] = await db
      .select()
      .from(shopifyConnections)
      .where(and(eq(shopifyConnections.campaignId, campaignId), eq(shopifyConnections.isActive, true)))
      .orderBy(desc(shopifyConnections.connectedAt))
      .limit(1);
    if (!latest) return undefined;
    const hydrated = hydrateDecryptedTokens(latest) as any;
    const hasPlain = Boolean((latest as any).accessToken);
    const hasEnc = Boolean((latest as any).encryptedTokens);
    if (!("refreshScope" in options) && hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({ accessToken: (latest as any).accessToken });
        await db
          .update(shopifyConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null } as any)
          .where(and(eq(shopifyConnections.id, latest.id), isNull(shopifyConnections.encryptedTokens),
            sql`${shopifyConnections.accessToken} IS NOT DISTINCT FROM ${latest.accessToken ?? null}`));
      } catch {
        // ignore
      }
    }
    if ("refreshScope" in options) return hydrated; // Owned work must use this campaign's exact persisted connection.
    let targetConfig: any = {};
    try { targetConfig = hydrated.mappingConfig ? JSON.parse(String(hydrated.mappingConfig)) : {}; } catch { targetConfig = {}; }
    if (String(targetConfig.authType || '').toLowerCase() !== 'oauth') return hydrated;

    const [targetCampaign] = await db
      .select({ ownerId: campaigns.ownerId })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!targetCampaign?.ownerId) return hydrated;
    const ownerCampaigns = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.ownerId, targetCampaign.ownerId));
    const ownerCampaignIds = ownerCampaigns.map((campaign: any) => String(campaign.id)).filter(Boolean);
    if (ownerCampaignIds.length === 0) return hydrated;
    const peerRows = await db
      .select()
      .from(shopifyConnections)
      .where(and(
        inArray(shopifyConnections.campaignId, ownerCampaignIds),
        sql`lower(${shopifyConnections.shopDomain}) = ${String(latest.shopDomain || '').trim().toLowerCase()}`,
        eq(shopifyConnections.isActive, true),
      ));
    const peers = peerRows.flatMap((row: any) => {
      try { return [hydrateDecryptedTokens(row) as any]; } catch { return []; }
    });
    return resolveNewestShopifyOauthCredential(hydrated, peers) as any;
  }

  async createShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection> {
    assertProductionTokenEncryptionConfigured();
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
    });
    const connectionData: any = {
      ...connection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      shopName: connection.shopName || null,
      accessToken: null,
      encryptedTokens: enc as any,
      mappingConfig: connection.mappingConfig || null,
    };
    delete connectionData.refreshToken;
    const [created] = await this.writeGA4RefreshInputChange<ShopifyConnection[]>(connection.campaignId, tx => tx.insert(shopifyConnections).values(connectionData).returning());
    return hydrateDecryptedTokens(created) as any;
  }

  async replaceShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection> {
    assertProductionTokenEncryptionConfigured();
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
    });
    const connectionData: any = {
      ...connection,
      isActive: true,
      shopName: connection.shopName || null,
      accessToken: null,
      encryptedTokens: enc as any,
      mappingConfig: connection.mappingConfig || null,
    };
    delete connectionData.refreshToken;
    return await this.writeGA4RefreshInputChange(connection.campaignId, async (tx: any) => {
      const activeSources = await tx
        .select({ id: revenueSources.id })
        .from(revenueSources)
        .where(and(
          eq(revenueSources.campaignId, connection.campaignId),
          eq(revenueSources.sourceType, 'shopify'),
          eq(revenueSources.isActive, true),
        ));
      if (activeSources.length > 0) {
        const activeConnections = await tx
          .select({ shopDomain: shopifyConnections.shopDomain })
          .from(shopifyConnections)
          .where(and(
            eq(shopifyConnections.campaignId, connection.campaignId),
            eq(shopifyConnections.isActive, true),
          ));
        const currentDomain = activeConnections.length === 1
          ? String(activeConnections[0]?.shopDomain || '').trim().toLowerCase()
          : '';
        const replacementDomain = String(connection.shopDomain || '').trim().toLowerCase();
        if (!currentDomain || currentDomain !== replacementDomain) {
          throw Object.assign(
            new Error('Disconnect the active Shopify revenue source before changing stores'),
            { code: 'SHOPIFY_ACTIVE_SOURCE_STORE_CHANGE' },
          );
        }
      }
      await tx
        .update(shopifyConnections)
        .set({ isActive: false } as any)
        .where(and(eq(shopifyConnections.campaignId, connection.campaignId), eq(shopifyConnections.isActive, true)));
      const [created] = await tx.insert(shopifyConnections).values(connectionData).returning();
      return hydrateDecryptedTokens(created) as any;
    });
  }

  async updateShopifyConnection(connectionId: string, connection: Partial<InsertShopifyConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<ShopifyConnection | undefined> {
    const guarded = "refreshScope" in options;
    const write = async (db: any) => {
    assertProductionTokenEncryptionConfigured();
    const existingQuery = db.select().from(shopifyConnections).where(eq(shopifyConnections.id, connectionId));
    const [existing] = await (guarded ? existingQuery.for("update") : existingQuery);
    if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;

    const tokenProvided = Object.prototype.hasOwnProperty.call(connection, "accessToken");
    const refreshTokenProvided = Object.prototype.hasOwnProperty.call(connection, "refreshToken");
    const setObj: any = { ...connection };
    if (tokenProvided || refreshTokenProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        prev: (existing as any).encryptedTokens || (guarded ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
      } as any);
      setObj.accessToken = null;
    }
    delete setObj.refreshToken;

    const [updated] = await db
      .update(shopifyConnections)
      .set(setObj)
      .where(eq(shopifyConnections.id, connectionId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(options.refreshScope, write);
    const [target] = await db.select({ campaignId: shopifyConnections.campaignId }).from(shopifyConnections).where(eq(shopifyConnections.id, connectionId));
    return target ? this.writeGA4RefreshInputChange(target.campaignId, write) : undefined;
  }

  async deleteShopifyConnection(connectionId: string): Promise<boolean> {
    const [target] = await db.select({ campaignId: shopifyConnections.campaignId }).from(shopifyConnections).where(eq(shopifyConnections.id, connectionId));
    if (!target) return false;
    return this.writeGA4RefreshInputChange(target.campaignId, async db => {
    const result = await db
      .update(shopifyConnections)
      .set({ isActive: false })
      .where(eq(shopifyConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
    });
  }

  async withShopifyOauthStoreLock<T>(shopDomain: string, operation: () => Promise<T>): Promise<T> {
    const normalizedShop = normalizeShopifyDomain(shopDomain);
    if (!normalizedShop) throw new Error('Shopify OAuth store lock requires a shop domain');
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`shopify_oauth:${normalizedShop}`}, 0))`);
      return await operation();
    });
  }

  // LinkedIn Connection methods
  async getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined> {
    const [connection] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.campaignId, campaignId));
    if (!connection) return undefined;

    const hydrated = hydrateDecryptedTokens(connection) as any;

    // Lazy backfill: encrypt legacy plaintext tokens and clear them.
    const hasPlain =
      Boolean((connection as any).accessToken) ||
      Boolean((connection as any).refreshToken) ||
      Boolean((connection as any).clientSecret);
    const hasEnc = Boolean((connection as any).encryptedTokens);
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
        });
        await db
          .update(linkedinConnections)
          .set({
            encryptedTokens: nextEnc as any,
            accessToken: null,
            refreshToken: null,
            clientSecret: null,
          } as any)
          .where(and(eq(linkedinConnections.id, connection.id), isNull(linkedinConnections.encryptedTokens),
            sql`${linkedinConnections.accessToken} IS NOT DISTINCT FROM ${connection.accessToken ?? null}`,
            sql`${linkedinConnections.refreshToken} IS NOT DISTINCT FROM ${connection.refreshToken ?? null}`,
            sql`${linkedinConnections.clientSecret} IS NOT DISTINCT FROM ${connection.clientSecret ?? null}`));
      } catch {
        // ignore
      }
    }

    return hydrated;
  }

  async createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection> {
    return this.writeGA4RefreshInputChange(connection.campaignId, async db => {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });
    const [linkedinConnection] = await db
      .insert(linkedinConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        clientSecret: null,
        encryptedTokens: enc as any,
      } as any)
      .returning();
    return hydrateDecryptedTokens(linkedinConnection) as any;
    });
  }

  async updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    const [existing] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.campaignId, campaignId));
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
      Object.prototype.hasOwnProperty.call(connection, "clientSecret");

    const setObj: any = { ...connection };
    delete setObj.campaignId;
    delete setObj.id;
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens,
      });
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }

    const [updated] = await db
      .update(linkedinConnections)
      .set(setObj)
      .where(eq(linkedinConnections.campaignId, campaignId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    });
  }

  async deleteLinkedInConnection(campaignId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    const result = await db
      .delete(linkedinConnections)
      .where(eq(linkedinConnections.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
    });
  }

  async deleteLinkedInCampaignAnalytics(campaignId: string): Promise<boolean> {
    await db.transaction(async (tx: any) => {
      const isLinkedInTaggedConfig = (raw: any): boolean => {
        if (!raw) return false;
        try {
          const cfg = typeof raw === "string" ? JSON.parse(raw) : raw;
          return String(cfg?.platformContext || cfg?.platform || "").trim().toLowerCase() === "linkedin";
        } catch {
          return false;
        }
      };
      const isLinkedInRevenueSheet = (conn: any): boolean => {
        const purpose = String(conn?.purpose || "").trim().toLowerCase();
        if (purpose === "linkedin_revenue") return true;
        if (purpose !== "general") return false;
        try {
          const platforms = conn?.platforms ? (typeof conn.platforms === "string" ? JSON.parse(conn.platforms) : conn.platforms) : [];
          const mappings = conn?.columnMappings ? (typeof conn.columnMappings === "string" ? JSON.parse(conn.columnMappings) : conn.columnMappings) : [];
          const hasLinkedIn = Array.isArray(platforms) && platforms.some((p: any) => String(p).trim().toLowerCase() === "linkedin");
          const hasRevenue = Array.isArray(mappings) && mappings.some((m: any) => ["revenue", "conversion_value"].includes(String(m?.targetFieldId || m?.platformField || "").trim().toLowerCase()));
          return hasLinkedIn && hasRevenue;
        } catch {
          return false;
        }
      };

      const sessions = await tx
        .select({ id: linkedinImportSessions.id })
        .from(linkedinImportSessions)
        .where(eq(linkedinImportSessions.campaignId, campaignId));
      const sessionIds = sessions.map((s: any) => String(s.id));
      if (sessionIds.length > 0) {
        await tx.delete(linkedinImportMetrics).where(inArray(linkedinImportMetrics.sessionId, sessionIds));
        await tx.delete(linkedinAdPerformance).where(inArray(linkedinAdPerformance.sessionId, sessionIds));
        await tx.delete(linkedinImportSessions).where(inArray(linkedinImportSessions.id, sessionIds));
      }

      await tx.delete(linkedinDailyMetrics).where(eq(linkedinDailyMetrics.campaignId, campaignId));

      const linkedInSpendSources = await tx
        .select({ id: spendSources.id })
        .from(spendSources)
        .where(and(
          eq(spendSources.campaignId, campaignId),
          or(eq(spendSources.sourceType, "linkedin_api"), sql`lower(${spendSources.displayName}) like '%linkedin%'`)
        ));
      for (const source of linkedInSpendSources) {
        const sourceId = String((source as any).id);
        await tx.delete(spendRecords).where(eq(spendRecords.spendSourceId, sourceId));
        await tx.update(spendSources).set({ isActive: false } as any).where(sql`${spendSources.id}::text = ${sourceId}`);
      }

      const linkedInRevenueSources = await tx
        .select({ id: revenueSources.id, platformContext: revenueSources.platformContext, mappingConfig: revenueSources.mappingConfig })
        .from(revenueSources)
        .where(eq(revenueSources.campaignId, campaignId));
      for (const source of linkedInRevenueSources.filter((s: any) =>
        String(s?.platformContext || "").trim().toLowerCase() === "linkedin" || isLinkedInTaggedConfig(s?.mappingConfig)
      )) {
        const sourceId = String((source as any).id);
        await tx.delete(revenueRecords).where(eq(revenueRecords.revenueSourceId, sourceId));
        await tx.update(revenueSources).set({ isActive: false } as any).where(sql`${revenueSources.id}::text = ${sourceId}`);
      }

      const sheets = await tx
        .select({ id: googleSheetsConnections.id, purpose: googleSheetsConnections.purpose, platforms: googleSheetsConnections.platforms, columnMappings: googleSheetsConnections.columnMappings })
        .from(googleSheetsConnections)
        .where(eq(googleSheetsConnections.campaignId, campaignId));
      for (const sheet of sheets.filter(isLinkedInRevenueSheet)) {
        await tx.update(googleSheetsConnections)
          .set({ isActive: false, columnMappings: null } as any)
          .where(sql`${googleSheetsConnections.id}::text = ${String((sheet as any).id)}`);
      }

      const hubspot = await tx.select({ id: hubspotConnections.id, mappingConfig: hubspotConnections.mappingConfig }).from(hubspotConnections).where(eq(hubspotConnections.campaignId, campaignId));
      for (const conn of hubspot.filter((c: any) => isLinkedInTaggedConfig(c?.mappingConfig))) {
        await tx.update(hubspotConnections).set({ mappingConfig: null } as any).where(sql`${hubspotConnections.id}::text = ${String((conn as any).id)}`);
      }
      const salesforce = await tx.select({ id: salesforceConnections.id, mappingConfig: salesforceConnections.mappingConfig }).from(salesforceConnections).where(eq(salesforceConnections.campaignId, campaignId));
      for (const conn of salesforce.filter((c: any) => isLinkedInTaggedConfig(c?.mappingConfig))) {
        await tx.update(salesforceConnections).set({ mappingConfig: null } as any).where(sql`${salesforceConnections.id}::text = ${String((conn as any).id)}`);
      }
      const shopify = await tx.select({ id: shopifyConnections.id, mappingConfig: shopifyConnections.mappingConfig }).from(shopifyConnections).where(eq(shopifyConnections.campaignId, campaignId));
      for (const conn of shopify.filter((c: any) => isLinkedInTaggedConfig(c?.mappingConfig))) {
        await tx.update(shopifyConnections).set({ mappingConfig: null } as any).where(sql`${shopifyConnections.id}::text = ${String((conn as any).id)}`);
      }
    });
    return true;
  }

  // Meta Connection methods
  async getMetaConnection(campaignId: string): Promise<MetaConnection | undefined> {
    const [connection] = await db.select().from(metaConnections).where(eq(metaConnections.campaignId, campaignId));
    if (!connection) return undefined;
    const hydrated = hydrateDecryptedTokens(connection) as any;
    const hasPlain = Boolean((connection as any).accessToken) || Boolean((connection as any).refreshToken);
    const hasEnc = Boolean((connection as any).encryptedTokens);
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
        } as any);
        await db
          .update(metaConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null } as any)
          .where(and(eq(metaConnections.id, connection.id), isNull(metaConnections.encryptedTokens),
            sql`${metaConnections.accessToken} IS NOT DISTINCT FROM ${connection.accessToken ?? null}`,
            sql`${metaConnections.refreshToken} IS NOT DISTINCT FROM ${connection.refreshToken ?? null}`));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createMetaConnection(connection: InsertMetaConnection): Promise<MetaConnection> {
    return this.writeGA4RefreshInputChange(connection.campaignId, async db => {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
    } as any);
    const [metaConnection] = await db
      .insert(metaConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        encryptedTokens: enc as any,
      } as any)
      .returning();
    return hydrateDecryptedTokens(metaConnection) as any;
    });
  }

  async updateMetaConnection(campaignId: string, connection: Partial<InsertMetaConnection>): Promise<MetaConnection | undefined> {
    return this.writeGA4RefreshInputChange([campaignId, ...(connection.campaignId ? [connection.campaignId] : [])], async db => {
    const [existing] = await db.select().from(metaConnections).where(eq(metaConnections.campaignId, campaignId));
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        prev: (existing as any).encryptedTokens,
      } as any);
      setObj.accessToken = null;
      setObj.refreshToken = null;
    }

    const [updated] = await db
      .update(metaConnections)
      .set(setObj)
      .where(eq(metaConnections.campaignId, campaignId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    });
  }

  async deleteMetaConnection(campaignId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    return await db.transaction(async (tx: any) => {
      const [existing] = await tx
        .select({ campaignId: metaConnections.campaignId })
        .from(metaConnections)
        .where(eq(metaConnections.campaignId, campaignId))
        .limit(1);
      if (!existing) return false;

      await tx.delete(metaDailyMetrics).where(eq(metaDailyMetrics.campaignId, campaignId));
      await tx.delete(spendRecords).where(
        and(
          eq(spendRecords.campaignId, campaignId),
          or(
            eq(spendRecords.spendSourceId, 'meta_daily_metrics'),
            eq(spendRecords.sourceType, 'meta_api')
          )
        )
      );
      const result = await tx
        .delete(metaConnections)
        .where(eq(metaConnections.campaignId, campaignId));
      return (result.rowCount || 0) > 0;
    });
    });
  }

  // Instagram Connection methods
  async getInstagramConnection(campaignId: string): Promise<InstagramConnection | undefined> {
    const [connection] = await db.select().from(instagramConnections).where(eq(instagramConnections.campaignId, campaignId));
    if (!connection) return undefined;
    return hydrateDecryptedTokens(connection) as any;
  }

  async createInstagramConnection(connection: InsertInstagramConnection): Promise<InstagramConnection> {
    return this.writeGA4RefreshInputChange(connection.campaignId, async db => {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
    } as any);
    const [instagramConnection] = await db
      .insert(instagramConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        encryptedTokens: enc as any,
      } as any)
      .returning();
    return hydrateDecryptedTokens(instagramConnection) as any;
    });
  }

  async updateInstagramConnection(campaignId: string, connection: Partial<InsertInstagramConnection>): Promise<InstagramConnection | undefined> {
    return this.writeGA4RefreshInputChange([campaignId, ...(connection.campaignId ? [connection.campaignId] : [])], async db => {
    const [existing] = await db.select().from(instagramConnections).where(eq(instagramConnections.campaignId, campaignId));
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        prev: (existing as any).encryptedTokens,
      } as any);
      setObj.accessToken = null;
      setObj.refreshToken = null;
    }

    const [updated] = await db
      .update(instagramConnections)
      .set(setObj)
      .where(eq(instagramConnections.campaignId, campaignId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    });
  }

  async deleteInstagramConnection(campaignId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    return await db.transaction(async (tx: any) => {
      await deleteInstagramFinancialDataForCampaign(tx, campaignId);
      const result = await tx
        .delete(instagramConnections)
        .where(eq(instagramConnections.campaignId, campaignId));
      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        await tx.delete(instagramDailyMetrics).where(eq(instagramDailyMetrics.campaignId, campaignId));
      }
      return deleted;
    });
    });
  }

  async deleteInstagramFinancialData(campaignId: string): Promise<boolean> {
    await db.transaction(async (tx: any) => {
      await deleteInstagramFinancialDataForCampaign(tx, campaignId);
    });
    return true;
  }

  async deleteInstagramDailyMetrics(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(instagramDailyMetrics)
      .where(eq(instagramDailyMetrics.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  async getInstagramDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<InstagramDailyMetric[]> {
    return await db.select().from(instagramDailyMetrics)
      .where(and(
        eq(instagramDailyMetrics.campaignId, campaignId),
        gte(instagramDailyMetrics.date, startDate),
        lte(instagramDailyMetrics.date, endDate),
      ))
      .orderBy(instagramDailyMetrics.date);
  }

  async upsertInstagramDailyMetrics(metrics: InsertInstagramDailyMetric[]): Promise<{ upserted: number }> {
    if (metrics.length === 0) return { upserted: 0 };
    await db
      .insert(instagramDailyMetrics)
      .values(metrics)
      .onConflictDoUpdate({
        target: [instagramDailyMetrics.campaignId, instagramDailyMetrics.instagramCampaignId, instagramDailyMetrics.date, instagramDailyMetrics.platformPosition],
        set: {
          instagramCampaignName: sql`COALESCE(EXCLUDED.instagram_campaign_name, ${instagramDailyMetrics.instagramCampaignName})`,
          publisherPlatform: sql`EXCLUDED.publisher_platform`,
          impressions: sql`EXCLUDED.impressions`,
          clicks: sql`EXCLUDED.clicks`,
          spend: sql`EXCLUDED.spend`,
          conversions: sql`EXCLUDED.conversions`,
          videoViews: sql`EXCLUDED.video_views`,
          actions: sql`EXCLUDED.actions`,
          ctr: sql`EXCLUDED.ctr`,
          cpc: sql`EXCLUDED.cpc`,
          cpm: sql`EXCLUDED.cpm`,
          costPerConversion: sql`EXCLUDED.cost_per_conversion`,
          conversionRate: sql`EXCLUDED.conversion_rate`,
          ga4Revenue: sql`COALESCE(EXCLUDED.ga4_revenue, ${instagramDailyMetrics.ga4Revenue})`,
          ga4UtmName: sql`COALESCE(EXCLUDED.ga4_utm_name, ${instagramDailyMetrics.ga4UtmName})`,
          importedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
    return { upserted: metrics.length };
  }

  // TikTok Connection methods
  async getTikTokConnection(campaignId: string): Promise<TikTokConnection | undefined> {
    const [connection] = await db.select().from(tiktokConnections).where(eq(tiktokConnections.campaignId, campaignId));
    if (!connection) return undefined;
    return hydrateDecryptedTokens(connection) as any;
  }

  async createTikTokConnection(connection: InsertTikTokConnection): Promise<TikTokConnection> {
    return this.writeGA4RefreshInputChange(connection.campaignId, async db => {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
    } as any);
    const [tiktokConnection] = await db
      .insert(tiktokConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        encryptedTokens: enc as any,
      } as any)
      .returning();
    return hydrateDecryptedTokens(tiktokConnection) as any;
    });
  }

  async updateTikTokConnection(campaignId: string, connection: Partial<InsertTikTokConnection>): Promise<TikTokConnection | undefined> {
    return this.writeGA4RefreshInputChange([campaignId, ...(connection.campaignId ? [connection.campaignId] : [])], async db => {
    const [existing] = await db.select().from(tiktokConnections).where(eq(tiktokConnections.campaignId, campaignId));
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        prev: (existing as any).encryptedTokens,
      } as any);
      setObj.accessToken = null;
      setObj.refreshToken = null;
    }

    const [updated] = await db
      .update(tiktokConnections)
      .set({ ...setObj, updatedAt: new Date() } as any)
      .where(eq(tiktokConnections.campaignId, campaignId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    });
  }

  async deleteTikTokConnection(campaignId: string): Promise<boolean> {
    return this.writeGA4RefreshInputChange(campaignId, async db => {
    return await db.transaction(async (tx: any) => {
      const result = await tx
        .delete(tiktokConnections)
        .where(eq(tiktokConnections.campaignId, campaignId));
      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        await tx.delete(tiktokDailyMetrics).where(eq(tiktokDailyMetrics.campaignId, campaignId));
        await deleteTikTokFinancialDataForCampaign(tx, campaignId);
      }
      return deleted;
    });
    });
  }

  async deleteTikTokDailyMetrics(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(tiktokDailyMetrics)
      .where(eq(tiktokDailyMetrics.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  async deleteTikTokFinancialData(campaignId: string): Promise<boolean> {
    await db.transaction(async (tx: any) => {
      await deleteTikTokFinancialDataForCampaign(tx, campaignId);
    });
    return true;
  }

  async getTikTokDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<TikTokDailyMetric[]> {
    return await db.select().from(tiktokDailyMetrics)
      .where(and(
        eq(tiktokDailyMetrics.campaignId, campaignId),
        gte(tiktokDailyMetrics.date, startDate),
        lte(tiktokDailyMetrics.date, endDate),
      ))
      .orderBy(tiktokDailyMetrics.date);
  }

  async upsertTikTokDailyMetrics(metrics: InsertTikTokDailyMetric[]): Promise<{ upserted: number }> {
    if (metrics.length === 0) return { upserted: 0 };
    await db
      .insert(tiktokDailyMetrics)
      .values(metrics)
      .onConflictDoUpdate({
        target: [
          tiktokDailyMetrics.campaignId,
          tiktokDailyMetrics.advertiserId,
          tiktokDailyMetrics.tiktokCampaignId,
          tiktokDailyMetrics.date,
          tiktokDailyMetrics.sourceContractVersion,
        ],
        set: {
          tiktokCampaignName: sql`COALESCE(EXCLUDED.tiktok_campaign_name, ${tiktokDailyMetrics.tiktokCampaignName})`,
          impressions: sql`EXCLUDED.impressions`,
          clicks: sql`EXCLUDED.clicks`,
          spend: sql`EXCLUDED.spend`,
          currency: sql`COALESCE(EXCLUDED.currency, ${tiktokDailyMetrics.currency})`,
          conversions: sql`EXCLUDED.conversions`,
          videoViews: sql`EXCLUDED.video_views`,
          engagements: sql`EXCLUDED.engagements`,
          ctr: sql`EXCLUDED.ctr`,
          cpc: sql`EXCLUDED.cpc`,
          cpm: sql`EXCLUDED.cpm`,
          costPerConversion: sql`EXCLUDED.cost_per_conversion`,
          conversionRate: sql`EXCLUDED.conversion_rate`,
          rawMetrics: sql`EXCLUDED.raw_metrics`,
          metricAvailability: sql`EXCLUDED.metric_availability`,
          isEstimated: sql`EXCLUDED.is_estimated`,
          isSimulated: sql`EXCLUDED.is_simulated`,
          lastSyncedAt: sql`CURRENT_TIMESTAMP`,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
    return { upserted: metrics.length };
  }

  // The parent lock serializes these checks with source edits, reconnects and deletion.
  // Compare hydrated credentials so a legacy encryption migration is not a reconnect.
  private async assertGoogleAdsRefreshInputs(tx: any, campaignId: string, options: GA4RefreshWriteInput, dedicatedSpend?: boolean): Promise<void> {
    if (!("googleAdsRefresh" in options)) return;
    const scope = options.googleAdsRefresh;
    const fail = () => { throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED'); };
    if (!scope?.campaign?.ownerId || !scope.connection?.id || scope.campaign.id !== campaignId || scope.connection.campaignId !== campaignId
      || (dedicatedSpend !== undefined && scope.dedicatedSpend !== dedicatedSpend)) fail();
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId)).for('update');
    if (!campaign || !filterActiveSchedulerCampaigns([campaign], scope!.allowDraftPreview && scope!.connection.spendOnly ? campaignId : '').length
      || ['id', 'ownerId', 'clientId', 'status', 'currency', 'reportingTimeZone', 'startDate', 'createdAt'].some(key => !isDeepStrictEqual(campaign[key] ?? null, scope!.campaign[key] ?? null))) fail();
    if (scope!.connection.spendOnly && scope!.source !== undefined) {
      const sources = (await tx.select().from(spendSources).where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, true),
        eq(spendSources.sourceType, 'ad_platforms'), or(eq(spendSources.platformContext, 'ga4'), isNull(spendSources.platformContext)))).for('update')).filter((source: any) => {
          try { return String(JSON.parse(source.mappingConfig || '{}').platform || '').trim().toLowerCase() === 'google_ads' || String(source.displayName || '').trim() === 'Google Ads'; } catch { return String(source.displayName || '').trim() === 'Google Ads'; }
        });
      if (scope!.source === null ? sources.length !== 0 : sources.length !== 1 || ['id', 'campaignId', 'mappingConfig', 'currency', 'createdAt'].some(key => !isDeepStrictEqual(sources[0][key] ?? null, scope!.source![key] ?? null))) fail();
    }
    const table = scope!.dedicatedSpend ? ga4GoogleAdsSpendConnections : googleAdsConnections;
    const connections = await tx.select().from(table).where(eq(table.campaignId, campaignId)).for('update');
    if (connections.length !== 1) fail();
    const current = hydrateDecryptedTokens(connections[0]) as any;
    const expected = { ...scope!.connection };
    if (current.method === 'service_account') {
      const managerAccountId = getGoogleAdsServiceAccountLoginCustomerId();
      current.managerAccountId ||= managerAccountId;
      expected.managerAccountId ||= managerAccountId;
    }
    const fields = ['id', 'campaignId', 'customerId', 'customerName', 'managerAccountId', 'method', 'spendOnly', 'selectedCampaignIds', 'clientId', 'developerToken', 'connectedAt', 'createdAt', 'lastRefreshAt'];
    if (current.method !== 'service_account') fields.push('accessToken', 'refreshToken', 'clientSecret');
    if (fields.some(key => !isDeepStrictEqual(current[key] ?? null, expected[key] ?? null))) fail();
  }

  // GA4 Google Ads Spend connection and daily facts stay separate from the main Google Ads platform.
  async getGA4GoogleAdsSpendConnection(campaignId: string): Promise<GA4GoogleAdsSpendConnection | undefined> {
    const [connection] = await db.select().from(ga4GoogleAdsSpendConnections)
      .where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId));
    return connection
      ? await hydrateGoogleAdsServiceAccountConnection(hydrateDecryptedTokens(connection) as any) as any
      : undefined;
  }

  async replaceGA4GoogleAdsSpendConnection(connection: InsertGA4GoogleAdsSpendConnection, dailyMetrics: InsertGA4GoogleAdsSpendDailyMetric[]): Promise<GA4GoogleAdsSpendConnection> {
    assertProductionTokenEncryptionConfigured();
    const isServiceAccount = String((connection as any).method || "").trim().toLowerCase() === GOOGLE_ADS_SERVICE_ACCOUNT_METHOD;
    const encryptedTokens = buildEncryptedTokens({
      accessToken: isServiceAccount ? null : (connection as any).accessToken,
      refreshToken: isServiceAccount ? null : (connection as any).refreshToken,
      clientSecret: isServiceAccount ? null : (connection as any).clientSecret,
    });
    return await this.writeGA4RefreshInputChange(connection.campaignId, async (tx: any) => {
      await tx.delete(ga4GoogleAdsSpendConnections).where(eq(ga4GoogleAdsSpendConnections.campaignId, connection.campaignId));
      await tx.delete(ga4GoogleAdsSpendDailyMetrics).where(eq(ga4GoogleAdsSpendDailyMetrics.campaignId, connection.campaignId));
      const [saved] = await tx.insert(ga4GoogleAdsSpendConnections).values({
        ...connection, accessToken: null, refreshToken: null, clientSecret: null,
        clientId: isServiceAccount ? null : (connection as any).clientId,
        developerToken: isServiceAccount ? null : (connection as any).developerToken,
        encryptedTokens, spendOnly: true, lastRefreshAt: new Date(),
      } as any).returning();
      if (dailyMetrics.length) await tx.insert(ga4GoogleAdsSpendDailyMetrics).values(dailyMetrics.map((row) => ({
        campaignId: connection.campaignId, googleCampaignId: row.googleCampaignId,
        googleCampaignName: row.googleCampaignName, date: row.date,
        impressions: row.impressions, clicks: row.clicks, spend: row.spend,
      })) as any);
      return hydrateDecryptedTokens(saved) as any;
    });
  }

  async updateGA4GoogleAdsSpendConnection(campaignId: string, connection: Partial<InsertGA4GoogleAdsSpendConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<GA4GoogleAdsSpendConnection | undefined> {
    const guarded = "refreshScope" in options;
    const write = async (db: any) => {
    if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(db, campaignId, options, true);
    const existingQuery = db.select().from(ga4GoogleAdsSpendConnections)
      .where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId));
    const [existing] = await (guarded ? existingQuery.for("update") : existingQuery);
    if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;
    const setObj: any = { ...connection };
    if (Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
        Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
        Object.prototype.hasOwnProperty.call(connection, "clientSecret")) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens || (guarded || options.googleAdsRefresh ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
      });
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }
    const [updated] = await db.update(ga4GoogleAdsSpendConnections).set(setObj)
      .where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId)).returning();
    return updated ? hydrateDecryptedTokens(updated) as any : undefined;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, write) : this.writeGA4RefreshInputChange(campaignId, write);
  }

  async getGA4GoogleAdsSpendDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GA4GoogleAdsSpendDailyMetric[]> {
    return await db.select().from(ga4GoogleAdsSpendDailyMetrics).where(and(
      eq(ga4GoogleAdsSpendDailyMetrics.campaignId, campaignId),
      gte(ga4GoogleAdsSpendDailyMetrics.date, startDate),
      lte(ga4GoogleAdsSpendDailyMetrics.date, endDate),
    )).orderBy(ga4GoogleAdsSpendDailyMetrics.date);
  }

  async replaceGA4GoogleAdsSpendDailyMetricsForWindow(campaignId: string, startDate: string, endDate: string, metrics: InsertGA4GoogleAdsSpendDailyMetric[], options: GA4RefreshGoogleAdsWriteInput = {}): Promise<{ replaced: number }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate ||
        metrics.some((row) => row.campaignId !== campaignId || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || row.date < startDate || row.date > endDate)) {
      throw new Error("Google Ads Spend replacement rows are outside the campaign window");
    }
    const guarded = "refreshScope" in options;
    let completedAt: Date | undefined;
    const write = async (tx: any) => {
      if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(tx, campaignId, options, true);
      if (guarded) {
        if (options.refreshScope?.campaignId !== campaignId || !options.expectedSource || !options.expectedConnection) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        const [source] = await tx.select().from(spendSources).where(and(eq(spendSources.id, options.expectedSource.id), eq(spendSources.campaignId, campaignId))).for("update");
        const [connection] = await tx.select().from(ga4GoogleAdsSpendConnections).where(eq(ga4GoogleAdsSpendConnections.campaignId, campaignId)).for("update");
        if (!source || source.isActive === false || source.sourceType !== "ad_platforms" || (source.platformContext || "ga4") !== "ga4"
          || source.mappingConfig !== options.expectedSource.mappingConfig || !connection || connection.isActive === false || !connection.spendOnly
          || ["id", "campaignId", "encryptedTokens", "customerId", "managerAccountId", "method", "selectedCampaignIds"].some(field => (connection[field] ?? null) !== (options.expectedConnection![field] ?? null))) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      await tx.delete(ga4GoogleAdsSpendDailyMetrics).where(and(
        eq(ga4GoogleAdsSpendDailyMetrics.campaignId, campaignId),
        gte(ga4GoogleAdsSpendDailyMetrics.date, startDate),
        lte(ga4GoogleAdsSpendDailyMetrics.date, endDate),
      ));
      if (metrics.length) await tx.insert(ga4GoogleAdsSpendDailyMetrics).values(metrics.map((row) => ({
        campaignId, googleCampaignId: row.googleCampaignId, googleCampaignName: row.googleCampaignName,
        date: row.date, impressions: row.impressions, clicks: row.clicks, spend: row.spend,
      })) as any);
      if (options.googleAdsRefresh) {
        completedAt = new Date(Math.max(Date.now(), new Date(options.googleAdsRefresh.connection.lastRefreshAt || 0).getTime() + 1));
        const updated = await tx.update(ga4GoogleAdsSpendConnections).set({ lastRefreshAt: completedAt })
          .where(eq(ga4GoogleAdsSpendConnections.id, options.googleAdsRefresh!.connection.id)).returning({ id: ga4GoogleAdsSpendConnections.id });
        if (updated.length !== 1) throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      }
      return { replaced: metrics.length };
    };
    const result = await (guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, write) : db.transaction(write));
    if (completedAt) options.googleAdsRefresh!.connection = { ...options.googleAdsRefresh!.connection, lastRefreshAt: completedAt };
    return result;
  }

  // Google Ads Connection methods
  async getGoogleAdsConnection(campaignId: string, options: GA4RefreshWriteInput & { migrateLegacyTokens?: boolean } = {}): Promise<GoogleAdsConnection | undefined> {
    const [connection] = await db.select().from(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId));
    if (!connection) return undefined;
    const hydrated = hydrateDecryptedTokens(connection) as any;
    const hasPlain = Boolean((connection as any).accessToken) || Boolean((connection as any).refreshToken) || Boolean((connection as any).clientSecret);
    const hasEnc = Boolean((connection as any).encryptedTokens);
    if (options.migrateLegacyTokens !== false && !("refreshScope" in options) && hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
        });
        await db
          .update(googleAdsConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(and(eq(googleAdsConnections.id, connection.id), isNull(googleAdsConnections.encryptedTokens),
            sql`${googleAdsConnections.accessToken} IS NOT DISTINCT FROM ${connection.accessToken ?? null}`,
            sql`${googleAdsConnections.refreshToken} IS NOT DISTINCT FROM ${connection.refreshToken ?? null}`,
            sql`${googleAdsConnections.clientSecret} IS NOT DISTINCT FROM ${connection.clientSecret ?? null}`));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createGoogleAdsConnection(connection: InsertGoogleAdsConnection): Promise<GoogleAdsConnection> {
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });
    const [gadsConnection] = await this.writeGA4RefreshInputChange<GoogleAdsConnection[]>(connection.campaignId, tx => tx
      .insert(googleAdsConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        clientSecret: null,
        encryptedTokens: enc as any,
      } as any)
      .returning());
    return hydrateDecryptedTokens(gadsConnection) as any;
  }

  async replaceGoogleAdsConnection(connection: InsertGoogleAdsConnection, dailyMetrics: InsertGoogleAdsDailyMetric[] = []): Promise<GoogleAdsConnection> {
    assertProductionTokenEncryptionConfigured();
    const enc = buildEncryptedTokens({
      accessToken: (connection as any).accessToken,
      refreshToken: (connection as any).refreshToken,
      clientSecret: (connection as any).clientSecret,
    });
    const connectionData: any = {
      ...connection,
      accessToken: null,
      refreshToken: null,
      clientSecret: null,
      encryptedTokens: enc as any,
      selectedCampaignIds: null,
      campaignUtmMap: null,
      lastRefreshAt: null,
    };
    return await this.writeGA4RefreshInputChange(connection.campaignId, async (tx: any) => {
      await tx.delete(googleAdsConnections).where(eq(googleAdsConnections.campaignId, connection.campaignId));
      await tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, connection.campaignId));
      const [created] = await tx.insert(googleAdsConnections).values(connectionData).returning();
      if (dailyMetrics.length > 0) {
        await tx.insert(googleAdsDailyMetrics).values(dailyMetrics.map((metric: any) => ({ ...metric, campaignId: connection.campaignId })) as any);
      }
      return hydrateDecryptedTokens(created) as any;
    });
  }

  async updateGoogleAdsConnection(campaignId: string, connection: Partial<InsertGoogleAdsConnection>, options: GA4RefreshConnectionWriteInput = {}): Promise<GoogleAdsConnection | undefined> {
    const guarded = "refreshScope" in options;
    const write = async (db: any) => {
    if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(db, campaignId, options, false);
    const existingQuery = db.select().from(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId));
    const [existing] = await (guarded ? existingQuery.for("update") : existingQuery);
    if (guarded) {
      const expected = options.expectedConnection;
      if (existing && expected && !existing.encryptedTokens && !expected.encryptedTokens && existing.method !== "service_account"
        && ["accessToken", "refreshToken", "clientSecret"].some(field => (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
      const fields = ["id", "campaignId", "encryptedTokens", "method", "clientId", "mappingConfig", "spreadsheetId", "sheetName", "purpose", "instanceUrl", "shopDomain", "customerId", "managerAccountId", "selectedCampaignIds", "spendOnly"];
      if (!existing || existing.isActive === false || !expected || expected.id !== existing.id
        || options.refreshScope?.campaignId !== existing.campaignId || expected.campaignId !== existing.campaignId
        || fields.some(field => field === "encryptedTokens" ? !isDeepStrictEqual(existing[field] ?? null, expected[field] ?? null) : (existing[field] ?? null) !== (expected[field] ?? null))) throw new Error("GA4_REFRESH_CONNECTION_CHANGED");
    }
    if (!existing) return undefined;

    const tokenFieldsProvided =
      Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
      Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
      Object.prototype.hasOwnProperty.call(connection, "clientSecret");

    const setObj: any = { ...connection };
    if (tokenFieldsProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
        prev: (existing as any).encryptedTokens || (guarded || options.googleAdsRefresh ? buildEncryptedTokens({ accessToken: existing.accessToken, refreshToken: existing.refreshToken, clientSecret: existing.clientSecret }) : undefined),
      });
      setObj.accessToken = null;
      setObj.refreshToken = null;
      setObj.clientSecret = null;
    }

    const [updated] = await db
      .update(googleAdsConnections)
      .set(setObj)
      .where(eq(googleAdsConnections.campaignId, campaignId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    };
    return guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, write) : this.writeGA4RefreshInputChange(campaignId, write);
  }

  async deleteGoogleAdsConnection(campaignId: string): Promise<boolean> {
    return await this.writeGA4RefreshInputChange(campaignId, async (tx: any) => {
      const result = await tx
        .delete(googleAdsConnections)
        .where(eq(googleAdsConnections.campaignId, campaignId));
      const deleted = (result.rowCount || 0) > 0;
      if (deleted) {
        await tx.delete(googleAdsDailyMetrics).where(eq(googleAdsDailyMetrics.campaignId, campaignId));
      }
      return deleted;
    });
  }

  async deleteGoogleAdsDailyMetrics(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(googleAdsDailyMetrics)
      .where(eq(googleAdsDailyMetrics.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  async getGoogleAdsDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GoogleAdsDailyMetric[]> {
    const rows = await db.select().from(googleAdsDailyMetrics)
      .where(and(
        eq(googleAdsDailyMetrics.campaignId, campaignId),
        sql`${googleAdsDailyMetrics.date} >= ${startDate}`,
        sql`${googleAdsDailyMetrics.date} <= ${endDate}`,
      ))
      .orderBy(googleAdsDailyMetrics.date);
    // Legacy name/spend-weighted enrichment is not verified attribution. Keep stored
    // records intact, but exclude these fields from every current consumer.
    return rows.map((row: GoogleAdsDailyMetric) => ({ ...row, ga4Revenue: null, ga4UtmName: null }));
  }

  async upsertGoogleAdsDailyMetrics(metrics: InsertGoogleAdsDailyMetric[]): Promise<{ upserted: number }> {
    if (metrics.length === 0) return { upserted: 0 };
    let upserted = 0;
    for (const m of metrics) {
      await db.execute(sql`
        INSERT INTO google_ads_daily_metrics (
          campaign_id, google_campaign_id, google_campaign_name, date,
          impressions, clicks, spend, conversions, conversion_value,
          ctr, cpc, cpm, interaction_rate, video_views,
          search_impression_share, cost_per_conversion, conversion_rate, imported_at
        ) VALUES (
          ${m.campaignId}, ${m.googleCampaignId}, ${m.googleCampaignName ?? null}, ${m.date},
          ${m.impressions ?? 0}, ${m.clicks ?? 0}, ${m.spend ?? 0}, ${m.conversions ?? 0}, ${m.conversionValue ?? 0},
          ${m.ctr ?? null}, ${m.cpc ?? null}, ${m.cpm ?? null}, ${m.interactionRate ?? null}, ${m.videoViews ?? 0},
          ${m.searchImpressionShare ?? null}, ${m.costPerConversion ?? null}, ${m.conversionRate ?? null}, CURRENT_TIMESTAMP
        )
        ON CONFLICT (campaign_id, google_campaign_id, date) DO UPDATE SET
          google_campaign_name = EXCLUDED.google_campaign_name,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          spend = EXCLUDED.spend,
          conversions = EXCLUDED.conversions,
          conversion_value = EXCLUDED.conversion_value,
          ctr = EXCLUDED.ctr,
          cpc = EXCLUDED.cpc,
          cpm = EXCLUDED.cpm,
          interaction_rate = EXCLUDED.interaction_rate,
          video_views = EXCLUDED.video_views,
          search_impression_share = EXCLUDED.search_impression_share,
          cost_per_conversion = EXCLUDED.cost_per_conversion,
          conversion_rate = EXCLUDED.conversion_rate,
          imported_at = CURRENT_TIMESTAMP
      `);
      upserted++;
    }
    return { upserted };
  }

  async replaceGoogleAdsDailyMetricsForWindow(campaignId: string, startDate: string, endDate: string, metrics: InsertGoogleAdsDailyMetric[], options: GA4RefreshGoogleAdsWriteInput = {}): Promise<{ replaced: number }> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
      throw new Error("Invalid Google Ads replacement window");
    }
    if (metrics.some((metric: any) =>
      String(metric?.campaignId || "") !== campaignId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(metric?.date || "")) ||
      String(metric.date) < startDate || String(metric.date) > endDate
    )) throw new Error("Google Ads replacement row is outside the authorized scope");
    const guarded = "refreshScope" in options;
    let completedAt: Date | undefined;
    const write = async (tx: any) => {
      if ("googleAdsRefresh" in options) await this.assertGoogleAdsRefreshInputs(tx, campaignId, options, false);
      if (guarded) {
        if (options.refreshScope?.campaignId !== campaignId || !options.expectedSource || !options.expectedConnection) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        const [source] = await tx.select().from(spendSources).where(and(eq(spendSources.id, options.expectedSource.id), eq(spendSources.campaignId, campaignId))).for("update");
        const [connection] = await tx.select().from(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId)).for("update");
        if (!source || source.isActive === false || source.sourceType !== "ad_platforms" || (source.platformContext || "ga4") !== "ga4"
          || source.mappingConfig !== options.expectedSource.mappingConfig || !connection || connection.isActive === false || !connection.spendOnly
          || ["id", "campaignId", "encryptedTokens", "customerId", "managerAccountId", "method", "selectedCampaignIds"].some(field => (connection[field] ?? null) !== (options.expectedConnection![field] ?? null))) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      await tx.delete(googleAdsDailyMetrics).where(and(
        eq(googleAdsDailyMetrics.campaignId, campaignId),
        gte(googleAdsDailyMetrics.date, startDate),
        lte(googleAdsDailyMetrics.date, endDate),
      ));
      if (metrics.length > 0) {
        await tx.insert(googleAdsDailyMetrics).values(metrics.map((metric: any) => ({ ...metric, campaignId })) as any);
      }
      if (options.googleAdsRefresh) {
        completedAt = new Date(Math.max(Date.now(), new Date(options.googleAdsRefresh.connection.lastRefreshAt || 0).getTime() + 1));
        const updated = await tx.update(googleAdsConnections).set({ lastRefreshAt: completedAt })
          .where(eq(googleAdsConnections.id, options.googleAdsRefresh!.connection.id)).returning({ id: googleAdsConnections.id });
        if (updated.length !== 1) throw new Error('GOOGLE_ADS_REFRESH_INPUTS_CHANGED');
      }
      return { replaced: metrics.length };
    };
    const result = await (guarded ? this.writeWithGA4RefreshOwnership(options.refreshScope, write) : db.transaction(write));
    if (completedAt) options.googleAdsRefresh!.connection = { ...options.googleAdsRefresh!.connection, lastRefreshAt: completedAt };
    return result;
  }

  async updateGoogleAdsDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ googleCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }> {
    if (updates.length) throw new Error('Google Ads GA4 attribution is unavailable: campaign-name matching does not verify source and date');
    let updated = 0;
    for (const u of updates) {
      const result = await db.execute(sql`
        UPDATE google_ads_daily_metrics
        SET ga4_revenue = ${u.ga4Revenue}, ga4_utm_name = ${u.ga4UtmName}
        WHERE campaign_id = ${campaignId} AND google_campaign_id = ${u.googleCampaignId} AND date = ${u.date}
      `);
      updated += result.rowCount || 0;
    }
    return { updated };
  }

  async updateMetaDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ metaCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }> {
    let updated = 0;
    for (const u of updates) {
      const result = await db.execute(sql`
        UPDATE meta_daily_metrics
        SET ga4_revenue = ${u.ga4Revenue}, ga4_utm_name = ${u.ga4UtmName}
        WHERE campaign_id = ${campaignId} AND meta_campaign_id = ${u.metaCampaignId} AND date = ${u.date}
      `);
      updated += result.rowCount || 0;
    }
    return { updated };
  }

  async updateLinkedInDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ linkedinCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }> {
    let updated = 0;
    for (const u of updates) {
      const result = await db.execute(sql`
        UPDATE linkedin_daily_metrics
        SET ga4_revenue = ${u.ga4Revenue}, ga4_utm_name = ${u.ga4UtmName}
        WHERE campaign_id = ${campaignId} AND linkedin_campaign_id = ${u.linkedinCampaignId} AND date = ${u.date}
      `);
      updated += result.rowCount || 0;
    }
    return { updated };
  }

  // Meta KPIs
  async getMetaKPIs(campaignId: string): Promise<MetaKpi[]> {
    return await db.select().from(metaKpis).where(eq(metaKpis.campaignId, campaignId));
  }

  async getMetaKPIById(id: string): Promise<MetaKpi | undefined> {
    const [kpi] = await db.select().from(metaKpis).where(eq(metaKpis.id, id));
    return kpi || undefined;
  }

  async createMetaKPI(kpi: InsertMetaKpi): Promise<MetaKpi> {
    const [newKpi] = await db.insert(metaKpis).values(kpi).returning();
    return newKpi;
  }

  async updateMetaKPI(id: string, kpi: Partial<InsertMetaKpi>): Promise<MetaKpi | undefined> {
    const [updated] = await db
      .update(metaKpis)
      .set({ ...kpi, id: undefined, campaignId: undefined, updatedAt: new Date() })
      .where(eq(metaKpis.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMetaKPI(id: string): Promise<boolean> {
    const result = await db.delete(metaKpis).where(eq(metaKpis.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Meta Benchmarks
  async getMetaBenchmarks(campaignId: string): Promise<MetaBenchmark[]> {
    return await db.select().from(metaBenchmarks).where(eq(metaBenchmarks.campaignId, campaignId));
  }

  async getMetaBenchmarkById(id: string): Promise<MetaBenchmark | undefined> {
    const [benchmark] = await db.select().from(metaBenchmarks).where(eq(metaBenchmarks.id, id));
    return benchmark || undefined;
  }

  async createMetaBenchmark(benchmark: InsertMetaBenchmark): Promise<MetaBenchmark> {
    const [newBenchmark] = await db.insert(metaBenchmarks).values(benchmark).returning();
    return newBenchmark;
  }

  async updateMetaBenchmark(id: string, benchmark: Partial<InsertMetaBenchmark>): Promise<MetaBenchmark | undefined> {
    const [updated] = await db
      .update(metaBenchmarks)
      .set({ ...benchmark, id: undefined, campaignId: undefined, updatedAt: new Date() })
      .where(eq(metaBenchmarks.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMetaBenchmark(id: string): Promise<boolean> {
    const result = await db.delete(metaBenchmarks).where(eq(metaBenchmarks.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Meta Reports
  async getMetaReports(campaignId: string): Promise<MetaReport[]> {
    return await db.select().from(metaReports).where(eq(metaReports.campaignId, campaignId));
  }

  async getMetaReportById(id: string): Promise<MetaReport | undefined> {
    const [report] = await db.select().from(metaReports).where(eq(metaReports.id, id));
    return report || undefined;
  }

  async createMetaReport(report: InsertMetaReport): Promise<MetaReport> {
    const [newReport] = await db.insert(metaReports).values(report).returning();
    return newReport;
  }

  async updateMetaReport(id: string, report: Partial<InsertMetaReport>): Promise<MetaReport | undefined> {
    const [updated] = await db
      .update(metaReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(metaReports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteMetaReport(id: string): Promise<boolean> {
    const result = await db.delete(metaReports).where(eq(metaReports.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Meta Daily Metrics
  async getMetaDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<MetaDailyMetric[]> {
    return await db
      .select()
      .from(metaDailyMetrics)
      .where(
        and(
          eq(metaDailyMetrics.campaignId, campaignId),
          gte(metaDailyMetrics.date, startDate),
          lte(metaDailyMetrics.date, endDate)
        )
      );
  }

  async createMetaDailyMetric(metric: InsertMetaDailyMetric): Promise<MetaDailyMetric> {
    const [newMetric] = await db.insert(metaDailyMetrics).values(metric).returning();
    return newMetric;
  }

  async upsertMetaDailyMetrics(metrics: InsertMetaDailyMetric[]): Promise<void> {
    if (metrics.length === 0) return;

    // Use INSERT ... ON CONFLICT for efficient upserts
    await db
      .insert(metaDailyMetrics)
      .values(metrics)
      .onConflictDoUpdate({
        target: [metaDailyMetrics.campaignId, metaDailyMetrics.metaCampaignId, metaDailyMetrics.date],
        set: {
          impressions: sql`EXCLUDED.impressions`,
          reach: sql`EXCLUDED.reach`,
          clicks: sql`EXCLUDED.clicks`,
          spend: sql`EXCLUDED.spend`,
          conversions: sql`EXCLUDED.conversions`,
          videoViews: sql`EXCLUDED.video_views`,
          metaCampaignName: sql`COALESCE(EXCLUDED.meta_campaign_name, ${metaDailyMetrics.metaCampaignName})`,
          postEngagement: sql`EXCLUDED.post_engagement`,
          linkClicks: sql`EXCLUDED.link_clicks`,
          ctr: sql`EXCLUDED.ctr`,
          cpc: sql`EXCLUDED.cpc`,
          cpm: sql`EXCLUDED.cpm`,
          cpp: sql`EXCLUDED.cpp`,
          frequency: sql`EXCLUDED.frequency`,
          costPerConversion: sql`EXCLUDED.cost_per_conversion`,
          conversionRate: sql`EXCLUDED.conversion_rate`,
          revenue: sql`EXCLUDED.revenue`,
          roas: sql`EXCLUDED.roas`,
          ga4Revenue: sql`COALESCE(EXCLUDED.ga4_revenue, ${metaDailyMetrics.ga4Revenue})`,
          ga4UtmName: sql`COALESCE(EXCLUDED.ga4_utm_name, ${metaDailyMetrics.ga4UtmName})`,
          importedAt: sql`CURRENT_TIMESTAMP`,
        },
      });
  }

  // LinkedIn Import Session methods
  async getLinkedInImportSession(sessionId: string): Promise<LinkedInImportSession | undefined> {
    const [session] = await db.select().from(linkedinImportSessions).where(eq(linkedinImportSessions.id, sessionId));
    return session || undefined;
  }

  async getCampaignLinkedInImportSessions(campaignId: string): Promise<LinkedInImportSession[]> {
    return await db.select()
      .from(linkedinImportSessions)
      .where(eq(linkedinImportSessions.campaignId, campaignId))
      .orderBy(desc(linkedinImportSessions.importedAt), desc(linkedinImportSessions.id));
  }

  async getLatestLinkedInImportSession(campaignId: string): Promise<LinkedInImportSession | undefined> {
    const [session] = await db
      .select()
      .from(linkedinImportSessions)
      .where(eq(linkedinImportSessions.campaignId, campaignId))
      .orderBy(desc(linkedinImportSessions.importedAt), desc(linkedinImportSessions.id))
      .limit(1);
    return session || undefined;
  }

  async createLinkedInImportSession(session: InsertLinkedInImportSession): Promise<LinkedInImportSession> {
    const [importSession] = await db
      .insert(linkedinImportSessions)
      .values(session)
      .returning();
    return importSession;
  }

  async updateLinkedInImportSession(sessionId: string, updates: Partial<InsertLinkedInImportSession>): Promise<LinkedInImportSession | undefined> {
    const [updated] = await db
      .update(linkedinImportSessions)
      .set(updates)
      .where(eq(linkedinImportSessions.id, sessionId))
      .returning();
    return updated || undefined;
  }

  // LinkedIn Import Metrics methods
  async getLinkedInImportMetrics(sessionId: string): Promise<LinkedInImportMetric[]> {
    return await db.select()
      .from(linkedinImportMetrics)
      .where(eq(linkedinImportMetrics.sessionId, sessionId))
      .orderBy(linkedinImportMetrics.importedAt);
  }

  async createLinkedInImportMetric(metric: InsertLinkedInImportMetric): Promise<LinkedInImportMetric> {
    const [importMetric] = await db
      .insert(linkedinImportMetrics)
      .values(metric)
      .returning();
    return importMetric;
  }

  // LinkedIn Ad Performance methods
  async getLinkedInAdPerformance(sessionId: string): Promise<LinkedInAdPerformance[]> {
    return await db.select()
      .from(linkedinAdPerformance)
      .where(eq(linkedinAdPerformance.sessionId, sessionId))
      .orderBy(linkedinAdPerformance.importedAt);
  }

  async createLinkedInAdPerformance(ad: InsertLinkedInAdPerformance): Promise<LinkedInAdPerformance> {
    const [adPerformance] = await db
      .insert(linkedinAdPerformance)
      .values(ad)
      .returning();
    return adPerformance;
  }

  // LinkedIn Reports methods
  async getLinkedInReports(): Promise<LinkedInReport[]> {
    return await db.select()
      .from(linkedinReports)
      .orderBy(linkedinReports.createdAt);
  }

  async getLinkedInReport(id: string): Promise<LinkedInReport | undefined> {
    const [report] = await db.select()
      .from(linkedinReports)
      .where(eq(linkedinReports.id, id));
    return report || undefined;
  }

  async createLinkedInReport(report: InsertLinkedInReport): Promise<LinkedInReport> {
    const [linkedinReport] = await db
      .insert(linkedinReports)
      .values(report)
      .returning();
    return linkedinReport;
  }

  async updateLinkedInReport(id: string, report: Partial<InsertLinkedInReport>): Promise<LinkedInReport | undefined> {
    const [updated] = await db
      .update(linkedinReports)
      .set({ ...report, updatedAt: new Date() })
      .where(eq(linkedinReports.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteLinkedInReport(id: string): Promise<boolean> {
    const result = await db
      .delete(linkedinReports)
      .where(eq(linkedinReports.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Platform Reports methods
  async getPlatformReports(platformType: string, campaignId?: string): Promise<LinkedInReport[]> {
    // Filter reports by platformType and optionally by campaignId
    const platformTypes = platformType === "custom-integration" || platformType === "custom_integration"
      ? ["custom-integration", "custom_integration"]
      : [platformType];
    if (campaignId) {
      return await db.select()
        .from(linkedinReports)
        .where(and(inArray(linkedinReports.platformType, platformTypes), eq(linkedinReports.campaignId, campaignId)))
        .orderBy(linkedinReports.createdAt);
    } else {
      return await db.select()
        .from(linkedinReports)
        .where(and(inArray(linkedinReports.platformType, platformTypes), isNull(linkedinReports.campaignId)))
        .orderBy(linkedinReports.createdAt);
    }
  }

  async getScheduledPlatformReports(platformTypes: string[] = []): Promise<LinkedInReport[]> {
    const expandedPlatformTypes = platformTypes.flatMap((platformType) => (
      platformType === "custom-integration" || platformType === "custom_integration"
        ? ["custom-integration", "custom_integration"]
        : [platformType]
    )).filter(Boolean);
    const filters = [
      eq(linkedinReports.scheduleEnabled, true),
      eq(linkedinReports.status, "active"),
    ];
    if (expandedPlatformTypes.length > 0) {
      filters.push(inArray(linkedinReports.platformType, expandedPlatformTypes));
    }
    return await db.select()
      .from(linkedinReports)
      .where(and(...filters))
      .orderBy(linkedinReports.createdAt);
  }

  async createPlatformReport(report: any): Promise<LinkedInReport> {
    // For now, use LinkedIn reports table for all platforms
    // In future, use a generic platform_reports table
    return this.createLinkedInReport(report);
  }

  async createCampaignDeepDivePlatformReport(report: any, limits: CampaignDeepDiveReportLimits): Promise<CampaignDeepDiveReportWriteResult> {
    const campaignId = String(report?.campaignId || "").trim();
    if (!campaignId) throw new Error("Campaign DeepDive report campaign is required");
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`campaign_deepdive_reports:${campaignId}`}, 0))`);
      const existingReports = await tx.select({
        status: linkedinReports.status,
        scheduleEnabled: linkedinReports.scheduleEnabled,
      }).from(linkedinReports).where(and(
        eq(linkedinReports.campaignId, campaignId),
        eq(linkedinReports.platformType, "campaign_deepdive"),
      ));
      const nextStatus = String(report?.status || "active");
      const change = {
        incrementsActiveCount: nextStatus !== "archived",
        incrementsScheduledActiveCount: report?.scheduleEnabled === true && nextStatus === "active",
      };
      const limitCode = resolveCampaignDeepDiveReportWriteLimit(existingReports, change, limits);
      if (limitCode) return { report: undefined, limitCode };

      const [created] = await tx.insert(linkedinReports).values({
        ...report,
        campaignId,
        platformType: "campaign_deepdive",
      }).returning();
      if (!created) throw new Error("Campaign DeepDive report creation failed");
      return { report: created, limitCode: null };
    });
  }

  async updatePlatformReport(id: string, report: any): Promise<LinkedInReport | undefined> {
    // For now, use LinkedIn reports table for all platforms
    return this.updateLinkedInReport(id, report);
  }

  async updateCampaignDeepDivePlatformReport(id: string, campaignId: string, report: any, limits: CampaignDeepDiveReportLimits): Promise<CampaignDeepDiveReportWriteResult> {
    const normalizedCampaignId = String(campaignId || "").trim();
    if (!normalizedCampaignId) throw new Error("Campaign DeepDive report campaign is required");
    return await db.transaction(async (tx: any) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`campaign_deepdive_reports:${normalizedCampaignId}`}, 0))`);
      const campaignReports = await tx.select({
        id: linkedinReports.id,
        status: linkedinReports.status,
        scheduleEnabled: linkedinReports.scheduleEnabled,
      }).from(linkedinReports).where(and(
        eq(linkedinReports.campaignId, normalizedCampaignId),
        eq(linkedinReports.platformType, "campaign_deepdive"),
      ));
      const current = campaignReports.find((candidate: any) => String(candidate.id) === String(id));
      if (!current) return { report: undefined, limitCode: null };
      const next = {
        status: typeof report?.status === "undefined" ? String(current.status || "active") : String(report.status || "active"),
        scheduleEnabled: typeof report?.scheduleEnabled === "undefined" ? current.scheduleEnabled === true : report.scheduleEnabled === true,
      };
      const otherReports = campaignReports.filter((candidate: any) => String(candidate.id) !== String(id));
      const currentCountsTowardActive = String(current.status || "active") !== "archived";
      const currentCountsTowardScheduledActive = current.scheduleEnabled === true && String(current.status || "") === "active";
      const nextCountsTowardActive = next.status !== "archived";
      const nextCountsTowardScheduledActive = next.scheduleEnabled && next.status === "active";
      const limitCode = resolveCampaignDeepDiveReportWriteLimit(otherReports, {
        incrementsActiveCount: nextCountsTowardActive && !currentCountsTowardActive,
        incrementsScheduledActiveCount: nextCountsTowardScheduledActive && !currentCountsTowardScheduledActive,
      }, limits);
      if (limitCode) return { report: undefined, limitCode };

      const [updated] = await tx.update(linkedinReports)
        .set({ ...report, updatedAt: new Date() })
        .where(and(
          eq(linkedinReports.id, id),
          eq(linkedinReports.campaignId, normalizedCampaignId),
          eq(linkedinReports.platformType, "campaign_deepdive"),
        ))
        .returning();
      return { report: updated || undefined, limitCode: null };
    });
  }

  async deletePlatformReport(id: string): Promise<boolean> {
    // For now, use LinkedIn reports table for all platforms
    return this.deleteLinkedInReport(id);
  }

  // Custom Integrations methods
  async getCustomIntegration(campaignId: string): Promise<CustomIntegration | undefined> {
    const [integration] = await db.select()
      .from(customIntegrations)
      .where(eq(customIntegrations.campaignId, campaignId));
    return integration || undefined;
  }

  async getCustomIntegrationById(integrationId: string): Promise<CustomIntegration | undefined> {
    const [integration] = await db.select()
      .from(customIntegrations)
      .where(eq(customIntegrations.id, integrationId));
    return integration || undefined;
  }

  async getCustomIntegrationByToken(token: string): Promise<CustomIntegration | undefined> {
    const [integration] = await db.select()
      .from(customIntegrations)
      .where(eq(customIntegrations.webhookToken, token));
    return integration || undefined;
  }

  async getCustomIntegrationByEmail(email: string): Promise<CustomIntegration | undefined> {
    const [integration] = await db.select()
      .from(customIntegrations)
      .where(eq(customIntegrations.email, email));
    return integration || undefined;
  }

  async getAllCustomIntegrations(): Promise<CustomIntegration[]> {
    return db.select().from(customIntegrations);
  }

  async createCustomIntegration(integration: InsertCustomIntegration): Promise<CustomIntegration> {
    return db.transaction(async (tx: any) => {
    const [parent] = await tx.select().from(campaigns).where(eq(campaigns.id, integration.campaignId)).for("update");
    if (!parent?.ownerId || parent.status === "deleted") throw new Error("Campaign unavailable");
    // Check if integration already exists for this campaign
    const [existing] = await tx.select().from(customIntegrations).where(eq(customIntegrations.campaignId, integration.campaignId));
    if (existing) {
      // Update existing integration with new email and webhook token
      const [updated] = await tx
        .update(customIntegrations)
        .set({
          email: integration.email,
          webhookToken: integration.webhookToken,
          ...(integration.allowedEmailAddresses !== undefined ? { allowedEmailAddresses: integration.allowedEmailAddresses } : {}),
          connectedAt: new Date()
        })
        .where(eq(customIntegrations.id, existing.id))
        .returning();
      return updated;
    }

    const [customIntegration] = await tx
      .insert(customIntegrations)
      .values(integration)
      .returning();
    return customIntegration;
    });
  }

  async transferCustomIntegration(fromCampaignId: string, toCampaignId: string, ownerId: string): Promise<boolean> {
    if (!fromCampaignId || !toCampaignId || fromCampaignId === toCampaignId || !ownerId) throw new Error("Distinct owned campaigns required");
    return db.transaction(async (tx: any) => {
      const parents = [];
      for (const id of [fromCampaignId, toCampaignId].sort()) {
        const [parent] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).for("update");
        if (!parent || parent.ownerId !== ownerId || parent.status === "deleted") throw new Error("Campaign unavailable");
        parents.push(parent);
      }
      if (parents[0].currency !== parents[1].currency) throw new Error("Campaign currencies must match");
      const connections = await tx.select().from(customIntegrations).where(inArray(customIntegrations.campaignId, [fromCampaignId, toCampaignId])).for("update");
      if (connections.some((row: any) => row.campaignId === toCampaignId)) throw new Error("Destination already has an integration");
      const source = connections.filter((row: any) => row.campaignId === fromCampaignId);
      if (!source.length) return false;
      if (source.length !== 1) throw new Error("Ambiguous source integration");
      const [destinationMetric] = await tx.select({ id: customIntegrationMetrics.id }).from(customIntegrationMetrics).where(eq(customIntegrationMetrics.campaignId, toCampaignId)).limit(1);
      if (destinationMetric) throw new Error("Destination already has imported data");
      if (fromCampaignId === "temp-campaign-setup") {
        await tx.delete(customIntegrationMetrics).where(eq(customIntegrationMetrics.campaignId, fromCampaignId));
      } else {
        await tx.update(customIntegrationMetrics).set({ campaignId: toCampaignId }).where(eq(customIntegrationMetrics.campaignId, fromCampaignId));
      }
      await tx.update(inboundWebhookReceipts).set({ campaignId: toCampaignId }).where(eq(inboundWebhookReceipts.campaignId, fromCampaignId));
      await tx.update(customIntegrations).set({ campaignId: toCampaignId }).where(eq(customIntegrations.id, source[0].id));
      return true;
    });
  }

  async deleteCustomIntegration(campaignId: string): Promise<boolean> {
    return await db.transaction(async (tx: any) => {
      await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for("update");
      const [existing] = await tx.select({ id: customIntegrations.id })
        .from(customIntegrations)
        .where(eq(customIntegrations.campaignId, campaignId))
        .limit(1);
      if (!existing) return false;

      await tx
        .delete(customIntegrationMetrics)
        .where(eq(customIntegrationMetrics.campaignId, campaignId));

      const result = await tx
        .delete(customIntegrations)
        .where(eq(customIntegrations.campaignId, campaignId));
      return (result.rowCount || 0) > 0;
    });
  }

  // Custom Integration Metrics methods
  async getCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined> {
    const [metrics] = await db.select()
      .from(customIntegrationMetrics)
      .where(eq(customIntegrationMetrics.campaignId, campaignId));
    return metrics || undefined;
  }

  async getAllCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics[]> {
    return await db.select()
      .from(customIntegrationMetrics)
      .where(eq(customIntegrationMetrics.campaignId, campaignId));
  }

  async createCustomIntegrationMetrics(metricsData: InsertCustomIntegrationMetrics, access?: { integrationId: string; webhookToken?: string; receipt?: string; senderEmail?: string; recipientEmail?: string; allowDraft?: boolean }): Promise<CustomIntegrationMetrics & { alreadyProcessed?: boolean }> {
    if (!hasValidatedCustomIntegrationMetadata(metricsData)) throw new Error("Report requires review; no metrics were published. Upload a supported, unambiguous report.");
    return db.transaction(async (tx: any) => {
    const [parent] = await tx.select().from(campaigns).where(eq(campaigns.id, metricsData.campaignId)).for("update");
    if (!parent?.ownerId || parent.status === "deleted" || access && parent.status === "draft" && !access.allowDraft) throw new Error("Campaign unavailable");
    const declaredCurrency = (metricsData.parserMetadata as any)?.declaredCurrency;
    if (declaredCurrency && declaredCurrency !== parent.currency) throw new Error("Import currency must match campaign currency");
    if (access) {
      const [integration] = await tx.select().from(customIntegrations).where(and(eq(customIntegrations.id, access.integrationId), eq(customIntegrations.campaignId, parent.id),
        access.webhookToken ? eq(customIntegrations.webhookToken, access.webhookToken) : undefined)).for("share");
      if (!integration) throw new Error("Integration access revoked");
      if (access.recipientEmail && integration.email !== access.recipientEmail) throw new Error("Integration recipient changed");
      if (access.senderEmail !== undefined && integration.allowedEmailAddresses?.length &&
        !integration.allowedEmailAddresses.some((email: string) => email.trim().toLowerCase() === access.senderEmail?.trim().toLowerCase())) throw new Error("Sender access revoked");
    }
    if (access?.receipt) {
      const [claimed] = await tx.insert(inboundWebhookReceipts).values({ id: access.receipt, campaignId: parent.id }).onConflictDoNothing().returning();
      if (!claimed) {
        const [receipt] = await tx.select().from(inboundWebhookReceipts).where(eq(inboundWebhookReceipts.id, access.receipt));
        const [existing] = receipt?.campaignId === parent.id && receipt.metricsId
          ? await tx.select().from(customIntegrationMetrics).where(eq(customIntegrationMetrics.id, receipt.metricsId)) : [];
        if (!existing) throw new Error("Webhook already processed");
        return { ...existing, alreadyProcessed: true };
      }
    }
    const [metrics] = await tx
      .insert(customIntegrationMetrics)
      .values({ ...metricsData, parserMetadata: { ...(metricsData.parserMetadata as any), currency: parent.currency, period: "source_report_unspecified" } })
      .returning();
    if (access?.receipt) await tx.update(inboundWebhookReceipts).set({ metricsId: metrics.id }).where(eq(inboundWebhookReceipts.id, access.receipt));
    return metrics;
    });
  }

  async getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined> {
    const [metrics] = await db.select()
      .from(customIntegrationMetrics)
      .where(eq(customIntegrationMetrics.campaignId, campaignId))
      .orderBy(desc(customIntegrationMetrics.uploadedAt), desc(customIntegrationMetrics.id))
      .limit(1);
    return hasValidatedCustomIntegrationMetadata(metrics) ? metrics : undefined;
  }

  // Conversion Events methods
  async getConversionEvents(campaignId: string, startDate?: Date, endDate?: Date): Promise<ConversionEvent[]> {
    let query = db.select()
      .from(conversionEvents)
      .where(eq(conversionEvents.campaignId, campaignId));

    // Note: Date filtering would need to be added with proper SQL conditions
    // For now, we'll filter in memory for MVP
    const events = await query as ConversionEvent[];

    let filtered = events;
    if (startDate) {
      filtered = filtered.filter(e => new Date(e.occurredAt) >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(e => new Date(e.occurredAt) <= endDate);
    }

    return filtered.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  async createConversionEvent(eventData: InsertConversionEvent, access?: { ownerId: string; webhookToken?: string }): Promise<ConversionEvent> {
    return db.transaction(async (tx: any) => {
    const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, eventData.campaignId)).for("update");
    if (!campaign || !campaign.ownerId || access && campaign.ownerId !== access.ownerId) throw new Error("Campaign unavailable");
    if (access?.webhookToken) {
      const [integration] = await tx.select().from(customIntegrations).where(and(eq(customIntegrations.campaignId, campaign.id), eq(customIntegrations.webhookToken, access.webhookToken))).for("share");
      if (!integration || ["draft", "deleted"].includes(String(campaign.status))) throw new Error("Webhook access revoked");
    }
    if (eventData.currency !== (campaign.currency || "USD")) throw new Error("Conversion currency mismatch");
    if (eventData.conversionId) {
      const [existing] = await tx.select().from(conversionEvents).where(and(eq(conversionEvents.campaignId, campaign.id), eq(conversionEvents.conversionId, eventData.conversionId))).limit(1);
      if (existing) {
        if (existing.value !== eventData.value || existing.currency !== eventData.currency) throw new Error("Conversion ID already has different values");
        return existing;
      }
    }
    const [event] = await tx
      .insert(conversionEvents)
      .values({
        ...eventData,
        receivedAt: new Date(),
      })
      .returning();
    const [average] = await tx.select({ value: sql`ROUND(AVG(${conversionEvents.value}), 2)` }).from(conversionEvents)
      .where(and(eq(conversionEvents.campaignId, campaign.id), eq(conversionEvents.currency, campaign.currency || "USD"),
        gte(conversionEvents.occurredAt, new Date(Date.now() - 30 * 86400000)), lte(conversionEvents.occurredAt, new Date())));
    if (average?.value != null) await tx.update(campaigns).set({ conversionValue: String(average.value) }).where(eq(campaigns.id, campaign.id));
    return event;
    });
  }

  async getConversionEventTotalValue(campaignId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const events = await this.getConversionEvents(campaignId, startDate, endDate);
    return events.reduce((sum, event) => sum + parseFloat(event.value || "0"), 0);
  }

  async getConversionEventCount(campaignId: string, startDate?: Date, endDate?: Date): Promise<number> {
    const events = await this.getConversionEvents(campaignId, startDate, endDate);
    return events.length;
  }

  // KPI methods
  async getCampaignKPIs(campaignId: string): Promise<KPI[]> {
    return db.select().from(kpis).where(and(
      eq(kpis.campaignId, campaignId),
      or(isNull(kpis.platformType), eq(kpis.platformType, 'campaign'))
    ));
  }

  async getPlatformKPIs(platformType: string, campaignId?: string): Promise<KPI[]> {
    if (campaignId) {
      // Filter by specific campaign
      return db.select().from(kpis).where(and(eq(kpis.platformType, platformType), eq(kpis.campaignId, campaignId)));
    } else {
      // Platform-level KPIs (no campaign association)
      return db.select().from(kpis).where(and(eq(kpis.platformType, platformType), isNull(kpis.campaignId)));
    }
  }

  async getKPI(id: string): Promise<KPI | undefined> {
    const [kpi] = await db.select().from(kpis).where(eq(kpis.id, id));
    return kpi || undefined;
  }

  async createKPI(kpiData: InsertKPI): Promise<KPI> {
    const campaignId = String(kpiData.campaignId || "").trim();
    const isCanonicalActiveGA4KPI = String(kpiData.platformType || "").trim().toLowerCase() === "google_analytics"
      && Boolean(campaignId)
      && isActiveGA4KPI(kpiData)
      && Boolean(resolveGA4KpiMetricIdentity(kpiData.metric, kpiData.name));
    if (isCanonicalActiveGA4KPI) {
      return createActiveCanonicalGA4KPI(kpiData, {
        withTransaction: (run) => this.writeGA4RefreshInputChange(campaignId, run),
        lockCampaign: async (tx: any, id) => {
          const rows = await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, id)).for("update");
          return rows.length === 1;
        },
        listCampaignGA4KPIs: (tx: any, id) => tx.select({
          id: kpis.id,
          campaignId: kpis.campaignId,
          platformType: kpis.platformType,
          metric: kpis.metric,
          name: kpis.name,
          status: kpis.status,
        }).from(kpis).where(and(eq(kpis.platformType, "google_analytics"), eq(kpis.campaignId, id))),
        insert: async (tx: any, input) => {
          const [kpi] = await tx.insert(kpis).values(input).returning();
          return kpi;
        },
      });
    }
    const save = async (db: any) => {
    const [kpi] = await db
      .insert(kpis)
      .values(kpiData)
      .returning();
    return kpi;
    };
    return campaignId && ['', 'campaign', 'google_analytics'].includes(String(kpiData.platformType || '').trim().toLowerCase())
      ? this.writeGA4RefreshInputChange(campaignId, save) : save(db);
  }

  async updateKPI(id: string, kpiData: Partial<InsertKPI> & GA4RefreshWriteInput): Promise<KPI | undefined> {
    const { refreshScope, publicationVersion, ...values } = kpiData;
    const guarded = "refreshScope" in kpiData;
    const save = async (tx: any) => {
      if (guarded && Object.keys(values).some(key => key !== "currentValue")) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      const [kpi] = await tx
        .update(kpis)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(kpis.id, id), guarded ? and(eq(kpis.campaignId, refreshScope!.campaignId),
          sql`lower(trim(coalesce(${kpis.platformType}, ''))) IN ('', 'campaign', 'google_analytics')`) : undefined))
        .returning();
      if (guarded && !kpi) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      return kpi || undefined;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(refreshScope, save);
    const target = await this.getKPI(id);
    const changesDefinition = Object.keys(values).some(key => !['currentValue', 'lastComputedValue', 'lastAlertSent', 'updatedAt'].includes(key));
    if (target?.campaignId && !changesDefinition && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())) {
      return this.writeGA4DerivedChange(target.campaignId, kpiData, save);
    }
    return target?.campaignId && changesDefinition && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())
      ? this.writeGA4RefreshInputChange([target.campaignId, ...(values.campaignId ? [values.campaignId] : [])], save) : save(db);
  }

  async updateCanonicalGA4KPI(id: string, kpiData: Partial<InsertKPI>): Promise<KPI | undefined> {
    const target = await this.getKPI(id);
    if (!target) return undefined;
    return updateCanonicalGA4KPIWithGuard(id, kpiData, {
      withTransaction: (run) => this.writeGA4RefreshInputChange([...(target.campaignId ? [target.campaignId] : []), ...(kpiData.campaignId ? [kpiData.campaignId] : [])], run),
      getById: async (tx: any, kpiId) => (await tx.select().from(kpis).where(eq(kpis.id, kpiId)).limit(1))[0],
      lockCampaign: async (tx: any, campaignId) => (await tx.select({ id: campaigns.id }).from(campaigns).where(eq(campaigns.id, campaignId)).for("update")).length === 1,
      listCampaignGA4KPIs: (tx: any, campaignId) => tx.select().from(kpis).where(and(eq(kpis.platformType, "google_analytics"), eq(kpis.campaignId, campaignId))),
      update: async (tx: any, kpiId, update) => (await tx.update(kpis).set({ ...update, updatedAt: new Date() }).where(eq(kpis.id, kpiId)).returning())[0],
    });
  }

  async deleteKPI(id: string, notificationHides: KPINotificationHide[] = []): Promise<boolean> {
    try {
      const target = await this.getKPI(id);
      const transaction = target?.campaignId && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())
        ? this.writeGA4RefreshInputChange.bind(this, target.campaignId) : db.transaction.bind(db);
      return await transaction(async (tx: any) => {
        const [existing] = await tx.select({ id: kpis.id, campaignId: kpis.campaignId })
          .from(kpis)
          .where(eq(kpis.id, id))
          .limit(1);
        if (!existing) return false;

        for (const hide of notificationHides) {
          if (String(hide.campaignId) !== String(existing.campaignId || "")) {
            throw new Error("KPI notification campaign scope mismatch");
          }
          const hidden = await tx.update(notifications)
            .set({ read: true, metadata: sql`(COALESCE(NULLIF(${notifications.metadata}, '')::jsonb, '{}'::jsonb) || ${hide.metadata}::jsonb)::text` })
            .where(and(eq(notifications.id, hide.id), eq(notifications.campaignId, hide.campaignId)))
            .returning({ id: notifications.id });
          if (!hidden.length) throw new Error("KPI notification hide failed");
        }

        await tx.delete(kpiProgress).where(eq(kpiProgress.kpiId, id));
        await tx.delete(kpiAlerts).where(eq(kpiAlerts.kpiId, id));
        await tx.delete(kpiPeriods).where(eq(kpiPeriods.kpiId, id));
        const result = await tx.delete(kpis).where(eq(kpis.id, id));
        if ((result.rowCount || 0) === 0) throw new Error("KPI parent delete failed");
        return true;
      });
    } catch (error) {
      console.error(`Error in DatabaseStorage.deleteKPI:`, error);
      throw error;
    }
  }

  async getKPIProgress(kpiId: string): Promise<KPIProgress[]> {
    return db.select().from(kpiProgress).where(eq(kpiProgress.kpiId, kpiId)).orderBy(desc(kpiProgress.recordedAt));
  }

  async updateKPIProgress(id: string, progressData: Partial<InsertKPIProgress> & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<KPIProgress | undefined> {
    const { refreshScope, publicationVersion, ...values } = progressData;
    const guarded = "refreshScope" in progressData;
    const save = async (tx: any) => {
      if (guarded) {
        const [parent] = await tx.select({ id: kpis.id }).from(kpis).where(and(
          eq(kpis.id, values.kpiId || ""), eq(kpis.campaignId, refreshScope!.campaignId), eq(kpis.platformType, "google_analytics"),
        )).for("share");
        if (!parent || !(values.recordedAt instanceof Date) || values.recordedAt.toISOString().slice(0, 10) !== refreshScope!.reportingDate ||
            !values.notes?.startsWith(`auto:ga4_daily:${refreshScope!.reportingDate};`)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      const [progress] = await tx
        .update(kpiProgress)
        .set(values)
        .where(and(eq(kpiProgress.id, id), guarded ? and(eq(kpiProgress.kpiId, values.kpiId!),
          eq(kpiProgress.notes, values.notes!), sql`${kpiProgress.recordedAt}::date = ${refreshScope!.reportingDate}::date`) : undefined))
        .returning();
      if (guarded && !progress) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      if (guarded) await tx.update(kpis).set({ currentValue: progress.value, updatedAt: new Date() }).where(eq(kpis.id, progress.kpiId));
      return progress;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(refreshScope, save);
    const [existing] = await db.select({ kpiId: kpiProgress.kpiId }).from(kpiProgress).where(eq(kpiProgress.id, id));
    const parent = existing ? await this.getKPI(existing.kpiId) : undefined;
    return parent?.campaignId && ['', 'campaign', 'google_analytics'].includes(String(parent.platformType || '').trim().toLowerCase())
      ? this.writeGA4DerivedChange(parent.campaignId, progressData, save) : save(db);
  }

  async getLatestKPIPeriod(kpiId: string): Promise<any> {
    const periods = await db.select()
      .from(kpiPeriods)
      .where(eq(kpiPeriods.kpiId, kpiId))
      .orderBy(desc(kpiPeriods.periodEnd))
      .limit(1);

    return periods[0] || null;
  }

  async recordKPIProgress(progressData: InsertKPIProgress & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<KPIProgress> {
    const { refreshScope, publicationVersion, ...values } = progressData;
    const guarded = "refreshScope" in progressData;
    const save = async (tx: any) => {
      if (guarded) {
        const [parent] = await tx.select({ id: kpis.id }).from(kpis).where(and(
          eq(kpis.id, values.kpiId), eq(kpis.campaignId, refreshScope!.campaignId), eq(kpis.platformType, "google_analytics"),
        )).for("update");
        if (!parent || !(values.recordedAt instanceof Date) || values.recordedAt.toISOString().slice(0, 10) !== refreshScope!.reportingDate ||
            !values.notes?.startsWith(`auto:ga4_daily:${refreshScope!.reportingDate};`)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      const [existingKPI] = await tx
        .select({ id: kpis.id })
        .from(kpis)
        .where(eq(kpis.id, progressData.kpiId))
        .limit(1);
      if (!existingKPI) {
        throw new Error("KPI not found");
      }

      const existing = guarded ? await tx.select({ id: kpiProgress.id }).from(kpiProgress).where(and(
        eq(kpiProgress.kpiId, values.kpiId), eq(kpiProgress.notes, values.notes!),
        sql`${kpiProgress.recordedAt}::date = ${refreshScope!.reportingDate}::date`,
      )).limit(2) : [];
      if (existing.length > 1) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      const [progress] = existing.length
        ? await tx.update(kpiProgress).set(values).where(eq(kpiProgress.id, existing[0].id)).returning()
        : await tx.insert(kpiProgress).values(values).returning();

      // Update the KPI's current value
      await tx
        .update(kpis)
        .set({ currentValue: values.value, updatedAt: new Date() })
        .where(eq(kpis.id, values.kpiId));

      return progress;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(refreshScope, save);
    const parent = await this.getKPI(values.kpiId);
    return parent?.campaignId && ['', 'campaign', 'google_analytics'].includes(String(parent.platformType || '').trim().toLowerCase())
      ? this.writeGA4DerivedChange(parent.campaignId, progressData, save) : save(db);
  }

  async getKPIAnalytics(kpiId: string, timeframe: string = "30d"): Promise<{
    progress: KPIProgress[];
    rollingAverage7d: number;
    rollingAverage30d: number;
    trendAnalysis: {
      direction: string;
      percentage: number;
      period: string;
    };
  }> {
    const progress = await this.getKPIProgress(kpiId);
    const latest = progress[0];

    if (!latest) {
      return {
        progress: [],
        rollingAverage7d: 0,
        rollingAverage30d: 0,
        trendAnalysis: { direction: "neutral", percentage: 0, period: timeframe }
      };
    }

    return {
      progress,
      rollingAverage7d: parseFloat(latest.rollingAverage7d || "0"),
      rollingAverage30d: parseFloat(latest.rollingAverage30d || "0"),
      trendAnalysis: {
        direction: latest.trendDirection || "neutral",
        percentage: this.calculateTrendPercentage(progress, timeframe),
        period: timeframe
      }
    };
  }

  private calculateTrendPercentage(progress: KPIProgress[], timeframe: string): number {
    if (progress.length < 2) return 0;

    const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentProgress = progress.filter(p => new Date(p.recordedAt) >= cutoffDate);
    if (recentProgress.length < 2) return 0;

    const latest = parseFloat(recentProgress[0].value);
    const earliest = parseFloat(recentProgress[recentProgress.length - 1].value);

    if (earliest === 0) return 0;
    return ((latest - earliest) / earliest) * 100;
  }

  // KPI Alert methods for DatabaseStorage
  async getKPIAlerts(kpiId?: string, activeOnly?: boolean): Promise<KPIAlert[]> {
    let query = db.select().from(kpiAlerts);

    if (kpiId) {
      query = query.where(eq(kpiAlerts.kpiId, kpiId));
    }

    if (activeOnly) {
      query = query.where(eq(kpiAlerts.isActive, true));
    }

    return query.orderBy(kpiAlerts.createdAt);
  }

  async createKPIAlert(alertData: InsertKPIAlert): Promise<KPIAlert> {
    const [alert] = await db
      .insert(kpiAlerts)
      .values(alertData)
      .returning();
    return alert;
  }

  async acknowledgeKPIAlert(alertId: string): Promise<boolean> {
    const result = await db
      .update(kpiAlerts)
      .set({ acknowledgedAt: new Date(), updatedAt: new Date() })
      .where(eq(kpiAlerts.id, alertId));
    return (result.rowCount || 0) > 0;
  }

  async resolveKPIAlert(alertId: string): Promise<boolean> {
    const result = await db
      .update(kpiAlerts)
      .set({ isActive: false, resolvedAt: new Date(), updatedAt: new Date() })
      .where(eq(kpiAlerts.id, alertId));
    return (result.rowCount || 0) > 0;
  }

  async checkKPIAlerts(kpiId: string): Promise<KPIAlert[]> {
    // For DatabaseStorage, we'll implement a simplified version
    // In a production environment, this would include more sophisticated alert logic
    return [];
  }

  // Benchmark methods for DatabaseStorage
  async getCampaignBenchmarks(campaignId: string): Promise<Benchmark[]> {
    const results = await db.select().from(benchmarks)
      .where(
        and(
          eq(benchmarks.campaignId, campaignId),
          or(isNull(benchmarks.platformType), eq(benchmarks.platformType, 'campaign'))
        )
      )
      .orderBy(benchmarks.category, benchmarks.name);

    return results;
  }

  async getPlatformBenchmarks(platformType: string, campaignId?: string): Promise<Benchmark[]> {
    if (campaignId) {
      // Filter by specific campaign
      return db.select().from(benchmarks)
        .where(and(eq(benchmarks.platformType, platformType), eq(benchmarks.campaignId, campaignId)))
        .orderBy(benchmarks.category, benchmarks.name);
    } else {
      // Platform-level Benchmarks (no campaign association)
      return db.select().from(benchmarks)
        .where(and(eq(benchmarks.platformType, platformType), isNull(benchmarks.campaignId)))
        .orderBy(benchmarks.category, benchmarks.name);
    }
  }

  async getBenchmark(id: string): Promise<Benchmark | undefined> {
    const [benchmark] = await db.select().from(benchmarks).where(eq(benchmarks.id, id));
    return benchmark || undefined;
  }

  async createBenchmark(benchmarkData: InsertBenchmark): Promise<Benchmark> {
    const save = async (db: any) => {
    const [benchmark] = await db
      .insert(benchmarks)
      .values(benchmarkData)
      .returning();
    return benchmark;
    };
    return benchmarkData.campaignId && ['', 'campaign', 'google_analytics'].includes(String(benchmarkData.platformType || '').trim().toLowerCase())
      ? this.writeGA4RefreshInputChange(benchmarkData.campaignId, save) : save(db);
  }

  async updateBenchmark(id: string, updateData: Partial<InsertBenchmark> & GA4RefreshWriteInput): Promise<Benchmark | undefined> {
    const { refreshScope, publicationVersion, ...values } = updateData;
    const guarded = "refreshScope" in updateData;
    const save = async (tx: any) => {
      if (guarded && Object.keys(values).some(key => key !== "currentValue")) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      const [benchmark] = await tx
        .update(benchmarks)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(benchmarks.id, id), guarded ? and(eq(benchmarks.campaignId, refreshScope!.campaignId),
          sql`lower(trim(coalesce(${benchmarks.platformType}, ''))) IN ('', 'campaign', 'google_analytics')`) : undefined))
        .returning();
      if (guarded && !benchmark) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      return benchmark || undefined;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(refreshScope, save);
    const target = await this.getBenchmark(id);
    const changesDefinition = Object.keys(values).some(key => !['currentValue', 'lastAlertSent', 'lastUpdated', 'updatedAt'].includes(key));
    if (target?.campaignId && !changesDefinition && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())) {
      return this.writeGA4DerivedChange(target.campaignId, updateData, save);
    }
    return target?.campaignId && changesDefinition && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())
      ? this.writeGA4RefreshInputChange([target.campaignId, ...(values.campaignId ? [values.campaignId] : [])], save) : save(db);
  }

  async deleteBenchmark(id: string, notificationHides: KPINotificationHide[] = []): Promise<boolean> {
    const target = await this.getBenchmark(id);
      const transaction = target?.campaignId && ['', 'campaign', 'google_analytics'].includes(String(target.platformType || '').trim().toLowerCase())
        ? this.writeGA4RefreshInputChange.bind(this, target.campaignId) : db.transaction.bind(db);
      return await transaction(async (tx: any) => {
      const [existing] = await tx.select({ id: benchmarks.id, campaignId: benchmarks.campaignId }).from(benchmarks).where(eq(benchmarks.id, id)).limit(1);
      if (!existing) return false;
      for (const hide of notificationHides) {
        if (String(hide.campaignId) !== String(existing.campaignId || "")) {
          throw new Error("Benchmark notification campaign scope mismatch");
        }
        const hidden = await tx.update(notifications)
          .set({ read: true, metadata: sql`(COALESCE(NULLIF(${notifications.metadata}, '')::jsonb, '{}'::jsonb) || ${hide.metadata}::jsonb)::text` })
          .where(and(eq(notifications.id, hide.id), eq(notifications.campaignId, hide.campaignId)))
          .returning({ id: notifications.id });
        if (!hidden.length) throw new Error("Benchmark notification hide failed");
      }
      await tx.delete(benchmarkHistory).where(eq(benchmarkHistory.benchmarkId, id));
      const result = await tx.delete(benchmarks).where(eq(benchmarks.id, id));
      if ((result.rowCount || 0) === 0) throw new Error("Benchmark parent delete failed");
      return true;
    });
  }

  async getBenchmarkHistory(benchmarkId: string): Promise<BenchmarkHistory[]> {
    return db.select().from(benchmarkHistory)
      .where(eq(benchmarkHistory.benchmarkId, benchmarkId))
      .orderBy(benchmarkHistory.recordedAt);
  }

  async recordBenchmarkHistory(historyData: InsertBenchmarkHistory & { recordedAt?: Date } & GA4RefreshWriteInput): Promise<BenchmarkHistory> {
    const { refreshScope, publicationVersion, ...values } = historyData;
    const guarded = "refreshScope" in historyData;
    const benchmarkId = String((historyData as any)?.benchmarkId || "").trim();
    const notes = String((historyData as any)?.notes || "");
    const isAutomaticGA4Daily = notes.startsWith("auto:ga4_daily:");
    const save = async (tx: any) => {
      if (guarded) {
        const [parent] = await tx.select({ id: benchmarks.id, benchmarkValue: benchmarks.benchmarkValue }).from(benchmarks).where(and(
          eq(benchmarks.id, benchmarkId), eq(benchmarks.campaignId, refreshScope!.campaignId), eq(benchmarks.platformType, "google_analytics"),
        )).for("update");
        if (!parent || !(values.recordedAt instanceof Date) || values.recordedAt.toISOString().slice(0, 10) !== refreshScope!.reportingDate ||
            !notes.startsWith(`auto:ga4_daily:${refreshScope!.reportingDate};`) || Number(parent.benchmarkValue) !== Number(values.benchmarkValue)) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        await tx.update(benchmarks).set({ currentValue: values.currentValue, updatedAt: new Date() }).where(eq(benchmarks.id, benchmarkId));
      }
      if (isAutomaticGA4Daily) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`benchmark_history:${benchmarkId}`}, 0))`);
      }
      const [existing] = await tx.select({ id: benchmarks.id }).from(benchmarks).where(eq(benchmarks.id, benchmarkId)).limit(1);
      if (!existing) throw new Error("Benchmark not found");
      if (isAutomaticGA4Daily) {
        const recorded = await tx.select().from(benchmarkHistory).where(and(
          eq(benchmarkHistory.benchmarkId, benchmarkId),
          eq(benchmarkHistory.notes, notes),
        )).limit(2);
        if (recorded.length > 1) throw new Error("Benchmark automatic history is ambiguous");
        if (recorded.length === 1) {
          const { currentValue, benchmarkValue, variance, performanceRating } = historyData;
          const [updated] = await tx.update(benchmarkHistory)
            .set({ currentValue, benchmarkValue, variance, performanceRating })
            .where(and(eq(benchmarkHistory.id, recorded[0].id), eq(benchmarkHistory.benchmarkId, benchmarkId), eq(benchmarkHistory.notes, notes)))
            .returning();
          if (!updated) throw new Error("Benchmark automatic history update did not change a row");
          return updated;
        }
      }
      const [history] = await tx.insert(benchmarkHistory).values(values).returning();
      return history;
    };
    if (guarded) return this.writeWithGA4RefreshOwnership(refreshScope, save);
    const parent = await this.getBenchmark(benchmarkId);
    return parent?.campaignId && ['', 'campaign', 'google_analytics'].includes(String(parent.platformType || '').trim().toLowerCase())
      ? this.writeGA4DerivedChange(parent.campaignId, historyData, save) : db.transaction(save);
  }

  // Metric Snapshot methods
  async getCampaignSnapshots(campaignId: string): Promise<MetricSnapshot[]> {
    return db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        ne(metricSnapshots.snapshotType, 'financial_daily'),
        ne(metricSnapshots.snapshotType, 'executive_summary_daily'),
      ))
      .orderBy(desc(metricSnapshots.recordedAt));
  }

  async getCampaignSnapshotsByPeriod(campaignId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<MetricSnapshot[]> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'daily':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        break;
      case 'weekly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'monthly':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        break;
    }

    return db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        ne(metricSnapshots.snapshotType, 'financial_daily'),
        ne(metricSnapshots.snapshotType, 'executive_summary_daily'),
        sql`${metricSnapshots.recordedAt} >= ${startDate}`
      ))
      .orderBy(metricSnapshots.recordedAt);
  }

  async getSnapshotByDate(campaignId: string, date: Date): Promise<MetricSnapshot | undefined> {
    const [snapshot] = await db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        ne(metricSnapshots.snapshotType, 'financial_daily'),
        ne(metricSnapshots.snapshotType, 'executive_summary_daily'),
        eq(metricSnapshots.recordedAt, date)
      ))
      .limit(1);
    return snapshot || undefined;
  }

  async createMetricSnapshot(snapshotData: InsertMetricSnapshot & GA4RefreshWriteInput): Promise<MetricSnapshot> {
    if (snapshotData.snapshotType === 'financial_daily' || snapshotData.reportingDate != null) {
      throw new Error('Use upsertFinancialDailySnapshot for reporting-day financial snapshots');
    }
    const { refreshScope, publicationVersion, ...values } = snapshotData;
    const guarded = "refreshScope" in snapshotData;
    const save = async (tx: any) => {
      if (guarded) {
        if (values.campaignId !== refreshScope!.campaignId || values.snapshotType !== 'platform_sync') {
          throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        }
        // One aggregate per durable work item, including a repeated/recovered attempt.
        const notes = `ga4_refresh_work_v1:${refreshScope!.work.id}`;
        const existing = await tx.select({ id: metricSnapshots.id }).from(metricSnapshots).where(and(
          eq(metricSnapshots.campaignId, values.campaignId), eq(metricSnapshots.snapshotType, 'platform_sync'),
          eq(metricSnapshots.notes, notes),
        )).limit(2);
        if (existing.length > 1) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        if (existing.length) {
          const [snapshot] = await tx.update(metricSnapshots).set({ ...values, notes, recordedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(metricSnapshots.id, existing[0].id)).returning();
          return snapshot;
        }
        const [snapshot] = await tx.insert(metricSnapshots).values({ ...values, notes }).returning();
        return snapshot;
      }
      const [snapshot] = await tx.insert(metricSnapshots).values(values).returning();
      return snapshot;
    };
    return this.writeGA4DerivedChange(values.campaignId, snapshotData, save);
  }

  async upsertFinancialDailySnapshot(snapshotData: FinancialDailySnapshotInput & GA4RefreshWriteInput & { revenuePublication?: GA4RevenuePublication }): Promise<MetricSnapshot> {
    const { refreshScope, publicationVersion, revenuePublication, ...values } = snapshotData;
    const guarded = "refreshScope" in snapshotData;
    const snapshotInput = financialDailySnapshotInputSchema.parse(values);
    const { campaignId, reportingDate, ...financialDaily } = snapshotInput;
    const save = async (tx: any) => {
      if (guarded && (campaignId !== refreshScope!.campaignId || reportingDate !== refreshScope!.reportingDate)) {
        throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      if (revenuePublication) {
        const current = await this.readGA4RevenuePublication(tx, campaignId, reportingDate);
        if (revenuePublication.version !== 1 || revenuePublication.reportingDate !== reportingDate
          || Object.keys(current.sources).length !== Object.keys(revenuePublication.sources || {}).length
          || Object.entries(current.sources).some(([sourceId, hash]) => revenuePublication.sources[sourceId] !== hash)) throw new Error('GA4_REFRESH_PUBLICATION_CHANGED');
      }
      const [snapshot] = await tx
        .insert(metricSnapshots)
        .values({
          campaignId,
          totalConversions: snapshotInput.inputs.conversions.value ?? 0,
          totalSpend: snapshotInput.inputs.spend.value ?? "0",
          metrics: { financialDaily, ...(revenuePublication ? { revenuePublication: { ...revenuePublication,
            ...(refreshScope ? { workId: refreshScope.work.id } : {}) } } : {}) },
          snapshotType: 'financial_daily',
          reportingDate,
        })
        .onConflictDoUpdate({
          target: [metricSnapshots.campaignId, metricSnapshots.reportingDate],
          targetWhere: sql`${metricSnapshots.snapshotType} = 'financial_daily' AND ${metricSnapshots.reportingDate} IS NOT NULL`,
          set: {
            totalConversions: sql`EXCLUDED.total_conversions`,
            totalSpend: sql`EXCLUDED.total_spend`,
            metrics: sql`EXCLUDED.metrics`,
            recordedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning();
      return snapshot;
    };
    return this.writeGA4DerivedChange(campaignId, snapshotData, save);
  }

  async upsertExecutiveSummaryDailySnapshot(snapshotData: ExecutiveSummaryDailySnapshotInput & GA4RefreshWriteInput): Promise<MetricSnapshot> {
    const { refreshScope, publicationVersion, ...values } = snapshotData;
    const guarded = "refreshScope" in snapshotData;
    const snapshotInput = executiveSummaryDailySnapshotInputSchema.parse(values);
    const { campaignId, reportingDate, ...executiveSummaryDaily } = snapshotInput;
    const save = async (tx: any) => {
      if (guarded && (campaignId !== refreshScope!.campaignId || reportingDate !== refreshScope!.reportingDate)) {
        throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      const receipt = guarded ? `ga4_refresh_publication_v1:${refreshScope!.work.id}:${createHash("sha256").update(refreshScope!.work.leaseToken).digest("hex")}` : null;
      const [snapshot] = await tx
        .insert(metricSnapshots)
        .values({
          campaignId,
          totalConversions: snapshotInput.totals.conversions.value ?? 0,
          totalSpend: (snapshotInput.totals.spend.value ?? 0).toFixed(2),
          metrics: { executiveSummaryDaily },
          snapshotType: 'executive_summary_daily',
          reportingDate,
          notes: receipt,
        })
        .onConflictDoUpdate({
          target: [metricSnapshots.campaignId, metricSnapshots.reportingDate],
          targetWhere: sql`${metricSnapshots.snapshotType} = 'executive_summary_daily' AND ${metricSnapshots.reportingDate} IS NOT NULL`,
          set: {
            totalConversions: sql`EXCLUDED.total_conversions`,
            totalSpend: sql`EXCLUDED.total_spend`,
            metrics: sql`EXCLUDED.metrics`,
            notes: receipt,
            recordedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning();
      return snapshot;
    };
    return this.writeGA4DerivedChange(campaignId, snapshotData, save);
  }

  async invalidateExecutiveSummaryDailySnapshotAlignment(campaignId: string, reportingDate: string, options: GA4RefreshWriteInput = {}): Promise<void> {
    const guarded = "refreshScope" in options;
    const save = async (tx: any) => {
      if (guarded && (campaignId !== options.refreshScope!.campaignId || reportingDate !== options.refreshScope!.reportingDate)) {
        throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      await tx.update(metricSnapshots).set({ notes: null }).where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'executive_summary_daily'),
        eq(metricSnapshots.reportingDate, reportingDate),
        sql`split_part(${metricSnapshots.notes}, ':', 1) = 'ga4_aligned_refresh_v1'`,
      ));
    };
    return this.writeGA4DerivedChange(campaignId, options, save);
  }

  async markExecutiveSummaryDailySnapshotAligned(campaignId: string, reportingDate: string, completedAt: string, options: GA4RefreshWriteInput = {}): Promise<boolean> {
    const guarded = "refreshScope" in options;
    if (!guarded && !await this.getCampaign(campaignId)) return false;
    const marker = `ga4_aligned_refresh_v1:${reportingDate}:${completedAt}`;
    const save = async (tx: any) => {
      if (guarded) {
        if (campaignId !== options.refreshScope!.campaignId || reportingDate !== options.refreshScope!.reportingDate
          || !Number.isFinite(Date.parse(completedAt))) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
        const [work] = await tx.select({ id: ga4RefreshWork.id }).from(ga4RefreshWork).where(and(
          eq(ga4RefreshWork.id, options.refreshScope!.work.id),
          sql`${completedAt}::timestamptz >= ${ga4RefreshWork.startedAt}`,
          sql`${completedAt}::timestamptz >= ${ga4RefreshWork.dueAt}`,
          sql`${completedAt}::timestamptz <= clock_timestamp()`,
        ));
        if (!work) throw new Error("GA4_REFRESH_TARGET_SCOPE_CHANGED");
      }
      const [updated] = await tx.update(metricSnapshots)
        .set({ notes: marker })
        .where(and(
          eq(metricSnapshots.campaignId, campaignId),
          eq(metricSnapshots.snapshotType, 'executive_summary_daily'),
          eq(metricSnapshots.reportingDate, reportingDate),
          guarded ? eq(metricSnapshots.notes, `ga4_refresh_publication_v1:${options.refreshScope!.work.id}:${createHash("sha256").update(options.refreshScope!.work.leaseToken).digest("hex")}`) : undefined,
        ))
        .returning({ id: metricSnapshots.id });
      return Boolean(updated);
    };
    return this.writeGA4DerivedChange(campaignId, options, save);
  }

  async getExecutiveSummaryDailyComparisonData(
    campaignId: string,
    currentReportingDate: string,
    comparisonDate: string,
  ): Promise<{ current: MetricSnapshot | null; previous: MetricSnapshot | null }> {
    const [[currentSnapshot], [previousSnapshot]] = await Promise.all([
      db.select().from(metricSnapshots).where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'executive_summary_daily'),
        eq(metricSnapshots.reportingDate, currentReportingDate),
      )).limit(1),
      db.select().from(metricSnapshots).where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'executive_summary_daily'),
        eq(metricSnapshots.reportingDate, comparisonDate),
      )).limit(1),
    ]);
    const validatedSnapshot = (snapshot: MetricSnapshot | undefined): MetricSnapshot | null => {
      const executiveSummaryDaily = (snapshot?.metrics as any)?.executiveSummaryDaily;
      if (!snapshot || !executiveSummaryDaily || typeof executiveSummaryDaily !== 'object' || Array.isArray(executiveSummaryDaily)) return null;
      return executiveSummaryDailySnapshotInputSchema.safeParse({
        ...executiveSummaryDaily,
        campaignId: snapshot.campaignId,
        reportingDate: snapshot.reportingDate,
      }).success ? snapshot : null;
    };
    return { current: validatedSnapshot(currentSnapshot), previous: validatedSnapshot(previousSnapshot) };
  }

  async getFinancialDailyComparisonData(
    campaignId: string,
    currentReportingDate: string,
    comparisonDate: string,
  ): Promise<{ current: MetricSnapshot | null; previous: MetricSnapshot | null }> {
    const [[currentSnapshot], [previousSnapshot]] = await Promise.all([
      db.select().from(metricSnapshots).where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'financial_daily'),
        eq(metricSnapshots.reportingDate, currentReportingDate),
      )).limit(1),
      db.select().from(metricSnapshots).where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.snapshotType, 'financial_daily'),
        eq(metricSnapshots.reportingDate, comparisonDate),
      )).limit(1),
    ]);
    const validatedSnapshot = (snapshot: MetricSnapshot | undefined): MetricSnapshot | null => {
      const financialDaily = (snapshot?.metrics as any)?.financialDaily;
      if (!snapshot || !financialDaily || typeof financialDaily !== 'object' || Array.isArray(financialDaily)) return null;
      return financialDailySnapshotInputSchema.safeParse({
        ...financialDaily,
        campaignId: snapshot.campaignId,
        reportingDate: snapshot.reportingDate,
      }).success ? snapshot : null;
    };

    return {
      current: validatedSnapshot(currentSnapshot),
      previous: validatedSnapshot(previousSnapshot),
    };
  }

  async getLatestFinancialDailySnapshot(campaignId: string, throughReportingDate: string): Promise<MetricSnapshot | null> {
    const [snapshot] = await db.select().from(metricSnapshots).where(and(
      eq(metricSnapshots.campaignId, campaignId),
      eq(metricSnapshots.snapshotType, 'financial_daily'),
      lte(metricSnapshots.reportingDate, throughReportingDate),
    )).orderBy(desc(metricSnapshots.reportingDate)).limit(1);
    const financialDaily = (snapshot?.metrics as any)?.financialDaily;
    if (!snapshot || !financialDaily || typeof financialDaily !== 'object' || Array.isArray(financialDaily)) return null;
    const campaign = await this.getCampaign(campaignId);
    if (!campaign || financialDaily.currency !== String(campaign.currency || 'USD').trim().toUpperCase()) return null;
    return financialDailySnapshotInputSchema.safeParse({
      ...financialDaily,
      campaignId: snapshot.campaignId,
      reportingDate: snapshot.reportingDate,
    }).success ? snapshot : null;
  }

  async getComparisonData(
    campaignId: string,
    comparisonType: 'yesterday' | 'last_week' | 'last_month',
    reportingTimeZone?: string,
    comparisonDate?: string,
  ): Promise<{ current: MetricSnapshot | null; previous: MetricSnapshot | null }> {
    const comparisonBoundary = getReportingComparisonBoundary(comparisonType, reportingTimeZone);
    const targetDate = comparisonBoundary.endAt;
    const exactComparisonDate = String(comparisonDate || "").trim();

    // Get the most recent snapshot (current)
    const [currentSnapshot] = await db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        ne(metricSnapshots.snapshotType, 'financial_daily'),
        ne(metricSnapshots.snapshotType, 'executive_summary_daily'),
      ))
      .orderBy(desc(metricSnapshots.recordedAt))
      .limit(1);

    // Exact-date consumers must not silently fall back to a different reporting day.
    const previousSnapshotDateFilter = exactComparisonDate
      ? sql`to_char(timezone(${comparisonBoundary.reportingTimeZone}, timezone('UTC', ${metricSnapshots.recordedAt})), 'YYYY-MM-DD') = ${exactComparisonDate}`
      : sql`${metricSnapshots.recordedAt} <= ${targetDate}`;
    const previousSnapshotsQuery = db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        ne(metricSnapshots.snapshotType, 'financial_daily'),
        ne(metricSnapshots.snapshotType, 'executive_summary_daily'),
        previousSnapshotDateFilter,
      ))
      .orderBy(desc(metricSnapshots.recordedAt));
    const previousSnapshots = exactComparisonDate
      ? await previousSnapshotsQuery
      : await previousSnapshotsQuery.limit(1);
    const previousSnapshot = exactComparisonDate
      ? selectStableExactDateSpendSnapshot(previousSnapshots)
      : previousSnapshots[0];

    return {
      current: currentSnapshot || null,
      previous: previousSnapshot || null
    };
  }

  async getBenchmarkAnalytics(benchmarkId: string): Promise<{
    history: BenchmarkHistory[];
    averageVariance: number;
    performanceTrend: string;
    lastPerformanceRating: string;
  }> {
    const history = await this.getBenchmarkHistory(benchmarkId);

    if (history.length === 0) {
      return {
        history: [],
        averageVariance: 0,
        performanceTrend: "neutral",
        lastPerformanceRating: "average"
      };
    }

    const totalVariance = history.reduce((sum, h) => sum + parseFloat(h.variance), 0);
    const averageVariance = totalVariance / history.length;

    const latest = history[history.length - 1];
    const lastPerformanceRating = latest.performanceRating;

    // Calculate trend based on recent history
    let performanceTrend = "neutral";
    if (history.length >= 2) {
      const recent = history.slice(-3); // Last 3 records
      const recentVariances = recent.map(h => parseFloat(h.variance));
      const isImproving = recentVariances.every((v, i) => i === 0 || v >= recentVariances[i - 1]);
      const isDeclining = recentVariances.every((v, i) => i === 0 || v <= recentVariances[i - 1]);

      if (isImproving) performanceTrend = "improving";
      else if (isDeclining) performanceTrend = "declining";
    }

    return {
      history,
      averageVariance,
      performanceTrend,
      lastPerformanceRating
    };
  }

  // KPI Report methods
  async getCampaignKPIReports(campaignId: string): Promise<KPIReport[]> {
    return db.select().from(kpiReports)
      .where(eq(kpiReports.campaignId, campaignId))
      .orderBy(desc(kpiReports.createdAt));
  }

  async getKPIReport(id: string): Promise<KPIReport | undefined> {
    const [report] = await db.select().from(kpiReports).where(eq(kpiReports.id, id));
    return report || undefined;
  }

  async createKPIReport(reportData: InsertKPIReport): Promise<KPIReport> {
    const [report] = await db
      .insert(kpiReports)
      .values(reportData)
      .returning();
    return report;
  }

  async updateKPIReport(id: string, updateData: Partial<InsertKPIReport>): Promise<KPIReport | undefined> {
    const [report] = await db
      .update(kpiReports)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(kpiReports.id, id))
      .returning();
    return report || undefined;
  }

  async deleteKPIReport(id: string): Promise<boolean> {
    const result = await db
      .delete(kpiReports)
      .where(eq(kpiReports.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Notification methods
  async getNotifications(): Promise<Notification[]> {
    return db.select().from(notifications).orderBy(notifications.createdAt);
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification || undefined;
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const [notification] = await db
      .insert(notifications)
      .values(notificationData)
      .returning();
    return notification;
  }

  async updateNotification(id: string, updateData: Partial<InsertNotification>): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set(updateData)
      .where(eq(notifications.id, id))
      .returning();
    return notification || undefined;
  }

  async deleteNotification(id: string): Promise<boolean> {
    // User-facing dismiss/clear flows must soft-hide notifications to preserve alert history.
    const result = await db
      .update(notifications)
      .set({
        read: true,
        metadata: sql`(COALESCE(NULLIF(${notifications.metadata}, '')::jsonb, '{}'::jsonb) || jsonb_build_object('dismissedAt', NOW(), 'dismissedBy', 'system', 'dismissalReason', 'deleted_via_storage'))::text`,
      })
      .where(eq(notifications.id, id))
      .returning();
    return Array.isArray(result) ? result.length > 0 : (result.rowCount || 0) > 0;
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    await db
      .update(notifications)
      .set({ read: true });
    return true;
  }

  // Client methods
  async getClients(ownerId: string): Promise<Client[]> {
    return db.select().from(clients).where(eq(clients.ownerId, ownerId)).orderBy(clients.createdAt);
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async deleteClientCascade(ownerId: string, clientId: string): Promise<boolean> {
    return db.transaction(async (tx: any) => {
    const [client] = await tx
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).for('update');
    if (!client) return false;

    const foreignCampaigns = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(
        eq(campaigns.clientId, clientId),
        sql`COALESCE(${campaigns.ownerId}, '') NOT IN (${ownerId}, '')`,
      ));
    if (foreignCampaigns.length > 0) {
      console.warn(`[Client Delete] Refusing to delete client ${clientId}: contains campaigns outside owner scope`);
      return false;
    }

    const clientCampaigns = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(
        eq(campaigns.clientId, clientId),
        or(eq(campaigns.ownerId, ownerId), isNull(campaigns.ownerId)),
      ));

      for (const campaign of clientCampaigns) {
        const [locked] = await tx.select({ id: campaigns.id }).from(campaigns).where(and(
          eq(campaigns.id, String(campaign.id)), eq(campaigns.clientId, clientId),
          or(eq(campaigns.ownerId, ownerId), isNull(campaigns.ownerId)),
        )).for("update");
        if (!locked) throw new Error("Campaign ownership changed during client deletion");
        await this.deleteCampaignChildren(String(campaign.id), tx);
        await tx.delete(campaigns).where(eq(campaigns.id, String(campaign.id)));
      }
      const deleted = await tx.delete(clients).where(and(eq(clients.id, clientId), eq(clients.ownerId, ownerId))).returning({ id: clients.id });
      return deleted.length === 1;
    });
  }

  // A/B Test methods
  async getCampaignABTests(campaignId: string): Promise<ABTest[]> {
    return await db.select().from(abTests).where(eq(abTests.campaignId, campaignId)).orderBy(abTests.createdAt);
  }

  async getABTest(testId: string): Promise<ABTest | undefined> {
    const [test] = await db.select().from(abTests).where(eq(abTests.id, testId));
    return test || undefined;
  }

  async createABTest(testData: InsertABTest): Promise<ABTest> {
    const [test] = await db
      .insert(abTests)
      .values(testData)
      .returning();
    return test;
  }

  async updateABTest(testId: string, updateData: Partial<InsertABTest>): Promise<ABTest | undefined> {
    const [test] = await db
      .update(abTests)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(abTests.id, testId))
      .returning();
    return test || undefined;
  }

  async deleteABTest(testId: string): Promise<boolean> {
    // Also delete related variants, results, and events
    await db.delete(abTestEvents).where(eq(abTestEvents.testId, testId));
    await db.delete(abTestResults).where(eq(abTestResults.testId, testId));
    await db.delete(abTestVariants).where(eq(abTestVariants.testId, testId));

    const result = await db.delete(abTests).where(eq(abTests.id, testId));
    return (result.rowCount || 0) > 0;
  }

  // A/B Test Variant methods
  async getABTestVariants(testId: string): Promise<ABTestVariant[]> {
    return await db.select().from(abTestVariants).where(eq(abTestVariants.testId, testId)).orderBy(abTestVariants.name);
  }

  async createABTestVariant(variantData: InsertABTestVariant): Promise<ABTestVariant> {
    const [variant] = await db
      .insert(abTestVariants)
      .values(variantData)
      .returning();
    return variant;
  }

  async updateABTestVariant(variantId: string, updateData: Partial<InsertABTestVariant>): Promise<ABTestVariant | undefined> {
    const [variant] = await db
      .update(abTestVariants)
      .set(updateData)
      .where(eq(abTestVariants.id, variantId))
      .returning();
    return variant || undefined;
  }

  async deleteABTestVariant(variantId: string): Promise<boolean> {
    // Also delete related results and events
    await db.delete(abTestEvents).where(eq(abTestEvents.variantId, variantId));
    await db.delete(abTestResults).where(eq(abTestResults.variantId, variantId));

    const result = await db.delete(abTestVariants).where(eq(abTestVariants.id, variantId));
    return (result.rowCount || 0) > 0;
  }

  // A/B Test Result methods
  async getABTestResults(testId: string): Promise<ABTestResult[]> {
    return await db.select().from(abTestResults).where(eq(abTestResults.testId, testId)).orderBy(abTestResults.updatedAt);
  }

  async getABTestResult(testId: string, variantId: string): Promise<ABTestResult | undefined> {
    const [result] = await db.select()
      .from(abTestResults)
      .where(and(eq(abTestResults.testId, testId), eq(abTestResults.variantId, variantId)));
    return result || undefined;
  }

  async updateABTestResult(testId: string, variantId: string, resultData: Partial<InsertABTestResult>): Promise<ABTestResult> {
    // Try to update existing result first
    const [existing] = await db
      .update(abTestResults)
      .set({ ...resultData, updatedAt: new Date() })
      .where(and(eq(abTestResults.testId, testId), eq(abTestResults.variantId, variantId)))
      .returning();

    if (existing) {
      return existing;
    }

    // If no existing result, create new one
    const [newResult] = await db
      .insert(abTestResults)
      .values({
        testId,
        variantId,
        ...resultData,
      } as InsertABTestResult)
      .returning();

    return newResult;
  }

  // A/B Test Event methods
  async recordABTestEvent(eventData: InsertABTestEvent): Promise<ABTestEvent> {
    const [event] = await db
      .insert(abTestEvents)
      .values(eventData)
      .returning();

    // Update aggregate results
    await this.updateAggregateResults(eventData.testId, eventData.variantId, eventData.eventType, parseFloat(eventData.eventValue?.toString() || "0"));

    return event;
  }

  async getABTestEvents(testId: string, variantId?: string): Promise<ABTestEvent[]> {
    if (variantId) {
      return await db.select()
        .from(abTestEvents)
        .where(and(eq(abTestEvents.testId, testId), eq(abTestEvents.variantId, variantId)))
        .orderBy(abTestEvents.occurredAt);
    }

    return await db.select()
      .from(abTestEvents)
      .where(eq(abTestEvents.testId, testId))
      .orderBy(abTestEvents.occurredAt);
  }

  // Helper method to update aggregate results
  private async updateAggregateResults(testId: string, variantId: string, eventType: string, eventValue: number): Promise<void> {
    const existingResult = await this.getABTestResult(testId, variantId);

    const updateData: Partial<InsertABTestResult> = {};

    switch (eventType) {
      case 'impression':
        updateData.impressions = (existingResult?.impressions || 0) + 1;
        break;
      case 'click':
        updateData.clicks = (existingResult?.clicks || 0) + 1;
        break;
      case 'conversion':
        updateData.conversions = (existingResult?.conversions || 0) + 1;
        updateData.revenue = ((parseFloat(existingResult?.revenue?.toString() || "0") + eventValue).toFixed(2));
        break;
    }

    // Calculate derived metrics
    if (updateData.impressions || updateData.clicks || updateData.conversions) {
      const impressions = updateData.impressions || existingResult?.impressions || 0;
      const clicks = updateData.clicks || existingResult?.clicks || 0;
      const conversions = updateData.conversions || existingResult?.conversions || 0;

      if (impressions > 0) {
        updateData.clickThroughRate = (((clicks / impressions) * 100).toFixed(2));
        updateData.conversionRate = (((conversions / impressions) * 100).toFixed(2));
      }

      if (clicks > 0) {
        const revenue = parseFloat(updateData.revenue?.toString() || existingResult?.revenue?.toString() || "0");
        updateData.revenuePerVisitor = (revenue / clicks).toFixed(2);
      }
    }

    await this.updateABTestResult(testId, variantId, updateData);
  }

  // A/B Test Analytics methods
  async getABTestAnalytics(testId: string): Promise<{
    test: ABTest;
    variants: ABTestVariant[];
    results: ABTestResult[];
    statisticalSignificance: boolean;
    confidenceLevel: number;
    winnerVariant?: string;
  }> {
    const test = await this.getABTest(testId);
    if (!test) {
      throw new Error(`A/B Test with ID ${testId} not found`);
    }

    const variants = await this.getABTestVariants(testId);
    const results = await this.getABTestResults(testId);

    // Calculate statistical significance
    const { significance, winner } = this.calculateStatisticalSignificance(results, parseFloat(test.confidenceLevel || "95"));

    return {
      test,
      variants,
      results,
      statisticalSignificance: significance,
      confidenceLevel: parseFloat(test.confidenceLevel || "95"),
      winnerVariant: winner
    };
  }

  // Helper method for statistical significance calculation
  private calculateStatisticalSignificance(results: ABTestResult[], confidenceLevel: number): { significance: boolean; winner?: string } {
    if (results.length < 2) {
      return { significance: false };
    }

    // Simple statistical significance calculation
    // In a production system, you would use proper statistical tests (z-test, t-test, etc.)
    const controlResult = results.find(r => r.variantId === 'A') || results[0];
    const testResults = results.filter(r => r.variantId !== controlResult.variantId);

    let bestResult = controlResult;
    let significantDifference = false;

    for (const testResult of testResults) {
      // Calculate conversion rates
      const controlRate = controlResult.impressions > 0 ? (controlResult.conversions / controlResult.impressions) : 0;
      const testRate = testResult.impressions > 0 ? (testResult.conversions / testResult.impressions) : 0;

      // Simple significance check: 
      // - Minimum sample size of 100 per variant
      // - At least 20% difference in conversion rates
      // - Both variants have reasonable sample sizes
      const minSampleSize = 100;
      const minDifference = 0.2; // 20%

      if (controlResult.impressions >= minSampleSize &&
        testResult.impressions >= minSampleSize) {
        const difference = Math.abs(testRate - controlRate);
        const relativeDifference = controlRate > 0 ? difference / controlRate : 0;

        if (relativeDifference >= minDifference) {
          significantDifference = true;
          if (testRate > controlRate && testResult.conversions > bestResult.conversions) {
            bestResult = testResult;
          }
        }
      }
    }

    return {
      significance: significantDifference,
      winner: significantDifference ? bestResult.variantId : undefined
    };
  }

  // Attribution Model methods
  async getAttributionModels(ownerId?: string): Promise<AttributionModel[]> {
    return db.select().from(attributionModels).where(ownerId ? eq(attributionModels.ownerId, ownerId) : undefined).orderBy(desc(attributionModels.createdAt));
  }

  async getAttributionModel(id: string): Promise<AttributionModel | undefined> {
    const [row] = await db.select().from(attributionModels).where(eq(attributionModels.id, id));
    return row;
  }

  async createAttributionModel(modelData: InsertAttributionModel, ownerId?: string): Promise<AttributionModel> {
    const id = randomUUID();
    const model: AttributionModel = {
      id,
      ownerId: ownerId || null,
      name: modelData.name,
      type: modelData.type,
      description: modelData.description || null,
      configuration: modelData.configuration || null,
      isDefault: modelData.isDefault || false,
      isActive: modelData.isActive !== undefined ? modelData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(attributionModels).values(model);
    return model;
  }

  async updateAttributionModel(id: string, modelData: Partial<InsertAttributionModel>): Promise<AttributionModel | undefined> {
    const existing = await this.getAttributionModel(id);
    if (!existing) return undefined;

    const updated: AttributionModel = {
      ...existing,
      ...modelData,
      id: existing.id,
      ownerId: existing.ownerId,
      updatedAt: new Date(),
    };

    await db.update(attributionModels).set(updated).where(eq(attributionModels.id, id));
    return updated;
  }

  async deleteAttributionModel(id: string): Promise<boolean> {
    return db.transaction(async (tx: any) => {
      const [model] = await tx.select().from(attributionModels).where(eq(attributionModels.id, id)).for("update");
      if (!model) return false;
      await tx.delete(attributionResults).where(eq(attributionResults.attributionModelId, id));
      await tx.delete(attributionInsights).where(eq(attributionInsights.attributionModelId, id));
      const deleted = await tx.delete(attributionModels).where(eq(attributionModels.id, id)).returning();
      return deleted.length > 0;
    });
  }

  async setDefaultAttributionModel(id: string): Promise<boolean> {
    return db.transaction(async (tx: any) => {
      const model = await this.getAttributionModel(id);
      if (!model?.ownerId) return false;
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`attribution-default:${model.ownerId}`}))`);
      await tx.update(attributionModels).set({ isDefault: false, updatedAt: new Date() }).where(eq(attributionModels.ownerId, model.ownerId));
      const updated = await tx.update(attributionModels).set({ isDefault: true, updatedAt: new Date() }).where(and(eq(attributionModels.id, id), eq(attributionModels.ownerId, model.ownerId))).returning();
      return updated.length > 0;
    });
  }

  // Customer Journey methods
  async getCustomerJourneys(status?: string, ownerId?: string): Promise<CustomerJourney[]> {
    return db.select().from(customerJourneys).where(and(status ? eq(customerJourneys.status, status) : undefined, ownerId ? eq(customerJourneys.ownerId, ownerId) : undefined)).orderBy(desc(customerJourneys.createdAt));
  }

  async getCustomerJourney(id: string): Promise<CustomerJourney | undefined> {
    const [row] = await db.select().from(customerJourneys).where(eq(customerJourneys.id, id));
    return row;
  }

  async createCustomerJourney(journeyData: InsertCustomerJourney, ownerId?: string): Promise<CustomerJourney> {
    const id = randomUUID();
    const journey: CustomerJourney = {
      id,
      ownerId: ownerId || null,
      customerId: journeyData.customerId,
      sessionId: journeyData.sessionId || null,
      deviceId: journeyData.deviceId || null,
      userId: journeyData.userId || null,
      journeyStart: journeyData.journeyStart,
      journeyEnd: journeyData.journeyEnd || null,
      totalTouchpoints: journeyData.totalTouchpoints || 0,
      conversionValue: journeyData.conversionValue || null,
      conversionType: journeyData.conversionType || null,
      status: journeyData.status || "active",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.insert(customerJourneys).values(journey);
    return journey;
  }

  async updateCustomerJourney(id: string, journeyData: Partial<InsertCustomerJourney>): Promise<CustomerJourney | undefined> {
    const existing = await this.getCustomerJourney(id);
    if (!existing) return undefined;

    const updated: CustomerJourney = {
      ...existing,
      ...journeyData,
      id: existing.id,
      ownerId: existing.ownerId,
      updatedAt: new Date(),
    };

    await db.update(customerJourneys).set(updated).where(eq(customerJourneys.id, id));
    return updated;
  }

  async deleteCustomerJourney(id: string): Promise<boolean> {
    // Also delete related touchpoints and attribution results
    return db.transaction(async (tx: any) => {
      const [journey] = await tx.select().from(customerJourneys).where(eq(customerJourneys.id, id)).for("update");
      if (!journey) return false;
      await tx.delete(attributionResults).where(eq(attributionResults.journeyId, id));
      await tx.delete(touchpoints).where(eq(touchpoints.journeyId, id));
      const deleted = await tx.delete(customerJourneys).where(eq(customerJourneys.id, id)).returning();
      return deleted.length > 0;
    });
  }

  // Touchpoint methods
  async getJourneyTouchpoints(journeyId: string): Promise<Touchpoint[]> {
    return db.select().from(touchpoints).where(eq(touchpoints.journeyId, journeyId)).orderBy(touchpoints.position, touchpoints.id);
  }

  async getCampaignTouchpoints(campaignId: string): Promise<Touchpoint[]> {
    const rows = await db.select({ touchpoint: touchpoints }).from(touchpoints)
      .innerJoin(customerJourneys, eq(customerJourneys.id, touchpoints.journeyId))
      .innerJoin(campaigns, and(eq(campaigns.id, touchpoints.campaignId), eq(campaigns.ownerId, customerJourneys.ownerId)))
      .where(eq(campaigns.id, campaignId)).orderBy(desc(touchpoints.timestamp), touchpoints.id);
    return rows.map((row: any) => row.touchpoint);
  }

  async createTouchpoint(touchpointData: InsertTouchpoint): Promise<Touchpoint> {
    return db.transaction(async (tx: any) => {
    const [journey] = await tx.select().from(customerJourneys).where(eq(customerJourneys.id, touchpointData.journeyId)).for("update");
    if (!journey?.ownerId) throw new Error("Journey unavailable");
    if (touchpointData.campaignId) {
      const [campaign] = await tx.select().from(campaigns).where(eq(campaigns.id, touchpointData.campaignId)).for("share");
      if (!campaign || campaign.ownerId !== journey.ownerId) throw new Error("Campaign unavailable");
    }
    const id = randomUUID();
    const touchpoint: Touchpoint = {
      id,
      journeyId: touchpointData.journeyId,
      campaignId: touchpointData.campaignId || null,
      channel: touchpointData.channel,
      platform: touchpointData.platform || null,
      medium: touchpointData.medium || null,
      source: touchpointData.source || null,
      campaign: touchpointData.campaign || null,
      content: touchpointData.content || null,
      term: touchpointData.term || null,
      touchpointType: touchpointData.touchpointType,
      position: touchpointData.position,
      timestamp: touchpointData.timestamp,
      deviceType: touchpointData.deviceType || null,
      userAgent: touchpointData.userAgent || null,
      ipAddress: touchpointData.ipAddress || null,
      referrer: touchpointData.referrer || null,
      landingPage: touchpointData.landingPage || null,
      eventValue: touchpointData.eventValue || null,
      metadata: touchpointData.metadata || null,
      createdAt: new Date(),
    };

    await tx.insert(touchpoints).values(touchpoint);

    // Update journey touchpoint count
    if (journey) {
      const updated = {
        ...journey,
        totalTouchpoints: journey.totalTouchpoints + 1,
        updatedAt: new Date()
      };
      await tx.update(customerJourneys).set(updated).where(eq(customerJourneys.id, journey.id));
    }

    return touchpoint;
    });
  }

  async updateTouchpoint(id: string, touchpointData: Partial<InsertTouchpoint>): Promise<Touchpoint | undefined> {
    const [existing] = await db.select().from(touchpoints).where(eq(touchpoints.id, id));
    if (!existing) return undefined;

    const updated: Touchpoint = {
      ...existing,
      ...touchpointData,
      id: existing.id,
      journeyId: existing.journeyId,
      campaignId: existing.campaignId,
    };

    await db.update(touchpoints).set(updated).where(eq(touchpoints.id, id));
    return updated;
  }

  async deleteTouchpoint(id: string): Promise<boolean> {
    return db.transaction(async (tx: any) => {
    const [candidate] = await tx.select().from(touchpoints).where(eq(touchpoints.id, id));
    if (!candidate) return false;

    // Update journey touchpoint count
    const [journey] = await tx.select().from(customerJourneys).where(eq(customerJourneys.id, candidate.journeyId)).for("update");
    const [touchpoint] = await tx.select().from(touchpoints).where(eq(touchpoints.id, id)).for("update");
    if (!touchpoint) return false;
    if (journey) {
      const updated = {
        ...journey,
        totalTouchpoints: Math.max(0, journey.totalTouchpoints - 1),
        updatedAt: new Date()
      };
      await tx.update(customerJourneys).set(updated).where(eq(customerJourneys.id, journey.id));
    }

    await tx.delete(attributionResults).where(eq(attributionResults.touchpointId, id));
    await tx.delete(touchpoints).where(eq(touchpoints.id, id));
    return true;
    });
  }

  // Attribution Result methods
  async getAttributionResults(journeyId?: string, modelId?: string): Promise<AttributionResult[]> {
    let results: AttributionResult[] = await db.select().from(attributionResults).where(and(journeyId ? eq(attributionResults.journeyId, journeyId) : undefined, modelId ? eq(attributionResults.attributionModelId, modelId) : undefined));

    if (journeyId) {
      results = results.filter(result => result.journeyId === journeyId);
    }

    if (modelId) {
      results = results.filter(result => result.attributionModelId === modelId);
    }

    return results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async calculateAttributionResults(journeyId: string, modelId: string): Promise<AttributionResult[]> {
    return db.transaction(async (tx: any) => {
    const [model] = await tx.select().from(attributionModels).where(eq(attributionModels.id, modelId)).for("update");
    const [journey] = await tx.select().from(customerJourneys).where(eq(customerJourneys.id, journeyId)).for("update");
    const journeyTouchpoints: Touchpoint[] = await tx.select().from(touchpoints).where(eq(touchpoints.journeyId, journeyId)).orderBy(touchpoints.position, touchpoints.id);

    if (!journey?.ownerId || !model || journey.ownerId !== model.ownerId || journeyTouchpoints.length === 0) {
      return [];
    }

    // Delete existing results for this journey/model combination
    await tx.delete(attributionResults).where(and(eq(attributionResults.journeyId, journeyId), eq(attributionResults.attributionModelId, modelId)));

    const results: AttributionResult[] = [];
    const conversionValue = parseFloat(journey.conversionValue?.toString() || "0");

    // Calculate attribution based on model type
    for (let i = 0; i < journeyTouchpoints.length; i++) {
      const touchpoint = journeyTouchpoints[i];
      let credit = 0;

      switch (model.type) {
        case 'first_touch':
          credit = i === 0 ? 1.0 : 0.0;
          break;

        case 'last_touch':
          credit = i === journeyTouchpoints.length - 1 ? 1.0 : 0.0;
          break;

        case 'linear':
          credit = 1.0 / journeyTouchpoints.length;
          break;

        case 'time_decay':
          const config = JSON.parse(model.configuration || '{"decayRate": 0.5, "halfLife": 7}');
          const daysSinceTouch = Math.max(0,
            (new Date(journey.journeyEnd || new Date()).getTime() - new Date(touchpoint.timestamp).getTime())
            / (1000 * 60 * 60 * 24)
          );
          credit = Math.pow(config.decayRate, daysSinceTouch / config.halfLife);
          break;

        case 'position_based':
          const posConfig = JSON.parse(model.configuration || '{"firstWeight": 0.4, "lastWeight": 0.4, "middleWeight": 0.2}');
          if (journeyTouchpoints.length === 1) {
            credit = 1.0;
          } else if (journeyTouchpoints.length === 2) {
            credit = i === 0 ? posConfig.firstWeight + posConfig.middleWeight / 2 : posConfig.lastWeight + posConfig.middleWeight / 2;
          } else {
            if (i === 0) credit = posConfig.firstWeight;
            else if (i === journeyTouchpoints.length - 1) credit = posConfig.lastWeight;
            else credit = posConfig.middleWeight / (journeyTouchpoints.length - 2);
          }
          break;
      }

      // Normalize time decay credits
      if (model.type === 'time_decay' && journeyTouchpoints.length > 1) {
        const totalCredits = journeyTouchpoints.reduce((sum, tp, idx) => {
          const config = JSON.parse(model.configuration || '{"decayRate": 0.5, "halfLife": 7}');
          const daysSinceTouch = Math.max(0,
            (new Date(journey.journeyEnd || new Date()).getTime() - new Date(tp.timestamp).getTime())
            / (1000 * 60 * 60 * 24)
          );
          return sum + Math.pow(config.decayRate, daysSinceTouch / config.halfLife);
        }, 0);

        if (totalCredits > 0) {
          const config = JSON.parse(model.configuration || '{"decayRate": 0.5, "halfLife": 7}');
          const daysSinceTouch = Math.max(0,
            (new Date(journey.journeyEnd || new Date()).getTime() - new Date(touchpoint.timestamp).getTime())
            / (1000 * 60 * 60 * 24)
          );
          credit = Math.pow(config.decayRate, daysSinceTouch / config.halfLife) / totalCredits;
        }
      }

      const resultId = randomUUID();
      const result: AttributionResult = {
        id: resultId,
        journeyId,
        attributionModelId: modelId,
        touchpointId: touchpoint.id,
        campaignId: touchpoint.campaignId,
        channel: touchpoint.channel,
        attributionCredit: credit.toString(),
        attributedValue: (conversionValue * credit).toString(),
        calculatedAt: new Date(),
        createdAt: new Date(),
      };

      await tx.insert(attributionResults).values(result);
      results.push(result);
    }

    return results;
    });
  }

  async getChannelAttributionResults(channel: string, modelId?: string): Promise<AttributionResult[]> {
    let results: AttributionResult[] = await db.select().from(attributionResults).where(eq(attributionResults.channel, channel));

    if (modelId) {
      results = results.filter(result => result.attributionModelId === modelId);
    }

    return results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Attribution Insight methods
  async getAttributionInsights(modelId?: string, period?: string): Promise<AttributionInsight[]> {
    let insights: AttributionInsight[] = await db.select().from(attributionInsights);

    if (modelId) {
      insights = insights.filter(insight => insight.attributionModelId === modelId);
    }

    if (period) {
      insights = insights.filter(insight => insight.period === period);
    }

    return insights.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getCampaignAttributionInsights(campaignId: string, modelId?: string): Promise<AttributionInsight[]> {
    let insights: AttributionInsight[] = await db.select().from(attributionInsights).where(eq(attributionInsights.campaignId, campaignId));

    if (modelId) {
      insights = insights.filter(insight => insight.attributionModelId === modelId);
    }

    return insights.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async generateAttributionInsights(modelId: string, startDate: Date, endDate: Date): Promise<AttributionInsight[]> {
    const model = await this.getAttributionModel(modelId);
    if (!model) return [];

    // Get all attribution results for the model within the date range
    const results = (await this.getAttributionResults(undefined, modelId))
      .filter(result => {
        if (result.attributionModelId !== modelId) return false;
        const resultDate = new Date(result.calculatedAt);
        return resultDate >= startDate && resultDate <= endDate;
      });

    // Group by channel
    const channelGroups = new Map<string, AttributionResult[]>();
    for (const result of results) {
      const channel = result.channel;
      if (!channelGroups.has(channel)) {
        channelGroups.set(channel, []);
      }
      channelGroups.get(channel)!.push(result);
    }

    const insights: AttributionInsight[] = [];

    for (const [channel, channelResults] of Array.from(channelGroups.entries())) {
      const totalAttributedValue = channelResults.reduce((sum, result) =>
        sum + parseFloat(result.attributedValue as string), 0);
      const totalTouchpoints = channelResults.length;
      const totalConversions = new Set(channelResults.map(r => r.journeyId)).size;
      const averageCredit = channelResults.reduce((sum, result) =>
        sum + parseFloat(result.attributionCredit), 0) / channelResults.length;

      const insightId = randomUUID();
      const insight: AttributionInsight = {
        id: insightId,
        attributionModelId: modelId,
        campaignId: null,
        channel,
        period: "custom",
        startDate,
        endDate,
        totalAttributedValue: totalAttributedValue.toString(),
        totalTouchpoints,
        totalConversions,
        averageAttributionCredit: averageCredit.toString(),
        conversionRate: null,
        costPerAttribution: null,
        returnOnAdSpend: null,
        assistedConversions: null,
        lastClickConversions: null,
        firstClickConversions: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await db.insert(attributionInsights).values(insight);
      insights.push(insight);
    }

    return insights;
  }

  // Attribution Analytics methods
  async getAttributionComparison(journeyId: string): Promise<{
    journey: CustomerJourney;
    touchpoints: Touchpoint[];
    modelResults: { model: AttributionModel; results: AttributionResult[] }[];
  }> {
    const journey = await this.getCustomerJourney(journeyId);
    if (!journey?.ownerId) {
      throw new Error(`Customer journey with ID ${journeyId} not found`);
    }

    const touchpoints = await this.getJourneyTouchpoints(journeyId);
    const models = await this.getAttributionModels(journey.ownerId);

    const modelResults: { model: AttributionModel; results: AttributionResult[] }[] = [];

    for (const model of models.filter(m => m.isActive)) {
      let results = await this.getAttributionResults(journeyId, model.id);

      // If no results exist, calculate them
      if (results.length === 0) {
        results = await this.calculateAttributionResults(journeyId, model.id);
      }

      modelResults.push({ model, results });
    }

    return {
      journey,
      touchpoints,
      modelResults
    };
  }

  async getChannelPerformanceAttribution(startDate: Date, endDate: Date, modelId?: string, ownerId?: string): Promise<{
    channel: string;
    totalAttributedValue: number;
    totalTouchpoints: number;
    averageCredit: number;
    assistedConversions: number;
    lastClickConversions: number;
    firstClickConversions: number;
  }[]> {
    const ownedModels = ownerId ? await this.getAttributionModels(ownerId) : null;
    if (ownedModels && !ownedModels.length) return [];
    let results: AttributionResult[] = (await db.select().from(attributionResults).where(and(
      modelId ? eq(attributionResults.attributionModelId, modelId) : undefined,
      ownedModels ? inArray(attributionResults.attributionModelId, ownedModels.map(model => model.id)) : undefined,
    )))
      .filter((result: AttributionResult) => {
        const resultDate = new Date(result.calculatedAt);
        return resultDate >= startDate && resultDate <= endDate;
      });

    if (modelId) {
      results = results.filter(result => result.attributionModelId === modelId);
    }

    // Group by channel
    const channelGroups = new Map<string, AttributionResult[]>();
    for (const result of results) {
      const channel = result.channel;
      if (!channelGroups.has(channel)) {
        channelGroups.set(channel, []);
      }
      channelGroups.get(channel)!.push(result);
    }

    const performance: {
      channel: string;
      totalAttributedValue: number;
      totalTouchpoints: number;
      averageCredit: number;
      assistedConversions: number;
      lastClickConversions: number;
      firstClickConversions: number;
    }[] = [];

    for (const [channel, channelResults] of Array.from(channelGroups.entries())) {
      const totalAttributedValue = channelResults.reduce((sum, result) =>
        sum + parseFloat(result.attributedValue as string), 0);
      const totalTouchpoints = channelResults.length;
      const averageCredit = channelResults.reduce((sum, result) =>
        sum + parseFloat(result.attributionCredit), 0) / channelResults.length;

      // Calculate assisted conversions (any non-last-touch attribution)
      const assistedConversions = new Set(
        channelResults
          .filter(result => parseFloat(result.attributionCredit) > 0 && parseFloat(result.attributionCredit) < 1)
          .map(result => result.journeyId)
      ).size;

      // For last-click and first-click, we need to get touchpoint positions
      const journeyIds = Array.from(new Set(channelResults.map(r => r.journeyId)));
      let lastClickConversions = 0;
      let firstClickConversions = 0;

      for (const journeyId of journeyIds) {
        const journeyTouchpoints = await this.getJourneyTouchpoints(journeyId);
        const channelTouchpoints = journeyTouchpoints.filter(tp => tp.channel === channel);

        if (channelTouchpoints.length > 0) {
          // Check if this channel was the first touchpoint
          if (journeyTouchpoints[0]?.channel === channel) {
            firstClickConversions++;
          }

          // Check if this channel was the last touchpoint
          const lastTouchpoint = journeyTouchpoints[journeyTouchpoints.length - 1];
          if (lastTouchpoint?.channel === channel) {
            lastClickConversions++;
          }
        }
      }

      performance.push({
        channel,
        totalAttributedValue,
        totalTouchpoints,
        averageCredit,
        assistedConversions,
        lastClickConversions,
        firstClickConversions,
      });
    }

    return performance.sort((a, b) => b.totalAttributedValue - a.totalAttributedValue);
  }
}

export const storage: IStorage = new DatabaseStorage();
