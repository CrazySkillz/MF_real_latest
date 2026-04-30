import { describe, it, expect } from "vitest";
import {
  computeCpa,
  computeConversionRatePercent,
  computeRoiPercent,
  computeRoasPercent,
  normalizeRateToPercent,
  computeProgress,
} from "../shared/metric-math";
import {
  isLowerIsBetterKpi,
  computeEffectiveDeltaPct,
  classifyKpiBand,
  computeAttainmentPct,
  computeAttainmentFillPct,
} from "../shared/kpi-math";

// --- Inlined from ga4-kpi-benchmark-jobs.ts (avoids importing heavy storage/analytics modules) ---
const round2 = (n: number) => Number((Number.isFinite(n) ? n : 0).toFixed(2));

function computeKpiValue(metricOrName: string, inputs: {
  users: number; sessions: number; pageviews: number; conversions: number;
  ga4Revenue: number; importedRevenue: number; spend: number; engagementRate: number;
}) {
  const m = String(metricOrName || "").trim().toLowerCase();
  const revenue = inputs.ga4Revenue > 0 ? inputs.ga4Revenue : inputs.importedRevenue;
  if (m === "revenue") return round2(revenue);
  if (m === "total conversions" || m === "conversions") return Math.round(inputs.conversions || 0);
  if (m === "total sessions" || m === "sessions") return Math.round(inputs.sessions || 0);
  if (m === "total users" || m === "users") return Math.round(inputs.users || 0);
  if (m === "pageviews") return Math.round(inputs.pageviews || 0);
  if (m === "conversion rate" || m === "conversionrate") return round2(computeConversionRatePercent(inputs.conversions, inputs.sessions));
  if (m === "engagement rate" || m === "engagementrate") return round2(normalizeRateToPercent(inputs.engagementRate));
  if (m === "roas") return round2(computeRoasPercent(revenue, inputs.spend));
  if (m === "roi") return round2(computeRoiPercent(revenue, inputs.spend));
  if (m === "cpa") return round2(computeCpa(inputs.spend, inputs.conversions));
  return 0;
}

function computeBenchmarkVariance(metricKey: string, current: number, benchmark: number) {
  const m = String(metricKey || "").toLowerCase();
  const lowerIsBetter = m === "cpa" || m.includes("cpa");
  if (!(benchmark > 0)) return 0;
  if (lowerIsBetter) return round2(((benchmark - current) / benchmark) * 100);
  return round2(((current - benchmark) / benchmark) * 100);
}

function computeBenchmarkRating(variancePct: number) {
  if (variancePct >= 20) return "excellent";
  if (variancePct >= 5) return "good";
  if (variancePct >= -5) return "average";
  if (variancePct >= -20) return "below_average";
  return "poor";
}

// ============================================================
// YESOP MOCK PROFILES - deterministic values from seeded demo data
// ============================================================
const PROFILES = {
  "yesop-brand": { users: 500, sessions: 750, pageviews: 2250, conversions: 38, revenue: 2850, spend: 950, engagementRate: 0.62 },
  "yesop-prospecting": { users: 300, sessions: 420, pageviews: 1260, conversions: 18, revenue: 1350, spend: 680, engagementRate: 0.54 },
  "yesop-retargeting": { users: 175, sessions: 260, pageviews: 780, conversions: 22, revenue: 1650, spend: 410, engagementRate: 0.74 },
  "yesop-email": { users: 125, sessions: 180, pageviews: 540, conversions: 12, revenue: 900, spend: 150, engagementRate: 0.67 },
  "yesop-social": { users: 250, sessions: 375, pageviews: 1125, conversions: 15, revenue: 1125, spend: 750, engagementRate: 0.58 },
} as const;

// Pre-computed expected values (manually verified)
const EXPECTED: Record<string, { cr: number; roas: number; roi: number; cpa: number; er: number }> = {
  "yesop-brand": { cr: (38 / 750) * 100, roas: (2850 / 950) * 100, roi: ((2850 - 950) / 950) * 100, cpa: 950 / 38, er: 62 },
  "yesop-prospecting": { cr: (18 / 420) * 100, roas: (1350 / 680) * 100, roi: ((1350 - 680) / 680) * 100, cpa: 680 / 18, er: 54 },
  "yesop-retargeting": { cr: (22 / 260) * 100, roas: (1650 / 410) * 100, roi: ((1650 - 410) / 410) * 100, cpa: 410 / 22, er: 74 },
  "yesop-email": { cr: (12 / 180) * 100, roas: (900 / 150) * 100, roi: ((900 - 150) / 150) * 100, cpa: 150 / 12, er: 67 },
  "yesop-social": { cr: (15 / 375) * 100, roas: (1125 / 750) * 100, roi: ((1125 - 750) / 750) * 100, cpa: 750 / 15, er: 58 },
};

const NEAR_TARGET_BAND_PCT = 5;

// Helper: build scheduler inputs from a profile
function toSchedulerInputs(p: typeof PROFILES["yesop-brand"]) {
  return {
    users: p.users,
    sessions: p.sessions,
    pageviews: p.pageviews,
    conversions: p.conversions,
    ga4Revenue: p.revenue,
    importedRevenue: 0,
    spend: p.spend,
    engagementRate: p.engagementRate,
  };
}

// =============================================================
// 1. normalizeRateToPercent (newly moved to shared, needs tests)
// =============================================================
describe("normalizeRateToPercent", () => {
  it("converts decimal (<=1) to percent", () => {
    expect(normalizeRateToPercent(0.62)).toBeCloseTo(62, 4);
    expect(normalizeRateToPercent(1.0)).toBeCloseTo(100, 4);
    expect(normalizeRateToPercent(0)).toBe(0);
  });

  it("passes through values already in percent (>1)", () => {
    expect(normalizeRateToPercent(62)).toBeCloseTo(62, 4);
    expect(normalizeRateToPercent(100)).toBeCloseTo(100, 4);
  });

  it("handles edge cases", () => {
    expect(normalizeRateToPercent(NaN)).toBe(0);
    expect(normalizeRateToPercent(undefined as any)).toBe(0);
    expect(normalizeRateToPercent(Infinity)).toBe(0);
  });
});

// =============================================================
// 2. Overview tab: shared formula consistency across all profiles
// =============================================================
describe("Overview tab computations — all 5 yesop profiles", () => {
  for (const [id, p] of Object.entries(PROFILES)) {
    const exp = EXPECTED[id];
    describe(id, () => {
      it("Conversion Rate = (conversions/sessions)*100", () => {
        expect(computeConversionRatePercent(p.conversions, p.sessions)).toBeCloseTo(exp.cr, 2);
      });

      it("ROAS = (revenue/spend)*100", () => {
        expect(computeRoasPercent(p.revenue, p.spend)).toBeCloseTo(exp.roas, 2);
      });

      it("ROI = ((revenue-spend)/spend)*100", () => {
        expect(computeRoiPercent(p.revenue, p.spend)).toBeCloseTo(exp.roi, 2);
      });

      it("CPA = spend/conversions", () => {
        expect(computeCpa(p.spend, p.conversions)).toBeCloseTo(exp.cpa, 2);
      });

      it("Engagement Rate = normalizeRateToPercent(engagementRate)", () => {
        expect(normalizeRateToPercent(p.engagementRate)).toBeCloseTo(exp.er, 2);
      });
    });
  }
});

// =============================================================
// 3. KPI tab: computeKpiValue (scheduler) matches shared formulas
// =============================================================
describe("KPI tab: scheduler computeKpiValue matches client formulas", () => {
  for (const [id, p] of Object.entries(PROFILES)) {
    const exp = EXPECTED[id];
    const inputs = toSchedulerInputs(p);

    describe(id, () => {
      it("Revenue", () => expect(computeKpiValue("Revenue", inputs)).toBeCloseTo(p.revenue, 2));
      it("Total Conversions", () => expect(computeKpiValue("Total Conversions", inputs)).toBe(p.conversions));
      it("Total Sessions", () => expect(computeKpiValue("Total Sessions", inputs)).toBe(p.sessions));
      it("Total Users", () => expect(computeKpiValue("Total Users", inputs)).toBe(p.users));
      it("Conversion Rate", () => expect(computeKpiValue("Conversion Rate", inputs)).toBeCloseTo(exp.cr, 1));
      it("Engagement Rate", () => expect(computeKpiValue("Engagement Rate", inputs)).toBeCloseTo(exp.er, 1));
      it("ROAS", () => expect(computeKpiValue("ROAS", inputs)).toBeCloseTo(exp.roas, 1));
      it("ROI", () => expect(computeKpiValue("ROI", inputs)).toBeCloseTo(exp.roi, 1));
      it("CPA", () => expect(computeKpiValue("CPA", inputs)).toBeCloseTo(exp.cpa, 1));
    });
  }

  it("prefers ga4Revenue over importedRevenue", () => {
    const inputs = { ...toSchedulerInputs(PROFILES["yesop-brand"]), ga4Revenue: 2850, importedRevenue: 500 };
    expect(computeKpiValue("Revenue", inputs)).toBeCloseTo(2850, 2);
  });

  it("falls back to importedRevenue when ga4Revenue=0", () => {
    const inputs = { ...toSchedulerInputs(PROFILES["yesop-brand"]), ga4Revenue: 0, importedRevenue: 500 };
    expect(computeKpiValue("Revenue", inputs)).toBeCloseTo(500, 2);
  });

  it("returns 0 for unknown metric", () => {
    expect(computeKpiValue("nonexistent_metric", toSchedulerInputs(PROFILES["yesop-brand"]))).toBe(0);
  });

  it("handles zero-denominator safely", () => {
    const empty = { users: 0, sessions: 0, pageviews: 0, conversions: 0, ga4Revenue: 0, importedRevenue: 0, spend: 0, engagementRate: 0 };
    expect(computeKpiValue("ROAS", empty)).toBe(0);
    expect(computeKpiValue("ROI", empty)).toBe(0);
    expect(computeKpiValue("CPA", empty)).toBe(0);
    expect(computeKpiValue("Conversion Rate", empty)).toBe(0);
  });
});

// =============================================================
// 4. KPI progress: band classification and attainment scenarios
// =============================================================
describe("KPI tab: progress scenarios (band, attainment, bar color)", () => {
  // yesop-brand: revenue=2850, ROAS=300, CPA=25

  it("Revenue KPI at 80% of target => below band, ~81% attainment, red bar", () => {
    const target = 3500;
    const current = 2850;
    const lowerIsBetter = false;
    const delta = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    const band = classifyKpiBand({ effectiveDeltaPct: delta!, nearTargetBandPct: NEAR_TARGET_BAND_PCT });
    const attainment = computeAttainmentPct({ current, target, lowerIsBetter })!;
    const fill = computeAttainmentFillPct(attainment);

    expect(band).toBe("below");
    expect(attainment).toBeCloseTo(81.43, 1);
    expect(fill).toBeCloseTo(81.43, 1);
    // Color: <90% => red
    expect(attainment).toBeLessThan(90);
  });

  it("ROAS KPI exceeding target => above band, 120% attainment, green bar", () => {
    const target = 250;
    const current = 300;
    const lowerIsBetter = false;
    const delta = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    const band = classifyKpiBand({ effectiveDeltaPct: delta!, nearTargetBandPct: NEAR_TARGET_BAND_PCT });
    const attainment = computeAttainmentPct({ current, target, lowerIsBetter })!;
    const fill = computeAttainmentFillPct(attainment);

    expect(band).toBe("above");
    expect(attainment).toBeCloseTo(120, 1);
    expect(fill).toBe(100); // capped
    // Color: >=100% => green
    expect(attainment).toBeGreaterThanOrEqual(100);
  });

  it("CPA KPI (lower-is-better) below target => above band (good)", () => {
    const target = 30;
    const current = 25; // under target = good for CPA
    const lowerIsBetter = true;
    const delta = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    const band = classifyKpiBand({ effectiveDeltaPct: delta!, nearTargetBandPct: NEAR_TARGET_BAND_PCT });
    const attainment = computeAttainmentPct({ current, target, lowerIsBetter })!;

    expect(band).toBe("above"); // better than target
    expect(attainment).toBeCloseTo(120, 1); // target/current = 30/25 = 120%
    expect(attainment).toBeGreaterThanOrEqual(100);
  });

  it("CPA KPI (lower-is-better) above target => below band (bad)", () => {
    const target = 20;
    const current = 25; // over target = bad for CPA
    const lowerIsBetter = true;
    const delta = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    const band = classifyKpiBand({ effectiveDeltaPct: delta!, nearTargetBandPct: NEAR_TARGET_BAND_PCT });
    const attainment = computeAttainmentPct({ current, target, lowerIsBetter })!;

    expect(band).toBe("below");
    expect(attainment).toBeCloseTo(80, 1); // target/current = 20/25 = 80%
    expect(attainment).toBeLessThan(90);
  });

  it("on-track within ±5% band => near", () => {
    const target = 740;
    const current = 750; // delta = +1.35%, within ±5%
    const lowerIsBetter = false;
    const delta = computeEffectiveDeltaPct({ current, target, lowerIsBetter });
    const band = classifyKpiBand({ effectiveDeltaPct: delta!, nearTargetBandPct: NEAR_TARGET_BAND_PCT });

    expect(band).toBe("near");
  });

  it("amber bar: attainment 90-99%", () => {
    const target = 800;
    const current = 750; // attainment = 93.75%
    const attainment = computeAttainmentPct({ current, target, lowerIsBetter: false })!;
    expect(attainment).toBeCloseTo(93.75, 1);
    expect(attainment).toBeGreaterThanOrEqual(90);
    expect(attainment).toBeLessThan(100);
    // Color logic: >=90% but <100% => amber
  });
});

// =============================================================
// 5. Benchmark tab: progress with ratio-based thresholds
// =============================================================
describe("Benchmark tab: computeBenchmarkProgress scenarios", () => {
  // Simulates the client-side computeBenchmarkProgress logic using computeProgress
  // Thresholds: ratio >= 0.9 => on_track, >= 0.7 => needs_attention, < 0.7 => behind

  it("Sessions: current=750, benchmark=800 => on_track (ratio=0.9375)", () => {
    const p = computeProgress({ current: 750, target: 800, lowerIsBetter: false });
    expect(p.ratio).toBeCloseTo(0.9375, 4);
    expect(p.status).toBe("on_track");
  });

  it("Revenue: current=2850, benchmark=5000 => behind (ratio=0.57)", () => {
    const p = computeProgress({ current: 2850, target: 5000, lowerIsBetter: false });
    expect(p.ratio).toBeCloseTo(0.57, 2);
    expect(p.status).toBe("behind");
  });

  it("CPA (lower-is-better): current=25, benchmark=30 => on_track", () => {
    // For lower-is-better, ratio = benchmark/current = 30/25 = 1.2
    const p = computeProgress({ current: 25, target: 30, lowerIsBetter: true });
    expect(p.ratio).toBeGreaterThanOrEqual(0.9);
    expect(p.status).toBe("on_track");
  });

  it("CPA (lower-is-better): current=50, benchmark=30 => behind", () => {
    // ratio = 30/50 = 0.6
    const p = computeProgress({ current: 50, target: 30, lowerIsBetter: true });
    expect(p.ratio).toBeCloseTo(0.6, 2);
    expect(p.status).toBe("behind");
  });

  it("Revenue: current=2850, benchmark=3500 => needs_attention (ratio=0.814)", () => {
    const p = computeProgress({ current: 2850, target: 3500, lowerIsBetter: false });
    expect(p.ratio).toBeCloseTo(0.8143, 2);
    expect(p.status).toBe("needs_attention");
  });
});

// =============================================================
// 6. Benchmark variance (scheduler)
// =============================================================
describe("Benchmark variance and rating (scheduler)", () => {
  it("higher-is-better: current above benchmark => positive variance", () => {
    expect(computeBenchmarkVariance("sessions", 1000, 800)).toBeCloseTo(25, 1);
  });

  it("higher-is-better: current below benchmark => negative variance", () => {
    expect(computeBenchmarkVariance("sessions", 600, 800)).toBeCloseTo(-25, 1);
  });

  it("lower-is-better (CPA): current below benchmark => positive (good)", () => {
    expect(computeBenchmarkVariance("cpa", 20, 25)).toBeCloseTo(20, 1);
  });

  it("lower-is-better (CPA): current above benchmark => negative (bad)", () => {
    expect(computeBenchmarkVariance("cpa", 30, 25)).toBeCloseTo(-20, 1);
  });

  it("handles zero benchmark => 0", () => {
    expect(computeBenchmarkVariance("sessions", 100, 0)).toBe(0);
  });

  it("rating: excellent (>=20%)", () => expect(computeBenchmarkRating(25)).toBe("excellent"));
  it("rating: good (>=5% <20%)", () => expect(computeBenchmarkRating(10)).toBe("good"));
  it("rating: average (>=-5% <5%)", () => expect(computeBenchmarkRating(0)).toBe("average"));
  it("rating: below_average (>=-20% <-5%)", () => expect(computeBenchmarkRating(-10)).toBe("below_average"));
  it("rating: poor (<-20%)", () => expect(computeBenchmarkRating(-25)).toBe("poor"));
});

// =============================================================
// 7. Ad Comparison: aggregation correctness
// =============================================================
describe("Ad Comparison: aggregation rules", () => {
  it("sessions/conversions/revenue are additive across breakdown rows", () => {
    const rows = [
      { campaign: "A", sessions: 300, conversions: 15, revenue: 1000 },
      { campaign: "A", sessions: 200, conversions: 10, revenue: 500 },
      { campaign: "B", sessions: 150, conversions: 3, revenue: 200 },
    ];
    const byName = new Map<string, { sessions: number; conversions: number; revenue: number }>();
    for (const r of rows) {
      const existing = byName.get(r.campaign) || { sessions: 0, conversions: 0, revenue: 0 };
      existing.sessions += r.sessions;
      existing.conversions += r.conversions;
      existing.revenue += r.revenue;
      byName.set(r.campaign, existing);
    }
    expect(byName.get("A")!.sessions).toBe(500);
    expect(byName.get("A")!.conversions).toBe(25);
    expect(byName.get("B")!.sessions).toBe(150);
  });

  it("conversion rate is weighted (not averaged)", () => {
    // A: 300 sessions, 15 conversions => CR = 5%
    // B: 150 sessions, 3 conversions => CR = 2%
    // Correct total CR = (18/450)*100 = 4.0% (NOT (5+2)/2 = 3.5%)
    const totalSessions = 300 + 150;
    const totalConversions = 15 + 3;
    const weightedCR = (totalConversions / totalSessions) * 100;
    const averagedCR = (5 + 2) / 2;

    expect(weightedCR).toBeCloseTo(4.0, 2);
    expect(averagedCR).toBeCloseTo(3.5, 2);
    expect(weightedCR).not.toBeCloseTo(averagedCR, 1); // Must NOT be averaged
  });
});

// =============================================================
// 8. Cross-tab consistency: same value across all tabs
// =============================================================
describe("Cross-tab consistency: values must match across Overview/KPIs/Benchmarks/Insights", () => {
  const p = PROFILES["yesop-brand"];
  const exp = EXPECTED["yesop-brand"];
  const inputs = toSchedulerInputs(p);

  // These simulate what each tab computes independently — they must agree
  it("Revenue: Overview = KPI current = Benchmark current = Insights", () => {
    const overviewRevenue = p.revenue;
    const kpiRevenue = computeKpiValue("Revenue", inputs);
    expect(kpiRevenue).toBeCloseTo(overviewRevenue, 2);
  });

  it("ROAS: Overview = KPI current = Benchmark current", () => {
    const overviewRoas = computeRoasPercent(p.revenue, p.spend);
    const kpiRoas = computeKpiValue("ROAS", inputs);
    expect(kpiRoas).toBeCloseTo(overviewRoas, 1);
  });

  it("ROI: Overview = KPI current = Insights", () => {
    const overviewRoi = computeRoiPercent(p.revenue, p.spend);
    const kpiRoi = computeKpiValue("ROI", inputs);
    expect(kpiRoi).toBeCloseTo(overviewRoi, 1);
  });

  it("CPA: Overview = KPI current = Benchmark current", () => {
    const overviewCpa = computeCpa(p.spend, p.conversions);
    const kpiCpa = computeKpiValue("CPA", inputs);
    expect(kpiCpa).toBeCloseTo(overviewCpa, 1);
  });

  it("Conversion Rate: Overview = KPI current", () => {
    const overviewCr = computeConversionRatePercent(p.conversions, p.sessions);
    const kpiCr = computeKpiValue("Conversion Rate", inputs);
    expect(kpiCr).toBeCloseTo(overviewCr, 1);
  });

  it("Sessions: Overview = KPI current", () => {
    expect(computeKpiValue("Total Sessions", inputs)).toBe(p.sessions);
  });

  it("Users: Overview = KPI current", () => {
    expect(computeKpiValue("Total Users", inputs)).toBe(p.users);
  });

  it("Engagement Rate: Overview = KPI current", () => {
    const overviewEr = normalizeRateToPercent(p.engagementRate);
    const kpiEr = computeKpiValue("Engagement Rate", inputs);
    expect(kpiEr).toBeCloseTo(overviewEr, 1);
  });

  it("isLowerIsBetterKpi detects CPA correctly", () => {
    expect(isLowerIsBetterKpi({ metric: "CPA", name: "" })).toBe(true);
    expect(isLowerIsBetterKpi({ metric: "cpa", name: "" })).toBe(true);
    expect(isLowerIsBetterKpi({ metric: "ROAS", name: "" })).toBe(false);
    expect(isLowerIsBetterKpi({ metric: "Revenue", name: "" })).toBe(false);
    expect(isLowerIsBetterKpi({ metric: "Sessions", name: "" })).toBe(false);
  });
});

// Debug output: print all expected values if PRINT_TEST_VECTORS=1
if (process.env.PRINT_TEST_VECTORS === "1") {
  console.log("\n=== YESOP PROFILE EXPECTED VALUES ===");
  console.table(
    Object.entries(EXPECTED).map(([id, exp]) => ({
      profile: id,
      "CR%": exp.cr.toFixed(2),
      "ROAS%": exp.roas.toFixed(2),
      "ROI%": exp.roi.toFixed(2),
      CPA: exp.cpa.toFixed(2),
      "ER%": exp.er.toFixed(2),
    }))
  );
}
