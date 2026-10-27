import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ts from "typescript";
import { getReportingDateWindow, isCreatedThroughReportingDate } from "./utils/reporting-timezone";

const routes = readFileSync("server/routes-oauth.ts", "utf8");
const ga4Page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const revenueModal = readFileSync("client/src/components/AddRevenueWizardModal.tsx", "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 materialized revenue authority", () => {
  it("keeps latest source values separate from completed-day contributions and gates configuration fallback on pending sources", () => {
    const route = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/revenue-sources"',
      "// Unified data-sources endpoint",
    );
    expect(route).toContain('const hasCompletedDayRevenue = totalsBySource.has(sourceId)');
    expect(route).toContain('const hasLatestRevenue = latestTotalsBySource.has(sourceId)');
    expect(route).toContain('const isGa4RevenueSource = platformContext === "ga4"');
    expect(route).toContain('const materializedRevenueAvailable = hasLatestRevenue || (pendingCompletedDay && cfgTotal !== null);');
    expect(route).toContain('? materializedRevenueAvailable ? Number(Number(latestRevenue || 0).toFixed(2)) : null');
    expect(route).toContain('materializedRevenueStatus: materializedRevenueAvailable ? "available" : "unavailable"');
    expect(route).toContain("const latestRevenue = hasLatestRevenue ? Number(latestTotalsBySource.get(sourceId) || 0) : platformContext === 'google_ads' ? 0 : cfgTotal;");
  });

  it("does not add stale HubSpot connection revenue to outcome totals", () => {
    const route = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/outcome-totals"',
      "// New route: Get all GA4 connections",
    );
    expect(route).toContain('const isHubspot = s.type === "hubspot"');
    expect(route).toContain('materializedRevenueSourceTypes.add(String(source?.sourceType || "").trim().toLowerCase())');
    expect(route).toContain('const hubspotMaterialized = isHubspot && materializedRevenueSourceTypes.has("hubspot")');
    expect(route).toContain('const lastTotalRevenue = isHubspot ? hubspotMaterialized ? 0 : null : parseNum(cfg.lastTotalRevenue)');
    expect(route).toContain('materializedRevenueStatus: hubspotMaterialized ? "available" : "unavailable"');
    expect(route).toContain('if (!isHubspot && offsite && Number(lastTotalRevenue) > 0)');
  });

  it("keeps provenance visible but renders the missing value as unavailable", () => {
    expect(ga4Page).toContain('source?.materializedRevenueStatus === "available" && Number.isFinite(Number(source?.lastTotalRevenue))');
    expect(ga4Page).toContain('materializedRevenueUnavailable ? "Unavailable" : formatMoney(latestRevenue)');
    expect(ga4Page).toContain('latestRevenue: getDefinitionRevenue(d)');
    expect(ga4Page).toContain('revenue: getCompletedDayRevenue(d)');
    expect(ga4Page).toContain('const materializedRevenueUnavailable = s.materializedRevenueStatus === "unavailable";');
    expect(ga4Page).toContain('materializedRevenueStatus: s.materializedRevenueStatus');
  });

  it("does not pass stale GA4 configuration revenue into HubSpot edit review", () => {
    expect(revenueModal).toContain('platformContext === "ga4"');
    expect(revenueModal).toContain('sourceToEdit?.materializedRevenueStatus === "available"');
    expect(revenueModal).toContain(': Number.isFinite(Number(config?.lastTotalRevenue)) ? Number(config.lastTotalRevenue)');
  });
});

describe("GA4 Revenue Sources completed-day and latest-value responses", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  // Execute the real handler with simulated storage/access; no copied revenue selection logic.
  async function readSource({ sourceType = "hubspot", createdAt = "2026-10-01T00:00:00.000Z",
    completed = [] as any[], latest = [] as any[], failCompleted = false, failLatest = false } = {}) {
    const source = { id: "source-1", sourceType, createdAt, isActive: true,
      mappingConfig: JSON.stringify({ platformContext: "ga4", lastTotalRevenue: 999 }) };
    const storage = {
      getRevenueSources: vi.fn().mockResolvedValue([source]),
      getGA4RevenuePublicationStatus: vi.fn().mockResolvedValue({ "source-1": { status: "published", hash: "fixture-hash" } }),
      getRevenueBreakdownBySource: vi.fn(async (_campaign, _start, end) => {
        if (end === "2999-12-31") {
          if (failLatest) throw new Error("latest read failed");
          return latest;
        }
        if (failCompleted) throw new Error("completed-day read failed");
        return completed;
      }),
    };
    let handler: any;
    const bindings = {
      app: { get: (_path: string, callback: any) => { handler = callback; } }, storage,
      parseRevenueReadPlatformContext: () => "ga4",
      ensureCampaignAccess: async () => ({ id: "campaign-1", reportingTimeZone: "Europe/Amsterdam" }),
      getReportingDateWindow, isCreatedThroughReportingDate, getShopifyRevenueSourceFreshness: () => undefined,
    };
    const route = sliceBetween(routes, 'app.get("/api/campaigns/:id/revenue-sources"', "// Unified data-sources endpoint");
    new Function(...Object.keys(bindings), ts.transpileModule(route, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText)(...Object.values(bindings));
    const response = { setHeader: vi.fn(), status: vi.fn(), json: vi.fn() };
    response.status.mockReturnValue(response);
    await handler({ params: { id: "campaign-1" }, query: { platformContext: "ga4" } }, response);
    expect(response.status).not.toHaveBeenCalled();
    expect(storage.getRevenueSources).toHaveBeenCalledWith("campaign-1", "ga4");
    expect(storage.getGA4RevenuePublicationStatus).toHaveBeenCalledWith("campaign-1", "2026-10-16");
    expect(storage.getRevenueBreakdownBySource.mock.calls).toEqual([
      ["campaign-1", "1900-01-01", "2026-10-16", "ga4"],
      ["campaign-1", "1900-01-01", "2999-12-31", "ga4"],
    ]);
    return response.json.mock.calls[0][0].sources[0];
  }

  it.each(["csv", "google_sheets", "hubspot"])("keeps an existing %s source unavailable when its records are missing", async (sourceType) => {
    expect(await readSource({ sourceType })).toMatchObject({
      lastTotalRevenue: null, materializedRevenueStatus: "unavailable", completedDayRevenue: 0, pendingCompletedDay: false,
    });
  });

  it.each([0, -25])("preserves authoritative materialized revenue of %s instead of stale configuration revenue", async (revenue) => {
    const rows = [{ sourceId: "source-1", revenue }];
    expect(await readSource({ completed: rows, latest: rows })).toMatchObject({
      lastTotalRevenue: revenue, completedDayRevenue: revenue, materializedRevenueStatus: "available", pendingCompletedDay: false,
    });
  });

  it("returns latest imported revenue separately from the completed-day contribution", async () => {
    expect(await readSource({ completed: [{ sourceId: "source-1", revenue: 150 }], latest: [{ sourceId: "source-1", revenue: 200 }] })).toMatchObject({
      lastTotalRevenue: 200, completedDayRevenue: 150, completedDayEndDate: "2026-10-16", materializedRevenueStatus: "available",
    });
  });

  it.each([{ latest: [] }, { latest: [{ sourceId: "source-1", revenue: 200 }] }])("uses materialized sale dates, not connection dates, for a newly added source (%j)", async ({ latest }) => {
    expect(await readSource({ createdAt: "2026-10-17T08:00:00.000Z", latest })).toMatchObject({
      lastTotalRevenue: latest.length ? 200 : null, completedDayRevenue: 0,
      materializedRevenueStatus: latest.length ? "available" : "unavailable", pendingCompletedDay: latest.length > 0, boundedRevenueZero: latest.length > 0,
    });
  });

  it("includes an older sale immediately even when the source was added today", async () => {
    const rows = [{ sourceId: "source-1", revenue: 250 }];
    expect(await readSource({ createdAt: "2026-10-17T08:00:00.000Z", latest: rows, completed: rows })).toMatchObject({
      lastTotalRevenue: 250, completedDayRevenue: 250, pendingCompletedDay: false, publicationStatus: "published", publicationHash: "fixture-hash",
    });
  });

  it("does not show stale configuration revenue after the latest-record read fails", async () => {
    expect(await readSource({ completed: [{ sourceId: "source-1", revenue: 150 }], failLatest: true })).toMatchObject({
      lastTotalRevenue: null, materializedRevenueStatus: "unavailable", completedDayRevenue: 150, pendingCompletedDay: false,
    });
  });

  it("does not claim a pending source amount when the completed-day boundary read fails", async () => {
    expect(await readSource({ createdAt: "2026-10-17T08:00:00.000Z", failCompleted: true })).toMatchObject({
      lastTotalRevenue: null, materializedRevenueStatus: "unavailable", pendingCompletedDay: false,
    });
  });
});
