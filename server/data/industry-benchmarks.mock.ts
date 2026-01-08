export type MockBenchmarkValue = { value: number; unit: string };

// MVP-only mock dataset for Industry benchmarks.
// IMPORTANT: This is NOT a licensed or audited dataset. It must be explicitly enabled and labeled.
// Replace this file with a vendor-sourced dataset later (keep the same shape).
export const MOCK_INDUSTRY_BENCHMARKS: Record<string, Record<string, MockBenchmarkValue>> = {
  saas: {
    roi: { value: 180, unit: "%" },
    roas: { value: 350, unit: "%" },
    cpa: { value: 120, unit: "$" },
    conversionRate: { value: 3.2, unit: "%" },
    engagementRate: { value: 58, unit: "%" },
    users: { value: 120000, unit: "count" },
    sessions: { value: 180000, unit: "count" },
    revenue: { value: 250000, unit: "$" },
  },
  ecommerce: {
    roi: { value: 140, unit: "%" },
    roas: { value: 420, unit: "%" },
    cpa: { value: 65, unit: "$" },
    conversionRate: { value: 2.7, unit: "%" },
    engagementRate: { value: 52, unit: "%" },
    users: { value: 160000, unit: "count" },
    sessions: { value: 240000, unit: "count" },
    revenue: { value: 420000, unit: "$" },
  },
  technology: {
    roi: { value: 160, unit: "%" },
    roas: { value: 380, unit: "%" },
    cpa: { value: 110, unit: "$" },
    conversionRate: { value: 3.0, unit: "%" },
    engagementRate: { value: 55, unit: "%" },
    users: { value: 140000, unit: "count" },
    sessions: { value: 210000, unit: "count" },
    revenue: { value: 300000, unit: "$" },
  },
};

export function getMockBenchmarkValue(industry: string, metric: string): MockBenchmarkValue | null {
  const i = MOCK_INDUSTRY_BENCHMARKS[String(industry || "").toLowerCase()];
  if (!i) return null;
  return i[String(metric || "").trim()] || null;
}


