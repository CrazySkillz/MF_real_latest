import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

const authorize = vi.hoisted(() => vi.fn(async () => ({
  access_token: "temporary-google-ads-token",
  expiry_date: Date.now() + 60 * 60 * 1000,
})));

vi.mock("google-auth-library", () => ({
  JWT: class {
    authorize = authorize;
  },
}));

import {
  assertGoogleAdsServiceAccountCustomerAllowed,
  getGoogleAdsServiceAccountPublicStatus,
  hydrateGoogleAdsServiceAccountConnection,
  isSupportedGoogleAdsSpendConnectionMethod,
  normalizeGoogleAdsCustomerId,
} from "./utils/google-ads-service-account";

const originalJson = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON;
const originalGa4Json = process.env.GA4_SERVICE_ACCOUNT_JSON;
const originalAllowed = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS;
const originalLoginCustomer = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID;

afterEach(() => {
  if (originalJson === undefined) delete process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON;
  else process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON = originalJson;
  if (originalGa4Json === undefined) delete process.env.GA4_SERVICE_ACCOUNT_JSON;
  else process.env.GA4_SERVICE_ACCOUNT_JSON = originalGa4Json;
  if (originalAllowed === undefined) delete process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS;
  else process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS = originalAllowed;
  if (originalLoginCustomer === undefined) delete process.env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID;
  else process.env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID = originalLoginCustomer;
  authorize.mockClear();
});

describe("temporary Google Ads Spend service-account boundary", () => {
  it("keeps OAuth first while adding the temporary connection", () => {
    const modal = readFileSync(resolve(process.cwd(), "client/src/components/AddSpendWizardModal.tsx"), "utf8");
    expect(isSupportedGoogleAdsSpendConnectionMethod("oauth")).toBe(true);
    expect(isSupportedGoogleAdsSpendConnectionMethod("service_account")).toBe(true);
    expect(isSupportedGoogleAdsSpendConnectionMethod("test_mode")).toBe(false);
    expect(modal).toContain("connectAdPlatformOAuth");
    expect(modal.indexOf("Connect Google Ads")).toBeLessThan(modal.indexOf("Temporary test connection"));
  });

  it("normalizes and permits only explicitly allowlisted customers", () => {
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "ads-reader@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----\\n",
    });
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS = "123-456-7890, 9876543210";

    expect(normalizeGoogleAdsCustomerId("123-456-7890")).toBe("1234567890");
    expect(assertGoogleAdsServiceAccountCustomerAllowed("123-456-7890")).toBe("1234567890");
    expect(() => assertGoogleAdsServiceAccountCustomerAllowed("111-111-1111")).toThrow(/not approved/i);
    expect(getGoogleAdsServiceAccountPublicStatus()).toEqual({
      enabled: true,
      email: "ads-reader@example.iam.gserviceaccount.com",
    });
  });

  it("hydrates a saved temporary connection without persisted user credentials", async () => {
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account",
      client_email: "ads-reader@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\ntest-hydrate\\n-----END PRIVATE KEY-----\\n",
    });
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS = "1234567890";
    process.env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID = "999-999-9999";

    const hydrated = await hydrateGoogleAdsServiceAccountConnection({
      method: "service_account",
      customerId: "123-456-7890",
      accessToken: null,
      refreshToken: "must-not-survive",
      clientId: "must-not-survive",
      clientSecret: "must-not-survive",
      developerToken: "must-not-survive",
    });

    expect(hydrated).toMatchObject({
      accessToken: "temporary-google-ads-token",
      refreshToken: null,
      clientId: null,
      clientSecret: null,
      developerToken: null,
      managerAccountId: "9999999999",
    });
    expect(authorize).toHaveBeenCalledTimes(1);
  });

  it("keeps the temporary route campaign-scoped and credentials out of dedicated storage", () => {
    const routes = readFileSync(resolve(process.cwd(), "server/routes-oauth.ts"), "utf8");
    const storage = readFileSync(resolve(process.cwd(), "server/storage.ts"), "utf8");
    const helper = readFileSync(resolve(process.cwd(), "server/utils/google-ads-service-account.ts"), "utf8");
    const routeStart = routes.indexOf('app.post("/api/campaigns/:id/google-ads-service-account/connect"');
    const routeEnd = routes.indexOf("/**\n   * Initiate Google Ads OAuth flow", routeStart);
    const route = routes.slice(routeStart, routeEnd);
    const storageStart = storage.indexOf("async replaceGA4GoogleAdsSpendConnection");
    const storageEnd = storage.indexOf("async updateGA4GoogleAdsSpendConnection", storageStart);
    const replace = storage.slice(storageStart, storageEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route).toContain("assertGoogleAdsServiceAccountCustomerAllowed");
    expect(route).toContain("account.currencyCode !== campaignCurrency");
    expect(route).toContain("normalizeReportingTimeZone(account.timeZone) !== campaignTimeZone");
    expect(replace).toContain("accessToken: null, refreshToken: null, clientSecret: null");
    expect(replace).toContain("developerToken: isServiceAccount ? null");
    expect(helper).toContain('scopes: ["https://www.googleapis.com/auth/adwords"]');
  });
});
