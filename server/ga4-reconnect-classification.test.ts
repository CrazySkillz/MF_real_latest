import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { GoogleAnalytics4Service } from "./analytics";

const connection = {
  id: "ga4-connection-1",
  campaignId: "campaign-1",
  propertyId: "123456789",
  method: "access_token",
  accessToken: "expired-access-token",
  refreshToken: "durable-refresh-token",
  clientId: "client-id",
  clientSecret: "client-secret",
};

const makeStorage = () => ({
  getGA4Connection: vi.fn().mockResolvedValue(connection),
  updateGA4ConnectionTokens: vi.fn().mockResolvedValue(connection),
});

afterEach(() => vi.unstubAllGlobals());

describe("GA4 reconnect classification", () => {
  it("preserves Google's invalid_grant code for exact reconnect classification", async () => {
    const service = new GoogleAnalytics4Service();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({
        error: "invalid_grant",
        error_description: "Token has been expired or revoked.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      service.refreshAccessToken("revoked-refresh-token", "client-id", "client-secret"),
    ).rejects.toMatchObject({
      oauthError: "invalid_grant",
      oauthStatus: 400,
    });
  });

  it("does not treat a GA4 permission failure as an expired token", async () => {
    const service = new GoogleAnalytics4Service();
    const storage = makeStorage();
    const refresh = vi.spyOn(service, "refreshAccessToken");
    vi.spyOn(service, "getMetricsWithToken").mockRejectedValueOnce(
      new Error("GA4 API error 403: PERMISSION_DENIED"),
    );

    await expect(
      service.getMetricsWithAutoRefresh("campaign-1", storage),
    ).rejects.toThrow("PERMISSION_DENIED");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not ask for reconnect when token refresh fails transiently", async () => {
    const service = new GoogleAnalytics4Service();
    const storage = makeStorage();
    vi.spyOn(service, "getMetricsWithToken").mockRejectedValueOnce(
      new Error("GA4 API error 401: UNAUTHENTICATED"),
    );
    vi.spyOn(service, "refreshAccessToken").mockRejectedValueOnce(
      new Error("OAuth token endpoint temporarily unavailable"),
    );

    await expect(
      service.getMetricsWithAutoRefresh("campaign-1", storage),
    ).rejects.toThrow("temporarily unavailable");
  });

  it("asks for reconnect when Google rejects the refresh credential", async () => {
    const service = new GoogleAnalytics4Service();
    const storage = makeStorage();
    vi.spyOn(service, "getMetricsWithToken").mockRejectedValueOnce(
      new Error("GA4 API error 401: UNAUTHENTICATED"),
    );
    const rejectedRefresh = Object.assign(
      new Error("Failed to refresh token: Token has been expired or revoked."),
      { oauthError: "invalid_grant", oauthStatus: 400 },
    );
    vi.spyOn(service, "refreshAccessToken").mockRejectedValueOnce(rejectedRefresh);

    await expect(
      service.getMetricsWithAutoRefresh("campaign-1", storage),
    ).rejects.toMatchObject({
      message: "AUTO_REFRESH_NEEDED",
      isAutoRefreshNeeded: true,
      hasRefreshToken: true,
    });
  });

  it("does not ask for reconnect when refreshed-token persistence fails", async () => {
    const service = new GoogleAnalytics4Service();
    const storage = makeStorage();
    storage.updateGA4ConnectionTokens.mockRejectedValueOnce(
      new Error("Database temporarily unavailable"),
    );
    vi.spyOn(service, "getMetricsWithToken").mockRejectedValueOnce(
      new Error("GA4 API error 401: UNAUTHENTICATED"),
    );
    vi.spyOn(service, "refreshAccessToken").mockResolvedValueOnce({
      access_token: "fresh-access-token",
      expires_in: 3600,
    });

    await expect(
      service.getMetricsWithAutoRefresh("campaign-1", storage),
    ).rejects.toThrow("Database temporarily unavailable");
  });

  it("does not relabel a post-refresh provider failure as reconnect", async () => {
    const service = new GoogleAnalytics4Service();
    const storage = makeStorage();
    vi.spyOn(service, "getMetricsWithToken")
      .mockRejectedValueOnce(new Error("GA4 API error 401: UNAUTHENTICATED"))
      .mockRejectedValueOnce(new Error("GA4 API error 403: PERMISSION_DENIED"));
    vi.spyOn(service, "refreshAccessToken").mockResolvedValueOnce({
      access_token: "fresh-access-token",
      expires_in: 3600,
    });

    await expect(
      service.getMetricsWithAutoRefresh("campaign-1", storage),
    ).rejects.toThrow("PERMISSION_DENIED");
    expect(storage.updateGA4ConnectionTokens).toHaveBeenCalledWith(
      connection.id,
      expect.objectContaining({ accessToken: "fresh-access-token" }),
    );
  });

  it("does not refresh tokens for generic GA4 403 permission failures in route-level provider callers", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const providerCallers = [
      routes.slice(routes.indexOf("const resolveNotificationAlertRow"), routes.indexOf("const isResolvedAlertRowBreached")),
      routes.slice(routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"'), routes.indexOf("// Benchmark-read-only GA4 input validation")),
      routes.slice(routes.indexOf('app.get("/api/campaigns/:id/ga4-benchmark-provider-validation"'), routes.indexOf("// ============================================================================", routes.indexOf('app.get("/api/campaigns/:id/ga4-benchmark-provider-validation"'))),
    ];
    providerCallers.forEach((caller) => {
      expect(caller.length).toBeGreaterThan(0);
      expect(caller).not.toContain('msg.includes("403")');
    });
  });
});
