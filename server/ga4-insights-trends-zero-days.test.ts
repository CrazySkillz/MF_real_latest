import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4Service } from "./analytics";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ga4Response = (dates: string[]) => ({
  ok: true,
  json: async () => ({
    metadata: { currencyCode: "USD" },
    rows: dates.map((date) => ({ dimensionValues: [{ value: date.replace(/-/g, "") }] })),
  }),
});

describe("Insights Trends read-only zero-day verification", () => {
  it("checks saved campaign traffic and conversions for the exact completed window", async () => {
    vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockResolvedValue([
      { date: "2026-09-04", sessions: 30 },
      { date: "2026-09-06", sessions: 34 },
    ]);
    const requests: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: any) => {
      requests.push(JSON.parse(String(init.body)));
      return ga4Response([]);
    }));

    const result = await ga4Service.getTrendsDailyPresenceWithToken(
      "542352127", "token", "2026-09-04", "2026-09-06", ["spring", "summer"], "USD",
    );

    expect(result.presentDates).toEqual(["2026-09-04", "2026-09-06"]);
    expect(requests).toHaveLength(2);
    expect(requests.every((request) => request.dateRanges[0].startDate === "2026-09-04" && request.dateRanges[0].endDate === "2026-09-06" && request.currencyCode === "USD")).toBe(true);
    expect(requests.map((request) => request.dimensionFilter.orGroup.expressions[0].filter.fieldName)).toEqual(["pageLocation", "campaignName"]);
    expect(requests[1].dimensionFilter.orGroup.expressions.map((expression: any) => expression.filter.stringFilter.value)).toEqual(["spring", "summer"]);
  });

  it("does not call a date zero when UTM traffic or a conversion exists", async () => {
    vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockResolvedValue([{ date: "2026-09-04", sessions: 30 }]);
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ga4Response(++call === 1 ? ["2026-09-05"] : ["2026-09-06"])));

    const result = await ga4Service.getTrendsDailyPresenceWithToken(
      "542352127", "token", "2026-09-04", "2026-09-06", "spring", "USD",
    );

    expect(result.presentDates).toEqual(["2026-09-04", "2026-09-05", "2026-09-06"]);
  });

  it("fails closed when any required presence report fails", async () => {
    vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, text: async () => "provider unavailable" })));

    await expect(ga4Service.getTrendsDailyPresenceWithToken(
      "542352127", "token", "2026-09-04", "2026-09-06", "spring", "USD",
    )).rejects.toThrow("provider unavailable");
  });
});
