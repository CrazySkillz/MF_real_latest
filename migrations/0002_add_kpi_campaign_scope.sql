-- Add campaign scope fields to KPIs table
-- This allows KPIs to be tracked for all campaigns (aggregate) or specific campaigns

ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;

-- Add comments for documentation
COMMENT ON COLUMN kpis.apply_to IS 'Scope of KPI: all (aggregate) or specific (individual campaign)';
COMMENT ON COLUMN kpis.specific_campaign_id IS 'LinkedIn campaign name when apply_to is specific';

