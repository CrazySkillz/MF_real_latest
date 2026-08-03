import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.resolve(process.cwd(), file), "utf8");

describe("GA4 Insights deterministic scheduler production evidence guard", () => {
  it("keeps validation campaign-scoped and revision-bound", () => {
    const script = read("scripts/ga4-insights-scheduler-validation.ts");

    expect(script).toContain("GA4_INSIGHTS_EXPECTED_SHA");
    expect(script).toContain("ga4-daily-scheduler/run-now");
    expect(script).toContain('run.body?.after?.lastRunStatus !== "success"');
    expect(script).toContain('certificationStatus !== "validation_output_only"');
    expect(script).toContain("Post-run completed-day window parity failed");
  });
});
