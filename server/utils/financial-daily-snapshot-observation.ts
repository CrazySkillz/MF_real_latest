import type { FinancialDailySnapshotInput } from "../../shared/schema";
import {
  assessFinancialDailySnapshotReadiness,
  type FinancialDailyRefreshEvidence,
  type FinancialDailySnapshotReadiness,
} from "./financial-daily-snapshot-readiness";

type RefreshStage = "financial_sources" | "ga4_daily";
type Observation = FinancialDailySnapshotReadiness & { evaluatedAt: string };

const evidenceByStage: Record<RefreshStage, Map<string, FinancialDailyRefreshEvidence>> = {
  financial_sources: new Map(),
  ga4_daily: new Map(),
};
const observations = new Map<string, Observation>();

export function beginFinancialDailySnapshotRefreshObservation(stage: RefreshStage): void {
  evidenceByStage[stage].clear();
  observations.clear();
}

export function recordFinancialDailySnapshotRefreshEvidence(
  stage: RefreshStage,
  evidence: FinancialDailyRefreshEvidence,
): void {
  evidenceByStage[stage].set(String(evidence.campaignId || "").trim(), evidence);
}

const missingEvidence = (
  campaignId: string,
  reportingDate: string,
  stage: RefreshStage,
): FinancialDailyRefreshEvidence => ({
  campaignId,
  reportingDate,
  status: "skipped",
  completedAt: null,
  failures: [`missing_${stage}_refresh_evidence`],
});

export function observeFinancialDailySnapshotReadiness(input: {
  campaignId: string;
  reportingDate: string;
  currency: string;
  requiredInputs: Array<keyof FinancialDailySnapshotInput["inputs"]>;
  snapshot: unknown;
}): FinancialDailySnapshotReadiness {
  const campaignId = String(input.campaignId || "").trim();
  const reportingDate = String(input.reportingDate || "").trim();
  const result = assessFinancialDailySnapshotReadiness({
    ...input,
    campaignId,
    reportingDate,
    financialSourcesRefresh: evidenceByStage.financial_sources.get(campaignId)
      || missingEvidence(campaignId, reportingDate, "financial_sources"),
    ga4DailyRefresh: evidenceByStage.ga4_daily.get(campaignId)
      || missingEvidence(campaignId, reportingDate, "ga4_daily"),
  });
  observations.set(campaignId, { ...result, evaluatedAt: new Date().toISOString() });
  return result;
}

export function getFinancialDailySnapshotObservationStatus() {
  const latestEvaluatedAt = Array.from(observations.values()).reduce(
    (latest, observation) => observation.evaluatedAt > latest ? observation.evaluatedAt : latest,
    "",
  );
  const values = Array.from(observations.values());
  const blockingReasons = values.flatMap((observation) => observation.reasons).reduce<Record<string, number>>(
    (counts, reason) => {
      counts[reason] = (counts[reason] || 0) + 1;
      return counts;
    },
    {},
  );
  return {
    mode: "observation_only" as const,
    snapshotWritesEnabled: false,
    financialSourceEvidenceCampaigns: evidenceByStage.financial_sources.size,
    ga4DailyEvidenceCampaigns: evidenceByStage.ga4_daily.size,
    observedCampaigns: values.length,
    readyCampaigns: values.filter((observation) => observation.ready).length,
    blockedCampaigns: values.filter((observation) => !observation.ready).length,
    blockingReasons,
    latestEvaluatedAt: latestEvaluatedAt || null,
  };
}
