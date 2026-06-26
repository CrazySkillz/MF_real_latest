import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

const readScheduledPdf = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

describe("GA4 Insights report parity", () => {
  it("preserves corrected Insights explanatory copy across live UI and report renderers", () => {
    const page = readClient();
    const pdf = readScheduledPdf();

    const liveStart = page.indexOf('<CardTitle className="text-lg">Executive Financials</CardTitle>');
    const liveEnd = page.indexOf("</TabsContent>", liveStart);
    const liveSection = page.slice(liveStart, liveEnd);

    const reportStart = page.indexOf("const renderInsightsSection = () => {");
    const reportEnd = page.indexOf("// ========== KPIs ==========", reportStart);
    const reportSection = page.slice(reportStart, reportEnd);

    const scheduledStart = pdf.indexOf("if (sections.insights) {");
    const scheduledEnd = pdf.indexOf("if (sections.kpis) {", scheduledStart);
    const scheduledSection = pdf.slice(scheduledStart, scheduledEnd);

    expect(liveStart).toBeGreaterThan(-1);
    expect(liveEnd).toBeGreaterThan(liveStart);
    expect(reportStart).toBeGreaterThan(-1);
    expect(reportEnd).toBeGreaterThan(reportStart);
    expect(scheduledStart).toBeGreaterThan(-1);
    expect(scheduledEnd).toBeGreaterThan(scheduledStart);

    const expectedCopy = [
      "Daily shows day-by-day values. 7d/30d show rolling totals for non-rate metrics and weighted averages for rates. Monthly compares calendar months.",
      "Completed-day cutoff",
      "Current GA4 total",
      "Total across revenue sources",
    ];

    for (const section of [liveSection, reportSection, scheduledSection]) {
      for (const copy of expectedCopy) {
        expect(section).toContain(copy);
      }
      expect(section).not.toContain("or imported revenue-to-date when GA4 revenue is missing");
      expect(section).not.toContain("Data through");
      expect(section).not.toContain("7d/30d show rolling daily averages");
      expect(section).not.toContain("financialRevenue / Math.max");
      expect(section).not.toContain("/day avg");
    }
    expect(page).toContain("if (hasRevenue) return `Uses total revenue from ${revenueText}; no spend source is connected.`;");
    expect(liveSection).toContain("{executiveFinancialsDescription}");
    expect(reportSection).toContain("wrapPdfText(executiveFinancialsDescription, CW - 8)");
    expect(pdf).toContain("buildExecutiveFinancialsDescription(spendSourceLabels, revenueSourceLabels)");
    expect(scheduledSection).toContain("payload.executiveFinancialsDescription");
    expect(reportSection).toContain("const yAxisMax = yTickStep * 4;");
    expect(reportSection).toContain("doc.setDrawColor(59, 130, 246)");
    expect(reportSection).toContain("doc.setDrawColor(241, 245, 249)");
    expect(reportSection).not.toContain("const minVal = Math.min(...vals)");
    expect(reportSection).not.toContain("doc.circle(px, py, 0.7");
    expect(pdf).toContain("const yAxisMax = yTickStep * 4;");
    expect(pdf).toContain("doc.setDrawColor(59, 130, 246)");
    expect(pdf).toContain("label: String(row?.date || \"\").slice(5)");
    expect(pdf).not.toContain("const min = Math.min(...values, 0)");
    expect(pdf).not.toContain("normalized = max === min");
  });

  it("keeps capped report findings transparent and evidence-aware", () => {
    const page = readClient();
    const pdf = readScheduledPdf();

    const reportStart = page.indexOf("const renderInsightsSection = () => {");
    const reportEnd = page.indexOf("// ========== KPIs ==========", reportStart);
    const reportSection = page.slice(reportStart, reportEnd);

    const scheduledStart = pdf.indexOf("if (sections.insights) {");
    const scheduledEnd = pdf.indexOf("if (sections.kpis) {", scheduledStart);
    const scheduledSection = pdf.slice(scheduledStart, scheduledEnd);

    expect(reportSection).toContain("const top = items.slice(0, 12);");
    expect(reportSection).toContain("+ ${items.length - top.length} more insights");
    expect(reportSection).toContain("Basis: ${basis}");
    expect(reportSection).toContain("Confidence: ${confidence}");
    expect(reportSection).toContain("Recommended check: ${rec}");

    expect(scheduledSection).toContain("const topInsights = payload.insightsItems.slice(0, 8);");
    expect(scheduledSection).toContain("+ ${payload.insightsItems.length - topInsights.length} more insights");
    expect(scheduledSection).toContain("Basis: ${String(item.dataBasis)}");
    expect(scheduledSection).toContain("Confidence: ${String(item.confidence)}");
    expect(scheduledSection).toContain("Recommended check: ${String(item.recommendation || \"\")}");
  });
});
