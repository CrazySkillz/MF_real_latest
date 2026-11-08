import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ binding: vi.fn(), grant: vi.fn() }));
vi.mock("./storage", () => ({ storage: { getGoogleAdsClientServiceAccount: mocked.binding, assertServiceAccountResourceAccess: mocked.grant } }));
vi.mock("google-auth-library", () => ({ JWT: class { transporter = { defaults: {} }; async getAccessToken() { return { token: "fixture-issuer" }; } } }));
import { getGoogleAdsClientServiceAccountEmail, getGoogleAdsServiceAccountPublicStatus, provisionGoogleAdsClientServiceAccount,
  getGoogleAdsClientServiceAccountAccessToken, hydrateGoogleAdsServiceAccountConnection } from "./utils/google-ads-service-account";
const binding = (id = "111") => ({ id, ownerId: "owner", clientId: "client", customerId: "1234567890", email: "acme-ads-1234567890@fixture-project.iam.gserviceaccount.com", googleUniqueId: id, verifiedAt: new Date(), createdAt: new Date() });
const account = (b: any, extra = {}) => ({ email: b.email, projectId: "fixture-project", uniqueId: b.googleUniqueId || "111", description: `mimosaas-ads-client-binding:${b.id}`, ...extra });
const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNT_JSON", JSON.stringify({ type: "service_account", project_id: "fixture-project", client_email: "issuer@fixture-project.iam.gserviceaccount.com", private_key: `fixture-${Math.random()}` }));
  vi.stubEnv("GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED", "true");
  vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED", "false");
  vi.stubEnv("GOOGLE_ADS_SERVICE_ACCOUNT_JSON", ""); vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
  mocked.binding.mockReset(); mocked.grant.mockReset(); request = vi.fn(); vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("dedicated Google Ads access identities", () => {
  it.each(["Acme", "Café & Company", "123", "東京", "A".repeat(80)])("uses a valid Ads-specific name for %s", name => {
    const email = getGoogleAdsClientServiceAccountEmail(name, "123-456-7890");
    expect(email.split("@")[0]).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
    expect(email).toMatch(/-ads-1234567890@fixture-project\.iam\.gserviceaccount\.com$/);
  });
  it.each(["", "123", "12345678900", "../1234567890"])("rejects malformed Customer ID %s", id => expect(() => getGoogleAdsClientServiceAccountEmail("Acme", id)).toThrow("10-digit"));
  it("uses a separate setup flag without changing GA4 or requiring legacy grants", () => {
    expect(getGoogleAdsServiceAccountPublicStatus()).toEqual({ enabled: true, email: null, selfService: true });
    vi.stubEnv("GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED", "false");
    expect(getGoogleAdsServiceAccountPublicStatus()).toEqual({ enabled: false, email: null });
  });
  it("creates only an unprovisioned reservation and recognizes a lost response on retry", async () => {
    const b = { ...binding(), googleUniqueId: null };
    request.mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response(account(b)));
    expect(await provisionGoogleAdsClientServiceAccount(b)).toBe("111");
    expect(JSON.parse(request.mock.calls[1][1].body).serviceAccount.description).toBe("mimosaas-ads-client-binding:111");
    request.mockResolvedValueOnce(response(account(b)));
    expect(await provisionGoogleAdsClientServiceAccount(b)).toBe("111"); expect(request.mock.calls[2][1].method).toBe("GET");
  });
  it("handles concurrent Google creation without adopting another identity", async () => {
    const b = { ...binding(), googleUniqueId: null };
    request.mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response(account(b)));
    expect(await provisionGoogleAdsClientServiceAccount(b)).toBe("111");
  });
  it.each([{ description: "foreign" }, { email: "other@fixture.invalid" }, { projectId: "other" }, { uniqueId: "222" }, { disabled: true }])("refuses mismatched Google identity %j", async extra => {
    request.mockResolvedValue(response(account(binding(), extra)));
    await expect(provisionGoogleAdsClientServiceAccount(binding())).rejects.toThrow("unavailable");
  });
  it.each([404, 403, 429, 500])("does not recreate or adopt a previously provisioned identity after HTTP %s", async status => {
    request.mockResolvedValue(response({}, status));
    await expect(provisionGoogleAdsClientServiceAccount(binding())).rejects.toThrow("could not prepare"); expect(request).toHaveBeenCalledTimes(1);
  });
  it("uses numeric identity and an Ads token, distinct from GA4, without stored keys", async () => {
    request.mockImplementation(async (url: string) => response({ accessToken: url.includes("/111:") ? "one" : "two", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    expect((await getGoogleAdsClientServiceAccountAccessToken(binding())).accessToken).toBe("one");
    expect((await getGoogleAdsClientServiceAccountAccessToken(binding("222"))).accessToken).toBe("two");
    expect((await getGoogleAdsClientServiceAccountAccessToken(binding())).accessToken).toBe("one");
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ scope: ["https://www.googleapis.com/auth/adwords"], lifetime: "3600s" });
  });
  it("rechecks owner/client/customer before using a cached token; never falls back to a shared account", async () => {
    mocked.binding.mockResolvedValue(binding());
    request.mockResolvedValue(response({ accessToken: "one", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    const connection = { campaignId: "campaign", customerId: "1234567890", serviceAccountBindingId: "111", method: "service_account" };
    expect((await hydrateGoogleAdsServiceAccountConnection(connection)).accessToken).toBe("one");
    expect(mocked.binding).toHaveBeenCalledWith("campaign", "1234567890", "111");
    mocked.binding.mockResolvedValue(undefined);
    await expect(hydrateGoogleAdsServiceAccountConnection(connection)).rejects.toThrow("not verified");
    expect(request).toHaveBeenCalledTimes(1); expect(mocked.grant).not.toHaveBeenCalled();
  });
  it("retains existing dedicated access when new setup is disabled and does not change OAuth", async () => {
    vi.stubEnv("GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED", "false");
    mocked.binding.mockResolvedValue(binding());
    request.mockResolvedValue(response({ accessToken: "one", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    expect((await hydrateGoogleAdsServiceAccountConnection({ campaignId: "a", customerId: "1234567890", serviceAccountBindingId: "111", method: "service_account" })).accessToken).toBe("one");
    const oauth = { method: "oauth", accessToken: "existing" }; expect(await hydrateGoogleAdsServiceAccountConnection(oauth)).toBe(oauth);
  });
});
