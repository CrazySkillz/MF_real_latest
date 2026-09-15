import { createHash } from "node:crypto";
import { pool } from "../server/db";

const CAMPAIGN_ID = String(process.env.GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID || "").trim();
if (!pool) throw new Error("DATABASE_URL is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");

const opaque = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const activeDuplicates = await client.query(`
    SELECT LOWER(COALESCE(metric, '')) AS metric_key, LOWER(name) AS name_key,
      benchmark_value, UPPER(unit) AS unit_key, COALESCE(period, '') AS period_key,
      ARRAY_AGG(id ORDER BY created_at) AS ids, COUNT(*)::int AS row_count
    FROM benchmarks
    WHERE campaign_id = $1 AND platform_type = 'google_analytics' AND status = 'active'
    GROUP BY LOWER(COALESCE(metric, '')), LOWER(name), benchmark_value, UPPER(unit), COALESCE(period, '')
    HAVING COUNT(*) > 1
  `, [CAMPAIGN_ID]);
  const historyDuplicates = await client.query(`
    SELECT h.benchmark_id, b.metric, DATE(h.recorded_at) AS recorded_date,
      COALESCE(h.notes, '') AS scope_note, COUNT(*)::int AS row_count,
      MIN(h.recorded_at) AS first_recorded_at, MAX(h.recorded_at) AS last_recorded_at,
      ARRAY_AGG(h.id ORDER BY h.recorded_at) AS ids
    FROM benchmark_history h
    JOIN benchmarks b ON b.id = h.benchmark_id
    WHERE b.campaign_id = $1 AND b.platform_type = 'google_analytics' AND b.status = 'active'
    GROUP BY h.benchmark_id, b.metric, DATE(h.recorded_at), COALESCE(h.notes, '')
    HAVING COUNT(*) > 1
    ORDER BY recorded_date, h.benchmark_id
  `, [CAMPAIGN_ID]);
  const historyInventory = await client.query(`
    SELECT h.benchmark_id, b.metric, COUNT(*)::int AS history_count,
      COUNT(DISTINCT (DATE(h.recorded_at), COALESCE(h.notes, '')))::int AS distinct_date_scope_count,
      MIN(h.recorded_at) AS first_recorded_at, MAX(h.recorded_at) AS last_recorded_at
    FROM benchmark_history h
    JOIN benchmarks b ON b.id = h.benchmark_id
    WHERE b.campaign_id = $1 AND b.platform_type = 'google_analytics' AND b.status = 'active'
    GROUP BY h.benchmark_id, b.metric
    ORDER BY b.metric, h.benchmark_id
  `, [CAMPAIGN_ID]);
  await client.query("ROLLBACK");
  console.log(JSON.stringify({
    success: true,
    mode: "database_read_only",
    campaignHash: opaque(CAMPAIGN_ID),
    activeExactDuplicateGroups: activeDuplicates.rows.map((row: any) => ({
      metric: row.metric_key,
      target: Number(row.benchmark_value),
      unit: row.unit_key,
      period: row.period_key,
      rowCount: Number(row.row_count),
      benchmarkHashes: row.ids.map(opaque),
    })),
    historyDuplicateGroups: historyDuplicates.rows.map((row: any) => ({
      benchmarkHash: opaque(row.benchmark_id),
      metric: row.metric,
      recordedDate: row.recorded_date,
      scopeNoteHash: opaque(row.scope_note),
      rowCount: Number(row.row_count),
      firstRecordedAt: row.first_recorded_at,
      lastRecordedAt: row.last_recorded_at,
      historyHashes: row.ids.map(opaque),
    })),
    historyInventory: historyInventory.rows.map((row: any) => ({
      benchmarkHash: opaque(row.benchmark_id),
      metric: row.metric,
      historyCount: Number(row.history_count),
      distinctDateScopeCount: Number(row.distinct_date_scope_count),
      firstRecordedAt: row.first_recorded_at,
      lastRecordedAt: row.last_recorded_at,
    })),
  }, null, 2));
} finally {
  client.release();
  await pool.end();
}
