import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createReportPdfArtifact, readReportPdfArtifact, attachReportVerification, readReportVerification, reportSourceSettings } from "./utils/report-pdf-artifact";

describe("Custom Report immutable PDF artifacts", () => {
  const pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(128, 65)]);

  it("round-trips the exact generated PDF bytes", () => {
    const artifact = createReportPdfArtifact(pdf);

    expect(artifact).not.toBeNull();
    expect(readReportPdfArtifact({ pdfArtifact: artifact })).toEqual(pdf);
  });

  it("fails closed for missing, malformed, or altered artifacts", () => {
    const artifact = createReportPdfArtifact(pdf)!;

    expect(readReportPdfArtifact({})).toBeNull();
    expect(readReportPdfArtifact({ pdfArtifact: { ...artifact, byteLength: artifact.byteLength + 1 } })).toBeNull();
    expect(readReportPdfArtifact({ pdfArtifact: { ...artifact, data: `${artifact.data.slice(0, -4)}AAAA` } })).toBeNull();
  });

  it("retains frozen, credential-free inputs bound to the exact PDF and report", () => {
    const report = { id: "report-a", campaignId: "campaign-a", platformType: "google_analytics", reportType: "overview", configuration: {} };
    const input = { report, reportWindow: { startDate: "2026-10-01", endDate: "2026-10-31" },
      scope: { campaignId: "campaign-a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      financial: { spend: 100, conversions: 20 }, summary: {}, trafficWindow: {},
      sourceSettings: { revenue: [], spend: [reportSourceSettings({ id: "source-a", sourceType: "csv", currency: "EUR",
        mappingConfig: JSON.stringify({ spendColumn: "Amount", dateColumn: "Date", accessToken: "secret", campaignMappings: [{ crmValue: "one", refreshToken: "secret" }] }) })] } };
    const bytes = Buffer.from(pdf);
    const artifact = createReportPdfArtifact(attachReportVerification(bytes, input)!);
    const payload = { reportId: report.id, campaignId: report.campaignId, platformType: report.platformType, reportType: report.reportType,
      windowStart: input.reportWindow.startDate, windowEnd: input.reportWindow.endDate, pdfArtifact: artifact };
    input.financial.conversions = 999;
    expect(readReportPdfArtifact(payload)).toEqual(pdf);
    expect(readReportVerification(payload)?.financial.conversions).toBe(20);
    expect(JSON.stringify(artifact)).not.toMatch(/secret|Token/);
    expect(() => readReportVerification({ ...payload, campaignId: "other" })).toThrow("REPORT_VERIFICATION_INVALID");
    artifact!.verification!.inputs.financial.conversions = 21;
    expect(() => readReportVerification(payload)).toThrow("REPORT_VERIFICATION_INVALID");
    expect(readReportVerification({ pdfArtifact: createReportPdfArtifact(pdf) })).toBeNull();
  });

  it("keeps malformed source configuration unavailable without breaking PDF generation", () => {
    expect(reportSourceSettings({ id: "source-a", mappingConfig: "broken json" }).configuration).toBeNull();
  });
  it("survives JSONB object-key reordering but rejects changed values and array order", () => {
    const report = { id: "r", campaignId: "c", platformType: "google_analytics", reportType: "overview", configuration: {} };
    const input = { report, reportWindow: { startDate: "2026-10-01", endDate: "2026-11-06" },
      scope: { campaignId: "c", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" }, financial: { spend: 100, conversions: 20 },
      summary: { rows: [{ z: 1, a: 2 }, { z: 3, a: 4 }] }, trafficWindow: {}, sourceSettings: { revenue: [], spend: [] } };
    const payload = { reportId: "r", campaignId: "c", platformType: "google_analytics", reportType: "overview", windowStart: "2026-10-01", windowEnd: "2026-11-06",
      pdfArtifact: createReportPdfArtifact(attachReportVerification(Buffer.from(pdf), input)!) };
    const reorder = (v: any): any => Array.isArray(v) ? v.map(reorder) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).reverse().map(k => [k, reorder(v[k])])) : v;
    const reordered = reorder(payload);
    expect(payload.pdfArtifact!.verification!.version).toBe(2);
    expect(readReportVerification(reordered)).toEqual(input);
    reordered.pdfArtifact.verification.inputs.financial.spend = 101;
    expect(() => readReportVerification(reordered)).toThrow("REPORT_VERIFICATION_INVALID");
    const reversed = reorder(payload); reversed.pdfArtifact.verification.inputs.summary.rows.reverse();
    expect(() => readReportVerification(reversed)).toThrow("REPORT_VERIFICATION_INVALID");
    payload.pdfArtifact!.verification!.version = 1;
    payload.pdfArtifact!.verification!.inputsSha256 = createHash("sha256").update(JSON.stringify(payload.pdfArtifact!.verification!.inputs)).digest("hex");
    expect(readReportVerification(payload)).toEqual(input);
    expect(() => readReportVerification(reorder(payload))).toThrow("REPORT_VERIFICATION_INVALID");
  });
});
