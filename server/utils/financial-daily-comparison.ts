import type { MetricSnapshot } from "../../shared/schema";
import { storage } from "../storage";
import { resolveCampaignCumulativeFinancials } from "./campaign-cumulative-financials";
import {
  getCampaignMetricTotalsAtDate,
  type CampaignMetricTotals,
} from "./campaign-current-values";
import { resolveGA4ImportToDateWindow } from "./reporting-timezone";

type SourceTotal = { totalRevenue?: number; totalSpend?: number; currency?: string; sourceIds: string[] };

type ComparisonDependencies = {
  getCampaign: (campaignId: string) => Promise<any>;
  getGA4Connections: (campaignId: string, options?: { migrateLegacyTokens?: boolean }) => Promise<any[]>;
  getCampaignMetricTotalsAtDate: (campaignId: string, reportingDate: string, financialStartDate?: string) => Promise<CampaignMetricTotals | null>;
  getRevenueTotalForRange: (campaignId: string, startDate: string, endDate: string, platformContext: "ga4") => Promise<SourceTotal>;
  getSpendTotalForRange: (campaignId: string, startDate: string, endDate: string, platformContext: "ga4") => Promise<SourceTotal>;
  now: () => Date;
};

const defaultDependencies: ComparisonDependencies = {
  getCampaign: (campaignId) => storage.getCampaign(campaignId),
  getGA4Connections: (campaignId, options) => storage.getGA4Connections(campaignId, options),
  getCampaignMetricTotalsAtDate,
  getRevenueTotalForRange: (campaignId, startDate, endDate, platformContext) =>
    storage.getRevenueTotalForRange(campaignId, startDate, endDate, platformContext),
  getSpendTotalForRange: (campaignId, startDate, endDate, platformContext) =>
    storage.getSpendTotalForRange(campaignId, startDate, endDate, platformContext),
  now: () => new Date(),
};

const isExactDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

const isYesopMockProperty = (propertyId: unknown) =>
  String(propertyId || "").trim().replace(/^properties\//i, "").toLowerCase() === "yesop";

const sourceIds = (sourceTotal: SourceTotal) =>
  Array.from(new Set((sourceTotal.sourceIds || []).map(String).map((id) => id.trim()).filter(Boolean)));

export async function deriveFinancialDailyComparisonSnapshot(
  input: { campaignId: string; reportingDate: string },
  dependencies: ComparisonDependencies = defaultDependencies,
): Promise<MetricSnapshot | null> {
  const campaignId = String(input.campaignId || "").trim();
  const reportingDate = String(input.reportingDate || "").trim();
  if (!campaignId || !isExactDate(reportingDate)) return null;

  const [campaign, connections] = await Promise.all([
    dependencies.getCampaign(campaignId),
    dependencies.getGA4Connections(campaignId, { migrateLegacyTokens: false }),
  ]);
  const activeConnections = (connections || []).filter((connection: any) =>
    connection?.isActive !== false && String(connection?.propertyId || "").trim()
  );
  const primary = activeConnections.find((connection: any) => connection?.isPrimary) || activeConnections[0];
  if (!campaign || !primary || isYesopMockProperty(primary.propertyId)) return null;

  const window = resolveGA4ImportToDateWindow(primary.importStartDate, campaign.reportingTimeZone, dependencies.now());
  if (!window || reportingDate < "1900-01-01" || reportingDate > window.endDate) return null;
  const campaignStart = campaign.startDate ? new Date(campaign.startDate) : null;
  const financialStartDate = campaignStart && !Number.isNaN(campaignStart.getTime())
    ? campaignStart.toISOString().slice(0, 10)
    : window.startDate;
  const financialWindowStartDate = reportingDate < financialStartDate ? "1900-01-01" : financialStartDate;

  const [totals, revenueSourceTotal, spendSourceTotal] = await Promise.all([
    dependencies.getCampaignMetricTotalsAtDate(campaignId, reportingDate, financialStartDate),
    dependencies.getRevenueTotalForRange(campaignId, "1900-01-01", reportingDate, "ga4"),
    dependencies.getSpendTotalForRange(campaignId, "1900-01-01", reportingDate, "ga4"),
  ]);
  if (!totals || totals.ga4FinancialSource === "rolling_breakdown") return null;

  const currency = String(campaign.currency || "USD").trim().toUpperCase();
  const revenueSourceIds = sourceIds(revenueSourceTotal);
  const spendSourceIds = sourceIds(spendSourceTotal);
  const revenueSourceCurrency = String(revenueSourceTotal.currency || "").trim().toUpperCase();
  const spendSourceCurrency = String(spendSourceTotal.currency || "").trim().toUpperCase();
  if ((revenueSourceIds.length > 0 && revenueSourceCurrency !== currency)
    || (spendSourceIds.length > 0 && spendSourceCurrency !== currency)) return null;
  if (Math.abs(Number(spendSourceTotal.totalSpend || 0) - totals.spend) >= 0.005) return null;

  const spendAvailable = totals.spendAvailable !== false && spendSourceIds.length > 0;
  const revenueAvailable = totals.revenueAvailable !== false && totals.ga4RevenueAvailable !== false;
  const conversionsAvailable = totals.financialConversionsAvailable !== false;
  if (!revenueAvailable || !conversionsAvailable) return null;

  let snapshot;
  try {
    snapshot = resolveCampaignCumulativeFinancials({
      campaignId,
      currency,
      performanceSummary: {
        campaignId,
        version: "performance_summary_aggregate_v3",
        currentValueWindow: {
          mode: "initial_import_to_latest_completed_day",
          startDate: financialWindowStartDate,
          endDate: reportingDate,
          dataThroughDate: reportingDate,
          reportingTimeZone: window.reportingTimeZone,
        },
        totals: {
          spend: spendAvailable
            ? { value: totals.spend, available: true, sources: ["canonical_spend_sources"] }
            : { value: null, available: false, sources: [] },
          revenue: {
            value: totals.revenue,
            available: true,
            sources: ["ga4", ...revenueSourceIds.map((id) => `revenue-source:${id}`)],
          },
          conversions: { value: totals.financialConversions, available: true, sources: ["ga4"] },
        },
      },
      nativeRevenue: totals.ga4Revenue,
      importedRevenue: Number(revenueSourceTotal.totalRevenue || 0),
    }).snapshot;
  } catch {
    return null;
  }

  return {
    id: `derived-financial-daily:${campaignId}:${reportingDate}`,
    campaignId,
    totalImpressions: 0,
    totalEngagements: 0,
    totalClicks: 0,
    totalConversions: Math.round(totals.financialConversions),
    totalLeads: 0,
    totalSpend: totals.spend.toFixed(2),
    metrics: { financialDaily: snapshot },
    snapshotType: "financial_daily",
    reportingDate,
    recordedAt: dependencies.now(),
    notes: "Read-only exact-date financial comparison",
  };
}

export async function resolveFinancialDailyComparisonPrevious(
  input: { campaignId: string; reportingDate: string; storedPrevious?: MetricSnapshot | null },
  dependencies: ComparisonDependencies = defaultDependencies,
): Promise<MetricSnapshot | null> {
  if (input.storedPrevious) return input.storedPrevious;
  try {
    return await deriveFinancialDailyComparisonSnapshot(input, dependencies);
  } catch {
    return null;
  }
}
