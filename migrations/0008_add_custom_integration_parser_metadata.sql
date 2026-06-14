-- Persist PDF parser trust metadata for Custom Integration imports.

ALTER TABLE custom_integration_metrics
ADD COLUMN IF NOT EXISTS parser_metadata jsonb;
