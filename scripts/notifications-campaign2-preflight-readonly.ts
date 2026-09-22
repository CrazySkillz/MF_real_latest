import { createHash } from "node:crypto";
import { pool } from "../server/db";

const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const expectedSha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const hash = (value: unknown) => createHash("sha256").update(String(value || "")).digest("hex").slice(0, 12);

if (!pool) throw new Error("DATABASE_URL is required for read-only preflight");
const healthResponse = await fetch("https://marketforensics.onrender.com/api/health");
const health = await healthResponse.json();
if (!healthResponse.ok || health.commit !== expectedSha || health.nodeEnv !== "production") {
  throw new Error("Render runtime does not match the authorized validation revision");
}

const client = await pool.connect();
let transactionOpen = false;
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  transactionOpen = true;
  const campaign = await client.query(`
    SELECT id, name, owner_id, client_id, reporting_time_zone, currency
    FROM campaigns WHERE id = $1
  `, [campaignId]);
  if (campaign.rowCount !== 1 || campaign.rows[0].name !== "Campaign2"
    || !campaign.rows[0].owner_id || !campaign.rows[0].client_id) {
    throw new Error("Campaign2 identity or ownership did not match the documented boundary");
  }
  const connection = await client.query(`
    SELECT property_id FROM ga4_connections
    WHERE campaign_id = $1 AND is_active = true
    ORDER BY is_primary DESC, connected_at ASC LIMIT 1
  `, [campaignId]);
  if (connection.rowCount !== 1 || !connection.rows[0].property_id) {
    throw new Error("Campaign2 has no active GA4 property");
  }
  const scope = await client.query(`
    SELECT COUNT(*)::int AS campaign_count, COUNT(DISTINCT client_id)::int AS client_count
    FROM campaigns WHERE owner_id = $1
  `, [campaign.rows[0].owner_id]);
  const inventory = await client.query(`
    SELECT
      (SELECT COUNT(*)::int FROM kpis WHERE campaign_id = $1) AS kpis,
      (SELECT COUNT(*)::int FROM benchmarks WHERE campaign_id = $1) AS benchmarks,
      (SELECT COUNT(*)::int FROM notifications WHERE campaign_id = $1) AS notifications,
      (SELECT COUNT(*)::int FROM email_alert_events WHERE campaign_id = $1 AND kind = 'alert') AS email_events,
      (SELECT COUNT(*)::int FROM kpis WHERE campaign_id = $1 AND name LIKE 'Notifications Audit %') AS temporary_kpis,
      (SELECT COUNT(*)::int FROM benchmarks WHERE campaign_id = $1 AND name LIKE 'Notifications Audit %') AS temporary_benchmarks
  `, [campaignId]);
  const alertHistory = await client.query(`SELECT metadata FROM notifications WHERE campaign_id = $1`, [campaignId]);
  const foreignNotifications = await client.query(`
    SELECT COUNT(*)::int AS count FROM notifications n
    JOIN campaigns c ON c.id = n.campaign_id
    WHERE c.owner_id <> $1
  `, [campaign.rows[0].owner_id]);
  const softHiddenNotifications = alertHistory.rows.filter((row: any) => {
    try { return Boolean(JSON.parse(row.metadata || "{}").dismissedAt); } catch { return false; }
  }).length;
  await client.query("ROLLBACK");
  transactionOpen = false;
  console.log(JSON.stringify({
    mode: "database_read_only",
    deployedSha: health.commit,
    campaignHash: hash(campaignId),
    ownerHash: hash(campaign.rows[0].owner_id),
    clientHash: hash(campaign.rows[0].client_id),
    propertyId: connection.rows[0].property_id,
    reportingTimeZone: campaign.rows[0].reporting_time_zone,
    currency: campaign.rows[0].currency,
    ownerCampaignCount: scope.rows[0].campaign_count,
    ownerClientCount: scope.rows[0].client_count,
    inventory: inventory.rows[0],
    softHiddenNotifications,
    foreignOwnerNotificationRows: foreignNotifications.rows[0].count,
  }));
} finally {
  if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
  client.release();
  await pool.end();
}
