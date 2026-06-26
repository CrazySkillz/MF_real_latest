import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

const readScheduledPdf = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

describe("GA4 Insights copy accuracy", () => {
  it("describes Executive Financials from the actual connected spend and revenue sources", () => {
    const page = readClient();
    const scheduledPdf = readScheduledPdf();
    const sectionStart = page.indexOf('<CardTitle className="text-lg">Executive Financials</CardTitle>');
    const sectionEnd = page.indexOf("{/* Trends card", sectionStart);
    const section = page.slice(sectionStart, sectionEnd);

    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(page).toContain("const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;");
    expect(section).toContain("{executiveFinancialsDescription}");
    expect(page).toContain("if (hasRevenue) return `Uses total revenue from ${revenueText}; no spend source is connected.`;");
    expect(page).toContain("if (hasSpend && hasRevenue) return `Uses source-backed spend-to-date and total revenue from ${revenueText}.`;");
    expect(page).toContain("wrapPdfText(executiveFinancialsDescription, CW - 8)");
    expect(scheduledPdf).toContain("buildExecutiveFinancialsDescription(spendSourceLabels, revenueSourceLabels)");
    expect(scheduledPdf).toContain("payload.executiveFinancialsDescription");
    expect(page).not.toContain("Uses source-backed spend-to-date and total revenue from GA4 native revenue plus imported revenue sources.");
    expect(scheduledPdf).not.toContain("Uses source-backed spend-to-date and total revenue from GA4 native revenue plus imported revenue sources.");
    expect(page).not.toContain("or imported revenue-to-date when GA4 revenue is missing");
    expect(scheduledPdf).not.toContain("or imported revenue-to-date when GA4 revenue is missing");
  });

  it("describes 7d and 30d Trends as totals for non-rate metrics and weighted averages for rates", () => {
    const page = readClient();
    const scheduledPdf = readScheduledPdf();
    const sectionStart = page.indexOf('<CardTitle className="text-lg">Trends</CardTitle>');
    const sectionEnd = page.indexOf("{/* Trends line chart */}", sectionStart);
    const section = page.slice(sectionStart, sectionEnd);

    expect(sectionStart).toBeGreaterThan(-1);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(section).toContain(
      "Daily shows day-by-day values. 7d/30d show rolling totals for non-rate metrics and weighted averages for rates. Monthly compares calendar months."
    );
    expect(section).toContain("Completed-day cutoff");
    expect(page).toContain("Completed-day cutoff: ${trendsDataThroughLabel}");
    expect(scheduledPdf).toContain("Completed-day cutoff: ${formatReportingDateLabel(payload.insightsFreshness.dataThroughDate)}");
    expect(section).not.toContain("Data through");
    expect(page).not.toContain("Data through: ${trendsDataThroughLabel}");
    expect(scheduledPdf).not.toContain("Data through: ${formatReportingDateLabel(payload.insightsFreshness.dataThroughDate)}");
    expect(page).not.toContain("7d/30d show rolling daily averages");
    expect(page).toContain("Non-rate metrics show rolling window totals (sum of last N days)");
    expect(page).toContain("engagementRate is already a weighted average");
    expect(scheduledPdf).not.toContain("7d/30d show rolling daily averages");
  });
});
