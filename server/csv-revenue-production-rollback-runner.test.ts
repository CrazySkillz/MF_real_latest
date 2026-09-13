import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const script = readFileSync(join(process.cwd(), "scripts", "csv-revenue-production-rollback-validation.ts"), "utf8");

describe("CSV Revenue production rollback validation safety", () => {
  it("uses the exact storage replacement inside nested rollback-only production transaction guards", () => {
    expect(script).toContain('const REQUIRED_CONFIRMATION = "ROLLBACK_ONLY_NO_COMMITTED_TEST_DATA"');
    expect(script).toContain('execFileSync("git", ["rev-parse", "HEAD"]');
    expect(script).toContain('execFileSync("git", ["diff", "--quiet", "--", "server/storage.ts"]');
    expect(script).toContain("await outerTx.transaction(async (nestedTx: any) => callback(nestedTx))");
    expect(script).toContain("storage.replaceGa4CsvRevenueSourceWithRecords(");
    expect(script).toContain("revenue: null");
    expect(script).toContain('nestedFailureCode === "23502"');
    expect(script).toContain('sourceAfterRollback?.mappingConfig === originalMappingConfig');
    expect(script).toContain('recordsAfterRollback.length === 1');
    expect(script).toContain('rollback.code = "CSV_REVENUE_VALIDATION_OUTER_ROLLBACK"');
    expect(script).toContain("JSON.stringify(after) === JSON.stringify(before)");
    expect(script).toContain("leakedSource.rowCount === 0 && leakedRecord.rowCount === 0");
    expect(script.indexOf("const after = await readCampaignCsvState()")).toBeLessThan(script.indexOf('storageError?.code === "CSV_REVENUE_VALIDATION_OUTER_ROLLBACK"'));
  });
});
