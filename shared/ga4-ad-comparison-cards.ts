export interface GA4AdComparisonCardRow {
  name: string;
  sessions: number;
  conversions: number;
  conversionRate: number;
  [metric: string]: string | number;
}

export function selectGA4AdComparisonLeaderCards<T extends GA4AdComparisonCardRow>(comparisonRows: T[], selectedMetric: string) {
  const bestPerforming = [...comparisonRows]
    .filter(c => c.conversions > 0)
    .sort((a, b) => b.conversions - a.conversions || a.name.localeCompare(b.name))[0];

  const mostEfficient = [...comparisonRows]
    .filter(c => c.sessions > 0 && c.conversionRate > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const needsAttention = selectGA4AdComparisonNeedsAttention(comparisonRows, bestPerforming);

  const rankings = ([
    { title: "Highest Revenue", metric: "revenue", ascending: false },
    { title: "Highest Conversion Rate", metric: "conversionRate", ascending: false },
    { title: "Lowest Revenue", metric: "revenue", ascending: true },
    { title: "Lowest Conversion Rate", metric: "conversionRate", ascending: true },
  ] as const).map(({ title, metric, ascending }) => {
    const eligible = metric === "conversionRate" ? comparisonRows.filter(row => row.sessions > 0) : comparisonRows;
    const unavailable = eligible.some(row => !Number.isFinite(row[metric]))
      || (metric === "conversionRate" && comparisonRows.some(row => !Number.isFinite(row.sessions)));
    const sorted = unavailable ? [] : [...eligible].sort((a, b) =>
      (ascending ? Number(a[metric]) - Number(b[metric]) : Number(b[metric]) - Number(a[metric]))
      || a.name.localeCompare(b.name));
    const leaders = sorted.length < 2 ? [] : sorted.filter(row => row[metric] === sorted[0][metric]);
    return { title, metric, leaders, unavailableReason: unavailable ? "Data unavailable" : "Not enough comparable data" };
  });

  return { bestPerforming, mostEfficient, needsAttention, rankings };
}

export function formatGA4AdComparisonCardPct(value: number): string {
  return Number.isFinite(value) ? `${value.toFixed(2)}%` : "Unavailable";
}

function selectGA4AdComparisonNeedsAttention<T extends GA4AdComparisonCardRow>(comparisonRows: T[], bestPerforming?: T) {
  const rowsWithSessions = [...comparisonRows].filter(c => c.sessions > 0 && Number.isFinite(c.conversionRate));
  const meaningfulSessionFloor = Math.max(25, Math.ceil(Math.max(...rowsWithSessions.map(c => c.sessions), 0) * 0.1));
  const pool = rowsWithSessions.some(c => c.sessions >= meaningfulSessionFloor)
    ? rowsWithSessions.filter(c => c.sessions >= meaningfulSessionFloor)
    : rowsWithSessions;
  const sorted = pool.sort((a, b) => a.conversionRate - b.conversionRate);
  const candidate = sorted[0];
  if (!candidate) return candidate;

  if (candidate.name === bestPerforming?.name && sorted.length > 1) {
    const tiedLowest = sorted.find(c => c.name !== bestPerforming?.name && c.conversionRate === candidate.conversionRate);
    if (tiedLowest) return tiedLowest;
  }

  return candidate;
}
