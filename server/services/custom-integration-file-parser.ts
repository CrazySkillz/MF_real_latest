import { inflateRawSync } from "zlib";
import { parseCsvText } from "../utils/csv";
import { parsePDFMetrics, type ParsedMetrics } from "./pdf-parser";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { request } from "node:https";

const privateReportDestinations = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateReportDestinations.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const)
  privateReportDestinations.addSubnet(address, prefix, "ipv6");

export async function downloadCustomIntegrationReport(rawUrl: string): Promise<{ buffer: Buffer; contentType: string | null; fileName: string }> {
  const signal = AbortSignal.timeout(15_000);
  let url = new URL(rawUrl);
  for (let redirects = 0; redirects <= 3; redirects++) {
    signal.throwIfAborted();
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("Report URL must use public HTTPS");
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await Promise.race([
      lookup(hostname, { all: true }),
      new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new Error("Report download timed out")), { once: true })),
    ]);
    signal.throwIfAborted();
    if (!addresses.length || addresses.some(({ address, family }) =>
      family === 6 ? !/^[23][0-9a-f]{3}:/i.test(address) || privateReportDestinations.check(address, "ipv6")
        : privateReportDestinations.check(address, "ipv4"))) throw new Error("Report URL is not a public destination");
    const pinned = addresses[0];
    const response = await new Promise<import("node:http").IncomingMessage>((resolve, reject) => {
      const req = request(url, { signal, agent: false, lookup: (_host, options, callback: any) =>
        options.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family) }, resolve);
      req.on("error", () => reject(new Error("Report download failed")));
      req.end();
    });
    if ([301, 302, 303, 307, 308].includes(response.statusCode || 0)) {
      response.destroy();
      if (!response.headers.location || redirects === 3) throw new Error("Report redirect limit exceeded");
      url = new URL(response.headers.location, url);
      continue;
    }
    const maxBytes = 10 * 1024 * 1024;
    if (response.statusCode !== 200 || Number(response.headers["content-length"] || 0) > maxBytes) {
      response.destroy(); throw new Error("Report response is unavailable or too large");
    }
    const chunks: Buffer[] = [];
    let bytes = 0;
    for await (const chunk of response) {
      bytes += chunk.length;
      if (bytes > maxBytes) { response.destroy(); throw new Error("Report exceeds 10MB"); }
      chunks.push(Buffer.from(chunk));
    }
    return { buffer: Buffer.concat(chunks), contentType: response.headers["content-type"] || null, fileName: url.pathname.split("/").pop() || "downloaded-report" };
  }
  throw new Error("Report redirect limit exceeded");
}

type MetricKind = "sum" | "single" | "duration";

type MetricDefinition = {
  key: keyof ParsedMetrics;
  labels: string[];
  kind: MetricKind;
};

const METRIC_DEFINITIONS: MetricDefinition[] = [
  { key: "impressions", labels: ["impressions", "impression"], kind: "sum" },
  { key: "reach", labels: ["reach"], kind: "single" },
  { key: "clicks", labels: ["clicks", "click"], kind: "sum" },
  { key: "engagements", labels: ["engagements", "engagement"], kind: "sum" },
  { key: "spend", labels: ["spend", "ad spend", "cost"], kind: "sum" },
  { key: "conversions", labels: ["conversions", "conversion"], kind: "sum" },
  { key: "leads", labels: ["leads", "lead"], kind: "sum" },
  { key: "videoViews", labels: ["video views", "video view"], kind: "sum" },
  { key: "viralImpressions", labels: ["viral impressions"], kind: "sum" },
  { key: "users", labels: ["users", "unique users", "visitors", "unique visitors"], kind: "single" },
  { key: "sessions", labels: ["sessions", "visits"], kind: "sum" },
  { key: "pageviews", labels: ["pageviews", "page views", "pages viewed"], kind: "sum" },
  { key: "avgSessionDuration", labels: ["avg session duration", "average session duration", "avg time on site", "average time"], kind: "duration" },
  { key: "pagesPerSession", labels: ["pages/session", "pages per session", "pages per visit"], kind: "single" },
  { key: "bounceRate", labels: ["bounce rate"], kind: "single" },
  { key: "organicSearchShare", labels: ["organic search", "organic traffic", "search engines"], kind: "single" },
  { key: "directBrandedShare", labels: ["direct/branded", "direct branded", "direct traffic", "direct"], kind: "single" },
  { key: "emailShare", labels: ["email traffic", "email share", "email"], kind: "single" },
  { key: "referralShare", labels: ["referral/partners", "referral partners", "referral traffic", "referrals"], kind: "single" },
  { key: "paidShare", labels: ["paid display/search", "paid advertising", "paid traffic", "paid"], kind: "single" },
  { key: "socialShare", labels: ["social media", "social traffic", "social"], kind: "single" },
  { key: "emailsDelivered", labels: ["emails delivered", "delivered"], kind: "sum" },
  { key: "openRate", labels: ["open rate"], kind: "single" },
  { key: "clickThroughRate", labels: ["click-through rate", "click through rate", "click rate", "ctr"], kind: "single" },
  { key: "clickToOpenRate", labels: ["click-to-open", "click to open", "ctor"], kind: "single" },
  { key: "hardBounces", labels: ["hard bounce rate", "hard bounces %"], kind: "single" },
  { key: "spamComplaints", labels: ["spam complaint rate", "spam complaints %"], kind: "single" },
  { key: "listGrowth", labels: ["list growth", "net subscribers"], kind: "sum" },
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
  try {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw new Error("Report must contain at most 10MB");
  const ext = fileExtension(fileName);
  const mime = String(mimeType || "").toLowerCase();

  if (ext === ".pdf" || mime === "application/pdf") {
    return await parsePDFMetrics(buffer);
  }

  if (ext === ".csv" || mime === "text/csv") {
    return parseDelimitedMetrics(decodeDelimitedBuffer(buffer), "CSV");
  }

  if (ext === ".xlsx" || mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return parseXlsxMetrics(buffer);
  }

  throw new Error(`Unsupported file type. Upload ${supportedCustomIntegrationFileDescription()} reports.`);
  } catch (error) {
    throw Object.assign(error instanceof Error ? error : new Error("Invalid report"), { code: "CUSTOM_REPORT_INVALID" });
  }
}

function parseDelimitedMetrics(text: string, sourceLabel: string): ParsedMetrics {
  const parsed = parseCsvText(text);
  if (parsed.headers.some(header => resolveMetricKey(header) || isMetricLabelHeader(header))) {
    const complete = parseCsvText(text, 5000, { strict: true });
    return metricsFromTable(complete.headers, complete.rows, sourceLabel);
  }
  if (parsed.rows.length > 5000) throw new Error("Report exceeds 5,000 data rows");
  const metrics = metricsFromTable(parsed.headers, parsed.rows, sourceLabel);
  if (Number(metrics._extractedFields || 0) > 0) return metrics;
  return parseDelimitedMetricsWithDetectedHeader(text, sourceLabel) || parseDelimitedMetricPairs(text, sourceLabel) || metrics;
}

function metricsFromTable(headers: string[], rows: Array<Record<string, string>>, sourceLabel: string): ParsedMetrics {
  const normalizedHeaders = headers.map(normalizeLabel);
  if (new Set(normalizedHeaders).size !== headers.length) throw new Error("Report headers must be unique");
  if (headers.length > 200 || rows.length > 5000 || headers.length * rows.length > 1_000_000) throw new Error("Report table exceeds supported limits");
  if (normalizedHeaders.some(header => header.includes("currency"))) throw new Error("Currency columns are not supported; use plain amounts in the campaign currency");
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
  if (headers.filter(isMetricLabelHeader).length > 1 || headers.some(isMetricLabelHeader) && headers.filter(isMetricValueHeader).length > 1) throw new Error("Ambiguous metric/value columns");
  const metricHeader = headers.find(isMetricLabelHeader);
  const valueHeader = headers.find((header) => header !== metricHeader && isMetricValueHeader(header))
    || (metricHeader ? bestNumericValueHeader(headers, rows, metricHeader) : undefined)
    || (metricHeader && headers.length === 2 ? headers.find((header) => header !== metricHeader) : undefined);
  if (!metricHeader || !valueHeader) return null;

  const values = new Map<keyof ParsedMetrics, string[]>();
  for (const row of rows) {
    if (normalizeLabel(row[metricHeader]).includes("currency")) throw new Error("Use plain amounts in the campaign currency");
    const key = resolveMetricKey(row[metricHeader]);
    const rawValue = String(row[valueHeader] || "").trim();
    if (!key) continue;
    if (!rawValue) throw new Error(`Missing value for ${String(key)}`);
    const existing = values.get(key) || [];
    if (existing.length) throw new Error(`Multiple total rows for ${String(key)}`);
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
  const limit = Math.min(lines.length, 50);

  for (let index = 1; index < limit; index++) {
    if (!lines[index]?.trim()) continue;
    const candidate = parseCsvText(`${lines[index]}\n0`);
    if (candidate.headers.length < 2) continue;
    if (!candidate.headers.some(header => isMetricLabelHeader(header)) && !candidate.headers.every(header => resolveMetricKey(header))) continue;
    const complete = parseCsvText(lines.slice(index).join("\n"), 5000, { strict: true });
    const metrics = metricsFromTable(complete.headers, complete.rows, sourceLabel);
    return metrics;
  }

  return null;
}

function parseDelimitedMetricPairs(text: string, sourceLabel: string): ParsedMetrics | null {
  const values = new Map<keyof ParsedMetrics, string[]>();
  const lines = String(text || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.filter(line => line.trim()).length > 5001) throw new Error("Report exceeds 5,000 data rows");

  for (const line of lines) {
    const parsed = parseLooseMetricPair(line);
    if (!parsed) continue;
    const existing = values.get(parsed.key) || [];
    existing.push(parsed.value);
    values.set(parsed.key, existing);
  }

  if (values.size === 0) return null;
  const warnings: string[] = [];
  const metrics: ParsedMetrics = {};
  applyMetricValues(values, metrics, warnings, sourceLabel);
  const extractedFields = Object.entries(metrics).filter(([key, value]) => !key.startsWith("_") && value !== undefined).length;
  if (extractedFields === 0) return null;
  metrics._extractedFields = extractedFields;
  metrics._confidence = warnings.length > 0 ? 90 : 100;
  metrics._warnings = warnings;
  metrics._requiresReview = metrics._confidence < 95;
  return metrics;
}

function parseLooseMetricPair(line: string): { key: keyof ParsedMetrics; value: string } | null {
  const trimmed = String(line || "").trim();
  if (!trimmed) return null;
  const colonIndex = trimmed.indexOf(":");
  const candidates = colonIndex > 0
    ? [[trimmed.slice(0, colonIndex), trimmed.slice(colonIndex + 1)]]
    : [",", ";", "\t", "|"].map((delimiter) => {
      const parts = trimmed.split(delimiter);
      return parts.length >= 2 ? [parts[0], parts.slice(1).join(delimiter)] : null;
    }).filter((parts): parts is string[] => Array.isArray(parts));

  for (const [label, rawValue] of candidates) {
    const key = resolveMetricKey(label);
    if (!key) continue;
    if (parseMetricNumber(rawValue) === null) throw new Error(`Invalid value for ${label}`);
    return { key, value: rawValue };
  }
  return null;
}

function bestNumericValueHeader(headers: string[], rows: Array<Record<string, string>>, metricHeader: string): string | undefined {
  let best: { header: string; count: number } | null = null;
  for (const header of headers) {
    if (header === metricHeader) continue;
    const count = rows.reduce((sum, row) => sum + (parseMetricNumber(String(row[header] || "")) === null ? 0 : 1), 0);
    if (count > 0 && best) throw new Error("Ambiguous metric value columns");
    if (count > 0 && (!best || count > best.count)) best = { header, count };
  }
  return best?.header;
}

function isMetricLabelHeader(header: string): boolean {
  const normalized = normalizeLabel(header);
  return ["metric", "metrics", "name", "label", "measure", "kpi", "field", "data point"].includes(normalized)
    || normalized.includes("metric")
    || normalized.includes("measure");
}

function isMetricValueHeader(header: string): boolean {
  const normalized = normalizeLabel(header);
  return ["value", "current value", "current", "latest", "actual", "result", "total", "amount", "metric value"].includes(normalized)
    || normalized.includes("value")
    || normalized.includes("current");
}

function applyHeaderRows(headers: string[], rows: Array<Record<string, string>>, metrics: ParsedMetrics, warnings: string[], sourceLabel: string) {
  const byMetric = new Map<keyof ParsedMetrics, string[]>();
  for (const header of headers) {
    const key = resolveMetricKey(header);
    if (!key) continue;
    if (byMetric.has(key)) throw new Error(`Multiple columns map to ${String(key)}`);
    const values = rows
      .map((row) => String(row[header] || "").trim())
      .filter(Boolean);
    if (values.length !== rows.length) throw new Error(`Missing value for ${String(key)}`);
    if (values.length === 0) continue;
    byMetric.set(key, [...(byMetric.get(key) || []), ...values]);
  }
  applyMetricValues(byMetric, metrics, warnings, sourceLabel);
}

function applyMetricValues(valuesByMetric: Map<keyof ParsedMetrics, string[]>, metrics: ParsedMetrics, warnings: string[], sourceLabel: string) {
  for (const definition of METRIC_DEFINITIONS) {
    const values = valuesByMetric.get(definition.key) || [];
    if (values.length === 0) continue;
    if (String(definition.key).endsWith("Share") && values.some(value => !value.endsWith("%"))) throw new Error("Traffic shares require explicit percentages");

    if (definition.kind === "duration") {
      if (values.length === 1) {
        if (!/^\d{1,3}:[0-5]\d:[0-5]\d$/.test(values[0])) throw new Error("Duration must be HH:MM:SS");
        (metrics as any)[definition.key] = values[0];
      } else {
        warnings.push(`${definition.labels[0]} has multiple ${sourceLabel} rows and was not imported because duration values require a selected total row.`);
      }
      continue;
    }

    const numericValues = values.map(value => {
      const parsed = parseMetricNumber(value);
      if (parsed === null || (definition.kind === "sum" && value.includes("%"))) throw new Error(`Invalid ${definition.labels[0]} value`);
      if ((definition.kind === "sum" && definition.key !== "spend" || ["users", "reach"].includes(String(definition.key))) && !Number.isInteger(parsed)) throw new Error(`Fractional ${definition.labels[0]} is not supported by this import`);
      if ((definition.key !== "listGrowth" && parsed < 0) || Math.abs(parsed) > (definition.key === "spend" ? 99_999_999.99 : 2_147_483_647)) throw new Error(`Unsupported ${definition.labels[0]} value`);
      return parsed;
    });
    if (numericValues.length === 0) continue;

    if (definition.kind === "sum") {
      (metrics as any)[definition.key] = Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(2));
      if (Math.abs(Number(metrics[definition.key])) > (definition.key === "spend" ? 99_999_999.99 : 2_147_483_647)) throw new Error(`Unsupported ${definition.labels[0]} total`);
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
  if (!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?%?$/.test(raw)) return null;
  const number = Number(raw.replace(/[,\%]/g, ""));
  return Number.isFinite(number) ? number : null;
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
  return null;
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
  const workbook = entries.get("xl/workbook.xml")?.toString("utf8") || "";
  const relationships = entries.get("xl/_rels/workbook.xml.rels")?.toString("utf8") || "";
  const attribute = (tag: string, name: string) => new RegExp(`\\b${name}=["']([^"']*)["']`).exec(tag)?.[1];
  const sheets = (workbook.match(/<sheet\b[^>]*\/?\s*>/g) || []).filter(sheet => !attribute(sheet, "state") || attribute(sheet, "state") === "visible");
  if (sheets.length !== 1) throw new Error("XLSX requires exactly one visible worksheet");
  const sheetId = attribute(sheets[0], "r:id");
  const targets = (relationships.match(/<Relationship\b[^>]*\/?\s*>/g) || []).filter(rel => attribute(rel, "Id") === sheetId);
  if (!sheetId || targets.length !== 1 || attribute(targets[0], "TargetMode") === "External") throw new Error("Invalid XLSX worksheet relationship");
  const target = attribute(targets[0], "Target") || "";
  const sheetName = target.startsWith("/xl/") ? target.slice(1) : `xl/${target}`;
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(sheetName) || !entries.has(sheetName)) throw new Error("Invalid XLSX worksheet target");

  const rows = parseWorksheet(entries.get(sheetName)?.toString("utf8") || "", sharedStrings);
  const headers = (rows[0] || []).map((value, index) => String(value || "").trim() || `Column ${index + 1}`);
  if (new Set(headers.map(normalizeLabel)).size !== headers.length) throw new Error("Report headers must be unique");
  const dataRows = rows.slice(1).map((row) => {
    if (row.length > headers.length) throw new Error("XLSX row exceeds header width");
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
  const directoryEnd = offset + buffer.readUInt32LE(eocdOffset + 12);
  if (entryCount > 256 || directoryEnd !== eocdOffset || buffer.readUInt16LE(eocdOffset + 4) !== 0 || buffer.readUInt16LE(eocdOffset + 6) !== 0) throw new Error("Unsupported XLSX archive");
  let expandedBytes = 0;

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > directoryEnd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid XLSX directory");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const expandedSize = buffer.readUInt32LE(offset + 24);
    if (buffer.readUInt16LE(offset + 8) & 1 || ![0, 8].includes(method) || expandedBytes + expandedSize > 10 * 1024 * 1024) throw new Error("XLSX expanded content exceeds limits or is unsupported");
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    if (offset + 46 + fileNameLength + extraLength + commentLength > directoryEnd || localHeaderOffset + 30 > buffer.length || buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error("Invalid XLSX entry");
    const fileName = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    if (entries.has(fileName) || fileName.includes("..") || fileName.includes("\\")) throw new Error("Ambiguous XLSX entry");
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    if (dataStart + compressedSize > buffer.readUInt32LE(eocdOffset + 16)) throw new Error("Invalid XLSX entry size");
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.max(1, expandedSize) });
    if (data.length !== expandedSize) throw new Error("Incomplete XLSX entry");
    expandedBytes += data.length;
    entries.set(fileName, data);
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  if (offset !== directoryEnd) throw new Error("Incomplete XLSX directory");

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
  if (/<(?:f|mergeCell)\b/.test(xml)) throw new Error("XLSX formulas and merged cells are unsupported; upload explicit values");
  const rows: string[][] = [];
  const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) || [];
  if (rowMatches.length > 5001) throw new Error("Report exceeds 5,000 data rows");
  let cells = 0;
  for (const rowXml of rowMatches) {
    const row: string[] = [];
    const cellMatches = rowXml.match(/<c\b[\s\S]*?<\/c>/g) || [];
    cells += cellMatches.length;
    if (cellMatches.length > 200 || cells > 1_000_000) throw new Error("XLSX cell limit exceeded");
    for (const cellXml of cellMatches) {
      const ref = /r="([A-Z]+)\d+"/.exec(cellXml)?.[1] || "";
      const colIndex = columnIndex(ref);
      if (!ref || colIndex >= 200 || row[colIndex] !== undefined) throw new Error("Invalid XLSX cell column");
      const type = /t="([^"]+)"/.exec(cellXml)?.[1] || "";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(cellXml)?.[1] || /<t[^>]*>([\s\S]*?)<\/t>/.exec(cellXml)?.[1] || "";
      const value = type === "s" ? sharedStrings[Number(raw)] || "" : decodeXml(raw);
      if (type === "e" || type === "s" && (!/^\d+$/.test(raw) || sharedStrings[Number(raw)] === undefined)) throw new Error("Invalid XLSX cell value");
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
