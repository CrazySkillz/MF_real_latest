type GoogleSheetsRevenueAmountMapping = {
  revenueColumn: string;
  campaignColumn?: string | null;
  campaignValue?: string | null;
  campaignValues?: readonly unknown[] | null;
};

const GOOGLE_SHEETS_REVENUE_AMOUNT = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/;

export function isSupportedGoogleSheetsRevenueAmount(value: unknown): boolean {
  if (value === null || typeof value === "undefined") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;

  const raw = value.trim();
  if (!raw) return true;
  const withoutCurrency = raw
    .replace(/^([+-]?)\$\s*/, "$1")
    .replace(/^\$\s*([+-])/, "$1");
  if (!GOOGLE_SHEETS_REVENUE_AMOUNT.test(withoutCurrency)) return false;

  return Number.isFinite(Number(withoutCurrency.replace(/,/g, "")));
}

export function findInvalidGoogleSheetsRevenueAmountRows(
  rows: Array<Record<string, unknown>>,
  mapping: GoogleSheetsRevenueAmountMapping,
): number[] {
  const campaignColumn = String(mapping.campaignColumn || "").trim();
  const campaignValues = Array.isArray(mapping.campaignValues)
    ? mapping.campaignValues.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const campaignValueSet = campaignValues.length > 0 ? new Set(campaignValues) : null;
  const campaignValue = String(mapping.campaignValue || "").trim();

  return rows.flatMap((row, index) => {
    if (campaignColumn && (campaignValueSet || campaignValue)) {
      const rowCampaignValue = String(row[campaignColumn] ?? "").trim();
      if (campaignValueSet ? !campaignValueSet.has(rowCampaignValue) : rowCampaignValue !== campaignValue) {
        return [];
      }
    }
    return isSupportedGoogleSheetsRevenueAmount(row[mapping.revenueColumn]) ? [] : [index + 2];
  });
}
