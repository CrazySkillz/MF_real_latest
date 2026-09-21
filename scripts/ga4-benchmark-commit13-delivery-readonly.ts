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
      r.last_sent_at,
      c.currency,
      c.reporting_time_zone,
      c.ga4_campaign_filter,
      g.property_id,
      e.scheduled_key,
      e.created_at AS send_created_at,
      e.sent_at AS event_sent_at,
      e.status AS send_status,
      e.error AS send_error,
      e.snapshot_id,
      a.provider,
      a.created_at AS audit_created_at,
      a.delivery_status,
      a.provider_response_id,
      a.delivered_at,
      a.error AS audit_error,
      a.metadata AS audit_metadata,
      s.snapshot_json
    FROM linkedin_reports r
    JOIN campaigns c ON c.id = r.campaign_id
    JOIN LATERAL (
      SELECT property_id
      FROM ga4_connections
      WHERE campaign_id = r.campaign_id AND is_active = true
      ORDER BY is_primary DESC, created_at
      LIMIT 1
    ) g ON true
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
    LEFT JOIN report_snapshots s ON s.id::text = e.snapshot_id
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
  const recentEvents = result.rows.length === 1 ? await client.query(`
    SELECT
      e.scheduled_key,
      e.status,
      e.sent_at,
      e.snapshot_id,
      s.snapshot_json
    FROM report_send_events e
    LEFT JOIN report_snapshots s ON s.id::text = e.snapshot_id
    WHERE e.report_id = $1
    ORDER BY e.created_at DESC
    LIMIT 5
  `, [result.rows[0].report_id]) : { rows: [] };
  const recentAudits = result.rows.length === 1 ? await client.query(`
    SELECT provider_response_id, provider, delivery_status, delivered_at, metadata
    FROM email_alert_events
    WHERE kind = 'report' AND entity_type = 'report' AND entity_id = $1
    ORDER BY created_at DESC
    LIMIT 5
  `, [result.rows[0].report_id]) : { rows: [] };
  const duplicateKeys = result.rows.length === 1 ? await client.query(`
    SELECT count(*)::int AS count
    FROM (
      SELECT scheduled_key
      FROM report_send_events
      WHERE report_id = $1
      GROUP BY scheduled_key
      HAVING count(*) > 1
    ) duplicates
  `, [result.rows[0].report_id]) : { rows: [{ count: 0 }] };
  await client.query("ROLLBACK");
  if (result.rows.length !== 1) throw new Error(`Expected one target report; found ${result.rows.length}`);
  const row = result.rows[0];
  const auditMetadata = (() => {
    try {
      return JSON.parse(String(row.audit_metadata || "{}"));
    } catch {
      return {};
    }
  })();
  const snapshotPayload = (() => {
    try {
      return JSON.parse(String(row.snapshot_json || "{}"));
    } catch {
      return {};
    }
  })();
  const savedFilterCount = (() => {
    const value = String(row.ga4_campaign_filter || "").trim();
    if (!value) return 0;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).length : 1;
    } catch {
      return 1;
    }
  })();
  const providerStatus = row.provider === "mailgun-api" && row.provider_response_id
    ? await waitForMailgunDelivery(String(row.provider_response_id), {
      attempts: 1,
      delayMs: 0,
      ...(auditMetadata.mailgunRegion ? { region: String(auditMetadata.mailgunRegion) } : {}),
    })
    : { status: "not_checked" as const };
  console.log(JSON.stringify({
    reportHash: sha(row.report_id),
    reportType: row.report_type,
    sourceBoundary: {
      propertyId: String(row.property_id || "").replace(/^properties\//, ""),
      savedFilterCount,
      currency: row.currency,
      reportingTimeZone: row.reporting_time_zone,
    },
    restoredSchedule: {
      time: row.schedule_time,
      timeZone: row.schedule_time_zone,
      recipientCount: Array.isArray(row.schedule_recipients) ? row.schedule_recipients.length : 0,
    },
    latestEvent: {
      scheduledKey: row.scheduled_key,
      createdAt: row.send_created_at,
      sentAtPresent: Boolean(row.event_sent_at),
      status: row.send_status,
      error: row.send_error,
      snapshotPresent: Boolean(row.snapshot_id),
    },
    bookkeeping: {
      lastSentAtPresent: Boolean(row.last_sent_at),
      lastSentDeltaMs: row.last_sent_at && row.event_sent_at
        ? Math.abs(new Date(row.last_sent_at).getTime() - new Date(row.event_sent_at).getTime())
        : null,
      duplicateScheduledKeys: Number(duplicateKeys.rows[0]?.count || 0),
    },
    audit: {
      provider: row.provider,
      createdAt: row.audit_created_at,
      persistedDeliveryStatus: row.delivery_status,
      deliveredAtPresent: Boolean(row.delivered_at),
      providerResponsePresent: Boolean(row.provider_response_id),
      error: row.audit_error,
      metadata: {
        mailgunRegion: auditMetadata.mailgunRegion || null,
        mailgunDeliveryStatus: auditMetadata.mailgunDeliveryStatus || null,
        mailgunDeliveryError: auditMetadata.mailgunDeliveryError || null,
      },
    },
    snapshot: row.snapshot_id ? {
      reportType: snapshotPayload.reportType || null,
      immutableBenchmarkCount: Array.isArray(snapshotPayload.benchmarks) ? snapshotPayload.benchmarks.length : 0,
    } : null,
    recentSentArtifacts: recentEvents.rows
      .filter((event: any) => event.status === "sent" && event.snapshot_id)
      .map((event: any) => {
        const payload = (() => {
          try {
            return JSON.parse(String(event.snapshot_json || "{}"));
          } catch {
            return {};
          }
        })();
        return {
          scheduledKey: event.scheduled_key,
          sentAtPresent: Boolean(event.sent_at),
          snapshotHash: sha(event.snapshot_id),
          reportType: payload.reportType || null,
          immutableBenchmarkCount: Array.isArray(payload.benchmarks) ? payload.benchmarks.length : 0,
        };
      }),
    recentDeliveredAudits: recentAudits.rows
      .filter((audit: any) => audit.delivery_status === "delivered" && audit.delivered_at)
      .map((audit: any) => {
        const metadata = (() => {
          try {
            return JSON.parse(String(audit.metadata || "{}"));
          } catch {
            return {};
          }
        })();
        return {
          providerResponseHash: sha(audit.provider_response_id),
          provider: audit.provider,
          deliveryStatus: audit.delivery_status,
          deliveredAtPresent: true,
          mailgunRegion: metadata.mailgunRegion || null,
        };
      }),
    liveProviderStatus: providerStatus,
  }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  await pool.end();
}
