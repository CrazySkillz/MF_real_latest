-- Widen only persisted GA4 facts and their cross-platform snapshot count.
-- Existing INTEGER values are exactly representable as DOUBLE PRECISION, matching
-- the application's JS number contract. Do not infer or backfill lost fractions.
-- The caller owns the startup transaction/advisory lock. Repeated boots are no-ops.
DO $$
DECLARE
  target RECORD;
  column_type OID;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('ga4_daily_metrics', 'conversions', 'ga4_daily_metrics_conversions_finite'),
    ('metric_snapshots', 'total_conversions', 'metric_snapshots_total_conversions_finite')
  ) AS columns_to_widen(table_name, column_name, constraint_name)
  LOOP
    SELECT atttypid INTO column_type FROM pg_attribute
      WHERE attrelid = format('%I', target.table_name)::regclass
        AND attname = target.column_name AND NOT attisdropped;
    IF column_type = 'integer'::regtype THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE DOUBLE PRECISION USING %I::double precision',
        target.table_name, target.column_name, target.column_name);
    ELSIF column_type IS DISTINCT FROM 'double precision'::regtype::oid THEN
      RAISE EXCEPTION 'Unexpected conversion column type for %.%', target.table_name, target.column_name;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = format('%I', target.table_name)::regclass AND conname = target.constraint_name) THEN
      EXECUTE format($check$ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I > '-Infinity'::double precision AND %I < 'Infinity'::double precision)$check$,
        target.table_name, target.constraint_name, target.column_name, target.column_name);
    END IF;
  END LOOP;
END $$;
