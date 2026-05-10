import { describe, expect, it } from "vitest";

type Source = {
  id: string;
  sourceType: string;
  isActive?: boolean;
  mappingConfig?: string;
};

type RevenueRow = {
  sourceId: string;
  revenue: number;
  currency?: string;
};

type SpendRow = {
  sourceId: string;
  spend: number;
  currency?: string;
};

function parseConfig(source: Source): any {
  try {
    return source.mappingConfig ? JSON.parse(source.mappingConfig) : null;
  } catch {
    return null;
  }
}

function isEligibleForLatestDayRevenue(source: Source): boolean {
  if (!source || source.isActive === false) return false;
  const sourceType = String(source.sourceType || "").trim().toLowerCase();
  if (sourceType === "manual") return false;
  if (sourceType === "hubspot") {
    const cfg = parseConfig(source);
    const isGa4 = String(cfg?.platformContext || "ga4").trim().toLowerCase() === "ga4";
    if (!isGa4) return false;
    if (cfg?.pipelineEnabled === true) return String(cfg?.dailyMaterialization || "") === "selected_date_field_v1";
    return true;
  }
  if (sourceType === "csv" || sourceType === "google_sheets") {
    const cfg = parseConfig(source);
    return !!String(cfg?.storedDateColumn || cfg?.dateColumn || "").trim();
  }
  return true;
}

function isEligibleForLatestDaySpend(source: Source): boolean {
  if (!source || source.isActive === false) return false;
  const cfg = parseConfig(source);
  return cfg?.testMode !== true;
}

function computeLatestDayRevenue(sources: Source[], rows: RevenueRow[]) {
  const eligibleIds = new Set(sources.filter(isEligibleForLatestDayRevenue).map((source) => source.id));
  const eligibleRows = rows.filter((row) => eligibleIds.has(row.sourceId));
  return {
    totalRevenue: Number(eligibleRows.reduce((sum, row) => sum + Number(row.revenue || 0), 0).toFixed(2)),
    sourceIds: eligibleRows.map((row) => row.sourceId),
  };
}

function computeLatestDaySpend(sources: Source[], rows: SpendRow[]) {
  const eligibleIds = new Set(sources.filter(isEligibleForLatestDaySpend).map((source) => source.id));
  const eligibleRows = rows.filter((row) => eligibleIds.has(row.sourceId));
  return {
    totalSpend: Number(eligibleRows.reduce((sum, row) => sum + Number(row.spend || 0), 0).toFixed(2)),
    sourceIds: eligibleRows.map((row) => row.sourceId),
  };
}

function computeFinancialRevenue(ga4Revenue: number, importedRevenue: number) {
  return Number((Number(ga4Revenue || 0) + Number(importedRevenue || 0)).toFixed(2));
}

function computePerformanceMetrics(revenue: number, spend: number, conversions: number) {
  return {
    profit: Number((revenue - spend).toFixed(2)),
    roas: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
    roi: spend > 0 ? Number((((revenue - spend) / spend) * 100).toFixed(2)) : 0,
    cpa: conversions > 0 ? Number((spend / conversions).toFixed(2)) : 0,
  };
}

describe("GA4 financial rules regression suite", () => {
  it("Latest Day Revenue includes only eligible daily external revenue records", () => {
    const sources: Source[] = [
      { id: "csv-dated", sourceType: "csv", mappingConfig: JSON.stringify({ dateColumn: "date" }) },
      { id: "sheets-snapshot", sourceType: "google_sheets", mappingConfig: JSON.stringify({ dateColumn: "" }) },
      { id: "manual", sourceType: "manual" },
      { id: "hubspot-daily", sourceType: "hubspot", mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true, dailyMaterialization: "selected_date_field_v1" }) },
      { id: "hubspot-snapshot", sourceType: "hubspot", mappingConfig: JSON.stringify({ platformContext: "ga4", pipelineEnabled: true }) },
      { id: "shopify", sourceType: "shopify", mappingConfig: JSON.stringify({ attributionKey: "tags" }) },
      { id: "inactive", sourceType: "csv", isActive: false, mappingConfig: JSON.stringify({ dateColumn: "date" }) },
    ];
    const rows: RevenueRow[] = [
      { sourceId: "csv-dated", revenue: 100.125 },
      { sourceId: "sheets-snapshot", revenue: 200 },
      { sourceId: "manual", revenue: 300 },
      { sourceId: "hubspot-daily", revenue: 400 },
      { sourceId: "hubspot-snapshot", revenue: 500 },
      { sourceId: "shopify", revenue: 600 },
      { sourceId: "inactive", revenue: 700 },
    ];

    expect(computeLatestDayRevenue(sources, rows)).toEqual({
      totalRevenue: 1100.13,
      sourceIds: ["csv-dated", "hubspot-daily", "shopify"],
    });
  });

  it("Latest Day Spend includes real daily spend and excludes ad-platform test-mode spend", () => {
    const sources: Source[] = [
      { id: "csv", sourceType: "csv" },
      { id: "sheets", sourceType: "google_sheets" },
      { id: "linkedin-test", sourceType: "linkedin_ads", mappingConfig: JSON.stringify({ testMode: true }) },
      { id: "meta-real", sourceType: "meta_ads", mappingConfig: JSON.stringify({ testMode: false }) },
      { id: "inactive", sourceType: "google_ads", isActive: false },
    ];
    const rows: SpendRow[] = [
      { sourceId: "csv", spend: 100 },
      { sourceId: "sheets", spend: 200.456 },
      { sourceId: "linkedin-test", spend: 300 },
      { sourceId: "meta-real", spend: 400 },
      { sourceId: "inactive", spend: 500 },
    ];

    expect(computeLatestDaySpend(sources, rows)).toEqual({
      totalSpend: 700.46,
      sourceIds: ["csv", "sheets", "meta-real"],
    });
  });

  it("Total Revenue is GA4 native revenue plus imported revenue", () => {
    expect(computeFinancialRevenue(265727.24, 49200)).toBe(314927.24);
    expect(computeFinancialRevenue(0, 10000)).toBe(10000);
    expect(computeFinancialRevenue(265727.24, 0)).toBe(265727.24);
  });

  it("Pipeline Proxy is excluded from confirmed revenue and derived performance metrics", () => {
    const ga4Revenue = 265727.24;
    const importedRevenue = 10000;
    const pipelineProxy = 8000;
    const spend = 50000;
    const conversions = 2500;
    const confirmedRevenue = computeFinancialRevenue(ga4Revenue, importedRevenue);
    const metrics = computePerformanceMetrics(confirmedRevenue, spend, conversions);

    expect(confirmedRevenue).toBe(275727.24);
    expect(confirmedRevenue).not.toBe(ga4Revenue + importedRevenue + pipelineProxy);
    expect(metrics).toEqual({
      profit: 225727.24,
      roas: 5.51,
      roi: 451.45,
      cpa: 20,
    });
  });

  it("editing a source replaces that source without creating duplicates", () => {
    const sources = [
      { id: "csv-1", total: 100 },
      { id: "shopify-1", total: 300 },
    ];
    const updated = sources.map((source) => source.id === "shopify-1" ? { ...source, total: 500 } : source);

    expect(updated).toHaveLength(2);
    expect(updated.find((source) => source.id === "shopify-1")?.total).toBe(500);
    expect(updated.reduce((sum, source) => sum + source.total, 0)).toBe(600);
  });
});
