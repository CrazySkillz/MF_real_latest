import { PDFParse } from "pdf-parse";
import { compareNumber, monitorHash, numberOrNull, parseMonitorMapping, type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";
import { readReportPdfArtifact, readReportVerification } from "./utils/report-pdf-artifact";

// The PDF is evidence of what was actually published. Never regenerate it and
// never substitute today's source configuration for missing historical evidence.
const numericText = "-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?";
const amountPattern = new RegExp(`^([A-Z]{3}) (${numericText})$`);
const missingValue = /^(?:Unavailable|Not available|N\/A|—|–)$/;
const parseValue = (value: string | undefined, unit: "money" | "rate" | "ratio" | "count") => {
  const pattern = unit === "money" ? amountPattern : new RegExp(`^(${numericText})${unit === "rate" ? "%" : unit === "ratio" ? "x" : ""}$`);
  const match = value?.match(pattern);
  return match ? { value: numberOrNull(match[unit === "money" ? 2 : 1].replaceAll(",", "")), currency: unit === "money" ? match[1] : null } : null;
};

export function checkReportTextNumbers(text: string, reportType: string, verification?: Record<string, any> | null): NumberCheck[] {
  const section = "Reports / PDF numbers", checks: NumberCheck[] = [];
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
  const valueAfter = (label: string, subset = lines) => {
    const indexes = subset.flatMap((line, index) => line === label ? [index] : []);
    return indexes.length === 1 ? subset[indexes[0] + 1] : undefined;
  };
  const push = (code: string, expected: unknown, actual: unknown, decimals?: number) =>
    checks.push(compareNumber(section, code, expected, actual, { decimals }));
  if (reportType === "overview" && lines[0] === "GA4 Overview Report") {
    const summaryIndex = lines.indexOf("Summary"), financialIndex = lines.indexOf("Revenue & Financial");
    const summary = summaryIndex >= 0 && financialIndex > summaryIndex ? lines.slice(summaryIndex + 1, financialIndex) : [];
    const sessions = parseValue(valueAfter("SESSIONS", summary), "count")?.value;
    const conversions = parseValue(valueAfter("CONVERSIONS", summary), "count")?.value;
    if (sessions === 0 && missingValue.test(valueAfter("CONV. RATE", summary) || "")) {
      checks.push({ section, code: "SUMMARY_CONVERSION_RATE_UNAVAILABLE", status: "passed" });
    } else push("SUMMARY_CONVERSION_RATE", sessions !== null && sessions !== undefined && sessions > 0 && conversions !== null && conversions !== undefined
      ? conversions / sessions * 100 : null, parseValue(valueAfter("CONV. RATE", summary), "rate")?.value, 1);
    const revenue = parseValue(valueAfter("TOTAL REVENUE"), "money"), spend = parseValue(valueAfter("TOTAL SPEND"), "money");
    const sameCurrency = Boolean(revenue && spend && revenue.currency === spend.currency);
    const rev = revenue?.value, cost = spend?.value;
    for (const [label, code, unit, decimals, expected] of [
      ["PROFIT", "FINANCIAL_PROFIT", "money", 2, sameCurrency && rev != null && cost != null ? rev - cost : null],
      ["ROAS", "FINANCIAL_ROAS", "ratio", 2, sameCurrency && rev != null && cost != null && cost > 0 ? rev / cost : null],
      ["ROI", "FINANCIAL_ROI", "rate", 1, sameCurrency && rev != null && cost != null && cost > 0 ? (rev - cost) / cost * 100 : null],
    ] as const) {
      const raw = valueAfter(label), actual = parseValue(raw, unit);
      // Missing spend is valid only when the dependent PDF value is also unavailable.
      if (missingValue.test(valueAfter("TOTAL SPEND") || "") && raw && missingValue.test(raw)) {
        checks.push({ section, code: `${code}_UNAVAILABLE`, status: "passed" });
      } else {
        const checked = compareNumber(section, code, expected, unit === "money" && actual?.currency !== revenue?.currency ? null : actual?.value, { decimals });
        if (checked.status === "difference" && rev != null && cost != null && actual?.value != null && sameCurrency) {
          // Printed monetary inputs may each have lost half a cent. A discrepancy
          // explainable by that bound is uncertain, not a proven wrong figure.
          const values = [rev - 0.005, rev + 0.005].flatMap(r => [cost - 0.005, cost + 0.005].map(c =>
            label === "PROFIT" ? r - c : c > 0 ? label === "ROAS" ? r / c : (r - c) / c * 100 : NaN));
          const halfUnit = 0.5 * 10 ** -decimals;
          if (values.some(value => !Number.isFinite(value)) || (actual.value + halfUnit >= Math.min(...values)
            && actual.value - halfUnit <= Math.max(...values))) checked.status = "unverified";
        }
        checks.push(checked);
      }
    }
    // CPA's conversion basis was not saved in historical PDF metadata; do not
    // silently equate its financial window with the Summary traffic window.
    if (verification) {
      const financial = verification.financial, cost = numberOrNull(financial?.spend), conversions = numberOrNull(financial?.conversions);
      const raw = valueAfter("CPA"), actual = parseValue(raw, "money");
      const expected = financial?.spendAvailable === true && cost !== null && cost > 0 && conversions !== null && conversions > 0 ? cost / conversions : null;
      if (expected === null && raw && missingValue.test(raw)) checks.push({ section, code: "FINANCIAL_CPA_UNAVAILABLE", status: "passed" });
      else push("FINANCIAL_CPA", expected, actual && actual.currency === verification.scope?.currency ? actual.value : null, 2);
    } else checks.push({ section, code: "CPA_HISTORICAL_CONVERSION_BASIS_UNVERIFIED", status: "unverified" });
    const tableStart = lines.indexOf("CAMPAIGN SESSIONS USERS CONVERSIONS CONV. RATE REVENUE");
    if (tableStart >= 0) {
      // This column is GA4 sessionKeyEventRate (sessions containing a key event),
      // not the printed key-event count divided by sessions. Its numerator was
      // not retained in the historical artifact; never flag that intentional difference.
      if (verification && Array.isArray(verification.campaignRows)) {
        const end = lines.findIndex((line, i) => i > tableStart && ["Landing Pages", "Conversion Events"].includes(line));
        const table = lines.slice(tableStart + 1, end < 0 ? undefined : end).join(" ");
        for (const row of verification.campaignRows) {
          const escaped = String(row.name).replace(/\s+/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const matches = Array.from(table.matchAll(new RegExp(`(?:^|\\s)${escaped}\\s+${numericText}\\s+${numericText}\\s+${numericText}\\s+(${numericText})%`, "g")));
          const sessions = numberOrNull(row.sessions), weighted = numberOrNull(row.sessionKeyEventRateWeighted);
          const expected = sessions !== null && weighted !== null ? sessions > 0 ? weighted / sessions * 100 : 0 : null;
          push("CAMPAIGN_SESSION_KEY_EVENT_RATE", expected, matches.length === 1 ? Number(matches[0][1].replaceAll(",", "")) : null, 1);
        }
      } else checks.push({ section, code: "CAMPAIGN_SESSION_KEY_EVENT_RATE_BASIS_UNVERIFIED", status: "unverified" });
    }
  } else if (reportType === "ads" && lines[0] === "GA4 Ad Comparison Report") {
    const start = lines.indexOf("Revenue Breakdown"), header = lines.indexOf("SOURCE AMOUNT", start);
    const amountRow = new RegExp(`^(.+) ([A-Z]{3}) (${numericText})$`);
    const rows = start >= 0 && header > start ? lines.slice(header + 1).map(line => line.match(amountRow)).filter(Boolean) : [];
    const totals = rows.filter(row => row![1] === "TOTAL"), sources = rows.filter(row => row![1] !== "TOTAL");
    if (totals.length === 1 && sources.length > 0 && sources.every(row => row![2] === totals[0]![2])) {
      const sum = sources.reduce((sum, row) => sum + Number(row![3].replaceAll(",", "")), 0);
      const total = numberOrNull(totals[0]![3].replaceAll(",", ""));
      const result = compareNumber(section, "REVENUE_SOURCE_TOTAL", sum, total, { decimals: 2 });
      if (result.status === "difference" && total !== null && Math.abs(sum - total) <= (sources.length + 1) * 0.005 + 1e-9) result.status = "unverified";
      checks.push(result);
    } else checks.push({ section, code: "REVENUE_TABLE_SCOPE_UNVERIFIED", status: "unverified" });
  } else if (reportType === "insights" && lines[0] === "GA4 Insights Report") {
    const revenue = parseValue(valueAfter("REVENUE"), "money");
    const start = lines.indexOf("Data Summary"), end = lines.indexOf("What to investigate next", start);
    const revenueRows = start >= 0 && end > start ? lines.slice(start + 1, end).filter(line => /^Revenue [A-Z]{3} /.test(line)) : [];
    const tableValue = revenueRows.length === 1 ? revenueRows[0].match(new RegExp(`^Revenue ([A-Z]{3}) (${numericText})(?: |$)`)) : null;
    push("INSIGHTS_REVENUE_CARD_TABLE", revenue?.value, tableValue && tableValue[1] === revenue?.currency ? numberOrNull(tableValue[2].replaceAll(",", "")) : null, 2);
  } else checks.push({ section, code: "PDF_LAYOUT_OR_REPORT_TYPE_UNVERIFIED", status: "unverified" });
  return checks;
}

export async function checkSavedReportNumbers(snapshot: LiveNumberSnapshot): Promise<NumberCheck[]> {
  const checks: NumberCheck[] = [];
  const reports = (snapshot.rows.reportSnapshots || []).filter(row => ["google_analytics", "campaign_deepdive"].includes(row.platformType));
  if (reports.length > 100) return [{ section: "Reports / PDF numbers", code: "PDF_COUNT_LIMIT_EXCEEDED", status: "unverified" }];
  let totalBytes = 0;
  for (const report of reports) {
    const subject = monitorHash(String(report.id));
    try {
      const payload = parseMonitorMapping(report.snapshotJson), buffer = readReportPdfArtifact(payload);
      if (report.campaignId !== snapshot.campaign.id || payload.campaignId !== snapshot.campaign.id || payload.reportId !== report.reportId || payload.platformType !== report.platformType
        || payload.reportType !== report.reportType || payload.windowStart !== report.windowStart || payload.windowEnd !== report.windowEnd || !buffer) throw new Error();
      totalBytes += buffer.length;
      if (buffer.length > 5 * 1024 * 1024 || totalBytes > 25 * 1024 * 1024) throw new Error();
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo();
        if (info.total > 100) throw new Error();
        const result = await parser.getText();
        if (result.text.length > 1_000_000) throw new Error();
        checks.push(...checkReportTextNumbers(result.text, report.reportType, readReportVerification(payload)).map(check => ({ ...check, subject })));
      } finally { await parser.destroy(); }
    } catch { checks.push({ section: "Reports / PDF numbers", code: "PDF_CONTENT_UNVERIFIED", subject, status: "unverified" }); }
  }
  return checks;
}
