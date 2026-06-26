import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = () =>
  readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");

const readScheduledPdf = () =>
  readFileSync(join(process.cwd(), "server", "ga4-scheduled-report-pdf.ts"), "utf-8");

describe("GA4 Insights Data Summary accuracy", () => {
  it("does not present additive to-date revenue as an exact daily average", () => {
    const page = readClient();
    const pdf = readScheduledPdf();

    const liveStart = page.indexOf('<CardTitle className="text-lg">Data Summary</CardTitle>');
    const liveEnd = page.indexOf("{channelAnalysis && channelAnalysis.channels", liveStart);
    const liveSection = page.slice(liveStart, liveEnd);

    const downloadStart = page.indexOf('sectionTitle("Data Summary", C.insights);');
    const downloadEnd = page.indexOf("if (channelAnalysis?.channels", downloadStart);
    const downloadSection = page.slice(downloadStart, downloadEnd);

    const scheduledStart = pdf.indexOf('"Data Summary",');
    const scheduledEnd = pdf.indexOf("if (includeActions)", scheduledStart);
    const scheduledSection = pdf.slice(scheduledStart, scheduledEnd);

    expect(liveStart).toBeGreaterThan(-1);
    expect(liveEnd).toBeGreaterThan(liveStart);
    expect(downloadStart).toBeGreaterThan(-1);
    expect(downloadEnd).toBeGreaterThan(downloadStart);
    expect(scheduledStart).toBeGreaterThan(-1);
    expect(scheduledEnd).toBeGreaterThan(scheduledStart);

    for (const section of [liveSection, downloadSection, scheduledSection]) {
      expect(section).toContain("Total across revenue sources");
      expect(section).toContain("Current GA4 total");
      expect(section).not.toContain("financialRevenue / Math.max");
      expect(section).not.toContain("/day avg");
    }
    expect(page).not.toContain("const avgDailyRev = Number(financialRevenue) / Math.max(availDays, 1);");
    expect(page).not.toContain("Averaging ~${formatMoney(avgDailyRev)}/day over ${availDays} days.");
    expect(page).toContain("Revenue-to-date uses GA4 native revenue plus imported revenue sources.");
  });

  it("preserves the Executive Financials additive revenue calculation", () => {
    const page = readClient();
    const pdf = readScheduledPdf();

    expect(page).toContain("const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;");
    expect(pdf).toContain("const financialRevenue = Number((ga4RevenueForFinancials + importedRevenueForFinancials).toFixed(2));");
  });
});
