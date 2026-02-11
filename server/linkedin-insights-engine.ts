export type LinkedInDailyFact = {
  date: string; // YYYY-MM-DD (UTC day)
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  engagements?: number;
  reach?: number;
};

export type InsightAction =
  | { label: string; kind: "go"; tab: "overview" | "kpis" | "benchmarks" | "ads" | "reports" | "insights" }
  | { label: string; kind: "openRevenueModal" };

export type InsightItem = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  recommendation?: string;
  confidence?: "high" | "medium" | "low";
  evidence?: string[];
  actions?: InsightAction[];
};

export type ExecWowThresholds = {
  minClicks: number;
  minImpressions: number;
  minConversions: number;
  cvrDropPct: number;
  cpcSpikePct: number;
  erDecayPct: number;
  ctrStableBandPct: number;
};

export const DEFAULT_EXEC_WOW_THRESHOLDS: ExecWowThresholds = {
  minClicks: 100,
  minImpressions: 5000,
  minConversions: 20,
  cvrDropPct: 20,
  cpcSpikePct: 20,
  erDecayPct: 20,
  ctrStableBandPct: 5,
};

function isIsoDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "").trim());
}

function n(v: any): number {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

function pctDelta(cur: number, prev: number): number | null {
  if (!(prev > 0)) return null;
  return ((cur - prev) / prev) * 100;
}

function fmtPct(nv: number | null): string {
  if (nv === null) return "n/a";
  return `${nv >= 0 ? "+" : ""}${nv.toFixed(1)}%`;
}

function fmtPctAbs(nv: number | null): string {
  if (nv === null) return "n/a";
  return `${Math.abs(nv).toFixed(1)}%`;
}

function fmtInt(x: number): string {
  return Math.round(n(x)).toLocaleString("en-US");
}

function fmtMoney(x: number): string {
  const v = n(x);
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Rollup = {
  impressions: number;
  clicks: number;
  conversions: number;
  spend: number;
  engagements: number;
  reach: number;
  ctr: number;
  cvr: number;
  cpc: number;
  er: number;
  frequency: number;
};

function rollup(rows: LinkedInDailyFact[]): Rollup {
  const sums = rows.reduce(
    (acc, r) => {
      acc.impressions += n(r.impressions);
      acc.clicks += n(r.clicks);
      acc.conversions += n(r.conversions);
      acc.spend += n(r.spend);
      acc.engagements += n(r.engagements);
      acc.reach += n(r.reach);
      return acc;
    },
    { impressions: 0, clicks: 0, conversions: 0, spend: 0, engagements: 0, reach: 0 }
  );
  const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
  const cvr = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
  const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
  const er = sums.impressions > 0 ? (sums.engagements / sums.impressions) * 100 : 0;
  const frequency = sums.reach > 0 ? sums.impressions / sums.reach : 0;
  return { ...sums, ctr, cvr, cpc, er, frequency };
}

/**
 * Compute a small, exec-friendly set of week-over-week signals from persisted daily facts.
 * This is intentionally heuristic: it provides decision guidance with evidence + next steps.
 */
export function computeExecWowSignals(params: {
  dailyFacts: LinkedInDailyFact[];
  thresholds?: Partial<ExecWowThresholds>;
  campaignBudget?: number;
}): { availableDays: number; signals: InsightItem[]; cur7?: Rollup; prev7?: Rollup; cur30?: Rollup; prev30?: Rollup } {
  const thresholds: ExecWowThresholds = { ...DEFAULT_EXEC_WOW_THRESHOLDS, ...(params.thresholds || {}) };

  const byDate = (Array.isArray(params.dailyFacts) ? params.dailyFacts : [])
    .filter((r) => isIsoDate(r?.date))
    .map((r) => ({
      date: String(r.date),
      impressions: n(r.impressions),
      clicks: n(r.clicks),
      conversions: n(r.conversions),
      spend: n(r.spend),
      engagements: n(r.engagements),
      reach: n(r.reach),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = byDate.map((r) => r.date);
  const availableDays = dates.length;
  const signals: InsightItem[] = [];

  if (availableDays < 14) {
    if (availableDays > 0) {
      signals.push({
        id: "anomaly:not-enough-history",
        severity: "low",
        title: "Anomaly detection needs more history",
        description: `Need at least 14 days of daily data to compute week-over-week deltas. Available days: ${availableDays}.`,
        confidence: "high",
        evidence: [`Available days: ${availableDays}`],
        recommendation: "Let the scheduler collect more daily history, then Insights will unlock week-over-week comparisons.",
      });
    }
    return { availableDays, signals };
  }

  const curRows = byDate.slice(-7);
  const prevRows = byDate.slice(-14, -7);
  const cur = rollup(curRows);
  const prev = rollup(prevRows);

  const ctrDelta = pctDelta(cur.ctr, prev.ctr);
  const cvrDelta = pctDelta(cur.cvr, prev.cvr);
  const cpcDelta = pctDelta(cur.cpc, prev.cpc);
  const erDelta = pctDelta(cur.er, prev.er);

  const ctrStable =
    prev.impressions >= thresholds.minImpressions &&
    prev.ctr > 0 &&
    ctrDelta !== null &&
    Math.abs(ctrDelta) <= thresholds.ctrStableBandPct;

  const cvrReliable =
    prev.clicks >= thresholds.minClicks &&
    prev.conversions >= thresholds.minConversions &&
    prev.cvr > 0 &&
    cvrDelta !== null;

  const cpcReliable = prev.clicks >= thresholds.minClicks && prev.cpc > 0 && cpcDelta !== null;
  const erReliable = prev.impressions >= thresholds.minImpressions && prev.er > 0 && erDelta !== null;

  // Landing page regression: CVR down materially while CTR stays stable.
  if (cvrReliable && ctrStable && (cvrDelta as number) <= -thresholds.cvrDropPct) {
    signals.push({
      id: "anomaly:landing_page_regression:wow",
      severity: "high",
      title: `Likely landing page regression (CVR down ${fmtPctAbs(cvrDelta)} WoW, CTR stable)`,
      description:
        `Conversion rate from LinkedIn traffic dropped ${fmtPctAbs(cvrDelta)} week-over-week while click-through rate remained stable. This pattern most often points to a landing page/form/tracking regression.`,
      confidence: "high",
      evidence: [
        `CTR: ${prev.ctr.toFixed(2)}% → ${cur.ctr.toFixed(2)}% (${fmtPct(ctrDelta)})`,
        `CVR: ${prev.cvr.toFixed(2)}% → ${cur.cvr.toFixed(2)}% (${fmtPct(cvrDelta)})`,
        `Clicks: ${fmtInt(prev.clicks)} → ${fmtInt(cur.clicks)} (${fmtPct(pctDelta(cur.clicks, prev.clicks))})`,
        `Conversions: ${fmtInt(prev.conversions)} → ${fmtInt(cur.conversions)} (${fmtPct(pctDelta(cur.conversions, prev.conversions))})`,
      ],
      recommendation:
        "Check landing page availability, load time, form errors, routing/UTMs, and recent page changes. Then review lead quality and audience/creative changes if the page is healthy.",
      actions: [
        { label: "Open Trends", kind: "go", tab: "insights" },
        { label: "Open Ad Comparison", kind: "go", tab: "ads" },
      ],
    });
  } else if (cvrReliable && (cvrDelta as number) <= -thresholds.cvrDropPct) {
    signals.push({
      id: "anomaly:cvr_drop:wow",
      severity: "high",
      title: `Conversion rate dropped ${fmtPctAbs(cvrDelta)} week-over-week`,
      description:
        "CVR fell materially week-over-week. When CTR is stable, this usually indicates a landing page/form issue; otherwise it may be traffic quality.",
      confidence: "medium",
      evidence: [
        `CVR: ${prev.cvr.toFixed(2)}% → ${cur.cvr.toFixed(2)}% (${fmtPct(cvrDelta)})`,
        `CTR: ${prev.ctr.toFixed(2)}% → ${cur.ctr.toFixed(2)}% (${fmtPct(ctrDelta)})`,
        `Clicks: ${fmtInt(prev.clicks)} → ${fmtInt(cur.clicks)}`,
      ],
      recommendation:
        "If CTR is flat, check landing page/form/tracking. If CTR also dropped, prioritize creative fatigue and audience fit.",
      actions: [
        { label: "Open Trends", kind: "go", tab: "insights" },
        { label: "Open Ad Comparison", kind: "go", tab: "ads" },
      ],
    });
  }

  // CPC spike
  if (cpcReliable && (cpcDelta as number) >= thresholds.cpcSpikePct) {
    signals.push({
      id: "anomaly:cpc_spike:wow",
      severity: (cpcDelta as number) >= 40 ? "high" : "medium",
      title: `CPC spiked ${fmtPctAbs(cpcDelta)} week-over-week`,
      description:
        "Cost per click increased materially week-over-week, which can indicate auction pressure, audience saturation, or creative relevance decline.",
      confidence: "medium",
      evidence: [
        `CPC: ${fmtMoney(prev.cpc)} → ${fmtMoney(cur.cpc)} (${fmtPct(cpcDelta)})`,
        `CTR: ${prev.ctr.toFixed(2)}% → ${cur.ctr.toFixed(2)}% (${fmtPct(ctrDelta)})`,
        `Spend: ${fmtMoney(prev.spend)} → ${fmtMoney(cur.spend)} (${fmtPct(pctDelta(cur.spend, prev.spend))})`,
      ],
      recommendation:
        "Check bidding/budget changes, audience size/frequency, and creative relevance. Consider refreshing creatives or widening targeting to reduce auction pressure.",
      actions: [{ label: "Open Ad Comparison", kind: "go", tab: "ads" }],
    });
  }

  // Engagement decay
  if (erReliable && (erDelta as number) <= -thresholds.erDecayPct) {
    signals.push({
      id: "anomaly:engagement_decay:wow",
      severity: "medium",
      title: `Engagement rate declined ${fmtPctAbs(erDelta)} week-over-week`,
      description:
        "Engagement per impression declined week-over-week—often a sign of creative fatigue or weaker audience-message fit.",
      confidence: "medium",
      evidence: [
        `Engagement rate: ${prev.er.toFixed(2)}% → ${cur.er.toFixed(2)}% (${fmtPct(erDelta)})`,
        `Engagements: ${fmtInt(prev.engagements)} → ${fmtInt(cur.engagements)} (${fmtPct(pctDelta(cur.engagements, prev.engagements))})`,
        `Impressions: ${fmtInt(prev.impressions)} → ${fmtInt(cur.impressions)} (${fmtPct(pctDelta(cur.impressions, prev.impressions))})`,
      ],
      recommendation:
        "Refresh creative, tighten to best-performing segments, and review recent messaging changes. If engagement drops while CPC rises, prioritize creative relevance.",
      actions: [{ label: "Open Ad Comparison", kind: "go", tab: "ads" }],
    });
  }

  // Spend pacing alerts
  if (params.campaignBudget && params.campaignBudget > 0 && availableDays >= 7) {
    const totalSpend = cur.spend;
    const avgDailySpend = totalSpend / 7;

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    const projectedMonthlySpend = avgDailySpend * daysInMonth;
    const pacingRatio = projectedMonthlySpend / params.campaignBudget;

    if (dayOfMonth >= 7) {
      if (pacingRatio >= 1.15) {
        signals.push({
          id: "budget:overpacing",
          severity: pacingRatio >= 1.3 ? "high" : "medium",
          title: `Spend pacing ${Math.abs((pacingRatio - 1) * 100).toFixed(0)}% over monthly budget`,
          description: `At current rate (${fmtMoney(avgDailySpend)}/day), projected month-end spend is ${fmtMoney(projectedMonthlySpend)} vs budget ${fmtMoney(params.campaignBudget)}`,
          confidence: dayOfMonth >= 14 ? "high" : "medium",
          evidence: [
            `Monthly budget: ${fmtMoney(params.campaignBudget)}`,
            `Avg daily spend (last 7d): ${fmtMoney(avgDailySpend)}`,
            `Projected month-end: ${fmtMoney(projectedMonthlySpend)}`,
            `Day ${dayOfMonth} of ${daysInMonth}`
          ],
          recommendation: "Reduce daily budgets, pause underperforming ads/campaigns, or increase monthly budget to avoid mid-month cutoff",
          actions: [
            { label: "View Ad Performance", kind: "go", tab: "ads" },
            { label: "Review KPIs", kind: "go", tab: "kpis" }
          ]
        });
      } else if (pacingRatio <= 0.7 && dayOfMonth >= 14) {
        signals.push({
          id: "budget:underpacing",
          severity: "medium",
          title: `Spend pacing ${Math.abs((1 - pacingRatio) * 100).toFixed(0)}% under monthly budget`,
          description: `Only ${((totalSpend / params.campaignBudget) * 100).toFixed(0)}% of monthly budget used by day ${dayOfMonth}. Projected spend: ${fmtMoney(projectedMonthlySpend)}`,
          confidence: "medium",
          evidence: [
            `Monthly budget: ${fmtMoney(params.campaignBudget)}`,
            `Spend to date (last 7d): ${fmtMoney(totalSpend)}`,
            `Projected month-end: ${fmtMoney(projectedMonthlySpend)}`
          ],
          recommendation: "Consider increasing daily budgets or expanding targeting to fully utilize allocated budget",
          actions: [{ label: "View Benchmarks", kind: "go", tab: "benchmarks" }]
        });
      }
    }
  }

  // Impression/Reach saturation detection
  if (prev.reach > 0 && cur.reach > 0 && prev.frequency > 0 && cur.frequency > 0) {
    const frequencyDelta = pctDelta(cur.frequency, prev.frequency);

    // High frequency (>3.5) with declining engagement = saturation
    if (cur.frequency > 3.5 && erDelta !== null && (erDelta as number) <= -15) {
      signals.push({
        id: "saturation:audience_fatigue",
        severity: cur.frequency > 5 ? "high" : "medium",
        title: `Audience saturation detected (frequency ${cur.frequency.toFixed(1)}x)`,
        description: `Average frequency ${cur.frequency.toFixed(1)}x with engagement rate down ${fmtPctAbs(erDelta)}. This pattern indicates you're showing ads to the same people too often, causing fatigue.`,
        confidence: "high",
        evidence: [
          `Frequency: ${prev.frequency.toFixed(1)}x → ${cur.frequency.toFixed(1)}x (${fmtPct(frequencyDelta)})`,
          `Engagement rate: ${prev.er.toFixed(2)}% → ${cur.er.toFixed(2)}% (${fmtPct(erDelta)})`,
          `Reach: ${fmtInt(prev.reach)} → ${fmtInt(cur.reach)} (${fmtPct(pctDelta(cur.reach, prev.reach))})`,
          `Impressions: ${fmtInt(prev.impressions)} → ${fmtInt(cur.impressions)} (${fmtPct(pctDelta(cur.impressions, prev.impressions))})`
        ],
        recommendation: "Expand targeting to new audiences, refresh creative, introduce new ad variants, or reduce daily budget to lower frequency",
        actions: [
          { label: "Open Ad Comparison", kind: "go", tab: "ads" },
          { label: "View Overview", kind: "go", tab: "overview" }
        ]
      });
    } else if (cur.frequency > 4 && frequencyDelta !== null && (frequencyDelta as number) >= 20) {
      // Rising frequency without engagement decline yet (early warning)
      signals.push({
        id: "saturation:frequency_rising",
        severity: "low",
        title: `Frequency rising to ${cur.frequency.toFixed(1)}x (early saturation warning)`,
        description: `Average frequency increased ${fmtPctAbs(frequencyDelta)} to ${cur.frequency.toFixed(1)}x. While engagement is stable now, continued frequency increases often lead to audience fatigue.`,
        confidence: "medium",
        evidence: [
          `Frequency: ${prev.frequency.toFixed(1)}x → ${cur.frequency.toFixed(1)}x (${fmtPct(frequencyDelta)})`,
          `Reach: ${fmtInt(prev.reach)} → ${fmtInt(cur.reach)} (${fmtPct(pctDelta(cur.reach, prev.reach))})`,
          `Engagement rate: ${cur.er.toFixed(2)}% (stable)`
        ],
        recommendation: "Monitor engagement closely. Consider preparing fresh creative variants or expanding to lookalike audiences",
        actions: [{ label: "View Trends", kind: "go", tab: "insights" }]
      });
    }
  }

  // Compute 30d rollups for strategic comparison
  let cur30: Rollup | undefined;
  let prev30: Rollup | undefined;

  if (availableDays >= 30) {
    cur30 = rollup(byDate.slice(-30));
  }
  if (availableDays >= 60) {
    prev30 = rollup(byDate.slice(-60, -30));
  }

  return { availableDays, signals, cur7: cur, prev7: prev, cur30, prev30 };
}

