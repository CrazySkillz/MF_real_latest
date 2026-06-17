import { inflateRawSync } from "zlib";
import { parseCsvText } from "../utils/csv";
import { parsePDFMetrics, type ParsedMetrics } from "./pdf-parser";

type MetricKind = "sum" | "single" | "duration";

type MetricDefinition = {
  key: keyof ParsedMetrics;
  labels: string[];
  kind: MetricKind;
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "impressions", labels: ["impressions", "impression"], kind: "sum" },
  { key: "reach", labels: ["reach"], kind: "sum" },
  { key: "clicks", labels: ["clicks", "click"], kind: "sum" },
  { key: "engagements", labels: ["engagements", "engagement"], kind: "sum" },
  { key: "spend", labels: ["spend", "ad spend", "cost", "amount"], kind: "sum" },
  { key: "conversions", labels: ["conversions", "conversion"], kind: "sum" },
  { key: "leads", labels: ["leads", "lead"], kind: "sum" },
  { key: "videoViews", labels: ["video views", "video view", "views"], kind: "sum" },
  { key: "viralImpressions", labels: ["viral impressions", "organic impressions"], kind: "sum" },
  { key: "users", labels: ["users", "unique users", "visitors", "unique visitors"], kind: "sum" },
  { key: "sessions", labels: ["sessions", "visits"], kind: "sum" },
  { key: "pageviews", labels: ["pageviews", "page views", "pages viewed"], kind: "sum" },
  { key: "avgSessionDuration", labels: ["avg session duration", "average session duration", "avg time on site", "average time"], kind: "duration" },
  { key: "pagesPerSession", labels: ["pages/session", "pages per session", "pages per visit"], kind: "single" },
  { key: "bounceRate", labels: ["bounce rate", "exit rate"], kind: "single" },
  { key: "organicSearchShare", labels: ["organic search", "organic traffic", "search engines"], kind: "single" },
  { key: "directBrandedShare", labels: ["direct/branded", "direct branded", "direct traffic", "direct"], kind: "single" },
  { key: "emailShare", labels: ["email traffic", "email share", "email"], kind: "single" },
  { key: "referralShare", labels: ["referral/partners", "referral partners", "referral traffic", "referrals"], kind: "single" },
  { key: "paidShare", labels: ["paid display/search", "paid advertising", "paid traffic", "paid"], kind: "single" },
  { key: "socialShare", labels: ["social media", "social traffic", "social"], kind: "single" },
  { key: "emailsDelivered", labels: ["emails delivered", "emails sent", "delivered"], kind: "sum" },
  { key: "openRate", labels: ["open rate", "opens"], kind: "single" },
  { key: "clickThroughRate", labels: ["click-through rate", "click through rate", "click rate", "ctr"], kind: "single" },
  { key: "clickToOpenRate", labels: ["click-to-open", "click to open", "ctor"], kind: "single" },
  { key: "hardBounces", labels: ["hard bounces", "bounces"], kind: "single" },
  { key: "spamComplaints", labels: ["spam complaints", "complaints"], kind: "single" },
  { key: "listGrowth", labels: ["list growth", "net subscribers", "subscriber growth", "new subscribers"], kind: "sum" },
];

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".csv", ".xlsx"]);

function fileExtension(fileName?: string | null): string {
  const raw = String(fileName || "").toLowerCase().trim();
  const dot = raw.lastIndexOf(".");
  return dot >= 0 ? raw.slice(dot) : "";
}

export function isSupportedCustomIntegrationFile(fileName?: string | null, mimeType?: string | null): boolean {
  const ext = fileExtension(fileName);
  if (SUPPORTED_EXTENSIONS.has(ext)) return true;
  const mime = String(mimeType || "").toLowerCase();
  return mime === "application/pdf" || mime === "text/csv" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

export function supportedCustomIntegrationFileDescription(): string {
  return "PDF, CSV, or XLSX";
}

export async function parseCustomIntegrationFile(buffer: Buffer, fileName?: string | null, mimeType?: string | null): Promise<ParsedMetrics> {
  const ext = fileExtension(fileName);
  const mime = String(mimeType || "").toLowerCase();

  if (ext === ".pdf" || mime === "application/pdf") {
    return parsePDFMetrics(buffer);
  }

  if (ext === ".csv" || mime === "text/csv") {
    return parseDelimitedMetrics(decodeDelimitedBuffer(buffer), "CSV");
  }

  if (ext === ".xlsx" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return parseXlsxMetrics(buffer);
  }

  throw new Error(`Unsupported file type. Upload ${supportedCustomIntegrationFileDescription()} reports.`);
}

function parseDelimitedMetrics(text: string, sourceLabel: string): ParsedMetrics {
  const parsed = parseCsvText(text, 5000);
  const metrics = metricsFromTable(parsed.headers, parsed.rows, sourceLabel);
  if (Number(metrics._extractedFields || 0) > 0) return metrics;
  return parseDelimitedMetricsWithDetectedHeader(text, sourceLabel) || metrics;
}

function metricsFromTable(headers: string[], rows: Array<Record<string, string>>, sourceLabel: string): ParsedMetrics {
  const warnings: string[] = [];
  const metrics: ParsedMetrics = {};
  const metricValue = extractMetricValueRows(headers, rows, warnings);

  if (metricValue) {
    applyMetricValues(metricValue, metrics, warnings, sourceLabel);
  } else {
    applyHeaderRows(headers, rows, metrics, warnings, sourceLabel);
  }

  const extractedFields = Object.entries(metrics).filter(([key, value]) => !key.startsWith("_") && value !== undefined).length;
  metrics._extractedFields = extractedFields;
  metrics._confidence = extractedFields === 0 ? 0 : warnings.length > 0 ? 90 : 100;
  metrics._warnings = extractedFields === 0 ? [`No metrics extracted from ${sourceLabel}`] : warnings;
  metrics._requiresReview = metrics._confidence < 95;
  return metrics;
}

function extractMetricValueRows(headers: string[], rows: Array<Record<string, string>>, warnings: string[]): Map<keyof ParsedMetrics, string[]> | null {
  const metricHeader = headers.find(isMetricLabelHeader);
  const valueHeader = headers.find((header) => header !== metricHeader && isMetricValueHeader(header))
    || (metricHeader && headers.length === 2 ? headers.find((header) => header !== metricHeader) : undefined);
  if (!metricHeader || !valueHeader) return null;

  const values = new Map<keyof ParsedMetrics, string[]>();
  for (const row of rows) {
    const key = resolveMetricKey(row[metricHeader]);
    const rawValue = String(row[valueHeader] || "").trim();
    if (!key || !rawValue) continue;
    const existing = values.get(key) || [];
    existing.push(rawValue);
    values.set(key, existing);
  }

  if (values.size === 0) {
    warnings.push("Metric/value table found, but no supported metric labels were present.");
  }
  return values;
}

function parseDelimitedMetricsWithDetectedHeader(text: string, sourceLabel: string): ParsedMetrics | null {
  const lines = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  let best: ParsedMetrics | null = null;
  const limit = Math.min(lines.length, 50);

  for (let index = 1; index < limit; index++) {
    if (!lines[index]?.trim()) continue;
    const candidate = parseCsvText(lines.slice(index).join("\n"), 5000);
    if (candidate.headers.length < 2 || candidate.rows.length === 0) continue;
    const metrics = metricsFromTable(candidate.headers, candidate.rows, sourceLabel);
    if (Number(metrics._extractedFields || 0) > Number(best?._extractedFields || 0)) {
      best = metrics;
    }
  }

  return Number(best?._extractedFields || 0) > 0 ? best : null;
}

function isMetricLabelHeader(header: string): boolean {
  const normalized = normalizeLabel(header);
  return ["metric", "metrics", "name", "label", "measure", "kpi", "field", "data point"].includes(normalized)
    || normalized.includes("metric")
    || normalized.includes("measure");
}

function isMetricValueHeader(header: string): boolean {
  const normalized = normalizeLabel(header);
  return ["value", "current value", "total", "amount", "metric value"].includes(normalized)
    || normalized.includes("value");
}

function applyHeaderRows(headers: string[], rows: Array<Record<string, string>>, metrics: ParsedMetrics, warnings: string[], sourceLabel: string) {
  const byMetric = new Map<keyof ParsedMetrics, string[]>();
  for (const header of headers) {
    const key = resolveMetricKey(header);
    if (!key) continue;
    const values = rows
      .map((row) => String(row[header] || "").trim())
      .filter(Boolean);
    if (values.length === 0) continue;
    byMetric.set(key, [...(byMetric.get(key) || []), ...values]);
  }
  applyMetricValues(byMetric, metrics, warnings, sourceLabel);
}

function applyMetricValues(valuesByMetric: Map<keyof ParsedMetrics, string[]>, metrics: ParsedMetrics, warnings: string[], sourceLabel: string) {
  for (const definition of METRIC_DEFINITIONS) {
    const values = valuesByMetric.get(definition.key) || [];
    if (values.length === 0) continue;

    if (definition.kind === "duration") {
      if (values.length === 1) {
        (metrics as any)[definition.key] = values[0];
      } else {
        warnings.push(`${definition.labels[0]} has multiple ${sourceLabel} rows and was not imported because duration values require a selected total row.`);
      }
      continue;
    }

    const numericValues = values
      .map(parseMetricNumber)
      .filter((value): value is number => value !== null);
    if (numericValues.length === 0) continue;

    if (definition.kind === "sum") {
      (metrics as any)[definition.key] = Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(2));
      continue;
    }

    if (numericValues.length === 1) {
      (metrics as any)[definition.key] = numericValues[0];
    } else {
      warnings.push(`${definition.labels[0]} has multiple ${sourceLabel} rows and was not imported because rate/ratio values require a selected total or weighted average.`);
    }
  }

  addRangeWarnings(metrics, warnings);
}

function parseMetricNumber(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw);
  let cleaned = raw
    .replace(/[$,%\s]/g, "")
    .replace(/[\u20ac\u00a3\u00a5]/g, "")
    .replace(/[()]/g, "")
    .trim();
  const suffix = cleaned.slice(-1).toLowerCase();
  let multiplier = 1;
  if (suffix === "k" || suffix === "m") {
    multiplier = suffix === "k" ? 1000 : 1000000;
    cleaned = cleaned.slice(0, -1);
  }
  const valueNum = Number.parseFloat(cleaned);
  if (!Number.isFinite(valueNum)) return null;
  return Number((negative ? -valueNum : valueNum) * multiplier);
}

function addRangeWarnings(metrics: ParsedMetrics, warnings: string[]) {
  const percentageMetrics: Array<keyof ParsedMetrics> = [
    "bounceRate", "openRate", "clickThroughRate", "clickToOpenRate",
    "hardBounces", "spamComplaints", "organicSearchShare", "directBrandedShare",
    "emailShare", "referralShare", "paidShare", "socialShare",
  ];
  for (const key of percentageMetrics) {
    const value = metrics[key];
    if (typeof value === "number" && (value < 0 || value > 100)) {
      warnings.push(`${String(key)} out of range (0-100): ${value}`);
    }
  }
}

function resolveMetricKey(label: string): keyof ParsedMetrics | null {
  const normalized = normalizeLabel(label);
  if (!normalized) return null;
  for (const definition of METRIC_DEFINITIONS) {
    if (definition.labels.map(normalizeLabel).includes(normalized)) return definition.key;
  }
  const aliases = METRIC_DEFINITIONS
    .flatMap((definition) => definition.labels.map((alias) => ({ alias: normalizeLabel(alias), key: definition.key })))
    .sort((a, b) => b.alias.length - a.alias.length);
  const match = aliases.find(({ alias }) => alias.length >= 4 && normalized.includes(alias));
  return match?.key || null;
}

function normalizeLabel(label: string): string {
  return String(label || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9/% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeDelimitedBuffer(buffer: Buffer): string {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return buffer.subarray(2).toString("utf16le");
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return swapUtf16Bytes(buffer.subarray(2)).toString("utf16le");
  }
  return buffer.toString("utf8");
}

function swapUtf16Bytes(buffer: Buffer): Buffer {
  const swapped = Buffer.from(buffer);
  for (let i = 0; i + 1 < swapped.length; i += 2) {
    const tmp = swapped[i];
    swapped[i] = swapped[i + 1];
    swapped[i + 1] = tmp;
  }
  return swapped;
}

function parseXlsxMetrics(buffer: Buffer): ParsedMetrics {
  const entries = readZipEntries(buffer);
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml")?.toString("utf8") || "");
  const sheetName = Array.from(entries.keys()).find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  if (!sheetName) {
    return {
      _confidence: 0,
      _warnings: ["No worksheet found in XLSX"],
      _extractedFields: 0,
      _requiresReview: true,
    };
  }

  const rows = parseWorksheet(entries.get(sheetName)?.toString("utf8") || "", sharedStrings);
  const headers = (rows[0] || []).map((value, index) => String(value || "").trim() || `Column ${index + 1}`);
  const dataRows = rows.slice(1).map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((header, index) => {
      out[header] = String(row[index] ?? "").trim();
    });
    return out;
  }).filter((row) => Object.values(row).some((value) => value.trim()));

  return metricsFromTable(headers, dataRows, "XLSX");
}

function readZipEntries(buffer: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) throw new Error("Invalid XLSX file");

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (data) entries.set(fileName, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const matches = xml.match(/<si[\s\S]*?<\/si>/g) || [];
  for (const si of matches) {
    const textParts = Array.from(si.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map((match) => decodeXml(match[1]));
    strings.push(textParts.join(""));
  }
  return strings;
}

function parseWorksheet(xml: string, sharedStrings: string[]): string[][] {
  const rows: string[][] = [];
  const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) || [];
  for (const rowXml of rowMatches) {
    const row: string[] = [];
    const cellMatches = rowXml.match(/<c\b[\s\S]*?<\/c>/g) || [];
    for (const cellXml of cellMatches) {
      const ref = /r="([A-Z]+)\d+"/.exec(cellXml)?.[1] || "";
      const colIndex = columnIndex(ref);
      const type = /t="([^"]+)"/.exec(cellXml)?.[1] || "";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] || /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellXml)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(raw)] || "" : decodeXml(raw);
      row[colIndex] = value;
    }
    if (row.some((value) => String(value || "").trim())) rows.push(row);
  }
  return rows;
}

function columnIndex(ref: string): number {
  let index = 0;
  for (const char of ref) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

function decodeXml(value: string): string {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
