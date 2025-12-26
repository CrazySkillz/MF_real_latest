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


