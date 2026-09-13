import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const audit = readFileSync("scripts/ga4-overview-complete-audit.ts", "utf8");

describe("GA4 Overview Revenue production audit", () => {
  it("keeps the complete audit as the default and requires an explicit Revenue scope", () => {
    expect(audit).toContain("process.env.GA4_OVERVIEW_AUDIT_SCOPE || 'complete'");
    expect(audit).toContain("const revenueOnly = AUDIT_SCOPE === 'revenue'");
    expect(audit).toContain("GA4_OVERVIEW_AUDIT_SCOPE must be complete or revenue");
  });

  it("limits Revenue certification output to read-only Revenue evidence", () => {
    expect(audit).toContain("await client.query('BEGIN TRANSACTION READ ONLY')");
    expect(audit).toContain("databaseTransaction: 'read only and rolled back'");
    expect(audit).toContain("auditScope: 'revenue'");
    expect(audit).toContain("modalParity: { revenue: true }");
    expect(audit).toContain("excludedFromThisRun: ['Summary', 'Spend', 'Performance', 'Campaign Breakdown', 'Landing Pages', 'Conversion Events', 'Reports']");
    expect(audit).toContain("new Set(['native', 'revenueTotal', 'revenueSources', 'revenueBreakdown'])");
  });
});
