import { storage, type IStorage } from "./storage";

export function isMimosaasTrackingDailyAggregationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.MIMOSAAS_TRACKING_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_INGESTION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED || "").trim().toLowerCase() === "true";
}

export async function aggregateMimosaasTrackingCompletedDay(
  ownerId: string,
  clientId: string,
  campaignId: string,
  reportingDate: string,
  store: Pick<IStorage, "aggregateMimosaasTrackingDailyMetrics"> = storage,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  if (!isMimosaasTrackingDailyAggregationEnabled(env)) return { skipped: true as const, reason: "disabled" as const };
  const metrics = await store.aggregateMimosaasTrackingDailyMetrics(ownerId, clientId, campaignId, reportingDate, now);
  return { skipped: false as const, metrics };
}
