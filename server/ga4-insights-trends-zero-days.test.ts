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
    expect(ga4Service.getTimeSeriesWithToken).toHaveBeenCalledTimes(1);
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

  it.each([{ label: "empty", dailyRows: [] }, { label: "populated", dailyRows: [{ date: "2026-09-04", sessions: 30, conversions: 2, revenue: 10 }] }])(
    "reuses $label daily rows and still checks traffic and conversion presence", async ({ dailyRows }) => {
      const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockResolvedValue([{ date: "wrong-response" }]);
      const requests: any[] = [];
      vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
        requests.push(JSON.parse(init.body));
        return ga4Response(requests.length === 1 ? ["2026-09-05"] : ["2026-09-06"]);
      }));
      const result = await (ga4Service.getTrendsDailyPresenceWithToken as any)(
        "542352127", "token", "2026-09-04", "2026-09-06", ["spring", "summer"], "USD", undefined, dailyRows,
      );
      expect(series).not.toHaveBeenCalled();
      expect(result.dailyRows).toBe(dailyRows);
      expect(result.presentDates).toEqual([...dailyRows.map(row => row.date), "2026-09-05", "2026-09-06"]);
      expect(requests).toHaveLength(2);
      expect(requests.every(request => request.currencyCode === "USD" && request.dateRanges[0].startDate === "2026-09-04" && request.dateRanges[0].endDate === "2026-09-06")).toBe(true);
      expect(requests.map(request => request.dimensionFilter.orGroup.expressions[0].filter.fieldName)).toEqual(["pageLocation", "campaignName"]);
    },
  );

  it.each(["provider", "currency", "date"])("still rejects a %s presence error when reusing daily rows", async (failure) => {
    const series = vi.spyOn(ga4Service, "getTimeSeriesWithToken").mockResolvedValue([]);
    vi.stubGlobal("fetch", vi.fn(async () => failure === "provider"
      ? { ok: false, text: async () => "provider unavailable" }
      : { ok: true, json: async () => ({ metadata: { currencyCode: failure === "currency" ? "EUR" : "USD" },
          rows: [{ dimensionValues: [{ value: "20260907" }] }] }) }));
    await expect((ga4Service.getTrendsDailyPresenceWithToken as any)(
      "542352127", "token", "2026-09-04", "2026-09-06", "spring", "USD", undefined, [],
    )).rejects.toThrow(failure === "provider" ? "provider unavailable" : failure === "currency" ? "currency is unverified" : "out-of-window date");
    expect(series).not.toHaveBeenCalled();
  });
});
