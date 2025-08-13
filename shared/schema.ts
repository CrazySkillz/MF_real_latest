import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  clientWebsite: text("client_website"),
  label: text("label"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  type: text("type"),
  platform: text("platform"),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: decimal("spend", { precision: 10, scale: 2 }).notNull().default("0"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const metrics = pgTable("metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  value: text("value").notNull(),
  change: text("change").notNull(),
  icon: text("icon").notNull(),
  date: timestamp("date").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const integrations = pgTable("integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  platform: text("platform").notNull(),
  name: text("name").notNull(),
  connected: boolean("connected").notNull().default(false),
  credentials: text("credentials"), // JSON string for storing credentials
  lastSync: timestamp("last_sync"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const performanceData = pgTable("performance_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(),
  impressions: integer("impressions").notNull(),
  clicks: integer("clicks").notNull(),
  conversions: integer("conversions").notNull(),
});

export const ga4Connections = pgTable("ga4_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  propertyId: text("property_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  serviceAccountKey: text("service_account_key"), // JSON string
  method: text("method").notNull(), // 'access_token' or 'service_account'
  propertyName: text("property_name"),
  clientId: text("client_id"), // OAuth client ID for automatic refresh
  clientSecret: text("client_secret"), // OAuth client secret for automatic refresh  
  expiresAt: timestamp("expires_at"), // Token expiration time
  connectedAt: timestamp("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // 'info', 'warning', 'error', 'success'
  campaignId: text("campaign_id"), // Optional - for campaign-specific notifications
  campaignName: text("campaign_name"), // Denormalized for faster filtering
  read: boolean("read").notNull().default(false),
  priority: text("priority").notNull().default("normal"), // 'low', 'normal', 'high', 'urgent'
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const googleSheetsConnections = pgTable("google_sheets_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  spreadsheetId: text("spreadsheet_id").notNull(),
  spreadsheetName: text("spreadsheet_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  expiresAt: timestamp("expires_at"),
  connectedAt: timestamp("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const kpis = pgTable("kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id"), // Optional - null for platform-level KPIs
  platformType: text("platform_type"), // 'google_analytics', 'google_sheets', 'facebook', 'linkedin', etc.
  name: text("name").notNull(), // 'ROI', 'LTV', 'CAC', 'CTR', 'CPA', 'ROAS'
  targetValue: decimal("target_value", { precision: 10, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }).default("0"),
  unit: text("unit").notNull(), // '%', '$', 'ratio', etc.
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  status: text("status").notNull().default("tracking"), // 'tracking', 'achieved', 'at_risk', 'critical'
  timeframe: text("timeframe").notNull().default("monthly"), // 'daily', 'weekly', 'monthly', 'quarterly'
  trackingPeriod: integer("tracking_period").notNull().default(30), // Number of days to track
  rollingAverage: text("rolling_average").notNull().default("7day"), // '1day', '7day', '30day', 'none'
  targetDate: timestamp("target_date"), // Optional target completion date
  // Alert and notification settings
  alertThreshold: decimal("alert_threshold", { precision: 10, scale: 2 }), // Percentage below target to trigger alert (e.g., 80 = alert when 80% below target)
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  slackNotifications: boolean("slack_notifications").notNull().default(false),
  alertFrequency: text("alert_frequency").notNull().default("daily"), // 'immediate', 'daily', 'weekly'
  lastAlertSent: timestamp("last_alert_sent"),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const kpiProgress = pgTable("kpi_progress", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kpiId: text("kpi_id").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  rollingAverage7d: decimal("rolling_average_7d", { precision: 10, scale: 2 }), // 7-day rolling average
  rollingAverage30d: decimal("rolling_average_30d", { precision: 10, scale: 2 }), // 30-day rolling average
  trendDirection: text("trend_direction").default("neutral"), // 'up', 'down', 'neutral'
  recordedAt: timestamp("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
});

export const kpiAlerts = pgTable("kpi_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kpiId: text("kpi_id").notNull(),
  alertType: text("alert_type").notNull(), // 'threshold_breach', 'target_missed', 'trend_negative', 'deadline_approaching'
  severity: text("severity").notNull().default("medium"), // 'low', 'medium', 'high', 'critical'
  message: text("message").notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }),
  targetValue: decimal("target_value", { precision: 10, scale: 2 }),
  thresholdValue: decimal("threshold_value", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  acknowledgedAt: timestamp("acknowledged_at"),
  resolvedAt: timestamp("resolved_at"),
  emailSent: boolean("email_sent").notNull().default(false),
  slackSent: boolean("slack_sent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const benchmarks = pgTable("benchmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id"), // Optional - null for platform-level benchmarks
  platformType: text("platform_type").notNull(), // 'google_analytics', 'google_sheets', 'facebook', 'linkedin', etc.
  category: text("category").notNull(), // 'engagement', 'conversion', 'traffic', 'revenue', 'performance'
  name: text("name").notNull(), // 'Industry Average CTR', 'Competitor Conversion Rate', etc.
  description: text("description"),
  benchmarkValue: decimal("benchmark_value", { precision: 10, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }).default("0"),
  unit: text("unit").notNull(), // '%', '$', 'ratio', 'count', etc.
  benchmarkType: text("benchmark_type").notNull().default("industry"), // 'industry', 'competitor', 'historical', 'goal'
  source: text("source"), // 'Google Analytics Benchmarks', 'Facebook Industry Reports', 'Internal Historical Data'
  industry: text("industry"), // 'E-commerce', 'SaaS', 'Healthcare', etc.
  geoLocation: text("geo_location"), // 'Global', 'US', 'Europe', etc.
  period: text("period").notNull().default("monthly"), // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  status: text("status").notNull().default("active"), // 'active', 'archived', 'draft'
  variance: decimal("variance", { precision: 10, scale: 2 }), // % difference from benchmark (positive = above benchmark)
  confidenceLevel: text("confidence_level").default("medium"), // 'low', 'medium', 'high'
  lastUpdated: timestamp("last_updated").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const benchmarkHistory = pgTable("benchmark_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  benchmarkId: text("benchmark_id").notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }).notNull(),
  benchmarkValue: decimal("benchmark_value", { precision: 10, scale: 2 }).notNull(),
  variance: decimal("variance", { precision: 10, scale: 2 }).notNull(),
  performanceRating: text("performance_rating").notNull().default("average"), // 'excellent', 'good', 'average', 'below_average', 'poor'
  recordedAt: timestamp("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  notes: text("notes"),
});

export const insertCampaignSchema = createInsertSchema(campaigns).pick({
  name: true,
  clientWebsite: true,
  label: true,
  budget: true,
  type: true,
  platform: true,
  impressions: true,
  clicks: true,
  spend: true,
  status: true,
});

export const insertMetricSchema = createInsertSchema(metrics).pick({
  name: true,
  value: true,
  change: true,
  icon: true,
});

export const insertIntegrationSchema = createInsertSchema(integrations).pick({
  platform: true,
  name: true,
  connected: true,
  credentials: true,
});

export const insertPerformanceDataSchema = createInsertSchema(performanceData).pick({
  date: true,
  impressions: true,
  clicks: true,
  conversions: true,
});

export const insertGA4ConnectionSchema = createInsertSchema(ga4Connections).pick({
  campaignId: true,
  propertyId: true,
  accessToken: true,
  refreshToken: true,
  serviceAccountKey: true,
  method: true,
  propertyName: true,
  clientId: true,
  clientSecret: true,
  expiresAt: true,
});

export const insertGoogleSheetsConnectionSchema = createInsertSchema(googleSheetsConnections).pick({
  campaignId: true,
  spreadsheetId: true,
  spreadsheetName: true,
  accessToken: true,
  refreshToken: true,
  clientId: true,
  clientSecret: true,
  expiresAt: true,
});

export const insertKPISchema = createInsertSchema(kpis).pick({
  campaignId: true,
  platformType: true,
  name: true,
  targetValue: true,
  currentValue: true,
  unit: true,
  description: true,
  priority: true,
  status: true,
  timeframe: true,
  trackingPeriod: true,
  rollingAverage: true,
  targetDate: true,
  alertThreshold: true,
  alertsEnabled: true,
  emailNotifications: true,
  slackNotifications: true,
  alertFrequency: true,
});

export const insertKPIProgressSchema = createInsertSchema(kpiProgress).pick({
  kpiId: true,
  value: true,
  rollingAverage7d: true,
  rollingAverage30d: true,
  trendDirection: true,
  notes: true,
});

export const insertKPIAlertSchema = createInsertSchema(kpiAlerts).pick({
  kpiId: true,
  alertType: true,
  severity: true,
  message: true,
  currentValue: true,
  targetValue: true,
  thresholdValue: true,
  isActive: true,
});

export const insertBenchmarkSchema = createInsertSchema(benchmarks).pick({
  campaignId: true,
  platformType: true,
  category: true,
  name: true,
  description: true,
  benchmarkValue: true,
  currentValue: true,
  unit: true,
  benchmarkType: true,
  source: true,
  industry: true,
  geoLocation: true,
  period: true,
  status: true,
  variance: true,
  confidenceLevel: true,
});

export const insertBenchmarkHistorySchema = createInsertSchema(benchmarkHistory).pick({
  benchmarkId: true,
  currentValue: true,
  benchmarkValue: true,
  variance: true,
  performanceRating: true,
  notes: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  title: true,
  message: true,
  type: true,
  campaignId: true,
  campaignName: true,
  read: true,
  priority: true,
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Metric = typeof metrics.$inferSelect;
export type InsertMetric = z.infer<typeof insertMetricSchema>;
export type Integration = typeof integrations.$inferSelect;
export type InsertIntegration = z.infer<typeof insertIntegrationSchema>;
export type PerformanceData = typeof performanceData.$inferSelect;
export type InsertPerformanceData = z.infer<typeof insertPerformanceDataSchema>;
export type GA4Connection = typeof ga4Connections.$inferSelect;
export type InsertGA4Connection = z.infer<typeof insertGA4ConnectionSchema>;
export type GoogleSheetsConnection = typeof googleSheetsConnections.$inferSelect;
export type InsertGoogleSheetsConnection = z.infer<typeof insertGoogleSheetsConnectionSchema>;
export type KPI = typeof kpis.$inferSelect;
export type InsertKPI = z.infer<typeof insertKPISchema>;
export type KPIProgress = typeof kpiProgress.$inferSelect;
export type InsertKPIProgress = z.infer<typeof insertKPIProgressSchema>;
export type KPIAlert = typeof kpiAlerts.$inferSelect;
export type InsertKPIAlert = z.infer<typeof insertKPIAlertSchema>;
export type Benchmark = typeof benchmarks.$inferSelect;
export type InsertBenchmark = z.infer<typeof insertBenchmarkSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type BenchmarkHistory = typeof benchmarkHistory.$inferSelect;
export type InsertBenchmarkHistory = z.infer<typeof insertBenchmarkHistorySchema>;
