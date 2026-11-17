import { describe, expect, it } from "vitest";
import { checkRollingUsersWindows } from "./live-number-provider-checks";
import evidence from "./fixtures/monitor-seven-day-users-real-20261117.json";

const fixture = () => {
  const packet = { version: 1, metric: "totalUsers", propertyId: evidence.propertyId,
    startDate: evidence.startDate, endDate: evidence.endDate, windows: structuredClone(evidence.windows) };
  const scope = { connection: { propertyId: evidence.propertyId }, startDate: evidence.startDate, endDate: evidence.endDate,
    publication: { campaignBreakdown: { meta: { distinctUsers: structuredClone(packet) } } } } as any;
  return { scope, packet };
};

describe("independent monitor seven-day Users contract", () => {
  it("checks all supplemental real-GA4 windows including zero, preserving legacy windows and input bytes", () => {
    const { scope, packet } = fixture(), before = JSON.stringify(scope);
    const result = checkRollingUsersWindows(scope, packet);
    expect(result.checks).toHaveLength(53);
    expect(result.checks.every(check => check.status === "passed")).toBe(true);
    expect(packet.windows.filter(row => row.users === 0)).toHaveLength(2);
    expect(result.publication.campaignBreakdown.meta.distinctUsers.windows).toEqual([packet.windows.at(-1)]);
    expect(JSON.stringify(scope)).toBe(before);
  });
  it.each(["changed", "missing", "duplicate", "invalid", "rate"])('never passes a %s saved window', change => {
    const { scope, packet } = fixture(), rows = scope.publication.campaignBreakdown.meta.distinctUsers.windows;
    if (change === "changed") rows[0].users++;
    if (change === "missing") rows.shift();
    if (change === "duplicate") rows.push({ ...rows[0] });
    if (change === "invalid") rows[0].users = null;
    if (change === "rate") rows[0].sessionKeyEventRate = 0;
    expect(checkRollingUsersWindows(scope, packet).checks.some(check => check.status !== "passed")).toBe(true);
  });
  it.each(["missing", "duplicate", "invalid", "property", "period"])('rejects %s provider evidence', change => {
    const { scope, packet } = fixture();
    if (change === "missing") packet.windows.shift();
    if (change === "duplicate") packet.windows[0] = { ...packet.windows[1] };
    if (change === "invalid") packet.windows[0].users = -1;
    if (change === "property") packet.propertyId = "other";
    if (change === "period") packet.startDate = "2026-09-05";
    expect(() => checkRollingUsersWindows(scope, packet)).toThrow(/ROLLING_USERS/);
  });
  it("retains unknown windows for the existing comparator to reject", () => {
    const { scope, packet } = fixture(), unknown = { startDate: "2026-09-04", endDate: "2026-09-05", users: 7 };
    scope.publication.campaignBreakdown.meta.distinctUsers.windows.push(unknown);
    expect(checkRollingUsersWindows(scope, packet).publication.campaignBreakdown.meta.distinctUsers.windows).toContainEqual(unknown);
  });
  it("does not invent windows for short histories", () => {
    const { scope, packet } = fixture();
    scope.startDate = packet.startDate = "2026-11-15";
    scope.publication.campaignBreakdown.meta.distinctUsers = { ...packet, windows: [] };
    packet.windows = [];
    expect(checkRollingUsersWindows(scope, packet).checks.every(check => check.status === "passed")).toBe(true);
  });
});
