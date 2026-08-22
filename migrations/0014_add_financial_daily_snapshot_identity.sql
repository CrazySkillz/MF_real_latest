-- Add a nullable reporting-day identity for forward-only financial snapshots.
-- Existing snapshot rows remain unchanged because no backfill is performed.

ALTER TABLE metric_snapshots
ADD COLUMN IF NOT EXISTS reporting_date TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_financial_day_unique
ON metric_snapshots (campaign_id, reporting_date)
WHERE snapshot_type = 'financial_daily' AND reporting_date IS NOT NULL;
