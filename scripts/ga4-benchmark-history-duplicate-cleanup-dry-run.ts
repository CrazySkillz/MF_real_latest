import { createHash } from "node:crypto";
import { pool } from "../server/db";

const CAMPAIGN_ID = String(process.env.GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID || "").trim();
if (!pool) throw new Error("DATABASE_URL is required");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");

const opaque = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const asIso = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? String(value || "") : parsed.toISOString();
};

const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const result = await client.query(`
    WITH duplicate_groups AS (
      SELECT h.benchmark_id, DATE(h.recorded_at) AS recorded_date, COALESCE(h.notes, '') AS scope_note
      FROM benchmark_history h
      JOIN benchmarks b ON b.id = h.benchmark_id
      WHERE b.campaign_id = $1
        AND b.platform_type = 'google_analytics'
        AND b.status = 'active'
      GROUP BY h.benchmark_id, DATE(h.recorded_at), COALESCE(h.notes, '')
      HAVING COUNT(*) > 1
    )
    SELECT h.id, h.benchmark_id, b.metric, DATE(h.recorded_at)::text AS recorded_date,
      h.current_value, h.benchmark_value, h.variance, h.performance_rating,
      h.recorded_at, COALESCE(h.notes, '') AS scope_note
    FROM duplicate_groups d
    JOIN benchmark_history h
      ON h.benchmark_id = d.benchmark_id
      AND DATE(h.recorded_at) = d.recorded_date
      AND COALESCE(h.notes, '') = d.scope_note
    JOIN benchmarks b ON b.id = h.benchmark_id
    ORDER BY h.benchmark_id, recorded_date, scope_note, h.id
  `, [CAMPAIGN_ID]);

  const groups = new Map<string, any[]>();
  for (const row of result.rows) {
    const key = JSON.stringify([row.benchmark_id, row.recorded_date, row.scope_note]);
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  const evidence = [...groups.values()].map((rows) => {
    const ordered = [...rows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
    const semanticHashes = ordered.map((row) => opaque(JSON.stringify({
      benchmarkId: row.benchmark_id,
      currentValue: String(row.current_value),
      benchmarkValue: String(row.benchmark_value),
      variance: String(row.variance),
      performanceRating: row.performance_rating,
      recordedAt: asIso(row.recorded_at),
      notes: row.scope_note,
    })));
    return {
      benchmarkHash: opaque(ordered[0]?.benchmark_id),
      metric: ordered[0]?.metric,
      recordedDate: ordered[0]?.recorded_date,
      scopeNoteHash: opaque(ordered[0]?.scope_note),
      automaticGA4Daily: String(ordered[0]?.scope_note || "").startsWith("auto:ga4_daily:"),
      rowCount: ordered.length,
      semanticIdentical: new Set(semanticHashes).size === 1,
      semanticHashes,
      retainCanonicalHistoryHash: opaque(ordered[0]?.id),
      deleteRedundantHistoryHashes: ordered.slice(1).map((row) => opaque(row.id)),
    };
  });

  check(evidence.length === 2, `Expected exactly two duplicate groups, found ${evidence.length}`);
  check(evidence.every((group) => group.rowCount === 2), "A duplicate group does not contain exactly two rows");
  check(evidence.every((group) => group.automaticGA4Daily), "A duplicate group is not reserved automatic GA4 history");
  check(evidence.every((group) => group.semanticIdentical), "A duplicate group contains semantically different rows");
  check(evidence.reduce((count, group) => count + group.deleteRedundantHistoryHashes.length, 0) === 2,
    "The cleanup boundary is not exactly two redundant rows");

  await client.query("ROLLBACK");
  console.log(JSON.stringify({
    success: true,
    mode: "database_read_only_cleanup_dry_run",
    campaignHash: opaque(CAMPAIGN_ID),
    duplicateGroupCount: evidence.length,
    totalRowsInDuplicateGroups: evidence.reduce((count, group) => count + group.rowCount, 0),
    canonicalRowsToRetain: evidence.length,
    redundantRowsToDelete: evidence.reduce((count, group) => count + group.deleteRedundantHistoryHashes.length, 0),
    cleanupEligible: true,
    groups: evidence,
  }, null, 2));
} finally {
  client.release();
  await pool.end();
}
