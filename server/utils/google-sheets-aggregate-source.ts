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
  const hasConfirmedRevenue = confirmedRevenue > 0 && revenueSourceIds.length > 0;
  const hasConfirmedSpend = confirmedSpend > 0 && spendSourceIds.length > 0;

  for (const metricName of GOOGLE_SHEETS_KNOWN_METRICS) {
    let hasMappedRows = false;
    let total = 0;
    for (const conn of mainConnections) {
      const columnIndex = mappedColumnIndex(conn, metricName);
      const rows = cachedRows(conn);
      if (columnIndex === null || rows.length === 0) continue;
      hasMappedRows = true;
      total += rows.reduce((sum: number, row: any[]) => sum + parseNum(Array.isArray(row) ? row[columnIndex] : null), 0);
    }
    metrics[metricName] = hasMappedRows ? Number(total.toFixed(2)) : null;
    if (hasMappedRows) includedMetrics.push(metricName);
  }

  metrics.revenue = hasConfirmedRevenue ? Number(confirmedRevenue.toFixed(2)) : null;
  metrics.spend = hasConfirmedSpend ? Number(confirmedSpend.toFixed(2)) : null;
  metrics.roas = hasConfirmedRevenue && hasConfirmedSpend ? Number((confirmedRevenue / confirmedSpend).toFixed(2)) : null;
  metrics.roi = hasConfirmedRevenue && hasConfirmedSpend ? Number((((confirmedRevenue - confirmedSpend) / confirmedSpend) * 100).toFixed(2)) : null;
  if (hasConfirmedRevenue) includedMetrics.push("revenue");
  if (hasConfirmedSpend) includedMetrics.push("spend");
  if (hasConfirmedRevenue && hasConfirmedSpend) includedMetrics.push("roas", "roi");

  const excludedMetrics = [
    ...GOOGLE_SHEETS_KNOWN_METRICS
      .filter((metricName) => !includedMetrics.includes(metricName))
      .map((metricName) => ({
        metric: metricName,
        reason: `Google Sheets ${metricName} requires a mapped column and refreshed cached rows`,
      })),
    ...(hasConfirmedSpend ? [] : [{ metric: "spend", reason: "Google Sheets spend requires an active google_sheets-scoped spend source" }]),
    ...(hasConfirmedRevenue ? [] : [{ metric: "revenue", reason: "Google Sheets confirmed revenue requires an active google_sheets-scoped revenue source" }]),
    ...(hasConfirmedRevenue && hasConfirmedSpend ? [] : [
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
