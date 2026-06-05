-- Migration: Add Instagram connected platform schema/storage foundation
-- Purpose: Persist Instagram-only source identity and daily facts without exposing UI/API behavior yet.

CREATE TABLE IF NOT EXISTS instagram_connections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  encrypted_tokens JSONB,
  method TEXT NOT NULL,
  selected_campaign_ids TEXT,
  campaign_utm_map TEXT,
  publisher_platform_filter TEXT NOT NULL DEFAULT 'instagram',
  source_contract_version TEXT NOT NULL DEFAULT 'instagram_publisher_platform_v1',
  last_refresh_at TIMESTAMP,
  spend_only BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_instagram_connections_campaign_id
  ON instagram_connections(campaign_id);

CREATE TABLE IF NOT EXISTS instagram_daily_metrics (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  instagram_campaign_id TEXT NOT NULL,
  instagram_campaign_name TEXT,
  date TEXT NOT NULL,
  publisher_platform TEXT NOT NULL DEFAULT 'instagram',
  platform_position TEXT NOT NULL DEFAULT 'unknown',
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  spend DECIMAL(10, 2) NOT NULL DEFAULT 0,
  conversions DECIMAL(10, 2) NOT NULL DEFAULT 0,
  video_views INTEGER NOT NULL DEFAULT 0,
  actions JSONB,
  ctr DECIMAL(5, 2),
  cpc DECIMAL(10, 2),
  cpm DECIMAL(10, 2),
  cost_per_conversion DECIMAL(10, 2),
  conversion_rate DECIMAL(5, 2),
  ga4_revenue DECIMAL(15, 2),
  ga4_utm_name TEXT,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_daily_metrics_unique
  ON instagram_daily_metrics(campaign_id, instagram_campaign_id, date, platform_position);

CREATE INDEX IF NOT EXISTS idx_instagram_daily_metrics_campaign_date
  ON instagram_daily_metrics(campaign_id, date DESC);
