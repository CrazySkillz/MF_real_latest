import { type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type LinkedInConnection, type InsertLinkedInConnection, type LinkedInImportSession, type InsertLinkedInImportSession, type LinkedInImportMetric, type InsertLinkedInImportMetric, type LinkedInAdPerformance, type InsertLinkedInAdPerformance, type LinkedInReport, type InsertLinkedInReport, type CustomIntegration, type InsertCustomIntegration, type CustomIntegrationMetrics, type InsertCustomIntegrationMetrics, type KPI, type InsertKPI, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, type Benchmark, type InsertBenchmark, type BenchmarkHistory, type InsertBenchmarkHistory, type Notification, type InsertNotification, type ABTest, type InsertABTest, type ABTestVariant, type InsertABTestVariant, type ABTestResult, type InsertABTestResult, type ABTestEvent, type InsertABTestEvent, type AttributionModel, type InsertAttributionModel, type CustomerJourney, type InsertCustomerJourney, type Touchpoint, type InsertTouchpoint, type AttributionResult, type InsertAttributionResult, type AttributionInsight, type InsertAttributionInsight, campaigns, metrics, integrations, performanceData, ga4Connections, googleSheetsConnections, linkedinConnections, linkedinImportSessions, linkedinImportMetrics, linkedinAdPerformance, linkedinReports, customIntegrations, customIntegrationMetrics, kpis, kpiProgress, kpiAlerts, benchmarks, benchmarkHistory, notifications, abTests, abTestVariants, abTestResults, abTestEvents, attributionModels, customerJourneys, touchpoints, attributionResults, attributionInsights } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, isNull, desc } from "drizzle-orm";

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
  
  // Google Sheets Connections
  getGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined>;
  createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection>;
  updateGoogleSheetsConnection(campaignId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined>;
  deleteGoogleSheetsConnection(campaignId: string): Promise<boolean>;
  
  // LinkedIn Connections
  getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined>;
  createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection>;
  updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined>;
  deleteLinkedInConnection(campaignId: string): Promise<boolean>;
  
  // LinkedIn Import Sessions
  getLinkedInImportSession(sessionId: string): Promise<LinkedInImportSession | undefined>;
  getCampaignLinkedInImportSessions(campaignId: string): Promise<LinkedInImportSession[]>;
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
  getAllCustomIntegrations(): Promise<CustomIntegration[]>;
  createCustomIntegration(integration: InsertCustomIntegration): Promise<CustomIntegration>;
  deleteCustomIntegration(campaignId: string): Promise<boolean>;
  
  // Custom Integration Metrics
  getCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined>;
  createCustomIntegrationMetrics(metrics: InsertCustomIntegrationMetrics): Promise<CustomIntegrationMetrics>;
  getLatestCustomIntegrationMetrics(campaignId: string): Promise<CustomIntegrationMetrics | undefined>;
  
  // KPIs
  getCampaignKPIs(campaignId: string): Promise<KPI[]>;
  getPlatformKPIs(platformType: string, campaignId?: string): Promise<KPI[]>;
  getKPI(id: string): Promise<KPI | undefined>;
  createKPI(kpi: InsertKPI): Promise<KPI>;
  updateKPI(id: string, kpi: Partial<InsertKPI>): Promise<KPI | undefined>;
  deleteKPI(id: string): Promise<boolean>;
  
  // KPI Progress
  getKPIProgress(kpiId: string): Promise<KPIProgress[]>;
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
}

export class MemStorage implements IStorage {
  private campaigns: Map<string, Campaign>;
  private metrics: Map<string, Metric>;
  private integrations: Map<string, Integration>;
  private performanceData: Map<string, PerformanceData>;
  private ga4Connections: Map<string, GA4Connection>;
  private googleSheetsConnections: Map<string, GoogleSheetsConnection>;
  private linkedinConnections: Map<string, LinkedInConnection>;
  private linkedinImportSessions: Map<string, LinkedInImportSession>;
  private linkedinImportMetrics: Map<string, LinkedInImportMetric>;
  private linkedinAdPerformance: Map<string, LinkedInAdPerformance>;
  private linkedinReports: Map<string, LinkedInReport>;
  private customIntegrations: Map<string, CustomIntegration>;
  private customIntegrationMetrics: Map<string, CustomIntegrationMetrics>;
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
    this.googleSheetsConnections = new Map();
    this.linkedinConnections = new Map();
    this.linkedinImportSessions = new Map();
    this.linkedinImportMetrics = new Map();
    this.linkedinAdPerformance = new Map();
    this.linkedinReports = new Map();
    this.customIntegrations = new Map();
    this.customIntegrationMetrics = new Map();
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

  // Google Sheets Connection methods
  async getGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined> {
    return this.googleSheetsConnections.get(campaignId);
  }

  async createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection> {
    const id = randomUUID();
    const sheetsConnection: GoogleSheetsConnection = {
      id,
      campaignId: connection.campaignId,
      spreadsheetId: connection.spreadsheetId,
      spreadsheetName: connection.spreadsheetName || null,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.googleSheetsConnections.set(connection.campaignId, sheetsConnection);
    return sheetsConnection;
  }

  async updateGoogleSheetsConnection(campaignId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined> {
    const existing = this.googleSheetsConnections.get(campaignId);
    if (!existing) return undefined;
    
    const updated: GoogleSheetsConnection = {
      ...existing,
      ...connection,
    };
    
    this.googleSheetsConnections.set(campaignId, updated);
    return updated;
  }

  async deleteGoogleSheetsConnection(campaignId: string): Promise<boolean> {
    return this.googleSheetsConnections.delete(campaignId);
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

  // LinkedIn Import Session methods
  async getLinkedInImportSession(sessionId: string): Promise<LinkedInImportSession | undefined> {
    return this.linkedinImportSessions.get(sessionId);
  }

  async getCampaignLinkedInImportSessions(campaignId: string): Promise<LinkedInImportSession[]> {
    return Array.from(this.linkedinImportSessions.values())
      .filter(session => session.campaignId === campaignId)
      .sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
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
    return db.select().from(ga4Connections)
      .where(and(eq(ga4Connections.campaignId, campaignId), eq(ga4Connections.isActive, true)))
      .orderBy(ga4Connections.connectedAt);
  }

  async getGA4Connection(campaignId: string, propertyId?: string): Promise<GA4Connection | undefined> {
    if (propertyId) {
      const [connection] = await db.select().from(ga4Connections)
        .where(and(
          eq(ga4Connections.campaignId, campaignId),
          eq(ga4Connections.propertyId, propertyId),
          eq(ga4Connections.isActive, true)
        ));
      return connection || undefined;
    }
    
    // Return the primary connection if no propertyId specified
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));
    
    if (primary) return primary;
    
    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first || undefined;
  }

  async getPrimaryGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    const [primary] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isPrimary, true),
        eq(ga4Connections.isActive, true)
      ));
    
    if (primary) return primary;
    
    // If no primary, return the first active connection
    const [first] = await db.select().from(ga4Connections)
      .where(and(
        eq(ga4Connections.campaignId, campaignId),
        eq(ga4Connections.isActive, true)
      ))
      .orderBy(ga4Connections.connectedAt)
      .limit(1);
    return first || undefined;
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    // Check if this is the first connection for this campaign
    const existingConnections = await this.getGA4Connections(connection.campaignId);
    const isFirstConnection = existingConnections.length === 0;
    
    const connectionData = {
      ...connection,
      isPrimary: connection.isPrimary !== undefined ? connection.isPrimary : isFirstConnection,
      isActive: connection.isActive !== undefined ? connection.isActive : true,
      displayName: connection.displayName || connection.propertyName || null,
    };
    
    const [ga4Connection] = await db
      .insert(ga4Connections)
      .values(connectionData)
      .returning();
    return ga4Connection;
  }

  async updateGA4Connection(connectionId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const [updated] = await db
      .update(ga4Connections)
      .set(connection)
      .where(eq(ga4Connections.id, connectionId))
      .returning();
    return updated || undefined;
  }

  async updateGA4ConnectionTokens(connectionId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined> {
    const [updated] = await db
      .update(ga4Connections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      })
      .where(eq(ga4Connections.id, connectionId))
      .returning();
    return updated || undefined;
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

  // Google Sheets Connection methods
  async getGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined> {
    const [connection] = await db.select().from(googleSheetsConnections).where(eq(googleSheetsConnections.campaignId, campaignId));
    return connection || undefined;
  }

  async createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection> {
    const [sheetsConnection] = await db
      .insert(googleSheetsConnections)
      .values(connection)
      .returning();
    return sheetsConnection;
  }

  async updateGoogleSheetsConnection(campaignId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined> {
    const [updated] = await db
      .update(googleSheetsConnections)
      .set(connection)
      .where(eq(googleSheetsConnections.campaignId, campaignId))
      .returning();
    return updated || undefined;
  }

  async deleteGoogleSheetsConnection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(googleSheetsConnections)
      .where(eq(googleSheetsConnections.campaignId, campaignId));
    return (result.rowCount || 0) > 0;
  }

  // LinkedIn Connection methods
  async getLinkedInConnection(campaignId: string): Promise<LinkedInConnection | undefined> {
    const [connection] = await db.select().from(linkedinConnections).where(eq(linkedinConnections.campaignId, campaignId));
    return connection || undefined;
  }

  async createLinkedInConnection(connection: InsertLinkedInConnection): Promise<LinkedInConnection> {
    const [linkedinConnection] = await db
      .insert(linkedinConnections)
      .values(connection)
      .returning();
    return linkedinConnection;
  }

  async updateLinkedInConnection(campaignId: string, connection: Partial<InsertLinkedInConnection>): Promise<LinkedInConnection | undefined> {
    const [updated] = await db
      .update(linkedinConnections)
      .set(connection)
      .where(eq(linkedinConnections.campaignId, campaignId))
      .returning();
    return updated || undefined;
  }

  async deleteLinkedInConnection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(linkedinConnections)
      .where(eq(linkedinConnections.campaignId, campaignId));
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
      .orderBy(linkedinImportSessions.importedAt);
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
    console.log(`=== DatabaseStorage.deleteKPI called with ID: ${id} ===`);
    
    try {
      // Delete related progress records first
      console.log(`Deleting KPI progress records for KPI: ${id}`);
      const progressResult = await db.delete(kpiProgress).where(eq(kpiProgress.kpiId, id));
      console.log(`Deleted ${progressResult.rowCount || 0} progress records`);
      
      // Delete the KPI itself
      console.log(`Deleting KPI with ID: ${id}`);
      const result = await db
        .delete(kpis)
        .where(eq(kpis.id, id));
      
      const deleted = (result.rowCount || 0) > 0;
      console.log(`KPI deletion result - rowCount: ${result.rowCount}, deleted: ${deleted}`);
      
      return deleted;
    } catch (error) {
      console.error(`Error in DatabaseStorage.deleteKPI:`, error);
      throw error;
    }
  }

  async getKPIProgress(kpiId: string): Promise<KPIProgress[]> {
    return db.select().from(kpiProgress).where(eq(kpiProgress.kpiId, kpiId));
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
    return db.select().from(benchmarks)
      .where(eq(benchmarks.campaignId, campaignId))
      .orderBy(benchmarks.category, benchmarks.name);
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

export const storage = new DatabaseStorage();
