-- KPI Campaign Scope Migration
-- Run this directly on the production database

-- Add the new columns
ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'kpis' 
AND column_name IN ('apply_to', 'specific_campaign_id');

