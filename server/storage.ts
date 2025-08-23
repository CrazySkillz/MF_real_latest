import { type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type KPI, type InsertKPI, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, type Benchmark, type InsertBenchmark, type BenchmarkHistory, type InsertBenchmarkHistory, type Notification, type InsertNotification, type ABTest, type InsertABTest, type ABTestVariant, type InsertABTestVariant, type ABTestResult, type InsertABTestResult, type ABTestEvent, type InsertABTestEvent, campaigns, metrics, integrations, performanceData, ga4Connections, googleSheetsConnections, kpis, kpiProgress, kpiAlerts, benchmarks, benchmarkHistory, notifications, abTests, abTestVariants, abTestResults, abTestEvents } from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, isNull } from "drizzle-orm";

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
  getGA4Connection(campaignId: string): Promise<GA4Connection | undefined>;
  createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection>;
  updateGA4Connection(campaignId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined>;
  updateGA4ConnectionTokens(campaignId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined>;
  deleteGA4Connection(campaignId: string): Promise<boolean>;
  
  // Google Sheets Connections
  getGoogleSheetsConnection(campaignId: string): Promise<GoogleSheetsConnection | undefined>;
  createGoogleSheetsConnection(connection: InsertGoogleSheetsConnection): Promise<GoogleSheetsConnection>;
  updateGoogleSheetsConnection(campaignId: string, connection: Partial<InsertGoogleSheetsConnection>): Promise<GoogleSheetsConnection | undefined>;
  deleteGoogleSheetsConnection(campaignId: string): Promise<boolean>;
  
  // KPIs
  getCampaignKPIs(campaignId: string): Promise<KPI[]>;
  getPlatformKPIs(platformType: string): Promise<KPI[]>;
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
  getPlatformBenchmarks(platformType: string): Promise<Benchmark[]>;
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
}

export class MemStorage implements IStorage {
  private campaigns: Map<string, Campaign>;
  private metrics: Map<string, Metric>;
  private integrations: Map<string, Integration>;
  private performanceData: Map<string, PerformanceData>;
  private ga4Connections: Map<string, GA4Connection>;
  private googleSheetsConnections: Map<string, GoogleSheetsConnection>;
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

  constructor() {
    this.campaigns = new Map();
    this.metrics = new Map();
    this.integrations = new Map();
    this.performanceData = new Map();
    this.ga4Connections = new Map();
    this.googleSheetsConnections = new Map();
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
  async getGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    return this.ga4Connections.get(campaignId);
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    const id = randomUUID();
    const ga4Connection: GA4Connection = {
      id,
      campaignId: connection.campaignId,
      propertyId: connection.propertyId,
      accessToken: connection.accessToken || null,
      refreshToken: connection.refreshToken || null,
      serviceAccountKey: connection.serviceAccountKey || null,
      method: connection.method,
      propertyName: connection.propertyName || null,
      clientId: connection.clientId || null,
      clientSecret: connection.clientSecret || null,
      expiresAt: connection.expiresAt || null,
      connectedAt: new Date(),
      createdAt: new Date(),
    };
    
    this.ga4Connections.set(connection.campaignId, ga4Connection);
    return ga4Connection;
  }

  async updateGA4Connection(campaignId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const existing = this.ga4Connections.get(campaignId);
    if (!existing) return undefined;
    
    const updated: GA4Connection = {
      ...existing,
      ...connection,
    };
    
    this.ga4Connections.set(campaignId, updated);
    return updated;
  }

  async updateGA4ConnectionTokens(campaignId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined> {
    const existing = this.ga4Connections.get(campaignId);
    if (!existing) return undefined;
    
    const updated: GA4Connection = {
      ...existing,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || existing.refreshToken,
      expiresAt: tokens.expiresAt || existing.expiresAt,
    };
    
    this.ga4Connections.set(campaignId, updated);
    return updated;
  }

  async deleteGA4Connection(campaignId: string): Promise<boolean> {
    return this.ga4Connections.delete(campaignId);
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

  // KPI methods
  async getCampaignKPIs(campaignId: string): Promise<KPI[]> {
    return Array.from(this.kpis.values()).filter(kpi => kpi.campaignId === campaignId);
  }

  async getPlatformKPIs(platformType: string): Promise<KPI[]> {
    return Array.from(this.kpis.values()).filter(kpi => kpi.platformType === platformType && !kpi.campaignId);
  }

  async getKPI(id: string): Promise<KPI | undefined> {
    return this.kpis.get(id);
  }

  async createKPI(kpiData: InsertKPI): Promise<KPI> {
    const id = randomUUID();
    const kpi: KPI = {
      id,
      campaignId: kpiData.campaignId || null,
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
  async getGA4Connection(campaignId: string): Promise<GA4Connection | undefined> {
    const [connection] = await db.select().from(ga4Connections).where(eq(ga4Connections.campaignId, campaignId));
    return connection || undefined;
  }

  async createGA4Connection(connection: InsertGA4Connection): Promise<GA4Connection> {
    const [ga4Connection] = await db
      .insert(ga4Connections)
      .values(connection)
      .returning();
    return ga4Connection;
  }

  async updateGA4Connection(campaignId: string, connection: Partial<InsertGA4Connection>): Promise<GA4Connection | undefined> {
    const [updated] = await db
      .update(ga4Connections)
      .set(connection)
      .where(eq(ga4Connections.campaignId, campaignId))
      .returning();
    return updated || undefined;
  }

  async updateGA4ConnectionTokens(campaignId: string, tokens: { accessToken: string; refreshToken?: string; expiresAt?: Date }): Promise<GA4Connection | undefined> {
    const [updated] = await db
      .update(ga4Connections)
      .set({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresAt,
      })
      .where(eq(ga4Connections.campaignId, campaignId))
      .returning();
    return updated || undefined;
  }

  async deleteGA4Connection(campaignId: string): Promise<boolean> {
    const result = await db
      .delete(ga4Connections)
      .where(eq(ga4Connections.campaignId, campaignId));
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

  // KPI methods
  async getCampaignKPIs(campaignId: string): Promise<KPI[]> {
    return db.select().from(kpis).where(eq(kpis.campaignId, campaignId));
  }

  async getPlatformKPIs(platformType: string): Promise<KPI[]> {
    return db.select().from(kpis).where(and(eq(kpis.platformType, platformType), isNull(kpis.campaignId)));
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

  async getPlatformBenchmarks(platformType: string): Promise<Benchmark[]> {
    return db.select().from(benchmarks)
      .where(and(eq(benchmarks.platformType, platformType), isNull(benchmarks.campaignId)))
      .orderBy(benchmarks.category, benchmarks.name);
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
}

export const storage = new DatabaseStorage();
