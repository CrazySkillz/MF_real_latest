import { describe, expect, it } from "vitest";
import { getInternalAutoRefreshToken, getInternalGA4RefreshWriteInput } from "./internal-request-auth";

const scope = { campaignId: "a", ownerId: "owner-a", reportingDate: "2026-10-17", work: { id: "work", leaseToken: "lease" } };
const request = (value: any = JSON.stringify(scope), address = "127.0.0.1", token = getInternalAutoRefreshToken()) => ({
  socket: { remoteAddress: address }, headers: { "x-internal-auto-refresh-token": token, "x-internal-ga4-refresh-scope": value },
});
describe("internal GA4 ownership transport", () => {
  it("leaves ordinary requests unchanged", () => {
    expect(getInternalGA4RefreshWriteInput({})).toEqual({});
  });
  it.each(["127.0.0.1", "::1", "::ffff:127.0.0.1"])("accepts authenticated loopback %s", address => {
    expect(getInternalGA4RefreshWriteInput(request(JSON.stringify(scope), address))).toEqual({ refreshScope: scope });
  });
  it.each([null, [], "", "null", "{}", "not-json", "x".repeat(2049), JSON.stringify({ ...scope, work: {} })])("fails closed on malformed scope %j", value => {
    expect(() => getInternalGA4RefreshWriteInput(request(value))).toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
  });
  it("rejects an external address even with a valid internal token", () => {
    expect(() => getInternalGA4RefreshWriteInput(request(JSON.stringify(scope), "192.0.2.1"))).toThrow();
  });
  it("rejects loopback without the correct internal token", () => {
    expect(() => getInternalGA4RefreshWriteInput(request(JSON.stringify(scope), "127.0.0.1", "wrong"))).toThrow();
  });
});
