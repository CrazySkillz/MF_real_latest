import { type Campaign, type InsertCampaign, type Metric, type InsertMetric, type Integration, type InsertIntegration, type PerformanceData, type InsertPerformanceData, type GA4Connection, type InsertGA4Connection, type GoogleSheetsConnection, type InsertGoogleSheetsConnection, type KPI, type InsertKPI, type KPIProgress, type InsertKPIProgress, type KPIAlert, type InsertKPIAlert, campaigns, metrics, integrations, performanceData, ga4Connections, googleSheetsConnections, kpis, kpiProgress, kpiAlerts } from "@shared/schema";
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
    
    // Initialize with empty data - no mock data
    this.initializeEmptyData();
  }

  private initializeEmptyData() {
    // Create empty state indicators if needed
    // No mock data as per guidelines
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
    // Delete related progress records first
    await db.delete(kpiProgress).where(eq(kpiProgress.kpiId, id));
    
    const result = await db
      .delete(kpis)
      .where(eq(kpis.id, id));
    return (result.rowCount || 0) > 0;
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
}

export const storage = new DatabaseStorage();
