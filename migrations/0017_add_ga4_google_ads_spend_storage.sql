CREATE TABLE IF NOT EXISTS ga4_google_ads_spend_connections (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL,
  customer_id text NOT NULL,
  customer_name text,
  manager_account_id text,
  access_token text,
  refresh_token text,
  client_id text,
  client_secret text,
  developer_token text,
  encrypted_tokens jsonb,
  method text NOT NULL,
  spend_only boolean NOT NULL DEFAULT true,
  last_refresh_at timestamp,
  expires_at timestamp,
  connected_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ga4_google_ads_spend_connections_campaign_unique
  ON ga4_google_ads_spend_connections (campaign_id);

CREATE TABLE IF NOT EXISTS ga4_google_ads_spend_daily_metrics (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL,
  google_campaign_id text NOT NULL,
  google_campaign_name text,
  date text NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  spend numeric(12, 2) NOT NULL DEFAULT 0,
  imported_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ga4_google_ads_spend_daily_metrics_campaign_day_unique
  ON ga4_google_ads_spend_daily_metrics (campaign_id, google_campaign_id, date);
