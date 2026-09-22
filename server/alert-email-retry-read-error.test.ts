import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ failRetryRead: true }));

vi.mock("./db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(async () => []) })) })),
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
  beforeEach(() => { state.failRetryRead = true; });

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
});
