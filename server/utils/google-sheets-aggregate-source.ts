import { filterGoogleSheetsRows, googleSheetsMappings, pickConversionValueFromRows } from "./googleSheetsSelection";
import { hasCompleteGoogleSheetsCache } from "./google-sheets-revenue-ranges";

export function parseGoogleSheetsMetricNumber(value: any): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const raw = String(value).trim().replace(/^\$\s*/, "").replace(/%$/, "").trim();
  if (!/^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)$/.test(raw)) return null;
  const number = Number(raw.replace(/,/g, ""));
  return Number.isFinite(number) && Math.abs(number) < 1e12 ? number : null;
}

const normalizeSummaryHeader = (name: any) => String(name ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
const metricAliases: Record<string, RegExp> = {
  revenue: /^(?:total )?(?:revenue|sales)(?: \([A-Z]{3}\))?$/i,
  spend: /^(?:total )?(?:spend|cost)(?: \([A-Z]{3}\))?$/i,
  customers: /^(?:total )?customers?$/, leads: /^(?:total )?leads?$/, clicks: /^(?:total )?clicks?$/,
  impressions: /^(?:total )?impressions?$/, conversions: /^(?:total )?conversions?$/,
};

export function googleSheetsMetricTotal(metrics: Record<string, number | null>, includes: RegExp[], excludes: RegExp[] = []): number | null {
  const matches = Object.entries(metrics).filter(([name]) => includes.some(re => re.test(normalizeSummaryHeader(name))) && !excludes.some(re => re.test(normalizeSummaryHeader(name))));
  return matches.length === 1 && matches[0][1] !== null && Number.isFinite(matches[0][1]) ? matches[0][1] : null;
}

export function getGoogleSheetsSummaryDisplayValue(col: { name: string; total: number | null }, metrics: Record<string, number | null>, mappings: any[] = []): { summaryValue: number | null; aggregation: string; unavailableReason?: string } {
  const h = normalizeSummaryHeader(col.name);
  const metric = (key: string) => {
    const mapped = mappings.filter(m => (m.targetFieldId || m.platformField) === key);
    if (mapped.length) return mapped.length === 1 ? metrics[mapped[0].sourceColumnName] ?? null : null;
    return googleSheetsMetricTotal(metrics, [metricAliases[key]]);
  };
  const unavailable = { summaryValue: null, aggregation: "unavailable", unavailableReason: "Requires unambiguous numeric inputs and a positive denominator from the same selected rows" };
  const ratio = (numerator: number | null, denominator: number | null, scale = 1, aggregation = "derived_ratio") =>
    numerator !== null && denominator !== null && denominator > 0 ? { summaryValue: numerator / denominator * scale, aggregation } : unavailable;
  if (/^(roas|return on ad spend)$/.test(h)) return ratio(metric("revenue"), metric("spend"), 1, "derived_revenue_per_spend");
  if (/^(roi|roi %|return on investment)$/.test(h)) {
    const revenue = metric("revenue"), spend = metric("spend");
    return ratio(revenue !== null && spend !== null ? revenue - spend : null, spend, 100, "derived_profit_per_spend_pct");
  }
  const costDenominator = /^(cpc|cost per click)$/.test(h) ? "clicks" : /^(cpm|cost per (?:thousand|mille) impressions)$/.test(h) ? "impressions"
    : /^(cpa|cost per (?:acquisition|conversion))$/.test(h) ? "conversions" : /^(cpl|cost per lead)$/.test(h) ? "leads" : /^(cac|customer acquisition cost)$/.test(h) ? "customers" : null;
  if (costDenominator) return ratio(metric("spend"), metric(costDenominator), costDenominator === "impressions" ? 1000 : 1, `derived_spend_per_${costDenominator}`);
  if (/^(ctr|ctr %|click through rate|click through rate %)$/.test(h)) {
    const result = ratio(metric("clicks"), metric("impressions"), 100, "derived_clicks_per_impressions_pct");
    return result.summaryValue !== null && (result.summaryValue < 0 || result.summaryValue > 100) ? unavailable : result;
  }
  if (/^(cvr|cvr %|conversion rate|conversion rate %)$/.test(h)) return ratio(metric("conversions"), metric("clicks"), 100, "derived_conversions_per_clicks_pct");
  // Unknown rates/averages cannot be added or averaged without their denominator contract.
  if (/%|\brate\b|\baverage\b|\bavg\b|\bper\b|\bconversion value\b|\b(roas|roi|ctr|cvr|cpc|cpm|cpa|cpl|cac)\b/.test(h)) return unavailable;
  return col.total === null ? unavailable : { summaryValue: col.total, aggregation: "sum" };
}

export function buildGoogleSheetsMetricSummary(headers: any[], rows: any[][], rawMappings: any = null) {
  const mappings = googleSheetsMappings(rawMappings, headers).map(m => ({ ...m, sourceColumnName: String(headers[m.sourceColumnIndex ?? m.columnIndex]).trim() }));
  const names = headers.map(h => String(h ?? "").trim());
  const nonempty = names.filter(Boolean).map(normalizeSummaryHeader);
  if (new Set(nonempty).size !== nonempty.length) throw new Error("Google Sheets column names must be unique");
  const metrics: Record<string, number | null> = {};
  const columns: Array<{ name: string; index: number; type: string; total: number | null; count: number }> = [];
  names.forEach((name, index) => {
    if (mappings.some(m => ["campaign_name", "campaign_id", "platform", "date"].includes(m.targetFieldId || m.platformField) && (m.sourceColumnIndex ?? m.columnIndex) === index)) return;
    if (!name || /^(date|week|day|time|timestamp|period|month|year)/i.test(name) || /\b(id|identifier|urn|uuid)\b/.test(normalizeSummaryHeader(name))) return;
    const cells = rows.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "")).map(row => row[index]);
    const numbers = cells.map(parseGoogleSheetsMetricNumber);
    const count = numbers.filter(n => n !== null).length;
    if (count === 0) return;
    const sum = numbers.reduce<number>((total, n) => total + (n ?? 0), 0);
    const total = count === cells.length && Number.isFinite(sum) ? sum : null;
    const type = /\b(roas|roi|ctr|cvr)\b|return on (?:ad spend|investment)|\brate\b|%/i.test(name) ? "decimal" : /\$|\brevenue\b|\bspend\b|\bcost\b|\bbudget\b|\b(cpc|cpm|cpa|cpl|cac)\b/i.test(name) || cells.some(v => String(v).includes("$"))
      ? "currency" : numbers.some(n => n !== null && !Number.isInteger(n)) ? "decimal" : "integer";
    metrics[name] = total;
    columns.push({ name, index, type, total, count });
  });
  const detectedColumns = columns.map(col => {
    const valueMapping = mappings.find(m => (m.sourceColumnIndex ?? m.columnIndex) === col.index && (m.targetFieldId || m.platformField) === "conversion_value");
    if (valueMapping) {
      const dateIndex = valueMapping.dateColumnIndex;
      const latest = valueMapping.dateStrategy === "latest";
      const dateValid = !latest || (Number.isInteger(dateIndex) && dateIndex >= 0 && dateIndex < headers.length
        && (!valueMapping.dateColumnName || valueMapping.dateColumnName === headers[dateIndex])
        && rows.every(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row[dateIndex])) && Number.isFinite(Date.parse(String(row[dateIndex])))
          && new Date(String(row[dateIndex])).toISOString().slice(0, 10) === String(row[dateIndex])));
      const summaryValue = col.total === null || !dateValid || rows.some(row => (parseGoogleSheetsMetricNumber(row[col.index]) ?? -1) < 0) ? null : pickConversionValueFromRows({ rows, valueColumnIndex: col.index, dateColumnIndex: dateIndex, strategy: latest ? "latest" : "median", allowZero: true });
      return { ...col, summaryValue, aggregation: latest ? "latest" : "median", ...(summaryValue === null ? { unavailableReason: "Requires valid mapped conversion values and dates" } : {}) };
    }
    return { ...col, ...getGoogleSheetsSummaryDisplayValue(col, metrics, mappings) };
  });
  return { metrics, detectedColumns };
}

const GOOGLE_SHEETS_KNOWN_METRICS = [
  "impressions",
  "clicks",
  "conversions",
  "leads",
  "sessions",
  "users",
] as const;

type GoogleSheetsConfirmedFinancials = {
  revenue?: number;
  spend?: number;
  currency?: string | null;
  revenueSourceIds?: string[];
  spendSourceIds?: string[];
};

const parseNum = (value: any): number => {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const clean = typeof value === "string" ? value.replace(/[$,%\s,]/g, "") : value;
  const parsed = typeof clean === "string" ? parseFloat(clean) : Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseMappings = (raw: any): any[] => {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const campaignWantsGoogleSheets = (campaign: any): boolean => {
  return String(campaign?.platform || "")
    .split(",")
    .map((platform: string) => platform.trim().toLowerCase())
    .some((platform: string) => platform === "google-sheets" || platform === "google sheets");
};

const isMainGoogleSheetsConnection = (campaign: any, conn: any): boolean => {
  const purpose = String(conn?.purpose || "").trim().toLowerCase();
  return campaignWantsGoogleSheets(campaign)
    && (!campaign?.id || conn?.campaignId === campaign.id)
    && conn?.isActive !== false
    && !!conn?.spreadsheetId
    && conn.spreadsheetId !== "pending"
    && (!purpose || purpose === "general");
};

const cachedRows = (conn: any): any[] => {
  const cache = conn?.cachedData;
  return cache && Array.isArray(cache.rows) ? cache.rows : [];
};

const mappedColumnIndex = (conn: any, metricName: string): number | null => {
  const mappings = parseMappings(conn?.columnMappings || conn?.column_mappings);
  const mapping = mappings.find((item: any) =>
    String(item?.targetFieldId || item?.platformField || "").trim().toLowerCase() === metricName
  );
  const index = mapping?.sourceColumnIndex ?? mapping?.columnIndex;
  return Number.isInteger(index) && index >= 0 ? index : null;
};

const latestRefresh = (connections: any[]): string | null => {
  return connections.reduce((latest: string | null, conn: any) => {
    if (!conn?.lastDataRefreshAt) return latest;
    const date = new Date(conn.lastDataRefreshAt);
    if (!Number.isFinite(date.getTime())) return latest;
    const next = date.toISOString();
    return !latest || next > latest ? next : latest;
  }, null);
};

export function buildGoogleSheetsPlatformSourceForAggregate(
  campaign: any,
  connections: any[],
  confirmedFinancials: GoogleSheetsConfirmedFinancials = {},
  includeCachedMetrics = true,
) {
  const mainConnections = (Array.isArray(connections) ? connections : [])
    .filter((conn: any) => isMainGoogleSheetsConnection(campaign, conn));
  if (mainConnections.length === 0) return null;

  const metrics: Record<string, number | null> = {};
  const includedMetrics: string[] = [];
  const confirmedRevenue = parseNum(confirmedFinancials.revenue);
  const confirmedSpend = parseNum(confirmedFinancials.spend);
  const revenueSourceIds = Array.isArray(confirmedFinancials.revenueSourceIds)
    ? confirmedFinancials.revenueSourceIds.map(String).filter(Boolean)
    : [];
  const spendSourceIds = Array.isArray(confirmedFinancials.spendSourceIds)
    ? confirmedFinancials.spendSourceIds.map(String).filter(Boolean)
    : [];
  const campaignCurrency = String(campaign?.currency || "USD").trim().toUpperCase();
  const confirmedCurrency = String(confirmedFinancials.currency || "").trim().toUpperCase();
  const exactCurrencyVerified = includeCachedMetrics || confirmedCurrency === campaignCurrency;
  const hasConfirmedRevenue = exactCurrencyVerified && revenueSourceIds.length > 0;
  const hasConfirmedSpend = exactCurrencyVerified && spendSourceIds.length > 0;

  for (const metricName of GOOGLE_SHEETS_KNOWN_METRICS) {
    let hasMappedRows = false;
    let invalid = false;
    let total = 0;
    for (const conn of includeCachedMetrics ? mainConnections : []) {
      try {
        googleSheetsMappings(conn.columnMappings, conn.cachedData?.headers || []);
        const columnIndex = mappedColumnIndex(conn, metricName);
        if (columnIndex === null) continue;
        if (!hasCompleteGoogleSheetsCache(conn)) { invalid = true; continue; }
        const headers = conn.cachedData.headers;
        const rows = filterGoogleSheetsRows(conn, headers, cachedRows(conn), campaign?.name || "");
        const summary = buildGoogleSheetsMetricSummary(headers, rows, conn.columnMappings);
        const column = summary.detectedColumns.find(col => col.index === columnIndex);
        if (!column || column.summaryValue === null) { invalid = true; continue; }
        hasMappedRows = true;
        total += column.summaryValue;
      } catch { invalid = true; }
    }
    metrics[metricName] = hasMappedRows && !invalid ? Number(total.toFixed(2)) : null;
    if (hasMappedRows && !invalid) includedMetrics.push(metricName);
  }

  metrics.revenue = hasConfirmedRevenue ? Number(confirmedRevenue.toFixed(2)) : null;
  metrics.spend = hasConfirmedSpend ? Number(confirmedSpend.toFixed(2)) : null;
  metrics.roas = hasConfirmedRevenue && hasConfirmedSpend && confirmedSpend > 0 ? Number((confirmedRevenue / confirmedSpend).toFixed(2)) : null;
  metrics.roi = hasConfirmedRevenue && hasConfirmedSpend && confirmedSpend > 0 ? Number((((confirmedRevenue - confirmedSpend) / confirmedSpend) * 100).toFixed(2)) : null;
  if (hasConfirmedRevenue) includedMetrics.push("revenue");
  if (hasConfirmedSpend) includedMetrics.push("spend");
  if (hasConfirmedRevenue && hasConfirmedSpend && confirmedSpend > 0) includedMetrics.push("roas", "roi");

  const excludedMetrics = [
    ...GOOGLE_SHEETS_KNOWN_METRICS
      .filter((metricName) => !includedMetrics.includes(metricName))
      .map((metricName) => ({
        metric: metricName,
        reason: `Google Sheets ${metricName} requires a mapped column and refreshed cached rows`,
      })),
    ...(hasConfirmedSpend ? [] : [{ metric: "spend", reason: "Google Sheets spend requires an active google_sheets-scoped spend source" }]),
    ...(hasConfirmedRevenue ? [] : [{ metric: "revenue", reason: "Google Sheets confirmed revenue requires an active google_sheets-scoped revenue source" }]),
    ...(hasConfirmedRevenue && hasConfirmedSpend && confirmedSpend > 0 ? [] : [
      { metric: "roi", reason: "ROI requires confirmed Google Sheets revenue and spend source paths" },
      { metric: "roas", reason: "ROAS requires confirmed Google Sheets revenue and spend source paths" },
    ]),
  ];

  return {
    id: "google_sheets",
    label: "Google Sheets",
    category: "custom",
    connected: true,
    capabilities: ["customMetrics", ...GOOGLE_SHEETS_KNOWN_METRICS, "revenue", "spend", "roi", "roas"],
    includedMetrics,
    excludedMetrics,
    metrics,
    freshness: {
      datasetCount: mainConnections.length,
      connectionIds: mainConnections.map((conn: any) => String(conn.id || "")).filter(Boolean),
      sheetNames: mainConnections.map((conn: any) => String(conn.sheetName || conn.spreadsheetName || conn.spreadsheetId || "")).filter(Boolean),
      lastDataRefreshAt: latestRefresh(mainConnections),
      confirmedRevenueSourceIds: revenueSourceIds,
      confirmedSpendSourceIds: spendSourceIds,
      currency: confirmedFinancials.currency || null,
    },
  };
}
