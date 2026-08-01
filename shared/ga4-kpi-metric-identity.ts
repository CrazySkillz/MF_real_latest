export type GA4KpiMetricIdentity =
  | "revenue"
  | "conversions"
  | "sessions"
  | "users"
  | "pageviews"
  | "conversion_rate"
  | "engagement_rate"
  | "roas"
  | "roi"
  | "cpa";

export const GA4_KPI_METRIC_INVENTORY: ReadonlyArray<{
  identity: GA4KpiMetricIdentity;
  aliases: readonly string[];
}> = [
  { identity: "revenue", aliases: ["revenue", "totalrevenue"] },
  { identity: "conversions", aliases: ["conversions", "totalconversions"] },
  { identity: "sessions", aliases: ["sessions", "totalsessions"] },
  { identity: "users", aliases: ["users", "totalusers"] },
  { identity: "pageviews", aliases: ["pageviews"] },
  { identity: "conversion_rate", aliases: ["conversionrate"] },
  { identity: "engagement_rate", aliases: ["engagementrate"] },
  { identity: "roas", aliases: ["roas"] },
  { identity: "roi", aliases: ["roi"] },
  { identity: "cpa", aliases: ["cpa"] },
];

const normalizedAliasToIdentity = new Map<string, GA4KpiMetricIdentity>(
  GA4_KPI_METRIC_INVENTORY.flatMap(({ identity, aliases }) =>
    aliases.map((alias) => [alias, identity] as const),
  ),
);

export const normalizeGA4KpiMetricAlias = (value: unknown): string =>
  String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");

export const getGA4KpiMetricIdentity = (value: unknown): GA4KpiMetricIdentity | null =>
  normalizedAliasToIdentity.get(normalizeGA4KpiMetricAlias(value)) || null;

export const resolveGA4KpiMetricIdentity = (...values: unknown[]): GA4KpiMetricIdentity | null => {
  for (const value of values) {
    const identity = getGA4KpiMetricIdentity(value);
    if (identity) return identity;
  }
  return null;
};

export const isComputableGA4KpiMetricIdentity = (value: unknown): boolean =>
  getGA4KpiMetricIdentity(value) !== null;

export const isGA4FinancialKpiMetricIdentity = (value: unknown): boolean => {
  const identity = getGA4KpiMetricIdentity(value);
  return identity === "revenue" || identity === "roas" || identity === "roi" || identity === "cpa";
};

export const getGA4KpiMetricDependencies = (...values: unknown[]) => {
  const identity = resolveGA4KpiMetricIdentity(...values);
  return {
    identity,
    requiresSpend: identity === "roas" || identity === "roi" || identity === "cpa",
    requiresRevenue: identity === "revenue" || identity === "roas" || identity === "roi",
  };
};
