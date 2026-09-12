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

describe("HubSpot certification documentation", () => {
  it("records the current exact-source clean boundary while retaining H10d as history", () => {
    const mandatoryStatus = canonical.slice(canonical.indexOf("## Mandatory status"), canonical.indexOf("## Authority and evidence rules"));
    const certificationGate = canonical.slice(canonical.lastIndexOf("## Certification gate"));

    expect(mandatoryStatus).toContain("Current status: CLEAN-CERTIFIED for the five exact active GA4 HubSpot revenue");
    expect(mandatoryStatus).toContain("490c8ae685821389d1f433a5943f856478f52e5c");
    expect(mandatoryStatus).toContain("The former clean certification remains historical bounded evidence");
    expect(canonical).toContain("0df257a6fe47f65e1489ede6202a954588ad3c65");
    expect(certificationGate).toContain("Current decision: CLEAN-CERTIFIED for the five exact active GA4 HubSpot revenue sources");
    expect(certificationGate).toContain("no global scheduler-health claim is made");
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

  it("keeps GA4 entry points aligned to the current exact-source clean boundary", () => {
    const expectedStatusByFile = new Map([
      ["README.md", "HubSpot Revenue status: **CLEAN-CERTIFIED for five exact active GA4 HubSpot sources and their exercised configurations**"],
      ["OVERVIEW.md", "HubSpot contribution path is clean-certified only for the five exact active GA4 sources"],
      ["OVERVIEW_PRODUCTION_READINESS.md", "HubSpot Revenue is clean-certified only for the five exact active GA4 sources"],
      ["FINANCIAL_SOURCES.md", "HubSpot contribution path is clean-certified only for the five exact active GA4 sources"],
      ["KPIS.md", "contribution path is clean-certified only for the five exact active GA4 sources"],
      ["BENCHMARKS.md", "contribution path is clean-certified only for the five exact active GA4 sources"],
    ]);
    for (const { file, content } of readinessEntryPoints) {
      expect(content, file).toContain("GA4/OVERVIEW_REVENUE_HUBSPOT_PRODUCTION_READINESS.md");
      expect(content, file).toContain(expectedStatusByFile.get(file));
    }

    expect(readinessEntryPoints.find(({ file }) => file === "KPIS.md")?.content).not.toContain("deployed KPI row evidence remains pending");
    expect(readinessEntryPoints.find(({ file }) => file === "BENCHMARKS.md")?.content).not.toContain("deployed Benchmark row evidence remains pending");
    expect(canonical).toContain("Historical H10d baseline (history only)");
  });
});
