export const GOOGLE_SHEETS_REVENUE_ROWS_PER_CHUNK = 5_000;
export const GOOGLE_SHEETS_REVENUE_MAX_ROWS = 50_000;

export function resolveGoogleSheetsRevenueGrid(
  sheets: unknown,
  requestedSheetName?: string | null,
): { sheetName: string; rowCount: number } | null {
  const grids = (Array.isArray(sheets) ? sheets : [])
    .map((sheet: any) => sheet?.properties)
    .filter((properties: any) => {
      const rowCount = Number(properties?.gridProperties?.rowCount);
      return String(properties?.title || "").trim() && Number.isSafeInteger(rowCount) && rowCount > 0;
    })
    .sort((a: any, b: any) => Number(a?.index || 0) - Number(b?.index || 0));
  const requested = String(requestedSheetName || "").trim();
  const selected = requested
    ? grids.find((properties: any) => String(properties.title) === requested)
    : grids.find((properties: any) => properties?.hidden !== true);
  return selected
    ? { sheetName: String(selected.title), rowCount: Number(selected.gridProperties.rowCount) }
    : null;
}

export function buildGoogleSheetsRevenueRowRanges(sheetName: string, rowCount: number): string[] {
  if (!Number.isSafeInteger(rowCount) || rowCount < 1) {
    throw new Error("Google Sheets revenue tab has an invalid row count");
  }
  if (rowCount > GOOGLE_SHEETS_REVENUE_MAX_ROWS) {
    const error: any = new Error(`Google Sheets revenue supports at most ${GOOGLE_SHEETS_REVENUE_MAX_ROWS.toLocaleString("en-US")} rows including the header`);
    error.code = "GOOGLE_SHEETS_REVENUE_TOO_LARGE";
    throw error;
  }
  const prefix = `'${String(sheetName).replace(/'/g, "''")}'!`;
  const ranges: string[] = [];
  for (let start = 1; start <= rowCount; start += GOOGLE_SHEETS_REVENUE_ROWS_PER_CHUNK) {
    const end = Math.min(start + GOOGLE_SHEETS_REVENUE_ROWS_PER_CHUNK - 1, rowCount);
    ranges.push(`${prefix}${start}:${end}`);
  }
  return ranges;
}
