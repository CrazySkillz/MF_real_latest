CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "campaigns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text,
	"client_id" text,
	"name" text NOT NULL,
	"client_website" text,
	"label" text,
	"budget" numeric(10, 2),
	"currency" text DEFAULT 'USD' NOT NULL,
	"conversion_value" numeric(10, 2),
	"ga4_campaign_filter" text,
	"reporting_time_zone" text DEFAULT 'UTC' NOT NULL,
	"type" text,
	"platform" text,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"industry" text,
	"trend_keywords" text[],
	"start_date" timestamp,
	"end_date" timestamp,
	"pacing_start_date" text,
	"pacing_end_date" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"value" text NOT NULL,
	"change" text NOT NULL,
	"icon" text NOT NULL,
	"date" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"platform" text NOT NULL,
	"name" text NOT NULL,
	"connected" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"last_sync" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "performance_data" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" text NOT NULL,
	"impressions" integer NOT NULL,
	"clicks" integer NOT NULL,
	"conversions" integer NOT NULL
);

CREATE TABLE "ga4_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"property_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"service_account_key" text,
	"method" text NOT NULL,
	"property_name" text,
	"website_url" text,
	"display_name" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"client_id" text,
	"client_secret" text,
	"import_start_date" text,
	"encrypted_tokens" jsonb,
	"lookback_days" integer DEFAULT 90 NOT NULL,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ga4_connection_lifecycle_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" text NOT NULL,
	"campaign_id" text NOT NULL,
	"property_id" text,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"changed_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ga4_refresh_work" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"reporting_date" text NOT NULL,
	"scope_hash" text NOT NULL,
	"scope" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone,
	"suppress_alerts" boolean DEFAULT false NOT NULL,
	"retryable" boolean DEFAULT true NOT NULL,
	"last_error" text,
	"updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "ga4_refresh_work_state" CHECK (("ga4_refresh_work"."status" = 'pending' AND "ga4_refresh_work"."lease_token" IS NULL AND "ga4_refresh_work"."lease_expires_at" IS NULL AND "ga4_refresh_work"."completed_at" IS NULL)
    OR ("ga4_refresh_work"."status" = 'running' AND "ga4_refresh_work"."lease_token" IS NOT NULL AND "ga4_refresh_work"."lease_expires_at" IS NOT NULL AND "ga4_refresh_work"."started_at" IS NOT NULL AND "ga4_refresh_work"."completed_at" IS NULL)
    OR ("ga4_refresh_work"."status" = 'completed' AND "ga4_refresh_work"."lease_token" IS NULL AND "ga4_refresh_work"."lease_expires_at" IS NULL AND "ga4_refresh_work"."completed_at" IS NOT NULL))
);

CREATE TABLE "ga4_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"property_id" text NOT NULL,
	"date" text NOT NULL,
	"users" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"engaged_sessions" integer,
	"pageviews" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(15, 2) DEFAULT '0' NOT NULL,
	"engagement_rate" numeric(7, 4) DEFAULT '0',
	"revenue_metric" text,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ga4_overview_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"property_id" text NOT NULL,
	"window_start" text NOT NULL,
	"window_end" text NOT NULL,
	"campaign_breakdown" jsonb NOT NULL,
	"landing_pages" jsonb NOT NULL,
	"conversion_events" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "spend_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"source_type" text NOT NULL,
	"platform_context" text,
	"display_name" text,
	"currency" text,
	"mapping_config" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "spend_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"spend_source_id" text NOT NULL,
	"date" text NOT NULL,
	"spend" numeric(12, 2) NOT NULL,
	"currency" text,
	"source_type" varchar(50),
	"sub_campaign_urn" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "revenue_sources" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"source_type" text NOT NULL,
	"platform_context" text,
	"display_name" text,
	"currency" text,
	"mapping_config" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "revenue_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"revenue_source_id" text NOT NULL,
	"date" text NOT NULL,
	"revenue" numeric(12, 2) NOT NULL,
	"currency" text,
	"external_id" text,
	"source_type" varchar(50),
	"sub_campaign_urn" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text NOT NULL,
	"campaign_id" text,
	"campaign_name" text,
	"read" boolean DEFAULT false NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "email_alert_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'generic' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"dedupe_key" text,
	"campaign_id" text,
	"campaign_name" text,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"provider" text,
	"success" boolean DEFAULT false NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"provider_response_id" text,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"next_attempt_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"error" text,
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "google_sheets_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"spreadsheet_id" text NOT NULL,
	"spreadsheet_name" text,
	"sheet_name" text,
	"purpose" text,
	"method" text DEFAULT 'access_token' NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"encrypted_tokens" jsonb,
	"expires_at" timestamp,
	"is_primary" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"column_mappings" text,
	"platforms" text,
	"cached_data" jsonb,
	"last_data_refresh_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "hubspot_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"portal_id" text,
	"portal_name" text,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"encrypted_tokens" jsonb,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"mapping_config" text,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "salesforce_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"org_id" text,
	"org_name" text,
	"instance_url" text,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"encrypted_tokens" jsonb,
	"expires_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"mapping_config" text,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "shopify_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"shop_domain" text NOT NULL,
	"shop_name" text,
	"access_token" text,
	"encrypted_tokens" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"mapping_config" text,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "mapping_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"platform" text NOT NULL,
	"column_structure" text NOT NULL,
	"mappings" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"last_used_at" timestamp,
	"usage_count" integer DEFAULT 0,
	"created_by" text,
	"is_shared" boolean DEFAULT false
);

CREATE TABLE "linkedin_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"method" text NOT NULL,
	"encrypted_tokens" jsonb,
	"conversion_value" numeric(10, 2),
	"campaign_utm_map" text,
	"last_refresh_at" timestamp,
	"spend_only" boolean DEFAULT false,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "meta_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"access_token" text,
	"refresh_token" text,
	"encrypted_tokens" jsonb,
	"method" text NOT NULL,
	"conversion_value" numeric(10, 2),
	"selected_campaign_ids" text,
	"campaign_utm_map" text,
	"spend_only" boolean DEFAULT false,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "instagram_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"access_token" text,
	"refresh_token" text,
	"encrypted_tokens" jsonb,
	"method" text NOT NULL,
	"selected_campaign_ids" text,
	"campaign_utm_map" text,
	"publisher_platform_filter" text DEFAULT 'instagram' NOT NULL,
	"source_contract_version" text DEFAULT 'instagram_publisher_platform_v1' NOT NULL,
	"last_refresh_at" timestamp,
	"spend_only" boolean DEFAULT false,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "tiktok_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"advertiser_id" text NOT NULL,
	"advertiser_name" text,
	"access_token" text,
	"refresh_token" text,
	"encrypted_tokens" jsonb,
	"method" text NOT NULL,
	"selected_campaign_ids" text,
	"selected_campaign_metadata" text,
	"reporting_dimensions" text,
	"reporting_metrics" text,
	"source_contract_version" text DEFAULT 'tiktok_campaign_daily_v1' NOT NULL,
	"last_refresh_at" timestamp,
	"last_error" text,
	"spend_only" boolean DEFAULT false,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "google_ads_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text,
	"manager_account_id" text,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"developer_token" text,
	"encrypted_tokens" jsonb,
	"method" text NOT NULL,
	"conversion_value" numeric(10, 2),
	"selected_campaign_ids" text,
	"campaign_utm_map" text,
	"last_refresh_at" timestamp,
	"spend_only" boolean DEFAULT false,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "google_ads_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"google_campaign_id" text NOT NULL,
	"google_campaign_name" text,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT 0 NOT NULL,
	"conversions" numeric(10, 2) DEFAULT 0 NOT NULL,
	"conversion_value" numeric(10, 2) DEFAULT 0 NOT NULL,
	"ctr" numeric(8, 4),
	"cpc" numeric(10, 2),
	"cpm" numeric(10, 2),
	"interaction_rate" numeric(5, 2),
	"video_views" integer DEFAULT 0 NOT NULL,
	"search_impression_share" numeric(5, 2),
	"cost_per_conversion" numeric(10, 2),
	"conversion_rate" numeric(5, 2),
	"ga4_revenue" numeric(15, 2),
	"ga4_utm_name" text,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "meta_kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"metric_type" text NOT NULL,
	"target_value" numeric(15, 2) NOT NULL,
	"current_value" numeric(15, 2),
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" numeric(5, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"alert_enabled" boolean DEFAULT false NOT NULL,
	"alert_threshold" numeric(5, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "meta_benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"metric_type" text NOT NULL,
	"benchmark_value" numeric(15, 2) NOT NULL,
	"current_value" numeric(15, 2),
	"industry" text,
	"source" text DEFAULT 'custom' NOT NULL,
	"comparison_type" text DEFAULT 'greater_than' NOT NULL,
	"status" text,
	"percentage_diff" numeric(5, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "meta_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"frequency" text NOT NULL,
	"schedule" text,
	"recipients" text[] NOT NULL,
	"format" text DEFAULT 'pdf' NOT NULL,
	"include_charts" boolean DEFAULT true NOT NULL,
	"include_demographics" boolean DEFAULT true NOT NULL,
	"include_geographics" boolean DEFAULT true NOT NULL,
	"include_placements" boolean DEFAULT true NOT NULL,
	"date_range" text DEFAULT 'last_30_days' NOT NULL,
	"custom_start_date" timestamp,
	"custom_end_date" timestamp,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_sent" timestamp,
	"next_scheduled" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "meta_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"meta_campaign_id" text NOT NULL,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"video_views" integer DEFAULT 0 NOT NULL,
	"post_engagement" integer DEFAULT 0 NOT NULL,
	"link_clicks" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(5, 2),
	"cpc" numeric(10, 2),
	"cpm" numeric(10, 2),
	"cpp" numeric(10, 2),
	"frequency" numeric(5, 2),
	"cost_per_conversion" numeric(10, 2),
	"conversion_rate" numeric(5, 2),
	"revenue" numeric(10, 2),
	"roas" numeric(5, 2),
	"meta_campaign_name" text,
	"ga4_revenue" numeric(15, 2),
	"ga4_utm_name" text,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "instagram_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"instagram_campaign_id" text NOT NULL,
	"instagram_campaign_name" text,
	"date" text NOT NULL,
	"publisher_platform" text DEFAULT 'instagram' NOT NULL,
	"platform_position" text DEFAULT 'unknown' NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT 0 NOT NULL,
	"conversions" numeric(10, 2) DEFAULT 0 NOT NULL,
	"video_views" integer DEFAULT 0 NOT NULL,
	"actions" jsonb,
	"ctr" numeric(5, 2),
	"cpc" numeric(10, 2),
	"cpm" numeric(10, 2),
	"cost_per_conversion" numeric(10, 2),
	"conversion_rate" numeric(5, 2),
	"ga4_revenue" numeric(15, 2),
	"ga4_utm_name" text,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "tiktok_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"advertiser_id" text NOT NULL,
	"tiktok_campaign_id" text NOT NULL,
	"tiktok_campaign_name" text,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT 0 NOT NULL,
	"currency" text,
	"conversions" numeric(10, 2) DEFAULT 0 NOT NULL,
	"video_views" integer DEFAULT 0 NOT NULL,
	"engagements" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(5, 2),
	"cpc" numeric(10, 2),
	"cpm" numeric(10, 2),
	"cost_per_conversion" numeric(10, 2),
	"conversion_rate" numeric(5, 2),
	"raw_metrics" jsonb,
	"metric_availability" jsonb,
	"is_estimated" boolean DEFAULT false NOT NULL,
	"source_contract_version" text DEFAULT 'tiktok_campaign_daily_v1' NOT NULL,
	"is_simulated" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "linkedin_import_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"selected_campaigns_count" integer DEFAULT 0 NOT NULL,
	"selected_metrics_count" integer DEFAULT 0 NOT NULL,
	"selected_metric_keys" text[],
	"conversion_value" numeric(10, 2),
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "linkedin_import_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"campaign_urn" text NOT NULL,
	"campaign_name" text NOT NULL,
	"campaign_status" text DEFAULT 'active' NOT NULL,
	"metric_key" text NOT NULL,
	"metric_value" numeric(15, 2) NOT NULL,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "linkedin_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"engagements" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"spend" numeric(15, 2) DEFAULT '0' NOT NULL,
	"video_views" integer DEFAULT 0 NOT NULL,
	"viral_impressions" integer DEFAULT 0 NOT NULL,
	"linkedin_campaign_id" text,
	"linkedin_campaign_name" text,
	"ga4_revenue" numeric(15, 2),
	"ga4_utm_name" text,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "linkedin_ad_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"ad_name" text NOT NULL,
	"campaign_urn" text NOT NULL,
	"campaign_name" text NOT NULL,
	"campaign_selected_metrics" text[],
	"impressions" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"engagements" integer DEFAULT 0 NOT NULL,
	"spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"leads" integer DEFAULT 0 NOT NULL,
	"video_views" integer DEFAULT 0 NOT NULL,
	"viral_impressions" integer DEFAULT 0 NOT NULL,
	"ctr" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cpc" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cpm" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cvr" numeric(5, 2) DEFAULT '0' NOT NULL,
	"cpa" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cpl" numeric(10, 2) DEFAULT '0' NOT NULL,
	"er" numeric(5, 2) DEFAULT '0' NOT NULL,
	"roi" numeric(10, 2) DEFAULT '0' NOT NULL,
	"roas" numeric(10, 2) DEFAULT '0' NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0',
	"conversion_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "custom_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"email" text,
	"webhook_token" text NOT NULL,
	"allowed_email_addresses" text[],
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "conversion_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"conversion_id" text,
	"value" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"conversion_type" text,
	"source" text NOT NULL,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"received_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "custom_integration_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"impressions" integer DEFAULT 0,
	"reach" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"engagements" integer DEFAULT 0,
	"spend" numeric(10, 2) DEFAULT '0',
	"conversions" integer DEFAULT 0,
	"leads" integer DEFAULT 0,
	"video_views" integer DEFAULT 0,
	"viral_impressions" integer DEFAULT 0,
	"users" integer DEFAULT 0,
	"sessions" integer DEFAULT 0,
	"pageviews" integer DEFAULT 0,
	"avg_session_duration" text,
	"pages_per_session" numeric(5, 2) DEFAULT '0',
	"bounce_rate" numeric(5, 2) DEFAULT '0',
	"organic_search_share" numeric(5, 2) DEFAULT '0',
	"direct_branded_share" numeric(5, 2) DEFAULT '0',
	"email_share" numeric(5, 2) DEFAULT '0',
	"referral_share" numeric(5, 2) DEFAULT '0',
	"paid_share" numeric(5, 2) DEFAULT '0',
	"social_share" numeric(5, 2) DEFAULT '0',
	"emails_delivered" integer DEFAULT 0,
	"open_rate" numeric(5, 2) DEFAULT '0',
	"click_through_rate" numeric(5, 2) DEFAULT '0',
	"click_to_open_rate" numeric(5, 2) DEFAULT '0',
	"hard_bounces" numeric(5, 2) DEFAULT '0',
	"spam_complaints" numeric(5, 2) DEFAULT '0',
	"list_growth" integer DEFAULT 0,
	"pdf_file_name" text,
	"email_subject" text,
	"email_id" text,
	"previous_metrics" text,
	"previous_update_at" timestamp,
	"parser_metadata" jsonb,
	"uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "kpis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text,
	"platform_type" text,
	"category" text DEFAULT 'performance' NOT NULL,
	"name" text NOT NULL,
	"metric" text,
	"source_type" text DEFAULT 'manual',
	"metric_key" text,
	"aggregation_method" text,
	"calculation_config" jsonb,
	"target_value" numeric(18, 2) NOT NULL,
	"current_value" numeric(18, 2) DEFAULT '0',
	"last_computed_value" numeric(18, 2),
	"unit" text NOT NULL,
	"description" text,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'tracking' NOT NULL,
	"timeframe" text DEFAULT 'monthly' NOT NULL,
	"tracking_period" integer DEFAULT 30 NOT NULL,
	"rolling_average" text DEFAULT '7day' NOT NULL,
	"target_date" timestamp,
	"alert_threshold" numeric(18, 2),
	"alert_condition" text DEFAULT 'below',
	"alerts_enabled" boolean DEFAULT true NOT NULL,
	"email_notifications" boolean DEFAULT false NOT NULL,
	"email_recipients" text,
	"slack_notifications" boolean DEFAULT false NOT NULL,
	"alert_frequency" text DEFAULT 'daily' NOT NULL,
	"last_alert_sent" timestamp,
	"apply_to" text DEFAULT 'all',
	"specific_campaign_id" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "kpi_periods" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"period_type" text NOT NULL,
	"period_label" text NOT NULL,
	"final_value" numeric(10, 2) NOT NULL,
	"target_value" numeric(10, 2) NOT NULL,
	"unit" text NOT NULL,
	"target_achieved" boolean NOT NULL,
	"performance_percentage" numeric(5, 2),
	"performance_level" text,
	"previous_period_value" numeric(10, 2),
	"change_amount" numeric(10, 2),
	"change_percentage" numeric(5, 2),
	"trend_direction" text,
	"notes" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "kpi_progress" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" text NOT NULL,
	"value" numeric(18, 2) NOT NULL,
	"rolling_average_7d" numeric(18, 2),
	"rolling_average_30d" numeric(18, 2),
	"trend_direction" text DEFAULT 'neutral',
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"notes" text
);

CREATE TABLE "kpi_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kpi_id" text NOT NULL,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"message" text NOT NULL,
	"current_value" numeric(18, 2),
	"target_value" numeric(18, 2),
	"threshold_value" numeric(18, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"acknowledged_at" timestamp,
	"resolved_at" timestamp,
	"email_sent" boolean DEFAULT false NOT NULL,
	"slack_sent" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text,
	"platform_type" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"metric" text,
	"description" text,
	"benchmark_value" numeric(18, 2) NOT NULL,
	"current_value" numeric(18, 2) DEFAULT '0',
	"unit" text NOT NULL,
	"benchmark_type" text DEFAULT 'industry' NOT NULL,
	"competitor_name" text,
	"source" text,
	"calculation_config" jsonb,
	"industry" text,
	"geo_location" text,
	"period" text DEFAULT 'monthly' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"variance" numeric(10, 2),
	"confidence_level" text DEFAULT 'medium',
	"apply_to" text DEFAULT 'all' NOT NULL,
	"specific_campaign_id" text,
	"linkedin_campaign_name" text,
	"alert_threshold" numeric(18, 2),
	"alert_condition" text DEFAULT 'below',
	"alerts_enabled" boolean DEFAULT false NOT NULL,
	"email_notifications" boolean DEFAULT false NOT NULL,
	"email_recipients" text,
	"alert_frequency" text DEFAULT 'daily' NOT NULL,
	"last_alert_sent" timestamp,
	"last_updated" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "benchmark_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"benchmark_id" text NOT NULL,
	"current_value" numeric(18, 2) NOT NULL,
	"benchmark_value" numeric(18, 2) NOT NULL,
	"variance" numeric(10, 2) NOT NULL,
	"performance_rating" text DEFAULT 'average' NOT NULL,
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"notes" text
);

CREATE TABLE "metric_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"total_impressions" integer DEFAULT 0 NOT NULL,
	"total_engagements" integer DEFAULT 0 NOT NULL,
	"total_clicks" integer DEFAULT 0 NOT NULL,
	"total_conversions" integer DEFAULT 0 NOT NULL,
	"total_leads" integer DEFAULT 0 NOT NULL,
	"total_spend" numeric(10, 2) DEFAULT '0' NOT NULL,
	"metrics" jsonb,
	"snapshot_type" text DEFAULT 'automatic' NOT NULL,
	"reporting_date" text,
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"notes" text
);

CREATE TABLE "ga4_google_ads_spend_connections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text,
	"manager_account_id" text,
	"access_token" text,
	"refresh_token" text,
	"client_id" text,
	"client_secret" text,
	"developer_token" text,
	"encrypted_tokens" jsonb,
	"method" text NOT NULL,
	"spend_only" boolean DEFAULT true NOT NULL,
	"last_refresh_at" timestamp,
	"expires_at" timestamp,
	"connected_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ga4_google_ads_spend_daily_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"google_campaign_id" text NOT NULL,
	"google_campaign_name" text,
	"date" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend" numeric(12, 2) DEFAULT 0 NOT NULL,
	"imported_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ab_tests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"hypothesis" text,
	"objective" text NOT NULL,
	"traffic_split" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"min_sample_size" integer DEFAULT 100,
	"confidence_level" numeric(3, 2) DEFAULT '95.00',
	"significance" boolean DEFAULT false,
	"winner_variant" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ab_test_variants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text,
	"traffic_percentage" numeric(5, 2) NOT NULL,
	"is_control" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ab_test_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"conversions" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"conversion_rate" numeric(5, 2) DEFAULT '0.00',
	"click_through_rate" numeric(5, 2) DEFAULT '0.00',
	"revenue_per_visitor" numeric(10, 2) DEFAULT '0.00',
	"cost_per_conversion" numeric(10, 2) DEFAULT '0.00',
	"recorded_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "ab_test_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_value" numeric(10, 2),
	"user_id" text,
	"session_id" text,
	"metadata" text,
	"occurred_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "attribution_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"configuration" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "customer_journeys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" text NOT NULL,
	"session_id" text,
	"device_id" text,
	"user_id" text,
	"journey_start" timestamp NOT NULL,
	"journey_end" timestamp,
	"total_touchpoints" integer DEFAULT 0 NOT NULL,
	"conversion_value" numeric(10, 2),
	"conversion_type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "touchpoints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" text NOT NULL,
	"campaign_id" text,
	"channel" text NOT NULL,
	"platform" text,
	"medium" text,
	"source" text,
	"campaign" text,
	"content" text,
	"term" text,
	"touchpoint_type" text NOT NULL,
	"position" integer NOT NULL,
	"timestamp" timestamp NOT NULL,
	"device_type" text,
	"user_agent" text,
	"ip_address" text,
	"referrer" text,
	"landing_page" text,
	"event_value" numeric(10, 2),
	"metadata" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "attribution_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_id" text NOT NULL,
	"attribution_model_id" text NOT NULL,
	"touchpoint_id" text NOT NULL,
	"campaign_id" text,
	"channel" text NOT NULL,
	"attribution_credit" numeric(10, 4) NOT NULL,
	"attributed_value" numeric(10, 2),
	"calculated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "attribution_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribution_model_id" text NOT NULL,
	"campaign_id" text,
	"channel" text NOT NULL,
	"period" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_attributed_value" numeric(10, 2) NOT NULL,
	"total_touchpoints" integer NOT NULL,
	"total_conversions" integer NOT NULL,
	"average_attribution_credit" numeric(10, 4),
	"conversion_rate" numeric(5, 2),
	"cost_per_attribution" numeric(10, 2),
	"return_on_ad_spend" numeric(10, 2),
	"assisted_conversions" integer,
	"last_click_conversions" integer,
	"first_click_conversions" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "linkedin_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text,
	"name" text NOT NULL,
	"description" text,
	"platform_type" text DEFAULT 'linkedin' NOT NULL,
	"report_type" text NOT NULL,
	"configuration" text,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"schedule_frequency" text,
	"schedule_day_of_week" integer,
	"schedule_day_of_month" integer,
	"schedule_time" text,
	"schedule_time_zone" text,
	"quarter_timing" text,
	"schedule_recipients" text[],
	"last_sent_at" timestamp,
	"next_scheduled_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "report_snapshots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" text NOT NULL,
	"campaign_id" text,
	"platform_type" text DEFAULT 'linkedin' NOT NULL,
	"report_type" text NOT NULL,
	"window_start" text,
	"window_end" text,
	"snapshot_json" text NOT NULL,
	"has_estimated" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "report_send_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" text NOT NULL,
	"snapshot_id" text,
	"scheduled_key" text NOT NULL,
	"time_zone" text,
	"recipients" text[],
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE "kpi_reports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"report_type" text DEFAULT 'kpis' NOT NULL,
	"schedule_enabled" boolean DEFAULT false NOT NULL,
	"schedule_frequency" text,
	"schedule_day_of_week" integer,
	"schedule_day_of_month" integer,
	"schedule_time" text,
	"schedule_recipients" text[],
	"last_sent_at" timestamp,
	"next_scheduled_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX "ga4_refresh_work_identity" ON "ga4_refresh_work" USING btree ("campaign_id","due_at","reporting_date","scope_hash");
CREATE UNIQUE INDEX "ga4_refresh_work_running_campaign" ON "ga4_refresh_work" USING btree ("campaign_id") WHERE "ga4_refresh_work"."status" = 'running';
CREATE UNIQUE INDEX "ga4_overview_snapshots_campaign_property_unique" ON "ga4_overview_snapshots" USING btree ("campaign_id","property_id");
CREATE UNIQUE INDEX "email_alert_events_dedupe_key_unique" ON "email_alert_events" USING btree ("dedupe_key");
CREATE UNIQUE INDEX "metric_snapshots_financial_day_unique" ON "metric_snapshots" USING btree ("campaign_id","reporting_date") WHERE "metric_snapshots"."snapshot_type" = 'financial_daily' AND "metric_snapshots"."reporting_date" IS NOT NULL;
CREATE UNIQUE INDEX "metric_snapshots_executive_summary_day_unique" ON "metric_snapshots" USING btree ("campaign_id","reporting_date") WHERE "metric_snapshots"."snapshot_type" = 'executive_summary_daily' AND "metric_snapshots"."reporting_date" IS NOT NULL;
CREATE UNIQUE INDEX "ga4_google_ads_spend_connections_campaign_unique" ON "ga4_google_ads_spend_connections" USING btree ("campaign_id");
CREATE UNIQUE INDEX "ga4_google_ads_spend_daily_metrics_campaign_day_unique" ON "ga4_google_ads_spend_daily_metrics" USING btree ("campaign_id","google_campaign_id","date");
