import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createActiveCanonicalGA4KPI,
  findActiveCanonicalGA4KPIConflict,
  GA4_KPI_ACTIVE_METRIC_CONFLICT,
  type GA4KpiCreateCandidate,
} from "./utils/ga4-kpi-create-guard";

type TestRow = GA4KpiCreateCandidate & { id: string; ownerId?: string };

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
  it("creates the first active canonical KPI", async () => {
    const { persistence, rows } = createPersistence();
    await expect(createActiveCanonicalGA4KPI(revenueCandidate(), persistence)).resolves.toMatchObject({ metric: "revenue" });
    expect(rows).toHaveLength(1);
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
    expect(accessGuard).toContain('const ownerId = String((campaign as any).ownerId || "").trim()');
    expect(accessGuard).toContain("if (ownerId !== actorId)");
    expect(accessGuard).toContain('res.status(404).json({ success: false, message: "Campaign not found" })');
    expect(createRoute.indexOf("ensureCampaignAccess")).toBeLessThan(createRoute.indexOf("storage.createKPI"));
    expect(createRoute).toContain("(error as any)?.code === GA4_KPI_ACTIVE_METRIC_CONFLICT");
    expect(createRoute).toContain('res.status(409).json({ code: (error as any).code, message: (error as Error).message })');

    const storage = readFileSync("server/storage.ts", "utf8");
    const createMethod = storage.slice(storage.indexOf("async createKPI"), storage.indexOf("async updateKPI"));
    expect(createMethod).toContain('.for("update")');
    expect(createMethod).toContain('eq(kpis.platformType, "google_analytics")');
    expect(createMethod).toContain("eq(kpis.campaignId, id)");

    const client = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
    expect(client).toContain('error?.code === "GA4_KPI_ACTIVE_METRIC_CONFLICT" ? "KPI already exists"');
  });
});
