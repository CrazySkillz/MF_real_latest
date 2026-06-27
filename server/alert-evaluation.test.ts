import { describe, expect, it } from "vitest";
import { evaluateAlertThreshold, parseAlertNumber } from "./utils/alert-evaluation";

describe("shared alert evaluation contract", () => {
  it("parses formatted alert numbers", () => {
    expect(parseAlertNumber("72,660")).toBe(72660);
    expect(parseAlertNumber("$1,234.50")).toBe(1234.5);
    expect(parseAlertNumber("  -42.25% ")).toBe(-42.25);
  });

  it("fails closed for invalid current values or thresholds", () => {
    expect(evaluateAlertThreshold({ currentValue: undefined, thresholdValue: 10, condition: "below" }).triggered).toBe(false);
    expect(evaluateAlertThreshold({ currentValue: "", thresholdValue: 10, condition: "below" }).triggered).toBe(false);
    expect(evaluateAlertThreshold({ currentValue: "9", thresholdValue: undefined, condition: "below" }).triggered).toBe(false);
    expect(evaluateAlertThreshold({ currentValue: "not available", thresholdValue: 10, condition: "below" }).triggered).toBe(false);
  });

  it("evaluates below, above, and equals conditions consistently", () => {
    expect(evaluateAlertThreshold({ currentValue: "9", thresholdValue: "10", condition: "below" }).triggered).toBe(true);
    expect(evaluateAlertThreshold({ currentValue: "11", thresholdValue: "10", condition: "above" }).triggered).toBe(true);
    expect(evaluateAlertThreshold({ currentValue: "10.004", thresholdValue: "10", condition: "equals" }).triggered).toBe(true);
    expect(evaluateAlertThreshold({ currentValue: "10.02", thresholdValue: "10", condition: "equals" }).triggered).toBe(false);
  });

  it("evaluates ROAS alert thresholds as ratio values, not percent-scaled values", () => {
    expect(evaluateAlertThreshold({ currentValue: "2.5", thresholdValue: "3.0", condition: "below" }).triggered).toBe(true);
    expect(evaluateAlertThreshold({ currentValue: "250", thresholdValue: "3.0", condition: "below" }).triggered).toBe(false);
  });
});
