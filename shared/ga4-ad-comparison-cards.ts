export interface GA4AdComparisonCardRow {
  name: string;
  sessions: number;
  conversionRate: number;
  [metric: string]: string | number;
}

export function selectGA4AdComparisonLeaderCards<T extends GA4AdComparisonCardRow>(comparisonRows: T[], selectedMetric: string) {
  const bestPerforming = [...comparisonRows].sort((a, b) => {
    const av = Number((a as any)[selectedMetric] || 0);
    const bv = Number((b as any)[selectedMetric] || 0);
    return bv - av;
  })[0];

  const mostEfficient = [...comparisonRows]
    .filter(c => c.sessions > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const needsAttention = selectGA4AdComparisonNeedsAttention(comparisonRows, bestPerforming);

  return { bestPerforming, mostEfficient, needsAttention };
}

function selectGA4AdComparisonNeedsAttention<T extends GA4AdComparisonCardRow>(comparisonRows: T[], bestPerforming?: T) {
  const rowsWithSessions = [...comparisonRows].filter(c => c.sessions > 0);
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
