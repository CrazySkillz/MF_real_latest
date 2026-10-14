-- Phase 2 foundation only. No route, UI, ingestion, or scheduler uses these tables yet.

CREATE TABLE IF NOT EXISTS mimosaas_website_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  website_url TEXT NOT NULL,
  installation_method TEXT NOT NULL CHECK (installation_method IN ('google_tag_manager', 'shopify', 'woocommerce', 'website_builder', 'universal')),
  installation_status TEXT NOT NULL DEFAULT 'pending' CHECK (installation_status IN ('pending', 'verified', 'disconnected', 'error')),
  installation_metadata JSONB,
  verified_at TIMESTAMPTZ,
  last_event_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_website_connections_client_url_unique
ON mimosaas_website_connections (client_id, website_url);

CREATE INDEX IF NOT EXISTS mimosaas_website_connections_owner_client_idx
ON mimosaas_website_connections (owner_id, client_id);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  website_connection_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'active', 'disabled')),
  conversion_event_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  attribution_window_days INTEGER NOT NULL DEFAULT 30 CHECK (attribution_window_days = 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_configurations_campaign_unique
ON mimosaas_tracking_configurations (campaign_id);

CREATE INDEX IF NOT EXISTS mimosaas_tracking_configurations_website_idx
ON mimosaas_tracking_configurations (website_connection_id);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_campaign_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  tracking_configuration_id TEXT NOT NULL,
  mapping_type TEXT NOT NULL CHECK (mapping_type IN ('utm_campaign', 'google_ads_campaign_id')),
  campaign_value TEXT NOT NULL CHECK (campaign_value <> ''),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_campaign_mappings_exact_unique
ON mimosaas_tracking_campaign_mappings (campaign_id, mapping_type, campaign_value);

CREATE INDEX IF NOT EXISTS mimosaas_tracking_campaign_mappings_config_idx
ON mimosaas_tracking_campaign_mappings (tracking_configuration_id);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  website_connection_id TEXT NOT NULL,
  resolved_campaign_id TEXT,
  campaign_resolution_status TEXT NOT NULL DEFAULT 'pending' CHECK (campaign_resolution_status IN ('pending', 'attributed', 'unattributed', 'conflict')),
  event_time TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  anonymous_visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  url TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,
  gclid TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_events_event_id_unique
ON mimosaas_tracking_events (event_id);

CREATE INDEX IF NOT EXISTS mimosaas_tracking_events_website_time_idx
ON mimosaas_tracking_events (website_connection_id, event_time);

CREATE INDEX IF NOT EXISTS mimosaas_tracking_events_campaign_time_idx
ON mimosaas_tracking_events (resolved_campaign_id, event_time);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  website_connection_id TEXT NOT NULL,
  campaign_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'attributed', 'unattributed', 'conflict')),
  resolution_source TEXT CHECK (resolution_source IS NULL OR resolution_source IN ('gclid', 'utm_campaign', 'returning_direct')),
  external_campaign_id TEXT,
  conflict_details JSONB,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_attributions_event_unique
ON mimosaas_tracking_attributions (event_id);

CREATE INDEX IF NOT EXISTS mimosaas_tracking_attributions_campaign_idx
ON mimosaas_tracking_attributions (campaign_id);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  reporting_date TEXT NOT NULL,
  reporting_time_zone TEXT NOT NULL,
  users INTEGER NOT NULL DEFAULT 0 CHECK (users >= 0),
  sessions INTEGER NOT NULL DEFAULT 0 CHECK (sessions >= 0),
  engaged_sessions INTEGER NOT NULL DEFAULT 0 CHECK (engaged_sessions >= 0),
  pageviews INTEGER NOT NULL DEFAULT 0 CHECK (pageviews >= 0),
  conversions INTEGER NOT NULL DEFAULT 0 CHECK (conversions >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_daily_metrics_campaign_day_unique
ON mimosaas_tracking_daily_metrics (campaign_id, reporting_date);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_publication_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  reporting_date TEXT NOT NULL,
  reporting_time_zone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'finalized', 'failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  source_states JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_publication_runs_campaign_day_unique
ON mimosaas_tracking_publication_runs (campaign_id, reporting_date);

CREATE TABLE IF NOT EXISTS mimosaas_tracking_daily_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  reporting_date TEXT NOT NULL,
  reporting_time_zone TEXT NOT NULL,
  users INTEGER NOT NULL CHECK (users >= 0),
  sessions INTEGER NOT NULL CHECK (sessions >= 0),
  engaged_sessions INTEGER NOT NULL CHECK (engaged_sessions >= 0),
  pageviews INTEGER NOT NULL CHECK (pageviews >= 0),
  conversions INTEGER NOT NULL CHECK (conversions >= 0),
  engagement_rate NUMERIC(7,4) NOT NULL,
  conversion_rate NUMERIC(7,4) NOT NULL,
  revenue NUMERIC(15,2),
  spend NUMERIC(15,2),
  currency TEXT NOT NULL,
  revenue_status TEXT NOT NULL CHECK (revenue_status IN ('available', 'unavailable')),
  spend_status TEXT NOT NULL CHECK (spend_status IN ('available', 'unavailable')),
  source_states JSONB NOT NULL,
  financial_snapshot_id TEXT,
  published_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_tracking_daily_snapshots_campaign_day_unique
ON mimosaas_tracking_daily_snapshots (campaign_id, reporting_date);

CREATE OR REPLACE FUNCTION prevent_mimosaas_tracking_immutable_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'MIMOSAAS_TRACKING_IMMUTABLE_RECORD';
END;
$$;

DROP TRIGGER IF EXISTS mimosaas_tracking_events_immutable ON mimosaas_tracking_events;
CREATE TRIGGER mimosaas_tracking_events_immutable
BEFORE UPDATE ON mimosaas_tracking_events
FOR EACH ROW EXECUTE FUNCTION prevent_mimosaas_tracking_immutable_update();

DROP TRIGGER IF EXISTS mimosaas_tracking_daily_snapshots_immutable ON mimosaas_tracking_daily_snapshots;
CREATE TRIGGER mimosaas_tracking_daily_snapshots_immutable
BEFORE UPDATE ON mimosaas_tracking_daily_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_mimosaas_tracking_immutable_update();
