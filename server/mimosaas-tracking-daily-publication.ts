import { storage, type IStorage } from "./storage";

export function isMimosaasTrackingDailyPublicationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.MIMOSAAS_TRACKING_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_INGESTION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED || "").trim().toLowerCase() === "true";
}

export async function publishMimosaasTrackingCompletedDay(
  ownerId: string,
  clientId: string,
  campaignId: string,
  reportingDate: string,
  store: Pick<IStorage, "publishMimosaasTrackingDailySnapshot"> = storage,
  env: NodeJS.ProcessEnv = process.env,
  now = new Date(),
) {
  if (!isMimosaasTrackingDailyPublicationEnabled(env)) return { skipped: true as const, reason: "disabled" as const };
  const result = await store.publishMimosaasTrackingDailySnapshot(ownerId, clientId, campaignId, reportingDate, now);
  return { skipped: false as const, result };
}
