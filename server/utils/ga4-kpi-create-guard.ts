import {
  resolveGA4KpiMetricIdentity,
  type GA4KpiMetricIdentity,
} from "../../shared/ga4-kpi-metric-identity";

export const GA4_KPI_ACTIVE_METRIC_CONFLICT = "GA4_KPI_ACTIVE_METRIC_CONFLICT";

export type GA4KpiCreateCandidate = {
  id?: unknown;
  campaignId?: unknown;
  platformType?: unknown;
  metric?: unknown;
  name?: unknown;
  status?: unknown;
};

const GA4_KPI_METRIC_LABELS: Record<GA4KpiMetricIdentity, string> = {
  revenue: "Revenue",
  conversions: "Conversions",
  sessions: "Sessions",
  users: "Users",
  pageviews: "Pageviews",
  conversion_rate: "Conversion Rate",
  engagement_rate: "Engagement Rate",
  roas: "ROAS",
  roi: "ROI",
  cpa: "CPA",
};

export const isActiveGA4KPI = (row: GA4KpiCreateCandidate): boolean =>
  String(row?.status || "").trim().toLowerCase() !== "inactive";

export const findActiveCanonicalGA4KPIConflict = (
  candidate: GA4KpiCreateCandidate,
  rows: GA4KpiCreateCandidate[],
): GA4KpiCreateCandidate | undefined => {
  const campaignId = String(candidate?.campaignId || "").trim();
  const platformType = String(candidate?.platformType || "").trim().toLowerCase();
  const identity = resolveGA4KpiMetricIdentity(candidate?.metric, candidate?.name);
  if (platformType !== "google_analytics" || !campaignId || !identity || !isActiveGA4KPI(candidate)) return undefined;

  return rows.find((row) =>
    String(row?.platformType || "").trim().toLowerCase() === "google_analytics"
    && String(row?.campaignId || "").trim() === campaignId
    && isActiveGA4KPI(row)
    && resolveGA4KpiMetricIdentity(row?.metric, row?.name) === identity
  );
};

export class ActiveGA4KPIConflictError extends Error {
  readonly code = GA4_KPI_ACTIVE_METRIC_CONFLICT;

  constructor(readonly canonicalMetric: GA4KpiMetricIdentity) {
    super(`This campaign already has an active ${GA4_KPI_METRIC_LABELS[canonicalMetric]} KPI. Use the existing KPI or delete it before creating another.`);
    this.name = "ActiveGA4KPIConflictError";
  }
}

type GA4KpiCreatePersistence<TInput, TResult> = {
  withTransaction: <T>(run: (tx: unknown) => Promise<T>) => Promise<T>;
  lockCampaign: (tx: unknown, campaignId: string) => Promise<boolean>;
  listCampaignGA4KPIs: (tx: unknown, campaignId: string) => Promise<GA4KpiCreateCandidate[]>;
  insert: (tx: unknown, input: TInput) => Promise<TResult>;
};

export async function createActiveCanonicalGA4KPI<TInput extends GA4KpiCreateCandidate, TResult>(
  candidate: TInput,
  persistence: GA4KpiCreatePersistence<TInput, TResult>,
): Promise<TResult> {
  const campaignId = String(candidate?.campaignId || "").trim();
  const platformType = String(candidate?.platformType || "").trim().toLowerCase();
  const canonicalMetric = resolveGA4KpiMetricIdentity(candidate?.metric, candidate?.name);
  if (platformType !== "google_analytics" || !campaignId || !canonicalMetric || !isActiveGA4KPI(candidate)) {
    throw new Error("Active canonical GA4 KPI scope is required");
  }

  return persistence.withTransaction(async (tx) => {
    if (!await persistence.lockCampaign(tx, campaignId)) {
      throw new Error("Campaign not found");
    }
    const existingRows = await persistence.listCampaignGA4KPIs(tx, campaignId);
    if (findActiveCanonicalGA4KPIConflict(candidate, existingRows)) {
      throw new ActiveGA4KPIConflictError(canonicalMetric);
    }
    return persistence.insert(tx, candidate);
  });
}
