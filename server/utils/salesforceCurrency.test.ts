import { describe, expect, it } from "vitest";
import { detectSalesforceCurrency } from "./salesforceCurrency";

function makeFetch(routes: Record<string, { status: number; body: any }>) {
  return (async (url: any) => {
    const key = String(url);
    const hit = routes[key];
    if (!hit) {
      return {
        ok: false,
        status: 500,
        json: async () => ({ message: `No mock for ${key}` }),
      } as any;
    }
    return {
      ok: hit.status >= 200 && hit.status < 300,
      status: hit.status,
      json: async () => hit.body,
    } as any;
  }) as any;
}

describe("detectSalesforceCurrency", () => {
  it("falls back to CompanyInfo.CurrencyIsoCode when Organization fields are not accessible", async () => {
    const instanceUrl = "https://example.my.salesforce.com";
    const apiVersion = "v59.0";
    const accessToken = "token";
    const authBase = "https://login.salesforce.com";

    const orgSoql1 = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent("SELECT DefaultCurrencyIsoCode FROM Organization LIMIT 1")}`;
    const orgSoql2 = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent("SELECT CurrencyIsoCode FROM Organization LIMIT 1")}`;
    const companySoql = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent("SELECT CurrencyIsoCode FROM CompanyInfo LIMIT 1")}`;
    const userinfoUrl = `${authBase}/services/oauth2/userinfo`;

    const fetchImpl = makeFetch({
      [orgSoql1]: { status: 403, body: { message: "insufficient access" } },
      [orgSoql2]: { status: 403, body: { message: "insufficient access" } },
      [companySoql]: { status: 200, body: { records: [{ CurrencyIsoCode: "USD" }] } },
      // should not be needed if CompanyInfo works
      [userinfoUrl]: { status: 401, body: { error: "invalid_scope" } },
    });

    const res = await detectSalesforceCurrency({
      instanceUrl,
      apiVersion,
      accessToken,
      authBase,
      currenciesFromRecords: new Set(),
      debug: true,
      fetchImpl,
    });

    expect(res.detectedCurrency).toBe("USD");
  });

  it("infers sandbox auth base for userinfo when authBase not provided", async () => {
    const instanceUrl = "https://example.sandbox.my.salesforce.com";
    const apiVersion = "v59.0";
    const accessToken = "token";

    const userinfoUrl = `https://test.salesforce.com/services/oauth2/userinfo`;
    const userSoql = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(
      "SELECT CurrencyIsoCode FROM User WHERE Id = '005xx0000012345' LIMIT 1"
    )}`;

    const fetchImpl = makeFetch({
      [userinfoUrl]: { status: 200, body: { user_id: "https://test.salesforce.com/id/00Dxx0000000001/005xx0000012345" } },
      [userSoql]: { status: 200, body: { records: [{ CurrencyIsoCode: "USD" }] } },
    });

    const res = await detectSalesforceCurrency({
      instanceUrl,
      apiVersion,
      accessToken,
      currenciesFromRecords: new Set(),
      debug: true,
      fetchImpl,
    });

    expect(res.detectedCurrency).toBe("USD");
  });

  it("detects currency via /services/data identity URL even when userinfo is not accessible", async () => {
    const instanceUrl = "https://example.my.salesforce.com";
    const apiVersion = "v59.0";
    const accessToken = "token";

    const servicesDataUrl = `${instanceUrl}/services/data/${apiVersion}`;
    const identityUrl = "https://login.salesforce.com/id/00Dxx0000000001/005xx0000012345";
    const userSoql = `${instanceUrl}/services/data/${apiVersion}/query?q=${encodeURIComponent(
      "SELECT CurrencyIsoCode FROM User WHERE Id = '005xx0000012345' LIMIT 1"
    )}`;

    const fetchImpl = makeFetch({
      [servicesDataUrl]: { status: 200, body: { identity: identityUrl } },
      [identityUrl]: { status: 200, body: { user_id: identityUrl } },
      [userSoql]: { status: 200, body: { records: [{ CurrencyIsoCode: "USD" }] } },
      // userinfo not accessible
      ["https://login.salesforce.com/services/oauth2/userinfo"]: { status: 401, body: { error: "invalid_scope" } },
    });

    const res = await detectSalesforceCurrency({
      instanceUrl,
      apiVersion,
      accessToken,
      currenciesFromRecords: new Set(),
      debug: true,
      fetchImpl,
    });

    expect(res.detectedCurrency).toBe("USD");
  });
});


