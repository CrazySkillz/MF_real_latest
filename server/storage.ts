import { type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GA4DailyMetric, type InsertGA4DailyMetric, type LinkedInDailyMetric, type InsertLinkedInDailyMetric, type SpendSource, type InsertSpendSource, type SpendRecord, type InsertSpendRecord, type RevenueSource, type InsertRevenueSource, type RevenueRecord, type InsertRevenueRecord, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type HubspotConnection, type InsertHubspotConnection, type SalesforceConnection, type InsertSalesforceConnection, type ShopifyConnection, type InsertShopifyConnection, type LinkedInConnection, type InsertLinkedInConnection, type MetaConnection, type InsertMetaConnection, type LinkedInImportSession, type InsertLinkedInImportSession, type LinkedInImportMetric, type InsertLinkedInImportMetric, type LinkedInAdPerformance, type InsertLinkedInAdPerformance, type LinkedInReport, type InsertLinkedInReport, type CustomIntegration, type InsertCustomIntegration, type CustomIntegrationMetrics, type InsertCustomIntegrationMetrics, type ConversionEvent, type InsertConversionEvent, type KPI, type InsertKPI, type KPIPeriod, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, type Benchmark, type InsertBenchmark, type BenchmarkHistory, type InsertBenchmarkHistory, type MetricSnapshot, type InsertMetricSnapshot, type Notification, type InsertNotification, type ABTest, type InsertABTest, type ABTestVariant, type InsertABTestVariant, type ABTestResult, type InsertABTestResult, type ABTestEvent, type InsertABTestEvent, type AttributionModel, type InsertAttributionModel, type CustomerJourney, type InsertCustomerJourney, type Touchpoint, type InsertTouchpoint, type AttributionResult, type InsertAttributionResult, type AttributionInsight, type InsertAttributionInsight, campaigns, metrics, integrations, performanceData, ga4Connections, ga4DailyMetrics, linkedinDailyMetrics, spendSources, spendRecords, revenueSources, revenueRecords, googleSheetsConnections, hubspotConnections, salesforceConnections, shopifyConnections, linkedinConnections, metaConnections, linkedinImportSessions, linkedinImportMetrics, linkedinAdPerformance, linkedinReports, customIntegrations, customIntegrationMetrics, conversionEvents, kpis, kpiPeriods, kpiProgress, kpiAlerts, benchmarks, benchmarkHistory, metricSnapshots, notifications, abTests, abTestVariants, abTestResults, abTestEvents, attributionModels, customerJourneys, touchpoints, attributionResults, attributionInsights } from "@shared/schema";
import { randomUUID } from "crypto";
import { db, pool } from "./db";
import { eq, and, or, isNull, desc, sql } from "drizzle-orm";
import { buildEncryptedTokens, decryptTokens, type EncryptedTokens } from "./utils/tokenVault";

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

  // Revenue (generic; platform-scoped to avoid GA4/LinkedIn leakage)
  getRevenueSources(campaignId: string, platformContext?: 'ga4' | 'linkedin'): Promise<RevenueSource[]>;
  getRevenueSource(campaignId: string, sourceId: string): Promise<RevenueSource | undefined>;
  createRevenueSource(source: InsertRevenueSource): Promise<RevenueSource>;
  updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined>;
  deleteRevenueSource(sourceId: string): Promise<boolean>;
  deleteRevenueRecordsBySource(sourceId: string): Promise<boolean>;
  createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]>;
  getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext?: 'ga4' | 'linkedin'): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }>;
  
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
}

export class MemStorage implements IStorage {
  private campaigns: Map<string, Campaign>;
  private metrics: Map<string, Metric>;
  private integrations: Map<string, Integration>;
  private performanceData: Map<string, PerformanceData>;
  private ga4Connections: Map<string, GA4Connection>;
  private ga4DailyMetrics: Map<string, GA4DailyMetric>;
  private linkedinDailyMetrics: Map<string, LinkedInDailyMetric>;
  private spendSources: Map<string, SpendSource>;
  private spendRecords: Map<string, SpendRecord>;
  private revenueSources: Map<string, RevenueSource>;
  private revenueRecords: Map<string, RevenueRecord>;
  private googleSheetsConnections: Map<string, GoogleSheetsConnection>; // Key: connection.id
  private hubspotConnections: Map<string, HubspotConnection>; // Key: connection.id
  private salesforceConnections: Map<string, SalesforceConnection>; // Key: connection.id
  private shopifyConnections: Map<string, ShopifyConnection>; // Key: connection.id
  private linkedinConnections: Map<string, LinkedInConnection>;
  private metaConnections: Map<string, MetaConnection>;
  private linkedinImportSessions: Map<string, LinkedInImportSession>;
  private linkedinImportMetrics: Map<string, LinkedInImportMetric>;
  private linkedinAdPerformance: Map<string, LinkedInAdPerformance>;
  private linkedinReports: Map<string, LinkedInReport>;
  private kpiReports: Map<string, KPIReport>;
  private customIntegrations: Map<string, CustomIntegration>;
  private customIntegrationMetrics: Map<string, CustomIntegrationMetrics>;
  private conversionEvents: Map<string, ConversionEvent>;
  private kpis: Map<string, KPI>;
  private kpiProgress: Map<string, KPIProgress>;
  private kpiAlerts: Map<string, KPIAlert>;
  private benchmarks: Map<string, Benchmark>;
  private benchmarkHistory: Map<string, BenchmarkHistory>;
  private notifications_: Map<string, Notification>;
  private abTests: Map<string, ABTest>;
  private abTestVariants: Map<string, ABTestVariant>;
  private abTestResults: Map<string, ABTestResult>;
  private abTestEvents: Map<string, ABTestEvent>;
  private attributionModels: Map<string, AttributionModel>;
  private customerJourneys: Map<string, CustomerJourney>;
  private touchpoints: Map<string, Touchpoint>;
  private attributionResults: Map<string, AttributionResult>;
  private attributionInsights: Map<string, AttributionInsight>;

  constructor() {
    this.campaigns = new Map();
    this.metrics = new Map();
    this.integrations = new Map();
    this.performanceData = new Map();
    this.ga4Connections = new Map();
    this.ga4DailyMetrics = new Map();
    this.linkedinDailyMetrics = new Map();
    this.spendSources = new Map();
    this.spendRecords = new Map();
    this.revenueSources = new Map();
    this.revenueRecords = new Map();
    this.googleSheetsConnections = new Map();
    this.hubspotConnections = new Map();
    this.salesforceConnections = new Map();
    this.shopifyConnections = new Map();
    this.linkedinConnections = new Map();
    this.metaConnections = new Map();
    this.linkedinImportSessions = new Map();
    this.linkedinImportMetrics = new Map();
    this.linkedinAdPerformance = new Map();
    this.linkedinReports = new Map();
    this.kpiReports = new Map();
    this.customIntegrations = new Map();
    this.customIntegrationMetrics = new Map();
    this.conversionEvents = new Map();
    this.kpis = new Map();
    this.kpiProgress = new Map();
    this.kpiAlerts = new Map();
    this.benchmarks = new Map();
    this.benchmarkHistory = new Map();
    this.notifications_ = new Map();
    this.abTests = new Map();
    this.abTestVariants = new Map();
    this.abTestResults = new Map();
    this.abTestEvents = new Map();
    this.attributionModels = new Map();
    this.customerJourneys = new Map();
    this.touchpoints = new Map();
    this.attributionResults = new Map();
    this.attributionInsights = new Map();
    
    // Initialize with empty data - no mock data
    this.initializeEmptyData();
  }

  private initializeEmptyData() {
    // Create sample notifications for development purposes
    const now = new Date();
    
    // Sample notifications to demonstrate the feature
    this.createNotification({
      title: "Campaign Performance Alert",
      message: "Summer Sale campaign has exceeded its daily budget by 15%",
      type: "warning",
      campaignName: "Summer Sale",
      priority: "high",
      read: false,
    });
    
    this.createNotification({
      title: "New Integration Connected",
      message: "Google Analytics has been successfully connected to your account",
      type: "success",
      priority: "normal",
      read: false,
    });
    
    this.createNotification({
      title: "Weekly Report Available",
      message: "Your weekly performance report is ready for review",
      type: "info",
      priority: "normal",
      read: true,
    });

    // Initialize performance metrics based on Summer Splash campaign data
    this.initializePerformanceMetrics();

    // Initialize default attribution models
    this.initializeDefaultAttributionModels();
    
    // Initialize sample attribution data for demonstration
    this.initializeSampleAttributionData();
  }

  private initializePerformanceMetrics() {
    // Create realistic metrics based on Summer Splash fashion e-commerce campaign
    // Campaign data: 847,520 impressions, 21,840 clicks, $12,847.65 spend
    // CTR: 2.58%, CPC: $0.59, Conversion Rate: 3.47%, ROAS: 4.85x
    
    const metricsData = [
      {
        id: randomUUID(),
        name: "Total Impressions",
        value: "847,520",
        change: "+18.7%",
        period: "30d",
        icon: "eye",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Total Clicks",
        value: "21,840",
        change: "+15.3%",
        period: "30d",
        icon: "click",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Click-Through Rate",
        value: "2.58%",
        change: "-2.8%",
        period: "30d",
        icon: "percentage",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Cost Per Click",
        value: "$0.59",
        change: "-8.4%",
        period: "30d",
        icon: "dollar",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Conversion Rate",
        value: "3.47%",
        change: "+6.2%",
        period: "30d",
        icon: "percentage",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Return on Ad Spend",
        value: "4.85x",
        change: "+12.1%",
        period: "30d",
        icon: "dollar",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Cost Per Acquisition",
        value: "$16.95",
        change: "-11.3%",
        period: "30d",
        icon: "dollar",
        date: new Date()
      },
      {
        id: randomUUID(),
        name: "Revenue",
        value: "$62,290",
        change: "+24.6%",
        period: "30d",
        icon: "dollar",
        date: new Date()
      }
    ];

    // Add metrics to storage
    metricsData.forEach(metric => {
      this.metrics.set(metric.id, metric);
    });
  }

  private initializeDefaultAttributionModels() {
    // First Touch Attribution
    const firstTouchId = randomUUID();
    this.attributionModels.set(firstTouchId, {
      id: firstTouchId,
      name: "First Touch",
      type: "first_touch",
      description: "100% credit to the first marketing touchpoint in the customer journey",
      configuration: JSON.stringify({ weight: 1.0 }),
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Last Touch Attribution
    const lastTouchId = randomUUID();
    this.attributionModels.set(lastTouchId, {
      id: lastTouchId,
      name: "Last Touch",
      type: "last_touch", 
      description: "100% credit to the final touchpoint before conversion",
      configuration: JSON.stringify({ weight: 1.0 }),
      isDefault: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Linear Attribution
    const linearId = randomUUID();
    this.attributionModels.set(linearId, {
      id: linearId,
      name: "Linear",
      type: "linear",
      description: "Equal credit distributed across all touchpoints in the journey",
      configuration: JSON.stringify({ evenDistribution: true }),
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Time Decay Attribution
    const timeDecayId = randomUUID();
    this.attributionModels.set(timeDecayId, {
      id: timeDecayId,
      name: "Time Decay",
      type: "time_decay",
      description: "More credit to touchpoints closer to conversion",
      configuration: JSON.stringify({ decayRate: 0.5, halfLife: 7 }),
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Position Based Attribution (40/20/40)
    const positionBasedId = randomUUID();
    this.attributionModels.set(positionBasedId, {
      id: positionBasedId,
      name: "Position Based",
      type: "position_based",
      description: "40% first touch, 40% last touch, 20% distributed among middle touchpoints",
      configuration: JSON.stringify({ firstWeight: 0.4, lastWeight: 0.4, middleWeight: 0.2 }),
      isDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  private initializeSampleAttributionData() {
    // Create sample customer journeys with realistic touchpoints
    const sampleJourneys = [
      {
        customerId: "CUST_001",
        sessionId: "session_abc123",
        journeyStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        journeyEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        conversionValue: "285.00",
        conversionType: "purchase",
        status: "completed",
        touchpoints: [
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "summer_sale_search", position: 1, hours: 14 * 24 },
          { channel: "Facebook", platform: "facebook", medium: "social", source: "facebook", campaign: "brand_awareness", position: 2, hours: 12 * 24 + 8 },
          { channel: "Email", platform: "mailchimp", medium: "email", source: "newsletter", campaign: "weekly_deals", position: 3, hours: 8 * 24 + 16 },
          { channel: "Direct", platform: null, medium: "direct", source: "direct", campaign: null, position: 4, hours: 3 * 24 + 2 },
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "retargeting", position: 5, hours: 24 }
        ]
      },
      {
        customerId: "CUST_002", 
        sessionId: "session_def456",
        journeyStart: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
        journeyEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        conversionValue: "125.50",
        conversionType: "subscription",
        status: "completed",
        touchpoints: [
          { channel: "LinkedIn Ads", platform: "linkedin", medium: "social", source: "linkedin", campaign: "b2b_targeting", position: 1, hours: 21 * 24 },
          { channel: "Content Marketing", platform: "website", medium: "organic", source: "blog", campaign: "seo_content", position: 2, hours: 18 * 24 + 4 },
          { channel: "Email", platform: "mailchimp", medium: "email", source: "drip_campaign", campaign: "nurture_sequence", position: 3, hours: 10 * 24 + 12 },
          { channel: "LinkedIn Ads", platform: "linkedin", medium: "social", source: "linkedin", campaign: "retargeting", position: 4, hours: 3 * 24 + 6 }
        ]
      },
      {
        customerId: "CUST_003",
        sessionId: "session_ghi789", 
        journeyStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
        journeyEnd: new Date(),
        conversionValue: "450.00",
        conversionType: "purchase", 
        status: "completed",
        touchpoints: [
          { channel: "Instagram Ads", platform: "facebook", medium: "social", source: "instagram", campaign: "visual_showcase", position: 1, hours: 7 * 24 },
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "competitor_keywords", position: 2, hours: 5 * 24 + 8 },
          { channel: "YouTube", platform: "google", medium: "video", source: "youtube", campaign: "product_demo", position: 3, hours: 3 * 24 + 14 },
          { channel: "Email", platform: "mailchimp", medium: "email", source: "abandoned_cart", campaign: "cart_recovery", position: 4, hours: 2 * 24 },
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "brand_keywords", position: 5, hours: 6 }
        ]
      },
      {
        customerId: "CUST_004",
        sessionId: "session_jkl012",
        journeyStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        journeyEnd: null, // Still active
        conversionValue: null,
        conversionType: null,
        status: "active",
        touchpoints: [
          { channel: "Facebook", platform: "facebook", medium: "social", source: "facebook", campaign: "lookalike_audience", position: 1, hours: 30 * 24 },
          { channel: "Content Marketing", platform: "website", medium: "organic", source: "blog", campaign: "seo_content", position: 2, hours: 25 * 24 + 6 },
          { channel: "Email", platform: "mailchimp", medium: "email", source: "newsletter", campaign: "weekly_deals", position: 3, hours: 20 * 24 + 10 },
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "display_network", position: 4, hours: 15 * 24 + 18 },
          { channel: "Direct", platform: null, medium: "direct", source: "direct", campaign: null, position: 5, hours: 10 * 24 + 4 },
          { channel: "Instagram Ads", platform: "facebook", medium: "social", source: "instagram", campaign: "stories_campaign", position: 6, hours: 5 * 24 + 12 }
        ]
      },
      {
        customerId: "CUST_005",
        sessionId: "session_mno345",
        journeyStart: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        journeyEnd: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
        conversionValue: null,
        conversionType: null,
        status: "abandoned",
        touchpoints: [
          { channel: "Google Ads", platform: "google", medium: "cpc", source: "google", campaign: "awareness_keywords", position: 1, hours: 45 * 24 },
          { channel: "Facebook", platform: "facebook", medium: "social", source: "facebook", campaign: "interest_targeting", position: 2, hours: 42 * 24 + 8 },
          { channel: "Email", platform: "mailchimp", medium: "email", source: "welcome_series", campaign: "onboarding", position: 3, hours: 38 * 24 + 16 },
          { channel: "Content Marketing", platform: "website", medium: "organic", source: "blog", campaign: "seo_content", position: 4, hours: 35 * 24 + 4 }
        ]
      }
    ];

    // Create the journey and touchpoint records
    sampleJourneys.forEach(journeyData => {
      // Create customer journey
      const journeyId = randomUUID();
      const journey: CustomerJourney = {
        id: journeyId,
        customerId: journeyData.customerId,
        sessionId: journeyData.sessionId,
        deviceId: null,
        userId: null,
        journeyStart: journeyData.journeyStart,
        journeyEnd: journeyData.journeyEnd,
        totalTouchpoints: journeyData.touchpoints.length,
        conversionValue: journeyData.conversionValue,
        conversionType: journeyData.conversionType,
        status: journeyData.status,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      this.customerJourneys.set(journeyId, journey);

      // Create touchpoints for this journey
      journeyData.touchpoints.forEach(touchpointData => {
        const touchpointId = randomUUID();
        const timestamp = new Date(journeyData.journeyStart.getTime() + (journeyData.touchpoints.length * 24 * 60 * 60 * 1000 - touchpointData.hours * 60 * 60 * 1000));
        
        const touchpoint: Touchpoint = {
          id: touchpointId,
          journeyId,
          campaignId: null, // Could link to actual campaign IDs
          channel: touchpointData.channel,
          platform: touchpointData.platform,
          medium: touchpointData.medium,
          source: touchpointData.source,
          campaign: touchpointData.campaign,
          content: null,
          term: null,
          touchpointType: "interaction",
          position: touchpointData.position,
          timestamp,
          deviceType: "desktop",
          userAgent: "Mozilla/5.0 (compatible sample)",
          ipAddress: null,
          referrer: null,
          landingPage: "/",
          eventValue: journeyData.conversionValue && touchpointData.position === journeyData.touchpoints.length ? journeyData.conversionValue : null,
          metadata: JSON.stringify({ sample: true }),
          createdAt: new Date(),
        };
        
        this.touchpoints.set(touchpointId, touchpoint);
      });

      // Calculate attribution results for completed journeys using default model
      if (journey.status === 'completed' && journey.conversionValue) {
        const defaultModel = Array.from(this.attributionModels.values()).find(m => m.isDefault);
        if (defaultModel) {
          // Skip calculation for now - will be implemented properly later
          // this.calculateAttributionResults(journeyId, defaultModel.id);
        }
      }
    });
  }

  // Campaign methods
  async getCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const campaign: Campaign = { 
      id,
      name: insertCampaign.name,
      clientWebsite: insertCampaign.clientWebsite || null,
      label: insertCampaign.label || null,
      budget: insertCampaign.budget || null,
      type: insertCampaign.type || null,
      platform: insertCampaign.platform || null,
      impressions: insertCampaign.impressions || 0,
      clicks: insertCampaign.clicks || 0,
      spend: insertCampaign.spend || "0",
      status: insertCampaign.status || "active",
      createdAt: new Date()
    };
    this.campaigns.set(id, campaign);
    return campaign;
  }

  async updateCampaign(id: string, updateData: Partial<InsertCampaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    
    const updatedCampaign = { ...campaign, ...updateData };
    this.campaigns.set(id, updatedCampaign);
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }

  // Metrics methods
  async getMetrics(): Promise<Metric[]> {
    return Array.from(this.metrics.values()).sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }

  async createMetric(insertMetric: InsertMetric): Promise<Metric> {
    const id = randomUUID();
    const metric: Metric = { 
      ...insertMetric, 
      id,
      date: new Date()
    };
    this.metrics.set(id, metric);
    return metric;
  }

  // Integration methods
  async getIntegrations(): Promise<Integration[]> {
    return Array.from(this.integrations.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getIntegration(id: string): Promise<Integration | undefined> {
    return this.integrations.get(id);
  }

  async createIntegration(insertIntegration: InsertIntegration): Promise<Integration> {
    const id = randomUUID();
    const integration: Integration = { 
      ...insertIntegration, 
      id,
      credentials: insertIntegration.credentials || null,
      connected: insertIntegration.connected || false,
      lastSync: null,
      createdAt: new Date()
    };
    this.integrations.set(id, integration);
    return integration;
  }

  async updateIntegration(id: string, updateData: Partial<InsertIntegration>): Promise<Integration | undefined> {
    const integration = this.integrations.get(id);
    if (!integration) return undefined;
    
    const updatedIntegration = { 
      ...integration, 
      ...updateData,
      lastSync: new Date()
    };
    this.integrations.set(id, updatedIntegration);
    return updatedIntegration;
  }

  // Performance Data methods
  async getPerformanceData(): Promise<PerformanceData[]> {
    return Array.from(this.performanceData.values());
  }

  async createPerformanceData(insertData: InsertPerformanceData): Promise<PerformanceData> {
    const id = randomUUID();
    const data: PerformanceData = { ...insertData, id };
    this.performanceData.set(id, data);
    return data;
  }

  // GA4 Connection methods
  async getGA4Connections(campaignId: string): Promise<GA4Connection[]> {
    return Array.from(this.ga4Connections.values()).filter(conn => conn.campaignId === campaignId && conn.isActive);
  }

  async getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined> {
    const connections = await this.getGA4Connections(campaignId);
    if (propertyId) {
      return connections.find(conn => conn.propertyId === propertyId);
    }
    // Return the primary connection if no propertyId specified
    return connections.find(conn => conn.isPrimary) || connections[0];
  }

  async getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    const connections = await this.getGA4Connections(campaignId);
    return connections.find(conn => conn.isPrimary) || connections[0];
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    const id = randomUUID();
    const existingConnections = await this.getGA4Connections(connection.campaignId);
    const isFirstConnection = existingConnections.length === 0;
    
    const ga4Connection: GA4Connection = {
      id,
      campaignId: connection.campaignId,
      propertyId: connection.propertyId,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      serviceAccountKey: connection.serviceAccountKey || null,
      method: connection.method,
      propertyName: connection.propertyName || null,
      websiteUrl: connection.websiteUrl || null,
      displayName: connection.displayName || connection.propertyName || null,
      isPrimary: connection.isPrimary !== undefined ? connection.isPrimary : isFirstConnection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.ga4Connections.set(id, ga4Connection);
    return ga4Connection;
  }

  async updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const existing = this.ga4Connections.get(connectionId);
    if (!existing) return undefined;
    
    const updated: GA4Connection = {
      ...existing,
      ...connection,
    };
    
    this.ga4Connections.set(connectionId, updated);
    return updated;
  }

  async updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined> {
    const existing = this.ga4Connections.get(connectionId);
    if (!existing) return undefined;
    
    const updated: GA4Connection = {
      ...existing,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || existing.refreshToken,
      expiresAt: tokens.expiresAt || existing.expiresAt,
    };
    
    this.ga4Connections.set(connectionId, updated);
    return updated;
  }

  async setPrimaryGA4Connection(campaignId: string, connectionId: string): Promise<boolean> {
    const connections = await this.getGA4Connections(campaignId);
    let found = false;
    
    // Set all connections for this campaign to non-primary, then set the specified one as primary
    for (const conn of connections) {
      const updated = { ...conn, isPrimary: conn.id === connectionId };
      this.ga4Connections.set(conn.id, updated);
      if (conn.id === connectionId) found = true;
    }
    
    return found;
  }

  async deleteGA4Connection(connectionId: string): Promise<boolean> {
    return this.ga4Connections.delete(connectionId);
  }

  async upsertGA4DailyMetrics(rows: InsertGA4DailyMetric[]): Promise<{ upserted: number }> {
    const input = Array.isArray(rows) ? rows : [];
    if (input.length === 0) return { upserted: 0 };

    for (const r of input) {
      const campaignId = String((r as any)?.campaignId || "");
      const propertyId = String((r as any)?.propertyId || "");
      const date = String((r as any)?.date || "");
      if (!campaignId || !propertyId || !date) continue;
      const key = `${campaignId}:${propertyId}:${date}`;

      const existing = this.ga4DailyMetrics.get(key);
      const now = new Date();
      const users = Number((r as any)?.users || 0) || 0;
      const sessions = Number((r as any)?.sessions || 0) || 0;
      const pageviews = Number((r as any)?.pageviews || 0) || 0;
      const conversions = Number((r as any)?.conversions || 0) || 0;
      const revenue = String((r as any)?.revenue ?? "0");
      const engagementRate = (r as any)?.engagementRate ?? null;
      const revenueMetric = (r as any)?.revenueMetric ?? null;
      const isSimulated = Boolean((r as any)?.isSimulated);

      if (existing) {
        this.ga4DailyMetrics.set(key, {
          ...existing,
          users,
          sessions,
          pageviews,
          conversions,
          revenue: revenue as any,
          engagementRate: engagementRate as any,
          revenueMetric: revenueMetric as any,
          isSimulated,
          updatedAt: now,
        } as any);
      } else {
        const id = randomUUID();
        this.ga4DailyMetrics.set(key, {
          id,
          campaignId,
          propertyId,
          date,
          users,
          sessions,
          pageviews,
          conversions,
          revenue: revenue as any,
          engagementRate: engagementRate as any,
          revenueMetric: revenueMetric as any,
          isSimulated,
          updatedAt: now,
          createdAt: now,
        } as any);
      }
    }
    return { upserted: input.length };
  }

  async getGA4DailyMetrics(campaignId: string, propertyId: string, startDate: string, endDate: string): Promise<GA4DailyMetric[]> {
    const cid = String(campaignId || "");
    const pid = String(propertyId || "");
    const start = String(startDate || "");
    const end = String(endDate || "");
    const out = Array.from(this.ga4DailyMetrics.values()).filter((r) => {
      return String((r as any)?.campaignId) === cid &&
        String((r as any)?.propertyId) === pid &&
        String((r as any)?.date || "") >= start &&
        String((r as any)?.date || "") <= end;
    });
    out.sort((a: any, b: any) => String(a?.date || "").localeCompare(String(b?.date || "")));
    return out as any;
  }

  async getLatestGA4DailyMetric(campaignId: string, propertyId: string): Promise<GA4DailyMetric | undefined> {
    const cid = String(campaignId || "");
    const pid = String(propertyId || "");
    const out = Array.from(this.ga4DailyMetrics.values()).filter((r) => {
      return String((r as any)?.campaignId) === cid && String((r as any)?.propertyId) === pid;
    });
    out.sort((a: any, b: any) => String(b?.date || "").localeCompare(String(a?.date || "")));
    return (out[0] as any) || undefined;
  }

  async upsertLinkedInDailyMetrics(rows: InsertLinkedInDailyMetric[]): Promise<{ upserted: number }> {
    const items = Array.isArray(rows) ? rows : [];
    let upserted = 0;
    for (const r of items) {
      const cid = String((r as any)?.campaignId || "");
      const date = String((r as any)?.date || "");
      if (!cid || !date) continue;
      const key = `${cid}:${date}`;
      const now = new Date();
      const existing = this.linkedinDailyMetrics.get(key);
      if (!existing) {
        this.linkedinDailyMetrics.set(key, {
          id: randomUUID(),
          campaignId: cid,
          date,
          impressions: Number((r as any).impressions || 0),
          clicks: Number((r as any).clicks || 0),
          reach: Number((r as any).reach || 0),
          engagements: Number((r as any).engagements || 0),
          conversions: Number((r as any).conversions || 0),
          leads: Number((r as any).leads || 0),
          spend: String((r as any).spend ?? "0"),
          videoViews: Number((r as any).videoViews || 0),
          viralImpressions: Number((r as any).viralImpressions || 0),
          updatedAt: now,
          createdAt: now,
        } as any);
      } else {
        this.linkedinDailyMetrics.set(key, {
          ...(existing as any),
          impressions: Number((r as any).impressions || 0),
          clicks: Number((r as any).clicks || 0),
          reach: Number((r as any).reach || 0),
          engagements: Number((r as any).engagements || 0),
          conversions: Number((r as any).conversions || 0),
          leads: Number((r as any).leads || 0),
          spend: String((r as any).spend ?? "0"),
          videoViews: Number((r as any).videoViews || 0),
          viralImpressions: Number((r as any).viralImpressions || 0),
          updatedAt: now,
        } as any);
      }
      upserted += 1;
    }
    return { upserted };
  }

  async getLinkedInDailyMetrics(campaignId: string, startDate: string, endDate: string): Promise<LinkedInDailyMetric[]> {
    const cid = String(campaignId || "");
    const start = String(startDate || "");
    const end = String(endDate || "");
    const out = Array.from(this.linkedinDailyMetrics.values()).filter((r) => {
      return String((r as any)?.campaignId || "") === cid && String((r as any)?.date || "") >= start && String((r as any)?.date || "") <= end;
    });
    out.sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
    return out as any;
  }

  // Spend methods
  async getSpendSources(campaignId: string): Promise<SpendSource[]> {
    return Array.from(this.spendSources.values())
      .filter((s) => s.campaignId === campaignId && (s as any).isActive !== false);
  }

  async getSpendSource(campaignId: string, sourceId: string): Promise<SpendSource | undefined> {
    const s = this.spendSources.get(sourceId);
    if (!s) return undefined;
    if (s.campaignId !== campaignId) return undefined;
    if ((s as any).isActive === false) return undefined;
    return s;
  }

  async createSpendSource(source: InsertSpendSource): Promise<SpendSource> {
    const id = randomUUID();
    const now = new Date();
    const spendSource: SpendSource = {
      id,
      campaignId: source.campaignId,
      sourceType: source.sourceType,
      displayName: (source as any).displayName ?? null,
      currency: (source as any).currency ?? null,
      mappingConfig: (source as any).mappingConfig ?? null,
      isActive: (source as any).isActive ?? true,
      connectedAt: (now as any),
      createdAt: (now as any),
    } as any;
    this.spendSources.set(id, spendSource);
    return spendSource;
  }

  async updateSpendSource(sourceId: string, source: Partial<InsertSpendSource>): Promise<SpendSource | undefined> {
    const existing = this.spendSources.get(sourceId);
    if (!existing) return undefined;
    const updated: SpendSource = { ...(existing as any), ...(source as any) } as any;
    this.spendSources.set(sourceId, updated);
    return updated;
  }

  async deleteSpendSource(sourceId: string): Promise<boolean> {
    const existing = this.spendSources.get(sourceId);
    if (!existing) return false;
    this.spendSources.set(sourceId, { ...(existing as any), isActive: false } as any);
    return true;
  }

  async deleteSpendRecordsBySource(sourceId: string): Promise<boolean> {
    for (const [id, rec] of this.spendRecords.entries()) {
      if ((rec as any).spendSourceId === sourceId) this.spendRecords.delete(id);
    }
    return true;
  }

  async createSpendRecords(records: InsertSpendRecord[]): Promise<SpendRecord[]> {
    const created: SpendRecord[] = [];
    for (const r of records) {
      const id = randomUUID();
      const now = new Date();
      const rec: SpendRecord = {
        id,
        campaignId: r.campaignId,
        spendSourceId: r.spendSourceId,
        date: r.date,
        spend: (r as any).spend as any,
        currency: (r as any).currency ?? null,
        createdAt: (now as any),
      } as any;
      this.spendRecords.set(id, rec);
      created.push(rec);
    }
    return created;
  }

  async getSpendTotalForRange(campaignId: string, startDate: string, endDate: string): Promise<{ totalSpend: number; currency?: string; sourceIds: string[] }> {
    const start = new Date(startDate + "T00:00:00Z").getTime();
    const end = new Date(endDate + "T23:59:59Z").getTime();
    let total = 0;
    const sourceIds = new Set<string>();
    let currency: string | undefined = undefined;

    for (const rec of this.spendRecords.values()) {
      if (rec.campaignId !== campaignId) continue;
      const srcId = String((rec as any).spendSourceId);
      const src = this.spendSources.get(srcId);
      if (!src || (src as any).isActive === false) continue;
      const t = new Date(String((rec as any).date) + "T00:00:00Z").getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const v = parseFloat(String((rec as any).spend ?? "0"));
      if (!Number.isNaN(v)) total += v;
      sourceIds.add(srcId);
      if (!currency && (rec as any).currency) currency = String((rec as any).currency);
    }

    return { totalSpend: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  // Revenue methods
  async getRevenueSources(campaignId: string, platformContext: 'ga4' | 'linkedin' = 'ga4'): Promise<RevenueSource[]> {
    return Array.from(this.revenueSources.values())
      .filter((s) => {
        if ((s as any).campaignId !== campaignId) return false;
        if ((s as any).isActive === false) return false;
        const ctx = String((s as any).platformContext || '').trim().toLowerCase();
        if (!ctx) return platformContext === 'ga4'; // legacy rows
        return ctx === platformContext;
      });
  }

  async getRevenueSource(campaignId: string, sourceId: string): Promise<RevenueSource | undefined> {
    const s = this.revenueSources.get(sourceId);
    if (!s) return undefined;
    if ((s as any).campaignId !== campaignId) return undefined;
    if ((s as any).isActive === false) return undefined;
    return s;
  }

  async createRevenueSource(source: InsertRevenueSource): Promise<RevenueSource> {
    const id = randomUUID();
    const now = new Date();
    const revenueSource: RevenueSource = {
      id,
      campaignId: (source as any).campaignId,
      sourceType: (source as any).sourceType,
      platformContext: (source as any).platformContext ?? null,
      displayName: (source as any).displayName ?? null,
      currency: (source as any).currency ?? null,
      mappingConfig: (source as any).mappingConfig ?? null,
      isActive: (source as any).isActive ?? true,
      connectedAt: (now as any),
      createdAt: (now as any),
    } as any;
    this.revenueSources.set(id, revenueSource);
    return revenueSource;
  }

  async updateRevenueSource(sourceId: string, source: Partial<InsertRevenueSource>): Promise<RevenueSource | undefined> {
    const existing = this.revenueSources.get(sourceId);
    if (!existing) return undefined;
    const updated: RevenueSource = { ...(existing as any), ...(source as any) } as any;
    this.revenueSources.set(sourceId, updated);
    return updated;
  }

  async deleteRevenueSource(sourceId: string): Promise<boolean> {
    const existing = this.revenueSources.get(sourceId);
    if (!existing) return false;
    this.revenueSources.set(sourceId, { ...(existing as any), isActive: false } as any);
    return true;
  }

  async deleteRevenueRecordsBySource(sourceId: string): Promise<boolean> {
    for (const [id, rec] of this.revenueRecords.entries()) {
      if (String((rec as any).revenueSourceId) === sourceId) this.revenueRecords.delete(id);
    }
    return true;
  }

  async createRevenueRecords(records: InsertRevenueRecord[]): Promise<RevenueRecord[]> {
    const created: RevenueRecord[] = [];
    for (const r of records) {
      const id = randomUUID();
      const now = new Date();
      const rec: RevenueRecord = {
        id,
        campaignId: (r as any).campaignId,
        revenueSourceId: (r as any).revenueSourceId,
        date: (r as any).date,
        revenue: (r as any).revenue as any,
        currency: (r as any).currency ?? null,
        externalId: (r as any).externalId ?? null,
        createdAt: (now as any),
      } as any;
      this.revenueRecords.set(id, rec);
      created.push(rec);
    }
    return created;
  }

  async getRevenueTotalForRange(campaignId: string, startDate: string, endDate: string, platformContext: 'ga4' | 'linkedin' = 'ga4'): Promise<{ totalRevenue: number; currency?: string; sourceIds: string[] }> {
    const start = new Date(startDate + "T00:00:00Z").getTime();
    const end = new Date(endDate + "T23:59:59Z").getTime();
    let total = 0;
    const sourceIds = new Set<string>();
    let currency: string | undefined = undefined;

    for (const rec of this.revenueRecords.values()) {
      if (String((rec as any).campaignId) !== campaignId) continue;
      const srcId = String((rec as any).revenueSourceId);
      const src = this.revenueSources.get(srcId);
      if (!src || (src as any).isActive === false) continue;
      const ctx = String((src as any).platformContext || '').trim().toLowerCase();
      if (!ctx) {
        if (platformContext !== 'ga4') continue;
      } else if (ctx !== platformContext) {
        continue;
      }
      const t = new Date(String((rec as any).date) + "T00:00:00Z").getTime();
      if (Number.isNaN(t) || t < start || t > end) continue;
      const v = parseFloat(String((rec as any).revenue ?? "0"));
      if (!Number.isNaN(v)) total += v;
      sourceIds.add(srcId);
      if (!currency && (rec as any).currency) currency = String((rec as any).currency);
    }

    return { totalRevenue: Number(total.toFixed(2)), currency, sourceIds: Array.from(sourceIds) };
  }

  // Google Sheets Connection methods
  async getGoogleSheetsConnections(campaignId: string, purpose?: string): Promise<GoogleSheetsConnection[]> {
    const connections: GoogleSheetsConnection[] = [];
    for (const connection of this.googleSheetsConnections.values()) {
      const matchesPurpose = purpose ? (String((connection as any).purpose || "") === purpose) : true;
      if (connection.campaignId === campaignId && connection.isActive && matchesPurpose) {
        connections.push(connection);
      }
    }
    return connections.sort((a, b) => 
      new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime()
    );
  }

  async getGoogleSheetsConnection(campaignId: string, spreadsheetId?: string): Promise<GoogleSheetsConnection | undefined> {
    if (spreadsheetId) {
      for (const connection of this.googleSheetsConnections.values()) {
        if (connection.campaignId === campaignId && 
            connection.spreadsheetId === spreadsheetId && 
            connection.isActive) {
          return connection;
        }
      }
      return undefined;
    }
    
    // Return the primary connection if no spreadsheetId specified
    for (const connection of this.googleSheetsConnections.values()) {
      if (connection.campaignId === campaignId && 
          connection.isPrimary && 
          connection.isActive) {
        return connection;
      }
    }
    
    // Fallback to first active connection if no primary
    for (const connection of this.googleSheetsConnections.values()) {
      if (connection.campaignId === campaignId && connection.isActive) {
        return connection;
      }
    }
    
    return undefined;
  }

  async getPrimaryGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined> {
    for (const connection of this.googleSheetsConnections.values()) {
      if (connection.campaignId === campaignId && 
          connection.isPrimary && 
          connection.isActive) {
        return connection;
      }
    }
    return undefined;
  }

  async createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection> {
    const id = randomUUID();
    
    // Check connection limit (10 sheets per campaign)
    const MAX_CONNECTIONS = 10;
    const existingConnections = await this.getGoogleSheetsConnections(connection.campaignId);
    
    if (existingConnections.length >= MAX_CONNECTIONS) {
      throw new Error(`Maximum limit of ${MAX_CONNECTIONS} Google Sheets connections per campaign reached. Please remove an existing connection first.`);
    }
    
    // Check if this is the first connection for this campaign - make it primary
    const isPrimary = existingConnections.length === 0;
    
    const sheetsConnection: GoogleSheetsConnection = {
      id,
      campaignId: connection.campaignId,
      spreadsheetId: connection.spreadsheetId,
      spreadsheetName: connection.spreadsheetName || null,
      sheetName: connection.sheetName || null,
      purpose: (connection as any).purpose || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      isPrimary: isPrimary,
      isActive: true,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.googleSheetsConnections.set(id, sheetsConnection);
    return sheetsConnection;
  }

  async updateGoogleSheetsConnection(connectionId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined> {
    const existing = this.googleSheetsConnections.get(connectionId);
    if (!existing) return undefined;
    
    const updated: GoogleSheetsConnection = {
      ...existing,
      ...connection,
      id: existing.id,
      campaignId: existing.campaignId,
    };
    
    this.googleSheetsConnections.set(connectionId, updated);
    return updated;
  }

  async setPrimaryGoogleSheetsConnection(campaignId: string, connectionId: string): Promise<boolean> {
    const connections = await this.getGoogleSheetsConnections(campaignId);
    let found = false;
    
    // Set all connections for this campaign to non-primary, then set the specified one as primary
    for (const conn of connections) {
      const updated = { ...conn, isPrimary: conn.id === connectionId };
      this.googleSheetsConnections.set(conn.id, updated);
      if (conn.id === connectionId) found = true;
    }
    
    return found;
  }

  async deleteGoogleSheetsConnection(connectionId: string): Promise<boolean> {
    const connection = this.googleSheetsConnections.get(connectionId);
    if (!connection) return false;
    
    // Soft delete by setting isActive to false
    const updated: GoogleSheetsConnection = {
      ...connection,
      isActive: false
    };
    this.googleSheetsConnections.set(connectionId, updated);
    
    // If this was the primary connection, make the first remaining connection primary
    if (connection.isPrimary) {
      const remainingConnections = await this.getGoogleSheetsConnections(connection.campaignId);
      if (remainingConnections.length > 0) {
        const newPrimary = remainingConnections[0];
        await this.setPrimaryGoogleSheetsConnection(connection.campaignId, newPrimary.id);
      }
    }
    
    return true;
  }

  // HubSpot Connection methods
  async getHubspotConnections(campaignId: string): Promise<HubspotConnection[]> {
    const connections: HubspotConnection[] = [];
    for (const connection of this.hubspotConnections.values()) {
      if (connection.campaignId === campaignId && connection.isActive) {
        connections.push(connection);
      }
    }
    return connections.sort(
      (a, b) => new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime()
    );
  }

  async getHubspotConnection(campaignId: string): Promise<HubspotConnection | undefined> {
    // Return the most recently connected active connection (V1 assumes one per campaign)
    const connections = await this.getHubspotConnections(campaignId);
    if (connections.length === 0) return undefined;
    return connections[connections.length - 1];
  }

  async createHubspotConnection(connection: InsertHubspotConnection): Promise<HubspotConnection> {
    const id = randomUUID();
    const hubspotConnection: HubspotConnection = {
      id,
      campaignId: connection.campaignId,
      portalId: connection.portalId || null,
      portalName: connection.portalName || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      isActive: connection.isActive ?? true,
      mappingConfig: connection.mappingConfig || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    this.hubspotConnections.set(id, hubspotConnection);
    return hubspotConnection;
  }

  async updateHubspotConnection(connectionId: string, connection: Partial<InsertHubspotConnection>): Promise<HubspotConnection | undefined> {
    const existing = this.hubspotConnections.get(connectionId);
    if (!existing) return undefined;

    const updated: HubspotConnection = {
      ...existing,
      ...connection,
      id: existing.id,
      campaignId: existing.campaignId,
    };

    this.hubspotConnections.set(connectionId, updated);
    return updated;
  }

  async deleteHubspotConnection(connectionId: string): Promise<boolean> {
    const connection = this.hubspotConnections.get(connectionId);
    if (!connection) return false;

    // Soft delete
    const updated: HubspotConnection = {
      ...connection,
      isActive: false,
    };
    this.hubspotConnections.set(connectionId, updated);
    return true;
  }

  // Salesforce Connection methods
  async getSalesforceConnections(campaignId: string): Promise<SalesforceConnection[]> {
    const connections: SalesforceConnection[] = [];
    for (const connection of this.salesforceConnections.values()) {
      if (connection.campaignId === campaignId && connection.isActive) {
        connections.push(connection);
      }
    }
    return connections.sort(
      (a, b) => new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime()
    );
  }

  async getSalesforceConnection(campaignId: string): Promise<SalesforceConnection | undefined> {
    const connections = await this.getSalesforceConnections(campaignId);
    if (connections.length === 0) return undefined;
    return connections[connections.length - 1];
  }

  async createSalesforceConnection(connection: InsertSalesforceConnection): Promise<SalesforceConnection> {
    const id = randomUUID();
    const sfConnection: SalesforceConnection = {
      id,
      campaignId: connection.campaignId,
      orgId: connection.orgId || null,
      orgName: connection.orgName || null,
      instanceUrl: connection.instanceUrl || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      isActive: connection.isActive ?? true,
      mappingConfig: connection.mappingConfig || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    this.salesforceConnections.set(id, sfConnection);
    return sfConnection;
  }

  async updateSalesforceConnection(connectionId: string, connection: Partial<InsertSalesforceConnection>): Promise<SalesforceConnection | undefined> {
    const existing = this.salesforceConnections.get(connectionId);
    if (!existing) return undefined;
    const updated: SalesforceConnection = {
      ...existing,
      ...connection,
      id: existing.id,
      campaignId: existing.campaignId,
    };
    this.salesforceConnections.set(connectionId, updated);
    return updated;
  }

  async deleteSalesforceConnection(connectionId: string): Promise<boolean> {
    const connection = this.salesforceConnections.get(connectionId);
    if (!connection) return false;
    this.salesforceConnections.set(connectionId, { ...connection, isActive: false });
    return true;
  }

  // Shopify Connection methods
  async getShopifyConnections(campaignId: string): Promise<ShopifyConnection[]> {
    const connections: ShopifyConnection[] = [];
    for (const connection of this.shopifyConnections.values()) {
      if (connection.campaignId === campaignId && connection.isActive) {
        connections.push(connection);
      }
    }
    return connections.sort(
      (a, b) => new Date(a.connectedAt).getTime() - new Date(b.connectedAt).getTime()
    );
  }

  async getShopifyConnection(campaignId: string): Promise<ShopifyConnection | undefined> {
    const connections = await this.getShopifyConnections(campaignId);
    if (connections.length === 0) return undefined;
    return connections[connections.length - 1];
  }

  async createShopifyConnection(connection: InsertShopifyConnection): Promise<ShopifyConnection> {
    const id = randomUUID();
    const shopifyConnection: ShopifyConnection = {
      id,
      campaignId: connection.campaignId,
      shopDomain: connection.shopDomain,
      shopName: connection.shopName || null,
      accessToken: connection.accessToken || null,
      isActive: connection.isActive ?? true,
      mappingConfig: connection.mappingConfig || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    this.shopifyConnections.set(id, shopifyConnection);
    return shopifyConnection;
  }

  async updateShopifyConnection(connectionId: string, connection: Partial<InsertShopifyConnection>): Promise<ShopifyConnection | undefined> {
    const existing = this.shopifyConnections.get(connectionId);
    if (!existing) return undefined;
    const updated: ShopifyConnection = {
      ...existing,
      ...connection,
      id: existing.id,
      campaignId: existing.campaignId,
    };
    this.shopifyConnections.set(connectionId, updated);
    return updated;
  }

  async deleteShopifyConnection(connectionId: string): Promise<boolean> {
    const connection = this.shopifyConnections.get(connectionId);
    if (!connection) return false;
    this.shopifyConnections.set(connectionId, { ...connection, isActive: false });
    return true;
  }

  // LinkedIn Connection methods
  async getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined> {
    return this.linkedinConnections.get(campaignId);
  }

  async createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection> {
    const id = randomUUID();
    const linkedinConnection: LinkedInConnection = {
      id,
      campaignId: connection.campaignId,
      adAccountId: connection.adAccountId,
      adAccountName: connection.adAccountName || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      method: connection.method,
      expiresAt: connection.expiresAt || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.linkedinConnections.set(connection.campaignId, linkedinConnection);
    return linkedinConnection;
  }

  async updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined> {
    const existing = this.linkedinConnections.get(campaignId);
    if (!existing) return undefined;
    
    const updated: LinkedInConnection = {
      ...existing,
      ...connection,
    };
    
    this.linkedinConnections.set(campaignId, updated);
    return updated;
  }

  async deleteLinkedInConnection(campaignId: string): Promise<boolean> {
    return this.linkedinConnections.delete(campaignId);
  }

  // Meta Connection methods
  async getMetaConnection(campaignId: string): Promise<MetaConnection | undefined> {
    return this.metaConnections.get(campaignId);
  }

  async createMetaConnection(connection: InsertMetaConnection): Promise<MetaConnection> {
    const id = randomUUID();
    const metaConnection: MetaConnection = {
      id,
      campaignId: connection.campaignId,
      adAccountId: connection.adAccountId,
      adAccountName: connection.adAccountName || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      method: connection.method,
      expiresAt: connection.expiresAt || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.metaConnections.set(connection.campaignId, metaConnection);
    return metaConnection;
  }

  async updateMetaConnection(campaignId: string, connection: Partial<InsertMetaConnection>): Promise<MetaConnection | undefined> {
    const existing = this.metaConnections.get(campaignId);
    if (!existing) return undefined;
    
    const updated: MetaConnection = {
      ...existing,
      ...connection,
    };
    
    this.metaConnections.set(campaignId, updated);
    return updated;
  }

  async deleteMetaConnection(campaignId: string): Promise<boolean> {
    return this.metaConnections.delete(campaignId);
  }

  // LinkedIn Import Session methods
  async getLinkedInImportSession(sessionId: string): Promise<LinkedInImportSession | undefined> {
    return this.linkedinImportSessions.get(sessionId);
  }

  async getCampaignLinkedInImportSessions(campaignId: string): Promise<LinkedInImportSession[]> {
    return Array.from(this.linkedinImportSessions.values())
      .filter(session => session.campaignId === campaignId)
      .sort((a: any, b: any) => {
        const ta = new Date((a as any).importedAt).getTime();
        const tb = new Date((b as any).importedAt).getTime();
        if (tb !== ta) return tb - ta;
        // Deterministic tie-break to avoid "random" latest selection when timestamps match
        return String((b as any).id || "").localeCompare(String((a as any).id || ""));
      });
  }

  async getLatestLinkedInImportSession(campaignId: string): Promise<LinkedInImportSession | undefined> {
    const sessions = await this.getCampaignLinkedInImportSessions(campaignId);
    return sessions && sessions.length > 0 ? sessions[0] : undefined;
  }

  async createLinkedInImportSession(session: InsertLinkedInImportSession): Promise<LinkedInImportSession> {
    const id = randomUUID();
    const importSession: LinkedInImportSession = {
      id,
      campaignId: session.campaignId,
      adAccountId: session.adAccountId,
      adAccountName: session.adAccountName || null,
      selectedCampaignsCount: session.selectedCampaignsCount || 0,
      selectedMetricsCount: session.selectedMetricsCount || 0,
      selectedMetricKeys: session.selectedMetricKeys || null,
      importedAt: new Date(),
    };
    
    this.linkedinImportSessions.set(id, importSession);
    return importSession;
  }

  async updateLinkedInImportSession(sessionId: string, updates: Partial<InsertLinkedInImportSession>): Promise<LinkedInImportSession | undefined> {
    const existing = this.linkedinImportSessions.get(sessionId);
    if (!existing) return undefined;
    
    const updated: LinkedInImportSession = {
      ...existing,
      ...updates,
    };
    
    this.linkedinImportSessions.set(sessionId, updated);
    return updated;
  }

  // LinkedIn Import Metrics methods
  async getLinkedInImportMetrics(sessionId: string): Promise<LinkedInImportMetric[]> {
    return Array.from(this.linkedinImportMetrics.values())
      .filter(metric => metric.sessionId === sessionId)
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  async createLinkedInImportMetric(metric: InsertLinkedInImportMetric): Promise<LinkedInImportMetric> {
    const id = randomUUID();
    const importMetric: LinkedInImportMetric = {
      id,
      sessionId: metric.sessionId,
      campaignUrn: metric.campaignUrn,
      campaignName: metric.campaignName,
      campaignStatus: metric.campaignStatus || "active",
      metricKey: metric.metricKey,
      metricValue: metric.metricValue,
      importedAt: new Date(),
    };
    
    this.linkedinImportMetrics.set(id, importMetric);
    return importMetric;
  }

  // LinkedIn Ad Performance methods
  async getLinkedInAdPerformance(sessionId: string): Promise<LinkedInAdPerformance[]> {
    return Array.from(this.linkedinAdPerformance.values())
      .filter(ad => ad.sessionId === sessionId)
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
  }

  async createLinkedInAdPerformance(ad: InsertLinkedInAdPerformance): Promise<LinkedInAdPerformance> {
    const id = randomUUID();
    const adPerformance: LinkedInAdPerformance = {
      id,
      sessionId: ad.sessionId,
      adId: ad.adId,
      adName: ad.adName,
      campaignUrn: ad.campaignUrn,
      campaignName: ad.campaignName,
      campaignSelectedMetrics: ad.campaignSelectedMetrics || null,
      // Core Metrics
      impressions: ad.impressions || 0,
      reach: ad.reach || 0,
      clicks: ad.clicks || 0,
      engagements: ad.engagements || 0,
      spend: ad.spend || "0",
      conversions: ad.conversions || 0,
      leads: ad.leads || 0,
      videoViews: ad.videoViews || 0,
      viralImpressions: ad.viralImpressions || 0,
      // Derived Metrics
      ctr: ad.ctr || "0",
      cpc: ad.cpc || "0",
      cpm: ad.cpm || "0",
      cvr: ad.cvr || "0",
      cpa: ad.cpa || "0",
      cpl: ad.cpl || "0",
      er: ad.er || "0",
      roi: ad.roi || "0",
      roas: ad.roas || "0",
      revenue: ad.revenue || null,
      conversionRate: ad.conversionRate || "0",
      importedAt: new Date(),
    };
    
    this.linkedinAdPerformance.set(id, adPerformance);
    return adPerformance;
  }

  // LinkedIn Reports methods
  async getLinkedInReports(): Promise<LinkedInReport[]> {
    return Array.from(this.linkedinReports.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getLinkedInReport(id: string): Promise<LinkedInReport | undefined> {
    return this.linkedinReports.get(id);
  }

  async createLinkedInReport(report: InsertLinkedInReport): Promise<LinkedInReport> {
    const id = randomUUID();
    const linkedinReport: LinkedInReport = {
      id,
      name: report.name,
      description: report.description || null,
      platformType: (report as any).platformType || 'linkedin',
      reportType: report.reportType,
      configuration: report.configuration || null,
      scheduleEnabled: report.scheduleEnabled || false,
      scheduleFrequency: report.scheduleFrequency || null,
      scheduleDayOfWeek: report.scheduleDayOfWeek || null,
      scheduleDayOfMonth: report.scheduleDayOfMonth || null,
      scheduleTime: report.scheduleTime || null,
      scheduleRecipients: report.scheduleRecipients || null,
      lastSentAt: null,
      nextScheduledAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.linkedinReports.set(id, linkedinReport);
    return linkedinReport;
  }

  async updateLinkedInReport(id: string, report: Partial<InsertLinkedInReport>): Promise<LinkedInReport | undefined> {
    const existing = this.linkedinReports.get(id);
    if (!existing) return undefined;
    
    const updated: LinkedInReport = {
      ...existing,
      ...report,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    };
    
    this.linkedinReports.set(id, updated);
    return updated;
  }

  async deleteLinkedInReport(id: string): Promise<boolean> {
    return this.linkedinReports.delete(id);
  }

  // Platform Reports methods
  async getPlatformReports(platformType: string, campaignId?: string): Promise<LinkedInReport[]> {
    // Filter reports by platformType and optionally by campaignId
    return Array.from(this.linkedinReports.values())
      .filter(report => {
        const matches = (report as any).platformType === platformType;
        if (!matches) return false;
        if (campaignId) {
          return (report as any).campaignId === campaignId;
        } else {
          return !(report as any).campaignId; // Platform-level only
        }
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createPlatformReport(report: any): Promise<LinkedInReport> {
    // For now, use LinkedIn reports table for all platforms
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
    return Array.from(this.customIntegrations.values()).find(ci => ci.campaignId === campaignId);
  }

  async getCustomIntegrationById(integrationId: string): Promise<CustomIntegration | undefined> {
    return this.customIntegrations.get(integrationId);
  }

  async getCustomIntegrationByToken(token: string): Promise<CustomIntegration | undefined> {
    return Array.from(this.customIntegrations.values()).find(ci => ci.webhookToken === token);
  }

  async getCustomIntegrationByEmail(email: string): Promise<CustomIntegration | undefined> {
    return Array.from(this.customIntegrations.values()).find(ci => ci.email === email);
  }

  async getAllCustomIntegrations(): Promise<CustomIntegration[]> {
    return Array.from(this.customIntegrations.values());
  }

  async createCustomIntegration(integration: InsertCustomIntegration): Promise<CustomIntegration> {
    // Check if integration already exists for this campaign
    const existing = await this.getCustomIntegration(integration.campaignId);
    if (existing) {
      // Update existing integration with new email and webhook token
      existing.email = integration.email;
      existing.webhookToken = integration.webhookToken;
      existing.connectedAt = new Date();
      this.customIntegrations.set(existing.id, existing);
      return existing;
    }
    
    const id = randomUUID();
    const customIntegration: CustomIntegration = {
      id,
      campaignId: integration.campaignId,
      email: integration.email,
      webhookToken: integration.webhookToken,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.customIntegrations.set(id, customIntegration);
    return customIntegration;
  }

  async deleteCustomIntegration(campaignId: string): Promise<boolean> {
    const integration = await this.getCustomIntegration(campaignId);
    if (!integration) return false;
    return this.customIntegrations.delete(integration.id);
  }

  // Custom Integration Metrics methods
  async getCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined> {
    return Array.from(this.customIntegrationMetrics.values()).find(m => m.campaignId === campaignId);
  }

  async getAllCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics[]> {
    return Array.from(this.customIntegrationMetrics.values()).filter(m => m.campaignId === campaignId);
  }

  async createCustomIntegrationMetrics(metricsData: InsertCustomIntegrationMetrics): Promise<CustomIntegrationMetrics> {
    const id = randomUUID();
    const metrics: CustomIntegrationMetrics = {
      id,
      campaignId: metricsData.campaignId,
      impressions: metricsData.impressions || 0,
      reach: metricsData.reach || 0,
      clicks: metricsData.clicks || 0,
      engagements: metricsData.engagements || 0,
      spend: metricsData.spend || "0",
      conversions: metricsData.conversions || 0,
      leads: metricsData.leads || 0,
      videoViews: metricsData.videoViews || 0,
      viralImpressions: metricsData.viralImpressions || 0,
      pdfFileName: metricsData.pdfFileName || null,
      emailSubject: metricsData.emailSubject || null,
      emailId: metricsData.emailId || null,
      uploadedAt: new Date(),
    };
    
    this.customIntegrationMetrics.set(id, metrics);
    return metrics;
  }

  async getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined> {
    const allMetrics = Array.from(this.customIntegrationMetrics.values())
      .filter(m => m.campaignId === campaignId)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    return allMetrics[0];
  }

  // Conversion Events methods
  async getConversionEvents(campaignId: string, startDate?: Date, endDate?: Date): Promise<ConversionEvent[]> {
    let events = Array.from(this.conversionEvents.values()).filter(e => e.campaignId === campaignId);
    
    if (startDate) {
      events = events.filter(e => new Date(e.occurredAt) >= startDate);
    }
    if (endDate) {
      events = events.filter(e => new Date(e.occurredAt) <= endDate);
    }
    
    return events.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  }

  async createConversionEvent(eventData: InsertConversionEvent): Promise<ConversionEvent> {
    const id = randomUUID();
    const event: ConversionEvent = {
      id,
      campaignId: eventData.campaignId,
      conversionId: eventData.conversionId || null,
      value: eventData.value,
      currency: eventData.currency || "USD",
      conversionType: eventData.conversionType || null,
      source: eventData.source,
      metadata: eventData.metadata || null,
      occurredAt: eventData.occurredAt ? new Date(eventData.occurredAt) : new Date(),
      receivedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.conversionEvents.set(id, event);
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
    return Array.from(this.kpis.values()).filter(kpi => kpi.campaignId === campaignId);
  }

  async getPlatformKPIs(platformType: string, campaignId?: string): Promise<KPI[]> {
    return Array.from(this.kpis.values()).filter(kpi => {
      if (kpi.platformType !== platformType) return false;
      if (campaignId) {
        return kpi.campaignId === campaignId;
      } else {
        return !kpi.campaignId; // Platform-level only
      }
    });
  }

  async getKPI(id: string): Promise<KPI | undefined> {
    return this.kpis.get(id);
  }

  async createKPI(kpiData: InsertKPI): Promise<KPI> {
    const id = randomUUID();
    const kpi: KPI = {
      id,
      // Keep campaignId exactly as provided - don't transform undefined to null
      campaignId: kpiData.campaignId !== undefined ? kpiData.campaignId : null,
      platformType: kpiData.platformType || null,
      name: kpiData.name,
      targetValue: kpiData.targetValue,
      currentValue: kpiData.currentValue || "0",
      unit: kpiData.unit,
      description: kpiData.description || null,
      priority: kpiData.priority || "medium",
      status: kpiData.status || "tracking",
      timeframe: kpiData.timeframe || "monthly",
      trackingPeriod: kpiData.trackingPeriod || 30,
      rollingAverage: kpiData.rollingAverage || "7day",
      targetDate: kpiData.targetDate || null,
      alertThreshold: kpiData.alertThreshold || null,
      alertsEnabled: kpiData.alertsEnabled !== undefined ? kpiData.alertsEnabled : true,
      emailNotifications: kpiData.emailNotifications !== undefined ? kpiData.emailNotifications : false,
      slackNotifications: kpiData.slackNotifications !== undefined ? kpiData.slackNotifications : false,
      alertFrequency: kpiData.alertFrequency || "daily",
      lastAlertSent: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.kpis.set(id, kpi);
    return kpi;
  }

  async updateKPI(id: string, kpiData: Partial<InsertKPI>): Promise<KPI | undefined> {
    const existing = this.kpis.get(id);
    if (!existing) return undefined;
    
    const updated: KPI = {
      ...existing,
      ...kpiData,
      updatedAt: new Date(),
    };
    
    this.kpis.set(id, updated);
    return updated;
  }

  async deleteKPI(id: string): Promise<boolean> {
    // Also delete related progress records
    const progressRecords = Array.from(this.kpiProgress.values()).filter(p => p.kpiId === id);
    progressRecords.forEach(p => this.kpiProgress.delete(p.id));
    
    return this.kpis.delete(id);
  }

  async getKPIProgress(kpiId: string): Promise<KPIProgress[]> {
    return Array.from(this.kpiProgress.values())
      .filter(progress => progress.kpiId === kpiId)
      .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }

  async getLatestKPIPeriod(kpiId: string): Promise<KPIPeriod | null> {
    // For memory storage, return null (periods only stored in database)
    return null;
  }

  async recordKPIProgress(progressData: InsertKPIProgress): Promise<KPIProgress> {
    const id = randomUUID();
    
    // Calculate rolling averages
    const existingProgress = await this.getKPIProgress(progressData.kpiId);
    const rollingAverage7d = this.calculateRollingAverage(existingProgress, 7, progressData.value);
    const rollingAverage30d = this.calculateRollingAverage(existingProgress, 30, progressData.value);
    
    // Determine trend direction
    const trendDirection = this.calculateTrendDirection(existingProgress, progressData.value);
    
    const progress: KPIProgress = {
      id,
      kpiId: progressData.kpiId,
      value: progressData.value,
      rollingAverage7d: rollingAverage7d,
      rollingAverage30d: rollingAverage30d,
      trendDirection: trendDirection,
      recordedAt: new Date(),
      notes: progressData.notes || null,
    };
    
    this.kpiProgress.set(id, progress);
    
    // Update the KPI's current value
    const kpi = this.kpis.get(progressData.kpiId);
    if (kpi) {
      const updated: KPI = {
        ...kpi,
        currentValue: progressData.value,
        updatedAt: new Date(),
      };
      this.kpis.set(kpi.id, updated);
      
      // Check if we need to create alerts
      await this.checkKPIAlerts(progressData.kpiId);
    }
    
    return progress;
  }

  // KPI Alert methods
  async getKPIAlerts(kpiId?: string, activeOnly?: boolean): Promise<KPIAlert[]> {
    let alerts = Array.from(this.kpiAlerts.values());
    
    if (kpiId) {
      alerts = alerts.filter(alert => alert.kpiId === kpiId);
    }
    
    if (activeOnly) {
      alerts = alerts.filter(alert => alert.isActive);
    }
    
    return alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createKPIAlert(alertData: InsertKPIAlert): Promise<KPIAlert> {
    const id = randomUUID();
    const alert: KPIAlert = {
      id,
      kpiId: alertData.kpiId,
      alertType: alertData.alertType,
      severity: alertData.severity || "medium",
      message: alertData.message,
      currentValue: alertData.currentValue || null,
      targetValue: alertData.targetValue || null,
      thresholdValue: alertData.thresholdValue || null,
      isActive: alertData.isActive !== undefined ? alertData.isActive : true,
      acknowledgedAt: null,
      resolvedAt: null,
      emailSent: false,
      slackSent: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.kpiAlerts.set(id, alert);
    return alert;
  }

  async acknowledgeKPIAlert(alertId: string): Promise<boolean> {
    const alert = this.kpiAlerts.get(alertId);
    if (!alert) return false;
    
    const updated: KPIAlert = {
      ...alert,
      acknowledgedAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.kpiAlerts.set(alertId, updated);
    return true;
  }

  async resolveKPIAlert(alertId: string): Promise<boolean> {
    const alert = this.kpiAlerts.get(alertId);
    if (!alert) return false;
    
    const updated: KPIAlert = {
      ...alert,
      isActive: false,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.kpiAlerts.set(alertId, updated);
    return true;
  }

  async checkKPIAlerts(kpiId: string): Promise<KPIAlert[]> {
    const kpi = this.kpis.get(kpiId);
    if (!kpi || !kpi.alertsEnabled) return [];
    
    const alerts: KPIAlert[] = [];
    const currentValue = parseFloat(kpi.currentValue || "0");
    const targetValue = parseFloat(kpi.targetValue);
    
    // Check threshold breach
    if (kpi.alertThreshold) {
      const thresholdValue = parseFloat(kpi.alertThreshold);
      const thresholdPercentage = thresholdValue / 100;
      
      if (currentValue < targetValue * thresholdPercentage) {
        const alert = await this.createKPIAlert({
          kpiId: kpi.id,
          alertType: "threshold_breach",
          severity: kpi.priority === "critical" ? "critical" : "high",
          message: `${kpi.name} is ${thresholdValue}% below target (${currentValue} vs ${targetValue} ${kpi.unit})`,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
          thresholdValue: kpi.alertThreshold,
        });
        alerts.push(alert);
      }
    }
    
    // Check deadline approaching
    if (kpi.targetDate) {
      const daysUntilTarget = Math.ceil((new Date(kpi.targetDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysUntilTarget <= 7 && currentValue < targetValue) {
        const alert = await this.createKPIAlert({
          kpiId: kpi.id,
          alertType: "deadline_approaching",
          severity: "high",
          message: `${kpi.name} deadline is ${daysUntilTarget} days away and target not yet achieved`,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
        });
        alerts.push(alert);
      }
    }
    
    // Check negative trend
    const progress = await this.getKPIProgress(kpiId);
    if (progress.length >= 3) {
      const recentTrend = progress.slice(0, 3);
      const allDecreasing = recentTrend.every((p, i) => 
        i === 0 || parseFloat(p.value) < parseFloat(recentTrend[i - 1].value)
      );
      
      if (allDecreasing) {
        const alert = await this.createKPIAlert({
          kpiId: kpi.id,
          alertType: "trend_negative",
          severity: "medium",
          message: `${kpi.name} shows consistent downward trend over recent measurements`,
          currentValue: kpi.currentValue,
          targetValue: kpi.targetValue,
        });
        alerts.push(alert);
      }
    }
    
    return alerts;
  }

  private calculateRollingAverage(existingProgress: KPIProgress[], days: number, newValue: string): string {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Get progress records within the rolling window
    const recentProgress = existingProgress.filter(p => new Date(p.recordedAt) >= cutoffDate);
    
    // Add the new value
    const allValues = [...recentProgress.map(p => parseFloat(p.value)), parseFloat(newValue)];
    
    if (allValues.length === 0) return newValue;
    
    const average = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
    return average.toFixed(2);
  }

  private calculateTrendDirection(existingProgress: KPIProgress[], newValue: string): string {
    if (existingProgress.length === 0) return "neutral";
    
    const lastValue = parseFloat(existingProgress[0].value); // Most recent is first
    const currentValue = parseFloat(newValue);
    
    if (currentValue > lastValue) return "up";
    if (currentValue < lastValue) return "down";
    return "neutral";
  }

  // Add method to get KPI analytics with rolling averages
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

  // Notification methods
  async getNotifications(): Promise<Notification[]> {
    return Array.from(this.notifications_.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications_.get(id);
  }

  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      id,
      title: notificationData.title,
      message: notificationData.message,
      type: notificationData.type,
      campaignId: notificationData.campaignId || null,
      campaignName: notificationData.campaignName || null,
      read: notificationData.read || false,
      priority: notificationData.priority || "normal",
      createdAt: new Date(),
    };

    this.notifications_.set(id, notification);
    return notification;
  }

  async updateNotification(id: string, updateData: Partial<InsertNotification>): Promise<Notification | undefined> {
    const notification = this.notifications_.get(id);
    if (!notification) return undefined;

    const updated: Notification = {
      ...notification,
      ...updateData,
    };

    this.notifications_.set(id, updated);
    return updated;
  }

  async deleteNotification(id: string): Promise<boolean> {
    return this.notifications_.delete(id);
  }

  async markAllNotificationsAsRead(): Promise<boolean> {
    const notifications = Array.from(this.notifications_.values());
    notifications.forEach(notification => {
      if (!notification.read) {
        this.notifications_.set(notification.id, { ...notification, read: true });
      }
    });
    return true;
  }
}

export class DatabaseStorage implements IStorage {
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
    return db
      .insert(spendRecords)
      .values(records as any)
      .returning();
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

  // Revenue methods
  async getRevenueSources(campaignId: string, platformContext: 'ga4' | 'linkedin' = 'ga4'): Promise<RevenueSource[]> {
    const ctx = platformContext;
    return db.select().from(revenueSources)
      .where(and(
        eq(revenueSources.campaignId, campaignId),
        eq(revenueSources.isActive, true),
        ctx === 'ga4'
          ? or(eq(revenueSources.platformContext, 'ga4' as any), isNull(revenueSources.platformContext))
          : eq(revenueSources.platformContext, 'linkedin' as any)
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
    return db
      .insert(revenueRecords)
      .values(records as any)
      .returning();
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
        console.log('[Storage] sheet_name/purpose column not found, using fallback query');
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
        console.log('[Storage] sheet_name column not found, using fallback query for getGoogleSheetsConnection');
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
        console.log('[Storage] sheet_name column not found, using fallback query for getPrimaryGoogleSheetsConnection');
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
        console.log('[Storage] sheet_name/purpose column not found, using fallback insert for createGoogleSheetsConnection');
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
        console.log('[Storage] sheet_name column not found, using fallback update for updateGoogleSheetsConnection');
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
        console.log('[Storage] sheet_name column not found, using fallback query for deleteGoogleSheetsConnection');
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
    const events = await query;
    
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
      // Delete related progress records first
      const progressResult = await db.delete(kpiProgress).where(eq(kpiProgress.kpiId, id));
      
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
    for (const [key, model] of this.attributionModels.entries()) {
      if (model.isDefault) {
        const updated = { ...model, isDefault: false, updatedAt: new Date() };
        this.attributionModels.set(key, updated);
      }
    }
    
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
            credit = i === 0 ? posConfig.firstWeight + posConfig.middleWeight/2 : posConfig.lastWeight + posConfig.middleWeight/2;
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

    for (const [channel, channelResults] of channelGroups) {
      const totalAttributedValue = channelResults.reduce((sum, result) => 
        sum + parseFloat(result.attributedValue), 0);
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

    for (const [channel, channelResults] of channelGroups) {
      const totalAttributedValue = channelResults.reduce((sum, result) => 
        sum + parseFloat(result.attributedValue), 0);
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
      const journeyIds = [...new Set(channelResults.map(r => r.journeyId))];
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

const useMemStorage =
  process.env.USE_MEM_STORAGE === "true" ||
  (process.env.NODE_ENV === "development" && !process.env.DATABASE_URL);

export const storage = useMemStorage ? new MemStorage() : new DatabaseStorage();
