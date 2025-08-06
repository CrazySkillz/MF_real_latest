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
});

export const insertKPIProgressSchema = createInsertSchema(kpiProgress).pick({
  kpiId: true,
  value: true,
  rollingAverage7d: true,
  rollingAverage30d: true,
  trendDirection: true,
  notes: true,
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
