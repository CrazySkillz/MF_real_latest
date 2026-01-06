-- Add calculation_config to store source selection and calculation inputs for campaign-level KPIs
ALTER TABLE kpis
ADD COLUMN IF NOT EXISTS calculation_config jsonb;


