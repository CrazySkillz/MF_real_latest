import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { createHash } from "node:crypto";
import { attachReportVerification, createReportPdfArtifact, readReportVerification } from "./utils/report-pdf-artifact";
import { checkReportTextNumbers, checkSavedReportNumbers, separateReviewedReportHistory, restoreLegacyReportInputOrder } from "./live-number-report-checks";
import { monitorHash, type NumberCheck } from "./live-number-checks";

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

describe("reviewed historical gaps stay visible without disabling current alerts", () => {
  const fixture = async () => {
    const doc = new jsPDF(); doc.text(overview.split("\n"), 10, 10);
    const bytes = Buffer.from(doc.output("arraybuffer"));
    const payload = { campaignId: "a", reportId: "old-report", platformType: "google_analytics", reportType: "overview",
      windowStart: "2026-10-01", windowEnd: "2026-10-30", pdfArtifact: createReportPdfArtifact(bytes) };
    const original = { id: "old-snapshot", ...payload, generatedAt: "2026-10-31T08:00:00Z", snapshotJson: JSON.stringify(payload) };
    const replacementPayload = { ...payload, reportId: "new-report", windowEnd: "2026-11-06" };
    replacementPayload.pdfArtifact = createReportPdfArtifact(attachReportVerification(bytes, {
      scope: { campaignId: "a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      report: { id: "new-report", campaignId: "a", platformType: "google_analytics", reportType: "overview", configuration: {} },
      reportWindow: { startDate: replacementPayload.windowStart, endDate: replacementPayload.windowEnd },
      financial: { spend: 100, spendAvailable: true, conversions: 12.5 }, summary: {}, trafficWindow: {},
      campaignRows: [{ name: "campaign one", sessions: 100, sessionKeyEventRateWeighted: 12.5 }], sourceSettings: { revenue: [], spend: [] },
    })!);
    const replacement = { ...original, id: "new-snapshot", reportId: "new-report", windowEnd: "2026-11-06", generatedAt: "2026-11-07T10:00:00Z", snapshotJson: JSON.stringify(replacementPayload) };
    const snapshot = { campaign: { id: "a" }, rows: { reportSnapshots: [original, replacement] } };
    const review = { snapshotHash: monitorHash(original.id), payloadSha256: createHash("sha256").update(original.snapshotJson).digest("hex"),
      replacementHash: monitorHash(replacement.id), replacementPdfSha256: replacementPayload.pdfArtifact!.verification!.pdfSha256 };
    const checks: NumberCheck[] = [...await checkSavedReportNumbers(snapshot),
      { section: "Reports", code: "HISTORICAL_SOURCE_SETTINGS_NOT_RECORDED", subject: review.snapshotHash, status: "unverified" },
      { section: "Reports", code: "SAVED_VERIFICATION_INPUTS", subject: review.replacementHash, status: "passed" }];
    return { snapshot, review, checks, original, replacement };
  };
  it("keeps historical findings unverified and leaves all numeric checks intact", async () => {
    const { snapshot, review, checks } = await fixture(), before = JSON.stringify({ snapshot, checks });
    const result = separateReviewedReportHistory(snapshot, checks, [review]);
    expect(result.historicalChecks).toHaveLength(3);
    expect(result.historicalChecks.every(c => c.status === "unverified")).toBe(true);
    expect(result.checks.every(c => c.status === "passed")).toBe(true);
    expect(JSON.stringify({ snapshot, checks })).toBe(before);
    expect(separateReviewedReportHistory(snapshot, checks).checks).toEqual(checks);
  });
  it.each(["original-bytes", "replacement-bytes", "owner", "type", "missing-replacement", "newer-original", "replacement-failure"])("fails closed when %s changes", async change => {
    const { snapshot, review, checks, original, replacement } = await fixture();
    if (change === "original-bytes") original.snapshotJson += " ";
    if (change === "replacement-bytes") review.replacementPdfSha256 = "0".repeat(64);
    if (change === "owner") snapshot.campaign.id = "other";
    if (change === "type") replacement.reportType = "ads";
    if (change === "missing-replacement") snapshot.rows.reportSnapshots.pop();
    if (change === "newer-original") original.generatedAt = "2026-11-08T00:00:00Z";
    if (change === "replacement-failure") checks.push({ section: "Reports / PDF numbers", code: "FINANCIAL_ROAS", subject: review.replacementHash, status: "difference" });
    const result = separateReviewedReportHistory(snapshot, checks, [review]);
    expect(result.historicalChecks).toEqual([]);
    expect(result.checks).toContainEqual(expect.objectContaining({ code: "HISTORICAL_REVIEW_LINK_INVALID", status: "unverified" }));
  });
  it("never hides old or new numerical errors, unknown gaps, or provider failures", async () => {
    const { snapshot, review, checks } = await fixture();
    const failures: NumberCheck[] = [
      { section: "Reports / PDF numbers", code: "FINANCIAL_ROAS", status: "difference", subject: review.snapshotHash },
      { section: "Reports / PDF numbers", code: "PDF_CONTENT_UNVERIFIED", status: "unverified", subject: review.snapshotHash },
      { section: "Reports", code: "HISTORICAL_SOURCE_SETTINGS_NOT_RECORDED", status: "unverified", subject: monitorHash("unreviewed") },
      { section: "GA4 provider", code: "SOURCE_TOTAL_sessions", status: "difference" },
    ];
    const result = separateReviewedReportHistory(snapshot, [...checks, ...failures], [review]);
    for (const failure of failures) expect(result.checks).toContainEqual(failure);
  });
  it.each([false, true])("recovers only key order when original values were changed=%s", async tampered => {
    const { snapshot, replacement } = await fixture();
    const payload = JSON.parse(replacement.snapshotJson), receipt = payload.pdfArtifact.verification;
    receipt.version = 1; receipt.inputsSha256 = createHash("sha256").update(JSON.stringify(receipt.inputs)).digest("hex");
    replacement.snapshotJson = JSON.stringify(payload);
    const reorder = (v: any): any => Array.isArray(v) ? v.map(reorder) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reorder(v[k])])) : v;
    const legacy = reorder(payload); if (tampered) legacy.pdfArtifact.verification.inputs.financial.spend++;
    const target = { ...replacement, id: "legacy-order", snapshotJson: JSON.stringify(legacy) };
    snapshot.rows.reportSnapshots.push(target); const before = JSON.stringify(snapshot);
    expect(() => readReportVerification(legacy)).toThrow();
    const restored = restoreLegacyReportInputOrder(snapshot).rows.reportSnapshots.find(x => x.id === target.id)!;
    if (tampered) expect(restored.snapshotJson).toBe(target.snapshotJson);
    else expect(readReportVerification(JSON.parse(restored.snapshotJson))).toEqual(receipt.inputs);
    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

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
  it("checks saved financial conversion and session-key-event bases without using today's settings", () => {
    const basis = { scope: { currency: "EUR" }, financial: { spend: 100, spendAvailable: true, conversions: 20 },
      campaignRows: [{ name: "campaign one", sessions: 100, sessionKeyEventRateWeighted: 1 }] };
    const text = overview.replace("EUR 8.00", "EUR 5.00").replace("12.5 12.5%", "12.5 1.0%");
    const checks = checkReportTextNumbers(text, "overview", basis);
    expect(checks.filter(c => c.status !== "passed")).toEqual([]);
    expect(checks).toContainEqual(expect.objectContaining({ code: "FINANCIAL_CPA", status: "passed" }));
    expect(checkReportTextNumbers(text.replace("EUR 5.00", "EUR 8.00"), "overview", basis)).toContainEqual(expect.objectContaining({ code: "FINANCIAL_CPA", status: "difference" }));
    expect(checkReportTextNumbers(text.replace("12.5 1.0%", "12.5 12.5%"), "overview", basis)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_SESSION_KEY_EVENT_RATE", status: "difference" }));
    expect(checkReportTextNumbers(text, "overview").filter(c => c.status === "unverified")).toHaveLength(2);
  });
  it("verifies the new saved formula using its retained receipt and keeps older receipts unchanged", () => {
    const basis = { comparisonRateDefinition: "conversions_per_session", scope: { currency: "EUR" },
      financial: { spend: 100, spendAvailable: true, conversions: 12.5 },
      campaignRows: [{ name: "campaign one", sessions: 100, conversions: 12.5, sessionKeyEventRateWeighted: 1 }] };
    expect(checkReportTextNumbers(overview, "overview", basis).filter(c => c.status !== "passed")).toEqual([]);
    expect(checkReportTextNumbers(overview.replace("12.5 12.5%", "12.5 1.0%"), "overview", basis))
      .toContainEqual(expect.objectContaining({ code: "CAMPAIGN_SESSION_KEY_EVENT_RATE", status: "difference" }));
    expect(checkReportTextNumbers(overview, "overview", { ...basis, comparisonRateDefinition: undefined }))
      .toContainEqual(expect.objectContaining({ code: "CAMPAIGN_SESSION_KEY_EVENT_RATE", status: "difference" }));
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
