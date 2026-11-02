-- Preserve provider micros; never reconstruct already discarded fractions.
-- Removing the shared column's typmod avoids rewriting its large existing heap.
-- Validate the new constraint after deployment outside the startup transaction.
-- Startup owns the transaction/advisory lock. Repeated execution is a no-op.
DO $$
DECLARE
  target RECORD;
  column_type OID;
  column_modifier INTEGER;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('google_ads_daily_metrics', 10, 14),
    ('ga4_google_ads_spend_daily_metrics', 12, 16),
    ('spend_records', 12, 16)
  ) AS columns_to_widen(table_name, old_precision, new_precision)
  LOOP
    SELECT atttypid, atttypmod INTO column_type, column_modifier FROM pg_attribute
      WHERE attrelid = format('%I', target.table_name)::regclass
        AND attname = 'spend' AND NOT attisdropped;
    IF column_type = 'text'::regtype::oid AND target.table_name = 'google_ads_daily_metrics' THEN
      LOCK TABLE google_ads_daily_metrics IN ACCESS EXCLUSIVE MODE;
      IF EXISTS (SELECT 1 FROM google_ads_daily_metrics LIMIT 1) THEN
        RAISE EXCEPTION 'Populated legacy Google Ads spend requires separate review';
      END IF;
      ALTER TABLE google_ads_daily_metrics ALTER COLUMN spend TYPE NUMERIC(14,6) USING spend::numeric;
      CONTINUE;
    ELSIF column_type IS DISTINCT FROM 'numeric'::regtype::oid THEN
      RAISE EXCEPTION 'Unexpected spend column type for %', target.table_name;
    END IF;
    IF target.table_name = 'spend_records' THEN
      IF column_modifier = ((12 << 16) | 2) + 4 OR column_modifier = ((16 << 16) | 6) + 4 THEN
        ALTER TABLE spend_records ALTER COLUMN spend TYPE NUMERIC;
      ELSIF column_modifier IS DISTINCT FROM -1 THEN
        RAISE EXCEPTION 'Unexpected spend column precision for %', target.table_name;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='spend_records'::regclass AND conname='spend_records_spend_micros') THEN
        ALTER TABLE spend_records ADD CONSTRAINT spend_records_spend_micros
          CHECK (spend > -10000000000 AND spend < 10000000000 AND spend = round(spend,6)) NOT VALID;
      END IF;
      CONTINUE;
    END IF;
    IF column_modifier = ((target.old_precision << 16) | 2) + 4 THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN spend TYPE NUMERIC(%s, 6)', target.table_name, target.new_precision);
    ELSIF column_modifier IS DISTINCT FROM ((target.new_precision << 16) | 6) + 4 THEN
      RAISE EXCEPTION 'Unexpected spend column precision for %', target.table_name;
    END IF;
  END LOOP;
END $$;
