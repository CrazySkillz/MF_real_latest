import { pool } from "../server/db";

const campaignId = String(process.env.SALESFORCE_REVENUE_CERTIFICATION_CAMPAIGN_ID || "").trim();
const expectedSourceId = String(process.env.SALESFORCE_REVENUE_CERTIFICATION_SOURCE_ID || "").trim();

if (!pool) throw new Error("DATABASE_URL is required");
if (!campaignId) throw new Error("SALESFORCE_REVENUE_CERTIFICATION_CAMPAIGN_ID is required");
if (!expectedSourceId) throw new Error("SALESFORCE_REVENUE_CERTIFICATION_SOURCE_ID is required");

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
const round2 = (value: unknown) => Number(Number(value || 0).toFixed(2));
const isValidDateKey = (value: unknown) => {
  const date = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
    && new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) === date;
};

const client = await pool.connect();
try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const campaignResult = await client.query(
    "SELECT id, currency FROM campaigns WHERE id = $1 LIMIT 1",
    [campaignId],
  );
  assert(campaignResult.rowCount === 1, "Certification campaign was not found");
  const campaignCurrency = String(campaignResult.rows[0].currency || "").toUpperCase();

  const sourceResult = await client.query(
    `SELECT id, source_type, platform_context, display_name, currency, mapping_config, is_active
       FROM revenue_sources
      WHERE campaign_id = $1
        AND LOWER(source_type) = 'salesforce'
        AND COALESCE(LOWER(platform_context), 'ga4') = 'ga4'
      ORDER BY created_at, id`,
    [campaignId],
  );
  const activeSources = sourceResult.rows.filter((row: any) => row.is_active !== false);
  assert(activeSources.length === 1, `Expected one active GA4 Salesforce source; found ${activeSources.length}`);
  const source = activeSources[0];
  assert(String(source.id) === expectedSourceId, "Active Salesforce source ID does not match scheduler evidence");
  assert(String(source.currency || "").toUpperCase() === campaignCurrency, "Source currency does not match campaign currency");

  const recordsResult = await client.query(
    `SELECT id, campaign_id, revenue_source_id, date, revenue, currency, source_type, sub_campaign_urn
       FROM revenue_records
      WHERE revenue_source_id = $1
      ORDER BY date, sub_campaign_urn NULLS FIRST, id`,
    [expectedSourceId],
  );
  const records = recordsResult.rows;
  assert(records.length > 0, "Active Salesforce source has no materialized records");
  assert(records.every((row: any) => String(row.campaign_id) === campaignId), "Cross-campaign Salesforce record found");
  assert(records.every((row: any) => String(row.source_type || "").toLowerCase() === "salesforce"), "Wrong Salesforce record source type found");
  assert(records.every((row: any) => String(row.currency || "").toUpperCase() === campaignCurrency), "Wrong Salesforce record currency found");
  assert(records.every((row: any) => isValidDateKey(row.date)), "Invalid Salesforce materialized date found");

  const duplicateResult = await client.query(
    `SELECT date, COALESCE(sub_campaign_urn, '') AS campaign_grain, COUNT(*)::int AS count
       FROM revenue_records
      WHERE revenue_source_id = $1
      GROUP BY date, COALESCE(sub_campaign_urn, '')
     HAVING COUNT(*) > 1`,
    [expectedSourceId],
  );
  assert(duplicateResult.rowCount === 0, "Duplicate Salesforce date/campaign materialization grain found");

  const orphanResult = await client.query(
    `SELECT COUNT(*)::int AS count
       FROM revenue_records r
       LEFT JOIN revenue_sources s ON s.id::text = r.revenue_source_id
      WHERE r.campaign_id = $1
        AND LOWER(COALESCE(r.source_type, '')) = 'salesforce'
        AND (s.id IS NULL OR s.campaign_id <> r.campaign_id)`,
    [campaignId],
  );
  assert(Number(orphanResult.rows[0].count) === 0, "Orphan or cross-campaign Salesforce records found");

  let mapping: any = {};
  try { mapping = JSON.parse(String(source.mapping_config || "{}")); } catch { throw new Error("Salesforce mapping config is invalid JSON"); }
  const aggregateRecords = records.filter((row: any) => !row.sub_campaign_urn);
  const attributedRecords = records.filter((row: any) => !!row.sub_campaign_urn);
  const aggregateRevenue = round2(aggregateRecords.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0));
  const attributedRevenue = round2(attributedRecords.reduce((sum: number, row: any) => sum + Number(row.revenue || 0), 0));
  const itemized = Array.isArray(mapping.campaignValueRevenueTotals) ? mapping.campaignValueRevenueTotals : [];
  const itemizedRevenue = round2(itemized.reduce((sum: number, row: any) => sum + Number(row?.revenue || 0), 0));
  const mappedRevenue = round2(mapping.lastTotalRevenue);
  assert(aggregateRevenue === mappedRevenue, "Aggregate materialized revenue does not match saved Salesforce total");
  assert(itemizedRevenue === mappedRevenue, "Itemized Salesforce revenue does not match saved Salesforce total");
  if (attributedRecords.length > 0) {
    assert(attributedRevenue === mappedRevenue, "Attributed Salesforce revenue does not match saved Salesforce total");
  }

  console.log(JSON.stringify({
    inventoryStatus: "pass",
    transaction: "read only and rolled back",
    campaignId,
    sourceId: source.id,
    activeSourceCount: activeSources.length,
    inactiveSourceCount: sourceResult.rows.length - activeSources.length,
    campaignCurrency,
    sourceCurrency: String(source.currency || "").toUpperCase(),
    materializedRecordCount: records.length,
    aggregateRecordCount: aggregateRecords.length,
    attributedRecordCount: attributedRecords.length,
    aggregateRevenue,
    attributedRevenue,
    itemizedRevenue,
    campaignField: mapping.campaignField || null,
    revenueField: mapping.revenueField || null,
    dateField: mapping.dateField || null,
    revenueClassification: mapping.revenueClassification || null,
    selectedValues: Array.isArray(mapping.selectedValues) ? mapping.selectedValues : [],
    itemizedValues: itemized,
    campaignMappings: Array.isArray(mapping.campaignMappings) ? mapping.campaignMappings : [],
    pipelineEnabled: mapping.pipelineEnabled === true,
    pipelineStageName: mapping.pipelineStageName || null,
    pipelineTotalToDate: round2(mapping.pipelineTotalToDate),
    lastSyncedAt: mapping.lastSyncedAt || null,
    duplicateMaterializationGrains: 0,
    orphanOrCrossCampaignRecords: 0,
  }, null, 2));
} finally {
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  await pool.end();
}
