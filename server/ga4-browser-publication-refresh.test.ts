import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExpectedScheduledRefreshAt, getReportingDateWindow, resolveGA4RefreshStatus } from "./utils/reporting-timezone";

// Exercise the installed query observer's browser timers, with no DOM/provider/server.
vi.hoisted(() => { (globalThis as any).window = {}; });
import { QueryClient, QueryObserver, focusManager, isCancelledError } from "@tanstack/react-query";

const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const routes = readFileSync("server/routes-oauth.ts", "utf8");
const scheduler = readFileSync("server/ga4-daily-scheduler.ts", "utf8");
const compile = (source: string, bindings: Record<string, any>) => new Function(...Object.keys(bindings), ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)(...Object.values(bindings));
const deferred = () => {
  let resolve!: (value: any) => void; let reject!: (error: Error) => void;
  const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

async function statusRoute(overrides: Record<string, any> = {}, query: any = {}) {
  const start = routes.indexOf('app.get("/api/campaigns/:id/ga4-daily",');
  const end = routes.indexOf('// Insights Trends', start);
  let handler: any;
  const storage = {
    getGA4Connection: vi.fn(async () => ({ campaignId: "a", propertyId: "123", isActive: true, method: "access_token" })),
    getGA4PublicationVersion: vi.fn(async () => "v1"),
    getExecutiveSummaryDailyComparisonData: vi.fn(async () => ({ current: { notes: "ga4_aligned_refresh_v1:2026-10-17:2026-10-18T12:10:00.000Z" } })),
  };
  const bindings = {
    app: { get: (_path: any, callback: any) => { handler = callback; } },
    ensureCampaignAccess: vi.fn(async () => ({ id: "a", ownerId: "owner-a", reportingTimeZone: "Europe/Amsterdam" })),
    storage, getReportingDateWindow, getExpectedScheduledRefreshAt, resolveGA4RefreshStatus,
    getGA4DailySchedulerConfig: () => ({ reportingTimeZone: "Europe/Amsterdam", hour: 8, hours: [8, 14, 20], minute: 0 }),
    getGA4DailyRefreshAttempt: () => null,
    parseGA4AlignedRefreshMarker: compile(scheduler.slice(scheduler.indexOf("export function parseGA4AlignedRefreshMarker"), scheduler.indexOf("export async function getGA4AlignedRefreshState")).replace("export ", "") + "return parseGA4AlignedRefreshMarker;", { GA4_ALIGNED_REFRESH_MARKER_PREFIX: "ga4_aligned_refresh_v1:" }),
    isYesopMockProperty: (id: string) => id === "yesop",
    isSupportedGA4ConnectionMethod: (method: string) => ["access_token", "service_account"].includes(method),
    ...overrides,
  };
  compile(routes.slice(start, end), bindings);
  const response: any = { statusCode: 200, setHeader: vi.fn(), status(code: number) { this.statusCode = code; return this; }, json(value: any) { this.body = value; return this; } };
  await handler({ params: { id: "a" }, query: { statusOnly: "1", propertyId: "123", ...query } }, response);
  return { response, bindings };
}

function browser(client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity, gcTime: Infinity } } })) {
  const receipt = { current: { scope: "", token: "", pending: false } };
  let state = { scope: "", pending: false, failed: false };
  let queryOptions: any; let effect: any;
  let completionResult: any;
  const block = page.slice(page.indexOf("  const ga4PublicationScope ="), page.indexOf("  const deriveBenchmarkCategoryFromMetric"));
  const render = (status: any = { campaignId: "a", propertyId: "123", publicationToken: "p1" }, error = false, campaignId = "a", property = "123") => {
    const values = compile(block + "return { isGA4PublicationQuery, isGA4InsightsContextQuery, ga4InsightsContextFetching, ga4PublicationDisplayPending, ga4PublicationDisplayFailed };", {
      campaignId, selectedGA4PropertyId: property, ga4ConnectionUsable: true, queryClient: client, isCancelledError,
      platformKPIs: [{ id: "k-a" }], benchmarks: [{ id: "b-a" }],
      useQuery: (options: any) => { queryOptions = options; return { data: status, dataUpdatedAt: Date.now(), isError: error, refetch: async () => completionResult || ({ data: status, isError: error }) }; },
      useRef: () => receipt,
      useState: () => [state, (value: typeof state) => { state = value; }],
      useEffect: (callback: any) => { effect = callback; },
      useIsFetching: (filter: any) => client.isFetching(filter),
      fetch: (...args: any[]) => (globalThis.fetch as any)(...args),
    });
    return { ...values, effect, queryOptions };
  };
  return { client, render, receipt, set completionResult(value: any) { completionResult = value; }, get state() { return state; } };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); focusManager.setFocused(true); });

describe("GA4 lightweight publication status", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-18T12:20:00Z")); });
  it("reads only the authorized campaign's persisted receipt, without metrics or provider calls", async () => {
    const { response, bindings } = await statusRoute();
    expect(response.statusCode).toBe(200);
    expect(response.body).toMatchObject({ success: true, campaignId: "a", propertyId: "123" });
    expect(JSON.parse(response.body.publicationToken)).toEqual(["2026-10-17", "2026-10-18T12:10:00.000Z", "v1"]);
    expect(bindings.storage.getGA4PublicationVersion).toHaveBeenCalledTimes(2);
    expect(bindings.storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("a", "2026-10-17", "2026-10-17");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(Object.keys(response.body)).not.toContain("data");
  });
  it("stops at the campaign access guard", async () => {
    const { bindings, response } = await statusRoute({ ensureCampaignAccess: async () => null });
    expect(bindings.storage.getGA4Connection).not.toHaveBeenCalled();
    expect(response.body).toBeUndefined();
  });
  it.each([null, { campaignId: "other", method: "access_token" }, { campaignId: "a", isActive: false, method: "access_token" }, { campaignId: "a", method: "unknown" }])("rejects missing/ineligible property connections: %j", async connection => {
    const { response } = await statusRoute({ storage: { getGA4Connection: async () => connection } });
    expect(response.statusCode).toBe(404);
  });
  it.each(["", "yesop", "123x"])("never publishes a simulated or invalid property receipt: %s", async propertyId => {
    const { response } = await statusRoute({}, { propertyId });
    expect(response.statusCode).toBe(404);
  });
  it("does not announce a partial publication", async () => {
    const { response } = await statusRoute({ parseGA4AlignedRefreshMarker: () => null });
    expect(response.body.publicationToken).toBeNull();
  });
  it("rejects a receipt read across a concurrent publication", async () => {
    const { response } = await statusRoute({ storage: {
      getGA4Connection: async () => ({ campaignId: "a", method: "access_token" }),
      getGA4PublicationVersion: vi.fn().mockResolvedValueOnce("v1").mockResolvedValueOnce("v2"),
      getExecutiveSummaryDailyComparisonData: async () => ({ current: { notes: "ga4_aligned_refresh_v1:2026-10-17:2026-10-18T12:10:00.000Z" } }),
    } });
    expect(response.body.publicationToken).toBeNull();
  });
  it("does not mistake queued work for a running or completed publication", async () => {
    const { response } = await statusRoute({ storage: {
      getGA4Connection: async () => ({ campaignId: "a", method: "access_token" }),
      getGA4PublicationVersion: async () => { throw new Error("GA4_REFRESH_PUBLICATION_BUSY"); },
    } });
    expect(response.body).toMatchObject({ publicationToken: null, refreshStatus: "delayed" });
  });
  it("returns a failed read instead of treating database failure as no new publication", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { response } = await statusRoute({ parseGA4AlignedRefreshMarker: () => { throw new Error("database unavailable"); } });
    expect(response.statusCode).toBe(500);
    expect(response.body.success).toBe(false);
  });
  it.each(["", "ga4_aligned_refresh_v1:2026-10-16:2026-10-18T12:10:00Z", "ga4_aligned_refresh_v1:2026-10-17:invalid"])("rejects absent/wrong-day/malformed markers: %s", async notes => {
    const { response } = await statusRoute({ storage: {
      getGA4Connection: async () => ({ campaignId: "a", method: "access_token" }), getGA4PublicationVersion: async () => "v1",
      getExecutiveSummaryDailyComparisonData: async () => ({ current: { notes } }),
    } });
    expect(response.body.publicationToken).toBeNull();
  });
  it("does not mark the new day overdue before its first scheduled run", async () => {
    vi.setSystemTime(new Date("2026-10-18T05:00:00Z"));
    const { response } = await statusRoute({ parseGA4AlignedRefreshMarker: () => null });
    expect(response.body.refreshStatus).toBe("pending");
  });
  it.each(["running", "failed"])("preserves the selected property's %s attempt", async status => {
    const { response } = await statusRoute({ getGA4DailyRefreshAttempt: () => ({ reportingDate: "2026-10-17", status, startedAt: "2026-10-18T12:15:00Z", finishedAt: status === "failed" ? "2026-10-18T12:16:00Z" : null }) });
    expect(response.body.refreshStatus).toBe(status);
  });
  it("does not consult another campaign's process-local running flag", async () => {
    (globalThis as any).__ga4DailyRefreshInProgress = true;
    try { expect((await statusRoute()).response.body.publicationToken).toBeTruthy(); }
    finally { delete (globalThis as any).__ga4DailyRefreshInProgress; }
  });
});

describe("GA4 browser publication coordination", () => {
  it("selects only exact campaign/property queries, definitions and their analytics", () => {
    const view = browser(); const { isGA4PublicationQuery: selected } = view.render();
    const yes = [
      ["/api/campaigns", "a", "ga4-daily", 30, "123"], ["/api/campaigns", "a", "ga4-insights-daily", 60, "123"],
      ...["ga4-breakdown", "ga4-ad-comparison-breakdown", "ga4-landing-pages", "ga4-conversion-events"].map(name => ["/api/campaigns", "a", name, "import-to-date", "123"]),
      ["/api/campaigns", "a", "financial-daily-snapshot", "2026-10-17"], ["/api/campaigns/a/ga4-to-date", "123"],
      ...["kpis", "benchmarks", "reports"].map(name => [`/api/platforms/google_analytics/${name}`, "a"]),
      ["/api/kpis", "k-a", "analytics", "30d", "123"], ["/api/benchmarks", "b-a", "analytics", "123"],
      ["/api/campaigns/a/revenue-sources"], ["/api/campaigns/a/spend-breakdown?platformContext=ga4"],
    ];
    const no = [
      ["/api/campaigns", "other", "ga4-daily", 30, "123"], ["/api/campaigns", "a", "ga4-daily", 30, "999"],
      ["/api/campaigns", "a", "ga4-publication-status", "123"], ["/api/campaigns", "a", "ga4-diagnostics", "30days", "123"],
      ["/api/platforms/google_analytics/kpis", "other"], ["/api/platforms/linkedin/kpis", "a"],
      ["/api/kpis", "other", "analytics", "30d", "123"], ["/api/benchmarks", "b-a", "analytics", "999"],
      ["/api/campaigns/ab/revenue-sources"], ["/api/campaigns/a/spend-breakdown?platformContext=linkedin"], ["/api/notifications"],
    ];
    yes.forEach(queryKey => expect(selected({ queryKey }), JSON.stringify(queryKey)).toBe(true));
    no.forEach(queryKey => expect(selected({ queryKey }), JSON.stringify(queryKey)).toBe(false));
    view.client.clear();
  });
  it("refreshes active queries once per receipt, retains old values while pending and marks inactive data stale", async () => {
    const view = browser(); const key = ["/api/campaigns", "a", "ga4-daily", 30, "123"];
    const response = deferred(); const fetchData = vi.fn(() => response.promise);
    view.client.setQueryData(key, { sessions: 2977 });
    const inactive = ["/api/platforms/google_analytics/benchmarks", "a"];
    view.client.setQueryData(inactive, [{ id: "b-a" }]);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: fetchData });
    const stop = observer.subscribe(() => {});
    try {
      view.render().effect(); view.render().effect();
      expect(fetchData).toHaveBeenCalledTimes(1);
      expect(view.client.getQueryData(key)).toEqual({ sessions: 2977 });
      expect(view.client.getQueryState(inactive)?.isInvalidated).toBe(true);
      expect(view.render().ga4PublicationDisplayPending).toBe(true);
      response.resolve({ sessions: 3000 });
      await vi.waitFor(() => expect(view.state.pending).toBe(false));
      view.render().effect();
      expect(fetchData).toHaveBeenCalledTimes(1);
      expect(view.client.getQueryData(key)).toEqual({ sessions: 3000 });
    } finally { stop(); view.client.clear(); }
  });
  it("retains cached data on failure and retries on the next status check", async () => {
    const view = browser(); const key = ["/api/platforms/google_analytics/kpis", "a"];
    view.client.setQueryData(key, [{ currentValue: 2977 }]);
    const fetchData = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([{ currentValue: 3000 }]);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: fetchData }); const stop = observer.subscribe(() => {});
    try {
      view.render().effect(); await vi.waitFor(() => expect(view.state.failed).toBe(true));
      expect(view.client.getQueryData(key)).toEqual([{ currentValue: 2977 }]);
      expect(view.render().ga4PublicationDisplayFailed).toBe(true);
      view.render().effect(); await vi.waitFor(() => expect(view.state.failed).toBe(false));
      expect(fetchData).toHaveBeenCalledTimes(2);
      expect(view.client.getQueryData(key)).toEqual([{ currentValue: 3000 }]);
    } finally { stop(); view.client.clear(); }
  });
  it.each([1, 3])("waits for the replacement read after %i overlapping source-publication invalidations", async count => {
    const view = browser(), key = ["/api/campaigns", "a", "financial-daily-snapshot", "2026-10-17", "EUR"];
    view.client.setQueryData(key, { revenue: 8003.96 });
    const reads = Array.from({ length: count + 1 }, deferred);
    const fetchData = vi.fn().mockImplementation(() => reads[fetchData.mock.calls.length - 1].promise);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: fetchData }); const stop = observer.subscribe(() => {});
    try {
      view.render().effect();
      for (let index = 0; index < count; index++) {
        void view.client.invalidateQueries({ queryKey: key });
        await vi.waitFor(() => expect(fetchData).toHaveBeenCalledTimes(index + 2));
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(view.state.failed).toBe(false); expect(view.render().ga4PublicationDisplayPending).toBe(true);
      }
      for (const read of reads.slice(0, -1)) read.resolve({ revenue: 1 });
      reads.at(-1)!.resolve({ revenue: 8003.96 });
      await vi.waitFor(() => expect(view.state.pending).toBe(false));
      expect(view.state.failed).toBe(false); expect(view.client.getQueryData(key)).toEqual({ revenue: 8003.96 });
    } finally { stop(); view.client.clear(); }
  });
  it("still replaces an earlier in-flight read when a new publication first arrives", async () => {
    const view = browser(), key = ["/api/campaigns", "a", "financial-daily-snapshot", "2026-10-17", "EUR"];
    const old = deferred(), fresh = deferred();
    view.client.setQueryData(key, { revenue: 8003.96 });
    const fetchData = vi.fn().mockReturnValueOnce(old.promise).mockReturnValue(fresh.promise);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: fetchData }); const stop = observer.subscribe(() => {});
    try {
      void observer.refetch(); view.render().effect();
      await vi.waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
      old.resolve({ revenue: 1 });
      expect(view.render().ga4PublicationDisplayPending).toBe(true);
      fresh.resolve({ revenue: 8003.96 });
      await vi.waitFor(() => expect(view.state.pending).toBe(false));
      expect(view.state.failed).toBe(false); expect(view.client.getQueryData(key)).toEqual({ revenue: 8003.96 });
    } finally { stop(); view.client.clear(); }
  });
  it("does not swallow a real request error whose message happens to say CancelledError", async () => {
    const view = browser(), key = ["/api/platforms/google_analytics/kpis", "a"];
    view.client.setQueryData(key, []);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: async () => { throw new Error("CancelledError"); } });
    const stop = observer.subscribe(() => {});
    try { view.render().effect(); await vi.waitFor(() => expect(view.state.failed).toBe(true)); }
    finally { stop(); view.client.clear(); }
  });
  it.each(["failed replacement", "changed token"])("does not certify a cancelled read followed by %s", async kind => {
    const view = browser(), key = ["/api/campaigns", "a", "financial-daily-snapshot", "2026-10-17", "EUR"];
    const first = deferred(), replacement = deferred();
    view.client.setQueryData(key, { revenue: 8003.96 });
    const fetchData = vi.fn().mockReturnValueOnce(first.promise).mockReturnValue(replacement.promise);
    const observer = new QueryObserver(view.client, { queryKey: key, queryFn: fetchData }); const stop = observer.subscribe(() => {});
    try {
      view.render().effect(); void view.client.invalidateQueries({ queryKey: key });
      await vi.waitFor(() => expect(fetchData).toHaveBeenCalledTimes(2));
      if (kind === "changed token") { view.completionResult = { data: { publicationToken: "p2" }, isError: false }; replacement.resolve({ revenue: 8003.96 }); }
      else replacement.reject(new Error("real database failure"));
      await vi.waitFor(() => expect(view.receipt.current.token).toBe(""));
      expect(view.state.failed).toBe(kind === "failed replacement");
      expect(view.state.pending).toBe(kind === "changed token");
    } finally { first.resolve({ revenue: 1 }); stop(); view.client.clear(); }
  });
  it.each([
    ["pending new download", true, false, false, null, true],
    ["failed verification", false, true, false, null, true],
    ["verified new download", false, false, false, null, false],
    ["schedule creation", true, false, true, null, false],
    ["schedule edit", true, false, false, "report-a", false],
    ["schedule creation after failed verification", false, true, true, null, false],
    ["schedule edit after failed verification", false, true, false, "report-a", false],
  ])("keeps report controls usable for %s", (_name, pending, failed, scheduled, editing, expected) => {
    const start = page.indexOf("const isGA4ReportSubmitDisabled =") + "const isGA4ReportSubmitDisabled =".length;
    const expression = page.slice(start, page.indexOf(";", start));
    expect(compile("return " + expression, {
      ga4ReportForm: { name: "Report", reportType: "ads", scheduleEnabled: scheduled },
      ga4PublicationDisplayPending: pending, ga4PublicationDisplayFailed: failed, editingGA4ReportId: editing,
      createGA4ReportMutation: { isPending: false }, updateGA4ReportMutation: { isPending: false }, isGA4ReportEditUnchanged: false,
    })).toBe(expected);
  });
  it.each([null, { campaignId: "a", propertyId: "123", publicationToken: null }, { campaignId: "other", propertyId: "123", publicationToken: "p1" }, { campaignId: "a", propertyId: "999", publicationToken: "p1" }])("does not refetch for missing/incomplete/foreign receipts: %j", status => {
    const view = browser(); const invalidate = vi.spyOn(view.client, "invalidateQueries"); view.render(status).effect();
    expect(invalidate).not.toHaveBeenCalled(); view.client.clear();
  });
  it("does not use a retained status token after a failed status request", () => {
    const view = browser(); const invalidate = vi.spyOn(view.client, "invalidateQueries"); view.render(undefined, true).effect();
    expect(invalidate).not.toHaveBeenCalled(); expect(view.render(undefined, true).ga4PublicationDisplayFailed).toBe(true); view.client.clear();
  });
  it.each([null, "p2"])("keeps the display unverified when the receipt changes during reads to %j", async token => {
    const view = browser(); view.completionResult = { data: { publicationToken: token }, isError: false };
    view.render().effect(); await vi.waitFor(() => expect(view.receipt.current.token).toBe(""));
    expect(view.state).toMatchObject({ pending: true, failed: false });
    // Missing/new receipts stay unverified until the next complete publication is read.
    if (token === null) {
      view.render({ campaignId: "a", propertyId: "123", publicationToken: null }).effect();
      expect(view.state).toMatchObject({ pending: true, failed: false });
    }
    const next = { campaignId: "a", propertyId: "123", publicationToken: token || "p1" };
    view.completionResult = { data: next, isError: false };
    view.render(next).effect();
    await vi.waitFor(() => expect(view.state.pending).toBe(false));
    expect(view.state.failed).toBe(false); view.client.clear();
  });
  it("does not let an old campaign's late completion replace the new campaign's receipt", async () => {
    const view = browser(); const pending = deferred();
    let coreRequests = 0;
    const invalidate = vi.spyOn(view.client, "invalidateQueries").mockImplementation((_filters, options) =>
      options?.throwOnError && ++coreRequests === 1 ? pending.promise : Promise.resolve());
    view.render().effect();
    view.render({ campaignId: "b", propertyId: "456", publicationToken: "p2" }, false, "b", "456").effect();
    await vi.waitFor(() => expect(view.receipt.current.pending).toBe(false));
    pending.resolve(undefined); await pending.promise; await Promise.resolve();
    expect(coreRequests).toBe(2); expect(view.receipt.current.scope).toBe(JSON.stringify(["b", "456"]));
    expect(view.state.scope).toBe(JSON.stringify(["b", "456"])); view.client.clear();
  });
  it.each([
    ["ga4-insights-daily", 60, "123"], ["ga4-breakdown", "30daysAgo", "123", true, true, "", "EUR"],
  ])("keeps pending/failed Insights context %j separate from core publication", async (...suffix) => {
    const view = browser(), response = deferred();
    const key = ["/api/campaigns", "a", ...suffix];
    const core = ["/api/campaigns", "a", "ga4-daily", 30, "123"];
    view.client.setQueryData(key, { retained: true }); view.client.setQueryData(core, { sessions: 1 });
    const contextObserver = new QueryObserver(view.client, { queryKey: key, queryFn: () => response.promise });
    const coreObserver = new QueryObserver(view.client, { queryKey: core, queryFn: async () => ({ sessions: 2 }) });
    const stopContext = contextObserver.subscribe(() => {}), stopCore = coreObserver.subscribe(() => {});
    try {
      view.render().effect();
      await vi.waitFor(() => expect(view.state.pending).toBe(false));
      expect(view.render().ga4PublicationDisplayPending).toBe(false);
      expect(view.render().ga4InsightsContextFetching).toBe(1);
      expect(view.client.getQueryData(core)).toEqual({ sessions: 2 });
      expect(view.render().isGA4InsightsContextQuery({ queryKey: core })).toBe(false);
      expect(view.render().isGA4InsightsContextQuery({ queryKey: ["/api/campaigns", "other", ...suffix] })).toBe(false);
      response.reject(new Error("Insights provider unavailable"));
      await vi.waitFor(() => expect(view.client.getQueryState(key)?.status).toBe("error"));
      expect(view.render().ga4PublicationDisplayFailed).toBe(false);
    } finally { stopContext(); stopCore(); view.client.clear(); }
  });
  it("forwards cancellation and rejects mismatched status responses", async () => {
    const view = browser(); const signal = new AbortController().signal;
    const fetchStatus = vi.fn(async () => ({ ok: true, json: async () => ({ success: true, campaignId: "other", propertyId: "123" }) }));
    vi.stubGlobal("fetch", fetchStatus);
    await expect(view.render().queryOptions.queryFn({ signal })).rejects.toThrow("Could not check");
    expect(fetchStatus).toHaveBeenCalledWith(expect.stringContaining("statusOnly=1"), { signal, cache: "no-store" }); view.client.clear();
  });
  it("retains only the same campaign's financial placeholder on reporting-date change", () => {
    const start = page.indexOf("placeholderData:", page.indexOf("data: financialDailySnapshotResp"));
    const end = page.indexOf("staleTime:", start);
    const placeholder = compile("return " + page.slice(start + "placeholderData:".length, end).trim().replace(/,$/, ""), { campaignId: "a", campaignCurrency: "EUR" });
    const previous = { snapshot: { campaignId: "a", reportingDate: "2026-10-17", metrics: { financialDaily: { currency: "EUR" } } } };
    expect(placeholder(previous, { queryKey: ["/api/campaigns", "a", "financial-daily-snapshot", "2026-10-17"] })).toBe(previous);
    expect(placeholder(previous, { queryKey: ["/api/campaigns", "other", "financial-daily-snapshot", "2026-10-17"] })).toBeUndefined();
    expect(placeholder({ snapshot: { campaignId: "other" } }, { queryKey: ["/api/campaigns", "a"] })).toBeUndefined();
    expect(placeholder({ snapshot: { ...previous.snapshot, metrics: { financialDaily: { currency: "USD" } } } }, { queryKey: ["/api/campaigns", "a"] })).toBeUndefined();
  });
  it("disables independent saved-data timers when status checks work, retaining fallback intervals on failure", () => {
    const tree = ts.createSourceFile("page.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let checked = 0;
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "refetchInterval" && node.initializer.getText(tree).includes("ga4PublicationStatus")) {
        const expression = node.initializer.getText(tree);
        const interval = (status: any, error: boolean, activeTab = "overview") => compile("return " + expression, { ga4PublicationStatus: status, ga4PublicationStatusError: error, activeTab });
        expect(interval({ publicationToken: "p1" }, false)).toBe(false);
        expect([300_000, 600_000]).toContain(interval(undefined, false));
        expect([300_000, 600_000]).toContain(interval({ publicationToken: "p1" }, true));
        if (expression.includes("activeTab")) expect(interval({ publicationToken: "p1" }, false, "insights")).toBe(600_000);
        checked++;
      }
      if (ts.isPropertyAssignment(node) && node.name.getText(tree) === "refetchIntervalInBackground") expect(node.initializer.getText(tree)).toBe("false");
      ts.forEachChild(node, visit);
    };
    visit(tree); expect(checked).toBe(6);
    const financialQuery = page.slice(page.indexOf("data: financialDailySnapshotResp"), page.indexOf("const ga4Metrics = useMemo"));
    expect(financialQuery).toContain("refetchInterval: 10 * 60 * 1000");
    expect(financialQuery).toContain("refetchOnWindowFocus: true");
    const toDateQuery = page.slice(page.indexOf("data: ga4ToDateResp"), page.indexOf("const dailySummedTotals"));
    expect(toDateQuery).toContain("refetchInterval: 10 * 60 * 1000");
    expect(toDateQuery).toContain("refetchOnWindowFocus: true");
  });
  it("polls once per 30 seconds in the foreground and pauses hidden polling", async () => {
    vi.useFakeTimers(); focusManager.setFocused(true);
    const view = browser(); const options = view.render().queryOptions;
    const fetchData = vi.fn(async () => ({ publicationToken: "p1" }));
    const observer = new QueryObserver(view.client, { ...options, queryFn: fetchData }); const stop = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(90_000); expect(fetchData).toHaveBeenCalledTimes(4);
      focusManager.setFocused(false); await vi.advanceTimersByTimeAsync(300_000); expect(fetchData).toHaveBeenCalledTimes(4);
      focusManager.setFocused(true); await vi.advanceTimersByTimeAsync(30_000); expect(fetchData).toHaveBeenCalledTimes(5);
    } finally { stop(); view.client.clear(); }
  });
});
