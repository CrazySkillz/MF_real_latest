-- Migration: Add daily granularity for spend and revenue tracking
-- Date: 2026-02-12
-- Purpose: Enable daily spend/revenue analytics for Insights tab and better financial reporting
-- NOTE: Tables spend_records and revenue_records already exist in schema, this migration adds:
--   1. source_type column for tracking data provenance
--   2. Indexes for performance
--   3. Backfill scripts for existing data

-- ============================================
-- 1. ADD SOURCE_TYPE COLUMN TO SPEND_RECORDS
-- ============================================

-- Add source_type column to track data provenance
ALTER TABLE spend_records 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

-- Backfill source_type from spend_sources table (cast to handle type mismatch)
UPDATE spend_records sr
SET source_type = COALESCE(ss.source_type, 'unknown')
FROM spend_sources ss
WHERE sr.spend_source_id::text = ss.id::text
  AND sr.source_type IS NULL;

-- For records without a matching source, set to 'unknown'
UPDATE spend_records
SET source_type = 'unknown'
WHERE source_type IS NULL;

-- Set NOT NULL constraint after backfill
ALTER TABLE spend_records 
ALTER COLUMN source_type SET DEFAULT 'unknown';

-- Add comment
COMMENT ON COLUMN spend_records.source_type IS 'Type of spend source: google_sheets, csv, paste, google_ads_api, meta_api, linkedin_api, legacy_cumulative';

-- ============================================
-- 2. ADD SOURCE_TYPE COLUMN TO REVENUE_RECORDS
-- ============================================

-- Add source_type column to track data provenance
ALTER TABLE revenue_records 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

-- Backfill source_type from revenue_sources table (cast to handle type mismatch)
UPDATE revenue_records rr
SET source_type = COALESCE(rs.source_type, 'unknown')
FROM revenue_sources rs
WHERE rr.revenue_source_id::text = rs.id::text
  AND rr.source_type IS NULL;

-- For records without a matching source, set to 'unknown'
UPDATE revenue_records
SET source_type = 'unknown'
WHERE source_type IS NULL;

-- Set default for future inserts
ALTER TABLE revenue_records 
ALTER COLUMN source_type SET DEFAULT 'unknown';

-- Add comment
COMMENT ON COLUMN revenue_records.source_type IS 'Type of revenue source: ga4, linkedin, hubspot, salesforce, shopify, manual, csv, google_sheets, legacy_cumulative';

-- ============================================
-- 3. ADD INDEXES FOR PERFORMANCE
-- ============================================

-- Spend records indexes
CREATE INDEX IF NOT EXISTS idx_spend_records_campaign_date ON spend_records(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_spend_records_source_type ON spend_records(source_type);
CREATE INDEX IF NOT EXISTS idx_spend_records_campaign_id ON spend_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_spend_records_date_range ON spend_records(campaign_id, date DESC) WHERE spend::DECIMAL(15,2) > 0;

-- Revenue records indexes
CREATE INDEX IF NOT EXISTS idx_revenue_records_campaign_date ON revenue_records(campaign_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_records_source_type ON revenue_records(source_type);
CREATE INDEX IF NOT EXISTS idx_revenue_records_campaign_id ON revenue_records(campaign_id);
CREATE INDEX IF NOT EXISTS idx_revenue_records_date_range ON revenue_records(campaign_id, date DESC) WHERE revenue::DECIMAL(15,2) > 0;

-- ============================================
-- 4. BACKFILL LINKEDIN DAILY METRICS (SPEND)
-- ============================================

-- LinkedIn already has daily spend in linkedin_daily_metrics
-- Backfill spend_records from linkedin_daily_metrics (if data exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'linkedin_daily_metrics') THEN
    INSERT INTO spend_records (campaign_id, date, spend, spend_source_id, source_type, currency)
    SELECT 
      campaign_id,
      date as date,
      LEAST(spend::DECIMAL(12,2), 9999999999.99) as spend,
      'linkedin_daily_metrics' as spend_source_id,
      'linkedin_api' as source_type,
      'USD' as currency
    FROM linkedin_daily_metrics
    WHERE spend IS NOT NULL AND spend::DECIMAL(12,2) > 0
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Backfilled LinkedIn spend records';
  ELSE
    RAISE NOTICE 'Skipped LinkedIn backfill - table does not exist';
  END IF;
END $$;

-- ============================================
-- 5. BACKFILL GA4 DAILY METRICS (REVENUE)
-- ============================================

-- GA4 already has daily revenue in ga4_daily_metrics
-- Backfill revenue_records from ga4_daily_metrics (if data exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ga4_daily_metrics') 
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ga4_daily_metrics' AND column_name = 'revenue') THEN
    INSERT INTO revenue_records (campaign_id, date, revenue, revenue_source_id, source_type, currency)
    SELECT 
      campaign_id,
      date as date,
      LEAST(revenue::DECIMAL(15,2), 9999999999.99) as revenue,
      'ga4_daily_metrics' as revenue_source_id,
      'ga4' as source_type,
      'USD' as currency
    FROM ga4_daily_metrics
    WHERE revenue IS NOT NULL AND revenue::DECIMAL(15,2) > 0
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Backfilled GA4 revenue records';
  ELSE
    RAISE NOTICE 'Skipped GA4 backfill - table or column does not exist';
  END IF;
END $$;

-- ============================================
-- 6. BACKFILL LEGACY CUMULATIVE SPEND
-- ============================================

-- Skip legacy backfill - will be populated by schedulers going forward
-- For campaigns with cumulative spend but no daily records, those will be added
-- on next data refresh cycle

-- ============================================
-- 7. BACKFILL LEGACY CUMULATIVE REVENUE
-- ============================================

-- Skip legacy backfill - will be populated by schedulers going forward
-- For campaigns with cumulative revenue but no daily records, those will be added
-- on next data refresh cycle

-- ============================================
-- 8. VERIFICATION QUERIES
-- ============================================

-- Count records by source type
DO $$
DECLARE
  spend_count INTEGER;
  revenue_count INTEGER;
  linkedin_spend_count INTEGER;
  ga4_revenue_count INTEGER;
  legacy_spend_count INTEGER;
  legacy_revenue_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO spend_count FROM spend_records;
  SELECT COUNT(*) INTO revenue_count FROM revenue_records;
  SELECT COUNT(*) INTO linkedin_spend_count FROM spend_records WHERE source_type = 'linkedin_api';
  SELECT COUNT(*) INTO ga4_revenue_count FROM revenue_records WHERE source_type = 'ga4';
  SELECT COUNT(*) INTO legacy_spend_count FROM spend_records WHERE source_type = 'legacy_cumulative';
  SELECT COUNT(*) INTO legacy_revenue_count FROM revenue_records WHERE source_type = 'legacy_cumulative';
  
  RAISE NOTICE 'Migration Complete:';
  RAISE NOTICE '  Total spend records: %', spend_count;
  RAISE NOTICE '  Total revenue records: %', revenue_count;
  RAISE NOTICE '  LinkedIn spend records: %', linkedin_spend_count;
  RAISE NOTICE '  GA4 revenue records: %', ga4_revenue_count;
  RAISE NOTICE '  Legacy spend records: %', legacy_spend_count;
  RAISE NOTICE '  Legacy revenue records: %', legacy_revenue_count;
END $$;

-- Sample queries to verify data
-- SELECT campaign_id, COUNT(*) as days, SUM(spend) as total_spend 
-- FROM spend_records 
-- GROUP BY campaign_id 
-- ORDER BY total_spend DESC 
-- LIMIT 5;

-- SELECT campaign_id, COUNT(*) as days, SUM(revenue) as total_revenue 
-- FROM revenue_records 
-- GROUP BY campaign_id 
-- ORDER BY total_revenue DESC 
-- LIMIT 5;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
