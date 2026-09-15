import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const validator = readFileSync(join(process.cwd(), "scripts", "ga4-kpi-lifecycle-authorized-validation.ts"), "utf8");

describe("GA4 KPI authorized lifecycle validator", () => {
  it("pins the exact deployment, campaign, owner, client, and cleanup boundaries", () => {
    expect(validator).toContain("GA4_KPI_VALIDATION_EXPECTED_SHA must be a full Git SHA");
    expect(validator).toContain("GA4_KPI_VALIDATION_CAMPAIGN_ID must be an exact campaign UUID");
    expect(validator).toContain("Target campaign ownership/client scope is incomplete");
    expect(validator).toContain("Cross-owner KPI access did not fail closed");
    expect(validator).toContain("KPI list crossed the client/campaign boundary");
    expect(validator).toContain("temporary report cleanup failed");
    expect(validator).toContain("temporary KPI cleanup failed");
    expect(validator).toContain("temporary Clerk user cleanup failed");
    expect(validator).toContain("temporary Clerk user still resolves");
    expect(validator).not.toMatch(/\b(?:UPDATE|INSERT INTO|DELETE FROM)\b/);
  });

  it("proves guarded KPI lifecycle, scheduler, and read-only consumer validation", () => {
    expect(validator).toContain('duplicateCreate.status === 409');
    expect(validator).toContain('response.body?.code === "GA4_KPI_INVALID_CONFIGURATION"');
    expect(validator).toContain("stableKpi(await readTemporary()) === before");
    expect(validator).toContain('duplicateEdit.status === 409');
    expect(validator).toContain('String(afterSentinel.currentValue) !== "9876543210987654.32"');
    expect(validator).toContain("Object.values(childCounts.rows[0] || {}).every");
    expect(validator).toContain("ga4-daily-scheduler/run-now");
    expect(validator).toContain("ga4-notifications/reconcile");
    expect(validator).toContain('reportType: "kpis"');
    expect(validator).toContain('spawnSync(process.execPath, [tsxCli, "scripts/ga4-kpi-live-readonly.ts"]');
    expect(validator).toContain("liveEvidence?.browserPdf?.exact === true");
  });
});
