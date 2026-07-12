import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const canonical = readFileSync(join(process.cwd(), "GA4", "OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md"), "utf8");
const runnerDoc = readFileSync(join(process.cwd(), "GA4", "OVERVIEW_VALIDATION_RUNNER.md"), "utf8");
const readinessEntryPoints = [
  "README.md",
  "OVERVIEW.md",
  "OVERVIEW_PRODUCTION_READINESS.md",
  "FINANCIAL_SOURCES.md",
  "KPIS.md",
  "BENCHMARKS.md",
].map((file) => ({ file, content: readFileSync(join(process.cwd(), "GA4", file), "utf8") }));

describe("HubSpot H10d final certification documentation", () => {
  it("records one durable bounded certification status without suppressing exclusions", () => {
    const mandatoryStatus = canonical.slice(canonical.indexOf("## Mandatory status"), canonical.indexOf("## Authority and evidence rules"));
    const certificationGate = canonical.slice(canonical.lastIndexOf("## Certification gate"));

    expect(mandatoryStatus).toContain("clean-certified and production-ready for the validated");
    expect(mandatoryStatus).not.toContain("not clean-certified");
    expect(certificationGate).toContain("0df257a6fe47f65e1489ede6202a954588ad3c65");
    expect(certificationGate).toContain("clean-certified and production-ready for the validated documented scope");
    expect(canonical).toContain("### Current Commit H10d — final reconciliation");
    expect(canonical).toContain("GA4-native daily-table freshness");
    expect(canonical).toContain("Future and non-certified boundaries");
    expect(canonical).toContain("Implementation alignment at H10d");
    expect(canonical).toContain("server/utils/hubspot-pagination.ts");
    expect(canonical).toContain("server/utils/campaign-current-values.ts");
    expect(canonical).toContain("server/ga4-scheduled-report-pdf.ts");
  });

  it("keeps the runner gate diagnostic separate from the final evidence reconciliation", () => {
    expect(runnerDoc).toContain("### Current Commit H10d final reconciliation");
    expect(runnerDoc).toContain("remaining open-category count is retained as a diagnostic");
    expect(runnerDoc).toContain("No additional runner or UI action is required");
    expect(runnerDoc).toContain("future simultaneous provider mutations require fresh scoped evidence");
  });

  it("keeps GA4 entry points aligned to the canonical bounded status", () => {
    for (const { file, content } of readinessEntryPoints) {
      expect(content, file).toContain("GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md");
      expect(content, file).toContain("clean-certified");
      expect(content, file).toContain("production-ready");
    }

    expect(readinessEntryPoints.find(({ file }) => file === "KPIS.md")?.content).not.toContain("deployed KPI row evidence remains pending");
    expect(readinessEntryPoints.find(({ file }) => file === "BENCHMARKS.md")?.content).not.toContain("deployed Benchmark row evidence remains pending");
    expect(readinessEntryPoints.find(({ file }) => file === "OVERVIEW_PRODUCTION_READINESS.md")?.content).toContain("Historical-ledger note");
  });
});
