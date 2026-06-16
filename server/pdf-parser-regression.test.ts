import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { parsePDFMetrics } from "./services/pdf-parser";
import { parseCustomIntegrationFile } from "./services/custom-integration-file-parser";

function buildPdfBuffer(lines: string[]): Buffer {
  const doc = new jsPDF();
  lines.forEach((line, index) => {
    doc.text(line, 10, 10 + index * 8);
  });
  return Buffer.from(doc.output("arraybuffer"));
}

function buildStoredZip(entries: Record<string, string>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const nameBuffer = Buffer.from(name, "utf8");
    const data = Buffer.from(content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt32LE(0, 34);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(Object.keys(entries).length, 8);
  eocd.writeUInt16LE(Object.keys(entries).length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function buildXlsxBuffer(rows: string[][]): Buffer {
  const colRef = (index: number) => {
    let n = index + 1;
    let out = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      out = String.fromCharCode(65 + rem) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  const esc = (value: string) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sheetRows = rows.map((row, r) => {
    const cells = row.map((value, c) => `<c r="${colRef(c)}${r + 1}" t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join("");
    return `<row r="${r + 1}">${cells}</row>`;
  }).join("");
  return buildStoredZip({
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${sheetRows}</sheetData></worksheet>`,
  });
}

describe("Custom Integration PDF parser", () => {
  it("extracts a known mixed report shape", async () => {
    const metrics = await parsePDFMetrics(buildPdfBuffer([
      "Users: 1,234",
      "Sessions: 2,345",
      "Pageviews: 4,567",
      "Bounce Rate: 42.5%",
      "Spend: $1,250",
      "Conversions: 25",
      "Emails Delivered: 50K",
      "Open Rate: 44.5%",
      "CTR: 12.3%",
      "CTOR: 27.6%",
    ]));

    expect(metrics.users).toBe(1234);
    expect(metrics.sessions).toBe(2345);
    expect(metrics.pageviews).toBe(4567);
    expect(metrics.bounceRate).toBe(42.5);
    expect(metrics.spend).toBe(1250);
    expect(metrics.conversions).toBe(25);
    expect(metrics.emailsDelivered).toBe(50000);
    expect(metrics.openRate).toBe(44.5);
    expect(metrics.clickThroughRate).toBe(12.3);
    expect(metrics.clickToOpenRate).toBe(27.6);
    expect(metrics._extractedFields).toBeGreaterThanOrEqual(10);
  });

  it("keeps email-only imports available without website-required warnings", async () => {
    const metrics = await parsePDFMetrics(buildPdfBuffer([
      "Emails Delivered: 10,000",
      "Open Rate: 31.4%",
      "Click-through rate: 7.8%",
      "List Growth: +125",
    ]));

    expect(metrics.emailsDelivered).toBe(10000);
    expect(metrics.openRate).toBe(31.4);
    expect(metrics.clickThroughRate).toBe(7.8);
    expect(metrics.listGrowth).toBe(125);
    expect(metrics.users).toBeUndefined();
    expect(metrics.sessions).toBeUndefined();
    expect(metrics.pageviews).toBeUndefined();
    expect(metrics._warnings?.some((warning) => warning.includes("Missing required metrics"))).toBe(false);
  });

  it("does not fabricate zeros when no metrics are extracted", async () => {
    const metrics = await parsePDFMetrics(buildPdfBuffer([
      "Quarterly narrative report",
      "This document does not contain supported metric labels.",
    ]));

    expect(metrics.impressions).toBeUndefined();
    expect(metrics.spend).toBeUndefined();
    expect(metrics.conversions).toBeUndefined();
    expect(metrics._confidence).toBe(0);
    expect(metrics._requiresReview).toBe(true);
    expect(metrics._warnings).toEqual(["No metrics extracted from PDF"]);
  });

  it("extracts CSV metric/value reports", async () => {
    const metrics = await parseCustomIntegrationFile(Buffer.from([
      "Metric,Value",
      "Users,94780",
      "Sessions,141650",
      "Pageviews,287340",
      "Spend,420",
    ].join("\n")), "report.csv", "text/csv");

    expect(metrics.users).toBe(94780);
    expect(metrics.sessions).toBe(141650);
    expect(metrics.pageviews).toBe(287340);
    expect(metrics.spend).toBe(420);
    expect(metrics._confidence).toBe(100);
  });

  it("sums CSV count fields but does not invent weighted rates across multiple rows", async () => {
    const metrics = await parseCustomIntegrationFile(Buffer.from([
      "Date,Impressions,Clicks,Spend,CTR",
      "2026-01-01,1000,40,120,4.0%",
      "2026-01-02,2000,80,300,4.5%",
    ].join("\n")), "report.csv", "text/csv");

    expect(metrics.impressions).toBe(3000);
    expect(metrics.clicks).toBe(120);
    expect(metrics.spend).toBe(420);
    expect(metrics.clickThroughRate).toBeUndefined();
    expect(metrics._requiresReview).toBe(true);
    expect(metrics._warnings?.join(" ")).toContain("multiple CSV rows");
  });

  it("extracts XLSX metric tables", async () => {
    const metrics = await parseCustomIntegrationFile(buildXlsxBuffer([
      ["Users", "Sessions", "Pageviews", "Open Rate"],
      ["94780", "141650", "287340", "44.5%"],
    ]), "report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    expect(metrics.users).toBe(94780);
    expect(metrics.sessions).toBe(141650);
    expect(metrics.pageviews).toBe(287340);
    expect(metrics.openRate).toBe(44.5);
    expect(metrics._confidence).toBe(100);
  });
});
