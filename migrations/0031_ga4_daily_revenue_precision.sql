-- Preserve provider precision without rewriting the existing heap or inventing
-- discarded fractions. Historical repair requires exact, separately scoped evidence.
-- Startup owns the transaction/advisory lock. Repeated execution is a no-op.
DO $$
DECLARE
  column_type OID;
  column_modifier INTEGER;
BEGIN
  SELECT atttypid, atttypmod INTO column_type, column_modifier FROM pg_attribute
    WHERE attrelid = 'ga4_daily_metrics'::regclass AND attname = 'revenue' AND NOT attisdropped;
  IF column_type IS DISTINCT FROM 'numeric'::regtype::oid THEN
    RAISE EXCEPTION 'Unexpected GA4 daily revenue column type';
  END IF;
  IF column_modifier = ((15 << 16) | 2) + 4 THEN
    ALTER TABLE ga4_daily_metrics ALTER COLUMN revenue TYPE NUMERIC;
  ELSIF column_modifier IS DISTINCT FROM -1 THEN
    RAISE EXCEPTION 'Unexpected GA4 daily revenue precision';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ga4_daily_metrics'::regclass AND conname = 'ga4_daily_metrics_revenue_finite') THEN
    ALTER TABLE ga4_daily_metrics ADD CONSTRAINT ga4_daily_metrics_revenue_finite
      CHECK (revenue > -10000000000000 AND revenue < 10000000000000) NOT VALID;
  END IF;
END $$;
