import { describe, expect, it } from "vitest";
import { calculateHealthScore, generateRiskAssessment } from "./utils/executive-summary-helpers";

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
});
