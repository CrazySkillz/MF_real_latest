export type ParsedCsv = {
  headers: string[];
  rows: Array<Record<string, string>>;
};

// Simple, robust-enough CSV parser for typical exports (handles quotes and commas in quotes).
export function parseCsvText(csvText: string, maxRows?: number): ParsedCsv {
  const text = String(csvText || "").replace(/^\uFEFF/, ""); // strip BOM
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
    if (ch === ",") {
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
  const headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));

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


