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
  websiteUrl: text("website_url"), // Display URL for this property
  displayName: text("display_name"), // Custom name for this property
  isPrimary: boolean("is_primary").notNull().default(false), // Primary property for this campaign
  isActive: boolean("is_active").notNull().default(true), // Whether this connection is active
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

export const linkedinConnections = pgTable("linkedin_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  adAccountId: text("ad_account_id").notNull(),
  adAccountName: text("ad_account_name"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  method: text("method").notNull(), // 'oauth' or 'manual_token'
  expiresAt: timestamp("expires_at"),
  connectedAt: timestamp("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const linkedinImportSessions = pgTable("linkedin_import_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  adAccountId: text("ad_account_id").notNull(),
  adAccountName: text("ad_account_name"),
  selectedCampaignsCount: integer("selected_campaigns_count").notNull().default(0),
  selectedMetricsCount: integer("selected_metrics_count").notNull().default(0),
  selectedMetricKeys: text("selected_metric_keys").array(),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  importedAt: timestamp("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const linkedinImportMetrics = pgTable("linkedin_import_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  campaignUrn: text("campaign_urn").notNull(), // LinkedIn campaign URN
  campaignName: text("campaign_name").notNull(),
  campaignStatus: text("campaign_status").notNull().default("active"),
  metricKey: text("metric_key").notNull(), // 'impressions', 'clicks', 'spend', etc.
  metricValue: decimal("metric_value", { precision: 15, scale: 2 }).notNull(),
  importedAt: timestamp("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const linkedinAdPerformance = pgTable("linkedin_ad_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: text("session_id").notNull(),
  adId: text("ad_id").notNull(), // LinkedIn ad/creative ID
  adName: text("ad_name").notNull(),
  campaignUrn: text("campaign_urn").notNull(),
  campaignName: text("campaign_name").notNull(),
  campaignSelectedMetrics: text("campaign_selected_metrics").array(), // Metrics selected for this ad's campaign
  // Core Metrics (9 LinkedIn core metrics)
  impressions: integer("impressions").notNull().default(0),
  reach: integer("reach").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  engagements: integer("engagements").notNull().default(0),
  spend: decimal("spend", { precision: 10, scale: 2 }).notNull().default("0"),
  conversions: integer("conversions").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  videoViews: integer("video_views").notNull().default(0),
  viralImpressions: integer("viral_impressions").notNull().default(0),
  // Derived Metrics (9 derived metrics)
  ctr: decimal("ctr", { precision: 5, scale: 2 }).notNull().default("0"), // Click-through rate
  cpc: decimal("cpc", { precision: 10, scale: 2 }).notNull().default("0"), // Cost per click
  cpm: decimal("cpm", { precision: 10, scale: 2 }).notNull().default("0"), // Cost per mille (1000 impressions)
  cvr: decimal("cvr", { precision: 5, scale: 2 }).notNull().default("0"), // Conversion rate
  cpa: decimal("cpa", { precision: 10, scale: 2 }).notNull().default("0"), // Cost per acquisition
  cpl: decimal("cpl", { precision: 10, scale: 2 }).notNull().default("0"), // Cost per lead
  er: decimal("er", { precision: 5, scale: 2 }).notNull().default("0"), // Engagement rate
  roi: decimal("roi", { precision: 10, scale: 2 }).notNull().default("0"), // Return on investment
  roas: decimal("roas", { precision: 10, scale: 2 }).notNull().default("0"), // Return on ad spend
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).notNull().default("0"), // Legacy field, same as cvr
  importedAt: timestamp("imported_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customIntegrations = pgTable("custom_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  email: text("email").notNull(),
  webhookToken: text("webhook_token").notNull(),
  allowedEmailAddresses: text("allowed_email_addresses").array(), // Email whitelist for security
  connectedAt: timestamp("connected_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customIntegrationMetrics = pgTable("custom_integration_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  
  // Legacy Social Media Metrics (kept for backward compatibility)
  impressions: integer("impressions").default(0),
  reach: integer("reach").default(0),
  clicks: integer("clicks").default(0),
  engagements: integer("engagements").default(0),
  spend: decimal("spend", { precision: 10, scale: 2 }).default("0"),
  conversions: integer("conversions").default(0),
  leads: integer("leads").default(0),
  videoViews: integer("video_views").default(0),
  viralImpressions: integer("viral_impressions").default(0),
  
  // Audience & Traffic Metrics (GA4 style)
  users: integer("users").default(0), // Unique browsers/devices
  sessions: integer("sessions").default(0), // Total sessions
  pageviews: integer("pageviews").default(0), // All pageviews
  avgSessionDuration: text("avg_session_duration"), // Format: "00:02:38"
  pagesPerSession: decimal("pages_per_session", { precision: 5, scale: 2 }).default("0"), // e.g., 2.05
  bounceRate: decimal("bounce_rate", { precision: 5, scale: 2 }).default("0"), // Percentage
  
  // Traffic Sources (by channel, stored as percentages)
  organicSearchShare: decimal("organic_search_share", { precision: 5, scale: 2 }).default("0"), // e.g., 39.00
  directBrandedShare: decimal("direct_branded_share", { precision: 5, scale: 2 }).default("0"), // e.g., 26.00
  emailShare: decimal("email_share", { precision: 5, scale: 2 }).default("0"), // e.g., 14.00
  referralShare: decimal("referral_share", { precision: 5, scale: 2 }).default("0"), // e.g., 11.00
  paidShare: decimal("paid_share", { precision: 5, scale: 2 }).default("0"), // e.g., 7.00
  socialShare: decimal("social_share", { precision: 5, scale: 2 }).default("0"), // e.g., 3.00
  
  // Email & Newsletter Performance Metrics
  emailsDelivered: integer("emails_delivered").default(0),
  openRate: decimal("open_rate", { precision: 5, scale: 2 }).default("0"), // Percentage
  clickThroughRate: decimal("click_through_rate", { precision: 5, scale: 2 }).default("0"), // CTR percentage
  clickToOpenRate: decimal("click_to_open_rate", { precision: 5, scale: 2 }).default("0"), // CTOR percentage
  hardBounces: decimal("hard_bounces", { precision: 5, scale: 2 }).default("0"), // Percentage
  spamComplaints: decimal("spam_complaints", { precision: 5, scale: 2 }).default("0"), // Percentage
  listGrowth: integer("list_growth").default(0), // Net new subscribers
  
  // Metadata
  pdfFileName: text("pdf_file_name"),
  emailSubject: text("email_subject"),
  emailId: text("email_id"), // To track which email was processed
  uploadedAt: timestamp("uploaded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const kpis = pgTable("kpis", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id"), // Optional - null for platform-level KPIs
  platformType: text("platform_type"), // 'google_analytics', 'google_sheets', 'facebook', 'linkedin', etc.
  category: text("category").notNull().default("performance"), // 'engagement', 'conversion', 'traffic', 'revenue', 'performance'
  name: text("name").notNull(), // 'ROI', 'LTV', 'CAC', 'CTR', 'CPA', 'ROAS'
  metric: text("metric"), // Metric source: 'users', 'sessions', 'pageviews', 'bounceRate', etc.
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
  alertCondition: text("alert_condition").default("below"), // 'below', 'above', 'equals'
  alertsEnabled: boolean("alerts_enabled").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  emailRecipients: text("email_recipients"), // Comma-separated email addresses
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
  metric: text("metric"), // Metric source: 'users', 'sessions', 'pageviews', 'bounceRate', etc.
  description: text("description"),
  benchmarkValue: decimal("benchmark_value", { precision: 10, scale: 2 }).notNull(),
  currentValue: decimal("current_value", { precision: 10, scale: 2 }).default("0"),
  unit: text("unit").notNull(), // '%', '$', 'ratio', 'count', etc.
  benchmarkType: text("benchmark_type").notNull().default("industry"), // 'industry', 'competitor', 'historical', 'goal'
  competitorName: text("competitor_name"), // Name of competitor (when benchmarkType is 'competitor')
  source: text("source"), // 'Google Analytics Benchmarks', 'Facebook Industry Reports', 'Internal Historical Data'
  industry: text("industry"), // 'E-commerce', 'SaaS', 'Healthcare', etc.
  geoLocation: text("geo_location"), // 'Global', 'US', 'Europe', etc.
  period: text("period").notNull().default("monthly"), // 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'
  status: text("status").notNull().default("active"), // 'active', 'archived', 'draft'
  variance: decimal("variance", { precision: 10, scale: 2 }), // % difference from benchmark (positive = above benchmark)
  confidenceLevel: text("confidence_level").default("medium"), // 'low', 'medium', 'high'
  // Alert and notification settings
  alertThreshold: decimal("alert_threshold", { precision: 10, scale: 2 }), // Threshold value to trigger alert
  alertCondition: text("alert_condition").default("below"), // 'below', 'above', 'equals'
  alertsEnabled: boolean("alerts_enabled").notNull().default(false),
  emailNotifications: boolean("email_notifications").notNull().default(false),
  emailRecipients: text("email_recipients"), // Comma-separated email addresses
  alertFrequency: text("alert_frequency").notNull().default("daily"), // 'immediate', 'daily', 'weekly'
  lastAlertSent: timestamp("last_alert_sent"),
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

export const abTests = pgTable("ab_tests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  hypothesis: text("hypothesis"), // What we're testing and expected outcome
  objective: text("objective").notNull(), // 'conversions', 'clicks', 'engagement', 'revenue'
  trafficSplit: decimal("traffic_split", { precision: 5, scale: 2 }).notNull().default("50.00"), // Percentage for variant A (rest goes to B)
  status: text("status").notNull().default("draft"), // 'draft', 'active', 'paused', 'completed', 'archived'
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  minSampleSize: integer("min_sample_size").default(100), // Minimum samples needed for significance
  confidenceLevel: decimal("confidence_level", { precision: 3, scale: 2 }).default("95.00"), // Statistical confidence level
  significance: boolean("significance").default(false), // Whether results are statistically significant
  winnerVariant: text("winner_variant"), // 'A', 'B', or null if no clear winner
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const abTestVariants = pgTable("ab_test_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: text("test_id").notNull(),
  name: text("name").notNull(), // 'A', 'B', 'C', etc.
  description: text("description"),
  content: text("content"), // JSON string containing variant configuration
  trafficPercentage: decimal("traffic_percentage", { precision: 5, scale: 2 }).notNull(), // Actual percentage of traffic
  isControl: boolean("is_control").notNull().default(false), // Whether this is the control variant
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const abTestResults = pgTable("ab_test_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: text("test_id").notNull(),
  variantId: text("variant_id").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).notNull().default("0.00"),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0.00"), // Calculated percentage
  clickThroughRate: decimal("click_through_rate", { precision: 5, scale: 2 }).default("0.00"), // CTR percentage
  revenuePerVisitor: decimal("revenue_per_visitor", { precision: 10, scale: 2 }).default("0.00"),
  costPerConversion: decimal("cost_per_conversion", { precision: 10, scale: 2 }).default("0.00"),
  recordedAt: timestamp("recorded_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const abTestEvents = pgTable("ab_test_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  testId: text("test_id").notNull(),
  variantId: text("variant_id").notNull(),
  eventType: text("event_type").notNull(), // 'impression', 'click', 'conversion', 'custom'
  eventValue: decimal("event_value", { precision: 10, scale: 2 }), // Revenue or custom metric value
  userId: text("user_id"), // Optional user identifier for tracking
  sessionId: text("session_id"), // Session identifier
  metadata: text("metadata"), // JSON string for additional event data
  occurredAt: timestamp("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// Attribution Models and Touchpoint Tracking
export const attributionModels = pgTable("attribution_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // 'First Touch', 'Last Touch', 'Linear', 'Time Decay', 'Position Based', 'Data Driven'
  type: text("type").notNull(), // 'first_touch', 'last_touch', 'linear', 'time_decay', 'position_based', 'data_driven'
  description: text("description"),
  configuration: text("configuration"), // JSON string for model-specific settings
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const customerJourneys = pgTable("customer_journeys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customerId: text("customer_id").notNull(), // External customer identifier
  sessionId: text("session_id"), // Browser session ID
  deviceId: text("device_id"), // Device fingerprint
  userId: text("user_id"), // Authenticated user ID (optional)
  journeyStart: timestamp("journey_start").notNull(),
  journeyEnd: timestamp("journey_end"),
  totalTouchpoints: integer("total_touchpoints").notNull().default(0),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 2 }),
  conversionType: text("conversion_type"), // 'purchase', 'lead', 'signup', 'custom'
  status: text("status").notNull().default("active"), // 'active', 'converted', 'abandoned'
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const touchpoints = pgTable("touchpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journeyId: text("journey_id").notNull(),
  campaignId: text("campaign_id"), // Optional campaign association
  channel: text("channel").notNull(), // 'google_ads', 'facebook', 'linkedin', 'email', 'organic', 'direct'
  platform: text("platform"), // 'google', 'facebook', 'linkedin', 'twitter', etc.
  medium: text("medium"), // 'cpc', 'email', 'social', 'organic', 'referral'
  source: text("source"), // 'google', 'newsletter', 'facebook.com'
  campaign: text("campaign"), // Campaign name/id from source platform
  content: text("content"), // Ad content identifier
  term: text("term"), // Search keywords
  touchpointType: text("touchpoint_type").notNull(), // 'impression', 'click', 'view', 'engagement'
  position: integer("position").notNull(), // Order in the customer journey (1, 2, 3...)
  timestamp: timestamp("timestamp").notNull(),
  deviceType: text("device_type"), // 'desktop', 'mobile', 'tablet'
  userAgent: text("user_agent"), 
  ipAddress: text("ip_address"),
  referrer: text("referrer"),
  landingPage: text("landing_page"),
  eventValue: decimal("event_value", { precision: 10, scale: 2 }), // Revenue or custom value
  metadata: text("metadata"), // JSON string for additional tracking data
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attributionResults = pgTable("attribution_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journeyId: text("journey_id").notNull(),
  attributionModelId: text("attribution_model_id").notNull(),
  touchpointId: text("touchpoint_id").notNull(),
  campaignId: text("campaign_id"), // Campaign that gets attribution credit
  channel: text("channel").notNull(),
  attributionCredit: decimal("attribution_credit", { precision: 10, scale: 4 }).notNull(), // Percentage (0.0 to 1.0)
  attributedValue: decimal("attributed_value", { precision: 10, scale: 2 }), // Revenue attributed to this touchpoint
  calculatedAt: timestamp("calculated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const attributionInsights = pgTable("attribution_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attributionModelId: text("attribution_model_id").notNull(),
  campaignId: text("campaign_id"), // Optional - null for cross-campaign insights
  channel: text("channel").notNull(),
  period: text("period").notNull(), // 'daily', 'weekly', 'monthly'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalAttributedValue: decimal("total_attributed_value", { precision: 10, scale: 2 }).notNull(),
  totalTouchpoints: integer("total_touchpoints").notNull(),
  totalConversions: integer("total_conversions").notNull(),
  averageAttributionCredit: decimal("average_attribution_credit", { precision: 10, scale: 4 }),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }),
  costPerAttribution: decimal("cost_per_attribution", { precision: 10, scale: 2 }),
  returnOnAdSpend: decimal("return_on_ad_spend", { precision: 10, scale: 2 }),
  assistedConversions: integer("assisted_conversions"), // How many conversions this channel assisted
  lastClickConversions: integer("last_click_conversions"), // Last-click attribution for comparison
  firstClickConversions: integer("first_click_conversions"), // First-click attribution for comparison
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const linkedinReports = pgTable("linkedin_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: text("campaign_id"), // Optional - null for platform-level reports
  name: text("name").notNull(),
  description: text("description"),
  platformType: text("platform_type").notNull().default('linkedin'), // 'linkedin', 'custom-integration', etc.
  reportType: text("report_type").notNull(), // 'overview', 'kpis', 'benchmarks', 'ads', 'custom'
  configuration: text("configuration"), // JSON string for custom report elements
  // Schedule configuration
  scheduleEnabled: boolean("schedule_enabled").notNull().default(false),
  scheduleFrequency: text("schedule_frequency"), // 'daily', 'weekly', 'monthly', 'quarterly'
  scheduleDayOfWeek: integer("schedule_day_of_week"), // 0-6 for weekly
  scheduleDayOfMonth: integer("schedule_day_of_month"), // 1-31 for monthly
  scheduleTime: text("schedule_time"), // HH:MM format
  scheduleRecipients: text("schedule_recipients").array(), // Email addresses
  lastSentAt: timestamp("last_sent_at"),
  nextScheduledAt: timestamp("next_scheduled_at"),
  status: text("status").notNull().default("active"), // 'active', 'archived', 'draft'
  createdAt: timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
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
  websiteUrl: true,
  displayName: true,
  isPrimary: true,
  isActive: true,
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

export const insertLinkedInConnectionSchema = createInsertSchema(linkedinConnections).pick({
  campaignId: true,
  adAccountId: true,
  adAccountName: true,
  accessToken: true,
  refreshToken: true,
  clientId: true,
  clientSecret: true,
  method: true,
  expiresAt: true,
});

export const insertKPISchema = createInsertSchema(kpis).pick({
  campaignId: true,
  platformType: true,
  category: true,
  name: true,
  metric: true,
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
  alertCondition: true,
  alertsEnabled: true,
  emailRecipients: true,
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
  metric: true,
  description: true,
  benchmarkValue: true,
  currentValue: true,
  unit: true,
  benchmarkType: true,
  competitorName: true,
  source: true,
  industry: true,
  geoLocation: true,
  period: true,
  status: true,
  variance: true,
  confidenceLevel: true,
  alertThreshold: true,
  alertCondition: true,
  alertsEnabled: true,
  emailRecipients: true,
});

export const insertBenchmarkHistorySchema = createInsertSchema(benchmarkHistory).pick({
  benchmarkId: true,
  currentValue: true,
  benchmarkValue: true,
  variance: true,
  performanceRating: true,
  notes: true,
});

export const insertLinkedInReportSchema = createInsertSchema(linkedinReports).pick({
  campaignId: true,
  name: true,
  description: true,
  platformType: true,
  reportType: true,
  configuration: true,
  scheduleEnabled: true,
  scheduleFrequency: true,
  scheduleDayOfWeek: true,
  scheduleDayOfMonth: true,
  scheduleTime: true,
  scheduleRecipients: true,
  status: true,
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

export const insertABTestSchema = createInsertSchema(abTests).pick({
  campaignId: true,
  name: true,
  description: true,
  hypothesis: true,
  objective: true,
  trafficSplit: true,
  status: true,
  startDate: true,
  endDate: true,
  minSampleSize: true,
  confidenceLevel: true,
});

export const insertABTestVariantSchema = createInsertSchema(abTestVariants).pick({
  testId: true,
  name: true,
  description: true,
  content: true,
  trafficPercentage: true,
  isControl: true,
});

export const insertABTestResultSchema = createInsertSchema(abTestResults).pick({
  testId: true,
  variantId: true,
  impressions: true,
  clicks: true,
  conversions: true,
  revenue: true,
  conversionRate: true,
  clickThroughRate: true,
  revenuePerVisitor: true,
  costPerConversion: true,
});

export const insertABTestEventSchema = createInsertSchema(abTestEvents).pick({
  testId: true,
  variantId: true,
  eventType: true,
  eventValue: true,
  userId: true,
  sessionId: true,
  metadata: true,
});

export const insertAttributionModelSchema = createInsertSchema(attributionModels).pick({
  name: true,
  type: true,
  description: true,
  configuration: true,
  isDefault: true,
  isActive: true,
});

export const insertCustomerJourneySchema = createInsertSchema(customerJourneys).pick({
  customerId: true,
  sessionId: true,
  deviceId: true,
  userId: true,
  journeyStart: true,
  journeyEnd: true,
  totalTouchpoints: true,
  conversionValue: true,
  conversionType: true,
  status: true,
});

export const insertTouchpointSchema = createInsertSchema(touchpoints).pick({
  journeyId: true,
  campaignId: true,
  channel: true,
  platform: true,
  medium: true,
  source: true,
  campaign: true,
  content: true,
  term: true,
  touchpointType: true,
  position: true,
  timestamp: true,
  deviceType: true,
  userAgent: true,
  ipAddress: true,
  referrer: true,
  landingPage: true,
  eventValue: true,
  metadata: true,
});

export const insertAttributionResultSchema = createInsertSchema(attributionResults).pick({
  journeyId: true,
  attributionModelId: true,
  touchpointId: true,
  campaignId: true,
  channel: true,
  attributionCredit: true,
  attributedValue: true,
});

export const insertAttributionInsightSchema = createInsertSchema(attributionInsights).pick({
  attributionModelId: true,
  campaignId: true,
  channel: true,
  period: true,
  startDate: true,
  endDate: true,
  totalAttributedValue: true,
  totalTouchpoints: true,
  totalConversions: true,
  averageAttributionCredit: true,
  conversionRate: true,
  costPerAttribution: true,
  returnOnAdSpend: true,
  assistedConversions: true,
  lastClickConversions: true,
  firstClickConversions: true,
});

export const insertLinkedInImportSessionSchema = createInsertSchema(linkedinImportSessions).pick({
  campaignId: true,
  adAccountId: true,
  adAccountName: true,
  selectedCampaignsCount: true,
  selectedMetricsCount: true,
  selectedMetricKeys: true,
  conversionValue: true,
});

export const insertLinkedInImportMetricSchema = createInsertSchema(linkedinImportMetrics).pick({
  sessionId: true,
  campaignUrn: true,
  campaignName: true,
  campaignStatus: true,
  metricKey: true,
  metricValue: true,
});

export const insertLinkedInAdPerformanceSchema = createInsertSchema(linkedinAdPerformance).pick({
  sessionId: true,
  adId: true,
  adName: true,
  campaignUrn: true,
  campaignName: true,
  campaignSelectedMetrics: true,
  // Core Metrics
  impressions: true,
  reach: true,
  clicks: true,
  engagements: true,
  spend: true,
  conversions: true,
  leads: true,
  videoViews: true,
  viralImpressions: true,
  // Derived Metrics
  ctr: true,
  cpc: true,
  cpm: true,
  cvr: true,
  cpa: true,
  cpl: true,
  er: true,
  roi: true,
  roas: true,
  revenue: true,
  conversionRate: true,
});

export const insertCustomIntegrationSchema = createInsertSchema(customIntegrations).omit({
  id: true,
  connectedAt: true,
  createdAt: true,
});

export const insertCustomIntegrationMetricsSchema = createInsertSchema(customIntegrationMetrics).omit({
  id: true,
  uploadedAt: true,
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
export type LinkedInConnection = typeof linkedinConnections.$inferSelect;
export type InsertLinkedInConnection = z.infer<typeof insertLinkedInConnectionSchema>;
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
export type ABTest = typeof abTests.$inferSelect;
export type InsertABTest = z.infer<typeof insertABTestSchema>;
export type ABTestVariant = typeof abTestVariants.$inferSelect;
export type InsertABTestVariant = z.infer<typeof insertABTestVariantSchema>;
export type ABTestResult = typeof abTestResults.$inferSelect;
export type InsertABTestResult = z.infer<typeof insertABTestResultSchema>;
export type ABTestEvent = typeof abTestEvents.$inferSelect;
export type InsertABTestEvent = z.infer<typeof insertABTestEventSchema>;
export type AttributionModel = typeof attributionModels.$inferSelect;
export type InsertAttributionModel = z.infer<typeof insertAttributionModelSchema>;
export type CustomerJourney = typeof customerJourneys.$inferSelect;
export type InsertCustomerJourney = z.infer<typeof insertCustomerJourneySchema>;
export type Touchpoint = typeof touchpoints.$inferSelect;
export type InsertTouchpoint = z.infer<typeof insertTouchpointSchema>;
export type AttributionResult = typeof attributionResults.$inferSelect;
export type InsertAttributionResult = z.infer<typeof insertAttributionResultSchema>;
export type AttributionInsight = typeof attributionInsights.$inferSelect;
export type InsertAttributionInsight = z.infer<typeof insertAttributionInsightSchema>;
export type LinkedInImportSession = typeof linkedinImportSessions.$inferSelect;
export type InsertLinkedInImportSession = z.infer<typeof insertLinkedInImportSessionSchema>;
export type LinkedInImportMetric = typeof linkedinImportMetrics.$inferSelect;
export type InsertLinkedInImportMetric = z.infer<typeof insertLinkedInImportMetricSchema>;
export type LinkedInAdPerformance = typeof linkedinAdPerformance.$inferSelect;
export type InsertLinkedInAdPerformance = z.infer<typeof insertLinkedInAdPerformanceSchema>;
export type LinkedInReport = typeof linkedinReports.$inferSelect;
export type InsertLinkedInReport = z.infer<typeof insertLinkedInReportSchema>;
export type CustomIntegration = typeof customIntegrations.$inferSelect;
export type InsertCustomIntegration = z.infer<typeof insertCustomIntegrationSchema>;
export type CustomIntegrationMetrics = typeof customIntegrationMetrics.$inferSelect;
export type InsertCustomIntegrationMetrics = z.infer<typeof insertCustomIntegrationMetricsSchema>;
