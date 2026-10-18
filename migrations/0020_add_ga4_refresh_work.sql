CREATE TABLE IF NOT EXISTS ga4_refresh_work (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  reporting_date TEXT NOT NULL,
  scope_hash TEXT NOT NULL,
  scope JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  lease_token TEXT,
  lease_expires_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ga4_refresh_work_state CHECK (
    (status = 'pending' AND lease_token IS NULL AND lease_expires_at IS NULL AND completed_at IS NULL)
    OR (status = 'running' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL AND started_at IS NOT NULL AND completed_at IS NULL)
    OR (status = 'completed' AND lease_token IS NULL AND lease_expires_at IS NULL AND completed_at IS NOT NULL)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS ga4_refresh_work_identity
ON ga4_refresh_work (campaign_id, due_at, reporting_date, scope_hash);
CREATE UNIQUE INDEX IF NOT EXISTS ga4_refresh_work_running_campaign
ON ga4_refresh_work (campaign_id) WHERE status = 'running';
