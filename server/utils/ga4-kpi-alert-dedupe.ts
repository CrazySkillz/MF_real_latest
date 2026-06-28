type GA4KPIDuplicateCandidate = {
  id?: unknown;
  campaignId?: unknown;
  platformType?: unknown;
  metric?: unknown;
  name?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const normalizeGA4KPIDuplicateMetric = (value: unknown): string =>
  String(value || "").trim().toLowerCase().replace(/\s+/g, "");

const timestampRank = (value: unknown): number => {
  const time = value instanceof Date ? value.getTime() : new Date(value as any).getTime();
  return Number.isFinite(time) ? time : 0;
};

const isNewerGA4KPI = (candidate: GA4KPIDuplicateCandidate, current: GA4KPIDuplicateCandidate): boolean => {
  const candidateCreatedAt = timestampRank(candidate?.createdAt);
  const currentCreatedAt = timestampRank(current?.createdAt);
  if (candidateCreatedAt !== currentCreatedAt) return candidateCreatedAt > currentCreatedAt;

  const candidateUpdatedAt = timestampRank(candidate?.updatedAt);
  const currentUpdatedAt = timestampRank(current?.updatedAt);
  if (candidateUpdatedAt !== currentUpdatedAt) return candidateUpdatedAt > currentUpdatedAt;

  return String(candidate?.id || "") > String(current?.id || "");
};

export function getGA4KPIDuplicateKey(kpi: GA4KPIDuplicateCandidate): string | null {
  const platformType = String(kpi?.platformType || "").trim().toLowerCase();
  if (platformType !== "google_analytics") return null;

  const campaignId = String(kpi?.campaignId || "").trim();
  const metricKey = normalizeGA4KPIDuplicateMetric(kpi?.metric || kpi?.name);
  if (!campaignId || !metricKey) return null;

  return `${campaignId}:${metricKey}`;
}

export function getLatestGA4KPIIdsByDuplicateKey(rows: GA4KPIDuplicateCandidate[]): Map<string, string> {
  const latestRows = new Map<string, GA4KPIDuplicateCandidate>();

  for (const row of rows || []) {
    const key = getGA4KPIDuplicateKey(row);
    const id = String(row?.id || "").trim();
    if (!key || !id) continue;

    const current = latestRows.get(key);
    if (!current || isNewerGA4KPI(row, current)) latestRows.set(key, row);
  }

  return new Map(Array.from(latestRows.entries()).map(([key, row]) => [key, String(row?.id || "").trim()]));
}

export function isLatestGA4KPIForDuplicateKey(kpi: GA4KPIDuplicateCandidate, latestIdsByKey: Map<string, string>): boolean {
  const key = getGA4KPIDuplicateKey(kpi);
  if (!key) return true;

  const latestId = latestIdsByKey.get(key);
  return !latestId || String(kpi?.id || "").trim() === latestId;
}
