import type { Campaign } from "@shared/schema";
import { storage, type IStorage, type MimosaasTrackingDailyPublicationState } from "./storage";
import { aggregateMimosaasTrackingCompletedDay } from "./mimosaas-tracking-daily-aggregation";
import { publishMimosaasTrackingCompletedDay } from "./mimosaas-tracking-daily-publication";
import {
  getExpectedDailyRefreshAt,
  getLatestCompleteReportingDate,
  getReportingDateEndAt,
  normalizeReportingTimeZone,
} from "./utils/reporting-timezone";

const RUN_HOURS = [8, 14, 20] as const;
const POLL_INTERVAL_MS = 60_000;

type SchedulerStore = Pick<IStorage, "getCampaigns" | "getMimosaasTrackingDailyPublicationState" | "claimMimosaasTrackingDailyPublicationRun" | "releaseMimosaasTrackingDailyPublicationRun" | "aggregateMimosaasTrackingDailyMetrics" | "publishMimosaasTrackingDailySnapshot">;
type DueSlot = { reportingDate: string; hour: (typeof RUN_HOURS)[number]; runAt: Date };

export type MimosaasTrackingDailySchedulerResult = {
  skipped: boolean;
  reason?: "disabled" | "overlap";
  campaignsScanned: number;
  campaignsDue: number;
  datesAttempted: number;
  datesFinalized: number;
  datesPending: number;
  datesFailed: number;
};

export function isMimosaasTrackingDailySchedulerEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return String(env.MIMOSAAS_TRACKING_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_INGESTION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED || "").trim().toLowerCase() === "true"
    && String(env.MIMOSAAS_TRACKING_DAILY_SCHEDULER_ENABLED || "").trim().toLowerCase() === "true";
}

export function getMimosaasTrackingDueSlot(campaign: Pick<Campaign, "reportingTimeZone">, now = new Date()): DueSlot | null {
  const reportingTimeZone = String(campaign.reportingTimeZone || "").trim();
  if (!reportingTimeZone || normalizeReportingTimeZone(reportingTimeZone) !== reportingTimeZone || Number.isNaN(now.getTime())) return null;
  const reportingDate = getLatestCompleteReportingDate(reportingTimeZone, now);
  const due = RUN_HOURS.map((hour) => ({
    reportingDate,
    hour,
    runAt: getExpectedDailyRefreshAt(reportingDate, reportingTimeZone, hour, 0),
  })).filter((slot): slot is DueSlot => slot.runAt instanceof Date && slot.runAt.getTime() <= now.getTime());
  return due.at(-1) || null;
}

const addDay = (date: string): string => {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
};

export function buildMimosaasTrackingPublicationQueue(
  throughDate: string,
  state: MimosaasTrackingDailyPublicationState,
): string[] {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(throughDate)
    || (state.latestFinalizedDate !== null && (!datePattern.test(state.latestFinalizedDate) || state.latestFinalizedDate > throughDate))
    || state.pendingDates.some((date) => !datePattern.test(date) || date > throughDate)) {
    throw new Error("Mimosaas Tracking publication state is invalid");
  }
  const validPending = [...state.pendingDates].sort();
  const dates = new Set(validPending);
  const firstMissing = state.latestFinalizedDate ? addDay(state.latestFinalizedDate) : (validPending[0] || throughDate);
  for (let date = firstMissing; date <= throughDate; date = addDay(date)) dates.add(date);
  return Array.from(dates).sort();
}

export async function runMimosaasTrackingDailySchedulerOnce(
  now = new Date(),
  store: SchedulerStore = storage,
  env: NodeJS.ProcessEnv = process.env,
): Promise<MimosaasTrackingDailySchedulerResult> {
  const empty = { campaignsScanned: 0, campaignsDue: 0, datesAttempted: 0, datesFinalized: 0, datesPending: 0, datesFailed: 0 };
  if (!isMimosaasTrackingDailySchedulerEnabled(env)) return { skipped: true, reason: "disabled", ...empty };
  if ((global as any).__mimosaasTrackingDailySchedulerInProgress) return { skipped: true, reason: "overlap", ...empty };

  (global as any).__mimosaasTrackingDailySchedulerInProgress = true;
  const result: MimosaasTrackingDailySchedulerResult = { skipped: false, ...empty };
  try {
    const campaigns = await store.getCampaigns();
    const eligible = campaigns.filter((campaign) => campaign.status === "active"
      && campaign.platform === "mimosaas-tracking"
      && Boolean(String(campaign.ownerId || "").trim())
      && Boolean(String(campaign.clientId || "").trim()));
    result.campaignsScanned = campaigns.length;

    for (const campaign of eligible) {
      const due = getMimosaasTrackingDueSlot(campaign, now);
      const createdBeforeReportingDayEnded = due
        ? Number(new Date(campaign.createdAt).getTime()) <= Number(getReportingDateEndAt(due.reportingDate, campaign.reportingTimeZone)?.getTime())
        : false;
      if (!due || !createdBeforeReportingDayEnded) continue;
      const slotKey = `${campaign.id}:${due.runAt.toISOString()}`;
      const processedSlots: Set<string> = (global as any).__mimosaasTrackingDailyProcessedSlots ||= new Set<string>();
      if (processedSlots.has(slotKey)) continue;
      processedSlots.add(slotKey);
      result.campaignsDue += 1;

      let state: MimosaasTrackingDailyPublicationState;
      try {
        state = await store.getMimosaasTrackingDailyPublicationState(
          String(campaign.ownerId), String(campaign.clientId), String(campaign.id), due.reportingDate,
        );
      } catch (error: any) {
        result.datesFailed += 1;
        console.error(`[Mimosaas Tracking Daily] Publication-state read failed for campaign ${campaign.id}:`, error?.message || error);
        continue;
      }

      let queue: string[];
      try {
        queue = buildMimosaasTrackingPublicationQueue(due.reportingDate, state);
      } catch (error: any) {
        result.datesFailed += 1;
        console.error(`[Mimosaas Tracking Daily] Publication-state validation failed for campaign ${campaign.id}:`, error?.message || error);
        continue;
      }
      for (const reportingDate of queue) {
        result.datesAttempted += 1;
        let claimed = false;
        try {
          const claim = await store.claimMimosaasTrackingDailyPublicationRun(
            String(campaign.ownerId), String(campaign.clientId), String(campaign.id), reportingDate, now,
          );
          if (claim === "busy") {
            result.datesPending += 1;
            break;
          }
          if (claim === "finalized") {
            result.datesFinalized += 1;
            continue;
          }
          claimed = true;
          await aggregateMimosaasTrackingCompletedDay(
            String(campaign.ownerId), String(campaign.clientId), String(campaign.id), reportingDate, store, env, now,
          );
          const publication = await publishMimosaasTrackingCompletedDay(
            String(campaign.ownerId), String(campaign.clientId), String(campaign.id), reportingDate, store, env, now,
          );
          if (publication.skipped) throw new Error("Mimosaas Tracking daily publication is disabled");
          if (publication.result.status === "pending") {
            result.datesPending += 1;
            break;
          }
          result.datesFinalized += 1;
        } catch (error: any) {
          if (error?.code === "MIMOSAAS_TRACKING_REPORTING_DATE_FINALIZED") {
            result.datesFinalized += 1;
            continue;
          }
          if (claimed) {
            await store.releaseMimosaasTrackingDailyPublicationRun(
              String(campaign.ownerId), String(campaign.clientId), String(campaign.id), reportingDate,
              String(error?.code || "scheduler_attempt_failed"),
            ).catch((releaseError: any) => {
              console.error(`[Mimosaas Tracking Daily] Failed to release campaign ${campaign.id} date ${reportingDate}:`, releaseError?.message || releaseError);
            });
          }
          result.datesFailed += 1;
          console.error(`[Mimosaas Tracking Daily] Campaign ${campaign.id} date ${reportingDate} failed:`, error?.message || error);
          break;
        }
      }
    }
    return result;
  } finally {
    (global as any).__mimosaasTrackingDailySchedulerInProgress = false;
  }
}

export function startMimosaasTrackingDailyScheduler(env: NodeJS.ProcessEnv = process.env): void {
  if (!isMimosaasTrackingDailySchedulerEnabled(env)) {
    console.log("[Mimosaas Tracking Daily] Disabled by tracker feature flags");
    return;
  }
  if ((global as any).__mimosaasTrackingDailySchedulerInterval) return;
  const run = () => runMimosaasTrackingDailySchedulerOnce(new Date(), storage, env).catch((error: any) => {
    console.error("[Mimosaas Tracking Daily] Scheduler failed:", error?.message || error);
  });
  void run();
  (global as any).__mimosaasTrackingDailySchedulerInterval = setInterval(run, POLL_INTERVAL_MS);
}

export function stopMimosaasTrackingDailyScheduler(): void {
  if ((global as any).__mimosaasTrackingDailySchedulerInterval) {
    clearInterval((global as any).__mimosaasTrackingDailySchedulerInterval);
    (global as any).__mimosaasTrackingDailySchedulerInterval = null;
  }
  (global as any).__mimosaasTrackingDailySchedulerInProgress = false;
  (global as any).__mimosaasTrackingDailyProcessedSlots = new Set<string>();
}
