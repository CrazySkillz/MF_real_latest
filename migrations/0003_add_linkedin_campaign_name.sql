-- Add linkedInCampaignName field to store the LinkedIn campaign name for display
ALTER TABLE benchmarks 
ADD COLUMN IF NOT EXISTS linkedin_campaign_name TEXT;

COMMENT ON COLUMN benchmarks.linkedin_campaign_name IS 'LinkedIn campaign name for display purposes when benchmark is for a specific LinkedIn campaign';

