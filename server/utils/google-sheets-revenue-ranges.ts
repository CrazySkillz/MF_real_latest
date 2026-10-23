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
  const requested = String(requestedSheetName || "");
  const selected = requested.trim()
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

// Main Sheets analytics uses the same bounded full-width ranges as financial imports.
// request retains the caller's existing OAuth refresh and timeout behavior.
export async function readCompleteGoogleSheetsData(connection: any, request: (url: string, signal: AbortSignal) => Promise<Response>): Promise<any[][]> {
  if (!String(connection?.sheetName || "").trim()) throw new Error("Select an exact Google Sheets tab before refreshing");
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(connection.spreadsheetId)}`;
  const metadataUrl = `${base}?fields=sheets(properties(title,index,gridProperties(rowCount,columnCount)))`;
  const deadline = AbortSignal.timeout(45_000);
  const metadataResponse = await request(metadataUrl, deadline);
  if (!metadataResponse.ok) throw Object.assign(new Error("Unable to read Google Sheets tab metadata"), { status: metadataResponse.status });
  const metadata = await metadataResponse.json();
  const grid = resolveGoogleSheetsRevenueGrid(metadata?.sheets, connection.sheetName);
  const properties = metadata?.sheets?.find((s: any) => s?.properties?.title === connection.sheetName)?.properties;
  const columns = Number(properties?.gridProperties?.columnCount);
  if (!grid || !Number.isSafeInteger(columns) || columns < 1) throw new Error("Google Sheets tab metadata is invalid or the selected tab was removed");
  if (columns > 200) throw Object.assign(new Error("Google Sheets analytics supports at most 200 columns. Use a smaller selected tab."), { status: 413 });
  if (grid.rowCount * columns > 2_000_000) throw Object.assign(new Error("Google Sheets analytics supports at most 2,000,000 grid cells. Use a smaller selected tab."), { status: 413 });
  const ranges = buildGoogleSheetsRevenueRowRanges(grid.sheetName, grid.rowCount);
  const values: any[][] = [];
  for (let i = 0; i < ranges.length; i++) {
    const response = await request(`${base}/values/${encodeURIComponent(ranges[i])}`, deadline);
    if (!response.ok) throw Object.assign(new Error("Unable to read the complete Google Sheets tab. Saved data was preserved."), { status: response.status });
    const chunk = await response.json();
    if (!chunk || (chunk.values !== undefined && (!Array.isArray(chunk.values) || chunk.values.some((row: any) => !Array.isArray(row) || row.length > columns)))) throw new Error("Invalid Google Sheets values response");
    const rows = chunk.values || [];
    const requestedRows = Math.min(GOOGLE_SHEETS_REVENUE_ROWS_PER_CHUNK, grid.rowCount - i * GOOGLE_SHEETS_REVENUE_ROWS_PER_CHUNK);
    if (rows.length > requestedRows) throw new Error("Google Sheets response exceeds the requested range");
    // Preserve blank leading/trailing rows between chunks, including an empty header.
    values.push(...rows);
    if (i < ranges.length - 1) for (let j = rows.length; j < requestedRows; j++) values.push([]);
  }
  const finalResponse = await request(metadataUrl, deadline);
  if (!finalResponse.ok) throw new Error("Unable to verify Google Sheets read completeness");
  const finalMetadata = await finalResponse.json();
  const finalGrid = finalMetadata?.sheets?.find((s: any) => s?.properties?.title === connection.sheetName)?.properties?.gridProperties;
  if (Number(finalGrid?.rowCount) !== grid.rowCount || Number(finalGrid?.columnCount) !== columns) throw new Error("Google Sheets structure changed during refresh. Retry the refresh.");
  return values;
}

export function hasCompleteGoogleSheetsCache(connection: any, now = Date.now()): boolean {
  const cache = connection?.cachedData;
  const refreshed = new Date(connection?.lastDataRefreshAt).getTime();
  return cache?.complete === true && cache?.spreadsheetId === connection?.spreadsheetId && cache?.sheetName === connection?.sheetName
    && Array.isArray(cache?.headers) && Array.isArray(cache?.rows) && cache.totalRows === cache.rows.length
    && Number.isFinite(refreshed) && refreshed <= now && now - refreshed < 25 * 60 * 60 * 1000;
}
