export const GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES = 300;

export function selectGoogleSheetsRevenuePreviewRows(
  rows: Array<Record<string, string>>,
  campaignColumn?: string | null,
): { success: true; sampleRows: Array<Record<string, string>> } | { success: false; error: string } {
  const column = String(campaignColumn || "").trim();
  if (!column) return { success: true, sampleRows: rows.slice(0, 25) };

  const values = new Map<string, { count: number; row: Record<string, string> }>();
  for (const row of rows) {
    const value = String(row?.[column] ?? "").trim();
    if (!value) continue;
    const existing = values.get(value);
    if (existing) {
      existing.count += 1;
      continue;
    }
    if (values.size >= GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES) {
      return {
        success: false,
        error: `Campaign column has more than ${GOOGLE_SHEETS_REVENUE_MAX_CAMPAIGN_VALUES} distinct values. Choose a lower-cardinality column or clear the Campaign identifier.`,
      };
    }
    values.set(value, { count: 1, row });
  }
  const sampleRows = Array.from(values.values())
    .sort((a, b) => b.count - a.count)
    .map(({ row }) => row);
  return { success: true, sampleRows };
}
