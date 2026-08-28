const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;

export type ReportPdfArtifactV1 = {
  version: "report_pdf_base64_v1";
  contentType: "application/pdf";
  byteLength: number;
  data: string;
};

const isPdfBuffer = (buffer: Buffer): boolean =>
  buffer.length > 100
  && buffer.length <= MAX_REPORT_PDF_BYTES
  && buffer.subarray(0, 4).toString("ascii") === "%PDF";

export function createReportPdfArtifact(buffer: Buffer): ReportPdfArtifactV1 | null {
  if (!Buffer.isBuffer(buffer) || !isPdfBuffer(buffer)) return null;
  return {
    version: "report_pdf_base64_v1",
    contentType: "application/pdf",
    byteLength: buffer.length,
    data: buffer.toString("base64"),
  };
}

export function readReportPdfArtifact(payload: any): Buffer | null {
  const artifact = payload?.pdfArtifact;
  if (artifact?.version !== "report_pdf_base64_v1" || artifact?.contentType !== "application/pdf") return null;
  const data = typeof artifact.data === "string" ? artifact.data : "";
  if (!data || data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const buffer = Buffer.from(data, "base64");
  if (!isPdfBuffer(buffer) || buffer.length !== artifact.byteLength || buffer.toString("base64") !== data) return null;
  return buffer;
}
