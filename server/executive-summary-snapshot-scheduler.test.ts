import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  getInternalAutoRefreshToken: vi.fn(() => "internal-token"),
}));

vi.mock("./storage", () => ({ storage: { getCampaigns: mocks.getCampaigns } }));
vi.mock("./internal-request-auth", () => ({ getInternalAutoRefreshToken: mocks.getInternalAutoRefreshToken }));

import { captureExecutiveSummarySnapshots } from "./executive-summary-snapshot-scheduler";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Executive Summary snapshot scheduler", () => {
  it("captures each campaign once through the authenticated canonical aggregate route", async () => {
    mocks.getCampaigns.mockResolvedValue([{ id: "campaign one" }, { id: "campaign one" }, { id: "campaign-2" }]);
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel } });
    vi.stubGlobal("fetch", fetchMock);

    await captureExecutiveSummarySnapshots("http://127.0.0.1:5000");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1,
      "http://127.0.0.1:5000/api/campaigns/campaign%20one/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date",
      { headers: { "x-internal-auto-refresh-token": "internal-token" } },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(2,
      "http://127.0.0.1:5000/api/campaigns/campaign-2/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date",
      { headers: { "x-internal-auto-refresh-token": "internal-token" } },
    );
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it("continues safely when one campaign request fails", async () => {
    mocks.getCampaigns.mockResolvedValue([{ id: "campaign-1" }, { id: "campaign-2" }]);
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({ ok: true, status: 200, body: null });
    vi.stubGlobal("fetch", fetchMock);

    await expect(captureExecutiveSummarySnapshots("http://127.0.0.1:5000")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
