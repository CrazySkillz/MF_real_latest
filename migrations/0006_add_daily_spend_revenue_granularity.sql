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

-- Backfill source_type from spend_sources table
UPDATE spend_records sr
SET source_type = COALESCE(ss.source_type, 'unknown')
FROM spend_sources ss
WHERE sr.spend_source_id = ss.id
  AND sr.source_type IS NULL;

-- Set NOT NULL constraint after backfill
ALTER TABLE spend_records 
ALTER COLUMN source_type SET NOT NULL;

-- Add comment
COMMENT ON COLUMN spend_records.source_type IS 'Type of spend source: google_sheets, csv, paste, google_ads_api, meta_api, linkedin_api, legacy_cumulative';

-- ============================================
-- 2. ADD SOURCE_TYPE COLUMN TO REVENUE_RECORDS
-- ============================================

-- Add source_type column to track data provenance
ALTER TABLE revenue_records 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);

-- Backfill source_type from revenue_sources table
UPDATE revenue_records rr
SET source_type = COALESCE(rs.source_type, 'unknown')
FROM revenue_sources rs
WHERE rr.revenue_source_id = rs.id
  AND rr.source_type IS NULL;

-- Set NOT NULL constraint after backfill
ALTER TABLE revenue_records 
ALTER COLUMN source_type SET NOT NULL;

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
-- Backfill spend_records from linkedin_daily_metrics
INSERT INTO spend_records (campaign_id, date, spend, spend_source_id, source_type, currency)
SELECT 
  campaign_id,
  date as date,  -- Already in YYYY-MM-DD format
  COALESCE(spend::DECIMAL(12,2), 0) as spend,
  'linkedin_daily_metrics' as spend_source_id,  -- Use table name as pseudo-source
  'linkedin_api' as source_type,
  'USD' as currency  -- LinkedIn reports in USD by default
FROM linkedin_daily_metrics
WHERE spend IS NOT NULL AND spend::DECIMAL(12,2) > 0
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. BACKFILL GA4 DAILY FACTS (REVENUE)
-- ============================================

-- GA4 already has daily revenue in ga4_daily_facts
-- Backfill revenue_records from ga4_daily_facts  
INSERT INTO revenue_records (campaign_id, date, revenue, revenue_source_id, source_type, currency)
SELECT 
  campaign_id,
  date as date,  -- Already in YYYY-MM-DD format
  COALESCE(revenue::DECIMAL(12,2), 0) as revenue,
  'ga4_daily_facts' as revenue_source_id,  -- Use table name as pseudo-source
  'ga4' as source_type,
  'USD' as currency  -- GA4 reports in configured currency
FROM ga4_daily_facts
WHERE revenue IS NOT NULL AND revenue::DECIMAL(12,2) > 0
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. BACKFILL LEGACY CUMULATIVE SPEND
-- ============================================

-- For campaigns with cumulative spend but no daily records
-- Create a single record dated at campaign creation
INSERT INTO spend_records (campaign_id, date, spend, spend_source_id, source_type, currency)
SELECT 
  id as campaign_id,
  COALESCE(created_at::DATE::TEXT, CURRENT_DATE::TEXT) as date,
  spend::DECIMAL(12,2) as spend,
  'legacy_cumulative' as spend_source_id,
  'legacy_cumulative' as source_type,
  COALESCE(currency, 'USD') as currency
FROM campaigns
WHERE spend IS NOT NULL 
  AND spend::DECIMAL(12,2) > 0
  AND id NOT IN (
    -- Exclude campaigns that already have spend records
    SELECT DISTINCT campaign_id FROM spend_records
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. BACKFILL LEGACY CUMULATIVE REVENUE
-- ============================================

-- For campaigns with cumulative revenue but no daily records
-- Create a single record dated at campaign creation
INSERT INTO revenue_records (campaign_id, date, revenue, revenue_source_id, source_type, currency)
SELECT 
  id as campaign_id,
  COALESCE(created_at::DATE::TEXT, CURRENT_DATE::TEXT) as date,
  revenue::DECIMAL(12,2) as revenue,
  'legacy_cumulative' as revenue_source_id,
  'legacy_cumulative' as source_type,
  COALESCE(currency, 'USD') as currency
FROM campaigns
WHERE revenue IS NOT NULL 
  AND revenue::DECIMAL(12,2) > 0
  AND id NOT IN (
    -- Exclude campaigns that already have revenue records
    SELECT DISTINCT campaign_id FROM revenue_records
  )
ON CONFLICT DO NOTHING;

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
