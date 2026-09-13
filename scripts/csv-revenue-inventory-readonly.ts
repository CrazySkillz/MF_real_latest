import { pool } from "../server/db";
import { inspectGa4CsvRevenueDamage } from "../server/utils/csv-revenue-damage-inventory";
import { findInvalidGa4CsvRevenueAmountRows, findInvalidGa4CsvRevenueDateRows } from "../server/utils/csv";

async function main(): Promise<void> {
  if (!pool) throw new Error("DATABASE_URL is required for the read-only CSV Revenue inventory.");

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const campaigns = await client.query(`SELECT id, currency FROM campaigns ORDER BY id`);
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
      WHERE LOWER(COALESCE(source_type, '')) = 'csv'
         OR id::text IN (
           SELECT revenue_source_id
           FROM revenue_records
           WHERE LOWER(COALESCE(source_type, '')) = 'csv'
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
      WHERE LOWER(COALESCE(source_type, '')) = 'csv'
         OR revenue_source_id IN (
           SELECT id::text
           FROM revenue_sources
           WHERE LOWER(COALESCE(source_type, '')) = 'csv'
             AND LOWER(COALESCE(NULLIF(TRIM(platform_context), ''), 'ga4')) = 'ga4'
         )
      ORDER BY campaign_id, revenue_source_id, date, sub_campaign_urn, id
    `);

    const inventory = inspectGa4CsvRevenueDamage(sources.rows, records.rows, sources.rows);
    const campaignCurrencyById = new Map(campaigns.rows.map((campaign: any) => [String(campaign.id), String(campaign.currency || "USD").trim().toUpperCase()]));
    const activeSources = sources.rows.filter((source: any) =>
      source?.isActive !== false
      && String(source?.sourceType || "").trim().toLowerCase() === "csv"
      && ["", "ga4"].includes(String(source?.platformContext || "").trim().toLowerCase()));
    const sourceCurrencyMismatches: any[] = [];
    const recordCurrencyMismatches: any[] = [];
    const unsupportedStoredAmountSources: any[] = [];
    const unsupportedStoredDateSources: any[] = [];
    const duplicateSourceKeys = new Map<string, string[]>();
    for (const source of activeSources) {
      const campaignId = String(source.campaignId || "");
      const sourceId = String(source.id || "");
      const campaignCurrency = campaignCurrencyById.get(campaignId) || "USD";
      const sourceCurrency = String(source.currency || "").trim().toUpperCase();
      let mapping: any = null;
      try { mapping = typeof source.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source.mappingConfig; } catch { mapping = null; }
      const mappingCurrency = String(mapping?.currency || "").trim().toUpperCase();
      if (sourceCurrency !== campaignCurrency || (mappingCurrency && mappingCurrency !== campaignCurrency)) {
        sourceCurrencyMismatches.push({ sourceId, campaignId, campaignCurrency, sourceCurrency: sourceCurrency || null, mappingCurrency: mappingCurrency || null });
      }
      const mismatchedRecords = records.rows.filter((record: any) =>
        String(record.revenueSourceId || "") === sourceId
        && String(record.campaignId || "") === campaignId
        && String(record.currency || "").trim().toUpperCase() !== campaignCurrency);
      if (mismatchedRecords.length > 0) {
        recordCurrencyMismatches.push({ sourceId, campaignId, campaignCurrency, recordIds: mismatchedRecords.map((record: any) => String(record.id || "")).filter(Boolean) });
      }
      const storedRows = Array.isArray(mapping?.csvStoredRevenueRows) ? mapping.csvStoredRevenueRows : [];
      const rows = storedRows.map((row: any) => ({
        Revenue: String(row?.revenueRaw ?? row?.revenue ?? ""),
        Campaign: String(row?.campaignKey ?? ""),
        Date: String(row?.dateRaw ?? ""),
      }));
      const amountRows = findInvalidGa4CsvRevenueAmountRows(rows, {
        revenueColumn: "Revenue",
        campaignCurrency,
        campaignColumn: mapping?.campaignColumn ? "Campaign" : null,
        campaignValue: mapping?.campaignValue || null,
        campaignValues: Array.isArray(mapping?.campaignValues) ? mapping.campaignValues : null,
      });
      if (amountRows.length > 0) unsupportedStoredAmountSources.push({ sourceId, campaignId, csvRows: amountRows });
      if (mapping?.dateColumn) {
        const dateRows = findInvalidGa4CsvRevenueDateRows(rows, {
          revenueColumn: "Revenue",
          dateColumn: "Date",
          campaignColumn: mapping?.campaignColumn ? "Campaign" : null,
          campaignValue: mapping?.campaignValue || null,
          campaignValues: Array.isArray(mapping?.campaignValues) ? mapping.campaignValues : null,
        });
        if (dateRows.length > 0) unsupportedStoredDateSources.push({ sourceId, campaignId, csvRows: dateRows });
      }
      const duplicateKey = `${campaignId}|${String(source.displayName || "")}|${sourceCurrency}|${String(source.mappingConfig || "")}`;
      duplicateSourceKeys.set(duplicateKey, [...(duplicateSourceKeys.get(duplicateKey) || []), sourceId]);
    }
    const duplicateActiveSourceGroups = Array.from(duplicateSourceKeys.values())
      .filter((sourceIds) => sourceIds.length > 1)
      .map((sourceIds) => ({ sourceIds }));
    const supplementalFindings = {
      sourceCurrencyMismatches,
      recordCurrencyMismatches,
      unsupportedStoredAmountSources,
      unsupportedStoredDateSources,
      duplicateActiveSourceGroups,
    };
    const supplementalFindingCount = Object.values(supplementalFindings).reduce((sum, rows) => sum + rows.length, 0);
    console.log(JSON.stringify({
      transactionMode: "read-only",
      checkedAt: new Date().toISOString(),
      campaignCount: campaigns.rowCount || campaigns.rows.length,
      ...inventory,
      supplementalFindingCount,
      supplementalFindings,
      cleanupAssessment: {
        candidateReviewRequired: !inventory.pass || supplementalFindingCount > 0,
        automaticCleanupAllowed: false,
        cleanupProposalGenerated: false,
        reason: inventory.pass && supplementalFindingCount === 0
          ? "No locally detectable GA4 CSV Revenue persistence candidates were found."
          : "Review the exact returned source and record IDs before proposing any separate cleanup.",
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
