import { describe, expect, it } from "vitest";
import { resolveMonitorEnrollment } from "../scripts/discover-monitor-campaigns";
import { liveNumberCheckIsDue, runLiveNumberMonitor } from "../scripts/check-live-numbers";
const a = { campaignIdHash: "a".repeat(12), reportingTimeZone: "Europe/Amsterdam", monitorFrom: "2026-11-01T00:00:00.000Z" };
const b = { ...a, campaignIdHash: "b".repeat(12), reportingTimeZone: "America/New_York" };
const history = [{ snapshotHash: "c".repeat(12), payloadSha256: "d".repeat(64), replacementHash: "e".repeat(12), replacementPdfSha256: "f".repeat(64) }];
const health = { baseUrl: "https://example.com", expectedCommit: "1".repeat(40), graceMinutes: 20, campaigns: [a] };
const numbers = { databaseEnvironmentVariable: "MONITOR_DB", databaseFingerprint: "2".repeat(64),
  application: { baseUrl: health.baseUrl, expectedCommit: health.expectedCommit },
  campaigns: [{ campaignIdHash: a.campaignIdHash, reportingTimeZone: a.reportingTimeZone, historicalReports: history }] };
const enroll = (rows: typeof a[]) => resolveMonitorEnrollment(numbers, health, rows, new Date("2026-11-07T14:00:00Z"));

describe("automatic monitor enrollment", () => {
  it("adds a newly discovered campaign to both monitors without inheriting another campaign's history", () => {
    const result = enroll([a, b]);
    expect(result.health.campaigns).toEqual([a, b]);
    expect(result.numbers.campaigns).toEqual([
      numbers.campaigns[0], { campaignIdHash: b.campaignIdHash, reportingTimeZone: b.reportingTimeZone }]);
  });
  it("uses current membership and timezone rather than stale seed configuration", () => {
    const result = enroll([{ ...b, reportingTimeZone: "Asia/Kolkata" }]);
    expect(result.numbers.campaigns).toEqual([{ campaignIdHash: b.campaignIdHash, reportingTimeZone: "Asia/Kolkata" }]);
    expect(result.health.campaigns.map(c => c.campaignIdHash)).toEqual([b.campaignIdHash]);
    expect(liveNumberCheckIsDue("Asia/Kolkata", new Date("2026-11-07T02:50:00Z"))).toBe(true);
  });
  it("allows a proven empty inventory without provider/database work", async () => {
    const result = enroll([]);
    expect(result.health.campaigns).toEqual([]);
    expect(await runLiveNumberMonitor(result.numbers, true)).toMatchObject([{ status: "not_due" }]);
  });
  it.each([
    [a, a], [{ ...a, reportingTimeZone: "invalid" }], [{ ...a, monitorFrom: "invalid" }],
    [{ ...a, monitorFrom: "2027-01-01T00:00:00Z" }],
    Array.from({ length: 101 }, (_, i) => ({ ...a, campaignIdHash: i.toString(16).padStart(12, "0") })),
  ])("rejects ambiguous, malformed or excessive membership %j", (...rows) => expect(() => enroll(rows as typeof a[])).toThrow());
  it("rejects crossed application/config identities", () => {
    expect(() => resolveMonitorEnrollment(numbers, { ...health, baseUrl: "https://other.example.com" }, [a])).toThrow("IDENTITY_MISMATCH");
    expect(() => resolveMonitorEnrollment(numbers, { ...health, expectedCommit: "3".repeat(40) }, [a])).toThrow("IDENTITY_MISMATCH");
  });
});
