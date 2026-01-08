export type MockBenchmarkValue = { value: number; unit: string };

// MVP-only mock dataset for Industry benchmarks.
// IMPORTANT: This is NOT a licensed or audited dataset. It must be explicitly enabled and labeled.
// Replace this file with a vendor-sourced dataset later (keep the same shape).
export const MOCK_INDUSTRY_BENCHMARKS: Record<string, Record<string, MockBenchmarkValue>> = {
  saas: {
    roi: { value: 180, unit: "%" },
    roas: { value: 350, unit: "%" },
    cpa: { value: 120, unit: "$" },
    conversions: { value: 900, unit: "count" },
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
    conversions: { value: 1400, unit: "count" },
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
    conversions: { value: 1000, unit: "count" },
    conversionRate: { value: 3.0, unit: "%" },
    engagementRate: { value: 55, unit: "%" },
    users: { value: 140000, unit: "count" },
    sessions: { value: 210000, unit: "count" },
    revenue: { value: 300000, unit: "$" },
  },
};

function hashToUnit01(input: string): number {
  // Deterministic, cheap hash → [0,1)
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function round(n: number, decimals: number) {
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

function generateMock(industryKey: string, metricKey: string): MockBenchmarkValue | null {
  const u = hashToUnit01(`${industryKey}::${metricKey}`);

  switch (metricKey) {
    case "roi":
      return { value: round(80 + u * 170, 1), unit: "%" }; // 80–250%
    case "roas":
      return { value: round(200 + u * 400, 1), unit: "%" }; // 200–600%
    case "cpa":
      return { value: round(40 + u * 160, 2), unit: "$" }; // $40–$200
    case "conversionRate":
      return { value: round(1.0 + u * 4.0, 2), unit: "%" }; // 1–5%
    case "engagementRate":
      return { value: round(35 + u * 35, 1), unit: "%" }; // 35–70%
    case "users": {
      const base = 50000 + u * 250000;
      return { value: Math.round(base / 1000) * 1000, unit: "count" };
    }
    case "sessions": {
      const base = 80000 + u * 320000;
      return { value: Math.round(base / 1000) * 1000, unit: "count" };
    }
    case "conversions": {
      const base = 300 + u * 2200;
      return { value: Math.round(base), unit: "count" };
    }
    case "revenue": {
      const base = 80000 + u * 900000;
      return { value: Math.round(base / 1000) * 1000, unit: "$" };
    }
    default:
      return null;
  }
}

export function getMockBenchmarkValue(industry: string, metric: string): MockBenchmarkValue | null {
  const industryKey = String(industry || "").toLowerCase();
  const metricKey = String(metric || "").trim();
  const i = MOCK_INDUSTRY_BENCHMARKS[industryKey];
  const explicit = i ? i[metricKey] : null;
  if (explicit) return explicit;

  // For MVP: always return a deterministic mock value for supported metrics, for any industry in the dropdown.
  return generateMock(industryKey, metricKey);
}


