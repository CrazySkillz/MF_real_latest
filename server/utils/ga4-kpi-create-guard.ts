import {
  resolveGA4KpiMetricIdentity,
  type GA4KpiMetricIdentity,
} from "../../shared/ga4-kpi-metric-identity";

export const GA4_KPI_ACTIVE_METRIC_CONFLICT = "GA4_KPI_ACTIVE_METRIC_CONFLICT";
export const GA4_KPI_INVALID_CONFIGURATION = "GA4_KPI_INVALID_CONFIGURATION";

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
  const candidateId = String(candidate?.id || "").trim();
  const campaignId = String(candidate?.campaignId || "").trim();
  const platformType = String(candidate?.platformType || "").trim().toLowerCase();
  const identity = resolveGA4KpiMetricIdentity(candidate?.metric, candidate?.name);
  if (platformType !== "google_analytics" || !campaignId || !identity || !isActiveGA4KPI(candidate)) return undefined;

  return rows.find((row) =>
    (!candidateId || String(row?.id || "").trim() !== candidateId)
    && String(row?.platformType || "").trim().toLowerCase() === "google_analytics"
    && String(row?.campaignId || "").trim() === campaignId
    && isActiveGA4KPI(row)
    && resolveGA4KpiMetricIdentity(row?.metric, row?.name) === identity
  );
};

export const stripSourceComputedGA4KPIEditValue = <T extends Record<string, any>>(
  existing: GA4KpiCreateCandidate,
  update: T,
): T => {
  const definedUpdate = Object.fromEntries(Object.entries(update).filter(([, value]) => typeof value !== "undefined"));
  const next = { ...existing, ...definedUpdate };
  if (String(next.platformType || "").trim().toLowerCase() !== "google_analytics"
    || !resolveGA4KpiMetricIdentity(next.metric, next.name)) return update;
  const { currentValue: _ignored, ...safeUpdate } = update;
  return safeUpdate as T;
};

export class InvalidGA4KPIConfigurationError extends Error {
  readonly code = GA4_KPI_INVALID_CONFIGURATION;

  constructor(message: string) {
    super(message);
    this.name = "InvalidGA4KPIConfigurationError";
  }
}

export const assertValidGA4KPIUpdate = (
  existing: GA4KpiCreateCandidate & Record<string, any>,
  update: Record<string, any>,
  campaignCurrency: unknown,
): void => {
  const definedUpdate = Object.fromEntries(Object.entries(update).filter(([, value]) => typeof value !== "undefined"));
  const next = { ...existing, ...definedUpdate };
  if (String(next.platformType || "").trim().toLowerCase() !== "google_analytics") return;
  const identity = resolveGA4KpiMetricIdentity(next.metric, next.name);
  const target = Number(next.targetValue);
  if (!Number.isFinite(target) || target <= 0) throw new InvalidGA4KPIConfigurationError("Target value must be greater than 0.");
  if ((identity === "conversion_rate" || identity === "engagement_rate") && target > 100) {
    throw new InvalidGA4KPIConfigurationError("Target value cannot exceed 100% for percentage rate KPIs.");
  }
  if (["conversions", "sessions", "users", "pageviews"].includes(String(identity)) && !Number.isInteger(target)) {
    throw new InvalidGA4KPIConfigurationError("Count KPI targets must be whole numbers.");
  }

  const unit = String(next.unit || "").trim();
  const currency = String(campaignCurrency || "").trim().toUpperCase();
  const existingUnit = String(existing.unit || "").trim();
  if ((identity === "revenue" || identity === "cpa") && !/^[A-Z]{3}$/.test(currency)) {
    throw new InvalidGA4KPIConfigurationError("Campaign currency is unavailable for this KPI.");
  }
  const expectedUnit = identity === "revenue" || identity === "cpa" ? currency
    : identity === "roas" ? "ratio"
      : identity === "roi" || identity === "conversion_rate" || identity === "engagement_rate" ? "%"
        : identity ? "count" : null;
  const supportedCustomUnit = unit === "%" || unit === "count" || unit === "ratio" || (!!currency && unit === currency);
  const unchangedLegacyUnit = unit === existingUnit && unit !== "" && unit !== "__select_unit__";
  if ((expectedUnit && unit !== expectedUnit && !unchangedLegacyUnit)
    || (!expectedUnit && !supportedCustomUnit && !unchangedLegacyUnit)) {
    throw new InvalidGA4KPIConfigurationError("Unit does not match the KPI metric or campaign currency.");
  }

  const condition = String(next.alertCondition || "below").trim();
  if (!["below", "above", "equals"].includes(condition)) {
    throw new InvalidGA4KPIConfigurationError("Alert condition must be below, above, or equals.");
  }
  if (next.alertsEnabled) {
    const threshold = Number(next.alertThreshold);
    if (next.alertThreshold === null || next.alertThreshold === "" || !Number.isFinite(threshold)
      || (!!identity && identity !== "roi" && threshold < 0)
      || (identity === "roi" && threshold < -100)) {
      throw new InvalidGA4KPIConfigurationError("An enabled alert requires a valid threshold value.");
    }
    if ((identity === "conversion_rate" || identity === "engagement_rate") && threshold > 100) {
      throw new InvalidGA4KPIConfigurationError("Alert threshold cannot exceed 100% for percentage rate KPIs.");
    }
    if (["conversions", "sessions", "users", "pageviews"].includes(String(identity)) && !Number.isInteger(threshold)) {
      throw new InvalidGA4KPIConfigurationError("Count KPI alert thresholds must be whole numbers.");
    }
  }
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

type GA4KpiUpdatePersistence<TUpdate, TResult> = {
  withTransaction: <T>(run: (tx: unknown) => Promise<T>) => Promise<T>;
  getById: (tx: unknown, id: string) => Promise<GA4KpiCreateCandidate | undefined>;
  lockCampaign: (tx: unknown, campaignId: string) => Promise<boolean>;
  listCampaignGA4KPIs: (tx: unknown, campaignId: string) => Promise<GA4KpiCreateCandidate[]>;
  update: (tx: unknown, id: string, update: TUpdate) => Promise<TResult | undefined>;
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

export async function updateCanonicalGA4KPI<TUpdate extends Record<string, unknown>, TResult>(
  id: string,
  update: TUpdate,
  persistence: GA4KpiUpdatePersistence<TUpdate, TResult>,
): Promise<TResult | undefined> {
  return persistence.withTransaction(async (tx) => {
    const existing = await persistence.getById(tx, id);
    if (!existing) return undefined;
    const definedUpdate = Object.fromEntries(Object.entries(update).filter(([, value]) => typeof value !== "undefined"));
    const candidate = { ...existing, ...definedUpdate, id };
    const priorIdentity = String(existing.platformType || "").trim().toLowerCase() === "google_analytics" && isActiveGA4KPI(existing)
      ? resolveGA4KpiMetricIdentity(existing.metric, existing.name)
      : null;
    const nextIdentity = isActiveGA4KPI(candidate) ? resolveGA4KpiMetricIdentity(candidate.metric, candidate.name) : null;
    const priorCampaignId = String(existing.campaignId || "").trim();
    const priorKey = priorIdentity && priorCampaignId ? `${priorCampaignId}:${priorIdentity}` : null;
    const nextCampaignId = String(candidate.campaignId || "").trim();
    const nextKey = nextIdentity && nextCampaignId ? `${nextCampaignId}:${nextIdentity}` : null;
    if (String(candidate.platformType || "").trim().toLowerCase() === "google_analytics" && nextIdentity && nextKey && nextKey !== priorKey) {
      if (!await persistence.lockCampaign(tx, nextCampaignId)) throw new Error("Campaign not found");
      if (findActiveCanonicalGA4KPIConflict(candidate, await persistence.listCampaignGA4KPIs(tx, nextCampaignId))) {
        throw new ActiveGA4KPIConflictError(nextIdentity);
      }
    }
    return persistence.update(tx, id, update);
  });
}
