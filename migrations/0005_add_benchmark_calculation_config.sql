-- Add calculation_config to store source selection and calculation inputs for campaign-level Benchmarks
ALTER TABLE benchmarks
ADD COLUMN IF NOT EXISTS calculation_config jsonb;


