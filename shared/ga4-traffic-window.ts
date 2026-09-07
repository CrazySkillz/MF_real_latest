export const addDerivedGA4EngagedSessions = <T extends Record<string, any>>(row: T): T & { engagedSessions: number } => {
  const sessions = Number(row?.sessions || 0) || 0;
  const existingRaw = row?.engagedSessions;
  const existing = Number(existingRaw);
  if (existingRaw !== null && typeof existingRaw !== "undefined" && Number.isFinite(existing) && existing >= 0) {
    return { ...row, engagedSessions: existing };
  }
  if (sessions <= 0) return { ...row, engagedSessions: 0 };
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

export const mergeGA4OverviewCampaignRevenueRows = (
  trafficRows: any[],
  revenueRows: any[],
  campaignNames: string[] = [],
) => {
  const keyFor = (value: unknown) => String(value || "").trim().toLowerCase();
  const expectedNames = new Map(campaignNames.map((name) => [keyFor(name), String(name).trim()]));
  if (expectedNames.size !== campaignNames.filter((name) => keyFor(name)).length) {
    throw new Error("GA4_OVERVIEW_CAMPAIGN_SCOPE_AMBIGUOUS");
  }
  const resolveName = (value: unknown) => {
    const name = String(value || "").trim() || "(not set)";
    const key = keyFor(name);
    if (expectedNames.size > 0 && !expectedNames.has(key)) {
      throw new Error("GA4_OVERVIEW_CAMPAIGN_REVENUE_SCOPE_MISMATCH");
    }
    return { key, name: expectedNames.get(key) || name };
  };
  const merged = new Map<string, any>();
  for (const rawRow of Array.isArray(trafficRows) ? trafficRows : []) {
    const { key, name } = resolveName(rawRow?.campaign);
    const row = merged.get(key) || { campaign: name, sessions: 0, sessionsRaw: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0 };
    row.sessions += Number(rawRow?.sessions || 0);
    row.sessionsRaw += Number(rawRow?.sessionsRaw ?? rawRow?.sessions ?? 0);
    row.users += Number(rawRow?.users || 0);
    row.conversions += Number(rawRow?.conversions || 0);
    row.engagedSessions += Number(rawRow?.engagedSessions || 0);
    merged.set(key, row);
  }
  const revenueByCampaign = new Map<string, number>();
  for (const rawRow of Array.isArray(revenueRows) ? revenueRows : []) {
    const { key, name } = resolveName(rawRow?.campaign);
    revenueByCampaign.set(key, (revenueByCampaign.get(key) || 0) + Number(rawRow?.revenue || 0));
    if (!merged.has(key)) merged.set(key, { campaign: name, sessions: 0, sessionsRaw: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0 });
  }
  expectedNames.forEach((name, key) => {
    if (!merged.has(key)) merged.set(key, { campaign: name, sessions: 0, sessionsRaw: 0, users: 0, conversions: 0, revenue: 0, engagedSessions: 0 });
  });
  return Array.from(merged.entries()).map(([key, row]) => ({
    ...row,
    revenue: Number((revenueByCampaign.get(key) || 0).toFixed(2)),
  }));
};
