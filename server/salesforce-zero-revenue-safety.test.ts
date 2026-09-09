import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertGa4RevenueMaterializationComplete,
  selectRevenueRecordTotal,
} from "./utils/revenue-record-total";

const routes = readFileSync("server/routes-oauth.ts", "utf8");
const storage = readFileSync("server/storage.ts", "utf8");
const scheduler = readFileSync("server/auto-refresh-scheduler.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const revenueWizard = readFileSync("client/src/components/AddRevenueWizardModal.tsx", "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("Salesforce GA4 zero-revenue safety", () => {
  const saveRoute = sliceBetween(
    routes,
    'app.post("/api/campaigns/:id/salesforce/save-mappings"',
    "// Salesforce pipeline proxy",
  );

  it("materializes a verified empty provider result as an explicit zero before atomic save", () => {
    const zeroFallback = "if (platformCtx === 'ga4' && revenueRecordsToInsert.length === 0)";
    const replaceCall = "source = await storage.replaceGa4SalesforceRevenueSourceWithRecords(";

    expect(saveRoute).toContain(zeroFallback);
    expect(saveRoute).toContain("if (records.length > 0)");
    expect(saveRoute).toContain("date: yesterdayUTC(),");
    expect(saveRoute).toContain("revenue: '0.00' as any,");
    expect(saveRoute.indexOf(zeroFallback)).toBeLessThan(saveRoute.indexOf(replaceCall));
    expect(saveRoute).toContain("materializedRecordCount = revenueRecordsToInsert.length;");
    expect(saveRoute).toContain("new Set(revenueRecordsToInsert.map");
  });

  it("fails closed on malformed confirmed rows before changing the saved source", () => {
    const replaceIndex = saveRoute.indexOf("source = await storage.replaceGa4SalesforceRevenueSourceWithRecords(");
    for (const guard of [
      "SALESFORCE_INVALID_CONFIRMED_REVENUE_AMOUNTS",
      "SALESFORCE_INVALID_CONFIRMED_REVENUE_DATES",
      "SALESFORCE_REVENUE_MATERIALIZATION_MISMATCH",
    ]) {
      expect(saveRoute).toContain(guard);
      expect(saveRoute.indexOf(guard)).toBeLessThan(replaceIndex);
    }
    expect(saveRoute).toContain("normalizeStrictUtcDateKey(rec?.[dateFieldChoice])");
  });

  it("enforces the non-empty GA4 Salesforce record invariant before a transaction", () => {
    const replacement = sliceBetween(
      storage,
      "async replaceGa4SalesforceRevenueSourceWithRecords(",
      "async replaceGa4CsvRevenueSourceWithRecords(",
    );
    expect(replacement.indexOf("if (!records.length)")).toBeLessThan(replacement.indexOf("db.transaction"));
    expect(replacement).toContain("Salesforce revenue requires at least one materialized record");
  });

  it("keeps scheduler refresh source-stable and rejects GA4 0/0 materialization", () => {
    const reprocess = sliceBetween(scheduler, "async function reprocessSalesforce(", "async function reprocessShopify(");
    expect(reprocess).toContain("...(sourceId ? { sourceId } : {}),");
    expect(reprocess).toContain("String(mappingConfig.platformContext || 'ga4').trim().toLowerCase() === 'ga4'");
    expect(reprocess).toContain("if (isGa4RevenueSource && materializedRecordCount <= 0)");
    expect(reprocess).not.toContain("if (totalRevenue > 0 && materializedRecordCount <= 0)");
  });

  it("preserves zero as available through reload and downstream totals while the card stays hidden", () => {
    expect(() => assertGa4RevenueMaterializationComplete(
      [{ id: "salesforce-zero", sourceType: "salesforce", isActive: true }],
      [{ revenueSourceId: "salesforce-zero", revenue: "0.00" }],
    )).not.toThrow();
    expect(selectRevenueRecordTotal({ aggregate: 0, attributed: 0, hasAggregate: true })).toBe(0);
    expect(routes).toContain('const hasMaterializedRevenue = totalsBySource.has(sourceId);');
    expect(routes).toContain('materializedRevenueStatus: hasMaterializedRevenue ? "available" : "unavailable"');
    expect(ga4Page).toContain('{materializedRevenueUnavailable ? "Unavailable" : formatMoney(Number(s.revenue || 0))}');
    expect(revenueWizard).toContain("const showSalesforceRevenueSource = false;");
  });
});
