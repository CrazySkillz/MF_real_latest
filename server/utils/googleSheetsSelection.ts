export function normalizeSheetNames(sheetNames: any): string[] {
  if (!Array.isArray(sheetNames)) return [];
  return sheetNames
    .filter((s) => typeof s === "string" && s.trim().length > 0)
    .map((s) => s.trim());
}

// Saved main-dataset mappings are also consumed by cached reports and aggregates.
export function googleSheetsMappings(raw: any, headers: any[]): any[] {
  const mappings = typeof raw === "string" ? JSON.parse(raw) : raw ?? [];
  if (!Array.isArray(mappings)) throw new Error("Invalid saved Google Sheets mappings");
  const targets = new Set<string>();
  for (const mapping of mappings) {
    const index = mapping?.sourceColumnIndex ?? mapping?.columnIndex;
    const target = String(mapping?.targetFieldId || mapping?.platformField || "");
    if (!Number.isInteger(index) || index < 0 || index >= headers.length || targets.has(target)
      || (mapping.sourceColumnName && (String(headers[index]).trim() !== String(mapping.sourceColumnName).trim()
        || headers.filter(h => String(h).trim() === String(mapping.sourceColumnName).trim()).length !== 1))) {
      throw new Error("Saved Google Sheets columns changed. Review the dataset mappings.");
    }
    targets.add(target);
  }
  return mappings;
}

export function filterGoogleSheetsRows(connection: any, headers: any[], rows: any[][], campaignName = "", window?: { start: string; end: string }): any[][] {
  const mappings = googleSheetsMappings(connection?.columnMappings, headers);
  const target = (m: any) => m?.targetFieldId || m?.platformField;
  const values = (m: any) => [...(Array.isArray(m?.selectedValues) ? m.selectedValues : []), m?.selectedValue, m?.campaignIdentifierValue]
    .map(v => String(v ?? "").trim().toLowerCase()).filter(Boolean);
  const identifiers = [mappings.find(m => target(m) === "campaign_id"), mappings.find(m => target(m) === "campaign_name")].filter(Boolean);
  const selected = identifiers.find(m => values(m).length > 0) || identifiers[0];
  const legacy = headers.map((h, i) => /^campaign[ _-]name$/i.test(String(h).trim()) ? i : -1).filter(i => i >= 0);
  if (!selected && legacy.length > 1) throw new Error("Google Sheets campaign column is ambiguous");
  const index = selected ? selected.sourceColumnIndex ?? selected.columnIndex : legacy[0] ?? -1;
  const selectedValues = selected ? values(selected) : [];
  const allowed = new Set(selectedValues.length ? selectedValues : [String(campaignName).trim().toLowerCase()].filter(Boolean));
  if (index >= 0 && !allowed.size) throw new Error("Google Sheets campaign selection is missing");
  let filtered = index >= 0 ? rows.filter(row => allowed.has(String(row?.[index] ?? "").trim().toLowerCase())) : rows;
  // A legacy platform-only filter cannot be reconstructed without its selected platform context.
  if (!selectedValues.length && headers.some(h => /platform/i.test(String(h)))) throw new Error("Save an explicit Google Sheets campaign selection before using cached metrics");
  if (window) {
    const isoDay = (value: any) => {
      const day = String(value ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
      const date = new Date(`${day}T00:00:00Z`);
      return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : null;
    };
    if (!isoDay(window.start) || !isoDay(window.end) || window.start > window.end) throw new Error("Invalid Google Sheets reporting window");
    const dateMapping = mappings.find(m => target(m) === "date");
    const dates = headers.map((h, i) => /^date$/i.test(String(h).trim()) ? i : -1).filter(i => i >= 0);
    const dateIndex = dateMapping ? dateMapping.sourceColumnIndex ?? dateMapping.columnIndex : dates.length === 1 ? dates[0] : -1;
    if (dateIndex < 0) throw new Error("A mapped Date column is required for a dated Google Sheets report");
    filtered = filtered.filter(row => {
      const day = isoDay(row[dateIndex]);
      if (!day) throw new Error("Google Sheets report dates must be valid YYYY-MM-DD values");
      return day >= window.start && day <= window.end;
    });
  }
  return filtered;
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
  allowZero?: boolean;
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
      if (params.allowZero ? v < 0 : v <= 0) continue;
      if (!Array.isArray(row) || row.length <= dateColumnIndex) continue;
      const ts = parseTimestamp(row[dateColumnIndex]);
      if (Number.isFinite(ts) && ts >= bestTime) {
        bestTime = ts;
        bestValue = v;
      }
    }
    if (Number.isFinite(bestTime) && (params.allowZero ? bestValue >= 0 : bestValue > 0)) return bestValue;
    // fall back to median if we couldn't pick latest
  }

  const values: number[] = [];
  for (const row of rows) {
    if (!Array.isArray(row) || row.length <= valueColumnIndex) continue;
    const v = parseValue(row[valueColumnIndex]);
    if (params.allowZero ? v >= 0 : v > 0) values.push(v);
  }
  if (values.length === 0) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return (params.allowZero ? median >= 0 : median > 0) ? median : null;
}


