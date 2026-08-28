import { describe, expect, it } from "vitest";
import { createReportPdfArtifact, readReportPdfArtifact } from "./utils/report-pdf-artifact";

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
});
