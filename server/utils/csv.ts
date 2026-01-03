export type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

// Simple, robust-enough delimited text parser for typical exports (handles quotes and delimiter chars in quotes).
export function parseCsvText(csvText: string, maxRows?: number): ParsedCsv {
  const text = String(csvText || "").replace(/^\uFEFF/, ""); // strip BOM

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
  // Fallback: if we somehow parsed only one column but the header line clearly contains the delimiter,
  // re-split naively for unquoted exports.
  let headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));
  if (headers.length === 1) {
    const firstLine = (text.split("\n")[0] || "").replace(/\r/g, "");
    const hasQuotes = firstLine.includes('"');
    if (!hasQuotes && firstLine.includes(delim)) {
      headers = firstLine.split(delim).map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));
      // Rebuild rows using naive split (safe for non-quoted exports)
      rows.length = 0;
      const rawLines = text.split("\n").map((l) => l.replace(/\r/g, "")).filter((l) => l.length > 0);
      for (let i = 0; i < rawLines.length; i++) {
        const parts = rawLines[i].split(delim);
        rows.push(parts);
        if (maxRows && rows.length >= maxRows) break;
      }
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


