import { normalizeStrictUtcDateKey } from "./data-transformation";

export type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

export type CsvParseOptions = {
  strict?: boolean;
};

const csvParseError = (message: string, code = "CSV_MALFORMED") => {
  const error: any = new Error(message);
  error.code = code;
  return error;
};

export const normalizeFinancialSourceDateKey = (value: unknown): string | null => {
  const raw = String(value ?? "").trim();
  if (!raw || /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw)) return null;
  const explicitDate = raw.match(/^(\d{4}-\d{2}-\d{2})(?:T|\s)/)?.[1];
  if (explicitDate) return normalizeStrictUtcDateKey(explicitDate) === explicitDate ? explicitDate : null;
  return normalizeStrictUtcDateKey(raw);
};

export type CsvSpendAggregation = {
  keptRows: number;
  totalSpend: number;
  dailySpend: Array<{ date: string; spend: number }>;
  undatedSpend: number;
};

export type CsvRevenueAggregation = {
  keptRows: number;
  totalRevenue: number;
  dailyRevenue: Array<{ date: string; revenue: number }>;
  undatedRevenue: number;
};

const GA4_CSV_REVENUE_AMOUNT = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{0,2})?|\.\d{1,2})$/;
export const GA4_CSV_MAX_REVENUE_TOTAL = 9_999_999_999.99;

export const isSupportedGa4CsvRevenueAmount = (value: unknown, campaignCurrency: string): boolean => {
  const raw = String(value ?? "").trim();
  if (!raw) return true;
  const hasDollarSymbol = raw.includes("$");
  if (hasDollarSymbol && String(campaignCurrency || "").trim().toUpperCase() !== "USD") return false;
  const withoutCurrency = raw
    .replace(/^([+-]?)\$\s*/, "$1")
    .replace(/^\$\s*([+-])/, "$1");
  const amount = Number(withoutCurrency.replace(/,/g, ""));
  return GA4_CSV_REVENUE_AMOUNT.test(withoutCurrency)
    && Number.isFinite(amount)
    && Math.abs(amount) <= GA4_CSV_MAX_REVENUE_TOTAL;
};

export function findInvalidGa4CsvRevenueAmountRows(
  rows: Array<Record<string, unknown>>,
  mapping: {
    revenueColumn: string;
    campaignCurrency: string;
    campaignColumn?: string | null;
    campaignValue?: string | null;
    campaignValues?: readonly unknown[] | null;
  },
): number[] {
  const selectedCampaigns = Array.isArray(mapping.campaignValues) && mapping.campaignValues.length > 0
    ? new Set(mapping.campaignValues.map((value) => String(value ?? "").trim()).filter(Boolean))
    : null;
  const campaignValue = String(mapping.campaignValue || "").trim();
  return rows.flatMap((row, index) => {
    if (mapping.campaignColumn && (selectedCampaigns || campaignValue)) {
      const value = String(row[mapping.campaignColumn] ?? "").trim();
      if (selectedCampaigns ? !selectedCampaigns.has(value) : value !== campaignValue) return [];
    }
    return isSupportedGa4CsvRevenueAmount(row[mapping.revenueColumn], mapping.campaignCurrency) ? [] : [index + 2];
  });
}

export function aggregateCsvRevenueRows(
  rows: Array<Record<string, any>>,
  mapping: {
    revenueColumn: string;
    dateColumn?: string | null;
    campaignColumn?: string | null;
    campaignValue?: string | null;
    campaignValues?: string[] | null;
  },
): CsvRevenueAggregation {
  const selectedCampaigns = Array.isArray(mapping.campaignValues) && mapping.campaignValues.length > 0
    ? new Set(mapping.campaignValues.map((value) => String(value ?? "").trim()).filter(Boolean))
    : null;
  const campaignValue = mapping.campaignValue ? String(mapping.campaignValue).trim() : null;
  const dailyRevenue = new Map<string, number>();
  let keptRows = 0;
  let totalRevenue = 0;
  let undatedRevenue = 0;

  for (const row of rows) {
    if (mapping.campaignColumn && (selectedCampaigns || campaignValue)) {
      const value = String(row?.[mapping.campaignColumn] ?? "").trim();
      if (selectedCampaigns ? !selectedCampaigns.has(value) : value !== campaignValue) continue;
    }

    const rawRevenue = String(row?.[mapping.revenueColumn] ?? "").replace(/[$,]/g, "").trim();
    const revenue = Number.parseFloat(rawRevenue);
    if (!Number.isFinite(revenue) || revenue <= 0) continue;

    keptRows++;
    totalRevenue += revenue;
    if (mapping.dateColumn) {
      const date = normalizeFinancialSourceDateKey(row?.[mapping.dateColumn]);
      if (!date) {
        undatedRevenue += revenue;
        continue;
      }
      dailyRevenue.set(date, (dailyRevenue.get(date) || 0) + revenue);
    }
  }

  return {
    keptRows,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    dailyRevenue: Array.from(dailyRevenue.entries()).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
    })),
    undatedRevenue: Number(undatedRevenue.toFixed(2)),
  };
}

export const isSupportedGa4CsvRevenueDate = (value: unknown): boolean => {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:(?:T| )(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):?[0-5]\d)?)?$/);
  return Boolean(match && normalizeStrictUtcDateKey(match[1]) === match[1]);
};

export function findInvalidGa4CsvRevenueDateRows(
  rows: Array<Record<string, unknown>>,
  mapping: {
    revenueColumn: string;
    dateColumn: string;
    campaignColumn?: string | null;
    campaignValue?: string | null;
    campaignValues?: readonly unknown[] | null;
  },
): number[] {
  const selectedCampaigns = Array.isArray(mapping.campaignValues) && mapping.campaignValues.length > 0
    ? new Set(mapping.campaignValues.map((value) => String(value ?? "").trim()).filter(Boolean))
    : null;
  const campaignValue = String(mapping.campaignValue || "").trim();
  return rows.flatMap((row, index) => {
    if (mapping.campaignColumn && (selectedCampaigns || campaignValue)) {
      const value = String(row[mapping.campaignColumn] ?? "").trim();
      if (selectedCampaigns ? !selectedCampaigns.has(value) : value !== campaignValue) return [];
    }
    const revenue = Number.parseFloat(String(row[mapping.revenueColumn] ?? "").replace(/[$,]/g, "").trim());
    if (!Number.isFinite(revenue) || revenue <= 0) return [];
    return isSupportedGa4CsvRevenueDate(row[mapping.dateColumn]) ? [] : [index + 2];
  });
}

export function aggregateCsvSpendRows(
  rows: Array<Record<string, any>>,
  mapping: {
    spendColumn: string;
    dateColumn?: string | null;
    campaignColumn?: string | null;
    campaignValue?: string | null;
    campaignValues?: string[] | null;
  },
): CsvSpendAggregation {
  const selectedCampaigns = Array.isArray(mapping.campaignValues) && mapping.campaignValues.length > 0
    ? new Set(mapping.campaignValues.map((value) => String(value ?? "").trim()).filter(Boolean))
    : null;
  const campaignValue = mapping.campaignValue ? String(mapping.campaignValue).trim() : null;
  const dailySpend = new Map<string, number>();
  let keptRows = 0;
  let totalSpend = 0;
  let undatedSpend = 0;

  for (const row of rows) {
    if (mapping.campaignColumn && (selectedCampaigns || campaignValue)) {
      const value = String(row?.[mapping.campaignColumn] ?? "").trim();
      if (selectedCampaigns ? !selectedCampaigns.has(value) : value !== campaignValue) continue;
    }

    const rawSpend = String(row?.[mapping.spendColumn] ?? "").replace(/[$,]/g, "").trim();
    const spend = Number.parseFloat(rawSpend);
    if (!Number.isFinite(spend) || spend <= 0) continue;

    keptRows++;
    totalSpend += spend;
    if (mapping.dateColumn) {
      const date = normalizeFinancialSourceDateKey(row?.[mapping.dateColumn]);
      if (!date) {
        undatedSpend += spend;
        continue;
      }
      dailySpend.set(date, (dailySpend.get(date) || 0) + spend);
    }
  }

  return {
    keptRows,
    totalSpend: Number(totalSpend.toFixed(2)),
    dailySpend: Array.from(dailySpend.entries()).map(([date, spend]) => ({
      date,
      spend: Number(spend.toFixed(2)),
    })),
    undatedSpend: Number(undatedSpend.toFixed(2)),
  };
}

// Simple, robust-enough delimited text parser for typical exports (handles quotes and delimiter chars in quotes).
export function parseCsvText(csvText: string, maxRows?: number, options?: CsvParseOptions): ParsedCsv {
  const strict = options?.strict === true;
  const text = String(csvText || "")
    .replace(/^\uFEFF/, "") // strip BOM
    // Normalize line endings. Some exports use CR-only which would otherwise collapse rows.
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (strict && /[\u0000\uFFFD]/.test(text)) {
    throw csvParseError("CSV contains unsupported binary or non-UTF-8 data.");
  }

  // Detect delimiter from the first non-empty line(s). Many "CSV" exports use ; or tabs depending on locale.
  const detectDelimiter = (): string => {
    const lines = text.split("\n").slice(0, 10).map((l) => l.replace(/\r/g, "")).filter((l) => l.trim().length > 0);
    const candidates = [",", ";", "\t", "|"];

    const countDelims = (line: string, delim: string) => {
      let count = 0;
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];
        if (inQuotes) {
          if (ch === '"' && next === '"') { i++; continue; }
          if (ch === '"') { inQuotes = false; continue; }
          continue;
        }
        if (ch === '"') { inQuotes = true; continue; }
        if (ch === delim) count++;
      }
      return count;
    };

    // Strong hint: if the header line clearly uses one delimiter, prefer it.
    const headerLine = lines[0] || "";
    const headerCounts = candidates.map((delimiter) => ({ delimiter, count: countDelims(headerLine, delimiter) }));
    const maxHeaderCount = Math.max(...headerCounts.map(({ count }) => count));
    if (strict && maxHeaderCount > 0 && headerCounts.filter(({ count }) => count === maxHeaderCount).length > 1) {
      throw csvParseError("CSV header uses ambiguous delimiters.");
    }
    if (strict && maxHeaderCount > 0) {
      return headerCounts.find(({ count }) => count === maxHeaderCount)!.delimiter;
    }
    for (const d of candidates) {
      const headerCount = countDelims(headerLine, d);
      if (headerCount >= 2) return d;
    }

    let best = ",";
    let bestScore = -1;
    for (const d of candidates) {
      const score = lines.reduce((sum, ln) => sum + countDelims(ln, d), 0);
      if (score > bestScore) {
        bestScore = score;
        best = d;
      }
    }
    return best;
  };

  const delim = detectDelimiter();
  const rows: string[][] = [];

  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  let afterQuote = false;

  const pushCell = () => {
    cur.push(cell);
    cell = "";
    afterQuote = false;
  };
  const pushRow = () => {
    if (strict && cur.every((value) => String(value ?? "").trim() === "")) {
      cur = [];
      return;
    }
    rows.push(cur);
    cur = [];
    if (strict && maxRows && rows.length > maxRows + 1) {
      throw csvParseError(`CSV too large. Please reduce rows (max ${maxRows.toLocaleString()} data rows).`, "CSV_TOO_LARGE");
    }
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        afterQuote = true;
        continue;
      }
      cell += ch;
      continue;
    }

    if (strict && afterQuote) {
      if (ch === " " || ch === "\t") continue;
      if (ch === delim) {
        pushCell();
        continue;
      }
      if (ch === "\n") {
        pushCell();
        pushRow();
        continue;
      }
      throw csvParseError("CSV contains characters after a closing quote.");
    }

    if (ch === '"') {
      if (strict && cell.length > 0) throw csvParseError("CSV contains a quote inside an unquoted field.");
      inQuotes = true;
      continue;
    }
    if (ch === delim) {
      pushCell();
      continue;
    }
    if (ch === "\r") {
      continue;
    }
    if (ch === "\n") {
      pushCell();
      pushRow();
      if (!strict && maxRows && rows.length >= maxRows) break;
      continue;
    }
    cell += ch;
  }

  if (strict && inQuotes) throw csvParseError("CSV contains an unclosed quoted field.");

  // last cell/row
  if (cell.length > 0 || cur.length > 0) {
    pushCell();
    pushRow();
  }

  const headerRow = rows[0] || [];
  // Fallback: if we parsed only one column, try to recover by splitting on a common delimiter present in the header.
  let headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));
  if (strict) {
    if (rows.length < 2) throw csvParseError("CSV must include a header and at least one data row.");
    if (headerRow.some((header) => !String(header ?? "").trim())) throw csvParseError("CSV headers cannot be blank.");
    headers = headerRow.map((header) => String(header).trim());
    if (new Set(headers).size !== headers.length) throw csvParseError("CSV headers must be unique.");
    const invalidWidth = rows.slice(1).findIndex((row) => row.length !== headers.length);
    if (invalidWidth >= 0) throw csvParseError(`CSV row ${invalidWidth + 2} has a different number of columns than the header.`);
  } else if (headers.length === 1) {
    const firstLine = (text.split("\n")[0] || "");
    const candidates = [",", ";", "\t", "|"];
    const headerCell = String(headerRow[0] ?? "");

    // Heuristic: some "CSV" exports end up as a single column where each row is itself a comma-separated string.
    // Example rows[0] = ["date,Campaign,spend"], rows[1] = ["2026-01-01,foo,123"].
    // If splitting the single cell produces a consistent column count across several rows, treat it as embedded CSV.
    const chooseEmbeddedDelimiter = (): string | null => {
      const sample = rows.slice(0, Math.min(rows.length, 6));
      if (sample.length < 2) return null;
      if (!sample.every((r) => Array.isArray(r) && r.length === 1)) return null;

      for (const d of candidates) {
        const lens = sample
          .map((r) => String(r?.[0] ?? ""))
          .filter((s) => s.trim().length > 0)
          .map((s) => s.split(d).length);
        if (lens.length < 2) continue;
        const firstLen = lens[0];
        if (firstLen < 3) continue; // need at least 3 columns to be confident
        const consistent = lens.every((n) => n === firstLen);
        if (consistent) return d;
      }
      return null;
    };

    const embeddedDelim = chooseEmbeddedDelimiter();
    const bestDelim =
      embeddedDelim ||
      candidates.find((d) => headerCell.split(d).length >= 3) || // at least 3 columns
      (candidates.find((d) => firstLine.split(d).length >= 3) || null);

    if (bestDelim) {
      // Rebuild rows by splitting the single-cell rows using the chosen delimiter.
      const rebuilt: string[][] = [];
      for (const r of rows) {
        if (Array.isArray(r) && r.length === 1) {
          rebuilt.push(String(r[0] ?? "").split(bestDelim));
        } else {
          rebuilt.push(r);
        }
      }
      // Replace the parsed rows in-place
      rows.length = 0;
      for (const r of rebuilt) rows.push(r);
      const newHeaderRow = rows[0] || [];
      headers = newHeaderRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));
    }
  }

  const outRows: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    // skip entirely empty rows
    if (row.every((v) => String(v || "").trim() === "")) continue;
    const obj: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = String(row[c] ?? "").trim();
    }
    outRows.push(obj);
  }

  return { headers, rows: outRows };
}


