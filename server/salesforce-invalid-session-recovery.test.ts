import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createSalesforceAuthorizedFetch } from "./utils/salesforce-authorized-fetch";

describe("Salesforce invalid-session recovery", () => {
  it("refreshes and retries exactly once after Salesforce rejects an access token", async () => {
    const requests: string[] = [];
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(new Headers(init?.headers).get("Authorization")));
      return new Response("{}", { status: requests.length === 1 ? 401 : 200 });
    }) as typeof fetch;
    const refreshAccessToken = vi.fn(async (rejectedAccessToken: string) => {
      expect(rejectedAccessToken).toBe("stale-token");
      return "fresh-token";
    });
    const salesforceFetch = createSalesforceAuthorizedFetch({
      accessToken: "stale-token",
      fetchImpl,
      refreshAccessToken,
    });

    const response = await salesforceFetch("https://example.my.salesforce.com/services/data/v59.0/query", {
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(200);
    expect(requests).toEqual(["Bearer stale-token", "Bearer fresh-token"]);
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(new Headers(fetchImpl.mock.calls[1]?.[1]?.headers).get("Content-Type")).toBe("application/json");
  });

  it("does not refresh successful requests or loop after a rejected retry", async () => {
    const successfulFetch = vi.fn(async () => new Response("{}", { status: 200 })) as typeof fetch;
    const unusedRefresh = vi.fn(async () => "fresh-token");
    const successful = createSalesforceAuthorizedFetch({
      accessToken: "valid-token",
      fetchImpl: successfulFetch,
      refreshAccessToken: unusedRefresh,
    });
    await expect(successful("https://example.my.salesforce.com/services/data/v59.0/query")).resolves.toMatchObject({ status: 200 });
    expect(unusedRefresh).not.toHaveBeenCalled();

    const rejectedFetch = vi.fn(async () => new Response("{}", { status: 401 })) as typeof fetch;
    const refreshOnce = vi.fn(async () => "still-rejected-token");
    const rejected = createSalesforceAuthorizedFetch({
      accessToken: "stale-token",
      fetchImpl: rejectedFetch,
      refreshAccessToken: refreshOnce,
    });
    await expect(rejected("https://example.my.salesforce.com/services/data/v59.0/query")).resolves.toMatchObject({ status: 401 });
    expect(rejectedFetch).toHaveBeenCalledTimes(2);
    expect(refreshOnce).toHaveBeenCalledTimes(1);
  });

  it("wires all current Salesforce revenue reads through the authorized fetch", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const start = routes.indexOf("// Salesforce preview: show rows based on saved mappingConfig");
    const end = routes.indexOf("// HubSpot deals properties (for mapping wizard)", start);
    const salesforceRevenueRoutes = routes.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(salesforceRevenueRoutes.match(/fetchImpl: salesforceFetch/g)?.length).toBeGreaterThanOrEqual(10);
    expect(salesforceRevenueRoutes).toContain("await salesforceFetch(`${instanceUrl}/services/data/${version}/sobjects/Opportunity/describe`");
    expect(salesforceRevenueRoutes).toContain("const aggResp = await salesforceFetch(queryUrl");
    expect(salesforceRevenueRoutes).toContain("const pipelineResp = await salesforceFetch(");
    expect(salesforceRevenueRoutes).toContain("const diagResp = await salesforceFetch(url");
    expect(salesforceRevenueRoutes).not.toContain("fetchImpl: ((nextUrl, options) => fetchWithTimeout(String(nextUrl), options)) as typeof fetch");

    const recoveryStart = routes.indexOf("async function getSalesforceAccessTokenForCampaign");
    const recoveryEnd = routes.indexOf("async function getHubspotAccessTokenForCampaign", recoveryStart);
    const recovery = routes.slice(recoveryStart, recoveryEnd);
    expect(recovery).toContain('String(latest.accessToken) !== rejectedAccessToken');
    expect(recovery).toContain("return await refreshSalesforceToken(latest, true)");
  });
});
