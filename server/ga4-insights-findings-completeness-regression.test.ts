import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

const readScheduledPdf = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

describe("GA4 Insights findings completeness visibility", () => {
  it("discloses when the live What to investigate next list is capped", () => {
    const page = readClient();
    const renderStart = page.indexOf('<CardTitle className="text-lg">What to investigate next</CardTitle>');
    const renderEnd = page.indexOf("</CardContent>", renderStart);
    const section = page.slice(renderStart, renderEnd);

    expect(renderStart).toBeGreaterThan(-1);
    expect(renderEnd).toBeGreaterThan(renderStart);
    expect(section).toContain("const visibleInsights = insights.slice(0, 12);");
    expect(section).toContain("insights.length > visibleInsights.length");
    expect(section).toContain("+ {insights.length - visibleInsights.length} more insights not shown in this summary.");
    expect(section).toContain("visibleInsights.filter((i) => i.category === group.key)");
    expect(section).toContain("Basis: {i.dataBasis}");
    expect(section).toContain("Confidence: {i.confidence}");
  });

  it("keeps report output from silently hiding capped findings", () => {
    const page = readClient();
    const pdf = readScheduledPdf();

    const liveReportStart = page.indexOf("const renderInsightsSection = () => {");
    const liveReportEnd = page.indexOf("// ========== KPIs ==========", liveReportStart);
    const liveReport = page.slice(liveReportStart, liveReportEnd);

    expect(liveReportStart).toBeGreaterThan(-1);
    expect(liveReportEnd).toBeGreaterThan(liveReportStart);
    expect(liveReport).toContain("const top = items.slice(0, 12);");
    expect(liveReport).toContain("items.length > top.length");
    expect(liveReport).toContain("+ ${items.length - top.length} more insights");

    expect(pdf).toContain("return items;");
    expect(pdf).not.toContain("return items.slice(0, 8);");
    expect(pdf).toContain("const topInsights = payload.insightsItems.slice(0, 8);");
    expect(pdf).toContain("payload.insightsItems.length > topInsights.length");
    expect(pdf).toContain("+ ${payload.insightsItems.length - topInsights.length} more insights");
    expect(pdf).toContain("items: topInsights.filter((item: any) => item.category === group.key)");
  });
});
