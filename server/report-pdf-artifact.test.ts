import { describe, expect, it } from "vitest";
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
});
