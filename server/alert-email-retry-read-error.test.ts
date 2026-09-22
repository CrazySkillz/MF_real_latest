import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ failRetryRead: true, failAuditUpdate: false }));

vi.mock("./db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => {
        if (state.failAuditUpdate) throw new Error("audit update failed");
        return [];
      }) })) })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => {
            if (state.failRetryRead) throw new Error("retry read failed");
            return [];
          }),
        })),
      })),
    })),
  },
}));

import { alertMonitoringService } from "./services/alert-monitoring";

describe("alert email retry read failure", () => {
  beforeEach(() => { state.failRetryRead = true; state.failAuditUpdate = false; });

  it("surfaces a failed due-retry read instead of reporting zero retries", async () => {
    await expect(alertMonitoringService.processDueAlertEmailRetries()).rejects.toThrow("retry read failed");
  });

  it("does not report a successful alert check after the retry read fails", async () => {
    await expect(alertMonitoringService.runAlertChecks()).rejects.toThrow("retry read failed");
  });

  it("still reports zero when the due-retry read succeeds with no rows", async () => {
    state.failRetryRead = false;
    await expect(alertMonitoringService.processDueAlertEmailRetries()).resolves.toBe(0);
  });

  it("surfaces a failed stale-claim audit update", async () => {
    state.failRetryRead = false;
    state.failAuditUpdate = true;
    await expect(alertMonitoringService.processDueAlertEmailRetries()).rejects.toThrow("audit update failed");
  });

  it("surfaces a failed retry-claim audit update but permits a benign claim miss", async () => {
    const claim = { auditEventId: "event-1", dedupeKey: "key-1", attemptCount: 1 };
    state.failAuditUpdate = true;
    await expect((alertMonitoringService as any).claimDueAlertEmailRetry(claim)).rejects.toThrow("audit update failed");
    state.failAuditUpdate = false;
    await expect((alertMonitoringService as any).claimDueAlertEmailRetry(claim)).resolves.toBeNull();
  });
});
