-- Add applyTo and specificCampaignId fields to benchmarks table
-- This allows benchmarks to be scoped to all campaigns or specific campaigns

ALTER TABLE benchmarks 
ADD COLUMN IF NOT EXISTS apply_to TEXT DEFAULT 'all',
ADD COLUMN IF NOT EXISTS specific_campaign_id TEXT;

-- Add comment for documentation
COMMENT ON COLUMN benchmarks.apply_to IS 'Scope of benchmark: "all" for all campaigns, "specific" for specific campaign';
COMMENT ON COLUMN benchmarks.specific_campaign_id IS 'Campaign ID when apply_to is "specific", NULL when apply_to is "all"';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_benchmarks_apply_to ON benchmarks(apply_to);
CREATE INDEX IF NOT EXISTS idx_benchmarks_specific_campaign ON benchmarks(specific_campaign_id) WHERE specific_campaign_id IS NOT NULL;

