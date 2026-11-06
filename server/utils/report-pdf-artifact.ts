import { createHash } from "node:crypto";

const MAX_REPORT_PDF_BYTES = 25 * 1024 * 1024;
const verificationKey = Symbol("report-verification");
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

// Capture only report inputs, never connection credentials or delivery recipients.
export function reportSourceSettings(source: any) {
  let config: any;
  try { config = typeof source?.mappingConfig === "string" ? JSON.parse(source.mappingConfig || "{}") : source?.mappingConfig || {}; }
  catch { config = null; }
  const keys = ["platformContext", "connectionId", "spreadsheetId", "sheetName", "revenueColumn", "spendColumn", "dateColumn", "campaignColumn", "campaignValue", "campaignValues",
    "campaignField", "campaignProperty", "selectedValues", "revenueField", "revenueProperty", "dateField", "stageIds", "currency", "days", "mode", "lastSyncedAt",
    "dailyMaterialization", "revenueMetric", "orderDateBasis", "currencyBasis", "orderWindowStart", "valueSource", "campaignMappings", "campaignValueRevenueTotals"];
  return { id: source?.id || source?.sourceId, type: source?.sourceType, currency: source?.currency,
    platformContext: source?.platformContext || "ga4", configuration: config && typeof config === "object"
      ? Object.fromEntries(keys.filter(key => config[key] !== undefined).map(key => [key, config[key]])) : null };
}

export function attachReportVerification(buffer: Buffer | null, inputs: Record<string, any>): Buffer | null {
  if (!buffer) return buffer;
  const saved = JSON.parse(JSON.stringify(inputs, (key, value) => /token|secret|password|credential|authorization|recipients/i.test(key) ? undefined : value instanceof Map ? Object.fromEntries(value) : value));
  Object.defineProperty(buffer, verificationKey, { value: { version: 1, pdfSha256: digest(buffer), inputsSha256: digest(JSON.stringify(saved)), inputs: saved } });
  return buffer;
}

export function readReportVerification(payload: any): Record<string, any> | null {
  const receipt = payload?.pdfArtifact?.verification;
  if (!receipt) return null;
  const buffer = readReportPdfArtifact(payload), input = receipt.inputs;
  if (receipt.version !== 1 || !buffer || !input || receipt.pdfSha256 !== digest(buffer)
    || receipt.inputsSha256 !== digest(JSON.stringify(input)) || input.report?.id !== payload.reportId
    || input.report?.campaignId !== payload.campaignId || input.report?.platformType !== payload.platformType
    || input.report?.reportType !== payload.reportType || input.reportWindow?.startDate !== payload.windowStart
    || input.reportWindow?.endDate !== payload.windowEnd) throw new Error("REPORT_VERIFICATION_INVALID");
  if (input.scope?.campaignId !== payload.campaignId || !/^[A-Z]{3}$/.test(input.scope?.currency || "")
    || !input.report?.configuration || !input.scope?.reportingTimeZone) return null;
  if (payload.platformType === "google_analytics" && (!input.financial || !input.summary || !input.trafficWindow
    || !Array.isArray(input.sourceSettings?.revenue) || !Array.isArray(input.sourceSettings?.spend)
    || [...input.sourceSettings.revenue, ...input.sourceSettings.spend].some((source: any) => !source.id || !source.configuration))) return null;
  return input;
}

export type ReportPdfArtifactV1 = {
  version: "report_pdf_base64_v1";
  contentType: "application/pdf";
  byteLength: number;
  data: string;
  verification?: Record<string, any>;
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
    ...((buffer as any)[verificationKey] ? { verification: (buffer as any)[verificationKey] } : {}),
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
