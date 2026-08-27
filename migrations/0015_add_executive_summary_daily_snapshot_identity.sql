CREATE UNIQUE INDEX IF NOT EXISTS metric_snapshots_executive_summary_day_unique
ON metric_snapshots (campaign_id, reporting_date)
WHERE snapshot_type = 'executive_summary_daily' AND reporting_date IS NOT NULL;
