interface GA4Credentials {
  propertyId: string;
  measurementId: string;
  accessToken?: string;
}

type CampaignFilter = string | string[] | undefined;

interface GA4Metrics {
  impressions: number;
  clicks: number;
  sessions: number;
  pageviews: number;
  bounceRate: number;
  averageSessionDuration: number;
  conversions: number;
  revenue?: number;
  activeUsers?: number;
  newUsers: number;
  userEngagementDuration: number;
  engagedSessions: number;
  engagementRate: number;
  eventCount: number;
  eventsPerSession: number;
  screenPageViewsPerSession: number;
  // Some GA4 setups (test/import/MP) can yield 0 sessions even when users exist.
  // In those cases we derive a session-like count from users so the UI isn't empty.
  sessionsDerivedFromUsers?: boolean;
}

import { JWT } from "google-auth-library";

export class GoogleAnalytics4Service {
  /**
   * GA4 Data API expects a numeric property id in URLs:
   *   https://analyticsdata.googleapis.com/v1beta/properties/{propertyId}:runReport
   *
   * But some flows may provide ids like:
   * - "properties/123456789"
   * - "/properties/123456789"
   * - "accounts/111/properties/123456789"
   *
   * Normalize to the numeric id so we always query the intended GA4 property.
   */
  private normalizeGA4PropertyId(propertyId: string): string {
    const raw = String(propertyId || "").trim();
    if (!raw) return raw;

    const match = raw.match(/properties\/(\d+)/i);
    if (match && match[1]) return match[1];

    return raw.replace(/^\/+/, "");
  }

  private normalizeCampaignFilter(filter: CampaignFilter): string[] {
    if (!filter) return [];
    if (Array.isArray(filter)) {
      return filter.map((v) => String(v || "").trim()).filter((v) => !!v);
    }
    const v = String(filter || "").trim();
    return v ? [v] : [];
  }

  private buildCampaignDimensionFilter(filter: CampaignFilter, fieldName: string = 'sessionCampaignName') {
    const values = this.normalizeCampaignFilter(filter);
    if (values.length === 0) return null;
    if (values.length === 1) {
      return {
        dimensionFilter: {
          filter: {
            fieldName,
            stringFilter: {
              matchType: 'EXACT',
              value: String(values[0]),
              caseSensitive: false,
            }
          }
        }
      };
    }
    return {
      dimensionFilter: {
        orGroup: {
          expressions: values.map((v) => ({
            filter: {
              fieldName,
              stringFilter: {
                matchType: 'EXACT',
                value: String(v),
                caseSensitive: false,
              }
            }
          }))
        }
      }
    };
  }

  private buildUtmCampaignPageLocationFilter(filter: CampaignFilter) {
    const values = this.normalizeCampaignFilter(filter);
    if (values.length === 0) return null;

    const expressions = values.flatMap((value) => {
      const encoded = encodeURIComponent(value);
      const plusEncoded = encoded.replace(/%20/g, '+');
      return Array.from(new Set([value, encoded, plusEncoded])).map((v) => ({
        filter: {
          fieldName: 'pageLocation',
          stringFilter: {
            matchType: 'CONTAINS',
            value: `utm_campaign=${v}`,
            caseSensitive: false,
          }
        }
      }));
    });

    if (expressions.length === 1) {
      return { dimensionFilter: expressions[0] };
    }
    return { dimensionFilter: { orGroup: { expressions } } };
  }

  private extractUrlSearchParam(value: string, param: string) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = raw.startsWith('/') ? new URL(raw, 'https://example.invalid') : new URL(raw);
      return String(url.searchParams.get(param) || '').trim();
    } catch {
      return '';
    }
  }

  private extractUrlPath(value: string) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
      const url = raw.startsWith('/') ? new URL(raw, 'https://example.invalid') : new URL(raw);
      return url.pathname || '/';
    } catch {
      return raw.split('?')[0] || raw;
    }
  }

  async getLandingPagesReport(
    campaignId: string,
    storage: any,
    dateRange = '30daysAgo',
    propertyId?: string,
    limit: number = 50,
    campaignFilter?: CampaignFilter
  ): Promise<{
    propertyId: string;
    revenueMetric: 'totalRevenue' | 'purchaseRevenue';
    rows: Array<{ landingPage: string; source: string; medium: string; sessions: number; users: number; conversions: number; revenue: number }>;
    totals: { sessions: number; users: number; conversions: number; revenue: number };
    meta: { usersAreNonAdditive: boolean };
  }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) throw new Error('NO_GA4_CONNECTION');
    if (!connection.accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);
    const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
    const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);
    const dims = [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSource' }, { name: 'sessionMedium' }];
    const pageLocationDims = [{ name: 'pageLocation' }];

    const run = async (
      accessToken: string,
      revenueMetric: 'totalRevenue' | 'purchaseRevenue',
      scopeFilter: any = campaignDimensionFilter,
      dimensions: Array<{ name: string }> = dims
    ) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateRange, endDate: 'today' }],
          dimensions,
          ...(scopeFilter ? scopeFilter : {}),
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }, { name: revenueMetric }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 10000),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      const json = await resp.json().catch(() => ({} as any));
      return json;
    };

    const parseRows = (json: any, revenueMetric: 'totalRevenue' | 'purchaseRevenue', parseUtmFromPageLocation = false) => {
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const out: Array<{ landingPage: string; source: string; medium: string; sessions: number; users: number; conversions: number; revenue: number }> = [];
      let totalSessions = 0;
      let totalUsers = 0;
      let totalConversions = 0;
      let totalRevenue = 0;

      for (const r of rows) {
        const firstDim = String(r?.dimensionValues?.[0]?.value || '').trim();
        const landingPage = parseUtmFromPageLocation
          ? (this.extractUrlPath(firstDim) || '(not set)')
          : (firstDim || '(not set)');
        const source = parseUtmFromPageLocation
          ? (this.extractUrlSearchParam(firstDim, 'utm_source') || '(not set)')
          : (String(r?.dimensionValues?.[1]?.value || '').trim() || '(not set)');
        const medium = parseUtmFromPageLocation
          ? (this.extractUrlSearchParam(firstDim, 'utm_medium') || '(not set)')
          : (String(r?.dimensionValues?.[2]?.value || '').trim() || '(not set)');
        const sessions = parseInt(String(r?.metricValues?.[0]?.value || '0'), 10) || 0;
        const users = parseInt(String(r?.metricValues?.[1]?.value || '0'), 10) || 0;
        const conversions = parseInt(String(r?.metricValues?.[2]?.value || '0'), 10) || 0;
        const revenue = Number.parseFloat(String(r?.metricValues?.[3]?.value || '0')) || 0;
        totalSessions += sessions;
        totalUsers += users;
        totalConversions += conversions;
        totalRevenue += revenue;
        out.push({ landingPage, source, medium, sessions, users, conversions, revenue: Number(revenue.toFixed(2)) });
      }

      return {
        revenueMetric,
        rows: out,
        totals: {
          sessions: totalSessions,
          users: totalUsers,
          conversions: totalConversions,
          revenue: Number(totalRevenue.toFixed(2)),
        },
      };
    };

    const isAuthErrorText = (txt: string) => {
      const t = String(txt || '').toLowerCase();
      return t.includes('"code": 401') || t.includes('unauthenticated') || t.includes('invalid authentication credentials') || t.includes('invalid_grant');
    };

    const fetchRows = async (accessToken: string, scopeFilter: any, parseUtmFromPageLocation = false) => {
      try {
        const json = await run(accessToken, 'totalRevenue', scopeFilter, parseUtmFromPageLocation ? pageLocationDims : dims);
        return parseRows(json, 'totalRevenue', parseUtmFromPageLocation);
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        // Some properties don't allow totalRevenue; try purchaseRevenue.
        if (msg.toLowerCase().includes('totalrevenue') || msg.toLowerCase().includes('metric') || msg.toLowerCase().includes('invalid')) {
          const json2 = await run(accessToken, 'purchaseRevenue', scopeFilter, parseUtmFromPageLocation ? pageLocationDims : dims);
          return parseRows(json2, 'purchaseRevenue', parseUtmFromPageLocation);
        }
        throw e;
      }
    };
    const isEmptyResult = (res: any) =>
      !Array.isArray(res?.rows) || res.rows.length === 0 ||
      ((Number(res?.totals?.sessions || 0) + Number(res?.totals?.users || 0) + Number(res?.totals?.conversions || 0) + Number(res?.totals?.revenue || 0)) <= 0);
    const hasTrafficRows = (res: any) =>
      Array.isArray(res?.rows) && res.rows.some((r: any) => Number(r?.sessions || 0) > 0 || Number(r?.users || 0) > 0);
    const hasConversionRevenueRows = (res: any) =>
      Array.isArray(res?.rows) && res.rows.some((r: any) => Number(r?.conversions || 0) > 0 || Number(r?.revenue || 0) > 0);
    const rowKey = (row: any) =>
      `${String(row?.landingPage || '').trim()}|${String(row?.source || '').trim()}|${String(row?.medium || '').trim()}`.toLowerCase();
    const supplementMissingConversionRows = (base: any, supplement: any) => {
      if (!hasTrafficRows(base) || hasConversionRevenueRows(base) || !hasConversionRevenueRows(supplement)) return base;
      const supplementByKey = new Map<string, { conversions: number; revenue: number }>();
      for (const row of supplement.rows || []) {
        const key = rowKey(row);
        if (!key) continue;
        const current = supplementByKey.get(key) || { conversions: 0, revenue: 0 };
        supplementByKey.set(key, {
          conversions: current.conversions + (Number(row?.conversions || 0) || 0),
          revenue: current.revenue + (Number(row?.revenue || 0) || 0),
        });
      }
      let changed = false;
      const rows = (base.rows || []).map((row: any) => {
        const match = supplementByKey.get(rowKey(row));
        if (!match || (match.conversions <= 0 && match.revenue <= 0)) return row;
        changed = true;
        return { ...row, conversions: match.conversions, revenue: Number(match.revenue.toFixed(2)) };
      });
      if (!changed) return base;
      return {
        ...base,
        revenueMetric: supplement.revenueMetric || base.revenueMetric,
        rows,
        totals: {
          ...base.totals,
          conversions: rows.reduce((sum: number, row: any) => sum + (Number(row?.conversions || 0) || 0), 0),
          revenue: Number(rows.reduce((sum: number, row: any) => sum + (Number(row?.revenue || 0) || 0), 0).toFixed(2)),
        },
      };
    };

    const tryFetch = async (accessToken: string) => {
      const res = await fetchRows(accessToken, campaignDimensionFilter);
      if (!pageLocationCampaignFilter) return res;
      if (!isEmptyResult(res) && hasConversionRevenueRows(res)) return res;
      const utmRes = await fetchRows(accessToken, pageLocationCampaignFilter, true).catch(() => null);
      if (!utmRes || isEmptyResult(utmRes)) return res;
      if (!isEmptyResult(res)) return supplementMissingConversionRows(res, utmRes);
      return utmRes;
    };

    try {
      const res = await tryFetch(String(connection.accessToken));
      return { propertyId: normalizedPropertyId, ...res, meta: { usersAreNonAdditive: true } };
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (isAuthErrorText(msg) && connection.refreshToken) {
        const refresh = await this.refreshAccessToken(
          String(connection.refreshToken),
          connection.clientId || undefined,
          connection.clientSecret || undefined
        );
        await storage.updateGA4ConnectionTokens(connection.id, {
          accessToken: refresh.access_token,
          refreshToken: String(connection.refreshToken),
          expiresAt: new Date(Date.now() + (refresh.expires_in * 1000)),
        });
        const res = await tryFetch(refresh.access_token);
        return { propertyId: normalizedPropertyId, ...res, meta: { usersAreNonAdditive: true } };
      }
      throw e;
    }
  }

  async getConversionEventsReport(
    campaignId: string,
    storage: any,
    dateRange = '30daysAgo',
    propertyId?: string,
    limit: number = 50,
    campaignFilter?: CampaignFilter
  ): Promise<{
    propertyId: string;
    revenueMetric: 'totalRevenue' | 'purchaseRevenue';
    rows: Array<{ eventName: string; conversions: number; eventCount: number; users: number; revenue: number }>;
    totals: { conversions: number; eventCount: number; users: number; revenue: number };
  }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) throw new Error('NO_GA4_CONNECTION');
    if (!connection.accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);
    const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
    const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);

    const run = async (accessToken: string, revenueMetric: 'totalRevenue' | 'purchaseRevenue', scopeFilter: any = campaignDimensionFilter) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateRange, endDate: 'today' }],
          dimensions: [{ name: 'eventName' }],
          ...(scopeFilter ? scopeFilter : {}),
          metrics: [{ name: 'conversions' }, { name: 'eventCount' }, { name: 'totalUsers' }, { name: revenueMetric }],
          orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 10000),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      const json = await resp.json().catch(() => ({} as any));
      return json;
    };

    const parseRows = (json: any, revenueMetric: 'totalRevenue' | 'purchaseRevenue') => {
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const out: Array<{ eventName: string; conversions: number; eventCount: number; users: number; revenue: number }> = [];
      let totalConversions = 0;
      let totalEventCount = 0;
      let totalUsers = 0;
      let totalRevenue = 0;

      for (const r of rows) {
        const eventName = String(r?.dimensionValues?.[0]?.value || '').trim() || '(not set)';
        const conversions = parseInt(String(r?.metricValues?.[0]?.value || '0'), 10) || 0;
        const eventCount = parseInt(String(r?.metricValues?.[1]?.value || '0'), 10) || 0;
        const users = parseInt(String(r?.metricValues?.[2]?.value || '0'), 10) || 0;
        const revenue = Number.parseFloat(String(r?.metricValues?.[3]?.value || '0')) || 0;
        totalConversions += conversions;
        totalEventCount += eventCount;
        totalUsers += users;
        totalRevenue += revenue;
        out.push({ eventName, conversions, eventCount, users, revenue: Number(revenue.toFixed(2)) });
      }
      return {
        revenueMetric,
        rows: out,
        totals: { conversions: totalConversions, eventCount: totalEventCount, users: totalUsers, revenue: Number(totalRevenue.toFixed(2)) },
      };
    };

    const isAuthErrorText = (txt: string) => {
      const t = String(txt || '').toLowerCase();
      return t.includes('"code": 401') || t.includes('unauthenticated') || t.includes('invalid authentication credentials') || t.includes('invalid_grant');
    };

    const fetchRows = async (accessToken: string, scopeFilter: any) => {
      try {
        const json = await run(accessToken, 'totalRevenue', scopeFilter);
        return parseRows(json, 'totalRevenue');
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.toLowerCase().includes('totalrevenue') || msg.toLowerCase().includes('metric') || msg.toLowerCase().includes('invalid')) {
          const json2 = await run(accessToken, 'purchaseRevenue', scopeFilter);
          return parseRows(json2, 'purchaseRevenue');
        }
        throw e;
      }
    };
    const isEmptyResult = (res: any) =>
      !Array.isArray(res?.rows) || res.rows.length === 0 ||
      ((Number(res?.totals?.conversions || 0) + Number(res?.totals?.eventCount || 0) + Number(res?.totals?.users || 0) + Number(res?.totals?.revenue || 0)) <= 0);
    const hasEventRows = (res: any) =>
      Array.isArray(res?.rows) && res.rows.some((r: any) => Number(r?.eventCount || 0) > 0 || Number(r?.users || 0) > 0);
    const hasConversionRevenueRows = (res: any) =>
      Array.isArray(res?.rows) && res.rows.some((r: any) => Number(r?.conversions || 0) > 0 || Number(r?.revenue || 0) > 0);
    const eventKey = (row: any) => String(row?.eventName || '').trim().toLowerCase();
    const supplementMissingConversionRows = (base: any, supplement: any) => {
      if (!hasEventRows(base) || hasConversionRevenueRows(base) || !hasConversionRevenueRows(supplement)) return base;
      const supplementByKey = new Map<string, { conversions: number; revenue: number }>();
      for (const row of supplement.rows || []) {
        const key = eventKey(row);
        if (!key) continue;
        const current = supplementByKey.get(key) || { conversions: 0, revenue: 0 };
        supplementByKey.set(key, {
          conversions: current.conversions + (Number(row?.conversions || 0) || 0),
          revenue: current.revenue + (Number(row?.revenue || 0) || 0),
        });
      }
      let changed = false;
      const rows = (base.rows || []).map((row: any) => {
        const match = supplementByKey.get(eventKey(row));
        if (!match || (match.conversions <= 0 && match.revenue <= 0)) return row;
        changed = true;
        return { ...row, conversions: match.conversions, revenue: Number(match.revenue.toFixed(2)) };
      });
      if (!changed) return base;
      return {
        ...base,
        revenueMetric: supplement.revenueMetric || base.revenueMetric,
        rows,
        totals: {
          ...base.totals,
          conversions: rows.reduce((sum: number, row: any) => sum + (Number(row?.conversions || 0) || 0), 0),
          revenue: Number(rows.reduce((sum: number, row: any) => sum + (Number(row?.revenue || 0) || 0), 0).toFixed(2)),
        },
      };
    };

    const tryFetch = async (accessToken: string) => {
      const res = await fetchRows(accessToken, campaignDimensionFilter);
      if (!pageLocationCampaignFilter) return res;
      if (!isEmptyResult(res) && hasConversionRevenueRows(res)) return res;
      const utmRes = await fetchRows(accessToken, pageLocationCampaignFilter).catch(() => null);
      if (!utmRes || isEmptyResult(utmRes)) return res;
      if (!isEmptyResult(res)) return supplementMissingConversionRows(res, utmRes);
      return utmRes;
    };

    try {
      const res = await tryFetch(String(connection.accessToken));
      return { propertyId: normalizedPropertyId, ...res };
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (isAuthErrorText(msg) && connection.refreshToken) {
        const refresh = await this.refreshAccessToken(
          String(connection.refreshToken),
          connection.clientId || undefined,
          connection.clientSecret || undefined
        );
        await storage.updateGA4ConnectionTokens(connection.id, {
          accessToken: refresh.access_token,
          refreshToken: String(connection.refreshToken),
          expiresAt: new Date(Date.now() + (refresh.expires_in * 1000)),
        });
        const res = await tryFetch(refresh.access_token);
        return { propertyId: normalizedPropertyId, ...res };
      }
      throw e;
    }
  }

  async getLandingPagesWoWReport(
    campaignId: string,
    storage: any,
    propertyId?: string,
    limit: number = 50,
    campaignFilter?: CampaignFilter
  ): Promise<{
    propertyId: string;
    revenueMetric: 'totalRevenue' | 'purchaseRevenue';
    rows: Array<{
      landingPage: string;
      source: string;
      medium: string;
      last7: { sessions: number; users: number; conversions: number; revenue: number };
      prev7: { sessions: number; users: number; conversions: number; revenue: number };
    }>;
    totals: {
      last7: { sessions: number; users: number; conversions: number; revenue: number };
      prev7: { sessions: number; users: number; conversions: number; revenue: number };
    };
    meta: { usersAreNonAdditive: boolean };
  }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) throw new Error('NO_GA4_CONNECTION');
    if (!connection.accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);
    const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
    const dims = [{ name: 'landingPagePlusQueryString' }, { name: 'sessionSource' }, { name: 'sessionMedium' }];

    const run = async (accessToken: string, revenueMetric: 'totalRevenue' | 'purchaseRevenue') => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [
            { name: 'last7', startDate: '7daysAgo', endDate: 'today' },
            { name: 'prev7', startDate: '14daysAgo', endDate: '8daysAgo' },
          ],
          dimensions: dims,
          ...(campaignDimensionFilter ? campaignDimensionFilter : {}),
          metrics: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'conversions' }, { name: revenueMetric }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 10000),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return await resp.json().catch(() => ({} as any));
    };

    const parse = (json: any, revenueMetric: 'totalRevenue' | 'purchaseRevenue') => {
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const out: Array<{
        landingPage: string;
        source: string;
        medium: string;
        last7: { sessions: number; users: number; conversions: number; revenue: number };
        prev7: { sessions: number; users: number; conversions: number; revenue: number };
      }> = [];

      let last7Sessions = 0;
      let last7Users = 0;
      let last7Conversions = 0;
      let last7Revenue = 0;
      let prev7Sessions = 0;
      let prev7Users = 0;
      let prev7Conversions = 0;
      let prev7Revenue = 0;

      for (const r of rows) {
        const landingPage = String(r?.dimensionValues?.[0]?.value || '').trim() || '(not set)';
        const source = String(r?.dimensionValues?.[1]?.value || '').trim() || '(not set)';
        const medium = String(r?.dimensionValues?.[2]?.value || '').trim() || '(not set)';
        const mv: any[] = Array.isArray(r?.metricValues) ? r.metricValues : [];
        // Metric values are ordered as metrics × dateRanges (so 4 metrics × 2 ranges = 8 values).
        const readRange = (rangeIdx: 0 | 1) => {
          const base = rangeIdx; // 0=last7, 1=prev7
          const sessions = parseInt(String(mv[0 * 2 + base]?.value || '0'), 10) || 0;
          const users = parseInt(String(mv[1 * 2 + base]?.value || '0'), 10) || 0;
          const conversions = parseInt(String(mv[2 * 2 + base]?.value || '0'), 10) || 0;
          const revenue = Number.parseFloat(String(mv[3 * 2 + base]?.value || '0')) || 0;
          return { sessions, users, conversions, revenue: Number(revenue.toFixed(2)) };
        };

        const last7 = readRange(0);
        const prev7 = readRange(1);

        last7Sessions += last7.sessions;
        last7Users += last7.users;
        last7Conversions += last7.conversions;
        last7Revenue += last7.revenue;

        prev7Sessions += prev7.sessions;
        prev7Users += prev7.users;
        prev7Conversions += prev7.conversions;
        prev7Revenue += prev7.revenue;

        out.push({ landingPage, source, medium, last7, prev7 });
      }

      return {
        revenueMetric,
        rows: out,
        totals: {
          last7: {
            sessions: last7Sessions,
            users: last7Users,
            conversions: last7Conversions,
            revenue: Number(last7Revenue.toFixed(2)),
          },
          prev7: {
            sessions: prev7Sessions,
            users: prev7Users,
            conversions: prev7Conversions,
            revenue: Number(prev7Revenue.toFixed(2)),
          },
        },
        meta: { usersAreNonAdditive: true },
      };
    };

    const isAuthErrorText = (txt: string) => {
      const t = String(txt || '').toLowerCase();
      return t.includes('"code": 401') || t.includes('unauthenticated') || t.includes('invalid authentication credentials') || t.includes('invalid_grant');
    };

    const tryFetch = async (accessToken: string) => {
      try {
        const json = await run(accessToken, 'totalRevenue');
        return parse(json, 'totalRevenue');
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.toLowerCase().includes('totalrevenue') || msg.toLowerCase().includes('metric') || msg.toLowerCase().includes('invalid')) {
          const json2 = await run(accessToken, 'purchaseRevenue');
          return parse(json2, 'purchaseRevenue');
        }
        throw e;
      }
    };

    try {
      const res = await tryFetch(String(connection.accessToken));
      return { propertyId: normalizedPropertyId, ...res };
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (isAuthErrorText(msg) && connection.refreshToken) {
        const refresh = await this.refreshAccessToken(
          String(connection.refreshToken),
          connection.clientId || undefined,
          connection.clientSecret || undefined
        );
        await storage.updateGA4ConnectionTokens(connection.id, {
          accessToken: refresh.access_token,
          refreshToken: String(connection.refreshToken),
          expiresAt: new Date(Date.now() + (refresh.expires_in * 1000)),
        });
        const res = await tryFetch(refresh.access_token);
        return { propertyId: normalizedPropertyId, ...res };
      }
      throw e;
    }
  }

  async getConversionEventsWoWReport(
    campaignId: string,
    storage: any,
    propertyId?: string,
    limit: number = 50,
    campaignFilter?: CampaignFilter
  ): Promise<{
    propertyId: string;
    revenueMetric: 'totalRevenue' | 'purchaseRevenue';
    rows: Array<{
      eventName: string;
      last7: { conversions: number; eventCount: number; users: number; revenue: number };
      prev7: { conversions: number; eventCount: number; users: number; revenue: number };
    }>;
    totals: {
      last7: { conversions: number; eventCount: number; users: number; revenue: number };
      prev7: { conversions: number; eventCount: number; users: number; revenue: number };
    };
  }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) throw new Error('NO_GA4_CONNECTION');
    if (!connection.accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);
    const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');

    const run = async (accessToken: string, revenueMetric: 'totalRevenue' | 'purchaseRevenue') => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [
            { name: 'last7', startDate: '7daysAgo', endDate: 'today' },
            { name: 'prev7', startDate: '14daysAgo', endDate: '8daysAgo' },
          ],
          dimensions: [{ name: 'eventName' }],
          ...(campaignDimensionFilter ? campaignDimensionFilter : {}),
          metrics: [{ name: 'conversions' }, { name: 'eventCount' }, { name: 'totalUsers' }, { name: revenueMetric }],
          orderBys: [{ metric: { metricName: 'conversions' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 10000),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt);
      }
      return await resp.json().catch(() => ({} as any));
    };

    const parse = (json: any, revenueMetric: 'totalRevenue' | 'purchaseRevenue') => {
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const out: Array<{
        eventName: string;
        last7: { conversions: number; eventCount: number; users: number; revenue: number };
        prev7: { conversions: number; eventCount: number; users: number; revenue: number };
      }> = [];

      let last7Conversions = 0;
      let last7EventCount = 0;
      let last7Users = 0;
      let last7Revenue = 0;
      let prev7Conversions = 0;
      let prev7EventCount = 0;
      let prev7Users = 0;
      let prev7Revenue = 0;

      for (const r of rows) {
        const eventName = String(r?.dimensionValues?.[0]?.value || '').trim() || '(not set)';
        const mv: any[] = Array.isArray(r?.metricValues) ? r.metricValues : [];
        const readRange = (rangeIdx: 0 | 1) => {
          const base = rangeIdx;
          const conversions = parseInt(String(mv[0 * 2 + base]?.value || '0'), 10) || 0;
          const eventCount = parseInt(String(mv[1 * 2 + base]?.value || '0'), 10) || 0;
          const users = parseInt(String(mv[2 * 2 + base]?.value || '0'), 10) || 0;
          const revenue = Number.parseFloat(String(mv[3 * 2 + base]?.value || '0')) || 0;
          return { conversions, eventCount, users, revenue: Number(revenue.toFixed(2)) };
        };
        const last7 = readRange(0);
        const prev7 = readRange(1);

        last7Conversions += last7.conversions;
        last7EventCount += last7.eventCount;
        last7Users += last7.users;
        last7Revenue += last7.revenue;
        prev7Conversions += prev7.conversions;
        prev7EventCount += prev7.eventCount;
        prev7Users += prev7.users;
        prev7Revenue += prev7.revenue;

        out.push({ eventName, last7, prev7 });
      }

      return {
        revenueMetric,
        rows: out,
        totals: {
          last7: {
            conversions: last7Conversions,
            eventCount: last7EventCount,
            users: last7Users,
            revenue: Number(last7Revenue.toFixed(2)),
          },
          prev7: {
            conversions: prev7Conversions,
            eventCount: prev7EventCount,
            users: prev7Users,
            revenue: Number(prev7Revenue.toFixed(2)),
          },
        },
      };
    };

    const isAuthErrorText = (txt: string) => {
      const t = String(txt || '').toLowerCase();
      return t.includes('"code": 401') || t.includes('unauthenticated') || t.includes('invalid authentication credentials') || t.includes('invalid_grant');
    };

    const tryFetch = async (accessToken: string) => {
      try {
        const json = await run(accessToken, 'totalRevenue');
        return parse(json, 'totalRevenue');
      } catch (e: any) {
        const msg = String(e?.message || e || '');
        if (msg.toLowerCase().includes('totalrevenue') || msg.toLowerCase().includes('metric') || msg.toLowerCase().includes('invalid')) {
          const json2 = await run(accessToken, 'purchaseRevenue');
          return parse(json2, 'purchaseRevenue');
        }
        throw e;
      }
    };

    try {
      const res = await tryFetch(String(connection.accessToken));
      return { propertyId: normalizedPropertyId, ...res };
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (isAuthErrorText(msg) && connection.refreshToken) {
        const refresh = await this.refreshAccessToken(
          String(connection.refreshToken),
          connection.clientId || undefined,
          connection.clientSecret || undefined
        );
        await storage.updateGA4ConnectionTokens(connection.id, {
          accessToken: refresh.access_token,
          refreshToken: String(connection.refreshToken),
          expiresAt: new Date(Date.now() + (refresh.expires_in * 1000)),
        });
        const res = await tryFetch(refresh.access_token);
        return { propertyId: normalizedPropertyId, ...res };
      }
      throw e;
    }
  }

  async getMetricsWithToken(
    propertyId: string,
    accessToken: string,
    dateRange = 'today',
    campaignFilter?: CampaignFilter
  ): Promise<GA4Metrics> {
    const normalizedPropertyId = this.normalizeGA4PropertyId(propertyId);
    const credentials = { propertyId: normalizedPropertyId, measurementId: '', accessToken };
    return this.getMetrics(credentials, accessToken, dateRange, campaignFilter);
  }

  /**
   * Fetch a single "to-date" totals row for a campaign filter:
   * sessions, users, conversions, revenue (totalRevenue | purchaseRevenue).
   *
   * startDate: YYYY-MM-DD (inclusive)
   * endDate: YYYY-MM-DD (inclusive) OR 'yesterday'/'today'
   */
  async getTotalsWithRevenue(
    propertyId: string,
    accessToken: string,
    startDate: string,
    endDate: string,
    campaignFilter?: CampaignFilter
  ): Promise<{ revenueMetric: 'totalRevenue' | 'purchaseRevenue'; totals: { sessions: number; users: number; conversions: number; pageviews: number; revenue: number; engagedSessions: number; engagementRate: number } }> {
    const normalizedPropertyId = this.normalizeGA4PropertyId(propertyId);
    const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
    const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);

    const run = async (revenueMetric: 'totalRevenue' | 'purchaseRevenue', scopeFilter: any = campaignDimensionFilter, endDateOverride: string = endDate) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate: endDateOverride }],
          ...(scopeFilter ? scopeFilter : {}),
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'conversions' },
            { name: 'screenPageViews' },
            { name: revenueMetric },
            { name: 'engagedSessions' },
            { name: 'engagementRate' },
          ],
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`GA4 API Error: ${txt}`);
      }
      const json = await resp.json().catch(() => ({} as any));
      const row = (Array.isArray(json?.rows) && json.rows[0]) ? json.rows[0] : null;
      const mv = Array.isArray(row?.metricValues) ? row.metricValues : [];
      const sessions = parseInt(String(mv?.[0]?.value || '0'), 10) || 0;
      const users = parseInt(String(mv?.[1]?.value || '0'), 10) || 0;
      const conversions = parseInt(String(mv?.[2]?.value || '0'), 10) || 0;
      const pageviews = parseInt(String(mv?.[3]?.value || '0'), 10) || 0;
      const revenue = Number.parseFloat(String(mv?.[4]?.value || '0')) || 0;
      const engagedSessions = parseInt(String(mv?.[5]?.value || '0'), 10) || 0;
      const rawEngagementRate = Number.parseFloat(String(mv?.[6]?.value || '0')) || 0;
      const engagementRate = rawEngagementRate || (sessions > 0 ? engagedSessions / sessions : 0);
      return { revenueMetric, totals: { sessions, users, conversions, pageviews, revenue: Number(revenue.toFixed(2)), engagedSessions, engagementRate } };
    };

    const runWithRevenueFallback = async (scopeFilter: any, endDateOverride: string = endDate) => {
      try {
        return await run('totalRevenue', scopeFilter, endDateOverride);
      } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        // Some properties don't allow totalRevenue; try purchaseRevenue.
        if (msg.includes('totalrevenue') || msg.includes('metric') || msg.includes('invalid')) {
          return await run('purchaseRevenue', scopeFilter, endDateOverride);
        }
        throw e;
      }
    };

    const runConversionRevenueTotals = async (revenueMetric: 'totalRevenue' | 'purchaseRevenue', scopeFilter: any) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate, endDate }],
          ...(scopeFilter ? scopeFilter : {}),
          metrics: [
            { name: 'conversions' },
            { name: revenueMetric },
          ],
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`GA4 Conversion/Revenue API Error: ${txt}`);
      }
      const json = await resp.json().catch(() => ({} as any));
      const row = (Array.isArray(json?.rows) && json.rows[0]) ? json.rows[0] : null;
      const mv = Array.isArray(row?.metricValues) ? row.metricValues : [];
      const conversions = parseInt(String(mv?.[0]?.value || '0'), 10) || 0;
      const revenue = Number.parseFloat(String(mv?.[1]?.value || '0')) || 0;
      return { revenueMetric, totals: { conversions, revenue: Number(revenue.toFixed(2)) } };
    };

    const runConversionRevenueTotalsWithFallback = async (scopeFilter: any) => {
      try {
        return await runConversionRevenueTotals('totalRevenue', scopeFilter);
      } catch (e: any) {
        const msg = String(e?.message || '').toLowerCase();
        if (msg.includes('totalrevenue') || msg.includes('metric') || msg.includes('invalid')) {
          return await runConversionRevenueTotals('purchaseRevenue', scopeFilter);
        }
        throw e;
      }
    };

    const isEmptyTotals = (result: Awaited<ReturnType<typeof run>>) => {
      const totals = result?.totals || {};
      return (Number(totals.sessions || 0) + Number(totals.users || 0) + Number(totals.conversions || 0) + Number(totals.pageviews || 0) + Number(totals.revenue || 0)) <= 0;
    };

    const hasTrafficTotals = (result: Awaited<ReturnType<typeof run>>) => {
      const totals = result?.totals || {};
      return (
        Number(totals.sessions || 0) > 0 ||
        Number(totals.users || 0) > 0 ||
        Number(totals.pageviews || 0) > 0
      );
    };

    const hasConversionRevenueTotals = (result: Awaited<ReturnType<typeof run>>) => {
      const totals = result?.totals || {};
      return Number(totals.conversions || 0) > 0 || Number(totals.revenue || 0) > 0;
    };

    const supplementConversionRevenueTotals = async (result: Awaited<ReturnType<typeof run>>) => {
      const campaignNameFilter = this.buildCampaignDimensionFilter(campaignFilter, 'campaignName');
      if (!campaignNameFilter || !hasTrafficTotals(result) || hasConversionRevenueTotals(result)) return result;

      const supplement = await runConversionRevenueTotalsWithFallback(campaignNameFilter).catch(() => null);
      if (!supplement || (Number(supplement.totals.conversions || 0) <= 0 && Number(supplement.totals.revenue || 0) <= 0)) return result;

      return {
        revenueMetric: supplement.revenueMetric || result.revenueMetric,
        totals: {
          ...result.totals,
          conversions: supplement.totals.conversions,
          revenue: supplement.totals.revenue,
        },
      };
    };

    try {
      const result = await runWithRevenueFallback(campaignDimensionFilter);
      if (!isEmptyTotals(result) || !pageLocationCampaignFilter) return await supplementConversionRevenueTotals(result);
      const utmResult = await runWithRevenueFallback(pageLocationCampaignFilter, 'today').catch(() => null);
      const selectedResult = utmResult && !isEmptyTotals(utmResult) ? utmResult : result;
      return await supplementConversionRevenueTotals(selectedResult);
    } catch (e: any) {
      throw e;
    }
  }

  /**
   * Fetches an acquisition-style breakdown matching common marketing tables:
   * Date, Channel, Source, Medium, Campaign, Device, Country, Sessions, Conversions, Revenue.
   *
   * Uses GA4 Data API runReport with session-scoped dimensions.
   */
  async getAcquisitionBreakdown(
    campaignId: string,
    storage: any,
    dateRange = '30daysAgo',
    propertyId?: string,
    limit: number = 2000,
    campaignFilter?: CampaignFilter
  ): Promise<{
    rows: Array<Record<string, any>>;
    totals: { sessions: number; sessionsRaw: number; users: number; conversions: number; revenue: number };
    meta: { propertyId: string; revenueMetric: string; dimensions: string[]; rowCount: number; sessionsDerivedFromUsers: boolean };
  }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) {
      throw new Error('NO_GA4_CONNECTION');
    }

    // Prefer stored OAuth access token; fall back to service-account if configured.
    let accessToken: string | null = connection.accessToken ? String(connection.accessToken) : null;
    if (!accessToken && connection.serviceAccountKey) {
      try {
        const keyObj = typeof connection.serviceAccountKey === 'string'
          ? JSON.parse(connection.serviceAccountKey)
          : connection.serviceAccountKey;
        const email = String(keyObj?.client_email || '');
        const key = String(keyObj?.private_key || '');
        if (email && key) {
          const jwt = new JWT({
            email,
            key,
            scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
          });
          const tokenResp = await jwt.getAccessToken();
          accessToken = tokenResp?.token ? String(tokenResp.token) : null;
        }
      } catch (e) {
        console.error('[GA4 Breakdown] Failed to get service-account token:', e);
      }
    }

    if (!accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);

    const isAuthErrorText = (txt: string) => {
      const t = String(txt || '').toLowerCase();
      return (
        t.includes('"code": 401') ||
        t.includes('unauthenticated') ||
        t.includes('invalid authentication credentials') ||
        t.includes('request had invalid authentication credentials') ||
        t.includes('invalid_grant')
      );
    };

    const fetchReport = async (
      metricName: 'totalRevenue' | 'purchaseRevenue',
      dimensions: Array<{ name: string }>,
      preferredCampaignDim?: 'sessionCampaignName' | 'campaignName' | 'firstUserCampaignName',
      scopeFilter?: any,
      endDateOverride: string = 'yesterday'
    ) => {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateRange, endDate: endDateOverride }],
          dimensions,
          ...(scopeFilter || this.buildCampaignDimensionFilter(campaignFilter, preferredCampaignDim || 'sessionCampaignName') || {}),
          metrics: [
            { name: 'sessions' },
            // Use totalUsers as a compatible "base" metric for acquisition dimensions.
            // (screenPageViews is often incompatible with channel/source/medium dimensions)
            { name: 'totalUsers' },
            { name: 'conversions' },
            { name: metricName },
          ],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 10000),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        // If this is an auth error and we have a refresh token, attempt one automatic refresh + retry.
        if (isAuthErrorText(errorText)) {
          if (connection.refreshToken) {
            try {
              const refreshResult = await this.refreshAccessToken(
                String(connection.refreshToken),
                (connection.clientId as any) || undefined,
                (connection.clientSecret as any) || undefined
              );
              await storage.updateGA4ConnectionTokens(connection.id, {
                accessToken: refreshResult.access_token,
                refreshToken: String(connection.refreshToken),
                expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000)),
              });
              accessToken = refreshResult.access_token;

              const retry = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  dateRanges: [{ startDate: dateRange, endDate: endDateOverride }],
                  dimensions,
                  ...(scopeFilter || this.buildCampaignDimensionFilter(campaignFilter, preferredCampaignDim || 'sessionCampaignName') || {}),
                  metrics: [
                    { name: 'sessions' },
                    { name: 'totalUsers' },
                    { name: 'conversions' },
                    { name: metricName },
                  ],
                  orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
                  limit: Math.min(Math.max(limit, 1), 10000),
                }),
              });
              if (!retry.ok) {
                const retryText = await retry.text();
                throw new Error(`GA4 API Error: ${retryText}`);
              }
              return retry.json();
            } catch (refreshError: any) {
              const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
              (autoRefreshError as any).isAutoRefreshNeeded = true;
              throw autoRefreshError;
            }
          }

          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }

        throw new Error(`GA4 API Error: ${errorText}`);
      }
      return response.json();
    };

    const sessionScopedFull = [
      { name: 'date' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const sessionScopedNoCampaign = [
      { name: 'date' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const sessionScopedCore = [
      { name: 'date' },
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ];

    // Fallback dimension names (some properties expose these without the `session*` prefix).
    const legacyFull = [
      { name: 'date' },
      { name: 'defaultChannelGroup' },
      { name: 'source' },
      { name: 'medium' },
      { name: 'campaignName' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const legacyNoCampaign = [
      { name: 'date' },
      { name: 'defaultChannelGroup' },
      { name: 'source' },
      { name: 'medium' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const legacyCore = [
      { name: 'date' },
      { name: 'defaultChannelGroup' },
      { name: 'source' },
      { name: 'medium' },
    ];

    // First-user acquisition dimensions (often populated even when session-scoped dims appear as (not set)).
    // Not all properties expose all of these, so we attempt them opportunistically.
    const firstUserFull = [
      { name: 'date' },
      { name: 'firstUserDefaultChannelGroup' },
      { name: 'firstUserSource' },
      { name: 'firstUserMedium' },
      { name: 'firstUserCampaignName' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const firstUserNoCampaign = [
      { name: 'date' },
      { name: 'firstUserDefaultChannelGroup' },
      { name: 'firstUserSource' },
      { name: 'firstUserMedium' },
      { name: 'deviceCategory' },
      { name: 'country' },
    ];
    const firstUserCore = [
      { name: 'date' },
      { name: 'firstUserDefaultChannelGroup' },
      { name: 'firstUserSource' },
      { name: 'firstUserMedium' },
    ];
    const pageLocationCore = [
      { name: 'date' },
      { name: 'pageLocation' },
    ];
    const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);

    const chooseCampaignFilterDim = (dims: Array<{ name: string }>) => {
      const names = dims.map((d) => String(d?.name || ''));
      if (names.some((n) => n.startsWith('session'))) return 'sessionCampaignName' as const;
      if (names.some((n) => n.startsWith('firstUser'))) return 'firstUserCampaignName' as const;
      return 'campaignName' as const;
    };

    const fetchWithRevenueFallback = async (dimensions: Array<{ name: string }>, scopeFilter?: any, endDateOverride: string = 'yesterday') => {
      const preferredCampaignDim = chooseCampaignFilterDim(dimensions);
      try {
        return { data: await fetchReport('totalRevenue', dimensions, preferredCampaignDim, scopeFilter, endDateOverride), revenueMetric: 'totalRevenue' as const };
      } catch (e: any) {
        const msg = String(e?.message || '');
        // Some properties may not support totalRevenue; retry with purchaseRevenue.
        if (msg.toLowerCase().includes('totalrevenue')) {
          return { data: await fetchReport('purchaseRevenue', dimensions, preferredCampaignDim, scopeFilter, endDateOverride), revenueMetric: 'purchaseRevenue' as const };
        }
        throw e;
      }
    };

    const dimensionCandidates: Array<{ name: string; dims: Array<{ name: string }> }> = [
      { name: 'sessionScopedFull', dims: sessionScopedFull },
      { name: 'sessionScopedNoCampaign', dims: sessionScopedNoCampaign },
      { name: 'sessionScopedCore', dims: sessionScopedCore },
      { name: 'legacyFull', dims: legacyFull },
      { name: 'legacyNoCampaign', dims: legacyNoCampaign },
      { name: 'legacyCore', dims: legacyCore },
      { name: 'firstUserFull', dims: firstUserFull },
      { name: 'firstUserNoCampaign', dims: firstUserNoCampaign },
      { name: 'firstUserCore', dims: firstUserCore },
    ];

    let chosenDims: Array<{ name: string }> = sessionScopedFull;
    let chosenRevenueMetric: string = 'totalRevenue';
    let data: any = null;

    const indexOfAny = (dimsNames: string[], candidates: string[]) => {
      const set = new Set(candidates);
      return dimsNames.findIndex((n) => set.has(String(n || '')));
    };

    const getDim = (dimValues: any[], idx: number) => (idx >= 0 ? String(dimValues?.[idx]?.value ?? '') : '');

    const isUninformativeRow = (dimValues: any[], dimsNames: string[]) => {
      // Heuristic: if acquisition fields are all "(not set)" / "Unassigned", treat as uninformative.
      // IMPORTANT: Use dimension-name lookup (not fixed indexes) because candidate dimension sets differ.
      const idxChannel = indexOfAny(dimsNames, ['sessionDefaultChannelGroup', 'defaultChannelGroup', 'firstUserDefaultChannelGroup']);
      const idxSource = indexOfAny(dimsNames, ['sessionSource', 'source', 'firstUserSource']);
      const idxMedium = indexOfAny(dimsNames, ['sessionMedium', 'medium', 'firstUserMedium']);
      const idxCampaign = indexOfAny(dimsNames, ['sessionCampaignName', 'campaignName', 'firstUserCampaignName']);

      const channel = getDim(dimValues, idxChannel);
      const source = getDim(dimValues, idxSource);
      const medium = getDim(dimValues, idxMedium);
      const campaign = getDim(dimValues, idxCampaign);

      const isNotSet = (v: string) => {
        const s = v.trim().toLowerCase();
        return s === '(not set)' || s === '(not provided)' || s === '' || s === 'null';
      };
      const isUnassigned = (v: string) => v.trim().toLowerCase() === 'unassigned';

      const hasSource = !isNotSet(source);
      const hasMedium = !isNotSet(medium);
      const hasCampaign = !isNotSet(campaign);
      const hasChannel = !isUnassigned(channel) && !isNotSet(channel);

      // If none are present, it's uninformative.
      return !(hasSource || hasMedium || hasCampaign || hasChannel);
    };

    let lastError: any = null;
    for (const candidate of dimensionCandidates) {
      try {
        const result = await fetchWithRevenueFallback(candidate.dims);
        const d = result.data;
        const rowsArr = Array.isArray(d?.rows) ? d.rows : [];
        const rowCount = rowsArr.length;

        // If we got rows but they're all "Unassigned/(not set)", keep trying other dimension sets.
        const dimsNames = candidate.dims.map((x) => x.name);
        const hasAnyInformative = rowsArr.some((r: any) => !isUninformativeRow(r?.dimensionValues || [], dimsNames));

        if (rowCount > 0 && hasAnyInformative) {
          data = d;
          chosenDims = candidate.dims;
          chosenRevenueMetric = result.revenueMetric;
          break;
        }

        // Keep last attempt for debugging if all are empty/uninformative
        data = d;
        chosenDims = candidate.dims;
        chosenRevenueMetric = result.revenueMetric;
      } catch (e: any) {
        // Dimension/metric incompatibility, unknown dimensions, or other GA4 API errors.
        // Try the next candidate instead of failing the whole endpoint.
        lastError = e;
        continue;
      }
    }

    if (!data && lastError) {
      throw lastError;
    }

    if (pageLocationCampaignFilter) {
      const currentRows = Array.isArray(data?.rows) ? data.rows : [];
      if (currentRows.length === 0) {
        try {
          const result = await fetchWithRevenueFallback(pageLocationCore, pageLocationCampaignFilter, 'today');
          const rowsArr = Array.isArray(result.data?.rows) ? result.data.rows : [];
          if (rowsArr.length > 0) {
            data = result.data;
            chosenDims = pageLocationCore;
            chosenRevenueMetric = result.revenueMetric;
          }
        } catch {
          // Keep the original empty result if the URL fallback is not compatible for this property.
        }
      }
    }

    const rows: any[] = [];
    let totalSessionsRaw = 0;
    let totalUsers = 0;
    let totalConversions = 0;
    let totalRevenue = 0;

    const fmtDate = (yyyymmdd: string) => {
      const s = String(yyyymmdd || '');
      if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
      return s;
    };

    const chosenDimNames = chosenDims.map((d: any) => String(d?.name || ''));
    const idxDate = indexOfAny(chosenDimNames, ['date']);
    const idxChannel = indexOfAny(chosenDimNames, ['sessionDefaultChannelGroup', 'defaultChannelGroup', 'firstUserDefaultChannelGroup']);
    const idxSource = indexOfAny(chosenDimNames, ['sessionSource', 'source', 'firstUserSource']);
    const idxMedium = indexOfAny(chosenDimNames, ['sessionMedium', 'medium', 'firstUserMedium']);
    const idxCampaign = indexOfAny(chosenDimNames, ['sessionCampaignName', 'campaignName', 'firstUserCampaignName']);
    const idxDevice = indexOfAny(chosenDimNames, ['deviceCategory']);
    const idxCountry = indexOfAny(chosenDimNames, ['country']);
    const idxPageLocation = indexOfAny(chosenDimNames, ['pageLocation']);

    for (const row of Array.isArray(data?.rows) ? data.rows : []) {
      const dims = Array.isArray(row?.dimensionValues) ? row.dimensionValues : [];
      const mets = Array.isArray(row?.metricValues) ? row.metricValues : [];
      const sessionsRaw = Number.parseInt(mets[0]?.value || '0', 10) || 0;
      const pageLocation = getDim(dims, idxPageLocation);

      const d = {
        date: fmtDate(getDim(dims, idxDate)),
        channel: getDim(dims, idxChannel),
        source: getDim(dims, idxSource) || this.extractUrlSearchParam(pageLocation, 'utm_source'),
        medium: getDim(dims, idxMedium) || this.extractUrlSearchParam(pageLocation, 'utm_medium'),
        campaign: getDim(dims, idxCampaign) || this.extractUrlSearchParam(pageLocation, 'utm_campaign'),
        device: getDim(dims, idxDevice),
        country: getDim(dims, idxCountry),
        sessions: sessionsRaw,
        sessionsRaw,
        users: Number.parseInt(mets[1]?.value || '0', 10) || 0,
        conversions: Number.parseInt(mets[2]?.value || '0', 10) || 0,
        revenue: Number.parseFloat(mets[3]?.value || '0') || 0,
      };

      // IMPORTANT: sessions must reflect GA4 sessions exactly.
      // Do NOT derive sessions from users; that produces misleading KPIs (e.g., Users == Sessions).

      totalSessionsRaw += d.sessionsRaw;
      totalUsers += d.users;
      totalConversions += d.conversions;
      totalRevenue += d.revenue;
      rows.push(d);
    }

    const totalSessions = rows.reduce((sum: number, r: any) => sum + (Number(r.sessions) || 0), 0);

    return {
      rows,
      totals: {
        sessions: totalSessions,
        sessionsRaw: totalSessionsRaw,
        users: totalUsers,
        conversions: totalConversions,
        revenue: Number(totalRevenue.toFixed(2)),
      },
      meta: {
        propertyId: normalizedPropertyId,
        revenueMetric: chosenRevenueMetric,
        dimensions: chosenDims.map((d: any) => d.name),
        rowCount: rows.length,
        sessionsDerivedFromUsers: false,
      },
    };
  }

  /**
   * Fetch unique GA4 campaign values (campaignName) for a property so the UI can let the user
   * choose which GA4 campaign a MetricMind campaign should track.
   */
  async getCampaignValues(
    campaignId: string,
    storage: any,
    dateRange = '30daysAgo',
    propertyId?: string,
    limit: number = 50
  ): Promise<{ propertyId: string; campaigns: Array<{ name: string; users: number }> }> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection) throw new Error('NO_GA4_CONNECTION');

    const normalizedPropertyId = this.normalizeGA4PropertyId(connection.propertyId);
    if (!connection.accessToken) {
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    const isCampaignPlaceholder = (value: string) => {
      const normalized = String(value || '').trim().toLowerCase();
      return !normalized || ['(not set)', '(direct)', '(none)', '(not provided)', 'not set', 'direct', 'none', 'unassigned'].includes(normalized);
    };

    type CampaignDimensionName =
      | 'campaignName'
      | 'sessionCampaignName'
      | 'firstUserCampaignName'
      | 'sessionManualCampaignName'
      | 'firstUserManualCampaignName'
      | 'manualCampaignName';

    const campaignDimensions: CampaignDimensionName[] = [
      'sessionCampaignName',
      'sessionManualCampaignName',
      'campaignName',
      'firstUserCampaignName',
      'firstUserManualCampaignName',
      'manualCampaignName',
    ];

    const run = async (accessToken: string, dimensionName: CampaignDimensionName) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateRange, endDate: 'today' }],
          dimensions: [{ name: dimensionName }],
          metrics: [{ name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 200),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`GA4 API Error: ${txt}`);
      }
      const json = await resp.json().catch(() => ({} as any));
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const campaigns: Array<{ name: string; users: number }> = [];
      for (const r of rows) {
        const name = String(r?.dimensionValues?.[0]?.value || '').trim();
        const users = parseInt(String(r?.metricValues?.[0]?.value || '0'), 10) || 0;
        if (isCampaignPlaceholder(name)) continue;
        campaigns.push({ name, users });
      }
      return campaigns;
    };

    const extractUtmCampaign = (value: string) => {
      const raw = String(value || '').trim();
      if (!raw) return '';
      try {
        const url = raw.startsWith('/') ? new URL(raw, 'https://example.invalid') : new URL(raw);
        return String(url.searchParams.get('utm_campaign') || '').trim();
      } catch {
        return '';
      }
    };

    const runPageLocationCampaigns = async (accessToken: string) => {
      const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: dateRange, endDate: 'today' }],
          dimensions: [{ name: 'pageLocation' }],
          metrics: [{ name: 'totalUsers' }],
          orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
          limit: Math.min(Math.max(limit, 1), 200),
        }),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`GA4 API Error: ${txt}`);
      }
      const json = await resp.json().catch(() => ({} as any));
      const rows: any[] = Array.isArray(json?.rows) ? json.rows : [];
      const map = new Map<string, number>();
      for (const r of rows) {
        const name = extractUtmCampaign(String(r?.dimensionValues?.[0]?.value || ''));
        const users = parseInt(String(r?.metricValues?.[0]?.value || '0'), 10) || 0;
        if (isCampaignPlaceholder(name)) continue;
        map.set(name, (map.get(name) || 0) + users);
      }
      return Array.from(map.entries()).map(([name, users]) => ({ name, users }));
    };

    const merge = (lists: Array<Array<{ name: string; users: number }>>) => {
      const map = new Map<string, number>();
      for (const list of lists) {
        for (const c of list) {
          const key = String(c.name || '').trim();
          if (!key) continue;
          const existing = map.get(key) || 0;
          map.set(key, Math.max(existing, Number(c.users || 0)));
        }
      }
      return Array.from(map.entries())
        .map(([name, users]) => ({ name, users }))
        .sort((a, b) => (b.users || 0) - (a.users || 0))
        .slice(0, Math.min(Math.max(limit, 1), 200));
    };

    const isMostlyEmpty = (list: Array<{ name: string; users: number }>) =>
      !list?.length || list.every((c) => isCampaignPlaceholder(c?.name) || (c.users || 0) <= 0);

    const collectCampaignValues = async (
      accessToken: string,
      errorHandler: (err: any) => Array<{ name: string; users: number }>
    ) => {
      const lists: Array<Array<{ name: string; users: number }>> = [];
      for (const dimension of campaignDimensions) {
        const campaigns = await run(accessToken, dimension).catch(errorHandler);
        lists.push(campaigns);
        if (!isMostlyEmpty(campaigns)) break;
      }
      const campaigns = merge(lists);
      const pageLocationCampaigns = await runPageLocationCampaigns(accessToken).catch(errorHandler);
      return merge([...lists, pageLocationCampaigns]);
    };

    // Helper: catch non-auth errors only; let auth errors propagate for token refresh
    const catchNonAuth = (err: any) => {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('"code": 401') || msg.includes('unauthenticated') ||
          msg.includes('invalid authentication credentials') ||
          msg.includes('request had invalid authentication credentials') ||
          msg.includes('invalid_grant')) {
        throw err; // let the outer catch handle token refresh
      }
      return [] as Array<{ name: string; users: number }>;
    };

    try {
      // Try multiple campaign dimensions:
      // - sessionCampaignName: most common expectation for "campaign" in acquisition reports
      // - sessionManualCampaignName/manual variants: UTM campaign values from tagged traffic
      // - campaignName: legacy/general
      // - firstUserCampaignName: sometimes available earlier for new users
      // - pageLocation fallback: parse utm_campaign from landing URLs if attribution dims are not populated yet
      const campaigns = await collectCampaignValues(connection.accessToken, catchNonAuth);
      return { propertyId: normalizedPropertyId, campaigns };
    } catch (e: any) {
      const msg = String(e?.message || '');
      const isAuth =
        msg.includes('"code": 401') ||
        msg.toLowerCase().includes('unauthenticated') ||
        msg.toLowerCase().includes('invalid authentication credentials') ||
        msg.toLowerCase().includes('request had invalid authentication credentials') ||
        msg.toLowerCase().includes('invalid_grant');
      if (isAuth && connection.refreshToken) {
        const refresh = await this.refreshAccessToken(
          connection.refreshToken,
          connection.clientId || undefined,
          connection.clientSecret || undefined
        );
        await storage.updateGA4ConnectionTokens(connection.id, {
          accessToken: refresh.access_token,
          refreshToken: connection.refreshToken,
          expiresAt: new Date(Date.now() + (refresh.expires_in * 1000)),
        });
        const campaigns = await collectCampaignValues(refresh.access_token, () => []);
        return { propertyId: normalizedPropertyId, campaigns };
      }
      throw e;
    }
  }

  // Get geographic breakdown of users
  async getGeographicMetrics(propertyId: string, accessToken: string, dateRange = 'today', campaignFilter?: CampaignFilter): Promise<any> {
    try {
      const normalizedPropertyId = this.normalizeGA4PropertyId(propertyId);
      const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: dateRange === 'today' ? 'today' : dateRange === '7days' ? '7daysAgo' : dateRange === '30days' ? '30daysAgo' : dateRange,
              endDate: 'today'
            }
          ],
          ...(campaignDimensionFilter ? campaignDimensionFilter : {}),
          dimensions: [
            { name: 'country' },
            { name: 'region' },
            { name: 'city' }
          ],
          metrics: [
            { name: 'totalUsers' },
            { name: 'sessions' },
            { name: 'screenPageViews' },
            { name: 'averageSessionDuration' }
          ],
          orderBys: [
            {
              metric: { metricName: 'totalUsers' },
              desc: true
            }
          ],
          limit: 50
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`GA4 API Error: ${errorData}`);
      }

      const data = await response.json();
      
      console.log('GA4 Geographic API Response:', {
        propertyId: normalizedPropertyId,
        totalRows: data.rows?.length || 0,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process geographic data
      const geographicData = [];
      if (data.rows) {
        for (const row of data.rows) {
          if (row.dimensionValues && row.metricValues) {
            const country = row.dimensionValues[0]?.value || 'Unknown';
            const region = row.dimensionValues[1]?.value || 'Unknown';
            const city = row.dimensionValues[2]?.value || 'Unknown';
            const users = parseInt(row.metricValues[0]?.value || '0');
            const sessions = parseInt(row.metricValues[1]?.value || '0');
            const pageviews = parseInt(row.metricValues[2]?.value || '0');
            const avgSessionDuration = parseFloat(row.metricValues[3]?.value || '0');
            
            geographicData.push({
              country,
              region,
              city,
              users,
              sessions,
              pageviews,
              avgSessionDuration
            });
          }
        }
      }

      return {
        success: true,
        data: geographicData,
        totalLocations: geographicData.length,
        topCountries: geographicData.slice(0, 10)
      };

    } catch (error) {
      console.error('Error fetching GA4 geographic metrics:', error);
      throw new Error(`Failed to fetch GA4 geographic metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Automatic token refresh for SaaS production use

  async simulateGA4Connection(propertyId: string): Promise<{ success: boolean; user?: any; properties?: any[] }> {
    // Return success with simulated data for demo purposes
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return {
        success: true,
        user: { email: 'demo@example.com', name: 'Demo User' },
        properties: [
          { id: propertyId, name: 'Demo GA4 Property', account: 'Demo Account' }
        ]
      };
    }
    return { success: false };
  }

  async refreshAccessToken(refreshToken: string, clientId?: string, clientSecret?: string): Promise<{ access_token: string; expires_in: number }> {
    // Use provided client credentials (from database) or fall back to environment variables
    const authClientId = clientId || process.env.GOOGLE_CLIENT_ID;
    const authClientSecret = clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    
    if (authClientId && authClientSecret) {
      // Production-grade automatic refresh with stored or environment credentials
      console.log('Using OAuth credentials for automatic refresh (source:', clientId ? 'database' : 'environment', ')');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: authClientId,
          client_secret: authClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error}`);
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    } else {
      // Fallback: Try refresh without credentials (will likely fail, but attempt it)
      console.log('WARNING: No OAuth credentials - attempting refresh without client auth (may fail)');
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token refresh failed without client credentials:', errorData);
        throw new Error('Automatic refresh requires Google OAuth credentials for guaranteed operation');
      }

      const tokenData = await response.json();
      return {
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in || 3600
      };
    }
  }

  async getTimeSeriesData(
    campaignId: string,
    storage: any,
    dateRange = '30daysAgo',
    propertyId?: string,
    campaignFilter?: CampaignFilter
  ): Promise<any[]> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    if (!connection.accessToken) {
      console.log('No access token found in database for campaign:', campaignId);
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    try {
      return await this.getTimeSeriesWithToken(connection.propertyId, connection.accessToken, dateRange, campaignFilter);
    } catch (error: any) {
      console.log('GA4 time series API call failed:', error.message);
      
      // Check if error is due to expired token
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        console.log('Access token invalid/expired for time series - attempting automatic refresh');
        
        if (connection.refreshToken) {
          try {
            const refreshResult = await this.refreshAccessToken(
              connection.refreshToken, 
              connection.clientId || undefined,
              connection.clientSecret || undefined
            );
            
            await storage.updateGA4ConnectionTokens(connection.id, {
              accessToken: refreshResult.access_token,
              refreshToken: connection.refreshToken,
              expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000))
            });
            
            console.log('Access token refreshed successfully - retrying time series call');
            return await this.getTimeSeriesWithToken(connection.propertyId, refreshResult.access_token, dateRange, campaignFilter);
          } catch (refreshError: any) {
            console.error('Failed to refresh access token for time series:', refreshError.message);
            const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
            (autoRefreshError as any).isAutoRefreshNeeded = true;
            (autoRefreshError as any).hasRefreshToken = !!connection.refreshToken;
            throw autoRefreshError;
          }
        } else {
          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }
      }
      throw error;
    }
  }

  async getTimeSeriesWithToken(
    propertyId: string,
    accessToken: string,
    dateRange = '30daysAgo',
    campaignFilter?: CampaignFilter
  ): Promise<any[]> {
    try {
      const normalizedPropertyId = this.normalizeGA4PropertyId(propertyId);
      const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
      const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);

      // Some properties don't allow totalRevenue; fall back to purchaseRevenue.
      const run = async (revenueMetric: 'totalRevenue' | 'purchaseRevenue', scopeFilter: any = campaignDimensionFilter) => {
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [
              {
                startDate: dateRange,
                endDate: 'today',
              },
            ],
            dimensions: [{ name: 'date' }],
            ...(scopeFilter ? scopeFilter : {}),
            metrics: [
              { name: 'sessions' },
              { name: 'screenPageViews' },
              { name: 'conversions' },
              { name: 'totalUsers' },
              { name: revenueMetric },
              // Available on most properties; if missing it will error (caught and surfaced).
              { name: 'engagementRate' },
            ],
            orderBys: [
              {
                dimension: {
                  dimensionName: 'date'
                }
              }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GA4 Time Series API Error: ${errorText}`);
        }

        const data = await response.json();
        return { data, revenueMetric };
      };

      let data: any;
      let revenueMetric: 'totalRevenue' | 'purchaseRevenue' = 'totalRevenue';
      const runWithRevenueFallback = async (scopeFilter: any = campaignDimensionFilter) => {
        try {
          return await run('totalRevenue', scopeFilter);
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          if (msg.includes('totalrevenue') || msg.includes('metric') || msg.includes('invalid')) {
            return await run('purchaseRevenue', scopeFilter);
          }
          throw e;
        }
      };

      const runConversionRevenue = async (revenueMetric: 'totalRevenue' | 'purchaseRevenue', scopeFilter: any) => {
        const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [
              {
                startDate: dateRange,
                endDate: 'today',
              },
            ],
            dimensions: [{ name: 'date' }],
            ...(scopeFilter ? scopeFilter : {}),
            metrics: [
              { name: 'conversions' },
              { name: revenueMetric },
            ],
            orderBys: [
              {
                dimension: {
                  dimensionName: 'date'
                }
              }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`GA4 Time Series Conversion/Revenue API Error: ${errorText}`);
        }

        const data = await response.json();
        return { data, revenueMetric };
      };

      const runConversionRevenueWithFallback = async (scopeFilter: any) => {
        try {
          return await runConversionRevenue('totalRevenue', scopeFilter);
        } catch (e: any) {
          const msg = String(e?.message || e || '').toLowerCase();
          if (msg.includes('totalrevenue') || msg.includes('metric') || msg.includes('invalid')) {
            return await runConversionRevenue('purchaseRevenue', scopeFilter);
          }
          throw e;
        }
      };

      const res = await runWithRevenueFallback(campaignDimensionFilter);
      data = res.data;
      revenueMetric = res.revenueMetric;
      if ((!Array.isArray(data?.rows) || data.rows.length === 0) && pageLocationCampaignFilter) {
        const utmRes = await runWithRevenueFallback(pageLocationCampaignFilter).catch(() => null);
        if (utmRes && Array.isArray(utmRes.data?.rows) && utmRes.data.rows.length > 0) {
          data = utmRes.data;
          revenueMetric = utmRes.revenueMetric;
        }
      }
      
      console.log('GA4 Time Series API Response for property', normalizedPropertyId, ':', {
        totalRows: data.rows?.length || 0,
        dateRange: `${dateRange} to today`,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process the response data into chart format
      let timeSeriesData: any[] = [];
      const formatDate = (value: any) => {
        let dateISO = String(value || '').trim();
        let dateLabel = dateISO;
        if (/^\d{8}$/.test(dateISO)) {
          const year = dateISO.substring(0, 4);
          const month = dateISO.substring(4, 6);
          const day = dateISO.substring(6, 8);
          dateISO = `${year}-${month}-${day}`;
          dateLabel = `${month}/${day}`;
        }
        return { dateISO, dateLabel };
      };
      
      if (data.rows) {
        for (const row of data.rows) {
          if (row.dimensionValues && row.metricValues) {
            const date = row.dimensionValues[0]?.value || '';
            const sessions = parseInt(row.metricValues[0]?.value || '0');
            const pageviews = parseInt(row.metricValues[1]?.value || '0');
            const conversions = parseInt(row.metricValues[2]?.value || '0');
            const users = parseInt(row.metricValues[3]?.value || '0');
            const revenue = Number.parseFloat(String(row.metricValues[4]?.value || '0')) || 0;
            const engagementRate = Number.parseFloat(String(row.metricValues[5]?.value || '0')) || 0;
            
            // IMPORTANT: return ISO date for downstream correctness (Insights WoW needs YYYY-MM-DD).
            // Keep a lightweight label available for charts.
            const { dateISO, dateLabel } = formatDate(date);
            
            timeSeriesData.push({
              date: dateISO,
              dateLabel,
              sessions,
              pageviews,
              conversions,
              users,
              revenue: Number(revenue.toFixed(2)),
              revenueMetric,
              engagementRate,
            });
          }
        }
      }

      const hasBaseTraffic = timeSeriesData.some((r) =>
        Number(r?.sessions || 0) > 0 ||
        Number(r?.users || 0) > 0 ||
        Number(r?.pageviews || 0) > 0
      );
      const hasConversionRevenue = timeSeriesData.some((r) =>
        Number(r?.conversions || 0) > 0 ||
        Number(r?.revenue || 0) > 0
      );
      const campaignNameConversionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'campaignName');

      if (hasBaseTraffic && !hasConversionRevenue && campaignNameConversionFilter) {
        const supplemental = await runConversionRevenueWithFallback(campaignNameConversionFilter).catch(() => null);
        const supplementalRows = Array.isArray(supplemental?.data?.rows) ? supplemental.data.rows : [];
        const conversionRevenueByDate = new Map<string, { conversions: number; revenue: number; revenueMetric: string }>();

        for (const row of supplementalRows) {
          const date = formatDate(row?.dimensionValues?.[0]?.value || '').dateISO;
          if (!date) continue;
          const conversions = parseInt(String(row?.metricValues?.[0]?.value || '0'), 10) || 0;
          const revenue = Number.parseFloat(String(row?.metricValues?.[1]?.value || '0')) || 0;
          if (conversions > 0 || revenue > 0) {
            conversionRevenueByDate.set(date, {
              conversions,
              revenue: Number(revenue.toFixed(2)),
              revenueMetric: String(supplemental?.revenueMetric || revenueMetric),
            });
          }
        }

        if (conversionRevenueByDate.size > 0) {
          timeSeriesData = timeSeriesData.map((row) => {
            const supplementalRow = conversionRevenueByDate.get(String(row?.date || ''));
            if (!supplementalRow) return row;
            return {
              ...row,
              conversions: supplementalRow.conversions,
              revenue: supplementalRow.revenue,
              revenueMetric: supplementalRow.revenueMetric,
            };
          });
        }
      }

      console.log('Processed time series data:', {
        totalPoints: timeSeriesData.length,
        sampleData: timeSeriesData.slice(0, 3)
      });

      return timeSeriesData;
    } catch (error) {
      console.error('Error fetching GA4 time series data:', error);
      throw error;
    }
  }

  async getMetricsWithAutoRefresh(
    campaignId: string,
    storage: any,
    dateRange = 'today',
    propertyId?: string,
    campaignFilter?: CampaignFilter
  ): Promise<GA4Metrics> {
    const connection = await storage.getGA4Connection(campaignId, propertyId);
    if (!connection || connection.method !== 'access_token') {
      throw new Error('No valid access token connection found');
    }

    // Check if we have an access token
    if (!connection.accessToken) {
      console.log('No access token found in database for campaign:', campaignId);
      const tokenExpiredError = new Error('TOKEN_EXPIRED');
      (tokenExpiredError as any).isTokenExpired = true;
      throw tokenExpiredError;
    }

    console.log('Using access token for GA4 API call:', {
      campaignId,
      propertyId: connection.propertyId,
      tokenLength: connection.accessToken.length,
      tokenStart: connection.accessToken.substring(0, 20)
    });
    
    // Try with current token
    try {
      return await this.getMetricsWithToken(connection.propertyId, connection.accessToken, dateRange, campaignFilter);
    } catch (error: any) {
      console.log('GA4 API call failed:', error.message);
      
      // Check if error is due to expired token
      if (error.message.includes('invalid_grant') || 
          error.message.includes('401') || 
          error.message.includes('403') ||
          error.message.includes('invalid authentication credentials') ||
          error.message.includes('Request had invalid authentication credentials')) {
        
        console.log('Access token invalid/expired - attempting automatic background refresh');
        
        // Attempt automatic token refresh if we have a refresh token
        if (connection.refreshToken) {
          try {
            console.log('Refreshing access token automatically in background...');
            console.log('Using stored OAuth credentials:', {
              hasClientId: !!connection.clientId,
              hasClientSecret: !!connection.clientSecret,
              clientIdLength: connection.clientId?.length || 0
            });
            
            // Use stored client credentials for automatic refresh
            const refreshResult = await this.refreshAccessToken(
              connection.refreshToken, 
              connection.clientId || undefined,
              connection.clientSecret || undefined
            );
            
            // Update the connection with new access token
            await storage.updateGA4ConnectionTokens(connection.id, {
              accessToken: refreshResult.access_token,
              refreshToken: connection.refreshToken, // Keep the same refresh token
              expiresAt: new Date(Date.now() + (refreshResult.expires_in * 1000))
            });
            
            console.log('Access token refreshed successfully - retrying metrics call');
            
            // Retry with new token using specified date range
            return await this.getMetricsWithToken(connection.propertyId, refreshResult.access_token, dateRange, campaignFilter);
          } catch (refreshError: any) {
            console.error('Failed to refresh access token automatically:', refreshError.message);
            
            // If automatic refresh fails, fall back to UI refresh
            const autoRefreshError = new Error('AUTO_REFRESH_NEEDED');
            (autoRefreshError as any).isAutoRefreshNeeded = true;
            (autoRefreshError as any).hasRefreshToken = !!connection.refreshToken;
            throw autoRefreshError;
          }
        } else {
          console.log('No refresh token available - user needs to reconnect');
          const tokenExpiredError = new Error('TOKEN_EXPIRED');
          (tokenExpiredError as any).isTokenExpired = true;
          throw tokenExpiredError;
        }
      }
      throw error;
    }
  }

  async getMetrics(credentials: GA4Credentials, accessToken: string, dateRange = 'today', campaignFilter?: CampaignFilter): Promise<GA4Metrics> {
    try {
      const normalizedPropertyId = this.normalizeGA4PropertyId(credentials.propertyId);
      // Realtime can be misleading for campaign-scoped analytics. If we're filtering to a specific campaign,
      // skip realtime so "active users" doesn't reflect site-wide traffic.
      let realtimeData: any = null;
      if (this.normalizeCampaignFilter(campaignFilter).length === 0) {
        const realtimeResponse = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runRealtimeReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [
            { name: 'activeUsers' },
            { name: 'screenPageViews' }
          ],
        }),
      });

      if (realtimeResponse.ok) {
        realtimeData = await realtimeResponse.json();
        console.log('Real-time GA4 data retrieved:', {
          hasData: !!realtimeData?.rows?.length,
          totalRows: realtimeData?.rows?.length || 0
        });
      } else {
        const realtimeError = await realtimeResponse.text();
        console.log('Real-time API failed (fallback to historical data):', realtimeError);
          // Continue with historical data only
        }
      }

      // Then get historical data for context
      const campaignDimensionFilter = this.buildCampaignDimensionFilter(campaignFilter, 'sessionCampaignName');
      const pageLocationCampaignFilter = this.buildUtmCampaignPageLocationFilter(campaignFilter);
      const runHistorical = async (scopeFilter: any) => fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${normalizedPropertyId}:runReport`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dateRanges: [
              {
                startDate: dateRange, // Use the requested date range
                endDate: 'today', // Include today for most current data
              },
            ],
            ...(scopeFilter ? scopeFilter : {}),
            metrics: [
              { name: 'sessions' },
              { name: 'screenPageViews' },
              { name: 'bounceRate' },
              { name: 'averageSessionDuration' },
              { name: 'conversions' },
              { name: 'totalUsers' },
              { name: 'newUsers' },
              { name: 'engagedSessions' },
              { name: 'engagementRate' },
              { name: 'eventCount' }
            ],
          }),
        });
      let response = await runHistorical(campaignDimensionFilter);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GA4 API Error: ${errorText}`);
      }

      let data = await response.json();
      const hasHistoricalMetricData = (json: any) => Array.isArray(json?.rows) && json.rows.some((row: any) =>
        (Array.isArray(row?.metricValues) ? row.metricValues : []).some((metric: any) => Number(metric?.value || 0) > 0)
      );
      if (!hasHistoricalMetricData(data) && pageLocationCampaignFilter) {
        const utmResponse = await runHistorical(pageLocationCampaignFilter).catch(() => null);
        if (utmResponse?.ok) {
          const utmData = await utmResponse.json().catch(() => null);
          if (hasHistoricalMetricData(utmData)) data = utmData;
        }
      }
      
      console.log('GA4 API Response for property', normalizedPropertyId, ':', {
        totalRows: data.rows?.length || 0,
        dateRange: dateRange,
        requestedDateRange: dateRange,
        hasData: !!data.rows && data.rows.length > 0
      });

      // Process real-time data first
      let realtimeActiveUsers = 0;
      let realtimePageviews = 0;
      
      if (realtimeData?.rows) {
        for (const row of realtimeData.rows) {
          if (row.metricValues) {
            realtimeActiveUsers += parseInt(row.metricValues[0]?.value || '0');
            realtimePageviews += parseInt(row.metricValues[1]?.value || '0');
          }
        }
        console.log('Real-time metrics:', { realtimeActiveUsers, realtimePageviews });
      }

      // Process the historical response data with expanded metrics
      let totalSessions = 0;
      let totalPageviews = 0;
      let totalUsers = 0;
      let totalConversions = 0;
      let totalBounceRate = 0;
      let totalSessionDuration = 0;
      let totalNewUsers = 0;
      let totalEngagedSessions = 0;
      let totalEngagementRate = 0;
      let totalEventCount = 0;
      let rowCount = 0;

      if (data.rows) {
        for (const row of data.rows) {
          if (row.metricValues) {
            const sessions = parseInt(row.metricValues[0]?.value || '0');
            const pageviews = parseInt(row.metricValues[1]?.value || '0');
            const bounceRate = parseFloat(row.metricValues[2]?.value || '0');
            const sessionDuration = parseFloat(row.metricValues[3]?.value || '0');
            const conversions = parseInt(row.metricValues[4]?.value || '0');
            const users = parseInt(row.metricValues[5]?.value || '0');
            const newUsers = parseInt(row.metricValues[6]?.value || '0');
            const engagedSessions = parseInt(row.metricValues[7]?.value || '0');
            const engagementRate = parseFloat(row.metricValues[8]?.value || '0');
            const eventCount = parseInt(row.metricValues[9]?.value || '0');
            
            totalSessions += sessions;
            totalPageviews += pageviews;
            totalBounceRate += bounceRate;
            totalSessionDuration += sessionDuration;
            totalConversions += conversions;
            totalUsers += users;
            totalNewUsers += newUsers;
            totalEngagedSessions += engagedSessions;
            totalEngagementRate += engagementRate;
            totalEventCount += eventCount;
            rowCount++;
            
            if (rowCount <= 3) {
              console.log(`GA4 Row ${rowCount}:`, {
                sessions, pageviews, bounceRate, sessionDuration, conversions, users,
                newUsers, engagedSessions, engagementRate, eventCount
              });
            }
          }
        }
      }
      
      console.log('GA4 Final totals:', {
        totalSessions,
        totalPageviews,
        totalUsers,
        realtimeActiveUsers,
        realtimePageviews,
        totalConversions,
        avgBounceRate: rowCount > 0 ? totalBounceRate / rowCount : 0,
        avgSessionDuration: rowCount > 0 ? totalSessionDuration / rowCount : 0
      });

      // IMPORTANT:
      // Keep historical and realtime metrics separate.
      // GA4 realtime "activeUsers" overlaps with historical totals (and is for last ~30 minutes),
      // so adding it into historical users/pageviews will produce misleading results.
      const finalUsers = totalUsers;
      const finalPageviews = totalPageviews;
      // IMPORTANT: sessions must reflect GA4 sessions exactly.
      // Do NOT derive sessions from users; that produces misleading KPIs (e.g., Users == Sessions).
      const finalSessions = totalSessions;
      const sessionsDerivedFromUsers = false;
      
      console.log('GA4 metrics (historical + realtime separated) for', dateRange, ':', {
        historicalUsers: totalUsers,
        historicalPageviews: totalPageviews,
        historicalSessions: totalSessions,
        finalSessions,
        sessionsDerivedFromUsers,
        realtimeActiveUsers,
        realtimePageviews,
        apiDateRange: `${dateRange} to today`
      });
      
      return {
        impressions: finalUsers,
        clicks: finalSessions,
        sessions: finalSessions,
        pageviews: finalPageviews,
        bounceRate: rowCount > 0 ? totalBounceRate / rowCount : 0,
        averageSessionDuration: rowCount > 0 ? totalSessionDuration / rowCount : 0,
        conversions: totalConversions,
        activeUsers: realtimeActiveUsers,
        newUsers: totalNewUsers,
        userEngagementDuration: 0, // Calculate from session duration
        engagedSessions: totalEngagedSessions,
        engagementRate: rowCount > 0 ? totalEngagementRate / rowCount : 0,
        eventCount: totalEventCount,
        eventsPerSession: finalSessions > 0 ? totalEventCount / finalSessions : 0,
        screenPageViewsPerSession: finalSessions > 0 ? totalPageviews / finalSessions : 0,
        sessionsDerivedFromUsers,
      };
    } catch (error) {
      console.error('Error fetching GA4 metrics:', error);
      throw new Error(`Failed to fetch GA4 metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testConnection(credentials: GA4Credentials, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${credentials.propertyId}:runReport`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: '7daysAgo',
              endDate: 'today',
            },
          ],
          metrics: [{ name: 'sessions' }],
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Error testing GA4 connection:', error);
      return false;
    }
  }
}

export const ga4Service = new GoogleAnalytics4Service();
