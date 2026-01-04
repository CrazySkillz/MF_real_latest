export type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

// Simple, robust-enough delimited text parser for typical exports (handles quotes and delimiter chars in quotes).
export function parseCsvText(csvText: string, maxRows?: number): ParsedCsv {
  const text = String(csvText || "")
    .replace(/^\uFEFF/, "") // strip BOM
    // Normalize line endings. Some exports use CR-only which would otherwise collapse rows.
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

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

  const pushCell = () => {
    cur.push(cell);
    cell = "";
  };
  const pushRow = () => {
    rows.push(cur);
    cur = [];
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
        continue;
      }
      cell += ch;
      continue;
    }

    if (ch === '"') {
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
      if (maxRows && rows.length >= maxRows) break;
      continue;
    }
    cell += ch;
  }

  // last cell/row
  if (cell.length > 0 || cur.length > 0) {
    pushCell();
    pushRow();
  }

  const headerRow = rows[0] || [];
  // Fallback: if we parsed only one column, try to recover by splitting on a common delimiter present in the header.
  let headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));
  if (headers.length === 1) {
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


