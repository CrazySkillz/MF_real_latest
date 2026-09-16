import { createHash } from "node:crypto";
import { pool } from "../server/db";

const BASE_URL = String(process.env.GA4_BENCHMARK_VALIDATION_BASE_URL || "https://marketforensics.onrender.com").replace(/\/$/, "");
const EXPECTED_SHA = String(process.env.GA4_BENCHMARK_VALIDATION_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID || "").trim();
const CONFIRM = String(process.env.GA4_BENCHMARK_DUPLICATE_CLEANUP_CONFIRM || "").trim();
const EXPECTED_RETAIN_HASHES = String(process.env.GA4_BENCHMARK_DUPLICATE_RETAIN_HASHES || "").split(",").map((value) => value.trim()).filter(Boolean).sort();
const EXPECTED_DELETE_HASHES = String(process.env.GA4_BENCHMARK_DUPLICATE_DELETE_HASHES || "").split(",").map((value) => value.trim()).filter(Boolean).sort();

if (!pool) throw new Error("DATABASE_URL is required");
if (!/^[0-9a-f]{40}$/i.test(EXPECTED_SHA)) throw new Error("GA4_BENCHMARK_VALIDATION_EXPECTED_SHA must be a full Git SHA");
if (!/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID)) throw new Error("GA4_BENCHMARK_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");
if (CONFIRM !== "DELETE_EXACT_TWO_REDUNDANT_GA4_BENCHMARK_HISTORY_ROWS") throw new Error("Cleanup confirmation phrase is missing");
if (EXPECTED_RETAIN_HASHES.length !== 2 || EXPECTED_DELETE_HASHES.length !== 2) throw new Error("Exactly two retain and two delete hashes are required");

const opaque = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const asIso = (value: unknown) => {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? String(value || "") : parsed.toISOString();
};
const sorted = (values: string[]) => [...values].sort();
const sameStrings = (left: string[], right: string[]) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const definitionSignature = (rows: any[]) => JSON.stringify(rows.map((row) => ({
  id: row.id,
  campaignId: row.campaign_id,
  platformType: row.platform_type,
  status: row.status,
  metric: row.metric,
  name: row.name,
  benchmarkValue: String(row.benchmark_value),
  currentValue: String(row.current_value),
  unit: row.unit,
  updatedAt: asIso(row.updated_at),
  lastUpdated: asIso(row.last_updated),
})));

const duplicateRowsSql = `
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
`;

const buildCleanupPlan = (rows: any[]) => {
  const groups = new Map<string, any[]>();
  for (const row of rows) {
    const key = JSON.stringify([row.benchmark_id, row.recorded_date, row.scope_note]);
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const plans = [...groups.values()].map((groupRows) => {
    const ordered = [...groupRows].sort((left, right) => String(left.id).localeCompare(String(right.id)));
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
      benchmarkId: String(ordered[0]?.benchmark_id || ""),
      benchmarkHash: opaque(ordered[0]?.benchmark_id),
      metric: ordered[0]?.metric,
      recordedDate: ordered[0]?.recorded_date,
      scopeNoteHash: opaque(ordered[0]?.scope_note),
      automaticGA4Daily: String(ordered[0]?.scope_note || "").startsWith("auto:ga4_daily:"),
      rowCount: ordered.length,
      semanticHashes,
      semanticIdentical: new Set(semanticHashes).size === 1,
      retainId: String(ordered[0]?.id || ""),
      retainHash: opaque(ordered[0]?.id),
      deleteIds: ordered.slice(1).map((row) => String(row.id)),
      deleteHashes: ordered.slice(1).map((row) => opaque(row.id)),
    };
  });
  check(plans.length === 2, `Expected exactly two duplicate groups, found ${plans.length}`);
  check(plans.every((plan) => plan.rowCount === 2), "A duplicate group does not contain exactly two rows");
  check(plans.every((plan) => plan.automaticGA4Daily), "A duplicate group is not reserved automatic GA4 history");
  check(plans.every((plan) => plan.semanticIdentical), "A duplicate group contains semantically different rows");
  const retainHashes = plans.map((plan) => plan.retainHash);
  const deleteHashes = plans.flatMap((plan) => plan.deleteHashes);
  check(sameStrings(retainHashes, EXPECTED_RETAIN_HASHES), "Canonical retain hashes changed since the dry run");
  check(sameStrings(deleteHashes, EXPECTED_DELETE_HASHES), "Redundant delete hashes changed since the dry run");
  return plans;
};

const healthResponse = await fetch(`${BASE_URL}/api/health`);
const health: any = await healthResponse.json().catch(() => null);
check(healthResponse.ok && health?.commit === EXPECTED_SHA, `Deployed SHA mismatch: ${String(health?.commit || "unavailable")}`);

const client = await pool.connect();
let committed = false;
try {
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

  const candidates = await client.query(duplicateRowsSql, [CAMPAIGN_ID]);
  const candidateBenchmarkIds = sorted([...new Set(candidates.rows.map((row: any) => String(row.benchmark_id)))]);
  check(candidateBenchmarkIds.length === 2, `Expected duplicate history for two Benchmarks, found ${candidateBenchmarkIds.length}`);
  for (const benchmarkId of candidateBenchmarkIds) {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`benchmark_history:${benchmarkId}`]);
  }

  const lockedParents = await client.query(`
    SELECT id, campaign_id, platform_type, status, metric, name, benchmark_value, current_value,
      unit, updated_at, last_updated
    FROM benchmarks
    WHERE id = ANY($1::text[])
      AND campaign_id = $2
      AND platform_type = 'google_analytics'
      AND status = 'active'
    ORDER BY id
    FOR UPDATE
  `, [candidateBenchmarkIds, CAMPAIGN_ID]);
  check(lockedParents.rowCount === 2, "The exact two Benchmark parents could not be locked in campaign scope");
  const definitionsBefore = definitionSignature(lockedParents.rows);

  const lockedRows = await client.query(`${duplicateRowsSql} FOR UPDATE OF h`, [CAMPAIGN_ID]);
  const plans = buildCleanupPlan(lockedRows.rows);
  check(sameStrings(plans.map((plan) => plan.benchmarkId), candidateBenchmarkIds), "Duplicate Benchmark scope changed after locks were acquired");

  const countsBeforeResult = await client.query(`
    SELECT benchmark_id, COUNT(*)::int AS row_count
    FROM benchmark_history
    WHERE benchmark_id = ANY($1::text[])
    GROUP BY benchmark_id
    ORDER BY benchmark_id
  `, [candidateBenchmarkIds]);
  const countsBefore = new Map(countsBeforeResult.rows.map((row: any) => [String(row.benchmark_id), Number(row.row_count)]));
  const deleteIds = plans.flatMap((plan) => plan.deleteIds);
  check(deleteIds.length === 2, "Cleanup did not resolve to exactly two redundant row IDs");

  const deleted = await client.query(`
    DELETE FROM benchmark_history
    WHERE id::text = ANY($1::text[])
      AND benchmark_id = ANY($2::text[])
    RETURNING id, benchmark_id
  `, [deleteIds, candidateBenchmarkIds]);
  check(deleted.rowCount === 2, `Expected exactly two deleted rows, deleted ${deleted.rowCount}`);
  check(sameStrings(deleted.rows.map((row: any) => opaque(row.id)), EXPECTED_DELETE_HASHES), "Deleted row hashes did not match the authorized boundary");

  const retainedIds = plans.map((plan) => plan.retainId);
  const retained = await client.query(`
    SELECT id
    FROM benchmark_history
    WHERE id::text = ANY($1::text[])
    ORDER BY id
  `, [retainedIds]);
  check(retained.rowCount === 2 && sameStrings(retained.rows.map((row: any) => opaque(row.id)), EXPECTED_RETAIN_HASHES),
    "Canonical history rows were not retained exactly");

  const duplicateRowsAfter = await client.query(duplicateRowsSql, [CAMPAIGN_ID]);
  check(duplicateRowsAfter.rowCount === 0, "Duplicate Benchmark history remains after the targeted delete");
  const countsAfterResult = await client.query(`
    SELECT benchmark_id, COUNT(*)::int AS row_count
    FROM benchmark_history
    WHERE benchmark_id = ANY($1::text[])
    GROUP BY benchmark_id
    ORDER BY benchmark_id
  `, [candidateBenchmarkIds]);
  const countsAfter = new Map(countsAfterResult.rows.map((row: any) => [String(row.benchmark_id), Number(row.row_count)]));
  check(candidateBenchmarkIds.every((id) => countsAfter.get(id) === Number(countsBefore.get(id)) - 1),
    "History counts did not decrease by exactly one row per Benchmark");

  const parentsAfter = await client.query(`
    SELECT id, campaign_id, platform_type, status, metric, name, benchmark_value, current_value,
      unit, updated_at, last_updated
    FROM benchmarks
    WHERE id = ANY($1::text[])
    ORDER BY id
  `, [candidateBenchmarkIds]);
  check(definitionSignature(parentsAfter.rows) === definitionsBefore, "A Benchmark definition changed during history cleanup");

  await client.query("COMMIT");
  committed = true;

  const committedRows = await client.query(`
    SELECT id
    FROM benchmark_history
    WHERE id::text = ANY($1::text[])
       OR id::text = ANY($2::text[])
    ORDER BY id
  `, [deleteIds, retainedIds]);
  const committedHashes = committedRows.rows.map((row: any) => opaque(row.id));
  check(sameStrings(committedHashes, EXPECTED_RETAIN_HASHES), "Post-commit history boundary does not contain only the canonical rows");

  console.log(JSON.stringify({
    success: true,
    mode: "authorized_exact_cleanup",
    deployedSha: EXPECTED_SHA,
    campaignHash: opaque(CAMPAIGN_ID),
    duplicateGroupsBefore: plans.length,
    rowsBefore: lockedRows.rowCount,
    deletedRowHashes: sorted(EXPECTED_DELETE_HASHES),
    retainedRowHashes: sorted(EXPECTED_RETAIN_HASHES),
    duplicateGroupsAfter: 0,
    deletedRows: deleted.rowCount,
    retainedCanonicalRows: committedRows.rowCount,
    benchmarkDefinitionsUnchanged: true,
    committed: true,
  }, null, 2));
} catch (error) {
  if (!committed) await client.query("ROLLBACK").catch(() => null);
  throw error;
} finally {
  client.release();
  await pool.end();
}
