-- Targeted cleanup for orphan GA4 synthetic imported revenue rows.
--
-- Boundary proven by read-only inventory on 2026-06-18:
-- - revenue_records.revenue_source_id = 'ga4_daily_metrics'
-- - no matching revenue_sources.id = 'ga4_daily_metrics'
-- - affected campaign: 247d8ebf-9554-45b9-8a50-482ec25da5a7 (ga4_brand)
-- - affected row IDs:
--   5cc4657b-f4df-4709-8d10-5d9b7639633c
--   ec2552dc-cbcf-4d3b-b987-c61aa691bf82
--   6b6111cc-4d53-4e88-a41e-5386acbabe7a
--
-- Do not broaden this cleanup without a new read-only inventory.
WITH deleted AS (
  DELETE FROM revenue_records rr
  WHERE rr.id IN (
    '5cc4657b-f4df-4709-8d10-5d9b7639633c',
    'ec2552dc-cbcf-4d3b-b987-c61aa691bf82',
    '6b6111cc-4d53-4e88-a41e-5386acbabe7a'
  )
  AND rr.campaign_id = '247d8ebf-9554-45b9-8a50-482ec25da5a7'
  AND rr.revenue_source_id = 'ga4_daily_metrics'
  AND NOT EXISTS (
    SELECT 1
    FROM revenue_sources rs
    WHERE rs.id::text = rr.revenue_source_id
  )
  RETURNING rr.id
)
SELECT count(*) AS deleted_ga4_daily_metrics_orphan_revenue_records
FROM deleted;
