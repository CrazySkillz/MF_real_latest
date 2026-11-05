import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { createReportPdfArtifact } from "./utils/report-pdf-artifact";
import { checkReportTextNumbers, checkSavedReportNumbers } from "./live-number-report-checks";

const overview = `GA4 Overview Report
Summary
SESSIONS
100
CONVERSIONS
12.5
CONV. RATE
12.5%
Revenue & Financial
TOTAL REVENUE
EUR 250.00
TOTAL SPEND
EUR 100.00
Performance
PROFIT
EUR 150.00
ROAS
2.50x
ROI
150%
CPA
EUR 8.00
Campaign Breakdown
CAMPAIGN SESSIONS USERS CONVERSIONS CONV. RATE REVENUE
campaign one 100 90 12.5 12.5% EUR 250.00
Conversion Events`;
const status = (text: string, code: string) => checkReportTextNumbers(text, "overview").find(check => check.code === code)?.status;

describe("numbers in the saved PDF, without regeneration", () => {
  it("checks fractional conversions and independent financial arithmetic", () => {
    expect(checkReportTextNumbers(overview, "overview").filter(check => check.status !== "passed")).toEqual([
      expect.objectContaining({ code: "CPA_HISTORICAL_CONVERSION_BASIS_UNVERIFIED", status: "unverified" }),
      expect.objectContaining({ code: "CAMPAIGN_SESSION_KEY_EVENT_RATE_BASIS_UNVERIFIED", status: "unverified" }),
    ]);
  });
  it.each([
    ["12.5%", "15%", "SUMMARY_CONVERSION_RATE"],
    ["EUR 150.00", "EUR 151.00", "FINANCIAL_PROFIT"],
    ["2.50x", "3.50x", "FINANCIAL_ROAS"],
    ["150%", "151%", "FINANCIAL_ROI"],
  ])("detects a changed %s figure in the published text", (from, to, code) => {
    expect(status(overview.replace(from, to), code)).toBe("difference");
  });
  it("does not substitute key-event count per session for GA4 session key-event rate", () => {
    const text = overview.replace("12.5 12.5%", "12.5 1%");
    expect(checkReportTextNumbers(text, "overview").some(check => check.status === "difference")).toBe(false);
    expect(status(text, "CAMPAIGN_SESSION_KEY_EVENT_RATE_BASIS_UNVERIFIED")).toBe("unverified");
  });
  it("does not mistake rounded input uncertainty for a proved difference", () => {
    const text = overview.replace("EUR 250.00", "EUR 28,501.50").replace("2.50x", "285.01x");
    expect(status(text, "FINANCIAL_ROAS")).toBe("unverified");
  });
  it("rejects ambiguous labels, currency mismatches and unsupported layouts", () => {
    expect(status(overview + "\nTOTAL REVENUE\nEUR 900.00", "FINANCIAL_ROAS")).toBe("unverified");
    expect(status(overview.replace("EUR 100.00", "USD 100.00"), "FINANCIAL_ROAS")).toBe("unverified");
    expect(checkReportTextNumbers(overview, "custom")[0].status).toBe("unverified");
  });
  it("accepts explicitly unavailable dependent values but never treats unavailable spend as zero", () => {
    const text = overview.replace("EUR 100.00", "Unavailable").replace("EUR 150.00", "Unavailable").replace("2.50x", "—").replace("150%", "Unavailable");
    expect(status(text, "FINANCIAL_ROAS_UNAVAILABLE")).toBe("passed");
    expect(status(text.replace("ROAS\n—", "ROAS\n0x"), "FINANCIAL_ROAS")).toBe("unverified");
  });
  it("reconciles the source table using the currency printed in the PDF", () => {
    const text = "GA4 Ad Comparison Report\nRevenue Breakdown\nSOURCE AMOUNT\nGA4 EUR 10.01\nCSV EUR 20.02\nTOTAL EUR 30.03";
    expect(checkReportTextNumbers(text, "ads")[0].status).toBe("passed");
    expect(checkReportTextNumbers(text.replace("30.03", "40.03"), "ads")[0].status).toBe("difference");
    expect(checkReportTextNumbers(text.replace("CSV EUR", "CSV USD"), "ads")[0].status).toBe("unverified");
    expect(checkReportTextNumbers(text.replace("30.03", "30.02"), "ads")[0].status).toBe("unverified");
  });
  it("compares the Insights revenue card and table without assuming its history window", () => {
    const text = "GA4 Insights Report\nREVENUE\nEUR 2,500.00\nData Summary\nRevenue EUR 2,500.00 Total across revenue sources\nWhat to investigate next";
    expect(checkReportTextNumbers(text, "insights")[0].status).toBe("passed");
    expect(checkReportTextNumbers(text.replace("Revenue EUR 2,500", "Revenue EUR 2,600"), "insights")[0].status).toBe("difference");
  });
  it("reads the actual stored PDF bytes and rejects a cross-campaign artifact", async () => {
    const doc = new jsPDF(); doc.text(overview.split("\n"), 10, 10);
    const payload = { campaignId: "a", reportId: "r", platformType: "google_analytics", reportType: "overview",
      windowStart: "2026-10-05", windowEnd: "2026-11-04", pdfArtifact: createReportPdfArtifact(Buffer.from(doc.output("arraybuffer"))) };
    const report = { id: "snapshot", ...payload, snapshotJson: JSON.stringify(payload) };
    const snapshot = { campaign: { id: "a" }, rows: { reportSnapshots: [report] } };
    const before = JSON.stringify(snapshot);
    const checks = await checkSavedReportNumbers(snapshot);
    expect(checks).toContainEqual(expect.objectContaining({ code: "FINANCIAL_ROAS", status: "passed" }));
    expect(JSON.stringify(snapshot)).toBe(before);
    snapshot.campaign.id = "other";
    expect(await checkSavedReportNumbers(snapshot)).toEqual([expect.objectContaining({ code: "PDF_CONTENT_UNVERIFIED", status: "unverified" })]);
  });
});
