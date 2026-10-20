import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
const authorize = vi.hoisted(() => vi.fn(async () => ({ access_token: "fixture-ga4-token", expiry_date: Date.now() + 3600000 })));
const grant = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("google-auth-library", () => ({ JWT: class { authorize = authorize; } }));
vi.mock("./storage", () => ({ storage: { assertServiceAccountResourceAccess: grant } }));
import {
  assertGA4ServiceAccountPropertyAllowed,
  getGA4ServiceAccountPublicStatus,
  hydrateGA4ServiceAccountConnection,
  isSupportedGA4ConnectionMethod,
  normalizeGA4ServiceAccountPropertyId,
} from "./utils/ga4-service-account";

const originalJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
const originalAllowed = process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS;

afterEach(() => {
  authorize.mockClear(); grant.mockReset().mockResolvedValue(undefined);
  if (originalJson === undefined) delete process.env.GA4_SERVICE_ACCOUNT_JSON;
  else process.env.GA4_SERVICE_ACCOUNT_JSON = originalJson;
  if (originalAllowed === undefined) delete process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS;
  else process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS = originalAllowed;
});

describe("temporary GA4 service-account boundary", () => {
  it("defaults customer onboarding to OAuth while retaining explicit service-account support", () => {
    const authSource = readFileSync(resolve(process.cwd(), "client/src/components/IntegratedGA4Auth.tsx"), "utf8");
    expect(isSupportedGA4ConnectionMethod("access_token")).toBe(true);
    expect(isSupportedGA4ConnectionMethod("service_account")).toBe(true);
    expect(isSupportedGA4ConnectionMethod("password")).toBe(false);
    expect(authSource).toContain("/api/auth/ga4/connect");
    expect(authSource).toContain('connectionMode = "oauth"');
    expect(authSource).toContain('connectionMode === "oauth"');
    expect(authSource).toContain("/ga4-service-account/connect");
    expect(authSource).not.toContain("Temporary test connection");
    expect(authSource).not.toContain("Connect test property");
  });

  it("uses customer OAuth credentials without shared-account configuration or grants", async () => {
    delete process.env.GA4_SERVICE_ACCOUNT_JSON;
    delete process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS;
    grant.mockRejectedValue(new Error("No shared resource grant"));
    const connection = { campaignId: "customer-draft", method: "access_token", propertyId: "123456789", accessToken: "customer-token" };
    expect(await hydrateGA4ServiceAccountConnection(connection)).toBe(connection);
    expect(grant).not.toHaveBeenCalled();
    expect(authorize).not.toHaveBeenCalled();
  });

  it("normalizes and permits only explicitly allowlisted properties", () => {
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "mimosaas-ga4-reader@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
    });
    process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS = "123456789, properties/987654321";

    expect(normalizeGA4ServiceAccountPropertyId("properties/987654321")).toBe("987654321");
    expect(assertGA4ServiceAccountPropertyAllowed("properties/123456789")).toBe("123456789");
    expect(() => assertGA4ServiceAccountPropertyAllowed("111111111")).toThrow(/not approved/i);
    expect(getGA4ServiceAccountPublicStatus()).toEqual({
      enabled: true,
      email: "mimosaas-ga4-reader@example.iam.gserviceaccount.com",
    });
  });

  it("stays disabled until both credentials and an allowlist are configured", () => {
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: "service_account", client_email: "reader@example.com", private_key: "key" });
    delete process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS;
    expect(getGA4ServiceAccountPublicStatus()).toEqual({ enabled: false, email: "reader@example.com" });
  });

  it("refuses to hydrate a saved temporary connection after its property is removed from the allowlist", async () => {
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "reader@example.com",
      private_key: "key",
    });
    process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS = "123456789";

    await expect(hydrateGA4ServiceAccountConnection({
      method: "service_account",
      propertyId: "987654321",
    })).rejects.toThrow(/not approved/i);
  });
  it("checks a current customer grant before issuing or reusing a shared token", async () => {
    process.env.GA4_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: "service_account", client_email: "fixture@example.invalid", private_key: "fixture" });
    process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS = "123456789";
    const connection = { campaignId: "campaign-a", method: "service_account", propertyId: "123456789" };
    expect((await hydrateGA4ServiceAccountConnection(connection)).accessToken).toBe("fixture-ga4-token");
    expect(grant).toHaveBeenCalledWith("campaign-a", "ga4", "123456789");
    authorize.mockClear(); grant.mockRejectedValueOnce(new Error("Resource not granted"));
    await expect(hydrateGA4ServiceAccountConnection(connection)).rejects.toThrow("not granted");
    expect(authorize).not.toHaveBeenCalled();
  });
});
