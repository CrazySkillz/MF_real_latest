import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const runner = readFileSync(join(process.cwd(), "client", "public", "ga4-overview-validation-runner.js"), "utf-8");

describe("CSV Revenue deployed validation runner", () => {
  it("captures exact target-source lifecycle and revenue endpoint parity without mutating data", () => {
    expect(runner).toContain('var VERSION = "2026-07-12.6";');
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
});
