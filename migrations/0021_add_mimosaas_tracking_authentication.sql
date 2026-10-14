-- Phase 3 authentication foundation only. Public event ingestion remains disabled.

ALTER TABLE mimosaas_website_connections
  ADD COLUMN IF NOT EXISTS tracking_public_id TEXT,
  ADD COLUMN IF NOT EXISTS tracking_secret_hash TEXT,
  ADD COLUMN IF NOT EXISTS tracking_secret_created_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS mimosaas_website_connections_tracking_public_id_unique
ON mimosaas_website_connections (tracking_public_id)
WHERE tracking_public_id IS NOT NULL;
