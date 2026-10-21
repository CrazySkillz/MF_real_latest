-- Additive only. Duplicate business keys fail the transaction; never delete/merge facts here.
CREATE TABLE IF NOT EXISTS campaign_creation_requests (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  created BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS campaign_creation_requests_scope_unique
  ON campaign_creation_requests(owner_id, client_id, request_id);
CREATE UNIQUE INDEX IF NOT EXISTS ga4_daily_metrics_campaign_property_date_unique
  ON ga4_daily_metrics (campaign_id, property_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS linkedin_daily_metrics_campaign_date_unique
  ON linkedin_daily_metrics (campaign_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS google_ads_daily_metrics_campaign_date_unique
  ON google_ads_daily_metrics (campaign_id, google_campaign_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS meta_daily_metrics_campaign_date_unique
  ON meta_daily_metrics (campaign_id, meta_campaign_id, date);

-- NOT VALID preserves any historical orphans for separately reviewed cleanup while
-- enforcing the parent boundary for every new insert/client change and client deletion.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'campaigns'::regclass AND conname = 'campaigns_client_id_clients_id_fk') THEN
    ALTER TABLE campaigns ADD CONSTRAINT campaigns_client_id_clients_id_fk
      FOREIGN KEY (client_id) REFERENCES clients(id) NOT VALID;
  END IF;
END $$;
