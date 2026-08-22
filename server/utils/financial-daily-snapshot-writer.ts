import type { FinancialDailySnapshotInput } from "../../shared/schema";
import { storage } from "../storage";
import { getCampaignMetricTotals, type CampaignMetricTotals } from "./campaign-current-values";
import { resolveCampaignCumulativeFinancials } from "./campaign-cumulative-financials";
import {
  observeFinancialDailySnapshotReadiness,
  recordFinancialDailySnapshotWriteOutcome,
} from "./financial-daily-snapshot-observation";
import { resolveGA4ImportToDateWindow } from "./reporting-timezone";

type SourceTotal = { totalRevenue?: number; totalSpend?: number; currency?: string; sourceIds: string[] };

type WriterDependencies = {
  getCampaign: (campaignId: string) => Promise<any>;
  getGA4Connections: (campaignId: string) => Promise<any[]>;
  getCampaignMetricTotals: (campaignId: string, useFullFinancialCandidate: boolean) => Promise<CampaignMetricTotals | null>;
  getRevenueTotalForRange: (campaignId: string, startDate: string, endDate: string, platformContext: "ga4") => Promise<SourceTotal>;
  getSpendTotalForRange: (campaignId: string, startDate: string, endDate: string, platformContext: "ga4") => Promise<SourceTotal>;
  upsertFinancialDailySnapshot: (snapshot: FinancialDailySnapshotInput) => Promise<unknown>;
  now: () => Date;
};

const defaultDependencies: WriterDependencies = {
  getCampaign: (campaignId) => storage.getCampaign(campaignId),
  getGA4Connections: (campaignId) => storage.getGA4Connections(campaignId),
  getCampaignMetricTotals,
  getRevenueTotalForRange: (campaignId, startDate, endDate, platformContext) =>
    storage.getRevenueTotalForRange(campaignId, startDate, endDate, platformContext),
  getSpendTotalForRange: (campaignId, startDate, endDate, platformContext) =>
    storage.getSpendTotalForRange(campaignId, startDate, endDate, platformContext),
  upsertFinancialDailySnapshot: (snapshot) => storage.upsertFinancialDailySnapshot(snapshot),
  now: () => new Date(),
};

const unavailableMoney = (value: number) => ({ value, available: false, sources: [] as string[] });

export async function writeFinancialDailySnapshotIfReady(
  input: { campaignId: string; reportingDate: string },
  dependencies: WriterDependencies = defaultDependencies,
): Promise<{ status: "written" | "blocked" | "skipped"; reasons: string[]; snapshot?: FinancialDailySnapshotInput }> {
  const campaignId = String(input.campaignId || "").trim();
  const reportingDate = String(input.reportingDate || "").trim();
  const [campaign, connections] = await Promise.all([
    dependencies.getCampaign(campaignId),
    dependencies.getGA4Connections(campaignId),
  ]);
  const activeConnections = (connections || []).filter((connection: any) =>
    connection?.isActive !== false && String(connection?.propertyId || "").trim()
  );
  const primary = activeConnections.find((connection: any) => connection?.isPrimary) || activeConnections[0];
  if (!campaign || !primary || String(primary.propertyId).trim().toLowerCase() === "yesop") {
    return { status: "skipped", reasons: ["cumulative_ga4_window_unavailable"] };
  }

  const window = resolveGA4ImportToDateWindow(primary.importStartDate, campaign.reportingTimeZone, dependencies.now());
  if (!window || window.endDate !== reportingDate) {
    return { status: "skipped", reasons: ["reporting_date_window_mismatch"] };
  }

  const [totals, revenueSourceTotal, spendSourceTotal] = await Promise.all([
    dependencies.getCampaignMetricTotals(campaignId, true),
    dependencies.getRevenueTotalForRange(campaignId, "1900-01-01", reportingDate, "ga4"),
    dependencies.getSpendTotalForRange(campaignId, "1900-01-01", reportingDate, "ga4"),
  ]);
  if (!totals) return { status: "blocked", reasons: ["cumulative_financial_totals_unavailable"] };
  if (totals.ga4FinancialSource === "rolling_breakdown") {
    return { status: "blocked", reasons: ["non_cumulative_ga4_financial_source"] };
  }

  const currency = String(campaign.currency || "USD").trim().toUpperCase();
  const spendSourceIds = Array.from(new Set((spendSourceTotal.sourceIds || []).map(String).filter(Boolean)));
  const revenueSourceIds = Array.from(new Set((revenueSourceTotal.sourceIds || []).map(String).filter(Boolean)));
  if (spendSourceIds.length > 0 && String(spendSourceTotal.currency || "").trim().toUpperCase() !== currency) {
    return { status: "blocked", reasons: ["spend_currency_mismatch"] };
  }
  if (Math.abs(Number(spendSourceTotal.totalSpend || 0) - totals.spend) >= 0.005) {
    return { status: "blocked", reasons: ["spend_total_mismatch"] };
  }

  const spendAvailable = totals.spendAvailable !== false && spendSourceIds.length > 0;
  const revenueAvailable = totals.revenueAvailable !== false && totals.ga4RevenueAvailable !== false;
  const conversionsAvailable = totals.financialConversionsAvailable !== false;
  const performanceSummary = {
    campaignId,
    version: "performance_summary_aggregate_v3",
    currentValueWindow: {
      mode: "initial_import_to_latest_completed_day" as const,
      startDate: window.startDate,
      endDate: reportingDate,
      dataThroughDate: reportingDate,
      reportingTimeZone: window.reportingTimeZone,
    },
    totals: {
      spend: spendAvailable
        ? { value: totals.spend, available: true, sources: ["canonical_spend_sources"] }
        : unavailableMoney(totals.spend),
      revenue: revenueAvailable
        ? { value: totals.revenue, available: true, sources: ["ga4", ...revenueSourceIds.map((id) => `revenue-source:${id}`)] }
        : unavailableMoney(totals.revenue),
      conversions: conversionsAvailable
        ? { value: totals.financialConversions, available: true, sources: ["ga4"] }
        : { value: totals.financialConversions, available: false, sources: [] },
    },
  };
  const cumulative = resolveCampaignCumulativeFinancials({
    campaignId,
    currency,
    performanceSummary,
    nativeRevenue: totals.ga4Revenue,
    importedRevenue: Number(revenueSourceTotal.totalRevenue || 0),
  });
  const readiness = observeFinancialDailySnapshotReadiness({
    campaignId,
    reportingDate,
    currency,
    requiredInputs: ["spend", "revenue", "conversions"],
    snapshot: cumulative.snapshot,
  });
  if (!readiness.ready) return { status: "blocked", reasons: readiness.reasons, snapshot: cumulative.snapshot };

  try {
    await dependencies.upsertFinancialDailySnapshot(cumulative.snapshot);
    recordFinancialDailySnapshotWriteOutcome(campaignId, reportingDate, "written");
    return { status: "written", reasons: [], snapshot: cumulative.snapshot };
  } catch (error) {
    recordFinancialDailySnapshotWriteOutcome(campaignId, reportingDate, "failed");
    throw error;
  }
}
