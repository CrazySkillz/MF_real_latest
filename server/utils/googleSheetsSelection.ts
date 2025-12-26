export function normalizeSheetNames(sheetNames: any): string[] {
  if (!Array.isArray(sheetNames)) return [];
  return sheetNames
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
}

export function computeConnectedSheets(params: {
  normalizedSheetNames: string[];
  existingSheetNames: string[];
  availableSlots: number;
}): { connectedSheetNames: string[]; sheetsToCreate: string[] } {
  const { normalizedSheetNames, existingSheetNames, availableSlots } = params;
  const existingSet = new Set(existingSheetNames.map((s) => String(s || "").trim()));
  const newSheetsNeeded = normalizedSheetNames.filter((s) => !existingSet.has(String((s || "").trim())));
  const sheetsToCreate = newSheetsNeeded.slice(0, Math.max(0, availableSlots));
  const connectedSheetNames = normalizedSheetNames.filter((s) => existingSet.has(String((s || "").trim())) || sheetsToCreate.includes(s));
  return { connectedSheetNames, sheetsToCreate };
}

export function validateSheetNamesExist(params: { normalizedSheetNames: string[]; spreadsheetTabTitles: string[] | null | undefined }): string[] {
  const { normalizedSheetNames, spreadsheetTabTitles } = params;
  if (!spreadsheetTabTitles || spreadsheetTabTitles.length === 0) return [];
  const titleSet = new Set(spreadsheetTabTitles.map((t) => String(t).trim()));
  return normalizedSheetNames.filter((s) => !titleSet.has(String((s || "").trim())));
}

export function shouldDeactivateConnection(params: {
  connectionId: string;
  sheetName: string | null | undefined;
  keepIds: Set<string>;
  selectedSheetNames: Set<string>;
}): boolean {
  const { connectionId, sheetName, keepIds, selectedSheetNames } = params;
  const sheetKey = String((sheetName || "").trim());
  const shouldKeep = keepIds.has(String(connectionId));
  const isSelected = selectedSheetNames.has(sheetKey);
  return !shouldKeep || !isSelected;
}

export function dedupeSourcesBySpreadsheetAndSheet<T extends { spreadsheetId?: any; sheetName?: any; connectedAt?: any }>(sources: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const s of sources) {
    const key = `${String((s as any).spreadsheetId || "")}::${String((s as any).sheetName || "")}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, s);
      continue;
    }
    const existingTime = (existing as any).connectedAt ? new Date((existing as any).connectedAt).getTime() : 0;
    const nextTime = (s as any).connectedAt ? new Date((s as any).connectedAt).getTime() : 0;
    if (nextTime >= existingTime) byKey.set(key, s);
  }
  return Array.from(byKey.values());
}

export function pickConversionValueFromRows(params: {
  rows: any[][];
  valueColumnIndex: number;
  dateColumnIndex?: number;
  strategy: "latest" | "median";
}): number | null {
  const { rows, valueColumnIndex, dateColumnIndex, strategy } = params;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  if (typeof valueColumnIndex !== "number" || valueColumnIndex < 0) return null;

  const parseValue = (raw: any): number => {
    const s = String(raw ?? "0");
    return parseFloat(s.replace(/[$,]/g, "")) || 0;
  };

  const parseTimestamp = (raw: any): number => {
    const s = String(raw ?? "").trim();
    if (!s) return NaN;
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return t;
    const n = Number(s);
    // Best-effort: treat large numeric values as Excel serial dates.
    if (Number.isFinite(n) && n > 25000 && n < 60000) {
      return (n - 25569) * 86400 * 1000;
    }
    return NaN;
  };

  if (strategy === "latest" && typeof dateColumnIndex === "number" && dateColumnIndex >= 0) {
    let bestTime = -Infinity;
    let bestValue = 0;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length <= valueColumnIndex) continue;
      const v = parseValue(row[valueColumnIndex]);
      if (v <= 0) continue;
      if (!Array.isArray(row) || row.length <= dateColumnIndex) continue;
      const ts = parseTimestamp(row[dateColumnIndex]);
      if (Number.isFinite(ts) && ts >= bestTime) {
        bestTime = ts;
        bestValue = v;
      }
    }
    if (Number.isFinite(bestTime) && bestValue > 0) return bestValue;
    // fall back to median if we couldn't pick latest
  }

  const values: number[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length <= valueColumnIndex) continue;
    const v = parseValue(row[valueColumnIndex]);
    if (v > 0) values.push(v);
  }
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return median > 0 ? median : null;
}


