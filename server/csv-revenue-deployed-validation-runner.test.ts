import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const runner = readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf-8");
const script = readFileSync(join(process.cwd(), "scripts", "csv-revenue-deployed-authorized-validation.ts"), "utf-8");

describe("CSV Revenue deployed validation runner", () => {
  it("captures exact target-source lifecycle and revenue endpoint parity without mutating data", () => {
    expect(runner).toContain('var VERSION = "2026-07-31.13";');
    expect(runner).toContain("async function csvRevenueBefore(label, config)");
    expect(runner).toContain("async function csvRevenueAfter(label, config)");
    expect(runner).toContain("targetRevenueSourceStateBeforeMatches");
    expect(runner).toContain("targetRevenueAmountMatchesExpected");
    expect(runner).toContain("targetRevenueAmountDeltaMatchesExpected");
    expect(runner).toContain("csvSources: buildCsvRevenueSources");
    expect(runner).toContain("beforeRevenueToDateMatchesBreakdown");
    expect(runner).toContain("afterRevenueToDateMatchesBreakdown");
    expect(runner).toContain("expectSpendUnchanged: true");
    expect(runner).toContain("csvRevenueBefore: csvRevenueBefore");
    expect(runner).toContain("csvRevenueAfter: csvRevenueAfter");
  });

  it("keeps the CSV inventory evidence helper GET-only and fails unexpected findings", () => {
    const start = runner.indexOf("async function csvRevenueInventory(config)");
    const end = runner.indexOf("async function csvRevenueBefore", start);
    const helper = runner.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(helper).toContain("/ga4-overview/source-damage-inventory");
    expect(helper).toContain("activeAndReconciliationFindingsClear");
    expect(helper).toContain("inactiveFindingsMatchExpectedBoundary");
    expect(helper).toContain("automaticCleanupBlocked");
    expect(helper).not.toContain('method: "POST"');
    expect(runner).toContain("csvRevenueInventory: csvRevenueInventory");
  });

  it("requires 413 and exact no-mutation evidence for oversized preview and process requests", () => {
    expect(script).toContain('COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true)');
    expect(script).toContain('ARRAY_AGG(DISTINCT s.id::text ORDER BY s.id::text)');
    expect(script).toContain('assertCheck("tenMiBPreviewReturns413", previewFileLimit.status === 413');
    expect(script).toContain('assertCheck("tenMiBProcessReturns413", processFileLimit.status === 413');
    expect(script).toContain('assertCheck("tenMiBRequestsDoNotMutate", JSON.stringify(fileLimitDbAfter) === JSON.stringify(fileLimitDbBefore)');
    expect(script).not.toContain("[400, 413, 500].includes");
  });
});
