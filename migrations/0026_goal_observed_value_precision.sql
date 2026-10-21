-- Preserve fractional observed values; targets, currency outputs and percentage
-- precision remain unchanged. No backfill can recover previously rounded data.
-- Startup owns the transaction. No-op for already unconstrained NUMERIC columns.
DO $$
DECLARE
  target RECORD;
  column_type OID;
  column_modifier INTEGER;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('kpis', 'current_value', 'kpis_current_value_finite'),
    ('kpis', 'last_computed_value', 'kpis_last_computed_value_finite'),
    ('kpi_periods', 'final_value', 'kpi_periods_final_value_finite'),
    ('kpi_periods', 'previous_period_value', 'kpi_periods_previous_period_value_finite'),
    ('kpi_periods', 'change_amount', 'kpi_periods_change_amount_finite'),
    ('kpi_progress', 'value', 'kpi_progress_value_finite'),
    ('kpi_progress', 'rolling_average_7d', 'kpi_progress_rolling_average_7d_finite'),
    ('kpi_progress', 'rolling_average_30d', 'kpi_progress_rolling_average_30d_finite'),
    ('kpi_alerts', 'current_value', 'kpi_alerts_current_value_finite'),
    ('benchmarks', 'current_value', 'benchmarks_current_value_finite'),
    ('benchmark_history', 'current_value', 'benchmark_history_current_value_finite')
  ) AS columns_to_widen(table_name, column_name, constraint_name)
  LOOP
    SELECT atttypid, atttypmod INTO column_type, column_modifier FROM pg_attribute
      WHERE attrelid = format('%I', target.table_name)::regclass
        AND attname = target.column_name AND NOT attisdropped;
    IF column_type IS DISTINCT FROM 'numeric'::regtype::oid THEN
      RAISE EXCEPTION 'Unexpected observed value type for %.%', target.table_name, target.column_name;
    END IF;
    IF column_modifier <> -1 THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE NUMERIC', target.table_name, target.column_name);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid = format('%I', target.table_name)::regclass AND conname = target.constraint_name) THEN
      EXECUTE format($check$ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I > '-Infinity'::numeric AND %I < 'Infinity'::numeric)$check$,
        target.table_name, target.constraint_name, target.column_name, target.column_name);
    END IF;
  END LOOP;
END $$;
