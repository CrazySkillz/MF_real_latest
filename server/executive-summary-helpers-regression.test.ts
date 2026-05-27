import { describe, expect, it } from "vitest";
import { calculateHealthScore, generateRecommendations, generateRiskAssessment } from "./utils/executive-summary-helpers";

describe("Executive Summary helper availability guards", () => {
  it("does not penalize health score for unavailable aggregate metrics", () => {
    const health = calculateHealthScore({
      roi: null,
      roas: null,
      ctr: null,
      cvr: 5,
    });

    expect(health.grade).toBe("A");
    expect(health.score).toBe(100);
    expect(health.factors.map((factor) => factor.factor)).toEqual(["CVR"]);
  });

  it("does not treat GA4-only analytics as a single advertising-platform risk", () => {
    const risk = generateRiskAssessment(
      [],
      [{ name: "Google Analytics", category: "web_analytics" }],
      { roi: null, roas: null },
      null,
      0,
    );

    expect(risk.riskLevel).toBe("low");
    expect(risk.riskFactors).toEqual([]);
    expect(risk.riskExplanation).toBe("No significant risk factors identified from available connected-source inputs. Continue monitoring performance.");
    expect(risk.checkedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Available ROI", status: "unavailable" }),
      expect.objectContaining({ label: "Available ROAS", status: "unavailable" }),
      expect.objectContaining({ label: "Paid-platform concentration", status: "not_applicable" }),
      expect.objectContaining({ label: "7-day trajectory", status: "not_enough_history" }),
      expect.objectContaining({ label: "Budget pacing", status: "separate_section" }),
    ]));
    expect(risk.riskExplanation).not.toContain("single advertising platform");
    expect(risk.riskExplanation).not.toContain("ROAS below breakeven");
  });

  it("adds configured KPI, benchmark, and freshness factors without requiring unavailable paid metrics", () => {
    const risk = generateRiskAssessment(
      [],
      [{ name: "Google Analytics", category: "web_analytics" }],
      { roi: null, roas: null },
      null,
      0,
      [
        { type: "kpi", message: "1 KPI is below 70% of target", severity: "medium" },
        { type: "benchmark", message: "1 benchmark is below 70% of benchmark", severity: "medium" },
        { type: "freshness", message: "Google Analytics data is 15 days old", severity: "high" },
      ],
    );

    expect(risk.riskLevel).toBe("high");
    expect(risk.riskFactors).toEqual(expect.arrayContaining([
      { type: "kpi", message: "1 KPI is below 70% of target" },
      { type: "benchmark", message: "1 benchmark is below 70% of benchmark" },
      { type: "freshness", message: "Google Analytics data is 15 days old" },
    ]));
    expect(risk.checkedInputs).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Available ROI", status: "unavailable" }),
      expect.objectContaining({ label: "Paid-platform concentration", status: "not_applicable" }),
    ]));
  });

  it("does not generate paid-media recommendations for GA4-only web analytics", () => {
    const recommendations = generateRecommendations([], 500, 660, 65914, "accelerating", {
      hasSpend: true,
      hasRevenue: true,
      hasRoas: true,
      hasRoi: true,
      hasSessions: true,
      hasUsers: true,
      hasConversions: true,
      hasCvr: true,
      users: 51906,
      sessions: 66972,
      conversions: 2984,
      revenue: 329245,
      cvr: 4.454,
      paidMediaSources: 0,
      webAnalyticsSources: 1,
    });

    expect(recommendations.map((recommendation) => recommendation.category)).toEqual(["Website Outcomes"]);
    expect(recommendations[0].action).toContain("before making paid-media budget decisions");
    expect(recommendations[0].expectedImpact).toContain("Available data: 51,906 users, 66,972 sessions, 2,984 conversions, $329,245 revenue, 4.5% conversion rate.");
    expect(recommendations[0].expectedImpact).toContain("No KPI or Benchmark target is available for conversion rate, revenue, or conversions, so quality cannot be judged yet.");
    expect(recommendations[0].investmentRequired).toContain("connect a paid-media source");
    expect(recommendations[0].assumptions.join(" ")).toContain("not a spend, ROAS, CPA, CPC, CTR, or CPM recommendation");
    expect(JSON.stringify(recommendations)).not.toContain("Increase campaign budget");
    expect(JSON.stringify(recommendations)).not.toContain("Budget Reallocation");
    expect(JSON.stringify(recommendations)).not.toContain("additional platforms");
  });

  it("states when GA4-only web outcome targets exist for interpretation", () => {
    const recommendations = generateRecommendations([], 0, 0, 0, null, {
      hasRevenue: true,
      hasSessions: true,
      hasConversions: true,
      hasCvr: true,
      sessions: 8432,
      conversions: 392,
      revenue: 88893,
      cvr: 4.65,
      hasRevenueTarget: true,
      hasCvrTarget: true,
      paidMediaSources: 0,
      webAnalyticsSources: 1,
    });

    expect(recommendations[0].expectedImpact).toContain("KPI or Benchmark targets exist for conversion rate, revenue; compare against those targets before judging quality.");
    expect(JSON.stringify(recommendations)).not.toContain("Increase campaign budget");
  });

  it("does not reallocate budget with only one paid-media source", () => {
    const recommendations = generateRecommendations(
      [{ name: "LinkedIn Ads", spend: 1000, revenue: 5000, roas: 5 }],
      1000,
      5,
      400,
      "stable",
      {
        hasSpend: true,
        hasRevenue: true,
        hasRoas: true,
        hasRoi: true,
        paidMediaSources: 1,
      },
    );

    expect(recommendations.map((recommendation) => recommendation.category)).not.toContain("Budget Reallocation");
  });

  it("can reallocate budget across two comparable paid-media sources", () => {
    const recommendations = generateRecommendations(
      [
        { name: "LinkedIn Ads", spend: 1000, revenue: 6000, roas: 6 },
        { name: "Meta Ads", spend: 1000, revenue: 2000, roas: 2 },
      ],
      2000,
      4,
      300,
      "stable",
      {
        hasSpend: true,
        hasRevenue: true,
        hasRoas: true,
        hasRoi: true,
        paidMediaSources: 2,
      },
    );

    expect(recommendations.map((recommendation) => recommendation.category)).toContain("Budget Reallocation");
  });

  it("does not make ROI or ROAS claims when spend or revenue is unavailable", () => {
    const spendWithoutRevenue = generateRecommendations(
      [{ name: "LinkedIn Ads", spend: 1000, revenue: 0, roas: 0 }],
      1000,
      0,
      0,
      "stable",
      { hasSpend: true, hasRevenue: false, hasRoas: false, hasRoi: false, paidMediaSources: 1 },
    );
    const revenueWithoutSpend = generateRecommendations(
      [{ name: "Google Analytics", spend: 0, revenue: 5000, roas: 0 }],
      0,
      0,
      0,
      "stable",
      { hasSpend: false, hasRevenue: true, hasRoas: false, hasRoi: false, paidMediaSources: 0, webAnalyticsSources: 1 },
    );

    expect(JSON.stringify(spendWithoutRevenue)).not.toMatch(/ROAS|ROI|profit|budget/i);
    expect(JSON.stringify(revenueWithoutSpend)).not.toMatch(/ROAS|ROI|profit|budget/i);
  });
});
