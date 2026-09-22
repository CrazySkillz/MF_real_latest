import { pool } from "../server/db";
import { storage } from "../server/storage";

if (!pool) throw new Error("DATABASE_URL is required");
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const benchmarkId = "1b4533c9-2fd2-494d-bed3-449cbce3c8c6";
const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const benchmark = await client.query(`SELECT id, campaign_id, name, alerts_enabled, email_notifications FROM benchmarks WHERE id = $1`, [benchmarkId]);
  const notifications = await client.query(`SELECT id, campaign_id, read, metadata FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2 ORDER BY created_at`, [campaignId, `%${benchmarkId}%`]);
  const events = await client.query(`SELECT id, campaign_id, entity_id, provider, success, delivery_status, provider_response_id, delivered_at, failed_at FROM email_alert_events WHERE entity_id = $1`, [benchmarkId]);
  const dependent = await client.query(`
    SELECT tc.table_name, kcu.column_name, ccu.table_name AS referenced_table, ccu.column_name AS referenced_column,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'benchmarks'
    ORDER BY tc.table_name, kcu.column_name
  `);
  const tables = await client.query(`
    SELECT to_regclass('public.benchmark_history')::text AS benchmark_history,
      to_regclass('public.benchmarks')::text AS benchmarks,
      to_regclass('public.notifications')::text AS notifications
  `);
  const history = tables.rows[0].benchmark_history
    ? await client.query(`SELECT COUNT(*)::int AS count FROM benchmark_history WHERE benchmark_id = $1`, [benchmarkId])
    : null;
  const triggers = await client.query(`
    SELECT event_object_table, trigger_name, action_timing, event_manipulation
    FROM information_schema.triggers
    WHERE event_object_table IN ('benchmarks', 'benchmark_history', 'notifications')
    ORDER BY event_object_table, trigger_name
  `);
  const storageNotifications = await storage.getNotifications();
  const matchingStorageRows = storageNotifications.filter((row: any) => {
    try {
      const meta = typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata || {};
      return String(row.campaignId || "") === campaignId && String(meta.benchmarkId || "") === benchmarkId;
    } catch { return false; }
  });
  console.log(JSON.stringify({
    benchmark: benchmark.rows,
    notifications: notifications.rows.map((row: any) => ({ id: row.id, campaignId: row.campaign_id, read: row.read, metadata: JSON.parse(row.metadata) })),
    events: events.rows.map((row: any) => ({ id: row.id, campaignId: row.campaign_id, entityId: row.entity_id,
      provider: row.provider, success: row.success, deliveryStatus: row.delivery_status,
      providerResponseIdPresent: !!row.provider_response_id, deliveredAt: row.delivered_at, failedAt: row.failed_at })),
    dependentForeignKeys: dependent.rows,
    tables: tables.rows[0], benchmarkHistoryCount: history?.rows[0]?.count ?? null,
    triggers: triggers.rows,
    storageGlobalNotificationCount: storageNotifications.length,
    matchingStorageNotificationCount: matchingStorageRows.length,
  }));
  await client.query("ROLLBACK");
} finally {
  await client.query("ROLLBACK").catch(() => undefined);
  client.release();
  await pool.end();
}
