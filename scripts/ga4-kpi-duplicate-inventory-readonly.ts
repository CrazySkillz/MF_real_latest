import { createHash } from "node:crypto";
import { pool } from "../server/db";
import {
  isActiveGA4KPI,
} from "../server/utils/ga4-kpi-create-guard";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";

type InventoryRow = {
  id: string;
  campaignId: string | null;
  ownerId: string | null;
  metric: string | null;
  name: string;
  status: string | null;
};

function opaqueId(value: string | null): string | null {
  return value
    ? createHash("sha256").update(value).digest("hex").slice(0, 12)
    : null;
}

async function main(): Promise<void> {
  if (!pool) {
    throw new Error("DATABASE_URL is required for the read-only duplicate inventory.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query<InventoryRow>(`
      SELECT
        k.id,
        k.campaign_id AS "campaignId",
        c.owner_id AS "ownerId",
        k.metric,
        k.name,
        k.status
      FROM kpis k
      LEFT JOIN campaigns c ON c.id = k.campaign_id
      WHERE LOWER(COALESCE(k.platform_type, '')) = 'google_analytics'
      ORDER BY k.campaign_id, k.created_at, k.id
    `);

    const activeCanonicalRows = result.rows.flatMap((row) => {
      const canonicalMetric = resolveGA4KpiMetricIdentity(row.metric, row.name);
      return canonicalMetric && isActiveGA4KPI(row)
        ? [{ ...row, canonicalMetric }]
        : [];
    });
    const grouped = new Map<string, typeof activeCanonicalRows>();
    for (const row of activeCanonicalRows) {
      const key = `${row.campaignId ?? "missing-campaign"}:${row.canonicalMetric}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }

    const duplicateGroups = [...grouped.values()]
      .filter((rows) => rows.length > 1)
      .map((rows) => ({
        campaignHash: opaqueId(rows[0].campaignId),
        ownerHash: opaqueId(rows[0].ownerId),
        canonicalMetric: rows[0].canonicalMetric,
        activeRowCount: rows.length,
        rowHashes: rows.map((row) => opaqueId(row.id)),
      }));

    console.log(JSON.stringify({
      transactionMode: "read-only",
      ga4KpiRowCount: result.rows.length,
      activeCanonicalRowCount: activeCanonicalRows.length,
      inactiveRowCount: result.rows.filter((row) => !isActiveGA4KPI(row)).length,
      duplicateGroupCount: duplicateGroups.length,
      duplicateExcessRowCount: duplicateGroups.reduce(
        (sum, group) => sum + group.activeRowCount - 1,
        0,
      ),
      cleanupNeeded: duplicateGroups.length > 0,
      duplicateGroups,
    }, null, 2));

    await client.query("ROLLBACK");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
