import { pool } from "../server/db";
import { inspectGa4GoogleSheetsRevenueDamage } from "../server/utils/google-sheets-revenue-damage-inventory";

async function main(): Promise<void> {
  if (!pool) throw new Error("DATABASE_URL is required for the read-only Google Sheets Revenue inventory.");

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const campaigns = await client.query(`
      SELECT id, currency
      FROM campaigns
      ORDER BY id
    `);
    const connections = await client.query(`
      SELECT
        id,
        campaign_id AS "campaignId",
        spreadsheet_id AS "spreadsheetId",
        sheet_name AS "sheetName",
        purpose,
        is_active AS "isActive",
        (NULLIF(TRIM(access_token), '') IS NOT NULL) AS "hasAccessToken",
        (NULLIF(TRIM(refresh_token), '') IS NOT NULL) AS "hasRefreshToken",
        (NULLIF(TRIM(client_id), '') IS NOT NULL) AS "hasClientId",
        (NULLIF(TRIM(client_secret), '') IS NOT NULL) AS "hasClientSecret",
        (encrypted_tokens IS NOT NULL) AS "hasEncryptedTokens",
        last_data_refresh_at AS "lastDataRefreshAt",
        connected_at AS "connectedAt",
        created_at AS "createdAt"
      FROM google_sheets_connections
      ORDER BY campaign_id, connected_at, id
    `);
    const sources = await client.query(`
      SELECT
        id,
        campaign_id AS "campaignId",
        source_type AS "sourceType",
        platform_context AS "platformContext",
        display_name AS "displayName",
        currency,
        mapping_config AS "mappingConfig",
        is_active AS "isActive",
        connected_at AS "connectedAt",
        created_at AS "createdAt"
      FROM revenue_sources
      WHERE LOWER(COALESCE(source_type, '')) = 'google_sheets'
         OR id::text IN (
           SELECT revenue_source_id
           FROM revenue_records
           WHERE LOWER(COALESCE(source_type, '')) = 'google_sheets'
         )
      ORDER BY campaign_id, connected_at, id
    `);
    const records = await client.query(`
      SELECT
        id,
        campaign_id AS "campaignId",
        revenue_source_id AS "revenueSourceId",
        date,
        revenue,
        currency,
        source_type AS "sourceType",
        sub_campaign_urn AS "subCampaignUrn",
        created_at AT TIME ZONE 'UTC' AS "createdAt"
      FROM revenue_records
      WHERE LOWER(COALESCE(source_type, '')) = 'google_sheets'
         OR revenue_source_id IN (
           SELECT id::text
           FROM revenue_sources
           WHERE LOWER(COALESCE(source_type, '')) = 'google_sheets'
             AND LOWER(COALESCE(NULLIF(TRIM(platform_context), ''), 'ga4')) = 'ga4'
         )
      ORDER BY campaign_id, revenue_source_id, date, sub_campaign_urn, id
    `);

    const inventory = inspectGa4GoogleSheetsRevenueDamage({
      campaigns: campaigns.rows,
      connections: connections.rows,
      sources: sources.rows,
      records: records.rows,
    });
    console.log(JSON.stringify({
      transactionMode: "read-only",
      checkedAt: new Date().toISOString(),
      ...inventory,
      cleanupAssessment: {
        candidateReviewRequired: !inventory.pass,
        automaticCleanupAllowed: false,
        cleanupProposalGenerated: false,
        reason: inventory.pass
          ? "No locally detectable GA4 Google Sheets Revenue persistence candidates were found."
          : "Review the exact returned source, connection, and record IDs before proposing any separate cleanup.",
      },
    }, null, 2));

    await client.query("ROLLBACK");
    transactionOpen = false;
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
