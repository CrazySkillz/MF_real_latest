import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ getBinding: vi.fn(), grant: vi.fn(), jwt: vi.fn() }));
vi.mock("./storage", () => ({ storage: { getGA4ClientServiceAccount: mocked.getBinding, assertServiceAccountResourceAccess: mocked.grant } }));
vi.mock("google-auth-library", () => ({ JWT: class {
  transporter = { defaults: {} };
  constructor(options: any) { mocked.jwt(options); }
  async getAccessToken() { return { token: "issuer-fixture" }; }
} }));
import { getGA4ClientServiceAccountEmail, getGA4ServiceAccountPublicStatus, provisionGA4ClientServiceAccount,
  getGA4ClientServiceAccountAccessToken, hydrateGA4ServiceAccountConnection } from "./utils/ga4-service-account";

let request: ReturnType<typeof vi.fn>;
const binding = (id = "1") => ({ id, ownerId: "owner", clientId: "client", propertyId: "542352127", email: `acme-542352127@fixture-project.iam.gserviceaccount.com`,
  googleUniqueId: id, verifiedAt: new Date(), createdAt: new Date() });
const account = (value: any, overrides: any = {}) => ({ email: value.email, projectId: "fixture-project", uniqueId: value.googleUniqueId || "1234567890", description: `mimosaas-client-binding:${value.id}`, ...overrides });
const response = (body: any, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => {
  vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNT_JSON", JSON.stringify({ type: "service_account", project_id: "fixture-project", client_email: "issuer@fixture-project.iam.gserviceaccount.com", private_key: `fixture-${Math.random()}` }));
  vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED", "true");
  vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", "");
  mocked.getBinding.mockReset(); mocked.grant.mockReset(); mocked.jwt.mockClear();
  request = vi.fn(); vi.stubGlobal("fetch", request);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("client-specific GA4 identities", () => {
  it("uses the requested client-name/property format, with Google's allowed separator", () => {
    expect(getGA4ClientServiceAccountEmail("Acme", "542352127")).toBe("acme-542352127@fixture-project.iam.gserviceaccount.com");
    expect(getGA4ClientServiceAccountEmail("Café & Company", "properties/542352127")).toBe("cafe-company-542352127@fixture-project.iam.gserviceaccount.com");
  });
  it.each(["123 Company", "A", "東京", "", "A ".repeat(90)])("always creates a valid bounded ID for %s", name => {
    const id = getGA4ClientServiceAccountEmail(name, "12345678901234567890").split("@")[0];
    expect(id).toMatch(/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
    expect(id.endsWith("-12345678901234567890")).toBe(true);
  });
  it.each(["", "abc", "123/456", "1".repeat(21)])("rejects invalid property %s before Google access", id => {
    expect(() => getGA4ClientServiceAccountEmail("Acme", id)).toThrow("valid numeric"); expect(request).not.toHaveBeenCalled();
  });
  it("does not require or expose legacy shared credentials for new setup", () => {
    expect(getGA4ServiceAccountPublicStatus()).toEqual({ enabled: true, email: null, selfService: true });
    vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED", "false");
    expect(getGA4ServiceAccountPublicStatus()).toEqual({ enabled: false, email: null });
  });
  it("creates only a missing identity with the persisted reservation marker", async () => {
    const row = { ...binding(), googleUniqueId: null };
    request.mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response(account(row)));
    expect(await provisionGA4ClientServiceAccount(row)).toBe("1234567890");
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({ accountId: "acme-542352127", serviceAccount: { displayName: "acme-542352127", description: "mimosaas-client-binding:1" } });
    expect(request.mock.calls[1][0]).toBe("https://iam.googleapis.com/v1/projects/fixture-project/serviceAccounts");
  });
  it("retries a lost creation response without creating another account", async () => {
    const row = { ...binding(), googleUniqueId: null };
    request.mockResolvedValue(response(account(row)));
    expect(await provisionGA4ClientServiceAccount(row)).toBe("1234567890");
    expect(request.mock.calls[0][1].method).toBe("GET");
  });
  it("handles concurrent creates only when the Google identity carries this reservation", async () => {
    const row = { ...binding(), googleUniqueId: null };
    request.mockResolvedValueOnce(response({}, 404)).mockResolvedValueOnce(response({}, 409)).mockResolvedValueOnce(response(account(row)));
    expect(await provisionGA4ClientServiceAccount(row)).toBe("1234567890");
  });
  it.each([{ description: "another-client" }, { email: "foreign@fixture-project.iam.gserviceaccount.com" }, { projectId: "other-project" }, { uniqueId: "999" }, { disabled: true }])("refuses a foreign/replaced/disabled Google identity: %j", override => {
    request.mockResolvedValue(response(account(binding(), override)));
    return expect(provisionGA4ClientServiceAccount(binding())).rejects.toThrow("unavailable");
  });
  it("never recreates a previously provisioned account after deletion", async () => {
    request.mockResolvedValue(response({}, 404));
    await expect(provisionGA4ClientServiceAccount(binding())).rejects.toThrow("could not prepare");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([403, 429, 500])("fails closed on Google %s without granting property access", async status => {
    request.mockResolvedValue(response({}, status));
    await expect(provisionGA4ClientServiceAccount(binding())).rejects.toThrow("could not prepare");
    expect(mocked.grant).not.toHaveBeenCalled();
  });
  it("uses numeric identities and analytics.readonly; tokens are isolated per client and reused only in memory", async () => {
    request.mockImplementation(async (url: string) => response({ accessToken: url.includes("/1:") ? "client-one" : "client-two", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    expect((await getGA4ClientServiceAccountAccessToken(binding("1"))).accessToken).toBe("client-one");
    expect((await getGA4ClientServiceAccountAccessToken(binding("2"))).accessToken).toBe("client-two");
    expect((await getGA4ClientServiceAccountAccessToken(binding("1"))).accessToken).toBe("client-one");
    expect(request).toHaveBeenCalledTimes(2);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ scope: ["https://www.googleapis.com/auth/analytics.readonly"], lifetime: "3600s" });
  });
  it("checks tenant/property binding again even when a credential is cached", async () => {
    mocked.getBinding.mockResolvedValue(binding());
    request.mockResolvedValue(response({ accessToken: "client-one", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    const connection = { campaignId: "campaign", propertyId: "542352127", method: "service_account", serviceAccountBindingId: "1" };
    expect((await hydrateGA4ServiceAccountConnection(connection)).accessToken).toBe("client-one");
    expect(mocked.getBinding).toHaveBeenCalledWith("campaign", "542352127", "1");
    mocked.getBinding.mockResolvedValue(undefined);
    await expect(hydrateGA4ServiceAccountConnection(connection)).rejects.toThrow("not verified");
    expect(request).toHaveBeenCalledTimes(1); expect(mocked.grant).not.toHaveBeenCalled();
  });
  it("continues refreshing an existing dedicated connection when new signup is disabled", async () => {
    vi.stubEnv("GA4_CLIENT_SERVICE_ACCOUNTS_ENABLED", "false");
    mocked.getBinding.mockResolvedValue(binding());
    request.mockResolvedValue(response({ accessToken: "existing-client", expireTime: new Date(Date.now() + 3600000).toISOString() }));
    expect((await hydrateGA4ServiceAccountConnection({ campaignId: "campaign", propertyId: "542352127", method: "service_account", serviceAccountBindingId: "1" })).accessToken).toBe("existing-client");
  });
  it("does not alter OAuth or use unverified reservations", async () => {
    const oauth = { method: "access_token", accessToken: "existing-oauth" };
    expect(await hydrateGA4ServiceAccountConnection(oauth)).toBe(oauth);
    mocked.getBinding.mockResolvedValue({ ...binding(), verifiedAt: null });
    await expect(hydrateGA4ServiceAccountConnection({ method: "service_account", serviceAccountBindingId: "1" })).rejects.toThrow("not verified");
    expect(request).not.toHaveBeenCalled();
  });
});
