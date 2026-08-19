import { computeCpa, computeRoiPercent } from "@shared/metric-math";
import {
  classifyKpiBandWithPolicy,
  computeBenchmarkThresholdResult,
  computeEffectiveDeltaPct,
  isLowerIsBetterKpi,
  resolveBenchmarkDataSufficiency,
  resolveKpiDataSufficiency,
  resolveKpiThresholdPolicy,
} from "@shared/kpi-math";
import { resolveGA4KpiLiveValue } from "@shared/ga4-kpi-live-value";
import { resolveGA4KpiMetricIdentity, type GA4KpiMetricIdentity } from "@shared/ga4-kpi-metric-identity";
import {
  resolveGA4InsightTargetPeriodCompatibility,
  resolveGA4KpiConsumerState,
  type GA4KpiInputState,
  type GA4KpiListState,
} from "@shared/ga4-kpi-consumer-state";

export type PerformanceRecommendedAction = {
  type: "success" | "warning" | "info";
  priority: number;
  category: string;
  title: string;
  message: string;
};

export type PerformanceRecommendedActionsInput = {
  kpis: any[];
  benchmarks: any[];
  kpiListState: GA4KpiListState;
  benchmarkListState: GA4KpiListState;
  trafficState: GA4KpiInputState;
  revenueState: GA4KpiInputState;
  spendState: GA4KpiInputState;
  financialConversionsState: GA4KpiInputState;
  trafficRows: any[];
  dataThroughDate: string;
  expectedRefreshAt: string;
  financialRevenue: number;
  financialSpend: number;
  financialConversions: number;
};

export const resolvePerformanceHealthCoverage = (input: {
  configuredKpiCount: number;
  configuredBenchmarkCount: number;
  scoredKpiCount: number;
  scoredBenchmarkCount: number;
  kpisOnTrack: number;
  benchmarksOnTrack: number;
}) => {
  const configuredMetricCount = input.configuredKpiCount + input.configuredBenchmarkCount;
  const verifiedMetricCount = input.scoredKpiCount + input.scoredBenchmarkCount;
  const excludedMetricCount = Math.max(0, configuredMetricCount - verifiedMetricCount);
  const totalOnTrackMetrics = input.kpisOnTrack + input.benchmarksOnTrack;
  return {
    configuredMetricCount,
    verifiedMetricCount,
    excludedMetricCount,
    totalOnTrackMetrics,
    healthScore: excludedMetricCount === 0 && verifiedMetricCount > 0
      ? Math.round((totalOnTrackMetrics / verifiedMetricCount) * 100)
      : null,
  };
};

const metricLabels: Record<GA4KpiMetricIdentity, string> = {
  revenue: "Revenue",
  conversions: "Conversions",
  sessions: "Sessions",
  users: "Users",
  pageviews: "Pageviews",
  conversion_rate: "Key Events per Session",
  engagement_rate: "Engagement Rate",
  roas: "ROAS",
  roi: "ROI",
  cpa: "Cost Per Acquisition",
};

const parseNumber = (value: unknown): number | null => {
  const normalized = String(value ?? "").replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolvePerformanceFreshPersistedMetricValue = (item: any, expectedRefreshAt: string): number | null => {
  const current = parseNumber(item?.currentValue);
  const refreshedAt = Date.parse(String(item?.updatedAt || item?.lastUpdated || ""));
  const expectedAt = Date.parse(String(expectedRefreshAt || ""));
  return current !== null && Number.isFinite(refreshedAt) && Number.isFinite(expectedAt) && refreshedAt >= expectedAt
    ? current
    : null;
};

const formatMetricValue = (identity: GA4KpiMetricIdentity, value: number): string => {
  if (identity === "revenue" || identity === "cpa") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (identity === "conversion_rate" || identity === "engagement_rate" || identity === "roi") {
    return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }
  if (identity === "roas") return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}x`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

const addUtcDays = (date: string, days: number): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
};

export const summarizePerformanceTrafficWindow = (rows: any[], dataThroughDate: string) => {
  const startDate = addUtcDays(dataThroughDate, -29);
  if (!startDate) {
    return {
      valid: false as const,
      startDate: null,
      endDate: null,
      totals: { sessions: 0, users: 0, conversions: 0, pageviews: 0, engagedSessions: 0 },
    };
  }
  const dates = new Set<string>();
  const totals = { sessions: 0, users: 0, conversions: 0, pageviews: 0, engagedSessions: 0 };
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row?.date || "").slice(0, 10);
    if (date < startDate || date > dataThroughDate) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dates.has(date)) {
      return { valid: false as const, startDate, endDate: dataThroughDate, totals };
    }
    dates.add(date);
    totals.sessions += Number(row?.sessions || 0) || 0;
    totals.users += Number(row?.users || 0) || 0;
    totals.conversions += Number(row?.conversions || 0) || 0;
    totals.pageviews += Number(row?.pageviews || 0) || 0;
    totals.engagedSessions += Number(row?.engagedSessions || 0) || 0;
  }
  if (dates.size === 0) return { valid: false as const, startDate, endDate: dataThroughDate, totals };
  return { valid: true as const, startDate, endDate: dataThroughDate, totals };
};

export const resolvePerformanceLiveMetricValue = (input: {
  item: any;
  trafficTotals: { sessions: number; users: number; conversions: number; pageviews: number; engagedSessions: number };
  financialRevenue: number;
  financialSpend: number;
  financialConversions: number;
}): number | null => {
  const identity = resolveGA4KpiMetricIdentity(input.item?.metric, input.item?.metricName, input.item?.name);
  if (!identity) return null;
  const overviewEngagementRate = input.trafficTotals.sessions > 0
    ? input.trafficTotals.engagedSessions / input.trafficTotals.sessions
    : 0;
  return parseNumber(resolveGA4KpiLiveValue({
    kpi: { ...input.item, metric: identity },
    breakdownTotals: input.trafficTotals,
    overviewEngagementRate,
    financialRevenue: input.financialRevenue,
    financialSpend: input.financialSpend,
    financialROI: computeRoiPercent(input.financialRevenue, input.financialSpend),
    financialCPA: computeCpa(input.financialSpend, input.financialConversions),
  }));
};

const joinLabels = (labels: string[]): string => {
  if (labels.length <= 1) return labels[0] || "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
};

const priorityRank = (value: unknown): number => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "critical") return 1;
  if (normalized === "high") return 2;
  if (normalized === "medium") return 3;
  return 4;
};

const recommendationFor = (identity: GA4KpiMetricIdentity): string => {
  if (identity === "conversion_rate") return "Review the conversion path and measurement before increasing spend.";
  if (identity === "cpa") return "Review spend allocation and verified conversion volume before scaling.";
  if (identity === "roas" || identity === "roi") return "Review revenue and spend drivers before changing budget.";
  if (identity === "revenue") return "Review revenue tracking and campaign performance drivers.";
  if (identity === "conversions") return "Review traffic quality, funnel performance, and key-event tracking.";
  if (identity === "engagement_rate") return "Review content relevance and landing-page engagement.";
  return "Review acquisition volume and source mix.";
};

const combineInputStates = (...states: GA4KpiInputState[]): GA4KpiInputState => {
  if (states.includes("unavailable")) return "unavailable";
  if (states.includes("stale")) return "stale";
  if (states.includes("loading")) return "loading";
  return "ready";
};

export function buildPerformanceRecommendedActions(input: PerformanceRecommendedActionsInput): PerformanceRecommendedAction[] {
  const listStates = [input.kpiListState, input.benchmarkListState];
  if (listStates.includes("loading")) {
    return [{ type: "info", priority: 0, category: "verification", title: "Recommended Actions loading", message: "Targets are still loading. No action is recommended until the target inventory is verified." }];
  }
  if (listStates.some((state) => state === "failed" || state === "stale")) {
    return [{ type: "info", priority: 0, category: "verification", title: "Recommended Actions withheld", message: "The complete target inventory could not be freshly verified. No action is recommended from retained or incomplete target data." }];
  }

  const trafficWindow = summarizePerformanceTrafficWindow(input.trafficRows, input.dataThroughDate);
  const trafficState = input.trafficState === "ready" && !trafficWindow.valid ? "unavailable" : input.trafficState;
  // The certified recompute updates currentValue and updatedAt together. A row
  // updated after this reporting day's refresh boundary is already verified.
  const persistedValue = (row: any) => resolvePerformanceFreshPersistedMetricValue(row, input.expectedRefreshAt);
  const liveValue = (row: any) => persistedValue(row) ?? resolvePerformanceLiveMetricValue({
    item: row,
    trafficTotals: trafficWindow.totals,
    financialRevenue: input.financialRevenue,
    financialSpend: input.financialSpend,
    financialConversions: input.financialConversions,
  });

  const duplicateLabels: string[] = [];
  const periodLabels: string[] = [];
  const invalidLabels: string[] = [];
  const blockedLabels: string[] = [];
  const evaluated: PerformanceRecommendedAction[] = [];

  const evaluate = (rows: any[], entity: "KPI" | "Benchmark") => {
    const grouped = new Map<GA4KpiMetricIdentity, any[]>();
    for (const row of rows) {
      const identity = resolveGA4KpiMetricIdentity(row?.metric, row?.metricName, row?.name);
      if (!identity) {
        invalidLabels.push(`${entity} ${String(row?.name || row?.metricName || row?.metric || "custom value")}`);
        continue;
      }
      grouped.set(identity, [...(grouped.get(identity) || []), row]);
    }

    for (const [identity, matches] of Array.from(grouped.entries())) {
      const label = metricLabels[identity];
      if (matches.length !== 1) {
        duplicateLabels.push(`${entity} ${label}`);
        continue;
      }
      const row = matches[0];
      const target = parseNumber(entity === "KPI" ? row?.targetValue : row?.benchmarkValue ?? row?.industryAverage);
      if (target === null || target <= 0) {
        invalidLabels.push(`${entity} ${label}`);
        continue;
      }
      const compatibility = resolveGA4InsightTargetPeriodCompatibility({
        metric: row?.metric ?? row?.metricName,
        name: row?.name ?? row?.metricName,
        timeframe: row?.timeframe,
        trackingPeriod: row?.trackingPeriod,
        period: row?.period,
      });
      if (!compatibility.comparable) {
        periodLabels.push(`${entity} ${label}`);
        continue;
      }
      const sufficiency = entity === "KPI"
        ? resolveKpiDataSufficiency({ metric: identity, name: row?.name, sessions: trafficWindow.totals.sessions, conversions: input.financialConversions, spend: input.financialSpend })
        : resolveBenchmarkDataSufficiency({ metric: identity, name: row?.name ?? row?.metricName, sessions: trafficWindow.totals.sessions, conversions: input.financialConversions, spend: input.financialSpend });
      const consumerState = resolveGA4KpiConsumerState({
        metric: identity,
        name: row?.name ?? row?.metricName,
        listState: entity === "KPI" ? input.kpiListState : input.benchmarkListState,
        trafficState: persistedValue(row) !== null
          ? "ready"
          : identity === "cpa" ? combineInputStates(trafficState, input.financialConversionsState) : trafficState,
        revenueState: input.revenueState,
        spendState: input.spendState,
        sufficiencyReason: sufficiency.sufficient ? null : sufficiency.reason || "Required denominator data is not available.",
        entityLabel: entity,
      });
      const current = liveValue(row);
      if (!consumerState.eligible || current === null) {
        blockedLabels.push(`${entity} ${label}`);
        continue;
      }
      const currentText = formatMetricValue(identity, current);
      const targetText = formatMetricValue(identity, target);
      if (entity === "KPI") {
        const lowerIsBetter = isLowerIsBetterKpi({ metric: identity, name: row?.name });
        const policy = resolveKpiThresholdPolicy({ metric: identity, name: row?.name, unit: row?.unit, current, target, lowerIsBetter });
        const band = classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy });
        const gap = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
        if (!band || gap === null) {
          blockedLabels.push(`${entity} ${label}`);
          continue;
        }
        const needsAction = band === "below";
        evaluated.push({
          type: needsAction ? "warning" : "success",
          priority: needsAction ? priorityRank(row?.priority) : 8,
          category: `kpi-${identity}`,
          title: needsAction ? `Review ${label}` : `${label} on target`,
          message: `Verified ${currentText} versus the ${targetText} KPI target over ${compatibility.currentWindow.toLowerCase()}. ${needsAction ? recommendationFor(identity) : "No corrective action is indicated by this target; continue monitoring."}`,
        });
      } else {
        const result = computeBenchmarkThresholdResult({ metric: identity, name: row?.name ?? row?.metricName, unit: row?.unit, current, benchmarkValue: target });
        if (!result.status) {
          blockedLabels.push(`${entity} ${label}`);
          continue;
        }
        const needsAction = result.status !== "on_track";
        evaluated.push({
          type: needsAction ? "warning" : "success",
          priority: needsAction ? 5 : 9,
          category: `benchmark-${identity}`,
          title: needsAction ? `Review ${label}` : `${label} benchmark met`,
          message: `Verified ${currentText} versus the ${targetText} Benchmark over ${compatibility.currentWindow.toLowerCase()}. ${needsAction ? recommendationFor(identity) : "No corrective action is indicated by this Benchmark; continue monitoring."}`,
        });
      }
    }
  };

  evaluate(Array.isArray(input.kpis) ? input.kpis : [], "KPI");
  evaluate(Array.isArray(input.benchmarks) ? input.benchmarks : [], "Benchmark");

  const setup: PerformanceRecommendedAction[] = [];
  if (duplicateLabels.length > 0) {
    setup.push({ type: "info", priority: 0, category: "duplicate-targets", title: "Resolve duplicate targets", message: `Choose one active target for ${joinLabels(duplicateLabels)}. No comparison is made while more than one target applies.` });
  }
  if (periodLabels.length > 0) {
    setup.push({ type: "info", priority: 0, category: "target-periods", title: "Align target periods", message: `The saved periods for ${joinLabels(periodLabels)} do not match their verified current windows. Financial metrics require campaign-to-date; traffic metrics require 30 completed reporting days.` });
  }
  if (invalidLabels.length > 0) {
    setup.push({ type: "info", priority: 0, category: "invalid-targets", title: "Complete target setup", message: `${joinLabels(invalidLabels)} cannot be evaluated because a standard metric or positive target value is not verified.` });
  }
  if (blockedLabels.length > 0) {
    setup.push({ type: "info", priority: 0, category: "blocked-targets", title: "Recommendation inputs unavailable", message: `${joinLabels(blockedLabels)} cannot be evaluated from fresh, sufficient source data. No action is recommended for those metrics.` });
  }

  const recommendations = [...setup, ...evaluated].sort((a, b) => a.priority - b.priority).slice(0, 3);
  if (recommendations.length > 0) return recommendations;
  return [{
    type: "info",
    priority: 10,
    category: "no-targets",
    title: "No target-backed action available",
    message: "Configure one GA4 KPI or Benchmark with a matching reporting period before using this section for a decision.",
  }];
}
