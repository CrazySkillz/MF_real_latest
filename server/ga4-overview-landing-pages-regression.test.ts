import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4Service } from "./analytics";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GA4 Overview Landing Pages certification boundary", () => {
  it("keeps the exact six-column contract without a Revenue column in UI or PDFs", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const scheduled = read("server/ga4-scheduled-report-pdf.ts");
    const ui = between(client, "{/* Landing Pages */}", "{/* Conversion Events */}");
    const browserPdf = between(client, "if (includeOverviewLandingPages)", "if (includeOverviewConversionEvents)");
    const scheduledPdf = between(scheduled, "if (includeLandingPages)", "if (includeConversionEvents)");

    for (const section of [ui, browserPdf, scheduledPdf]) {
      expect(section).toMatch(/Landing Page|LANDING PAGE/);
      expect(section).toMatch(/Source\/Medium|SOURCE\/MEDIUM/);
      expect(section).toMatch(/Sessions|SESSIONS/);
      expect(section).toMatch(/Users|USERS/);
      expect(section).toMatch(/Conversions|CONVERSIONS/);
      expect(section).toMatch(/Conv\. rate|CONV\. RATE/);
      expect(section).not.toMatch(/Revenue|REVENUE/);
    }
    expect(ui).toContain("const cr = sessions > 0 ? (conversions / sessions) * 100 : 0;");
    expect(browserPdf).toContain("formatPercentage(Number(r?.sessions || 0) > 0 ? (Number(r?.conversions || 0) / Number(r?.sessions || 0)) * 100 : 0)");
    expect(scheduledPdf).toContain("Number(row?.sessions || 0) > 0 ? (Number(row?.conversions || 0) / Number(row?.sessions || 0)) * 100 : 0");
    expect(ui).toContain("Users are directional and may overlap across landing pages");
  });

  it("keeps Landing Pages on the saved property, fixed import window, and read-only route", () => {
    const routes = read("server/routes-oauth.ts");
    const section = between(
      routes,
      'app.get("/api/campaigns/:id/ga4-landing-pages"',
      'app.get("/api/campaigns/:id/ga4-conversion-events"',
    );

    expect(section).toContain("ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(section).toContain("storage.getGA4Connection(campaignId, propertyId)");
    expect(section).toContain("resolveGA4ImportToDateWindow((connection as any)?.importStartDate, (campaign as any)?.reportingTimeZone)");
    expect(section).toContain("importToDateWindow?.endDate");
    expect(section).toContain("validationReadOnly");
    expect(section).toContain('res.setHeader("X-GA4-Validation-Read-Only", "1")');
    expect(section).toContain("campaignFilter");
  });

  it("refreshes on reload, focus, reconnect, and interval without cross-scope placeholder data", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const section = between(
      client,
      'queryKey: ["/api/campaigns", campaignId, "ga4-landing-pages"',
      'queryKey: ["/api/campaigns", campaignId, "ga4-conversion-events"',
    );

    expect(section).toContain("staleTime: 0");
    expect(section).toContain("refetchOnWindowFocus: true");
    expect(section).toContain("refetchOnReconnect: true");
    expect(section).toContain("refetchInterval: 10 * 60 * 1000");
    expect(section).toContain("refetchIntervalInBackground: true");
    expect(section).toContain("previousKey?.[1] === campaignId");
    expect(section).toContain("previousKey?.[4] === selectedGA4PropertyId");
    expect(section).toContain("params.set('readOnly', '1')");
  });

  it("distinguishes loading, empty, unavailable, and cached last-good states", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const ui = between(client, "{/* Landing Pages */}", "{/* Conversion Events */}");
    expect(ui).toContain("landingPagesLoading && ga4LandingPages === undefined");
    expect(ui).toContain("landingPagesUnavailable");
    expect(ui).toContain("Landing page data is unavailable. Refresh the page to try again.");
    expect(ui).toContain("GA4 did not provide session-scoped landing-page attribution for this campaign selection.");
    expect(client).toContain("landingPagesError && ga4LandingPages !== undefined");
    expect(client).toContain("Last successful values remain visible where available; unavailable values are marked.");
    expect(client).toContain("if (needsLandingPages && landingPagesUnavailable) unavailable.push(\"Landing Pages\")");
  });

  it("keeps the API top-50 envelope and renders the same first 20 rows in both PDF builders", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const scheduled = read("server/ga4-scheduled-report-pdf.ts");
    const query = between(
      client,
      'queryKey: ["/api/campaigns", campaignId, "ga4-landing-pages"',
      'queryKey: ["/api/campaigns", campaignId, "ga4-conversion-events"',
    );
    const browserPdf = between(client, "if (includeOverviewLandingPages)", "if (includeOverviewConversionEvents)");
    const scheduledPdf = between(scheduled, "if (includeLandingPages)", "if (includeConversionEvents)");
    expect(query).toContain("limit: '50'");
    expect(browserPdf).toContain("ga4LandingPages.rows : []).slice(0, 20)");
    expect(scheduledPdf).toContain("payload.landingPages?.rows || []).slice(0, 20)");
    expect(scheduled).toContain("getLandingPagesReport(campaignId, storage, overviewStartDate, propertyId, 50, campaignFilter, dailyEnd)");
  });

  it("uses only the requested campaign connection and its saved property", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 1,
        rows: [{
          dimensionValues: [{ value: "/saved" }, { value: "google" }, { value: "cpc" }],
          metricValues: [{ value: "7" }, { value: "5" }, { value: "2.5" }, { value: "19" }],
        }],
      }),
    }) as any);
    vi.stubGlobal("fetch", fetchMock);
    const getGA4Connection = vi.fn(async () => ({
      id: "connection-1", propertyId: "properties/987654", accessToken: "token",
    }));

    const result = await ga4Service.getLandingPagesReport(
      "campaign-exact", { getGA4Connection }, "2026-08-01", "987654", 50, ["saved-a", "saved-b"], "2026-09-14",
    );

    expect(getGA4Connection).toHaveBeenCalledWith("campaign-exact", "987654");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/properties/987654:runReport");
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || "{}"));
    expect(body.dateRanges).toEqual([{ startDate: "2026-08-01", endDate: "2026-09-14" }]);
    expect(body.dimensionFilter.orGroup.expressions.map((item: any) => item.filter.stringFilter.value)).toEqual(["saved-a", "saved-b"]);
    expect(result.rows[0]).toMatchObject({ sessions: 7, users: 5, conversions: 2.5, revenue: 19 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates conversion supplementation and keeps deterministic provider ordering", async () => {
    const fetchMock = vi.fn(async (_url: string, init: any) => {
      const body = JSON.parse(String(init?.body || "{}"));
      const dimensions = (body.dimensions || []).map((item: any) => item.name);
      const supplemental = dimensions[0] === "pageLocation";
      if (!supplemental) {
        return {
          ok: true,
          json: async () => ({
            rowCount: 1,
            rows: [{
              dimensionValues: [
                { value: "/target?utm_campaign=spring&utm_source=google&utm_medium=cpc" },
                { value: "google" },
                { value: "cpc" },
              ],
              metricValues: [{ value: "10" }, { value: "9" }, { value: "0" }, { value: "0" }],
            }],
          }),
        } as any;
      }
      const offset = Number(body.offset || 0);
      return {
        ok: true,
        json: async () => ({
          rowCount: 2,
          rows: offset === 0 ? [{
            dimensionValues: [
              { value: "https://example.test/other?utm_campaign=spring&utm_source=google&utm_medium=cpc" },
              { value: "google" },
              { value: "cpc" },
            ],
            metricValues: [{ value: "1" }, { value: "1" }, { value: "8" }, { value: "800" }],
          }] : [{
            dimensionValues: [
              { value: "https://example.test/target?utm_campaign=spring&utm_source=google&utm_medium=cpc" },
              { value: "google" },
              { value: "cpc" },
            ],
            metricValues: [{ value: "1" }, { value: "1" }, { value: "3" }, { value: "300" }],
          }],
        }),
      } as any;
    });
    vi.stubGlobal("fetch", fetchMock);
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: "connection-1", propertyId: "123", accessToken: "token", refreshToken: "refresh",
    })) };

    const result = await ga4Service.getLandingPagesReport(
      "campaign-1", storage, "2026-08-01", "123", 50, "spring", "2026-09-14",
    );

    expect(result.rows).toEqual([expect.objectContaining({ conversions: 3, revenue: 0 })]);
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse(String((init as any)?.body || "{}")));
    expect(bodies.filter((body) => body.dimensions?.[0]?.name === "pageLocation").map((body) => body.offset)).toEqual([0, 1]);
    expect(bodies[0].orderBys).toEqual([
      { metric: { metricName: "sessions" }, desc: true },
      { dimension: { dimensionName: "landingPagePlusQueryString" } },
      { dimension: { dimensionName: "sessionSource" } },
      { dimension: { dimensionName: "sessionMedium" } },
    ]);
  });

  it("fails read-only requests closed before OAuth refresh can mutate credentials", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false,
      text: async () => '{"error":{"code":401,"message":"Unauthenticated"}}',
    })));
    const updateGA4ConnectionTokens = vi.fn();
    const storage = {
      getGA4Connection: vi.fn(async () => ({
        id: "connection-1", propertyId: "123", accessToken: "expired", refreshToken: "refresh",
      })),
      updateGA4ConnectionTokens,
    };
    const refresh = vi.spyOn(ga4Service, "refreshAccessToken").mockResolvedValue({
      access_token: "replacement", expires_in: 3600,
    } as any);

    await expect(ga4Service.getLandingPagesReport(
      "campaign-1", storage, "2026-08-01", "123", 50, "spring", "2026-09-14", true,
    )).rejects.toThrow("TOKEN_EXPIRED");
    expect(refresh).not.toHaveBeenCalled();
    expect(updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("fails closed on duplicate session-scoped provider keys", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 2,
        rows: [1, 2].map(() => ({
          dimensionValues: [{ value: "/same" }, { value: "google" }, { value: "cpc" }],
          metricValues: [{ value: "2" }, { value: "2" }, { value: "0" }, { value: "0" }],
        })),
      }),
    })));
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: "connection-1", propertyId: "123", accessToken: "token",
    })) };

    await expect(ga4Service.getLandingPagesReport(
      "campaign-1", storage, "2026-08-01", "123", 50, "spring", "2026-09-14",
    )).rejects.toThrow("GA4_LANDING_PAGE_DUPLICATE_ROWS");
  });

  it("fails closed when the provider truncates the bounded top-row page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rowCount: 2,
        rows: [{
          dimensionValues: [{ value: "/only-one" }, { value: "google" }, { value: "cpc" }],
          metricValues: [{ value: "2" }, { value: "2" }, { value: "1" }, { value: "0" }],
        }],
      }),
    })));
    const storage = { getGA4Connection: vi.fn(async () => ({
      id: "connection-1", propertyId: "123", accessToken: "token",
    })) };

    await expect(ga4Service.getLandingPagesReport(
      "campaign-1", storage, "2026-08-01", "123", 50, "spring", "2026-09-14",
    )).rejects.toThrow("GA4_LANDING_PAGE_PAGINATION_INCOMPLETE");
  });

  it("keeps deployed reconciliation authenticated, revision-locked, and application-data read-only", () => {
    const audit = read("scripts/ga4-overview-landing-pages-live-readonly.ts");
    expect(audit).toContain("GA4_LANDING_PAGES_EXPECTED_SHA must be a full Git SHA");
    expect(audit).toContain('client.query("BEGIN TRANSACTION READ ONLY")');
    expect(audit).toContain("application persistence fingerprint");
    expect(audit).toContain("x-ga4-validation-read-only");
    expect(audit).toContain("x-ga4-credential-refresh-allowed");
    expect(audit).toContain("unauthenticated denial");
    expect(audit).toContain("cross-owner denial");
    expect(audit).toContain("different-property denial");
    expect(audit).toContain('window.dispatchEvent(new Event("visibilitychange"))');
    expect(audit).not.toContain('document.dispatchEvent(new Event("visibilitychange"))');
    expect(audit).toContain("focus did not refetch Landing Pages");
    expect(audit).toContain("reload row parity");
    expect(audit).toContain('getByText("Custom Report", { exact: true })');
    expect(audit).toContain('getByLabel("Landing Pages", { exact: true }).check()');
    expect(audit).toContain('scheduledPdfBuilder: "not executed against production; actual builder output and shared provider arguments are covered by the local focused fixture"');
  });
});
