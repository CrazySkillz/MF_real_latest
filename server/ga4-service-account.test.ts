import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it } from "vitest";
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
  if (originalJson === undefined) delete process.env.GA4_SERVICE_ACCOUNT_JSON;
  else process.env.GA4_SERVICE_ACCOUNT_JSON = originalJson;
  if (originalAllowed === undefined) delete process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS;
  else process.env.GA4_SERVICE_ACCOUNT_ALLOWED_PROPERTY_IDS = originalAllowed;
});

describe("temporary GA4 service-account boundary", () => {
  it("keeps OAuth supported while adding the temporary method", () => {
    const authSource = readFileSync(resolve(process.cwd(), "client/src/components/IntegratedGA4Auth.tsx"), "utf8");
    expect(isSupportedGA4ConnectionMethod("access_token")).toBe(true);
    expect(isSupportedGA4ConnectionMethod("service_account")).toBe(true);
    expect(isSupportedGA4ConnectionMethod("password")).toBe(false);
    expect(authSource).toContain("/api/auth/ga4/connect");
    expect(authSource.indexOf("Connect Google Analytics")).toBeLessThan(authSource.indexOf("Temporary test connection"));
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
});
