import { computeConversionRatePercent, normalizeRateToPercent } from "./metric-math";

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
  const name = String(kpi?.metric || kpi?.name || "").trim();
  if (name === "Revenue") return Number(financialRevenue || 0).toFixed(2);
  if (name === "Total Conversions") return String(Math.round(Number(breakdownTotals.conversions || 0)));
  if (name === "Conversion Rate") return computeConversionRatePercent(Number(breakdownTotals.conversions || 0), Number(breakdownTotals.sessions || 0)).toFixed(2);
  if (name === "Engagement Rate") return normalizeRateToPercent(overviewEngagementRate).toFixed(2);
  if (name === "Total Users") return String(Math.round(Number(breakdownTotals.users || 0)));
  if (name === "Total Sessions") return String(Math.round(Number(breakdownTotals.sessions || 0)));
  if (name === "ROAS") return (financialSpend > 0 ? financialRevenue / financialSpend : 0).toFixed(2);
  if (name === "ROI") return Number(financialROI || 0).toFixed(2);
  if (name === "CPA") return Number(financialCPA || 0).toFixed(2);
  return String(kpi?.currentValue ?? "0.00");
};
