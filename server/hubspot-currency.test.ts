import { describe, expect, it } from "vitest";
import { resolveHubspotRevenueCurrency } from "./utils/hubspot-currency";

describe("HubSpot revenue currency resolution", () => {
  it("uses deal currency when every matched deal supplies it", () => {
    expect(resolveHubspotRevenueCurrency(["usd", "USD"], 0, "EUR")).toEqual({ currency: "USD", currencies: ["USD"] });
  });

  it("uses provider account currency only for matched deals missing hs_currency", () => {
    expect(resolveHubspotRevenueCurrency([], 2, "usd")).toEqual({ currency: "USD", currencies: ["USD"] });
  });

  it("exposes mixed and unavailable currency so persistence can fail closed", () => {
    expect(resolveHubspotRevenueCurrency(["EUR"], 1, "USD")).toEqual({ currency: "", currencies: ["EUR", "USD"] });
    expect(resolveHubspotRevenueCurrency([], 1, null)).toEqual({ currency: "", currencies: [] });
  });
});
