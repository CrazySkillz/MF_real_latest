import { sumSpendAmounts } from "../shared/currency";

export function buildGA4GoogleAdsSpendMaterialization(input: {
  campaignId: string;
  currency: string;
  accountName: string;
  selectedCampaignIds: unknown;
  rows: any[];
  startDate: string;
  endDate: string;
  fetchedAt: unknown;
  requireEverySelectedCampaign?: boolean;
}) {
  const selectedCampaignIds = Array.from(new Set(
    (Array.isArray(input.selectedCampaignIds) ? input.selectedCampaignIds : [])
      .map((id: any) => String(id || "").trim()).filter(Boolean)
  ));
  if (selectedCampaignIds.length === 0) throw new Error("Select at least one Google Ads campaign");
  const selectedSet = new Set(selectedCampaignIds);
  const rows = input.rows.filter((row: any) => selectedSet.has(String(row?.googleCampaignId || "")));
  const observedIds = new Set(rows.map((row: any) => String(row?.googleCampaignId || "")).filter(Boolean));
  if (input.requireEverySelectedCampaign !== false && (rows.length === 0 || selectedCampaignIds.some((id) => !observedIds.has(id)))) {
    throw new Error("Selected Google Ads campaigns are unavailable in the connected account data");
  }

  const grouped = new Map<string, { name: string; spend: string[]; impressions: number; clicks: number }>();
  const spendByDate = new Map<string, string[]>();
  for (const row of rows) {
    const spend = Number(row?.spend);
    if (!Number.isFinite(spend) || spend < 0) throw new Error("Google Ads returned an invalid spend value");
    const date = String(row?.date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < input.startDate || date > input.endDate) {
      throw new Error("Google Ads returned an invalid spend date");
    }
    const id = String(row?.googleCampaignId || "");
    const aggregate = grouped.get(id) || { name: String(row?.googleCampaignName || id), spend: [], impressions: 0, clicks: 0 };
    aggregate.spend.push(String(row.spend));
    aggregate.impressions += Number(row?.impressions || 0);
    aggregate.clicks += Number(row?.clicks || 0);
    grouped.set(id, aggregate);
    const dailyAmounts = spendByDate.get(date) || [];
    dailyAmounts.push(String(row.spend));
    spendByDate.set(date, dailyAmounts);
  }

  const records = Array.from(spendByDate.entries()).map(([date, spend]) => ({
    campaignId: input.campaignId,
    date,
    spend: sumSpendAmounts(spend, 6),
    currency: input.currency,
    sourceType: "ad_platforms",
    subCampaignUrn: null,
  }));
  const amount = Number(sumSpendAmounts(records.map(row => row.spend)));
  return {
    amount,
    records,
    mappingConfig: {
      platform: "google_ads",
      adAccountName: input.accountName,
      selectedCampaignIds,
      breakdown: Array.from(grouped.entries()).map(([campaignId, row]) => ({ campaignId, ...row, spend: Number(sumSpendAmounts(row.spend)) })),
      sourceDataStartDate: input.startDate,
      sourceDataEndDate: input.endDate,
      fetchedAt: input.fetchedAt || new Date().toISOString(),
    },
  };
}
