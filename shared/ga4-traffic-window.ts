export const addDerivedGA4EngagedSessions = <T extends Record<string, any>>(row: T): T & { engagedSessions: number } => {
  const sessions = Number(row?.sessions || 0) || 0;
  const existing = Number(row?.engagedSessions || 0) || 0;
  if (existing > 0 || sessions <= 0) return { ...row, engagedSessions: existing };
  const rawRate = Number(row?.engagementRate || 0) || 0;
  const rate = rawRate > 1 ? rawRate / 100 : rawRate;
  return { ...row, engagedSessions: Math.max(0, Math.round(sessions * rate)) };
};

export const summarizeGA4TrafficRows = (rows: any[]) => {
  const totals = (Array.isArray(rows) ? rows : []).reduce((acc, rawRow) => {
    const row = addDerivedGA4EngagedSessions(rawRow || {});
    return {
      users: acc.users + (Number(row.users || 0) || 0),
      sessions: acc.sessions + (Number(row.sessions || 0) || 0),
      pageviews: acc.pageviews + (Number(row.pageviews || 0) || 0),
      conversions: acc.conversions + (Number(row.conversions || 0) || 0),
      revenue: acc.revenue + (Number(row.revenue || 0) || 0),
      engagedSessions: acc.engagedSessions + (Number(row.engagedSessions || 0) || 0),
    };
  }, { users: 0, sessions: 0, pageviews: 0, conversions: 0, revenue: 0, engagedSessions: 0 });

  return {
    ...totals,
    engagementRate: totals.sessions > 0 ? totals.engagedSessions / totals.sessions : 0,
  };
};
