CREATE TABLE IF NOT EXISTS ga4_overview_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  property_id TEXT NOT NULL,
  window_start TEXT NOT NULL,
  window_end TEXT NOT NULL,
  campaign_breakdown JSONB NOT NULL,
  landing_pages JSONB NOT NULL,
  conversion_events JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ga4_overview_snapshots_campaign_property_unique
ON ga4_overview_snapshots (campaign_id, property_id);
