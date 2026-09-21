import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");

describe("Executive Summary request failure guard", () => {
  it("keeps outcome and trajectory transport failures in React Query error state", () => {
    const outcomeStart = page.indexOf("const executiveOutcomeDateRange");
    const trajectoryStart = page.indexOf("const executiveTrajectoryReportingDate");
    const loadingStart = page.indexOf("if (campaignLoading");
    const outcomeQuery = page.slice(outcomeStart, trajectoryStart);
    const trajectoryQuery = page.slice(trajectoryStart, loadingStart);

    expect(outcomeQuery).toContain("error: outcomeTotalsError");
    expect(outcomeQuery).toContain("if (!resp.ok) throw new Error");
    expect(outcomeQuery).toContain("return resp.json();");
    expect(trajectoryQuery).toContain("error: executiveTrajectoryError");
    expect(trajectoryQuery).toContain("if (!resp.ok) throw new Error");
    expect(trajectoryQuery).toContain("return resp.json();");
  });

  it("blocks rendering when required outcome or trajectory data fails", () => {
    const guardStart = page.indexOf("if (campaignError");
    const currencyStart = page.indexOf("const executiveCurrency", guardStart);
    const guard = page.slice(guardStart, currencyStart);

    expect(guard).toContain("outcomeTotalsError || !outcomeTotals || executiveTrajectoryError");
    expect(guard).toContain("Executive Summary data could not be loaded safely. Please try again.");
    expect(guard).not.toContain("!executiveTrajectoryData");
  });

  it("preserves valid unavailable and incompatible trajectory responses", () => {
    expect(page).toContain('executiveTrajectoryUnavailableReason === "incompatible_history"');
    expect(page).toContain('executiveTrajectoryUnavailableReason === "revenue_history_unavailable"');
    expect(page).toContain("No matching Executive Summary reading exists for seven days earlier yet.");
  });
});
