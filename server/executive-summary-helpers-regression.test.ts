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
    expect(risk.riskExplanation).not.toContain("single advertising platform");
    expect(risk.riskExplanation).not.toContain("ROAS below breakeven");
  });
});
