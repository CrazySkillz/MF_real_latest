import { computeExecWowSignals } from "./linkedin-insights-engine";

function make14Days(params: {
  // Prior 7d totals
  prev: { impressions: number; clicks: number; conversions: number; spend: number; engagements?: number };
  // Last 7d totals
  cur: { impressions: number; clicks: number; conversions: number; spend: number; engagements?: number };
}) {
  const days: any[] = [];
  const start = new Date(Date.UTC(2026, 0, 1)); // 2026-01-01

  const perDay = (tot: any) => ({
    impressions: tot.impressions / 7,
    clicks: tot.clicks / 7,
    conversions: tot.conversions / 7,
    spend: tot.spend / 7,
    engagements: (tot.engagements ?? 0) / 7,
  });

  const p = perDay(params.prev);
  const c = perDay(params.cur);

  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      impressions: p.impressions,
      clicks: p.clicks,
      conversions: p.conversions,
      spend: p.spend,
      engagements: p.engagements,
    });
  }
  for (let i = 7; i < 14; i++) {
    const d = new Date(start.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      spend: c.spend,
      engagements: c.engagements,
    });
  }
  return days;
}

describe("computeExecWowSignals", () => {
  it("emits not-enough-history when < 14 days", () => {
    const out = computeExecWowSignals({
      dailyFacts: [
        { date: "2026-01-01", impressions: 1000, clicks: 50, conversions: 5, spend: 100, engagements: 200 },
        { date: "2026-01-02", impressions: 1000, clicks: 50, conversions: 5, spend: 100, engagements: 200 },
      ],
    });
    expect(out.signals.some((s) => s.id === "anomaly:not-enough-history")).toBe(true);
  });

  it("emits landing page regression when CVR drops >= 20% and CTR is stable", () => {
    // Prior week: CTR 1.00% (100 clicks / 10,000 impr), CVR 5.00% (25 conv / 500 clicks)
    // Current week: CTR ~1.02% (stable), CVR 3.50% (~30% drop)
    const dailyFacts = make14Days({
      prev: { impressions: 100000, clicks: 1000, conversions: 50, spend: 10000, engagements: 2000 },
      cur: { impressions: 100000, clicks: 1020, conversions: 36, spend: 10000, engagements: 2000 },
    });
    const out = computeExecWowSignals({ dailyFacts });
    expect(out.signals.some((s) => s.id === "anomaly:landing_page_regression:wow")).toBe(true);
  });

  it("emits CPC spike when CPC increases >= 20%", () => {
    const dailyFacts = make14Days({
      prev: { impressions: 200000, clicks: 2000, conversions: 80, spend: 10000, engagements: 4000 }, // CPC = 5.00
      cur: { impressions: 200000, clicks: 2000, conversions: 80, spend: 14000, engagements: 4000 }, // CPC = 7.00 (+40%)
    });
    const out = computeExecWowSignals({ dailyFacts });
    expect(out.signals.some((s) => s.id === "anomaly:cpc_spike:wow")).toBe(true);
  });

  it("emits engagement decay when ER drops >= 20%", () => {
    const dailyFacts = make14Days({
      prev: { impressions: 200000, clicks: 2000, conversions: 80, spend: 10000, engagements: 10000 }, // ER=5.0%
      cur: { impressions: 200000, clicks: 2000, conversions: 80, spend: 10000, engagements: 7000 }, // ER=3.5% (-30%)
    });
    const out = computeExecWowSignals({ dailyFacts });
    expect(out.signals.some((s) => s.id === "anomaly:engagement_decay:wow")).toBe(true);
  });
});

