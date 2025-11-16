-- Create meta_connections table for Meta/Facebook Ads integration
CREATE TABLE IF NOT EXISTS meta_connections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  ad_account_id TEXT NOT NULL,
  ad_account_name TEXT,
  access_token TEXT,
  refresh_token TEXT,
  method TEXT NOT NULL,
  expires_at TIMESTAMP,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by campaign_id
CREATE INDEX IF NOT EXISTS idx_meta_connections_campaign_id ON meta_connections(campaign_id);

