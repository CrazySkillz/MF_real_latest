import { createHash } from "node:crypto";
import { pool } from "../server/db";
import { waitForMailgunDelivery } from "../server/utils/mailgun-delivery";

const sha = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
if (!pool) throw new Error("DATABASE_URL is required");

const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const result = await client.query(`
    SELECT
      r.id AS report_id,
      r.report_type,
      r.schedule_time,
      r.schedule_time_zone,
      r.schedule_recipients,
      e.scheduled_key,
      e.status AS send_status,
      e.error AS send_error,
      e.snapshot_id,
      a.provider,
      a.delivery_status,
      a.provider_response_id,
      a.delivered_at,
      a.error AS audit_error
    FROM linkedin_reports r
    JOIN LATERAL (
      SELECT *
      FROM report_send_events e
      WHERE e.report_id = r.id
      ORDER BY e.created_at DESC
      LIMIT 1
    ) e ON true
    LEFT JOIN LATERAL (
      SELECT *
      FROM email_alert_events a
      WHERE a.kind = 'report'
        AND a.entity_type = 'report'
        AND a.entity_id = r.id
        AND a.success = true
      ORDER BY a.created_at DESC
      LIMIT 1
    ) a ON true
    WHERE r.platform_type = 'google_analytics'
      AND r.report_type = 'benchmarks'
      AND r.status = 'active'
      AND EXISTS (
        SELECT 1 FROM benchmarks b
        WHERE b.campaign_id = r.campaign_id
          AND b.platform_type = 'google_analytics'
          AND b.status = 'active'
      )
  `);
  await client.query("ROLLBACK");
  if (result.rows.length !== 1) throw new Error(`Expected one target report; found ${result.rows.length}`);
  const row = result.rows[0];
  const providerStatus = row.provider === "mailgun-api" && row.provider_response_id
    ? await waitForMailgunDelivery(String(row.provider_response_id), { attempts: 1, delayMs: 0 })
    : { status: "not_checked" as const };
  console.log(JSON.stringify({
    reportHash: sha(row.report_id),
    reportType: row.report_type,
    restoredSchedule: {
      time: row.schedule_time,
      timeZone: row.schedule_time_zone,
      recipientCount: Array.isArray(row.schedule_recipients) ? row.schedule_recipients.length : 0,
    },
    latestEvent: {
      scheduledKey: row.scheduled_key,
      status: row.send_status,
      error: row.send_error,
      snapshotPresent: Boolean(row.snapshot_id),
    },
    audit: {
      provider: row.provider,
      persistedDeliveryStatus: row.delivery_status,
      deliveredAtPresent: Boolean(row.delivered_at),
      providerResponsePresent: Boolean(row.provider_response_id),
      error: row.audit_error,
    },
    liveProviderStatus: providerStatus,
  }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  await pool.end();
}
