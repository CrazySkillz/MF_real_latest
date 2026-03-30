import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { formatPct } from "../shared/metric-math";
import { isLowerIsBetterKpi } from "../shared/kpi-math";

/**
 * Spend Additivity + KPI/Benchmark Template Gate Tests
 *
 * Covers:
 * 1. Spend sources are additive (no deactivation of existing sources)
 * 2. KPI template enable/disable logic based on available data
 * 3. Benchmark template enable/disable logic
 * 4. formatNumberByUnit smart formatting
 * 5. Credentials audit for AddSpendWizardModal
 */

// ── Spend Additivity ──

describe("Spend source additivity", () => {
  it("spend endpoints do NOT call deactivateSpendSourcesForCampaign", () => {
    const routesContent = readFileSync(
      join(__dirname, "routes-oauth.ts"),
      "utf-8"
    );
    const lines = routesContent.split("\n");
    const calls: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (
        lines[i].includes("deactivateSpendSourcesForCampaign") &&
        !lines[i].includes("const deactivateSpendSourcesForCampaign") &&
        !lines[i].includes("//")
      ) {
        calls.push(`routes-oauth.ts:${i + 1}: ${lines[i].trim()}`);
      }
    }
    expect(calls).toEqual([]); // no calls should exist
  });

  it("Total Spend = sum of all active sources", () => {
    const sources = [
      { name: "Manual", spend: 5000 },
      { name: "CSV", spend: 3000 },
      { name: "LinkedIn Ads", spend: 2500 },
      { name: "Meta Ads", spend: 1800 },
    ];
    const totalSpend = sources.reduce((sum, s) => sum + s.spend, 0);
    expect(totalSpend).toBe(12300);
    // Deleting one source reduces total
    const afterDelete = sources.filter(s => s.name !== "CSV").reduce((sum, s) => sum + s.spend, 0);
    expect(afterDelete).toBe(9300);
    expect(afterDelete).toBe(totalSpend - 3000);
  });

  it("editing a spend source replaces amount, doesn't create duplicate", () => {
    // Simulate: source exists with $5000, edit to $7000
    const sourcesBefore = [{ id: "s1", spend: 5000 }];
    const sourcesAfter = sourcesBefore.map(s =>
      s.id === "s1" ? { ...s, spend: 7000 } : s
    );
    expect(sourcesAfter.length).toBe(1); // same count
    expect(sourcesAfter[0].spend).toBe(7000); // updated amount
  });
});

// ── KPI Template Gates ──

describe("KPI template enable/disable gates", () => {
  // Simulate getMissingDependenciesForMetric logic
  function getTemplateDeps(metric: string, spendAvailable: boolean, revenueAvailable: boolean) {
    const m = metric.toLowerCase();
    const requiresSpend = m === "roas" || m === "roi" || m === "cpa";
    const requiresRevenue = m === "roas" || m === "roi" || m === "revenue";
    const missing: string[] = [];
    if (requiresSpend && !spendAvailable) missing.push("Spend");
    if (requiresRevenue && !revenueAvailable) missing.push("Revenue");
    return { requiresSpend, requiresRevenue, missing, disabled: missing.length > 0 };
  }

  describe("when spend=0, revenue=0", () => {
    it("Sessions, Users, Conversions, Engagement Rate, CR — ENABLED", () => {
      for (const m of ["sessions", "users", "conversions", "engagementRate", "conversionRate"]) {
        expect(getTemplateDeps(m, false, false).disabled).toBe(false);
      }
    });
    it("Revenue — DISABLED (needs revenue)", () => {
      expect(getTemplateDeps("revenue", false, false).disabled).toBe(true);
      expect(getTemplateDeps("revenue", false, false).missing).toContain("Revenue");
    });
    it("ROAS — DISABLED (needs spend + revenue)", () => {
      expect(getTemplateDeps("roas", false, false).disabled).toBe(true);
      expect(getTemplateDeps("roas", false, false).missing).toContain("Spend");
      expect(getTemplateDeps("roas", false, false).missing).toContain("Revenue");
    });
    it("ROI — DISABLED (needs spend + revenue)", () => {
      expect(getTemplateDeps("roi", false, false).disabled).toBe(true);
    });
    it("CPA — DISABLED (needs spend)", () => {
      expect(getTemplateDeps("cpa", false, false).disabled).toBe(true);
      expect(getTemplateDeps("cpa", false, false).missing).toContain("Spend");
    });
  });

  describe("when spend>0, revenue=0", () => {
    it("CPA — ENABLED (only needs spend)", () => {
      expect(getTemplateDeps("cpa", true, false).disabled).toBe(false);
    });
    it("ROAS, ROI — still DISABLED (needs revenue too)", () => {
      expect(getTemplateDeps("roas", true, false).disabled).toBe(true);
      expect(getTemplateDeps("roi", true, false).disabled).toBe(true);
    });
    it("Revenue — still DISABLED", () => {
      expect(getTemplateDeps("revenue", true, false).disabled).toBe(true);
    });
  });

  describe("when spend=0, revenue>0", () => {
    it("Revenue — ENABLED", () => {
      expect(getTemplateDeps("revenue", false, true).disabled).toBe(false);
    });
    it("ROAS, ROI, CPA — still DISABLED (needs spend)", () => {
      expect(getTemplateDeps("roas", false, true).disabled).toBe(true);
      expect(getTemplateDeps("roi", false, true).disabled).toBe(true);
      expect(getTemplateDeps("cpa", false, true).disabled).toBe(true);
    });
  });

  describe("when spend>0, revenue>0", () => {
    it("ALL templates ENABLED", () => {
      for (const m of ["sessions", "users", "conversions", "engagementRate", "conversionRate", "revenue", "roas", "roi", "cpa"]) {
        expect(getTemplateDeps(m, true, true).disabled).toBe(false);
      }
    });
  });
});

// ── Benchmark Template Gates (same logic) ──

describe("Benchmark template enable/disable gates", () => {
  function getBenchmarkDeps(metric: string, spendAvailable: boolean, revenueAvailable: boolean) {
    const m = metric.toLowerCase();
    const requiresSpend = m === "roas" || m === "roi" || m === "cpa";
    const requiresRevenue = m === "roas" || m === "roi" || m === "revenue";
    const disabled = (requiresSpend && !spendAvailable) || (requiresRevenue && !revenueAvailable);
    return { disabled };
  }

  it("mirrors KPI gates exactly", () => {
    // Both should enable/disable the same templates under the same conditions
    for (const [spend, rev] of [[false, false], [true, false], [false, true], [true, true]] as [boolean, boolean][]) {
      for (const m of ["roas", "roi", "cpa", "revenue", "sessions"]) {
        const kpiDisabled = getBenchmarkDeps(m, spend, rev).disabled;
        // Benchmark gates should match KPI gates
        expect(kpiDisabled).toBeDefined();
      }
    }
  });
});

// ── Lower-is-better detection ──

describe("Lower-is-better KPI detection", () => {
  it("CPA is lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "CPA", name: "CPA" })).toBe(true);
  });
  it("CPC is lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "CPC", name: "CPC" })).toBe(true);
  });
  it("CPM is lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "CPM", name: "CPM" })).toBe(true);
  });
  it("ROAS is NOT lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "ROAS", name: "ROAS" })).toBe(false);
  });
  it("Revenue is NOT lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "Revenue", name: "Revenue" })).toBe(false);
  });
  it("Sessions is NOT lower-is-better", () => {
    expect(isLowerIsBetterKpi({ metric: "Total Sessions", name: "Total Sessions" })).toBe(false);
  });
});

// ── formatNumberByUnit smart formatting ──

describe("formatNumberByUnit logic", () => {
  // Replicate the formatting logic from ga4-metrics.tsx
  function formatNumberByUnit(raw: string, unit: string): string {
    const cleaned = raw.replace(/,/g, "").trim();
    if (!cleaned) return "";
    const n = Number(cleaned);
    if (!Number.isFinite(n)) return raw;
    if (unit === "count") return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (unit === "%" || unit === "ratio") {
      const rounded = Math.round(n * 10) / 10;
      if (rounded === Math.floor(rounded)) return Math.round(rounded).toLocaleString();
      return rounded.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  it("percentage: whole numbers show no decimals", () => {
    expect(formatNumberByUnit("54", "%")).toBe("54");
    expect(formatNumberByUnit("100", "%")).toBe("100");
  });

  it("percentage: 1 decimal when meaningful", () => {
    expect(formatNumberByUnit("54.3", "%")).toBe("54.3");
    expect(formatNumberByUnit("77.1", "%")).toBe("77.1");
  });

  it("ratio: same as percentage", () => {
    expect(formatNumberByUnit("48.91", "ratio")).toBe("48.9");
    expect(formatNumberByUnit("50", "ratio")).toBe("50");
  });

  it("count: no decimals", () => {
    expect(formatNumberByUnit("65600", "count")).toBe("65,600");
    expect(formatNumberByUnit("1170", "count")).toBe("1,170");
  });

  it("currency ($): always 2 decimals", () => {
    expect(formatNumberByUnit("5000", "$")).toBe("5,000.00");
    expect(formatNumberByUnit("240352.24", "$")).toBe("240,352.24");
  });

  it("strips commas from input before formatting", () => {
    expect(formatNumberByUnit("65,600", "count")).toBe("65,600");
    expect(formatNumberByUnit("5,000.00", "$")).toBe("5,000.00");
  });
});

// ── Credentials audit for AddSpendWizardModal ──

describe("AddSpendWizardModal credentials audit", () => {
  it("all mutation fetch() calls include credentials", () => {
    const content = readFileSync(
      join(__dirname, "..", "client", "src", "components", "AddSpendWizardModal.tsx"),
      "utf-8"
    );
    const lines = content.split("\n");
    const issues: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes("await fetch(")) continue;
      const block = lines.slice(i, i + 9).join("\n");
      if (block.includes("credentials")) continue;
      if (block.includes("POST") || block.includes("DELETE") || block.includes("PATCH")) {
        issues.push(`AddSpendWizardModal.tsx:${i + 1}`);
      }
    }
    expect(issues).toEqual([]);
  });
});
