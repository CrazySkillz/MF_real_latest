import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Performance Summary Overview regression guard", () => {
  it("wires Overview cards to the performanceSummary aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const overviewStart = page.indexOf("{/* Overview Tab */}");
    const overviewEnd = page.indexOf("{/* Campaign Health Tab */}", overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain('const performanceSummary = outcomeTotals?.performanceSummary;');
    expect(page).toContain('const overviewImpressions = getOverviewMetric("impressions", totalImpressions);');
    expect(page).toContain('const overviewSessions = getOverviewMetric("sessions", webSessions);');
    expect(page).toContain('const overviewConversions = getOverviewMetric("conversions", totalConversions);');
    expect(page).toContain('const overviewSpend = getOverviewMetric("spend", totalSpend);');
    expect(overview).toContain("formatOverviewValue(overviewImpressions");
    expect(overview).toContain("formatOverviewValue(overviewSessions");
    expect(overview).toContain("formatOverviewValue(overviewConversions");
    expect(overview).toContain("formatOverviewValue(overviewSpend");
    expect(overview).toContain("overviewSourceLabel(overviewConversions");
    expect(overview).not.toContain("LinkedIn: {linkedinConversions.toLocaleString()} | CI: {ciConversions.toLocaleString()}");
  });

  it("selects the campaign KPI with the largest under-target gap as the top priority", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");

    expect(page).toContain("const gapA = parseNum(a.targetValue) - parseNum(a.currentValue);");
    expect(page).toContain("const gapB = parseNum(b.targetValue) - parseNum(b.currentValue);");
    expect(page).toContain("return gapB - gapA;");
  });
});
