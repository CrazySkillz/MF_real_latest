import { computeConversionRatePercent, normalizeRateToPercent } from "./metric-math";
import { resolveGA4KpiMetricIdentity } from "./ga4-kpi-metric-identity";

export const resolveGA4KpiLiveValue = (args: {
  kpi: any;
  breakdownTotals: any;
  overviewEngagementRate: number;
  financialRevenue: number;
  financialSpend: number;
  financialROI: number;
  financialCPA: number;
}): string => {
  const { kpi, breakdownTotals, overviewEngagementRate, financialRevenue, financialSpend, financialROI, financialCPA } = args;
  const metric = resolveGA4KpiMetricIdentity(kpi?.metric, kpi?.name);
  if (metric === "revenue") return Number(financialRevenue || 0).toFixed(2);
  if (metric === "conversions") return String(Math.round(Number(breakdownTotals.conversions || 0)));
  if (metric === "conversion_rate") return computeConversionRatePercent(Number(breakdownTotals.conversions || 0), Number(breakdownTotals.sessions || 0)).toFixed(2);
  if (metric === "engagement_rate") return normalizeRateToPercent(overviewEngagementRate).toFixed(2);
  if (metric === "users") return String(Math.round(Number(breakdownTotals.users || 0)));
  if (metric === "sessions") return String(Math.round(Number(breakdownTotals.sessions || 0)));
  if (metric === "pageviews") return String(Math.round(Number(breakdownTotals.pageviews || 0)));
  if (metric === "roas") return (financialSpend > 0 ? financialRevenue / financialSpend : 0).toFixed(2);
  if (metric === "roi") return Number(financialROI || 0).toFixed(2);
  if (metric === "cpa") return Number(financialCPA || 0).toFixed(2);
  return String(kpi?.currentValue ?? "0.00");
};
