import { type Client, type InsertClient, type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GA4DailyMetric, type InsertGA4DailyMetric, type LinkedInDailyMetric, type InsertLinkedInDailyMetric, type SpendSource, type InsertSpendSource, type SpendRecord, type InsertSpendRecord, type RevenueSource, type InsertRevenueSource, type RevenueRecord, type InsertRevenueRecord, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type HubspotConnection, type InsertHubspotConnection, type SalesforceConnection, type InsertSalesforceConnection, type ShopifyConnection, type InsertShopifyConnection, type LinkedInConnection, type InsertLinkedInConnection, type MetaConnection, type InsertMetaConnection, type MetaDailyMetric, type InsertMetaDailyMetric, type MetaKpi, type InsertMetaKpi, type MetaBenchmark, type InsertMetaBenchmark, type MetaReport, type InsertMetaReport, type GoogleAdsConnection, type InsertGoogleAdsConnection, type GoogleAdsDailyMetric, type InsertGoogleAdsDailyMetric, type LinkedInImportSession, type InsertLinkedInImportSession, type LinkedInImportMetric, type InsertLinkedInImportMetric, type LinkedInAdPerformance, type InsertLinkedInAdPerformance, type LinkedInReport, type InsertLinkedInReport, type CustomIntegration, type InsertCustomIntegration, type CustomIntegrationMetrics, type InsertCustomIntegrationMetrics, type ConversionEvent, type InsertConversionEvent, type KPI, type InsertKPI, type KPIPeriod, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, type KPIReport, type InsertKPIReport, type Benchmark, type InsertBenchmark, type BenchmarkHistory, type InsertBenchmarkHistory, type MetricSnapshot, type InsertMetricSnapshot, type Notification, type InsertNotification, type ABTest, type InsertABTest, type ABTestVariant, type InsertABTestVariant, type ABTestResult, type InsertABTestResult, type ABTestEvent, type InsertABTestEvent, type AttributionModel, type InsertAttributionModel, type CustomerJourney, type InsertCustomerJourney, type Touchpoint, type InsertTouchpoint, type AttributionResult, type InsertAttributionResult, type AttributionInsight, type InsertAttributionInsight, clients, campaigns, metrics, integrations, performanceData, ga4Connections, ga4DailyMetrics, linkedinDailyMetrics, spendSources, spendRecords, revenueSources, revenueRecords, googleSheetsConnections, hubspotConnections, salesforceConnections, shopifyConnections, linkedinConnections, metaConnections, metaDailyMetrics, metaKpis, metaBenchmarks, metaReports, googleAdsConnections, googleAdsDailyMetrics, linkedinImportSessions, linkedinImportMetrics, linkedinAdPerformance, linkedinReports, customIntegrations, customIntegrationMetrics, conversionEvents, kpis, kpiPeriods, kpiProgress, kpiAlerts, kpiReports, benchmarks, benchmarkHistory, metricSnapshots, notifications, abTests, abTestVariants, abTestResults, abTestEvents, attributionModels, customerJourneys, touchpoints, attributionResults, attributionInsights } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, pool } from "./db";
import { eq, and, or, isNull, desc, sql, gte, lte } from "drizzle-orm";
import { buildEncryptedTokens, decryptTokens, type EncryptedTokens } from "./utils/tokenVault";

const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const devLog = (...args: any[]) => {
  if (!isProd) {
    // eslint-disable-next-line no-console
    console.log(...args);
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

export interface IStorage {
  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Metrics
  getMetrics(): Promise<Metric[]>;
  createMetric(metric: InsertMetric): Promise<Metric>;

  // Integrations
  getIntegrations(): Promise<Integration[]>;
  getIntegration(id: string): Promise<Integration | undefined>;
  createIntegration(integration: InsertIntegration): Promise<Integration>;
  updateIntegration(id: string, integration: Partial<InsertIntegration>): Promise<Integration | undefined>;

  // Performance Data
  getPerformanceData(): Promise<PerformanceData[]>;
  createPerformanceData(data: InsertPerformanceData): Promise<PerformanceData>;

  // GA4 Connections
  getGA4Connections(campaignId: string): Promise<GA4Connection[]>;
  getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined>;
  getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined>;
  createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection>;
  updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined>;
  updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined>;
  setPrimaryGA4Connection(campaignId: string, connectionId: string): Promise<boolean>;
  deleteGA4Connection(connectionId: string): Promise<boolean>;

  // GA4 Daily Metrics (daily facts)
  upsertGA4DailyMetrics(rows: InsertGA4DailyMetric[]): Promise<{ upserted: number }>;
  getGA4DailyMetrics(campaignId: string, propertyId: string, startDate: string, endDate: string): Promise<GA4DailyMetric[]>;
  getLatestGA4DailyMetric(campaignId: string, propertyId: string): Promise<GA4DailyMetric | undefined>;

  // LinkedIn Daily Metrics (daily facts)
  upsertLinkedInDailyMetrics(rows: InsertLinkedInDailyMetric[]): Promise<{ upserted: number }>;
  getLinkedInDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<LinkedInDailyMetric[]>;

  // Spend (generic)
  getSpendSources(campaignId: string): Promise<SpendSource[]>;
  getSpendSource(campaignId: string, sourceId: string): Promise<SpendSource | undefined>;
  createSpendSource(source: InsertSpendSource): Promise<SpendSource>;
  updateSpendSource(sourceId: string, source: Partial<InsertSpendSource>): Promise<SpendSource | undefined>;
  deleteSpendSource(sourceId: string): Promise<boolean>;
  deleteSpendRecordsBySource(sourceId: string): Promise<boolean>;
  createSpendRecords(records: InsertSpendRecord[]): Promise<SpendRecord[]>;
  getSpendTotalForRange(campaignId: string, startDate: string, endDate: string): Promise<{ totalSpend: number; currency?: string; sourceIds: string[] }>;
  getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; spend: number; currency?: string }>>;

  // Revenue (generic; platform-scoped to avoid GA4/LinkedIn leakage)
  getRevenueSources(campaignId: string, platformContext?: 'ga4' | 'linkedin' | 'meta'): Promise<RevenueSource[]>;
  getRevenueSource(campaignId: string, sourceId: string): Promise<RevenueSource | undefined>;
  createRevenueSource(source: InsertRevenueSource): Promise<RevenueSource>;
  updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined>;
  deleteRevenueSource(sourceId: string): Promise<boolean>;
  deleteRevenueRecordsBySource(sourceId: string): Promise<boolean>;
  createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]>;
  getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: 'ga4' | 'linkedin'): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }>;
  getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext?: 'ga4' | 'linkedin' | 'meta'): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number; currency?: string }>>;

  // Google Sheets Connections
  getGoogleSheetsConnections(campaignId: string, purpose?: string): Promise<GoogleSheetsConnection[]>;
  getGoogleSheetsConnection(campaignId: string, spreadsheetId?: string): Promise<GoogleSheetsConnection | undefined>;
  getPrimaryGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined>;
  createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection>;
  updateGoogleSheetsConnection(connectionId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined>;
  setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string): Promise<boolean>;
  deleteGoogleSheetsConnection(connectionId: string): Promise<boolean>;

  // HubSpot Connections
  getHubspotConnections(campaignId: string): Promise<HubspotConnection[]>;
  getHubspotConnection(campaignId: string): Promise<HubspotConnection | undefined>;
  createHubspotConnection(connection: InsertHubspotConnection): Promise<HubspotConnection>;
  updateHubspotConnection(connectionId: string, connection: Partial<InsertHubspotConnection>): Promise<HubspotConnection | undefined>;
  deleteHubspotConnection(connectionId: string): Promise<boolean>;

  // Salesforce Connections
  getSalesforceConnections(campaignId: string): Promise<SalesforceConnection[]>;
  getSalesforceConnection(campaignId: string): Promise<SalesforceConnection | undefined>;
  createSalesforceConnection(connection: InsertSalesforceConnection): Promise<SalesforceConnection>;
  updateSalesforceConnection(connectionId: string, connection: Partial<InsertSalesforceConnection>): Promise<SalesforceConnection | undefined>;
  deleteSalesforceConnection(connectionId: string): Promise<boolean>;

  // Shopify Connections
  getShopifyConnections(campaignId: string): Promise<ShopifyConnection[]>;
  getShopifyConnection(campaignId: string): Promise<ShopifyConnection | undefined>;
  createShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection>;
  updateShopifyConnection(connectionId: string, connection: Partial<InsertShopifyConnection>): Promise<ShopifyConnection | undefined>;
  deleteShopifyConnection(connectionId: string): Promise<boolean>;

  // LinkedIn Connections
  getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined>;
  createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection>;
  updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined>;
  deleteLinkedInConnection(campaignId: string): Promise<boolean>;

  // Meta Connections
  getMetaConnection(campaignId: string): Promise<MetaConnection | undefined>;
  createMetaConnection(connection: InsertMetaConnection): Promise<MetaConnection>;
  updateMetaConnection(campaignId: string, connection: Partial<InsertMetaConnection>): Promise<MetaConnection | undefined>;
  deleteMetaConnection(campaignId: string): Promise<boolean>;

  // Google Ads Connections
  getGoogleAdsConnection(campaignId: string): Promise<GoogleAdsConnection | undefined>;
  createGoogleAdsConnection(connection: InsertGoogleAdsConnection): Promise<GoogleAdsConnection>;
  updateGoogleAdsConnection(campaignId: string, connection: Partial<InsertGoogleAdsConnection>): Promise<GoogleAdsConnection | undefined>;
  deleteGoogleAdsConnection(campaignId: string): Promise<boolean>;

  // Google Ads Daily Metrics
  getGoogleAdsDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GoogleAdsDailyMetric[]>;
  upsertGoogleAdsDailyMetrics(metrics: InsertGoogleAdsDailyMetric[]): Promise<{ upserted: number }>;
  updateGoogleAdsDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ googleCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }>;
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
  createPlatformReport(report: any): Promise<LinkedInReport>;
  updatePlatformReport(id: string, report: any): Promise<LinkedInReport | undefined>;
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
  createCustomIntegrationMetrics(metrics: InsertCustomIntegrationMetrics): Promise<CustomIntegrationMetrics>;
  getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined>;

  // Conversion Events
  getConversionEvents(campaignId: string, startDate?: Date, endDate?: Date): Promise<ConversionEvent[]>;
  createConversionEvent(event: InsertConversionEvent): Promise<ConversionEvent>;
  getConversionEventTotalValue(campaignId: string, startDate?: Date, endDate?: Date): Promise<number>;
  getConversionEventCount(campaignId: string, startDate?: Date, endDate?: Date): Promise<number>;

  // KPIs
  getCampaignKPIs(campaignId: string): Promise<KPI[]>;
  getPlatformKPIs(platformType: string, campaignId?: string): Promise<KPI[]>;
  getKPI(id: string): Promise<KPI | undefined>;
  createKPI(kpi: InsertKPI): Promise<KPI>;
  updateKPI(id: string, kpi: Partial<InsertKPI>): Promise<KPI | undefined>;
  deleteKPI(id: string): Promise<boolean>;

  // KPI Progress
  getKPIProgress(kpiId: string): Promise<KPIProgress[]>;
  getLatestKPIPeriod(kpiId: string): Promise<KPIPeriod | null>;
  recordKPIProgress(progress: InsertKPIProgress): Promise<KPIProgress>;

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
  updateBenchmark(id: string, benchmark: Partial<InsertBenchmark>): Promise<Benchmark | undefined>;
  deleteBenchmark(id: string): Promise<boolean>;

  // Benchmark History
  getBenchmarkHistory(benchmarkId: string): Promise<BenchmarkHistory[]>;
  recordBenchmarkHistory(history: InsertBenchmarkHistory): Promise<BenchmarkHistory>;

  // Metric Snapshots
  getCampaignSnapshots(campaignId: string): Promise<MetricSnapshot[]>;
  getCampaignSnapshotsByPeriod(campaignId: string, period: 'daily' | 'weekly' | 'monthly'): Promise<MetricSnapshot[]>;
  getSnapshotByDate(campaignId: string, date: Date): Promise<MetricSnapshot | undefined>;
  createMetricSnapshot(snapshot: InsertMetricSnapshot): Promise<MetricSnapshot>;
  getComparisonData(campaignId: string, comparisonType: 'yesterday' | 'last_week' | 'last_month'): Promise<{
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
  getAttributionModels(): Promise<AttributionModel[]>;
  getAttributionModel(id: string): Promise<AttributionModel | undefined>;
  createAttributionModel(model: InsertAttributionModel): Promise<AttributionModel>;
  updateAttributionModel(id: string, model: Partial<InsertAttributionModel>): Promise<AttributionModel | undefined>;
  deleteAttributionModel(id: string): Promise<boolean>;
  setDefaultAttributionModel(id: string): Promise<boolean>;

  // Customer Journeys
  getCustomerJourneys(status?: string): Promise<CustomerJourney[]>;
  getCustomerJourney(id: string): Promise<CustomerJourney | undefined>;
  createCustomerJourney(journey: InsertCustomerJourney): Promise<CustomerJourney>;
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

  getChannelPerformanceAttribution(startDate: Date, endDate: Date, modelId?: string): Promise<{
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
}

export class DatabaseStorage implements IStorage {
  private attributionModels: Map<string, AttributionModel> = new Map();
  private customerJourneys: Map<string, CustomerJourney> = new Map();
  private touchpoints: Map<string, Touchpoint> = new Map();
  private attributionResults: Map<string, AttributionResult> = new Map();
  private attributionInsights: Map<string, AttributionInsight> = new Map();

  // Campaign methods
  async getCampaigns(): Promise<Campaign[]> {
    return db.select().from(campaigns).orderBy(campaigns.createdAt);
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db
      .insert(campaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }

  async updateCampaign(id: string, updateData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const [campaign] = await db
      .update(campaigns)
      .set(updateData)
      .where(eq(campaigns.id, id))
      .returning();
    return campaign || undefined;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db
      .delete(campaigns)
      .where(eq(campaigns.id, id));
    return (result.rowCount || 0) > 0;
  }

  // Metrics methods
  async getMetrics(): Promise<Metric[]> {
    return db.select().from(metrics).orderBy(metrics.date);
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    const [metric] = await db
      .insert(metrics)
      .values(insertMetric)
      .returning();
    return metric;
  }

  // Integration methods
  async getIntegrations(): Promise<Integration[]> {
    return db.select().from(integrations).orderBy(integrations.createdAt);
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, id));
    return integration || undefined;
  }

  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    const [integration] = await db
      .insert(integrations)
      .values(insertIntegration)
      .returning();
    return integration;
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
  async getPerformanceData(): Promise<PerformanceData[]> {
    return db.select().from(performanceData);
  }

  async createPerformanceData(insertData: InsertPerformanceData): Promise<PerformanceData> {
    const [data] = await db
      .insert(performanceData)
      .values(insertData)
      .returning();
    return data;
  }

  // GA4 Connection methods
  async getGA4Connections(campaignId: string): Promise<GA4Connection[]> {
    const rows = await db
      .select()
      .from(ga4Connections)
      .where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)))
      .orderBy(ga4Connections.connectedAt);
    // Lazy backfill: encrypt legacy plaintext tokens.
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
            .update(ga4Connections)
            .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
            .where(eq(ga4Connections.id, String(r.id)));
        } catch {
          // ignore
        }
      })
    );

    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined> {
    if (propertyId) {
      const [connection] = await db.select().from(ga4Connections)
        .where(and(
          eq(ga4Connections.campaignId, campaignId),
          eq(ga4Connections.propertyId, propertyId),
          eq(ga4Connections.isActive, true)
        ));
      return connection ? (hydrateDecryptedTokens(connection) as any) : undefined;
    }

    // Return the primary connection if no propertyId specified
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));

    if (primary) return hydrateDecryptedTokens(primary) as any;

    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first ? (hydrateDecryptedTokens(first) as any) : undefined;
  }

  async getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));

    if (primary) return hydrateDecryptedTokens(primary) as any;

    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first ? (hydrateDecryptedTokens(first) as any) : undefined;
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    // Check if this is the first connection for this campaign
    const existingConnections = await this.getGA4Connections(connection.campaignId);
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

    const [ga4Connection] = await db
      .insert(ga4Connections)
      .values(connectionData)
      .returning();
    return hydrateDecryptedTokens(ga4Connection) as any;
  }

  async updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const [existing] = await db.select().from(ga4Connections).where(eq(ga4Connections.id, connectionId));
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
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
  }

  async updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined> {
    const [existing] = await db.select().from(ga4Connections).where(eq(ga4Connections.id, connectionId));
    if (!existing) return undefined;

    const nextEnc = buildEncryptedTokens({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      clientSecret: undefined, // preserve
      prev: (existing as any).encryptedTokens,
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
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
  }

  async setPrimaryGA4Connection(campaignId: string, connectionId: string): Promise<boolean> {
    // First, set all connections for this campaign to non-primary
    await db
      .update(ga4Connections)
      .set({ isPrimary: false })
      .where(eq(ga4Connections.campaignId, campaignId));

    // Then set the specified connection as primary
    const [updated] = await db
      .update(ga4Connections)
      .set({ isPrimary: true })
      .where(eq(ga4Connections.id, connectionId))
      .returning();

    return !!updated;
  }

  async deleteGA4Connection(connectionId: string): Promise<boolean> {
    const result = await db
      .delete(ga4Connections)
      .where(eq(ga4Connections.id, connectionId));
    return (result.rowCount || 0) > 0;
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
      const pageviews = Number((r as any)?.pageviews || 0) || 0;
      const conversions = Number((r as any)?.conversions || 0) || 0;
      const revenue = String((r as any)?.revenue ?? "0");
      const engagementRate = (r as any)?.engagementRate ?? null;
      const revenueMetric = (r as any)?.revenueMetric ?? null;
      const isSimulated = Boolean((r as any)?.isSimulated);

      await db.execute(sql`
        INSERT INTO ga4_daily_metrics
          (campaign_id, property_id, date, users, sessions, pageviews, conversions, revenue, engagement_rate, revenue_metric, is_simulated, updated_at)
        VALUES
          (${campaignId}, ${propertyId}, ${date}, ${users}, ${sessions}, ${pageviews}, ${conversions}, ${revenue}, ${engagementRate}, ${revenueMetric}, ${isSimulated}, CURRENT_TIMESTAMP)
        ON CONFLICT (campaign_id, property_id, date)
        DO UPDATE SET
          users = EXCLUDED.users,
          sessions = EXCLUDED.sessions,
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
  async getSpendSources(campaignId: string): Promise<SpendSource[]> {
    return db.select().from(spendSources)
      .where(and(eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, true)))
      .orderBy(desc(spendSources.connectedAt));
  }

  async getSpendSource(campaignId: string, sourceId: string): Promise<SpendSource | undefined> {
    const [s] = await db.select().from(spendSources)
      // Some DBs have spend_sources.id as UUID while our API passes string IDs.
      // Cast to text to avoid "operator does not exist: uuid = text".
      .where(and(sql`${spendSources.id}::text = ${sourceId}`, eq(spendSources.campaignId, campaignId), eq(spendSources.isActive, true)));
    return s || undefined;
  }

  async createSpendSource(source: InsertSpendSource): Promise<SpendSource> {
    const [s] = await db
      .insert(spendSources)
      .values({
        ...source,
        isActive: source.isActive !== undefined ? source.isActive : true,
      } as any)
      .returning();
    return s;
  }

  async updateSpendSource(sourceId: string, source: Partial<InsertSpendSource>): Promise<SpendSource | undefined> {
    const [s] = await db
      .update(spendSources)
      .set(source as any)
      .where(sql`${spendSources.id}::text = ${sourceId}`)
      .returning();
    return s || undefined;
  }

  async deleteSpendSource(sourceId: string): Promise<boolean> {
    const result = await db
      .update(spendSources)
      .set({ isActive: false } as any)
      .where(sql`${spendSources.id}::text = ${sourceId}`);
    return (result.rowCount || 0) > 0;
  }

  async deleteSpendRecordsBySource(sourceId: string): Promise<boolean> {
    const result = await db
      .delete(spendRecords)
      .where(eq(spendRecords.spendSourceId, sourceId));
    return (result.rowCount || 0) >= 0;
  }

  async createSpendRecords(records: InsertSpendRecord[]): Promise<SpendRecord[]> {
    if (!records.length) return [];

    // Use onConflictDoNothing for idempotent inserts (auto-refresh scheduler may re-run)
    const results = await db
      .insert(spendRecords)
      .values(records as any)
      .onConflictDoNothing()
      .returning();

    return results;
  }

  async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string): Promise<{ totalSpend: number; currency?: string; sourceIds: string[] }> {
    // spend_records.date is stored as YYYY-MM-DD; lexicographic compare works.
    const rows = await db
      .select({
        spend: spendRecords.spend,
        currency: spendRecords.currency,
        spendSourceId: spendRecords.spendSourceId,
      })
      .from(spendRecords)
      // Cast spend_sources.id to text for compatibility with spend_records.spend_source_id stored as text.
      .innerJoin(spendSources, sql`${spendSources.id}::text = ${spendRecords.spendSourceId}`)
      .where(and(
        eq(spendRecords.campaignId, campaignId),
        eq(spendSources.isActive, true),
        sql`${spendRecords.date} >= ${startDate}`,
        sql`${spendRecords.date} <= ${endDate}`
      ));

    let total = 0;
    const sourceIds = new Set<string>();
    let currency: string | undefined = undefined;
    for (const r of rows as any[]) {
      const v = parseFloat(String((r as any).spendRecords?.spend ?? (r as any).spend ?? "0"));
      if (!Number.isNaN(v)) total += v;
      const sid = String((r as any).spendRecords?.spendSourceId ?? (r as any).spendSourceId);
      if (sid) sourceIds.add(sid);
      const cur = (r as any).spendRecords?.currency ?? (r as any).currency;
      if (!currency && cur) currency = String(cur);
    }
    return { totalSpend: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  async getSpendBreakdownBySource(campaignId: string, startDate: string, endDate: string): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; spend: number; currency?: string }>> {
    const rows = await db
      .select({
        spendSourceId: spendRecords.spendSourceId,
        displayName: spendSources.displayName,
        sourceType: spendSources.sourceType,
        spend: spendRecords.spend,
        currency: spendRecords.currency,
      })
      .from(spendRecords)
      .innerJoin(spendSources, sql`${spendSources.id}::text = ${spendRecords.spendSourceId}`)
      .where(and(
        eq(spendRecords.campaignId, campaignId),
        eq(spendSources.isActive, true),
        sql`${spendRecords.date} >= ${startDate}`,
        sql`${spendRecords.date} <= ${endDate}`
      ));

    const totals = new Map<string, { displayName: string; sourceType: string; spend: number; currency?: string }>();
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
    }

    return Array.from(totals.entries()).map(([sourceId, data]) => ({
      sourceId, displayName: data.displayName, sourceType: data.sourceType,
      spend: Number(data.spend.toFixed(2)), currency: data.currency,
    }));
  }

  // Revenue methods
  async getRevenueSources(campaignId: string, platformContext: 'ga4' | 'linkedin' | 'meta' = 'ga4'): Promise<RevenueSource[]> {
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
    const [s] = await db
      .insert(revenueSources)
      .values({
        ...source,
        isActive: source.isActive !== undefined ? source.isActive : true,
      } as any)
      .returning();
    return s;
  }

  async updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined> {
    const [s] = await db
      .update(revenueSources)
      .set(source as any)
      .where(sql`${revenueSources.id}::text = ${sourceId}`)
      .returning();
    return s || undefined;
  }

  async deleteRevenueSource(sourceId: string): Promise<boolean> {
    const result = await db
      .update(revenueSources)
      .set({ isActive: false } as any)
      .where(sql`${revenueSources.id}::text = ${sourceId}`);
    return (result.rowCount || 0) > 0;
  }

  async deleteRevenueRecordsBySource(sourceId: string): Promise<boolean> {
    const result = await db
      .delete(revenueRecords)
      .where(eq(revenueRecords.revenueSourceId, sourceId));
    return (result.rowCount || 0) >= 0;
  }

  async createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]> {
    if (!records.length) return [];

    // Use onConflictDoNothing for idempotent inserts (auto-refresh scheduler may re-run)
    const results = await db
      .insert(revenueRecords)
      .values(records as any)
      .onConflictDoNothing()
      .returning();

    return results;
  }

  async getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext: 'ga4' | 'linkedin' = 'ga4'): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }> {
    const rows = await db
      .select({
        revenue: revenueRecords.revenue,
        currency: revenueRecords.currency,
        revenueSourceId: revenueRecords.revenueSourceId,
      })
      .from(revenueRecords)
      .innerJoin(revenueSources, sql`${revenueSources.id}::text = ${revenueRecords.revenueSourceId}`)
      .where(and(
        eq(revenueRecords.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        platformContext === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, 'linkedin' as any),
        sql`${revenueRecords.date} >= ${startDate}`,
        sql`${revenueRecords.date} <= ${endDate}`
      ));

    let total = 0;
    const sourceIds = new Set<string>();
    let currency: string | undefined = undefined;
    for (const r of rows as any[]) {
      const v = parseFloat(String((r as any).revenueRecords?.revenue ?? (r as any).revenue ?? "0"));
      if (!Number.isNaN(v)) total += v;
      const sid = String((r as any).revenueRecords?.revenueSourceId ?? (r as any).revenueSourceId);
      if (sid) sourceIds.add(sid);
      const cur = (r as any).revenueRecords?.currency ?? (r as any).currency;
      if (!currency && cur) currency = String(cur);
    }
    return { totalRevenue: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  async getRevenueBreakdownBySource(campaignId: string, startDate: string, endDate: string, platformContext: 'ga4' | 'linkedin' | 'meta' = 'ga4'): Promise<Array<{ sourceId: string; displayName: string; sourceType: string; revenue: number; currency?: string }>> {
    const rows = await db
      .select({
        revenueSourceId: revenueRecords.revenueSourceId,
        displayName: revenueSources.displayName,
        sourceType: revenueSources.sourceType,
        revenue: revenueRecords.revenue,
        currency: revenueRecords.currency,
      })
      .from(revenueRecords)
      .innerJoin(revenueSources, sql`${revenueSources.id}::text = ${revenueRecords.revenueSourceId}`)
      .where(and(
        eq(revenueRecords.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        platformContext === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, platformContext as any),
        sql`${revenueRecords.date} >= ${startDate}`,
        sql`${revenueRecords.date} <= ${endDate}`
      ));

    const totals = new Map<string, { displayName: string; sourceType: string; revenue: number; currency?: string }>();
    for (const r of rows as any[]) {
      const sid = String(r.revenueSourceId ?? r.revenueRecords?.revenueSourceId);
      const v = parseFloat(String(r.revenue ?? r.revenueRecords?.revenue ?? "0"));
      if (Number.isNaN(v)) continue;
      const existing = totals.get(sid) || {
        displayName: String(r.displayName ?? r.revenueSources?.displayName ?? 'Unknown'),
        sourceType: String(r.sourceType ?? r.revenueSources?.sourceType ?? 'unknown'),
        revenue: 0,
        currency: r.currency ?? r.revenueRecords?.currency,
      };
      existing.revenue += v;
      totals.set(sid, existing);
    }

    return Array.from(totals.entries()).map(([sourceId, data]) => ({
      sourceId, displayName: data.displayName, sourceType: data.sourceType,
      revenue: Number(data.revenue.toFixed(2)), currency: data.currency,
    }));
  }

  // Google Sheets Connection methods
  async getGoogleSheetsConnections(campaignId: string, purpose?: string): Promise<GoogleSheetsConnection[]> {
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
        accessToken: googleSheetsConnections.accessToken,
        refreshToken: googleSheetsConnections.refreshToken,
        clientId: googleSheetsConnections.clientId,
        clientSecret: googleSheetsConnections.clientSecret,
        encryptedTokens: (googleSheetsConnections as any).encryptedTokens,
        expiresAt: googleSheetsConnections.expiresAt,
        isPrimary: googleSheetsConnections.isPrimary,
        isActive: googleSheetsConnections.isActive,
        columnMappings: googleSheetsConnections.columnMappings,
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
          if (!hasPlain || hasEnc || !r?.id) return;
          try {
            const nextEnc = buildEncryptedTokens({
              accessToken: r.accessToken,
              refreshToken: r.refreshToken,
              clientSecret: r.clientSecret,
            });
            await db
              .update(googleSheetsConnections)
              .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
              .where(eq(googleSheetsConnections.id, String(r.id)));
          } catch {
            // ignore
          }
        })
      );

      return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
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
        return connection ? (hydrateDecryptedTokens(connection) as any) : undefined;
      }

      // Return the primary connection if no spreadsheetId specified
      const [primary] = await db.select().from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isPrimary, true),
          eq(googleSheetsConnections.isActive, true)
        ));

      if (primary) return hydrateDecryptedTokens(primary) as any;

      // Fallback to first active connection if no primary
      const [first] = await db.select().from(googleSheetsConnections)
        .where(and(
          eq(googleSheetsConnections.campaignId, campaignId),
          eq(googleSheetsConnections.isActive, true)
        ))
        .limit(1);

      return first ? (hydrateDecryptedTokens(first) as any) : undefined;
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
      return primary || undefined;
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

    try {
      // Try to insert - Drizzle will include all fields from schema, which may fail if sheet_name doesn't exist
      const enc = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        refreshToken: (connection as any).refreshToken,
        clientSecret: (connection as any).clientSecret,
      });

      const [sheetsConnection] = await db
        .insert(googleSheetsConnections)
        .values({
          ...connection,
          accessToken: null,
          refreshToken: null,
          clientSecret: null,
          encryptedTokens: enc,
          isPrimary: isPrimary,
          isActive: true
        })
        .returning();
      return hydrateDecryptedTokens(sheetsConnection) as any;
    } catch (error: any) {
      // If sheet_name column doesn't exist yet, use raw SQL insert
      if (error.message?.includes('sheet_name') || error.message?.includes('purpose') || error.message?.includes('column') || error.code === '42703') {
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

  async updateGoogleSheetsConnection(connectionId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined> {
    try {
      const [existing] = await db.select().from(googleSheetsConnections).where(eq(googleSheetsConnections.id, connectionId));
      if (!existing) return undefined;

      // Build the set object with explicit field mapping for columnMappings
      const setData: any = {};
      if (connection.spreadsheetId !== undefined) setData.spreadsheetId = connection.spreadsheetId;
      if (connection.spreadsheetName !== undefined) setData.spreadsheetName = connection.spreadsheetName;
      if ((connection as any).sheetName !== undefined) setData.sheetName = (connection as any).sheetName;
      if ((connection as any).purpose !== undefined) setData.purpose = (connection as any).purpose;
      const tokenFieldsProvided =
        Object.prototype.hasOwnProperty.call(connection, "accessToken") ||
        Object.prototype.hasOwnProperty.call(connection, "refreshToken") ||
        Object.prototype.hasOwnProperty.call(connection, "clientSecret");

      if (tokenFieldsProvided || (existing as any).encryptedTokens) {
        setData.encryptedTokens = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
          prev: (existing as any).encryptedTokens,
        });
        setData.accessToken = null;
        setData.refreshToken = null;
        setData.clientSecret = null;
      }
      if (connection.clientId !== undefined) setData.clientId = connection.clientId;
      if (connection.expiresAt !== undefined) setData.expiresAt = connection.expiresAt;
      if (connection.isPrimary !== undefined) setData.isPrimary = connection.isPrimary;
      if (connection.isActive !== undefined) setData.isActive = connection.isActive;
      // CRITICAL: Explicitly include columnMappings
      if ((connection as any).columnMappings !== undefined) {
        setData.columnMappings = (connection as any).columnMappings;
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
          accessToken: googleSheetsConnections.accessToken,
          refreshToken: googleSheetsConnections.refreshToken,
          clientId: googleSheetsConnections.clientId,
          clientSecret: googleSheetsConnections.clientSecret,
          encryptedTokens: (googleSheetsConnections as any).encryptedTokens,
          expiresAt: googleSheetsConnections.expiresAt,
          isPrimary: googleSheetsConnections.isPrimary,
          isActive: googleSheetsConnections.isActive,
          columnMappings: googleSheetsConnections.columnMappings,
          connectedAt: googleSheetsConnections.connectedAt,
          createdAt: googleSheetsConnections.createdAt,
        });
      return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
    } catch (error: any) {
      // If sheet_name column doesn't exist yet, use raw SQL update
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
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

        // Use pool.query for dynamic SQL with proper parameterization
        const updateClause = updates.join(', ');
        values.push(connectionId);
        const queryText = `UPDATE google_sheets_connections SET ${updateClause} WHERE id = $${paramIndex} RETURNING id, campaign_id, spreadsheet_id, spreadsheet_name, access_token, refresh_token, client_id, client_secret, expires_at, is_primary, is_active, column_mappings, connected_at, created_at`;

        if (!pool) {
          throw new Error("Database pool is not initialized");
        }
        const result = await pool.query(queryText, values);

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

  async setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string): Promise<boolean> {
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
  }

  async deleteGoogleSheetsConnection(connectionId: string): Promise<boolean> {
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
        .set({ isActive: false })
        .where(eq(googleSheetsConnections.id, connectionId));

      // If this was the primary connection, make the first remaining connection primary
      if (wasPrimary) {
        const remainingConnections = await this.getGoogleSheetsConnections(campaignId);
        if (remainingConnections.length > 0) {
          await this.setPrimaryGoogleSheetsConnection(campaignId, remainingConnections[0].id);
        }
      }

      return true;
    } catch (error: any) {
      // Fallback if sheet_name column doesn't exist
      if (error.message?.includes('sheet_name') || error.message?.includes('column') || error.code === '42703') {
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
            const remainingConnections = await this.getGoogleSheetsConnections(campaignId);
            if (remainingConnections.length > 0) {
              await this.setPrimaryGoogleSheetsConnection(campaignId, remainingConnections[0].id);
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
            .where(eq(hubspotConnections.id, String(r.id)));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getHubspotConnection(campaignId: string): Promise<HubspotConnection | undefined> {
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
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (latest as any).accessToken,
          refreshToken: (latest as any).refreshToken,
          clientSecret: (latest as any).clientSecret,
        });
        await db
          .update(hubspotConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(eq(hubspotConnections.id, String((latest as any).id)));
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
    const [created] = await db.insert(hubspotConnections).values(connectionData).returning();
    return hydrateDecryptedTokens(created) as any;
  }

  async updateHubspotConnection(connectionId: string, connection: Partial<InsertHubspotConnection>): Promise<HubspotConnection | undefined> {
    const [existing] = await db.select().from(hubspotConnections).where(eq(hubspotConnections.id, connectionId));
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
        prev: (existing as any).encryptedTokens,
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
  }

  async deleteHubspotConnection(connectionId: string): Promise<boolean> {
    const result = await db
      .update(hubspotConnections)
      .set({ isActive: false })
      .where(eq(hubspotConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
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
            .where(eq(salesforceConnections.id, String(r.id)));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getSalesforceConnection(campaignId: string): Promise<SalesforceConnection | undefined> {
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
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (latest as any).accessToken,
          refreshToken: (latest as any).refreshToken,
          clientSecret: (latest as any).clientSecret,
        });
        await db
          .update(salesforceConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(eq(salesforceConnections.id, String((latest as any).id)));
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
    const [created] = await db.insert(salesforceConnections).values(connectionData).returning();
    return hydrateDecryptedTokens(created) as any;
  }

  async updateSalesforceConnection(connectionId: string, connection: Partial<InsertSalesforceConnection>): Promise<SalesforceConnection | undefined> {
    const [existing] = await db.select().from(salesforceConnections).where(eq(salesforceConnections.id, connectionId));
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
        prev: (existing as any).encryptedTokens,
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
  }

  async deleteSalesforceConnection(connectionId: string): Promise<boolean> {
    const result = await db
      .update(salesforceConnections)
      .set({ isActive: false })
      .where(eq(salesforceConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
  }

  // Shopify Connection methods
  async getShopifyConnections(campaignId: string): Promise<ShopifyConnection[]> {
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
            .where(eq(shopifyConnections.id, String(r.id)));
        } catch {
          // ignore
        }
      })
    );
    return rows.map((r: any) => hydrateDecryptedTokens(r)) as any;
  }

  async getShopifyConnection(campaignId: string): Promise<ShopifyConnection | undefined> {
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
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({ accessToken: (latest as any).accessToken });
        await db
          .update(shopifyConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null } as any)
          .where(eq(shopifyConnections.id, String((latest as any).id)));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection> {
    const enc = buildEncryptedTokens({ accessToken: (connection as any).accessToken });
    const connectionData: any = {
      ...connection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      shopName: connection.shopName || null,
      accessToken: null,
      encryptedTokens: enc as any,
      mappingConfig: connection.mappingConfig || null,
    };
    const [created] = await db.insert(shopifyConnections).values(connectionData).returning();
    return hydrateDecryptedTokens(created) as any;
  }

  async updateShopifyConnection(connectionId: string, connection: Partial<InsertShopifyConnection>): Promise<ShopifyConnection | undefined> {
    const [existing] = await db.select().from(shopifyConnections).where(eq(shopifyConnections.id, connectionId));
    if (!existing) return undefined;

    const tokenProvided = Object.prototype.hasOwnProperty.call(connection, "accessToken");
    const setObj: any = { ...connection };
    if (tokenProvided || (existing as any).encryptedTokens) {
      setObj.encryptedTokens = buildEncryptedTokens({
        accessToken: (connection as any).accessToken,
        prev: (existing as any).encryptedTokens,
      } as any);
      setObj.accessToken = null;
    }

    const [updated] = await db
      .update(shopifyConnections)
      .set(setObj)
      .where(eq(shopifyConnections.id, connectionId))
      .returning();
    return updated ? (hydrateDecryptedTokens(updated) as any) : undefined;
  }

  async deleteShopifyConnection(connectionId: string): Promise<boolean> {
    const result = await db
      .update(shopifyConnections)
      .set({ isActive: false })
      .where(eq(shopifyConnections.id, connectionId));
    return (result.rowCount || 0) > 0;
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
          .where(eq(linkedinConnections.campaignId, campaignId));
      } catch {
        // ignore
      }
    }

    return hydrated;
  }

  async createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection> {
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
  }

  async updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined> {
    const [existing] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.campaignId, campaignId));
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
  }

  async deleteLinkedInConnection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(linkedinConnections)
      .where(eq(linkedinConnections.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
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
          .where(eq(metaConnections.campaignId, campaignId));
      } catch {
        // ignore
      }
    }
    return hydrated;
  }

  async createMetaConnection(connection: InsertMetaConnection): Promise<MetaConnection> {
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
  }

  async updateMetaConnection(campaignId: string, connection: Partial<InsertMetaConnection>): Promise<MetaConnection | undefined> {
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
  }

  async deleteMetaConnection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(metaConnections)
      .where(eq(metaConnections.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  // Google Ads Connection methods
  async getGoogleAdsConnection(campaignId: string): Promise<GoogleAdsConnection | undefined> {
    const [connection] = await db.select().from(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId));
    if (!connection) return undefined;
    const hydrated = hydrateDecryptedTokens(connection) as any;
    const hasPlain = Boolean((connection as any).accessToken) || Boolean((connection as any).refreshToken) || Boolean((connection as any).clientSecret);
    const hasEnc = Boolean((connection as any).encryptedTokens);
    if (hasPlain && !hasEnc) {
      try {
        const nextEnc = buildEncryptedTokens({
          accessToken: (connection as any).accessToken,
          refreshToken: (connection as any).refreshToken,
          clientSecret: (connection as any).clientSecret,
        });
        await db
          .update(googleAdsConnections)
          .set({ encryptedTokens: nextEnc as any, accessToken: null, refreshToken: null, clientSecret: null } as any)
          .where(eq(googleAdsConnections.campaignId, campaignId));
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
    const [gadsConnection] = await db
      .insert(googleAdsConnections)
      .values({
        ...connection,
        accessToken: null,
        refreshToken: null,
        clientSecret: null,
        encryptedTokens: enc as any,
      } as any)
      .returning();
    return hydrateDecryptedTokens(gadsConnection) as any;
  }

  async updateGoogleAdsConnection(campaignId: string, connection: Partial<InsertGoogleAdsConnection>): Promise<GoogleAdsConnection | undefined> {
    const [existing] = await db.select().from(googleAdsConnections).where(eq(googleAdsConnections.campaignId, campaignId));
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
        prev: (existing as any).encryptedTokens,
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
  }

  async deleteGoogleAdsConnection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(googleAdsConnections)
      .where(eq(googleAdsConnections.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  async getGoogleAdsDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<GoogleAdsDailyMetric[]> {
    return await db.select().from(googleAdsDailyMetrics)
      .where(and(
        eq(googleAdsDailyMetrics.campaignId, campaignId),
        sql`${googleAdsDailyMetrics.date} >= ${startDate}`,
        sql`${googleAdsDailyMetrics.date} <= ${endDate}`,
      ))
      .orderBy(googleAdsDailyMetrics.date);
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

  async updateGoogleAdsDailyMetricsGA4Revenue(campaignId: string, updates: Array<{ googleCampaignId: string; date: string; ga4Revenue: string; ga4UtmName: string }>): Promise<{ updated: number }> {
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
      .set({ ...kpi, updatedAt: new Date() })
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
      .set({ ...benchmark, updatedAt: new Date() })
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
    return true;
  }

  // Platform Reports methods
  async getPlatformReports(platformType: string, campaignId?: string): Promise<LinkedInReport[]> {
    // Filter reports by platformType and optionally by campaignId
    if (campaignId) {
      return await db.select()
        .from(linkedinReports)
        .where(and(eq(linkedinReports.platformType, platformType), eq(linkedinReports.campaignId, campaignId)))
        .orderBy(linkedinReports.createdAt);
    } else {
      return await db.select()
        .from(linkedinReports)
        .where(and(eq(linkedinReports.platformType, platformType), isNull(linkedinReports.campaignId)))
        .orderBy(linkedinReports.createdAt);
    }
  }

  async createPlatformReport(report: any): Promise<LinkedInReport> {
    // For now, use LinkedIn reports table for all platforms
    // In future, use a generic platform_reports table
    return this.createLinkedInReport(report);
  }

  async updatePlatformReport(id: string, report: any): Promise<LinkedInReport | undefined> {
    // For now, use LinkedIn reports table for all platforms
    return this.updateLinkedInReport(id, report);
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
    // Check if integration already exists for this campaign
    const existing = await this.getCustomIntegration(integration.campaignId);
    if (existing) {
      // Update existing integration with new email and webhook token
      const [updated] = await db
        .update(customIntegrations)
        .set({
          email: integration.email,
          webhookToken: integration.webhookToken,
          connectedAt: new Date()
        })
        .where(eq(customIntegrations.id, existing.id))
        .returning();
      return updated;
    }

    const [customIntegration] = await db
      .insert(customIntegrations)
      .values(integration)
      .returning();
    return customIntegration;
  }

  async deleteCustomIntegration(campaignId: string): Promise<boolean> {
    await db
      .delete(customIntegrations)
      .where(eq(customIntegrations.campaignId, campaignId));
    return true;
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

  async createCustomIntegrationMetrics(metricsData: InsertCustomIntegrationMetrics): Promise<CustomIntegrationMetrics> {
    const [metrics] = await db
      .insert(customIntegrationMetrics)
      .values(metricsData)
      .returning();
    return metrics;
  }

  async getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined> {
    const [metrics] = await db.select()
      .from(customIntegrationMetrics)
      .where(eq(customIntegrationMetrics.campaignId, campaignId))
      .orderBy(desc(customIntegrationMetrics.uploadedAt))
      .limit(1);
    return metrics || undefined;
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

  async createConversionEvent(eventData: InsertConversionEvent): Promise<ConversionEvent> {
    const [event] = await db
      .insert(conversionEvents)
      .values({
        ...eventData,
        receivedAt: new Date(),
      })
      .returning();
    return event;
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
    return db.select().from(kpis).where(eq(kpis.campaignId, campaignId));
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
    const [kpi] = await db
      .insert(kpis)
      .values(kpiData)
      .returning();
    return kpi;
  }

  async updateKPI(id: string, kpiData: Partial<InsertKPI>): Promise<KPI | undefined> {
    const [kpi] = await db
      .update(kpis)
      .set({ ...kpiData, updatedAt: new Date() })
      .where(eq(kpis.id, id))
      .returning();
    return kpi || undefined;
  }

  async deleteKPI(id: string): Promise<boolean> {
    try {
      // Delete related records first
      await db.delete(kpiProgress).where(eq(kpiProgress.kpiId, id));
      await db.delete(kpiAlerts).where(eq(kpiAlerts.kpiId, id));

      // Delete the KPI itself
      const result = await db
        .delete(kpis)
        .where(eq(kpis.id, id));

      const deleted = (result.rowCount || 0) > 0;

      return deleted;
    } catch (error) {
      console.error(`Error in DatabaseStorage.deleteKPI:`, error);
      throw error;
    }
  }

  async getKPIProgress(kpiId: string): Promise<KPIProgress[]> {
    return db.select().from(kpiProgress).where(eq(kpiProgress.kpiId, kpiId)).orderBy(desc(kpiProgress.recordedAt));
  }

  async getLatestKPIPeriod(kpiId: string): Promise<any> {
    const periods = await db.select()
      .from(kpiPeriods)
      .where(eq(kpiPeriods.kpiId, kpiId))
      .orderBy(desc(kpiPeriods.periodEnd))
      .limit(1);

    return periods[0] || null;
  }

  async recordKPIProgress(progressData: InsertKPIProgress): Promise<KPIProgress> {
    const [progress] = await db
      .insert(kpiProgress)
      .values(progressData)
      .returning();

    // Update the KPI's current value
    await db
      .update(kpis)
      .set({ currentValue: progressData.value, updatedAt: new Date() })
      .where(eq(kpis.id, progressData.kpiId));

    return progress;
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
    // Get benchmarks that are either:
    // 1. Created in this campaign AND scoped to all campaigns (applyTo = 'all')
    // 2. Scoped specifically to this campaign (specificCampaignId = campaignId), regardless of where created
    const results = await db.select().from(benchmarks)
      .where(
        or(
          // Global benchmarks created in this campaign
          and(
            eq(benchmarks.campaignId, campaignId),
            or(
              eq(benchmarks.applyTo, 'all'),
              isNull(benchmarks.specificCampaignId)
            )
          ),
          // Campaign-specific benchmarks targeting this campaign (from any source)
          eq(benchmarks.specificCampaignId, campaignId)
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
    const [benchmark] = await db
      .insert(benchmarks)
      .values(benchmarkData)
      .returning();
    return benchmark;
  }

  async updateBenchmark(id: string, updateData: Partial<InsertBenchmark>): Promise<Benchmark | undefined> {
    const [benchmark] = await db
      .update(benchmarks)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(benchmarks.id, id))
      .returning();
    return benchmark || undefined;
  }

  async deleteBenchmark(id: string): Promise<boolean> {
    const result = await db
      .delete(benchmarks)
      .where(eq(benchmarks.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getBenchmarkHistory(benchmarkId: string): Promise<BenchmarkHistory[]> {
    return db.select().from(benchmarkHistory)
      .where(eq(benchmarkHistory.benchmarkId, benchmarkId))
      .orderBy(benchmarkHistory.recordedAt);
  }

  async recordBenchmarkHistory(historyData: InsertBenchmarkHistory): Promise<BenchmarkHistory> {
    const [history] = await db
      .insert(benchmarkHistory)
      .values(historyData)
      .returning();
    return history;
  }

  // Metric Snapshot methods
  async getCampaignSnapshots(campaignId: string): Promise<MetricSnapshot[]> {
    return db.select().from(metricSnapshots)
      .where(eq(metricSnapshots.campaignId, campaignId))
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
        sql`${metricSnapshots.recordedAt} >= ${startDate}`
      ))
      .orderBy(metricSnapshots.recordedAt);
  }

  async getSnapshotByDate(campaignId: string, date: Date): Promise<MetricSnapshot | undefined> {
    const [snapshot] = await db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        eq(metricSnapshots.recordedAt, date)
      ))
      .limit(1);
    return snapshot || undefined;
  }

  async createMetricSnapshot(snapshotData: InsertMetricSnapshot): Promise<MetricSnapshot> {
    const [snapshot] = await db
      .insert(metricSnapshots)
      .values(snapshotData)
      .returning();
    return snapshot;
  }

  async getComparisonData(
    campaignId: string,
    comparisonType: 'yesterday' | 'last_week' | 'last_month'
  ): Promise<{ current: MetricSnapshot | null; previous: MetricSnapshot | null }> {
    const now = new Date();
    let targetDate: Date;

    switch (comparisonType) {
      case 'yesterday':
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() - 1);
        targetDate.setHours(23, 59, 59, 999); // End of yesterday
        break;
      case 'last_week':
        targetDate = new Date(now);
        targetDate.setDate(now.getDate() - 7);
        targetDate.setHours(23, 59, 59, 999); // End of that day
        break;
      case 'last_month':
        targetDate = new Date(now);
        targetDate.setMonth(now.getMonth() - 1);
        targetDate.setHours(23, 59, 59, 999); // End of that day
        break;
    }

    // Get the most recent snapshot (current)
    const [currentSnapshot] = await db.select().from(metricSnapshots)
      .where(eq(metricSnapshots.campaignId, campaignId))
      .orderBy(desc(metricSnapshots.recordedAt))
      .limit(1);

    // Get the most recent snapshot on or before the target date (previous)
    // Uses SQL to efficiently find the closest snapshot without loading all records
    const [previousSnapshot] = await db.select().from(metricSnapshots)
      .where(and(
        eq(metricSnapshots.campaignId, campaignId),
        sql`${metricSnapshots.recordedAt} <= ${targetDate}`
      ))
      .orderBy(desc(metricSnapshots.recordedAt))
      .limit(1);

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
    const result = await db
      .delete(notifications)
      .where(eq(notifications.id, id));
    return (result.rowCount || 0) > 0;
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
  async getAttributionModels(): Promise<AttributionModel[]> {
    return Array.from(this.attributionModels.values()).sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getAttributionModel(id: string): Promise<AttributionModel | undefined> {
    return this.attributionModels.get(id);
  }

  async createAttributionModel(modelData: InsertAttributionModel): Promise<AttributionModel> {
    const id = randomUUID();
    const model: AttributionModel = {
      id,
      name: modelData.name,
      type: modelData.type,
      description: modelData.description || null,
      configuration: modelData.configuration || null,
      isDefault: modelData.isDefault || false,
      isActive: modelData.isActive !== undefined ? modelData.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.attributionModels.set(id, model);
    return model;
  }

  async updateAttributionModel(id: string, modelData: Partial<InsertAttributionModel>): Promise<AttributionModel | undefined> {
    const existing = this.attributionModels.get(id);
    if (!existing) return undefined;

    const updated: AttributionModel = {
      ...existing,
      ...modelData,
      updatedAt: new Date(),
    };

    this.attributionModels.set(id, updated);
    return updated;
  }

  async deleteAttributionModel(id: string): Promise<boolean> {
    return this.attributionModels.delete(id);
  }

  async setDefaultAttributionModel(id: string): Promise<boolean> {
    // Remove default from all models
    this.attributionModels.forEach((model, key) => {
      if (model.isDefault) {
        const updated = { ...model, isDefault: false, updatedAt: new Date() };
        this.attributionModels.set(key, updated);
      }
    });

    // Set new default
    const model = this.attributionModels.get(id);
    if (!model) return false;

    const updated = { ...model, isDefault: true, updatedAt: new Date() };
    this.attributionModels.set(id, updated);
    return true;
  }

  // Customer Journey methods
  async getCustomerJourneys(status?: string): Promise<CustomerJourney[]> {
    let journeys = Array.from(this.customerJourneys.values());

    if (status) {
      journeys = journeys.filter(journey => journey.status === status);
    }

    return journeys.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getCustomerJourney(id: string): Promise<CustomerJourney | undefined> {
    return this.customerJourneys.get(id);
  }

  async createCustomerJourney(journeyData: InsertCustomerJourney): Promise<CustomerJourney> {
    const id = randomUUID();
    const journey: CustomerJourney = {
      id,
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

    this.customerJourneys.set(id, journey);
    return journey;
  }

  async updateCustomerJourney(id: string, journeyData: Partial<InsertCustomerJourney>): Promise<CustomerJourney | undefined> {
    const existing = this.customerJourneys.get(id);
    if (!existing) return undefined;

    const updated: CustomerJourney = {
      ...existing,
      ...journeyData,
      updatedAt: new Date(),
    };

    this.customerJourneys.set(id, updated);
    return updated;
  }

  async deleteCustomerJourney(id: string): Promise<boolean> {
    // Also delete related touchpoints and attribution results
    const touchpoints = Array.from(this.touchpoints.values()).filter(t => t.journeyId === id);
    touchpoints.forEach(t => this.touchpoints.delete(t.id));

    const results = Array.from(this.attributionResults.values()).filter(r => r.journeyId === id);
    results.forEach(r => this.attributionResults.delete(r.id));

    return this.customerJourneys.delete(id);
  }

  // Touchpoint methods
  async getJourneyTouchpoints(journeyId: string): Promise<Touchpoint[]> {
    return Array.from(this.touchpoints.values())
      .filter(touchpoint => touchpoint.journeyId === journeyId)
      .sort((a, b) => a.position - b.position);
  }

  async getCampaignTouchpoints(campaignId: string): Promise<Touchpoint[]> {
    return Array.from(this.touchpoints.values())
      .filter(touchpoint => touchpoint.campaignId === campaignId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  async createTouchpoint(touchpointData: InsertTouchpoint): Promise<Touchpoint> {
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

    this.touchpoints.set(id, touchpoint);

    // Update journey touchpoint count
    const journey = this.customerJourneys.get(touchpointData.journeyId);
    if (journey) {
      const updated = {
        ...journey,
        totalTouchpoints: journey.totalTouchpoints + 1,
        updatedAt: new Date()
      };
      this.customerJourneys.set(journey.id, updated);
    }

    return touchpoint;
  }

  async updateTouchpoint(id: string, touchpointData: Partial<InsertTouchpoint>): Promise<Touchpoint | undefined> {
    const existing = this.touchpoints.get(id);
    if (!existing) return undefined;

    const updated: Touchpoint = {
      ...existing,
      ...touchpointData,
    };

    this.touchpoints.set(id, updated);
    return updated;
  }

  async deleteTouchpoint(id: string): Promise<boolean> {
    const touchpoint = this.touchpoints.get(id);
    if (!touchpoint) return false;

    // Update journey touchpoint count
    const journey = this.customerJourneys.get(touchpoint.journeyId);
    if (journey) {
      const updated = {
        ...journey,
        totalTouchpoints: Math.max(0, journey.totalTouchpoints - 1),
        updatedAt: new Date()
      };
      this.customerJourneys.set(journey.id, updated);
    }

    return this.touchpoints.delete(id);
  }

  // Attribution Result methods
  async getAttributionResults(journeyId?: string, modelId?: string): Promise<AttributionResult[]> {
    let results = Array.from(this.attributionResults.values());

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
    const journey = await this.getCustomerJourney(journeyId);
    const model = await this.getAttributionModel(modelId);
    const touchpoints = await this.getJourneyTouchpoints(journeyId);

    if (!journey || !model || touchpoints.length === 0) {
      return [];
    }

    // Delete existing results for this journey/model combination
    const existingResults = Array.from(this.attributionResults.values())
      .filter(r => r.journeyId === journeyId && r.attributionModelId === modelId);
    existingResults.forEach(r => this.attributionResults.delete(r.id));

    const results: AttributionResult[] = [];
    const conversionValue = parseFloat(journey.conversionValue?.toString() || "0");

    // Calculate attribution based on model type
    for (let i = 0; i < touchpoints.length; i++) {
      const touchpoint = touchpoints[i];
      let credit = 0;

      switch (model.type) {
        case 'first_touch':
          credit = i === 0 ? 1.0 : 0.0;
          break;

        case 'last_touch':
          credit = i === touchpoints.length - 1 ? 1.0 : 0.0;
          break;

        case 'linear':
          credit = 1.0 / touchpoints.length;
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
          if (touchpoints.length === 1) {
            credit = 1.0;
          } else if (touchpoints.length === 2) {
            credit = i === 0 ? posConfig.firstWeight + posConfig.middleWeight / 2 : posConfig.lastWeight + posConfig.middleWeight / 2;
          } else {
            if (i === 0) credit = posConfig.firstWeight;
            else if (i === touchpoints.length - 1) credit = posConfig.lastWeight;
            else credit = posConfig.middleWeight / (touchpoints.length - 2);
          }
          break;
      }

      // Normalize time decay credits
      if (model.type === 'time_decay' && touchpoints.length > 1) {
        const totalCredits = touchpoints.reduce((sum, tp, idx) => {
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

      this.attributionResults.set(resultId, result);
      results.push(result);
    }

    return results;
  }

  async getChannelAttributionResults(channel: string, modelId?: string): Promise<AttributionResult[]> {
    let results = Array.from(this.attributionResults.values())
      .filter(result => result.channel === channel);

    if (modelId) {
      results = results.filter(result => result.attributionModelId === modelId);
    }

    return results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Attribution Insight methods
  async getAttributionInsights(modelId?: string, period?: string): Promise<AttributionInsight[]> {
    let insights = Array.from(this.attributionInsights.values());

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
    let insights = Array.from(this.attributionInsights.values())
      .filter(insight => insight.campaignId === campaignId);

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
    const results = Array.from(this.attributionResults.values())
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

      this.attributionInsights.set(insightId, insight);
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
    if (!journey) {
      throw new Error(`Customer journey with ID ${journeyId} not found`);
    }

    const touchpoints = await this.getJourneyTouchpoints(journeyId);
    const models = await this.getAttributionModels();

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

  async getChannelPerformanceAttribution(startDate: Date, endDate: Date, modelId?: string): Promise<{
    channel: string;
    totalAttributedValue: number;
    totalTouchpoints: number;
    averageCredit: number;
    assistedConversions: number;
    lastClickConversions: number;
    firstClickConversions: number;
  }[]> {
    let results = Array.from(this.attributionResults.values())
      .filter(result => {
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
