import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import {
  assertValidGA4KPIUpdate,
  createActiveCanonicalGA4KPI,
  findActiveCanonicalGA4KPIConflict,
  GA4_KPI_ACTIVE_METRIC_CONFLICT,
  GA4_KPI_INVALID_CONFIGURATION,
  stripSourceComputedGA4KPIEditValue,
  updateCanonicalGA4KPI,
  type GA4KpiCreateCandidate,
} from "./utils/ga4-kpi-create-guard";

type TestRow = GA4KpiCreateCandidate & { id: string; ownerId?: string };
const resolveMetric = (row: TestRow) => resolveGA4KpiMetricIdentity(row.metric, row.name);

const createPersistence = (initialRows: TestRow[] = [], campaignIds = ["campaign-a", "campaign-b"]) => {
  const rows = [...initialRows];
  const lockTails = new Map<string, Promise<void>>();
  let sequence = rows.length;

  const persistence = {
    withTransaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
      const tx = { releases: [] as Array<() => void> };
      try {
        return await run(tx);
      } finally {
        for (const release of tx.releases.reverse()) release();
      }
    },
    lockCampaign: async (tx: unknown, campaignId: string): Promise<boolean> => {
      const previous = lockTails.get(campaignId) || Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>((resolve) => { release = resolve; });
      lockTails.set(campaignId, previous.then(() => current));
      await previous;
      (tx as { releases: Array<() => void> }).releases.push(release);
      return campaignIds.includes(campaignId);
    },
    listCampaignGA4KPIs: async (_tx: unknown, campaignId: string) =>
      rows.filter((row) => row.campaignId === campaignId && row.platformType === "google_analytics"),
    insert: async (_tx: unknown, input: GA4KpiCreateCandidate): Promise<TestRow> => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      const row = { ...input, id: `created-${++sequence}` } as TestRow;
      rows.push(row);
      return row;
    },
    getById: async (_tx: unknown, id: string) => rows.find((row) => row.id === id),
    update: async (_tx: unknown, id: string, update: Record<string, unknown>) => {
      const index = rows.findIndex((row) => row.id === id);
      if (index < 0) return undefined;
      await new Promise((resolve) => setTimeout(resolve, 2));
      rows[index] = { ...rows[index], ...update } as TestRow;
      return rows[index];
    },
  };

  return { persistence, rows };
};

const revenueCandidate = (campaignId = "campaign-a", overrides: Partial<TestRow> = {}) => ({
  campaignId,
  platformType: "google_analytics",
  metric: "revenue",
  name: "Revenue",
  status: "tracking",
  ...overrides,
});

describe("GA4 KPI canonical create uniqueness", () => {
  it("rejects invalid GA4 target, unit, and alert edits before persistence", () => {
    const revenue = revenueCandidate("campaign-a", { targetValue: "100", unit: "USD", alertsEnabled: false });
    expect(() => assertValidGA4KPIUpdate(revenue, { targetValue: "0" }, "USD"))
      .toThrow("Target value must be greater than 0.");
    expect(() => assertValidGA4KPIUpdate(revenue, { unit: "%" }, "USD"))
      .toThrow("Unit does not match the KPI metric or campaign currency.");
    expect(() => assertValidGA4KPIUpdate(revenue, { alertCondition: "Above" }, "USD"))
      .toThrow("Alert condition must be below, above, or equals.");
    expect(() => assertValidGA4KPIUpdate(revenue, { alertsEnabled: true, alertThreshold: null }, "USD"))
      .toThrow("An enabled alert requires a valid threshold value.");
  });

  it("enforces percentage and count bounds without rejecting unchanged legacy custom units", () => {
    const rate = revenueCandidate("campaign-a", { metric: "conversionRate", name: "Conversion Rate", targetValue: "10", unit: "%" });
    expect(() => assertValidGA4KPIUpdate(rate, { targetValue: "101" }, "USD"))
      .toThrow("Target value cannot exceed 100% for percentage rate KPIs.");
    const count = revenueCandidate("campaign-a", { metric: "sessions", name: "Sessions", targetValue: "100", unit: "count" });
    expect(() => assertValidGA4KPIUpdate(count, { targetValue: "1.5" }, "USD"))
      .toThrow("Count KPI targets must be whole numbers.");
    const roi = revenueCandidate("campaign-a", { metric: "roi", name: "ROI", targetValue: "10", unit: "%", alertsEnabled: true });
    expect(() => assertValidGA4KPIUpdate(roi, { alertThreshold: "-25" }, "USD")).not.toThrow();
    const custom = revenueCandidate("campaign-a", { metric: "__custom__", name: "Pipeline", targetValue: "100", unit: "leads" });
    expect(() => assertValidGA4KPIUpdate(custom, { description: "Updated" }, "USD")).not.toThrow();
    try {
      assertValidGA4KPIUpdate(custom, { unit: "visits" }, "USD");
      throw new Error("Expected invalid custom unit");
    } catch (error) {
      expect(error).toMatchObject({ code: GA4_KPI_INVALID_CONFIGURATION });
    }
  });

  it("preserves scheduler-owned current values on standard GA4 edits only", () => {
    const update = { currentValue: "0", targetValue: "200" };
    expect(stripSourceComputedGA4KPIEditValue(revenueCandidate(), update)).toEqual({ targetValue: "200" });
    expect(stripSourceComputedGA4KPIEditValue(revenueCandidate(), { metric: undefined, currentValue: "0" })).toEqual({ metric: undefined });
    expect(stripSourceComputedGA4KPIEditValue(revenueCandidate("campaign-a", { metric: "__custom__", name: "Pipeline" }), update)).toEqual(update);
    expect(stripSourceComputedGA4KPIEditValue(revenueCandidate("campaign-a", { platformType: "linkedin" }), update)).toEqual(update);
  });

  it("creates the first active canonical KPI", async () => {
    const { persistence, rows } = createPersistence();
    await expect(createActiveCanonicalGA4KPI(revenueCandidate(), persistence)).resolves.toMatchObject({ metric: "revenue" });
    expect(rows).toHaveLength(1);
  });

  it("rejects an edit that would duplicate another canonical KPI", async () => {
    const { persistence, rows } = createPersistence([
      { ...revenueCandidate(), id: "revenue" },
      { ...revenueCandidate("campaign-a", { metric: "sessions", name: "Sessions" }), id: "sessions" },
    ]);
    await expect(updateCanonicalGA4KPI("sessions", { metric: "Total Revenue", name: "Total Revenue" }, persistence))
      .rejects.toMatchObject({ code: GA4_KPI_ACTIVE_METRIC_CONFLICT, canonicalMetric: "revenue" });
    expect(rows.find((row) => row.id === "sessions")).toMatchObject({ metric: "sessions", name: "Sessions" });
  });

  it("allows same-row aliases and keeps edits independent across campaigns", async () => {
    const { persistence, rows } = createPersistence([
      { ...revenueCandidate("campaign-a"), id: "campaign-a-revenue" },
      { ...revenueCandidate("campaign-b", { metric: "sessions", name: "Sessions" }), id: "campaign-b-sessions" },
    ]);
    await expect(updateCanonicalGA4KPI("campaign-a-revenue", { metric: "Total Revenue" }, persistence)).resolves.toBeDefined();
    await expect(updateCanonicalGA4KPI("campaign-b-sessions", { metric: "Revenue", name: "Revenue" }, persistence)).resolves.toBeDefined();
    expect(rows.filter((row) => resolveMetric(row) === "revenue")).toHaveLength(2);
  });

  it("serializes concurrent edits so exactly one can claim a canonical metric", async () => {
    const { persistence, rows } = createPersistence([
      { ...revenueCandidate("campaign-a", { metric: "__custom__", name: "Pipeline A" }), id: "custom-a" },
      { ...revenueCandidate("campaign-a", { metric: "__custom__", name: "Pipeline B" }), id: "custom-b" },
    ]);
    const results = await Promise.allSettled([
      updateCanonicalGA4KPI("custom-a", { metric: "Revenue", name: "Revenue" }, persistence),
      updateCanonicalGA4KPI("custom-b", { metric: "totalRevenue", name: "Total Revenue" }, persistence),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(rows.filter((row) => resolveMetric(row) === "revenue")).toHaveLength(1);
  });

  it("rejects a duplicate active canonical KPI with the conflict code", async () => {
    const { persistence } = createPersistence([{ ...revenueCandidate(), id: "existing" }]);
    await expect(createActiveCanonicalGA4KPI(revenueCandidate(), persistence)).rejects.toMatchObject({
      code: GA4_KPI_ACTIVE_METRIC_CONFLICT,
      canonicalMetric: "revenue",
    });
  });

  it("treats legacy metric aliases as the same canonical metric", async () => {
    const { persistence } = createPersistence([{
      ...revenueCandidate(),
      id: "legacy-revenue",
      metric: "totalRevenue",
      name: "Total Revenue",
    }]);
    await expect(createActiveCanonicalGA4KPI(revenueCandidate("campaign-a", { metric: "Total Revenue" }), persistence))
      .rejects.toMatchObject({ code: GA4_KPI_ACTIVE_METRIC_CONFLICT });
  });

  it("keeps the same metric independent across campaigns owned by different users", async () => {
    const { persistence, rows } = createPersistence([{
      ...revenueCandidate("campaign-a"),
      id: "owner-a-revenue",
      ownerId: "owner-a",
    }]);
    await expect(createActiveCanonicalGA4KPI(
      revenueCandidate("campaign-b", { ownerId: "owner-b" } as Partial<TestRow>),
      persistence,
    )).resolves.toMatchObject({ campaignId: "campaign-b" });
    expect(rows.filter((row) => row.metric === "revenue")).toHaveLength(2);
  });

  it("allows creation after deletion and when only inactive rows remain", async () => {
    const { persistence, rows } = createPersistence([{
      ...revenueCandidate(),
      id: "inactive-revenue",
      status: "inactive",
    }]);
    await expect(createActiveCanonicalGA4KPI(revenueCandidate(), persistence)).resolves.toBeDefined();
    expect(rows.filter((row) => row.status !== "inactive")).toHaveLength(1);

    const deletedPersistence = createPersistence([]);
    await expect(createActiveCanonicalGA4KPI(revenueCandidate(), deletedPersistence.persistence)).resolves.toBeDefined();
  });

  it("allows inactive creation without competing with an active row", async () => {
    expect(findActiveCanonicalGA4KPIConflict(
      revenueCandidate("campaign-a", { status: "inactive" }),
      [{ ...revenueCandidate(), id: "active-revenue" }],
    )).toBeUndefined();
  });

  it("serializes concurrent creates so exactly one succeeds", async () => {
    const { persistence, rows } = createPersistence();
    const results = await Promise.allSettled([
      createActiveCanonicalGA4KPI(revenueCandidate(), persistence),
      createActiveCanonicalGA4KPI(revenueCandidate(), persistence),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    expect(rejected?.reason).toMatchObject({ code: GA4_KPI_ACTIVE_METRIC_CONFLICT });
    expect(rows.filter((row) => row.status !== "inactive")).toHaveLength(1);
  });

  it("keeps ownership denial ahead of storage and maps conflicts to a user-facing 409", () => {
    const routes = readFileSync("server/routes-oauth.ts", "utf8");
    const accessGuard = routes.slice(
      routes.indexOf("const ensureCampaignAccess = async"),
      routes.indexOf("async function requireCampaignAccessParamId"),
    );
    const createRoute = routes.slice(
      routes.indexOf('app.post("/api/platforms/:platformType/kpis"'),
      routes.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"'),
    );
    const updateRoute = routes.slice(
      routes.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"'),
      routes.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"'),
    );
    expect(accessGuard).toContain('const ownerId = String((campaign as any).ownerId || "").trim()');
    expect(accessGuard).toContain("if (ownerId !== actorId)");
    expect(accessGuard).toContain('res.status(404).json({ success: false, message: "Campaign not found" })');
    expect(createRoute.indexOf("ensureCampaignAccess")).toBeLessThan(createRoute.indexOf("storage.createKPI"));
    expect(createRoute).toContain("(error as any)?.code === GA4_KPI_ACTIVE_METRIC_CONFLICT");
    expect(createRoute).toContain('res.status(409).json({ code: (error as any).code, message: (error as Error).message })');
    expect(updateRoute.indexOf("stripSourceComputedGA4KPIEditValue")).toBeLessThan(updateRoute.indexOf("storage.updateKPI"));
    expect(updateRoute).toContain('if (typeof validated[key] === "undefined") delete validated[key];');
    expect(updateRoute.indexOf("assertValidGA4KPIUpdate")).toBeLessThan(updateRoute.indexOf("storage.updateCanonicalGA4KPI"));
    expect(updateRoute).toContain("storage.updateCanonicalGA4KPI(kpiId, persistenceUpdate)");
    expect(updateRoute).toContain("(error as any)?.code === GA4_KPI_INVALID_CONFIGURATION");
    expect(updateRoute).toContain("(error as any)?.code === GA4_KPI_ACTIVE_METRIC_CONFLICT");

    const storage = readFileSync("server/storage.ts", "utf8");
    const createMethod = storage.slice(storage.indexOf("async createKPI"), storage.indexOf("async updateKPI"));
    const updateMethod = storage.slice(storage.indexOf("async updateCanonicalGA4KPI"), storage.indexOf("async deleteKPI"));
    expect(createMethod).toContain('.for("update")');
    expect(createMethod).toContain('eq(kpis.platformType, "google_analytics")');
    expect(createMethod).toContain("eq(kpis.campaignId, id)");
    expect(updateMethod).toContain("updateCanonicalGA4KPIWithGuard");
    expect(updateMethod).toContain('.for("update")');

    const client = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    expect(client).toContain('error?.code === "GA4_KPI_ACTIVE_METRIC_CONFLICT" ? "KPI already exists"');
  });
});
