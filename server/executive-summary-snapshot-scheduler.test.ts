import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCampaigns: vi.fn(),
  getGA4Connections: vi.fn(),
  getInternalAutoRefreshToken: vi.fn(() => "internal-token"),
}));

vi.mock("./storage", () => ({ storage: { getCampaigns: mocks.getCampaigns, getGA4Connections: mocks.getGA4Connections } }));
vi.mock("./internal-request-auth", () => ({ getInternalAutoRefreshToken: mocks.getInternalAutoRefreshToken }));

import { captureExecutiveSummarySnapshot, captureExecutiveSummarySnapshots } from "./executive-summary-snapshot-scheduler";

beforeEach(() => {
  mocks.getGA4Connections.mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Executive Summary snapshot scheduler", () => {
  it("captures one campaign through the same authenticated canonical aggregate route", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel } });
    vi.stubGlobal("fetch", fetchMock);

    await expect(captureExecutiveSummarySnapshot("http://127.0.0.1:5000", "campaign one")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:5000/api/campaigns/campaign%20one/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date",
      { headers: { "x-internal-auto-refresh-token": "internal-token" } },
    );
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("captures each campaign once through the authenticated canonical aggregate route", async () => {
    mocks.getCampaigns.mockResolvedValue([{ id: "campaign one", status: "active" }, { id: "campaign one", status: "active" }, { id: "campaign-2", status: "active" }]);
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
    mocks.getCampaigns.mockResolvedValue([{ id: "campaign-1", status: "active" }, { id: "campaign-2", status: "active" }]);
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce({ ok: true, status: 200, body: null });
    vi.stubGlobal("fetch", fetchMock);

    await expect(captureExecutiveSummarySnapshots("http://127.0.0.1:5000")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("leaves active GA4 campaigns to the aligned GA4 daily pipeline", async () => {
    mocks.getCampaigns.mockResolvedValue([{ id: "ga4-campaign", status: "active" }, { id: "non-ga4-campaign", status: "active" }]);
    mocks.getGA4Connections.mockImplementation(async (campaignId: string) => campaignId === "ga4-campaign"
      ? [{ propertyId: "properties/123", isActive: true }]
      : []);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, body: null });
    vi.stubGlobal("fetch", fetchMock);

    await captureExecutiveSummarySnapshots("http://127.0.0.1:5000");

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/api/campaigns/non-ga4-campaign/outcome-totals");
  });

  it("preserves the prior snapshot when GA4 ownership cannot be verified", async () => {
    mocks.getCampaigns.mockResolvedValue([{ id: "campaign-1", status: "active" }]);
    mocks.getGA4Connections.mockRejectedValue(new Error("storage unavailable"));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(captureExecutiveSummarySnapshots("http://127.0.0.1:5000")).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
