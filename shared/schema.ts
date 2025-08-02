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
  connectedAt: timestamp("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
