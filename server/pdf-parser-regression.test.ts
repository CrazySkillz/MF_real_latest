import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { parsePDFMetrics } from "./services/pdf-parser";

function buildPdfBuffer(lines: string[]): Buffer {
  const doc = new jsPDF();
  lines.forEach((line, index) => {
    doc.text(line, 10, 10 + index * 8);
  });
  return Buffer.from(doc.output("arraybuffer"));
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
});
