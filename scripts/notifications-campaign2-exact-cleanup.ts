import { pool } from "../server/db";
import { storage } from "../server/storage";

const base = "https://marketforensics.onrender.com";
const sha = "b732693752db996b39b185e9c4d342b05f877676";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const benchmarkId = "1b4533c9-2fd2-494d-bed3-449cbce3c8c6";
const benchmarkName = "Notifications Audit e82d6ca80fd3894f";
const check = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };

if (!pool) throw new Error("DATABASE_URL is required");
const client = await pool.connect();
try {
  const response = await fetch(`${base}/api/health`);
  const health: any = await response.json();
  check(response.ok && health.commit === sha && health.nodeEnv === "production", "Render revision/runtime changed");
  const owner = await client.query(`SELECT owner_id FROM campaigns WHERE id = $1 AND name = 'Campaign2'`, [campaignId]);
  check(owner.rowCount === 1 && owner.rows[0].owner_id, "Campaign2 owner changed");
  const benchmark = await client.query(`SELECT id, campaign_id, name FROM benchmarks WHERE id = $1`, [benchmarkId]);
  check(benchmark.rowCount === 1 && benchmark.rows[0].campaign_id === campaignId
    && benchmark.rows[0].name === benchmarkName, "Temporary Benchmark identity/scope changed");
  const notifications = await client.query(`SELECT id, campaign_id, metadata FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2 ORDER BY id`, [campaignId, `%${benchmarkId}%`]);
  check(notifications.rowCount === 2, "Temporary notification count changed; refusing cleanup");
  const actorId = String(owner.rows[0].owner_id);
  const hides = notifications.rows.map((row: any) => {
    const meta = JSON.parse(row.metadata);
    check(meta.benchmarkId === benchmarkId && row.campaign_id === campaignId, "Notification metadata/scope mismatch");
    return {
      id: row.id,
      campaignId,
      metadata: JSON.stringify({ ...meta, dismissedAt: new Date().toISOString(), dismissedBy: actorId, dismissalReason: "benchmark_deleted" }),
    };
  });
  const deleted = await storage.deleteBenchmark(benchmarkId, hides);
  check(deleted, "Storage deletion returned false");
  const remaining = await client.query(`SELECT COUNT(*)::int AS count FROM benchmarks WHERE id = $1`, [benchmarkId]);
  check(remaining.rows[0].count === 0, "Temporary Benchmark remains after storage deletion");
  const alertRows = await client.query(`SELECT metadata FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2`, [campaignId, `%${benchmarkId}%`]);
  check(alertRows.rowCount === 2 && alertRows.rows.every((row: any) => Boolean(JSON.parse(row.metadata).dismissedAt)),
    "Temporary alert history was not soft-hidden");
  console.log(JSON.stringify({ deleted: true, softHiddenAlertHistory: alertRows.rowCount, emailAuditRetained: true, scope: "exact temporary Campaign2 Benchmark" }));
} finally {
  client.release();
  await pool.end();
}
