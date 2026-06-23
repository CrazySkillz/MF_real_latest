-- Widen absolute alert and Benchmark value fields for enterprise-scale revenue/spend amounts.
-- This is additive/widening only: percentage fields such as variance remain unchanged.

ALTER TABLE kpi_alerts
  ALTER COLUMN current_value TYPE numeric(18,2),
  ALTER COLUMN target_value TYPE numeric(18,2),
  ALTER COLUMN threshold_value TYPE numeric(18,2);

ALTER TABLE benchmarks
  ALTER COLUMN benchmark_value TYPE numeric(18,2),
  ALTER COLUMN current_value TYPE numeric(18,2),
  ALTER COLUMN alert_threshold TYPE numeric(18,2);

ALTER TABLE benchmark_history
  ALTER COLUMN current_value TYPE numeric(18,2),
  ALTER COLUMN benchmark_value TYPE numeric(18,2);
