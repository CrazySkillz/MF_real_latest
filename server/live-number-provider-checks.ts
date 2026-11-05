import { GoogleAnalytics4Service, type GA4DailyTrafficCapture } from "./analytics";
import { decryptTokens } from "./utils/tokenVault";
import { hydrateGA4ServiceAccountConnection } from "./utils/ga4-service-account";
import { hydrateGoogleSheetsServiceAccountConnection } from "./utils/google-sheets-service-account";
import { normalizeFinancialSourceDateKey } from "./utils/csv";
import { validateHubspotSearchPage, nextHubspotPageCursor, MAX_HUBSPOT_PAGES } from "./utils/hubspot-pagination";
import { fetchCompleteSalesforceQuery } from "./utils/salesforce-pagination";
import { detectSalesforceCurrency } from "./utils/salesforceCurrency";
import { escapeSalesforceSoqlStringLiteral, isSafeSalesforceFieldPath } from "./utils/salesforce-query";
import { fetchShopifyOrderCustomerJourneyUtms, getShopifyApiVersion, isShopifyPartnerDevelopmentStore, normalizeShopifyDomain,
  requireShopifyOrderWindowScopes, shopifyAdminFetch } from "./utils/shopify-provider";
import { getShopifyConfirmedRevenueAmounts, getShopifyDiscountCodes, getShopifyOrderReportingDate, getShopifyOrderUtm } from "./utils/shopify-revenue";
import { compareNumber, dateIsValid, monitorHash, numberOrNull, parseMonitorMapping, resolveMonitorScope,
  type LiveNumberSnapshot, type NumberCheck } from "./live-number-checks";

// Generic providers never renew rotating tokens. Google has a separate in-memory access-token exchange below.
export function monitorCredential(connection: any, now = Date.now()): string {
  if (!connection || connection.isActive === false || (connection.expiresAt && (!Number.isFinite(Date.parse(connection.expiresAt)) || Date.parse(connection.expiresAt) <= now + 60_000))) {
    throw new Error("PROVIDER_CREDENTIAL_UNAVAILABLE");
  }
  const token = connection.encryptedTokens ? decryptTokens(connection.encryptedTokens).accessToken : connection.accessToken;
  if (!token) throw new Error("PROVIDER_CREDENTIAL_UNAVAILABLE");
  return token;
}

export async function googleMonitorCredential(connection: any, request: typeof fetch = fetch): Promise<string> {
  if (!connection || connection.isActive === false) throw new Error("PROVIDER_CREDENTIAL_UNAVAILABLE");
  try { return monitorCredential(connection); } catch { /* Google refresh tokens are reusable; never save the new access token. */ }
  const decrypted = connection.encryptedTokens ? decryptTokens(connection.encryptedTokens) : connection;
  const refreshToken = decrypted.refreshToken, clientSecret = decrypted.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const clientId = connection.clientId || process.env.GOOGLE_CLIENT_ID;
  if (!refreshToken || !clientId || !clientSecret) throw new Error("PROVIDER_CREDENTIAL_UNAVAILABLE");
  const response = await request("https://oauth2.googleapis.com/token", { method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret }).toString() });
  if (!response.ok) throw new Error("GOOGLE_MONITOR_AUTH_UNVERIFIED");
  const credentials = await response.json();
  if (typeof credentials.access_token !== "string" || !credentials.access_token || Number(credentials.expires_in) < 60) throw new Error("GOOGLE_MONITOR_AUTH_UNVERIFIED");
  return credentials.access_token;
}

// A failed/incomplete provider response cannot become a numeric zero or a successful comparison.
export function compareProviderRows(section: string, expected: any[], actual: any[], keys: string[], metrics: string[], subject?: string): NumberCheck[] {
  const key = (row: any) => JSON.stringify(keys.map(k => row[k]));
  const expectedMap = new Map(expected.map(row => [key(row), row])), actualMap = new Map(actual.map(row => [key(row), row]));
  if (expectedMap.size !== expected.length || actualMap.size !== actual.length) return [{ section, code: "DUPLICATE_COMPARISON_KEY", subject, status: "unverified" }];
  const checks: NumberCheck[] = [];
  for (const identity of Array.from(new Set([...Array.from(expectedMap.keys()), ...Array.from(actualMap.keys())]))) {
    const left = expectedMap.get(identity), right = actualMap.get(identity);
    if (!left || !right) { checks.push({ section, code: "SOURCE_ROW_DIFFERENCE", subject, status: "difference" }); continue; }
    for (const metric of metrics) checks.push(compareNumber(section, `SOURCE_${metric}`, left[metric], right[metric], {
      subject, decimals: metric === "revenue" || metric === "spend" || metric === "value" ? 2 : metric === "engagementRate" ? 4 : undefined,
      conversions: metric === "conversions", operations: expected.length,
    }));
  }
  if (!checks.length) checks.push({ section, code: "SOURCE_EMPTY_RESULT_MATCH", subject, status: "passed" });
  return checks;
}

export async function checkGA4ProviderNumbers(snapshot: LiveNumberSnapshot, now = new Date()): Promise<NumberCheck[]> {
  const scope = resolveMonitorScope(snapshot, now), campaignId = String(snapshot.campaign.id);
  let connection = scope.connection;
  if (connection.method === "service_account") connection = await hydrateGA4ServiceAccountConnection(connection);
  else connection = { ...connection, accessToken: await googleMonitorCredential(connection) };
  const facade = { getGA4Connection: async (id: string, property: string) => {
    if (id !== campaignId || property !== connection.propertyId) throw new Error("PROVIDER_SCOPE_CHANGED");
    return { ...connection, refreshToken: null, serviceAccountKey: null };
  } };
  const service = new GoogleAnalytics4Service(AbortSignal.timeout(240_000));
  const capture: GA4DailyTrafficCapture = { campaignId };
  const daily = await service.getTimeSeriesWithToken(connection.propertyId, connection.accessToken, scope.startDate,
    scope.filter, scope.endDate, scope.currency, capture);
  const byDate = new Map(daily.map(row => [row.date, row]));
  if (byDate.size !== daily.length || daily.some(row => !dateIsValid(row.date) || row.date < scope.startDate || row.date > scope.endDate)) throw new Error("PROVIDER_DATE_SCOPE_UNVERIFIED");
  // Complete GA4 reports omit zero-activity dates. The API helper rejects partial/thresholded/sampled reports first.
  const expectedDaily: any[] = [];
  for (let date = scope.startDate; date <= scope.endDate; date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)) {
    expectedDaily.push(byDate.get(date) || { date, sessions: 0, users: 0, pageviews: 0, conversions: 0, revenue: 0, engagedSessions: 0, engagementRate: 0 });
  }
  const savedDaily = (snapshot.rows.ga4DailyMetrics || []).filter(r => r.propertyId === connection.propertyId && r.date >= scope.startDate && r.date <= scope.endDate);
  const checks = compareProviderRows("GA4 daily inputs / Insights / Trend Analysis", expectedDaily, savedDaily, ["date"],
    ["sessions", "users", "pageviews", "conversions", "revenue", "engagedSessions", "engagementRate"]);
  const provider = await service.getAcquisitionBreakdown(campaignId, facade, scope.startDate, connection.propertyId,
    2000, scope.filter, scope.endDate, true, false, scope.currency, true, capture);
  const saved = scope.publication.campaignBreakdown;
  if (provider.meta.currencyCode !== scope.currency || provider.meta.revenueMetric !== saved.meta.revenueMetric
    || JSON.stringify(provider.meta.dimensions) !== JSON.stringify(saved.meta.dimensions)) {
    checks.push({ section: "Overview / Campaign Comparison", code: "PROVIDER_METRIC_DEFINITION_CHANGED", status: "unverified" });
  } else {
    for (const metric of ["sessions", "sessionsRaw", "users", "conversions", "revenue", "engagedSessions", "engagementRate"]) {
      checks.push(compareNumber("Overview / Campaign Comparison", `SOURCE_TOTAL_${metric}`, (provider.totals as any)[metric], saved.totals?.[metric],
        { decimals: metric === "revenue" ? 2 : metric === "engagementRate" ? 4 : undefined, conversions: metric === "conversions" }));
    }
    checks.push(...compareProviderRows("Campaign Comparison", provider.rows, saved.rows, ["campaign", "source", "medium", "channel", "device", "country", "date"],
      ["sessions", "users", "conversions", "revenue", "engagedSessions", "sessionKeyEventRate"]));
  }
  for (const part of ["landingPages", "conversionEvents"] as const) {
    try {
      const result = part === "landingPages" ? await service.getLandingPagesReport(campaignId, facade, scope.startDate, connection.propertyId, 50, scope.filter, scope.endDate, true)
        : await service.getConversionEventsReport(campaignId, facade, scope.startDate, connection.propertyId, 50, scope.filter, scope.endDate, true,
          Object.fromEntries(expectedDaily.map(row => [row.date, row.conversions])));
      const stored = scope.publication[part];
      // These APIs use the property's currency, not the campaign's requested currency. Compare their own like-for-like outputs.
      if (!stored || stored.propertyId !== result.propertyId || stored.revenueMetric !== result.revenueMetric) throw new Error("SOURCE_DETAIL_SCOPE_UNVERIFIED");
      checks.push(...compareProviderRows(`Overview / ${part}`, result.rows, stored.rows,
        part === "landingPages" ? ["landingPage", "source", "medium"] : ["eventName"],
        part === "landingPages" ? ["sessions", "users", "conversions"] : ["conversions"]));
      if (part === "conversionEvents") {
        for (const metric of ["eventCount", "users"]) {
          if (result.rows.every((row: any) => row[metric] == null) && stored.rows.every((row: any) => row[metric] == null)) {
            checks.push({ section: "Overview / conversionEvents", code: `${metric}_UNAVAILABLE`, status: "passed" });
          } else checks.push(...compareProviderRows("Overview / conversionEvents", result.rows, stored.rows, ["eventName"], [metric]));
        }
      }
      if (result.rows.length || stored.rows.length) checks.push({ section: `Overview / ${part}`, code: "DETAIL_REVENUE_CURRENCY_NOT_RECORDED", status: "unverified" });
    } catch { checks.push({ section: `Overview / ${part}`, code: "SOURCE_DETAIL_UNVERIFIED", status: "unverified" }); }
  }
  return checks;
}

function uniqueConnection(snapshot: LiveNumberSnapshot, table: string, source: any, mapping: any) {
  const matches = (snapshot.rows[table] || []).filter(row => row.isActive !== false && row.campaignId === source.campaignId
    && (!mapping.connectionId || row.id === mapping.connectionId));
  if (matches.length !== 1) throw new Error("PROVIDER_CONNECTION_SCOPE_UNVERIFIED");
  return matches[0];
}
async function readJson(url: string, token: string, body?: unknown, request: typeof fetch = fetch) {
  const response = await request(url, { method: body === undefined ? "GET" : "POST", redirect: "error",
    signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw new Error("PROVIDER_REQUEST_FAILED");
  return response.json();
}
function aggregateDatedValues(rows: any[], endDate: string): any[] {
  const daily = new Map<string, number>();
  for (const row of rows) {
    if (!dateIsValid(row.date) || numberOrNull(row.value) === null) throw new Error("PROVIDER_VALUE_OR_DATE_UNVERIFIED");
    if (row.date <= endDate) daily.set(row.date, (daily.get(row.date) || 0) + row.value);
  }
  return Array.from(daily).map(([date, value]) => ({ date, value }));
}
function selectedTableRows(rows: any[], mapping: any, kind: "revenue" | "spend") {
  const selected = Array.isArray(mapping.campaignValues) && mapping.campaignValues.length ? mapping.campaignValues.map(String)
    : mapping.campaignValue ? [String(mapping.campaignValue)] : [];
  if (mapping.campaignColumn && !selected.length) throw new Error("SOURCE_FILTER_UNVERIFIED");
  const values: any[] = [];
  for (const row of rows) {
    if (selected.length && mapping.campaignColumn && !selected.includes(String(row[mapping.campaignColumn] ?? "").trim())) continue;
    const raw = String(row[mapping[kind + "Column"]] ?? "").trim();
    if (!raw) continue;
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw)) throw new Error("SOURCE_AMOUNT_FORMAT_UNVERIFIED");
    const value = Number(raw.replaceAll(",", ""));
    if (value <= 0) continue; // Current CSV/Sheets confirmed-revenue and spend importer contract.
    const date = normalizeFinancialSourceDateKey(row[mapping.dateColumn]);
    if (!date) throw new Error("SOURCE_DATE_UNVERIFIED");
    values.push({ date, value });
  }
  return values;
}

export async function readFinancialSourceValues(snapshot: LiveNumberSnapshot, source: any, kind: "revenue" | "spend", request: typeof fetch = fetch) {
  const mapping = parseMonitorMapping(source.mappingConfig);
  if (source.currency !== snapshot.campaign.currency || (mapping.currency && mapping.currency !== source.currency)
    || mapping.valueSource === "conversion_value") throw new Error("SOURCE_CURRENCY_OR_DEFINITION_UNVERIFIED");
  if (source.sourceType === "csv") {
    const stored = mapping[kind === "revenue" ? "csvStoredRevenueRows" : "csvStoredSpendRows"];
    if (!Array.isArray(stored) || stored.length !== mapping.csvRowCount || !mapping.storedDateColumn) throw new Error("CSV_ORIGINAL_ROWS_UNVERIFIED");
    const amountKey = kind === "revenue" ? "storedRevenueColumn" : "storedSpendColumn";
    const storedAmountColumn = amountKey in mapping ? mapping[amountKey] : mapping[kind + "Column"];
    const storedCampaignColumn = "storedCampaignColumn" in mapping ? mapping.storedCampaignColumn : mapping.campaignColumn;
    if (!storedAmountColumn || storedAmountColumn !== mapping[kind + "Column"] || mapping.storedDateColumn !== mapping.dateColumn
      || (storedCampaignColumn || "") !== (mapping.campaignColumn || "")) throw new Error("CSV_ORIGINAL_MAPPING_UNVERIFIED");
    const table = stored.map(row => ({ [mapping[kind + "Column"]]: row[kind + "Raw"], [mapping.dateColumn]: row.dateRaw,
      ...(mapping.campaignColumn ? { [mapping.campaignColumn]: row.campaignKey } : {}) }));
    return selectedTableRows(table, mapping, kind);
  }
  if (source.sourceType === "google_sheets") {
    let connection = uniqueConnection(snapshot, "googleSheetsConnections", source, mapping);
    if (connection.spreadsheetId !== mapping.spreadsheetId || connection.sheetName !== mapping.sheetName || !mapping.dateColumn) throw new Error("SHEET_SCOPE_UNVERIFIED");
    if (connection.method === "service_account") connection = await hydrateGoogleSheetsServiceAccountConnection(connection);
    const token = connection.method === "service_account" ? connection.accessToken : await googleMonitorCredential(connection, request);
    const range = `'${String(mapping.sheetName).replaceAll("'", "''")}'`;
    const json = await readJson(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(mapping.spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`, token, undefined, request);
    if (!Array.isArray(json.values) || !Array.isArray(json.values[0]) || json.values.length > 10001) throw new Error("SHEET_RESULT_UNVERIFIED");
    const headers = json.values[0].map(String);
    if (new Set(headers).size !== headers.length || [mapping[kind + "Column"], mapping.dateColumn, mapping.campaignColumn].filter(Boolean).some(key => !headers.includes(key))) throw new Error("SHEET_COLUMNS_UNVERIFIED");
    return selectedTableRows(json.values.slice(1).map((row: any[]) => Object.fromEntries(headers.map((key: string, index: number) => [key, row[index] ?? ""]))), mapping, kind);
  }
  if (source.sourceType === "shopify" && kind === "revenue") {
    const connection = uniqueConnection(snapshot, "shopifyConnections", source, mapping), accessToken = monitorCredential(connection);
    const shopDomain = normalizeShopifyDomain(connection.shopDomain), apiVersion = getShopifyApiVersion();
    const start = mapping.providerQueryAudit?.orderWindowStart || mapping.orderWindowStart;
    if (!shopDomain || !Number.isFinite(Date.parse(start)) || mapping.revenueMetric !== "current_total_price"
      || mapping.orderDateBasis !== "created_at_campaign_reporting_timezone" || mapping.currencyBasis !== "shop_money_campaign_parity"
      || !Array.isArray(mapping.selectedValues) || !mapping.selectedValues.length) throw new Error("SHOPIFY_QUERY_SCOPE_UNVERIFIED");
    const get = (endpoint: string) => shopifyAdminFetch({ shopDomain, accessToken, endpoint, fetchImpl: request, max429Retries: 0 });
    const scopesResponse = await get("/admin/oauth/access_scopes.json");
    if (!scopesResponse.ok) throw new Error("SHOPIFY_SCOPES_UNVERIFIED");
    const scopes = await scopesResponse.json();
    if (!Array.isArray(scopes.access_scopes)) throw new Error("SHOPIFY_SCOPES_UNVERIFIED");
    requireShopifyOrderWindowScopes(scopes.access_scopes.map((s: any) => s.handle), start);
    let next: string | null = `/admin/api/${apiVersion}/orders.json?status=any&limit=250&order=created_at%20asc&created_at_min=${encodeURIComponent(start)}`;
    const pages = new Set<string>(), ids = new Set<string>(), orders: any[] = [];
    while (next) {
      if (pages.has(next) || pages.size >= 40) throw new Error("SHOPIFY_PAGINATION_UNVERIFIED");
      pages.add(next);
      const response = await get(next);
      if (!response.ok) throw new Error("PROVIDER_REQUEST_FAILED");
      const json = await response.json();
      if (!Array.isArray(json.orders)) throw new Error("SHOPIFY_RESULT_UNVERIFIED");
      for (const order of json.orders) {
        if (!order.id || ids.has(String(order.id))) throw new Error("SHOPIFY_ORDER_ID_UNVERIFIED");
        ids.add(String(order.id)); orders.push(order);
      }
      const link: string = response.headers.get("link") || "";
      next = link.match(/<([^>]+)>;\s*rel="?next"?/i)?.[1] || null;
    }
    const field = String(mapping.campaignField || "");
    if (field.startsWith("utm_")) {
      const candidates = orders.filter(order => !getShopifyOrderUtm(order)[field as keyof ReturnType<typeof getShopifyOrderUtm>]);
      if (candidates.length) {
        const orderIds = candidates.map(order => order.admin_graphql_api_id || `gid://shopify/Order/${order.id}`);
        const journeys = await fetchShopifyOrderCustomerJourneyUtms({ shopDomain, accessToken, apiVersion, orderIds, fetchImpl: request });
        candidates.forEach((order, index) => {
          const journey = journeys.get(orderIds[index]);
          if (!journey || journey.ready === false) throw new Error("SHOPIFY_ATTRIBUTION_UNVERIFIED");
          order.__metricMindCustomerJourneyUtm = journey;
        });
      }
    }
    const includeTestOrders = orders.some(order => order.test === true)
      ? await isShopifyPartnerDevelopmentStore({ shopDomain, accessToken, apiVersion, fetchImpl: request }) : false;
    const values: any[] = [];
    for (const order of orders) {
      const candidates = field === "tags" ? String(order.tags || "").split(",").map(v => v.trim())
        : field === "discount_codes" ? getShopifyDiscountCodes(order)
        : field.startsWith("utm_") ? [getShopifyOrderUtm(order)[field as keyof ReturnType<typeof getShopifyOrderUtm>]] : null;
      if (!candidates) throw new Error("SHOPIFY_ATTRIBUTION_DEFINITION_UNVERIFIED");
      if (!candidates.some(value => mapping.selectedValues.includes(value))) continue;
      const money = getShopifyConfirmedRevenueAmounts(order, { includeDevelopmentStoreTestOrders: includeTestOrders });
      if (!money) continue;
      if (money.shopCurrency !== source.currency) throw new Error("SHOPIFY_CURRENCY_UNVERIFIED");
      values.push({ date: getShopifyOrderReportingDate(order, snapshot.campaign.reportingTimeZone), value: money.shopAmount });
    }
    return values;
  }
  if (kind !== "revenue" || !["hubspot", "salesforce"].includes(source.sourceType)) throw new Error("PROVIDER_ADAPTER_NOT_VERIFIED");
  if (mapping.valueSource && mapping.valueSource !== "revenue") throw new Error("CRM_VALUE_DEFINITION_UNVERIFIED");
  const savedRecords = (snapshot.rows.revenueRecords || []).filter(row => row.revenueSourceId === source.id);
  // Current CRM importers deliberately omit dated-materialization metadata for
  // an empty zero result. Zero has no date allocation to invent; verify it by
  // querying the same saved selection over the common completed-date window.
  const emptyMaterialization = mapping.mode === "revenue_to_date" && numberOrNull(mapping.lastTotalRevenue) === 0
    && savedRecords.length > 0 && savedRecords.every(row => row.campaignId === source.campaignId && row.currency === source.currency
      && dateIsValid(row.date) && numberOrNull(row.revenue) === 0);
  if ((mapping.dailyMaterialization !== "selected_date_field_v1" && !emptyMaterialization) || !Number.isFinite(Date.parse(mapping.lastSyncedAt))
    || !Number.isInteger(mapping.days) || mapping.days < 1 || !Array.isArray(mapping.selectedValues) || !mapping.selectedValues.length) throw new Error("CRM_SAVED_QUERY_WINDOW_UNVERIFIED");
  // Exclude the partial boundary day: old imports recorded completion time, not the exact query-start millisecond.
  const start = new Date(Date.parse(mapping.lastSyncedAt) - (mapping.days - 1) * 86400000).toISOString().slice(0, 10);
  if (source.sourceType === "hubspot") {
    const token = monitorCredential(uniqueConnection(snapshot, "hubspotConnections", source, mapping));
    if (!Array.isArray(mapping.stageIds) || !mapping.stageIds.length || !mapping.dateField || !mapping.campaignProperty || !mapping.revenueProperty) throw new Error("CRM_MAPPING_UNVERIFIED");
    let after: string | undefined;
    let accountCurrency: string | undefined;
    const values: any[] = [], state = { ids: new Set<string>() }, cursors = new Set<string>();
    for (let page = 0; page < MAX_HUBSPOT_PAGES; page++) {
      const json = await readJson("https://api.hubapi.com/crm/v3/objects/deals/search", token, {
        filterGroups: [{ filters: [{ propertyName: mapping.campaignProperty, operator: "IN", values: mapping.selectedValues },
          { propertyName: "dealstage", operator: "IN", values: mapping.stageIds },
          { propertyName: mapping.dateField, operator: "GTE", value: String(Date.parse(start)) }] }],
        properties: [mapping.campaignProperty, mapping.revenueProperty, mapping.dateField, "dealstage", "deal_currency_code", "hs_currency"], limit: 100, ...(after ? { after } : {}),
      }, request);
      validateHubspotSearchPage(json, state);
      for (const deal of json.results) {
        const p = deal.properties;
        let recordCurrency = String(p.deal_currency_code || p.hs_currency || "").trim().toUpperCase();
        if (!recordCurrency) {
          if (accountCurrency === undefined) accountCurrency = String((await readJson("https://api.hubapi.com/account-info/v3/details", token, undefined, request)).companyCurrency || "").trim().toUpperCase();
          recordCurrency = accountCurrency;
        }
        if (!mapping.selectedValues.includes(String(p[mapping.campaignProperty])) || !mapping.stageIds.includes(String(p.dealstage))
          || !/^[A-Z]{3}$/.test(recordCurrency) || recordCurrency !== source.currency) throw new Error("CRM_RESPONSE_SCOPE_UNVERIFIED");
        const value = numberOrNull(p[mapping.revenueProperty]), date = normalizeFinancialSourceDateKey(p[mapping.dateField]);
        if (value === null || !date || date < start) throw new Error("CRM_VALUE_UNVERIFIED");
        values.push({ date, value });
      }
      const next = nextHubspotPageCursor(json.paging?.next?.after, page + 1, cursors);
      if (!next) return { values, startDate: start };
      after = next;
    }
    throw new Error("PROVIDER_PAGINATION_INCOMPLETE");
  }
  const connection = uniqueConnection(snapshot, "salesforceConnections", source, mapping);
  const token = monitorCredential(connection);
  const instance = new URL(connection.instanceUrl);
  if (instance.protocol !== "https:" || instance.username || instance.password || instance.port || !/\.(salesforce\.com|force\.com)$/.test(instance.hostname)) throw new Error("SALESFORCE_HOST_UNVERIFIED");
  if (![mapping.campaignField, mapping.dateField, mapping.revenueField].every(v => typeof v === "string" && isSafeSalesforceFieldPath(v))) throw new Error("CRM_MAPPING_UNVERIFIED");
  if (mapping.dateField !== "CloseDate") throw new Error("CRM_DATE_DEFINITION_UNVERIFIED");
  const query = `SELECT Id, ${mapping.campaignField}, ${mapping.dateField}, ${mapping.revenueField}, CurrencyIsoCode FROM Opportunity WHERE (IsWon = true OR StageName LIKE 'Closed Won%') AND ${mapping.dateField} >= ${start} AND ${mapping.campaignField} IN (${mapping.selectedValues.map((v: string) => `'${escapeSalesforceSoqlStringLiteral(v)}'`).join(",")})`;
  const version = process.env.SALESFORCE_API_VERSION || "v59.0";
  if (!/^v\d+\.\d+$/.test(version)) throw new Error("SALESFORCE_VERSION_UNVERIFIED");
  let missingCurrencyColumn = false, accountCurrency: string | null = null;
  const initialUrl = `${instance.origin}/services/data/${version}/query?q=${encodeURIComponent(query)}`;
  const checkedRequest: typeof fetch = async (url, options) => {
    const response = await request(url, options);
    if (String(url) === initialUrl && response.status === 400) {
      const errors = await response.clone().json().catch(() => null);
      missingCurrencyColumn = Array.isArray(errors) && errors.some(error => error?.errorCode === "INVALID_FIELD"
        && /no such column.*currencyisocode/i.test(String(error.message)));
    }
    return response;
  };
  let records: any[];
  try { records = await fetchCompleteSalesforceQuery({ initialUrl, instanceUrl: instance.origin, accessToken: token, fetchImpl: checkedRequest }); }
  catch (error) {
    if (!missingCurrencyColumn) throw error;
    const detected = await detectSalesforceCurrency({ accessToken: token, instanceUrl: instance.origin, apiVersion: version, fetchImpl: request, requireSingleCurrency: true });
    accountCurrency = detected.detectedCurrency;
    if (!accountCurrency || accountCurrency !== source.currency) throw new Error("SALESFORCE_ACCOUNT_CURRENCY_UNVERIFIED");
    records = await fetchCompleteSalesforceQuery({ initialUrl: `${instance.origin}/services/data/${version}/query?q=${encodeURIComponent(query.replace(", CurrencyIsoCode", ""))}`,
      instanceUrl: instance.origin, accessToken: token, fetchImpl: request });
  }
  const readField = (row: any, path: string) => path.split(".").reduce((value, part) => value?.[part], row);
  return { startDate: start, values: records.map(row => {
    if ((row.CurrencyIsoCode || accountCurrency) !== source.currency || !mapping.selectedValues.includes(String(readField(row, mapping.campaignField)))) throw new Error("CRM_RESPONSE_SCOPE_UNVERIFIED");
    const value = numberOrNull(readField(row, mapping.revenueField)), date = row[mapping.dateField];
    if (value === null || !dateIsValid(date) || date < start) throw new Error("CRM_VALUE_UNVERIFIED");
    return { date, value };
  }) };
}

export async function checkFinancialProviderNumbers(snapshot: LiveNumberSnapshot, now = new Date(), request: typeof fetch = fetch): Promise<NumberCheck[]> {
  const { endDate } = resolveMonitorScope(snapshot, now), checks: NumberCheck[] = [];
  for (const kind of ["revenue", "spend"] as const) for (const source of snapshot.rows[kind + "Sources"] || []) {
    if (!source.isActive || (source.platformContext && source.platformContext !== "ga4")) continue;
    const subject = monitorHash(source.id), section = `Financial sources / ${source.sourceType} / ${kind}`;
    try {
      const result = await readFinancialSourceValues(snapshot, source, kind, request);
      const values = Array.isArray(result) ? result : result.values, start = Array.isArray(result) ? "1900-01-01" : result.startDate;
      const all = (snapshot.rows[kind + "Records"] || []).filter(row => row[kind + "SourceId"] === source.id && row.date >= start && row.date <= endDate);
      if (all.some(row => row.campaignId !== snapshot.campaign.id || row.currency !== source.currency)) throw new Error("MATERIALIZED_SCOPE_UNVERIFIED");
      const aggregate = all.filter(row => !row.subCampaignUrn), selected = aggregate.length ? aggregate : all;
      const expected = aggregateDatedValues(values, endDate), actual = aggregateDatedValues(selected.map(row => ({ date: row.date, value: numberOrNull(row[kind]) })), endDate);
      // Zero-only materialization rows carry no value; compare the union of nonzero daily inputs.
      checks.push(...compareProviderRows(section, expected.filter(r => r.value !== 0), actual.filter(r => r.value !== 0), ["date"], ["value"], subject));
    } catch (error) {
      const code = error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "PROVIDER_CHECK_UNVERIFIED";
      checks.push({ section, code, subject, status: "unverified" });
    }
  }
  return checks;
}
