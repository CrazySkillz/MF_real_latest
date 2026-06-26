import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("GA4 Insights anomaly location copy", () => {
  it("explains that anomaly cards appear in the Trend signals group when history is available", () => {
    const content = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
    const categoryStart = content.indexOf("const getInsightCategory =");
    const categoryEnd = content.indexOf("const getInsightDataBasis =", categoryStart);
    const placeholderStart = content.indexOf('id: "anomaly:not-enough-history"');
    const placeholderEnd = content.indexOf("// 4) Positive signals", placeholderStart);
    const categorySection = content.slice(categoryStart, categoryEnd);
    const placeholderSection = content.slice(placeholderStart, placeholderEnd);

    expect(categoryStart).toBeGreaterThan(-1);
    expect(categoryEnd).toBeGreaterThan(categoryStart);
    expect(placeholderStart).toBeGreaterThan(-1);
    expect(placeholderEnd).toBeGreaterThan(placeholderStart);
    expect(categorySection).toContain('id.startsWith("anomaly:")');
    expect(categorySection).toContain(') return "trends";');
    expect(placeholderSection).toContain("Trend signals need more history");
    expect(placeholderSection).toContain("This Trend signals section will show anomaly or positive momentum cards");
    expect(placeholderSection).toContain("Full 7-day vs prior 7-day anomaly checks start after ${INSIGHTS_MIN_HISTORY_DAYS} days.");
  });
});
