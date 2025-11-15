-- Add conversion_value column to campaigns table
-- This migration adds the conversionValue field for ROI calculations

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS conversion_value DECIMAL(10, 2);

-- Add comment for documentation
COMMENT ON COLUMN campaigns.conversion_value IS 'Average revenue per conversion for ROI and ROAS calculations';

