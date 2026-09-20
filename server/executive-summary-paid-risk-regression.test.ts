import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Executive Summary paid-source risk classification", () => {
  it("uses an explicit paid-media category and excludes negative category inference", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");
    const riskStart = page.indexOf("const paidRiskSources = aggregateSources.filter");
    const riskEnd = page.indexOf("const paidSpendTotal", riskStart);
    const riskFilter = page.slice(riskStart, riskEnd);

    expect(riskFilter).toContain('source?.category === "paid_media"');
    expect(riskFilter).not.toContain('source?.category !== "financial"');
    expect(riskFilter).not.toContain('source?.category !== "web_analytics"');
    expect(riskFilter).toContain('["spend", "revenue", "conversions"].some');
  });
});
