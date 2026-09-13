import { execFileSync } from "child_process";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { DatabaseStorage } from "../server/storage";
import { revenueRecords, revenueSources } from "../shared/schema";

const EXPECTED_SHA = String(process.env.CSV_REVENUE_ROLLBACK_EXPECTED_SHA || "").trim();
const CAMPAIGN_ID = String(process.env.CSV_REVENUE_ROLLBACK_CAMPAIGN_ID || "").trim();
const CONFIRMATION = String(process.env.CSV_REVENUE_ROLLBACK_CONFIRM || "").trim();
const REQUIRED_CONFIRMATION = "ROLLBACK_ONLY_NO_COMMITTED_TEST_DATA";

const assert = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(message);
};

const readCampaignCsvState = async () => {
  const client = await pool!.connect();
  let transactionOpen = false;
  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    transactionOpen = true;
    const sources = await client.query(`
      SELECT id::text, source_type, platform_context, display_name, currency,
             mapping_config, is_active, connected_at, created_at
      FROM revenue_sources
      WHERE campaign_id = $1
        AND LOWER(COALESCE(source_type, '')) = 'csv'
        AND LOWER(COALESCE(NULLIF(TRIM(platform_context), ''), 'ga4')) = 'ga4'
      ORDER BY id
    `, [CAMPAIGN_ID]);
    const records = await client.query(`
      SELECT id::text, campaign_id, revenue_source_id, date, revenue::text,
             currency, source_type, external_id, sub_campaign_urn, created_at
      FROM revenue_records
      WHERE campaign_id = $1
        AND revenue_source_id IN (
          SELECT id::text FROM revenue_sources
          WHERE campaign_id = $1
            AND LOWER(COALESCE(source_type, '')) = 'csv'
            AND LOWER(COALESCE(NULLIF(TRIM(platform_context), ''), 'ga4')) = 'ga4'
        )
      ORDER BY revenue_source_id, id
    `, [CAMPAIGN_ID]);
    await client.query("ROLLBACK");
    transactionOpen = false;
    return { sources: sources.rows, records: records.rows };
  } finally {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
};

async function main(): Promise<void> {
  if (!pool || !db) throw new Error("DATABASE_URL is required");
  assert(/^[0-9a-f]{40}$/i.test(EXPECTED_SHA), "CSV_REVENUE_ROLLBACK_EXPECTED_SHA must be the exact 40-character local HEAD SHA");
  assert(/^[0-9a-f-]{36}$/i.test(CAMPAIGN_ID), "CSV_REVENUE_ROLLBACK_CAMPAIGN_ID must be an explicit campaign UUID");
  assert(CONFIRMATION === REQUIRED_CONFIRMATION, `CSV_REVENUE_ROLLBACK_CONFIRM must equal ${REQUIRED_CONFIRMATION}`);

  const currentSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  assert(currentSha === EXPECTED_SHA, `Local HEAD ${currentSha} does not match expected SHA ${EXPECTED_SHA}`);
  try {
    execFileSync("git", ["diff", "--quiet", "--", "server/storage.ts"], { stdio: "ignore" });
  } catch {
    throw new Error("server/storage.ts has uncommitted changes; rollback validation refused");
  }

  const campaign = await pool.query("SELECT id, COALESCE(NULLIF(TRIM(currency), ''), 'USD') AS currency FROM campaigns WHERE id = $1", [CAMPAIGN_ID]);
  assert(campaign.rowCount === 1, "Target campaign was not found");
  const currency = String(campaign.rows[0].currency || "USD").trim().toUpperCase();
  const before = await readCampaignCsvState();
  const validationSourceId = randomUUID();
  const validationRecordId = randomUUID();
  const originalMappingConfig = JSON.stringify({ validation: "csv-revenue-rollback", state: "last-good" });
  const replacementMappingConfig = JSON.stringify({ validation: "csv-revenue-rollback", state: "replacement" });
  const originalTransaction = db.transaction;
  let nestedFailureCode = "";
  let lastGoodVerifiedAfterNestedRollback = false;

  (db as any).transaction = async (callback: (tx: any) => Promise<any>) => originalTransaction.call(db, async (outerTx: any) => {
    await outerTx.insert(revenueSources).values({
      id: validationSourceId,
      campaignId: CAMPAIGN_ID,
      sourceType: "csv",
      platformContext: "ga4",
      displayName: "CSV rollback validation last-good",
      currency,
      mappingConfig: originalMappingConfig,
      isActive: true,
    } as any);
    await outerTx.insert(revenueRecords).values({
      id: validationRecordId,
      campaignId: CAMPAIGN_ID,
      revenueSourceId: validationSourceId,
      date: "2026-09-12",
      revenue: "123.45",
      currency,
      sourceType: "csv",
    } as any);

    try {
      await outerTx.transaction(async (nestedTx: any) => callback(nestedTx));
      throw new Error("Forced replacement insert unexpectedly succeeded");
    } catch (error: any) {
      if (String(error?.message || "").includes("unexpectedly succeeded")) throw error;
      nestedFailureCode = String(error?.code || "");
      assert(nestedFailureCode === "23502", `Expected PostgreSQL not-null violation 23502, received ${nestedFailureCode || "no code"}`);
    }

    const [sourceAfterRollback] = await outerTx.select().from(revenueSources).where(and(
      eq(revenueSources.id, validationSourceId),
      eq(revenueSources.campaignId, CAMPAIGN_ID),
    ));
    const recordsAfterRollback = await outerTx.select().from(revenueRecords).where(and(
      eq(revenueRecords.revenueSourceId, validationSourceId),
      eq(revenueRecords.campaignId, CAMPAIGN_ID),
    ));
    assert(sourceAfterRollback?.displayName === "CSV rollback validation last-good", "Last-good source name was not restored");
    assert(sourceAfterRollback?.mappingConfig === originalMappingConfig, "Last-good mapping was not restored");
    assert(recordsAfterRollback.length === 1, "Last-good record count was not restored");
    assert(String(recordsAfterRollback[0]?.id) === validationRecordId, "Last-good record identity was not restored");
    assert(String(recordsAfterRollback[0]?.revenue) === "123.45", "Last-good revenue was not restored");
    lastGoodVerifiedAfterNestedRollback = true;

    const rollback: any = new Error("Rollback validation complete; rolling back uncommitted seed data");
    rollback.code = "CSV_REVENUE_VALIDATION_OUTER_ROLLBACK";
    throw rollback;
  });

  let storageError: any = null;
  try {
    const storage = new DatabaseStorage();
    await storage.replaceGa4CsvRevenueSourceWithRecords(
      CAMPAIGN_ID,
      validationSourceId,
      {
        campaignId: CAMPAIGN_ID,
        sourceType: "csv",
        platformContext: "ga4",
        displayName: "CSV rollback validation replacement",
        currency,
        mappingConfig: replacementMappingConfig,
        isActive: true,
      } as any,
      [{
        campaignId: CAMPAIGN_ID,
        date: "2026-09-13",
        revenue: null,
        currency,
        sourceType: "csv",
      } as any],
      originalMappingConfig,
    );
  } catch (error: any) {
    storageError = error;
  } finally {
    (db as any).transaction = originalTransaction;
  }

  const after = await readCampaignCsvState();
  const leakedSource = await pool.query("SELECT id FROM revenue_sources WHERE id = $1", [validationSourceId]);
  const leakedRecord = await pool.query("SELECT id FROM revenue_records WHERE id = $1 OR revenue_source_id = $2", [validationRecordId, validationSourceId]);
  assert(lastGoodVerifiedAfterNestedRollback, "Last-good data was not verified after the nested rollback");
  assert(leakedSource.rowCount === 0 && leakedRecord.rowCount === 0, "Uncommitted rollback validation data leaked into production");
  assert(JSON.stringify(after) === JSON.stringify(before), "Target campaign CSV state changed during rollback validation");
  assert(storageError?.code === "CSV_REVENUE_VALIDATION_OUTER_ROLLBACK", storageError?.message || "Rollback validation unexpectedly committed");

  console.log(JSON.stringify({
    success: true,
    mode: "production_postgresql_nested_rollback_no_committed_test_data",
    checkedAt: new Date().toISOString(),
    campaignId: CAMPAIGN_ID,
    headSha: currentSha,
    nestedFailureCode,
    lastGoodVerifiedAfterNestedRollback,
    uncommittedValidationRowsAfterOuterRollback: { sources: leakedSource.rowCount, records: leakedRecord.rowCount },
    campaignStateUnchanged: true,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
