import { storage, type IStorage } from "./storage";
import {
  runGoogleSheetsRevenueSourceRefreshForValidation,
  runGoogleSheetsSpendSourceRefreshForValidation,
} from "./auto-refresh-scheduler";

type RefreshStore = Pick<IStorage, "getRevenueSources" | "getSpendSources">;
type RefreshAdapter = (campaignId: string, sourceId: string) => Promise<{ success: boolean; reason?: string }>;

export type MimosaasTrackingFinancialRefreshResult = {
  attempted: number;
  succeeded: number;
  failures: string[];
};

export async function refreshMimosaasTrackingGoogleSheetsFinancialSources(
  campaignId: string,
  reportingDate: string,
  store: RefreshStore = storage,
  adapters: { revenue: RefreshAdapter; spend: RefreshAdapter } = {
    revenue: runGoogleSheetsRevenueSourceRefreshForValidation,
    spend: runGoogleSheetsSpendSourceRefreshForValidation,
  },
): Promise<MimosaasTrackingFinancialRefreshResult> {
  const [revenueSources, spendSources] = await Promise.all([
    store.getRevenueSources(campaignId, "mimosaas_tracking"),
    store.getSpendSources(campaignId, "mimosaas_tracking"),
  ]);
  const jobs = [
    ...revenueSources.filter((source) => String(source.sourceType || "").trim().toLowerCase() === "google_sheets")
      .map((source) => ({ kind: "revenue", sourceId: String(source.id), run: adapters.revenue })),
    ...spendSources.filter((source) => String(source.sourceType || "").trim().toLowerCase() === "google_sheets")
      .map((source) => ({ kind: "spend", sourceId: String(source.id), run: adapters.spend })),
  ];
  const failures: string[] = [];
  let succeeded = 0;
  for (const job of jobs) {
    try {
      const result = await job.run(campaignId, job.sourceId);
      if (result.success) succeeded += 1;
      else failures.push(`${job.kind}:${job.sourceId}:${String(result.reason || "refresh_failed")}`);
    } catch (error: any) {
      failures.push(`${job.kind}:${job.sourceId}:${String(error?.code || "refresh_failed")}`);
    }
  }
  if (failures.length > 0) {
    console.warn(`[Mimosaas Tracking Daily] Google Sheets financial refresh incomplete for campaign ${campaignId} date ${reportingDate}:`, failures);
  }
  return { attempted: jobs.length, succeeded, failures };
}
